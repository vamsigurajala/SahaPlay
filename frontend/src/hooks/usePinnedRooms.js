import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API } from '../lib/api';

// Shared pinned-rooms data logic — previously duplicated almost verbatim
// between Home.jsx's inline preview section and the standalone PinnedRooms
// page. `limit` caps how many stored IDs are actually fetched from the
// server (Home.jsx's preview only ever needs 6; the full page needs all of
// them), matching each call site's original behavior exactly.
export function usePinnedRooms({ limit } = {}) {
  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const [pinnedRooms, setPinnedRooms] = useState([]);
  // True only while an actual fetch for previously-pinned room IDs is in
  // flight — stays false when there's nothing stored to fetch, so callers
  // can tell "still loading" apart from "genuinely no pinned rooms" instead
  // of both looking identical (an empty pinnedRooms array either way).
  const [isLoading, setIsLoading] = useState(false);

  // Unlike PublicRooms (4s poll) and useFollowRequests (3s poll), this had no
  // self-healing retry — a single failed/empty attempt (e.g. racing a Render
  // free-tier cold start after the app sat backgrounded for a while) left
  // pinnedRooms stuck empty until something else happened to trigger a focus
  // event. One retry after a short delay covers that race the same way the
  // 401 grace-window retry in main.jsx already does for auth.
  const fetchRooms = useCallback((isRetry) => {
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      if (stored.length > 0) {
        if (!isRetry) setIsLoading(true);
        const ids = limit ? stored.slice(0, limit) : stored;
        fetch(`${API}/api/rooms/info?ids=${ids.join(',')}`)
          .then(r => { if (!r.ok) throw new Error('bad response'); return r.json(); })
          .then(data => {
            if (Array.isArray(data)) setPinnedRooms(data); else setPinnedRooms([]);
            setIsLoading(false);
          })
          .catch(() => {
            if (isRetry !== true) setTimeout(() => fetchRooms(true), 4000);
            else setIsLoading(false);
          });
      } else {
        setPinnedRooms([]);
        setIsLoading(false);
      }
    } catch (e) { setIsLoading(false); }
  }, [limit]);

  useEffect(() => {
    fetchRooms();
    window.addEventListener('focus', fetchRooms);
    return () => window.removeEventListener('focus', fetchRooms);
  }, [fetchRooms]);

  useEffect(() => {
    if (isGuest || !token || token === 'null' || token === 'undefined') return;
    fetch(`${API}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.pinnedRooms) {
          try {
            const arr = JSON.parse(data.pinnedRooms);
            localStorage.setItem('pinned_rooms', JSON.stringify(arr));
            fetchRooms();
          } catch (e) { }
        }
      })
      .catch(() => { });
  }, [token, isGuest, fetchRooms]);

  const unpinRoom = useCallback(async (e, id) => {
    e.stopPropagation();
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      const updated = stored.filter(r => r !== id);
      localStorage.setItem('pinned_rooms', JSON.stringify(updated));
      if (token && !isGuest) {
        await fetch(`${API}/api/profile/pinned-rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pinnedRooms: updated }),
        });
      }
      toast.success('Room unpinned');
      fetchRooms();
    } catch (err) { }
  }, [token, isGuest, fetchRooms]);

  return { pinnedRooms, unpinRoom, fetchRooms, isLoading };
}
