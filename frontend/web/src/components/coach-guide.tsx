// The coach for a camera exercise or sport: technique, common mistakes with fixes, easier and harder versions, safety and
// setup; and the report after a set. Content: lib/pose/coach.ts.
import { t, msg } from "@/lib/i18n";
import { useId, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Dumbbell, HeartPulse, ListOrdered, ShieldCheck, Target, Wind, XCircle } from "lucide-react";
import { EXERCISES, EXERCISE_DIFFICULTY, type ExerciseKind } from "@/lib/pose/types";
import { EXERCISE_CONFIG, type RejectionReason } from "@/lib/pose/exercise-config";
import { SAFETY, SET_FIX, SPORT_COACH, coachFor, patternOf } from "@/lib/pose/coach";
import { SPORTS } from "@/lib/sport-game";
import type { SportKind } from "@/lib/pose/sports";

type Tab = "how" | "mistakes" | "levels" | "safety";
const TABS: [Tab, string, typeof ListOrdered][] = [["how", msg("Technique"), ListOrdered], ["mistakes", msg("Common mistakes"), AlertTriangle],
  ["levels", msg("Easier & harder"), Dumbbell], ["safety", msg("Safety & setup"), ShieldCheck]];
const RANK = { easy: 0, medium: 1, hard: 2 } as const;

/** Other exercises of the same movement pattern, easier and harder than this one. */
function levels(kind: ExerciseKind) {
  const pattern = patternOf(kind), rank = RANK[EXERCISES[kind].difficulty as keyof typeof RANK] ?? 1;
  const same = (Object.keys(EXERCISES) as ExerciseKind[]).filter(k => k !== kind && patternOf(k) === pattern);
  const by = (test: (r: number) => boolean) => same.filter(k => test(RANK[EXERCISES[k].difficulty as keyof typeof RANK] ?? 1)).slice(0, 3);
  return { easier: by(r => r < rank), harder: by(r => r > rank) };
}

function Tabs({ tab, setTab, id, hide }: { tab: Tab; setTab: (t: Tab) => void; id: string; hide?: Tab[] }) {
  const shown = TABS.filter(([k]) => !hide?.includes(k));
  return <div className="coach-tabs" role="tablist" aria-label={t("Coach")}>{shown.map(([k, label, Icon]) =>
    <button key={k} role="tab" id={`${id}-${k}`} aria-selected={tab === k} aria-controls={`${id}-panel`} onClick={() => setTab(k)}
      onKeyDown={e => { const i = shown.findIndex(([x]) => x === k), n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (n) { e.preventDefault(); const next = shown[(i + n + shown.length) % shown.length][0]; setTab(next); document.getElementById(`${id}-${next}`)?.focus(); } }}
      tabIndex={tab === k ? 0 : -1}><Icon size={16} aria-hidden="true" /><span>{t(label)}</span></button>)}</div>;
}

function MistakeList({ items }: { items: { mistake: string; fix: string }[] }) {
  return <ul className="coach-mistakes">{items.map(m => <li key={m.mistake}>
    <p className="coach-wrong"><XCircle size={18} aria-hidden="true" /><span><span className="sr-only">{t("Mistake:")} </span>{m.mistake}</span></p>
    <p className="coach-right"><CheckCircle2 size={18} aria-hidden="true" /><span><span className="sr-only">{t("Fix:")} </span>{m.fix}</span></p></li>)}</ul>;
}

/** The coach for one camera exercise. onPick switches to an easier or harder exercise. */
export function CoachGuide({ kind, onPick }: { kind: ExerciseKind; onPick?: (kind: ExerciseKind) => void }) {
  const [tab, setTab] = useState<Tab>("how"), id = useId();
  const coach = coachFor(kind), info = EXERCISES[kind], config = EXERCISE_CONFIG[kind], lv = levels(kind);
  const Option = ({ k, dir }: { k: ExerciseKind; dir: "easier" | "harder" }) => {
    const Icon = dir === "easier" ? ArrowDownRight : ArrowUpRight, body = <><Icon size={16} aria-hidden="true" /><span>{EXERCISES[k].title}</span><small>{EXERCISE_DIFFICULTY[EXERCISES[k].difficulty as keyof typeof EXERCISE_DIFFICULTY]}</small></>;
    return onPick ? <button type="button" className={`coach-level coach-${dir}`} onClick={() => onPick(k)}>{body}</button> : <span className={`coach-level coach-${dir}`}>{body}</span>;
  };
  return <section className="coach-guide" data-pattern={patternOf(kind)} aria-labelledby={`${id}-title`}>
    <header className="coach-head"><span className="coach-badge" aria-hidden="true"><Target size={20} /></span>
      <div><span className="eyebrow">{t("YOUR COACH")} · {coach.title}</span><h3 id={`${id}-title`}>{info.title}</h3>
        <p className="coach-trains"><HeartPulse size={15} aria-hidden="true" /> {t("Works: {muscles}", { muscles: info.muscles })}</p></div></header>
    <Tabs tab={tab} setTab={setTab} id={id} />
    <div className="coach-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
      {tab === "how" && <><ol className="coach-steps">{coach.steps.map(s => <li key={s}>{s}</li>)}</ol>
        <p className="coach-cues"><strong>{t("Say it in your head:")}</strong> {config.cues.join(" → ")}</p>
        <p className="coach-breath"><Wind size={16} aria-hidden="true" /> {coach.breath}</p></>}
      {tab === "mistakes" && <MistakeList items={coach.mistakes} />}
      {tab === "levels" && <div className="coach-levels">
        <div><h4>{t("Easier")}</h4>{lv.easier.length ? lv.easier.map(k => <Option key={k} k={k} dir="easier" />) : <p>{t("This is the gentlest version. Make it easier with a smaller range or fewer reps.")}</p>}</div>
        <div><h4>{t("Harder")}</h4>{lv.harder.length ? lv.harder.map(k => <Option key={k} k={k} dir="harder" />) : <p>{t("This is the hardest version here. Make it harder with a slower lowering or a short pause at the bottom.")}</p>}</div></div>}
      {tab === "safety" && <><ul className="coach-safety">{SAFETY.map(s => <li key={s}>{t(s)}</li>)}</ul>
        <p className="coach-setup"><strong>{t("Camera setup:")}</strong> {info.setup} {config.camera.distance}</p>
        {config.tips.length > 0 && <ul className="coach-tips">{config.tips.map(s => <li key={s}>{s}</li>)}</ul>}</>}
    </div>
  </section>;
}

