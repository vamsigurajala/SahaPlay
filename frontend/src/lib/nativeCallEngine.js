import { isCapacitorApp } from './platform';

// Phase 2 debug bridge to the native calling engine (see SahaplayCallPlugin.java
// and the plan doc). Same `window.Capacitor.Plugins` ambient-proxy pattern as
// nativeMedia.js — no-ops everywhere outside the native Android app.
//
// This is a TEST-ONLY entry point for now: it drives the OUTGOING call
// direction against a live callee so the crypto + WebRTC signaling round
// trip can be verified end to end. It is not wired into the app's real call
// UI yet — that only happens once the JS/native double-listener collision
// described in CallEngineService.java's class comment is resolved (Phase 6).
const plugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.SahaplayCallEngine : null);

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

export async function startNativeTestCall(calleeUsername, callType = 'voice') {
  return plugin()?.startCall({ calleeUsername, callType });
}

export async function endNativeTestCall() {
  return plugin()?.endCallEngine();
}

// Returns an unsubscribe function, matching Capacitor's own addListener contract.
export function onNativeCallEngineStatus(callback) {
  const p = plugin();
  if (!p) return () => {};
  const handle = p.addListener('callEngineStatus', (data) => callback(data?.status));
  return () => { handle?.remove?.(); };
}
