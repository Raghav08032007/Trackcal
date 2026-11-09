// The app's structure in one place: five sections, each with a few main pages (shown as the section's page links)
// and, for Food, Move and Me, an overview page with every destination in clear groups. Every page belongs to a
// section, so the right tab is always marked, including detail pages such as one activity or one challenge.
import { Activity, BookOpen, CalendarDays, Camera, ChefHat, ClipboardList, Dumbbell, FileHeart, Flag, Footprints, Gem, HeartPulse, House,
  LifeBuoy, ListChecks, MapPin, MessageSquare, Moon, Bell, ScanBarcode, Search, ShieldCheck, ShoppingBasket, Sparkles, Timer,
  Trophy, UserRound, Utensils, Wand2, type LucideIcon } from "lucide-react";

export type Destination = { href: string; title: string; text: string; icon: LucideIcon };
export type Group = { title: string; items: Destination[] };
export type Section = { id: "today" | "food" | "move" | "play" | "me"; label: string; href: string; icon: LucideIcon;
  pages: [string, string][];          // the main pages, shown as the section's page links
  also: string[];                     // other pages in this section; "/x/*" means every page under /x/
  groups?: Group[] };                 // the overview page, when the section has one

export const SECTIONS: Section[] = [
  { id: "today", label: "Today", href: "/", icon: House, pages: [["/", "Today"], ["/coach", "Coach"]], also: [] },
  { id: "food", label: "Food", href: "/food", icon: Utensils,
    pages: [["/food", "Overview"], ["/nutrition", "Diary"], ["/scanner", "Log food"], ["/meal-plans", "Meal plans"], ["/recipes", "Recipes"]],
    also: ["/barcode", "/describe", "/food-library", "/fasting", "/journal", "/tools", "/menu"],
    groups: [
      { title: "Log food", items: [
        { href: "/scanner", title: "Snap a photo", text: "Take a picture of your plate and check what it found.", icon: Camera },
        { href: "/barcode", title: "Scan a barcode", text: "Packaged food, with the label's own values.", icon: ScanBarcode },
        { href: "/describe", title: "Describe a meal", text: "Type or say what you ate, in your own words.", icon: MessageSquare },
        { href: "/food-library", title: "Search foods", text: "Find a food by name, including regional names.", icon: Search } ] },
      { title: "Your diary", items: [
        { href: "/nutrition", title: "Today's diary", text: "Your meals, targets and how the day is going.", icon: BookOpen },
        { href: "/fasting", title: "Fasting timer", text: "Start, pause and see your fasting window.", icon: Timer } ] },
      { title: "Plan and cook", items: [
        { href: "/meal-plans", title: "Meal plans", text: "Plan the week's meals within your targets and budget.", icon: CalendarDays },
        { href: "/menu", title: "Eating out", text: "Photograph a menu and see which dishes fit your day.", icon: Utensils },
        { href: "/recipes", title: "Recipes", text: "Build a recipe and see its nutrition per serving.", icon: ChefHat },
        { href: "/tools?tab=pantry", title: "Pantry and shopping", text: "What you have, what's expiring, what to buy.", icon: ShoppingBasket },
        { href: "/tools", title: "Recipe import and smart tools", text: "Bring in a recipe from a link, plan within a budget.", icon: Wand2 } ] } ] },
  { id: "move", label: "Move", href: "/move", icon: Activity,
    pages: [["/move", "Overview"], ["/workouts/muscles", "By muscle"], ["/workouts/camera", "Camera"], ["/workouts/gps", "Record"], ["/workouts", "Workouts"]],
    also: ["/workouts/*", "/activities", "/activities/*", "/programs", "/recovery", "/plan"],
    groups: [
      { title: "Train", items: [
        { href: "/workouts/muscles", title: "Plan by muscle", text: "Pick the muscles to train; get a plan that leaves out anything not suitable for your injuries.", icon: Search },
        { href: "/workouts/camera", title: "Camera workout and posture check", text: "Counts your reps and tells you, as you move, how to keep good posture.", icon: Camera },
        { href: "/workouts", title: "Your workouts", text: "Your sessions, sets and every workout you've done.", icon: Dumbbell },
        { href: "/programs", title: "Programs", text: "Step-by-step plans that grow with you.", icon: ListChecks } ] },
      { title: "Outdoors", items: [
        { href: "/workouts/gps", title: "Record a route", text: "Run, walk, hike or ride with GPS.", icon: MapPin },
        { href: "/activities", title: "Your activities", text: "Routes, splits and personal records.", icon: Footprints } ] },
      { title: "Plan and recover", items: [
        { href: "/plan", title: "My 7-day plan", text: "A week of workouts that protects any injuries.", icon: CalendarDays },
        { href: "/recovery", title: "Recovery", text: "Which muscles are rested and ready.", icon: Moon } ] } ] },
  { id: "play", label: "Play", href: "/play", icon: Sparkles,
    pages: [["/play", "Quests"], ["/challenges", "Challenges"], ["/feed", "Feed"], ["/communities", "Clubs"], ["/events", "Events"]],
    also: ["/challenges/*", "/events/*", "/c/*", "/u/*", "/moderation"] },
  { id: "me", label: "Me", href: "/me", icon: UserRound,
    pages: [["/me", "Overview"], ["/account", "Account"], ["/health", "My report"], ["/progress", "Progress"], ["/routine", "Reminders"]],
    also: ["/premium", "/help", "/onboarding", "/guide", "/privacy", "/terms", "/credits", "/body-preview", "/design"],
    groups: [
      { title: "You", items: [
        { href: "/account", title: "Account and profile", text: "Your name, password and what's saved to your account.", icon: UserRound },
        { href: "/health", title: "My report", text: "Your blood report, turned into food and exercise advice.", icon: FileHeart },
        { href: "/progress", title: "Progress", text: "Habits, training load and how each exercise is going.", icon: Trophy },
        { href: "/onboarding", title: "About you", text: "Age, goals, injuries and food you eat. Change any time.", icon: ClipboardList } ] },
      { title: "Settings", items: [
        { href: "/routine", title: "Reminders", text: "Gentle nudges for water, meals, workouts and sleep.", icon: Bell },
        { href: "/premium", title: "Premium", text: "Longer history and extra coaching.", icon: Gem },
        { href: "/tools?tab=device", title: "This device and offline", text: "What works offline and what's stored here.", icon: HeartPulse } ] },
      { title: "Help", items: [
        { href: "/help", title: "Help", text: "How each feature works, in plain words.", icon: LifeBuoy },
        { href: "/guide", title: "Guided test drive", text: "Six small steps to try the app.", icon: Flag },
        { href: "/privacy", title: "Privacy", text: "What is stored, where, and how to delete it.", icon: ShieldCheck } ] } ] },
];

/** The section a page belongs to. */
export function sectionFor(path: string): Section | null {
  const match = (pattern: string) => pattern.endsWith("/*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
  return SECTIONS.find(s => s.pages.some(([href]) => href === path)) ?? SECTIONS.find(s => s.also.some(match)) ?? null;
}

/** A friendly name for a page that is not one of its section's main pages, e.g. "Barcode". */
export function pageTitle(path: string): string | null {
  for (const s of SECTIONS) for (const g of s.groups ?? []) for (const d of g.items) if (d.href === path) return d.title;
  const named: Record<string, string> = { "/coach": "Coach", "/journal": "On this device", "/workouts/holds": "Holds", "/premium": "Premium", "/help": "Help",
    "/guide": "Test drive", "/terms": "Terms", "/credits": "Photo credits", "/body-preview": "Body preview", "/design": "Design", "/moderation": "Moderation" };
  return named[path] ?? null;
}

