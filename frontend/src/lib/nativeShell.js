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
const FALLBACK_INSET_PX = 24; // typical Android status bar height, used only until the real value arrives

export async function initNativeStatusBarInset() {
  const sb = statusBar();
  if (!sb) return;
  document.documentElement.style.setProperty(STATUS_BAR_INSET_VAR, `${FALLBACK_INSET_PX}px`);
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
