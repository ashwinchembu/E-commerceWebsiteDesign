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
  SUPPORT_PLAN_DEFAULTS,
  buildUnifiedRequestCards,
  cleanString,
  createAccessCode,
  evaluateGrantUse,
  grantState,
  isAuthorizedAdminEmail,
  normalizeClientMeta,
  normalizeChangeRequestLog,
  normalizeContactInput,
  normalizeDeploymentLog,
  normalizeFeedbackInput,
  normalizeFeedbackRecord,
  normalizeGrantInput,
  normalizeNewsletterInput,
  normalizeRequestCardReview,
  normalizeShopifyCustomer,
  normalizeSupportEntryInput,
  parseAccessCode,
  publicGrant,
  secureEqual,
  supportPlanSummary,
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
const deploymentTrackerSecret = defineSecret("DEPLOYMENT_TRACKER_SECRET");
const changeRequestTrackerSecret = defineSecret("CHANGE_REQUEST_TRACKER_SECRET");
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
const supportEntries = db.collection("supportEntries");
const supportAuditEvents = db.collection("supportAuditEvents");
const changeRequests = db.collection("changeRequests");
const supportPlanReference = system.doc("supportPlan");
const FEEDBACK_METAOBJECT_TYPE = "$app:customer_feedback";
const FEEDBACK_RATE_WINDOW_MS = 5 * 60 * 1000;
const FEEDBACK_ALLOWED_ORIGINS = [
  "https://ecommerce-website-design.onrender.com",
  "https://manoirkits.com",
  "https://www.manoirkits.com",
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const ADMIN_EMAIL_ALLOWLIST = [
  "ashchembu@gmail.com",
  "manoirkits@gmail.com",
  "skpbains@gmail.com",
];
const REQUEST_CARD_OWNER_EMAIL = "ashchembu@gmail.com";

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

export const claimAdminAccess = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Administrator sign-in is required.");
  }

  const user = await auth.getUser(request.auth.uid);
  const email = request.auth.token.email || user.email;
  const emailVerified =
    request.auth.token.email_verified === true && user.emailVerified === true;
  if (
    !isAuthorizedAdminEmail(
      email,
      emailVerified,
      ADMIN_EMAIL_ALLOWLIST,
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "This account does not have administrator access.",
    );
  }

  if (user.customClaims?.admin !== true) {
    await auth.setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      admin: true,
    });
    logger.info("Granted an allowlisted account administrator access.", {
      uid: user.uid,
    });
  }

  return { authorized: true };
});

function invalidArgument(error) {
  if (error instanceof HttpsError) return error;
  return new HttpsError(
    "invalid-argument",
    error instanceof Error ? error.message : "The request is not valid.",
  );
}

function supportActor(request) {
  return {
    email: cleanString(request.auth?.token?.email, 180).toLowerCase() || null,
    uid: request.auth?.uid || null,
  };
}

function supportEntryForAdmin(document) {
  return { id: document.id, ...document.data() };
}

function supportAuditRecord(action, actor, details, occurredAt = Date.now()) {
  return {
    action,
    actor_email: actor.email || null,
    actor_uid: actor.uid || null,
    details,
    occurred_at: occurredAt,
  };
}

function validSupportDocumentId(value) {
  const id = cleanString(value, 120);
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(id)) {
    throw new HttpsError("invalid-argument", "Support log ID is invalid.");
  }
  return id;
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

export const getSupportTracker = onCall(async (request) => {
  assertAdmin(request);
  const [planSnapshot, entrySnapshot, auditSnapshot, requestSnapshot] = await Promise.all([
    supportPlanReference.get(),
    supportEntries.orderBy("created_at", "desc").limit(500).get(),
    supportAuditEvents.orderBy("occurred_at", "desc").limit(100).get(),
    changeRequests.orderBy("occurred_at", "desc").limit(500).get(),
  ]);
  const plan = {
    ...SUPPORT_PLAN_DEFAULTS,
    ...(planSnapshot.exists ? planSnapshot.data() : {}),
  };
  const entries = entrySnapshot.docs.map(supportEntryForAdmin);
  const requests = requestSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
  const cards = buildUnifiedRequestCards(requests, entries);
  return {
    audit: auditSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    cards,
    entries,
    plan,
    requests,
    summary: supportPlanSummary(
      cards.map((card) => ({
        actual_hours: card.actual_hours,
        allocation: card.allocation,
        estimate_hours: card.estimate_hours,
        voided_at: card.voided_at,
      })),
      plan,
    ),
  };
});

