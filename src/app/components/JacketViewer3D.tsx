import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import crestImage from "figma:asset/65260e3ff07725a684ad1d29eb3db00cb66a8976.png";

export interface BackDesign {
  /** Gold stars, 1–5, arranged on a centered arc. */
  stars: number;
  /** Main back number, "00"–"99". */
  backNumber: string;
  /** Up to 5 two-digit numbers that run down each sleeve. */
  sleeveNumbers: string[];
  city: string;
  /** Print color for text/numbers — black or white only. */
  printColor: string;
}

export type LeatherType = "Nappa" | "Cowhide";

// Fixed brand color — never user-configurable.
const BRAND_GOLD = "#c9a24a";

interface JacketViewer3DProps {
  bodyColor: string;
  sleeveColor: string;
  leatherType: LeatherType;
  trimColor: string;
  snapColor: string;
  pocketColor: string;
  liningColor: string;
  /** Shoulder yoke pieces; pass the body color for "no inserts". */
  insertColor: string;
  backDesign: BackDesign;
}

type PartMaterials = {
  body: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  snap: THREE.MeshPhysicalMaterial;
  lining: THREE.MeshStandardMaterial;
};

/** Canvases used to re-tint the baked texture per pixel on color changes. */
type RecolorKit = {
  detail: HTMLCanvasElement;
  masks: Record<"body" | "sleeve" | "pocket" | "insert" | "trim", HTMLCanvasElement>;
  tmp: HTMLCanvasElement;
  composite: HTMLCanvasElement;
  design: HTMLCanvasElement;
  sleeveDesign: HTMLCanvasElement;
  back: BackDesign | null;
  texture: THREE.CanvasTexture;
};

type JacketParts = {
  materials: PartMaterials;
  kit: RecolorKit;
};

type ViewerState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  modelRoot: THREE.Group;
  parts: JacketParts | null;
  frameId: number;
};

const MODEL_PATH = "/models/letterman_jacket.glb";

// Triangle classes inside the jacket mesh
const CLASS_BODY = 0;
const CLASS_SLEEVE = 1;
const CLASS_TRIM = 2;

// UV rect of the (hidden) chest letter patch, whose imprint is baked into
// the base color, occlusion/roughness, and normal textures. It gets covered
// by cloning clean fabric from the same panel, offset left of the placket.
const PATCH_RECT = { u0: 0.26, v0: 0.2, u1: 0.43, v1: 0.41 };
const PATCH_SOURCE_OFFSET_U = -0.21;

/**
 * Clone-stamp clean fabric over the patch imprint: copy an equally sized
 * region of plain fabric from the same panel and paste it over the patch
 * rect with feathered edges so the grain stays continuous. With `matchTone`
 * the clone's brightness is offset to the destination's surroundings, since
 * the panel carries a subtle lighting gradient.
 */
function clonePatchRegion(ctx: CanvasRenderingContext2D, matchTone = false) {
  const { width, height } = ctx.canvas;
  const dx = Math.floor(PATCH_RECT.u0 * width);
  const dy = Math.floor(PATCH_RECT.v0 * height);
  const dw = Math.ceil((PATCH_RECT.u1 - PATCH_RECT.u0) * width);
  const dh = Math.ceil((PATCH_RECT.v1 - PATCH_RECT.v0) * height);
  const sx = dx + Math.round(PATCH_SOURCE_OFFSET_U * width);

  const patch = document.createElement("canvas");
  patch.width = dw;
  patch.height = dh;
  const patchCtx = patch.getContext("2d")!;
  patchCtx.drawImage(ctx.canvas, sx, dy, dw, dh, 0, 0, dw, dh);

  if (matchTone) {
    // Compare the clone against a ring just outside the destination rect
    // and shift its brightness by the difference.
    const ring = Math.max(4, Math.round(dw * 0.08));
    const ringData = ctx.getImageData(dx - ring, dy - ring, dw + ring * 2, dh + ring * 2);
    let ringSum = 0;
    let ringCount = 0;
    const rw = dw + ring * 2;
    const rh = dh + ring * 2;
    for (let y = 0; y < rh; y += 1) {
      for (let x = 0; x < rw; x += 1) {
        if (x >= ring && x < rw - ring && y >= ring && y < rh - ring) continue;
        ringSum += ringData.data[(y * rw + x) * 4];
        ringCount += 1;
      }
    }
    const patchData = patchCtx.getImageData(0, 0, dw, dh);
    let patchSum = 0;
    for (let i = 0; i < dw * dh; i += 1) patchSum += patchData.data[i * 4];
    const delta = ringSum / Math.max(ringCount, 1) - patchSum / (dw * dh);
    for (let i = 0; i < dw * dh; i += 1) {
      const value = Math.min(255, Math.max(0, patchData.data[i * 4] + delta));
      patchData.data[i * 4] = value;
      patchData.data[i * 4 + 1] = value;
      patchData.data[i * 4 + 2] = value;
    }
    patchCtx.putImageData(patchData, 0, 0);
  }

  const feather = Math.max(6, Math.round(dw * 0.14));
  patchCtx.globalCompositeOperation = "destination-in";
  const edges: Array<[number, number, number, number]> = [
    [0, 0, feather, 0], // left
    [dw, 0, dw - feather, 0], // right
    [0, 0, 0, feather], // top
    [0, dh, 0, dh - feather], // bottom
  ];
  for (const [x0, y0, x1, y1] of edges) {
    const gradient = patchCtx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,1)");
    patchCtx.fillStyle = gradient;
    patchCtx.fillRect(0, 0, dw, dh);
  }

  ctx.drawImage(patch, dx, dy);
}

