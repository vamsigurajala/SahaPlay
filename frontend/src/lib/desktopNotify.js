import { isCapacitorApp, isTauriApp } from './platform';

// Desktop-browser equivalent of the native app's push notifications — an
// in-page toast only helps while the relevant tab is actually visible, so
// something that arrives while the user is on a different tab (browser
// open, just not looking at this one) would otherwise produce nothing at
// all. This is exactly what WhatsApp Web does: no real Push subscription,
// just the Notifications API firing from the already-open tab's live
// socket connection. Skipped entirely on the native app (isCapacitorApp) —
// FCM already covers that case, and Notification permission prompts don't
// apply there anyway.
//
// Inside the Tauri desktop app, this does NOT use the plain Web
// `Notification` API — that was tried and confirmed dead: WebView2 does
// not surface a JS `new Notification()` call as a real OS toast (a
// documented WebView2 limitation, unlike an actual browser tab, which
// handles it natively). The object constructs fine, permission reports
// "granted," no error is thrown — nothing you'd notice from JS — and yet
// no toast ever appears, which is exactly what was being reported ("I can
// hear the notification sound but no push notification"). So the Tauri
// path instead invokes a native Rust command (show_windows_toast, see
// src-tauri/src/main.rs) that builds the toast directly via
// tauri-winrt-notification, bypassing the WebView entirely. Clicking it
// fires desktop_toast_clicked from Rust's on_activated handler, which
// dispatchChatOpenFromNotification below turns into the same
// open_chat_from_notification event the plain-browser path (and the native
// Android app) already produce.
//
// The command reports back over desktop_toast_result — Rust's own view of
// whether Toast::show() succeeded or not. A failure is surfaced via a
// plain DOM banner (showDiagnosticBanner below), not a react-hot-toast
// toast(): this file has no guarantee any page's <Toaster/> happens to be
// mounted when the result comes back, and a diagnostic that can silently
// fail to render is worse than not having one. Success is silent — the
// real toast itself is the confirmation. Rust also appends every outcome
// to notify-debug.log under the app's log directory
// (%LOCALAPPDATA%\com.sahaplay.desktop\logs\ on Windows) as a second,
// independent channel in case even the event round-trip back to JS never
// happens.
let desktopNotifyPermissionRequested = false;
let tauriToastBridgeReady = false;

// A tapped notification should land the user on the specific chat it was
// about — mirrors the native Android app's own tap handling (see
// nativePush.js's pushNotificationActionPerformed listener), which already
// dispatches this exact event for BottomNav.jsx/Navbar.jsx/Room.jsx to pick
// up and navigate.
function dispatchChatOpenFromNotification(data) {
  // Two shapes reach here: a chat tap ({ chatId, type: 'dm'|'room' }) and a
  // friend-request tap ({ type: 'friend_request'|'friend_accept', username })
  // — both ride the same event, so this only needs to rule out "nothing to
  // act on."
  if (!data || (!data.chatId && !data.type)) return;
  try {
    window.dispatchEvent(new CustomEvent('open_chat_from_notification', { detail: data }));
  } catch {}
}

// Minimal, dependency-free on-screen banner — deliberately not
// react-hot-toast, see the comment above. Auto-removes itself; not meant
// to be a permanent UI element, just enough to be seen once.
function showDiagnosticBanner(message, isError) {
  try {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = `position:fixed;bottom:16px;right:16px;z-index:2147483647;background:${isError ? '#dc2626' : '#16a34a'};color:#fff;padding:10px 16px;border-radius:8px;font:600 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.35);max-width:320px;`;
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch {} }, 10000);
  } catch {}
}

// One-time listeners for the two events show_windows_toast's Rust side
// emits. Safe to call repeatedly — only wires up once per page load.
function ensureTauriToastBridge() {
  if (tauriToastBridgeReady || !isTauriApp()) return;
  tauriToastBridgeReady = true;
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('desktop_toast_clicked', (event) => {
      try {
        const data = event.payload ? JSON.parse(event.payload) : null;
        dispatchChatOpenFromNotification(data);
      } catch (e) {
        console.error('[desktopNotify] failed to parse toast click payload', e);
      }
    }).catch((e) => console.error('[desktopNotify] failed to listen for desktop_toast_clicked', e));

    listen('desktop_toast_result', (event) => {
      const { tag, ok, error } = event.payload || {};
      if (ok) {
        console.debug('[desktopNotify] Toast::show() reported success', tag);
        return;
      }
      console.error('[desktopNotify] Toast::show() FAILED', tag, error);
      showDiagnosticBanner(`Notification failed to show: ${error || 'unknown error'}`, true);
    }).catch((e) => console.error('[desktopNotify] failed to listen for desktop_toast_result', e));
  }).catch((e) => console.error('[desktopNotify] @tauri-apps/api/event failed to load', e));
}

export function ensureDesktopNotifyPermission() {
  if (isTauriApp()) { ensureTauriToastBridge(); return; }
  if (isCapacitorApp() || desktopNotifyPermissionRequested) return;
  desktopNotifyPermissionRequested = true;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch((e) => console.error('[desktopNotify] requestPermission() rejected', e));
  }
}

