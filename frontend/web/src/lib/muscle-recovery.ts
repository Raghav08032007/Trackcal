import { msg } from "./i18n";
import { EXERCISES, type ExerciseKind } from "./pose/types";
import { HOLDS, type HoldKind } from "./pose/holds";
import { MUSCLE_LABELS, musclesFromText, musclesOf, type MapMuscle, type MuscleState } from "./training-insights";
import { ASANA_BY_ID, type AsanaFamily } from "./yoga/asanas";
import type { Session } from "./wellness";

/** How recovered each muscle is, 0-100 %, from every kind of training saved to the account: camera workouts, sets logged by
 *  hand, holds, yoga, Surya Namaskar, runs and walks. A rule of thumb from sports science, not a reading of the body:
 *
 *  - Each session gives a dose per muscle: hard sets x 1 for the muscle the exercise is named for, x 0.6 for helpers.
 *    Six hard sets tire a muscle fully. Holds, yoga and walking are lighter doses.
 *  - A dose wears off in a straight line over the muscle's recovery time: about 72 h for big muscles (quads, glutes,
 *    hamstrings, back, chest), 60 h for medium ones and 48 h for small ones (arms, calves, abs). Light work recovers in
 *    half that time.
 *  - Doses from several sessions add up, so training a tired muscle again pushes its recovery further out.
 *  Sources: typical 48-72 h muscle protein synthesis and soreness windows (e.g. Schoenfeld; ACSM guidelines on 48 h between
 *  sessions for the same muscle group). Go by how you feel. */
export type Dose = { at: number; muscles: Partial<Record<MapMuscle, number>>; source: string };
export type MuscleRecovery = { muscle: MapMuscle; label: string; percent: number; state: MuscleState; readyInHours: number; lastWorked: number | null };

const FULL_DOSE = 6;
const HOURS: Record<MapMuscle, number> = {
  quadriceps: 72, gluteal: 72, hamstring: 72, "upper-back": 72, "lower-back": 72, chest: 72,
  "front-deltoids": 60, "back-deltoids": 60, trapezius: 60, adductor: 60, abductors: 60,
  biceps: 48, triceps: 48, forearm: 48, calves: 48, abs: 48, obliques: 48,
};
export const ALL_MUSCLES = Object.keys(HOURS) as MapMuscle[];
const LEGS: MapMuscle[] = ["quadriceps", "gluteal", "hamstring", "calves"];

/** Muscles a yoga family works, gently. */
const YOGA: Record<AsanaFamily, MapMuscle[]> = {
  standing: ["quadriceps", "gluteal", "hamstring"], balance: ["calves", "gluteal", "abs"], seated: ["hamstring", "lower-back"],
  kneeling: ["quadriceps", "lower-back"], prone: ["lower-back", "gluteal", "upper-back"], supine: ["gluteal", "abs"],
  inversion: ["front-deltoids", "hamstring", "triceps"],
};

const kindOfTemplate = new Map<string, ExerciseKind>((Object.keys(EXERCISES) as ExerciseKind[]).map(k => [EXERCISES[k].template, k]));

/** One muscle list with the named muscle first: 1 for it, 0.6 for the helpers. */
const shares = (muscles: MapMuscle[], sets: number): Partial<Record<MapMuscle, number>> =>
  Object.fromEntries(muscles.map((m, i) => [m, sets * (i === 0 ? 1 : 0.6)]));

/** Hard sets in a record: a set of 5 or more reps (or a timed set) is a hard set, a shorter one half of one. */
function hardSets(sets: { reps: number; minutes: number }[], fallback: number) {
  if (!sets.length) return fallback;
  return sets.reduce((n, s) => n + (s.reps >= 5 || s.minutes > 0 ? 1 : s.reps > 0 ? 0.5 : 0), 0) || fallback;
}

