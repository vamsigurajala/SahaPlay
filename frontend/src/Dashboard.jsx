import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, Pin, Hash, Users } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import CreateRoomModal from './components/CreateRoomModal';
import Navbar from './components/Navbar';
import { getRoomThumbnailUrl } from './utils/avatarUtils';
import { API } from './lib/api';

const getCategoryLabel = (id, t) => {
  const emojiMap = { movies: '🎬', anime: '⛩️', songs: '🎵', gaming: '🎮', sports: '⚽', other: '✨' };
  const keyMap = { movies: 'catMovies', anime: 'catAnime', songs: 'catMusic', gaming: 'catGaming', sports: 'catSports', other: 'catOther' };
  const defaultMap = { movies: 'Movies', anime: 'Anime', songs: 'Music', gaming: 'Gaming', sports: 'Sports', other: 'Other' };
  return `${emojiMap[id] || '✨'} ${t(keyMap[id] || 'catOther', defaultMap[id] || 'Other')}`;
};

// Minimal, functional-first landing view for the Tauri desktop app — reuses the
// same Create Room / Join Room / Pinned Rooms pieces as Home.jsx, but skips the
// marketing hero copy, animated mockup, chat demo, platform showcase and FAQ
// that make sense for a public website but not for an already-installed app.
const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [roomId, setRoomId] = useState('');
  const token = localStorage.getItem('watch_token');
  const loggedInUsername = localStorage.getItem('watch_username');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  const [pinnedRooms, setPinnedRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    if (!isLoggedIn || isGuest) {
      navigate('/login');
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="page-enter" style={{ minHeight: '100vh' }}>
      <Toaster position="top-center" />
      <style>{`
        .dash-title { color:#fff; }
        html[data-theme='light'] .dash-title { color:#0f172a !important; }
        .dash-join-form { display:flex;align-items:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden; }
        .dash-join-btn { border:none;padding:16px 22px;font-weight:700;font-size:15px;cursor:pointer;transition:background 0.2s;background:rgba(99,102,241,0.2);color:#a5b4fc; }
        .dash-join-btn:hover { background:rgba(99,102,241,0.35); }
        html[data-theme='light'] .dash-join-form { background:#fff;border-color:rgba(0,0,0,0.1);box-shadow:0 2px 12px rgba(0,0,0,0.06); }
        html[data-theme='light'] .dash-join-btn { background:#f1f5f9 !important;color:#4f46e5 !important; }
        html[data-theme='light'] .dash-join-btn:hover { background:#e2e8f0 !important; }
        .dash-join-input { background:transparent;border:none;outline:none;padding:16px 20px;font-size:15px;width:220px;color:#fff; }
        html[data-theme='light'] .dash-join-input { color:#111 !important; }
        .dash-link-btn { background:none;border:none;color:#a855f7;cursor:pointer;font-weight:600;padding:0 4px;font-size:14px;text-decoration:none;transition:color 0.2s; }
        .dash-link-btn:hover { text-decoration:underline; }
        html[data-theme='light'] .dash-link-btn { color:#4f46e5 !important; }

        .section-heading { font-size:24px;font-weight:800;margin:0;color:#fff; }
        html[data-theme='light'] .section-heading { color:#000 !important; }
        .section-icon-badge { width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:#a0aab2; }
        html[data-theme='light'] .section-icon-badge { background:#fff;border-color:rgba(0,0,0,0.1);color:#111;box-shadow:0 2px 8px rgba(0,0,0,0.05); }

        .pinned-grid { display:grid;grid-template-columns:repeat(3, 1fr);gap:20px; }
        .pinned-card { border-radius:16px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:#12121a;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform 0.3s ease,box-shadow 0.3s ease,border-color 0.3s ease;display:flex;flex-direction:column;overflow:hidden; }
        .pinned-card:hover { transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,0.5);border-color:rgba(99,102,241,0.5); }
        .img-layer { height:130px;position:relative;overflow:hidden; }
        .pinned-img { width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease; }
        .pinned-card:hover .pinned-img { transform:scale(1.08); }
        .cat-badge { position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:6px 12px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.5px;z-index:10; }
        html[data-theme='light'] .cat-badge { color:#ffffff !important; background:rgba(0,0,0,0.6) !important; }
        .unpin-btn { position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:#fff;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);z-index:10; }
        .unpin-btn:hover { background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.4);box-shadow:0 0 20px rgba(239,68,68,0.3);transform:scale(1.1); }
        .unpin-btn .unpin-icon { transition:fill 0.3s ease;fill:none; }
        .unpin-btn:hover .unpin-icon { fill:currentColor; }
        .footer-layer { background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.12));padding:12px 16px;display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.05); }
        html[data-theme='light'] .footer-layer { background:#fff !important;border-top:1px solid rgba(0,0,0,0.04) !important; }
        html[data-theme='light'] .unpin-btn { background:#f1f5f9 !important;border-color:rgba(0,0,0,0.1) !important;color:#475569 !important; }
        html[data-theme='light'] .unpin-btn:hover { background:#fff !important;border-color:#4f46e5 !important;color:#4f46e5 !important; }
        .join-btn { background:linear-gradient(135deg,#6366f1,#a855f7);border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275); }
        .pinned-card:hover .join-btn { transform:translateY(-2px); }
        html[data-theme='light'] .join-btn { background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff !important; }
        html[data-theme='light'] .pinned-card { background:#fff;border-color:rgba(99,102,241,0.08);box-shadow:0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 16px -6px rgba(0, 0, 0, 0.03); }
        html[data-theme='light'] .pinned-card:hover { border-color:#6366f1;box-shadow:0 20px 35px -5px rgba(99, 102, 241, 0.18), 0 10px 20px -10px rgba(0, 0, 0, 0.06); }

        @media(max-width:640px){
          .dash-header-row{ flex-direction:column !important;align-items:stretch !important;text-align:center !important; }
          .dash-join-form{ flex-direction:column !important; border-radius:12px !important; }
          .dash-join-input{ width:100% !important; padding:14px 16px !important; border-bottom:1px solid rgba(255,255,255,0.08); }
          .dash-join-btn{ width:100% !important; padding:14px !important; justify-content:center !important; text-align:center; }
          .pinned-grid{ grid-template-columns:repeat(2, 1fr) !important; gap:12px !important; }
        }
      `}</style>

      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} loggedInUsername={loggedInUsername} />
      <Navbar />

      <section style={{ padding: '48px 40px 40px' }}>
        <div className="dash-header-row" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <h1 className="dash-title" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            {t('welcomeBack', 'Welcome back{{name}}', { name: loggedInUsername ? `, ${loggedInUsername}` : '' })}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button onClick={createRoom} className="create-room-hero-btn stay-white"
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff', padding: '14px 26px', fontSize: 15, borderRadius: 14, fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,85,247,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Play size={17} fill="#fff" strokeWidth={0} /><span className="stay-white">{t('createRoom', 'Create Room')}</span>
            </button>
            <form onSubmit={handleJoin} className="dash-join-form">
              <input type="text" placeholder={t('enterRoomId', 'Enter Room ID...')} value={roomId} onChange={e => setRoomId(e.target.value)} className="dash-join-input" />
              <button type="submit" className="dash-join-btn">{t('join', 'Join')}</button>
            </form>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: '16px auto 0', textAlign: 'center' }}>
          <span className="dash-link-btn" style={{ cursor: 'pointer' }} onClick={() => navigate('/public')}>{t('browsePublicRooms', 'Browse public rooms')}</span>
        </div>
      </section>

      {pinnedRooms && pinnedRooms.length > 0 && (
        <section className="pinned-rooms-section" style={{ padding: '0 40px 60px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div className="section-icon-badge"><Pin size={18} /></div>
              <h2 className="section-heading">{t('pinnedRooms', 'Pinned Rooms')}</h2>
            </div>
            <div className="pinned-grid">
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
    </div>
  );
};

export default Dashboard;
