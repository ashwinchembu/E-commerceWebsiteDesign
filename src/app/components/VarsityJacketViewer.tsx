import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import crestImage from "figma:asset/49db8db3192aa070a09b2e638fd91cfc6cf1ca1e.png";

const MODEL_PATH = "/models/varsitybase/VarsityBase.glb";
const BRAND_GOLD = "#c9a24a";
const CHEST_FILL = "#f2ede2";

// Reuse successfully decoded files if Safari has to restart the viewer after
// a transient first-load failure.
THREE.Cache.enabled = true;

let crestElement: HTMLCanvasElement | null = null;
let crestLoading: Promise<HTMLCanvasElement | null> | null = null;

/** Load the embroidered MK crest, trimmed to its own opaque bounds. */
function loadCrest(): Promise<HTMLCanvasElement | null> {
  if (crestElement) return Promise.resolve(crestElement);
  if (crestLoading) return crestLoading;
  crestLoading = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scan = document.createElement("canvas");
      scan.width = image.width;
      scan.height = image.height;
      const ctx = scan.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, scan.width, scan.height);
      // The embroidered patch ships with a clean alpha channel, so crop to its
      // own opaque bounds. No luminance keying here — that would knock out the
      // near-white merrowed border and the white MK monogram.
      let minX = scan.width;
      let minY = scan.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < scan.height; y += 1) {
        for (let x = 0; x < scan.width; x += 1) {
          if (data[(y * scan.width + x) * 4 + 3] < 32) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX <= minX || maxY <= minY) return resolve(null);
      const cropped = document.createElement("canvas");
      cropped.width = maxX - minX + 1;
      cropped.height = maxY - minY + 1;
      cropped.getContext("2d")!.drawImage(image, -minX, -minY);
      crestElement = cropped;
      resolve(cropped);
    };
    image.onerror = () => resolve(null);
    image.src = crestImage;
  });
  return crestLoading;
}

/**
 * Isolate the cream/white threadwork from the gold crest field. The returned
 * transparent canvas becomes a second geometric embroidery layer containing
 * the merrowed border, laurels, MK monogram, and MANOIR KITS lettering.
 */
function extractCrestThreadwork(source: HTMLCanvasElement): HTMLCanvasElement {
  const detail = document.createElement("canvas");
  detail.width = source.width;
  detail.height = source.height;
  const ctx = detail.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, detail.width, detail.height);
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    const sourceAlpha = data[i + 3];
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const chroma = max - min;
    // Neutral, bright fibres are the cream embroidery. Gold fibres have much
    // higher chroma and are intentionally left on the lower shield surface.
    const lightThread = brightness > 145 && chroma < 88;
    if (!lightThread || sourceAlpha < 24) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = Math.max(data[i], 226);
    data[i + 1] = Math.max(data[i + 1], 218);
    data[i + 2] = Math.max(data[i + 2], 198);
    data[i + 3] = Math.min(sourceAlpha, Math.round(((brightness - 140) / 75) * 255));
  }

  ctx.putImageData(image, 0, 0);
  return detail;
}

export type LeatherType = "Nappa" | "Cowhide";
export type BodyMaterial = "Wool" | "Leather";

/** Varsity chenille lettering: colored fill with a gold outline. */
function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, fill: string, maxWidth?: number, outlineScale = 0.055) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = BRAND_GOLD;
  ctx.lineWidth = Math.max(2, fontSize * outlineScale);
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, rotation = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Draws the back print onto a 512×720 canvas: stars → city → number → EST. */
function drawBackDesign(canvas: HTMLCanvasElement, design: BackDesign) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Stars ride high across the traps in a wide, shallow arc: the center star
  // crowns the collar and the outer ones reach toward the shoulder seams.
  const stars = Math.max(0, Math.min(5, design.stars));
  const starArc = 560;
  const starCenterY = 52 + starArc;
  const stepDeg = 11;
  for (let i = 0; i < stars; i += 1) {
    const a = ((i - (stars - 1) / 2) * stepDeg * Math.PI) / 180;
    const x = w / 2 + starArc * Math.sin(a);
    const y = starCenterY - starArc * Math.cos(a);
    drawStar(ctx, x, y, 33, BRAND_GOLD, a);
  }

  // City rides high, stretched to span the shoulders like the reference.
  const city = design.city.trim().toUpperCase();
  if (city) {
    const fontSize = city.length > 9 ? 82 : 100;
    ctx.font = `400 ${fontSize}px 'League Spartan', sans-serif`;
    const natural = ctx.measureText(city).width || 1;
    const sx = Math.min(Math.max((w * 0.86) / natural, 1), 1.35);
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.scale(sx, 1);
    outlinedText(ctx, city, 0, 200, fontSize, design.backPrintColor, (w * 0.86) / sx);
    ctx.restore();
  }

  const number = design.backNumber.trim();
  if (number) {
    ctx.font = "400 390px 'League Spartan', sans-serif";
    outlinedText(ctx, number, w / 2, 452, 390, design.backPrintColor, w * 0.92);
  }

  ctx.font = "400 104px 'League Spartan', sans-serif";
  outlinedText(ctx, "EST. 2026", w / 2, 652, 104, design.backPrintColor, w * 0.96);
}

/**
 * Draws the sleeve numbers, one canvas per slot. Each slot becomes its own
 * small decal sewn at a fixed spot down the arm, so filled values compact
 * top-down like patches applied from the shoulder.
 */
