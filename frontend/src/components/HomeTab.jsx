import React, { useState } from 'react';
import { Play, Pin, History } from 'lucide-react';
import PinnedRoomsGrid from './PinnedRoomsGrid';
import RoomCardSkeleton from './RoomCardSkeleton';

// The standalone-PWA/TWA "Home" tab — a compact app-shell view combining
// create/join (reusing Home.jsx's own createRoom()/handleJoin() and its
// CreateRoomModal, passed down as props rather than duplicated here) with
// a pinned-rooms grid below. Deliberately skips the full marketing landing
// page (hero animation, chat demo, FAQ, etc.) that Home.jsx shows on regular
// mobile/desktop web visits — that content doesn't belong in an installed
// app's home screen. Relies on Home.jsx's own <style> block (always mounted
// regardless of which branch renders) for the shared .pinned-card/.img-layer/
// etc rules that PinnedRoomsGrid's markup depends on.
export default function HomeTab({ roomId, setRoomId, handleJoin, createRoom, pinnedRooms, isPinnedLoading, showPinnedTab = true, onUnpin, roomHistory, isHistoryLoading, showHistoryTab = true, pinnedRoomIds, onTogglePin, t }) {
  const hasPinned = pinnedRooms && pinnedRooms.length > 0;
  const hasHistory = roomHistory && roomHistory.length > 0;
  // Whether each tab is shown depends only on whether the feature applies
  // to this user (guests don't get Room History, since it needs an
  // account) — never on whether that tab's bucket is currently empty. An
  // empty bucket renders its own "no rooms yet" empty state below instead
  // of the tab (or the whole section) disappearing, which was the reported
  // bug: a fresh account with zero created rooms lost the Room History tab
  // entirely instead of showing it empty.
  const showTabs = showPinnedTab && showHistoryTab;
  const [roomsTab, setRoomsTab] = useState('pinned');
  const activeTab = showTabs ? roomsTab : (showPinnedTab ? 'pinned' : 'history');
  return (
    <div style={{
      padding: '20px 16px 100px', maxWidth: 640, margin: '0 auto',
      ...((showPinnedTab || showHistoryTab) ? {} : { minHeight: 'calc(100dvh - 130px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }),
    }}>
      <style>{`
        .home-tab-hero { text-align: center; margin-bottom: 22px; }
        .home-tab-hero-icon {
          width: 56px; height: 56px; border-radius: 18px; background: var(--brand-gradient);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;
          box-shadow: 0 10px 24px rgba(var(--brand-1-rgb),0.35);
        }
        .home-tab-hero h1 { font-size: 21px; font-weight: 800; margin: 0 0 4px; }
        .home-tab-hero p { font-size: 13px; color: #888; margin: 0; }

        .home-tab-action-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 22px; padding: 20px; box-shadow: 0 8px 28px rgba(0,0,0,0.18);
        }
        html[data-theme='light'] .home-tab-action-card {
          background: #ffffff; border-color: rgba(0,0,0,0.06); box-shadow: 0 8px 28px rgba(15,23,42,0.06);
        }

        /* !important here: this button's text must stay white regardless of
           theme (it sits on the brand gradient background either way) — a
           global light-mode text-color rule was otherwise winning by
           specificity and rendering it black in light mode. */
        .home-tab-create-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--brand-gradient); border: none; color: #fff !important; padding: 16px;
          font-size: 16px; border-radius: 16px; font-weight: 700; cursor: pointer;
          box-shadow: 0 10px 24px rgba(var(--brand-1-rgb),0.3); transition: transform 0.15s ease;
        }
        .home-tab-create-btn:active { transform: scale(0.98); }

        .home-tab-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; color: #777; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; }
        .home-tab-divider::before, .home-tab-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
        html[data-theme='light'] .home-tab-divider::before, html[data-theme='light'] .home-tab-divider::after { background: rgba(0,0,0,0.08); }

        .home-tab-join-form { display: flex; align-items: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; }
        html[data-theme='light'] .home-tab-join-form { background: #f8fafc; border-color: rgba(0,0,0,0.08); }
        .home-tab-join-input { flex: 1; background: transparent; border: none; outline: none; padding: 14px 16px; font-size: 15px; color: #fff; min-width: 0; }
        html[data-theme='light'] .home-tab-join-input { color: #111 !important; }
        .home-tab-join-btn { border: none; padding: 14px 20px; font-weight: 700; font-size: 14px; cursor: pointer; background: rgba(var(--brand-1-rgb),0.2); color: var(--brand-1-light); }
        html[data-theme='light'] .home-tab-join-btn { background: #e2e8f0 !important; color: var(--brand-1-dark) !important; }

        .home-tab-pinned-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .home-tab-pinned-title { display: flex; align-items: center; gap: 10px; }
        .home-tab-pinned-count { background: rgba(var(--brand-1-rgb),0.15); color: var(--brand-1-light); font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
        .home-tab-pinned-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }

        /* Same underline-tab pattern as Home.jsx's desktop rooms-tab-row,
           scaled down — Pinned Rooms and Room History are one section here
           too, not two separately-titled blocks stacked on top of each
           other. No full-width baseline, just the active tab's underline. */
        .home-tab-rooms-tabs { display: flex; gap: 24px; margin-bottom: 16px; }
        .home-tab-rooms-tab-btn {
          display: flex; align-items: center; gap: 8px; background: transparent; border: none; cursor: pointer;
          padding: 2px 2px 12px; font-size: 18px; font-weight: 800; font-family: inherit;
          color: #6b7280; position: relative; transition: color 0.18s;
        }
        .home-tab-rooms-tab-btn::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px;
          border-radius: 2px; background: var(--brand-1); transform: scaleX(0);
          transition: transform 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .home-tab-rooms-tab-btn.active { color: #fff; }
        .home-tab-rooms-tab-btn.active::after { transform: scaleX(1); }
        html[data-theme='light'] .home-tab-rooms-tab-btn.active { color: #0f172a; }
      `}</style>

      <div className="home-tab-hero">
        <div className="home-tab-hero-icon">
          {/* A small sketch-style "two friends watching a screen together" icon —
              stands in for the plain play-button square, since a bare Play icon
              doesn't communicate "join a room with people" the way this does. */}
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="6" y="4" width="28" height="18" rx="3" stroke="#fff" strokeWidth="1.8" fill="rgba(255,255,255,0.14)" />
            <path d="M17 9.5L24 13L17 16.5V9.5Z" fill="#fff" />
            <path d="M20 22V25" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="13" cy="30" r="2.6" fill="#fff" />
            <path d="M8 35c0-3 2.2-5 5-5s5 2 5 5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <circle cx="27" cy="30" r="2.6" fill="#fff" />
            <path d="M22 35c0-3 2.2-5 5-5s5 2 5 5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        <h1>{t('watchTogether', 'Watch Together')}</h1>
        <p>{t('homeTabTagline', 'Create a room or join one with friends')}</p>
      </div>

      <div className="home-tab-action-card">
        <button onClick={createRoom} className="home-tab-create-btn">
          <Play size={18} fill="#fff" strokeWidth={0} /> <span className="stay-white">{t('createRoom', 'Create Room')}</span>
        </button>

        <div className="home-tab-divider">{t('or', 'or')}</div>

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
      </div>

      {(showPinnedTab || showHistoryTab) && (
        <div style={{ marginTop: 32 }}>
          {showTabs ? (
            <div className="home-tab-rooms-tabs">
              <button className={`home-tab-rooms-tab-btn${activeTab === 'pinned' ? ' active' : ''}`} onClick={() => setRoomsTab('pinned')}>
                <Pin size={16} /> {t('pinnedRooms', 'Pinned Rooms')}
              </button>
              <button className={`home-tab-rooms-tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => setRoomsTab('history')}>
                <History size={16} /> {t('roomHistory', 'Room History')}
              </button>
            </div>
          ) : (
            <div className="home-tab-pinned-header">
              <div className="home-tab-pinned-title">
                {activeTab === 'pinned' ? <Pin size={16} /> : <History size={16} />}
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  {activeTab === 'pinned' ? t('pinnedRooms', 'Pinned Rooms') : t('roomHistory', 'Room History')}
                </h2>
              </div>
              {activeTab === 'pinned' && <span className="home-tab-pinned-count">{pinnedRooms.length}</span>}
            </div>
          )}

          {activeTab === 'pinned' ? (
            isPinnedLoading ? (
              <div className="home-tab-pinned-grid"><RoomCardSkeleton count={2} /></div>
            ) : hasPinned ? (
              <PinnedRoomsGrid rooms={pinnedRooms} onUnpin={onUnpin} gridClassName="home-tab-pinned-grid" />
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Pin size={22} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{t('noPinnedRooms', 'No pinned rooms yet')}</p>
              </div>
            )
          ) : (
            isHistoryLoading ? (
              <div className="home-tab-pinned-grid"><RoomCardSkeleton count={2} /></div>
            ) : hasHistory ? (
              <PinnedRoomsGrid
                rooms={roomHistory}
                pinnedIds={pinnedRoomIds}
                onTogglePin={onTogglePin}
                gridClassName="home-tab-pinned-grid"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <History size={22} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{t('noRoomHistory', 'No rooms created yet')}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
