import { localeOf } from "@/lib/i18n/locales";
// Every area the person tracks, this week against last week, with one plain suggestion each (server: services/progress_areas.py).
import { locale, t, msg, number, date as formatDate } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Activity, BedDouble, Droplets, Dumbbell, FileHeart, Flame, MapPin, Scale, Sparkles, TrendingDown, TrendingUp, Minus, Utensils, type LucideIcon } from "lucide-react";
import Link from "@/lib/navigation";
import { useAccount } from "./account-session";
import { personalRequest } from "@/lib/personalization";

type Area = { id: AreaId; now: number | string | null; prev: number | string | null; of: number | null; higher_is_better: boolean | null;
  used: boolean; daily: number[]; extra?: Record<string, number | string | null> };
type AreaId = "food" | "water" | "sleep" | "activity" | "workouts" | "routes" | "habits" | "weight" | "report";
type Data = { today: string; areas: Area[] };

const META: Record<AreaId, { title: string; icon: LucideIcon; href: string; start: string }> = {
  food: { title: msg("Food"), icon: Utensils, href: "/nutrition", start: msg("Log a meal") },
  water: { title: msg("Water"), icon: Droplets, href: "/", start: msg("Log water") },
  sleep: { title: msg("Sleep"), icon: BedDouble, href: "/", start: msg("Log last night's sleep") },
  activity: { title: msg("Activity"), icon: Activity, href: "/weekly", start: msg("Log a workout") },
  workouts: { title: msg("Workouts"), icon: Dumbbell, href: "/workouts", start: msg("Start a camera workout") },
  routes: { title: msg("Routes"), icon: MapPin, href: "/activities", start: msg("Record a route") },
  habits: { title: msg("Daily tasks"), icon: Flame, href: "/", start: msg("See today's tasks") },
  weight: { title: msg("Weight"), icon: Scale, href: "/onboarding", start: msg("Add your weight") },
  report: { title: msg("Blood report"), icon: FileHeart, href: "/health", start: msg("Add a blood report") },
};

const num = (v: unknown) => typeof v === "number" ? v : Number(v ?? 0);
const fmt = (v: number, digits = 0) => number(Math.round(v * 10 ** digits) / 10 ** digits);
const day = (v: unknown) => { try { return formatDate(String(v) + "T12:00:00", { day: "numeric", month: "short" }); } catch { return String(v); } };

/** The big figure for this week. */
function headline(a: Area): string {
  const x = a.extra || {};
  switch (a.id) {
    case "food": return t("{n} of 7 days logged", { n: num(a.now) });
    case "water": return t("Goal reached {n} of 7 days", { n: num(a.now) });
    case "sleep": return a.now == null ? t("No nights logged") : t("{n} h a night", { n: fmt(num(a.now), 1) });
    case "activity": return t("{n} active minutes", { n: fmt(num(a.now)) });
    case "workouts": return t("{n} workouts", { n: num(a.now) });
    case "routes": return t("{n} km", { n: fmt(num(a.now), 1) });
    case "habits": return t("{n} of 7 days with a task done", { n: num(a.now) });
    case "weight": return a.now == null ? t("No weight yet") : t("{n} kg", { n: fmt(num(a.now), 1) });
    case "report": return a.now ? t("Report from {date}", { date: day(a.now) }) : t("No report yet");
  }
  return "";
}

/** A second line with the detail behind the figure. */
function detail(a: Area): string {
  const x = a.extra || {};
  switch (a.id) {
    case "food": return t("On your calorie target {n} days · protein reached {m} days", { n: num(x.on_target_now), m: num(x.protein_days_now) });
    case "water": return t("About {ml} ml a day", { ml: fmt(num(x.avg_ml_now)) });
    case "sleep": return t("{n} of {m} logged nights had 7–9 hours", { n: num(x.in_range_now), m: num(x.nights_now) });
    case "activity": return t("WHO goal: 150 minutes a week");
    case "workouts": return t("{n} with the camera", { n: num(x.camera_now) });
    case "routes": return t("{n} routes recorded", { n: num(x.count_now) });
    case "habits": return t("One missed day a week is forgiven");
    case "weight": return a.prev == null ? t("Weigh in again next week to see your trend") : t("{diff} kg since {date}", { diff: (num(a.now) - num(a.prev) > 0 ? "+" : "") + fmt(num(a.now) - num(a.prev), 1), date: day(x.since) });
    case "report": return t("{n} days ago", { n: num(x.days_since) });
  }
  return "";
}

