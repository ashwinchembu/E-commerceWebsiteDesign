import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createDefaultStudioValues,
  MAX_STUDIO_DRAFTS,
  parseStudioDrafts,
  sanitizeStudioBackName,
  upsertStudioDraft,
} from "../src/app/lib/jacketStudioState.ts";
import { assemblePdfFromJpegs } from "../src/app/lib/jacketPdfExport.ts";

const viewerUrl = new URL("../src/app/components/VarsityJacketViewer.tsx", import.meta.url);
const builderUrl = new URL("../src/app/pages/JacketBuilderPage.tsx", import.meta.url);
const appUrl = new URL("../src/app/App.tsx", import.meta.url);
const adminAccessUrl = new URL("../src/app/pages/AdminAccessPage.tsx", import.meta.url);
const studioAccessUrl = new URL(
  "../src/app/pages/StudioAccessPage.tsx",
  import.meta.url,
);

function draft(id, updatedAt, values = createDefaultStudioValues()) {
  return { id, name: `Design ${id}`, updatedAt, values };
}

test("private studio names remain printable and fit the back label limit", () => {
  assert.equal(sanitizeStudioBackName("  Messi   10 ⚽"), " Messi 10 ");
  assert.equal(sanitizeStudioBackName("A".repeat(30)).length, 24);
});

test("saved studio designs are validated and constrained to the ten-design workspace", () => {
  assert.equal(createDefaultStudioValues().leftSleeveNumbers.length, 10);
  assert.equal(createDefaultStudioValues().rightSleeveNumbers.length, 10);
  const raw = JSON.stringify(
    Array.from({ length: 12 }, (_, index) => ({
      ...draft(String(index), new Date(2026, 0, index + 1).toISOString()),
      values: {
        ...createDefaultStudioValues(),
        backStars: index === 11 ? 99 : 5,
        backNumber: "1x0",
        leftSleeveNumbers: ["7x", "123", "", "", "", "55", "6", "7", "8", "9", "10"],
      },
    })),
  );
  const parsed = parseStudioDrafts(raw);
  assert.equal(parsed.length, MAX_STUDIO_DRAFTS);
  assert.equal(parsed[0].values.backStars, 10);
  assert.equal(parsed[0].values.backNumber, "10");
  assert.deepEqual(parsed[0].values.leftSleeveNumbers, ["7", "12", "", "", "", "55", "6", "7", "8", "9"]);
});

test("the owner dashboard keeps the signed-in identity on one line", async () => {
  const adminAccess = await readFile(adminAccessUrl, "utf8");
  assert.match(adminAccess, /whitespace-nowrap[\s\S]{0,200}Signed in as/);
});

test("saving an existing design updates it without creating a duplicate", () => {
  const original = draft("messi", "2026-09-15T10:00:00.000Z");
  const updated = {
    ...original,
    updatedAt: "2026-09-15T11:00:00.000Z",
    values: { ...original.values, backStars: 8 },
  };
  const drafts = upsertStudioDraft([original], updated);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].values.backStars, 8);
});

test("saved studio designs preserve a zero-star selection", () => {
  const values = { ...createDefaultStudioValues(), backStars: 0 };
  const parsed = parseStudioDrafts(
    JSON.stringify([draft("no-stars", "2026-09-15T12:00:00.000Z", values)]),
  );
  assert.equal(parsed[0].values.backStars, 0);
});

test("the private studio exposes custom names, sleeve numbers, and zero to ten stars", async () => {
  const [builder, viewer, app, studioAccess] = await Promise.all([
    readFile(builderUrl, "utf8"),
    readFile(viewerUrl, "utf8"),
    readFile(appUrl, "utf8"),
    readFile(studioAccessUrl, "utf8"),
  ]);
  assert.match(builder, /studioMode \? 10 : 5/);
  assert.match(builder, /Array\.from\(\{ length: starLimit \}, \(_, index\) => index \+ 1\)/);
  assert.match(builder, /backStars === n \? n - 1 : n/);
  assert.doesNotMatch(builder, />0<\/span>/);
  assert.match(builder, /aria-label="Back name"/);
  assert.match(builder, /studioMode \? 10 : 5/);
  assert.match(builder, /sleeveSlotLimit=\{sleeveNumberLimit\}/);
  assert.match(builder, /Left Sleeve Numbers \(up to \$\{sleeveNumberLimit\}\)/);
  assert.match(builder, /Right Sleeve Numbers \(up to \$\{sleeveNumberLimit\}\)/);
  assert.match(viewer, /Math\.min\(10, propsRef\.current\.sleeveSlotLimit \?\? 5\)/);
  assert.match(viewer, /Math\.min\(10, Math\.round\(design\.stars\)\)/);
  assert.match(viewer, /fittedStarStepDegrees\(w, stars\)/);
  assert.match(app, /path="\/studio"/);
  assert.match(app, /studioIdentity \? \(/);
  assert.match(app, /getStudioSession/);
  assert.match(app, /window\.location\.assign\('\/studio-access'\)/);
  assert.match(studioAccess, /GoogleAuthProvider/);
  assert.match(studioAccess, /CONTINUE WITH GOOGLE/);
  assert.match(studioAccess, /getStudioSession/);
});

test("the studio PDF assembler writes one valid page object for every jacket view page", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = assemblePdfFromJpegs(
    Array.from({ length: 6 }, () => ({ bytes: jpeg, width: 1, height: 1 })),
  );
  const source = new TextDecoder("latin1").decode(pdf);
  assert.ok(source.startsWith("%PDF-1.4"));
  assert.equal(source.match(/\/Type \/Page\b/g)?.length, 6);
  assert.match(source, /\/Count 6/);
  assert.match(source, /xref\n0 21/);
  assert.match(source, /startxref\n\d+\n%%EOF/);
});

test("the private studio wires the export button to all four 3D jacket views", async () => {
  const [builder, viewer] = await Promise.all([
    readFile(builderUrl, "utf8"),
    readFile(viewerUrl, "utf8"),
  ]);
  assert.match(builder, /exportStudioPdf/);
  assert.match(builder, /captureJacket\("front"\)/);
  assert.match(builder, /captureJacket\("back"\)/);
  assert.match(builder, /captureJacket\("left"\)/);
  assert.match(builder, /captureJacket\("right"\)/);
  assert.match(builder, /downloadJacketReferencePdf/);
  assert.match(viewer, /onCaptureReady/);
  assert.match(viewer, /renderer\.domElement\.toDataURL\("image\/png"\)/);
});
