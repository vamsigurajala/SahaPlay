import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Zap, Globe, MessageSquare, Pin, Hash, Users, Lock, Share2, Mic, ChevronDown, ChevronUp, Paperclip, Heart, CornerUpLeft, Smile, Send } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import CreateRoomModal from './components/CreateRoomModal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';
import { getRoomThumbnailUrl } from './utils/avatarUtils';
import { API } from './lib/api';

const getCategoryLabel = (id, t) => {
  const emojiMap = { movies: '🎬', anime: '⛩️', songs: '🎵', gaming: '🎮', sports: '⚽', other: '✨' };
  const keyMap = { movies: 'catMovies', anime: 'catAnime', songs: 'catMusic', gaming: 'catGaming', sports: 'catSports', other: 'catOther' };
  const defaultMap = { movies: 'Movies', anime: 'Anime', songs: 'Music', gaming: 'Gaming', sports: 'Sports', other: 'Other' };
  return `${emojiMap[id] || '✨'} ${t(keyMap[id] || 'catOther', defaultMap[id] || 'Other')}`;
};

const GROUP_SCRIPT = [
  { user: 'Alex', initial: 'A', color: '#a855f7', type: 'in', text: 'This part coming up is insane 🔥', reactions: ['👍 3', '❤️ 2'] },
  { user: 'Sam', initial: 'S', color: '#10b981', type: 'in', text: "I literally can't 😂😂" },
  { user: 'Vamsi', initial: 'V', color: '#f59e0b', type: 'media', filename: 'movie_clip.mp4', size: '12.4 MB · Video' },
  { user: 'you', type: 'out', text: 'Omg the music too!! 🎵', reactions: ['❤️ 1'] },
  { user: 'Maya', initial: 'M', color: '#f472b6', type: 'in', text: 'Pause it!! Need to grab popcorn 🍿' },
];
const PRIVATE_SCRIPT = [
  { type: 'banner' },
  { user: 'Sarah', initial: 'S', color: '#6366f1', type: 'in', text: 'Did you see that ending? 😱' },
  { user: 'you', type: 'out', text: 'I had no idea that was coming!!' },
  { user: 'Sarah', initial: 'S', color: '#6366f1', type: 'image', caption: 'Screenshot I took 😂' },
  { user: 'you', type: 'out', text: 'HAHA this is the best scene' },
];

const PLATFORMS = [
  // ── Video / Streaming ──
  { name: 'YouTube',      logo: '/platforms/youtube.png' },
  { name: 'Twitch',       logo: '/platforms/Twitch.png' },
  { name: 'Netflix',      logo: '/platforms/Netflix.png' },
  { name: 'Vimeo',        logo: '/platforms/Vimeo.png' },
  { name: 'Prime Video',  logo: '/platforms/Prime.png' },
  { name: 'Apple TV',     logo: '/platforms/Appletv.png', logoDark: '/platforms/appletvblack.png' },
  { name: 'Hulu',         logo: '/platforms/hulu.png' },
  { name: 'HBO Max',      logo: '/platforms/hbomax.png', logoLight: '/platforms/hbomaxlight.png' },
  { name: 'Disney+',      logo: '/platforms/disneyhotstar.png', logoDark: '/platforms/disneyhotstarblack.png' },
  { name: 'Crunchyroll',  logo: '/platforms/crunchyroll.png' },
  { name: 'ZEE5',         logo: '/platforms/Z5.png' },
  { name: 'SonyLIV',      logo: '/platforms/sonyliv.png' },
  { name: 'Peacock TV',   logo: '/platforms/Peacocktv.png' },
  { name: 'Viki',         logo: '/platforms/Viki.png' },
  { name: 'MX Player',    logo: '/platforms/MXplayer.png' },

  // ── Music ──
  { name: 'Spotify',      logo: '/platforms/Spotify.png' },
  { name: 'Apple Music',  logo: '/platforms/Applemusic.png' },
  { name: 'SoundCloud',   logo: '/platforms/soundcloud.png' },

  // ── Social ──
  { name: 'Instagram',    logo: '/platforms/instagram.png' },
  { name: 'TikTok',       logo: '/platforms/tiktok.png' },
  { name: 'Facebook',     logo: '/platforms/facebook.png' },

  // ── Games (add your own pngs later) ──
  { name: 'Aha',          logo: '/platforms/Aha.png' },
];

