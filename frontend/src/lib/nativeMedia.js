import { isCapacitorApp } from './platform';

// Calls the native SahaplayMedia plugin directly off the ambient
// `window.Capacitor.Plugins` proxy the Capacitor bridge exposes for every
// registered native plugin, instead of importing `registerPlugin` from
// `@capacitor/core` — keeps this from adding a new runtime dependency to the
// web bundle, same rationale as `isTauriApp()`/`isCapacitorApp()` in
// `./platform`. No-ops everywhere outside a Capacitor-wrapped native app
// (plain web, PWA, TWA, desktop) — those keep using the existing simulated
// video-volume / CSS-dim fallback in Room.jsx untouched.
const plugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.SahaplayMedia : null);

export function setNativeVolume(value) {
  plugin()?.setVolume({ value }).catch(() => {});
}

export function setNativeBrightness(value) {
  plugin()?.setBrightness({ value }).catch(() => {});
}

export async function getNativeVolume() {
  try {
    const result = await plugin()?.getVolume();
    return typeof result?.value === 'number' ? result.value : null;
  } catch {
    return null;
  }
}
