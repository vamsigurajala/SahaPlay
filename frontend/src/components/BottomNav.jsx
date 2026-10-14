import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home as HomeIcon, Globe, MessageSquare, Search as SearchIcon, User, X } from 'lucide-react';
import { isStandalonePWA, isTauriApp } from '../lib/platform';
import { clearUserSession } from '../lib/authUtils.js';
import { getAvatarUrl } from '../utils/avatarUtils';
import { API } from '../lib/api';
import { useBackIntercept, suppressNextPop } from '../hooks/useBackIntercept';
import { getPersistedSearchOpen, setPersistedSearchOpen } from '../utils/searchTabPersist';
import { peekPendingNotificationTap, clearPendingNotificationTap } from '../lib/nativePush';
import { useCrypto } from '../contexts/CryptoContext';
import GlobalChatWidget from './GlobalChatWidget';
import SearchTabContent from './SearchTabContent';
import ProfileActionMenu from './ProfileActionMenu';
import SupportModal from './SupportModal';
import DownloadAppModal from './DownloadAppModal';

// Native-app-style bottom tab bar, shown only inside an installed PWA / future
// Android TWA (never in a regular mobile browser tab — see isStandalonePWA()).
// Icon-only, 5 tabs: Home, Public Rooms, Chats, Search, Profile. Notifications
// lives in the top bar only (Navbar.jsx) — not duplicated here. Each tab
// reuses an existing piece rather than rebuilding it: Home/Public Rooms are
// routes Home.jsx/PublicRooms.jsx already own; Chat mounts its own
// independent GlobalChatWidget instance (Room.jsx already mounts a second
// one, so the component supports this — and it manages its own
// useBackIntercept level internally, so it's deliberately NOT also wrapped
// here); Profile reuses the same ProfileActionMenu content Navbar.jsx's
// mobile drawer uses, scoped down via its `compact` prop, presented as a
// right-side slide-in drawer rather than a full-screen takeover.
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { keyPair } = useCrypto();

  const token = localStorage.getItem('watch_token');
  const rawUsername = localStorage.getItem('watch_username');
  const loggedInUsername = rawUsername && rawUsername.toLowerCase().startsWith('guest_') ? rawUsername.slice(6) : rawUsername;
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  const isDesktopApp = isTauriApp();
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const isAdminRole = ['super_admin', 'admin', 'moderator', 'support'].includes(watchRole);

  const [avatarPath, setAvatarPath] = useState(null);
  const fetchAvatar = React.useCallback(() => {
    if (isGuest || !token || token === 'null' || token === 'undefined') return;
    fetch(`${API}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setAvatarPath(data?.avatarPath || null))
      .catch(() => {});
  }, [token, isGuest]);
  useEffect(() => { fetchAvatar(); }, [fetchAvatar]);
  // Profile.jsx dispatches this right after a successful avatar upload so
  // this icon updates immediately instead of waiting for a full page reload.
  useEffect(() => {
    window.addEventListener('avatar_updated', fetchAvatar);
    return () => window.removeEventListener('avatar_updated', fetchAvatar);
  }, [fetchAvatar]);

  const [showChat, setShowChat] = useState(false);
  const [showSearch, setShowSearch] = useState(getPersistedSearchOpen);
  const [showProfile, setShowProfile] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);
  // A chat left open behind a /profile/* page (leaveChatToViewProfile, from
  // tapping an avatar inside it) renders display:none until that route is
  // left — the 'chat' tab's onClick below (isHiddenBehindProfile/
  // revealOverProfile) brings it forward instead, same fix as Navbar.jsx.
  const chatWidgetRef = useRef(null);

  // Mirrors Navbar.jsx's own unread tracking (same localStorage keys, same
  // /api/chats/recent poll) rather than sharing state cross-component —
  // Navbar's Chat trigger (and its badge) is deliberately hidden in
  // standalone mode since this tab bar already covers it, but nothing ever
  // gave THIS tab the badge to cover it with, so it silently never showed
  // here at all. Self-contained polling matches this file's existing
  // "mounts its own independent GlobalChatWidget instance" precedent rather
  // than wiring a new cross-component event channel just for this.
  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });

  useEffect(() => {
    if (isGuest || !token) return;
    const checkUnread = async () => {
      try {
        const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const serverCounts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = (chat.id || chat.partner || '').toLowerCase();
          if (chat.unread && chat.unread > 0) {
            serverCounts[chatKey] = chat.unread;
            total += chat.unread;
          }
        });
        localStorage.setItem('chat_unread_counts', JSON.stringify(serverCounts));
        setUnreadCounts(serverCounts);
        setTotalUnread(total);
      } catch {}
    };
    checkUnread();
    const interval = setInterval(checkUnread, 5000);
    window.addEventListener('focus', checkUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkUnread);
    };
  }, [token, isGuest]);

  const handleNewMessage = React.useCallback((partner) => {
    const chatKey = (partner || '').toLowerCase();
    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, []);

  const handleMarkRead = React.useCallback((chatId) => {
    const chatKey = (chatId || '').toLowerCase();
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    lastSeen[chatKey] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    setUnreadCounts(prev => {
      const next = { ...prev };
      const removed = next[chatId] || next[chatKey] || 0;
      if (removed > 0) setTotalUnread(t => Math.max(0, t - removed));
      delete next[chatId];
      delete next[chatKey];
      return next;
    });
  }, []);

  const handleMarkAllRead = React.useCallback(() => {
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    Object.keys(unreadCounts).forEach(k => { lastSeen[k] = Date.now(); });
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    localStorage.setItem('chat_unread_counts', JSON.stringify({}));
    setUnreadCounts({});
    setTotalUnread(0);
  }, [unreadCounts]);

  // Push-notification tap → jump straight to that chat. main.jsx registers
  // the native listener and rebroadcasts it as this plain DOM event (same
  // pattern as native-google-auth) since BottomNav is the only thing
  // rendered in standalone mode, which is the only mode pushes fire in.
  const [pendingOpenChat, setPendingOpenChat] = useState(null);
  // Remembers the last chat-type tap this component has seen so the
  // keyPair-ready replay effect below can re-apply it — see that effect's
  // own comment for why the very first attempt often isn't enough.
  const lastChatTapRef = useRef(null);

  const openChatFromTapData = (data) => {
    setShowSearch(false);
    setShowProfile(false);
    // Room/Admin routes make this component return null (see below) even
    // though its hooks/state still run — force back to a route where the
    // chat overlay actually renders, same as tapping a notification in
    // any native app takes you out of whatever you were doing.
    navigate('/');
    setShowChat(true);
    setPendingOpenChat({ partner: data.chatId, type: data.type === 'dm' ? 'private' : 'room' });
  };

  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      console.log('[BottomNav] open_chat_from_notification received:', data);
      if (!data) return;
      // Navbar.jsx owns friend-request/friend-accept taps (opens its bell
      // dropdown) — see its own peekPendingNotificationTap() check, which
      // independently claims that payload without going through this event.
      // Just make sure Navbar is actually mounted to receive it: it isn't
      // rendered on Room/Admin routes, so force back to '/' if we're on one
      // of those (a no-op navigate() when already elsewhere Navbar renders).
      if (data.type === 'friend_request' || data.type === 'friend_accept') {
        setShowSearch(false);
        setShowProfile(false);
        navigate('/');
        return;
      }
      if (!data.chatId) return;
      lastChatTapRef.current = data;
      openChatFromTapData(data);
    };
    window.addEventListener('open_chat_from_notification', handler);
    // Cold start: the native tap may have already fired (and been lost,
    // with no listener yet attached) before this effect ever ran — see
    // nativePush.js's pendingTap comment. Peek (not clear) it here: a
    // friend-request/friend-accept tap belongs to Navbar.jsx's own peek,
    // not this one, so only claim (and clear) it when it's actually a chat
    // tap this component handles.
    const pending = peekPendingNotificationTap();
    console.log('[BottomNav] mount-time peekPendingNotificationTap():', pending);
    if (pending && pending.chatId) {
      clearPendingNotificationTap();
      handler({ detail: pending });
    }
    return () => window.removeEventListener('open_chat_from_notification', handler);
  }, []);

  // Re-apply the last notification-tap target once the encryption key is
  // actually available. A cold start via a chat notification races the
  // fingerprint/passphrase unlock: the tap above can (and typically does)
  // land, navigate here, and open the chat panel BEFORE the user has
  // unlocked anything, while CryptoContext's keyPair is still null — which
  // used to read as "unlocked, but stuck on the home page" once the unlock
  // prompt closed, because DeviceUnlockOverlay's blur (or whatever specific
  // prompt was showing) was the only thing between the user and an
  // already-correct-but-invisible chat view. Re-running the exact same
  // navigate/open here the moment keyPair flips from null to real
  // guarantees the user actually lands on the chat right after unlocking,
  // not just "whenever the tap happened to be processed." Cleared after one
  // replay so a later natural lock/unlock cycle (e.g. backgrounding again)
  // doesn't keep reopening a stale target.
  useEffect(() => {
    console.log('[BottomNav] keyPair-ready replay check — keyPair:', !!keyPair, 'pending tap:', lastChatTapRef.current);
    if (!keyPair || !lastChatTapRef.current) return;
    const data = lastChatTapRef.current;
    lastChatTapRef.current = null;
    console.log('[BottomNav] replaying notification tap now that keyPair is ready:', data);
    openChatFromTapData(data);
  }, [keyPair]);

  const closeOverlays = () => { setShowSearch(false); setShowProfile(false); setPersistedSearchOpen(false); };
  // Swipe-back closes Search/Profile instead of navigating away — Chat is
  // excluded since GlobalChatWidget already owns its own back-intercept
  // level for its isOpen state (see its onClose prop below).
  const { skipNextClose } = useBackIntercept((showSearch || showProfile) ? 1 : 0, (newLevel) => { if (newLevel === 0) closeOverlays(); });

  // Room is its own immersive, already-crowded UI (video controls, floating
  // chat panel) — a persistent tab bar there would just add clutter on top
  // of existing bottom-anchored controls, so it's excluded here. Admin has
  // its own "Back to App" exit and a fixed bottom nav here would sit on top
  // of / cover its own bottom-anchored UI (e.g. table pagination controls).
  // Account (/profile and /profile/:username alike — viewing your own
  // profile or someone else's is the same full-screen surface with its own
  // header/back-nav), App Settings (/settings, /app-settings), and Chats
  // (/chat-settings, Profile menu's own settings page) each have their own
  // bottom-anchored save buttons/forms — the tab bar sat on top of those.
  // Previously only bare /profile was excluded here, which made the
  // tab bar show on someone else's profile but not your own — reported as
  // the bar randomly appearing/disappearing while browsing profiles.
  const isSettingsPage = location.pathname.startsWith('/profile') || location.pathname.startsWith('/app-settings') || location.pathname.startsWith('/settings') || location.pathname.startsWith('/chat-settings');
  if (!isStandalonePWA() || !(isLoggedIn || isGuest) || location.pathname.startsWith('/room/') || location.pathname.startsWith('/admin') || isSettingsPage) return null;

  const closeAll = () => { setShowChat(false); closeOverlays(); };
  // Any handler that closes Search/Profile AND navigates to a different
  // route in the same click needs this — otherwise this hook's own
  // history.go() cleanup (triggered by the overlay closing) races the
  // router's pushState and silently undoes the navigation, which is why
  // "Account"/"App Settings" inside the drawer previously did nothing.
  const navigateFrom = (path, opts = {}) => {
    const hadOverlayOpen = showSearch || showProfile;
    if (hadOverlayOpen) skipNextClose();
    const wasSearchOpen = showSearch;
    closeAll();
    // A search RESULT click (as opposed to tapping Home/Public/the profile
    // drawer while search happened to be open) should leave the "search was
    // open" marker restorable — see searchTabPersist.js for why: it's what
    // makes swiping back from the profile/room just opened land back on the
    // search overlay instead of skipping past it to whatever page hosted it.
    if (opts.keepSearchOpen && wasSearchOpen) setPersistedSearchOpen(true);
    // Tells the shared back-listener that the popstate this navigate()
    // eventually consumes on the way back isn't the still-inert
    // Search/Profile entry left above by skipNextClose() — without this, the
    // real swipe off the profile/room page gets misattributed to that entry,
    // firing closeOverlays() and clearing the persisted-open flag we just
    // set, so search silently never reopens (same fix as GlobalChatWidget's
    // leaveChatToViewProfile / RoomChatPanel's goToProfile).
    if (hadOverlayOpen) suppressNextPop();
    navigate(path);
  };

  const handleLogout = () => {
    clearUserSession();
    // Explicit redirect rather than reload() — reload() re-fetches whatever
    // (possibly protected) route the user was on, which then has to bounce
    // to /login itself, an extra hop that read as "logout didn't take
    // effect" until that second redirect landed.
    window.location.href = '/login';
  };

  const anyOverlayOpen = showChat || showSearch || showProfile;

  // Chats hidden for guests — same condition Navbar.jsx already uses to hide
  // that icon in the regular mobile nav (guests can't chat, and per the
  // recent guest-restrictions changes can't create/join rooms either, so a
  // tab leading to an empty state would read as broken).
  const tabs = [
    { key: 'home', label: t('home', 'Home'), icon: HomeIcon, active: location.pathname === '/' && !anyOverlayOpen, onClick: () => navigateFrom('/') },
    { key: 'public', label: t('publicRooms', 'Public Rooms'), icon: Globe, active: location.pathname === '/public' && !anyOverlayOpen, onClick: () => navigateFrom('/public') },
    ...(isLoggedIn ? [
      { key: 'chat', label: t('chats', 'Chats'), icon: MessageSquare, active: showChat, onClick: () => {
        const hiddenBehindProfile = chatWidgetRef.current?.isHiddenBehindProfile;
        const next = hiddenBehindProfile ? true : !showChat;
        closeAll();
        if (hiddenBehindProfile) chatWidgetRef.current.revealOverProfile();
        setShowChat(next);
      } },
    ] : []),
    { key: 'search', label: t('search', 'Search'), icon: SearchIcon, active: showSearch, onClick: () => { const next = !showSearch; closeAll(); setShowSearch(next); setPersistedSearchOpen(next); } },
    { key: 'profile', label: t('profile', 'Profile'), icon: User, active: showProfile, isAvatar: true, onClick: () => { const next = !showProfile; closeAll(); setShowProfile(next); } },
  ];

  return (
    <>
      <style>{`
        .bottom-nav-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 100001;
          display: flex; align-items: stretch;
          background: #111114; border-top: 1px solid rgba(255,255,255,0.08);
          /* env(safe-area-inset-bottom) reports 0 in this Capacitor Android
             WebView regardless of viewport-fit=cover (same broken env()
             family documented on initNativeStatusBarInset/
             initNativeNavBarInset in nativeShell.js) — on a 3-button nav-bar
             device this bar's own intrinsic height happened to clear the
             button row by coincidence on some devices, but not guaranteed on
             every OEM's button-row height. --sp-nav-bar-inset is the real,
             measured value (nativeShell.js's initNativeNavBarInset, already
             used by the chat composer bars for the same reason) and is 0 on
             a gesture-nav device, so this is strictly more correct with no
             behavior change there. */
          padding-bottom: var(--sp-nav-bar-inset, 0px);
        }
        html[data-theme='light'] .bottom-nav-bar {
          background: #ffffff; border-top: 1px solid rgba(0,0,0,0.08);
        }
        .bottom-nav-tab {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 13px 4px; background: none; border: none; cursor: pointer;
          color: #8b8b93; position: relative;
        }
        .bottom-nav-tab.active { color: var(--brand-1); }
        .bottom-nav-badge {
          position: absolute; top: 6px; right: 50%; margin-right: -18px;
          background: #ef4444; border-radius: 50%; color: #fff;
          font-size: 10px; font-weight: 800; min-width: 15px; height: 15px;
          padding: 0 2px; display: flex; align-items: center; justify-content: center;
        }
        html[data-theme='light'] .bottom-nav-tab { color: #6b7280; }
        .bottom-nav-avatar {
          width: 24px; height: 24px; border-radius: 50%; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.08); flex-shrink: 0;
        }
        .bottom-nav-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .bottom-nav-tab.active .bottom-nav-avatar { box-shadow: 0 0 0 2px var(--brand-1); }
        .bottom-nav-overlay {
          position: fixed; inset: 0; z-index: 100000;
          background: #0b0b0f; display: flex; flex-direction: column;
        }
        html[data-theme='light'] .bottom-nav-overlay { background: #f7fafc; }
        .bottom-nav-overlay-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
          padding-top: calc(16px + var(--sp-status-bar-inset, 0px));
        }
        html[data-theme='light'] .bottom-nav-overlay-header { border-bottom-color: rgba(0,0,0,0.08); }
        .bottom-nav-overlay-title { font-size: 16px; font-weight: 800; color: #fff; margin: 0; }
        html[data-theme='light'] .bottom-nav-overlay-title { color: #111; }
        .bottom-nav-overlay-close { background: none; border: none; cursor: pointer; color: #aaa; padding: 4px; }
        html[data-theme='light'] .bottom-nav-overlay-close { color: #555; }
        .bottom-nav-overlay-body { flex: 1; overflow-y: auto; padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 90px); }

        /* Profile: a right-side slide-in drawer, not a full-screen takeover */
        .bottom-nav-profile-backdrop {
          position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,0.45);
          animation: bnProfileFade 0.2s ease;
        }
        @keyframes bnProfileFade { from { opacity: 0; } to { opacity: 1; } }
        .bottom-nav-profile-drawer {
          position: fixed; top: 0; right: 0; bottom: 0; width: 280px; max-width: 82vw;
          z-index: 100001; background: #141418; display: flex; flex-direction: column;
          box-shadow: -8px 0 32px rgba(0,0,0,0.5);
          animation: bnProfileSlide 0.22s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes bnProfileSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        html[data-theme='light'] .bottom-nav-profile-drawer { background: #ffffff; box-shadow: -8px 0 32px rgba(0,0,0,0.15); }
        .bottom-nav-profile-body { flex: 1; overflow-y: auto; padding: 8px 10px calc(env(safe-area-inset-bottom, 0px) + 24px); }
      `}</style>

      {showSearch && (
        <div className="bottom-nav-overlay">
          <div className="bottom-nav-overlay-header">
            <h2 className="bottom-nav-overlay-title">{t('search', 'Search')}</h2>
            <button className="bottom-nav-overlay-close" onClick={() => { setShowSearch(false); setPersistedSearchOpen(false); }} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="bottom-nav-overlay-body">
            <SearchTabContent t={t} onNavigate={(path) => navigateFrom(path, { keepSearchOpen: true })} />
          </div>
        </div>
      )}

      {showProfile && (
        <>
          <div className="bottom-nav-profile-backdrop" onClick={() => setShowProfile(false)} />
          <div className="bottom-nav-profile-drawer">
            <div className="bottom-nav-overlay-header">
              <h2 className="bottom-nav-overlay-title">{t('profile', 'Profile')}</h2>
              <button className="bottom-nav-overlay-close" onClick={() => setShowProfile(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="bottom-nav-profile-body">
              <ProfileActionMenu
                compact
                currentPath={location.pathname}
                loggedInUsername={loggedInUsername}
                isGuest={isGuest}
                isAdminRole={isAdminRole}
                isDesktopApp={isDesktopApp}
                onProfileClick={() => { skipNextClose(); suppressNextPop(); setShowProfile(false); navigate('/profile'); }}
                onAppSettingsClick={() => { skipNextClose(); suppressNextPop(); setShowProfile(false); navigate('/app-settings'); }}
                onChatSettingsClick={() => { skipNextClose(); suppressNextPop(); setShowProfile(false); navigate('/chat-settings'); }}
                onContactSupportClick={() => { setShowProfile(false); setShowSupportModal(true); }}
                onGetDesktopAppClick={() => { setShowProfile(false); setShowDownloadAppModal(true); }}
                onAdminClick={() => { skipNextClose(); suppressNextPop(); setShowProfile(false); navigate('/admin'); }}
                onSignInClick={() => { skipNextClose(); suppressNextPop(); clearUserSession(); setShowProfile(false); navigate('/login'); }}
                onSignUpClick={() => { skipNextClose(); suppressNextPop(); setShowProfile(false); navigate('/signup'); }}
                onLogoutClick={() => { skipNextClose(); setShowProfile(false); handleLogout(); }}
                t={t}
              />
            </div>
          </div>
        </>
      )}

      {isLoggedIn && (
        <GlobalChatWidget
          ref={chatWidgetRef}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          unreadCounts={unreadCounts}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onNewMessage={handleNewMessage}
          pendingOpenChat={pendingOpenChat}
          onPendingOpenChatHandled={() => setPendingOpenChat(null)}
        />
      )}

      {/* Hidden while any overlay is open — Chat/Search/Profile each already
          take the full screen (or, for Profile, a full-height drawer), so a
          persistent tab bar underneath just eats space and, for Chat
          specifically, was sitting at a higher z-index than the chat panel
          and visually covering its message input. */}
      {!anyOverlayOpen && (
        <nav className="bottom-nav-bar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} className={`bottom-nav-tab${tab.active ? ' active' : ''}`} onClick={tab.onClick} aria-label={tab.label} title={tab.label}>
                {tab.isAvatar ? (
                  <div className="bottom-nav-avatar">
                    {avatarPath ? <img src={getAvatarUrl(avatarPath)} alt="" /> : <Icon size={16} />}
                  </div>
                ) : (
                  <Icon size={22} />
                )}
                {tab.key === 'chat' && totalUnread > 0 && (
                  <div className="bottom-nav-badge stay-white">{totalUnread > 9 ? '9+' : totalUnread}</div>
                )}
              </button>
            );
          })}
        </nav>
      )}

      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <DownloadAppModal isOpen={showDownloadAppModal} onClose={() => setShowDownloadAppModal(false)} />
    </>
  );
}
