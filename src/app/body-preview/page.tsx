// AI body preview: adults only, off by default, and nothing is stored. The result stays in this browser tab.
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/account-session";
import Link from "@/lib/navigation";
import { preparePhoto } from "@/lib/photo-prep";

export const metadata = { title: "TrackCal — Body preview" };
type Goal = "leaner" | "stronger" | "toned";
const GOALS: [Goal, string, string][] = [["toned", "More toned", "Mixed, regular exercise"], ["stronger", "Stronger", "Regular strength training"], ["leaner", "Leaner", "Activity and balanced eating"]];
const CONSENTS = [["confirm_adult", "I’m 18 or older."], ["confirm_own_photo", "This is a photo of me, and I’m clothed in it."], ["confirm_ai_transfer", "Send this photo to an outside AI provider to make the preview. TrackCal doesn’t store it."]] as const;
type ConsentKey = (typeof CONSENTS)[number][0];

const card = (title: string, text: string, link?: [string, string]) => <main className="account-page"><section className="account-card"><h1>{title}</h1><p>{text}</p>{link && <Link className="account-primary" href={link[0]}>{link[1]}</Link>}</section></main>;

export default function Page() {
  const { user, ready } = useAccount();
  const [state, setState] = useState<"loading" | "off" | "adult-only" | "failed" | "ready">("loading"), [attempt, setAttempt] = useState(0);
  const [goal, setGoal] = useState<Goal>("toned"), [before, setBefore] = useState(""), [after, setAfter] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [split, setSplit] = useState(50);
  const [consent, setConsent] = useState<Record<ConsentKey, boolean>>({ confirm_adult: false, confirm_own_photo: false, confirm_ai_transfer: false });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!user) return;
    fetch("/api/body-preview").then(r => setState(r.ok ? "ready" : r.status === 404 ? "off" : r.status === 403 ? "adult-only" : "failed"), () => setState("failed"));
  }, [user, attempt]);
  if (!ready || (user && state === "loading")) return <main className="account-loading">Opening body preview…</main>;
  if (!user) return card("Body preview", "Sign in to use this.", ["/login", "Sign in"]);
  if (state === "off") return card("Body preview isn’t available yet", "It’s coming soon.");
  if (state === "adult-only") return card("Body preview is for adults", "Your account’s age group needs to be 18 or older. You can add it in your personal plan.", ["/onboarding", "Update my details"]);
  if (state === "failed") return <main className="account-page"><section className="account-card" role="alert"><h1>We couldn’t load body preview</h1><p>This is usually temporary. Nothing was changed.</p><button className="account-primary" onClick={() => { setState("loading"); setAttempt(a => a + 1); }}>Try again</button></section></main>;
  const agreed = Object.values(consent).every(Boolean);
  const choose = async (file?: File) => { if (!file) return; setError(""); setAfter(""); try { setBefore(await preparePhoto(file)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t read this photo."); } };
  const create = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/body-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: before, goal, ...consent }), signal: AbortSignal.timeout(90000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The preview service is busy. Nothing was saved.");
      setAfter(data.image); setNotice(data.notice); setSplit(50);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong. Nothing was saved."); } finally { setBusy(false); }
  };
  return <main className="account-page body-preview">
    <div className="account-title"><p className="eyebrow">A PICTURE OF THE PATH</p><h1>Picture your progress.</h1><p>A moderate AI illustration for motivation. Everyone’s body changes differently, and you’re welcome exactly as you are today.</p></div>
    {!after && <section className="account-card">
      <h2>1. Choose a goal</h2>
      <div className="body-goals" role="radiogroup" aria-label="Goal">{GOALS.map(([id, title, text]) => <button key={id} role="radio" aria-checked={goal === id} className={goal === id ? "selected" : ""} onClick={() => setGoal(id)}><strong>{title}</strong><span>{text}</span></button>)}</div>
      <h2>2. Add a photo</h2>
      <p>Use a clear, clothed, full-body photo of just you.</p>
      <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Your photo" onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
      <button className="account-secondary" onClick={() => input.current?.click()}>{before ? "Choose a different photo" : "Choose a photo"}</button>
      {before && <img className="body-preview-thumb" src={before} alt="Your chosen photo" />}
      <h2>3. Confirm</h2>
      {CONSENTS.map(([key, text]) => <label className="body-consent" key={key}><input type="checkbox" checked={consent[key]} onChange={event => setConsent(current => ({ ...current, [key]: event.target.checked }))} /> {text}</label>)}
      {error && <p role="alert" className="account-error">{error}</p>}
      <button className="account-primary" disabled={!before || !agreed || busy} onClick={() => void create()}>{busy ? "Making your preview…" : "Create my preview"}</button>
    </section>}
    {after && <section className="account-card">
      <h2>Your preview</h2>
      <div className="body-compare"><img src={before} alt="Your original photo" /><div className="body-compare-after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}><img src={after} alt="AI illustration of your goal" /></div><span className="body-compare-label">AI illustration</span></div>
      <label className="body-compare-slider">Compare before and after<input type="range" min={0} max={100} value={split} onChange={event => setSplit(Number(event.target.value))} /></label>
      <p>{notice} It isn’t stored: it disappears when you leave this page.</p>
      <div className="account-actions"><button className="account-primary" onClick={() => { setAfter(""); setBefore(""); }}>Start again and delete</button><Link className="account-secondary" href="/workouts">Plan a workout</Link></div>
    </section>}
  </main>;
}
