import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { GENRES, SHELVES, FRIDGE_SHELVES, DISHES, OVEN_ITEMS } from '../../data/gamifyBooks';

// Full-screen "look closer" views for props in the Gamify house: bookshelf (tap a
// book to read it), fridge (hover an item for its name), oven (something is baking)
// and stove (pick a dish and watch it cook). Plain DOM portals above the whole app,
// so they behave the same on phones.

const overlay = {
  position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
  background: 'radial-gradient(circle at 50% 30%, rgba(40,26,80,0.97), rgba(8,6,20,0.99))', backdropFilter: 'blur(8px)',
  padding: '56px 14px 20px', overflow: 'auto', animation: 'gp-fade .2s ease-out',
};
const closeBtn = {
  position: 'fixed', top: 12, right: 12, width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(12,10,24,0.8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 3,
};
const pill = { background: 'rgba(12,10,24,0.78)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 99, color: '#fff' };
const btnPill = { ...pill, padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 };

const CSS = `
@keyframes gp-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes gp-open { from { opacity: 0; transform: perspective(1200px) rotateY(-28deg) scale(.92) } to { opacity: 1; transform: perspective(1200px) rotateY(0) scale(1) } }
@keyframes gp-page { from { opacity: 0; transform: perspective(1200px) rotateY(14deg) translateX(18px) } to { opacity: 1; transform: perspective(1200px) rotateY(0) translateX(0) } }
@keyframes gp-flame { 0%,100% { transform: scaleY(1) scaleX(1); opacity: .95 } 50% { transform: scaleY(1.25) scaleX(.85); opacity: 1 } }
@keyframes gp-steam { 0% { transform: translateY(0) scaleX(1); opacity: 0 } 25% { opacity: .55 } 100% { transform: translateY(-70px) scaleX(1.6); opacity: 0 } }
@keyframes gp-bubble { 0% { transform: translateY(8px) scale(.4); opacity: 0 } 40% { opacity: .9 } 100% { transform: translateY(-14px) scale(1); opacity: 0 } }
@keyframes gp-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes gp-rise { from { transform: scaleY(.7) } to { transform: scaleY(1) } }
@keyframes gp-spin { to { transform: rotate(360deg) } }
@keyframes gp-pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
@keyframes gp-sizzle { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-1px) } 75% { transform: translateX(1px) } }
`;

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

// ── books ────────────────────────────────────────────────────────────────────
function GenreIcon({ genre, size = 64, color }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ opacity: 0.9 }}>
      {genre === 'horror' && (<><path d="M44 12a22 22 0 1 0 8 30A18 18 0 0 1 44 12z" {...p} /><path d="M10 54l8-14 6 6 8-12" {...p} /></>)}
      {genre === 'thriller' && (<><circle cx="32" cy="24" r="10" {...p} /><path d="M32 34v20M32 44h8M32 52h6" {...p} /></>)}
      {genre === 'crime' && (<><circle cx="26" cy="26" r="14" {...p} /><path d="M36 36l18 18" {...p} /></>)}
      {genre === 'romance' && <path d="M32 54C10 38 8 22 18 16c6-4 12 0 14 6 2-6 8-10 14-6 10 6 8 22-14 38z" {...p} />}
      {genre === 'adventure' && (<><circle cx="32" cy="32" r="22" {...p} /><path d="M32 12l6 20-6 20-6-20z" {...p} /></>)}
      {genre === 'scifi' && (<><circle cx="32" cy="32" r="12" {...p} /><ellipse cx="32" cy="32" rx="26" ry="8" transform="rotate(-25 32 32)" {...p} /></>)}
      {genre === 'classic' && (<><path d="M12 14h40v36H12z" {...p} /><path d="M32 14v36M18 24h8M38 24h8M18 32h8M38 32h8" {...p} /></>)}
      {genre === 'indian' && (<><path d="M32 52c-14-4-22-14-22-24 8 2 16 8 22 24 6-16 14-22 22-24 0 10-8 20-22 24z" {...p} /><path d="M32 52V20" {...p} /></>)}
      {genre === 'philosophy' && (<><path d="M12 54h40M16 50V26M26 50V26M38 50V26M48 50V26M10 26h44L32 12z" {...p} /></>)}
      {genre === 'poetry' && (<><path d="M50 8C30 14 18 30 14 56" {...p} /><path d="M50 8c-2 14-12 22-24 22M40 20c-2 10-8 14-16 16" {...p} /></>)}
    </svg>
  );
}

