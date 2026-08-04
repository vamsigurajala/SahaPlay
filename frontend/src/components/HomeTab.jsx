import React from 'react';
import { Play, Pin } from 'lucide-react';
import PinnedRoomsGrid from './PinnedRoomsGrid';

// The standalone-PWA/TWA "Home" tab — a compact app-shell view combining
// create/join (reusing Home.jsx's own createRoom()/handleJoin() and its
// CreateRoomModal, passed down as props rather than duplicated here) with
// a pinned-rooms grid below. Deliberately skips the full marketing landing
// page (hero animation, chat demo, FAQ, etc.) that Home.jsx shows on regular
// mobile/desktop web visits — that content doesn't belong in an installed
// app's home screen. Relies on Home.jsx's own <style> block (always mounted
// regardless of which branch renders) for the shared .pinned-card/.img-layer/
// etc rules that PinnedRoomsGrid's markup depends on.
export default function HomeTab({ roomId, setRoomId, handleJoin, createRoom, pinnedRooms, onUnpin, t }) {
  const hasPinned = pinnedRooms && pinnedRooms.length > 0;
  return (
    <div style={{
      padding: '28px 20px 100px', maxWidth: 640, margin: '0 auto',
      ...(hasPinned ? {} : { minHeight: 'calc(100dvh - 130px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }),
    }}>
      <style>{`
        /* !important here: this button's text must stay white regardless of
           theme (it sits on the brand gradient background either way) — a
           global light-mode text-color rule was otherwise winning by
           specificity and rendering it black in light mode. */
        .home-tab-create-btn { width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:var(--brand-gradient);border:none;color:#fff !important;padding:16px;font-size:16px;border-radius:14px;font-weight:700;cursor:pointer; }
        .home-tab-join-form { display:flex;align-items:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;overflow:hidden;margin-top:12px; }
        html[data-theme='light'] .home-tab-join-form { background:#fff;border-color:rgba(0,0,0,0.1); }
        .home-tab-join-input { flex:1;background:transparent;border:none;outline:none;padding:14px 16px;font-size:15px;color:#fff;min-width:0; }
        html[data-theme='light'] .home-tab-join-input { color:#111 !important; }
        .home-tab-join-btn { border:none;padding:14px 20px;font-weight:700;font-size:14px;cursor:pointer;background:rgba(var(--brand-1-rgb),0.2);color:var(--brand-1-light); }
        html[data-theme='light'] .home-tab-join-btn { background:#f1f5f9 !important;color:var(--brand-1-dark) !important; }
        .home-tab-pinned-grid { display:grid;grid-template-columns:repeat(2, 1fr);gap:14px; }
      `}</style>

      <button onClick={createRoom} className="home-tab-create-btn">
        <Play size={18} fill="#fff" strokeWidth={0} /> <span className="stay-white">{t('createRoom', 'Create Room')}</span>
      </button>

      <form onSubmit={handleJoin} className="home-tab-join-form">
        <input
          type="text"
          placeholder={t('enterRoomId', 'Enter Room ID...')}
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          className="home-tab-join-input"
        />
        <button type="submit" className="home-tab-join-btn">{t('join', 'Join')}</button>
      </form>

      {hasPinned && (
        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Pin size={16} />
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t('pinnedRooms', 'Pinned Rooms')}</h2>
          </div>
          <PinnedRoomsGrid rooms={pinnedRooms} onUnpin={onUnpin} gridClassName="home-tab-pinned-grid" />
        </div>
      )}
    </div>
  );
}
