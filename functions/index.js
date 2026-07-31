import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import {
  defineInt,
  defineSecret,
  defineString,
} from "firebase-functions/params";
import {
  cleanString,
  createAccessCode,
  evaluateGrantUse,
  grantState,
  normalizeClientMeta,
  normalizeContactInput,
  normalizeFeedbackInput,
  normalizeFeedbackRecord,
  normalizeGrantInput,
  normalizeNewsletterInput,
  normalizeShopifyCustomer,
  parseAccessCode,
  publicGrant,
  secureEqual,
} from "./core.js";

initializeApp();

const REGION = "us-west1";
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const FUNCTIONS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

setGlobalOptions({
  concurrency: 40,
  maxInstances: 10,
  memory: "256MiB",
  region: REGION,
  timeoutSeconds: 60,
});

const eventRetentionDays = defineInt("ACCESS_EVENT_RETENTION_DAYS", {
  default: 30,
  description: "Days to retain private-access security events.",
});
const shopifyShop = defineString("SHOPIFY_SHOP", {
  default: "8e48d6-30",
  description: "Shopify shop subdomain or full myshopify.com domain.",
});
const shopifyClientId = defineString("SHOPIFY_CLIENT_ID", {
  default: "079422065aab48eb65be83b6158971be",
  description: "Client ID for the Manoir Customer Access Shopify app.",
});
const shopifyApiVersion = defineString("SHOPIFY_API_VERSION", {
  default: "2026-07",
  description: "Stable Shopify Admin API version.",
});
const shopifyClientSecret = defineSecret("SHOPIFY_CLIENT_SECRET");
const newsletterDiscountCode = defineString("NEWSLETTER_DISCOUNT_CODE", {
  default: "",
  description:
    "Optional active Shopify discount code returned after a newsletter signup.",
});

const db = getFirestore();
const auth = getAuth();
const grants = db.collection("accessGrants");
const events = db.collection("accessEvents");
const rateLimits = db.collection("accessRateLimits");
const shopifyCustomers = db.collection("shopifyCustomers");
const system = db.collection("system");
const webhookReceipts = db.collection("shopifyWebhookReceipts");
const FEEDBACK_METAOBJECT_TYPE = "$app:customer_feedback";
const FEEDBACK_RATE_WINDOW_MS = 5 * 60 * 1000;
const FEEDBACK_ALLOWED_ORIGINS = [
  "https://ecommerce-website-design.onrender.com",
  "https://manoirkits.com",
  "https://www.manoirkits.com",
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Administrator sign-in is required.");
  }
  if (request.auth.token.admin !== true) {
    throw new HttpsError(
      "permission-denied",
      "This account does not have administrator access.",
    );
  }
}

function invalidArgument(error) {
  if (error instanceof HttpsError) return error;
  return new HttpsError(
    "invalid-argument",
    error instanceof Error ? error.message : "The request is not valid.",
  );
}