function Spine({ book, onPick, h, w }) {
  const g = GENRES[book.genre];
  const s = hash(book.id);
  const tilt = (s % 7) === 0;
  return (
    <button
      onClick={() => onPick(book)}
      title={`${book.title} - ${book.author}`}
      style={{
        width: w, height: h, border: 'none', cursor: 'pointer', borderRadius: '3px 3px 1px 1px', position: 'relative', flex: 'none', padding: '6px 0',
        background: `linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 22%, rgba(0,0,0,0.28) 100%), linear-gradient(180deg, ${g.a}, ${g.b})`,
        color: g.ink, boxShadow: '2px 0 5px rgba(0,0,0,0.55)', transition: 'transform .16s', transformOrigin: 'bottom center',
        transform: tilt ? 'rotate(-3deg)' : 'none', alignSelf: 'flex-end', marginLeft: tilt ? 4 : 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-14px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = tilt ? 'rotate(-3deg)' : 'none'; }}
    >
      <span style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 2, background: 'rgba(255,215,120,0.8)' }} />
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 10, height: 2, background: 'rgba(255,215,120,0.8)' }} />
      <span style={{ writingMode: 'vertical-rl', fontSize: 13.5, fontWeight: 700, fontFamily: 'Georgia, serif', display: 'block', margin: '18px auto 18px', maxHeight: h - 40, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{book.title}</span>
    </button>
  );
}

