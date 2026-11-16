// Events: what's coming up, what you're going to or organizing, and creating a new one.
import { t, msg } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { social } from "@/lib/social";
import { CATEGORY_LABELS } from "@/lib/communities";
import { EventError, events, when, type EventView } from "@/lib/events";

export const metadata = { title:msg("TrackCal — Events") };

export default function Page() {
  const { ready, user } = useAccount(); const router = useRouter();
  const [rows, setRows] = useState<EventView[] | null>(null), [scope, setScope] = useState<"upcoming" | "mine">("upcoming"), [state, setState] = useState<"loading" | "off" | "failed" | "no-profile" | "ready">("loading"), [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [creating, setCreating] = useState(false);
  const load = useCallback(() => events<{ events: EventView[] }>(`?scope=${scope}`).then(v => { setRows(v.events); setError(""); }, e => { if (e instanceof EventError && e.status === 404) setState("off"); else setError(e instanceof Error ? e.message : t("Unavailable.")); }), [scope]);
  useEffect(() => { if (user) social<{ profile: unknown }>("me").then(v => setState(v.profile ? "ready" : "no-profile"), (e: { status?: number }) => setState(e?.status === 404 ? "off" : "failed")); }, [user, attempt]);
  useEffect(() => { if (state === "ready") void load(); }, [state, load]);
  if (!ready || state === "loading") return <main className="account-loading">{t("Opening events…")}</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>{t("Events")}</h1><p>{t("Sign in to find runs, walks and classes near you.")}</p><Link className="account-primary" href="/login">{t("Sign in")}</Link></section></main>;
  if (state === "failed") return <main className="account-page"><section className="account-card" role="alert"><h1>{t("We couldn't load events")}</h1><p>{t("This is usually temporary. Nothing was changed.")}</p><button className="account-primary" onClick={() => { setState("loading"); setAttempt(a => a + 1); }}>{t("Try again")}</button></section></main>;
  if (state === "off") return <main className="account-page"><section className="account-card"><h1>{t("Events aren't available yet")}</h1><p>{t("They're coming soon.")}</p></section></main>;
  if (state === "no-profile") return <main className="account-page"><section className="account-card"><h1>{t("Pick a handle first")}</h1><p>{t("Events use your feed profile so organizers know who's coming.")}</p><Link className="account-primary" href="/feed">{t("Set up my profile")}</Link></section></main>;
  return <main className="account-page social-page">
    <div className="account-title"><span className="eyebrow">{t("EVENTS")}</span><h1>{t("Show up together.")}</h1><p>{t("Runs, walks, classes and cook-alongs. Check in with the organizer's QR code to earn a verified-event badge.")}</p></div>
    {creating ? <CreateEvent onCreated={id => router.push(`/events/${id}`)} onCancel={() => setCreating(false)} /> : <button className="account-primary" onClick={() => setCreating(true)}>{t("Organize an event")}</button>}
    <div className="social-tabs" role="tablist" aria-label={t("Events")}>{(["upcoming", "mine"] as const).map(tab => <button key={tab} role="tab" aria-selected={scope === tab} onClick={() => setScope(tab)}>{tab === "upcoming" ? t("Upcoming") : t("Your events")}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    <div className="community-grid">{rows?.map(e => <EventCard key={e.id} event={e} />)}</div>
    {rows && !rows.length && <section className="account-card"><p>{scope === "mine" ? t("You haven't signed up for anything yet.") : t("No upcoming events. Organize the first one!")}</p></section>}
  </main>;
}

export function EventCard({ event: e }: { event: EventView }) {
  const date = new Date(e.starts_at);
  return <Link href={`/events/${e.id}`} className="account-card community-card event-card">
    <span className="event-date" aria-hidden="true"><b>{date.toLocaleDateString(undefined, { day: "numeric", timeZone: e.timezone })}</b>{date.toLocaleDateString(undefined, { month: "short", timeZone: e.timezone })}</span>
    <span className="eyebrow">{CATEGORY_LABELS[e.category] || e.category}{e.community ? ` · ${e.community.name}` : ""}{e.status === "cancelled" ? t(" · cancelled") : ""}</span>
    <h2>{e.title}</h2><p>{when(e)} · {e.location}</p>
    <small>{e.capacity ? t("{going} going of {capacity}", { going: e.going, capacity: e.capacity }) : t("{going} going", { going: e.going })}{e.waitlist ? t(" · {waitlist} waiting", { waitlist: e.waitlist }) : ""}{e.organizing ? t(" · you're organizing") : e.mine?.status === "going" ? (e.mine.checked_in ? t(" · checked in ✓") : t(" · you're going")) : e.mine?.status === "waitlist" ? t(" · on the waitlist") : ""}</small>
  </Link>;
}

function CreateEvent({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [form, setForm] = useState({ title: "", description: "", category: "running", location: "", starts_at: "", minutes: 60, capacity: "" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError("");
    events<{ event: EventView }>("", "POST", { title: form.title, description: form.description, category: form.category, location: form.location, starts_at: form.starts_at, minutes: Number(form.minutes), timezone: zone, capacity: form.capacity ? Number(form.capacity) : null })
      .then(r => onCreated(r.event.id), err => setError(err instanceof Error ? err.message : t("Couldn't create."))).finally(() => setBusy(false)); }}>
    <h2>{t("Organize an event")}</h2>
    <label>{t("Title")}<input required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t("Sunday sunrise walk")} /></label>
    <label>{t("Where")}<input required minLength={3} maxLength={200} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={t("A public place people can find")} /></label>
    <label>{t("Starts ({zone})", { zone })}<input type="datetime-local" required value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
    <label>{t("How long (minutes)")}<input type="number" min={15} max={720} step={15} value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })} /></label>
    <label>{t("Category")}<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label>{t("Places (leave empty for no limit)")}<input type="number" min={2} max={500} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></label>
    <label>{t("Details")}<textarea maxLength={1000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t("What to bring, pace, who it's for")} /></label>
    <p className="push-note">{t("Meet in public places. Don't share home addresses or phone numbers in event details.")}</p>
    {error && <p role="alert">{error}</p>}
    <div className="account-actions"><button className="account-primary" disabled={busy}>{busy ? t("Creating…") : t("Create event")}</button><button type="button" onClick={onCancel}>{t("Cancel")}</button></div>
  </form>;
}
