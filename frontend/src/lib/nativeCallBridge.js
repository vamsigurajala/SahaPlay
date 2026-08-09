import { isCapacitorApp } from './platform';

// Bridges IncomingCallActivity.java's "Answer" button (and its notification
// action) back into the web app — mirrors nativeGoogleAuth.js's deep-link
// pattern exactly (same sahaplay:// scheme, same App.addListener('appUrlOpen')
// mechanism, same AndroidManifest.xml intent-filter shape), just a different
// host. Capacitor's App plugin replays the LAUNCHING intent too, not just
// later resumes, so this also fires correctly when tapping Answer cold-starts
// the app from fully killed — the same guarantee the Google auth callback
// already relies on.
const capApp = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);
const DEEP_LINK_PREFIX = 'sahaplay://call-answer';

// Call once at app startup (see main.jsx) — this runs BEFORE React mounts
// (main.jsx calls it ahead of createRoot().render()). Capacitor replays the
// app's launching intent to a freshly-registered 'appUrlOpen' listener, not
// just later resumes, which means a cold start via the Answer button can
// have this fire before CallContext.jsx has mounted its own
// 'native_call_answer' DOM listener — a plain CustomEvent dispatched with no
// listener yet attached is just lost, silently dropping the answer. Stashing
// the callId on `window` as well, synchronously, before dispatching, gives
// CallContext something to check for on its own mount regardless of which
// side won that race. onAnswer receives { callId }.
export function initNativeCallAnswerLink(onAnswer) {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url || !url.startsWith(DEEP_LINK_PREFIX)) return;
    const qIndex = url.indexOf('?');
    const query = qIndex >= 0 ? url.slice(qIndex + 1) : '';
    const params = new URLSearchParams(query);
    const callId = params.get('callId');
    if (!callId) return;
    window.__sahaplayPendingCallAnswer = callId;
    onAnswer({ callId });
  });
}

// CallContext.jsx calls this once on mount to pick up an answer that arrived
// before its own event listener was attached (see the race explained above).
// Deliberately a non-destructive peek, not a consume - GlobalCallOverlay.jsx
// also reads this (via isPendingNativeCallAnswer below) for as long as the
// matching call is still ringing, to suppress its own Answer/Decline prompt
// in favor of a plain "Connecting…" state. Showing that prompt at all after
// the user already tapped Answer once natively is the "how many times do I
// have to click Answer" bug this exists to prevent - even if the auto-accept
// below ends up delayed for some reason, the user is never asked to answer
// the same call a second time. Cleared via clearPendingNativeCallAnswer()
// once the call actually connects or ends (see CallContext.jsx's acceptCall
// and teardownCall), so it can't wrongly suppress a later, unrelated call.
export function peekPendingNativeCallAnswer() {
  return window.__sahaplayPendingCallAnswer || null;
}

export function isPendingNativeCallAnswer(callId) {
  return !!callId && window.__sahaplayPendingCallAnswer === callId;
}

export function clearPendingNativeCallAnswer() {
  delete window.__sahaplayPendingCallAnswer;
}

// Same deep-link mechanism as call-answer above, for the ongoing-call
// notification's End Call button (see SahaplayCallService.java) — a
// separate 'appUrlOpen' listener registered alongside the answer one
// (Capacitor supports multiple listeners for the same event; each just
// filters for its own URL prefix). No pending-state stash needed here the
// way answer has one: ending an already-connected call doesn't have the
// same "which screen shows what" race, CallContext.jsx just calls its
// normal endCall() directly.
const END_LINK_PREFIX = 'sahaplay://call-end';
export function initNativeCallEndLink(onEnd) {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url || !url.startsWith(END_LINK_PREFIX)) return;
    onEnd();
  });
}
