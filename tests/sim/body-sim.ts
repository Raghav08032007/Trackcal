// A 3D body filmed by a virtual camera, for testing rep counting the way real phones and laptops see people:
// any body size, camera angle, height and distance, landscape or portrait, with the jitter, uncertain joints and
// dropped frames the pose model really produces. Deterministic for a given seed, so failures can be replayed.
import type { Landmark } from "../../src/lib/pose/types";

export type Vec = [number, number, number];                      // x across, y up, z towards the camera at yaw 0
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const rad = (d: number) => d * Math.PI / 180;

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return { next, range: (a: number, b: number) => a + (b - a) * next(), pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)], gauss: () => { const u = Math.max(1e-9, next()), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); } };
}

export type Build = { height: number; shoulder: number; hip: number; torso: number; upperArm: number; forearm: number; thigh: number; shin: number };
export function build(r: ReturnType<typeof rng>): Build {
  const h = r.range(1.5, 1.92), k = h / 1.75;
  return { height: h, shoulder: .39 * k * r.range(.9, 1.1), hip: .27 * k * r.range(.9, 1.15), torso: .52 * k * r.range(.95, 1.05),
    upperArm: .31 * k, forearm: .27 * k, thigh: .45 * k * r.range(.95, 1.05), shin: .44 * k * r.range(.95, 1.05) };
}

export type Arms = "hips" | "forward" | "crossed" | "down" | "prayer" | "overhead";
/** One moment of a standing-to-crouching body: knee bend in degrees (0 standing), lean of the torso, where the arms are. */
export type Stance = { knee: number; shinTilt: number; lean: number; width: number; turnout: number; arms: Arms; heelLift?: number; bow?: number; sway?: number };

/** All 33 landmarks in metres, feet on the floor at y = 0. */
export function body3d(b: Build, s: Stance): Vec[] {
  const p: Vec[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec);
  const legs: { ankle: Vec; knee: Vec; hip: Vec }[] = [];
  for (const side of [0, 1]) {
    const sign = side ? 1 : -1, turn = rad(s.turnout) * sign;
    const forward: Vec = [Math.sin(turn), 0, Math.cos(turn)];
    const ankle: Vec = [sign * s.width / 2, .08 + (s.heelLift ?? 0), 0];
    const shin = rad(s.shinTilt), thighBack = rad(s.knee - s.shinTilt);
    const knee = add(ankle, add(mul(forward, Math.sin(shin) * b.shin), [0, Math.cos(shin) * b.shin, 0]));
    const hip = add(knee, add(mul(forward, -Math.sin(thighBack) * b.thigh), [0, Math.cos(thighBack) * b.thigh, 0]));
    legs.push({ ankle, knee, hip });
    p[27 + side] = ankle; p[25 + side] = knee;
    p[29 + side] = add(ankle, mul(forward, -.06)); p[29 + side][1] = .02;             // heel
    p[31 + side] = add(ankle, mul(forward, .19)); p[31 + side][1] = .01;              // toes
  }
  const pelvis: Vec = mul(add(legs[0].hip, legs[1].hip), .5);
  p[23] = add(pelvis, [-b.hip / 2, 0, 0]); p[24] = add(pelvis, [b.hip / 2, 0, 0]);
  const lean = rad(s.lean + (s.bow ?? 0)), sway = rad(s.sway ?? 0);
  const up: Vec = [Math.sin(sway), Math.cos(lean), Math.sin(lean)];
  const chest = add(pelvis, mul(up, b.torso));
  p[11] = add(chest, [-b.shoulder / 2, 0, 0]); p[12] = add(chest, [b.shoulder / 2, 0, 0]);
  const head = add(chest, mul(up, .22));
  p[0] = add(head, [0, 0, .09]);
  for (const [i, dx, dy] of [[1, -.03, .03], [2, -.04, .03], [3, -.05, .03], [4, .03, .03], [5, .04, .03], [6, .05, .03], [7, -.08, 0], [8, .08, 0], [9, -.025, -.04], [10, .025, -.04]] as const)
    p[i] = add(head, [dx, dy, i >= 7 && i <= 8 ? -.02 : .07]);
  for (const side of [0, 1]) {
    const sign = side ? 1 : -1, sh = p[11 + side];
    let elbow: Vec, wrist: Vec;
    switch (s.arms) {
      case "hips": elbow = add(sh, [sign * .12, -b.upperArm * .85, -.08]); wrist = add(p[23 + side], [sign * .06, .03, .02]); break;
      case "forward": elbow = add(sh, [0, -.03, b.upperArm]); wrist = add(elbow, [0, -.02, b.forearm]); break;
      case "crossed": elbow = add(sh, [sign * .02, -b.upperArm * .7, .15]); wrist = add(p[11 + (1 - side)], [0, -.1, .12]); break;
      case "prayer": elbow = add(sh, [sign * .1, -b.upperArm * .9, .1]); wrist = add(chest, [sign * .02, -.18, .2]); break;
      case "overhead": elbow = add(sh, [sign * .05, b.upperArm, 0]); wrist = add(elbow, [0, b.forearm, 0]); break;
      default: elbow = add(sh, [sign * .03, -b.upperArm, 0]); wrist = add(elbow, [0, -b.forearm, .02]);
    }
    p[13 + side] = elbow; p[15 + side] = wrist;
    for (const [j, d] of [[17, .06], [19, .07], [21, .04]] as const) p[j + side] = add(wrist, [sign * .01, -d * .5, d * .4]);
  }
  return p;
}

