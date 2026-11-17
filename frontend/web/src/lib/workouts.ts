import { msg } from "./i18n";
// Workouts on the account: one history (sessions, hand-logged workouts and routes), and the training library
// (circuits, program progress, next rep targets). Signed in, every screen shares one copy and browser-only data
// is copied once; signed out, the browser keeps them as before.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { exportLocalEntries, useLocalState, workspaceKey } from "@/lib/use-local-state";
import type { WorkoutEntry } from "@/lib/smart-tools";
import type { Circuit } from "@/lib/workout-coach";
import type { ExerciseKind } from "@/lib/pose/types";

export type HistoryKind = "all" | "camera" | "gym" | "manual" | "route";
export type HistoryItem = { id: string; kind: Exclude<HistoryKind, "all">; title: string; at: string; day: string; minutes: number; detail: string;
  sets?: number; reps?: number; load?: number; source?: string; exercises?: string[]; distance_m?: number; sport?: string; link?: string; removable: boolean; editable: boolean };
export type Library = { circuits: Circuit[]; program_days: string[]; next_targets: { kind: ExerciseKind; target: number }[] };
type LibraryChange = { save_circuits?: Circuit[]; remove_circuits?: string[]; program_days?: { add?: string[]; clear?: string[] }; next_targets?: { kind: string; target: number }[] };
export type EntryInput = { day: string; name: string; minutes: number; sets: number; reps: number; load: number; source?: string };

async function request<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await fetch("/api/wellness/" + path, { method: method ?? (body === undefined ? "GET" : "POST"), credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || msg("Could not save. Please try again."));
  return data as T;
}
const changed = () => window.dispatchEvent(new Event("trackcal-workouts"));

// ── Library store ──
let scope = "", library: Library | null = null, pending: Promise<void> | null = null, migrated = "";
const listeners = new Set<() => void>(), emit = () => listeners.forEach(l => l());
const validLibrary = (v: unknown): v is Library => !!v && Array.isArray((v as Library).circuits) && Array.isArray((v as Library).program_days) && Array.isArray((v as Library).next_targets);
const LOCAL = ["trackcal:studio:workouts", "trackcal:studio:circuits", "trackcal:studio:program-days", "trackcal:studio:next-targets"];

/** Workouts, circuits and program progress kept only in this browser are copied into the account once. */
async function migrate(s: string): Promise<Library | null> {
  if (migrated === s) return null; migrated = s;
  const local = exportLocalEntries(s) as Record<string, unknown>, list = (k: string) => Array.isArray(local[k]) ? local[k] as unknown[] : [];
  const workouts = (list("trackcal:studio:workouts") as WorkoutEntry[]).filter(w => /^[0-9a-f-]{36}$/i.test(w.id) && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && w.name?.trim())
    .map(w => ({ id: w.id, day: w.date, name: w.name.trim().slice(0, 120), minutes: Math.min(1440, Math.round(w.minutes) || 0), sets: Math.min(200, Math.round(w.sets) || 0),
      reps: Math.min(1000, Math.round(w.reps) || 0), load: Math.min(1000, w.load || 0), source: (w.source || msg("Manual entry")).slice(0, 40) }));
  const body = { workouts: workouts.slice(-500), circuits: list("trackcal:studio:circuits").slice(0, 50), program_days: list("trackcal:studio:program-days").slice(0, 500), next_targets: list("trackcal:studio:next-targets").slice(0, 100) };
  if (!body.workouts.length && !body.circuits.length && !body.program_days.length && !body.next_targets.length) return null;
  try { const result = await request<Library & { workouts: number }>("library/import", body); for (const k of LOCAL) { try { localStorage.removeItem(workspaceKey(k, s)); } catch { /* storage off */ } } if (result.workouts) changed(); return result; }
  catch { migrated = ""; return null; }
}
export function loadLibrary(s: string, force = false) {
  if (scope !== s) { scope = s; library = null; pending = null; }
  if (!force && (library || pending)) return pending ?? Promise.resolve();
  pending = migrate(s).then(m => m ?? request<Library>("library")).then(l => { if (scope === s && validLibrary(l)) { library = { circuits: l.circuits, program_days: l.program_days, next_targets: l.next_targets }; emit(); } })
    .catch(() => {}).finally(() => { pending = null; });
  return pending;
}
export async function changeLibrary(change: LibraryChange) {
  const s = scope;
  // Shown at once; the account's answer replaces it.
  if (library) { library = applyChange(library, change); emit(); }
  try { const l = await request<Library>("library", change); if (scope === s && validLibrary(l)) { library = l; emit(); } }
  catch (e) { void loadLibrary(s, true); throw e; }
}
export function applyChange(l: Library, c: LibraryChange): Library {
  let circuits = l.circuits.filter(x => !(c.remove_circuits ?? []).includes(x.id));
  for (const x of c.save_circuits ?? []) circuits = [...circuits.filter(y => y.id !== x.id), x];
  let days = l.program_days.filter(d => !(c.program_days?.clear ?? []).includes(d.split(":")[0]));
  for (const d of c.program_days?.add ?? []) if (!days.includes(d)) days = [...days, d];
  const targets = new Map(l.next_targets.map(t => [t.kind, t.target] as [string, number]));
  for (const t of c.next_targets ?? []) targets.set(t.kind, t.target);
  return { circuits, program_days: days, next_targets: [...targets].map(([kind, target]) => ({ kind: kind as ExerciseKind, target })) };
}

