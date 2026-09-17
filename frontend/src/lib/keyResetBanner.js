/**
 * keyResetBanner.js
 *
 * Resetting an E2EE passphrase WITHOUT a recovery key (EncryptionUnlockGate's
 * "start fresh" flow) mints a brand-new keypair — every contact's client
 * needs to notice the rotation and re-fetch this account's new public key
 * before their next send encrypts correctly against it (see
 * dmKeyResolution.js). That's normally near-instant, but isn't guaranteed to
 * be: a contact's client only re-resolves the key on their NEXT send, so a
 * message already in flight, or sent before their client's live lookup
 * catches up, can briefly render as "Encrypted message" instead of failing
 * loudly with a clear reason. Rather than leave that unexplained, this marks
 * a short window right after a reset during which GlobalChatWidget shows a
 * plain-language heads-up on every private chat, so it reads as "expected,
 * temporary" instead of "broken."
 *
 * Scoped per-account (the localStorage key includes the username) so it
 * survives a page reload but never leaks into a different account signed in
 * on the same browser/device.
 */
const BANNER_DURATION_MS = 10 * 60 * 1000; // 10 minutes

function untilKey(username) { return `wt_key_reset_until_${(username || '').toLowerCase()}`; }
function dismissedKey(username) { return `wt_key_reset_dismissed_${(username || '').toLowerCase()}`; }

/** Call right after a passphrase reset without a recovery key completes. */
export function markKeyResetForBanner(username) {
  if (!username) return;
  try {
    localStorage.setItem(untilKey(username), String(Date.now() + BANNER_DURATION_MS));
    localStorage.removeItem(dismissedKey(username));
  } catch {}
}

/** Whether the "your messages may take a few minutes to sync" banner should show right now. */
export function shouldShowKeyResetBanner(username) {
  if (!username) return false;
  try {
    if (localStorage.getItem(dismissedKey(username)) === 'true') return false;
    const until = Number(localStorage.getItem(untilKey(username)) || 0);
    return Date.now() > 0 && Date.now() < until;
  } catch {
    return false;
  }
}

/** "Got it" — hides the banner for the rest of this reset's window (a future reset shows it again). */
export function dismissKeyResetBanner(username) {
  if (!username) return;
  try { localStorage.setItem(dismissedKey(username), 'true'); } catch {}
}
