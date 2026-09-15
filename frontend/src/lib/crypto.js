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

// ─── Reply-preview privacy ────────────────────────────────────────────────────
// Room.jsx / GlobalChatWidget.jsx each build a local "reply snapshot" object
// (id, username, mediaType, mediaFileName, message) for the sender's own
// instant on-screen preview when replying — that local object legitimately
// carries the already-decrypted preview text so the sender's own bubble
// renders immediately, with no wire trip involved.
//
// The bug (found in the SahaPlay encryption audit): that SAME object,
// including its plaintext `message` field, was then reused verbatim as the
// `replyTo` sent to the server — so every reply leaked up to ~150 chars of
// the original message's plaintext into the `messages.replyTo` DB column,
// completely bypassing E2EE for that content.
//
// This is the one function that must sit between "the local snapshot" and
// "what actually goes over the wire" at every send call site (chat_message
// socket emits, /api/chats/send POSTs) — it strips the object down to only
// what the server legitimately needs (which original message this refers
// to, who sent it, and a media type/filename for a media-only label).
// Recipients never lose the preview text: resolveReplyMessages (Room.jsx /
// GlobalChatWidget.jsx) already resolves it locally, from their own
// already-decrypted copy of the original message, for every message they
// receive, live or from history — it only falls back to a generic "Message"
// label on the rare case the original isn't loaded locally at all.
//
// Older rows written before this fix still have a real (plaintext)
// replyTo.message already stored server-side — resolveReplyMessages' own
// backward-compatible check (an explicit, non-ciphertext-looking message
// string is trusted and displayed as-is) keeps those displaying exactly as
// before. This function only stops NEW messages from repeating the leak;
// it does not, and cannot, retroactively scrub already-stored rows.
export function sanitizeReplyToForWire(replyTo) {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    username: replyTo.username,
    mediaType: replyTo.mediaType || null,
    mediaFileName: replyTo.mediaFileName || null,
  };
}

// ─── Media caption packing ──────────────────────────────────────────────────
// A media message's "message" field is normally just the encrypted media key
// (a plain base64 string) — there was nowhere for a WhatsApp-style caption to
// live, so callers sent it as a second, separate plaintext message instead,
// which is why an image + caption always showed up as two bubbles. Rather
// than add a new DB column or a second encrypted field, the SAME field can
// carry both: when there's a caption, encrypt a tiny JSON envelope instead of
// the bare key. unpackMediaCaption stays backward-compatible with every
// already-sent media message (a bare base64 string, no envelope) by only
// treating the plaintext as an envelope when it actually parses as one with
// a `k` field — anything else falls through to "this whole string is the
// key, no caption," exactly the old behavior.
export function packMediaKeyAndCaption(mediaKeyB64, caption) {
  if (!caption) return mediaKeyB64;
  return JSON.stringify({ k: mediaKeyB64, c: caption });
}
export function unpackMediaKeyAndCaption(plain) {
  if (typeof plain === 'string' && plain.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(plain);
      if (parsed && typeof parsed.k === 'string') {
        return { mediaKeyB64: parsed.k, caption: typeof parsed.c === 'string' ? parsed.c : '' };
      }
    } catch { /* not an envelope — fall through to treating it as a bare key */ }
  }
  return { mediaKeyB64: plain, caption: '' };
}

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

// ─── Fast wrap for an ALREADY-RANDOM secret (session key + guest key at-rest
// storage) ────────────────────────────────────────────────────────────────────
// encryptPrivateKey/decryptPrivateKey above run the wrapping "password"
// through 600k rounds of PBKDF2 — deliberate, correct slowness for a
// human-chosen password (that's the whole point of key-stretching: make
// guessing a low-entropy secret expensive). getOrCreateSessionPassword() and
// getOrCreateGuestSessionPassword() in this file don't hand it a human
// password at all — they generate a fresh crypto.getRandomValues(32) value
// and store it right alongside the wrapped key. That's already full 256-bit
// entropy; running PBKDF2 over it buys zero additional security and was pure
// wasted latency (600k SHA-256 rounds — a real, measurable delay, worse on
// slower/mobile devices) on every guest's first message and every returning
// user's session restore. Import the random value directly as the AES-GCM
// key instead — no derivation step at all.
export async function encryptWithRawKey(secretKeyBytes, rawKeyB64) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // Wrapped in a Uint8Array view (not the bare ArrayBuffer b64ToBuf
  // returns) — every other importKey call in this file passes a TypedArray,
  // and a bare ArrayBuffer crossing a realm boundary (e.g. this file's
  // Uint8Array vs. the test environment's own webcrypto polyfill) can fail
  // SubtleCrypto's BufferSource check even though it's spec-legal.
  const rawKeyBytes = new Uint8Array(b64ToBuf(rawKeyB64));
  const aesKey = await crypto.subtle.importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, secretKeyBytes);
  const packed = new Uint8Array(IV_LENGTH + cipherBuf.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipherBuf), IV_LENGTH);
  return bufToB64(packed.buffer);
}

/**
 * Decrypts a blob wrapped by encryptWithRawKey. Throws on wrong key/format —
 * callers use this to detect an old PBKDF2-wrapped blob (see decryptGuestKey/
 * loadKeyFromSession) rather than needing any explicit format tag: AES-GCM's
 * auth tag makes decrypting with the wrong derivation fail loudly, never
 * silently return wrong plaintext.
 */
