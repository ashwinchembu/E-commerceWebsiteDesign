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
    scene.fog = new THREE.Fog("#eef3f8", 13, 22);

    const camera = new THREE.PerspectiveCamera(31, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, -0.12, 15);

    scene.add(new THREE.HemisphereLight("#ffffff", "#c8d0d8", 1.9));

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.7);
    keyLight.position.set(2.4, 4.5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#dfeaff", 1.15);
    fillLight.position.set(-3.5, 2.1, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#ffffff", 1.2);
    rimLight.position.set(0, 3.5, -3);
    scene.add(rimLight);

    const jacket = buildJacket(bodyColor, sleeveColor, collarColor, cuffColor);
    jacket.rotation.set(dragRef.current.rotX, dragRef.current.rotY, 0);
    scene.add(jacket);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.65, 64),
      new THREE.MeshBasicMaterial({ color: "#aeb8c2", transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.75, 0.42, 1);
    shadow.position.set(0, -2.28, 0.25);
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
      drag.rotX = THREE.MathUtils.clamp(drag.rotX, -0.24, 0.24);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    const onWheel = (event: WheelEvent) => {
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * 0.0035, 10.5, 17);
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
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          disposeMaterial(node.material);
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []); // Scene setup is intentionally one-time.

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.scene.remove(state.jacket);
    state.jacket.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        disposeMaterial(node.material);
      }
    });
    const nextJacket = buildJacket(bodyColor, sleeveColor, collarColor, cuffColor);
    nextJacket.rotation.copy(state.jacket.rotation);
    state.jacket = nextJacket;
    state.scene.add(nextJacket);
  }, [bodyColor, sleeveColor, collarColor, cuffColor]);

  return <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />;
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

function buildJacket(bodyColor: string, sleeveColor: string, collarColor: string, cuffColor: string): THREE.Group {
  const jacket = new THREE.Group();
  jacket.position.y = -0.25;
  jacket.scale.setScalar(0.76);

  const bodyMat = fabricMaterial(bodyColor, "wool");
  const sleeveMat = fabricMaterial(sleeveColor, "leather");
  const ribMat = fabricMaterial(cuffColor, "rib");
  const collarMat = fabricMaterial(collarColor, "rib");
  const liningMat = new THREE.MeshPhysicalMaterial({
    color: "#07090d",
    roughness: 0.66,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.5,
  });
  const seamMat = new THREE.MeshStandardMaterial({ color: "#d8d4c6", roughness: 0.9 });
  const snapMat = new THREE.MeshPhysicalMaterial({
    color: brighten(cuffColor, 0.88),
    roughness: 0.28,
    metalness: 0.28,
    clearcoat: 0.8,
    clearcoatRoughness: 0.32,
  });
  const darkSnapMat = new THREE.MeshPhysicalMaterial({
    color: "#111827",
    roughness: 0.25,
    metalness: 0.75,
    clearcoat: 0.7,
  });

  const torso = makeExtrudedShape(
    [
      [-1.38, 1.08],
      [-1.16, -1.62],
      [-0.72, -1.9],
      [0, -2.02],
      [0.72, -1.9],
      [1.16, -1.62],
      [1.38, 1.08],
      [0.83, 1.43],
      [0.36, 1.54],
      [0.17, 1.2],
      [0, 1.02],
      [-0.17, 1.2],
      [-0.36, 1.54],
      [-0.83, 1.43],
    ],
    0.36,
    bodyMat,
  );
  torso.scale.z = 1.22;
  torso.castShadow = true;
  torso.receiveShadow = true;
  jacket.add(torso);

  const leftPanelShade = makeExtrudedShape(
    [
      [-1.28, 1.03],
      [-1.05, -1.52],
      [-0.55, -1.75],
      [-0.1, -1.77],
      [-0.04, 0.88],
      [-0.22, 1.08],
      [-0.46, 1.41],
      [-0.86, 1.32],
    ],
    0.025,
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.065, depthWrite: false }),
  );
  leftPanelShade.position.z = 0.405;
  jacket.add(leftPanelShade);

  const rightPanelLight = makeExtrudedShape(
    [
      [0.1, 0.84],
      [0.08, -1.77],
      [0.58, -1.75],
      [1.05, -1.52],
      [1.28, 1.03],
      [0.86, 1.32],
      [0.48, 1.41],
      [0.24, 1.08],
    ],
    0.025,
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.08, depthWrite: false }),
  );
  rightPanelLight.position.z = 0.407;
  jacket.add(rightPanelLight);

  const lining = makeExtrudedShape(
    [
      [-0.18, 1.13],
      [0, 0.88],
      [0.24, 1.18],
      [0.44, 1.3],
      [0.35, 0.82],
      [0.13, 0.45],
      [0, 0.18],
      [-0.13, 0.45],
      [-0.35, 0.82],
      [-0.44, 1.3],
    ],
    0.08,
    liningMat,
  );
  lining.position.z = 0.46;
  lining.castShadow = true;
  jacket.add(lining);

  const frontLeft = makeExtrudedShape(
    [
      [-1.28, 1.03],
      [-1.06, -1.52],
      [-0.58, -1.78],
      [-0.06, -1.83],
      [-0.03, 0.7],
      [-0.2, 0.98],
      [-0.43, 1.37],
      [-0.86, 1.31],
    ],
    0.04,
    bodyMat,
  );
  frontLeft.position.z = 0.55;
  jacket.add(frontLeft);

  const frontRight = makeExtrudedShape(
    [
      [0.11, 0.66],
      [0.1, -1.83],
      [0.6, -1.78],
      [1.06, -1.52],
      [1.28, 1.03],
      [0.86, 1.31],
      [0.48, 1.37],
      [0.24, 0.98],
    ],
    0.04,
    bodyMat,
  );
  frontRight.position.z = 0.555;
  jacket.add(frontRight);

  addSleeve(jacket, -1, sleeveMat, ribMat);
  addSleeve(jacket, 1, sleeveMat, ribMat);
  addRibBand(jacket, ribMat, collarMat);
  addPocket(jacket, -0.73, -0.72, sleeveMat);
  addPlacketAndSnaps(jacket, seamMat, snapMat, darkSnapMat);

  const label = makeLabel();
  label.position.set(0, 1.22, 0.53);
  jacket.add(label);

  return jacket;
}

