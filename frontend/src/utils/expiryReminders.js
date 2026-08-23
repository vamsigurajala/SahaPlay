// Expiry reminder banner — shown inside an open chat when it has media
// (photos/videos/files/voice notes) about to expire per the retention
// policy shown in App Settings > Privacy & Storage. The "Show expiry
// reminders in chat" toggle there (localStorage 'expiry_reminders') used to
// have no consumer anywhere in the app — this is that consumer.
//
// Per-conversation dismissal state, keyed by chatKey (room id, or the DM
// partner's lowercase username):
//   { dismissedForever: true }        — "Got it", never nag again here
//   { snoozeUntil: <epoch ms> }       — "Remind me later", re-check after 3 days
const STORAGE_KEY = 'expiry_banner_state';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // "close to expiring" = within 24h

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeState(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
}

export function dismissExpiryBannerForever(chatKey) {
  if (!chatKey) return;
  const all = readState();
  all[chatKey] = { dismissedForever: true };
  writeState(all);
}

export function snoozeExpiryBanner(chatKey) {
  if (!chatKey) return;
  const all = readState();
  all[chatKey] = { snoozeUntil: Date.now() + SNOOZE_MS };
  writeState(all);
}

export function expiryRemindersEnabled() {
  return localStorage.getItem('expiry_reminders') !== 'false';
}

function isBannerSuppressed(chatKey) {
  const entry = readState()[chatKey];
  if (!entry) return false;
  if (entry.dismissedForever) return true;
  if (entry.snoozeUntil && Date.now() < entry.snoozeUntil) return true;
  return false; // snooze expired — show it again, matching the 3-day re-show
}

/**
 * Returns the count of messages in `messages` whose media expires within the
 * next 24h, or 0 if the banner shouldn't show at all right now (feature off,
 * dismissed forever, still snoozed, or nothing actually expiring soon).
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
