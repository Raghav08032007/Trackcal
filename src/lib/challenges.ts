// Verified challenges client (flags verified_challenges + social_feed).
export type ChallengeView = {
  id: string; title: string; description: string; metric: string; metric_label: string; target: number; starts_on: string; ends_on: string; timezone: string;
  phase: "upcoming" | "running" | "ended" | "cancelled"; participants: number; finished: number;
  creator: { handle: string; display_name: string } | null; community: { slug: string; name: string } | null;
  mine: { progress: number; completed: boolean } | null; created_by_me: boolean; hidden: boolean;
};
export const METRIC_OPTIONS: [string, string, string][] = [
  ["active_days", "Active days", "a workout, a logged meal or an event"],
  ["workouts", "Workouts", "completed, 10+ minutes, up to 2 a day"],
  ["camera_workouts", "Camera workouts", "camera-tracked, 10+ minutes"],
  ["camera_reps", "Camera reps", "only reps the camera counted, up to 500 a day"],
  ["meal_days", "Meal-logging days", "meals logged during the challenge"],
  ["events", "Events attended", "checked in with the organizer's QR code"],
  ["distance_km", "Distance (km)", "walks, runs, hikes and rides measured by GPS, up to 200 km a day"],
  ["active_minutes", "Active minutes", "GPS activities and completed workouts, up to 5 hours a day"],
];
/** The biggest goal the form offers for each kind (the server checks the real limit for the challenge's length). */
export const goalMax = (metric: string) => metric === "camera_reps" || metric === "active_minutes" ? 30000 : metric === "distance_km" ? 12000 : 120;
/** "100 km by GPS", "600 active minutes", or "5 × workouts of 10+ minutes". */
export function goalText(c: { target: number; metric: string; metric_label: string }) {
  if (c.metric === "distance_km") return `${c.target.toLocaleString()} km by GPS`;
  if (c.metric === "active_minutes") return `${c.target.toLocaleString()} active minutes`;
  return `${c.target} × ${c.metric_label.toLowerCase()}`;
}

export class ChallengeError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function challenges<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/challenges" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new ChallengeError(data.error || "Challenges are unavailable right now. Nothing was changed.", response.status);
  return data as T;
}

export function dates(c: Pick<ChallengeView, "starts_on" | "ends_on">) {
  const f = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(c.starts_on)} – ${f(c.ends_on)}`;
}
