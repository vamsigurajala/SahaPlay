// Simple drawn versions of the Spotify, YouTube Music and YouTube marks, so the cards
// show which service they open. They are redrawn here, not copied from the brands' files.

export function SpotifyLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Spotify">
      <circle cx="24" cy="24" r="22" fill="#1DB954" />
      <path d="M12 17.5c8-2.4 18-1.7 25 2.4" stroke="#0b1d12" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M13.5 24.2c6.6-1.9 14.6-1.3 20.4 2.1" stroke="#0b1d12" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M15 30.4c5.2-1.4 11.1-0.9 15.6 1.7" stroke="#0b1d12" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function YouTubeMusicLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="YouTube Music">
      <circle cx="24" cy="24" r="22" fill="#FF0000" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="#ffffff" strokeWidth="2.6" />
      <path d="M20 17.5v13l11-6.5z" fill="#ffffff" />
    </svg>
  );
}

export function YouTubeLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="YouTube">
      <rect x="2" y="9" width="44" height="30" rx="9" fill="#FF0000" />
      <path d="M20 16.5v15l13-7.5z" fill="#ffffff" />
    </svg>
  );
}
