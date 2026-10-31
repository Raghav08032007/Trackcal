// Report an event or a challenge. It uses the same report queue as posts and profiles.
import { useState } from "react";
import { REPORT_REASONS, social } from "@/lib/social";

export function ReportItem({ type, id, label }: { type: "event" | "challenge"; id: string; label: string }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState<string>(REPORT_REASONS[0][0]), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  if (message) return <p role="status">{message}</p>;
  if (!open) return <button className="report-item-open" onClick={() => setOpen(true)}>Report this {label}</button>;
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { setMessage((await social<{ status: string }>("reports", "POST", { target_type: type, target_id: id, reason })).status); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "That didn’t send. Please try again."); } finally { setBusy(false); }
  };
  return <form className="social-report" onSubmit={send}>
    <label>Why are you reporting this?<select value={reason} onChange={e => setReason(e.target.value)}>{REPORT_REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    <button className="account-primary" disabled={busy}>Send report</button><button type="button" onClick={() => setOpen(false)}>Cancel</button>
  </form>;
}
