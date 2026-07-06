import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface JacketViewer3DProps {
  bodyColor: string;
  sleeveColor: string;
  collarColor: string;
  cuffColor: string;
}

type ViewerState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  modelRoot: THREE.Group;
  frameId: number;
};

const MODEL_PATH = "/models/leather_jacket/scene.gltf";

export function JacketViewer3D({ bodyColor }: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ViewerState | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.05, rotX: -0.04 });
  const colorRef = useRef(bodyColor);

  useEffect(() => {
    colorRef.current = bodyColor;
    const state = sceneRef.current;
    if (!state) return;
    tintLeatherModel(state.modelRoot, bodyColor);
  }, [bodyColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef3f8");
    scene.fog = new THREE.Fog("#eef3f8", 7, 15);

    const camera = new THREE.PerspectiveCamera(28, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, -0.05, 5.9);

    scene.add(new THREE.HemisphereLight("#ffffff", "#aab6c2", 1.55));

    const key = new THREE.DirectionalLight("#ffffff", 2.5);
    key.position.set(2.4, 4, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dceaff", 1.15);
    fill.position.set(-3, 2, 2.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight("#ffffff", 1.35);
    rim.position.set(0, 2.6, -3.5);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.set(dragRef.current.rotX, dragRef.current.rotY, 0);
    scene.add(modelRoot);

    const placeholder = buildLoadingSilhouette();
    modelRoot.add(placeholder);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 64),
      new THREE.MeshBasicMaterial({ color: "#97a5b2", transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.75, 0.42, 1);
    shadow.position.set(0, -1.35, 0.2);
    scene.add(shadow);

    let disposed = false;
    new GLTFLoader().load(
      MODEL_PATH,
      (gltf) => {
        if (disposed) return;
        modelRoot.remove(placeholder);
        disposeObject(placeholder);

        const jacket = gltf.scene;
        prepareLeatherModel(jacket, colorRef.current);
        frameLeatherModel(jacket);
        modelRoot.add(jacket);
      },
      undefined,
      () => {
        placeholder.visible = true;
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
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.003, 4.2, 8);
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

    sceneRef.current = { renderer, scene, camera, modelRoot, frameId: requestAnimationFrame(animate) };

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
  }, [bodyColor]);

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}

function prepareLeatherModel(root: THREE.Group, color: string) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.leatherModel = true;
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    node.material = upgradeLeatherMaterial(material, color);
  });
}

function tintLeatherModel(root: THREE.Group, color: string) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.userData.leatherModel) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      updateLeatherMaterialColor(material, color);
    });
  });
}

function upgradeLeatherMaterial(source: THREE.Material, color: string) {
  const original = source as THREE.MeshStandardMaterial;
  const displayColor = displayLeatherColorForHex(color);
  const material = new THREE.MeshPhysicalMaterial({
    color: displayColor.display,
    map: displayColor.usesColorMap ? makeLeatherTintTexture(color) : null,
    normalMap: original.normalMap ?? null,
    roughnessMap: original.roughnessMap ?? null,
    metalnessMap: original.metalnessMap ?? null,
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.34,
    normalScale: new THREE.Vector2(0.82, 0.82),
    side: THREE.DoubleSide,
  });
  material.emissive.copy(displayColor.emissive);
  material.emissiveIntensity = displayColor.emissiveIntensity;
  material.userData.generatedTintMap = material.map;

  [material.map, material.normalMap, material.roughnessMap, material.metalnessMap].forEach((texture) => {
    if (!texture) return;
    texture.colorSpace = texture === material.map ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  });
  return material;
}

function updateLeatherMaterialColor(material: THREE.Material, color: string) {
  const editable = material as THREE.MeshStandardMaterial;
  const displayColor = displayLeatherColorForHex(color);
  const generatedMap = editable.userData.generatedTintMap;
  if (generatedMap instanceof THREE.Texture) generatedMap.dispose();
  if (editable.color instanceof THREE.Color) editable.color.copy(displayColor.display);
  editable.map = displayColor.usesColorMap ? makeLeatherTintTexture(color) : null;
  if (editable.emissive instanceof THREE.Color) {
    editable.emissive.copy(displayColor.emissive);
    editable.emissiveIntensity = displayColor.emissiveIntensity;
  }
  editable.userData.generatedTintMap = editable.map;
  editable.roughness = 0.38;
  editable.metalness = 0;
  editable.needsUpdate = true;
}

function makeLeatherTintTexture(color: string) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const base = new THREE.Color(color);
  const isLight = base.r > 0.86 && base.g > 0.86 && base.b > 0.8;
  const isVeryDark = isBlackLeatherColor(color, base);
  const fill = displayLeatherColor(base, isLight, isVeryDark);

  ctx.fillStyle = `rgb(${Math.round(fill.r * 255)}, ${Math.round(fill.g * 255)}, ${Math.round(fill.b * 255)})`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 5200; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 1 + (Math.random() - 0.5) * (isLight ? 0.12 : 0.38);
    const r = Math.max(0, Math.min(255, Math.round(fill.r * 255 * shade)));
    const g = Math.max(0, Math.min(255, Math.round(fill.g * 255 * shade)));
    const b = Math.max(0, Math.min(255, Math.round(fill.b * 255 * shade)));
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, y, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }

  ctx.globalAlpha = isLight ? 0.12 : 0.2;
  ctx.strokeStyle = isLight ? "#b8b8b0" : "#ffffff";
  for (let i = 0; i < 160; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 16);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function displayLeatherColorForHex(color: string) {
  const base = new THREE.Color(color);
  const isLight = base.r > 0.86 && base.g > 0.86 && base.b > 0.8;
  const isVeryDark = isBlackLeatherColor(color, base);
  const display = displayLeatherColor(base, isLight, isVeryDark);
  return {
    display,
    usesColorMap: isVeryDark,
    emissive: isVeryDark ? new THREE.Color("#000000") : display.clone().multiplyScalar(isLight ? 0.08 : 0.34),
    emissiveIntensity: isVeryDark ? 0 : isLight ? 0.04 : 0.55,
  };
}

function displayLeatherColor(base: THREE.Color, isLight: boolean, isVeryDark: boolean) {
  if (isVeryDark) return new THREE.Color("#111111");
  if (isLight) return base;

  const brightestChannel = Math.max(base.r, base.g, base.b, 0.01);
  const scale = Math.max(1.35, 0.78 / brightestChannel);
  return new THREE.Color(
    Math.min(base.r * scale, 1),
    Math.min(base.g * scale, 1),
    Math.min(base.b * scale, 1),
  );
}

function isBlackLeatherColor(color: string, base: THREE.Color) {
  return color.trim().toLowerCase() === "#1a1a1a" || (base.r < 0.03 && base.g < 0.03 && base.b < 0.03);
}

function frameLeatherModel(model: THREE.Group) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;

  model.position.sub(center);
  model.scale.setScalar(1.55 / maxDimension);
  model.position.y -= 0.28;
}

function buildLoadingSilhouette() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#171717", roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.6, 0.18), material);
  body.castShadow = true;
  group.add(body);

  const leftSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.25, 12, 24), material);
  leftSleeve.position.set(-0.72, -0.04, 0);
  leftSleeve.rotation.z = -0.35;
  leftSleeve.castShadow = true;
  group.add(leftSleeve);

  const rightSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.25, 12, 24), material);
  rightSleeve.position.set(0.72, -0.04, 0);
  rightSleeve.rotation.z = 0.35;
  rightSleeve.castShadow = true;
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
