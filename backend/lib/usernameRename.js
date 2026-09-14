// usernameRename.js
//
// Pure, DB-connection-free helpers for PUT /api/profile/username — split
// out specifically so the SQL this fix adds (and the error classification
// it needs) can be unit-tested directly, the same way
// crypto-helpers.js/deviceAssertion.js are, without needing a live
// Postgres connection.
//
// Background (the "sam" production incident this closes): a user account
// was deleted directly from the `users` table, bypassing the app's own
// DELETE /api/profile cleanup. follows/blocks/message_seen/
// pending_notifications store username as a plain string under a real
// UNIQUE or PRIMARY KEY constraint (not a foreign key — see
// PUT /api/profile/username's own comment on that), so those tables kept
// rows for the dead username. When a DIFFERENT, currently-real account
// later renamed itself INTO that now-available username, the rename
// cascade's UPDATE statements collided with those leftover rows on the
// unique constraint (Postgres 23505) — even though the availability check
// (which only looks at `users`) correctly said the name was free.

/**
 * Builds the DELETE statements that remove ONLY rows which are (a)
 * already using the username being claimed, AND (b) proven orphaned — no
 * row in `users` matches that username at all, case-insensitively. This
 * can never touch a row belonging to any currently real account: if such
 * an account existed, PUT /api/profile/username's own availability check
 * (SELECT ... WHERE LOWER(username) = LOWER($1)) would already have
 * rejected the rename with 409 "Username already taken" before these
 * statements ever run.
 *
 * Deliberately covers ONLY the tables with a real unique/primary-key
 * constraint on username — the ones that can actually turn into a 23505
 * during the rename cascade:
 *   - follows: unique (followerId, followingId)
 *   - blocks: unique (blocker, blocked)
 *   - message_seen: PRIMARY KEY (message_id, username)
 *   - pending_notifications: PRIMARY KEY (username, chat_id)
 *
 * Deliberately EXCLUDES:
 *   - messages: no unique constraint on senderName/targetName — never the
 *     cause of this failure, and deleting it would destroy real chat
 *     history for the OTHER participant in every affected DM/room, which
 *     this fix has no reason to do.
 *   - room_names: no unique constraint on hostUsername either; a leftover
 *     orphaned host attribution is harmless metadata, not something this
 *     cleanup needs to touch.
 *   - push_tokens / webpush_subscriptions: unique on token/endpoint, NOT
 *     username — multiple rows can already share a username with zero
 *     conflict, so a leftover row here was never going to throw.
 *
 * @param {string} newUsername  the username being claimed (already
 *   trimmed/validated by the caller)
 * @returns {{table: string, sql: string, params: string[]}[]}
 */
function buildOrphanCleanupQueries(newUsername) {
  return [
    {
      table: 'follows',
      sql: 'DELETE FROM follows f WHERE (LOWER(f."followerId") = LOWER($1) OR LOWER(f."followingId") = LOWER($1)) AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER($1))',
      params: [newUsername],
    },
    {
      table: 'blocks',
      sql: 'DELETE FROM blocks b WHERE (LOWER(b.blocker) = LOWER($1) OR LOWER(b.blocked) = LOWER($1)) AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER($1))',
      params: [newUsername],
    },
    {
      table: 'message_seen',
      sql: 'DELETE FROM message_seen ms WHERE LOWER(ms.username) = LOWER($1) AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER($1))',
      params: [newUsername],
    },
    {
      table: 'pending_notifications',
      sql: 'DELETE FROM pending_notifications pn WHERE LOWER(pn.username) = LOWER($1) AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER($1))',
      params: [newUsername],
    },
  ];
}

/**
 * Turns a caught error from the rename transaction into an HTTP response,
 * without ever exposing raw database internals (constraint/table/detail
 * strings) to the client — those are for the server log only.
 *
 * A 23505 reaching this point (after buildOrphanCleanupQueries already
 * ran) means a REAL, currently-existing row collided — which the
 * earlier availability check should already have caught as 409 "Username
 * already taken" before the transaction even started. Still mapped to
 * 409 here (never a raw 500) because from the client's point of view it's
 * the same actionable outcome: this exact username didn't work, try
 * another — never "something is broken."
 *
 * @param {Error & {code?: string, constraint?: string, table?: string, detail?: string}} err
 * @returns {{status: number, body: {error: string}, logDetail: string}}
 */
function classifyUsernameUpdateError(err) {
  if (err && err.code === '23505') {
    return {
      status: 409,
      body: { error: 'That username could not be claimed right now — please try a different one.' },
      logDetail: `unique-constraint conflict: constraint=${err.constraint} table=${err.table} detail=${err.detail}`,
    };
  }
  return {
    status: 500,
    body: { error: 'Database error' },
    logDetail: (err && err.message) || String(err),
  };
}

module.exports = { buildOrphanCleanupQueries, classifyUsernameUpdateError };
