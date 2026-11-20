// Volunteer recordings for measuring rep counting on real people (KI-21). Records body points only, never video, and
// saves the file to this device; the volunteer decides whether to send it. See lib/pose/recording.ts.
import { t, msg } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import Link from "@/lib/navigation";
import { EXERCISES, type ExerciseKind } from "@/lib/pose/types";
import { SessionTracker } from "@/lib/pose/session-tracker";
import { Recorder, MAX_SECONDS, type PoseRecording } from "@/lib/pose/recording";
import { chooseVariant } from "@/lib/pose/model-choice";
import type { PoseDetectionService } from "@/lib/pose/detection-service";
import type { PoseFrame } from "@/lib/pose/types";

export const metadata = { title: msg("TrackCal — Volunteer rep recording") };
type Stage = "setup" | "recording" | "done";

async function download(recording: PoseRecording) {
  const json = JSON.stringify(recording), name = `trackcal-reps-${recording.exercise}-${recording.recorded_on}-${Math.random().toString(36).slice(2, 6)}`;
  let blob = new Blob([json], { type: "application/json" }), file = name + ".json";
  if (typeof CompressionStream !== "undefined") {
    blob = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).blob(); file = name + ".json.gz";
  }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return file;
}

export default function Page() {
  const video = useRef<HTMLVideoElement>(null), service = useRef<PoseDetectionService | null>(null);
  const tracker = useRef<SessionTracker | null>(null), recorder = useRef<Recorder | null>(null);
  const [exercise, setExercise] = useState<ExerciseKind>("squat"), [consent, setConsent] = useState(false), [stage, setStage] = useState<Stage>("setup");
  const [appReps, setAppReps] = useState(0), [frames, setFrames] = useState(0), [seconds, setSeconds] = useState(0), [counted, setCounted] = useState(""), [error, setError] = useState(""), [saved, setSaved] = useState("");
  useEffect(() => () => service.current?.stop(), []);

  function receive(frame: PoseFrame) {
    recorder.current?.add(frame);
    const result = tracker.current?.frame(frame);
    if (result) setAppReps(result.reps);
    setSeconds(Math.floor(recorder.current?.seconds ?? 0)); setFrames(recorder.current?.count ?? 0);
    if (recorder.current?.full) stop();
  }
  async function start() {
    setError(""); setSaved(""); setAppReps(0); setSeconds(0); setFrames(0); setCounted("");
    tracker.current = new SessionTracker(exercise); recorder.current = new Recorder();
    try {
      const { PoseDetectionService } = await import("@/lib/pose/detection-service");
      const controller = new PoseDetectionService(receive, message => { setError(message); setStage("setup"); });
      service.current = controller;
      await controller.start(video.current!, "", "user", () => setStage("recording"));
    } catch (e) { setError(e instanceof Error ? e.message : t("Camera unavailable. Use manual workouts.")); setStage("setup"); }
  }
  function stop() { service.current?.stop(); service.current = null; setStage("done"); }
  async function save() {
    const reps = Number(counted);
    if (!recorder.current || !Number.isInteger(reps) || reps < 0) return;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const recording = recorder.current.build({ exercise, level: "beginner", counted_reps: reps, app_reps: appReps, model: chooseVariant(),
      device: { mobile: matchMedia("(pointer: coarse)").matches, cores: nav.hardwareConcurrency || undefined, memory: nav.deviceMemory } });
    setSaved(await download(recording));
  }

  return <main className="account-page">
    <div className="account-title"><span className="eyebrow">{t("VOLUNTEER")}</span><h1>{t("Help us measure rep counting")}</h1>
      <p>{t("Do one set while the camera follows you, then tell us how many reps you really did. We compare that with what the app counted.")}</p></div>
    <section className="account-card">
      <h2>{t("What is recorded")}</h2>
      <p>{t("Only 33 body points per frame (positions of shoulders, elbows, knees and so on), the exercise, the reps you enter and your device type. No video, no photo, no name and no account. The file is saved on this device, and you decide whether to send it.")}</p>
      <label className="consent-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={stage === "recording"} /> {t("I agree to record body points for this set and understand what the file contains.")}</label>
    </section>
    <section className="account-card account-form">
      <label>{t("Exercise")}<select value={exercise} disabled={stage === "recording"} onChange={e => setExercise(e.target.value as ExerciseKind)}>
        {(Object.keys(EXERCISES) as ExerciseKind[]).map(k => <option key={k} value={k}>{t(EXERCISES[k].title)}</option>)}</select></label>
      <p className="push-note">{t(EXERCISES[exercise].setup)}</p>
      <video ref={video} className="lab-video" playsInline muted aria-label={t("Camera preview")} />
      {stage === "recording" && <p role="status">{t("Recording: {seconds} s of {max} s · the app has counted {reps}", { seconds, max: MAX_SECONDS, reps: appReps })}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="account-actions">
        {stage !== "recording" ? <button className="account-primary" disabled={!consent} onClick={() => void start()}>{stage === "done" ? t("Record another set") : t("Start recording")}</button>
          : <button className="account-primary" onClick={stop}>{t("Stop recording")}</button>}
      </div>
    </section>
    {stage === "done" && frames < 20 && <section className="account-card" role="alert"><h2>{t("No body was seen")}</h2>
      <p>{t("The camera did not see a whole body, so there is nothing to save. Step back until your shoulders, hips and knees are in view, then record again.")}</p></section>}
    {stage === "done" && frames >= 20 && <section className="account-card account-form">
      <h2>{t("How many reps did you really do?")}</h2>
      <p>{t("Count them yourself, or ask someone watching. The app counted {reps}; please don't copy it.", { reps: appReps })}</p>
      <label>{t("Reps you really did")}<input type="number" inputMode="numeric" min={0} max={500} value={counted} onChange={e => setCounted(e.target.value)} /></label>
      <div className="account-actions"><button className="account-primary" disabled={counted === "" || !Number.isInteger(Number(counted)) || Number(counted) < 0} onClick={() => void save()}>{t("Save the file to this device")}</button></div>
      {saved && <p role="status">{t("Saved as {file}. Send it to the TrackCal team if you'd like to help.", { file: saved })}</p>}
    </section>}
    <p><Link href="/workouts/camera">{t("Back to camera workouts")}</Link></p>
  </main>;
}
