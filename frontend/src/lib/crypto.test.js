import { describe, test, expect, beforeEach } from 'vitest';
import { encodeBase64 } from 'tweetnacl-util';
import nacl from 'tweetnacl';
import {
  generateKeyPair,
  encryptDM,
  decryptDM,
  decryptDMSenderCopy,
  encryptGroupMessage,
  decryptGroupMessage,
  encryptMedia,
  decryptMedia,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptGuestKey,
  decryptGuestKey,
  sanitizeReplyToForWire,
} from './crypto.js';

// These exercise the actual client-side E2EE primitives end to end (no
// mocking of nacl/WebCrypto) — the goal is to prove real encrypt/decrypt
// round trips still work exactly as before the reply-leak/guest-key-storage
// fixes in this file, and that the new sanitizeReplyToForWire helper never
// lets plaintext through.

beforeEach(() => {
  localStorage.clear();
});

describe('DM encryption (nacl.box, dual ciphertext)', () => {
  test('recipient can decrypt, sender can decrypt their own copy', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const plaintext = 'Hello Bob';

    const enc = encryptDM(plaintext, encodeBase64(bob.publicKey), encodeBase64(alice.publicKey));
    expect(enc.ciphertext).toBeTruthy();
    expect(enc.nonce).toBeTruthy();
    expect(enc.ephemeralPublicKey).toBeTruthy();
    expect(enc.senderCiphertext).toBeTruthy();

    const bobPlain = decryptDM(enc.ciphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(bob.secretKey));
    expect(bobPlain).toBe(plaintext);

    const alicePlain = decryptDMSenderCopy(enc.senderCiphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(alice.secretKey));
    expect(alicePlain).toBe(plaintext);
  });

  test('a third party (wrong private key) cannot decrypt', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const eve = generateKeyPair();
    const enc = encryptDM('secret', encodeBase64(bob.publicKey), encodeBase64(alice.publicKey));
    expect(decryptDM(enc.ciphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(eve.secretKey))).toBeNull();
  });

  test('tampered ciphertext is rejected, not silently corrupted', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const enc = encryptDM('secret', encodeBase64(bob.publicKey), encodeBase64(alice.publicKey));
    const bytes = Uint8Array.from(atob(enc.ciphertext), c => c.charCodeAt(0));
    bytes[0] ^= 0xff; // flip a bit
    const tampered = btoa(String.fromCharCode(...bytes));
    expect(decryptDM(tampered, enc.nonce, enc.ephemeralPublicKey, encodeBase64(bob.secretKey))).toBeNull();
  });

  test('ephemeral keypair (and therefore nonce/ciphertext) differs across messages — forward secrecy', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const a = encryptDM('one', encodeBase64(bob.publicKey), encodeBase64(alice.publicKey));
    const b = encryptDM('two', encodeBase64(bob.publicKey), encodeBase64(alice.publicKey));
    expect(a.ephemeralPublicKey).not.toBe(b.ephemeralPublicKey);
    expect(a.nonce).not.toBe(b.nonce);
  });
});

describe('Group message encryption (per-message key + per-recipient box)', () => {
  test('every recipient (including sender) can decrypt; a non-recipient cannot', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const carol = generateKeyPair();
    const mallory = generateKeyPair(); // not in the room

    const recipients = [
      { username: 'bob', publicKey: bob.publicKey },
      { username: 'carol', publicKey: carol.publicKey },
    ];
    const enc = encryptGroupMessage('hello room', recipients, alice, 'alice');

    expect(Object.keys(enc.keys).sort()).toEqual(['alice', 'bob', 'carol']);

    const bobPlain = decryptGroupMessage(enc.ciphertext, enc.nonce, enc.keys['bob'], alice.publicKey, bob.secretKey);
    expect(bobPlain).toBe('hello room');

    const carolPlain = decryptGroupMessage(enc.ciphertext, enc.nonce, enc.keys['carol'], alice.publicKey, carol.secretKey);
    expect(carolPlain).toBe('hello room');

    const alicePlain = decryptGroupMessage(enc.ciphertext, enc.nonce, enc.keys['alice'], alice.publicKey, alice.secretKey);
    expect(alicePlain).toBe('hello room');

    // Mallory has no entry in enc.keys at all — simulate someone outside the
    // room trying every other recipient's wrap with their own secret key.
    const malloryTriesBobsWrap = decryptGroupMessage(enc.ciphertext, enc.nonce, enc.keys['bob'], alice.publicKey, mallory.secretKey);
    expect(malloryTriesBobsWrap).toBeNull();
  });

  test('a member who joins later has no wrap for an earlier message (no retroactive history access)', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const dave = generateKeyPair(); // joins after this message was sent

    const enc = encryptGroupMessage('before dave joined', [{ username: 'bob', publicKey: bob.publicKey }], alice, 'alice');
    expect(enc.keys['dave']).toBeUndefined();
  });

  test('fresh random key and nonce every call — no reuse across messages', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const recipients = [{ username: 'bob', publicKey: bob.publicKey }];
    const a = encryptGroupMessage('msg one', recipients, alice, 'alice');
    const b = encryptGroupMessage('msg two', recipients, alice, 'alice');
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.keys['bob']).not.toBe(b.keys['bob']); // different per-recipient nonce + key wrap
  });
});

