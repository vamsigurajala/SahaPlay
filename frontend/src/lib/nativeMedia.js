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

// setBrightness above always pins the window to a real value — there is no
// value that means "stop overriding". Call this once the brightness gesture
// is done with (leaving fullscreen, leaving the room) so the window's real
// brightness override actually clears and the phone's own current system
// brightness shows again, instead of staying stuck at whatever the gesture
// last set it to (previously: forever, until the app process was killed).
export function resetNativeBrightness() {
  plugin()?.resetBrightness().catch(() => {});
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

// Resolves CAMERA + RECORD_AUDIO runtime permissions BEFORE any call setup
// begins — see CallContext.jsx's startCall/acceptCall, which await this
// first thing now. Without it, the WebView's own reactive getUserMedia()
// permission prompt could arrive AFTER startNativeCallService() below had
// already tried to start a foreground service declared with
// foregroundServiceType="microphone|camera" — Android 14+ hard-crashes the
// whole app in that race, which is what made answering/placing a call
// sometimes "get stuck and close" right after granting the permission.
//
// Deliberately calls getUserMedia() directly rather than going through
// SahaplayMediaPlugin's own custom @Permission alias / requestPermissionForAlias
// mechanism (a prior version of this function did) — that path was
// confirmed, via bundletool dump manifest against a real shipped .aab, to
// NOT be a manifest-declaration problem (CAMERA/RECORD_AUDIO are correctly
// declared) but still silently resolved to "not granted" on a genuinely
// fresh install without Android's system dialog ever appearing, which is
// not something the OS can legitimately do for a manifest-declared
// permission on its first-ever request. getUserMedia(), by contrast, goes
// through Capacitor's own well-established WebView permission bridge
// (BridgeWebChromeClient.onPermissionRequest) — the exact same real Android
// system dialog every other WebView-based camera/mic prompt uses, matching
// how the push-notification permission prompt already looks. The tracks
// are stopped immediately after — this call exists purely to resolve the
// permission and confirm hardware access works, not to keep the camera/mic
// open.
//
// navigator.permissions.query is tried first (no hardware activation) so
// this doesn't re-flash the camera/mic on every single call once already
// granted — only the very first grant (or a retry after denial) actually
// opens the camera/mic briefly.
//
// Resolves true on every non-Capacitor platform (plain web/PWA/desktop),
// where the browser's own getUserMedia prompt is the only thing that exists
// and this whole class of bug doesn't apply.
export async function ensureNativeMediaPermissions() {
  if (!isCapacitorApp()) return true;
  try {
    if (navigator.permissions?.query) {
      const [cam, mic] = await Promise.all([
        navigator.permissions.query({ name: 'camera' }).catch(() => null),
        navigator.permissions.query({ name: 'microphone' }).catch(() => null),
      ]);
      if (cam?.state === 'granted' && mic?.state === 'granted') return true;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function ensureNativeCameraPermissions() {
  if (!isCapacitorApp()) {
    try {
      if (navigator.permissions?.query) {
        const cam = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
        if (cam?.state === 'granted') return true;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }
  try {
    const result = await plugin()?.ensureCameraPermissions();
    return !!result?.granted;
  } catch {
    return false;
  }
}

// Explicit photos/files permission, requested before the gallery button
// (inside the in-app camera screen) or the composer's paperclip button opens
// the actual file chooser — see requestPhotoAccess() in mediaPermissionGate.js.
// Unlike camera/mic, there's no browser API this permission maps to (storage
// access has no WebView-recognized "web permission" counterpart the way
// camera/mic do via getUserMedia), so this goes through
// SahaplayMediaPlugin's own @Permission alias / requestPermissionForAlias —
// the standard Capacitor mechanism, not a workaround like
// ensureNativeMediaPermissions above needed.
export async function ensureNativePhotoPermissions() {
  if (!isCapacitorApp()) return true;
  try {
    const result = await plugin()?.ensurePhotoPermissions();
    return !!result?.granted;
  } catch {
    return false;
  }
}

// Opens this app's own "App info" page in the system Settings app — the
// only way to grant CAMERA/RECORD_AUDIO once the user has already denied
// the in-app prompt (Android stops showing its own permission dialog after
// that, see SahaplayMediaPlugin.openAppSettings). Used by
// MediaPermissionModal.jsx's "Open Settings" fallback button.
export function openNativeAppSettings() {
  return plugin()?.openAppSettings().catch(() => {}) ?? Promise.resolve();
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
// username is THIS device's own logged-in account, callId is the call this
// notification represents — the ongoing-call notification's Hang Up button
// (see SahaplayCallService.java / CallActionReceiver.java) needs both to
// tell the backend WHO is leaving WHICH call, entirely natively, without
// needing the JS/socket layer to be alive.
export function startNativeCallService(peerName, startedAtMillis, status = 'active', username, callId) {
  plugin()?.startCallForegroundService({ peerName, startedAtMillis, status, username, callId }).catch(() => {});
}

export function stopNativeCallService() {
  plugin()?.stopCallForegroundService().catch(() => {});
}
