const { test, describe } = require('node:test');
const assert = require('node:assert');

const { isNotifyEnabledFromRow } = require('../lib/notifyPrefs');

describe('isNotifyEnabledFromRow', () => {

  test('both master and category on -> enabled', () => {
    const row = { notifyApp: true, notifyCalls: true };
    assert.strictEqual(isNotifyEnabledFromRow(row, 'calls'), true);
  });

  test('master off, category on -> disabled (master always wins)', () => {
    const row = { notifyApp: false, notifyCalls: true };
    assert.strictEqual(isNotifyEnabledFromRow(row, 'calls'), false);
  });

  test('master on, category off -> disabled', () => {
    const row = { notifyApp: true, notifyCalls: false };
    assert.strictEqual(isNotifyEnabledFromRow(row, 'calls'), false);
  });

  test('both off -> disabled', () => {
    const row = { notifyApp: false, notifyCalls: false };
    assert.strictEqual(isNotifyEnabledFromRow(row, 'calls'), false);
  });

  // Postgres booleans sometimes round-trip as 0/1 rather than true/false
  // depending on the query path (see server.js's SupabaseAdapter) — both
  // representations must be treated identically.
  test('treats 0/1 the same as false/true', () => {
    assert.strictEqual(isNotifyEnabledFromRow({ notifyApp: 1, notifyCalls: 1 }, 'calls'), true);
    assert.strictEqual(isNotifyEnabledFromRow({ notifyApp: 0, notifyCalls: 1 }, 'calls'), false);
    assert.strictEqual(isNotifyEnabledFromRow({ notifyApp: 1, notifyCalls: 0 }, 'calls'), false);
  });

  test('unknown/deleted user (no row) fails open — nothing to block', () => {
    assert.strictEqual(isNotifyEnabledFromRow(null, 'calls'), true);
    assert.strictEqual(isNotifyEnabledFromRow(undefined, 'calls'), true);
  });

  test('unknown category is never gated', () => {
    assert.strictEqual(isNotifyEnabledFromRow({ notifyApp: false }, 'not-a-real-category'), true);
    assert.strictEqual(isNotifyEnabledFromRow({ notifyApp: false }, undefined), true);
  });

  test('checks the right column per category', () => {
    const row = { notifyApp: true, notifyCalls: true, notifyMessages: false, notifyFriendRequests: true };
    assert.strictEqual(isNotifyEnabledFromRow(row, 'calls'), true);
    assert.strictEqual(isNotifyEnabledFromRow(row, 'messages'), false);
    assert.strictEqual(isNotifyEnabledFromRow(row, 'friendRequests'), true);
  });

  test('a column value of undefined/null (never set) defaults to enabled', () => {
    // Matches the existing "!== 0 && !== false" convention used everywhere
    // else in this codebase (AppSettings.jsx included) — anything other
    // than an explicit false/0 counts as on.
    const row = { notifyApp: true, notifyCalls: undefined };
    assert.strictEqual(isNotifyEnabledFromRow(row, 'calls'), true);
  });
});
