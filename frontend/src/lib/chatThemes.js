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
// Every image here is a self-contained inline SVG data URI (a handful of
// blurred, overlapping color blobs — a common "mesh gradient" wallpaper
// look) rather than a bundled photo/raster asset: zero network requests,
// tiny bundle size, and no external image licensing to track. ids are
// prefixed 'wp-' so they can share the same chatThemes[chatKey] storage slot
// as CHAT_THEMES ids above without colliding — the rendering code just checks
// which list an id resolves in.
function meshWallpaper(base, blobs) {
  const circles = blobs.map(([cx, cy, r, color]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`
    + `<rect width="400" height="400" fill="${base}"/>`
    + `<g filter="url(#b)">${circles}</g>`
    + `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter></defs>`
    + `</svg>`;
  // encodeURIComponent deliberately leaves '(' and ')' unescaped (they're in
  // its unreserved set) — but the SVG itself contains a literal url(#b) (the
  // filter reference above), so without escaping those two characters here,
  // embedding this data URI as an unquoted CSS background-image: url(...)
  // gets its OWN url() terminated early at that inner ')', silently
  // truncating the image to nothing rendering at all. Quoting the outer
  // url() at each call site is a second layer of defense, but this is the
  // actual fix — the data URI must be fully percent-encoded on its own.
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
}

export const CHAT_WALLPAPERS = [
  { id: 'wp-aurora', name: 'Aurora', image: meshWallpaper('#04211d', [[80, 90, 180, '#0d9488'], [320, 120, 160, '#22d3ee'], [220, 320, 200, '#134e4a']]) },
  { id: 'wp-sunset-blaze', name: 'Sunset Blaze', image: meshWallpaper('#1a0b12', [[60, 80, 190, '#f97316'], [330, 100, 170, '#ec4899'], [200, 330, 210, '#7c2d92']]) },
  { id: 'wp-deep-ocean', name: 'Deep Ocean', image: meshWallpaper('#020a17', [[70, 70, 190, '#1d4ed8'], [330, 130, 170, '#0891b2'], [200, 340, 220, '#082f49']]) },
  { id: 'wp-lavender-dusk', name: 'Lavender Dusk', image: meshWallpaper('#0f0a1e', [[80, 90, 180, '#7c3aed'], [320, 110, 170, '#ec4899'], [210, 330, 210, '#3b0764']]) },
  { id: 'wp-golden-hour', name: 'Golden Hour', image: meshWallpaper('#1c1206', [[70, 80, 190, '#f59e0b'], [330, 110, 170, '#fbbf24'], [210, 330, 210, '#78350f']]) },
  { id: 'wp-rose-quartz', name: 'Rose Quartz', image: meshWallpaper('#1c0e16', [[70, 90, 190, '#f472b6'], [330, 110, 170, '#fb7185'], [210, 330, 210, '#701a3f']]) },
];

export function findWallpaper(id) {
  return CHAT_WALLPAPERS.find(w => w.id === id) || null;
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
