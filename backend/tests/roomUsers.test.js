const { test, describe } = require('node:test');
const assert = require('node:assert');

const { isUserAdmin, buildUserList } = require('../lib/roomUsers');

describe('isUserAdmin', () => {
  test('the host is always admin, matched by socketId', () => {
    const room = { hostId: 'sock-1', hostUsername: null, admins: new Set(), deniedAdmins: new Set(), settings: {} };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-1', username: 'alice' }), true);
  });

  test('the host is recognized by username even from a different/reconnected socket', () => {
    const room = { hostId: 'sock-OLD', hostUsername: 'Alice', admins: new Set(), deniedAdmins: new Set(), settings: {} };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-NEW', username: 'alice' }), true);
  });

  test('a manually-added admin is recognized case-insensitively', () => {
    const room = { hostId: 'sock-host', hostUsername: 'bob', admins: new Set(['carol']), deniedAdmins: new Set(), settings: {} };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-2', username: 'Carol' }), true);
  });

  test('auto-admin grants admin to any non-denied member when the setting is on', () => {
    const room = { hostId: 'sock-host', hostUsername: 'bob', admins: new Set(), deniedAdmins: new Set(), settings: { newMembersAdmins: true } };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-2', username: 'dave' }), true);
  });

  test('auto-admin also honors the legacy string "true" setting value', () => {
    const room = { hostId: 'sock-host', hostUsername: 'bob', admins: new Set(), deniedAdmins: new Set(), settings: { newMembersAdmins: 'true' } };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-2', username: 'dave' }), true);
  });

  // Precedence: an explicit denial overrides the room-wide auto-admin setting,
  // even though neither the host check nor the manual-admin check apply.
  test('an explicitly denied member stays non-admin even when auto-admin is on', () => {
    const room = { hostId: 'sock-host', hostUsername: 'bob', admins: new Set(), deniedAdmins: new Set(['eve']), settings: { newMembersAdmins: true } };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-2', username: 'eve' }), false);
  });

  test('an ordinary member with no admin/host status is not admin', () => {
    const room = { hostId: 'sock-host', hostUsername: 'bob', admins: new Set(), deniedAdmins: new Set(), settings: {} };
    assert.strictEqual(isUserAdmin(room, { socketId: 'sock-2', username: 'frank' }), false);
  });

  test('handles a missing room or user safely', () => {
    assert.strictEqual(isUserAdmin(null, { socketId: 's', username: 'alice' }), false);
    assert.strictEqual(isUserAdmin({ hostId: 's' }, null), false);
  });
});

describe('buildUserList', () => {
  function baseRoom(overrides = {}) {
    return {
      hostId: 'sock-host',
      hostUsername: 'host_user',
      users: [],
      mutedUsers: new Set(),
      admins: new Set(),
      deniedAdmins: new Set(),
      publicKeys: {},
      pendingJoins: new Map(),
      settings: {},
      ...overrides,
    };
  }

  test('marks the host entry as both host and admin', () => {
    const room = baseRoom({ users: [{ socketId: 'sock-host', username: 'host_user' }] });
    const list = buildUserList(room);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].isHost, true);
    assert.strictEqual(list[0].isAdmin, true);
  });

  test('a room-moderator mute (mutedUsers) surfaces as both isMuted and isModMuted', () => {
    const room = baseRoom({
      users: [{ socketId: 'sock-2', username: 'bob', isMuted: false }],
      mutedUsers: new Set(['bob']),
    });
    const [entry] = buildUserList(room);
    assert.strictEqual(entry.isMuted, true);
    assert.strictEqual(entry.isModMuted, true);
  });

  // isMuted also reflects the user's own self-mute (u.isMuted), which is
  // distinct from a moderator mute — only the moderator flag should ever
  // report isModMuted.
  test('a self-mute surfaces as isMuted but NOT isModMuted', () => {
    const room = baseRoom({ users: [{ socketId: 'sock-2', username: 'bob', isMuted: true }] });
    const [entry] = buildUserList(room);
    assert.strictEqual(entry.isMuted, true);
    assert.strictEqual(entry.isModMuted, false);
  });

  test('excludes a user who is currently in pendingJoins (locked-room re-entry edge case)', () => {
    const room = baseRoom({
      users: [
        { socketId: 'sock-2', username: 'bob' },
        { socketId: 'sock-3', username: 'carol' },
      ],
      pendingJoins: new Map([['sock-3', { username: 'Carol' }]]),
    });
    const list = buildUserList(room);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].username, 'bob');
  });

  test('country/countryCode are included when showCountry is not explicitly false', () => {
    const room = baseRoom({
      users: [{ socketId: 'sock-2', username: 'bob', country: 'India', countryCode: 'IN' }],
    });
    const [entry] = buildUserList(room);
    assert.strictEqual(entry.country, 'India');
    assert.strictEqual(entry.countryCode, 'IN');
  });

  test('country/countryCode are hidden (null) when showCountry is explicitly opted out', () => {
    const room = baseRoom({
      users: [{ socketId: 'sock-2', username: 'bob', country: 'India', countryCode: 'IN', showCountry: false }],
    });
    const [entry] = buildUserList(room);
    assert.strictEqual(entry.country, null);
    assert.strictEqual(entry.countryCode, null);
  });

  test('publicKey prefers the live room.publicKeys entry over the cached user-object one', () => {
    const room = baseRoom({
      users: [{ socketId: 'sock-2', username: 'bob', publicKey: 'stale-key' }],
      publicKeys: { 'sock-2': 'fresh-key' },
    });
    const [entry] = buildUserList(room);
    assert.strictEqual(entry.publicKey, 'fresh-key');
  });

  test('falls back to the cached user-object publicKey when room.publicKeys has none', () => {
    const room = baseRoom({
      users: [{ socketId: 'sock-2', username: 'bob', publicKey: 'cached-key' }],
    });
    const [entry] = buildUserList(room);
    assert.strictEqual(entry.publicKey, 'cached-key');
  });
});
