// Trainer dashboard client (flag organizer_saas). A client shares chosen progress with a coach; the coach sees daily
// summaries of only what was chosen. Backend: routers/coach_clients.py.
import { msg, t } from "./i18n";

export type Share = { diary: boolean; workouts: boolean; weight: boolean };
export type MyCoach = { id: string; coach: string; share: Share; since: string | null };
export type ClientSummary = {
  id: string; name: string; since: string | null; share: Share; days: string[]; last_active: string | null;
  diary?: { days_logged: number; average_kcal: number | null; target_kcal: number | null; by_day: Record<string, number> };
  workouts?: { count: number; minutes: number; by_day: Record<string, number> };
  weight?: { latest_kg: number | null; measured_on: string | null; change_kg: number | null };
};
export const SHARE_LABELS: Record<keyof Share, string> = {
  diary: msg("Daily food totals (calories only, not what you ate)"), workouts: msg("Workouts and active minutes"), weight: msg("Weight"),
};

export class CoachClientError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export async function coachClients<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/coach-clients" + (path ? "/" + path : ""), { method, headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CoachClientError(data.error || t("Unavailable."), response.status);
  return data as T;
}