/** better / worse / same / new, against last week. */
function change(a: Area): "better" | "worse" | "same" | "new" | "neutral" | null {
  if (a.id === "report" || a.now == null) return null;
  if (a.prev == null || (num(a.prev) === 0 && num(a.now) > 0 && a.id !== "weight")) return a.prev == null && a.id === "weight" ? null : "new";
  const d = num(a.now) - num(a.prev);
  if (Math.abs(d) < (a.id === "sleep" || a.id === "weight" ? 0.2 : 0.5)) return "same";
  if (a.id === "sleep") return Math.abs(num(a.now) - 8) < Math.abs(num(a.prev) - 8) ? "better" : "worse";   // closer to 7–9 hours is better
  if (a.higher_is_better == null) return "neutral";
  return (d > 0) === a.higher_is_better ? "better" : "worse";
}

function changeText(a: Area, c: ReturnType<typeof change>) {
  const prev = a.id === "sleep" || a.id === "weight" || a.id === "routes" ? fmt(num(a.prev), 1) : fmt(num(a.prev));
  if (c === "new") return t("New this week");
  if (c === "same") return t("Same as last week");
  return num(a.now) > num(a.prev) ? t("Up from {n} last week", { n: prev }) : t("Down from {n} last week", { n: prev });
}

/** One plain next step for the area, from this week's numbers. */
function suggestion(a: Area): string {
  const x = a.extra || {}, now = num(a.now);
  switch (a.id) {
    case "food": return now < 4 ? t("Log at least one meal a day. It makes your targets accurate.")
      : num(x.on_target_now) < 3 ? t("Aim for two more days close to your calorie target.")
      : num(x.protein_days_now) < 4 ? t("Add a protein food, like dal, eggs or paneer, to one meal a day.") : t("Great consistency. Keep the same rhythm.");
    case "water": return now < 4 ? t("Keep a bottle in sight and drink a glass with each meal.") : t("You're reaching your water goal. Keep it up.");
    case "sleep": return a.now == null ? t("Log your sleep for a few nights to see your pattern.")
      : now < 7 ? t("Try a fixed bedtime and no screens in the last half hour.") : t("Your sleep is in the healthy range.");
    case "activity": return now < 150 ? t("{n} more minutes reach the WHO weekly goal: about {walks} short walks.", { n: fmt(150 - now), walks: Math.ceil((150 - now) / 20) })
      : t("You've met the WHO weekly goal. A rest day helps you recover.");
    case "workouts": return now === 0 ? t("Try a 10-minute camera workout. It counts your reps for you.")
      : num(x.camera_now) === 0 ? t("Try a camera workout to get feedback on your posture.") : t("Nice work. Plan a rest day so your body can recover.");
    case "routes": return now === 0 ? t("Record a walk or ride to see your distance and pace.") : t("Try a slightly longer route this week.");
    case "habits": return now < 4 ? t("Finish one of Today's three tasks each day.") : t("Your daily habit is strong. Keep going.");
    case "weight": return num(x.readings) < 2 ? t("Weigh yourself once a week, at the same time of day.") : t("Weekly weighing shows the trend; daily changes are mostly water.");
    case "report": return !a.now ? t("Add a blood report for advice built on your own numbers.")
      : num(x.days_since) > 90 ? t("It's been a while. A recheck shows how far your changes have moved your numbers.") : t("Your plan uses this report.");
  }
  return "";
}

/** The last seven days as slim bars: the value above each active day, the weekday below, today highlighted. Empty days
 *  keep a short stub so the week reads as a week, not as one big block. */
function Spark({ values, id }: { values: number[]; id: AreaId }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values), lang = localeOf(locale()).format;
  const day = new Intl.DateTimeFormat(lang, { weekday: "narrow" }), short = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
  return <div className="pa-spark pa-week" aria-hidden="true">{values.map((v, i) => {
    const date = new Date(); date.setDate(date.getDate() - (values.length - 1 - i));
    return <div key={i} className={`pa-col${i === values.length - 1 ? " today" : ""}`}>
      <small className="pa-num">{v > 0 ? short.format(v) : ""}</small>
      <div className="pa-barbox"><i data-area={id} className={v > 0 ? "on" : ""} style={{ height: v > 0 ? `${Math.max(14, Math.round(v / max * 100))}%` : undefined }} /></div>
      <small className="pa-day">{day.format(date)}</small></div>; })}</div>;
}

