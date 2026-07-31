export const MAX_SAVED_JACKETS = 4;

export const SAVED_JACKETS_NAMESPACE = "$app:builder";
export const SAVED_JACKETS_KEY = "saved_jackets";

export type JacketConfiguration = {
  version: 1;
  jacketEdition: "Classic" | "Footballers";
  bodyColor: string;
  sleeveColor: string;
  leatherType: "Nappa" | "Cowhide";
  pocketColor: string;
  snapColor: string;
  trimColor: string;
  liningColor: string;
  backStars: number;
  backNumber: string;
  leftSleeveNumbers: string[];
  rightSleeveNumbers: string[];
  backCity: string;
  backPrintColor: string;
  sleevePrintColor: string;
  selectedSize: string | null;
};

export type SavedJacket = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  configuration: JacketConfiguration;
};

export type SavedJacketsStore = {
  compareDigest: string | null;
  jackets: SavedJacket[];
};

export type ShopifySavedJacketsApi = {
  load: () => Promise<SavedJacketsStore>;
  save: (jackets: SavedJacket[], compareDigest: string | null) => Promise<SavedJacketsStore>;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function stringValue(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function colorValue(value: unknown, fallback: string) {
  const color = stringValue(value, 7);
  return HEX_COLOR.test(color) ? color.toLowerCase() : fallback;
}

function numberSlots(value: unknown) {
  if (!Array.isArray(value)) return ["", "", "", "", ""];
  return Array.from({ length: 5 }, (_, index) =>
    stringValue(value[index], 2).replace(/\D/g, ""),
  );
}

function parseConfiguration(value: unknown): JacketConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const jacketEdition = input.jacketEdition === "Footballers" ? "Footballers" : "Classic";
  const leatherType = input.leatherType === "Cowhide" ? "Cowhide" : "Nappa";
  const selectedSize = stringValue(input.selectedSize, 4);
  const requestedStars = Number(input.backStars);

  return {
    version: 1,
    jacketEdition,
    bodyColor: colorValue(input.bodyColor, "#181b20"),
    sleeveColor: colorValue(input.sleeveColor, "#1a1a1a"),
    leatherType,
    pocketColor: colorValue(input.pocketColor, "#1a1a1a"),
    snapColor: colorValue(input.snapColor, "#1a1a1a"),
    trimColor: colorValue(input.trimColor, "#1a1a1a"),
    liningColor: colorValue(input.liningColor, "#1a1a1a"),
    backStars: Number.isFinite(requestedStars)
      ? Math.max(0, Math.min(5, Math.trunc(requestedStars)))
      : 5,
    backNumber: stringValue(input.backNumber, 2).replace(/\D/g, ""),
    leftSleeveNumbers: numberSlots(input.leftSleeveNumbers),
    rightSleeveNumbers: numberSlots(input.rightSleeveNumbers),
    backCity: stringValue(input.backCity, 80) || "Madrid",
    backPrintColor: colorValue(input.backPrintColor, "#f4f2ea"),
    sleevePrintColor: colorValue(input.sleevePrintColor, "#f4f2ea"),
    selectedSize: selectedSize || null,
  };
}

export function parseSavedJackets(value: unknown): SavedJacket[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SAVED_JACKETS).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const input = candidate as Record<string, unknown>;
    const configuration = parseConfiguration(input.configuration);
    if (!configuration) return [];
    const createdAt = stringValue(input.createdAt, 40) || new Date(0).toISOString();
    const updatedAt = stringValue(input.updatedAt, 40) || createdAt;
    return [{
      id: stringValue(input.id, 80) || `saved-${index + 1}`,
      name: stringValue(input.name, 40) || `Jacket ${index + 1}`,
      createdAt,
      updatedAt,
      configuration,
    }];
  });
}
