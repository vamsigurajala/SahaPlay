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
// Originally lived only in GlobalChatWidget.jsx (chat messages); extracted
// here so CallContext.jsx can reuse the exact same permission/gating logic
// for incoming and missed calls instead of duplicating it.
//
// Inside the Tauri desktop app, this now uses the SAME plain Web
// `Notification` API as a regular browser tab, not a native Windows toast
// built through a Rust plugin/crate. That's a reversal from an earlier
// version of this file (see git history) which routed through
// @tauri-apps/plugin-notification, and after that plugin's click callback
// turned out to be mobile-only, through a hand-rolled Rust command using
// tauri-winrt-notification directly — layers of native-toast complexity
// that, across several real-device tests, still weren't reliably producing
// a notification at all (not a click problem — nothing showed up). WebView2
// is a real Chromium engine and the app now has a proper AUMID via its NSIS
// install, so the plain API gets another chance here rather than adding a
// fourth layer of native workaround; if a real Windows toast still doesn't
// appear with this simpler path, the problem isn't the native-toast
// plumbing. isTauriWindowActuallyOnScreen below still asks the OS directly
// whether the window is minimized/visible/focused (not the DOM's Page
// Visibility API) — that part of the diagnosis held up regardless of which
// API ends up building the toast.
let desktopNotifyPermissionRequested = false;

// A tapped notification should land the user on the specific chat it was
// about — mirrors the native Android app's own tap handling (see
// nativePush.js's pushNotificationActionPerformed listener), which already
// dispatches this exact event for BottomNav.jsx/Navbar.jsx to pick up and
// navigate.
function dispatchChatOpenFromNotification(data) {
  // Two shapes reach here: a chat tap ({ chatId, type: 'dm'|'room' },
  // consumed by Navbar.jsx/BottomNav.jsx/Room.jsx) and a friend-request tap
  // ({ type: 'friend_request'|'friend_accept', username }, consumed by
  // Navbar.jsx's own isFriendTap listener) — both ride the same event, so
  // this only needs to rule out "nothing to act on."
  if (!data || (!data.chatId && !data.type)) return;
  try {
    window.dispatchEvent(new CustomEvent('open_chat_from_notification', { detail: data }));
  } catch {}
}

// A plain Notification's window.focus() call doesn't reliably bring a
// native Tauri window forward the way it brings a browser tab forward —
// there's no "tab" to switch to, and the window may be minimized, which
// focus() alone doesn't undo. Routes through the real window APIs instead
// when running under Tauri; a plain browser just calls window.focus().
function focusThisWindow() {
  if (isTauriApp()) {
    import('@tauri-apps/api/window').then(async (mod) => {
      try {
        const win = mod.getCurrentWindow();
        await win.unminimize();
        await win.show();
        await win.setFocus();
      } catch (e) {
        console.error('[desktopNotify] failed to focus Tauri window', e);
      }
    }).catch((e) => console.error('[desktopNotify] @tauri-apps/api/window failed to load', e));
    return;
  }
  try { window.focus(); } catch {}
}

export function ensureDesktopNotifyPermission() {
  if (isCapacitorApp() || desktopNotifyPermissionRequested) return;
  desktopNotifyPermissionRequested = true;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch((e) => console.error('[desktopNotify] requestPermission() rejected', e));
  }
}

// Exposed so AppSettings.jsx can show real status ("Windows notifications
// are off for SahaPlay") instead of a fix that silently no-ops forever —
// requestPermission() only re-prompts once per install on Windows; if the
// user (or Windows' own default) already denied it, the only way back is
// the OS Settings app itself, which openWindowsNotificationSettings below
// opens directly.
export async function getTauriNotifyPermissionStatus() {
  if (!isTauriApp()) return null;
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default';
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

function buildNotification(title, body, tag, data) {
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
    n.onclick = () => { focusThisWindow(); n.close(); dispatchChatOpenFromNotification(data); };
    n.onerror = (e) => console.error('[desktopNotify] Notification errored', e);
    console.debug('[desktopNotify] Notification() constructed', { title, tag });
    return n;
  } catch (e) {
    console.error('[desktopNotify] new Notification() threw', e);
    return null;
  }
}

// data: optional { chatId, type } — when present, clicking the notification
// dispatches 'open_chat_from_notification' so BottomNav.jsx/Navbar.jsx open
// that exact chat, the same event the native Android app's own
// notification tap already produces. Omit for notifications with nowhere
// specific to navigate (e.g. calls, which already surface their own
// always-mounted GlobalCallOverlay).
export function showDesktopNotification(title, body, tag, data) {
  if (isCapacitorApp()) return;
  if (typeof document === 'undefined') return;
  if (isTauriApp()) {
    isTauriWindowActuallyOnScreen().then((onScreen) => {
      if (!onScreen) buildNotification(title, body, tag, data);
    });
    return null;
  }
  // Window/tab is visible AND focused — an in-page UI already covers this;
  // showing an OS notification too would just be a redundant duplicate.
  if (!document.hidden && document.hasFocus()) return;
  return buildNotification(title, body, tag, data);
}

// Settings screen's "Send a test notification" button — deliberately skips
// the visible/focused check above (the user is, by definition, looking
// straight at the app when they tap this), unlike every other call site
// here which only ever fires for a backgrounded/unfocused window.
export function sendTestDesktopNotification(title, body) {
  buildNotification(title, body, undefined, undefined);
}
