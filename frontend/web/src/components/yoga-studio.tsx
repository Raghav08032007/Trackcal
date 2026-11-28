import { msg, t } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "./account-session";
import { Celebration } from "./celebration";
import { CoachLine } from "./coach-card";
import { MoveDemo } from "./exercise-demo";
import { markWorkoutActive } from "./app-updates";
import { ASANAS, ASANA_BY_ID, FAMILIES, LEVELS, moveOf, type Asana, type AsanaFamily, type AsanaLevel } from "@/lib/yoga/asanas";
import { AsanaTracker, GOOD, IN_POSE, demoPoints, type YogaLive } from "@/lib/yoga/score";
import { focusPerson } from "@/lib/pose/landmarks";
import type { PoseDetectionService } from "@/lib/pose/detection-service";
import type { PoseFrame } from "@/lib/pose/types";
import { say, stepMinutes } from "@/lib/workout-coach";
import { wellnessRequest, type Session } from "@/lib/wellness";
import { BreathingCoach } from "./yoga-breathing";
import { useExerciseSafety } from "@/lib/exercise-safety";
import { SafetyGate, SafetyNotice } from "./safety-gate";
import { MeditationTimer } from "./yoga-meditation";
import { SuryaNamaskar } from "./yoga-surya";

type Tab = "asanas" | "surya" | "breathing" | "meditation";
const TABS: [Tab, string][] = [["asanas", msg("Asanas")], ["surya", msg("Surya Namaskar")], ["breathing", msg("Breathing")], ["meditation", msg("Meditation")]];

const query = () => typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

/** Yoga, breathing and meditation. The library and the guides work for everyone; the camera practice saves to your account. */
export function YogaStudio() {
  const [tab, setTab] = useState<Tab>(() => { const q = query().get("tab"); return TABS.some(([id]) => id === q) ? q as Tab : "asanas"; });
  const [chosen, setChosen] = useState<Asana | null>(() => ASANA_BY_ID[query().get("asana") ?? ""] ?? null);
  const pick = (next: Tab) => { setTab(next); setChosen(null); try { const q = query(); q.set("tab", next); q.delete("asana"); history.replaceState(null, "", `?${q}`); } catch { /* no history */ } };
  const open = (a: Asana | null) => { setChosen(a); try { const q = query(); if (a) q.set("asana", a.id); else q.delete("asana"); history.replaceState(null, "", `?${q}`); } catch { /* no history */ } };
  return <main className="wellness-page yoga-page">
    <section className="camera-intro"><span className="eyebrow">{t("YOGA · BREATHING · MEDITATION")}</span><h1>{t("Yoga")}</h1>
      <p>{t("Learn each pose step by step. With the camera on, you get a live match score out of 100 and one simple correction at a time. Video stays on your device.")}</p></section>
    <div className="yoga-tabs" role="tablist" aria-label={t("Yoga sections")}>
      {TABS.map(([id, label]) => <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => pick(id)}>{t(label)}</button>)}
    </div>
    {tab === "asanas" && (chosen ? <AsanaDetail key={chosen.id} asana={chosen} onBack={() => open(null)} onOpen={open} /> : <Library onOpen={open} />)}
    {tab === "surya" && <SuryaNamaskar />}
    {tab === "breathing" && <BreathingCoach />}
    {tab === "meditation" && <MeditationTimer />}
  </main>;
}

/** A small drawing of the pose, from the same points the camera compares against. */
export function AsanaFigure({ asana, size = 96 }: { asana: Asana; size?: number }) {
  const lines = useMemo(() => {
    const p = demoPoints(asana), xs = p.slice(11).map(l => l.x), ys = p.slice(11).map(l => l.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), k = 0.8 / Math.max(x1 - x0, y1 - y0, 0.01);
    const at = (i: number) => [0.5 + (p[i].x - (x0 + x1) / 2) * k, 0.55 + (p[i].y - (y0 + y1) / 2) * k];
    const bones = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
    const s = at(11), s2 = at(12), h = at(23), h2 = at(24), mid = [(s[0] + s2[0]) / 2, (s[1] + s2[1]) / 2], hip = [(h[0] + h2[0]) / 2, (h[1] + h2[1]) / 2];
    const d = Math.hypot(mid[0] - hip[0], mid[1] - hip[1]) || 1, head = [mid[0] + (mid[0] - hip[0]) / d * 0.08, mid[1] + (mid[1] - hip[1]) / d * 0.08];
    return { bones: bones.map(([a, b]) => [at(a), at(b), a % 2 === 0 && b % 2 === 0 && a > 12]), head };
  }, [asana]);
  return <svg className="asana-figure" viewBox="0 0 1 1" width={size} height={size} role="img" aria-label={asana.english}>
    {lines.bones.map(([a, b, right], i) => <line key={i} x1={(a as number[])[0]} y1={(a as number[])[1]} x2={(b as number[])[0]} y2={(b as number[])[1]} data-right={right || undefined} />)}
    <circle cx={lines.head[0]} cy={lines.head[1]} r={0.055} />
  </svg>;
}

