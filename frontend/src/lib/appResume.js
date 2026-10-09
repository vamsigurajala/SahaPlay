import { isCapacitorApp } from './platform';

// Fires `callback` whenever the app comes back to the foreground — a
// Capacitor `appStateChange` (isActive: true) on Android, or the page
// becoming visible again on web/Tauri desktop (tab switch, window
// un-minimizing, or the laptop waking from sleep — Tauri's webview is a
// regular browser engine underneath, so the Page Visibility API covers it
// too, no separate __TAURI__ branch needed).
//
// Used by GlobalChatWidget.jsx to force its chat socket to reconnect the
// instant the app is known to be active again, instead of waiting on
// socket.io's own passive ping-timeout (up to ~45s with default
// pingInterval/pingTimeout) to notice a connection that silently died while
// backgrounded/asleep. A Wi-Fi/mobile-data handoff or OS-level Doze
// throttling drops the underlying TCP connection without a clean close
// frame, so both client and server keep believing they're still connected
// until the next heartbeat fails — real-device report: a message sent while
// the recipient's socket was in exactly this "zombie" state showed a stuck
// single tick and no push notification (push is skipped for anyone the
// server still believes is live-connected) until something else happened to
// reconnect the socket, sometimes tens of seconds later. Reconnecting
// proactively on resume closes that gap instead of passively waiting on it.
export function onAppResume(callback) {
  const cleanups = [];

  if (isCapacitorApp()) {
    const app = window.Capacitor?.Plugins?.App;
    if (app?.addListener) {
      const handle = app.addListener('appStateChange', (state) => {
        if (state?.isActive) callback();
      });
      cleanups.push(() => handle?.remove?.());
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') callback();
  };
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

  return () => cleanups.forEach(fn => fn());
}
