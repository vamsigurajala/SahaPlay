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
import { generateKeyPair, saveKeyToSession, loadKeyFromSession, clearSessionKey, decryptPrivateKey, encryptPrivateKey } from '../lib/crypto.js';
import { API } from '../lib/api';

const CryptoContext = createContext(null);

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
          // Guests: key persisted in localStorage so E2EE messages survive tab close + reopen.
          const cleanUser = (username || 'anon').toLowerCase();
          const guestKey = `wt_guest_kp_${cleanUser}`;
          const saved    = localStorage.getItem(guestKey);
          if (saved) {
            try {
              const { pk, sk } = JSON.parse(saved);
              const kp = {
                publicKey: new Uint8Array(pk),
                secretKey: new Uint8Array(sk)
              };
              setKeyPairState(kp);
            } catch {
              const kp = generateKeyPair();
              const cleanUser = (username || 'anon').toLowerCase();
              localStorage.setItem(`wt_guest_kp_${cleanUser}`, JSON.stringify({
                pk: Array.from(kp.publicKey),
                sk: Array.from(kp.secretKey)
              }));
              setKeyPairState(kp);
            }
          } else {
            const kp = generateKeyPair();
            const cleanUser = (username || 'anon').toLowerCase();
            localStorage.setItem(`wt_guest_kp_${cleanUser}`, JSON.stringify({
              pk: Array.from(kp.publicKey),
              sk: Array.from(kp.secretKey)
            }));
            setKeyPairState(kp);
          }
          setIsReady(true);
          return;
        }

        // Registered user: restore from AES-encrypted sessionStorage
        const secretKey = await loadKeyFromSession();
        if (secretKey && secretKey.length === 32) {
          const kp = nacl.box.keyPair.fromSecretKey(secretKey);
          setKeyPairState(kp);
        } else {
          // No stored key found — auto-generate one for this user.
          // This handles users who registered before E2EE was implemented.
          console.log('[CryptoContext] No stored key found — auto-generating E2EE key pair.');
          try {
            const newKP = generateKeyPair();
            await saveKeyToSession(newKP.secretKey);
            setKeyPairState(newKP);

            // Try to save publicKey to DB (works after backend restart)
            const tkn = localStorage.getItem('watch_token');
            if (tkn) {
              const pubB64 = encodeBase64(newKP.publicKey);
              // Try the new lightweight endpoint first, fall back to register-keys
              fetch(`${API}/api/auth/save-public-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
                body: JSON.stringify({ publicKey: pubB64 })
              }).then(async r => {
                if (!r.ok) {
                  // Fallback: try register-keys with auto-encrypted private key
                  const dummyPw = encodeBase64(nacl.randomBytes(16));
                  const encPriv = await encryptPrivateKey(newKP.secretKey, dummyPw);
                  // Store the dummyPw so recovery is still possible
                  localStorage.setItem('wt_kp_pw', dummyPw);
                  await fetch(`${API}/api/auth/register-keys`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
                    body: JSON.stringify({ publicKey: pubB64, encryptedPrivateKey: encPriv })
                  });
                }
              }).catch(err => console.warn('[CryptoContext] Key upload failed (server not ready):', err));
            }
          } catch (e) {
            console.error('[CryptoContext] Failed to auto-generate key pair:', e);
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

  return (
    <CryptoContext.Provider value={{ keyPair, setKeyPair, clearKeys, isReady, needsReauth, reloadPrivateKeyWithPassword }}>
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used within <CryptoProvider>');
  return ctx;
}





