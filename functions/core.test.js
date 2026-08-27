import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUnifiedRequestCards,
  createAccessCode,
  estimateChangeRequestHours,
  estimateDeploymentHours,
  evaluateGrantUse,
  grantState,
  historicalRequestWorkEntries,
  isAuthorizedAdminEmail,
  isRequestCardOwnerEmail,
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

test("request-card ownership is exact and case insensitive", () => {
  assert.equal(
    isRequestCardOwnerEmail(" ASHCHEMBU@GMAIL.COM ", "ashchembu@gmail.com"),
    true,
  );
  assert.equal(
    isRequestCardOwnerEmail("skpbains@gmail.com", "ashchembu@gmail.com"),
    false,
  );
  assert.equal(
    isRequestCardOwnerEmail("ashchembu@gmail.com.evil.test", "ashchembu@gmail.com"),
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
    estimateHours: 10,
    externalId: "imessage-273035",
    occurredAt: "2026-08-20T19:39:35Z",
    status: "completed",
    title: " Synchronize signature and quilt colors ",
  });
  assert.equal(request.external_id, "imessage-273035");
  assert.equal(request.status, "completed");
  assert.equal(request.estimate_hours, 0.75);
  assert.equal(request.replace_estimate, false);
  assert.equal("actual_hours" in request, false);
  assert.equal(request.title, "Synchronize signature and quilt colors");
  assert.throws(
    () => normalizeChangeRequestLog({ externalId: "bad id", status: "requested", title: "x" }),
    /ID is invalid/,
  );

  const ownerEstimated = normalizeChangeRequestLog({
    estimateHours: 4,
    externalId: "manual-production-scope",
    occurredAt: "2026-08-20T19:39:35Z",
    replaceEstimate: true,
    status: "requested",
    title: "Prepare production artwork",
  });
  assert.equal(ownerEstimated.estimate_hours, 4);
  assert.equal(ownerEstimated.replace_estimate, true);
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
  assert.equal(cards[0].projected_allocation, "bank");
  assert.equal(cards[0].artifacts.length, 1);
});

test("equivalent deployment records remain one request card with both audit links", () => {
  const shared = {
    additions: 167,
    allocation: "unreviewed",
    changed_files: [
      { additions: 40, deletions: 0, path: "functions/core.js" },
      { additions: 127, deletions: 1, path: "src/app/pages/AdminAccessPage.tsx" },
    ],
    deletions: 1,
    estimate_hours: 1.5,
    occurred_at: Date.parse("2026-08-20T23:53:06Z"),
    source: "deployment",
    title: "Track website requests in owner dashboard",
  };
  const cards = buildUnifiedRequestCards([], [
    { ...shared, id: "deploy_original", sha: "a".repeat(40) },
    { ...shared, id: "deploy_automation", sha: "b".repeat(40) },
    {
      ...shared,
      changed_files: [{ additions: 167, deletions: 1, path: "functions/index.js" }],
      id: "deploy_distinct",
      sha: "c".repeat(40),
    },
  ]);
  assert.equal(cards.length, 2);
  const duplicateCard = cards.find((card) => card.entry_id === "deploy_original");
  assert.deepEqual(
    duplicateCard.artifacts.map((artifact) => artifact.id),
    ["deploy_original", "deploy_automation"],
  );
});

test("one deployment can be related to every request it completed", () => {
  const requests = [
    { external_id: "legacy-cart-buttons", id: "cart", occurred_at: 1, title: "Fix cart buttons" },
    { external_id: "legacy-shopify-products", id: "products", occurred_at: 1, title: "Connect real Shopify products" },
    { external_id: "legacy-jacket-order-flow", id: "order", occurred_at: 1, title: "Test the complete jacket order flow" },
  ];
  const cards = buildUnifiedRequestCards(requests, [{
    id: "checkout-deploy",
    occurred_at: 2,
    source: "deployment",
    title: "Configure production Shopify checkout",
  }]);
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.deepEqual(card.artifacts.map((artifact) => artifact.id), ["checkout-deploy"]);
  }
});

test("new named artwork requests receive matching historical work", () => {
  const cards = buildUnifiedRequestCards(
    [{
      external_id: "imessage-new-artwork",
      id: "artwork",
      occurred_at: 2,
      title: "Fit sleeve numbers and provide manufacturer artwork",
    }],
    [{
      id: "surface-deploy",
      occurred_at: 3,
      source: "deployment",
      title: "Fit sleeve numbers to jacket surface",
    }],
  );
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].artifacts.map((artifact) => artifact.id), ["surface-deploy"]);
});

