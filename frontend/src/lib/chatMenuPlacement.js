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
