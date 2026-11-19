import { t, msg, date } from "@/lib/i18n";
// Moderators (admin role): reported posts, comments, profiles, events and challenges, grouped, with hide / restore / dismiss / pause;
// and challenge entries flagged for a large camera correction, with clear / remove (earned XP is never taken back).
import { useEffect, useState } from "react";
import { REPORT_REASONS, social } from "@/lib/social";
import { communities } from "@/lib/communities";

export const metadata = { title:msg("TrackCal — Moderation") };
type Kind = "post" | "comment" | "profile" | "event" | "challenge";
type Item = { target_type: Kind; target_id: string; reasons: string[]; content: string; hidden: boolean | null };
type Appeal = { id: string; community: string; slug: string | null; handle: string | null; note: string; created_at: string };
type CommunityRow = { slug: string; name: string; archived: boolean; members: number; moderators: number; banned: number; open_reports: number; open_appeals: number };
type Entry = { challenge_id: string; challenge: string; user_id: string; handle: string | null; joined_at: string; completed: boolean };

const KIND: Record<Kind, string> = { post: msg("Post"), comment: msg("Comment"), profile: msg("Profile"), event: msg("Event"), challenge: msg("Challenge") };
const reasonText = (id: string) => t(REPORT_REASONS.find(([value]) => value === id)?.[1] ?? id);

export default function Page() {
  const [queue, setQueue] = useState<Item[] | null>(null), [entries, setEntries] = useState<Entry[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [appeals, setAppeals] = useState<Appeal[] | null>(null), [overview, setOverview] = useState<CommunityRow[] | null>(null);
  const load = () => social<{ queue: Item[]; flagged_entries?: Entry[]; appeals?: Appeal[]; communities?: CommunityRow[] }>("moderation").then(v => { setQueue(v.queue); setEntries(v.flagged_entries ?? []); setAppeals(v.appeals ?? null); setOverview(v.communities ?? null); setError(""); }, e => setError(e instanceof Error ? e.message : t("Unavailable.")));
  useEffect(() => { void load(); }, []);
  async function run(path: string, body: object) {
    if (busy) return; setBusy(true);
    try { await social(path, "POST", body); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("Action failed.")); } finally { setBusy(false); }
  }
  const act = (item: Item, action: string) => run("moderation", { target_type: item.target_type, target_id: item.target_id, action });
  async function rule(appeal: Appeal, action: "reinstate" | "uphold") {
    if (busy) return; setBusy(true);
    try { await communities("appeals", "POST", { appeal_id: appeal.id, action }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("Action failed.")); } finally { setBusy(false); }
  }
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
    {appeals && <section className="account-card"><h2>{t("Ban appeals")}</h2>
      <p>{t("People removed from a community ask TrackCal to look again. Read the community's rules and the person's note. Reinstate lets them join again; keeping the ban means they can appeal again in 30 days.")}</p>
      {!appeals.length && <p>{t("No open appeals.")}</p>}
      {appeals.map(appeal => <div className="studio-list-row" key={appeal.id}>
        <p><strong>{appeal.community}</strong> · {appeal.handle ? `@${appeal.handle}` : t("No feed profile")} · {t("Sent {date}", { date: date(new Date(appeal.created_at), { dateStyle: "medium" }) })}</p>
        <blockquote>{appeal.note}</blockquote>
        <div className="account-actions"><button disabled={busy} onClick={() => void rule(appeal, "reinstate")}>{t("Reinstate")}</button>
          <button disabled={busy} onClick={() => void rule(appeal, "uphold")}>{t("Keep the ban")}</button></div>
      </div>)}
    </section>}
    {overview && <section className="account-card"><h2>{t("How communities are moderated")}</h2>
      <p>{t("Busiest first: open reports and appeals, then bans. A community with many bans or reports and few moderators may need a closer look.")}</p>
      {!overview.length ? <p>{t("No communities yet.")}</p> : <div className="table-scroll"><table className="moderation-table">
        <thead><tr><th scope="col">{t("Community")}</th><th scope="col">{t("Members")}</th><th scope="col">{t("Moderators")}</th><th scope="col">{t("Bans")}</th><th scope="col">{t("Open reports")}</th><th scope="col">{t("Open appeals")}</th></tr></thead>
        <tbody>{overview.map(row => <tr key={row.slug}><th scope="row"><a href={`/c/${row.slug}`}>{row.name}</a>{row.archived ? ` ${t("(archived)")}` : ""}</th>
          <td>{row.members}</td><td>{row.moderators}</td><td>{row.banned}</td><td>{row.open_reports}</td><td>{row.open_appeals}</td></tr>)}</tbody>
      </table></div>}
    </section>}
  </main>;
}
