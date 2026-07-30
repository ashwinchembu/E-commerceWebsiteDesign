import { execFileSync } from "node:child_process";

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP || "8e48d6-30";
const SHOPIFY_CLIENT_ID =
  process.env.SHOPIFY_CLIENT_ID || "079422065aab48eb65be83b6158971be";
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const KEYCHAIN_ACCOUNT = "Manoir Customer Access CLI";
const KEYCHAIN_SERVICE = "manoir-kits-shopify-client-secret";
const METAOBJECT_TYPE = "$app:customer_feedback";
const RUNTIME_SCOPES = new Set(["read_metaobjects", "write_metaobjects"]);
const SETUP_SCOPES = new Set([
  ...RUNTIME_SCOPES,
  "write_metaobject_definitions",
]);
const REQUIRED_FIELDS = [
  "rating",
  "category",
  "message",
  "name",
  "email",
  "page",
  "submitted_at",
  "status",
];

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
    throw new Error(
      `Shopify authentication failed (${response.status}). Check the app credentials.`,
    );
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
    throw new Error(
      `Shopify Admin API failed (${response.status}). Check the app scopes and API version.`,
    );
  }
  return payload.data;
}

function assertScopes(scopes, required) {
  const active = new Set(scopes.map((scope) => scope.handle));
  const missing = [...required].filter((scope) => !active.has(scope));
  if (missing.length) {
    throw new Error(
      `Add these Shopify app scopes before setup: ${missing.join(", ")}.`,
    );
  }
}

function assertDefinition(definition) {
  const keys = new Set(
    definition.fieldDefinitions.map((field) => field.key),
  );
  const missing = REQUIRED_FIELDS.filter((key) => !keys.has(key));
  if (missing.length) {
    throw new Error(
      `The existing feedback definition is missing fields: ${missing.join(", ")}.`,
    );
  }
}

async function verifyInboxQuery(accessToken) {
  const data = await graphql(
    accessToken,
    `query VerifyCustomerFeedbackInbox($type: String!) {
      metaobjects(
        type: $type
        first: 1
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
    { type: METAOBJECT_TYPE },
  );
  if (!data.metaobjects || !Array.isArray(data.metaobjects.nodes)) {
    throw new Error("Shopify did not return the customer feedback inbox.");
  }
  console.log("Shopify customer feedback inbox query is available.");
}

async function main() {
  const accessToken = await requestAccessToken();
  const setup = await graphql(
    accessToken,
    `query FeedbackSetupStatus($type: String!) {
      currentAppInstallation {
        accessScopes {
          handle
        }
      }
      metaobjectDefinitionByType(type: $type) {
        id
        name
        type
        fieldDefinitions {
          key
        }
      }
    }`,
    { type: METAOBJECT_TYPE },
  );
  if (setup.metaobjectDefinitionByType) {
    assertScopes(
      setup.currentAppInstallation?.accessScopes || [],
      RUNTIME_SCOPES,
    );
    assertDefinition(setup.metaobjectDefinitionByType);
    console.log("Shopify customer feedback metaobject is already configured.");
    await verifyInboxQuery(accessToken);
    return;
  }
  assertScopes(
    setup.currentAppInstallation?.accessScopes || [],
    SETUP_SCOPES,
  );

  const created = await graphql(
    accessToken,
    `mutation CreateFeedbackDefinition(
      $definition: MetaobjectDefinitionCreateInput!
    ) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          name
          type
          fieldDefinitions {
            key
          }
        }
        userErrors {
          code
          field
          message
        }
      }
    }`,
    {
      definition: {
        access: { admin: "MERCHANT_READ_WRITE" },
        fieldDefinitions: [
          {
            key: "rating",
            name: "Rating",
            type: "number_integer",
            validations: [
              { name: "min", value: "1" },
              { name: "max", value: "5" },
            ],
          },
          {
            key: "category",
            name: "Category",
            type: "single_line_text_field",
          },
          {
            key: "message",
            name: "Message",
            type: "multi_line_text_field",
            validations: [{ name: "max", value: "2000" }],
          },
          {
            key: "name",
            name: "Name",
            type: "single_line_text_field",
            validations: [{ name: "max", value: "120" }],
          },
          {
            key: "email",
            name: "Email",
            type: "single_line_text_field",
            validations: [{ name: "max", value: "180" }],
          },
          {
            key: "page",
            name: "Page",
            type: "single_line_text_field",
            validations: [{ name: "max", value: "300" }],
          },
          {
            key: "submitted_at",
            name: "Submitted at",
            type: "date_time",
          },
          {
            key: "status",
            name: "Status",
            type: "single_line_text_field",
          },
        ],
        name: "Customer feedback",
        type: METAOBJECT_TYPE,
      },
    },
  );
  const result = created.metaobjectDefinitionCreate;
  if (result.userErrors?.length) {
    throw new Error(
      `Shopify rejected the feedback definition: ${result.userErrors
        .map((error) => error.message)
        .join("; ")}`,
    );
  }
  assertDefinition(result.metaobjectDefinition);
  console.log(
    [
      "Created the Shopify customer feedback metaobject definition.",
      "Remove write_metaobject_definitions from the app now; runtime needs only write_metaobjects.",
    ].join("\n"),
  );
  await verifyInboxQuery(accessToken);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
