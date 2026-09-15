// Both the long-press (touch) and "..." (desktop click) message action menus
// decide whether to open above or below the touched/clicked row by comparing
// the touch/click Y position against a "floor" — this used to always be
// window.innerHeight, which only actually lines up with the real visible
// boundary when the chat fills the entire browser window (a phone in
// portrait). On a laptop/tablet, where the chat is a panel embedded well
// above the bottom of the window (a docked sidebar, a floating widget), that
// floor is wrong: a row near the PANEL's own bottom edge — right above its
// message composer — can still have plenty of raw window height beneath it,
// so the old check picked "open below" and the menu rendered past the
// panel's edge, hidden underneath the composer/message box. The one boundary
// that's actually correct in every layout (any screen size, any panel
// shape) is the composer's own top edge — that's the surface the menu must
// never render underneath.
//
// `scope` is either a DOM element to search within directly (e.g. a ref
// already held by the caller), or a CSS selector resolved via `rowEl.closest()`
// so it correctly scopes to the SAME panel instance the touched/clicked row
// actually lives in — not just the first match anywhere in the document,
// which matters when more than one chat panel can be mounted at once (e.g.
// a desktop and a mobile-floating RoomChatPanel instance both present).
export function getMenuFloorY(rowEl, scope) {
  let scopeEl = null;
  if (typeof scope === 'string') {
    scopeEl = rowEl?.closest?.(scope) || null;
  } else if (scope) {
    scopeEl = scope;
  }
  const composer = (scopeEl || document).querySelector?.('.chat-msg-textarea');
  if (composer) return composer.getBoundingClientRect().top;
  return window.innerHeight;
}

// The 'up'/'down' decision only ever checked the floor (composer) above —
// reported live for RoomChatPanel specifically: a row near the very TOP of
// its own scrollable list (right under the panel's own group/DM name header
// — its own internal "nav bar", not the outer page's) still defaulted to
// 'up' whenever there was enough floor clearance, opening the menu straight
// underneath that header with nowhere further up to go. GlobalChatWidget's
// floating widget never hit this in practice (its own header leaves more
// natural clearance above), so this ceiling check resolves to 0 there —
// same as no ceiling at all — and its behavior is unchanged.
// `.room-chat-panel-header` is RoomChatPanel.jsx's own internal header bar
// (the room/DM name + back button), present on both its group and DM tabs.
export function getMenuCeilingY(rowEl, scope) {
  let scopeEl = null;
  if (typeof scope === 'string') {
    scopeEl = rowEl?.closest?.(scope) || null;
  } else if (scope) {
    scopeEl = scope;
  }
  const header = (scopeEl || document).querySelector?.('.room-chat-panel-header');
  if (header) return header.getBoundingClientRect().bottom;
  return 0;
}

// Combines both boundaries into the actual open-up-vs-down decision, so
// every call site does one call instead of duplicating this comparison.
// Default is 'down' (matches every existing call site's own prior
// behavior) whenever there's room; only flips to 'up' when the floor is
// too close, and — the actual fix here — falls back to whichever side has
// MORE room when NEITHER side comfortably fits, rather than blindly
// preferring 'up' regardless of how little room is actually above.
export function getMenuPlacement(rowEl, scope, menuHeight = 260) {
  if (!rowEl?.getBoundingClientRect) return 'up';
  const rect = rowEl.getBoundingClientRect();
  const spaceBelow = getMenuFloorY(rowEl, scope) - rect.bottom;
  const spaceAbove = rect.top - getMenuCeilingY(rowEl, scope);
  if (spaceBelow >= menuHeight) return 'down';
  if (spaceAbove >= menuHeight) return 'up';
  return spaceAbove > spaceBelow ? 'up' : 'down';
}
