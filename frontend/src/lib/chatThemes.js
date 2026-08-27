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
  // encodeURIComponent deliberately leaves '(' and ')' unescaped (they're in
  // its unreserved set) — but every scene below references its own <filter>
  // via a literal url(#...), so without escaping those two characters here,
  // embedding this data URI as an unquoted CSS background-image: url(...)
  // gets its OWN url() terminated early at that inner ')', silently
  // truncating the image to nothing rendering at all. Quoting the outer
  // url() at each call site is a second layer of defense, but this is the
  // actual fix — the data URI must be fully percent-encoded on its own.
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
}

// Builds one landscape scene: a vertical sky gradient, optional stars/dots
// scattered in the upper sky, an optional sun/moon disc (with a soft glow
// halo), optional soft atmospheric bands (aurora ribbons), and one or more
// horizon-silhouette layers drawn back-to-front as flat-color polygons
// (mountains, dunes, hills, or a stack of waves depending on the points
// given) — the same handful of primitives composed differently is enough
// to make six visually distinct, genuinely scene-like wallpapers.
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

export const CHAT_WALLPAPERS = [
  {
    id: 'wp-aurora', name: 'Aurora',
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
    id: 'wp-sunset-blaze', name: 'Sunset Blaze',
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
    id: 'wp-deep-ocean', name: 'Deep Ocean',
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
    id: 'wp-lavender-dusk', name: 'Lavender Dusk',
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
    id: 'wp-golden-hour', name: 'Golden Hour',
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
    id: 'wp-rose-quartz', name: 'Rose Quartz',
    image: sceneWallpaper({
      skyTop: '#4a1030', skyBottom: '#fb7185',
      dots: [{ cx: 70, cy: 60, r: 3, color: '#fecdd3', o: 0.7 }, { cx: 320, cy: 45, r: 2.4, color: '#fecdd3', o: 0.6 }, { cx: 260, cy: 90, r: 2, color: '#ffe4e6', o: 0.55 }, { cx: 130, cy: 100, r: 2.6, color: '#fecdd3', o: 0.6 }],
      layers: [
        { color: '#9d174d', points: '0,300 90,270 190,295 280,260 400,285 400,400 0,400' },
        { color: '#701a3f', points: '0,340 120,318 250,336 400,312 400,400 0,400' },
      ],
    }),
  },
  {
    id: 'wp-cozy-cafe', name: 'Cozy Café',
    image: '/wallpapers/cozy-cafe.jpg',
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
