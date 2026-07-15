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
    }),
    lining: new THREE.MeshStandardMaterial({
      color: colors.liningColor,
      roughness: 0.85,
      envMapIntensity: 0.3,
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

      // Set up open-front pivots: reparent each front panel (and its pocket)
      // under a hinge group at the placket so it can swing open like a door.
      const worldBox = new THREE.Box3().setFromObject(root);
      const wc = worldBox.getCenter(new THREE.Vector3());
      const ws = worldBox.getSize(new THREE.Vector3());
      const frontZ = worldBox.max.z; // panels face +z after framing

      const makeFlap = (panel?: THREE.Mesh, pocket?: THREE.Mesh) => {
        if (!panel) return null;
        const pivot = new THREE.Group();
        pivot.position.set(wc.x, wc.y, frontZ - ws.z * 0.12);
        modelRoot.add(pivot);
        pivot.attach(panel);
        if (pocket) pivot.attach(pocket);
        return pivot;
      };
      const leftFlap = makeFlap(byName["front_body_R"], byName["Pockets_R"]);
      const rightFlap = makeFlap(byName["front_body_L"], byName["Pockets_L"]);

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
        const sb = partBoxInRoot(s, root);
        const ss = sb.getSize(new THREE.Vector3());
        const sc = sb.getCenter(new THREE.Vector3());
        const mat = new THREE.MeshBasicMaterial({ map: sleeveArt.texture, transparent: true, depthWrite: false });
        const pw = ss.z * 0.5;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw * (sleeveCanvas.height / sleeveCanvas.width)), mat);
        plane.renderOrder = 3;
        // Outer face of the sleeve, facing outward (±x)
        plane.position.set(sc.x + dir * ss.x * 0.52, sc.y, sc.z);
        plane.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        root.add(plane);
      }

      // Front chest artwork, offset just off the front panels (facing +z).
      const addFrontPlane = (panelName: string, canvas: HTMLCanvasElement, wFrac: number, xFrac: number, yFrac: number) => {
        const panel = byName[panelName];
        if (!panel) return null;
        const pb = partBoxInRoot(panel, root);
        const ps = pb.getSize(new THREE.Vector3());
        const pc = pb.getCenter(new THREE.Vector3());
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
        const w = ps.x * wFrac;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (canvas.height / canvas.width)), mat);
        plane.renderOrder = 3;
        plane.position.set(pc.x + ps.x * xFrac, pc.y + ps.y * yFrac, pb.max.z + ps.z * 0.06);
        root.add(plane);
        return texture;
      };

      // Gold MK crest on the wearer-left chest (front_body_L, viewer-right).
      const badgeCanvas = document.createElement("canvas");
      badgeCanvas.width = 320;
      badgeCanvas.height = 360;
      const badgeTex = addFrontPlane("front_body_L", badgeCanvas, 0.32, 0.12, 0.04);
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
      addFrontPlane("front_body_R", wordCanvas, 0.42, -0.12, 0.16);

      loadedRef.current = {
        materials,
        leftFlap,
        rightFlap,
        back: { canvas: backCanvas, texture: backArt.texture },
        sleeves: sleeveArt,
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

    const animate = () => {
      const d = dragRef.current;
      // Inside view: face front and open the flaps; else return to rest.
      const openTarget = insideRef.current ? 1 : 0;
      openRef.current += (openTarget - openRef.current) * 0.08;
      if (insideRef.current) {
        d.rotX += (-0.03 - d.rotX) * 0.08;
        d.rotY += (0 - d.rotY) * 0.08;
        camera.position.z += (6.2 - camera.position.z) * 0.08;
      }
      const loaded = loadedRef.current;
      if (loaded) {
        const a = (openRef.current * 68 * Math.PI) / 180;
        if (loaded.leftFlap) loaded.leftFlap.rotation.y = -a;
        if (loaded.rightFlap) loaded.rightFlap.rotation.y = a;
      }
      modelRoot.rotation.set(d.rotX, d.rotY, 0);
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
