import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../lib/api';

// Rooms the current user has created, most-recent-first — the durable
// fallback for a room that's neither pinned nor has ever had a message sent
// in it (the only two other ways a room stays reachable from Home/PublicRooms
// afterward). Unlike usePinnedRooms, there's no localStorage list of IDs to
// hydrate from first: room_names.hostUsername on the server is the only
// source of truth, so this is a plain authenticated fetch.
// Last fetched history, kept per user so the list paints instantly next visit
// (then refreshes quietly) rather than starting empty behind a skeleton.
const historyCacheKey = () => `room_history_cache_${(localStorage.getItem('watch_username') || '').toLowerCase()}`;
function readHistoryCache() {
  try {
    if (!localStorage.getItem('watch_token') || localStorage.getItem('watch_is_guest') === 'true') return [];
    const cached = JSON.parse(localStorage.getItem(historyCacheKey()) || '[]');
    return Array.isArray(cached) ? cached : [];
  } catch { return []; }
}

export function useRoomHistory() {
  const [roomHistory, setRoomHistory] = useState(readHistoryCache);
  const [isLoading, setIsLoading] = useState(false);
  // Latest list, readable inside fetchHistory without making it re-create.
  const roomHistoryRef = useRef(roomHistory);
  useEffect(() => { roomHistoryRef.current = roomHistory; }, [roomHistory]);

  const fetchHistory = useCallback(() => {
    const token = localStorage.getItem('watch_token');
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    // Guests never host a persisted room record, and there's no token to
    // authenticate the request with anyway — same gate Home.jsx already
    // uses to hide the Pinned Rooms section for guests.
    if (isGuest || !token || token === 'null' || token === 'undefined') {
      setRoomHistory([]);
      return;
    }
    // Only show the loading skeleton when there is nothing to show yet — a
    // background refresh (app resume, tab focus) must not blank the list.
    if (roomHistoryRef.current.length === 0) setIsLoading(true);
    fetch(`${API}/api/rooms/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setRoomHistory(list);
        try { localStorage.setItem(historyCacheKey(), JSON.stringify(list)); } catch { /* storage full/blocked: cache is optional */ }
      })
      // A failed refresh (offline blip, server waking up) keeps what is already
      // on screen instead of wiping the list.
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
    window.addEventListener('focus', fetchHistory);
    return () => window.removeEventListener('focus', fetchHistory);
  }, [fetchHistory]);

  // Deleting a room (as its host, or an admin) doesn't otherwise touch this
  // hook at all — it only ever refetches on mount/focus, so a room deleted
  // while already sitting on Home kept showing here until something else
  // happened to trigger a refetch. GlobalChatWidget rebroadcasts the
  // server's delete confirmation as this plain window event (it's the one
  // thing already guaranteed to receive it regardless of which page is
  // open); pruning it here immediately is simpler and faster than waiting
  // on a full refetch.
  useEffect(() => {
    const onRoomDeleted = (e) => {
      const deletedId = (e.detail?.roomId || '').toLowerCase();
      if (!deletedId) return;
      setRoomHistory(prev => prev.filter(r => (r.id || '').toLowerCase() !== deletedId));
    };
    window.addEventListener('room_deleted', onRoomDeleted);
    return () => window.removeEventListener('room_deleted', onRoomDeleted);
  }, []);

  // Same reasoning as the room_deleted listener just above — see
  // usePinnedRooms.js's identical handler for the full explanation of why
  // this hook needs it at all (no socket of its own, only refetches on
  // mount/focus).
  useEffect(() => {
    const onThumbnailUpdated = (e) => {
      const { roomId, thumbnailPath } = e.detail || {};
      if (!roomId) return;
      setRoomHistory(prev => prev.map(r => (r.id || '').toLowerCase() === roomId.toLowerCase() ? { ...r, thumbnailPath } : r));
    };
    window.addEventListener('room_thumbnail_updated', onThumbnailUpdated);
    return () => window.removeEventListener('room_thumbnail_updated', onThumbnailUpdated);
  }, []);

  return { roomHistory, isLoading, fetchHistory };
}
