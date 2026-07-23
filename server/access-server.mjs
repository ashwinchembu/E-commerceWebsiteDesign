import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, "..");
const publicDirectory = path.join(serverDirectory, "public");
const distDirectory = path.resolve(process.env.WEB_DIST_DIR || path.join(projectDirectory, "dist"));
const dataDirectory = path.resolve(process.env.ACCESS_DATA_DIR || path.join(projectDirectory, "data"));
const databasePath = path.join(dataDirectory, "access.sqlite");
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 8787);
const trustProxy = process.env.TRUST_PROXY === "1";
const eventRetentionDays = Math.max(1, Number(process.env.ACCESS_EVENT_RETENTION_DAYS || 30));
const adminSecret = process.env.ACCESS_ADMIN_SECRET || "";
const sessionSecret = process.env.ACCESS_SESSION_SECRET || "";

if (!adminSecret || !sessionSecret) {
  throw new Error("ACCESS_ADMIN_SECRET and ACCESS_SESSION_SECRET are required.");
}

mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

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
  );

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
  );

  CREATE INDEX IF NOT EXISTS access_events_ip_time
    ON access_events(ip, occurred_at);
  CREATE INDEX IF NOT EXISTS access_events_grant_time
    ON access_events(grant_id, occurred_at);
`);

const eventColumns = new Set(database.prepare("PRAGMA table_info(access_events)").all().map((column) => column.name));
for (const [column, definition] of [
  ["latitude", "TEXT"],
  ["longitude", "TEXT"],
  ["postal_code", "TEXT"],
  ["asn", "TEXT"],
  ["client_meta", "TEXT"],
  ["requested_path", "TEXT"],
]) {
  if (!eventColumns.has(column)) database.exec(`ALTER TABLE access_events ADD COLUMN ${column} ${definition}`);
}

const now = () => Date.now();
const deleteOldEvents = database.prepare("DELETE FROM access_events WHERE occurred_at < ?");
const cleanOldEvents = () => deleteOldEvents.run(now() - eventRetentionDays * 24 * 60 * 60 * 1000);
cleanOldEvents();
setInterval(cleanOldEvents, 60 * 60 * 1000).unref();

const selectGrant = database.prepare("SELECT * FROM access_grants WHERE id = ?");
const insertGrant = database.prepare(`
  INSERT INTO access_grants (
    id, salt, secret_hash, label, email, role, notes, created_at, expires_at, max_uses, max_ips
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertEvent = database.prepare(`
  INSERT INTO access_events (
    grant_id, result, ip, city, region, country, latitude, longitude, postal_code, asn,
    user_agent, client_meta, requested_path, occurred_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(body);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
}

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
}

function serveFile(response, filePath, contentType, cacheControl = "no-store") {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }
  const size = statSync(filePath).size;
  response.writeHead(200, {
    ...securityHeaders(contentType),
    "Content-Length": size,
    "Cache-Control": cacheControl,
  });
  createReadStream(filePath).pipe(response);
}

function readBody(request, limit = 32_768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function firstHeader(request, name) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function cleanHeader(value, maxLength = 180) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength) : "";
}

function clientContext(request) {
  const forwarded = trustProxy ? cleanHeader(firstHeader(request, "x-forwarded-for"), 400).split(",")[0].trim() : "";
  const proxyIp = trustProxy
    ? cleanHeader(firstHeader(request, "cf-connecting-ip") || firstHeader(request, "x-real-ip") || firstHeader(request, "x-nf-client-connection-ip"), 80)
    : "";
  const ip = proxyIp || forwarded || cleanHeader(request.socket.remoteAddress, 80) || "unknown";
  return {
    ip,
    city: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-city") || firstHeader(request, "cf-ipcity")) : "",
    region: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-country-region") || firstHeader(request, "cf-region")) : "",
    country: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-country") || firstHeader(request, "cf-ipcountry"), 16) : "",
    latitude: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-latitude"), 32) : "",
    longitude: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-longitude"), 32) : "",
    postalCode: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-postal-code"), 32) : "",
    asn: trustProxy ? cleanHeader(firstHeader(request, "x-vercel-ip-as-number"), 32) : "",
    userAgent: cleanHeader(firstHeader(request, "user-agent"), 500),
    clientMeta: "",
    requestedPath: "",
  };
}

function normalizeClientMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const meta = {
    language: cleanHeader(value.language, 40),
    languages: Array.isArray(value.languages) ? value.languages.slice(0, 8).map((item) => cleanHeader(item, 40)).filter(Boolean) : [],
    timezone: cleanHeader(value.timezone, 80),
    screen: cleanHeader(value.screen, 60),
    platform: cleanHeader(value.platform, 100),
    logicalProcessors: Number.isFinite(Number(value.logicalProcessors)) ? Math.max(0, Math.min(256, Number(value.logicalProcessors))) : null,
    deviceMemoryGb: Number.isFinite(Number(value.deviceMemoryGb)) ? Math.max(0, Math.min(1024, Number(value.deviceMemoryGb))) : null,
    touchPoints: Number.isFinite(Number(value.touchPoints)) ? Math.max(0, Math.min(100, Number(value.touchPoints))) : null,
    referrer: cleanHeader(value.referrer, 300),
  };
  return JSON.stringify(meta).slice(0, 1500);
}

function logEvent(grantId, result, context) {
  insertEvent.run(
    grantId || null,
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
  );
}

function randomCharacters(length) {
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

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function parseCode(code) {
  const match = normalizeCode(code).match(/^MK-([A-Z2-9]{8})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})$/);
  if (!match) return null;
  return { id: match[1], secret: match.slice(2).join("") };
}

function hashSecret(secret, salt) {
  return scryptSync(secret, salt, 32).toString("base64url");
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSignature(payload) {
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function createSessionCookie(grant) {
  const grantExpiry = grant.expires_at || now() + 7 * 24 * 60 * 60 * 1000;
  const expiresAt = Math.min(grantExpiry, now() + 7 * 24 * 60 * 60 * 1000);
  const payload = Buffer.from(JSON.stringify({ grantId: grant.id, expiresAt })).toString("base64url");
  const value = `${payload}.${sessionSignature(payload)}`;
  const maxAge = Math.max(1, Math.floor((expiresAt - now()) / 1000));
  return `manoir_access=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? "; Secure" : ""}`;
}

function clearSessionCookie() {
  return `manoir_access=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? "; Secure" : ""}`;
}

function parseCookies(request) {
  return Object.fromEntries(
    String(firstHeader(request, "cookie") || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        return separator < 0 ? [item, ""] : [item.slice(0, separator), item.slice(separator + 1)];
      }),
  );
}

function sessionGrant(request) {
  const token = parseCookies(request).manoir_access;
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!secureEqual(sessionSignature(payload), signature)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.grantId || decoded.expiresAt <= now()) return null;
    const grant = selectGrant.get(decoded.grantId);
    if (!grant || grant.revoked_at || (grant.expires_at && grant.expires_at <= now())) return null;
    return grant;
  } catch {
    return null;
  }
}

function publicGrant(grant) {
  return {
    id: grant.id,
    name: grant.label,
    email: grant.email || "",
    role: grant.role,
    expiresAt: grant.expires_at,
  };
}

function isAdminRequest(request) {
  const authorization = cleanHeader(firstHeader(request, "authorization"), 600);
  return authorization.startsWith("Bearer ") && secureEqual(authorization.slice(7), adminSecret);
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".glb": "model/gltf-binary",
  }[extension] || "application/octet-stream";
}

function safeStaticPath(directory, pathname) {
  const decoded = decodeURIComponent(pathname);
  const resolved = path.resolve(directory, `.${decoded}`);
  return resolved.startsWith(`${directory}${path.sep}`) ? resolved : null;
}

async function handleRedeem(request, response) {
  const context = clientContext(request);
  const recentFailures = database.prepare(`
    SELECT COUNT(*) AS count FROM access_events
    WHERE ip = ? AND result IN ('denied', 'rate_limited', 'ip_limit') AND occurred_at >= ?
  `).get(context.ip, now() - 15 * 60 * 1000).count;

  if (recentFailures >= 10) {
    logEvent(null, "rate_limited", context);
    sendJson(response, 429, { error: "Too many attempts. Try again in 15 minutes." });
    return;
  }

  const body = await readBody(request);
  context.clientMeta = normalizeClientMeta(body.client);
  context.requestedPath = cleanHeader(body.path, 300);
  const parsed = parseCode(body.code);
  if (!parsed) {
    logEvent(null, "denied", context);
    sendJson(response, 401, { error: "That access code is not valid." });
    return;
  }

  const grant = selectGrant.get(parsed.id);
  const validHash = grant ? secureEqual(hashSecret(parsed.secret, grant.salt), grant.secret_hash) : false;
  const expired = grant?.expires_at && grant.expires_at <= now();
  const exhausted = grant && grant.max_uses > 0 && grant.use_count >= grant.max_uses;

  if (!grant || !validHash || grant.revoked_at || expired || exhausted) {
    logEvent(grant?.id || null, "denied", context);
    sendJson(response, 401, { error: "That access code is invalid, expired, revoked, or has reached its use limit." });
    return;
  }

  const knownIp = database.prepare(`
    SELECT 1 FROM access_events WHERE grant_id = ? AND result = 'allowed' AND ip = ? LIMIT 1
  `).get(grant.id, context.ip);
  const uniqueIps = database.prepare(`
    SELECT COUNT(DISTINCT ip) AS count FROM access_events WHERE grant_id = ? AND result = 'allowed'
  `).get(grant.id).count;

  if (!knownIp && grant.max_ips > 0 && uniqueIps >= grant.max_ips) {
    logEvent(grant.id, "ip_limit", context);
    sendJson(response, 403, { error: "This code has reached its network limit. Ask the administrator for a new code." });
    return;
  }

  const accessTime = now();
  database.prepare(`
    UPDATE access_grants SET use_count = use_count + 1, last_used_at = ? WHERE id = ?
  `).run(accessTime, grant.id);
  logEvent(grant.id, "allowed", context);
  const updatedGrant = selectGrant.get(grant.id);
  sendJson(response, 200, { ok: true, access: publicGrant(updatedGrant) }, { "Set-Cookie": createSessionCookie(updatedGrant) });
}

async function handleCreateGrant(request, response) {
  const body = await readBody(request);
  const label = String(body.label || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const notes = String(body.notes || "").trim().slice(0, 500);
  const role = ["visitor", "admin"].includes(body.role) ? body.role : "visitor";
  const maxUses = Math.min(500, Math.max(1, Number(body.maxUses || 25)));
  const maxIps = Math.min(50, Math.max(1, Number(body.maxIps || 3)));
  const expiresAt = body.expiresAt ? Date.parse(body.expiresAt) : now() + 14 * 24 * 60 * 60 * 1000;

  if (!label) {
    sendJson(response, 400, { error: "Person or organization name is required." });
    return;
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
    sendJson(response, 400, { error: "Expiration must be in the future." });
    return;
  }

  let id;
  do id = randomCharacters(8); while (selectGrant.get(id));
  const secret = randomCharacters(16);
  const salt = randomBytes(16).toString("base64url");
  const secretHash = hashSecret(secret, salt);
  const createdAt = now();
  insertGrant.run(id, salt, secretHash, label, email || null, role, notes || null, createdAt, expiresAt, maxUses, maxIps);
  const groupedSecret = secret.match(/.{1,4}/g).join("-");
  const code = `MK-${id}-${groupedSecret}`;
  sendJson(response, 201, { code, grant: publicGrant(selectGrant.get(id)) });
}

function handleListGrants(response) {
  const grants = database.prepare(`
    SELECT id, label, email, role, notes, created_at, expires_at, max_uses, max_ips,
           use_count, last_used_at, revoked_at
    FROM access_grants ORDER BY created_at DESC
  `).all();
  sendJson(response, 200, { grants });
}

function handleListEvents(response, url) {
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));
  const events = database.prepare(`
    SELECT e.id, e.grant_id, e.result, e.ip, e.city, e.region, e.country,
           e.latitude, e.longitude, e.postal_code, e.asn, e.user_agent,
           e.client_meta, e.requested_path, e.occurred_at, g.label, g.email
    FROM access_events e
    LEFT JOIN access_grants g ON g.id = e.grant_id
    ORDER BY e.occurred_at DESC LIMIT ?
  `).all(limit);
  sendJson(response, 200, { events, retentionDays: eventRetentionDays });
}

function handleRevokeGrant(response, grantId) {
  const result = database.prepare(`
    UPDATE access_grants SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL
  `).run(now(), grantId);
  if (!result.changes) {
    sendJson(response, 404, { error: "Access code was not found or is already revoked." });
    return;
  }
  sendJson(response, 200, { ok: true });
}

function serveWebsite(request, response, url, grant) {
  if (!existsSync(distDirectory)) {
    sendJson(response, 503, { error: "Website build is missing. Run npm run build first." });
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = safeStaticPath(distDirectory, requestedPath);
  if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
    const immutable = requestedPath.startsWith("/assets/") ? "private, max-age=31536000, immutable" : "private, no-store";
    serveFile(response, filePath, mimeType(filePath), immutable);
    return;
  }

  const indexPath = path.join(distDirectory, "index.html");
  if (!existsSync(indexPath)) {
    sendJson(response, 503, { error: "Website build is missing. Run npm run build first." });
    return;
  }
  const html = readFileSync(indexPath);
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": html.length,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  });
  response.end(html);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && pathname === "/access") {
      if (sessionGrant(request)) {
        redirect(response, url.searchParams.get("next") || "/");
        return;
      }
      serveFile(response, path.join(publicDirectory, "access.html"), "text/html; charset=utf-8");
      return;
    }
    if (request.method === "GET" && pathname === "/admin/access") {
      serveFile(response, path.join(publicDirectory, "admin-access.html"), "text/html; charset=utf-8");
      return;
    }
    if (request.method === "GET" && pathname === "/access.css") {
      serveFile(response, path.join(publicDirectory, "access.css"), "text/css; charset=utf-8");
      return;
    }
    if (request.method === "GET" && pathname === "/access.js") {
      serveFile(response, path.join(publicDirectory, "access.js"), "text/javascript; charset=utf-8");
      return;
    }
    if (request.method === "GET" && pathname === "/admin-access.js") {
      serveFile(response, path.join(publicDirectory, "admin-access.js"), "text/javascript; charset=utf-8");
      return;
    }
    if (request.method === "POST" && pathname === "/api/access/redeem") {
      await handleRedeem(request, response);
      return;
    }
    if (request.method === "POST" && pathname === "/api/access/logout") {
      sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
      return;
    }
    if (request.method === "GET" && pathname === "/api/access/session") {
      const grant = sessionGrant(request);
      if (!grant) {
        sendJson(response, 401, { error: "Access session is required." });
        return;
      }
      sendJson(response, 200, { access: publicGrant(grant) });
      return;
    }

    if (pathname.startsWith("/api/admin/")) {
      if (!isAdminRequest(request)) {
        sendJson(response, 401, { error: "Administrator key is required." });
        return;
      }
      if (request.method === "GET" && pathname === "/api/admin/grants") {
        handleListGrants(response);
        return;
      }
      if (request.method === "POST" && pathname === "/api/admin/grants") {
        await handleCreateGrant(request, response);
        return;
      }
      if (request.method === "GET" && pathname === "/api/admin/events") {
        handleListEvents(response, url);
        return;
      }
      const revokeMatch = pathname.match(/^\/api\/admin\/grants\/([A-Z2-9]{8})\/revoke$/);
      if (request.method === "POST" && revokeMatch) {
        handleRevokeGrant(response, revokeMatch[1]);
        return;
      }
      sendJson(response, 404, { error: "Admin endpoint not found." });
      return;
    }

    const grant = sessionGrant(request);
    if (!grant) {
      const next = pathname === "/" ? "/" : `${pathname}${url.search}`;
      redirect(response, `/access?next=${encodeURIComponent(next)}`);
      return;
    }
    serveWebsite(request, response, url, grant);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendJson(response, 500, { error: isProduction ? "Unexpected server error." : message });
  }
});

server.listen(port, () => {
  console.log(`Manoir Kits secure access server listening on http://127.0.0.1:${port}`);
});
