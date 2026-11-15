import { msg } from "./i18n";
// Injury recovery from daily pain check-ins (the rules live on the server: backend/services/recovery.py).
import { useCallback, useEffect, useState } from "react";
import { useAccount, useWorkspaceScope } from "@/components/account-session";

export type CheckIn = { day: string; pain: number; trend: "better" | "same" | "worse"; red_flags: string[] };
export type RecoveryPart = {
  part: string; label: string; side: "left" | "right" | null; kind: "surgery" | "injury" | "pain";
  base: Stage; stage: Stage; stage_name: string; reason: string; alert: "doctor" | "physio" | null; advice: string; next: string;
  checked_today: boolean; history: CheckIn[]; source: string;
};
export type Stage = "avoid" | "healing" | "recovered";
export type Recovery = { today: string; parts: RecoveryPart[]; red_flags: Record<string, string>; source: string };

/** The standard 0-10 numeric pain scale, with the words clinicians use for each band. */
export const PAIN_WORDS = (n: number) => n === 0 ? msg("No pain") : n <= 3 ? msg("Mild") : n <= 6 ? msg("Moderate") : n <= 9 ? msg("Severe") : msg("Worst imaginable");
export const partName = (p: Pick<RecoveryPart, "label" | "side">) => (p.side ? `${p.side} ` : "") + p.label;

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/personalization/" + path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || msg("Could not save your check-in. Check your connection and try again."));
  return data as T;
}

export function useRecovery() {
  const { user } = useAccount(), scope = useWorkspaceScope(), signedIn = !!user && scope !== "guest";
  const [data, setData] = useState<Recovery | null>(null), [error, setError] = useState("");
  const load = useCallback(() => { if (signedIn) call<Recovery>("recovery").then(setData).catch(e => setError(e.message)); }, [signedIn]);
  useEffect(() => { load(); }, [load, scope]);
  const checkIn = async (entry: { part: string; pain: number; trend: CheckIn["trend"]; red_flags: string[] }) => {
    const next = await call<Recovery>("pain-checkin", entry); setData(next);
    window.dispatchEvent(new Event("trackcal-personalization"));   // safety warnings and plans re-read the new stage
    return next;
  };
  return { data, error, checkIn, signedIn };
}
