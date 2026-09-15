/**
 * deviceUnlock.js
 *
 * The ONLY place in the JS codebase that talks to native device-unlock
 * code — the Capacitor SahaplayE2ee plugin on Android (see
 * SahaplayE2eePlugin.java / E2eeKeyStore.java / DeviceAssertionVerifier.java)
 * and the Tauri device_unlock commands on Windows desktop (see
 * frontend/src-tauri/src/device_unlock.rs / device_assertion.rs — a
 * faithful port of the same DPAPI/UserConsentVerifier-based design,
 * confirmed against a real device before being built: see that module's
 * own doc comment). Both share backend/lib/deviceAssertion.js as their
 * common trust root. CryptoContext.jsx (a later stage) calls these
 * functions and nothing else — it never talks to
 * window.Capacitor.Plugins.SahaplayE2ee or @tauri-apps/api directly, same
 * separation nativeCallEngine.js already establishes for the calling
 * engine. This is also why CryptoContext.jsx needed no changes at all to
 * gain Windows support — this module's public contract (function names,
 * parameters, DeviceUnlockError codes) is identical across both platforms.
 *
 * ─── The one rule every function here enforces ────────────────────────
 * There is NO public function in this module that accepts an account
 * identifier. Every call operates on "whichever account the app's own
 * current session (watch_token) says is active" — decided internally,
 * every single time, from the live localStorage state, never cached
 * across calls and never accepted as a parameter. This is deliberate: an
 * earlier design let callers pass an arbitrary accountId, which (combined
 * with a since-removed native-side assertion cache) allowed a compromised
 * page logged in as one account to reach a DIFFERENT, previously-enrolled
 * account's key. Removing the parameter from this layer removes the
 * ability to even EXPRESS that mistake from ordinary application code —
 * see SahaplayE2eePlugin.java's own class comment for the full incident,
 * and device_assertion.rs's module comment for why the exact same
 * protection was ported to the Windows side rather than skipped.
 *
 * Every function that needs proof of identity (everything except the
 * cheap "is native even available" check) fetches a FRESH, server-signed
 * assertion via POST /api/auth/device-enrollment-assertion using the
 * CURRENT watch_token before calling into native — never a cached one.
 * That backend call requires network; if it fails (offline, timeout,
 * server error), every function here throws/reports failure rather than
 * inventing a substitute — callers MUST fall back to the existing
 * encryption-passphrase/recovery flow in that case, exactly like every
 * other native failure mode. Nothing in this module may ever be used as
 * grounds to generate a new E2EE keypair.
 */
import { isCapacitorApp, isTauriApp } from './platform';
import { API } from './api';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const capacitorPlugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.SahaplayE2ee : null);

// Dynamic import, matching desktopNotify.js's existing pattern for
// @tauri-apps/api/core — keeps this a zero-cost import on Android/browser,
// where @tauri-apps/api's module graph is never touched at all.
let tauriInvokeModule = null;
function tauriInvoke(cmd, args) {
  if (!tauriInvokeModule) {
    tauriInvokeModule = import('@tauri-apps/api/core');
  }
  return tauriInvokeModule.then(({ invoke }) => invoke(cmd, args));
}

/** Cheap, synchronous, no-network check — safe to call anywhere to decide whether to show Device Unlock UI at all. */
export function isDeviceUnlockAvailable() {
  return !!capacitorPlugin() || isTauriApp();
}

export class DeviceUnlockError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'DeviceUnlockError';
    this.code = code; // one of the typed strings documented on each function below
  }
}

// Real-device report: a notification tap that cold-starts (or wakes from
// fully-closed) the Windows .exe reliably hung on a plain white screen
// forever — never the Windows Hello prompt, never the passphrase fallback
// modal, nothing. The native Windows Hello dialog appears to need the
// window to already be focused/visible to actually show itself; on a
// toast-activated relaunch specifically, that focus can lose the race
// against this call, and the native `windows_device_unlock_unlock` command
// then never resolves OR rejects — it just sits there. Every caller here
// (CryptoContext's mount effect, its Tauri hide/show listener, and
// EncryptionUnlockGate's own migrated-passphrase-account check) was
// awaiting that promise with no ceiling, so the whole app sat blocked
// behind DeviceUnlockOverlay's blur indefinitely, with no fallback UI ever
// reachable. 12s is generous for a real biometric/Hello prompt a human is
// actively responding to, but short enough that a genuinely stuck native
// call surfaces the password/passphrase fallback instead of a dead screen.
const NATIVE_UNLOCK_TIMEOUT_MS = 12000;
function withUnlockTimeout(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DeviceUnlockError('TIMEOUT', `Device unlock did not respond within ${NATIVE_UNLOCK_TIMEOUT_MS}ms — falling back`));
    }, NATIVE_UNLOCK_TIMEOUT_MS);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// Decodes (deliberately NEVER verifies — there is nothing to verify
