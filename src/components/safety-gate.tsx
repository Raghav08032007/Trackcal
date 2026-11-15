// "This exercise isn't suitable for you": why, safer choices, and, only if the person still wants to, a clear second step where
// they accept the responsibility. Their decision is recorded on their account.
import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { acceptRisk, type Advice } from "@/lib/exercise-safety";

export function SafetyNotice({ advice, accepted }: { advice: Advice; accepted: boolean }) {
  return <div className={`safety-notice safety-${advice.level}`} role="note">
    {advice.level === "avoid" ? <ShieldAlert size={20} aria-hidden /> : <TriangleAlert size={20} aria-hidden />}
    <div><strong>{accepted ? t("You chose to continue against our advice") : advice.level === "avoid" ? t("Not suitable for you right now") : t("Take care with this one")}</strong>
      <ul>{advice.reasons.map(r => <li key={r}>{r}</li>)}</ul>
      {accepted && <p>{t("Stop straight away if anything hurts.")}</p>}</div>
  </div>;
}

export function SafetyGate({ title, template, advice, safer, onSafer, onContinue, onClose }: {
  title: string; template: string; advice: Advice; safer: { id: string; title: string }[]; onSafer: (id: string) => void; onContinue: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState<"why" | "own">("why"), [agree, setAgree] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [onClose]);
  useEffect(() => { box.current?.focus(); }, [step]);
  const go = async () => { setBusy(true); setError(""); try { await acceptRisk(template); onContinue(); } catch (e) { setError(e instanceof Error ? e.message : t("Could not continue.")); } finally { setBusy(false); } };
  return createPortal(<div className="safety-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={box} tabIndex={-1} className="safety-dialog" role="alertdialog" aria-modal="true" aria-labelledby="safety-title" aria-describedby="safety-why">
      {step === "why" ? <>
        <span className={`safety-icon safety-${advice.level}`} aria-hidden>{advice.level === "avoid" ? <ShieldAlert size={28} /> : <TriangleAlert size={28} />}</span>
        <h2 id="safety-title">{advice.level === "avoid" ? t("{title}: not suitable for you right now", { title }) : t("{title}: take care", { title })}</h2>
        <ul id="safety-why">{advice.reasons.map(r => <li key={r}>{r}</li>)}</ul>
        {safer.length > 0 && <><p className="safety-sub">{t("Safer for you today:")}</p>
          <div className="safety-choices">{safer.map(k => <button key={k.id} type="button" className="ds-btn ds-btn-primary" onClick={() => onSafer(k.id)}>{k.title}</button>)}</div></>}
        <div className="safety-actions">
          {safer.length === 0 && <button type="button" className="ds-btn ds-btn-primary" onClick={onClose}>{t("Choose something else")}</button>}
          <button type="button" className="ds-btn ds-btn-quiet" onClick={() => setStep("own")}>{t("I still want to do {n}", { n: title.toLowerCase() })}</button>
        </div>
      </> : <>
        <span className="safety-icon safety-avoid" aria-hidden><ShieldAlert size={28} /></span>
        <h2 id="safety-title">{t("This is your decision")}</h2>
        <div id="safety-why">
          <p>{t("We advise against {n} for you right now, for the reasons shown. If you continue, you do so at your own risk, and you are responsible for any consequences.", { n: title.toLowerCase() })}</p>
          <p>{t("Go gently, and stop straight away if anything hurts. If you are unsure, ask a doctor or physiotherapist first.")}</p>
        </div>
        <label className="safety-agree"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> {t("I understand and accept the responsibility.")}</label>
        {error && <p role="alert" className="account-error">{error}</p>}
        <div className="safety-actions">
          <button type="button" className="ds-btn ds-btn-quiet" onClick={() => setStep("why")}>{t("Back")}</button>
          <button type="button" className="ds-btn ds-btn-danger" disabled={!agree || busy} onClick={() => void go()}>{t("Continue anyway")}</button>
        </div>
      </>}
    </div>
  </div>, document.body);
}
