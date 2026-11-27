// The adaptive calorie target: your real daily burn from the last 28 days of meals and weigh-ins
// (backend services/adaptive_target.py), and a suggested target you can choose to use.
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { personalRequest } from "@/lib/personalization";
import { saveTargets } from "@/lib/targets";

type Adaptive = { ready: boolean; reason: "" | "more_logging" | "more_weighins"; burn: number | null; measured_burn: number | null; trend_kg_per_week: number | null;
  logged_days: number; weigh_ins: number; trust: number; suggested: number | null; check_logging: boolean; current: number; manual: boolean; goal: string };

export function AdaptiveTargetCard({ refresh }: { refresh?: unknown }) {
  const [a, setA] = useState<Adaptive | null>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    personalRequest<Adaptive>("targets/adaptive").then(v => { /* an unexpected reply hides the card */ if (alive) setA(v && typeof v.ready === "boolean" && typeof v.current === "number" ? v : null); }).catch(() => { if (alive) setA(null); });
    return () => { alive = false; };
  }, [refresh, done]);
  if (!a) return null;
  async function use() {
    if (!a?.suggested) return;
    setBusy(true); setError("");
    try { await saveTargets({ calories: a.suggested }); setDone(t("Your calorie target is now {kcal} kcal.", { kcal: a.suggested })); }
    catch (e) { setError(e instanceof Error ? e.message : t("Could not save.")); }
    finally { setBusy(false); }
  }
  if (!a.ready) return <section className="account-card adaptive-card" aria-labelledby="adaptive-title">
    <h2 id="adaptive-title">{t("Your real daily burn")}</h2>
    <p>{t("TrackCal learns how many calories your body really uses from what you eat and how your weight changes, then suggests a target that fits you.")}</p>
    <ul className="adaptive-steps">
      <li className={a.logged_days >= 10 ? "is-done" : ""}>{t("Log full days of meals: {n} of 10", { n: Math.min(a.logged_days, 10) })}</li>
      <li className={a.reason !== "more_logging" && a.reason !== "more_weighins" ? "is-done" : ""}>{t("Weigh yourself at least 3 times over 10 days: {n} so far", { n: a.weigh_ins })}</li>
    </ul>
  </section>;
  const change = a.trend_kg_per_week ?? 0, worth = a.suggested !== null && Math.abs(a.suggested - a.current) >= 50;
  return <section className="account-card adaptive-card" aria-labelledby="adaptive-title">
    <h2 id="adaptive-title">{t("Your real daily burn")}</h2>
    <p className="adaptive-big"><strong>{t("About {kcal} kcal a day", { kcal: a.burn ?? 0 })}</strong></p>
    <p>{Math.abs(change) < 0.05 ? t("Your weight has been steady over the last 4 weeks.") : change < 0 ? t("You're losing about {kg} kg a week.", { kg: Math.abs(change) }) : t("You're gaining about {kg} kg a week.", { kg: change })}
      {" "}{t("Based on {days} fully logged days and {n} weigh-ins.", { days: a.logged_days, n: a.weigh_ins })}</p>
    {a.check_logging && <p className="adaptive-note">{t("This is quite different from what your profile suggests. If some meals weren't logged, the real burn is higher; the suggestion stays within a safe range.")}</p>}
    {worth ? <div className="adaptive-suggest">
      <p>{t("For your goal: {kcal} kcal a day (now {now}).", { kcal: a.suggested ?? 0, now: a.current })}</p>
      <button className="account-primary" disabled={busy} onClick={() => void use()}>{busy ? t("Saving…") : t("Use this target")}</button>
    </div> : <p>{t("Your current target of {now} kcal already fits.", { now: a.current })}</p>}
    {done && <p role="status">{done}</p>}{error && <p role="alert" className="account-error">{error}</p>}
  </section>;
}