/** The doses in one saved session. */
export function dosesOf(session: Session): Dose[] {
  if (session.status !== "completed" || !session.completed_at) return [];
  const at = Date.parse(session.completed_at);
  if (!Number.isFinite(at)) return [];
  const out: Dose[] = [];
  for (const record of session.details?.exercises ?? []) {
    const id = record.exercise_id ?? "", sets = record.sets ?? [];
    const kind = kindOfTemplate.get(id), hold = id.startsWith("camera_") ? id.slice(7) as HoldKind : null;
    if (kind) {
      const tracked = session.details?.tracking?.exercise_type === kind ? (session.details.tracking.sets ?? []).map(s => ({ reps: Math.min(s.estimated_reps, s.corrected_reps ?? s.estimated_reps), minutes: 0 })) : [];
      out.push({ at, source: EXERCISES[kind].title, muscles: shares(musclesOf(kind), hardSets(tracked.length ? tracked : sets, 1)) });
    } else if (hold && hold in HOLDS) {
      out.push({ at, source: HOLDS[hold].title, muscles: shares(musclesFromText(HOLDS[hold].muscles), 0.5 * Math.max(1, sets.length)) });
    } else if (id === "yoga_surya-namaskar") {
      out.push({ at, source: "Surya Namaskar", muscles: shares(["quadriceps", "front-deltoids", "triceps", "abs", "hamstring"], 1) });
    } else if (id.startsWith("yoga_") && ASANA_BY_ID[id.slice(5)]) {
      const a = ASANA_BY_ID[id.slice(5)];
      out.push({ at, source: a.english, muscles: shares(YOGA[a.family], a.level === 3 ? 0.8 : 0.4) });
    } else if (id === "run" || id === "ride" || id === "walk") {
      const minutes = sets.reduce((n, s) => n + s.minutes, 0) || session.minutes || 30;
      const per = (id === "walk" ? 0.5 : 2) * Math.min(2, minutes / 30);
      out.push({ at, source: id === "walk" ? "Walk" : id === "ride" ? "Ride" : "Run", muscles: Object.fromEntries(LEGS.map((m, i) => [m, per * (i < 2 ? 1 : 0.7)])) });
    }
    // breathing and meditation sessions rest the body: no dose.
  }
  return out;
}

export const stateOf = (percent: number): MuscleState => percent < 40 ? "worked" : percent < 70 ? "recovering" : percent < 90 ? "nearly" : "ready";

/** Recovery of every muscle at `now`, most tired first. */
export function recovery(doses: Dose[], now: number): MuscleRecovery[] {
  return ALL_MUSCLES.map(muscle => {
    let remaining = 0, last: number | null = null;
    const parts: { fatigue: number; hours: number; age: number }[] = [];
    for (const d of doses) {
      const dose = d.muscles[muscle];
      if (!dose || d.at > now) continue;
      const fatigue = Math.min(1, dose / FULL_DOSE), hours = HOURS[muscle] * (0.5 + 0.5 * fatigue), age = (now - d.at) / 3600000;
      if (age < hours) { remaining += fatigue * (1 - age / hours); parts.push({ fatigue, hours, age }); }
      last = Math.max(last ?? 0, d.at);
    }
    remaining = Math.min(1, remaining);
    const percent = Math.round(100 * (1 - remaining));
    // Hours until 90 %: step forward until the summed fatigue falls to 0.1 (doses wear off linearly, so this is exact to the hour).
    let readyInHours = 0;
    if (remaining > 0.1) for (let h = 1; h <= 200; h++) {
      const left = Math.min(1, parts.reduce((n, p) => n + (p.age + h < p.hours ? p.fatigue * (1 - (p.age + h) / p.hours) : 0), 0));
      if (left <= 0.1) { readyInHours = h; break; }
    }
    return { muscle, label: MUSCLE_LABELS[muscle], percent, state: stateOf(percent), readyInHours, lastWorked: last };
  }).sort((a, b) => a.percent - b.percent || a.label.localeCompare(b.label));
}

/** The map's colours as before (worked / recovering / nearly / ready), for code that uses the simpler states. */
export const statesOf = (list: MuscleRecovery[]) => new Map(list.filter(m => m.state !== "ready").map(m => [m.muscle, m.state] as const));

/** An overall readiness out of 100: the average of the muscles trained in the last week, or 100 when none were. */
export function readiness(list: MuscleRecovery[], now: number) {
  const recent = list.filter(m => m.lastWorked !== null && now - m.lastWorked < 7 * 24 * 3600000);
  return recent.length ? Math.round(recent.reduce((n, m) => n + m.percent, 0) / recent.length) : 100;
}

/** Exercises whose every muscle is at least `min` % recovered, easiest first. */
export function freshExercises(list: MuscleRecovery[], min = 85, equipment: "none" | "any" = "none") {
  const pct = new Map(list.map(m => [m.muscle, m.percent]));
  const order = { easy: 0, medium: 1, hard: 2 };
  return (Object.keys(EXERCISES) as ExerciseKind[])
    .filter(k => (equipment === "any" || EXERCISES[k].equipment === "none") && musclesOf(k).length && musclesOf(k).every(m => (pct.get(m) ?? 100) >= min))
    .sort((a, b) => order[EXERCISES[a].difficulty] - order[EXERCISES[b].difficulty]);
}

export const RECOVERY_NOTE = msg("Estimated from your saved training with common recovery times (48-72 hours). Go by how you feel.");
