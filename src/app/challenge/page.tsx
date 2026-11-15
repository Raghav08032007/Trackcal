// One challenge: your progress ring (computed on the server from what you logged), join/leave, how it counts.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { ReportItem } from "@/components/report-item";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { announceXp } from "@/lib/celebrate";
import { challenges, dates, METRIC_OPTIONS, goalText, type ChallengeView } from "@/lib/challenges";

export const metadata = { title: "TrackCal — Challenge" };

export default function Page() {
  const { id = "" } = useParams(); const { ready, user } = useAccount();
  const [c, setC] = useState<ChallengeView | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const load = useCallback(() => challenges<{ challenge: ChallengeView; awarded_xp: number }>("/" + id).then(v => { setC(v.challenge); setError(""); if (v.awarded_xp) { setNotice(`Challenge complete! +${v.awarded_xp} XP`); announceXp(v); } }, e => setError(e instanceof Error ? e.message : "Challenge not found.")), [id]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  async function act(path: string, method: string, message: string) {
    if (busy) return; setBusy(true); setNotice("");
    try { const v = await challenges<{ challenge: ChallengeView }>(`/${id}${path}`, method); setC(v.challenge); setNotice(message); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  if (!ready) return <main className="account-loading">Opening the challenge…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><p>Sign in to see this challenge.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  if (!c) return <main className="account-page"><section className="account-card"><p role={error ? "alert" : "status"}>{error || "Loading…"}</p><Link href="/challenges">All challenges</Link></section></main>;
  const pct = c.mine ? Math.min(100, Math.round(c.mine.progress / c.target * 100)) : 0, open = c.phase === "running" || c.phase === "upcoming";
  return <main className="account-page social-page"><section className="account-card challenge-cover">
    <span className="eyebrow">{c.phase === "running" ? "Running now" : c.phase === "upcoming" ? "Starts soon" : c.phase === "ended" ? "Finished" : "Cancelled"}{c.community ? <> · <Link href={`/c/${c.community.slug}`}>{c.community.name}</Link></> : null}</span>
    <h1>{c.title}</h1>
    <p>{goalText(c)} · {dates(c)}</p>
    {c.mine && <div className={`challenge-ring ${c.mine.completed ? "is-done" : ""}`} role="img" aria-label={`Your progress: ${c.mine.progress} of ${c.target}${c.mine.completed ? ", complete" : ""}`} style={{ "--pct": `${pct}%` } as React.CSSProperties}>
      <span><b>{c.mine.progress}</b>/{c.target}</span></div>}
    {c.mine?.completed && <p className="social-milestone">✓ You completed this challenge</p>}
    {c.description && <p className="community-rules">{c.description}</p>}
    <p>{c.participants} taking part · {c.finished} finished</p>
    <details><summary>How progress counts</summary><p>{METRIC_OPTIONS.find(([v]) => v === c.metric)?.[2]}. Only things logged during the challenge count; entries added later for earlier days don&apos;t. Progress updates when you open this page.</p></details>
    <div className="account-actions">
      {open && !c.mine && <button className="account-primary" disabled={busy} onClick={() => void act("/participation", "POST", "You're in! Log as usual and your progress fills in.")}>Join challenge</button>}
      {c.mine && !c.mine.completed && !c.created_by_me && <button disabled={busy} onClick={() => { if (confirm("Leave this challenge? You can't rejoin it.")) void act("/participation", "DELETE", "You left the challenge."); }}>Leave</button>}
      {c.hidden && <p role="status" className="camera-paused">This challenge is hidden from others while we review a report.</p>}
      {!c.created_by_me && <ReportItem type="challenge" id={c.id} label="challenge" />}
      {c.created_by_me && c.phase !== "cancelled" && <button disabled={busy} onClick={() => { if (confirm("Cancel this challenge for everyone?")) void act("", "DELETE", "Challenge cancelled."); }}>Cancel challenge</button>}
      <Link href="/challenges">All challenges</Link>
    </div>
    {notice && <p role="status">{notice}</p>}
  </section></main>;
}
