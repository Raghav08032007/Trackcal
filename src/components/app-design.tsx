import { t, msg, localized } from "@/lib/i18n";
import { Camera, ScanBarcode, MessageSquare, Search, BookOpen, ChefHat, ArrowUpRight, Leaf, SlidersHorizontal, CircleHelp, Sparkles, ArrowRight, Home, Activity, CalendarDays, Gamepad2 } from "lucide-react";
import Link from "@/lib/navigation";
import { AccountLink } from "./account-session";
export type AppTab = "scanner" | "barcode" | "voice_text" | "database" | "logs" | "recipes";
const navigation = [
  { id: "scanner", label: msg("Food scanner"), icon: Camera },
  { id: "barcode", label: msg("Barcode scan"), icon: ScanBarcode },
  { id: "voice_text", label: msg("Describe a meal"), icon: MessageSquare },
  { id: "database", label: msg("Food library"), icon: Search },
  { id: "logs", label: msg("My journal"), icon: BookOpen },
  { id: "recipes", label: msg("Recipe studio"), icon: ChefHat },
] as const;
localized(navigation as unknown as object[], ["label"]);

export function AppNavigation({ activeTab, onTab, onGoal, onHome }: { onHome?:()=>void; activeTab: AppTab; onTab: (tab: AppTab) => void; onGoal: () => void }) {
  return <aside className="app-sidebar">
    <div className="brand-row"><Link href="/" className="brand"><span className="brand-mark"><Leaf size={23} strokeWidth={2.2} /></span>{t("trackcal")}<span className="brand-period">.</span></Link><button className="mobile-goals" onClick={onGoal}><SlidersHorizontal size={15} /> {t("My goals")}</button></div>
    <nav className="studio-rail-links" aria-label={t("Wellness workspace")}><button className="nav-item studio-today" onClick={()=>onHome?onHome():onTab("scanner")}><Home size={19}/>{t("Today")}</button><Link className="nav-item" href="/nutrition"><Leaf size={19}/>{t("Nutrition diary")}</Link><Link className="nav-item" href="/workouts"><Activity size={19}/>{t("Workouts")}</Link><Link className="nav-item" href="/workouts/camera"><Camera size={19}/>{t("Camera studio")}</Link><Link className="nav-item" href="/plan"><CalendarDays size={19}/>{t("My plan")}</Link><Link className="nav-item" href="/play"><Gamepad2 size={19}/>{t("Quests & play")}</Link></nav><details className="studio-tool-menu" open><summary className="workspace-label">{t("FOOD TOOLS")}</summary>
    <nav aria-label={t("Food workspace sections")} className="sidebar-nav">{navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "nav-item selected" : "nav-item"} onClick={() => onTab(id)}><Icon size={19} /><span>{label}</span>{activeTab === id && <span className="nav-dot" />}</button>)}</nav></details>
    <div className="sidebar-bottom"><div className="wellness-note"><span className="note-icon"><Sparkles size={20} /></span><span className="studio-note-label">{t("A LITTLE LESS GUESSWORK")}</span><h3>{t("New here?")}<br/>{t("Start with a small win.")}</h3><Link href="/guide">{t("Take a guided test drive")}{" "}<ArrowUpRight size={16}/></Link></div>
    <button className="nav-item" onClick={onGoal}><SlidersHorizontal size={18} /><span>{t("My nutrition goals")}</span></button>
    <Link className="nav-item" href="/tools"><Sparkles size={18} /><span>{t("Smart tools")}</span></Link><Link className="nav-item" href="/progress"><BookOpen size={18} /><span>{t("Progress & reports")}</span></Link><AccountLink /><Link className="sidebar-foot" href="/help"><CircleHelp size={16} /> {t("Help & feature guide")}</Link></div>
  </aside>;
}

export function DashboardHero({ activeTab, onTab, date, compact=false }: { activeTab: AppTab; onTab: (tab: AppTab) => void; date: string; compact?:boolean }) {
  const current = navigation.find(item => item.id === activeTab)!;
  const titles = { scanner: t("Good food. Better days"), logs: t("Your day, thoughtfully tracked"), recipes: t("A little homemade goodness"), barcode: t("Know your everyday food"), voice_text: t("Your meal, in your words"), database: t("Find your next favorite") };
  return <>
    <div className="workspace-topbar"><div><span className="breadcrumb">{t("Your workspace")}{" "}<span>/</span></span><strong>{current.label}</strong></div><div className="topbar-right"><span className="date-pill"><span />{date || t("Today")}</span><Link href="/account" className="profile-avatar" aria-label={t("Open account")}>Y</Link></div></div>
    {compact&&activeTab!=="scanner"&&<h1 className="studio-tool-title">{current.label}</h1>}
    {!compact&&<><section className="welcome-heading"><div><p className="eyebrow">{t("A HEALTHIER EVERYDAY")}</p><h1>{titles[activeTab]}<span>.</span></h1><p>{t("A little awareness goes a long way. Let’s make today feel good.")}</p></div><span className="daily-tag"><Leaf size={15} /> {t("Your pace. Your progress.")}</span></section></>}
    <section className="balance-hero" onPointerMove={event => { if (event.pointerType === "touch") return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--tilt-x", `${(event.clientX - rect.left - rect.width / 2) / rect.width * 9}deg`); event.currentTarget.style.setProperty("--tilt-y", `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 7}deg`); }} onPointerLeave={event => { event.currentTarget.style.setProperty("--tilt-x", "0deg"); event.currentTarget.style.setProperty("--tilt-y", "0deg"); }}>
      <div className="hero-copy"><span className="hero-kicker"><span className="sparkle-dot"><Sparkles size={13} /></span> {t("LESS GUESSWORK. MORE BALANCE.")}</span><h2>{t("Eat well.")}<br />{t("Live in")}{" "}<em>{t("balance.")}</em></h2><p>{t("Meet your meals with a little more clarity.")}<br className="desktop-break" /> {t("Scan, understand, and build habits that last.")}</p><div className="hero-actions"><button className="hero-primary" onClick={() => { onTab("scanner"); document.getElementById("tracking-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Camera size={18} /> {t("Scan a meal")}{" "}<ArrowUpRight size={17} /></button><button className="hero-secondary" onClick={() => onTab("logs")}>{t("Open journal")}{" "}<ArrowRight size={17} /></button></div><span className="hero-footnote"><span /> {t("A fresh start, every single day")}</span></div>
      <div className="hero-art" aria-label={t("Decorative three-dimensional bowl of colorful vegetables")} role="img"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-spark spark-one">✧</div><div className="art-spark spark-two">+</div><div className="plate-stage"><div className="plate-shadow" /><div className="food-plate"><div className="plate-inner"><div className="greens"><i /><i /><i /><i /><i /></div><div className="avocado"><div /></div><div className="tomato tomato-one" /><div className="tomato tomato-two" /><div className="tomato tomato-three" /><div className="rice"><i /><i /><i /><i /></div><div className="cucumber cucumber-one" /><div className="cucumber cucumber-two" /><div className="seed seed-one" /><div className="seed seed-two" /><div className="seed seed-three" /></div></div></div><div className="floating-pill nutrition-pill"><span className="pill-icon"><Leaf size={18} /></span><div><strong>{t("A little more nourishment")}</strong><small>{t("One mindful meal at a time")}</small></div></div><div className="floating-pill balance-pill"><span className="balance-mini-ring" /><div><strong>{t("Made for real life")}</strong><small>{t("Balance over perfection")}</small></div></div></div>
    </section>
  </>;
}
