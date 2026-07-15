import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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
function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, fill: string, maxWidth?: number) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = BRAND_GOLD;
  ctx.lineWidth = Math.max(3, fontSize * 0.13);
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

  const stars = Math.max(0, Math.min(5, design.stars));
  const starArc = 320;
  const starCenterY = 60 + starArc;
  const stepDeg = 15;
  for (let i = 0; i < stars; i += 1) {
    const a = ((i - (stars - 1) / 2) * stepDeg * Math.PI) / 180;
    const x = w / 2 + starArc * Math.sin(a);
    const y = starCenterY - starArc * Math.cos(a);
    drawStar(ctx, x, y, 27, BRAND_GOLD, a);
  }

  const city = design.city.trim().toUpperCase();
  if (city) {
    const fontSize = city.length > 9 ? 64 : 76;
    ctx.font = `800 ${fontSize}px 'League Spartan', sans-serif`;
    outlinedText(ctx, city, w / 2, 220, fontSize, design.printColor, w * 0.9);
  }

  const number = design.backNumber.trim();
  if (number) {
    ctx.font = "800 280px 'League Spartan', sans-serif";
    outlinedText(ctx, number, w / 2, 440, 280, design.printColor, w * 0.9);
  }

  ctx.font = "800 62px 'League Spartan', sans-serif";
  outlinedText(ctx, "EST. 2026", w / 2, 662, 62, design.printColor);
}

/** Draws a vertical stack of sleeve numbers. */
function drawSleeveNumbers(canvas: HTMLCanvasElement, numbers: string[], color: string) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const values = numbers.map((n) => n.trim()).filter(Boolean).slice(0, 5);
  if (!values.length) return;
  const fontSize = 92;
  ctx.font = `800 ${fontSize}px 'League Spartan', sans-serif`;
  const top = h * 0.09;
  const span = h * 0.82;
  values.forEach((value, i) => {
    const y = values.length === 1 ? h * 0.5 : top + (span / (values.length - 1)) * i;
    outlinedText(ctx, value, w / 2, y, fontSize, color);
  });
}

export interface BackDesign {
  stars: number;
  backNumber: string;
  sleeveNumbers: string[];
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
  insideView?: boolean;
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

type Loaded = {
  materials: PartMaterials;
  leftFlap: THREE.Group | null; // viewer-left front panel pivot
  rightFlap: THREE.Group | null; // viewer-right front panel pivot
  back: Decal;
  sleeves: Decal;
  insidePatches: THREE.Mesh[]; // neck tag + inside-pocket badge, shown when open
};

/** A part's bounding box expressed in the model root's local space. */
function partBoxInRoot(mesh: THREE.Mesh, root: THREE.Object3D): THREE.Box3 {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!.clone();
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  box.applyMatrix4(toRoot);
  return box;
}

/** A flat artwork plane sized to a fraction of a box, offset off one face. */
function makeArtworkPlane(canvas: HTMLCanvasElement, wUnits: number, hUnits: number): { mesh: THREE.Mesh; texture: THREE.CanvasTexture } {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wUnits, hUnits), material);
  mesh.renderOrder = 3;
  return { mesh, texture };
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

function makeMaterials(colors: VarsityJacketViewerProps): PartMaterials {
  return {
    body: new THREE.MeshPhysicalMaterial({
      color: colors.bodyColor,
      roughness: 0.97,
      sheen: 0.1,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color("#555555"),
      envMapIntensity: 0.05,
      side: THREE.DoubleSide, // panel backs show when the jacket opens
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
      roughness: 0.42, // satiny sheen so the interior reads as lining, not wool
      metalness: 0,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#3a3a3a"),
      envMapIntensity: 0.7,
      normalMap: makeQuiltNormalMap(),
      normalScale: new THREE.Vector2(0.16, 0.16),
      side: THREE.DoubleSide,
    }),
  };
}

