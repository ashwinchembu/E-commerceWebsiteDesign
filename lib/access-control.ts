import { env } from "cloudflare:workers";

type AccessEnv = {
  DB: D1Database;
  ACCESS_ADMIN_SECRET?: string;
  ACCESS_SESSION_SECRET?: string;
  INITIAL_OWNER_ACCESS_CODE?: string;
  ACCESS_EVENT_RETENTION_DAYS?: string;
};

type GrantRow = {
  id: string;
  salt: string;
  secret_hash: string;
  label: string;
  email: string | null;
  role: string;
  notes: string | null;
  created_at: number;
  expires_at: number | null;
  max_uses: number;
  max_ips: number;
  use_count: number;
  last_used_at: number | null;
  revoked_at: number | null;
};

type RequestContext = {
  ip: string;
  city: string;
  region: string;
  country: string;
  latitude: string;
  longitude: string;
  postalCode: string;
  asn: string;
  userAgent: string;
  clientMeta: string;
  requestedPath: string;
};

const DAY = 24 * 60 * 60 * 1000;
const CODE_PATTERN =
  /^MK-([A-Z2-9]{8})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})$/;
const encoder = new TextEncoder();
let databaseReady: Promise<void> | null = null;

function runtimeEnv(): AccessEnv {
  return env as unknown as AccessEnv;
}

function now() {
  return Date.now();
}

function retentionDays() {
  const value = Number(runtimeEnv().ACCESS_EVENT_RETENTION_DAYS || 30);
  return Math.min(365, Math.max(1, Number.isFinite(value) ? value : 30));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomCharacters(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  while (output.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= 224) continue;
      output += alphabet[byte % alphabet.length];
      if (output.length === length) break;
    }
  }
  return output;
}

function normalizeCode(code: unknown) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function parseCode(code: unknown) {
  const match = normalizeCode(code).match(CODE_PATTERN);
  if (!match) return null;
  return { id: match[1], secret: match.slice(2).join("") };
}

async function hashSecret(secret: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64Url(salt),
      iterations: 100_000,
    },
    key,
    256,
  );
  return base64Url(new Uint8Array(bits));
}

function secureEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}

async function hmac(payload: string) {
  const secret = runtimeEnv().ACCESS_SESSION_SECRET;
  if (!secret) throw new Error("ACCESS_SESSION_SECRET is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(new Uint8Array(signature));
}

function cleanValue(value: unknown, maxLength = 180) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength)
    : "";
}

function header(request: Request, name: string, maxLength = 180) {
  return cleanValue(request.headers.get(name), maxLength);
}

function normalizeClientMeta(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const raw = value as Record<string, unknown>;
  const meta = {
    language: cleanValue(raw.language, 40),
    languages: Array.isArray(raw.languages)
      ? raw.languages
          .slice(0, 8)
          .map((item) => cleanValue(item, 40))
          .filter(Boolean)
      : [],
    timezone: cleanValue(raw.timezone, 80),
    screen: cleanValue(raw.screen, 60),
    platform: cleanValue(raw.platform, 100),
    logicalProcessors: Number.isFinite(Number(raw.logicalProcessors))
      ? Math.max(0, Math.min(256, Number(raw.logicalProcessors)))
      : null,
    deviceMemoryGb: Number.isFinite(Number(raw.deviceMemoryGb))
      ? Math.max(0, Math.min(1024, Number(raw.deviceMemoryGb)))
      : null,
    touchPoints: Number.isFinite(Number(raw.touchPoints))
      ? Math.max(0, Math.min(100, Number(raw.touchPoints)))
      : null,
    referrer: cleanValue(raw.referrer, 300),
  };
  return JSON.stringify(meta).slice(0, 1500);
}

function requestContext(request: Request): RequestContext {
  const cloudflare = (
    request as Request & { cf?: Record<string, unknown> }
  ).cf || {};
  return {
    ip:
      header(request, "cf-connecting-ip", 80) ||
      header(request, "x-real-ip", 80) ||
      header(request, "x-forwarded-for", 400).split(",")[0].trim() ||
      "unknown",
    city: cleanValue(cloudflare.city, 180) || header(request, "cf-ipcity"),
    region:
      cleanValue(cloudflare.region, 180) || header(request, "cf-region"),
    country:
      cleanValue(cloudflare.country, 16) ||
      header(request, "cf-ipcountry", 16),
    latitude: cleanValue(cloudflare.latitude, 32),
    longitude: cleanValue(cloudflare.longitude, 32),
    postalCode: cleanValue(cloudflare.postalCode, 32),
    asn: cleanValue(cloudflare.asn, 32),
    userAgent: header(request, "user-agent", 500),
    clientMeta: "",
    requestedPath: "",
  };
}

