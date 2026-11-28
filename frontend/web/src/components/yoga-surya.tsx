import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./account-session";
import { AsanaFigure } from "./yoga-studio";
import { markWorkoutActive } from "./app-updates";
import { SURYA, SURYA_CAUTION, SuryaTracker } from "@/lib/yoga/surya";
import { focusPerson } from "@/lib/pose/landmarks";
import type { PoseDetectionService } from "@/lib/pose/detection-service";
import type { PoseFrame } from "@/lib/pose/types";
import { bell, saveMindBody } from "@/lib/yoga/session";
import { say } from "@/lib/workout-coach";

const PACES = [{ id: "slow", seconds: 8 }, { id: "steady", seconds: 5 }, { id: "brisk", seconds: 3 }] as const;

/** Surya Namaskar: a timed, spoken guide through the 12 steps, or the camera follows you and counts rounds. */
export function SuryaNamaskar() {
  const { user } = useAccount();
  const [mode, setMode] = useState<"guide" | "camera">("guide"), [pace, setPace] = useState<(typeof PACES)[number]["id"]>("slow"), [rounds, setRounds] = useState(3), [voice, setVoice] = useState(true);
  const [running, setRunning] = useState(false), [step, setStep] = useState(0), [round, setRound] = useState(0), [score, setScore] = useState(0), [ok, setOk] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(""), [finished, setFinished] = useState(false);
  const video = useRef<HTMLVideoElement>(null), service = useRef<PoseDetectionService | null>(null), tracker = useRef(new SuryaTracker()), started = useRef(0), voiceRef = useRef(voice);
  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { markWorkoutActive(running); return () => markWorkoutActive(false); }, [running]);
  useEffect(() => () => service.current?.stop(video.current || undefined), []);
  // Guided mode: one step every few seconds, with its name and breath spoken.
  useEffect(() => {
    if (!running || mode !== "guide") return;
    const each = PACES.find(p => p.id === pace)!.seconds * 1000;
    let i = 0;
    const announce = (n: number) => { const s = SURYA[n % 12]; setStep(n % 12); setRound(Math.floor(n / 12)); if (voiceRef.current) say(`${s.name}. ${s.breath}.`); };
    announce(0);
    const timer = setInterval(() => { i++; if (i >= rounds * 12) { clearInterval(timer); finish(rounds); return; } announce(i); }, each);
    return () => clearInterval(timer);
  }, [running, mode, pace, rounds]); // eslint-disable-line react-hooks/exhaustive-deps -- finish reads refs and setters only
  function finish(done: number) { setRunning(false); setFinished(true); setRound(done); bell(); service.current?.stop(video.current || undefined); service.current = null; if (voiceRef.current) say(t("Well done. Rest in Shavasana for a minute.")); }
  function receive(raw: PoseFrame) {
    const r = tracker.current.update(focusPerson(raw));
    setScore(r.score); setOk(r.seen >= 0.5);
    if (r.advanced) { const next = SURYA[tracker.current.step]; setStep(tracker.current.step); setRound(tracker.current.rounds); if (voiceRef.current) say(`${next.name}. ${next.breath}.`);
      if (tracker.current.rounds >= rounds) finish(tracker.current.rounds); }
  }
  async function begin() {
    setError(""); setSaved(""); setFinished(false); setStep(0); setRound(0); started.current = performance.now(); tracker.current = new SuryaTracker(); bell(0.15);
    if (mode === "guide") { setRunning(true); return; }
    try {
      const { PoseDetectionService } = await import("@/lib/pose/detection-service");
      const controller = new PoseDetectionService(receive, message => { setError(message); stop(); }); service.current = controller;
      await controller.start(video.current!, "", "user", () => { setRunning(true); if (voiceRef.current) say(`${SURYA[0].name}. ${SURYA[0].breath}.`); });
    } catch (failure) { service.current?.stop(video.current || undefined); setError(failure instanceof Error ? t(failure.message) : t("Camera unavailable.")); }
  }
  function stop() { service.current?.stop(video.current || undefined); service.current = null; setRunning(false); setFinished(round > 0 || step > 0); }
  async function save() {
    setError("");
    const secs = (performance.now() - started.current) / 1000, avg = tracker.current.average;
    try { const xp = await saveMindBody("Surya Namaskar", "yoga_surya-namaskar", secs, mode === "camera" ? `${round} rounds followed by the camera, average match ${avg}/100.` : `${round} guided rounds.`); setSaved(xp ? t("Saved, +{earned} points.", { earned: xp }) : t("Saved.")); }
    catch (failure) { setError(failure instanceof Error ? t(failure.message) : t("Could not save. Try again.")); }
  }
  const current = SURYA[step];
  return <section className="yoga-surya">
    <article className="account-card">
      <h2>{t("Surya Namaskar (sun salutation)")}</h2>
      <p>{t("Twelve poses in one flowing sequence, each with its breath. One round is the twelve steps; the next round leads with the other leg.")}</p>
      <p className="yoga-avoid" role="note">{t(SURYA_CAUTION)}</p>
      <div className="yoga-choose">
        <div className="camera-equipment" role="group" aria-label={t("How to follow")}>
          <button type="button" aria-pressed={mode === "guide"} disabled={running} onClick={() => setMode("guide")}>{t("Spoken guide")}</button>
          <button type="button" aria-pressed={mode === "camera"} disabled={running || !user} onClick={() => setMode("camera")}>{t("Camera follows me")}</button>
        </div>
        {mode === "guide" && <label>{t("Pace")}<select value={pace} disabled={running} onChange={e => setPace(e.target.value as typeof pace)}>{PACES.map(p => <option key={p.id} value={p.id}>{t("{s} s per pose", { s: p.seconds })}</option>)}</select></label>}
        <label>{t("Rounds")}<select value={rounds} disabled={running} onChange={e => setRounds(Number(e.target.value))}>{[1, 2, 3, 6, 12].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="scanner-consent"><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> {t("Spoken cues")}</label>
      </div>
      {!user && <p className="camera-muscles">{t("Sign in to let the camera follow your rounds and save them.")}</p>}
    </article>
    <div className="yoga-detail-grid">
      <article className="account-card surya-now">
        <p className="yoga-count">{t("Round {n} of {total}", { n: Math.min(round + 1, rounds), total: rounds })}</p>
        <AsanaFigure asana={current.asana} size={180} />
        <h3>{current.name}</h3><p className="yoga-sanskrit">{current.asana.sanskrit} · {current.breath}</p>
        {mode === "camera" && running && <p role="status" className="yoga-tip">{ok ? t("Match {n}/100", { n: score }) : t("Move back until your whole body is in view.")}</p>}
        <ol className="surya-steps">{SURYA.map((s, i) => <li key={i} data-now={i === step || undefined} data-done={i < step || undefined}>{s.name}</li>)}</ol>
      </article>
      {mode === "camera" && <article className="account-card"><p className="camera-muscles">{t("Mat side-on to the camera, phone low, whole body in view.")}</p>
        <div className="camera-preview camera-mirrored"><video ref={video} autoPlay muted playsInline aria-label={t("Live yoga camera preview")} /></div></article>}
    </div>
    {error && <p role="alert" className="camera-alert">{error}</p>}
    <div className="account-actions">
      {!running ? <button className="account-primary" onClick={() => void begin()}>{finished ? t("Again") : t("Start")}</button> : <button className="account-primary" onClick={stop}>{t("Stop")}</button>}
      {finished && user && !saved && round > 0 && <button type="button" onClick={() => void save()}>{t("Save to my history")}</button>}
    </div>
    {finished && <p role="status">{t("{n} rounds done.", { n: round })} {saved}</p>}
  </section>;
}
