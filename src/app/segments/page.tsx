// Your segments: the ones you made and the ones you've been timed on, with your best on each.
import { useEffect, useState } from "react";
import { Bike, Flag, Footprints, Lock } from "lucide-react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { duration, km, segments, type Segment } from "@/lib/activities";
import "./segments.css";

export const metadata = { title: "TrackCal — Segments", description: "Your favourite stretches of road and path, timed on every run, walk and ride." };

export default function Page() {
  const { ready, user } = useAccount();
  const [rows, setRows] = useState<Segment[] | null>(null), [error, setError] = useState("");
  useEffect(() => { if (!user) return; segments<{ segments: Segment[] }>().then(r => setRows(r.segments)).catch(f => setError(f instanceof Error ? f.message : "Could not load segments.")); }, [user]);
  if (!ready) return <main className="account-loading">Loading…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Segments</h1><p>Sign in to see your segments.</p><Link className="account-primary" href="/login?next=/segments">Sign in</Link></section></main>;
  return <main className="wellness-page seg-page">
    <section className="seg-hero"><span className="eyebrow">MOVE · SEGMENTS</span><h1><Flag size={30} aria-hidden="true" /> Your <em>segments</em></h1>
      <p>Favourite stretches of road and path. Every run, walk or ride along one is timed from its route, so you can race your past self.</p></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {rows === null && !error ? <p className="account-loading">Loading segments…</p>
      : rows && rows.length ? <ul className="seg-grid">{rows.map(s => <li key={s.id}><Link href={`/segments/${s.id}`} className={`seg-tile seg-kind-${s.kind}`}>
        <span className="seg-tile-icon" aria-hidden="true">{s.kind === "ride" ? <Bike size={22} /> : <Footprints size={22} />}</span>
        <strong>{s.name}{s.visibility === "private" && <Lock size={13} aria-label="Only you" />}</strong>
        <small>{km(s.distance_m)} km · {s.attempts} {s.attempts === 1 ? "pass" : "passes"}</small>
        <span className="seg-tile-best">{s.best ? <>Best <b>{duration(s.best.elapsed_s)}</b></> : "Not timed yet"}</span></Link></li>)}</ul>
      : <section className="account-card seg-empty-card"><h2>No segments yet</h2><p>Open one of your runs, walks or rides and choose <strong>Make a segment</strong>. Pick a stretch you do often, like a hill or a park loop.</p><Link className="account-primary" href="/activities">Your activities</Link></section>}
  </main>;
}
