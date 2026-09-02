import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewerUrl = new URL("../src/app/components/VarsityJacketViewer.tsx", import.meta.url);
const builderUrl = new URL("../src/app/pages/JacketBuilderPage.tsx", import.meta.url);
const jacketCrestUrl = new URL("../src/assets/manoir-kits-jacket-crest.png", import.meta.url);

test("both jacket editions and the one-of-one patch use the sharper jacket crest asset", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  const builder = await readFile(builderUrl, "utf8");
  const jacketCrest = await readFile(jacketCrestUrl);

  assert.match(viewer, /manoir-kits-jacket-crest\.png/);
  assert.match(builder, /manoir-kits-jacket-crest\.png/);
  assert.equal(viewer.match(/const crest = await loadCrest\(\)/g)?.length, 2);
  assert.ok(jacketCrest.length > 0);
});
