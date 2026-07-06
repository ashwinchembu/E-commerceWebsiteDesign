import { useEffect, useRef } from "react";
import * as THREE from "three";

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
  jacket: THREE.Group;
  frameId: number;
};

export function JacketViewer3D({ bodyColor, sleeveColor, collarColor, cuffColor }: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ViewerState | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, rotY: 0.08, rotX: -0.04 });

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
    scene.fog = new THREE.Fog("#eef3f8", 10, 18);

    const camera = new THREE.PerspectiveCamera(31, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, -0.1, 10.8);

    scene.add(new THREE.HemisphereLight("#ffffff", "#aeb8c4", 1.7));

    const key = new THREE.DirectionalLight("#ffffff", 2.8);
    key.position.set(2.4, 4.6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const fill = new THREE.DirectionalLight("#dbe8ff", 1.05);
    fill.position.set(-3.4, 2, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight("#ffffff", 1.35);
    rim.position.set(0, 3.6, -3.5);
    scene.add(rim);

    const jacket = buildLeatherJacket(bodyColor, sleeveColor, collarColor, cuffColor);
    jacket.rotation.set(dragRef.current.rotX, dragRef.current.rotY, 0);
    scene.add(jacket);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 64),
      new THREE.MeshBasicMaterial({ color: "#9aa7b4", transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.8, 0.42, 1);
    shadow.position.set(0, -2.15, 0.22);
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
      drag.rotX = THREE.MathUtils.clamp(drag.rotX, -0.26, 0.24);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    const onWheel = (event: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.0035, 7.4, 13);
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
        drag.rotY += (0.08 - drag.rotY) * 0.018;
        drag.rotX += (-0.04 - drag.rotX) * 0.018;
      }
      jacket.rotation.set(drag.rotX, drag.rotY, 0);
      renderer.render(scene, camera);
      const state = sceneRef.current;
      if (state) state.frameId = requestAnimationFrame(animate);
    };

    sceneRef.current = { renderer, scene, camera, jacket, frameId: requestAnimationFrame(animate) };

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

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.scene.remove(state.jacket);
    disposeObject(state.jacket);
    const next = buildLeatherJacket(bodyColor, sleeveColor, collarColor, cuffColor);
    next.rotation.copy(state.jacket.rotation);
    state.jacket = next;
    state.scene.add(next);
  }, [bodyColor, sleeveColor, collarColor, cuffColor]);

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
}

