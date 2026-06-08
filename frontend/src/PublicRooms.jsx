import React, { useState, useEffect, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Filter, Pin, Star, Hash, Users, Lock } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const API = `http://${window.location.hostname}:3001`;


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
        .nav-icon-btn { position: relative; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .nav-icon-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
        .nav-icon-btn.active { background: rgba(99,102,241,0.12); border-radius: 12px; border-color: rgba(255,255,255,0.15); color: #818cf8; }
        
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
        html[data-theme='light'] .cat-tab.active { background: #6366f1; border-color: #6366f1; color: #fff !important; box-shadow: 0 4px 12px rgba(99,102,241,0.25); }
        html[data-theme='light'] .cat-tab.active * { color: #fff !important; }

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

      <Navbar />

      <section style={{ width: '100%', padding: '40px 0 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>
          <h2 className="section-heading" style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 10px', color: '#fff' }}>{t('joinPublicRooms', 'Public Rooms')}</h2>
          <p className="section-desc" style={{ color: '#a0aab2', fontSize: '16px', marginBottom: '30px' }}>{t('explorePublic', 'Discover and join public watch parties around the world.')}</p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '40px', overflowX: 'auto', paddingBottom: '10px' }}>
          {Object.entries(catMap).map(([id, label]) => (
            <button
              key={id}
              className={`cat-tab ${selectedCategory === id ? 'active stay-white' : ''}`}
              onClick={() => { setSelectedCategory(id); setCurrentPage(1); }}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {getCategoryLabel(id, t)}
            </button>
          ))}
        </div>

        {(() => {
          const filteredRooms = publicRooms.filter(room => (room.category || 'other') === selectedCategory);
          return filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '18px' }}>No Public Rooms Available</h3>
            <p style={{ color: '#888', margin: 0 }}>No rooms match the "{getCategoryLabel(selectedCategory, t)}" category. Try selecting another or create your own!</p>
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
                    <div className="cat-badge">{getCategoryLabel(room.category, t)}</div>
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
      <Footer />
    </div>
  );
};

export default PublicRooms;





