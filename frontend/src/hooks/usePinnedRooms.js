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
        // Bounded wait — without this, a request that never settles at all
        // (a genuine network hang, as opposed to a fast failure) left the
        // skeleton grid up indefinitely: nothing here was actually broken,
        // there was just no ceiling on how long "still loading" could mean.
        // Aborting after 12s routes it into the exact same retry-once path
        // a fast failure already takes.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        fetch(`${API}/api/rooms/info?ids=${ids.join(',')}`, { signal: controller.signal })
          .then(r => { if (!r.ok) throw new Error('bad response'); return r.json(); })
          .then(data => {
            if (Array.isArray(data)) setPinnedRooms(data); else setPinnedRooms([]);
            setIsLoading(false);
          })
          .catch(() => {
            if (isRetry !== true) setTimeout(() => fetchRooms(true), 4000);
            else setIsLoading(false);
          })
          .finally(() => clearTimeout(timeoutId));
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

  // Deleting a room (as its host, or an admin) doesn't otherwise touch this
  // hook — if the deleted room happened to be pinned, it stayed listed here
  // (and in the 'pinned_rooms' localStorage id list) until something else
  // triggered a refetch. Same window event useRoomHistory.js listens for —
  // see GlobalChatWidget's admin_room_deleted/room_permanently_deleted
  // handlers for where it's dispatched from.
  useEffect(() => {
    const onRoomDeleted = (e) => {
      const deletedId = e.detail?.roomId;
      if (!deletedId) return;
      setPinnedRooms(prev => prev.filter(r => r.id !== deletedId));
      try {
        const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
        localStorage.setItem('pinned_rooms', JSON.stringify(stored.filter(r => r !== deletedId)));
      } catch {}
    };
    window.addEventListener('room_deleted', onRoomDeleted);
    return () => window.removeEventListener('room_deleted', onRoomDeleted);
  }, []);

  // GlobalChatWidget rebroadcasts the server's (now global, not room-scoped)
  // room_thumbnail_updated socket event as this plain window event — this
  // hook has no socket of its own and previously only ever refetched on
  // mount/focus, so a thumbnail changed while this grid was already on
  // screen stayed stale until the app was backgrounded and reopened.
  useEffect(() => {
    const onThumbnailUpdated = (e) => {
      const { roomId, thumbnailPath } = e.detail || {};
      if (!roomId) return;
      setPinnedRooms(prev => prev.map(r => (r.id || '').toLowerCase() === roomId.toLowerCase() ? { ...r, thumbnailPath } : r));
    };
    window.addEventListener('room_thumbnail_updated', onThumbnailUpdated);
    return () => window.removeEventListener('room_thumbnail_updated', onThumbnailUpdated);
  }, []);

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

  // Symmetric to unpinRoom, for pinning a room from somewhere OTHER than this
  // hook's own list — e.g. Room History (rooms you've created, whether or not
  // they're pinned yet), where tapping the same pin icon should add rather
  // than remove. Prepends rather than appends so a newly-pinned room shows up
  // first, matching how a fresh pin reads everywhere else pin order is
  // user-visible.
  const pinRoom = useCallback(async (e, id) => {
    e.stopPropagation();
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      if (stored.includes(id)) return;
      const updated = [id, ...stored];
      localStorage.setItem('pinned_rooms', JSON.stringify(updated));
      if (token && !isGuest) {
        await fetch(`${API}/api/profile/pinned-rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pinnedRooms: updated }),
        });
      }
      toast.success('Room pinned');
      fetchRooms();
    } catch (err) { }
  }, [token, isGuest, fetchRooms]);

  return { pinnedRooms, unpinRoom, pinRoom, fetchRooms, isLoading };
}
