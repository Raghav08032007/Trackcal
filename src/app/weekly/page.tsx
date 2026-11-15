// Your weeks: 12 weeks of activity against the WHO guideline, and the fitness and fatigue trend. Estimates, explained on the page.
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Gauge, Leaf, Table2, TrendingUp } from "lucide-react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { KINDS, loadTrend, niceMax, pace, shortDate, type Trend, type Week } from "@/lib/trend";
import "./weekly.css";

export const metadata = { title: "TrackCal — Your weeks", description: "Twelve weeks of activity against the WHO guideline, with your fitness and fatigue trend." };

export default function Page() {
  const { ready, user } = useAccount();
  const [data, setData] = useState<Trend | null>(null), [error, setError] = useState("");
  useEffect(() => { if (!user) return; loadTrend().then(setData).catch(f => setError(f instanceof Error ? f.message : "Could not load your weeks.")); }, [user]);
  if (!ready) return <main className="account-loading">Loading…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Your weeks</h1><p>Sign in to see your weekly summary.</p><Link className="account-primary" href="/login?next=/weekly">Sign in</Link></section></main>;
  if (error) return <main className="wellness-page"><section className="account-card"><h1>Your weeks</h1><p className="form-error" role="alert">{error}</p></section></main>;
  if (!data) return <main className="account-loading">Loading your weeks…</main>;
  return <View data={data} />;
}

function View({ data }: { data: Trend }) {
  const g = data.guideline, t = data.trend, p = pace(t.ratio), share = Math.min(1, g.met_minutes / g.more);
  const PaceIcon = p.id === "jump" || p.id === "building" ? AlertTriangle : p.id === "steady" ? CheckCircle2 : p.id === "light" ? Leaf : Gauge;
  return <main className="wellness-page wk-page">
    <section className="wk-hero"><span className="eyebrow">MOVE · YOUR WEEKS</span><h1>Your <em>weeks</em></h1>
      <p>Every walk, run, ride and workout, turned into one measure of effort so different weeks compare fairly.</p></section>
    <section className="wk-tiles" aria-label="This week">
      <article className={`wk-tile wk-who wk-${g.status}`}>
        <div className="wk-ring" style={{ "--share": share, "--min": g.minimum / g.more } as React.CSSProperties} aria-hidden="true"><span>{g.met_minutes.toLocaleString()}</span><small>MET-min</small></div>
        <div><h2>This week</h2><p className="wk-tag">{g.status === "building" ? <Activity size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}{g.status === "more" ? "Extra benefits" : g.status === "met" ? "Guideline met" : "Building"}</p><p>{g.text}</p></div>
      </article>
      <article className="wk-tile"><h2><TrendingUp size={18} aria-hidden="true" /> Fitness</h2><strong className="wk-big">{Math.round(t.fitness)}</strong>
        <p>Your 6-week average daily effort. Fatigue (last week) is {Math.round(t.fatigue)}; form is {t.form > 0 ? "+" : ""}{Math.round(t.form)}{t.form < -15 ? ", so you’re carrying some tiredness" : t.form > 5 ? ", so you’re fresh" : ""}.</p></article>
      <article className={`wk-tile wk-pace wk-pace-${p.id}`}><h2><PaceIcon size={18} aria-hidden="true" /> {p.label}</h2>{t.ratio !== null && <strong className="wk-big">{t.ratio.toFixed(2)}<small>× your usual</small></strong>}<p>{t.message}</p></article>
    </section>
    <WeeklyBars weeks={data.weeks} minimum={g.minimum} more={g.more} />
    <TrendLines data={data} />
    <p className="rep-replay-note wk-method">{data.method}</p>
  </main>;
}

/** A tooltip stays inside the card: centred on the mark, or held against the nearer edge. */
const tipAt = (share: number): React.CSSProperties => share > .62 ? { right: 0 } : share < .38 ? { left: 0 } : { left: `${share * 100}%`, transform: "translateX(-50%)" };

/** The chart's real width in pixels, so text and marks keep their size on a phone instead of shrinking with the picture. */
function useWidth(fallback = 640): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null), [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.clientWidth) || fallback)); measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure); watch.observe(el); return () => watch.disconnect();
  }, [fallback]);
  return [ref, width];
}

