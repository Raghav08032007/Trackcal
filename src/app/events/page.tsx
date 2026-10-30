// Events: what's coming up, what you're going to or organizing, and creating a new one.
import { useCallback, useEffect, useState } from "react";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { social } from "@/lib/social";
import { CATEGORY_LABELS } from "@/lib/communities";
import { EventError, events, when, type EventView } from "@/lib/events";

export const metadata = { title: "TrackCal — Events" };

export default function Page() {
  const { ready, user } = useAccount(); const router = useRouter();
  const [rows, setRows] = useState<EventView[] | null>(null), [scope, setScope] = useState<"upcoming" | "mine">("upcoming"), [state, setState] = useState<"loading" | "off" | "failed" | "no-profile" | "ready">("loading"), [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [creating, setCreating] = useState(false);
  const load = useCallback(() => events<{ events: EventView[] }>(`?scope=${scope}`).then(v => { setRows(v.events); setError(""); }, e => { if (e instanceof EventError && e.status === 404) setState("off"); else setError(e instanceof Error ? e.message : "Unavailable."); }), [scope]);
  useEffect(() => { if (user) social<{ profile: unknown }>("me").then(v => setState(v.profile ? "ready" : "no-profile"), (e: { status?: number }) => setState(e?.status === 404 ? "off" : "failed")); }, [user, attempt]);
  useEffect(() => { if (state === "ready") void load(); }, [state, load]);
  if (!ready || state === "loading") return <main className="account-loading">Opening events…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Events</h1><p>Sign in to find runs, walks and classes near you.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  if (state === "failed") return <main className="account-page"><section className="account-card" role="alert"><h1>We couldn&apos;t load events</h1><p>This is usually temporary. Nothing was changed.</p><button className="account-primary" onClick={() => { setState("loading"); setAttempt(a => a + 1); }}>Try again</button></section></main>;
  if (state === "off") return <main className="account-page"><section className="account-card"><h1>Events aren&apos;t available yet</h1><p>They&apos;re coming soon.</p></section></main>;
  if (state === "no-profile") return <main className="account-page"><section className="account-card"><h1>Pick a handle first</h1><p>Events use your feed profile so organizers know who&apos;s coming.</p><Link className="account-primary" href="/feed">Set up my profile</Link></section></main>;
  return <main className="account-page social-page">
    <div className="account-title"><span className="eyebrow">EVENTS</span><h1>Show up together.</h1><p>Runs, walks, classes and cook-alongs. Check in with the organizer&apos;s QR code to earn a verified-event badge.</p></div>
    {creating ? <CreateEvent onCreated={id => router.push(`/events/${id}`)} onCancel={() => setCreating(false)} /> : <button className="account-primary" onClick={() => setCreating(true)}>Organize an event</button>}
    <div className="social-tabs" role="tablist" aria-label="Events">{(["upcoming", "mine"] as const).map(t => <button key={t} role="tab" aria-selected={scope === t} onClick={() => setScope(t)}>{t === "upcoming" ? "Upcoming" : "Your events"}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    <div className="community-grid">{rows?.map(e => <EventCard key={e.id} event={e} />)}</div>
    {rows && !rows.length && <section className="account-card"><p>{scope === "mine" ? "You haven't signed up for anything yet." : "No upcoming events. Organize the first one!"}</p></section>}
  </main>;
}

export function EventCard({ event: e }: { event: EventView }) {
  const date = new Date(e.starts_at);
  return <Link href={`/events/${e.id}`} className="account-card community-card event-card">
    <span className="event-date" aria-hidden="true"><b>{date.toLocaleDateString(undefined, { day: "numeric", timeZone: e.timezone })}</b>{date.toLocaleDateString(undefined, { month: "short", timeZone: e.timezone })}</span>
    <span className="eyebrow">{CATEGORY_LABELS[e.category] || e.category}{e.community ? ` · ${e.community.name}` : ""}{e.status === "cancelled" ? " · cancelled" : ""}</span>
    <h2>{e.title}</h2><p>{when(e)} · {e.location}</p>
    <small>{e.going} going{e.capacity ? ` of ${e.capacity}` : ""}{e.waitlist ? ` · ${e.waitlist} waiting` : ""}{e.organizing ? " · you're organizing" : e.mine?.status === "going" ? (e.mine.checked_in ? " · checked in ✓" : " · you're going") : e.mine?.status === "waitlist" ? " · on the waitlist" : ""}</small>
  </Link>;
}

function CreateEvent({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [form, setForm] = useState({ title: "", description: "", category: "running", location: "", starts_at: "", minutes: 60, capacity: "" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError("");
    events<{ event: EventView }>("", "POST", { title: form.title, description: form.description, category: form.category, location: form.location, starts_at: form.starts_at, minutes: Number(form.minutes), timezone: zone, capacity: form.capacity ? Number(form.capacity) : null })
      .then(r => onCreated(r.event.id), err => setError(err instanceof Error ? err.message : "Couldn't create.")).finally(() => setBusy(false)); }}>
    <h2>Organize an event</h2>
    <label>Title<input required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sunday sunrise walk" /></label>
    <label>Where<input required minLength={3} maxLength={200} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="A public place people can find" /></label>
    <label>Starts ({zone})<input type="datetime-local" required value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
    <label>How long (minutes)<input type="number" min={15} max={720} step={15} value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })} /></label>
    <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label>Places (leave empty for no limit)<input type="number" min={2} max={500} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></label>
    <label>Details<textarea maxLength={1000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What to bring, pace, who it's for" /></label>
    <p className="push-note">Meet in public places. Don&apos;t share home addresses or phone numbers in event details.</p>
    {error && <p role="alert">{error}</p>}
    <div className="account-actions"><button className="account-primary" disabled={busy}>{busy ? "Creating…" : "Create event"}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
