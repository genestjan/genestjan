// Shows push messages and opens the app when tapped. Imported by the generated service worker.
self.addEventListener('push', (e) => {
  let d = { title: 'Rangers FC', body: '', url: '/' };
  try { d = { ...d, ...e.data.json() }; } catch { /* plain text */ }
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => { const c = cs[0]; return c ? c.focus().then(() => c.navigate(e.notification.data.url)) : self.clients.openWindow(e.notification.data.url); }));
});
