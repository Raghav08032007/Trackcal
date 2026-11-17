import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "./account-session";
import { Celebration } from "./celebration";
import { RouteMeter } from "@/lib/gps";
import { say, voiceAvailable } from "@/lib/workout-coach";
import { wellnessRequest, type Session } from "@/lib/wellness";
import { SPORTS, VISIBILITY, activities, dropPending, duration, keepPending, km, pace, readPending, sportTitle, type Activity, type Fix, type NewRecord, type Pending, type Sport, type Visibility } from "@/lib/activities";

type Status = "ready" | "tracking" | "paused" | "review" | "saved";

export function GpsTracker() {
  const { ready, user } = useAccount();
  return !ready ? <main className="account-loading">{t("Opening GPS…")}</main> : user ? <Tracker key={user.id} /> : <main className="account-page"><section className="account-card"><h1>{t("Walk, run, hike or ride, tracked.")}</h1><p>{t("Sign in to record your route, splits and personal records.")}</p><Link className="account-primary" href="/login?next=/workouts/gps">{t("Sign in")}</Link></section></main>;
}

/** Records raw GPS fixes; the server measures them (distance, moving time, splits, climb, records) when the activity is saved.
 *  The live numbers here are a preview from the same fixes. The recording is kept on this device until it is saved. */
