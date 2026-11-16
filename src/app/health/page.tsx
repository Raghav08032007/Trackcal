// My health report: add a blood report (PDF, photo with consent, or typed), check the values, then see what they mean and the
// diet and exercise plan they lead to. Optional: nothing elsewhere in the app depends on it.
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { LabRangeBar } from "@/components/ds/metrics";
import { TARGET_TEXT, health, readFile, scale, type Assessment, type Reading, type Summary, type TestInfo } from "@/lib/health";

export const metadata = { title: "TrackCal — My health report" };
type Draft = { source: "pdf" | "photo" | "manual"; rows: Reading[]; date: string; lab: string };
const today = () => new Date().toISOString().slice(0, 10);

export default function Page() {
  const { ready, user } = useAccount();
  if (!ready) return <main className="account-loading">{t("Loading…")}</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>{t("My health report")}</h1><p>{t("Sign in to add a blood report.")}</p><Link className="account-primary" href="/login?next=/health">{t("Sign in")}</Link></section></main>;
  return <Health />;
}

function Health() {
  const [summary, setSummary] = useState<Summary | null>(null), [tests, setTests] = useState<TestInfo[]>([]), [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [note, setNote] = useState(""), [consent, setConsent] = useState(false), [adding, setAdding] = useState(false);
  const load = () => health<Summary>("summary").then(setSummary).catch(e => setError(e instanceof Error ? e.message : t("Could not load your reports.")));
  useEffect(() => { void load(); health<{ tests: TestInfo[] }>("tests").then(t => setTests(t.tests)).catch(() => {}); }, []);

  async function run(label: string, task: () => Promise<void>) { setBusy(label); setError(""); setNote(""); try { await task(); } catch (e) { setError(e instanceof Error ? e.message : t("Something went wrong.")); } finally { setBusy(""); } }
  const fromFile = (file: File) => run(t("Reading your report…"), async () => {
    const data = await readFile(file);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (file.size > 8_000_000) throw new Error(t("Upload a PDF under 8 MB."));
      const r = await health<{ readings: Reading[]; note: string }>("read", "POST", { kind: "pdf", data: data.split(",")[1] });
      setDraft({ source: "pdf", rows: r.readings, date: today(), lab: "" }); setNote(r.note);
    } else {
      if (!consent) throw new Error(t("Tick the box to let the AI read this photo, or type the values instead."));
      const r = await health<{ readings: Reading[]; note: string }>("/api/health-photo", "POST", { image: data, ai_consent: true });
      setDraft({ source: "photo", rows: r.readings, date: today(), lab: "" }); setNote(r.note);
    }
  });
  const save = () => draft && run(t("Saving…"), async () => {
    await health<Assessment>("reports", "POST", { report_date: draft.date, lab_name: draft.lab || undefined, source: draft.source, results: draft.rows.map(r => ({ code: r.code, value: r.value, ref_low: r.ref_low, ref_high: r.ref_high })) });
    setDraft(null); await load(); window.scrollTo({ top: 0, behavior: "smooth" });
  });
  const latest = summary?.latest;

  return <main className="ds-page health-page">
    <section className="ds-hero health-hero"><span className="ds-hero-orbit" aria-hidden="true" /><span className="eyebrow">{t("MY HEALTH REPORT · OPTIONAL")}</span>
      <h1>{t("Make your next report better.")}</h1>
      <p>{t("Add a blood report and we explain every value in plain words, then turn it into daily food and exercise targets. The file is read and discarded: only the numbers you confirm are kept, privately.")}</p></section>
    {error && <p role="alert" className="camera-alert">{error}</p>}
    {busy && <p role="status" className="health-busy">{busy}</p>}

    {draft ? <Review draft={draft} tests={tests} note={note} busy={!!busy} onChange={setDraft} onSave={save} onCancel={() => { setDraft(null); setNote(""); }} />
      : (!latest || adding) && <section className="ds-section" aria-labelledby="h-add"><h2 id="h-add">{t("Add a report")}</h2>
        <div className="ds-grid">
          <label className="ds-card ds-lift health-option"><span aria-hidden="true" className="health-icon">📄</span><h3>{t("Upload the PDF")}</h3><p className="ds-sub">{t("Most accurate. Read on our own server, no AI.")}</p>
            <input type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void fromFile(f); }} /></label>
          <div className="ds-card health-option"><span aria-hidden="true" className="health-icon">📷</span><h3>{t("Take a photo")}</h3><p className="ds-sub">{t("The AI copies the printed values for you to check. Names and IDs are not read; the photo is not kept.")}</p>
            <label className="health-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> {t("Let the AI read this photo")}</label>
            <label className={`ds-btn ds-btn-quiet${consent ? "" : " is-disabled"}`}>{t("Choose photo")}<input type="file" accept="image/*" capture="environment" disabled={!consent || !!busy} className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void fromFile(f); }} /></label></div>
          <button type="button" className="ds-card ds-lift health-option" onClick={() => setDraft({ source: "manual", rows: [], date: today(), lab: "" })}><span aria-hidden="true" className="health-icon">⌨️</span><h3>{t("Type the values")}</h3><p className="ds-sub">{t("Pick the tests on your report and enter each number.")}</p></button>
        </div>
        {latest && <button type="button" className="ds-btn ds-btn-quiet" style={{ marginTop: 14 }} onClick={() => setAdding(false)}>{t("Cancel")}</button>}
      </section>}

    {latest && !draft && <Results data={latest} history={summary!.history} onAdd={() => setAdding(true)} />}
    {summary && summary.reports.length > 0 && !draft && <section className="ds-section"><h2>{t("Your reports")}</h2>
      <ul className="health-reports">{summary.reports.map(r => <li key={r.id} className="ds-card"><span><strong>{new Date(r.report_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</strong>{t("{n} · {tests} tests", { n: r.lab_name ? ` · ${r.lab_name}` : "", tests: r.tests })}</span>
        <button type="button" className="ds-btn ds-btn-danger" disabled={!!busy} onClick={() => { if (window.confirm(t("Delete this report and its values? This can't be undone."))) void run(t("Deleting…"), async () => { await health(`reports/${r.id}`, "DELETE"); await load(); }); }}>{t("Delete")}</button></li>)}</ul></section>}
  </main>;
}

/** Every value is checked by the person before anything is planned from it. */
function Review({ draft, tests, note, busy, onChange, onSave, onCancel }: { draft: Draft; tests: TestInfo[]; note: string; busy: boolean; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const [pick, setPick] = useState("");
  const set = (code: string, patch: Partial<Reading>) => onChange({ ...draft, rows: draft.rows.map(r => (r.code === code ? { ...r, ...patch } : r)) });
  const missing = tests.filter(t => !draft.rows.some(r => r.code === t.code));
  return <section className="ds-section" aria-labelledby="h-review"><h2 id="h-review">{t("Check your values")}</h2>
    <p className="ds-lead">{draft.source === "manual" ? t("Add each test from your report.") : t("Compare each number with your report and fix anything that is wrong. Nothing is saved until you confirm.")}</p>
    {note && <p className="onb-note">{note}</p>}
    <div className="ds-card">
      <div className="onb-grid"><label className="onb-field">{t("Date the sample was taken")}<input type="date" max={today()} value={draft.date} onChange={e => onChange({ ...draft, date: e.target.value })} /></label>
        <label className="onb-field">{t("Lab (optional)")}<input maxLength={80} value={draft.lab} placeholder={t("e.g. Thyrocare")} onChange={e => onChange({ ...draft, lab: e.target.value })} /></label></div>
      {draft.rows.length > 0 && <table className="health-table"><thead><tr><th scope="col">{t("Test")}</th><th scope="col">{t("Your value")}</th><th scope="col">{t("Lab range")}</th><th scope="col"><span className="sr-only">{t("Remove")}</span></th></tr></thead>
        <tbody>{draft.rows.map(r => <tr key={r.code}>
          <th scope="row">{r.name}</th>
          <td><label className="sr-only" htmlFor={`v-${r.code}`}>{t("{name} value", { name: r.name })}</label><input id={`v-${r.code}`} type="number" step="any" value={Number.isFinite(r.value) ? r.value : ""} onChange={e => set(r.code, { value: Number(e.target.value) })} /> <span className="health-unit">{r.unit}</span></td>
          <td className="health-range">{r.ref_low !== null && r.ref_high !== null ? `${r.ref_low} – ${r.ref_high}` : r.ref_high !== null ? `under ${r.ref_high}` : r.ref_low !== null ? `over ${r.ref_low}` : t("not printed")}</td>
          <td><button type="button" className="health-x" aria-label={t("Remove {name}", { name: r.name })} onClick={() => onChange({ ...draft, rows: draft.rows.filter(x => x.code !== r.code) })}>×</button></td></tr>)}</tbody></table>}
      {missing.length > 0 && <div className="health-add"><label className="onb-field">{t("Add a test")}<select value={pick} onChange={e => setPick(e.target.value)}><option value="">{t("Choose…")}</option>{missing.map(t => <option key={t.code} value={t.code}>{t.name} ({t.unit})</option>)}</select></label>
        <button type="button" className="ds-btn ds-btn-quiet" disabled={!pick} onClick={() => { const t = tests.find(x => x.code === pick)!; onChange({ ...draft, rows: [...draft.rows, { code: t.code, name: t.name, unit: t.unit, value: NaN, ref_low: null, ref_high: null }] }); setPick(""); }}>{t("Add")}</button></div>}
      <div className="onb-actions"><button type="button" className="ds-btn ds-btn-primary" disabled={busy || !draft.rows.length || draft.rows.some(r => !Number.isFinite(r.value)) || !draft.date} onClick={onSave}>{t("Confirm & see my plan")}</button><button type="button" className="ds-btn ds-btn-quiet" onClick={onCancel}>{t("Cancel")}</button></div>
    </div>
  </section>;
}

const EXERCISE_TEXT = (e: Record<string, number | boolean | string>) => [
  e.cardio_min && t("{n} minutes of brisk activity a week", { n: Number(e.cardio_min) }), e.strength_days && t("Strength training {n} days a week", { n: Number(e.strength_days) }),
  e.post_meal_walk && t("A 10-15 minute walk after lunch and dinner"), e.outdoor_minutes && t("{n} minutes outdoors in morning sun", { n: Number(e.outdoor_minutes) }),
  e.intervals_per_week && t("{n} short interval sessions a week", { n: Number(e.intervals_per_week) }), e.intensity && t("Keep intensity {level}", { level: t(String(e.intensity)) }),
  e.low_impact && t("Low-impact exercise only"), e.build_up && t("Build up gradually"), e.no_high_protein && t("No high-protein muscle-gain plans"),
].filter(Boolean) as string[];

function Results({ data, history, onAdd }: { data: { report: { report_date: string } } & Assessment; history: Summary["history"]; onAdd: () => void }) {
  const out = data.findings.filter(f => f.status !== "normal"), fine = data.findings.filter(f => f.status === "normal");
  return <>
    {data.safety !== "ok" && <section className={`health-safety is-${data.safety}`} role="alert"><strong>{data.safety === "today" ? t("See a doctor today") : t("See a doctor this week")}</strong><p>{data.safety_message}</p></section>}
    <section className="ds-section" aria-labelledby="h-res"><h2 id="h-res">{t("Your report of {n}", { n: new Date(data.report.report_date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) })}</h2>
      <p className="ds-lead">{out.length ? t("{length} of {length2} results need attention.", { length: out.length, length2: data.findings.length }) : t("Every result is in the normal range.")}</p>
      <div className="ds-grid">{[...out, ...fine].map(f => { const s = scale(f), past = history[f.code] ?? [], prev = past.length > 1 ? past[past.length - 2].value : undefined;
        return <div key={f.code} className="ds-card"><LabRangeBar lab={{ name: f.name, value: f.value, unit: f.unit, low: f.low ?? s.min, high: f.high ?? s.max, min: s.min, max: s.max, previous: prev, note: f.explanation }} /><p className="health-from">{t("Normal range from {range_from}.", { range_from: f.range_from })}{f.source && <>{" "}{t("Guideline: {source}.", { source: f.source })}</>}</p></div>; })}</div>
    </section>
    {data.plan && <section className="ds-section" aria-labelledby="h-plan"><h2 id="h-plan">{t("Your plan from this report")}</h2>
      <div className="ds-grid">
        {Object.keys(data.plan.targets).length > 0 && <div className="ds-card"><h3>{t("Daily food targets")}</h3><ul className="health-list">{Object.entries(data.plan.targets).map(([k, v]) => <li key={k}>{TARGET_TEXT[k]?.(v) ?? `${k}: ${v}`}</li>)}</ul></div>}
        {EXERCISE_TEXT(data.plan.exercise).length > 0 && <div className="ds-card"><h3>{t("Movement")}</h3><ul className="health-list">{EXERCISE_TEXT(data.plan.exercise).map(t => <li key={t}>{t}</li>)}</ul></div>}
        {data.plan.retest_on && <div className="ds-card"><h3>{t("Retest")}</h3><p className="t-num health-retest">{new Date(data.plan.retest_on).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p><p className="ds-sub">{t("Retest then to see how far these changes moved your numbers.")}</p></div>}
      </div>
      {data.plan.diet.length > 0 && <div className="ds-card" style={{ marginTop: 16 }}><h3>{t("What to eat")}</h3><ul className="health-list">{data.plan.diet.map(t => <li key={t}>{t}</li>)}</ul></div>}
      {data.plan.move.length > 0 && <div className="ds-card" style={{ marginTop: 16 }}><h3>{t("How to move")}</h3><ul className="health-list">{data.plan.move.map(t => <li key={t}>{t}</li>)}</ul></div>}
      {(data.plan.why?.length ?? 0) > 0 && <div className="ds-card health-why" style={{ marginTop: 16 }}><h3>{t("Why these changes")}</h3>
        <ul className="health-list">{data.plan.why!.map(w => <li key={w.rule}><strong>{w.about}</strong>{" "}{t("— follows {source}. Retest in about {n} months.", { source: w.source, n: Math.round(w.retest_days / 30) })}</li>)}</ul>
        {data.plan.activity_source && <p className="ds-sub">{t("Activity amounts: {activity_source}.", { activity_source: data.plan.activity_source })}</p>}
        <p className="ds-sub">{t("These are lifestyle changes for this report, checked against the guidelines named. They are not a diagnosis and never replace your doctor.")}</p></div>}
    </section>}
    {data.plan_note && <p className="onb-note">{data.plan_note}</p>}
    <p className="health-disclaimer">{data.disclaimer}</p>
    <button type="button" className="ds-btn ds-btn-primary" onClick={onAdd}>{t("Add a newer report")}</button>
  </>;
}
