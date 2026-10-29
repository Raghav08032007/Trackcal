// The TrackCal feed (flag social_feed): pick a handle, then Following / Discover, share text or an app milestone.
import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { SocialPost } from "@/components/social-post";
import { avatar, CHARACTERS, social, SocialError, type FeedPost, type Profile } from "@/lib/social";

export const metadata = { title: "TrackCal — Feed" };
type Me = { profile: Profile | null; requests: number };

export default function Page() {
  const { ready, user } = useAccount();
  const [me, setMe] = useState<Me | null>(null), [error, setError] = useState(""), [off, setOff] = useState(false);
  const reload = useCallback(() => social<Me>("me").then(setMe).catch(e => { if (e instanceof SocialError && e.status === 404) setOff(true); else setError(e instanceof Error ? e.message : "Unavailable."); }), []);
  useEffect(() => { if (user) void reload(); }, [user, reload]);
  if (!ready) return <main className="account-loading">Opening the feed…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>The TrackCal feed</h1><p>Sign in to see what people are celebrating.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  if (off) return <main className="account-page"><section className="account-card"><h1>The feed isn&apos;t available yet</h1><p>It&apos;s coming soon.</p></section></main>;
  if (!me) return <main className="account-loading">{error || "Opening the feed…"}</main>;
  return <main className="account-page social-page">{me.profile ? <Feed profile={me.profile} requests={me.requests} /> : <ProfileSetup onDone={() => void reload()} />}</main>;
}

export function ProfileSetup({ onDone, current }: { onDone: () => void; current?: Profile }) {
  const [form, setForm] = useState({ handle: current?.handle || "", display_name: current?.display_name || "", bio: current?.bio || "", character_id: current?.character_id || "pip", private: current?.private || false });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <section className="account-card social-setup"><h1>{current ? "Edit your profile" : "Join the feed"}</h1>
    <p>Your profile and posts are public unless you make your account private. Share wins, not numbers: TrackCal never posts your meals, weight or calories for you.</p>
    <form className="account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); social("me", "PUT", form).then(onDone, err => setError(err instanceof Error ? err.message : "Couldn't save.")).finally(() => setBusy(false)); }}>
      <label>Handle<input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]{3,30}" value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="your.name" /></label>
      <label>Display name<input required maxLength={60} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
      <label>Bio<input maxLength={160} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="A line about you (optional)" /></label>
      <fieldset className="social-characters"><legend>Your avatar</legend>{CHARACTERS.map(id => <label key={id}><input type="radio" name="character" value={id} checked={form.character_id === id} onChange={() => setForm({ ...form, character_id: id })} /><img src={avatar(id)} alt={id} width={56} height={56} /></label>)}</fieldset>
      <label className="push-switch"><input type="checkbox" checked={form.private} onChange={e => setForm({ ...form, private: e.target.checked })} /> Private account (you approve who follows you)</label>
      {error && <p role="alert">{error}</p>}
      <button className="account-primary" disabled={busy}>{busy ? "Saving…" : current ? "Save profile" : "Create my profile"}</button>
    </form></section>;
}

function Feed({ profile, requests }: { profile: Profile; requests: number }) {
  const [tab, setTab] = useState<"following" | "discover">("following"), [posts, setPosts] = useState<FeedPost[]>([]), [next, setNext] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError("");
    try { const v = await social<{ posts: FeedPost[]; next: string | null }>(`feed?tab=${tab}${cursor ? "&before=" + encodeURIComponent(cursor) : ""}`); setPosts(rows => cursor ? [...rows, ...v.posts] : v.posts); setNext(v.next); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the feed."); } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { void load(); }, [load]);
  return <>
    <div className="account-title"><span className="eyebrow">THE FEED</span><h1>Wins worth sharing.</h1><p><Link href={`/u/${profile.handle}`}>@{profile.handle}</Link> · {profile.counts.followers} followers · {profile.counts.following} following</p></div>
    {requests > 0 && <p className="push-note"><Link href={`/u/${profile.handle}`}>{requests} follow {requests === 1 ? "request" : "requests"} waiting →</Link></p>}
    <Composer onPosted={post => { setTab("following"); setPosts(rows => [post, ...rows]); }} />
    <div className="social-tabs" role="tablist" aria-label="Feed">{(["following", "discover"] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "following" ? "Following" : "Discover"}</button>)}</div>
    {error && <p role="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
    <div className="social-list">{posts.map(p => <SocialPost key={p.id} post={p} onChange={u => setPosts(rows => rows.map(r => r.id === u.id ? u : r))}
      onRemove={(id, handle) => setPosts(rows => rows.filter(r => r.id !== id && (!handle || r.author.handle !== handle)))} />)}</div>
    {!loading && !posts.length && !error && <section className="account-card"><p>{tab === "following" ? "Nothing here yet. Share a win, or find people in Discover." : "No public posts yet. Be the first!"}</p></section>}
    {next && <button className="account-secondary social-more" disabled={loading} onClick={() => void load(next)}>{loading ? "Loading…" : "Show older posts"}</button>}
  </>;
}

function Composer({ onPosted }: { onPosted: (post: FeedPost) => void }) {
  const [body, setBody] = useState(""), [visibility, setVisibility] = useState<"public" | "followers">("public"), [milestones, setMilestones] = useState<{ type: string; ref: string; title: string }[]>([]), [chosen, setChosen] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { social<{ milestones: { type: string; ref: string; title: string }[] }>("milestones").then(v => setMilestones(v.milestones)).catch(() => {}); }, []);
  const milestone = milestones.find(m => `${m.type}:${m.ref}` === chosen);
  return <form className="account-card social-composer" onSubmit={e => { e.preventDefault(); if (busy || (!body.trim() && !milestone)) return; setBusy(true); setError("");
    social<{ post: FeedPost }>("posts", "POST", { body, visibility, ...(milestone ? { milestone: { type: milestone.type, ref: milestone.ref } } : {}) })
      .then(r => { onPosted(r.post); setBody(""); setChosen(""); }, err => setError(err instanceof Error ? err.message : "Couldn't post.")).finally(() => setBusy(false)); }}>
    <label>Share something<textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder="A small win, a tip, a thank-you…" /></label>
    <div className="social-composer-row">
      {milestones.length > 0 && <label>Add a milestone<select value={chosen} onChange={e => setChosen(e.target.value)}><option value="">None</option>{milestones.map(m => <option key={`${m.type}:${m.ref}`} value={`${m.type}:${m.ref}`}>{m.title}</option>)}</select></label>}
      <label>Who can see it<select value={visibility} onChange={e => setVisibility(e.target.value as "public" | "followers")}><option value="public">Everyone</option><option value="followers">Followers</option></select></label>
      <button className="account-primary" disabled={busy || (!body.trim() && !milestone)}>{busy ? "Posting…" : "Post"}</button>
    </div>
    <small>{500 - body.length} characters left</small>{error && <p role="alert">{error}</p>}
  </form>;
}
