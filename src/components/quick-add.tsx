// "+" quick add: one tap from anywhere for the things people do most. Water, sleep and how you feel save on the spot
// (to the account when signed in); food, workouts and routes open the right page. Press N on a keyboard to open it.
import { msg, t } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Droplets, MapPin, MessageSquare, Moon, Plus, ScanBarcode, Search, Smile, Utensils, X } from "lucide-react";
import Link, { usePathname } from "@/lib/navigation";
import { useCheckins, useDay, useWellness } from "@/lib/days";
import { useLocalDate } from "@/lib/use-local-state";
import type { Checkin } from "@/lib/coach";

const GLASS = 250;
const litres = (ml: number) => Math.round(ml / 10) / 100;   // 1250 ml -> 1.25, written by t() in the language's style
const FOOD: [string, string, typeof Camera][] = [["/scanner", msg("Photo"), Camera], ["/barcode", msg("Barcode"), ScanBarcode], ["/describe", msg("Describe"), MessageSquare], ["/food-library", msg("Search"), Search]];
const ENERGY: [Checkin["energy"], string][] = [["low", msg("Low")], ["ok", msg("Okay")], ["great", msg("Great")]];
const SORE: [Checkin["sore"], string][] = [["no", msg("Not sore")], ["bit", msg("A bit sore")], ["very", msg("Very sore")]];

/** Typing in a field, or holding a modifier, never opens the panel. */
function typing(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return e.ctrlKey || e.metaKey || e.altKey || !!t?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

function Panel({ close }: { close: () => void }) {
  const date = useLocalDate(), [wellness, setWellness] = useWellness(date), { day, signedIn, update } = useDay(date), [checkins, setCheckins] = useCheckins();
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null), [hours, setHours] = useState(""), [energy, setEnergy] = useState<Checkin["energy"] | null>(null);
  const today = checkins.find(c => c.date === date);
  const addWater = () => {
    const next = wellness.water + GLASS;
    setWellness(w => ({ ...w, water: w.water + GLASS }));
    setNotice({ text: t("Water: {litres} L today", { litres: litres(next) }), undo: () => { setWellness(w => ({ ...w, water: Math.max(0, w.water - GLASS) })); setNotice({ text: t("Water removed.") }); } });
  };
  const saveSleep = () => {
    const n = Number(hours);
    if (!hours.trim() || !Number.isFinite(n) || n < 0 || n > 24) { setNotice({ text: t("Enter hours between 0 and 24.") }); return; }
    update({ set: { sleep_hours: Math.round(n * 2) / 2 } }); setHours(""); setNotice({ text: t("Sleep saved: {hours} h", { hours: Math.round(n * 2) / 2 }) });
  };
  const saveFeel = (sore: Checkin["sore"]) => {
    if (!energy) return;
    setCheckins(all => [...all.filter(c => c.date !== date), { date, energy, sore }]);
    setEnergy(null); setNotice({ text: t("Thanks. Your coach will use this today.") });
  };
  return <div className="qa-body">
    <div className="qa-head"><h2 id="qa-title">{t("Quick add")}</h2><button type="button" className="qa-close" onClick={close} aria-label={t("Close")}><X size={20} /></button></div>

    <section className="qa-row" aria-labelledby="qa-food"><h3 id="qa-food"><Utensils size={18} aria-hidden /> {t("Log food")}</h3>
      <div className="qa-choices">{FOOD.map(([href, label, Icon]) => <Link key={href} href={href} className="qa-choice" onClick={close}><Icon size={20} aria-hidden />{t(label)}</Link>)}</div></section>

    <section className="qa-row" aria-labelledby="qa-water"><h3 id="qa-water"><Droplets size={18} aria-hidden /> {t("Water")}</h3>
      <div className="qa-inline"><button type="button" className="ds-btn ds-btn-primary" onClick={addWater}>{t("+ 250 ml")}</button>
        <span className="qa-meta">{t("{done} of {goal} L", { done: litres(wellness.water), goal: litres(wellness.waterGoal) })}</span></div></section>

    <section className="qa-row" aria-labelledby="qa-move"><h3 id="qa-move">{t("Move")}</h3>
      <div className="qa-choices qa-two"><Link href="/workouts/camera" className="qa-choice" onClick={close}><Camera size={20} aria-hidden />{t("Start a workout")}</Link>
        <Link href="/workouts/gps" className="qa-choice" onClick={close}><MapPin size={20} aria-hidden />{t("Record a route")}</Link></div></section>

    {signedIn && <section className="qa-row" aria-labelledby="qa-sleep"><h3 id="qa-sleep"><Moon size={18} aria-hidden /> {t("Sleep last night")}</h3>
      <div className="qa-inline">
        <label className="qa-hours"><input aria-label={t("Hours slept")} type="number" inputMode="decimal" min={0} max={24} step={0.5} placeholder={day?.sleep_hours != null ? String(day.sleep_hours) : "7.5"} value={hours} onChange={e => setHours(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveSleep(); } }} /> <span aria-hidden>{t("h")}</span></label>
        <button type="button" className="ds-btn ds-btn-quiet" onClick={saveSleep}>{t("Save")}</button></div></section>}

    <section className="qa-row" aria-labelledby="qa-feel"><h3 id="qa-feel"><Smile size={18} aria-hidden /> {t("How do you feel?")}</h3>
      {!energy ? <div className="qa-pills" role="group" aria-labelledby="qa-feel">{ENERGY.map(([k, label]) => <button key={k} type="button" aria-pressed={today?.energy === k} onClick={() => setEnergy(k)}>{t(label)}</button>)}</div>
        : <div className="qa-pills" role="group" aria-label={t("Any soreness?")}>{SORE.map(([k, label]) => <button key={k} type="button" onClick={() => saveFeel(k)}>{t(label)}</button>)}</div>}</section>

    <p className="qa-notice" role="status">{notice && <>{notice.text}{notice.undo && <button type="button" className="ds-btn ds-btn-quiet" onClick={notice.undo}>{t("Undo")}</button>}</>}</p>
  </div>;
}

export function QuickAdd() {
  const dialog = useRef<HTMLDialogElement>(null), [open, setOpen] = useState(false), path = usePathname();
  const show = useCallback(() => { const d = dialog.current; if (d && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); setOpen(true); } }, []);
  const close = useCallback(() => { const d = dialog.current; if (d?.close) d.close(); else d?.removeAttribute("open"); setOpen(false); }, []);
  useEffect(() => { close(); }, [path, close]);                                 // a link inside was followed
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.key === "n" || e.key === "N") && !typing(e) && !dialog.current?.open) { e.preventDefault(); show(); } };
    window.addEventListener("keydown", key); window.addEventListener("trackcal-quick-add", show);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("trackcal-quick-add", show); };
  }, [show]);
  return <>
    <button type="button" className="qa-button" aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="N" onClick={show}><Plus size={26} strokeWidth={2.6} aria-hidden /><span>{t("Add")}</span></button>
    {/* Rendered at the top of the page, so the tab bar's own styles never reach the panel. */}
    {createPortal(<dialog ref={dialog} className="qa-dialog" aria-labelledby="qa-title" onClose={() => setOpen(false)}
      onClick={e => { if (e.target === dialog.current) close(); }}>{open && <Panel close={close} />}</dialog>, document.body)}
  </>;
}
