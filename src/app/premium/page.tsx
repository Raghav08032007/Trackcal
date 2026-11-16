// TrackCal Premium (flag billing). Honest by design: price and renewal in plain words, the trial end date before
// anyone pays, cancelling as easy as subscribing, and the core habit tools always free.
import { t } from "@/lib/i18n";
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
  useEffect(() => { billingRequest<Plans>("plans").then(setPlans).catch(e => setError(e instanceof Error ? e.message : t("Unavailable."))); }, []);
  useEffect(() => {
    if (!user) return;
    billingRequest<BillingStatus>("status").then(value => { if (!acted.current) setStatus(value); }).catch(() => {});
    billingRequest<{ payments: typeof payments }>("history").then(v => setPayments(v.payments)).catch(() => {});
  }, [user]);
  async function start(plan: PlanKey) {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try { const result = await subscribe(plan); if (result) { acted.current = true; setStatus(result); setNotice(result.status === "trialing" ? t("Premium is on. Your free trial runs until {n}.", { n: dateText(result.trial_ends_at) }) : t("Premium is on. Thank you!")); } }
    catch (e) { setError(e instanceof Error ? e.message : t("Checkout failed. You haven't been charged.")); } finally { setBusy(false); }
  }
  async function cancel() {
    if (busy) return; setBusy(true); setError("");
    try { const result = await billingRequest<BillingStatus>("cancel", { reason: "" }); acted.current = true; setStatus(result); setConfirmCancel(false); setNotice(t("Cancelled. You keep Premium until {n}, and you won't be charged again.", { n: dateText(result.current_period_end || result.trial_ends_at) })); }
    catch (e) { setError(e instanceof Error ? e.message : t("Couldn't cancel. Nothing changed; please retry.")); } finally { setBusy(false); }
  }
  if (!ready || !plans) return <main className="account-loading">{error || t("Opening Premium…")}</main>;
  if (!plans.billing_enabled) return <main className="account-page"><section className="account-card"><h1>{t("Premium isn't available yet")}</h1><p>{t("Everything in TrackCal is free to use right now.")}</p><Link href="/account">{t("Back to your account")}</Link></section></main>;
  const monthly = plans.plans.premium_monthly, annual = plans.plans.premium_annual;
  const saving = monthly?.amount_paise && annual?.amount_paise ? Math.round((1 - annual.amount_paise / (monthly.amount_paise * 12)) * 100) : 0;
  const trial = !status || status.trial_available, endsAt = status?.current_period_end || status?.trial_ends_at || null;
  const cancelled = status?.status === "cancelled";
  return <main className="account-page premium-page">
    <div className="account-title"><span className="eyebrow">{t("TRACKCAL PREMIUM")}</span><h1>{t("A little extra, if you want it.")}</h1><p>{t("Premium adds a few extras. Everything you need for the daily habit stays free.")}</p></div>
    <div className="wellness-feedback"><p role="status">{notice}</p>{error && <p role="alert">{error}</p>}</div>
    {status?.premium ? <section className="account-card premium-current">
      <h2>{status.status === "trialing" ? t("You're on the free trial") : cancelled ? t("Premium (cancelled)") : t("You have Premium")}</h2>
      {status.status === "trialing" && !cancelled && <p className="premium-trial">{t("Your trial ends on")}{" "}<strong>{dateText(status.trial_ends_at)}</strong>{t(". After that you'll be charged {n} unless you cancel before then.", { n: status.plan === "premium_annual" ? annual?.label : monthly?.label })}</p>}
      {status.status === "active" && <p>{t("Renews on")}{" "}<strong>{dateText(endsAt)}</strong>.</p>}
      {cancelled && <p>{t("You keep Premium until")}{" "}<strong>{dateText(endsAt)}</strong>{t(". You won't be charged again.")}</p>}
      <ul>{plans.premium_features?.map(f => <li key={f}>{f}</li>)}</ul>
      {!cancelled && (confirmCancel
        ? <div className="premium-confirm" role="group" aria-label={t("Confirm cancellation")}><p>{t("Cancel Premium? You keep it until {n} and won't be charged again.", { n: dateText(endsAt) })}</p><button className="account-primary" disabled={busy} onClick={() => void cancel()}>{t("Yes, cancel Premium")}</button><button disabled={busy} onClick={() => setConfirmCancel(false)}>{t("Keep Premium")}</button></div>
        : <button className="account-secondary" onClick={() => setConfirmCancel(true)}>{t("Cancel Premium")}</button>)}
    </section> : <>
      {!user ? <section className="account-card"><p>{t("Sign in to start Premium.")}</p><Link className="account-primary" href="/login">{t("Sign in")}</Link></section> : status && !status.checkout_configured
        ? <section className="account-card"><p>{t("Payments aren't set up yet. Nothing can be charged.")}</p></section>
        : <div className="premium-plans">
          {([["premium_monthly", monthly, ""], ["premium_annual", annual, saving ? t("Save {n}%", { n: saving }) : ""]] as const).map(([key, plan, badge]) => plan && <section className="account-card premium-plan" key={key}>
            {badge && <span className="premium-badge">{badge}</span>}
            <h2>{rupees(plan.amount_paise)}<small> / {plan.period === "yearly" ? "year" : "month"}</small></h2>
            <p>{trial ? t("{trial_days} days free, then {label}. Cancel any time before the trial ends and you won't be charged.", { trial_days: plans.trial_days, label: plan.label }) : t("{label}, renews automatically. Cancel any time.", { label: plan.label })}</p>
            <button className="account-primary" disabled={busy} onClick={() => void start(key)}>{busy ? t("Opening Razorpay…") : trial ? t("Start free trial") : t("Subscribe")}</button>
          </section>)}
        </div>}
      <section className="account-card"><h2>{t("What Premium adds")}</h2><ul>{plans.premium_features?.map(f => <li key={f}>{f}</li>)}</ul>
        {trial && <p className="push-note">{t("Razorpay may place a small, refundable authorisation to set up the payment mandate. Your first charge happens when the trial ends.")}</p>}</section>
    </>}
    <section className="account-card"><h2>{t("Always free")}</h2><ul>{plans.always_free?.map(f => <li key={f}>{f}</li>)}</ul><p className="push-note">{plans.note}</p></section>
    {payments.length > 0 && <section className="account-card"><h2>{t("Payments")}</h2><ul>{payments.map(p => <li key={p.id}>{new Date(p.created_at).toLocaleDateString()} · {p.currency === "INR" ? "₹" + p.amount : `${p.amount} ${p.currency}`} · {p.status}</li>)}</ul></section>}
  </main>;
}