async function ensureDatabase() {
  if (databaseReady) return databaseReady;
  databaseReady = (async () => {
    const database = runtimeEnv().DB;
    if (!database) throw new Error("The access database is not configured.");
    await database.batch([
      database.prepare(`
        CREATE TABLE IF NOT EXISTS access_grants (
          id TEXT PRIMARY KEY,
          salt TEXT NOT NULL,
          secret_hash TEXT NOT NULL,
          label TEXT NOT NULL,
          email TEXT,
          role TEXT NOT NULL DEFAULT 'visitor',
          notes TEXT,
          created_at INTEGER NOT NULL,
          expires_at INTEGER,
          max_uses INTEGER NOT NULL DEFAULT 25,
          max_ips INTEGER NOT NULL DEFAULT 3,
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at INTEGER,
          revoked_at INTEGER
        )
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS access_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          grant_id TEXT,
          result TEXT NOT NULL,
          ip TEXT NOT NULL,
          city TEXT,
          region TEXT,
          country TEXT,
          latitude TEXT,
          longitude TEXT,
          postal_code TEXT,
          asn TEXT,
          user_agent TEXT,
          client_meta TEXT,
          requested_path TEXT,
          occurred_at INTEGER NOT NULL,
          FOREIGN KEY (grant_id) REFERENCES access_grants(id)
        )
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS access_events_ip_time
        ON access_events(ip, occurred_at)
      `),
      database.prepare(`
        CREATE INDEX IF NOT EXISTS access_events_grant_time
        ON access_events(grant_id, occurred_at)
      `),
    ]);

    const initialCode = runtimeEnv().INITIAL_OWNER_ACCESS_CODE;
    const parsed = initialCode ? parseCode(initialCode) : null;
    if (parsed) {
      const existing = await database
        .prepare("SELECT id FROM access_grants WHERE id = ?")
        .bind(parsed.id)
        .first();
      if (!existing) {
        const salt = base64Url(randomBytes(16));
        const secretHash = await hashSecret(parsed.secret, salt);
        await database
          .prepare(`
            INSERT OR IGNORE INTO access_grants (
              id, salt, secret_hash, label, email, role, notes, created_at,
              expires_at, max_uses, max_ips
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            parsed.id,
            salt,
            secretHash,
            "Manoir Kits Owner",
            "harnoor.bains@gmail.com",
            "admin",
            "Initial production owner code",
            now(),
            null,
            500,
            50,
          )
          .run();
      }
    }
  })().catch((error) => {
    databaseReady = null;
    throw error;
  });
  return databaseReady;
}

async function cleanOldEvents() {
  await runtimeEnv()
    .DB.prepare("DELETE FROM access_events WHERE occurred_at < ?")
    .bind(now() - retentionDays() * DAY)
    .run();
}

async function selectGrant(id: string) {
  return runtimeEnv()
    .DB.prepare("SELECT * FROM access_grants WHERE id = ?")
    .bind(id)
    .first<GrantRow>();
}

async function logEvent(
  grantId: string | null,
  result: string,
  context: RequestContext,
) {
  await runtimeEnv()
    .DB.prepare(`
      INSERT INTO access_events (
        grant_id, result, ip, city, region, country, latitude, longitude,
        postal_code, asn, user_agent, client_meta, requested_path, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      grantId,
      result,
      context.ip,
      context.city || null,
      context.region || null,
      context.country || null,
      context.latitude || null,
      context.longitude || null,
      context.postalCode || null,
      context.asn || null,
      context.userAgent || null,
      context.clientMeta || null,
      context.requestedPath || null,
      now(),
    )
    .run();
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    header(request, "cookie", 4000)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        return separator < 0
          ? [item, ""]
          : [item.slice(0, separator), item.slice(separator + 1)];
      }),
  );
}

async function createSessionCookie(grant: GrantRow) {
  const expiresAt = Math.min(
    grant.expires_at || now() + 7 * DAY,
    now() + 7 * DAY,
  );
  const payload = base64Url(
    encoder.encode(JSON.stringify({ grantId: grant.id, expiresAt })),
  );
  const value = `${payload}.${await hmac(payload)}`;
  const maxAge = Math.max(1, Math.floor((expiresAt - now()) / 1000));
  return `manoir_access=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return "manoir_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export async function sessionGrant(request: Request) {
  await ensureDatabase();
  const token = parseCookies(request).manoir_access;
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!secureEqual(await hmac(payload), signature)) return null;
  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as { grantId?: string; expiresAt?: number };
    if (!decoded.grantId || !decoded.expiresAt || decoded.expiresAt <= now()) {
      return null;
    }
    const grant = await selectGrant(decoded.grantId);
    if (
      !grant ||
      grant.revoked_at ||
      (grant.expires_at && grant.expires_at <= now())
    ) {
      return null;
    }
    return grant;
  } catch {
    return null;
  }
}

function publicGrant(grant: GrantRow) {
  return {
    id: grant.id,
    name: grant.label,
    email: grant.email || "",
    role: grant.role,
    expiresAt: grant.expires_at,
  };
}

export function jsonResponse(
  payload: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

async function readJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_768) throw new Error("Request body is too large.");
  const text = await request.text();
  if (text.length > 32_768) throw new Error("Request body is too large.");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

async function isAdminRequest(request: Request) {
  const configuredSecret = runtimeEnv().ACCESS_ADMIN_SECRET;
  if (!configuredSecret) throw new Error("ACCESS_ADMIN_SECRET is not configured.");
  const authorization = header(request, "authorization", 600);
  return (
    authorization.startsWith("Bearer ") &&
    secureEqual(authorization.slice(7), configuredSecret)
  );
}

export async function handleAccessApi(request: Request) {
  await ensureDatabase();
  await cleanOldEvents();
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === "POST" && pathname === "/api/access/redeem") {
    const context = requestContext(request);
    const recentFailures = await runtimeEnv()
      .DB.prepare(`
        SELECT COUNT(*) AS count FROM access_events
        WHERE ip = ? AND result IN ('denied', 'rate_limited', 'ip_limit')
          AND occurred_at >= ?
      `)
      .bind(context.ip, now() - 15 * 60 * 1000)
      .first<{ count: number }>();

    if (Number(recentFailures?.count || 0) >= 10) {
      await logEvent(null, "rate_limited", context);
      return jsonResponse(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await readJson(request);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }
    context.clientMeta = normalizeClientMeta(body.client);
    context.requestedPath = cleanValue(body.path, 300);
    const parsed = parseCode(body.code);
    if (!parsed) {
      await logEvent(null, "denied", context);
      return jsonResponse({ error: "That access code is not valid." }, 401);
    }

    const grant = await selectGrant(parsed.id);
    const validHash = grant
      ? secureEqual(await hashSecret(parsed.secret, grant.salt), grant.secret_hash)
      : false;
    const expired = Boolean(grant?.expires_at && grant.expires_at <= now());
    const exhausted = Boolean(
      grant && grant.max_uses > 0 && grant.use_count >= grant.max_uses,
    );
    if (!grant || !validHash || grant.revoked_at || expired || exhausted) {
      await logEvent(grant?.id || null, "denied", context);
      return jsonResponse(
        {
          error:
            "That access code is invalid, expired, revoked, or has reached its use limit.",
        },
        401,
      );
    }

    const [knownIp, uniqueIps] = await Promise.all([
      runtimeEnv()
        .DB.prepare(`
          SELECT 1 AS found FROM access_events
          WHERE grant_id = ? AND result = 'allowed' AND ip = ? LIMIT 1
        `)
        .bind(grant.id, context.ip)
        .first(),
      runtimeEnv()
        .DB.prepare(`
          SELECT COUNT(DISTINCT ip) AS count FROM access_events
          WHERE grant_id = ? AND result = 'allowed'
        `)
        .bind(grant.id)
        .first<{ count: number }>(),
    ]);

    if (
      !knownIp &&
      grant.max_ips > 0 &&
      Number(uniqueIps?.count || 0) >= grant.max_ips
    ) {
      await logEvent(grant.id, "ip_limit", context);
      return jsonResponse(
        {
          error:
            "This code has reached its network limit. Ask the administrator for a new code.",
        },
        403,
      );
    }

    const accessTime = now();
    await runtimeEnv()
      .DB.prepare(`
        UPDATE access_grants
        SET use_count = use_count + 1, last_used_at = ?
        WHERE id = ?
      `)
      .bind(accessTime, grant.id)
      .run();
    await logEvent(grant.id, "allowed", context);
    const updatedGrant = await selectGrant(grant.id);
    return jsonResponse(
      { ok: true, access: publicGrant(updatedGrant!) },
      200,
      { "Set-Cookie": await createSessionCookie(updatedGrant!) },
    );
  }

  if (request.method === "POST" && pathname === "/api/access/logout") {
    return jsonResponse(
      { ok: true },
      200,
      { "Set-Cookie": clearSessionCookie() },
    );
  }

  if (request.method === "GET" && pathname === "/api/access/session") {
    const grant = await sessionGrant(request);
    if (!grant) {
      return jsonResponse({ error: "Access session is required." }, 401);
    }
    return jsonResponse({ access: publicGrant(grant) });
  }

  if (pathname.startsWith("/api/admin/")) {
    if (!(await isAdminRequest(request))) {
      return jsonResponse({ error: "Administrator key is required." }, 401);
    }

    if (request.method === "GET" && pathname === "/api/admin/grants") {
      const result = await runtimeEnv()
        .DB.prepare(`
          SELECT id, label, email, role, notes, created_at, expires_at,
                 max_uses, max_ips, use_count, last_used_at, revoked_at
          FROM access_grants ORDER BY created_at DESC
        `)
        .all();
      return jsonResponse({ grants: result.results });
    }

    if (request.method === "POST" && pathname === "/api/admin/grants") {
      let body: Record<string, unknown>;
      try {
        body = await readJson(request);
      } catch {
        return jsonResponse({ error: "Request body must be valid JSON." }, 400);
      }
      const label = String(body.label || "").trim().slice(0, 120);
      const email = String(body.email || "")
        .trim()
        .toLowerCase()
        .slice(0, 180);
      const notes = String(body.notes || "").trim().slice(0, 500);
      const role = ["visitor", "admin"].includes(String(body.role))
        ? String(body.role)
        : "visitor";
      const maxUses = Math.min(
        500,
        Math.max(1, Number(body.maxUses || 25)),
      );
      const maxIps = Math.min(50, Math.max(1, Number(body.maxIps || 3)));
      const expiresAt = body.expiresAt
        ? Date.parse(String(body.expiresAt))
        : now() + 14 * DAY;
      if (!label) {
        return jsonResponse(
          { error: "Person or organization name is required." },
          400,
        );
      }
      if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
        return jsonResponse(
          { error: "Expiration must be in the future." },
          400,
        );
      }

      let id = "";
      do id = randomCharacters(8);
      while (await selectGrant(id));
      const secret = randomCharacters(16);
      const salt = base64Url(randomBytes(16));
      const secretHash = await hashSecret(secret, salt);
      await runtimeEnv()
        .DB.prepare(`
          INSERT INTO access_grants (
            id, salt, secret_hash, label, email, role, notes, created_at,
            expires_at, max_uses, max_ips
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          salt,
          secretHash,
          label,
          email || null,
          role,
          notes || null,
          now(),
          expiresAt,
          maxUses,
          maxIps,
        )
        .run();
      const code = `MK-${id}-${secret.match(/.{1,4}/g)!.join("-")}`;
      const grant = await selectGrant(id);
      return jsonResponse({ code, grant: publicGrant(grant!) }, 201);
    }

    if (request.method === "GET" && pathname === "/api/admin/events") {
      const requestedLimit = Number(url.searchParams.get("limit") || 200);
      const limit = Math.min(
        500,
        Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 200),
      );
      const result = await runtimeEnv()
        .DB.prepare(`
          SELECT e.id, e.grant_id, e.result, e.ip, e.city, e.region,
                 e.country, e.latitude, e.longitude, e.postal_code, e.asn,
                 e.user_agent, e.client_meta, e.requested_path,
                 e.occurred_at, g.label, g.email
          FROM access_events e
          LEFT JOIN access_grants g ON g.id = e.grant_id
          ORDER BY e.occurred_at DESC LIMIT ?
        `)
        .bind(limit)
        .all();
      return jsonResponse({
        events: result.results,
        retentionDays: retentionDays(),
      });
    }

    const revokeMatch = pathname.match(
      /^\/api\/admin\/grants\/([A-Z2-9]{8})\/revoke$/,
    );
    if (request.method === "POST" && revokeMatch) {
      const result = await runtimeEnv()
        .DB.prepare(`
          UPDATE access_grants SET revoked_at = ?
          WHERE id = ? AND revoked_at IS NULL
        `)
        .bind(now(), revokeMatch[1])
        .run();
      if (!result.meta.changes) {
        return jsonResponse(
          { error: "Access code was not found or is already revoked." },
          404,
        );
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Admin endpoint not found." }, 404);
  }

  return jsonResponse({ error: "API endpoint not found." }, 404);
}
