import { isCapacitorApp } from './platform';
import { API } from './api';

// Bridges the native @capacitor/push-notifications plugin. Called off the
// raw window.Capacitor.Plugins proxy (not an `import { PushNotifications }
// from '@capacitor/push-notifications'`) for the same reason every other
// native bridge in this app does — @capacitor/push-notifications is only
// ever installed transiently inside the CI Android build job, never a real
// frontend dependency, so a real import would fail to resolve when the web
// bundle itself builds (that step runs before Capacitor packages are
// installed at all). Native plugin methods (register/requestPermissions)
// return real Promises through this proxy; addListener() does not — it
// returns the listener handle synchronously here (confirmed the hard way
// via the screen-share addListener().then() crash), so nothing below
// chains .then() off an addListener() call.
const plugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.PushNotifications : null);

// Cached so a later login (fresh install → straight to Signup, before any
// token exists) can resend the token that arrived too early to register.
let cachedToken = null;

function authHeaders() {
  const token = localStorage.getItem('watch_token');
  if (!token || token === 'null' || token === 'undefined') return null;
  if (localStorage.getItem('watch_is_guest') === 'true') return null; // guests can't chat, nothing to notify them about
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function sendTokenToServer(deviceToken) {
  const headers = authHeaders();
  if (!headers || !deviceToken) return;
  fetch(`${API}/api/push/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: deviceToken, platform: 'android' }),
  }).catch(() => {});
}

// Call once at app startup (see main.jsx). Requests notification permission,
// registers with FCM, and wires the two listeners that matter: capturing
// the device token to send to our backend, and reacting to a notification
// tap. onNotificationTap receives { type: 'dm' | 'room', chatId }.
export function initNativePush(onNotificationTap) {
  const p = plugin();
  if (!p) return;

  p.requestPermissions()
    .then((result) => {
      if (result?.receive === 'granted') p.register().catch(() => {});
    })
    .catch(() => {});

  p.addListener('registration', (token) => {
    if (!token?.value) return;
    cachedToken = token.value;
    sendTokenToServer(cachedToken);
  });

  p.addListener('registrationError', (err) => {
    console.error('[Push] registration error:', err);
  });

  // Fires when the user taps the system notification (app was backgrounded
  // or fully killed) — data mirrors what sendPushToUser/sendPushBroadcastExcept
  // set server-side in backend/server.js.
  p.addListener('pushNotificationActionPerformed', (action) => {
    const data = action?.notification?.data;
    if (data?.chatId) onNotificationTap?.(data);
  });
}

// Call right after a successful login/signup — the 'registration' event can
// fire before the user is authenticated (fresh install, straight to sign
// up), in which case sendTokenToServer no-op'd for lack of a token; this
// resends using the token captured then.
export function resyncPushTokenAfterLogin() {
  if (cachedToken) sendTokenToServer(cachedToken);
}
