const { test, describe } = require('node:test');
const assert = require('node:assert');

const { verifyRecoveryIdentityMatch } = require('../lib/crypto-helpers');

// /api/reset-password used to accept ANY well-formed recovery phrase's
// derived keypair unconditionally, silently overwriting the account's real
// publicKey/encryptedPrivateKey and permanently orphaning its historical
// encrypted messages. verifyRecoveryIdentityMatch is the fix: it must
// compare the freshly-submitted recoveryKeyHash/publicKey against the
// account's EXISTING stored values before the caller is allowed to write.

describe('verifyRecoveryIdentityMatch — recovery-phrase/key-identity validation', () => {
  const existingHash = 'abc123existinghash==';
  const existingPublicKey = 'existingPublicKeyBase64==';

  // A. Correct recovery phrase
  test('matching hash + matching public key: accepted', () => {
    const result = verifyRecoveryIdentityMatch({
      existingRecoveryKeyHash: existingHash,
      existingPublicKey,
      submittedRecoveryKeyHash: existingHash,
      submittedPublicKey: existingPublicKey,
    });
    assert.strictEqual(result.ok, true);
  });

  // B. Wrong recovery phrase (well-formed, but produces an unrelated keypair)
  test('hash mismatch: rejected', () => {
    const result = verifyRecoveryIdentityMatch({
      existingRecoveryKeyHash: existingHash,
      existingPublicKey,
      submittedRecoveryKeyHash: 'totallyDifferentHash==',
      submittedPublicKey: 'someUnrelatedPublicKey==',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'hash-mismatch');
  });

  // C. Malformed / empty submitted hash — must not slip past a strict '!==' comparison
  test('empty/malformed submitted hash: rejected, not silently coerced to a match', () => {
    const result = verifyRecoveryIdentityMatch({
      existingRecoveryKeyHash: existingHash,
      existingPublicKey,
      submittedRecoveryKeyHash: '',
      submittedPublicKey: existingPublicKey,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'hash-mismatch');
  });

  // D. Attempted different-keypair injection: hash matches (e.g. replayed from
  // a legitimate prior request) but the submitted public key doesn't — must
  // still be rejected rather than trusting the hash alone.
  test('hash matches but public key does not: rejected (defense in depth)', () => {
    const result = verifyRecoveryIdentityMatch({
      existingRecoveryKeyHash: existingHash,
      existingPublicKey,
      submittedRecoveryKeyHash: existingHash,
      submittedPublicKey: 'anInjectedDifferentPublicKey==',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'publickey-mismatch');
  });

  // No existing verifier on file for this account at all — nothing to safely
  // compare against, so an unverifiable "recovery" must not be trusted.
  test('no existing recoveryKeyHash on the account: rejected, not trusted by default', () => {
    const result = verifyRecoveryIdentityMatch({
      existingRecoveryKeyHash: null,
      existingPublicKey: null,
      submittedRecoveryKeyHash: 'anyHashAtAll==',
      submittedPublicKey: 'anyPublicKeyAtAll==',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'no-existing-verifier');
  });

  test('existing hash present but existing publicKey missing: hash check still gates it', () => {
    // Matching hash, no stored public key to cross-check against — the
    // publicKey check is skipped (nothing to compare), but the hash match
    // alone is still sufficient to accept, matching normal account state
    // where both are always set together.
    const result = verifyRecoveryIdentityMatch({
      existingRecoveryKeyHash: existingHash,
      existingPublicKey: null,
      submittedRecoveryKeyHash: existingHash,
      submittedPublicKey: 'anything==',
    });
    assert.strictEqual(result.ok, true);
  });
});
