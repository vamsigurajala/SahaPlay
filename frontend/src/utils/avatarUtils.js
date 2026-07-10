// Matches the API-base-URL detection already duplicated across every page/component
// in this app (Profile.jsx, Navbar.jsx, Room.jsx, Home.jsx, etc.) — kept identical here
// rather than introducing a new VITE_API_URL env var this project doesn't define.
const API_BASE = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

function resolveAssetUrl(assetPath) {
  if (!assetPath) return null;
  // Already a full URL (Supabase CDN, or any other absolute http(s) URL) — use as-is.
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
  // Legacy local path (e.g. "/avatars/1-....png") — prepend the API server.
  return `${API_BASE}${assetPath}`;
}

export function getAvatarUrl(avatarPath) {
  return resolveAssetUrl(avatarPath);
}

export function getRoomThumbnailUrl(thumbnailPath) {
  return resolveAssetUrl(thumbnailPath);
}

export function getInitials(username) {
  if (!username) return '?';
  const clean = username.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(0, 2).toUpperCase() || '??';
}

export function stringToColor(str) {
  if (!str) return '#7c3aed';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)}, 55%, 45%)`;
}
