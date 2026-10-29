// Opt-in push reminders (Phase 4, flag web_push). Nothing is asked on page load: an explainer comes first, the
// browser permission prompt appears only after a tap, and a blocked permission shows how to re-enable, never a nag.
import { useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "./account-session";
import { enableOnThisDevice, pushRequest, pushSupport, removeThisDevice, TYPE_LABELS, type PushSettings, type PushType } from "@/lib/push";

type Config = { enabled: boolean; public_key: string };
function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => { let live = true; fetch("/api/push/config").then(r => r.ok ? r.json() : null).then(v => { if (live) setConfig(v); }).catch(() => {}); return () => { live = false; }; }, []);
  return config;
}
const permissionNow = () => typeof Notification === "undefined" ? "default" : Notification.permission;

export function PushSettingsCard() {
  const { user } = useAccount(); const config = useConfig();
  return user && config?.enabled ? <Card key={user.id} publicKey={config.public_key} /> : null;
}

function Card({ publicKey }: { publicKey: string }) {
  const [settings, setSettings] = useState<PushSettings | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState(""), [permission, setPermission] = useState(permissionNow());
  const support = pushSupport();
  useEffect(() => { pushRequest<PushSettings>("settings").then(setSettings).catch(e => setError(e instanceof Error ? e.message : "Unavailable.")); }, []);
  async function save(patch: Partial<{ enabled: boolean; types: Partial<PushSettings["types"]>; max_per_day: number; snooze: "keep" | "clear" | "1d" | "1w" }>, message: string) {
    if (!settings || busy) return; setBusy(true); setError("");
    try { setSettings(await pushRequest<PushSettings>("settings", "PUT", { enabled: settings.enabled, max_per_day: settings.max_per_day, ...patch })); setNotice(message); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save. Nothing changed."); } finally { setBusy(false); }
  }
  async function turnOn() {
    if (busy) return; setBusy(true); setError("");
    try {
      const result = await enableOnThisDevice(publicKey); setPermission(result);
      if (result !== "granted") { setNotice(""); return; }
      setSettings(await pushRequest<PushSettings>("settings", "PUT", { enabled: true, max_per_day: settings?.max_per_day ?? 2 }));
      setNotice("Notifications are on for this device. You can turn them off here or on your Me page.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not turn on notifications."); } finally { setBusy(false); }
  }
  if (!settings) return <section className="account-card" id="notifications"><h2>Notifications</h2>{error ? <p role="alert">{error}</p> : <p>Loading…</p>}</section>;
  const snoozed = settings.snooze_until && new Date(settings.snooze_until) > new Date();
  return <section className="account-card push-card" id="notifications">
    <h2>Notifications, only if you want them</h2>
    <p>You choose which reminders you get and when: at most {settings.max_per_day} a day, never during your quiet hours ({settings.quiet_start}–{settings.quiet_end}, {settings.timezone}). They never show health details on your lock screen. To stop, turn them off here or on your Me page.</p>
    {support === "ios-install" && <p className="push-note">On iPhone and iPad, notifications work only after you add TrackCal to your Home Screen (Share → Add to Home Screen, iOS 16.4 or later). In-app reminders work everywhere.</p>}
    {support === "unsupported" && <p className="push-note">This browser can't receive web notifications. In-app reminders still work while TrackCal is open.</p>}
    {permission === "denied" && <p className="push-note" role="note">Notifications are blocked for TrackCal in this browser. To allow them, open the site settings (the icon next to the address), set Notifications to Allow, then come back. Until then, in-app reminders still work.</p>}
    <div className="wellness-feedback"><p role="status">{notice}</p>{error && <p role="alert">{error}</p>}</div>
    {!settings.enabled || !settings.devices.length ? (support === "ok" && permission !== "denied" &&
      <button className="account-primary" disabled={busy} onClick={() => void turnOn()}>{busy ? "Turning on…" : "Turn on notifications"}</button>)
      : <>
        <label className="push-switch"><input type="checkbox" role="switch" checked={settings.enabled} disabled={busy} onChange={e => void save({ enabled: e.target.checked }, e.target.checked ? "Notifications are on." : "All notifications are off.")} /> All notifications</label>
        <fieldset className="push-types"><legend>What you get</legend>{(Object.keys(TYPE_LABELS) as PushType[]).map(type => { const choice = settings.types[type]; return <div className="push-type" key={type}>
          <label><input type="checkbox" checked={choice.enabled} disabled={busy} onChange={e => void save({ types: { [type]: { enabled: e.target.checked, time: choice.time } } }, "Saved.")} /> {TYPE_LABELS[type]}</label>
          {choice.time !== null && <label className="push-time">Time<input type="time" value={choice.time} disabled={busy || !choice.enabled} onChange={e => e.target.value && void save({ types: { [type]: { enabled: true, time: e.target.value } } }, "Time saved.")} /></label>}
        </div>; })}</fieldset>
        <label>Most per day<select value={settings.max_per_day} disabled={busy} onChange={e => void save({ max_per_day: Number(e.target.value) }, "Saved.")}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <div className="account-actions">{snoozed ? <button disabled={busy} onClick={() => void save({ snooze: "clear" }, "Notifications resumed.")}>Resume now (paused until {new Date(settings.snooze_until!).toLocaleString()})</button>
          : <><button disabled={busy} onClick={() => void save({ snooze: "1d" }, "Paused for a day.")}>Pause for a day</button><button disabled={busy} onClick={() => void save({ snooze: "1w" }, "Paused for a week.")}>Pause for a week</button></>}</div>
        <details><summary>Your devices ({settings.devices.length})</summary><ul>{settings.devices.map(d => <li key={d.id}>{d.user_agent.slice(0, 60)} · since {new Date(d.created_at).toLocaleDateString()}</li>)}</ul>
          <button disabled={busy} onClick={() => void (async () => { setBusy(true); try { await removeThisDevice(); setSettings(await pushRequest<PushSettings>("settings")); setNotice("This device won't receive notifications."); } finally { setBusy(false); } })()}>Stop notifications on this device</button></details>
      </>}
    <p className="push-note">Times use your time zone and quiet hours from <Link href="/plan#personal-reminders">your preferences</Link>.</p>
  </section>;
}

/** Me page: the second tap that turns everything off. Turning on happens in the full card (it needs the explainer). */
export function NotificationSwitch() {
  const { user } = useAccount(); const config = useConfig();
  const [settings, setSettings] = useState<PushSettings | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (user && config?.enabled) pushRequest<PushSettings>("settings").then(setSettings).catch(() => {}); }, [user, config?.enabled]);
  if (!user || !config?.enabled || !settings) return null;
  return <section className="account-card push-compact" aria-label="Notifications">
    {settings.enabled && settings.devices.length
      ? <label className="push-switch"><input type="checkbox" role="switch" checked disabled={busy} onChange={() => void (async () => { setBusy(true); setError(""); try { setSettings(await pushRequest<PushSettings>("settings", "PUT", { enabled: false, max_per_day: settings.max_per_day })); } catch (e) { setError(e instanceof Error ? e.message : "Could not turn off."); } finally { setBusy(false); } })()} /> Notifications on</label>
      : <p>Notifications are off. <Link href="/routine#notifications">Choose reminders →</Link></p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
