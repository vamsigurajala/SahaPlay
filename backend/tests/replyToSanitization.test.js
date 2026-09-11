const { test, describe } = require('node:test');
const assert = require('node:assert');

const { sanitizeReplyToServer } = require('../lib/crypto-helpers');

// E2E audit Phase 2/§10: /api/chats/send used to store whatever replyTo shape
// a request body carried, verbatim — the client (sanitizeReplyToForWire in
// frontend/src/lib/crypto.js) already strips this down before sending, but
// the server must not trust that. These tests exercise the actual shared
// function server.js now calls (sanitizeReplyToServer), not a
// re-implementation, proving the server-side allowlist independently closes
// the same gap even if a client ever sent something it shouldn't.
describe('sanitizeReplyToServer — server-side replyTo defense in depth', () => {

  test('A: a normal, already-sanitized replyTo passes through unchanged', () => {
    const result = sanitizeReplyToServer({
      id: '4816',
      username: 'e2eaudit1',
      mediaType: null,
      mediaFileName: null,
    });
    assert.deepStrictEqual(result, {
      id: '4816',
      username: 'e2eaudit1',
      mediaType: null,
      mediaFileName: null,
    });
  });

  test('A: a media reply preserves mediaType/mediaFileName', () => {
    const result = sanitizeReplyToServer({
      id: 42,
      username: 'bob',
      mediaType: 'image/png',
      mediaFileName: 'vacation.png',
    });
    assert.deepStrictEqual(result, {
      id: 42,
      username: 'bob',
      mediaType: 'image/png',
      mediaFileName: 'vacation.png',
    });
  });

  test('B: an injected replyTo.message (plaintext) is removed entirely', () => {
    const result = sanitizeReplyToServer({
      id: '4816',
      username: 'e2eaudit1',
      message: 'E2E_CANARY_TEXT_A_73921 — the actual decrypted plaintext of the original message',
    });
    assert.strictEqual(result.message, undefined);
    assert.ok(!('message' in result), 'message key must not exist on the sanitized object at all');
    assert.deepStrictEqual(result, {
      id: '4816',
      username: 'e2eaudit1',
      mediaType: null,
      mediaFileName: null,
    });
  });

  test('C: arbitrary extra client-supplied fields are removed', () => {
    const result = sanitizeReplyToServer({
      id: '4816',
      username: 'e2eaudit1',
      preview: 'some preview text',
      snippet: 'some snippet',
      decryptedText: 'plaintext leak attempt',
      __proto__: { polluted: true },
      randomField: 'should not survive',
    });
    assert.deepStrictEqual(Object.keys(result).sort(), ['id', 'mediaFileName', 'mediaType', 'username']);
    assert.strictEqual(result.preview, undefined);
    assert.strictEqual(result.snippet, undefined);
    assert.strictEqual(result.decryptedText, undefined);
    assert.strictEqual(result.randomField, undefined);
  });

  test('D: a very large/injected replyTo object cannot smuggle plaintext content through any field', () => {
    const bigPlaintext = 'PLAINTEXT_LEAK_ATTEMPT_'.repeat(1000); // ~24KB
    const result = sanitizeReplyToServer({
      id: '4816',
      username: bigPlaintext,       // oversized string in an allowed field
      mediaType: bigPlaintext,      // oversized string in an allowed field
      mediaFileName: bigPlaintext,  // oversized string in an allowed field
      message: bigPlaintext,        // disallowed field entirely
      extraHugeField: bigPlaintext, // disallowed field entirely
    });
    assert.ok(!('message' in result));
    assert.ok(!('extraHugeField' in result));
    assert.ok(result.username.length <= 60, 'username must be capped');
    assert.ok(result.mediaType.length <= 100, 'mediaType must be capped');
    assert.ok(result.mediaFileName.length <= 255, 'mediaFileName must be capped');
    // None of the retained fields can contain the full-length canary payload.
    assert.notStrictEqual(result.username, bigPlaintext);
    assert.notStrictEqual(result.mediaType, bigPlaintext);
    assert.notStrictEqual(result.mediaFileName, bigPlaintext);
  });

  test('non-object / missing replyTo values are handled safely', () => {
    assert.strictEqual(sanitizeReplyToServer(null), null);
    assert.strictEqual(sanitizeReplyToServer(undefined), null);
    assert.strictEqual(sanitizeReplyToServer('a string, not an object'), null);
    assert.strictEqual(sanitizeReplyToServer(42), null);
  });

  test('non-string username/mediaType/mediaFileName are coerced to null rather than passed through', () => {
    const result = sanitizeReplyToServer({
      id: '1',
      username: { toString: () => 'fake' }, // object, not a string
      mediaType: 12345,
      mediaFileName: ['array'],
    });
    assert.deepStrictEqual(result, { id: '1', username: null, mediaType: null, mediaFileName: null });
  });
});
