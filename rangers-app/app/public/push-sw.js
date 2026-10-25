// Shows push messages and opens the right screen when tapped. Imported by the generated service worker.
// Phones play their own alert sound for web apps (it cannot be chosen here); when the app is open, it plays the club song.
self.addEventListener('push', (e) => {
  let d = { title: 'Rangers FC', body: '', url: '/', tag: '' };
  try { d = { ...d, ...e.data.json() }; } catch { /* plain text */ }
  const icon = new URL('icons/icon-192.png', self.registration.scope).href;
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title, { body: d.body, icon, badge: icon, data: { url: d.url }, tag: d.tag || undefined, renotify: !!d.tag, vibrate: [300, 120, 300, 120, 600] }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ type: 'rangers-push', title: d.title }))),
  ]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = self.registration.scope + '#' + (e.notification.data && e.notification.data.url ? e.notification.data.url : '/');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.navigate(target).then((w) => (w || c).focus()) : self.clients.openWindow(target);
  }));
});
