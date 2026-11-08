// The design system on one page: colours and what they mean, type, themes and Comfort mode, buttons, rings, the Health Score,
// lab results, food and exercise cards, the 3D body map, loading states, sheets, toasts and a shared-element transition.
// It is the approval step before every page moves to this system.
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Celebration } from "@/components/celebration";
import { BODY_PARTS, BodyMap3D, STATUS_TEXT, type PartStatus } from "@/components/ds/body-map-3d";
import { ActivityRings, LabRangeBar, ScoreDial, type LabResult } from "@/components/ds/metrics";

export const metadata = { title: "TrackCal — Design system" };

const SWATCHES = [
  ["Indigo", "var(--ds-indigo)", "Brand and trust. Feels premium and medical without being cold."],
  ["Lime", "var(--ds-lime)", "Energy and wins: progress, records, the move ring."],
  ["Green", "var(--ds-green)", "On track and normal results. Reassurance."],
  ["Coral & saffron", "linear-gradient(135deg, var(--ds-coral), var(--ds-saffron))", "Food and appetite. Warm and familiar."],
  ["Amber", "var(--ds-amber)", "Worth a look. Attention without alarm."],
  ["Red", "var(--ds-red)", "Medical alerts only, so it always means act."],
] as const;
const LABS: LabResult[] = [
  { name: "LDL cholesterol", value: 142, unit: "mg/dL", low: 0, high: 100, min: 0, max: 220, previous: 162, note: "Down 20 since your last report. Keep 30 g of fibre a day and your 5 brisk walks a week." },
  { name: "HbA1c", value: 5.4, unit: "%", low: 4, high: 5.6, min: 4, max: 9, previous: 5.9, note: "Back in the normal range. The walk after dinner is working." },
  { name: "Haemoglobin", value: 10.8, unit: "g/dL", low: 12, high: 15.5, min: 6, max: 18, note: "A little low. Iron-rich ragi, rajma and spinach with lemon, and no tea within an hour of meals." },
];

function setRoot(key: "theme" | "comfort" | "motion", value: string) { document.documentElement.dataset[key] = value; }

