import React, { useState, useEffect } from 'react';

// Shown once per app cold start (mounted at the App root, so it never
// remounts on route navigation — only on a real page load / app launch).
// Purely a visual overlay layered on top of whatever's rendering underneath;
// nothing else waits on it, so it never delays auth checks or data fetches.
// Timeline: logo animates in (~700ms) -> brief hold -> overlay fades out
// (~450ms), unmounting once fully transparent. Total stays under 1.5s so it
// reads as a native-style launch flourish rather than something that makes
// repeat opens feel slow.
const HOLD_UNTIL_MS = 1050; // when the fade-out begins
const REMOVE_AT_MS = 1500;  // when the overlay unmounts entirely

export default function AnimatedSplash() {
  const [mounted, setMounted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
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
        background: '#FFFFFF',
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
