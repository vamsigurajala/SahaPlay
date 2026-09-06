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
// Inside the Tauri desktop app, the plain Web `Notification` API does NOT
// reliably produce a real Windows toast — WebView2 hosts that aren't
// registered with an Application User Model ID largely swallow it, either
// silently or with no OS-level identity to attach the toast to. Confirmed
// by testing (not just a theoretical risk), so the Tauri build routes
// through `@tauri-apps/plugin-notification` instead, which talks to the
// native Windows notification system directly. Same package.json/frontend
// bundle serves both plain browsers and the Tauri shell (tauri.conf.json's
// window just loads https://sahaplay.com), so this file has to branch at
// runtime rather than being two separate builds.
let desktopNotifyPermissionRequested = false;
let tauriNotifyModPromise = null;

function getTauriNotify() {
  if (!tauriNotifyModPromise) {
    tauriNotifyModPromise = import('@tauri-apps/plugin-notification').catch(() => null);
  }
  return tauriNotifyModPromise;
}

// A tapped notification should land the user on the specific chat it was
// about — mirrors the native Android app's own tap handling (see
// nativePush.js's pushNotificationActionPerformed listener), which already
// dispatches this exact event for BottomNav.jsx/Navbar.jsx to pick up and
// navigate. Without this, clicking a desktop/Tauri toast only refocused the
// window and left the user staring at whatever page happened to be open.
function dispatchChatOpenFromNotification(data) {
  if (!data || !data.chatId) return;
  try {
    window.dispatchEvent(new CustomEvent('open_chat_from_notification', { detail: data }));
  } catch {}
}

// Brings the Tauri window to the front on a notification click — a
// backgrounded/minimized window doesn't automatically come forward just
// because its own JS ran an event handler. Dynamically imported (like
// @tauri-apps/plugin-notification above) so this file still loads harmlessly
// in a plain browser tab or the Capacitor app, neither of which ever takes
// the isTauriApp() branch that calls this.
function focusTauriWindow() {
  import('@tauri-apps/api/window').then(async (mod) => {
    try {
      const win = mod.getCurrentWindow();
      if (await win.isMinimized()) await win.unminimize();
      await win.show();
      await win.setFocus();
    } catch {}
  }).catch(() => {});
}

// Registered once (guarded by desktopNotifyPermissionRequested below) for
// the lifetime of the app — Tauri's onAction fires for a click on the toast
// itself (not just an explicit action button), carrying back whatever
// `extra` payload sendNotification attached, so this is the one place a
// click turns into "focus the window and open this chat."
function registerTauriActionHandler() {
  getTauriNotify().then((mod) => {
    if (!mod) return;
    mod.onAction((notification) => {
      focusTauriWindow();
      dispatchChatOpenFromNotification(notification?.extra);
    }).catch(() => {});
  }).catch(() => {});
}

export function ensureDesktopNotifyPermission() {
  if (isCapacitorApp() || desktopNotifyPermissionRequested) return;
  desktopNotifyPermissionRequested = true;
  if (isTauriApp()) {
    getTauriNotify().then(async (mod) => {
      if (!mod) return;
      const granted = await mod.isPermissionGranted();
      if (!granted) await mod.requestPermission();
    }).catch(() => {});
    registerTauriActionHandler();
    return;
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
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
  const mod = await getTauriNotify();
  if (!mod) return 'unsupported';
  try {
    return (await mod.isPermissionGranted()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export function openWindowsNotificationSettings() {
  if (!isTauriApp()) return;
  import('@tauri-apps/plugin-opener')
    .then((mod) => mod.openUrl('ms-settings:notifications'))
    .catch(() => {});
}

function sendTauriNotification(title, body, data) {
  getTauriNotify().then(async (mod) => {
    if (!mod) return;
    const granted = await mod.isPermissionGranted();
    if (!granted) return;
    // extra: round-tripped back on the onAction callback registered in
    // registerTauriActionHandler above when the user clicks this toast.
    mod.sendNotification(data ? { title, body, extra: data } : { title, body });
  }).catch(() => {});
}

// data: optional { chatId, type } — when present, clicking the notification
// (or the Tauri toast) dispatches 'open_chat_from_notification' so
// BottomNav.jsx/Navbar.jsx open that exact chat, the same event the native
// Android app's own notification tap already produces. Omit for
// notifications with nowhere specific to navigate (e.g. calls, which already
// surface their own always-mounted GlobalCallOverlay).
export function showDesktopNotification(title, body, tag, data) {
  if (isCapacitorApp()) return;
  if (typeof document === 'undefined') return;
  // Window/tab is visible AND focused — an in-page UI already covers this;
  // showing an OS notification too would just be a redundant duplicate.
  if (!document.hidden && document.hasFocus()) return;
  if (isTauriApp()) { sendTauriNotification(title, body, data); return null; }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/logos/trans_appletouch.png', tag });
    n.onclick = () => { window.focus(); n.close(); dispatchChatOpenFromNotification(data); };
    return n;
  } catch {
    return null;
  }
}

// Settings screen's "Send a test notification" button — deliberately skips
// the visible/focused check above (the user is, by definition, looking
// straight at the app when they tap this), unlike every other call site
// here which only ever fires for a backgrounded/unfocused window.
export function sendTestDesktopNotification(title, body) {
  if (isTauriApp()) { sendTauriNotification(title, body); return; }
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/logos/trans_appletouch.png' }); } catch {}
}