// UV rects around the two welt pockets on the front body panel; light
// (leather-colored) texels inside them take the pocket color.
const POCKET_RECTS = [
  { u0: 0.05, v0: 0.07, u1: 0.2, v1: 0.17 },
  { u0: 0.31, v0: 0.07, u1: 0.45, v1: 0.17 },
];

// UV regions holding the knit trim pieces (collar arc + ribbed bands on the
// left, waistband/collar/cuff arcs along the bottom). Everything inside is
// trim — this follows the texture's island layout exactly, unlike the old
// geometric position rules that clipped jagged triangle spikes out of the
// body and sleeve panels.
const TRIM_RECTS = [
  { u0: 0, v0: 0.53, u1: 0.345, v1: 0.74 }, // ribbed knit bands
  { u0: 0, v0: 0.86, u1: 1, v1: 1 }, // waistband + collar/cuff arcs
];

// The two wool body panels (front, back). Inside them the only light
// material is the welt/placket leather, so classification can use a much
// stricter light threshold — washed-out fabric at the neckline seams stays
// wool instead of picking up the sleeve color.
const BODY_PANEL_RECTS = [
  { u0: 0, v0: 0, u1: 0.47, v1: 0.44 },
  { u0: 0.47, v0: 0, u1: 0.96, v1: 0.44 },
];

// The shoulder yoke pieces (including the clavicle wings) are scattered
// through the band between the body panels and the sleeve panels, plus the
// left-shoulder wedge island. Light texels here take the shoulder-insert
// color (the body color when "no inserts" is selected).
const YOKE_RECTS = [
  { u0: 0.2, v0: 0.4, u1: 0.96, v1: 0.492 },
  { u0: 0, v0: 0.44, u1: 0.2, v1: 0.53 }, // left wedge + inner collar facing
];

// Where the back design prints onto the back body panel in UV space. The
// panel is oriented upside down in the texture, so the design is drawn
// rotated 180° (see composeColorMap).
const BACK_DESIGN_RECT = { u0: 0.55, v0: 0.06, u1: 0.87, v1: 0.44 };

// The fixed gold chest badge, on the front-left chest. Kept below v0.40 so it
// doesn't bleed over the shoulder seam onto the back of the arm.
const FRONT_BADGE_RECT = { u0: 0.29, v0: 0.27, u1: 0.4, v1: 0.39 };

// Fixed "MANOIR KITS" chest text on the opposite (front-right) chest panel.
const FRONT_TEXT_RECT = { u0: 0.07, v0: 0.28, u1: 0.19, v1: 0.38 };
const CHEST_TEXT_FILL = "#f2ede2";

// A narrow UV strip down the outer face of each sleeve where the sleeve
// numbers print, running shoulder → cuff. `flip` corrects the v direction
// for the mirrored sleeve island.
// v-range kept inside the sleeve tube; going higher bleeds onto the back
// yoke/shoulder, printing a stray number near the collar.
const SLEEVE_NUMBER_RECTS = [
  { u0: 0.185, v0: 0.52, u1: 0.285, v1: 0.82, flip: false }, // viewer-left sleeve
  { u0: 0.7, v0: 0.52, u1: 0.8, v1: 0.82, flip: true }, // viewer-right sleeve
];

