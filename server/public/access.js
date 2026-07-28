const form = document.querySelector("#access-form");
const input = document.querySelector("#access-code");
const status = document.querySelector("#access-status");
const jacketAssets = [
  "/models/varsitybase/VarsityBase.glb",
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
];

async function warmJacketAssets() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  const results = await Promise.allSettled(
    jacketAssets.map(async (asset) => {
      const response = await fetch(asset, {
        credentials: "same-origin",
        cache: "force-cache",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Could not prepare ${asset}`);
      await response.arrayBuffer();
    }),
  );
  window.clearTimeout(timeout);
  return results.every((result) => result.status === "fulfilled");
}

function safeNextPath() {
  const requested = new URLSearchParams(window.location.search).get("next") || "/";
  if (!requested.startsWith("/") || requested.startsWith("//") || requested.includes("\\")) return "/";
  try {
    const target = new URL(requested, window.location.origin);
    return target.origin === window.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : "/";
  } catch {
    return "/";
  }
}

function disclosedClientContext() {
  const screenDetails = window.screen
    ? `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio || 1}x`
    : "";
  return {
    language: navigator.language || "",
    languages: Array.from(navigator.languages || []).slice(0, 8),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: screenDetails,
    platform: navigator.userAgentData?.platform || navigator.platform || "",
    logicalProcessors: navigator.hardwareConcurrency || null,
    deviceMemoryGb: navigator.deviceMemory || null,
    touchPoints: navigator.maxTouchPoints || 0,
    referrer: document.referrer || "",
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  status.textContent = "Verifying your personal code…";
  try {
    const response = await fetch("/api/access/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: input.value, path: safeNextPath(), client: disclosedClientContext() }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Access could not be verified.");
    status.textContent = "Access confirmed. Preparing your jacket preview…";
    const jacketPrepared = await warmJacketAssets();
    status.textContent = jacketPrepared
      ? "Jacket ready. Opening the private site…"
      : "Opening the private site…";
    window.location.assign(safeNextPath());
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Access could not be verified.";
    input.select();
    button.disabled = false;
  }
});
