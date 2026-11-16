import { t } from "@/lib/i18n";
import { Dexie, type EntityTable } from "dexie";
type CacheRow = { key: string; raw: string; updated: number };
export type PendingBackup = { scope: string; token: string; entries: Record<string, unknown>; expected_revision: string; status: "queued" | "conflict"; updated: number };
const db = new Dexie("trackcal-device-v1") as Dexie & { cache: EntityTable<CacheRow, "key">; backups: EntityTable<PendingBackup, "scope">; revisions: EntityTable<{ scope: string; revision: string }, "scope"> };
db.version(1).stores({ cache: "key, updated", backups: "scope, status, updated" });
db.version(2).stores({ cache: "key, updated", backups: "scope, status, updated", revisions: "scope" });
let warning = "";
let writes = Promise.resolve();
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function fail() { warning = t("IndexedDB is unavailable. Export a JSON backup; browser storage remains the fallback."); notify(); }
export const deviceWarning = () => warning;
export const subscribeDevice = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function mirrorDeviceWrite(key: string, raw: string | null) {
  if (typeof indexedDB === "undefined") return;
  writes = writes.then(async () => { if (raw === null) await db.cache.delete(key); else await db.cache.put({ key, raw, updated: Date.now() }); warning = ""; notify(); }).catch(fail);
}
export async function flushDeviceWrites() { await writes; }
export async function hydrateDevice(scope: string) {
  if (typeof indexedDB === "undefined") return;
  const prefix = scope === "guest" ? "trackcal:" : `trackcal:account:${scope}:`;
  const matches = (key: string) => key.startsWith(prefix) && (scope !== "guest" || !key.startsWith("trackcal:account:"));
  try {
    await writes;
    const cached = await db.cache.toArray();
    for (const row of cached) if (matches(row.key) && localStorage.getItem(row.key) === null) localStorage.setItem(row.key, row.raw);
    const local: CacheRow[] = [];
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && matches(key)) { const raw = localStorage.getItem(key); if (raw !== null) local.push({ key, raw, updated: Date.now() }); } }
    if (local.length) await db.cache.bulkPut(local);
    window.dispatchEvent(new Event("trackcal-storage"));
  } catch { fail(); }
}
export async function queueBackup(backup: Omit<PendingBackup, "status" | "updated" | "token">) {
  await db.backups.put({ ...backup, token: crypto.randomUUID(), status: "queued", updated: Date.now() }); notify();
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
    void navigator.serviceWorker.ready.then(registration => {
      const background = registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
      return background.sync?.register("trackcal-backup");
    }).catch(() => {});
  }
}
export async function pendingBackup(scope: string) { return db.backups.get(scope); }
export async function discardPendingBackup(scope: string) { await db.backups.delete(scope); notify(); }
const sending = new Set<string>();
export async function sendPendingBackup(scope: string, request: typeof fetch = fetch) {
  if (sending.has(scope)) return "busy";
  sending.add(scope);
  try { return await processPendingBackup(scope, request); } finally { sending.delete(scope); }
}
async function processPendingBackup(scope: string, request: typeof fetch) {
  const item = await db.backups.get(scope);
  if (!item || item.status === "conflict") return item?.status || "empty";
  const response = await request("/api/account/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: item.entries, expected_revision: item.expected_revision, owner_id: scope }) });
  if (response.status === 409) { await db.backups.update(scope, { status: "conflict" }); notify(); return "conflict"; }
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || t("Backup could not sync. It remains queued.")); }
  // Preserve a newer queued snapshot created while this request was running.
  const data = await response.json();
  await db.transaction("rw", db.backups, db.revisions, async () => {
    if (typeof data.revision === "string") await db.revisions.put({ scope, revision: data.revision });
    const latest = await db.backups.get(scope);
    if (latest?.token === item.token) await db.backups.delete(scope);
    else if (latest?.expected_revision === item.expected_revision && typeof data.revision === "string") await db.backups.update(scope, { expected_revision: data.revision });
  });
  notify(); return "synced";
}
export { db as deviceDb };
