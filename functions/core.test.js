import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUnifiedRequestCards,
  createAccessCode,
  estimateChangeRequestHours,
  estimateDeploymentHours,
  evaluateGrantUse,
  grantState,
  isAuthorizedAdminEmail,
  normalizeContactInput,
  normalizeChangeRequestLog,
  normalizeDeploymentLog,
  normalizeFeedbackInput,
  normalizeFeedbackRecord,
  normalizeGrantInput,
  normalizeNewsletterInput,
  normalizeRequestCardReview,
  normalizeShopifyCustomer,
  normalizeSupportEntryInput,
  parseAccessCode,
  supportPlanSummary,
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
        email: "customer@example.com",
        message: "Useful",
        name: "Customer",
        rating: 0,
      }),
    /rating/,
  );
  assert.throws(
    () =>
      normalizeFeedbackInput({
        category: "unsupported",
        email: "customer@example.com",
        message: "Useful",
        name: "Customer",
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
        name: "Customer",
        rating: 5,
      }),
    /Email/,
  );
  assert.throws(
    () =>
      normalizeFeedbackInput({
        category: "website",
        email: "customer@example.com",
        message: "Useful",
        rating: 5,
      }),
    /name/,
  );
  assert.throws(
    () =>
      normalizeFeedbackInput({
        category: "website",
        message: "Useful",
        name: "Customer",
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

test("deployment logs are normalized and receive a bounded effort estimate", () => {
  const deployment = normalizeDeploymentLog({
    authorEmail: " ASHWIN@EXAMPLE.COM ",
    authorName: " Ashwin ",
    branch: "main",
    changedFiles: [
      { additions: 120, deletions: 20, path: "src/app/pages/AdminAccessPage.tsx" },
      { additions: 80, deletions: 4, path: "functions/index.js" },
    ],
    commitUrl: "https://github.com/example/repo/commit/abc",
    message: " Add support tracker ",
    pushedAt: "2026-07-31T12:00:00Z",
    repository: "example/repo",
    sha: "a".repeat(40),
  });

  assert.equal(deployment.additions, 200);
  assert.equal(deployment.author_email, "ashwin@example.com");
  assert.equal(deployment.files_changed, 2);
  assert.ok(deployment.estimate_hours >= 0.25);
  assert.ok(deployment.estimate_hours <= 8);
  assert.throws(
    () => normalizeDeploymentLog({ branch: "preview", sha: "a".repeat(40) }),
    /main-branch/,
  );
  assert.equal(
    estimateDeploymentHours({ additions: 100000, filesChanged: 500 }),
    8,
  );
});

test("change request logs are normalized and require stable identifiers", () => {
  const request = normalizeChangeRequestLog({
    completedAt: "2026-08-20T19:45:00Z",
    description: " Keep the signature details synchronized with quilt color. ",
    externalId: "imessage-273035",
    occurredAt: "2026-08-20T19:39:35Z",
    status: "completed",
    title: " Synchronize signature and quilt colors ",
  });
  assert.equal(request.external_id, "imessage-273035");
  assert.equal(request.status, "completed");
  assert.equal(request.estimate_hours, 0.75);
  assert.equal(request.title, "Synchronize signature and quilt colors");
  assert.throws(
    () => normalizeChangeRequestLog({ externalId: "bad id", status: "requested", title: "x" }),
    /ID is invalid/,
  );
});

test("change request estimates use a bounded fallback for historical records", () => {
  assert.equal(
    estimateChangeRequestHours({
      description: "Connect the checkout to Shopify and verify it on mobile",
      title: "Finish checkout integration",
    }),
    1.75,
  );
  assert.equal(estimateChangeRequestHours({ estimateHours: 100, title: "Small copy fix" }), 0.75);
});

test("unified request cards merge matching deployments without duplicate cards", () => {
  const cards = buildUnifiedRequestCards(
    [{
      external_id: "imessage-273035",
      id: "request_signature",
      occurred_at: 100,
      status: "completed",
      title: "Synchronize signature and quilt colors",
    }],
    [{
      actual_hours: null,
      allocation: "unreviewed",
      created_at: 200,
      estimate_hours: 1,
      id: "deploy_signature",
      occurred_at: 200,
      sha: "a".repeat(40),
      source: "deployment",
      title: "Sync signature detail with lining color",
    }],
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].request_id, "request_signature");
  assert.equal(cards[0].artifacts.length, 1);
});

test("request card reviews require owner-entered approval details", () => {
  const review = normalizeRequestCardReview({
    actualHours: 1.25,
    allocation: "bank",
    estimateHours: 1.5,
    reviewState: "approved",
    verifiedWork: "Verified on the live storefront.",
  });
  assert.equal(review.actual_hours, 1.25);
  assert.equal(review.review_state, "approved");
  assert.throws(
    () => normalizeRequestCardReview({ estimateHours: 1, reviewState: "approved" }),
    /allocation and actual hours/,
  );
});

test("support entries require reviewed hours and summarize both separate banks", () => {
  const reviewed = normalizeSupportEntryInput({
    actualHours: 1.26,
    allocation: "bank",
    description: " Checkout adjustment ",
    estimateHours: 1.1,
    occurredAt: "2026-07-31T12:00:00Z",
    title: " Checkout fix ",
  });
  assert.equal(reviewed.actual_hours, 1.25);
  assert.equal(reviewed.estimate_hours, 1);
  assert.throws(
    () =>
      normalizeSupportEntryInput({
        allocation: "grace",
        estimateHours: 1,
        title: "Missing applied time",
      }),
    /Applied hours/,
  );

  const summary = supportPlanSummary(
    [
      { actual_hours: 3, allocation: "bank" },
      { actual_hours: 2.5, allocation: "grace" },
      { actual_hours: null, allocation: "unreviewed" },
      { actual_hours: 6, allocation: "bank", voided_at: Date.now() },
    ],
    { launch_at: Date.parse("2026-08-01T00:00:00Z") },
  );
  assert.equal(summary.bank_remaining_hours, 21);
  assert.equal(summary.grace_remaining_hours, 17.5);
  assert.equal(summary.unreviewed_count, 1);
  assert.equal(
    summary.grace_ends_at,
    Date.parse("2026-08-31T00:00:00Z"),
  );
});
