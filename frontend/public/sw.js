// Minimal service worker — exists solely to satisfy Chrome's PWA
// installability requirement (a page must be controlled by a service worker
// with a fetch handler) for the Android TWA wrapper. Intentionally does not
// cache anything: this app's JS bundles and API responses change too often
// for a naive cache to stay correct, so every request just passes through.
// The only thing cached is the offline fallback page, shown when a page
// navigation fails because the device has no connection.
const OFFLINE_CACHE = 'sahaplay-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('sahaplay-offline-') && k !== OFFLINE_CACHE).map(k => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intervene for same-origin requests. Re-issuing a request with
  // fetch() from inside this worker's own script makes the browser check it
  // against CSP's connect-src — regardless of what the original resource
  // actually was (script/img/media/etc). A YouTube/Twitch/Vimeo player
  // script or a thumbnail CDN image is already correctly allowed by
  // script-src/img-src for a normal page-level load, but proxying it through
  // here re-checks it under connect-src's much narrower allowlist and
  // silently fails it instead — breaking video playback and thumbnails with
  // no visible error except a CSP violation in the console. Cross-origin
  // requests are left completely untouched so the browser handles them the
  // normal way; this handler's only job is to exist (Chrome's PWA
  // installability check), not to proxy anything.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    // Page load with no connection: show the friendly offline page instead
    // of the browser's "web page not available" error.
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then(res => res || Response.error())
      )
    );
    return;
  }
  // The app's translation files: network first (always the latest text), but
  // keep the last good copy so the offline page can show the user's language.
  if (/^\/locales\/[a-z]+\/translation\.json$/.test(new URL(event.request.url).pathname)) {
    event.respondWith(
      fetch(event.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(OFFLINE_CACHE).then(c => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(event.request).then(res => res || Response.error()))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => Response.error())
  );
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
