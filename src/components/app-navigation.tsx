// App navigation: five tabs (Home, Food, Move, Play, Me) — a bottom tab bar on phones, a top bar on wide screens —
// plus a slim header with the brand, the current section's pages and the page companion ("Ask Pip").
// Sign-in screens and the offline journal stay free of navigation.
import { Activity, House, Sparkles, UserRound, Utensils, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/lib/navigation";
import { PageCompanion } from "./feature-companion";

type Section = { id: string; label: string; href: string; icon: LucideIcon; pages: [string, string][] };

export const SECTIONS: Section[] = [
  { id: "home", label: "Home", href: "/", icon: House, pages: [["/", "Today"]] },
  { id: "food", label: "Food", href: "/nutrition", icon: Utensils, pages: [["/nutrition", "Diary"], ["/scanner", "Scanner"], ["/barcode", "Barcode"], ["/describe", "Describe"], ["/food-library", "Library"], ["/journal", "Journal"], ["/recipes", "Recipes"]] },
  { id: "move", label: "Move", href: "/workouts", icon: Activity, pages: [["/workouts", "Workouts"], ["/workouts/camera", "Camera"], ["/recovery", "Recovery"], ["/plan", "My plan"], ["/progress", "Progress"]] },
  { id: "play", label: "Play", href: "/play", icon: Sparkles, pages: [["/play", "Quests"], ["/feed", "Feed"], ["/communities", "Communities"], ["/events", "Events"], ["/challenges", "Challenges"]] },
  { id: "me", label: "Me", href: "/account", icon: UserRound, pages: [["/account", "Account"], ["/routine", "Reminders"], ["/premium", "Premium"], ["/tools", "Smart tools"], ["/onboarding", "Setup"], ["/guide", "Test drive"], ["/help", "Help"], ["/privacy", "Privacy"], ["/terms", "Terms"]] },
];
const BARE = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/offline"];

export function sectionFor(path: string) {
  return SECTIONS.find(section => section.pages.some(([href]) => href === path)) ?? null;
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
      {section && section.pages.length > 1 && <nav className="app-section-pages" aria-label={`${section.label} pages`}>
        {section.pages.map(([href, label]) => <Link key={href} href={href} aria-current={href === path ? "page" : undefined}>{label}</Link>)}
      </nav>}
    </header>}
    <nav className="app-tabbar" aria-label="Main">
      {SECTIONS.map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} aria-current={section?.id === id ? "page" : undefined}><Icon aria-hidden="true" size={22} strokeWidth={2.2} /><span>{label}</span></Link>)}
    </nav>
  </>;
}