function Tracker() {
  const meter = useRef(new RouteMeter()), fixes = useRef<Fix[]>([]), watch = useRef<number | null>(null), lock = useRef<{ release: () => Promise<void> } | null>(null);
  const started = useRef(0), elapsedBefore = useRef(0), id = useRef(crypto.randomUUID()), startedAt = useRef(""), nextKm = useRef(1), lastKept = useRef(0);
  const [status, setStatus] = useState<Status>("ready"), [sport, setSport] = useState<Sport>("run"), [metres, setMetres] = useState(0), [elapsed, setElapsed] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [name, setName] = useState(""), [visibility, setVisibility] = useState<Visibility>("private");
  const [saved, setSaved] = useState<{ activity: Activity; records: NewRecord[]; xp: number } | null>(null), [pending, setPending] = useState<Pending | null>(() => readPending());
  const [voice, setVoice] = useState(() => { try { return localStorage.getItem("trackcal:gps:voice") !== "off" && voiceAvailable(); } catch { return voiceAvailable(); } });

  useEffect(() => { if (status !== "tracking") return; const timer = setInterval(() => setElapsed(elapsedBefore.current + performance.now() - started.current), 1000); return () => clearInterval(timer); }, [status]);
  useEffect(() => () => { if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current); void lock.current?.release().catch(() => {}); }, []);
  // Leaving mid-recording asks first; the recording is on this device either way.
  useEffect(() => { if (status !== "tracking" && status !== "paused") return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [status]);

  const keep = (force = false) => {
    if (!fixes.current.length || (!force && performance.now() - lastKept.current < 5000)) return;
    lastKept.current = performance.now();
    keepPending({ id: id.current, sport, started_at: startedAt.current, fixes: fixes.current, elapsed_ms: elapsedBefore.current + (status === "tracking" ? performance.now() - started.current : 0) });
  };

  async function begin() {
    if (!("geolocation" in navigator)) { setError(t("This device has no GPS in the browser.")); return; }
    setError(""); started.current = performance.now();
    if (!startedAt.current) startedAt.current = new Date().toISOString();
    watch.current = navigator.geolocation.watchPosition(p => {
      const c = p.coords; setAccuracy(Math.round(c.accuracy));
      fixes.current.push([+c.latitude.toFixed(7), +c.longitude.toFixed(7), p.timestamp, Math.round(c.accuracy * 10) / 10, c.altitude === null ? null : Math.round(c.altitude * 10) / 10]);
      if (meter.current.add({ lat: c.latitude, lon: c.longitude, accuracy: c.accuracy, t: p.timestamp })) {
        setMetres(meter.current.metres);
        if (meter.current.metres >= nextKm.current * 1000) {
          const k = nextKm.current; nextKm.current++;
          if (voice) say(t("{count} kilometres. {pace}", { count: k, pace: spokenPace(sport, meter.current.metres, elapsedBefore.current + performance.now() - started.current) }));
          navigator.vibrate?.(200);
        }
      }
      keep();
    }, failure => { setError(failure.code === 1 ? t("Location permission is off. Allow it in your browser settings to record.") : t("Waiting for a GPS signal. Step outside for a clearer view of the sky.")); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    try { lock.current = await (navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* the screen may dim; recording carries on while the page is open */ }
    setStatus("tracking");
  }
  function stopWatching() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null; void lock.current?.release().catch(() => {}); lock.current = null;
    elapsedBefore.current += performance.now() - started.current; setElapsed(elapsedBefore.current); meter.current.pause();
  }
  function pause() { stopWatching(); setStatus("paused"); keep(true); }
  function finish() { if (status === "tracking") stopWatching(); setStatus("review"); keep(true); }

  async function save(p: Pending, chosenName: string, chosenVisibility: Visibility) {
    if (busy) return; setBusy(true); setError("");
    try {
      const result = await activities<{ activity: Activity; new_records: NewRecord[] }>("", "POST", { id: p.id, sport: p.sport, started_at: p.started_at, fixes: p.fixes, name: chosenName.trim() || undefined, visibility: chosenVisibility });
      dropPending(); setPending(null);
      let xp = 0;
      // Points and the streak come from the workout journal. The activity is already safe, so a failure here only costs the points.
      try {
        const a = result.activity, minutes = Math.max(1, Math.round(a.moving_s / 6) / 10);
        const opened = await wellnessRequest<{ session: Session }>("sessions", { id: a.id, name: `${sportTitle(a.sport)} · ${km(a.distance_m)} km`, exercises: [a.sport === "run" ? "run" : "walk"] });
        const done = await wellnessRequest<{ awarded_xp: number }>("sessions/" + a.id, { revision: opened.session.revision, action: "complete", minutes, notes: `${km(a.distance_m)} km in ${duration(a.moving_s)} moving, measured by GPS.`, exercises: [{ exercise_id: a.sport === "run" ? "run" : "walk", sets: [{ reps: 0, load: 0, minutes: Math.min(60, minutes) }] }] }, "PUT");
        xp = done.awarded_xp;
      } catch { /* already in the journal, or the journal is busy: the activity itself is saved */ }
      setSaved({ activity: result.activity, records: result.new_records, xp }); setStatus("saved");
      if (voice && result.new_records.length) say(t("New personal record: {label}.", { label: result.new_records[0].label }));
    } catch (failure) {
      setError(failure instanceof Error ? t("{message} Your recording is kept on this device.", { message: t(failure.message) }) : t("Could not save. Your recording is kept on this device; try again."));
    } finally { setBusy(false); }
  }
  const current = (): Pending => ({ id: id.current, sport, started_at: startedAt.current, fixes: fixes.current, elapsed_ms: elapsedBefore.current });
  function reset() {
    meter.current = new RouteMeter(); fixes.current = []; id.current = crypto.randomUUID(); startedAt.current = ""; nextKm.current = 1; elapsedBefore.current = 0;
    setMetres(0); setElapsed(0); setAccuracy(null); setName(""); setVisibility("private"); setSaved(null); setStatus("ready"); dropPending(); setPending(null);
  }

  const signal = accuracy === null ? null : accuracy <= 10 ? t("Strong") : accuracy <= 25 ? t("Fair") : t("Weak");
  return <main className="wellness-page gps-page">
    <section className="camera-intro"><span className="eyebrow">{t("OUTDOORS")}</span><h1>{t("Record an activity")}</h1><p>{t("Route, splits, climb and personal records from your phone's GPS. Keep this page open while you move. Activities are private until you share them.")}</p></section>
    {error && <p role="alert" className="camera-alert">{error}</p>}
    {pending && status === "ready" && <section className="account-card gps-recover"><h2>{t("An unsaved {n} is on this device", { n: sportTitle(pending.sport).toLowerCase() })}</h2><p>{t("Recorded {n} · {length} GPS points.", { n: new Date(pending.started_at).toLocaleString(), length: pending.fixes.length })}</p>
      <div className="account-actions"><button className="account-primary" disabled={busy} onClick={() => void save(pending, "", "private")}>{busy ? t("Saving…") : t("Save it")}</button><button disabled={busy} onClick={() => { dropPending(); setPending(null); }}>{t("Discard")}</button></div></section>}
    <section className="account-card gps-card">
      {status === "ready" && <div className="camera-equipment" role="group" aria-label={t("Sport")}>{SPORTS.map(s => <button key={s.id} type="button" aria-pressed={sport === s.id} onClick={() => setSport(s.id)}>{s.title}</button>)}</div>}
      {status !== "saved" && <div className="gps-stats" aria-live="polite"><div><strong>{km(metres)}</strong><small>km</small></div><div><strong>{duration(elapsed / 1000)}</strong><small>{t("time")}</small></div><div><strong>{pace(sport, metres, elapsed / 1000)}</strong><small>{sport === "ride" ? "speed" : "pace"}</small></div></div>}
      {signal && (status === "tracking" || status === "paused") && <p className="gps-signal" data-signal={signal.toLowerCase()}><span aria-hidden="true" /> {t("GPS")}{" "}{signal.toLowerCase()} {t("· about")}{" "}{accuracy} m{accuracy! > 35 ? t(". Points this rough are left out until the signal improves.") : ""}</p>}
      {status === "ready" && voiceAvailable() && <label className="camera-voice"><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); try { localStorage.setItem("trackcal:gps:voice", e.target.checked ? "on" : "off"); } catch { /* remembered for this visit */ } }} /> {t("Announce each kilometre")}</label>}
      {status === "review" && <div className="gps-review">
        <label>{t("Name")}{" "}<input value={name} maxLength={120} placeholder={t("Leave blank for \"Morning {sport}\"", { sport })} onChange={e => setName(e.target.value)} /></label>
        <fieldset className="visibility-choice"><legend>{t("Who can see it")}</legend>{VISIBILITY.map(v => <label key={v.id}><input type="radio" name="visibility" checked={visibility === v.id} onChange={() => setVisibility(v.id)} /> <span><strong>{v.title}</strong><small>{v.detail}</small></span></label>)}</fieldset>
      </div>}
      <div className="account-actions">
        {status === "ready" && <button className="account-primary" onClick={() => void begin()}>{t("Start {n}", { n: sportTitle(sport).toLowerCase() })}</button>}
        {status === "tracking" && <><button onClick={pause}>{t("Pause")}</button><button className="account-primary" onClick={finish}>{t("Finish")}</button></>}
        {status === "paused" && <><button className="account-primary" onClick={() => void begin()}>{t("Resume")}</button><button onClick={finish}>{t("Finish")}</button></>}
        {status === "review" && <>{elapsedBefore.current >= 30000 && fixes.current.length >= 2 ? <button className="account-primary" disabled={busy} onClick={() => void save(current(), name, visibility)}>{busy ? t("Measuring your route…") : t("Save {n}", { n: sportTitle(sport).toLowerCase() })}</button> : <p>{t("Record for at least 30 seconds outdoors to save an activity.")}</p>}<button disabled={busy} onClick={reset}>{t("Discard")}</button></>}
      </div>
      {status === "saved" && saved && <div className="gps-saved">
        <Celebration />
        <h2>{saved.activity.name}</h2>
        <div className="gps-stats"><div><strong>{km(saved.activity.distance_m)}</strong><small>km</small></div><div><strong>{duration(saved.activity.moving_s)}</strong><small>{t("moving")}</small></div><div><strong>{pace(saved.activity.sport, saved.activity.distance_m, saved.activity.moving_s)}</strong><small>{saved.activity.sport === "ride" ? t("avg speed") : t("avg pace")}</small></div></div>
        {saved.records.length > 0 && <ul className="new-records" aria-label={t("New personal records")}>{saved.records.map(r => <li key={r.kind + r.label}><span aria-hidden="true">🏆</span> <strong>{r.label}</strong> {recordText(r, saved.activity.sport)}</li>)}</ul>}
        {saved.xp > 0 && <p className="gps-xp">{t("+{xp} points", { xp: saved.xp })}</p>}
        <div className="account-actions"><Link className="account-primary" href={`/activities/${saved.activity.id}`}>{t("See splits and map")}</Link><button onClick={reset}>{t("Record another")}</button></div>
      </div>}
    </section>
    <p className="gps-footnote"><Link href="/activities">{t("Your activities, records and privacy zones →")}</Link></p>
  </main>;
}

function spokenPace(sport: Sport, metres: number, ms: number) {
  if (metres < 50) return "";
  const s = ms / 1000;
  if (sport === "ride") return t("Average {n} kilometres an hour.", { n: Math.round((metres / s) * 3.6) });
  const per = s / (metres / 1000), m = Math.floor(per / 60), sec = Math.round(per % 60);
  return t("Average pace {m} minutes {sec} seconds per kilometre.", { m, sec });
}
function recordText(r: NewRecord, sport: Sport) {
  if (r.kind === "best_effort" && r.seconds) return r.previous_seconds ? t("in {time}, {faster} faster than before", { time: duration(r.seconds), faster: duration(r.previous_seconds - r.seconds) }) : t("in {time} (your first)", { time: duration(r.seconds) });
  if (r.kind === "longest" && r.distance_m) return sport === "ride" ? t("{km} km ridden", { km: km(r.distance_m) }) : t("{km} km covered", { km: km(r.distance_m) });
  if (r.kind === "climb" && r.elevation_gain_m) return t("{n} m climbed", { n: Math.round(r.elevation_gain_m) });
  return "";
}
