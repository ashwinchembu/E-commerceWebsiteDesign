import { useEffect, useRef } from "react";
import * as THREE from "three";

interface JacketViewer3DProps {
  bodyColor: string;
  sleeveColor: string;
  collarColor: string;
  cuffColor: string;
}

export function JacketViewer3D({ bodyColor, sleeveColor, collarColor, cuffColor }: JacketViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    jacket: THREE.Group;
    animId: number;
    isDragging: boolean;
    prevMouse: { x: number; y: number };
    rotY: number;
    rotX: number;
  } | null>(null);

  // Init scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f0ede8");

    // Camera
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(0, 0.5, 5);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(3, 5, 3);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffffff, 0.5);
    rimLight.position.set(0, 4, 2);
    scene.add(rimLight);

    // Build jacket
    const jacket = buildJacket(bodyColor, sleeveColor, collarColor, cuffColor);
    jacket.rotation.y = 0.3;
    scene.add(jacket);

    // Shadow plane
    const shadowGeo = new THREE.PlaneGeometry(10, 10);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -2.2;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotY = 0.3;
    let rotX = -0.1;
    let animId = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      mount.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      rotY += dx * 0.012;
      rotX += dy * 0.008;
      rotX = Math.max(-0.5, Math.min(0.5, rotX));
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { isDragging = false; };

    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", onPointerUp);
    mount.addEventListener("pointercancel", onPointerUp);

    // Wheel zoom
    const onWheel = (e: WheelEvent) => {
      camera.position.z = Math.max(3, Math.min(8, camera.position.z + e.deltaY * 0.005));
    };
    mount.addEventListener("wheel", onWheel, { passive: true });

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isDragging) rotY += 0.004; // idle spin
      jacket.rotation.y = rotY;
      jacket.rotation.x = rotX;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      const w2 = mount.clientWidth;
      const h2 = mount.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener("resize", handleResize);

    sceneRef.current = { renderer, scene, camera, jacket, animId, isDragging, prevMouse, rotY, rotX };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("pointercancel", onPointerUp);
      mount.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update colors without rebuilding scene
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { scene, jacket } = ref;
    scene.remove(jacket);
    const newJacket = buildJacket(bodyColor, sleeveColor, collarColor, cuffColor);
    newJacket.rotation.y = jacket.rotation.y;
    newJacket.rotation.x = jacket.rotation.x;
    ref.jacket = newJacket;
    scene.add(newJacket);
  }, [bodyColor, sleeveColor, collarColor, cuffColor]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />
  );
}

function mat(color: string, roughness = 0.75, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
}

function buildJacket(bodyColor: string, sleeveColor: string, collarColor: string, cuffColor: string): THREE.Group {
  const g = new THREE.Group();

  const bodyMat = mat(bodyColor, 0.85);
  const sleeveMat = mat(sleeveColor, 0.3, 0.05);
  const collarMat = mat(collarColor, 0.6);
  const cuffMat = mat(cuffColor, 0.7);
  const buttonMat = mat("#c8a84b", 0.2, 0.85);
  const liningMat = mat("#1a1a1a", 0.9);

  const addMesh = (geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // Torso
  addMesh(new THREE.BoxGeometry(1.9, 2.3, 0.72), bodyMat, 0, 0, 0);

  // Lining strip (open front)
  const liningM = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 2.0), liningMat);
  liningM.position.set(0, 0, 0.37);
  g.add(liningM);

  // Collar
  addMesh(new THREE.CylinderGeometry(0.40, 0.46, 0.30, 18, 1, true, -0.5, 3.8), collarMat, 0, 1.22, 0.05);
  // Collar inner (rib)
  const collarInner = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 18, 1, true, -0.5, 3.8), mat("#ddddc8", 0.6));
  collarInner.position.set(0, 1.20, 0.05);
  g.add(collarInner);

  // Shoulders
  addMesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), bodyMat, -0.96, 1.08, 0);
  addMesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), bodyMat, 0.96, 1.08, 0);

  // Left sleeve
  const lSleeveGrp = new THREE.Group();
  lSleeveGrp.position.set(-1.28, 0.52, 0);
  lSleeveGrp.rotation.z = -0.2;
  const lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 1.55, 14), sleeveMat);
  lSleeve.castShadow = true;
  lSleeveGrp.add(lSleeve);
  // Left cuff
  const lCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14), cuffMat);
  lCuff.position.y = -0.85;
  lCuff.castShadow = true;
  lSleeveGrp.add(lCuff);
  g.add(lSleeveGrp);

  // Right sleeve
  const rSleeveGrp = new THREE.Group();
  rSleeveGrp.position.set(1.28, 0.52, 0);
  rSleeveGrp.rotation.z = 0.2;
  const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 1.55, 14), sleeveMat);
  rSleeve.castShadow = true;
  rSleeveGrp.add(rSleeve);
  const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14), cuffMat);
  rCuff.position.y = -0.85;
  rCuff.castShadow = true;
  rSleeveGrp.add(rCuff);
  g.add(rSleeveGrp);

  // Waistband
  addMesh(new THREE.CylinderGeometry(0.96, 0.92, 0.24, 22), cuffMat, 0, -1.22, 0);

  // Snap buttons
  for (const y of [-0.7, -0.2, 0.3, 0.85]) {
    addMesh(new THREE.SphereGeometry(0.038, 8, 8), buttonMat, 0.02, y, 0.37);
  }

  // Right chest pocket outline
  const pocketGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.33, 0.22));
  const pocketLine = new THREE.LineSegments(pocketGeo, new THREE.LineBasicMaterial({ color: "#00000033" }));
  pocketLine.position.set(0.5, 0.42, 0.365);
  g.add(pocketLine);

  return g;
}
