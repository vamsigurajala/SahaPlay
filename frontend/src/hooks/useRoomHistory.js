import { useState, useEffect, useCallback } from 'react';
import { API } from '../lib/api';

// Rooms the current user has created, most-recent-first — the durable
// fallback for a room that's neither pinned nor has ever had a message sent
// in it (the only two other ways a room stays reachable from Home/PublicRooms
// afterward). Unlike usePinnedRooms, there's no localStorage list of IDs to
// hydrate from first: room_names.hostUsername on the server is the only
// source of truth, so this is a plain authenticated fetch.
export function useRoomHistory() {
  const [roomHistory, setRoomHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    fetch(`${API}/api/rooms/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(data => setRoomHistory(Array.isArray(data) ? data : []))
      .catch(() => setRoomHistory([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchHistory();
    window.addEventListener('focus', fetchHistory);
    return () => window.removeEventListener('focus', fetchHistory);
  }, [fetchHistory]);

  return { roomHistory, isLoading, fetchHistory };
}
