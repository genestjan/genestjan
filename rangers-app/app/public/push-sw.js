// Shows push messages and opens the right screen when tapped. Imported by the generated service worker.
self.addEventListener('push', (e) => {
  let d = { title: 'Rangers FC', body: '', url: '/' };
  try { d = { ...d, ...e.data.json() }; } catch { /* plain text */ }
  const icon = new URL('icons/icon-192.png', self.registration.scope).href;
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon, badge: icon, data: { url: d.url } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = self.registration.scope + '#' + (e.notification.data && e.notification.data.url ? e.notification.data.url : '/');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.navigate(target).then((w) => (w || c).focus()) : self.clients.openWindow(target);
  }));
});
