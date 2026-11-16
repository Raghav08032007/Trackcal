// One community at /c/:slug: cover, rules, join / request / leave, its posts (feed post cards), a composer for
// members, and for moderators: requests, members and roles, reports, settings.
import { t } from "@/lib/i18n";
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
    } catch (e) { setError(e instanceof CommunityError && e.status === 404 ? t("This community isn't available.") : e instanceof Error ? e.message : t("Couldn't load.")); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);
  async function run(task: () => Promise<void>) { if (busy) return; setBusy(true); setNotice(""); try { await task(); } catch (e) { setNotice(e instanceof Error ? e.message : t("Something went wrong.")); } finally { setBusy(false); } }
  if (error) return <main className="account-page"><section className="account-card"><h1>{error}</h1><Link href="/communities">{t("Back to communities")}</Link></section></main>;
  if (!community) return <main className="account-loading">{t("Opening community…")}</main>;
  const m = community.membership, active = m?.status === "active";
  return <main className="account-page social-page">
    <section className="account-card community-cover">
      <span className="eyebrow">{CATEGORY_LABELS[community.category] || community.category} · {community.visibility === "private" ? t("private") : t("public")}{community.archived ? t(" · archived") : ""}</span>
      <h1>{community.name}</h1>{community.description && <p>{community.description}</p>}
      <p>{t("{count} members", { count: community.members })}{m ? (m.status === "pending" ? t(" · you're waiting for approval") : m.role === "member" ? t(" · you're a member") : t(" · you're the {role}", { role: t(m.role) })) : ""}</p>
      <div className="account-actions">
        {!m && !community.archived && <button className="account-primary" disabled={busy} onClick={() => void run(async () => { const r = await communities<{ membership: Community["membership"] }>(`${slug}/membership`, "POST"); setNotice(r.membership?.status === "pending" ? t("Request sent. A moderator will review it.") : t("Welcome in!")); await load(); })}>{community.visibility === "private" ? t("Request to join") : t("Join")}</button>}
        {m && m.role !== "owner" && <button disabled={busy} onClick={() => void run(async () => { await communities(`${slug}/membership`, "DELETE"); setNotice(m.status === "pending" ? t("Request withdrawn.") : t("You left the community.")); await load(); })}>{m.status === "pending" ? t("Withdraw request") : t("Leave")}</button>}
      </div>
      <details><summary>{t("Community rules")}</summary><p className="community-rules">{community.rules}</p></details>
    </section>
    {notice && <p role="status" className="push-note">{notice}</p>}
    {community.can_moderate && <div className="social-tabs" role="tablist" aria-label={t("Community tools")}>{([["posts", t("Posts")], ["requests", community.pending ? t("Requests ({n})", { n: community.pending }) : t("Requests")], ["members", t("Members")], ["reports", t("Reports")], ["settings", t("Settings")]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={panel === id} onClick={() => setPanel(id)}>{label}</button>)}</div>}
    {panel === "posts" && (locked ? <section className="account-card"><p>{t("This community is private. Request to join to see its posts.")}</p></section> : <>
      {active && !community.archived && <CommunityComposer slug={slug} onPosted={post => setPosts(rows => [post, ...rows])} />}
      <div className="social-list">{posts.map(p => <SocialPost key={p.id} post={p} onChange={u => setPosts(rows => rows.map(r => r.id === u.id ? u : r))} onRemove={(id, handle) => setPosts(rows => rows.filter(r => r.id !== id && (!handle || r.author.handle !== handle)))} />)}</div>
      {!posts.length && <section className="account-card"><p>{t("No posts yet.")}{active ? t(" Say hello!") : ""}</p></section>}
      {next && <button className="account-secondary social-more" disabled={busy} onClick={() => void run(async () => { const p = await communities<{ posts: FeedPost[]; next: string | null }>(`${slug}/posts?before=${encodeURIComponent(next)}`); setPosts(rows => [...rows, ...p.posts]); setNext(p.next); })}>{t("Show older posts")}</button>}
    </>)}
    {panel === "requests" && <MemberList slug={slug} status="pending" owner={m?.role === "owner"} onChange={load} />}
    {panel === "members" && <MemberList slug={slug} status="active" owner={m?.role === "owner"} onChange={load} />}
    {panel === "reports" && <Reports slug={slug} />}
    {panel === "settings" && <Settings community={community} owner={m?.role === "owner"} onSaved={c => { setCommunity(c); setNotice(t("Saved.")); }} />}
  </main>;
}

