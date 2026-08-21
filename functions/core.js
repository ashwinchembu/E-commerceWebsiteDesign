import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ACCESS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_PATTERN =
  /^MK-([A-Z2-9]{8})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})$/;
const FEEDBACK_CATEGORIES = new Set([
  "jacket-builder",
  "product",
  "shopping",
  "website",
  "other",
]);
const SUPPORT_ALLOCATIONS = new Set([
  "unreviewed",
  "grace",
  "bank",
  "non_billable",
]);
const CHANGE_REQUEST_STATUSES = new Set([
  "requested",
  "in_progress",
  "completed",
  "blocked",
  "superseded",
]);

export const SUPPORT_PLAN_DEFAULTS = Object.freeze({
  bank_total_hours: 24,
  bank_value_dollars: 3000,
  grace_days: 30,
  grace_total_hours: 20,
  hourly_rate: 125,
  launch_at: null,
});

export function cleanString(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength)
    : "";
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function quarterHour(value) {
  return Math.round(finiteNumber(value) * 4) / 4;
}

export function estimateDeploymentHours(value) {
  const input = value && typeof value === "object" ? value : {};
  const changedFiles = Array.isArray(input.changedFiles)
    ? input.changedFiles.slice(0, 100)
    : [];
  const fileCount = Math.max(
    changedFiles.length,
    Math.trunc(finiteNumber(input.filesChanged)),
  );
  const additions = Math.max(0, Math.trunc(finiteNumber(input.additions)));
  const deletions = Math.max(0, Math.trunc(finiteNumber(input.deletions)));
  const complexFiles = changedFiles.filter((file) => {
    const name = cleanString(file?.path ?? file, 400).toLowerCase();
    return (
      name.startsWith("functions/") ||
      name.includes("firebase") ||
      name.includes("shopify") ||
      name.includes("jacket") ||
      name.endsWith(".glb") ||
      name.endsWith(".gltf")
    );
  }).length;
  const raw =
    0.25 +
    Math.min(fileCount, 50) * 0.08 +
    Math.min(additions + deletions, 2500) * 0.002 +
    Math.min(complexFiles, 10) * 0.12;
  return Math.min(8, Math.max(0.25, Math.ceil(raw * 4) / 4));
}

export function estimateChangeRequestHours(value) {
  const input = value && typeof value === "object" ? value : {};
  const supplied = quarterHour(input.estimateHours);
  if (supplied >= 0.25 && supplied <= 24) return supplied;

  const text = `${cleanString(input.title, 180)} ${cleanString(input.description, 3000)}`
    .toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  const complexSignals = [
    "checkout",
    "shopify",
    "authentication",
    "login",
    "deploy",
    "mobile",
    "performance",
    "3d",
    "jacket builder",
    "integration",
    "contact form",
    "newsletter",
  ].filter((signal) => text.includes(signal)).length;
  const raw = 0.5 + Math.min(words, 120) * 0.01 + Math.min(complexSignals, 4) * 0.25;
  return Math.min(8, Math.max(0.25, Math.ceil(raw * 4) / 4));
}

export function normalizeDeploymentLog(value) {
  const input = value && typeof value === "object" ? value : {};
  const sha = cleanString(input.sha, 40).toLowerCase();
  const branch = cleanString(input.branch, 120);
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error("Deployment commit SHA is invalid.");
  }
  if (branch !== "main") {
    throw new Error("Only main-branch deployments can be logged.");
  }

  const changedFiles = (Array.isArray(input.changedFiles)
    ? input.changedFiles
    : [])
    .slice(0, 100)
    .map((file) => ({
      additions: Math.max(0, Math.trunc(finiteNumber(file?.additions))),
      deletions: Math.max(0, Math.trunc(finiteNumber(file?.deletions))),
      path: cleanString(file?.path, 400),
    }))
    .filter((file) => file.path);
  const additions = changedFiles.reduce((total, file) => total + file.additions, 0);
  const deletions = changedFiles.reduce((total, file) => total + file.deletions, 0);
  const pushedAt = Date.parse(String(input.pushedAt || ""));
  const normalized = {
    additions,
    author_email: cleanString(input.authorEmail, 180).toLowerCase() || null,
    author_name: cleanString(input.authorName, 160) || "Unknown author",
    branch,
    changed_files: changedFiles,
    commit_url: cleanString(input.commitUrl, 500) || null,
    deletions,
    files_changed: changedFiles.length,
    message: cleanString(input.message, 1000) || "Main branch update",
    pushed_at: Number.isFinite(pushedAt) ? pushedAt : Date.now(),
    repository: cleanString(input.repository, 220) || null,
    sha,
  };
  return {
    ...normalized,
    estimate_hours: estimateDeploymentHours({
      additions,
      changedFiles,
      deletions,
      filesChanged: changedFiles.length,
    }),
  };
}

