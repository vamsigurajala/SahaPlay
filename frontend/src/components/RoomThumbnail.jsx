import React from 'react';
import { getRoomThumbnailUrl } from '../utils/avatarUtils';

// Shared room-cover renderer — real thumbnail when the host set one, otherwise
// a branded gradient + watermark instead of relying on an external image host
// (which silently renders blank when that host is unreachable).
export default function RoomThumbnail({ thumbnailPath, imgClassName, alt, onLoad }) {
  const url = getRoomThumbnailUrl(thumbnailPath);
  if (url) {
    return <img src={url} alt={alt || 'Room Cover'} className={imgClassName} onLoad={onLoad} />;
  }
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, rgba(var(--brand-1-rgb),0.3), rgba(var(--brand-2-rgb),0.3))',
    }}>
      <img src="/logos/trans_webl.png" alt="" style={{ width: '36%', maxWidth: 56, opacity: 0.5, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.35))' }} />
    </div>
  );
}
