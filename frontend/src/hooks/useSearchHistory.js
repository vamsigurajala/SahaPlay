import { useState, useCallback, useEffect } from 'react';

// Backs "recently searched" on every search surface in the app — Navbar's
// search dropdown (desktop and its own mobile-width block), Profile.jsx's
// and AppSettings.jsx's own copies of that same dropdown (users only), and
// the mobile/tablet full-screen Search tab (SearchTabContent.jsx via
// BottomNav, which also searches rooms). One shared localStorage list so
// searching from any of them builds (and clears) the same history
// everywhere, instead of several independent ones that all show something
// different. Entries are either a user ({ username, displayName,
// avatarPath }) or a room ({ type: 'room', roomId, roomName,
// thumbnailPath }) — the surfaces that only ever deal in users can keep
// passing plain user objects with no `type` field at all.
const KEY = 'sp_user_search_history';
const MAX_ENTRIES = 10;

// Accepts either a full entry object or (for backward-compat call sites
// that only ever dealt with users) a bare username string.
function entryKey(e) {
  if (!e) return null;
  if (typeof e === 'string') return 'user:' + e.toLowerCase();
  if (e.type === 'room') return 'room:' + String(e.roomId || '').toLowerCase();
  return 'user:' + String(e.username || '').toLowerCase();
}

function readHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(e => e && (e.username || (e.type === 'room' && e.roomId))) : [];
  } catch {
    return [];
  }
}

function writeHistory(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function useSearchHistory() {
  const [history, setHistory] = useState(readHistory);

  // Call when the user actually opens a result from search (not on every
  // keystroke) — same "recently visited" semantics as a browser's own
  // address-bar history. Re-opening something already in the list bumps it
  // back to the top instead of creating a second entry.
  const addToHistory = useCallback((entry) => {
    if (!entry) return;
    const isRoom = entry.type === 'room';
    if (isRoom ? !entry.roomId : !entry.username) return;
    const key = entryKey(entry);
    setHistory(prev => {
      const filtered = prev.filter(e => entryKey(e) !== key);
      const normalized = isRoom
        ? { type: 'room', roomId: entry.roomId, roomName: entry.roomName || entry.roomId, thumbnailPath: entry.thumbnailPath || null }
        : { username: entry.username, displayName: entry.displayName || null, avatarPath: entry.avatarPath || null };
      const next = [normalized, ...filtered].slice(0, MAX_ENTRIES);
      writeHistory(next);
      return next;
    });
  }, []);

  // Accepts either a full entry (preferred — needed to tell a room and a
  // user with the same id apart) or a bare username string (older callers).
  const removeFromHistory = useCallback((entryOrUsername) => {
    const key = entryKey(entryOrUsername);
    setHistory(prev => {
      const next = prev.filter(e => entryKey(e) !== key);
      writeHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    writeHistory([]);
    setHistory([]);
  }, []);

  // A room's thumbnail here is a snapshot taken the moment it was added to
  // history (see addToHistory above) and otherwise never refreshed — it sat
  // stale in localStorage indefinitely, not just until the next app open,
  // since nothing ever re-adds an existing entry outside of visiting it
  // again. GlobalChatWidget rebroadcasts the server's room_thumbnail_updated
  // socket event as this window event; patch any matching entry in place.
  useEffect(() => {
    const onThumbnailUpdated = (e) => {
      const { roomId, thumbnailPath } = e.detail || {};
      if (!roomId) return;
      setHistory(prev => {
        let changed = false;
        const next = prev.map(entry => {
          if (entry.type === 'room' && (entry.roomId || '').toLowerCase() === roomId.toLowerCase() && entry.thumbnailPath !== thumbnailPath) {
            changed = true;
            return { ...entry, thumbnailPath };
          }
          return entry;
        });
        if (changed) writeHistory(next);
        return changed ? next : prev;
      });
    };
    window.addEventListener('room_thumbnail_updated', onThumbnailUpdated);
    return () => window.removeEventListener('room_thumbnail_updated', onThumbnailUpdated);
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
