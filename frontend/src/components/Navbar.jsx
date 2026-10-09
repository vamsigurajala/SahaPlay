import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, LogOut, Settings, HelpCircle, Search, MessageSquare, Bell, AlertCircle, Maximize, Minimize, ArrowLeft, X, Home, Compass, Sparkles, Download, Pin, Globe } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useFollowRequests } from '../hooks/useFollowRequests';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { getPersistedNavbarSearchOpen, setPersistedNavbarSearchOpen } from '../utils/navbarSearchPersist';
import { clearUserSession } from '../lib/authUtils.js';
import GlobalChatWidget from './GlobalChatWidget';
import SupportModal from './SupportModal';
import DownloadAppModal from './DownloadAppModal';
import NotificationsPanelContent from './NotificationsPanelContent';
import { blockPullToRefresh, unblockPullToRefresh } from '../lib/pullToRefreshGate';
import ProfileActionMenu from './ProfileActionMenu';
import { getAvatarUrl } from '../utils/avatarUtils';
import { API } from '../lib/api';
import { useBackIntercept, suppressNextPop } from '../hooks/useBackIntercept';
import { getPersistedGcwOpen } from '../utils/gcwPersist';
import { isTauriApp, isStandalonePWA, isCapacitorApp } from '../lib/platform';
import { peekPendingNotificationTap, clearPendingNotificationTap } from '../lib/nativePush';
import { useCrypto } from '../contexts/CryptoContext';

