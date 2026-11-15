// Installable app and safe updates. A new version waits until the person taps "Update"; the prompt stays hidden
// while a workout is running (pages mark that with markWorkoutActive), so nothing reloads mid-set.
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";

export function markWorkoutActive(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) document.documentElement.dataset.workoutActive = "true"; else delete document.documentElement.dataset.workoutActive;
}
const workoutActive = () => document.documentElement.dataset.workoutActive === "true";

let accepted = false;
/** Registers the service worker and announces a waiting update. Reloads only after the person accepted one. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (accepted) location.reload(); });
  void navigator.serviceWorker.register("/sw.js").then(registration => {
    const announce = () => { if (registration.waiting && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent("trackcal-update-ready", { detail: registration })); };
    announce();
    registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed") announce(); }); });
    window.setInterval(() => void registration.update().catch(() => {}), 3600000);
  }).catch(() => {});
}

export function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null), [, refresh] = useState(0);
  useEffect(() => {
    const ready = (event: Event) => setRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
    window.addEventListener("trackcal-update-ready", ready);
    // Re-render on every change of the workout marker; the marker itself is read during render.
    const observer = new MutationObserver(() => refresh(n => n + 1)); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-workout-active"] });
    return () => { window.removeEventListener("trackcal-update-ready", ready); observer.disconnect(); };
  }, []);
  if (!registration?.waiting || workoutActive()) return null;
  return <div className="update-prompt" role="status"><span>{t("A new version of TrackCal is ready.")}</span>
    <button onClick={() => { accepted = true; registration.waiting?.postMessage({ type: "SKIP_WAITING" }); }}>{t("Update now")}</button>
    <button onClick={() => setRegistration(null)}>{t("Later")}</button></div>;
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function InstallButton() {
  const [event, setEvent] = useState<InstallEvent | null>(null), [installed, setInstalled] = useState(false);
  useEffect(() => {
    const capture = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const done = () => { setInstalled(true); setEvent(null); };
    window.addEventListener("beforeinstallprompt", capture); window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return <p className="install-note" role="status">{t("TrackCal is installed. Open it from your home screen or app list.")}</p>;
  if (!event) return null;
  return <button className="account-secondary install-button" onClick={() => void (async () => { await event.prompt(); const choice = await event.userChoice; if (choice.outcome === "accepted") setInstalled(true); setEvent(null); })()}>{t("Install TrackCal")}</button>;
}

export function MotivationCard() {
  const [line, setLine] = useState("");
  useEffect(() => {
    const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    fetch("/api/motivation/today?day=" + day).then(r => r.ok ? r.json() : null).then(v => { if (v?.message) setLine(v.message); }).catch(() => {});
  }, []);
  return line ? <aside className="motivation-card" aria-label={t("A thought for today")}><span aria-hidden="true">✿</span><p>{line}</p></aside> : null;
}
