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
 */
import React, { useState, useEffect, useCallback } from 'react';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { useCrypto } from '../contexts/CryptoContext';
import { decryptPrivateKey, encryptPrivateKey, mnemonicToSecretKey, hashRecoveryPhrase } from '../lib/crypto.js';
import { API } from '../lib/api';
import OAuthEncryptionModal from './OAuthEncryptionModal';

export default function EncryptionUnlockGate() {
  const { setKeyPair } = useCrypto();
  const [ctx, setCtx] = useState(null); // { encryptedPrivateKey, publicKey, token }

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.encryptedPrivateKey) setCtx(e.detail);
    };
    window.addEventListener('encryption_needs_passphrase', handler);
    return () => window.removeEventListener('encryption_needs_passphrase', handler);
  }, []);

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

  if (!ctx) return null;

  return (
    <OAuthEncryptionModal
      mode="unlock"
      isPasswordAccount
      onUnlock={handleUnlock}
      onRecover={handleRecover}
    />
  );
}
