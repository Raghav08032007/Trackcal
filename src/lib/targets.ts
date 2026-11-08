// Daily food targets, one set for the whole app. Signed in, they come from the account (calculated from the profile, with any
// manual values), shared by every screen. Signed out, they are this browser's values as before.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { exportLocalEntries, useLocalState, workspaceKey } from "@/lib/use-local-state";
import { personalRequest } from "@/lib/personalization";

export type TargetName = "calories" | "protein" | "carbs" | "fat";
export type Targets = Record<TargetName, number> & { fibre: number; added_sugar_max: number; complete: boolean; manual: TargetName[]; explanation: string[];
  basis: { bmr?: number; maintenance?: number; adjustment?: number; floor?: number; weight_kg?: number; age?: number } };
export const DEFAULT_TARGETS: Record<TargetName, number> = { calories: 2100, protein: 130, carbs: 220, fat: 65 };

let current: Targets | null = null, currentScope = "", pending: Promise<void> | null = null;
const listeners = new Set<() => void>(), emit = () => listeners.forEach(l => l());

/** Custom targets that were only in this browser become manual values once, if the profile can't calculate them yet. */
async function migrate(scope: string, server: Targets) {
  const local = exportLocalEntries(scope) as Record<string, unknown>, custom: Partial<Record<TargetName, number>> = {};
  for (const name of Object.keys(DEFAULT_TARGETS) as TargetName[]) {
    const value = local[`trackcal:target:${name}`];
    if (typeof value === "number" && value > 0 && value !== DEFAULT_TARGETS[name]) custom[name] = Math.round(value);
  }
  for (const name of Object.keys(DEFAULT_TARGETS)) { try { localStorage.removeItem(workspaceKey(`trackcal:target:${name}`, scope)); } catch { /* storage off */ } }
  if (!Object.keys(custom).length || server.complete || server.manual.length) return server;
  return personalRequest<Targets>("targets", custom, "PUT").catch(() => server);
}

/** Only a whole set of targets is used; anything else (an error page, an old server) leaves the defaults in place. */
function valid(t: unknown): t is Targets {
  const v = t as Partial<Targets> | null;
  return !!v && (Object.keys(DEFAULT_TARGETS) as TargetName[]).every(k => typeof v[k] === "number" && v[k]! > 0) && Array.isArray(v.manual) && Array.isArray(v.explanation);
}

export function loadTargets(scope: string, force = false) {
  if (!force && currentScope === scope && (current || pending)) return pending ?? Promise.resolve();
  currentScope = scope;
  pending = personalRequest<Targets>("targets").then(t => { if (!valid(t)) throw new Error("no targets"); return migrate(scope, t); })
    .then(t => { if (valid(t)) { current = t; emit(); } }).catch(() => {}).finally(() => { pending = null; });
  return pending;
}
export async function saveTargets(patch: Partial<Record<TargetName, number | null>>) {
  const t = await personalRequest<Targets>("targets", patch, "PUT");
  if (!valid(t)) throw new Error("Could not save your targets. Please try again.");
  current = t; emit(); return t;
}

/** The whole set, for screens that show all targets and how they were worked out. */
export function useTargets() {
  const { user } = useAccount(), scope = useWorkspaceScope(), signedIn = !!user && scope !== "guest";
  const t = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => (currentScope === scope ? current : null), () => null);
  useEffect(() => { if (signedIn) void loadTargets(scope); }, [signedIn, scope]);
  useEffect(() => { if (!signedIn) return; const refresh = () => void loadTargets(scope, true); window.addEventListener("trackcal-targets", refresh); window.addEventListener("trackcal-personalization", refresh); return () => { window.removeEventListener("trackcal-targets", refresh); window.removeEventListener("trackcal-personalization", refresh); }; }, [signedIn, scope]);
  return { targets: signedIn ? t : null, signedIn };
}

/** One target as [value, setValue], the same shape the screens used for the browser value. Setting it signed in saves a manual value. */
export function useTarget(name: TargetName): [number, (next: number | ((prev: number) => number)) => void] {
  const { targets, signedIn } = useTargets();
  const [local, setLocal] = useLocalState<number>(`trackcal:target:${name}`, DEFAULT_TARGETS[name]);
  const value = signedIn ? targets?.[name] ?? DEFAULT_TARGETS[name] : local;
  const set = useCallback((next: number | ((prev: number) => number)) => {
    if (!signedIn) { setLocal(next as never); return; }
    const resolved = Math.round(typeof next === "function" ? next(value) : next);
    if (resolved > 0) void saveTargets({ [name]: resolved }).catch(() => {});
  }, [signedIn, setLocal, name, value]);
  return [value, set];
}

/** For tests. */
export function resetTargets() { current = null; currentScope = ""; pending = null; emit(); }