export const logChangeRequest = onRequest(
  {
    maxInstances: 2,
    secrets: [changeRequestTrackerSecret],
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({ error: "Method not allowed" });
      return;
    }
    const suppliedSecret = cleanString(request.get("x-change-request-tracker-secret"), 200);
    if (!secureEqual(suppliedSecret, changeRequestTrackerSecret.value())) {
      response.status(401).json({ error: "Invalid tracker secret" });
      return;
    }
    let changeRequest;
    try {
      changeRequest = normalizeChangeRequestLog(request.body);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Change request is invalid.",
      });
      return;
    }
    const digest = createHash("sha256").update(changeRequest.external_id).digest("hex").slice(0, 24);
    const reference = changeRequests.doc(`request_${digest}`);
    const now = Date.now();
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const existing = snapshot.exists ? snapshot.data() : null;
      const record = {
        ...(existing || {}),
        ...changeRequest,
        created_at: existing?.created_at || now,
        estimate_hours: existing?.estimate_hours || changeRequest.estimate_hours,
        source: "message_daemon",
        updated_at: now,
      };
      transaction.set(reference, record, { merge: true });
      transaction.set(
        supportAuditEvents.doc(),
        supportAuditRecord(
          existing ? "change_request_updated" : "change_request_logged",
          { email: null, uid: null },
          { entry_id: reference.id, status: record.status, title: record.title },
          now,
        ),
      );
      return { created: !existing };
    });
    response.status(result.created ? 201 : 200).json({
      ...result,
      id: reference.id,
      logged: true,
    });
  },
);

export const updateRequestCard = onCall(async (request) => {
  assertAdmin(request);
  const actor = supportActor(request);
  const isCardOwner = actor.email === REQUEST_CARD_OWNER_EMAIL;
  if (!isCardOwner) {
    const reviewState = cleanString(request.data?.reviewState, 40).toLowerCase();
    if (reviewState !== "approved" && reviewState !== "rejected") {
      throw new HttpsError("permission-denied", "Administrators may only approve or deny request cards.");
    }
    const requestId = request.data?.requestId
      ? validSupportDocumentId(request.data.requestId)
      : null;
    const entryId = request.data?.entryId
      ? validSupportDocumentId(request.data.entryId)
      : null;
    if (!requestId && !entryId) {
      throw new HttpsError("invalid-argument", "A request card ID is required.");
    }
    const now = Date.now();
    const reference = requestId ? changeRequests.doc(requestId) : supportEntries.doc(entryId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "The request card was not found.");
      }
      if (snapshot.data().voided_at) {
        throw new HttpsError("failed-precondition", "Voided request cards cannot be reviewed.");
      }
      transaction.update(reference, {
        review_state: reviewState,
        updated_at: now,
        updated_by_email: actor.email,
        updated_by_uid: actor.uid,
      });
      transaction.set(
        supportAuditEvents.doc(),
        supportAuditRecord("request_card_decided", actor, {
          entry_id: entryId,
          request_id: requestId,
          review_state: reviewState,
        }, now),
      );
    });
    return { ok: true };
  }
  let review;
  try {
    review = normalizeRequestCardReview(request.data);
  } catch (error) {
    throw invalidArgument(error);
  }
  const requestId = request.data?.requestId
    ? validSupportDocumentId(request.data.requestId)
    : null;
  const entryId = request.data?.entryId
    ? validSupportDocumentId(request.data.entryId)
    : null;
  if (!requestId && !entryId) {
    throw new HttpsError("invalid-argument", "A request card ID is required.");
  }
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    if (requestId) {
      const requestReference = changeRequests.doc(requestId);
      const requestSnapshot = await transaction.get(requestReference);
      if (!requestSnapshot.exists) {
        throw new HttpsError("not-found", "The request card was not found.");
      }
      const current = requestSnapshot.data();
      if (current.voided_at) {
        throw new HttpsError("failed-precondition", "Voided request cards cannot be edited.");
      }
      const canonicalEntry = supportEntries.doc(`request_${requestId}`);
      const canonicalSnapshot = await transaction.get(canonicalEntry);
      const entryRecord = {
        actual_hours: review.actual_hours,
        allocation: review.allocation,
        created_at: canonicalSnapshot.data()?.created_at || now,
        created_by_email: canonicalSnapshot.data()?.created_by_email || actor.email,
        created_by_uid: canonicalSnapshot.data()?.created_by_uid || actor.uid,
        description: review.verified_work,
        estimate_hours: review.estimate_hours,
        occurred_at: current.occurred_at || current.created_at || now,
        request_external_id: current.external_id,
        request_id: requestId,
        source: "manual",
        title: current.title,
        updated_at: now,
        updated_by_email: actor.email,
        updated_by_uid: actor.uid,
        voided_at: null,
      };
      transaction.set(requestReference, {
        ...review,
        updated_at: now,
        updated_by_email: actor.email,
        updated_by_uid: actor.uid,
      }, { merge: true });
      transaction.set(canonicalEntry, entryRecord, { merge: true });
      transaction.set(
        supportAuditEvents.doc(),
        supportAuditRecord("request_card_reviewed", actor, {
          actual_hours: review.actual_hours,
          allocation: review.allocation,
          estimate_hours: review.estimate_hours,
          request_id: requestId,
          review_state: review.review_state,
        }, now),
      );
      return;
    }

    const entryReference = supportEntries.doc(entryId);
    const entrySnapshot = await transaction.get(entryReference);
    if (!entrySnapshot.exists) {
      throw new HttpsError("not-found", "The work card was not found.");
    }
    if (entrySnapshot.data().voided_at) {
      throw new HttpsError("failed-precondition", "Voided work cards cannot be edited.");
    }
    transaction.update(entryReference, {
      actual_hours: review.actual_hours,
      allocation: review.allocation,
      description: review.verified_work,
      estimate_hours: review.estimate_hours,
      review_state: review.review_state,
      updated_at: now,
      updated_by_email: actor.email,
      updated_by_uid: actor.uid,
    });
    transaction.set(
      supportAuditEvents.doc(),
      supportAuditRecord("request_card_reviewed", actor, {
        entry_id: entryId,
        review_state: review.review_state,
      }, now),
    );
  });
  return { ok: true };
});

