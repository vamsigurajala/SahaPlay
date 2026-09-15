/**
 * browserDeviceUnlock.js
 *
 * "Remember this browser" — a browser-only, opt-in convenience layer for
 * E2EE that lets a returning visit skip the encryption passphrase prompt,
 * using WebAuthn's PRF extension. Sibling module to deviceUnlock.js (the
 * Android Keystore / Windows DPAPI+Hello device unlock) — same shape, same
 * account-binding discipline, but a completely independent code path: this
 * file is never imported by, and never imports, deviceUnlock.js, and this
 * feature is deliberately gated OFF entirely inside a Capacitor/Tauri shell
 * (isBrowserDeviceUnlockAvailable() below) — those platforms already have a
 * strictly stronger, hardware-backed mechanism; mixing this in would only
 * add a second, weaker source of truth for the exact same decision.
 *
 * ─── The security design, in one paragraph ─────────────────────────────
 * The E2EE secret key is NEVER stored anywhere by this module — what's
 * persisted (IndexedDB only, never localStorage/cookies) is
 * AES-256-GCM(secretKey) under a key derived via HKDF-SHA256 from the
 * output of a WebAuthn PRF ceremony. The PRF output itself is never
 * stored — it is re-derived fresh from the platform authenticator (Windows
 * Hello / Touch ID+iCloud Keychain / Android+Chrome Password Manager) on
 * every unlock, gated behind `userVerification: 'required'`. This means a
 * full compromise of this browser's on-disk storage does NOT, by itself,
 * yield the E2EE key — the attacker would still need to pass a live
 * biometric/PIN check against that specific physical authenticator. It
 * also means a SYNCED passkey landing on a different physical device is
 * useless there on its own: IndexedDB never syncs, so that device has the
 * credential but no wrapped blob to decrypt with it, and falls straight
 * back to the encryption passphrase like any other new device.
 *
 * XSS NOTE (documented per the security review this module went through):
 * WebAuthn PRF does not make this origin immune to active XSS while the
 * user is actively using the site. A script running on this page during a
 * genuine "Remember this browser" unlock CAN observe the recovered E2EE
 * secret key in memory, same as it already could with the existing
 * password/passphrase unlock flows — this feature does not create that
 * exposure, and does not claim to eliminate it. What it removes is the
 * ability to recover the key from disk/IndexedDB alone, without ever
 * running a live, user-verified WebAuthn ceremony against the real
 * authenticator hardware.
 *
 * ─── The one rule every function here enforces ────────────────────────
 * No public function accepts an account identifier — every call operates
 * on whichever account the current session (watch_token) says is active,
 * decoded fresh every time, exactly like deviceUnlock.js's own rule (see
 * its header comment for the incident that established this pattern).
 *
 * Nothing in this module may ever be used as grounds to generate a new
 * E2EE keypair — every failure here means exactly one thing to callers:
 * fall back to the existing passphrase/recovery flow, unchanged.
 */
import { isCapacitorApp, isTauriApp } from './platform';
import { API } from './api';
// Statically imported (not dynamic) deliberately — tweetnacl/tweetnacl-util
// are already statically imported by nearly every other page that would
// ever load this module (Login.jsx, Signup.jsx, Room.jsx,
// EncryptionUnlockGate.jsx, CryptoContext.jsx, ...), so a dynamic import
// here bought no real code-splitting benefit and just produced a Vite
// build warning.
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