export function normalizeChangeRequestLog(value) {
  const input = value && typeof value === "object" ? value : {};
  const externalId = cleanString(input.externalId, 180);
  const title = cleanString(input.title, 180);
  const description = cleanString(input.description, 3000) || null;
  const status = cleanString(input.status, 40).toLowerCase();
  const occurredAt = Date.parse(String(input.occurredAt || ""));
  const completedAt = input.completedAt
    ? Date.parse(String(input.completedAt))
    : null;
  if (!externalId || !/^[A-Za-z0-9._:-]+$/.test(externalId)) {
    throw new Error("Change request ID is invalid.");
  }
  if (!title) throw new Error("Change request title is required.");
  if (!CHANGE_REQUEST_STATUSES.has(status)) {
    throw new Error("Change request status is invalid.");
  }
  if (!Number.isFinite(occurredAt)) {
    throw new Error("Change request date is invalid.");
  }
  if (input.completedAt && !Number.isFinite(completedAt)) {
    throw new Error("Change request completion date is invalid.");
  }
  return {
    completed_at: Number.isFinite(completedAt) ? completedAt : null,
    description,
    external_id: externalId,
    estimate_hours: estimateChangeRequestHours(input),
    occurred_at: occurredAt,
    status,
    title,
  };
}

export function normalizeSupportEntryInput(value, { allowUnreviewed = true } = {}) {
  const input = value && typeof value === "object" ? value : {};
  const allocation = SUPPORT_ALLOCATIONS.has(input.allocation)
    ? input.allocation
    : "unreviewed";
  if (!allowUnreviewed && allocation === "unreviewed") {
    throw new Error("Choose where these hours should be applied.");
  }
  const title = cleanString(input.title, 180);
  if (!title) throw new Error("Work title is required.");

  const estimateHours = quarterHour(input.estimateHours);
  const actualHours =
    input.actualHours === "" || input.actualHours === null || input.actualHours === undefined
      ? null
      : quarterHour(input.actualHours);
  if (estimateHours < 0.25 || estimateHours > 24) {
    throw new Error("Estimated hours must be between 0.25 and 24.");
  }
  if (actualHours !== null && (actualHours < 0.25 || actualHours > 24)) {
    throw new Error("Applied hours must be between 0.25 and 24.");
  }
  if (allocation !== "unreviewed" && actualHours === null) {
    throw new Error("Applied hours are required for a reviewed entry.");
  }

  const occurredAt = Date.parse(String(input.occurredAt || ""));
  return {
    actual_hours: actualHours,
    allocation,
    description: cleanString(input.description, 3000) || null,
    estimate_hours: estimateHours,
    occurred_at: Number.isFinite(occurredAt) ? occurredAt : Date.now(),
    title,
  };
}

export function supportPlanSummary(entries, plan = {}) {
  const normalizedPlan = { ...SUPPORT_PLAN_DEFAULTS, ...(plan || {}) };
  const activeEntries = (Array.isArray(entries) ? entries : []).filter(
    (entry) => entry?.voided_at == null,
  );
  const used = (allocation) =>
    quarterHour(
      activeEntries
        .filter((entry) => entry.allocation === allocation)
        .reduce((total, entry) => total + finiteNumber(entry.actual_hours), 0),
    );
  const bankUsed = used("bank");
  const graceUsed = used("grace");
  const launchAt = finiteNumber(normalizedPlan.launch_at, 0) || null;
  const graceEndsAt = launchAt
    ? launchAt + normalizedPlan.grace_days * 24 * 60 * 60 * 1000
    : null;
  return {
    bank_remaining_hours: quarterHour(normalizedPlan.bank_total_hours - bankUsed),
    bank_used_hours: bankUsed,
    grace_ends_at: graceEndsAt,
    grace_remaining_hours: quarterHour(
      normalizedPlan.grace_total_hours - graceUsed,
    ),
    grace_used_hours: graceUsed,
    unreviewed_count: activeEntries.filter(
      (entry) => entry.allocation === "unreviewed",
    ).length,
  };
}

