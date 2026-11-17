// Your daily targets: the numbers, how each was worked out, and a way to set your own.
import { t, msg } from "@/lib/i18n";
import { useState } from "react";
import Link from "@/lib/navigation";
import { saveTargets, useTargets, type TargetName } from "@/lib/targets";

const ROWS: [TargetName, string, string][] = [["calories", msg("Calories"), "kcal"], ["protein", msg("Protein"), "g"], ["carbs", msg("Carbs"), "g"], ["fat", msg("Fat"), "g"]];

export function TargetsCard() {
  const { targets } = useTargets();
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Partial<Record<TargetName, string>>>({}), [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (!targets) return null;
  async function save(clear = false) {
    setBusy(true); setError("");
    try {
      const patch = Object.fromEntries(ROWS.map(([k]) => [k, clear ? null : draft[k]?.trim() ? Number(draft[k]) : targets!.manual.includes(k) ? targets![k] : null]));
      await saveTargets(patch); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not save.")); }
    finally { setBusy(false); }
  }
  return <section className="ds-card targets-card" aria-labelledby="targets-title">
    <div className="targets-head"><h2 id="targets-title">{t("Your daily targets")}</h2>
      {!editing && <button type="button" className="ds-btn ds-btn-quiet" onClick={() => { setDraft(Object.fromEntries(ROWS.map(([k]) => [k, String(targets[k])]))); setEditing(true); }}>{t("Edit")}</button>}</div>
    {!editing ? <dl className="targets-grid">{ROWS.map(([k, label, unit]) => <div key={k}><dt>{t(label)}{targets.manual.includes(k) && <span className="targets-mine">{t("set by you")}</span>}</dt><dd>{targets[k].toLocaleString()} <small>{unit}</small></dd></div>)}
      <div><dt>{t("Fibre")}</dt><dd>{targets.fibre} <small>g</small></dd></div><div><dt>{t("Added sugar")}</dt><dd>{t("under {added_sugar_max}", { added_sugar_max: targets.added_sugar_max })} <small>g</small></dd></div></dl>
      : <div className="targets-edit">
        <p className="ds-sub">{t("Set any number yourself, or leave it to be calculated from your profile.")}</p>
        <div className="onb-grid">{ROWS.map(([k, label, unit]) => <label key={k} className="onb-field">{t(label)} ({unit})<input type="number" inputMode="numeric" value={draft[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} /></label>)}</div>
        {error && <p role="alert" className="account-error">{error}</p>}
        <div className="onb-actions"><button type="button" className="ds-btn ds-btn-primary" disabled={busy} onClick={() => void save()}>{t("Save")}</button>
          {targets.manual.length > 0 && <button type="button" className="ds-btn ds-btn-quiet" disabled={busy} onClick={() => void save(true)}>{t("Use calculated targets")}</button>}
          <button type="button" className="ds-btn ds-btn-quiet" disabled={busy} onClick={() => setEditing(false)}>{t("Cancel")}</button></div>
      </div>}
    <details className="targets-how"><summary>{t("How these were worked out")}</summary><ul>{targets.explanation.map(line => <li key={line}>{line}</li>)}</ul>
      {!targets.complete && <Link href="/onboarding" className="ds-btn ds-btn-primary">{t("Add age, height and weight")}</Link>}</details>
  </section>;
}
