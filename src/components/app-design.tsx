"use client";
import { Camera, ScanBarcode, MessageSquare, Search, BookOpen, ChefHat, ArrowUpRight, Leaf, SlidersHorizontal, CircleHelp, Sparkles, ArrowRight, Home, Activity, CalendarDays, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { AccountLink } from "./account-session";
export type AppTab = "scanner" | "barcode" | "voice_text" | "database" | "logs" | "recipes";
const navigation = [
  { id: "scanner", label: "Food scanner", icon: Camera },
  { id: "barcode", label: "Barcode scan", icon: ScanBarcode },
  { id: "voice_text", label: "Describe a meal", icon: MessageSquare },
  { id: "database", label: "Food library", icon: Search },
  { id: "logs", label: "My journal", icon: BookOpen },
  { id: "recipes", label: "Recipe studio", icon: ChefHat },
] as const;

export function AppNavigation({ activeTab, onTab, onGoal, onHome }: { onHome?:()=>void; activeTab: AppTab; onTab: (tab: AppTab) => void; onGoal: () => void }) {
  return <aside className="app-sidebar">
    <div className="brand-row"><Link href="/" className="brand"><span className="brand-mark"><Leaf size={23} strokeWidth={2.2} /></span>trackcal<span className="brand-period">.</span></Link><button className="mobile-goals" onClick={onGoal}><SlidersHorizontal size={15} /> My goals</button></div>
    <nav className="studio-rail-links" aria-label="Wellness workspace"><button className="nav-item studio-today" onClick={()=>onHome?onHome():onTab("scanner")}><Home size={19}/>Today</button><Link className="nav-item" href="/nutrition"><Leaf size={19}/>Nutrition diary</Link><Link className="nav-item" href="/workouts"><Activity size={19}/>Workouts</Link><Link className="nav-item" href="/workouts/camera"><Camera size={19}/>Camera studio</Link><Link className="nav-item" href="/plan"><CalendarDays size={19}/>My plan</Link><Link className="nav-item" href="/play"><Gamepad2 size={19}/>Quests & play</Link></nav><details className="studio-tool-menu" open><summary className="workspace-label">FOOD TOOLS</summary>
    <nav aria-label="Main navigation" className="sidebar-nav">{navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "nav-item selected" : "nav-item"} onClick={() => onTab(id)}><Icon size={19} /><span>{label}</span>{activeTab === id && <span className="nav-dot" />}</button>)}</nav></details>
    <div className="sidebar-bottom"><div className="wellness-note"><span className="note-icon"><Sparkles size={20} /></span><span className="studio-note-label">A LITTLE LESS GUESSWORK</span><h3>New here?<br/>Start with a small win.</h3><Link href="/guide">Take a guided test drive <ArrowUpRight size={16}/></Link></div>
    <button className="nav-item" onClick={onGoal}><SlidersHorizontal size={18} /><span>My nutrition goals</span></button>
    <Link className="nav-item" href="/tools"><Sparkles size={18} /><span>Smart tools</span></Link><Link className="nav-item" href="/progress"><BookOpen size={18} /><span>Progress & reports</span></Link><AccountLink /><Link className="sidebar-foot" href="/help"><CircleHelp size={16} /> Help & feature guide</Link></div>
  </aside>;
}

export function DashboardHero({ activeTab, onTab, date, compact=false }: { activeTab: AppTab; onTab: (tab: AppTab) => void; date: string; compact?:boolean }) {
  const current = navigation.find(item => item.id === activeTab)!;
  const titles = { scanner: "Good food. Better days", logs: "Your day, thoughtfully tracked", recipes: "A little homemade goodness", barcode: "Know your everyday food", voice_text: "Your meal, in your words", database: "Find your next favorite" };
  return <>
    <div className="workspace-topbar"><div><span className="breadcrumb">Your workspace <span>/</span></span><strong>{current.label}</strong></div><div className="topbar-right"><span className="date-pill"><span />{date || "Today"}</span><Link href="/account" className="profile-avatar" aria-label="Open account">Y</Link></div></div>
    {compact&&activeTab!=="scanner"&&<h1 className="studio-tool-title">{current.label}</h1>}
    {!compact&&<><section className="welcome-heading"><div><p className="eyebrow">A HEALTHIER EVERYDAY</p><h1>{titles[activeTab]}<span>.</span></h1><p>A little awareness goes a long way. Let’s make today feel good.</p></div><span className="daily-tag"><Leaf size={15} /> Your pace. Your progress.</span></section></>}
    <section className="balance-hero" onPointerMove={event => { if (event.pointerType === "touch") return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--tilt-x", `${(event.clientX - rect.left - rect.width / 2) / rect.width * 9}deg`); event.currentTarget.style.setProperty("--tilt-y", `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 7}deg`); }} onPointerLeave={event => { event.currentTarget.style.setProperty("--tilt-x", "0deg"); event.currentTarget.style.setProperty("--tilt-y", "0deg"); }}>
      <div className="hero-copy"><span className="hero-kicker"><span className="sparkle-dot"><Sparkles size={13} /></span> LESS GUESSWORK. MORE BALANCE.</span><h2>Eat well.<br />Live in <em>balance.</em></h2><p>Meet your meals with a little more clarity.<br className="desktop-break" /> Scan, understand, and build habits that last.</p><div className="hero-actions"><button className="hero-primary" onClick={() => { onTab("scanner"); document.getElementById("tracking-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Camera size={18} /> Scan a meal <ArrowUpRight size={17} /></button><button className="hero-secondary" onClick={() => onTab("logs")}>Open journal <ArrowRight size={17} /></button></div><span className="hero-footnote"><span /> A fresh start, every single day</span></div>
      <div className="hero-art" aria-label="Decorative three-dimensional bowl of colorful vegetables" role="img"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-spark spark-one">✧</div><div className="art-spark spark-two">+</div><div className="plate-stage"><div className="plate-shadow" /><div className="food-plate"><div className="plate-inner"><div className="greens"><i /><i /><i /><i /><i /></div><div className="avocado"><div /></div><div className="tomato tomato-one" /><div className="tomato tomato-two" /><div className="tomato tomato-three" /><div className="rice"><i /><i /><i /><i /></div><div className="cucumber cucumber-one" /><div className="cucumber cucumber-two" /><div className="seed seed-one" /><div className="seed seed-two" /><div className="seed seed-three" /></div></div></div><div className="floating-pill nutrition-pill"><span className="pill-icon"><Leaf size={18} /></span><div><strong>A little more nourishment</strong><small>One mindful meal at a time</small></div></div><div className="floating-pill balance-pill"><span className="balance-mini-ring" /><div><strong>Made for real life</strong><small>Balance over perfection</small></div></div></div>
    </section>
  </>;
}
