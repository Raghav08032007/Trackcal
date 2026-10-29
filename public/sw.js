// Cache public navigation only. Authenticated responses, API data and account HTML never enter this cache.
// Updates wait: a new version activates only when the page asks (SKIP_WAITING), so a workout is never interrupted.
importScripts("/backup-sync.js");
const CACHE = "trackcal-shell-v4";
const PUBLIC_FILES = ["/offline.html", "/offline.css", "/offline.js"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_FILES))); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("trackcal-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("message", event => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (PUBLIC_FILES.includes(url.pathname)) { event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request))); return; }
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});
self.addEventListener("sync", event => { if (event.tag === "trackcal-backup") event.waitUntil(syncTrackCalBackups(indexedDB, fetch)); });

// ── Push (Phase 4) ── Payloads carry only a title, a neutral body, a link and an id: never health details.
const safePath = value => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "TrackCal";
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === "string" ? data.body.slice(0, 160) : "", icon: "/icon-192.png", badge: "/icon-192.png",
    tag: typeof data.type === "string" ? data.type : "trackcal", data: { url: safePath(data.url), id: typeof data.id === "string" ? data.id : "" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const { url, id } = event.notification.data || {};
  const target = new URL(safePath(url), self.location.origin).href;
  event.waitUntil((async () => {
    if (id && /^[0-9a-f-]{36}$/.test(id)) await fetch("/api/push/opened/" + id, { method: "POST", credentials: "same-origin" }).catch(() => {});
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (open) { await open.focus(); if ("navigate" in open) await open.navigate(target).catch(() => {}); return; }
    await self.clients.openWindow(target);
  })());
});
const keyBytes = base64 => { const padded = (base64 + "=".repeat((4 - base64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); };
self.addEventListener("pushsubscriptionchange", event => {
  // The browser replaced the subscription: subscribe again and tell the server which old one it replaces.
  event.waitUntil((async () => {
    const config = await fetch("/api/push/config", { credentials: "same-origin" }).then(r => r.json()).catch(() => null);
    if (!config || !config.enabled || !config.public_key) return;
    const subscription = event.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.public_key) });
    const json = subscription.toJSON();
    await fetch("/api/push/subscribe", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, ...(event.oldSubscription ? { old_endpoint: event.oldSubscription.endpoint } : {}) }) }).catch(() => {});
  })());
});
