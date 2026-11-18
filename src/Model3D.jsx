// Visionneuse 3D (chargée à la demande : three.js n'alourdit pas le reste du site)
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function Model3D({ url, height = "min(52vh, 440px)" }) {
  const host = useRef(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    const el = host.current;
    let disposed = false, raf = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xf3f1ea);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888070, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 10, 7); scene.add(sun);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.screenSpacePanning = true;

    const resize = () => {
      const w = el.clientWidth || 300, h = el.clientHeight || 300;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    new GLTFLoader().load(url, (gltf) => {
      if (disposed) return;
      const model = gltf.scene; scene.add(model);
      model.traverse((o) => { if (o.isMesh && !o.geometry.attributes.normal) [].concat(o.material).forEach((m) => { m.flatShading = true; m.needsUpdate = true; }); });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const r = Math.max(size.x, size.y, size.z) || 1;
      controls.target.copy(c);
      camera.position.set(c.x + r * 1.1, c.y + r * 0.8, c.z + r * 1.4);
      camera.near = r / 100; camera.far = r * 50; camera.updateProjectionMatrix();
      controls.maxDistance = r * 6; controls.update();
      setState("ready");
    }, undefined, () => !disposed && setState("error"));

    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();

    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [url]);

  return <div className="model3d" style={{ height }}>
    <div ref={host} className="model3d-host" aria-label="Maquette 3D : fais-la tourner avec le doigt ou la souris" role="img" />
    {state === "loading" && <div className="model3d-msg" role="status">⏳ Chargement de la maquette…</div>}
    {state === "error" && <div className="model3d-msg" role="alert">⚠️ Impossible de charger la maquette 3D.</div>}
    {state === "ready" && <div className="model3d-hint">👆 Tourne · pince pour zoomer · 2 doigts pour déplacer</div>}
  </div>;
}