function addSleeve(jacket: THREE.Group, side: -1 | 1, sleeveMat: THREE.Material, ribMat: THREE.Material) {
  const sleeve = new THREE.Group();
  sleeve.position.set(side * 1.23, 0.08, -0.04);
  sleeve.rotation.z = side * -0.19;
  sleeve.rotation.y = side * 0.18;

  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.75, 16, 32), sleeveMat);
  upper.scale.set(0.94, 1, 0.58);
  upper.position.y = -0.08;
  upper.castShadow = true;
  upper.receiveShadow = true;
  sleeve.add(upper);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.24, 48), ribMat);
  cuff.scale.z = 0.56;
  cuff.position.y = -1.06;
  cuff.castShadow = true;
  cuff.receiveShadow = true;
  sleeve.add(cuff);

  jacket.add(sleeve);
}

function addRibBand(jacket: THREE.Group, ribMat: THREE.Material, collarMat: THREE.Material) {
  const collarLeft = makeExtrudedShape(
    [
      [-0.6, 1.46],
      [-0.1, 1.18],
      [-0.28, 0.82],
      [-0.77, 1.03],
      [-0.9, 1.34],
    ],
    0.18,
    collarMat,
  );
  collarLeft.position.z = 0.55;
  collarLeft.rotation.z = -0.12;
  jacket.add(collarLeft);

  const collarRight = makeExtrudedShape(
    [
      [0.6, 1.46],
      [0.1, 1.18],
      [0.28, 0.82],
      [0.77, 1.03],
      [0.9, 1.34],
    ],
    0.18,
    collarMat,
  );
  collarRight.position.z = 0.55;
  collarRight.rotation.z = 0.12;
  jacket.add(collarRight);

  const backCollar = new THREE.Mesh(new THREE.TorusGeometry(0.59, 0.11, 18, 64, Math.PI * 1.08), collarMat);
  backCollar.position.set(0, 1.38, 0.37);
  backCollar.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.97);
  backCollar.scale.set(1.16, 0.58, 1);
  backCollar.castShadow = true;
  jacket.add(backCollar);

  const waistband = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.03, 0.28, 64, 1, true, 0, Math.PI), ribMat);
  waistband.position.set(0, -1.82, 0.12);
  waistband.rotation.x = Math.PI / 2;
  waistband.scale.y = 0.48;
  waistband.castShadow = true;
  waistband.receiveShadow = true;
  jacket.add(waistband);
}

