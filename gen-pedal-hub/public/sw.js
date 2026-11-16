// Keeps Gen Pedal Hub opening when the phone has no signal.
// Pages: try the network first, fall back to the saved copy.
// Everything else (scripts, fonts, images): use the saved copy, fetch if missing.
const CACHE = 'gph-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const save = (res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(save)
        .catch(() => caches.match(req).then((hit) => hit || caches.match(self.registration.scope)))
    );
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(save)));
});
