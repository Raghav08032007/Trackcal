import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./account-session";
import { DURATIONS, MEDITATIONS, MEDITATION_BY_ID, promptsBetween } from "@/lib/yoga/meditation";
import { bell, saveMindBody } from "@/lib/yoga/session";
import { say } from "@/lib/workout-coach";

/** Meditation: a silent timer or a guided session, spoken in the app's language, with a bell at the start and end. */
export function MeditationTimer() {
  const { user } = useAccount();
  const [id, setId] = useState("breath"), [minutes, setMinutes] = useState(5), [voice, setVoice] = useState(true);
  const [running, setRunning] = useState(false), [paused, setPaused] = useState(false), [elapsed, setElapsed] = useState(0), [done, setDone] = useState(false), [line, setLine] = useState(""), [saved, setSaved] = useState(""), [error, setError] = useState("");
  const med = MEDITATION_BY_ID[id], base = useRef(0), last = useRef(0), elapsedRef = useRef(0);
  useEffect(() => {
    if (!running || paused) return;
    const timer = setInterval(() => {
      const ms = base.current + (performance.now() - last.current), total = minutes * 60000;
      for (const p of promptsBetween(med, minutes, elapsedRef.current, ms)) { setLine(p.text); if (voice) say(p.text); }
      elapsedRef.current = ms; setElapsed(ms);
      if (ms >= total) { setRunning(false); setDone(true); bell(); setLine(t("Gently open your eyes.")); }
    }, 250);
    return () => clearInterval(timer);
  }, [running, paused, med, minutes, voice]);
  function begin() { base.current = 0; last.current = performance.now(); elapsedRef.current = -1; setElapsed(0); setDone(false); setSaved(""); setLine(""); setPaused(false); setRunning(true); bell(); }
  function pause() { if (paused) { last.current = performance.now(); setPaused(false); } else { base.current = elapsedRef.current; setPaused(true); } }
  async function save() {
    setError("");
    try { const xp = await saveMindBody(med.name, `meditation_${med.id}`, elapsed / 1000, `Meditation, ${Math.round(elapsed / 60000)} min.`); setSaved(xp ? t("Saved, +{earned} points.", { earned: xp }) : t("Saved.")); }
    catch (failure) { setError(failure instanceof Error ? t(failure.message) : t("Could not save. Try again.")); }
  }
  const total = minutes * 60000, left = Math.max(0, total - elapsed), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
  return <section className="yoga-meditation account-card">
    <div className="yoga-choose">
      <label>{t("Meditation")}<select value={id} disabled={running} onChange={e => setId(e.target.value)}>{MEDITATIONS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>{t("Length")}<select value={minutes} disabled={running} onChange={e => setMinutes(Number(e.target.value))}>{DURATIONS.map(m => <option key={m} value={m}>{t("{n} min", { n: m })}</option>)}</select></label>
      {med.prompts.length > 0 && <label className="scanner-consent"><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> {t("Spoken guidance")}</label>}
    </div>
    <p>{med.about}</p>
    <div className="meditation-stage" data-running={running && !paused || undefined} style={{ "--done": total ? elapsed / total : 0 } as React.CSSProperties}>
      <div className="meditation-ring" role="timer" aria-label={t("{m} minutes {s} seconds left", { m: mm, s: ss })}><strong>{mm}:{String(ss).padStart(2, "0")}</strong></div>
    </div>
    <p className="meditation-line" role="status" aria-live="polite">{line || (running ? "" : t("Find a quiet place and sit or lie comfortably."))}</p>
    {error && <p role="alert" className="camera-alert">{error}</p>}
    <div className="account-actions">
      {!running ? <button className="account-primary" onClick={begin}>{done ? t("Again") : t("Begin")}</button>
        : <><button className="account-primary" onClick={pause}>{paused ? t("Resume") : t("Pause")}</button><button type="button" onClick={() => { setRunning(false); setDone(elapsedRef.current >= 60000); }}>{t("End")}</button></>}
      {done && user && !saved && elapsed >= 60000 && <button type="button" onClick={() => void save()}>{t("Save to my history")}</button>}
    </div>
    {saved && <p role="status">{saved}</p>}
  </section>;
}
