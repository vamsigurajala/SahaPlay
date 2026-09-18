import { useState, useCallback, useEffect } from 'react';
import { isCapacitorApp } from '../lib/platform';

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

// Plain localStorage on web/desktop, where it's already proven reliable.
// On the Android app specifically, real-device testing turned up entries
// silently failing to persist across app relaunches — the WebView's own
// localStorage isn't guaranteed to be flushed to disk before this device's
// aggressive OEM background-kill behavior tears the process down (the same
// class of real-device restriction already documented for calls/push
// elsewhere in this app). Capacitor's Preferences plugin writes straight to
// Android's SharedPreferences instead, synced to disk independent of the
// WebView's own storage lifecycle.
//
// Accessed off the raw window.Capacitor.Plugins proxy, never a static/
// dynamic `import` of an `@capacitor/*` package — same reason every native
// bridge in nativeDownload.js/nativePush.js does this: those packages are
// only ever installed transiently inside the CI Android build job (see
// android-capacitor-build.yml), never a real frontend dependency, so a real
// import would fail to resolve when THIS repo's own web bundle builds.
const preferencesPlugin = () => (isCapacitorApp() ? window.Capacitor?.Plugins?.Preferences : null);

// Temporary diagnostic logging (kept loud — console.warn/error, not .log —
// so it survives logcat's default filtering) added after a real on-device
// test of the Preferences-based rewrite below STILL showed history not
// surviving an app relaunch on Android. Silently swallowing every failure
// here (the plain `catch {}` this used to be) meant there was no way to
// tell "the plugin isn't there at all" apart from "it's there but every
// call throws" apart from "it works but something else is wrong" — all
// three look identical from the UI. Remove once the real cause is found.
function logSearchHistoryIssue(where, detail) {
  try { console.warn('[search-history-debug]', where, detail); } catch {}
}

async function readHistory() {
  try {
    const prefs = preferencesPlugin();
    if (isCapacitorApp() && !prefs) {
      logSearchHistoryIssue('read', 'Capacitor app but window.Capacitor.Plugins.Preferences is missing — plugin not linked into this build');
    }
    const raw = prefs ? (await prefs.get({ key: KEY })).value : localStorage.getItem(KEY);
    logSearchHistoryIssue('read-raw', { usedPreferences: !!prefs, rawLength: raw ? raw.length : 0 });
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(e => e && (e.username || (e.type === 'room' && e.roomId))) : [];
  } catch (e) {
    logSearchHistoryIssue('read-error', e && (e.message || String(e)));
    return [];
  }
}

async function writeHistory(list) {
  try {
    const json = JSON.stringify(list);
    const prefs = preferencesPlugin();
    if (isCapacitorApp() && !prefs) {
      logSearchHistoryIssue('write', 'Capacitor app but window.Capacitor.Plugins.Preferences is missing — plugin not linked into this build');
    }
    if (prefs) {
      await prefs.set({ key: KEY, value: json });
      logSearchHistoryIssue('write-ok', { usedPreferences: true, entries: list.length });
    } else {
      localStorage.setItem(KEY, json);
      logSearchHistoryIssue('write-ok', { usedPreferences: false, entries: list.length });
    }
  } catch (e) {
    logSearchHistoryIssue('write-error', e && (e.message || String(e)));
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState([]);

  // Loaded async now (Preferences.get is a Promise even on native) — starts
  // empty and fills in a tick later on every platform, including web/desktop,
  // rather than keeping a separate sync path just for localStorage.
  useEffect(() => { readHistory().then(setHistory); }, []);

  // Call when the user actually opens a result from search (not on every
  // keystroke) — same "recently visited" semantics as a browser's own
  // address-bar history. Re-opening something already in the list bumps it
  // back to the top instead of creating a second entry.
  //
  // Reads the CURRENT persisted list fresh instead of merging against this
  // component instance's own `history` state (previously via setHistory's
  // updater form) — this hook is called independently from four different
  // places (Navbar, Profile, AppSettings, SearchTabContent), each with its
  // OWN local `history` copy seeded by its OWN mount-time readHistory()
  // call. Two real races came from trusting that local copy: (1) tapping a
  // result fast enough that THIS instance's own initial readHistory()
  // promise hadn't resolved yet left its `history` still `[]`, so the write
  // below replaced the entire real list with just the one new entry; (2) an
  // instance that mounted earlier and never re-synced could write back its
  // own stale snapshot over entries a DIFFERENT, more-recently-active
  // instance had already saved. Both showed as "sometimes it saves,
  // sometimes it doesn't" depending purely on timing. Reading fresh here
  // makes every mutation atomic against the actual backing store.
  const addToHistory = useCallback(async (entry) => {
    if (!entry) return;
    const isRoom = entry.type === 'room';
    if (isRoom ? !entry.roomId : !entry.username) return;
    const key = entryKey(entry);
    const current = await readHistory();
    const filtered = current.filter(e => entryKey(e) !== key);
    const normalized = isRoom
      ? { type: 'room', roomId: entry.roomId, roomName: entry.roomName || entry.roomId, thumbnailPath: entry.thumbnailPath || null }
      : { username: entry.username, displayName: entry.displayName || null, avatarPath: entry.avatarPath || null };
    const next = [normalized, ...filtered].slice(0, MAX_ENTRIES);
    await writeHistory(next);
    setHistory(next);
  }, []);

  // Accepts either a full entry (preferred — needed to tell a room and a
  // user with the same id apart) or a bare username string (older callers).
  // Same fresh-read-before-write reasoning as addToHistory above.
  const removeFromHistory = useCallback(async (entryOrUsername) => {
    const key = entryKey(entryOrUsername);
    const current = await readHistory();
    const next = current.filter(e => entryKey(e) !== key);
    await writeHistory(next);
    setHistory(next);
  }, []);

  const clearHistory = useCallback(async () => {
    await writeHistory([]);
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
