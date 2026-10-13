export function evenlySpacedSleeveSlots(slotCount: number, valueCount: number) {
  const slots = Math.max(0, Math.floor(slotCount));
  const values = Math.max(0, Math.min(slots, Math.floor(valueCount)));
  if (!values) return [];
  if (values === 1) return [Math.floor(slots / 2)];

  return Array.from({ length: values }, (_, index) =>
    Math.round((index * (slots - 1)) / (values - 1)),
  );
}

/**
 * The private Studio exposes ten inputs, but designs with five or fewer
 * numbers should use the same five physical sleeve positions as the public
 * builder. Those anchors occupy every other Studio slot. Designs that really
 * use six to ten numbers can still use the complete ten-slot column.
 */
export function sleeveNumberSlots(slotCount: number, valueCount: number) {
  const slots = Math.max(0, Math.floor(slotCount));
  const values = Math.max(0, Math.min(slots, Math.floor(valueCount)));
  if (slots === 10 && values <= 5) {
    if (values === 4) return [0, 3, 6, 9];
    // The public five-number layout occupies Studio slots 0 through 8. Space
    // smaller sets across that physical span. Four values use the complete
    // Studio column because ten slots are required for truly even thirds.
    return evenlySpacedSleeveSlots(9, values);
  }
  return evenlySpacedSleeveSlots(slots, values);
}
