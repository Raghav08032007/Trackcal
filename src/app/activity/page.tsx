// One activity: map, the numbers, splits, elevation, best efforts, and (for the owner) name, notes, sharing and delete.
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { ElevationProfile, RouteMap, SplitBars } from "@/components/route-map";
import { SocialPost } from "@/components/social-post";
import { avatar } from "@/lib/social";
import { VISIBILITY, activities, duration, km, pace, paceLabel, sportTitle, when, type Activity, type Visibility } from "@/lib/activities";

export const metadata = { title: "TrackCal — Activity" };

export default function Page() {
  const { id = "" } = useParams(), { ready, user } = useAccount();
  const [activity, setActivity] = useState<Activity | null>(null), [error, setError] = useState("");
  useEffect(() => { if (!user) return; let live = true; activities<{ activity: Activity }>(id).then(r => { if (live) setActivity(r.activity); }).catch(f => { if (live) setError(f instanceof Error ? f.message : "Could not load this activity."); }); return () => { live = false; }; }, [id, user]);
  if (!ready) return <main className="account-loading">Loading…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Activity</h1><p>Sign in to see this activity.</p><Link className="account-primary" href={`/login?next=/activities/${id}`}>Sign in</Link></section></main>;
  if (error) return <main className="wellness-page"><section className="account-card"><h1>Activity not found</h1><p>It may be private, or it was deleted.</p><Link href="/activities">Your activities →</Link></section></main>;
  if (!activity) return <main className="account-loading">Loading activity…</main>;
  return <View activity={activity} onChange={setActivity} />;
}

function View({ activity: a, onChange }: { activity: Activity; onChange: (a: Activity) => void }) {
  const router = useRouter(), [post, setPost] = useState(a.post);
  useEffect(() => { setPost(a.post); }, [a.post]);
  const [editing, setEditing] = useState(false), [name, setName] = useState(a.name), [notes, setNotes] = useState(a.notes ?? ""), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  async function patch(body: { name?: string; notes?: string; visibility?: Visibility }) {
    setBusy(true); setNote("");
    try { const r = await activities<{ activity: Activity }>(a.id, "PATCH", body); onChange(r.activity); setEditing(false); setNote("Saved."); }
    catch (failure) { setNote(failure instanceof Error ? failure.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Delete "${a.name}"? Its route, splits and any records it set are removed. This can't be undone.`)) return;
    setBusy(true);
    try { await activities(a.id, "DELETE"); router.push("/activities"); } catch { setBusy(false); setNote("Could not delete. Try again."); }
  }
  const best = a.best_efforts;
  return <main className="wellness-page activity-page">
    <Link className="back-link" href="/activities">← Activities</Link>
    <section className="activity-head"><span className="eyebrow">{sportTitle(a.sport).toUpperCase()} · {when(a.started_at)}</span>
      {editing ? <div className="activity-edit"><label>Name <input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label><label>Notes <textarea value={notes} maxLength={2000} rows={3} onChange={e => setNotes(e.target.value)} placeholder="How did it feel?" /></label>
        <div className="account-actions"><button className="account-primary" disabled={busy || !name.trim()} onClick={() => void patch({ name, notes })}>Save</button><button disabled={busy} onClick={() => { setEditing(false); setName(a.name); setNotes(a.notes ?? ""); }}>Cancel</button></div></div>
        : <><h1>{a.name}</h1>{a.notes && <p className="activity-notes">{a.notes}</p>}</>}
    </section>
    <section className="activity-grid">
      <div className="account-card activity-map-card"><RouteMap route={a.route} showEnds={a.mine} label={`Map of ${a.name}`} />{!a.mine && <p className="rep-replay-note">The start, end and the owner&apos;s private places are hidden.</p>}</div>
      <div className="account-card activity-stats-card">
        <dl className="big-numbers">
          <div><dt>Distance</dt><dd>{km(a.distance_m)}<small> km</small></dd></div>
          <div><dt>{paceLabel(a.sport)}</dt><dd>{pace(a.sport, a.distance_m, a.moving_s)}</dd></div>
          <div><dt>Moving time</dt><dd>{duration(a.moving_s)}</dd></div>
          <div><dt>Elevation gain</dt><dd>{Math.round(a.elevation_gain_m)}<small> m</small></dd></div>
          <div><dt>Elapsed</dt><dd>{duration(a.elapsed_s)}</dd></div>
          <div><dt>{a.sport === "ride" ? "Max speed" : "Fastest 10 s"}</dt><dd>{a.sport === "ride" ? `${(a.max_speed_ms * 3.6).toFixed(1)} km/h` : pace(a.sport, a.max_speed_ms * 60, 60)}</dd></div>
        </dl>
        {a.mine && a.fixes_used !== undefined && <p className="rep-replay-note">Measured from {a.fixes_used} GPS points{a.fixes_dropped ? `; ${a.fixes_dropped} rough or impossible points were left out` : ""}. Pauses don&apos;t count towards moving time.</p>}
      </div>
    </section>
    <ElevationProfile route={a.route} />
    {a.splits.length > 0 && <section className="account-card"><h2>Splits</h2><SplitBars splits={a.splits} sport={a.sport} /></section>}
    {best.length > 0 && <section className="account-card"><h2>Best efforts</h2><ul className="best-efforts">{best.map(e => <li key={e.label}><span>{e.label}</span><strong>{duration(e.seconds)}</strong><small>{pace(a.sport, e.distance_m, e.seconds)}</small></li>)}</ul></section>}
    {a.together.length > 0 && <section className="account-card together"><h2>Together</h2><ul>{a.together.map(t => <li key={t.activity_id}><Link href={`/activities/${t.activity_id}`}><img src={avatar(t.character_id)} alt="" width={36} height={36} /><span><strong>{t.display_name}</strong><small>@{t.handle}</small></span></Link></li>)}</ul></section>}
    {post ? <section className="account-card activity-social"><h2>Kudos and comments</h2><SocialPost post={post} onChange={setPost} onRemove={() => setPost(null)} /></section>
      : a.mine && a.visibility !== "private" && <p className="rep-replay-note activity-feed-hint">To show this in the feed with kudos and comments, <Link href="/feed">choose a handle in Feed</Link>, then change who can see it.</p>}
    {a.mine && <section className="account-card activity-owner"><h2>Sharing</h2>
      <fieldset className="visibility-choice"><legend className="sr-only">Who can see it</legend>{VISIBILITY.map(v => <label key={v.id}><input type="radio" name="visibility" disabled={busy} checked={a.visibility === v.id} onChange={() => void patch({ visibility: v.id })} /> <span><strong>{v.title}</strong><small>{v.detail}</small></span></label>)}</fieldset>
      <div className="account-actions">{!editing && <button onClick={() => setEditing(true)}>Edit name and notes</button>}<button className="danger-button" disabled={busy} onClick={() => void remove()}>Delete activity</button></div>
      {note && <p role="status" className="rep-replay-note">{note}</p>}
    </section>}
  </main>;
}
