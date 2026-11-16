import { t } from "@/lib/i18n";
import Link from "@/lib/navigation";
import { Reminders } from "@/components/reminders";
import { CoachBooking } from "@/components/coach-booking";
import { HistoryExport } from "@/components/history-export";
import { HistoryImport } from "@/components/history-import";
import { useAccount } from "@/components/account-session";
import { PushSettingsCard } from "@/components/push-settings";
import { MotivationCard } from "@/components/app-updates";
export default function Page(){const {ready,user}=useAccount();return <main className="account-page"><div className="account-title"><p className="eyebrow">{t("YOUR EVERYDAY RHYTHM")}</p><h1>{t("A routine that fits real life.")}</h1><p>{t("Plan a check-in, protect time for your meals, and keep your history together.")}</p></div>{ready?<div className="studio-stack" key={user?.id||"guest"}><MotivationCard/><PushSettingsCard/><section className="account-card"><h2>{t("Personalized reminder preferences")}</h2><p>{t("Configure optional hydration, activity, recovery, sleep and motivation check-ins in your personal plan.")}</p><Link href="/plan#personal-reminders">{t("Edit personalized reminders →")}</Link></section><Reminders/><CoachBooking/><HistoryImport/><HistoryExport/></div>:<p>{t("Opening your workspace…")}</p>}</main>;}

