import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Hash, Users } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { getAvatarUrl, getRoomThumbnailUrl } from '../utils/avatarUtils';
import { API } from '../lib/api';

// Unified search — rooms (client-filtered against the same /api/rooms/public
// list PublicRooms.jsx fetches, since that endpoint has no server-side search
// param and the catalog is small enough that fetching once and filtering
// locally is simpler than adding one) + users (via the existing
// /api/users/search, same endpoint Navbar's old search dropdown used).
export default function SearchTabContent({ t }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [allRooms, setAllRooms] = useState(null);
  const [userResults, setUserResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/rooms/public`).then(r => r.json()).then(d => setAllRooms(Array.isArray(d) ? d : [])).catch(() => setAllRooms([]));
  }, []);

  useEffect(() => {
    if (!debouncedQuery) { setUserResults([]); return; }
    const token = localStorage.getItem('watch_token');
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    const headers = (!isGuest && token) ? { Authorization: `Bearer ${token}` } : {};
    setLoading(true);
    fetch(`${API}/api/users/search?q=${encodeURIComponent(debouncedQuery)}`, { headers })
      .then(r => r.json())
      .then(d => setUserResults(Array.isArray(d) ? d : []))
      .catch(() => setUserResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const q = debouncedQuery.trim().toLowerCase();
  const roomResults = q && allRooms
    ? allRooms.filter(r => (r.name || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q))
    : [];

  const hasQuery = !!debouncedQuery;
  const hasResults = roomResults.length > 0 || userResults.length > 0;

  return (
    <div>
      <style>{`
        .search-tab-input-wrap { display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:12px 16px;margin-bottom:20px; }
        html[data-theme='light'] .search-tab-input-wrap { background:#fff;border-color:rgba(0,0,0,0.1); }
        .search-tab-input { flex:1;background:transparent;border:none;outline:none;font-size:15px;color:#fff;min-width:0; }
        html[data-theme='light'] .search-tab-input { color:#111 !important; }
        .search-tab-section-title { font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#666;padding:0 2px 10px; }
        .search-tab-row { display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:12px;cursor:pointer; }
        .search-tab-row:hover { background:rgba(255,255,255,0.05); }
        html[data-theme='light'] .search-tab-row:hover { background:rgba(0,0,0,0.04); }
        .search-tab-thumb { width:44px;height:44px;border-radius:10px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center; }
        .search-tab-thumb img { width:100%;height:100%;object-fit:cover; }
      `}</style>

      <div className="search-tab-input-wrap">
        <Search size={16} color="#888" />
        <input
          autoFocus
          className="search-tab-input"
          placeholder={t('searchRoomsAndUsers', 'Search rooms and users...')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!hasQuery && (
        <div style={{ textAlign: 'center', color: '#666', fontSize: 13, padding: '40px 20px' }}>
          {t('searchPrompt', 'Search for a room by name/ID, or a user by username.')}
        </div>
      )}

      {hasQuery && !loading && !hasResults && (
        <div style={{ textAlign: 'center', color: '#666', fontSize: 13, padding: '40px 20px' }}>
          {t('noResultsFound', 'No results found.')}
        </div>
      )}

      {roomResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="search-tab-section-title">{t('rooms', 'Rooms')}</div>
          {roomResults.slice(0, 20).map(room => (
            <div key={room.id} className="search-tab-row" onClick={() => navigate(`/room/${room.id}`)}>
              <div className="search-tab-thumb">
                {room.thumbnailPath ? (
                  <img src={getRoomThumbnailUrl(room.thumbnailPath)} alt="" />
                ) : (
                  <Users size={18} color="#888" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name}</div>
                <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Hash size={10} />{room.id}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10} />{room.userCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {userResults.length > 0 && (
        <div>
          <div className="search-tab-section-title">{t('users', 'Users')}</div>
          {userResults.slice(0, 20).map(u => (
            <div key={u.username} className="search-tab-row" onClick={() => navigate(`/profile/${u.username}`)}>
              <div className="search-tab-thumb" style={{ borderRadius: '50%' }}>
                {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} alt="" /> : <User size={18} color="#888" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'inherit' }}>{u.displayName || u.username}</div>
                <div style={{ fontSize: 12, color: '#888' }}>@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
