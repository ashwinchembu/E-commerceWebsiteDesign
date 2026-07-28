import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import crestImage from "figma:asset/49db8db3192aa070a09b2e638fd91cfc6cf1ca1e.png";

const MODEL_PATH = "/models/varsitybase/VarsityBase.glb";

// Sampled once from the fixed production model while it is at identity.
// Keeping this compact depth profile avoids expensive runtime ray-casting and
// lets the large back embroidery follow the actual fabric instead of hovering
// behind it at side angles.
const BACK_SURFACE_DEPTHS = [
  -0.354713, -0.354713, -0.349627, -0.402167, -0.428175, -0.436504, -0.437818, -0.437374, -0.440266, -0.414397,
  -0.362182, -0.362182, -0.362182, -0.354713, -0.405785, -0.438366, -0.463125, -0.480331, -0.484477, -0.484632,
  -0.485055, -0.489219, -0.473265, -0.446403, -0.412563, -0.366219, -0.446655, -0.478886, -0.499754, -0.51512,
  -0.526512, -0.531964, -0.530789, -0.530354, -0.529189, -0.52051, -0.504213, -0.483131, -0.453803, -0.501779,
  -0.534578, -0.552715, -0.560646, -0.566622, -0.570012, -0.568364, -0.56727, -0.56536, -0.561019, -0.554261,
  -0.53827, -0.509087, -0.530143, -0.570249, -0.5912, -0.59368, -0.592802, -0.593573, -0.593266, -0.592881,
  -0.592626, -0.591966, -0.591506, -0.574639, -0.535232, -0.524329, -0.582335, -0.60676, -0.610589, -0.605529,
  -0.606603, -0.609466, -0.611206, -0.610541, -0.608993, -0.607039, -0.588484, -0.533242, -0.48575, -0.570243,
  -0.608262, -0.613232, -0.607679, -0.612201, -0.61758, -0.622498, -0.616688, -0.612661, -0.611377, -0.578075,
  -0.504055, -0.433004, -0.543432, -0.597996, -0.608151, -0.606717, -0.610456, -0.617488, -0.62365, -0.617,
  -0.609157, -0.605612, -0.557005, -0.478283, -0.392629, -0.519268, -0.583637, -0.599096, -0.600824, -0.603619,
  -0.610871, -0.616925, -0.613294, -0.603799, -0.59407, -0.534355, -0.445325, -0.347339, -0.498721, -0.576289,
  -0.591365, -0.591047, -0.592585, -0.60401, -0.611998, -0.609776, -0.598094, -0.583349, -0.516108, -0.392644,
  -0.312153, -0.492905, -0.578608, -0.585091, -0.578244, -0.579144, -0.597863, -0.611032, -0.608876, -0.591878,
  -0.573698, -0.543325, -0.392644, -0.312153, -0.52545, -0.583963, -0.578419, -0.563409, -0.562552, -0.594013,
  -0.613622, -0.611901, -0.585869, -0.559224, -0.545239, -0.392644, -0.312153, -0.53572, -0.579275, -0.569901,
  -0.550441, -0.54915, -0.593584, -0.619197, -0.617869, -0.582496, -0.545444, -0.530022, -0.392644, -0.296188,
  -0.531, -0.567407, -0.560302, -0.538825, -0.541068, -0.594363, -0.622349, -0.621348, -0.581488, -0.533622,
  -0.507347, -0.392644, -0.357122, -0.518245, -0.555943, -0.550543, -0.527541, -0.533401, -0.59419, -0.62196,
  -0.620611, -0.581276, -0.519466, -0.480804, -0.392644, -0.305152, -0.503997, -0.54374, -0.540501, -0.515885,
  -0.526621, -0.593631, -0.619772, -0.616188, -0.580789, -0.505209, -0.454078, -0.38013, -0.326565, -0.487615,
  -0.530827, -0.531051, -0.50392, -0.523913, -0.593938, -0.616859, -0.611415, -0.576965, -0.496845, -0.428407,
  -0.364074, -0.329215, -0.468311, -0.517665, -0.5211, -0.491392, -0.524118, -0.594166, -0.613052, -0.604776,
  -0.571391, -0.500602, -0.403166, -0.338831, -0.308007, -0.446943, -0.503507, -0.510744, -0.478776, -0.532267,
  -0.590828, -0.608183, -0.596103, -0.563719, -0.50617, -0.374878, -0.311611,
] as const;
const BRAND_GOLD = "#c9a24a";
const CHEST_FILL = "#f2ede2";
// Keep the geometry almost flush; the bump map supplies the visible thread
// height without creating an air gap at grazing camera angles.
const PATCH_TOP_OFFSET = 0.0008;
const PATCH_EDGE_OFFSETS = [0.0002, 0.0004, 0.0006];
const PATCH_EDGE_OFFSETS_CONSTRAINED = [0.0005];

