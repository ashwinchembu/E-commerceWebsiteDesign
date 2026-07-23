const form = document.querySelector("#access-form");
const input = document.querySelector("#access-code");
const status = document.querySelector("#access-status");

function safeNextPath() {
  const requested = new URLSearchParams(window.location.search).get("next") || "/";
  return requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
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
    status.textContent = "Access confirmed. Opening the private site…";
    window.location.assign(safeNextPath());
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Access could not be verified.";
    input.select();
    button.disabled = false;
  }
});
