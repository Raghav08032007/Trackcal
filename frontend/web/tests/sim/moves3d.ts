// Lunges and push-ups as real 3D bodies, filmed like squats (tests/sim/squat-sim.ts): any camera angle, height and distance,
// phone or laptop, with tracking jitter and dropped frames. Knees and elbows are placed by solving the two-bone limb, so they
// bend the way real ones do.
import type { PoseFrame } from "../../src/lib/pose/types";
import { build, observe, rng, type Build, type Camera, type Noise, type Vec } from "./body-sim";
import type { Setup } from "./squat-sim";

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec) => Math.hypot(...a);
const norm = (a: Vec): Vec => { const n = len(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ease = (k: number) => .5 - .5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));

/** Middle joint of a two-bone limb from its ends, bending towards `bend` (a direction, not a point). */
export function joint(start: Vec, end: Vec, a: number, b: number, bend: Vec): Vec {
  const d = Math.min(len(sub(end, start)), (a + b) * .999), u = norm(sub(end, start));
  const along = (a * a - b * b + d * d) / (2 * d), off = Math.sqrt(Math.max(0, a * a - along * along));
  const n = norm(sub(bend, mul(u, dot(bend, u))));
  return add(add(start, mul(u, along)), mul(n, off));
}

function head(p: Vec[], chest: Vec, up: Vec, forward: Vec) {
  const h = add(chest, mul(up, .22));
  p[0] = add(h, mul(forward, .09));
  for (const [i, dx] of [[1, -.03], [2, -.04], [3, -.05], [4, .03], [5, .04], [6, .05], [7, -.08], [8, .08], [9, -.025], [10, .025]] as const) p[i] = add(add(h, [dx, i === 9 || i === 10 ? -.04 : .03, 0]), mul(forward, i >= 7 && i <= 8 ? -.02 : .07));
}
function hands(p: Vec[]) { for (const side of [0, 1]) for (const [j, d] of [[17, .06], [19, .07], [21, .04]] as const) p[j + side] = add(p[15 + side], [side ? .01 : -.01, -d * .3, d * .4]); }

/** Standing lunge. Feet on the floor at their own positions (z forward); the hips drop by `drop` of the way to the bottom. */
export function lungeBody(b: Build, frontZ: number, backZ: number, drop: number, lead: 0 | 1, arms: "hips" | "down"): Vec[] {
  const p: Vec[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec);
  const legLen = b.thigh + b.shin, feetY = .08, w = b.hip / 2;
  const front: Vec = [lead ? w : -w, feetY, frontZ], back: Vec = [lead ? -w : w, feetY + .06 * drop, backZ];   // back heel rises as you go down
  const midZ = (frontZ + backZ) / 2 + .03, spread = Math.abs(frontZ - backZ) / 2;
  const top = feetY + Math.sqrt(Math.max(.01, (legLen * .985) ** 2 - spread * spread)), bottom = feetY + b.shin * 1.02;
  const hipY = top - (top - bottom) * drop, pelvis: Vec = [0, hipY, midZ];
  const hipL: Vec = add(pelvis, [-w, 0, 0]), hipR: Vec = add(pelvis, [w, 0, 0]);
  p[23] = hipL; p[24] = hipR;
  const legs = lead ? [[hipL, back], [hipR, front]] : [[hipL, front], [hipR, back]];
  legs.forEach(([hip, ankle], side) => {
    p[25 + side] = joint(hip, ankle, b.thigh, b.shin, [0, 0, 1]);
    p[27 + side] = ankle; p[29 + side] = add(ankle, [0, -.06, -.06]); p[31 + side] = add(ankle, [0, -.07, .17]);
  });
  const up: Vec = [0, 1, .04], chest = add(pelvis, mul(up, b.torso));
  p[11] = add(chest, [-b.shoulder / 2, 0, 0]); p[12] = add(chest, [b.shoulder / 2, 0, 0]);
  head(p, chest, up, [0, 0, 1]);
  for (const side of [0, 1]) {
    const sign = side ? 1 : -1, sh = p[11 + side];
    if (arms === "hips") { p[13 + side] = add(sh, [sign * .13, -b.upperArm * .85, -.08]); p[15 + side] = add(p[23 + side], [sign * .06, .03, .02]); }
    else { p[13 + side] = add(sh, [sign * .03, -b.upperArm, 0]); p[15 + side] = add(p[13 + side], [0, -b.forearm, .02]); }
  }
  hands(p);
  return p;
}

