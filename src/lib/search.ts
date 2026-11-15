// What "search everything" can find without a connection: every page (by name and by everyday words) and quick actions.
// Foods and your workouts are added from the server by the search panel.
import { SECTIONS } from "@/lib/sections";

export type Hit = { kind: "page" | "action" | "food" | "workout"; id: string; title: string; detail: string; href?: string; action?: "water" | "quick-add" };

/** Everyday words people use for each page. */
const WORDS: Record<string, string> = {
  "/": "today home dashboard water sleep day summary",
  "/coach": "coach pip advice tips companion",
  "/nutrition": "diary meals calories eaten food log macros protein carbs fat targets",
  "/scanner": "photo camera picture plate snap scan meal image ai",
  "/barcode": "barcode packet label package packaged product upc ean",
  "/describe": "type say voice speak describe text words",
  "/food-library": "search food find dish ingredient catalogue catalog regional",
  "/fasting": "fast fasting intermittent window timer",
  "/meal-plans": "meal plan week weekly plan meals planner budget",
  "/menu": "menu restaurant eating out order swiggy zomato dish",
  "/recipes": "recipe cook cooking homemade dish servings",
  "/tools?tab=pantry": "pantry shopping grocery groceries list expiry expiring buy kitchen",
  "/tools": "import recipe link url budget smart tools label voice",
  "/workouts": "workout gym sets reps history exercise session lifting training",
  "/workouts/camera": "camera rep counter form posture check squat pushup push-up curl plank exercise",
  "/workouts/muscles": "muscle body part exercises legs arms chest back core planner plan",
  "/programs": "program beginner course weeks plan",
  "/workouts/gps": "run running walk walking ride cycling bike hike gps record route map",
  "/activities": "activities routes splits records personal best pace strava",
  "/weekly": "weekly summary week fitness fatigue form training load trend who guideline met minutes freshness",
  "/segments": "segments segment leaderboard ranking stretch hill climb sprint personal record pr kom strava",
  "/plan": "7 day plan weekly schedule injury safe week",
  "/recovery": "recovery rest sore soreness muscle ready",
  "/account": "account profile password email name sign out logout",
  "/health": "blood test report lab medical doctor cholesterol sugar diabetes thyroid haemoglobin hemoglobin",
  "/progress": "progress weight habits chart trend streak stats graph",
  "/onboarding": "about you age height weight goal injury surgery setup profile diet",
  "/routine": "reminder reminders notification alarm nudge",
  "/premium": "premium subscription pay payment upgrade plan price",
  "/tools?tab=device": "offline device storage sync backup",
  "/help": "help how faq support question",
  "/guide": "tour test drive tutorial start",
  "/privacy": "privacy data delete export personal information",
  "/play": "quests game points xp companion rewards play",
  "/challenges": "challenge challenges competition goal",
  "/feed": "feed friends kudos posts social following",
  "/communities": "clubs club community group groups",
  "/events": "events event race meetup",
};

type Entry = { title: string; detail: string; href: string };

/** Every destination once: overview cards first (they have the clearest names), then section pages. */
export function pageEntries(): Entry[] {
  const seen = new Map<string, Entry>();
  for (const s of SECTIONS) for (const g of s.groups ?? []) for (const d of g.items) if (!seen.has(d.href)) seen.set(d.href, { title: d.title, detail: `${s.label} · ${d.text}`, href: d.href });
  for (const s of SECTIONS) for (const [href, label] of s.pages) if (!seen.has(href)) seen.set(href, { title: href === s.href && label === "Overview" ? s.label : label, detail: s.label, href });
  return [...seen.values()];
}

export const ACTIONS: Hit[] = [
  { kind: "action", id: "water", title: "Add 250 ml water", detail: "Saved to today", action: "water" },
  { kind: "action", id: "quick-add", title: "Quick add", detail: "Food, water, sleep, how you feel", action: "quick-add" },
  { kind: "action", id: "camera", title: "Start a camera workout", detail: "Move", href: "/workouts/camera" },
  { kind: "action", id: "route", title: "Record a route", detail: "Move", href: "/workouts/gps" },
  { kind: "action", id: "log", title: "Log food", detail: "Food", href: "/scanner" },
];

export const norm = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** How well text matches what was typed: 0 means not at all. Every typed word must match something. */
export function score(query: string, title: string, extra = ""): number {
  const q = norm(query); if (!q) return 0;
  const t = norm(title), words = `${t} ${norm(extra)}`.split(" ");
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  let total = 0;
  for (const part of q.split(" ")) {
    if (t.split(" ").some(w => w.startsWith(part))) total += 30;
    else if (words.some(w => w.startsWith(part))) total += 18;
    else if (part.length >= 3 && `${t} ${norm(extra)}`.includes(part)) total += 8;
    else return 0;
  }
  return total;
}

/** Pages and actions that match, best first. */
export function searchLocal(query: string, limit = 8): Hit[] {
  const pages = pageEntries().map(p => ({ hit: { kind: "page" as const, id: p.href, title: p.title, detail: p.detail, href: p.href }, s: score(query, p.title, `${WORDS[p.href] ?? ""} ${p.detail}`) }));
  const actions = ACTIONS.map(a => ({ hit: a, s: score(query, a.title, a.detail + (a.action === "water" ? " drink glass hydration" : "")) + 1 }));
  return [...actions, ...pages].filter(x => x.s > 1).sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.hit);
}
