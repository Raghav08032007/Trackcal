// TrackCal's team (site admins): how far the app's estimates were from what people kept. Numbers come from corrections
// people already make (backend services/accuracy.py); nothing new is asked of anyone.
import { t, msg, number } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "@/lib/navigation";

export const metadata = { title: msg("TrackCal — Accuracy") };

type Status = "not_enough_data" | "meets_target" | "below_target" | "measured";
type Food = { area: "food_photo"; samples: number; kept_unchanged: number | null; within_target: number | null; median_abs_error_pct: number | null; median_bias_pct: number | null; status: Status };
type RepSummary = { sets: number; kept_unchanged: number | null; within_one_rep: number | null; mean_abs_error_reps: number | null };
type Camera = { area: "camera_reps"; status: Status; by_exercise: (RepSummary & { exercise: string })[] } & RepSummary;
type Barcode = { area: "barcode_coverage"; lookups: number; found: number | null; status: Status };
type Report = { days: number; min_samples: number; areas: (Food | Camera | Barcode)[] };

const STATUS: Record<Status, string> = { not_enough_data: msg("Not enough data yet"), meets_target: msg("Meets the target"), below_target: msg("Below the target"), measured: msg("Measured") };
const PERIODS = [30, 90, 365] as const;
const pct = (share: number | null) => share === null ? "—" : number(share, { style: "percent", maximumFractionDigits: 0 });
const signed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${number(value, { maximumFractionDigits: 1 })}%`;

function Chip({ status }: { status: Status }) {
  return <span className={`accuracy-status accuracy-${status}`}>{t(STATUS[status])}</span>;
}

export default function Page() {
  const [days, setDays] = useState<number>(90), [report, setReport] = useState<Report | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/accuracy?days=${days}`, { signal: AbortSignal.timeout(15000) })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(r.status === 403 ? t("Only TrackCal's team can see this page.") : data.error || t("Unavailable.")); return data as Report; })
      .then(v => { if (live) { setReport(v); setError(""); } }, e => { if (live) setError(e instanceof Error ? e.message : t("Unavailable.")); });
    return () => { live = false; };
  }, [days]);
  const food = report?.areas.find((a): a is Food => a.area === "food_photo");
  const camera = report?.areas.find((a): a is Camera => a.area === "camera_reps");
  const barcode = report?.areas.find((a): a is Barcode => a.area === "barcode_coverage");
  return <main className="account-page accuracy-page">
    <div className="account-title"><span className="eyebrow">{t("ACCURACY")}</span><h1>{t("How close are our estimates?")}</h1>
      <p>{t("Measured from the corrections people already make: an AI photo estimate against the meal they kept, and the camera's rep count against the reps they confirmed. Nothing new is collected.")}</p></div>
    <div className="social-tabs" role="tablist" aria-label={t("Period")}>{PERIODS.map(p => <button key={p} role="tab" aria-selected={days === p} onClick={() => setDays(p)}>{t("Last {n} days", { n: p })}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    {!report && !error && <p>{t("Loading…")}</p>}
    {report && <p className="push-note">{t("A result needs at least {n} samples before it is judged.", { n: report.min_samples })} · <Link href="/moderation">{t("Moderation")}</Link></p>}

    {food && <section className="account-card accuracy-card" aria-labelledby="acc-food">
      <h2 id="acc-food">{t("AI photo calories")}</h2><Chip status={food.status} />
      <dl className="accuracy-figures">
        <div><dt>{t("Meals")}</dt><dd>{number(food.samples)}</dd></div>
        <div><dt>{t("Within ±20% of what was kept")}</dt><dd>{pct(food.within_target)}</dd></div>
        <div><dt>{t("Kept without changes")}</dt><dd>{pct(food.kept_unchanged)}</dd></div>
        <div><dt>{t("Typical error")}</dt><dd>{food.median_abs_error_pct === null ? "—" : `${number(food.median_abs_error_pct, { maximumFractionDigits: 1 })}%`}</dd></div>
        <div><dt>{t("Typical lean")}</dt><dd>{signed(food.median_bias_pct)}</dd></div>
      </dl>
      <p className="push-note">{t("Target: 80% of meals within ±20%. A positive lean means the AI estimated too high. People only correct what they notice, so this is a best case until a weighed-meal test is done.")}</p>
    </section>}

    {camera && <section className="account-card accuracy-card" aria-labelledby="acc-camera">
      <h2 id="acc-camera">{t("Camera rep counts")}</h2><Chip status={camera.status} />
      <dl className="accuracy-figures">
        <div><dt>{t("Sets")}</dt><dd>{number(camera.sets)}</dd></div>
        <div><dt>{t("Within ±1 rep")}</dt><dd>{pct(camera.within_one_rep)}</dd></div>
        <div><dt>{t("Kept without changes")}</dt><dd>{pct(camera.kept_unchanged)}</dd></div>
        <div><dt>{t("Average miss")}</dt><dd>{camera.mean_abs_error_reps === null ? "—" : t("{n} reps", { n: number(camera.mean_abs_error_reps, { maximumFractionDigits: 2 }) })}</dd></div>
      </dl>
      <p className="push-note">{t("Target: 90% of sets within ±1 rep before the camera loses its Experimental label.")}</p>
      {camera.by_exercise.length > 0 && <div className="table-scroll"><table className="moderation-table">
        <thead><tr><th scope="col">{t("Exercise")}</th><th scope="col">{t("Sets")}</th><th scope="col">{t("Within ±1 rep")}</th><th scope="col">{t("Average miss")}</th></tr></thead>
        <tbody>{camera.by_exercise.map(row => <tr key={row.exercise}><th scope="row">{row.exercise}</th><td>{number(row.sets)}</td><td>{pct(row.within_one_rep)}</td>
          <td>{row.mean_abs_error_reps === null ? "—" : number(row.mean_abs_error_reps, { maximumFractionDigits: 2 })}</td></tr>)}</tbody>
      </table></div>}
    </section>}

    {barcode && <section className="account-card accuracy-card" aria-labelledby="acc-barcode">
      <h2 id="acc-barcode">{t("Barcode coverage")}</h2><Chip status={barcode.status} />
      <dl className="accuracy-figures">
        <div><dt>{t("Codes looked up")}</dt><dd>{number(barcode.lookups)}</dd></div>
        <div><dt>{t("Found in the food database")}</dt><dd>{pct(barcode.found)}</dd></div>
      </dl>
      <p className="push-note">{t("How often a scanned code was in the food database. This is coverage, not accuracy: whether the label values are right is not measured here.")}</p>
    </section>}
  </main>;
}
