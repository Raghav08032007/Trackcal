// The TrackCal feed (flag social_feed): pick a handle, then Following / Discover, share text or an app milestone.
import { t, msg } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { SocialPost } from "@/components/social-post";
import { avatar, CHARACTERS, social, SocialError, type FeedPost, type Profile } from "@/lib/social";

export const metadata = { title:msg("TrackCal — Feed") };
type Me = { profile: Profile | null; requests: number };

export default function Page() {
  const { ready, user } = useAccount();
  const [me, setMe] = useState<Me | null>(null), [error, setError] = useState(""), [off, setOff] = useState(false);
  const reload = useCallback(() => social<Me>("me").then(setMe).catch(e => { if (e instanceof SocialError && e.status === 404) setOff(true); else setError(e instanceof Error ? e.message : t("Unavailable.")); }), []);
  useEffect(() => { if (user) void reload(); }, [user, reload]);
  if (!ready) return <main className="account-loading">{t("Opening the feed…")}</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>{t("The TrackCal feed")}</h1><p>{t("Sign in to see what people are celebrating.")}</p><Link className="account-primary" href="/login">{t("Sign in")}</Link></section></main>;
  if (off) return <main className="account-page"><section className="account-card"><h1>{t("The feed isn't available yet")}</h1><p>{t("It's coming soon.")}</p></section></main>;
  if (!me) return <main className="account-loading">{error || t("Opening the feed…")}</main>;
  return <main className="account-page social-page">{me.profile ? <Feed profile={me.profile} requests={me.requests} /> : <ProfileSetup onDone={() => void reload()} />}</main>;
}

export function ProfileSetup({ onDone, current }: { onDone: () => void; current?: Profile }) {
  const [form, setForm] = useState({ handle: current?.handle || "", display_name: current?.display_name || "", bio: current?.bio || "", character_id: current?.character_id || "pip", private: current?.private || false });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <section className="account-card social-setup"><h1>{current ? t("Edit your profile") : t("Join the feed")}</h1>
    <p>{t("Your profile and posts are public unless you make your account private. Share wins, not numbers: TrackCal never posts your meals, weight or calories for you.")}</p>
    <form className="account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); social("me", "PUT", form).then(onDone, err => setError(err instanceof Error ? err.message : t("Couldn't save."))).finally(() => setBusy(false)); }}>
      <label>{t("Handle")}<input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]{3,30}" value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder={t("your.name")} /></label>
      <label>{t("Display name")}<input required maxLength={60} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
      <label>{t("Bio")}<input maxLength={160} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder={t("A line about you (optional)")} /></label>
      <fieldset className="social-characters"><legend>{t("Your avatar")}</legend>{CHARACTERS.map(id => <label key={id}><input type="radio" name="character" value={id} checked={form.character_id === id} onChange={() => setForm({ ...form, character_id: id })} /><img src={avatar(id)} alt={id} width={56} height={56} /></label>)}</fieldset>
      <label className="push-switch"><input type="checkbox" checked={form.private} onChange={e => setForm({ ...form, private: e.target.checked })} /> {t("Private account (you approve who follows you)")}</label>
      {error && <p role="alert">{error}</p>}
      <button className="account-primary" disabled={busy}>{busy ? t("Saving…") : current ? t("Save profile") : t("Create my profile")}</button>
    </form></section>;
}

