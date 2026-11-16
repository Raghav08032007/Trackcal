// Account page: the trial reminder before the first charge, or a quiet link to Premium. Nothing when billing is off.
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { useAccount } from "./account-session";
import { billingRequest, dateText, type BillingStatus } from "@/lib/billing";

export function PremiumNotice() {
  const { user } = useAccount(); const [status, setStatus] = useState<BillingStatus | null>(null);
  useEffect(() => { if (user) billingRequest<BillingStatus>("status").then(setStatus).catch(() => {}); }, [user]);
  if (!user || !status?.billing_enabled) return null;
  const endsSoon = status.status === "trialing" && status.trial_ends_at && new Date(status.trial_ends_at).getTime() - Date.now() < 2 * 86400000;
  if (endsSoon) return <section className="account-card premium-trial" role="status"><strong>{t("Your free trial ends on {n}.", { n: dateText(status.trial_ends_at) })}</strong> <span>{t("You'll be charged then unless you cancel.")}</span> <Link href="/premium">{t("Manage Premium →")}</Link></section>;
  return <p className="premium-link">{status.premium ? <>{t("Premium is on.")}{" "}<Link href="/premium">{t("Manage →")}</Link></> : <Link href="/premium">{t("See TrackCal Premium →")}</Link>}</p>;
}
