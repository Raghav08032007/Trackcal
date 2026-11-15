// Your segments: the ones you made and the ones you've been timed on, with your best on each.
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Bike, Flag, Footprints, Lock } from "lucide-react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { duration, km, segments, type Segment } from "@/lib/activities";
import "./segments.css";

export const metadata = { title: "TrackCal — Segments", description: "Your favourite stretches of road and path, timed on every run, walk and ride." };

export default function Page() {
  const { ready, user } = useAccount();
  const [rows, setRows] = useState<Segment[] | null>(null), [error, setError] = useState("");
  useEffect(() => { if (!user) return; segments<{ segments: Segment[] }>().then(r => setRows(r.segments)).catch(f => setError(f instanceof Error ? f.message : t("Could not load segments."))); }, [user]);
  if (!ready) return <main className="account-loading">{t("Loading…")}</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>{t("Segments")}</h1><p>{t("Sign in to see your segments.")}</p><Link className="account-primary" href="/login?next=/segments">{t("Sign in")}</Link></section></main>;
  return <main className="wellness-page seg-page">
    <section className="seg-hero"><span className="eyebrow">{t("MOVE · SEGMENTS")}</span><h1><Flag size={30} aria-hidden="true" /> {t("Your")}{" "}<em>{t("segments")}</em></h1>
      <p>{t("Favourite stretches of road and path. Every run, walk or ride along one is timed from its route, so you can race your past self.")}</p></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {rows === null && !error ? <p className="account-loading">{t("Loading segments…")}</p>
      : rows && rows.length ? <ul className="seg-grid">{rows.map(s => <li key={s.id}><Link href={`/segments/${s.id}`} className={`seg-tile seg-kind-${s.kind}`}>
        <span className="seg-tile-icon" aria-hidden="true">{s.kind === "ride" ? <Bike size={22} /> : <Footprints size={22} />}</span>
        <strong>{s.name}{s.visibility === "private" && <Lock size={13} aria-label={t("Only you")} />}</strong>
        <small>{t("{km} km · {count} passes", { km: km(s.distance_m), count: s.attempts })}</small>
        <span className="seg-tile-best">{s.best ? <>{t("Best")}{" "}<b>{duration(s.best.elapsed_s)}</b></> : t("Not timed yet")}</span></Link></li>)}</ul>
      : <section className="account-card seg-empty-card"><h2>{t("No segments yet")}</h2><p>{t("Open one of your runs, walks or rides and choose")}{" "}<strong>{t("Make a segment")}</strong>{t(". Pick a stretch you do often, like a hill or a park loop.")}</p><Link className="account-primary" href="/activities">{t("Your activities")}</Link></section>}
  </main>;
}
