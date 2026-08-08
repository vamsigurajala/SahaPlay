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

// The web screen.orientation.lock() API silently no-ops on Android whenever
// the device's system auto-rotate toggle is off — a common default, and the
// real reason fullscreen landscape never actually rotated the device no
// matter how the JS-side lock-state tracking was fixed. This calls the
// native Activity's setRequestedOrientation() instead (see
// SahaplayMediaPlugin.lockOrientation), which forces a real rotation
// regardless of that toggle, the same way YouTube/Netflix's own native
// players do. value is 'landscape' | 'portrait'.
export function setNativeOrientation(value) {
  plugin()?.lockOrientation({ value }).catch(() => {});
}

export function unlockNativeOrientation() {
  plugin()?.unlockOrientation().catch(() => {});
}

// Real call-audio output routing (earpiece / speaker / bluetooth headset) —
// same "no browser API for this" gap as volume/brightness. Used by
// CallContext/GlobalCallOverlay's in-call speaker button; a no-op everywhere
// outside the Capacitor app, where the WebView's own default WebRTC audio
// routing (earpiece-by-default via Chromium) is all that's available.
export function setNativeAudioRoute(route) {
  plugin()?.setAudioRoute({ route }).catch(() => {});
}

export async function isNativeBluetoothAudioAvailable() {
  try {
    const result = await plugin()?.getAvailableAudioRoutes();
    return !!result?.bluetoothAvailable;
  } catch {
    return false;
  }
}

// Called once a call ends — restores AudioManager's normal (non-VoIP) mode
// so nothing about the phone's audio routing lingers changed for whatever
// the user does next (media playback, other calls, etc).
export function resetNativeAudioRoute() {
  plugin()?.setAudioRoute({ route: 'normal' }).catch(() => {});
}