const Home = () => {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('watch_token');
  const loggedInUsername = localStorage.getItem('watch_username');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  const [pinnedRooms, setPinnedRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const [activeTab, setActiveTab] = useState('group');
  const [openFaq, setOpenFaq] = useState(null);
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const chatMsgsRef = useRef(null);
  const chatSectionRef = useRef(null);
  const [chatVisible, setChatVisible] = useState(false);
 
  const fetchRooms = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      if (stored.length > 0) {
        fetch(`${API}/api/rooms/info?ids=${stored.slice(0, 6).join(',')}`)
          .then(r => r.json())
          .then(data => { if (Array.isArray(data)) setPinnedRooms(data); else setPinnedRooms([]); })
          .catch(() => { });
      } else {
        setPinnedRooms([]);
      }
    } catch (e) { }
  }, []);
 
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setChatVisible(true); },
      { threshold: 0.2 }
    );
    if (chatSectionRef.current) observer.observe(chatSectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chatVisible) return;
    const script = activeTab === 'group' ? GROUP_SCRIPT : PRIVATE_SCRIPT;
    let cancelled = false;
    let idx = 0;
    const tids = [];
    const sched = (fn, ms) => { const t = setTimeout(() => { if (!cancelled) fn(); }, ms); tids.push(t); };
    const run = () => {
      if (cancelled) return;
      if (idx >= script.length) {
        setTypingUser(null);
        return;
      }
      const msg = script[idx];
      if (msg.type === 'system' || msg.type === 'banner') {
        setVisibleMessages(p => [...p, { ...msg, _k: `${activeTab}-${idx}-${Date.now()}-${Math.random()}` }]);
        idx++;
        sched(run, 700);
        return;
      }
      if (msg.type !== 'out') setTypingUser({ user: msg.user, color: msg.color, initial: msg.initial });
      const delay = msg.text ? Math.min(900 + msg.text.length * 22, 2200) : 1200;
      sched(() => {
        setTypingUser(null);
        setVisibleMessages(p => [...p, { ...msg, _k: `${activeTab}-${idx}-${Date.now()}-${Math.random()}` }]);
        idx++;
        sched(run, 450);
      }, delay);
    };
    setVisibleMessages([]); setTypingUser(null);
    sched(run, 600);
    return () => { cancelled = true; tids.forEach(clearTimeout); };
  }, [activeTab, chatVisible]);

  useEffect(() => {
    if (chatMsgsRef.current) chatMsgsRef.current.scrollTop = chatMsgsRef.current.scrollHeight;
  }, [visibleMessages]);



  const handleUnpin = async (e, id) => {
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
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim()) { toast.error('Please enter a Room ID to join!'); return; }
    navigate(`/room/${roomId.trim()}`);
  };

  const createRoom = () => {
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (!isLoggedIn || isGuest) {
      navigate('/login');
      return;
    }
    setShowCreateModal(true);
  };

  const features = [
    { icon: <Zap size={22} />, color: '#facc15', title: t('instantSync', 'Instant Sync'), desc: t('instantSyncDesc', 'Zero-latency media synchronization powered by WebSockets.') },
    { icon: <Globe size={22} />, color: '#34d399', title: t('multiPlatform', 'Multi-Platform'), desc: t('multiPlatformDesc', 'YouTube, Twitch, Vimeo, SoundCloud, and more — all in one place.') },
    { icon: <MessageSquare size={22} />, color: '#fb923c', title: t('liveChat', 'Live Chat'), desc: t('liveChatDesc', 'Real-time chat with moderation tools, mute, kick, and ban.') },
    { icon: <Lock size={22} />, color: '#a855f7', title: t('chatLock', 'Chat Lock'), desc: t('chatLockDesc', 'End-to-end encrypted chat. Session-only key material. True privacy.') },
    { icon: <Share2 size={22} />, color: '#38bdf8', title: t('screenShare', 'Screen Share'), desc: t('screenShareDesc', 'Share your screen directly via P2P WebRTC connections.') },
    { icon: <Mic size={22} />, color: '#f472b6', title: t('voiceVideo', 'Voice & Video'), desc: t('voiceVideoDesc', 'Crystal-clear P2P audio and video with sub-100ms latency.') },
  ];


  return (
    <div className="page-enter" style={{ minHeight: '100vh' }}>
      <SeoHead path="/" />
      <Toaster position="top-center" />
      <style>{`
        /* ── Orb animations ── */
        @keyframes orbFloat1 {
          0%,100% { transform: translate(0px,0px) scale(1); }
          33%      { transform: translate(40px,-40px) scale(1.08); }
          66%      { transform: translate(-30px,25px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform: translate(0px,0px) scale(1); }
          50%      { transform: translate(-50px,30px) scale(1.1); }
        }
        @keyframes orbFloat3 {
          0%,100% { transform: translate(0px,0px) scale(1); }
          40%      { transform: translate(35px,-25px) scale(0.9); }
          80%      { transform: translate(-25px,35px) scale(1.05); }
        }
        @keyframes cardFloat {
          0%,100% { transform: perspective(1200px) rotateY(-8deg) rotateX(3deg) translateY(0px); }
          50%      { transform: perspective(1200px) rotateY(-8deg) rotateX(3deg) translateY(-14px); }
        }

        .hero-orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:0; }
        .orb-1 { width:620px;height:620px; background:radial-gradient(circle,rgba(var(--brand-1-rgb),0.45),transparent 70%); top:-220px;left:-160px; animation:orbFloat1 18s ease-in-out infinite; }
        .orb-2 { width:460px;height:460px; background:radial-gradient(circle,rgba(var(--brand-2-rgb),0.4),transparent 70%); top:30px;right:-90px; animation:orbFloat2 22s ease-in-out infinite; }
        .orb-3 { width:330px;height:330px; background:radial-gradient(circle,rgba(6,182,212,0.3),transparent 70%); bottom:-80px;left:38%; animation:orbFloat3 16s ease-in-out infinite; }
        html[data-theme='light'] .hero-orb { opacity:0.1; }

        .hero-room-card { animation:cardFloat 6s ease-in-out infinite; }

        /* ── Hero text & form ── */
        .hero-title { color:#fff; }
        html[data-theme='light'] .hero-title { color:#0f172a !important; }
        .hero-desc { color:#94a3b8; }
        html[data-theme='light'] .hero-desc { color:#475569 !important; }
        .hero-badge { display:inline-flex;align-items:center;gap:8px;background:rgba(var(--brand-1-rgb),0.1);border:1px solid rgba(var(--brand-1-rgb),0.3);border-radius:999px;padding:6px 16px;margin-bottom:32px;font-size:13px;color:var(--brand-1-light);font-weight:600; }
        html[data-theme='light'] .hero-badge { background:#fff;border-color:rgba(0,0,0,0.1);color:var(--brand-1-dark);box-shadow:0 4px 12px rgba(0,0,0,0.06);font-weight:700; }
        .hero-join-form { display:flex;align-items:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden; }
        .hero-join-btn { border:none;padding:16px 22px;font-weight:700;font-size:15px;cursor:pointer;transition:background 0.2s;background:rgba(var(--brand-1-rgb),0.2);color:var(--brand-1-light); }
        .hero-join-btn:hover { background:rgba(var(--brand-1-rgb),0.35); }
        html[data-theme='light'] .hero-join-form { background:#fff;border-color:rgba(0,0,0,0.1);box-shadow:0 2px 12px rgba(0,0,0,0.06); }
        html[data-theme='light'] .hero-join-btn { background:#f1f5f9 !important;color:var(--brand-1-dark) !important; }
        html[data-theme='light'] .hero-join-btn:hover { background:#e2e8f0 !important; }
        .hero-join-input { background:transparent;border:none;outline:none;padding:16px 20px;font-size:15px;width:200px;color:#fff; }
        html[data-theme='light'] .hero-join-input { color:#111 !important; }
        .hero-link-btn { background:none;border:none;color:var(--brand-2);cursor:pointer;font-weight:600;padding:0 4px;font-size:14px;text-decoration:none;transition:color 0.2s; }
        .hero-link-btn:hover { text-decoration:underline; }
        html[data-theme='light'] .hero-link-btn { color:var(--brand-1-dark) !important; }
        .hero-party-text { font-size:14px;color:#6b7280; }
        html[data-theme='light'] .hero-party-text { color:#64748b !important; }

        /* ── Stats bar ── */
        .stats-bar { background:rgba(255,255,255,0.015);border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05); }
        html[data-theme='light'] .stats-bar { background:#f9fafb;border-top-color:rgba(0,0,0,0.06);border-bottom-color:rgba(0,0,0,0.06); }
        .stat-sep { width:1px;height:52px;background:rgba(255,255,255,0.07);align-self:center;flex-shrink:0; }
        html[data-theme='light'] .stat-sep { background:rgba(0,0,0,0.09); }

        /* ── Steps ── */
        .step-card { flex:1 1 0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:36px 28px;position:relative;overflow:hidden;transition:transform 0.3s,box-shadow 0.3s,border-color 0.3s;z-index:1;min-width:0; }
        .step-card:hover { transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,0.4);border-color:rgba(var(--brand-1-rgb),0.3); }
        html[data-theme='light'] .step-card { background:#fff;border-color:rgba(0,0,0,0.08);box-shadow:0 4px 20px rgba(0,0,0,0.05); }
        html[data-theme='light'] .step-card:hover { box-shadow:0 16px 40px rgba(0,0,0,0.1);border-color:rgba(var(--brand-1-rgb),0.25); }
        .step-num-wm { position:absolute;top:-10px;left:10px;font-size:110px;font-weight:900;color:rgba(255,255,255,0.03);line-height:1;user-select:none;pointer-events:none;z-index:0; }
        html[data-theme='light'] .step-num-wm { color:rgba(0,0,0,0.04); }
        .step-connector { flex:0 0 52px;border-top:2px dashed rgba(var(--brand-1-rgb),0.25);align-self:center;margin-bottom:60px; }
        html[data-theme='light'] .step-connector { border-top-color:rgba(var(--brand-1-rgb),0.2); }

        /* ── Feature cards ── */
        .feat-card { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:28px;transition:transform 0.25s,box-shadow 0.25s; }
        .feat-card:hover { transform:translateY(-5px); }
        html[data-theme='light'] .feat-card { background:#fff;border-color:rgba(0,0,0,0.08);box-shadow:0 2px 12px rgba(0,0,0,0.05); }
        html[data-theme='light'] .feat-card:hover { box-shadow:0 14px 32px rgba(0,0,0,0.1); }
        .feat-title { font-size:16px;font-weight:700;margin:0 0 10px;color:#f1f5f9; }
        html[data-theme='light'] .feat-title { color:#111 !important; }
        .feat-desc { color:#9ca3af;font-size:14px;line-height:1.65;margin:0; }
        html[data-theme='light'] .feat-desc { color:#6b7280 !important; }

        /* ── Platform badges ── */
        .plat-badge { display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:13px;font-weight:700;transition:all 0.2s;white-space:nowrap;color:#cbd5e1; }
        .plat-badge:hover { background:rgba(255,255,255,0.09);transform:translateY(-2px); }
        html[data-theme='light'] .plat-badge { background:#fff;border-color:rgba(0,0,0,0.1);box-shadow:0 2px 8px rgba(0,0,0,0.05);color:#374151; }
        html[data-theme='light'] .plat-badge:hover { box-shadow:0 6px 20px rgba(0,0,0,0.1); }

        /* ── Hero card glow ── */
        .hero-glow { position:absolute;width:320px;height:320px;background:radial-gradient(ellipse at center,rgba(var(--brand-1-rgb),0.25) 0%,rgba(var(--brand-2-rgb),0.1) 40%,transparent 70%);border-radius:50%;filter:blur(40px);z-index:0;animation:glowPulse 3s ease-in-out infinite; }
        .hero-main-card { position:relative;z-index:1;width:340px;background:#0f0f1e;border-radius:16px;overflow:hidden;border:1px solid rgba(var(--brand-1-rgb),0.3);box-shadow:0 0 0 1px rgba(var(--brand-1-rgb),0.15),0 30px 60px -10px rgba(0,0,0,0.5),0 0 40px rgba(var(--brand-1-rgb),0.1),inset 0 1px 0 rgba(255,255,255,0.06);animation:heroFloat 5s ease-in-out infinite;transform-style:preserve-3d;transform:rotateY(-6deg) rotateX(3deg); }
        @keyframes liveDot { 0%,100%{opacity:1}50%{opacity:0.3} }
        .live-dot { width:6px;height:6px;border-radius:50%;background:#4eff9a;display:inline-block;animation:liveDot 1.5s ease-in-out infinite; }

        /* ── Step tags ── */
        .step-tag { display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;background:rgba(var(--brand-1-rgb),0.1);color:var(--brand-1);font-size:11px;font-weight:600;margin-top:12px; }
        html[data-theme='light'] .step-tag { color:var(--brand-1-dark);background:rgba(var(--brand-1-rgb),0.08); }

        /* ── Chat Demo section ── */
        .chat-demo-section { background:#09090b; }
        html[data-theme='light'] .chat-demo-section { background:#f8fafc !important; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .chat-window { background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;display:flex;flex-direction:column;height:380px; }
        html[data-theme='light'] .chat-window { background:#f8f7ff;border-color:rgba(0,0,0,0.1); }
        .chat-tab { padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;font-size:13px;font-weight:600;cursor:pointer;color:#9ca3af;transition:all 0.2s;font-family:inherit; }
        .chat-tab.active { background:var(--brand-1);border-color:var(--brand-1);color:#fff; }
        html[data-theme='light'] .chat-tab { border-color:rgba(0,0,0,0.12);color:#6b7280; }
        html[data-theme='light'] .chat-tab.active { background:var(--brand-1);color:#fff !important; }
        html[data-theme='light'] .chat-tab.active svg { color:#fff !important; stroke:#fff !important; }
        .chat-msgs { flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:none; }
        .chat-msgs::-webkit-scrollbar { display:none; }
        .chat-bubble-in { background:rgba(255,255,255,0.07);border-radius:10px 10px 10px 2px;padding:6px 10px;font-size:12px;color:rgba(255,255,255,0.85);max-width:220px; }
        html[data-theme='light'] .chat-bubble-in { background:rgba(0,0,0,0.06);color:#1f2937; }
        .chat-bubble-out { background:linear-gradient(135deg, var(--brand-1), var(--brand-2-dark));border-radius:10px 10px 2px 10px;padding:6px 10px;font-size:12px;color:#fff; }
        .chat-reaction { display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.08);border-radius:12px;padding:2px 7px;font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;cursor:default; }
        html[data-theme='light'] .chat-reaction { background:rgba(0,0,0,0.06);color:#6b7280; }
        .chat-system { font-size:11px;color:#6b7280;background:rgba(0,0,0,0.08);border-radius:20px;padding:4px 12px;text-align:center;margin:2px auto;max-width:280px; }
        html[data-theme='light'] .chat-system { background:rgba(0,0,0,0.04); }
        .chat-input-bar { background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px;margin:10px 14px; }
        html[data-theme='light'] .chat-input-bar { background:#fff;border-color:rgba(0,0,0,0.1); }
        .chat-send-btn { width:28px;height:28px;border-radius:50%;background:var(--brand-1);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
        .chat-reply-btn { background:none;border:none;font-size:10px;color:rgba(255,255,255,0.3);cursor:pointer;padding:2px 5px;border-radius:4px;display:inline-flex;align-items:center;gap:3px;margin-top:3px;transition:color 0.15s;font-family:inherit; }
        .chat-reply-btn:hover { color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.06); }
        html[data-theme='light'] .chat-reply-btn { color:rgba(0,0,0,0.3); }
        html[data-theme='light'] .chat-reply-btn:hover { color:rgba(0,0,0,0.65);background:rgba(0,0,0,0.05); }

        /* ── Chat light-mode overrides ── */
        html[data-theme='light'] .chat-window-header { border-bottom-color:rgba(0,0,0,0.14) !important; }
        .chat-header-title { color:#f1f5f9; }
        html[data-theme='light'] .chat-header-title { color:#111827 !important; }
        html[data-theme='light'] .chat-bubble-out { color:#fff !important; }
        .chat-avatar { color:#fff !important; }
        .chat-media-card { background:rgba(0,0,0,0.15);border-radius:10px;padding:10px;display:flex;gap:8px;align-items:center;max-width:200px; }
        html[data-theme='light'] .chat-media-card { background:rgba(0,0,0,0.07) !important; }
        .chat-media-name { font-size:12px;font-weight:600;color:#f1f5f9; }
        html[data-theme='light'] .chat-media-name { color:#1f2937 !important; }
        .chat-media-filesize { font-size:11px;color:#9ca3af; }
        html[data-theme='light'] .chat-media-filesize { color:#6b7280 !important; }
        .typing-dot { width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,0.4); }
        html[data-theme='light'] .typing-dot { background:rgba(0,0,0,0.3) !important; }
        .chat-typing-text { font-size:11px;color:rgba(255,255,255,0.4); }
        html[data-theme='light'] .chat-typing-text { color:rgba(0,0,0,0.45) !important; }

        /* ── Marquee ── */
        .marquee-section { background:#13131f; }
        html[data-theme='light'] .marquee-section { background:#f8f7ff !important; border-bottom: 1px solid rgba(0,0,0,0.05); }

        @keyframes marqueeLeft {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes marqueeRight {
          0%   { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }

        /* ── FAQ ── */
        .faq-section { background:#09090b; }
        html[data-theme='light'] .faq-section { background:#ffffff; }
        .faq-item { border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:8px;overflow:hidden;transition:border-color 0.25s; }
        html[data-theme='light'] .faq-item { border-color:rgba(0,0,0,0.1); }
        .faq-item.open { border-color:rgba(var(--brand-1-rgb),0.3); }
        .faq-q { width:100%;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;background:none;border:none;cursor:pointer;text-align:left;font-size:15px;font-weight:600;color:#f9fafb;font-family:inherit; }
        html[data-theme='light'] .faq-q { color:#111; }
        .faq-a { padding:0 20px 18px;font-size:14px;color:#9ca3af;line-height:1.75;border-top:1px solid rgba(255,255,255,0.06);padding-top:14px; }
        html[data-theme='light'] .faq-a { color:#4b5563;border-top-color:rgba(0,0,0,0.08); }

        /* ── CTA ── */
        .cta-btn { display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--brand-1-dark);border:none;padding:18px 44px;font-size:17px;font-weight:800;border-radius:16px;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 8px 24px rgba(0,0,0,0.25); }
        .cta-btn:hover { transform:scale(1.04);box-shadow:0 20px 50px rgba(0,0,0,0.4); }

        /* ── Section shared ── */
        .section-alt { width:100%;background:rgba(255,255,255,0.02); }
        html[data-theme='light'] .section-alt { background:#ffffff !important; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .section-heading { font-size:24px;font-weight:800;margin:0;color:#fff; }
        html[data-theme='light'] .section-heading { color:#000 !important; }
        .section-desc { color:#94a3b8; }
        html[data-theme='light'] .section-desc { color:#6b7280 !important; }
        .section-icon-badge { width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:#a0aab2; }
        html[data-theme='light'] .section-icon-badge { background:#fff;border-color:rgba(0,0,0,0.1);color:#111;box-shadow:0 2px 8px rgba(0,0,0,0.05); }

        /* Hero & Pinned Rooms section styling in light mode */
        html[data-theme='light'] .hero-section-pad {
          background: linear-gradient(180deg, #f0f4ff 0%, #ffffff 100%) !important;
          border-bottom: 1px solid rgba(var(--brand-1-rgb),0.08);
        }
        .pinned-rooms-section {
          position: relative;
          z-index: 10;
        }
        html[data-theme='light'] .pinned-rooms-section {
          background: #f8fafc !important;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        html[data-theme='light'] .features-section {
          background: #ffffff !important;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        /* ── Pinned grid ── */
        .pinned-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        /* ── Pinned cards ── */
        .pinned-card { border-radius:16px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:#12121a;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform 0.3s ease,box-shadow 0.3s ease,border-color 0.3s ease;display:flex;flex-direction:column;overflow:hidden; }
        .pinned-card:hover { transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,0.5);border-color:rgba(var(--brand-1-rgb),0.5); }
        .img-layer { height:130px;position:relative;overflow:hidden; }
        .pinned-img { width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease; }
        .pinned-card:hover .pinned-img { transform:scale(1.08); }
        .cat-badge { position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:6px 12px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.5px;z-index:10; }
        html[data-theme='light'] .cat-badge { color:#ffffff !important; background:rgba(0,0,0,0.6) !important; }
        .unpin-btn { position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:#fff;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);z-index:10; }
        .unpin-btn:hover { background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.4);box-shadow:0 0 20px rgba(239,68,68,0.3);transform:scale(1.1); }
        .unpin-btn .unpin-icon { transition:fill 0.3s ease;fill:none; }
        .unpin-btn:hover .unpin-icon { fill:currentColor; }
        .footer-layer { background:linear-gradient(135deg,rgba(var(--brand-1-rgb),0.12),rgba(var(--brand-2-rgb),0.12));padding:12px 16px;display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.05); }
        .join-btn { background:var(--brand-gradient);border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275); }
        .pinned-card:hover .join-btn { transform:translateY(-2px); }
        html[data-theme='light'] .pinned-card { background:#fff;border-color:rgba(var(--brand-1-rgb),0.08);box-shadow:0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 16px -6px rgba(0, 0, 0, 0.03); }
        html[data-theme='light'] .pinned-card:hover { border-color:var(--brand-1);box-shadow:0 20px 35px -5px rgba(var(--brand-1-rgb), 0.18), 0 10px 20px -10px rgba(0, 0, 0, 0.06); }

        html[data-theme='light'] .join-btn { background:var(--brand-gradient);color:#fff !important; }
        html[data-theme='light'] .footer-layer { background:#fff !important;border-top:1px solid rgba(0,0,0,0.04) !important; }
        html[data-theme='light'] .unpin-btn { background:#f1f5f9 !important;border-color:rgba(0,0,0,0.1) !important;color:#475569 !important; }
        html[data-theme='light'] .unpin-btn:hover { background:#fff !important;border-color:var(--brand-1-dark) !important;color:var(--brand-1-dark) !important; }

        /* ── Nav overrides ── */
        .nav-link-btn { background:none;border:none;font-size:14px;font-weight:700;cursor:pointer;padding:10px 18px;border-radius:14px;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);color:#94a3b8; }
        .nav-link-btn:hover { background:rgba(255,255,255,0.08);color:#fff; }
        .nav-link-btn.active { background:rgba(var(--brand-1-rgb),0.12);color:var(--brand-1-light);box-shadow:0 0 0 1px rgba(var(--brand-1-rgb),0.2); }
        html[data-theme='light'] .nav-link-btn { color:#555; }
        html[data-theme='light'] .nav-link-btn:hover { background:rgba(0,0,0,0.06);color:#111; }
        html[data-theme='light'] .nav-link-btn.active { background:rgba(var(--brand-1-rgb),0.08) !important;color:var(--brand-1-dark) !important;box-shadow:0 0 0 1px rgba(var(--brand-1-rgb),0.1); }
        .nav-icon-btn { background:rgba(255,255,255,0.05);border:none;padding:8px;border-radius:50%;cursor:pointer;transition:background 0.2s,color 0.2s;display:flex;position:relative;color:#888; }
        .nav-icon-btn:hover { background:rgba(255,255,255,0.12);color:#ccc; }
        .nav-icon-btn.active { color:var(--brand-1);border-radius:12px;background:rgba(var(--brand-1-rgb),0.12); }
        html[data-theme='light'] .nav-icon-btn.active { color:var(--brand-1) !important;background:rgba(var(--brand-1-rgb),0.1) !important; }
        html[data-theme='light'] .nav-dropdown { background:#fff !important;border-color:rgba(0,0,0,0.1) !important;box-shadow:0 16px 48px rgba(0,0,0,0.15) !important; }
        html[data-theme='light'] .nav-input { background:#f1f5f9 !important;border-color:rgba(0,0,0,0.1) !important;color:#111 !important; }
        .profile-pill { display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px 14px;font-size:14px;color:#ddd;cursor:pointer;transition:all 0.2s; }
        html[data-theme='light'] .profile-pill { background:rgba(0,0,0,0.04) !important;border-color:rgba(0,0,0,0.08) !important;color:#111 !important; }
        html[data-theme='light'] .profile-pill:hover { background:rgba(0,0,0,0.08) !important; }

        /* ── Create room modal ── */
        .cr-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:10000;overflow-y:auto;padding:40px 16px;animation:fadeIn 0.2s ease;overscroll-behavior:contain; }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        .cr-modal { background:#13131f;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:32px;width:100%;max-width:480px;margin:0 auto;box-shadow:0 32px 80px rgba(0,0,0,0.8);animation:slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1);position:relative; }
        @keyframes slideUp { from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1} }
        .cr-close-btn { position:absolute;top:0;right:-56px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:50%;width:44px;height:44px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;padding-bottom:2px;transition:all 0.2s; }
        .cr-close-btn:hover { background:rgba(255,255,255,0.2);transform:scale(1.1); }
        @media(max-width:600px){.cr-close-btn{top:-56px;right:0}}
        .cr-input { width:100%;padding:12px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:#fff;font-size:15px;outline:none;transition:border-color 0.2s;box-sizing:border-box; }
        .cr-input:focus { border-color:rgba(var(--brand-1-rgb),0.6); }
        .cr-input option { background:#1a1a2e; }
        .cr-cat-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px; }
        .cr-cat-btn { padding:10px 6px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#aaa;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;text-align:center; }
        .cr-cat-btn:hover { border-color:rgba(var(--brand-1-rgb),0.4);color:#fff; }
        .cr-cat-btn.active { background:rgba(var(--brand-1-rgb),0.2);border-color:rgba(var(--brand-1-rgb),0.6);color:var(--brand-1-light); }
        .cr-toggle-row { display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:border-color 0.2s; }
        .cr-toggle-row:hover { border-color:rgba(var(--brand-1-rgb),0.3); }
        .cr-toggle-track { width:42px;height:24px;border-radius:999px;transition:background 0.3s;position:relative;flex-shrink:0; }
        .cr-toggle-thumb { position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.3s; }
        .cr-launch-btn { width:100%;padding:14px;border-radius:14px;border:none;background:var(--brand-gradient);color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;letter-spacing:0.3px; }
        .cr-launch-btn:hover { transform:scale(1.02);box-shadow:0 8px 24px rgba(var(--brand-2-rgb),0.45); }
        .cr-copy-btn { margin-left:auto;flex-shrink:0;background:rgba(var(--brand-1-rgb),0.15);border:1px solid rgba(var(--brand-1-rgb),0.3);color:var(--brand-1-light);padding:4px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:0.5px;transition:all 0.2s; }
        .cr-copy-btn:hover { background:rgba(var(--brand-1-rgb),0.3); }
        .cr-copy-btn.copied { background:rgba(16,185,129,0.2);border-color:rgba(16,185,129,0.4);color:#34d399; }
        html[data-theme='light'] .cr-overlay { background:rgba(0,0,0,0.4);backdrop-filter:blur(4px); }
        html[data-theme='light'] .cr-modal { background:#ffffff;border-color:rgba(0,0,0,0.1);box-shadow:0 32px 80px rgba(0,0,0,0.15); }
        html[data-theme='light'] .cr-modal h2 { color:#0f172a !important; }
        html[data-theme='light'] .cr-modal p { color:#334155 !important; }
        html[data-theme='light'] .cr-modal label { color:#1e293b !important;font-weight:800 !important; }
        html[data-theme='light'] .cr-input { background:#f8fafc;border-color:#e2e8f0;color:#0f172a; }
        html[data-theme='light'] .cr-input:focus { border-color:var(--brand-1);background:#fff; }
        html[data-theme='light'] .cr-cat-btn { background:#f1f5f9;border-color:#e2e8f0;color:#334155; }
        html[data-theme='light'] .cr-cat-btn:hover { border-color:var(--brand-1);color:var(--brand-1); }
        html[data-theme='light'] .cr-cat-btn.active { background:rgba(var(--brand-1-rgb),0.1);border-color:var(--brand-1);color:var(--brand-1-dark); }
        html[data-theme='light'] .cr-toggle-row { background:#f8fafc;border-color:#e2e8f0; }
        html[data-theme='light'] .cr-toggle-row .toggle-label { color:#0f172a !important; }
        html[data-theme='light'] .cr-toggle-row .toggle-desc { color:#334155 !important; }
        html[data-theme='light'] .cr-copy-btn { background:#f1f5f9;border-color:#cbd5e1;color:var(--brand-1-dark); }
        html[data-theme='light'] .cr-copy-btn:hover { background:#e2e8f0; }
        html[data-theme='light'] .cr-close-btn { background:#f1f5f9;border-color:#e2e8f0;color:#64748b; }
        html[data-theme='light'] .cr-close-btn:hover { background:#e2e8f0;color:#1e293b; }
        html[data-theme='light'] .create-room-hero-btn { color:#fff !important;-webkit-text-fill-color:#fff !important; }
        html[data-theme='light'] .create-room-hero-btn span { color:#fff !important;-webkit-text-fill-color:#fff !important; }
        html[data-theme='light'] .create-room-hero-btn svg { color:#fff !important;fill:#fff !important;stroke:none !important; }
        html[data-theme='light'] .cr-launch-btn { box-shadow:none !important;color:#fff !important; }
        html[data-theme='light'] .cr-launch-btn:hover { box-shadow:none !important; }

        /* ── Responsive ── */
        @media(max-width:960px){
          .hero-split{flex-direction:column !important;align-items:center !important;text-align:center !important;}
          .hero-card-wrapper{display:none !important;}
          .hero-ctas{justify-content:center !important;}
          .steps-row{flex-direction:column !important;align-items:stretch !important;}
          .step-card{flex:none !important;width:100% !important;margin-bottom:24px;}
          .step-card:last-child{margin-bottom:0;}
          .step-connector{display:none !important;}
          .feat-grid{grid-template-columns:1fr 1fr !important;}
          .pinned-grid{grid-template-columns:repeat(2, 1fr) !important; gap:12px !important;}
        }
        @media(max-width:640px){
          .feat-grid{grid-template-columns:1fr !important;}
          .stats-row{flex-wrap:wrap !important;justify-content:center !important;}
          .stat-sep{display:none !important;}
          .plats-row{flex-wrap:wrap !important;justify-content:center !important;}
          .pinned-grid{grid-template-columns:repeat(2, 1fr) !important; gap:12px !important;}
          /* hero */
          .hero-section-pad{ padding: 72px 16px 60px !important; }
          /* hero join form — stack on tiny screens */
          .hero-join-form{ flex-direction:column !important; border-radius:12px !important; }
          .hero-join-input{ width:100% !important; padding:14px 16px !important; border-bottom:1px solid rgba(255,255,255,0.08); }
          .hero-join-btn{ width:100% !important; padding:14px !important; justify-content:center !important; text-align:center; }
          /* sections */
          .home-section-pad{ padding-left:16px !important; padding-right:16px !important; }
          .chat-demo-inner{ flex-direction:column !important; gap:32px !important; }
          /* faq */
          .faq-q{ font-size:14px !important; padding:14px 16px !important; }
        }
      `}</style>

      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} loggedInUsername={loggedInUsername} />
      <Navbar />

      {/* ─── SECTION 1: HERO ─── */}
      <section className="hero-section-pad" style={{ position: 'relative', padding: '100px 40px 80px', overflow: 'hidden' }}>
        <div className="hero-orb orb-1" />
        <div className="hero-orb orb-2" />
        <div className="hero-orb orb-3" />

        <div className="hero-split" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 60, position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div className="hero-badge">
              <Zap size={13} fill="currentColor" /> {t('zeroLatency', 'Zero-latency synchronization')}
            </div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(44px,7vw,80px)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 24px', letterSpacing: '-2px' }}>
              {t('watchWithFriends', 'WATCH WITH FRIENDS.')}
              <br />
              <span style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('anywhere', 'ANYWHERE.')}</span>
            </h1>
            <p className="hero-desc" style={{ fontSize: 18, lineHeight: 1.65, maxWidth: 500, margin: '0 0 40px' }}>
              {t('heroMainDesc', 'Synchronize YouTube, Twitch, and more with friends in real time. Live chat, P2P screen sharing, and perfect media sync — 100% free.')}{' '}
              <Link to="/pricing" className="hero-link-btn">Compare plans →</Link>
            </p>
            <div className="hero-ctas" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 24 }}>
              <button onClick={createRoom} className="create-room-hero-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--brand-gradient)', border: 'none', color: '#fff', padding: '16px 32px', fontSize: 16, borderRadius: 14, fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(var(--brand-2-rgb),0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <Play size={18} fill="#fff" strokeWidth={0} /><span className="stay-white">{t('createRoom', 'Create Room')}</span>
              </button>
              <form onSubmit={handleJoin} className="hero-join-form">
                <input type="text" placeholder={t('enterRoomId', 'Enter Room ID...')} value={roomId} onChange={e => setRoomId(e.target.value)} className="hero-join-input" />
                <button type="submit" className="hero-join-btn">{t('join', 'Join')}</button>
              </form>
            </div>
            <div>
              <span className="hero-party-text">{t('lookingForRoom', 'Looking for a room?')} </span>
              <button className="hero-link-btn" onClick={() => navigate('/public')}>{t('browsePublicRooms', 'Browse public rooms')}</button>
            </div>
          </div>

          {/* Right: clean single 3D app window */}
          <div className="hero-card-wrapper" style={{ flex: '0 0 auto', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Soft ambient glow */}
            <div style={{ position:'absolute',inset:-40,background:'radial-gradient(ellipse at 55% 50%,rgba(var(--brand-1-rgb),0.26) 0%,rgba(var(--brand-2-rgb),0.12) 45%,transparent 70%)',filter:'blur(40px)',borderRadius:'50%',pointerEvents:'none' }} />

            {/* ── The single rectangle card ── */}
            <div style={{ position:'relative',zIndex:1,width:500,borderRadius:16,overflow:'hidden',background:'#0e0e20',border:'1px solid rgba(var(--brand-1-rgb),0.3)',boxShadow:'0 0 0 1px rgba(var(--brand-1-rgb),0.1),0 28px 70px -8px rgba(0,0,0,0.75),inset 0 1px 0 rgba(255,255,255,0.05)',transform:'perspective(1000px) rotateY(-10deg) rotateX(4deg)',animation:'cardFloat 6s ease-in-out infinite' }}>

              {/* Title bar */}
              <div style={{ height:40,background:'#12122a',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px' }}>
                <div style={{ display:'flex',gap:6 }}>
                  {['#ff5f57','#ffbd2e','#28c840'].map((c,i)=>(<div key={`dot-${i}`} style={{ width:10,height:10,borderRadius:'50%',background:c }} />))}
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ fontSize:12,color:'rgba(255,255,255,0.5)',fontWeight:600 }}>🎬 Movie Night</span>
                  <div style={{ display:'flex' }}>
                    {[['#6366f1','A'],['#a855f7','S'],['#10b981','V'],['#f59e0b','K']].map(([bg,l],i)=>(
                      <div key={`avatar-${i}`} style={{ width:20,height:20,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'#fff',fontWeight:800,marginLeft:i===0?0:-6,border:'1.5px solid #12122a' }}>{l}</div>
                    ))}
                    <span style={{ fontSize:10,color:'rgba(255,255,255,0.35)',marginLeft:5,alignSelf:'center' }}>+9</span>
                  </div>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                  <span style={{ width:6,height:6,borderRadius:'50%',background:'#4eff9a',display:'inline-block',animation:'liveDot 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize:10,color:'#4eff9a',fontWeight:700,letterSpacing:0.5 }}>LIVE</span>
                </div>
              </div>

              {/* Body */}
              <div style={{ display:'flex',height:330 }}>

                {/* LEFT: video */}
                <div style={{ flex:'0 0 56%',position:'relative',overflow:'hidden',background:'linear-gradient(135deg,#0c0c22 0%,#16103a 50%,#0c1830 100%)',display:'flex',alignItems:'center',justifyContent:'center',borderRight:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ position:'absolute',inset:0,opacity:0.035,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.7) 2px,rgba(255,255,255,0.7) 3px)',pointerEvents:'none' }} />
                  <div style={{ position:'absolute',width:160,height:160,background:'radial-gradient(circle,rgba(var(--brand-1-rgb),0.22) 0%,transparent 70%)',borderRadius:'50%',filter:'blur(20px)' }} />
                  <div style={{ width:52,height:52,borderRadius:'50%',background:'rgba(var(--brand-1-rgb),0.9)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 13px rgba(var(--brand-1-rgb),0.12),0 0 44px rgba(var(--brand-1-rgb),0.45)',position:'relative',zIndex:1 }}>
                    <Play fill="#fff" size={21} style={{ marginLeft:3 }} />
                  </div>
                  <div style={{ position:'absolute',top:10,left:12,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)',borderRadius:6,padding:'3px 8px',fontSize:10,color:'rgba(255,255,255,0.55)',fontWeight:600 }}>🎮 Gaming Room</div>
                  <div style={{ position:'absolute',bottom:0,left:0,right:0 }}>
                    <div style={{ padding:'0 12px 5px',display:'flex',justifyContent:'space-between' }}>
                      <span style={{ fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:600 }}>01:26</span>
                      <span style={{ fontSize:10,color:'rgba(255,255,255,0.25)' }}>03:48</span>
                    </div>
                    <div style={{ height:3,background:'rgba(255,255,255,0.07)' }}><div className="scene-progress-fill" /></div>
                  </div>
                </div>

                {/* RIGHT: chat */}
                <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden' }}>
                  {/* Tab bar */}
                  <div style={{ height:34,borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:4,padding:'0 10px' }}>
                    {[['Group',true],['Private',false]].map(([label,active],i)=>(
                      <div key={`mockup-tab-${i}`} style={{ padding:'3px 9px',borderRadius:5,fontSize:11,fontWeight:700,cursor:'default',background:active?'rgba(var(--brand-1-rgb),0.2)':'transparent',color:active?'var(--brand-1-light)':'rgba(255,255,255,0.3)',border:active?'1px solid rgba(var(--brand-1-rgb),0.3)':'1px solid transparent' }}>{label}</div>
                    ))}
                  </div>
                  {/* Messages */}
                  <div style={{ flex:1,padding:'8px 10px 4px',display:'flex',flexDirection:'column',gap:7,overflow:'hidden' }}>
                    <div style={{ display:'flex',gap:6,alignItems:'flex-start' }}>
                      <div style={{ width:22,height:22,borderRadius:'50%',background:'#6366f1',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:800,marginTop:1 }}>A</div>
                      <div><div style={{ fontSize:9,color:'rgba(255,255,255,0.3)',marginBottom:2,fontWeight:600 }}>Alex</div><div className="chat-bubble-in" style={{ fontSize:11 }}>This scene is insane 🔥</div></div>
                    </div>
                    <div style={{ display:'flex',justifyContent:'flex-end' }}>
                      <div className="chat-bubble-out" style={{ fontSize:11 }}>Who picked this? 😂</div>
                    </div>
                    <div style={{ display:'flex',gap:6,alignItems:'flex-start' }}>
                      <div style={{ width:22,height:22,borderRadius:'50%',background:'#a855f7',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:800,marginTop:1 }}>S</div>
                      <div><div style={{ fontSize:9,color:'rgba(255,255,255,0.3)',marginBottom:2,fontWeight:600 }}>Sam</div><div className="chat-bubble-in" style={{ fontSize:11 }}>omg I know!! 😭</div></div>
                    </div>
                    <div style={{ display:'flex',gap:6,alignItems:'flex-start' }}>
                      <div style={{ width:22,height:22,borderRadius:'50%',background:'#f472b6',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',fontWeight:800,marginTop:1 }}>M</div>
                      <div><div style={{ fontSize:9,color:'rgba(255,255,255,0.3)',marginBottom:2,fontWeight:600 }}>Maya</div><div className="chat-bubble-in" style={{ fontSize:11 }}>Pause!! grabbing 🍿</div></div>
                    </div>
                    <div style={{ display:'flex',justifyContent:'flex-end' }}>
                      <div className="chat-bubble-out" style={{ fontSize:11 }}>haha everyone hungry 😂</div>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                      {[0,0.2,0.4].map((d,i)=>(<div key={`mockup-typing-${i}`} style={{ width:3,height:3,borderRadius:'50%',background:'rgba(255,255,255,0.3)',animation:`typingBounce 1.2s ease ${d}s infinite` }} />))}
                      <span style={{ fontSize:9,color:'rgba(255,255,255,0.25)' }}>Sam is typing…</span>
                    </div>
                  </div>
                  {/* Input */}
                  <div style={{ margin:'0 8px 8px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'6px 10px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                    <span style={{ fontSize:11,color:'rgba(255,255,255,0.18)' }}>Message…</span>
                    <div style={{ width:22,height:22,borderRadius:'50%',background:'var(--brand-gradient)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <Send size={10} color="#fff" style={{ marginLeft:1 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
           </div>
      </section>

      {/* ─── PINNED ROOMS (if any) ─── */}

      {(isLoggedIn || isGuest) && pinnedRooms && pinnedRooms.length > 0 && (
        <section className="pinned-rooms-section home-section-pad" style={{ padding: '80px 40px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div className="section-icon-badge"><Pin size={18} /></div>
              <h2 className="section-heading">{t('pinnedRooms', 'Pinned Rooms')}</h2>
            </div>
            <div className="pinned-grid" style={{ display: 'grid', gap: 20 }}>
              {pinnedRooms.slice(0, 6).map(room => (
                <div key={room.id} className="pinned-card" onClick={() => navigate(`/room/${room.id}`)}>
                  <div className="img-layer">
                    <img src={getRoomThumbnailUrl(room.thumbnailPath) || `https://picsum.photos/seed/${room.id}/600/400`} alt={t('roomCover', 'Room Cover')} className="pinned-img" />
                    <div className="cat-badge">{getCategoryLabel(room.category, t)}</div>
                    <button className="unpin-btn" onClick={(e) => handleUnpin(e, room.id)} title="Unpin Room">
                      <Pin className="unpin-icon" size={16} />
                    </button>
                  </div>
                  <div className="footer-layer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, letterSpacing: '0.5px', color: '#6b7280' }}>
                        <Hash size={10} /> {room.id}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: 8, color: '#10b981', fontSize: 11, fontWeight: 600, border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Users size={12} /> {room.userCount}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{room.name}</h3>
                      <button className="join-btn">{t('join', 'Join')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── SECTION 3: HOW IT WORKS ─── */}
      <section className="section-alt home-section-pad" id="how-it-works" style={{ padding: '100px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="hero-badge" style={{ marginBottom: 20 }}>⚡ {t('quickSetup', 'Quick Setup')}</div>
            <h2 className="section-heading" style={{ fontSize: 'clamp(28px,5vw,48px)', letterSpacing: '-1px' }}>{t('threeStepsSubtitle', "Three steps. That's it.")}</h2>
            <p className="section-desc" style={{ fontSize: 17, marginTop: 16, maxWidth: 520, margin: '16px auto 0', lineHeight: 1.6 }}>
              {t('threeStepsNoSignup', 'No signup needed for guests. No downloads. No plugins. Just watch.')}{' '}
              <Link to="/how-it-works" className="hero-link-btn">See exactly how it works →</Link>
            </p>
          </div>
          <div className="steps-row" style={{ display: 'flex', alignItems: 'stretch', gap: 0, position: 'relative' }}>
            {[
              { n: '01', emoji: '🎬', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', title: t('createARoom', 'Create a Room'), desc: t('step1HomeDesc', 'Click Create Room. Your private watch space is ready in under a second with a unique shareable link.'), tag: t('step1HomeTag', '⚡ Ready instantly') },
              { n: '02', emoji: '👥', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', title: t('inviteFriends', 'Invite Friends'), desc: t('step2HomeDesc', 'Share your room link. Friends join in one click — no account, no app, no hassle.'), tag: t('step2HomeTag', '🔗 One click to join') },
              { n: '03', emoji: '🍿', color: '#10b981', bg: 'rgba(16,185,129,0.12)', title: t('watchSeamlessly', 'Watch Together'), desc: t('step3HomeDesc', 'Paste any video link or screenshare. Every play, pause, and seek syncs to everyone instantly.'), tag: t('step3HomeTag', '🎬 Always in sync') },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="step-card" style={{ transition: 'all 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px) scale(1.01)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(var(--brand-1-rgb),0.15)'; e.currentTarget.style.borderColor = 'rgba(var(--brand-1-rgb),0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = ''; }}
                >
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 26, background: s.bg, border: `1px solid ${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24, boxShadow: `0 10px 30px ${s.color}15` }}>
                      {s.emoji}
                    </div>
                    <h3 className="section-heading" style={{ fontSize: 22, marginBottom: 14, fontWeight: 800 }}>{s.title}</h3>
                    <p className="section-desc" style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 260 }}>{s.desc}</p>
                    <span className="step-tag">{s.tag}</span>
                  </div>
                </div>
                {i < 2 && <div className="step-connector" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      <section ref={chatSectionRef} className="chat-demo-section home-section-pad" style={{ padding: '100px 40px' }}>
        <style>{`
          @media (max-width: 900px) {
            .chat-demo-section { padding: 28px 16px !important; }
            .chat-demo-section .section-header-container { margin-bottom: 24px !important; }
            .chat-demo-inner { flex-direction: column !important; gap: 24px !important; }
            .chat-demo-inner > div { flex: 1 1 100% !important; min-width: 0 !important; width: 100% !important; }
            .chat-tab {
              flex: 1 !important;
              justify-content: center !important;
              padding: 8px 10px !important;
              font-size: 12px !important;
            }
          }
        `}</style>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-header-container" style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 className="section-heading" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, marginBottom: 14 }}>{t('seeItInActionTitle', 'See It in Action')}</h2>
            <p className="section-desc" style={{ fontSize: 17, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>{t('seeItInActionDesc', 'Real-time chat that feels alive — reactions, media, replies, all in sync.')}</p>
          </div>
          <div className="chat-demo-inner" style={{ display: 'flex', gap: 60, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* LEFT: interactive chat demo */}
            <div style={{ flex: '1 1 380px', minWidth: 0 }}>
              {/* Tab row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className={`chat-tab${activeTab === 'group' ? ' active' : ''}`} onClick={() => setActiveTab('group')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MessageSquare size={13} /> {t('groupChat', 'Group Chat')}</button>
                <button className={`chat-tab${activeTab === 'private' ? ' active' : ''}`} onClick={() => setActiveTab('private')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} /> {t('privateChat', 'Private Chat')}</button>
              </div>
              {/* Chat window */}
              <div className="chat-window">
                {/* Header */}
                <div className="chat-window-header" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="chat-header-title" style={{ fontSize: 14, fontWeight: 700 }}>{activeTab === 'group' ? '🎬 Movie Night Room' : '🔒 Sarah (Private)'}</span>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{activeTab === 'group' ? '● 3 watching' : '● Online'}</span>
                </div>
                {/* Messages */}
                <div className="chat-msgs" ref={chatMsgsRef}>
                  {visibleMessages.map((msg) => (
                    <div key={msg._k}>
                      {msg.type === 'banner' && (
                        <div style={{ background: 'rgba(var(--brand-1-rgb),0.08)', border: '1px solid rgba(var(--brand-1-rgb),0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 4, fontSize: 12, color: 'var(--brand-1-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lock size={12} /> End-to-end encrypted — only you two can read this
                        </div>
                      )}
                      {msg.type === 'system' && <div className="chat-system">{msg.text}</div>}
                      {msg.type === 'out' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <div>
                            <div className="chat-bubble-out" style={{ maxWidth: 220 }}>{msg.text}</div>
                            {msg.reactions && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 5 }}>
                                {msg.reactions.map(r => <span key={r} className="chat-reaction">{r}</span>)}
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button className="chat-reply-btn"><CornerUpLeft size={9} /> Reply</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {(msg.type === 'in' || msg.type === 'media' || msg.type === 'image') && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div className="chat-avatar" style={{ width: 28, height: 28, borderRadius: '50%', background: msg.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{msg.initial}</div>
                          <div>
                            <div style={{ fontSize: 11, marginBottom: 4 }}><span style={{ color: msg.color, fontWeight: 700 }}>{msg.user}</span></div>
                            {msg.type === 'in' && (
                              <>
                                <div className="chat-bubble-in">{msg.text}</div>
                                {msg.reactions && (
                                  <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                                    {msg.reactions.map(r => <span key={r} className="chat-reaction">{r}</span>)}
                                  </div>
                                )}
                                <button className="chat-reply-btn"><CornerUpLeft size={9} /> Reply</button>
                              </>
                            )}
                            {msg.type === 'media' && (
                              <>
                                <div className="chat-media-card">
                                  <Paperclip size={18} color="#9ca3af" />
                                  <div>
                                    <div className="chat-media-name">{msg.filename}</div>
                                    <div className="chat-media-filesize">{msg.size}</div>
                                  </div>
                                </div>
                                <button className="chat-reply-btn"><CornerUpLeft size={9} /> Reply</button>
                              </>
                            )}
                            {msg.type === 'image' && (
                              <>
                                <svg width="160" height="90" viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 10, display: 'block' }}>
                                  <defs>
                                    <linearGradient id="animesky" x1="0%" y1="0%" x2="0%" y2="100%">
                                      <stop offset="0%" stopColor="#0f0c29" />
                                      <stop offset="55%" stopColor="#c0392b" />
                                      <stop offset="100%" stopColor="#f5af19" />
                                    </linearGradient>
                                  </defs>
                                  <rect width="160" height="90" fill="url(#animesky)" />
                                  <circle cx="80" cy="52" r="18" fill="#ffeaa0" opacity="0.92" />
                                  <ellipse cx="20" cy="95" rx="50" ry="22" fill="#0a0a1a" />
                                  <ellipse cx="140" cy="95" rx="50" ry="22" fill="#0a0a1a" />
                                  <circle cx="18" cy="12" r="1" fill="white" opacity="0.85" />
                                  <circle cx="48" cy="6" r="1.2" fill="white" opacity="0.7" />
                                  <circle cx="118" cy="10" r="1.5" fill="white" opacity="0.9" />
                                  <circle cx="148" cy="18" r="1" fill="white" opacity="0.75" />
                                  <circle cx="135" cy="5" r="0.8" fill="white" opacity="0.6" />
                                  <rect x="3" y="66" width="5" height="24" fill="#0a0a1a" />
                                  <polygon points="5.5,50 -2,66 13,66" fill="#0a0a1a" />
                                  <rect x="150" y="63" width="5" height="24" fill="#0a0a1a" />
                                  <polygon points="152.5,47 145,63 160,63" fill="#0a0a1a" />
                                  <path d="M0,72 Q40,60 80,68 Q120,76 160,65 L160,90 L0,90 Z" fill="#0a0a1a" opacity="0.6" />
                                </svg>
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{msg.caption}</div>
                                <button className="chat-reply-btn"><CornerUpLeft size={9} /> Reply</button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {typingUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                      <div className="chat-avatar" style={{ width: 22, height: 22, borderRadius: '50%', background: typingUser.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{typingUser.initial}</div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[0, 0.2, 0.4].map((d, i) => (
                          <div key={`typing-dot-${i}`} className="typing-dot" style={{ animation: `typingBounce 1.2s ease ${d}s infinite` }} />
                        ))}
                      </div>
                      <span className="chat-typing-text">{typingUser.user} is typing...</span>
                    </div>
                  )}
                </div>
                {/* Input bar */}
                <div className="chat-input-bar">
                  <Smile size={16} style={{ cursor: 'pointer', flexShrink: 0, color: '#9ca3af' }} />
                  <Paperclip size={16} style={{ cursor: 'pointer', flexShrink: 0, color: '#9ca3af' }} />
                  <span style={{ flex: 1, fontSize: 13, color: '#6b7280' }}>{activeTab === 'group' ? 'Message the room...' : 'Private message...'}</span>
                  <button className="chat-send-btn"><Send size={13} color="#fff" /></button>
                </div>
              </div>
            </div>
            {/* RIGHT: feature highlights */}
            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
              {[
                { icon: <MessageSquare size={22} color="#6366f1" />, bg: 'rgba(99,102,241,0.1)', title: t('groupRoomChatTitle', 'Group Room Chat'), body: t('groupRoomChatDesc', 'Everyone in the room chats together in real time with emoji reactions, replies, and media sharing.') },
                { icon: <Lock size={22} color="#6366f1" />, bg: 'rgba(99,102,241,0.1)', title: t('privateEncryptedDMsTitle', 'Private Encrypted DMs'), body: t('privateEncryptedDMsDesc', 'Send private messages to anyone in the room. End-to-end encrypted — nobody else can read them.') },
                { icon: <Paperclip size={22} color="#14b8a6" />, bg: 'rgba(20,184,166,0.1)', title: t('shareMediaFilesTitle', 'Share Media & Files'), body: t('shareMediaFilesDesc', 'Send images, videos, and files directly in chat without leaving the room.') },
                { icon: <Heart size={22} color="#ef4444" />, bg: 'rgba(239,68,68,0.1)', title: t('reactToMessagesTitle', 'React to Messages'), body: t('reactToMessagesDesc', 'Emoji reactions on any message. Express yourself beyond words.') },
                { icon: <CornerUpLeft size={22} color="#f59e0b" />, bg: 'rgba(245,158,11,0.1)', title: t('replyToMessagesTitle', 'Reply to Messages'), body: t('replyToMessagesDesc', 'Quote and reply to specific messages to keep conversations clear.') },
              ].map(f => (
                <div key={f.title} style={{ display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{f.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }} className="feat-title">{f.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6 }} className="feat-desc">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: FEATURES (6 cards, 2 rows × 3) ─── */}
      <section className="features-section home-section-pad" style={{ padding: '100px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 className="section-heading" style={{ fontSize: 'clamp(28px,5vw,46px)', letterSpacing: '-1px', marginBottom: 14 }}>{t('everythingYouNeedTitle', 'Everything you need to watch together.')}</h2>
            <p className="section-desc" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
              {t('cuttingEdgeDesc', 'Built with cutting-edge technology for the ultimate viewing experience.')}{' '}
              <Link to="/features" className="hero-link-btn">See the full feature list →</Link>
            </p>
          </div>
          <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {features.map(f => (
              <div key={f.title} className="feat-card" style={{ borderTop: `3px solid ${f.color}` }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px ${f.color}25`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${f.color}18`, border: `1px solid ${f.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: 18 }}>
                  {f.icon}
                </div>
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: PLATFORMS MARQUEE ─── */}
      <section className="marquee-section" style={{ padding: '80px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 48, padding: '0 40px' }}>
          <h2 className="section-heading" style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, marginBottom: 12 }}>
            {t('worksWithFavoritesTitle', 'Works With Your Favorites')}
          </h2>
          <p className="section-desc" style={{ fontSize: 16 }}>
            {t('worksWithFavoritesDesc', 'Paste any link and start watching — no extra setup needed.')}
          </p>
        </div>

        {/* Row 1 — scrolls left */}
        <div style={{
          overflow: 'hidden',
          width: '100%',
          marginBottom: 0,
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        }}>
          <div
            style={{
              display: 'flex',
              gap: 56,
              width: 'max-content',
              alignItems: 'center',
              animation: 'marqueeLeft 28s linear infinite',
              padding: '10px 28px',
            }}
            onMouseEnter={e => e.currentTarget.style.animationPlayState = 'paused'}
            onMouseLeave={e => e.currentTarget.style.animationPlayState = 'running'}
          >
            {[...PLATFORMS, ...PLATFORMS, ...PLATFORMS].map((p, i) => (
              <img
                key={`r1-${i}`}
                src={isLight ? (p.logoLight || p.logo) : (p.logoDark || p.logo)}
                alt={p.name}
                title={p.name}
                style={{
                  height: 44,
                  width: 'auto',
                  maxWidth: 80,
                  objectFit: 'contain',
                  display: 'block',
                  flexShrink: 0,
                  opacity: 0.38,
                  filter: 'grayscale(15%)',
                  transition: 'opacity 0.2s ease, filter 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.filter = 'grayscale(0%) brightness(1.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0.38';
                  e.currentTarget.style.filter = 'grayscale(15%)';
                }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 7: FAQ ─── */}
      <section className="faq-section home-section-pad" style={{ padding: '100px 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 className="section-heading" style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 800, marginBottom: 12 }}>{t('faqSectionTitle', 'Frequently Asked Questions')}</h2>
            <p className="section-desc" style={{ fontSize: 16 }}>{t('faqSectionDesc', 'Everything you need to know before you start.')}</p>
          </div>
          {[
            { q: t('homeFaqQ1', 'How many languages does SahaPlay support?'), a: t('homeFaqA1', 'SahaPlay currently supports 20 languages: English, Spanish, French, German, Japanese, Korean, Chinese, Hindi, Portuguese, Arabic, Russian, Italian, Telugu, Tamil, Bengali, Marathi, Gujarati, Malayalam, Kannada, and Punjabi. You can change your language anytime from the Settings menu.') },
            { q: t('homeFaqQ2', "Can I hide other people's videos when streaming in a room?"), a: t('homeFaqA2', 'Yes! When you are in a room and another member has their camera turned on, you can hide or unhide their video at any time. Simply click on their video feed and select "Hide Video". This only affects your own view — others in the room are not affected.') },
            { q: t('homeFaqQ3', 'Can I watch Netflix or Prime Video with friends?'), a: t('homeFaqA3', 'Yes — using the Screenshare feature. The host shares their Netflix or Prime Video browser tab and everyone in the room sees it in real time. Only the host needs a subscription to those services. Screenshare works best in Chrome browser.') },
            { q: t('homeFaqQ4', 'What happens if my internet drops during a watch party?'), a: t('homeFaqA4', 'SahaPlay automatically tries to reconnect you to the room. Once you are back online, it jumps you to exactly where the video is currently playing — so you never miss anything. Your chat history also reloads automatically.') },
          ].map((item, i) => (
            <div key={`faq-${i}`} style={{
              marginBottom: 8,
              border: `1px solid ${openFaq === i ? 'rgba(var(--brand-1-rgb),0.35)' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')}`,
              borderLeft: openFaq === i ? '4px solid var(--brand-1)' : `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              background: openFaq === i ? (isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(var(--brand-1-rgb),0.08)') : (isLight ? '#ffffff' : '#1e1e30'),
              overflow: 'hidden',
              transition: 'border-color 0.2s, background 0.2s',
            }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16, fontFamily: 'inherit' }}
              >
                <span style={{ fontWeight: 700, fontSize: 16, color: isLight ? '#111827' : '#f9fafb' }}>{item.q}</span>
                {openFaq === i
                  ? <ChevronUp size={18} color="var(--brand-1)" style={{ flexShrink: 0 }} />
                  : <ChevronDown size={18} color={isLight ? '#6b7280' : '#9ca3af'} style={{ flexShrink: 0 }} />
                }
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 24px 18px', color: isLight ? '#374151' : '#9ca3af', lineHeight: 1.75, fontSize: 14 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