// Exposed so AppSettings.jsx can show real status. Native Windows toasts
// (tauri-winrt-notification) don't go through a runtime permission prompt
// the way the Web Notification API does — an unpackaged Win32 app just
// respects the OS-level Settings > Notifications toggle for this app,
// which openWindowsNotificationSettings below opens directly — so there's
// nothing meaningful to "check" here beyond that.
export async function getTauriNotifyPermissionStatus() {
  if (!isTauriApp()) return null;
  return 'granted';
}

export function openWindowsNotificationSettings() {
  if (!isTauriApp()) return;
  import('@tauri-apps/plugin-opener')
    .then((mod) => mod.openUrl('ms-settings:notifications'))
    .catch((e) => console.error('[desktopNotify] failed to open ms-settings:notifications', e));
}

// Whether the Tauri window is genuinely the thing on screen right now —
// deliberately NOT document.hidden/document.hasFocus() (the Page
// Visibility API check the plain-browser path below uses). Minimizing the
// window was reported to suppress every notification: WebView2 doesn't
// reliably flip those two properties just because the native window got
// minimized (unlike a browser tab actually losing visibility when you
// switch away from it), so the generic check was reading a minimized,
// completely off-screen window as "visible and focused" and skipping the
// notification entirely. isMinimized/isVisible/isFocused ask the OS
// directly instead of inferring it from the DOM.
async function isTauriWindowActuallyOnScreen() {
  try {
    const mod = await import('@tauri-apps/api/window');
    const win = mod.getCurrentWindow();
    const [minimized, visible, focused] = await Promise.all([
      win.isMinimized(),
      win.isVisible(),
      win.isFocused(),
    ]);
    const onScreen = !minimized && visible && focused;
    console.debug('[desktopNotify] window state', { minimized, visible, focused, onScreen });
    return onScreen;
  } catch (e) {
    // Unknown state — fail toward showing the notification rather than
    // silently swallowing it, the opposite of the bug being fixed here.
    console.error('[desktopNotify] window-state check failed', e);
    return false;
  }
}

function showTauriToast(title, body, tag, data) {
  ensureTauriToastBridge();
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('show_windows_toast', {
      title,
      body,
      tag: tag || 'sahaplay',
      launchData: data ? JSON.stringify(data) : null,
    }).catch((e) => console.error('[desktopNotify] show_windows_toast invoke failed', e));
  }).catch((e) => console.error('[desktopNotify] @tauri-apps/api/core failed to load', e));
}

function buildBrowserNotification(title, body, tag, data) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.error('[desktopNotify] Notification API unavailable in this webview');
    return null;
  }
  if (Notification.permission !== 'granted') {
    console.warn('[desktopNotify] notification permission not granted, skipping', Notification.permission);
    return null;
  }
  try {
    const n = new Notification(title, { body, icon: '/logos/trans_appletouch.png', tag });
    n.onclick = () => { try { window.focus(); } catch {} n.close(); dispatchChatOpenFromNotification(data); };
    n.onerror = (e) => console.error('[desktopNotify] Notification errored', e);
    return n;
  } catch (e) {
    console.error('[desktopNotify] new Notification() threw', e);
    return null;
  }
}

// data: optional { chatId, type } — when present, clicking the notification
// dispatches 'open_chat_from_notification' so BottomNav.jsx/Navbar.jsx/
// Room.jsx open that exact chat, the same event the native Android app's
// own notification tap already produces. Omit for notifications with
// nowhere specific to navigate (e.g. calls, which already surface their
// own always-mounted GlobalCallOverlay).
//
// skipIfChatOpen: Tauri/.exe only (see the branch below — the plain-
// browser path never reads this param at all). GlobalChatWidget.jsx
// already computes "is the user currently looking at THIS exact
// conversation somewhere in the app" (its own in-page toast suppression,
// `skipToast`) — this just reuses that same signal for the OS-level
// toast too, specifically for desktop. Explicit ask: a room/chat left
// open while the user is in a different application entirely should stay
// silent (they're already looking at the message live in that panel);
// only a message for a chat that ISN'T currently open anywhere in the app
// should produce a real Windows toast. Deliberately NOT applied to the
// window-focus check right below — that one is "is the app on-screen at
// all," which stays exactly as it was.
export function showDesktopNotification(title, body, tag, data, skipIfChatOpen = false) {
  if (isCapacitorApp()) return;
  if (typeof document === 'undefined') return;
  if (isTauriApp()) {
    if (skipIfChatOpen) return null;
    isTauriWindowActuallyOnScreen().then((onScreen) => {
      if (!onScreen) showTauriToast(title, body, tag, data);
    });
    return null;
  }
  // Window/tab is visible AND focused — an in-page UI already covers this;
  // showing an OS notification too would just be a redundant duplicate.
  if (!document.hidden && document.hasFocus()) return;
  return buildBrowserNotification(title, body, tag, data);
}

// Settings screen's "Send a test notification" button — deliberately skips
// the visible/focused check above (the user is, by definition, looking
// straight at the app when they tap this), unlike every other call site
// here which only ever fires for a backgrounded/unfocused window.
export function sendTestDesktopNotification(title, body) {
  if (isTauriApp()) { showTauriToast(title, body, 'test'); return; }
  buildBrowserNotification(title, body, undefined, undefined);
}