// client-side; JS already implicitly trusts this exact token for every
// other authenticated API call the app makes) the current session token's
// own `id` claim, purely so it can be handed to native as a LOOKUP key.
// This is explicitly NOT an authentication step — see the module doc and
// SahaplayE2eePlugin.java: native only ever trusts the freshly-fetched
// assertion's OWN verified id, and cross-checks it against this value,
// never the reverse.
//
// Accepts id as either a number or a numeric string — a Postgres bigint
// id column (e.g. Supabase's default `id bigint generated by default as
// identity`) comes back from `pg`/node-postgres as a STRING, not a JS
// number (to avoid silent precision loss on 64-bit values), so
// jwt.sign({ id: user.id, ... }) embeds it as a string in that case.
// backend/lib/deviceAssertion.js's signDeviceAssertion already coerces
// this same value with `typeof account.id === 'string' ? Number(...) :
// ...` for exactly this reason; this function previously didn't, so a
// string id here always produced `null` — silently failing every device
// unlock/enrollment attempt on every account, regardless of the native
// Keystore/biometric layer ever being reached.
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

// De-dupes truly CONCURRENT fetches for the same token — this is NOT a
// time-based cache (nothing here is reused across separate logical calls;
// each call to a function below that needs an assertion starts a fresh
// fetch unless one for the exact same token is already in flight right
// now). Keyed by token value so an account switch mid-flight can never
// hand a caller a different account's in-flight promise.
const inFlightAssertionFetches = new Map();

/**
 * Fetches a fresh device-enrollment assertion for the CURRENT session.
 * Guests (no server-side E2EE identity to enroll — see
 * loadOrCreateGuestKeyPair in CryptoContext.jsx) and anyone with no active
 * session are rejected immediately, with no network call attempted.
 *
 * @throws DeviceUnlockError('NOT_AUTHENTICATED')     no session / guest account
 * @throws DeviceUnlockError('ASSERTION_FETCH_FAILED') network failure, timeout, non-2xx, malformed response
 */
