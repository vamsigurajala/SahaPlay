import { API } from './api';
import { isCapacitorApp } from './platform';

// Standard VAPID-key conversion — Push API wants applicationServerKey as a
// Uint8Array, the backend hands it over base64url-encoded.
function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

let subscribeAttempted = false;

// Best-effort, opportunistic subscribe — no-ops silently on anything
// unsupported/not-yet-granted (native app, browsers without Push API,
// permission not granted yet). Safe to call on every socket connect: it
// only does real work once per page-load, and existing subscriptions are
// reused rather than re-created.
export async function ensureWebPushSubscription(token) {
  if (isCapacitorApp() || subscribeAttempted) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!token) return;
  subscribeAttempted = true;
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const keyRes = await fetch(`${API}/api/push/webpush/vapid-public-key`);
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json();
      if (!publicKey) return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });
    }
    await fetch(`${API}/api/push/webpush/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  } catch (e) {
    console.error('[WebPush] subscribe failed:', e);
  }
}
