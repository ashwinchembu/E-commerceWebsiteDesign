import assert from "node:assert/strict";
import test from "node:test";
import {
  createAccessCode,
  evaluateGrantUse,
  grantState,
  isAuthorizedAdminEmail,
  normalizeContactInput,
  normalizeFeedbackInput,
  normalizeFeedbackRecord,
  normalizeGrantInput,
  normalizeNewsletterInput,
  normalizeShopifyCustomer,
  parseAccessCode,
} from "./core.js";

test("admin bootstrap requires an exact verified allowlisted email", () => {
  const allowlist = ["ashchembu@gmail.com", "manoirkits@gmail.com"];
  assert.equal(
    isAuthorizedAdminEmail(" ASHCHEMBU@GMAIL.COM ", true, allowlist),
    true,
  );
  assert.equal(
    isAuthorizedAdminEmail("manoirkits@gmail.com", false, allowlist),
    false,
  );
  assert.equal(
    isAuthorizedAdminEmail("attacker@example.com", true, allowlist),
    false,
  );
  assert.equal(
    isAuthorizedAdminEmail("ashchembu@gmail.com.evil.test", true, allowlist),
    false,
  );
});

test("generated access codes parse and validate", () => {
  const generated = createAccessCode();
  const parsed = parseAccessCode(generated.code);
  assert.equal(parsed.id, generated.id);

  const result = evaluateGrantUse(
    {
      allowed_ips: [],
      expires_at: Date.now() + 60_000,
      id: generated.id,
      max_ips: 3,
      max_uses: 25,
      revoked_at: null,
      salt: generated.salt,
      secret_hash: generated.secretHash,
      use_count: 0,
    },
    parsed.secret,
    "203.0.113.10",
  );
  assert.equal(result.status, "ok");
  assert.equal(result.update.use_count, 1);
  assert.deepEqual(result.update.allowed_ips, ["203.0.113.10"]);
});

test("grant limits are enforced", () => {
  assert.equal(
    grantState({
      expires_at: Date.now() - 1,
      max_uses: 25,
      use_count: 0,
    }),
    "expired",
  );

  const generated = createAccessCode();
  const parsed = parseAccessCode(generated.code);
  const result = evaluateGrantUse(
    {
      allowed_ips: ["203.0.113.1"],
      expires_at: Date.now() + 60_000,
      max_ips: 1,
      max_uses: 25,
      revoked_at: null,
      salt: generated.salt,
      secret_hash: generated.secretHash,
      use_count: 0,
    },
    parsed.secret,
    "203.0.113.2",
  );
  assert.equal(result.status, "ip_limit");
});

test("grant input is normalized and rejected when expired", () => {
  const currentTime = Date.now();
  const normalized = normalizeGrantInput(
    {
      email: " OWNER@EXAMPLE.COM ",
      expiresAt: new Date(currentTime + 60_000).toISOString(),
      label: " Owner ",
      maxIps: 999,
      maxUses: 999,
      role: "admin",
    },
    currentTime,
  );
  assert.equal(normalized.email, "owner@example.com");
  assert.equal(normalized.maxIps, 50);
  assert.equal(normalized.maxUses, 500);

  assert.throws(
    () =>
      normalizeGrantInput(
        {
          expiresAt: new Date(currentTime - 1).toISOString(),
          label: "Expired",
        },
        currentTime,
      ),
    /future/,
  );
});

test("Shopify customer payloads normalize REST and GraphQL fields", () => {
  const customer = normalizeShopifyCustomer(
    {
      email: "USER@EXAMPLE.COM",
      firstName: "Ada",
      id: "gid://shopify/Customer/123",
      lastName: "Lovelace",
      legacyResourceId: "123",
      tags: ["footballer", "footballer"],
      updatedAt: "2026-07-29T12:00:00Z",
    },
    { runId: "sync-1", source: "full-sync" },
  );
  assert.equal(customer.shopify_id, "123");
  assert.equal(customer.email, "user@example.com");
  assert.deepEqual(customer.tags, ["footballer"]);
  assert.equal(customer.last_full_sync_id, "sync-1");
});

test("feedback input is normalized and constrained", () => {
  const feedback = normalizeFeedbackInput({
    category: " JACKET-BUILDER ",
    email: " CUSTOMER@EXAMPLE.COM ",
    message: "  The color picker is easy to use.  ",
    name: " Customer ",
    path: "/jacket-builder?step=colors",
    rating: "5",
  });

  assert.deepEqual(feedback, {
    category: "jacket-builder",
    email: "customer@example.com",
    message: "The color picker is easy to use.",
    name: "Customer",
    path: "/jacket-builder?step=colors",
    rating: 5,
  });

  assert.throws(
    () =>
      normalizeFeedbackInput({
        category: "website",
        message: "Useful",
        rating: 0,
      }),
    /rating/,
  );
  assert.throws(
    () =>
      normalizeFeedbackInput({
        category: "unsupported",
        message: "Useful",
        rating: 5,
      }),
    /category/,
  );
  assert.throws(
    () =>
      normalizeFeedbackInput({
        category: "website",
        email: "not-an-email",
        message: "Useful",
        rating: 5,
      }),
    /Email/,
  );
});

test("contact input is normalized and constrained", () => {
  const contact = normalizeContactInput({
    email: " CUSTOMER@EXAMPLE.COM ",
    message: "  I have a sizing question.  ",
    name: " Customer ",
    path: "/contact?source=footer",
    subject: " Jacket sizing ",
  });

  assert.deepEqual(contact, {
    email: "customer@example.com",
    message: "I have a sizing question.",
    name: "Customer",
    path: "/contact?source=footer",
    subject: "Jacket sizing",
  });
  assert.throws(
    () =>
      normalizeContactInput({
        email: "not-an-email",
        message: "Question",
        name: "Customer",
        subject: "Sizing",
      }),
    /Email/,
  );
});

test("newsletter input requires a valid normalized email", () => {
  assert.deepEqual(normalizeNewsletterInput({ email: " FAN@EXAMPLE.COM " }), {
    email: "fan@example.com",
  });
  assert.throws(
    () => normalizeNewsletterInput({ email: "not-an-email" }),
    /Email/,
  );
});

test("Shopify feedback metaobjects are sanitized for the admin inbox", () => {
  const feedback = normalizeFeedbackRecord({
    createdAt: "2026-07-30T12:00:00Z",
    fields: [
      { key: "rating", value: "5" },
      { key: "category", value: "website" },
      { key: "message", value: "  This is easy to use.  " },
      { key: "name", value: " Customer " },
      { key: "email", value: " CUSTOMER@EXAMPLE.COM " },
      { key: "page", value: "/feedback" },
      { key: "status", value: "NEW" },
      { key: "submitted_at", value: "2026-07-30T12:30:00Z" },
    ],
    handle: "feedback-private-network-digest",
    id: "gid://shopify/Metaobject/123",
  });

  assert.deepEqual(feedback, {
    category: "website",
    email: "customer@example.com",
    id: "gid://shopify/Metaobject/123",
    message: "This is easy to use.",
    name: "Customer",
    page: "/feedback",
    rating: 5,
    status: "new",
    submitted_at: "2026-07-30T12:30:00.000Z",
  });
  assert.equal("handle" in feedback, false);

  const malformed = normalizeFeedbackRecord({
    fields: [
      { key: "rating", value: "not-a-number" },
      { key: "message", value: "Still safe" },
    ],
    id: "gid://shopify/Metaobject/456",
  });
  assert.equal(malformed.rating, null);
});
