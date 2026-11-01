// Minimal app-shell service worker: network first, cache fallback so the app opens offline.
// Map tiles and live data are never cached.
const CACHE = 'fetch-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/fetch/')) return;
  e.respondWith(
    fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('/fetch/')))
  );
});
