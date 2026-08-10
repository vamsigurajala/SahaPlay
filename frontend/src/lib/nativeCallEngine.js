import { isAndroidApp } from './platform';

// Bridge to the native WhatsApp-style calling engine (see
// SahaplayCallPlugin.java, CallEngineService.java, and the plan doc). Same
// `window.Capacitor.Plugins` ambient-proxy pattern as nativeMedia.js —
// no-ops everywhere outside the native Android app (Android-gated
// specifically, not just "any Capacitor app", since this has no iOS
// equivalent yet).
//
// startNativeCall is the REAL entry point the app's own call button uses on
// Android now (see GlobalChatWidget.jsx) — CallEngineService owns the
// entire call from there: its own OutgoingCallActivity/ActiveCallActivity
// (native UI, native video), not this JS layer. initNativeCallEngine/
// setNativeCallSecretKey are what make that possible without the user ever
// having to open a debug panel — see ensureNativeCallEngineReady, called
// automatically once login + crypto are both ready.
const plugin = () => (isAndroidApp() ? window.Capacitor?.Plugins?.SahaplayCallEngine : null);

export function isNativeCallEngineAvailable() {
  return !!plugin();
}

export async function initNativeCallEngine(apiBase, token, username) {
  return plugin()?.initCallEngine({ apiBase, token, username });
}

export async function setNativeCallSecretKey(secretKeyBase64) {
  return plugin()?.setNaclSecretKey({ secretKeyBase64 });
}

export async function clearNativeCallSecretKey() {
  return plugin()?.clearNaclSecretKey();
}

// calleeDisplayName/calleeAvatarUrl are optional — pass along whatever the
// caller already has in hand (see GlobalChatWidget.jsx's activeChat) so
// OutgoingCallActivity can render immediately with no extra native fetch.
export async function startNativeCall(calleeUsername, callType = 'voice', calleeDisplayName, calleeAvatarUrl) {
  return plugin()?.startCall({ calleeUsername, callType, calleeDisplayName, calleeAvatarUrl });
}

export async function endNativeCall() {
  return plugin()?.endCallEngine();
}

// Returns an unsubscribe function, matching Capacitor's own addListener contract.
export function onNativeCallEngineStatus(callback) {
  const p = plugin();
  if (!p) return () => {};
  const handle = p.addListener('callEngineStatus', (data) => callback(data?.status));
  return () => { handle?.remove?.(); };
}
