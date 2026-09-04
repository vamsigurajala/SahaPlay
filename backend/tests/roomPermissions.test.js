const { test, describe } = require('node:test');
const assert = require('node:assert');

const { sanitizeRoomPermissions, ALLOWED_PERM_KEYS } = require('../lib/roomPermissions');

describe('sanitizeRoomPermissions', () => {

  // The actual regression: Room Settings' "Who can use webcam?"/"Who can
  // use microphone?" toggles looked like they reverted to Allow All the
  // instant you saved, because 'cam'/'mic' weren't in the whitelist and got
  // silently stripped every time. Pinning this exactly so it can never
  // silently regress again.
  test('keeps cam and mic (the incident this file exists to prevent)', () => {
    const result = sanitizeRoomPermissions({ cam: 'host', mic: 'host', chat: 'all' });
    assert.strictEqual(result.cam, 'host');
    assert.strictEqual(result.mic, 'host');
    assert.strictEqual(result.chat, 'all');
  });

  test('keeps changeMedia', () => {
    const result = sanitizeRoomPermissions({ changeMedia: 'host' });
    assert.strictEqual(result.changeMedia, 'host');
  });

  test('keeps every other known permission key', () => {
    const input = {};
    for (const key of ALLOWED_PERM_KEYS) input[key] = 'test-value';
    const result = sanitizeRoomPermissions(input);
    for (const key of ALLOWED_PERM_KEYS) {
      assert.strictEqual(result[key], 'test-value', `expected "${key}" to survive sanitization`);
    }
  });

  test('strips unknown keys (payload pollution prevention — the whole point of A6-F15)', () => {
    const result = sanitizeRoomPermissions({ chat: 'all', isAdmin: true, someRandomKey: 'x' });
    assert.strictEqual(result.isAdmin, undefined);
    assert.strictEqual(result.someRandomKey, undefined);
    assert.strictEqual(result.chat, 'all');
  });

  test('a "__proto__"-shaped payload never pollutes the global Object prototype', () => {
    sanitizeRoomPermissions(JSON.parse('{"chat":"all","__proto__":{"polluted":true}}'));
    assert.strictEqual(({}).polluted, undefined);
  });

  test('returns an empty object for null input', () => {
    assert.deepStrictEqual(sanitizeRoomPermissions(null), {});
  });

  test('returns an empty object for undefined input', () => {
    assert.deepStrictEqual(sanitizeRoomPermissions(undefined), {});
  });

  test('returns an empty object for non-object input', () => {
    assert.deepStrictEqual(sanitizeRoomPermissions('not an object'), {});
    assert.deepStrictEqual(sanitizeRoomPermissions(42), {});
  });

  test('does not mutate the input object', () => {
    const input = { chat: 'all', unknownKey: 'x' };
    const inputCopy = { ...input };
    sanitizeRoomPermissions(input);
    assert.deepStrictEqual(input, inputCopy);
  });

  test('omits a known key entirely if the caller never sent it (no phantom keys)', () => {
    const result = sanitizeRoomPermissions({ chat: 'all' });
    assert.strictEqual('cam' in result, false);
    assert.strictEqual('mic' in result, false);
  });
});
