// Account sync for app settings and lists (recipes, pantry, shopping, meal plans, fasting, preferences…).
// Each change is sent a moment after it is made. The server keeps a version per key; if another device saved first,
// the two copies are merged (lists item by item) and sent again, so nothing is overwritten unseen. Changes wait while
// offline. The last copy the account confirmed is kept per key (the "base") to tell this device's edits apart.
import { t } from "@/lib/i18n";
import { useSyncExternalStore } from "react";
import { readStored, setWriteHook, writeStored } from "@/lib/use-local-state";

export const SYNC_KEY = /^trackcal:(studio:(recipes|pantry|shopping|plans|fast)|recipe:(name|servings|ingredients)|preferences|reminders|appearance|comfort|play:(calm|character|theme|motion)|guide:done|companion-offset)$/;
export type SyncStatus = "off" | "saved" | "saving" | "offline" | "error";
type Base = { version: number; value: string | null };            // value: the confirmed JSON text
type Saved = { bases: Record<string, Base>; dirty: string[] };
type Entry = { value: unknown; version: number };
type Reply = { saved: Record<string, number>; conflicts: Record<string, Entry | null>; refused: Record<string, string> };

let scope = "", state: Saved = { bases: {}, dirty: [] }, status: SyncStatus = "off", timer: ReturnType<typeof setTimeout> | null = null, running = false, lastPull = 0;
const listeners = new Set<() => void>();
const setStatus = (next: SyncStatus) => { if (status !== next) { status = next; listeners.forEach(l => l()); } };
const storeKey = (s: string) => `trackcal-sync:${s}`;                // not a "trackcal:" key, so it is never backed up or synced itself
function load(s: string): Saved { try { const v = JSON.parse(localStorage.getItem(storeKey(s)) || "null"); if (v && typeof v.bases === "object" && Array.isArray(v.dirty)) return v; } catch { /* fresh */ } return { bases: {}, dirty: [] }; }
function persist() { try { localStorage.setItem(storeKey(scope), JSON.stringify(state)); } catch { /* kept in memory */ } }
const parse = (text: string | null): unknown => { try { return text === null ? null : JSON.parse(text); } catch { return null; } };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Who an item in a list is: its id, or for shopping items, its name. Lists without these merge as one value. */
function identity(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const v = item as Record<string, unknown>;
  return typeof v.id === "string" ? "id:" + v.id : typeof v.name === "string" ? "name:" + v.name.toLowerCase() : null;
}
const keyed = (list: unknown[]) => list.every(i => identity(i) !== null);

/** Three-way merge: what this device changed since the base, applied on top of the account's copy. */
export function merge(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (same(mine, base)) return theirs;                       // nothing changed here
  if (same(theirs, base) || same(mine, theirs)) return mine; // nothing changed there
  if (Array.isArray(mine) && Array.isArray(theirs) && keyed(mine) && keyed(theirs) && (base === null || (Array.isArray(base) && keyed(base)))) {
    const b = new Map((Array.isArray(base) ? base : []).map(i => [identity(i)!, i])), m = new Map(mine.map(i => [identity(i)!, i]));
    const out: unknown[] = [];
    for (const item of theirs) {
      const id = identity(item)!, old = b.get(id);
      if (!m.has(id)) { if (old !== undefined && same(old, item)) continue; out.push(item); continue; }   // removed here: drop unless changed there
      const ours = m.get(id);
      out.push(old !== undefined && same(ours, old) ? item : ours);                                       // edited here wins over unchanged there
    }
    for (const item of mine) { const id = identity(item)!; if (!b.has(id) && !theirs.some(t => identity(t) === id)) out.push(item); }   // new here
    return out;
  }
  return mine;                                               // a single setting changed on both: the latest change (this one) wins
}

async function call<T>(body?: unknown): Promise<T> {
  const response = await fetch("/api/account/sync", { method: body === undefined ? "GET" : "POST", credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || t("Sync failed")), { status: response.status });
  return data as T;
}
const markDirty = (key: string) => { if (!state.dirty.includes(key)) state.dirty = [...state.dirty, key]; persist(); };
const schedule = (ms = 800) => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; void push(); }, ms); };
const offline = (e: unknown) => !(e as { status?: number }).status || [408, 429, 502, 503, 504].includes((e as { status: number }).status);

