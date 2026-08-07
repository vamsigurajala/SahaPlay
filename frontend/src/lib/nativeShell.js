import { isCapacitorApp } from './platform';

// Same ambient-proxy approach as nativeMedia.js — `window.Capacitor.Plugins.<Name>`
// is populated by Capacitor's bridge for every autolinked native plugin once
// `cap sync` has run, so this needs no `@capacitor/core` import.
const statusBar = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.StatusBar : null);
const capApp = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);

// Matches index.css's --bg-color for each theme (dark: #0b0c10, light: #f7fafc)
// so the status bar reads as part of the page instead of a mismatched strip.
const THEME_COLORS = {
  dark: { backgroundColor: '#0b0c10', style: 'DARK' },
  light: { backgroundColor: '#f7fafc', style: 'LIGHT' },
};

// Capacitor's Style enum is inverted from what it sounds like: Style.Dark
// means dark *icons* (for light backgrounds), Style.Light means light icons
// (for dark backgrounds) — the opposite of THEME_COLORS' dark/light keys.
const ICON_STYLE = { dark: 'LIGHT', light: 'DARK' };

// Keeps the status bar's background/icon color in sync with the app's
// light/dark theme toggle. Config-time defaults in capacitor.config.json
// cover the very first frame before this runs; this covers every theme
// switch after that (including at launch, since App.jsx's theme effect
// calls this unconditionally on mount).
export function syncStatusBarTheme(theme) {
  const sb = statusBar();
  if (!sb) return;
  const colors = THEME_COLORS[theme] || THEME_COLORS.dark;
  sb.setBackgroundColor({ color: colors.backgroundColor }).catch(() => {});
  sb.setStyle({ style: ICON_STYLE[theme] || ICON_STYLE.dark }).catch(() => {});
}

// Without this, Capacitor's Android bridge exits the app on every hardware
// back press / edge-swipe gesture by default — it does NOT fall back to
// walking the WebView's own history the way old Cordova apps did. Since the
// app's router and useBackIntercept.js (chat/modal overlays) already push
// real history entries via the History API, deferring to window.history.back()
// when canGoBack is true recovers exactly the in-app back navigation that
// already worked in the browser/PWA context — this only needs to teach the
// native shell to use it instead of exiting immediately.
export function initNativeBackButton() {
  const app = capApp();
  if (!app) return;
  app.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      app.exitApp();
    }
  });
}

// Several hooks (usePinnedRooms, useFollowRequests, Navbar, Room) already
// refresh their data on the browser's `focus` event — meant for "the user
// switched back to this tab". That event is a browser-tab convention; it
// doesn't reliably fire just because an Android Activity resumes from the
// background/task switcher, since resuming isn't the same DOM-level signal
// a WebView necessarily replays. Capacitor's App plugin does get a real,
// dedicated 'resume' lifecycle event from Android for exactly this, so
// rebroadcasting it as a plain `focus` event makes every one of those
// existing listeners start working correctly after the app comes back from
// being backgrounded/idle, with no changes needed at each call site — this
// is the fix for "pinned/public rooms empty until I log out and back in":
// they weren't broken, they just never got told to refetch after a resume.
export function initNativeResumeBridge() {
  const app = capApp();
  if (!app) return;
  app.addListener('resume', () => {
    window.dispatchEvent(new Event('focus'));
  });
}

// CSS `env(safe-area-inset-top)` reports 0 in this Capacitor WebView (the
// Android edge-to-edge inset never gets propagated down to the page's CSS
// environment the way it does in an installed PWA), so every top-of-screen
// bar/toast/modal built against it still sat under the status bar even
// after switching from the (also broken — see StatusBarPlugin.java, its
// overlaysWebView flag is a no-op on Android 15+) native overlaysWebView
// config. StatusBar.getInfo().height, by contrast, is computed from
// WindowInsetsCompat — a real, current, non-deprecated measurement — so
// this reads it directly and republishes it as a CSS custom property every
// CSS rule in the app can use instead of the env() function.
const STATUS_BAR_INSET_VAR = '--sp-status-bar-inset';
const FALLBACK_INSET_PX = 28; // typical Android status bar height, used whenever the real value isn't available

// The fallback used to be set only after confirming the StatusBar plugin
// object exists (`if (!sb) return` before it) — meaning if that plugin was
// ever unavailable/not-yet-registered for any reason, NOTHING got set at
// all, not even the fallback, and every padding-top: var(--sp-status-bar-inset,
// 0px) rule in the app silently fell back to its own 0px default — exactly
// the "still going under the status bar, no different from before" symptom
// reported after this was already supposedly fixed. Setting the fallback
// unconditionally for isCapacitorApp() (not gated on the plugin) guarantees
// a real, non-zero inset applies regardless of whether StatusBar.getInfo()
// ever successfully resolves.
export async function initNativeStatusBarInset() {
  if (!isCapacitorApp()) return;
  document.documentElement.style.setProperty(STATUS_BAR_INSET_VAR, `${FALLBACK_INSET_PX}px`);
  const sb = statusBar();
  if (!sb) return;
  const applyRealHeight = async () => {
    try {
      const info = await sb.getInfo();
      if (typeof info?.height === 'number' && info.height > 0) {
        document.documentElement.style.setProperty(STATUS_BAR_INSET_VAR, `${info.height}px`);
      }
    } catch {}
  };
  await applyRealHeight();
  // Status bar height can change on rotation (some OEMs use a shorter bar
  // in landscape) — re-measure on resize/orientation change and app resume.
  window.addEventListener('resize', applyRealHeight);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applyRealHeight();
  });
}

// Hides the status bar during immersive mobile-fullscreen video playback
// (matching native video players — a swipe from the top edge briefly
// reveals it again, Android's default transient-bar behavior, then it
// re-hides) and restores it on exit. Best-effort: if the plugin isn't
// available this silently no-ops rather than blocking fullscreen entry.
export function setStatusBarHidden(hidden) {
  const sb = statusBar();
  if (!sb) return;
  (hidden ? sb.hide() : sb.show())?.catch?.(() => {});
}