function addPocket(jacket: THREE.Group, x: number, y: number, material: THREE.Material) {
  const welt = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.035), material);
  welt.position.set(x, y, 0.61);
  welt.rotation.z = -0.34;
  welt.castShadow = true;
  jacket.add(welt);

  const stitch = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x - 0.08, y - 0.3, 0.635),
      new THREE.Vector3(x + 0.15, y + 0.34, 0.635),
    ]),
    new THREE.LineBasicMaterial({ color: "#c8ccd0", transparent: true, opacity: 0.8 }),
  );
  jacket.add(stitch);
}

function addPlacketAndSnaps(
  jacket: THREE.Group,
  seamMat: THREE.Material,
  snapMat: THREE.Material,
  darkSnapMat: THREE.Material,
) {
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.67, 0.035), seamMat);
  placket.position.set(0.08, -0.44, 0.61);
  placket.castShadow = true;
  jacket.add(placket);

  for (const y of [0.62, 0.08, -0.46, -1.0, -1.48, -1.74]) {
    const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.032, 36), snapMat);
    snap.position.set(0.22, y, 0.66);
    snap.rotation.x = Math.PI / 2;
    snap.castShadow = true;
    jacket.add(snap);
  }

  const blackSnap = new THREE.Mesh(new THREE.CylinderGeometry(0.071, 0.071, 0.04, 36), darkSnapMat);
  blackSnap.position.set(-0.22, 0.62, 0.665);
  blackSnap.rotation.x = Math.PI / 2;
  blackSnap.castShadow = true;
  jacket.add(blackSnap);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.071, 0.01, 8, 32), snapMat);
  ring.position.copy(blackSnap.position);
  ring.position.z += 0.025;
  ring.rotation.x = Math.PI / 2;
  jacket.add(ring);
}

function makeExtrudedShape(points: number[][], depth: number, material: THREE.Material) {
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

function makeLabel() {
  const group = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#efe7d3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#857d6b";
    ctx.font = "bold 38px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MANIOR KIRS", 256, 102);
    ctx.font = "24px Arial";
    ctx.fillText("CUSTOM VARSITY", 256, 145);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.28),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  group.add(label);
  return group;
}

function fabricMaterial(color: string, type: "wool" | "leather" | "rib") {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: type === "leather" ? 0.46 : 0.9,
    metalness: 0,
    clearcoat: type === "leather" ? 0.45 : 0,
    clearcoatRoughness: 0.55,
    sheen: type === "wool" ? 0.82 : 0.28,
    sheenRoughness: 0.78,
    normalScale: new THREE.Vector2(type === "rib" ? 0.72 : 0.34, type === "rib" ? 0.72 : 0.34),
  });

  const maps = makeFabricMaps(color, type);
  material.map = maps.color;
  material.normalMap = maps.normal;
  material.roughnessMap = maps.roughness;
  return material;
}

function makeFabricMaps(color: string, type: "wool" | "leather" | "rib") {
  const size = 256;
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
    roughCtx.fillStyle = type === "leather" ? "#9c9c9c" : "#d7d7d7";
    roughCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 3600; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const lightness = type === "leather" ? 0.14 : 0.24;
      const shade = 1 + (Math.random() - 0.5) * lightness;
      colorCtx.fillStyle = `rgb(${Math.round(base.r * 255 * shade)}, ${Math.round(base.g * 255 * shade)}, ${Math.round(base.b * 255 * shade)})`;
      colorCtx.globalAlpha = type === "rib" ? 0.18 : 0.32;
      colorCtx.fillRect(x, y, type === "leather" ? 2.4 : 1.2, type === "leather" ? 1.1 : 1.2);
      normalCtx.fillStyle = `rgb(${120 + Math.random() * 18}, ${120 + Math.random() * 18}, 255)`;
      normalCtx.globalAlpha = 0.35;
      normalCtx.fillRect(x, y, 1.5, 1.5);
    }

    if (type === "rib") {
      colorCtx.globalAlpha = 0.34;
      normalCtx.globalAlpha = 0.65;
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

    if (type === "leather") {
      colorCtx.globalAlpha = 0.22;
      colorCtx.strokeStyle = "#ffffff";
      for (let i = 0; i < 120; i += 1) {
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
    texture.repeat.set(type === "rib" ? 2.4 : 3.2, type === "rib" ? 1.2 : 3.2);
    texture.colorSpace = texture === colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  });

  return { color: colorTexture, normal: normalTexture, roughness: roughTexture };
}

function brighten(color: string, amount: number) {
  return new THREE.Color(color).lerp(new THREE.Color("#fff7d8"), amount);
}
