import { t, msg } from "@/lib/i18n";
import { useWellness } from "@/lib/days";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useStorageWarning, exportLocalEntries } from "@/lib/use-local-state";
import { useWorkspaceScope } from "./account-session";

export interface MealLog { id?: string; time: string; name: string; calories: number; protein: number; carbs: number; fat: number; method: string; }
const blank = { name: "", calories: 0, protein: 0, carbs: 0, fat: 0 };
const inputClass = "w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white";
export function JournalTools({ date, onDate, meals, setMeals }: {
  date: string; onDate: (date: string) => void; meals: MealLog[]; setMeals: Dispatch<SetStateAction<MealLog[]>>;
}) {
  const [form, setForm] = useState(blank);
  const scope = useWorkspaceScope();
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const storageWarning = useStorageWarning();
  const [wellness, setWellness] = useWellness(date);
  function save() {
    if (!form.name.trim() || [form.calories, form.protein, form.carbs, form.fat].some(n => !Number.isFinite(n) || n < 0)) return;
    const entry = { ...form, id: editing === null ? crypto.randomUUID() : meals[editing]?.id || crypto.randomUUID(), name: form.name.trim(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), method: editing === null ? msg("Manual entry") : msg("User corrected") };
    setMeals(previous => editing === null ? [...previous, entry] : previous.map((meal, index) => index === editing ? entry : meal));
    setForm(blank); setEditing(null); setNotice(t("Meal saved on this device."));
  }
  function exportData() {
    const entries = exportLocalEntries(scope);
    entries[`trackcal:journal:${date}`] = meals;
    entries[`trackcal:wellness:${date}`] = wellness;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exported_at: new Date().toISOString(), entries }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `trackcal-${date}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="mb-6 p-5 border border-slate-700 rounded-2xl bg-slate-900 space-y-5">
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <label className="text-sm text-slate-300">{t("Journal date")}{" "}<input aria-label={t("Journal date")} type="date" value={date} onChange={e => { if (e.target.value) { onDate(e.target.value); setEditing(null); setForm(blank); } }} className={inputClass} /></label>
      <button onClick={exportData} className="text-sm text-emerald-300 underline">{t("Export all local data (JSON)")}</button>
    </div>
    <p className="text-xs text-slate-400">{t("Saved in this browser on this device. Export a backup before clearing browser data. No account or subscription required.")}</p>
    {storageWarning && <p role="alert" className="text-amber-300 text-sm">{t("Browser storage is unavailable or full. Changes are temporary in this session; export a backup before leaving.")}</p>}
    <details open><summary className="font-semibold text-white cursor-pointer">{t("Add a meal or correct nutrition")}</summary>
      <form onSubmit={e => { e.preventDefault(); save(); }} className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label className="col-span-2 sm:col-span-5 text-xs text-slate-300">{t("Food name")}<input required maxLength={200} aria-label={t("Food name")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
        {(["calories", "protein", "carbs", "fat"] as const).map(key => <label key={key} className="text-xs text-slate-300">{key === "calories" ? t("Calories (kcal)") : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input aria-label={key} type="number" required min="0" max="20000" step="0.1" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} className={inputClass} /></label>)}
        <button type="submit" className="rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm p-2">{editing === null ? t("Add meal") : t("Save correction")}</button>
        {editing !== null && <button type="button" onClick={() => { setEditing(null); setForm(blank); }}>{t("Cancel edit")}</button>}
      </form>
      <div className="mt-3 space-y-2">{meals.map((meal, index) => <div key={index} className="flex flex-wrap gap-3 items-center text-xs text-slate-300 border-t border-slate-800 pt-2">
        <span className="flex-1">{meal.name}</span>
        <button className="text-sky-300" onClick={() => { setForm(meal); setEditing(index); }}>{t("Edit")}</button>
        <button className="text-emerald-300" onClick={() => setMeals(previous => [...previous, { ...meal, id: crypto.randomUUID(), time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }])}>{t("Repeat")}</button>
        <button className="text-rose-300" onClick={() => { setMeals(previous => previous.filter((_, i) => i !== index)); setEditing(null); setForm(blank); }}>{t("Delete")}</button>
      </div>)}</div>
    </details>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="col-span-2 sm:col-span-3 text-sm text-slate-300">{t("Water: {water} / {waterGoal} ml", { water: wellness.water, waterGoal: wellness.waterGoal })}{" "}<button onClick={() => setWellness(w => ({ ...w, water: w.water + 250 }))} className="ml-3 text-sky-300">{t("+250 ml")}</button><button onClick={() => setWellness(w => ({ ...w, water: Math.max(0, w.water - 250) }))} className="ml-3 text-sky-300">{t("Undo 250 ml")}</button></div>
      {([ ["waterGoal", msg("Water goal (ml)")], ["steps", msg("Steps")], ["minutes", msg("Workout minutes")], ["weight", msg("Weight (kg)")] ] as const).map(([key, label]) => <label key={key} className="text-xs text-slate-300">{t(label)}<input aria-label={t(label)} type="number" min="0" max={key === "weight" ? 500 : 100000} step={key === "weight" ? "0.1" : "1"} value={wellness[key]} onChange={e => setWellness(w => ({ ...w, [key]: Math.max(0, Number(e.target.value)) }))} className={inputClass} /></label>)}
      <label className="text-xs text-slate-300">{t("Activity")}<input aria-label={t("Activity")} placeholder={t("Walk, run, swim…")} maxLength={100} value={wellness.activity} onChange={e => setWellness(w => ({ ...w, activity: e.target.value }))} className={inputClass} /></label>
    </div>
    <p role="status" className="text-xs text-emerald-300">{notice}</p>
  </section>;
}
