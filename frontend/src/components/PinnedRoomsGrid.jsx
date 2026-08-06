import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pin, Hash, Users } from 'lucide-react';
import RoomThumbnail from './RoomThumbnail';

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
            <RoomThumbnail
              thumbnailPath={room.thumbnailPath}
              alt={t('roomCover', 'Room Cover')}
              imgClassName="pinned-img"
              {...(fadeIn ? { onLoad: (e) => e.target.classList.add('loaded') } : {})}
            />
            <div className="cat-badge">{getCategoryLabel(room.category, t)}</div>
            <button className="unpin-btn" onClick={(e) => onUnpin(e, room.id)} title="Unpin Room">
              <Pin className="unpin-icon" size={16} />
            </button>
          </div>
          <div className="footer-layer">
            <h3 className="room-card-title" style={titleColor ? { color: titleColor } : undefined}>{room.name}</h3>
            <div className="room-card-bottom-row">
              <div className="room-card-meta">
                <span><Hash size={10} /> {room.id}</span>
                <span className="room-card-meta-dot">&bull;</span>
                <span><Users size={11} /> {room.userCount}</span>
              </div>
              <button className="join-btn">{t('join', 'Join')}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
