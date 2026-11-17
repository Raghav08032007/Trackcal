// Squat sessions and look-alike movements, filmed in many real-world setups, for measuring rep counting.
import { SessionTracker } from "../../src/lib/pose/session-tracker";
import type { ExerciseKind, ExerciseLevel, PoseFrame } from "../../src/lib/pose/types";
import { body3d, build, observe, rng, type Arms, type Camera, type Noise, type Stance } from "./body-sim";

export type Setup = { seed: number; label: string; reps: number; frames: PoseFrame[]; meta: Record<string, string | number>; truth?: number[] };
const ease = (k: number) => .5 - .5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

/** Where a person stands relative to the camera, and how they film. */
export function camera(r: ReturnType<typeof rng>, kind?: "laptop" | "phone" | "any"): Camera {
  const which = kind && kind !== "any" ? kind : r.pick(["laptop", "phone"] as const);
  const yaw = r.pick([0, 0, 10, 25, 40, 60, 80, 90, -20, -45, -90]) + r.range(-6, 6);
  return which === "laptop"
    ? { yaw, height: r.range(.72, 1.05), distance: r.range(2.1, 3.4), fov: r.range(62, 78), width: 1280, height_px: 720, roll: r.range(-2, 2) }
    : { yaw, height: r.range(.5, 1.3), distance: r.range(2.0, 3.2), fov: r.range(60, 70), width: 720, height_px: 1280, roll: r.range(-4, 4) };
}
export const noise = (r: ReturnType<typeof rng>): Noise => ({ jitter: r.range(.002, .009), dropRate: r.range(0, .025), flicker: r.range(0, .04) });

type Rep = { depth: number; down: number; bottom: number; up: number; top: number };
/** A real squat set: depth varies rep to rep (people tire), speed varies, there are pauses at the top. */
function squatPlan(r: ReturnType<typeof rng>, reps: number, depth: [number, number]): Rep[] {
  const tempo = r.range(.6, 1.8);                           // seconds for the way down
  return Array.from({ length: reps }, () => ({ depth: r.range(...depth), down: tempo * r.range(.85, 1.2), bottom: r.range(0, .5), up: tempo * r.range(.7, 1.1), top: r.range(.25, 1.6) }));
}

/** Frames for a squat set filmed by `cam`. The first second is standing still, as people do when they press start. */
export function squatSet(seed: number, opts: { depth?: [number, number]; arms?: Arms; reps?: number; cam?: "laptop" | "phone" | "any"; width?: [number, number] } = {}): Setup {
  const r = rng(seed), b = build(r), cam = camera(r, opts.cam), nz = noise(r), fps = r.pick([15, 20, 24, 30]);
  const arms: Arms = opts.arms ?? r.pick(["hips", "forward", "crossed", "down", "prayer"]);
  const reps = opts.reps ?? Math.round(r.range(6, 12)), plan = squatPlan(r, reps, opts.depth ?? [55, 110]);
  const width = b.hip * r.range(...(opts.width ?? [1.0, 1.9])), turnout = r.range(0, 30), baseLean = r.range(0, 8), ankles = r.range(.3, .42), hinge = r.range(.4, .7);
  const stance = (bend: number): Stance => {
    const shinTilt = bend * ankles;                                     // ankles bend about a third as much as the knee
    return { knee: bend, shinTilt, lean: baseLean + (bend - shinTilt) * hinge, width, turnout, arms, sway: Math.sin(t / 900) * 1.5 };
  };
  const frames: PoseFrame[] = [], truth: number[] = [];
  let t = 1000;
  const push = (bend: number) => {
    truth.push(bend);
    const pts = observe(body3d(b, stance(bend)), cam, nz, r);
    frames.push({ landmarks: pts ? [pts] : [], timestamp: Math.round(t), width: cam.width, height: cam.height_px, brightness: 120 });
    t += 1000 / fps * r.range(.85, 1.15);
  };
  const hold = (bend: number, s: number) => { const end = t + s * 1000; while (t < end) push(bend); };
  const move = (from: number, to: number, s: number) => { const start = t, end = t + s * 1000; while (t < end) push(from + (to - from) * ease((t - start) / (end - start))); };
  hold(0, 1.2);
  for (const rep of plan) { move(0, rep.depth, rep.down); hold(rep.depth, rep.bottom); move(rep.depth, 0, rep.up); hold(0, rep.top); }
  hold(0, .8);
  return { seed, label: "squat", reps, frames, meta: { yaw: Math.round(cam.yaw), camH: +cam.height.toFixed(2), dist: +cam.distance.toFixed(2), device: cam.width > cam.height_px ? "laptop" : "phone", arms, fps, depthMin: Math.round(Math.min(...plan.map(p => p.depth))), widthHips: +(width / b.hip).toFixed(2), jitter: +nz.jitter.toFixed(4) }, truth };
}

