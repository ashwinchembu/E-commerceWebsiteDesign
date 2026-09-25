export function evenlySpacedSleeveSlots(slotCount: number, valueCount: number) {
  const slots = Math.max(0, Math.floor(slotCount));
  const values = Math.max(0, Math.min(slots, Math.floor(valueCount)));
  if (!values) return [];
  if (values === 1) return [Math.floor(slots / 2)];

  return Array.from({ length: values }, (_, index) =>
    Math.round((index * (slots - 1)) / (values - 1)),
  );
}
