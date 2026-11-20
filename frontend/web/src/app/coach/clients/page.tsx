// Coaches: the clients who chose to share, with the last 7 days at a glance and 14 days for one client. Only what each
// client ticked is shown, as daily summaries. Backend: routers/coach_clients.py (flag organizer_saas).
import { t, msg, date, number } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { coachClients, CoachClientError, type ClientSummary } from "@/lib/coach-clients";
import { billingRequest, rupees, subscribe, type PlanKey, type Plans } from "@/lib/billing";

export const metadata = { title: msg("TrackCal — Your clients") };
const day = (iso: string) => date(new Date(iso + "T12:00:00"), { weekday: "short", day: "numeric" });

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const [c, setC] = useState<ClientSummary | null>(null), [error, setError] = useState("");
  useEffect(() => { coachClients<{ client: ClientSummary }>(id).then(v => setC(v.client), e => setError(e instanceof Error ? e.message : t("Unavailable."))); }, [id]);
  if (error) return <section className="account-card" role="alert"><p>{error}</p></section>;
  if (!c) return <p>{t("Loading…")}</p>;
  return <section className="account-card" aria-labelledby="client-detail">
    <h2 id="client-detail">{t("{name}: last 14 days", { name: c.name })}</h2>
    <div className="table-scroll"><table className="moderation-table"><thead><tr><th scope="col">{t("Day")}</th>
      {c.diary && <th scope="col">{t("Calories logged")}</th>}{c.workouts && <th scope="col">{t("Workout minutes")}</th>}</tr></thead>
      <tbody>{[...c.days].reverse().map(d => <tr key={d}><th scope="row">{day(d)}</th>
        {c.diary && <td>{c.diary.by_day[d] !== undefined ? number(c.diary.by_day[d]) : "—"}</td>}
        {c.workouts && <td>{c.workouts.by_day[d] ? number(c.workouts.by_day[d]) : "—"}</td>}</tr>)}</tbody></table></div>
    {c.weight && <p>{c.weight.latest_kg !== null ? t("Latest weight {kg} kg on {date}", { kg: number(c.weight.latest_kg), date: day(c.weight.measured_on!) }) : t("No weigh-ins yet.")}</p>}
    <div className="account-actions"><button onClick={onClose}>{t("Back to all clients")}</button></div>
  </section>;
}

