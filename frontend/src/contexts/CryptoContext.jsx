/**
 * CryptoContext.jsx
 *
 * Provides the user's NaCl key pair to the entire React tree.
 * Private key: stored in React state (memory) + encrypted sessionStorage only.
 * NEVER in localStorage.
 *
 * Usage:
 *   const { keyPair, setKeyPair, clearKeys, isReady, needsReauth, reloadPrivateKeyWithPassword } = useCrypto();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { generateKeyPair, saveKeyToSession, loadKeyFromSession, clearSessionKey, decryptPrivateKey, encryptPrivateKey, encryptGuestKey, decryptGuestKey } from '../lib/crypto.js';
import { API } from '../lib/api';
import { isCapacitorApp, isTauriApp } from '../lib/platform';
import {
  isDeviceUnlockAvailable,
  unlockDeviceKey,
  setupDeviceUnlock as nativeSetupDeviceUnlock,
  clearDeviceUnlock as nativeClearDeviceUnlock,
  hasDeviceUnlock as nativeHasDeviceUnlock,
} from '../lib/deviceUnlock.js';
import { isStrictDeviceUnlockEnabled, setStrictDeviceUnlockEnabled } from '../lib/deviceUnlockSettings.js';

// Stage 5 fix: the missing half of Stage 4. Every place in this file/
// Login.jsx/EncryptionUnlockGate.jsx that successfully obtains this
// account's real 32-byte E2EE secret key calls this immediately
// afterward — it's what actually lets device unlock take over on the
// NEXT cold start; without it (confirmed on a real device: Stage 4 alone
// never wired this call in anywhere) `tryRestoreViaDeviceUnlock` above
// always finds nothing enrolled and falls back to the passphrase/
// password prompt every single time, forever.
//
// Deliberately takes secretKeyBytes as a plain argument rather than
// reading `keyPair` from React state/closure — every call site below
// calls this in the same tick it just decrypted/generated that exact
// value locally, before the corresponding setKeyPair()/setKeyPairState()
// state update has necessarily committed, so reading `keyPair` here
// would risk enrolling a stale or still-null key.
//
// Deliberately fire-and-forget: this NEVER throws, NEVER blocks its
// caller, and has no code path that can fail the login/unlock it's
// attached to, touch the already-valid key that was just established, or
// generate a replacement keypair — it only ever calls the existing,
// unmodified deviceUnlock.js `setupDeviceUnlock` (itself unmodified —
// same fresh-assertion-required, no-account-id-parameter contract as
// every other stage). A pre-existing wrapper is never overwritten
// (allowOverwrite stays false), and ALREADY_ENROLLED/any other failure is
// treated identically: a missed convenience, never an error condition.
async function enrollDeviceUnlockSilently(secretKeyBytes) {
  try {
    if (!isDeviceUnlockAvailable()) return; // browser / no native plugin on Android or Windows desktop — never attempted
    if (localStorage.getItem('watch_is_guest') === 'true') return; // guests have no server-side identity to enroll
    if (!(secretKeyBytes instanceof Uint8Array) || secretKeyBytes.length !== 32) return;
    await nativeSetupDeviceUnlock(secretKeyBytes, { allowOverwrite: false, strict: isStrictDeviceUnlockEnabled() });
    console.log('[CryptoContext] Device unlock enrolled for this account on this device.');
  } catch (e) {
    if (e?.code === 'ALREADY_ENROLLED') return; // harmless — a wrapper already exists here, never overwritten
    // HARDWARE_UNAVAILABLE, AUTH_FAILED (biometric cancelled),
    // NOT_AUTHENTICATED, ASSERTION_FETCH_FAILED, or anything unexpected —
    // all just mean "no convenience enrollment this time." Logged by
    // error code/message only — never the secret key or any passphrase.
    console.warn('[CryptoContext] Device unlock enrollment failed (login/unlock is unaffected):', e?.code || e?.message || e);
  }
}

// Stage 4 integration point. Attempted ONLY from the specific cold-start
// spots below (never on a warm in-memory/sessionStorage key) — see
// deviceUnlock.js's own doc comment for why this never accepts/derives an
// accountId itself, and SahaplayE2eePlugin.java's class comment for the
// account-binding incident this design is built to prevent.
//
// This function is the ONE place CryptoContext trusts a device-unlock
// result: it independently re-derives the public key from the recovered
// secret key (nacl.box.keyPair.fromSecretKey, the exact same helper every
// other key-restore path in this file already uses) and compares it
// against `serverPublicKeyB64` — the account's ACTUAL public key, as just
// confirmed by the server in the same request that established the account
// has a key at all. deviceUnlock.js deliberately does not do this
// comparison itself (it has no knowledge of "the server's public key").
//
// Returns the verified keyPair on success, or null on ANY failure —
// unavailable platform, no enrollment, assertion/network failure,
// biometric cancel, Keystore invalidation, corrupt wrapper, or a
// public-key mismatch. null here NEVER means "this account has no key" —
// it only ever means "could not use device unlock this time," and every
// caller below treats it as exactly that: fall back to the existing
// passphrase/recovery UI, unchanged.
// Code of the most recent tryRestoreViaDeviceUnlock failure (null on success).
// Lets callers tell "user cancelled Windows Hello / biometric" apart from
// every other failure, so a cancel can go straight to the passphrase prompt.
let lastDeviceUnlockFailureCode = null;
const isUserCancelCode = (c) => (isTauriApp() || isCapacitorApp()) && (c === 'AUTH_FAILED' || c === 'TIMEOUT'); // native only

async function tryRestoreViaDeviceUnlock(serverPublicKeyB64, isCancelled = () => false) {
  lastDeviceUnlockFailureCode = null;
  if (!serverPublicKeyB64) return null; // nothing to verify against — never attempt
  if (!isDeviceUnlockAvailable()) return null;

  // This runs at the very first tick of a genuinely cold app launch —
  // earlier than anything else in the app has had a chance to confirm the
  // WebView's network stack is actually up yet. A transient failure here
  // (the assertion fetch specifically — a real network round-trip) used to
  // give up immediately and fall straight to the passphrase/password
  // prompt for what's often just a momentary startup race, not a real
  // "nothing enrolled" or "biometric failed" condition. Retrying a couple
  // of times with a short backoff costs at most ~1.2s on a real failure,
  // and turns "always asks again right after a cold start" into "works
  // once the network catches up" for the common transient case. Never
  // retries AUTH_FAILED (a biometric prompt was actually shown and
  // cancelled/failed — retrying would just re-trigger it), or any other
  // genuine, non-transient failure (NO_KEY_FOR_ACCOUNT, KEY_INVALIDATED,
  // CORRUPT_WRAPPER, HARDWARE_UNAVAILABLE, ALREADY_IN_PROGRESS) — only the
  // two codes that specifically mean "couldn't even reach the assertion
  // step yet."
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (isCancelled()) return null; // caller unmounted (e.g. logged out) mid-retry — stop, don't touch anything further
    try {
      // strict is ignored on Android (the enrolled Keystore key already
      // encodes its own auth policy at generation time — see
      // E2eeKeyStore.java's buildKeySpec); Windows' DPAPI blob carries no
      // such policy of its own, so device_unlock.rs needs to be told
      // explicitly whether to gate this specific unlock behind a fresh
      // Windows Hello check.
      const secretKey = await unlockDeviceKey({ strict: isStrictDeviceUnlockEnabled() });
      if (isCancelled()) return null; // resolved after the caller stopped caring — discard, don't call setState on an unmounted effect
      const kp = nacl.box.keyPair.fromSecretKey(secretKey);
      if (encodeBase64(kp.publicKey) !== serverPublicKeyB64) {
        console.warn('[CryptoContext] Device unlock returned a key that does not match the server public key — discarding and falling back to passphrase/recovery.');
        return null; // a real verification failure, not transient — never retry this
      }
      return kp;
    } catch (e) {
      const transient = e?.code === 'ASSERTION_FETCH_FAILED' || e?.code === 'NOT_AUTHENTICATED';
      if (!transient || attempt === MAX_ATTEMPTS) {
        // Every failure mode here — NOT_AVAILABLE, NOT_AUTHENTICATED,
        // ASSERTION_FETCH_FAILED, NO_VALID_ASSERTION, NO_KEY_FOR_ACCOUNT,
        // KEY_INVALIDATED, CORRUPT_WRAPPER, HARDWARE_UNAVAILABLE,
        // AUTH_FAILED, ALREADY_IN_PROGRESS, NATIVE_UNAVAILABLE, or any
        // unexpected exception — is reported identically: no key. This is
        // the same "unknown/protected, not confirmed-absent" bucket the
        // my-keys network-failure fix already established below; device
        // unlock only ever ADDS a shortcut into an already-confirmed-
        // present key, it never substitutes for that check.
        lastDeviceUnlockFailureCode = e?.code || null;
        console.warn('[CryptoContext] Device unlock not used, falling back to passphrase/recovery:', e?.code || e?.message || e);
        return null;
      }
      await new Promise(r => setTimeout(r, attempt * 400)); // 400ms, then 800ms
    }
  }
  return null;
}

const CryptoContext = createContext(null);

// Loads (or creates) a guest's NaCl keypair. Two storage formats are handled:
//   NEW: { pk: number[], blob: <encryptGuestKey output> } — secret key wrapped
//        at rest (AES-256-GCM, device-random password — see crypto.js).
//   OLD: { pk: number[], sk: number[] } — raw, unencrypted secret key, from
//        before this fix. Still honored so an existing guest keeps the SAME
//        identity (and can still decrypt their existing E2EE history) — it's
//        just silently re-saved in the new wrapped format right away, a
//        one-time, transparent upgrade with no visible behavior change.
async function loadOrCreateGuestKeyPair(cleanUser) {
  const guestKey = `wt_guest_kp_${cleanUser}`;
  const saved = localStorage.getItem(guestKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.blob && parsed.pk) {
        const sk = await decryptGuestKey(parsed.blob);
        if (sk && sk.length === 32) {
          // decryptGuestKey transparently falls back to the old, slow
          // PBKDF2-wrapped format for a blob saved before crypto.js's
          // encryptWithRawKey fix — re-save now via the fast wrap so that
          // fallback (and its ~600k-round latency) is only ever paid once
          // for this guest, never again on any later reload/reopen.
          try {
            const blob = await encryptGuestKey(sk);
            localStorage.setItem(guestKey, JSON.stringify({ pk: parsed.pk, blob }));
          } catch (e) {
            console.warn('[CryptoContext] Guest key fast-wrap upgrade failed (keeping old blob):', e);
          }
          return { publicKey: new Uint8Array(parsed.pk), secretKey: sk };
        }
        // Corrupted/unreadable wrapped blob — fall through to generating a
        // fresh identity below (guest identities have no server-side backup
        // to recover from either way, same as a corrupted legacy blob always
        // resulted in before this fix).
      } else if (parsed && parsed.sk && parsed.pk) {
        const kp = { publicKey: new Uint8Array(parsed.pk), secretKey: new Uint8Array(parsed.sk) };
        try {
          const blob = await encryptGuestKey(kp.secretKey);
          localStorage.setItem(guestKey, JSON.stringify({ pk: parsed.pk, blob }));
        } catch (e) {
          console.warn('[CryptoContext] Guest key at-rest upgrade failed (keeping legacy format):', e);
        }
        return kp;
      }
    } catch (e) {
      console.warn('[CryptoContext] Failed to parse saved guest key, generating a new one:', e);
    }
  }
  const kp = generateKeyPair();
  try {
    const blob = await encryptGuestKey(kp.secretKey);
    localStorage.setItem(guestKey, JSON.stringify({ pk: Array.from(kp.publicKey), blob }));
  } catch (e) {
    // Wrapping failed (e.g. WebCrypto unavailable) — still persist the raw
    // legacy format rather than not persisting at all, so this guest
    // identity survives a reload the same way it always has. Worse than the
    // wrapped format, but strictly no worse than this code's behavior before
    // this fix, and never silently drops the identity.
    console.warn('[CryptoContext] Guest key at-rest wrap failed, saving unwrapped:', e);
    localStorage.setItem(guestKey, JSON.stringify({ pk: Array.from(kp.publicKey), sk: Array.from(kp.secretKey) }));
  }
  return kp;
}

export function CryptoProvider({ children }) {
  const [keyPair, setKeyPairState] = useState(null);
  const [isReady, setIsReady]      = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  // True once the user dismissed the passphrase prompt ("Not now"): the app opens
  // with the key still absent (chats stay encrypted) instead of sitting behind
  // DeviceUnlockOverlay forever. Cleared whenever a lock/unlock cycle restarts.
  const [unlockDeferred, setUnlockDeferred] = useState(false);
  // Guards retryGuestKeySetup below against overlapping calls (Room.jsx can
  // call it as a one-shot kick while a wait is in flight) — not exposed,
  // purely an internal re-entrancy guard.
  const guestRetryInFlightRef = useRef(false);

  // Guest key load/create, callable both at mount and on-demand (see
  // retryGuestKeySetup below). Always re-reads localStorage fresh rather
  // than closing over a value from an earlier call — a guest who lands on
  // /room/xxx before choosing a display name can have this run once with
  // no watch_username set yet (falls back to a placeholder "anon" identity)
  // and only get their real chosen name written to localStorage moments
  // later, well after this mount-once effect already returned. Re-reading
  // on retry picks up whatever name is ACTUALLY current by then.
  const restoreGuestKey = useCallback(async () => {
    // Safe to call unconditionally (retryGuestKeySetup is exposed to
    // Room.jsx as a generic self-heal kick) — but this logic is only ever
    // correct for the guest/no-token case the mount effect below already
    // gates on. A registered account calling this would incorrectly treat
    // itself as a guest and load/create the WRONG key, so re-check the same
    // condition here rather than trusting every future caller to remember to.
    if (!(localStorage.getItem('watch_is_guest') === 'true' || !localStorage.getItem('watch_token'))) return null;
    try {
      const username = localStorage.getItem('watch_username');
      const cleanUser = (username || 'anon').toLowerCase();
      console.log('[CryptoContext] restoreGuestKey: loading/creating key for', cleanUser);
      const kp = await loadOrCreateGuestKeyPair(cleanUser);
      console.log('[CryptoContext] restoreGuestKey: key ready for', cleanUser);
      setKeyPairState(kp);
      setIsReady(true);
      return kp;
    } catch (e) {
      // Never let a guest key failure leave keyPair silently null forever
      // with nothing to recover it — see retryGuestKeySetup's own comment
      // for the case this guards (an exception here previously meant the
      // mount effect's setKeyPairState call was simply never reached, and
      // nothing else in the app ever tried again short of a full reload).
      console.error('[CryptoContext] restoreGuestKey failed:', e);
      setIsReady(true);
      return null;
    }
  }, []);

  // Exposed so Room.jsx's send paths can self-heal instead of asking the
  // user to refresh the page. Reported live: a brand-new guest's key
  // sometimes never became ready at all (send stayed stuck on "Encryption
  // keys not ready yet" indefinitely) until a hard reload — which works
  // ONLY because it re-runs the mount effect below from scratch. This is
  // that exact same recovery path, callable without a real reload.
  const retryGuestKeySetup = useCallback(async () => {
    if (guestRetryInFlightRef.current) return;
    guestRetryInFlightRef.current = true;
    try {
      await restoreGuestKey();
    } finally {
      guestRetryInFlightRef.current = false;
    }
  }, [restoreGuestKey]);

  // On mount: restore key from sessionStorage (page refresh resilience)
  useEffect(() => {
    // Set on unmount and threaded into tryRestoreViaDeviceUnlock's retry
    // loop (see its own doc comment) — without this, a still-in-flight
    // retry (each attempt can take up to ~800ms) could resolve after this
    // effect's owner has already gone away (a real app never unmounts
    // CryptoProvider, but tests render/unmount it constantly) and call
    // into whatever native plugin mock/instance happens to be installed
    // by then, or call setState on an unmounted component.
    let cancelled = false;
    (async () => {
      try {
        const isGuest  = localStorage.getItem('watch_is_guest') === 'true';

        if (isGuest || !localStorage.getItem('watch_token')) {
          // Guests: key persisted (encrypted at rest, see loadOrCreateGuestKeyPair)
          // in localStorage so E2EE messages survive tab close + reopen.
          await restoreGuestKey();
          return;
        }

        // Registered user: restore from AES-encrypted sessionStorage —
        // UNLESS "require fingerprint/Windows Hello every time I open the
        // app" is on. That setting's whole contract is "ask again on a
        // genuinely NEW app launch, never merely on foreground/resume/
        // backgrounding" — checking it exactly here is what makes that
        // true: this mount effect body runs exactly once per real app
        // launch/process (this Provider is mounted once at the app root;
        // switching to another app and back does NOT re-run it, only a
        // real process restart does — deliberately NOT using Capacitor's
        // appStateChange/resume events, which fire on every such switch,
        // not just a new launch). On Windows, a genuine process restart
        // (Quit from tray + relaunch, a crash, or an OS logoff/restart)
        // maps onto this exact same guarantee; a plain hide-to-tray/reopen
        // (the window's X button, by this app's own design — see main.rs)
        // does NOT restart the process or re-run this effect at all, which
        // is why that specific transition needs its own separate handling
        // below (the desktop_window_hidden/desktop_window_shown listener)
        // rather than being covered by this mount effect. On browser / no
        // native plugin, isStrictDeviceUnlockEnabled() is irrelevant in
        // practice (isDeviceUnlockAvailable() gates it below anyway).
        const strictModeActive = (isCapacitorApp() || isTauriApp()) && isStrictDeviceUnlockEnabled();
        if (strictModeActive) {
          // Never trust a cached session key under strict mode — the point
          // is a fresh check every launch, not a shortcut past it. This
          // only clears this tab's own decrypted-key cache; it does NOT
          // touch the native Keystore enrollment itself.
          clearSessionKey();
        }
        const secretKey = strictModeActive ? null : await loadKeyFromSession();
        const sessionKp = (secretKey && secretKey.length === 32) ? nacl.box.keyPair.fromSecretKey(secretKey) : null;

        // Fetch the server's current key status up front, whether or not a
        // session key was found — a key cached in THIS tab's sessionStorage
        // from before this account's server-side identity was rotated
        // (password reset without a recovery key, or any future re-setup)
        // must never be trusted just because it's present and well-formed.
        // The old code only ever checked the server when sessionStorage was
        // EMPTY, so a tab whose cached key silently fell behind the
        // account's actual registered key kept using it forever — a page
        // refresh reloads that exact same stale sessionStorage entry, never
        // re-consulting the server, so nothing short of an explicit logout
        // (which clears it) ever recovered. Confirmed live: after
        // completing the passphrase-setup flow, another already-open tab
        // for the same account kept its pre-reset key and could no longer
        // decrypt anything encrypted against the new one, indefinitely.
        const tkn = localStorage.getItem('watch_token');
        let serverCheckOk = false;
        let serverHasExistingKey = false;
        let serverPublicKeyB64 = null;
        if (tkn) {
          try {
            const res = await fetch(`${API}/api/auth/my-keys`, { headers: { 'Authorization': `Bearer ${tkn}` }, cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              serverHasExistingKey = !!(data.publicKey && data.encryptedPrivateKey);
              serverPublicKeyB64 = data.publicKey || null;
              serverCheckOk = true;
            }
          } catch (e) { console.warn('[CryptoContext] my-keys check failed:', e); }
        }

        // A network failure here must NOT force a re-auth prompt on every
        // transient blip at app launch — same "couldn't ask, don't
        // invalidate what's already known" policy dmKeyResolution.js uses
        // for other users' keys, applied here to this account's own. Only a
        // POSITIVE mismatch (the server confirms a different — or no —
        // public key) discards the cached session key; "couldn't check"
        // keeps using it exactly as before this fix.
        if (sessionKp && (!serverCheckOk || (serverPublicKeyB64 && encodeBase64(sessionKp.publicKey) === serverPublicKeyB64))) {
          setKeyPairState(sessionKp);
        } else {
          if (sessionKp) {
            console.warn('[CryptoContext] Cached session key no longer matches this account\'s server-registered public key — discarding it and re-establishing.');
            clearSessionKey();
          }
          // No LOCAL key found (or the one found didn't match) — this
          // happens not just for brand-new accounts, but also for an
          // EXISTING account on any device/tab that lost its sessionStorage
          // (closing a mobile browser tab wipes it, even though the JWT in
          // localStorage keeps the user "logged in" with no fresh password
          // entry), or whose cached key was just discarded above. Blindly
          // generating a new keypair here — the old behavior — silently
          // overwrites the account's ONE registered public key server-side,
          // permanently breaking decryption of every message encrypted
          // under the previous key, on every device, including this
          // account's own past sent messages. serverCheckOk/
          // serverHasExistingKey/serverPublicKeyB64 were already fetched
          // above: if the server already has a key for this account, this
          // device needs the password to recover the SAME identity (via
          // reloadPrivateKeyWithPassword) instead of minting a new one.

          // A THROWN fetch (network failure, timeout, CORS, server down, etc.)
          // used to leave serverHasExistingKey at its default `false` and fall
          // straight through to "genuinely brand new" below — silently
          // minting a fresh keypair and overwriting a REAL, EXISTING
          // account's public key server-side the moment its my-keys check
          // merely failed to complete, not because the server actually
          // confirmed no key exists. Confirmed live: a network failure here
          // reliably corrupts an existing account's publicKey (encryptedPrivateKey
          // is untouched, since save-public-key below never writes it — but the
          // two columns end up describing two different keypairs). Treating
          // "couldn't check" the same as "server confirmed a key" (i.e. asking
          // for recovery) is always safe: KeyRecoveryModal's own retry paths
          // (reloadPrivateKeyWithPassword / switchToPassphraseUnlock) just
          // re-run this same my-keys fetch, so a transient failure only costs
          // the user a retry — never a silently corrupted identity. A
          // genuinely brand-new account only ever reaches here via a REAL
          // network outage (a new row's my-keys always resolves 200 with
          // publicKey: null, which does NOT throw), and "log out and back in"
          // (surfaced by reloadPrivateKeyWithPassword's own error message)
          // correctly falls through to Login.jsx's normal first-time key setup.
          // Cold-start device unlock (Android/Windows only): the server has just
          // POSITIVELY confirmed this account already has a real public key
          // (serverHasExistingKey), so — and ONLY so — there is something
          // legitimate to try to restore without a passphrase prompt. This
          // never runs on a network failure (serverCheckOk === false): with
          // no confirmed serverPublicKeyB64 to verify against,
          // tryRestoreViaDeviceUnlock has nothing to check the recovered key
          // against and returns null immediately anyway (see its own guard),
          // so this always falls through to the exact same
          // needsReauth-on-network-failure behavior as before this stage.
          const restoredKp = serverHasExistingKey ? await tryRestoreViaDeviceUnlock(serverPublicKeyB64, () => cancelled) : null;
          if (cancelled) return; // stopped caring while the (possibly retried) restore attempt was in flight
          if (restoredKp) {
            await saveKeyToSession(restoredKp.secretKey);
            setKeyPairState(restoredKp);
            // Not re-enrolling here — restoredKp only exists because a
            // wrapper is ALREADY enrolled on this device (that's what
            // tryRestoreViaDeviceUnlock just succeeded against). See
            // enrollDeviceUnlockSilently's own doc comment for where the
            // actual enrollment calls live (every password/passphrase/
            // recovery success path, none of which run when this branch does).
            console.log('[CryptoContext] Key restored via device unlock ✅');
          } else if (serverHasExistingKey && isUserCancelCode(lastDeviceUnlockFailureCode)) {
            // Cancelled Windows Hello / biometric: go straight to the
            // passphrase prompt instead of the account-password modal.
            switchToPassphraseUnlock().catch(() => setNeedsReauth(true));
          } else if (serverHasExistingKey || !serverCheckOk) {
            if (!serverCheckOk) {
              console.warn('[CryptoContext] Could not verify key status with server (network failure) — treating as needing recovery rather than risking an incorrect new keypair.');
            } else {
              console.log('[CryptoContext] Local key missing but account already has one server-side — need password/passphrase to recover it.');
            }
            setNeedsReauth(true);
          } else {
            // No key ANYWHERE — server confirms none, and this device has
            // none cached either. This used to be treated as "genuinely
            // brand new, safe to auto-generate" and silently minted a
            // replacement keypair here, uploaded via a fire-and-forget
            // save-public-key call that never even writes an
            // encryptedPrivateKey backup. That state is indistinguishable
            // from an EXISTING account that just had its E2EE identity
            // cleared by a password reset performed without a recovery key
            // (see ResetPassword.jsx) — silently fabricating a new identity
            // there is exactly the bug this closes. There is no reliable way
            // to tell "truly brand new" apart from "lost its identity" from
            // this signal alone, so neither case is auto-generated anymore:
            // both route through the same explicit passphrase-setup UI
            // Login.jsx uses (EncryptionUnlockGate, isSetup: true) — the
            // only place a new keypair for this account gets created from
            // here on. This mount effect only reaches this branch outside a
            // fresh login (e.g. a reload after the user skipped that setup
            // prompt), so it's expected to keep asking until they complete it.
            console.log('[CryptoContext] No key found locally or server-side — requesting explicit encryption setup.');
            const myUname = localStorage.getItem('watch_username');
            window.dispatchEvent(new CustomEvent('encryption_needs_passphrase', {
              detail: { isSetup: true, token: tkn, username: myUname }
            }));
          }
        }
      } catch (e) {
        console.error('[CryptoContext] Failed to restore key from session:', e);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Windows: main.rs hides the window instead of terminating the process on
  // the X button (so calls/notifications keep working in the background,
  // same as Discord/Slack), then emits "desktop_window_shown" when it comes
  // back (tray "Open", relaunching the .exe, or a notification click). The
  // mount effect above only runs on a real process start, so without this
  // listener a strict-mode account closed with X and reopened was never
  // asked for Windows Hello again — reported as "closed and reopened, no
  // Hello prompt". Notification clicks were deliberately excluded by an
  // earlier product decision: Rust emits desktop_toast_clicked right after
  // its own desktop_window_shown for those, so the re-lock is delayed a
  // beat and cancelled if that toast event arrives.
  const windowReopenLockRef = useRef({ timer: null, inFlight: false });
  useEffect(() => {
    if (!isTauriApp()) return;
    let disposed = false;
    const unlisteners = [];
    const state = windowReopenLockRef.current;

    const relock = async () => {
      if (state.inFlight) return;
      if (!isStrictDeviceUnlockEnabled()) return;
      const tkn = localStorage.getItem('watch_token');
      if (!tkn || localStorage.getItem('watch_is_guest') === 'true') return;
      state.inFlight = true;
      try {
        clearSessionKey();
        setUnlockDeferred(false);
        setKeyPairState(null); // DeviceUnlockOverlay blurs the app while this runs
        let serverPublicKeyB64 = null;
        try {
          const res = await fetch(`${API}/api/auth/my-keys`, { headers: { 'Authorization': `Bearer ${tkn}` }, cache: 'no-store' });
          if (res.ok) serverPublicKeyB64 = (await res.json()).publicKey || null;
        } catch (e) { console.warn('[CryptoContext] my-keys check failed on reopen:', e); }
        const kp = await tryRestoreViaDeviceUnlock(serverPublicKeyB64, () => disposed);
        if (disposed) return;
        if (kp) {
          await saveKeyToSession(kp.secretKey);
          setKeyPairState(kp);
        } else {
          if (isUserCancelCode(lastDeviceUnlockFailureCode)) {
            switchToPassphraseUnlock().catch(() => setNeedsReauth(true)); // cancelled Hello -> passphrase directly
          } else {
            setNeedsReauth(true); // same passphrase/password fallback as a cold start
          }
        }
      } finally {
        state.inFlight = false;
      }
    };

    import('@tauri-apps/api/event').then(({ listen }) => {
      const add = (name, cb) => listen(name, cb).then((un) => {
        if (disposed) un(); else unlisteners.push(un);
      });
      add('desktop_window_shown', () => {
        clearTimeout(state.timer);
        state.timer = setTimeout(relock, 300);
      });
      add('desktop_toast_clicked', () => { clearTimeout(state.timer); });
    }).catch((e) => console.warn('[CryptoContext] could not listen for window reopen:', e));

    return () => {
      disposed = true;
      clearTimeout(state.timer);
      unlisteners.forEach((un) => { try { un(); } catch { /* ignore */ } });
    };
  }, []);

  /** Store key pair in memory + encrypted sessionStorage. */
  const setKeyPair = useCallback(async (kp) => {
    setKeyPairState(kp);
    try {
      await saveKeyToSession(kp.secretKey);
    } catch (e) {
      console.warn('[CryptoContext] Session save failed:', e);
    }
  }, []);

  /**
   * Re-derives the private key from a user-supplied password.
   * Fetches the encrypted key blob from the server (requires valid JWT),
   * decrypts it client-side, and stores in session.
   * Throws on wrong password or network error.
   */
  const reloadPrivateKeyWithPassword = useCallback(async (password) => {
    const token = localStorage.getItem('watch_token');
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API}/api/auth/my-keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch key from server');

    const data = await res.json();
    if (!data.encryptedPrivateKey) {
      throw new Error('No encrypted private key found on server. Please log out and back in.');
    }

    // Decrypt client-side with the user's password
    const secretKey = await decryptPrivateKey(data.encryptedPrivateKey, password);
    if (!secretKey || secretKey.length !== 32) {
      throw new Error('Wrong password or corrupted key');
    }

    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    await saveKeyToSession(kp.secretKey);
    setKeyPairState(kp);
    setNeedsReauth(false);
    enrollDeviceUnlockSilently(kp.secretKey); // fire-and-forget, see its own doc comment
    console.log('[CryptoContext] Keys restored from server ✅');
    // Returned (purely additive — no existing caller inspected this
    // function's resolved value before) so a caller offering "Remember
    // this browser" right after this unlock (KeyRecoveryModal.jsx) can
    // enroll with the exact key just recovered, without depending on
    // React's own state-update timing to see it via useCrypto() again in
    // the same event handler.
    return kp;
  }, []);

  /**
   * Escape hatch from KeyRecoveryModal's password prompt for an account that
   * has migrated to an independent encryption passphrase (Profile.jsx's
   * "Encryption passphrase" section) — the login password no longer unwraps
   * this account's key by design, so KeyRecoveryModal's password field will
   * never work for it. Hands off to EncryptionUnlockGate (mounted once at
   * the App level) instead of guessing this from a decrypt failure, which
   * would be ambiguous with a genuine password typo.
   */
  const switchToPassphraseUnlock = useCallback(async () => {
    const token = localStorage.getItem('watch_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API}/api/auth/my-keys`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch key from server');
    const data = await res.json();
    if (!data.encryptedPrivateKey) throw new Error('No encrypted private key found on server. Please log out and back in.');
    setNeedsReauth(false);
    window.dispatchEvent(new CustomEvent('encryption_needs_passphrase', {
      // skipDeviceUnlock: the user (or a cancelled Hello prompt) already
      // decided against native unlock — the gate must not silently retry it.
      detail: { encryptedPrivateKey: data.encryptedPrivateKey, publicKey: data.publicKey, token, skipDeviceUnlock: true }
    }));
  }, []);

  /**
   * Enrolls Device Unlock (Android Keystore-backed) for the CURRENTLY
   * established E2EE key. Deliberately requires an already-present
   * in-memory keyPair — there is no path from this function to generating
   * or altering key material, and it throws rather than doing anything if
   * called before the account's real E2EE key exists (first-device setup
   * must complete via the existing password/passphrase flow first; see
   * Login.jsx / OAuthEncryptionModal — untouched by this stage). No UI
   * calls this yet (Stage 4 is CryptoContext + glue only); a later stage's
   * Profile "Device Unlock" section is expected to call it after an
   * explicit, user-initiated opt-in.
   */
  const enrollDeviceUnlock = useCallback(async ({ allowOverwrite = false } = {}) => {
    if (localStorage.getItem('watch_is_guest') === 'true') {
      throw new Error('Device unlock is not available for guest accounts.');
    }
    if (!keyPair || !keyPair.secretKey) {
      throw new Error('No encryption key established yet — cannot enroll device unlock before your E2EE key exists.');
    }
    await nativeSetupDeviceUnlock(keyPair.secretKey, { allowOverwrite });
  }, [keyPair]);

  /**
   * Profile → Device Unlock → "Require fingerprint every time I open the
   * app" toggle handler. An Android Keystore key's authentication policy
   * (30-minute silent-reuse window vs. authenticate-on-every-use) is fixed
   * at generation time and cannot be changed on an existing key in place —
   * see E2eeKeyStore.java's buildKeySpec — so switching this setting
   * re-enrolls (allowOverwrite: true) with the new policy baked into a
   * freshly generated key, rather than silently changing the existing
   * one's behavior. The preference itself is persisted regardless of
   * whether the re-enroll succeeds (it is not secret — see
   * deviceUnlockSettings.js), so it takes effect the next time a key IS
   * enrolled even if this particular re-enroll attempt fails (e.g. no
   * network for a fresh assertion, biometric cancelled): never throws,
   * never regenerates the E2EE keypair itself, never touches an existing
   * wrapper it couldn't successfully replace.
   *
   * Returns a plain status object (rather than throwing) so the Settings
   * UI can tell the difference between "the setting took effect AND the
   * device is actually re-enrolled under the new policy" and "the setting
   * is saved, but the old key/policy is still active until the next
   * successful enrollment" — a caller that only checked "did this throw"
   * would never learn about the second case, which is exactly the kind of
   * silent partial-failure that makes a stale key look like a broken
   * toggle.
   *
   * @returns {Promise<{persisted: true, reenrolled: boolean, reason?: string}>}
   */
  const setDeviceUnlockRequireEveryOpen = useCallback(async (enabled) => {
    setStrictDeviceUnlockEnabled(enabled);
    if (!isDeviceUnlockAvailable()) {
      return { persisted: true, reenrolled: false, reason: 'NOT_AVAILABLE' };
    }
    if (!keyPair || !keyPair.secretKey) {
      return { persisted: true, reenrolled: false, reason: 'NO_KEY_YET' };
    }
    try {
      await nativeSetupDeviceUnlock(keyPair.secretKey, { allowOverwrite: true, strict: enabled });
      return { persisted: true, reenrolled: true };
    } catch (e) {
      // ALREADY_ENROLLED can't happen here (allowOverwrite is always true);
      // any other failure (AUTH_FAILED, HARDWARE_UNAVAILABLE,
      // NOT_AUTHENTICATED, ASSERTION_FETCH_FAILED) just means the OLD
      // wrapper (old policy) is left in place for now — the setting itself
      // still took effect and will apply to the next successful enrollment.
      const reason = e?.code || e?.message || 'UNKNOWN';
      console.warn('[CryptoContext] Failed to re-enroll device unlock for the new "require fingerprint every open" setting:', reason);
      return { persisted: true, reenrolled: false, reason };
    }
  }, [keyPair]);

  /** "Forget this device" — see deviceUnlock.js's clearDeviceUnlock for why this is distinct from logout. */
  const forgetDeviceUnlock = useCallback(async () => {
    await nativeClearDeviceUnlock();
  }, []);

  /** Convenience check for UI: is Device Unlock enrolled for the current account on this device? */
  const checkDeviceUnlockEnrolled = useCallback(async () => {
    return nativeHasDeviceUnlock();
  }, []);

  /** Clear key from memory + session (call on logout). */
  const clearKeys = useCallback(() => {
    setKeyPairState(null);
    setNeedsReauth(false);
    clearSessionKey();
    // Remove legacy insecure localStorage key if it exists
    const username = localStorage.getItem('watch_username');
    if (username) {
      localStorage.removeItem(`e2e_keypair_${username}`);
    }
  }, []);

  // authUtils.js's clearUserSession() — the single function nearly every
  // logout/sign-out path in the app calls — clears the sessionStorage-level
  // key material itself (see its own comment) and dispatches this event so
  // that, too, drops the in-memory keyPair/needsReauth state immediately,
  // without every one of those ~15 call sites having to also import and call
  // clearKeys() directly. Calling clearKeys() explicitly (as Profile.jsx's
  // logout button does) still works fine alongside this — both are
  // idempotent.
  useEffect(() => {
    const handler = () => {
      setKeyPairState(null);
      setNeedsReauth(false);
    };
    window.addEventListener('wt_session_cleared', handler);
    return () => window.removeEventListener('wt_session_cleared', handler);
  }, []);

  return (
    <CryptoContext.Provider value={{
      keyPair, setKeyPair, clearKeys, isReady, needsReauth, reloadPrivateKeyWithPassword, switchToPassphraseUnlock, unlockDeferred, deferUnlock: () => setUnlockDeferred(true),
      enrollDeviceUnlock, enrollDeviceUnlockSilently, forgetDeviceUnlock, checkDeviceUnlockEnrolled,
      setDeviceUnlockRequireEveryOpen, isDeviceUnlockRequireEveryOpenEnabled: isStrictDeviceUnlockEnabled,
      retryGuestKeySetup,
    }}>
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used within <CryptoProvider>');
  return ctx;
}





