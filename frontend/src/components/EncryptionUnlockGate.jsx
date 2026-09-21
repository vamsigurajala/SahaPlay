/**
 * EncryptionUnlockGate.jsx
 *
 * Handles unlocking E2EE for an email/password account that has migrated off
 * password-derived key wrapping onto an independent encryption passphrase
 * (see Profile.jsx's "Encryption passphrase" section, and the encryption
 * audit this closes: wrapping with the login password meant the server —
 * which necessarily sees that password on every login — could in principle
 * derive the same wrapping key).
 *
 * Why this is its own always-mounted component rather than something
 * Login.jsx renders directly: Login.jsx calls navigate() immediately after a
 * successful password login (so the app doesn't block on the — potentially
 * slow, 600k-iteration PBKDF2 — key-unwrap step), which unmounts Login.jsx
 * before the async decrypt attempt resolves. A modal owned by Login.jsx's
 * own state would never actually render. Mounted once at the App level
 * (same pattern as GlobalChatWidget/KeyRecoveryModal), it survives that
 * navigation and reacts to a plain window CustomEvent instead.
 *
 * Login.jsx dispatches 'encryption_needs_passphrase' with
 * { detail: { encryptedPrivateKey, publicKey, token } } when the account's
 * stored key blob no longer unwraps with the just-used login password —
 * which, for an account on the legacy scheme, would mean a genuinely wrong
 * password (already rejected earlier by /api/login itself) or a corrupted
 * blob; for a MIGRATED account, it's simply expected, since the password
 * was never the right secret for that blob anymore.
 *
 * Stage 4 (device unlock): this is the ONE place both dispatch sites for
 * 'encryption_needs_passphrase' funnel through (Login.jsx's handleLogin,
 * and CryptoContext's switchToPassphraseUnlock via KeyRecoveryModal's "use
 * passphrase instead"), which makes it the single choke point for
 * shortcutting the passphrase prompt on Android/Windows. Every event
 * `detail` here already carries the account's real, server-confirmed
 * `publicKey`, so the same verify-before-trust rule CryptoContext's own
 * cold-start path uses applies here identically: a device-unlock result is
 * only ever accepted if its re-derived public key matches `ctx.publicKey`.
 * On failure (unavailable, not enrolled, network, biometric cancel,
 * mismatch, anything) this simply falls through to rendering the exact
 * same passphrase modal as before device unlock existed — never a raw
 * native error, never a silent no-op.
 *
 * Native (Android/Windows) device unlock ONLY — a plain browser tab always
 * goes straight to the passphrase modal below. An earlier version of this
 * app also offered a browser-only WebAuthn PRF "Remember this browser"
 * shortcut; it was removed after repeated production failures across
 * different browsers/authenticators (PRF support is inconsistent enough
 * across real devices that it was never reliable) in favor of always
 * asking for the passphrase on a plain browser tab, which always works.
 */
import React, { useState, useEffect, useCallback } from 'react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { useCrypto } from '../contexts/CryptoContext';
import { decryptPrivateKey, encryptPrivateKey, mnemonicToSecretKey, hashRecoveryPhrase } from '../lib/crypto.js';
import { markKeyResetForBanner } from '../lib/keyResetBanner.js';
import { API } from '../lib/api';
import { isCapacitorApp, isTauriApp } from '../lib/platform';
import { isDeviceUnlockAvailable, unlockDeviceKey } from '../lib/deviceUnlock.js';
import { isStrictDeviceUnlockEnabled } from '../lib/deviceUnlockSettings.js';
import OAuthEncryptionModal from './OAuthEncryptionModal';
import RecoveryPhraseModal from './RecoveryPhraseModal';

