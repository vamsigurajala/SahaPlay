const { test, describe } = require('node:test');
const assert = require('node:assert');

const { buildOrphanCleanupQueries, classifyUsernameUpdateError } = require('../lib/usernameRename');

// Production incident this closes: username "sam" was deleted directly
// from `users` (bypassing DELETE /api/profile's own cleanup), leaving
// orphaned rows in follows/message_seen keyed by a real UNIQUE/PRIMARY
// KEY constraint. A different, currently-real account renaming INTO
// "sam" then hit a 23505 unique-violation mid-cascade, surfaced to the
// client as a generic 500 — even though the availability check (which
// only looks at `users`) correctly said the name was free.

describe('buildOrphanCleanupQueries — reclaiming a previously deleted username', () => {
  test('returns exactly the 4 tables with a real username-based unique/PK constraint', () => {
    const queries = buildOrphanCleanupQueries('sam');
    const tables = queries.map(q => q.table).sort();
    assert.deepStrictEqual(tables, ['blocks', 'follows', 'message_seen', 'pending_notifications']);
  });

  test('deliberately excludes messages, room_names, push_tokens, webpush_subscriptions', () => {
    // messages/room_names have no unique constraint on username (never the
    // cause of the 500); push_tokens/webpush_subscriptions are unique on
    // token/endpoint, not username. Including any of these here would be
    // either a no-op at best or, for `messages`, a real content-loss bug.
    const queries = buildOrphanCleanupQueries('sam');
    const tables = queries.map(q => q.table);
    for (const excluded of ['messages', 'room_names', 'push_tokens', 'webpush_subscriptions']) {
      assert.ok(!tables.includes(excluded), `${excluded} must not be in the orphan-cleanup list`);
    }
  });

  test('every query is parameterized with ONLY the target username — never string-interpolated', () => {
    const queries = buildOrphanCleanupQueries("sam'; DROP TABLE users; --");
    for (const q of queries) {
      assert.deepStrictEqual(q.params, ["sam'; DROP TABLE users; --"]);
      assert.ok(!q.sql.includes('DROP TABLE'), `${q.table} query must not have the value interpolated into the SQL text`);
      assert.ok(q.sql.includes('$1'), `${q.table} query must use a $1 placeholder`);
    }
  });

  test('every query is guarded by NOT EXISTS against `users` — the actual orphan proof', () => {
    // This is the property that makes the cleanup safe: it can only ever
    // remove rows for a username with NO live account at all — the exact
    // same case the availability check already confirmed before this
    // runs. A row belonging to any currently real user is structurally
    // unreachable by this query.
    for (const q of buildOrphanCleanupQueries('sam')) {
      assert.match(q.sql, /NOT EXISTS\s*\(SELECT 1 FROM users u WHERE LOWER\(u\.username\) = LOWER\(\$1\)\)/);
    }
  });

  test('follows query targets both followerId and followingId columns', () => {
    const q = buildOrphanCleanupQueries('sam').find(x => x.table === 'follows');
    assert.match(q.sql, /"followerId"/);
    assert.match(q.sql, /"followingId"/);
  });

  test('blocks query targets both blocker and blocked columns', () => {
    const q = buildOrphanCleanupQueries('sam').find(x => x.table === 'blocks');
    assert.match(q.sql, /\bblocker\b/);
    assert.match(q.sql, /\bblocked\b/);
  });

  test('message_seen and pending_notifications queries target their username column', () => {
    for (const table of ['message_seen', 'pending_notifications']) {
      const q = buildOrphanCleanupQueries('sam').find(x => x.table === table);
      assert.match(q.sql, /\busername\b/);
    }
  });

  test('is a pure function — same input always produces the same output, no side effects', () => {
    const a = buildOrphanCleanupQueries('sam');
    const b = buildOrphanCleanupQueries('sam');
    assert.deepStrictEqual(a, b);
  });
});

describe('classifyUsernameUpdateError — never expose raw DB internals to the client', () => {
  test('a 23505 unique-violation maps to 409 with a generic, actionable message', () => {
    const err = { code: '23505', constraint: 'message_seen_pkey', table: 'message_seen', detail: 'Key (message_id, username)=(3295, sam) already exists.' };
    const result = classifyUsernameUpdateError(err);
    assert.strictEqual(result.status, 409);
    assert.strictEqual(typeof result.body.error, 'string');
  });

  test('the 23505 client response never contains the constraint/table/detail internals', () => {
    const err = { code: '23505', constraint: 'follows_followerId_followingId_key', table: 'follows', detail: 'Key (followerId, followingId)=(sam, krish) already exists.' };
    const result = classifyUsernameUpdateError(err);
    const serializedBody = JSON.stringify(result.body);
    assert.ok(!serializedBody.includes('follows_followerId_followingId_key'));
    assert.ok(!serializedBody.includes('krish')); // no leaking of the other account's username either
  });

  test('the 23505 constraint/table/detail IS present in logDetail, for server-side logging only', () => {
    const err = { code: '23505', constraint: 'message_seen_pkey', table: 'message_seen', detail: 'Key (message_id, username)=(3295, sam) already exists.' };
    const result = classifyUsernameUpdateError(err);
    assert.match(result.logDetail, /message_seen_pkey/);
    assert.match(result.logDetail, /message_seen/);
  });

  test('any other error code falls back to the existing generic 500 "Database error"', () => {
    const err = new Error('connection terminated unexpectedly');
    err.code = '57P01';
    const result = classifyUsernameUpdateError(err);
    assert.strictEqual(result.status, 500);
    assert.deepStrictEqual(result.body, { error: 'Database error' });
  });

  test('an error with no code at all still falls back to 500, never throws', () => {
    const result = classifyUsernameUpdateError(new Error('something unexpected'));
    assert.strictEqual(result.status, 500);
  });
});
