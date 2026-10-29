// Communities client (flags communities + social_feed). Posts use the feed's types and post card.
export type Community = {
  slug: string; name: string; description: string; category: string; visibility: "public" | "private"; rules: string; archived: boolean; members: number;
  membership: { role: "owner" | "moderator" | "member"; status: "active" | "pending" | "banned" } | null; can_moderate: boolean; pending?: number;
};
export type Member = { handle: string; display_name: string; character_id: string; role: string };
export type QueueItem = { target_type: "post" | "comment"; target_id: string; reasons: string[]; content: string; hidden: boolean | null };
export const CATEGORY_LABELS: Record<string, string> = {
  running: "Running", walking: "Walking", yoga: "Yoga", strength: "Strength", cycling: "Cycling", sports: "Sports", cooking: "Cooking",
  nutrition: "Nutrition", mindfulness: "Mindfulness", college: "College", other: "Other",
};

export class CommunityError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function communities<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/communities" + (path ? "/" + path : ""), { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new CommunityError(data.error || "Communities are unavailable right now. Nothing was changed.", response.status);
  return data as T;
}
