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
 * Deliberately just a blur+dim layer, no content of its own: it sits BELOW
 * KeyRecoveryModal (z-index 2147483600) and OAuthEncryptionModal (99999) —
 * see this file's own z-index — so whichever of those actually has
 * something to show (a password/passphrase field) renders on top of it
 * normally; this is purely the backstop for the moments neither of them
 * has rendered yet but the key still isn't ready.
 */
import React from 'react';
import { useCrypto } from '../contexts/CryptoContext';
import { isCapacitorApp, isTauriApp } from '../lib/platform';

export default function DeviceUnlockOverlay() {
  const { keyPair } = useCrypto();

  if (!isCapacitorApp() && !isTauriApp()) return null;
  if (keyPair) return null;

  const token = localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  const hasSession = !!token && token !== 'null' && token !== 'undefined' && !isGuest;
  if (!hasSession) return null; // guests/logged-out: no key to wait for, nothing to hide

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90000,
        background: isLight ? 'rgba(241,245,249,0.94)' : 'rgba(5,5,9,0.94)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
      }}
    />
  );
}
