import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pin, Hash, Users } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { getRoomThumbnailUrl } from './utils/avatarUtils';
import { API } from './lib/api';

const getCategoryLabel = (id, t) => {
  const emojiMap = { movies: '🎬', anime: '⛩️', songs: '🎵', gaming: '🎮', sports: '⚽', other: '✨' };
  const keyMap = { movies: 'catMovies', anime: 'catAnime', songs: 'catMusic', gaming: 'catGaming', sports: 'catSports', other: 'catOther' };
  const defaultMap = { movies: 'Movies', anime: 'Anime', songs: 'Music', gaming: 'Gaming', sports: 'Sports', other: 'Other' };
  return `${emojiMap[id] || '✨'} ${t(keyMap[id] || 'catOther', defaultMap[id] || 'Other')}`;
};

// Standalone "Pinned Rooms" page — the desktop (Tauri) Navbar links here directly
// instead of showing this grid inline on the Dashboard, matching how Public Rooms
// already gets its own page rather than being mixed into the home view.
const PinnedRooms = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const [pinnedRooms, setPinnedRooms] = useState([]);

  const fetchRooms = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      if (stored.length > 0) {
        fetch(`${API}/api/rooms/info?ids=${stored.join(',')}`)
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

  return (
    <div style={{ minHeight: '100vh' }}>
      <Toaster position="top-center" />
      <style>{`
        .pinned-card { border-radius:16px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:#12121a;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform 0.3s ease,box-shadow 0.3s ease,border-color 0.3s ease;display:flex;flex-direction:column;overflow:hidden; }
        .pinned-card:hover { transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,0.5);border-color:rgba(var(--brand-1-rgb),0.5); }
        .img-layer { height:130px;position:relative;overflow:hidden;background:linear-gradient(135deg,#1e1e2e 0%,#111119 100%); }
        html[data-theme='light'] .img-layer { background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%); }
        .pinned-img { width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease,opacity 0.4s ease;opacity:0; }
        .pinned-img.loaded { opacity:1; }
        .pinned-card:hover .pinned-img { transform:scale(1.08); }
        .cat-badge { position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:6px 12px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.5px;z-index:10; }
        html[data-theme='light'] .cat-badge { background:#fff;color:#111;border-color:rgba(0,0,0,0.1); }
        .unpin-btn { position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);color:#fff;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);z-index:10; }
        .unpin-btn:hover { background:rgba(239,68,68,0.2);color:#ef4444;border-color:rgba(239,68,68,0.4);box-shadow:0 0 20px rgba(239,68,68,0.3);transform:scale(1.1); }
        .unpin-btn .unpin-icon { transition:fill 0.3s ease;fill:none; }
        .unpin-btn:hover .unpin-icon { fill:currentColor; }
        html[data-theme='light'] .unpin-btn { background:#f1f5f9 !important;border-color:rgba(0,0,0,0.1) !important;color:#475569 !important; }
        html[data-theme='light'] .unpin-btn:hover { background:#fff !important;border-color:var(--brand-1-dark) !important;color:var(--brand-1-dark) !important; }
        .footer-layer { background:linear-gradient(135deg,rgba(var(--brand-1-rgb),0.12),rgba(var(--brand-2-rgb),0.12));padding:12px 16px;display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.05); }
        html[data-theme='light'] .footer-layer { background:#fff !important;border-top:1px solid rgba(0,0,0,0.04) !important; }
        .join-btn { background:linear-gradient(135deg,var(--brand-1),var(--brand-2));border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275); }
        .pinned-card:hover .join-btn { transform:translateY(-2px); }
        html[data-theme='light'] .join-btn { background:var(--brand-gradient);color:#fff !important; }

        .rooms-grid { display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;margin-bottom:40px; }

        html[data-theme='light'] body { background:#f7fafc !important;color:#111 !important; }
        html[data-theme='light'] .section-heading { color:#000 !important; }
        html[data-theme='light'] .section-desc { color:#4a5568 !important; }

        @media (max-width: 640px) {
          .rooms-grid { grid-template-columns:repeat(2, 1fr); gap:12px; }
          .img-layer { height:100px; }
          .footer-layer { padding:8px 10px; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .rooms-grid { grid-template-columns:repeat(2, 1fr); gap:16px; }
        }
      `}</style>

      <Navbar />

      <section style={{ width: '100%', padding: '40px 0 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <h2 className="section-heading" style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: '#fff' }}>{t('pinnedRooms', 'Pinned Rooms')}</h2>
          </div>
          <p className="section-desc" style={{ color: '#a0aab2', fontSize: '16px', marginBottom: '30px' }}>{t('pinnedRoomsDesc', 'Rooms you\'ve pinned for quick access.')}</p>

          {pinnedRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Pin size={28} style={{ opacity: 0.4, marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '18px' }}>{t('noPinnedRooms', 'No pinned rooms yet')}</h3>
              <p style={{ color: '#888', margin: 0 }}>{t('noPinnedRoomsDesc', 'Pin a room from its menu to see it here for quick access.')}</p>
            </div>
          ) : (
            <div className="rooms-grid">
              {pinnedRooms.map(room => (
                <div key={room.id} className="pinned-card" onClick={() => navigate(`/room/${room.id}`)}>
                  <div className="img-layer">
                    <img
                      src={getRoomThumbnailUrl(room.thumbnailPath) || `https://picsum.photos/seed/${room.id}/600/400`}
                      alt={t('roomCover', 'Room Cover')}
                      className="pinned-img"
                      onLoad={(e) => e.target.classList.add('loaded')}
                    />
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
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{room.name}</h3>
                      <button className="join-btn">{t('join', 'Join')}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default PinnedRooms;
