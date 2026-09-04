const { test, describe } = require('node:test');
const assert = require('node:assert');

const { getCallActiveUsernames, isActiveCallParticipant } = require('../lib/callRoster');

describe('getCallActiveUsernames', () => {
  test('includes caller and callee once the call is active', () => {
    const call = { status: 'active', caller: 'alice', callee: 'bob', members: new Map() };
    assert.deepStrictEqual(getCallActiveUsernames(call), ['alice', 'bob']);
  });

  test('excludes caller/callee while the call is still ringing (nobody has joined yet)', () => {
    const call = { status: 'ringing', caller: 'alice', callee: 'bob', members: new Map() };
    assert.deepStrictEqual(getCallActiveUsernames(call), []);
  });

  test('excludes a vacated (null) caller/callee after they leave', () => {
    const call = { status: 'active', caller: null, callee: 'bob', members: new Map() };
    assert.deepStrictEqual(getCallActiveUsernames(call), ['bob']);
  });

  test('includes only members whose status is active, not still-ringing invitees', () => {
    const call = {
      status: 'active', caller: 'alice', callee: 'bob',
      members: new Map([
        ['carol', { status: 'active' }],
        ['dave', { status: 'ringing' }],
      ]),
    };
    assert.deepStrictEqual(getCallActiveUsernames(call), ['alice', 'bob', 'carol']);
  });

  test('a fully-mesh group call with everyone joined lists everyone', () => {
    const call = {
      status: 'active', caller: 'alice', callee: 'bob',
      members: new Map([['carol', { status: 'active' }], ['dave', { status: 'active' }]]),
    };
    assert.deepStrictEqual(getCallActiveUsernames(call), ['alice', 'bob', 'carol', 'dave']);
  });
});

describe('isActiveCallParticipant', () => {
  test('the caller/callee are participants only once the call is active', () => {
    const ringing = { status: 'ringing', caller: 'alice', callee: 'bob', members: new Map() };
    const active = { status: 'active', caller: 'alice', callee: 'bob', members: new Map() };
    assert.strictEqual(isActiveCallParticipant(ringing, 'alice'), false);
    assert.strictEqual(isActiveCallParticipant(active, 'alice'), true);
    assert.strictEqual(isActiveCallParticipant(active, 'bob'), true);
  });

  test('a member is a participant only once THEIR entry is active, regardless of call.status', () => {
    const call = {
      status: 'active', caller: 'alice', callee: 'bob',
      members: new Map([['carol', { status: 'active' }], ['dave', { status: 'ringing' }]]),
    };
    assert.strictEqual(isActiveCallParticipant(call, 'carol'), true);
    assert.strictEqual(isActiveCallParticipant(call, 'dave'), false);
  });

  test('a stranger to the call is never a participant', () => {
    const call = { status: 'active', caller: 'alice', callee: 'bob', members: new Map() };
    assert.strictEqual(isActiveCallParticipant(call, 'mallory'), false);
  });

  test('handles a missing call or username safely', () => {
    assert.strictEqual(isActiveCallParticipant(undefined, 'alice'), false);
    assert.strictEqual(isActiveCallParticipant({ status: 'active', caller: 'alice' }, undefined), false);
  });
});
