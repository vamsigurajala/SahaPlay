// Pure decision rules for the join_room / executeFinalJoin flow in server.js.
// Same split as lib/callStateMachine.js: server.js still owns all the real
// state (the rooms Map, pendingJoins, approvedUsers/approvedSockets, DB
// queries, socket emits/joins) — these functions only ever answer "given
// this state, what should happen", so the room-lock/members-only/host-
// assignment rules can be pinned by tests without a live room/DB/socket.

// Used identically at three points in server.js: the fast in-memory
// pre-check in 'join_room' (before any DB round-trip), the definitive check
// after room metadata has loaded, and (inverted) whether to flag someone as
// eligible for auto-admin. A guest is either the literal 'Anonymous' socket
// identity or any username under the 'guest_' prefix used for ephemeral
// local/QR-join accounts.
function isGuestUsername(username) {
  return username === 'Anonymous' || (username || '').toLowerCase().startsWith('guest_');
}

// The "Members Only" room setting blocks guests — unless this joiner is
// already recognized as the room's actual host (a host who created the room
// while logged in, then somehow ended up guest-flagged, still gets in — this
// mirrors the original code's unconditional host bypass, not a new rule).
function isMembersOnlyRejected({ onlyLoggedIn, isGuestOrLocal, isActuallyHost }) {
  return !!onlyLoggedIn && !!isGuestOrLocal && !isActuallyHost;
}

// The definitive join-room gate, run once room settings/bans have loaded
// from the DB. `isApproved` is the caller's already-resolved lookup (a
// username match in room.approvedUsers, or this exact socket in
// room.approvedSockets) — kept out of this function since it's a live Set
// lookup, not a decision rule. The host always passes both checks
// unconditionally (matches the original code's `if (!isActuallyHost) { ... }`
// wrapper around both the members-only and lock-room checks).
function evaluateJoinGate({ isActuallyHost, onlyLoggedIn, isGuestOrLocal, lockRoom, isApproved }) {
  if (isMembersOnlyRejected({ onlyLoggedIn, isGuestOrLocal, isActuallyHost })) {
    return { result: 'rejected', reason: 'members_only' };
  }
  if (!isActuallyHost && lockRoom && !isApproved) {
    return { result: 'pending' };
  }
  return { result: 'ok' };
}

// Whether this joiner should become (or reclaim) the room's hostId/
// hostUsername. `isDbHost` means the DB's recorded hostUsername already
// matches this joiner — always wins, whether the room is empty or not (a
// true host reconnecting into an occupied room reclaims host). Otherwise,
// only an empty room with no host on record yet, joined by a non-guest, ever
// assigns a fresh host (a guest can never become host by just being first
// through the door).
function shouldAssignHost({ roomIsEmpty, isDbHost, hostUsernameAlreadySet, isGuestStr }) {
  if (isDbHost) return true;
  return !!roomIsEmpty && !hostUsernameAlreadySet && !isGuestStr;
}

// Whether to tell this joiner they now have admin rights via the room's
// "auto-admin for new members" setting. Never fires for a guest, and never
// fires for whoever is (or just became) the room's host — the host is
// already admin by another path, this is specifically the "you're an
// ordinary member but this room auto-grants admin" notification.
function shouldNotifyAutoAdmin({ autoAdminEnabled, isGuestStr, isRoomHost }) {
  return !!autoAdminEnabled && !isGuestStr && !isRoomHost;
}

function isBannedFromRoom(bannedUsers, username) {
  return !!bannedUsers?.has(username);
}

module.exports = {
  isGuestUsername,
  isMembersOnlyRejected,
  evaluateJoinGate,
  shouldAssignHost,
  shouldNotifyAutoAdmin,
  isBannedFromRoom,
};
