// Challenges: open ones to join, yours, and starting a new one. Progress always comes from what you actually log.
import { useCallback, useEffect, useState } from "react";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { social } from "@/lib/social";
import { ChallengeError, challenges, dates, METRIC_OPTIONS, type ChallengeView } from "@/lib/challenges";

export const metadata = { title: "TrackCal — Challenges" };

export default function Page() {
  const { ready, user } = useAccount(); const router = useRouter();
  const [rows, setRows] = useState<ChallengeView[] | null>(null), [scope, setScope] = useState<"open" | "mine">("open"), [state, setState] = useState<"loading" | "off" | "failed" | "no-profile" | "ready">("loading"), [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [creating, setCreating] = useState(false);
  const load = useCallback(() => challenges<{ challenges: ChallengeView[] }>(`?scope=${scope}`).then(v => { setRows(v.challenges); setError(""); }, e => { if (e instanceof ChallengeError && e.status === 404) setState("off"); else setError(e instanceof Error ? e.message : "Unavailable."); }), [scope]);
  useEffect(() => { if (user) social<{ profile: unknown }>("me").then(v => setState(v.profile ? "ready" : "no-profile"), (e: { status?: number }) => setState(e?.status === 404 ? "off" : "failed")); }, [user, attempt]);
  useEffect(() => { if (state === "ready") void load(); }, [state, load]);
  if (!ready || state === "loading") return <main className="account-loading">Opening challenges…</main>;
  if (!user) return <main className="account-page"><section className="account-card"><h1>Challenges</h1><p>Sign in to take on a challenge with friends.</p><Link className="account-primary" href="/login">Sign in</Link></section></main>;
  if (state === "failed") return <main className="account-page"><section className="account-card" role="alert"><h1>We couldn&apos;t load challenges</h1><p>This is usually temporary. Nothing was changed.</p><button className="account-primary" onClick={() => { setState("loading"); setAttempt(a => a + 1); }}>Try again</button></section></main>;
  if (state === "off") return <main className="account-page"><section className="account-card"><h1>Challenges aren&apos;t available yet</h1><p>They&apos;re coming soon.</p></section></main>;
  if (state === "no-profile") return <main className="account-page"><section className="account-card"><h1>Pick a handle first</h1><p>Challenges use your feed profile.</p><Link className="account-primary" href="/feed">Set up my profile</Link></section></main>;
  return <main className="account-page social-page">
    <div className="account-title"><span className="eyebrow">CHALLENGES</span><h1>Small goals, together.</h1><p>Progress counts only what you actually log (workouts, meals, events), so everyone&apos;s wins are real. No leaderboards, no ranking.</p></div>
    {creating ? <CreateChallenge onCreated={id => router.push(`/challenges/${id}`)} onCancel={() => setCreating(false)} /> : <button className="account-primary" onClick={() => setCreating(true)}>Start a challenge</button>}
    <div className="social-tabs" role="tablist" aria-label="Challenges">{(["open", "mine"] as const).map(t => <button key={t} role="tab" aria-selected={scope === t} onClick={() => setScope(t)}>{t === "open" ? "Open" : "Yours"}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    <div className="community-grid">{rows?.map(c => <Link key={c.id} href={`/challenges/${c.id}`} className="account-card community-card challenge-card">
      <span className="eyebrow">{c.phase === "running" ? "Running" : c.phase === "upcoming" ? "Starts soon" : c.phase}{c.community ? ` · ${c.community.name}` : ""}</span>
      <h2>{c.title}</h2><p>{c.target} × {c.metric_label.toLowerCase()} · {dates(c)}</p>
      {c.mine && <span className="challenge-bar" role="img" aria-label={`Your progress: ${c.mine.progress} of ${c.target}`}><span style={{ width: `${Math.round(c.mine.progress / c.target * 100)}%` }} /></span>}
      <small>{c.participants} taking part · {c.finished} finished{c.mine?.completed ? " · you did it ✓" : ""}</small>
    </Link>)}</div>
    {rows && !rows.length && <section className="account-card"><p>{scope === "mine" ? "You haven't joined a challenge yet." : "No open challenges. Start one!"}</p></section>}
  </main>;
}

function CreateChallenge({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const start = new Date(), end = new Date(Date.now() + 6 * 86400000);
  const [form, setForm] = useState({ title: "", description: "", metric: "active_days", target: 5, starts_on: iso(start), ends_on: iso(end) }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const hint = METRIC_OPTIONS.find(([v]) => v === form.metric)?.[2];
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError("");
    challenges<{ challenge: ChallengeView }>("", "POST", { ...form, target: Number(form.target), timezone: zone }).then(r => onCreated(r.challenge.id), err => setError(err instanceof Error ? err.message : "Couldn't start it.")).finally(() => setBusy(false)); }}>
    <h2>Start a challenge</h2>
    <label>Name<input required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Five active days this week" /></label>
    <label>What counts<select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}>{METRIC_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><small>{hint}</small></label>
    <label>Goal<input type="number" min={1} max={120} value={form.target} onChange={e => setForm({ ...form, target: Number(e.target.value) })} /></label>
    <label>Starts<input type="date" required value={form.starts_on} onChange={e => setForm({ ...form, starts_on: e.target.value })} /></label>
    <label>Ends<input type="date" required value={form.ends_on} onChange={e => setForm({ ...form, ends_on: e.target.value })} /></label>
    <label>Details<textarea maxLength={1000} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Why, and how you'll cheer each other on" /></label>
    <p className="push-note">Keep goals kind and achievable. Rest days are part of every plan.</p>
    {error && <p role="alert">{error}</p>}
    <div className="account-actions"><button className="account-primary" disabled={busy}>{busy ? "Starting…" : "Start challenge"}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
