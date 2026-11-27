// Vitamins and minerals for a day, from the foods logged in the diary (backend services/micronutrients.py).
// Bars against ICMR-NIN 2020 daily needs; a plain tip of everyday foods when something is low; sodium is a limit.
import { useEffect, useState } from "react";
import { msg, t } from "@/lib/i18n";
import { wellnessRequest } from "@/lib/wellness";

type Row = { nutrient: string; unit: string; amount: number; target: number; percent: number; kind: "need" | "limit"; status: "ok" | "near" | "low" | "over" | "partial" | "unknown"; sources: string[] };
type View = { coverage: number; nutrients: Row[]; basis: string };

const NAMES: Record<string, string> = {
  iron: msg("Iron"), calcium: msg("Calcium"), zinc: msg("Zinc"), magnesium: msg("Magnesium"), potassium: msg("Potassium"),
  vitamin_c: msg("Vitamin C"), folate: msg("Folate"), vitamin_d: msg("Vitamin D"), vitamin_b12: msg("Vitamin B12"), sodium: msg("Sodium (salt)"),
};
const UNITS: Record<string, string> = { mg: msg("mg"), mcg: msg("µg") };

export function MicronutrientCard({ day, refresh }: { day?: string; refresh?: unknown }) {
  const [view, setView] = useState<View | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    wellnessRequest<View>("micronutrients" + (day ? "?target_date=" + day : "")).then(v => { /* an unexpected reply hides the card instead of breaking the diary */ if (alive) { const ok = !!v && Array.isArray(v.nutrients); setView(ok ? v : null); setFailed(!ok); } }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [day, refresh]);
  if (failed || !view) return null;
  const shown = view.nutrients.filter(r => r.status !== "unknown");
  if (!shown.length) return <section className="account-card micro-card"><h2>{t("Vitamins & minerals today")}</h2><p>{t("Log foods from the food search to see iron, calcium, vitamins and more. Photo estimates don't include them yet.")}</p></section>;
  const low = shown.filter(r => r.status === "low");
  return <section className="account-card micro-card" aria-labelledby="micro-title">
    <h2 id="micro-title">{t("Vitamins & minerals today")}</h2>
    {view.coverage < 0.6 && <p className="micro-note">{t("Only {pct}% of today's calories came from foods with vitamin data (photo estimates have none), so these totals are lower than what you really ate.", { pct: Math.round(view.coverage * 100) })}</p>}
    <ul className="micro-list">{shown.map(r => {
      const width = Math.min(100, r.percent);
      return <li key={r.nutrient} className={`micro-row is-${r.status}`}>
        <div className="micro-head"><strong>{t(NAMES[r.nutrient] ?? r.nutrient)}</strong>
          <span>{r.amount} / {r.target} {t(UNITS[r.unit] ?? r.unit)}{r.kind === "limit" ? " " + t("(limit)") : ""}</span></div>
        <div className="micro-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-label={t(NAMES[r.nutrient] ?? r.nutrient)}><span style={{ width: `${width}%` }} /></div>
      </li>;
    })}</ul>
    {low.length > 0 && <div className="micro-tips"><strong>{t("To get more")}</strong>{low.map(r => <p key={r.nutrient}>{t(NAMES[r.nutrient])}: {r.sources.map(s => t(s)).join(", ")}</p>)}</div>}
    <p className="micro-basis">{t("Daily needs: ICMR-NIN 2020 for healthy adults; sodium is the WHO limit. A guide, not a medical test.")}</p>
  </section>;
}