/** Procedural diamond-quilt normal map for the satin lining. */
let quiltNormalCache: THREE.CanvasTexture | null = null;
function makeQuiltNormalMap(): THREE.CanvasTexture {
  if (quiltNormalCache) return quiltNormalCache;
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8080ff"; // flat normal
  ctx.fillRect(0, 0, s, s);
  // Draw diagonal quilt channels as soft embossed grooves.
  const draw = (angle: number) => {
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(angle);
    ctx.translate(-s / 2, -s / 2);
    const gap = s / 4;
    for (let i = -s; i < s * 2; i += gap) {
      const g = ctx.createLinearGradient(i - 3, 0, i + 3, 0);
      g.addColorStop(0, "#8080ff");
      g.addColorStop(0.5, angle > 0 ? "#7373ff" : "#8d8dff");
      g.addColorStop(1, "#8080ff");
      ctx.fillStyle = g;
      ctx.fillRect(i - 3, -s, 6, s * 3);
    }
    ctx.restore();
  };
  draw(Math.PI / 4);
  draw(-Math.PI / 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 18);
  quiltNormalCache = tex;
  return tex;
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

export function VarsityJacketViewer(props: VarsityJacketViewerProps) {
  const { bodyColor, sleeveColor, leatherType, trimColor, snapColor, pocketColor, liningColor, insideView = false } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.0, rotX: -0.05 });
  const loadedRef = useRef<Loaded | null>(null);
  const insideRef = useRef(insideView);
  const openRef = useRef(0);
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

  useEffect(() => {
    insideRef.current = insideView;
  }, [insideView]);

  const redrawDesign = () => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    const design = propsRef.current.backDesign;
    drawBackDesign(loaded.back.canvas, design);
    loaded.back.texture.needsUpdate = true;
    drawSleeveNumbers(loaded.sleeves.canvas, design.sleeveNumbers, design.printColor);
    loaded.sleeves.texture.needsUpdate = true;
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
    renderer.localClippingEnabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(28, mount.clientWidth / mount.clientHeight, 0.01, 100);
    camera.position.set(0, 0, 5.6);

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

    // When the jacket opens, this plane peels the lining's front away so the
    // camera sees into the quilted interior instead of a closed black shell.
    // Keeps points with z <= constant; constant animates 0.6 (no clip) -> 0.
    const liningClip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.6);
    materials.lining.clippingPlanes = [liningClip];

    // Trim the wool panels and snap strip dead-straight at the hem line (the
    // model's placket tongue hangs over the ribbed hem otherwise). The plane
    // is re-derived from the model's rotation every frame so the cut stays
    // glued to the hem as the jacket turns.
    const hemClipLocal = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.86);
    const hemClip = hemClipLocal.clone();
    materials.body.clippingPlanes = [hemClip];
    materials.snap.clippingPlanes = [hemClip];

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
      modelRoot.updateWorldMatrix(true, true);

      // The model's placket tongue (plus its snaps) hangs down over the ribbed
      // hem. The physical jacket has a clean hem, so drop those triangles:
      // anything on the front placket strip below the hem line.
      const removeHemTongue = (mesh: THREE.Mesh | undefined, fullWidth: boolean) => {
        if (!mesh || !mesh.geometry.index) return;
        const g = mesh.geometry;
        const posA = g.attributes.position;
        mesh.updateWorldMatrix(true, true);
        const vv = new THREE.Vector3();
        const bad = new Uint8Array(posA.count);
        for (let i = 0; i < posA.count; i++) {
          vv.fromBufferAttribute(posA, i).applyMatrix4(mesh.matrixWorld);
          if (vv.y < -0.8 && vv.z > 0.05 && (fullWidth || Math.abs(vv.x) < 0.25)) bad[i] = 1;
        }
        const idx = g.index.array;
        const keep: number[] = [];
        for (let t = 0; t < idx.length; t += 3) {
          if (bad[idx[t]] || bad[idx[t + 1]] || bad[idx[t + 2]]) continue;
          keep.push(idx[t], idx[t + 1], idx[t + 2]);
        }
        g.setIndex(keep);
      };
      // The wool panels and snap strip are trimmed by the hem clipping plane
      // instead (clean straight edge). The lining keeps its geometry except
      // for its own placket tongue.
      removeHemTongue(byName["inside_body_button"], false);

      // Set up open-front pivots: reparent each front panel (and its pocket)
      // under a hinge group at the placket so it can swing open like a door.
      const worldBox = new THREE.Box3().setFromObject(root);
      const wc = worldBox.getCenter(new THREE.Vector3());
      const ws = worldBox.getSize(new THREE.Vector3());
      const frontZ = worldBox.max.z; // panels face +z after framing

      // Hinge each front panel at its OUTER side seam (not the center placket),
      // so the panels swing apart like double doors to reveal the lining.
      const makeFlap = (panel?: THREE.Mesh, pocket?: THREE.Mesh, outer: "maxx" | "minx" = "maxx") => {
        if (!panel) return null;
        const pb = new THREE.Box3().setFromObject(panel);
        const hingeX = outer === "maxx" ? pb.max.x : pb.min.x;
        const hingeZ = (pb.min.z + pb.max.z) / 2;
        const pivot = new THREE.Group();
        pivot.position.set(hingeX, wc.y, hingeZ);
        modelRoot.add(pivot);
        pivot.attach(panel);
        if (pocket) pivot.attach(pocket);
        return pivot;
      };
      // front_body_L sits on +x (viewer right); hinge at its max-x side seam.
      // front_body_R sits on -x (viewer left); hinge at its min-x side seam.
      const rightFlap = makeFlap(byName["front_body_L"], byName["Pockets_L"], "maxx");
      const leftFlap = makeFlap(byName["front_body_R"], byName["Pockets_R"], "minx");
      // The snap strip runs down the placket; it belongs to the wearer-left
      // panel, so it swings open with that flap instead of floating mid-air.
      if (byName["button"] && rightFlap) rightFlap.attach(byName["button"]);

      // Back design: a flat artwork plane just off the back panel surface.
      const backCanvas = document.createElement("canvas");
      backCanvas.width = 512;
      backCanvas.height = 720;
      const backBox = partBoxInRoot(byName["front_body_button_back"], root);
      const backSize = backBox.getSize(new THREE.Vector3());
      const backCenter = backBox.getCenter(new THREE.Vector3());
      const backW = backSize.x * 0.62;
      const backArt = makeArtworkPlane(backCanvas, backW, backW * (backCanvas.height / backCanvas.width));
      backArt.mesh.rotation.y = Math.PI; // face -z (the back)
      backArt.mesh.position.set(backCenter.x, backCenter.y + backSize.y * 0.04, backBox.min.z - backSize.z * 0.06);
      root.add(backArt.mesh);

      // Sleeve numbers: a plane down the outer face of each sleeve.
      const sleeveCanvas = document.createElement("canvas");
      sleeveCanvas.width = 200;
      sleeveCanvas.height = 820;
      const sleeveArt: Decal = { canvas: sleeveCanvas, texture: new THREE.CanvasTexture(sleeveCanvas) };
      sleeveArt.texture.colorSpace = THREE.SRGBColorSpace;
      sleeveArt.texture.anisotropy = 8;
      for (const [name, dir] of [["sleeves_L", 1] as const, ["sleeves_R", -1] as const]) {
        const s = byName[name];
        if (!s) continue;
        const wb = new THREE.Box3().setFromObject(s);
        const wc = wb.getCenter(new THREE.Vector3());
        const wsz = wb.getSize(new THREE.Vector3());
        const mat = new THREE.MeshBasicMaterial({ map: sleeveArt.texture, transparent: true, depthWrite: false });
        // The plane lives under the scaled root, so size it in root-local units.
        const wscale = root.getWorldScale(new THREE.Vector3()).x || 1;
        const pw = (wsz.x * 0.62) / wscale;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw * (sleeveCanvas.height / sleeveCanvas.width)), mat);
        plane.renderOrder = 3;
        // Like the physical jacket: numbers run down the OUTER side face of the
        // arm. Find the outermost surface point at mid-height by scanning the
        // sleeve's vertices directly (deterministic, no raycast edge cases).
        const sampleY = wc.y + wsz.y * 0.02;
        const sampleZ = wc.z + wsz.z * 0.18; // front-outer quadrant, not the arm's mid-depth
        const pos = s.geometry.attributes.position;
        const v = new THREE.Vector3();
        const best = new THREE.Vector3(wc.x + dir * wsz.x * 0.4, sampleY, sampleZ);
        let bestScore = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(s.matrixWorld);
          if (Math.abs(v.y - sampleY) > wsz.y * 0.06) continue;
          if (Math.abs(v.z - sampleZ) > wsz.z * 0.12) continue;
          const score = v.x * dir;
          if (score > bestScore) {
            bestScore = score;
            best.copy(v);
          }
        }
        // Face outward with a forward bias so the strip reads at a front
        // three-quarter view; "up" follows the hanging arm's lean.
        const facing = new THREE.Vector3(dir, 0, 0.55).normalize();
        const armUp = new THREE.Vector3(-dir * 0.3, 0.95, 0).normalize();
        const lookM = new THREE.Matrix4().lookAt(new THREE.Vector3(), facing, armUp);
        const worldQuat = new THREE.Quaternion().setFromRotationMatrix(lookM);
        const worldPos = best.clone().addScaledVector(facing, wsz.x * 0.02);
        plane.position.copy(root.worldToLocal(worldPos));
        const rootQuat = new THREE.Quaternion();
        root.getWorldQuaternion(rootQuat);
        plane.quaternion.copy(rootQuat.invert().multiply(worldQuat));
        root.add(plane);
      }

      // Front chest artwork sitting ON the panel surface (facing +z). The
      // panel curves, so sample the surface depth at the exact target spot
      // instead of using the panel's frontmost bulge (which made art float).
      const addFrontPlane = (panelName: string, canvas: HTMLCanvasElement, wFrac: number, xFrac: number, yFrac: number) => {
        const panel = byName[panelName];
        if (!panel) return null;
        const pb = partBoxInRoot(panel, root);
        const ps = pb.getSize(new THREE.Vector3());
        const pc = pb.getCenter(new THREE.Vector3());
        const tx = pc.x + ps.x * xFrac;
        const ty = pc.y + ps.y * yFrac;
        const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(panel.matrixWorld);
        const posA = panel.geometry.attributes.position;
        const v = new THREE.Vector3();
        // Frontmost surface z among vertices near a given (x, y) spot.
        const surfZ = (x: number, y: number, rad: number) => {
          let maxZ = -Infinity;
          for (let i = 0; i < posA.count; i++) {
            v.fromBufferAttribute(posA, i).applyMatrix4(toRoot);
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
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (canvas.height / canvas.width)), mat);
        plane.renderOrder = 3;
        plane.position.set(tx, ty, z + ps.z * 0.015);
        // Yaw the plane to follow the chest's curve at this spot.
        if (zL > -Infinity && zR > -Infinity) {
          const dzdx = (zR - zL) / (rad * 2);
          plane.rotation.y = Math.atan2(-dzdx, 1);
        }
        root.add(plane);
        return { plane, texture };
      };

      // Gold MK crest on the wearer-left chest (front_body_L, viewer-right).
      const badgeCanvas = document.createElement("canvas");
      badgeCanvas.width = 320;
      badgeCanvas.height = 360;
      const badgeArt = addFrontPlane("front_body_L", badgeCanvas, 0.24, -0.02, 0.13);
      const badgeTex = badgeArt?.texture ?? null;
      // Swing the crest away with the wool panel when the jacket opens.
      if (badgeArt && rightFlap) rightFlap.attach(badgeArt.plane);
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
        if (badgeTex) badgeTex.needsUpdate = true;
      });

      // MANOIR / KITS wordmark on the wearer-right chest (front_body_R).
      const wordCanvas = document.createElement("canvas");
      wordCanvas.width = 340;
      wordCanvas.height = 230;
      const wctx = wordCanvas.getContext("2d")!;
      wctx.textAlign = "center";
      wctx.textBaseline = "middle";
      wctx.font = "800 62px 'League Spartan', sans-serif";
      outlinedText(wctx, "MANOIR", wordCanvas.width / 2, 78, 62, CHEST_FILL, 320);
      outlinedText(wctx, "KITS", wordCanvas.width / 2, 150, 62, CHEST_FILL, 320);
      const wordArt = addFrontPlane("front_body_R", wordCanvas, 0.38, -0.05, 0.16);
      if (wordArt && leftFlap) leftFlap.attach(wordArt.plane);

      // Inside patches, revealed only when the jacket is open. Each one sits on
      // a real interior surface (found by scanning mesh vertices) instead of
      // floating at the lining's bounding box.
      const insidePatches: THREE.Mesh[] = [];
      const insideBox = partBoxInRoot(byName["inside_body_button"], root);
      const inC = insideBox.getCenter(new THREE.Vector3());
      const inS = insideBox.getSize(new THREE.Vector3());
      const makePatchPlane = (canvas: HTMLCanvasElement, w: number) => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (canvas.height / canvas.width)), mat);
        plane.renderOrder = 6;
        plane.visible = false;
        root.add(plane);
        insidePatches.push(plane);
        return { plane, texture };
      };
      // Extreme surface z of a mesh near (x, y) in root-local space. An
      // optional zCap restricts the scan (e.g. to the back half of a shell).
      const surfaceZAt = (mesh: THREE.Mesh, x: number, y: number, radX: number, radY: number, mode: "min" | "max", zCap?: number) => {
        const toRootM = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
        const pA = mesh.geometry.attributes.position;
        const vv = new THREE.Vector3();
        let zBest = mode === "min" ? Infinity : -Infinity;
        for (let i = 0; i < pA.count; i++) {
          vv.fromBufferAttribute(pA, i).applyMatrix4(toRootM);
          if (Math.abs(vv.x - x) > radX || Math.abs(vv.y - y) > radY) continue;
          if (zCap !== undefined && vv.z > zCap) continue;
          if (mode === "min" ? vv.z < zBest : vv.z > zBest) zBest = vv.z;
        }
        return Number.isFinite(zBest) ? zBest : null;
      };

      // All-black leather neck label right under the collar (white print),
      // matching the physical jacket's "MANOIR KITS / www.manoirkits.com" tag.
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
      // Sewn on the interior back wall, centered just under the collar. Scan
      // only the back half of the lining shell (zCap) and take its innermost
      // surface, so the tag sits inside the jacket, not inside the wall.
      {
        const tagY = inC.y + inS.y * 0.32;
        const zBack = surfaceZAt(byName["inside_body_button"], inC.x, tagY, inS.x * 0.14, inS.y * 0.1, "max", inC.z);
        const tag = makePatchPlane(tagCanvas, inS.x * 0.15);
        tag.plane.position.set(inC.x, tagY, (zBack ?? insideBox.min.z) + inS.z * 0.02);
      }

      // Rectangular gold-bordered woven patch low on the wearer-left lining
      // (behind the pocket): MANOIR KITS / MK crest / ONE OF ONE / LEGEND'S EDITION.
      const ipCanvas = document.createElement("canvas");
      ipCanvas.width = 460;
      ipCanvas.height = 610;
      const drawPocketPatch = (crest: HTMLCanvasElement | null) => {
        const ic = ipCanvas.getContext("2d")!;
        ic.clearRect(0, 0, ipCanvas.width, ipCanvas.height);
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
      };
      drawPocketPatch(null);
      // Sewn on the inner face of the wearer-left front panel, at pocket
      // height, facing inward — it rides the flap as the jacket swings open.
      let ipTex: THREE.CanvasTexture | null = null;
      {
        const panel = byName["front_body_L"];
        if (panel) {
          const pb = partBoxInRoot(panel, root);
          const ps = pb.getSize(new THREE.Vector3());
          const pc = pb.getCenter(new THREE.Vector3());
          const px = pc.x + ps.x * 0.02;
          const py = pc.y - ps.y * 0.14;
          const zInner = surfaceZAt(panel, px, py, ps.x * 0.2, ps.y * 0.12, "min");
          const ip = makePatchPlane(ipCanvas, ps.x * 0.34);
          ipTex = ip.texture;
          ip.plane.position.set(px, py, (zInner ?? pb.min.z) - ps.z * 0.02);
          ip.plane.rotation.y = Math.PI;
          if (rightFlap) rightFlap.attach(ip.plane);
        }
      }
      void loadCrest().then((crest) => {
        if (!crest) return;
        drawPocketPatch(crest);
        if (ipTex) ipTex.needsUpdate = true;
      });

      loadedRef.current = {
        materials,
        leftFlap,
        rightFlap,
        back: { canvas: backCanvas, texture: backArt.texture },
        sleeves: sleeveArt,
        insidePatches,
      };
      redrawDesign();
    });

    const onPointerDown = (e: PointerEvent) => {
      if (insideRef.current) return;
      dragRef.current.active = true;
      dragRef.current.x = e.clientX;
      dragRef.current.y = e.clientY;
      mount.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active || insideRef.current) return;
      d.rotY += (e.clientX - d.x) * 0.006;
      d.rotX += (e.clientY - d.y) * 0.004;
      d.rotX = THREE.MathUtils.clamp(d.rotX, -0.45, 0.35);
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const onPointerUp = () => (dragRef.current.active = false);
    const onWheel = (e: WheelEvent) => {
      if (insideRef.current) return;
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

    const clock = new THREE.Clock();
    const animate = () => {
      const d = dragRef.current;
      // Time-based easing so the animation runs at the same speed regardless
      // of frame rate (throttled tabs, high-refresh displays, ...).
      const dt = Math.min(clock.getDelta(), 0.25);
      const k = 1 - Math.exp(-5 * dt); // ≈0.08/frame at 60fps
      // Inside view: face front and open the flaps; else return to rest.
      const openTarget = insideRef.current ? 1 : 0;
      openRef.current += (openTarget - openRef.current) * k;
      if (insideRef.current) {
        d.rotX += (-0.03 - d.rotX) * k;
        d.rotY += (0 - d.rotY) * k;
        camera.position.z += (6.9 - camera.position.z) * k;
      }
      const loaded = loadedRef.current;
      if (loaded) {
        const a = (openRef.current * 128 * Math.PI) / 180;
        if (loaded.leftFlap) loaded.leftFlap.rotation.y = -a;
        if (loaded.rightFlap) loaded.rightFlap.rotation.y = a;
        // Peel the lining's front away in sync with the flaps so the open
        // jacket shows its quilted interior, not a closed black shell.
        liningClip.constant = THREE.MathUtils.lerp(0.6, -0.02, openRef.current);
        // Inside patches only show once the jacket has opened enough.
        if (loaded.insidePatches) {
          const show = openRef.current > 0.5;
          for (const p of loaded.insidePatches) p.visible = show;
        }
      }
      modelRoot.rotation.set(d.rotX, d.rotY, 0);
      modelRoot.updateMatrixWorld();
      hemClip.copy(hemClipLocal).applyMatrix4(modelRoot.matrixWorld);
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
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

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}
