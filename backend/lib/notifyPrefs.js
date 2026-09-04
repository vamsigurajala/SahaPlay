// Maps a push's category to the notify-toggle column AppSettings.jsx's
// per-category switches write to (see the camelCols allowlist in server.js's
// SupabaseAdapter, which is what lets these unquoted camelCase names
// round-trip through Postgres correctly).
const NOTIFY_COLUMN_BY_CATEGORY = {
  calls: 'notifyCalls',
  messages: 'notifyMessages',
  friendRequests: 'notifyFriendRequests',
};

// Pure decision logic, deliberately decoupled from the actual DB fetch (see
// isNotifyEnabled in server.js, which fetches `row` and delegates here) —
// that split is what makes this unit-testable without a database connection.
// `row` is whatever a `SELECT notifyApp, <column> FROM users ...` query
// returned (or null/undefined for "user not found", which fails OPEN since
// there's nothing to block). Both the master notifyApp toggle and the
// category-specific column must be truthy for a push to go out — matches
// the exact same "master AND category" gating Room.jsx/CallContext.jsx/
// GlobalChatWidget.jsx already apply client-side to toasts.
function isNotifyEnabledFromRow(row, category) {
  const column = NOTIFY_COLUMN_BY_CATEGORY[category];
  if (!column) return true; // no such category — nothing to gate on
  if (!row) return true;
  const appOn = row.notifyApp !== 0 && row.notifyApp !== false;
  const catOn = row[column] !== 0 && row[column] !== false;
  return appOn && catOn;
}

module.exports = { NOTIFY_COLUMN_BY_CATEGORY, isNotifyEnabledFromRow };