function useLibrary() {
  const { user } = useAccount(), s = useWorkspaceScope(), signedIn = !!user && s !== "guest";
  const l = useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f); }, () => (scope === s ? library : null), () => null);
  useEffect(() => { if (signedIn) void loadLibrary(s); }, [signedIn, s]);
  return { library: signedIn ? l : null, signedIn };
}

/** Program days done, as "program:day" ids. Adding saves those days; removing a program's days starts it again. */
export function useProgramDays(): [string[], (next: string[] | ((prev: string[]) => string[])) => void] {
  const { library: l, signedIn } = useLibrary();
  const [local, setLocal] = useLocalState<string[]>("trackcal:studio:program-days", []);
  const value = useMemo(() => signedIn ? l?.program_days ?? [] : local, [signedIn, l, local]);
  const set = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    if (!signedIn) { setLocal(next as never); return; }
    const n = typeof next === "function" ? next(value) : next;
    const add = n.filter(d => !value.includes(d)), clear = [...new Set(value.filter(d => !n.includes(d)).map(d => d.split(":")[0]))];
    if (add.length || clear.length) void changeLibrary({ program_days: { add, clear } }).catch(() => {});
  }, [signedIn, setLocal, value]);
  return [value, set];
}

/** Saved circuits. */
export function useCircuits(): [Circuit[], (next: Circuit[] | ((prev: Circuit[]) => Circuit[])) => void] {
  const { library: l, signedIn } = useLibrary();
  const [local, setLocal] = useLocalState<Circuit[]>("trackcal:studio:circuits", []);
  const value = useMemo(() => signedIn ? l?.circuits ?? [] : local, [signedIn, l, local]);
  const set = useCallback((next: Circuit[] | ((prev: Circuit[]) => Circuit[])) => {
    if (!signedIn) { setLocal(next as never); return; }
    const n = typeof next === "function" ? next(value) : next, before = new Map(value.map(c => [c.id, JSON.stringify(c)]));
    const save = n.filter(c => before.get(c.id) !== JSON.stringify(c)), remove = value.filter(c => !n.some(x => x.id === c.id)).map(c => c.id);
    if (save.length || remove.length) void changeLibrary({ save_circuits: save, remove_circuits: remove }).catch(() => {});
  }, [signedIn, setLocal, value]);
  return [value, set];
}

/** The rep target to aim for next time, per exercise. */
export function useNextTargets(): [Library["next_targets"], (next: Library["next_targets"] | ((prev: Library["next_targets"]) => Library["next_targets"])) => void] {
  const { library: l, signedIn } = useLibrary();
  const [local, setLocal] = useLocalState<Library["next_targets"]>("trackcal:studio:next-targets", []);
  const value = useMemo(() => signedIn ? l?.next_targets ?? [] : local, [signedIn, l, local]);
  const set = useCallback((next: Library["next_targets"] | ((prev: Library["next_targets"]) => Library["next_targets"])) => {
    if (!signedIn) { setLocal(next as never); return; }
    const n = typeof next === "function" ? next(value) : next, before = new Map(value.map(t => [t.kind, t.target]));
    const diff = n.filter(t => before.get(t.kind) !== t.target);
    if (diff.length) void changeLibrary({ next_targets: diff }).catch(() => {});
  }, [signedIn, setLocal, value]);
  return [value, set];
}

// ── History ──
export type HistoryPage = { items: HistoryItem[]; has_more: boolean; active_days?: string[] };
export async function historyRequest(kind: HistoryKind, offset = 0, limit = 20) {
  const page = await request<HistoryPage>(`history?kind=${kind}&offset=${offset}&limit=${limit}`);
  if (!page || !Array.isArray(page.items)) throw new Error(msg("Could not load your workouts."));   // an error page or an older server
  return page;
}

