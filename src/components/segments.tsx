// Segments on an activity (Phase G): the stretches it was timed on, with a medal for your best three, and for the owner a way to make
// a new segment from any stretch of the route. Public segments can't touch privacy zones or the hidden ends of a route (the server checks).
import { useMemo, useState } from "react";
import { Flag, Lock, Medal, Plus } from "lucide-react";
import Link, { useRouter } from "@/lib/navigation";
import { RouteMap } from "@/components/route-map";
import { duration, km, medal, pace, segments, type Activity, type RoutePoint, type Segment } from "@/lib/activities";
import "@/app/segments/segments.css";

/** A segment's line, in the shape the route map draws. */
export const segmentRoute = (points: [number, number][]): RoutePoint[] => points.map(p => [p[0], p[1], null, null, null]);

export function MedalBadge({ place }: { place: number }) {
  const m = medal(place);
  return m ? <span className={`seg-medal seg-${m.tone}`}><Medal size={14} aria-hidden="true" />{m.label}</span> : <span className="seg-place">#{place} of your times</span>;
}

export function SegmentsOnActivity({ activity: a }: { activity: Activity }) {
  const timed = a.segments ?? [], [making, setMaking] = useState(false);
  if (!timed.length && !a.mine) return null;
  return <section className="account-card seg-card" aria-labelledby="seg-title">
    <div className="seg-card-head"><h2 id="seg-title"><Flag size={20} aria-hidden="true" /> Segments</h2>
      {a.mine && a.distance_m >= 400 && !making && <button className="account-secondary" onClick={() => setMaking(true)}><Plus size={16} aria-hidden="true" /> Make a segment</button>}</div>
    {timed.length ? <ul className="seg-list">{timed.map((s, i) => <li key={s.segment_id + i} className={s.place <= 3 ? `seg-row seg-top-${s.place}` : "seg-row"}>
      <Link href={`/segments/${s.segment_id}`}><span className="seg-name"><strong>{s.name}</strong><small>{km(s.distance_m)} km · {pace(a.sport, s.distance_m, s.elapsed_s)}</small></span>
        <span className="seg-time"><strong>{duration(s.elapsed_s)}</strong><MedalBadge place={s.place} /></span></Link></li>)}</ul>
      : <p className="rep-replay-note">This route wasn&apos;t timed on any segment yet. Make one from a stretch you run or ride often, and every later pass along it is timed.</p>}
    {making && <SegmentMaker activity={a} onClose={() => setMaking(false)} />}
  </section>;
}

function SegmentMaker({ activity: a, onClose }: { activity: Activity; onClose: () => void }) {
  const router = useRouter(), total = Math.floor(a.distance_m / 10) * 10;
  const [start, setStart] = useState(Math.min(300, Math.max(0, total - 600))), [end, setEnd] = useState(Math.min(total, Math.max(start + 500, Math.round(total / 2 / 10) * 10)));
  const [name, setName] = useState(""), [visibility, setVisibility] = useState<"public" | "private">("public"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const stretch = useMemo(() => a.route.filter(p => p[4] !== null && p[4] >= start && p[4] <= end), [a.route, start, end]);
  const length = end - start, ok = length >= 200 && name.trim().length > 0;
  async function save() {
    setBusy(true); setError("");
    try { const r = await segments<{ segment: Segment }>("", "POST", { activity_id: a.id, name: name.trim(), start_m: start, end_m: end, visibility }); router.push(`/segments/${r.segment.id}`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not make this segment."); setBusy(false); }
  }
  return <div className="seg-maker">
    <h3>Pick the stretch</h3>
    {stretch.length >= 2 && <div className="seg-preview"><RouteMap route={stretch} showEnds label={`The stretch from ${km(start)} km to ${km(end)} km`} /></div>}
    <label className="seg-range">Starts at <strong>{km(start)} km</strong><input type="range" min={0} max={total} step={10} value={start} onChange={e => { const v = Number(e.target.value); setStart(Math.min(v, end - 200)); }} /></label>
    <label className="seg-range">Ends at <strong>{km(end)} km</strong><input type="range" min={0} max={total} step={10} value={end} onChange={e => { const v = Number(e.target.value); setEnd(Math.max(v, start + 200)); }} /></label>
    <p className="seg-length">{km(length)} km long{length < 200 ? " · at least 200 m" : ""}</p>
    <label className="seg-field">Name <input value={name} maxLength={60} placeholder="Park loop sprint" onChange={e => setName(e.target.value)} /></label>
    <fieldset className="visibility-choice"><legend>Who can see it</legend>
      <label><input type="radio" name="seg-vis" checked={visibility === "public"} onChange={() => setVisibility("public")} /> <span><strong>Everyone</strong><small>Anyone running or riding it is timed. It can&apos;t include your privacy zones or the first and last 200 m of this route.</small></span></label>
      <label><input type="radio" name="seg-vis" checked={visibility === "private"} onChange={() => setVisibility("private")} /> <span><strong><Lock size={13} aria-hidden="true" /> Only me</strong><small>Times only your own activities. Can be anywhere.</small></span></label>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="account-actions"><button className="account-primary" disabled={!ok || busy} onClick={() => void save()}>{busy ? "Timing your runs…" : "Make segment"}</button><button disabled={busy} onClick={onClose}>Cancel</button></div>
  </div>;
}
