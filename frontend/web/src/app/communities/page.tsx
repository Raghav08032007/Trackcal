// Communities directory: discover (search, category), your communities, and starting a new one.
import { t, msg, date } from "@/lib/i18n";
import { CommunityStrip } from "@/components/community-strip";
import { useCallback, useEffect, useState } from "react";
import Link, { useRouter } from "@/lib/navigation";
import { useAccount } from "@/components/account-session";
import { social } from "@/lib/social";
import { CATEGORY_LABELS, communities, CommunityError, type Ban, type Community } from "@/lib/communities";

export const metadata = { title:msg("TrackCal — Communities") };

export default function Page() {
  const { ready, user } = useAccount(); const router = useRouter();
  const [rows, setRows] = useState<Community[] | null>(null), [tab, setTab] = useState<"discover" | "mine">("discover"), [q, setQ] = useState(""), [category, setCategory] = useState("");
  const [state, setState] = useState<"loading" | "off" | "failed" | "no-profile" | "ready">("loading"), [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ ...(q.trim() ? { q: q.trim() } : {}), ...(category ? { category } : {}), ...(tab === "mine" ? { mine: "true" } : {}) });
      setRows((await communities<{ communities: Community[] }>(params.size ? "?" + params : "")).communities);
      setError("");
    } catch (e) { if (e instanceof CommunityError && e.status === 404) setState("off"); else setError(e instanceof Error ? e.message : t("Unavailable.")); }
  }, [q, category, tab]);
  useEffect(() => {
    if (!user) return;
    social<{ profile: unknown }>("me").then(v => setState(v.profile ? "ready" : "no-profile"), (e: { status?: number }) => setState(e?.status === 404 ? "off" : "failed"));
  }, [user, attempt]);
  useEffect(() => { if (state === "ready") void load(); }, [state, load]);
  if (!ready || (user && state === "loading")) return <main className="account-loading">{t("Opening communities…")}</main>;
  if (!user) return <main className="account-page"><CommunityStrip current="clubs" /><section className="account-card"><h1>{t("Communities")}</h1><p>{t("Sign in to find your people.")}</p><Link className="account-primary" href="/login">{t("Sign in")}</Link></section></main>;
  if (state === "failed") return <main className="account-page"><CommunityStrip current="clubs" /><section className="account-card" role="alert"><h1>{t("We couldn't load communities")}</h1><p>{t("This is usually temporary. Nothing was changed.")}</p><button className="account-primary" onClick={() => { setState("loading"); setAttempt(a => a + 1); }}>{t("Try again")}</button></section></main>;
  if (state === "off") return <main className="account-page"><CommunityStrip current="clubs" /><section className="account-card"><h1>{t("Communities aren't available yet")}</h1><p>{t("They're coming soon.")}</p></section></main>;
  if (state === "no-profile") return <main className="account-page"><CommunityStrip current="clubs" /><section className="account-card"><h1>{t("Pick a handle first")}</h1><p>{t("Communities use your feed profile, so people know who's posting.")}</p><Link className="account-primary" href="/feed">{t("Set up my profile")}</Link></section></main>;
  return <main className="account-page social-page"><CommunityStrip current="clubs" />
    <div className="account-title"><span className="eyebrow">{t("COMMUNITY")}</span><h1>{t("Find your people.")}</h1><p>{t("Groups for running, yoga, cooking, college and more. Every community follows TrackCal's kindness rules.")}</p></div>
    {creating ? <CreateCommunity onCreated={slug => router.push(`/c/${slug}`)} onCancel={() => setCreating(false)} /> : <button className="account-primary" onClick={() => setCreating(true)}>{t("Start a community")}</button>}
    <div className="social-tabs" role="tablist" aria-label={t("Communities")}>{(["discover", "mine"] as const).map(option => <button key={option} role="tab" aria-selected={tab === option} onClick={() => setTab(option)}>{option === "discover" ? t("Discover") : t("Your communities")}</button>)}</div>
    <form className="community-search" role="search" onSubmit={e => { e.preventDefault(); void load(); }}>
      <label>{t("Search")}<input value={q} maxLength={60} onChange={e => setQ(e.target.value)} placeholder={t("Name or topic")} /></label>
      <label>{t("Category")}<select value={category} onChange={e => setCategory(e.target.value)}><option value="">{t("All")}</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="account-secondary">{t("Search")}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <Bans />
    <div className="community-grid">{rows?.map(c => <Link key={c.slug} href={`/c/${c.slug}`} className="account-card community-card">
      <span className="eyebrow">{CATEGORY_LABELS[c.category] || c.category}{c.visibility === "private" ? t(" · private") : ""}</span>
      <h2>{c.name}</h2><p>{c.description || t("No description yet.")}</p>
      <small>{c.members} {c.members === 1 ? "member" : "members"}{c.membership ? ` · ${c.membership.status === "pending" ? "requested" : c.membership.role}` : ""}</small>
    </Link>)}</div>
    {rows && !rows.length && <section className="account-card"><p>{tab === "mine" ? t("You haven't joined any communities yet.") : t("No communities match. Start one!")}</p></section>}
  </main>;
}

