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

export function ensureDesktopNotifyPermission() {
  if (isCapacitorApp() || desktopNotifyPermissionRequested) return;
  desktopNotifyPermissionRequested = true;
  if (isTauriApp()) {
    getTauriNotify().then(async (mod) => {
      if (!mod) return;
      const granted = await mod.isPermissionGranted();
      if (!granted) await mod.requestPermission();
    }).catch(() => {});
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

function sendTauriNotification(title, body) {
  getTauriNotify().then(async (mod) => {
    if (!mod) return;
    const granted = await mod.isPermissionGranted();
    if (!granted) return;
    mod.sendNotification({ title, body });
  }).catch(() => {});
}

export function showDesktopNotification(title, body, tag) {
  if (isCapacitorApp()) return;
  if (typeof document === 'undefined') return;
  // Window/tab is visible AND focused — an in-page UI already covers this;
  // showing an OS notification too would just be a redundant duplicate.
  if (!document.hidden && document.hasFocus()) return;
  if (isTauriApp()) { sendTauriNotification(title, body); return null; }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/logos/trans_appletouch.png', tag });
    n.onclick = () => { window.focus(); n.close(); };
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