/** The coach for a sport game. */
export function SportCoachGuide({ kind }: { kind: SportKind }) {
  const [tab, setTab] = useState<Tab>("how"), id = useId(), coach = SPORT_COACH[kind], sport = SPORTS[kind];
  return <section className="coach-guide coach-sport" data-sport={kind} aria-labelledby={`${id}-title`}>
    <header className="coach-head"><span className="coach-badge" aria-hidden="true"><Target size={20} /></span>
      <div><span className="eyebrow">{t("YOUR COACH")}</span><h3 id={`${id}-title`}>{sport.title}</h3>
        <p className="coach-trains"><HeartPulse size={15} aria-hidden="true" /> {coach.trains}</p></div></header>
    <Tabs tab={tab} setTab={setTab} id={id} hide={["levels"]} />
    <div className="coach-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
      {tab === "how" && <><ol className="coach-steps">{coach.steps.map(s => <li key={s}>{s}</li>)}</ol>
        <p className="coach-cues"><strong>{t("Say it in your head:")}</strong> {sport.cues.join(" → ")}</p>
        <p className="coach-breath"><Dumbbell size={16} aria-hidden="true" /> {coach.drill}</p></>}
      {tab === "mistakes" && <MistakeList items={coach.mistakes} />}
      {tab === "safety" && <><ul className="coach-safety"><li>{coach.safety}</li>{SAFETY.slice(0, 1).map(s => <li key={s}>{t(s)}</li>)}</ul>
        <p className="coach-setup"><strong>{t("Camera setup:")}</strong> {sport.camera}</p></>}
    </div>
  </section>;
}

const REASON_LABEL: Record<RejectionReason, string> = { too_shallow: msg("Not deep enough"), too_fast: msg("Too fast"), too_slow: msg("Too slow"),
  lost_tracking: msg("Out of view"), wrong_exercise: msg("Different movement") };

export type SetResult = { kind: ExerciseKind; reps: number; missed: Record<RejectionReason, number> };

/** After a set: reps counted, reps missed by reason, and the one thing to fix next time. */
export function SetReport({ result }: { result: SetResult }) {
  const missed = (Object.entries(result.missed) as [RejectionReason, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = missed.reduce((s, [, n]) => s + n, 0), top = missed[0]?.[0];
  const share = result.reps + total ? Math.round(result.reps / (result.reps + total) * 100) : 0;
  return <section className="account-card set-report" aria-labelledby="set-report-title">
    <h2 id="set-report-title">{t("Set report")}</h2>
    <div className="set-report-stats">
      <div className="set-good"><strong>{result.reps}</strong><span>{t("reps counted")}</span></div>
      <div className={`set-missed${total ? "" : " is-zero"}`}><strong>{total}</strong><span>{t("not counted")}</span></div>
      <div className="set-share"><strong>{share}%</strong><span>{t("clean reps")}</span></div>
    </div>
    {missed.length > 0 && <ul className="set-reasons">{missed.map(([r, n]) => <li key={r}>{t(REASON_LABEL[r])}<b>{n}</b></li>)}</ul>}
    <p className="set-fix"><Target size={18} aria-hidden="true" /><span><strong>{t("One thing to fix:")}</strong> {top ? t(SET_FIX[top]) : result.reps
      ? t("Every rep counted. Next set, keep the same control and add one or two reps.") : t("No reps yet. Check the camera view and start from the top position.")}</span></p>
    <p className="set-breath"><Wind size={16} aria-hidden="true" /> {coachFor(result.kind).breath}</p>
  </section>;
}
