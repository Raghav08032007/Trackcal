// Opened by scanning the organizer's QR code: /events/<id>/check-in?t=<token>. Checks in once, then celebrates.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import Link from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { announceXp } from "@/lib/celebrate";
import { events, type EventView } from "@/lib/events";

export const metadata = { title: "TrackCal — Check in" };

export default function Page() {
  const { id = "" } = useParams(); const { ready, user } = useAccount();
  const [state, setState] = useState<{ ok: boolean; message: string; event?: EventView; xp?: number } | null>(null), sent = useRef(false);
  useEffect(() => {
    if (!user || sent.current) return; sent.current = true;
    const token = new URLSearchParams(location.search).get("t") || "";
    events<{ awarded_xp: number; event: EventView }>(`/${id}/check-in`, "POST", { token })
      .then(v => { setState({ ok: true, message: "You're checked in!", event: v.event, xp: v.awarded_xp }); announceXp(v); },
        e => setState({ ok: false, message: e instanceof Error ? e.message : "Check-in failed." }));
  }, [user, id]);
  if (!ready) return <main className="account-loading">Checking you in…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Sign in to check in</h1><p>Then scan the code again.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  return <main className="account-page social-page"><section className={`account-card event-checkin ${state?.ok ? "is-ok" : ""}`}>
    {!state ? <p role="status">Checking you in…</p> : state.ok ? <>
      <span className="event-checkin-badge" aria-hidden="true">✓</span>
      <h1>{state.message}</h1><p>{state.event?.title}</p>
      {state.xp ? <p className="social-milestone">+{state.xp} XP · verified event</p> : <p>You were already checked in.</p>}
      <div className="account-actions"><Link className="account-primary" href={`/events/${id}`}>Back to the event</Link><Link href="/feed">Share it on the feed</Link></div>
    </> : <><h1>Couldn&apos;t check you in</h1><p role="alert">{state.message}</p><div className="account-actions"><Link className="account-primary" href={`/events/${id}`}>Open the event</Link></div></>}
  </section></main>;
}