export type Camera = { yaw: number; height: number; distance: number; fov: number; width: number; height_px: number; roll?: number; pan?: number };
/** Pinhole camera looking at the person's middle. Coordinates come out as the pose model gives them: 0–1 across and down. */
export function film(points: Vec[], cam: Camera, aim = .9) {
  const yaw = rad(cam.yaw), eye: Vec = [Math.sin(yaw) * cam.distance + (cam.pan ?? 0), cam.height, Math.cos(yaw) * cam.distance];
  const target: Vec = [0, aim, 0];
  const fwd = norm(sub(target, eye)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  // fov is across the picture's width. x is a share of the width and y of the height, with square pixels.
  const aspect = cam.width / cam.height_px, fx = .5 / Math.tan(rad(cam.fov) / 2), fy = fx * aspect, roll = rad(cam.roll ?? 0);
  return points.map(pt => {
    const d = sub(pt, eye), x = dot(d, right), y = dot(d, up), z = dot(d, fwd);
    const rx = x * Math.cos(roll) - y * Math.sin(roll), ry = x * Math.sin(roll) + y * Math.cos(roll);
    return { x: .5 + fx * rx / z, y: .5 - fy * ry / z, z };
  });
}
function sub(a: Vec, b: Vec): Vec { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a: Vec, b: Vec) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec, b: Vec): Vec { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a: Vec): Vec { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; }

export type Noise = { jitter: number; dropRate: number; flicker: number };
/** What the pose model reports: positions with jitter, a visibility for each joint (lower for the far side and anything out of
 *  frame or hidden behind the body), and now and then no person at all. */
export function observe(points: Vec[], cam: Camera, noise: Noise, r: ReturnType<typeof rng>, aim = .9): Landmark[] | null {
  if (r.next() < noise.dropRate) return null;
  const shot = film(points, cam, aim), yaw = rad(cam.yaw);
  const towards: Vec = [Math.sin(yaw), 0, Math.cos(yaw)];
  return shot.map((pt, i) => {
    const out = pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1;
    const side = i >= 11 ? (i % 2 === 1 ? -1 : 1) : 0;                       // left joints are odd
    const facing = side ? side * towards[0] : 0;                            // > 0: this side turned towards the camera
    let vis = .97 - (facing < -.5 ? .2 : 0) - (out ? .75 : 0);
    if (r.next() < noise.flicker) vis -= r.range(.2, .5);
    const j = noise.jitter * (i >= 15 && i <= 22 ? 1.6 : 1);
    return { x: pt.x + r.gauss() * j, y: pt.y + r.gauss() * j, z: 0, visibility: Math.max(0, Math.min(1, vis)), presence: Math.max(0, Math.min(1, vis + .02)) };
  });
}
