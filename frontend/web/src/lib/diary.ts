import { msg, t } from "./i18n";
// One food diary for the whole app. Signed in, every screen reads and writes the account diary on the server, through one shared
// store per day, so Home, Food, Coach and Play always agree and nothing is lost on another device. Signed out, it is the browser
// journal as before. The hook has the same shape as the old browser journal: [meals, setMeals].
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import type { MealLog } from "@/components/journal-tools";
import { useLocalState, exportLocalEntries, workspaceKey } from "@/lib/use-local-state";
import { wellnessRequest } from "@/lib/wellness";

type Nutrients = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
export type DiaryItemInput = { name: string; grams: number; nutrients: Nutrients; food_id?: string | null; manual_override?: boolean; estimated?: boolean; source?: string };
/** A meal in the diary. `items` (with grams) is sent when the screen knows them; otherwise the totals become one portion. */
// ai_estimate: what the AI said for a photo before the person reviewed it; the server keeps it beside the saved values
// for the accuracy report (backend services/accuracy.py).
export type DiaryMeal = MealLog & { items?: DiaryItemInput[]; meal_type?: string; grams?: number; ai_estimate?: { calories: number; grams: number } };
type ServerEntry = { id: string; day: string; time?: string; meal_type: string; method: string; notes: string; items: (DiaryItemInput & { nutrients: Nutrients })[]; totals: Record<string, number | null> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

function fromServer(e: ServerEntry): DiaryMeal {
  const name = e.items.length === 1 ? e.items[0].name : e.items.map(i => i.name).slice(0, 3).join(", ") + (e.items.length > 3 ? ` +${e.items.length - 3}` : "");
  return { id: e.id, time: e.time ?? "", name, calories: round(e.totals.calories), protein: round(e.totals.protein), carbs: round(e.totals.carbs), fat: round(e.totals.fat),
    method: e.method === "photo" ? msg("Photo") : e.method === "saved" ? msg("Saved meal") : e.method === "copied" ? msg("Imported") : msg("Manual"), items: e.items, meal_type: e.meal_type };
}
const mealType = (time: string) => { const h = Number(time.slice(0, 2)); return !Number.isFinite(h) ? "other" : h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner"; };
const method = (m: string) => (/photo|scan|camera|image/i.test(m) ? "photo" : /saved|favou?rite|template|repeat|copy/i.test(m) ? "saved" : "manual");
const per100 = (total: number | null | undefined, grams: number) => (typeof total === "number" && Number.isFinite(total) ? Math.round((total * 100 / grams) * 1000) / 1000 : null);

/** The request body for one meal (exported for tests). */
export function toServer(meal: DiaryMeal, day: string) {
  const grams = meal.grams && meal.grams > 0 ? meal.grams : 100;
  const items = meal.items?.length ? meal.items.slice(0, 30).map(i => ({ food_id: null, manual_override: false, estimated: false, source: "User reviewed input", ...i, name: i.name.slice(0, 200) }))
    : [{ name: meal.name.slice(0, 200), grams, nutrients: { calories: per100(meal.calories, grams), protein: per100(meal.protein, grams), carbs: per100(meal.carbs, grams), fat: per100(meal.fat, grams) }, food_id: null, manual_override: true, estimated: /photo|scan|ai/i.test(meal.method), source: `${meal.method || "Logged"} · totals as logged`.slice(0, 90) }];
  const ai = meal.ai_estimate && method(meal.method) === "photo" && Number.isFinite(meal.ai_estimate.calories) && meal.ai_estimate.calories >= 0 && meal.ai_estimate.grams > 0 ? { ai_estimate: meal.ai_estimate } : {};
  return { id: meal.id!, day, meal_type: meal.meal_type && ["breakfast", "lunch", "dinner", "snack", "drink", "other"].includes(meal.meal_type) ? meal.meal_type : mealType(meal.time), method: method(meal.method), notes: "", items, ...ai };
}
const same = (a: DiaryMeal, b: DiaryMeal) => a.name === b.name && a.calories === b.calories && a.protein === b.protein && a.carbs === b.carbs && a.fat === b.fat && JSON.stringify(a.items ?? null) === JSON.stringify(b.items ?? null);

// One store per signed-in person and day, shared by every screen that shows it.
type Day = { meals: DiaryMeal[]; loaded: boolean; error: string; deleted: Set<string> };
const days = new Map<string, Day>(), listeners = new Set<() => void>(), loading = new Map<string, Promise<void>>();
const emit = () => listeners.forEach(l => l());
const blank = (): Day => ({ meals: [], loaded: false, error: "", deleted: new Set() });
const keyOf = (scope: string, day: string) => `${scope}|${day}`;
function put(key: string, patch: Partial<Day>) { days.set(key, { ...(days.get(key) ?? blank()), ...patch }); emit(); }

async function load(scope: string, day: string, force = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;  // a screen still waiting for its date (e.g. "pending") has nothing to fetch
  const key = keyOf(scope, day);
  if (!force && (days.get(key)?.loaded || loading.has(key))) return loading.get(key);
  const job = (async () => {
    try {
      await migrated(scope);
      const all: ServerEntry[] = [];
      for (let offset = 0; offset < 500; offset += 100) {
        const page = await wellnessRequest<{ entries: ServerEntry[]; has_more: boolean }>(`diary?day=${day}&limit=100&offset=${offset}`);
        all.push(...page.entries); if (!page.has_more) break;
      }
      put(key, { meals: all.map(fromServer).sort((a, b) => a.time.localeCompare(b.time)), loaded: true, error: "" });
    } catch (e) { put(key, { loaded: true, error: e instanceof Error ? e.message : t("Your diary could not load.") }); }
    finally { loading.delete(key); }
  })();
  loading.set(key, job); return job;
}

/** Writes the difference between the old and new meal lists to the server, then refreshes the day. */
async function commit(scope: string, day: string, before: DiaryMeal[], after: DiaryMeal[]) {
  const key = keyOf(scope, day), state = days.get(key) ?? blank();
  const old = new Map(before.filter(m => m.id).map(m => [m.id!, m])), next = new Map(after.filter(m => m.id).map(m => [m.id!, m]));
  try {
    for (const meal of after) {
      if (!old.has(meal.id!)) {
        if (state.deleted.has(meal.id!)) { await wellnessRequest(`diary/${meal.id}/restore`, {}); state.deleted.delete(meal.id!); }
        else await wellnessRequest("diary", toServer(meal, day));
      } else if (!same(old.get(meal.id!)!, meal)) await wellnessRequest(`diary/${meal.id}`, toServer(meal, day), "PUT");
    }
    for (const id of old.keys()) if (!next.has(id)) { await wellnessRequest(`diary/${id}`, undefined, "DELETE"); state.deleted.add(id); }
    window.dispatchEvent(new Event("trackcal-diary"));
  } catch (e) {
    put(key, { meals: before, error: e instanceof Error ? t("{message} Nothing was changed.", { message: e.message }) : t("Could not save. Nothing was changed.") });
    return;
  }
  await load(scope, day, true);
}

// Meals that used to live only in this browser move to the account once, then leave the browser.
const moved = new Map<string, Promise<void>>();
function migrated(scope: string) {
  if (!moved.has(scope)) moved.set(scope, (async () => {
    const { deviceMeals, stableId, DEVICE_SOURCE } = await import("@/components/device-journal-import");
    const today = new Date().toISOString().slice(0, 10);
    const found = deviceMeals(exportLocalEntries(scope), today);
    if (!found.length) return;
    const doneDays = new Set<string>();
    for (const { key, day, meal } of found) {
      const grams = 100;
      await wellnessRequest("diary", { id: await stableId(scope, key), day, meal_type: mealType(meal.time), method: "copied", notes: `Logged on this device at ${meal.time}`.slice(0, 1000),
        items: [{ name: meal.name.slice(0, 200), grams, nutrients: { calories: per100(meal.calories, grams), protein: per100(meal.protein, grams), carbs: per100(meal.carbs, grams), fat: per100(meal.fat, grams) }, food_id: null, manual_override: true, estimated: false, source: DEVICE_SOURCE }] });
      doneDays.add(day);
    }
    for (const day of doneDays) { try { localStorage.removeItem(workspaceKey(`trackcal:journal:${day}`, scope)); } catch { /* storage off */ } }
  })().catch(() => { moved.delete(scope); }));
  return moved.get(scope)!;
}

export type DiaryState = { loaded: boolean; error: string; reload: () => void };
/** [meals, setMeals, state] for one day. setMeals takes a list or an updater, like React state. */
/** A real calendar day; callers may pass a placeholder (such as "pending") before they know today's date. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function useDiaryMeals(day: string): [DiaryMeal[], (next: DiaryMeal[] | ((prev: DiaryMeal[]) => DiaryMeal[])) => void, DiaryState] {
  const { user } = useAccount(), scope = useWorkspaceScope(), signedIn = !!user && scope !== "guest";
  const [local, setLocal] = useLocalState<DiaryMeal[]>(`trackcal:journal:${day}`, []);
  const key = keyOf(scope, day);
  const snapshot = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => days.get(key), () => days.get(key));
  useEffect(() => { if (signedIn && DAY.test(day)) void load(scope, day); }, [signedIn, scope, day]);
  useEffect(() => { if (!signedIn || !DAY.test(day)) return; const refresh = () => void load(scope, day, true); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [signedIn, scope, day]);
  const meals = signedIn ? snapshot?.meals ?? [] : local;
  const set = useCallback((next: DiaryMeal[] | ((prev: DiaryMeal[]) => DiaryMeal[])) => {
    if (!signedIn) { setLocal(next as never); return; }
    const before = days.get(key)?.meals ?? [];
    const after = (typeof next === "function" ? next(before) : next).map(m => (m.id && UUID.test(m.id) ? m : { ...m, id: crypto.randomUUID() }));
    put(key, { meals: after, error: "" });  // the screen updates at once; the server write follows
    void commit(scope, day, before, after);
  }, [signedIn, key, scope, day, setLocal]);
  const state = useMemo(() => ({ loaded: !signedIn || !!snapshot?.loaded, error: snapshot?.error ?? "", reload: () => void load(scope, day, true) }), [signedIn, snapshot, scope, day]);
  return [meals, set, state];
}

/** For tests: forget every cached day. */
export function resetDiaryStore() { days.clear(); loading.clear(); moved.clear(); emit(); }
