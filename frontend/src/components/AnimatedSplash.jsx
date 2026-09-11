import React, { useState, useEffect } from 'react';
import { isCapacitorApp } from '../lib/platform';

// Mobile app only — explicitly not wanted on the website. isCapacitorApp()
// reads window.Capacitor, a global the native shell injects into the page
// before it loads, present ONLY inside the installed Android app's WebView
// and never in a regular browser tab. This is still a plain web-code
// condition (same file, same deploy as everything else on the site) — it
// doesn't require a native rebuild, since the check just runs differently
// depending on where the exact same JS happens to execute.
//
// Shown once per app cold start (mounted at the App root, so it never
// remounts on route navigation — only on a real page load / app launch).
// Purely a visual overlay layered on top of whatever's rendering underneath;
// nothing else waits on it, so it never delays auth checks or data fetches.
// Timeline: logo animates in (~550ms) -> brief hold -> overlay fades out
// (~350ms), unmounting once fully transparent. Tightened from an earlier
// ~1.5s version — every single app open (not just first-ever install) sits
// through this, so shaving it down reads as noticeably snappier on daily
// repeat opens instead of "sluggish".
const HOLD_UNTIL_MS = 700;  // when the fade-out begins
const REMOVE_AT_MS = 1050;  // when the overlay unmounts entirely

// Was a hardcoded white background — fine while the native OS splash
// underneath is also forced white (see android-capacitor-build.yml), but it
// meant fading THIS overlay out was a hard white -> dark cut to the app's
// actual (near-black) background, on every single launch: exactly what read
// as a "flicker" right as the app became usable. Matching the same
// --bg-color the app itself boots into (read synchronously from the same
// localStorage key App.jsx's own theme effect uses, so this never needs to
// wait for that effect to run) makes the fade-out genuinely invisible —
// nothing changes at removal, it just stops being on top.
const BG_BY_THEME = { dark: '#0b0c10', light: '#f7fafc' };
function getBootBg() {
  try {
    return BG_BY_THEME[localStorage.getItem('watch_theme')] || BG_BY_THEME.dark;
  } catch {
    return BG_BY_THEME.dark;
  }
}

export default function AnimatedSplash() {
  const [mounted, setMounted] = useState(isCapacitorApp());
  const [fadingOut, setFadingOut] = useState(false);
  const [bootBg] = useState(getBootBg);

  useEffect(() => {
    if (!isCapacitorApp()) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false);
      return;
    }
    const fadeTimer = setTimeout(() => setFadingOut(true), HOLD_UNTIL_MS);
    const removeTimer = setTimeout(() => setMounted(false), REMOVE_AT_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: bootBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.45s ease',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes sahaplay-splash-logo-in {
          0%   { opacity: 0; transform: scale(0.55) rotate(-14deg); }
          65%  { opacity: 1; transform: scale(1.08) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
      <img
        src="/logos/trans_appstore.png"
        alt=""
        width={120}
        height={120}
        style={{
          animation: 'sahaplay-splash-logo-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          filter: 'drop-shadow(0 8px 24px rgba(99,102,241,0.25))',
        }}
      />
    </div>
  );
}
