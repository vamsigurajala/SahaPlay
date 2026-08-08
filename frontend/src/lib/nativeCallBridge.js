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

// Call once at app startup (see main.jsx). onAnswer receives { callId }.
export function initNativeCallAnswerLink(onAnswer) {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url || !url.startsWith(DEEP_LINK_PREFIX)) return;
    const qIndex = url.indexOf('?');
    const query = qIndex >= 0 ? url.slice(qIndex + 1) : '';
    const params = new URLSearchParams(query);
    const callId = params.get('callId');
    if (callId) onAnswer({ callId });
  });
}
