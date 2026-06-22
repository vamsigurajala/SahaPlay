/**
 * crypto.js — WatchTogether E2EE Cryptographic Utilities
 *
 * Uses the browser's native Web Crypto API (SubtleCrypto) for all heavy lifting.
 * NaCl (tweetnacl) handles the actual message encryption boxes.
 *
 * Key derivation: PBKDF2-SHA-256 (600k iterations, OWASP 2024)
 * Key wrapping:   AES-256-GCM
 * Messaging DM:   NaCl box (Curve25519 + XSalsa20-Poly1305)
 *                 → recipient ciphertext (ephemeral key box)
 *                 → sender ciphertext   (sender's own public key box, same ephemeral key)
 * Messaging Group:NaCl secretbox (XSalsa20-Poly1305) with per-recipient key wrap
 * Recovery:       BIP39 24-word mnemonic
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { entropyToMnemonic, mnemonicToEntropy } from './bip39.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;   // bytes
const IV_LENGTH   = 12;   // bytes for AES-GCM

// ─── Internal helpers ─────────────────────────────────────────────────────────
export function robustDecode(str) {
  if (typeof str !== 'string') return new Uint8Array(0);
  // If it's a URL or contains slashes that don't look like base64, or starts with http, it's likely not ciphertext.
  if (str.startsWith('http') || str.includes('://')) {
    return new Uint8Array(0); 
  }
  try {
    return decodeBase64(str.trim());
  } catch (e) {
    // Just return empty if it's not valid base64
    return new Uint8Array(0);
  }
}

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  const bin = atob(b64.trim().replace(/\s/g, ''));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ─── PBKDF2 Key Derivation ────────────────────────────────────────────────────
/**
 * Derives a 256-bit AES-GCM CryptoKey from a password + salt using PBKDF2-SHA256.
 */
export async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Media Encryption (AES-GCM) ───────────────────────────────────────────────
/**
 * Encrypts a file (Blob or ArrayBuffer) using a fresh random AES-256 key.
 * Returns { encryptedBlob, mediaKeyBytes }
 */
export async function encryptMedia(fileOrBuf) {
  const buf = (fileOrBuf instanceof Blob) ? await fileOrBuf.arrayBuffer() : fileOrBuf;
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']
  );
  
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, buf
  );

  // Pack IV + Ciphertext
  const packed = new Uint8Array(iv.length + cipherBuf.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipherBuf), iv.length);
  
  return {
    encryptedBlob: new Blob([packed], { type: 'application/octet-stream' }),
    mediaKeyBytes: keyBytes
  };
}

/**
 * Decrypts an encrypted buffer back to its original bytes.
 */
export async function decryptMedia(packedBuf, keyBytes) {
  const packed = new Uint8Array(packedBuf);
  const iv = packed.slice(0, IV_LENGTH);
  const cipher = packed.slice(IV_LENGTH);

  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  );

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, cipher
  );
  
  return new Blob([plainBuf]);
}

// ─── Private Key Wrapping / Unwrapping ───────────────────────────────────────
/**
 * Encrypts a NaCl secret key (32 bytes) with the user's password.
 * Returns base64(salt[16] | iv[12] | ciphertext).
 */
export async function encryptPrivateKey(secretKeyBytes, password) {
  const salt   = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv     = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const aesKey = await deriveKeyFromPassword(password, salt);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, secretKeyBytes);
  const packed = new Uint8Array(SALT_LENGTH + IV_LENGTH + cipherBuf.byteLength);
  packed.set(salt, 0);
  packed.set(iv,   SALT_LENGTH);
  packed.set(new Uint8Array(cipherBuf), SALT_LENGTH + IV_LENGTH);
  return bufToB64(packed.buffer);
}

/**
 * Decrypts the blob back to raw NaCl secret key bytes.
 * Throws on wrong password.
 */
export async function decryptPrivateKey(blob64, password) {
  const packed = new Uint8Array(b64ToBuf(blob64));
  const salt   = packed.slice(0, SALT_LENGTH);
  const iv     = packed.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const cipher = packed.slice(SALT_LENGTH + IV_LENGTH);
  const aesKey = await deriveKeyFromPassword(password, salt);
  const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipher);
  return new Uint8Array(plain);
}

// ─── Key Pair Generation ──────────────────────────────────────────────────────
export function generateKeyPair() {
  return nacl.box.keyPair();
}

// ─── Recovery Phrase (BIP39, async due to SHA-256 checksum) ──────────────────
/**
 * Converts a 32-byte secret key to a 24-word BIP39 mnemonic (async).
 */
export async function secretKeyToMnemonic(secretKeyBytes) {
  return entropyToMnemonic(secretKeyBytes);
}

