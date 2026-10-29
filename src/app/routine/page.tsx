import Link from "@/lib/navigation";
import { Reminders } from "@/components/reminders";
import { CoachBooking } from "@/components/coach-booking";
import { HistoryExport } from "@/components/history-export";
import { HistoryImport } from "@/components/history-import";
import { useAccount } from "@/components/account-session";
export default function Page(){const {ready,user}=useAccount();return <main className="account-page"><div className="account-title"><p className="eyebrow">YOUR EVERYDAY RHYTHM</p><h1>A routine that fits real life.</h1><p>Plan a check-in, protect time for your meals, and keep your history together.</p></div>{ready?<div className="studio-stack" key={user?.id||"guest"}><section className="account-card"><h2>Personalized reminder preferences</h2><p>Configure optional hydration, activity, recovery, sleep and motivation check-ins in your personal plan.</p><Link href="/plan#personal-reminders">Edit personalized reminders →</Link></section><Reminders/><CoachBooking/><HistoryImport/><HistoryExport/></div>:<p>Opening your workspace…</p>}</main>;}

