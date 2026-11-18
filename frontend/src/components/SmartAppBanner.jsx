import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isCapacitorApp, isStandalonePWA } from '../lib/platform';

export default function SmartAppBanner() {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('sp_banner_dismissed') === '1';
    } catch (_) {
      return false;
    }
  });

  // Extract deep-link target path
  const pathname = location.pathname;
  let targetPath = null;

  if (pathname.startsWith('/room/') || pathname.startsWith('/profile/')) {
    targetPath = pathname + location.search;
  } else if (pathname === '/login' || pathname === '/signup') {
    const searchParams = new URLSearchParams(location.search);
    const next = searchParams.get('next');
    if (next && (next.startsWith('/room/') || next.startsWith('/profile/'))) {
      targetPath = next;
    }
  }

  const isNativeOrPwa = isCapacitorApp() || isStandalonePWA();
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;

  // Build target deep-link URLs
  const host = typeof window !== 'undefined' ? window.location.host : 'sahaplay.com';
  const cleanPath = targetPath ? targetPath.replace(/^\/+/, '') : '';
  const intentUrl = targetPath
    ? `intent://${host}/${cleanPath}#Intent;scheme=https;package=com.sahaplay.app;S.browser_fallback_url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')};end`
    : null;
  const customSchemeUrl = targetPath ? `sahaplay://${cleanPath}` : null;

  // Auto-attempt invoke once on Android mobile browser when visiting a room/profile link
  useEffect(() => {
    if (isNativeOrPwa || !isAndroid || !targetPath) return;
    const sessionKey = `sp_auto_invoked_${targetPath}`;
    try {
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1');
        // Trigger Android intent to open app if installed
        window.location.href = intentUrl;
      }
    } catch (_) {}
  }, [targetPath, isAndroid, isNativeOrPwa, intentUrl]);

  if (isNativeOrPwa || !targetPath || dismissed) {
    return null;
  }

  const handleOpenApp = (e) => {
    e.preventDefault();
    if (isAndroid && intentUrl) {
      window.location.href = intentUrl;
    } else if (customSchemeUrl) {
      window.location.href = customSchemeUrl;
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('sp_banner_dismissed', '1');
    } catch (_) {}
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 9999,
        background: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
        color: '#fff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <img
          src="/logos/trans_android_pwa.png"
          alt="SahaPlay"
          style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        />
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            SahaPlay App
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isMobile ? 'Open in installed app for synced video & audio' : 'Open in SahaPlay desktop / app'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          onClick={handleOpenApp}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            transition: 'transform 0.15s',
          }}
        >
          Open App
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Close banner"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
