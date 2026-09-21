/**
 * DeviceUnlockOverlay.jsx
 *
 * A full-screen blurred backdrop covering the app for the entire window
 * between "app launched/resumed for a real (non-guest) account" and "the
 * encryption key is actually decrypted and in memory" — native Android
 * fingerprint, Windows Hello, and the passphrase/password fallback prompts
 * (KeyRecoveryModal / EncryptionUnlockGate's OAuthEncryptionModal) can all
 * take a moment to appear, and the native biometric/Hello dialog itself is
 * an OS-level prompt this app doesn't control the timing or coverage of.
 *
 * Without this, that whole gap rendered nothing at all on top of the app —
 * whatever page or chat was already open before the app was backgrounded or
 * fully closed stayed completely visible underneath (still-decrypted stale
 * DOM content, or freshly-computed "🔒 Encrypted message" placeholders,
 * both peekable) until the OS dialog happened to pop up and however long it
 * took the user to notice it. Native apps (Tauri desktop / Capacitor
 * mobile) only — see the early return below: a plain browser tab never
 * uses native device unlock at all (EncryptionUnlockGate's own header
 * comment) and already goes straight to a modal that carries its own full
 * blurred overlay near-instantly, so this extra base layer isn't needed
 * there and would just add a flash of blur to every ordinary page refresh.
 *
 * Shows a small spinner + label rather than a bare blur — a real-device
 * report of a plain blank/white screen here read as "the app is frozen,"
 * indistinguishable from an actual crash/hang, especially right after
 * deviceUnlock.js's own 12s native-call timeout was added specifically to
 * stop this exact state from lasting forever. Nothing shown here is
 * sensitive (just a lock icon + "Unlocking…"), so it's safe to render even
 * this early. Sits BELOW KeyRecoveryModal (z-index 2147483600) and
 * OAuthEncryptionModal (99999) — see this file's own z-index — so
 * whichever of those actually has something to show (a password/passphrase
 * field) renders on top of it normally; this is purely the backstop for
 * the moments neither of them has rendered yet but the key still isn't
 * ready.
 */
import React from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCrypto } from '../contexts/CryptoContext';
import { isCapacitorApp, isTauriApp } from '../lib/platform';

export default function DeviceUnlockOverlay() {
  const { keyPair, unlockDeferred } = useCrypto();
  const { t } = useTranslation();

  if (!isCapacitorApp() && !isTauriApp()) return null;
  if (keyPair || unlockDeferred) return null;

  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const hasSession = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  if (!hasSession) return null; // guests/logged-out: no key to wait for, nothing to hide

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90000,
        background: isLight ? 'rgba(241,245,249,0.94)' : 'rgba(5,5,9,0.94)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <style>{`
        @keyframes device-unlock-spin { to { transform: rotate(360deg); } }
        @keyframes device-unlock-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
      `}</style>
      <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `3px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)'}`,
          borderTopColor: 'var(--brand-1)',
          animation: 'device-unlock-spin 0.9s linear infinite',
        }} />
        <Lock size={20} color={isLight ? '#334155' : '#cbd5e1'} />
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
        color: isLight ? '#334155' : 'rgba(255,255,255,0.65)',
        animation: 'device-unlock-pulse 1.6s ease-in-out infinite',
      }}>
        {t('unlockingMessages', 'Unlocking…')}
      </div>
    </div>
  );
}
