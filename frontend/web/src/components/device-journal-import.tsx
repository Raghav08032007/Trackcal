// Copy meals from this device's journal into the account diary. Nothing moves until the person reviews a preview and
// confirms; the device copy stays. Each meal gets an id derived from its content, so copying twice never duplicates.
import { t, msg } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { useWorkspaceScope } from "./account-session";
import { exportLocalEntries } from "@/lib/use-local-state";
import { wellnessRequest } from "@/lib/wellness";
import type { MealLog } from "./journal-tools";

export const DEVICE_SOURCE = msg("Device journal · totals as logged");
const DAYS = 30;

type DeviceMeal = { key: string; day: string; meal: MealLog };

function daysBefore(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - count); return date.toISOString().slice(0, 10);
}

export function deviceMeals(entries: Record<string, unknown>, today: string): DeviceMeal[] {
  const oldest = daysBefore(today, DAYS);
  return Object.entries(entries).flatMap(([key, value]) => {
    const day = /^trackcal:journal:(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];
    if (!day || day > today || day < oldest || !Array.isArray(value)) return [];
    // Two different meals with the same time, name and calories (and no id) are both kept (KI-17): the first keeps the
    // original key, so meals copied before this change are still recognised; later twins get "#2", "#3".
    const seen = new Map<string, number>();
    return (value as MealLog[]).filter(meal => meal && typeof meal.name === "string" && meal.name.trim())
      .map(meal => {
        const base = `${day}|${meal.id ?? ""}|${meal.time}|${meal.name}|${meal.calories}`, n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return { key: n === 1 ? base : `${base}|#${n}`, day, meal };
      });
  }).sort((a, b) => b.day.localeCompare(a.day) || a.meal.time.localeCompare(b.meal.time));
}

/** A stable UUID from the meal's content: the server treats a repeated id as the same entry. */
export async function stableId(scope: string, key: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`device-journal|${scope}|${key}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const known = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export function DeviceJournalImport({ today, onDone }: { today: string; onDone: () => Promise<void> }) {
  const scope = useWorkspaceScope();
  const meals = useMemo(() => deviceMeals(exportLocalEntries(scope), today), [scope, today]);
  const [open, setOpen] = useState(false), [chosen, setChosen] = useState<Set<string>>(new Set()), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  if (!meals.length) return null;
  async function copy() {
    setBusy(true); setMessage("");
    let copied = 0;
    try {
      for (const { key, day, meal } of meals.filter(m => chosen.has(m.key))) {
        await wellnessRequest("diary", { id: await stableId(scope, key), day, meal_type: "other", method: "copied", notes: `Logged on this device at ${meal.time}`.slice(0, 1000),
          items: [{ name: meal.name.slice(0, 200), grams: 100, nutrients: { calories: known(meal.calories), protein: known(meal.protein), carbs: known(meal.carbs), fat: known(meal.fat) },
            food_id: null, manual_override: true, estimated: false, source: DEVICE_SOURCE }] });
        copied++;
      }
      setMessage(t("Copied {count} meals to your diary. Copying again won’t duplicate them; your device journal is unchanged.", { count: copied }));
      setOpen(false); await onDone();
    } catch (error) {
      setMessage(t("{count} copied, then: {error}. Try again; meals already copied won’t be duplicated.", { count: copied, error: error instanceof Error ? error.message : t("copy failed") }));
    } finally { setBusy(false); }
  }
  return <section className="account-card" id="device-journal">
    <h2>{t("Meals saved on this device")}</h2>
    <p>{t("{count} meals from the last {days} days are in this device’s journal. Review them before copying anything to your account diary.", { count: meals.length, days: DAYS })}</p>
    {message && <p role="status">{message}</p>}
    {!open ? <button type="button" onClick={() => { setChosen(new Set(meals.map(m => m.key))); setOpen(true); }}>{t("Review device meals")}</button> : <>
      <ul className="device-meals">{meals.map(m => <li key={m.key}><label><input type="checkbox" checked={chosen.has(m.key)} onChange={e => setChosen(current => { const next = new Set(current); if (e.target.checked) next.add(m.key); else next.delete(m.key); return next; })}/> {t("{day} · {time} · {name} · {n} kcal", { day: m.day, time: m.meal.time, name: m.meal.name, n: known(m.meal.calories) ?? "?" })}</label></li>)}</ul>
      <p>{t("Copied meals keep the totals you logged (portion size wasn't recorded) and go under “other”. You can edit them afterwards.")}</p>
      <div className="account-actions">
        <button type="button" disabled={busy || !chosen.size} onClick={() => void copy()}>{busy ? t("Copying…") : t("Copy {count} selected meals", { count: chosen.size })}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)}>{t("Cancel")}</button>
      </div>
    </>}
  </section>;
}