export function JacketViewer3D({
  bodyColor,
  sleeveColor,
  leatherType,
  trimColor,
  snapColor,
  pocketColor,
  liningColor,
  insertColor,
  backDesign,
}: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ViewerState | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.05, rotX: -0.04 });
  const colorsRef = useRef({ bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor, insertColor });
  const designRef = useRef(backDesign);
  const leatherTypeRef = useRef(leatherType);

  useEffect(() => {
    leatherTypeRef.current = leatherType;
    const state = sceneRef.current;
    if (!state?.parts) return;
    applyLeatherType(state.parts.materials, leatherType);
  }, [leatherType]);

  useEffect(() => {
    colorsRef.current = { bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor, insertColor };
    const state = sceneRef.current;
    if (!state?.parts) return;
    applyColors(state.parts, colorsRef.current);
  }, [bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor, insertColor]);

  useEffect(() => {
    designRef.current = backDesign;
    const parts = sceneRef.current?.parts;
    if (!parts) return;
    let cancelled = false;
    void loadCrest().then(() => {
      if (cancelled) return;
      parts.kit.back = designRef.current;
      composeColorMap(parts.kit, colorsRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [backDesign]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tone mapping + a soft studio environment give the leather and
    // metal realistic highlights instead of a flat, cartoonish look.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(26, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, -0.02, 6.6);

    scene.add(new THREE.HemisphereLight("#ffffff", "#9aa6b4", 0.3));

    // Warm key from upper right, cool fill from left, soft rim from behind.
    const key = new THREE.DirectionalLight("#fff4e6", 1.5);
    key.position.set(2.6, 4, 3.4);
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dceaff", 0.6);
    fill.position.set(-3.2, 1.6, 2.4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight("#ffffff", 0.85);
    rim.position.set(-0.6, 2.8, -3.6);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.set(dragRef.current.rotX, dragRef.current.rotY, 0);
    scene.add(modelRoot);

    const placeholder = buildLoadingSilhouette();
    modelRoot.add(placeholder);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 64),
      new THREE.MeshBasicMaterial({ color: "#97a5b2", transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.6, 0.42, 1);
    shadow.position.set(0, -1.18, 0.15);
    scene.add(shadow);

    let disposed = false;
    new GLTFLoader().load(
      MODEL_PATH,
      (gltf) => {
        if (disposed) return;
        try {
          const parts = prepareJacket(gltf.scene, colorsRef.current);
          applyLeatherType(parts.materials, leatherTypeRef.current);
          frameModel(gltf.scene);
          modelRoot.remove(placeholder);
          disposeObject(placeholder);
          modelRoot.add(gltf.scene);

          void loadCrest().then((crest) => {
            if (disposed) return;
            // Build the inside badge against the axis-aligned model, then
            // let the animation loop restore the current rotation.
            modelRoot.rotation.set(0, 0, 0);
            modelRoot.updateMatrixWorld(true);
            modelRoot.add(buildNeckTag(gltf.scene, crest));
            parts.kit.back = designRef.current;
            composeColorMap(parts.kit, colorsRef.current);
          });

          const state = sceneRef.current;
          if (state) state.parts = parts;
        } catch (error) {
          console.error("Failed to prepare jacket model", error);
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load jacket model", error);
      },
    );

    const onPointerDown = (event: PointerEvent) => {
      dragRef.current.active = true;
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      mount.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      drag.rotY += (event.clientX - drag.x) * 0.006;
      drag.rotX += (event.clientY - drag.y) * 0.004;
      drag.rotX = THREE.MathUtils.clamp(drag.rotX, -0.34, 0.26);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    const onWheel = (event: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.003, 4.5, 9.5);
    };

    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", onPointerUp);
    mount.addEventListener("pointercancel", onPointerUp);
    mount.addEventListener("wheel", onWheel, { passive: true });

    const onResize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    const animate = () => {
      const drag = dragRef.current;
      modelRoot.rotation.set(drag.rotX, drag.rotY, 0);
      renderer.render(scene, camera);
      const state = sceneRef.current;
      if (state) state.frameId = requestAnimationFrame(animate);
    };

    sceneRef.current = {
      renderer,
      scene,
      camera,
      modelRoot,
      parts: null,
      frameId: requestAnimationFrame(animate),
    };

    return () => {
      disposed = true;
      const state = sceneRef.current;
      if (state) cancelAnimationFrame(state.frameId);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("pointercancel", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      disposeObject(scene);
      envTexture.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}

type JacketColors = {
  bodyColor: string;
  sleeveColor: string;
  trimColor: string;
  snapColor: string;
  pocketColor: string;
  liningColor: string;
  insertColor: string;
};

/**
 * Nappa is a soft, lightly satin leather; cowhide is grainier and matte.
 * Both kept low-gloss with a soft, wide highlight so they read as real
 * leather rather than shiny plastic.
 */
function applyLeatherType(materials: PartMaterials, type: LeatherType) {
  const sleeve = materials.sleeve;
  if (type === "Nappa") {
    sleeve.roughness = 0.66;
    sleeve.clearcoat = 0.1;
    sleeve.clearcoatRoughness = 0.75;
    sleeve.envMapIntensity = 0.22;
    sleeve.normalScale.set(0.8, 0.8);
  } else {
    sleeve.roughness = 0.84;
    sleeve.clearcoat = 0;
    sleeve.clearcoatRoughness = 0.85;
    sleeve.envMapIntensity = 0.14;
    sleeve.normalScale.set(1.3, 1.3);
  }
  sleeve.needsUpdate = true;
}

function applyColors(parts: JacketParts, colors: JacketColors) {
  composeColorMap(parts.kit, colors);
  parts.materials.snap.color.set(colors.snapColor);
  parts.materials.lining.color.set(colors.liningColor);
}

/**
 * The GLB bakes body/sleeve colors into one texture, so recoloring works per
 * pixel in texture space: every texel is classified by chroma (maroon = wool
 * body, neutral = leather), ribbed-trim triangles are rasterized into a mask
 * from their UVs, pocket welts are the light texels inside known UV rects,
 * and color changes composite a fresh tinted map from a luminance-neutralized
 * detail copy of the base color. Boundaries follow the real garment seams
 * instead of triangle edges.
 */
function prepareJacket(root: THREE.Group, colors: JacketColors): JacketParts {
  root.updateMatrixWorld(true);

  let jacketMesh: THREE.Mesh | null = null;
  let buttonMesh: THREE.Mesh | null = null;
  let patchMesh: THREE.Mesh | null = null;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const key = `${node.name} ${node.parent?.name ?? ""}`.toLowerCase();
    if (key.includes("patch")) patchMesh = node;
    else if (key.includes("button")) buttonMesh = node;
    else jacketMesh = node;
  });
  if (!jacketMesh) throw new Error("jacket mesh not found in GLB");

  if (patchMesh) (patchMesh as THREE.Mesh).visible = false;

  const source = (Array.isArray(jacketMesh.material) ? jacketMesh.material[0] : jacketMesh.material) as THREE.MeshStandardMaterial;
  const baseImage = source.map?.image as CanvasImageSource & { width: number; height: number };
  if (!baseImage) throw new Error("base color texture missing");

  const neutral = neutralizeBaseColor(baseImage);
  const cleanedPBR = cleanImprintTexture(source.roughnessMap);
  const cleanedNormal = cleanImprintTexture(source.normalMap);

  const trimTriangleUVs = segmentJacketGeometry(jacketMesh, neutral.isLightTexel);
  const kit = buildRecolorKit(neutral, trimTriangleUVs);
  composeColorMap(kit, colors);

  // Outer shell renders front faces only; a back-face copy of the same
  // geometry shows the inside lining color through the collar and openings.
  const shared = {
    map: kit.texture,
    color: "#ffffff",
    normalMap: cleanedNormal,
    roughnessMap: cleanedPBR,
    metalnessMap: cleanedPBR,
    aoMap: cleanedPBR,
    metalness: 0,
    side: THREE.FrontSide as THREE.Side,
  };

  const materials: PartMaterials = {
    // Wool body: matte with a faint fabric sheen. Env/sheen kept very low so
    // dark wools stay genuinely dark instead of lifting to grey.
    body: new THREE.MeshPhysicalMaterial({
      ...shared,
      roughness: 0.97,
      sheen: 0.16,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color("#8a8a8a"),
      envMapIntensity: 0.06,
    }),
    // Leather sleeves: soft matte leather, not glossy plastic (see applyLeatherType).
    sleeve: new THREE.MeshPhysicalMaterial({
      ...shared,
      roughness: 0.66,
      clearcoat: 0.1,
      clearcoatRoughness: 0.75,
      envMapIntensity: 0.22,
    }),
    // Ribbed knit trim: fully matte.
    trim: new THREE.MeshPhysicalMaterial({
      ...shared,
      roughness: 0.95,
      sheen: 0.2,
      sheenRoughness: 0.95,
      envMapIntensity: 0.15,
    }),
    // Metal snaps: soft brushed metal, not mirror.
    snap: new THREE.MeshPhysicalMaterial({
      color: colors.snapColor,
      normalMap: cleanedNormal,
      roughness: 0.45,
      metalness: 0.75,
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
    }),
    // Quilted lining, seen through the neck opening.
    lining: new THREE.MeshStandardMaterial({
      color: colors.liningColor,
      roughness: 0.82,
      envMapIntensity: 0.35,
      side: THREE.BackSide,
    }),
  };

  // Sleeves render both sides so the open cuff shows leather inside instead
  // of a black hole through to the lining.
  materials.sleeve.side = THREE.DoubleSide;
  materials.trim.side = THREE.DoubleSide;

  (jacketMesh as THREE.Mesh).material = [materials.body, materials.sleeve, materials.trim];
  if (buttonMesh) (buttonMesh as THREE.Mesh).material = materials.snap;

  const liningShell = new THREE.Mesh((jacketMesh as THREE.Mesh).geometry, [
    materials.lining,
    materials.lining,
    materials.lining,
  ]);
  // Inset slightly so the black lining sits just inside the outer shell and
  // doesn't z-fight into a jagged rim at the collar/neck opening.
  liningShell.scale.setScalar(0.985);
  (jacketMesh as THREE.Mesh).add(liningShell);

  // Bring the arms down out of the T-pose into a relaxed varsity stance.
  poseArms((jacketMesh as THREE.Mesh).geometry, ARM_POSE_DEG);

  if (import.meta.env.DEV) (window as any).__kit = kit;
  return { materials, kit };
}

// How far to lower each arm from the model's default T-pose.
const ARM_POSE_DEG = 34;

/**
 * Rotates the sleeve vertices down around each shoulder to relax the T-pose.
 * The rotation angle ramps from 0 at the shoulder to full across a transition
 * band so the shoulder bends smoothly instead of tearing. Operates on the
 * shared geometry, so the lining shell follows.
 */
function poseArms(geometry: THREE.BufferGeometry, degrees: number) {
  const pos = geometry.getAttribute("position");
  if (!pos) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const width = bb.max.x - bb.min.x;
  const halfBody = 0.19 * width; // torso half-width; sleeves lie beyond this
  const shoulderY = bb.max.y - 0.16 * (bb.max.y - bb.min.y);
  const transStart = halfBody * 0.85;
  const transEnd = halfBody * 1.3;
  const theta = (degrees * Math.PI) / 180;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const d = Math.abs(x - cx);
    if (d < transStart) continue; // torso — unchanged
    const t = Math.min(1, (d - transStart) / (transEnd - transStart));
    const side = x > cx ? 1 : -1;
    const px = cx + side * halfBody;
    const py = shoulderY;
    const a = (side > 0 ? -theta : theta) * t; // rotate each arm downward
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const dx = x - px;
    const dy = pos.getY(i) - py;
    pos.setX(i, px + dx * ca - dy * sa);
    pos.setY(i, py + dx * sa + dy * ca);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** 5x5 majority filter over a binary mask, using a summed-area table. */
function despeckle(mask: Uint8Array, width: number, height: number) {
  const sat = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += mask[y * width + x];
      sat[(y + 1) * (width + 1) + (x + 1)] = sat[y * (width + 1) + (x + 1)] + rowSum;
    }
  }
  const radius = 2;
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const count =
        sat[(y1 + 1) * (width + 1) + (x1 + 1)] -
        sat[y0 * (width + 1) + (x1 + 1)] -
        sat[(y1 + 1) * (width + 1) + x0] +
        sat[y0 * (width + 1) + x0];
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      mask[y * width + x] = count * 2 > area ? 1 : 0;
    }
  }
}

function inTrimRect(u: number, v: number) {
  return TRIM_RECTS.some((r) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1);
}

/**
 * Split the jacket mesh index into body / sleeve / trim groups (the groups
 * carry material properties: wool vs leather vs knit). Trim requires BOTH a
 * geometric match (collar / waistband / cuff position) and UVs inside the
 * knit texture islands: geometry alone paints spikes into the panels, and
 * UV rects alone catch the sleeve-cap pieces stored between the knit
 * islands. Returns the trim triangles' UVs for mask rasterization.
 */
function segmentJacketGeometry(mesh: THREE.Mesh, isLightTexel: (u: number, v: number) => boolean) {
  const geometry = mesh.geometry;
  const index = geometry.getIndex();
  const uv = geometry.getAttribute("uv");
  const position = geometry.getAttribute("position");
  if (!index || !uv || !position) throw new Error("jacket geometry missing attributes");

  const bounds = new THREE.Box3().setFromObject(mesh);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  const triCount = index.count / 3;
  const classes = new Uint8Array(triCount);
  const point = new THREE.Vector3();
  const trimTriangleUVs: number[] = [];

  for (let t = 0; t < triCount; t += 1) {
    const a = index.getX(t * 3);
    const b = index.getX(t * 3 + 1);
    const c = index.getX(t * 3 + 2);

    const centroidU = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
    const centroidV = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    let lightVotes = isLightTexel(centroidU, centroidV) ? 2 : 0;
    for (const vertex of [a, b, c]) {
      if (isLightTexel(uv.getX(vertex), uv.getY(vertex))) lightVotes += 1;
    }

    point
      .set(
        (position.getX(a) + position.getX(b) + position.getX(c)) / 3,
        (position.getY(a) + position.getY(b) + position.getY(c)) / 3,
        (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3,
      )
      .applyMatrix4(mesh.matrixWorld);

    const ny = size.y ? (point.y - bounds.min.y) / size.y : 0.5;
    const nx = size.x ? Math.abs(point.x - center.x) / (size.x / 2) : 0;
    const geometricTrim =
      (ny < 0.12 && nx < 0.55) || // waistband
      (ny > 0.88 && nx < 0.32) || // collar
      nx > 0.82; // cuffs

    if (geometricTrim && inTrimRect(centroidU, centroidV)) {
      classes[t] = CLASS_TRIM;
      trimTriangleUVs.push(uv.getX(a), uv.getY(a), uv.getX(b), uv.getY(b), uv.getX(c), uv.getY(c));
    } else if (lightVotes >= 3) {
      classes[t] = CLASS_SLEEVE;
    } else {
      classes[t] = CLASS_BODY;
    }
  }

  const sorted = new Uint32Array(index.count);
  let offset = 0;
  geometry.clearGroups();
  for (const cls of [CLASS_BODY, CLASS_SLEEVE, CLASS_TRIM]) {
    const start = offset;
    for (let t = 0; t < triCount; t += 1) {
      if (classes[t] !== cls) continue;
      sorted[offset] = index.getX(t * 3);
      sorted[offset + 1] = index.getX(t * 3 + 1);
      sorted[offset + 2] = index.getX(t * 3 + 2);
      offset += 3;
    }
    geometry.addGroup(start, offset - start, cls);
  }
  geometry.setIndex(new THREE.BufferAttribute(sorted, 1));

  return trimTriangleUVs;
}

type NeutralizedBase = {
  canvas: HTMLCanvasElement;
  light: Uint8Array;
  width: number;
  height: number;
  isLightTexel: (u: number, v: number) => boolean;
};

/**
 * Turn the baked base color into a grayscale detail map: each pixel's
 * luminance divided by the mean of its region (light vs dark) so a tint can
 * be multiplied on top while keeping stitches, seams, and fold shading.
 */
function neutralizeBaseColor(image: CanvasImageSource & { width: number; height: number }): NeutralizedBase {
  const width = Math.min(image.width, 2048);
  const height = Math.min(image.height, 2048);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // The body/trim fabric is maroon (strong red dominance) while the sleeve
  // leather is near-neutral white/gray, so chroma separates the regions far
  // more reliably than luminance (shadowed sleeve areas are dark but neutral).
  let lightSum = 0;
  let lightCount = 0;
  let darkSum = 0;
  let darkCount = 0;
  const luminance = new Float32Array(width * height);
  const light = new Uint8Array(width * height);

  const inRects = (rects: typeof BODY_PANEL_RECTS, x: number, y: number) => {
    const u = x / width;
    const v = y / height;
    return rects.some((r) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1);
  };

  for (let i = 0; i < width * height; i += 1) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    luminance[i] = lum;
    const redDominance = data[i * 4] - data[i * 4 + 2];
    const x = i % width;
    const y = Math.floor(i / width);
    // Strict threshold inside the wool panels (washed-out seam fabric stays
    // wool), except around the welt pockets, which really are leather.
    const threshold = inRects(BODY_PANEL_RECTS, x, y) && !inRects(POCKET_RECTS, x, y) ? 12 : 28;
    if (redDominance < threshold) {
      light[i] = 1;
      lightSum += lum;
      lightCount += 1;
    } else {
      darkSum += lum;
      darkCount += 1;
    }
  }

  const lightMean = lightCount ? lightSum / lightCount : 255;
  const darkMean = darkCount ? darkSum / darkCount : 1;

  // Majority-filter the light/dark classification: stray highlight texels
  // inside the wool otherwise render as speckles of sleeve color (and vice
  // versa on the leather).
  despeckle(light, width, height);

  for (let i = 0; i < width * height; i += 1) {
    const mean = light[i] ? lightMean : darkMean;
    // Wool texels are capped tighter: the bake washes out near seams, and
    // uncapped bright texels halo when tinted with a dark body color.
    const cap = light[i] ? 255 : 222;
    const value = Math.min(cap, Math.max(90, (luminance[i] / mean) * 205));
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  // Erase the letter-patch shadow baked into the chest area (the patch mesh
  // itself is hidden) by cloning clean fabric over it. Tone-matched because
  // the panel has a subtle lighting gradient between source and chest.
  clonePatchRegion(ctx, true);

  const isLightTexel = (u: number, v: number) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor((v % 1 + 1) % 1 * height)));
    return light[y * width + x] === 1;
  };

  return { canvas, light, width, height, isLightTexel };
}

/** Build the per-region alpha masks and working canvases for recoloring. */
function buildRecolorKit(neutral: NeutralizedBase, trimTriangleUVs: number[]): RecolorKit {
  const { width, height, light } = neutral;

  const inPocketRect = (x: number, y: number) => {
    const u = x / width;
    const v = y / height;
    return POCKET_RECTS.some((r) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1);
  };

  const makeMask = (test: (i: number, x: number, y: number) => boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        imageData.data[i * 4 + 3] = test(i, x, y) ? 255 : 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  // Blur the binary classification slightly so region boundaries composite
  // with anti-aliased edges instead of hard texel staircases. The body layer
  // is fully opaque underneath, so blended seam texels mix body and sleeve
  // color exactly.
  const soften = (mask: HTMLCanvasElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.filter = "blur(1.5px)";
    ctx.drawImage(mask, 0, 0);
    ctx.filter = "none";
    return canvas;
  };

  const inYokeRect = (x: number, y: number) => {
    const u = x / width;
    const v = y / height;
    return YOKE_RECTS.some((r) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1);
  };

  const sleeve = soften(makeMask((i) => light[i] === 1));
  const pocket = soften(makeMask((i, x, y) => light[i] === 1 && inPocketRect(x, y)));
  // Light texels only: the band also clips edge pixels of the body panels
  // and collar, which must keep their own region colors.
  const insert = soften(makeMask((i, x, y) => light[i] === 1 && inYokeRect(x, y)));
  const body = document.createElement("canvas");
  body.width = width;
  body.height = height;
  const bodyCtx = body.getContext("2d")!;
  bodyCtx.fillStyle = "#ffffff";
  bodyCtx.fillRect(0, 0, width, height);

  // Trim mask: rasterized trim triangles intersected with the knit UV
  // rects — the same two-filter rule as the triangle classification, so the
  // sleeve-cap pieces stored between the knit islands stay sleeve-colored.
  const trim = document.createElement("canvas");
  trim.width = width;
  trim.height = height;
  const trimCtx = trim.getContext("2d")!;
  trimCtx.fillStyle = "#ffffff";
  trimCtx.strokeStyle = "#ffffff";
  trimCtx.lineWidth = 2;
  for (let i = 0; i < trimTriangleUVs.length; i += 6) {
    trimCtx.beginPath();
    trimCtx.moveTo(trimTriangleUVs[i] * width, trimTriangleUVs[i + 1] * height);
    trimCtx.lineTo(trimTriangleUVs[i + 2] * width, trimTriangleUVs[i + 3] * height);
    trimCtx.lineTo(trimTriangleUVs[i + 4] * width, trimTriangleUVs[i + 5] * height);
    trimCtx.closePath();
    trimCtx.fill();
    trimCtx.stroke();
  }
  trimCtx.globalCompositeOperation = "destination-in";
  trimCtx.beginPath();
  for (const r of TRIM_RECTS) {
    trimCtx.rect(r.u0 * width, r.v0 * height, (r.u1 - r.u0) * width, (r.v1 - r.v0) * height);
  }
  trimCtx.fill();
  trimCtx.globalCompositeOperation = "source-over";

  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const composite = document.createElement("canvas");
  composite.width = width;
  composite.height = height;
  const design = document.createElement("canvas");
  design.width = 512;
  design.height = 696;
  const sleeveDesign = document.createElement("canvas");
  sleeveDesign.width = 160;
  sleeveDesign.height = 680;

  const texture = new THREE.CanvasTexture(composite);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;

  return {
    detail: neutral.canvas,
    masks: { body, sleeve, pocket, insert, trim },
    tmp,
    composite,
    design,
    sleeveDesign,
    back: null,
    texture,
  };
}

let chestWordmarkCanvas: HTMLCanvasElement | null = null;

/** Cached "MANOIR / KITS" chest wordmark, drawn upright (chenille style). */
function chestWordmark(): HTMLCanvasElement {
  if (chestWordmarkCanvas) return chestWordmarkCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 220;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  arcedText(ctx, "MANOIR", canvas.width / 2, canvas.height / 2 + 230, 260, 46, CHEST_TEXT_FILL);
  arcedText(ctx, "KITS", canvas.width / 2, canvas.height / 2 + 230 + 58, 260, 46, CHEST_TEXT_FILL);
  chestWordmarkCanvas = canvas;
  return canvas;
}

/** Re-tint the detail map region by region into the composite color map. */
function composeColorMap(kit: RecolorKit, colors: JacketColors) {
  const { width, height } = kit.composite;
  const compositeCtx = kit.composite.getContext("2d")!;
  const tmpCtx = kit.tmp.getContext("2d")!;
  compositeCtx.clearRect(0, 0, width, height);

  const layers: Array<[HTMLCanvasElement, string]> = [
    [kit.masks.body, colors.bodyColor],
    [kit.masks.sleeve, colors.sleeveColor],
    [kit.masks.pocket, colors.pocketColor],
    [kit.masks.insert, colors.insertColor],
    [kit.masks.trim, colors.trimColor],
  ];

  for (const [mask, color] of layers) {
    tmpCtx.globalCompositeOperation = "source-over";
    tmpCtx.clearRect(0, 0, width, height);
    tmpCtx.drawImage(kit.detail, 0, 0);
    tmpCtx.globalCompositeOperation = "multiply";
    tmpCtx.fillStyle = color;
    tmpCtx.fillRect(0, 0, width, height);
    tmpCtx.globalCompositeOperation = "destination-in";
    tmpCtx.drawImage(mask, 0, 0);
    compositeCtx.drawImage(kit.tmp, 0, 0);
  }

  // Redraw the printed artwork in the chosen print color (black or white);
  // gold stars are unaffected.
  if (kit.back) {
    drawBackDesign(kit.design, kit.back, kit.back.printColor);
    drawSleeveNumbers(kit.sleeveDesign, kit.back.sleeveNumbers, kit.back.printColor);
  }

  // Print the back design onto the back body panel. The panel is flipped
  // vertically in the texture, so the design is drawn flipped to match.
  const dx0 = BACK_DESIGN_RECT.u0 * width;
  const dy0 = BACK_DESIGN_RECT.v0 * height;
  const dw = (BACK_DESIGN_RECT.u1 - BACK_DESIGN_RECT.u0) * width;
  const dh = (BACK_DESIGN_RECT.v1 - BACK_DESIGN_RECT.v0) * height;
  compositeCtx.save();
  compositeCtx.translate(dx0 + dw / 2, dy0 + dh / 2);
  compositeCtx.scale(1, -1);
  compositeCtx.drawImage(kit.design, -dw / 2, -dh / 2, dw, dh);
  compositeCtx.restore();

  // Fixed gold chest badge on the front-left chest panel. The front panel is
  // vertically mirrored in UV, so the badge is blitted flipped (upright).
  if (crestElement) {
    const badgeW = (FRONT_BADGE_RECT.u1 - FRONT_BADGE_RECT.u0) * width;
    const badgeH = badgeW * (crestElement.height / crestElement.width);
    const bcx = ((FRONT_BADGE_RECT.u0 + FRONT_BADGE_RECT.u1) / 2) * width;
    const bcy = ((FRONT_BADGE_RECT.v0 + FRONT_BADGE_RECT.v1) / 2) * height;
    compositeCtx.save();
    compositeCtx.translate(bcx, bcy);
    compositeCtx.scale(1, -1);
    compositeCtx.drawImage(crestElement, -badgeW / 2, -badgeH / 2, badgeW, badgeH);
    compositeCtx.restore();
  }

  // Fixed "MANOIR KITS" wordmark on the opposite chest — MANOIR arched over
  // KITS, white fill with a gold outline. The panel is vertically mirrored in
  // UV, so it's drawn upright then blitted flipped (same as the back print).
  {
    const rx = FRONT_TEXT_RECT.u0 * width;
    const ry = FRONT_TEXT_RECT.v0 * height;
    const rw = (FRONT_TEXT_RECT.u1 - FRONT_TEXT_RECT.u0) * width;
    const rh = (FRONT_TEXT_RECT.v1 - FRONT_TEXT_RECT.v0) * height;
    const chest = chestWordmark();
    compositeCtx.save();
    compositeCtx.translate(rx + rw / 2, ry + rh / 2);
    compositeCtx.scale(1, -1);
    compositeCtx.drawImage(chest, -rw / 2, -rh / 2, rw, rh);
    compositeCtx.restore();
  }

  // Sleeve numbers down each arm
  for (const r of SLEEVE_NUMBER_RECTS) {
    const sx0 = r.u0 * width;
    const sy0 = r.v0 * height;
    const sw = (r.u1 - r.u0) * width;
    const sh = (r.v1 - r.v0) * height;
    compositeCtx.save();
    compositeCtx.translate(sx0 + sw / 2, sy0 + sh / 2);
    compositeCtx.scale(1, r.flip ? -1 : 1);
    compositeCtx.drawImage(kit.sleeveDesign, -sw / 2, -sh / 2, sw, sh);
    compositeCtx.restore();
  }

  kit.texture.needsUpdate = true;
}

/**
 * The chest patch's imprint is also baked into the occlusion/roughness
 * texture and embossed in the normal map. Clone clean fabric over the patch
 * rect in each so no trace of the removed patch remains.
 */
function cleanImprintTexture(sourceTexture: THREE.Texture | null): THREE.Texture | null {
  const image = sourceTexture?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!sourceTexture || !image) return sourceTexture ?? null;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  clonePatchRegion(ctx);

  return canvasTextureLike(canvas, sourceTexture);
}

function canvasTextureLike(canvas: HTMLCanvasElement, sourceTexture: THREE.Texture) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.channel = sourceTexture.channel;
  texture.anisotropy = 8;
  return texture;
}

