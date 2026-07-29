import { useCallback, useEffect, useMemo, useState } from "react";

const TOKEN_STORAGE_KEY = "manoir-kits:shopify-customer-token";
const LOGIN_STORAGE_KEY = "manoir-kits:shopify-customer-login";
const LOGIN_MAX_AGE_MS = 15 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

type OpenIdConfiguration = {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
};

type CustomerApiConfiguration = {
  graphql_api: string;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
};

type StoredToken = {
  accessToken: string;
  expiresAt: number;
  idToken: string;
  refreshToken?: string;
};

type PendingLogin = {
  codeVerifier: string;
  createdAt: number;
  nonce: string;
  returnTo: string;
  state: string;
};

export type ShopifyCustomer = {
  displayName: string;
  hasFootballerAccess: boolean;
  id: string;
  tags: string[];
};

export type ShopifyCustomerAccountState =
  | { status: "checking"; customer: null; error: null }
  | { status: "signed-out"; customer: null; error: null }
  | { status: "signed-in"; customer: ShopifyCustomer; error: null }
  | { status: "unavailable"; customer: null; error: string }
  | { status: "error"; customer: null; error: string };

function storeDomain() {
  return (import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function clientId() {
  return (import.meta.env.VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ?? "").trim();
}

function allowedFootballerTags() {
  const configured = (import.meta.env.VITE_SHOPIFY_FOOTBALLER_TAGS ?? "footballer,owner")
    .split(",")
    .map((tag: string) => tag.trim().toLocaleLowerCase())
    .filter(Boolean);
  return new Set(configured);
}

function customerAccountIsConfigured() {
  return Boolean(storeDomain() && clientId());
}

function safeReturnTo(value: string | null | undefined) {
  if (!value) return "/";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function randomBase64Url(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Shopify customer accounts could not be reached.");
  return (await response.json()) as T;
}

async function discoverAuthentication() {
  return fetchJson<OpenIdConfiguration>(`https://${storeDomain()}/.well-known/openid-configuration`);
}

async function discoverCustomerApi() {
  return fetchJson<CustomerApiConfiguration>(`https://${storeDomain()}/.well-known/customer-account-api`);
}

function readSessionValue<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function clearStoredCustomerSession() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(LOGIN_STORAGE_KEY);
}

function saveToken(payload: TokenResponse) {
  const token: StoredToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
  };
  writeSessionValue(TOKEN_STORAGE_KEY, token);
  return token;
}

async function refreshToken(token: StoredToken) {
  if (!token.refreshToken) return null;
  const authentication = await discoverAuthentication();
  const body = new URLSearchParams({
    client_id: clientId(),
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
  });
  const response = await fetch(authentication.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token || !payload.id_token || !payload.expires_in) return null;
  if (!payload.refresh_token) payload.refresh_token = token.refreshToken;
  return saveToken(payload);
}

async function currentAccessToken() {
  const stored = readSessionValue<StoredToken>(TOKEN_STORAGE_KEY);
  if (!stored?.accessToken) return null;
  if (stored.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) return stored;
  return refreshToken(stored);
}

async function queryCustomer(accessToken: string) {
  const api = await discoverCustomerApi();
  const response = await fetch(api.graphql_api, {
    method: "POST",
    headers: {
      Authorization: accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "CustomerFootballerAccess",
      query: `
        query CustomerFootballerAccess {
          customer {
            id
            displayName
            tags
          }
        }
      `,
      variables: {},
    }),
  });
  const payload = (await response.json()) as {
    data?: { customer?: { displayName?: string; id: string; tags?: string[] } };
    errors?: Array<{ message: string }>;
  };
  const customer = payload.data?.customer;
  if (!response.ok || payload.errors?.length || !customer) {
    throw new Error(
      payload.errors?.map((error) => error.message).join(" ") ||
        "Shopify could not verify this customer account.",
    );
  }
  const tags = customer.tags ?? [];
  const approvedTags = allowedFootballerTags();
  return {
    displayName: customer.displayName?.trim() || "Shopify customer",
    hasFootballerAccess: tags.some((tag) => approvedTags.has(tag.trim().toLocaleLowerCase())),
    id: customer.id,
    tags,
  } satisfies ShopifyCustomer;
}

async function loadCustomer() {
  const token = await currentAccessToken();
  if (!token) return null;
  try {
    return await queryCustomer(token.accessToken);
  } catch (error) {
    clearStoredCustomerSession();
    throw error;
  }
}