/**
 * Converts a 24-word mnemonic or a 24-letter key back to the 32-byte secret key (async, verifies checksum).
 */
export async function mnemonicToSecretKey(mnemonic) {
  const m = mnemonic.trim().toLowerCase();
  if (m.includes(' ')) {
    // Legacy BIP39 24-word phrase
    return mnemonicToEntropy(m);
  } else {
    // New 24-letter recovery key
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m));
    return new Uint8Array(hashBuf);
  }
}

/**
 * SHA-256 hashes the mnemonic for server-side verification storage only.
 * The actual phrase NEVER leaves the client.
 */
export async function hashRecoveryPhrase(mnemonic) {
  const enc  = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(mnemonic.trim().toLowerCase()));
  return bufToB64(hash);
}

// ─── Group Message Encryption (per-message symmetric key) ────────────────────
/**
 * Encrypts a plaintext string for a group room.
 * Uses a fresh 32-byte symmetric key per message, boxed for each recipient's public key.
 *
 * @param {string}   plaintext
 * @param {Array<{ username: string, publicKey: Uint8Array }>} recipients  (includes self)
 * @param {{ publicKey: Uint8Array, secretKey: Uint8Array }} myKeyPair
 * @param {string}   myUsername
 * @returns {{ ciphertext: string, nonce: string, keys: Record<string,string> }}
 */
export function encryptGroupMessage(plaintext, recipients, myKeyPair, myUsername) {
  const msgKey   = nacl.randomBytes(nacl.secretbox.keyLength);
  const msgNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipherbox = nacl.secretbox(decodeUTF8(plaintext), msgNonce, msgKey);
  if (!cipherbox) throw new Error('Group encrypt failed');

  // Ensure self is included so sender can read own messages
  const allRecipients = [...recipients];
  if (!allRecipients.some(r => r.username.toLowerCase() === myUsername.toLowerCase()) && myKeyPair.publicKey) {
    allRecipients.push({ username: myUsername, publicKey: myKeyPair.publicKey });
  }

  const keys = {};
  for (const { username, publicKey } of allRecipients) {
    if (!username || !publicKey) continue;
    let pk = publicKey;
    if (typeof pk === 'string') {
      try { pk = robustDecode(pk); } catch (e) { continue; }
    }
    if (pk.length !== 32) continue;
    try {
      const keyNonce     = nacl.randomBytes(nacl.box.nonceLength);
      const encryptedKey = nacl.box(msgKey, keyNonce, pk, myKeyPair.secretKey);
      const packed       = new Uint8Array(keyNonce.length + encryptedKey.length);
      packed.set(keyNonce, 0);
      packed.set(encryptedKey, keyNonce.length);
      keys[username.toLowerCase()] = encodeBase64(packed);
    } catch (e) {
      console.warn('[crypto] skipping user with bad key:', username, e);
    }
  }

  if (Object.keys(keys).length === 0) {
    throw new Error('Group encrypt failed: no valid recipient keys');
  }

  return {
    ciphertext: encodeBase64(cipherbox),
    nonce:      encodeBase64(msgNonce),
    keys
  };
}

/**
 * Decrypts a group message using this user's private key.
 * Returns plaintext or null on failure.
 */
export function decryptGroupMessage(ciphertext, nonce, encryptedKeyB64, senderPublicKey, mySecretKey) {
  try {
    const packed     = robustDecode(encryptedKeyB64);
    const keyNonce   = packed.slice(0, nacl.box.nonceLength);
    const encKeyBody = packed.slice(nacl.box.nonceLength);
    const senderPkObj = Array.isArray(senderPublicKey) || typeof senderPublicKey !== 'string' ? senderPublicKey : robustDecode(senderPublicKey);
    const mySkObj     = Array.isArray(mySecretKey) || typeof mySecretKey !== 'string' ? mySecretKey : robustDecode(mySecretKey);
    const msgKey     = nacl.box.open(encKeyBody, keyNonce, senderPkObj, mySkObj);
    if (!msgKey) return null;
    const plain = nacl.secretbox.open(robustDecode(ciphertext), robustDecode(nonce), msgKey);
    if (!plain) return null;
    return encodeUTF8(plain);
  } catch (e) {
    console.warn('[crypto] decryptGroupMessage error:', e);
    return null;
  }
}


// ─── DM Encryption (NaCl box, dual-ciphertext) ───────────────────────────────
/**
 * Encrypts a DM plaintext for the recipient AND for the sender (so sender can re-read history).
 *
 * Strategy:
 *   - Generate a fresh ephemeral keypair
 *   - Encrypt once for recipient  (stored in `message`       + `nonce` + `ephemeralPublicKey`)
 *   - Encrypt once for sender     (stored in `senderMessage` + `nonce` — same nonce, same ephemeral)
 *     The sender copy uses NaCl box with sender's OWN public key and the ephemeral secret key.
 *
 * Returns:
 *   { ciphertext, nonce, ephemeralPublicKey, senderCiphertext }
 *
 * @param {string} messageText
 * @param {string} recipientPublicKeyBase64
 * @param {string} senderPublicKeyBase64   — sender's OWN long-term public key (base64)
 */