export function isAuthorizedAdminEmail(value, emailVerified, allowlist) {
  if (emailVerified !== true) return false;
  const email = cleanString(value, 320).toLowerCase();
  return (
    email.length > 0 &&
    allowlist.some(
      (candidate) => cleanString(candidate, 320).toLowerCase() === email,
    )
  );
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeAccessCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function parseAccessCode(value) {
  const match = normalizeAccessCode(value).match(ACCESS_CODE_PATTERN);
  return match ? { id: match[1], secret: match.slice(2).join("") } : null;
}

export function randomCharacters(length) {
  let output = "";
  while (output.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= 224) continue;
      output += ACCESS_ALPHABET[byte % ACCESS_ALPHABET.length];
      if (output.length === length) break;
    }
  }
  return output;
}

export function hashAccessSecret(secret, salt) {
  return scryptSync(secret, salt, 32).toString("base64url");
}

export function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createAccessCode() {
  const id = randomCharacters(8);
  const secret = randomCharacters(16);
  const salt = randomBytes(16).toString("base64url");
  const secretHash = hashAccessSecret(secret, salt);
  return {
    code: `MK-${id}-${secret.match(/.{1,4}/g).join("-")}`,
    id,
    salt,
    secretHash,
  };
}

export function normalizeGrantInput(value, currentTime = Date.now()) {
  const input =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const label = cleanString(input.label, 120);
  const email = cleanString(input.email, 180).toLowerCase();
  const notes = cleanString(input.notes, 500);
  const role = ["visitor", "footballer", "admin"].includes(input.role)
    ? input.role
    : "visitor";
  const maxUses = Math.min(
    500,
    Math.max(1, Math.trunc(Number(input.maxUses || 25))),
  );
  const maxIps = Math.min(
    50,
    Math.max(1, Math.trunc(Number(input.maxIps || 3))),
  );
  const expiresAt = input.expiresAt
    ? Date.parse(String(input.expiresAt))
    : currentTime + 14 * 24 * 60 * 60 * 1000;

  if (!label) throw new Error("Person or organization name is required.");
  if (email && !validEmail(email)) {
    throw new Error("Email address is not valid.");
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= currentTime) {
    throw new Error("Expiration must be in the future.");
  }
  if (!Number.isFinite(maxUses) || !Number.isFinite(maxIps)) {
    throw new Error("Usage and network limits must be numbers.");
  }

  return {
    email: email || null,
    expiresAt,
    label,
    maxIps,
    maxUses,
    notes: notes || null,
    role,
  };
}

export function publicGrant(grant) {
  return {
    id: grant.id,
    name: grant.label,
    email: grant.email || "",
    role: grant.role,
    expiresAt: grant.expires_at,
  };
}

export function grantState(grant, currentTime = Date.now()) {
  if (!grant) return "invalid";
  if (grant.revoked_at) return "revoked";
  if (grant.expires_at && grant.expires_at <= currentTime) return "expired";
  if (grant.max_uses > 0 && grant.use_count >= grant.max_uses) {
    return "exhausted";
  }
  return "active";
}

export function evaluateGrantUse(grant, secret, ip, currentTime = Date.now()) {
  if (
    grantState(grant, currentTime) !== "active" ||
    !secureEqual(hashAccessSecret(secret, grant.salt), grant.secret_hash)
  ) {
    return { status: "invalid" };
  }

  const allowedIps = Array.isArray(grant.allowed_ips)
    ? [...new Set(grant.allowed_ips.map(String))]
    : [];
  const knownIp = allowedIps.includes(ip);
  if (!knownIp && grant.max_ips > 0 && allowedIps.length >= grant.max_ips) {
    return { status: "ip_limit" };
  }
  if (!knownIp) allowedIps.push(ip);

  return {
    status: "ok",
    update: {
      allowed_ips: allowedIps,
      last_used_at: currentTime,
      use_count: Number(grant.use_count || 0) + 1,
    },
  };
}

export function normalizeClientMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const numberOrNull = (candidate, maximum) => {
    const number = Number(candidate);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(maximum, number))
      : null;
  };
  const meta = {
    language: cleanString(value.language, 40),
    languages: Array.isArray(value.languages)
      ? value.languages
          .slice(0, 8)
          .map((item) => cleanString(item, 40))
          .filter(Boolean)
      : [],
    timezone: cleanString(value.timezone, 80),
    screen: cleanString(value.screen, 60),
    platform: cleanString(value.platform, 100),
    logicalProcessors: numberOrNull(value.logicalProcessors, 256),
    deviceMemoryGb: numberOrNull(value.deviceMemoryGb, 1024),
    touchPoints: numberOrNull(value.touchPoints, 100),
    referrer: cleanString(value.referrer, 300),
  };
  return JSON.stringify(meta).slice(0, 1500);
}

