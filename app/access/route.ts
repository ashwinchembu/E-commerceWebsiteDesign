import accessHtml from "../../server/public/access.html?raw";
import { sessionGrant } from "../../lib/access-control";

export const dynamic = "force-dynamic";

const pageHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

export async function GET(request: Request) {
  const session = await sessionGrant(request);
  if (session) {
    const url = new URL(request.url);
    const requested = url.searchParams.get("next") || "/";
    const safeNext =
      requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
    return Response.redirect(new URL(safeNext, request.url), 302);
  }
  return new Response(accessHtml, { headers: pageHeaders });
}
