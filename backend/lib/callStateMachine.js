// Pure decision rules for the 1:1 call socket handlers in server.js
// ('call:invite'/'call:accept'/'call:decline'/'call:cancel'). Deliberately
// split out from the real handlers the same way lib/notifyPrefs.js splits
// the DB fetch from the decision: server.js still owns all the actual state
// (the activeCalls/userActiveCallId Maps), timers, DB queries, socket emits,
// and pushes — these functions only ever answer "given this state, what
// should happen", with no side effects, which is what makes them testable
// without a live socket/DB/timer at all.
//
// This is exactly the class of logic that broke earlier this session: a
// double-accept race (two 'call:accept' events for the same call landing
// close together), and a busy-check ordering bug (declining a call then
// immediately being called back reported "already in another call" even
// though the first call had genuinely ended). Both were fixed by getting
// these exact rules right — pinning them here means a future change to this
// file can't silently reintroduce either.
//
// call:invite's real handler is split into THREE separate checks (not one
// combined function) because it genuinely happens in three phases, in this
// exact order, and the middle one is load-bearing: the busy check MUST run
// and reserve userActiveCallId synchronously, before the friends/blocked
// checks (both DB round-trips) ever await — see server.js's own comment on
// why. Collapsing all three into one function would hide that ordering
// requirement instead of preserving it. call:add-member (below) reuses this
// same eligibility function, since it runs the identical friends/blocked
// check against the same 'call:invalid' reasons.

const { isActiveCallParticipant } = require('./callRoster');

// Phase 1 — is this even a well-formed request? A malformed request is
// silently ignored today (no event emitted at all), which this preserves.
function isValidCallInviteRequest({ caller, callee, callType }) {
  return !!caller && !!callee && caller !== callee && ['voice', 'video'].includes(callType);
}

// Phase 2 — busy check, evaluated (and reserved in server.js) synchronously
// before any DB await, specifically to close the double-tap/race window
// where two call:invite events landing close together could otherwise both
// read "not busy" and both proceed.
function isCallInviteBusy({ callerBusy, calleeBusy }) {
  return !!callerBusy || !!calleeBusy;
}

// Phase 3 — friends/blocked eligibility, only reachable once phases 1-2
// passed and the DB round-trips have resolved.
function evaluateCallInviteEligibility({ areFriends, isBlocked }) {
  if (!areFriends) return { result: 'invalid', reason: 'not_friends' };
  if (isBlocked) return { result: 'invalid', reason: 'blocked' };
  return { result: 'ok' };
}

// `call` is whatever activeCalls.get(callId) returned (undefined if the
// call is already gone/ended). A distinct reason per rejection matters:
// CallContext.jsx's acceptCall() flips its UI to "active" optimistically
// the instant Answer is tapped, before this round-trip — a bare rejection
// with no reason left that optimistic screen with nothing telling the user
// why it just vanished.
function evaluateCallAccept(call, me) {
  if (!call || call.callee !== me) return { allowed: false, reason: 'call_gone' };
  if (call.status !== 'ringing') return { allowed: false, reason: 'already_active' };
  return { allowed: true };
}

// No status check by design — a callee can decline a call that's already
// ended just as harmlessly as one still ringing; endCallInternal() no-ops
// on an already-gone callId either way.
function evaluateCallDecline(call, me) {
  if (!call || call.callee !== me) return { allowed: false };
  return { allowed: true };
}

// Only the caller can cancel, and only while it's still ringing — cancelling
// an already-active (answered) call isn't "cancel", that's "end".
function evaluateCallCancel(call, me) {
  if (!call || call.caller !== me || call.status !== 'ringing') return { allowed: false };
  return { allowed: true };
}

// ─── Group/mesh call additions ──────────────────────────────────────────

// call:add-member's first, silent-reject phase — malformed request, the
// caller not actually being on the call, or the call not yet being active
// (members can only be added to an already-connected call) all result in
// nothing happening today, no event emitted. `target` already-in-the-call
// and target-busy are distinct, event-emitting outcomes handled separately
// below since the real handler needs to tell the difference.
function isValidAddMemberRequest({ call, me, target }) {
  if (!call || !me || !target || me === target) return false;
  if (call.status !== 'active') return false;
  if (!isActiveCallParticipant(call, me)) return false;
  return true;
}

function isTargetAlreadyInCall(call, target) {
  return call.caller === target || call.callee === target || !!call.members?.has(target);
}

// `entry` is call.members.get(username) for the invitee being asked to
// actually join (the group-call equivalent of evaluateCallAccept above) —
// same two rejection reasons, same reasoning: CallContext.jsx's accept flow
// flips its UI optimistically before this round-trip completes.
function evaluateMemberJoin(entry) {
  if (!entry) return { allowed: false, reason: 'call_gone' };
  if (entry.status !== 'ringing') return { allowed: false, reason: 'already_active' };
  return { allowed: true };
}

// No distinct rejection reason needed — declining an invite that's already
// resolved one way or another is just a silent no-op today.
function evaluateMemberDecline(entry) {
  return { allowed: entry?.status === 'ringing' };
}

module.exports = {
  isValidCallInviteRequest,
  isCallInviteBusy,
  evaluateCallInviteEligibility,
  evaluateCallAccept,
  evaluateCallDecline,
  evaluateCallCancel,
  isValidAddMemberRequest,
  isTargetAlreadyInCall,
  evaluateMemberJoin,
  evaluateMemberDecline,
};
