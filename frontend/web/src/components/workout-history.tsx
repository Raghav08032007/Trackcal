// Every workout in one place: camera and gym sessions, workouts you logged yourself and recorded routes, newest first.
import { t, msg } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Dumbbell, MapPin, NotebookPen, Pencil, Trash2 } from "lucide-react";
import Link from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { useLocalDate } from "@/lib/use-local-state";
import { addWorkout, editWorkout, historyRequest, loadLibrary, removeHistoryItem, restoreHistoryItem, type EntryInput, type HistoryItem, type HistoryKind } from "@/lib/workouts";

const FILTERS: [HistoryKind, string][] = [["all", msg("All")], ["camera", msg("Camera")], ["gym", msg("Gym")], ["manual", msg("Logged")], ["route", msg("Routes")]];
const ICONS = { camera: Camera, gym: Dumbbell, manual: NotebookPen, route: MapPin };
const PAGE = 20;
const blank = (day: string): EntryInput => ({ day, name: "", minutes: 30, sets: 0, reps: 0, load: 0 });

function dayLabel(day: string, today: string) {
  const y = new Date(today + "T12:00:00"); y.setDate(y.getDate() - 1);
  if (day === today) return t("Today");
  if (day === `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`) return t("Yesterday");
  return new Date(day + "T12:00:00").toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

function EntryForm({ start, onSave, onCancel }: { start: EntryInput; onSave: (e: EntryInput) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(start), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const num = (k: "minutes" | "sets" | "reps" | "load", label: string, max: number, step = 1) => <label>{label}<input type="number" min={0} max={max} step={step} inputMode="decimal" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) || 0 }))} /></label>;
  return <form className="history-form" onSubmit={async e => { e.preventDefault(); if (!form.name.trim()) { setError(t("Give the workout a name.")); return; } setBusy(true); setError(""); try { await onSave({ ...form, name: form.name.trim() }); } catch (x) { setError(x instanceof Error ? x.message : t("Could not save.")); } finally { setBusy(false); } }}>
    <label className="history-form-wide">{t("Workout")}<input required maxLength={120} value={form.name} placeholder={t("Leg day, swim, yoga…")} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
    <label>{t("Date")}<input type="date" required value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} /></label>
    {num("minutes", t("Minutes"), 1440)}{num("sets", t("Sets"), 200)}{num("reps", t("Reps per set"), 1000)}{num("load", t("Weight (kg)"), 1000, 0.5)}
    {error && <p role="alert" className="account-error history-form-wide">{error}</p>}
    <div className="history-form-wide history-form-actions"><button className="ds-btn ds-btn-primary" disabled={busy}>{t("Save")}</button><button type="button" className="ds-btn ds-btn-quiet" onClick={onCancel}>{t("Cancel")}</button></div>
  </form>;
}

