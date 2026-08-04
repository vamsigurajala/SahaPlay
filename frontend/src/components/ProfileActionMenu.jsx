import React from 'react';
import { User, Settings, HelpCircle, Download, Sparkles, LogOut, ChevronRight } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatarUtils';

// Extracted from Navbar.jsx's mobile hamburger drawer (the logged-in/guest
// action-item list: Profile, App Settings, Contact Support, Get Desktop App,
// Admin Dashboard, Sign in/up or Log out). Navbar keeps rendering this via
// callback props with its own navigateAndCloseMenu()/drawer-closing behavior
// unchanged; the standalone-PWA bottom nav's Profile tab renders the same
// component with its own (simpler) navigation callbacks.
//
// `compact`, when true, scopes the menu down to exactly Account / App
// Settings / Contact Support / Logout (or Sign In+Sign Up for a guest, since
// "Logout" doesn't apply to a guest session) — hiding Get Desktop App
// (redundant inside an already-installed app) and Admin Dashboard, for the
// standalone-PWA bottom nav's Profile tab. It also renders as a distinct,
// card-style row list (icon chip + label + chevron) instead of the plain
// `.nav-link-btn` list the hamburger drawer uses — that shared class centers
// its content by default (fine for the drawer's own scoped override), which
// left compact rows looking mis-aligned/plain in the bottom-nav drawer.
export default function ProfileActionMenu({
  compact = false,
  currentPath,
  loggedInUsername,
  isGuest,
  isAdminRole,
  isDesktopApp,
  onProfileClick,
  onAppSettingsClick,
  onContactSupportClick,
  onGetDesktopAppClick,
  onAdminClick,
  onSignInClick,
  onSignUpClick,
  onLogoutClick,
  avatarPath,
  t,
}) {
  if (compact) {
    const Row = ({ icon: Icon, label, onClick, active, danger, color, avatarUrl }) => (
      <button className={`profile-drawer-item${active ? ' active' : ''}${danger ? ' danger' : ''}`} onClick={onClick}>
        <span className="profile-drawer-item-icon" style={avatarUrl ? undefined : (color ? { background: `${color}1f`, color } : undefined)}>
          {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Icon size={17} />}
        </span>
        <span className="profile-drawer-item-label">{label}</span>
        <ChevronRight size={16} className="profile-drawer-item-chevron" />
      </button>
    );

    return (
      <>
        <style>{`
          .profile-drawer-item {
            width: 100%; display: flex; align-items: center; gap: 12px;
            padding: 12px 10px; background: none; border: none; cursor: pointer;
            border-radius: 14px; text-align: left; color: #e5e5ea;
            font-size: 14.5px; font-weight: 600; transition: background 0.15s ease;
          }
          .profile-drawer-item:hover, .profile-drawer-item:active { background: rgba(255,255,255,0.07); }
          html[data-theme='light'] .profile-drawer-item { color: #1e293b; }
          html[data-theme='light'] .profile-drawer-item:hover, html[data-theme='light'] .profile-drawer-item:active { background: rgba(0,0,0,0.045); }
          .profile-drawer-item.active { background: rgba(var(--brand-1-rgb), 0.14); }
          .profile-drawer-item-icon {
            width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.08); color: #c7c7cf;
          }
          html[data-theme='light'] .profile-drawer-item-icon { background: rgba(0,0,0,0.05); color: #475569; }
          .profile-drawer-item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .profile-drawer-item-chevron { color: #5c5c66; flex-shrink: 0; }
          html[data-theme='light'] .profile-drawer-item-chevron { color: #b0b8c4; }
          .profile-drawer-item.danger { color: #f87171; }
          .profile-drawer-item.danger .profile-drawer-item-icon { background: rgba(248,113,113,0.14); color: #f87171; }
          .profile-drawer-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 8px 6px; }
          html[data-theme='light'] .profile-drawer-divider { background: rgba(0,0,0,0.08); }
          .profile-drawer-signup-btn {
            width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
            padding: 13px 14px; border-radius: 14px; border: none; cursor: pointer;
            background: var(--brand-gradient); color: #fff; font-size: 14.5px; font-weight: 700;
            margin-top: 6px;
          }
        `}</style>

        <Row icon={User} label={t('account', 'Account')} onClick={onProfileClick} active={currentPath === '/profile'} color="var(--brand-1)" avatarUrl={!isGuest && avatarPath ? getAvatarUrl(avatarPath) : null} />
        <Row icon={Settings} label={t('app', 'App Settings')} onClick={onAppSettingsClick} active={currentPath === '/app-settings'} color="var(--brand-2)" />
        <Row icon={HelpCircle} label={t('contactSupport', 'Contact Support')} onClick={onContactSupportClick} color="#38bdf8" />

        <div className="profile-drawer-divider" />

        {isGuest ? (
          <>
            <Row icon={User} label={t('logIn', 'Sign In')} onClick={onSignInClick} color="var(--brand-1)" />
            <button className="profile-drawer-signup-btn stay-white" onClick={onSignUpClick}>
              <Sparkles size={16} className="stay-white" />
              <span className="stay-white">{t('signUp', 'Sign Up')}</span>
            </button>
          </>
        ) : (
          <Row icon={LogOut} label={t('logOut', 'Log Out')} onClick={onLogoutClick} danger />
        )}
      </>
    );
  }

  return (
    <>
      <button className={`nav-link-btn${currentPath === '/profile' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onProfileClick}>
        <User size={16} />
        {`${t('profile', 'Profile')} ${loggedInUsername ? `(${loggedInUsername})` : ''}`}
      </button>

      <button className={`nav-link-btn${currentPath === '/app-settings' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onAppSettingsClick}>
        <Settings size={16} />
        {t('app', 'App Settings')}
      </button>

      <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onContactSupportClick}>
        <HelpCircle size={16} />
        {t('contactSupport', 'Contact Support')}
      </button>

      {!isDesktopApp && (
        <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onGetDesktopAppClick}>
          <Download size={16} />
          {t('getDesktopApp', 'Get Desktop App')}
        </button>
      )}

      {isAdminRole && (
        <button className={`nav-link-btn${currentPath === '/admin' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onAdminClick}>
          <Sparkles size={16} color="var(--brand-2)" />
          {t('adminDashboard', 'Admin Dashboard')}
        </button>
      )}

      {isGuest ? (
        <>
          <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onSignInClick}>
            <User size={16} />
            {t('logIn', 'Sign In')}
          </button>
          <button className="stay-white" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', background: 'var(--brand-gradient)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginTop: 4 }} onClick={onSignUpClick}>
            <Sparkles size={16} />
            {t('signUp', 'Sign Up')}
          </button>
        </>
      ) : (
        <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px', color: '#f87171' }} onClick={onLogoutClick}>
          <LogOut size={16} color="#f87171" />
          {t('logOut', 'Log Out')}
        </button>
      )}
    </>
  );
}
