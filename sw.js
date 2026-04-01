self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'GroceryRun Deal Alert', {
      body: data.body ?? 'A new deal is available near you!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag ?? 'deal-alert',
      renotify: true,
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'OPEN_SEARCH', url });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
