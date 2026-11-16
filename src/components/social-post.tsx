// One post in the feed: author, text, milestone, reactions with counts, comments, and a menu to report, mute,
// block or delete. Every action goes to the server, which decides what's allowed.
import { t } from "@/lib/i18n";
import { useState } from "react";
import Link from "@/lib/navigation";
import { ago, avatar, REACTIONS, REPORT_REASONS, social, type ActivityCard, type Comment, type FeedPost } from "@/lib/social";
import { RouteThumb } from "@/components/route-map";
import { duration, km, pace, sportTitle } from "@/lib/activities";

export function SocialPost({ post, onChange, onRemove }: { post: FeedPost; onChange: (post: FeedPost) => void; onRemove: (id: string, authorHandle?: string) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [menu, setMenu] = useState(false), [reporting, setReporting] = useState<"post" | "profile" | null>(null), [reason, setReason] = useState<string>("harassment");
  async function run(task: () => Promise<void>) { if (busy) return; setBusy(true); setMessage(""); try { await task(); } catch (e) { setMessage(e instanceof Error ? e.message : t("Something went wrong.")); } finally { setBusy(false); } }
  const react = (kind: string) => run(async () => onChange((await social<{ post: FeedPost }>(`posts/${post.id}/reactions`, post.my_reaction === kind ? "DELETE" : "POST", post.my_reaction === kind ? undefined : { kind })).post));
  const loadComments = () => run(async () => setComments((await social<{ comments: Comment[] }>(`posts/${post.id}/comments`)).comments));
  const total = Object.values(post.reactions).reduce((a, b) => a + b, 0);
  return <article className="social-post" aria-labelledby={`post-${post.id}`}>
    <header>
      <Link href={`/u/${post.author.handle}`} className="social-author"><img src={avatar(post.author.character_id)} alt="" width={44} height={44} /><span><strong id={`post-${post.id}`}>{post.author.display_name}</strong><small>@{post.author.handle} · {ago(post.created_at)}{post.visibility === "followers" ? t(" · followers") : ""}</small></span></Link>
      <button className="social-menu-button" aria-label={t("More options for {display_name}'s post", { display_name: post.author.display_name })} aria-expanded={menu} onClick={() => setMenu(v => !v)}>…</button>
    </header>
    {menu && <div className="social-menu" role="group" aria-label={t("Post options")}>
      {post.mine ? <button onClick={() => void run(async () => { await social(`posts/${post.id}`, "DELETE"); onRemove(post.id); })}>{t("Delete post")}</button> : <>
        <button onClick={() => { setReporting("post"); setMenu(false); }}>{t("Report post")}</button>
        <button onClick={() => void run(async () => { await social(`block/${post.author.handle}`, "POST", { kind: "mute" }); onRemove(post.id, post.author.handle); })}>{t("Mute @{handle}", { handle: post.author.handle })}</button>
        <button onClick={() => void run(async () => { await social(`block/${post.author.handle}`, "POST", { kind: "block" }); onRemove(post.id, post.author.handle); })}>{t("Block @{handle}", { handle: post.author.handle })}</button>
      </>}
    </div>}
    {post.milestone?.activity ? <ActivityCardView title={post.milestone.title} card={post.milestone.activity} /> : post.milestone && <p className="social-milestone"><span aria-hidden="true">✦</span> {post.milestone.title}</p>}
    {post.body && <p className="social-body">{post.body}</p>}
    <div className="social-reactions" role="group" aria-label={t("Reactions")}>
      {REACTIONS.map(r => <button key={r.kind} aria-pressed={post.my_reaction === r.kind} disabled={busy} onClick={() => void react(r.kind)} aria-label={`${r.label}, ${post.reactions[r.kind]}`}><span aria-hidden="true">{r.icon}</span> {post.reactions[r.kind]}</button>)}
      <button onClick={() => comments ? setComments(null) : void loadComments()} aria-expanded={!!comments}>💬 {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}</button>
      <span className="social-total">{total} {total === 1 ? "reaction" : "reactions"}</span>
    </div>
    {reporting && <form className="social-report" onSubmit={e => { e.preventDefault(); void run(async () => { const r = await social<{ status: string }>("reports", "POST", { target_type: "post", target_id: post.id, reason }); setReporting(null); setMessage(r.status); }); }}>
      <label>{t("Why are you reporting this?")}<select value={reason} onChange={e => setReason(e.target.value)}>{REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="account-primary" disabled={busy}>{t("Send report")}</button><button type="button" onClick={() => setReporting(null)}>{t("Cancel")}</button>
    </form>}
    {comments && <section className="social-comments" aria-label={t("Comments")}>
      {comments.map(c => <div key={c.id} className="social-comment"><Link href={`/u/${c.author.handle}`}><strong>{c.author.display_name}</strong></Link> <span>{c.body}</span>{c.can_delete && <button aria-label={t("Delete comment")} onClick={() => void run(async () => { await social(`comments/${c.id}`, "DELETE"); setComments(rows => rows!.filter(x => x.id !== c.id)); onChange({ ...post, comment_count: Math.max(0, post.comment_count - 1) }); })}>×</button>}</div>)}
      <form onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; void run(async () => { const r = await social<{ comment: Comment }>(`posts/${post.id}/comments`, "POST", { body: draft }); setComments(rows => [...(rows || []), r.comment]); setDraft(""); onChange({ ...post, comment_count: post.comment_count + 1 }); }); }}>
        <label className="sr-only" htmlFor={`comment-${post.id}`}>{t("Write a comment")}</label>
        <input id={`comment-${post.id}`} value={draft} maxLength={300} placeholder={t("Write something kind…")} onChange={e => setDraft(e.target.value)} />
        <button disabled={busy || !draft.trim()}>{t("Reply")}</button>
      </form>
    </section>}
    {message && <p role="status" className="social-note">{message}</p>}
  </article>;
}

/** A shared walk, run, hike or ride: its outline and numbers, linking to the full activity. */
function ActivityCardView({ title, card }: { title: string; card: ActivityCard }) {
  return <Link className="feed-activity" href={`/activities/${card.id}`}>
    <RouteThumb preview={card.preview} />
    <div><span className="activity-meta">{sportTitle(card.sport)}</span><strong className="feed-activity-title">{title}</strong>
      <dl className="activity-numbers"><div><dt>{t("Distance")}</dt><dd>{km(card.distance_m)} km</dd></div><div><dt>{card.sport === "ride" ? t("Speed") : t("Pace")}</dt><dd>{pace(card.sport, card.distance_m, card.moving_s)}</dd></div><div><dt>{t("Time")}</dt><dd>{duration(card.moving_s)}</dd></div>{card.elevation_gain_m >= 5 && <div><dt>{t("Climb")}</dt><dd>{Math.round(card.elevation_gain_m)} m</dd></div>}</dl>
      {card.records.length > 0 && <span className="feed-records">🏆 {card.records.length === 1 ? t("New record: {n}", { n: card.records[0] }) : t("{length} new records", { length: card.records.length })}</span>}</div>
  </Link>;
}