/** Takes the account's copy of each key: new keys are written here; keys changed on both sides are merged. */
function absorb(entries: Record<string, Entry | null>) {
  for (const [key, entry] of Object.entries(entries)) {
    if (!SYNC_KEY.test(key)) continue;
    const version = entry?.version ?? 0, theirs = entry?.value ?? null, base = state.bases[key];
    if (base && base.version === version) continue;
    const localText = readStored(key, scope), mine = parse(localText);
    const baseValue = base ? parse(base.value) : null;
    const edited = state.dirty.includes(key) || (!base && localText !== null && !same(mine, theirs));
    const result = edited ? merge(baseValue, mine, theirs) : theirs;
    state.bases[key] = { version, value: theirs === null ? null : JSON.stringify(theirs) };
    if (!same(result, mine)) writeStored(key, scope, result === null ? null : JSON.stringify(result));
    if (edited && !same(result, theirs)) markDirty(key); else state.dirty = state.dirty.filter(k => k !== key);
  }
  persist();
}

async function pull() {
  const s = scope; lastPull = Date.now();
  const { entries } = await call<{ entries: Record<string, Entry> }>();
  if (s !== scope) return;
  absorb(entries);
  // Settings only in this browser (never sent before) go up too.
  for (const key of localKeys()) if (!state.bases[key] && !(key in entries)) markDirty(key);
}
function localKeys() {
  const keys: string[] = [], prefix = `trackcal:account:${scope}:`;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(prefix) && SYNC_KEY.test(k.slice(prefix.length))) keys.push(k.slice(prefix.length)); } } catch { /* storage off */ }
  return keys;
}

async function push(rounds = 0): Promise<void> {
  if (running || !scope) return;
  if (!state.dirty.length) { setStatus("saved"); return; }
  running = true; setStatus("saving"); const s = scope;
  try {
    const keys = state.dirty.slice(0, 40);
    const changes = keys.map(key => { const text = readStored(key, s); return text === null ? { key, removed: true, base_version: state.bases[key]?.version ?? 0 } : { key, value: parse(text), base_version: state.bases[key]?.version ?? 0 }; });
    const reply = await call<Reply>({ changes });
    if (s !== scope) return;
    for (const [key, version] of Object.entries(reply.saved)) {
      const sent = changes.find(c => c.key === key)!;
      state.bases[key] = { version, value: "removed" in sent && sent.removed ? null : JSON.stringify((sent as { value: unknown }).value) };
      // Changed again while this was being sent: stays waiting.
      if (readStored(key, s) === state.bases[key].value) state.dirty = state.dirty.filter(k => k !== key);
    }
    for (const key of Object.keys(reply.refused)) state.dirty = state.dirty.filter(k => k !== key);
    persist();
    if (Object.keys(reply.conflicts).length) absorb(reply.conflicts);
    running = false;
    if (state.dirty.length && rounds < 3) return await push(rounds + 1);
    setStatus(Object.keys(reply.refused).length ? "error" : state.dirty.length ? "saving" : "saved");
  } catch (e) {
    running = false;
    setStatus(offline(e) ? "offline" : "error");
    schedule(30000);
  } finally { running = false; }
}

function onWrite(key: string, s: string) {
  if (s !== scope || !SYNC_KEY.test(key)) return;
  markDirty(key); setStatus("saving"); schedule();
}

/** Starts sync for a signed-in account; returns a stop function. */
export function startSync(s: string) {
  scope = s; state = load(s); setStatus(state.dirty.length ? "saving" : "saved");
  setWriteHook(onWrite);
  const refresh = () => { if (Date.now() - lastPull > 30000) void pull().then(() => push()).catch(e => setStatus(offline(e) ? "offline" : "error")); };
  const online = () => { void pull().then(() => push()).catch(e => setStatus(offline(e) ? "offline" : "error")); };
  window.addEventListener("focus", refresh); window.addEventListener("online", online);
  void pull().then(() => push()).catch(e => { setStatus(offline(e) ? "offline" : "error"); schedule(30000); });
  return () => {
    window.removeEventListener("focus", refresh); window.removeEventListener("online", online);
    if (timer) clearTimeout(timer); timer = null;
    if (scope === s) { scope = ""; setWriteHook(null); setStatus("off"); }
  };
}

/** Sends waiting changes now (used by "Save now" and before signing out). */
export function syncNow() { if (timer) clearTimeout(timer); timer = null; return push(); }

export function useSyncStatus() { return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => status, () => "off" as SyncStatus); }

/** For tests. */
export function resetSync() { if (timer) clearTimeout(timer); timer = null; scope = ""; state = { bases: {}, dirty: [] }; running = false; lastPull = 0; setWriteHook(null); status = "off"; listeners.forEach(l => l()); }
