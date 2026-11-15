import { msg } from "./i18n";
// Which exercises the app advises against for this person (injuries, surgeries, a blood report's limit), loaded once per account.
import { useEffect, useSyncExternalStore } from "react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { EXERCISE_CONFIG } from "@/lib/pose/exercise-config";
import { EXERCISES, type ExerciseKind } from "@/lib/pose/types";

export type Advice = { level: "avoid" | "caution"; reasons: string[] };
type Safety = { exercises: Record<string, Advice>; protected: Record<string, string>; report_limit: string | null };

let scope = "", state: Safety | null = null, loading: Promise<void> | null = null;
const accepted = new Set<string>();                         // decisions already made this visit, so the warning isn't repeated each set
const listeners = new Set<() => void>(), emit = () => listeners.forEach(l => l());

export function loadSafety(s: string, force = false) {
  if (scope !== s) { scope = s; state = null; loading = null; accepted.clear(); }
  if (!force && (state || loading)) return loading ?? Promise.resolve();
  loading = fetch("/api/personalization/exercise-safety", { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null)
    .then(v => { if (scope === s && v && typeof v.exercises === "object") { state = v; emit(); } }).catch(() => {}).finally(() => { loading = null; });
  return loading;
}
export const templateOf = (kind: ExerciseKind) => EXERCISE_CONFIG[kind]?.template ?? `camera_${kind}`;

export function useExerciseSafety() {
  const { user } = useAccount(), s = useWorkspaceScope(), signedIn = !!user && s !== "guest";
  const safety = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => (scope === s ? state : null), () => null);
  useEffect(() => { if (signedIn) void loadSafety(s); }, [signedIn, s]);
  useEffect(() => { if (!signedIn) return; const again = () => void loadSafety(s, true); window.addEventListener("trackcal-personalization", again); return () => window.removeEventListener("trackcal-personalization", again); }, [signedIn, s]);
  const adviceForTemplate = (template: string): Advice | null => (signedIn && safety?.exercises[template]) || null;
  const adviceFor = (kind: ExerciseKind): Advice | null => adviceForTemplate(templateOf(kind));
  /** Up to three exercises for the same body area that the app has nothing against. */
  const saferThan = (kind: ExerciseKind): ExerciseKind[] => (Object.keys(EXERCISES) as ExerciseKind[])
    .filter(k => k !== kind && EXERCISES[k].group === EXERCISES[kind].group && !adviceFor(k) && EXERCISE_CONFIG[k]).slice(0, 3);
  return { adviceFor, adviceForTemplate, saferThan, accepted: (kind: ExerciseKind) => accepted.has(templateOf(kind)), acceptedTemplate: (t: string) => accepted.has(t), signedIn };
}

/** The person read why and chose to continue: recorded on their account as their own decision. */
export async function acceptRisk(template: string) {
  const response = await fetch("/api/personalization/exercise-ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template, accepted: true }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(msg("Could not record your decision. Check your connection and try again."));
  accepted.add(template); emit();
}

/** For tests. */
export function resetSafety() { scope = ""; state = null; loading = null; accepted.clear(); emit(); }