// Keep the small compressed model in memory so an automatic retry never has
// to wait for a second network request.
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

}

/** Draw the central number and footer on their own clean surface layer. */
function drawBackFooter(canvas: HTMLCanvasElement, design: BackDesign) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const number = design.backNumber.trim();
  if (number) {
    ctx.font = "400 390px 'League Spartan', sans-serif";
    outlinedText(ctx, number, w / 2, 452, 390, design.backPrintColor, w * 0.92);
  }
  ctx.font = "400 92px 'League Spartan', sans-serif";
  outlinedText(ctx, "EST. 2026", w / 2, 646, 92, design.backPrintColor, w * 0.9);
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
  backFooter: Decal;
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

function applySurfaceTextures(materials: PartMaterials, surfaces: SurfaceTextures, colors: VarsityJacketViewerProps) {
  materials.body.userData.surfaces = surfaces;
  materials.sleeve.bumpMap = surfaces.leather;
  materials.sleeve.bumpScale = 0.05;
  materials.pocket.bumpMap = surfaces.leather;
  materials.pocket.bumpScale = 0.05;
  materials.trim.bumpMap = surfaces.rib;
  materials.trim.bumpScale = 0.038;
  materials.lining.bumpMap = surfaces.quilt;
  materials.lining.bumpScale = 0.022;
  applyLeatherType(materials, colors.leatherType, colors.bodyMaterial);
  Object.values(materials).forEach((material) => {
    material.needsUpdate = true;
  });
}

function makeMaterials(colors: VarsityJacketViewerProps, surfaces?: SurfaceTextures): PartMaterials {
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
  if (surfaces) applySurfaceTextures(materials, surfaces, colors);
  else applyLeatherType(materials, colors.leatherType, colors.bodyMaterial);
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
    // DecalGeometry follows the jacket's triangulation. On the curved chest
    // and back, adjacent projected triangles can overlap by a fraction of a
    // pixel; writing depth lets one triangle punch holes through the next.
    // Keep normal depth testing so the curved jacket correctly occludes a
    // patch at grazing angles. With depth writes disabled, adjacent patch
    // triangles cannot punch holes through each other.
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -12,
    polygonOffsetUnits: -12,
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
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.18,
  });
}

function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of nodeMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

type ViewerStatus = "loading" | "recovering" | "ready" | "error";

