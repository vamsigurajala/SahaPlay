import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API } from '../lib/api';

// Shared follow-requests data logic — previously only living in Navbar.jsx,
// now also needed by the standalone-PWA bottom nav's Notifications tab.
export function useFollowRequests() {
  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const [followRequests, setFollowRequests] = useState([]);

  useEffect(() => {
    if (isGuest || !token) return;
    const fetchRequests = () => {
      fetch(`${API}/api/follow/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setFollowRequests(data); })
        .catch(() => {});
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, 3000);
    window.addEventListener('focus', fetchRequests);
    window.addEventListener('follow_status_updated', fetchRequests);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchRequests);
      window.removeEventListener('follow_status_updated', fetchRequests);
    };
  }, [token, isGuest]);

  const allowRequest = useCallback(async (requestingUser, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}/accept`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) {
        toast.success(`Accepted ${requestingUser}'s follow request`);
        setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, status: 'accepted' } : u));
        // Unlike followBack below, this never told anyone else the follow
        // graph changed — Profile.jsx listens for this exact event to
        // refetch otherProfile, which is why accepting someone's request
        // left their profile page's Follow/Message buttons stuck showing
        // the pre-accept state until a manual refresh.
        window.dispatchEvent(new Event('follow_status_updated'));
      }
    } catch {}
  }, [token]);

  const followBack = useCallback(async (requestingUser, e) => {
    e.stopPropagation();
    setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: 'pending' } : u));
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
      } else {
        toast.success(`Follow request sent to ${requestingUser}!`);
        window.dispatchEvent(new Event('follow_status_updated'));
      }
    } catch {
      setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
    }
  }, [token]);

  return { followRequests, allowRequest, followBack };
}
