// Tiny shared "is a pull-to-refresh drag currently allowed to start" gate.
//
// GlobalChatWidget is a full-screen overlay that stays mounted the whole
// time (see its own `display: isOpen ? 'flex' : 'none'`) and renders ON TOP
// of whichever window-scrolling page (Home/PublicRooms/PinnedRooms) is
// behind it, without unmounting that page. Those pages each attach their own
// PullToRefresh drag-tracking listeners to `window` — and since the page
// behind never actually scrolls while the chat overlay is open on top of it,
// `window.scrollY` stays 0 the whole time, so a drag gesture happening
// entirely inside the open chat (e.g. scrolling an open conversation toward
// its top to load older messages) used to be misread by the page behind as
// "pull to refresh" and reload the whole app out from under the open chat.
//
// Any full-screen overlay that can sit on top of a window-scrolling page
// should call blockPullToRefresh() for as long as it's open (and
// unblockPullToRefresh() when it closes/unmounts); PullToRefresh checks
// isPullToRefreshBlocked() before starting a drag. A counter, not a
// boolean, so more than one overlay blocking at once can't accidentally
// unblock each other early.
let blockCount = 0;

export function blockPullToRefresh() {
  blockCount += 1;
}

export function unblockPullToRefresh() {
  blockCount = Math.max(0, blockCount - 1);
}

export function isPullToRefreshBlocked() {
  return blockCount > 0;
}
