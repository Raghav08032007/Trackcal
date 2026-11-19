import { msg, t, localized, number } from "./i18n";
import { announceFrom } from "@/lib/notice";
// Verified challenges client (flags verified_challenges + social_feed).
export type ChallengeView = {
  id: string; title: string; description: string; metric: string; metric_label: string; target: number; starts_on: string; ends_on: string; timezone: string;
  phase: "upcoming" | "running" | "ended" | "cancelled"; participants: number; finished: number;
  creator: { handle: string; display_name: string } | null; community: { slug: string; name: string } | null;
  mine: { progress: number; completed: boolean } | null; created_by_me: boolean; hidden: boolean;
};
export const METRIC_OPTIONS: [string, string, string][] = [
  ["active_days", msg("Active days"), msg("a workout, a logged meal or an event")],
  ["workouts", msg("Workouts"), msg("completed, 10+ minutes, up to 2 a day")],
  ["camera_workouts", msg("Camera workouts"), msg("camera-tracked, 10+ minutes")],
  ["camera_reps", msg("Camera reps"), msg("only reps the camera counted, up to 500 a day")],
  ["meal_days", msg("Meal-logging days"), msg("meals logged during the challenge")],
  ["events", msg("Events attended"), msg("checked in with the organizer's QR code")],
  ["distance_km", msg("Distance (km)"), msg("walks, runs, hikes and rides measured by GPS, up to 200 km a day")],
  ["active_minutes", msg("Active minutes"), msg("GPS activities and completed workouts, up to 5 hours a day")],
];
localized(METRIC_OPTIONS, ["1", "2"]);
/** The biggest goal the form offers for each kind (the server checks the real limit for the challenge's length). */
export const goalMax = (metric: string) => metric === "camera_reps" || metric === "active_minutes" ? 30000 : metric === "distance_km" ? 12000 : 120;
/** What a "5 × …" goal counts, matching the server's metric labels (services/challenge_progress.py). */
const GOAL_NOUNS: Record<string, string> = {
  active_days: msg("active days (a workout, a logged meal or an event)"), workouts: msg("workouts of 10+ minutes"),
  camera_workouts: msg("camera-tracked workouts of 10+ minutes"), camera_reps: msg("reps the camera counted"),
  meal_days: msg("days with a logged meal"), events: msg("verified events attended"),
};
/** "100 km by GPS", "600 active minutes", or "5 × workouts of 10+ minutes". */
export function goalText(c: { target: number; metric: string; metric_label: string }) {
  if (c.metric === "distance_km") return t("{n} km by GPS", { n: number(c.target) });
  if (c.metric === "active_minutes") return t("{n} active minutes", { n: number(c.target) });
  return `${number(c.target)} × ${GOAL_NOUNS[c.metric] ? t(GOAL_NOUNS[c.metric]) : c.metric_label.toLowerCase()}`;
}

export class ChallengeError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function challenges<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/challenges" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new ChallengeError(data.error || t("Challenges are unavailable right now. Nothing was changed."), response.status);
  announceFrom(data);   // e.g. a post held for review
  return data as T;
}

export function dates(c: Pick<ChallengeView, "starts_on" | "ends_on">) {
  const f = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(c.starts_on)} – ${f(c.ends_on)}`;
}
