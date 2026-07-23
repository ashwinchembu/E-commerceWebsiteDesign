import adminScript from "../../server/public/admin-access.js?raw";

export function GET() {
  return new Response(adminScript, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
