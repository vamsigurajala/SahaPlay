// Whitelist of permission keys allowed to survive a room-settings save (see
// backend/server.js's 'update_room_settings' socket handler) — originally
// added to block payload pollution (a client sending arbitrary keys), but
// it silently became the cause of a real bug when 'cam'/'mic' were added
// elsewhere as real, enforced permission keys without this list being
// updated to match: every save stripped them back out, so Room Settings'
// "Who can use webcam/microphone?" toggles always reverted to "Allow All"
// the instant you saved, no matter what you picked.
//
// Extracted into its own module (rather than left inline) so this exact
// whitelist is unit-testable without needing a socket connection or a
// database — see roomPermissions.test.js, which pins the 'cam'/'mic'
// regression directly.
const ALLOWED_PERM_KEYS = new Set([
  'chat', 'media', 'screen', 'join', 'allowLinks', 'allowMedia', 'lobby', 'password',
  'cam', 'mic', 'changeMedia',
]);

// Returns a NEW object containing only the whitelisted keys present on the
// input — never mutates the input, and never lets an unknown key (or a
// prototype-pollution attempt like '__proto__') through.
function sanitizeRoomPermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return {};
  const safe = {};
  for (const key of ALLOWED_PERM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(permissions, key)) safe[key] = permissions[key];
  }
  return safe;
}

module.exports = { ALLOWED_PERM_KEYS, sanitizeRoomPermissions };
