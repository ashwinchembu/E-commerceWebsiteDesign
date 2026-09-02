import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BACK_CITY_STRESS_CASES,
  balancedTextLines,
  fitUniformFontSize,
} from "../src/app/lib/jacketArtworkFit.ts";

const viewerUrl = new URL("../src/app/components/VarsityJacketViewer.tsx", import.meta.url);

test("option four is the live city-name layout for both jacket editions", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  assert.match(viewer, /propsRef\.current\.backCityLayout \?\? "wrap-two-lines"/);

  const cityBranchStart = viewer.indexOf("const city = design.city.trim().toUpperCase()");
  const numberBranchStart = viewer.indexOf("const number = design.backNumber.trim()", cityBranchStart);
  const cityBranch = viewer.slice(cityBranchStart, numberBranchStart);
  assert.doesNotMatch(cityBranch, /jacketEdition/);
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
