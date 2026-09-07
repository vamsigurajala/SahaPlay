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

// Rebroadcasts main.rs's show_windows_toast command's own 'open_chat_from_
// notification' Tauri event (emitted from its Toast::on_activated callback —
// see that command's comment) into the same browser CustomEvent every other
// notification-tap path here already dispatches, so Navbar.jsx/Room.jsx need
// no Tauri-specific code to react to it. Registered once, for the app's
// lifetime — a click can happen long after this page "loaded" in the usual
// sense, since the window may have been hidden/backgrounded the whole time.
//
// This — not @tauri-apps/plugin-notification's JS-side onAction — is what
// actually reacts to a Windows toast click. That plugin's own docs say its
// click/Actions callback "is only available on mobile platforms": on
// Windows a toast built through it shows fine but a click on it is never
// relayed back to JS at all, which is why clicking previously did nothing —
// not even focusing the window, let alone opening a chat. main.rs's window
// focus/show calls run directly in Rust for the same reason: no JS callback
// exists to do it from this side.
let tauriEventListenerRegistered = false;
function registerTauriEventBridge() {
  if (tauriEventListenerRegistered) return;
  tauriEventListenerRegistered = true;
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('open_chat_from_notification', (event) => {
      dispatchChatOpenFromNotification(event.payload);
    }).catch((e) => console.error('[desktopNotify] failed to listen for open_chat_from_notification', e));
    // main.rs's show_windows_toast reports its own Toast::show() outcome
    // here — the release build has no attached console for its own
    // eprintln! to reach, so without this, a Rust-side failure (e.g. an
    // AUMID/COM error) would be completely invisible even with devtools
    // open, showing only as "I never got a notification."
    listen('show_windows_toast_result', (event) => {
      if (event.payload?.ok) console.debug('[desktopNotify] Toast::show succeeded');
      else console.error('[desktopNotify] Toast::show failed (Rust side)', event.payload?.error);
    }).catch((e) => console.error('[desktopNotify] failed to listen for show_windows_toast_result', e));
  }).catch((e) => console.error('[desktopNotify] @tauri-apps/api/event failed to load', e));
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
    registerTauriEventBridge();
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

// Every step here used to fail silently (a bare .catch(() => {})), which
// made "why didn't a notification show up" undiagnosable on an installed
// build with no console access. Logged with a consistent prefix instead —
// Cargo.toml now enables the devtools feature specifically so these are
// actually visible (right-click -> Inspect, or Ctrl+Shift+I).
function sendTauriNotification(title, body, data) {
  getTauriNotify().then(async (mod) => {
    if (!mod) { console.error('[desktopNotify] @tauri-apps/plugin-notification failed to load'); return; }
    let granted;
    try {
      granted = await mod.isPermissionGranted();
    } catch (e) {
      console.error('[desktopNotify] isPermissionGranted() threw', e);
      return;
    }
    if (!granted) { console.warn('[desktopNotify] notification permission not granted, skipping'); return; }
    // Invokes main.rs's show_windows_toast command instead of this
    // plugin's own sendNotification — see registerTauriEventBridge's
    // comment above for why: this plugin's JS click callback never fires
    // on Windows, so the actual toast has to be built through
    // tauri-winrt-notification directly (in Rust) to get a working click
    // handler at all. Still using this plugin for permission
    // check/request just above, which works fine independent of that.
    import('@tauri-apps/api/core').then(({ invoke }) => {
      // data is passed through opaquely — main.rs's on_activated callback
      // just re-emits whatever it is verbatim, same as the browser
      // Notification path just holds onto it. Covers both the chat-tap
      // shape ({chatId, type}) and the friend-request shape ({type,
      // username}) without this file needing to know either one.
      invoke('show_windows_toast', { title, body, data: data || null })
        .catch((e) => console.error('[desktopNotify] show_windows_toast invoke failed', e));
    }).catch((e) => console.error('[desktopNotify] @tauri-apps/api/core failed to load', e));
  }).catch((e) => console.error('[desktopNotify] getTauriNotify() rejected', e));
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

// data: optional { chatId, type } — when present, clicking the notification
// (or the Tauri toast) dispatches 'open_chat_from_notification' so
// BottomNav.jsx/Navbar.jsx open that exact chat, the same event the native
// Android app's own notification tap already produces. Omit for
// notifications with nowhere specific to navigate (e.g. calls, which already
// surface their own always-mounted GlobalCallOverlay).
export function showDesktopNotification(title, body, tag, data) {
  if (isCapacitorApp()) return;
  if (typeof document === 'undefined') return;
  if (isTauriApp()) {
    isTauriWindowActuallyOnScreen().then((onScreen) => {
      if (!onScreen) sendTauriNotification(title, body, data);
    });
    return null;
  }
  // Window/tab is visible AND focused — an in-page UI already covers this;
  // showing an OS notification too would just be a redundant duplicate.
  if (!document.hidden && document.hasFocus()) return;
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
