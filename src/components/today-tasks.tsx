// Today: three tasks chosen from the person's own data, the streak they build, and the Health Score (backend/services/daily_tasks.py).
import { useCallback, useEffect, useState } from "react";
import { Check, Flame, Sparkles } from "lucide-react";
import { Link } from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";

type Task = { id: string; title: string; why: string; done: boolean; tick: boolean; href: string | null };
type Part = { id: string; name: string; score: number; detail: string; source: string; weight: number };
type Today = { today: string; tasks: Task[]; done: number; streak: { current: number; best: number; protected_days: string[]; rule: string };
  health: { score: number | null; parts: Part[]; focus: { id: string; name: string; tip: string } | null; note: string } };

const PART_COLOR: Record<string, string> = { activity: "#7c3aed", sleep: "#2563eb", nutrition: "#ea580c", water: "#0891b2", steadiness: "#0d9488" };
const EVENTS = ["trackcal-wellness", "trackcal-diary", "trackcal-workouts", "trackcal-personalization", "trackcal-storage"];

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/personalization/" + path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not load today's tasks.");
  return data as T;
}

function Ring({ score }: { score: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return <svg className="health-ring" viewBox="0 0 84 84" role="img" aria-label={`Health Score ${score} out of 100`}>
    <defs><linearGradient id="hs-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0d9488" /><stop offset=".55" stopColor="#7c3aed" /><stop offset="1" stopColor="#db2777" /></linearGradient></defs>
    <circle cx="42" cy="42" r={r} className="health-ring-track" />
    <circle cx="42" cy="42" r={r} className="health-ring-value" stroke="url(#hs-grad)" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
    <text x="42" y="47" textAnchor="middle" className="health-ring-text">{score}</text>
  </svg>;
}

export function TodayTasks() {
  const { user } = useAccount(), scope = useWorkspaceScope(), signedIn = !!user && scope !== "guest";
  const [data, setData] = useState<Today | null>(null), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const load = useCallback(() => { if (signedIn) call<Today>("today").then(d => { setData(d); setError(""); }).catch(e => setError(e.message)); }, [signedIn]);
  useEffect(() => {
    load();
    let timer = 0;
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(load, 900); };   // after logging water, a meal or a workout
    EVENTS.forEach(e => window.addEventListener(e, soon)); window.addEventListener("focus", soon);
    return () => { EVENTS.forEach(e => window.removeEventListener(e, soon)); window.removeEventListener("focus", soon); window.clearTimeout(timer); };
  }, [load, scope]);
  if (!signedIn || (!data && !error)) return null;
  if (!data) return <p className="account-error" role="alert">{error}</p>;
  const tick = async (t: Task) => { setBusy(t.id); try { setData(await call<Today>("task-done", { task: t.id, done: !t.done })); } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(""); } };
  const h = data.health;
  return <section className="ds-card today-tasks" aria-labelledby="today-tasks-title">
    <div className="today-tasks-head">
      <div><h2 id="today-tasks-title">Today's 3 tasks</h2><p className="ds-sub">{data.done === 3 ? "All done. Lovely work." : `${data.done} of 3 done`}</p></div>
      <div className="streak-pill" title={data.streak.rule}><Flame size={18} aria-hidden="true" /><strong>{data.streak.current}</strong><span>day{data.streak.current === 1 ? "" : "s"}</span></div>
    </div>
    <ol className="task-list">{data.tasks.map(t => <li key={t.id} className="task-row" data-done={t.done || undefined}>
      {t.tick
        ? <button type="button" className="task-check" aria-pressed={t.done} disabled={busy === t.id} onClick={() => void tick(t)} aria-label={`${t.done ? "Untick" : "Tick"}: ${t.title}`}><Check size={18} aria-hidden="true" /></button>
        : <span className="task-check" aria-hidden="true"><Check size={18} /></span>}
      <div className="task-text"><strong>{t.title}</strong><small>{t.why}</small></div>
      {t.href && !t.done && <Link href={t.href} className="task-go">Go</Link>}
      <span className="sr-only">{t.done ? "Done" : "Not done yet"}</span>
    </li>)}</ol>
    <p className="ds-sub streak-rule">Streak: {data.streak.rule} Best: {data.streak.best} days.</p>
    <div className="health-score">
      {h.score === null ? <p className="ds-sub"><Sparkles size={16} aria-hidden="true" /> {h.note}</p> : <>
        <div className="health-score-main"><Ring score={h.score} /><div><h3>Health Score</h3><p className="ds-sub">{h.note}</p>
          {h.focus && <p className="health-focus"><strong>Work on {h.focus.name.toLowerCase()} next:</strong> {h.focus.tip}</p>}</div></div>
        <ul className="health-parts">{h.parts.map(p => <li key={p.id} style={{ ["--part" as string]: PART_COLOR[p.id] }}>
          <span className="health-part-name">{p.name}</span><span className="health-part-bar" aria-hidden="true"><i style={{ width: `${p.score}%` }} /></span>
          <span className="health-part-score">{p.score}</span><small>{p.detail}</small></li>)}</ul>
        <details className="health-sources"><summary>How it's worked out</summary><ul>{h.parts.map(p => <li key={p.id}><strong>{p.name}</strong> ({p.weight}%): {p.source}</li>)}</ul>
          <p>Parts with no data this week are left out, so not logging something never counts against you.</p></details>
      </>}
    </div>
  </section>;
}
