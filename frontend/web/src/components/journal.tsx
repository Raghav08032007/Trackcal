import { t, msg, number, date as formatDate } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/lib/navigation";
import { CalendarDays, Check, Dumbbell, Flame, Footprints, Plus, Trophy, Utensils, X } from "lucide-react";
import { useAccount } from "./account-session";
import { useLocalDate } from "@/lib/use-local-state";
import { wellnessRequest } from "@/lib/wellness";
import { addWorkout } from "@/lib/workouts";

type Day = { day: string; workouts: number; minutes: number; reps: number; km: number; meals: number; kcal: number; protein: number; kinds: string[] };
type Best = { period: string; value: number } | null;
type Plan = { id: string; day: string; name: string; minutes: number; sets: number; reps: number; load: number; notes: string; done: boolean };
type Journal = { from: string; to: string; days: Day[]; totals: Record<string, number>; best: { workouts: Record<"day" | "month" | "year", Best>; food: Record<"day" | "month" | "year", Best> };
  plans: Plan[]; history_from?: string | null };
type Range = "today" | "week" | "month" | "two" | "year" | "custom";

const RANGES: [Range, string][] = [["today", msg("Today")], ["week", msg("7 days")], ["month", msg("Month")], ["two", msg("2 months")], ["year", msg("Year")], ["custom", msg("Choose dates")]];
const SOURCES = [msg("Gym"), msg("Class"), msg("Sport"), msg("Another app"), msg("Home workout"), msg("Other")];
const KIND_LABEL: Record<string, string> = { camera: msg("Camera"), gym: msg("Session"), manual: msg("Logged"), route: msg("GPS route") };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const noon = (day: string) => new Date(day + "T12:00:00");
function shift(day: string, days: number) { const d = noon(day); d.setDate(d.getDate() + days); return iso(d); }
/** The first day of a range ending today. */
function startOf(range: Range, today: string) {
  const d = noon(today);
  if (range === "today") return today;
  if (range === "week") return shift(today, -6);
  if (range === "month") return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  if (range === "two") return iso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  return iso(new Date(d.getFullYear(), 0, 1));
}
function every(from: string, to: string) { const out: string[] = []; for (let d = from; d <= to && out.length < 400; d = shift(d, 1)) out.push(d); return out; }
function bestLabel(b: Best, kind: "day" | "month" | "year") {
  if (!b) return "—";
  if (kind === "day") return formatDate(noon(b.period), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (kind === "month") return formatDate(noon(b.period + "-15"), { month: "long", year: "numeric" });
  return b.period;
}

export function JournalPage() {
  const { user, ready } = useAccount();
  const today = useLocalDate();
  const [range, setRange] = useState<Range>("week");
  const [custom, setCustom] = useState<{ from: string; to: string }>(() => ({ from: shift(today, -29), to: today }));
  const [data, setData] = useState<Journal | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [form, setForm] = useState<"" | "done" | "plan">("");
  const from = range === "custom" ? custom.from : startOf(range, today), to = range === "custom" ? custom.to : today;

  const load = useCallback(async () => {
    try { setError(""); setData(await wellnessRequest<Journal>(`journal?start=${from}&end=${to}`)); }
    catch { setError(t("Your journal could not load. Your records are safe; try again in a moment.")); }
  }, [from, to]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const byDay = useMemo(() => new Map((data?.days ?? []).map(d => [d.day, d])), [data]);
  const strip = useMemo(() => data ? every(data.from, data.to) : [], [data]);
  const most = Math.max(1, ...(data?.days ?? []).map(d => d.minutes));
  const plans = (data?.plans ?? []).filter(p => !p.done).sort((a, b) => a.day.localeCompare(b.day));

  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true); setNotice("");
    try { await run(); setNotice(done); setForm(""); await load(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : t("That didn't save. Try again.")); }
    finally { setBusy(false); }
  }

  if (!ready) return null;
  if (!user) return <main className="account-page journal-page"><section className="account-card"><h1>{t("Your journal")}</h1>
    <p>{t("Sign in to see every workout and meal by day, month and year.")}</p><Link className="account-primary" href="/login">{t("Sign in")}</Link></section></main>;

  return <main className="account-page journal-page">
    <header className="journal-head"><div><span className="eyebrow">{t("WORKOUTS · FOOD · EVERY DAY")}</span><h1>{t("Your journal")}</h1>
      <p>{t("Camera workouts, routes and meals are added by themselves. Add anything else you did, at the gym or in another app, and plan the days ahead.")}</p></div>
      <div className="journal-actions"><button type="button" className="account-primary" onClick={() => setForm(form === "done" ? "" : "done")}><Plus size={18} aria-hidden="true" /> {t("Add a workout you did")}</button>
        <button type="button" className="account-secondary" onClick={() => setForm(form === "plan" ? "" : "plan")}><CalendarDays size={18} aria-hidden="true" /> {t("Plan a workout")}</button></div></header>

    {form && <EntryForm kind={form} today={today} busy={busy} onCancel={() => setForm("")}
      onSave={entry => act(() => form === "done"
        ? addWorkout({ day: entry.day, name: entry.name, minutes: entry.minutes, sets: entry.sets, reps: entry.reps, load: entry.load, source: entry.source })
        : wellnessRequest("plans", { day: entry.day, name: entry.name, minutes: entry.minutes, sets: entry.sets, reps: entry.reps, load: entry.load, notes: entry.notes }),
        form === "done" ? t("Workout added to {day}.", { day: formatDate(noon(entry.day)) }) : t("Planned for {day}.", { day: formatDate(noon(entry.day)) }))} />}

    <div className="journal-feedback" role="status">{notice}</div>{error && <p role="alert" className="journal-error">{error}</p>}

    <nav className="journal-ranges" aria-label={t("Period")}>{RANGES.map(([id, label]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{t(label)}</button>)}</nav>
    {range === "custom" && <div className="journal-custom"><label>{t("From")}<input type="date" value={custom.from} max={custom.to} onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} /></label>
      <label>{t("To")}<input type="date" value={custom.to} min={custom.from} max={today} onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} /></label></div>}

    {!data ? <p aria-busy="true">{t("Loading your journal…")}</p> : <>
      <p className="journal-period">{data.from === data.to ? formatDate(noon(data.from), { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : t("{from} to {to}", { from: formatDate(noon(data.from), { day: "numeric", month: "short", year: "numeric" }), to: formatDate(noon(data.to), { day: "numeric", month: "short", year: "numeric" }) })}</p>
      {data.history_from && data.from > from && <p className="journal-note">{t("Older days are part of Premium.")} <Link href="/premium">{t("See Premium")}</Link></p>}

      <section className="journal-totals" aria-label={t("Totals for this period")}>
        <Tile icon={<Dumbbell size={20} />} label={t("Workouts")} value={number(data.totals.workouts)} sub={t("{n} active days", { n: data.totals.active_days })} tone="violet" />
        <Tile icon={<Flame size={20} />} label={t("Active minutes")} value={number(data.totals.minutes)} sub={data.totals.reps ? t("{n} reps", { n: number(data.totals.reps) }) : ""} tone="orange" />
        <Tile icon={<Footprints size={20} />} label={t("Distance")} value={t("{km} km", { km: number(data.totals.km, { maximumFractionDigits: 1 }) })} sub="" tone="teal" />
        <Tile icon={<Utensils size={20} />} label={t("Meals logged")} value={number(data.totals.meals)} sub={t("{n} days logged", { n: data.totals.logged_days })} tone="pink" />
        <Tile icon={<Flame size={20} />} label={t("Calories eaten")} value={number(data.totals.kcal)} sub={data.totals.logged_days ? t("{n} a logged day", { n: number(Math.round(data.totals.kcal / data.totals.logged_days)) }) : ""} tone="amber" />
      </section>

      <section className="journal-bests" aria-labelledby="journal-best-title"><h2 id="journal-best-title"><Trophy size={20} aria-hidden="true" /> {t("Your best")}</h2>
        <div className="journal-best-grid">
          {(["day", "month", "year"] as const).map(k => <article key={"w" + k} className="journal-best" data-tone="workout"><span>{k === "day" ? t("Best workout day") : k === "month" ? t("Best workout month") : t("Best workout year")}</span>
            <strong>{bestLabel(data.best.workouts[k], k)}</strong><small>{data.best.workouts[k] ? t("{n} active minutes", { n: number(data.best.workouts[k]!.value) }) : t("No workouts yet")}</small></article>)}
          {(["day", "month", "year"] as const).map(k => <article key={"f" + k} className="journal-best" data-tone="food"><span>{k === "day" ? t("Best food-logging day") : k === "month" ? t("Best food-logging month") : t("Best food-logging year")}</span>
            <strong>{bestLabel(data.best.food[k], k)}</strong><small>{data.best.food[k] ? (k === "day" ? t("{n} meals logged", { n: data.best.food[k]!.value }) : t("{n} days logged", { n: data.best.food[k]!.value })) : t("No meals yet")}</small></article>)}
        </div></section>

      {strip.length > 1 && <section className="journal-strip-wrap" aria-label={t("Every day in this period")}><div className="journal-strip" style={{ gridTemplateColumns: `repeat(${Math.min(strip.length, strip.length > 62 ? 53 : 31)}, minmax(0, 1fr))` }}>
        {strip.map(day => { const d = byDay.get(day), level = d?.minutes ? Math.min(4, Math.ceil(d.minutes / most * 4)) : 0;
          return <span key={day} data-level={level} data-food={d?.meals ? "1" : "0"} title={`${formatDate(noon(day), { weekday: "short", day: "numeric", month: "short" })}: ${t("{n} min", { n: d?.minutes ?? 0 })} · ${t("{n} meals", { n: d?.meals ?? 0 })}`} />; })}
      </div><p className="journal-legend"><span data-level="0" /> {t("Rest")} <span data-level="2" /> {t("Active")} <span data-level="4" /> {t("Most active")} <span className="dot" /> {t("Food logged")}</p></section>}

      {plans.length > 0 && <section className="journal-plans" aria-labelledby="journal-plans-title"><h2 id="journal-plans-title"><CalendarDays size={20} aria-hidden="true" /> {t("Planned")}</h2>
        {plans.map(p => <article key={p.id} className="journal-plan"><time dateTime={p.day}>{formatDate(noon(p.day), { weekday: "short", day: "numeric", month: "short" })}</time>
          <div><strong>{p.name}</strong><small>{[p.minutes ? t("{n} min", { n: p.minutes }) : "", p.sets && p.reps ? `${p.sets} × ${p.reps}` : "", p.load ? t("{n} kg", { n: p.load }) : "", p.notes].filter(Boolean).join(" · ")}</small></div>
          {p.day <= today && <button type="button" disabled={busy} onClick={() => act(() => wellnessRequest(`plans/${p.id}/done`, {}), t("{name} saved as done.", { name: p.name }))}><Check size={16} aria-hidden="true" /> {t("Mark done")}</button>}
          <button type="button" className="journal-icon" disabled={busy} aria-label={t("Remove plan {name}", { name: p.name })} onClick={() => act(() => wellnessRequest(`plans/${p.id}`, undefined, "DELETE"), t("Plan removed."))}><X size={16} aria-hidden="true" /></button>
        </article>)}</section>}

      <section className="journal-days" aria-labelledby="journal-days-title"><h2 id="journal-days-title">{t("Day by day")}</h2>
        {data.days.length === 0 ? <p className="journal-empty">{t("Nothing logged in this period yet. Do a camera workout, record a route, log a meal, or add a workout you did.")}</p>
          : [...data.days].reverse().map(d => <article key={d.day} className="journal-day">
            <time dateTime={d.day}><b>{formatDate(noon(d.day), { day: "numeric" })}</b><span>{formatDate(noon(d.day), { weekday: "short", month: "short" })}</span></time>
            <div className="journal-day-body">
              {d.workouts > 0 && <p><Dumbbell size={16} aria-hidden="true" /> <strong>{t("{n} workouts", { n: d.workouts })}</strong> · {t("{n} min", { n: d.minutes })}{d.reps ? " · " + t("{n} reps", { n: d.reps }) : ""}{d.km ? " · " + t("{km} km", { km: number(d.km, { maximumFractionDigits: 1 }) }) : ""}
                <span className="journal-kinds">{d.kinds.map(k => <em key={k} data-kind={k}>{t(KIND_LABEL[k] ?? k)}</em>)}</span></p>}
              {d.meals > 0 && <p><Utensils size={16} aria-hidden="true" /> <strong>{t("{n} meals", { n: d.meals })}</strong> · {t("{n} kcal", { n: number(d.kcal) })} · {t("{n} g protein", { n: number(d.protein) })}</p>}
            </div></article>)}
        <p className="journal-links"><Link href="/workouts">{t("Every workout in detail →")}</Link> <Link href="/nutrition">{t("Today's food diary →")}</Link></p>
      </section>
    </>}
  </main>;
}

function Tile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: string }) {
  return <article className="journal-tile" data-tone={tone}><span className="journal-tile-icon" aria-hidden="true">{icon}</span><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</article>;
}

