import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowRight } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import CreateRoomModal from './components/CreateRoomModal';
import Navbar from './components/Navbar';

function getGreeting(t) {
  const hour = new Date().getHours();
  if (hour < 12) return t('goodMorning', 'Good morning');
  if (hour < 18) return t('goodAfternoon', 'Good afternoon');
  return t('goodEvening', 'Good evening');
}

// Minimal, functional-first landing view for the Tauri desktop app. Pinned
// Rooms and Public Rooms are their own pages now (linked from the desktop
// Navbar) — this view is just the single focal action: start or join a room,
// with a decorative (non-marketing) preview panel to keep the window from
// feeling like a bare form.
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
        @keyframes dashCardFloat {
          0%,100% { transform: perspective(1000px) rotateY(-8deg) rotateX(3deg) translateY(0px); }
          50%      { transform: perspective(1000px) rotateY(-8deg) rotateX(3deg) translateY(-12px); }
        }
        @keyframes dashLiveDot { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes dashTypingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-3px)} }

        .dash-orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:0; }
        .dash-orb-1 { width:520px;height:520px; background:radial-gradient(circle,rgba(99,102,241,0.35),transparent 70%); top:-180px;left:-140px; animation:dashOrbFloat1 20s ease-in-out infinite; }
        .dash-orb-2 { width:420px;height:420px; background:radial-gradient(circle,rgba(168,85,247,0.3),transparent 70%); bottom:-160px;right:-120px; animation:dashOrbFloat2 24s ease-in-out infinite; }
        html[data-theme='light'] .dash-orb { opacity:0.12; }

        .dash-greeting { color:#818cf8; font-size:14px; font-weight:700; letter-spacing:0.3px; margin:0 0 10px; }
        html[data-theme='light'] .dash-greeting { color:#4f46e5 !important; }

        .dash-title { color:#fff; }
        html[data-theme='light'] .dash-title { color:#0f172a !important; }
        .dash-sub { color:#94a3b8; }
        html[data-theme='light'] .dash-sub { color:#475569 !important; }

        .dash-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:36px; backdrop-filter:blur(20px); box-shadow:0 16px 40px rgba(0,0,0,0.25); }
        html[data-theme='light'] .dash-card { background:#fff; border-color:rgba(0,0,0,0.06); box-shadow:0 16px 36px rgba(0,0,0,0.06); }

        .dash-join-form { display:flex;align-items:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden; }
        html[data-theme='light'] .dash-join-form { background:#f8fafc;border-color:rgba(0,0,0,0.08); }
        .dash-join-input { flex:1;background:transparent;border:none;outline:none;padding:16px 20px;font-size:15px;color:#fff; }
        html[data-theme='light'] .dash-join-input { color:#111 !important; }
        .dash-join-btn { border:none;padding:16px 22px;font-weight:700;font-size:14px;cursor:pointer;transition:background 0.2s;background:rgba(99,102,241,0.18);color:#a5b4fc;display:flex;align-items:center;gap:6px; }
        .dash-join-btn:hover { background:rgba(99,102,241,0.32); }
        html[data-theme='light'] .dash-join-btn { background:#eef2ff !important;color:#4f46e5 !important; }
        html[data-theme='light'] .dash-join-btn:hover { background:#e0e7ff !important; }

        /* ── Decorative room-preview panel (right column, desktop only) ── */
        .dash-preview-wrap { flex:0 0 auto; position:relative; display:flex; align-items:center; justify-content:center; }
        .dash-preview-card { position:relative; width:380px; border-radius:16px; overflow:hidden; background:#0e0e20; border:1px solid rgba(99,102,241,0.3); box-shadow:0 0 0 1px rgba(99,102,241,0.1), 0 28px 70px -8px rgba(0,0,0,0.6); animation:dashCardFloat 6s ease-in-out infinite; }
        html[data-theme='light'] .dash-preview-card { background:#fff; border-color:rgba(99,102,241,0.15); box-shadow:0 0 0 1px rgba(99,102,241,0.08), 0 28px 60px -10px rgba(0,0,0,0.12); }
        .dash-preview-titlebar { height:36px; background:#12122a; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:space-between; padding:0 12px; }
        html[data-theme='light'] .dash-preview-titlebar { background:#f8fafc; border-bottom-color:rgba(0,0,0,0.06); }
        .dash-preview-video { height:170px; position:relative; background:linear-gradient(135deg,#0c0c22 0%,#16103a 50%,#0c1830 100%); display:flex; align-items:center; justify-content:center; }
        html[data-theme='light'] .dash-preview-video { background:linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%); }
        .dash-preview-chat { padding:10px 12px; display:flex; flex-direction:column; gap:7px; }
        .dash-bubble-in { background:rgba(255,255,255,0.07); border-radius:10px 10px 10px 2px; padding:5px 9px; font-size:11px; color:rgba(255,255,255,0.7); }
        html[data-theme='light'] .dash-bubble-in { background:rgba(0,0,0,0.06); color:#374151; }
        .dash-bubble-out { background:linear-gradient(135deg,#6366f1,#7c3aed); border-radius:10px 10px 2px 10px; padding:5px 9px; font-size:11px; color:#fff; }
        .dash-typing-dot { width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,0.3); animation:dashTypingBounce 1.2s ease infinite; }
        html[data-theme='light'] .dash-typing-dot { background:rgba(0,0,0,0.25); }

        @media (max-width: 560px) {
          .dash-join-form { flex-direction:column;border-radius:12px; }
          .dash-join-input { width:100%;padding:14px 16px; }
          .dash-join-btn { width:100%;justify-content:center;padding:14px; }
        }
        @media (max-width: 980px) {
          .dash-preview-wrap { display:none !important; }
        }
      `}</style>

      <Navbar />

      <div className="dash-orb dash-orb-1" />
      <div className="dash-orb dash-orb-2" />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 1040, display: 'flex', alignItems: 'center', gap: 64, justifyContent: 'center' }}>
          <div style={{ flex: '1 1 0', maxWidth: 480 }}>
            <p className="dash-greeting">{getGreeting(t)}{displayName ? `, ${displayName}` : ''}</p>
            <h1 className="dash-title" style={{ fontSize: 'clamp(30px,4vw,42px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 12px', letterSpacing: '-1px' }}>
              {t('readyToWatch', 'Ready to watch something?')}
            </h1>
            <p className="dash-sub" style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 32px' }}>
              {t('dashSubtitle', 'Start a new watch party or jump into one with a Room ID.')}
            </p>

            <div className="dash-card">
              <button onClick={createRoom} className="create-room-hero-btn stay-white"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff', padding: '17px 24px', fontSize: 16, borderRadius: 14, fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', marginBottom: 16 }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(168,85,247,0.25)'; }}
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

          {/* Decorative room preview — purely visual, no copy/marketing, just fills
              the window so the desktop app doesn't read as a bare form. */}
          <div className="dash-preview-wrap">
            <div className="dash-preview-card">
              <div className="dash-preview-titlebar">
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#ff5f57', '#ffbd2e', '#28c840'].map((c, i) => (<div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4eff9a', display: 'inline-block', animation: 'dashLiveDot 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: 10, color: '#4eff9a', fontWeight: 700, letterSpacing: 0.5 }}>LIVE</span>
                </div>
              </div>
              <div className="dash-preview-video">
                <div style={{ position: 'absolute', width: 140, height: 140, background: 'radial-gradient(circle,rgba(99,102,241,0.22) 0%,transparent 70%)', borderRadius: '50%', filter: 'blur(18px)' }} />
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(99,102,241,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 11px rgba(99,102,241,0.12), 0 0 36px rgba(99,102,241,0.4)', position: 'relative', zIndex: 1 }}>
                  <Play fill="#fff" size={18} style={{ marginLeft: 2 }} />
                </div>
              </div>
              <div className="dash-preview-chat">
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                  <div className="dash-bubble-in">🔥🔥🔥</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div className="dash-bubble-out">😂😂</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[0, 0.2, 0.4].map((d, i) => (<div key={i} className="dash-typing-dot" style={{ animationDelay: `${d}s` }} />))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} loggedInUsername={loggedInUsername} />
    </div>
  );
};

export default Dashboard;
