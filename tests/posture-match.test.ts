// Posture compared with the example: good form gets no tips; clear faults get the right one.
import { describe, expect, it } from "vitest";
import { EXERCISES, EXERCISE_VARIANTS, type ExerciseKind } from "@/lib/pose/types";
import { SessionTracker } from "@/lib/pose/session-tracker";
import { PostureMatcher, formPoints, postureRules } from "@/lib/pose/posture-match";
import { MOVES } from "@/lib/pose/exercise-motions";
import { exerciseSet } from "./sim/move-sim";

type Distort = NonNullable<NonNullable<Parameters<typeof exerciseSet>[2]>["distort"]>;
function tips(kind: ExerciseKind, seed: number, distort?: Distort) {
  const s = exerciseSet(kind, seed, { distort }), t = new SessionTracker(kind), m = new PostureMatcher(kind, MOVES[kind].view), got: string[] = [];
  for (const f of s.frames) { const r = t.frame(f); if (!r) continue; const tip = m.update(t.lastBody, r.phase, f.timestamp); if (tip) got.push(tip); }
  return got;
}
const BASE = (Object.keys(EXERCISES) as ExerciseKind[]).filter(k => !EXERCISE_VARIANTS[k]);

describe("posture compared with the example", () => {
  it("every exercise has form points to show with its example", () => {
    for (const k of Object.keys(EXERCISES) as ExerciseKind[]) expect(formPoints(k).length, k).toBeGreaterThan(0);
  });
  it("arms are only asked to stay straight where the arms do the work", () => {
    expect(postureRules("squat").map(r => r.metric)).not.toContain("elbow");
    expect(postureRules("crunch").map(r => r.metric)).not.toContain("elbow");
    expect(postureRules("raise").map(r => r.metric)).toContain("elbow");
  });
  it("good form, filmed many ways, gets no posture tips on any exercise", () => {
    const noisy = BASE.flatMap(k => [1, 2].map(seed => [k, tips(k, seed)] as const)).filter(([, g]) => g.length).map(([k, g]) => `${k}: ${g[0]}`);
    expect(noisy).toEqual([]);
  }, 600000);
  const faults: [ExerciseKind, string, Distort, RegExp][] = [
    ["pushup", "hips sagging", p => ({ ...p, thigh: [p.thigh[0] + 25, p.thigh[1] + 25], shin: [p.shin[0] + 25, p.shin[1] + 25] }), /straight line/],
    ["curl", "leaning back", p => ({ ...p, torso: p.torso - 35 }), /straight/],
    ["curl", "leaning forward", p => ({ ...p, torso: p.torso + 35 }), /Stand up straight/],
    ["legraise", "bent knees", p => ({ ...p, shin: [p.thigh[0] - 70, p.thigh[1] - 70] }), /legs straight/],
    ["raise", "bent elbows", p => ({ ...p, fore: [p.arm[0] + 70, p.arm[1] - 70] }), /arms straight/],
  ];
  for (const [kind, what, distort, tip] of faults) it(`${kind} with ${what} gets the right tip`, () => {
    for (const seed of [1, 2, 3]) expect(tips(kind, seed, distort).some(t => tip.test(t)), `seed ${seed}`).toBe(true);
  }, 120000);
});