export async function decryptWithRawKey(blob64, rawKeyB64) {
  const packed = new Uint8Array(b64ToBuf(blob64));
  const iv     = packed.slice(0, IV_LENGTH);
  const cipher = packed.slice(IV_LENGTH);
  const rawKeyBytes = new Uint8Array(b64ToBuf(rawKeyB64));
  const aesKey = await crypto.subtle.importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
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
// Was localStorage (survives indefinitely, even across a full browser
// restart) — the encryption audit flagged that the wrapped private key
// (wt_sk) and the only secret that unwraps it (wt_spw) sat in the exact same
// storage, readable together by anything with JS execution on the page, for
// as long as the user's account existed. Real sessionStorage narrows that
// window to "while this tab is actually open": closing the tab/browser wipes
// both, and CryptoContext.jsx's existing needsReauth flow (already exercised
// in production today, e.g. whenever a mobile browser reclaims a background
// tab's storage) is what asks for the password again on next open — no new
// code path, just relying on one that already exists and already works.
//
// readMigrated() is the one-time bridge off the old location: an existing
// logged-in user's key currently sits in localStorage, and this fix must not
// force everyone straight into a re-auth prompt the moment it deploys. On
// first read after this change, if sessionStorage doesn't have it yet but
// localStorage does, it's moved over (and removed from localStorage) so this
// tab's *current* session carries on uninterrupted — the tightened lifetime
// only takes effect from the next full close onward.
const SESSION_KEY_NAME = 'wt_sk';
const SESSION_PW_NAME  = 'wt_spw';

function readMigrated(name) {
  const v = sessionStorage.getItem(name);
  if (v) return v;
  const legacy = localStorage.getItem(name);
  if (legacy) {
    sessionStorage.setItem(name, legacy);
    localStorage.removeItem(name);
    return legacy;
  }
  return null;
}

function getOrCreateSessionPassword() {
  let pw = readMigrated(SESSION_PW_NAME);
  if (!pw) {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    pw = bufToB64(arr.buffer);
    sessionStorage.setItem(SESSION_PW_NAME, pw);
  }
  return pw;
}

/** Saves encrypted private key to sessionStorage (key is random, stored alongside).
 *  Uses the fast raw-key wrap (see encryptWithRawKey's own doc comment) — this
 *  "password" is never human-chosen, so PBKDF2 would only add latency, not
 *  security. */
export async function saveKeyToSession(secretKeyBytes) {
  const pw   = getOrCreateSessionPassword();
  const blob = await encryptWithRawKey(secretKeyBytes, pw);
  sessionStorage.setItem(SESSION_KEY_NAME, blob);
}

/** Loads + decrypts saved key from sessionStorage (migrating off localStorage if needed). Returns null if not found. */
export async function loadKeyFromSession() {
  const blob = readMigrated(SESSION_KEY_NAME);
  if (!blob) return null;
  const pw = getOrCreateSessionPassword();
  try {
    return await decryptWithRawKey(blob, pw);
  } catch {
    // Fall back to the old PBKDF2-wrapped format for a blob saved before
    // this fix (same tab session, pre-upgrade page load) — then immediately
    // re-save with the fast wrap so this slow path is only ever paid once.
    try {
      const sk = await decryptPrivateKey(blob, pw);
      saveKeyToSession(sk).catch(() => {});
      return sk;
    } catch {
      clearSessionKey();
      return null;
    }
  }
}

/** Clears the session key (call on logout). Clears both storages — the old
 *  localStorage location included, in case a tab never got the chance to
 *  migrate off it. */
export function clearSessionKey() {
  sessionStorage.removeItem(SESSION_KEY_NAME);
  sessionStorage.removeItem(SESSION_PW_NAME);
  localStorage.removeItem(SESSION_KEY_NAME);
  localStorage.removeItem(SESSION_PW_NAME);
}

// ─── Guest key storage (encrypted at rest) ───────────────────────────────────
// Guests have no password/passphrase at all, so — same as the session-key
// wrapping above — the wrapping secret is a random value generated once per
// device and stored alongside the wrapped key. This does NOT protect against
// an attacker who can read this origin's localStorage wholesale (that
// attacker gets the wrapping secret too — the same inherent limitation
// saveKeyToSession above has); it protects against the strictly worse thing
// it replaces, which was the guest's raw NaCl secret key sitting in
// localStorage with no encryption at all.
const GUEST_PW_NAME = 'wt_guest_spw';

function getOrCreateGuestSessionPassword() {
  let pw = localStorage.getItem(GUEST_PW_NAME);
  if (!pw) {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    pw = bufToB64(arr.buffer);
    localStorage.setItem(GUEST_PW_NAME, pw);
  }
  return pw;
}

/** Wraps a guest's raw NaCl secret key for at-rest storage. Fast raw-key wrap
 *  (see encryptWithRawKey's own doc comment) — this "password" is a random
 *  per-device value, never human-chosen, so PBKDF2 here was pure wasted
 *  latency on every brand-new guest's very first message. */
export async function encryptGuestKey(secretKeyBytes) {
  return encryptWithRawKey(secretKeyBytes, getOrCreateGuestSessionPassword());
}

/** Unwraps a guest's saved key blob. Returns null if missing/corrupted. */
export async function decryptGuestKey(blob64) {
  const pw = getOrCreateGuestSessionPassword();
  try {
    return await decryptWithRawKey(blob64, pw);
  } catch {
    // Fall back to the old PBKDF2-wrapped format for a guest identity saved
    // before this fix — loadOrCreateGuestKeyPair re-saves via encryptGuestKey
    // (now the fast wrap) right after a successful load, so this slow path
    // is only ever paid once per existing guest, never again.
    try {
      return await decryptPrivateKey(blob64, pw);
    } catch {
      return null;
    }
  }
}
