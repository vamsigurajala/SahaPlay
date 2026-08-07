// Reserved id for the mandatory SahaPlay announcements group — must match
// SAHAPLAY_OFFICIAL_ROOM_ID in backend/server.js exactly. Every signed-in
// user sees this conversation unconditionally (server force-includes it in
// /api/chats/recent); only admin/super_admin accounts may post in it
// (enforced server-side in /api/chats/send). Messages in this one group are
// intentionally unencrypted — it's a public one-to-many bulletin, not a
// private conversation, and there's no fixed participant list to wrap a
// group E2EE key for since every user in the app is a member.
export const SAHAPLAY_OFFICIAL_ROOM_ID = 'sahaplay-official';
export const SAHAPLAY_OFFICIAL_DISPLAY_NAME = 'SahaPlay Updates';

export function isSahaplayOfficialGroup(roomIdOrChat) {
  const id = typeof roomIdOrChat === 'string' ? roomIdOrChat : (roomIdOrChat?.partner || roomIdOrChat?.id || roomIdOrChat?.roomId);
  return !!id && id.toLowerCase() === SAHAPLAY_OFFICIAL_ROOM_ID;
}