function clientIp(rawRequest) {
  const first = (name) => {
    const value = rawRequest.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  return cleanString(
    first("cf-connecting-ip") ||
      first("x-real-ip") ||
      String(first("x-forwarded-for") || "").split(",")[0] ||
      rawRequest.ip ||
      rawRequest.socket?.remoteAddress ||
      "unknown",
    80,
  );
}

function requestContext(request) {
  const raw = request.rawRequest;
  const first = (name) => {
    const value = raw.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    asn: cleanString(first("cf-connecting-asn"), 32) || null,
    city: cleanString(first("x-vercel-ip-city") || first("cf-ipcity"), 180) || null,
    client_meta: normalizeClientMeta(request.data?.client),
    country:
      cleanString(first("x-vercel-ip-country") || first("cf-ipcountry"), 16) ||
      null,
    ip: clientIp(raw),
    latitude: cleanString(first("x-vercel-ip-latitude"), 32) || null,
    longitude: cleanString(first("x-vercel-ip-longitude"), 32) || null,
    postal_code: cleanString(first("x-vercel-ip-postal-code"), 32) || null,
    region:
      cleanString(
        first("x-vercel-ip-country-region") || first("cf-region"),
        180,
      ) || null,
    requested_path: cleanString(request.data?.path, 300) || null,
    user_agent: cleanString(first("user-agent"), 500) || null,
  };
}

async function insertAccessEvent(grantId, result, context, occurredAt) {
  const retentionMs =
    Math.max(1, eventRetentionDays.value()) * 24 * 60 * 60 * 1000;
  await events.add({
    ...context,
    expire_at: Timestamp.fromMillis(occurredAt + retentionMs),
    grant_id: grantId || null,
    occurred_at: occurredAt,
    result,
  });
}

function grantForAdmin(snapshot) {
  const { allowed_ips, salt, secret_hash, ...grant } = snapshot.data();
  return { id: snapshot.id, ...grant };
}

export const createAccessGrant = onCall(async (request) => {
  assertAdmin(request);
  let input;
  try {
    input = normalizeGrantInput(request.data);
  } catch (error) {
    throw invalidArgument(error);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generated = createAccessCode();
    const reference = grants.doc(generated.id);
    const createdAt = Date.now();
    const record = {
      allowed_ips: [],
      created_at: createdAt,
      email: input.email,
      expires_at: input.expiresAt,
      id: generated.id,
      label: input.label,
      last_used_at: null,
      max_ips: input.maxIps,
      max_uses: input.maxUses,
      notes: input.notes,
      revoked_at: null,
      role: input.role,
      salt: generated.salt,
      secret_hash: generated.secretHash,
      use_count: 0,
    };

    try {
      await reference.create(record);
      return {
        code: generated.code,
        grant: publicGrant(record),
      };
    } catch (error) {
      if (error?.code !== 6 && error?.code !== "already-exists") throw error;
    }
  }

  throw new HttpsError(
    "resource-exhausted",
    "A unique access code could not be generated. Try again.",
  );
});

export const listAccessGrants = onCall(async (request) => {
  assertAdmin(request);
  const snapshot = await grants.orderBy("created_at", "desc").limit(500).get();
  return { grants: snapshot.docs.map(grantForAdmin) };
});

export const listAccessEvents = onCall(async (request) => {
  assertAdmin(request);
  const requestedLimit = Math.trunc(Number(request.data?.limit || 200));
  const limit = Math.min(500, Math.max(1, requestedLimit));
  const snapshot = await events.orderBy("occurred_at", "desc").limit(limit).get();
  const grantIds = [
    ...new Set(snapshot.docs.map((doc) => doc.data().grant_id).filter(Boolean)),
  ];
  const grantSnapshots = await Promise.all(
    grantIds.map((id) => grants.doc(id).get()),
  );
  const grantById = new Map(
    grantSnapshots
      .filter((item) => item.exists)
      .map((item) => [item.id, item.data()]),
  );

  return {
    events: snapshot.docs.map((document) => {
      const event = document.data();
      const grant = grantById.get(event.grant_id);
      const { expire_at, ...publicEvent } = event;
      return {
        id: document.id,
        ...publicEvent,
        email: grant?.email || null,
        label: grant?.label || null,
      };
    }),
    retentionDays: Math.max(1, eventRetentionDays.value()),
  };
});

export const revokeAccessGrant = onCall(async (request) => {
  assertAdmin(request);
  const id = cleanString(request.data?.id, 20).toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(id)) {
    throw new HttpsError("invalid-argument", "Access grant ID is invalid.");
  }

  const reference = grants.doc(id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || snapshot.data().revoked_at) {
      throw new HttpsError(
        "not-found",
        "Access code was not found or is already revoked.",
      );
    }
    transaction.update(reference, { revoked_at: Date.now() });
  });

  try {
    await auth.revokeRefreshTokens(`access_${id}`);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  return { ok: true };
});

