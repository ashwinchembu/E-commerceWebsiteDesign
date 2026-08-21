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

function diffRows(sha) {
  const output = git("show", "--format=", "--numstat", sha, "--");
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

const since = required("SUPPORT_BACKFILL_SINCE").toLowerCase();
if (!/^[0-9a-f]{7,40}$/.test(since)) throw new Error("Backfill cutoff SHA is invalid.");
const endpoint = required("DEPLOYMENT_TRACKER_ENDPOINT");
const secret = required("DEPLOYMENT_TRACKER_SECRET");
const repository = required("GITHUB_REPOSITORY");
const serverUrl = String(process.env.GITHUB_SERVER_URL || "https://github.com").trim();
const commits = git("rev-list", "--reverse", "--no-merges", `${since}..HEAD`).split("\n").filter(Boolean);
let created = 0;
let duplicates = 0;

for (const sha of commits) {
  const changedFiles = diffRows(sha);
  const payload = {
    authorEmail: git("show", "-s", "--format=%ae", sha),
    authorName: git("show", "-s", "--format=%an", sha),
    branch: "main",
    changedFiles,
    commitUrl: `${serverUrl}/${repository}/commit/${sha}`,
    message: git("show", "-s", "--format=%B", sha),
    pushedAt: git("show", "-s", "--format=%cI", sha),
    repository,
    sha,
  };
  const response = await fetch(endpoint, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      "x-deployment-tracker-secret": secret,
    },
    method: "POST",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `${sha}: HTTP ${response.status}`);
  if (result.duplicate) duplicates += 1;
  else created += 1;
}

const summary = `Backfill complete: ${created} missing deployments added, ${duplicates} existing deployments skipped, ${commits.length} commits checked.`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
console.log(summary);
