import { t, msg } from "@/lib/i18n";
// Moderators (admin role): reported posts, comments, profiles, events and challenges, grouped, with hide / restore / dismiss / pause.
import { useEffect, useState } from "react";
import { social } from "@/lib/social";

export const metadata = { title:msg("TrackCal — Moderation") };
type Item = { target_type: "post" | "comment" | "profile" | "event" | "challenge"; target_id: string; reasons: string[]; content: string; hidden: boolean | null };

export default function Page() {
  const [queue, setQueue] = useState<Item[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = () => social<{ queue: Item[] }>("moderation").then(v => { setQueue(v.queue); setError(""); }, e => setError(e instanceof Error ? e.message : t("Unavailable.")));
  useEffect(() => { void load(); }, []);
  async function act(item: Item, action: string) {
    if (busy) return; setBusy(true);
    try { await social("moderation", "POST", { target_type: item.target_type, target_id: item.target_id, action }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("Action failed.")); } finally { setBusy(false); }
  }
  return <main className="account-page"><div className="account-title"><span className="eyebrow">{t("MODERATION")}</span><h1>{t("Reports to review")}</h1>
    <p>{t("Content reported by 3 or more people is hidden until you decide. Act on the content, not the person; pause posting only for repeated or serious harm.")}</p></div>
    {error && <p role="alert">{error}</p>}
    {queue && !queue.length && <section className="account-card"><p>{t("Nothing to review.")}</p></section>}
    {queue?.map(item => <section className="account-card" key={item.target_type + item.target_id}>
      <h2>{item.target_type} {item.hidden ? t("(hidden)") : ""}</h2><blockquote>{item.content}</blockquote>
      <p>{t("Reasons: {n}", { n: item.reasons.join(", ") })}</p>
      <div className="account-actions">{item.target_type !== "profile" && (item.hidden
        ? <button disabled={busy} onClick={() => void act(item, "restore")}>{t("Restore")}</button>
        : <button disabled={busy} onClick={() => void act(item, "hide")}>{t("Hide")}</button>)}
        <button disabled={busy} onClick={() => void act(item, "dismiss")}>{t("Dismiss reports")}</button>
        <button disabled={busy} onClick={() => void act(item, "pause_posting")}>{t("Pause their posting")}</button></div>
    </section>)}
  </main>;
}