export const redeemAccessCode = onCall(async (request) => {
  const occurredAt = Date.now();
  const context = requestContext(request);
  const parsed = parseAccessCode(request.data?.code);
  const rateId = createHash("sha256").update(context.ip).digest("hex");
  const rateReference = rateLimits.doc(rateId);

  const outcome = await db.runTransaction(async (transaction) => {
    const rateSnapshot = await transaction.get(rateReference);
    const recentFailures = Array.isArray(rateSnapshot.data()?.failures)
      ? rateSnapshot
          .data()
          .failures.map(Number)
          .filter((timestamp) => timestamp >= occurredAt - FAILURE_WINDOW_MS)
      : [];

    if (recentFailures.length >= MAX_FAILURES) {
      transaction.set(
        rateReference,
        {
          expire_at: Timestamp.fromMillis(occurredAt + FAILURE_WINDOW_MS),
          failures: recentFailures,
          updated_at: occurredAt,
        },
        { merge: true },
      );
      return { grantId: null, status: "rate_limited" };
    }

    if (!parsed) {
      transaction.set(
        rateReference,
        {
          expire_at: Timestamp.fromMillis(occurredAt + FAILURE_WINDOW_MS),
          failures: [...recentFailures, occurredAt],
          updated_at: occurredAt,
        },
        { merge: true },
      );
      return { grantId: null, status: "invalid" };
    }

    const reference = grants.doc(parsed.id);
    const snapshot = await transaction.get(reference);
    const grant = snapshot.exists ? snapshot.data() : null;
    const evaluated = grant
      ? evaluateGrantUse(grant, parsed.secret, context.ip, occurredAt)
      : { status: "invalid" };

    if (evaluated.status !== "ok") {
      transaction.set(
        rateReference,
        {
          expire_at: Timestamp.fromMillis(occurredAt + FAILURE_WINDOW_MS),
          failures: [...recentFailures, occurredAt],
          updated_at: occurredAt,
        },
        { merge: true },
      );
      return { grantId: parsed.id, status: evaluated.status };
    }

    transaction.update(reference, evaluated.update);
    transaction.set(
      rateReference,
      {
        expire_at: Timestamp.fromMillis(occurredAt + FAILURE_WINDOW_MS),
        failures: recentFailures,
        updated_at: occurredAt,
      },
      { merge: true },
    );
    return {
      grant: { ...grant, ...evaluated.update },
      grantId: parsed.id,
      status: "ok",
    };
  });

  await insertAccessEvent(outcome.grantId, outcome.status, context, occurredAt);

  if (outcome.status === "rate_limited") {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Try again in 15 minutes.",
    );
  }
  if (outcome.status === "ip_limit") {
    throw new HttpsError(
      "permission-denied",
      "This code has reached its network limit. Ask the administrator for a new code.",
    );
  }
  if (outcome.status !== "ok") {
    throw new HttpsError(
      "unauthenticated",
      "That access code is invalid, expired, revoked, or has reached its use limit.",
    );
  }

  const access = publicGrant(outcome.grant);
  const token = await auth.createCustomToken(`access_${outcome.grantId}`, {
    access: true,
    expiresAt: access.expiresAt,
    grantId: outcome.grantId,
    role: access.role,
  });
  return { access, token };
});

export const getAccessSession = onCall(async (request) => {
  if (!request.auth || request.auth.token.access !== true) {
    throw new HttpsError("unauthenticated", "Private access is required.");
  }
  const grantId = cleanString(request.auth.token.grantId, 20).toUpperCase();
  const snapshot = await grants.doc(grantId).get();
  const grant = snapshot.exists ? snapshot.data() : null;
  if (grantState(grant) !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Private access has expired or been revoked.",
    );
  }
  return { access: publicGrant(grant) };
});

const guideFiles = {
  access: {
    filename: "Manoir-Kits-Access-Key-Guide.pdf",
    path: "Manoir-Kits-Access-Key-Guide.pdf",
  },
  orders: {
    filename: "Manoir-Kits-Shopify-Order-Guide.pdf",
    path: "Manoir-Kits-Shopify-Order-Guide.pdf",
  },
};

export const getAdminGuide = onCall(
  { memory: "512MiB" },
  async (request) => {
    assertAdmin(request);
    const guide = guideFiles[request.data?.guide];
    if (!guide) throw new HttpsError("not-found", "Guide was not found.");
    const content = await readFile(
      path.join(FUNCTIONS_DIRECTORY, "assets", guide.path),
    );
    return {
      base64: content.toString("base64"),
      contentType: "application/pdf",
      filename: guide.filename,
    };
  },
);

function normalizedShopDomain() {
  return shopifyShop
    .value()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\.myshopify\.com$/i, "")
    .replace(/\/$/, "");
}

let cachedShopifyToken = null;
let cachedShopifyTokenExpiry = 0;

