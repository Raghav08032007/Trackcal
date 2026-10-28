import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./studio.css";
import "./focused.css";
import {StudioNavigation} from "@/components/studio-navigation";
import { PersonalReminderInbox } from "@/components/personal-reminder-inbox";
import { JourneyCompanion } from "@/components/journey-companion";
import { AccountSession } from "@/components/account-session";
import { DevicePersistence } from "@/components/device-persistence";
import Link from "next/link";
import { TouchFeedback } from "@/components/touch-feedback";
import { ThemeControl } from "@/components/theme-control";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrackCal — Food & Nutrition Journal",
  description: "Track meals, review nutrition estimates and build daily habits.",
  appleWebApp: { capable: true, title: "TrackCal", statusBarStyle: "default" },
  icons: { apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#17182d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="tc-studio min-h-full flex flex-col"><AccountSession><DevicePersistence /><TouchFeedback /><JourneyCompanion /><PersonalReminderInbox /><StudioNavigation />{children}<footer className="site-links" aria-label="Product links"><ThemeControl /><Link href="/guide">Guided test drive</Link><Link href="/nutrition">Cloud nutrition</Link><Link href="/workouts">Workout sessions</Link><Link href="/workouts/camera">Camera workouts</Link><Link href="/plan">My personal plan</Link><Link href="/play">Quests & play</Link><Link href="/routine">Reminders & coaching</Link><Link href="/tools">Smart tools</Link><Link href="/onboarding">Getting started</Link><Link href="/account">Account & data</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help</Link></footer></AccountSession></body>
    </html>
  );
}

