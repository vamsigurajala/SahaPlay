// Pure decision logic behind DELETE /api/chats/message/:id's self-hide
// ("local delete") action. Extracted so the actual relationship rule is
// unit-testable without a database or Express request — server.js's
// isAuthorizedToHideMessage() resolves room membership (an async DB call
// via getRoomParticipantUsernames) and hands the result in here.
//
// E2E audit Fix 2: previously any authenticated user who knew a message id
// could add themselves to that message's hiddenFor list regardless of any
// relationship to it. Self-scoped and therefore inert (hiddenFor only ever
// filters that same user's own history query) but still a real missing
// check — this is the allowlist that closes it: the sender, the DM
// recipient, or (for room/group messages) someone who has ever opened that
// room's chat.
function canHideMessage(username, msg, roomMemberUsernames) {
  const uname = (username || '').toLowerCase();
  const senderName = (msg?.senderName || '').toLowerCase();
  if (senderName === uname) return true;
  if (msg?.type === 'private') {
    return (msg?.targetName || '').toLowerCase() === uname;
  }
  // 'room' / 'group' messages
  return (roomMemberUsernames || []).some(p => (p || '').toLowerCase() === uname);
}

module.exports = { canHideMessage };
