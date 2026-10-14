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
//
// `pinnedIds` + `onTogglePin` turn the corner button from an always-visible
// "Unpin" (the Pinned Rooms grid's only use before Room History existed) into
// a real pin/unpin toggle per room — pass both together for a grid that can
// contain a mix of pinned/unpinned rooms (Room History); omit both and keep
// using `onUnpin` alone for a grid that's ALWAYS all-pinned (Pinned Rooms
// itself), which is exactly the original behavior, unchanged.
export default function PinnedRoomsGrid({ rooms, onUnpin, pinnedIds, onTogglePin, gridClassName = 'pinned-grid', gridStyle, fadeIn = false, titleColor, thumbnailLoading = 'lazy' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const historyMode = Array.isArray(pinnedIds);

  return (
    <div className={gridClassName} style={gridStyle}>
      {rooms.map(room => {
        const isPinned = historyMode ? pinnedIds.includes(room.id) : true;
        const handlePinClick = (e) => (historyMode ? onTogglePin(e, room.id, isPinned) : onUnpin(e, room.id));
        return (
        <div
          key={room.id}
          className="pinned-card"
          onClick={() => navigate(`/room/${room.id}`)}
          // Starts warming the Room route's lazy chunk the instant a finger/
          // cursor presses down on the card — tens to a couple hundred ms
          // before the click actually fires — instead of only starting on
          // click, when the room chunk (large: player + chat + every
          // game/media integration) may not be cached yet and its fetch+parse
          // is what "takes a long time to load" was reported as.
          onPointerDown={() => import('../Room').catch(() => {})}
        >
          <div className="img-layer">
            <RoomThumbnail
              thumbnailPath={room.thumbnailPath}
              alt={t('roomCover', 'Room Cover')}
              imgClassName="pinned-img"
              loading={thumbnailLoading}
              {...(fadeIn ? { onLoad: (e) => e.target.classList.add('loaded') } : {})}
            />
            <div className="cat-badge">{getCategoryLabel(room.category, t)}</div>
            <div className="room-id-badge"><Hash size={9} /> {room.id}</div>
            <button className="unpin-btn" onClick={handlePinClick} title={isPinned ? t('unpinRoom', 'Unpin Room') : t('pinRoom', 'Pin Room')}>
              <Pin className="unpin-icon" size={16} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="footer-layer">
            <h3 className="room-card-title" style={titleColor ? { color: titleColor } : undefined}>{room.name}</h3>
            <div className="room-card-bottom-row">
              <div className="room-card-meta">
                <span><Users size={11} /> {room.userCount}{room.userCount > 0 ? ` ${t('watching', 'watching')}` : ''}</span>
              </div>
              <button className="join-btn">{t('join', 'Join')}</button>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