// Free coaches have 3 client places; the Coach plan (Premium included) opens 50. Shown only while billing is on.
function CoachPlan({ onDone }: { onDone: () => void }) {
  const [plans, setPlans] = useState<Plans | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { billingRequest<Plans>("plans").then(setPlans).catch(() => setPlans(null)); }, []);
  const monthly = plans?.plans.coach_monthly, annual = plans?.plans.coach_annual;
  if (!plans?.billing_enabled || !monthly || !annual) return null;
  async function buy(plan: PlanKey) {
    if (busy) return; setBusy(true); setError("");
    try { if (await subscribe(plan)) onDone(); } catch (e) { setError(e instanceof Error ? e.message : t("Request failed.")); } finally { setBusy(false); }
  }
  return <section className="account-card" aria-labelledby="coach-plan">
    <h2 id="coach-plan">{t("Coach plan")}</h2>
    <p>{t("Free coach accounts can follow 3 clients. The Coach plan opens room for 50 and includes everything in Premium.")}</p>
    <div className="account-actions">
      <button className="account-primary" disabled={busy} onClick={() => void buy("coach_monthly")}>{t("{price} a month", { price: rupees(monthly.amount_paise ?? 0) })}</button>
      <button disabled={busy} onClick={() => void buy("coach_annual")}>{t("{price} a year", { price: rupees(annual.amount_paise ?? 0) })}</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default function Page() {
  const [rows, setRows] = useState<ClientSummary[] | null>(null), [open, setOpen] = useState(0), [places, setPlaces] = useState(0), [state, setState] = useState<"loading" | "off" | "denied" | "ready">("loading");
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null), [error, setError] = useState(""), [selected, setSelected] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => coachClients<{ clients: ClientSummary[]; open_invites: number; max_clients: number }>("").then(v => { setRows(v.clients); setOpen(v.open_invites); setPlaces(v.max_clients); setState("ready"); },
    e => setState(e instanceof CoachClientError ? (e.status === 404 ? "off" : e.status === 403 ? "denied" : "ready") : "ready")), []);
  useEffect(() => { void load(); }, [load]);
  async function invite() {
    if (busy) return; setBusy(true); setError("");
    try { setCode(await coachClients<{ code: string; expires_at: string }>("invites", "POST")); await load(); } catch (e) { setError(e instanceof Error ? e.message : t("Request failed.")); } finally { setBusy(false); }
  }
  if (state === "loading") return <main className="account-loading">{t("Loading…")}</main>;
  if (state !== "ready") return <main className="account-page"><section className="account-card"><h1>{t("Your clients")}</h1>
    <p>{state === "off" ? t("The trainer dashboard is not available yet.") : t("Only verified coach accounts can follow clients.")}</p><Link href="/routine">{t("Back")}</Link></section></main>;
  const signed = (n: number) => `${n > 0 ? "+" : ""}${number(n, { maximumFractionDigits: 1 })}`;
  return <main className="account-page">
    <div className="account-title"><span className="eyebrow">{t("COACHING")}</span><h1>{t("Your clients")}</h1>
      <p>{t("Clients appear here once they enter your code. You see only what each one chose to share, as daily totals, never their meals or notes.")}</p></div>
    <section className="account-card">
      <h2>{t("Invite a client")}</h2>
      <p>{t("Give the code to one client. It works once and expires in 7 days. Open codes: {n}", { n: open })}</p>
      <p>{t("Client places used: {used} of {places}", { used: rows?.length ?? 0, places })}</p>
      {code && <p className="invite-code" role="status"><strong>{code.code}</strong> · {t("expires {date}", { date: date(new Date(code.expires_at), { dateStyle: "medium" }) })}</p>}
      <div className="account-actions"><button className="account-primary" disabled={busy} onClick={() => void invite()}>{t("Create an invite code")}</button></div>
      {error && <p role="alert">{error}</p>}
    </section>
    {places > 0 && places <= 3 && <CoachPlan onDone={() => void load()} />}
    {selected ? <Detail id={selected} onClose={() => setSelected("")} /> : <section className="account-card" aria-labelledby="clients-week">
      <h2 id="clients-week">{t("Last 7 days")}</h2>
      {!rows?.length ? <p>{t("No clients yet. Create an invite code and share it with a client.")}</p> :
        <div className="table-scroll"><table className="moderation-table"><thead><tr>
          <th scope="col">{t("Client")}</th><th scope="col">{t("Last active")}</th><th scope="col">{t("Days logged")}</th><th scope="col">{t("Average calories / target")}</th>
          <th scope="col">{t("Workouts")}</th><th scope="col">{t("Weight change")}</th></tr></thead>
          <tbody>{rows.map(c => <tr key={c.id}>
            <th scope="row"><button className="link-button" onClick={() => setSelected(c.id)}>{c.name}</button></th>
            <td>{c.last_active ? day(c.last_active) : "—"}</td>
            <td>{c.diary ? `${c.diary.days_logged}/7` : <span className="muted">{t("not shared")}</span>}</td>
            <td>{c.diary ? `${c.diary.average_kcal !== null ? number(c.diary.average_kcal) : "—"} / ${c.diary.target_kcal !== null ? number(c.diary.target_kcal) : "—"}` : <span className="muted">{t("not shared")}</span>}</td>
            <td>{c.workouts ? t("{count} · {minutes} min", { count: c.workouts.count, minutes: c.workouts.minutes }) : <span className="muted">{t("not shared")}</span>}</td>
            <td>{c.weight ? (c.weight.change_kg !== null ? `${signed(c.weight.change_kg)} kg` : "—") : <span className="muted">{t("not shared")}</span>}</td>
          </tr>)}</tbody></table></div>}
    </section>}
  </main>;
}
