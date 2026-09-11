// Mirrors gcwPersist.js's pattern for the exact same reason: BottomNav's
// mobile "Search" tab is a full-screen overlay over the CURRENT page (Home,
// Public Rooms, etc.), not its own route — so it has no history entry of
// its own to swipe back to. Tapping a search result navigates to a real
// route (/profile/:username or /room/:id), which pushes a genuine history
// entry on top; useBackIntercept deliberately leaves the "search was open"
// marker entry inert for that case (see its skipNextClose doc) rather than
// consuming it, so swiping back from the result lands back on the
// originating page's own history entry — but that page would otherwise
// remount with a fresh, closed search overlay, reading as "swiped back to
// the result and landed on Home instead of back on my search". Persisting
// "search was left open because of a result click" here lets that fresh
// mount restore the overlay instead of defaulting closed.
export function getPersistedSearchOpen() {
  try { return sessionStorage.getItem('bottomnav_search_open') === 'true'; } catch { return false; }
}

export function setPersistedSearchOpen(open) {
  try {
    if (open) sessionStorage.setItem('bottomnav_search_open', 'true');
    else sessionStorage.removeItem('bottomnav_search_open');
  } catch {}
}
