// Cache public navigation only. Authenticated responses, API data and account HTML never enter this cache.
importScripts("/backup-sync.js");
const CACHE = "trackcal-shell-v3";
const PUBLIC_FILES = ["/offline.html", "/offline.css", "/offline.js"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("trackcal-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (PUBLIC_FILES.includes(url.pathname)) { event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request))); return; }
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});
self.addEventListener("sync", event => { if (event.tag === "trackcal-backup") event.waitUntil(syncTrackCalBackups(indexedDB, fetch)); });
