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
const appPlugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);

// Cached so a later login (fresh install → straight to Signup, before any
// token exists) can resend the token that arrived too early to register.
let cachedToken = null;

// A notification tap that COLD-STARTS the app (it wasn't running at all, not
// even backgrounded) fires pushNotificationActionPerformed as part of the
// native bridge's own startup sequence — this can resolve before React has
// rendered anything at all, let alone before BottomNav.jsx's effect has
// registered its 'open_chat_from_notification' listener. A DOM CustomEvent
// dispatched with no listener attached yet is just lost, which is exactly
// why cold-start notification taps landed on the home screen instead of the
// chat/profile they were tapped for, while a warm/backgrounded resume (where
// BottomNav was already mounted) worked fine. Caching the tap payload here
// lets any component that mounts later ask "did a tap already happen before
// I was ready?" via consumePendingNotificationTap(), instead of depending on
// exact timing against a live listener.
let pendingTap = null;
export function consumePendingNotificationTap() {
  const data = pendingTap;
  pendingTap = null;
  return data;
}

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

  // Friend-request live updates already run on a socket event + 3s poll
  // fallback (see useFollowRequests.js/Profile.jsx) — this adds a THIRD,
  // more mobile-reliable path: a push arriving (even while the app is
  // foregrounded — pushNotificationReceived, not the tap-only
  // ActionPerformed above) is a strong enough signal on its own to trigger
  // the same refresh, without waiting on a socket connection that may be
  // mid-reconnect after the app was backgrounded.
  p.addListener('pushNotificationReceived', (notification) => {
    const data = notification?.data;
    if (data?.type === 'friend_request' || data?.type === 'friend_accept') {
      window.dispatchEvent(new Event('follow_status_updated'));
    }
  });

  // Fires when the user taps the system notification (app was backgrounded
  // or fully killed) — data mirrors what notifyChatMessage/sendPushToUser/
  // sendPushBroadcastExcept set server-side in backend/server.js. Chat
  // notifications carry chatId; friend-request ones carry username instead;
  // call notifications (see call:invite in backend/server.js) carry callId —
  // no extra navigation is needed for those (CallContext's own socket
  // resyncs any still-ringing call the instant it connects, which is what a
  // tap-triggered cold start does anyway), this just stops the tap from
  // being silently dropped by the guard below.
  p.addListener('pushNotificationActionPerformed', (action) => {
    const data = action?.notification?.data;
    if (data?.chatId || data?.username || data?.callId) {
      pendingTap = data;
      onNotificationTap?.(data);
    }
  });

  // "Once app is opened, all notifications should be closed" — clears
  // every SahaPlay notification from the tray whenever the app comes to
  // the foreground, whether that's from tapping a notification, tapping
  // the launcher icon, or switching back from another app.
  const app = appPlugin();
  app?.addListener('appStateChange', (state) => {
    if (state?.isActive) p.removeAllDeliveredNotifications?.().catch(() => {});
  });
}

// Call right after a successful login/signup — the 'registration' event can
// fire before the user is authenticated (fresh install, straight to sign
// up), in which case sendTokenToServer no-op'd for lack of a token; this
// resends using the token captured then.
export function resyncPushTokenAfterLogin() {
  if (cachedToken) sendTokenToServer(cachedToken);
}
