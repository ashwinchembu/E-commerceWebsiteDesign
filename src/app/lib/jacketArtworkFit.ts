export const BACK_CITY_STRESS_CASES = [
  "Bosnia and Herzegovina",
  "Northern Ireland",
  "Republic of Ireland",
  "Trinidad and Tobago",
  "United Arab Emirates",
  "Mönchengladbach",
  "Spiesen-Elversberg",
  "Alverca do Ribatejo",
  "Moreira de Cónegos",
  "Vila Nova de Famalicão",
  "Cornellà de Llobregat",
] as const;

/**
 * Repeatedly reduce a font by one uniform factor until its measured width fits.
 * The caller controls measurement, so this remains deterministic in tests and
 * uses the browser's real font metrics in the jacket renderer.
 */
export function fitUniformFontSize(
  preferredFontSize: number,
  maxWidth: number,
  measureWidth: (fontSize: number) => number,
) {
  let fontSize = preferredFontSize;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const naturalWidth = Math.max(1, measureWidth(fontSize));
    if (naturalWidth <= maxWidth) return fontSize;
    fontSize *= (maxWidth / naturalWidth) * 0.98;
  }
  return fontSize;
}

/**
 * Split a multi-word label into the most visually even pair of lines.
 * The caller supplies the real rendered-width measurement so the same
 * deterministic split can be validated without depending on the canvas.
 */
export function balancedTextLines(
  text: string,
  measureWidth: (line: string) => number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];

  let best = [text];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let split = 1; split < words.length; split += 1) {
    const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")];
    const widths = lines.map(measureWidth);
    const score = Math.max(...widths) + Math.abs(widths[0] - widths[1]) * 0.12;
    if (score < bestScore) {
      best = lines;
      bestScore = score;
    }
  }
  return best;
}
