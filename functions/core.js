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

export function cleanString(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength)
    : "";
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
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email address is not valid.");
  }

  return {
    category,
    email: email || null,
    message,
    name: name || null,
    path:
      requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/",
    rating,
  };
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
  const parsedRating = Number(fields.get("rating"));
  const rating = Number.isFinite(parsedRating)
    ? Math.min(5, Math.max(1, Math.trunc(parsedRating)))
    : 1;
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
