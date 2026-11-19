import { msg, t, localizedMap } from "./i18n";
import { announceFrom } from "@/lib/notice";
// Communities client (flags communities + social_feed). Posts use the feed's types and post card.
export type Community = {
  slug: string; name: string; description: string; category: string; visibility: "public" | "private"; rules: string; archived: boolean; members: number;
  membership: { role: "owner" | "moderator" | "member"; status: "active" | "pending" | "banned" } | null; can_moderate: boolean; pending?: number;
};
export type Member = { handle: string; display_name: string; character_id: string; role: string };
export type QueueItem = { target_type: "post" | "comment"; target_id: string; reasons: string[]; content: string; hidden: boolean | null };
export const CATEGORY_LABELS: Record<string, string> = {
  running: msg("Running"), walking: msg("Walking"), yoga: msg("Yoga"), strength: msg("Strength"), cycling: msg("Cycling"), sports: msg("Sports"), cooking: msg("Cooking"),
  nutrition: msg("Nutrition"), mindfulness: msg("Mindfulness"), college: msg("College"), other: msg("Other"),
};
localizedMap(CATEGORY_LABELS);

export class CommunityError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function communities<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/communities" + (path ? "/" + path : ""), { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new CommunityError(data.error || t("Communities are unavailable right now. Nothing was changed."), response.status);
  announceFrom(data);   // e.g. a post held for review
  return data as T;
}