// ─── Errors ─────────────────────────────────────────────────────────────
export class BrowserDeviceUnlockError extends Error {
  /**
   * @param {string} code one of: NOT_AVAILABLE, NOT_AUTHENTICATED, NO_LOCAL_WRAPPER,
   *   NO_CREDENTIALS, OPTIONS_FETCH_FAILED, CREATE_FAILED, GET_FAILED,
   *   PRF_NOT_SUPPORTED, PRF_NOT_CONFIRMED, PUBLIC_KEY_MISMATCH,
   *   WRAP_FAILED, PERSIST_FAILED, REGISTER_VERIFY_FAILED,
   *   AUTH_VERIFY_FAILED, STALE_WRAPPER, INVALID_REQUEST, UNKNOWN
   * @param {string} [message]
   * @param {{name?: string, message?: string}} [original] the underlying
   *   browser exception (e.g. a WebAuthn DOMException) this error was
   *   converted from, if any — kept SEPARATE from this error's own `.name`
   *   (always 'BrowserDeviceUnlockError') so a caller can log the real
   *   browser-reported failure (DOMException.name/.message, e.g.
   *   "NotAllowedError" / "The operation either timed out or was not
   *   allowed...") without losing this error's own typed `.code`. A
   *   DOMException's name/message describe the WebAuthn ceremony's outcome
   *   only — never key material — so this is safe to log; see
   *   describeBrowserDeviceUnlockError below, which is the sanctioned way
   *   to turn this into a log line.
   */
  constructor(code, message, original) {
    super(message || code);
    this.name = 'BrowserDeviceUnlockError';
    this.code = code;
    this.originalName = original?.name || null;
    this.originalMessage = original?.message || null;
  }
}

/**
 * Safe, secret-free diagnostic summary of a caught enrollment/unlock error,
 * for `console.warn`/`toast` call sites — {code, name, message}. Never
 * includes key material: a BrowserDeviceUnlockError's message/originalName/
 * originalMessage are always either a static string this module wrote, or a
 * WebAuthn DOMException's own .name/.message, which by spec describe the
 * ceremony's outcome (e.g. "NotAllowedError", "The operation either timed
 * out or was not allowed...") — never the PRF output, a private key, or any
 * other secret, none of which this module ever passes into an Error at all.
 */
export function describeBrowserDeviceUnlockError(e) {
  if (e instanceof BrowserDeviceUnlockError) {
    return { code: e.code, name: e.originalName || null, message: e.originalMessage || e.message || null };
  }
  return { code: null, name: e?.name || null, message: e?.message || (typeof e === 'string' ? e : null) };
}

/**
 * True when a caught error means "this device/authenticator does not (or
 * did not, at this exact ceremony) provide WebAuthn PRF" — the two codes
 * enrollBrowser() throws for that:
 *  - PRF_NOT_SUPPORTED: navigator.credentials.create() succeeded, but
 *    clientExtensionResults().prf.enabled was not true.
 *  - PRF_NOT_CONFIRMED: create() reported PRF capability, but the
 *    immediate follow-up get() probe never returned a usable PRF result.
 * Callers use this to show a PRF-specific message ("your device doesn't
 * support this") instead of the generic enrollment-failed one.
 *
 * PREFLIGHT INVESTIGATION (see this function's own reason for existing —
 * classifying the ceremony's OUTCOME — rather than predicting it upfront):
 * WebAuthn Level 3's PublicKeyCredential.getClientCapabilities() exposes an
 * "extension:prf" entry, but per its own spec text this reports only
 * whether the BROWSER knows how to process the prf extension — not whether
 * a specific (possibly enterprise-policy-managed) platform authenticator
 * will actually grant it for a given credential. That is exactly the gap a
 * real production case surfaced: an up-to-date Chrome on an up-to-date,
 * enterprise-managed Windows Hello declined to enable prf.enabled despite
 * both being fully current — a client-capability check would not have
 * predicted this, and calling it before create() would risk incorrectly
 * hiding the feature from browsers where it actually would have worked, or
 * incorrectly promising it would work where it doesn't. There is no
 * standards-supported way to reliably know an AUTHENTICATOR will grant PRF
 * before actually asking it to — the real ceremony's own result (this
 * function's whole reason to exist) is the only trustworthy signal, so no
 * preflight check is used here.
 */
