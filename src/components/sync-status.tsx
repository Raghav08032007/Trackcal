// Whether your settings and lists are saved to your account: a dot by "My account", and a line with "Save now".
import { msg, t } from "@/lib/i18n";
import { syncNow, useSyncStatus, type SyncStatus } from "@/lib/sync";

const TEXT: Record<SyncStatus, string> = {
  off: "", saved: msg("All changes saved to your account"), saving: msg("Saving your changes…"),
  offline: msg("You're offline. Changes are kept here and sent when you're back."), error: msg("Some changes could not be saved. Try again."),
};

export function SyncDot() {
  const status = useSyncStatus();
  if (status === "off") return null;
  return <span className="sync-dot" data-status={status} title={t(TEXT[status])}><span className="sr-only">{t(TEXT[status])}</span></span>;
}

export function SyncPanel() {
  const status = useSyncStatus();
  if (status === "off") return null;
  return <div className="sync-panel" data-status={status}>
    <span className="sync-dot" data-status={status} aria-hidden />
    <p role="status">{t(TEXT[status])}</p>
    {(status === "offline" || status === "error") && <button type="button" className="account-secondary" onClick={() => void syncNow()}>{t("Save now")}</button>}
  </div>;
}
