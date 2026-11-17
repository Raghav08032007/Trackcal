// Design-system data displays: activity rings, the Health Score dial and a lab result on its normal range.
import { t, msg, localized } from "@/lib/i18n";
import { useEffect, useState } from "react";

/** Fills from empty on first show, so the eye follows the progress; instant under reduced motion. */
function useGrow(value: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(id); }, [value]);
  return shown;
}

export type Ring = { label: string; value: number; goal: number; unit: string; color: string };
/** Move, eat and recover as three nested rings. A closed ring glows. */
export function ActivityRings({ rings }: { rings: Ring[] }) {
  const size = 168, stroke = 16, gap = 4;
  const shares = rings.map(r => Math.min(1, r.goal ? r.value / r.goal : 0)), grown = useGrow(1);
  return <div className="ds-rings">
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map(r => `${r.label} ${r.value} of ${r.goal} ${r.unit}`).join(", ")}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap), length = 2 * Math.PI * radius;
        return <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle className="ds-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
          <circle className="ds-ring" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke={r.color} style={{ color: r.color, strokeDasharray: length, strokeDashoffset: length * (1 - shares[i] * grown) }} data-closed={shares[i] >= 1 || undefined} />
        </g>;
      })}
    </svg>
    <dl className="ds-ring-legend">{rings.map(r => <div key={r.label}><dt><span className="ds-dot" style={{ background: r.color }} />{r.label}</dt><dd>{r.value}/{r.goal} {r.unit}</dd></div>)}</dl>
  </div>;
}

const BANDS: [number, string, string][] = [[750, msg("Excellent"), "good"], [650, msg("Good"), "good"], [550, msg("Fair"), "watch"], [0, msg("Needs care"), "alert"]];
localized(BANDS, ["1"]);
/** The TrackCal Health Score, 300 to 900, on a 240° dial. */
export function ScoreDial({ score, change }: { score: number; change?: number }) {
  const share = Math.max(0, Math.min(1, (score - 300) / 600)), grown = useGrow(share);
  const r = 100, arc = (240 / 360) * 2 * Math.PI * r, [, band, tone] = BANDS.find(([min]) => score >= min)!;
  return <div className="ds-dial">
    <svg viewBox="0 0 240 200" role="img" aria-label={t("Health Score {score} out of 900, {band}", { score, band })}>
      <defs><linearGradient id="ds-dial-grad" x1="0" x2="1"><stop offset="0" stopColor="#ff6b57" /><stop offset=".45" stopColor="#ffa424" /><stop offset="1" stopColor="#16a36a" /></linearGradient></defs>
      <g transform="rotate(150 120 120)">
        <circle className="ds-dial-track" cx="120" cy="120" r={r} strokeDasharray={`${arc} 999`} />
        <circle className="ds-dial-fill" cx="120" cy="120" r={r} stroke="url(#ds-dial-grad)" strokeDasharray={`${arc} 999`} style={{ strokeDashoffset: arc * (1 - grown) }} />
      </g>
      <text className="ds-dial-num" x="120" y="128" textAnchor="middle">{score}</text>
      <text className="ds-dial-label" x="120" y="152" textAnchor="middle">{t("HEALTH SCORE")}</text>
    </svg>
    <span className="ds-status ds-dial-band" data-tone={tone}>{band}{change ? t(" · {n}{change} since last report", { n: change > 0 ? "+" : "", change }) : ""}</span>
  </div>;
}

export type LabResult = { name: string; value: number; unit: string; low: number; high: number; min: number; max: number; previous?: number; note: string };
/** A lab value on its normal range, with the previous report's value for the trend. */
export function LabRangeBar({ lab }: { lab: LabResult }) {
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - lab.min) / (lab.max - lab.min)) * 100))}%`;
  const inRange = lab.value >= lab.low && lab.value <= lab.high, far = lab.value > lab.high * 1.3 || lab.value < lab.low * .7;
  const tone = inRange ? "good" : far ? "alert" : "watch", word = inRange ? t("Normal") : lab.value > lab.high ? t("High") : t("Low");
  const shown = useGrow(lab.value) || lab.min;
  const trend = lab.previous === undefined ? "" : lab.value === lab.previous ? t("→ same as last time") : (lab.value < lab.previous ? t("↓ from {n}", { n: lab.previous }) : t("↑ from {n}", { n: lab.previous }));
  return <div className="ds-lab">
    <div className="ds-lab-head"><div><strong>{lab.name}</strong> <span className="ds-status" data-tone={tone}>{word}</span></div><span className="ds-lab-value">{lab.value} <small>{lab.unit}</small></span></div>
    <div className="ds-lab-track" role="img" aria-label={t("{name} {value} {unit}; normal {low} to {high}", { name: lab.name, value: lab.value, unit: lab.unit, low: lab.low, high: lab.high })}>
      <span className="ds-lab-normal" style={{ left: at(lab.low), width: `calc(${at(lab.high)} - ${at(lab.low)})` }} />
      {lab.previous !== undefined && <span className="ds-lab-prev" style={{ left: at(lab.previous) }} />}
      <span className="ds-lab-marker" style={{ left: at(shown), background: tone === "good" ? "var(--ds-green)" : tone === "alert" ? "var(--ds-red)" : "var(--ds-amber)" }} />
    </div>
    <div className="ds-lab-scale"><span>{lab.min}</span><span>{t("Normal {low}–{high}", { low: lab.low, high: lab.high })}</span><span>{lab.max}</span></div>
    <p className="ds-lab-note">{trend && <strong>{trend}. </strong>}{lab.note}</p>
  </div>;
}
