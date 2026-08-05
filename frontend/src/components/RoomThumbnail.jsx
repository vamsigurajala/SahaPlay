import React from 'react';
import { ImageOff } from 'lucide-react';
import { getRoomThumbnailUrl } from '../utils/avatarUtils';

// Shared room-cover renderer — real thumbnail when the host set one, otherwise
// a plain "no image" placeholder (styled per light/dark theme in index.css via
// .room-thumb-fallback / .room-thumb-fallback-icon) instead of relying on an
// external image host, which silently renders blank when that host is
// unreachable.
export default function RoomThumbnail({ thumbnailPath, imgClassName, alt, onLoad }) {
  const url = getRoomThumbnailUrl(thumbnailPath);
  if (url) {
    return <img src={url} alt={alt || 'Room Cover'} className={imgClassName} onLoad={onLoad} />;
  }
  return (
    <div className="room-thumb-fallback">
      <ImageOff className="room-thumb-fallback-icon" size={30} strokeWidth={1.5} />
    </div>
  );
}
