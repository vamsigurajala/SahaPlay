import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowRight } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import CreateRoomModal from './components/CreateRoomModal';
import Navbar from './components/Navbar';

// Minimal, functional-first landing view for the Tauri desktop app. Pinned
// Rooms and Public Rooms are their own pages now (linked from the desktop
// Navbar) — this view is just the single focal action: start or join a room.
const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [roomId, setRoomId] = useState('');
  const loggedInUsername = localStorage.getItem('watch_username');
  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim()) { toast.error('Please enter a Room ID to join!'); return; }
    navigate(`/room/${roomId.trim()}`);
  };

  const createRoom = () => {
    if (!isLoggedIn || isGuest) {
      navigate('/login');
      return;
    }
    setShowCreateModal(true);
  };

  const displayName = loggedInUsername && loggedInUsername.toLowerCase().startsWith('guest_')
    ? loggedInUsername.slice(6)
    : loggedInUsername;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toaster position="top-center" />
      <style>{`
        @keyframes dashOrbFloat1 {
          0%,100% { transform: translate(0px,0px) scale(1); }
          50%      { transform: translate(30px,-24px) scale(1.06); }
        }
        @keyframes dashOrbFloat2 {
          0%,100% { transform: translate(0px,0px) scale(1); }
          50%      { transform: translate(-28px,22px) scale(1.08); }
        }
        .dash-orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:0; }
        .dash-orb-1 { width:520px;height:520px; background:radial-gradient(circle,rgba(99,102,241,0.35),transparent 70%); top:-180px;left:-140px; animation:dashOrbFloat1 20s ease-in-out infinite; }
        .dash-orb-2 { width:420px;height:420px; background:radial-gradient(circle,rgba(168,85,247,0.3),transparent 70%); bottom:-160px;right:-120px; animation:dashOrbFloat2 24s ease-in-out infinite; }
        html[data-theme='light'] .dash-orb { opacity:0.12; }

        .dash-badge { display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:999px;padding:6px 16px;margin-bottom:24px;font-size:13px;color:#818cf8;font-weight:600; }
        html[data-theme='light'] .dash-badge { background:#fff;border-color:rgba(0,0,0,0.1);color:#4f46e5;box-shadow:0 4px 12px rgba(0,0,0,0.06);font-weight:700; }

        .dash-title { color:#fff; }
        html[data-theme='light'] .dash-title { color:#0f172a !important; }
        .dash-sub { color:#94a3b8; }
        html[data-theme='light'] .dash-sub { color:#475569 !important; }

        .dash-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:36px; backdrop-filter:blur(20px); box-shadow:0 20px 60px rgba(0,0,0,0.35); }
        html[data-theme='light'] .dash-card { background:#fff; border-color:rgba(0,0,0,0.06); box-shadow:0 20px 50px rgba(0,0,0,0.08); }

        .dash-join-form { display:flex;align-items:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden; }
        html[data-theme='light'] .dash-join-form { background:#f8fafc;border-color:rgba(0,0,0,0.08); }
        .dash-join-input { flex:1;background:transparent;border:none;outline:none;padding:16px 20px;font-size:15px;color:#fff; }
        html[data-theme='light'] .dash-join-input { color:#111 !important; }
        .dash-join-btn { border:none;padding:16px 22px;font-weight:700;font-size:14px;cursor:pointer;transition:background 0.2s;background:rgba(99,102,241,0.18);color:#a5b4fc;display:flex;align-items:center;gap:6px; }
        .dash-join-btn:hover { background:rgba(99,102,241,0.32); }
        html[data-theme='light'] .dash-join-btn { background:#eef2ff !important;color:#4f46e5 !important; }
        html[data-theme='light'] .dash-join-btn:hover { background:#e0e7ff !important; }

        @media (max-width: 560px) {
          .dash-join-form { flex-direction:column;border-radius:12px; }
          .dash-join-input { width:100%;padding:14px 16px; }
          .dash-join-btn { width:100%;justify-content:center;padding:14px; }
        }
      `}</style>

      <Navbar />

      <div className="dash-orb dash-orb-1" />
      <div className="dash-orb dash-orb-2" />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
          <div className="dash-badge">
            <Play size={13} fill="currentColor" /> {t('appName', 'SahaPlay')}
          </div>
          <h1 className="dash-title" style={{ fontSize: 'clamp(28px,4vw,38px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 12px', letterSpacing: '-1px' }}>
            {t('welcomeBack', 'Welcome back{{name}}', { name: displayName ? `, ${displayName}` : '' })}
          </h1>
          <p className="dash-sub" style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 32px' }}>
            {t('dashSubtitle', 'Start a new watch party or jump into one with a Room ID.')}
          </p>

          <div className="dash-card">
            <button onClick={createRoom} className="create-room-hero-btn stay-white"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff', padding: '17px 24px', fontSize: 16, borderRadius: 14, fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', marginBottom: 16 }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,85,247,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Play size={18} fill="#fff" strokeWidth={0} /><span className="stay-white">{t('createRoom', 'Create Room')}</span>
            </button>

            <form onSubmit={handleJoin} className="dash-join-form">
              <input type="text" placeholder={t('enterRoomId', 'Enter Room ID...')} value={roomId} onChange={e => setRoomId(e.target.value)} className="dash-join-input" />
              <button type="submit" className="dash-join-btn">{t('join', 'Join')} <ArrowRight size={14} /></button>
            </form>
          </div>
        </div>
      </div>

      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} loggedInUsername={loggedInUsername} />
    </div>
  );
};

export default Dashboard;
