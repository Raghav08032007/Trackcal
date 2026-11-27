// What to try next time for a logged gym exercise ("double progression", the rule most strength coaches use):
// work in a range of 8-12 reps; when the top of the range is reached, add a small amount of weight and start again at 8.
// Bodyweight moves add a rep; past 20 reps a harder variant is suggested. A drop in reps at the same weight means
// "hold steady and focus on form" rather than pushing on. A suggestion, never a requirement.
import { msg } from "@/lib/i18n";

export type LoggedSet = { day: string; name: string; sets: number; reps: number; load: number };
export type Suggestion = { sets: number; reps: number; load: number; why: string; last: LoggedSet };

export const REP_LOW = 8, REP_HIGH = 12, BODYWEIGHT_MAX = 20;
const LOWER = /squat|dead ?lift|\brdl\b|lunge|leg|hip thrust|calf|glute|step[- ]?up/i;

/** Same exercise name, ignoring case, spaces and punctuation. */
export const sameExercise = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The smallest sensible jump: 1 kg on light dumbbells, 2.5 kg upper body, 5 kg for legs and hips. */
export function increment(name: string, load: number) {
  if (load < 10) return 1;
  return LOWER.test(name) ? 5 : 2.5;
}

/** history: past entries (any order). Returns the next target for `name`, or null when it has never been logged. */
export function suggestNext(name: string, history: LoggedSet[]): Suggestion | null {
  const past = history.filter(h => h.name && sameExercise(h.name, name) && h.reps > 0).sort((a, b) => b.day.localeCompare(a.day));
  const last = past[0];
  if (!last) return null;
  const sets = Math.max(1, last.sets || 1);
  if (!last.load) {
    if (last.reps >= BODYWEIGHT_MAX) return { sets, reps: last.reps, load: 0, why: msg("You're past 20 reps: try a harder version (slower, a pause at the bottom, or a tougher variant)."), last };
    return { sets, reps: last.reps + 1, load: 0, why: msg("One more rep than last time."), last };
  }
  const before = past.find(p => p !== last && p.load === last.load);
  if (before && last.reps < before.reps) return { sets, reps: before.reps, load: last.load, why: msg("Reps dipped last time: keep the same weight and focus on clean form."), last };
  if (last.reps >= REP_HIGH) {
    const load = Math.round((last.load + increment(name, last.load)) * 2) / 2;
    return { sets, reps: REP_LOW, load, why: msg("You reached 12 reps: add a little weight and start again at 8."), last };
  }
  if (last.reps < REP_LOW) return { sets, reps: last.reps + 1, load: last.load, why: msg("Build up to 8 reps at this weight first."), last };
  return { sets, reps: last.reps + 1, load: last.load, why: msg("One more rep at the same weight; at 12, the weight goes up."), last };
}