export function encryptDM(messageText, recipientPublicKeyBase64, senderPublicKeyBase64) {
  const messageUint8  = decodeUTF8(messageText);
  const recipientPK   = robustDecode(recipientPublicKeyBase64);

  if (recipientPK.length !== 32) {
    throw new Error(`Invalid recipient public key length: ${recipientPK.length}. Expected 32.`);
  }

  // Generate ephemeral keypair (new one per message for forward secrecy)
  const ephemeral = nacl.box.keyPair();
  const nonce     = nacl.randomBytes(nacl.box.nonceLength);

  // Recipient ciphertext
  const ciphertext = nacl.box(messageUint8, nonce, recipientPK, ephemeral.secretKey);
  if (!ciphertext) throw new Error('DM encryption failed (recipient)');

  // Sender-readable ciphertext (box to sender's own public key using same ephemeral secret)
  let senderCiphertext = null;
  if (senderPublicKeyBase64) {
    const senderPK = robustDecode(senderPublicKeyBase64);
    if (senderPK.length === 32) {
      const sc = nacl.box(messageUint8, nonce, senderPK, ephemeral.secretKey);
      if (sc) senderCiphertext = encodeBase64(sc);
    }
  }

  return {
    ciphertext:         encodeBase64(ciphertext),
    nonce:              encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeral.publicKey),
    senderCiphertext,   // base64 or null
  };
}

/**
 * Decrypts a DM ciphertext received by the recipient.
 * Returns plaintext or null.
 *
 * @param {string} ciphertextBase64
 * @param {string} nonceBase64
 * @param {string} ephemeralPublicKeyBase64
 * @param {string} myPrivateKeyBase64
 */
export function decryptDM(ciphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64) {
  try {
    const ciphertext  = robustDecode(ciphertextBase64);
    const nonce       = robustDecode(nonceBase64);
    const ephemeralPK = robustDecode(ephemeralPublicKeyBase64);
    const myPrivKey   = robustDecode(myPrivateKeyBase64);

    if (ephemeralPK.length !== 32) return null;
    if (myPrivKey.length !== 32)   return null;

    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPK, myPrivKey);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch (e) {
    console.warn('[crypto] decryptDM error:', e);
    return null;
  }
}

/**
 * Decrypts the SENDER's own copy of a DM (stored in senderMessage column).
 * The sender encrypted a copy for their own public key using the same ephemeral secret.
 * To decrypt: use recipient role but swap in sender's own secret key + ephemeral public key.
 *
 * @param {string} senderCiphertextBase64  — the senderMessage field from DB
 * @param {string} nonceBase64
 * @param {string} ephemeralPublicKeyBase64
 * @param {string} myPrivateKeyBase64       — sender's own secret key
 */
export function decryptDMSenderCopy(senderCiphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64) {
  // Same call signature as decryptDM — it's just nacl.box.open with sender's secret key
  return decryptDM(senderCiphertextBase64, nonceBase64, ephemeralPublicKeyBase64, myPrivateKeyBase64);
}


// ─── Session Storage (encrypted, survives page refresh) ──────────────────────
const SESSION_KEY_NAME = 'wt_sk';
const SESSION_PW_NAME  = 'wt_spw';

function getOrCreateSessionPassword() {
  let pw = localStorage.getItem(SESSION_PW_NAME);
  if (!pw) {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    pw = bufToB64(arr.buffer);
    localStorage.setItem(SESSION_PW_NAME, pw);
  }
  return pw;
}

/** Saves encrypted private key to localStorage (password is random, stored in same session). */
export async function saveKeyToSession(secretKeyBytes) {
  const pw   = getOrCreateSessionPassword();
  const blob = await encryptPrivateKey(secretKeyBytes, pw);
  localStorage.setItem(SESSION_KEY_NAME, blob);
}

/** Loads + decrypts saved key from localStorage. Returns null if not found. */
export async function loadKeyFromSession() {
  const blob = localStorage.getItem(SESSION_KEY_NAME);
  if (!blob) return null;
  try {
    const pw = getOrCreateSessionPassword();
    return await decryptPrivateKey(blob, pw);
  } catch {
    clearSessionKey();
    return null;
  }
}

/** Clears the session key (call on logout). */
export function clearSessionKey() {
  localStorage.removeItem(SESSION_KEY_NAME);
  localStorage.removeItem(SESSION_PW_NAME);
}
