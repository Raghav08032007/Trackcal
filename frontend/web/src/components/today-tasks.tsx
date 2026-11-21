// Today: three tasks chosen from the person's own data, the streak they build, and the Health Score (backend/services/daily_tasks.py).
import { t } from "@/lib/i18n";
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
  if (!response.ok) throw new Error(data.error || t("Could not load today's tasks."));
  return data as T;
}

function Ring({ score }: { score: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return <svg className="health-ring" viewBox="0 0 84 84" role="img" aria-label={t("Health Score {score} out of 100", { score })}>
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
  if (!signedIn) return null;
  // While loading, hold the card's place with the same rows, so nothing below jumps when it arrives (Phase I: layout shift).
  if (!data && !error) return <section className="ds-card today-tasks today-tasks-loading" aria-busy="true" aria-label={t("Loading today's tasks")}>
    <div className="today-tasks-head"><div><h2>{t("Today's 3 tasks")}</h2><p className="ds-sub">&nbsp;</p></div></div>
    <ol className="task-list" aria-hidden="true">{[0, 1, 2].map(i => <li key={i} className="task-row"><span className="task-check" /><div className="task-text"><strong className="skeleton-line">&nbsp;</strong><small className="skeleton-line short">&nbsp;</small></div></li>)}</ol>
    <p className="ds-sub streak-rule">&nbsp;</p><div className="health-score skeleton-block" aria-hidden="true" />
  </section>;
  if (!data) return <p className="account-error" role="alert">{error}</p>;
  const tick = async (task: Task) => { setBusy(task.id); try { setData(await call<Today>("task-done", { task: task.id, done: !task.done })); } catch (e) { setError(e instanceof Error ? e.message : t("Could not save.")); } finally { setBusy(""); } };
  const h = data.health;
  return <section className="ds-card today-tasks" aria-labelledby="today-tasks-title">
    <div className="today-tasks-head">
      <div><h2 id="today-tasks-title">{t("Today's 3 tasks")}</h2><p className="ds-sub">{data.done === 3 ? t("All done. Lovely work.") : t("{done} of 3 done", { done: data.done })}</p></div>
      <div className="streak-pill" title={data.streak.rule}><Flame size={18} aria-hidden="true" /><strong>{data.streak.current}</strong><span>{data.streak.current === 1 ? t("day") : t("days")}</span></div>
    </div>
    <ol className="task-list">{data.tasks.map(task => <li key={task.id} className="task-row" data-done={task.done || undefined}>
      {task.tick
        ? <button type="button" className="task-check" aria-pressed={task.done} disabled={busy === task.id} onClick={() => void tick(task)} aria-label={task.done ? t("Untick: {task}", { task: task.title }) : t("Tick: {task}", { task: task.title })}><Check size={18} aria-hidden="true" /></button>
        : <span className="task-check" aria-hidden="true"><Check size={18} /></span>}
      <div className="task-text"><strong>{task.title}</strong><small>{task.why}</small></div>
      {task.href && !task.done && <Link href={task.href} className="task-go">{t("Go")}</Link>}
      <span className="sr-only">{task.done ? t("Done") : t("Not done yet")}</span>
    </li>)}</ol>
    <p className="ds-sub streak-rule">{t("Streak: {rule} Best: {count} days.", { rule: data.streak.rule, count: data.streak.best })}</p>
    <div className="health-score">
      {h.score === null ? <p className="ds-sub"><Sparkles size={16} aria-hidden="true" /> {h.note}</p> : <>
        <div className="health-score-main"><Ring score={h.score} /><div><h3>{t("Health Score")}</h3><p className="ds-sub">{h.note}</p>
          {h.focus && <p className="health-focus"><strong>{t("Work on {area} next:", { area: t(h.focus.name).toLowerCase() })}</strong> {h.focus.tip}</p>}</div></div>
        <ul className="health-parts">{h.parts.map(p => <li key={p.id} style={{ ["--part" as string]: PART_COLOR[p.id] }}>
          <span className="health-part-name">{t(p.name)}</span><span className="health-part-bar" aria-hidden="true"><i style={{ width: `${p.score}%` }} /></span>
          <span className="health-part-score">{p.score}</span><small>{p.detail}</small></li>)}</ul>
        <details className="health-sources"><summary>{t("How it's worked out")}</summary><ul>{h.parts.map(p => <li key={p.id}><strong>{t(p.name)}</strong> ({p.weight}%): {p.source}</li>)}</ul>
          <p>{t("Parts with no data this week are left out, so not logging something never counts against you.")}</p></details>
      </>}
    </div>
  </section>;
}
