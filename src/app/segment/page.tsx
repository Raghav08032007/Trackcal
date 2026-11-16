import { t, msg } from "@/lib/i18n";
// One segment: its line, your best and every pass, and, if you opt in, a ranking among friends who opted in too.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { Flag, Lock, Trophy, Users } from "lucide-react";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { RouteMap } from "@/components/route-map";
import { segmentRoute } from "@/components/segments";
import { avatar } from "@/lib/social";
import { duration, km, segments, type Segment } from "@/lib/activities";
import "@/app/segments/segments.css";

export const metadata = { title:msg("TrackCal — Segment") };

export default function Page() {
  const { id = "" } = useParams(), { ready, user } = useAccount(), router = useRouter();
  const [segment, setSegment] = useState<Segment | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => segments<{ segment: Segment }>(id).then(r => setSegment(r.segment)).catch(f => setError(f instanceof Error ? f.message : t("Could not load this segment."))), [id]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  if (!ready) return <main className="account-loading">{t("Loading…")}</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>{t("Segment")}</h1><p>{t("Sign in to see this segment.")}</p><Link className="account-primary" href={`/login?next=/segments/${id}`}>{t("Sign in")}</Link></section></main>;
  if (error) return <main className="wellness-page"><section className="account-card"><h1>{t("Segment not found")}</h1><p>{t("It may be private, or it was removed.")}</p><Link href="/segments">{t("Your segments →")}</Link></section></main>;
  if (!segment) return <main className="account-loading">{t("Loading segment…")}</main>;
  const s = segment, history = s.history ?? [], slowest = Math.max(...history.map(h => h.elapsed_s), 1);
  // The switch moves at once; the ranking fills in when the server answers, and the switch moves back if saving fails.
  async function ranking(on: boolean) {
    setSegment({ ...s, ranking: { opted_in: on, entries: on ? s.ranking.entries : [] } }); setBusy(true);
    try { await segments("settings", "PATCH", { ranking: on }); await load(); } catch { setSegment(s); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(t("Remove “{name}”? Its times are removed for everyone. This can't be undone.", { name: s.name }))) return;
    setBusy(true); try { await segments(s.id, "DELETE"); router.push("/segments"); } catch { setBusy(false); }
  }
  return <main className="wellness-page seg-page">
    <Link className="back-link" href="/segments">{t("← Segments")}</Link>
    <section className="seg-hero"><span className="eyebrow">{s.kind === "ride" ? t("RIDE SEGMENT") : t("RUN AND WALK SEGMENT")}{s.visibility === "private" && <> · <Lock size={12} aria-hidden="true" /> {t("ONLY YOU")}</>}</span>
      <h1><Flag size={30} aria-hidden="true" /> {s.name}</h1>
      <dl className="seg-stats"><div><dt>{t("Length")}</dt><dd>{km(s.distance_m)}<small> km</small></dd></div><div><dt>{t("Your best")}</dt><dd>{s.best ? duration(s.best.elapsed_s) : "—"}</dd></div><div><dt>{t("Your passes")}</dt><dd>{s.attempts}</dd></div></dl>
    </section>
    <section className="activity-grid">
      {s.points && s.points.length > 1 && <div className="account-card activity-map-card"><RouteMap route={segmentRoute(s.points)} showEnds label={t("Map of {name}", { name: s.name })} /></div>}
      <div className="account-card seg-history"><h2><Trophy size={20} aria-hidden="true" /> {t("Your times")}</h2>
        {history.length ? <ol>{history.map((h, i) => { const best = s.best && h.activity_id === s.best.activity_id && h.elapsed_s === s.best.elapsed_s; return <li key={h.activity_id + i} className={best ? "is-best" : ""}>
          <Link href={`/activities/${h.activity_id}`}><span>{new Date(h.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            <span className="seg-bar" aria-hidden="true"><i style={{ width: `${Math.max(12, 100 * h.elapsed_s / slowest)}%` }} /></span><strong>{duration(h.elapsed_s)}</strong>{best && <span className="seg-medal seg-gold">{t("Best")}</span>}</Link></li>; })}</ol>
          : <p className="rep-replay-note">{t("No passes yet. Run or ride along it, start to end, and your time appears here.")}</p>}
      </div>
    </section>
    {s.visibility === "public" && <section className="account-card seg-ranking" aria-labelledby="rank-title">
      <h2 id="rank-title"><Users size={20} aria-hidden="true" /> {t("Friends ranking")}</h2>
      <label className="pref-switch"><input type="checkbox" role="switch" checked={s.ranking.opted_in} disabled={busy} onChange={e => void ranking(e.target.checked)} /> {t("Show me a ranking with friends")}</label>
      <p className="rep-replay-note">{t("Only people you follow who follow you back, and who also turned this on, from activities you're allowed to see. No rankings of strangers. Your own times always stay yours.")}</p>
      {s.ranking.opted_in && (s.ranking.entries.length > 1 ? <ol className="seg-rank">{s.ranking.entries.map(e => <li key={e.place + (e.handle ?? "")} className={e.me ? "is-me" : ""}>
        <span className={`seg-pos seg-pos-${Math.min(e.place, 4)}`}>{e.place}</span><img src={avatar(e.character_id)} alt="" width={36} height={36} />
        <span className="seg-who"><strong>{e.me ? t("You") : e.display_name}</strong>{e.handle && !e.me && <small>@{e.handle}</small>}</span><strong>{duration(e.elapsed_s)}</strong></li>)}</ol>
        : <p className="seg-empty">{t("No friends on this one yet. When people you follow back, who turned the ranking on, pass along it, they appear here.")}</p>)}
    </section>}
    {s.mine && <div className="account-actions"><button className="danger-button" disabled={busy} onClick={() => void remove()}>{t("Remove segment")}</button></div>}
  </main>;
}
