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
  garment: THREE.Group;
  accents: THREE.Group;
  frameId: number;
};

const MODEL_PATH = "/models/hoodie.glb";

export function JacketViewer3D({ bodyColor, sleeveColor, collarColor, cuffColor }: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ViewerState | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.12, rotX: -0.03 });

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
    scene.fog = new THREE.Fog("#eef3f8", 9, 18);

    const camera = new THREE.PerspectiveCamera(30, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.05, 7.2);

    scene.add(new THREE.HemisphereLight("#ffffff", "#b8c3cf", 1.8));

    const key = new THREE.DirectionalLight("#ffffff", 2.3);
    key.position.set(3.5, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dceaff", 1.15);
    fill.position.set(-4, 2.2, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight("#ffffff", 1.1);
    rim.position.set(0, 3, -4);
    scene.add(rim);

    const garment = new THREE.Group();
    garment.rotation.set(dragRef.current.rotX, dragRef.current.rotY, 0);
    scene.add(garment);

    const accents = buildAccents();
    garment.add(accents);

    const placeholder = buildFallbackHoodie(bodyColor);
    garment.add(placeholder);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 64),
      new THREE.MeshBasicMaterial({ color: "#9aa5b0", transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.55, 0.38, 1);
    shadow.position.set(0, -1.56, 0.32);
    scene.add(shadow);

    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(
      MODEL_PATH,
      (gltf) => {
        if (disposed) return;
        garment.remove(placeholder);
        disposeObject(placeholder);

        const model = gltf.scene;
        prepareLoadedModel(model, bodyColor);
        frameModel(model);
        garment.add(model);
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
      drag.rotX = THREE.MathUtils.clamp(drag.rotX, -0.3, 0.22);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    const onWheel = (event: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.003, 5, 9.2);
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
        drag.rotY += (0.12 - drag.rotY) * 0.018;
        drag.rotX += (-0.03 - drag.rotX) * 0.018;
      }
      garment.rotation.set(drag.rotX, drag.rotY, 0);
      renderer.render(scene, camera);
      const state = sceneRef.current;
      if (state) state.frameId = requestAnimationFrame(animate);
    };

    sceneRef.current = { renderer, scene, camera, garment, accents, frameId: requestAnimationFrame(animate) };

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
  }, []); // Scene setup is intentionally one-time.

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.garment.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.role === "garment") {
        applyGarmentMaterial(node, bodyColor);
      }
      if (node instanceof THREE.Mesh && node.userData.role === "fallback") {
        node.material = garmentMaterial(bodyColor);
      }
    });

    state.garment.remove(state.accents);
    disposeObject(state.accents);
    const nextAccents = buildAccents();
    state.accents = nextAccents;
    state.garment.add(nextAccents);
  }, [bodyColor, sleeveColor, collarColor, cuffColor]);

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}

function prepareLoadedModel(model: THREE.Group, bodyColor: string) {
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.role = "garment";
    applyGarmentMaterial(node, bodyColor);
  });
}

function frameModel(model: THREE.Group) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;

  model.position.sub(center);
  model.scale.setScalar(2.18 / maxDimension);
  model.position.y -= 0.05;
  model.rotation.y = 0;
}

function applyGarmentMaterial(mesh: THREE.Mesh, color: string) {
  const previous = mesh.material;
  mesh.material = garmentMaterial(color);
  disposeMaterial(previous);
}

function garmentMaterial(color: string) {
  const maps = makeFabricMaps(color);
  return new THREE.MeshPhysicalMaterial({
    color,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.88,
    metalness: 0,
    sheen: 0.75,
    sheenRoughness: 0.82,
  });
}

function buildAccents() {
  return new THREE.Group();
}

function buildFallbackHoodie(color: string) {
  const group = new THREE.Group();
  const material = garmentMaterial(color);

  const body = makePanel(
    [
      [-0.9, 0.8],
      [-0.72, -1.05],
      [-0.34, -1.28],
      [0, -1.34],
      [0.34, -1.28],
      [0.72, -1.05],
      [0.9, 0.8],
      [0.45, 1.02],
      [0.18, 0.72],
      [0, 0.58],
      [-0.18, 0.72],
      [-0.45, 1.02],
    ],
    material,
  );
  body.userData.role = "fallback";
  body.position.z = 0.02;
  group.add(body);

  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 18, 80, Math.PI * 1.25), material);
  hood.userData.role = "fallback";
  hood.position.set(0, 0.96, -0.02);
  hood.rotation.set(Math.PI * 0.52, 0, Math.PI * 0.88);
  hood.scale.set(1.12, 0.72, 1);
  hood.castShadow = true;
  group.add(hood);

  return group;
}

function makePanel(points: number[][], material: THREE.Material) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.022,
      bevelSegments: 5,
    }),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function leatherMaterial(color: string) {
  const maps = makeFabricMaps(color, "leather");
  return new THREE.MeshPhysicalMaterial({
    color,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 0.48,
    clearcoat: 0.42,
    clearcoatRoughness: 0.55,
  });
}

function ribMaterial(color: string) {
  const maps = makeFabricMaps(color, "rib");
  return new THREE.MeshPhysicalMaterial({
    color,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughness: 0.84,
    sheen: 0.5,
  });
}

function makeFabricMaps(color: string, type: "wool" | "leather" | "rib" = "wool") {
  const size = 192;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d");

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d");

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext("2d");

  if (colorCtx && normalCtx && roughCtx) {
    const base = new THREE.Color(color);
    colorCtx.fillStyle = color;
    colorCtx.fillRect(0, 0, size, size);
    normalCtx.fillStyle = "#8080ff";
    normalCtx.fillRect(0, 0, size, size);
    roughCtx.fillStyle = type === "leather" ? "#949494" : "#d7d7d7";
    roughCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2200; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 1 + (Math.random() - 0.5) * (type === "leather" ? 0.14 : 0.22);
      colorCtx.globalAlpha = type === "rib" ? 0.16 : 0.3;
      colorCtx.fillStyle = `rgb(${Math.round(base.r * 255 * shade)}, ${Math.round(base.g * 255 * shade)}, ${Math.round(base.b * 255 * shade)})`;
      colorCtx.fillRect(x, y, type === "leather" ? 2.2 : 1.2, type === "leather" ? 1 : 1.2);
      normalCtx.globalAlpha = 0.32;
      normalCtx.fillStyle = `rgb(${118 + Math.random() * 20}, ${118 + Math.random() * 20}, 255)`;
      normalCtx.fillRect(x, y, 1.4, 1.4);
    }

    if (type === "rib") {
      colorCtx.globalAlpha = 0.36;
      normalCtx.globalAlpha = 0.68;
      for (let x = 0; x < size; x += 8) {
        colorCtx.fillStyle = "#ffffff";
        colorCtx.fillRect(x, 0, 2, size);
        colorCtx.fillStyle = "#000000";
        colorCtx.fillRect(x + 4, 0, 1, size);
        normalCtx.fillStyle = "#a0a0ff";
        normalCtx.fillRect(x, 0, 3, size);
        normalCtx.fillStyle = "#6060ff";
        normalCtx.fillRect(x + 4, 0, 2, size);
      }
    }
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  [colorTexture, normalTexture, roughTexture].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(type === "rib" ? 2.2 : 3.1, type === "rib" ? 1.1 : 3.1);
    texture.colorSpace = texture === colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  });

  return { color: colorTexture, normal: normalTexture, roughness: roughTexture };
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