export function VarsityJacketViewer(props: VarsityJacketViewerProps) {
  const { bodyColor, bodyMaterial, sleeveColor, leatherType, trimColor, snapColor, pocketColor, liningColor } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const automaticRetryRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0, rotX: -0.05, lastInteraction: 0 });
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
    drawBackFooter(loaded.backFooter.canvas, design);
    loaded.backFooter.texture.needsUpdate = true;
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

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const isConstrained = isMobile || navigator.hardwareConcurrency <= 4;
    const textureAnisotropy = isConstrained ? 2 : 8;
    let disposed = false;
    let retryTimer = 0;
    let loadTimeout = 0;
    let detailTimer = 0;
    let surfaceTimer = 0;
    let modelPrepared = false;
    let readyReported = false;

    const failPreview = (message: string, error?: unknown) => {
      if (disposed) return;
      window.clearTimeout(loadTimeout);
      if (error) console.error(message, error);

      if (automaticRetryRef.current < 2) {
        const attempt = automaticRetryRef.current + 1;
        automaticRetryRef.current = attempt;
        setViewerStatus("recovering");
        retryTimer = window.setTimeout(() => {
          if (!disposed) setRetryKey((key) => key + 1);
        }, attempt * 1500);
        return;
      }

      setViewerStatus("error");
    };

    setViewerStatus("loading");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: isMobile ? "low-power" : "high-performance",
      });
    } catch (error) {
      failPreview("Failed to create jacket renderer", error);
      return () => {
        disposed = true;
        window.clearTimeout(loadTimeout);
        window.clearTimeout(retryTimer);
        window.clearTimeout(detailTimer);
        window.clearTimeout(surfaceTimer);
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isConstrained ? 1.25 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = !isConstrained;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      failPreview("Jacket renderer lost its WebGL context");
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
    camera.position.set(0, 0, initialAspect < 0.85 ? 8.1 : 5.6);

    scene.add(new THREE.HemisphereLight("#ffffff", "#9aa6b4", 0.3));
    const key = new THREE.DirectionalLight("#fff4e6", 1.7);
    key.position.set(2.6, 4, 3.4);
    key.castShadow = !isConstrained;
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
    const patchMeshes: THREE.Mesh[] = [];
    const patchFacing = new THREE.Vector3();
    const clock = new THREE.Clock();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let surfaces: SurfaceTextures | null = null;
    const materials = makeMaterials(propsRef.current);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loadTimeout = window.setTimeout(() => {
      failPreview("Jacket preview timed out while loading");
    }, 12000);
    loader.load(MODEL_PATH, (gltf) => {
      if (disposed) {
        disposeObjectResources(gltf.scene);
        return;
      }
      try {
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
          node.castShadow = !isConstrained;
          node.receiveShadow = !isConstrained;
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
      // Decal geometry below is generated in world space and parented to
      // modelRoot, so the root must sit at identity while we build it (the
      // animation loop may already have applied a drag tilt).
      modelRoot.rotation.set(0, 0, 0);
      modelRoot.updateWorldMatrix(true, true);
      modelPrepared = true;

      // Paint the base jacket first. Fine embroidery and fabric grain are
      // added shortly after the first visible frame instead of blocking it.
      detailTimer = window.setTimeout(() => {
        if (disposed) return;
        try {
      // Every piece of artwork is a DecalGeometry projection onto the actual
      // jacket mesh, so it hugs the fabric's curvature exactly — like a patch
      // sewn flush onto the wool/leather — instead of floating on a flat
      // plane in front of it. Triangles whose surface faces away from the
      // projection are dropped: on a closed shape like an arm, the far side
      // would otherwise catch a mirrored copy of the art.
      const cullAwayFacing = (g: THREE.BufferGeometry, outward: THREE.Vector3, minFacing = -0.3) => {
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
          if (fn.dot(outward) <= minFacing) continue;
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

      const addEmbroideryStack = (
        stackGeometry: THREE.BufferGeometry,
        stackTexture: THREE.CanvasTexture,
        stackOutward: THREE.Vector3,
        edgeOffsets: number[],
        topOffset: number,
        renderOrder: number,
        depthTest = true,
        side: THREE.Side = THREE.DoubleSide,
      ) => {
        const offsetAlongSurface = (source: THREE.BufferGeometry, distance: number) => {
          const geometry = source.clone();
          const positions = geometry.attributes.position;
          const normals = geometry.attributes.normal;
          const point = new THREE.Vector3();
          const normal = new THREE.Vector3();
          for (let index = 0; index < positions.count; index += 1) {
            point.fromBufferAttribute(positions, index);
            normal.fromBufferAttribute(normals, index).normalize();
            if (normal.dot(stackOutward) < 0) normal.negate();
            point.addScaledVector(normal, distance);
            positions.setXYZ(index, point.x, point.y, point.z);
          }
          positions.needsUpdate = true;
          return geometry;
        };

        const edgeMaterial = makeEmbroideryEdgeMaterial(stackTexture);
        edgeMaterial.depthTest = depthTest;
        edgeMaterial.side = side;
        edgeOffsets.forEach((offset, index) => {
          const edge = new THREE.Mesh(offsetAlongSurface(stackGeometry, offset), edgeMaterial);
        edge.renderOrder = renderOrder + index;
        edge.receiveShadow = true;
        edge.userData.patchOutward = stackOutward.clone();
        edge.userData.patchFadeStart = depthTest ? 0.07 : 0.16;
        edge.userData.patchFadeEnd = depthTest ? 0.2 : 0.32;
        patchMeshes.push(edge);
        modelRoot.add(edge);
      });

      const topMaterial = makeDecalMaterial(stackTexture);
      topMaterial.depthTest = depthTest;
      topMaterial.side = side;
      const top = new THREE.Mesh(offsetAlongSurface(stackGeometry, topOffset), topMaterial);
      top.renderOrder = renderOrder + edgeOffsets.length + 1;
      top.castShadow = true;
      top.userData.addEmbroideryStack = addEmbroideryStack;
      top.userData.patchBaseGeometry = stackGeometry;
      top.userData.patchOutward = stackOutward.clone();
      top.userData.patchFadeStart = depthTest ? 0.07 : 0.16;
      top.userData.patchFadeEnd = depthTest ? 0.2 : 0.32;
      patchMeshes.push(top);
      modelRoot.add(top);
        return top;
      };

      /**
       * Build one continuous UV grid from the garment's outer surface.
       * DecalGeometry clips each source triangle independently; on the torso
       * that made transparent artwork overlap itself and lose pieces of
       * letters. Exact ray hits keep the chest artwork sewn to the panel
       * instead of hovering at the depth of a nearby seam vertex.
       */
      const makeSurfacePatchGeometry = (
        mesh: THREE.Mesh,
        center: THREE.Vector2,
        width: number,
        height: number,
        outward: THREE.Vector3,
        segmentsX: number,
        segmentsY: number,
        flipU = false,
      ) => {
        type SurfaceSample = {
          point: THREE.Vector3;
          normal: THREE.Vector3;
          uv: THREE.Vector2;
          valid: boolean;
          outwardDepth: number;
        };
        const grid: SurfaceSample[] = [];
        const left = center.x - width / 2;
        const top = center.y + height / 2;
        for (let iy = 0; iy <= segmentsY; iy += 1) {
          const v = iy / segmentsY;
          const y = center.y + height * (0.5 - v);
          for (let ix = 0; ix <= segmentsX; ix += 1) {
            const u = ix / segmentsX;
            const x = center.x + width * (u - 0.5);
            grid.push({
              point: new THREE.Vector3(x, y, 0),
              normal: outward.clone(),
              uv: new THREE.Vector2(flipU ? 1 - u : u, 1 - v),
              valid: false,
              outwardDepth: -Infinity,
            });
          }
        }

        // Rasterize the garment triangles into the tiny patch grid. This is
        // exact like raycasting, but visits each source triangle only once.
        const sourcePositions = mesh.geometry.attributes.position;
        const sourceNormals = mesh.geometry.attributes.normal;
        const sourceIndex = mesh.geometry.index;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();
        const na = new THREE.Vector3();
        const nb = new THREE.Vector3();
        const nc = new THREE.Vector3();
        const faceNormal = new THREE.Vector3();
        const ab = new THREE.Vector3();
        const ac = new THREE.Vector3();
        const triangleCount = sourceIndex ? sourceIndex.count / 3 : sourcePositions.count / 3;
        const row = segmentsX + 1;
        const clampX = (value: number) => Math.max(0, Math.min(segmentsX, value));
        const clampY = (value: number) => Math.max(0, Math.min(segmentsY, value));

        for (let triangle = 0; triangle < triangleCount; triangle += 1) {
          const ia = sourceIndex ? sourceIndex.getX(triangle * 3) : triangle * 3;
          const ib = sourceIndex ? sourceIndex.getX(triangle * 3 + 1) : triangle * 3 + 1;
          const ic = sourceIndex ? sourceIndex.getX(triangle * 3 + 2) : triangle * 3 + 2;
          a.fromBufferAttribute(sourcePositions, ia).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(sourcePositions, ib).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(sourcePositions, ic).applyMatrix4(mesh.matrixWorld);

          const minX = Math.min(a.x, b.x, c.x);
          const maxX = Math.max(a.x, b.x, c.x);
          const minY = Math.min(a.y, b.y, c.y);
          const maxY = Math.max(a.y, b.y, c.y);
          if (maxX < left || minX > left + width || maxY < top - height || minY > top) continue;

          const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
          if (Math.abs(denominator) < 1e-10) continue;

          const minIx = clampX(Math.floor(((minX - left) / width) * segmentsX));
          const maxIx = clampX(Math.ceil(((maxX - left) / width) * segmentsX));
          const minIy = clampY(Math.floor(((top - maxY) / height) * segmentsY));
          const maxIy = clampY(Math.ceil(((top - minY) / height) * segmentsY));

          if (sourceNormals) {
            na.fromBufferAttribute(sourceNormals, ia).applyMatrix3(normalMatrix).normalize();
            nb.fromBufferAttribute(sourceNormals, ib).applyMatrix3(normalMatrix).normalize();
            nc.fromBufferAttribute(sourceNormals, ic).applyMatrix3(normalMatrix).normalize();
          } else {
            ab.subVectors(b, a);
            ac.subVectors(c, a);
            faceNormal.crossVectors(ab, ac).normalize();
            na.copy(faceNormal);
            nb.copy(faceNormal);
            nc.copy(faceNormal);
          }

          for (let iy = minIy; iy <= maxIy; iy += 1) {
            for (let ix = minIx; ix <= maxIx; ix += 1) {
              const sample = grid[iy * row + ix];
              const x = sample.point.x;
              const y = sample.point.y;
              const wa = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
              const wb = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
              const wc = 1 - wa - wb;
              if (wa < -1e-5 || wb < -1e-5 || wc < -1e-5) continue;

              const z = wa * a.z + wb * b.z + wc * c.z;
              const outwardDepth = x * outward.x + y * outward.y + z * outward.z;
              if (outwardDepth <= sample.outwardDepth) continue;

              sample.point.z = z;
              sample.normal
                .set(
                  wa * na.x + wb * nb.x + wc * nc.x,
                  wa * na.y + wb * nb.y + wc * nc.y,
                  wa * na.z + wb * nb.z + wc * nc.z,
                )
                .normalize();
              if (sample.normal.dot(outward) < 0) sample.normal.negate();
              sample.valid = true;
              sample.outwardDepth = outwardDepth;
            }
          }
        }

        // Vertices that land exactly on a source-mesh seam can miss both
        // adjacent triangles because of floating-point tolerances. One missed
        // grid vertex removes its neighboring patch triangles, which shows up
        // as a narrow slice through letters when the jacket rotates. Bridge
        // only enclosed misses from their valid neighbors so the outer patch
        // boundary still follows the garment silhouette.
        const bridgeSample = (sample: SurfaceSample, first: SurfaceSample, second: SurfaceSample) => {
          sample.point.lerpVectors(first.point, second.point, 0.5);
          sample.normal.lerpVectors(first.normal, second.normal, 0.5).normalize();
          sample.valid = true;
          sample.outwardDepth = sample.point.dot(outward);
        };
        for (let pass = 0; pass < 2; pass += 1) {
          for (let iy = 1; iy < segmentsY; iy += 1) {
            for (let ix = 1; ix < segmentsX; ix += 1) {
              const sample = grid[iy * row + ix];
              if (sample.valid) continue;
              const leftSample = grid[iy * row + ix - 1];
              const rightSample = grid[iy * row + ix + 1];
              if (leftSample.valid && rightSample.valid) {
                bridgeSample(sample, leftSample, rightSample);
                continue;
              }
              const topSample = grid[(iy - 1) * row + ix];
              const bottomSample = grid[(iy + 1) * row + ix];
              if (topSample.valid && bottomSample.valid) {
                bridgeSample(sample, topSample, bottomSample);
              }
            }
          }
        }

        // The back mesh contains deep sculpted wrinkles and overlapping seam
        // triangles. Mapping every one of those depth spikes literally makes
        // neighboring artwork cells cross over each other at a three-quarter
        // view. Smooth only the hidden projection depth; the stencil above
        // still clips the result to the jacket's exact visible silhouette.
        for (let pass = 0; pass < 6; pass += 1) {
          const nextDepths = grid.map((sample) => sample.point.z);
          for (let iy = 1; iy < segmentsY; iy += 1) {
            for (let ix = 1; ix < segmentsX; ix += 1) {
              const index = iy * row + ix;
              const sample = grid[index];
              if (!sample.valid) continue;
              let total = sample.point.z * 4;
              let weight = 4;
              for (const neighbor of [
                grid[index - 1],
                grid[index + 1],
                grid[index - row],
                grid[index + row],
              ]) {
                if (!neighbor.valid) continue;
                total += neighbor.point.z;
                weight += 1;
              }
              nextDepths[index] = total / weight;
            }
          }
          for (let index = 0; index < grid.length; index += 1) {
            if (!grid[index].valid) continue;
            grid[index].point.z = nextDepths[index];
            grid[index].normal.copy(outward);
          }
        }

        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const pushTriangle = (
          a: SurfaceSample,
          b: SurfaceSample,
          c: SurfaceSample,
        ) => {
          if (!a.valid || !b.valid || !c.valid) return;
          const faceNormal = new THREE.Vector3()
            .crossVectors(b.point.clone().sub(a.point), c.point.clone().sub(a.point))
            .normalize();
          const vertices = faceNormal.dot(outward) >= 0 ? [a, b, c] : [a, c, b];
          for (const vertex of vertices) {
            positions.push(vertex.point.x, vertex.point.y, vertex.point.z);
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
            uvs.push(vertex.uv.x, vertex.uv.y);
          }
        };

        for (let iy = 0; iy < segmentsY; iy += 1) {
          for (let ix = 0; ix < segmentsX; ix += 1) {
            const topLeft = grid[iy * row + ix];
            const topRight = grid[iy * row + ix + 1];
            const bottomLeft = grid[(iy + 1) * row + ix];
            const bottomRight = grid[(iy + 1) * row + ix + 1];
            pushTriangle(topLeft, bottomLeft, topRight);
            pushTriangle(topRight, bottomLeft, bottomRight);
          }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        return geometry;
      };

      const addSurfacePatch = (
        mesh: THREE.Mesh,
        texture: THREE.CanvasTexture,
        center: THREE.Vector2,
        width: number,
        height: number,
        outward: THREE.Vector3,
        segmentsX: number,
        segmentsY: number,
        flipU = false,
        topOffset = PATCH_TOP_OFFSET,
        depthTest = true,
        side: THREE.Side = THREE.DoubleSide,
      ) => {
        const geometry = makeSurfacePatchGeometry(
          mesh,
          center,
          width,
          height,
          outward,
          segmentsX,
          segmentsY,
          flipU,
        );
        const edgeOffsets = isConstrained ? PATCH_EDGE_OFFSETS_CONSTRAINED : PATCH_EDGE_OFFSETS;
        return addEmbroideryStack(geometry, texture, outward, edgeOffsets, topOffset, 3, depthTest, side);
      };

      const addDecal = (
        mesh: THREE.Mesh,
        texture: THREE.CanvasTexture,
        position: THREE.Vector3,
        orientation: THREE.Euler,
        size: THREE.Vector3,
        outward: THREE.Vector3,
        depthTest = true,
        minFacing = -0.3,
      ) => {
        const geometry = cullAwayFacing(new DecalGeometry(mesh, position, orientation, size), outward, minFacing);
        // Start virtually flush with the garment and build outward in very
        // small connected steps. The lower layers form the embroidered edge;
        // because they share the projected curvature, nothing hovers away
        // from the jacket around the shoulders or sleeves.
        const edgeOffsets = isConstrained ? PATCH_EDGE_OFFSETS_CONSTRAINED : PATCH_EDGE_OFFSETS;
        return addEmbroideryStack(geometry, texture, outward, edgeOffsets, PATCH_TOP_OFFSET, 3, depthTest);
      };

      // Back design: projected straight onto the back panel.
      const backCanvas = document.createElement("canvas");
      backCanvas.width = 512;
      backCanvas.height = 720;
      const backTexture = new THREE.CanvasTexture(backCanvas);
      backTexture.colorSpace = THREE.SRGBColorSpace;
      backTexture.anisotropy = textureAnisotropy;
      const backFooterCanvas = document.createElement("canvas");
      backFooterCanvas.width = backCanvas.width;
      backFooterCanvas.height = backCanvas.height;
      const backFooterTexture = new THREE.CanvasTexture(backFooterCanvas);
      backFooterTexture.colorSpace = THREE.SRGBColorSpace;
      backFooterTexture.anisotropy = textureAnisotropy;
      const backMesh = byName["front_body_button_back"];
      if (backMesh) {
        // Draw a colorless stencil of only the currently visible back panel.
        // Back artwork can then ignore tiny depth variations from the fabric
        // grid while remaining clipped by the torso silhouette and sleeves.
        const maskMaterial = new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
          stencilWrite: true,
          stencilRef: 1,
          stencilFunc: THREE.AlwaysStencilFunc,
          stencilFail: THREE.KeepStencilOp,
          stencilZFail: THREE.KeepStencilOp,
          stencilZPass: THREE.ReplaceStencilOp,
        });
        const backMask = new THREE.Mesh(backMesh.geometry, maskMaterial);
        backMask.renderOrder = 2;
        backMesh.add(backMask);
        const sleeveMaskMaterial = maskMaterial.clone();
        sleeveMaskMaterial.stencilRef = 0;
        for (const sleeveName of ["sleeves_L", "sleeves_R"]) {
          const sleeve = byName[sleeveName];
          if (!sleeve) continue;
          const sleeveMask = new THREE.Mesh(sleeve.geometry, sleeveMaskMaterial);
          sleeveMask.renderOrder = 3;
          sleeve.add(sleeveMask);
        }
        const clipBackStack = (startIndex: number) => {
          for (const patch of patchMeshes.slice(startIndex)) {
            patch.userData.patchFadeStart = 0.16;
            patch.userData.patchFadeEnd = 0.32;
            const patchMaterials = Array.isArray(patch.material) ? patch.material : [patch.material];
            for (const material of patchMaterials) {
              material.stencilWrite = true;
              material.stencilRef = 1;
              material.stencilFunc = THREE.EqualStencilFunc;
              material.stencilFuncMask = 0xff;
              material.stencilWriteMask = 0;
              material.stencilFail = THREE.KeepStencilOp;
              material.stencilZFail = THREE.KeepStencilOp;
              material.stencilZPass = THREE.KeepStencilOp;
            }
          }
        };
        const wb = new THREE.Box3().setFromObject(backMesh);
        const ws = wb.getSize(new THREE.Vector3());
        const wcB = wb.getCenter(new THREE.Vector3());
        // Keep the artwork on the flatter center of the back panel. Extending
        // farther around the side curvature makes the outer letters appear to
        // float beyond the jacket silhouette during rotation.
        const bw = ws.x * 0.66;
        const bh = bw * (backCanvas.height / backCanvas.width);
        const mainPatchStart = patchMeshes.length;
        addSurfacePatch(
          backMesh,
          backTexture,
          new THREE.Vector2(wcB.x, wcB.y + ws.y * 0.04),
          bw,
          bh,
          new THREE.Vector3(0, 0, -1),
          48,
          68,
          true,
          PATCH_TOP_OFFSET,
          false,
          THREE.DoubleSide,
        );
        clipBackStack(mainPatchStart);
        const footerPatchStart = patchMeshes.length;
        addSurfacePatch(
          backMesh,
          backFooterTexture,
          new THREE.Vector2(wcB.x, wcB.y + ws.y * 0.04),
          bw,
          bh,
          new THREE.Vector3(0, 0, -1),
          48,
          68,
          true,
          PATCH_TOP_OFFSET,
          false,
          THREE.DoubleSide,
        );
        clipBackStack(footerPatchStart);
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
          t.anisotropy = textureAnisotropy;
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

      // Front chest artwork follows a sampled panel surface (facing +z)
      // without projecting through its lining.
      const addFrontDecal = (
        panelName: string,
        canvas: HTMLCanvasElement,
        wFrac: number,
        xFrac: number,
        yFrac: number,
        depthTest = true,
      ) => {
        const panel = byName[panelName];
        if (!panel) return null;
        const pb = new THREE.Box3().setFromObject(panel);
        const ps = pb.getSize(new THREE.Vector3());
        const pc = pb.getCenter(new THREE.Vector3());
        const tx = pc.x + ps.x * xFrac;
        const ty = pc.y + ps.y * yFrac;
        const positions = panel.geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const surfaceZ = (x: number, y: number, radius: number) => {
          let maxZ = -Infinity;
          for (let index = 0; index < positions.count; index += 1) {
            vertex.fromBufferAttribute(positions, index).applyMatrix4(panel.matrixWorld);
            if (Math.abs(vertex.x - x) > radius || Math.abs(vertex.y - y) > radius) continue;
            if (vertex.z > maxZ) maxZ = vertex.z;
          }
          return maxZ;
        };
        const w = ps.x * wFrac;
        const h = w * (canvas.height / canvas.width);
        const radius = w * 0.35;
        const centerZ = surfaceZ(tx, ty, radius);
        const leftZ = surfaceZ(tx - radius, ty, radius * 0.8);
        const rightZ = surfaceZ(tx + radius, ty, radius * 0.8);
        const z = centerZ > -Infinity ? centerZ : pb.max.z;
        let yaw = 0;
        if (leftZ > -Infinity && rightZ > -Infinity) {
          const dzdx = (rightZ - leftZ) / (radius * 2);
          yaw = Math.atan2(-dzdx, 1);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = textureAnisotropy;
        const decal = addDecal(
          panel,
          texture,
          new THREE.Vector3(tx, ty, z),
          new THREE.Euler(0, yaw, 0),
          new THREE.Vector3(w, h, Math.max(w * 0.8, ps.z * 0.3)),
          new THREE.Vector3(0, 0, 1),
          depthTest,
          // Chest panels fold sharply beside the placket. Keep those
          // near-tangent triangles; the late global fade handles the true
          // profile view without cutting letters out of the wordmark.
          -0.3,
        );
        const decalMaterial = decal.material as THREE.MeshStandardMaterial;
        decalMaterial.polygonOffsetFactor = -64;
        decalMaterial.polygonOffsetUnits = -64;
        return { decal, texture };
      };

      // Gold MK crest on the wearer-left chest (front_body_L, viewer-right).
      const badgeCanvas = document.createElement("canvas");
      badgeCanvas.width = 320;
      badgeCanvas.height = 360;
      const badgeArt = addFrontDecal("front_body_L", badgeCanvas, 0.336, -0.02, 0.2);
      void loadCrest().then((crest) => {
        if (!crest || disposed || !loadedRef.current) return;
        const bctx = badgeCanvas.getContext("2d")!;
        bctx.clearRect(0, 0, badgeCanvas.width, badgeCanvas.height);
        const cw = badgeCanvas.width * 0.9;
        const chh = cw * (crest.height / crest.width);
        bctx.globalAlpha = 0.18;
        bctx.filter = "brightness(0) blur(3px)";
        bctx.drawImage(crest, (badgeCanvas.width - cw) / 2, (badgeCanvas.height - chh) / 2 + 2, cw, chh);
        bctx.filter = "none";
        bctx.globalAlpha = 1;
        bctx.drawImage(crest, (badgeCanvas.width - cw) / 2, (badgeCanvas.height - chh) / 2, cw, chh);
        if (badgeArt) {
          badgeArt.texture.needsUpdate = true;
          const threadCanvas = extractCrestThreadwork(badgeCanvas);
          const threadTexture = new THREE.CanvasTexture(threadCanvas);
          threadTexture.colorSpace = THREE.SRGBColorSpace;
          threadTexture.anisotropy = textureAnisotropy;
          const addStack = badgeArt.decal.userData.addEmbroideryStack as (
            geometry: THREE.BufferGeometry,
            texture: THREE.CanvasTexture,
            outward: THREE.Vector3,
            edgeOffsets: number[],
            topOffset: number,
            renderOrder: number,
            depthTest?: boolean,
          ) => THREE.Mesh;
          const baseGeometry = badgeArt.decal.userData.patchBaseGeometry as THREE.BufferGeometry;
          const threadTop = addStack(
            baseGeometry,
            threadTexture,
            new THREE.Vector3(0, 0, 1),
            isConstrained ? [0.0028] : [0.0026, 0.0029],
            0.0032,
            9,
            true,
          );
          const threadMaterial = threadTop.material as THREE.MeshStandardMaterial;
          threadMaterial.polygonOffsetFactor = -64;
          threadMaterial.polygonOffsetUnits = -64;
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
        backFooter: { canvas: backFooterCanvas, texture: backFooterTexture },
        sleeves: sleeveSets,
      };
      redrawDesign();
      surfaceTimer = window.setTimeout(() => {
        if (disposed) return;
        try {
          surfaces = makeSurfaceTextures();
          applySurfaceTextures(materials, surfaces, propsRef.current);
        } catch (error) {
          console.error("Failed to add jacket surface detail", error);
        }
      }, 100);
        } catch (error) {
          // The usable jacket is already on screen. A decorative-detail
          // failure should never send the viewer back to a blank loader.
          console.error("Failed to add jacket design detail", error);
        }
      }, 150);
      } catch (error) {
        failPreview("Failed to prepare jacket preview", error);
      }
    }, undefined, (error) => {
      failPreview("Failed to load jacket model", error);
    });

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current.active = true;
      dragRef.current.lastInteraction = performance.now();
      dragRef.current.x = e.clientX;
      dragRef.current.y = e.clientY;
      mount.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      d.rotY += (e.clientX - d.x) * 0.006;
      d.rotX += (e.clientY - d.y) * 0.004;
      d.rotX = THREE.MathUtils.clamp(d.rotX, -0.45, 0.35);
      d.x = e.clientX;
      d.y = e.clientY;
      d.lastInteraction = performance.now();
    };
    const onPointerUp = () => {
      dragRef.current.active = false;
      dragRef.current.lastInteraction = performance.now();
    };
    const onWheel = (e: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.003, 3.2, 9);
      dragRef.current.lastInteraction = performance.now();
    };
    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", onPointerUp);
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

    const animate = () => {
      const d = dragRef.current;
      const elapsedSinceInteraction = performance.now() - d.lastInteraction;
      if (!reduceMotion && !d.active && elapsedSinceInteraction > 1800) {
        d.rotY += clock.getDelta() * 0.176;
      } else {
        clock.getDelta();
      }
      modelRoot.rotation.set(d.rotX, d.rotY, 0);
      for (const patch of patchMeshes) {
        const outward = patch.userData.patchOutward as THREE.Vector3 | undefined;
        if (!outward) continue;
        const facing = patchFacing.copy(outward).applyQuaternion(modelRoot.quaternion).z;
        // Stay fully visible through an ordinary three-quarter view, then
        // fade only as the patch approaches a true profile. This prevents
        // depth-independent torso art from peeking beyond the silhouette.
        const fadeStart = (patch.userData.patchFadeStart as number | undefined) ?? 0.07;
        const fadeEnd = (patch.userData.patchFadeEnd as number | undefined) ?? 0.2;
        const opacity = THREE.MathUtils.smoothstep(facing, fadeStart, fadeEnd);
        patch.visible = opacity > 0.01;
        const patchMaterials = Array.isArray(patch.material) ? patch.material : [patch.material];
        for (const material of patchMaterials) material.opacity = opacity;
      }
      if (!document.hidden && !renderer.getContext().isContextLost()) {
        renderer.render(scene, camera);
        if (modelPrepared && !readyReported && renderer.info.render.triangles > 0) {
          readyReported = true;
          window.clearTimeout(loadTimeout);
          automaticRetryRef.current = 0;
          setViewerStatus("ready");
        }
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.clearTimeout(loadTimeout);
      window.clearTimeout(retryTimer);
      window.clearTimeout(detailTimer);
      window.clearTimeout(surfaceTimer);
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeObjectResources(scene);
      envTexture.dispose();
      if (surfaces) Object.values(surfaces).forEach((surface) => surface.dispose());
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
      <div
        ref={mountRef}
        className="jacket-viewer-mount absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
      />
      {viewerStatus !== "ready" && (
        <div className="jacket-viewer-overlay absolute inset-0 z-10 grid place-items-center">
          {viewerStatus === "error" ? (
            <button
              type="button"
              onClick={retryPreview}
              className="border border-gray-300 bg-white/90 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-gray-700 shadow-sm backdrop-blur transition-colors hover:border-black"
            >
              Preview paused · Tap to retry
            </button>
          ) : (
            <p className="pointer-events-none bg-white/85 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-gray-600 backdrop-blur">
              {viewerStatus === "recovering" ? "Restarting jacket preview" : "Loading jacket preview"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