function BookshelfView({ shelfId, onPick }) {
  const shelf = SHELVES[shelfId] || SHELVES.default;
  const perRow = typeof window !== 'undefined' && window.innerWidth < 640 ? 7 : 12;
  const rows = useMemo(() => {
    const out = [];
    for (let i = 0; i < shelf.books.length; i += perRow) out.push(shelf.books.slice(i, i + perRow));
    return out;
  }, [shelf, perRow]);
  const genres = [...new Set(shelf.books.map(b => b.genre))];
  return (
    <div style={{ width: '100%', maxWidth: 980 }}>
      <div className="stay-white" style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>{shelf.title}</div>
      <div className="stay-white" style={{ textAlign: 'center', fontSize: 13, opacity: 0.7, margin: '2px 0 14px' }}>{shelf.books.length} books - tap one to read it</div>
      <div style={{ background: 'linear-gradient(180deg,#4a3322,#2a1d12)', borderRadius: 14, padding: '14px 14px 6px', boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 5px #5a4030' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', gap: 3, minHeight: 190, padding: '10px 10px 0', background: 'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.22))', borderRadius: 5, overflow: 'hidden' }}>
              {row.map(b => {
                const s = hash(b.id);
                return <Spine key={b.id} book={b} onPick={onPick} h={150 + (s % 5) * 16} w={40 + ((s >>> 3) % 4) * 9} />;
              })}
            </div>
            <div style={{ height: 14, background: 'linear-gradient(180deg,#8a5e3a,#4a3322)', borderRadius: 3, boxShadow: '0 5px 9px rgba(0,0,0,0.55)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 14 }}>
        {genres.map(g => (
          <span key={g} className="stay-white" style={{ ...pill, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: GENRES[g].a }} />{GENRES[g].label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BookReader({ book, onBack }) {
  const g = GENRES[book.genre];
  const small = typeof window !== 'undefined' && window.innerWidth < 700;
  const [sheet, setSheet] = useState(0); // 0 cover, then pages
  const paper = { background: 'linear-gradient(90deg,#e8dbbd,#f8eed8 10%,#f8eed8)', color: '#2a1f10', fontFamily: 'Georgia, "Times New Roman", serif' };
  const pageBox = { ...paper, flex: 1, padding: small ? '24px 22px' : '36px 34px', fontSize: small ? 15.5 : 17.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflow: 'auto', minHeight: 0, boxSizing: 'border-box' };
  const titlePage = (
    <div style={{ ...pageBox, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <GenreIcon genre={book.genre} size={54} color="#7a5a34" />
      <div style={{ fontSize: small ? 22 : 28, fontWeight: 700, marginTop: 14, lineHeight: 1.25 }}>{book.title}</div>
      <div style={{ width: 60, height: 2, background: '#7a5a34', margin: '14px 0' }} />
      <div style={{ fontStyle: 'italic' }}>{book.author}</div>
      <div style={{ marginTop: 22, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.6 }}>{g.label}</div>
    </div>
  );
  const first = book.text.charAt(0);
  const textPage = (
    <div style={pageBox}>
      <span style={{ float: 'left', fontSize: small ? 52 : 64, lineHeight: 0.85, padding: '4px 8px 0 0', color: '#7a2a1a', fontWeight: 700 }}>{first}</span>
      {book.text.slice(1)}
    </div>
  );
  const aboutPage = (
    <div style={{ ...pageBox, fontStyle: 'italic' }}>
      <div style={{ fontStyle: 'normal', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 10 }}>About this book</div>
      {book.about}
      <div style={{ marginTop: 20, fontStyle: 'normal', fontSize: 12, opacity: 0.55 }}>Opening shown from the public-domain text (or an original retelling).</div>
    </div>
  );
  const sheets = small ? ['cover', [titlePage], [textPage], [aboutPage]] : ['cover', [titlePage, textPage], [aboutPage]];
  const last = sheets.length - 1;
  const cur = sheets[sheet];
  return (
    <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <button onClick={onBack} className="stay-white" style={{ ...btnPill, alignSelf: 'flex-start' }}><ArrowLeft size={15} /> Back to shelf</button>
      <div key={sheet} style={{ width: '100%', height: small ? '60vh' : 'min(64vh, 540px)', animation: sheet === 1 ? 'gp-open .5s ease-out' : 'gp-page .35s ease-out', display: 'flex', borderRadius: 10, boxShadow: '0 30px 70px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
        {cur === 'cover' ? (
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${g.a}, ${g.b})`, color: g.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, fontFamily: 'Georgia, serif', border: '7px double rgba(255,215,120,0.55)', boxSizing: 'border-box', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 18, fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.8 }}>{g.label}</div>
            <GenreIcon genre={book.genre} size={small ? 70 : 96} color={g.ink} />
            <div style={{ fontSize: small ? 26 : 38, fontWeight: 700, lineHeight: 1.2, marginTop: 18 }}>{book.title}</div>
            <div style={{ width: 90, height: 2, background: 'rgba(255,215,120,0.8)', margin: '18px 0' }} />
            <div style={{ fontSize: small ? 15 : 20, fontStyle: 'italic' }}>{book.author}</div>
          </div>
        ) : cur.map((pg, i) => <div key={i} style={{ flex: 1, display: 'flex', borderRight: i === 0 && cur.length > 1 ? '1px solid rgba(0,0,0,0.15)' : 'none' }}>{pg}</div>)}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={() => setSheet(s => Math.max(0, s - 1))} disabled={sheet === 0} className="stay-white" style={{ ...btnPill, opacity: sheet === 0 ? 0.4 : 1, cursor: sheet === 0 ? 'default' : 'pointer' }}><ChevronLeft size={16} /> Previous</button>
        <span className="stay-white" style={{ fontSize: 12, opacity: 0.7 }}>{sheet === 0 ? 'Cover' : `${sheet} / ${last}`}</span>
        <button onClick={() => setSheet(s => Math.min(last, s + 1))} disabled={sheet === last} className="stay-white" style={{ ...btnPill, opacity: sheet === last ? 0.4 : 1, cursor: sheet === last ? 'default' : 'pointer' }}>{sheet === 0 ? 'Open book' : 'Next'} <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

// ── fridge ───────────────────────────────────────────────────────────────────
function ItemArt({ kind, color, accent, label }) {
  const id = useId().replace(/:/g, '');
  const light = shade(color.startsWith('#') ? color : '#cccccc', 35);
  const dark = shade(color.startsWith('#') ? color : '#cccccc', -45);
  const gloss = (
    <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor={dark} /><stop offset="0.28" stopColor={light} /><stop offset="0.5" stopColor={color} /><stop offset="1" stopColor={dark} />
    </linearGradient>
  );
  const fill = `url(#g${id})`;
  const stroke = 'rgba(0,0,0,0.3)';
  const labelEl = label && (<text x="30" y="55" textAnchor="middle" fontSize={label.length > 5 ? 5.4 : 7} fontWeight="800" fill={accent} fontFamily="Arial, sans-serif">{label}</text>);
  return (
    <svg viewBox="0 0 60 80" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>{gloss}</defs>
      <ellipse cx="30" cy="77" rx="22" ry="3.5" fill="rgba(0,0,0,0.18)" />
      {kind === 'carton' && (<><polygon points="12,24 30,9 48,24" fill={accent} stroke={stroke} /><polygon points="30,9 48,24 30,26" fill="rgba(0,0,0,0.18)" /><rect x="12" y="24" width="36" height="50" rx="2" fill={fill} stroke={stroke} /><rect x="12" y="40" width="36" height="22" fill="#fff" opacity="0.88" />{labelEl}<rect x="16" y="26" width="3" height="46" fill="#fff" opacity="0.35" /></>)}
      {kind === 'tub' && (<><path d="M9 34 L51 34 L46 74 Q46 76 44 76 L16 76 Q14 76 14 74 Z" fill={fill} stroke={stroke} /><rect x="7" y="27" width="46" height="9" rx="3" fill={accent} stroke={stroke} /><rect x="14" y="44" width="32" height="18" rx="2" fill="#fff" opacity="0.9" />{labelEl}</>)}
      {kind === 'block' && (<><path d="M5 52 L55 52 L55 74 L5 74 Z" fill={fill} stroke={stroke} /><path d="M5 52 L12 44 L60 44 L55 52 Z" fill={light} stroke={stroke} /><path d="M55 52 L60 44 L60 66 L55 74 Z" fill={dark} stroke={stroke} />{label && <text x="30" y="67" textAnchor="middle" fontSize="5.6" fontWeight="800" fill="#5a4a20" fontFamily="Arial, sans-serif">{label}</text>}</>)}
      {kind === 'eggs' && (<><path d="M4 58 L56 58 L52 74 L8 74 Z" fill="#cdbf9f" stroke={stroke} />{[14, 30, 46].map(x => <g key={x}><ellipse cx={x} cy="56" rx="8.5" ry="11.5" fill={fill} stroke={stroke} /><ellipse cx={x - 3} cy="51" rx="2.5" ry="4" fill="#fff" opacity="0.5" /></g>)}</>)}
      {kind === 'bottle' && (<><rect x="23" y="5" width="14" height="14" rx="3" fill={accent} stroke={stroke} /><path d="M24 19 L36 19 L48 34 L48 72 Q48 76 44 76 L16 76 Q12 76 12 72 L12 34 Z" fill={fill} stroke={stroke} /><rect x="12" y="42" width="36" height="20" fill="#fff" opacity="0.9" />{labelEl}<rect x="16" y="30" width="3" height="42" fill="#fff" opacity="0.4" /></>)}
      {kind === 'jar' && (<><rect x="14" y="12" width="32" height="12" rx="3" fill={accent} stroke={stroke} /><rect x="10" y="24" width="40" height="50" rx="9" fill={fill} stroke={stroke} /><rect x="14" y="38" width="32" height="22" rx="3" fill="#f6efd8" opacity="0.95" />{labelEl}<rect x="14" y="28" width="3" height="42" fill="#fff" opacity="0.35" /></>)}
      {kind === 'can' && (<><rect x="14" y="14" width="32" height="60" rx="5" fill={fill} stroke={stroke} /><ellipse cx="30" cy="14" rx="16" ry="4.5" fill="#d8dce8" stroke={stroke} /><rect x="14" y="36" width="32" height="16" fill="#fff" opacity="0.92" />{labelEl}<rect x="17" y="18" width="3" height="52" fill="#fff" opacity="0.4" /></>)}
      {kind === 'cake' && (<><path d="M5 72 L55 72 L55 44 L5 56 Z" fill={fill} stroke={stroke} /><path d="M5 56 L55 44 L55 38 L5 50 Z" fill={accent} stroke={stroke} /><path d="M5 62 L55 56" stroke="#f8e6c8" strokeWidth="3" /><circle cx="47" cy="33" r="5.5" fill="#d0392b" stroke={stroke} /><ellipse cx="45" cy="31" rx="1.6" ry="2.2" fill="#fff" opacity="0.6" /></>)}
      {kind === 'veg' && (<><circle cx="30" cy="50" r="24" fill={fill} stroke={stroke} /><circle cx="30" cy="50" r="24" fill="url(#none)" /><ellipse cx="22" cy="40" rx="6" ry="9" fill="#fff" opacity="0.28" /><path d="M30 26 Q42 14 50 24 Q40 30 30 26 Z" fill={accent} stroke={stroke} /><path d="M30 26 Q18 14 10 24 Q20 30 30 26 Z" fill={accent} stroke={stroke} /></>)}
      {kind === 'leaf' && (<>{[[17, 54, -22], [43, 54, 22], [30, 48, 0]].map(([x, y, r], i) => <g key={i} transform={`rotate(${r} ${x} ${y + 14})`}><ellipse cx={x} cy={y} rx="9.5" ry="25" fill={i === 2 ? accent : color} stroke={stroke} /><path d={`M${x} ${y - 22} L${x} ${y + 22}`} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" /></g>)}</>)}
    </svg>
  );
}

function FridgeView() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { const t = setTimeout(() => setOpen(true), 60); return () => clearTimeout(t); }, []);
  const shown = hover || pinned;
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>Fridge</div>
      <div className="stay-white" style={{ ...pill, minHeight: 36, padding: '7px 20px', margin: '10px 0 14px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        {shown || 'Hover or tap an item'}
      </div>
      <div style={{ position: 'relative', width: '100%', perspective: 1400 }}>
        <div style={{ background: 'linear-gradient(180deg,#f2f8ff,#d3e5f6)', borderRadius: 16, padding: '14px 14px 10px', boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 6px #dfe3ee, inset 0 0 50px rgba(120,180,255,0.45)' }}>
          {FRIDGE_SHELVES.map((shelf, si) => (
            <div key={si} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 112, borderBottom: '6px solid rgba(255,255,255,0.95)', boxShadow: '0 7px 9px -6px rgba(0,0,0,0.3)', marginBottom: 8 }}>
              {shelf.map(it => (
                <div
                  key={it.name}
                  onMouseEnter={() => setHover(it.name)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setPinned(p => (p === it.name ? null : it.name))}
                  style={{ width: '17.5%', height: it.kind === 'block' || it.kind === 'eggs' ? '78%' : '96%', cursor: 'pointer', transition: 'transform .15s', transform: shown === it.name ? 'translateY(-7px) scale(1.1)' : 'none', filter: shown === it.name ? 'drop-shadow(0 8px 8px rgba(0,0,0,0.4))' : 'none' }}
                >
                  <ItemArt kind={it.kind} color={it.color} accent={it.accent} label={it.label} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {[['left', -1], ['right', 1]].map(([side, dir]) => (
          <div key={side} style={{
            position: 'absolute', top: 0, bottom: 0, [side]: 0, width: '50%', transformOrigin: `${side} center`,
            transform: open ? `rotateY(${dir * -105}deg)` : 'rotateY(0)', background: 'linear-gradient(135deg,#eef0f6,#c9cde0)', borderRadius: 16, boxShadow: '0 0 0 2px #aab0c6',
            pointerEvents: 'none', opacity: open ? 0 : 1, transitionProperty: 'transform, opacity', transitionDuration: '.9s, .5s', transitionDelay: '0s, .55s', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
          }}>
            <div style={{ position: 'absolute', top: '30%', [dir > 0 ? 'left' : 'right']: 10, width: 8, height: '30%', borderRadius: 4, background: '#8f95a8' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── oven ─────────────────────────────────────────────────────────────────────
function OvenFood({ kind, done }) {
  return (
    <svg viewBox="0 0 160 90" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <ellipse cx="80" cy="78" rx="62" ry="7" fill="rgba(0,0,0,0.35)" />
      {kind === 'cake' && (
        <g style={{ transformOrigin: '80px 78px', animation: done ? 'none' : 'gp-rise 6s ease-out infinite alternate' }}>
          <rect x="30" y="38" width="100" height="40" rx="8" fill="#6b4a2f" />
          <path d="M30 46 Q50 36 80 40 Q110 36 130 46 L130 54 L30 54 Z" fill="#8a5e3a" />
          <rect x="30" y="38" width="100" height="40" rx="8" fill="none" stroke="rgba(0,0,0,0.35)" />
          <ellipse cx="62" cy="52" rx="5" ry="3" fill="#a8764a" /><ellipse cx="96" cy="48" rx="6" ry="3" fill="#a8764a" />
        </g>
      )}
      {kind === 'pizza' && (
        <g style={{ transformOrigin: '80px 62px', animation: done ? 'none' : 'gp-spin 14s linear infinite' }}>
          <ellipse cx="80" cy="62" rx="56" ry="15" fill="#d9a050" />
          <ellipse cx="80" cy="60" rx="50" ry="12" fill="#f0c860" />
          {[[58, 58], [80, 54], [100, 60], [70, 66], [92, 66], [48, 62], [110, 55]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="6" ry="2.6" fill="#c0392b" />)}
          {[[66, 60], [88, 58], [78, 64]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3" ry="1.4" fill="#2f8f4a" />)}
        </g>
      )}
      {kind === 'cookies' && (
        <g>
          {[[40, 66], [76, 60], [112, 66], [58, 74], [96, 74]].map(([x, y], i) => (
            <g key={i}><ellipse cx={x} cy={y} rx="15" ry="6" fill="#c08a4a" /><ellipse cx={x} cy={y - 2} rx="13" ry="4.6" fill="#d9a460" />
              {[[-5, -3], [4, -2], [0, 1]].map(([dx, dy], k) => <ellipse key={k} cx={x + dx} cy={y + dy - 2} rx="2.2" ry="1.4" fill="#4a2a14" />)}</g>
          ))}
        </g>
      )}
    </svg>
  );
}

function OvenView() {
  const [item, setItem] = useState(OVEN_ITEMS[0]);
  const [elapsed, setElapsed] = useState(0); // seconds of the fast-forwarded bake (24s total)
  useEffect(() => { setElapsed(0); }, [item]);
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => Math.min(24, e + 0.5)), 500);
    return () => clearInterval(t);
  }, [item]);
  const done = elapsed >= 24;
  const left = Math.ceil(item.minutes * (1 - elapsed / 24));
  return (
    <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>Oven</div>
      <div className="stay-white" style={{ ...pill, padding: '7px 18px', fontSize: 14, fontWeight: 700 }}>
        {done ? `${item.name} is ready` : `Baking ${item.name.toLowerCase()} at ${item.temp} C`}
      </div>
      <div style={{ width: '100%', background: 'linear-gradient(180deg,#9aa0b3,#5a5f72 40%,#3a3e50)', borderRadius: 18, padding: 18, boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 2px 0 rgba(255,255,255,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 30, height: 30, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #d8dce8, #6a6f84)', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />)}
          <div className="stay-white" style={{ background: '#0c0a18', border: '2px solid #2a2840', borderRadius: 8, padding: '6px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 20, letterSpacing: '0.1em', color: done ? '#8dff9c' : '#ff8a4a', textShadow: '0 0 8px currentColor' }}>
            {done ? 'DONE' : `${String(left).padStart(2, '0')}:00`}
          </div>
        </div>
        <div style={{ position: 'relative', height: 250, borderRadius: 12, background: '#12101c', border: '6px solid #20202e', overflow: 'hidden', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)' }}>
          <div style={{ position: 'absolute', inset: 0, background: done ? 'radial-gradient(circle at 50% 70%, rgba(255,200,120,0.5), rgba(40,20,10,0.9))' : 'radial-gradient(circle at 50% 80%, rgba(255,120,40,0.75), rgba(60,18,6,0.95))', animation: done ? 'none' : 'gp-glow 2.4s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', left: 10, right: 10, top: 18, height: 5, borderRadius: 3, background: done ? '#7a3a1a' : '#ff5a1a', boxShadow: done ? 'none' : '0 0 18px 4px rgba(255,90,20,0.85)', animation: done ? 'none' : 'gp-glow 1.8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 52, height: 4, background: '#9aa0b3', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 30, height: 4, background: '#9aa0b3', borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 54, width: 260, maxWidth: '80%', transform: 'translateX(-50%)', height: 130 }}>
            <OvenFood kind={item.kind} done={done} />
          </div>
          {!done && [0, 1, 2].map(i => <span key={i} style={{ position: 'absolute', bottom: 150, left: `${38 + i * 12}%`, width: 14, height: 36, borderRadius: 14, background: 'rgba(255,255,255,0.25)', filter: 'blur(5px)', animation: `gp-steam 3s ease-in ${i * 0.9}s infinite` }} />)}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 35%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ height: 10, margin: '14px 40px 0', borderRadius: 6, background: 'linear-gradient(180deg,#d8dce8,#7a7f94)' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {OVEN_ITEMS.map(o => (
          <button key={o.id} onClick={() => setItem(o)} className="stay-white" style={{ ...btnPill, background: o.id === item.id ? 'rgba(139,92,255,0.85)' : pill.background }}>{o.name}</button>
        ))}
      </div>
    </div>
  );
}

// ── stove ────────────────────────────────────────────────────────────────────
function Vessel({ dish, stage, done }) {
  return (
    <svg viewBox="0 0 220 140" width="100%" style={{ maxWidth: 360, display: 'block', overflow: 'visible' }}>
      <ellipse cx="110" cy="128" rx="80" ry="8" fill="rgba(0,0,0,0.4)" />
      {/* burner + flames */}
      <rect x="70" y="108" width="80" height="14" rx="5" fill="#2a2835" />
      {!done && Array.from({ length: 9 }).map((_, i) => (
        <ellipse key={i} cx={78 + i * 8} cy="104" rx="3.4" ry={9 + (i % 3) * 3} fill={i % 2 ? '#4f9bff' : '#7fc4ff'} style={{ transformOrigin: `${78 + i * 8}px 112px`, animation: `gp-flame ${0.5 + (i % 3) * 0.15}s ease-in-out infinite` }} />
      ))}
      {dish.vessel === 'pot' && (<>
        <path d="M60 50 L160 50 L154 104 Q154 108 150 108 L70 108 Q66 108 66 104 Z" fill="#cfd3de" stroke="#7a7f94" strokeWidth="2" />
        <ellipse cx="110" cy="50" rx="50" ry="9" fill="#9aa0b3" stroke="#7a7f94" strokeWidth="2" />
        <ellipse cx="110" cy="52" rx="44" ry="6.5" fill={dish.fill} style={{ opacity: stage === 0 ? 0.35 : 1, transition: 'opacity .6s' }} />
        <rect x="46" y="62" width="16" height="6" rx="3" fill="#3a3e50" /><rect x="158" y="62" width="16" height="6" rx="3" fill="#3a3e50" />
      </>)}
      {dish.vessel === 'pan' && (<>
        <path d="M54 70 L166 70 L158 100 Q156 106 150 106 L70 106 Q64 106 62 100 Z" fill="#3a3e50" stroke="#1a1c28" strokeWidth="2" />
        <ellipse cx="110" cy="70" rx="56" ry="10" fill="#22242f" stroke="#1a1c28" strokeWidth="2" />
        <ellipse cx="110" cy="72" rx="48" ry="7" fill={dish.fill} style={{ opacity: stage === 0 ? 0.3 : 1, transition: 'opacity .6s' }} />
        <rect x="164" y="74" width="46" height="8" rx="4" fill="#22242f" />
      </>)}
      {dish.vessel === 'tawa' && (<>
        <ellipse cx="110" cy="92" rx="68" ry="12" fill="#22242f" stroke="#12131a" strokeWidth="2" />
        <ellipse cx="110" cy="90" rx="58" ry="8.5" fill="#2d2f3d" />
        <rect x="170" y="88" width="44" height="7" rx="3.5" fill="#12131a" />
        {stage >= 1 && <ellipse cx="110" cy="88" rx={36 + stage * 4} ry={6 + stage} fill={dish.fill} style={{ transition: 'all .6s' }} />}
      </>)}
      {/* bubbles + sizzle */}
      {!done && stage >= 1 && Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} cx={84 + i * 10} cy={dish.vessel === 'pot' ? 50 : dish.vessel === 'pan' ? 68 : 86} r={2.6 + (i % 3)} fill={dish.bubble} style={{ animation: `gp-bubble ${0.9 + (i % 3) * 0.3}s ease-out ${i * 0.17}s infinite` }} />
      ))}
      {/* steam */}
      {!done && stage >= 1 && Array.from({ length: 4 }).map((_, i) => (
        <ellipse key={i} cx={90 + i * 14} cy={dish.vessel === 'pot' ? 42 : 60} rx="6" ry="12" fill="rgba(255,255,255,0.4)" style={{ filter: 'blur(4px)', animation: `gp-steam 2.6s ease-in ${i * 0.6}s infinite` }} />
      ))}
    </svg>
  );
}

function ServedPlate({ dish }) {
  return (
    <svg viewBox="0 0 200 130" width="100%" style={{ maxWidth: 320, display: 'block', animation: 'gp-pop .5s ease-out' }}>
      <ellipse cx="100" cy="112" rx="84" ry="9" fill="rgba(0,0,0,0.4)" />
      {dish.plate === 'cup' ? (<>
        <path d="M64 50 L136 50 L128 104 Q126 110 120 110 L80 110 Q74 110 72 104 Z" fill="#f4f1e8" stroke="#bfb8a4" strokeWidth="2" />
        <path d="M136 62 q22 0 22 20 q0 18 -26 18" fill="none" stroke="#f4f1e8" strokeWidth="9" /><ellipse cx="100" cy="52" rx="36" ry="7" fill={dish.done} />
        {[0, 1, 2].map(i => <ellipse key={i} cx={86 + i * 14} cy="34" rx="5" ry="12" fill="rgba(255,255,255,0.45)" style={{ filter: 'blur(3px)', animation: `gp-steam 2.4s ease-in ${i * 0.7}s infinite` }} />)}
      </>) : (<>
        <ellipse cx="100" cy="86" rx="82" ry="20" fill="#f4f1e8" stroke="#bfb8a4" strokeWidth="2" />
        <ellipse cx="100" cy="84" rx="66" ry="14" fill="#e8e3d4" />
        {dish.plate === 'bowl' && <ellipse cx="100" cy="76" rx="44" ry="14" fill={dish.done} />}
        {dish.plate === 'roti' && (<><ellipse cx="100" cy="80" rx="52" ry="12" fill={dish.done} /><circle cx="80" cy="78" r="3" fill="#8a5a24" /><circle cx="108" cy="82" r="3.4" fill="#8a5a24" /><circle cx="124" cy="77" r="2.6" fill="#8a5a24" /></>)}
        {dish.plate === 'flat' && <ellipse cx="100" cy="80" rx="50" ry="11" fill={dish.done} />}
        {[0, 1, 2].map(i => <ellipse key={i} cx={84 + i * 16} cy="52" rx="5" ry="13" fill="rgba(255,255,255,0.45)" style={{ filter: 'blur(3px)', animation: `gp-steam 2.4s ease-in ${i * 0.7}s infinite` }} />)}
      </>)}
    </svg>
  );
}

function StoveView() {
  const [dish, setDish] = useState(null);
  const [stage, setStage] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!dish) return undefined;
    setStage(0); setTick(0);
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [dish]);
  useEffect(() => { if (dish) setStage(Math.min(dish.steps.length, Math.floor(tick / 4))); }, [tick, dish]);
  if (!dish) {
    return (
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div className="stay-white" style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>Stove</div>
        <div className="stay-white" style={{ textAlign: 'center', fontSize: 13, opacity: 0.7, margin: '2px 0 16px' }}>What shall we cook?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {DISHES.map(d => (
            <button key={d.id} onClick={() => setDish(d)} className="stay-white" style={{ ...pill, borderRadius: 14, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${shade(d.done, 40)}, ${shade(d.done, -40)})`, boxShadow: '0 3px 6px rgba(0,0,0,0.5)' }} />
              <span style={{ fontSize: 14, fontWeight: 800 }}>{d.name}</span>
              <span style={{ fontSize: 11, opacity: 0.65, textTransform: 'capitalize' }}>{d.vessel === 'tawa' ? 'On the tawa' : d.vessel === 'pan' ? 'In the kadhai' : 'In the pot'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const done = stage >= dish.steps.length;
  return (
    <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <button onClick={() => setDish(null)} className="stay-white" style={{ ...btnPill, alignSelf: 'flex-start' }}><ArrowLeft size={15} /> Choose another dish</button>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>{dish.name}</div>
      <div style={{ width: '100%', borderRadius: 18, padding: '18px 12px 10px', background: 'linear-gradient(180deg,#2a2840,#14121f)', boxShadow: '0 30px 70px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', minHeight: 190, alignItems: 'center' }}>
        {done ? <ServedPlate dish={dish} /> : <Vessel dish={dish} stage={stage} done={false} />}
      </div>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (tick / (dish.steps.length * 4)) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#ffb347,#ff5a1a)', transition: 'width 1s linear' }} />
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dish.steps.map((s, i) => (
          <div key={s} className="stay-white" style={{ ...pill, borderRadius: 12, padding: '8px 14px', fontSize: 14, fontWeight: 600, opacity: i < stage ? 0.55 : i === stage ? 1 : 0.35, border: i === stage && !done ? '1px solid #ffb347' : pill.border, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: i < stage ? '#34b36a' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flex: 'none' }}>{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      {done && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="stay-white" style={{ fontWeight: 800, fontSize: 16 }}>{dish.name} is ready</span>
          <button onClick={() => { setDish(null); }} className="stay-white" style={btnPill}><RotateCcw size={14} /> Cook something else</button>
        </div>
      )}
    </div>
  );
}

export default function PropViewer({ kind, arg, onClose }) {
  const [book, setBook] = useState(null);
  useEscape(onClose);
  return createPortal(
    <div style={overlay} onClick={onClose}>
      <style>{CSS}</style>
      <button onClick={onClose} className="stay-white" style={closeBtn} title="Close"><X size={20} /></button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {kind === 'books' && (book ? <BookReader book={book} onBack={() => setBook(null)} /> : <BookshelfView shelfId={arg} onPick={setBook} />)}
        {kind === 'fridge' && <FridgeView />}
        {kind === 'oven' && <OvenView />}
        {kind === 'stove' && <StoveView />}
      </div>
    </div>,
    document.body,
  );
}
