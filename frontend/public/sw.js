// Minimal service worker — exists solely to satisfy Chrome's PWA
// installability requirement (a page must be controlled by a service worker
// with a fetch handler) for the Android TWA wrapper. Intentionally does not
// cache anything: this app's JS bundles and API responses change too often
// for a naive cache to stay correct, so every request just passes through.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Web Push (VAPID) — see backend/server.js's sendWebPushToTokens. Every push
// (call invites, missed calls, chat messages) is delivered here regardless
// of whether a tab is open; this handler decides what to actually show.
// call-cancel carries no visible content of its own — it just means
// whatever ring notification is showing for that callId should go away
// (the FCM/Android equivalent, "call-cancel", does the same thing).
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const data = payload.data || {};

  if (data.type === 'call-cancel') {
    event.waitUntil(
      self.registration.getNotifications({ tag: `call-${data.callId}` })
        .then(list => list.forEach(n => n.close()))
    );
    return;
  }

  const title = payload.title || 'SahaPlay';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/logos/trans_appletouch.png',
      tag: payload.tag || undefined,
      data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find(c => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
