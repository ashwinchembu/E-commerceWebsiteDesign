import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import crestImage from "figma:asset/65260e3ff07725a684ad1d29eb3db00cb66a8976.png";

export interface BackDesign {
  stars: number;
  numbers: string[];
  name: string;
  city: string;
  color: string;
}

interface JacketViewer3DProps {
  bodyColor: string;
  sleeveColor: string;
  trimColor: string;
  snapColor: string;
  pocketColor: string;
  liningColor: string;
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
  masks: Record<"body" | "sleeve" | "pocket" | "trim", HTMLCanvasElement>;
  tmp: HTMLCanvasElement;
  composite: HTMLCanvasElement;
  design: HTMLCanvasElement;
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
// the base color, occlusion/roughness, and normal textures.
const PATCH_RECT = { u0: 0.26, v0: 0.2, u1: 0.43, v1: 0.41 };

// UV rects around the two welt pockets on the front body panel; light
// (leather-colored) texels inside them take the pocket color.
const POCKET_RECTS = [
  { u0: 0.05, v0: 0.07, u1: 0.2, v1: 0.17 },
  { u0: 0.31, v0: 0.07, u1: 0.45, v1: 0.17 },
];

// Where the back design prints onto the back body panel in UV space. The
// design is drawn straight into the composited texture so it sits on the
// fabric and follows the garment when rotated.
const BACK_DESIGN_RECT = { u0: 0.55, v0: 0.06, u1: 0.87, v1: 0.44 };
const BACK_DESIGN_MIRRORED = false;

export function JacketViewer3D({
  bodyColor,
  sleeveColor,
  trimColor,
  snapColor,
  pocketColor,
  liningColor,
  backDesign,
}: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ViewerState | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.05, rotX: -0.04 });
  const colorsRef = useRef({ bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor });
  const designRef = useRef(backDesign);

  useEffect(() => {
    colorsRef.current = { bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor };
    const state = sceneRef.current;
    if (!state?.parts) return;
    applyColors(state.parts, colorsRef.current);
  }, [bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor]);

  useEffect(() => {
    designRef.current = backDesign;
    const parts = sceneRef.current?.parts;
    if (!parts) return;
    let cancelled = false;
    void loadCrest().then((crest) => {
      if (cancelled) return;
      drawBackDesign(parts.kit.design, designRef.current, crest);
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
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(28, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, -0.02, 6.4);

    scene.add(new THREE.HemisphereLight("#ffffff", "#aab6c2", 1.5));

    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(2.4, 4, 3.2);
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dceaff", 1.1);
    fill.position.set(-3, 2, 2.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight("#ffffff", 1.2);
    rim.position.set(0, 2.6, -3.5);
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
          frameModel(gltf.scene);
          modelRoot.remove(placeholder);
          disposeObject(placeholder);
          modelRoot.add(gltf.scene);
          void loadCrest().then((crest) => {
            if (disposed) return;
            drawBackDesign(parts.kit.design, designRef.current, crest);
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
      if (!drag.active) {
        drag.rotY += (0.05 - drag.rotY) * 0.018;
        drag.rotX += (-0.04 - drag.rotX) * 0.018;
      }
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
};

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
  const cleanedPBR = cleanPatchImprint(source.roughnessMap);
  const cleanedNormal = cleanNormalImprint(source.normalMap);

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
    body: new THREE.MeshStandardMaterial({ ...shared, roughness: 0.92 }),
    sleeve: new THREE.MeshPhysicalMaterial({
      ...shared,
      roughness: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
    }),
    trim: new THREE.MeshStandardMaterial({ ...shared, roughness: 0.88 }),
    snap: new THREE.MeshPhysicalMaterial({
      color: colors.snapColor,
      normalMap: cleanedNormal,
      roughness: 0.35,
      metalness: 0.3,
      side: THREE.DoubleSide,
    }),
    lining: new THREE.MeshStandardMaterial({
      color: colors.liningColor,
      roughness: 0.78,
      side: THREE.BackSide,
    }),
  };

  (jacketMesh as THREE.Mesh).material = [materials.body, materials.sleeve, materials.trim];
  if (buttonMesh) (buttonMesh as THREE.Mesh).material = materials.snap;

  const liningShell = new THREE.Mesh((jacketMesh as THREE.Mesh).geometry, [
    materials.lining,
    materials.lining,
    materials.lining,
  ]);
  (jacketMesh as THREE.Mesh).add(liningShell);

  if (import.meta.env.DEV) (window as any).__kit = kit;
  return { materials, kit };
}

/**
 * Split the jacket mesh index into body / sleeve / trim groups (the groups
 * carry material properties: wool vs leather vs knit). Returns the UV
 * coordinates of trim triangles so the trim region can be rasterized into
 * the recolor mask.
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

    // The knit trim is light gray in the baked texture, so the geometric
    // rules must run before the light-texel test or the trim gets classed
    // as sleeve leather.
    if (
      (ny < 0.1 && nx < 0.55) || // waistband
      (ny > 0.88 && nx < 0.35) || // collar
      nx > 0.84 // cuffs
    ) {
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
  const width = Math.min(image.width, 1024);
  const height = Math.min(image.height, 1024);
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

  for (let i = 0; i < width * height; i += 1) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    luminance[i] = lum;
    const redDominance = data[i * 4] - data[i * 4 + 2];
    if (redDominance < 28) {
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

  for (let i = 0; i < width * height; i += 1) {
    const mean = light[i] ? lightMean : darkMean;
    const value = Math.min(255, Math.max(90, (luminance[i] / mean) * 205));
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
  }

  // Erase the letter-patch shadow baked into the chest area (the patch mesh
  // itself is hidden): pull those pixels almost fully to the fabric mean.
  const px0 = Math.floor(PATCH_RECT.u0 * width);
  const px1 = Math.ceil(PATCH_RECT.u1 * width);
  const py0 = Math.floor(PATCH_RECT.v0 * height);
  const py1 = Math.ceil(PATCH_RECT.v1 * height);
  for (let y = py0; y < py1; y += 1) {
    for (let x = px0; x < px1; x += 1) {
      const i = y * width + x;
      if (light[i]) continue;
      const value = data[i * 4] + (205 - data[i * 4]) * 0.85;
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
    }
  }
  ctx.putImageData(imageData, 0, 0);

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

  const body = makeMask((i) => light[i] === 0);
  const sleeve = makeMask((i, x, y) => light[i] === 1 && !inPocketRect(x, y));
  const pocket = makeMask((i, x, y) => light[i] === 1 && inPocketRect(x, y));

  // Trim region comes from geometry, rasterized into UV space
  const trim = document.createElement("canvas");
  trim.width = width;
  trim.height = height;
  const trimCtx = trim.getContext("2d")!;
  trimCtx.fillStyle = "#ffffff";
  trimCtx.strokeStyle = "#ffffff";
  trimCtx.lineWidth = 1.5;
  for (let i = 0; i < trimTriangleUVs.length; i += 6) {
    trimCtx.beginPath();
    trimCtx.moveTo(trimTriangleUVs[i] * width, trimTriangleUVs[i + 1] * height);
    trimCtx.lineTo(trimTriangleUVs[i + 2] * width, trimTriangleUVs[i + 3] * height);
    trimCtx.lineTo(trimTriangleUVs[i + 4] * width, trimTriangleUVs[i + 5] * height);
    trimCtx.closePath();
    trimCtx.fill();
    trimCtx.stroke();
  }

  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const composite = document.createElement("canvas");
  composite.width = width;
  composite.height = height;
  const design = document.createElement("canvas");
  design.width = 512;
  design.height = 696;

  const texture = new THREE.CanvasTexture(composite);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;

  return { detail: neutral.canvas, masks: { body, sleeve, pocket, trim }, tmp, composite, design, texture };
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

  // Print the back design straight onto the back body panel
  const dx0 = BACK_DESIGN_RECT.u0 * width;
  const dy0 = BACK_DESIGN_RECT.v0 * height;
  const dw = (BACK_DESIGN_RECT.u1 - BACK_DESIGN_RECT.u0) * width;
  const dh = (BACK_DESIGN_RECT.v1 - BACK_DESIGN_RECT.v0) * height;
  compositeCtx.save();
  if (BACK_DESIGN_MIRRORED) {
    compositeCtx.translate(dx0 + dw, dy0);
    compositeCtx.scale(-1, 1);
    compositeCtx.drawImage(kit.design, 0, 0, dw, dh);
  } else {
    compositeCtx.drawImage(kit.design, dx0, dy0, dw, dh);
  }
  compositeCtx.restore();

  kit.texture.needsUpdate = true;
}

/**
 * The chest patch's dark imprint is also baked into the occlusion (R) and
 * roughness (G) channels of the metallicRoughness texture. Lift those
 * channels back to the surrounding fabric's values inside the patch rect so
 * no shadow of the removed patch remains.
 */
function cleanPatchImprint(sourceTexture: THREE.Texture | null): THREE.Texture | null {
  const image = sourceTexture?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!sourceTexture || !image) return sourceTexture ?? null;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  const px0 = Math.floor(PATCH_RECT.u0 * canvas.width);
  const py0 = Math.floor(PATCH_RECT.v0 * canvas.height);
  const pw = Math.ceil((PATCH_RECT.u1 - PATCH_RECT.u0) * canvas.width);
  const ph = Math.ceil((PATCH_RECT.v1 - PATCH_RECT.v0) * canvas.height);
  const region = ctx.getImageData(px0, py0, pw, ph);
  const data = region.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(data[i], 235); // occlusion → unoccluded
    data[i + 1] = Math.max(data[i + 1], 210); // roughness → matte fabric
  }
  ctx.putImageData(region, px0, py0);

  return canvasTextureLike(canvas, sourceTexture);
}

/**
 * The patch outline is embossed in the normal map too; blend the patch rect
 * mostly back to a flat normal so no raised edge catches the light.
 */
function cleanNormalImprint(sourceTexture: THREE.Texture | null): THREE.Texture | null {
  const image = sourceTexture?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!sourceTexture || !image) return sourceTexture ?? null;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);

  const px0 = Math.floor(PATCH_RECT.u0 * canvas.width);
  const py0 = Math.floor(PATCH_RECT.v0 * canvas.height);
  const pw = Math.ceil((PATCH_RECT.u1 - PATCH_RECT.u0) * canvas.width);
  const ph = Math.ceil((PATCH_RECT.v1 - PATCH_RECT.v0) * canvas.height);
  const region = ctx.getImageData(px0, py0, pw, ph);
  const data = region.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + (128 - data[i]) * 0.7;
    data[i + 1] = data[i + 1] + (128 - data[i + 1]) * 0.7;
    data[i + 2] = data[i + 2] + (255 - data[i + 2]) * 0.7;
  }
  ctx.putImageData(region, px0, py0);

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