describe('Media encryption (AES-256-GCM)', () => {
  test('round trip recovers the exact original bytes', async () => {
    const original = new TextEncoder().encode('this is definitely a file, trust me');
    const { encryptedBlob, mediaKeyBytes } = await encryptMedia(original.buffer);
    const packed = await encryptedBlob.arrayBuffer();
    const decryptedBlob = await decryptMedia(packed, mediaKeyBytes);
    const decrypted = new Uint8Array(await decryptedBlob.arrayBuffer());
    expect(new TextDecoder().decode(decrypted)).toBe('this is definitely a file, trust me');
  });

  test('wrong key fails to decrypt', async () => {
    const original = new TextEncoder().encode('secret file contents');
    const { encryptedBlob } = await encryptMedia(original.buffer);
    const packed = await encryptedBlob.arrayBuffer();
    const wrongKey = crypto.getRandomValues(new Uint8Array(32));
    await expect(decryptMedia(packed, wrongKey)).rejects.toBeTruthy();
  });

  test('fresh key and IV every call', async () => {
    const buf = new TextEncoder().encode('same content twice').buffer;
    const a = await encryptMedia(buf);
    const b = await encryptMedia(buf);
    expect(Array.from(a.mediaKeyBytes)).not.toEqual(Array.from(b.mediaKeyBytes));
  });
});

describe('Private key wrapping (PBKDF2 + AES-256-GCM) — password accounts', () => {
  test('round trip with the correct password', async () => {
    const kp = generateKeyPair();
    const blob = await encryptPrivateKey(kp.secretKey, 'correct horse battery staple');
    const recovered = await decryptPrivateKey(blob, 'correct horse battery staple');
    expect(Array.from(recovered)).toEqual(Array.from(kp.secretKey));
  });

  test('wrong password throws instead of returning garbage', async () => {
    const kp = generateKeyPair();
    const blob = await encryptPrivateKey(kp.secretKey, 'right password');
    await expect(decryptPrivateKey(blob, 'wrong password')).rejects.toBeTruthy();
  });
});

describe('Guest key at-rest wrapping (encryptGuestKey/decryptGuestKey)', () => {
  test('round trip recovers the exact secret key', async () => {
    const kp = generateKeyPair();
    const blob = await encryptGuestKey(kp.secretKey);
    const recovered = await decryptGuestKey(blob);
    expect(Array.from(recovered)).toEqual(Array.from(kp.secretKey));
  });

  test('corrupted blob resolves to null instead of throwing', async () => {
    const recovered = await decryptGuestKey('not-a-real-blob');
    expect(recovered).toBeNull();
  });

  test('device password is created once and reused for every guest identity', async () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    await encryptGuestKey(kp1.secretKey);
    const pwAfterFirst = localStorage.getItem('wt_guest_spw');
    expect(pwAfterFirst).toBeTruthy();
    await encryptGuestKey(kp2.secretKey);
    expect(localStorage.getItem('wt_guest_spw')).toBe(pwAfterFirst);
  });
});

describe('sanitizeReplyToForWire — the reply-preview privacy fix', () => {
  test('strips plaintext/ciphertext message content, keeps only non-sensitive fields', () => {
    const localSnapshot = {
      id: 42,
      username: 'alice',
      mediaType: null,
      mediaFileName: null,
      message: 'this is the actual decrypted plaintext of the original message',
    };
    const wire = sanitizeReplyToForWire(localSnapshot);
    expect(wire).toEqual({ id: 42, username: 'alice', mediaType: null, mediaFileName: null });
    expect(wire.message).toBeUndefined();
    expect(JSON.stringify(wire)).not.toContain('decrypted plaintext');
  });

  test('preserves media metadata (needed for a media-only reply label) without leaking any text', () => {
    const localSnapshot = { id: 7, username: 'bob', mediaType: 'image/png', mediaFileName: 'vacation.png', message: null };
    expect(sanitizeReplyToForWire(localSnapshot)).toEqual({ id: 7, username: 'bob', mediaType: 'image/png', mediaFileName: 'vacation.png' });
  });

  test('null/undefined input yields null (no reply)', () => {
    expect(sanitizeReplyToForWire(null)).toBeNull();
    expect(sanitizeReplyToForWire(undefined)).toBeNull();
  });

  test('a decryptedText field, if ever present on the input, is never carried over', () => {
    const localSnapshot = { id: 1, username: 'x', decryptedText: 'leaked plaintext' };
    const wire = sanitizeReplyToForWire(localSnapshot);
    expect(wire.decryptedText).toBeUndefined();
    expect(JSON.stringify(wire)).not.toContain('leaked plaintext');
  });
});