function drawSleeveNumbers(canvases: HTMLCanvasElement[], numbers: string[], color: string) {
  const values = numbers.map((n) => n.trim()).filter(Boolean).slice(0, canvases.length);
  canvases.forEach((canvas, i) => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const value = values[i];
    if (!value) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "400 120px 'League Spartan', sans-serif";
    outlinedText(ctx, value, canvas.width / 2, canvas.height / 2, 120, color, canvas.width * 0.9);
  });
}

/**
 * All-black leather neck label (white print), matching the physical jacket's
 * "MANOIR KITS / www.manoirkits.com" tag. Used by the Interior Details card.
 */
export function renderNeckLabel(): HTMLCanvasElement {
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 460;
  tagCanvas.height = 250;
  const tg = tagCanvas.getContext("2d")!;
  tg.fillStyle = "#131313";
  tg.beginPath();
  tg.roundRect(8, 8, tagCanvas.width - 16, tagCanvas.height - 16, 18);
  tg.fill();
  // Subtle leather sheen + stitch line, no gold — the label is all black.
  const sheen = tg.createLinearGradient(0, 0, tagCanvas.width, tagCanvas.height);
  sheen.addColorStop(0, "rgba(255,255,255,0.06)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(255,255,255,0.04)");
  tg.fillStyle = sheen;
  tg.beginPath();
  tg.roundRect(8, 8, tagCanvas.width - 16, tagCanvas.height - 16, 18);
  tg.fill();
  tg.strokeStyle = "#2c2c2c";
  tg.lineWidth = 2;
  tg.setLineDash([7, 5]);
  tg.beginPath();
  tg.roundRect(20, 20, tagCanvas.width - 40, tagCanvas.height - 40, 12);
  tg.stroke();
  tg.setLineDash([]);
  tg.textAlign = "center";
  tg.textBaseline = "middle";
  tg.fillStyle = "#f4f2ec";
  tg.font = "800 52px 'League Spartan', sans-serif";
  tg.fillText("MANOIR KITS", tagCanvas.width / 2, 104);
  tg.font = "600 33px 'League Spartan', sans-serif";
  tg.fillText("www.manoirkits.com", tagCanvas.width / 2, 162);
  return tagCanvas;
}

/**
 * Rectangular gold-bordered woven patch sewn on the lining: MANOIR KITS /
 * MK crest / ONE OF ONE / LEGEND'S EDITION. Used by the Interior Details card.
 */
export async function renderInteriorPatch(): Promise<HTMLCanvasElement> {
  const crest = await loadCrest();
  const ipCanvas = document.createElement("canvas");
  ipCanvas.width = 460;
  ipCanvas.height = 610;
  const ic = ipCanvas.getContext("2d")!;
  // Black twill base with a thin dark edge and the gold frame inset.
  ic.fillStyle = "#101010";
  ic.beginPath();
  ic.roundRect(4, 4, ipCanvas.width - 8, ipCanvas.height - 8, 14);
  ic.fill();
  ic.strokeStyle = BRAND_GOLD;
  ic.lineWidth = 7;
  ic.strokeRect(30, 30, ipCanvas.width - 60, ipCanvas.height - 60);
  ic.textAlign = "center";
  ic.textBaseline = "middle";
  ic.fillStyle = BRAND_GOLD;
  ic.font = "800 54px 'League Spartan', sans-serif";
  ic.fillText("MANOIR KITS", ipCanvas.width / 2, 98);
  if (crest) {
    const cw = ipCanvas.width * 0.5;
    const chh = cw * (crest.height / crest.width);
    ic.drawImage(crest, (ipCanvas.width - cw) / 2, 300 - chh / 2, cw, chh);
  }
  ic.fillStyle = "#ece6d8";
  ic.font = "800 52px 'League Spartan', sans-serif";
  ic.fillText("ONE OF ONE", ipCanvas.width / 2, 478);
  ic.fillStyle = BRAND_GOLD;
  ic.font = "800 38px 'League Spartan', sans-serif";
  ic.fillText("LEGEND'S EDITION", ipCanvas.width / 2, 538);
  return ipCanvas;
}

export interface BackDesign {
  stars: number;
  backNumber: string;
  leftSleeveNumbers: string[];
  rightSleeveNumbers: string[];
  city: string;
  backPrintColor: string;
  sleevePrintColor: string;
}

interface VarsityJacketViewerProps {
  bodyColor: string;
  bodyMaterial: BodyMaterial;
  sleeveColor: string;
  leatherType: LeatherType;
  trimColor: string;
  snapColor: string;
  pocketColor: string;
  liningColor: string;
  backDesign: BackDesign;
}

type PartMaterials = {
  body: THREE.MeshPhysicalMaterial;
  sleeve: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshPhysicalMaterial;
  snap: THREE.MeshPhysicalMaterial;
  pocket: THREE.MeshPhysicalMaterial;
  lining: THREE.MeshStandardMaterial;
};

type Decal = { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };

type SleeveSet = { canvases: HTMLCanvasElement[]; textures: THREE.CanvasTexture[] };

type Loaded = {
  materials: PartMaterials;
  back: Decal;
  sleeves: { left: SleeveSet; right: SleeveSet };
};

