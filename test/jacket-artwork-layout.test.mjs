import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createEditionMaterialStore,
  DEFAULT_EDITION_MATERIALS,
  sanitizeJacketNumber,
  transitionEditionMaterials,
} from "../src/app/lib/jacketBuilderState.ts";
import {
  BACK_CITY_STRESS_CASES,
  balancedTextLines,
  fitUniformFontSize,
} from "../src/app/lib/jacketArtworkFit.ts";

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

test("edition switching keeps Classic and Footballers materials isolated", () => {
  const classicCustom = {
    ...DEFAULT_EDITION_MATERIALS.Classic,
    bodyColor: "#f6c5a5",
    sleeveColor: "#f4f2ea",
    trimColor: "#f4f2ea",
  };
  let transition = transitionEditionMaterials(
    createEditionMaterialStore(),
    "Classic",
    classicCustom,
    "Footballers",
  );

  assert.deepEqual(transition.materials, DEFAULT_EDITION_MATERIALS.Footballers);

  const footballersCustom = {
    ...transition.materials,
    bodyColor: "#f4f2ea",
    sleeveColor: "#f4f2ea",
    leatherType: "Cowhide",
  };
  transition = transitionEditionMaterials(
    transition.store,
    "Footballers",
    footballersCustom,
    "Classic",
  );
  assert.deepEqual(transition.materials, classicCustom);

  transition = transitionEditionMaterials(
    transition.store,
    "Classic",
    transition.materials,
    "Footballers",
  );
  assert.deepEqual(transition.materials, footballersCustom);
});

test("the widest jacket number remains the two-digit 88 stress case", () => {
  assert.equal(sanitizeJacketNumber("8a8"), "88");
  assert.equal(sanitizeJacketNumber("888"), "88");
});

test("back city labels fit with uniform font sizing instead of horizontal stretching", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  assert.match(viewer, /function fittedTrackedFontSize\(/);
  assert.match(viewer, /const fontSize = fittedTrackedFontSize\(/);
  assert.doesNotMatch(viewer, /const sx = Math\.min\(Math\.max\(cityMaxWidth \/ natural, 1\), 1\.35\)/);
});

test("all city-name review layouts remain available with option four as the live default", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  const builder = await readFile(builderUrl, "utf8");
  for (const layout of ["fill-width", "proportional-auto-fit", "fixed-size", "wrap-two-lines", "outer-star-span"]) {
    assert.match(viewer + builder, new RegExp(layout));
  }
  assert.match(viewer, /propsRef\.current\.backCityLayout \?\? "wrap-two-lines"/);
  assert.match(viewer, /balancedTextLines\(/);
  assert.match(viewer, /function outerStarSpanCityWidth\(/);
  assert.match(viewer, /cityLayout === "outer-star-span"/);
  assert.match(viewer, /previewStaticBack \? Math\.PI : 0/);
});

test("the selected top-ten layouts include compact and wide-spaced jacket previews", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  const builder = await readFile(builderUrl, "utf8");
  for (const layout of ["compact-single-line", "wide-letter-spacing"]) {
    assert.match(viewer + builder, new RegExp(layout));
  }
  assert.match(viewer, /cityLayout === "wide-letter-spacing" \? 0\.14 : 0\.035/);
});

test("worst-case city names fit the star span by reducing font size uniformly", () => {
  const preferred = 100;
  const maxWidth = 440;
  const measuredWidth = (text, fontSize) => text.length * fontSize * 0.58;

  const shortFontSize = fitUniformFontSize(preferred, maxWidth, (size) => measuredWidth("VENICE", size));
  assert.equal(shortFontSize, preferred);

  for (const city of BACK_CITY_STRESS_CASES) {
    const fitted = fitUniformFontSize(preferred, maxWidth, (size) => measuredWidth(city.toUpperCase(), size));
    assert.ok(fitted > 0 && fitted <= preferred, `${city} must receive a valid uniform font size`);
    assert.ok(measuredWidth(city.toUpperCase(), fitted) <= maxWidth, `${city} must stay within the star span`);
  }
});

test("every long city-name stress case fits the approved two-line layout", () => {
  const preferred = 80;
  const maxWidth = 352;
  const measuredWidth = (text, fontSize) => [...text].length * fontSize * 0.58;

  for (const city of BACK_CITY_STRESS_CASES) {
    const label = city.toUpperCase();
    const naturalWidth = measuredWidth(label, preferred);
    const lines = naturalWidth > maxWidth
      ? balancedTextLines(label, (line) => measuredWidth(line, preferred))
      : [label];
    const fitted = lines.reduce(
      (size, line) => Math.min(
        size,
        fitUniformFontSize(preferred, maxWidth, (candidate) => measuredWidth(line, candidate)),
      ),
      preferred,
    );

    assert.ok(lines.length <= 2, `${city} must use no more than two lines`);
    assert.ok(lines.every((line) => line.length > 0), `${city} must not create an empty line`);
    assert.ok(
      lines.every((line) => measuredWidth(line, fitted) <= maxWidth),
      `${city} must stay within the approved back-panel width`,
    );
  }
});
