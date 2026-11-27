// A thin bar across the top while the next page downloads, so a tap always shows it was heard.
// It appears only if the wait is longer than a blink (no flicker on fast pages) and finishes with a quick fill.
import { useEffect, useState } from "react";
import { useNavigation } from "react-router";
import { t } from "@/lib/i18n";

/** A fast double tap starts a second navigation while the first page-change animation runs; the browser then
 *  rejects the first animation's promises ("Transition was skipped" / "aborted"). That is expected, not an error. */
function quietSkippedTransitions() {
  if (typeof window === "undefined" || (window as { __navQuiet?: boolean }).__navQuiet) return;
  (window as { __navQuiet?: boolean }).__navQuiet = true;
  window.addEventListener("unhandledrejection", e => {
    const r = e.reason as { name?: string; message?: string } | undefined;
    if ((r?.name === "AbortError" || r?.name === "TimeoutError" || r?.name === "InvalidStateError") && /transition/i.test(r?.message || "")) e.preventDefault();
  });
}
quietSkippedTransitions();

export function NavProgress() {
  const busy = useNavigation().state !== "idle";
  const [shown, setShown] = useState<"off" | "on" | "done">("off");
  useEffect(() => {
    if (busy) { const id = setTimeout(() => setShown("on"), 120); return () => clearTimeout(id); }
    setShown(s => (s === "on" ? "done" : "off"));
  }, [busy]);
  useEffect(() => { if (shown !== "done") return; const id = setTimeout(() => setShown("off"), 320); return () => clearTimeout(id); }, [shown]);
  if (shown === "off") return null;
  return <div className={`nav-progress nav-progress-${shown}`} role="progressbar" aria-label={t("Opening page")} aria-busy={shown === "on"}><span /></div>;
}
