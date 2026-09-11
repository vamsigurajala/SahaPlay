// Same pattern as gcwPersist.js (chat widget) and searchTabPersist.js
// (BottomNav's full-screen mobile Search tab, standalone-app only) — this
// one is for Navbar's own search dropdown, which is what actually renders
// in a regular mobile browser tab (BottomNav only mounts inside an
// installed PWA/TWA). The dropdown is an overlay on whatever page hosts
// Navbar, not its own route, so tapping a result and swiping back from
// their profile has nothing of its own to land back on unless this page's
// next mount is told to restore it open.
export function getPersistedNavbarSearchOpen() {
  try { return sessionStorage.getItem('navbar_search_open') === 'true'; } catch { return false; }
}

export function setPersistedNavbarSearchOpen(open) {
  try {
    if (open) sessionStorage.setItem('navbar_search_open', 'true');
    else sessionStorage.removeItem('navbar_search_open');
  } catch {}
}
