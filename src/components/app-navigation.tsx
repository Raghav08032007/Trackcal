// App navigation: five tabs (Home, Food, Move, Play, Me) — a bottom tab bar on phones, a top bar on wide screens —
// plus a slim header with the brand, the current section's pages and the page companion ("Ask Pip").
// Sign-in screens and the offline journal stay free of navigation.
import { useEffect, useRef, useState } from "react";
import { Activity, House, Sparkles, UserRound, Utensils, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/lib/navigation";
import { PageCompanion } from "./feature-companion";

type Section = { id: string; label: string; href: string; icon: LucideIcon; pages: [string, string][] };

export const SECTIONS: Section[] = [
  { id: "home", label: "Home", href: "/", icon: House, pages: [["/", "Today"], ["/coach", "Coach"]] },
  { id: "food", label: "Food", href: "/nutrition", icon: Utensils, pages: [["/nutrition", "Diary"], ["/scanner", "Scanner"], ["/barcode", "Barcode"], ["/describe", "Describe"], ["/menu", "Menu"], ["/recipes", "Recipes"], ["/food-library", "Library"], ["/fasting", "Fasting"], ["/journal", "On this device"]] },
  { id: "move", label: "Move", href: "/workouts", icon: Activity, pages: [["/workouts", "Workouts"], ["/workouts/muscles", "By muscle"], ["/workouts/camera", "Camera"], ["/workouts/gps", "Record"], ["/activities", "Activities"], ["/programs", "Programs"], ["/recovery", "Recovery"], ["/plan", "My plan"], ["/progress", "Progress"]] },
  { id: "play", label: "Play", href: "/play", icon: Sparkles, pages: [["/play", "Quests"], ["/feed", "Feed"], ["/communities", "Communities"], ["/events", "Events"], ["/challenges", "Challenges"]] },
  { id: "me", label: "Me", href: "/account", icon: UserRound, pages: [["/account", "Account"], ["/routine", "Reminders"], ["/tools", "Smart tools"], ["/premium", "Premium"], ["/help", "Help"], ["/onboarding", "Setup"], ["/guide", "Test drive"], ["/privacy", "Privacy"], ["/terms", "Terms"]] },
];
const VISIBLE_PAGES = 5;
const BARE = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/offline"];

export function sectionFor(path: string) {
  return SECTIONS.find(section => section.pages.some(([href]) => href === path)) ?? null;
}

/** A section's pages. Long sections show the main ones, and More opens the rest. */
function SectionPages({ label, pages, path }: { label: string; pages: [string, string][]; path: string }) {
  const hidden = pages.slice(VISIBLE_PAGES), [open, setOpen] = useState(hidden.some(([href]) => href === path)), current = useRef<HTMLAnchorElement>(null);
  useEffect(() => { current.current?.scrollIntoView?.({ block: "nearest", inline: "center" }); }, [path]);
  const link = ([href, text]: [string, string]) => <Link key={href} ref={href === path ? current : undefined} href={href} aria-current={href === path ? "page" : undefined}>{text}</Link>;
  return <nav className="app-section-pages" aria-label={`${label} pages`}>
    {pages.slice(0, VISIBLE_PAGES).map(link)}
    {hidden.length > 0 && <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "Less" : "More"}</button>}
    {open && hidden.map(link)}
  </nav>;
}

export function AppNavigation() {
  const path = usePathname();
  if (BARE.includes(path)) return null;
  const section = sectionFor(path);
  return <>
    {path !== "/" && <header className="app-topbar">
      <div className="app-topbar-row">
        <Link href="/" className="app-brand" aria-label="TrackCal home">trackcal<span>.</span></Link>
        <PageCompanion />
      </div>
      {section && section.pages.length > 1 && <SectionPages key={section.id} label={section.label} pages={section.pages} path={path} />}
    </header>}
    <nav className="app-tabbar" aria-label="Main">
      {SECTIONS.map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} aria-current={section?.id === id ? "page" : undefined}><Icon aria-hidden="true" size={22} strokeWidth={2.2} /><span>{label}</span></Link>)}
    </nav>
  </>;
}
