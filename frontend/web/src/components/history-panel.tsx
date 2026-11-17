// Progress: monthly summaries of everything the person has logged (free for everyone), and, when the free limit applies, a plain
// note that older detail is Premium and that nothing has been deleted.
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Link } from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";

type Month = { month: string; days_logged: number; meals: number; avg_kcal: number | null; avg_water_ml: number | null; avg_sleep_h: number | null;
  active_min: number; workouts: number; weight_start: number | null; weight_end: number | null };
type Summary = { history: { limited: boolean; from: string | null; free_days: number; premium: boolean; billing: boolean }; months: Month[] };

const monthName = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });

export function HistoryPanel() {
  const { user } = useAccount(), scope = useWorkspaceScope(), [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    if (!user || scope === "guest") return;
    let alive = true;
    fetch("/api/personalization/history-summary", { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null).then(d => { if (alive && d) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [user, scope]);
  if (!data) return null;
  const h = data.history;
  return <section className="account-card history-panel" aria-labelledby="history-title">
    <div className="history-head"><span className="history-icon" aria-hidden="true"><History size={22} /></span>
      <div><h2 id="history-title">{t("Your history, month by month")}</h2><p className="ds-sub">{t("Summaries of everything you've logged, always included.")}</p></div></div>
    {h.limited && <p className="history-limit">{t("You see the last {free_days} days in full detail. Older days are part of", { free_days: h.free_days })}{" "}<Link href="/premium">{t("Premium")}</Link>. <strong>{t("Nothing has been deleted:")}</strong> {t("it all comes back the moment you upgrade, and your data export always includes everything.")}</p>}
    {data.months.length === 0 ? <p className="ds-sub">{t("Nothing logged yet. Your first month will appear here.")}</p> :
      <div className="history-months">{data.months.map(m => <article key={m.month} className="history-month">
        <h3>{monthName(m.month)}</h3>
        <dl>
          <div><dt>{t("Days logged")}</dt><dd>{m.days_logged}</dd></div>
          <div><dt>{t("Meals")}</dt><dd>{m.meals}</dd></div>
          {m.avg_kcal !== null && <div><dt>{t("Average kcal")}</dt><dd>{m.avg_kcal}</dd></div>}
          {m.avg_water_ml !== null && <div><dt>{t("Average water")}</dt><dd>{(m.avg_water_ml / 1000).toFixed(1)} L</dd></div>}
          {m.avg_sleep_h !== null && <div><dt>{t("Average sleep")}</dt><dd>{m.avg_sleep_h} h</dd></div>}
          <div><dt>{t("Active minutes")}</dt><dd>{m.active_min}</dd></div>
          <div><dt>{t("Workouts")}</dt><dd>{m.workouts}</dd></div>
          {m.weight_end !== null && <div><dt>{t("Weight")}</dt><dd>{m.weight_start !== null && m.weight_start !== m.weight_end ? `${m.weight_start} → ${m.weight_end}` : m.weight_end} kg</dd></div>}
        </dl>
      </article>)}</div>}
  </section>;
}
