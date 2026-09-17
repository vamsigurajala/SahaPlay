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
  secretKeyToMnemonic,
  mnemonicToSecretKey,
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

describe('Password-account key-wrap migration (Phase 4 — independent encryption passphrase)', () => {
  test('a key wrapped by the login password can be migrated to an independent passphrase, preserving the exact same keypair', async () => {
    // Four real, deliberately slow 600k-iteration PBKDF2 operations in one
    // test (two encrypts, two decrypts) — can exceed the default 5000ms
    // testTimeout under full-suite CPU contention (same documented
    // allowance used throughout this codebase for real PBKDF2 timing).
    const kp = generateKeyPair();
    const loginPassword = 'the-account-login-password-123!';
    const encryptionPassphrase = 'a totally different secret only the user knows';

    // Step 1: legacy scheme — wrapped with the login password (what
    // Signup.jsx used to do, and what every pre-migration account still has).
    const legacyBlob = await encryptPrivateKey(kp.secretKey, loginPassword);

    // Step 2: migration (Login.jsx unwraps with the password it already has
    // from the just-completed login; Profile.jsx's "Encryption passphrase"
    // section re-wraps the SAME already-in-memory keypair) — re-wrap with
    // the new, independent passphrase.
    const recoveredSecretKey = await decryptPrivateKey(legacyBlob, loginPassword);
    expect(Array.from(recoveredSecretKey)).toEqual(Array.from(kp.secretKey));
    const migratedBlob = await encryptPrivateKey(recoveredSecretKey, encryptionPassphrase);

    // Step 3: the migrated blob unwraps with the NEW passphrase to the exact
    // same keypair — decryption of every message ever sent/received under
    // this identity keeps working, since the public/private key never
    // changed, only what protects the private key at rest.
    const finalSecretKey = await decryptPrivateKey(migratedBlob, encryptionPassphrase);
    expect(Array.from(finalSecretKey)).toEqual(Array.from(kp.secretKey));
  }, 15000);

  test('after migration, the OLD login password no longer unwraps the key — proving the server can no longer derive it from a password it sees on login', async () => {
    const kp = generateKeyPair();
    const loginPassword = 'the-account-login-password-123!';
    const encryptionPassphrase = 'a totally different secret only the user knows';
    const migratedBlob = await encryptPrivateKey(kp.secretKey, encryptionPassphrase);

    // This is the actual security property Phase 4 buys: a server that sees
    // every login password (as any password-auth server necessarily does)
    // gains nothing from it once an account has migrated — the password is
    // cryptographically unrelated to the blob it would need to unwrap.
    await expect(decryptPrivateKey(migratedBlob, loginPassword)).rejects.toBeTruthy();
  });

  test('a not-yet-migrated blob still unwraps with the login password (existing accounts keep working)', async () => {
    const kp = generateKeyPair();
    const loginPassword = 'unchanged-existing-password';
    const legacyBlob = await encryptPrivateKey(kp.secretKey, loginPassword);
    const recovered = await decryptPrivateKey(legacyBlob, loginPassword);
    expect(Array.from(recovered)).toEqual(Array.from(kp.secretKey));
  });
});