async function beginLogin(returnTo: string) {
  if (!customerAccountIsConfigured()) {
    throw new Error("Shopify customer account access has not been connected yet.");
  }
  const authentication = await discoverAuthentication();
  const codeVerifier = randomBase64Url();
  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const pending: PendingLogin = {
    codeVerifier,
    createdAt: Date.now(),
    nonce,
    returnTo: safeReturnTo(returnTo),
    state,
  };
  writeSessionValue(LOGIN_STORAGE_KEY, pending);

  const authorizationUrl = new URL(authentication.authorization_endpoint);
  authorizationUrl.searchParams.set("client_id", clientId());
  authorizationUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", `${window.location.origin}/account`);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge", await sha256Base64Url(codeVerifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  window.location.assign(authorizationUrl.toString());
}

async function completeLogin(code: string, returnedState: string | null) {
  const pending = readSessionValue<PendingLogin>(LOGIN_STORAGE_KEY);
  if (
    !pending ||
    !returnedState ||
    returnedState !== pending.state ||
    Date.now() - pending.createdAt > LOGIN_MAX_AGE_MS
  ) {
    clearStoredCustomerSession();
    throw new Error("The Shopify sign-in request expired. Please try again.");
  }

  const authentication = await discoverAuthentication();
  const body = new URLSearchParams({
    client_id: clientId(),
    code,
    code_verifier: pending.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: `${window.location.origin}/account`,
  });
  const response = await fetch(authentication.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token || !payload.id_token || !payload.expires_in) {
    clearStoredCustomerSession();
    throw new Error(payload.error_description || "Shopify could not complete sign-in.");
  }
  sessionStorage.removeItem(LOGIN_STORAGE_KEY);
  const token = saveToken(payload);
  const customer = await queryCustomer(token.accessToken);
  return { customer, returnTo: safeReturnTo(pending.returnTo) };
}

export function useShopifyCustomerAccount(enabled = true) {
  const configured = enabled && customerAccountIsConfigured();
  const [state, setState] = useState<ShopifyCustomerAccountState>(() =>
    configured
      ? { status: "checking", customer: null, error: null }
      : {
          status: "unavailable",
          customer: null,
          error: "Shopify customer account access has not been connected yet.",
        },
  );

  const refresh = useCallback(async () => {
    if (!configured) return;
    setState({ status: "checking", customer: null, error: null });
    try {
      const customer = await loadCustomer();
      setState(
        customer
          ? { status: "signed-in", customer, error: null }
          : { status: "signed-out", customer: null, error: null },
      );
    } catch (error) {
      setState({
        status: "error",
        customer: null,
        error: error instanceof Error ? error.message : "Shopify customer verification failed.",
      });
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error_description") || params.get("error");

    if (window.location.pathname === "/account" && oauthError) {
      window.history.replaceState({}, "", "/account");
      setState({ status: "error", customer: null, error: oauthError });
      return;
    }

    if (window.location.pathname === "/account" && code) {
      void completeLogin(code, params.get("state"))
        .then(({ customer, returnTo }) => {
          if (!active) return;
          setState({ status: "signed-in", customer, error: null });
          window.location.replace(returnTo);
        })
        .catch((error) => {
          if (!active) return;
          window.history.replaceState({}, "", "/account");
          setState({
            status: "error",
            customer: null,
            error: error instanceof Error ? error.message : "Shopify sign-in failed.",
          });
        });
      return () => {
        active = false;
      };
    }

    void loadCustomer()
      .then((customer) => {
        if (!active) return;
        setState(
          customer
            ? { status: "signed-in", customer, error: null }
            : { status: "signed-out", customer: null, error: null },
        );
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: "error",
          customer: null,
          error: error instanceof Error ? error.message : "Shopify customer verification failed.",
        });
      });

    return () => {
      active = false;
    };
  }, [configured]);

  const signIn = useCallback(
    async (returnTo = window.location.pathname + window.location.search + window.location.hash) => {
      try {
        await beginLogin(returnTo);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Shopify customer sign-in could not start.";
        setState({ status: "error", customer: null, error: message });
        throw error;
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    const token = readSessionValue<StoredToken>(TOKEN_STORAGE_KEY);
    clearStoredCustomerSession();
    if (!token?.idToken) {
      window.location.assign("/");
      return;
    }
    try {
      const authentication = await discoverAuthentication();
      const logoutUrl = new URL(authentication.end_session_endpoint);
      logoutUrl.searchParams.set("id_token_hint", token.idToken);
      logoutUrl.searchParams.set("post_logout_redirect_uri", `${window.location.origin}/`);
      window.location.assign(logoutUrl.toString());
    } catch {
      window.location.assign("/");
    }
  }, []);

  return useMemo(
    () => ({ configured, refresh, signIn, signOut, state }),
    [configured, refresh, signIn, signOut, state],
  );
}
