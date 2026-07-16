import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import crestImage from "figma:asset/65260e3ff07725a684ad1d29eb3db00cb66a8976.png";

const MODEL_PATH = "/models/varsitybase/VarsityBase.glb";
const BRAND_GOLD = "#c9a24a";
const CHEST_FILL = "#f2ede2";

let crestElement: HTMLCanvasElement | null = null;
let crestLoading: Promise<HTMLCanvasElement | null> | null = null;

/** Load the gold MK crest, cropped and background-keyed by luminance. */
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
      const imageData = ctx.getImageData(0, 0, scan.width, scan.height);
      const { data } = imageData;
      let minX = scan.width;
      let minY = scan.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < scan.height; y += 1) {
        for (let x = 0; x < scan.width; x += 1) {
          const i = (y * scan.width + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const alpha = Math.min(255, Math.max(0, Math.round((242 - lum) * 6)));
          data[i + 3] = Math.min(data[i + 3], alpha);
          if (alpha < 32) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX <= minX || maxY <= minY) return resolve(null);
      ctx.putImageData(imageData, 0, 0);
      const cropped = document.createElement("canvas");
      cropped.width = maxX - minX + 1;
      cropped.height = maxY - minY + 1;
      cropped.getContext("2d")!.drawImage(scan, -minX, -minY);
      crestElement = cropped;
      resolve(cropped);
    };
    image.onerror = () => resolve(null);
    image.src = crestImage;
  });
  return crestLoading;
}

export type LeatherType = "Nappa" | "Cowhide";

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
    drawStar(ctx, x, y, 29, BRAND_GOLD, a);
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
    outlinedText(ctx, city, 0, 200, fontSize, design.printColor, (w * 0.86) / sx);
    ctx.restore();
  }

  const number = design.backNumber.trim();
  if (number) {
    ctx.font = "400 390px 'League Spartan', sans-serif";
    outlinedText(ctx, number, w / 2, 452, 390, design.printColor, w * 0.92);
  }

  ctx.font = "400 104px 'League Spartan', sans-serif";
  outlinedText(ctx, "EST. 2026", w / 2, 652, 104, design.printColor, w * 0.96);
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
  printColor: string;
}

interface VarsityJacketViewerProps {
  bodyColor: string;
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

function makeMaterials(colors: VarsityJacketViewerProps): PartMaterials {
  return {
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
}

function applyLeatherType(m: PartMaterials, type: LeatherType) {
  for (const leather of [m.sleeve, m.pocket]) {
    if (type === "Nappa") {
      leather.roughness = 0.55;
      leather.clearcoat = 0.3;
      leather.clearcoatRoughness = 0.5;
      leather.envMapIntensity = 0.6;
    } else {
      leather.roughness = 0.78;
      leather.clearcoat = 0.08;
      leather.clearcoatRoughness = 0.8;
      leather.envMapIntensity = 0.35;
    }
    leather.needsUpdate = true;
  }
}

/**
 * Fabric-lit decal material: the artwork shades with the scene lights like a
 * sewn-on patch instead of glowing like a sticker. polygonOffset pulls it in
 * front of the coincident jacket surface without any visible air gap.
 */
function makeDecalMaterial(texture: THREE.CanvasTexture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.35,
  });
}

