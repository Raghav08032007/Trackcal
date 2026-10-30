// One event: details and sign-up for everyone; for the organizer, the live check-in QR code and the attendee list.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { CATEGORY_LABELS } from "@/lib/communities";
import { events, qrSvg, when, type Attendee, type EventView } from "@/lib/events";

export const metadata = { title: "TrackCal — Event" };

export default function Page() {
  const { id = "" } = useParams(); const { ready, user } = useAccount();
  const [event, setEvent] = useState<EventView | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const load = useCallback(() => events<{ event: EventView }>("/" + id).then(v => { setEvent(v.event); setError(""); }, e => setError(e instanceof Error ? e.message : "Event not found.")), [id]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  async function act(path: string, method: string, message: string) {
    if (busy) return; setBusy(true); setNotice("");
    try { const v = await events<{ event: EventView }>(`/${id}${path}`, method); setEvent(v.event); setNotice(message); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  if (!ready) return <main className="account-loading">Opening the event…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><p>Sign in to see this event.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  if (!event) return <main className="account-page"><section className="account-card"><p role={error ? "alert" : "status"}>{error || "Loading…"}</p><Link href="/events">All events</Link></section></main>;
  const full = event.capacity !== null && event.going >= event.capacity, cancelled = event.status === "cancelled";
  return <main className="account-page social-page">
    <section className="account-card event-cover">
      <span className="eyebrow">{CATEGORY_LABELS[event.category] || event.category}{event.community ? <> · <Link href={`/c/${event.community.slug}`}>{event.community.name}</Link></> : null}</span>
      <h1>{event.title}</h1>
      <p><strong>{when(event)}</strong> <small>({event.timezone})</small></p>
      <p>📍 {event.location}</p>
      {event.organizer && <p>Organized by <Link href={`/u/${event.organizer.handle}`}>{event.organizer.display_name}</Link></p>}
      {event.description && <p className="community-rules">{event.description}</p>}
      <p>{event.going} going{event.capacity ? ` of ${event.capacity}` : ""}{event.waitlist ? ` · ${event.waitlist} on the waitlist` : ""}</p>
      {cancelled && <p role="status" className="camera-paused">This event was cancelled.</p>}
      <div className="account-actions">
        {!event.organizing && !cancelled && (!event.mine || event.mine.status === "cancelled"
          ? <button className="account-primary" disabled={busy} onClick={() => void act("/registration", "POST", full ? "You're on the waitlist. We'll move you up if a place opens." : "You're going!")}>{full ? "Join the waitlist" : "I'm going"}</button>
          : event.mine.checked_in ? <span className="social-milestone">✓ Checked in</span>
          : <button disabled={busy} onClick={() => void act("/registration", "DELETE", "You're no longer signed up.")}>{event.mine.status === "waitlist" ? "Leave the waitlist" : "Can't make it"}</button>)}
        {event.organizing && !cancelled && <button disabled={busy} onClick={() => { if (confirm("Cancel this event for everyone?")) void act("", "DELETE", "Event cancelled."); }}>Cancel event</button>}
        <Link href="/events">All events</Link>
      </div>
      {event.mine?.status === "going" && !event.mine.checked_in && !event.organizing && <p className="push-note">At the event, scan the QR code on the organizer&apos;s screen with your phone camera to check in.</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
    {event.organizing && !cancelled && <Organizer event={event} onChange={load} />}
  </main>;
}

function Organizer({ event, onChange }: { event: EventView; onChange: () => void }) {
  const [code, setCode] = useState<{ token: string; path: string; refresh_in: number; checked_in: number } | null>(null), [codeError, setCodeError] = useState("");
  const [people, setPeople] = useState<Attendee[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const loadPeople = useCallback(() => events<{ attendees: Attendee[] }>(`/${event.id}/attendees`).then(v => setPeople(v.attendees)).catch(() => {}), [event.id]);
  useEffect(() => { void loadPeople(); }, [loadPeople]);
  useEffect(() => {
    if (!event.check_in_open) return;
    let timer: ReturnType<typeof setTimeout>, alive = true;
    const tick = () => events<NonNullable<typeof code>>(`/${event.id}/check-in-code`).then(v => { if (!alive) return; setCode(v); setCodeError(""); timer = setTimeout(tick, v.refresh_in * 1000); void loadPeople(); },
      e => { if (alive) { setCodeError(e instanceof Error ? e.message : "Couldn't load the code."); timer = setTimeout(tick, 10000); } });
    tick(); return () => { alive = false; clearTimeout(timer); };
  }, [event.id, event.check_in_open, loadPeople]);
  const url = code ? `${location.origin}${code.path}?t=${code.token}` : "";
  return <>
    <section className="account-card event-qr">
      <h2>Check-in</h2>
      {!event.check_in_open ? <p>The QR code appears here 30 minutes before the start and stays until the end.</p> : code ? <>
        <p>Show this to people as they arrive. It changes every 30 seconds, so a forwarded photo soon stops working.</p>
        <div className="event-qr-code" role="img" aria-label="Check-in QR code" dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
        <p><strong>{code.checked_in}</strong> checked in · new code in {code.refresh_in}s</p>
      </> : <p role={codeError ? "alert" : "status"}>{codeError || "Loading the code…"}</p>}
    </section>
    <section className="account-card"><h2>Who&apos;s coming</h2>
      {!people.length && <p>No one has signed up yet.</p>}
      {people.map(p => <div key={p.handle} className="studio-list-row"><span><Link href={`/u/${p.handle}`}>{p.display_name}</Link> <small>@{p.handle} · {p.status}{p.checked_in ? ` · checked in${p.method === "organizer" ? " by you" : ""}` : ""}</small></span>
        {event.check_in_open && p.status === "going" && !p.checked_in && <button disabled={busy} onClick={() => void (async () => { setBusy(true); setMessage(""); try { await events(`/${event.id}/check-in`, "POST", { handle: p.handle }); setMessage(`${p.display_name} is checked in.`); await loadPeople(); onChange(); } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn't check in."); } finally { setBusy(false); } })()}>Check in</button>}
      </div>)}
      {message && <p role="status">{message}</p>}
    </section>
  </>;
}
