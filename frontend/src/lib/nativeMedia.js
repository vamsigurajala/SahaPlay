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

// Mirrors the current light/dark theme into native SharedPreferences (see
// SahaplayMediaPlugin.setThemePreference) so IncomingCallActivity.java can
// match it even when the WebView/JS layer has never run in this app launch
// (answering a call while the app was fully killed).
export function setNativeThemePreference(theme) {
  plugin()?.setThemePreference({ theme }).catch(() => {});
}

// Starts/stops SahaplayCallService — the foreground service + persistent
// notification that keeps a call's WebRTC connections (and JS/socket layer)
// alive while the app is backgrounded. See CallContext.jsx, which calls this
// as soon as a call is placed/ringing (status: 'ringing' — no elapsed time
// yet, just a "Calling…"/Cancel notification) and again once it connects
// (status: 'active' — live duration Chronometer, full-width End Call).
// Starting it for the ringing phase too (not just once active) is what keeps
// a backgrounded CALLER's app from being suspended before it can receive
// 'call:declined'/'call:answered' over the socket.
export function startNativeCallService(peerName, startedAtMillis, status = 'active') {
  plugin()?.startCallForegroundService({ peerName, startedAtMillis, status }).catch(() => {});
}

export function stopNativeCallService() {
  plugin()?.stopCallForegroundService().catch(() => {});
}
