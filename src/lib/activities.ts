// GPS activities: requests, formatting, and keeping an unsaved recording safe on this device.
export type Sport = "walk" | "run" | "hike" | "ride";
export type Visibility = "private" | "followers" | "everyone";
/** [lat, lon, seconds from start | null, altitude | null, distance m | null]. Times and distances are hidden on shared routes. */
export type RoutePoint = [number, number, number | null, number | null, number | null];
export type Split = { km: number; distance_m: number; elapsed_s: number; moving_s: number; pace_s_per_km: number | null };
export type BestEffort = { distance_m: number; label: string; seconds: number; activity_id?: string; date?: string };
export type ActivitySummary = {
  id: string; sport: Sport; name: string; notes: string | null; visibility: Visibility; started_at: string; distance_m: number; moving_s: number;
  elapsed_s: number; elevation_gain_m: number; elevation_loss_m: number; avg_speed_ms: number; max_speed_ms: number; user_id: string; preview?: [number, number][];
};
export type Together = { handle: string; display_name: string; character_id: string; activity_id: string };
export type Activity = ActivitySummary & { route: RoutePoint[]; splits: Split[]; best_efforts: BestEffort[]; mine: boolean; fixes_used?: number; fixes_dropped?: number;
  post: import("./social").FeedPost | null; together: Together[]; records_set: string[] };
export type NewRecord = { kind: "best_effort" | "longest" | "climb"; label: string; seconds?: number; previous_seconds?: number | null; distance_m?: number; previous_m?: number; elevation_gain_m?: number };
export type Records = { sport: Sport; best_efforts: BestEffort[]; longest: { distance_m: number; activity_id: string; date: string } | null; biggest_climb: { elevation_gain_m: number; activity_id: string; date: string } | null };
export type Zone = { id: string; label: string; lat: number; lon: number; radius_m: number };
/** A raw fix as the server wants it: [lat, lon, time ms, accuracy m, altitude m | null]. */
export type Fix = [number, number, number, number, number | null];

export const SPORTS: { id: Sport; title: string; verb: string }[] = [
  { id: "walk", title: "Walk", verb: "walk" }, { id: "run", title: "Run", verb: "run" }, { id: "hike", title: "Hike", verb: "hike" }, { id: "ride", title: "Ride", verb: "ride" },
];
export const VISIBILITY: { id: Visibility; title: string; detail: string }[] = [
  { id: "private", title: "Only me", detail: "Nobody else can see it." },
  { id: "followers", title: "Followers", detail: "People you approved. Start and end are hidden." },
  { id: "everyone", title: "Everyone", detail: "Anyone on TrackCal. Start, end and privacy zones are hidden." },
];

export class ActivityError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function activities<T>(path = "", method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/activities" + (path && !path.startsWith("?") ? "/" + path : path), { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ActivityError(data.error || "Activities are unavailable right now. Nothing was changed.", response.status);
  return data as T;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function duration(seconds: number) {
  const s = Math.round(seconds), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
export const km = (metres: number) => (metres / 1000).toFixed(metres < 10000 ? 2 : 1);
/** Rides read as speed, everything on foot as pace. */
export function pace(sport: Sport, metres: number, seconds: number) {
  if (metres < 50 || seconds <= 0) return "–";
  if (sport === "ride") return `${((metres / seconds) * 3.6).toFixed(1)} km/h`;
  return `${duration(seconds / (metres / 1000))} /km`;
}
export const paceLabel = (sport: Sport) => (sport === "ride" ? "Avg speed" : "Pace");
export const sportTitle = (sport: Sport) => SPORTS.find(s => s.id === sport)?.title ?? sport;
export function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// An unsaved recording survives a reload, a crash or a dead battery mid-save. One per browser; only the latest is kept.
const PENDING = "trackcal:activity:pending";
export type Pending = { id: string; sport: Sport; started_at: string; fixes: Fix[]; elapsed_ms: number };
export function keepPending(p: Pending) { try { localStorage.setItem(PENDING, JSON.stringify(p)); } catch { /* storage full or off: the recording stays in memory */ } }
export function readPending(): Pending | null {
  try { const p = JSON.parse(localStorage.getItem(PENDING) || "null"); return p && Array.isArray(p.fixes) && typeof p.id === "string" ? p : null; } catch { return null; }
}
export function dropPending() { try { localStorage.removeItem(PENDING); } catch { /* nothing to drop */ } }
