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
import { isCapacitorApp, isTauriApp } from '../lib/platform';
import {
  isDeviceUnlockAvailable,
  unlockDeviceKey,
  setupDeviceUnlock as nativeSetupDeviceUnlock,
  clearDeviceUnlock as nativeClearDeviceUnlock,
  hasDeviceUnlock as nativeHasDeviceUnlock,
} from '../lib/deviceUnlock.js';
import { isStrictDeviceUnlockEnabled, setStrictDeviceUnlockEnabled } from '../lib/deviceUnlockSettings.js';
// Browser-only WebAuthn "Remember this browser" device unlock — entirely
// separate code path from the native Android/Windows imports above (see
// browserDeviceUnlock.js's own header comment on why the two never share
// code). No aliasing needed: no name here collides with the native imports.
import {
  isBrowserDeviceUnlockAvailable,
  hasBrowserDeviceUnlock,
  enrollBrowser,
  unlockViaBrowser,
  forgetBrowser,
} from '../lib/browserDeviceUnlock.js';

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
async function tryRestoreViaDeviceUnlock(serverPublicKeyB64, isCancelled = () => false) {
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
        console.warn('[CryptoContext] Device unlock not used, falling back to passphrase/recovery:', e?.code || e?.message || e);
        return null;
      }
      await new Promise(r => setTimeout(r, attempt * 400)); // 400ms, then 800ms
    }
  }
  return null;
}

