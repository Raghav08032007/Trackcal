// A person's profile at /u/:handle: follow (or request), their posts, and report / mute / block. Your own profile
// also shows follow requests (private accounts) and lets you edit your details.
import { t, msg } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import Link from "@/lib/navigation";
import { SocialPost } from "@/components/social-post";
import { ProfileSetup } from "@/app/feed/page";
import { avatar, REPORT_REASONS, social, SocialError, type FeedPost, type Profile } from "@/lib/social";

export const metadata = { title:msg("TrackCal — Profile") };
type View = { profile: Profile; locked: boolean; posts: FeedPost[]; next: string | null };

export default function Page() {
  const { handle = "" } = useParams();
  const [view, setView] = useState<View | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [editing, setEditing] = useState(false);
  const [requests, setRequests] = useState<Profile[]>([]), [reporting, setReporting] = useState(false), [reason, setReason] = useState("harassment");
  const load = useCallback(async () => {
    try { setView(await social<View>(`profiles/${encodeURIComponent(handle.toLowerCase())}`)); setError(""); }
    catch (e) { setError(e instanceof SocialError && e.status === 404 ? t("This profile isn't available.") : e instanceof Error ? e.message : t("Couldn't load the profile.")); }
  }, [handle]);
  useEffect(() => { void load(); }, [load]);
  const own = !!view && !view.profile.relationship;
  useEffect(() => { if (own && view?.profile.private) social<{ requests: Profile[] }>("requests").then(v => setRequests(v.requests)).catch(() => {}); }, [own, view?.profile.private]);
  async function run(task: () => Promise<void>) { if (busy) return; setBusy(true); setNotice(""); try { await task(); } catch (e) { setNotice(e instanceof Error ? e.message : t("Something went wrong.")); } finally { setBusy(false); } }
  if (error) return <main className="account-page"><section className="account-card"><h1>{error}</h1><Link href="/feed">{t("Back to the feed")}</Link></section></main>;
  if (!view) return <main className="account-loading">{t("Opening profile…")}</main>;
  if (editing) return <main className="account-page social-page"><ProfileSetup current={view.profile} onDone={() => { setEditing(false); void load(); }} /></main>;
  const p = view.profile, rel = p.relationship;
  return <main className="account-page social-page">
    <section className="account-card social-profile">
      <img src={avatar(p.character_id)} alt="" width={96} height={96} />
      <div><h1>{p.display_name}</h1><p>@{p.handle}{p.private ? t(" · private account") : ""}</p>{p.bio && <p>{p.bio}</p>}
        <p className="social-counts">{t("{posts} posts · {followers} followers · {following} following", { posts: p.counts.posts, followers: p.counts.followers, following: p.counts.following })}{rel?.follows_you ? t(" · follows you") : ""}</p></div>
      <div className="account-actions">{own ? <button className="account-secondary" onClick={() => setEditing(true)}>{t("Edit profile")}</button> : <>
        {rel?.blocked ? <button disabled={busy} onClick={() => void run(async () => { await social(`block/${p.handle}`, "DELETE"); setNotice(t("Unblocked.")); await load(); })}>{t("Unblock")}</button>
          : <button className="account-primary" disabled={busy} onClick={() => void run(async () => { if (rel?.following) await social(`follow/${p.handle}`, "DELETE"); else await social(`follow/${p.handle}`, "POST"); await load(); })}>{rel?.following === "active" ? t("Following ✓") : rel?.following === "pending" ? t("Requested") : t("Follow")}</button>}
        <button disabled={busy} onClick={() => void run(async () => { await social(`block/${p.handle}`, "POST", { kind: "mute" }); setNotice(t("Muted @{handle}. Their posts won't show in your feed.", { handle: p.handle })); })}>{t("Mute")}</button>
        {!rel?.blocked && <button disabled={busy} onClick={() => void run(async () => { await social(`block/${p.handle}`, "POST", { kind: "block" }); setNotice(t("Blocked @{handle}.", { handle: p.handle })); await load(); })}>{t("Block")}</button>}
        <button onClick={() => setReporting(v => !v)}>{t("Report")}</button></>}</div>
    </section>
    {reporting && <form className="account-card social-report" onSubmit={e => { e.preventDefault(); void run(async () => { const r = await social<{ status: string }>("reports", "POST", { target_type: "profile", target_id: p.handle, reason }); setReporting(false); setNotice(r.status); }); }}>
      <label>{t("Why are you reporting this profile?")}<select value={reason} onChange={e => setReason(e.target.value)}>{REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="account-primary" disabled={busy}>{t("Send report")}</button></form>}
    {notice && <p role="status" className="push-note">{notice}</p>}
    {requests.length > 0 && <section className="account-card"><h2>{t("Follow requests")}</h2>{requests.map(r => <div className="studio-list-row" key={r.handle}><span>{r.display_name} @{r.handle}</span>
      <button className="account-primary" disabled={busy} onClick={() => void run(async () => { await social(`requests/${r.handle}`, "POST", { action: "approve" }); setRequests(rows => rows.filter(x => x.handle !== r.handle)); await load(); })}>{t("Approve")}</button>
      <button disabled={busy} onClick={() => void run(async () => { await social(`requests/${r.handle}`, "POST", { action: "decline" }); setRequests(rows => rows.filter(x => x.handle !== r.handle)); })}>{t("Decline")}</button></div>)}</section>}
    {view.locked ? <section className="account-card"><p>{t("This account is private. Follow to see their posts.")}</p></section>
      : <div className="social-list">{view.posts.map(post => <SocialPost key={post.id} post={post} onChange={u => setView(v => v && { ...v, posts: v.posts.map(x => x.id === u.id ? u : x) })} onRemove={id => setView(v => v && { ...v, posts: v.posts.filter(x => x.id !== id) })} />)}
        {!view.posts.length && <section className="account-card"><p>{t("No posts yet.")}</p></section>}</div>}
  </main>;
}
