import { isCapacitorApp } from './platform';

// Bridges a tapped message notification (built manually by
// SahaplayFirebaseMessagingService.java — see its own comment for why a
// chat-message push had to stop being a plain `notification`-block message,
// which meant Capacitor's Push Notifications plugin no longer builds/forwards
// this tap itself) back into the web app. Same sahaplay:// deep-link pattern
// nativeCallBridge.js already uses for call-answer/call-end, just a
// different host — see AndroidManifest.xml's matching intent-filter.
const capApp = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);
const DEEP_LINK_PREFIX = 'sahaplay://chat-open';

// Call once at app startup (see main.jsx) — mirrors initNativePush's own
// { type: 'dm' | 'room', chatId } shape exactly, so callers (BottomNav.jsx's
// 'open_chat_from_notification' listener) don't need to know which of the
// two delivery paths actually fired.
export function initNativeChatOpenLink(onOpen) {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url || !url.startsWith(DEEP_LINK_PREFIX)) return;
    const qIndex = url.indexOf('?');
    const query = qIndex >= 0 ? url.slice(qIndex + 1) : '';
    const params = new URLSearchParams(query);
    const chatId = params.get('chatId');
    const type = params.get('type');
    if (!chatId) return;
    onOpen({ type: type || 'dm', chatId });
  });
}
