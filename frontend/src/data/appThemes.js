// App-wide accent color themes — applied via CSS custom properties on
// documentElement (see App.jsx's accent-theme effect), separate from the
// light/dark axis. "Default" matches the app's original hardcoded
// indigo/purple exactly so existing users see no change unless they pick a
// new theme.
//
// Two categories:
//  - 'duotone' themes carry a 2-color pair (accent1/accent2), same shape as
//    the app always used.
//  - 'tritone' themes add a 3rd color (accent3) so the picker's own preview
//    swatch and any CSS that reads `--brand-gradient` (App.jsx sets it to
//    each theme's own gradient string) render a 3-stop gradient.
//
// The first 6 themes below (through "Crimson Wine") are hand-picked Tailwind-
// scale hex values, kept byte-identical to how they originally shipped. Every
// theme after that is generated from a single hand-picked base hex per accent
// via deriveShades()/deriveBgTint() below, so ~30 themes stay consistent
// without hand-authoring hundreds of individual hex values.

function hexToRgbTuple(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbTupleToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      default: h = ((r - g) / d + 4); break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgbTuple(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

function toRgbString(hex) {
  const [r, g, b] = hexToRgbTuple(hex);
  return `${r}, ${g}, ${b}`;
}

// Shift a base hex's HSL lightness (and optionally scale saturation) to get
// a related shade — used for the light/dark/darker variants of each accent.
function adjust(hex, deltaL, satMul = 1) {
  const [r, g, b] = hexToRgbTuple(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const newL = Math.max(4, Math.min(96, l + deltaL));
  const newS = Math.max(0, Math.min(100, s * satMul));
  const [nr, ng, nb] = hslToRgbTuple(h, newS, newL);
  return rgbTupleToHex(nr, ng, nb);
}

// Sets an absolute target lightness (rather than adjust()'s relative delta) —
// used for the "always dark" CTA-banner tint so wildly different base
// lightnesses (a pastel base vs an already-deep base) land at a consistent
// absolute darkness instead of drifting relative to their own starting point.
function toLightness(hex, targetL, satMul = 1) {
  const [r, g, b] = hexToRgbTuple(hex);
  const [h, s] = rgbToHsl(r, g, b);
  const newS = Math.max(0, Math.min(100, s * satMul));
  const [nr, ng, nb] = hslToRgbTuple(h, newS, targetL);
  return rgbTupleToHex(nr, ng, nb);
}

function deriveShades(baseHex) {
  return {
    accent: baseHex,
    rgb: toRgbString(baseHex),
    light: adjust(baseHex, 14),
    dark: adjust(baseHex, -12),
    darker: adjust(baseHex, -22),
    // Deep, slightly desaturated tint used for the flowing dark-mode body
    // background blobs; pale, mostly-desaturated tint for light mode's.
    bgDark: adjust(baseHex, -100 + 12, 0.55),
    bgLight: adjust(baseHex, 100 - 6, 0.45),
  };
}

function duotone({ id, name, base1, base2 }) {
  const s1 = deriveShades(base1);
  const s2 = deriveShades(base2);
  return {
    id,
    name,
    category: 'duotone',
    accent1: s1.accent,
    accent2: s2.accent,
    accent1Rgb: s1.rgb,
    accent2Rgb: s2.rgb,
    accent1Light: s1.light,
    accent2Light: s2.light,
    accent1Dark: s1.dark,
    accent2Dark: s2.dark,
    accent1Darker: s1.darker,
    accent2Darker: s2.darker,
    bgGradient1: s1.bgDark,
    bgGradient2: s2.bgDark,
    bgGradient1Light: s1.bgLight,
    bgGradient2Light: s2.bgLight,
    // Always-dark tint (not mode-dependent) for "gcw-force-dark" CTA banners
    // that stay a deep navy-ish gradient in both light and dark site mode.
    ctaBg1: toLightness(base1, 18, 0.9),
    ctaBg2: toLightness(base2, 32, 0.85),
    previewCss: `linear-gradient(135deg, ${s1.accent}, ${s2.accent})`,
  };
}

function tritone({ id, name, base1, base2, base3 }) {
  const s1 = deriveShades(base1);
  const s2 = deriveShades(base2);
  const s3 = deriveShades(base3);
  return {
    id,
    name,
    category: 'tritone',
    accent1: s1.accent,
    accent2: s2.accent,
    accent3: s3.accent,
    accent1Rgb: s1.rgb,
    accent2Rgb: s2.rgb,
    accent3Rgb: s3.rgb,
    accent1Light: s1.light,
    accent2Light: s2.light,
    accent3Light: s3.light,
    accent1Dark: s1.dark,
    accent2Dark: s2.dark,
    accent3Dark: s3.dark,
    accent1Darker: s1.darker,
    accent2Darker: s2.darker,
    accent3Darker: s3.darker,
    bgGradient1: s1.bgDark,
    bgGradient2: s3.bgDark,
    bgGradient1Light: s1.bgLight,
    bgGradient2Light: s3.bgLight,
    ctaBg1: toLightness(base1, 18, 0.9),
    ctaBg2: toLightness(base3, 32, 0.85),
    previewCss: `linear-gradient(135deg, ${s1.accent}, ${s2.accent}, ${s3.accent})`,
  };
}

const HAND_PICKED = [
  {
    id: 'default',
    name: 'Default',
    category: 'duotone',
    accent1: '#6366f1',
    accent2: '#a855f7',
    accent1Rgb: '99, 102, 241',
    accent2Rgb: '168, 85, 247',
    accent1Light: '#818cf8',
    accent2Light: '#c084fc',
    accent1Dark: '#4f46e5',
    accent2Dark: '#7c3aed',
    accent1Darker: '#4338ca',
    accent2Darker: '#6d28d9',
    bgGradient1: '#1a0b2e',
    bgGradient2: '#0b1a2e',
    bgGradient1Light: '#ebf4ff',
    bgGradient2Light: '#e2e8f0',
    // Exact original hardcoded values — kept as literals (not derived) so the
    // "gcw-force-dark" CTA banners stay byte-identical for Default.
    ctaBg1: '#1e1b4b',
    ctaBg2: '#312e81',
    previewCss: 'linear-gradient(135deg, #6366f1, #a855f7)',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    category: 'duotone',
    accent1: '#3b82f6',
    accent2: '#06b6d4',
    accent1Rgb: '59, 130, 246',
    accent2Rgb: '6, 182, 212',
    accent1Light: '#60a5fa',
    accent2Light: '#22d3ee',
    accent1Dark: '#2563eb',
    accent2Dark: '#0891b2',
    accent1Darker: '#1d4ed8',
    accent2Darker: '#0e7490',
    bgGradient1: '#0b1a3a',
    bgGradient2: '#062430',
    bgGradient1Light: '#eaf4ff',
    bgGradient2Light: '#e0f7fa',
    ctaBg1: toLightness('#3b82f6', 18, 0.9),
    ctaBg2: toLightness('#06b6d4', 32, 0.85),
    previewCss: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
  },
  {
    id: 'forest-teal',
    name: 'Forest Teal',
    category: 'duotone',
    accent1: '#22c55e',
    accent2: '#14b8a6',
    accent1Rgb: '34, 197, 94',
    accent2Rgb: '20, 184, 166',
    accent1Light: '#4ade80',
    accent2Light: '#2dd4bf',
    accent1Dark: '#16a34a',
    accent2Dark: '#0d9488',
    accent1Darker: '#15803d',
    accent2Darker: '#0f766e',
    bgGradient1: '#0b2a18',
    bgGradient2: '#0b2624',
    bgGradient1Light: '#eafff3',
    bgGradient2Light: '#e0fbf7',
    ctaBg1: toLightness('#22c55e', 18, 0.9),
    ctaBg2: toLightness('#14b8a6', 32, 0.85),
    previewCss: 'linear-gradient(135deg, #22c55e, #14b8a6)',
  },
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    category: 'duotone',
    accent1: '#ec4899',
    accent2: '#f43f5e',
    accent1Rgb: '236, 72, 153',
    accent2Rgb: '244, 63, 94',
    accent1Light: '#f472b6',
    accent2Light: '#fb7185',
    accent1Dark: '#db2777',
    accent2Dark: '#e11d48',
    accent1Darker: '#be185d',
    accent2Darker: '#be123c',
    bgGradient1: '#2a0b1e',
    bgGradient2: '#2a0b11',
    bgGradient1Light: '#fff0f7',
    bgGradient2Light: '#ffeef0',
    ctaBg1: toLightness('#ec4899', 18, 0.9),
    ctaBg2: toLightness('#f43f5e', 32, 0.85),
    previewCss: 'linear-gradient(135deg, #ec4899, #f43f5e)',
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber',
    category: 'duotone',
    accent1: '#f97316',
    accent2: '#f59e0b',
    accent1Rgb: '249, 115, 22',
    accent2Rgb: '245, 158, 11',
    accent1Light: '#fb923c',
    accent2Light: '#fbbf24',
    accent1Dark: '#ea580c',
    accent2Dark: '#d97706',
    accent1Darker: '#c2410c',
    accent2Darker: '#b45309',
    bgGradient1: '#2a190b',
    bgGradient2: '#2a220b',
    bgGradient1Light: '#fff5eb',
    bgGradient2Light: '#fff8e8',
    ctaBg1: toLightness('#f97316', 18, 0.9),
    ctaBg2: toLightness('#f59e0b', 32, 0.85),
    previewCss: 'linear-gradient(135deg, #f97316, #f59e0b)',
  },
  {
    id: 'crimson-wine',
    // Deliberately deeper than the app's existing #ef4444/#ff4b4b danger-red
    // so a chosen brand accent never reads as a destructive-action color.
    name: 'Crimson Wine',
    category: 'duotone',
    accent1: '#dc2626',
    accent2: '#9f1239',
    accent1Rgb: '220, 38, 38',
    accent2Rgb: '159, 18, 57',
    accent1Light: '#f87171',
    accent2Light: '#e11d48',
    accent1Dark: '#b91c1c',
    accent2Dark: '#881337',
    accent1Darker: '#991b1b',
    accent2Darker: '#6b0f26',
    bgGradient1: '#2a0b0b',
    bgGradient2: '#240b16',
    bgGradient1Light: '#fff0f0',
    bgGradient2Light: '#fff0f4',
    ctaBg1: toLightness('#dc2626', 18, 0.9),
    ctaBg2: toLightness('#9f1239', 32, 0.85),
    previewCss: 'linear-gradient(135deg, #dc2626, #9f1239)',
  },
];

const GENERATED_DUOTONE = [
  { id: 'emerald-mint', name: 'Emerald Mint', base1: '#10b981', base2: '#6ee7b7' },
  { id: 'sky-breeze', name: 'Sky Breeze', base1: '#0ea5e9', base2: '#7dd3fc' },
  { id: 'violet-dream', name: 'Violet Dream', base1: '#7c3aed', base2: '#a78bfa' },
  { id: 'magenta-pop', name: 'Magenta Pop', base1: '#d946ef', base2: '#f0abfc' },
  { id: 'coral-blush', name: 'Coral Blush', base1: '#fb7185', base2: '#fda4af' },
  { id: 'golden-hour', name: 'Golden Hour', base1: '#eab308', base2: '#fde047' },
  { id: 'lime-fizz', name: 'Lime Fizz', base1: '#65a30d', base2: '#a3e635' },
  { id: 'slate-steel', name: 'Slate Steel', base1: '#475569', base2: '#94a3b8' },
  { id: 'berry-punch', name: 'Berry Punch', base1: '#be185d', base2: '#f472b6' },
  { id: 'cobalt-deep', name: 'Cobalt Deep', base1: '#1d4ed8', base2: '#3b82f6' },
  { id: 'peach-sorbet', name: 'Peach Sorbet', base1: '#fb923c', base2: '#fdba74' },
  { id: 'jade-stone', name: 'Jade Stone', base1: '#059669', base2: '#34d399' },
  { id: 'plum-wine', name: 'Plum Wine', base1: '#86198f', base2: '#c026d3' },
  { id: 'turquoise-tide', name: 'Turquoise Tide', base1: '#0d9488', base2: '#5eead4' },
].map(duotone);

const GENERATED_TRITONE = [
  { id: 'aurora', name: 'Aurora', base1: '#22d3ee', base2: '#a855f7', base3: '#ec4899' },
  { id: 'tropical-sunset', name: 'Tropical Sunset', base1: '#f97316', base2: '#ec4899', base3: '#8b5cf6' },
  { id: 'galaxy', name: 'Galaxy', base1: '#4338ca', base2: '#7c3aed', base3: '#db2777' },
  { id: 'candy-pop', name: 'Candy Pop', base1: '#f472b6', base2: '#a78bfa', base3: '#60a5fa' },
  { id: 'desert-bloom', name: 'Desert Bloom', base1: '#f59e0b', base2: '#fb7185', base3: '#a855f7' },
  { id: 'ocean-depth', name: 'Ocean Depth', base1: '#0ea5e9', base2: '#2563eb', base3: '#4338ca' },
  { id: 'forest-mist', name: 'Forest Mist', base1: '#22c55e', base2: '#14b8a6', base3: '#0ea5e9' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', base1: '#fda4af', base2: '#f472b6', base3: '#c026d3' },
  { id: 'neon-nights', name: 'Neon Nights', base1: '#22d3ee', base2: '#4f46e5', base3: '#db2777' },
  { id: 'autumn-blaze', name: 'Autumn Blaze', base1: '#eab308', base2: '#f97316', base3: '#dc2626' },
].map(tritone);

export const APP_THEMES = [...HAND_PICKED, ...GENERATED_DUOTONE, ...GENERATED_TRITONE];
