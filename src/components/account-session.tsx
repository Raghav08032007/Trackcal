import { t } from "@/lib/i18n";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link, { usePathname } from "@/lib/navigation";
import { forgetAdventureSummary } from "@/lib/adventure";
import { startSync } from "@/lib/sync";
import { SyncDot } from "@/components/sync-status";
type User = { id: string; email: string; email_verified?: boolean; profile: { display_name?: string } };
type SessionState = { user: User | null; ready: boolean; unavailable?: boolean };
const Session = createContext<SessionState & { reload: () => Promise<void> }>({ user: null, ready: true, reload: async () => {} });
// Only a 401 means signed out. Any other failure means we can't tell, and must not ask a signed-in person to sign in.
const readSession = async (signal?: AbortSignal): Promise<SessionState> => {
  const response = await fetch("/api/account/session", { signal });
  if (response.status === 401) return { user: null, ready: true };
  if (!response.ok) return { user: null, ready: true, unavailable: true };
  return { user: await response.json(), ready: true };
};
export function AccountSession({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({ user: null, ready: false });
  const reload = useCallback(async () => { const next = await readSession().catch(() => ({ user: null, ready: true, unavailable: true })); setSession(next); if (next.unavailable) throw new Error(t("Account service is unavailable.")); }, []);
  useEffect(() => { const controller = new AbortController(); readSession(controller.signal).then(setSession).catch(() => { if (!controller.signal.aborted) setSession({ user: null, ready: true, unavailable: true }); }); return () => controller.abort(); }, []);
  const unavailable = session.unavailable;
  useEffect(() => { if (!unavailable) return; const retry = () => { reload().catch(() => {}); }; window.addEventListener("online", retry); return () => window.removeEventListener("online", retry); }, [unavailable, reload]);
  // A different (or no) account must never see the previous account's cached progress.
  const userId = session.user?.id;
  useEffect(() => { forgetAdventureSummary(); }, [userId]);
  // Settings and lists save to the account as they change (lib/sync.ts).
  useEffect(() => (userId ? startSync(userId) : undefined), [userId]);
  return <Session.Provider value={{ ...session, reload }}>{children}</Session.Provider>;
}
// Pages that work without an account stay open during an outage.
const OPEN_DURING_OUTAGE = ["/journal", "/offline", "/help", "/guide", "/privacy", "/terms", "/credits"];
export function AccountUnavailable({ children }: { children: React.ReactNode }) {
  const { unavailable, reload } = useAccount(), path = usePathname();
  const [trying, setTrying] = useState(false);
  if (!unavailable || OPEN_DURING_OUTAGE.includes(path)) return <>{children}</>;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const retry = () => { setTrying(true); reload().catch(() => {}).finally(() => setTrying(false)); };
  return <main className="account-page"><section className="account-card" role="alert"><h1>{offline ? t("You’re offline") : t("We can’t reach your account right now")}</h1><p>{offline ? t("Your saved meals and workouts are safe. We’ll reconnect when you’re back online.") : t("Your saved meals and workouts are safe. This is a problem on our side, so there’s nothing you need to do.")}</p><div className="account-actions"><button className="account-primary" onClick={retry} disabled={trying}>{trying ? t("Trying…") : t("Try again")}</button><Link className="account-secondary" href="/journal">{t("Open device journal")}</Link></div></section></main>;
}
export const useAccount = () => useContext(Session);
export const useWorkspaceScope = () => useAccount().user?.id || "guest";
export function AccountLink() {
  const { user, ready } = useAccount();
  return <Link className="nav-item account-nav" href={user ? "/account" : "/login"}><span className="account-initial">{user ? (user.profile.display_name || user.email)[0].toUpperCase() : "↗"}</span><span>{!ready ? t("Loading account…") : user ? t("My account") : t("Sign in / Create account")}</span>{user && <SyncDot />}</Link>;
}
