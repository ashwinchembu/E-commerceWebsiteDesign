import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../src/app/config/approvedJacketLayout.json", import.meta.url);
const viewerUrl = new URL("../src/app/components/VarsityJacketViewer.tsx", import.meta.url);
const builderUrl = new URL("../src/app/pages/JacketBuilderPage.tsx", import.meta.url);

const approvedLayout = {
  version: "approved-2026-08-29",
  frontAndSleeveArtworkScale: 0.8,
  backArtworkScale: 0.8,
  estMarkBaseHeight: 96,
  estMarkReductionSteps: [0.8, 0.8],
  backProjectionWidth: 0.64,
  backProjectionYOffset: 0.04,
  starArc: 560,
  starCenterOffset: 52,
  starStepDegrees: 11,
  starRadius: 33,
  cityY: 200,
  backNumberY: 452,
  estMarkY: 650,
  fallbackEstMarkY: 652,
  frontCrestWidth: 0.336,
  frontWordmarkWidth: 0.62,
};

test("approved jacket artwork layout remains unchanged", async () => {
  const actual = JSON.parse(await readFile(layoutUrl, "utf8"));
  assert.deepEqual(actual, approvedLayout);
});

test("the viewer reads every locked layout value", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  for (const key of Object.keys(approvedLayout).filter((key) => key !== "version")) {
    assert.match(viewer, new RegExp(`approvedJacketLayout\\.${key}\\b`), `${key} must remain wired to the viewer`);
  }
});

test("the jacket builder keeps the approved edition prices", async () => {
  const builder = await readFile(builderUrl, "utf8");
  assert.match(builder, /const price = isFootballersEdition \? 1995 : 1495;/);
});

test("the Footballers edition is available without an account gate", async () => {
  const builder = await readFile(builderUrl, "utf8");
  assert.doesNotMatch(builder, /canUseFootballersEdition|Request Footballers Access|Shopify account required/);
});
