import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

interface JacketViewer3DProps {
  bodyColor: string;
  sleeveColor: string;
  trimColor: string;
  snapColor: string;
  pocketColor: string;
  liningColor: string;
}

type PartMaterials = {
  body: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  snap: THREE.MeshStandardMaterial;
  pocket: THREE.MeshPhysicalMaterial;
  lining: THREE.MeshStandardMaterial;
};

type ViewerState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  modelRoot: THREE.Group;
  materials: PartMaterials;
  frameId: number;
};

export function JacketViewer3D({
  bodyColor,
  sleeveColor,
  trimColor,
  snapColor,
  pocketColor,
  liningColor,
}: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ViewerState | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.05, rotX: -0.04 });
  const colorsRef = useRef({ bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor });

  useEffect(() => {
    colorsRef.current = { bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor };
    const state = sceneRef.current;
    if (!state) return;
    applyColors(state.materials, colorsRef.current);
  }, [bodyColor, sleeveColor, trimColor, snapColor, pocketColor, liningColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(28, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, -0.02, 6.8);

    scene.add(new THREE.HemisphereLight("#ffffff", "#aab6c2", 1.5));

    const key = new THREE.DirectionalLight("#ffffff", 2.3);
    key.position.set(2.4, 4, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
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

    const { jacket, materials } = buildVarsityJacket(colorsRef.current);
    jacket.position.y = -0.05;
    modelRoot.add(jacket);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 64),
      new THREE.MeshBasicMaterial({ color: "#97a5b2", transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.6, 0.42, 1);
    shadow.position.set(0, -1.18, 0.15);
    scene.add(shadow);

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
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.003, 5, 9.5);
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

    sceneRef.current = { renderer, scene, camera, modelRoot, materials, frameId: requestAnimationFrame(animate) };

    return () => {
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
  materials.pocket.color.set(colors.pocketColor);
  materials.lining.color.set(colors.liningColor);
}

function buildVarsityJacket(colors: JacketColors) {
  const jacket = new THREE.Group();

  const woolBump = makeNoiseTexture(256, 26);
  woolBump.repeat.set(3, 3);
  const leatherBump = makeNoiseTexture(256, 10);
  leatherBump.repeat.set(4, 4);
  const ribBump = makeRibTexture();

  const materials: PartMaterials = {
    body: new THREE.MeshStandardMaterial({
      color: colors.bodyColor,
      roughness: 0.94,
      bumpMap: woolBump,
      bumpScale: 0.6,
    }),
    sleeve: new THREE.MeshPhysicalMaterial({
      color: colors.sleeveColor,
      roughness: 0.42,
      clearcoat: 0.4,
      clearcoatRoughness: 0.45,
      bumpMap: leatherBump,
      bumpScale: 0.25,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: colors.trimColor,
      roughness: 0.88,
      bumpMap: ribBump,
      bumpScale: 0.9,
      side: THREE.DoubleSide,
    }),
    snap: new THREE.MeshStandardMaterial({
      color: colors.snapColor,
      roughness: 0.35,
      metalness: 0.25,
    }),
    pocket: new THREE.MeshPhysicalMaterial({
      color: colors.pocketColor,
      roughness: 0.42,
      clearcoat: 0.4,
      clearcoatRoughness: 0.45,
    }),
    lining: new THREE.MeshStandardMaterial({
      color: colors.liningColor,
      roughness: 0.75,
    }),
  };

  // Torso — rounded box with a slight taper toward the shoulders
  const bodyGeometry = new RoundedBoxGeometry(1.14, 1.42, 0.54, 5, 0.15);
  taperShoulders(bodyGeometry);
  const body = new THREE.Mesh(bodyGeometry, materials.body);
  body.position.y = 0.08;
  body.castShadow = true;
  jacket.add(body);

  // Snap placket down the center front
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.34, 0.045), materials.body);
  placket.position.set(0, 0.1, 0.265);
  jacket.add(placket);

  // Snaps
  for (let i = 0; i < 6; i += 1) {
    const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 20), materials.snap);
    snap.rotation.x = Math.PI / 2;
    snap.position.set(0, 0.56 - i * 0.204, 0.294);
    jacket.add(snap);
  }

  // Angled welt pockets
  for (const side of [-1, 1]) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.27, 0.028), materials.pocket);
    pocket.rotation.z = side * 0.42;
    pocket.position.set(0.4 * side, -0.24, 0.272);
    jacket.add(pocket);
  }

  // Ribbed knit hem
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.2, 48), materials.trim);
  hem.scale.z = 0.46;
  hem.position.y = -0.68;
  jacket.add(hem);

  // Standing knit collar with a front opening; dark lining visible inside the neck
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.27, 0.16, 48, 1, true, 0.5, Math.PI * 2 - 1),
    materials.trim,
  );
  collar.scale.z = 0.85;
  collar.position.y = 0.81;
  jacket.add(collar);

  const neckLining = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 16), materials.lining);
  neckLining.scale.set(1, 0.42, 0.8);
  neckLining.position.y = 0.78;
  jacket.add(neckLining);

  // Leather sleeves — tube along a curve, shoulder blend sphere, knit cuff at the end
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.3 * side, 0.58, 0),
      new THREE.Vector3(0.56 * side, 0.48, 0.02),
      new THREE.Vector3(0.76 * side, 0.16, 0.06),
      new THREE.Vector3(0.84 * side, -0.24, 0.1),
      new THREE.Vector3(0.87 * side, -0.5, 0.12),
    ]);
    const sleeve = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.15, 20, false), materials.sleeve);
    sleeve.castShadow = true;
    jacket.add(sleeve);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), materials.sleeve);
    shoulder.position.set(0.44 * side, 0.52, 0.02);
    jacket.add(shoulder);

    const tangent = curve.getTangent(1).normalize();
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.19, 32), materials.trim);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.clone().negate());
    const end = curve.getPoint(1);
    cuff.position.copy(end).addScaledVector(tangent, 0.06);
    jacket.add(cuff);
  }

  return { jacket, materials };
}

function taperShoulders(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    if (y <= 0.3) continue;
    const t = (y - 0.3) / 0.45;
    const shrink = 1 - 0.16 * t * t;
    position.setX(i, position.getX(i) * shrink);
    position.setZ(i, position.getZ(i) * (1 - 0.08 * t * t));
  }
  position.needsUpdate = true;
}

function makeNoiseTexture(size: number, intensity: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 128 + (Math.random() - 0.5) * 2 * intensity;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeRibTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  for (let x = 0; x < size; x += 1) {
    const value = Math.round(150 + Math.sin((x / size) * Math.PI * 2 * 18) * 70);
    ctx.fillStyle = `rgb(${value},${value},${value})`;
    ctx.fillRect(x, 0, 1, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  return texture;
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