function CommunityComposer({ slug, onPosted }: { slug: string; onPosted: (post: FeedPost) => void }) {
  const [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="account-card social-composer" onSubmit={e => { e.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setError("");
    communities<{ post: FeedPost }>(`${slug}/posts`, "POST", { body }).then(r => { onPosted(r.post); setBody(""); }, err => setError(err instanceof Error ? err.message : t("Couldn't post."))).finally(() => setBusy(false)); }}>
    <label>{t("Post to this community")}<textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder={t("Share with the group…")} /></label>
    <div className="social-composer-row"><small>{t("{n} characters left · shown only in this community", { n: 500 - body.length })}</small><button className="account-primary" disabled={busy || !body.trim()}>{busy ? t("Posting…") : t("Post")}</button></div>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function MemberList({ slug, status, owner, onChange }: { slug: string; status: "active" | "pending"; owner: boolean; onChange: () => Promise<void> }) {
  const [rows, setRows] = useState<Member[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(() => communities<{ members: Member[] }>(`${slug}/members?status=${status}`).then(v => setRows(v.members), e => setError(e instanceof Error ? e.message : t("Unavailable."))), [slug, status]);
  useEffect(() => { void load(); }, [load]);
  const act = (handle: string, action: string) => { if (busy) return; setBusy(true); setError(""); communities(`${slug}/members/${handle}`, "POST", { action }).then(async () => { await load(); await onChange(); }, e => setError(e instanceof Error ? e.message : t("Failed."))).finally(() => setBusy(false)); };
  return <section className="account-card"><h2>{status === "pending" ? t("Join requests") : t("Members")}</h2>{error && <p role="alert">{error}</p>}
    {rows?.map(r => <div className="studio-list-row" key={r.handle}><span><Link href={`/u/${r.handle}`}>{r.display_name}</Link> @{r.handle} · {r.role}</span>
      {status === "pending" ? <><button className="account-primary" disabled={busy} onClick={() => act(r.handle, "approve")}>{t("Approve")}</button><button disabled={busy} onClick={() => act(r.handle, "remove")}>{t("Decline")}</button></>
        : r.role !== "owner" && <>{owner && <button disabled={busy} onClick={() => act(r.handle, r.role === "moderator" ? "make_member" : "make_moderator")}>{r.role === "moderator" ? t("Make member") : t("Make moderator")}</button>}
          <button disabled={busy} onClick={() => act(r.handle, "remove")}>{t("Remove")}</button><button disabled={busy} onClick={() => act(r.handle, "ban")}>{t("Ban")}</button></>}
    </div>)}
    {rows && !rows.length && <p>{status === "pending" ? t("No requests waiting.") : t("No members yet.")}</p>}</section>;
}

function Reports({ slug }: { slug: string }) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(() => communities<{ queue: QueueItem[] }>(`${slug}/moderation`).then(v => setQueue(v.queue), e => setError(e instanceof Error ? e.message : t("Unavailable."))), [slug]);
  useEffect(() => { void load(); }, [load]);
  const act = (item: QueueItem, action: string) => { if (busy) return; setBusy(true); communities(`${slug}/moderation`, "POST", { target_type: item.target_type, target_id: item.target_id, action }).then(load, e => setError(e instanceof Error ? e.message : t("Failed."))).finally(() => setBusy(false)); };
  return <section className="account-card"><h2>{t("Reports")}</h2><p>{t("Content reported by 3 or more people is hidden until you decide.")}</p>{error && <p role="alert">{error}</p>}
    {queue?.map(item => <div className="community-report" key={item.target_id}><blockquote>{item.content}</blockquote><small>{item.target_type} · {item.reasons.join(", ")}{item.hidden ? t(" · hidden") : ""}</small>
      <div className="account-actions">{item.hidden ? <button disabled={busy} onClick={() => act(item, "restore")}>{t("Restore")}</button> : <button disabled={busy} onClick={() => act(item, "hide")}>{t("Hide")}</button>}<button disabled={busy} onClick={() => act(item, "dismiss")}>{t("Dismiss")}</button></div></div>)}
    {queue && !queue.length && <p>{t("Nothing to review.")}</p>}</section>;
}

function Settings({ community, owner, onSaved }: { community: Community; owner: boolean; onSaved: (c: Community) => void }) {
  const [form, setForm] = useState({ name: community.name, description: community.description, category: community.category, visibility: community.visibility, rules: community.rules, archived: community.archived }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); communities<{ community: Community }>(community.slug, "PUT", form).then(r => onSaved(r.community), err => setError(err instanceof Error ? err.message : t("Couldn't save."))).finally(() => setBusy(false)); }}>
    <h2>{t("Settings")}</h2>
    <label>{t("Name")}<input required minLength={3} maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>{t("Description")}<textarea maxLength={500} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label>{t("Category")}<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>{t("Who can join")}<select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as Community["visibility"] })}><option value="public">{t("Anyone")}</option><option value="private">{t("By approval")}</option></select></label>
    <label>{t("Rules")}<textarea required minLength={10} maxLength={2000} rows={5} value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} /></label>
    {owner && <label className="push-switch"><input type="checkbox" checked={form.archived} onChange={e => setForm({ ...form, archived: e.target.checked })} /> {t("Archive (read-only, hidden from Discover)")}</label>}
    {error && <p role="alert">{error}</p>}
    <button className="account-primary" disabled={busy}>{busy ? t("Saving…") : t("Save settings")}</button>
  </form>;
}
