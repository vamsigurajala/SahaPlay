// Thin wrapper around Apple's "Sign in with Apple JS" SDK (loaded via <script> tag
// in index.html). Mirrors the role @react-oauth/google plays for Google — resolves
// with an { authorization: { id_token, code, state }, user? } object that callers
// POST straight to the backend, same shape as Google's credentialResponse.
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || 'YOUR_APPLE_SERVICES_ID_HERE';

let initialized = false;

function waitForAppleSDK(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (window.AppleID) return resolve(window.AppleID);
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.AppleID) {
        clearInterval(interval);
        resolve(window.AppleID);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Apple Sign-In script failed to load'));
      }
    }, 100);
  });
}

// Apple requires the redirect URI to exactly match one registered on the Services ID.
// It's never actually navigated to in the popup flow, so a single fixed path works
// regardless of whether sign-in was triggered from /login or /signup.
export async function signInWithApple() {
  const AppleID = await waitForAppleSDK();
  if (!initialized) {
    AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: 'name email',
      redirectURI: `${window.location.origin}/login`,
      usePopup: true,
    });
    initialized = true;
  }
  return AppleID.auth.signIn();
}
