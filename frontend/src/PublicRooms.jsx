import React, { useState, useEffect, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Filter, Pin, Star, Hash, Users, Lock } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RoomThumbnail from './components/RoomThumbnail';
import RoomCardSkeleton from './components/RoomCardSkeleton';
import PullToRefresh from './components/PullToRefresh';
import { API } from './lib/api';
import { isStandalonePWA } from './lib/platform';


const catMap = {
  movies: '🎬 Movies',
  anime: '⛩️ Anime',
  songs: '🎵 Music',
  gaming: '🎮 Gaming',
  sports: '⚽ Sports',
  other: '✨ Other'
};

const getCategoryLabel = (id, t) => {
  const emojiMap = {
    movies: '🎬',
    anime: '⛩️',
    songs: '🎵',
    gaming: '🎮',
    sports: '⚽',
    other: '✨'
  };
  const keyMap = {
    movies: 'catMovies',
    anime: 'catAnime',
    songs: 'catMusic',
    gaming: 'catGaming',
    sports: 'catSports',
    other: 'catOther'
  };
  const defaultMap = {
    movies: 'Movies',
    anime: 'Anime',
    songs: 'Music',
    gaming: 'Gaming',
    sports: 'Sports',
    other: 'Other'
  };
  const emoji = emojiMap[id] || '✨';
  const key = keyMap[id] || 'catOther';
  const defaultVal = defaultMap[id] || 'Other';
  return `${emoji} ${t(key, defaultVal)}`;
};