function CreateCommunity({ onCreated, onCancel }: { onCreated: (slug: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", description: "", category: "other", visibility: "public" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const slugFrom = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return <form className="account-card account-form" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); communities<{ community: Community }>("", "POST", form).then(r => onCreated(r.community.slug), err => setError(err instanceof Error ? err.message : t("Couldn't create."))).finally(() => setBusy(false)); }}>
    <h2>{t("Start a community")}</h2>
    <label>{t("Name")}<input required minLength={3} maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug && form.slug !== slugFrom(form.name) ? form.slug : slugFrom(e.target.value) })} /></label>
    <label>{t("Address")}<input required minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="community-address-hint" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></label>
    <small id="community-address-hint">{t("Your community's link: /c/")}{form.slug || "your-community"}</small>
    <label>{t("What is it about?")}<textarea maxLength={500} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
    <label>{t("Category")}<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>{t("Who can join")}<select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}><option value="public">{t("Anyone (posts visible to all members of TrackCal)")}</option><option value="private">{t("By approval (posts visible to members only)")}</option></select></label>
    <p className="push-note">{t("New communities start with TrackCal's kindness rules. You can add your own later.")}</p>
    {error && <p role="alert">{error}</p>}
    <div className="account-actions"><button className="account-primary" disabled={busy}>{busy ? t("Creating…") : t("Create community")}</button><button type="button" onClick={onCancel}>{t("Cancel")}</button></div>
  </form>;
}


// Communities that removed you, with an appeal to TrackCal. Shown only when there is at least one; only you see it.
function Bans() {
  const [bans, setBans] = useState<Ban[]>([]), [open, setOpen] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const load = useCallback(() => communities<{ bans?: Ban[] }>("bans").then(v => setBans(Array.isArray(v.bans) ? v.bans : []), () => setBans([])), []);
  useEffect(() => { void load(); }, [load]);
  if (!bans.length) return null;
  async function send(slug: string) {
    if (busy) return; setBusy(true); setMessage("");
    try { const r = await communities<{ status: string }>(`${slug}/appeal`, "POST", { note: note.trim() }); setMessage(r.status); setOpen(""); setNote(""); await load(); }
    catch (e) { setMessage(e instanceof Error ? e.message : t("Couldn't send.")); } finally { setBusy(false); }
  }
  return <section className="account-card community-bans" aria-labelledby="bans-title">
    <h2 id="bans-title">{t("Removed from a community")}</h2>
    <p>{t("A community's moderators removed you from these communities. You can ask TrackCal to look again. The community's own moderators don't decide appeals.")}</p>
    {message && <p role="status">{message}</p>}
    {bans.map(ban => <div className="studio-list-row" key={ban.slug}>
      <p><strong>{ban.name}</strong> · {ban.appeal === "open" ? t("Your appeal is with our team.") : ban.appeal === "upheld" ? t("Our team kept the removal.") : t("Not appealed yet.")}
        {ban.next_appeal_at ? ` ${t("You can appeal again on {date}.", { date: date(new Date(ban.next_appeal_at), { dateStyle: "medium" }) })}` : ""}</p>
      {ban.can_appeal && (open === ban.slug
        ? <form className="account-form" onSubmit={e => { e.preventDefault(); void send(ban.slug); }}>
            <label>{t("Why should we look again?")}<textarea required minLength={10} maxLength={500} rows={3} value={note} onChange={e => setNote(e.target.value)} /></label>
            <div className="account-actions"><button className="account-primary" disabled={busy || note.trim().length < 10}>{busy ? t("Sending…") : t("Send appeal")}</button>
              <button type="button" onClick={() => { setOpen(""); setNote(""); }}>{t("Cancel")}</button></div>
          </form>
        : <div className="account-actions"><button className="account-secondary" onClick={() => { setOpen(ban.slug); setNote(""); setMessage(""); }}>{t("Ask TrackCal to review")}</button></div>)}
    </div>)}
  </section>;
}
