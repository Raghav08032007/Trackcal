// Shell around every page: account session, device persistence, companion, reminders, navigation and footer.
import { Outlet } from "react-router";
import { StudioNavigation } from "@/components/studio-navigation";
import { PersonalReminderInbox } from "@/components/personal-reminder-inbox";
import { JourneyCompanion } from "@/components/journey-companion";
import { AccountSession } from "@/components/account-session";
import { DevicePersistence } from "@/components/device-persistence";
import { Link } from "@/lib/navigation";
import { TouchFeedback } from "@/components/touch-feedback";
import { ThemeControl } from "@/components/theme-control";

export function RootLayout() {
  return (
    <AccountSession><DevicePersistence /><TouchFeedback /><JourneyCompanion /><PersonalReminderInbox /><StudioNavigation /><Outlet /><footer className="site-links" aria-label="Product links"><ThemeControl /><Link href="/guide">Guided test drive</Link><Link href="/nutrition">Cloud nutrition</Link><Link href="/workouts">Workout sessions</Link><Link href="/workouts/camera">Camera workouts</Link><Link href="/plan">My personal plan</Link><Link href="/play">Quests & play</Link><Link href="/routine">Reminders & coaching</Link><Link href="/tools">Smart tools</Link><Link href="/onboarding">Getting started</Link><Link href="/account">Account & data</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help</Link></footer></AccountSession>
  );
}
