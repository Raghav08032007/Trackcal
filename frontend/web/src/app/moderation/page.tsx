import { t, msg, date } from "@/lib/i18n";
// Moderators (admin role): reported posts, comments, profiles, events and challenges, grouped, with hide / restore / dismiss / pause;
// and challenge entries flagged for a large camera correction, with clear / remove (earned XP is never taken back).
import { useEffect, useState } from "react";
import { REPORT_REASONS, social } from "@/lib/social";

export const metadata = { title:msg("TrackCal — Moderation") };
type Kind = "post" | "comment" | "profile" | "event" | "challenge";
type Item = { target_type: Kind; target_id: string; reasons: string[]; content: string; hidden: boolean | null };
type Entry = { challenge_id: string; challenge: string; user_id: string; handle: string | null; joined_at: string; completed: boolean };

const KIND: Record<Kind, string> = { post: msg("Post"), comment: msg("Comment"), profile: msg("Profile"), event: msg("Event"), challenge: msg("Challenge") };
const reasonText = (id: string) => t(REPORT_REASONS.find(([value]) => value === id)?.[1] ?? id);

export default function Page() {
  const [queue, setQueue] = useState<Item[] | null>(null), [entries, setEntries] = useState<Entry[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = () => social<{ queue: Item[]; flagged_entries?: Entry[] }>("moderation").then(v => { setQueue(v.queue); setEntries(v.flagged_entries ?? []); setError(""); }, e => setError(e instanceof Error ? e.message : t("Unavailable.")));
  useEffect(() => { void load(); }, []);
  async function run(path: string, body: object) {
    if (busy) return; setBusy(true);
    try { await social(path, "POST", body); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("Action failed.")); } finally { setBusy(false); }
  }
  const act = (item: Item, action: string) => run("moderation", { target_type: item.target_type, target_id: item.target_id, action });
  const decide = (entry: Entry, action: "clear" | "remove") => run("moderation/entries", { challenge_id: entry.challenge_id, user_id: entry.user_id, action });
  return <main className="account-page"><div className="account-title"><span className="eyebrow">{t("MODERATION")}</span><h1>{t("Reports to review")}</h1>
    <p>{t("Content reported by 3 or more people is hidden until you decide. Act on the content, not the person; pause posting only for repeated or serious harm.")}</p></div>
    {error && <p role="alert">{error}</p>}
    {queue && !queue.length && <section className="account-card"><p>{t("Nothing to review.")}</p></section>}
    {queue?.map(item => <section className="account-card" key={item.target_type + item.target_id}>
      <h2>{t(KIND[item.target_type])} {item.hidden ? t("(hidden)") : ""}</h2><blockquote>{item.content}</blockquote>
      <p>{t("Reasons: {n}", { n: item.reasons.map(reasonText).join(", ") })}</p>
      <div className="account-actions">{item.target_type !== "profile" && (item.hidden
        ? <button disabled={busy} onClick={() => void act(item, "restore")}>{t("Restore")}</button>
        : <button disabled={busy} onClick={() => void act(item, "hide")}>{t("Hide")}</button>)}
        <button disabled={busy} onClick={() => void act(item, "dismiss")}>{t("Dismiss reports")}</button>
        <button disabled={busy} onClick={() => void act(item, "pause_posting")}>{t("Pause their posting")}</button></div>
    </section>)}
    {queue && <section className="account-card"><h2>{t("Flagged challenge entries")}</h2>
      <p>{t("A counted camera workout in these entries was corrected by a large amount. Nobody else sees the flag. Clear it if the correction looks honest, or remove the entry from the challenge. XP already earned is never taken back.")}</p>
      {!entries.length && <p>{t("No flagged entries.")}</p>}
      {entries.map(entry => <div className="studio-list-row" key={entry.challenge_id + entry.user_id}>
        <p><strong>{entry.challenge}</strong> · {entry.handle ? `@${entry.handle}` : t("No feed profile")} · {t("Joined {date}", { date: date(new Date(entry.joined_at), { dateStyle: "medium" }) })}{entry.completed ? ` · ${t("Completed")}` : ""}</p>
        <div className="account-actions"><button disabled={busy} onClick={() => void decide(entry, "clear")}>{t("Clear the flag")}</button>
          <button disabled={busy} onClick={() => void decide(entry, "remove")}>{t("Remove from the challenge")}</button></div>
      </div>)}
    </section>}
  </main>;
}
