/* Partner Payroll service worker: keeps the app working offline and installable.
   Bump VERSION whenever any file below changes, so phones pick up the new copy. */
const VERSION = 'payroll-2026-10-15.1';
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
        .then(res => {
          // only the app's own page is kept for offline use, never an error page
          if (res.ok && /\/(index\.html)?$/.test(url.pathname)) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./', copy)); }
          return res;
        })
        .catch(() => caches.open(VERSION).then(c => c.match('./', { ignoreSearch: true }).then(r => r || c.match('index.html'))))
    );
    return;
  }
  // only this version's own cache is used: other pages on the site share the origin, so they could
  // otherwise plant a file in a cache of their own
  event.respondWith(
    caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    })))
  );
});
