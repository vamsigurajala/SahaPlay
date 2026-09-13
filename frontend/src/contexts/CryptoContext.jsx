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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { generateKeyPair, saveKeyToSession, loadKeyFromSession, clearSessionKey, decryptPrivateKey, encryptPrivateKey, encryptGuestKey, decryptGuestKey } from '../lib/crypto.js';
import { API } from '../lib/api';
import { isCapacitorApp } from '../lib/platform';
import {
  isDeviceUnlockAvailable,
  unlockDeviceKey,
  setupDeviceUnlock as nativeSetupDeviceUnlock,
  clearDeviceUnlock as nativeClearDeviceUnlock,
  hasDeviceUnlock as nativeHasDeviceUnlock,
} from '../lib/deviceUnlock.js';

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
async function tryRestoreViaDeviceUnlock(serverPublicKeyB64) {
  if (!serverPublicKeyB64) return null; // nothing to verify against — never attempt
  if (!isCapacitorApp() || !isDeviceUnlockAvailable()) return null;
  try {
    const secretKey = await unlockDeviceKey();
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    if (encodeBase64(kp.publicKey) !== serverPublicKeyB64) {
      console.warn('[CryptoContext] Device unlock returned a key that does not match the server public key — discarding and falling back to passphrase/recovery.');
      return null;
    }
    return kp;
  } catch (e) {
    // Every failure mode here — NOT_AVAILABLE, NOT_AUTHENTICATED,
    // ASSERTION_FETCH_FAILED, NO_VALID_ASSERTION, NO_KEY_FOR_ACCOUNT,
    // KEY_INVALIDATED, CORRUPT_WRAPPER, HARDWARE_UNAVAILABLE, AUTH_FAILED,
    // ALREADY_IN_PROGRESS, NATIVE_UNAVAILABLE, or any unexpected exception —
    // is reported identically: no key. This is the same "unknown/protected,
    // not confirmed-absent" bucket the my-keys network-failure fix already
    // established below; device unlock only ever ADDS a shortcut into an
    // already-confirmed-present key, it never substitutes for that check.
    console.warn('[CryptoContext] Device unlock not used, falling back to passphrase/recovery:', e?.code || e?.message || e);
    return null;
  }
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

  // On mount: restore key from sessionStorage (page refresh resilience)
  useEffect(() => {
    (async () => {
      try {
        const username = localStorage.getItem('watch_username');
        const isGuest  = localStorage.getItem('watch_is_guest') === 'true';

        if (isGuest || !localStorage.getItem('watch_token')) {
          // Guests: key persisted (encrypted at rest, see loadOrCreateGuestKeyPair)
          // in localStorage so E2EE messages survive tab close + reopen.
          const cleanUser = (username || 'anon').toLowerCase();
          const kp = await loadOrCreateGuestKeyPair(cleanUser);
          setKeyPairState(kp);
          setIsReady(true);
          return;
        }

        // Registered user: restore from AES-encrypted sessionStorage
        const secretKey = await loadKeyFromSession();
        if (secretKey && secretKey.length === 32) {
          const kp = nacl.box.keyPair.fromSecretKey(secretKey);
          setKeyPairState(kp);
        } else {
          // No LOCAL key found — this happens not just for brand-new accounts,
          // but also for an EXISTING account on any device/tab that lost its
          // sessionStorage (closing a mobile browser tab wipes it, even though
          // the JWT in localStorage keeps the user "logged in" with no fresh
          // password entry). Blindly generating a new keypair here — the old
          // behavior — silently overwrites the account's ONE registered
          // public key server-side, permanently breaking decryption of every
          // message encrypted under the previous key, on every device,
          // including this account's own past sent messages. Check the
          // server first: if it already has a key for this account, this
          // device needs the password to recover the SAME identity (via
          // reloadPrivateKeyWithPassword) instead of minting a new one.
          const tkn = localStorage.getItem('watch_token');
          let serverCheckOk = false;
          let serverHasExistingKey = false;
          let serverPublicKeyB64 = null;
          if (tkn) {
            try {
              const res = await fetch(`${API}/api/auth/my-keys`, { headers: { 'Authorization': `Bearer ${tkn}` } });
              if (res.ok) {
                const data = await res.json();
                serverHasExistingKey = !!data.publicKey;
                serverPublicKeyB64 = data.publicKey || null;
                serverCheckOk = true;
              }
            } catch (e) { console.warn('[CryptoContext] my-keys check failed:', e); }
          }

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
          // Cold-start device unlock (Android only): the server has just
          // POSITIVELY confirmed this account already has a real public key
          // (serverHasExistingKey), so — and ONLY so — there is something
          // legitimate to try to restore without a passphrase prompt. This
          // never runs on a network failure (serverCheckOk === false): with
          // no confirmed serverPublicKeyB64 to verify against,
          // tryRestoreViaDeviceUnlock has nothing to check the recovered key
          // against and returns null immediately anyway (see its own guard),
          // so this always falls through to the exact same
          // needsReauth-on-network-failure behavior as before this stage.
          const restoredKp = serverHasExistingKey ? await tryRestoreViaDeviceUnlock(serverPublicKeyB64) : null;
          if (restoredKp) {
            await saveKeyToSession(restoredKp.secretKey);
            setKeyPairState(restoredKp);
            console.log('[CryptoContext] Key restored via device unlock ✅');
          } else if (serverHasExistingKey || !serverCheckOk) {
            if (!serverCheckOk) {
              console.warn('[CryptoContext] Could not verify key status with server (network failure) — treating as needing recovery rather than risking an incorrect new keypair.');
            } else {
              console.log('[CryptoContext] Local key missing but account already has one server-side — need password/passphrase to recover it.');
            }
            setNeedsReauth(true);
          } else {
            // Genuinely brand new — no key anywhere yet. Safe to generate one.
            console.log('[CryptoContext] No stored key found — auto-generating E2EE key pair.');
            try {
              const newKP = generateKeyPair();
              await saveKeyToSession(newKP.secretKey);
              setKeyPairState(newKP);

              if (tkn) {
                const pubB64 = encodeBase64(newKP.publicKey);
                fetch(`${API}/api/auth/save-public-key`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
                  body: JSON.stringify({ publicKey: pubB64 })
                }).catch(err => console.warn('[CryptoContext] Key upload failed (server not ready):', err));
              }
            } catch (e) {
              console.error('[CryptoContext] Failed to auto-generate key pair:', e);
            }
          }
        }
      } catch (e) {
        console.error('[CryptoContext] Failed to restore key from session:', e);
      } finally {
        setIsReady(true);
      }
    })();
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
    console.log('[CryptoContext] Keys restored from server ✅');
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
      detail: { encryptedPrivateKey: data.encryptedPrivateKey, publicKey: data.publicKey, token }
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
    <CryptoContext.Provider value={{ keyPair, setKeyPair, clearKeys, isReady, needsReauth, reloadPrivateKeyWithPassword, switchToPassphraseUnlock, enrollDeviceUnlock, forgetDeviceUnlock, checkDeviceUnlockEnrolled }}>
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used within <CryptoProvider>');
  return ctx;
}





