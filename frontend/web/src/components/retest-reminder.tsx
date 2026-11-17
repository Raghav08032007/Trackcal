// Today: when the latest blood report's retest date is close (three weeks or less) or has passed, a short reminder of which
// results to recheck and why. Nothing shows without a report, or for a guest.
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Link } from "@/lib/navigation";
import { useAccount, useWorkspaceScope } from "@/components/account-session";
import { health, type Summary } from "@/lib/health";

const DAY = 86400000, SOON_DAYS = 21;

export function retestDue(summary: Summary | null, today: Date) {
  const plan = summary?.latest?.plan, on = plan?.retest_on;
  if (!plan || !on) return null;
  const days = Math.round((new Date(on + "T00:00:00").getTime() - new Date(today.toDateString()).getTime()) / DAY);
  if (days > SOON_DAYS) return null;
  const tests = (summary!.latest!.findings || []).filter(f => f.status !== "normal").map(f => f.name);
  return { days, on, tests, why: plan.why ?? [] };
}

export function RetestReminder() {
  const { user } = useAccount(), scope = useWorkspaceScope(), [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    if (!user || scope === "guest") return;
    let alive = true;
    health<Summary>("summary").then(s => { if (alive) setSummary(s); }).catch(() => {});
    return () => { alive = false; };
  }, [user, scope]);
  const due = retestDue(summary, new Date());
  if (!due) return null;
  const when = due.days < 0 ? `${-due.days} day${due.days === -1 ? "" : "s"} overdue` : due.days === 0 ? "due today" : `due in ${due.days} day${due.days === 1 ? "" : "s"}`;
  const date = new Date(due.on + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return <section className="ds-card retest-reminder" aria-labelledby="retest-title">
    <span className="retest-icon" aria-hidden="true"><FlaskConical size={22} /></span>
    <div>
      <h2 id="retest-title">{t("Blood test recheck")}{" "}{when}</h2>
      <p>{due.tests.length ? t("Recheck {tests} around {date}, to see how far your changes have moved them.", { tests: due.tests.slice(0, 4).join(", "), date }) : t("Your next check is around {date}, to see how far your changes have moved them.", { date })}</p>
      {due.why[0] && <p className="ds-sub">{t("Timing follows {source}.", { source: due.why[0].source })}</p>}
      <Link href="/health" className="account-secondary">{t("Open my report")}</Link>
    </div>
  </section>;
}
