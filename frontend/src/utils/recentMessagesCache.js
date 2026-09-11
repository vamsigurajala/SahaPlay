// Instant "flash of recent messages" cache used by both Room.jsx's inline
// group chat panel and GlobalChatWidget.jsx's floating chat window.
//
// Opening (or reopening) a chat always re-fetches + re-decrypts full
// history from the server, which used to mean the whole panel went blank
// for a beat every single time — including the extremely common case of
// tapping a sender's avatar to view their profile, then swiping/going back
// to the exact same chat a second later. That reopen has no new
// information to show; it was just re-paying the same network+decrypt cost
// it just paid.
//
// This stores only the last MAX_CACHED already-decrypted messages per chat
// in localStorage — deliberately NOT sessionStorage, since the whole point
// is to survive a full app relaunch (closing and reopening the .exe/APK/
// PWA, or a fresh browser tab) and still flash instantly right after
// login, not just navigation within one still-open tab. On open, the
// caller renders this snapshot immediately instead of a blank/spinner
// state, then replaces it the moment the real fetch resolves — exactly the
// same "instant local, reconcile with server" pattern already used
// elsewhere in this app (e.g. guest room messages). Cleared on logout by
// authUtils.js's clearUserSession (its prefixesToRemove list), the same
// way this app already purges locked_chats_/pinned_chats_/etc. — so it
// never bleeds into a different account signing in on the same device.
const MAX_CACHED = 4;
const PREFIX = 'sp_recent_msgs_';
// A data:/blob: URL is either huge (data:) or dead after a reload (blob:,
// scoped to the page that created it) — worth caching neither. Dropping it
// just means that one flashed message's media briefly shows no thumbnail
// until the real fetch lands a moment later; everything else about the
// cached snapshot is unaffected.
const stripHeavyFields = (m) => {
  if (!m || typeof m !== 'object') return m;
  const clean = { ...m };
  if (typeof clean.mediaUrl === 'string' && /^(data|blob):/i.test(clean.mediaUrl)) delete clean.mediaUrl;
  if (typeof clean.thumbnailUrl === 'string' && /^(data|blob):/i.test(clean.thumbnailUrl)) delete clean.thumbnailUrl;
  return clean;
};

function cacheKey(scope, chatKey) {
  return PREFIX + scope + '_' + String(chatKey || '').toLowerCase();
}

// Returns the cached array (up to MAX_CACHED messages, oldest-first — same
// order the message list itself uses) or null if nothing's cached yet.
export function getRecentMessagesCache(scope, chatKey) {
  try {
    const raw = localStorage.getItem(cacheKey(scope, chatKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

// Call this with the full, up-to-date message list every time it settles
// (after a successful fetch, and again as new messages arrive) — only the
// tail end is persisted.
export function setRecentMessagesCache(scope, chatKey, messages) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return;
    const tail = messages.slice(-MAX_CACHED).map(stripHeavyFields);
    localStorage.setItem(cacheKey(scope, chatKey), JSON.stringify(tail));
  } catch {
    // Quota exceeded or storage unavailable (private browsing, etc.) — the
    // flash is a nice-to-have, never worth failing the actual chat over.
  }
}

export function clearRecentMessagesCache(scope, chatKey) {
  try { localStorage.removeItem(cacheKey(scope, chatKey)); } catch {}
}
