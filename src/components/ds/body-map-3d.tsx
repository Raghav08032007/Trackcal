// A 3D body you can turn and tap to mark surgeries and injuries. Every part is also a plain button beside it, so the map works with a
// keyboard, a screen reader, or a phone that can't draw 3D. Three.js loads only when the map is on screen.
import { useEffect, useRef, useState } from "react";
import type * as Three from "three";

export type PartStatus = "none" | "recovered" | "healing" | "avoid";
export type BodyPart = { id: string; label: string };
export const BODY_PARTS: BodyPart[] = [
  { id: "neck", label: "Neck" }, { id: "shoulder_l", label: "Left shoulder" }, { id: "shoulder_r", label: "Right shoulder" },
  { id: "elbow_l", label: "Left elbow" }, { id: "elbow_r", label: "Right elbow" }, { id: "wrist_l", label: "Left wrist" }, { id: "wrist_r", label: "Right wrist" },
  { id: "chest", label: "Chest" }, { id: "abdomen", label: "Abdomen" }, { id: "lower_back", label: "Lower back" },
  { id: "hip_l", label: "Left hip" }, { id: "hip_r", label: "Right hip" }, { id: "knee_l", label: "Left knee" }, { id: "knee_r", label: "Right knee" },
  { id: "ankle_l", label: "Left ankle" }, { id: "ankle_r", label: "Right ankle" },
];
export const STATUS_TEXT: Record<PartStatus, string> = { none: "No issue", recovered: "Recovered", healing: "Healing", avoid: "Avoid for now" };
const STATUS_COLOR: Record<PartStatus, number> = { none: 0xd9d4ee, recovered: 0x16a36a, healing: 0xe59400, avoid: 0xd8343b };

type Piece = { part: string | null; kind: "capsule" | "sphere" | "box"; size: number[]; at: [number, number, number]; tilt?: number };
/** Simple stylised body, about 1.75 units tall, standing on y = 0. Pieces without a part are structure only. */
const PIECES: Piece[] = [
  { part: null, kind: "sphere", size: [.12], at: [0, 1.62, 0] },                       // head
  { part: "neck", kind: "capsule", size: [.05, .07], at: [0, 1.47, 0] },
  { part: "chest", kind: "capsule", size: [.17, .18], at: [0, 1.25, .01] },
  { part: "abdomen", kind: "capsule", size: [.145, .12], at: [0, 1.02, .02] },
  { part: "lower_back", kind: "box", size: [.22, .16, .04], at: [0, 1.0, -.13] },
  { part: "shoulder_l", kind: "sphere", size: [.075], at: [.235, 1.37, 0] }, { part: "shoulder_r", kind: "sphere", size: [.075], at: [-.235, 1.37, 0] },
  { part: null, kind: "capsule", size: [.05, .2], at: [.27, 1.2, 0], tilt: -.12 }, { part: null, kind: "capsule", size: [.05, .2], at: [-.27, 1.2, 0], tilt: .12 },
  { part: "elbow_l", kind: "sphere", size: [.055], at: [.295, 1.06, 0] }, { part: "elbow_r", kind: "sphere", size: [.055], at: [-.295, 1.06, 0] },
  { part: null, kind: "capsule", size: [.042, .2], at: [.31, .91, .02], tilt: -.05 }, { part: null, kind: "capsule", size: [.042, .2], at: [-.31, .91, .02], tilt: .05 },
  { part: "wrist_l", kind: "sphere", size: [.05], at: [.32, .77, .03] }, { part: "wrist_r", kind: "sphere", size: [.05], at: [-.32, .77, .03] },
  { part: "hip_l", kind: "sphere", size: [.095], at: [.1, .86, 0] }, { part: "hip_r", kind: "sphere", size: [.095], at: [-.1, .86, 0] },
  { part: null, kind: "capsule", size: [.075, .26], at: [.105, .66, 0] }, { part: null, kind: "capsule", size: [.075, .26], at: [-.105, .66, 0] },
  { part: "knee_l", kind: "sphere", size: [.068], at: [.105, .47, .01] }, { part: "knee_r", kind: "sphere", size: [.068], at: [-.105, .47, .01] },
  { part: null, kind: "capsule", size: [.055, .26], at: [.105, .27, -.01] }, { part: null, kind: "capsule", size: [.055, .26], at: [-.105, .27, -.01] },
  { part: "ankle_l", kind: "sphere", size: [.055], at: [.105, .08, 0] }, { part: "ankle_r", kind: "sphere", size: [.055], at: [-.105, .08, 0] },
  { part: null, kind: "box", size: [.09, .045, .2], at: [.105, .025, .05] }, { part: null, kind: "box", size: [.09, .045, .2], at: [-.105, .025, .05] },
];

