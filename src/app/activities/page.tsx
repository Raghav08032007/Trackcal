// Your GPS activities: this week, the list, personal records per sport, and privacy zones.
import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { RouteThumb } from "@/components/route-map";
import { SPORTS, activities, duration, km, pace, sportTitle, when, type ActivitySummary, type Records, type Sport, type Zone } from "@/lib/activities";

export const metadata = { title: "TrackCal — Activities" };
type Listing = { activities: ActivitySummary[]; next: string | null; last_7_days: { count: number; distance_m: number; moving_s: number; elevation_gain_m: number } };

export default function Page() {
  const { ready, user } = useAccount();
  if (!ready) return <main className="account-loading">Loading activities…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Your activities</h1><p>Sign in to see your routes, splits and records.</p><Link className="account-primary" href="/login?next=/activities">Sign in</Link></section></main>;
  return <Activities />;
}

function Activities() {
  const [sport, setSport] = useState<Sport | "">(""), [list, setList] = useState<Listing | null>(null), [error, setError] = useState(""), [more, setMore] = useState(false);
  const load = useCallback(async (before?: string) => {
    setError("");
    try {
      const q = new URLSearchParams({ ...(sport ? { sport } : {}), ...(before ? { before } : {}) }).toString();
      const data = await activities<Listing>(q ? "?" + q : "");
      setList(old => before && old ? { ...data, activities: [...old.activities, ...data.activities] } : data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load activities."); }
    finally { setMore(false); }
  }, [sport]);
  useEffect(() => { void load(); }, [load]);
  const week = list?.last_7_days;
  return <main className="wellness-page activities-page">
    <section className="camera-intro"><span className="eyebrow">YOUR ACTIVITIES</span><h1>Every route, measured.</h1><p>Distance, moving time, splits and climb are measured on our server from your GPS points, the same way for every phone.</p>
      <Link className="account-primary" href="/workouts/gps">Record an activity</Link></section>
    {error && <p role="alert" className="camera-alert">{error}</p>}
    <div className="segmented activity-filter" role="group" aria-label="Sport"><button type="button" aria-pressed={sport === ""} onClick={() => setSport("")}>All</button>{SPORTS.map(s => <button key={s.id} type="button" aria-pressed={sport === s.id} onClick={() => setSport(s.id)}>{s.title}</button>)}</div>
    {week && <section className="account-card week-totals" aria-label="Last 7 days"><h2>Last 7 days</h2><div className="gps-stats"><div><strong>{week.count}</strong><small>activities</small></div><div><strong>{km(week.distance_m)}</strong><small>km</small></div><div><strong>{duration(week.moving_s)}</strong><small>moving</small></div><div><strong>{Math.round(week.elevation_gain_m)}</strong><small>m climbed</small></div></div></section>}
    <section className="activity-list" aria-label="Activities">
      {list && !list.activities.length && <div className="account-card empty-state"><h2>No activities yet</h2><p>Record a walk, run, hike or ride and it shows up here with its map and splits.</p></div>}
      {list?.activities.map(a => <Link key={a.id} className="account-card activity-card" href={`/activities/${a.id}`}>
        <RouteThumb preview={a.preview ?? []} />
        <div><span className="activity-meta">{sportTitle(a.sport)} · {when(a.started_at)}{a.visibility !== "private" && <> · {a.visibility === "everyone" ? "Public" : "Followers"}</>}</span><h3>{a.name}</h3>
          <dl className="activity-numbers"><div><dt>Distance</dt><dd>{km(a.distance_m)} km</dd></div><div><dt>{a.sport === "ride" ? "Speed" : "Pace"}</dt><dd>{pace(a.sport, a.distance_m, a.moving_s)}</dd></div><div><dt>Time</dt><dd>{duration(a.moving_s)}</dd></div>{a.elevation_gain_m >= 5 && <div><dt>Climb</dt><dd>{Math.round(a.elevation_gain_m)} m</dd></div>}</dl></div>
      </Link>)}
      {list?.next && <button className="account-secondary" disabled={more} onClick={() => { setMore(true); void load(list.next!); }}>{more ? "Loading…" : "Show older"}</button>}
    </section>
    <RecordsCard sport={sport || "run"} />
    <ZonesCard />
  </main>;
}

function RecordsCard({ sport }: { sport: Sport }) {
  const [records, setRecords] = useState<Records | null>(null);
  useEffect(() => { let live = true; activities<Records>(`records?sport=${sport}`).then(r => { if (live) setRecords(r); }).catch(() => { if (live) setRecords(null); }); return () => { live = false; }; }, [sport]);
  if (!records || (!records.best_efforts.length && !records.longest)) return null;
  return <section className="account-card records-card"><h2>{sportTitle(sport)} records</h2>
    <ul>{records.best_efforts.map(e => <li key={e.label}><Link href={`/activities/${e.activity_id}`}><span>{e.label}</span><strong>{duration(e.seconds)}</strong><small>{e.date}</small></Link></li>)}
      {records.longest && <li><Link href={`/activities/${records.longest.activity_id}`}><span>Longest</span><strong>{km(records.longest.distance_m)} km</strong><small>{records.longest.date}</small></Link></li>}
      {records.biggest_climb && <li><Link href={`/activities/${records.biggest_climb.activity_id}`}><span>Biggest climb</span><strong>{Math.round(records.biggest_climb.elevation_gain_m)} m</strong><small>{records.biggest_climb.date}</small></Link></li>}</ul>
  </section>;
}

/** Circles around places like home or work, cut out of every route other people see. */
function ZonesCard() {
  const [zones, setZones] = useState<Zone[]>([]), [label, setLabel] = useState("Home"), [radius, setRadius] = useState(300), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  useEffect(() => { activities<{ zones: Zone[] }>("privacy-zones").then(r => setZones(r.zones)).catch(() => {}); }, []);
  function addHere() {
    if (!("geolocation" in navigator)) { setNote("This device has no GPS in the browser."); return; }
    setBusy(true); setNote("Finding where you are…");
    navigator.geolocation.getCurrentPosition(async p => {
      try { const r = await activities<{ zones: Zone[] }>("privacy-zones", "POST", { label: label.trim() || "Private place", lat: p.coords.latitude, lon: p.coords.longitude, radius_m: radius }); setZones(r.zones); setNote(`Added. Routes you share now hide ${radius} m around this spot.`); }
      catch (failure) { setNote(failure instanceof Error ? failure.message : "Could not add the zone."); }
      finally { setBusy(false); }
    }, () => { setBusy(false); setNote("Location permission is off, so the zone could not be placed."); }, { enableHighAccuracy: true, timeout: 20000 });
  }
  async function remove(id: string) { try { setZones((await activities<{ zones: Zone[] }>(`privacy-zones/${id}`, "DELETE")).zones); } catch { setNote("Could not remove the zone."); } }
  return <section className="account-card zones-card"><h2>Privacy zones</h2>
    <p>Shared routes always hide 200 m at the start and end. Add a zone for places like home or work and any route you share hides it too. You always see your full route.</p>
    {zones.length > 0 && <ul className="zone-list">{zones.map(z => <li key={z.id}><span><strong>{z.label}</strong> · {z.radius_m} m</span><button type="button" onClick={() => void remove(z.id)}>Remove</button></li>)}</ul>}
    {zones.length < 5 && <div className="zone-add"><label>Name <input value={label} maxLength={40} onChange={e => setLabel(e.target.value)} /></label><label>Size <select value={radius} onChange={e => setRadius(Number(e.target.value))}>{[200, 300, 500, 800, 1000].map(r => <option key={r} value={r}>{r} m</option>)}</select></label><button className="account-secondary" disabled={busy} onClick={addHere}>Add where I am now</button></div>}
    {note && <p role="status" className="rep-replay-note">{note}</p>}
  </section>;
}
