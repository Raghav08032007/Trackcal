import { msg, t } from "../i18n";
import { angle, normalize } from "../pose/landmarks";
import { full, layout, placement } from "../pose/exercise-motions";
import type { Landmark, PoseFrame } from "../pose/types";
import { ASANAS, moveOf, type Asana } from "./asanas";

/** How closely a person matches an asana, 0-100, and the one correction that would help most.
 *
 *  The person and the asana's demo pose are measured the same way: the angle at each shoulder, elbow, hip and knee, how
 *  far the torso is from upright, and how far apart the thighs are. Each measure scores full marks within its tolerance
 *  and falls to zero at three times it. Left and right are tried both ways round (so either side can lead, and a mirrored
 *  camera doesn't matter) and the better fit counts. Anything the camera can't see clearly is left out, never failed. */
export type Metric = "torso" | "spread" | "arm0" | "arm1" | "elbow0" | "elbow1" | "hip0" | "hip1" | "knee0" | "knee1";
export type Angles = Partial<Record<Metric, number>>;
const RULES: Record<string, { tol: number; weight: number }> = {
  torso: { tol: 15, weight: 2 }, spread: { tol: 20, weight: 1 }, arm: { tol: 25, weight: 1 }, elbow: { tol: 30, weight: 0.5 },
  hip: { tol: 20, weight: 1.5 }, knee: { tol: 20, weight: 1.5 },
};
const SEEN = 0.5;
const ruleOf = (m: Metric) => RULES[m.replace(/[01]$/, "")];

/** Joint angles in degrees. A joint whose points the camera can't see is missing. */
export function measure(p: Landmark[]): Angles {
  const ok = (...ids: number[]) => ids.every(id => (p[id]?.visibility ?? 0) >= SEEN && (p[id]?.presence ?? 1) >= SEEN);
  const out: Angles = {};
  const at = (m: Metric, ids: [number, number, number]) => { if (ok(...ids)) { const v = angle(p[ids[0]], p[ids[1]], p[ids[2]]); if (Number.isFinite(v)) out[m] = v; } };
  for (const i of [0, 1] as const) {
    const [sh, el, wr, hip, knee, ank] = [11 + i, 13 + i, 15 + i, 23 + i, 25 + i, 27 + i];
    at(`arm${i}`, [hip, sh, el]); at(`elbow${i}`, [sh, el, wr]); at(`hip${i}`, [sh, hip, knee]); at(`knee${i}`, [hip, knee, ank]);
  }
  if (ok(11, 12, 23, 24)) {
    const s = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 }, h = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 };
    // 0 upright, 90 lying along the floor, 180 upside down. Unsigned, so facing left or right reads the same.
    const up = Math.atan2(Math.abs(s.x - h.x), h.y - s.y) * 180 / Math.PI;
    if (Number.isFinite(up)) out.torso = up;
    if (ok(25, 26)) { const v = angle(p[25], h as Landmark, p[26]); if (Number.isFinite(v)) out.spread = v; }
  }
  return out;
}

/** The demo pose as the camera would see it: 33 points in a 0-1 picture. */
export function demoPoints(a: Asana): Landmark[] {
  const m = moveOf(a), s = layout(m, full(a.pose), placement(m));
  return Array.from({ length: 33 }, (_, id) => { const q = s[id] ?? s[11]; return { x: q[0], y: q[1], visibility: 1, presence: 1 }; });
}
const targets = new Map<string, Angles>();
export const targetOf = (a: Asana) => { let v = targets.get(a.id); if (!v) { v = measure(demoPoints(a)); targets.set(a.id, v); } return v; };

const SWAP: Record<Metric, Metric> = { torso: "torso", spread: "spread", arm0: "arm1", arm1: "arm0", elbow0: "elbow1", elbow1: "elbow0", hip0: "hip1", hip1: "hip0", knee0: "knee1", knee1: "knee0" };
export type Miss = { metric: Metric; actual: number; target: number; loss: number };
export type Match = { score: number; seen: number; worst: Miss | null };

function compare(target: Angles, body: Angles, swap: boolean): Match {
  let total = 0, got = 0, all = 0, worst: Miss | null = null;
  for (const [m, want] of Object.entries(target) as [Metric, number][]) {
    const { tol, weight } = ruleOf(m);
    all += weight;
    const actual = body[swap ? SWAP[m] : m];
    if (actual === undefined) continue;
    const d = Math.abs(actual - want), s = d <= tol ? 1 : Math.max(0, 1 - (d - tol) / (2 * tol)), loss = (1 - s) * weight;
    total += weight; got += s * weight;
    if (loss > 0 && (!worst || loss > worst.loss)) worst = { metric: swap ? SWAP[m] : m, actual, target: want, loss };
  }
  let score = total ? Math.round(100 * got / total) : 0;
  // The body's orientation is a gate, not one joint among many: standing straight is not lying straight.
  if (target.torso !== undefined && body.torso !== undefined && Math.abs(body.torso - target.torso) > 45) {
    score = Math.min(score, 30); worst = { metric: 'torso', actual: body.torso, target: target.torso, loss: 99 };
  }
  return { score, seen: all ? total / all : 0, worst };
}

