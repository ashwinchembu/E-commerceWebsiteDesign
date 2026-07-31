import { execFileSync } from "node:child_process";

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP || "8e48d6-30";
const SHOPIFY_CLIENT_ID =
  process.env.SHOPIFY_CLIENT_ID || "079422065aab48eb65be83b6158971be";
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const KEYCHAIN_ACCOUNT = "Manoir Customer Access CLI";
const KEYCHAIN_SERVICE = "manoir-kits-shopify-client-secret";
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT || "manoir-kits";
const NAMESPACE = "$app:builder";
const KEY = "saved_jackets";
const REQUIRED_SCOPES = new Set([
  "write_customers",
  "customer_read_customers",
  "customer_write_customers",
]);

function readClientSecret() {
  if (process.env.SHOPIFY_CLIENT_SECRET) return process.env.SHOPIFY_CLIENT_SECRET;
  if (process.platform === "darwin") {
    try {
      return execFileSync(
        "/usr/bin/security",
        ["find-generic-password", "-a", KEYCHAIN_ACCOUNT, "-s", KEYCHAIN_SERVICE, "-w"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
    } catch {
      // Fall through to the deployed Firebase secret below.
    }
  }
  try {
    return execFileSync(
      "firebase",
      ["functions:secrets:access", "SHOPIFY_CLIENT_SECRET", "--project", FIREBASE_PROJECT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw new Error("The Shopify client secret is unavailable in Keychain and Firebase.");
  }
}

async function requestAccessToken() {
  const response = await fetch(
    `https://${SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,
    {
      body: new URLSearchParams({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: readClientSecret(),
        grant_type: "client_credentials",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Shopify authentication failed (${response.status}).`);
  }
  return payload.access_token;
}

async function graphql(accessToken, query, variables = {}) {
  const response = await fetch(
    `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      body: JSON.stringify({ query, variables }),
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    throw new Error(`Shopify Admin API failed (${response.status}): ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.data;
}

function assertScopes(scopes) {
  const active = new Set(scopes.map((scope) => scope.handle));
  const missing = [...REQUIRED_SCOPES].filter((scope) => !active.has(scope));
  if (missing.length) {
    throw new Error(`Add these Shopify app scopes and apply the app configuration: ${missing.join(", ")}.`);
  }
}

function matchingDefinition(definitions) {
  return definitions.find(
    (definition) =>
      definition.key === KEY &&
      (definition.namespace === NAMESPACE || definition.namespace.endsWith("--builder")),
  );
}

function assertDefinition(definition) {
  if (definition.type?.name !== "json") {
    throw new Error("The saved jacket metafield exists with the wrong data type.");
  }
  if (definition.access?.customerAccount !== "READ_WRITE") {
    throw new Error("The saved jacket metafield must allow Customer Account read/write access.");
  }
}

async function main() {
  const accessToken = await requestAccessToken();
  const setup = await graphql(
    accessToken,
    `query SavedJacketSetupStatus {
      currentAppInstallation {
        accessScopes { handle }
      }
      metafieldDefinitions(first: 100, ownerType: CUSTOMER, query: "key:saved_jackets") {
        nodes {
          id
          key
          namespace
          type { name }
          access { admin customerAccount }
        }
      }
    }`,
  );
  assertScopes(setup.currentAppInstallation?.accessScopes || []);
  const existing = matchingDefinition(setup.metafieldDefinitions?.nodes || []);
  if (existing) {
    assertDefinition(existing);
    console.log("Shopify saved jacket storage is already configured.");
    return;
  }

  const data = await graphql(
    accessToken,
    `mutation CreateSavedJacketsDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          key
          namespace
          type { name }
          access { admin customerAccount }
        }
        userErrors { code field message }
      }
    }`,
    {
      definition: {
        access: {
          admin: "MERCHANT_READ",
          customerAccount: "READ_WRITE",
        },
        description: "Up to four jacket builder configurations saved by this customer.",
        key: KEY,
        name: "Saved jacket comps",
        namespace: NAMESPACE,
        ownerType: "CUSTOMER",
        type: "json",
      },
    },
  );
  const result = data.metafieldDefinitionCreate;
  if (result.userErrors?.length || !result.createdDefinition) {
    throw new Error(
      result.userErrors?.map((error) => error.message).join("; ") ||
        "Shopify did not create the saved jacket definition.",
    );
  }
  assertDefinition(result.createdDefinition);
  console.log("Shopify saved jacket storage is configured.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