export function ProgressAreas() {
  const { user, ready } = useAccount();
  const [data, setData] = useState<Data | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => { if (!user) return; let live = true;
    personalRequest<Data>("progress").then(d => { if (live) { setData(d); setFailed(false); } }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; }; }, [user]);
  if (!ready) return null;
  if (!user) return <section className="pa-hub pa-guest"><h2>{t("Your progress in every area")}</h2><p>{t("Sign in to see food, water, sleep, workouts and more compared week by week.")}</p><Link className="account-primary" href="/login">{t("Sign in")}</Link></section>;
  if (failed) return <section className="pa-hub"><p role="alert">{t("Progress could not load. Your records are safe; try again in a moment.")}</p></section>;
  if (!data) return <section className="pa-hub" aria-busy="true"><p>{t("Loading your progress…")}</p></section>;
  const used = data.areas.filter(a => a.used), unused = data.areas.filter(a => !a.used);
  const improved = used.filter(a => change(a) === "better" || change(a) === "new");
  const focus = used.find(a => change(a) === "worse") ?? used.find(a => ["food", "water", "activity", "habits"].includes(a.id) && num(a.now) < (a.of ? a.of / 2 : 1)) ?? unused[0];
  return <section className="pa-hub" aria-labelledby="pa-title">
    <header className="pa-head"><div><span className="eyebrow">{t("THIS WEEK VS LAST WEEK")}</span><h2 id="pa-title">{t("Your progress in every area")}</h2></div></header>
    <div className="pa-highlights">
      <div className="pa-highlight pa-good"><TrendingUp aria-hidden="true" size={22} /><div><strong>{improved.length ? t("{n} areas improved", { n: improved.length }) : t("Your first week starts now")}</strong>
        <p>{improved.length ? improved.map(a => t(META[a.id].title)).join(" · ") : t("Log anything this week and we'll compare it with next week.")}</p></div></div>
      {focus && <Link className="pa-highlight pa-focus" href={META[focus.id].href}><Sparkles aria-hidden="true" size={22} /><div><strong>{t("Focus next: {area}", { area: t(META[focus.id].title) })}</strong><p>{suggestion(focus)}</p></div></Link>}
    </div>
    {used.length > 0 && <div className="pa-grid">{used.map(a => { const M = META[a.id], c = change(a), Icon = M.icon;
      return <article key={a.id} className="pa-card" data-area={a.id}>
        <header><span className="pa-icon" aria-hidden="true"><Icon size={20} strokeWidth={2.2} /></span><h3>{t(M.title)}</h3>
          {c && c !== "neutral" && <span className={`pa-chip pa-${c}`}>{c === "better" ? <TrendingUp size={14} aria-hidden="true" /> : c === "worse" ? <TrendingDown size={14} aria-hidden="true" /> : c === "new" ? <Sparkles size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}{changeText(a, c)}</span>}</header>
        <p className="pa-value">{headline(a)}</p><p className="pa-detail">{detail(a)}</p>
        <Spark values={a.daily} id={a.id} />
        <p className="pa-tip">{suggestion(a)}</p>
        <Link className="pa-link" href={M.href}>{t(M.title)} →</Link>
      </article>; })}</div>}
    {unused.length > 0 && <div className="pa-start"><h3>{t("Start tracking")}</h3><div>{unused.map(a => { const M = META[a.id], Icon = M.icon;
      return <Link key={a.id} href={M.href} className="pa-start-item" data-area={a.id}><span className="pa-icon" aria-hidden="true"><Icon size={18} /></span><span><strong>{t(M.title)}</strong><small>{t(M.start)}</small></span></Link>; })}</div></div>}
  </section>;
}

/** Today's small version: how many areas improved, the one to focus on next, and a link to the full page. */
export function ProgressSummary() {
  const { user } = useAccount();
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { if (!user) return; let live = true;
    personalRequest<Data>("progress").then(d => { if (live) setData(d); }).catch(() => {});
    return () => { live = false; }; }, [user]);
  if (!user || !data) return null;
  const used = data.areas.filter(a => a.used);
  if (!used.length) return null;
  const improved = used.filter(a => change(a) === "better" || change(a) === "new");
  const focus = used.find(a => change(a) === "worse") ?? data.areas.find(a => !a.used);
  return <Link href="/progress" className="pa-summary" aria-label={t("See progress")}>
    <div className="pa-summary-icons" aria-hidden="true">{used.slice(0, 5).map(a => { const Icon = META[a.id].icon, c = change(a);
      return <span key={a.id} className="pa-icon" data-area={a.id} data-change={c ?? ""}><Icon size={16} />{c === "better" || c === "new" ? <i>▲</i> : c === "worse" ? <i>▼</i> : null}</span>; })}</div>
    <div><strong>{improved.length ? t("{n} areas improved", { n: improved.length }) : t("Your first week starts now")}</strong>
      {focus && <small>{t("Focus next: {area}", { area: t(META[focus.id].title) })}</small>}</div>
    <span className="pa-summary-go">{t("See progress")} →</span>
  </Link>;
}