// Browser "Remember this browser" restore — the third link in the restore
// chain (warm session -> Android/Windows native -> THIS -> passphrase/
// recovery). Deliberately a single attempt, no retry loop (unlike
// tryRestoreViaDeviceUnlock above): that function's retries exist
// specifically for a cold native-app launch racing the WebView's own
// network stack coming up, which doesn't apply to an ordinary browser tab.
// Same verify-before-trust contract as the native version and as
// EncryptionUnlockGate.jsx's own device-unlock check: the recovered key is
// only ever trusted after independently re-deriving its public key and
// comparing it to the server's ACTUAL public key. Returns null on ANY
// failure — unavailable, not enrolled, ceremony declined, server
// rejection, stale wrapper, public-key mismatch — every caller below
// treats null identically: fall back to the existing passphrase/recovery
// UI, exactly like a failed native attempt does.
async function tryRestoreViaBrowserUnlock(serverPublicKeyB64) {
  if (!serverPublicKeyB64) return null; // nothing to verify against — never attempt
  if (!isBrowserDeviceUnlockAvailable()) return null;
  try {
    const secretKey = await unlockViaBrowser();
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    if (encodeBase64(kp.publicKey) !== serverPublicKeyB64) {
      console.warn('[CryptoContext] Browser device unlock returned a key that does not match the server public key — discarding and falling back to passphrase/recovery.');
      return null;
    }
    return kp;
  } catch (e) {
    // NOT_AVAILABLE, NOT_AUTHENTICATED, NO_LOCAL_WRAPPER, NO_CREDENTIALS,
    // GET_FAILED (ceremony cancelled/failed), PRF_NOT_CONFIRMED,
    // VERIFICATION_FAILED (server rejected the assertion), STALE_WRAPPER,
    // or any unexpected error — all mean the same thing here: no key via
    // this path this time. browserDeviceUnlock.js's unlockViaBrowser
    // already handles clearing a genuinely stale local wrapper itself; this
    // function's only job is the same fallback every other device-unlock
    // failure mode already gets.
    console.warn('[CryptoContext] Browser device unlock not used, falling back to passphrase/recovery:', e?.code || e?.message || e);
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
          // Restore order step 3: browser WebAuthn device unlock ("Remember
          // this browser") — attempted ONLY when native (Android/Windows)
          // restore didn't already succeed above. On native platforms this
          // is a guaranteed no-op (isBrowserDeviceUnlockAvailable() is false
          // there — see browserDeviceUnlock.js's own header comment), so
          // this never races or duplicates the native attempt.
          const restoredViaBrowser = !restoredKp && serverHasExistingKey ? await tryRestoreViaBrowserUnlock(serverPublicKeyB64) : null;
          if (cancelled) return;
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
          } else if (restoredViaBrowser) {
            await saveKeyToSession(restoredViaBrowser.secretKey);
            setKeyPairState(restoredViaBrowser);
            // Not re-enrolling here either, same reasoning as above —
            // restoredViaBrowser only exists because a browser wrapper is
            // ALREADY enrolled (tryRestoreViaBrowserUnlock just succeeded
            // against it). "Remember this browser" enrollment is always an
            // explicit, user-initiated action (the checkbox), never
            // triggered from a successful restore.
            console.log('[CryptoContext] Key restored via browser device unlock ✅');
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
              enrollDeviceUnlockSilently(newKP.secretKey); // fire-and-forget, see its own doc comment

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
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Windows-only: the mount effect above handles a genuine process launch
  // (Quit from tray + relaunch, a crash, or an OS restart/logoff) — but
  // this app's own main.rs deliberately hides the window instead of
  // terminating the process on the X button (so calls/notifications keep
  // working in the background, same as Discord/Slack), which means a plain
  // close-then-reopen from the tray never re-runs the mount effect at all.
  // Strict mode's product spec explicitly asks for THIS exact transition
  // to require a fresh Windows Hello check too — main.rs emits
  // "desktop_window_hidden"/"desktop_window_shown" for precisely this
  // (never on ordinary alt-tab/minimize/restore, which never touch that
  // Rust code path at all — see main.rs's own comments on those two
  // events). Entirely separate from the mount effect above; does not
  // touch or duplicate its "genuinely brand new account" branch, since a
  // reopen can only ever happen for an account that already had a key.
  useEffect(() => {
    if (!isTauriApp()) return;
    let cancelled = false;
    let unlistenHidden = null;
    let unlistenShown = null;

    (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      if (cancelled) return;

      unlistenHidden = await listen('desktop_window_hidden', () => {
        if (!isStrictDeviceUnlockEnabled()) return; // OFF: preserve existing behavior exactly — no-op
        // Drop the in-memory/session key now, so the next
        // "desktop_window_shown" genuinely requires a fresh Windows Hello
        // check rather than silently reusing what's still in memory — the
        // Windows equivalent of Android's clearSessionKey() at the start
        // of a fresh strict-mode launch.
        clearSessionKey();
        setKeyPairState(null);
      });

      unlistenShown = await listen('desktop_window_shown', async () => {
        if (!isStrictDeviceUnlockEnabled()) return; // OFF: reopening never prompts — existing behavior preserved
        const tkn = localStorage.getItem('watch_token');
        if (!tkn || localStorage.getItem('watch_is_guest') === 'true') return; // not a registered session — nothing to unlock
        let serverPublicKeyB64 = null;
        try {
          const res = await fetch(`${API}/api/auth/my-keys`, { headers: { 'Authorization': `Bearer ${tkn}` } });
          if (res.ok) {
            const data = await res.json();
            serverPublicKeyB64 = data.publicKey || null;
          }
        } catch (e) { console.warn('[CryptoContext] my-keys check (strict reopen) failed:', e); }
        if (cancelled) return;

        const restoredKp = serverPublicKeyB64 ? await tryRestoreViaDeviceUnlock(serverPublicKeyB64, () => cancelled) : null;
        if (cancelled) return;
        if (restoredKp) {
          await saveKeyToSession(restoredKp.secretKey);
          setKeyPairState(restoredKp);
          console.log('[CryptoContext] Key restored via Windows Hello device unlock (tray reopen) ✅');
        } else {
          // Windows Hello declined/failed/unavailable, or the my-keys check
          // itself failed — same fallback as every other device-unlock
          // failure mode: the existing passphrase/recovery UI, never a new
          // keypair.
          setNeedsReauth(true);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unlistenHidden) unlistenHidden();
      if (unlistenShown) unlistenShown();
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

  /**
   * "Remember this browser" — explicit, user-initiated (checkbox) WebAuthn
   * PRF enrollment. Same first-device-setup guard as enrollDeviceUnlock
   * above: there is no path from this function to generating or altering
   * key material, and it throws rather than doing anything if there is no
   * real E2EE key to protect yet.
   *
   * Accepts an OPTIONAL explicit secretKeyBytes, falling back to the
   * current in-memory keyPair.secretKey when omitted. The explicit form
   * matters for exactly one calling pattern: a caller (KeyRecoveryModal.jsx)
   * that just called reloadPrivateKeyWithPassword() and wants to enroll
   * with the key it JUST recovered, in the same handler, before this
   * component has necessarily re-rendered with the updated `keyPair` from
   * React state — reading the stale closed-over `keyPair` in that exact
   * window would incorrectly throw "no key established yet" despite one
   * having just been set. Callers that already have a stable, current
   * keyPair (e.g. a standalone "Remember this browser" button in Profile,
   * not chained immediately after an unlock) can simply omit the argument.
   *
   * Unlike enrollDeviceUnlockSilently, this is NEVER called automatically —
   * every call site is a UI component reacting to the user explicitly
   * checking the "Remember this browser" box, and every call site is
   * expected to catch a rejection and show it (this function does not
   * swallow errors the way the silent native enrollment does, since the
   * user made an explicit choice this time and deserves to know if it
   * didn't work).
   */
  const enrollBrowserDeviceUnlock = useCallback(async (secretKeyBytes) => {
    if (localStorage.getItem('watch_is_guest') === 'true') {
      throw new Error('Browser device unlock is not available for guest accounts.');
    }
    const keyToEnroll = secretKeyBytes || keyPair?.secretKey;
    if (!keyToEnroll) {
      throw new Error('No encryption key established yet — cannot remember this browser before your E2EE key exists.');
    }
    return enrollBrowser(keyToEnroll);
  }, [keyPair]);

  /** "Forget this browser" — see browserDeviceUnlock.js's forgetBrowser for why this only ever touches the local WebAuthn wrapper, never anything else. */
  const forgetBrowserDeviceUnlock = useCallback(async () => {
    await forgetBrowser();
  }, []);

  /** Convenience check for UI: is "Remember this browser" enrolled for the current account on THIS browser? */
  const checkBrowserDeviceUnlockEnrolled = useCallback(async () => {
    return hasBrowserDeviceUnlock();
  }, []);

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
      keyPair, setKeyPair, clearKeys, isReady, needsReauth, reloadPrivateKeyWithPassword, switchToPassphraseUnlock,
      enrollDeviceUnlock, enrollDeviceUnlockSilently, forgetDeviceUnlock, checkDeviceUnlockEnrolled,
      setDeviceUnlockRequireEveryOpen, isDeviceUnlockRequireEveryOpenEnabled: isStrictDeviceUnlockEnabled,
      // Browser "Remember this browser" WebAuthn device unlock — see each
      // function's own doc comment above. isBrowserDeviceUnlockAvailable is
      // the plain imported function itself (sync, no hook state involved),
      // same pattern isDeviceUnlockRequireEveryOpenEnabled above already uses.
      enrollBrowserDeviceUnlock, forgetBrowserDeviceUnlock, checkBrowserDeviceUnlockEnrolled, isBrowserDeviceUnlockAvailable,
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





