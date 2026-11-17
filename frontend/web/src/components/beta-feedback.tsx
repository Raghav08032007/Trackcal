// "Send feedback" for signed-in people: the message they type and the page path, stored as a support ticket.
import { t } from "@/lib/i18n";
import { useRef, useState } from "react";
import { useAccount } from "./account-session";
import { usePathname } from "@/lib/navigation";

export function BetaFeedback() {
  const { user } = useAccount(); const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null), [message, setMessage] = useState(""), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  if (!user) return null;
  async function send() {
    if (busy || !message.trim()) return; setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, page: path }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Feedback could not be sent. Your text is still here; please retry."));
      setMessage(""); setStatus(t("Thanks! Your feedback was sent."));
    } catch (e) { setStatus(e instanceof Error ? e.message : t("Feedback could not be sent.")); } finally { setBusy(false); }
  }
  return <>
    <button type="button" className="feedback-button" onClick={() => { setStatus(""); dialog.current?.showModal(); }}>{t("Send feedback")}</button>
    <dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title">
      <form method="dialog" onSubmit={e => { e.preventDefault(); void send(); }}>
        <h2 id="feedback-title">{t("Tell us what you think")}</h2>
        <p>{t("Bugs, confusing bits, ideas: anything helps. We'll see this message and the page you're on ({path}). Please don't include health details.", { path })}</p>
        <label>{t("Your feedback")}<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} rows={5} required /></label>
        <p role="status">{status}</p>
        <div className="account-actions"><button className="account-primary" disabled={busy || !message.trim()}>{busy ? t("Sending…") : t("Send")}</button><button type="button" onClick={() => dialog.current?.close()}>{t("Close")}</button></div>
      </form>
    </dialog>
  </>;
}
