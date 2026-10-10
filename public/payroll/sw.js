/* Partner Payroll service worker: keeps the app working offline and installable.
   Bump VERSION whenever any file below changes, so phones pick up the new copy. */
const VERSION = 'payroll-2026-10-10.1';
const SHELL = [
  './', 'index.html', 'app.css', 'app.js', 'pdf.js', 'manifest.webmanifest',
  'vendor/jspdf.umd.min.js', 'img/mark.png',
  'fonts/Lexend-Regular.ttf', 'fonts/Lexend-SemiBold.ttf', 'fonts/PlexMono-Regular.ttf', 'fonts/PlexMono-SemiBold.ttf',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('payroll-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // exchange rates and anything else off-site always go straight to the network
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // the page itself: fresh when online, the saved copy when offline
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./', copy)); return res; })
        .catch(() => caches.match('./', { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
