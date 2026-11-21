import { t } from "@/lib/i18n";
import { useSyncExternalStore } from "react";
import Link from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { exportLocalEntries, useLocalDate } from "@/lib/use-local-state";
import type { MealLog } from "@/components/journal-tools";
import { ProgressAreas } from "@/components/progress-areas";
import { WeeklyReview } from "@/components/weekly-review";
import { ProgressInsights } from "@/components/progress-insights";
import { HistoryPanel } from "@/components/history-panel";
const subscribe = (notify: () => void) => { window.addEventListener("storage", notify); window.addEventListener("trackcal-storage", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("trackcal-storage", notify); }; };
export default function ProgressPage() {
  const scope = useWorkspaceScope(), { ready } = useAccount(), today = useLocalDate();
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(exportLocalEntries(scope)), () => "{}");
  const entries = JSON.parse(raw);
  const days = Object.entries(entries).filter(([key]) => /^trackcal:journal:\d{4}-\d{2}-\d{2}$/.test(key)).map(([key, value]) => {
    const meals = value as MealLog[];
    return { date: key.slice(-10), meals: meals.length, calories: meals.reduce((sum, meal) => sum + meal.calories, 0), protein: meals.reduce((sum, meal) => sum + meal.protein, 0), carbs: meals.reduce((sum, meal) => sum + meal.carbs, 0), fat: meals.reduce((sum, meal) => sum + meal.fat, 0) };
  }).filter(day => day.meals > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const maximum = Math.max(1, ...days.map(day => day.calories));
  const totalMeals = days.reduce((sum, day) => sum + day.meals, 0);
  const average = days.length ? Math.round(days.reduce((sum, day) => sum + day.calories, 0) / days.length) : 0;
  return <main className="account-page progress-page"><div className="account-title"><p className="eyebrow">{t("A LITTLE PERSPECTIVE")}</p><h1>{t("See how far you’ve come.")}</h1><p>{t("Last 30 days with logged meals · {day}", { day: today || t("Today") })}</p></div><ProgressAreas/><WeeklyReview/><ProgressInsights/>{!ready ? <p>{t("Loading your workspace…")}</p> : <><div className="report-actions"><Link className="account-secondary" href="/play">{t("View XP, streaks & badges →")}</Link></div><div className="report-actions"><p>{t("Based on this account’s local journal. Restore a cloud backup first to include another device’s history.")}</p><button className="account-primary" onClick={() => window.print()}>{t("Print / Save as PDF")}</button></div><div className="progress-stats"><div><strong>{days.length}</strong><span>{t("Days with entries")}</span></div><div><strong>{totalMeals}</strong><span>{t("Meals logged")}</span></div><div><strong>{average}</strong><span>{t("Average kcal / logged day")}</span></div></div><section className="account-card"><h2>{t("Your daily rhythm")}</h2>{!days.length ? <p>{t("No meals logged yet.")}{" "}<Link href="/">{t("Open your workspace")}</Link> {t("to add your first meal.")}</p> : <><div className="progress-bars" aria-label={t("Calories by journal date")}>{days.map(day => <div key={day.date} className="progress-column"><span>{Math.round(day.calories)}</span><div style={{ height: `${Math.max(2, day.calories / maximum * 160)}px` }} /><small>{day.date.slice(5)}</small></div>)}</div><div className="report-table-wrap"><table className="report-table"><caption>{t("Nutrition totals from your journal entries")}</caption><thead><tr><th>{t("Date")}</th><th>{t("Meals")}</th><th>{t("Calories")}</th><th>{t("Protein")}</th><th>{t("Carbs")}</th><th>{t("Fat")}</th></tr></thead><tbody>{days.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.meals}</td><td>{t("{n} kcal", { n: Math.round(day.calories) })}</td><td>{day.protein.toFixed(1)} g</td><td>{day.carbs.toFixed(1)} g</td><td>{day.fat.toFixed(1)} g</td></tr>)}</tbody></table></div></>}<p className="account-fine">{t("Days without entries are excluded from the average. Logged intake may be incomplete. AI nutrition values are estimates.")}</p></section></>}<HistoryPanel/></main>;
}
