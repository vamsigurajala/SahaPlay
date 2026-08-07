import { isCapacitorApp } from './platform';

// Google actively blocks its own OAuth sign-in screen inside ANY embedded
// WebView user agent (an anti-phishing policy, not a bug on our end) — the
// web <GoogleLogin> button's popup/iframe silently fails to show an account
// picker inside the Capacitor-wrapped app for exactly this reason. The fix
// is to run the OAuth flow in a real Chrome Custom Tab instead (opened via
// @capacitor/browser), which Google treats as a normal browser. Since our
// existing Google OAuth client is a *web* client type, Google requires an
// https redirect_uri for the first hop — GoogleAuthCallback.jsx (a real page
// on our own domain) receives it there and immediately hands off to the
// native app via the sahaplay://auth-callback deep link this file listens
// for, which AndroidManifest.xml registers an intent-filter for.
const browser = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.Browser : null);
const capApp = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.App : null);

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_REDIRECT_URI = 'https://sahaplay.com/auth/google/callback';
const DEEP_LINK_PREFIX = 'sahaplay://auth-callback';

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Opens Google's OAuth consent screen in a system Custom Tab. Uses the
// implicit id_token flow (response_type=id_token) rather than an
// authorization-code exchange — it needs no client secret and no backend
// round-trip for the redirect leg, and returns exactly the same kind of
// Google-signed ID token the existing web flow already sends to
// /api/auth/google, so that endpoint needs no changes at all.
export function openNativeGoogleSignIn(clientId) {
  const b = browser();
  if (!b || !clientId) return false;
  const nonce = randomToken();
  const state = randomToken();
  sessionStorage.setItem('google_oauth_nonce', nonce);
  sessionStorage.setItem('google_oauth_state', state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    state,
    prompt: 'select_account',
  });
  b.open({ url: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}` }).catch(() => {});
  return true;
}

// Registers the deep-link listener that catches the app resuming via
// sahaplay://auth-callback (see AndroidManifest.xml's intent-filter and
// GoogleAuthCallback.jsx, which is what actually navigates to that URI).
// Call once at app startup; onIdToken receives the same kind of Google ID
// token the web flow's onSuccess handler already gets.
export function initNativeGoogleAuthCallback(onIdToken) {
  const app = capApp();
  if (!app) return;
  app.addListener('appUrlOpen', ({ url }) => {
    if (!url || !url.startsWith(DEEP_LINK_PREFIX)) return;
    browser()?.close?.().catch(() => {});
    const qIndex = url.indexOf('?');
    const query = qIndex >= 0 ? url.slice(qIndex + 1) : '';
    const params = new URLSearchParams(query);
    const idToken = params.get('id_token');
    const state = params.get('state');
    const expectedState = sessionStorage.getItem('google_oauth_state');
    sessionStorage.removeItem('google_oauth_nonce');
    sessionStorage.removeItem('google_oauth_state');
    const error = params.get('error');
    if (error) return; // user closed/cancelled the Custom Tab — no-op, not an error toast
    if (idToken && state && expectedState && state === expectedState) {
      onIdToken(idToken);
    }
  });
}
