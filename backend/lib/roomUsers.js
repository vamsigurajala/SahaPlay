// Pure room-membership helpers, moved out of server.js verbatim (no logic
// change) so the admin/mute/visibility rules are testable without a live
// room/DB/socket. Both functions only ever read the room-shaped object
// (Maps/Sets/plain fields) and userOrSocket-shaped objects passed in —
// no IO, no mutation.

// Helper to check if a user has admin privileges in a room
function isUserAdmin(room, userOrSocket) {
  if (!room || !userOrSocket) return false;

  // Normalized identifiers
  const socketId = userOrSocket.socketId || userOrSocket.id;
  const username = userOrSocket.username;

  // 1. Host is always admin
  const isHost = (room.hostId === socketId) ||
                 (room.hostUsername && username && room.hostUsername.toLowerCase() === username.toLowerCase());
  if (isHost) return true;

  // 2. Manual Admin check
  if (room.admins && username && room.admins.has(username.toLowerCase())) {
    return true;
  }

  // 3. Auto-Admin logic (Applies to all users if setting is enabled)
  // Check if they are explicitly denied first
  if (room.deniedAdmins && username && room.deniedAdmins.has(username.toLowerCase())) {
    return false;
  }

  const isAutoAdminEnabled = room.settings?.newMembersAdmins === true || room.settings?.newMembersAdmins === 'true';
  if (isAutoAdminEnabled && username) {
    return true;
  }

  return false;
}

function buildUserList(room) {
  // Collect usernames that are currently pending approval so we can exclude them
  // from the active member list. This handles the case where a user was in the room
  // before it was locked and their old socket entry is still in room.users.
  const pendingUsernames = new Set();
  if (room.pendingJoins) {
    room.pendingJoins.forEach(pending => {
      if (pending.username) pendingUsernames.add(pending.username.toLowerCase());
    });
  }

  return room.users
    .filter(u => !pendingUsernames.has((u.username || '').toLowerCase()))
    .map(u => {
      const isModeratorMuted = room.mutedUsers.has(u.username);
      return {
        socketId: u.socketId,
        username: u.username,
        isMuted: !!(u.isMuted || isModeratorMuted),
        isModMuted: isModeratorMuted,
        isHost: u.socketId === room.hostId,
        isAdmin: isUserAdmin(room, u),
        publicKey: room.publicKeys?.[u.socketId] || u.publicKey || null,
        avatarPath: u.avatarPath || null,
        country: (u.showCountry !== false && u.showCountry !== 0 && u.showCountry !== '0') ? (u.country || null) : null,
        countryCode: (u.showCountry !== false && u.showCountry !== 0 && u.showCountry !== '0') ? (u.countryCode || null) : null
      };
    });
}

module.exports = { isUserAdmin, buildUserList };
