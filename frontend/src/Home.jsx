import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, User, LogOut, Settings, Hash, Compass, ArrowRight, Star, Plus, Shield, Check, X, AlertCircle, Camera, Search, MessageSquare, Zap, Globe, Pin, Users, HelpCircle, Bell } from 'lucide-react';
import { FaWhatsapp, FaTelegramPlane } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiGmail } from 'react-icons/si';
import toast, { Toaster } from 'react-hot-toast';
import GlobalChatWidget from './components/GlobalChatWidget';
import CreateRoomModal from './components/CreateRoomModal';
import { useDebounce } from './hooks/useDebounce';

const catMap = {
  movies: '🎬 Movies',
  anime: '⛩️ Anime',
  songs: '🎵 Music',
  gaming: '🎮 Gaming',
  sports: '⚽ Sports',
  other: '✨ Other'
};

const API = 'http://localhost:3001';


const Home = () => {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Check auth state
  const token = localStorage.getItem('watch_token');
  const loggedInUsername = localStorage.getItem('watch_username');
  const isLoggedIn = !!token;

  const [pinnedRooms, setPinnedRooms] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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
  const navIconsRef = useRef(null);
  const chatWidgetRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if clicking inside the chat widget
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
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        const counts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = chat.id || chat.partner;
          if (chat.unread && chat.unread > 0) {
            counts[chatKey] = chat.unread;
            total += chat.unread;
            localCounts[chatKey] = chat.unread; // Keep local identical to DB precise count
          } else {
            delete localCounts[chatKey]; // Sync local storage for seen chats
          }
        });
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
        setUnreadCounts(counts);
        setTotalUnread(total);
      } catch {}
    };
    checkUnread();
    window.addEventListener('focus', checkUnread);
    return () => window.removeEventListener('focus', checkUnread);
  }, [token]);

  // Called by GlobalChatWidget when a new real-time message arrives
  const handleNewMessage = useCallback((partner, msg) => {
    const chatKey = partner;
    // Don't show total unread if the widget is already open and viewing this chat
    if (chatWidgetRef.current?.isOpen && chatWidgetRef.current?.activeChat?.partner === partner) return;

    // Check if muted before playing sound
    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}

    if (!isMuted) {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Subtle "pop"
        audio.volume = 0.5;
        audio.play().catch(()=>{});
      } catch(e){}
    }

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
    
    // Clear local unread counts
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });

    // Refetch precise unread counts to keep navbar in sync with backend
    if (token) {
      const param = encodeURIComponent(JSON.stringify(lastSeen));
      fetch(`${API}/api/chats/recent?lastSeen=${param}`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          let total = 0;
          data.forEach(c => { total += (c.unread || 0); });
          setTotalUnread(total);
        }
      }).catch(() => {});
    }
  }, [token, API]);


  useEffect(() => {
    const fetchRequests = () => {
      if (token) {
        fetch(`${API}/api/follow/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json()).then(data => { if (Array.isArray(data)) setFollowRequests(data); }).catch(() => {});
      }
    };
    fetchRequests();
    // Poll every 3s so accepted status reflects immediately across all panels
    const interval = setInterval(fetchRequests, 3000);
    window.addEventListener('focus', fetchRequests);
    window.addEventListener('follow_status_updated', fetchRequests);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchRequests);
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



  const fetchRooms = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      if (stored.length > 0) {
        const idsAndMax6 = stored.slice(0, 6).join(',');
        fetch(`${API}/api/rooms/info?ids=${idsAndMax6}`)
          .then(r => r.json())
          .then(data => { if(Array.isArray(data)) setPinnedRooms(data); else setPinnedRooms([]); })
          .catch(err => console.error('Failed to load pinned rooms', err));
      } else {
        setPinnedRooms([]);
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    fetchRooms();
    window.addEventListener('focus', fetchRooms);
    return () => window.removeEventListener('focus', fetchRooms);
  }, [fetchRooms]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        if (data.pinnedRooms) {
          try {
            const arr = JSON.parse(data.pinnedRooms);
            localStorage.setItem('pinned_rooms', JSON.stringify(arr));
            fetchRooms();
          } catch(e) {}
        }
      })
      .catch(() => {});
  }, [token, fetchRooms]);

  useEffect(() => {
    if (!debouncedSearchQuery) { setSearchResults([]); return; }
    fetch(`${API}/api/users/search?q=${debouncedSearchQuery}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if(Array.isArray(d)) setSearchResults(d); else setSearchResults([]); }).catch(() => {});
  }, [debouncedSearchQuery, token]);


  const handleUnpin = async (e, roomId) => {
    e.stopPropagation();
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      const updated = stored.filter(id => id !== roomId);
      localStorage.setItem('pinned_rooms', JSON.stringify(updated));
      
      if (token) {
        await fetch(`${API}/api/profile/pinned-rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ pinnedRooms: updated })
        });
      }

      toast.success('Room unpinned');
      fetchRooms();
    } catch(err) {}
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim()) {
      toast.error('Please enter a Room ID to join!');
      return;
    }
    navigate(`/room/${roomId.trim()}`);
  };

  const createRoom = () => {
    if (!isLoggedIn) {
      toast.error('Please log in to create a room!');
      return;
    }
    setShowCreateModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('watch_token');
    localStorage.removeItem('watch_username');
    window.location.reload();
  };

  const features = [
    { icon: <Zap size={28} />, color: '#facc15', title: t('instantSync', 'Instant Sync'), desc: t('instantSyncDesc', 'Zero-latency media synchronization powered by WebSockets.') },
    { icon: <Globe size={28} />, color: '#34d399', title: t('multiPlatform', 'Multi-Platform'), desc: t('multiPlatformDesc', 'YouTube, Twitch, Vimeo, SoundCloud, and more — all in one place.') },
    { icon: <MessageSquare size={28} />, color: '#fb923c', title: t('liveChat', 'Live Chat'), desc: t('liveChatDesc', 'Real-time chat with moderation tools, mute, kick, and ban.') },
  ];

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <Toaster position="top-center" />
      <style>{`
        .pinned-card {
          border-radius: 28px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(25, 25, 35, 0.4);
          backdrop-filter: blur(20px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pinned-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          border-color: rgba(99,102,241,0.5);
          background: rgba(30, 30, 45, 0.6);
        }
        .img-layer {
          height: 160px;
          position: relative;
          overflow: hidden;
        }
        .pinned-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .pinned-card:hover .pinned-img {
          transform: scale(1.1);
        }
        .cat-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          padding: 8px 16px;
          border-radius: 14px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          z-index: 10;
          text-transform: uppercase;
        }
        .unpin-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }
        .unpin-btn:hover {
          background: #ef4444;
          color: #fff;
          border-color: #ef4444;
          box-shadow: 0 0 20px rgba(239,68,68,0.5);
          transform: rotate(90deg) scale(1.1);
        }
        .footer-layer {
          background: transparent;
          padding: 20px;
          display: flex;
          flex-direction: column;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .join-btn {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: none;
          color: #fff;
          padding: 8px 20px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(99,102,241,0.3);
        }
        .join-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(99,102,241,0.5);
        }
        .guest-marquee-container {
          width: 100%;
          overflow: hidden;
          background: rgba(245, 158, 11, 0.08); /* subtle amber */
          border-bottom: 1px solid rgba(245, 158, 11, 0.15);
          padding: 8px 0;
        }
        .guest-marquee-text {
          white-space: nowrap;
          animation: marquee 25s linear infinite;
          display: inline-block;
          padding-left: 100%;
          color: #fbbf24;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        @keyframes marquee {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-100%, 0); }
        }
        
        /* Create Room Modal */
        .cr-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.75);
          backdrop-filter: blur(8px); z-index: 10000;
          overflow-y: auto;
          padding: 40px 16px;
          animation: fadeIn 0.2s ease;
          overscroll-behavior: contain;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .cr-modal {
          background: rgba(19, 19, 31, 0.95);
          backdrop-filter: blur(40px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 32px;
          padding: 40px;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          box-shadow: 0 40px 100px rgba(0,0,0,0.9);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .cr-input {
          width: 100%; padding: 14px 20px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px; color: #fff;
          font-size: 15px; outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .cr-input:focus { border-color: #6366f1; background: rgba(255,255,255,0.1); box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
        .cr-cat-btn {
          padding: 12px 8px;
          border-radius: 16px;
          border: 1.5px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #888;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cr-toggle-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-radius: 18px;
          border: 1.5px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-link-btn {
          background: none; border: none; font-size: 14px; font-weight: 700;
          cursor: pointer; padding: 10px 18px; border-radius: 14px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); color: #94a3b8;
        }
        .nav-link-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .nav-link-btn.active { background: rgba(99,102,241,0.12); color: #818cf8; box-shadow: 0 0 0 1px rgba(99,102,241,0.2); }
        
        .feature-card, .hiw-step-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 32px;
          padding: 40px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
        }
        .feature-card:hover, .hiw-step-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }


        /* ── NAV ICON BUTTONS ── */
        .nav-icon-btn {
          background: rgba(255,255,255,0.05); border: none; padding: 8px;
          border-radius: 50%; cursor: pointer; transition: background 0.2s, color 0.2s;
          display: flex; position: relative; color: #888;
        }
        .nav-icon-btn:hover { background: rgba(255,255,255,0.12); color: #ccc; }
        .nav-icon-btn.active { color: #6366f1; border-radius: 12px; background: rgba(99,102,241,0.12); }

        /* ── HERO BADGE ── */
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3);
          border-radius: 999px; padding: 6px 16px; margin-bottom: 32px;
          font-size: 13px; color: #818cf8; font-weight: 600;
        }

        /* ── HOW IT WORKS ── */
        .hiw-section { width: 100%; position: relative; }
        .hiw-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 999px; padding: 5px 14px; margin-bottom: 20px;
          font-size: 12px; color: #818cf8; font-weight: 600; letter-spacing: 0.3px;
        }
        .hiw-step-icon {
          width: 72px; height: 72px; border-radius: 22px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px; font-size: 30px; transition: transform 0.3s;
        }
        .hiw-step-card:hover .hiw-step-icon { transform: translateY(-4px) scale(1.05); }
        .hiw-step-num {
          font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
          text-transform: uppercase; margin-bottom: 8px;
        }

        /* ── PINNED CARDS ── */
        .pinned-card {
          border-radius: 16px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
          background: #12121a;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          display: flex; flex-direction: column; overflow: hidden;
        }
        .pinned-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.5);
          border-color: rgba(99,102,241,0.5);
        }
        .img-layer { height: 130px; position: relative; overflow: hidden; }
        .pinned-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
        .pinned-card:hover .pinned-img { transform: scale(1.08); }
        .cat-badge {
          position: absolute; top: 12px; left: 12px;
          background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12); color: #fff;
          padding: 6px 12px; border-radius: 10px; font-size: 11px;
          font-weight: 700; letter-spacing: 0.5px; z-index: 10;
        }
        .unpin-btn {
          position: absolute; top: 12px; right: 12px;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15); color: #fff;
          width: 32px; height: 32px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); z-index: 10;
        }
        .unpin-btn:hover {
          background: rgba(239,68,68,0.2); color: #ef4444;
          border-color: rgba(239,68,68,0.4); box-shadow: 0 0 20px rgba(239,68,68,0.3);
          transform: scale(1.1);
        }
        .unpin-btn .unpin-icon { transition: fill 0.3s ease; fill: none; }
        .unpin-btn:hover .unpin-icon { fill: currentColor; }
        .footer-layer {
          background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12));
          padding: 12px 16px; display: flex; flex-direction: column;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .join-btn {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border: none; color: #fff; padding: 5px 14px; border-radius: 8px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        .pinned-card:hover .join-btn { transform: translateY(-2px); }

        /* ── FEATURES CARDS ── */
        .feature-card {
          padding: 28px 24px; cursor: default; border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: var(--panel-bg); backdrop-filter: blur(24px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        /* ── FOOTER ── */
        .home-footer {
          background: #09090b; border-top: 1px solid rgba(255,255,255,0.05);
          padding: 80px 40px 40px;
        }
        .footer-link-btn {
          background: none; border: none; font-size: 14px; text-align: left;
          cursor: pointer; transition: all 0.2s; color: #6b7280; padding: 0;
        }
        .footer-link-btn:hover { color: #818cf8; }
        .footer-social-btn {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          color: #888; cursor: pointer; display: flex; align-items: center;
          justify-content: center; transition: all 0.2s;
        }
        .footer-social-btn:hover { color: #818cf8; background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); }

        /* ── GUEST MARQUEE ── */
        .guest-marquee-container {
          width: 100%; overflow: hidden;
          background: rgba(245,158,11,0.08);
          border-bottom: 1px solid rgba(245,158,11,0.15); padding: 8px 0;
        }
        .guest-marquee-text {
          white-space: nowrap; animation: marquee 25s linear infinite;
          display: inline-block; padding-left: 100%;
          color: #fbbf24; font-size: 13px; font-weight: 600; letter-spacing: 0.3px;
        }
        @keyframes marquee { 0% { transform: translate(0,0); } 100% { transform: translate(-100%,0); } }

        /* ── CREATE ROOM MODAL ── */
        .cr-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.75);
          backdrop-filter: blur(8px); z-index: 10000;
          overflow-y: auto; padding: 40px 16px; animation: fadeIn 0.2s ease;
          overscroll-behavior: contain;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .cr-modal {
          background: #13131f; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px; padding: 32px; width: 100%; max-width: 480px;
          margin: 0 auto; box-shadow: 0 32px 80px rgba(0,0,0,0.8);
          animation: slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1); position: relative;
        }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .cr-close-btn {
          position: absolute; top: 0; right: -56px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%; width: 44px; height: 44px; cursor: pointer; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; padding-bottom: 2px; transition: all 0.2s;
        }
        .cr-close-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
        @media (max-width: 600px) { .cr-close-btn { top: -56px; right: 0; } }
        .cr-input {
          width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff;
          font-size: 15px; outline: none; transition: border-color 0.2s; box-sizing: border-box;
        }
        .cr-input:focus { border-color: rgba(99,102,241,0.6); }
        .cr-input option { background: #1a1a2e; }
        .cr-cat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 8px; }
        .cr-cat-btn {
          padding: 10px 6px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04); color: #aaa; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: center;
        }
        .cr-cat-btn:hover { border-color: rgba(99,102,241,0.4); color: #fff; }
        .cr-cat-btn.active { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.6); color: #a5b4fc; }
        .cr-toggle-row {
          display: flex; align-items: center; gap: 12px; padding: 14px 16px;
          border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03); cursor: pointer; transition: border-color 0.2s;
        }
        .cr-toggle-row:hover { border-color: rgba(99,102,241,0.3); }
        .cr-toggle-track { width: 42px; height: 24px; border-radius: 999px; transition: background 0.3s; position: relative; flex-shrink: 0; }
        .cr-toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.3s; }
        .cr-launch-btn {
          width: 100%; padding: 14px; border-radius: 14px; border: none;
          background: linear-gradient(135deg,#6366f1,#a855f7); color: #fff;
          font-size: 16px; font-weight: 700; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s; letter-spacing: 0.3px;
        }
        .cr-launch-btn:hover { transform: scale(1.02); box-shadow: 0 8px 24px rgba(168,85,247,0.45); }
        .cr-copy-btn {
          margin-left: auto; flex-shrink: 0; background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc;
          padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.5px; transition: all 0.2s;
        }
        .cr-copy-btn:hover { background: rgba(99,102,241,0.3); }
        .cr-copy-btn.copied { background: rgba(16,185,129,0.2); border-color: rgba(16,185,129,0.4); color: #34d399; }

        /* ════════════════════════════════
           LIGHT MODE OVERRIDES
        ════════════════════════════════ */
        html[data-theme='light'] .nav-link-btn { color: #555; }
        html[data-theme='light'] .nav-link-btn:hover { background: rgba(0,0,0,0.06); color: #111; }
        html[data-theme='light'] .nav-link-btn.active { background: rgba(99,102,241,0.1); color: #4f46e5; }

        html[data-theme='light'] .nav-icon-btn.active { color: #6366f1 !important; background: rgba(99,102,241,0.1) !important; }

        html[data-theme='light'] .nav-link-btn.active { 
          background: rgba(99,102,241,0.08) !important; 
          color: #4f46e5 !important; 
          border-radius: 8px;
          box-shadow: 0 0 0 1px rgba(99,102,241,0.1);
        }

        html[data-theme='light'] .hero-badge { 
          background: #fff; 
          border-color: rgba(0,0,0,0.1); 
          color: #000; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 8px 20px;
        }

        html[data-theme='light'] .hiw-badge { 
          background: rgba(99,102,241,0.08); 
          border-color: rgba(99,102,241,0.2); 
          color: #4f46e5; 
          padding: 8px 24px;
          font-size: 14px;
          font-weight: 700;
        }

        html[data-theme='light'] .pinned-card { background: #ffffff; border-color: rgba(0,0,0,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        html[data-theme='light'] .pinned-card:hover { box-shadow: 0 12px 30px rgba(0,0,0,0.12); border-color: rgba(99,102,241,0.3); }
        html[data-theme='light'] .join-btn { background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #fff !important; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25); }
        html[data-theme='light'] .join-btn:hover { background: linear-gradient(135deg, #7c3aed, #c026d3); box-shadow: 0 6px 15px rgba(139, 92, 246, 0.4); }
        html[data-theme='light'] .footer-layer { background: #fff !important; border-top: 1px solid rgba(0,0,0,0.04) !important; }
        
        html[data-theme='light'] .profile-pill { background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.08) !important; color: #111 !important; }
        html[data-theme='light'] .profile-pill:hover { background: rgba(0,0,0,0.08) !important; border-color: rgba(0,0,0,0.15) !important; }

        html[data-theme='light'] .feature-card { background: #ffffff; border-color: rgba(0,0,0,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        html[data-theme='light'] .feature-card h3 { color: #1a1a2e !important; }
        html[data-theme='light'] .feature-card p { color: #4a5568 !important; }

        html[data-theme='light'] .home-footer { background: #ffffff; border-top: 1px solid rgba(0,0,0,0.08); }
        html[data-theme='light'] .home-footer h3, html[data-theme='light'] .home-footer h4 { color: #111 !important; }
        html[data-theme='light'] .footer-link-btn { color: #6b7280; }
        html[data-theme='light'] .footer-link-btn:hover { color: #6366f1; }
        html[data-theme='light'] .footer-social-btn { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); color: #555; }
        html[data-theme='light'] .footer-social-btn:hover { color: #6366f1; background: rgba(99,102,241,0.08); }
        html[data-theme='light'] .home-footer-bottom { color: #9ca3af !important; border-top-color: rgba(0,0,0,0.08) !important; }

        /* ── Pinned Card Unpin Button ── */
        html[data-theme='light'] .unpin-btn {
          background: #f1f5f9 !important;
          border-color: rgba(0,0,0,0.1) !important;
          color: #475569 !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }
        html[data-theme='light'] .unpin-btn:hover {
          background: #fff !important;
          border-color: #4f46e5 !important;
          color: #4f46e5 !important;
        }

        /* ── Hero Link ── */
        html[data-theme='light'] .hero-link-btn { color: #4f46e5 !important; }
        html[data-theme='light'] .hero-link-btn:hover { color: #3730a3 !important; text-decoration: underline; }

        /* ── Section Alternation ── */
        .section-alt { width: 100%; background: rgba(255,255,255,0.02); }
        html[data-theme='light'] .section-alt { background: #f9fafb !important; }

        /* ── Badges & Headings ── */
        .section-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a0aab2;
        }
        html[data-theme='light'] .section-icon-badge {
          background: #fff;
          border-color: rgba(0,0,0,0.1);
          color: #111;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .section-heading {
          font-size: 24px;
          fontWeight: 800;
          margin: 0;
          color: #fff;
        }
        html[data-theme='light'] .section-heading { color: #000 !important; }

        /* Create Room Modal Light Mode */
        html[data-theme='light'] .cr-overlay { background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); }
        html[data-theme='light'] .cr-modal { background: #ffffff; border-color: rgba(0,0,0,0.1); box-shadow: 0 32px 80px rgba(0,0,0,0.15); }
        html[data-theme='light'] .cr-modal h2 { color: #0f172a !important; }
        html[data-theme='light'] .cr-modal p { color: #334155 !important; }
        html[data-theme='light'] .cr-modal label { color: #1e293b !important; font-weight: 800 !important; }
        html[data-theme='light'] .cr-input { background: #f8fafc; border-color: #e2e8f0; color: #0f172a; }
        html[data-theme='light'] .cr-input:focus { border-color: #6366f1; background: #fff; }
        html[data-theme='light'] .cr-cat-btn { background: #f1f5f9; border-color: #e2e8f0; color: #334155; }
        html[data-theme='light'] .cr-cat-btn:hover { border-color: #6366f1; color: #6366f1; }
        html[data-theme='light'] .cr-cat-btn.active { background: rgba(99,102,241,0.1); border-color: #6366f1; color: #4f46e5; }
        html[data-theme='light'] .cr-toggle-row { background: #f8fafc; border-color: #e2e8f0; }
        html[data-theme='light'] .cr-toggle-row:hover { border-color: #cbd5e1; }
        html[data-theme='light'] .cr-toggle-row .toggle-label { color: #0f172a !important; }
        html[data-theme='light'] .cr-toggle-row .toggle-desc { color: #334155 !important; }
        html[data-theme='light'] .cr-copy-btn { background: #f1f5f9; border-color: #cbd5e1; color: #4f46e5; }
        html[data-theme='light'] .cr-copy-btn:hover { background: #e2e8f0; }
        html[data-theme='light'] .cr-close-btn { background: #f1f5f9; border-color: #e2e8f0; color: #64748b; }
        html[data-theme='light'] .cr-close-btn:hover { background: #e2e8f0; color: #1e293b; }
        html[data-theme='light'] .create-room-hero-btn { color: #ffffff !important; }
        html[data-theme='light'] .create-room-hero-btn svg { color: #ffffff !important; fill: #ffffff !important; }
        html[data-theme='light'] .cr-launch-btn { box-shadow: none !important; color: #ffffff !important; }
        html[data-theme='light'] .cr-launch-btn:hover { box-shadow: none !important; }
        html[data-theme='light'] .cr-launch-btn svg { color: #ffffff !important; fill: #ffffff !important; }
      `}</style>

      {/* Create Room Modal */}
      <CreateRoomModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        loggedInUsername={loggedInUsername} 
      />

      {/* Navbar */}
      <nav style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        {/* Left: Logo */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Play fill="#fff" size={16} style={{ marginLeft: 2 }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>WatchTogether</h1>
        </div>

        {/* Center: Nav Links */}
        <div className="nav-links-desktop" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/')}>Home</button>
          <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/public')}>Explore</button>
          <button className="nav-link-btn" style={{ padding: '8px 16px' }} onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it Works</button>
          <button className="nav-link-btn" style={{ padding: '8px 16px' }} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</button>
          <button className="nav-link-btn" style={{ padding: '8px 16px' }} onClick={() => toast.success('Help center coming soon!')}>Support</button>
        </div>

        {/* Right: Actions */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>

        {isLoggedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Global Search and Chat Icons */}
            <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
              <div style={{ position: 'relative' }}>
                <button 
                  className={`nav-icon-btn${showSearch ? ' active' : ''}`}
                  title="Search"
                  onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
                >
                  <Search size={18} />
                </button>
                {showSearch && (
                  <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -60, width: 320, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                    <input 
                      autoFocus
                      placeholder="Search users..."
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
                  className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
                  title="Chats"
                  onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }}
                >
                  <MessageSquare size={18} />
                  {totalUnread > 0 && (
                    <div className="unread-badge" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    <div className="unread-badge" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {followRequests.filter(r => r.status === 'pending').length}
                    </div>
                  )}
                </button>
                {showNotifications && (
                  <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -20, width: 340, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 6px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Follow Notifications</div>
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
                                {u.status === 'pending' ? `@${u.username} wants to follow you` : `@${u.username} started following you`}
                              </div>
                              
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {u.status === 'pending' ? (
                                  <button onClick={(e) => handleAllowRequest(u.username, e)} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.15)', border: 'none', color: '#818cf8', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Allow</button>
                                ) : (
                                  <button disabled style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Follower</button>
                                )}
                                
                                {u.myFollowStatus === 'accepted' ? (
                                  <button disabled style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Following</button>
                                ) : (
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    if (u.myFollowStatus === 'pending') return;
                                    handleFollowBack(u.username, e);
                                  }} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: u.myFollowStatus === 'pending' ? '#6b7280' : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                    {u.myFollowStatus === 'pending' ? 'Request Sent' : 'Follow Back'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 24 }}>No new notifications</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
            onMouseLeave={() => setShowUserMenu(false)}
          >
            <div className="profile-pill"
              onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile?.avatarPath ? (
                  <img src={`${API}${profile.avatarPath}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={14} style={{ color: '#6366f1' }} />
                )}
              </div>
              <span style={{ fontWeight: 600 }}>{loggedInUsername}</span>
            </div>
            {/* Hover Dropdown - absolutely positioned, never affects layout */}
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
        ) : (
          /* Not logged in: show login/signup */
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '14px', fontWeight: 500, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
            >
              {t('logIn', 'Log In')}
            </button>
            <button onClick={() => navigate('/signup')} style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '9px 20px', borderRadius: '10px', transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {t('signUp', 'Sign Up')}
            </button>
          </div>
        )}
        </div>
      </nav>

      {/* Guest Warning Marquee */}
      {!isLoggedIn && (
        <div className="guest-marquee-container">
          <div className="guest-marquee-text">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} /> 
              {t('guestLimitations', 'You are currently browsing as a Guest. Guest permissions are limited: Cannot create rooms • Camera and Microphone are disabled • Real-time chat is disabled • Cannot join "Members Only" rooms. Sign Up for a free account to unlock all features!')}
            </span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 0 80px', width: '100%' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>
          <div className="hero-badge">
            <Zap size={13} fill="currentColor" /> {t('zeroLatency', 'Zero-latency synchronization')}
          </div>

          <h1 className="hero-title" style={{ fontSize: 'clamp(44px, 8vw, 84px)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 24px', letterSpacing: '-2px' }}>
            {t('watchWithFriends', 'WATCH WITH FRIENDS').split('WITH FRIENDS')[0]}
            <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{'WITH FRIENDS'}</span>
            <br />{t('anywhere', 'ANYWHERE.')}
          </h1>

          <p className="hero-desc" style={{ fontSize: '18px', lineHeight: 1.6, maxWidth: '580px', margin: '0 auto 48px' }}>
            {t('heroDescription', 'Synchronize YouTube, Twitch, and Netflix with friends. Real-time chat, P2P screen sharing, and perfect media sync.')}
          </p>

          {/* CTA Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
            {localStorage.getItem('watch_is_guest') !== 'true' && (
              <button onClick={createRoom} className="create-room-hero-btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', color: '#fff', padding: '16px 32px', fontSize: '16px', borderRadius: '14px', fontWeight: 600, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(168,85,247,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <Play size={18} fill="#fff" style={{ color: '#fff' }} /> {t('createRoom', 'Create Room')}
              </button>
            )}
            <form onSubmit={handleJoin} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', overflow: 'hidden' }}>
              <input
                type="text"
                placeholder={t('enterRoomId', 'Enter Room ID...')}
                value={roomId}
                onChange={e => setRoomId(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', padding: '16px 20px', color: '#fff', fontSize: '15px', width: '220px' }}
              />
              <button type="submit" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                {t('join', 'Join')}
              </button>
            </form>
          </div>
          
          <div style={{ marginTop: '32px', fontSize: '15px' }}>
            <span style={{ color: '#888' }}>{t('lookingForParty', 'Looking for a party?')}</span>
            <button className="hero-link-btn" onClick={() => navigate('/public')} style={{ background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontWeight: 600, padding: '0 6px', textDecoration: 'underline', transition: 'color 0.2s' }}>
              {t('joinPublicRooms', 'Join public rooms')}
            </button>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="section-alt" style={{ padding: '120px 40px', width: '100%', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div className="hiw-badge" style={{ padding: '8px 24px', borderRadius: 20, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>⚡ {t('quickSetup', 'Quick Setup')}</div>
            <h2 className="section-heading" style={{ fontSize: 'clamp(32px, 6vw, 52px)', marginBottom: 20, fontWeight: 900, letterSpacing: '-1.5px' }}>{t('startInSeconds', 'Start your watch party in seconds.')}</h2>
            <p className="section-desc" style={{ fontSize: 19, color: '#94a3b8', maxWidth: 650, margin: '0 auto', lineHeight: 1.6 }}>{t('easiestWay', 'The easiest way to synchronize media with anyone on the planet.')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
            {[
              { step: 1, emoji: '🎬', title: t('createARoom', 'Create a Room'), desc: t('createRoomDesc', 'Click the Create Room button to start your own private workspace.'), color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
              { step: 2, emoji: '👥', title: t('inviteFriends', 'Invite Friends'), desc: t('inviteFriendsDesc', 'Copy the unique room link and share it via your favorite social apps.'), color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
              { step: 3, emoji: '🍿', title: t('enjoyTogether', 'Enjoy Together'), desc: t('enjoyTogetherDesc', 'Paste a link, upload a video, or share your screen. Everything stays in sync!'), color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
            ].map(s => (
              <div key={s.step} className="hiw-step-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ marginBottom: 24 }}>
                  <span className="hiw-step-num" style={{ color: s.color, fontSize: 14, fontWeight: 900, letterSpacing: 3, opacity: 0.8 }}>STEP {String(s.step).padStart(2,'0')}</span>
                </div>
                <div className="hiw-step-icon" style={{ background: s.bg, width: 90, height: 90, borderRadius: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', fontSize: 36, border: `1px solid ${s.color}20`, boxShadow: `0 10px 30px ${s.color}15` }}>
                  <span>{s.emoji}</span>
                </div>
                <h3 className="section-heading" style={{ fontSize: 24, marginBottom: 16, fontWeight: 800 }}>{s.title}</h3>
                <p className="section-desc" style={{ fontSize: 16, lineHeight: 1.7, color: '#94a3b8' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pinned Rooms */}
      {pinnedRooms.length > 0 && (
        <section style={{ padding: '80px 40px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div className="section-icon-badge">
                <Pin size={18} />
              </div>
              <h2 className="section-heading">{t('pinnedRooms', 'Pinned Rooms')} {pinnedRooms.length > 6 && <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>{pinnedRooms.length} total</span>}</h2>
            </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {pinnedRooms.slice(0, 6).map(room => (
              <div key={room.id} className="pinned-card" onClick={() => navigate(`/room/${room.id}`)}>
                <div className="img-layer">
                  <img src={room.thumbnailPath ? `${API}${room.thumbnailPath}` : `https://picsum.photos/seed/${room.id}/600/400`} alt="Room Cover" className="pinned-img"/>
                  <div className="cat-badge pinned-tag">{catMap[room.category] || '✨ Other'}</div>
                  <button className="unpin-btn" onClick={(e) => handleUnpin(e, room.id)} title={t('unpinRoom', 'Unpin Room')} style={{ right: 8, top: 8 }}>
                    <Pin className="unpin-icon" size={16} />
                  </button>
                </div>
                <div className="footer-layer">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div className="pinned-id" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, letterSpacing: '0.5px' }}>
                      <Hash size={10}/> {room.id}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: '8px', color: '#10b981', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(16,185,129,0.2)' }}>
                      <Users size={12} /> {room.userCount}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="pinned-name" style={{ margin: 0, fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>{room.name}</h3>
                    <button className="join-btn">{t('joinBtn', 'Join')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Features Grid */}
      <section id="features" className="section-alt" style={{ padding: '100px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 className="section-heading" style={{ fontSize: 36, marginBottom: 16 }}>Premium Features</h2>
            <p style={{ color: '#888', fontSize: 17 }}>Built with cutting-edge technology for the ultimate viewing experience.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {features.map(f => (
              <div key={f.title} className="feature-card"
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px ${f.color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: `${f.color}18`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: '20px' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '10px', color: '#fff' }}>{f.title}</h3>
                <p style={{ color: '#a0aab2', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 60, marginBottom: 80 }}>
            {/* Branding Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play fill="#fff" size={14} style={{ marginLeft: 2 }} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>WatchTogether</h3>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 300, color: '#6b7280', margin: 0, cursor: 'text' }}>
                Bringing people together across the digital divide. Watch, chat, and react in perfect harmony.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {[FaXTwitter, FaTelegramPlane, FaWhatsapp].map((Icon, idx) => (
                  <button key={idx} className="footer-social-btn">
                    <Icon size={18}/>
                  </button>
                ))}
              </div>
            </div>

            {/* Product Column */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 24 }}>Product</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button className="footer-link-btn" onClick={() => navigate('/public')}>Public Rooms</button>
                <button className="footer-link-btn" onClick={() => navigate('/login')}>Sign In</button>
                <button className="footer-link-btn" onClick={() => navigate('/signup')}>Get Started</button>
              </div>
            </div>

            {/* Resources Column */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 24 }}>Resources</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button className="footer-link-btn">Help Center</button>
                <button className="footer-link-btn">Release Notes</button>
                <button className="footer-link-btn">Community</button>
              </div>
            </div>

            {/* Legal Column */}
            <div>
              <h4 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 24 }}>Legal</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button className="footer-link-btn">Privacy Policy</button>
                <button className="footer-link-btn">Terms of Use</button>
                <button className="footer-link-btn">Cookies</button>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="home-footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 40, color: '#444', fontSize: 12 }}>
            <div>&copy; 2026 WatchTogether. All rights reserved.</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe size={14}/> English (International)
              </div>
            </div>
          </div>
        </div>
      </footer>

      <GlobalChatWidget ref={chatWidgetRef} isOpen={showRecentChats} onClose={() => setShowRecentChats(false)} unreadCounts={unreadCounts} onMarkRead={handleMarkRead} onNewMessage={handleNewMessage} />
    </div>
  );
};

export default Home;





