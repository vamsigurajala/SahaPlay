import { useId } from 'react';

// Small shaded SVG drawings for the wardrobe, dressing table and garden viewers.
// Every drawing fits an 80x80 box; `color` is the main colour, `accent` the trim.

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};
const S = 'rgba(0,0,0,0.28)';

function Frame({ color, children }) {
  const id = useId().replace(/:/g, '');
  const light = shade(color, 38);
  const dark = shade(color, -42);
  return (
    <svg viewBox="0 0 80 80" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={light} /><stop offset="0.55" stopColor={color} /><stop offset="1" stopColor={dark} /></linearGradient>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={dark} /><stop offset="0.3" stopColor={light} /><stop offset="0.55" stopColor={color} /><stop offset="1" stopColor={dark} /></linearGradient>
        <radialGradient id={`r${id}`} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor={light} /><stop offset="0.6" stopColor={color} /><stop offset="1" stopColor={dark} /></radialGradient>
      </defs>
      <ellipse cx="40" cy="76" rx="24" ry="3" fill="rgba(0,0,0,0.2)" />
      {children({ f: `url(#s${id})`, v: `url(#v${id})`, r: `url(#r${id})`, light, dark })}
    </svg>
  );
}

// ── clothes and accessories ──────────────────────────────────────────────────
export function ClothArt({ kind, color, accent }) {
  return (
    <Frame color={color}>
      {({ f, v, dark, light }) => {
        switch (kind) {
          case 'shirt': return (<><path d="M24 10 L34 6 Q40 14 46 6 L56 10 L72 24 L64 34 L58 29 L58 70 L22 70 L22 29 L16 34 L8 24 Z" fill={f} stroke={S} /><path d="M34 6 L40 22 L46 6 Q40 14 34 6Z" fill={accent} stroke={S} /><path d="M40 22 V70" stroke={S} /><circle cx="40" cy="32" r="1.3" fill={dark} /><circle cx="40" cy="44" r="1.3" fill={dark} /><circle cx="40" cy="56" r="1.3" fill={dark} /></>);
          case 'tshirt': return (<><path d="M25 10 Q40 20 55 10 L72 24 L64 34 L58 29 L58 70 L22 70 L22 29 L16 34 L8 24 Z" fill={f} stroke={S} /><path d="M25 10 Q40 20 55 10 Q40 14 25 10Z" fill={dark} opacity="0.6" /><rect x="30" y="40" width="20" height="3" rx="1.5" fill={accent} opacity="0.7" /></>);
          case 'jacket': return (<><path d="M24 10 L34 6 L40 20 L46 6 L56 10 L72 24 L68 66 L58 66 L58 70 L22 70 L22 66 L12 66 L8 24 Z" fill={f} stroke={S} /><path d="M40 20 V70" stroke={S} strokeWidth="1.5" /><path d="M34 6 L40 20 L30 26 Z M46 6 L40 20 L50 26 Z" fill={accent} stroke={S} /><rect x="26" y="48" width="9" height="10" rx="1" fill="none" stroke={S} /><rect x="45" y="48" width="9" height="10" rx="1" fill="none" stroke={S} /></>);
          case 'pants': return (<><path d="M22 8 H58 L62 72 H44 L40 30 L36 72 H18 Z" fill={f} stroke={S} /><rect x="22" y="8" width="36" height="7" fill={dark} opacity="0.55" /><path d="M40 15 V30" stroke={S} /><circle cx="40" cy="12" r="1.5" fill={accent} /></>);
          case 'shorts': return (<><path d="M20 20 H60 L64 56 H44 L40 38 L36 56 H16 Z" fill={f} stroke={S} /><rect x="20" y="20" width="40" height="7" fill={dark} opacity="0.55" /><path d="M40 27 V38" stroke={S} /></>);
          case 'kurta': return (<><path d="M26 8 Q40 18 54 8 L72 22 L66 32 L60 27 L62 72 H18 L20 27 L14 32 L8 22 Z" fill={f} stroke={S} /><path d="M40 14 V42" stroke={accent} strokeWidth="2.5" /><path d="M32 12 Q40 24 48 12" fill="none" stroke={accent} strokeWidth="2.5" /><path d="M18 66 H62" stroke={accent} strokeWidth="2" /><circle cx="40" cy="30" r="1.4" fill={accent} /><circle cx="40" cy="40" r="1.4" fill={accent} /></>);
          case 'dress': return (<><path d="M30 6 L36 10 Q40 15 44 10 L50 6 L54 28 L46 34 L72 72 H8 L34 34 L26 28 Z" fill={f} stroke={S} /><path d="M34 34 Q40 38 46 34" stroke={accent} strokeWidth="3" fill="none" /><path d="M12 66 H68" stroke={accent} strokeWidth="2.5" /><path d="M20 56 Q40 62 60 56" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.8" /></>);
          case 'saree': return (<><path d="M10 14 Q40 4 70 14 L72 72 Q40 66 8 72 Z" fill={f} stroke={S} /><path d="M10 14 Q40 4 70 14 L69 24 Q40 14 11 24 Z" fill={accent} opacity="0.9" /><path d="M8 64 Q40 58 72 64 L72 72 Q40 66 8 72 Z" fill={accent} opacity="0.9" /><path d="M14 34 Q40 28 66 34 M13 44 Q40 38 67 44" stroke={light} strokeWidth="1.5" fill="none" opacity="0.7" /><circle cx="26" cy="52" r="2" fill={accent} /><circle cx="40" cy="48" r="2" fill={accent} /><circle cx="54" cy="52" r="2" fill={accent} /></>);
          case 'scarf': return (<><path d="M14 10 Q40 22 66 10 L66 22 Q40 34 14 22 Z" fill={f} stroke={S} /><path d="M26 22 L36 70 L22 70 L18 20 Z M54 22 L62 20 L58 70 L44 70 Z" fill={f} stroke={S} /><path d="M22 62 H34 M46 62 H58" stroke={accent} strokeWidth="3" /></>);
          case 'shoe': return (<><path d="M8 52 Q10 30 24 28 L36 38 Q44 42 56 42 Q72 44 72 58 V64 H8 Z" fill={f} stroke={S} /><rect x="8" y="60" width="64" height="8" rx="3" fill={accent} stroke={S} /><path d="M26 30 L34 36 M30 28 L38 34 M34 27 L42 33" stroke={accent} strokeWidth="1.8" /></>);
          case 'heel': return (<><path d="M10 28 Q12 22 20 24 L26 46 Q44 48 66 54 Q72 56 70 62 L18 62 Q12 50 10 28 Z" fill={f} stroke={S} /><path d="M16 62 L14 74 H20 L24 62 Z" fill={accent} stroke={S} /><path d="M20 24 Q18 36 24 46" stroke={accent} strokeWidth="1.5" fill="none" /></>);
          case 'sandal': return (<><path d="M12 56 Q10 40 22 38 L60 44 Q72 48 70 60 Q60 66 20 64 Z" fill={f} stroke={S} /><path d="M26 40 Q40 24 54 44" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" /><rect x="14" y="62" width="56" height="5" rx="2.5" fill={accent} /></>);
          case 'cap': return (<><path d="M14 46 Q16 16 44 16 Q66 18 66 44 Z" fill={f} stroke={S} /><path d="M10 46 Q40 38 74 52 Q60 58 10 50 Z" fill={dark} stroke={S} /><circle cx="42" cy="16" r="2.5" fill={accent} /><path d="M30 20 Q28 32 30 44 M54 20 Q56 32 54 44" stroke={S} fill="none" /></>);
          case 'belt': return (<><rect x="6" y="32" width="68" height="16" rx="3" fill={f} stroke={S} /><rect x="30" y="28" width="20" height="24" rx="3" fill="none" stroke={accent} strokeWidth="3.5" /><rect x="38" y="36" width="8" height="8" fill={accent} /><circle cx="62" cy="40" r="1.4" fill={dark} /><circle cx="68" cy="40" r="1.4" fill={dark} /></>);
          case 'watch': return (<><rect x="30" y="4" width="20" height="24" rx="3" fill={dark} /><rect x="30" y="52" width="20" height="24" rx="3" fill={dark} /><circle cx="40" cy="40" r="19" fill={accent} stroke={S} strokeWidth="2" /><circle cx="40" cy="40" r="15" fill="#f2f4fa" /><path d="M40 40 V28 M40 40 L48 44" stroke="#1a1a22" strokeWidth="2" strokeLinecap="round" /><circle cx="40" cy="40" r="2" fill="#1a1a22" /></>);
          case 'glasses': return (<><circle cx="22" cy="42" r="14" fill={f} stroke={accent} strokeWidth="3" /><circle cx="58" cy="42" r="14" fill={f} stroke={accent} strokeWidth="3" /><path d="M36 38 Q40 34 44 38" fill="none" stroke={accent} strokeWidth="3" /><path d="M8 38 L2 30 M72 38 L78 30" stroke={accent} strokeWidth="3" /><ellipse cx="17" cy="36" rx="4" ry="2.5" fill="#fff" opacity="0.4" /></>);
          case 'bag': return (<><path d="M26 26 Q26 8 40 8 Q54 8 54 26" fill="none" stroke={dark} strokeWidth="4" /><path d="M14 26 H66 L70 72 H10 Z" fill={f} stroke={S} /><rect x="14" y="40" width="52" height="4" fill={accent} opacity="0.8" /><rect x="34" y="36" width="12" height="12" rx="2" fill={accent} stroke={S} /></>);
          case 'sock': return (<><path d="M28 6 H50 V40 L68 56 Q74 64 66 70 Q58 74 50 66 L28 48 Z" fill={f} stroke={S} /><rect x="28" y="6" width="22" height="8" fill={accent} /><rect x="28" y="20" width="22" height="3" fill={accent} opacity="0.6" /></>);
          case 'umbrella': return (<><path d="M6 36 Q10 8 40 6 Q70 8 74 36 Q66 30 58 36 Q50 30 40 36 Q30 30 22 36 Q14 30 6 36 Z" fill={f} stroke={S} /><path d="M40 6 V36 M24 12 Q22 28 22 36 M56 12 Q58 28 58 36" stroke={accent} fill="none" /><path d="M40 36 V66 Q40 74 33 72" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" /></>);
          default: return <rect x="16" y="16" width="48" height="48" rx="8" fill={f} />;
        }
      }}
    </Frame>
  );
}

// ── makeup, hair and skin ────────────────────────────────────────────────────
export function BeautyArt({ kind, color, accent }) {
  return (
    <Frame color={color}>
      {({ f, v, r, dark, light }) => {
        switch (kind) {
          case 'lipstick': return (<><rect x="28" y="38" width="24" height="34" rx="3" fill={accent} stroke={S} /><rect x="28" y="38" width="24" height="5" fill="#d9c48a" /><path d="M32 38 V18 L40 8 L48 16 V38 Z" fill={v} stroke={S} /><rect x="31" y="22" width="3" height="14" fill="#fff" opacity="0.35" /></>);
          case 'compact': return (<><ellipse cx="40" cy="48" rx="30" ry="18" fill={accent} stroke={S} /><ellipse cx="40" cy="44" rx="30" ry="18" fill="#d9c48a" stroke={S} /><ellipse cx="40" cy="43" rx="22" ry="12" fill={r} stroke={S} /><ellipse cx="34" cy="40" rx="8" ry="3.5" fill="#fff" opacity="0.35" /></>);
          case 'bottle': return (<><rect x="32" y="6" width="16" height="14" rx="3" fill={accent} stroke={S} /><rect x="35" y="18" width="10" height="7" fill={dark} /><path d="M26 25 H54 Q58 25 58 30 V70 Q58 74 54 74 H26 Q22 74 22 70 V30 Q22 25 26 25Z" fill={v} stroke={S} /><rect x="26" y="40" width="28" height="20" rx="2" fill="#fff" opacity="0.85" /><rect x="30" y="46" width="20" height="3" fill={accent} opacity="0.7" /><rect x="30" y="52" width="14" height="2" fill={accent} opacity="0.5" /></>);
          case 'perfume': return (<><rect x="30" y="4" width="20" height="14" rx="3" fill={accent} stroke={S} /><rect x="36" y="16" width="8" height="8" fill={dark} /><path d="M18 36 Q18 24 30 24 H50 Q62 24 62 36 V64 Q62 74 52 74 H28 Q18 74 18 64Z" fill={v} stroke={S} opacity="0.95" /><path d="M24 50 H56 V66 Q56 70 52 70 H28 Q24 70 24 66Z" fill={accent} opacity="0.35" /><ellipse cx="28" cy="40" rx="3" ry="9" fill="#fff" opacity="0.45" /></>);
          case 'polish': return (<><rect x="34" y="4" width="12" height="30" rx="3" fill={accent} stroke={S} /><path d="M24 40 Q24 32 32 32 H48 Q56 32 56 40 V66 Q56 74 48 74 H32 Q24 74 24 66Z" fill={v} stroke={S} /><rect x="28" y="44" width="5" height="22" rx="2" fill="#fff" opacity="0.4" /></>);
          case 'comb': return (<><rect x="6" y="14" width="68" height="16" rx="5" fill={f} stroke={S} />{Array.from({ length: 15 }).map((_, i) => <rect key={i} x={9 + i * 4.4} y="28" width="2.6" height="28" rx="1.3" fill={f} stroke={S} strokeWidth="0.6" />)}</>);
          case 'brush': return (<><rect x="32" y="40" width="16" height="36" rx="8" fill={f} stroke={S} /><ellipse cx="40" cy="22" rx="20" ry="22" fill={accent} stroke={S} />{[[28, 12], [36, 8], [44, 8], [52, 12], [32, 22], [40, 18], [48, 22], [30, 32], [40, 30], [50, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.1" fill="#f2e2c4" />)}</>);
          case 'mascara': return (<><rect x="30" y="6" width="20" height="32" rx="5" fill={accent} stroke={S} /><rect x="26" y="36" width="28" height="38" rx="5" fill={v} stroke={S} /><rect x="30" y="50" width="20" height="3" fill="#d9c48a" /><rect x="30" y="56" width="14" height="2" fill="#d9c48a" opacity="0.7" /></>);
          case 'pencil': return (<><path d="M22 70 L58 16 L66 22 L30 76 Z" fill={f} stroke={S} /><path d="M58 16 L66 22 L70 10 Z" fill="#e8c9a0" stroke={S} /><path d="M68 13 L70 10 L66 12 Z" fill={dark} /><path d="M24 66 L32 74" stroke={accent} strokeWidth="4" /></>);
          case 'palette': return (<><rect x="6" y="14" width="68" height="52" rx="8" fill={accent} stroke={S} /><rect x="12" y="20" width="56" height="26" rx="4" fill="#2a1a22" opacity="0.4" />{['#e8c9a0', '#c9703a', '#c2185b', '#7a3a9a', '#2f6fb5', '#2f9a6a', '#f0c030', '#e0529f'].map((c, i) => <circle key={i} cx={20 + (i % 4) * 14} cy={28 + Math.floor(i / 4) * 12} r="5" fill={c} stroke={S} strokeWidth="0.6" />)}<rect x="12" y="52" width="56" height="9" rx="3" fill="#2a1a22" opacity="0.5" /></>);
          case 'tube': return (<><path d="M24 10 H56 L52 62 H28 Z" fill={f} stroke={S} /><rect x="28" y="60" width="24" height="8" rx="1" fill={accent} stroke={S} /><path d="M24 10 Q40 2 56 10" fill={accent} stroke={S} /><rect x="30" y="26" width="20" height="14" rx="2" fill="#fff" opacity="0.8" /><rect x="30" y="18" width="3" height="38" fill="#fff" opacity="0.3" /></>);
          case 'jar': return (<><rect x="18" y="14" width="44" height="14" rx="4" fill={accent} stroke={S} /><rect x="14" y="26" width="52" height="46" rx="10" fill={v} stroke={S} /><rect x="22" y="40" width="36" height="18" rx="3" fill="#fff" opacity="0.85" /><rect x="26" y="46" width="20" height="3" fill={accent} opacity="0.7" /><rect x="18" y="30" width="3" height="36" fill="#fff" opacity="0.35" /></>);
          case 'bindi': return (<><rect x="12" y="10" width="56" height="60" rx="6" fill="#f6efe0" stroke={S} />{Array.from({ length: 12 }).map((_, i) => <circle key={i} cx={24 + (i % 3) * 16} cy={22 + Math.floor(i / 3) * 14} r="4.2" fill={color} stroke={accent} strokeWidth="1" />)}</>);
          case 'clips': return (<>{[[16, 22, -20], [36, 18, 12], [56, 24, -8], [22, 52, 18], [48, 54, -16]].map(([x, y, rot], i) => <g key={i} transform={`rotate(${rot} ${x + 8} ${y + 4})`}><rect x={x} y={y} width="18" height="7" rx="3.5" fill={i % 2 ? accent : color} stroke={S} /><rect x={x + 2} y={y + 2} width="14" height="1.5" fill="#fff" opacity="0.5" /></g>)}</>);
          case 'dryer': return (<><path d="M8 20 Q8 8 24 8 H52 Q68 8 68 24 V30 Q68 40 52 40 H24 Q8 40 8 30Z" fill={v} stroke={S} /><path d="M30 40 L38 74 H52 L48 40Z" fill={accent} stroke={S} /><rect x="64" y="14" width="10" height="20" rx="2" fill={accent} stroke={S} /><circle cx="26" cy="24" r="5" fill="#fff" opacity="0.35" /></>);
          case 'bangles': return (<>{[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx={30 + i * 6} cy="42" rx="14" ry="26" fill="none" stroke={i % 2 ? accent : color} strokeWidth="3.5" opacity="0.95" />)}</>);
          case 'earrings': return (<>{[22, 58].map(x => <g key={x}><path d={`M${x} 8 Q${x + 8} 8 ${x + 8} 16`} fill="none" stroke={color} strokeWidth="2" /><circle cx={x} cy="24" r="6" fill={r} stroke={S} /><path d={`M${x} 30 L${x - 7} 52 L${x} 66 L${x + 7} 52 Z`} fill={accent} stroke={S} /><circle cx={x} cy="50" r="2.4" fill={color} /></g>)}</>);
          case 'necklace': return (<><path d="M12 12 Q40 76 68 12" fill="none" stroke={color} strokeWidth="3" />{[0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map((t, i) => { const x = 12 + 56 * t; const y = 12 + Math.sin(t * Math.PI) * 50; return <circle key={i} cx={x} cy={y} r="3.2" fill={i % 2 ? accent : color} stroke={S} strokeWidth="0.6" />; })}<path d="M40 62 L34 70 L40 78 L46 70Z" fill={accent} stroke={S} /></>);
          case 'mirror': return (<><circle cx="40" cy="30" r="24" fill={accent} stroke={S} /><circle cx="40" cy="30" r="19" fill={color} /><ellipse cx="32" cy="22" rx="7" ry="4" fill="#fff" opacity="0.7" transform="rotate(-30 32 22)" /><rect x="35" y="52" width="10" height="24" rx="5" fill={accent} stroke={S} /></>);
          default: return <rect x="16" y="16" width="48" height="48" rx="8" fill={f} />;
        }
      }}
    </Frame>
  );
}

// ── flowers, vegetables, herbs ───────────────────────────────────────────────
const petals = (n, rx, ry, dist, fill, stroke = S) => Array.from({ length: n }).map((_, i) => <ellipse key={i} cx="40" cy={34 - dist} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth="0.7" transform={`rotate(${(360 / n) * i} 40 34)`} />);
const stem = (c) => <path d="M40 40 Q38 58 40 76" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />;
const leafPair = (c) => (<><path d="M40 62 Q26 54 20 60 Q30 68 40 62Z" fill={c} stroke={S} strokeWidth="0.6" /><path d="M40 56 Q54 48 60 54 Q50 62 40 56Z" fill={c} stroke={S} strokeWidth="0.6" /></>);

export function PlantArt({ kind, color, accent }) {
  return (
    <Frame color={color}>
      {({ f, v, r, dark, light }) => {
        switch (kind) {
          case 'rose': return (<>{stem(accent)}{leafPair(accent)}<circle cx="40" cy="30" r="20" fill={r} stroke={S} /><path d="M40 30 m-3 0 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9 9 0 1 1 18 0" fill="none" stroke={dark} strokeWidth="1.8" strokeLinecap="round" /><path d="M24 24 Q40 14 56 24" fill="none" stroke={light} strokeWidth="1.2" opacity="0.7" /></>);
          case 'pom': return (<>{stem(accent)}{leafPair(accent)}{petals(14, 4.6, 12, 10, f)}{petals(10, 4, 9, 6, light)}<circle cx="40" cy="34" r="5" fill={dark} /></>);
          case 'star': return (<>{stem(accent)}{leafPair(accent)}{petals(6, 5, 13, 11, f)}<circle cx="40" cy="34" r="3.6" fill="#f0d870" /></>);
          case 'sun': return (<>{stem(accent)}{leafPair(accent)}{petals(18, 3.4, 11, 15, f)}<circle cx="40" cy="34" r="12" fill="#6a3a1a" stroke={S} />{[[36, 30], [44, 30], [40, 36], [34, 38], [46, 38], [40, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill="#3a1a08" />)}</>);
          case 'lotus': return (<><ellipse cx="40" cy="68" rx="32" ry="8" fill="#2f8f4a" stroke={S} /><ellipse cx="40" cy="66" rx="24" ry="5" fill="#3aa862" />{[-50, -25, 25, 50].map((a, i) => <path key={i} d="M40 62 Q32 44 40 20 Q48 44 40 62Z" fill={f} stroke={S} transform={`rotate(${a} 40 62)`} />)}<path d="M40 62 Q30 42 40 14 Q50 42 40 62Z" fill={r} stroke={S} /><circle cx="40" cy="48" r="3" fill="#f0d030" /></>);
          case 'hibiscus': return (<>{stem(accent)}{leafPair('#2f8f4a')}{petals(5, 11, 14, 9, f)}<path d="M40 34 L56 14" stroke="#f0c030" strokeWidth="2.4" strokeLinecap="round" /><circle cx="56" cy="14" r="3" fill="#f0c030" /><circle cx="40" cy="34" r="4" fill={dark} /></>);
          case 'tulip': return (<>{stem(accent)}<path d="M40 76 Q20 62 18 48 Q32 58 40 56 Q48 58 62 48 Q60 62 40 76Z" fill="#2f8f4a" stroke={S} /><path d="M24 14 Q22 40 40 46 Q58 40 56 14 L48 24 L40 10 L32 24Z" fill={r} stroke={S} /></>);
          case 'lily': return (<>{stem(accent)}{[-60, -30, 0, 30, 60].map((a, i) => <path key={i} d="M40 40 Q32 24 40 8 Q48 24 40 40Z" fill={f} stroke={S} strokeWidth="0.7" transform={`rotate(${a} 40 40)`} />)}{[[34, 30], [46, 28], [40, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill="#a02a3a" />)}<path d="M40 40 L30 18 M40 40 L50 18" stroke={accent} strokeWidth="1.4" /><circle cx="30" cy="18" r="2" fill="#e08a2a" /><circle cx="50" cy="18" r="2" fill="#e08a2a" /></>);
          case 'daisy': return (<>{stem(accent)}{leafPair(accent)}{petals(14, 3.6, 11, 12, f)}<circle cx="40" cy="34" r="7" fill="#f6c030" stroke={S} /></>);
          case 'orchid': return (<><path d="M22 78 Q20 40 50 14" stroke={accent} strokeWidth="2.6" fill="none" />{[[46, 20, 0.9], [36, 34, 1.05], [28, 50, 1.2]].map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>{[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-7" rx="4.6" ry="8" fill={f} stroke={S} strokeWidth="0.6" transform={`rotate(${a})`} />)}<circle r="3" fill="#f6e0a0" /></g>)}</>);
          case 'spike': return (<>{[26, 40, 54].map((x, i) => <g key={x}><path d={`M${x} 76 Q${x + (i - 1) * 3} 50 ${x} 20`} stroke={accent} strokeWidth="2.4" fill="none" />{Array.from({ length: 9 }).map((_, k) => <ellipse key={k} cx={x + (k % 2 ? 3 : -3)} cy={22 + k * 4.6} rx="3.4" ry="2.6" fill={k % 2 ? color : light} stroke={S} strokeWidth="0.4" />)}</g>)}</>);
          case 'paper': return (<>{stem(accent)}{[[28, 26], [50, 22], [38, 40], [54, 42], [24, 44]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${i * 40})`}>{[0, 120, 240].map(a => <path key={a} d="M0 0 Q-7 -9 0 -14 Q7 -9 0 0Z" fill={i % 2 ? f : r} stroke={S} strokeWidth="0.5" transform={`rotate(${a})`} />)}<circle r="1.6" fill="#fff6c0" /></g>)}</>);
          case 'tomato': return (<><ellipse cx="40" cy="46" rx="26" ry="23" fill={r} stroke={S} /><path d="M40 24 L34 16 M40 24 L46 16 M40 24 L30 22 M40 24 L50 22 M40 24 L40 14" stroke={accent} strokeWidth="3" strokeLinecap="round" /><ellipse cx="30" cy="38" rx="6" ry="9" fill="#fff" opacity="0.28" /></>);
          case 'brinjal': return (<><path d="M30 24 Q8 40 24 66 Q40 80 52 60 Q62 40 50 24 Z" fill={r} stroke={S} /><path d="M26 22 Q40 14 54 22 L50 30 Q40 26 30 30Z" fill={accent} stroke={S} /><path d="M40 14 L40 6" stroke={accent} strokeWidth="4" strokeLinecap="round" /><ellipse cx="28" cy="46" rx="4" ry="12" fill="#fff" opacity="0.25" /></>);
          case 'okra': return (<>{[[-18, 0], [0, 6], [18, 0]].map(([dx, dy], i) => <g key={i} transform={`translate(${dx} ${dy})`}><path d="M40 12 Q36 40 40 74 Q44 40 40 12Z" fill={f} stroke={S} /><path d="M40 12 V74" stroke={dark} strokeWidth="0.8" /><circle cx="40" cy="12" r="3" fill={accent} /></g>)}</>);
          case 'chilli': return (<><path d="M20 22 Q32 22 40 36 Q54 60 70 66 Q54 74 40 56 Q26 40 20 22Z" fill={r} stroke={S} /><path d="M20 22 Q16 14 26 12 L30 20Z" fill={accent} stroke={S} /><path d="M26 28 Q36 34 44 50" stroke="#fff" strokeWidth="2" fill="none" opacity="0.4" /></>);
          case 'carrot': return (<><path d="M24 22 Q40 14 56 22 L44 74 Q40 78 36 74Z" fill={f} stroke={S} />{[34, 44, 54].map(y => <path key={y} d={`M${30 + (y - 22) * 0.15} ${y} H${50 - (y - 22) * 0.15}`} stroke={dark} strokeWidth="1" opacity="0.6" />)}{[[-12, 0], [0, -4], [12, 0]].map(([dx, dy], i) => <path key={i} d={`M40 22 Q${40 + dx} ${8 + dy} ${40 + dx * 1.4} ${2 + dy}`} stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" />)}</>);
          case 'cabbage': return (<><circle cx="40" cy="44" r="28" fill={r} stroke={S} /><path d="M40 16 Q20 44 40 72 M40 16 Q60 44 40 72 M14 44 Q40 30 66 44" fill="none" stroke={accent} strokeWidth="2" opacity="0.8" /><ellipse cx="30" cy="34" rx="7" ry="10" fill="#fff" opacity="0.25" /></>);
          case 'cauli': return (<><circle cx="26" cy="34" r="14" fill={f} stroke={S} /><circle cx="40" cy="28" r="16" fill={f} stroke={S} /><circle cx="54" cy="34" r="14" fill={f} stroke={S} /><circle cx="40" cy="46" r="18" fill={f} stroke={S} /><path d="M12 60 Q40 44 68 60 Q60 76 40 76 Q20 76 12 60Z" fill={accent} stroke={S} /></>);
          case 'leaf': return (<><path d="M40 74 Q8 56 14 22 Q40 4 66 22 Q72 56 40 74Z" fill={f} stroke={S} /><path d="M40 74 V16 M40 56 L24 42 M40 44 L56 30 M40 32 L26 22" stroke={light} strokeWidth="1.6" fill="none" opacity="0.7" /></>);
          case 'pumpkin': return (<><ellipse cx="40" cy="48" rx="32" ry="24" fill={r} stroke={S} />{[-18, -8, 0, 8, 18].map((dx, i) => <path key={i} d={`M${40 + dx} 26 Q${40 + dx * 1.8} 48 ${40 + dx} 72`} stroke={dark} strokeWidth="1.4" fill="none" opacity="0.6" />)}<path d="M40 26 L40 14 Q44 10 48 14" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" /></>);
          case 'gourd': return (<><path d="M32 8 Q28 14 30 26 Q10 40 14 58 Q22 74 40 74 Q58 74 66 58 Q70 40 50 26 Q52 14 48 8Z" fill={f} stroke={S} /><ellipse cx="28" cy="52" rx="5" ry="14" fill="#fff" opacity="0.28" /><path d="M40 8 V2" stroke={accent} strokeWidth="4" strokeLinecap="round" /></>);
          case 'cucumber': return (<><rect x="6" y="28" width="68" height="26" rx="13" fill={f} stroke={S} transform="rotate(-24 40 41)" />{[16, 28, 40, 52, 64].map(x => <circle key={x} cx={x} cy={44 - (x - 40) * 0.44} r="1.4" fill={dark} />)}<ellipse cx="30" cy="36" rx="14" ry="3" fill="#fff" opacity="0.3" transform="rotate(-24 30 36)" /></>);
          case 'corn': return (<><path d="M24 74 Q8 36 24 12 Q40 -2 56 12 Q72 36 56 74Z" fill="#6ac84a" stroke={S} /><path d="M32 70 Q24 40 34 16 Q40 10 46 16 Q56 40 48 70Z" fill={f} stroke={S} />{Array.from({ length: 5 }).map((_, i) => Array.from({ length: 4 }).map((__, k) => <circle key={`${i}-${k}`} cx={34 + k * 4.2} cy={22 + i * 10} r="1.9" fill="#d09a10" opacity="0.8" />))}</>);
          case 'onion': return (<><path d="M40 8 Q36 20 40 26" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M40 20 Q10 34 16 56 Q24 74 40 74 Q56 74 64 56 Q70 34 40 20Z" fill={r} stroke={S} /><path d="M40 22 Q28 50 40 74 M40 22 Q52 50 40 74" fill="none" stroke={dark} strokeWidth="1.2" opacity="0.5" /><path d="M36 74 L34 78 M44 74 L46 78" stroke="#c9a060" strokeWidth="1.4" /></>);
          case 'peas': return (<><path d="M8 40 Q40 10 72 40 Q40 66 8 40Z" fill={accent} stroke={S} /><path d="M12 40 Q40 18 68 40" fill="none" stroke="#bfe8a0" strokeWidth="1.5" opacity="0.8" />{[22, 34, 46, 58].map((x, i) => <circle key={x} cx={x} cy={38 + (i % 2 ? 2 : -1)} r="7" fill={r} stroke={S} />)}</>);
          case 'capsicum': return (<><path d="M16 30 Q12 54 26 68 Q40 78 54 68 Q68 54 64 30 Q52 20 40 28 Q28 20 16 30Z" fill={r} stroke={S} /><path d="M40 28 Q40 56 40 72 M28 26 Q22 50 28 70 M52 26 Q58 50 52 70" stroke={dark} strokeWidth="1.2" fill="none" opacity="0.5" /><path d="M40 28 V14 Q46 8 52 12" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" /><ellipse cx="26" cy="40" rx="4" ry="10" fill="#fff" opacity="0.3" /></>);
          case 'potato': return (<><path d="M12 44 Q10 24 36 20 Q66 18 70 42 Q72 64 44 68 Q14 70 12 44Z" fill={r} stroke={S} />{[[28, 38], [48, 32], [54, 52], [34, 54], [42, 44]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2" ry="1.4" fill={dark} opacity="0.7" />)}</>);
          case 'sprig': return (<><path d="M40 76 Q38 50 40 14" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />{[[0, 60], [1, 48], [0, 36], [1, 24]].map(([side, y], i) => <path key={i} d={side ? `M40 ${y} Q58 ${y - 14} 64 ${y - 6} Q58 ${y + 8} 40 ${y}Z` : `M40 ${y} Q22 ${y - 14} 16 ${y - 6} Q22 ${y + 8} 40 ${y}Z`} fill={f} stroke={S} strokeWidth="0.6" />)}<path d="M40 14 Q32 4 40 2 Q48 4 40 14Z" fill={f} stroke={S} strokeWidth="0.6" /></>);
          case 'aloe': return (<><path d="M40 72 Q34 40 24 14 Q40 40 40 72Z M40 72 Q46 40 56 14 Q40 40 40 72Z M40 72 Q20 50 8 30 Q32 48 40 72Z M40 72 Q60 50 72 30 Q48 48 40 72Z M40 72 Q40 30 40 8 Q42 40 40 72Z" fill={f} stroke={S} /><path d="M18 70 H62 L58 78 H22Z" fill={accent} stroke={S} /></>);
          case 'grass': return (<>{[-22, -11, 0, 11, 22].map((a, i) => <path key={i} d={`M40 74 Q${40 + a} 44 ${40 + a * 1.5} 8`} stroke={i % 2 ? f : r} strokeWidth="4" fill="none" strokeLinecap="round" />)}<path d="M20 70 H60 L56 78 H24Z" fill={accent} stroke={S} /></>);
          case 'ginger': return (<><path d="M10 52 Q12 40 24 44 Q30 30 42 38 Q48 24 58 34 Q74 32 70 50 Q64 62 46 60 Q36 70 22 62 Q10 62 10 52Z" fill={r} stroke={S} /><path d="M24 50 H34 M44 46 H56 M30 58 H42" stroke={dark} strokeWidth="1.2" opacity="0.5" /></>);
          default: return <circle cx="40" cy="40" r="22" fill={f} />;
        }
      }}
    </Frame>
  );
}