export function isPrfUnsupportedError(e) {
  return e instanceof BrowserDeviceUnlockError && (e.code === 'PRF_NOT_SUPPORTED' || e.code === 'PRF_NOT_CONFIRMED');
}

// ─── Availability ───────────────────────────────────────────────────────
/**
 * Cheap, synchronous, no-network, no-IndexedDB check — safe to call
 * anywhere to decide whether to even show the "Remember this browser" UI.
 * Deliberately false inside Capacitor/Tauri (see this module's own header
 * comment) and false when the WebAuthn API itself isn't present. Does NOT
 * confirm PRF support — that can only be learned by actually running a
 * ceremony (see enrollBrowser's own doc comment on why create() success
 * alone is never trusted) — so this is a necessary-but-not-sufficient gate,
 * exactly like deviceUnlock.js's isDeviceUnlockAvailable().
 */
export function isBrowserDeviceUnlockAvailable() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof window.navigator?.credentials?.create === 'function' &&
    typeof window.navigator?.credentials?.get === 'function' &&
    !isCapacitorApp() &&
    !isTauriApp()
  );
}

// ─── Token/account helpers ──────────────────────────────────────────────
// Deliberately a separate, self-contained copy of deviceUnlock.js's own
// decodeAccountIdFromToken — NOT imported from there. Keeping these two
// platform modules independent (no shared coupling) means a future change
// to one can never accidentally affect the other's account-binding
// behavior. Same reasoning, same coercion (a Postgres bigint id comes back
// from jwt.sign as a numeric STRING, not a JS number).
function decodeAccountIdFromToken(token) {
  try {
    const payloadB64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    if (typeof json.id === 'number') return json.id;
    if (typeof json.id === 'string' && /^\d+$/.test(json.id)) return Number(json.id);
    return null;
  } catch {
    return null;
  }
}

function currentAccount() {
  if (localStorage.getItem('watch_is_guest') === 'true') return null; // guests have no server-side E2EE identity to enroll
  const token = localStorage.getItem('watch_token');
  if (!token) return null;
  const accountId = decodeAccountIdFromToken(token);
  if (accountId == null) return null;
  const username = localStorage.getItem('watch_username') || null;
  return { accountId, username, token };
}

