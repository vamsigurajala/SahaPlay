import { useState, useCallback } from 'react';

// Backs "recently searched users" on every user-search surface in the app —
// Navbar's search dropdown (desktop and its own mobile-width block),
// Profile.jsx's and AppSettings.jsx's own copies of that same dropdown, and
// the mobile/tablet full-screen Search tab (SearchTabContent.jsx via
// BottomNav). One shared localStorage list so searching from any of them
// builds (and clears) the same history everywhere, instead of five
// independent ones that all show something different.
const KEY = 'sp_user_search_history';
const MAX_ENTRIES = 10;

function readHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(e => e && e.username) : [];
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
  // address-bar history. Re-searching someone already in the list bumps
  // them back to the top instead of creating a second entry.
  const addToHistory = useCallback((user) => {
    if (!user || !user.username) return;
    setHistory(prev => {
      const filtered = prev.filter(e => e.username.toLowerCase() !== user.username.toLowerCase());
      const next = [
        { username: user.username, displayName: user.displayName || null, avatarPath: user.avatarPath || null },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
      writeHistory(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((username) => {
    setHistory(prev => {
      const next = prev.filter(e => e.username.toLowerCase() !== username.toLowerCase());
      writeHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    writeHistory([]);
    setHistory([]);
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
