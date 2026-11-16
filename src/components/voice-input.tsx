import { t, msg } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { encodeWav } from "@/lib/wav";

interface Recognition { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event?: { error?: string }) => void) | null; onend: (() => void) | null; start(): void; abort(): void; stop?(): void; }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Mode = "idle" | "listening" | "recording" | "working";
const SILENCE_MS = 4000, MAX_RECORDING_MS = 30000;
const DENIED = msg("Microphone blocked. Allow it from the lock icon in the address bar, then try again.");
const UNAVAILABLE = msg("Voice input is unavailable in this browser. Type your meal below.");

async function recordingToWavBase64(blob: Blob) {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const bytes = new Uint8Array(encodeWav(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)), audio.sampleRate));
    let binary = ""; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  } finally { await context.close(); }
}
/** Live words from the browser where its speech service works. Browsers where it fails (often Edge) record a short clip for the AI to write down. */
export function VoiceInput({ onText, value = "" }: { onText: (text: string) => void; value?: string }) {
  const recognition = useRef<Recognition | null>(null), recorder = useRef<MediaRecorder | null>(null), silence = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), latest = useRef(value), alive = useRef(true);
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState("");
  useEffect(() => { latest.current = value; }, [value]);
  useEffect(() => () => {
    alive.current = false; clearTimeout(silence.current);
    if (recognition.current) { recognition.current.onresult = null; recognition.current.onend = null; recognition.current.onerror = null; recognition.current.abort(); }
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);
  const withBase = (base: string, text: string) => (base.trim() ? `${base.trim()} ${text}` : text);

  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(t(UNAVAILABLE)); setMode("idle"); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError(t(DENIED)); setMode("idle"); return; }
    const base = latest.current, chunks: Blob[] = [], clip = new MediaRecorder(stream); recorder.current = clip;
    clip.ondataavailable = event => chunks.push(event.data);
    clip.onstop = async () => {
      stream.getTracks().forEach(track => track.stop()); clearTimeout(silence.current);
      if (!alive.current) return;
      setMode("working");
      try {
        const response = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: await recordingToWavBase64(new Blob(chunks)) }), signal: AbortSignal.timeout(30000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("Could not understand that. Try again or type your meal."));
        if (alive.current) onText(withBase(base, data.text));
      } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : t("Could not understand that. Try again or type your meal.")); }
      finally { if (alive.current) setMode("idle"); }
    };
    clip.start(); setMode("recording"); silence.current = setTimeout(() => clip.stop(), MAX_RECORDING_MS);
  }

  const [language, setLanguage] = useState("en-IN");
  function start() {
    if (mode === "listening") { clearTimeout(silence.current); recognition.current?.stop?.() ?? recognition.current?.abort(); setMode("idle"); return; }
    if (mode === "recording") { recorder.current?.stop(); return; }
    setError("");
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { void record(); return; }
    const instance = new Constructor(), base = latest.current; recognition.current = instance;
    instance.lang = language; instance.interimResults = true; instance.continuous = true;
    instance.onresult = event => {
      const text = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").replace(/\s+/g, " ").trim();
      if (text) onText(withBase(base, text));
      clearTimeout(silence.current); silence.current = setTimeout(() => instance.stop?.(), SILENCE_MS);
    };
    instance.onerror = event => {
      clearTimeout(silence.current); instance.onend = null;
      if (event?.error === "not-allowed") { setError(t(DENIED)); setMode("idle"); }
      else if (event?.error === "no-speech") { setError(t("Didn't catch anything. Press the button and speak a little louder.")); setMode("idle"); }
      else if (event?.error === "aborted") setMode("idle");
      else if (event?.error) void record();
      else { setError(t("Microphone or speech service unavailable. Check permission or type your meal.")); setMode("idle"); }
    };
    instance.onend = () => { clearTimeout(silence.current); setMode("idle"); };
    try { instance.start(); setMode("listening"); silence.current = setTimeout(() => instance.stop?.(), SILENCE_MS * 2); } catch { void record(); }
  }
  const label = mode === "listening" ? t("Stop listening") : mode === "recording" ? t("Stop and write it down") : mode === "working" ? t("Writing it down…") : t("Speak a meal");
  const hint = mode === "listening" ? t("Listening. Your words appear below.") : mode === "recording" ? t("Recording. Press stop when you finish.") : t("Say what you ate and how much. Audio is sent to a speech or AI service to write it down.");
  return <div className={`voice-input voice-${mode}`}><label className="voice-language">{t("Language")}<select value={language} disabled={mode !== "idle"} onChange={event => setLanguage(event.target.value)}><option value="en-IN">{t("English")}</option><option value="hi-IN">हिन्दी</option><option value="ta-IN">தமிழ்</option></select></label><button type="button" onClick={start} disabled={mode === "working"} aria-pressed={mode === "listening" || mode === "recording"}>{mode === "listening" || mode === "recording" ? <Square size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}{label}</button>{mode !== "idle" && <span>{hint}</span>}{error && <p role="alert">{error}</p>}</div>;
}
