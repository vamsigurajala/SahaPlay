// `window.__TAURI_INTERNALS__` is the low-level IPC bridge Tauri v2 always injects
// into the webview, regardless of the `app.withGlobalTauri` config flag (which this
// project doesn't set, so the higher-level `window.__TAURI__` global isn't present).
// This is the same check `@tauri-apps/api/core`'s own `isTauri()` uses internally —
// using it directly here avoids adding that package as a runtime dependency of the
// web frontend, which otherwise only ships `@tauri-apps/cli` as a dev/build tool.
export function isTauriApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
