// deviceAssertion.js
//
// Signs/verifies short "device enrollment assertions" — the mechanism the
// Android/Windows E2EE device-unlock feature uses to prove to NATIVE code
// (which cannot verify the app's own HS256 session JWT_SECRET without
// shipping that secret into the APK/exe) that a request for a given
// account's locally-wrapped E2EE key comes from a session the SERVER has
// actually, recently, authenticated.
//
// Why this exists at all (see the Stage 2 security review this closes):
// native code decoding a session JWT's payload WITHOUT verifying its
// signature provides no real proof of identity — any script running in the
// WebView/webview-equivalent can fabricate an unsigned-but-well-formed
// token claiming an arbitrary account id. On a device where a SECOND
// account has also enrolled Device Unlock, that lets a compromised page
// trigger a real OS biometric prompt scoped to someone else's key. This
// assertion closes that gap with real, offline-verifiable asymmetric
// signatures, without ever putting the signing secret on-device.
//
// Deliberately a SEPARATE keypair from JWT_SECRET (which stays HS256,
// symmetric, unchanged, and must never leave the server) — this one is
// asymmetric (ECDSA P-256 / "ES256") specifically because its PUBLIC half
// is meant to be embedded in client binaries (APK, .exe) where it is safe
// to disclose (same trust model as a pinned TLS certificate), which an
// HS256 secret could never be.
//
// Wire format (deliberately NOT a JWT — no library, no alg-confusion
// surface, just three base64url segments the native side parses with
// plain string splitting):
//   base64url(header_json) + '.' + base64url(payload_json) + '.' + base64url(der_signature)
// header:  { alg: 'ES256', typ: 'SPDA' }   (SahaPlay Device Assertion)
// payload: { id: <numeric account id>, username: <string, informational>, exp: <unix seconds> }
// signature: ECDSA-SHA256 (Node's default DER encoding for EC keys) over
//            the UTF-8 bytes of "base64url(header).base64url(payload)" —
//            DER is deliberately kept (not converted to JOSE's raw r||s
//            form) because java.security.Signature.getInstance
//            ("SHA256withECDSA") on Android verifies DER-encoded
//            signatures directly, with zero extra parsing/conversion code
//            needed on either side.

const crypto = require('crypto');

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Signs a device enrollment assertion for one account.
 *
 * @param {{ id: number|string, username: string }} account
 * @param {string} privateKeyPem  PKCS8 PEM, EC (prime256v1/P-256)
 * @param {number} [validitySeconds=86400]  24h default — see the
 *   architecture doc's discussion of why this is cached client-side
 *   rather than fetched fresh on every unlock: it needs to outlive a
 *   reasonable "app used again a bit later, still offline" gap while
 *   still bounding how long a copied/leaked assertion stays useful.
 * @returns {string} the compact assertion string
 */
function signDeviceAssertion(account, privateKeyPem, validitySeconds = 86400) {
  if (account == null || account.id == null) {
    throw new Error('signDeviceAssertion: account.id is required');
  }
  const header = { alg: 'ES256', typ: 'SPDA' };
  const payload = {
    id: typeof account.id === 'string' ? Number(account.id) : account.id,
    username: account.username || null,
    exp: Math.floor(Date.now() / 1000) + validitySeconds,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Node's default dsaEncoding for an EC key is 'der' — the same encoding
  // java.security.Signature's SHA256withECDSA produces/expects, so no
  // format conversion is needed on the Android side.
  const signature = crypto.sign('SHA256', Buffer.from(signingInput, 'utf8'), {
    key: privateKeyPem,
    dsaEncoding: 'der',
  });

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Verifies a device enrollment assertion. Provided for parity/testing on
 * the Node side — the actual security-relevant verification happens
 * on-device (native Java/Kotlin), independently implementing the same
 * check against the embedded public key. Returns the decoded payload on
 * success, or null on any failure (malformed, bad signature, expired) —
 * deliberately never throws, so callers can treat every failure mode
 * uniformly.
 *
 * @param {string} assertion
 * @param {string} publicKeyPem  SPKI PEM, EC (prime256v1/P-256)
 * @returns {{id: number, username: string|null, exp: number}|null}
 */
function verifyDeviceAssertion(assertion, publicKeyPem) {
  if (typeof assertion !== 'string') return null;
  const parts = assertion.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(base64urlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (!header || header.alg !== 'ES256') return null;
  if (!payload || typeof payload.id !== 'number' || typeof payload.exp !== 'number') return null;

  let signature;
  try {
    signature = base64urlDecode(sigB64);
  } catch {
    return null;
  }

  let sigValid = false;
  try {
    sigValid = crypto.verify(
      'SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
      { key: publicKeyPem, dsaEncoding: 'der' },
      signature
    );
  } catch {
    return null;
  }
  if (!sigValid) return null;

  if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired

  return payload;
}

module.exports = {
  signDeviceAssertion,
  verifyDeviceAssertion,
};
