import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./account-session";
import { BREATHS, BREATH_BY_ID, circleSize, cycleSeconds, phaseAt, type Breath } from "@/lib/yoga/breathing";
import { bell, saveMindBody } from "@/lib/yoga/session";
import { say } from "@/lib/workout-coach";

const MINUTES = [1, 2, 3, 5, 10];

/** Guided breathing: an animated circle, the count, and spoken cues at each change. */
export function BreathingCoach() {
  const { user } = useAccount();
  const [id, setId] = useState(BREATHS[0].id), [minutes, setMinutes] = useState(3), [voice, setVoice] = useState(true);
  const [running, setRunning] = useState(false), [elapsed, setElapsed] = useState(0), [done, setDone] = useState(false), [saved, setSaved] = useState(""), [error, setError] = useState("");
  const breath: Breath = BREATH_BY_ID[id], start = useRef(0), lastPhase = useRef(-1), size = useRef(0.35);
  const limit = Math.min(minutes * 60, breath.maxCycles ? breath.maxCycles * cycleSeconds(breath) : Infinity) * 1000;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      const ms = performance.now() - start.current;
      if (ms >= limit) { setElapsed(limit); setRunning(false); setDone(true); bell(); if (voice) say(t("Well done. Breathe normally.")); return; }
      const at = phaseAt(breath, ms), key = at.cycle * 10 + at.index;
      if (key !== lastPhase.current) { lastPhase.current = key; if (voice) say(at.phase.say); }
      setElapsed(ms); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, breath, limit, voice]);
  const at = phaseAt(breath, elapsed), scale = running ? circleSize(at.phase.kind, at.progress, size.current) : done ? 0.35 : 0.5;
  size.current = scale;
  const left = Math.max(0, Math.ceil((limit - elapsed) / 1000));
  async function save() {
    setError("");
    try { const xp = await saveMindBody(breath.name, `breath_${breath.id}`, elapsed / 1000, `Guided breathing, ${Math.round(elapsed / 1000)} s.`); setSaved(xp ? t("Saved, +{earned} points.", { earned: xp }) : t("Saved.")); }
    catch (failure) { setError(failure instanceof Error ? t(failure.message) : t("Could not save. Try again.")); }
  }
  return <section className="yoga-breathing account-card">
    <div className="yoga-choose">
      <label>{t("Technique")}<select value={id} disabled={running} onChange={e => { setId(e.target.value); setDone(false); setSaved(""); }}>{BREATHS.map(b => <option key={b.id} value={b.id}>{b.name}{b.sanskrit ? ` · ${b.sanskrit}` : ""}</option>)}</select></label>
      <label>{t("Length")}<select value={minutes} disabled={running} onChange={e => setMinutes(Number(e.target.value))}>{MINUTES.map(m => <option key={m} value={m}>{t("{n} min", { n: m })}</option>)}</select></label>
      <label className="scanner-consent"><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> {t("Spoken cues")}</label>
    </div>
    <p>{breath.about}</p>
    {breath.caution && <p className="yoga-avoid" role="note">{breath.caution}</p>}
    {breath.maxCycles && <p className="camera-muscles">{t("Beginners: stop after {n} rounds.", { n: breath.maxCycles })}</p>}
    <div className="breath-stage" aria-hidden={!running}>
      <div className="breath-circle" data-kind={running ? at.phase.kind : "idle"} style={{ transform: `scale(${scale})` }} />
      <div className="breath-label" role="status" aria-live="polite">
        {running ? <><strong>{at.phase.say}</strong><span>{at.left}</span>{at.phase.detail && <small>{at.phase.detail}</small>}</> : done ? <strong>{t("Finished")}</strong> : <strong>{t("Ready")}</strong>}
      </div>
    </div>
    {running && <p className="yoga-count">{t("Round {n}", { n: at.cycle })} · {t("{s} s left", { s: left })}</p>}
    {error && <p role="alert" className="camera-alert">{error}</p>}
    <div className="account-actions">
      {!running ? <button className="account-primary" onClick={() => { start.current = performance.now(); lastPhase.current = -1; setElapsed(0); setDone(false); setSaved(""); setRunning(true); bell(0.15); }}>{done ? t("Again") : t("Start")}</button>
        : <button className="account-primary" onClick={() => { setRunning(false); setDone(elapsed > 30000); }}>{t("Stop")}</button>}
      {done && user && !saved && elapsed >= 60000 && <button type="button" onClick={() => void save()}>{t("Save to my history")}</button>}
    </div>
    {saved && <p role="status">{saved}</p>}
  </section>;
}
