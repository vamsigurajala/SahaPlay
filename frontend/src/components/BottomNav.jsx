import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home as HomeIcon, Globe, MessageSquare, Bell, User, X } from 'lucide-react';
import { isStandalonePWA, isTauriApp } from '../lib/platform';
import { useFollowRequests } from '../hooks/useFollowRequests';
import { clearUserSession } from '../lib/authUtils.js';
import GlobalChatWidget from './GlobalChatWidget';
import NotificationsPanelContent from './NotificationsPanelContent';
import ProfileActionMenu from './ProfileActionMenu';
import SupportModal from './SupportModal';
import DownloadAppModal from './DownloadAppModal';

// Native-app-style bottom tab bar, shown only inside an installed PWA / future
// Android TWA (never in a regular mobile browser tab — see isStandalonePWA()).
// Each tab reuses an existing piece rather than rebuilding it: Home/Public
// Rooms are routes Home.jsx/PublicRooms.jsx already own; Global Chat mounts
// its own independent GlobalChatWidget instance (the component already
// supports multiple simultaneous instances — Room.jsx mounts a separate one
// too); Notifications and Profile reuse the same content components Navbar.jsx
// uses for its mobile dropdown/drawer.
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const token = localStorage.getItem('watch_token');
  const rawUsername = localStorage.getItem('watch_username');
  const loggedInUsername = rawUsername && rawUsername.toLowerCase().startsWith('guest_') ? rawUsername.slice(6) : rawUsername;
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const isLoggedIn = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  const isDesktopApp = isTauriApp();
  const watchRole = localStorage.getItem('watch_role') || 'user';
  const isAdminRole = ['super_admin', 'admin', 'moderator', 'support'].includes(watchRole);

  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);

  const { followRequests, allowRequest, followBack } = useFollowRequests();
  const pendingCount = followRequests.filter(r => r.status === 'pending').length;

  // Room is its own immersive, already-crowded UI (video controls, floating
  // chat panel) — a persistent tab bar there would just add clutter on top
  // of existing bottom-anchored controls, so it's excluded here.
  if (!isStandalonePWA() || !(isLoggedIn || isGuest) || location.pathname.startsWith('/room/')) return null;

  const closeOverlays = () => { setShowChat(false); setShowNotifications(false); setShowProfile(false); };

  const handleLogout = () => {
    clearUserSession();
    window.location.reload();
  };

  // Chat/Notifications hidden for guests — same condition Navbar.jsx already
  // uses to hide those icons in the regular mobile nav (guests can't chat,
  // and per the recent guest-restrictions changes can't create/join rooms
  // either, so a tab leading to an empty state would read as broken).
  const tabs = [
    { key: 'home', label: t('home', 'Home'), icon: HomeIcon, active: location.pathname === '/' && !showChat && !showNotifications && !showProfile, onClick: () => { closeOverlays(); navigate('/'); } },
    { key: 'public', label: t('publicRooms', 'Public Rooms'), icon: Globe, active: location.pathname === '/public' && !showChat && !showNotifications && !showProfile, onClick: () => { closeOverlays(); navigate('/public'); } },
    ...(isLoggedIn ? [
      { key: 'chat', label: t('chats', 'Chats'), icon: MessageSquare, active: showChat, onClick: () => { const next = !showChat; closeOverlays(); setShowChat(next); } },
      { key: 'notifications', label: t('notifications', 'Notifications'), icon: Bell, active: showNotifications, badge: pendingCount, onClick: () => { const next = !showNotifications; closeOverlays(); setShowNotifications(next); } },
    ] : []),
    { key: 'profile', label: t('profile', 'Profile'), icon: User, active: showProfile, onClick: () => { const next = !showProfile; closeOverlays(); setShowProfile(next); } },
  ];

  return (
    <>
      <style>{`
        .bottom-nav-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 100001;
          display: flex; align-items: stretch;
          background: #111114; border-top: 1px solid rgba(255,255,255,0.08);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        html[data-theme='light'] .bottom-nav-bar {
          background: #ffffff; border-top: 1px solid rgba(0,0,0,0.08);
        }
        .bottom-nav-tab {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; padding: 8px 4px 7px; background: none; border: none; cursor: pointer;
          color: #8b8b93; font-size: 10px; font-weight: 600; position: relative;
        }
        .bottom-nav-tab.active { color: var(--brand-1); }
        html[data-theme='light'] .bottom-nav-tab { color: #6b7280; }
        .bottom-nav-badge {
          position: absolute; top: 4px; right: calc(50% - 20px);
          background: #ef4444; color: #fff; border-radius: 50%;
          min-width: 15px; height: 15px; font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; padding: 0 3px;
        }
        .bottom-nav-overlay {
          position: fixed; inset: 0; z-index: 100000;
          background: #0b0b0f; display: flex; flex-direction: column;
        }
        html[data-theme='light'] .bottom-nav-overlay { background: #f7fafc; }
        .bottom-nav-overlay-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        html[data-theme='light'] .bottom-nav-overlay-header { border-bottom-color: rgba(0,0,0,0.08); }
        .bottom-nav-overlay-title { font-size: 16px; font-weight: 800; color: #fff; margin: 0; }
        html[data-theme='light'] .bottom-nav-overlay-title { color: #111; }
        .bottom-nav-overlay-close { background: none; border: none; cursor: pointer; color: #aaa; padding: 4px; }
        html[data-theme='light'] .bottom-nav-overlay-close { color: #555; }
        .bottom-nav-overlay-body { flex: 1; overflow-y: auto; padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 90px); }
      `}</style>

      {showNotifications && (
        <div className="bottom-nav-overlay">
          <div className="bottom-nav-overlay-header">
            <h2 className="bottom-nav-overlay-title">{t('notifications', 'Notifications')}</h2>
            <button className="bottom-nav-overlay-close" onClick={() => setShowNotifications(false)} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="bottom-nav-overlay-body">
            <NotificationsPanelContent
              followRequests={followRequests}
              onAllow={allowRequest}
              onFollowBack={followBack}
              onItemClick={(username) => { setShowNotifications(false); navigate(`/profile/${username}`); }}
              isLight={isLight}
              t={t}
              listMaxHeight="none"
            />
          </div>
        </div>
      )}

      {showProfile && (
        <div className="bottom-nav-overlay">
          <div className="bottom-nav-overlay-header">
            <h2 className="bottom-nav-overlay-title">{t('profile', 'Profile')}</h2>
            <button className="bottom-nav-overlay-close" onClick={() => setShowProfile(false)} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="bottom-nav-overlay-body">
            <ProfileActionMenu
              compact
              currentPath={location.pathname}
              loggedInUsername={loggedInUsername}
              isGuest={isGuest}
              isAdminRole={isAdminRole}
              isDesktopApp={isDesktopApp}
              onProfileClick={() => { setShowProfile(false); navigate('/profile'); }}
              onAppSettingsClick={() => { setShowProfile(false); navigate('/app-settings'); }}
              onContactSupportClick={() => { setShowProfile(false); setShowSupportModal(true); }}
              onGetDesktopAppClick={() => { setShowProfile(false); setShowDownloadAppModal(true); }}
              onAdminClick={() => { setShowProfile(false); navigate('/admin'); }}
              onSignInClick={() => { clearUserSession(); setShowProfile(false); navigate('/login'); }}
              onSignUpClick={() => { setShowProfile(false); navigate('/signup'); }}
              onLogoutClick={() => { setShowProfile(false); handleLogout(); }}
              t={t}
            />
          </div>
        </div>
      )}

      {isLoggedIn && (
        <GlobalChatWidget
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          unreadCounts={{}}
          onMarkRead={() => {}}
          onMarkAllRead={() => {}}
          onNewMessage={() => {}}
        />
      )}

      <nav className="bottom-nav-bar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} className={`bottom-nav-tab${tab.active ? ' active' : ''}`} onClick={tab.onClick}>
              <Icon size={21} />
              {!!tab.badge && <span className="bottom-nav-badge">{tab.badge > 9 ? '9+' : tab.badge}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <DownloadAppModal isOpen={showDownloadAppModal} onClose={() => setShowDownloadAppModal(false)} />
    </>
  );
}
