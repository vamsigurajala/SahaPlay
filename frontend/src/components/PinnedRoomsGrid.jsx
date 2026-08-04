import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pin, Hash, Users } from 'lucide-react';
import { getRoomThumbnailUrl } from '../utils/avatarUtils';

const getCategoryLabel = (id, t) => {
  const emojiMap = { movies: '🎬', anime: '⛩️', songs: '🎵', gaming: '🎮', sports: '⚽', other: '✨' };
  const keyMap = { movies: 'catMovies', anime: 'catAnime', songs: 'catMusic', gaming: 'catGaming', sports: 'catSports', other: 'catOther' };
  const defaultMap = { movies: 'Movies', anime: 'Anime', songs: 'Music', gaming: 'Gaming', sports: 'Sports', other: 'Other' };
  return `${emojiMap[id] || '✨'} ${t(keyMap[id] || 'catOther', defaultMap[id] || 'Other')}`;
};

// Presentational only — deliberately owns no CSS. Home.jsx and PinnedRooms.jsx
// each already define (and have independently drifted on) .pinned-card/.img-layer/
// etc in their own <style> blocks; this component just reuses those class names,
// so both host pages keep rendering pixel-identical to before this extraction.
// `gridClassName`/`gridStyle` and `fadeIn` let each host pass its own prior values.
export default function PinnedRoomsGrid({ rooms, onUnpin, gridClassName = 'pinned-grid', gridStyle, fadeIn = false, titleColor }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className={gridClassName} style={gridStyle}>
      {rooms.map(room => (
        <div key={room.id} className="pinned-card" onClick={() => navigate(`/room/${room.id}`)}>
          <div className="img-layer">
            <img
              src={getRoomThumbnailUrl(room.thumbnailPath) || `https://picsum.photos/seed/${room.id}/600/400`}
              alt={t('roomCover', 'Room Cover')}
              className="pinned-img"
              {...(fadeIn ? { onLoad: (e) => e.target.classList.add('loaded') } : {})}
            />
            <div className="cat-badge">{getCategoryLabel(room.category, t)}</div>
            <button className="unpin-btn" onClick={(e) => onUnpin(e, room.id)} title="Unpin Room">
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, ...(titleColor ? { color: titleColor } : {}), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{room.name}</h3>
              <button className="join-btn">{t('join', 'Join')}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
