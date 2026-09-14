import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, History } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PinnedRoomsGrid from './components/PinnedRoomsGrid';
import RoomCardSkeleton from './components/RoomCardSkeleton';
import { usePinnedRooms } from './hooks/usePinnedRooms';
import { useRoomHistory } from './hooks/useRoomHistory';
import PullToRefresh from './components/PullToRefresh';

// Standalone "Pinned Rooms" page — the desktop (Tauri) Navbar links here directly
// instead of showing this grid inline on the Dashboard, matching how Public Rooms
// already gets its own page rather than being mixed into the home view.
// Room History (rooms you've created, whether pinned or not) lives alongside
// it as a second tab — same underline-tab pattern as Home.jsx's web version,
// so the desktop app doesn't lose the one place a never-pinned, never-
// chatted-in room stays reachable.
const PinnedRooms = () => {
  const { t } = useTranslation();
  const { pinnedRooms, unpinRoom, pinRoom, fetchRooms: refetchPinnedRooms, isLoading } = usePinnedRooms();
  const { roomHistory, isLoading: isHistoryLoading } = useRoomHistory();
  const pinnedRoomIds = pinnedRooms.map(r => r.id);
  const toggleHistoryPin = async (e, id, isPinned) => {
    await (isPinned ? unpinRoom : pinRoom)(e, id);
    refetchPinnedRooms();
  };

  // Tabs always appear together, once both fetches have actually settled —
  // regardless of whether either turned out empty. An empty bucket just
  // renders its own "no rooms yet" empty state below instead of hiding the
  // tab; hiding the tab (or worse, the whole section) whenever a bucket is
  // empty was the bug reported here (a fresh/new account with zero created
  // rooms lost the Room History tab entirely instead of showing it empty).
  // Before both settle, default to the Pinned tab so there's no jump once
  // they resolve.
  const bothSettled = !isLoading && !isHistoryLoading;
  const [tab, setTab] = useState('pinned');
  const activeTab = bothSettled ? tab : 'pinned';
  const showTabs = bothSettled;

  return (
    <PullToRefresh>
    <div style={{ minHeight: '100vh' }}>
      <Toaster position="top-center" />
      <style>{`
        .pinned-card { border-radius:20px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:#12121a;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform 0.3s ease,box-shadow 0.3s ease,border-color 0.3s ease;display:flex;flex-direction:column;overflow:hidden; }
        .pinned-card:hover { transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,0.5);border-color:rgba(var(--brand-1-rgb),0.5); }
        .img-layer { height:130px;position:relative;overflow:hidden;background:linear-gradient(135deg,#1e1e2e 0%,#111119 100%); }
        html[data-theme='light'] .img-layer { background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%); }
        .pinned-img { width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease,opacity 0.4s ease;opacity:0; }
        .pinned-img.loaded { opacity:1; }
        .pinned-card:hover .pinned-img { transform:scale(1.08); }
        .cat-badge { position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);color:#fff;padding:4px 9px;border-radius:8px;font-size:10.5px;font-weight:700;letter-spacing:0.3px;z-index:10; }
        html[data-theme='light'] .cat-badge { background:rgba(0,0,0,0.5);color:#fff; }
        .room-id-badge { position:absolute;bottom:10px;left:10px;display:flex;align-items:center;gap:3px;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);color:#fff;padding:3px 8px;border-radius:8px;font-size:10px;font-weight:700;letter-spacing:0.2px;z-index:10; }
        html[data-theme='light'] .room-id-badge { background:rgba(0,0,0,0.5) !important;color:#fff !important; }
        .unpin-btn { position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.4);backdrop-filter:blur(6px);border:none;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);z-index:10; }
        .unpin-btn:hover { background:#ef4444;color:#fff;transform:scale(1.1); }
        .unpin-btn .unpin-icon { transition:fill 0.3s ease;fill:none; }
        .unpin-btn:hover .unpin-icon { fill:currentColor; }
        html[data-theme='light'] .unpin-btn { background:rgba(255,255,255,0.85) !important;color:#475569 !important; }
        html[data-theme='light'] .unpin-btn:hover { background:#ef4444 !important;color:#fff !important; }
        .footer-layer { background:linear-gradient(135deg,rgba(var(--brand-1-rgb),0.12),rgba(var(--brand-2-rgb),0.12));padding:14px 16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid rgba(255,255,255,0.05); }
        html[data-theme='light'] .footer-layer { background:#1e1e2e !important;border-top:1px solid rgba(255,255,255,0.06) !important; }
        .room-card-title { margin:0;font-size:15px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        html[data-theme='light'] .room-card-title { color:#fff !important; }
        .room-card-bottom-row { display:flex;justify-content:space-between;align-items:center;gap:8px; }
        .room-card-meta { display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#8a8f98;min-width:0;overflow:hidden; }
        .room-card-meta span { display:inline-flex;align-items:center;gap:3px;white-space:nowrap; }
        html[data-theme='light'] .room-card-meta { color:#64748b; }
        .join-btn { background:linear-gradient(135deg,var(--brand-1),var(--brand-2));border:none;color:#fff;padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;transition:transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275); }
        .pinned-card:hover .join-btn { transform:translateY(-2px); }
        html[data-theme='light'] .join-btn { background:var(--brand-gradient);color:#fff !important; }

        .rooms-grid { display:grid;grid-template-columns:repeat(3, 1fr);gap:20px;margin-bottom:40px; }

        html[data-theme='light'] body { background:#f7fafc !important;color:#111 !important; }
        html[data-theme='light'] .section-heading { color:#000 !important; }
        html[data-theme='light'] .section-desc { color:#4a5568 !important; }

        /* Same underline-tab pattern as Home.jsx's web version — Pinned
           Rooms and Room History are two views of one page, not two
           separately-titled sections. */
        .rooms-tab-row { display: flex; gap: 36px; margin-bottom: 10px; }
        .rooms-tab-btn {
          display: flex; align-items: center; gap: 10px;
          background: transparent; border: none; cursor: pointer;
          padding: 4px 2px 14px; font-size: 22px; font-weight: 800; font-family: inherit;
          color: #6b7280; position: relative; transition: color 0.18s;
        }
        .rooms-tab-btn::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 3px;
          border-radius: 2px; background: var(--brand-1); transform: scaleX(0);
          transition: transform 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .rooms-tab-btn.active { color: #fff; }
        .rooms-tab-btn.active::after { transform: scaleX(1); }
        html[data-theme='light'] .rooms-tab-btn { color: #94a3b8; }
        html[data-theme='light'] .rooms-tab-btn.active { color: #0f172a; }

        @media (max-width: 640px) {
          .rooms-grid { grid-template-columns:repeat(2, 1fr); gap:12px; }
          .img-layer { height:100px; }
          .footer-layer { padding:8px 10px; }
        }
        @media (min-width: 641px) and (max-width: 900px) {
          .rooms-grid { grid-template-columns:repeat(2, 1fr); gap:16px; }
        }
      `}</style>

      <Navbar />

      <section style={{ width: '100%', padding: '40px 0 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>
          {showTabs ? (
            <div className="rooms-tab-row">
              <button className={`rooms-tab-btn${activeTab === 'pinned' ? ' active' : ''}`} onClick={() => setTab('pinned')}>
                <Pin size={20} /> {t('pinnedRooms', 'Pinned Rooms')}
              </button>
              <button className={`rooms-tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
                <History size={20} /> {t('roomHistory', 'Room History')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <h2 className="section-heading" style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: '#fff' }}>
                {activeTab === 'pinned' ? t('pinnedRooms', 'Pinned Rooms') : t('roomHistory', 'Room History')}
              </h2>
            </div>
          )}
          <p className="section-desc" style={{ color: '#a0aab2', fontSize: '16px', marginBottom: '30px' }}>
            {activeTab === 'pinned'
              ? t('pinnedRoomsDesc', 'Rooms you\'ve pinned for quick access.')
              : t('roomHistoryDesc', "Rooms you've created. Pin one to keep it in Pinned Rooms permanently.")}
          </p>

          {activeTab === 'pinned' ? (
            isLoading ? (
              <div className="rooms-grid">
                <RoomCardSkeleton count={6} />
              </div>
            ) : pinnedRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Pin size={28} style={{ opacity: 0.4, marginBottom: 12 }} />
                <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '18px' }}>{t('noPinnedRooms', 'No pinned rooms yet')}</h3>
                <p style={{ color: '#888', margin: 0 }}>{t('noPinnedRoomsDesc', 'Pin a room from its menu to see it here for quick access.')}</p>
              </div>
            ) : (
              <PinnedRoomsGrid
                rooms={pinnedRooms}
                onUnpin={unpinRoom}
                gridClassName="rooms-grid"
                fadeIn
                titleColor="#fff"
              />
            )
          ) : (
            isHistoryLoading ? (
              <div className="rooms-grid">
                <RoomCardSkeleton count={6} />
              </div>
            ) : roomHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <History size={28} style={{ opacity: 0.4, marginBottom: 12 }} />
                <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '18px' }}>{t('noRoomHistory', 'No rooms created yet')}</h3>
                <p style={{ color: '#888', margin: 0 }}>{t('noRoomHistoryDesc', 'Rooms you create will show up here, even if you never pin or chat in them.')}</p>
              </div>
            ) : (
              <PinnedRoomsGrid
                rooms={roomHistory}
                pinnedIds={pinnedRoomIds}
                onTogglePin={toggleHistoryPin}
                gridClassName="rooms-grid"
                fadeIn
                titleColor="#fff"
              />
            )
          )}
        </div>
      </section>
      <Footer />
    </div>
    </PullToRefresh>
  );
};

export default PinnedRooms;