export default function EncryptionUnlockGate() {
  const { setKeyPair, enrollDeviceUnlockSilently } = useCrypto();
  const [ctx, setCtx] = useState(null); // { encryptedPrivateKey, publicKey, token }
  // While true, the passphrase modal stays hidden — set whenever a native
  // (Android/Windows) device-unlock attempt is genuinely worth trying, so
  // it never delays or hides the modal when it isn't available. Browser
  // (plain web tab) unlock always goes straight to the passphrase prompt —
  // see this file's header comment.
  const [checkingDeviceUnlock, setCheckingDeviceUnlock] = useState(false);
  // Set by handleSetPassphrase right after a BRAND-NEW E2EE identity is
  // created (isSetup flow only — see its own comment). Holds this tab's only
  // copy of the just-generated recovery phrase, in memory alone (never
  // localStorage/sessionStorage/IndexedDB/cookies/URL/backend — the server
  // only ever receives its hash, computed before this state is even set).
  // Its presence takes over rendering from the passphrase modal until the
  // user explicitly confirms RecoveryPhraseModal — ctx is deliberately NOT
  // cleared until then, so the setup flow is never treated as "done" while
  // the phrase has been generated but not yet shown/acknowledged.
  const [pendingRecoveryPhrase, setPendingRecoveryPhrase] = useState(null);

  // Auto-dismiss gate ONLY if user explicitly logs out or navigates BACK to login/signup
  useEffect(() => {
    const handleLogout = () => { setCtx(null); setPendingRecoveryPhrase(null); };
    const handleCheckRoute = () => {
      const path = (window.location.pathname || '').toLowerCase();
      if (path === '/login' || path === '/signup' || path === '/reset-password') {
        setCtx(null);
        setPendingRecoveryPhrase(null);
      }
    };

    window.addEventListener('user_logged_out', handleLogout);
    window.addEventListener('popstate', handleCheckRoute);

    return () => {
      window.removeEventListener('user_logged_out', handleLogout);
      window.removeEventListener('popstate', handleCheckRoute);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.encryptedPrivateKey || e.detail?.isSetup) {
        const detail = e.detail;
        // If dispatched during login navigation, wait briefly for navigation to land on home
        setTimeout(() => {
          const path = (window.location.pathname || '').toLowerCase();
          if (path !== '/login' && path !== '/signup' && path !== '/reset-password') {
            setCtx(detail);
            setCheckingDeviceUnlock(!detail.isSetup && !detail.skipDeviceUnlock && (isCapacitorApp() || isTauriApp()) && isDeviceUnlockAvailable());
          }
        }, 300);
      }
    };
    window.addEventListener('encryption_needs_passphrase', handler);
    return () => window.removeEventListener('encryption_needs_passphrase', handler);
  }, []);

  useEffect(() => {
    if (!ctx || ctx.isSetup || !checkingDeviceUnlock) return;
    let cancelled = false;
    (async () => {
      // Step 1: native (Android/Windows) — tried first, unchanged from before.
      if ((isCapacitorApp() || isTauriApp()) && isDeviceUnlockAvailable()) {
        try {
          const secretKey = await unlockDeviceKey({ strict: isStrictDeviceUnlockEnabled() });
          const kp = nacl.box.keyPair.fromSecretKey(secretKey);
          if (ctx.publicKey && encodeBase64(kp.publicKey) === ctx.publicKey) {
            if (!cancelled) {
              await setKeyPair(kp);
              setCtx(null);
            }
            return;
          }
          console.warn('[EncryptionUnlockGate] Device unlock key did not match the server public key — falling back to the passphrase prompt.');
        } catch (e) {
          console.warn('[EncryptionUnlockGate] Device unlock not used, falling back to the passphrase prompt:', e?.code || e?.message || e);
        }
      }

      if (!cancelled) setCheckingDeviceUnlock(false);
    })();
    return () => { cancelled = true; };
  }, [ctx, checkingDeviceUnlock, setKeyPair]);

  const handleUnlock = useCallback(async (passphrase) => {
    const secretKey = await decryptPrivateKey(ctx.encryptedPrivateKey, passphrase);
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    await setKeyPair(kp);
    enrollDeviceUnlockSilently(kp.secretKey); // fire-and-forget; see CryptoContext.jsx's own doc comment
    setCtx(null);
  }, [ctx, setKeyPair, enrollDeviceUnlockSilently]);

  const handleSetPassphrase = useCallback(async (passphrase) => {
    // 24-letter recovery key — same format and derivation Signup.jsx uses
    // (phrase's SHA-256 IS the secret key), not the 24-word BIP39 mnemonic
    // secretKeyToMnemonic produces. Two different recovery-credential formats
    // for the same feature was needlessly inconsistent (reported: users who
    // go through this screen got a 24-word phrase while everyone who signs
    // up normally gets a compact 24-letter key). mnemonicToSecretKey already
    // recognizes this exact 24-letter shape (see its own doc comment), so
    // handleRecover's "enter your recovery phrase" input keeps working
    // unchanged for accounts created either way.
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randBytes = crypto.getRandomValues(new Uint8Array(24));
    let phraseStr = '';
    for (let i = 0; i < 24; i++) phraseStr += chars[randBytes[i] % chars.length];
    const phrase = phraseStr.toUpperCase();
    const secretKey = await mnemonicToSecretKey(phrase);
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    const encryptedPrivKey = await encryptPrivateKey(kp.secretKey, passphrase);
    const pubKeyStr = encodeBase64(kp.publicKey);
    const recoveryKeyHash = await hashRecoveryPhrase(phrase);
    const res = await fetch(`${API}/api/auth/setup-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.token}` },
      body: JSON.stringify({ username: ctx.username, publicKey: pubKeyStr, encryptedPrivateKey: encryptedPrivKey, recoveryKeyHash })
    });
    if (!res.ok) throw new Error('Failed to save your new encryption key. Please try again.');
    await setKeyPair(kp);
    enrollDeviceUnlockSilently(kp.secretKey);
    const myUsername = ctx.username || localStorage.getItem('watch_username');
    if (myUsername) {
      try { localStorage.setItem(`wt_pk_${myUsername.toLowerCase()}`, pubKeyStr); } catch {}
      window.dispatchEvent(new CustomEvent('public_key_updated', { detail: { username: myUsername, publicKey: pubKeyStr } }));
    }
    // Show the user the EXACT phrase whose hash was just sent above — never
    // a second, freshly-generated one. Deliberately NOT setCtx(null) here:
    // that only happens once RecoveryPhraseModal's required
    // reveal-and-acknowledge gate is actually confirmed (see its render
    // below), so a user who closes the tab mid-way is asked again next
    // time rather than the app silently treating recovery as configured.
    setPendingRecoveryPhrase(phrase);
  }, [ctx, setKeyPair, enrollDeviceUnlockSilently]);

  const handleRecoveryPhraseConfirmed = useCallback(() => {
    setPendingRecoveryPhrase(null);
    setCtx(null);
  }, []);

  const handleRecover = useCallback(async (phrase, newPassphrase) => {
    const secretKey = await mnemonicToSecretKey(phrase);
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    if (encodeBase64(kp.publicKey) !== ctx.publicKey) {
      throw new Error("That recovery phrase doesn't match this account.");
    }
    const encryptedPrivKey = await encryptPrivateKey(kp.secretKey, newPassphrase);
    const recoveryKeyHash = await hashRecoveryPhrase(phrase);
    const res = await fetch(`${API}/api/auth/setup-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.token}` },
      body: JSON.stringify({ publicKey: ctx.publicKey, encryptedPrivateKey: encryptedPrivKey, recoveryKeyHash })
    });
    if (!res.ok) throw new Error('Failed to save your encryption key. Please try again.');
    await setKeyPair(kp);
    enrollDeviceUnlockSilently(kp.secretKey); // fire-and-forget; see CryptoContext.jsx's own doc comment
    setCtx(null);
  }, [ctx, setKeyPair, enrollDeviceUnlockSilently]);

  const handleStartFresh = useCallback(async (newPassphrase) => {
    // Same 24-letter recovery-key format as handleSetPassphrase above —
    // see its comment for why this replaced secretKeyToMnemonic here too.
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randBytes = crypto.getRandomValues(new Uint8Array(24));
    let phraseStr = '';
    for (let i = 0; i < 24; i++) phraseStr += chars[randBytes[i] % chars.length];
    const phrase = phraseStr.toUpperCase();
    const secretKey = await mnemonicToSecretKey(phrase);
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    const encryptedPrivKey = await encryptPrivateKey(kp.secretKey, newPassphrase);
    const pubKeyStr = encodeBase64(kp.publicKey);
    const recoveryKeyHash = await hashRecoveryPhrase(phrase);
    const res = await fetch(`${API}/api/auth/setup-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.token}` },
      body: JSON.stringify({ publicKey: pubKeyStr, encryptedPrivateKey: encryptedPrivKey, recoveryKeyHash })
    });
    if (!res.ok) throw new Error('Failed to save your new encryption key. Please try again.');
    await setKeyPair(kp);
    enrollDeviceUnlockSilently(kp.secretKey);
    const myUsername = localStorage.getItem('watch_username');
    if (myUsername) {
      const pubStr = encodeBase64(kp.publicKey);
      try { localStorage.setItem(`wt_pk_${myUsername.toLowerCase()}`, pubStr); } catch {}
      window.dispatchEvent(new CustomEvent('public_key_updated', { detail: { username: myUsername, publicKey: pubStr } }));
    }
    // This is the "forgot recovery key, mint a new identity" path — every
    // existing private chat's decrypt now depends on every contact's client
    // noticing the rotation before their next send. That's usually fast but
    // not instant (see keyResetBanner.js's own doc comment), so flag a short
    // window for GlobalChatWidget to show a plain-language heads-up instead
    // of leaving a transient "Encrypted message" looking like a bug.
    markKeyResetForBanner(myUsername);
    setCtx(null);
  }, [ctx, setKeyPair, enrollDeviceUnlockSilently]);

  const handleCancel = useCallback(() => {
    setCtx(null);
  }, []);

  if (pendingRecoveryPhrase) {
    return <RecoveryPhraseModal phrase={pendingRecoveryPhrase} onConfirmed={handleRecoveryPhraseConfirmed} />;
  }

  if (!ctx || checkingDeviceUnlock) return null;

  return (
    <OAuthEncryptionModal
      mode={ctx.isSetup ? "set" : "unlock"}
      isPasswordAccount
      onSetPassphrase={handleSetPassphrase}
      onUnlock={handleUnlock}
      onRecover={handleRecover}
      onStartFresh={handleStartFresh}
      onSkip={handleCancel}
    />
  );
}
