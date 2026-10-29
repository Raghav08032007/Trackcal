import { useEffect, useRef, useState } from "react";
interface Recognition { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; abort(): void; }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function VoiceInput({ onText }: { onText: (text: string) => void }) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (recognition.current) { recognition.current.onresult = null; recognition.current.onend = null; recognition.current.onerror = null; recognition.current.abort(); } }, []);
  function start() {
    if (listening) { recognition.current?.abort(); setListening(false); return; }
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { setError("Voice input is unavailable in this browser. Type your meal below, or use a browser with speech recognition."); return; }
    const instance = new Constructor(); recognition.current = instance;
    instance.lang = "en-IN"; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => { const text = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim(); if (text) onText(text); };
    instance.onerror = () => { setError("Microphone or speech service unavailable. Check permission or type your meal."); setListening(false); };
    instance.onend = () => setListening(false);
    try { setError(""); instance.start(); setListening(true); } catch { setError("Unable to start voice input. Type your meal instead."); }
  }
  return <div className="mb-3"><button onClick={start} aria-pressed={listening} className="text-sm px-3 py-2 rounded-lg border border-slate-700 text-emerald-400">{listening ? "Stop recording" : "Speak a meal"}</button><span className="ml-3 text-xs text-slate-400">Your browser may use an online speech service.</span>{error && <p role="alert" className="text-amber-400 text-xs mt-2">{error}</p>}</div>;
}
