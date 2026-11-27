// The equipment you have at hand, and how a workout adapts to it: an exercise that needs gear you don't have is swapped
// for the closest one you can do (same body area, similar level, the same movement with other gear when possible),
// or skipped. Saved on this device; "not set" means no filtering (everything is offered, as before).
import { useLocalState } from "@/lib/use-local-state";
import { EXERCISES, EXERCISE_VARIANTS, gearOf, type ExerciseGear, type ExerciseKind } from "@/lib/pose/types";
import type { Circuit } from "@/lib/workout-coach";

/** Gear you can own; bodyweight is always available. */
export const OWNABLE_GEAR: Exclude<ExerciseGear, "body">[] = ["chair", "dumbbell", "barbell", "kettlebell", "band", "cable", "bar"];
export type MyGear = ExerciseGear[] | null;   // null: not set yet
export const MY_GEAR_KEY = "trackcal:my-gear";
export const useMyGear = () => useLocalState<MyGear>(MY_GEAR_KEY, null);

/** Onboarding's "What do you have?" answer as camera gear; nothing answered means not set. */
export function gearFromProfile(equipment: readonly string[] | undefined | null): MyGear {
  if (!equipment?.length) return null;
  const map: Record<string, ExerciseGear[]> = { chair: ["chair"], dumbbells: ["dumbbell"], machine: ["cable", "barbell"], band: ["band"], kettlebell: ["kettlebell"], bar: ["bar"] };
  return [...new Set(equipment.flatMap(e => map[e] ?? []))];
}

/** Can you do this exercise with what you have? Unset gear means yes. */
export const canDo = (kind: ExerciseKind, mine: MyGear) => { const gear = gearOf(kind); return mine === null || gear === "body" || mine.includes(gear); };
/** What you would need for it (null for bodyweight). */
export const needs = (kind: ExerciseKind): ExerciseGear | null => { const gear = gearOf(kind); return gear === "body" ? null : gear; };

const LEVEL = { easy: 0, medium: 1, hard: 2 } as const;
/** Areas that work overlapping muscles, for when nothing in the same area fits (arms have no bodyweight-only moves). */
const NEAR: Record<string, string[]> = { arms: ["chest", "shoulders", "back"], shoulders: ["chest", "arms"], back: ["core", "arms", "shoulders"], chest: ["arms", "shoulders"], legs: ["full"], core: ["full"], full: ["legs", "core"] };
const base = (kind: ExerciseKind) => EXERCISE_VARIANTS[kind] ?? kind;
const BICEPS: ExerciseKind[] = ["superman", "birddog"], TRICEPS: ExerciseKind[] = ["dip", "kneepush", "diamondpush"], PULL: ExerciseKind[] = ["superman", "birddog"];
const RAISE: ExerciseKind[] = ["punch", "shouldertap", "pikepush"], PRESS: ExerciseKind[] = ["pikepush", "shouldertap", "pushup"], HINGE: ExerciseKind[] = ["bwgoodmorning", "toetouch", "bridge"];
const SQUAT: ExerciseKind[] = ["squat", "sumo"], LUNGE: ExerciseKind[] = ["lunge", "revlunge"], POWER: ExerciseKind[] = ["burpee", "squatjump", "jack"];
/** What a coach would pick instead, by movement pattern, best first (variants fall back to their base exercise). */
const SUBSTITUTES: Partial<Record<ExerciseKind, ExerciseKind[]>> = {
  curl: BICEPS, hammer: BICEPS, conccurl: BICEPS,
  kickback: TRICEPS, overhead: TRICEPS, skull: TRICEPS,
  raise: RAISE, front: RAISE, uprow: RAISE, revfly: PULL, press: PRESS, kbhighpull: RAISE,
  row: PULL, seatrow: PULL, pullup: PULL, latpull: PULL, pullover: PULL,
  deadlift: HINGE, rdl: HINGE, goodmorning: HINGE, kbswing: ["squatjump", "bwgoodmorning", "jack"],
  wsquat: SQUAT, frontsquat: SQUAT, kbsquat: SQUAT, legext: SQUAT, wlunge: LUNGE, wcalf: ["calf"], hipthrust: ["bridge"],
  bench: ["pushup", "kneepush"], inclinebench: ["incline", "pushup"], thruster: POWER, cleanpress: POWER, snatch: POWER, hangleg: ["legraise", "vup"],
};
const ALL = Object.keys(EXERCISES) as ExerciseKind[];

/** The closest exercise you can do instead, never one in `avoid`. With gear unset, it looks for a bodyweight one. */
export function swapFor(kind: ExerciseKind, mine: MyGear, avoid: ReadonlySet<ExerciseKind> = new Set()): ExerciseKind | null {
  const have: MyGear = mine ?? [], e = EXERCISES[kind];
  const ok = (k: ExerciseKind) => k !== kind && !avoid.has(k) && canDo(k, have);
  const score = (k: ExerciseKind) => {
    const o = EXERCISES[k];
    return (base(k) === base(kind) ? 0 : 100)                                 // the same movement with other gear first
      + (o.group === e.group ? 0 : NEAR[e.group]?.includes(o.group) ? 25 : 50)  // then the same body area, then a related one
      + Math.abs(LEVEL[o.difficulty] - LEVEL[e.difficulty]) * 10               // then a similar level
      + (gearOf(k) === "body" ? 0 : 1);                                        // bodyweight breaks ties
  };
  // never jump a level and a half: an easy exercise is not swapped for a hard one while anything gentler fits
  const tooHard = (k: ExerciseKind) => LEVEL[EXERCISES[k].difficulty] - LEVEL[e.difficulty] >= 2;
  const same = ALL.filter(k => ok(k) && base(k) === base(kind) && !tooHard(k)).sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  if (same.length) return same[0];   // the same movement with gear you have (dumbbell curl -> band curl)
  const curated = (SUBSTITUTES[kind] ?? SUBSTITUTES[base(kind)] ?? []).filter(ok);
  const pick = curated.find(k => !tooHard(k)); if (pick) return pick;
  const options = ALL.filter(ok);
  if (!options.length) return curated[0] ?? null;
  return options.sort((a, b) => Number(tooHard(a)) - Number(tooHard(b)) || score(a) - score(b) || a.localeCompare(b))[0];
}

export type GearChange = { from: ExerciseKind; to: ExerciseKind | null };
/** Fit a workout to your gear: swap what you can't do, drop it if nothing fits. Unset gear changes nothing. */
export function fitToGear(circuit: Circuit, mine: MyGear): { circuit: Circuit; changes: GearChange[] } {
  if (mine === null) return { circuit, changes: [] };
  const changes: GearChange[] = [], used = new Set(circuit.steps.map(s => s.kind));
  const steps = circuit.steps.flatMap(step => {
    if (canDo(step.kind, mine)) return [step];
    const to = swapFor(step.kind, mine, used);
    changes.push({ from: step.kind, to });
    if (!to) return [];
    used.add(to); return [{ ...step, kind: to }];
  });
  return { circuit: { ...circuit, steps }, changes };
}
