export type LeatherType = "Nappa" | "Cowhide";
export type JacketEdition = "Classic" | "Footballers";

export type EditionMaterials = {
  bodyColor: string;
  sleeveColor: string;
  leatherType: LeatherType;
  pocketColor: string;
  snapColor: string;
  trimColor: string;
  liningColor: string;
};

export type EditionMaterialStore = Record<JacketEdition, EditionMaterials>;

export const DEFAULT_EDITION_MATERIALS: EditionMaterialStore = {
  Classic: {
    bodyColor: "#181b20",
    sleeveColor: "#1a1a1a",
    leatherType: "Nappa",
    pocketColor: "#1a1a1a",
    snapColor: "#1a1a1a",
    trimColor: "#1a1a1a",
    liningColor: "#1a1a1a",
  },
  Footballers: {
    bodyColor: "#1a1a1a",
    sleeveColor: "#1a1a1a",
    leatherType: "Nappa",
    pocketColor: "#1a1a1a",
    snapColor: "#1a1a1a",
    trimColor: "#1a1a1a",
    liningColor: "#1a1a1a",
  },
};

export function createEditionMaterialStore(): EditionMaterialStore {
  return {
    Classic: { ...DEFAULT_EDITION_MATERIALS.Classic },
    Footballers: { ...DEFAULT_EDITION_MATERIALS.Footballers },
  };
}

export function transitionEditionMaterials(
  store: EditionMaterialStore,
  currentEdition: JacketEdition,
  currentMaterials: EditionMaterials,
  nextEdition: JacketEdition,
) {
  const nextStore: EditionMaterialStore = {
    ...store,
    [currentEdition]: { ...currentMaterials },
  };

  return {
    store: nextStore,
    materials: { ...nextStore[nextEdition] },
  };
}

export function sanitizeJacketNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}
