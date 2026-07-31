import { appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function diffRows(before, after) {
  let output = "";
  try {
    output = before && !/^0+$/.test(before)
      ? git("diff", "--numstat", before, after, "--")
      : git("show", "--format=", "--numstat", after, "--");
  } catch {
    output = git("show", "--format=", "--numstat", after, "--");
  }
  if (!output) return [];
  return output.split("\n").flatMap((line) => {
    const [rawAdditions, rawDeletions, ...pathParts] = line.split("\t");
    const path = pathParts.join("\t").trim();
    if (!path) return [];
    return [{
      additions: /^\d+$/.test(rawAdditions) ? Number(rawAdditions) : 0,
      deletions: /^\d+$/.test(rawDeletions) ? Number(rawDeletions) : 0,
      path,
    }];
  });
}

const sha = required("GITHUB_SHA").toLowerCase();
const branch = required("GITHUB_REF_NAME");
const repository = required("GITHUB_REPOSITORY");
const serverUrl = String(process.env.GITHUB_SERVER_URL || "https://github.com").trim();
const before = String(process.env.PUSH_BEFORE || "").trim().toLowerCase();
const changedFiles = diffRows(before, sha);
const payload = {
  authorEmail: git("show", "-s", "--format=%ae", sha),
  authorName: git("show", "-s", "--format=%an", sha),
  branch,
  changedFiles,
  commitUrl: `${serverUrl}/${repository}/commit/${sha}`,
  message: git("show", "-s", "--format=%B", sha),
  pushedAt: git("show", "-s", "--format=%cI", sha),
  repository,
  sha,
};

const response = await fetch(required("DEPLOYMENT_TRACKER_ENDPOINT"), {
  body: JSON.stringify(payload),
  headers: {
    "content-type": "application/json",
    "x-deployment-tracker-secret": required("DEPLOYMENT_TRACKER_SECRET"),
  },
  method: "POST",
});
const responseText = await response.text();
let result;
try {
  result = JSON.parse(responseText);
} catch {
  result = { error: responseText || `HTTP ${response.status}` };
}
if (!response.ok) {
  throw new Error(result.error || `Tracker returned HTTP ${response.status}.`);
}

const additions = changedFiles.reduce((total, file) => total + file.additions, 0);
const deletions = changedFiles.reduce((total, file) => total + file.deletions, 0);
const summary = [
  "## Manoir Kits support tracker",
  "",
  `- Commit: \`${sha.slice(0, 10)}\``,
  `- Changes: ${changedFiles.length} files, +${additions} / −${deletions}`,
  `- Initial engineering estimate: **${result.estimateHours} hours**`,
  `- Status: ${result.duplicate ? "already logged" : "logged for administrator review"}`,
  "",
  "No support balance changes until an administrator reviews and allocates the entry.",
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
console.log(
  `Support tracker: ${result.estimateHours}h estimate for ${changedFiles.length} files (+${additions}/-${deletions}).`,
);
