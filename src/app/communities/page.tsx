// Communities directory: discover (search, category), your communities, and starting a new one.
import { useCallback, useEffect, useState } from "react";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { social } from "@/lib/social";
import { CATEGORY_LABELS, communities, CommunityError, type Community } from "@/lib/communities";

export const metadata = { title: "TrackCal — Communities" };

export default function Page() {
  const { ready, user } = useAccount(); const router = useRouter();
  const [rows, setRows] = useState<Community[] | null>(null), [tab, setTab] = useState<"discover" | "mine">("discover"), [q, setQ] = useState(""), [category, setCategory] = useState("");
  const [state, setState] = useState<"loading" | "off" | "no-profile" | "ready">("loading"), [error, setError] = useState(""), [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ ...(q.trim() ? { q: q.trim() } : {}), ...(category ? { category } : {}), ...(tab === "mine" ? { mine: "true" } : {}) });
      setRows((await communities<{ communities: Community[] }>(params.size ? "?" + params : "")).communities);
      setError("");
    } catch (e) { if (e instanceof CommunityError && e.status === 404) setState("off"); else setError(e instanceof Error ? e.message : "Unavailable."); }
  }, [q, category, tab]);
  useEffect(() => {
    if (!user) return;
    social<{ profile: unknown }>("me").then(v => setState(v.profile ? "ready" : "no-profile"), () => setState("off"));
  }, [user]);
  useEffect(() => { if (state === "ready") void load(); }, [state, load]);
  if (!ready || state === "loading") return <main className="account-loading">Opening communities…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Communities</h1><p>Sign in to find your people.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  if (state === "off") return <main className="account-page"><section className="account-card"><h1>Communities aren&apos;t available yet</h1><p>They&apos;re coming soon.</p></section></main>;
  if (state === "no-profile") return <main className="account-page"><section className="account-card"><h1>Pick a handle first</h1><p>Communities use your feed profile, so people know who&apos;s posting.</p><Link className="account-primary" href="/feed">Set up my profile</Link></section></main>;
  return <main className="account-page social-page">
    <div className="account-title"><span className="eyebrow">COMMUNITIES</span><h1>Find your people.</h1><p>Groups for running, yoga, cooking, college and more. Every community follows TrackCal&apos;s kindness rules.</p></div>
    {creating ? <CreateCommunity onCreated={slug => router.push(`/c/${slug}`)} onCancel={() => setCreating(false)} /> : <button className="account-primary" onClick={() => setCreating(true)}>Start a community</button>}
    <div className="social-tabs" role="tablist" aria-label="Communities">{(["discover", "mine"] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "discover" ? "Discover" : "Your communities"}</button>)}</div>
    <form className="community-search" role="search" onSubmit={e => { e.preventDefault(); void load(); }}>
      <label>Search<input value={q} maxLength={60} onChange={e => setQ(e.target.value)} placeholder="Name or topic" /></label>
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="account-secondary">Search</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <div className="community-grid">{rows?.map(c => <Link key={c.slug} href={`/c/${c.slug}`} className="account-card community-card">
      <span className="eyebrow">{CATEGORY_LABELS[c.category] || c.category}{c.visibility === "private" ? " · private" : ""}</span>
      <h2>{c.name}</h2><p>{c.description || "No description yet."}</p>
      <small>{c.members} {c.members === 1 ? "member" : "members"}{c.membership ? ` · ${c.membership.status === "pending" ? "requested" : c.membership.role}` : ""}</small>
    </Link>)}</div>
    {rows && !rows.length && <section className="account-card"><p>{tab === "mine" ? "You haven't joined any communities yet." : "No communities match. Start one!"}</p></section>}
  </main>;
}

function CreateCommunity({ onCreated, onCancel }: { onCreated: (slug: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", description: "", category: "other", visibility: "public" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const slugFrom = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); communities<{ community: Community }>("", "POST", form).then(r => onCreated(r.community.slug), err => setError(err instanceof Error ? err.message : "Couldn't create.")).finally(() => setBusy(false)); }}>
    <h2>Start a community</h2>
    <label>Name<input required minLength={3} maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug && form.slug !== slugFrom(form.name) ? form.slug : slugFrom(e.target.value) })} /></label>
    <label>Address<input required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="community-address-hint" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></label>
    <small id="community-address-hint">Your community&apos;s link: /c/{form.slug || "your-community"}</small>
    <label>What is it about?<textarea maxLength={500} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Who can join<select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}><option value="public">Anyone (posts visible to all members of TrackCal)</option><option value="private">By approval (posts visible to members only)</option></select></label>
    <p className="push-note">New communities start with TrackCal&apos;s kindness rules. You can add your own later.</p>
    {error && <p role="alert">{error}</p>}
    <div className="account-actions"><button className="account-primary" disabled={busy}>{busy ? "Creating…" : "Create community"}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