/** Push-up on toes (or knees): a straight body pivoting at the feet, hands planted under the shoulders. `depth` 0 is arms
 *  straight, 1 the chest near the floor. `sag` drops the hips below the line (form slipping), `pike` lifts them. */
export function pushupBody(b: Build, depth: number, opts: { width: number; flare: number; knees?: boolean; sag?: number; pike?: number; tap?: 0 | 1 | null }): Vec[] {
  const p: Vec[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec);
  const arm = b.upperArm + b.forearm, pivotZ = 0, pivotY = opts.knees ? .05 : .03;
  const bodyLen = opts.knees ? b.thigh + b.torso + .05 : b.thigh + b.shin + b.torso + .05;
  // Arms nearly straight at the top (elbows about 165), elbows about 70 at the deepest; depth 0.55 is about 100.
  const topY = arm * .985 + .03, bottomY = .03 + Math.sqrt(b.upperArm ** 2 + b.forearm ** 2 - 2 * b.upperArm * b.forearm * Math.cos(70 * Math.PI / 180));
  const shY = topY - (topY - bottomY) * depth, shZ = Math.sqrt(Math.max(.01, bodyLen ** 2 - (shY - pivotY) ** 2));
  const along = norm([0, shY - pivotY, shZ - pivotZ]), chest: Vec = [0, shY, shZ];
  const handZ = Math.sqrt(Math.max(.01, bodyLen ** 2 - (topY - pivotY) ** 2)) + .02;   // hands stay where they were planted at the top
  const hipFrac = opts.knees ? .05 / bodyLen + b.thigh / bodyLen : (b.thigh + b.shin) / bodyLen;
  const pelvis = add(add([0, pivotY, pivotZ], mul(along, bodyLen * hipFrac)), [0, -(opts.sag ?? 0) + (opts.pike ?? 0), 0]);
  p[23] = add(pelvis, [-b.hip / 2, 0, 0]); p[24] = add(pelvis, [b.hip / 2, 0, 0]);
  for (const side of [0, 1]) {
    const sign = side ? 1 : -1;
    if (opts.knees) { p[25 + side] = [sign * b.hip / 2, .04, pivotZ]; p[27 + side] = [sign * b.hip / 2, .12, pivotZ - b.shin * .9]; }
    else { const knee = add(add([0, pivotY, pivotZ], mul(along, b.shin)), [sign * b.hip / 2, 0, 0]); p[25 + side] = knee; p[27 + side] = [sign * .1, .07, pivotZ + .02]; }
    p[29 + side] = add(p[27 + side], [0, -.03, -.06]); p[31 + side] = add(p[27 + side], [0, -.06, -.12]);
    p[11 + side] = add(chest, [sign * b.shoulder / 2, 0, 0]);
    const tapping = opts.tap === side, hand: Vec = tapping ? add(p[12 - side], [-sign * .02, .03, .02]) : [sign * b.shoulder / 2 * opts.width, .03, handZ];
    p[15 + side] = hand;
    p[13 + side] = tapping ? add(p[11 + side], mul(sub(hand, p[11 + side]), .5)) : joint(p[11 + side], hand, b.upperArm, b.forearm, norm([sign * opts.flare, .3, -1 + opts.flare]));
  }
  head(p, chest, along, [0, -.3, 1]);
  hands(p);
  // People set the camera so all of them is in view: the body's middle sits where the camera points.
  return p.map(v => [v[0], v[1], v[2] - bodyLen * .5] as Vec);
}