export function normalizeFeedbackInput(value) {
  const input =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rating = Number(input.rating);
  const category = cleanString(input.category, 40).toLowerCase();
  const message = cleanString(input.message, 2000);
  const name = cleanString(input.name, 120);
  const email = cleanString(input.email, 180).toLowerCase();
  const requestedPath = cleanString(input.path, 300);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Choose a rating from 1 to 5.");
  }
  if (!FEEDBACK_CATEGORIES.has(category)) {
    throw new Error("Choose a valid feedback category.");
  }
  if (message.length < 3) {
    throw new Error("Feedback must be at least 3 characters.");
  }
  if (!name) throw new Error("Full name is required.");
  if (!validEmail(email)) {
    throw new Error("Email address is not valid.");
  }

  return {
    category,
    email,
    message,
    name,
    path:
      requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/",
    rating,
  };
}

export function normalizeContactInput(value) {
  const input =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const email = cleanString(input.email, 180).toLowerCase();
  const message = cleanString(input.message, 1800);
  const name = cleanString(input.name, 120);
  const requestedPath = cleanString(input.path, 300);
  const subject = cleanString(input.subject, 160);

  if (!name) throw new Error("Name is required.");
  if (!validEmail(email)) throw new Error("Email address is not valid.");
  if (!subject) throw new Error("Subject is required.");
  if (message.length < 3) {
    throw new Error("Message must be at least 3 characters.");
  }

  return {
    email,
    message,
    name,
    path:
      requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/contact",
    subject,
  };
}

export function normalizeNewsletterInput(value) {
  const input =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const email = cleanString(input.email, 180).toLowerCase();
  if (!validEmail(email)) throw new Error("Email address is not valid.");
  return { email };
}

export function normalizeFeedbackRecord(value) {
  const metaobject =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fields = new Map(
    (Array.isArray(metaobject.fields) ? metaobject.fields : [])
      .map((field) => [
        cleanString(field?.key, 80),
        typeof field?.value === "string" ? field.value : "",
      ])
      .filter(([key]) => key),
  );
  const rawRating = fields.get("rating");
  const parsedRating = Number(rawRating);
  const rating = rawRating && Number.isFinite(parsedRating)
    ? Math.min(5, Math.max(1, Math.trunc(parsedRating)))
    : null;
  const submittedAt =
    cleanString(fields.get("submitted_at"), 80) ||
    cleanString(metaobject.createdAt, 80);

  return {
    category: cleanString(fields.get("category"), 40) || "other",
    email: cleanString(fields.get("email"), 180).toLowerCase() || null,
    id: cleanString(metaobject.id, 220),
    message: cleanString(fields.get("message"), 2000),
    name: cleanString(fields.get("name"), 120) || null,
    page: cleanString(fields.get("page"), 300) || "/",
    rating,
    status: cleanString(fields.get("status"), 40).toLowerCase() || "new",
    submitted_at: Number.isFinite(Date.parse(submittedAt))
      ? new Date(submittedAt).toISOString()
      : null,
  };
}

export function normalizeShopifyCustomer(customer, syncMetadata = {}) {
  const legacyId =
    customer.legacyResourceId ||
    customer.id ||
    customer.admin_graphql_api_id ||
    "";
  const id = String(legacyId).split("/").pop();
  if (!id) throw new Error("Shopify customer payload is missing an ID.");

  const tags = Array.isArray(customer.tags)
    ? customer.tags
    : String(customer.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
  const firstName = cleanString(customer.firstName ?? customer.first_name, 120);
  const lastName = cleanString(customer.lastName ?? customer.last_name, 120);
  const displayName =
    cleanString(customer.displayName, 240) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "Shopify customer";

  const normalized = {
    display_name: displayName,
    email: cleanString(customer.email, 180).toLowerCase() || null,
    first_name: firstName || null,
    last_name: lastName || null,
    mirrored_at: syncMetadata.mirroredAt || Date.now(),
    shopify_gid:
      cleanString(customer.id ?? customer.admin_graphql_api_id, 220) || null,
    shopify_id: id,
    source: syncMetadata.source || "shopify",
    tags: [...new Set(tags.map((tag) => cleanString(tag, 120)).filter(Boolean))],
    updated_at:
      Date.parse(customer.updatedAt ?? customer.updated_at ?? "") || null,
  };
  if (syncMetadata.runId) normalized.last_full_sync_id = syncMetadata.runId;
  return normalized;
}