export default function Page() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? "light"), [comfort, setComfort] = useState(() => document.documentElement.dataset.comfort === "on");
  const [parts, setParts] = useState<Record<string, PartStatus>>({ knee_r: "healing", lower_back: "recovered", shoulder_l: "avoid" }), [part, setPart] = useState<string | null>("knee_r");
  const [toast, setToast] = useState(""), [cheer, setCheer] = useState(0), [open, setOpen] = useState(false), [loading, setLoading] = useState(true);
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 2200); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);
  const label = BODY_PARTS.find(p => p.id === part)?.label;
  // A card grows into its page: the browser animates the shared element between the two layouts.
  const expand = (next: boolean) => {
    const go = () => flushSync(() => setOpen(next));
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && document.documentElement.dataset.motion !== "reduced") doc.startViewTransition(go); else go();
  };
  const ripple = (e: React.PointerEvent<HTMLButtonElement>) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`); };

  return <main className="ds-page">
    <section className="ds-hero">
      <span className="ds-hero-orbit" aria-hidden="true" />
      <span className="eyebrow">TRACKCAL DESIGN SYSTEM</span>
      <h1>Calm power, for every body.</h1>
      <p>Premium and trustworthy like a health product, energetic like a sports app. Every colour means something, every movement has a purpose, and Comfort mode makes it easy for any age.</p>
    </section>

    <section className="ds-section" aria-labelledby="ds-modes">
      <h2 id="ds-modes">Themes and Comfort mode</h2>
      <p className="ds-lead">Try them here. Your permanent choice is under Appearance at the bottom of every page.</p>
      <div className="ds-modes" role="group" aria-label="Preview">
        {(["light", "dark"] as const).map(t => <button key={t} className="ds-chip" aria-pressed={theme === t} onClick={() => { setTheme(t); setRoot("theme", t); }}>{t === "light" ? "☀ Light" : "☾ Dark"}</button>)}
        <button className="ds-chip" aria-pressed={comfort} onClick={() => { setComfort(!comfort); setRoot("comfort", comfort ? "off" : "on"); }}>Aa Comfort mode</button>
      </div>
    </section>

    <section className="ds-section" aria-labelledby="ds-colour">
      <h2 id="ds-colour">Colour with a meaning</h2>
      <p className="ds-lead">Each colour does one job, so people learn the app without reading it.</p>
      <div className="ds-grid">{SWATCHES.map(([name, fill, why]) => <div key={name} className="ds-card ds-swatch"><i style={{ background: fill }} /><strong>{name}</strong><small>{why}</small></div>)}</div>
    </section>

    <section className="ds-section" aria-labelledby="ds-type">
      <h2 id="ds-type">Type</h2>
      <div className="ds-card ds-type">
        <p className="t-display">Make your next report better.</p>
        <p className="t-title">Today: walk 20 min after dinner</p>
        <p className="t-body">Readable at arm&apos;s length, with fixed-width numbers so counters never jump.</p>
        <p className="t-num">12,480 <span className="t-body">steps</span></p>
        <p className="t-regional" lang="ta">தயிர் சாதம் <span className="t-body" lang="en">Curd rice</span></p>
        <p className="t-regional" lang="hi">राजमा चावल <span className="t-body" lang="en">Rajma rice</span></p>
      </div>
    </section>

    <section className="ds-section" aria-labelledby="ds-buttons">
      <h2 id="ds-buttons">Buttons</h2>
      <div className="ds-buttons">
        <button className="ds-btn ds-btn-primary" onPointerMove={ripple} onClick={() => setToast("Workout started")}>Start workout</button>
        <button className="ds-btn ds-btn-energy" onPointerMove={ripple} onClick={() => { setCheer(c => c + 1); setToast("New record: 25 push-ups 🏆"); }}>Log a win</button>
        <button className="ds-btn ds-btn-quiet" onClick={() => sheet.current?.showModal()}>Open a sheet</button>
        <button className="ds-btn ds-btn-danger" onClick={() => setToast("Nothing deleted: this is a preview")}>Delete</button>
      </div>
      {cheer > 0 && <div className="celebration-host" key={cheer}><Celebration /></div>}
    </section>

    <section className="ds-section" aria-labelledby="ds-today">
      <h2 id="ds-today">Today and the Health Score</h2>
      <p className="ds-lead">Three rings for the day and one number for the long run, built from your reports, activity and food.</p>
      <div className="ds-grid">
        <div className="ds-card"><h3>Today</h3><p className="ds-sub">Close all three for a perfect day.</p><br />
          <ActivityRings rings={[{ label: "Move", value: 32, goal: 30, unit: "min", color: "var(--ds-move)" }, { label: "Eat", value: 24, goal: 30, unit: "g fibre", color: "var(--ds-eat)" }, { label: "Recover", value: 6, goal: 8, unit: "h sleep", color: "var(--ds-recover)" }]} /></div>
        <div className="ds-card"><ScoreDial score={712} change={38} /></div>
      </div>
    </section>

    <section className="ds-section" aria-labelledby="ds-labs">
      <h2 id="ds-labs">Your report, explained</h2>
      <p className="ds-lead">Each result on its normal range, with your last report for the trend and one plain sentence about what to do.</p>
      <div className="ds-grid">{LABS.map(l => <div key={l.name} className="ds-card"><LabRangeBar lab={l} /></div>)}</div>
    </section>

    <section className="ds-section" aria-labelledby="ds-cards">
      <h2 id="ds-cards">Food and exercise</h2>
      <div className="ds-grid">
        <article className="ds-card ds-lift ds-food">
          <div className="ds-food-img" aria-hidden="true">🍚</div>
          <div><h3 lang="ta">தயிர் சாதம்</h3><p className="ds-en">Curd rice · 1 bowl, about 250 g</p>
            <div className="ds-macros">{[["Protein", "8 g", "32%", "var(--ds-green)"], ["Carbs", "42 g", "70%", "var(--ds-saffron)"], ["Fat", "6 g", "24%", "var(--ds-coral)"]].map(([n, v, w, c]) => <span key={n} className="ds-macro">{n} <b>{v}</b><i style={{ "--w": w, "--c": c } as React.CSSProperties} /></span>)}</div>
          </div>
          <span className="ds-kcal">252 <small>kcal</small></span>
        </article>
        <article className="ds-card ds-lift">
          <div className="ds-ex-art" aria-hidden="true"><svg viewBox="0 0 200 140"><g className="ds-squat"><circle cx="100" cy="32" r="11" /><line x1="100" y1="44" x2="100" y2="84" /><line x1="100" y1="58" x2="72" y2="70" /><line x1="100" y1="58" x2="128" y2="70" /><line className="hot" x1="100" y1="84" x2="84" y2="108" /><line className="hot" x1="100" y1="84" x2="116" y2="108" /><line x1="84" y1="108" x2="84" y2="130" /><line x1="116" y1="108" x2="116" y2="130" /></g></svg></div>
          <h3>Box squat</h3><p className="ds-sub">3 × 10 · quads and glutes</p>
          <div className="ds-tags"><span className="ds-tag" data-tone="safe">✓ Knee-safe version</span><span className="ds-tag">Camera counts reps</span><span className="ds-tag">Beginner</span></div>
        </article>
      </div>
    </section>

    <section className="ds-section" aria-labelledby="ds-body">
      <h2 id="ds-body">Surgeries and injuries, on your body</h2>
      <p className="ds-lead">Turn the body, tap where it hurts or where you had surgery, and the plan protects that part while it heals.</p>
      <div className="ds-body">
        <BodyMap3D statuses={parts} selected={part} onSelect={setPart} />
        <div className="ds-card">
          <h3>{label ?? "Choose a body part"}</h3>
          <p className="ds-sub">{part ? `Now: ${STATUS_TEXT[parts[part] ?? "none"]}` : "Tap the body or pick from the list."}</p>
          {part && <div className="ds-modes" role="group" aria-label={`Status of ${label}`} style={{ margin: "12px 0" }}>
            {(["none", "recovered", "healing", "avoid"] as PartStatus[]).map(s => <button key={s} className="ds-chip" aria-pressed={(parts[part] ?? "none") === s} onClick={() => setParts(p => ({ ...p, [part]: s }))}>{STATUS_TEXT[s]}</button>)}
          </div>}
          <div className="ds-legend"><span><i className="ds-dot" style={{ background: "var(--ds-green)" }} />Recovered</span><span><i className="ds-dot" style={{ background: "var(--ds-amber)" }} />Healing</span><span><i className="ds-dot" style={{ background: "var(--ds-red)" }} />Avoid for now</span></div>
          <div className="ds-parts" role="group" aria-label="Body parts">{BODY_PARTS.map(p => <button key={p.id} className="ds-part" aria-pressed={part === p.id} onClick={() => setPart(p.id)}>{(parts[p.id] ?? "none") !== "none" && <i className="ds-dot" style={{ background: parts[p.id] === "recovered" ? "var(--ds-green)" : parts[p.id] === "healing" ? "var(--ds-amber)" : "var(--ds-red)" }} />}{p.label}</button>)}</div>
        </div>
      </div>
    </section>

    <section className="ds-section" aria-labelledby="ds-motion">
      <h2 id="ds-motion">Movement</h2>
      <p className="ds-lead">Loading never shows a blank page, and a tapped card grows into its page.</p>
      <div className="ds-grid">
        <div className="ds-card">{loading ? <div className="ds-skeleton" aria-label="Loading"><i style={{ width: "60%" }} /><i /><i style={{ width: "80%" }} /><i style={{ width: "45%" }} /></div> : <><h3>Loaded</h3><p className="ds-sub">Placeholders hold the layout while data arrives, so nothing jumps.</p><button className="ds-btn ds-btn-quiet" style={{ marginTop: 12 }} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2200); }}>Load again</button></>}</div>
        {!open && <button className="ds-card ds-lift ds-expand" style={{ viewTransitionName: "ds-hero-card", textAlign: "left" }} onClick={() => expand(true)}><h3>Morning run · 5.02 km</h3><p className="ds-sub">Tap to open: the card grows into its page.</p></button>}
      </div>
    </section>

    {open && <div className="ds-expanded" onClick={() => expand(false)}><div className="ds-card" style={{ viewTransitionName: "ds-hero-card" }} onClick={e => e.stopPropagation()}><h3>Morning run · 5.02 km</h3><p className="ds-sub">25:10 moving · 5:01 /km · 3 personal records</p><br /><button className="ds-btn ds-btn-primary" onClick={() => expand(false)}>Close</button></div></div>}

    <dialog ref={sheet} className="ds-sheet" aria-labelledby="ds-sheet-title" onClick={e => { if (e.target === sheet.current) sheet.current?.close(); }}>
      <div className="ds-sheet-grab" aria-hidden="true" />
      <h2 id="ds-sheet-title">Log water</h2>
      <p className="ds-sub">On phones this rises from the bottom, in thumb reach; on laptops it opens in the middle.</p>
      <div className="ds-buttons" style={{ marginTop: 16 }}>{[250, 500, 750].map(ml => <button key={ml} className="ds-btn ds-btn-quiet" onClick={() => { sheet.current?.close(); setToast(`+${ml} ml water`); }}>+{ml} ml</button>)}</div>
    </dialog>
    {toast && <div className="ds-toast" role="status">{toast}</div>}
  </main>;
}
