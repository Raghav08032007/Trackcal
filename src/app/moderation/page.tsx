// Moderators (admin role): reported posts, comments and profiles, grouped, with hide / restore / dismiss / pause.
import { useEffect, useState } from "react";
import { social } from "@/lib/social";

export const metadata = { title: "TrackCal — Moderation" };
type Item = { target_type: "post" | "comment" | "profile"; target_id: string; reasons: string[]; content: string; hidden: boolean | null };

export default function Page() {
  const [queue, setQueue] = useState<Item[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = () => social<{ queue: Item[] }>("moderation").then(v => { setQueue(v.queue); setError(""); }, e => setError(e instanceof Error ? e.message : "Unavailable."));
  useEffect(() => { void load(); }, []);
  async function act(item: Item, action: string) {
    if (busy) return; setBusy(true);
    try { await social("moderation", "POST", { target_type: item.target_type, target_id: item.target_id, action }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); } finally { setBusy(false); }
  }
  return <main className="account-page"><div className="account-title"><span className="eyebrow">MODERATION</span><h1>Reports to review</h1>
    <p>Content reported by 3 or more people is hidden until you decide. Act on the content, not the person; pause posting only for repeated or serious harm.</p></div>
    {error && <p role="alert">{error}</p>}
    {queue && !queue.length && <section className="account-card"><p>Nothing to review.</p></section>}
    {queue?.map(item => <section className="account-card" key={item.target_type + item.target_id}>
      <h2>{item.target_type} {item.hidden ? "(hidden)" : ""}</h2><blockquote>{item.content}</blockquote>
      <p>Reasons: {item.reasons.join(", ")}</p>
      <div className="account-actions">{item.target_type !== "profile" && (item.hidden
        ? <button disabled={busy} onClick={() => void act(item, "restore")}>Restore</button>
        : <button disabled={busy} onClick={() => void act(item, "hide")}>Hide</button>)}
        <button disabled={busy} onClick={() => void act(item, "dismiss")}>Dismiss reports</button>
        <button disabled={busy} onClick={() => void act(item, "pause_posting")}>Pause their posting</button></div>
    </section>)}
  </main>;
}