type SurfaceTextures = {
  wool: THREE.CanvasTexture;
  leather: THREE.CanvasTexture;
  rib: THREE.CanvasTexture;
  quilt: THREE.CanvasTexture;
};

/**
 * Procedural, color-neutral height maps so every selectable color stays
 * tactile. Grayscale only (used as bump maps, not albedo) and tiled, tuned
 * against the physical jacket: fine wool nap, medium pebbled full-grain
 * leather, vertical ribbed knit, and diamond-quilted lining.
 */
function makeSurfaceTextures(): SurfaceTextures {
  const texture = (draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeat: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    draw(ctx, canvas.width);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
    map.colorSpace = THREE.NoColorSpace;
    return map;
  };

  // Black melton nap: fine dense mottling with short directional fibres.
  const wool = texture((ctx, size) => {
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, size, size);
    let seed = 1947;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 14000; i += 1) {
      const shade = 70 + Math.floor(random() * 105);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      const x = random() * size;
      const y = random() * size;
      ctx.fillRect(x, y, random() > 0.7 ? 1.8 : 1, random() > 0.5 ? 0.7 : 1.3);
    }
  }, 7);

  // Pebbled full-grain leather, matching the close sleeve shots.
  const leather = texture((ctx, size) => {
    ctx.fillStyle = "#6a6a6a";
    ctx.fillRect(0, 0, size, size);
    let seed = 8013;
    const random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 3200; i += 1) {
      const x = random() * size;
      const y = random() * size;
      const r = 0.8 + random() * 2.6;
      const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      gradient.addColorStop(0, "#c2c2c2");
      gradient.addColorStop(0.6, "#787878");
      gradient.addColorStop(1, "#3c3c3c");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 5);

  // Vertical ribbed knit for the collar, cuffs, and waistband.
  const rib = texture((ctx, size) => {
    ctx.fillStyle = "#686868";
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 8) {
      const gradient = ctx.createLinearGradient(x, 0, x + 8, 0);
      gradient.addColorStop(0, "#444");
      gradient.addColorStop(0.45, "#b4b4b4");
      gradient.addColorStop(1, "#4a4a4a");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, 8, size);
    }
  }, 11);

  // Diamond quilting for the lining.
  const quilt = texture((ctx, size) => {
    ctx.fillStyle = "#666";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#232323";
    ctx.lineWidth = 5;
    for (let offset = -size; offset < size * 2; offset += 48) {
      ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset + size, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(offset, size); ctx.lineTo(offset + size, 0); ctx.stroke();
    }
  }, 2.3);

  return { wool, leather, rib, quilt };
}

function applyBodyMaterial(material: THREE.MeshPhysicalMaterial, bodyMaterial: BodyMaterial) {
  const surfaces = material.userData.surfaces as SurfaceTextures | undefined;
  if (bodyMaterial === "Leather") {
    material.roughness = 0.68;
    material.clearcoat = 0.15;
    material.clearcoatRoughness = 0.6;
    material.envMapIntensity = 0.35;
    material.sheen = 0;
    material.sheenRoughness = 1;
    material.sheenColor.set("#000000");
    material.bumpMap = surfaces?.leather ?? null;
    material.bumpScale = 0.05;
  } else {
    material.roughness = 0.97;
    material.clearcoat = 0;
    material.clearcoatRoughness = 1;
    material.envMapIntensity = 0.05;
    material.sheen = 0.1;
    material.sheenRoughness = 0.95;
    material.sheenColor.set("#555555");
    material.bumpMap = surfaces?.wool ?? null;
    material.bumpScale = 0.022;
  }
  material.needsUpdate = true;
}

/** Classify a part by its node name into a material group. */
function groupFor(name: string): keyof PartMaterials | "logo" {
  const n = name.toLowerCase();
  if (n.includes("sleeve")) return "sleeve";
  if (n.includes("collar") || n.includes("knit") || n.includes("trim")) return "trim";
  if (n.includes("pocket")) return "pocket";
  if (n.includes("logo")) return "logo";
  if (n.includes("front_body")) return "body"; // L / R / button_back
  if (n.includes("inside")) return "lining";
  if (n.includes("button")) return "snap";
  return "body";
}

function makeMaterials(colors: VarsityJacketViewerProps, surfaces: SurfaceTextures): PartMaterials {
  const materials = {
    body: new THREE.MeshPhysicalMaterial({
      color: colors.bodyColor,
      roughness: 0.97,
      sheen: 0.1,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color("#555555"),
      envMapIntensity: 0.05,
    }),
    sleeve: new THREE.MeshPhysicalMaterial({
      color: colors.sleeveColor,
      roughness: 0.6,
      clearcoat: 0.25,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.5,
    }),
    trim: new THREE.MeshPhysicalMaterial({
      color: colors.trimColor,
      roughness: 0.9,
      sheen: 0.25,
      sheenRoughness: 0.95,
      envMapIntensity: 0.3,
    }),
    snap: new THREE.MeshPhysicalMaterial({
      color: colors.snapColor,
      roughness: 0.35,
      metalness: 0.85,
      envMapIntensity: 1.1,
    }),
    pocket: new THREE.MeshPhysicalMaterial({
      color: colors.pocketColor,
      roughness: 0.6,
      clearcoat: 0.25,
      clearcoatRoughness: 0.6,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    }),
    lining: new THREE.MeshPhysicalMaterial({
      color: colors.liningColor,
      roughness: 0.58,
      metalness: 0,
      sheen: 0.35,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color("#3a3a3a"),
      envMapIntensity: 0.35,
      side: THREE.DoubleSide,
    }),
  };
  materials.body.userData.surfaces = surfaces;
  materials.sleeve.bumpMap = surfaces.leather;
  materials.sleeve.bumpScale = 0.05;
  materials.pocket.bumpMap = surfaces.leather;
  materials.pocket.bumpScale = 0.05;
  materials.trim.bumpMap = surfaces.rib;
  materials.trim.bumpScale = 0.038;
  materials.lining.bumpMap = surfaces.quilt;
  materials.lining.bumpScale = 0.022;
  applyBodyMaterial(materials.body, colors.bodyMaterial);
  return materials;
}

