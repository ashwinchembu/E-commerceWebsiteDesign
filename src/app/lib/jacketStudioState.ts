export const STUDIO_STORAGE_KEY = "manoir-kits-private-studio-designs-v1";
export const MAX_STUDIO_DRAFTS = 10;

type StudioJacketEdition = "Classic" | "Footballers";
type StudioLeatherType = "Nappa" | "Cowhide";

export interface StudioDesignValues {
  jacketEdition: StudioJacketEdition;
  bodyColor: string;
  sleeveColor: string;
  leatherType: StudioLeatherType;
  pocketColor: string;
  snapColor: string;
  trimColor: string;
  liningColor: string;
  backName: string;
  backStars: number;
  backNumber: string;
  leftSleeveNumbers: string[];
  rightSleeveNumbers: string[];
  backPrintColor: string;
  sleevePrintColor: string;
}

export interface StudioDesignDraft {
  id: string;
  name: string;
  updatedAt: string;
  values: StudioDesignValues;
}

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function sanitizeStudioNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}

export function sanitizeStudioBackName(value: string) {
  return value
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 24);
}

export function sanitizeStudioDesignName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s{2,}/g, " ").slice(0, 40);
}

export function createDefaultStudioValues(): StudioDesignValues {
  return {
    jacketEdition: "Footballers",
    bodyColor: "#1a1a1a",
    sleeveColor: "#1a1a1a",
    leatherType: "Nappa",
    pocketColor: "#1a1a1a",
    snapColor: "#1a1a1a",
    trimColor: "#1a1a1a",
    liningColor: "#1a1a1a",
    backName: "Madrid",
    backStars: 5,
    backNumber: "7",
    leftSleeveNumbers: ["", "", "", "", ""],
    rightSleeveNumbers: ["", "", "", "", ""],
    backPrintColor: "#FFFFFF",
    sleevePrintColor: "#FFFFFF",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedColor(value: unknown, fallback: string) {
  return typeof value === "string" && COLOR_PATTERN.test(value) ? value : fallback;
}

function normalizedSleeveNumbers(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: 5 }, (_, index) =>
    sanitizeStudioNumber(typeof source[index] === "string" ? source[index] : ""),
  );
}

function normalizedStudioStars(value: unknown, fallback: number) {
  const requested =
    typeof value === "number" || (typeof value === "string" && value.trim())
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(requested)
    ? Math.max(0, Math.min(10, Math.round(requested)))
    : fallback;
}

function normalizedValues(value: unknown): StudioDesignValues | null {
  if (!isRecord(value)) return null;
  const defaults = createDefaultStudioValues();
  const jacketEdition: StudioJacketEdition = value.jacketEdition === "Classic" ? "Classic" : "Footballers";
  const leatherType: StudioLeatherType = value.leatherType === "Cowhide" ? "Cowhide" : "Nappa";
  return {
    jacketEdition,
    bodyColor: normalizedColor(value.bodyColor, defaults.bodyColor),
    sleeveColor: normalizedColor(value.sleeveColor, defaults.sleeveColor),
    leatherType,
    pocketColor: normalizedColor(value.pocketColor, defaults.pocketColor),
    snapColor: normalizedColor(value.snapColor, defaults.snapColor),
    trimColor: normalizedColor(value.trimColor, defaults.trimColor),
    liningColor: normalizedColor(value.liningColor, defaults.liningColor),
    backName: sanitizeStudioBackName(typeof value.backName === "string" ? value.backName : defaults.backName),
    backStars: normalizedStudioStars(value.backStars, defaults.backStars),
    backNumber: sanitizeStudioNumber(typeof value.backNumber === "string" ? value.backNumber : defaults.backNumber),
    leftSleeveNumbers: normalizedSleeveNumbers(value.leftSleeveNumbers),
    rightSleeveNumbers: normalizedSleeveNumbers(value.rightSleeveNumbers),
    backPrintColor: normalizedColor(value.backPrintColor, defaults.backPrintColor),
    sleevePrintColor: normalizedColor(value.sleevePrintColor, defaults.sleevePrintColor),
  };
}

export function parseStudioDrafts(raw: string | null): StudioDesignDraft[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((candidate): StudioDesignDraft[] => {
        if (!isRecord(candidate)) return [];
        const values = normalizedValues(candidate.values);
        const id = typeof candidate.id === "string" ? candidate.id.slice(0, 80) : "";
        const name = sanitizeStudioDesignName(typeof candidate.name === "string" ? candidate.name : "").trim();
        const updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : "";
        if (!id || !name || !values || Number.isNaN(Date.parse(updatedAt))) return [];
        return [{ id, name, updatedAt, values }];
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_STUDIO_DRAFTS);
  } catch {
    return [];
  }
}

export function upsertStudioDraft(drafts: StudioDesignDraft[], draft: StudioDesignDraft) {
  return [draft, ...drafts.filter((item) => item.id !== draft.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_STUDIO_DRAFTS);
}