function Feed({ profile, requests }: { profile: Profile; requests: number }) {
  const [tab, setTab] = useState<"following" | "discover">("following"), [posts, setPosts] = useState<FeedPost[]>([]), [next, setNext] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError("");
    try { const v = await social<{ posts: FeedPost[]; next: string | null }>(`feed?tab=${tab}${cursor ? "&before=" + encodeURIComponent(cursor) : ""}`); setPosts(rows => cursor ? [...rows, ...v.posts] : v.posts); setNext(v.next); }
    catch (e) { setError(e instanceof Error ? e.message : t("Couldn't load the feed.")); } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { void load(); }, [load]);
  return <>
    <div className="account-title"><span className="eyebrow">{t("THE FEED")}</span><h1>{t("Wins worth sharing.")}</h1><p><Link href={`/u/${profile.handle}`}>@{profile.handle}</Link>{" "}{t("· {followers} followers · {following} following", { followers: profile.counts.followers, following: profile.counts.following })}</p></div>
    {requests > 0 && <p className="push-note"><Link href={`/u/${profile.handle}`}>{t("{count} follow requests waiting →", { count: requests })}</Link></p>}
    <Composer onPosted={post => { setTab("following"); setPosts(rows => [post, ...rows]); }} />
    <div className="social-tabs" role="tablist" aria-label={t("Feed")}>{(["following", "discover"] as const).map(option => <button key={option} role="tab" aria-selected={tab === option} onClick={() => setTab(option)}>{option === "following" ? t("Following") : t("Discover")}</button>)}</div>
    {error && <p role="alert">{error} <button onClick={() => void load()}>{t("Retry")}</button></p>}
    <div className="social-list">{posts.map(p => <SocialPost key={p.id} post={p} onChange={u => setPosts(rows => rows.map(r => r.id === u.id ? u : r))}
      onRemove={(id, handle) => setPosts(rows => rows.filter(r => r.id !== id && (!handle || r.author.handle !== handle)))} />)}</div>
    {!loading && !posts.length && !error && <section className="account-card"><p>{tab === "following" ? t("Nothing here yet. Share a win, or find people in Discover.") : t("No public posts yet. Be the first!")}</p></section>}
    {next && <button className="account-secondary social-more" disabled={loading} onClick={() => void load(next)}>{loading ? t("Loading…") : t("Show older posts")}</button>}
  </>;
}

function Composer({ onPosted }: { onPosted: (post: FeedPost) => void }) {
  const [body, setBody] = useState(""), [visibility, setVisibility] = useState<"public" | "followers">("public"), [milestones, setMilestones] = useState<{ type: string; ref: string; title: string }[]>([]), [chosen, setChosen] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { social<{ milestones: { type: string; ref: string; title: string }[] }>("milestones").then(v => setMilestones(v.milestones)).catch(() => {}); }, []);
  const milestone = milestones.find(m => `${m.type}:${m.ref}` === chosen);
  return <form className="account-card social-composer" onSubmit={e => { e.preventDefault(); if (busy || (!body.trim() && !milestone)) return; setBusy(true); setError("");
    social<{ post: FeedPost }>("posts", "POST", { body, visibility, ...(milestone ? { milestone: { type: milestone.type, ref: milestone.ref } } : {}) })
      .then(r => { onPosted(r.post); setBody(""); setChosen(""); }, err => setError(err instanceof Error ? err.message : t("Couldn't post."))).finally(() => setBusy(false)); }}>
    <label>{t("Share something")}<textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder={t("A small win, a tip, a thank-you…")} /></label>
    <div className="social-composer-row">
      {milestones.length > 0 && <label>{t("Add a milestone")}<select value={chosen} onChange={e => setChosen(e.target.value)}><option value="">{t("None")}</option>{milestones.map(m => <option key={`${m.type}:${m.ref}`} value={`${m.type}:${m.ref}`}>{m.title}</option>)}</select></label>}
      <label>{t("Who can see it")}<select value={visibility} onChange={e => setVisibility(e.target.value as "public" | "followers")}><option value="public">{t("Everyone")}</option><option value="followers">{t("Followers")}</option></select></label>
      <button className="account-primary" disabled={busy || (!body.trim() && !milestone)}>{busy ? t("Posting…") : t("Post")}</button>
    </div>
    <small>{t("{n} characters left", { n: 500 - body.length })}</small>{error && <p role="alert">{error}</p>}
  </form>;
}
