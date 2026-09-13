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
 * shortcutting the passphrase prompt on Android — exactly the repeated
 * re-entry this feature exists to remove. Every event `detail` here already
 * carries the account's real, server-confirmed `publicKey`, so the same
 * verify-before-trust rule CryptoContext's own cold-start path uses applies
 * here identically: a device-unlock result is only ever accepted if its
 * re-derived public key matches `ctx.publicKey`. On failure (unavailable,
 * not enrolled, network, biometric cancel, mismatch, anything) this simply
 * falls through to rendering the exact same passphrase modal as before
 * device unlock existed — never a raw native error, never a silent no-op.
 */
import React, { useState, useEffect, useCallback } from 'react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { useCrypto } from '../contexts/CryptoContext';
import { decryptPrivateKey, encryptPrivateKey, mnemonicToSecretKey, hashRecoveryPhrase } from '../lib/crypto.js';
import { API } from '../lib/api';
import { isCapacitorApp } from '../lib/platform';
import { isDeviceUnlockAvailable, unlockDeviceKey } from '../lib/deviceUnlock.js';
import OAuthEncryptionModal from './OAuthEncryptionModal';

export default function EncryptionUnlockGate() {
  const { setKeyPair } = useCrypto();
  const [ctx, setCtx] = useState(null); // { encryptedPrivateKey, publicKey, token }
  // While true, the passphrase modal stays hidden — set only when a native
  // device-unlock attempt is genuinely worth trying (Android + available),
  // so this never delays or hides the modal on browser, where it stays
  // `false` for the whole lifetime of a given ctx, unchanged from before.
  const [checkingDeviceUnlock, setCheckingDeviceUnlock] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.encryptedPrivateKey) {
        setCtx(e.detail);
        setCheckingDeviceUnlock(isCapacitorApp() && isDeviceUnlockAvailable());
      }
    };
    window.addEventListener('encryption_needs_passphrase', handler);
    return () => window.removeEventListener('encryption_needs_passphrase', handler);
  }, []);

  useEffect(() => {
    if (!ctx || !checkingDeviceUnlock) return;
    let cancelled = false;
    (async () => {
      try {
        const secretKey = await unlockDeviceKey();
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
        // NOT_AVAILABLE, NOT_AUTHENTICATED, ASSERTION_FETCH_FAILED,
        // NO_VALID_ASSERTION, NO_KEY_FOR_ACCOUNT, KEY_INVALIDATED,
        // CORRUPT_WRAPPER, HARDWARE_UNAVAILABLE, AUTH_FAILED, or any
        // unexpected error — all mean the same thing here: show the
        // passphrase prompt, exactly as before this stage.
        console.warn('[EncryptionUnlockGate] Device unlock not used, falling back to the passphrase prompt:', e?.code || e?.message || e);
      }
      if (!cancelled) setCheckingDeviceUnlock(false);
    })();
    return () => { cancelled = true; };
  }, [ctx, checkingDeviceUnlock, setKeyPair]);

  const handleUnlock = useCallback(async (passphrase) => {
    const secretKey = await decryptPrivateKey(ctx.encryptedPrivateKey, passphrase);
    const kp = nacl.box.keyPair.fromSecretKey(secretKey);
    await setKeyPair(kp);
    setCtx(null);
  }, [ctx, setKeyPair]);

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
    setCtx(null);
  }, [ctx, setKeyPair]);

  if (!ctx || checkingDeviceUnlock) return null;

  return (
    <OAuthEncryptionModal
      mode="unlock"
      isPasswordAccount
      onUnlock={handleUnlock}
      onRecover={handleRecover}
    />
  );
}
