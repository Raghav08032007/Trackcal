// A section's overview: a short look at today, the one or two things people do most, then every destination in clear groups.
import { t } from "@/lib/i18n";
import { ArrowRight } from "lucide-react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { useDiaryMeals } from "@/lib/diary";
import { useBurn } from "@/lib/days";
import { useTarget } from "@/lib/targets";
import { useLocalDate } from "@/lib/use-local-state";
import { useActiveDays } from "@/lib/workouts";
import { earnedBack } from "@/lib/workout-coach";
import { SECTIONS, type Section } from "@/lib/sections";

type Stat = { label: string; value: string; detail?: string };
type Summary = { stats: Stat[]; actions: [string, string][] };

function useFoodSummary(): Summary {
  const date = useLocalDate(), [meals] = useDiaryMeals(date), [calories] = useTarget("calories"), [protein] = useTarget("protein"), [burned] = useBurn(date);
  const eaten = Math.round(meals.reduce((t, m) => t + (m.calories || 0), 0)), budget = calories + earnedBack(burned), left = budget - eaten;
  const proteinEaten = Math.round(meals.reduce((t, m) => t + (m.protein || 0), 0));
  return { stats: [
    { label: t("Eaten today"), value: t("{n} kcal", { n: eaten }), detail: t("{count} meals", { count: meals.length }) },
    { label: left >= 0 ? t("Left today") : t("Over today"), value: t("{n} kcal", { n: Math.abs(left) }), detail: t("of {n}", { n: budget }) },
    { label: t("Protein"), value: t("{n} g", { n: proteinEaten }), detail: t("of {n} g", { n: protein }) } ],
    actions: [["/scanner", t("Log food")], ["/nutrition", t("Open diary")]] };
}

function useMoveSummary(): Summary {
  const date = useLocalDate(), [burned] = useBurn(date), days = useActiveDays();
  const week = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }));
  const active = days.filter(d => week.has(d)).length;
  return { stats: [
    { label: t("Burned today"), value: t("{n} kcal", { n: Math.round(burned) }) },
    { label: t("Active days"), value: t("{n} of 7", { n: active }), detail: t("this week") } ],
    actions: [["/workouts/muscles", t("Plan by muscle")], ["/workouts/camera", t("Start a camera workout")], ["/workouts/gps", t("Record a route")]] };
}

function useMeSummary(): Summary {
  const { user } = useAccount();
  return user ? { stats: [{ label: t("Signed in as"), value: user.profile.display_name || user.email.split("@")[0], detail: user.email }], actions: [["/account", t("Account")], ["/progress", t("See progress")]] }
    : { stats: [{ label: t("Not signed in"), value: t("Your data stays on this device"), detail: t("Sign in to keep it safe and use it everywhere.") }], actions: [["/login", t("Sign in")], ["/signup", t("Create a free account")]] };
}

const SUMMARIES: Partial<Record<Section["id"], () => Summary>> = { food: useFoodSummary, move: useMoveSummary, me: useMeSummary };

export function SectionHub({ id, intro }: { id: Section["id"]; intro: string }) {
  const section = SECTIONS.find(s => s.id === id)!, Icon = section.icon;
  const summary = SUMMARIES[id]!();                 // each hub page always renders the same section, so the hook order is fixed
  return <main className="hub-page">
    <header className="hub-head"><span className="hub-icon" aria-hidden><Icon size={26} /></span><div><h1>{t(section.label)}</h1><p>{t(intro)}</p></div></header>
    <section className="ds-card hub-today" aria-label={t("Today")}>
      <dl className="hub-stats">{summary.stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}{s.detail && <small>{s.detail}</small>}</dd></div>)}</dl>
      <div className="hub-actions">{summary.actions.map(([href, text], i) => <Link key={href} href={href} className={`ds-btn ${i === 0 ? "ds-btn-primary" : "ds-btn-quiet"}`}>{text}</Link>)}</div>
    </section>
    {section.groups!.map(group => <section key={group.title} className="hub-group" aria-labelledby={`hub-${group.title}`}>
      <h2 id={`hub-${group.title}`}>{t(group.title)}</h2>
      <ul>{group.items.map(({ href, title, text, icon: ItemIcon }) => <li key={href}><Link href={href} className="hub-card">
        <span className="hub-card-icon" aria-hidden><ItemIcon size={22} /></span>
        <span className="hub-card-text"><strong>{t(title)}</strong><small>{t(text)}</small></span>
        <ArrowRight className="hub-card-arrow" size={18} aria-hidden /></Link></li>)}</ul>
    </section>)}
  </main>;
}
