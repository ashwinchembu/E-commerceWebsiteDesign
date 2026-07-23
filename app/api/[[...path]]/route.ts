import { handleAccessApi, jsonResponse } from "../../../lib/access-control";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    return await handleAccessApi(request);
  } catch (error) {
    console.error("Access API error", error);
    return jsonResponse({ error: "Unexpected server error." }, 500);
  }
}

export const GET = handle;
export const POST = handle;