type EntryDraft = { day: string; name: string; minutes: number; sets: number; reps: number; load: number; source: string; notes: string };
function EntryForm({ kind, today, busy, onSave, onCancel }: { kind: "done" | "plan"; today: string; busy: boolean; onSave: (e: EntryDraft) => void; onCancel: () => void }) {
  const [e, setE] = useState<EntryDraft>({ day: kind === "plan" ? shift(today, 1) : today, name: "", minutes: 45, sets: 0, reps: 0, load: 0, source: SOURCES[0], notes: "" });
  const num = (key: keyof EntryDraft, max: number) => (ev: React.ChangeEvent<HTMLInputElement>) => setE(x => ({ ...x, [key]: Math.max(0, Math.min(max, Number(ev.target.value) || 0)) }));
  return <form className="journal-form account-card" onSubmit={ev => { ev.preventDefault(); if (e.name.trim()) onSave({ ...e, name: e.name.trim() }); }}>
    <h2>{kind === "done" ? t("Add a workout you did") : t("Plan a workout")}</h2>
    <p>{kind === "done" ? t("For workouts the app didn't see: the gym, a class, a match, or one tracked in another app.") : t("Pick a day and what you'll do. It shows in your journal until you mark it done.")}</p>
    <div className="journal-form-grid">
      <label>{t("Day")}<input type="date" required value={e.day} min={kind === "plan" ? today : undefined} max={kind === "done" ? today : shift(today, 365)} onChange={ev => ev.target.value && setE(x => ({ ...x, day: ev.target.value }))} /></label>
      <label className="wide">{t("Workout")}<input required maxLength={120} value={e.name} placeholder={t("Leg day, swim, yoga…")} onChange={ev => setE(x => ({ ...x, name: ev.target.value }))} /></label>
      {kind === "done" && <label>{t("Where")}<select value={e.source} onChange={ev => setE(x => ({ ...x, source: ev.target.value }))}>{SOURCES.map(s => <option key={s} value={s}>{t(s)}</option>)}</select></label>}
      <label>{t("Minutes")}<input type="number" min={0} max={1440} value={e.minutes} onChange={num("minutes", 1440)} /></label>
      <label>{t("Sets")}<input type="number" min={0} max={100} value={e.sets} onChange={num("sets", 100)} /></label>
      <label>{t("Reps per set")}<input type="number" min={0} max={1000} value={e.reps} onChange={num("reps", 1000)} /></label>
      <label>{t("Load (kg)")}<input type="number" min={0} max={1000} step={0.5} value={e.load} onChange={num("load", 1000)} /></label>
      {kind === "plan" && <label className="wide">{t("Notes")}<input maxLength={300} value={e.notes} onChange={ev => setE(x => ({ ...x, notes: ev.target.value }))} /></label>}
    </div>
    <div className="account-actions"><button className="account-primary" disabled={busy || !e.name.trim()}>{kind === "done" ? t("Save workout") : t("Save plan")}</button><button type="button" onClick={onCancel}>{t("Cancel")}</button></div>
  </form>;
}
