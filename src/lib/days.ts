// One day of water, movement, calories burned, sleep and mood. Signed in, it lives in the account and every screen
// shares one copy; taps change counters by amounts (so two phones add up), are shown at once, and wait in an outbox
// while offline. Signed out, it is this browser's values as before.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { exportLocalEntries, useLocalState, workspaceKey } from "@/lib/use-local-state";
import type { Checkin } from "@/lib/coach";

export type Day = { day: string; water_ml: number; water_goal_ml: number; water_goal_set: boolean; water_goal_basis?: "yours" | "weight" | "general"; steps: number; active_minutes: number; activity: string;
  burn_kcal: number; route_kcal: number; burned_total: number; weight_kg: number | null; sleep_hours: number | null; sleep_quality: "poor" | "ok" | "good" | null;
  energy: Checkin["energy"] | null; sore: Checkin["sore"] | null; saved: boolean; meals?: number };
type Counter = "water_ml" | "steps" | "active_minutes" | "burn_kcal";
type Settable = Partial<Pick<Day, "water_ml" | "steps" | "active_minutes" | "activity" | "burn_kcal" | "weight_kg" | "sleep_hours" | "sleep_quality" | "energy" | "sore">> & { water_goal_ml?: number | null };
export type DayUpdate = { set?: Settable; add?: Partial<Record<Counter, number>> };
type Pending = { day: string; update: DayUpdate };

const LIMITS: Record<Counter, number> = { water_ml: 20000, steps: 150000, active_minutes: 1440, burn_kcal: 10000 };
export const blankDay = (day: string): Day => ({ day, water_ml: 0, water_goal_ml: 2000, water_goal_set: false, steps: 0, active_minutes: 0, activity: "", burn_kcal: 0,
  route_kcal: 0, burned_total: 0, weight_kg: null, sleep_hours: null, sleep_quality: null, energy: null, sore: null, saved: false });

let scope = "", days = new Map<string, Day>(), recent: string[] = [], recentLoaded = false, loading = new Map<string, Promise<void>>(), flushing = false, retry: ReturnType<typeof setTimeout> | null = null, migrated = "";
let version = 0;
const listeners = new Set<() => void>(), emit = () => { version++; listeners.forEach(l => l()); };
const outboxKey = (s: string) => `trackcal-outbox:days:${s}`;   // not a "trackcal:" key, so backups never carry it

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/personalization/days" + path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "Could not save. Please try again."), { status: response.status });
  return data as T;
}
function valid(d: unknown): d is Day { const v = d as Partial<Day> | null; return !!v && typeof v.day === "string" && typeof v.water_ml === "number" && typeof v.burned_total === "number"; }