/** Stacked bars, one per week, in the fixed kind order; WHO lines at 600 and 1,200. Hover or focus a week for its numbers. */
function WeeklyBars({ weeks, minimum, more }: { weeks: Week[]; minimum: number; more: number }) {
  const [hover, setHover] = useState<number | null>(null), [table, setTable] = useState(false), [box, W] = useWidth();
  const present = KINDS.filter(k => weeks.some(w => (w.by_kind[k.id] ?? 0) > 0));
  const H = W < 480 ? 240 : 260, L = 44, R = 8, T = 12, B = 28, max = niceMax(Math.max(more * 1.08, ...weeks.map(w => w.met_minutes)));
  const y = (v: number) => T + (H - T - B) * (1 - v / max), bw = (W - L - R) / weeks.length, barW = Math.min(30, bw * 0.62);
  const ticks = [0, max / 2, max];
  return <section className="account-card wk-card" aria-labelledby="wk-bars-title">
    <div className="wk-card-head"><h2 id="wk-bars-title">Effort each week</h2><button className="account-secondary" aria-pressed={table} onClick={() => setTable(v => !v)}><Table2 size={16} aria-hidden="true" /> {table ? "Show chart" : "Show table"}</button></div>
    {present.length > 0 && <ul className="wk-legend">{present.map(k => <li key={k.id}><i className={`wk-sw wk-k-${k.id}`} aria-hidden="true" />{k.label}</li>)}</ul>}
    {table ? <WeeksTable weeks={weeks} /> : <div className="wk-chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Effort in MET-minutes for the last ${weeks.length} weeks. This week: ${weeks[weeks.length - 1].met_minutes}. The WHO guideline is ${minimum} to ${more}.`}>
        {ticks.map(v => <g key={v}><line className="wk-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text className="wk-axis" x={L - 6} y={y(v) + 4} textAnchor="end">{Math.round(v).toLocaleString()}</text></g>)}
        {weeks.map((w, i) => {
          const x = L + i * bw + (bw - barW) / 2; let top = w.met_minutes;
          const parts = KINDS.map(k => ({ k: k.id, v: w.by_kind[k.id] ?? 0 })).filter(s => s.v > 0);
          return <g key={w.start} className={hover === i ? "wk-bar is-hover" : "wk-bar"}>
            {parts.map((s, j) => { const y0 = y(top), h = Math.max(0, y(top - s.v) - y0); top -= s.v; return <rect key={s.k} className={`wk-k-${s.k}`} x={x} y={y0 + (j ? 1 : 0)} width={barW} height={Math.max(0, h - (j ? 1 : 0))} rx={j === 0 ? 4 : 0} />; })}
            {((W < 480 ? (weeks.length - 1 - i) % 3 === 0 : (weeks.length - 1 - i) % 2 === 0)) && <text className="wk-axis" x={x + barW / 2} y={H - 8} textAnchor="middle">{shortDate(w.start)}</text>}
            <rect className="wk-hit" x={L + i * bw} y={T} width={bw} height={H - T - B} tabIndex={0} role="img" aria-label={`Week of ${shortDate(w.start)}: ${w.met_minutes} MET-minutes, ${w.minutes} minutes, ${w.active_days} active days`}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          </g>;
        })}
        {[[minimum, "WHO minimum"], [more, "More benefits"]].map(([v, label]) => <g key={label as string}><line className="wk-ref" x1={L} x2={W - R} y1={y(v as number)} y2={y(v as number)} /><text className="wk-ref-label" x={W - R} y={y(v as number) - 5} textAnchor="end">{label} · {(v as number).toLocaleString()}</text></g>)}
      </svg>
      {hover !== null && <WeekTip week={weeks[hover]} left={(L + hover * bw + bw / 2) / W} />}
    </div>}
  </section>;
}

function WeekTip({ week: w, left }: { week: Week; left: number }) {
  return <div className="wk-tip" role="status" style={tipAt(left)}>
    <strong>Week of {shortDate(w.start)}</strong><span>{w.met_minutes.toLocaleString()} MET-minutes · {w.minutes} min · {w.active_days} active {w.active_days === 1 ? "day" : "days"}</span>
    {w.distance_m > 0 && <span>{(w.distance_m / 1000).toFixed(1)} km by GPS</span>}
    {KINDS.filter(k => (w.by_kind[k.id] ?? 0) > 0).map(k => <span key={k.id} className="wk-tip-row"><i className={`wk-sw wk-k-${k.id}`} aria-hidden="true" />{k.label}: {w.by_kind[k.id]?.toLocaleString()}</span>)}
  </div>;
}

function WeeksTable({ weeks }: { weeks: Week[] }) {
  return <div className="wk-table-wrap"><table className="wk-table"><caption className="sr-only">Effort each week</caption>
    <thead><tr><th scope="col">Week of</th><th scope="col">MET-minutes</th><th scope="col">Minutes</th><th scope="col">Active days</th><th scope="col">GPS km</th></tr></thead>
    <tbody>{[...weeks].reverse().map(w => <tr key={w.start}><th scope="row">{shortDate(w.start)}</th><td>{w.met_minutes.toLocaleString()}</td><td>{w.minutes}</td><td>{w.active_days}</td><td>{(w.distance_m / 1000).toFixed(1)}</td></tr>)}</tbody></table></div>;
}

/** Fitness and fatigue over the last 12 weeks: two lines on one axis (same unit), labelled at their ends, with a crosshair on hover. */
function TrendLines({ data }: { data: Trend }) {
  const days = data.trend.days, [at, setAt] = useState<number | null>(null), [box, W] = useWidth();
  const H = W < 480 ? 200 : 220, L = 36, R = 64, T = 14, B = 26;
  const max = niceMax(Math.max(10, ...days.map(d => Math.max(d.fitness, d.fatigue))));
  const x = (i: number) => L + (W - L - R) * i / Math.max(1, days.length - 1), y = (v: number) => T + (H - T - B) * (1 - v / max);
  const path = (key: "fitness" | "fatigue") => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const last = days[days.length - 1];
  const ends = useMemo(() => { const a = y(last.fitness), b = y(last.fatigue); return Math.abs(a - b) < 14 ? (a < b ? [a - 7, b + 7] : [a + 7, b - 7]) : [a, b]; }, [last]);  // labels never overlap
  if (!data.trend.enough_history) return <section className="account-card wk-card"><h2>Fitness and fatigue</h2><p>{data.trend.message}</p></section>;
  function move(e: React.PointerEvent<SVGSVGElement>) { const r = e.currentTarget.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W; setAt(Math.max(0, Math.min(days.length - 1, Math.round((px - L) / (W - L - R) * (days.length - 1))))); }
  const d = at !== null ? days[at] : null;
  return <section className="account-card wk-card" aria-labelledby="wk-trend-title">
    <h2 id="wk-trend-title">Fitness and fatigue</h2>
    <ul className="wk-legend"><li><i className="wk-sw wk-line-fitness" aria-hidden="true" />Fitness (6 weeks)</li><li><i className="wk-sw wk-line-fatigue" aria-hidden="true" />Fatigue (1 week)</li></ul>
    <div className="wk-chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Fitness ${Math.round(last.fitness)} and fatigue ${Math.round(last.fatigue)} today, over the last ${days.length} days.`} onPointerMove={move} onPointerLeave={() => setAt(null)}>
        {[0, max / 2, max].map(v => <g key={v}><line className="wk-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text className="wk-axis" x={L - 6} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g>)}
        {[0, Math.floor(days.length / 2), days.length - 1].map(i => <text key={i} className="wk-axis" x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}>{shortDate(days[i].day)}</text>)}
        <path className="wk-line wk-line-fatigue" d={path("fatigue")} /><path className="wk-line wk-line-fitness" d={path("fitness")} />
        <text className="wk-end" x={W - R + 6} y={ends[0] + 4}>Fitness</text><text className="wk-end" x={W - R + 6} y={ends[1] + 4}>Fatigue</text>
        {d && at !== null && <g><line className="wk-cross" x1={x(at)} x2={x(at)} y1={T} y2={H - B} /><circle className="wk-dot wk-line-fitness" cx={x(at)} cy={y(d.fitness)} r={4} /><circle className="wk-dot wk-line-fatigue" cx={x(at)} cy={y(d.fatigue)} r={4} /></g>}
      </svg>
      {d && at !== null && <div className="wk-tip" role="status" style={tipAt(x(at) / W)}><strong>{shortDate(d.day)}</strong><span>Fitness {Math.round(d.fitness)} · Fatigue {Math.round(d.fatigue)}</span><span>That day: {d.load.toLocaleString()} MET-minutes</span></div>}
    </div>
    <p className="rep-replay-note">Fitness rises slowly with steady training; fatigue rises and falls quickly. When fatigue sits well above fitness, an easier day helps you absorb the work.</p>
  </section>;
}
