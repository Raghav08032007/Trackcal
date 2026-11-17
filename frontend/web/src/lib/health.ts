import { t, msg } from "@/lib/i18n";
// Blood reports: read (nothing stored), confirm and save values, and the plan they lead to.
export type Reading = { code: string; name: string; value: number; unit: string; ref_low: number | null; ref_high: number | null; source?: string };
export type Finding = { code: string; name: string; value: number; unit: string; low: number | null; high: number | null; range_from: string; status: "normal" | "high" | "low"; severity: "ok" | "watch" | "soon" | "today"; rule: string | null; explanation: string; source?: string };
export type HealthPlanView = { rules: string[]; targets: Record<string, number>; exercise: Record<string, number | boolean | string>; diet: string[]; move: string[]; retest_days: number; retest_on?: string; why?: { rule: string; about: string; source: string; retest_days: number }[]; activity_source?: string };
export type Assessment = { findings: Finding[]; safety: "ok" | "soon" | "today"; safety_message: string; plan: HealthPlanView | null; plan_note?: string; disclaimer: string };
export type ReportView = { id: string; report_date: string; lab_name: string | null; source: string; tests?: number };
export type Summary = { reports: ReportView[]; latest: ({ report: ReportView } & Assessment) | null; history: Record<string, { date: string; value: number }[]> };
export type TestInfo = { code: string; name: string; unit: string };

export class HealthError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function health<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path.startsWith("/") ? path : "/api/health/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HealthError(data.error || msg("Reports are unavailable right now. Nothing was saved."), response.status);
  return data as T;
}
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error(t("That file could not be opened."))); r.readAsDataURL(file); });
}
/** Display bounds for a value on its range bar: room either side of the normal band and the value. */
export function scale(f: Finding) {
  const top = Math.max(f.high ?? f.value, f.value, f.low ?? 0) * 1.35, bottom = Math.max(0, Math.min(f.low ?? 0, f.value) * 0.6);
  // Round the bar's ends to tidy numbers: whole numbers above 20, one decimal below.
  const tidy = (v: number) => (v >= 20 ? Math.round(v) : Math.round(v * 10) / 10);
  return { min: tidy(bottom), max: tidy(top) };
}
export const TARGET_TEXT: Record<string, (v: number) => string> = {
  fibre_g: v => t("{v} g fibre a day", { v }), added_sugar_g: v => t("Under {v} g added sugar a day", { v }), sat_fat_pct: v => t("Saturated fat under {v}% of calories", { v }),
  sodium_mg: v => t("Salt under {v} g a day", { v: Math.round(v / 400) }), water_l: v => t("{v} litres of water a day", { v }), protein_g_per_kg: v => t("Protein about {v} g per kg of body weight", { v }),
};