function readOutbox(s: string): Pending[] { try { const v = JSON.parse(localStorage.getItem(outboxKey(s)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function writeOutbox(s: string, items: Pending[]) { try { if (items.length) localStorage.setItem(outboxKey(s), JSON.stringify(items.slice(-500))); else localStorage.removeItem(outboxKey(s)); } catch { /* storage off: kept in memory */ } memoryOutbox = items; }
let memoryOutbox: Pending[] = [];
const outbox = (s: string) => { const stored = readOutbox(s); return stored.length ? stored : memoryOutbox; };

/** What the screen shows straight away, before the account answers. */
export function applyUpdate(d: Day, update: DayUpdate): Day {
  const next = { ...d, saved: true };
  for (const [k, v] of Object.entries(update.set ?? {}) as [keyof Settable, unknown][]) {
    if (k === "water_goal_ml") { next.water_goal_set = v != null; if (v != null) next.water_goal_ml = v as number; continue; }
    (next as Record<string, unknown>)[k] = v == null && (k in LIMITS) ? 0 : v;
  }
  for (const [k, v] of Object.entries(update.add ?? {}) as [Counter, number][]) if (v) next[k] = Math.min(LIMITS[k], Math.max(0, Math.round((next[k] + v) * 10) / 10));
  next.burned_total = Math.round(next.burn_kcal + next.route_kcal);
  return next;
}
function withPending(d: Day) { return outbox(scope).filter(p => p.day === d.day).reduce((x, p) => applyUpdate(x, p.update), d); }
function put(d: Day) { if (valid(d)) days.set(d.day, { ...(days.get(d.day)?.meals !== undefined ? { meals: days.get(d.day)!.meals } : {}), ...d }); }

async function flush() {
  if (flushing || !scope || scope === "guest") return; flushing = true;
  const s = scope;
  try {
    for (;;) {
      const [first, ...rest] = outbox(s); if (!first || s !== scope) break;
      try { const d = await request<Day>("/" + first.day, first.update); writeOutbox(s, rest); put(d); emit(); }   // the account has this change; any still waiting are shown on top
      catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) { writeOutbox(s, rest); void loadDay(s, first.day, true); continue; }   // refused: drop it, show the account's value
        if (!retry) retry = setTimeout(() => { retry = null; void flush(); }, 20000);
        break;
      }
    }
  } finally { flushing = false; }
}

/** Days that were only kept in this browser are copied into the account once; the account's values win. */
async function migrate(s: string) {
  if (migrated === s) return; migrated = s;
  const local = exportLocalEntries(s) as Record<string, unknown>, byDay = new Map<string, Record<string, unknown>>();
  const row = (d: string) => { if (!byDay.has(d)) byDay.set(d, { day: d }); return byDay.get(d)!; };
  const keys: string[] = [];
  for (const [key, value] of Object.entries(local)) {
    const w = /^trackcal:wellness:(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1], b = /^trackcal:burn:(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];
    if (w && value && typeof value === "object") {
      const v = value as Record<string, unknown>, r = row(w); keys.push(key);
      if (Number(v.water) > 0) r.water_ml = Math.min(20000, Math.round(Number(v.water)));
      if (Number(v.waterGoal) >= 500 && Number(v.waterGoal) !== 2000) r.water_goal_ml = Math.min(8000, Math.round(Number(v.waterGoal)));
      if (Number(v.steps) > 0) r.steps = Math.min(150000, Math.round(Number(v.steps)));
      if (Number(v.minutes) > 0) r.active_minutes = Math.min(1440, Math.round(Number(v.minutes)));
      if (typeof v.activity === "string" && v.activity.trim()) r.activity = v.activity.trim().slice(0, 100);
      if (Number(v.weight) >= 20 && Number(v.weight) <= 400) r.weight_kg = Number(v.weight);
    }
    if (b && Number(value) > 0) { row(b).burn_kcal = Math.min(10000, Math.round(Number(value) * 10) / 10); keys.push(key); }
  }
  const checkins = local["trackcal:studio:checkins"];
  if (Array.isArray(checkins)) { keys.push("trackcal:studio:checkins"); for (const c of checkins as Checkin[]) if (/^\d{4}-\d{2}-\d{2}$/.test(c?.date)) Object.assign(row(c.date), { energy: c.energy, sore: c.sore }); }
  const items = [...byDay.values()].filter(r => Object.keys(r).length > 1).slice(-400);
  if (items.length) { try { await request("/import", { days: items }); } catch { migrated = ""; return; } }
  for (const key of keys) { try { localStorage.removeItem(workspaceKey(key, s)); } catch { /* storage off */ } }
}

function reset(s: string) { if (scope === s) return; scope = s; days = new Map(); recent = []; recentLoaded = false; loading = new Map(); memoryOutbox = []; emit(); }

export function loadRecent(s: string, force = false) {
  reset(s);
  if (!force && (recentLoaded || loading.has("recent"))) return loading.get("recent") ?? Promise.resolve();
  const p = migrate(s).then(() => request<{ today: string; days: Day[] }>("")).then(r => {
    if (scope !== s || !Array.isArray(r.days)) return;
    for (const d of r.days) put(d); recent = r.days.map(d => d.day); recentLoaded = true; emit(); void flush();
  }).catch(() => {}).finally(() => loading.delete("recent"));
  loading.set("recent", p); return p;
}
export function loadDay(s: string, day: string, force = false) {
  reset(s);
  if (!force && (days.has(day) || loading.has(day))) return loading.get(day) ?? Promise.resolve();
  const p = migrate(s).then(() => request<Day>("/" + day)).then(d => { if (scope === s) { put(d); emit(); void flush(); } }).catch(() => {}).finally(() => loading.delete(day));
  loading.set(day, p); return p;
}
export function updateDay(s: string, day: string, update: DayUpdate) {
  reset(s);
  writeOutbox(s, [...outbox(s), { day, update }]); emit(); void flush();
}

function useStore<T>(read: () => T) { return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, read, read); }
function useOnline(signedIn: boolean) {
  useEffect(() => { if (!signedIn) return; const go = () => void flush(); window.addEventListener("online", go); return () => window.removeEventListener("online", go); }, [signedIn]);
}

/** One day, shared by every screen. `day` is null until the account answers (with the outbox already applied). */
export function useDay(date: string) {
  const { user } = useAccount(), s = useWorkspaceScope(), signedIn = !!user && s !== "guest" && !!date;
  useStore(() => version);
  useEffect(() => { if (signedIn) void loadDay(s, date); }, [signedIn, s, date]);
  useOnline(signedIn);
  const base = signedIn && scope === s ? days.get(date) : undefined;
  const day = base ? withPending(base) : null;
  const update = useCallback((u: DayUpdate) => { if (signedIn) updateDay(s, date, u); }, [signedIn, s, date]);
  return { day, signedIn, update };
}

/** The last 35 days, newest first, for check-ins, sleep and habits. */
export function useRecentDays() {
  const { user } = useAccount(), s = useWorkspaceScope(), signedIn = !!user && s !== "guest";
  useStore(() => version);
  useEffect(() => { if (signedIn) void loadRecent(s); }, [signedIn, s]);
  useEffect(() => { if (!signedIn) return; const again = () => void loadRecent(s, true); window.addEventListener("trackcal-diary", again); return () => window.removeEventListener("trackcal-diary", again); }, [signedIn, s]);
  useOnline(signedIn);
  const list = signedIn && scope === s && recentLoaded ? recent.map(d => days.get(d)).filter(Boolean).map(d => withPending(d!)) : null;
  return { days: list, signedIn, update: (day: string, u: DayUpdate) => { if (signedIn) updateDay(s, day, u); } };
}

export type Wellness = { water: number; waterGoal: number; steps: number; activity: string; minutes: number; weight: number };
const LOCAL_WELLNESS: Wellness = { water: 0, waterGoal: 2000, steps: 0, activity: "", minutes: 0, weight: 0 };

/** Water, steps, minutes, activity and weight in the shape the screens used for the browser value. */
export function useWellness(date: string): [Wellness, (next: Wellness | ((prev: Wellness) => Wellness)) => void, boolean] {
  const { day, signedIn, update } = useDay(date);
  const [local, setLocal] = useLocalState<Wellness>(`trackcal:wellness:${date}`, LOCAL_WELLNESS);
  const value: Wellness = signedIn ? (day ? { water: day.water_ml, waterGoal: day.water_goal_ml, steps: day.steps, activity: day.activity, minutes: day.active_minutes, weight: day.weight_kg ?? 0 } : LOCAL_WELLNESS) : local;
  const set = useCallback((next: Wellness | ((prev: Wellness) => Wellness)) => {
    if (!signedIn) { setLocal(next as never); return; }
    const n = typeof next === "function" ? next(value) : next, u: DayUpdate = { set: {}, add: {} };
    if (n.water !== value.water) u.add!.water_ml = Math.round(n.water - value.water);
    if (n.waterGoal !== value.waterGoal) u.set!.water_goal_ml = n.waterGoal >= 500 ? Math.round(n.waterGoal) : null;
    if (n.steps !== value.steps) u.set!.steps = Math.max(0, Math.round(n.steps));
    if (n.minutes !== value.minutes) u.set!.active_minutes = Math.max(0, Math.round(n.minutes));
    if (n.activity !== value.activity) u.set!.activity = n.activity.slice(0, 100);
    if (n.weight !== value.weight) u.set!.weight_kg = n.weight >= 20 && n.weight <= 400 ? n.weight : null;
    if (Object.keys(u.set!).length || Object.keys(u.add!).length) update(u);
  }, [signedIn, setLocal, value, update]);
  return [value, set, signedIn ? !!day : true];
}

/** Calories burned today: camera workouts and exercise you log, plus recorded routes. Setting it adds the difference. */
export function useBurn(date: string): [number, (next: number | ((prev: number) => number)) => void] {
  const { day, signedIn, update } = useDay(date);
  const [local, setLocal] = useLocalState<number>(`trackcal:burn:${date}`, 0);
  const value = signedIn ? day?.burned_total ?? 0 : local;
  const set = useCallback((next: number | ((prev: number) => number)) => {
    if (!signedIn) { setLocal(next as never); return; }
    const delta = (typeof next === "function" ? next(value) : next) - value;
    if (delta) update({ add: { burn_kcal: Math.round(delta * 10) / 10 } });
  }, [signedIn, setLocal, value, update]);
  return [value, set];
}

/** How you felt each day (the coach check-in), newest last, in the shape the screens used. */
export function useCheckins(): [Checkin[], (next: Checkin[] | ((prev: Checkin[]) => Checkin[])) => void] {
  const { days: list, signedIn, update } = useRecentDays();
  const [local, setLocal] = useLocalState<Checkin[]>("trackcal:studio:checkins", []);
  const value: Checkin[] = useMemo(() => signedIn ? (list ?? []).filter(d => d.energy && d.sore).map(d => ({ date: d.day, energy: d.energy!, sore: d.sore! })).reverse() : local, [signedIn, list, local]);
  const set = useCallback((next: Checkin[] | ((prev: Checkin[]) => Checkin[])) => {
    if (!signedIn) { setLocal(next as never); return; }
    const n = typeof next === "function" ? next(value) : next, before = new Map(value.map(c => [c.date, c]));
    for (const c of n) { const old = before.get(c.date); if (!old || old.energy !== c.energy || old.sore !== c.sore) update(c.date, { set: { energy: c.energy, sore: c.sore } }); }
  }, [signedIn, setLocal, value, update]);
  return [value, set];
}

/** For tests. */
export function resetDays() { scope = ""; days = new Map(); recent = []; recentLoaded = false; loading = new Map(); flushing = false; migrated = ""; memoryOutbox = []; if (retry) clearTimeout(retry); retry = null; emit(); }
