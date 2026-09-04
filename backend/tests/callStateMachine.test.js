const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  isValidCallInviteRequest,
  isCallInviteBusy,
  evaluateCallInviteEligibility,
  evaluateCallAccept,
  evaluateCallDecline,
  evaluateCallCancel,
} = require('../lib/callStateMachine');

describe('isValidCallInviteRequest', () => {
  test('accepts a well-formed voice invite', () => {
    assert.strictEqual(isValidCallInviteRequest({ caller: 'alice', callee: 'bob', callType: 'voice' }), true);
  });

  test('accepts a well-formed video invite', () => {
    assert.strictEqual(isValidCallInviteRequest({ caller: 'alice', callee: 'bob', callType: 'video' }), true);
  });

  test('rejects calling yourself', () => {
    assert.strictEqual(isValidCallInviteRequest({ caller: 'alice', callee: 'alice', callType: 'voice' }), false);
  });

  test('rejects a missing caller or callee', () => {
    assert.strictEqual(isValidCallInviteRequest({ caller: '', callee: 'bob', callType: 'voice' }), false);
    assert.strictEqual(isValidCallInviteRequest({ caller: 'alice', callee: '', callType: 'voice' }), false);
  });

  test('rejects an unrecognized callType', () => {
    assert.strictEqual(isValidCallInviteRequest({ caller: 'alice', callee: 'bob', callType: 'screen-share' }), false);
    assert.strictEqual(isValidCallInviteRequest({ caller: 'alice', callee: 'bob', callType: undefined }), false);
  });
});

describe('isCallInviteBusy', () => {
  test('not busy when neither side has an active call', () => {
    assert.strictEqual(isCallInviteBusy({ callerBusy: false, calleeBusy: false }), false);
  });

  test('busy if the caller already has an active call', () => {
    assert.strictEqual(isCallInviteBusy({ callerBusy: true, calleeBusy: false }), true);
  });

  test('busy if the callee already has an active call', () => {
    assert.strictEqual(isCallInviteBusy({ callerBusy: false, calleeBusy: true }), true);
  });

  test('busy if both sides do', () => {
    assert.strictEqual(isCallInviteBusy({ callerBusy: true, calleeBusy: true }), true);
  });
});

describe('evaluateCallInviteEligibility', () => {
  test('ok when friends and not blocked', () => {
    assert.deepStrictEqual(evaluateCallInviteEligibility({ areFriends: true, isBlocked: false }), { result: 'ok' });
  });

  // Precedence matters: server.js's real handler checks friendship first and
  // only reaches the block check afterward — a not-mutual-friends pair
  // should never leak "blocked" as the reason even if a block row also
  // happens to exist.
  test('not_friends takes precedence over blocked', () => {
    const result = evaluateCallInviteEligibility({ areFriends: false, isBlocked: true });
    assert.strictEqual(result.result, 'invalid');
    assert.strictEqual(result.reason, 'not_friends');
  });

  test('blocked when friends but a block exists either direction', () => {
    const result = evaluateCallInviteEligibility({ areFriends: true, isBlocked: true });
    assert.strictEqual(result.result, 'invalid');
    assert.strictEqual(result.reason, 'blocked');
  });

  test('not_friends when not mutually accepted', () => {
    const result = evaluateCallInviteEligibility({ areFriends: false, isBlocked: false });
    assert.strictEqual(result.result, 'invalid');
    assert.strictEqual(result.reason, 'not_friends');
  });
});

describe('evaluateCallAccept', () => {
  test('allows accepting a ringing call addressed to you', () => {
    const call = { callee: 'bob', status: 'ringing' };
    assert.deepStrictEqual(evaluateCallAccept(call, 'bob'), { allowed: true });
  });

  test('rejects when the call no longer exists', () => {
    const result = evaluateCallAccept(undefined, 'bob');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'call_gone');
  });

  test('rejects when you are not the callee', () => {
    const call = { callee: 'bob', status: 'ringing' };
    const result = evaluateCallAccept(call, 'mallory');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'call_gone');
  });

  // The exact double-accept race fixed this session: a second 'call:accept'
  // for a call that's already 'active' must be rejected with a reason the
  // client can react to, not silently ignored or treated as a fresh accept.
  test('rejects re-accepting an already-active call', () => {
    const call = { callee: 'bob', status: 'active' };
    const result = evaluateCallAccept(call, 'bob');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'already_active');
  });
});

describe('evaluateCallDecline', () => {
  test('allows the callee to decline a ringing call', () => {
    assert.deepStrictEqual(evaluateCallDecline({ callee: 'bob', status: 'ringing' }, 'bob'), { allowed: true });
  });

  test('allows the callee to decline even if it is somehow no longer ringing', () => {
    // No status check by design — see the module's own comment.
    assert.deepStrictEqual(evaluateCallDecline({ callee: 'bob', status: 'active' }, 'bob'), { allowed: true });
  });

  test('rejects when you are not the callee', () => {
    assert.strictEqual(evaluateCallDecline({ callee: 'bob', status: 'ringing' }, 'alice').allowed, false);
  });

  test('rejects when the call no longer exists', () => {
    assert.strictEqual(evaluateCallDecline(undefined, 'bob').allowed, false);
  });
});

describe('evaluateCallCancel', () => {
  test('allows the caller to cancel a still-ringing call', () => {
    assert.deepStrictEqual(evaluateCallCancel({ caller: 'alice', status: 'ringing' }, 'alice'), { allowed: true });
  });

  test('rejects cancelling an already-active (answered) call', () => {
    assert.strictEqual(evaluateCallCancel({ caller: 'alice', status: 'active' }, 'alice').allowed, false);
  });

  test('rejects when you are not the caller', () => {
    assert.strictEqual(evaluateCallCancel({ caller: 'alice', status: 'ringing' }, 'bob').allowed, false);
  });

  test('rejects when the call no longer exists', () => {
    assert.strictEqual(evaluateCallCancel(undefined, 'alice').allowed, false);
  });
});
