import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Hash, Users, X } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { getAvatarUrl, getRoomThumbnailUrl } from '../utils/avatarUtils';
import { API } from '../lib/api';

// Unified search — rooms (client-filtered against the same /api/rooms/public
// list PublicRooms.jsx fetches, since that endpoint has no server-side search
// param and the catalog is small enough that fetching once and filtering
// locally is simpler than adding one) + users (via the existing
// /api/users/search, same endpoint Navbar's old search dropdown used).
export default function SearchTabContent({ t, onNavigate }) {
  const navigate = useNavigate();
  // BottomNav renders this inside a position:fixed, z-index:100000 full-screen
  // overlay — navigating to a room/profile changed the route underneath it,
  // but nothing closed the overlay itself, so the destination page rendered
  // fully hidden behind the still-open search screen. onNavigate is
  // BottomNav's navigateFrom, which closes the overlay (with the
  // skipNextClose handling that needs) before navigating.
  const goTo = (path) => (onNavigate ? onNavigate(path) : navigate(path));
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [allRooms, setAllRooms] = useState(null);
  const [userResults, setUserResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  useEffect(() => {
    fetch(`${API}/api/rooms/public`).then(r => r.json()).then(d => setAllRooms(Array.isArray(d) ? d : [])).catch(() => setAllRooms([]));
  }, []);

  // Profile and Room are both lazy-loaded route chunks (App.jsx's
  // lazy(() => import(...))) — tapping a search result for the very first
  // time in a session had to fetch that chunk on the spot, and the
  // Suspense fallback for it only appears after a 200ms delay (see
  // App.jsx's RouteLoadingFallback), so a load landing in that window
  // showed nothing new yet: whatever was on screen before the tap (this
  // search overlay closing down to reveal Home underneath) stayed visible
  // for that beat before the destination page finally appeared — read as
  // "shows Home for a split second, then the profile." Kicking off both
  // imports the moment this screen opens means that, by the time anyone
  // has typed a query and tapped a result, the chunk is already cached and
  // navigate() resolves to it immediately, same fetch-ahead pattern
  // GlobalChatWidget already uses for Room.
  useEffect(() => {
    import('../Profile').catch(() => {});
    import('../Room').catch(() => {});
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
  // Was recomputed on every render (including one triggered by literally
  // every keystroke, via `query`'s own state update) rather than only when
  // `q`/`allRooms` actually change — re-filtering the entire public-rooms
  // catalog on every single keypress is exactly the kind of per-keystroke
  // main-thread work that reads as "typing feels sluggish" on a slower
  // Android device, even though `q` itself only updates once per 300ms
  // debounce. useMemo ties the real cost to the debounce interval instead.
  const roomResults = useMemo(() => (
    q && allRooms
      ? allRooms.filter(r => (r.name || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q))
      : []
  ), [q, allRooms]);

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
        /* A long-press/tap-and-hold on a row (the common gesture on a touch
           device, not a deliberate "select this text" action) was triggering
           the browser's native text-selection + copy/share callout on the
           username/room name inside — never intended, since every row here
           is a single tap target that navigates, not selectable text.
           user-select covers the selection itself; -webkit-touch-callout
           additionally suppresses iOS/WebView's own long-press context menu
           that can still appear even with selection disabled; tap-highlight
           removes the grey flash Android/WebView paints on tap, which read
           as a stuck/laggy hover state on some devices. */
        .search-tab-row { display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:12px;cursor:pointer; user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent; }
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

      {!hasQuery && history.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', fontSize: 13, padding: '40px 20px' }}>
          {t('searchPrompt', 'Search for a room by name/ID, or a user by username.')}
        </div>
      )}

      {!hasQuery && history.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 10px' }}>
            <div className="search-tab-section-title" style={{ padding: 0 }}>{t('recentSearches', 'Recent')}</div>
            <span onClick={clearHistory} style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-1-light)', cursor: 'pointer' }}>
              {t('clearSearchHistory', 'Clear search history')}
            </span>
          </div>
          {history.map(h => {
            const isRoom = h.type === 'room';
            return (
              <div key={isRoom ? `room:${h.roomId}` : `user:${h.username}`} className="search-tab-row" style={{ paddingRight: 4 }}>
                <div
                  onClick={() => { addToHistory(h); goTo(isRoom ? `/room/${h.roomId}` : `/profile/${h.username}`); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
                >
                  <div className="search-tab-thumb" style={isRoom ? undefined : { borderRadius: '50%' }}>
                    {isRoom ? (
                      h.thumbnailPath ? <img src={getRoomThumbnailUrl(h.thumbnailPath)} alt="" /> : <Users size={18} color="#888" />
                    ) : (
                      h.avatarPath ? <img src={getAvatarUrl(h.avatarPath)} alt="" /> : <User size={18} color="#888" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isRoom ? h.roomName : (h.displayName || h.username)}</div>
                    <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isRoom ? (<><Hash size={10} />{h.roomId}</>) : `@${h.username}`}
                    </div>
                  </div>
                </div>
                <button onClick={() => removeFromHistory(h)} title={t('removeFromHistory', 'Remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 8, display: 'flex', flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>
            );
          })}
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
            <div key={room.id} className="search-tab-row" onClick={() => { addToHistory({ type: 'room', roomId: room.id, roomName: room.name, thumbnailPath: room.thumbnailPath }); goTo(`/room/${room.id}`); }}>
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
            <div key={u.username} className="search-tab-row" onClick={() => { addToHistory(u); goTo(`/profile/${u.username}`); }}>
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
