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
  { u0: 0, v0: 0.44, u1: 0.345, v1: 0.74 },
  { u0: 0, v0: 0.86, u1: 1, v1: 1 },
];

// Where the back design prints onto the back body panel in UV space. The
// panel is oriented upside down in the texture, so the design is drawn
// rotated 180° (see composeColorMap).
const BACK_DESIGN_RECT = { u0: 0.55, v0: 0.06, u1: 0.87, v1: 0.44 };

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
  const cleanedPBR = cleanImprintTexture(source.roughnessMap);
  const cleanedNormal = cleanImprintTexture(source.normalMap);

  segmentJacketGeometry(jacketMesh, neutral.isLightTexel);
  const kit = buildRecolorKit(neutral);
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
 * carry material properties: wool vs leather vs knit). Classification is
 * purely by UV: trim by texture island rects, sleeve vs body by texel
 * chroma.
 */
function segmentJacketGeometry(mesh: THREE.Mesh, isLightTexel: (u: number, v: number) => boolean) {
  const geometry = mesh.geometry;
  const index = geometry.getIndex();
  const uv = geometry.getAttribute("uv");
  if (!index || !uv) throw new Error("jacket geometry missing attributes");

  const triCount = index.count / 3;
  const classes = new Uint8Array(triCount);

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

    if (inTrimRect(centroidU, centroidV)) {
      classes[t] = CLASS_TRIM;
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

  // Majority-filter the light/dark classification: stray highlight texels
  // inside the wool otherwise render as speckles of sleeve color (and vice
  // versa on the leather).
  despeckle(light, width, height);

  for (let i = 0; i < width * height; i += 1) {
    const mean = light[i] ? lightMean : darkMean;
    const value = Math.min(255, Math.max(90, (luminance[i] / mean) * 205));
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
function buildRecolorKit(neutral: NeutralizedBase): RecolorKit {
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

  const sleeve = soften(makeMask((i) => light[i] === 1));
  const pocket = soften(makeMask((i, x, y) => light[i] === 1 && inPocketRect(x, y)));
  const body = document.createElement("canvas");
  body.width = width;
  body.height = height;
  const bodyCtx = body.getContext("2d")!;
  bodyCtx.fillStyle = "#ffffff";
  bodyCtx.fillRect(0, 0, width, height);

  // Trim occupies fixed texture islands; painted last, it overrides the
  // body/sleeve layers inside its rects.
  const trim = document.createElement("canvas");
  trim.width = width;
  trim.height = height;
  const trimCtx = trim.getContext("2d")!;
  trimCtx.fillStyle = "#ffffff";
  for (const r of TRIM_RECTS) {
    trimCtx.fillRect(r.u0 * width, r.v0 * height, (r.u1 - r.u0) * width, (r.v1 - r.v0) * height);
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
