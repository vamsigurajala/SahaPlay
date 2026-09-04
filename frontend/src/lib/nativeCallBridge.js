import { isCapacitorApp } from './platform';

// Bridges native call-related deep links back into the web app — mirrors
// nativeGoogleAuth.js's deep-link pattern exactly (same sahaplay:// scheme,
// same App.addListener('appUrlOpen') mechanism, same AndroidManifest.xml
// intent-filter shape), just a different host.
//
// Note: sahaplay://call-answer (fired by IncomingCallActivity's Answer
// button and the notification's own Answer action, see that file and
// CallActionReceiver.java) has no listener here anymore — it used to
// auto-accept the call the instant this link arrived, which raced the app's
// own cold start and silently did nothing when that race was lost (the real
// cause behind "tapping Answer doesn't work" reports). Firing that Intent
// already opens/foregrounds the app on its own; nothing further needs to
// happen in JS once it lands — the user just answers via GlobalCallOverlay's
// own Answer button once the app is up (see that component's and
// CallContext.jsx's own comments).
const capApp = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);

// Same deep-link mechanism as call-answer above, for the ongoing-call
// notification's End Call button (see SahaplayCallService.java) — a
// separate 'appUrlOpen' listener, filtering for its own URL prefix.
// CallContext.jsx picks this up and calls its normal endCall() directly.
const END_LINK_PREFIX = 'sahaplay://call-end';
export function initNativeCallEndLink(onEnd) {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url || !url.startsWith(END_LINK_PREFIX)) return;
    onEnd();
  });
}
