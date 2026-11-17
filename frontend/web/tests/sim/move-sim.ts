// Every exercise's own motion (the same one the page shows as the example), lifted into 3D at real body proportions and
// filmed like squats are: any camera angle near the recommended one, laptop or phone, with tracking noise and dropped frames.
import { MOVES, blend, full, layout, placement, type Move } from "../../src/lib/pose/exercise-motions";
import { SessionTracker } from "../../src/lib/pose/session-tracker";
import type { ExerciseKind, PoseFrame } from "../../src/lib/pose/types";
import { film, observe, rng, type Camera, type Vec } from "./body-sim";

/** Half the distance across the body for each joint, in metres, for a 1.75 m adult. */
const HALF: Record<number, number> = { 11: .19, 12: .19, 13: .22, 14: .22, 15: .21, 16: .21, 17: .21, 18: .21, 19: .21, 20: .21, 21: .21, 22: .21, 23: .13, 24: .13, 25: .11, 26: .11, 27: .11, 28: .11, 29: .11, 30: .11, 31: .12, 32: .12 };
const SCALE = 2.1;                                             // the motions' units to metres (their torso .25 is a 52 cm torso)

/** The motion's flat key pose placed in 3D: side moves run forward and back, front moves out to the sides. */
export function pose3d(m: Move, p: ReturnType<typeof full>, start: [number, number], size: number, floor: number): Vec[] {
  const flat = layout({ ...m, camera: m.view }, p, start);
  const out: Vec[] = [];
  for (let id = 0; id < 33; id++) {
    const at = flat[id] ?? flat[id % 2 ? 11 : 12] ?? [start[0], start[1]];
    const across = (at[0] - start[0]) * SCALE * size, up = (start[1] - at[1]) * SCALE * size + floor;
    const side = id < 11 ? 0 : id % 2 === 1 ? -1 : 1, half = (HALF[id] ?? 0) * size;
    out.push(m.view === "side" ? [side * half, up, across] : [across, up, 0]);
  }
  // From the front the flat layout already spreads left and right; keep the head a little forward of the body.
  for (let id = 0; id <= 10; id++) out[id][2] += .08 * size;
  return out;
}

export type Run = { kind: ExerciseKind; seed: number; reps: number; counted: number; meta: Record<string, string | number> };
/** One set of an exercise, filmed from near the angle the app recommends for it. */
/** labels: for each frame, -1 while holding the start position, otherwise the rep it belongs to. Each rep goes to its own depth
 *  (65-100% of the full movement), as real people do. */
export function exerciseSet(kind: ExerciseKind, seed: number, opts: { reps?: number; spread?: number; depth?: [number, number]; distort?: (p: ReturnType<typeof full>, key: number) => ReturnType<typeof full>; move?: Move; timing?: number[]; per?: [number, number]; rest?: [number, number] } = {}): { frames: PoseFrame[]; reps: number; labels: number[]; meta: Run["meta"] } {
  const r = rng(seed * 7919 + kind.length * 104729), m = opts.move ?? MOVES[kind], keys = m.keys.map(full).map((k, i) => opts.distort ? opts.distort(k, i) : k), start = placement(m), size = r.range(.88, 1.1);
  // Stand the body on the floor: its lowest point in the starting pose goes to just above it.
  const lowest = Math.min(...pose3d(m, keys[0], start, size, 0).map(v => v[1])), floor = .03 - lowest;
  // People set the camera so all of them is in view: centre the starting pose where the camera points.
  const base = pose3d(m, keys[0], start, size, floor), cx = base.reduce((a, v) => a + v[0], 0) / 33, cz = base.reduce((a, v) => a + v[2], 0) / 33;
  const place = (p: ReturnType<typeof full>) => pose3d(m, p, start, size, floor).map(v => [v[0] - cx, v[1], v[2] - cz] as Vec);
  // The angle the app asks for: side-on for a move forward and back, head-on for one out to the sides.
  const best = m.view === "side" ? 90 : 0;
  const laptop = r.next() < .5, yaw = best + r.range(-(opts.spread ?? 25), opts.spread ?? 25) * (r.next() < .5 ? -1 : 1);
  const lying = keys.some(k => Math.abs(k.torso) > 60);
  const cam: Camera = laptop
    ? { yaw, height: lying ? r.range(.3, .8) : r.range(.72, 1.05), distance: r.range(2.2, 3.4), fov: r.range(62, 78), width: 1280, height_px: 720, roll: r.range(-2, 2) }
    : { yaw, height: lying ? r.range(.25, .7) : r.range(.6, 1.2), distance: r.range(2.0, 3.0), fov: r.range(60, 70), width: 720, height_px: 1280, roll: r.range(-3, 3) };
  // Asked to step back until all of them is in view, people do: the whole move (every key pose) fits in the picture.
  const aimAt = lying ? .35 : .9, fits = () => keys.every(k => film(place(k), cam, aimAt).slice(11).every(q => q.x > .02 && q.x < .98 && q.y > .02 && q.y < .98));
  while (!fits() && cam.distance < 6) cam.distance += .2;
  const noise = { jitter: r.range(.002, .007), dropRate: r.range(0, .02), flicker: r.range(0, .03) }, fps = r.pick([15, 20, 24, 30]);
  const reps = opts.reps ?? Math.round(r.range(5, 9)), frames: PoseFrame[] = [], labels: number[] = [];
  let label = -1;
  let t = 1000;
  const aim = lying ? .35 : .9;
  const shot = (p: ReturnType<typeof full>) => {
    const pts = observe(place(p), cam, noise, r, aim);
    labels.push(label);
    frames.push({ landmarks: pts ? [pts] : [], timestamp: Math.round(t), width: cam.width, height: cam.height_px, brightness: 120 });
    t += 1000 / fps * r.range(.85, 1.15);
  };
  const per = r.range(...(opts.per ?? [1.6, 2.6]));
  for (let end = t + 1200; t < end;) shot(keys[0]);
  for (let rep = 0; rep < reps; rep++) {
    const legs = keys.length, depth = r.range(...(opts.depth ?? [.65, 1])), scaled = keys.map((k, i) => i ? blend(keys[0], k, depth) : k);
    label = rep;
    for (let leg = 0; leg < legs; leg++) {
      const a = scaled[leg], b = scaled[(leg + 1) % legs], start2 = t, end = t + per * 1000 * (opts.timing?.[leg] ?? 1 / legs) * r.range(.85, 1.15);
      while (t < end) shot(blend(a, b, .5 - .5 * Math.cos(Math.PI * (t - start2) / (end - start2))));
    }
    label = -1;
    for (let end = t + r.range(...(opts.rest ?? [200, 900])); t < end;) shot(keys[0]);
  }
  for (let end = t + 800; t < end;) shot(keys[0]);
  return { frames, reps, labels, meta: { yaw: Math.round(yaw), device: laptop ? "laptop" : "phone", fps, camH: +cam.height.toFixed(2) } };
}

export function countExercise(kind: ExerciseKind, frames: PoseFrame[]) {
  const t = new SessionTracker(kind);
  for (const f of frames) t.frame(f);
  return { counted: t.counter.reps, rejected: t.counter.rejections, mismatches: t.counter.mismatches };
}
