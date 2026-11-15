// Point, snap, estimate: a live viewfinder for food. The frame goes through the same review path as an uploaded photo.
import { t } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";

const LONGEST_SIDE = 1600;

export function FoodCamera({ consent, onConsent, onCapture, onClose }: { consent: boolean; onConsent: (value: boolean) => void; onCapture: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let stream: MediaStream | undefined, stopped = false;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); setReady(true); }
      } catch (reason) {
        if (stopped) return;
        setError(reason instanceof DOMException && reason.name === "NotAllowedError" ? t("Camera access is blocked. Allow it in your browser settings, or close this and upload a photo.") : t("The camera isn’t available here. Close this and upload a photo instead."));
      }
    })();
    return () => { stopped = true; stream?.getTracks().forEach(track => track.stop()); };
  }, []);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const snap = useCallback(() => {
    const source = video.current; if (!source?.videoWidth) return;
    const scale = Math.min(1, LONGEST_SIDE / Math.max(source.videoWidth, source.videoHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (blob) onCapture(new File([blob], "meal-camera.jpg", { type: "image/jpeg" })); else setError(t("That photo didn’t save. Please try again.")); }, "image/jpeg", 0.88);
  }, [onCapture]);
  return createPortal(<div className="food-camera" role="dialog" aria-modal="true" aria-label={t("Food camera")}>
    <video ref={video} className="food-camera-video" playsInline muted aria-label={t("Camera preview")} />
    <div className="food-camera-frame" aria-hidden="true" />
    <button className="food-camera-close" aria-label={t("Close camera")} onClick={onClose}><X size={22} /></button>
    <div className="food-camera-controls">
      {error ? <p role="alert">{error}</p> : <p>{ready ? t("Fit the whole plate inside the frame") : t("Opening the camera…")}</p>}
      <label className="food-camera-consent"><input type="checkbox" checked={consent} onChange={event => onConsent(event.target.checked)} /> {t("Send this photo for AI analysis")}</label>
      <button className="food-camera-shutter" aria-label={consent ? t("Snap and estimate calories") : t("Snap photo")} disabled={!ready} onClick={snap}><Camera size={26} /></button>
    </div>
  </div>, document.body);
}
