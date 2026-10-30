// Verified events client (flags verified_events + social_feed).
import qrcode from "qrcode-generator";

export type EventView = {
  id: string; title: string; description: string; category: string; location: string; starts_at: string; ends_at: string; timezone: string;
  capacity: number | null; status: "scheduled" | "cancelled"; going: number; waitlist: number;
  organizer: { handle: string; display_name: string; character_id: string } | null; community: { slug: string; name: string } | null;
  mine: { status: "going" | "waitlist" | "cancelled"; checked_in: boolean } | null; organizing: boolean; check_in_open: boolean;
};
export type Attendee = { handle: string; display_name: string; status: string; checked_in: boolean; method: string | null };

export class EventError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function events<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/events" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new EventError(data.error || "Events are unavailable right now. Nothing was changed.", response.status);
  return data as T;
}

/** "Sat 2 Nov, 7:00 am – 8:00 am" in the event's own time zone. */
export function when(e: Pick<EventView, "starts_at" | "ends_at" | "timezone">) {
  const zone = e.timezone || undefined, start = new Date(e.starts_at), end = new Date(e.ends_at);
  const day = start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: zone });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: zone });
  return `${day}, ${time(start)} – ${time(end)}`;
}

/** An SVG QR code (data, not a URL to an outside service, so it works under the page's security policy). */
export function qrSvg(text: string) {
  const qr = qrcode(0, "M"); qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
}