function applyLeatherType(m: PartMaterials, type: LeatherType, bodyMaterial: BodyMaterial) {
  applyBodyMaterial(m.body, bodyMaterial);
  const leatherMaterials = bodyMaterial === "Leather" ? [m.body, m.sleeve, m.pocket] : [m.sleeve, m.pocket];
  for (const leather of leatherMaterials) {
    if (type === "Nappa") {
      // Nappa is the smoother, softer hide — a low sheen, not a wet gloss.
      leather.roughness = 0.68;
      leather.clearcoat = 0.15;
      leather.clearcoatRoughness = 0.6;
      leather.envMapIntensity = 0.35;
    } else {
      // Cowhide reads more matte and grainy.
      leather.roughness = 0.85;
      leather.clearcoat = 0.05;
      leather.clearcoatRoughness = 0.85;
      leather.envMapIntensity = 0.28;
    }
    leather.needsUpdate = true;
  }
}

/**
 * Fabric-lit decal material: the artwork shades with the scene lights like a
 * sewn-on patch instead of glowing like a sticker. polygonOffset pulls it in
 * front of the coincident jacket surface without any visible air gap. The
 * artwork canvas doubles as a bump map, so the lettering and numbers stand
 * proud of the fabric like raised chenille/embroidery instead of flat print.
 */
function makeDecalMaterial(texture: THREE.CanvasTexture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.035,
    transparent: true,
    alphaTest: 0.035,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.42,
  });
}

/**
 * Darker, matte thread edge used below the artwork's top face. Repeating the
 * curved decal geometry at tiny physical offsets produces a connected patch
 * profile and visible parallax at grazing angles — actual geometry rather
 * than a lighting-only bump illusion.
 */
function makeEmbroideryEdgeMaterial(texture: THREE.CanvasTexture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: new THREE.Color("#8f7440"),
    transparent: true,
    alphaTest: 0.06,
    depthWrite: true,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.18,
  });
}

