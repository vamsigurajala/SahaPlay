import React from 'react';
import { User, Settings, HelpCircle, Download, Sparkles, LogOut } from 'lucide-react';

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
// standalone-PWA bottom nav's Profile tab. The hamburger drawer's call site
// doesn't pass this, so it keeps showing everything exactly as before.
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
  t,
}) {
  return (
    <>
      <button className={`nav-link-btn${currentPath === '/profile' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onProfileClick}>
        <User size={16} />
        {t('profile', 'Profile')} {loggedInUsername ? `(${loggedInUsername})` : ''}
      </button>

      <button className={`nav-link-btn${currentPath === '/app-settings' ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onAppSettingsClick}>
        <Settings size={16} />
        {t('app', 'App Settings')}
      </button>

      <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onContactSupportClick}>
        <HelpCircle size={16} />
        {t('contactSupport', 'Contact Support')}
      </button>

      {!isDesktopApp && !compact && (
        <button className="nav-link-btn" style={{ width: '100%', textAlign: 'left', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '10px' }} onClick={onGetDesktopAppClick}>
          <Download size={16} />
          {t('getDesktopApp', 'Get Desktop App')}
        </button>
      )}

      {isAdminRole && !compact && (
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