const camFor = (r: ReturnType<typeof rng>, yaws: number[], floorPhone: boolean): Camera => {
  const laptop = !floorPhone && r.next() < .6, yaw = r.pick(yaws) + r.range(-8, 8);
  return laptop ? { yaw, height: r.range(.7, 1.0), distance: r.range(1.8, 3.0), fov: r.range(62, 78), width: 1280, height_px: 720, roll: r.range(-2, 2) }
    : { yaw, height: floorPhone ? r.range(.08, .4) : r.range(.6, 1.2), distance: r.range(1.5, 2.6), fov: r.range(60, 70), width: floorPhone && r.next() < .5 ? 1280 : 720, height_px: floorPhone && r.next() < .5 ? 720 : 1280, roll: r.range(-3, 3) };
};
const noiseFor = (r: ReturnType<typeof rng>): Noise => ({ jitter: r.range(.002, .008), dropRate: r.range(0, .02), flicker: r.range(0, .035) });

function film(r: ReturnType<typeof rng>, cam: Camera, aim: number, fps: number) {
  const nz = noiseFor(r), frames: PoseFrame[] = [];
  let t = 1000;
  const push = (pts: Vec[]) => { const o = observe(pts, cam, nz, r, aim); frames.push({ landmarks: o ? [o] : [], timestamp: Math.round(t), width: cam.width, height: cam.height_px, brightness: 120 }); t += 1000 / fps * r.range(.85, 1.15); };
  return { frames, push, now: () => t, noise: nz };
}

/** A lunge set: stepping lunges (feet together between reps) or a stationary split squat, alternating legs or one leg. */
export function lungeSet(seed: number): Setup {
  const r = rng(seed * 31 + 7), b = build(r), cam = camFor(r, [90, 90, 60, 30, 0, -30, -60, -90], false), fps = r.pick([15, 20, 24, 30]);
  const style = r.pick(["step", "step", "split"] as const), alternate = style === "step" && r.next() < .7, arms = r.pick(["hips", "down"] as const);
  const stride = (b.thigh + b.shin) * r.range(.75, 1.05), reps = Math.round(r.range(6, 10)), depthMin = r.range(.62, .8), tempo = r.range(.8, 1.6);
  const f = film(r, cam, .85, fps);
  const hold = (pts: () => Vec[], s: number) => { const end = f.now() + s * 1000; while (f.now() < end) f.push(pts()); };
  const move = (s: number, at: (k: number) => Vec[]) => { const start = f.now(), end = start + s * 1000; while (f.now() < end) f.push(at(ease((f.now() - start) / (end - start)))); };
  let lead: 0 | 1 = r.next() < .5 ? 0 : 1;
  if (style === "split") hold(() => lungeBody(b, stride / 2, -stride / 2, 0, lead, arms), 1.2);
  else hold(() => lungeBody(b, .02, -.02, 0, lead, arms), 1.2);
  for (let i = 0; i < reps; i++) {
    const depth = r.range(depthMin, 1);
    if (style === "step") {
      move(tempo * .6, k => lungeBody(b, stride * k, -.02, 0, lead, arms));
      move(tempo, k => lungeBody(b, stride, -.02, depth * k, lead, arms));
      hold(() => lungeBody(b, stride, -.02, depth, lead, arms), r.range(0, .4));
      move(tempo, k => lungeBody(b, stride, -.02, depth * (1 - k), lead, arms));
      move(tempo * .6, k => lungeBody(b, stride * (1 - k), -.02, 0, lead, arms));
      hold(() => lungeBody(b, .02, -.02, 0, lead, arms), r.range(.3, 1.2));
      if (alternate) lead = lead ? 0 : 1;
    } else {
      move(tempo, k => lungeBody(b, stride / 2, -stride / 2, depth * k, lead, arms));
      hold(() => lungeBody(b, stride / 2, -stride / 2, depth, lead, arms), r.range(0, .4));
      move(tempo, k => lungeBody(b, stride / 2, -stride / 2, depth * (1 - k), lead, arms));
      hold(() => lungeBody(b, stride / 2, -stride / 2, 0, lead, arms), r.range(.3, 1.2));
    }
  }
  return { seed, label: "lunge", reps, frames: f.frames, meta: { style, alternate: alternate ? 1 : 0, yaw: Math.round(cam.yaw), device: cam.width > cam.height_px ? "landscape" : "portrait", camH: +cam.height.toFixed(2), fps, depthMin: +depthMin.toFixed(2) } };
}

