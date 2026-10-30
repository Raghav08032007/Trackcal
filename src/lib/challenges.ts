// Verified challenges client (flags verified_challenges + social_feed).
export type ChallengeView = {
  id: string; title: string; description: string; metric: string; metric_label: string; target: number; starts_on: string; ends_on: string; timezone: string;
  phase: "upcoming" | "running" | "ended" | "cancelled"; participants: number; finished: number;
  creator: { handle: string; display_name: string } | null; community: { slug: string; name: string } | null;
  mine: { progress: number; completed: boolean } | null; created_by_me: boolean;
};
export const METRIC_OPTIONS: [string, string, string][] = [
  ["active_days", "Active days", "a workout, a logged meal or an event"],
  ["workouts", "Workouts", "completed, 10+ minutes, up to 2 a day"],
  ["camera_workouts", "Camera workouts", "camera-tracked, 10+ minutes"],
  ["meal_days", "Meal-logging days", "meals logged during the challenge"],
  ["events", "Events attended", "checked in with the organizer's QR code"],
];

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
