"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
type User = { id: string; email: string; email_verified?: boolean; profile: { display_name?: string } };
const Session = createContext<{ user: User | null; ready: boolean; reload: () => Promise<void> }>({ user: null, ready: true, reload: async () => {} });
export function AccountSession({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  const reload = useCallback(async () => { const response = await fetch("/api/account/session"); if (!response.ok && response.status !== 401) throw new Error("Account service is unavailable."); setSession({ user: response.ok ? await response.json() : null, ready: true }); }, []);
  useEffect(() => { const controller = new AbortController(); fetch("/api/account/session", { signal: controller.signal }).then(async response => setSession({ user: response.ok ? await response.json() : null, ready: true })).catch(() => { if (!controller.signal.aborted) setSession({ user: null, ready: true }); }); return () => controller.abort(); }, []);
  return <Session.Provider value={{ ...session, reload }}>{children}</Session.Provider>;
}
export const useAccount = () => useContext(Session);
export const useWorkspaceScope = () => useAccount().user?.id || "guest";
export function AccountLink() {
  const { user, ready } = useAccount();
  return <Link className="nav-item account-nav" href={user ? "/account" : "/login"}><span className="account-initial">{user ? (user.profile.display_name || user.email)[0].toUpperCase() : "↗"}</span><span>{!ready ? "Loading account…" : user ? "My account" : "Sign in / Create account"}</span></Link>;
}
