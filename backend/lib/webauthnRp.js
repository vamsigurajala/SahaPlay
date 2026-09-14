// webauthnRp.js
//
// Minimal WebAuthn relying-party layer for the browser "Remember this
// browser" E2EE device-unlock feature (see the architecture doc this
// implements: PRF -> HKDF-SHA256 -> AES-256-GCM, entirely client-side).
//
// This module deliberately does NOT hand-roll any WebAuthn cryptography —
// attestation/assertion signature verification, CBOR/COSE key parsing, and
// challenge-vs-response matching are all delegated to @simplewebauthn/server
// (a widely used, actively maintained implementation of that spec), the
// same discipline deviceAssertion.js already follows for the Android/
// Windows device-unlock assertion (real ECDSA via Node's own `crypto`
// module, never a hand-written signature check). What this module adds on
// top is just:
//   1. A short-lived, single-use, per-account challenge store — WebAuthn
//      itself only requires "the response must echo back the challenge you
//      issued," it doesn't supply storage or replay protection.
//   2. This app's RP identity (name/id/allowed origins), read from env vars
//      the same way DEVICE_ASSERTION_PRIVATE_KEY already is, so this file
//      has no hardcoded production domain.
//
// Deliberately does NOT touch the database — device_credentials row
// storage (accountId, credentialId, public key, counter) lives in
// deviceCredentialsStore.js, called from server.js's routes. Keeping this
// module DB-free is what makes it unit-testable without a live Postgres
// connection (see tests/webauthnRp.test.js), matching deviceAssertion.js's
// own precedent — none of its own tests touch a database either.
//
// SECURITY NOTE: this module never sees, derives, or stores the account's
// E2EE secret key, the WebAuthn PRF output, or any wrapping key — it only
// confirms a genuine WebAuthn ceremony happened and was signed by a
// previously-registered credential. The actual E2EE key material is
// wrapped/unwrapped entirely client-side — see
// frontend/src/lib/browserDeviceUnlock.js.

const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

class WebauthnRpError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'WebauthnRpError';
    this.code = code;
  }
}

function getRpConfig() {
  // WEBAUTHN_RP_ID must be the bare domain (no scheme/port) the frontend is
  // served from — e.g. "sahaplay.com" in production. WEBAUTHN_ORIGIN is the
  // full origin(s) browsers report in clientDataJSON — comma-separated so
  // both the production domain and a local dev origin can be configured at
  // once without a redeploy. Defaults keep local dev/testing working with
  // zero env-var setup, exactly like JWT_SECRET's own dev fallback.
  const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  const rpName = process.env.WEBAUTHN_RP_NAME || 'SahaPlay';
  const origins = (process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean);
  return { rpID, rpName, origins };
}

// ─── Challenge store ────────────────────────────────────────────────────
// In-memory, keyed by `${accountId}:${type}` — the same in-process-Map
// convention server.js already uses for inFlightAssertionFetches /
// publicKeyCache / adminRoleCache. A challenge only needs to survive one
// immediate client round trip (options -> ceremony -> verify), never a
// server restart, so no persistence is needed here — the one tradeoff (a
// horizontally-scaled multi-instance deployment would need a shared store,
// e.g. Redis) is the same one those existing in-memory maps already accept.
const CHALLENGE_TTL_MS = 5 * 60_000; // generous enough for a slow biometric
// prompt; short enough that a leaked/logged challenge is worthless well
// before anyone could act on it.

const challenges = new Map(); // `${accountId}:${type}` -> { challenge, expiresAt }

function challengeKey(accountId, type) {
  return `${accountId}:${type}`;
}

