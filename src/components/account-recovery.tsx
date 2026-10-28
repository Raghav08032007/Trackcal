"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
export function AccountRecovery({ mode }: { mode: "forgot-password" | "reset-password" | "verify-email" }) {
  const [token, setToken] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const captured = useRef(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Capture the client-only fragment once, including under Strict Mode effect replay.
    setToken(params.get("token") || "");
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const title = mode === "forgot-password" ? "Let’s get you back in." : mode === "reset-password" ? "A fresh start." : "Confirm your email.";
  return <main className="account-page"><Link href="/" className="brand">trackcal.</Link><section className="account-card"><h1>{title}</h1><p>{mode === "forgot-password" ? "Request a one-time recovery link. The response is the same whether an account exists or not." : "Links expire and can only be used once. Request a new email if this link no longer works."}</p><form className="account-form" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { const body = mode === "forgot-password" ? { email: form.get("email") } : mode === "reset-password" ? { token, new_password: form.get("password") } : { token }; const response = await fetch(`/api/account/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed. Try again."); setMessage(data.status); setToken(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); } finally { setBusy(false); } }}>{mode === "forgot-password" && <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}{mode === "reset-password" && <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>}<button className="account-primary" disabled={busy || (mode !== "forgot-password" && !token)}>{busy ? "Working…" : mode === "forgot-password" ? "Send recovery link" : mode === "reset-password" ? "Reset password" : "Verify email"}</button></form>{message && <p role="status" className="account-success">{message}</p>}{error && <p role="alert" className="account-error">{error}</p>}<p><Link href="/login">Back to sign in</Link> · <Link href="/account">My account</Link></p></section></main>;
}