export function WorkoutHistory() {
  const { user } = useAccount(), userId = user?.id, scope = useWorkspaceScope(), today = useLocalDate();
  const [kind, setKind] = useState<HistoryKind>("all"), [items, setItems] = useState<HistoryItem[] | null>(null), [more, setMore] = useState(false);
  const [error, setError] = useState(""), [loadFailed, setLoadFailed] = useState(false), [editing, setEditing] = useState<string | null>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("log") === "1" ? "new" : null), [undo, setUndo] = useState<HistoryItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), shown = useRef(PAGE);
  const load = useCallback(async (k: HistoryKind, count: number) => {
    try { const page = await historyRequest(k, 0, Math.min(50, count)); setItems(page.items); setMore(page.has_more); setLoadFailed(false); }
    catch { setLoadFailed(true); setItems(i => i ?? []); }
  }, []);
  // Workouts kept only in this browser are copied to the account first; the list refreshes when that finishes.
  useEffect(() => { if (userId && scope !== "guest") void loadLibrary(scope); }, [userId, scope]);
  useEffect(() => { if (!userId) return; shown.current = PAGE; setItems(null); void load(kind, PAGE); }, [userId, kind, load]);
  useEffect(() => { if (!userId) return; const again = () => void load(kind, shown.current); window.addEventListener("trackcal-workouts", again); return () => window.removeEventListener("trackcal-workouts", again); }, [userId, kind, load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!userId) return null;

  async function loadMore() {
    try { const page = await historyRequest(kind, items?.length ?? 0, PAGE); setItems(i => [...(i ?? []), ...page.items.filter(n => !(i ?? []).some(o => o.id === n.id))]); setMore(page.has_more); shown.current = Math.min(50, (items?.length ?? 0) + PAGE); }
    catch { setError(t("Could not load more. Try again.")); }
  }
  async function remove(item: HistoryItem) {
    setItems(i => (i ?? []).filter(x => x.id !== item.id));
    try { await removeHistoryItem(item); setUndo(item); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setUndo(null), 8000); }
    catch { setError(t("Could not delete {title}. Try again.", { title: item.title })); void load(kind, shown.current); }
  }
  async function bringBack() { const item = undo; setUndo(null); if (!item) return; try { await restoreHistoryItem(item); } catch { setError(t("Could not undo. Try again.")); } }

  const groups: [string, HistoryItem[]][] = [];
  for (const item of items ?? []) { const last = groups[groups.length - 1]; if (last && last[0] === item.day) last[1].push(item); else groups.push([item.day, [item]]); }
  const opened = useRef(false);
  useEffect(() => { if (editing === "new" && !opened.current && new URLSearchParams(window.location.search).get("log") === "1") { opened.current = true; document.getElementById("workout-history")?.scrollIntoView({ block: "start" }); } }, [editing]);
  return <section id="workout-history" className="ds-card history-card" aria-labelledby="history-title">
    <div className="history-head"><h2 id="history-title">{t("Your workouts")}</h2>
      {editing !== "new" && <button type="button" className="ds-btn ds-btn-primary" onClick={() => setEditing("new")}>{t("Log a workout")}</button>}</div>
    {editing === "new" && <EntryForm start={blank(today)} onCancel={() => setEditing(null)} onSave={async e => { await addWorkout(e); setEditing(null); }} />}
    <div className="history-filters" role="group" aria-label={t("Show")}>{FILTERS.map(([k, label]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{t(label)}</button>)}</div>
    {error && <p role="alert" className="account-error">{error}</p>}
    {loadFailed && <p className="history-empty">{t("Your workouts could not load just now. Your records are safe;")}{" "}<button type="button" className="ds-btn ds-btn-quiet" onClick={() => void load(kind, shown.current)}>{t("try again")}</button>.</p>}
    {undo && <div className="history-undo" role="status"><span>{t("{title} deleted.", { title: undo.title })}</span><button type="button" className="ds-btn ds-btn-quiet" onClick={() => void bringBack()}>{t("Undo")}</button></div>}
    {items === null ? <p className="ds-sub" aria-busy="true">{t("Loading your workouts…")}</p>
      : !items.length ? loadFailed ? null : <p className="history-empty">{kind === "all" ? t("No workouts yet. A camera workout, a recorded route or one you log here will show up in this list.") : t("Nothing of this kind yet.")}</p>
      : groups.map(([day, rows]) => <div key={day} className="history-day"><h3>{dayLabel(day, today)}</h3><ul>{rows.map(item => {
        const Icon = ICONS[item.kind];
        return <li key={item.id} data-kind={item.kind}>
          {editing === item.id ? <EntryForm start={{ day: item.day, name: item.title, minutes: item.minutes, sets: item.sets ?? 0, reps: item.reps ?? 0, load: item.load ?? 0 }} onCancel={() => setEditing(null)} onSave={async e => { await editWorkout(item.id, e); setEditing(null); }} />
          : <><span className="history-icon" aria-hidden><Icon size={20} /></span>
            <div className="history-main"><strong>{item.title}</strong><small>{[item.minutes ? `${item.minutes} min` : "", item.detail].filter(Boolean).join(" · ")}</small></div>
            <div className="history-actions">
              {item.link && <Link href={item.link} className="ds-btn ds-btn-quiet">{t("Open")}</Link>}
              {item.editable && <button type="button" className="history-icon-btn" aria-label={t("Edit {title}", { title: item.title })} onClick={() => setEditing(item.id)}><Pencil size={18} /></button>}
              {item.removable && <button type="button" className="history-icon-btn" aria-label={t("Delete {title}", { title: item.title })} onClick={() => void remove(item)}><Trash2 size={18} /></button>}
            </div></>}
        </li>;
      })}</ul></div>)}
    {more && <button type="button" className="ds-btn ds-btn-quiet history-more" onClick={() => void loadMore()}>{t("Load more")}</button>}
  </section>;
}
