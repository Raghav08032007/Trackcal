import { msg, t, locale, localized } from "./i18n";
import { localeOf } from "./i18n/locales";
import { announceFrom } from "@/lib/notice";
// Social feed client (flag social_feed). The server applies every visibility and safety rule.
export type Reaction = "like" | "cheer" | "clap" | "hug";
export type Author = { handle: string; display_name: string; character_id: string };
/** A shared GPS activity, as its feed card shows it. The outline already has its start, end and privacy zones removed. */
export type ActivityCard = { id: string; sport: "walk" | "run" | "hike" | "ride"; distance_m: number; moving_s: number; elevation_gain_m: number; records: string[]; preview: [number, number][] };
export type FeedPost = {
  id: string; author: Author; body: string; milestone: { type: string; title: string; activity?: ActivityCard } | null; visibility: "public" | "followers";
  created_at: string; reactions: Record<Reaction, number>; my_reaction: Reaction | null; comment_count: number; mine: boolean; hidden: boolean;
};
export type Profile = {
  handle: string; display_name: string; bio: string; character_id: string; private: boolean; counts: { followers: number; following: number; posts: number };
  relationship?: { following: "active" | "pending" | null; follows_you: boolean; blocked: boolean };
};
export type Comment = { id: string; body: string; created_at: string; author: Author; can_delete: boolean };
export const REACTIONS: { kind: Reaction; label: string; icon: string }[] = [
  { kind: "like", label: msg("Like"), icon: "♥" }, { kind: "cheer", label: msg("Cheer"), icon: "🎉" }, { kind: "clap", label: msg("Clap"), icon: "👏" }, { kind: "hug", label: msg("Hug"), icon: "🤗" },
];
localized(REACTIONS, ["label"]);
export const REPORT_REASONS = [["harassment", msg("Harassment or bullying")], ["hate", msg("Hate speech")], ["self_harm", msg("Self-harm or eating-disorder content")], ["sexual", msg("Sexual content")], ["spam", msg("Spam")], ["misinformation", msg("Harmful health misinformation")], ["other", msg("Something else")]] as const;
localized(REPORT_REASONS as unknown as string[][], ["1"]);
export const CHARACTERS = ["pip", "nova", "milo", "luna", "rio", "sage"] as const;
export const avatar = (id: string) => `/characters/${id}-256.webp`;

export class SocialError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function social<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/social/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new SocialError(data.error || t("The feed is unavailable right now. Nothing was changed."), response.status);
  announceFrom(data);   // e.g. a post held for review
  return data as T;
}

export function ago(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t("just now");
  const say = new Intl.RelativeTimeFormat(localeOf(locale()).format, { numeric: "always", style: "narrow" });
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) if (seconds >= size) return say.format(-Math.floor(seconds / size), unit);
  return "";
}
