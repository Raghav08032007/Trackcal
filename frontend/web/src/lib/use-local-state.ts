import { t } from "@/lib/i18n";
import { useCallback, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { validStoredValue } from "./storage-validation";
import { useWorkspaceScope } from "@/components/account-session";
import { mirrorDeviceWrite } from "./offline-db";

export function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const memory = new Map<string, string>();
/** Told about every saved change, so account sync (lib/sync.ts) can send it. */
let writeHook: ((key: string, scope: string) => void) | null = null;
export function setWriteHook(hook: typeof writeHook) { writeHook = hook; }
/** Raw read and write of one key for a scope, used by account sync; writing here does not count as a new change. */
export function readStored(key: string, scope: string) { return read(workspaceKey(key, scope)); }
export function writeStored(key: string, scope: string, encoded: string | null) {
  const stored = workspaceKey(key, scope);
  try { if (encoded === null) localStorage.removeItem(stored); else localStorage.setItem(stored, encoded); memory.delete(stored); }
  catch { if (encoded === null) memory.delete(stored); else memory.set(stored, encoded); }
  mirrorDeviceWrite(stored, encoded);
  window.dispatchEvent(new Event("trackcal-storage"));
}
export function forgetWorkspaceMemory(scope: string) {
  const prefix = `trackcal:account:${scope}:`;
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
}
export function workspaceKey(key: string, scope = "guest") { return scope === "guest" ? key : `trackcal:account:${scope}:${key}`; }
export function exportLocalEntries(scope = "guest"): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  const add = (stored: string, raw: string | null) => { const prefix = `trackcal:account:${scope}:`; const key = scope === "guest" ? stored : stored.startsWith(prefix) ? stored.slice(prefix.length) : ""; if(key==='trackcal:camera:draft'||key==='trackcal:training:draft')return; try { const value = JSON.parse(raw || "null"); if (key.startsWith("trackcal:") && !key.startsWith("trackcal:account:") && validStoredValue(key, value)) entries[key] = value; } catch { /* Ignore corrupted entries. */ } };
  try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key) add(key, localStorage.getItem(key)); } } catch { /* Memory entries remain exportable. */ }
  for (const [key, value] of memory) add(key, value);
  return entries;
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("trackcal-storage", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("trackcal-storage", notify); };
}
function read(key: string) {
  try { return memory.get(key) ?? localStorage.getItem(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
export function useLocalDate() {
  return useSyncExternalStore(subscribeDate, localDate, () => "");
}
function subscribeDate(notify: () => void) {
  const timer = window.setInterval(notify, 60000);
  window.addEventListener("focus", notify);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", notify); };
}
export function useStorageWarning() {
  return useSyncExternalStore(subscribe, () => memory.size > 0, () => false);
}
export function useLocalState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const scope = useWorkspaceScope();
  const storedKey = workspaceKey(key, scope);
  const raw = useSyncExternalStore(subscribe, useCallback(() => read(storedKey), [storedKey]), () => null);
  const parse = (value: string | null): T => { try { const parsed = value === null ? initial : JSON.parse(value); return validStoredValue(key, parsed) ? parsed : initial; } catch { return initial; } };
  const value = parse(raw);
  const setValue: Dispatch<SetStateAction<T>> = next => {
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(parse(read(storedKey))) : next;
    if (!validStoredValue(key, resolved)) return;
    const encoded = JSON.stringify(resolved);
    try { localStorage.setItem(storedKey, encoded); memory.delete(storedKey); }
    catch { memory.set(storedKey, encoded); }
    mirrorDeviceWrite(storedKey, encoded);
    window.dispatchEvent(new Event("trackcal-storage"));
    writeHook?.(key, scope);
  };
  return [value, setValue];
}

export function restoreLocalEntries(entries: Record<string, unknown>, scope: string) {
  for (const [key, value] of Object.entries(entries)) {
    if (!/^trackcal:(preferences$|appearance$|reminders$|play:(calm|character|theme|motion)$|journal:|wellness:|target:|recipe:|studio:)/.test(key) || !validStoredValue(key, value)) throw new Error(t("Backup contains invalid data."));
  }
  const previous = exportLocalEntries(scope);
  const changed: string[] = [];
  try {
    for (const key of Object.keys({ ...previous, ...entries })) { const stored = workspaceKey(key, scope); changed.push(key); if (key in entries) localStorage.setItem(stored, JSON.stringify(entries[key])); else localStorage.removeItem(stored); }
  } catch {
    for (const key of changed) { const stored = workspaceKey(key, scope); try { if (key in previous) localStorage.setItem(stored, JSON.stringify(previous[key])); else localStorage.removeItem(stored); } catch { /* Report the storage failure below. */ } }
    throw new Error(t("Browser storage is full or unavailable. Export your data before trying again."));
  }
  for (const key of changed) memory.delete(workspaceKey(key, scope));
  for (const key of changed) mirrorDeviceWrite(workspaceKey(key, scope), key in entries ? JSON.stringify(entries[key]) : null);
  window.dispatchEvent(new Event("trackcal-storage"));
  for (const key of changed) writeHook?.(key, scope);   // a restored copy is a change like any other: it syncs
}