/** The match for one asana. seen is the share of what matters that the camera could see (0-1). */
export function match(a: Asana, body: Angles): Match {
  const target = targetOf(a), straight = compare(target, body, false), swapped = a.sides || a.view === "front" ? compare(target, body, true) : straight;
  return swapped.score > straight.score ? swapped : straight;
}

/** The asana a body looks most like, of those given (for following a sequence such as Surya Namaskar). */
export function closest(body: Angles, among: Asana[] = ASANAS) {
  let best: { asana: Asana; match: Match } | null = null;
  for (const a of among) { const m = match(a, body); if (m.seen >= 0.5 && (!best || m.score > best.match.score)) best = { asana: a, match: m }; }
  return best;
}

const SIDE = [msg("left"), msg("right")];
/** One plain correction for the joint furthest from the pose. Sides are the person's own left and right. */
export function tipFor(miss: Miss | null, a: Asana): string | null {
  if (!miss) return null;
  const more = miss.actual < miss.target, side = /[01]$/.test(miss.metric) ? t(SIDE[Number(miss.metric.slice(-1))]) : "";
  switch (miss.metric.replace(/[01]$/, "")) {
    case "torso": return a.pose.torso && Math.abs(a.pose.torso) > 45
      ? (more ? t("Fold further from the hips.") : t("Lift your chest a little."))
      : (more ? t("Lean into the pose a little more.") : t("Bring your body more upright."));
    case "knee": return more ? t("Straighten your {side} leg.", { side }) : t("Bend your {side} knee more.", { side });
    case "hip": return more ? t("Open the front of your {side} hip; lengthen the body.", { side }) : t("Fold more at your {side} hip.", { side });
    case "arm": return more ? t("Raise your {side} arm higher.", { side }) : t("Lower your {side} arm a little.", { side });
    case "elbow": return more ? t("Straighten your {side} arm.", { side }) : t("Bend your {side} elbow more.", { side });
    case "spread": return more ? t("Step your feet wider apart.") : t("Bring your feet closer together.");
  }
  return null;
}

/** Score over time for one asana: smoothed, timed only while the match is good enough, with one tip at a time. */
export const IN_POSE = 70, GOOD = 85;
const GRACE_MS = 1000, MAX_STEP_MS = 250, SMOOTH = 0.35, TIP_EVERY_MS = 4000;
export type YogaLive = { score: number; visible: boolean; inPose: boolean; held: number; current: number; best: number; average: number; tip: string | null };
export class AsanaTracker {
  held = 0; current = 0; best = 0; private smooth = -1; private last = -1; private lastIn = -Infinity; private streak = 0;
  private sum = 0; private samples = 0; private lastTip = -Infinity; private tip: string | null = null;
  constructor(readonly asana: Asana) {}
  update(frame: PoseFrame): YogaLive {
    const t0 = frame.timestamp, p = normalize(frame), body = p ? measure(p) : {}, m = match(this.asana, body), visible = m.seen >= 0.5;
    const step = this.last < 0 ? 0 : Math.min(MAX_STEP_MS, Math.max(0, t0 - this.last)); this.last = t0;
    if (visible) this.smooth = this.smooth < 0 ? m.score : this.smooth + SMOOTH * (m.score - this.smooth);
    const score = visible ? Math.round(this.smooth) : 0, inPose = visible && score >= IN_POSE;
    if (inPose) { this.streak++; this.lastIn = t0; if (this.streak >= 2) { this.held += step; this.current += step; this.best = Math.max(this.best, this.current); this.sum += score; this.samples++; } }
    else { this.streak = 0; if (t0 - this.lastIn > GRACE_MS) this.current = 0; }
    if (visible && score < GOOD && t0 - this.lastTip >= TIP_EVERY_MS) { const next = tipFor(m.worst, this.asana); if (next) { this.tip = next; this.lastTip = t0; } }
    if (score >= GOOD) this.tip = null;
    return { score, visible, inPose: inPose && this.streak >= 2, held: this.held, current: this.current, best: this.best, average: this.samples ? Math.round(this.sum / this.samples) : 0, tip: this.tip };
  }
  reset() { this.held = 0; this.current = 0; this.best = 0; this.smooth = -1; this.last = -1; this.lastIn = -Infinity; this.streak = 0; this.sum = 0; this.samples = 0; this.lastTip = -Infinity; this.tip = null; }
}
