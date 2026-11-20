// "Share progress with a coach": enter a coach's code, choose what they see, change it or stop at any time.
// Hidden while the trainer dashboard is switched off. Coaches also get a link to their client dashboard here.
import { t, date } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/navigation";
import { coachClients, CoachClientError, SHARE_LABELS, type MyCoach, type Share } from "@/lib/coach-clients";

const NONE: Share = { diary: false, workouts: false, weight: false };

function Choices({ value, onChange, disabled, name }: { value: Share; onChange: (next: Share) => void; disabled?: boolean; name: string }) {
  return <fieldset className="share-choices" disabled={disabled}><legend>{t("What your coach can see")}</legend>
    {(Object.keys(SHARE_LABELS) as (keyof Share)[]).map(key => <label key={key} className="consent-row">
      <input type="checkbox" name={`${name}-${key}`} checked={value[key]} onChange={e => onChange({ ...value, [key]: e.target.checked })} /> {t(SHARE_LABELS[key])}</label>)}
  </fieldset>;
}

export function CoachSharing() {
  const [state, setState] = useState<"loading" | "off" | "ready">("loading"), [coaches, setCoaches] = useState<MyCoach[]>([]), [isCoach, setIsCoach] = useState(false);
  const [code, setCode] = useState(""), [share, setShare] = useState<Share>(NONE), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setCoaches((await coachClients<{ coaches: MyCoach[] }>("mine")).coaches); setState("ready");
      coachClients("").then(() => setIsCoach(true), () => setIsCoach(false));
    } catch (e) { setState(e instanceof CoachClientError && e.status === 404 ? "off" : "ready"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (state !== "ready") return null;
  async function run(task: () => Promise<unknown>, done: string) {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try { await task(); setNotice(done); await load(); } catch (e) { setError(e instanceof Error ? e.message : t("Request failed.")); } finally { setBusy(false); }
  }
  const any = (s: Share) => s.diary || s.workouts || s.weight;
  return <section className="account-card" aria-labelledby="coach-sharing">
    <h2 id="coach-sharing">{t("Share progress with a coach")}</h2>
    <p>{t("Your coach gives you a code. You choose what they can see, as daily summaries only, and you can change it or stop at any time.")}</p>
    {isCoach && <p><Link href="/coach/clients">{t("Open your client dashboard →")}</Link></p>}
    {coaches.map(c => <div className="studio-list-row" key={c.id}>
      <p><strong>{c.coach}</strong>{c.since ? ` · ${t("since {date}", { date: date(new Date(c.since), { dateStyle: "medium" }) })}` : ""}</p>
      <Choices name={c.id} value={c.share} disabled={busy} onChange={next => any(next) ? void run(() => coachClients(`${c.id}/share`, "PUT", next), t("Saved. Your coach now sees only what is ticked.")) : setError(t("Choose at least one thing to share, or stop sharing."))} />
      <div className="account-actions"><button disabled={busy} onClick={() => void run(() => coachClients(c.id, "DELETE"), t("You stopped sharing. Your coach can no longer see your progress."))}>{t("Stop sharing")}</button></div>
    </div>)}
    <form className="account-form" onSubmit={e => { e.preventDefault(); void run(async () => { await coachClients("join", "POST", { code: code.trim(), share }); setCode(""); setShare(NONE); }, t("You are now sharing with your coach.")); }}>
      <label>{t("Code from your coach")}<input value={code} onChange={e => setCode(e.target.value)} maxLength={12} autoComplete="off" placeholder="ABCD-2345" /></label>
      <Choices name="new" value={share} onChange={setShare} disabled={busy} />
      <div className="account-actions"><button className="account-primary" disabled={busy || code.trim().length < 8 || !any(share)}>{t("Start sharing")}</button></div>
    </form>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
