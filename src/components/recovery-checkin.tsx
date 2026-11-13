// Injury check-ins. On Today: one card asking about each part not yet checked today (pain 0-10, better/same/worse, warning signs).
// On the recovery page: each part's stage, why, what's next, and a four-week pain chart.
import { useState } from "react";
import { HeartPulse, TriangleAlert } from "lucide-react";
import { Link } from "@/lib/navigation";
import { PAIN_WORDS, partName, useRecovery, type CheckIn, type RecoveryPart } from "@/lib/recovery";

const STAGE_STEPS = ["avoid", "healing", "recovered"] as const;

function Stage({ part }: { part: RecoveryPart }) {
  return <div className={`recovery-stage recovery-${part.stage}`}>
    <ol className="recovery-steps" aria-label={`Recovery stage: ${part.stage_name}`}>
      {STAGE_STEPS.map(s => <li key={s} data-on={STAGE_STEPS.indexOf(s) <= STAGE_STEPS.indexOf(part.stage) || undefined} aria-current={s === part.stage ? "step" : undefined}>{{ avoid: "Resting it", healing: "Easing back", recovered: "Recovered" }[s]}</li>)}
    </ol>
    <p><strong>{part.stage_name}.</strong> {part.reason}</p>
    {part.alert && <p className="recovery-alert" role="alert"><TriangleAlert size={18} aria-hidden="true" /> {part.advice}</p>}
    {part.next && <p className="ds-sub">{part.next}</p>}
  </div>;
}

function Form({ part, flags, onSave }: { part: RecoveryPart; flags: Record<string, string>; onSave: (e: { part: string; pain: number; trend: CheckIn["trend"]; red_flags: string[] }) => Promise<unknown> }) {
  const [pain, setPain] = useState<number | null>(null), [trend, setTrend] = useState<CheckIn["trend"] | null>(null), [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const name = partName(part);
  const save = async () => {
    if (pain === null || !trend) return;
    setBusy(true); setError("");
    try { await onSave({ part: part.part, pain, trend, red_flags: chosen }); } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  };
  return <form className="recovery-form" onSubmit={e => { e.preventDefault(); void save(); }}>
    <fieldset><legend>How much does your {name} hurt right now?</legend>
      <div className="pain-scale">{Array.from({ length: 11 }, (_, n) => <label key={n} className="pain-dot" data-level={n <= 3 ? "mild" : n <= 6 ? "moderate" : "severe"}>
        <input type="radio" name={`pain-${part.part}`} value={n} checked={pain === n} onChange={() => setPain(n)} /><span>{n}</span></label>)}</div>
      <p className="pain-word" aria-live="polite">{pain === null ? "0 is no pain, 10 the worst imaginable." : `${pain}: ${PAIN_WORDS(pain)}`}</p>
    </fieldset>
    <fieldset><legend>Compared with yesterday</legend>
      <div className="trend-choices">{(["better", "same", "worse"] as const).map(t => <label key={t} className="trend-choice"><input type="radio" name={`trend-${part.part}`} checked={trend === t} onChange={() => setTrend(t)} /><span>{t[0].toUpperCase() + t.slice(1)}</span></label>)}</div>
    </fieldset>
    <details className="red-flags"><summary>Anything else? (warning signs)</summary>
      {Object.entries(flags).map(([id, text]) => <label key={id} className="red-flag"><input type="checkbox" checked={chosen.includes(id)} onChange={e => setChosen(c => e.target.checked ? [...c, id] : c.filter(x => x !== id))} /> {text}</label>)}
    </details>
    {error && <p className="account-error" role="alert">{error}</p>}
    <button className="account-primary" disabled={busy || pain === null || !trend}>{busy ? "Saving…" : "Save check-in"}</button>
  </form>;
}

/** Today: a short check-in for each injured or operated part that isn't recovered and hasn't been checked today. */
export function RecoveryCheckin() {
  const { data, checkIn } = useRecovery(), [justSaved, setJustSaved] = useState<string | null>(null);
  if (!data) return null;
  const due = data.parts.filter(p => (p.stage !== "recovered" || p.base !== "recovered") && !p.checked_today);
  const saved = justSaved ? data.parts.find(p => p.part === justSaved) : null;
  if (!due.length && !saved) return null;
  const part = due[0];
  return <section className="ds-card recovery-card" aria-labelledby="recovery-title">
    <span className="recovery-icon" aria-hidden="true"><HeartPulse size={22} /></span>
    <div>
      {saved && <><h2 id={part ? undefined : "recovery-title"}>Thanks: your {partName(saved)}</h2><Stage part={saved} /></>}
      {part && <><h2 id="recovery-title">How is your {partName(part)} today?</h2>
        <Form key={part.part} part={part} flags={data.red_flags} onSave={async e => { await checkIn(e); setJustSaved(e.part); }} /></>}
      <p className="ds-sub"><Link href="/recovery">Your recovery</Link> · Based on {data.source}. Not a diagnosis.</p>
    </div>
  </section>;
}

function Chart({ history }: { history: CheckIn[] }) {
  if (!history.length) return <p className="ds-sub">No check-ins yet.</p>;
  const w = 280, h = 90, n = history.length, x = (i: number) => n === 1 ? w / 2 : 8 + (i * (w - 16)) / (n - 1), y = (p: number) => 8 + ((10 - p) * (h - 16)) / 10;
  const line = history.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(c.pain).toFixed(1)}`).join(" ");
  return <svg className="pain-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Pain over the last ${n} check-ins, from ${history[0].pain} to ${history[n - 1].pain} out of 10`}>
    <rect x="0" y={y(10)} width={w} height={y(7) - y(10)} className="pain-band-high" /><rect x="0" y={y(2)} width={w} height={y(0) - y(2)} className="pain-band-safe" />
    <path d={line} className="pain-line" />{history.map((c, i) => <circle key={c.day} cx={x(i)} cy={y(c.pain)} r="3.5" className={c.red_flags.length ? "pain-flag" : "pain-point"} />)}
  </svg>;
}

/** The recovery page: every part, its stage and its pain over the last four weeks. */
export function RecoveryOverview() {
  const { data, checkIn, signedIn } = useRecovery();
  if (!signedIn || !data || !data.parts.length) return null;
  return <section className="ds-section recovery-overview" aria-labelledby="recovery-overview-title">
    <h2 id="recovery-overview-title">Injuries and recovery</h2>
    <div className="ds-grid">{data.parts.map(p => <article key={p.part} className="ds-card recovery-part">
      <h3>{partName(p)} <small>({p.kind})</small></h3><Stage part={p} /><Chart history={p.history} />
      {!p.checked_today && <Form part={p} flags={data.red_flags} onSave={checkIn} />}
    </article>)}</div>
    <p className="ds-sub">Stages move up only after steady low pain, and pause at once on high pain or a warning sign. Based on {data.source}. This is not a diagnosis.</p>
  </section>;
}