export const voidRequestCard = onCall(async (request) => {
  assertAdmin(request);
  const actor = supportActor(request);
  if (actor.email !== REQUEST_CARD_OWNER_EMAIL) {
    throw new HttpsError("permission-denied", "Only the request-card owner may void cards.");
  }
  const requestId = request.data?.requestId
    ? validSupportDocumentId(request.data.requestId)
    : null;
  const entryId = request.data?.entryId
    ? validSupportDocumentId(request.data.entryId)
    : null;
  const reason = cleanString(request.data?.reason, 500);
  if ((!requestId && !entryId) || !reason) {
    throw new HttpsError("invalid-argument", "A card and void reason are required.");
  }
  const now = Date.now();
  const batch = db.batch();
  if (requestId) {
    batch.set(changeRequests.doc(requestId), {
      updated_at: now,
      updated_by_email: actor.email,
      updated_by_uid: actor.uid,
      void_reason: reason,
      voided_at: now,
    }, { merge: true });
  } else {
    batch.set(supportEntries.doc(entryId), {
      updated_at: now,
      updated_by_email: actor.email,
      updated_by_uid: actor.uid,
      void_reason: reason,
      voided_at: now,
    }, { merge: true });
  }
  batch.set(
    supportAuditEvents.doc(),
    supportAuditRecord("request_card_voided", actor, {
      entry_id: entryId,
      reason,
      request_id: requestId,
    }, now),
  );
  await batch.commit();
  return { ok: true };
});

export const setSupportLaunchDate = onCall(async (request) => {
  assertAdmin(request);
  const rawLaunchAt = request.data?.launchAt;
  const launchAt = rawLaunchAt ? Date.parse(String(rawLaunchAt)) : null;
  if (rawLaunchAt && !Number.isFinite(launchAt)) {
    throw new HttpsError("invalid-argument", "Official launch date is invalid.");
  }
  if (
    launchAt &&
    (launchAt < Date.parse("2020-01-01T00:00:00Z") ||
      launchAt > Date.parse("2040-01-01T00:00:00Z"))
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Official launch date is outside the supported range.",
    );
  }

  const now = Date.now();
  const actor = supportActor(request);
  const batch = db.batch();
  batch.set(
    supportPlanReference,
    {
      ...SUPPORT_PLAN_DEFAULTS,
      launch_at: launchAt,
      updated_at: now,
      updated_by_email: actor.email,
      updated_by_uid: actor.uid,
    },
    { merge: true },
  );
  batch.set(
    supportAuditEvents.doc(),
    supportAuditRecord("launch_date_updated", actor, { launch_at: launchAt }, now),
  );
  await batch.commit();
  return { launchAt };
});

export const createSupportEntry = onCall(async (request) => {
  assertAdmin(request);
  let normalized;
  try {
    normalized = normalizeSupportEntryInput(request.data);
  } catch (error) {
    throw invalidArgument(error);
  }

  const now = Date.now();
  const actor = supportActor(request);
  const reference = supportEntries.doc();
  const record = {
    ...normalized,
    created_at: now,
    created_by_email: actor.email,
    created_by_uid: actor.uid,
    source: "manual",
    updated_at: now,
    updated_by_email: actor.email,
    updated_by_uid: actor.uid,
    voided_at: null,
  };
  const batch = db.batch();
  batch.set(reference, record);
  batch.set(
    supportAuditEvents.doc(),
    supportAuditRecord(
      "entry_created",
      actor,
      {
        actual_hours: record.actual_hours,
        allocation: record.allocation,
        entry_id: reference.id,
        estimate_hours: record.estimate_hours,
        title: record.title,
      },
      now,
    ),
  );
  await batch.commit();
  return { id: reference.id };
});

