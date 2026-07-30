import { execFileSync } from "node:child_process";

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP || "8e48d6-30";
const SHOPIFY_CLIENT_ID =
  process.env.SHOPIFY_CLIENT_ID || "079422065aab48eb65be83b6158971be";
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const KEYCHAIN_ACCOUNT = "Manoir Customer Access CLI";
const KEYCHAIN_SERVICE = "manoir-kits-shopify-client-secret";
const FOOTBALLER_TAG = "footballer";

function usage() {
  console.error(
    [
      "Usage:",
      "  npm run footballer -- grant customer@example.com",
      "  npm run footballer -- status customer@example.com",
      "  npm run footballer -- revoke customer@example.com",
      "",
      "Passing only an email defaults to grant.",
    ].join("\n"),
  );
}

function parseArguments() {
  const [first, second] = process.argv.slice(2);
  const actions = new Set(["grant", "status", "revoke"]);
  const action = actions.has(first) ? first : "grant";
  const email = actions.has(first) ? second : first;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    usage();
    process.exitCode = 2;
    return null;
  }

  return { action, email: email.toLowerCase() };
}

function readClientSecret() {
  if (process.env.SHOPIFY_CLIENT_SECRET) {
    return process.env.SHOPIFY_CLIENT_SECRET;
  }

  if (process.platform !== "darwin") {
    throw new Error(
      "Set SHOPIFY_CLIENT_SECRET when running outside the configured Mac.",
    );
  }

  try {
    return execFileSync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-a",
        KEYCHAIN_ACCOUNT,
        "-s",
        KEYCHAIN_SERVICE,
        "-w",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw new Error(
      "The Shopify client secret is missing from macOS Keychain.",
    );
  }
}

async function requestAccessToken() {
  const response = await fetch(
    `https://${SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: readClientSecret(),
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Shopify authentication failed (${response.status}): ${details}`,
    );
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Shopify did not return an Admin API access token.");
  }

  return payload.access_token;
}

async function graphql(query, variables) {
  const response = await fetch(
    `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": await requestAccessToken(),
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `Shopify Admin API failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  if (payload.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

async function findCustomer(email) {
  const data = await graphql(
    `query FindCustomer($query: String!) {
      customers(first: 10, query: $query) {
        nodes {
          id
          displayName
          email
          tags
        }
      }
    }`,
    { query: `email:${email}` },
  );

  const matches = data.customers.nodes.filter(
    (customer) => customer.email?.toLowerCase() === email,
  );

  if (matches.length === 0) {
    throw new Error(`No Shopify customer exists for ${email}.`);
  }
  if (matches.length > 1) {
    throw new Error(`More than one Shopify customer matched ${email}.`);
  }

  return matches[0];
}

async function updateTag(customer, action) {
  const mutationName = action === "grant" ? "tagsAdd" : "tagsRemove";
  const data = await graphql(
    `mutation UpdateFootballerTag($id: ID!, $tags: [String!]!) {
      ${mutationName}(id: $id, tags: $tags) {
        node {
          id
        }
        userErrors {
          message
        }
      }
    }`,
    { id: customer.id, tags: [FOOTBALLER_TAG] },
  );

  const errors = data[mutationName].userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }
}

async function main() {
  const args = parseArguments();
  if (!args) return;

  const customer = await findCustomer(args.email);
  const hasFootballerTag = customer.tags.some(
    (tag) => tag.toLowerCase() === FOOTBALLER_TAG,
  );
  const hasOwnerTag = customer.tags.some(
    (tag) => tag.toLowerCase() === "owner",
  );

  if (args.action === "status") {
    const active = hasFootballerTag || hasOwnerTag;
    console.log(
      `${customer.displayName} <${customer.email}>: footballer access ${
        active ? "active" : "inactive"
      }${hasOwnerTag && !hasFootballerTag ? " (owner tag)" : ""}`,
    );
    return;
  }

  if (args.action === "grant" && hasFootballerTag) {
    console.log(
      `${customer.displayName} <${customer.email}> already has footballer access.`,
    );
    return;
  }

  if (args.action === "revoke" && !hasFootballerTag) {
    console.log(
      `${customer.displayName} <${customer.email}> has no footballer tag to remove.`,
    );
    return;
  }

  await updateTag(customer, args.action);
  console.log(
    `${args.action === "grant" ? "Granted" : "Removed"} footballer access ${
      args.action === "grant" ? "for" : "from"
    } ${customer.displayName} <${customer.email}>.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