async function shopifyAccessToken() {
  if (cachedShopifyToken && cachedShopifyTokenExpiry > Date.now() + 60_000) {
    return cachedShopifyToken;
  }
  const response = await fetch(
    `https://${normalizedShopDomain()}.myshopify.com/admin/oauth/access_token`,
    {
      body: new URLSearchParams({
        client_id: shopifyClientId.value(),
        client_secret: shopifyClientSecret.value(),
        grant_type: "client_credentials",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Shopify authentication failed (${response.status}): ${
        payload.error_description || payload.error || "No access token returned."
      }`,
    );
  }
  cachedShopifyToken = payload.access_token;
  cachedShopifyTokenExpiry =
    Date.now() + Math.max(300, Number(payload.expires_in || 3600)) * 1000;
  return cachedShopifyToken;
}

async function shopifyGraphql(query, variables) {
  const response = await fetch(
    `https://${normalizedShopDomain()}.myshopify.com/admin/api/${shopifyApiVersion.value()}/graphql.json`,
    {
      body: JSON.stringify({ query, variables }),
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": await shopifyAccessToken(),
      },
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    throw new Error(
      `Shopify Admin API failed (${response.status}): ${JSON.stringify(
        payload.errors || payload,
      )}`,
    );
  }
  return payload.data;
}

function submissionHandle(kind, ip, occurredAt) {
  const bucket = Math.floor(occurredAt / FEEDBACK_RATE_WINDOW_MS).toString(36);
  const networkDigest = createHmac("sha256", shopifyClientSecret.value())
    .update(ip)
    .digest("hex")
    .slice(0, 20);
  return `${kind}-${bucket}-${networkDigest}`;
}

function feedbackHandle(ip, occurredAt) {
  return submissionHandle("feedback", ip, occurredAt);
}

function feedbackMetaobjectFields(feedback, occurredAt) {
  const fields = [
    { key: "rating", value: String(feedback.rating) },
    { key: "category", value: feedback.category },
    { key: "message", value: feedback.message },
    { key: "page", value: feedback.path },
    { key: "submitted_at", value: new Date(occurredAt).toISOString() },
    { key: "status", value: "new" },
  ];
  if (feedback.name) fields.push({ key: "name", value: feedback.name });
  if (feedback.email) fields.push({ key: "email", value: feedback.email });
  return fields;
}

function contactMetaobjectFields(contact, occurredAt) {
  return [
    { key: "category", value: "contact" },
    { key: "message", value: `${contact.subject}\n\n${contact.message}` },
    { key: "page", value: contact.path },
    { key: "submitted_at", value: new Date(occurredAt).toISOString() },
    { key: "status", value: "new" },
    { key: "name", value: contact.name },
    { key: "email", value: contact.email },
  ];
}

async function createCustomerSubmission(fields, handle) {
  const data = await shopifyGraphql(
    `mutation CreateCustomerSubmission($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
        }
        userErrors {
          code
          field
          message
        }
      }
    }`,
    {
      metaobject: {
        fields,
        handle,
        type: FEEDBACK_METAOBJECT_TYPE,
      },
    },
  );
  return data?.metaobjectCreate;
}

function assertCustomerSubmission(result, noun) {
  const userErrors = Array.isArray(result?.userErrors)
    ? result.userErrors
    : [];
  if (userErrors.length) {
    const duplicate = userErrors.some((error) => {
      const code = cleanString(error?.code, 80).toUpperCase();
      const message = cleanString(error?.message, 300).toLowerCase();
      return (
        code === "TAKEN" ||
        message.includes("already exists") ||
        message.includes("has already been taken")
      );
    });
    if (duplicate) {
      throw new HttpsError(
        "resource-exhausted",
        `Please wait a few minutes before sending another ${noun}.`,
      );
    }

    logger.error("Shopify rejected a customer submission.", {
      errors: userErrors.slice(0, 5).map((error) => ({
        code: cleanString(error?.code, 80) || "unknown",
        field: Array.isArray(error?.field)
          ? error.field.map((part) => cleanString(part, 80)).slice(0, 8)
          : [],
      })),
      submissionType: noun,
    });
    throw new HttpsError(
      "failed-precondition",
      `${noun[0].toUpperCase()}${noun.slice(1)} is temporarily unavailable. Please try again later.`,
    );
  }

  if (!result?.metaobject?.id) {
    throw new HttpsError(
      "internal",
      `${noun[0].toUpperCase()}${noun.slice(1)} could not be confirmed. Please try again later.`,
    );
  }
}

export const submitFeedback = onCall(
  {
    consumeAppCheckToken: true,
    cors: FEEDBACK_ALLOWED_ORIGINS,
    enforceAppCheck: true,
    maxInstances: 5,
    secrets: [shopifyClientSecret],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (request.app?.alreadyConsumed) {
      throw new HttpsError(
        "permission-denied",
        "This feedback request has already been used.",
      );
    }

    // Silently accept automated honeypot submissions without sending them to Shopify.
    if (cleanString(request.data?.website, 120)) return { ok: true };

    let feedback;
    try {
      feedback = normalizeFeedbackInput(request.data);
    } catch (error) {
      throw invalidArgument(error);
    }

    const occurredAt = Date.now();
    let result;
    try {
      result = await createCustomerSubmission(
        feedbackMetaobjectFields(feedback, occurredAt),
        feedbackHandle(clientIp(request.rawRequest), occurredAt),
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Shopify feedback request failed.", {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new HttpsError(
        "unavailable",
        "Feedback is temporarily unavailable. Please try again later.",
      );
    }

    assertCustomerSubmission(result, "feedback");
    return { ok: true };
  },
);

export const submitContact = onCall(
  {
    consumeAppCheckToken: true,
    cors: FEEDBACK_ALLOWED_ORIGINS,
    enforceAppCheck: true,
    maxInstances: 5,
    secrets: [shopifyClientSecret],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (request.app?.alreadyConsumed) {
      throw new HttpsError(
        "permission-denied",
        "This contact request has already been used.",
      );
    }
    if (cleanString(request.data?.website, 120)) return { ok: true };

    let contact;
    try {
      contact = normalizeContactInput(request.data);
    } catch (error) {
      throw invalidArgument(error);
    }

    const occurredAt = Date.now();
    let result;
    try {
      result = await createCustomerSubmission(
        contactMetaobjectFields(contact, occurredAt),
        submissionHandle(
          "contact",
          clientIp(request.rawRequest),
          occurredAt,
        ),
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Shopify contact request failed.", {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new HttpsError(
        "unavailable",
        "Messages are temporarily unavailable. Please try again later.",
      );
    }

    assertCustomerSubmission(result, "message");
    return { ok: true };
  },
);

export const subscribeNewsletter = onCall(
  {
    consumeAppCheckToken: true,
    cors: FEEDBACK_ALLOWED_ORIGINS,
    enforceAppCheck: true,
    maxInstances: 5,
    secrets: [shopifyClientSecret],
    timeoutSeconds: 30,
  },
  async (request) => {
    if (request.app?.alreadyConsumed) {
      throw new HttpsError(
        "permission-denied",
        "This signup request has already been used.",
      );
    }
    if (cleanString(request.data?.website, 120)) {
      return { discountCode: null, ok: true };
    }

    let newsletter;
    try {
      newsletter = normalizeNewsletterInput(request.data);
    } catch (error) {
      throw invalidArgument(error);
    }

    try {
      const query = `email:${JSON.stringify(newsletter.email)}`;
      const customerData = await shopifyGraphql(
        `query FindNewsletterCustomer($query: String!) {
          customers(first: 10, query: $query) {
            nodes {
              id
              email
              emailMarketingConsent {
                marketingState
              }
            }
          }
        }`,
        { query },
      );
      const customer = (
        Array.isArray(customerData?.customers?.nodes)
          ? customerData.customers.nodes
          : []
      ).find(
        (item) =>
          cleanString(item?.email, 180).toLowerCase() === newsletter.email,
      );

      if (!customer) {
        const created = await shopifyGraphql(
          `mutation CreateNewsletterCustomer($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            input: {
              email: newsletter.email,
              emailMarketingConsent: {
                consentUpdatedAt: new Date().toISOString(),
                marketingOptInLevel: "SINGLE_OPT_IN",
                marketingState: "SUBSCRIBED",
              },
              tags: ["newsletter", "website-signup"],
            },
          },
        );
        const errors = created?.customerCreate?.userErrors || [];
        if (errors.length || !created?.customerCreate?.customer?.id) {
          throw new Error("Shopify rejected the newsletter customer.");
        }
      } else if (
        customer.emailMarketingConsent?.marketingState !== "SUBSCRIBED"
      ) {
        const updated = await shopifyGraphql(
          `mutation SubscribeNewsletterCustomer(
            $input: CustomerEmailMarketingConsentUpdateInput!
          ) {
            customerEmailMarketingConsentUpdate(input: $input) {
              customer {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            input: {
              customerId: customer.id,
              emailMarketingConsent: {
                consentUpdatedAt: new Date().toISOString(),
                marketingOptInLevel: "SINGLE_OPT_IN",
                marketingState: "SUBSCRIBED",
              },
            },
          },
        );
        const errors =
          updated?.customerEmailMarketingConsentUpdate?.userErrors || [];
        if (
          errors.length ||
          !updated?.customerEmailMarketingConsentUpdate?.customer?.id
        ) {
          throw new Error("Shopify rejected the marketing consent update.");
        }
      }
    } catch (error) {
      logger.error("Shopify newsletter signup failed.", {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new HttpsError(
        "unavailable",
        "Newsletter signup is temporarily unavailable. Please try again later.",
      );
    }

    return {
      discountCode:
        cleanString(newsletterDiscountCode.value(), 80).toUpperCase() || null,
      ok: true,
    };
  },
);

export const listFeedback = onCall(
  {
    cors: FEEDBACK_ALLOWED_ORIGINS,
    enforceAppCheck: true,
    maxInstances: 5,
    secrets: [shopifyClientSecret],
    timeoutSeconds: 30,
  },
  async (request) => {
    assertAdmin(request);
    const requestedLimit = Math.trunc(Number(request.data?.limit || 50));
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const after = cleanString(request.data?.after, 1000) || null;

    let connection;
    try {
      const data = await shopifyGraphql(
        `query ListCustomerFeedback(
          $type: String!
          $first: Int!
          $after: String
        ) {
          metaobjects(
            type: $type
            first: $first
            after: $after
            sortKey: "updated_at"
            reverse: true
          ) {
            nodes {
              id
              createdAt
              fields {
                key
                value
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }`,
        {
          after,
          first: limit,
          type: FEEDBACK_METAOBJECT_TYPE,
        },
      );
      connection = data?.metaobjects;
    } catch (error) {
      logger.error("Shopify feedback inbox request failed.", {
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new HttpsError(
        "unavailable",
        "The feedback inbox is temporarily unavailable.",
      );
    }

    if (!connection) {
      throw new HttpsError(
        "internal",
        "Shopify did not return the feedback inbox.",
      );
    }

    const feedback = (Array.isArray(connection.nodes) ? connection.nodes : [])
      .map(normalizeFeedbackRecord)
      .filter((item) => item.id && item.message);
    const nextCursor = connection.pageInfo?.hasNextPage
      ? cleanString(connection.pageInfo.endCursor, 1000) || null
      : null;
    return { feedback, nextCursor };
  },
);

async function commitCustomerPage(nodes, runId, mirroredAt) {
  for (let offset = 0; offset < nodes.length; offset += 250) {
    const batch = db.batch();
    for (const node of nodes.slice(offset, offset + 250)) {
      const customer = normalizeShopifyCustomer(node, {
        mirroredAt,
        runId,
        source: "full-sync",
      });
      batch.set(shopifyCustomers.doc(customer.shopify_id), customer, {
        merge: true,
      });
    }
    await batch.commit();
  }
}

async function deleteStaleFullSyncCustomers(runId) {
  const snapshot = await shopifyCustomers.get();
  const stale = snapshot.docs.filter((document) => {
    const customer = document.data();
    return (
      customer.source === "full-sync" &&
      customer.last_full_sync_id !== runId
    );
  });
  for (let offset = 0; offset < stale.length; offset += 400) {
    const batch = db.batch();
    stale
      .slice(offset, offset + 400)
      .forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
  return stale.length;
}

export const syncShopifyCustomers = onCall(
  {
    maxInstances: 1,
    memory: "512MiB",
    secrets: [shopifyClientSecret],
    timeoutSeconds: 540,
  },
  async (request) => {
    assertAdmin(request);
    const runId = randomUUID();
    const mirroredAt = Date.now();
    let after = null;
    let count = 0;

    do {
      const data = await shopifyGraphql(
        `query MirrorCustomers($after: String) {
          customers(first: 250, after: $after, sortKey: ID) {
            nodes {
              id
              legacyResourceId
              displayName
              email
              firstName
              lastName
              tags
              updatedAt
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }`,
        { after },
      );
      const connection = data?.customers;
      if (!connection) throw new Error("Shopify did not return customers.");
      await commitCustomerPage(connection.nodes || [], runId, mirroredAt);
      count += connection.nodes?.length || 0;
      after = connection.pageInfo?.hasNextPage
        ? connection.pageInfo.endCursor
        : null;
    } while (after);

    const removed = await deleteStaleFullSyncCustomers(runId);
    await system.doc("shopifyMirror").set(
      {
        customer_count_at_sync: count,
        last_error: null,
        last_full_sync_at: mirroredAt,
        last_full_sync_by: request.auth.uid,
        last_full_sync_id: runId,
      },
      { merge: true },
    );
    return { count, removed, syncedAt: mirroredAt };
  },
);

export const getShopifyMirrorStatus = onCall(async (request) => {
  assertAdmin(request);
  const [metadata, aggregate] = await Promise.all([
    system.doc("shopifyMirror").get(),
    shopifyCustomers.count().get(),
  ]);
  return {
    count: aggregate.data().count,
    ...(metadata.exists ? metadata.data() : {}),
  };
});

function verifyShopifyWebhook(rawRequest) {
  const supplied = cleanString(rawRequest.get("x-shopify-hmac-sha256"), 200);
  const expected = createHmac("sha256", shopifyClientSecret.value())
    .update(rawRequest.rawBody)
    .digest("base64");
  return secureEqual(supplied, expected);
}

async function deleteShopifyMirror() {
  while (true) {
    const snapshot = await shopifyCustomers.limit(400).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

export const shopifyCustomerWebhook = onRequest(
  {
    secrets: [shopifyClientSecret],
    timeoutSeconds: 120,
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).send("Method not allowed");
      return;
    }
    if (!verifyShopifyWebhook(request)) {
      response.status(401).send("Invalid webhook signature");
      return;
    }

    const configuredShop = `${normalizedShopDomain()}.myshopify.com`;
    const deliveredShop = cleanString(request.get("x-shopify-shop-domain"), 220);
    if (deliveredShop.toLowerCase() !== configuredShop.toLowerCase()) {
      response.status(403).send("Shop is not authorized");
      return;
    }

    const topic = cleanString(request.get("x-shopify-topic"), 120).toLowerCase();
    const webhookId =
      cleanString(request.get("x-shopify-webhook-id"), 180) ||
      createHash("sha256").update(request.rawBody).digest("hex");
    const receipt = webhookReceipts.doc(webhookId);
    const payload =
      request.body && typeof request.body === "object" ? request.body : {};
    const receivedAt = Date.now();

    try {
      const duplicate = await db.runTransaction(async (transaction) => {
        const receiptSnapshot = await transaction.get(receipt);
        if (receiptSnapshot.exists) return true;

        if (["customers/create", "customers/update"].includes(topic)) {
          const customer = normalizeShopifyCustomer(payload, {
            mirroredAt: receivedAt,
            source: "webhook",
          });
          transaction.set(
            shopifyCustomers.doc(customer.shopify_id),
            {
              ...customer,
              last_webhook_id: webhookId,
              last_webhook_topic: topic,
            },
            { merge: true },
          );
        } else if (["customers/delete", "customers/redact"].includes(topic)) {
          const deletedCustomerId = payload.id || payload.customer?.id;
          if (deletedCustomerId) {
            transaction.delete(
              shopifyCustomers.doc(String(deletedCustomerId).split("/").pop()),
            );
          }
        }

        transaction.create(receipt, {
          expire_at: Timestamp.fromMillis(
            receivedAt + 7 * 24 * 60 * 60 * 1000,
          ),
          received_at: receivedAt,
          shop: deliveredShop,
          topic,
        });
        return false;
      });

      if (!duplicate && topic === "shop/redact") {
        await deleteShopifyMirror();
        await system.doc("shopifyMirror").set(
          {
            customer_count_at_sync: 0,
            last_shop_redact_at: receivedAt,
          },
          { merge: true },
        );
      }
      response.status(200).send(duplicate ? "Duplicate ignored" : "OK");
    } catch (error) {
      logger.error("Shopify customer webhook failed.", {
        message: error instanceof Error ? error.message : String(error),
        topic,
        webhookId,
      });
      response.status(500).send("Webhook processing failed");
    }
  },
);