export function VarsityJacketViewer(props: VarsityJacketViewerProps) {
  const { bodyColor, sleeveColor, leatherType, trimColor, snapColor, pocketColor, liningColor } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.0, rotX: -0.05 });
  const loadedRef = useRef<Loaded | null>(null);
  const frameRef = useRef(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Recolor on prop change.
  useEffect(() => {
    const m = loadedRef.current?.materials;
    if (!m) return;
    m.body.color.set(bodyColor);
    m.sleeve.color.set(sleeveColor);
    m.trim.color.set(trimColor);
    m.snap.color.set(snapColor);
    m.pocket.color.set(pocketColor);
    m.lining.color.set(liningColor);
  }, [bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor]);

  useEffect(() => {
    const m = loadedRef.current?.materials;
    if (m) applyLeatherType(m, leatherType);
  }, [leatherType]);

  const redrawDesign = () => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    const design = propsRef.current.backDesign;
    drawBackDesign(loaded.back.canvas, design);
    loaded.back.texture.needsUpdate = true;
    drawSleeveNumbers(loaded.sleeves.left.canvases, design.leftSleeveNumbers, design.printColor);
    drawSleeveNumbers(loaded.sleeves.right.canvases, design.rightSleeveNumbers, design.printColor);
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    mount.appendChild(renderer.domElement);

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
    scene.add(key);
    const fill = new THREE.DirectionalLight("#dceaff", 0.7);
    fill.position.set(-3.2, 1.6, 2.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight("#ffffff", 1.2);
    rim.position.set(-0.6, 2.8, -3.6);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    const materials = makeMaterials(propsRef.current);
    applyLeatherType(materials, propsRef.current.leatherType);

    let disposed = false;
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
        const decal = new THREE.Mesh(geometry, makeDecalMaterial(texture));
        decal.renderOrder = 3;
        // Lift the decal a hair off the surface (~1.5mm at jacket scale):
        // polygonOffset alone loses the depth fight in spots on these large
        // curved projections, which read as dark pinholes through the art.
        decal.position.copy(outward).multiplyScalar(0.006);
        modelRoot.add(decal);
        return decal;
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
        // Face mostly sideways with a slight forward bias; "up" follows the
        // hanging arm's lean.
        const facing = new THREE.Vector3(dir, 0, 0.35).normalize();
        const armUp = new THREE.Vector3(-dir * 0.28, 0.95, 0).normalize();
        // Matrix4.lookAt points +z from target toward eye, and DecalGeometry's
        // readable face is the projector's +z — so the eye sits outward.
        const lookM = new THREE.Matrix4().lookAt(facing, new THREE.Vector3(), armUp);
        const orientation = new THREE.Euler().setFromRotationMatrix(lookM);
        const pw = wsz.x * 0.5;
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
          if (!Number.isFinite(zMin)) continue;
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
          // The scanned vertex fixes the outward x/z only; pin the height to
          // the slot's exact y so the numbers space evenly down the arm.
          best.y = yi;
          addDecal(s, set.textures[slot], best, orientation, new THREE.Vector3(pw, pw * 0.85, pw * 1.2), facing);
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
      const badgeArt = addFrontDecal("front_body_L", badgeCanvas, 0.42, -0.02, 0.2);
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
        if (badgeArt) badgeArt.texture.needsUpdate = true;
      });

      // MANOIR / KITS wordmark on the wearer-right chest (front_body_R).
      const wordCanvas = document.createElement("canvas");
      wordCanvas.width = 340;
      wordCanvas.height = 230;
      const wctx = wordCanvas.getContext("2d")!;
      wctx.textAlign = "center";
      wctx.textBaseline = "middle";
      wctx.font = "400 62px 'League Spartan', sans-serif";
      outlinedText(wctx, "MANOIR", wordCanvas.width / 2, 78, 62, CHEST_FILL, 320, 0.1);
      outlinedText(wctx, "KITS", wordCanvas.width / 2, 150, 62, CHEST_FILL, 320, 0.1);
      // Same height as the chest badge on the opposite panel.
      addFrontDecal("front_body_R", wordCanvas, 0.62, -0.05, 0.2);

      loadedRef.current = {
        materials,
        back: { canvas: backCanvas, texture: backTexture },
        sleeves: sleeveSets,
      };
      redrawDesign();
    });

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current.active = true;
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
    };
    const onPointerUp = () => (dragRef.current.active = false);
    const onWheel = (e: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.003, 3.2, 9);
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
      modelRoot.rotation.set(d.rotX, d.rotY, 0);
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      envTexture.dispose();
      dracoLoader.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      loadedRef.current = null;
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full touch-none cursor-grab active:cursor-grabbing" />;
}