function Library({ onOpen }: { onOpen: (a: Asana) => void }) {
  const [family, setFamily] = useState<AsanaFamily | "all">("all"), [level, setLevel] = useState<AsanaLevel | 0>(0), [text, setText] = useState("");
  const shown = ASANAS.filter(a => (family === "all" || a.family === family) && (!level || a.level === level)
    && (!text.trim() || `${a.sanskrit} ${a.english}`.toLowerCase().includes(text.trim().toLowerCase())));
  return <section className="yoga-library">
    <div className="yoga-filters">
      <input type="search" value={text} onChange={e => setText(e.target.value)} placeholder={t("Search, e.g. tree or vrikshasana")} aria-label={t("Search asanas")} />
      <div className="camera-equipment" role="group" aria-label={t("Kind of pose")}>
        <button type="button" aria-pressed={family === "all"} onClick={() => setFamily("all")}>{t("All")}</button>
        {(Object.keys(FAMILIES) as AsanaFamily[]).map(f => <button key={f} type="button" aria-pressed={family === f} onClick={() => setFamily(f)}>{FAMILIES[f]}</button>)}
      </div>
      <div className="camera-equipment" role="group" aria-label={t("Level")}>
        <button type="button" aria-pressed={!level} onClick={() => setLevel(0)}>{t("Any level")}</button>
        {([1, 2, 3] as AsanaLevel[]).map(l => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{LEVELS[l]}</button>)}
      </div>
    </div>
    <p className="yoga-count" role="status">{t("{n} poses", { n: shown.length })}</p>
    <ul className="yoga-grid">
      {shown.map(a => <li key={a.id}><button type="button" className="yoga-card" onClick={() => onOpen(a)}>
        <AsanaFigure asana={a} />
        <span className="yoga-card-text"><strong>{a.english}</strong><em>{a.sanskrit}</em><small data-level={a.level}>{LEVELS[a.level]} · {FAMILIES[a.family]}</small></span>
      </button></li>)}
    </ul>
    {!shown.length && <p>{t("No poses match. Try another filter.")}</p>}
  </section>;
}

