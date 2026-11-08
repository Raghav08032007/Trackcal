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
  { kind: "like", label: "Like", icon: "♥" }, { kind: "cheer", label: "Cheer", icon: "🎉" }, { kind: "clap", label: "Clap", icon: "👏" }, { kind: "hug", label: "Hug", icon: "🤗" },
];
export const REPORT_REASONS = [["harassment", "Harassment or bullying"], ["hate", "Hate speech"], ["self_harm", "Self-harm or eating-disorder content"], ["sexual", "Sexual content"], ["spam", "Spam"], ["misinformation", "Harmful health misinformation"], ["other", "Something else"]] as const;
export const CHARACTERS = ["pip", "nova", "milo", "luna", "rio", "sage"] as const;
export const avatar = (id: string) => `/characters/${id}-256.webp`;

export class SocialError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function social<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/social/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new SocialError(data.error || "The feed is unavailable right now. Nothing was changed.", response.status);
  return data as T;
}

export function ago(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  for (const [unit, size] of [["d", 86400], ["h", 3600], ["m", 60]] as const) if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
  return "";
}
