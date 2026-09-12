const { test, describe } = require('node:test');
const assert = require('node:assert');

const { canHideMessage } = require('../lib/messageAuth');

// E2E audit Fix 2: DELETE /api/chats/message/:id's self-hide ("local
// delete") action previously accepted a request from ANY authenticated
// user for ANY message id, regardless of relationship to it. These tests
// pin the allowlist that now gates it.
describe('canHideMessage — self-hide authorization', () => {

  test('sender can hide their own private message', () => {
    const msg = { senderName: 'alice', targetName: 'bob', type: 'private' };
    assert.strictEqual(canHideMessage('alice', msg, []), true);
  });

  test('sender can hide their own group message', () => {
    const msg = { senderName: 'alice', roomId: 'r1', type: 'group' };
    assert.strictEqual(canHideMessage('alice', msg, ['alice', 'carol']), true);
  });

  test('DM recipient can hide a private message sent to them', () => {
    const msg = { senderName: 'alice', targetName: 'bob', type: 'private' };
    assert.strictEqual(canHideMessage('bob', msg, []), true);
  });

  test('group/room member can hide a group message they did not send', () => {
    const msg = { senderName: 'alice', roomId: 'r1', type: 'group' };
    assert.strictEqual(canHideMessage('carol', msg, ['alice', 'carol', 'dave']), true);
  });

  test('room-typed message (type "room") uses the same membership check as "group"', () => {
    const msg = { senderName: 'alice', roomId: 'r1', type: 'room' };
    assert.strictEqual(canHideMessage('carol', msg, ['alice', 'carol']), true);
  });

  test('unrelated user is rejected for a private message', () => {
    const msg = { senderName: 'alice', targetName: 'bob', type: 'private' };
    assert.strictEqual(canHideMessage('mallory', msg, []), false);
  });

  test('unrelated authenticated user is rejected for a group message (not a room member)', () => {
    const msg = { senderName: 'alice', roomId: 'r1', type: 'group' };
    assert.strictEqual(canHideMessage('mallory', msg, ['alice', 'carol', 'dave']), false);
  });

  test('case-insensitive username matching for sender', () => {
    const msg = { senderName: 'Alice', targetName: 'bob', type: 'private' };
    assert.strictEqual(canHideMessage('ALICE', msg, []), true);
  });

  test('case-insensitive username matching for DM recipient', () => {
    const msg = { senderName: 'alice', targetName: 'Bob', type: 'private' };
    assert.strictEqual(canHideMessage('BOB', msg, []), true);
  });

  test('case-insensitive username matching for room members', () => {
    const msg = { senderName: 'alice', roomId: 'r1', type: 'group' };
    assert.strictEqual(canHideMessage('Carol', msg, ['ALICE', 'CAROL']), true);
  });

  test('missing/empty room member list rejects a non-sender', () => {
    const msg = { senderName: 'alice', roomId: 'r1', type: 'group' };
    assert.strictEqual(canHideMessage('carol', msg, []), false);
    assert.strictEqual(canHideMessage('carol', msg, undefined), false);
  });

  test('missing targetName on a private message rejects a non-sender', () => {
    const msg = { senderName: 'alice', targetName: null, type: 'private' };
    assert.strictEqual(canHideMessage('bob', msg, []), false);
  });
});
