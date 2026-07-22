import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, LogOut, Settings, HelpCircle, Search, MessageSquare, Bell, AlertCircle, Play, Maximize, Minimize, ArrowLeft, X, Home, Compass, Sparkles, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import { clearUserSession } from '../lib/authUtils.js';
import GlobalChatWidget from './GlobalChatWidget';
import SupportModal from './SupportModal';
import DownloadAppModal from './DownloadAppModal';
import { getAvatarUrl } from '../utils/avatarUtils';
import { API } from '../lib/api';
import { useBackIntercept } from '../hooks/useBackIntercept';
import { getPersistedGcwOpen } from '../utils/gcwPersist';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const token = localStorage.getItem('watch_token');
  const rawUsername = localStorage.getItem('watch_username');
  const loggedInUsername = rawUsername && rawUsername.toLowerCase().startsWith('guest_')
    ? rawUsername.slice(6)
    : rawUsername;
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && localStorage.getItem('watch_is_guest') !== 'true';
  const [watchRole, setWatchRole] = useState(localStorage.getItem('watch_role') || 'user');
  const isAdminRole = ['super_admin', 'admin', 'moderator', 'support'].includes(watchRole);

  const [scrolled, setScrolled] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfilePageMobile, setShowProfilePageMobile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(getPersistedGcwOpen);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [profile, setProfile] = useState(() => {
    const isG = !token || token === 'null' || token === 'undefined' || localStorage.getItem('watch_is_guest') === 'true';
    if (isG) {
      return {
        id: 0,
        username: localStorage.getItem('watch_username') || 'guest',
        displayName: 'Guest User',
        avatarPath: null,
        isGuest: true
      };
    }
    return null;
  });

  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth < 1025);
  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth < 1025);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.role) {
          localStorage.setItem('watch_role', d.role);
          setWatchRole(d.role);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);


  // Reset profile subpage when mobile menu closes
  useEffect(() => {
    if (!showMobileMenu) {
      setShowProfilePageMobile(false);
    }
  }, [showMobileMenu]);

  // Lock/unlock body scroll when mobile drawer is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMobileMenu]);

  // Mobile/iPad swipe-back should close the mobile menu drawer instead of navigating away.
  const mobileMenuBack = useBackIntercept(showMobileMenu ? 1 : 0, (newLevel) => { if (newLevel === 0) setShowMobileMenu(false); });
  // Nav links close the drawer AND change route in the same click — tell the
  // hook to leave its history entry alone so it doesn't fight the router's
  // own navigation (see useBackIntercept's skipNextClose doc).
  const navigateAndCloseMenu = useCallback((path) => {
    mobileMenuBack.skipNextClose();
    navigate(path);
    setShowMobileMenu(false);
  }, [mobileMenuBack, navigate]);

  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });

  const navIconsRef = useRef(null);
  const chatWidgetRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (chatWidgetRef.current && chatWidgetRef.current.contains(e.target)) return;
      // Lightbox is portalled to document.body — don't treat those clicks as "outside"
      if (e.target.closest?.('.media-lightbox-overlay')) return;
      if (navIconsRef.current && !navIconsRef.current.contains(e.target)) {
        setShowSearch(false);
        setShowRecentChats(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
      if (!e.target.closest('.mobile-nav-dropdown') && !e.target.closest('.nav-hamburger-btn') && !e.target.closest('.mobile-drawer-panel') && !e.target.closest('.mobile-drawer-backdrop')) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Profile data fetch
  useEffect(() => {
    if (isGuest || !token) return;
    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProfile(data))
      .catch(() => {});
  }, [token, isGuest]);

  // Unread message tracking
  useEffect(() => {
    if (isGuest || !token) return;
    const getLastSeen = () => {
      try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; }
    };
    const checkUnread = async () => {
      try {
        const lastSeen = getLastSeen();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const serverCounts = {};
        let total = 0;
        data.forEach(chat => {
          // Always lowercase to avoid case-mismatch double-counting
          const chatKey = (chat.id || chat.partner || '').toLowerCase();
          if (chat.unread && chat.unread > 0) {
            serverCounts[chatKey] = chat.unread;
            total += chat.unread;
          }
        });
        // Server is strict source of truth — overwrite localStorage completely
        localStorage.setItem('chat_unread_counts', JSON.stringify(serverCounts));
        setUnreadCounts(serverCounts);
        setTotalUnread(total);
        // Sync GCW conversation list badges
        chatWidgetRef?.current?.syncUnreadFromServer?.(serverCounts);
      } catch {}
    };
    checkUnread();
    const interval = setInterval(checkUnread, 5000);
    window.addEventListener('focus', checkUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkUnread);
    };
  }, [token, isGuest]);

  // Handle follow requests
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

  // Search execution
  useEffect(() => {
    if (!debouncedSearchQuery) { setSearchResults([]); return; }
    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API}/api/users/search?q=${debouncedSearchQuery}`, { headers })
      .then(r => r.json())
      .then(d => { if(Array.isArray(d)) setSearchResults(d); else setSearchResults([]); })
      .catch(() => {});
  }, [debouncedSearchQuery, token, isGuest]);

  const handleNewMessage = useCallback((partner, msg) => {
    const chatKey = partner;
    if (chatWidgetRef.current?.isOpen && chatWidgetRef.current?.activeChat?.partner === partner) return;

    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}

    if (!isMuted) {
      try {
        const soundMutedGlobal = localStorage.getItem(`mute_notif_sounds_${myUsername}`) === 'true';
        if (!soundMutedGlobal) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(()=>{});
        }
      } catch(e){}
    }

    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    
    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, []);

  useEffect(() => {
    const handler = () => {
      const fsEl = document.fullscreenElement;
      setIsAppFullscreen(fsEl === document.documentElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleMarkRead = useCallback((chatId) => {
    const chatKey = (chatId || '').toLowerCase();
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    lastSeen[chatKey] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    
    setUnreadCounts(prev => {
      const next = { ...prev };
      const removed = next[chatId] || next[chatKey] || 0;
      if (removed > 0) setTotalUnread(t => Math.max(0, t - removed));
      delete next[chatId];
      delete next[chatKey];
      return next;
    });

    // Sync GCW badge for this chat immediately
    chatWidgetRef?.current?.markReadFor?.(chatKey);
    // Note: checkUnread polling (every 5s) will reconcile with server
  }, []);

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
  };

  const handleLogout = () => {
    clearUserSession();
    window.location.reload();
  };

  return (
    <>
      <style>{`
        .main-nav {
          position: sticky; top: 0; z-index: 1000;
          transition: background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .main-nav.scrolled {
          background: rgba(9,9,11,0.85) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-bottom-color: rgba(255,255,255,0.08) !important;
          box-shadow: 0 2px 28px rgba(0,0,0,0.45) !important;
        }
        html[data-theme='light'] .main-nav.scrolled {
          background: rgba(247,248,252,0.92) !important;
          border-bottom-color: rgba(0,0,0,0.08) !important;
          box-shadow: 0 2px 16px rgba(0,0,0,0.08) !important;
        }
        @media (max-width: 480px) {
          .nav-logo-text {
            display: none !important;
          }
        }
        /* Mobile Drawer */
        .mobile-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 99998;
          animation: drawerFadeIn 0.22s ease;
        }
        @keyframes drawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .mobile-drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 260px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          animation: drawerSlideIn 0.25s cubic-bezier(0.22,1,0.36,1);
          overflow-y: auto;
          overflow-x: hidden;
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mobile-drawer-panel .nav-link-btn {
          text-align: left !important;
          justify-content: flex-start !important;
        }
      `}</style>
      <nav className={`main-nav${scrolled ? ' scrolled' : ''}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {isMobileOrTablet ? (
          /* Mobile / Tablet Layout */
          <div className="nav-bar-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', position: 'relative' }}>
            {/* Left: Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigateAndCloseMenu('/')}>
              <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 32, height: 32 }} />
              <h1 className="nav-logo-text" style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>SahaPlay</h1>
            </div>

            {/* Right: Actions & Hamburger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isLoggedIn && (
                  /* Search */
                  <div style={{ position: 'relative' }}>
                    <button 
                      className={`nav-icon-btn${showSearch ? ' active' : ''}`}
                      title={t('search', 'Search')}
                      onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); }}
                    >
                      <Search size={18} />
                    </button>
                    {showSearch && (
                      <div className="nav-dropdown" style={{
                        position: 'fixed',
                        top: '68px',
                        left: '16px',
                        right: '16px',
                        width: 'auto',
                        background: isLight ? '#ffffff' : '#111',
                        border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        padding: 12,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        zIndex: 100000
                      }}>
                        <input 
                          autoFocus
                          placeholder={t('searchUsersPlaceholder', 'Search users...')}
                          className="nav-input"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            color: isLight ? '#111' : '#fff',
                            fontSize: 13,
                            outline: 'none',
                            marginBottom: 8
                          }}
                        />
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          {searchResults.length > 0 ? (
                            searchResults.map(u => (
                              <div key={u.username} onClick={() => { setShowSearch(false); navigate(`/profile/${u.username}`); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                                   onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                                  <div style={{ color: isLight ? '#666' : '#6b7280', fontSize: 11 }}>@{u.username}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            searchQuery ? <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 12 }}>{t('noUsersFound', 'No users found')}</div> : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isLoggedIn && (
                  <>
                    {/* Chats Trigger */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
                        title={t('chats', 'Chats')}
                        onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); }}
                      >
                        <MessageSquare size={18} />
                        {totalUnread > 0 && (
                          <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {totalUnread > 9 ? '9+' : totalUnread}
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Notifications */}
                    <div style={{ position: 'relative' }}>
                      <button title={t('notifications', 'Notifications')} onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); setShowRecentChats(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
                        <Bell size={18} />
                        {followRequests.filter(r => r.status === 'pending').length > 0 && (
                          <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {followRequests.filter(r => r.status === 'pending').length}
                          </div>
                        )}
                      </button>
                      {showNotifications && (
                        <div className="nav-dropdown" style={{
                          position: 'fixed',
                          top: '68px',
                          left: '16px',
                          right: '16px',
                          width: 'auto',
                          background: isLight ? '#ffffff' : '#111',
                          border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 16,
                          padding: '12px 6px',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                          zIndex: 100000
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#666' : '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
                          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {followRequests.length > 0 ? (
                              followRequests.map(u => (
                                <div key={u.username} onClick={() => { setShowNotifications(false); navigate(`/profile/${u.username}`); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? (isLight ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.05)') : 'transparent' }}
                                  onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                                  onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? (isLight ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.05)') : 'transparent'}>
                                  <div style={{ width: 40, height: 40, borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                    {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} color={isLight ? '#666' : '#888'} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                                    <div style={{ color: isLight ? '#444' : '#6b7280', fontSize: 11, marginTop: 2 }}>
                                      {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                      {u.status === 'pending' ? (
                                        <button onClick={(e) => handleAllowRequest(u.username, e)} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.15)', border: 'none', color: '#818cf8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                                      ) : (
                                        <button disabled style={{ padding: '6px 12px', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLight ? '#666' : '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                                      )}
                                      
                                      {u.myFollowStatus === 'accepted' ? (
                                        <button disabled style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                                      ) : (
                                        <button onClick={(e) => {
                                          e.stopPropagation();
                                          if (u.myFollowStatus === 'pending') return;
                                          handleFollowBack(u.username, e);
                                        }} className={u.myFollowStatus === 'pending' ? '' : 'stay-white'} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: u.myFollowStatus === 'pending' ? (isLight ? '#666' : '#6b7280') : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                          {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Fullscreen Button */}
                <button
                  className={`nav-icon-btn${isAppFullscreen ? ' active' : ''}`}
                  title={isAppFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    } else {
                      document.exitFullscreen().catch(() => {});
                    }
                  }}
                >
                  {isAppFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>

              {/* Hamburger Button */}
              <button
                className="nav-hamburger-btn"
                onClick={() => setShowMobileMenu(m => !m)}
                aria-label="Toggle menu"
                style={{ display: 'flex' }}
              >
                <div className="ham-line" />
                <div className="ham-line" />
                <div className="ham-line" />
              </button>


            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="nav-bar-row">
            {/* Left: Logo */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 32, height: 32 }} />
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>SahaPlay</h1>
            </div>

            {/* Center: Nav Links */}
            <div className="nav-links-desktop" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/')}>{t('home', 'Home')}</button>
              <button className={`nav-link-btn${location.pathname === '/features' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/features')}>{t('features', 'Features')}</button>
              <button className={`nav-link-btn${location.pathname === '/how-it-works' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/how-it-works')}>{t('howItWorks', 'Guide')}</button>
              <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/public')}>{t('explore', 'Explore')}</button>
            </div>

            {/* Right: Actions */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              {isLoggedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className={`nav-icon-btn${showSearch ? ' active' : ''}`}
                        title={t('search', 'Search')}
                        onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
                      >
                        <Search size={18} />
                      </button>
                      {showSearch && (
                        <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -60, width: 320, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                          <input 
                            autoFocus
                            placeholder={t('searchUsersPlaceholder', 'Search users...')}
                            className="nav-input"
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
                                    {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                                    <div style={{ color: '#6b7280', fontSize: 11 }}>@{u.username}</div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              searchQuery ? <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 12 }}>{t('noUsersFound', 'No users found')}</div> : null
                            )}
                          </div>
                        </div>
                      )}
                    </div>
      
                    {/* Chats Trigger */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
                        title={t('chats', 'Chats')}
                        onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }}
                      >
                        <MessageSquare size={18} />
                        {totalUnread > 0 && (
                          <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {totalUnread > 9 ? '9+' : totalUnread}
                          </div>
                        )}
                      </button>
                    </div>
      
                    {/* Notifications */}
                    <div style={{ position: 'relative' }}>
                      <button title={t('notifications', 'Notifications')} onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); setShowRecentChats(false); setShowUserMenu(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
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
                                    {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} color="#888" />}
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
      
                    {/* App Fullscreen */}
                    <button
                      className={`nav-icon-btn${isAppFullscreen ? ' active' : ''}`}
                      title={isAppFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      onClick={() => {
                        if (!document.fullscreenElement) {
                          document.documentElement.requestFullscreen().catch(() => {});
                        } else {
                          document.exitFullscreen().catch(() => {});
                        }
                      }}
                    >
                      {isAppFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                  </div>
    
                  {/* User Menu Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
                    <div className="profile-pill"
                      onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {profile?.avatarPath ? (
                          <img src={getAvatarUrl(profile.avatarPath)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={14} style={{ color: '#6366f1' }} />
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
                          <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowSupportModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <HelpCircle size={16} color="#f59e0b" />
                            </div>
                            {t('contactSupport', 'Contact Support')}
                          </button>
                          <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowDownloadAppModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Download size={16} color="#38bdf8" />
                            </div>
                            {t('getDesktopApp', 'Get Desktop App')}
                          </button>
                          {isAdminRole && (
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/admin'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sparkles size={16} color="#a855f7" />
                              </div>
                              {t('adminDashboard', 'Admin Dashboard')}
                            </button>
                          )}
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
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isGuest && (
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginRight: 8 }} onMouseLeave={() => setShowUserMenu(false)}>
                      <div className="profile-pill"
                        onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} style={{ color: '#6366f1' }} />
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
                            <div className="profile-divider" style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); clearUserSession(); navigate('/login'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={16} color="#6366f1" />
                              </div>
                              {t('logIn', 'Sign In')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={() => navigate('/login')} style={{ background: isLight ? 'transparent' : 'none', border: isLight ? '1px solid rgba(0,0,0,0.18)' : '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', color: isLight ? '#374151' : '#ccc', fontSize: '14px', fontWeight: 600, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'transparent' : 'none'; e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'; }}
                  >
                    {t('logIn', 'Log In')}
                  </button>
                  <button onClick={() => navigate('/signup')} className="stay-white" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '9px 20px', borderRadius: '10px', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {t('signUp', 'Sign Up')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Mobile/Tablet Drawer – rendered as a portal so it's outside the sticky nav */}
      {isMobileOrTablet && showMobileMenu && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Side Panel */}
          <div
            className="mobile-drawer-panel"
            style={{
              background: isLight ? '#ffffff' : '#141418',
              borderLeft: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isLight ? '-8px 0 32px rgba(0,0,0,0.12)' : '-8px 0 40px rgba(0,0,0,0.7)',
              padding: '0',
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play fill="#fff" size={12} style={{ marginLeft: 1 }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: isLight ? '#111' : '#fff' }}>Menu</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLight ? '#555' : '#aaa', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Nav Links */}
            <div style={{ padding: '8px', flex: 1 }}>
              <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/')}>
                <Home size={16} />
                {t('home', 'Home')}
              </button>
              <button className={`nav-link-btn${location.pathname === '/features' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/features')}>
                <Sparkles size={16} />
                {t('features', 'Features')}
              </button>
              <button className={`nav-link-btn${location.pathname === '/how-it-works' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/how-it-works')}>
                <HelpCircle size={16} />
                {t('howItWorks', 'Guide')}
              </button>
              <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/public')}>
                <Compass size={16} />
                {t('explore', 'Explore')}
              </button>

              <div style={{ height: '1px', background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

              {(isLoggedIn || isGuest) && (
                <>
                  <button className={`nav-link-btn${location.pathname === '/profile' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/profile')}>
                    <User size={16} />
                    {t('profile', 'Profile')} {loggedInUsername ? `(${loggedInUsername})` : ''}
                  </button>

                  <button className={`nav-link-btn${location.pathname === '/app-settings' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/app-settings')}>
                    <Settings size={16} />
                    {t('app', 'App Settings')}
                  </button>

                  <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => { setShowSupportModal(true); setShowMobileMenu(false); }}>
                    <HelpCircle size={16} />
                    {t('contactSupport', 'Contact Support')}
                  </button>

                  <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => { setShowDownloadAppModal(true); setShowMobileMenu(false); }}>
                    <Download size={16} />
                    {t('getDesktopApp', 'Get Desktop App')}
                  </button>

                  {isAdminRole && (
                    <button className={`nav-link-btn${location.pathname === '/admin' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/admin')}>
                      <Sparkles size={16} color="#a855f7" />
                      {t('adminDashboard', 'Admin Dashboard')}
                    </button>
                  )}

                  {isGuest ? (
                    <>
                      <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => { clearUserSession(); navigateAndCloseMenu('/login'); }}>
                        <User size={16} />
                        {t('logIn', 'Sign In')}
                      </button>
                      <button className="stay-white" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginTop: 4 }} onClick={() => navigateAndCloseMenu('/signup')}>
                        <Sparkles size={16} />
                        {t('signUp', 'Sign Up')}
                      </button>
                    </>
                  ) : (
                    <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', color: '#f87171' }} onClick={() => { setShowMobileMenu(false); handleLogout(); }}>
                      <LogOut size={16} color="#f87171" />
                      {t('logOut', 'Log Out')}
                    </button>
                  )}
                </>
              )}

              {!isLoggedIn && !isGuest && (
                <>
                  <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/login')}>
                    <User size={16} />
                    {t('logIn', 'Sign In')}
                  </button>

                  <button className="stay-white" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginTop: 4 }} onClick={() => navigateAndCloseMenu('/signup')}>
                    <Sparkles size={16} />
                    {t('signUp', 'Sign Up')}
                  </button>
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}


      {!isLoggedIn && localStorage.getItem('watch_is_guest') === 'true' && (
        <div className="guest-marquee-container">
          <div className="guest-marquee-text">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} /> 
              {t('guestLimitations', 'You are currently browsing as a Guest. Sign Up for a free account to create your own rooms and unlock all features!')}
            </span>
          </div>
        </div>
      )}

      {/* Self-contained Global Chat Widget */}
      {isLoggedIn && (
        <GlobalChatWidget 
          ref={chatWidgetRef} 
          isOpen={showRecentChats} 
          onClose={() => setShowRecentChats(false)} 
          unreadCounts={unreadCounts} 
          onMarkRead={handleMarkRead} 
          onNewMessage={handleNewMessage} 
        />
      )}

      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <DownloadAppModal isOpen={showDownloadAppModal} onClose={() => setShowDownloadAppModal(false)} />
    </>
  );
};

export default Navbar;
