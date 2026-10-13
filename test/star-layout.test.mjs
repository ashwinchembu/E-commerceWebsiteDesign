import assert from "node:assert/strict";
import test from "node:test";

import { fittedStarArcLayout } from "../src/app/lib/starLayout.ts";

const canvasWidth = 512;
const starArc = 560;
const preferredRadius = 33 * 0.8;

test("dense star rows retain visible gaps and stay inside the back panel", () => {
  for (let starCount = 2; starCount <= 10; starCount += 1) {
    const layout = fittedStarArcLayout({
      canvasWidth,
      starCount,
      starArc,
      preferredStepDegrees: 11,
      preferredRadius,
    });
    const adjacentCenterDistance = 2 * starArc * Math.sin((layout.stepDegrees * Math.PI) / 360);
    const outerAngle = ((starCount - 1) / 2) * layout.stepDegrees * Math.PI / 180;
    const outerEdge = canvasWidth / 2 + starArc * Math.sin(outerAngle) + layout.radius;

    assert.ok(adjacentCenterDistance - layout.radius * 2 >= 4 - 1e-9, `${starCount} stars must not touch`);
    assert.ok(outerEdge <= canvasWidth - 10 + 1e-9, `${starCount} stars must stay inside the panel`);
  }
});

test("approved star size remains unchanged until the row becomes dense", () => {
  const five = fittedStarArcLayout({
    canvasWidth,
    starCount: 5,
    starArc,
    preferredStepDegrees: 11,
    preferredRadius,
  });
  const ten = fittedStarArcLayout({
    canvasWidth,
    starCount: 10,
    starArc,
    preferredStepDegrees: 11,
    preferredRadius,
  });

  assert.equal(five.radius, preferredRadius);
  assert.ok(ten.radius < preferredRadius);
});