function AsanaDetail({ asana, onBack, onOpen }: { asana: Asana; onBack: () => void; onOpen: (a: Asana) => void }) {
  const { ready, user } = useAccount();
  return <section className="yoga-detail">
    <button type="button" className="ds-btn ds-btn-quiet yoga-back" onClick={onBack}>{t("← All poses")}</button>
    <div className="yoga-detail-grid">
      <article className="account-card">
        <h2>{asana.english}</h2><p className="yoga-sanskrit">{asana.sanskrit} · {LEVELS[asana.level]} · {FAMILIES[asana.family]}</p>
        <MoveDemo move={moveOf(asana)} gear="body" title={asana.english} cues={[asana.breath]} />
        <h3>{t("How to do it")}</h3><ol className="yoga-steps">{asana.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <p><strong>{t("Benefits:")}</strong> {asana.benefits}</p>
        <p><strong>{t("Breathing:")}</strong> {asana.breath}</p>
        <p><strong>{t("Easier version:")}</strong> {asana.easier}</p>
        <p className="yoga-avoid" role="note"><strong>{t("Who should avoid it:")}</strong> {asana.avoid}</p>
        <p className="yoga-hold">{asana.sides ? t("Hold about {n} seconds on each side.", { n: asana.hold }) : t("Hold about {n} seconds.", { n: asana.hold })}</p>
      </article>
      {!ready ? <article className="account-card">{t("Loading…")}</article> : user ? <Practice key={user.id + asana.id} asana={asana} onSwitch={onOpen} />
        : <article className="account-card"><h2>{t("Check your pose with the camera")}</h2><p>{t("Sign in to get a live match score and spoken corrections, and to save your practice.")}</p><Link className="gate-primary" href="/login">{t("Sign in")}</Link></article>}
    </div>
  </section>;
}

type Status = "setup" | "loading" | "live" | "review" | "saved";
const seconds = (ms: number) => Math.floor(ms / 1000);
const EMPTY: YogaLive = { score: 0, visible: false, inPose: false, held: 0, current: 0, best: 0, average: 0, tip: null };

/** Camera practice for one asana: live match score, hold timer (only while matching), one correction at a time. */
function Practice({ asana, onSwitch }: { asana: Asana; onSwitch?: (a: Asana) => void }) {
  const safety = useExerciseSafety(), template = `yoga_${asana.id}`, advice = safety.adviceForTemplate(template), [gate, setGate] = useState(false);
  const safer = ASANAS.filter(a => a.id !== asana.id && a.family === asana.family && !safety.adviceForTemplate(`yoga_${a.id}`)).slice(0, 3).map(a => ({ id: a.id, title: a.english }));
  const video = useRef<HTMLVideoElement>(null), service = useRef<PoseDetectionService | null>(null), tracker = useRef(new AsanaTracker(asana));
  const started = useRef(0), voiceRef = useRef(false), spokenTip = useRef<string | null>(null), cheered = useRef(false), stats = useRef({ frames: 0, seen: 0 });
  const [status, setStatus] = useState<Status>("setup"), [live, setLive] = useState<YogaLive>(EMPTY), [error, setError] = useState(""), [voice, setVoice] = useState(true);
  const [target, setTarget] = useState(asana.hold), [busy, setBusy] = useState(false), [earned, setEarned] = useState(0), [readCaution, setReadCaution] = useState(asana.level === 1);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { markWorkoutActive(status === "loading" || status === "live"); return () => markWorkoutActive(false); }, [status]);
  useEffect(() => { const hide = () => { if (document.hidden) stop(); }; document.addEventListener("visibilitychange", hide); return () => { document.removeEventListener("visibilitychange", hide); service.current?.stop(video.current || undefined); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps -- stop reads refs only

  function receive(raw: PoseFrame) {
    const r = tracker.current.update(focusPerson(raw));
    stats.current.frames++; if (r.visible) stats.current.seen++;
    setLive(r);
    if (voiceRef.current && r.tip && r.tip !== spokenTip.current) { spokenTip.current = r.tip; say(r.tip); }
    if (!r.tip) spokenTip.current = null;
    if (!cheered.current && r.current >= target * 1000) { cheered.current = true; try { navigator.vibrate?.([60, 40, 60]); } catch { /* not supported */ } if (voiceRef.current) say(t("Well held. Release slowly.")); }
  }
  async function start() {
    setError(""); setStatus("loading"); tracker.current = new AsanaTracker(asana); stats.current = { frames: 0, seen: 0 }; cheered.current = false; spokenTip.current = null; started.current = performance.now();
    try {
      const { PoseDetectionService } = await import("@/lib/pose/detection-service");
      const controller = new PoseDetectionService(receive, message => { setError(message); stop(); }); service.current = controller;
      await controller.start(video.current!, "", "user", () => { setStatus("live"); if (voiceRef.current) say(asana.setup); });
    } catch (failure) { service.current?.stop(video.current || undefined); setStatus("setup"); setError(failure instanceof Error ? t(failure.message) : t("Camera unavailable.")); }
  }
  function stop() { service.current?.stop(video.current || undefined); service.current = null; setStatus(s => s === "live" || s === "loading" ? (tracker.current.best > 0 ? "review" : "setup") : s); }
  async function save() {
    if (busy || seconds(tracker.current.best) < 3) return; setBusy(true); setError("");
    try {
      const id = crypto.randomUUID(), best = Math.round(tracker.current.best / 100) / 10, avg = live.average;
      const opened = await wellnessRequest<{ session: Session }>("sessions", { id, name: `${asana.english} · yoga`, exercises: [`yoga_${asana.id}`], tracking_method: "camera" });
      const result = await wellnessRequest<{ awarded_xp: number }>("sessions/" + id, { revision: opened.session.revision, action: "complete", minutes: stepMinutes((performance.now() - started.current) / 1000),
        notes: `Best hold ${best} s, average match ${avg}/100, checked by the camera on this device. Not a medical or safety assessment.`,
        exercises: [{ exercise_id: `yoga_${asana.id}`, sets: [{ reps: 0, load: 0, minutes: Math.round(best / 60 * 100) / 100 }] }] }, "PUT");
      setEarned(result.awarded_xp); setStatus("saved");
    } catch (failure) { setError(failure instanceof Error ? t(failure.message) : t("Could not save. Try again.")); }
    finally { setBusy(false); }
  }
  const progress = Math.min(1, live.current / (target * 1000)), band = live.score >= GOOD ? "good" : live.score >= IN_POSE ? "ok" : "low";
  const message = status === "live" ? (!live.visible ? t("Move back until your whole body is in view.") : live.tip ?? (live.score >= GOOD ? t("Lovely. Hold steady and breathe.") : t("Getting there. Follow the demo."))) : status === "loading" ? t("Starting the camera…") : t("Camera off");
  return <article className="account-card yoga-practice">
    <h2>{t("Practise with the camera")}</h2>
    <p className="camera-muscles"><strong>{t("Set up:")}</strong> {asana.setup}</p>
    {asana.unseen && <p className="camera-muscles">{asana.unseen}</p>}
    {error && <p role="alert" className="camera-alert">{error}</p>}
    <div className="camera-preview camera-mirrored"><video ref={video} autoPlay muted playsInline aria-label={t("Live yoga camera preview")} />
      {status === "live" && <div className="yoga-score" data-band={band} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={live.score} aria-label={t("Pose match")}>
        <strong>{live.visible ? live.score : "–"}</strong><small>{t("match")}</small></div>}
      {status === "live" && <div className="hold-ring" data-in={live.inPose || undefined} data-done={live.current >= target * 1000 || undefined} style={{ "--hold": progress } as React.CSSProperties} role="timer" aria-live="off" aria-label={t("{n} of {target} seconds", { n: seconds(live.current), target })}><strong>{seconds(live.current)}</strong><small>{t("of {target} s", { target })}</small></div>}
    </div>
    <p role="status" className="hold-status yoga-tip">{message}</p>
    {status === "setup" && <>
      <label>{t("Hold for")}<select value={target} onChange={e => setTarget(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60, 90, 180].map(v => <option key={v} value={v}>{t("{value} seconds", { value: v })}</option>)}</select></label>
      <label className="scanner-consent"><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> {t("Speak corrections out loud")}</label>
      {asana.level > 1 && <label className="scanner-consent yoga-caution"><input type="checkbox" checked={readCaution} onChange={e => setReadCaution(e.target.checked)} /> {t("I have read who should avoid this pose, and I will stop if anything hurts.")}</label>}
      {advice && <SafetyNotice advice={advice} accepted={safety.acceptedTemplate(template)} />}
      {gate && advice && <SafetyGate title={asana.english} template={template} advice={advice} safer={safer} onSafer={id => { setGate(false); const next = ASANA_BY_ID[id]; if (next) onSwitch?.(next); }} onContinue={() => { setGate(false); void start(); }} onClose={() => setGate(false)} />}
      <button className="account-primary" disabled={!readCaution} onClick={() => { if (advice && !safety.acceptedTemplate(template)) { setGate(true); return; } void start(); }}>{t("Start {title}", { title: asana.english })}</button>
    </>}
    {(status === "live" || status === "loading") && <button className="account-primary" onClick={stop}>{t("Stop")}</button>}
    {status === "review" && <div className="hold-review">
      <h3>{t("Best hold: {n} s", { n: seconds(live.best) })}</h3>
      <p>{t("Average match while holding: {n}/100.", { n: live.average })} {live.average >= GOOD ? t("Very close to the demo.") : live.average >= IN_POSE ? t("Good. The tips will bring you closer.") : t("Keep practising; follow the steps slowly.")}</p>
      {seconds(live.best) < 3 && <p>{t("Holds of 3 seconds or more can be saved.")}</p>}
      <div className="account-actions">{seconds(live.best) >= 3 && <button className="account-primary" disabled={busy} onClick={() => void save()}>{busy ? t("Saving…") : t("Save practice")}</button>}
        <button type="button" onClick={() => { setStatus("setup"); setLive(EMPTY); }}>{t("Try again")}</button></div>
    </div>}
    {status === "saved" && <div className="celebration-host"><Celebration /><CoachLine text={earned ? t("{pose} saved, +{earned} points. Well done!", { pose: asana.english, earned }) : t("{pose} saved. Well done!", { pose: asana.english })} />
      <button type="button" onClick={() => { setStatus("setup"); setLive(EMPTY); }}>{t("Practise again")}</button></div>}
    <p className="rep-replay-note">{t("Video stays on your device. Only the time held and the match score are saved.")}</p>
  </article>;
}
