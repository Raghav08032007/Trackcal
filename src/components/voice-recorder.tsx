"use client";
import { useEffect, useRef, useState } from "react";
import { encodeWav } from "@/lib/wav";

export function VoiceRecorder({ disabled, onRecording }: { disabled: boolean; onRecording: (file: File) => void }) {
  const [recording, setRecording] = useState(false), [processing, setProcessing] = useState(false), [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null), mounted = useRef(true), starting = useRef(false);
  const finish = () => { if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (timer.current) clearTimeout(timer.current); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (recorder.current) recorder.current.onstop = null; if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); if (timer.current) clearTimeout(timer.current); }; }, []);
  async function start() {
    if (starting.current) return; starting.current = true; setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone recording is unavailable. Upload a WAV file instead.");
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input; const chunks: Blob[] = [], device = new MediaRecorder(input); recorder.current = device;
      device.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      device.onerror = () => { setError("Recording failed. Try uploading a WAV file."); finish(); };
      device.onstop = async () => {
        finish(); if (!mounted.current) return; setRecording(false); setProcessing(true);
        let context: AudioContext | undefined;
        try {
          context = new AudioContext(); const audio = await context.decodeAudioData(await new Blob(chunks, { type: device.mimeType }).arrayBuffer());
          if (mounted.current) onRecording(new File([encodeWav(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)), audio.sampleRate)], "meal-recording.wav", { type: "audio/wav" }));
        } catch { if (mounted.current) setError("This browser could not decode the recording. Upload a mono 16 kHz WAV file instead."); }
        finally { await context?.close(); if (mounted.current) setProcessing(false); }
      };
      device.start(); setRecording(true); timer.current = setTimeout(finish, 60000);
    } catch (reason) { finish(); setError(reason instanceof Error ? reason.message : "Microphone permission was denied."); }
    finally { starting.current = false; }
  }
  return <div><p>Record up to 60 seconds. Recording starts only after you allow microphone access; stop to transcribe locally.</p><button type="button" className="account-secondary" disabled={disabled || processing} onClick={recording ? finish : () => void start()}>{recording ? "Stop and transcribe" : processing ? "Preparing recording…" : "Record meal"}</button>{recording && <p role="status">Microphone recording is active. It stops automatically after 60 seconds.</p>}{error && <p role="alert" className="account-error">{error}</p>}</div>;
}
