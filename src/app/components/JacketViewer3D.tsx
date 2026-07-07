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
};

type BackOverlay = {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
};

type ViewerState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  modelRoot: THREE.Group;
  materials: PartMaterials | null;
  backOverlay: BackOverlay | null;
  frameId: number;
};

const MODEL_PATH = "/models/letterman_jacket.glb";

// Triangle classes inside the jacket mesh
const CLASS_BODY = 0;
const CLASS_SLEEVE = 1;
const CLASS_TRIM = 2;

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
    if (!state?.materials) return;
    applyColors(state.materials, colorsRef.current);
  }, [bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor]);

  useEffect(() => {
    designRef.current = backDesign;
    const overlay = sceneRef.current?.backOverlay;
    if (!overlay) return;
    let cancelled = false;
    void loadCrest().then((crest) => {
      if (cancelled) return;
      drawBackDesign(overlay.canvas, designRef.current, crest);
      overlay.texture.needsUpdate = true;
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
          const materials = prepareJacket(gltf.scene, colorsRef.current);
          frameModel(gltf.scene);
          modelRoot.remove(placeholder);
          disposeObject(placeholder);
          const overlay = createBackOverlay(gltf.scene);
          modelRoot.add(gltf.scene);
          modelRoot.add(overlay.mesh);
          void loadCrest().then((crest) => {
            if (disposed) return;
            drawBackDesign(overlay.canvas, designRef.current, crest);
            overlay.texture.needsUpdate = true;
          });

          const state = sceneRef.current;
          if (state) {
            state.materials = materials;
            state.backOverlay = overlay;
          }
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
      materials: null,
      backOverlay: null,
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

function applyColors(materials: PartMaterials, colors: JacketColors) {
  materials.body.color.set(colors.bodyColor);
  materials.sleeve.color.set(colors.sleeveColor);
  materials.trim.color.set(colors.trimColor);
  materials.snap.color.set(colors.snapColor);
}

/**
 * The GLB bakes body/sleeve colors into one texture, so per-part recoloring
 * works by classifying each triangle from the baked base color (white texels
 * are the leather sleeves, dark ones the wool body), carving the ribbed trim
 * out of the body class by position, then re-tinting everything over a
 * luminance-neutralized copy of the base texture that keeps seam/fold detail.
 */
function prepareJacket(root: THREE.Group, colors: JacketColors): PartMaterials {
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

  const { detailTexture, isLightTexel } = neutralizeBaseColor(baseImage);

  const shared = {
    map: detailTexture,
    normalMap: source.normalMap,
    roughnessMap: source.roughnessMap,
    metalnessMap: source.metalnessMap,
    aoMap: source.aoMap,
    metalness: 0,
    side: THREE.DoubleSide as THREE.Side,
  };

  const materials: PartMaterials = {
    body: new THREE.MeshStandardMaterial({ ...shared, color: colors.bodyColor, roughness: 0.92 }),
    sleeve: new THREE.MeshPhysicalMaterial({
      ...shared,
      color: colors.sleeveColor,
      roughness: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
    }),
    trim: new THREE.MeshStandardMaterial({ ...shared, color: colors.trimColor, roughness: 0.88 }),
    snap: new THREE.MeshPhysicalMaterial({
      map: detailTexture,
      normalMap: source.normalMap,
      color: colors.snapColor,
      roughness: 0.35,
      metalness: 0.3,
      side: THREE.DoubleSide,
    }),
  };

  segmentJacketGeometry(jacketMesh, isLightTexel);
  (jacketMesh as THREE.Mesh).material = [materials.body, materials.sleeve, materials.trim];

  if (buttonMesh) (buttonMesh as THREE.Mesh).material = materials.snap;

  return materials;
}

/** Split the jacket mesh index into body / sleeve / trim groups. */
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

    if (lightVotes >= 3) {
      classes[t] = CLASS_SLEEVE;
    } else if (ny < 0.1 && nx < 0.55) {
      classes[t] = CLASS_TRIM; // waistband
    } else if (ny > 0.88 && nx < 0.35) {
      classes[t] = CLASS_TRIM; // collar
    } else if (nx > 0.8) {
      classes[t] = CLASS_TRIM; // cuffs
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

/**
 * Turn the baked base color into a grayscale detail map: each pixel's
 * luminance divided by the mean of its region (light vs dark) so that
 * `material.color * map` re-tints both regions to any target color while
 * preserving stitches, seams, and fold shading.
 */
function neutralizeBaseColor(image: CanvasImageSource & { width: number; height: number }) {
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

  for (let i = 0; i < width * height; i += 1) {
    const mean = light[i] ? lightMean : darkMean;
    const value = Math.min(255, Math.max(90, (luminance[i] / mean) * 205));
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
  }

  // Flatten the letter-patch shadow baked into the chest area of the base
  // color (the patch mesh itself is hidden), otherwise it shows as a smudge.
  const px0 = Math.floor(0.27 * width);
  const px1 = Math.ceil(0.42 * width);
  const py0 = Math.floor(0.21 * height);
  const py1 = Math.ceil(0.4 * height);
  for (let y = py0; y < py1; y += 1) {
    for (let x = px0; x < px1; x += 1) {
      const i = y * width + x;
      if (light[i]) continue;
      const value = Math.max(data[i * 4], 195);
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const detailTexture = new THREE.CanvasTexture(canvas);
  detailTexture.flipY = false;
  detailTexture.colorSpace = THREE.SRGBColorSpace;
  detailTexture.wrapS = detailTexture.wrapT = THREE.RepeatWrapping;
  detailTexture.anisotropy = 8;

  const isLightTexel = (u: number, v: number) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor((v % 1 + 1) % 1 * height)));
    return light[y * width + x] === 1;
  };

  return { detailTexture, isLightTexel };
}

/**
 * Curved transparent canvas hovering just off the jacket's back, carrying the
 * printed design (name, stars, crest, city, EST 2026, numbers). It lives in
 * the rotating model root so it follows the jacket when spun around.
 */
function createBackOverlay(model: THREE.Object3D): BackOverlay {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const width = size.x * 0.27;
  const height = width * 1.35;

  const geometry = new THREE.PlaneGeometry(width, height, 24, 1);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const nx = position.getX(i) / (width / 2);
    position.setZ(i, -width * 0.14 * nx * nx);
  }
  geometry.rotateY(Math.PI);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 696;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(center.x, center.y + size.y * 0.03, box.min.z - 0.02);
  mesh.renderOrder = 1;
  return { mesh, canvas, texture };
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
