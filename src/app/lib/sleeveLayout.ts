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
    return evenlySpacedSleeveSlots(5, values).map((slot) => slot * 2);
  }
  return evenlySpacedSleeveSlots(slots, values);
}
