import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_PATH = "/models/varsitybase/VarsityBase.glb";

export type LeatherType = "Nappa" | "Cowhide";

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

type Loaded = {
  materials: PartMaterials;
  leftFlap: THREE.Group | null; // viewer-left front panel pivot
  rightFlap: THREE.Group | null; // viewer-right front panel pivot
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

      loadedRef.current = { materials, leftFlap, rightFlap };
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