function storeChallenge(accountId, type, challenge) {
  challenges.set(challengeKey(accountId, type), {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

// Single-use: consuming an entry (whether it turns out valid or not)
// deletes it immediately, so a captured/replayed response can never verify
// twice even inside the TTL window — this is the actual replay protection;
// the TTL alone only bounds how long a NEVER-consumed challenge stays live.
function consumeChallenge(accountId, type) {
  const key = challengeKey(accountId, type);
  const entry = challenges.get(key);
  challenges.delete(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry.challenge;
}

// Test-only escape hatch so each test file/case starts from a clean store
// without waiting out the real TTL — no production caller uses this.
function _resetChallengesForTests() {
  challenges.clear();
}

// A stable, non-guessable per-account WebAuthn user handle — deliberately
// NOT the raw numeric accountId (would leak account-enumeration info into
// the credential itself) and NOT the username (which can change — see
// usernameRename.test.js elsewhere in this suite). Deterministic so the
// SAME handle comes back on every registration for this account.
function deriveUserHandle(accountId) {
  return crypto.createHash('sha256').update(`sahaplay-webauthn-user:${accountId}`).digest();
}

// ─── Registration (enrollment) ─────────────────────────────────────────

/**
 * @param {{accountId: number, username: string, excludeCredentialIds?: string[]}} params
 * @returns {Promise<PublicKeyCredentialCreationOptionsJSON>}
 */
async function buildRegistrationOptions({ accountId, username, excludeCredentialIds = [] }) {
  if (accountId == null) throw new WebauthnRpError('INVALID_REQUEST', 'accountId is required');
  const { rpID, rpName } = getRpConfig();
  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userName: username || `account-${accountId}`,
    userID: deriveUserHandle(accountId),
    attestationType: 'none', // we only need proof a real platform authenticator + UV occurred, not attestation provenance
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required', // non-negotiable — see the architecture doc's security requirements
    },
    excludeCredentials: excludeCredentialIds.map(id => ({ id })),
    extensions: { prf: {} }, // probes/enables PRF capability at creation (needed for "PRF-on-create" browsers); the client never trusts this alone — see browserDeviceUnlock.js's own doc comment on why it re-confirms via an immediate get()
  });
  storeChallenge(accountId, 'register', options.challenge);
  return options;
}

/**
 * @param {{accountId: number, response: RegistrationResponseJSON}} params
 * @returns {Promise<object>} registrationInfo — { credential: {id, publicKey, counter}, credentialDeviceType, credentialBackedUp, ... }
 */
async function verifyRegistration({ accountId, response }) {
  if (accountId == null) throw new WebauthnRpError('INVALID_REQUEST', 'accountId is required');
  const expectedChallenge = consumeChallenge(accountId, 'register');
  if (!expectedChallenge) {
    throw new WebauthnRpError('CHALLENGE_EXPIRED_OR_MISSING', 'Registration challenge expired, was already used, or was never issued for this account.');
  }
  const { rpID, origins } = getRpConfig();
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    throw new WebauthnRpError('VERIFICATION_FAILED', err.message || 'Registration verification failed');
  }
  if (!result.verified || !result.registrationInfo) {
    throw new WebauthnRpError('VERIFICATION_FAILED', 'Registration response did not verify');
  }
  return result.registrationInfo;
}

// ─── Authentication (unlock) ───────────────────────────────────────────

/**
 * @param {{accountId: number, allowCredentialIds: string[]}} params
 * @returns {Promise<PublicKeyCredentialRequestOptionsJSON>}
 */
async function buildAuthenticationOptions({ accountId, allowCredentialIds }) {
  if (accountId == null) throw new WebauthnRpError('INVALID_REQUEST', 'accountId is required');
  if (!Array.isArray(allowCredentialIds) || allowCredentialIds.length === 0) {
    throw new WebauthnRpError('NO_CREDENTIALS', 'No browser credentials are registered for this account.');
  }
  const { rpID } = getRpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: allowCredentialIds.map(id => ({ id })),
    // Deliberately no `extensions` here — the WebAuthn PRF `eval.first` salt
    // is a fixed, non-secret, app-wide constant (see browserDeviceUnlock.js);
    // it needs no server round trip or replay protection, so the client
    // adds it locally when it builds the real navigator.credentials.get()
    // call. Keeping the server out of PRF entirely also means it never
    // needs to encode/decode PRF salt bytes into/out of JSON.
  });
  storeChallenge(accountId, 'authenticate', options.challenge);
  return options;
}

/**
 * @param {{accountId: number, response: AuthenticationResponseJSON, credential: {id: string, publicKey: Uint8Array, counter: number, transports?: string[], accountId: number}}} params
 * @returns {Promise<{newCounter: number}>}
 */
async function verifyAuthentication({ accountId, response, credential }) {
  if (accountId == null) throw new WebauthnRpError('INVALID_REQUEST', 'accountId is required');
  // Defensive, redundant with the caller's own lookup-by-account-id query
  // (server.js only ever fetches a credential row scoped to req.user.id in
  // the first place) — but this is the exact property under review here
  // ("Do not allow an assertion for account A to unlock account B"), so it
  // is checked again, explicitly, right at the crypto-verification boundary
  // rather than trusted implicitly from how the caller happened to query.
  if (!credential || credential.accountId !== accountId) {
    throw new WebauthnRpError('ACCOUNT_MISMATCH', 'This credential is not registered to the authenticated account.');
  }
  const expectedChallenge = consumeChallenge(accountId, 'authenticate');
  if (!expectedChallenge) {
    throw new WebauthnRpError('CHALLENGE_EXPIRED_OR_MISSING', 'Authentication challenge expired, was already used, or was never issued for this account.');
  }
  const { rpID, origins } = getRpConfig();
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      },
      requireUserVerification: true,
    });
  } catch (err) {
    throw new WebauthnRpError('VERIFICATION_FAILED', err.message || 'Authentication verification failed');
  }
  if (!result.verified) {
    throw new WebauthnRpError('VERIFICATION_FAILED', 'Authentication response did not verify');
  }
  return result.authenticationInfo;
}

module.exports = {
  WebauthnRpError,
  getRpConfig,
  buildRegistrationOptions,
  verifyRegistration,
  buildAuthenticationOptions,
  verifyAuthentication,
  deriveUserHandle,
  _resetChallengesForTests,
};
