// A message from the server about something the person just published (for example, a post held for review, with a
// helpline when it mentioned self-harm). The request helpers call announceFrom(); <HeldNotice /> shows it on any page.
export const NOTICE_EVENT = "trackcal:notice";
export type Notice = { text: string; kind: "self_harm" | "abuse" | string };

export function announceFrom(data: unknown) {
  if (typeof window === "undefined" || !data || typeof data !== "object") return;
  const { notice, held } = data as { notice?: unknown; held?: unknown };
  if (typeof notice === "string" && notice.trim())
    window.dispatchEvent(new CustomEvent<Notice>(NOTICE_EVENT, { detail: { text: notice, kind: typeof held === "string" ? held : "" } }));
}
