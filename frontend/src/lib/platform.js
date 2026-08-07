// `window.__TAURI_INTERNALS__` is the low-level IPC bridge Tauri v2 always injects
// into the webview, regardless of the `app.withGlobalTauri` config flag (which this
// project doesn't set, so the higher-level `window.__TAURI__` global isn't present).
// This is the same check `@tauri-apps/api/core`'s own `isTauri()` uses internally —
// using it directly here avoids adding that package as a runtime dependency of the
// web frontend, which otherwise only ships `@tauri-apps/cli` as a dev/build tool.
export function isTauriApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// `window.Capacitor` is injected by the native shell before the page loads,
// same mechanism as `__TAURI_INTERNALS__` above — checking it directly here
// (rather than importing `@capacitor/core`'s own `isNativePlatform()`) keeps
// the web frontend from picking up a new runtime dependency just to detect
// its own host, matching the Tauri check's rationale.
export function isCapacitorApp() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

// Detects the installed-PWA / Android TWA / Capacitor context so app-shell
// chrome (like the bottom nav bar and the centered script wordmark) renders
// only there, never in a regular mobile browser tab. Four signals, since no
// single one covers every launch path: `display-mode: standalone` covers
// installed PWAs and Chrome TWAs, `navigator.standalone` is Safari's
// pre-standard iOS equivalent, the `android-app://` referrer is Google's
// documented way to confirm a TWA launch specifically (Play-installed TWAs
// can report display-mode oddly on some OEM builds, so this is a useful
// fallback signal, not redundant), and `isCapacitorApp()` covers the native
// wrapper — a Capacitor WebView is its own distinct launch mechanism that
// trips none of the other three (no PWA display-mode, no TWA referrer), so
// without it every "installed app" UI treatment silently never activated
// there and the app rendered exactly like a plain mobile browser tab.
export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://') ||
    isCapacitorApp()
  );
}
