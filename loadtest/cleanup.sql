-- Run this against the SAME production Postgres connection string, via psql
-- or the Supabase SQL editor, AFTER all stages below are complete.
--
-- Uses regex anchors (^...$), not a bare LIKE wildcard, specifically so it
-- cannot partially match a real username/room id that merely contains
-- "loadtest" somewhere in it — it only matches the EXACT generated pattern.

BEGIN;

-- Step 1: dry run — look at these counts before deleting anything.
SELECT 'messages' AS table_name, COUNT(*) AS rows_to_delete
  FROM messages
  WHERE "roomId" ~ '^loadtest-room-[0-9]+$' OR "senderName" ~ '^loadtest_user_[0-9]+$'
UNION ALL
SELECT 'message_seen', COUNT(*)
  FROM message_seen
  WHERE room_id ~ '^loadtest-room-[0-9]+$' OR username ~ '^loadtest_user_[0-9]+$'
UNION ALL
SELECT 'room_names', COUNT(*)
  FROM room_names
  WHERE "roomId" ~ '^loadtest-room-[0-9]+$';

-- Step 2: if those counts match what you expect (rows created by THIS test
-- run only), run the deletes below, then COMMIT.
-- If anything looks off — e.g. a count way higher than expected — run
-- ROLLBACK instead and stop; do not COMMIT.

DELETE FROM message_seen WHERE room_id ~ '^loadtest-room-[0-9]+$' OR username ~ '^loadtest_user_[0-9]+$';
DELETE FROM messages WHERE "roomId" ~ '^loadtest-room-[0-9]+$' OR "senderName" ~ '^loadtest_user_[0-9]+$';
DELETE FROM room_names WHERE "roomId" ~ '^loadtest-room-[0-9]+$';

-- COMMIT;   -- uncomment and run once counts look right
-- ROLLBACK; -- run this instead if anything looks wrong
