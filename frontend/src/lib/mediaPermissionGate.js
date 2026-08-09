import { isCapacitorApp } from './platform';
import { ensureNativeMediaPermissions } from './nativeMedia';

// Single choke point every camera/mic-touching feature (1:1 calls in
// CallContext.jsx, joining a room / toggling video-mic in Room.jsx, the
// device-test previews in AppSettings.jsx) should await before doing
// anything that needs the camera or microphone, on the Capacitor app.
//
// Why this exists instead of each call site just calling
// ensureNativeMediaPermissions() directly and toast.error()-ing on
// failure: a toast tells the user access is missing but gives them no way
// to actually grant it — the WebView's own getUserMedia() prompt only
// fires once per origin per permission and never reappears after a denial,
// so without this there was literally no in-app path back to "allow it"
// short of finding Settings manually. This dispatches a DOM event that
// MediaPermissionModal.jsx (mounted once, globally, in App.jsx) listens
// for, shows a real retry/Open-Settings UI, and resolves this promise once
// the user either grants access or gives up.
//
// No-ops to true on every non-Capacitor platform (plain web/PWA/desktop) —
// those keep relying on the browser's own getUserMedia prompt and existing
// per-call-site toasts, unchanged.
export async function requestMediaAccess() {
  if (!isCapacitorApp()) return true;
  const granted = await ensureNativeMediaPermissions();
  if (granted) return true;
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('media_permission_needed', { detail: { resolve } }));
  });
}
