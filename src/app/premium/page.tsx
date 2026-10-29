// TrackCal Premium (flag billing). Honest by design: price and renewal in plain words, the trial end date before
// anyone pays, cancelling as easy as subscribing, and the core habit tools always free.
import { useEffect, useRef, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { billingRequest, dateText, rupees, subscribe, type BillingStatus, type PlanKey, type Plans } from "@/lib/billing";

export const metadata = { title: "TrackCal Premium" };

export default function Page() {
  const { ready, user } = useAccount();
  const [plans, setPlans] = useState<Plans | null>(null), [status, setStatus] = useState<BillingStatus | null>(null), [payments, setPayments] = useState<{ id: string; amount: number; currency: string; status: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState(""), [confirmCancel, setConfirmCancel] = useState(false);
  const acted = useRef(false);  // a checkout or cancel result is newer than the page-load status: never overwrite it
  useEffect(() => { billingRequest<Plans>("plans").then(setPlans).catch(e => setError(e instanceof Error ? e.message : "Unavailable.")); }, []);
  useEffect(() => {
    if (!user) return;
    billingRequest<BillingStatus>("status").then(value => { if (!acted.current) setStatus(value); }).catch(() => {});
    billingRequest<{ payments: typeof payments }>("history").then(v => setPayments(v.payments)).catch(() => {});
  }, [user]);
  async function start(plan: PlanKey) {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try { const result = await subscribe(plan); if (result) { acted.current = true; setStatus(result); setNotice(result.status === "trialing" ? `Premium is on. Your free trial runs until ${dateText(result.trial_ends_at)}.` : "Premium is on. Thank you!"); } }
    catch (e) { setError(e instanceof Error ? e.message : "Checkout failed. You haven't been charged."); } finally { setBusy(false); }
  }
  async function cancel() {
    if (busy) return; setBusy(true); setError("");
    try { const result = await billingRequest<BillingStatus>("cancel", { reason: "" }); acted.current = true; setStatus(result); setConfirmCancel(false); setNotice(`Cancelled. You keep Premium until ${dateText(result.current_period_end || result.trial_ends_at)}, and you won't be charged again.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't cancel. Nothing changed; please retry."); } finally { setBusy(false); }
  }
  if (!ready || !plans) return <main className="account-loading">{error || "Opening Premium…"}</main>;
  if (!plans.billing_enabled) return <main className="account-page"><section className="account-card"><h1>Premium isn't available yet</h1><p>Everything in TrackCal is free to use right now.</p><Link href="/account">Back to your account</Link></section></main>;
  const monthly = plans.plans.premium_monthly, annual = plans.plans.premium_annual;
  const saving = monthly?.amount_paise && annual?.amount_paise ? Math.round((1 - annual.amount_paise / (monthly.amount_paise * 12)) * 100) : 0;
  const trial = !status || status.trial_available, endsAt = status?.current_period_end || status?.trial_ends_at || null;
  const cancelled = status?.status === "cancelled";
  return <main className="account-page premium-page">
    <div className="account-title"><span className="eyebrow">TRACKCAL PREMIUM</span><h1>A little extra, if you want it.</h1><p>Premium adds a few extras. Everything you need for the daily habit stays free.</p></div>
    <div className="wellness-feedback"><p role="status">{notice}</p>{error && <p role="alert">{error}</p>}</div>
    {status?.premium ? <section className="account-card premium-current">
      <h2>{status.status === "trialing" ? "You're on the free trial" : cancelled ? "Premium (cancelled)" : "You have Premium"}</h2>
      {status.status === "trialing" && !cancelled && <p className="premium-trial">Your trial ends on <strong>{dateText(status.trial_ends_at)}</strong>. After that you'll be charged {status.plan === "premium_annual" ? annual?.label : monthly?.label} unless you cancel before then.</p>}
      {status.status === "active" && <p>Renews on <strong>{dateText(endsAt)}</strong>.</p>}
      {cancelled && <p>You keep Premium until <strong>{dateText(endsAt)}</strong>. You won't be charged again.</p>}
      <ul>{plans.premium_features?.map(f => <li key={f}>{f}</li>)}</ul>
      {!cancelled && (confirmCancel
        ? <div className="premium-confirm" role="group" aria-label="Confirm cancellation"><p>Cancel Premium? You keep it until {dateText(endsAt)} and won't be charged again.</p><button className="account-primary" disabled={busy} onClick={() => void cancel()}>Yes, cancel Premium</button><button disabled={busy} onClick={() => setConfirmCancel(false)}>Keep Premium</button></div>
        : <button className="account-secondary" onClick={() => setConfirmCancel(true)}>Cancel Premium</button>)}
    </section> : <>
      {!user ? <section className="account-card"><p>Sign in to start Premium.</p><Link className="account-primary" href="/login">Sign in</Link></section> : status && !status.checkout_configured
        ? <section className="account-card"><p>Payments aren't set up yet. Nothing can be charged.</p></section>
        : <div className="premium-plans">
          {([["premium_monthly", monthly, ""], ["premium_annual", annual, saving ? `Save ${saving}%` : ""]] as const).map(([key, plan, badge]) => plan && <section className="account-card premium-plan" key={key}>
            {badge && <span className="premium-badge">{badge}</span>}
            <h2>{rupees(plan.amount_paise)}<small> / {plan.period === "yearly" ? "year" : "month"}</small></h2>
            <p>{trial ? `${plans.trial_days} days free, then ${plan.label}. Cancel any time before the trial ends and you won't be charged.` : `${plan.label}, renews automatically. Cancel any time.`}</p>
            <button className="account-primary" disabled={busy} onClick={() => void start(key)}>{busy ? "Opening Razorpay…" : trial ? "Start free trial" : "Subscribe"}</button>
          </section>)}
        </div>}
      <section className="account-card"><h2>What Premium adds</h2><ul>{plans.premium_features?.map(f => <li key={f}>{f}</li>)}</ul>
        {trial && <p className="push-note">Razorpay may place a small, refundable authorisation to set up the payment mandate. Your first charge happens when the trial ends.</p>}</section>
    </>}
    <section className="account-card"><h2>Always free</h2><ul>{plans.always_free?.map(f => <li key={f}>{f}</li>)}</ul><p className="push-note">{plans.note}</p></section>
    {payments.length > 0 && <section className="account-card"><h2>Payments</h2><ul>{payments.map(p => <li key={p.id}>{new Date(p.created_at).toLocaleDateString()} · {p.currency === "INR" ? "₹" + p.amount : `${p.amount} ${p.currency}`} · {p.status}</li>)}</ul></section>}
  </main>;
}
