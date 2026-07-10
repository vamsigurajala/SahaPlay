// Centralized API base URL — replaces the inline hostname-detection constant
// (const API = /localhost|127.0.0.1|.../.test(window.location.hostname) ? ... : ...)
// duplicated across Room.jsx, Profile.jsx, Navbar.jsx, Home.jsx, App.jsx, GlobalChatWidget.jsx,
// and utils/avatarUtils.js.
//
// This project does not define VITE_API_URL/VITE_SOCKET_URL anywhere today — the app instead
// detects the backend host from window.location.hostname, which is required for LAN/Cast-to-TV
// access (a phone or TV opening the app from a LAN IP like 192.168.x.x must call the API on
// that same LAN IP, not "localhost"). VITE_API_URL/VITE_SOCKET_URL are honored as an optional
// override if ever set, but the hostname-detection logic remains the real fallback — a hardcoded
// 'http://localhost:3001' fallback would break both LAN access and production.
function detectApiBase() {
  const isLocalOrLan = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname);
  return isLocalOrLan
    ? `http://${window.location.hostname}:3001`
    : `https://${window.location.hostname}`;
}

const API_BASE = import.meta.env.VITE_API_URL || detectApiBase();

export const API = API_BASE;

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body.error || body.message || errorMessage;
    } catch {
      // response body not JSON, use status text
      errorMessage = res.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export function getAuthHeaders(token) {
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}