export const updateSupportEntry = onCall(async (request) => {
  assertAdmin(request);
  const id = validSupportDocumentId(request.data?.id);
  const reference = supportEntries.doc(id);
  const actor = supportActor(request);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Support log entry was not found.");
    }
    const current = snapshot.data();
    if (current.voided_at) {
      throw new HttpsError("failed-precondition", "Voided entries cannot be edited.");
    }
    let normalized;
    try {
      normalized = normalizeSupportEntryInput({
        actualHours: request.data?.actualHours,
        allocation: request.data?.allocation,
        description: request.data?.description,
        estimateHours: current.estimate_hours,
        occurredAt: new Date(current.occurred_at || current.created_at).toISOString(),
        title: current.title,
      });
    } catch (error) {
      throw invalidArgument(error);
    }
    const now = Date.now();
    const changes = {
      actual_hours: normalized.actual_hours,
      allocation: normalized.allocation,
      description: normalized.description,
      updated_at: now,
      updated_by_email: actor.email,
      updated_by_uid: actor.uid,
    };
    transaction.update(reference, changes);
    transaction.set(
      supportAuditEvents.doc(),
      supportAuditRecord(
        "entry_reviewed",
        actor,
        {
          after: changes,
          before: {
            actual_hours: current.actual_hours ?? null,
            allocation: current.allocation,
            description: current.description ?? null,
          },
          entry_id: id,
          title: current.title,
        },
        now,
      ),
    );
  });
  return { ok: true };
});

export const voidSupportEntry = onCall(async (request) => {
  assertAdmin(request);
  const id = validSupportDocumentId(request.data?.id);
  const reason = cleanString(request.data?.reason, 500);
  if (!reason) {
    throw new HttpsError("invalid-argument", "A reason is required to void an entry.");
  }
  const reference = supportEntries.doc(id);
  const actor = supportActor(request);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Support log entry was not found.");
    }
    if (snapshot.data().voided_at) return;
    const now = Date.now();
    transaction.update(reference, {
      updated_at: now,
      updated_by_email: actor.email,
      updated_by_uid: actor.uid,
      void_reason: reason,
      voided_at: now,
    });
    transaction.set(
      supportAuditEvents.doc(),
      supportAuditRecord(
        "entry_voided",
        actor,
        { entry_id: id, reason, title: snapshot.data().title },
        now,
      ),
    );
  });
  return { ok: true };
});

export const logDeployment = onRequest(
  {
    maxInstances: 2,
    secrets: [deploymentTrackerSecret],
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({ error: "Method not allowed" });
      return;
    }
    const suppliedSecret = cleanString(
      request.get("x-deployment-tracker-secret"),
      200,
    );
    if (!secureEqual(suppliedSecret, deploymentTrackerSecret.value())) {
      response.status(401).json({ error: "Invalid tracker secret" });
      return;
    }

    let deployment;
    try {
      deployment = normalizeDeploymentLog(request.body);
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : "Deployment log is invalid.",
      });
      return;
    }

    const reference = supportEntries.doc(`deploy_${deployment.sha}`);
    const now = Date.now();
    const record = {
      ...deployment,
      actual_hours: null,
      allocation: "unreviewed",
      created_at: now,
      created_by_email: deployment.author_email,
      created_by_uid: null,
      description:
        "Automatically logged from a push to main. Review the estimate before applying hours.",
      occurred_at: deployment.pushed_at,
      source: "deployment",
      title: deployment.message.split("\n")[0],
      updated_at: now,
      updated_by_email: deployment.author_email,
      updated_by_uid: null,
      voided_at: null,
    };

    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        return { duplicate: true, estimateHours: snapshot.data().estimate_hours };
      }
      transaction.create(reference, record);
      transaction.set(
        supportAuditEvents.doc(),
        supportAuditRecord(
          "deployment_logged",
          { email: deployment.author_email, uid: null },
          {
            additions: deployment.additions,
            commit_url: deployment.commit_url,
            deletions: deployment.deletions,
            entry_id: reference.id,
            estimate_hours: deployment.estimate_hours,
            files_changed: deployment.files_changed,
            sha: deployment.sha,
          },
          now,
        ),
      );
      return { duplicate: false, estimateHours: deployment.estimate_hours };
    });
    response.status(result.duplicate ? 200 : 201).json({
      ...result,
      entryId: reference.id,
      logged: true,
    });
  },
);

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
  billing: {
    filename: "firebase-billing-setup-guide.pdf",
    path: "firebase-billing-setup-guide.pdf",
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