const PublicRooms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [publicRooms, setPublicRooms] = useState([]);
  // Only ever set true->false once, on the very first load — the 4s poll
  // below must never flip it back to true, or the grid would flicker back
  // to a skeleton on every refresh. Before this, an empty publicRooms array
  // during the first (possibly Render-cold-start-delayed) fetch was
  // indistinguishable from a genuinely empty result, so the page would
  // confidently show "No Public Rooms Available" while still loading.
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [profile, setProfile] = useState(null);

  const token = localStorage.getItem('watch_token');

  const handleLogout = () => {
    clearUserSession();
    navigate('/login');
  };

  const loggedInUsername = localStorage.getItem('watch_username');


  // Lifted out of the effect (and memoized) so pull-to-refresh can call this
  // directly to reload just this page's own data instead of the whole app.
  const fetchRooms = useCallback(() => {
    return fetch(`${API}/api/rooms/public`)
      .then(r => r.json())
      .then(data => { if(Array.isArray(data)) setPublicRooms(data); })
      .catch(err => console.error('Failed to load public rooms', err))
      .finally(() => setIsLoading(false));
  }, []);

  // The 4s poll below already self-heals a stale thumbnail eventually, but
  // patching in place the moment GlobalChatWidget rebroadcasts the server's
  // room_thumbnail_updated event avoids up to a 4s-stale card in the
  // meantime, matching every other room list's behavior.
  useEffect(() => {
    const onThumbnailUpdated = (e) => {
      const { roomId, thumbnailPath } = e.detail || {};
      if (!roomId) return;
      setPublicRooms(prev => prev.map(r => (r.id || '').toLowerCase() === roomId.toLowerCase() ? { ...r, thumbnailPath } : r));
    };
    window.addEventListener('room_thumbnail_updated', onThumbnailUpdated);
    return () => window.removeEventListener('room_thumbnail_updated', onThumbnailUpdated);
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 4000);

    if (token) {
      fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setProfile(data))
        .catch(() => {});
    }

    return () => clearInterval(interval);
  }, [token, fetchRooms]);

  const handleMakePrivate = async (e, roomId) => {
    e.stopPropagation();
    if (!loggedInUsername) return;
    try {
      const res = await fetch(`${API}/api/rooms/make-private`, {
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
    <PullToRefresh>
    <div style={{ minHeight: '100vh' }}>
      <Toaster position="top-center" />
      <style>{`
        @keyframes roomCardIn {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pinned-card {
          border-radius: 20px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.08);
          background: #12121a;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: roomCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards;
          animation-delay: calc(var(--card-i, 0) * 45ms);
        }
        .pinned-card:hover {
          transform: translateY(-6px) scale(1.015);
          box-shadow: 0 16px 34px rgba(0,0,0,0.5);
          border-color: rgba(var(--brand-1-rgb),0.5);
        }
        .pinned-card:active {
          transform: translateY(-2px) scale(0.99);
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
          top: 10px;
          left: 10px;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(6px);
          color: #fff;
          padding: 4px 9px;
          border-radius: 8px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.3px;
          z-index: 10;
        }
        .room-id-badge {
          position: absolute;
          bottom: 10px;
          left: 10px;
          display: flex;
          align-items: center;
          gap: 3px;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(6px);
          color: #fff;
          padding: 3px 8px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2px;
          z-index: 10;
        }
        /* Room name gets its own full-width line now instead of being squeezed
           next to the Join button; id/participant-count demoted to one small
           muted line below it instead of two pills sitting above the name. */
        .footer-layer {
          background: linear-gradient(135deg, rgba(var(--brand-1-rgb),0.12), rgba(var(--brand-2-rgb),0.12));
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .room-card-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .room-card-bottom-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .room-card-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          color: #8a8f98;
          min-width: 0;
          overflow: hidden;
        }
        .room-card-meta span {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
        }
        html[data-theme='light'] .room-card-meta { color: #64748b; }
        .join-btn {
          background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
          border: none;
          color: #fff;
          padding: 5px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .nav-icon-btn { position: relative; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .nav-icon-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
        .nav-icon-btn.active { background: rgba(var(--brand-1-rgb),0.12); border-radius: 12px; border-color: rgba(255,255,255,0.15); color: var(--brand-1-light); }
        
        .cat-tab {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a0aab2;
          padding: 8px 16px;
          border-radius: 12px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cat-tab:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .cat-tab.active { background: rgba(var(--brand-1-rgb),0.2); border-color: rgba(var(--brand-1-rgb),0.5); color: var(--brand-1-light); }
        
        html[data-theme='light'] .cat-tab { background: #fff; border-color: rgba(0,0,0,0.08); color: #64748b; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        html[data-theme='light'] .cat-tab:hover { background: #f8fafc; color: #1e293b; border-color: rgba(0,0,0,0.15); }
        html[data-theme='light'] .cat-tab.active { background: var(--brand-1); border-color: var(--brand-1); color: #fff !important; box-shadow: 0 4px 12px rgba(var(--brand-1-rgb),0.25); }
        html[data-theme='light'] .cat-tab.active * { color: #fff !important; }

        /* Filter row */
        .cat-filter-row {
          display: flex;
          flex-wrap: nowrap;
          gap: 10px;
          margin-bottom: 40px;
          overflow-x: auto;
          padding-bottom: 10px;
        }

        /* Rooms grid */
        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        /* Mobile tweaks */
        @media (max-width: 640px) {
          .public-page-inner {
            padding: 0 16px !important;
          }
          .public-page-title {
            font-size: clamp(20px, 6.5vw, 26px) !important;
            white-space: nowrap !important;
          }
          .cat-filter-row {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 6px !important;
            margin-bottom: 24px;
            padding-bottom: 0;
            overflow-x: hidden !important;
          }
          .cat-tab {
            font-size: 11px !important;
            padding: 6px 2px !important;
            border-radius: 8px !important;
            text-align: center;
            justify-content: center;
            display: flex;
            align-items: center;
            white-space: nowrap;
          }
          .rooms-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .img-layer {
            height: 100px;
          }
          .footer-layer {
            padding: 8px 10px;
          }
          .footer-layer h3 {
            font-size: 13px !important;
            max-width: 90px !important;
          }
          .join-btn {
            padding: 4px 10px !important;
            font-size: 11px !important;
          }
          /* Smooth scrolling on mobile (notably the Android app WebView):
             backdrop-filter forces a per-frame GPU blur recomposite behind
             every element that uses it, and with a full grid of room cards
             (each carrying up to 2 of these small badges) on screen at once,
             that's dozens of blur layers recomposited on every scroll frame
             — the actual cause of the reported scroll stutter/jank. A flat,
             slightly more opaque background reads the same at this size
             without the compositing cost; desktop keeps the blur. */
          .cat-badge, .room-id-badge, .private-btn {
            backdrop-filter: none !important;
            background: rgba(0,0,0,0.6) !important;
          }
        }

        /* Tablet tweaks */
        @media (min-width: 641px) and (max-width: 900px) {
          .rooms-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .public-page-inner {
            padding: 0 24px !important;
          }
          .cat-filter-row {
            flex-wrap: wrap;
            overflow-x: hidden;
            padding-bottom: 0;
          }
        }

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
          top: 8px;
          right: 8px;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(6px);
          border: none;
          color: #fff;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }
        .private-btn:hover {
          background: #ef4444;
          color: #fff;
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

        html[data-theme='light'] .cat-badge { background: rgba(0,0,0,0.5) !important; color: #fff !important; }
        html[data-theme='light'] .room-id-badge { background: rgba(0,0,0,0.5) !important; color: #fff !important; }
        
        html[data-theme='light'] .private-btn {
          background: rgba(255,255,255,0.85) !important;
          color: #111 !important;
        }
        html[data-theme='light'] .private-btn:hover {
          background: #ef4444 !important;
          color: #fff !important;
        }
        html[data-theme='light'] .nav-icon-btn.active { color: var(--brand-1) !important; background: rgba(var(--brand-1-rgb),0.1) !important; }
        
        html[data-theme='light'] .pinned-card { background: #ffffff; border-color: rgba(0,0,0,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        html[data-theme='light'] .pinned-card:hover { box-shadow: 0 12px 30px rgba(0,0,0,0.12); border-color: rgba(var(--brand-1-rgb),0.3); }
        html[data-theme='light'] .footer-layer { background: #fff !important; border-top: 1px solid rgba(0,0,0,0.04) !important; }
        html[data-theme='light'] .join-btn { background: var(--brand-gradient); color: #fff !important; box-shadow: 0 4px 12px rgba(var(--brand-1-rgb), 0.25); }
        html[data-theme='light'] .join-btn:hover { background: linear-gradient(135deg, var(--brand-1-dark), var(--brand-2-dark)); box-shadow: 0 6px 15px rgba(var(--brand-1-rgb), 0.4); }
        html[data-theme='light'] .pinned-card h3 { color: #000 !important; }
        html[data-theme='light'] .profile-pill { background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.08) !important; color: #111 !important; }

      `}</style>

      <Navbar />

      <section style={{ width: '100%', padding: '40px 0 80px' }}>
        <div className="public-page-inner" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>
          <h2 className="section-heading public-page-title" style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>{t('joinPublicRooms', 'Join Public Rooms')}</h2>
          <p className="section-desc" style={{ color: '#a0aab2', fontSize: '16px', marginBottom: '30px' }}>{t('explorePublic', 'Discover and join public watch parties around the world.')}</p>

        <div className="cat-filter-row">
          {Object.entries(catMap).map(([id, label]) => (
            <button
              key={id}
              className={`cat-tab ${selectedCategory === id ? 'active stay-white' : ''}`}
              onClick={() => { setSelectedCategory(id); setCurrentPage(1); }}
              style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {getCategoryLabel(id, t)}
            </button>
          ))}
        </div>

        {(() => {
          const filteredRooms = publicRooms.filter(room => (room.category || 'other') === selectedCategory);
          return isLoading ? (
          <div className="rooms-grid">
            <RoomCardSkeleton count={6} />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '18px' }}>No Public Rooms Available</h3>
            <p style={{ color: '#888', margin: 0 }}>No rooms match the "{getCategoryLabel(selectedCategory, t)}" category. Try selecting another or create your own!</p>
          </div>
        ) : (
          <>
            <div className="rooms-grid">
              {filteredRooms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((room, i) => (
                <div
                  key={room.id}
                  className="pinned-card"
                  style={{ '--card-i': i }}
                  onClick={() => navigate(`/room/${room.id}`)}
                  // Same head-start as PinnedRoomsGrid's cards — warms the
                  // Room route's (large) lazy chunk on press, before the
                  // click/navigate actually fires.
                  onPointerDown={() => import('./Room').catch(() => {})}
                >
                  <div className="img-layer">
                    <RoomThumbnail
                      thumbnailPath={room.thumbnailPath}
                      alt="Room Cover"
                      imgClassName="pinned-img"
                      onLoad={(e) => e.target.classList.add('loaded')}
                    />
                    <div className="cat-badge">{getCategoryLabel(room.category, t)}</div>
                    <div className="room-id-badge"><Hash size={9} /> {room.id}</div>
                    {loggedInUsername && room.hostUsername && (String(loggedInUsername).toLowerCase() === String(room.hostUsername).toLowerCase()) && (
                      <button className="private-btn" onClick={(e) => handleMakePrivate(e, room.id)} title={t('makePrivate', 'Make Private')}>
                        <Lock className="lock-icon" size={16} />
                      </button>
                    )}
                  </div>
                  <div className="footer-layer">
                    <h3 className="room-card-title">{room.name}</h3>
                    <div className="room-card-bottom-row">
                      <div className="room-card-meta">
                        <span><Users size={11} /> {room.userCount}{room.userCount > 0 ? ` ${t('watching', 'watching')}` : ''}</span>
                      </div>
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
                    background: currentPage === idx + 1 ? 'linear-gradient(135deg, var(--brand-1), var(--brand-2))' : 'rgba(255,255,255,0.05)',
                    border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
                    transition: 'transform 0.2s', boxShadow: currentPage === idx + 1 ? '0 2px 10px rgba(var(--brand-2-rgb),0.3)' : 'none'
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
      {!isStandalonePWA() && <Footer />}
    </div>
    </PullToRefresh>
  );
};

export default PublicRooms;





