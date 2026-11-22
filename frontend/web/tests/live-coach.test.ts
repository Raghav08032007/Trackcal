import { describe, expect, it } from "vitest";
import { EXERCISE_CONFIG } from "@/lib/pose/exercise-config";
import { normalize } from "@/lib/pose/landmarks";
import { LiveCoach, type CoachMessage } from "@/lib/pose/live-coach";
import { SessionTracker } from "@/lib/pose/session-tracker";
import type { ExerciseKind, Landmark } from "@/lib/pose/types";
import { exerciseSet } from "./sim/move-sim";

type Opts = Parameters<typeof exerciseSet>[2];
function coached(kind: ExerciseKind, seed: number, opts: Opts = {}) {
  const set = exerciseSet(kind, seed, opts), tracker = new SessionTracker(kind), coach = new LiveCoach(kind, tracker.config), said: CoachMessage[] = [];
  for (const f of set.frames) { const r = tracker.frame(f); if (!r) continue; const m = coach.update(r, tracker.lastBody, normalize(f), tracker.counter, f.timestamp); if (m) said.push(m); }
  return { said, reps: tracker.counter.reps, truth: set.reps };
}
const REP_KEYS = new Set(["shallow", "too_fast", "too_slow", "lost", "different", "better"]);

describe("live coach", () => {
  it("stays quiet about posture, angle and visibility when the exercise is done well", () => {
    const kinds = Object.keys(EXERCISE_CONFIG) as ExerciseKind[]; let sets = 0, noisy = 0; const which: string[] = [];
    for (const kind of kinds) for (const seed of [11, 12]) {
      const extra = coached(kind, seed, { depth: [.95, 1], spread: 15 }).said.filter(m => !REP_KEYS.has(m.key) && !m.key.startsWith("still_"));
      sets++; if (extra.length) { noisy++; which.push(`${kind}:${extra.map(m => m.key).join("/")}`); }
    }
    if (process.env.SIM_BENCH) console.log(`false alarms in ${noisy}/${sets} clean sets`, which);
    expect(noisy / sets).toBeLessThanOrEqual(.05);
  }, 600000);

  it("tells you to turn side-on when a side-only exercise is filmed from the front", () => {
    const { said } = coached("kickback", 3, { yaw: 0 });
    expect(said.some(m => m.key === "turn_side")).toBe(true);
  }, 60000);

  it("tells you to face the camera when a front-only exercise is filmed side-on", () => {
    const { said } = coached("raise", 4, { yaw: 90 });
    expect(said.some(m => m.key === "face_camera")).toBe(true);
  }, 60000);

  it("says how far a half rep went and what to do", () => {
    const { said } = coached("squat", 5, { depth: [.35, .45], spread: 10 });
    const half = said.find(m => m.key === "shallow");
    expect(half).toBeTruthy();
    expect(Number(half!.vars!.pct)).toBeGreaterThan(15);
    expect(Number(half!.vars!.pct)).toBeLessThan(100);
  }, 60000);

  it("asks for a real hinge when rows are done standing upright", () => {
    const { said } = coached("row", 6, { spread: 10, distort: p => ({ ...p, torso: 0 }) });
    expect(said.some(m => m.key === "hinge")).toBe(true);
  }, 60000);

  it("praises the first good rep after a fix, and never repeats one fix within seconds", () => {
    const coach = new LiveCoach("overhead", EXERCISE_CONFIG.overhead), body = { tilt: 5, facing: .1 } as never;
    const pose = (elbowX: number): Landmark[] => { const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: 1 })); p[11] = { x: .5, y: .3, z: 0, visibility: 1 }; p[13] = { x: elbowX, y: .15, z: 0, visibility: 1 }; p[15] = { x: .5, y: .05, z: 0, visibility: 1 }; p[23] = { x: .5, y: .6, z: 0, visibility: 1 }; return p; };
    const r = (phase: "DOWN" | "UP", reps: number) => ({ reps, phase, confidence: 1, message: "", accepted: true, paused: false, rejection: null, progress: .5 });
    const said: (string | undefined)[] = [];
    for (let t = 0; t < 2000; t += 50) said.push(coach.update(r("DOWN", 0), body, pose(.65), { attempts: [], mismatches: [] }, t)?.key);   // elbow flared forward
    expect(said.filter(k => k === "elbow_up")).toHaveLength(1);
    expect(coach.update(r("UP", 1), body, pose(.5), { attempts: [], mismatches: [] }, 2100)?.key).toBe("better");
  });
});