/** Load the brand crest and crop it to its visible (non-transparent) bounds. */
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
      let minX = scan.width;
      let minY = scan.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < scan.height; y += 1) {
        for (let x = 0; x < scan.width; x += 1) {
          if (data[(y * scan.width + x) * 4 + 3] < 16) continue;
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

function drawBackDesign(canvas: HTMLCanvasElement, design: BackDesign, crest: HTMLCanvasElement | null) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = design.color;
  ctx.strokeStyle = design.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const name = design.name.trim().toUpperCase();
  if (name) {
    const fontSize = name.length > 10 ? 50 : 64;
    ctx.font = `700 ${fontSize}px 'League Spartan', sans-serif`;
    ctx.fillText(name, w / 2, 56, w * 0.92);
  }

  const starGap = 82;
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, w / 2 + (i - 2) * starGap, 148, 24, i < design.stars);
  }

  // Brand crest stays as-is (gold artwork); city + EST line change under it
  if (crest) {
    const crestWidth = 200;
    const crestHeight = crestWidth * (crest.height / crest.width);
    ctx.drawImage(crest, w / 2 - crestWidth / 2, 330 - crestHeight / 2, crestWidth, crestHeight);
  }

  const city = design.city.trim().toUpperCase();
  if (city) {
    ctx.font = "700 46px 'League Spartan', sans-serif";
    ctx.fillText(city, w / 2, 496, w * 0.92);
  }
  ctx.font = "600 30px 'League Spartan', sans-serif";
  ctx.fillText("EST. 2026", w / 2, 548);

  const numbers = design.numbers.map((value) => value.trim()).filter(Boolean);
  if (numbers.length) {
    ctx.font = "700 56px 'League Spartan', sans-serif";
    numbers.forEach((value, i) => {
      const x = numbers.length === 1 ? w / 2 : w * 0.1 + ((w * 0.8) / (numbers.length - 1)) * i;
      ctx.fillText(value, x, 640);
    });
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, filled: boolean) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fill();
  } else {
    ctx.lineWidth = 3;
    ctx.stroke();
  }
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