export function VarsityJacketViewer(props: VarsityJacketViewerProps) {
  const { bodyColor, bodyMaterial, sleeveColor, leatherType, trimColor, snapColor, pocketColor, liningColor } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const [viewerStatus, setViewerStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const automaticRetryRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.0, rotX: -0.05, lastInteraction: 0 });
  const loadedRef = useRef<Loaded | null>(null);
  const frameRef = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Recolor on prop change.
  useEffect(() => {
    const m = loadedRef.current?.materials;
    if (!m) return;
    m.body.color.set(bodyColor);
    applyLeatherType(m, leatherType, bodyMaterial);
    m.sleeve.color.set(sleeveColor);
    m.trim.color.set(trimColor);
    m.snap.color.set(snapColor);
    m.pocket.color.set(pocketColor);
    m.lining.color.set(liningColor);
  }, [bodyColor, bodyMaterial, leatherType, sleeveColor, trimColor, snapColor, pocketColor, liningColor]);

  useEffect(() => {
    const m = loadedRef.current?.materials;
    if (m) applyLeatherType(m, leatherType, bodyMaterial);
  }, [leatherType, bodyMaterial]);

  const redrawDesign = () => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    const design = propsRef.current.backDesign;
    drawBackDesign(loaded.back.canvas, design);
    loaded.back.texture.needsUpdate = true;
    drawSleeveNumbers(loaded.sleeves.left.canvases, design.leftSleeveNumbers, design.sleevePrintColor);
    drawSleeveNumbers(loaded.sleeves.right.canvases, design.rightSleeveNumbers, design.sleevePrintColor);
    for (const t of loaded.sleeves.left.textures) t.needsUpdate = true;
    for (const t of loaded.sleeves.right.textures) t.needsUpdate = true;
  };

  useEffect(() => {
    redrawDesign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.backDesign]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let retryTimer = 0;
    let modelPrepared = false;
    let readyReported = false;
    const retrySilently = (message: string, error?: unknown) => {
      if (disposed) return;
      if (error) console.warn(message, error);

      if (automaticRetryRef.current < 2) {
        automaticRetryRef.current += 1;
        setViewerStatus("loading");
        retryTimer = window.setTimeout(() => {
          if (!disposed) setRetryKey((key) => key + 1);
        }, automaticRetryRef.current * 1200);
        return;
      }

      setViewerStatus("error");
    };

    setViewerStatus("loading");
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      retrySilently("Failed to create jacket renderer", error);
      return () => {
        disposed = true;
        window.clearTimeout(retryTimer);
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      readyReported = false;
      retrySilently("Jacket renderer context was interrupted");
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    // Near plane matters: zoom never gets closer than z=3.2, and a tiny near
    // value starves the depth buffer, making decals z-fight (black flecks)
    // at some rotation angles.
    const initialAspect = (mount.clientWidth || 1) / (mount.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(28, initialAspect, 0.5, 50);
    camera.position.set(0, 0, initialAspect < 0.85 ? 6.35 : 5.6);

    scene.add(new THREE.HemisphereLight("#ffffff", "#9aa6b4", 0.3));
    const key = new THREE.DirectionalLight("#fff4e6", 1.7);
    key.position.set(2.6, 4, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -3;
    key.shadow.camera.right = key.shadow.camera.top = 3;
    key.shadow.bias = -0.00035;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#dceaff", 0.7);
    fill.position.set(-3.2, 1.6, 2.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight("#ffffff", 1.2);
    rim.position.set(-0.6, 2.8, -3.6);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const clock = new THREE.Clock();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const surfaces = makeSurfaceTextures();
    const materials = makeMaterials(propsRef.current, surfaces);
    applyLeatherType(materials, propsRef.current.leatherType, propsRef.current.bodyMaterial);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load(MODEL_PATH, (gltf) => {
      if (disposed) return;
      const root = gltf.scene;
      const byName: Record<string, THREE.Mesh> = {};
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        byName[node.name] = node;
        const g = groupFor(node.name);
        if (g === "logo") {
          node.visible = false; // hide the stock VarsityBase logo
          return;
        }
        node.material = materials[g];
        node.castShadow = true;
        node.receiveShadow = true;
      });

      // Frame + center.
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.35 / maxDim;
      root.position.sub(center);
      root.position.multiplyScalar(scale);
      root.scale.setScalar(scale);
      modelRoot.add(root);
      modelPrepared = true;
      // Decal geometry below is generated in world space and parented to
      // modelRoot, so the root must sit at identity while we build it (the
      // animation loop may already have applied a drag tilt).
      modelRoot.rotation.set(0, 0, 0);
      modelRoot.updateWorldMatrix(true, true);

      // Every piece of artwork is a DecalGeometry projection onto the actual
      // jacket mesh, so it hugs the fabric's curvature exactly — like a patch
      // sewn flush onto the wool/leather — instead of floating on a flat
      // plane in front of it. Triangles whose surface faces away from the
      // projection are dropped: on a closed shape like an arm, the far side
      // would otherwise catch a mirrored copy of the art.
      const cullAwayFacing = (g: THREE.BufferGeometry, outward: THREE.Vector3) => {
        const pos = g.attributes.position;
        const nor = g.attributes.normal;
        const uv = g.attributes.uv;
        const p: number[] = [];
        const n: number[] = [];
        const u: number[] = [];
        const pa = new THREE.Vector3();
        const pb = new THREE.Vector3();
        const pc = new THREE.Vector3();
        const e1 = new THREE.Vector3();
        const e2 = new THREE.Vector3();
        const fn = new THREE.Vector3();
        for (let t = 0; t < pos.count; t += 3) {
          // Judge facing by the triangle's winding, not its stored vertex
          // normals — the GLB's normals are unreliable in spots and culling
          // on them punched pinholes through the art. Keep everything up to
          // a bit past the tangent (art may wrap around a curve); the
          // mirrored far-side copy sits near 180° and still goes.
          pa.fromBufferAttribute(pos, t);
          pb.fromBufferAttribute(pos, t + 1);
          pc.fromBufferAttribute(pos, t + 2);
          fn.crossVectors(e1.subVectors(pb, pa), e2.subVectors(pc, pa)).normalize();
          if (fn.dot(outward) <= -0.3) continue;
          for (let k = 0; k < 3; k++) {
            p.push(pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k));
            n.push(nor.getX(t + k), nor.getY(t + k), nor.getZ(t + k));
            u.push(uv.getX(t + k), uv.getY(t + k));
          }
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
        out.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
        out.setAttribute("uv", new THREE.Float32BufferAttribute(u, 2));
        return out;
      };
      const addDecal = (
        mesh: THREE.Mesh,
        texture: THREE.CanvasTexture,
        position: THREE.Vector3,
        orientation: THREE.Euler,
        size: THREE.Vector3,
        outward: THREE.Vector3,
      ) => {
        const geometry = cullAwayFacing(new DecalGeometry(mesh, position, orientation, size), outward);
        const addEmbroideryStack = (
          stackGeometry: THREE.BufferGeometry,
          stackTexture: THREE.CanvasTexture,
          stackOutward: THREE.Vector3,
          edgeOffsets: number[],
          topOffset: number,
          renderOrder: number,
        ) => {
          const edgeMaterial = makeEmbroideryEdgeMaterial(stackTexture);
          edgeOffsets.forEach((offset, index) => {
            const edge = new THREE.Mesh(stackGeometry, edgeMaterial);
            edge.position.copy(stackOutward).multiplyScalar(offset);
            edge.renderOrder = renderOrder + index;
            edge.receiveShadow = true;
            modelRoot.add(edge);
          });

          const top = new THREE.Mesh(stackGeometry, makeDecalMaterial(stackTexture));
          top.position.copy(stackOutward).multiplyScalar(topOffset);
          top.renderOrder = renderOrder + edgeOffsets.length + 1;
          top.castShadow = true;
          modelRoot.add(top);
          return top;
        };

        // Start virtually flush with the garment and build outward in very
        // small connected steps. The lower layers form the embroidered edge;
        // because they share the projected curvature, nothing hovers away
        // from the jacket around the shoulders or sleeves.
        const top = addEmbroideryStack(geometry, texture, outward, [0.0022, 0.0038, 0.0054, 0.007], 0.0086, 3);
        top.userData.addEmbroideryStack = addEmbroideryStack;
        return top;
      };

      // Back design: projected straight onto the back panel.
      const backCanvas = document.createElement("canvas");
      backCanvas.width = 512;
      backCanvas.height = 720;
      const backTexture = new THREE.CanvasTexture(backCanvas);
      backTexture.colorSpace = THREE.SRGBColorSpace;
      backTexture.anisotropy = 8;
      const backMesh = byName["front_body_button_back"];
      if (backMesh) {
        const wb = new THREE.Box3().setFromObject(backMesh);
        const ws = wb.getSize(new THREE.Vector3());
        const wcB = wb.getCenter(new THREE.Vector3());
        const bw = ws.x * 0.74;
        const bh = bw * (backCanvas.height / backCanvas.width);
        addDecal(
          backMesh,
          backTexture,
          new THREE.Vector3(wcB.x, wcB.y + ws.y * 0.04, wb.min.z),
          new THREE.Euler(0, Math.PI, 0),
          // Deep enough to span the whole back shell: the surface curves
          // forward over the traps and at the side seams, and a shallow box
          // clipped the star tops and letter edges there. The away-facing
          // cull keeps the extra depth from catching anything else.
          new THREE.Vector3(bw, bh, ws.z * 2),
          new THREE.Vector3(0, 0, -1),
        );
      }

      // Sleeve numbers: five small patches down the OUTER face of each arm,
      // like the physical jacket. Each number is its own decal projected at
      // its own height, so it lies flat on the local surface instead of one
      // tall strip smearing around the arm's curve. Each arm has its own
      // canvases so the two sleeves can carry different numbers.
      const SLEEVE_SLOTS = 5;
      const makeSleeveSet = (): SleeveSet => {
        const canvases: HTMLCanvasElement[] = [];
        const textures: THREE.CanvasTexture[] = [];
        for (let i = 0; i < SLEEVE_SLOTS; i++) {
          const c = document.createElement("canvas");
          c.width = 200;
          c.height = 170;
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          canvases.push(c);
          textures.push(t);
        }
        return { canvases, textures };
      };
      // sleeves_L sits on +x, which is the WEARER's left arm.
      const sleeveSets = { left: makeSleeveSet(), right: makeSleeveSet() };
      for (const [name, dir, set] of [["sleeves_L", 1, sleeveSets.left] as const, ["sleeves_R", -1, sleeveSets.right] as const]) {
        const s = byName[name];
        if (!s) continue;
        const wb = new THREE.Box3().setFromObject(s);
        const wc = wb.getCenter(new THREE.Vector3());
        const wsz = wb.getSize(new THREE.Vector3());
        const pos = s.geometry.attributes.position;
        const v = new THREE.Vector3();
        const pw = wsz.x * 0.5;
        // Scan the arm's outer surface at each slot height first...
        const slotPoints: (THREE.Vector3 | null)[] = [];
        for (let slot = 0; slot < SLEEVE_SLOTS; slot++) {
          // Evenly spaced from just below the shoulder seam to above the cuff.
          const yi = wc.y + wsz.y * (0.28 - 0.13 * slot);
          const yTol = wsz.y * 0.06;
          // The arm leans, so find its depth range at this height first...
          let zMin = Infinity;
          let zMax = -Infinity;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(s.matrixWorld);
            if (Math.abs(v.y - yi) > yTol) continue;
            if (v.z < zMin) zMin = v.z;
            if (v.z > zMax) zMax = v.z;
          }
          if (!Number.isFinite(zMin)) {
            slotPoints.push(null);
            continue;
          }
          const zc = (zMin + zMax) / 2;
          const zTol = (zMax - zMin) * 0.45;
          // ...then take the outermost surface point near the arm's centerline.
          const best = new THREE.Vector3(wc.x + dir * wsz.x * 0.4, yi, zc);
          let bestScore = -Infinity;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(s.matrixWorld);
            if (Math.abs(v.y - yi) > yTol || Math.abs(v.z - zc) > zTol) continue;
            const score = v.x * dir;
            if (score > bestScore) {
              bestScore = score;
              best.copy(v);
            }
          }
          best.y = yi;
          slotPoints.push(best);
        }
        // ...then straighten the column: the raw scan points wobble with the
        // surface, which made the stack look rigid and misaligned. Run one
        // straight line from the top slot to the bottom slot, space the
        // numbers evenly along it, and tilt them to match that line so the
        // column runs straight down the arm.
        const anchors = slotPoints
          .map((p, i) => ({ p, i }))
          .filter((e): e is { p: THREE.Vector3; i: number } => e.p !== null);
        if (!anchors.length) continue;
        const first = anchors[0];
        const last = anchors[anchors.length - 1];
        const armUp =
          first.i === last.i
            ? new THREE.Vector3(-dir * 0.28, 0.95, 0).normalize()
            : first.p.clone().sub(last.p).normalize();
        // Face mostly sideways with a slight forward bias, kept perpendicular
        // to the arm's measured axis.
        const facing = new THREE.Vector3(dir, 0, 0.35).normalize();
        facing.addScaledVector(armUp, -facing.dot(armUp)).normalize();
        // Matrix4.lookAt points +z from target toward eye, and DecalGeometry's
        // readable face is the projector's +z — so the eye sits outward.
        const lookM = new THREE.Matrix4().lookAt(facing, new THREE.Vector3(), armUp);
        const orientation = new THREE.Euler().setFromRotationMatrix(lookM);
        for (const { i } of anchors) {
          const t = first.i === last.i ? 0 : (i - first.i) / (last.i - first.i);
          const point = first.p.clone().lerp(last.p, t);
          addDecal(s, set.textures[i], point, orientation, new THREE.Vector3(pw, pw * 0.85, pw * 1.2), facing);
        }
      }

      // Front chest artwork projected onto the panel surface (facing +z). The
      // panel curves, so sample the surface depth at the exact target spot.
      const addFrontDecal = (panelName: string, canvas: HTMLCanvasElement, wFrac: number, xFrac: number, yFrac: number) => {
        const panel = byName[panelName];
        if (!panel) return null;
        const pb = new THREE.Box3().setFromObject(panel);
        const ps = pb.getSize(new THREE.Vector3());
        const pc = pb.getCenter(new THREE.Vector3());
        const tx = pc.x + ps.x * xFrac;
        const ty = pc.y + ps.y * yFrac;
        const posA = panel.geometry.attributes.position;
        const v = new THREE.Vector3();
        // Frontmost surface z among vertices near a given (x, y) spot.
        const surfZ = (x: number, y: number, rad: number) => {
          let maxZ = -Infinity;
          for (let i = 0; i < posA.count; i++) {
            v.fromBufferAttribute(posA, i).applyMatrix4(panel.matrixWorld);
            if (Math.abs(v.x - x) > rad || Math.abs(v.y - y) > rad) continue;
            if (v.z > maxZ) maxZ = v.z;
          }
          return maxZ;
        };
        const w = ps.x * wFrac;
        const rad = w * 0.35;
        const zC = surfZ(tx, ty, rad);
        const zL = surfZ(tx - rad, ty, rad * 0.8);
        const zR = surfZ(tx + rad, ty, rad * 0.8);
        const z = zC > -Infinity ? zC : pb.max.z;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        // Yaw the projection to follow the chest's curve at this spot.
        let yaw = 0;
        if (zL > -Infinity && zR > -Infinity) {
          const dzdx = (zR - zL) / (rad * 2);
          yaw = Math.atan2(-dzdx, 1);
        }
        const decal = addDecal(
          panel,
          texture,
          new THREE.Vector3(tx, ty, z),
          new THREE.Euler(0, yaw, 0),
          new THREE.Vector3(w, w * (canvas.height / canvas.width), Math.max(w * 0.8, ps.z * 0.3)),
          new THREE.Vector3(0, 0, 1),
        );
        return { decal, texture };
      };

      // Gold MK crest on the wearer-left chest (front_body_L, viewer-right).
      const badgeCanvas = document.createElement("canvas");
      badgeCanvas.width = 320;
      badgeCanvas.height = 360;
      const badgeArt = addFrontDecal("front_body_L", badgeCanvas, 0.336, -0.02, 0.2);
      void loadCrest().then((crest) => {
        if (!crest) return;
        const bctx = badgeCanvas.getContext("2d")!;
        bctx.clearRect(0, 0, badgeCanvas.width, badgeCanvas.height);
        const cw = badgeCanvas.width * 0.9;
        const chh = cw * (crest.height / crest.width);
        bctx.globalAlpha = 0.4;
        bctx.filter = "brightness(0) blur(6px)";
        bctx.drawImage(crest, (badgeCanvas.width - cw) / 2, (badgeCanvas.height - chh) / 2 + 6, cw, chh);
        bctx.filter = "none";
        bctx.globalAlpha = 1;
        bctx.drawImage(crest, (badgeCanvas.width - cw) / 2, (badgeCanvas.height - chh) / 2, cw, chh);
        if (badgeArt) {
          badgeArt.texture.needsUpdate = true;
          const threadCanvas = extractCrestThreadwork(badgeCanvas);
          const threadTexture = new THREE.CanvasTexture(threadCanvas);
          threadTexture.colorSpace = THREE.SRGBColorSpace;
          threadTexture.anisotropy = 8;
          const addStack = badgeArt.decal.userData.addEmbroideryStack as (
            geometry: THREE.BufferGeometry,
            texture: THREE.CanvasTexture,
            outward: THREE.Vector3,
            edgeOffsets: number[],
            topOffset: number,
            renderOrder: number,
          ) => THREE.Mesh;
          const threadTop = addStack(
            badgeArt.decal.geometry,
            threadTexture,
            new THREE.Vector3(0, 0, 1),
            [0.0092, 0.0103, 0.0114, 0.0125, 0.0136, 0.0147],
            0.0158,
            9,
          );
          const threadMaterial = threadTop.material as THREE.MeshStandardMaterial;
          threadMaterial.bumpScale = 0.07;
          threadMaterial.roughness = 0.7;
          threadMaterial.envMapIntensity = 0.55;
        }
      });

      // MANOIR / KITS wordmark on the wearer-right chest (front_body_R).
      const wordCanvas = document.createElement("canvas");
      wordCanvas.width = 340;
      wordCanvas.height = 230;
      const wctx = wordCanvas.getContext("2d")!;
      wctx.textAlign = "center";
      wctx.textBaseline = "middle";
      wctx.font = "400 68px 'League Spartan', sans-serif";
      outlinedText(wctx, "MANOIR", wordCanvas.width / 2, 76, 68, CHEST_FILL, 320, 0.15);
      outlinedText(wctx, "KITS", wordCanvas.width / 2, 154, 68, CHEST_FILL, 320, 0.15);
      // Same height as the chest badge on the opposite panel.
      addFrontDecal("front_body_R", wordCanvas, 0.62, -0.05, 0.2);

      loadedRef.current = {
        materials,
        back: { canvas: backCanvas, texture: backTexture },
        sleeves: sleeveSets,
      };
      redrawDesign();
    }, undefined, (error) => {
      retrySilently("Failed to load jacket model", error);
    });

    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const distanceBetweenPointers = () => {
      const points = Array.from(activePointers.values());
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const d = dragRef.current;
      d.lastInteraction = performance.now();
      if (activePointers.size === 1) {
        d.active = true;
        d.x = e.clientX;
        d.y = e.clientY;
      } else {
        d.active = false;
        pinchDistance = distanceBetweenPointers();
      }

      mount.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const d = dragRef.current;
      if (activePointers.size >= 2) {
        e.preventDefault();
        const nextDistance = distanceBetweenPointers();
        if (pinchDistance > 0 && nextDistance > 0) {
          camera.position.z = THREE.MathUtils.clamp(
            camera.position.z * (pinchDistance / nextDistance),
            3.2,
            9,
          );
        }
        pinchDistance = nextDistance;
        d.lastInteraction = performance.now();
        return;
      }

      if (!d.active) return;
      d.rotY += (e.clientX - d.x) * 0.006;
      d.rotX += (e.clientY - d.y) * 0.004;
      d.rotX = THREE.MathUtils.clamp(d.rotX, -0.45, 0.35);
      d.x = e.clientX;
      d.y = e.clientY;
      d.lastInteraction = performance.now();
    };
    const onPointerEnd = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);

      const d = dragRef.current;
      d.lastInteraction = performance.now();
      pinchDistance = 0;
      if (activePointers.size === 1) {
        const remaining = activePointers.values().next().value as { x: number; y: number };
        d.active = true;
        d.x = remaining.x;
        d.y = remaining.y;
      } else {
        d.active = false;
      }
    };
    const onWheel = (e: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.003, 3.2, 9);
      dragRef.current.lastInteraction = performance.now();
    };
    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", onPointerEnd);
    mount.addEventListener("pointercancel", onPointerEnd);
    mount.addEventListener("wheel", onWheel, { passive: true });

    const onResize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    const hasRenderedJacketPixels = () => {
      const gl = renderer.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      if (width < 1 || height < 1) return false;

      const pixel = new Uint8Array(4);
      const samplePoints = [
        [0.5, 0.5],
        [0.5, 0.35],
        [0.4, 0.52],
        [0.6, 0.52],
        [0.5, 0.68],
      ];

      try {
        for (const [x, y] of samplePoints) {
          gl.readPixels(
            Math.min(width - 1, Math.max(0, Math.floor(width * x))),
            Math.min(height - 1, Math.max(0, Math.floor(height * y))),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel,
          );
          if (pixel[3] > 0) return true;
        }
      } catch {
        return false;
      }

      return false;
    };

    const animate = () => {
      const d = dragRef.current;
      const elapsedSinceInteraction = performance.now() - d.lastInteraction;
      if (!reduceMotion && !d.active && elapsedSinceInteraction > 1800) {
        d.rotY += clock.getDelta() * 0.176;
      } else {
        clock.getDelta();
      }
      modelRoot.rotation.set(d.rotX, d.rotY, 0);
      renderer.render(scene, camera);
      if (
        modelPrepared
        && !readyReported
        && renderer.info.render.triangles > 0
        && hasRenderedJacketPixels()
      ) {
        readyReported = true;
        automaticRetryRef.current = 0;
        setViewerStatus("ready");
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerEnd);
      mount.removeEventListener("pointercancel", onPointerEnd);
      mount.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      envTexture.dispose();
      Object.values(surfaces).forEach((surface) => surface.dispose());
      dracoLoader.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      loadedRef.current = null;
    };
  }, [retryKey]);

  const retryPreview = () => {
    automaticRetryRef.current = 0;
    setViewerStatus("loading");
    setRetryKey((key) => key + 1);
  };

  return (
    <div className="relative h-full min-h-[260px] w-full" data-viewer-status={viewerStatus}>
      <img
        src="/images/jacket-preview-poster.jpg"
        alt=""
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
          viewerStatus === "ready" ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        ref={mountRef}
        className={`absolute inset-0 touch-none cursor-grab transition-opacity duration-300 active:cursor-grabbing ${
          viewerStatus === "ready" ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {viewerStatus === "ready" ? "Jacket preview ready" : "Loading jacket preview"}
      </span>
      {viewerStatus === "error" && (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <button
            type="button"
            onClick={retryPreview}
            className="border border-gray-300 bg-white/90 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-gray-700 shadow-sm backdrop-blur transition-colors hover:border-black"
          >
            Preview paused · Tap to retry
          </button>
        </div>
      )}
    </div>
  );
}
