// Announces newly earned XP so on-screen characters can celebrate. Fired only when the server awarded XP.
export const XP_AWARDED_EVENT = "trackcal-xp-awarded";

export function announceXp(data: unknown) {
  const xp = typeof data === "object" && data !== null ? (data as { awarded_xp?: unknown }).awarded_xp : undefined;
  if (typeof window !== "undefined" && typeof xp === "number" && xp > 0) window.dispatchEvent(new CustomEvent(XP_AWARDED_EVENT, { detail: { xp } }));
}
