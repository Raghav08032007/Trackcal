// Today at a glance: water, sleep and calories burned, kept in your account so every device shows the same.
import { t } from "@/lib/i18n";
import { useState } from "react";
import { Droplets, Flame, Moon } from "lucide-react";
import { useDay, useRecentDays, type Day } from "@/lib/days";

const GLASS = 250;
const QUALITY: [NonNullable<Day["sleep_quality"]>, string][] = [["poor", "Restless"], ["ok", "Okay"], ["good", "Rested"]];
const weekday = (d: string) => new Date(d + "T12:00:00").toLocaleDateString([], { weekday: "narrow" });

export function DayCard({ date }: { date: string }) {
  const { day, signedIn, update } = useDay(date), { days } = useRecentDays();
  const [hours, setHours] = useState<string | null>(null);
  if (!signedIn) return null;
  if (!day) return <section className="ds-card day-card" aria-busy="true" aria-label={t("Your day")}><p className="ds-sub">{t("Loading your day…")}</p></section>;
  const waterPct = Math.min(100, Math.round(day.water_ml / day.water_goal_ml * 100));
  const shownHours = hours ?? (day.sleep_hours != null ? String(day.sleep_hours) : "");
  const saveHours = () => { if (hours === null) return; const n = Number(hours); setHours(null); if (hours.trim() === "") update({ set: { sleep_hours: null } }); else if (Number.isFinite(n) && n >= 0 && n <= 24) update({ set: { sleep_hours: Math.round(n * 2) / 2 } }); };
  const week = (days ?? []).slice(0, 7).reverse();
  return <section className="ds-card day-card" aria-labelledby="day-card-title">
    <h2 id="day-card-title">{t("Your day")}</h2>
    <div className="day-card-grid">
      <div className="day-tile day-water">
        <p className="day-label"><Droplets size={18} aria-hidden /> {t("Water")}</p>
        <p className="day-big">{(day.water_ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} <small>of {(day.water_goal_ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L</small></p>
        <div className="day-meter" role="progressbar" aria-label={t("Water today")} aria-valuemin={0} aria-valuemax={day.water_goal_ml} aria-valuenow={day.water_ml}><span style={{ width: `${waterPct}%` }} /></div>
        <div className="day-actions"><button type="button" className="ds-btn ds-btn-primary" onClick={() => update({ add: { water_ml: GLASS } })}>{t("+ 250 ml")}</button>
          <button type="button" className="ds-btn ds-btn-quiet" disabled={day.water_ml <= 0} onClick={() => update({ add: { water_ml: -GLASS } })} aria-label={t("Remove 250 ml")}>− 250</button></div>
        <p className="day-note">{day.water_goal_set ? t("Your own goal.") : day.water_goal_basis === "weight" ? t("Goal from your weight, about 35 ml per kg.") : t("A general goal. Add your weight in your profile for your own.")}</p>
      </div>
      <div className="day-tile day-sleep">
        <p className="day-label"><Moon size={18} aria-hidden /> {t("Sleep last night")}</p>
        <label className="day-hours">{t("Hours")}<input type="number" inputMode="decimal" min={0} max={24} step={0.5} value={shownHours} placeholder="—"
          onChange={e => setHours(e.target.value)} onBlur={saveHours} onKeyDown={e => { if (e.key === "Enter") saveHours(); }} /></label>
        <div className="day-choice" role="group" aria-label={t("How well you slept")}>{QUALITY.map(([k, label]) => <button key={k} type="button" aria-pressed={day.sleep_quality === k}
          onClick={() => update({ set: { sleep_quality: day.sleep_quality === k ? null : k } })}>{label}</button>)}</div>
        {week.some(d => d.sleep_hours != null) && <div className="day-week" aria-label={t("Sleep, last 7 days")}>{week.map(d => <span key={d.day} title={d.sleep_hours == null ? t("{day}: not logged", { day: d.day }) : t("{day}: {hours} h", { day: d.day, hours: d.sleep_hours })}>
          <i style={{ height: `${Math.min(100, (d.sleep_hours ?? 0) / 10 * 100)}%` }} data-empty={d.sleep_hours == null || undefined} /><b>{weekday(d.day)}</b></span>)}</div>}
      </div>
      <div className="day-tile day-burn">
        <p className="day-label"><Flame size={18} aria-hidden /> {t("Burned today")}</p>
        <p className="day-big">{day.burned_total.toLocaleString()} <small>kcal</small></p>
        <p className="day-note">{day.route_kcal ? t("{routes} from recorded routes, {workouts} from workouts.", { routes: day.route_kcal, workouts: Math.round(day.burn_kcal) }) : t("From camera workouts, logged exercise and recorded routes.")}</p>
      </div>
    </div>
  </section>;
}
