-- ============================================================================
-- Find orphaned username references — "ghost" accounts
-- ============================================================================
-- Run this in the Supabase SQL editor (or any Postgres client connected to
-- this app's database). It's read-only — SELECT statements only, nothing is
-- changed.
--
-- WHY THIS HAPPENED: before this session's fix, changing a username
-- (PUT /api/profile/username) only updated the `users` row itself. Several
-- other tables store usernames as plain strings instead of a stable user id
-- (follows, blocks, messages, message_seen, room_names, push registrations),
-- so a past rename left those tables still pointing at the OLD username —
-- a name that no longer exists in `users`. That's exactly the "blank avatar,
-- then 'user not found' on click" symptom: the conversations list built a
-- row from a `messages` thread addressed to e.g. "sam", but `users` now has
-- no one by that name (they renamed to something else, or the name is a
-- leftover from testing). New renames from now on cascade correctly and
-- won't create any more of these — this script is only for cleaning up
-- damage from BEFORE that fix existed.
--
-- Read every result section below before deciding what (if anything) to do
-- with it — see the "WHAT TO DO WITH THE RESULTS" notes at the bottom.
-- ============================================================================

-- 1) Orphaned FOLLOWS — a follow row pointing at a username with no matching
--    user. followerCount/query most directly explains "Friendship required"
--    for a pair that should be mutual: if either side of the pair is
--    orphaned, that direction of the relationship is invisible to every
--    follow-status check.
SELECT 'follows.followerId' AS location, "followerId" AS orphaned_username, COUNT(*) AS row_count
FROM follows f
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(f."followerId"))
GROUP BY "followerId"
UNION ALL
SELECT 'follows.followingId', "followingId", COUNT(*)
FROM follows f
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(f."followingId"))
GROUP BY "followingId"

UNION ALL

-- 2) Orphaned BLOCKS
SELECT 'blocks.blocker', blocker, COUNT(*)
FROM blocks b
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(b.blocker))
GROUP BY blocker
UNION ALL
SELECT 'blocks.blocked', blocked, COUNT(*)
FROM blocks b
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(b.blocked))
GROUP BY blocked

UNION ALL

-- 3) Orphaned MESSAGES — this is the one that shows up as a broken
--    conversations-list entry (blank avatar, "user not found" on click).
--    row_count here can be large for an active DM thread; that's expected.
SELECT 'messages.senderName', "senderName", COUNT(*)
FROM messages m
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(m."senderName"))
GROUP BY "senderName"
UNION ALL
SELECT 'messages.targetName', "targetName", COUNT(*)
FROM messages m
WHERE m."targetName" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(m."targetName"))
GROUP BY "targetName"

UNION ALL

-- 4) Orphaned ROOM HOSTS — a room whose recorded host no longer exists
--    under that name.
SELECT 'room_names.hostUsername', "hostUsername", COUNT(*)
FROM room_names r
WHERE "hostUsername" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username) = LOWER(r."hostUsername"))
GROUP BY "hostUsername"

ORDER BY location, row_count DESC;


-- ============================================================================
-- Narrow to just names containing "sam" (case-insensitive), matching what
-- you're chasing right now — run this on its own instead of the big query
-- above if you just want the one name.
-- ============================================================================
-- SELECT 'follows.followerId' AS location, "followerId" AS name, COUNT(*) FROM follows f WHERE f."followerId" ILIKE '%sam%' AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username)=LOWER(f."followerId")) GROUP BY 2
-- UNION ALL SELECT 'follows.followingId', "followingId", COUNT(*) FROM follows f WHERE f."followingId" ILIKE '%sam%' AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username)=LOWER(f."followingId")) GROUP BY 2
-- UNION ALL SELECT 'messages.senderName', "senderName", COUNT(*) FROM messages m WHERE m."senderName" ILIKE '%sam%' AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username)=LOWER(m."senderName")) GROUP BY 2
-- UNION ALL SELECT 'messages.targetName', "targetName", COUNT(*) FROM messages m WHERE m."targetName" ILIKE '%sam%' AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.username)=LOWER(m."targetName")) GROUP BY 2;


-- ============================================================================
-- WHAT TO DO WITH THE RESULTS
-- ============================================================================
-- For each orphaned_username that shows up, there are two real options:
--
-- OPTION A — you know who it used to be (e.g. you remember "sam" is now
-- "sams", or you can ask that contact). This is the good outcome: it
-- preserves the follow relationship / DM history instead of deleting it.
-- Rename it forward the same way the app's own fix now does it, e.g. for
-- "sam" -> "sams" (repeat the block per table that had a hit):
--
--   UPDATE follows        SET "followerId"  = 'sams' WHERE LOWER("followerId")  = LOWER('sam');
--   UPDATE follows        SET "followingId" = 'sams' WHERE LOWER("followingId") = LOWER('sam');
--   UPDATE blocks         SET blocker       = 'sams' WHERE LOWER(blocker)       = LOWER('sam');
--   UPDATE blocks         SET blocked       = 'sams' WHERE LOWER(blocked)       = LOWER('sam');
--   UPDATE messages       SET "senderName"  = 'sams' WHERE LOWER("senderName")  = LOWER('sam');
--   UPDATE messages       SET "targetName"  = 'sams' WHERE LOWER("targetName")  = LOWER('sam');
--   UPDATE message_seen   SET username      = 'sams' WHERE LOWER(username)      = LOWER('sam');
--   UPDATE room_names     SET "hostUsername"= 'sams' WHERE LOWER("hostUsername")= LOWER('sam');
--   UPDATE push_tokens              SET username = 'sams' WHERE LOWER(username) = LOWER('sam');
--   UPDATE webpush_subscriptions    SET username = 'sams' WHERE LOWER(username) = LOWER('sam');
--   UPDATE pending_notifications    SET username = 'sams' WHERE LOWER(username) = LOWER('sam');
--
-- OPTION B — the name is truly dead (a test account, or nobody remembers
-- who it was). There's nothing to remap it TO, so the only honest cleanup
-- is to delete the orphaned rows — this is IRREVERSIBLE and, for the
-- `messages` table specifically, permanently deletes that chat content for
-- the other side of the conversation too (a DM row is shared storage between
-- both participants). Back up first if in doubt. Only run what's actually
-- orphaned in YOUR results above — do not run this blind:
--
--   DELETE FROM follows      WHERE LOWER("followerId")  = LOWER('sam') OR LOWER("followingId") = LOWER('sam');
--   DELETE FROM blocks       WHERE LOWER(blocker)        = LOWER('sam') OR LOWER(blocked)        = LOWER('sam');
--   DELETE FROM messages     WHERE LOWER("senderName")   = LOWER('sam') OR LOWER("targetName")   = LOWER('sam');
--   DELETE FROM message_seen WHERE LOWER(username)       = LOWER('sam');
--   -- room_names: don't delete the room itself over an orphaned host name —
--   -- just clear the stale attribution:
--   UPDATE room_names SET "hostUsername" = NULL WHERE LOWER("hostUsername") = LOWER('sam');
--
-- Pick per name, not globally — a batch of orphaned names can be a mix of
-- "actually renamed" (Option A) and "genuinely dead" (Option B).
