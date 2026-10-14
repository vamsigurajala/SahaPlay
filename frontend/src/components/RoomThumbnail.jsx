import React from 'react';
import { ImageOff } from 'lucide-react';
import { getRoomThumbnailUrl } from '../utils/avatarUtils';

// Shared room-cover renderer — real thumbnail when the host set one, otherwise
// a plain "no image" placeholder (styled per light/dark theme in index.css via
// .room-thumb-fallback / .room-thumb-fallback-icon) instead of relying on an
// external image host, which silently renders blank when that host is
// unreachable.
// loading: 'lazy' (default, right for a long/unbounded list like PublicRooms
// or the full Pinned Rooms page, most of which starts off-screen) or
// 'eager' for a small, always-above-the-fold set (Home.jsx's own bounded
// 6-room previews) — lazy-loading there only adds a non-deterministic delay
// before the browser even starts a load that was going to happen
// immediately anyway, which read as "thumbnails loading slowly" even though
// Supabase already serves them with a 1-year Cache-Control (server.js's own
// upload comment) and the room data itself is already instant from cache.
export default function RoomThumbnail({ thumbnailPath, imgClassName, alt, onLoad, loading = 'lazy' }) {
  const url = getRoomThumbnailUrl(thumbnailPath);
  if (url) {
    return <img src={url} alt={alt || 'Room Cover'} className={imgClassName} onLoad={onLoad} loading={loading} decoding="async" />;
  }
  return (
    <div className="room-thumb-fallback">
      <ImageOff className="room-thumb-fallback-icon" size={30} strokeWidth={1.5} />
    </div>
  );
}