let activeDays: string[] = [], activeScope = "", activeLoading: Promise<void> | null = null;
const activeListeners = new Set<() => void>();
function loadActive(s: string, force = false) {
  if (activeScope !== s) { activeScope = s; activeDays = []; activeLoading = null; force = true; }
  if (!force || activeLoading) return;
  activeLoading = historyRequest("all", 0, 1).then(p => { if (activeScope === s && Array.isArray(p.active_days)) { activeDays = p.active_days; activeListeners.forEach(l => l()); } }).catch(() => {}).finally(() => { activeLoading = null; });
}
/** Every day with a finished workout of any kind (last 120 days), for streaks and habits. Empty when signed out. */
export function useActiveDays() {
  const { user } = useAccount(), s = useWorkspaceScope(), signedIn = !!user && s !== "guest";
  const days = useSyncExternalStore(f => { activeListeners.add(f); return () => activeListeners.delete(f); }, () => (activeScope === s ? activeDays : EMPTY), () => EMPTY);
  useEffect(() => { if (!signedIn) return; loadActive(s); const again = () => loadActive(s, true); window.addEventListener("trackcal-workouts", again); return () => window.removeEventListener("trackcal-workouts", again); }, [signedIn, s]);
  return signedIn ? days : EMPTY;
}
const EMPTY: string[] = [];

export async function addWorkout(entry: EntryInput & { id?: string }) { const item = await request<HistoryItem>("entries", { id: entry.id ?? crypto.randomUUID(), source: msg("Manual entry"), ...entry }); changed(); return item; }
export async function editWorkout(id: string, entry: EntryInput) { const item = await request<HistoryItem>("entries/" + id, { source: msg("Manual entry"), ...entry }, "PUT"); changed(); return item; }
export async function removeHistoryItem(item: HistoryItem) { await request(`${item.kind === "manual" ? "entries" : "sessions"}/${item.id}`, undefined, "DELETE"); changed(); }
export async function restoreHistoryItem(item: HistoryItem) { const back = await request<HistoryItem>(`${item.kind === "manual" ? "entries" : "sessions"}/${item.id}/restore`, {}); changed(); return back; }

/** Hand-logged workouts in the shape the screens used: adding saves one to the account, removing deletes it. */
export function useLoggedWorkouts(): [WorkoutEntry[], (next: WorkoutEntry[] | ((prev: WorkoutEntry[]) => WorkoutEntry[])) => void] {
  const { user } = useAccount(), s = useWorkspaceScope(), signedIn = !!user && s !== "guest";
  const [local, setLocal] = useLocalState<WorkoutEntry[]>("trackcal:studio:workouts", []);
  const [rows, setRows] = useLocalRows(signedIn);
  const value = signedIn ? rows : local;
  const set = useCallback((next: WorkoutEntry[] | ((prev: WorkoutEntry[]) => WorkoutEntry[])) => {
    if (!signedIn) { setLocal(next as never); return; }
    const n = typeof next === "function" ? next(value) : next;
    const added = n.filter(w => !value.some(v => v.id === w.id)), removed = value.filter(v => !n.some(w => w.id === v.id));
    setRows(n);
    for (const w of added) void addWorkout({ id: /^[0-9a-f-]{36}$/i.test(w.id) ? w.id : crypto.randomUUID(), day: w.date, name: w.name, minutes: w.minutes, sets: w.sets, reps: w.reps, load: w.load, source: w.source }).catch(() => setRows(r => r.filter(x => x.id !== w.id)));
    for (const w of removed) void removeHistoryItem({ id: w.id, kind: "manual" } as HistoryItem).catch(() => {});
  }, [signedIn, setLocal, value, setRows]);
  return [value, set];
}
function useLocalRows(signedIn: boolean): [WorkoutEntry[], React.Dispatch<React.SetStateAction<WorkoutEntry[]>>] {
  const s = useWorkspaceScope(), [rows, setRows] = useState<WorkoutEntry[]>([]);
  useEffect(() => {
    if (!signedIn) return; let live = true;
    const load = () => void loadLibrary(s).then(() => historyRequest("manual", 0, 50)).then(p => { if (live) setRows(p.items.map(i => ({ id: i.id, date: i.day, name: i.title, minutes: i.minutes, sets: i.sets ?? 0, reps: i.reps ?? 0, load: i.load ?? 0, source: i.source ?? msg("Manual entry") })).reverse()); }).catch(() => {});
    load(); window.addEventListener("trackcal-workouts", load); return () => { live = false; window.removeEventListener("trackcal-workouts", load); };
  }, [signedIn, s]);
  return [rows, setRows];
}

/** For tests. */
export function resetWorkouts() { scope = ""; library = null; pending = null; migrated = ""; activeDays = []; activeScope = ""; activeLoading = null; emit(); }
