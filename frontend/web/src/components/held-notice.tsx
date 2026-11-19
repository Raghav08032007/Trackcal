// Shows the server's message when something just published was held for review. Stays until the person closes it, so a
// helpline is never hidden by a timer.
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { NOTICE_EVENT, type Notice } from "@/lib/notice";

export function HeldNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const show = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
    window.addEventListener(NOTICE_EVENT, show);
    return () => window.removeEventListener(NOTICE_EVENT, show);
  }, []);
  if (!notice) return null;
  return <div className={`held-notice${notice.kind === "self_harm" ? " held-notice-care" : ""}`} role={notice.kind === "self_harm" ? "alertdialog" : "status"} aria-live="polite">
    <p>{notice.text}</p>
    <button type="button" className="account-secondary" onClick={() => setNotice(null)}>{t("Close")}</button>
  </div>;
}