const Navbar = () => {
  const isDesktopApp = isTauriApp();
  const standalone = isStandalonePWA();
  // The native Android wrapper specifically (the installed .apk), not a
  // plain mobile browser tab and not an installed PWA/TWA — those two keep
  // the fixed/pinned nav as before, only the APK doesn't want it (reported:
  // "do not stick top nav bar at all, only in apks not in browser").
  const isApk = isCapacitorApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { keyPair } = useCrypto();

  const token = localStorage.getItem('watch_token');
  const rawUsername = localStorage.getItem('watch_username');
  const loggedInUsername = rawUsername && rawUsername.toLowerCase().startsWith('guest_')
    ? rawUsername.slice(6)
    : rawUsername;
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && localStorage.getItem('watch_is_guest') !== 'true';
  const [watchRole, setWatchRole] = useState(localStorage.getItem('watch_role') || 'user');
  const isAdminRole = ['super_admin', 'admin', 'moderator', 'support'].includes(watchRole);

  const [scrolled, setScrolled] = useState(false);
  // .main-nav is position:fixed (see its CSS) so it stays pinned to the
  // viewport regardless of any ancestor page's own layout — sticky was
  // reported not actually sticking while scrolling on at least Home and
  // Features, and fixed has no dependency on being the right scroll-
  // container/stacking-context ancestor the way sticky does. Fixed removes
  // it from document flow though, so every page would otherwise render its
  // first content hidden underneath it — this ref+state pair measures the
  // real nav's rendered height (it varies: mobile vs desktop layout, with/
  // without the native status-bar inset) and a plain spacer div of that
  // height is rendered right after it, so every page that mounts <Navbar/>
  // automatically reserves the correct space with no per-page changes.
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(0);
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const measure = () => setNavHeight(navRef.current.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfilePageMobile, setShowProfilePageMobile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(getPersistedNavbarSearchOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const { history: searchHistory, addToHistory: addToSearchHistory, removeFromHistory: removeFromSearchHistory, clearHistory: clearSearchHistory } = useSearchHistory();
  const [showRecentChats, setShowRecentChats] = useState(getPersistedGcwOpen);
  const [showNotifications, setShowNotifications] = useState(false);
  // Scrolling inside the open notifications panel must never trigger the page's pull-to-refresh.
  useEffect(() => {
    if (!showNotifications) return undefined;
    blockPullToRefresh();
    return () => unblockPullToRefresh();
  }, [showNotifications]);
  const { followRequests, allowRequest, followBack } = useFollowRequests();
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [profile, setProfile] = useState(() => {
    const isG = !token || token === 'null' || token === 'undefined' || localStorage.getItem('watch_is_guest') === 'true';
    if (isG) {
      return {
        id: 0,
        username: localStorage.getItem('watch_username') || 'guest',
        displayName: 'Guest User',
        avatarPath: null,
        isGuest: true
      };
    }
    return null;
  });

  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth < 1025);
  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth < 1025);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.role) {
          localStorage.setItem('watch_role', d.role);
          setWatchRole(d.role);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);


  // Reset profile subpage when mobile menu closes
  useEffect(() => {
    if (!showMobileMenu) {
      setShowProfilePageMobile(false);
    }
  }, [showMobileMenu]);

  // Lock/unlock body scroll when mobile drawer is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMobileMenu]);

  // Mobile/iPad swipe-back should close the mobile menu drawer instead of navigating away.
  const mobileMenuBack = useBackIntercept(showMobileMenu ? 1 : 0, (newLevel) => { if (newLevel === 0) setShowMobileMenu(false); });
  // Nav links close the drawer AND change route in the same click — tell the
  // hook to leave its history entry alone so it doesn't fight the router's
  // own navigation (see useBackIntercept's skipNextClose doc).
  const navigateAndCloseMenu = useCallback((path) => {
    mobileMenuBack.skipNextClose();
    navigate(path);
    setShowMobileMenu(false);
  }, [mobileMenuBack, navigate]);

  // Search dropdown is an overlay on whatever page hosts Navbar, not its own
  // route — same swipe-back treatment as the mobile menu drawer above, plus
  // sessionStorage persistence (navbarSearchPersist.js) for the one case the
  // hook's own history trick can't cover on its own: tapping a result
  // navigates to a real route (their profile) on TOP of the still-inert
  // "search was open" marker, so swiping back from there lands on this
  // page's own history entry — which then needs to be TOLD to restore the
  // dropdown open, or it just remounts freshly closed and reads as "swiped
  // back and landed on Home instead of back on my search".
  const closeSearch = () => { setShowSearch(false); setPersistedNavbarSearchOpen(false); };
  const searchBack = useBackIntercept(showSearch ? 1 : 0, (newLevel) => { if (newLevel === 0) closeSearch(); });
  const goToSearchResult = (user) => {
    addToSearchHistory(user);
    searchBack.skipNextClose();
    setShowSearch(false);
    setPersistedNavbarSearchOpen(true);
    // Tells the shared back-listener that the popstate this navigate()
    // eventually consumes on the way back isn't the still-inert search-open
    // entry above — without this, swiping back off the profile misattributes
    // that swipe to it, fires closeSearch(), and clears the persisted-open
    // flag we just set, so search never reopens (same fix as
    // GlobalChatWidget's leaveChatToViewProfile).
    suppressNextPop();
    navigate(`/profile/${user.username}`);
  };

  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });

  const navIconsRef = useRef(null);
  const chatWidgetRef = useRef(null);

  // A chat left open behind a /profile/* page (leaveChatToViewProfile, from
  // tapping an avatar inside it) renders display:none until that route is
  // left — this nav icon's plain toggle had no visible effect there (or,
  // since isOpen was usually already true from before the profile nav,
  // silently flipped it closed then open again on alternating clicks).
  // Bring it forward, on top of that profile, instead.
  const toggleOrRevealChats = () => {
    if (chatWidgetRef.current?.isHiddenBehindProfile) {
      chatWidgetRef.current.revealOverProfile();
      setShowRecentChats(true);
    } else {
      setShowRecentChats(prev => !prev);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Friend-request/friend-accept notification tap — main.jsx rebroadcasts
  // the native tap as 'open_chat_from_notification' (same event
  // BottomNav.jsx listens for; BottomNav only claims chat-type taps and
  // deliberately leaves this type for this listener). Opens this bell
  // dropdown instead of jumping straight to the requester's profile, so
  // both accepting and viewing other pending requests are one tap away.
  useEffect(() => {
    const isFriendTap = (data) => data && (data.type === 'friend_request' || data.type === 'friend_accept');
    const handler = (e) => {
      if (!isFriendTap(e.detail)) return;
      setShowNotifications(true);
      closeSearch();
      setShowRecentChats(false);
    };
    window.addEventListener('open_chat_from_notification', handler);
    // Cold start: this may have already fired (and, on standalone/native,
    // been lost before any listener existed) before this effect ran —
    // Navbar's own lazy route chunk can resolve after BottomNav.jsx (which
    // mounts immediately, not lazily) already peeked the same pending tap,
    // so this only claims it if it's actually a friend-request type.
    const pending = peekPendingNotificationTap();
    if (isFriendTap(pending)) {
      clearPendingNotificationTap();
      handler({ detail: pending });
    }
    return () => window.removeEventListener('open_chat_from_notification', handler);
  }, []);

  // Chat-type notification tap — the desktop equivalent of BottomNav.jsx's
  // own pendingOpenChat handling below, which never runs here since Navbar
  // (not BottomNav) is what actually renders on desktop/Tauri and a plain
  // (non-standalone) mobile browser tab. Without this, clicking a desktop
  // notification (see desktopNotify.js's showDesktopNotification) focused
  // the window and did nothing else — there was no listener anywhere that
  // reacted to a chatId-carrying tap outside the native/standalone app.
  const [pendingOpenChat, setPendingOpenChat] = useState(null);
  // Remembers the last chat-type tap so the keyPair-ready replay effect
  // below can re-apply it — see that effect's own comment.
  const lastChatTapRef = useRef(null);
  const openChatFromTapData = (chatData) => {
    setShowNotifications(false);
    closeSearch();
    setPendingOpenChat({ partner: chatData.chatId, type: chatData.type === 'dm' ? 'private' : 'room' });
    setShowRecentChats(true);
  };
  useEffect(() => {
    const handler = (e) => {
      const chatData = e.detail;
      if (!chatData?.chatId) return;
      lastChatTapRef.current = chatData;
      openChatFromTapData(chatData);
    };
    window.addEventListener('open_chat_from_notification', handler);
    // Cold start: desktopNotify.js's toast-click bridge registers its own
    // Tauri event listener asynchronously (a dynamic import), so a click
    // that cold-starts/wakes the app can resolve before either that or this
    // component's own listener is attached — same race nativePush.js's own
    // pendingTap comment documents for the native Android app, sharing the
    // exact same cache here rather than losing the tap outright.
    const pending = peekPendingNotificationTap();
    if (pending?.chatId) {
      clearPendingNotificationTap();
      handler({ detail: pending });
    }
    return () => window.removeEventListener('open_chat_from_notification', handler);
  }, []);

  // Re-apply the last notification-tap target once the encryption key is
  // actually available — the desktop/.exe equivalent of BottomNav.jsx's own
  // identical effect (see its comment for the full race it closes): a
  // notification click that cold-starts (or wakes) the app can open this
  // chat panel before Windows Hello/the passphrase prompt has resolved,
  // showing "🔒 Encrypted message" placeholders instead of real text.
  // Re-opening the exact same target the moment the key becomes available
  // guarantees the panel is showing the correctly-decrypted chat right after
  // unlocking, not just whatever it happened to render at tap time.
  useEffect(() => {
    if (!keyPair || !lastChatTapRef.current) return;
    const chatData = lastChatTapRef.current;
    lastChatTapRef.current = null;
    openChatFromTapData(chatData);
  }, [keyPair]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (chatWidgetRef.current && chatWidgetRef.current.contains(e.target)) return;
      // Lightbox is portalled to document.body — don't treat those clicks as "outside"
      if (e.target.closest?.('.media-lightbox-overlay')) return;
      // Same reason — the chat's "Customize" theme sheet is also portalled
      // to document.body (outside chatWidgetRef's own DOM tree), so
      // clicking its own backdrop to close JUST that sheet was falling
      // through to here and closing the whole chat widget underneath it
      // too.
      if (e.target.closest?.('.chat-theme-sheet-overlay')) return;
      // Same reason again — the "install the app to call" prompt shown from
      // inside the chat widget is also portalled outside chatWidgetRef's DOM
      // tree, so closing just that prompt (its own X, or its backdrop) was
      // falling through here and closing the whole chat widget underneath it.
      if (e.target.closest?.('.download-app-modal-overlay')) return;
      // Same reason again — the "Report Message" modal (flag icon on a
      // chat bubble) is also portalled to document.body, outside
      // chatWidgetRef's DOM tree. Without this, clicking into its reason
      // dropdown or its Details textarea to type registered as "outside
      // the widget" and closed the report modal AND the chat window
      // underneath it before a single keystroke landed.
      if (e.target.closest?.('.report-modal-overlay')) return;
      // Same reason again — the "who reacted" sheet (tapping a reaction pill
      // under a message) is also portalled to document.body, outside
      // chatWidgetRef's DOM tree. Without this, clicking its own backdrop to
      // close JUST that sheet fell through here and closed the whole chat
      // widget underneath it too — reopening the widget then showed the
      // reactions sheet again instead of the chat, since the widget itself
      // never actually closed, just repainted hidden behind this handler's
      // premature setShowRecentChats(false).
      if (e.target.closest?.('.reactors-sheet-overlay')) return;
      if (navIconsRef.current && !navIconsRef.current.contains(e.target)) {
        closeSearch();
        setShowRecentChats(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
      if (!e.target.closest('.mobile-nav-dropdown') && !e.target.closest('.nav-hamburger-btn') && !e.target.closest('.mobile-drawer-panel') && !e.target.closest('.mobile-drawer-backdrop')) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Profile data fetch
  useEffect(() => {
    if (isGuest || !token) return;
    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProfile(data))
      .catch(() => {});
  }, [token, isGuest]);

  // Unread message tracking
  useEffect(() => {
    if (isGuest || !token) return;
    const getLastSeen = () => {
      try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; }
    };
    const checkUnread = async () => {
      try {
        const lastSeen = getLastSeen();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const serverCounts = {};
        let total = 0;
        data.forEach(chat => {
          // Always lowercase to avoid case-mismatch double-counting
          const chatKey = (chat.id || chat.partner || '').toLowerCase();
          if (chat.unread && chat.unread > 0) {
            serverCounts[chatKey] = chat.unread;
            total += chat.unread;
          }
        });
        // Server is strict source of truth — overwrite localStorage completely
        localStorage.setItem('chat_unread_counts', JSON.stringify(serverCounts));
        setUnreadCounts(serverCounts);
        setTotalUnread(total);
        // Sync GCW conversation list badges
        chatWidgetRef?.current?.syncUnreadFromServer?.(serverCounts);
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

  // Search execution
  useEffect(() => {
    if (!debouncedSearchQuery) { setSearchResults([]); return; }
    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API}/api/users/search?q=${debouncedSearchQuery}`, { headers })
      .then(r => r.json())
      .then(d => { if(Array.isArray(d)) setSearchResults(d); else setSearchResults([]); })
      .catch(() => {});
  }, [debouncedSearchQuery, token, isGuest]);

  const handleNewMessage = useCallback((partner, msg) => {
    // Always key by lowercase — the 5s server poll below and handleMarkRead's
    // delete both use the lowercase chat id, so a raw-case key here would
    // never get cleared by mark-as-read and would linger until the next poll.
    const chatKey = (partner || '').toLowerCase();
    if (chatWidgetRef.current?.isOpen && chatWidgetRef.current?.activeChat?.partner === partner) return;

    // Sound itself is handled once, inside GlobalChatWidget.jsx's own
    // new-message handling (the user's selected tone from AppSettings' Sound
    // section) — this used to ALSO play a hardcoded default chime here,
    // which meant every message played two overlapping sounds (the fixed
    // default one from here, plus the user's actually-selected one from
    // GlobalChatWidget). Only unread-count bookkeeping belongs here now.
    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    
    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, []);

  useEffect(() => {
    const handler = () => {
      const fsEl = document.fullscreenElement;
      setIsAppFullscreen(fsEl === document.documentElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleMarkRead = useCallback((chatId) => {
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

    // Sync GCW badge for this chat immediately
    chatWidgetRef?.current?.markReadFor?.(chatKey);
    // Note: checkUnread polling (every 5s) will reconcile with server
  }, []);

  const handleLogout = () => {
    clearUserSession();
    // Explicit redirect rather than reload() — reload() re-fetches whatever
    // (possibly protected) route the user was on, which then has to bounce
    // to /login itself, an extra hop that read as "logout didn't take
    // effect" until that second redirect landed.
    window.location.href = '/login';
  };

  return (
    <>
      <style>{`
        .main-nav {
          /* Fixed, not sticky — see navHeight's comment above the JSX for
             why (sticky wasn't reliably pinning during scroll on at least
             Home/Features), and the spacer div right after </nav> for how
             the space this leaves in normal flow gets reserved. */
          position: fixed; top: 0; left: 0; right: 0; width: 100%; z-index: 1000;
          transition: background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
          /* Reserves real space for the phone's status bar (clock/wifi/battery)
             instead of drawing under it — Android 15+ enforces edge-to-edge
             rendering in the Capacitor WebView with no app-level opt-out.
             --sp-status-bar-inset is set from nativeShell.js's
             initNativeStatusBarInset() (env(safe-area-inset-top) reports 0
             in this WebView, so it can't be used here); defaults to 0 in a
             plain browser tab where the var is never set. */
          padding-top: var(--sp-status-bar-inset, 0px);
        }
        /* APK only — scrolls away with the page instead of staying pinned;
           status-bar padding stays since the inset itself is unrelated to
           whether the bar is fixed. */
        .main-nav.nav-static {
          position: static;
        }
        .main-nav.scrolled {
          background: rgba(9,9,11,0.85) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border-bottom-color: rgba(255,255,255,0.08) !important;
          box-shadow: 0 2px 28px rgba(0,0,0,0.45) !important;
        }
        html[data-theme='light'] .main-nav.scrolled {
          background: rgba(247,248,252,0.92) !important;
          border-bottom-color: rgba(0,0,0,0.08) !important;
          box-shadow: 0 2px 16px rgba(0,0,0,0.08) !important;
        }
        @media (max-width: 480px) {
          .nav-logo-text {
            display: none !important;
          }
        }
        /* Mobile Drawer */
        .mobile-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 99998;
          animation: drawerFadeIn 0.22s ease;
        }
        @keyframes drawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .mobile-drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 260px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          animation: drawerSlideIn 0.25s cubic-bezier(0.22,1,0.36,1);
          overflow-y: auto;
          overflow-x: hidden;
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .mobile-drawer-panel .nav-link-btn {
          text-align: left !important;
          justify-content: flex-start !important;
        }
      `}</style>
      <nav ref={navRef} className={`main-nav${scrolled ? ' scrolled' : ''}${isApk ? ' nav-static' : ''}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {isMobileOrTablet ? (
          /* Mobile / Tablet Layout */
          <div className="nav-bar-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', position: 'relative' }}>
            {/* Left: Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigateAndCloseMenu('/')}>
              <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 32, height: 32 }} />
              <span className="nav-logo-text" style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>SahaPlay</span>
            </div>

            {/* Center: stylish script wordmark — standalone (PWA/TWA) home screen
                only, same idea as Instagram's centered script logotype on its home
                feed. Absolutely positioned so it centers independent of how wide
                the left/right content is, rather than needing a 3-column grid. */}
            {standalone && (location.pathname === '/' || location.pathname === '/public') && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  fontFamily: "'Pacifico', cursive", fontSize: 24, lineHeight: 1.8,
                  background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent', color: 'var(--brand-1)',
                  pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'visible'
                }}
              >
                SahaPlay
              </span>
            )}

            {/* Right: Actions & Hamburger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isLoggedIn && !standalone && (
                  /* Search */
                  <div style={{ position: 'relative' }}>
                    <button 
                      className={`nav-icon-btn${showSearch ? ' active' : ''}`}
                      title={t('search', 'Search')}
                      onClick={() => { const next = !showSearch; if (!next) setPersistedNavbarSearchOpen(false); setShowSearch(next); setShowRecentChats(false); setShowNotifications(false); }}
                    >
                      <Search size={18} />
                    </button>
                    {showSearch && (
                      <div className="nav-dropdown" style={{
                        position: 'fixed',
                        top: '68px',
                        left: '16px',
                        right: '16px',
                        width: 'auto',
                        background: isLight ? '#ffffff' : '#111',
                        border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        padding: 12,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        zIndex: 100000
                      }}>
                        <input 
                          autoFocus
                          placeholder={t('searchUsersPlaceholder', 'Search users...')}
                          className="nav-input"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10,
                            color: isLight ? '#111' : '#fff',
                            fontSize: 13,
                            outline: 'none',
                            marginBottom: 8
                          }}
                        />
                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                          {searchResults.length > 0 ? (
                            searchResults.map(u => (
                              <div key={u.username} onClick={() => goToSearchResult(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                                   onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                                  <div style={{ color: isLight ? '#666' : '#6b7280', fontSize: 11 }}>@{u.username}</div>
                                </div>
                              </div>
                            ))
                          ) : searchQuery ? (
                            <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 12 }}>{t('noUsersFound', 'No users found')}</div>
                          ) : searchHistory.length > 0 ? (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: isLight ? '#94a3b8' : '#6b7280', padding: '4px 8px 6px' }}>{t('recentSearches', 'Recent')}</div>
                              {searchHistory.map(h => (
                                <div key={h.username} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10 }}
                                     onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <div onClick={() => goToSearchResult(h)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: 8, cursor: 'pointer' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {h.avatarPath ? <img src={getAvatarUrl(h.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{h.displayName || h.username}</div>
                                      <div style={{ color: isLight ? '#666' : '#6b7280', fontSize: 11 }}>@{h.username}</div>
                                    </div>
                                  </div>
                                  <button onClick={() => removeFromSearchHistory(h.username)} title={t('removeFromHistory', 'Remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLight ? '#94a3b8' : '#6b7280', padding: 8, display: 'flex', flexShrink: 0 }}>
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <div onClick={clearSearchHistory} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--brand-1-light)', padding: '10px 8px 2px', cursor: 'pointer' }}>
                                {t('clearSearchHistory', 'Clear search history')}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isLoggedIn && !standalone && (
                  /* Chats Trigger */
                  <div style={{ position: 'relative' }}>
                    <button
                      className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
                      title={t('chats', 'Chats')}
                      onClick={() => { toggleOrRevealChats(); setShowNotifications(false); closeSearch(); }}
                    >
                      <MessageSquare size={18} />
                      {totalUnread > 0 && (
                        <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {totalUnread > 9 ? '9+' : totalUnread}
                        </div>
                      )}
                    </button>
                  </div>
                )}

                {isLoggedIn && (
                  /* Notifications — the only icon kept in the standalone top
                     bar (item 2 of the mobile PWA UI pass); Chat/Search/
                     Fullscreen/hamburger are all redundant there since the
                     bottom nav (or, for fullscreen, the OS shell itself)
                     already covers them. */
                  <div style={{ position: 'relative' }}>
                    <button title={t('notifications', 'Notifications')} onClick={() => { setShowNotifications(!showNotifications); closeSearch(); setShowRecentChats(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
                      <Bell size={18} />
                      {followRequests.filter(r => r.status === 'pending').length > 0 && (
                        <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {followRequests.filter(r => r.status === 'pending').length}
                        </div>
                      )}
                    </button>
                    {showNotifications && (
                      <div className="nav-dropdown" style={{
                        position: 'fixed',
                        top: '68px',
                        left: '16px',
                        right: '16px',
                        width: 'auto',
                        background: isLight ? '#ffffff' : '#111',
                        border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        padding: '12px 6px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        zIndex: 100000
                      }}>
                        <NotificationsPanelContent
                          followRequests={followRequests}
                          onAllow={allowRequest}
                          onFollowBack={followBack}
                          onItemClick={(username) => { setShowNotifications(false); navigate(`/profile/${username}`); }}
                          isLight={isLight}
                          t={t}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Fullscreen Button — meaningless in standalone mode, since
                    display:standalone already has no browser chrome to hide */}
                {!standalone && (
                  <button
                    className={`nav-icon-btn${isAppFullscreen ? ' active' : ''}`}
                    title={isAppFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                  >
                    {isAppFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                )}
              </div>

              {/* Hamburger Button — redundant in standalone mode, its
                  contents are now all reachable via the bottom nav */}
              {!standalone && (
                <button
                  className="nav-hamburger-btn"
                  onClick={() => setShowMobileMenu(m => !m)}
                  aria-label="Toggle menu"
                  style={{ display: 'flex' }}
                >
                  <div className="ham-line" />
                  <div className="ham-line" />
                  <div className="ham-line" />
                </button>
              )}


            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="nav-bar-row">
            {/* Left: Logo */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>SahaPlay</span>
            </div>

            {/* Center: Nav Links */}
            <div className="nav-links-desktop" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {isDesktopApp ? (
                <>
                  <button className={`nav-icon-btn${location.pathname === '/' ? ' active' : ''}`} title={t('home', 'Home')} onClick={() => navigate('/')}>
                    <Home size={18} />
                  </button>
                  <button className={`nav-icon-btn${location.pathname === '/pinned-rooms' ? ' active' : ''}`} title={t('pinnedRooms', 'Pinned Rooms')} onClick={() => navigate('/pinned-rooms')}>
                    <Pin size={18} />
                  </button>
                  <button className={`nav-icon-btn${location.pathname === '/public' ? ' active' : ''}`} title={t('publicRooms', 'Public Rooms')} onClick={() => navigate('/public')}>
                    <Globe size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/')}>{t('home', 'Home')}</button>
                  <button className={`nav-link-btn${location.pathname === '/features' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/features')}>{t('features', 'Features')}</button>
                  <button className={`nav-link-btn${location.pathname === '/how-it-works' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/how-it-works')}>{t('howItWorks', 'Guide')}</button>
                  <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ padding: '8px 16px' }} onClick={() => navigate('/public')}>{t('explore', 'Explore')}</button>
                </>
              )}
            </div>

            {/* Right: Actions */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              {isLoggedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className={`nav-icon-btn${showSearch ? ' active' : ''}`}
                        title={t('search', 'Search')}
                        onClick={() => { const next = !showSearch; if (!next) setPersistedNavbarSearchOpen(false); setShowSearch(next); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
                      >
                        <Search size={18} />
                      </button>
                      {showSearch && (
                        <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -60, width: 320, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                          <input 
                            autoFocus
                            placeholder={t('searchUsersPlaceholder', 'Search users...')}
                            className="nav-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 8 }}
                          />
                          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                            {searchResults.length > 0 ? (
                              searchResults.map(u => (
                                <div key={u.username} onClick={() => goToSearchResult(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                                     onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                                    <div style={{ color: '#6b7280', fontSize: 11 }}>@{u.username}</div>
                                  </div>
                                </div>
                              ))
                            ) : searchQuery ? (
                              <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 12 }}>{t('noUsersFound', 'No users found')}</div>
                            ) : searchHistory.length > 0 ? (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#6b7280', padding: '4px 8px 6px' }}>{t('recentSearches', 'Recent')}</div>
                                {searchHistory.map(h => (
                                  <div key={h.username} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10 }}
                                       onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                       onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div onClick={() => goToSearchResult(h)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: 8, cursor: 'pointer' }}>
                                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {h.avatarPath ? <img src={getAvatarUrl(h.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <User size={14} color="#fff" />}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{h.displayName || h.username}</div>
                                        <div style={{ color: '#6b7280', fontSize: 11 }}>@{h.username}</div>
                                      </div>
                                    </div>
                                    <button onClick={() => removeFromSearchHistory(h.username)} title={t('removeFromHistory', 'Remove')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 8, display: 'flex', flexShrink: 0 }}>
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                                <div onClick={clearSearchHistory} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--brand-1-light)', padding: '10px 8px 2px', cursor: 'pointer' }}>
                                  {t('clearSearchHistory', 'Clear search history')}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chats Trigger */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
                        title={t('chats', 'Chats')}
                        onClick={() => { toggleOrRevealChats(); setShowNotifications(false); closeSearch(); setShowUserMenu(false); }}
                      >
                        <MessageSquare size={18} />
                        {totalUnread > 0 && (
                          <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {totalUnread > 9 ? '9+' : totalUnread}
                          </div>
                        )}
                      </button>
                    </div>
      
                    {/* Notifications */}
                    <div style={{ position: 'relative' }}>
                      <button title={t('notifications', 'Notifications')} onClick={() => { setShowNotifications(!showNotifications); closeSearch(); setShowRecentChats(false); setShowUserMenu(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
                        <Bell size={18} />
                        {followRequests.filter(r => r.status === 'pending').length > 0 && (
                          <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {followRequests.filter(r => r.status === 'pending').length}
                          </div>
                        )}
                      </button>
                      {showNotifications && (
                        <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: -20, width: 340, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '12px 6px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 10000 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
                          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {followRequests.length > 0 ? (
                              followRequests.map(u => (
                                <div key={u.username} onClick={() => { setShowNotifications(false); navigate(`/profile/${u.username}`); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? 'rgba(var(--brand-1-rgb),0.05)' : 'transparent' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                  onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? 'rgba(var(--brand-1-rgb),0.05)' : 'transparent'}>
                                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                    {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={18} color="#888" />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                                      {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                      {u.status === 'pending' ? (
                                        <button onClick={(e) => allowRequest(u.username, e)} className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(var(--brand-1-rgb),0.15)', border: 'none', color: isLight ? '#000000' : 'var(--brand-1-light)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                                      ) : (
                                        <button disabled className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                                      )}

                                      {u.myFollowStatus === 'accepted' ? (
                                        <button disabled className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                                      ) : (
                                        <button onClick={(e) => {
                                          e.stopPropagation();
                                          if (u.myFollowStatus === 'pending') return;
                                          followBack(u.username, e);
                                        }}
                                          className={`notif-action-btn${u.myFollowStatus === 'pending' ? '' : ' stay-white'}`}
                                          style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? 'rgba(255,255,255,0.05)' : 'var(--brand-gradient)', border: 'none', color: u.myFollowStatus === 'pending' ? '#6b7280' : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                          {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
      
                    {/* App Fullscreen */}
                    <button
                      className={`nav-icon-btn${isAppFullscreen ? ' active' : ''}`}
                      title={isAppFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      onClick={() => {
                        if (!document.fullscreenElement) {
                          document.documentElement.requestFullscreen().catch(() => {});
                        } else {
                          document.exitFullscreen().catch(() => {});
                        }
                      }}
                    >
                      {isAppFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                  </div>
    
                  {/* User Menu Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
                    <div className="profile-pill"
                      onMouseEnter={() => { setShowUserMenu(true); closeSearch(); setShowRecentChats(false); setShowNotifications(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {profile?.avatarPath ? (
                          <img src={getAvatarUrl(profile.avatarPath)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={14} style={{ color: 'var(--brand-1)' }} />
                        )}
                      </div>
                      <span style={{ fontWeight: 600 }}>{loggedInUsername}</span>
                    </div>
                    {showUserMenu && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                        <div className="nav-dropdown" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                          <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={16} color="var(--brand-1)" />
                            </div>
                            {t('account', 'Account')}
                          </button>
                          <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/app-settings'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Settings size={16} color="#10b981" />
                            </div>
                            {t('app', 'App')}
                          </button>
                          <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowSupportModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <HelpCircle size={16} color="#f59e0b" />
                            </div>
                            {t('contactSupport', 'Contact Support')}
                          </button>
                          {!isDesktopApp && (
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowDownloadAppModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Download size={16} color="#38bdf8" />
                              </div>
                              {t('getDesktopApp', 'Get Desktop App')}
                            </button>
                          )}
                          {isAdminRole && (
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/admin'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-2-rgb),0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-2-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sparkles size={16} color="var(--brand-2)" />
                              </div>
                              {t('adminDashboard', 'Admin Dashboard')}
                            </button>
                          )}
                          <div className="profile-divider" />
                          <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <LogOut size={16} color="#f87171" />
                            </div>
                            {t('logOut', 'Log Out')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isGuest && (
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginRight: 8 }} onMouseLeave={() => setShowUserMenu(false)}>
                      <div className="profile-pill"
                        onMouseEnter={() => { setShowUserMenu(true); closeSearch(); setShowRecentChats(false); setShowNotifications(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} style={{ color: 'var(--brand-1)' }} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{loggedInUsername}</span>
                      </div>
                      {showUserMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                          <div className="nav-dropdown" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={16} color="var(--brand-1)" />
                              </div>
                              {t('account', 'Account')}
                            </button>
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/app-settings'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Settings size={16} color="#10b981" />
                              </div>
                              {t('app', 'App')}
                            </button>
                            {!isDesktopApp && (
                              <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowDownloadAppModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Download size={16} color="#38bdf8" />
                                </div>
                                {t('getDesktopApp', 'Get Desktop App')}
                              </button>
                            )}
                            <div className="profile-divider" style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                            <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); clearUserSession(); navigate('/login'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.15)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={16} color="var(--brand-1)" />
                              </div>
                              {t('logIn', 'Sign In')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={() => navigate('/login')} style={{ background: isLight ? 'transparent' : 'none', border: isLight ? '1px solid rgba(0,0,0,0.18)' : '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', color: isLight ? '#374151' : '#ccc', fontSize: '14px', fontWeight: 600, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'transparent' : 'none'; e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.15)'; }}
                  >
                    {t('logIn', 'Log In')}
                  </button>
                  <button onClick={() => navigate('/signup')} className="stay-white" style={{ background: 'var(--brand-gradient)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '9px 20px', borderRadius: '10px', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {t('signUp', 'Sign Up')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
      {/* Reserves the space main-nav no longer occupies now that it's
          position:fixed — see navHeight's own comment above. Not needed in
          the APK: nav-static keeps it in normal document flow there, so an
          extra spacer would just double the gap. */}
      {!isApk && <div aria-hidden="true" style={{ height: navHeight }} />}

      {/* Mobile/Tablet Drawer – rendered as a portal so it's outside the fixed nav */}
      {isMobileOrTablet && showMobileMenu && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Side Panel */}
          <div
            className="mobile-drawer-panel"
            style={{
              background: isLight ? '#ffffff' : '#141418',
              borderLeft: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isLight ? '-8px 0 32px rgba(0,0,0,0.12)' : '-8px 0 40px rgba(0,0,0,0.7)',
              padding: '0',
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 28, height: 28 }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: isLight ? '#111' : '#fff' }}>Menu</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLight ? '#555' : '#aaa', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Nav Links */}
            <div style={{ padding: '8px', flex: 1 }}>
              {isDesktopApp ? (
                <>
                  <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/')}>
                    <Home size={16} />
                    {t('home', 'Home')}
                  </button>
                  <button className={`nav-link-btn${location.pathname === '/pinned-rooms' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/pinned-rooms')}>
                    <Pin size={16} />
                    {t('pinnedRooms', 'Pinned Rooms')}
                  </button>
                  <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/public')}>
                    <Globe size={16} />
                    {t('publicRooms', 'Public Rooms')}
                  </button>
                </>
              ) : (
                <>
                  <button className={`nav-link-btn${location.pathname === '/' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/')}>
                    <Home size={16} />
                    {t('home', 'Home')}
                  </button>
                  <button className={`nav-link-btn${location.pathname === '/features' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/features')}>
                    <Sparkles size={16} />
                    {t('features', 'Features')}
                  </button>
                  <button className={`nav-link-btn${location.pathname === '/how-it-works' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/how-it-works')}>
                    <HelpCircle size={16} />
                    {t('howItWorks', 'Guide')}
                  </button>
                  <button className={`nav-link-btn${location.pathname === '/public' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/public')}>
                    <Compass size={16} />
                    {t('explore', 'Explore')}
                  </button>
                </>
              )}

              <div style={{ height: '1px', background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

              {(isLoggedIn || isGuest) && (
                <ProfileActionMenu
                  currentPath={location.pathname}
                  loggedInUsername={loggedInUsername}
                  isGuest={isGuest}
                  isAdminRole={isAdminRole}
                  isDesktopApp={isDesktopApp}
                  onProfileClick={() => navigateAndCloseMenu('/profile')}
                  onAppSettingsClick={() => navigateAndCloseMenu('/app-settings')}
                  onContactSupportClick={() => { setShowSupportModal(true); setShowMobileMenu(false); }}
                  onGetDesktopAppClick={() => { setShowDownloadAppModal(true); setShowMobileMenu(false); }}
                  onAdminClick={() => navigateAndCloseMenu('/admin')}
                  onSignInClick={() => { clearUserSession(); navigateAndCloseMenu('/login'); }}
                  onSignUpClick={() => navigateAndCloseMenu('/signup')}
                  onLogoutClick={() => { mobileMenuBack.skipNextClose(); setShowMobileMenu(false); handleLogout(); }}
                  t={t}
                />
              )}

              {!isLoggedIn && !isGuest && (
                <>
                  <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={() => navigateAndCloseMenu('/login')}>
                    <User size={16} />
                    {t('logIn', 'Sign In')}
                  </button>

                  <button className="stay-white" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', background: 'var(--brand-gradient)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginTop: 4 }} onClick={() => navigateAndCloseMenu('/signup')}>
                    <Sparkles size={16} />
                    {t('signUp', 'Sign Up')}
                  </button>
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}


      {!isLoggedIn && localStorage.getItem('watch_is_guest') === 'true' && (
        <div className="guest-marquee-container">
          <div className="guest-marquee-text">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} /> 
              {t('guestLimitations', 'You are currently browsing as a Guest. Guests can explore SahaPlay and join rooms if the host allows it, but only logged-in members can create rooms. Sign up for a free account to unlock full access.')}
            </span>
          </div>
        </div>
      )}

      {/* Self-contained Global Chat Widget */}
      {isLoggedIn && (
        <GlobalChatWidget
          ref={chatWidgetRef}
          isOpen={showRecentChats}
          onClose={() => setShowRecentChats(false)}
          unreadCounts={unreadCounts}
          onMarkRead={handleMarkRead}
          onNewMessage={handleNewMessage}
          pendingOpenChat={pendingOpenChat}
          onPendingOpenChatHandled={() => setPendingOpenChat(null)}
        />
      )}

      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <DownloadAppModal isOpen={showDownloadAppModal} onClose={() => setShowDownloadAppModal(false)} />
    </>
  );
};

export default Navbar;
