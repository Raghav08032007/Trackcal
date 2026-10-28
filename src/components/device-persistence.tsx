"use client";
import { useEffect } from "react";
import { useAccount, useWorkspaceScope } from "./account-session";
import { hydrateDevice, sendPendingBackup } from "@/lib/offline-db";
export function DevicePersistence() {
  const { ready, user } = useAccount(); const scope = useWorkspaceScope();
  useEffect(() => { if (ready) void hydrateDevice(scope); }, [ready, scope]);
  useEffect(() => {
    if (!ready || !user) return;
    const retry = () => { if (navigator.onLine) void sendPendingBackup(scope).catch(() => {}); };
    retry();
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    const timer = window.setInterval(retry, 60000);
    return () => { window.removeEventListener("online", retry); window.removeEventListener("focus", retry); window.clearInterval(timer); };
  }, [ready, scope, user]);
  useEffect(() => { if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  return null;
}
