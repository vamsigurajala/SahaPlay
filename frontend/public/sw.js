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