export function BodyMap3D({ statuses, selected, onSelect }: { statuses: Record<string, PartStatus>; selected: string | null; onSelect: (id: string) => void }) {
  const stage = useRef<HTMLDivElement>(null), api = useRef<{ paint: (s: Record<string, PartStatus>, sel: string | null) => void } | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef({ statuses, selected, onSelect });
  latest.current = { statuses, selected, onSelect };

  useEffect(() => {
    const el = stage.current; if (!el) return;
    let disposed = false, cleanup = () => {};
    const start = async () => {
      let THREE: typeof Three;
      try { THREE = await import("three"); } catch { setFailed(true); return; }
      if (disposed) return;
      let renderer: Three.WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 20);
      camera.position.set(0, .95, 4.1); camera.lookAt(0, .88, 0);
      try { const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js"); const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; } catch { scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 2)); }
      const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2, 3, 3); scene.add(key);
      const body = new THREE.Group(); scene.add(body);
      const meshes: { mesh: Three.Mesh; part: string | null; mat: Three.MeshPhysicalMaterial }[] = [];
      for (const piece of PIECES) {
        const geometry = piece.kind === "sphere" ? new THREE.SphereGeometry(piece.size[0], 32, 20) : piece.kind === "box" ? new THREE.BoxGeometry(piece.size[0], piece.size[1], piece.size[2], 2, 2, 2) : new THREE.CapsuleGeometry(piece.size[0], piece.size[1], 8, 20);
        const mat = new THREE.MeshPhysicalMaterial({ color: 0xd9d4ee, roughness: .45, metalness: 0, clearcoat: .6, clearcoatRoughness: .35, sheen: .4 });
        const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...piece.at); if (piece.tilt) mesh.rotation.z = piece.tilt;
        mesh.userData.part = piece.part; body.add(mesh); meshes.push({ mesh, part: piece.part, mat });
      }
      const floor = new THREE.Mesh(new THREE.CircleGeometry(.55, 48), new THREE.MeshBasicMaterial({ color: 0x4f34e0, transparent: true, opacity: .12 }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const paint = (s: Record<string, PartStatus>, sel: string | null) => {
        for (const { part, mat, mesh } of meshes) {
          const status = part ? s[part] ?? "none" : "none";
          mat.color.setHex(part ? STATUS_COLOR[status] : 0xcfc9e6);
          mat.emissive.setHex(part && status !== "none" ? STATUS_COLOR[status] : part && part === sel ? 0x6a4dff : 0x000000);  // a chosen part keeps its status colour, brighter
          mat.emissiveIntensity = part && part === sel ? .75 : .18;
          mesh.scale.setScalar(part && part === sel ? 1.12 : 1);  // the chosen part swells a little as well as glowing
        }
        draw();
      };
      const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); draw(); };
      let frame = 0;
      const draw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); }); };
      // Turn by dragging; a tap without a drag picks the part under the finger.
      const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
      let down: { x: number; y: number; turn: number } | null = null, idle = true;
      const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, turn: body.rotation.y }; idle = false; el.setPointerCapture(e.pointerId); };
      const onMove = (e: PointerEvent) => { if (!down) return; body.rotation.y = down.turn + (e.clientX - down.x) / 120; draw(); };
      const onUp = (e: PointerEvent) => {
        if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
        if (moved > 6) return;
        const r = el.getBoundingClientRect(); pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObjects(meshes.filter(m => m.part).map(m => m.mesh))[0];
        if (hit?.object.userData.part) latest.current.onSelect(hit.object.userData.part as string);
      };
      el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp);
      // A slow turn until touched, so it reads as 3D at a glance; none under reduced motion.
      const calm = () => document.documentElement.dataset.motion === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let spin = 0, visible = true;
      const loop = () => { if (idle && visible && !calm()) { body.rotation.y += .006; draw(); } spin = requestAnimationFrame(loop); };
      const seen = typeof IntersectionObserver === "undefined" ? { observe() {}, disconnect() {} } : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); seen.observe(el);
      const observer = new ResizeObserver(resize); observer.observe(el);
      api.current = { paint }; resize(); paint(latest.current.statuses, latest.current.selected); loop();
      el.dataset.ready = "true";
      cleanup = () => {
        cancelAnimationFrame(spin); cancelAnimationFrame(frame); observer.disconnect(); seen.disconnect();
        el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp);
        for (const { mesh, mat } of meshes) { mesh.geometry.dispose(); mat.dispose(); }
        renderer.dispose(); renderer.domElement.remove(); api.current = null;
      };
    };
    // Load the 3D only once the map scrolls into view.
    if (typeof IntersectionObserver === "undefined") { void start(); return () => { disposed = true; cleanup(); }; }
    const gate = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { gate.disconnect(); void start(); } }, { rootMargin: "200px" });
    gate.observe(el);
    return () => { disposed = true; gate.disconnect(); cleanup(); };
  }, []);
  useEffect(() => { api.current?.paint(statuses, selected); }, [statuses, selected]);

  return <div className="ds-body-stage" ref={stage} role="img" aria-label="3D body map. Use the list of body parts to choose a part.">
    {failed && <p className="ds-body-hint">3D isn&apos;t available on this device. Use the list to mark a body part.</p>}
    {!failed && <p className="ds-body-hint" aria-hidden="true">Drag to turn · tap a part</p>}
  </div>;
}
