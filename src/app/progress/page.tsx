import { useSyncExternalStore } from "react";
import Link from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { exportLocalEntries, useLocalDate } from "@/lib/use-local-state";
import type { MealLog } from "@/components/journal-tools";
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
  return <main className="account-page progress-page"><header className="account-header"><Link className="brand" href="/">trackcal.</Link><Link href="/">← Back to workspace</Link></header><div className="account-title"><p className="eyebrow">A LITTLE PERSPECTIVE</p><h1>See how far you’ve come.</h1><p>Last 30 days with logged meals · {today || "Today"}</p></div>{!ready ? <p>Loading your workspace…</p> : <><div className="report-actions"><Link className="account-secondary" href="/play">View XP, streaks & badges →</Link></div><div className="report-actions"><p>Based on this account’s local journal. Restore a cloud backup first to include another device’s history.</p><button className="account-primary" onClick={() => window.print()}>Print / Save as PDF</button></div><div className="progress-stats"><div><strong>{days.length}</strong><span>Days with entries</span></div><div><strong>{totalMeals}</strong><span>Meals logged</span></div><div><strong>{average}</strong><span>Average kcal / logged day</span></div></div><section className="account-card"><h2>Your daily rhythm</h2>{!days.length ? <p>No meals logged yet. <Link href="/">Open your workspace</Link> to add your first meal.</p> : <><div className="progress-bars" aria-label="Calories by journal date">{days.map(day => <div key={day.date} className="progress-column"><span>{Math.round(day.calories)}</span><div style={{ height: `${Math.max(2, day.calories / maximum * 160)}px` }} /><small>{day.date.slice(5)}</small></div>)}</div><div className="report-table-wrap"><table className="report-table"><caption>Nutrition totals from your journal entries</caption><thead><tr><th>Date</th><th>Meals</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead><tbody>{days.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.meals}</td><td>{Math.round(day.calories)} kcal</td><td>{day.protein.toFixed(1)} g</td><td>{day.carbs.toFixed(1)} g</td><td>{day.fat.toFixed(1)} g</td></tr>)}</tbody></table></div></>}<p className="account-fine">Days without entries are excluded from the average. Logged intake may be incomplete. AI nutrition values are estimates.</p></section></>}</main>;
}
