// Expiry reminder banner — shown inside an open chat when it has media
// (photos/videos/files/voice notes) about to expire per the retention
// policy shown in App Settings > Privacy & Storage. The "Show expiry
// reminders in chat" toggle there (localStorage 'expiry_reminders') gates
// this off completely when disabled.
//
// Per-conversation dismissal state, keyed by chatKey (room id, or the DM
// partner's lowercase username), shared via localStorage so the Room chat
// panel and the floating global chat window stay in sync for the same
// conversation:
//   { gotItUntil: <epoch ms> }  — "Got it", re-show after ~12 hours
//   { remindLater: true }      — "Remind me later", re-show once the chat
//                                 is closed and reopened (cleared by the
//                                 component itself when that happens, not
//                                 by time)
const STORAGE_KEY = 'expiry_banner_state';
const GOT_IT_MS = 12 * 60 * 60 * 1000; // 12 hours
const SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // "close to expiring" = within 24h

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeState(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
}

export function dismissExpiryBanner12h(chatKey) {
  if (!chatKey) return;
  const all = readState();
  all[chatKey] = { gotItUntil: Date.now() + GOT_IT_MS };
  writeState(all);
}

export function snoozeExpiryBannerUntilClose(chatKey) {
  if (!chatKey) return;
  const all = readState();
  all[chatKey] = { remindLater: true };
  writeState(all);
}

// Called when the chat is closed / navigated away from, so the banner
// re-appears next time the same chat is opened.
export function clearExpiryBannerCloseSuppression(chatKey) {
  if (!chatKey) return;
  const all = readState();
  if (all[chatKey]?.remindLater) {
    delete all[chatKey];
    writeState(all);
  }
}

export function expiryRemindersEnabled() {
  return localStorage.getItem('expiry_reminders') !== 'false';
}

function isBannerSuppressed(chatKey) {
  const entry = readState()[chatKey];
  if (!entry) return false;
  if (entry.remindLater) return true;
  if (entry.gotItUntil && Date.now() < entry.gotItUntil) return true;
  return false; // suppression expired — show it again
}

/**
 * Returns the count of messages in `messages` whose media expires within the
 * next 24h, or 0 if the banner shouldn't show at all right now (feature off,
 * snoozed via "Got it"/"Remind me later", or nothing actually expiring soon).
 */
export function countSoonExpiringMedia(messages, chatKey) {
  if (!expiryRemindersEnabled()) return 0;
  if (!chatKey || isBannerSuppressed(chatKey)) return 0;
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  const now = Date.now();
  let count = 0;
  for (const m of messages) {
    if (!m?.mediaExpiresAt) continue;
    const exp = new Date(m.mediaExpiresAt).getTime();
    if (Number.isFinite(exp) && exp > now && (exp - now) < SOON_WINDOW_MS) count++;
  }
  return count;
}
