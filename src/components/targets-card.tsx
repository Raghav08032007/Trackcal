// Your daily targets: the numbers, how each was worked out, and a way to set your own.
import { useState } from "react";
import Link from "@/lib/navigation";
import { saveTargets, useTargets, type TargetName } from "@/lib/targets";

const ROWS: [TargetName, string, string][] = [["calories", "Calories", "kcal"], ["protein", "Protein", "g"], ["carbs", "Carbs", "g"], ["fat", "Fat", "g"]];

export function TargetsCard() {
  const { targets } = useTargets();
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Partial<Record<TargetName, string>>>({}), [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (!targets) return null;
  async function save(clear = false) {
    setBusy(true); setError("");
    try {
      const patch = Object.fromEntries(ROWS.map(([k]) => [k, clear ? null : draft[k]?.trim() ? Number(draft[k]) : targets!.manual.includes(k) ? targets![k] : null]));
      await saveTargets(patch); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }
  return <section className="ds-card targets-card" aria-labelledby="targets-title">
    <div className="targets-head"><h2 id="targets-title">Your daily targets</h2>
      {!editing && <button type="button" className="ds-btn ds-btn-quiet" onClick={() => { setDraft(Object.fromEntries(ROWS.map(([k]) => [k, String(targets[k])]))); setEditing(true); }}>Edit</button>}</div>
    {!editing ? <dl className="targets-grid">{ROWS.map(([k, label, unit]) => <div key={k}><dt>{label}{targets.manual.includes(k) && <span className="targets-mine">set by you</span>}</dt><dd>{targets[k].toLocaleString()} <small>{unit}</small></dd></div>)}
      <div><dt>Fibre</dt><dd>{targets.fibre} <small>g</small></dd></div><div><dt>Added sugar</dt><dd>under {targets.added_sugar_max} <small>g</small></dd></div></dl>
      : <div className="targets-edit">
        <p className="ds-sub">Set any number yourself, or leave it to be calculated from your profile.</p>
        <div className="onb-grid">{ROWS.map(([k, label, unit]) => <label key={k} className="onb-field">{label} ({unit})<input type="number" inputMode="numeric" value={draft[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} /></label>)}</div>
        {error && <p role="alert" className="account-error">{error}</p>}
        <div className="onb-actions"><button type="button" className="ds-btn ds-btn-primary" disabled={busy} onClick={() => void save()}>Save</button>
          {targets.manual.length > 0 && <button type="button" className="ds-btn ds-btn-quiet" disabled={busy} onClick={() => void save(true)}>Use calculated targets</button>}
          <button type="button" className="ds-btn ds-btn-quiet" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
      </div>}
    <details className="targets-how"><summary>How these were worked out</summary><ul>{targets.explanation.map(line => <li key={line}>{line}</li>)}</ul>
      {!targets.complete && <Link href="/onboarding" className="ds-btn ds-btn-primary">Add age, height and weight</Link>}</details>
  </section>;
}
