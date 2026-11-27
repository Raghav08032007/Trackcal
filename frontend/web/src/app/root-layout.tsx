// Shell around every page: account session, device persistence, companion, reminders, navigation and footer.
import { t } from "@/lib/i18n";
import { LanguagePicker } from "@/components/language-picker";
import { Outlet } from "react-router";
import { lazy, Suspense } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { AccountSession, AccountUnavailable } from "@/components/account-session";
import { DevicePersistence } from "@/components/device-persistence";
import { UpdatePrompt } from "@/components/app-updates";
import { MotionLayer } from "@/components/motion-layer";
import { Link } from "@/lib/navigation";
import { TouchFeedback } from "@/components/touch-feedback";
import { LivingCharacters } from "@/components/living-characters";
import { ThemeControl } from "@/components/theme-control";
import { HeldNotice } from "@/components/held-notice";
import { NavProgress } from "@/components/nav-progress";

// Not needed for the first screen: loaded just after it, so a phone downloads less before the page appears.
const JourneyCompanion = lazy(() => import("@/components/journey-companion").then(m => ({ default: m.JourneyCompanion })));
const PersonalReminderInbox = lazy(() => import("@/components/personal-reminder-inbox").then(m => ({ default: m.PersonalReminderInbox })));
const BetaFeedback = lazy(() => import("@/components/beta-feedback").then(m => ({ default: m.BetaFeedback })));

export function RootLayout() {
  return (
    <AccountSession><NavProgress /><DevicePersistence /><UpdatePrompt /><MotionLayer /><TouchFeedback /><LivingCharacters /><Suspense fallback={null}><JourneyCompanion /></Suspense><HeldNotice /><Suspense fallback={null}><PersonalReminderInbox /></Suspense><AppNavigation /><AccountUnavailable><Outlet /></AccountUnavailable><footer className="site-links site-footer" aria-label={t("Product links")}>
      <div className="site-footer-brand"><Link href="/" className="site-footer-logo">trackcal<span>.</span></Link><p>{t("Eat well, move well, at your own pace.")}</p><Suspense fallback={null}><BetaFeedback /></Suspense></div>
      <nav className="site-footer-links" aria-label={t("Help and legal")}>
        <div><h2>{t("Get started")}</h2><Link href="/guide">{t("Guided test drive")}</Link><Link href="/help">{t("Help")}</Link></div>
        <div><h2>{t("Legal")}</h2><Link href="/privacy">{t("Privacy")}</Link><Link href="/terms">{t("Terms")}</Link><Link href="/credits">{t("Photo credits")}</Link></div>
      </nav>
      <div className="site-footer-prefs"><h2>{t("Preferences")}</h2><LanguagePicker /><ThemeControl /></div>
      <p className="site-footer-note">{t("Estimates to help you, never a medical assessment.")}</p>
    </footer></AccountSession>
  );
}
