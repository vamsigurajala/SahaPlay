// ── Chat bubble "Customize" themes (Instagram-style) ──────────────────────────
// Shared between GlobalChatWidget.jsx and RoomChatPanel.jsx — two independent
// private/group chat UIs in this codebase that both need the exact same
// theme list so a theme picked in one reads identically in the other.
//
// 'default' is intentionally each surface's existing sent-bubble gradient,
// unchanged — picking "Default" (or never opening the picker at all) must
// look exactly like it always has. Every other entry replaces that gradient,
// and forces the chat background to the app's own light/dark appearance
// (not a hardcoded color) so the gradient reads clearly, matching
// Instagram's own per-conversation theme behavior.
export const CHAT_THEMES = [
  { id: 'default', name: 'Default', gradient: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))' },
  { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(180deg,#1d4ed8 0%,#2563eb 100%)' },
  { id: 'berry', name: 'Berry', gradient: 'linear-gradient(180deg,#1e3a8a 0%,#7c3aed 55%,#ef4444 100%)' },
  { id: 'candy', name: 'Candy', gradient: 'linear-gradient(180deg,#22d3ee 0%,#f9a8d4 50%,#93c5fd 100%)' },
  { id: 'unicorn', name: 'Unicorn', gradient: 'linear-gradient(180deg,#7c3aed 0%,#d946ef 100%)' },
  { id: 'maple', name: 'Maple', gradient: 'linear-gradient(180deg,#7f1d1d 0%,#b45309 100%)' },
  { id: 'sushi', name: 'Sushi', gradient: 'linear-gradient(180deg,#f87171 0%,#fbbf24 100%)' },
  { id: 'rocket', name: 'Rocket', gradient: 'linear-gradient(180deg,#ef4444 0%,#ec4899 50%,#f59e0b 100%)' },
  { id: 'lollipop', name: 'Lollipop', gradient: 'linear-gradient(180deg,#f472b6 0%,#a78bfa 100%)' },
  { id: 'shadow', name: 'Shadow', gradient: 'linear-gradient(180deg,#4c1d95 0%,#312e81 100%)' },
  { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(180deg,#db2777 0%,#fb923c 100%)' },
  { id: 'mint', name: 'Mint', gradient: 'linear-gradient(180deg,#0891b2 0%,#34d399 100%)' },
];

// Roughly the average rendered height (px) of one message bubble, used to
// approximate each bubble's position along ONE continuous gradient spanning
// the whole conversation (background-position/-size on each sent bubble) —
// an index-based estimate rather than measuring real DOM heights, since the
// point is "later messages read as a visibly different shade than earlier
// ones", not pixel-perfect continuity across bubbles of varying height.
export const CHAT_THEME_BUBBLE_STRIDE = 70;

// Every gradient above is ordered so its 0% stop is the DARKEST color and its
// 100% stop is the LIGHTEST — the rendering code (GlobalChatWidget.jsx /
// RoomChatPanel.jsx) maps the oldest sent bubble (index 0) to 0% and the
// newest to 100%, so this ordering is what makes older messages (scrolled up,
// out of view) read dark and the most recent message (closest to the
// composer) read light. Keep this invariant when editing/adding a theme —
// don't just reorder for looks, reorder by actual luminance.

// ── Chat "Backgrounds" (Instagram/WhatsApp-style wallpaper themes) ────────────
// Distinct from CHAT_THEMES above: a background covers the WHOLE chat, not
// just the sent bubble, and the sent-bubble color is DERIVED from the image
// (see getWallpaperDominantColor below) rather than hand-picked — the same
// mechanism a future "upload your own photo" theme would reuse, so it's built
// as a real image-analysis step now rather than a hardcoded color per design.
//
// Every image here is a self-contained inline SVG data URI — an actual
// illustrated scene (sky gradient + horizon silhouette + sun/moon/stars),
// not a bundled photo/raster asset: zero network requests, tiny bundle
// size, and no external image licensing to track. A real photo would need
// either fetching a URL nobody supplied (not something to guess at) or an
// image-generation tool this environment doesn't have, so this is the best
// "looks like a picture, not a color swatch" option actually available —
// deliberately built as a recognizable landscape (mountains/waves/dunes
// against a gradient sky) rather than the earlier soft blurred color blobs,
// which read as an abstract gradient rather than a picture of anything.
// ids are prefixed 'wp-' so they can share the same chatThemes[chatKey]
// storage slot as CHAT_THEMES ids above without colliding — the rendering
// code just checks which list an id resolves in.
function encodeSvg(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
}

function sceneWallpaper({ skyTop, skyBottom, dots, sun, bands, layers }) {
  const W = 400, H = 400;
  let defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="100%" stop-color="${skyBottom}"/></linearGradient>`;
  defs += `<filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="18"/></filter>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  if (dots) {
    body += dots.map(d => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.color || '#ffffff'}" opacity="${d.o ?? 0.85}"/>`).join('');
  }
  if (bands) {
    body += `<g filter="url(#soft)" opacity="0.55">` + bands.map(b => `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}" fill="${b.color}" transform="rotate(${b.rot || 0} ${b.cx} ${b.cy})"/>`).join('') + `</g>`;
  }
  if (sun) {
    body += `<circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r * 2}" fill="${sun.color}" opacity="0.22"/>`;
    body += `<circle cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}" fill="${sun.color}"/>`;
    if (sun.crescent) body += `<circle cx="${sun.cx + sun.r * 0.42}" cy="${sun.cy - sun.r * 0.28}" r="${sun.r * 0.92}" fill="${skyTop}"/>`;
  }
  layers.forEach(l => { body += `<polygon points="${l.points}" fill="${l.color}"/>`; });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
  return encodeSvg(svg);
}

function holdingHandsUnderTableScene() {
  const W = 400, H = 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="cafeBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1c0d06"/>
        <stop offset="50%" stop-color="#3b1a0e"/>
        <stop offset="100%" stop-color="#5a2916"/>
      </linearGradient>
      <radialGradient id="pendantGlow1" cx="0.25" cy="0.2" r="0.4">
        <stop offset="0%" stop-color="#fef08a" stop-opacity="0.85"/>
        <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#1c0d06" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="pendantGlow2" cx="0.75" cy="0.2" r="0.4">
        <stop offset="0%" stop-color="#fef08a" stop-opacity="0.85"/>
        <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#1c0d06" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#cafeBg)"/>
    <circle cx="100" cy="80" r="140" fill="url(#pendantGlow1)"/>
    <circle cx="300" cy="80" r="140" fill="url(#pendantGlow2)"/>
    <rect x="50" y="30" width="300" height="210" rx="14" fill="#0f172a" stroke="#f59e0b" stroke-opacity="0.25" stroke-width="4"/>
    <line x1="200" y1="30" x2="200" y2="240" stroke="#f59e0b" stroke-opacity="0.2" stroke-width="3"/>
    <circle cx="90" cy="85" r="3" fill="#e0f2fe" opacity="0.8"/>
    <circle cx="140" cy="130" r="2.5" fill="#e0f2fe" opacity="0.75"/>
    <circle cx="270" cy="75" r="3.2" fill="#e0f2fe" opacity="0.85"/>
    <line x1="90" y1="85" x2="90" y2="115" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
    <line x1="270" y1="75" x2="270" y2="110" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <path d="M 70 240 L 90 240 L 86 215 L 74 215 Z" fill="#78350f"/>
    <circle cx="80" cy="205" r="14" fill="#22c55e" opacity="0.9"/>
    <circle cx="72" cy="198" r="10" fill="#16a34a" opacity="0.9"/>
    <circle cx="88" cy="200" r="11" fill="#4ade80" opacity="0.95"/>
    <rect x="0" y="280" width="400" height="120" fill="#2b1307"/>
    <rect x="0" y="280" width="400" height="16" fill="#451e0a"/>
    <rect x="130" y="260" width="26" height="24" rx="4" fill="#fef08a"/>
    <path d="M 156 265 Q 166 272 156 280" fill="none" stroke="#fef08a" stroke-width="2.5"/>
    <path d="M 143 252 Q 137 238 147 228" fill="none" stroke="#fff" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <rect x="244" y="260" width="26" height="24" rx="4" fill="#fb923c"/>
    <path d="M 244 265 Q 234 272 244 280" fill="none" stroke="#fb923c" stroke-width="2.5"/>
    <path d="M 257 252 Q 251 238 261 228" fill="none" stroke="#fff" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
    <path d="M 140 310 C 140 330 170 340 185 340 L 215 340 C 230 340 260 330 260 310" fill="none" stroke="#d97706" stroke-width="28" stroke-linecap="round" opacity="0.95"/>
    <rect x="175" y="325" width="50" height="30" rx="8" fill="#fbbf24"/>
    <path d="M 185 320 Q 200 310 215 320" fill="none" stroke="#78350f" stroke-width="3"/>
  </svg>`;
  return encodeSvg(svg);
}

function animeRainyBlanketScene() {
  const W = 400, H = 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="animeBg1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0a1a"/>
        <stop offset="55%" stop-color="#1c1233"/>
        <stop offset="100%" stop-color="#3b1d36"/>
      </linearGradient>
      <radialGradient id="animeGlow1" cx="0.75" cy="0.6" r="0.45">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.85"/>
        <stop offset="50%" stop-color="#d97706" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#1c1233" stop-opacity="0"/>
      </radialGradient>
      <filter id="animeBlur1"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#animeBg1)"/>
    <circle cx="300" cy="240" r="170" fill="url(#animeGlow1)"/>
    <circle cx="70" cy="110" r="25" fill="#fbbf24" opacity="0.3" filter="url(#animeBlur1)"/>
    <circle cx="150" cy="80" r="32" fill="#ec4899" opacity="0.25" filter="url(#animeBlur1)"/>
    <circle cx="260" cy="95" r="20" fill="#38bdf8" opacity="0.3" filter="url(#animeBlur1)"/>
    <circle cx="210" cy="170" r="16" fill="#fbbf24" opacity="0.35" filter="url(#animeBlur1)"/>
    <rect x="25" y="25" width="350" height="350" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="5"/>
    <line x1="200" y1="25" x2="200" y2="375" stroke="#ffffff" stroke-opacity="0.14" stroke-width="4"/>
    <line x1="25" y1="185" x2="375" y2="185" stroke="#ffffff" stroke-opacity="0.14" stroke-width="4"/>
    <circle cx="75" cy="90" r="3.5" fill="#e0f2fe" opacity="0.8"/>
    <circle cx="130" cy="145" r="2.8" fill="#e0f2fe" opacity="0.75"/>
    <circle cx="245" cy="75" r="3.2" fill="#e0f2fe" opacity="0.85"/>
    <circle cx="315" cy="155" r="4.2" fill="#e0f2fe" opacity="0.75"/>
    <line x1="75" y1="90" x2="75" y2="120" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
    <line x1="245" y1="75" x2="245" y2="110" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <path d="M 90 375 Q 90 280 150 270 Q 200 265 250 285 Q 290 300 290 375 Z" fill="#170c24"/>
    <path d="M 120 375 Q 140 310 185 300 Q 230 295 270 330 Q 285 345 285 375 Z" fill="#f59e0b" opacity="0.85"/>
    <rect x="150" y="340" width="22" height="24" rx="4" fill="#fbbf24"/>
    <rect x="180" y="343" width="20" height="21" rx="4" fill="#f59e0b"/>
    <path d="M 161 332 Q 155 315 168 305" fill="none" stroke="#fff" stroke-width="2" opacity="0.5" stroke-linecap="round"/>
    <path d="M 190 336 Q 184 322 196 312" fill="none" stroke="#fff" stroke-width="2" opacity="0.45" stroke-linecap="round"/>
  </svg>`;
  return encodeSvg(svg);
}

function animeRainyEmbraceScene() {
  const W = 400, H = 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="animeBg2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#120826"/>
        <stop offset="50%" stop-color="#2a0e3b"/>
        <stop offset="100%" stop-color="#4a154b"/>
      </linearGradient>
      <radialGradient id="animeGlow2" cx="0.5" cy="0.45" r="0.5">
        <stop offset="0%" stop-color="#f472b6" stop-opacity="0.7"/>
        <stop offset="60%" stop-color="#ec4899" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#120826" stop-opacity="0"/>
      </radialGradient>
      <filter id="animeBlur2"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#animeBg2)"/>
    <circle cx="200" cy="180" r="170" fill="url(#animeGlow2)"/>
    <circle cx="85" cy="115" r="30" fill="#f472b6" opacity="0.3" filter="url(#animeBlur2)"/>
    <circle cx="175" cy="75" r="42" fill="#fbbf24" opacity="0.25" filter="url(#animeBlur2)"/>
    <circle cx="305" cy="125" r="34" fill="#a78bfa" opacity="0.3" filter="url(#animeBlur2)"/>
    <circle cx="235" cy="195" r="26" fill="#f472b6" opacity="0.35" filter="url(#animeBlur2)"/>
    <circle cx="65" cy="45" r="2" fill="#fff" opacity="0.8"/>
    <circle cx="145" cy="105" r="2.5" fill="#fff" opacity="0.9"/>
    <circle cx="255" cy="55" r="3" fill="#fff" opacity="0.85"/>
    <circle cx="335" cy="85" r="2" fill="#fff" opacity="0.75"/>
    <path d="M 110 375 C 110 300 160 270 200 270 C 240 270 290 300 290 375 Z" fill="#1b082e"/>
    <path d="M 140 375 C 140 320 175 295 200 295 C 225 295 260 320 260 375 Z" fill="#ec4899" opacity="0.8"/>
    <rect x="182" y="325" width="36" height="40" rx="8" fill="#f472b6"/>
    <path d="M 200 315 C 192 300 208 290 200 275" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.6" stroke-linecap="round"/>
  </svg>`;
  return encodeSvg(svg);
}

function animeMorningKitchenScene() {
  const W = 400, H = 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="animeBg3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3e1e07"/>
        <stop offset="50%" stop-color="#713f12"/>
        <stop offset="100%" stop-color="#a16207"/>
      </linearGradient>
      <linearGradient id="animeSunbeam3" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fde047" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="#fde047" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#animeBg3)"/>
    <polygon points="0,0 200,0 380,400 0,400" fill="url(#animeSunbeam3)"/>
    <polygon points="90,0 280,0 400,300 160,400" fill="url(#animeSunbeam3)" opacity="0.65"/>
    <rect x="35" y="30" width="330" height="210" rx="12" fill="none" stroke="#fde047" stroke-opacity="0.35" stroke-width="4"/>
    <line x1="200" y1="30" x2="200" y2="240" stroke="#fde047" stroke-opacity="0.35" stroke-width="3"/>
    <line x1="35" y1="135" x2="365" y2="135" stroke="#fde047" stroke-opacity="0.35" stroke-width="3"/>
    <path d="M 55 240 L 75 240 L 71 215 L 59 215 Z" fill="#78350f"/>
    <circle cx="65" cy="205" r="14" fill="#22c55e" opacity="0.9"/>
    <circle cx="57" cy="198" r="10" fill="#16a34a" opacity="0.9"/>
    <circle cx="73" cy="200" r="11" fill="#4ade80" opacity="0.95"/>
    <rect x="0" y="300" width="400" height="100" fill="#241003"/>
    <path d="M 250 300 L 280 300 L 275 250 L 255 250 Z" fill="#fde047" opacity="0.95"/>
    <path d="M 275 260 L 295 260 L 295 285 L 278 285" fill="none" stroke="#fde047" stroke-width="3" opacity="0.9"/>
    <rect x="190" y="275" width="24" height="25" rx="4" fill="#eab308"/>
    <path d="M 214 280 Q 224 287 214 295" fill="none" stroke="#eab308" stroke-width="2.5"/>
    <path d="M 202 270 Q 196 255 206 245" fill="none" stroke="#fff" stroke-width="2" opacity="0.65" stroke-linecap="round"/>
  </svg>`;
  return encodeSvg(svg);
}

function northernLightsScene() {
  return sceneWallpaper({
    skyTop: '#020b14', skyBottom: '#0c2e3a',
    dots: [{ cx: 60, cy: 30, r: 1.2 }, { cx: 200, cy: 45, r: 1.5 }, { cx: 330, cy: 25, r: 1 }],
    bands: [
      { cx: 140, cy: 110, rx: 160, ry: 35, color: '#34d399', rot: -15 },
      { cx: 270, cy: 95, rx: 140, ry: 30, color: '#22d3ee', rot: 10 },
    ],
    layers: [
      { color: '#09252c', points: '0,300 80,250 160,285 240,240 320,275 400,245 400,400 0,400' },
      { color: '#04161a', points: '0,350 100,315 220,340 340,305 400,330 400,400 0,400' }
    ]
  });
}

function sakuraTwilightScene() {
  return sceneWallpaper({
    skyTop: '#2d0a29', skyBottom: '#f472b6',
    dots: [{ cx: 80, cy: 40, r: 1.5 }, { cx: 310, cy: 60, r: 1.2 }],
    sun: { cx: 200, cy: 170, r: 35, color: '#fef08a' },
    layers: [
      { color: '#701a3f', points: '0,270 70,220 150,250 240,205 320,240 400,210 400,400 0,400' },
      { color: '#4a0e27', points: '0,330 110,290 220,315 330,280 400,305 400,400 0,400' }
    ]
  });
}

function autumnCabinScene() {
  return sceneWallpaper({
    skyTop: '#451a03', skyBottom: '#d97706',
    dots: [{ cx: 100, cy: 40, r: 1.3 }, { cx: 280, cy: 50, r: 1.1 }],
    sun: { cx: 200, cy: 160, r: 38, color: '#fef08a' },
    layers: [
      { color: '#78350f', points: '0,280 80,230 160,260 250,215 340,250 400,220 400,400 0,400' },
      { color: '#451a03', points: '0,340 100,300 210,325 320,290 400,315 400,400 0,400' }
    ]
  });
}

export const CHAT_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'plain', name: 'Plain' },
  { id: 'scenaries', name: 'Scenaries' },
  { id: 'cartoon-couple', name: 'Cartoon Couple' },
  { id: 'anime-couple', name: 'Anime Couple' },
];

export const CHAT_WALLPAPERS = [
  // ── Plain (6 Abstract SVG Themes) ──────────────────────────────
  {
    id: 'wp-aurora', name: 'Aurora', category: 'plain',
    brightColor: '#22d3ee', darkColor: '#032426', lightColor: '#34d399',
    image: sceneWallpaper({
      skyTop: '#03110e', skyBottom: '#0a2b26',
      dots: [{ cx: 50, cy: 35, r: 1.3 }, { cx: 340, cy: 25, r: 1.1 }, { cx: 200, cy: 50, r: 1.5 }, { cx: 110, cy: 75, r: 1 }, { cx: 300, cy: 85, r: 1.2 }, { cx: 250, cy: 40, r: 1 }],
      bands: [
        { cx: 130, cy: 120, rx: 170, ry: 40, color: '#22d3ee', rot: -18 },
        { cx: 260, cy: 90, rx: 150, ry: 34, color: '#34d399', rot: 12 },
        { cx: 200, cy: 150, rx: 190, ry: 30, color: '#a78bfa', rot: -8 },
      ],
      layers: [
        { color: '#0d3b34', points: '0,300 60,250 140,285 220,235 300,275 400,240 400,400 0,400' },
        { color: '#082420', points: '0,345 100,310 200,335 320,300 400,325 400,400 0,400' },
      ],
    }),
  },
  {
    id: 'wp-sunset-blaze', name: 'Sunset Blaze', category: 'plain',
    brightColor: '#f97316', darkColor: '#4c1d5b', lightColor: '#fde68a',
    image: sceneWallpaper({
      skyTop: '#2a0a3d', skyBottom: '#f97316',
      sun: { cx: 200, cy: 250, r: 55, color: '#fde68a' },
      layers: [
        { color: '#4c1d5b', points: '0,260 70,210 150,245 230,190 310,235 400,200 400,400 0,400' },
        { color: '#2d0f3a', points: '0,300 110,270 220,290 330,255 400,280 400,400 0,400' },
      ],
    }),
  },
  {
    id: 'wp-deep-ocean', name: 'Deep Ocean', category: 'plain',
    brightColor: '#38bdf8', darkColor: '#062038', lightColor: '#60a5fa',
    image: sceneWallpaper({
      skyTop: '#020a17', skyBottom: '#0a3a5c',
      dots: [{ cx: 90, cy: 40, r: 1.2 }, { cx: 320, cy: 55, r: 1 }, { cx: 250, cy: 30, r: 1.4 }],
      sun: { cx: 320, cy: 90, r: 34, color: '#e0f2fe' },
      layers: [
        { color: '#0e4a72', points: '0,230 40,215 90,232 140,212 190,230 240,210 290,228 340,208 400,225 400,400 0,400' },
        { color: '#0b3556', points: '0,280 60,262 130,282 210,258 290,280 360,260 400,275 400,400 0,400' },
        { color: '#082542', points: '0,335 100,318 220,338 320,315 400,330 400,400 0,400' },
      ],
    }),
  },
  {
    id: 'wp-lavender-dusk', name: 'Lavender Dusk', category: 'plain',
    brightColor: '#c084fc', darkColor: '#3b0764', lightColor: '#e9d5ff',
    image: sceneWallpaper({
      skyTop: '#160a2e', skyBottom: '#5b2a8c',
      dots: [{ cx: 60, cy: 50, r: 1.4 }, { cx: 330, cy: 40, r: 1.2 }, { cx: 150, cy: 30, r: 1 }, { cx: 260, cy: 70, r: 1.3 }, { cx: 100, cy: 90, r: 1 }],
      sun: { cx: 310, cy: 80, r: 30, color: '#f5f3ff', crescent: true },
      layers: [
        { color: '#3b0764', points: '0,290 80,255 170,280 260,240 340,270 400,245 400,400 0,400' },
        { color: '#25043f', points: '0,330 120,305 240,325 360,300 400,315 400,400 0,400' },
      ],
    }),
  },
  {
    id: 'wp-golden-hour', name: 'Golden Hour', category: 'plain',
    brightColor: '#fbbf24', darkColor: '#78350f', lightColor: '#fde047',
    image: sceneWallpaper({
      skyTop: '#7c2d12', skyBottom: '#fbbf24',
      sun: { cx: 200, cy: 240, r: 60, color: '#fff7d6' },
      layers: [
        { color: '#c2670f', points: '0,290 50,275 120,292 190,270 260,290 330,272 400,288 400,400 0,400' },
        { color: '#78350f', points: '0,335 90,318 200,338 310,315 400,332 400,400 0,400' },
      ],
    }),
  },
  {
    id: 'wp-rose-quartz', name: 'Rose Quartz', category: 'plain',
    brightColor: '#fb7185', darkColor: '#701a3f', lightColor: '#fecdd3',
    image: sceneWallpaper({
      skyTop: '#4a1030', skyBottom: '#fb7185',
      dots: [{ cx: 70, cy: 60, r: 3, color: '#fecdd3', o: 0.7 }, { cx: 320, cy: 45, r: 2.4, color: '#fecdd3', o: 0.6 }, { cx: 260, cy: 90, r: 2, color: '#ffe4e6', o: 0.55 }, { cx: 130, cy: 100, r: 2.6, color: '#fecdd3', o: 0.6 }],
      layers: [
        { color: '#9d174d', points: '0,300 90,270 190,295 280,260 400,285 400,400 0,400' },
        { color: '#701a3f', points: '0,340 120,318 250,336 400,312 400,400 0,400' },
      ],
    }),
  },

  // ── Scenaries (13 Landscape & Scenery Themes) ───────────────────
  {
    id: 'wp-cozy-cafe', name: 'Cozy Café', category: 'scenaries',
    brightColor: '#d97706', darkColor: '#451a03', lightColor: '#f59e0b',
    image: '/wallpapers/cozy-cafe.jpg',
  },
  {
    id: 'wp-cyberpunk-city', name: 'Cyberpunk City', category: 'scenaries',
    brightColor: '#ec4899', darkColor: '#4c1d95', lightColor: '#f472b6',
    image: '/wallpapers/cyberpunk-city.jpg',
  },
  {
    id: 'wp-rooftop-moonlight', name: 'Rooftop Moonlight', category: 'scenaries',
    brightColor: '#818cf8', darkColor: '#1e1b4b', lightColor: '#a5b4fc',
    image: '/wallpapers/rooftop-moonlight.jpg',
  },
  {
    id: 'wp-enchanted-forest', name: 'Enchanted Forest', category: 'scenaries',
    brightColor: '#2dd4bf', darkColor: '#134e4a', lightColor: '#5eead4',
    image: '/wallpapers/enchanted-forest.jpg',
  },
  {
    id: 'wp-northern-lights', name: 'Northern Lights', category: 'scenaries',
    brightColor: '#34d399', darkColor: '#064e3b', lightColor: '#6ee7b7',
    image: northernLightsScene(),
  },
  {
    id: 'wp-sakura-twilight', name: 'Sakura Twilight', category: 'scenaries',
    brightColor: '#f472b6', darkColor: '#831843', lightColor: '#fbcfe8',
    image: sakuraTwilightScene(),
  },
  {
    id: 'wp-tropical-sunset', name: 'Tropical Sunset', category: 'scenaries',
    brightColor: '#f97316', darkColor: '#7c2d12', lightColor: '#fb923c',
    image: '/wallpapers/tropical-waterfall.jpg',
  },
  {
    id: 'wp-midnight-library', name: 'Midnight Library', category: 'scenaries',
    brightColor: '#b45309', darkColor: '#451a03', lightColor: '#f59e0b',
    image: '/wallpapers/zen-interior.jpg',
  },
  {
    id: 'wp-autumn-cabin', name: 'Autumn Cabin', category: 'scenaries',
    brightColor: '#ea580c', darkColor: '#7c2d12', lightColor: '#fb923c',
    image: autumnCabinScene(),
  },
  {
    id: 'wp-starry-valley', name: 'Starry Valley', category: 'scenaries',
    brightColor: '#6366f1', darkColor: '#1e1b4b', lightColor: '#818cf8',
    image: '/wallpapers/deep-space.jpg',
  },
  {
    id: 'wp-neo-tokyo-rain', name: 'Neo Tokyo Rain', category: 'scenaries',
    brightColor: '#06b6d4', darkColor: '#164e63', lightColor: '#22d3ee',
    image: '/wallpapers/rainy-window.jpg',
  },
  {
    id: 'wp-floating-islands', name: 'Floating Islands', category: 'scenaries',
    brightColor: '#3b82f6', darkColor: '#1e3a8a', lightColor: '#60a5fa',
    image: '/wallpapers/sky-islands.jpg',
  },
  {
    id: 'wp-lavender-night', name: 'Lavender Night', category: 'scenaries',
    brightColor: '#a855f7', darkColor: '#581c87', lightColor: '#c084fc',
    image: '/wallpapers/secret-garden.jpg',
  },

  // ── Cartoon Couple (9 Cartoon Themes) ───────────────────────────
  {
    id: 'wp-falling-asleep-shoulder', name: 'Train Sleep', category: 'cartoon-couple',
    brightColor: '#38bdf8', darkColor: '#0e7490', lightColor: '#60a5fa',
    image: '/wallpapers/falling-asleep-shoulder.jpg',
  },
  {
    id: 'wp-comfort-after-hard-day', name: 'Bedroom Comfort', category: 'cartoon-couple',
    brightColor: '#d97706', darkColor: '#78350f', lightColor: '#f59e0b',
    image: '/wallpapers/comfort-after-hard-day.jpg',
  },
  {
    id: 'wp-sunset-bicycle-ride', name: 'Sunset Bicycle Ride', category: 'cartoon-couple',
    brightColor: '#f97316', darkColor: '#7c2d12', lightColor: '#fb923c',
    image: '/wallpapers/sunset-bicycle-ride.jpg',
  },
  {
    id: 'wp-blanket-on-rooftop', name: 'Rooftop Stargazing', category: 'cartoon-couple',
    brightColor: '#818cf8', darkColor: '#1e1b4b', lightColor: '#a5b4fc',
    image: '/wallpapers/blanket-on-rooftop.jpg',
  },
  {
    id: 'wp-walking-home-together', name: 'Walking Home', category: 'cartoon-couple',
    brightColor: '#06b6d4', darkColor: '#164e63', lightColor: '#22d3ee',
    image: '/wallpapers/walking-home-together.jpg',
  },
  {
    id: 'wp-rainy-window-quiet-love', name: 'Rainy Window Love', category: 'cartoon-couple',
    brightColor: '#f59e0b', darkColor: '#78350f', lightColor: '#fbbf24',
    image: '/wallpapers/rainy-window-quiet-love.jpg',
  },
  {
    id: 'wp-umbrella-together', name: 'Umbrella Walk', category: 'cartoon-couple',
    brightColor: '#f97316', darkColor: '#7c2d12', lightColor: '#fb923c',
    image: '/wallpapers/umbrella-together.jpg',
  },
  {
    id: 'wp-waiting-with-flowers', name: 'Station Reunion', category: 'cartoon-couple',
    brightColor: '#eab308', darkColor: '#713f12', lightColor: '#fde047',
    image: '/wallpapers/waiting-with-flowers.jpg',
  },
  {
    id: 'wp-small-act-of-care', name: 'Tying Scarf Morning', category: 'cartoon-couple',
    brightColor: '#10b981', darkColor: '#064e3b', lightColor: '#34d399',
    image: '/wallpapers/small-act-of-care.jpg',
  },

  // ── Anime Couple (10 High Quality Anime Themes) ──────────────────
  {
    id: 'wp-rainy-window-anime', name: 'Rainy Window', category: 'anime-couple',
    brightColor: '#f59e0b', darkColor: '#78350f', lightColor: '#fbbf24',
    image: '/wallpapers/rainy-window-anime.jpg',
  },
  {
    id: 'wp-umbrella-together-anime', name: 'Umbrella Together', category: 'anime-couple',
    brightColor: '#f97316', darkColor: '#7c2d12', lightColor: '#fb923c',
    image: '/wallpapers/umbrella-together-anime.jpg',
  },
  {
    id: 'wp-falling-asleep-anime', name: 'Falling Asleep', category: 'anime-couple',
    brightColor: '#38bdf8', darkColor: '#0e7490', lightColor: '#60a5fa',
    image: '/wallpapers/falling-asleep-shoulder-anime.jpg',
  },
  {
    id: 'wp-waiting-flowers-anime', name: 'Waiting With Flowers', category: 'anime-couple',
    brightColor: '#eab308', darkColor: '#713f12', lightColor: '#fde047',
    image: '/wallpapers/waiting-with-flowers-anime.jpg',
  },
  {
    id: 'wp-comfort-hard-day-anime', name: 'Comfort After Hard Day', category: 'anime-couple',
    brightColor: '#d97706', darkColor: '#78350f', lightColor: '#f59e0b',
    image: '/wallpapers/comfort-after-hard-day-anime.jpg',
  },
  {
    id: 'wp-sunset-bicycle-anime', name: 'Sunset Bicycle Ride', category: 'anime-couple',
    brightColor: '#f97316', darkColor: '#7c2d12', lightColor: '#fb923c',
    image: '/wallpapers/sunset-bicycle-anime.jpg',
  },
  {
    id: 'wp-holding-hands-cafe-anime', name: 'Coffee Table Romance', category: 'anime-couple',
    brightColor: '#d97706', darkColor: '#451a03', lightColor: '#fbbf24',
    image: '/wallpapers/holding-hands-cafe-anime.jpg',
  },
  {
    id: 'wp-walking-home-anime', name: 'Walking Home', category: 'anime-couple',
    brightColor: '#06b6d4', darkColor: '#164e63', lightColor: '#22d3ee',
    image: '/wallpapers/walking-home-anime.jpg',
  },
  {
    id: 'wp-tying-scarf-anime', name: 'Tying Scarf Morning', category: 'anime-couple',
    brightColor: '#10b981', darkColor: '#064e3b', lightColor: '#34d399',
    image: '/wallpapers/tying-scarf-anime.jpg',
  },
  {
    id: 'wp-rooftop-stargazing-anime', name: 'Rooftop Stargazing', category: 'anime-couple',
    brightColor: '#818cf8', darkColor: '#1e1b4b', lightColor: '#a5b4fc',
    image: '/wallpapers/rooftop-stargazing-anime.jpg',
  },
];

export function findWallpaper(id) {
  return CHAT_WALLPAPERS.find(w => w.id === id) || null;
}

// getWallpaperDominantColor returns an 'rgb(r, g, b)' string — this pulls the
// numbers back out to decide whether that color reads as dark or light, so
// bubble text/background choices can follow the actual extracted color
// instead of being hardcoded white everywhere (which breaks the moment a
// wallpaper's dominant tone is itself light/pastel).
export function isRgbColorDark(rgbStr) {
  if (!rgbStr) return true;
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgbStr);
  if (!m) return true;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

// Real "pick the majority color from the image" extraction: downsamples onto
// a tiny canvas, quantizes each pixel's RGB into coarse buckets (32 levels
// per channel) and returns the average color of whichever bucket has the
// most pixels — a majority vote, not just a flat average of every pixel
// (which would muddy two strong, roughly-equal-area colors into a gray
// nobody actually sees in the image). Memoized per wallpaper id since it's
// the same handful of SVGs reused by every chat that picks them.
const dominantColorCache = new Map();

export function getWallpaperDominantColor(wallpaper) {
  if (!wallpaper) return Promise.resolve(null);
  if (dominantColorCache.has(wallpaper.id)) return Promise.resolve(dominantColorCache.get(wallpaper.id));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue; // skip transparent pixels
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const key = `${r >> 5},${g >> 5},${b >> 5}`;
          const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
          entry.count++; entry.r += r; entry.g += g; entry.b += b;
          buckets.set(key, entry);
        }
        let best = null;
        for (const entry of buckets.values()) { if (!best || entry.count > best.count) best = entry; }
        const color = best
          ? `rgb(${Math.round(best.r / best.count)}, ${Math.round(best.g / best.count)}, ${Math.round(best.b / best.count)})`
          : '#6366f1';
        dominantColorCache.set(wallpaper.id, color);
        resolve(color);
      } catch {
        resolve('#6366f1');
      }
    };
    img.onerror = () => resolve('#6366f1');
    img.src = wallpaper.image;
  });
}

export function getWallpaperGradient(wallpaper) {
  if (!wallpaper) return null;
  const dark = wallpaper.darkColor || '#1e3a8a';
  const light = wallpaper.lightColor || '#60a5fa';
  return `linear-gradient(180deg, ${dark} 0%, ${light} 100%)`;
}