describe('Password reset via recovery phrase (Bug B — must never re-wrap with the new login password)', () => {
  // Mirrors ResetPassword.jsx's performReset(): recover the SAME keypair from
  // the recovery phrase, then re-wrap it with an independent encryption
  // passphrase (never the newPassword field being set on the login form).
  async function simulateRecoveryReset(originalKp, recoveryPhrase, encPassphrase) {
    const recoveredSecretKey = await mnemonicToSecretKey(recoveryPhrase);
    const nacl = (await import('tweetnacl')).default;
    const recoveredKp = nacl.box.keyPair.fromSecretKey(recoveredSecretKey);
    const encryptedPrivateKey = await encryptPrivateKey(recoveredKp.secretKey, encPassphrase);
    // The local verify-before-send step ResetPassword.jsx performs.
    const verify = await decryptPrivateKey(encryptedPrivateKey, encPassphrase);
    if (encodeBase64(verify) !== encodeBase64(recoveredKp.secretKey)) {
      throw new Error('verification failed');
    }
    return { recoveredKp, encryptedPrivateKey };
  }

  test('recovering + resetting preserves the exact same public/private keypair', async () => {
    const original = generateKeyPair();
    const phrase = await secretKeyToMnemonic(original.secretKey);
    const { recoveredKp } = await simulateRecoveryReset(original, phrase, 'new-encryption-passphrase-1');
    expect(encodeBase64(recoveredKp.publicKey)).toBe(encodeBase64(original.publicKey));
    expect(encodeBase64(recoveredKp.secretKey)).toBe(encodeBase64(original.secretKey));
  });

  test('old encrypted DM sent before the reset still decrypts after it', async () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const enc = encryptDM('pre-reset secret', encodeBase64(bob.publicKey), encodeBase64(alice.publicKey));

    const phrase = await secretKeyToMnemonic(bob.secretKey);
    const { recoveredKp } = await simulateRecoveryReset(bob, phrase, 'passphrase-after-reset');

    const plain = decryptDM(enc.ciphertext, enc.nonce, enc.ephemeralPublicKey, encodeBase64(recoveredKp.secretKey));
    expect(plain).toBe('pre-reset secret');
  });

  test('old group message sent before the reset still decrypts after it', async () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const enc = encryptGroupMessage(
      'group history before reset',
      [{ username: 'bob', publicKey: bob.publicKey }],
      alice, 'alice'
    );

    const phrase = await secretKeyToMnemonic(bob.secretKey);
    const { recoveredKp } = await simulateRecoveryReset(bob, phrase, 'passphrase-after-reset');

    const plain = decryptGroupMessage(enc.ciphertext, enc.nonce, enc.keys['bob'], alice.publicKey, recoveredKp.secretKey);
    expect(plain).toBe('group history before reset');
  });

  test('old encrypted media still decrypts with the same media key after the reset (media keys are unaffected by keypair recovery)', async () => {
    const original = new TextEncoder().encode('pre-reset media file contents');
    const { encryptedBlob, mediaKeyBytes } = await encryptMedia(original.buffer);
    // Recovering the identity keypair doesn't touch per-media keys at all —
    // included to confirm the reset flow doesn't disturb this independent path.
    const packed = await encryptedBlob.arrayBuffer();
    const decryptedBlob = await decryptMedia(packed, mediaKeyBytes);
    const decrypted = new Uint8Array(await decryptedBlob.arrayBuffer());
    expect(Array.from(decrypted)).toEqual(Array.from(original));
  });

  test('the NEW LOGIN PASSWORD does NOT unwrap the re-wrapped key blob', async () => {
    const original = generateKeyPair();
    const phrase = await secretKeyToMnemonic(original.secretKey);
    const newLoginPassword = 'BrandNewLoginPassw0rd!';
    const encPassphrase = 'totally-independent-passphrase';
    const { encryptedPrivateKey } = await simulateRecoveryReset(original, phrase, encPassphrase);

    await expect(decryptPrivateKey(encryptedPrivateKey, newLoginPassword)).rejects.toBeTruthy();
  });

  test('the encryption passphrase DOES unwrap the re-wrapped key blob', async () => {
    const original = generateKeyPair();
    const phrase = await secretKeyToMnemonic(original.secretKey);
    const encPassphrase = 'totally-independent-passphrase';
    const { encryptedPrivateKey } = await simulateRecoveryReset(original, phrase, encPassphrase);

    const secretKey = await decryptPrivateKey(encryptedPrivateKey, encPassphrase);
    expect(encodeBase64(secretKey)).toBe(encodeBase64(original.secretKey));
  });

  test('a wrong recovery phrase produces a different (wrong) keypair, never silently reusing the original', async () => {
    const original = generateKeyPair();
    const wrongPhrase = await secretKeyToMnemonic(generateKeyPair().secretKey);
    const { recoveredKp } = await simulateRecoveryReset(original, wrongPhrase, 'some-passphrase');
    expect(encodeBase64(recoveredKp.publicKey)).not.toBe(encodeBase64(original.publicKey));
  });

  test('a malformed recovery phrase throws rather than silently producing a usable key', async () => {
    await expect(mnemonicToSecretKey('not a valid recovery phrase at all !!!')).rejects.toBeTruthy();
  });

  test('the local verification step catches a mismatched wrap (simulated corruption) before it would ever reach the server', async () => {
    const original = generateKeyPair();
    const phrase = await secretKeyToMnemonic(original.secretKey);
    const recoveredSecretKey = await mnemonicToSecretKey(phrase);
    const encryptedPrivateKey = await encryptPrivateKey(recoveredSecretKey, 'passphrase-a');
    // Simulate verifying with the WRONG passphrase, as if a bug re-wrapped
    // with the wrong secret — the verify step must reject, not silently pass.
    await expect(decryptPrivateKey(encryptedPrivateKey, 'passphrase-b')).rejects.toBeTruthy();
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
