const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  isGuestUsername,
  isMembersOnlyRejected,
  evaluateJoinGate,
  shouldAssignHost,
  shouldNotifyAutoAdmin,
  isBannedFromRoom,
} = require('../lib/joinFlow');

describe('isGuestUsername', () => {
  test('the literal Anonymous identity is a guest', () => {
    assert.strictEqual(isGuestUsername('Anonymous'), true);
  });

  test('any guest_-prefixed username is a guest, case-insensitively', () => {
    assert.strictEqual(isGuestUsername('guest_abc123'), true);
    assert.strictEqual(isGuestUsername('GUEST_xyz'), true);
  });

  test('an ordinary registered username is not a guest', () => {
    assert.strictEqual(isGuestUsername('alice'), false);
  });

  test('handles a missing/empty username safely', () => {
    assert.strictEqual(isGuestUsername(undefined), false);
    assert.strictEqual(isGuestUsername(''), false);
  });
});

describe('isMembersOnlyRejected', () => {
  test('rejects a guest when the room is Members Only', () => {
    assert.strictEqual(isMembersOnlyRejected({ onlyLoggedIn: true, isGuestOrLocal: true, isActuallyHost: false }), true);
  });

  test('never rejects the room\'s actual host, even as a guest', () => {
    assert.strictEqual(isMembersOnlyRejected({ onlyLoggedIn: true, isGuestOrLocal: true, isActuallyHost: true }), false);
  });

  test('does not reject a registered (non-guest) user', () => {
    assert.strictEqual(isMembersOnlyRejected({ onlyLoggedIn: true, isGuestOrLocal: false, isActuallyHost: false }), false);
  });

  test('does not reject anyone when Members Only is off', () => {
    assert.strictEqual(isMembersOnlyRejected({ onlyLoggedIn: false, isGuestOrLocal: true, isActuallyHost: false }), false);
  });
});

describe('evaluateJoinGate', () => {
  test('the host always gets in, regardless of Members Only or a locked room', () => {
    const gate = evaluateJoinGate({ isActuallyHost: true, onlyLoggedIn: true, isGuestOrLocal: true, lockRoom: true, isApproved: false });
    assert.deepStrictEqual(gate, { result: 'ok' });
  });

  test('an ordinary member gets straight in when neither restriction is on', () => {
    assert.deepStrictEqual(evaluateJoinGate({ isActuallyHost: false, onlyLoggedIn: false, isGuestOrLocal: false, lockRoom: false, isApproved: false }), { result: 'ok' });
  });

  test('a guest is rejected outright by Members Only, before the lock check ever runs', () => {
    const gate = evaluateJoinGate({ isActuallyHost: false, onlyLoggedIn: true, isGuestOrLocal: true, lockRoom: true, isApproved: false });
    assert.strictEqual(gate.result, 'rejected');
    assert.strictEqual(gate.reason, 'members_only');
  });

  test('a locked room puts an unapproved, non-host joiner into the lobby', () => {
    assert.deepStrictEqual(evaluateJoinGate({ isActuallyHost: false, onlyLoggedIn: false, isGuestOrLocal: false, lockRoom: true, isApproved: false }), { result: 'pending' });
  });

  test('a locked room lets an already-approved joiner straight in', () => {
    assert.deepStrictEqual(evaluateJoinGate({ isActuallyHost: false, onlyLoggedIn: false, isGuestOrLocal: false, lockRoom: true, isApproved: true }), { result: 'ok' });
  });

  test('a registered (non-guest) user is unaffected by Members Only', () => {
    assert.deepStrictEqual(evaluateJoinGate({ isActuallyHost: false, onlyLoggedIn: true, isGuestOrLocal: false, lockRoom: false, isApproved: false }), { result: 'ok' });
  });
});

describe('shouldAssignHost', () => {
  test('the DB-recorded host always reclaims hostId, even into an occupied room', () => {
    assert.strictEqual(shouldAssignHost({ roomIsEmpty: false, isDbHost: true, hostUsernameAlreadySet: true, isGuestStr: false }), true);
  });

  test('a brand-new room with no host yet, joined by a registered user, assigns them as host', () => {
    assert.strictEqual(shouldAssignHost({ roomIsEmpty: true, isDbHost: false, hostUsernameAlreadySet: false, isGuestStr: false }), true);
  });

  test('a guest can never become host just by being first through the door', () => {
    assert.strictEqual(shouldAssignHost({ roomIsEmpty: true, isDbHost: false, hostUsernameAlreadySet: false, isGuestStr: true }), false);
  });

  test('an empty room that already has a recorded host does not reassign to a new non-host joiner', () => {
    assert.strictEqual(shouldAssignHost({ roomIsEmpty: true, isDbHost: false, hostUsernameAlreadySet: true, isGuestStr: false }), false);
  });

  test('an ordinary (non-host) member joining an occupied room never becomes host', () => {
    assert.strictEqual(shouldAssignHost({ roomIsEmpty: false, isDbHost: false, hostUsernameAlreadySet: true, isGuestStr: false }), false);
  });
});

describe('shouldNotifyAutoAdmin', () => {
  test('notifies a non-host, non-guest member when auto-admin is enabled', () => {
    assert.strictEqual(shouldNotifyAutoAdmin({ autoAdminEnabled: true, isGuestStr: false, isRoomHost: false }), true);
  });

  test('never notifies the host — they are already admin through another path', () => {
    assert.strictEqual(shouldNotifyAutoAdmin({ autoAdminEnabled: true, isGuestStr: false, isRoomHost: true }), false);
  });

  test('never notifies a guest, even with auto-admin enabled', () => {
    assert.strictEqual(shouldNotifyAutoAdmin({ autoAdminEnabled: true, isGuestStr: true, isRoomHost: false }), false);
  });

  test('does not notify anyone when the setting is off', () => {
    assert.strictEqual(shouldNotifyAutoAdmin({ autoAdminEnabled: false, isGuestStr: false, isRoomHost: false }), false);
  });
});

describe('isBannedFromRoom', () => {
  test('true when the username is in the banned set', () => {
    assert.strictEqual(isBannedFromRoom(new Set(['troll']), 'troll'), true);
  });

  test('false when it is not', () => {
    assert.strictEqual(isBannedFromRoom(new Set(['troll']), 'alice'), false);
  });

  test('handles a missing bannedUsers set safely', () => {
    assert.strictEqual(isBannedFromRoom(undefined, 'alice'), false);
  });
});
