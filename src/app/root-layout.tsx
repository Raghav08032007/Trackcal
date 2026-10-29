// Shell around every page: account session, device persistence, companion, reminders, navigation and footer.
import { Outlet } from "react-router";
import { AppNavigation } from "@/components/app-navigation";
import { PersonalReminderInbox } from "@/components/personal-reminder-inbox";
import { JourneyCompanion } from "@/components/journey-companion";
import { AccountSession } from "@/components/account-session";
import { DevicePersistence } from "@/components/device-persistence";
import { UpdatePrompt } from "@/components/app-updates";
import { BetaFeedback } from "@/components/beta-feedback";
import { Link } from "@/lib/navigation";
import { TouchFeedback } from "@/components/touch-feedback";
import { LivingCharacters } from "@/components/living-characters";
import { ThemeControl } from "@/components/theme-control";

export function RootLayout() {
  return (
    <AccountSession><DevicePersistence /><UpdatePrompt /><TouchFeedback /><LivingCharacters /><JourneyCompanion /><PersonalReminderInbox /><AppNavigation /><Outlet /><footer className="site-links" aria-label="Product links"><ThemeControl /><Link href="/guide">Guided test drive</Link><Link href="/help">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><BetaFeedback /></footer></AccountSession>
  );
}
