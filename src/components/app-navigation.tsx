// App navigation: five sections (Today, Food, Move, Play, Me) — a bottom tab bar on phones, a top bar on wide screens —
// with a "+" quick add in the middle, plus a slim header with the brand, the section's main pages and the page companion ("Ask Pip").
// The structure lives in lib/sections.ts. Sign-in screens and the offline journal stay free of navigation.
import { Fragment, useEffect, useRef } from "react";
import { Link, usePathname } from "@/lib/navigation";
import { pageTitle, sectionFor, SECTIONS } from "@/lib/sections";
import { PageCompanion } from "./feature-companion";
import { QuickAdd } from "./quick-add";

export { SECTIONS, sectionFor };
const BARE = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/offline"];

/** A section's main pages. On any other page of the section, that page is added at the end so you can see where you are. */
function SectionPages({ label, pages, path }: { label: string; pages: [string, string][]; path: string }) {
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => { current.current?.scrollIntoView?.({ block: "nearest", inline: "center" }); }, [path]);
  const here = pages.some(([href]) => href === path) ? null : pageTitle(path);
  const shown: [string, string][] = here ? [...pages, [path, here]] : pages;
  return <nav className="app-section-pages" aria-label={`${label} pages`}>
    {shown.map(([href, text]) => <Link key={href} ref={href === path ? current : undefined} href={href} aria-current={href === path ? "page" : undefined}>{text}</Link>)}
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
      {SECTIONS.map(({ id, label, href, icon: Icon }, i) => <Fragment key={id}>
        {i === 3 && <QuickAdd />}
        <Link href={href} aria-current={section?.id === id ? "page" : undefined}><Icon aria-hidden="true" size={22} strokeWidth={2.2} /><span>{label}</span></Link>
      </Fragment>)}
    </nav>
  </>;
}
