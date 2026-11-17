import { isCapacitorApp } from './platform';

// Same ambient-proxy approach as nativeMedia.js — `window.Capacitor.Plugins.<Name>`
// is populated by Capacitor's bridge for every autolinked native plugin once
// `cap sync` has run, so this needs no `@capacitor/core` import.
const statusBar = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.StatusBar : null);
const capApp = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);
const sahaplayMedia = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.SahaplayMedia : null);

// Matches index.css's --bg-color for each theme (dark: #0b0c10, light: #f7fafc)
// so the status bar reads as part of the page instead of a mismatched strip.
const THEME_COLORS = {
  dark: { backgroundColor: '#0b0c10', style: 'DARK' },
  light: { backgroundColor: '#f7fafc', style: 'LIGHT' },
};

// Keeps the status bar's background/icon color in sync with the app's
// light/dark theme toggle. Config-time defaults in capacitor.config.json
// cover the very first frame before this runs; this covers every theme
// switch after that (including at launch, since App.jsx's theme effect
// calls this unconditionally on mount).
//
// Style.Dark = dark background, light (white) icons. Style.Light = light
// background, dark icons — a direct, non-inverted match to THEME_COLORS'
// own dark/light keys (confirmed against @capacitor/status-bar's Android
// source: setStyle('DARK') calls setAppearanceLightStatusBars(false), which
// is what produces white icons). A previous version of this file routed
// through a separate, inverted ICON_STYLE lookup ('dark' theme -> 'LIGHT'
// style), which asked for dark icons on the dark theme's near-black
// background and light icons on the light theme's near-white background —
// invisible either way, matching the reported "status bar icons are white
// and invisible" bug on light theme.
export function syncStatusBarTheme(theme) {
  const sb = statusBar();
  if (!sb) return;
  const colors = THEME_COLORS[theme] || THEME_COLORS.dark;
  sb.setBackgroundColor({ color: colors.backgroundColor }).catch(() => {});
  sb.setStyle({ style: colors.style }).catch(() => {});
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

// Deep links arriving when the native app is opened via https://sahaplay.com/room/...
// or https://sahaplay.com/profile/... or custom scheme: Capacitor's App plugin receives
// 'appUrlOpen'. If the app was already running in the background, this listener navigates
// the router immediately to the clicked path instead of ignoring it.
export function initNativeDeepLinkRouter() {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url) return;
    try {
      // Ignore custom schemes handled by other specific bridges
      if (url.startsWith('sahaplay://')) return;
      const parsed = new URL(url);
      if (parsed.hostname.includes('sahaplay.com') || parsed.hostname === 'localhost') {
        const targetPath = parsed.pathname + parsed.search + parsed.hash;
        if (targetPath && targetPath !== window.location.pathname) {
          window.location.assign(targetPath);
        }
      }
    } catch (_) {}
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
// Tracks the last real measured inset so setStatusBarHidden() can restore the
// exact value on exit instead of falling back to the generic default.
let lastKnownInsetPx = FALLBACK_INSET_PX;

export async function initNativeStatusBarInset() {
  if (!isCapacitorApp()) return;
  document.documentElement.style.setProperty(STATUS_BAR_INSET_VAR, `${FALLBACK_INSET_PX}px`);
  const sb = statusBar();
  if (!sb) return;
  const applyRealHeight = async () => {
    try {
      const info = await sb.getInfo();
      if (typeof info?.height === 'number' && info.height > 0) {
        lastKnownInsetPx = info.height;
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

// Bottom-of-screen equivalent of initNativeStatusBarInset above. The app's
// edge-to-edge WebView config draws content full-bleed behind the bottom
// system navigation bar too, not just the status bar — invisible on a
// gesture-nav device (a thin, mostly-transparent pill), but on a device
// still using the classic 3-button nav bar (back/home/recents), that bar
// has real opaque height and sits on top of whatever's at the very bottom
// of the page. Reported live: the chat composer's input box becoming
// unclickable, hidden under those three buttons. CSS env(safe-area-inset-
// bottom) is the standard way a page would normally learn this, but per
// initNativeStatusBarInset's own comment, that whole env(safe-area-inset-*)
// family reports 0 in this Capacitor Android WebView — so this reads the
// real value from the custom SahaplayMedia.getNavigationBarInset() native
// method instead (see SahaplayMediaPlugin.java) and republishes it the same
// way, as a CSS custom property every bottom-anchored bar in the app can
// pad against.
const NAV_BAR_INSET_VAR = '--sp-nav-bar-inset';

export async function initNativeNavBarInset() {
  if (!isCapacitorApp()) return;
  document.documentElement.style.setProperty(NAV_BAR_INSET_VAR, '0px');
  const media = sahaplayMedia();
  if (!media) return;
  const applyRealHeight = async () => {
    try {
      const info = await media.getNavigationBarInset();
      const h = typeof info?.height === 'number' && info.height >= 0 ? info.height : 0;
      document.documentElement.style.setProperty(NAV_BAR_INSET_VAR, `${h}px`);
    } catch {}
  };
  await applyRealHeight();
  // The 3-button nav bar can appear/disappear independent of rotation (some
  // OEMs let it auto-hide, or the user can switch gesture-nav <-> 3-button
  // from Settings without restarting the app) — re-measure on the same
  // signals the status-bar inset already re-measures on.
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
//
// Also zeroes the --sp-status-bar-inset CSS var while hidden: App.jsx's
// global status-bar scrim reads that var to paint an opaque strip across the
// very top of the page, above even the fullscreen video player. With the
// real status bar hidden there's nothing left to cover, so leaving the var
// at its normal value just cut a visible bar across the top of the video.
export function setStatusBarHidden(hidden, keepInsetZero = false) {
  // Was unconditional — on a plain mobile browser tab (no Capacitor, no
  // status bar to hide/show at all), Room.jsx's setStatusBarHidden(false)
  // calls (fullscreen exit, mount, etc.) still wrote a hardcoded 28px
  // (FALLBACK_INSET_PX — this value never gets replaced with a real
  // measurement outside Capacitor) into --sp-status-bar-inset. That's a
  // plain inline style on <html>, so it persists across the whole SPA
  // session once set — explaining the gap that only appears after visiting
  // a room and never clears until a real page reload, on EVERY page in the
  // app (every element that reads this var, not just Room's own UI).
  if (!isCapacitorApp()) return;
  document.documentElement.style.setProperty(STATUS_BAR_INSET_VAR, (hidden || keepInsetZero) ? '0px' : `${lastKnownInsetPx}px`);
  const sb = statusBar();
  if (!sb) return;
  try {
    const opts = { animation: 'fade' };
    (hidden ? sb.hide(opts) : sb.show(opts))?.catch?.(() => {
      (hidden ? sb.hide() : sb.show())?.catch?.(() => {});
    });
  } catch (_) {
    (hidden ? sb.hide() : sb.show())?.catch?.(() => {});
  }
}
