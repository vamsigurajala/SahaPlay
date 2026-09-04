// Already-pure roster helpers, moved out of server.js verbatim (no logic
// change) so they're testable without a live socket/DB — both are read
// heavily across the group-call handlers (call:add-member, call:offer/
// answer/ice, call:state, call:get-roster, call:member-join, and the
// roster-self-heal poll CallContext.jsx's client side relies on), so a
// correctness bug here would show up as "the wrong people can/can't see or
// hear each other in a group call" — hard to reproduce, easy to miss in
// manual testing.

// All usernames currently actually connected to the call — the core pair
// (only once the call itself is 'active', i.e. post-accept) plus any
// members whose own status has flipped to 'active'. Ringing/not-yet-joined
// members are deliberately excluded — signaling should never be routed to
// someone who hasn't joined yet.
function getCallActiveUsernames(call) {
  const list = [];
  // caller/callee can be null once vacated by leaveActiveCall — filtered
  // out rather than pushed, since a departed core participant leaves no
  // trace here once they're gone (same as a departed member).
  if (call.status === 'active') {
    if (call.caller) list.push(call.caller);
    if (call.callee) list.push(call.callee);
  }
  if (call.members) {
    for (const [u, entry] of call.members) { if (entry.status === 'active') list.push(u); }
  }
  return list;
}

function isActiveCallParticipant(call, username) {
  if (!call || !username) return false;
  if (call.caller === username || call.callee === username) return call.status === 'active';
  return call.members?.get(username)?.status === 'active';
}

module.exports = { getCallActiveUsernames, isActiveCallParticipant };
