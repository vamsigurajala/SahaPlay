const { test, describe } = require('node:test');
const assert = require('node:assert');

const { validateE2EEMessage, normalizeRecoveryKey } = require('../lib/crypto-helpers');

describe('E2EE validation', () => {

  test('rejects text message missing nonce', () => {
    const result = validateE2EEMessage({
      message: 'encrypted-text',
      e2ee: { ephemeralPublicKey: 'key' }
      // nonce intentionally missing
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes('nonce'));
  });

  test('rejects text message missing ephemeralPublicKey', () => {
    const result = validateE2EEMessage({
      message: 'encrypted-text',
      e2ee: { nonce: 'abc123' }
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes('ephemeralPublicKey'));
  });

  test('accepts valid E2EE text message', () => {
    const result = validateE2EEMessage({
      message: 'encrypted-text',
      e2ee: {
        nonce: 'abc123',
        ephemeralPublicKey: 'pubkey'
      }
    });
    assert.strictEqual(result.valid, true);
  });

  test('accepts media-only message without E2EE fields', () => {
    const result = validateE2EEMessage({
      mediaUrl: 'https://example.com/image.png',
      mediaType: 'image/jpeg'
      // no message, no e2ee — media only
    });
    assert.strictEqual(result.valid, true);
  });

  test('accepts voice note without E2EE fields', () => {
    const result = validateE2EEMessage({
      mediaUrl: 'https://example.com/voice.webm',
      mediaType: 'audio/webm'
    });
    assert.strictEqual(result.valid, true);
  });
});

describe('Recovery key normalization', () => {

  test('strips dashes consistently', () => {
    const result = normalizeRecoveryKey('ABCD-EFGH-1234-5678');
    assert.strictEqual(result, 'ABCDEFGH12345678');
  });

  test('strips whitespace', () => {
    const result = normalizeRecoveryKey('ABCD EFGH 1234');
    assert.strictEqual(result, 'ABCDEFGH1234');
  });

  test('uppercases consistently', () => {
    const result = normalizeRecoveryKey('abcd1234');
    assert.strictEqual(result, 'ABCD1234');
  });

  test('handles null/undefined safely', () => {
    assert.strictEqual(normalizeRecoveryKey(null), '');
    assert.strictEqual(normalizeRecoveryKey(undefined), '');
  });
});
