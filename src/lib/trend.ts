// Weekly summary and fitness trend (Phase G), from GET /api/wellness/trend. Every number comes from the server.
import { wellnessRequest } from "./wellness";

export type Kind = "run" | "ride" | "walk" | "strength" | "mobility" | "other";
export type Week = { start: string; minutes: number; met_minutes: number; distance_m: number; active_days: number; sessions: number; by_kind: Partial<Record<Kind, number>> };
export type TrendDay = { day: string; load: number; fitness: number; fatigue: number; form: number };
export type Trend = {
  today: string; weeks: Week[]; method: string;
  guideline: { met_minutes: number; minimum: number; more: number; status: "building" | "met" | "more"; text: string; days_into_week: number };
  trend: { days: TrendDay[]; fitness: number; fatigue: number; form: number; ratio: number | null; enough_history: boolean; message: string };
};
/** Fixed order and labels: the order is the stacking order and the colour slot order (never by size). */
export const KINDS: { id: Kind; label: string }[] = [
  { id: "run", label: "Running" }, { id: "ride", label: "Cycling" }, { id: "walk", label: "Walking and hiking" },
  { id: "strength", label: "Strength and workouts" }, { id: "mobility", label: "Yoga and mobility" }, { id: "other", label: "Other" },
];
export const loadTrend = (weeks = 12) => wellnessRequest<Trend>(`trend?weeks=${weeks}`);
/** How steady training is, from the acute:chronic ratio; never colour alone: each has a label and an icon in the page. */
export function pace(ratio: number | null): { id: "none" | "light" | "steady" | "building" | "jump"; label: string } {
  if (ratio === null) return { id: "none", label: "Building your baseline" };
  if (ratio > 1.5) return { id: "jump", label: "Big jump" };
  if (ratio > 1.3) return { id: "building", label: "Building fast" };
  if (ratio >= 0.8) return { id: "steady", label: "Steady" };
  return { id: "light", label: "Lighter week" };
}
export const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
export const niceMax = (v: number) => { if (v <= 0) return 100; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