function buildLeatherJacket(bodyColor: string, sleeveColor: string, collarColor: string, cuffColor: string) {
  const group = new THREE.Group();
  group.scale.setScalar(0.86);
  group.position.y = -0.12;

  const bodyMat = leatherMaterial(bodyColor);
  const sleeveMat = leatherMaterial(sleeveColor);
  const ribMat = ribMaterial(cuffColor);
  const collarMat = ribMaterial(collarColor);
  const liningMat = new THREE.MeshPhysicalMaterial({ color: "#07090d", roughness: 0.58, sheen: 0.5 });
  const seamMat = new THREE.MeshStandardMaterial({ color: "#e8e2d5", roughness: 0.86 });
  const snapMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cuffColor).lerp(new THREE.Color("#fff4d0"), 0.72),
    roughness: 0.24,
    metalness: 0.34,
    clearcoat: 0.8,
    clearcoatRoughness: 0.32,
  });
  const blackMetal = new THREE.MeshPhysicalMaterial({
    color: "#10131a",
    roughness: 0.23,
    metalness: 0.72,
    clearcoat: 0.75,
  });

  const torso = makePanel(
    [
      [-1.34, 1.02],
      [-1.18, -1.42],
      [-0.74, -1.78],
      [0, -1.92],
      [0.74, -1.78],
      [1.18, -1.42],
      [1.34, 1.02],
      [0.9, 1.32],
      [0.4, 1.43],
      [0.16, 1.08],
      [0, 0.9],
      [-0.16, 1.08],
      [-0.4, 1.43],
      [-0.9, 1.32],
    ],
    0.34,
    bodyMat,
  );
  torso.scale.z = 1.24;
  group.add(torso);

  const leftPanel = makePanel(
    [
      [-1.2, 0.92],
      [-1.02, -1.36],
      [-0.58, -1.62],
      [-0.08, -1.68],
      [-0.04, 0.72],
      [-0.23, 1.0],
      [-0.48, 1.29],
      [-0.86, 1.23],
    ],
    0.045,
    bodyMat,
  );
  leftPanel.position.z = 0.5;
  group.add(leftPanel);

  const rightPanel = makePanel(
    [
      [0.1, 0.68],
      [0.08, -1.68],
      [0.58, -1.62],
      [1.02, -1.36],
      [1.2, 0.92],
      [0.86, 1.23],
      [0.48, 1.29],
      [0.24, 1.0],
    ],
    0.045,
    bodyMat,
  );
  rightPanel.position.z = 0.505;
  group.add(rightPanel);

  const lining = makePanel(
    [
      [-0.2, 1.05],
      [0, 0.82],
      [0.24, 1.08],
      [0.44, 1.18],
      [0.3, 0.64],
      [0.1, 0.24],
      [0, 0.02],
      [-0.1, 0.24],
      [-0.3, 0.64],
      [-0.44, 1.18],
    ],
    0.075,
    liningMat,
  );
  lining.position.z = 0.57;
  group.add(lining);

  addSleeve(group, -1, sleeveMat, ribMat);
  addSleeve(group, 1, sleeveMat, ribMat);
  addCollarAndWaistband(group, collarMat, ribMat);
  addPockets(group, sleeveMat);
  addSnaps(group, seamMat, snapMat, blackMetal);
  addWrinkleLines(group);

  return group;
}

function addSleeve(group: THREE.Group, side: -1 | 1, sleeveMat: THREE.Material, ribMat: THREE.Material) {
  const sleeve = new THREE.Group();
  sleeve.position.set(side * 1.23, 0.02, -0.03);
  sleeve.rotation.z = side * -0.18;
  sleeve.rotation.y = side * 0.16;

  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.75, 18, 36), sleeveMat);
  upper.scale.set(0.92, 1, 0.58);
  upper.position.y = -0.1;
  upper.castShadow = true;
  upper.receiveShadow = true;
  sleeve.add(upper);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.2, 48), ribMat);
  cuff.scale.z = 0.55;
  cuff.position.y = -1.05;
  cuff.castShadow = true;
  cuff.receiveShadow = true;
  sleeve.add(cuff);

  group.add(sleeve);
}

function addCollarAndWaistband(group: THREE.Group, collarMat: THREE.Material, ribMat: THREE.Material) {
  const collarLeft = makePanel(
    [
      [-0.58, 1.36],
      [-0.1, 1.12],
      [-0.28, 0.78],
      [-0.76, 0.98],
      [-0.88, 1.27],
    ],
    0.16,
    collarMat,
  );
  collarLeft.position.z = 0.66;
  collarLeft.rotation.z = -0.12;
  group.add(collarLeft);

  const collarRight = makePanel(
    [
      [0.58, 1.36],
      [0.1, 1.12],
      [0.28, 0.78],
      [0.76, 0.98],
      [0.88, 1.27],
    ],
    0.16,
    collarMat,
  );
  collarRight.position.z = 0.66;
  collarRight.rotation.z = 0.12;
  group.add(collarRight);

  const backCollar = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.1, 18, 64, Math.PI * 1.08), collarMat);
  backCollar.position.set(0, 1.29, 0.45);
  backCollar.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.96);
  backCollar.scale.set(1.12, 0.58, 1);
  backCollar.castShadow = true;
  group.add(backCollar);

  const waistband = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.02, 0.25, 64, 1, true, 0, Math.PI), ribMat);
  waistband.position.set(0, -1.74, 0.1);
  waistband.rotation.x = Math.PI / 2;
  waistband.scale.y = 0.48;
  waistband.castShadow = true;
  waistband.receiveShadow = true;
  group.add(waistband);
}

