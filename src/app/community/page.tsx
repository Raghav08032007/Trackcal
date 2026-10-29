// One community at /c/:slug: cover, rules, join / request / leave, its posts (feed post cards), a composer for
// members, and for moderators: requests, members and roles, reports, settings.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import Link from "@/lib/navigation";
import { SocialPost } from "@/components/social-post";
import type { FeedPost } from "@/lib/social";
import { CATEGORY_LABELS, communities, CommunityError, type Community, type Member, type QueueItem } from "@/lib/communities";

export const metadata = { title: "TrackCal — Community" };

export default function Page() {
  const { slug = "" } = useParams();
  const [community, setCommunity] = useState<Community | null>(null), [locked, setLocked] = useState(false), [posts, setPosts] = useState<FeedPost[]>([]), [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [panel, setPanel] = useState<"posts" | "requests" | "members" | "reports" | "settings">("posts");
  const load = useCallback(async () => {
    try {
      const v = await communities<{ community: Community; locked: boolean }>(slug); setCommunity(v.community); setLocked(v.locked); setError("");
      if (!v.locked) { const p = await communities<{ posts: FeedPost[]; next: string | null }>(`${slug}/posts`); setPosts(p.posts); setNext(p.next); }
    } catch (e) { setError(e instanceof CommunityError && e.status === 404 ? "This community isn't available." : e instanceof Error ? e.message : "Couldn't load."); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);
  async function run(task: () => Promise<void>) { if (busy) return; setBusy(true); setNotice(""); try { await task(); } catch (e) { setNotice(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } }
  if (error) return <main className="account-page"><section className="account-card"><h1>{error}</h1><Link href="/communities">Back to communities</Link></section></main>;
  if (!community) return <main className="account-loading">Opening community…</main>;
  const m = community.membership, active = m?.status === "active";
  return <main className="account-page social-page">
    <section className="account-card community-cover">
      <span className="eyebrow">{CATEGORY_LABELS[community.category] || community.category} · {community.visibility === "private" ? "private" : "public"}{community.archived ? " · archived" : ""}</span>
      <h1>{community.name}</h1>{community.description && <p>{community.description}</p>}
      <p>{community.members} {community.members === 1 ? "member" : "members"}{m ? ` · you're ${m.status === "pending" ? "waiting for approval" : m.role === "member" ? "a member" : `the ${m.role}`}` : ""}</p>
      <div className="account-actions">
        {!m && !community.archived && <button className="account-primary" disabled={busy} onClick={() => void run(async () => { const r = await communities<{ membership: Community["membership"] }>(`${slug}/membership`, "POST"); setNotice(r.membership?.status === "pending" ? "Request sent. A moderator will review it." : "Welcome in!"); await load(); })}>{community.visibility === "private" ? "Request to join" : "Join"}</button>}
        {m && m.role !== "owner" && <button disabled={busy} onClick={() => void run(async () => { await communities(`${slug}/membership`, "DELETE"); setNotice(m.status === "pending" ? "Request withdrawn." : "You left the community."); await load(); })}>{m.status === "pending" ? "Withdraw request" : "Leave"}</button>}
      </div>
      <details><summary>Community rules</summary><p className="community-rules">{community.rules}</p></details>
    </section>
    {notice && <p role="status" className="push-note">{notice}</p>}
    {community.can_moderate && <div className="social-tabs" role="tablist" aria-label="Community tools">{([["posts", "Posts"], ["requests", `Requests${community.pending ? ` (${community.pending})` : ""}`], ["members", "Members"], ["reports", "Reports"], ["settings", "Settings"]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={panel === id} onClick={() => setPanel(id)}>{label}</button>)}</div>}
    {panel === "posts" && (locked ? <section className="account-card"><p>This community is private. Request to join to see its posts.</p></section> : <>
      {active && !community.archived && <CommunityComposer slug={slug} onPosted={post => setPosts(rows => [post, ...rows])} />}
      <div className="social-list">{posts.map(p => <SocialPost key={p.id} post={p} onChange={u => setPosts(rows => rows.map(r => r.id === u.id ? u : r))} onRemove={(id, handle) => setPosts(rows => rows.filter(r => r.id !== id && (!handle || r.author.handle !== handle)))} />)}</div>
      {!posts.length && <section className="account-card"><p>No posts yet.{active ? " Say hello!" : ""}</p></section>}
      {next && <button className="account-secondary social-more" disabled={busy} onClick={() => void run(async () => { const p = await communities<{ posts: FeedPost[]; next: string | null }>(`${slug}/posts?before=${encodeURIComponent(next)}`); setPosts(rows => [...rows, ...p.posts]); setNext(p.next); })}>Show older posts</button>}
    </>)}
    {panel === "requests" && <MemberList slug={slug} status="pending" owner={m?.role === "owner"} onChange={load} />}
    {panel === "members" && <MemberList slug={slug} status="active" owner={m?.role === "owner"} onChange={load} />}
    {panel === "reports" && <Reports slug={slug} />}
    {panel === "settings" && <Settings community={community} owner={m?.role === "owner"} onSaved={c => { setCommunity(c); setNotice("Saved."); }} />}
  </main>;
}

function CommunityComposer({ slug, onPosted }: { slug: string; onPosted: (post: FeedPost) => void }) {
  const [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="account-card social-composer" onSubmit={e => { e.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setError("");
    communities<{ post: FeedPost }>(`${slug}/posts`, "POST", { body }).then(r => { onPosted(r.post); setBody(""); }, err => setError(err instanceof Error ? err.message : "Couldn't post.")).finally(() => setBusy(false)); }}>
    <label>Post to this community<textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder="Share with the group…" /></label>
    <div className="social-composer-row"><small>{500 - body.length} characters left · shown only in this community</small><button className="account-primary" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post"}</button></div>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function MemberList({ slug, status, owner, onChange }: { slug: string; status: "active" | "pending"; owner: boolean; onChange: () => Promise<void> }) {
  const [rows, setRows] = useState<Member[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(() => communities<{ members: Member[] }>(`${slug}/members?status=${status}`).then(v => setRows(v.members), e => setError(e instanceof Error ? e.message : "Unavailable.")), [slug, status]);
  useEffect(() => { void load(); }, [load]);
  const act = (handle: string, action: string) => { if (busy) return; setBusy(true); setError(""); communities(`${slug}/members/${handle}`, "POST", { action }).then(async () => { await load(); await onChange(); }, e => setError(e instanceof Error ? e.message : "Failed.")).finally(() => setBusy(false)); };
  return <section className="account-card"><h2>{status === "pending" ? "Join requests" : "Members"}</h2>{error && <p role="alert">{error}</p>}
    {rows?.map(r => <div className="studio-list-row" key={r.handle}><span><Link href={`/u/${r.handle}`}>{r.display_name}</Link> @{r.handle} · {r.role}</span>
      {status === "pending" ? <><button className="account-primary" disabled={busy} onClick={() => act(r.handle, "approve")}>Approve</button><button disabled={busy} onClick={() => act(r.handle, "remove")}>Decline</button></>
        : r.role !== "owner" && <>{owner && <button disabled={busy} onClick={() => act(r.handle, r.role === "moderator" ? "make_member" : "make_moderator")}>{r.role === "moderator" ? "Make member" : "Make moderator"}</button>}
          <button disabled={busy} onClick={() => act(r.handle, "remove")}>Remove</button><button disabled={busy} onClick={() => act(r.handle, "ban")}>Ban</button></>}
    </div>)}
    {rows && !rows.length && <p>{status === "pending" ? "No requests waiting." : "No members yet."}</p>}</section>;
}

function Reports({ slug }: { slug: string }) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(() => communities<{ queue: QueueItem[] }>(`${slug}/moderation`).then(v => setQueue(v.queue), e => setError(e instanceof Error ? e.message : "Unavailable.")), [slug]);
  useEffect(() => { void load(); }, [load]);
  const act = (item: QueueItem, action: string) => { if (busy) return; setBusy(true); communities(`${slug}/moderation`, "POST", { target_type: item.target_type, target_id: item.target_id, action }).then(load, e => setError(e instanceof Error ? e.message : "Failed.")).finally(() => setBusy(false)); };
  return <section className="account-card"><h2>Reports</h2><p>Content reported by 3 or more people is hidden until you decide.</p>{error && <p role="alert">{error}</p>}
    {queue?.map(item => <div className="community-report" key={item.target_id}><blockquote>{item.content}</blockquote><small>{item.target_type} · {item.reasons.join(", ")}{item.hidden ? " · hidden" : ""}</small>
      <div className="account-actions">{item.hidden ? <button disabled={busy} onClick={() => act(item, "restore")}>Restore</button> : <button disabled={busy} onClick={() => act(item, "hide")}>Hide</button>}<button disabled={busy} onClick={() => act(item, "dismiss")}>Dismiss</button></div></div>)}
    {queue && !queue.length && <p>Nothing to review.</p>}</section>;
}

function Settings({ community, owner, onSaved }: { community: Community; owner: boolean; onSaved: (c: Community) => void }) {
  const [form, setForm] = useState({ name: community.name, description: community.description, category: community.category, visibility: community.visibility, rules: community.rules, archived: community.archived }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); communities<{ community: Community }>(community.slug, "PUT", form).then(r => onSaved(r.community), err => setError(err instanceof Error ? err.message : "Couldn't save.")).finally(() => setBusy(false)); }}>
    <h2>Settings</h2>
    <label>Name<input required minLength={3} maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>Description<textarea maxLength={500} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Who can join<select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as Community["visibility"] })}><option value="public">Anyone</option><option value="private">By approval</option></select></label>
    <label>Rules<textarea required minLength={10} maxLength={2000} rows={5} value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} /></label>
    {owner && <label className="push-switch"><input type="checkbox" checked={form.archived} onChange={e => setForm({ ...form, archived: e.target.checked })} /> Archive (read-only, hidden from Discover)</label>}
    {error && <p role="alert">{error}</p>}
    <button className="account-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
  </form>;
}
