import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(serverDirectory, "..");
const distDirectory = path.resolve(process.env.WEB_DIST_DIR || path.join(projectDirectory, "dist"));
const port = Number(process.env.PORT || 8787);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function securityHeaders(contentType, cacheControl) {
  return {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    ...securityHeaders("application/json; charset=utf-8", "no-store"),
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(body);
}

function safeStaticPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  const resolved = path.resolve(distDirectory, relative);
  return resolved === distDirectory || resolved.startsWith(`${distDirectory}${path.sep}`) ? resolved : null;
}

function serveFile(request, response, filePath, cacheControl) {
  const size = statSync(filePath).size;
  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, {
    ...securityHeaders(contentType, cacheControl),
    "Content-Length": size,
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      sendJson(
        response,
        200,
        { ok: true },
        {
          "Access-Control-Allow-Origin": "https://ecommerce-website-design.onrender.com",
          "Access-Control-Allow-Methods": "GET, HEAD",
          Vary: "Origin",
        },
      );
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET, HEAD" });
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = safeStaticPath(requestedPath);
    if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
      const cacheControl = requestedPath.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate";
      serveFile(request, response, filePath, cacheControl);
      return;
    }

    const indexPath = path.join(distDirectory, "index.html");
    if (!existsSync(indexPath)) {
      sendJson(response, 503, { error: "Website build is missing. Run npm run build first." });
      return;
    }
    serveFile(request, response, indexPath, "public, max-age=0, must-revalidate");
  } catch {
    sendJson(response, 500, { error: "Unexpected server error." });
  }
});

server.listen(port, () => {
  console.log(`Manoir Kits storefront server listening on http://127.0.0.1:${port}.`);
});