test("manufacturer packaging request links to its handoff deployment", () => {
  const cards = buildUnifiedRequestCards(
    [{
      description: "Prepare manufacturer packaging and accessory artwork handoff.",
      external_id: "imessage-274115-274121",
      id: "packaging",
      occurred_at: 1,
      title: "Prepare manufacturer packaging and accessory artwork handoff",
    }],
    [{
      id: "packaging-deploy",
      occurred_at: 2,
      source: "deployment",
      title: "Harden admin review and add manufacturer handoff",
    }],
  );
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].artifacts.map((artifact) => artifact.id), ["packaging-deploy"]);
});

test("superseded planning requests leave the active tracker without hiding verified deletions", () => {
  const cards = buildUnifiedRequestCards(
    [
      {
        external_id: "manufacturer-planning",
        id: "planning",
        occurred_at: 2,
        status: "superseded",
        title: "Plan future manufacturer artwork",
      },
      {
        external_id: "verified-deleted",
        id: "deleted",
        occurred_at: 1,
        status: "superseded",
        title: "Verified deleted website request",
        voided_at: 3,
      },
    ],
    [],
  );
  assert.deepEqual(cards.map((card) => card.request_id), ["deleted"]);
});

test("the word estimate does not match an EST 2026 request", () => {
  const cards = buildUnifiedRequestCards(
    [{
      external_id: "imessage-270176",
      id: "est-mark",
      occurred_at: 1,
      title: "Adjust EST 2026 sizing and alignment",
    }],
    [{
      description: "Review the estimate before applying hours.",
      id: "unrelated",
      occurred_at: 2,
      source: "deployment",
      title: "Add admin dashboard section sidebar",
    }],
  );
  assert.equal(cards.length, 2);
  assert.equal(cards.find((card) => card.request_id === "est-mark").artifacts.length, 0);
});

test("verified historical commits backfill legacy request cards", () => {
  const requests = [
    { external_id: "legacy-cart-buttons", id: "cart", occurred_at: 1, title: "Fix cart buttons" },
    { external_id: "legacy-contact-form", id: "contact", occurred_at: 1, title: "Connect contact form" },
    { external_id: "legacy-feedback-system", id: "feedback", occurred_at: 1, title: "Deploy feedback system" },
    { external_id: "legacy-footballer-login", id: "footballer", occurred_at: 1, title: "Finish footballer access" },
    { external_id: "legacy-jacket-order-flow", id: "order", occurred_at: 1, title: "Test complete order flow" },
    { external_id: "legacy-shopify-products", id: "products", occurred_at: 1, title: "Connect real Shopify products" },
    { external_id: "legacy-search-settings", id: "search", occurred_at: 1, title: "Update site title and search settings" },
    { external_id: "imessage-270006", id: "gold", occurred_at: 1, title: "Keep gold tones consistent" },
  ];
  const cards = buildUnifiedRequestCards(requests, historicalRequestWorkEntries());
  assert.equal(cards.length, requests.length);
  for (const card of cards) assert.ok(card.artifacts.length > 0, card.title);
});

test("request card reviews require owner-entered approval details", () => {
  const review = normalizeRequestCardReview({
    actualHours: 1.25,
    allocation: "bank",
    estimateHours: 1.5,
    projectedAllocation: "grace",
    reviewState: "approved",
    verifiedWork: "Verified on the live storefront.",
  });
  assert.equal(review.actual_hours, 1.25);
  assert.equal(review.review_state, "approved");
  assert.equal(review.projected_allocation, "grace");
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
      { actual_hours: null, allocation: "unreviewed", estimate_hours: 4.25 },
      { actual_hours: 6, allocation: "bank", voided_at: Date.now() },
    ],
    { launch_at: Date.parse("2026-08-01T00:00:00Z") },
  );
  assert.equal(summary.bank_remaining_hours, 21);
  assert.equal(summary.grace_remaining_hours, 17.5);
  assert.equal(summary.unreviewed_count, 1);
  assert.equal(summary.projected_unreviewed_hours, 4.25);
  assert.equal(
    summary.grace_ends_at,
    Date.parse("2026-08-31T00:00:00Z"),
  );
});
