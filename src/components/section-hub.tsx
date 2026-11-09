// A section's overview: a short look at today, the one or two things people do most, then every destination in clear groups.
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
    { label: "Eaten today", value: `${eaten.toLocaleString()} kcal`, detail: `${meals.length} ${meals.length === 1 ? "meal" : "meals"}` },
    { label: left >= 0 ? "Left today" : "Over today", value: `${Math.abs(left).toLocaleString()} kcal`, detail: `of ${budget.toLocaleString()}` },
    { label: "Protein", value: `${proteinEaten} g`, detail: `of ${protein} g` } ],
    actions: [["/scanner", "Log food"], ["/nutrition", "Open diary"]] };
}

function useMoveSummary(): Summary {
  const date = useLocalDate(), [burned] = useBurn(date), days = useActiveDays();
  const week = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }));
  const active = days.filter(d => week.has(d)).length;
  return { stats: [
    { label: "Burned today", value: `${Math.round(burned).toLocaleString()} kcal` },
    { label: "Active days", value: `${active} of 7`, detail: "this week" } ],
    actions: [["/workouts/camera", "Start a camera workout"], ["/workouts/gps", "Record a route"]] };
}

function useMeSummary(): Summary {
  const { user } = useAccount();
  return user ? { stats: [{ label: "Signed in as", value: user.profile.display_name || user.email.split("@")[0], detail: user.email }], actions: [["/account", "Account"], ["/progress", "See progress"]] }
    : { stats: [{ label: "Not signed in", value: "Your data stays on this device", detail: "Sign in to keep it safe and use it everywhere." }], actions: [["/login", "Sign in"], ["/signup", "Create a free account"]] };
}

const SUMMARIES: Partial<Record<Section["id"], () => Summary>> = { food: useFoodSummary, move: useMoveSummary, me: useMeSummary };

export function SectionHub({ id, intro }: { id: Section["id"]; intro: string }) {
  const section = SECTIONS.find(s => s.id === id)!, Icon = section.icon;
  const summary = SUMMARIES[id]!();                 // each hub page always renders the same section, so the hook order is fixed
  return <main className="hub-page">
    <header className="hub-head"><span className="hub-icon" aria-hidden><Icon size={26} /></span><div><h1>{section.label}</h1><p>{intro}</p></div></header>
    <section className="ds-card hub-today" aria-label="Today">
      <dl className="hub-stats">{summary.stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}{s.detail && <small>{s.detail}</small>}</dd></div>)}</dl>
      <div className="hub-actions">{summary.actions.map(([href, text], i) => <Link key={href} href={href} className={`ds-btn ${i === 0 ? "ds-btn-primary" : "ds-btn-quiet"}`}>{text}</Link>)}</div>
    </section>
    {section.groups!.map(group => <section key={group.title} className="hub-group" aria-labelledby={`hub-${group.title}`}>
      <h2 id={`hub-${group.title}`}>{group.title}</h2>
      <ul>{group.items.map(({ href, title, text, icon: ItemIcon }) => <li key={href}><Link href={href} className="hub-card">
        <span className="hub-card-icon" aria-hidden><ItemIcon size={22} /></span>
        <span className="hub-card-text"><strong>{title}</strong><small>{text}</small></span>
        <ArrowRight className="hub-card-arrow" size={18} aria-hidden /></Link></li>)}</ul>
    </section>)}
  </main>;
}
