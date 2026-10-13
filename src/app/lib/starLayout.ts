export interface StarArcLayoutInput {
  canvasWidth: number;
  starCount: number;
  starArc: number;
  preferredStepDegrees: number;
  preferredRadius: number;
  edgeInset?: number;
  minimumGap?: number;
}

export interface StarArcLayout {
  radius: number;
  stepDegrees: number;
}

/**
 * Keep dense star rows inside the back panel without letting adjacent patches
 * touch. Smaller rows retain the approved production size and spacing.
 */
export function fittedStarArcLayout({
  canvasWidth,
  starCount,
  starArc,
  preferredStepDegrees,
  preferredRadius,
  edgeInset = 10,
  minimumGap = 4,
}: StarArcLayoutInput): StarArcLayout {
  const count = Math.max(0, Math.round(starCount));
  if (count < 2) {
    return { radius: preferredRadius, stepDegrees: preferredStepDegrees };
  }

  const availableWidth = Math.max(0, canvasWidth - edgeInset * 2);
  const radiusThatFitsRow = Math.max(
    4,
    (availableWidth - minimumGap * (count - 1)) / (count * 2),
  );
  const radius = Math.min(preferredRadius, radiusThatFitsRow);
  const availableHalfWidth = Math.max(0, canvasWidth / 2 - radius - edgeInset);
  const maxHalfAngle = Math.asin(Math.min(1, availableHalfWidth / starArc));
  const halfStepCount = (count - 1) / 2;
  const stepDegrees = Math.min(
    preferredStepDegrees,
    (maxHalfAngle * 180) / Math.PI / halfStepCount,
  );
  const adjacentCenterDistance = 2 * starArc * Math.sin((stepDegrees * Math.PI) / 360);

  return {
    radius: Math.min(radius, Math.max(4, (adjacentCenterDistance - minimumGap) / 2)),
    stepDegrees,
  };
}
