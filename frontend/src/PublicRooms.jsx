import React, { useState, useEffect, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Search, MessageSquare, ArrowLeft, User, Settings, Filter, LogOut, Pin, Star, Hash, Users, HelpCircle, Bell, Lock } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import GlobalChatWidget from './components/GlobalChatWidget';

const API = `http://${window.location.hostname}:3001`;


const catMap = {
  movies: '🎬 Movies',
  anime: '⛩️ Anime',
  songs: '🎵 Music',
  gaming: '🎮 Gaming',
  sports: '⚽ Sports',
  other: '✨ Other'
};

const PublicRooms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [publicRooms, setPublicRooms] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [profile, setProfile] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });
  const navIconsRef = React.useRef(null);
  const chatWidgetRef = React.useRef(null);

  const token = localStorage.getItem('watch_token');

  useEffect(() => {
    toast.remove(); // Fully purge all toasts from the global store (prevents replay by this page's Toaster)
    const handleClickOutside = (e) => {
      if (chatWidgetRef.current && chatWidgetRef.current.contains(e.target)) return;
      if (navIconsRef.current && !navIconsRef.current.contains(e.target)) {
        setShowSearch(false);
        setShowRecentChats(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Unread message tracking ──
  useEffect(() => {
    if (!token) return;
    const getLastSeen = () => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } };
    const checkUnread = async () => {
      try {
        const lastSeen = getLastSeen();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        const counts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = chat.id || chat.partner;
          if (chat.unread && chat.unread > 0) {
            counts[chatKey] = chat.unread;
            total += chat.unread;
            localCounts[chatKey] = chat.unread;
          } else {
            delete localCounts[chatKey];
          }
        });
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
        setUnreadCounts(counts);
        setTotalUnread(total);
      } catch {}
    };
    checkUnread();
    const inv = setInterval(checkUnread, 5000);
    return () => clearInterval(inv);
  }, [token]);

  const handleNewMessage = useCallback((partner, msg) => {
    const chatKey = partner;
    
    // Check if muted
    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}
    
    if (isMuted) return;

    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, []);

  const handleMarkRead = useCallback((chatId) => {
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    lastSeen[chatId] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    delete localCounts[chatId];
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setTotalUnread(prev => Math.max(0, prev - (unreadCounts[chatId] || 1)));
  }, [unreadCounts]);


  useEffect(() => {
    const fetchRequests = () => {
      if (token) {
        fetch(`${API}/api/follow/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json()).then(d => { if(Array.isArray(d)) setFollowRequests(d); }).catch(() => {});
      }
    };
    fetchRequests();
    const inv = setInterval(fetchRequests, 3000);
    window.addEventListener('follow_status_updated', fetchRequests);
    return () => {
      clearInterval(inv);
      window.removeEventListener('follow_status_updated', fetchRequests);
    };
  }, [token]);

  const handleAllowRequest = async (requestingUser, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}/accept`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) {
         toast.success(`Accepted ${requestingUser}'s follow request`);
         setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, status: 'accepted' } : u));
      }
    } catch {}
  };

  const handleFollowBack = async (requestingUser, e) => {
    e.stopPropagation();
    // Optimistically update UI immediately so button changes to "Request Sent"
    setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: 'pending' } : u));
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        // Revert optimistic update on error
        setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
      } else {
        toast.success(`Follow request sent to ${requestingUser}!`);
        window.dispatchEvent(new Event('follow_status_updated'));
      }
    } catch {
      // Revert on network error
      setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
    }
  };



  const handleLogout = () => {
    clearUserSession();
    navigate('/login');
  };

  const loggedInUsername = localStorage.getItem('watch_username');

  useEffect(() => {
    const fetchRooms = () => {
      fetch(`${API}/api/rooms/public`)
        .then(r => r.json())
        .then(data => { if(Array.isArray(data)) setPublicRooms(data); })
        .catch(err => console.error('Failed to load public rooms', err));
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 4000);

    if (token) {
      fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setProfile(data))
        .catch(() => {});
    }

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/users/search?q=${searchQuery}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setSearchResults(d); }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, token]);

  useEffect(() => {
    if (showRecentChats) {
      fetch(`${API}/api/chats/recent`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setRecentChats(d); }).catch(() => {});
    }
  }, [showRecentChats, token]);

  const handleMakePrivate = async (e, roomId) => {
    e.stopPropagation();
    if (!loggedInUsername) return;
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/api/rooms/make-private`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, username: loggedInUsername })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('roomMadePrivate', 'Room is now private!'));
        setPublicRooms(prev => prev.filter(r => r.id !== roomId));
      } else {
        toast.error(data.error || 'Failed to change status');
      }
    } catch (err) {
      toast.error('Connection error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <Toaster position="top-center" />
      <style>{`
        .pinned-card {
          border-radius: 16px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
          background: #12121a;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pinned-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.5);
          border-color: rgba(99,102,241,0.5);
        }
        .img-layer {
          height: 130px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #1e1e2e 0%, #111119 100%);
        }
        html[data-theme='light'] .img-layer {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
        }
        .pinned-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease, opacity 0.4s ease;
          opacity: 0;
        }
        .pinned-img.loaded {
          opacity: 1;
        }
        .pinned-card:hover .pinned-img {
          transform: scale(1.08);
        }
        .cat-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          z-index: 10;
        }
        .footer-layer {
          background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12));
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .join-btn {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: none;
          color: #fff;
          padding: 5px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .nav-icon-btn { position: relative; width: 38px; height: 38px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .nav-icon-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
        .nav-icon-btn.active { background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.4); color: #818cf8; }
        
        .cat-tab {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a0aab2;
          padding: 8px 16px;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .cat-tab:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .cat-tab.active { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #a5b4fc; }
        
        html[data-theme='light'] .cat-tab { background: #fff; border-color: rgba(0,0,0,0.08); color: #64748b; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        html[data-theme='light'] .cat-tab:hover { background: #f8fafc; color: #1e293b; border-color: rgba(0,0,0,0.15); }
        html[data-theme='light'] .cat-tab.active { background: #6366f1; border-color: #6366f1; color: #fff; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }

        .pinned-card:hover .join-btn {
          transform: translateY(-2px);
        }
        .back-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #ccc;
          padding: 8px 16px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
          transform: translateX(-4px);
        }
        .private-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }
        .private-btn:hover {
          background: #000000;
          color: #fff;
          border-color: rgba(239,68,68,0.7);
          box-shadow: 0 0 16px rgba(239,68,68,0.35);
          transform: scale(1.1);
        }
        .private-btn .lock-icon {
          transition: fill 0.3s ease;
          fill: none;
        }
         .private-btn:hover .lock-icon {
          fill: #ffffff;
        }

        /* ── Light Mode Overrides ── */
        html[data-theme='light'] body { background: #f7fafc !important; color: #111 !important; }
        html[data-theme='light'] nav { background: #fff !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
        
        html[data-theme='light'] .section-heading { color: #000 !important; }
        html[data-theme='light'] .section-desc { color: #4a5568 !important; }

        html[data-theme='light'] .cat-badge { background: #fff; color: #111; border-color: rgba(0,0,0,0.1); }
        
        html[data-theme='light'] .private-btn {
          background: #fff !important;
          border-color: rgba(0,0,0,0.1) !important;
          color: #111 !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        html[data-theme='light'] .private-btn:hover {
          border-color: #ef4444 !important;
          color: #ef4444 !important;
        }
        html[data-theme='light'] .nav-icon-btn.active { color: #6366f1 !important; background: rgba(99,102,241,0.1) !important; }
        
        html[data-theme='light'] .pinned-card { background: #ffffff; border-color: rgba(0,0,0,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        html[data-theme='light'] .pinned-card:hover { box-shadow: 0 12px 30px rgba(0,0,0,0.12); border-color: rgba(99,102,241,0.3); }
        html[data-theme='light'] .footer-layer { background: #fff !important; border-top: 1px solid rgba(0,0,0,0.04) !important; }
        html[data-theme='light'] .join-btn { background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #fff !important; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25); }
        html[data-theme='light'] .join-btn:hover { background: linear-gradient(135deg, #7c3aed, #c026d3); box-shadow: 0 6px 15px rgba(139, 92, 246, 0.4); }
        html[data-theme='light'] .pinned-card h3 { color: #000 !important; }
        html[data-theme='light'] .profile-pill { background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.08) !important; color: #111 !important; }

      `}</style>

      {/* Navbar */}
      <nav style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        {/* Left: Logo */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)', cursor: 'default' }}>
            <Play fill="#fff" size={16} style={{ marginLeft: 2 }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff', cursor: 'default' }} className="section-heading">WatchTogether</h1>
        </div>

        {/* Center: Nav Links */}
        <div className="nav-links-desktop" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/')}>Home</button>
          <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/public')}>Explore</button>
          <button className="nav-link-btn" style={{ padding: '8px 16px' }} onClick={() => navigate('/')}>How it Works</button>
          <button className="nav-link-btn" style={{ padding: '8px 16px' }} onClick={() => navigate('/')}>Features</button>
          <button className="nav-link-btn" style={{ padding: '8px 16px' }} onClick={() => toast.success('Help center coming soon!')}>Support</button>
        </div>

        {/* Right: Actions */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>

        {loggedInUsername && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Global Search and Chat Icons */}
            <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
              <div style={{ position: 'relative' }}>
                <button 
                  title="Search"
                  onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
                  className={`nav-icon-btn${showSearch ? ' active' : ''}`}
                >
                  <Search size={18} />
                </button>
                {showSearch && (
                  <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -60, width: 320, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                    <input 
                      autoFocus
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 8 }}
                    />
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {searchResults.length > 0 ? (
                        searchResults.map(u => (
                          <div key={u.username} onClick={() => { setShowSearch(false); navigate(`/profile/${u.username}`); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                               onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                               onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {u.avatarPath ? <img src={`${API}${u.avatarPath}`} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                              <div style={{ color: '#6b7280', fontSize: 11 }}>@{u.username}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        searchQuery ? <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 12 }}>No users found</div> : null
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <button 
                  title="Chats"
                  onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }}
                  className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
                >
                  <MessageSquare size={18} />
                  {totalUnread > 0 && (
                    <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </div>
                  )}
                </button>
              </div>

              {/* Notifications / Follow Requests */}
              <div style={{ position: 'relative' }}>
                <button title="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); setShowRecentChats(false); setShowUserMenu(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
                  <Bell size={18} />
                  {followRequests.filter(r => r.status === 'pending').length > 0 && (
                    <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {followRequests.filter(r => r.status === 'pending').length}
                    </div>
                  )}
                </button>
                {showNotifications && (
                  <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -20, width: 340, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 6px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {followRequests.length > 0 ? (
                        followRequests.map(u => (
                          <div key={u.username} onClick={() => { setShowNotifications(false); navigate(`/profile/${u.username}`); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? 'rgba(99,102,241,0.05)' : 'transparent'}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                              {u.avatarPath ? <img src={`${API}${u.avatarPath}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} color="#888" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          
                              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                                {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                              </div>
                          
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {u.status === 'pending' ? (
                                  <button onClick={(e) => handleAllowRequest(u.username, e)} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.15)', border: 'none', color: '#818cf8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                                ) : (
                                  <button disabled style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                                )}
                                
                                {u.myFollowStatus === 'accepted' ? (
                                  <button disabled style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                                ) : (
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    if (u.myFollowStatus === 'pending') return;
                                    handleFollowBack(u.username, e);
                                  }} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: u.myFollowStatus === 'pending' ? '#6b7280' : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                    {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div
                onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
                className="profile-pill"
                style={{ 
                  padding: '4px 12px 4px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: 24, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.2s', color: '#fff' 
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {profile?.avatarPath ? (
                    <img src={`${API}${profile.avatarPath}`} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={16} style={{ color: '#6366f1' }} />
                  )}
                </div>
                <span style={{ fontWeight: 600 }}>{loggedInUsername}</span>
              </div>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                  <div className="nav-dropdown" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={16} color="#6366f1" />
                      </div>
                      {t('account', 'Account')}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/app-settings'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Settings size={16} color="#10b981" />
                      </div>
                      {t('app', 'App')}
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); toast.success('Support email: help@watchtogether.app'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HelpCircle size={16} color="#f59e0b" />
                      </div>
                      {t('contactSupport', 'Contact Support')}
                    </button>
                    <div className="profile-divider" />
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LogOut size={16} color="#f87171" />
                      </div>
                      {t('logOut', 'Log Out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </nav>

      <section style={{ width: '100%', padding: '40px 0 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>
          <h2 className="section-heading" style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>{t('joinPublicRooms', 'Public Rooms')}</h2>
          <p className="section-desc" style={{ color: '#a0aab2', fontSize: '16px', marginBottom: '30px' }}>{t('explorePublic', 'Discover and join public watch parties around the world.')}</p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '40px', overflowX: 'auto', paddingBottom: '10px' }}>
          {Object.entries(catMap).map(([id, label]) => (
            <button
              key={id}
              className={`cat-tab ${selectedCategory === id ? 'active' : ''}`}
              onClick={() => { setSelectedCategory(id); setCurrentPage(1); }}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {(() => {
          const filteredRooms = publicRooms.filter(room => (room.category || 'other') === selectedCategory);
          return filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '18px' }}>No Public Rooms Available</h3>
            <p style={{ color: '#888', margin: 0 }}>No rooms match the "{catMap[selectedCategory]}" category. Try selecting another or create your own!</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
              {filteredRooms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(room => (
                <div key={room.id} className="pinned-card" onClick={() => navigate(`/room/${room.id}`)}>
                  <div className="img-layer">
                    <img 
                      src={room.thumbnailPath ? `${API}${room.thumbnailPath}` : `https://picsum.photos/seed/${room.id}/600/400`} 
                      alt="Room Cover" 
                      className="pinned-img"
                      onLoad={(e) => e.target.classList.add('loaded')}
                    />
                    <div className="cat-badge">{catMap[room.category] || '✨ Other'}</div>
                    {loggedInUsername && room.hostUsername && (String(loggedInUsername).toLowerCase() === String(room.hostUsername).toLowerCase()) && (
                      <button className="private-btn" onClick={(e) => handleMakePrivate(e, room.id)} title={t('makePrivate', 'Make Private')}>
                        <Lock className="lock-icon" size={16} />
                      </button>
                    )}
                  </div>
                  <div className="footer-layer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#a0aab2', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, letterSpacing: '0.5px' }}>
                        <Hash size={10}/> {room.id}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: '8px', color: '#10b981', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Users size={12} /> {room.userCount}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>{room.name}</h3>
                      <button className="join-btn">{t('join', 'Join')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {filteredRooms.length > itemsPerPage && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                {Array.from({ length: Math.ceil(filteredRooms.length / itemsPerPage) }).map((_, idx) => (
                  <button key={idx} onClick={() => setCurrentPage(idx + 1)} style={{
                    background: currentPage === idx + 1 ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.05)',
                    border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
                    transition: 'transform 0.2s', boxShadow: currentPage === idx + 1 ? '0 2px 10px rgba(168,85,247,0.3)' : 'none'
                  }}
                  onMouseEnter={e => { if (currentPage !== idx + 1) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { if (currentPage !== idx + 1) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}>
                    {idx + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        );
        })()}
        </div>
      </section>
      <GlobalChatWidget 
        ref={chatWidgetRef} 
        isOpen={showRecentChats} 
        onClose={() => setShowRecentChats(false)} 
        unreadCounts={unreadCounts} 
        onMarkRead={handleMarkRead} 
        onNewMessage={handleNewMessage} 
      />
    </div>
  );
};

export default PublicRooms;