async function fetchFreshAssertion() {
  if (localStorage.getItem('watch_is_guest') === 'true') {
    throw new DeviceUnlockError('NOT_AUTHENTICATED', 'Device unlock does not apply to guest accounts');
  }
  const token = localStorage.getItem('watch_token');
  if (!token) {
    throw new DeviceUnlockError('NOT_AUTHENTICATED', 'No active session');
  }
  const accountId = decodeAccountIdFromToken(token);
  if (accountId == null) {
    throw new DeviceUnlockError('NOT_AUTHENTICATED', 'Could not read account id from the current session');
  }

  if (!inFlightAssertionFetches.has(token)) {
    const promise = fetch(`${API}/api/auth/device-enrollment-assertion`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(async (res) => {
      if (!res.ok) {
        throw new DeviceUnlockError('ASSERTION_FETCH_FAILED', `Server returned ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      if (!data?.assertion) {
        throw new DeviceUnlockError('ASSERTION_FETCH_FAILED', 'Server response had no assertion');
      }
      return { accountId, assertion: data.assertion };
    }).finally(() => {
      inFlightAssertionFetches.delete(token);
    });
    inFlightAssertionFetches.set(token, promise);
  }

  try {
    return await inFlightAssertionFetches.get(token);
  } catch (e) {
    if (e instanceof DeviceUnlockError) throw e;
    // Network error, CORS, DNS failure, etc. — fetch() itself throwing.
    throw new DeviceUnlockError('ASSERTION_FETCH_FAILED', e?.message || 'Network error fetching device-enrollment assertion');
  }
}

function nativeErrorToDeviceUnlockError(err) {
  // Capacitor surfaces a native PluginCall.reject(message, code) as a
  // rejected Promise whose error carries both; Tauri surfaces a command's
  // Err(DeviceUnlockError) (device_unlock.rs's Rust struct, #[derive(Serialize)]
  // with the same {code, message} shape) as the rejection value directly —
  // either way, pass the code straight through so callers see the exact
  // same typed vocabulary SahaplayE2eePlugin.java/device_unlock.rs document
  // (NO_VALID_ASSERTION, NO_KEY_FOR_ACCOUNT, KEY_INVALIDATED,
  // CORRUPT_WRAPPER, HARDWARE_UNAVAILABLE, AUTH_FAILED, ALREADY_IN_PROGRESS,
  // ALREADY_ENROLLED, NATIVE_UNAVAILABLE, INVALID_REQUEST, and on Windows
  // specifically NOT_CONFIGURED — Windows Hello isn't set up on this
  // Windows account at all).
  return new DeviceUnlockError(err?.code || 'UNKNOWN', err?.message || String(err));
}

/**
 * Convenience check: does the account currently signed in have Device
 * Unlock enrolled on THIS device? Every failure mode (offline, no
 * session, native error, not enrolled) is reported identically as
 * `false` — this function never throws. It exists for UI decisions
 * ("show the passphrase prompt vs. try silently") where every failure
 * reason leads to the exact same action anyway.
 */
export async function hasDeviceUnlock() {
  if (!isDeviceUnlockAvailable()) return false;
  try {
    const { accountId, assertion } = await fetchFreshAssertion();
    if (isTauriApp()) {
      return !!(await tauriInvoke('windows_device_unlock_has', { accountId, assertion }));
    }
    const result = await capacitorPlugin().hasDeviceUnlock({ accountId, assertion });
    return !!result?.exists;
  } catch {
    return false;
  }
}

/**
 * Enrolls Device Unlock for the CURRENT account, wrapping secretKeyBytes
 * (the account's EXISTING 32-byte NaCl secret key — this never generates
 * or alters it) behind the device's platform-specific gate — Android
 * Keystore/biometric, or on Windows, DPAPI (always) plus a Windows Hello
 * confirmation when strict is true (see device_unlock.rs's setup command).
 *
 * @param {Uint8Array} secretKeyBytes  exactly 32 bytes
 * @param {{allowOverwrite?: boolean, strict?: boolean}} [opts]
 *   allowOverwrite must only be passed true from an explicit, user-visible
 *   re-enrollment action — never as a default, per SahaplayE2eePlugin.java's
 *   own no-silent-overwrite guarantee (device_unlock.rs enforces the same
 *   rule on Windows).
 *   strict selects the platform's per-unlock authentication policy for
 *   THIS enrollment: false (default) — Android: existing 30-minute
 *   authentication-validity window; Windows: DPAPI alone, no Windows Hello
 *   gate at all. true — Android: a fresh biometric/device-credential check
 *   on every single use; Windows: a Windows Hello confirmation at
 *   enrollment AND on every future unlock. See deviceUnlockSettings.js's
 *   "require fingerprint/Windows Hello every open" setting, the only
 *   intended caller of strict:true. Changing strict for an account that's
 *   already enrolled requires allowOverwrite:true.
 * @throws DeviceUnlockError('NOT_AVAILABLE')       non-native platform
 * @throws DeviceUnlockError('NOT_AUTHENTICATED' | 'ASSERTION_FETCH_FAILED')  see fetchFreshAssertion
 * @throws DeviceUnlockError('ALREADY_ENROLLED')    a wrapper already exists and allowOverwrite was false
 * @throws DeviceUnlockError('AUTH_FAILED')         biometric/device-credential/Windows Hello cancelled or failed
 * @throws DeviceUnlockError('NOT_CONFIGURED')      (Windows only) Windows Hello isn't set up for this account
 * @throws DeviceUnlockError('HARDWARE_UNAVAILABLE') Keystore/StrongBox/DPAPI error
 */
export async function setupDeviceUnlock(secretKeyBytes, { allowOverwrite = false, strict = false } = {}) {
  if (!isDeviceUnlockAvailable()) throw new DeviceUnlockError('NOT_AVAILABLE', 'Device unlock is not available on this platform');
  if (!(secretKeyBytes instanceof Uint8Array) || secretKeyBytes.length !== 32) {
    throw new DeviceUnlockError('INVALID_REQUEST', 'secretKeyBytes must be a 32-byte Uint8Array');
  }
  const { accountId, assertion } = await fetchFreshAssertion();
  const secretKeyBase64 = encodeBase64(secretKeyBytes);
  try {
    if (isTauriApp()) {
      await tauriInvoke('windows_device_unlock_setup', { accountId, assertion, secretKeyBase64, allowOverwrite, strict });
    } else {
      await capacitorPlugin().setupDeviceUnlock({ accountId, assertion, secretKeyBase64, allowOverwrite, strict });
    }
  } catch (err) {
    throw nativeErrorToDeviceUnlockError(err);
  }
}

/**
 * Attempts to recover the account's secret key via Device Unlock. This is
 * the ONLY function in this module that can return key material — the
 * caller (CryptoContext.jsx, a later stage) MUST, before trusting the
 * result, independently verify that
 * `nacl.box.keyPair.fromSecretKey(result).publicKey` matches the
 * account's server-known publicKey. This module deliberately does not do
 * that check itself (it has no NaCl/CryptoContext dependency by design —
 * see the module doc) — skipping that verification in the caller would
 * silently reopen the exact class of bug this whole feature was reviewed
 * against.
 *
 * Every failure below (including a network failure fetching the
 * assertion) means exactly one thing to the caller: fall back to the
 * existing encryption-passphrase/recovery flow. NONE of them are ever
 * grounds to generate a new E2EE keypair.
 *
 * @param {{strict?: boolean}} [opts]  Windows only — whether to require a
 *   Windows Hello confirmation before releasing the key (Android reads its
 *   own strict policy off the enrolled key itself, so needs no parameter
 *   here; Windows' DPAPI blob carries no such policy, so device_unlock.rs's
 *   unlock command needs to be told explicitly). Ignored on Android/browser.
 * @returns {Promise<Uint8Array>} the 32-byte secret key
 * @throws DeviceUnlockError with one of: NOT_AVAILABLE, NOT_AUTHENTICATED,
 *   ASSERTION_FETCH_FAILED, NO_VALID_ASSERTION, NO_KEY_FOR_ACCOUNT,
 *   KEY_INVALIDATED, CORRUPT_WRAPPER, HARDWARE_UNAVAILABLE, AUTH_FAILED,
 *   NOT_CONFIGURED (Windows only), ALREADY_IN_PROGRESS, NATIVE_UNAVAILABLE,
 *   NATIVE_ERROR (an unexpected native-side exception — always logged with
 *   full detail on the native side; treated the same as every other
 *   failure here, just with a distinct code so it's identifiable)
 */
export async function unlockDeviceKey({ strict = false } = {}) {
  if (!isDeviceUnlockAvailable()) throw new DeviceUnlockError('NOT_AVAILABLE', 'Device unlock is not available on this platform');
  // withUnlockTimeout wraps the ENTIRE rest of this function (not just the
  // native invoke below) — see its own comment for why: a hung assertion
  // fetch would block just as indefinitely as a hung native call, and both
  // need the same ceiling.
  return withUnlockTimeout((async () => {
    const { accountId, assertion } = await fetchFreshAssertion();
    let secretKeyBase64;
    try {
      if (isTauriApp()) {
        secretKeyBase64 = await tauriInvoke('windows_device_unlock_unlock', { accountId, assertion, strict });
      } else {
        const result = await capacitorPlugin().unlockDeviceKey({ accountId, assertion });
        secretKeyBase64 = result?.secretKeyBase64;
      }
    } catch (err) {
      throw nativeErrorToDeviceUnlockError(err);
    }
    if (!secretKeyBase64) {
      throw new DeviceUnlockError('UNKNOWN', 'Native resolved without returning a key');
    }
    return decodeBase64(secretKeyBase64);
  })());
}

/**
 * "Forget this device" — explicitly deletes the platform-native wrapper
 * for the CURRENT account on this device. Distinct from logout: an
 * ordinary logout never calls this (see CryptoContext.jsx's clearKeys /
 * authUtils.js's clearUserSession, unaffected by this module) — Device
 * Unlock enrollment survives a normal logout/re-login on the same device
 * by design, and is only removed by this explicit action.
 *
 * @throws DeviceUnlockError('NOT_AUTHENTICATED' | 'ASSERTION_FETCH_FAILED')  see fetchFreshAssertion
 * @throws DeviceUnlockError('NO_VALID_ASSERTION')  (should not normally happen — same session that's asking to forget itself)
 */
export async function clearDeviceUnlock() {
  if (!isDeviceUnlockAvailable()) return; // nothing native ever existed on this platform — not an error
  const { accountId, assertion } = await fetchFreshAssertion();
  try {
    if (isTauriApp()) {
      await tauriInvoke('windows_device_unlock_clear', { accountId, assertion });
    } else {
      await capacitorPlugin().clearDeviceUnlock({ accountId, assertion });
    }
  } catch (err) {
    throw nativeErrorToDeviceUnlockError(err);
  }
}