/** Movements that are not squats and must count nothing: bowing, picking something up, swaying, reaching up, sitting down once. */
export function lookalike(seed: number, kind: "bow" | "pickup" | "sway" | "reach" | "sit" | "still" | "walk"): Setup {
  const r = rng(seed), b = build(r), cam = camera(r), nz = noise(r), fps = r.pick([15, 24, 30]);
  const frames: PoseFrame[] = [];
  let t = 1000;
  const base: Stance = { knee: 0, shinTilt: 0, lean: 2, width: b.hip * 1.2, turnout: 10, arms: "down" };
  const push = (s: Stance) => { const pts = observe(body3d(b, s), cam, nz, r); frames.push({ landmarks: pts ? [pts] : [], timestamp: Math.round(t), width: cam.width, height: cam.height_px, brightness: 120 }); t += 1000 / fps; };
  const cycle = (s: number, at: (k: number) => Stance) => { const start = t, end = t + s * 1000; while (t < end) push(at((t - start) / (end - start))); };
  const wave = (k: number) => Math.sin(Math.PI * k);
  for (let i = 0; i < 8; i++) {
    if (kind === "bow") cycle(r.range(1.5, 2.5), k => ({ ...base, bow: 75 * wave(k), knee: 8 * wave(k), shinTilt: 3 * wave(k) }));
    else if (kind === "pickup") cycle(r.range(2, 3), k => ({ ...base, bow: 85 * wave(k), knee: 25 * wave(k), shinTilt: 8 * wave(k), arms: "down" }));
    else if (kind === "sway") cycle(r.range(1.5, 2.5), k => ({ ...base, sway: 12 * Math.sin(2 * Math.PI * k), knee: 6 * wave(k), shinTilt: 2 * wave(k) }));
    else if (kind === "reach") cycle(r.range(1.5, 2.5), k => ({ ...base, arms: k > .2 && k < .8 ? "overhead" : "down", heelLift: .04 * wave(k) }));
    else if (kind === "walk") cycle(r.range(1, 1.6), k => ({ ...base, knee: 15 * Math.abs(Math.sin(2 * Math.PI * k)), shinTilt: 6 * Math.abs(Math.sin(2 * Math.PI * k)), width: b.hip * (1 + .3 * Math.sin(2 * Math.PI * k)) }));
    else if (kind === "still") cycle(2, () => base);
    else if (kind === "sit") { if (i === 0) cycle(2.5, k => ({ ...base, knee: 95 * Math.min(1, k * 1.4), shinTilt: 12, lean: 15 })); else cycle(2, () => ({ ...base, knee: 95, shinTilt: 12, lean: 15 })); }
  }
  return { seed, label: kind, reps: 0, frames, meta: { yaw: Math.round(cam.yaw), device: cam.width > cam.height_px ? "laptop" : "phone" } };
}

/** Runs a session through the same tracker the camera page uses, and says what it counted and why reps were turned away. */
export function count(setup: Setup, exercise: ExerciseKind = "squat", level: ExerciseLevel = "beginner") {
  const tracker = new SessionTracker(exercise, level);
  for (const f of setup.frames) tracker.frame(f);
  return { counted: tracker.counter.reps, rejected: { ...tracker.counter.rejections }, mismatches: [...tracker.counter.mismatches] };
}