let crestElement: HTMLCanvasElement | null = null;
let crestLoading: Promise<HTMLCanvasElement | null> | null = null;

/**
 * Load the brand crest, crop it to the actual artwork, and knock out its
 * background. The source PNG is a wide strip with the gold crest small in
 * the middle on an opaque near-white background, so cropping and keying are
 * done by "not near-white" content rather than alpha.
 */
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
          // near-white background → transparent, artwork → opaque
          const alpha = Math.min(255, Math.max(0, Math.round((242 - lum) * 6)));
          data[i + 3] = Math.min(data[i + 3], alpha);
          if (alpha < 32) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX <= minX || maxY <= minY) {
        resolve(null);
        return;
      }
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

/**
 * Draws varsity chenille lettering: a colored fill with a gold outline,
 * exactly like the embroidered patches on the real jacket.
 */
function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, fill: string, maxWidth?: number) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = BRAND_GOLD;
  ctx.lineWidth = Math.max(3, fontSize * 0.13);
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y, maxWidth);
}

/** Lays outlined characters along an upward arc centered on `cx`. */
function arcedText(ctx: CanvasRenderingContext2D, text: string, cx: number, centerY: number, radius: number, fontSize: number, fill: string) {
  ctx.font = `800 ${fontSize}px 'League Spartan', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width * 1.02);
  const totalAngle = widths.reduce((sum, wch) => sum + wch / radius, 0);
  let angle = -totalAngle / 2;
  for (let i = 0; i < chars.length; i += 1) {
    const charAngle = angle + widths[i] / radius / 2;
    const x = cx + radius * Math.sin(charAngle);
    const y = centerY - radius * Math.cos(charAngle);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(charAngle);
    outlinedText(ctx, chars[i], 0, 0, fontSize, fill);
    ctx.restore();
    angle += widths[i] / radius;
  }
}

/**
 * Draws the back print onto a 512×696 canvas, top to bottom:
 * gold stars on an arc → arched city → large main number → "EST. 2026".
 */
function drawBackDesign(canvas: HTMLCanvasElement, design: BackDesign, textColor: string) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Gold stars on a wide centered arc near the top; each tilts to follow it.
  const stars = Math.max(0, Math.min(5, design.stars));
  const starArc = 320;
  const starCenterY = 44 + starArc;
  const stepDeg = 15;
  for (let i = 0; i < stars; i += 1) {
    const a = ((i - (stars - 1) / 2) * stepDeg * Math.PI) / 180;
    const x = w / 2 + starArc * Math.sin(a);
    const y = starCenterY - starArc * Math.cos(a);
    drawStar(ctx, x, y, 27, BRAND_GOLD, a);
  }

  // City — flat, centered, wide, under the stars
  const city = design.city.trim().toUpperCase();
  if (city) {
    const fontSize = city.length > 9 ? 64 : 76;
    ctx.font = `800 ${fontSize}px 'League Spartan', sans-serif`;
    outlinedText(ctx, city, w / 2, 205, fontSize, textColor, w * 0.9);
  }

  // Main number, very large and centered
  const number = design.backNumber.trim();
  if (number) {
    ctx.font = "800 280px 'League Spartan', sans-serif";
    outlinedText(ctx, number, w / 2, 420, 280, textColor, w * 0.9);
  }

  // "EST. 2026" larger, fixed at the bottom
  ctx.font = "800 58px 'League Spartan', sans-serif";
  outlinedText(ctx, "EST. 2026", w / 2, 638, 58, textColor);
}

/** Draws a stack of gold-outlined sleeve numbers running down a column. */
function drawSleeveNumbers(canvas: HTMLCanvasElement, numbers: string[], textColor: string) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const values = numbers.map((n) => n.trim()).filter(Boolean).slice(0, 5);
  if (!values.length) return;
  const fontSize = 104;
  ctx.font = `800 ${fontSize}px 'League Spartan', sans-serif`;
  const top = h * 0.09;
  const span = h * 0.82;
  values.forEach((value, i) => {
    const y = values.length === 1 ? h * 0.5 : top + (span / (values.length - 1)) * i;
    outlinedText(ctx, value, w / 2, y, fontSize, textColor);
  });
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

function frameModel(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;

  model.position.sub(center);
  model.scale.setScalar(1.9 / maxDimension);
  model.position.multiplyScalar(1.9 / maxDimension);
  model.position.y -= 0.12;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The fixed "One of One · Legend's Edition" inside badge (per the real
 * jacket): a gold-bordered black patch carrying MANOIR KITS, the MK crest,
 * and ONE OF ONE / LEGEND'S EDITION, tucked against the inside back of the
 * collar and visible through the neck opening. Parented to the rotating root.
 */
function buildNeckTag(model: THREE.Object3D, crest: HTMLCanvasElement | null): THREE.Mesh {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.fillStyle = "#111111";
  roundRect(ctx, 6, 6, cw - 12, ch - 12, 14);
  ctx.fill();
  ctx.strokeStyle = BRAND_GOLD;
  ctx.lineWidth = 7;
  roundRect(ctx, 18, 18, cw - 36, ch - 36, 10);
  ctx.stroke();

  ctx.fillStyle = BRAND_GOLD;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 44px 'League Spartan', sans-serif";
  ctx.fillText("MANOIR KITS", cw / 2, 74);

  if (crest) {
    const crestW = 150;
    const crestH = crestW * (crest.height / crest.width);
    ctx.drawImage(crest, cw / 2 - crestW / 2, ch / 2 - crestH / 2 - 6, crestW, crestH);
  }

  ctx.font = "800 46px 'League Spartan', sans-serif";
  ctx.fillText("ONE OF ONE", cw / 2, ch - 96);
  ctx.font = "700 30px 'League Spartan', sans-serif";
  ctx.fillText("LEGEND'S EDITION", cw / 2, ch - 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const w = size.x * 0.2;
  const h = w * (ch / cw);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  // Tuck it low inside the neck, angled up toward a viewer looking in, and
  // facing forward only so it never shows through the back of the collar.
  mesh.position.set(center.x, box.max.y - h * 0.95, box.min.z + size.z * 0.46);
  mesh.rotation.x = -0.5;
  mesh.renderOrder = 2;
  return mesh;
}

function buildLoadingSilhouette() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#d8d3c8", roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.6, 0.18), material);
  group.add(body);

  const leftSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.25, 12, 24), material);
  leftSleeve.position.set(-0.72, -0.04, 0);
  leftSleeve.rotation.z = -0.35;
  group.add(leftSleeve);

  const rightSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.25, 12, 24), material);
  rightSleeve.position.set(0.72, -0.04, 0);
  rightSleeve.rotation.z = 0.35;
  group.add(rightSleeve);
  group.position.y = -0.08;
  return group;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    disposeMaterial(node.material);
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => {
    Object.values(item).forEach((value) => {
      if (value instanceof THREE.Texture) value.dispose();
    });
    item.dispose();
  });
}
