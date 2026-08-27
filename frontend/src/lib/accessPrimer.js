// Tracks whether the user has already been shown (and accepted) this app's
// own explanatory prompt for a given device-access flow — camera, or
// photos/files — before the real browser/OS permission dialog fires. Shown
// once per browser profile / app install, never again after that, matching
// how a real OS permission is only ever asked once.
const KEY_PREFIX = 'sahaplay_access_primer_';

export function hasSeenAccessPrimer(kind) {
  try { return localStorage.getItem(KEY_PREFIX + kind) === '1'; } catch { return false; }
}

export function markAccessPrimerSeen(kind) {
  try { localStorage.setItem(KEY_PREFIX + kind, '1'); } catch { /* private/incognito mode — just re-asks next time */ }
}
