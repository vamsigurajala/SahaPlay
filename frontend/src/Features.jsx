import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Zap, Globe, MessageSquare, Play, ArrowRight, Lock, Shield, Users,
  Smartphone, Moon, RefreshCw, Tv, Compass, Bell, Monitor, FolderOpen,
  Activity, Check, X, Crown, ShieldAlert, Sparkles, Send, Volume2, ShieldCheck, Heart, Camera, Link2, ListVideo, ChevronUp
} from 'lucide-react';
import { FaYoutube, FaTwitch, FaVimeo, FaSoundcloud, FaWhatsapp, FaTelegramPlane, FaInstagram, FaSnapchatGhost, FaDiscord, FaRedditAlien, FaFacebookF, FaLinkedinIn, FaPinterestP } from 'react-icons/fa';
import { SiNetflix, SiAppletv, SiGmail } from 'react-icons/si';
import { TbBrandAmazon, TbBrandDisney } from 'react-icons/tb';
import CreateRoomModal from './components/CreateRoomModal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SeoHead from './components/SeoHead';

const Features = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check auth state
  const token = localStorage.getItem('watch_token');
  const loggedInUsername = localStorage.getItem('watch_username');
  const isLoggedIn = !!token;

  const createRoom = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    setShowCreateModal(true);
  };
  const [activeTab, setActiveTab] = useState('sync');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [latencyHistory, setLatencyHistory] = useState([24, 28, 25, 30, 22, 26, 25]);
  const [currentLatency, setCurrentLatency] = useState(25);
  const [deviceScale, setDeviceScale] = useState('desktop');

  // Track theme reactively
  const [theme, setTheme] = useState(localStorage.getItem('watch_theme') || 'dark');
  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('watch_theme') || 'dark');
    };
    window.addEventListener('theme_changed', handleThemeChange);
    return () => window.removeEventListener('theme_changed', handleThemeChange);
  }, []);
  const isLight = theme === 'light';

  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Simulate latency updates
  useEffect(() => {
    const interval = setInterval(() => {
      const nextLat = Math.floor(Math.random() * 15) + 15; // 15ms to 30ms
      setCurrentLatency(nextLat);
      setLatencyHistory(prev => [...prev.slice(1), nextLat]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Simulate file upload progress in local sharing card
  useEffect(() => {
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) return 0;
        return prev + 5;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const featuresData = [
    { icon: <Zap size={24} />, color: '#facc15', title: t('instantSync', 'Instant Sync'), desc: t('instantSyncDesc', 'Everyone sees play, pause, and seek at the exact same moment') },
    { icon: <Play size={24} />, color: '#6366f1', title: t('watchTogether', 'Shared Rooms'), desc: t('watchTogetherDesc', 'Create a room, paste any video link, and watch with friends') },
    { icon: <Lock size={24} />, color: '#10b981', title: t('privateRooms', 'Private Rooms'), desc: t('privateRoomsDesc', 'Password-protect your room so only invited friends can join') },
    { icon: <Shield size={24} />, color: '#ec4899', title: t('endToEndEncryption', 'Secure Messaging'), desc: t('e2eDesc', 'Your messages are end-to-end encrypted. Nobody can read them except you') },
    { icon: <MessageSquare size={24} />, color: '#3b82f6', title: t('groupChat', 'Group Chat'), desc: t('groupChatDesc', 'Chat with everyone in the room, send custom emojis, and reply to messages.') },
    { icon: <Users size={24} />, color: '#f59e0b', title: t('directMessages', 'Direct Messages'), desc: t('dmDesc', 'Send private messages directly to any friend with live typing indicators.') },
    { icon: <Crown size={24} />, color: '#a855f7', title: t('hostControls', 'Host Controls'), desc: t('hostControlsDesc', 'As host, control who can play videos, chat, or turn on camera') },
    { icon: <ShieldAlert size={24} />, color: '#ef4444', title: t('kickBanMute', 'Room Moderation'), desc: t('moderationDesc', 'Easily mute, kick, or ban rule-breakers to keep the room friendly.') },
    { icon: <Camera size={24} />, color: '#06b6d4', title: t('webrtcStreaming', 'Video Calls'), desc: t('webrtcDesc', 'Video call your friends while watching — like a virtual movie night') },
    { icon: <Monitor size={24} />, color: '#10b981', title: t('screenSharing', 'Screen Sharing'), desc: t('screenSharingDesc', 'Share your browser tab, specific app, or entire screen instantly.') },
    { icon: <Globe size={24} />, color: '#84cc16', title: t('multiPlatformSupport', 'Watch Any Site'), desc: t('multiPlatformDesc', 'Play videos from YouTube, Twitch, Vimeo, SoundCloud, and more.') },
    { icon: <FolderOpen size={24} />, color: '#fb923c', title: t('localFileStreaming', 'Watch Local Videos'), desc: t('localFileDesc', 'Play any .mp4 or video file from your computer directly in the room — no upload needed') },
    { icon: <Activity size={24} />, color: '#e11d48', title: t('realTimePresence', 'See Who’s Online'), desc: t('presenceDesc', 'See when your friends are online or active in public watch rooms.') },
    { icon: <Bell size={24} />, color: '#facc15', title: t('notifications', 'Instant Alerts'), desc: t('notificationsDesc', 'Get notified instantly about incoming friend requests and room invites.') },
    { icon: <Compass size={24} />, color: '#6366f1', title: t('roomDiscovery', 'Browse Public Rooms'), desc: t('discoveryDesc', 'Discover and join open watch parties from around the world.') },
    { icon: <Smartphone size={24} />, color: '#06b6d4', title: t('mobileFriendly', 'Watch on Mobile'), desc: t('mobileDesc', 'A responsive layout that looks and works great on phones and tablets.') },
    { icon: <Moon size={24} />, color: '#a855f7', title: t('darkMode', 'Dark Mode'), desc: t('darkModeDesc', 'Switch to dark theme for comfortable late night watching') },
    { icon: <RefreshCw size={24} />, color: '#10b981', title: t('fastReconnection', 'Quick Reconnect'), desc: t('reconnectDesc', 'Automatically jump back into the room if your internet drops.') },
    { icon: <Tv size={24} />, color: '#ec4899', title: t('hdStreaming', 'Crisp HD Quality'), desc: t('hdStreamingDesc', 'Enjoy high-definition and 4K media streams directly on your screen.') },
    { icon: <ListVideo size={24} />, color: '#f97316', title: t('hideVideos', 'Hide videos'), desc: t('hideVideosDesc', 'Hide and unhide all user videos while streaming together') }
  ];

  return (
    <div className="page-enter" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <SeoHead path="/features" />
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        loggedInUsername={loggedInUsername}
      />
      <Navbar />

      <style>{`
        /* --- Glowing Mesh Animations --- */
        .glowing-mesh-bg {
          position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
        }
        .mesh-blob {
          position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.15;
          animation: floatBlob 20s infinite alternate ease-in-out;
        }
        .mesh-blob-1 { width: 600px; height: 600px; background: var(--brand-1); top: -10%; left: -10%; }
        .mesh-blob-2 { width: 500px; height: 500px; background: var(--brand-2); bottom: 20%; right: -5%; animation-delay: -5s; }
        .mesh-blob-3 { width: 400px; height: 400px; background: #06b6d4; bottom: -10%; left: 20%; animation-delay: -10s; }
        
        @keyframes floatBlob {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.1) translate(50px, -30px); }
          100% { transform: scale(0.9) translate(-30px, 40px); }
        }

        /* --- Custom Scrollbar & Interactive States --- */
        .glow-hover {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glow-hover:hover {
          transform: translateY(-6px);
          border-color: rgba(var(--brand-1-rgb), 0.4);
          box-shadow: 0 20px 40px -15px rgba(var(--brand-1-rgb), 0.25), 0 0 20px -5px rgba(var(--brand-1-rgb), 0.15);
          background: rgba(15, 15, 25, 0.6);
        }

        /* --- Playback Sync Wave --- */
        .sync-wave {
          display: flex; align-items: flex-end; gap: 4px; height: 32px;
        }
        .sync-bar {
          width: 4px; border-radius: 2px; background: linear-gradient(to top, var(--brand-1), var(--brand-2));
          animation: syncPulse 1.2s infinite ease-in-out;
        }
        .sync-bar:nth-child(2) { animation-delay: 0.15s; }
        .sync-bar:nth-child(3) { animation-delay: 0.3s; }
        .sync-bar:nth-child(4) { animation-delay: 0.45s; }
        .sync-bar:nth-child(5) { animation-delay: 0.6s; }

        @keyframes syncPulse {
          0%, 100% { height: 8px; }
          50% { height: 32px; }
        }

        /* --- Encryption Tunnel Lines --- */
        .tunnel-line {
          stroke-dasharray: 12 12;
          animation: moveTunnel 2s infinite linear;
        }
        @keyframes moveTunnel {
          to { stroke-dashoffset: -24; }
        }

        /* --- Responsive scaling simulator --- */
        .device-preview-box {
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* --- Glow borders --- */
        .glow-border {
          position: relative;
        }
        .glow-border::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          padding: 1.5px; background: linear-gradient(135deg, rgba(var(--brand-1-rgb),0.4), rgba(var(--brand-2-rgb),0.4));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: 0.3;
          transition: opacity 0.4s;
        }
        .glow-border:hover::after {
          opacity: 1;
        }

        /* --- Green Dot Wave Animation --- */
        @keyframes greenWave {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .pulse-green-dot {
          animation: greenWave 2s infinite;
        }

        /* --- General Layout Responsiveness & Containers --- */
        .features-container {
          padding-left: 24px !important;
          padding-right: 24px !important;
        }
        @media (min-width: 640px) {
          .features-container {
            padding-left: 48px !important;
            padding-right: 48px !important;
          }
        }
        @media (min-width: 1024px) {
          .features-container {
            padding-left: 80px !important;
            padding-right: 80px !important;
          }
        }

        /* --- Section Titles & Bodies --- */
        .section-title {
          font-size: 28px !important;
          font-weight: 800;
          margin-bottom: 16px;
          line-height: 1.2;
        }
        @media (min-width: 640px) {
          .section-title {
            font-size: 36px !important;
          }
        }
        @media (min-width: 1024px) {
          .section-title {
            font-size: 44px !important;
          }
        }

        .section-body {
          font-size: 15px !important;
          line-height: 1.6;
        }
        @media (min-width: 640px) {
          .section-body {
            font-size: 16px !important;
          }
        }
        @media (min-width: 1024px) {
          .section-body {
            font-size: 17px !important;
          }
        }

        /* --- Feature Card & Grid --- */
        .features-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 640px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .feature-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-height: 180px;
          height: auto;
        }

        /* --- Side by side sections (image/mockup + text) --- */
        .side-by-side-section {
          display: grid;
          gap: 32px;
          align-items: center;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px) {
          .side-by-side-section {
            grid-template-columns: 1fr 1fr;
            gap: 64px;
          }
        }

        /* Default mobile: info first, mockup second */
        .side-by-side-section > .info-wrapper {
          order: 1;
        }
        .side-by-side-section > .mockup-wrapper {
          order: 2;
        }

        /* Desktop: alternate layouts if alt-layout class is present */
        @media (min-width: 1024px) {
          .side-by-side-section > .info-wrapper {
            order: 0;
          }
          .side-by-side-section > .mockup-wrapper {
            order: 0;
          }
          .side-by-side-section.alt-layout > .mockup-wrapper {
            order: -1;
          }
        }

        /* --- Sources Grid responsive (2 beside on mobile) --- */
        .sources-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 640px) {
          .sources-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
        }
        @media (min-width: 1024px) {
          .sources-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
          }
        }
        .source-card {
          padding: 16px !important;
        }
        @media (min-width: 640px) {
          .source-card {
            padding: 24px !important;
          }
        }

        /* --- Privacy Badges Grid (2x2 on mobile) --- */
        .privacy-badges-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          max-width: 440px;
          margin: 24px auto 0;
        }
        @media (min-width: 640px) {
          .privacy-badges-grid {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 24px;
            max-width: none;
            margin: 40px auto 0;
          }
        }
        .privacy-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 8px 16px !important;
          border-radius: 99px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #34d399;
          font-size: 13px;
          font-weight: 600;
        }

        /* --- Mockup Wrapper & Glass Panel Responsiveness --- */
        .mockup-wrapper {
          min-width: 0;
          width: 100%;
        }
        .mockup-wrapper.glass-panel {
          padding: 16px !important;
        }
        @media (min-width: 640px) {
          .mockup-wrapper.glass-panel {
            padding: 24px !important;
          }
        }
        .sync-mockup {
          padding: 16px !important;
        }
        @media (min-width: 640px) {
          .sync-mockup {
            padding: 32px !important;
          }
        }

        /* --- Lobby Item wrapping on small screens --- */
        .lobby-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          gap: 12px;
        }
        @media (max-width: 480px) {
          .lobby-item {
            flex-direction: column !important;
            align-items: stretch !important;
            text-align: center;
            gap: 8px;
          }
          .lobby-item > div:first-child {
            margin-bottom: 4px;
          }
          .lobby-item > div:last-child {
            justify-content: center !important;
          }
        }

        /* --- Feature Comparison Table Container --- */
        .table-container {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        html[data-theme='light'] .table-container {
          border: 1px solid rgba(0, 0, 0, 0.06);
        }
        .table-container:hover {
          border-color: rgba(var(--brand-2-rgb), 0.45) !important;
          box-shadow: 0 0 15px rgba(var(--brand-2-rgb), 0.12) !important;
        }
        @media (max-width: 1023px) {
          .table-container,
          .table-container.glass-panel,
          .table-container.glow-border,
          html[data-theme='light'] .table-container,
          html[data-theme='light'] .table-container.glass-panel,
          html[data-theme='light'] .table-container.glow-border {
            border-radius: 12px !important;
          }
          .table-container.glow-border::after,
          .table-container::after,
          .glow-border.table-container::after {
            display: none !important;
          }
        }
      `}</style>

      {/* Background blobs */}
      <div className="glowing-mesh-bg">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />
      </div>

      {/* ────────────────────────────────────────────────────────
         1. HERO SECTION
      ──────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', display: 'flex', alignItems: 'center', background: isLight
          ? 'radial-gradient(ellipse 60% 55% at 2% 98%, rgba(var(--brand-1-rgb),0.18) 0%, transparent 70%), radial-gradient(ellipse 55% 50% at 98% 2%, rgba(var(--brand-2-rgb),0.14) 0%, transparent 65%), radial-gradient(ellipse 40% 35% at 98% 98%, rgba(6,182,212,0.08) 0%, transparent 60%), #ffffff'
          : 'radial-gradient(ellipse 60% 55% at 2% 98%, rgba(var(--brand-1-rgb),0.28) 0%, transparent 70%), radial-gradient(ellipse 55% 50% at 98% 2%, rgba(var(--brand-2-rgb),0.22) 0%, transparent 65%), radial-gradient(ellipse 40% 35% at 98% 98%, rgba(6,182,212,0.12) 0%, transparent 60%), #0f0f18', color: 'var(--text-primary)', overflow: 'hidden',
        paddingTop: 'clamp(48px, 8vw, 100px)',
        paddingBottom: 'clamp(48px, 8vw, 100px)',
      }}>
        <div className="features-container side-by-side-section" style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
          {/* Left Hero */}
          <div className="info-wrapper" style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99, background: 'rgba(var(--brand-1-rgb),0.1)', border: '1px solid rgba(var(--brand-1-rgb),0.2)', color: 'var(--brand-1-light)', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
              <Sparkles size={14} /> {t('everythingUnlock', 'Sahaplay watch party hub')}
            </div>
            <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1.5px', marginBottom: 24, background: isLight ? 'none' : 'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip: isLight ? 'none' : 'text', WebkitTextFillColor: isLight ? 'var(--text-primary)' : 'transparent', backgroundClip: isLight ? 'none' : 'text', color: 'var(--text-primary)' }}>
              {t('heroTitlePart1', 'Everything You Need To')} <span style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('heroTitlePart2', 'Watch Together')}</span>
            </h1>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 40, maxWidth: 540 }}>
              {t('featuresHeroDesc', 'Watch anything together — perfectly synced, privately encrypted, and always in real time.')}
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button className="btn" onClick={createRoom}>
                {t('startWatching', 'Start Watching')} <ArrowRight size={16} />
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/public')}>
                {t('exploreLobbies', 'Explore Public Lobbies')}
              </button>
            </div>
          </div>

          {/* Right Dashboard Mockup */}
          <div style={{ position: 'relative', zIndex: 1, width: '100%' }} className="device-preview-box mockup-wrapper">
            {/* Main glass frame */}
            <div className="glass-panel glow-border" style={{ padding: 18, background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.7)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
              {/* Simulated Room Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="pulse-green-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t('mockLobbyTitle', '🚀 Popcorn Night Lobby')}</span>
                </div>
                <div className="sync-wave">
                  <div className="sync-bar" />
                  <div className="sync-bar" />
                  <div className="sync-bar" />
                  <div className="sync-bar" />
                  <div className="sync-bar" />
                </div>
              </div>

              {/* Mock Screen & Chat */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                {/* Screen / Video element */}
                <div style={{ position: 'relative', borderRadius: 16, background: '#1e1b4b', overflow: 'hidden', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=60" alt={t('mockMovieAlt', 'mock movie')} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />

                  {/* Playhead Overlay */}
                  <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Play fill="#fff" size={14} style={{ color: '#fff' }} />
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, position: 'relative' }}>
                      <div style={{ width: '60%', height: '100%', background: 'var(--brand-1)', borderRadius: 2 }} />
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', position: 'absolute', left: '60%', top: -2 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>02:14 / 03:45</span>
                  </div>
                </div>

                {/* Simulated Live Chat */}
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 200 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11 }}>
                      <strong style={{ color: '#818cf8' }}>{t('alex', 'Alex')}:</strong> {t('mockAlexChat', 'This plays so smoothly!')}
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <strong style={{ color: '#ec4899' }}>{t('sarah', 'Sarah')}:</strong> {t('mockSarahChat', 'Play it now! 🎬')}
                    </div>
                    <div style={{ fontSize: 11 }}>
                      <strong style={{ color: '#10b981' }}>{t('vikram', 'Vikram')}:</strong> {t('mockVikramChat', 'Yeah, everything is in perfect sync!')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '0 8px', fontSize: 10, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{t('chatPlaceholder', 'Type a message...')}</div>
                    <div style={{ width: 22, height: 22, background: 'var(--brand-1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Send size={10} color="#fff" />
                    </div>
                  </div>
                </div>
              </div>

              {/* User Avatars List */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('watchingNow', 'Active:')}</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {['#6366f1', '#a855f7', '#06b6d4', '#10b981'].map((color, idx) => (
                    <div key={idx} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: '2px solid var(--bg-color)', marginLeft: idx > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                  ● {t('connectedStatus', 'Connected')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         2. FEATURE GRID
      ──────────────────────────────────────────────────────── */}
      <section id="features-section" className="section-padding" style={{ background: isLight ? '#f8f7ff' : '#13131f', position: 'relative', borderTop: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        {/* Gradient divider line — fades at edges, no harsh cut */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '70%', height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(var(--brand-1-rgb),0.35), rgba(var(--brand-2-rgb),0.35), transparent)'
        }} />
        <div className="features-container" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 className="section-title">{t('exploreFeaturesTitle', 'Platform Features')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto' }}>
              {t('exploreFeaturesDesc', 'Everything you need for the perfect watch party — all in one place.')}
            </p>
          </div>

          <div className="features-grid">
            {featuresData.map((feat, idx) => (
              <div
                key={idx}
                className="glass-panel glow-border glow-hover feature-card"
                style={{ padding: '24px 20px', borderRadius: 20, background: isLight ? '#ffffff' : 'rgba(15,15,25,0.3)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(var(--brand-1-rgb),0.15)', color: feat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  {feat.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{feat.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         3. REALTIME SYNC ENGINE SECTION
      ──────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="section-padding" style={{ background: isLight ? '#ffffff' : '#0f0f18', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section alt-layout" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Info */}
          <div className="info-wrapper">
            <h2 className="section-title">{t('syncEngineTitle', 'Perfect Playback Sync')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
              {t('syncEngineDesc', 'When you hit play, everyone sees it at the same moment. Pause, seek, or switch videos — it all stays in sync, automatically.')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--brand-1)', marginBottom: 4 }}>{t('instant', 'Instant')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('noDelayDesc', 'No delay in playback alignment')}</div>
              </div>
              <div style={{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginBottom: 4 }}>100%</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('syncedScreensDesc', 'Synced screens across all devices')}</div>
              </div>
            </div>
          </div>

          {/* Left: Wave/Pulse Sync Visualizer */}
          <div className="glass-panel glow-border mockup-wrapper sync-mockup" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.5)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, position: 'relative', width: '100%' }}>
            <div style={{ fontSize: 12, color: 'var(--brand-1-light)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 }}>
              {t('livePlaybackSync', 'Live Playback Sync')}
            </div>

            {/* Visualizer Lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                { name: t('roomHost', 'Room Host'), status: t('playingVideo', 'Playing Video'), lat: t('inSync', 'In Sync') },
                { name: t('friendVikram', 'Friend (Vikram)'), status: t('watchingState', 'Watching'), lat: t('inSync', 'In Sync') },
                { name: t('friendSarah', 'Friend (Sarah)'), status: t('watchingState', 'Watching'), lat: t('inSync', 'In Sync') }
              ].map((node, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="stay-white" style={{ width: 40, height: 40, borderRadius: '50%', background: i === 0 ? '#6366f1' : '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                    {i === 0 ? 'H' : 'F'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{node.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{node.status}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: i === 0 ? '#6366f1' : '#a855f7' }}>{node.lat}</div>
                    <div style={{ fontSize: 11, color: '#22c55e' }}>● {t('activeStatus', 'Active')}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Delay/Latency Graph */}
            <div style={{ marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('playbackSyncStatus', 'Playback Sync Status')}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{t('statusConnected', 'Status: Connected')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                {latencyHistory.map((val, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(var(--brand-2-rgb), 0.25)', height: `${val * 2}%`, borderRadius: 3, position: 'relative' }} title={`${t('ping', 'Ping')}: ${val}ms`}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'var(--brand-2)', borderRadius: '0 0 3px 3px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         4. LIVE CHAT + PRIVATE DM SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#f3f4f6' : '#1a1a2e', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="info-wrapper">
            <h2 className="section-title">{t('communicationHubTitle', 'Live Chat & Private Messaging')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {t('communicationHubDesc', 'Chat with everyone in public room channels or start a private group chat. Enjoy live typing indicators, unread message badges, and notifications.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Check size={18} color="#10b981" />
                <span style={{ fontSize: 15 }}>{t('dmCheck1', 'Private and secure direct messaging')}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Check size={18} color="#10b981" />
                <span style={{ fontSize: 15 }}>{t('dmCheck2', 'Typing indicators, easy replies, and custom reactions')}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Check size={18} color="#10b981" />
                <span style={{ fontSize: 15 }}>{t('dmCheck3', 'End-to-End encrypted — nobody else can read your DMs')}</span>
              </div>
            </div>
          </div>

          {/* Chat Mockup */}
          <div className="glass-panel glow-border mockup-wrapper" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.6)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, width: '100%' }}>
            <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16, marginBottom: 16 }}>
              <button onClick={() => setActiveTab('sync')} style={{ flex: 1, padding: 8, background: activeTab === 'sync' ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent', border: activeTab === 'sync' ? '1px solid rgba(var(--brand-1-rgb),0.2)' : 'none', color: activeTab === 'sync' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, borderRadius: 10, cursor: 'pointer' }}>
                {t('groupLobbyChat', 'Group Lobby Chat')}
              </button>
              <button onClick={() => setActiveTab('dm')} style={{ flex: 1, padding: 8, background: activeTab === 'dm' ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent', border: activeTab === 'dm' ? '1px solid rgba(var(--brand-1-rgb),0.2)' : 'none', color: activeTab === 'dm' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, borderRadius: 10, cursor: 'pointer' }}>
                {t('privateDmSarah', 'Private DM (Sarah)')}
              </button>
            </div>

            {activeTab === 'sync' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 180 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="stay-white" style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>A</div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, marginRight: 6 }}>{t('alex', 'Alex')}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>9:24 PM</span>
                    <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '0 12px 12px 12px', marginTop: 4 }}>
                      {t('mockAlexChatMsg', 'Hey everyone! Did Vikram join the room yet?')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="stay-white" style={{ width: 28, height: 28, borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>S</div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, marginRight: 6 }}>{t('sarah', 'Sarah')}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>9:25 PM</span>
                    <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '0 12px 12px 12px', marginTop: 4 }}>
                      {t('mockSarahChatMsg', 'Yes, Vikram is connected and the video is playing in sync!')}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 180 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="stay-white" style={{ width: 28, height: 28, borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>S</div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, marginRight: 6 }}>{t('sarah', 'Sarah')}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>9:25 PM</span>
                    <div style={{ fontSize: 13, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 12px', borderRadius: '0 12px 12px 12px', marginTop: 4, color: '#10b981' }}>
                      {t('mockPrivateDmSecure', '🔒 This chat is private and secure.')}
                    </div>
                    <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '0 12px 12px 12px', marginTop: 8 }}>
                      {t('mockSarahDmMsg', "Let's create a private watch room for the new movies later.")}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         5. SCREENSHARE + STREAMING SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#ffffff' : '#0f0f18', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section alt-layout" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Info */}
          <div className="info-wrapper">
            <h2 className="section-title">{t('screenshareTitle', 'Screenshare & Video Calls')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {t('screenshareDesc', 'Share your browser tab, specific app window, or entire screen instantly. You can also turn on your camera to react and watch together live.')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Check size={16} color="#10b981" />
                <span style={{ fontSize: 14 }}>{t('hdVideoSupport', 'High-definition video support')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Check size={16} color="#10b981" />
                <span style={{ fontSize: 14 }}>{t('smoothLiveFeeds', 'Smooth live video feeds')}</span>
              </div>
            </div>
          </div>

          {/* Screen preview */}
          <div className="glass-panel glow-border mockup-wrapper" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.6)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, width: '100%' }}>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#09090b', height: 260 }}>
              <div className="live-badge" style={{ position: 'absolute', top: 12, left: 12, background: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                {t('liveScreenshare', 'LIVE SCREENSHARE')}
              </div>
              <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=60" alt={t('mockScreenshareAlt', 'mock screen sharing')} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />

              {/* WebRTC Video Overlay (Camera) */}
              <div style={{ position: 'absolute', bottom: 12, right: 12, width: 90, height: 60, borderRadius: 10, border: '2px solid var(--brand-1)', overflow: 'hidden', background: '#000' }}>
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60" alt={t('avatarWebcamAlt', 'avatar webcam')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         6. END-TO-END ENCRYPTION SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{
        background: isLight
          ? 'radial-gradient(ellipse 38% 120% at -2% 50%, rgba(var(--brand-2-rgb),0.14) 0%, rgba(139,92,246,0.06) 55%, transparent 100%), radial-gradient(ellipse 38% 120% at 102% 50%, rgba(139,92,246,0.12) 0%, rgba(var(--brand-2-rgb),0.05) 55%, transparent 100%), #f8f7ff'
          : 'radial-gradient(ellipse 38% 120% at -2% 50%, rgba(var(--brand-2-rgb),0.28) 0%, rgba(139,92,246,0.10) 55%, transparent 100%), radial-gradient(ellipse 38% 120% at 102% 50%, rgba(139,92,246,0.24) 0%, rgba(var(--brand-2-rgb),0.08) 55%, transparent 100%), #13131f',
        borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)'
      }}>
        <div className="features-container" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <ShieldCheck size={32} />
          </div>
          <h2 className="section-title" style={{ fontWeight: 900, marginBottom: 20 }}>{t('encryptionTitle', 'Your Chats Are Completely Private')}</h2>
          <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>
            {t('encryptionDesc', 'Every message is encrypted on your device before sending. Not even we can read your conversations.')}
          </p>

          {/* Trust Badges */}
          <div className="privacy-badges-grid">
            {[
              t('privateAndSafe', 'Private & Safe'),
              t('noDataLeaks', 'No Data Leaks'),
              t('secureChats', 'Secure Chats'),
              t('signalLevelSecurity', 'Signal-Level Security')
            ].map((badge, idx) => (
              <span key={idx} className="privacy-badge">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         7. HOST CONTROLS + MODERATION SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#ffffff' : '#0f0f18', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="info-wrapper">
            <h2 className="section-title">{t('hostControlsHeader', 'Host Controls & Room Management')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {t('hostControlsDescText', 'Keep your watch party fun and friendly. As the host, you can control who can send links, turn on cameras, search for videos, or remove any guests instantly.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Check size={18} color="#10b981" />
                <span style={{ fontSize: 15 }}>{t('hostPlayControlCheck', 'Host has complete control over video playback')}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Check size={18} color="#10b981" />
                <span style={{ fontSize: 15 }}>{t('hostBanControlCheck', 'Keep banned users out of the room permanently')}</span>
              </div>
            </div>
          </div>

          {/* Interactive controls panel preview */}
          <div className="glass-panel glow-border mockup-wrapper" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.6)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crown size={18} color="var(--brand-2)" /> {t('roomPermissionsControl', 'Room Permissions Control')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: t('allowLinks', 'Allow Links'), desc: t('preventSpamLinks', 'Prevent spam links in the chat'), active: true },
                { label: t('allowMediaSelectors', 'Allow Media Selectors'), desc: t('letGuestsPlay', 'Let guests search and play videos'), active: false },
                { label: t('allowWebcams', 'Allow Webcams'), desc: t('letGuestsWebcam', 'Let guests turn on their cameras'), active: true }
              ].map((setting, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{setting.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{setting.desc}</div>
                  </div>
                  {/* Switch */}
                  <div
                    className="feat-toggle-track"
                    data-active={String(setting.active)}
                    style={{ background: setting.active ? 'var(--brand-1)' : 'rgba(0,0,0,0.15)' }}
                  >
                    <div className="feat-toggle-thumb" style={{ left: setting.active ? 21 : 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         8. MULTI-PLATFORM SUPPORT SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#f3f4f6' : '#1a1a2e', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container" style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="section-title">{t('supportedSources', 'Supported Video & Audio Sources')}</h2>
          <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 48 }}>
            {t('supportedSourcesDesc', 'Play almost anything. Simply paste any video link or select from your favorite sites.')}
          </p>

          <div className="sources-grid">
            {[
              { name: t('youtube', 'YouTube'), icon: <FaYoutube size={20} color="#ff0000" />, bg: 'rgba(255, 0, 0, 0.08)', border: 'rgba(255, 0, 0, 0.2)' },
              { name: t('twitch', 'Twitch'), icon: <FaTwitch size={20} color="#9146ff" />, bg: 'rgba(145, 70, 255, 0.08)', border: 'rgba(145, 70, 255, 0.2)' },
              { name: t('vimeo', 'Vimeo'), icon: <FaVimeo size={20} color="#1ab7ea" />, bg: 'rgba(26, 183, 234, 0.08)', border: 'rgba(26, 183, 234, 0.2)' },
              { name: t('soundcloud', 'SoundCloud'), icon: <FaSoundcloud size={20} color="#ff5500" />, bg: 'rgba(255, 85, 0, 0.08)', border: 'rgba(255, 85, 0, 0.2)' },
              { name: t('netflix', 'Netflix'), icon: <SiNetflix size={20} color="#e50914" />, bg: 'rgba(229, 9, 20, 0.08)', border: 'rgba(229, 9, 20, 0.2)' },
              { name: t('primeVideo', 'Prime Video'), icon: <TbBrandAmazon size={20} color="#00a8e1" />, bg: 'rgba(0, 168, 225, 0.08)', border: 'rgba(0, 168, 225, 0.2)' },
              { name: t('disneyHotstar', 'Disney+ Hotstar'), icon: <TbBrandDisney size={20} color="#0063e5" />, bg: 'rgba(0, 99, 229, 0.08)', border: 'rgba(0, 99, 229, 0.2)' },
              { name: t('appleTv', 'Apple TV'), icon: <SiAppletv size={20} color="#a3a3a3" />, bg: 'rgba(163, 163, 163, 0.08)', border: 'rgba(163, 163, 163, 0.2)' },
              { name: t('localFiles', 'Local Files'), icon: <FolderOpen size={20} color="#fb923c" />, bg: 'rgba(251, 146, 60, 0.08)', border: 'rgba(251, 146, 60, 0.2)' },
              { name: t('directUrls', 'Direct URLs'), icon: <Link2 size={20} color="#10b981" />, bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)' }
            ].map((source, idx) => (
              <div key={idx} className="glass-panel glow-border source-card" style={{ background: isLight ? '#ffffff' : 'rgba(15,15,25,0.4)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: source.bg, border: `1px solid ${source.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {source.icon}
                </div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{source.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         9. LOCAL FILE SHARING SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#ffffff' : '#0f0f18', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section alt-layout" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Info First */}
          <div className="info-wrapper">
            <h2 className="section-title">{t('localFileSharing', 'Watch Local Videos')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {t('localFileSharingDesc', 'No waiting for uploads. Select any video from your computer and start watching with friends instantly.')}
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Check size={18} color="#10b981" />
              <span style={{ fontSize: 15 }}>{t('noFileLimitsCheck', 'No file size limits or upload delays')}</span>
            </div>
          </div>

          {/* Uploader Preview Second */}
          <div className="glass-panel glow-border mockup-wrapper" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.6)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, width: '100%' }}>
            <div style={{ border: '2px dashed rgba(var(--brand-1-rgb),0.3)', padding: 40, borderRadius: 16, textAlign: 'center', background: 'rgba(var(--brand-1-rgb),0.02)' }}>
              <FolderOpen size={48} color="var(--brand-1)" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t('mockFileName', 'movie_night_sync.mp4')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{t('mockFileSize', 'File size: 1.2 GB')}</div>

              {/* Progress bar */}
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, position: 'relative', overflow: 'hidden', maxWidth: 280, margin: '0 auto' }}>
                <div style={{ height: '100%', background: 'linear-gradient(to right, var(--brand-1), var(--brand-2))', width: `${uploadProgress}%`, borderRadius: 3 }} />
              </div>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                {t('preparingVideo', 'Preparing video...')} {uploadProgress}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         10. MOBILE EXPERIENCE SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#f8f7ff' : '#13131f', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="info-wrapper">
            <h2 className="section-title">{t('mobileExperienceTitle', 'Watch on Any Device')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {t('mobileExperienceDesc', 'Take the watch party with you. Our layout adjusts perfectly to look beautiful on your phone, tablet, or desktop.')}
            </p>

            {/* Control tab for preview simulator */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: 'desktop', label: t('desktop', 'desktop') },
                { id: 'tablet', label: t('tablet', 'tablet') },
                { id: 'mobile', label: t('mobile', 'mobile') }
              ].map((device) => (
                <button
                  key={device.id}
                  onClick={() => setDeviceScale(device.id)}
                  style={{
                    padding: '8px 16px', background: deviceScale === device.id ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent',
                    border: deviceScale === device.id ? '1px solid rgba(var(--brand-1-rgb),0.3)' : '1px solid transparent',
                    borderRadius: 8, color: deviceScale === device.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {device.label}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Box */}
          <div className="mockup-wrapper" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <div
              className="glass-panel glow-border"
              style={{
                width: deviceScale === 'desktop' ? '100%' : deviceScale === 'tablet' ? '340px' : '260px',
                height: 280, background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.6)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 16,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div className="stay-white" style={{ background: '#1e1b4b', height: '60%', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                {t('mockVideoPlayer', '🎥 Video Player')}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', flex: 1, marginTop: 10, borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
                {t('mockChatMod', '💬 Chat & Moderation')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         11. PUBLIC ROOMS SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#ffffff' : '#0f0f18', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container side-by-side-section" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="info-wrapper">
            <h2 className="section-title">{t('socialDiscoveryTitle', 'Find Public Watch Parties')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {t('socialDiscoveryDesc', 'Explore open rooms from around the world. See how many people are watching before you join.')}
            </p>
          </div>

          {/* Lobby directory simulation */}
          <div className="glass-panel glow-border mockup-wrapper" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.6)', border: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 24, width: '100%' }}>
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 6, width: '100%', maxWidth: '100%' }} className="no-scrollbar">
              {[
                { id: 'All', label: t('catAll', 'All') },
                { id: 'Movies', label: t('catMovies', 'Movies') },
                { id: 'Anime', label: t('catAnime', 'Anime') },
                { id: 'Music', label: t('catMusic', 'Music') },
                { id: 'Gaming', label: t('catGaming', 'Gaming') },
                { id: 'Sports', label: t('catSports', 'Sports') }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 99,
                    border: '1px solid',
                    borderColor: selectedCategory === cat.id ? 'rgba(var(--brand-1-rgb),0.3)' : 'rgba(255,255,255,0.06)',
                    background: selectedCategory === cat.id ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.02)',
                    color: selectedCategory === cat.id ? 'var(--brand-1-light)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { name: t('mockLobbyAnime', '🔥 Anime Sync Party #24'), viewers: 18, cat: 'Anime', catLabel: t('catAnime', 'Anime') },
                { name: t('mockLobbyLofi', '🎬 LoFi Beats Weekend Chillout'), viewers: 9, cat: 'Music', catLabel: t('catMusic', 'Music') },
                { name: t('mockLobbyMCU', '🍿 Marvel Cinematic Universe Marathon'), viewers: 34, cat: 'Movies', catLabel: t('catMovies', 'Movies') },
                { name: t('mockLobbyValorant', '🎮 Valorant Ranked Live Lobby'), viewers: 15, cat: 'Gaming', catLabel: t('catGaming', 'Gaming') },
                { name: t('mockLobbySports', '⚽ Champions League Live Reaction'), viewers: 42, cat: 'Sports', catLabel: t('catSports', 'Sports') }
              ]
                .filter(lobby => selectedCategory === 'All' || lobby.cat === selectedCategory)
                .map((lobby, i) => (
                  <div key={i} className="lobby-item">
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--brand-1)', fontWeight: 600 }}>{lobby.catLabel}</span>
                      <h4 style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700 }}>{lobby.name}</h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lobby.viewers} {t('watchingText', 'watching')}</span>
                      <button className="stay-white" onClick={() => navigate('/public')} style={{ padding: '6px 12px', background: 'var(--brand-gradient)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {t('joinBtn', 'Join')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         12. FEATURE COMPARISON SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{ background: isLight ? '#f3f4f6' : '#1a1a2e', borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div className="features-container" style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 className="section-title">{t('howWeCompare', 'How We Compare')}</h2>
            <p className="section-body" style={{ color: 'var(--text-secondary)' }}>{t('howWeCompareDesc', 'See how SahaPlay compares to generic screensharing platforms.')}</p>
          </div>

          <div className="glass-panel glow-border table-container" style={{ background: isLight ? '#ffffff' : 'rgba(10, 10, 15, 0.4)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: 'none' }}>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontSize: 14, borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>{t('featureMatrix', 'Feature Matrix')}</th>
                  <th style={{ padding: '18px 24px', color: 'var(--accent)', fontSize: 14, fontWeight: 800, borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>{t('sahaPlay', 'SahaPlay')}</th>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontSize: 14, borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>{t('kosmi', 'Kosmi')}</th>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontSize: 14, borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>{t('discord', 'Discord')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: t('compareAdvancedControls', 'Advanced Host & Moderator Controls'), wt: true, kosmi: false, discord: false },
                  { name: t('compareYoutubeTwitch', 'Watch YouTube and Twitch together'), wt: true, kosmi: true, discord: false },
                  { name: t('compareLocalFiles', 'Watch local video files from your computer'), wt: true, kosmi: true, discord: false },
                  { name: t('compareE2eChat', 'End-to-End Encrypted Chat'), wt: true, kosmi: false, discord: false },
                  { name: t('comparePrivateDm', 'Private Direct Messages'), wt: true, kosmi: true, discord: true },
                  { name: t('compareScreenShare', 'Screen Share (Netflix/Prime)'), wt: true, kosmi: true, discord: false },
                  { name: t('compareNoAccount', 'No Account Required to Join'), wt: true, kosmi: true, discord: false },
                  { name: t('compareWorksInBrowser', 'Works in Browser (No Download)'), wt: true, kosmi: true, discord: false },
                  { name: t('compareMobileResponsive', 'Mobile Responsive'), wt: true, kosmi: true, discord: true },
                  { name: t('compareHideUnhideVideos', 'Hide and Unhide user videos'), wt: true, kosmi: false, discord: false },
                  { name: t('compareChatPrivacyLock', 'Chat Privacy Lock'), wt: true, kosmi: false, discord: false },
                  { name: t('compareSecureDataWipe', 'Secure Data Wipe'), wt: true, kosmi: false, discord: false },
                  { name: t('compareHideUnhideChat', 'Hide and Unhide Chat'), wt: true, kosmi: false, discord: false }
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: 'none' }}>
                    <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 500, borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>{row.name}</td>
                    <td style={{ padding: '16px 24px', color: '#10b981', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                      {row.wt ? <Check size={18} /> : <X size={18} color="#ef4444" />}
                    </td>
                    <td style={{ padding: '16px 24px', color: row.kosmi ? '#10b981' : 'var(--text-secondary)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                      {row.kosmi ? <Check size={18} /> : <X size={18} color="#ef4444" />}
                    </td>
                    <td style={{ padding: '16px 24px', color: row.discord ? '#10b981' : 'var(--text-secondary)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                      {row.discord ? <Check size={18} /> : <X size={18} color="#ef4444" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
         13. FINAL CTA SECTION
      ──────────────────────────────────────────────────────── */}
      <section className="section-padding" style={{
        background: isLight
          ? 'linear-gradient(160deg, #f5f4ff 0%, #ede9ff 100%)'
          : 'linear-gradient(160deg, #13131f 0%, #1c1b2e 100%)',
        borderTop: isLight ? '1px solid rgba(var(--brand-1-rgb),0.12)' : '1px solid rgba(var(--brand-1-rgb),0.18)',
        position: 'relative'
      }}>
        {/* Subtle top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '60%', height: '2px',
          background: 'linear-gradient(to right, transparent, rgba(var(--brand-1-rgb),0.4), rgba(var(--brand-2-rgb),0.4), transparent)'
        }} />
        <div className="features-container" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 className="section-title" style={{ fontWeight: 900, marginBottom: 20 }}>
            {t('startWatchingToday', 'Start Watching Together Today')}
          </h2>
          <p className="section-body" style={{ color: 'var(--text-secondary)', marginBottom: 40, maxWidth: 600, margin: '0 auto 40px' }}>
            {t('finalCtaDesc', 'Join thousands of users watching, chatting, and sharing screen feeds around the globe.')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button className="btn" onClick={createRoom}>
              {t('createRoom', 'Create Room')}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/public')}>
              {t('exploreLobbies', 'Explore Public Lobbies')}
            </button>
          </div>
        </div>
      </section>

      <Footer />

      {showBackToTop && (
        <button
          className="back-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            zIndex: 999,
            padding: '10px 22px', borderRadius: 50,
            background: 'var(--brand-gradient)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(var(--brand-1-rgb),0.5)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(var(--brand-1-rgb),0.65)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateX(-50%)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--brand-1-rgb),0.5)';
          }}
        >
          <ChevronUp size={18} color="#fff" />
          {t('termsBackToTop', 'Back to Top')}
        </button>
      )}
    </div>
  );
};

export default Features;
