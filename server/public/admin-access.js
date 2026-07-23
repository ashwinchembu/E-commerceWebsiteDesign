const unlockSection = document.querySelector("#admin-unlock");
const adminContent = document.querySelector("#admin-content");
const adminForm = document.querySelector("#admin-form");
const adminKeyInput = document.querySelector("#admin-key");
const adminStatus = document.querySelector("#admin-status");
const grantForm = document.querySelector("#grant-form");
const grantStatus = document.querySelector("#grant-status");
const grantsBody = document.querySelector("#grants-body");
const eventsBody = document.querySelector("#events-body");
const generatedCode = document.querySelector("#generated-code");
const generatedCodeValue = document.querySelector("#generated-code-value");
let adminKey = "";

const text = (value) => document.createTextNode(value == null || value === "" ? "—" : String(value));
const dateTime = (value) => value ? new Date(Number(value)).toLocaleString() : "—";

function expiresInputDefault() {
  const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
document.querySelector("#expires-at").value = expiresInputDefault();

async function adminFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Admin request failed.");
  return payload;
}

function clearRows(tbody) {
  while (tbody.firstChild) tbody.firstChild.remove();
}

function cell(row, value, className = "") {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.append(text(value));
  row.append(td);
  return td;
}

function statusPill(value) {
  const span = document.createElement("span");
  span.className = `pill ${value}`;
  span.append(text(value.replaceAll("_", " ")));
  return span;
}

function clientSummary(event) {
  let meta = {};
  try { meta = event.client_meta ? JSON.parse(event.client_meta) : {}; } catch { meta = {}; }
  const capabilities = [
    meta.language || (meta.languages || []).join(", "),
    meta.timezone,
    meta.screen,
    meta.platform,
    meta.logicalProcessors ? `${meta.logicalProcessors} logical processors` : "",
    meta.deviceMemoryGb ? `${meta.deviceMemoryGb} GB device memory` : "",
    Number.isFinite(meta.touchPoints) ? `${meta.touchPoints} touch points` : "",
  ].filter(Boolean).join(" · ");
  return [event.user_agent, capabilities].filter(Boolean).join(" | ") || "Not supplied";
}

function locationSummary(event) {
  const place = [event.city, event.region, event.postal_code, event.country].filter(Boolean).join(", ");
  const coordinates = event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : "";
  const network = event.asn ? `AS${event.asn}` : "";
  return [place, coordinates, network].filter(Boolean).join(" · ") || "Not supplied by host";
}

async function loadGrants() {
  const { grants } = await adminFetch("/api/admin/grants");
  clearRows(grantsBody);
  for (const grant of grants) {
    const row = document.createElement("tr");
    const person = document.createElement("td");
    const name = document.createElement("span");
    name.className = "person-name";
    name.append(text(grant.label));
    person.append(name);
    if (grant.email) {
      const email = document.createElement("span");
      email.className = "person-email";
      email.append(text(grant.email));
      person.append(email);
    }
    row.append(person);
    cell(row, grant.role);
    cell(row, `${grant.use_count}/${grant.max_uses} · ${grant.max_ips} networks`);
    cell(row, dateTime(grant.last_used_at));
    cell(row, dateTime(grant.expires_at));
    const state = grant.revoked_at ? "revoked" : grant.expires_at <= Date.now() ? "expired" : grant.use_count >= grant.max_uses ? "exhausted" : "active";
    const stateCell = document.createElement("td");
    stateCell.append(statusPill(state));
    row.append(stateCell);
    const actionCell = document.createElement("td");
    if (state === "active") {
      const revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "revoke";
      revoke.dataset.grantId = grant.id;
      revoke.textContent = "REVOKE";
      actionCell.append(revoke);
    }
    row.append(actionCell);
    grantsBody.append(row);
  }
}

async function loadEvents() {
  const { events } = await adminFetch("/api/admin/events?limit=200");
  clearRows(eventsBody);
  for (const event of events) {
    const row = document.createElement("tr");
    cell(row, dateTime(event.occurred_at));
    cell(row, event.label || event.email || "Unknown code");
    const resultCell = document.createElement("td");
    resultCell.append(statusPill(event.result));
    row.append(resultCell);
    const ipCell = document.createElement("td");
    const code = document.createElement("code");
    code.append(text(event.ip));
    ipCell.append(code);
    row.append(ipCell);
    cell(row, locationSummary(event));
    cell(row, clientSummary(event));
    cell(row, event.requested_path || "—");
    eventsBody.append(row);
  }
}

async function loadDashboard() {
  await Promise.all([loadGrants(), loadEvents()]);
}

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = adminKeyInput.value;
  adminStatus.textContent = "Verifying…";
  try {
    await loadDashboard();
    adminStatus.textContent = "";
    unlockSection.hidden = true;
    adminContent.hidden = false;
  } catch (error) {
    adminKey = "";
    adminStatus.textContent = error instanceof Error ? error.message : "Administrator verification failed.";
  }
});

grantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  grantStatus.textContent = "Generating a secure code…";
  generatedCode.hidden = true;
  const formData = new FormData(grantForm);
  const body = Object.fromEntries(formData.entries());
  try {
    const payload = await adminFetch("/api/admin/grants", { method: "POST", body: JSON.stringify(body) });
    generatedCodeValue.textContent = payload.code;
    generatedCode.hidden = false;
    grantStatus.textContent = "Code created. It will not be displayed again after this page changes.";
    grantForm.reset();
    document.querySelector("#expires-at").value = expiresInputDefault();
    grantForm.elements.maxUses.value = "25";
    grantForm.elements.maxIps.value = "3";
    await loadGrants();
  } catch (error) {
    grantStatus.textContent = error instanceof Error ? error.message : "Code generation failed.";
  }
});

document.querySelector("#copy-code").addEventListener("click", async () => {
  await navigator.clipboard.writeText(generatedCodeValue.textContent);
  grantStatus.textContent = "Code copied to the clipboard.";
});

grantsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-grant-id]");
  if (!button) return;
  if (!window.confirm("Revoke this personal access code immediately? Existing sessions will also stop working.")) return;
  try {
    await adminFetch(`/api/admin/grants/${button.dataset.grantId}/revoke`, { method: "POST" });
    await loadGrants();
  } catch (error) {
    grantStatus.textContent = error instanceof Error ? error.message : "Code could not be revoked.";
  }
});

document.querySelector("#refresh-grants").addEventListener("click", loadGrants);
document.querySelector("#refresh-events").addEventListener("click", loadEvents);
