// Shell around every page: account session, device persistence, companion, reminders, navigation and footer.
import { Outlet } from "react-router";
import { AppNavigation } from "@/components/app-navigation";
import { PersonalReminderInbox } from "@/components/personal-reminder-inbox";
import { JourneyCompanion } from "@/components/journey-companion";
import { AccountSession, AccountUnavailable } from "@/components/account-session";
import { DevicePersistence } from "@/components/device-persistence";
import { UpdatePrompt } from "@/components/app-updates";
import { MotionLayer } from "@/components/motion-layer";
import { BetaFeedback } from "@/components/beta-feedback";
import { Link } from "@/lib/navigation";
import { TouchFeedback } from "@/components/touch-feedback";
import { LivingCharacters } from "@/components/living-characters";
import { ThemeControl } from "@/components/theme-control";

export function RootLayout() {
  return (
    <AccountSession><DevicePersistence /><UpdatePrompt /><MotionLayer /><TouchFeedback /><LivingCharacters /><JourneyCompanion /><PersonalReminderInbox /><AppNavigation /><AccountUnavailable><Outlet /></AccountUnavailable><footer className="site-links site-footer" aria-label="Product links">
      <div className="site-footer-brand"><Link href="/" className="site-footer-logo">trackcal<span>.</span></Link><p>Eat well, move well, at your own pace.</p><BetaFeedback /></div>
      <nav className="site-footer-links" aria-label="Help and legal">
        <div><h2>Get started</h2><Link href="/guide">Guided test drive</Link><Link href="/help">Help</Link></div>
        <div><h2>Legal</h2><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/credits">Photo credits</Link></div>
      </nav>
      <div className="site-footer-prefs"><h2>Preferences</h2><ThemeControl /></div>
      <p className="site-footer-note">Estimates to help you, never a medical assessment.</p>
    </footer></AccountSession>
  );
}