function addPockets(group: THREE.Group, material: THREE.Material) {
  for (const side of [-1, 1] as const) {
    const welt = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.66, 0.035), material);
    welt.position.set(side * 0.68, -0.74, 0.69);
    welt.rotation.z = side * 0.34;
    welt.castShadow = true;
    group.add(welt);
  }
}

function addSnaps(group: THREE.Group, seamMat: THREE.Material, snapMat: THREE.Material, blackMetal: THREE.Material) {
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.48, 0.035), seamMat);
  placket.position.set(0.08, -0.43, 0.68);
  placket.castShadow = true;
  group.add(placket);

  for (const y of [0.55, 0.05, -0.45, -0.95, -1.42, -1.68]) {
    const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 36), snapMat);
    snap.position.set(0.22, y, 0.73);
    snap.rotation.x = Math.PI / 2;
    snap.castShadow = true;
    group.add(snap);
  }

  const darkSnap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 36), blackMetal);
  darkSnap.position.set(-0.22, 0.55, 0.735);
  darkSnap.rotation.x = Math.PI / 2;
  darkSnap.castShadow = true;
  group.add(darkSnap);
}

function addWrinkleLines(group: THREE.Group) {
  const material = new THREE.LineBasicMaterial({ color: "#000000", transparent: true, opacity: 0.12 });
  const wrinkles = [
    [[-0.85, 0.35, 0.72], [-0.55, 0.23, 0.72], [-0.28, 0.27, 0.72]],
    [[0.36, 0.18, 0.72], [0.66, 0.08, 0.72], [0.9, 0.16, 0.72]],
    [[-0.42, -0.7, 0.72], [-0.12, -0.8, 0.72], [0.18, -0.74, 0.72]],
  ];
  wrinkles.forEach((points) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
      material,
    );
    group.add(line);
  });
}

function makePanel(points: number[][], depth: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.04,
      bevelSegments: 8,
      curveSegments: 18,
    }),
    material,
  );
  mesh.position.z = -depth / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function leatherMaterial(color: string) {
  const maps = makeLeatherMaps(color);
  return new THREE.MeshPhysicalMaterial({
    color,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughness: 0.44,
    metalness: 0,
    clearcoat: 0.58,
    clearcoatRoughness: 0.42,
    sheen: 0.22,
  });
}

function ribMaterial(color: string) {
  const maps = makeLeatherMaps(color, true);
  return new THREE.MeshPhysicalMaterial({
    color,
    map: maps.color,
    normalMap: maps.normal,
    roughnessMap: maps.roughness,
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughness: 0.82,
    sheen: 0.48,
  });
}

function makeLeatherMaps(color: string, rib = false) {
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
    roughCtx.fillStyle = rib ? "#d2d2d2" : "#9a9a9a";
    roughCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2600; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 1 + (Math.random() - 0.5) * (rib ? 0.18 : 0.28);
      colorCtx.globalAlpha = rib ? 0.18 : 0.34;
      colorCtx.fillStyle = `rgb(${Math.round(base.r * 255 * shade)}, ${Math.round(base.g * 255 * shade)}, ${Math.round(base.b * 255 * shade)})`;
      colorCtx.fillRect(x, y, rib ? 1.2 : 2.4, rib ? 1.2 : 1.1);
      normalCtx.globalAlpha = 0.36;
      normalCtx.fillStyle = `rgb(${118 + Math.random() * 22}, ${118 + Math.random() * 22}, 255)`;
      normalCtx.fillRect(x, y, rib ? 1.3 : 1.8, rib ? 1.3 : 1.2);
    }

    if (rib) {
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
    } else {
      colorCtx.globalAlpha = 0.12;
      colorCtx.strokeStyle = "#ffffff";
      for (let i = 0; i < 100; i += 1) {
        colorCtx.beginPath();
        colorCtx.moveTo(Math.random() * size, Math.random() * size);
        colorCtx.lineTo(Math.random() * size, Math.random() * size);
        colorCtx.stroke();
      }
    }
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  [colorTexture, normalTexture, roughTexture].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rib ? 2.3 : 3.2, rib ? 1.2 : 3.2);
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