/** A push-up set, filmed side-on, at an angle or head-on, by a phone on the floor or a laptop on a table. */
export function pushupSet(seed: number, opts: { knees?: boolean } = {}): Setup {
  const r = rng(seed * 53 + 11), b = build(r), floor = r.next() < .65, cam = camFor(r, [90, 90, 70, 45, 0, -45, -70, -90], floor), fps = r.pick([15, 20, 24, 30]);
  const reps = Math.round(r.range(5, 12)), width = r.range(1.0, 1.6), flare = r.range(.2, .8), depthMin = r.range(.55, .8), tempo = r.range(.7, 1.4), sag = r.range(0, .04);
  const f = film(r, cam, .3, fps);
  const truth: number[] = [];
  const body = (d: number) => { const pts = pushupBody(b, d, { width, flare, knees: opts.knees, sag }); const e = pts[13], u = sub(pts[11], e), v = sub(pts[15], e); truth.push(Math.acos(Math.max(-1, Math.min(1, dot(u, v) / len(u) / len(v)))) * 180 / Math.PI); return pts; };
  const hold = (d: number, s: number) => { const end = f.now() + s * 1000; while (f.now() < end) f.push(body(d)); };
  const move = (s: number, from: number, to: number) => { const start = f.now(), end = start + s * 1000; while (f.now() < end) f.push(body(from + (to - from) * ease((f.now() - start) / (end - start)))); };
  hold(0, 1.2);
  for (let i = 0; i < reps; i++) { const d = r.range(depthMin, 1); move(tempo, 0, d); hold(d, r.range(0, .3)); move(tempo * .8, d, 0); hold(0, r.range(.2, 1)); }
  hold(0, .6);
  return { seed, label: "pushup", reps, frames: f.frames, truth, meta: { yaw: Math.round(cam.yaw), floor: floor ? 1 : 0, camH: +cam.height.toFixed(2), device: cam.width > cam.height_px ? "landscape" : "portrait", fps, depthMin: +depthMin.toFixed(2), width: +width.toFixed(2) } };
}

/** Movements that must not count as push-ups or lunges. */
export function notARep(seed: number, kind: "plank" | "hips" | "taps" | "step" | "stand" | "walk"): Setup {
  const r = rng(seed * 97 + 5), b = build(r), floorMove = ["plank", "hips", "taps"].includes(kind);
  const cam = camFor(r, floorMove ? [90, 60, 0, -60, -90] : [90, 45, 0, -45, -90], floorMove && r.next() < .6), f = film(r, cam, floorMove ? .3 : .85, r.pick([15, 24, 30]));
  const cycle = (s: number, at: (k: number) => Vec[]) => { const start = f.now(), end = start + s * 1000; while (f.now() < end) f.push(at((f.now() - start) / (end - start))); };
  const wave = (k: number) => Math.sin(Math.PI * k);
  for (let i = 0; i < 8; i++) {
    if (kind === "plank") cycle(2, () => pushupBody(b, .05, { width: 1.2, flare: .4 }));
    else if (kind === "hips") cycle(2, k => pushupBody(b, 0, { width: 1.2, flare: .4, pike: .25 * wave(k) }));
    else if (kind === "taps") cycle(1.2, k => pushupBody(b, 0, { width: 1.2, flare: .4, tap: k > .25 && k < .75 ? (i % 2 ? 1 : 0) : null }));
    else if (kind === "step") cycle(2.2, k => lungeBody(b, (b.thigh + b.shin) * .8 * wave(k), -.02, 0, 0, "hips"));
    else if (kind === "walk") cycle(1.1, k => lungeBody(b, .3 * Math.sin(2 * Math.PI * k), -.3 * Math.sin(2 * Math.PI * k), .03 * wave(2 * k), (Math.floor(k * 2) % 2) as 0 | 1, "down"));
    else cycle(2, () => lungeBody(b, .02, -.02, 0, 0, "down"));
  }
  return { seed, label: kind, reps: 0, frames: f.frames, meta: { yaw: Math.round(cam.yaw) } };
}