async function authedFetch(path, body) {
  const account = currentAccount();
  if (!account) throw new BrowserDeviceUnlockError('NOT_AUTHENTICATED', 'No active session');
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${account.token}` },
      body: JSON.stringify(body || {}),
    });
  } catch (e) {
    throw new BrowserDeviceUnlockError('OPTIONS_FETCH_FAILED', e?.message || 'Network error');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new BrowserDeviceUnlockError(data?.code || 'OPTIONS_FETCH_FAILED', data?.error || `Server returned ${res.status}`);
  }
  return data;
}

// ─── Base64url <-> ArrayBuffer (encoding only — no cryptography here) ───
function b64urlToBuf(b64url) {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(padded);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Converts a server-issued PublicKeyCredentialCreationOptionsJSON /
// RequestOptionsJSON (base64url-string fields, per the WebAuthn JSON
// conventions @simplewebauthn/server produces) into the real BufferSource
// shape navigator.credentials.create()/get() require. Pure encoding, not
// cryptography — the inverse of what credential.toJSON() does below.
function creationOptionsFromJSON(json) {
  return {
    ...json,
    challenge: b64urlToBuf(json.challenge),
    user: { ...json.user, id: b64urlToBuf(json.user.id) },
    excludeCredentials: (json.excludeCredentials || []).map(c => ({ ...c, id: b64urlToBuf(c.id) })),
  };
}
function requestOptionsFromJSON(json) {
  return {
    ...json,
    challenge: b64urlToBuf(json.challenge),
    allowCredentials: (json.allowCredentials || []).map(c => ({ ...c, id: b64urlToBuf(c.id) })),
  };
}

// Real navigator.credentials.create()/get() resolve a PublicKeyCredential
// object, not JSON — this converts it to the RegistrationResponseJSON /
// AuthenticationResponseJSON shape @simplewebauthn/server's
// verifyRegistrationResponse/verifyAuthenticationResponse expect, using the
// browser's own standard PublicKeyCredential.toJSON() where available
// (Chrome122+/Safari18+/Firefox required for PRF anyway) and a manual
// fallback otherwise. Encoding only, mirrors the browser's own spec'd
// conversion — see https://w3c.github.io/webauthn/#dictdef-registrationresponsejson
function credentialToJSON(credential) {
  if (typeof credential.toJSON === 'function') return credential.toJSON();
  const isRegistration = !!credential.response.attestationObject;
  const base = {
    id: credential.id,
    rawId: bufToB64url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
  };
  if (isRegistration) {
    return {
      ...base,
      response: {
        clientDataJSON: bufToB64url(credential.response.clientDataJSON),
        attestationObject: bufToB64url(credential.response.attestationObject),
        transports: credential.response.getTransports?.() || [],
      },
    };
  }
  return {
    ...base,
    response: {
      clientDataJSON: bufToB64url(credential.response.clientDataJSON),
      authenticatorData: bufToB64url(credential.response.authenticatorData),
      signature: bufToB64url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufToB64url(credential.response.userHandle) : undefined,
    },
  };
}

// ─── PRF ────────────────────────────────────────────────────────────────
// A fixed, NON-secret, app-wide constant — the WebAuthn PRF extension's
// "eval.first" input. It does not need to be random or kept secret (unlike
// a cryptographic salt used as a key directly): the actual secret this
// produces is the authenticator's own PRF output, which depends on the
// credential's internal key material + this input, and can only be
// reproduced by that specific authenticator. Bumping this string would be
// a breaking change (every existing wrapper would stop decrypting) — treat
// it as a versioned constant, same spirit as crypto.js's PBKDF2_ITERATIONS.
const PRF_INPUT = new TextEncoder().encode('sahaplay-e2ee-device-wrap-v1');

function withPrfEval(optionsObj) {
  const extensions = { ...(optionsObj.extensions || {}), prf: { eval: { first: PRF_INPUT } } };
  return { ...optionsObj, extensions };
}

function extractPrfOutput(credential) {
  const results = credential.getClientExtensionResults?.();
  const first = results?.prf?.results?.first;
  if (!first) return null;
  const bytes = new Uint8Array(first);
  return bytes.length > 0 ? bytes : null;
}

// ─── HKDF -> AES-256-GCM wrap/unwrap (WebCrypto only — no custom crypto) ─
async function deriveWrappingKey(prfOutputBytes, accountId, credentialId) {
  const ikm = await crypto.subtle.importKey('raw', prfOutputBytes, 'HKDF', false, ['deriveKey']);
  const info = new TextEncoder().encode(`sahaplay-device-wrap-v1|${accountId}|${credentialId}`);
  const salt = new TextEncoder().encode('sahaplay-e2ee-browser-unlock-hkdf-salt-v1'); // fixed, non-secret — HKDF's salt parameter need not be secret
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function wrapSecretKey(wrappingKey, secretKeyBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, secretKeyBytes);
  return { iv: bufToB64(iv), wrappedKeyBlob: bufToB64(ciphertext) };
}

/** Throws (DOMException 'OperationError') on tamper or wrong key — this is the "stale wrapper" signal callers rely on. */
async function unwrapSecretKey(wrappingKey, ivB64, wrappedKeyBlobB64) {
  const iv = b64ToBuf(ivB64);
  const ciphertext = b64ToBuf(wrappedKeyBlobB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext);
  return new Uint8Array(plainBuf);
}

// ─── IndexedDB — the ONLY place this module persists anything ──────────
// Stores exactly: accountId, credentialId, the AES-GCM ciphertext + its IV,
// and bookkeeping fields. NEVER the plaintext secret key, the passphrase,
// the PRF output, or the derived wrapping key — none of those values are
// ever passed to any of the functions below.
const DB_NAME = 'sahaplay_browser_unlock';
const DB_VERSION = 1;
const STORE_NAME = 'wrappers';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new BrowserDeviceUnlockError('NOT_AVAILABLE', 'IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'accountId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

// Every helper below opens its own short-lived connection and explicitly
// closes it once its transaction settles, rather than keeping a
// long-lived handle open for the life of the tab — an open IndexedDB
// connection blocks that origin's database from ever being deleted/
// upgraded (by this same code on a future schema bump, by the user
// clearing site data through devtools, or — in this module's own test
// suite — by fake-indexeddb's spec-accurate deleteDatabase, which simply
// waits forever for a connection nothing ever closes).
async function getWrapperRecord(accountId) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(accountId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

async function putWrapperRecord(record) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
    });
  } finally {
    db.close();
  }
}

async function deleteWrapperRecord(accountId) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(accountId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed'));
    });
  } finally {
    db.close();
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Whether THIS browser already has a local "Remember this browser" wrapper
 * for the currently signed-in account. Every failure mode (unavailable, no
 * session, IndexedDB error) is reported identically as `false` — mirrors
 * deviceUnlock.js's hasDeviceUnlock() contract exactly: this never throws,
 * because every caller treats every falsy reason the same way anyway.
 */
export async function hasBrowserDeviceUnlock() {
  if (!isBrowserDeviceUnlockAvailable()) return false;
  const account = currentAccount();
  if (!account) return false;
  try {
    const record = await getWrapperRecord(account.accountId);
    return !!record;
  } catch {
    return false;
  }
}

/**
 * Explicit, user-initiated enrollment ("Remember this browser" checkbox) —
 * never called silently/automatically, unlike deviceUnlock.js's native
 * enrollDeviceUnlockSilently. Requires the account's real, ALREADY-
 * established 32-byte E2EE secret key (the same value the caller just
 * legitimately unlocked via passphrase/password/recovery) — this function
 * has no code path that can generate or alter key material.
 *
 * Resolves only after EVERY one of these has genuinely happened, in order:
 *  1. This account's secret key is re-verified against the server's own
 *     recorded public key (belt-and-suspenders — the caller should already
 *     be passing a trusted key, but this never assumes that).
 *  2. A real navigator.credentials.create() ceremony succeeds.
 *  3. Its clientExtensionResults confirm PRF capability was actually
 *     granted (`prf.enabled === true`) — create() succeeding on its own is
 *     NOT sufficient; some browsers accept the extension request but never
 *     enable it.
 *  4. An IMMEDIATE, real navigator.credentials.get() against that exact
 *     new credential also succeeds and returns an actual PRF result — the
 *     property this step exists to catch: a browser can support PRF at
 *     creation time but not (yet) at authentication time, or vice versa.
 *  5. The secret key is wrapped with AES-256-GCM under the HKDF-derived key.
 *  6. The server verifies + persists the WebAuthn registration
 *     (register-verify) — metadata only, never the wrapped key.
 *  7. The wrapped blob is persisted to IndexedDB.
 *
 * Any failure at any step throws a BrowserDeviceUnlockError and leaves NO
 * partial enrollment behind: if the server-side registration succeeded but
 * the IndexedDB write then failed, this makes a best-effort (never-thrown)
 * attempt to tell the server to forget that now-useless credential row
 * before rethrowing the original error.
 *
 * @param {Uint8Array} secretKeyBytes exactly 32 bytes — the account's real E2EE secret key
 * @returns {Promise<{credentialId: string}>}
 */
export async function enrollBrowser(secretKeyBytes) {
  if (!isBrowserDeviceUnlockAvailable()) {
    throw new BrowserDeviceUnlockError('NOT_AVAILABLE', 'Browser device unlock is not available here');
  }
  if (!(secretKeyBytes instanceof Uint8Array) || secretKeyBytes.length !== 32) {
    throw new BrowserDeviceUnlockError('INVALID_REQUEST', 'secretKeyBytes must be a 32-byte Uint8Array');
  }
  const account = currentAccount();
  if (!account) throw new BrowserDeviceUnlockError('NOT_AUTHENTICATED', 'No active session');

  // Step 1 — re-verify the key we're about to protect actually matches the
  // account's server-recorded public key. Deliberately redundant with the
  // caller's own already-trusted key (see this function's doc comment) —
  // this is what makes item (h) of the enrollment contract an enforced
  // invariant of this module, not just a hoped-for calling convention.
  let serverPublicKeyB64;
  try {
    const res = await fetch(`${API}/api/auth/my-keys`, { headers: { 'Authorization': `Bearer ${account.token}` } });
    if (!res.ok) throw new Error(`my-keys returned ${res.status}`);
    const data = await res.json();
    serverPublicKeyB64 = data.publicKey || null;
  } catch (e) {
    throw new BrowserDeviceUnlockError('OPTIONS_FETCH_FAILED', e?.message || 'Could not verify this account\'s public key');
  }
  const derivedPublicKeyB64 = encodeBase64(nacl.box.keyPair.fromSecretKey(secretKeyBytes).publicKey);
  if (!serverPublicKeyB64 || derivedPublicKeyB64 !== serverPublicKeyB64) {
    throw new BrowserDeviceUnlockError('PUBLIC_KEY_MISMATCH', 'This key does not match the account\'s known public key — refusing to enroll it.');
  }

  // Step 2 — real registration ceremony.
  const optionsJson = await authedFetch('/api/auth/webauthn/register-options');
  let createdCredential;
  try {
    createdCredential = await navigator.credentials.create({ publicKey: creationOptionsFromJSON(optionsJson) });
  } catch (e) {
    // Preserve the real browser-reported failure (e.g. DOMException
    // "NotAllowedError"/"NotSupportedError"/"InvalidStateError" + its
    // message) on the error object as originalName/originalMessage — see
    // BrowserDeviceUnlockError's own doc comment. This is diagnostic-only:
    // it changes nothing about what create() was asked to do or how its
    // result is used, and never touches key material (create() rejecting
    // here means no key material exists yet in this call at all).
    throw new BrowserDeviceUnlockError('CREATE_FAILED', e?.message || 'Registration was cancelled or failed', e);
  }
  if (!createdCredential) throw new BrowserDeviceUnlockError('CREATE_FAILED', 'No credential returned');

  // Step 3 — PRF confirmed at creation.
  const createResults = createdCredential.getClientExtensionResults?.() || {};
  if (createResults.prf?.enabled !== true) {
    throw new BrowserDeviceUnlockError('PRF_NOT_SUPPORTED', 'This browser/authenticator does not support the WebAuthn PRF extension.');
  }

  // Step 4 — PRF re-confirmed at authentication, immediately, with a real
  // ceremony against the credential just created. The challenge here is a
  // fresh, local, non-secret random value — this probe-get is never sent
  // to (or verified by) the server; its only purpose is confirming this
  // specific authenticator genuinely returns a usable PRF result, which
  // create() succeeding never guarantees on its own.
  const probeChallenge = crypto.getRandomValues(new Uint8Array(32));
  let probeCredential;
  try {
    probeCredential = await navigator.credentials.get({
      publicKey: withPrfEval({
        challenge: probeChallenge,
        rpId: optionsJson.rp?.id,
        allowCredentials: [{ id: b64urlToBuf(createdCredential.id), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      }),
    });
  } catch (e) {
    throw new BrowserDeviceUnlockError('PRF_NOT_CONFIRMED', e?.message || 'Could not confirm PRF at authentication time');
  }
  const prfOutput = extractPrfOutput(probeCredential);
  if (!prfOutput) {
    throw new BrowserDeviceUnlockError('PRF_NOT_CONFIRMED', 'This authenticator did not return a PRF result on authentication.');
  }

  // Step 5 — wrap.
  let wrapped;
  try {
    const wrappingKey = await deriveWrappingKey(prfOutput, account.accountId, createdCredential.id);
    wrapped = await wrapSecretKey(wrappingKey, secretKeyBytes);
  } catch (e) {
    throw new BrowserDeviceUnlockError('WRAP_FAILED', e?.message || 'Failed to wrap the encryption key');
  }

  // Step 6 — server-side registration verification + persistence (metadata only).
  try {
    await authedFetch('/api/auth/webauthn/register-verify', { response: credentialToJSON(createdCredential) });
  } catch (e) {
    throw e instanceof BrowserDeviceUnlockError ? e : new BrowserDeviceUnlockError('REGISTER_VERIFY_FAILED', e?.message);
  }

  // Step 7 — local persistence. Only NOW does enrollment become real.
  try {
    await putWrapperRecord({
      accountId: account.accountId,
      credentialId: createdCredential.id,
      wrappedKeyBlob: wrapped.wrappedKeyBlob,
      iv: wrapped.iv,
      version: 1,
      createdAt: Date.now(),
    });
  } catch (e) {
    // Best-effort cleanup of the now-orphaned server-side row — this
    // secondary failure is swallowed; the original IndexedDB failure is
    // always what's reported to the caller.
    try { await authedFetch('/api/auth/webauthn/forget', { credentialId: createdCredential.id }); } catch { /* best effort */ }
    throw new BrowserDeviceUnlockError('PERSIST_FAILED', e?.message || 'Failed to save the local wrapper');
  }

  return { credentialId: createdCredential.id };
}

/**
 * Attempts to recover this account's secret key via "Remember this
 * browser." Returns the raw 32-byte secret key on success — the SAME
 * verify-before-trust contract as deviceUnlock.js's unlockDeviceKey(): the
 * caller (CryptoContext.jsx) MUST independently confirm
 * nacl.box.keyPair.fromSecretKey(result).publicKey matches the account's
 * server-known public key before trusting it. This module deliberately
 * does not do that comparison itself.
 *
 * Every failure here means the same thing to the caller: fall back to the
 * passphrase/recovery flow, unchanged. NEVER grounds to generate a new
 * E2EE keypair.
 *
 * @returns {Promise<Uint8Array>}
 */
export async function unlockViaBrowser() {
  if (!isBrowserDeviceUnlockAvailable()) throw new BrowserDeviceUnlockError('NOT_AVAILABLE', 'Browser device unlock is not available here');
  const account = currentAccount();
  if (!account) throw new BrowserDeviceUnlockError('NOT_AUTHENTICATED', 'No active session');

  const record = await getWrapperRecord(account.accountId).catch(() => null);
  if (!record) throw new BrowserDeviceUnlockError('NO_LOCAL_WRAPPER', 'No browser enrollment on this device for this account.');

  const optionsJson = await authedFetch('/api/auth/webauthn/auth-options');

  let assertion;
  try {
    assertion = await navigator.credentials.get({
      publicKey: withPrfEval(requestOptionsFromJSON(optionsJson)),
    });
  } catch (e) {
    // Ceremony itself failing (cancelled, no matching authenticator
    // present, timeout) is treated as transient/user-declined — the local
    // wrapper is NOT cleared, so the very next attempt (e.g. after the user
    // actually authenticates) can still succeed. Only a post-ceremony
    // decrypt failure (below) means the wrapper itself is unusable.
    throw new BrowserDeviceUnlockError('GET_FAILED', e?.message || 'Browser unlock was cancelled or failed');
  }
  if (!assertion) throw new BrowserDeviceUnlockError('GET_FAILED', 'No assertion returned');

  // Server-side verification FIRST (fail closed) — confirms a genuine,
  // correctly-signed ceremony against a credential really registered to
  // this account, and advances the anti-clone sign counter, before this
  // module trusts anything derived from the assertion locally.
  try {
    await authedFetch('/api/auth/webauthn/auth-verify', { response: credentialToJSON(assertion) });
  } catch (e) {
    const err = e instanceof BrowserDeviceUnlockError ? e : new BrowserDeviceUnlockError('AUTH_VERIFY_FAILED', e?.message);
    if (err.code === 'ACCOUNT_MISMATCH') {
      // The server just told us — authoritatively, via its own account-
      // scoped lookup (server.js's auth-verify route) — that the
      // credential the platform picker actually returned belongs to a
      // DIFFERENT account than the one signed in right now (e.g. the OS
      // offered a different synced passkey than the one THIS wrapper
      // record was created for; a real case seen with Android's Google
      // Password Manager when multiple accounts each have a saved
      // sahaplay.com passkey). That local wrapper record can never succeed
      // for the CURRENT account again, so self-heal exactly like the
      // decrypt-failure/STALE_WRAPPER case below: clear it so the next
      // attempt starts a clean re-enrollment instead of repeating the same
      // doomed ceremony on every login. This never touches or weakens the
      // server's own account-scoping check above — only local bookkeeping
      // for a wrapper already proven unusable here. Deliberately does NOT
      // call /forget: that route is itself account-scoped to the CURRENT
      // account, and the mismatched credential belongs to a different one
      // — it would be a guaranteed no-op, and only that credential's own
      // rightful account should ever be able to forget it.
      await deleteWrapperRecord(account.accountId).catch(() => {});
    }
    throw err;
  }

  const prfOutput = extractPrfOutput(assertion);
  if (!prfOutput) {
    throw new BrowserDeviceUnlockError('PRF_NOT_CONFIRMED', 'This authenticator did not return a PRF result.');
  }

  try {
    const wrappingKey = await deriveWrappingKey(prfOutput, account.accountId, record.credentialId);
    const secretKey = await unwrapSecretKey(wrappingKey, record.iv, record.wrappedKeyBlob);
    return secretKey;
  } catch {
    // The ceremony itself succeeded and the server confirmed it — a
    // decrypt failure at THIS point unambiguously means the stored wrapper
    // can never be recovered by this credential again (e.g. the passkey
    // was deleted and recreated). This is the one, precise case where it's
    // safe to clear the stale local enrollment automatically.
    await deleteWrapperRecord(account.accountId).catch(() => {});
    try { await authedFetch('/api/auth/webauthn/forget', { credentialId: record.credentialId }); } catch { /* best effort */ }
    throw new BrowserDeviceUnlockError('STALE_WRAPPER', 'This browser\'s saved unlock no longer works — please use your encryption passphrase.');
  }
}

/**
 * "Forget this browser" — deletes ONLY the local IndexedDB wrapper (and
 * makes a best-effort attempt to also remove the now-pointless server-side
 * WebAuthn credential metadata row). Never throws, mirroring
 * deviceUnlock.js's clearDeviceUnlock() no-op-when-unavailable contract —
 * unlike that function, though, this ever removes local state regardless
 * of server reachability, since the local half is the half that actually
 * matters (a lingering server-side metadata row holds no secret and grants
 * no access on its own).
 *
 * Touches NOTHING else: not the E2EE identity, not the server public key,
 * not messages, not recovery data, not Android/Windows device unlock.
 */
export async function forgetBrowser() {
  const account = currentAccount();
  if (!account) return;
  let credentialId = null;
  try {
    const record = await getWrapperRecord(account.accountId);
    credentialId = record?.credentialId || null;
  } catch { /* proceed to best-effort delete anyway */ }

  await deleteWrapperRecord(account.accountId).catch(() => {});

  if (credentialId) {
    try { await authedFetch('/api/auth/webauthn/forget', { credentialId }); } catch { /* best effort — local removal already happened */ }
  }
}
