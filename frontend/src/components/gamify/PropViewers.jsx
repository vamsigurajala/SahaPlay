import { Component, lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, ArrowLeft, RotateCcw,
  Globe, ExternalLink, ArrowRight, Search, Trophy,
  Brain, Compass, Flame, Gamepad2, Heart, Sparkles,
  HelpCircle, Check, Clock, RefreshCw, Shuffle, Lightbulb,
  Maximize2
} from 'lucide-react';
import { GENRES, SHELVES, FRIDGE_SHELVES, FRIDGE_SHELVES_UP, DISHES, DISHES_UP, OVEN_ITEMS, OVEN_ITEMS_UP } from '../../data/gamifyBooks';
import { WARDROBES, COSMETICS, GARDEN } from '../../data/gamifyItems';
import { useBookCover, preloadImage, coverUrl } from '../../data/bookCovers';
import { useWikiImage } from '../../data/wikiImages';
import { FOOD_WIKI } from '../../data/foodWiki';
import { WARDROBE_PHOTOS, COSMETICS_PHOTOS, GARDEN_PHOTOS } from '../../data/gamifyManifest';

const SpaceViewer = lazy(() => import('./SpaceViewer'));
import { ClothArt, BeautyArt, PlantArt } from './viewerArt';

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

// A cover: the real one from Open Library when found, otherwise a drawn cover in
// the genre colours. The drawn cover always sits underneath so nothing flashes.
function BookCover({ book, size = 'M', big = false }) {
  const g = GENRES[book.genre];
  const url = useBookCover(book, size);
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(false); }, [url]);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 4, overflow: 'hidden', background: `linear-gradient(135deg, ${g.a}, ${g.b})`, color: g.ink, fontFamily: 'Georgia, serif', boxShadow: 'inset 0 0 0 3px rgba(255,215,120,0.4)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: big ? 28 : 8, gap: big ? 14 : 5 }}>
        <GenreIcon genre={book.genre} size={big ? 80 : 34} color={g.ink} />
        <div style={{ fontWeight: 700, fontSize: big ? 30 : 12.5, lineHeight: 1.2 }}>{book.title}</div>
        <div style={{ fontStyle: 'italic', fontSize: big ? 17 : 10.5, opacity: 0.85 }}>{book.author}</div>
      </div>
      {url && (
        <img
          src={url} alt={`${book.title} cover`} loading="lazy" referrerPolicy="no-referrer"
          onLoad={e => setOk(e.currentTarget.naturalWidth > 40)} onError={() => setOk(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: ok ? 1 : 0, transition: 'opacity .3s' }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: 'linear-gradient(90deg, rgba(0,0,0,0.4), rgba(255,255,255,0.12) 60%, transparent)' }} />
    </div>
  );
}

function BookCard({ book, onPick }) {
  return (
    <button
      onClick={() => onPick(book)}
      title={`${book.title} - ${book.author}`}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#fff', textAlign: 'center', transition: 'transform .16s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; try { const id = JSON.parse(localStorage.getItem('sahaplay-book-covers-v1') || '{}')[book.id]; if (id) preloadImage(coverUrl(id, 'L')); } catch { /* storage blocked */ } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ width: '100%', aspectRatio: '2 / 3', boxShadow: '0 8px 14px rgba(0,0,0,0.6)' }}><BookCover book={book} /></div>
      <div className="stay-white" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, maxWidth: '100%' }}>{book.title}</div>
      <div className="stay-white" style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.2, marginTop: -3 }}>{book.author}</div>
    </button>
  );
}

function BookshelfView({ shelfId, onPick }) {
  const shelf = SHELVES[shelfId] || SHELVES.default;
  const [genre, setGenre] = useState('all');
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const perRow = w < 520 ? 3 : w < 860 ? 4 : 6;
  const genres = [...new Set(shelf.books.map(b => b.genre))];
  const books = genre === 'all' ? shelf.books : shelf.books.filter(b => b.genre === genre);
  const rows = useMemo(() => {
    const out = [];
    for (let i = 0; i < books.length; i += perRow) out.push(books.slice(i, i + perRow));
    return out;
  }, [books, perRow]);
  const chip = (active) => ({ ...pill, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: active ? 'rgba(255,255,255,0.22)' : pill.background });
  return (
    <div style={{ width: '100%', maxWidth: 980 }}>
      <div className="stay-white" style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>{shelf.title}</div>
      <div className="stay-white" style={{ textAlign: 'center', fontSize: 13, opacity: 0.7, margin: '2px 0 12px' }}>{books.length} books - tap a cover to open it</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
        <button className="stay-white" style={chip(genre === 'all')} onClick={() => setGenre('all')}>All</button>
        {genres.map(g => (
          <button key={g} className="stay-white" style={chip(genre === g)} onClick={() => setGenre(g)}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: GENRES[g].a }} />{GENRES[g].label}
          </button>
        ))}
      </div>
      <div style={{ background: 'linear-gradient(180deg,#4a3322,#2a1d12)', borderRadius: 14, padding: '14px 14px 6px', boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 5px #5a4030' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perRow}, 1fr)`, gap: 14, padding: '14px 12px 12px', background: 'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.2))', borderRadius: 5, alignItems: 'start' }}>
              {row.map(b => <BookCard key={b.id} book={b} onPick={onPick} />)}
            </div>
            <div style={{ height: 14, background: 'linear-gradient(180deg,#8a5e3a,#4a3322)', borderRadius: 3, boxShadow: '0 5px 9px rgba(0,0,0,0.55)' }} />
          </div>
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
          <div style={{ flex: 1, minHeight: 0 }}><BookCover book={book} size="L" big /></div>
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

// A real photograph (curated self-hosted with Wikipedia fallback) when one is found, otherwise the drawing.
function FoodPhoto({ title, fallback, label }) {
  const url = useWikiImage(title, label);
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(false); }, [url]);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: ok ? 0 : 1, transition: 'opacity .3s' }}>{fallback}</div>
      {url && (
        <img
          src={url} alt={label || ''} referrerPolicy="no-referrer" loading="lazy"
          onLoad={() => setOk(true)} onError={() => setOk(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, boxShadow: '0 6px 12px rgba(0,0,0,0.35)', opacity: ok ? 1 : 0, transition: 'opacity .3s' }}
        />
      )}
      {url && ok && label && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 2px 3px', borderRadius: '0 0 10px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,0.78))', color: '#fff', fontSize: 9.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>{label}</div>}
    </div>
  );
}

function FridgeView({ set }) {
  const SHELVES_IN = set === 'up' ? FRIDGE_SHELVES_UP : FRIDGE_SHELVES;
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
          {SHELVES_IN.map((shelf, si) => (
            <div key={si} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 112, borderBottom: '6px solid rgba(255,255,255,0.95)', boxShadow: '0 7px 9px -6px rgba(0,0,0,0.3)', marginBottom: 8 }}>
              {shelf.map(it => (
                <div
                  key={it.name}
                  onMouseEnter={() => setHover(it.name)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setPinned(p => (p === it.name ? null : it.name))}
                  style={{ width: '17.5%', height: it.kind === 'block' || it.kind === 'eggs' ? '78%' : '96%', cursor: 'pointer', transition: 'transform .15s', transform: shown === it.name ? 'translateY(-7px) scale(1.1)' : 'none', filter: shown === it.name ? 'drop-shadow(0 8px 8px rgba(0,0,0,0.4))' : 'none' }}
                >
                  <FoodPhoto title={FOOD_WIKI[it.name]} label={it.name} fallback={<ItemArt kind={it.kind} color={it.color} accent={it.accent} label={it.label} />} />
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
      {kind === 'bread' && (
        <g>
          <rect x="30" y="52" width="100" height="26" rx="12" fill="#c98a3a" />
          <rect x="34" y="50" width="92" height="14" rx="7" fill="#e0a850" />
          {[48, 66, 84, 102].map(x => <path key={x} d={`M${x} 52 l8 10`} stroke="#8a5a1a" strokeWidth="2" />)}
          {[[46, 56], [70, 58], [92, 56], [112, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#6a9a3a" />)}
        </g>
      )}
      {kind === 'brownies' && (
        <g>
          {[0, 1, 2].map(i => (
            <g key={i}><rect x={34 + i * 32} y="56" width="28" height="22" rx="3" fill="#4a2a18" /><rect x={34 + i * 32} y="56" width="28" height="7" rx="3" fill="#6a3e24" /><circle cx={42 + i * 32} cy="68" r="2" fill="#8a5a3a" /><circle cx={52 + i * 32} cy="72" r="1.6" fill="#8a5a3a" /></g>
          ))}
        </g>
      )}
      {kind === 'naan' && (
        <g>
          <path d="M28 66 Q40 38 82 40 Q124 42 132 68 Q110 82 70 80 Q40 80 28 66Z" fill="#e8c080" />
          <path d="M28 66 Q40 38 82 40" fill="none" stroke="#c09050" strokeWidth="2" />
          {[[56, 56], [78, 52], [100, 58], [70, 68], [96, 70], [48, 68]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="5" ry="3" fill="#a8683a" opacity="0.8" />)}
          <ellipse cx="82" cy="60" rx="14" ry="5" fill="#fff0b0" opacity="0.55" />
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

function OvenView({ set }) {
  const ITEMS = set === 'up' ? OVEN_ITEMS_UP : OVEN_ITEMS;
  const [item, setItem] = useState(ITEMS[0]);
  const photo = useWikiImage(FOOD_WIKI[item.name], item.name);
  const [elapsed, setElapsed] = useState(0); // seconds of the fast-forwarded bake (12s total)
  useEffect(() => { setElapsed(0); }, [item]);
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => Math.min(12, e + 0.5)), 500);
    return () => clearInterval(t);
  }, [item]);
  const done = elapsed >= 12;
  const left = Math.ceil(item.minutes * (1 - elapsed / 12));
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
            {photo ? (
              <div style={{ width: 150, height: 150, margin: '-10px auto 0', borderRadius: '50%', overflow: 'hidden', border: '5px solid #20202e', boxShadow: '0 0 40px rgba(255,150,60,0.55)' }}>
                <img src={photo} alt={item.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: done ? 'none' : `sepia(0.45) brightness(${0.7 + (elapsed / 12) * 0.3}) blur(${(1 - elapsed / 12) * 5}px)`, transition: 'filter .6s linear' }} />
              </div>
            ) : <OvenFood kind={item.kind} done={done} />}
          </div>
          {!done && [0, 1, 2].map(i => <span key={i} style={{ position: 'absolute', bottom: 150, left: `${38 + i * 12}%`, width: 14, height: 36, borderRadius: 14, background: 'rgba(255,255,255,0.25)', filter: 'blur(5px)', animation: `gp-steam 3s ease-in ${i * 0.9}s infinite` }} />)}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 35%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ height: 10, margin: '14px 40px 0', borderRadius: 6, background: 'linear-gradient(180deg,#d8dce8,#7a7f94)' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {ITEMS.map(o => (
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

function StoveView({ set }) {
  const MENU = set === 'up' ? DISHES_UP : DISHES;
  const [dish, setDish] = useState(null);
  const [stage, setStage] = useState(0);
  const [tick, setTick] = useState(0);
  const photo = useWikiImage(dish ? FOOD_WIKI[dish.name] : null, dish?.name);
  useEffect(() => {
    if (!dish) return undefined;
    setStage(0); setTick(0);
    const t = setInterval(() => setTick(x => x + 1), 600);
    return () => clearInterval(t);
  }, [dish]);
  useEffect(() => { if (dish) setStage(Math.min(dish.steps.length, Math.floor(tick / 3))); }, [tick, dish]);
  if (!dish) {
    return (
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div className="stay-white" style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>Stove</div>
        <div className="stay-white" style={{ textAlign: 'center', fontSize: 13, opacity: 0.7, margin: '2px 0 16px' }}>What shall we cook?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {MENU.map(d => (
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
  const prog = Math.min(1, tick / (dish.steps.length * 3));
  const reveal = photo && (
    <div style={{ width: done ? 260 : 200, height: done ? 260 : 200, borderRadius: '50%', overflow: 'hidden', border: '8px solid #f4f1e8', boxShadow: '0 16px 34px rgba(0,0,0,0.6)', position: 'relative', flex: 'none', animation: done ? 'gp-pop .5s ease-out' : 'none' }}>
      <img src={photo} alt={dish.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: done ? 'scale(1)' : `scale(${1.2 - prog * 0.2})`, filter: done ? 'none' : `blur(${(1 - prog) * 12}px) grayscale(${(1 - prog) * 0.9}) brightness(${0.6 + prog * 0.4})`, transition: 'filter .6s linear, transform .6s linear' }} />
      {[0, 1, 2].map(i => <span key={i} style={{ position: 'absolute', top: 10, left: `${30 + i * 18}%`, width: 14, height: 36, borderRadius: 14, background: 'rgba(255,255,255,0.35)', filter: 'blur(5px)', animation: `gp-steam 2.6s ease-in ${i * 0.7}s infinite` }} />)}
    </div>
  );
  return (
    <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <button onClick={() => setDish(null)} className="stay-white" style={{ ...btnPill, alignSelf: 'flex-start' }}><ArrowLeft size={15} /> Choose another dish</button>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>{dish.name}</div>
      <div style={{ width: '100%', borderRadius: 18, padding: '18px 12px 10px', background: 'linear-gradient(180deg,#2a2840,#14121f)', boxShadow: '0 30px 70px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', minHeight: 190, alignItems: 'center' }}>
        {done ? (reveal || <ServedPlate dish={dish} />) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <div style={{ flex: '1 1 220px', maxWidth: 300 }}><Vessel dish={dish} stage={stage} done={false} /></div>
            {reveal}
          </div>
        )}
      </div>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, prog * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#ffb347,#ff5a1a)', transition: 'width .6s linear' }} />
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

// ── wardrobe, dressing table, garden ─────────────────────────────────────────
function ItemCard({ item, Art, picked, onPick, hang, category = 'wardrobe' }) {
  const photo = category === 'cosmetics' ? COSMETICS_PHOTOS[item.name] : WARDROBE_PHOTOS[item.name];
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      onClick={() => onPick(item.name)}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: '#fff',
        transition: 'transform .15s',
        transform: picked ? 'translateY(-6px) scale(1.06)' : 'none',
        filter: picked ? 'drop-shadow(0 8px 8px rgba(0,0,0,0.45))' : 'none'
      }}
      onMouseEnter={() => onPick(item.name, true)}
      onMouseLeave={() => onPick(null, true)}
    >
      {hang && <div style={{ width: 3, height: 10, background: '#b8bccb', borderRadius: 2 }} />}
      <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.16)', position: 'relative' }}>
        {photo && !imgErr ? (
          <img
            src={photo}
            alt={item.name}
            loading="lazy"
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Art kind={item.kind} color={item.color} accent={item.accent} />
        )}
      </div>
      <div className="stay-white" style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', maxWidth: 96, lineHeight: 1.2 }}>
        {item.name}
      </div>
    </button>
  );
}

function SectionGrid({ sections, Art, tone, category = 'wardrobe' }) {
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  const shown = hover || pinned;
  const pick = (name, isHover) => { if (isHover) setHover(name); else setPinned(p => (p === name ? null : name)); };
  return (
    <>
      <div className="stay-white" style={{ ...pill, minHeight: 36, padding: '7px 20px', margin: '10px 0 14px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        {shown || 'Hover or tap an item'}
      </div>
      <div style={{ width: '100%', background: tone.body, borderRadius: 16, padding: '16px 14px 8px', boxShadow: `0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 6px ${tone.rim}` }}>
        {sections.map(sec => (
          <div key={sec.label} style={{ marginBottom: 12 }}>
            <div className="stay-white" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7, margin: '0 4px 4px' }}>{sec.label}</div>
            {sec.label === 'Hanging' && <div style={{ height: 5, borderRadius: 3, background: 'linear-gradient(180deg,#e0e4f0,#8a90a8)', margin: '0 2px' }} />}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px', justifyContent: 'center', padding: '4px 4px 12px', background: 'rgba(0,0,0,0.22)', borderRadius: 8, borderBottom: `7px solid ${tone.shelf}` }}>
              {sec.items.map(it => (
                <ItemCard
                  key={it.name}
                  item={it}
                  Art={Art}
                  category={category}
                  picked={shown === it.name}
                  onPick={pick}
                  hang={sec.label === 'Hanging'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function WardrobeView({ id }) {
  const data = WARDROBES[id] || WARDROBES['wd-a'];
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOpen(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>{data.title}</div>
      <div style={{ position: 'relative', width: '100%', perspective: 1600 }}>
        <SectionGrid sections={data.sections} Art={ClothArt} category="wardrobe" tone={{ body: 'linear-gradient(180deg,#5a4070,#2e2040)', rim: '#7a5a96', shelf: '#8a6a4a' }} />
        {[['left', -1], ['right', 1]].map(([side, dir]) => (
          <div key={side} style={{
            position: 'absolute', top: 56, bottom: 0, [side]: 0, width: '50%', transformOrigin: `${side} center`,
            transform: open ? `rotateY(${dir * -110}deg)` : 'rotateY(0)', background: 'linear-gradient(135deg,#6a4c86,#3a2850)', borderRadius: 16, boxShadow: '0 0 0 2px #8a6aa6',
            pointerEvents: 'none', opacity: open ? 0 : 1, transitionProperty: 'transform, opacity', transitionDuration: '1s, .5s', transitionDelay: '0s, .6s', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
          }}>
            <div style={{ position: 'absolute', top: '40%', [dir > 0 ? 'left' : 'right']: 12, width: 8, height: 60, borderRadius: 4, background: '#d9c48a' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CosmeticsView() {
  return (
    <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>{COSMETICS.title}</div>
      <div style={{ width: 150, height: 190, marginTop: 10, borderRadius: '50% 50% 46% 46%', border: '9px solid #c9a77a', background: 'radial-gradient(circle at 35% 28%, #ffffff, #cfe2f6 55%, #8fb0d8)', boxShadow: '0 20px 40px rgba(0,0,0,0.55), inset 0 0 30px rgba(255,255,255,0.7)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, left: 20, width: 36, height: 260, background: 'rgba(255,255,255,0.45)', transform: 'rotate(22deg)' }} />
      </div>
      <SectionGrid sections={COSMETICS.sections} Art={BeautyArt} category="cosmetics" tone={{ body: 'linear-gradient(180deg,#6a3a56,#331828)', rim: '#a86a8a', shelf: '#c9a77a' }} />
    </div>
  );
}

function GardenPlantCard({ item, on, onPick, onHover }) {
  const photo = GARDEN_PHOTOS[item.name];
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      onClick={() => onPick(p => (p === item.name ? null : item.name))}
      onMouseEnter={() => onHover(item.name)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: on ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.24)',
        border: on ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.16)',
        borderRadius: 12, padding: '10px 8px 8px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 108,
        color: '#fff', transition: 'transform .15s', transform: on ? 'translateY(-5px)' : 'none'
      }}
    >
      <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.14)' }}>
        {photo && !imgErr ? (
          <img
            src={photo}
            alt={item.name}
            loading="lazy"
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <PlantArt kind={item.kind} color={item.color} accent={item.accent} />
        )}
      </div>
      <div className="stay-white" style={{ fontSize: 13, fontWeight: 800 }}>{item.name}</div>
      {item.local && item.local !== item.name && <div className="stay-white" style={{ fontSize: 11, opacity: 0.65 }}>{item.local}</div>}
    </button>
  );
}

function GardenView({ arg }) {
  const [tab, setTab] = useState(GARDEN[arg] ? arg : 'flowers');
  const data = GARDEN[tab];
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { setPinned(null); setHover(null); }, [tab]);
  const shownName = hover || pinned;
  const shown = data.items.find(i => i.name === shownName);
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} className="stay-white" style={{ ...btnPill, background: tab === id ? 'rgba(255,255,255,0.24)' : pill.background }}>{label}</button>
  );
  return (
    <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="stay-white" style={{ fontSize: 22, fontWeight: 800 }}>{data.title}</div>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap', justifyContent: 'center' }}>
        {tabBtn('flowers', 'Flowers')}{tabBtn('veg', 'Vegetables')}{tabBtn('herbs', 'Herbs')}
      </div>
      <div className="stay-white" style={{ ...pill, borderRadius: 14, minHeight: 54, padding: '8px 20px', margin: '0 0 14px', fontSize: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', maxWidth: 520 }}>
        {shown ? (<><div style={{ fontWeight: 800, fontSize: 16 }}>{shown.name}{shown.local && shown.local !== shown.name ? ` (${shown.local})` : ''}</div><div style={{ opacity: 0.8, fontSize: 13 }}>{shown.note}</div></>) : 'Hover or tap a plant to see its name'}
      </div>
      <div style={{ width: '100%', background: 'linear-gradient(180deg,#27502f,#14301c)', borderRadius: 16, padding: 14, boxShadow: '0 30px 70px rgba(0,0,0,0.6), inset 0 0 0 6px #3f7a4a', display: 'flex', flexWrap: 'wrap', gap: '12px 12px', justifyContent: 'center' }}>
        {data.items.map(it => (
          <GardenPlantCard
            key={it.name}
            item={it}
            on={shownName === it.name}
            onPick={setPinned}
            onHover={setHover}
          />
        ))}
      </div>
    </div>
  );
}

// ── monitor browser launcher ──────────────────────────────────────────────────
function MonitorBrowserView({ onClose }) {
  const [url, setUrl] = useState('');
  const [lastLaunched, setLastLaunched] = useState(null);

  const bookmarks = [
    { label: 'Google Search', url: 'https://www.google.com', desc: 'Search the web' },
    { label: 'YouTube', url: 'https://www.youtube.com', desc: 'Stream videos & music' },
    { label: 'GitHub', url: 'https://github.com', desc: 'Code repositories & collaboration' },
    { label: 'Wikipedia', url: 'https://www.wikipedia.org', desc: 'The free encyclopedia' },
    { label: 'Reddit', url: 'https://www.reddit.com', desc: 'Community discussions & news' },
    { label: 'Chess.com', url: 'https://www.chess.com', desc: 'Play chess online' },
  ];

  const handleLaunch = (targetUrl) => {
    let raw = (targetUrl || url).trim();
    if (!raw) return;
    let finalUrl = raw;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    setLastLaunched(finalUrl);
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLaunch();
  };

  return (
    <div style={{ width: '100%', maxWidth: 740, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(38,28,74,0.95), rgba(12,10,24,0.98))',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: 22,
        boxShadow: '0 30px 80px rgba(0,0,0,0.75), 0 0 50px rgba(139, 92, 246, 0.15)',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Title Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.03em' }}>
              Study Room Workstation Browser
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a78bfa', fontWeight: 600, background: 'rgba(139, 92, 246, 0.15)', padding: '4px 10px', borderRadius: 99 }}>
            <Globe size={13} />
            <span>Ready</span>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
            Enter any website address to launch or redirect. The destination will open in a secure browser window.
          </div>

          {/* Address input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              flex: '1 1 320px',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1.5px solid rgba(139, 92, 246, 0.45)',
              borderRadius: 14,
              padding: '10px 16px',
            }}>
              <Search size={18} style={{ color: '#8b5cf6', flexShrink: 0 }} />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter any URL (e.g. google.com, youtube.com, github.com)..."
                autoFocus
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: 14.5,
                  fontWeight: 500,
                }}
              />
              {url && (
                <button
                  onClick={() => setUrl('')}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              onClick={() => handleLaunch()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '12px 22px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(124, 58, 237, 0.45)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>Visit URL</span>
              <ExternalLink size={16} />
            </button>
          </div>

          {lastLaunched && (
            <div style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} />
              <span>Redirected to <strong>{lastLaunched}</strong> in a new tab.</span>
            </div>
          )}

          {/* Bookmarks */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Quick Launch Bookmarks
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
              {bookmarks.map((site) => (
                <div
                  key={site.url}
                  onClick={() => handleLaunch(site.url)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 13,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all .18s ease-out',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.18)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.45)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(139, 92, 246, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', flexShrink: 0 }}>
                    <Globe size={18} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {site.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.45)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {site.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── interactive puzzle center ────────────────────────────────────────────────
function SlidingTilePuzzle() {
  const [tiles, setTiles] = useState([1, 2, 3, 4, 5, 6, 7, 8, 0]);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const shuffle = () => {
    let arr = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    let zeroIdx = 8;
    for (let i = 0; i < 75; i++) {
      const row = Math.floor(zeroIdx / 3);
      const col = zeroIdx % 3;
      const neighbors = [];
      if (row > 0) neighbors.push(zeroIdx - 3);
      if (row < 2) neighbors.push(zeroIdx + 3);
      if (col > 0) neighbors.push(zeroIdx - 1);
      if (col < 2) neighbors.push(zeroIdx + 1);
      const nextIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
      arr[zeroIdx] = arr[nextIdx];
      arr[nextIdx] = 0;
      zeroIdx = nextIdx;
    }
    setTiles([...arr]);
    setMoves(0);
    setIsWon(false);
    setSeconds(0);
  };

  useEffect(() => {
    shuffle();
  }, []);

  useEffect(() => {
    if (isWon) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isWon]);

  const handleTileClick = (index) => {
    if (isWon) return;
    const zeroIdx = tiles.indexOf(0);
    const row = Math.floor(index / 3);
    const col = index % 3;
    const zRow = Math.floor(zeroIdx / 3);
    const zCol = zeroIdx % 3;
    if (Math.abs(row - zRow) + Math.abs(col - zCol) === 1) {
      const next = [...tiles];
      next[zeroIdx] = next[index];
      next[index] = 0;
      setTiles(next);
      setMoves(m => m + 1);
      const solved = next.every((val, idx) => (idx === 8 ? val === 0 : val === idx + 1));
      if (solved) setIsWon(true);
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 330, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
        <div>Moves: <span style={{ color: '#a78bfa' }}>{moves}</span></div>
        <div>Time: <span style={{ color: '#a78bfa' }}>{formatTime(seconds)}</span></div>
        <button
          onClick={shuffle}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Shuffle size={12} />
          <span>Shuffle</span>
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        width: 320, height: 320, padding: 10,
        background: 'rgba(0, 0, 0, 0.4)', borderRadius: 16,
        border: '2px solid rgba(139, 92, 246, 0.35)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
      }}>
        {tiles.map((val, idx) => {
          if (val === 0) {
            return <div key={`empty-${idx}`} style={{ borderRadius: 12, background: 'rgba(0,0,0,0.25)' }} />;
          }
          return (
            <button
              key={val}
              onClick={() => handleTileClick(idx)}
              style={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.75), rgba(79,70,229,0.75))',
                color: '#ffffff',
                fontSize: 26,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
                transition: 'transform .1s ease-out, background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {val}
            </button>
          );
        })}
      </div>

      {isWon && (
        <div style={{
          marginTop: 10, padding: '12px 24px', borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.4))',
          border: '1.5px solid #10b981', display: 'flex', alignItems: 'center', gap: 10, color: '#34d399', fontWeight: 800, fontSize: 15
        }}>
          <Trophy size={20} />
          <span>Brilliant! You solved the puzzle in {moves} moves and {formatTime(seconds)}!</span>
        </div>
      )}
    </div>
  );
}

function MemoryMatchPuzzle() {
  const ICONS = [
    { id: 'brain', label: 'Logic', Icon: Brain, color: '#a855f7' },
    { id: 'compass', label: 'Explore', Icon: Compass, color: '#38bdf8' },
    { id: 'flame', label: 'Fire', Icon: Flame, color: '#f97316' },
    { id: 'game', label: 'Play', Icon: Gamepad2, color: '#10b981' },
    { id: 'heart', label: 'Heart', Icon: Heart, color: '#f43f5e' },
    { id: 'sparkles', label: 'Magic', Icon: Sparkles, color: '#eab308' },
  ];

  const createDeck = () => {
    const deck = [];
    ICONS.forEach(item => {
      deck.push({ uid: `${item.id}-1`, id: item.id, item });
      deck.push({ uid: `${item.id}-2`, id: item.id, item });
    });
    return deck.sort(() => Math.random() - 0.5);
  };

  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);

  const reset = () => {
    setCards(createDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  useEffect(() => {
    reset();
  }, []);

  const handleCardClick = (idx) => {
    if (flipped.length === 2 || flipped.includes(idx) || matched.includes(cards[idx].id)) return;
    const nextFlipped = [...flipped, idx];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = nextFlipped;
      if (cards[first].id === cards[second].id) {
        setMatched(m => [...m, cards[first].id]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 750);
      }
    }
  };

  const isWon = matched.length === ICONS.length && ICONS.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 360, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
        <div>Moves: <span style={{ color: '#a78bfa' }}>{moves}</span></div>
        <div>Matched: <span style={{ color: '#34d399' }}>{matched.length} / {ICONS.length}</span></div>
        <button
          onClick={reset}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RotateCcw size={12} />
          <span>Restart</span>
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
        width: 360, padding: 12,
        background: 'rgba(0, 0, 0, 0.4)', borderRadius: 16,
        border: '2px solid rgba(139, 92, 246, 0.35)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
      }}>
        {cards.map((card, idx) => {
          const isOpen = flipped.includes(idx) || matched.includes(card.id);
          const isMatched = matched.includes(card.id);
          const { Icon, color } = card.item;

          return (
            <button
              key={card.uid}
              onClick={() => handleCardClick(idx)}
              style={{
                height: 80,
                borderRadius: 12,
                border: isMatched ? '2px solid #10b981' : isOpen ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.14)',
                background: isOpen
                  ? (isMatched ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)')
                  : 'linear-gradient(135deg, rgba(30, 22, 54, 0.9), rgba(18, 14, 36, 0.9))',
                cursor: isOpen ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isMatched ? '0 0 16px rgba(16, 185, 129, 0.4)' : '0 4px 10px rgba(0,0,0,0.3)',
                transition: 'all .2s ease-out',
                transform: isOpen ? 'scale(1)' : 'scale(0.98)',
              }}
            >
              {isOpen ? (
                <Icon size={32} color={color} />
              ) : (
                <HelpCircle size={22} style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
            </button>
          );
        })}
      </div>

      {isWon && (
        <div style={{
          marginTop: 10, padding: '12px 24px', borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.4))',
          border: '1.5px solid #10b981', display: 'flex', alignItems: 'center', gap: 10, color: '#34d399', fontWeight: 800, fontSize: 15
        }}>
          <Trophy size={20} />
          <span>Superb! All card pairs matched in {moves} moves!</span>
        </div>
      )}
    </div>
  );
}

function WordScramblePuzzle() {
  const WORDS = [
    { word: 'STUDY', clue: 'Quiet room with desks, bookshelf, and beanbags' },
    { word: 'GUITAR', clue: 'Six-string acoustic instrument on the study wall' },
    { word: 'PUZZLE', clue: 'Game testing wit, pattern recognition, and logic' },
    { word: 'KEYBOARD', clue: 'Tactile typing hardware placed beside each monitor' },
    { word: 'MONITOR', clue: 'High-res display screen perched on every desk' },
    { word: 'CANVAS', clue: 'Framed oil artwork hanging in the living room' },
    { word: 'LIBRARY', clue: 'Shelves packed with classic and modern literature' },
  ];

  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [scramble, setScramble] = useState([]);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState(null); // 'correct' | 'wrong'
  const current = WORDS[index % WORDS.length];

  const setupWord = (w) => {
    const letters = w.word.split('').map((char, i) => ({ id: `${char}-${i}`, char, used: false }));
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    setScramble(letters);
    setGuess('');
    setStatus(null);
  };

  useEffect(() => {
    setupWord(current);
  }, [index]);

  const handleLetterClick = (item) => {
    if (item.used || status === 'correct') return;
    setGuess(g => g + item.char);
    setScramble(prev => prev.map(l => l.id === item.id ? { ...l, used: true } : l));
  };

  const handleBackspace = () => {
    if (!guess.length || status === 'correct') return;
    const lastChar = guess[guess.length - 1];
    setGuess(g => g.slice(0, -1));
    // Unmark first used match of this char
    let unmarked = false;
    setScramble(prev => prev.map(l => {
      if (!unmarked && l.used && l.char === lastChar) {
        unmarked = true;
        return { ...l, used: false };
      }
      return l;
    }));
  };

  const checkAnswer = () => {
    if (guess === current.word) {
      setStatus('correct');
      setStreak(s => s + 1);
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus(null), 1200);
    }
  };

  const nextWord = () => {
    setIndex(i => i + 1);
  };

  const giveHint = () => {
    if (status === 'correct') return;
    const targetChar = current.word[guess.length];
    if (!targetChar) return;
    const found = scramble.find(l => !l.used && l.char === targetChar);
    if (found) {
      handleLetterClick(found);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 420, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
        <div>Word: <span style={{ color: '#a78bfa' }}>{(index % WORDS.length) + 1} / {WORDS.length}</span></div>
        <div>Streak: <span style={{ color: '#f59e0b' }}>{streak}</span></div>
        <button
          onClick={giveHint}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Lightbulb size={12} color="#f59e0b" />
          <span>Hint</span>
        </button>
      </div>

      <div style={{
        width: '100%', maxWidth: 420, padding: '14px 18px',
        background: 'rgba(0, 0, 0, 0.4)', borderRadius: 16,
        border: '1.5px solid rgba(139, 92, 246, 0.35)',
        display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', textAlign: 'center' }}>
          Clue: &ldquo;{current.clue}&rdquo;
        </div>

        {/* Current Guess Slot */}
        <div style={{
          minHeight: 52, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'rgba(255, 255, 255, 0.05)', borderRadius: 12,
          padding: '6px 12px', border: status === 'correct' ? '2px solid #10b981' : status === 'wrong' ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'
        }}>
          {guess ? guess.split('').map((c, i) => (
            <span key={i} style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>{c}</span>
          )) : (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Tap letters below to spell word</span>
          )}
        </div>

        {/* Letter Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {scramble.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLetterClick(item)}
              disabled={item.used}
              style={{
                width: 44, height: 44, borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: item.used ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: item.used ? 'rgba(255,255,255,0.2)' : '#ffffff',
                fontSize: 18, fontWeight: 800, cursor: item.used ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: item.used ? 'none' : '0 4px 10px rgba(0,0,0,0.3)',
                transition: 'all .15s'
              }}
            >
              {item.char}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={handleBackspace}
            style={{ ...btnPill, padding: '7px 14px', fontSize: 12, background: 'rgba(255,255,255,0.08)' }}
          >
            Clear Last
          </button>
          {status !== 'correct' ? (
            <button
              onClick={checkAnswer}
              disabled={!guess}
              style={{
                ...btnPill,
                padding: '7px 20px',
                fontSize: 13,
                background: guess ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                border: 'none',
                opacity: guess ? 1 : 0.5,
              }}
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={nextWord}
              style={{
                ...btnPill,
                padding: '7px 20px',
                fontSize: 13,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                border: 'none',
              }}
            >
              <span>Next Word</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {status === 'correct' && (
        <div style={{
          padding: '10px 20px', borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.25)', border: '1.5px solid #10b981',
          color: '#34d399', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <Check size={18} />
          <span>Correct! That is {current.word}!</span>
        </div>
      )}
    </div>
  );
}

function PuzzleGameView() {
  const [tab, setTab] = useState('sliding');

  return (
    <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(38,28,74,0.95), rgba(12,10,24,0.98))',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: 22,
        boxShadow: '0 30px 80px rgba(0,0,0,0.75), 0 0 50px rgba(139, 92, 246, 0.15)',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        padding: '24px 22px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Gamepad2 size={24} style={{ color: '#c084fc' }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em' }}>
            Study Table Puzzle Lounge
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 18, textAlign: 'center' }}>
          Select a brain-teaser to play while relaxing at the study corner table.
        </div>

        {/* Tab selection */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setTab('sliding')}
            style={{
              ...btnPill,
              background: tab === 'sliding' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.06)',
              border: tab === 'sliding' ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
              fontSize: 13,
            }}
          >
            <span>8-Tile Slider</span>
          </button>
          <button
            onClick={() => setTab('memory')}
            style={{
              ...btnPill,
              background: tab === 'memory' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.06)',
              border: tab === 'memory' ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
              fontSize: 13,
            }}
          >
            <span>Memory Pairs</span>
          </button>
          <button
            onClick={() => setTab('word')}
            style={{
              ...btnPill,
              background: tab === 'word' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.06)',
              border: tab === 'word' ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
              fontSize: 13,
            }}
          >
            <span>Word Scramble</span>
          </button>
        </div>

        {/* Game Body */}
        {tab === 'sliding' && <SlidingTilePuzzle />}
        {tab === 'memory' && <MemoryMatchPuzzle />}
        {tab === 'word' && <WordScramblePuzzle />}
      </div>
    </div>
  );
}

// ── luxury live clock view ───────────────────────────────────────────────────
function LuxuryClockView() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  const pad = (n) => (n < 10 ? '0' + n : n);

  const dateStr = time.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const worldCities = [
    { city: 'London', tz: 'Europe/London' },
    { city: 'New York', tz: 'America/New_York' },
    { city: 'Tokyo', tz: 'Asia/Tokyo' },
    { city: 'Mumbai', tz: 'Asia/Kolkata' },
  ];

  return (
    <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(38,28,74,0.95), rgba(12,10,24,0.98))',
        border: '1px solid rgba(255, 215, 120, 0.4)',
        borderRadius: 24,
        boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 50px rgba(255, 215, 120, 0.15)',
        padding: '30px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fcd34d' }}>
          <Clock size={24} />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Living Room Timepiece
          </span>
        </div>

        {/* Digital display */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.65)',
          border: '1.5px solid rgba(255, 215, 120, 0.5)',
          borderRadius: 18,
          padding: '16px 36px',
          display: 'flex', alignItems: 'baseline', gap: 12,
          boxShadow: 'inset 0 0 25px rgba(255, 215, 120, 0.15)',
        }}>
          <span style={{ fontSize: 52, fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {pad(displayHours)}:{pad(minutes)}:{pad(seconds)}
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fcd34d' }}>
            {ampm}
          </span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>
          {dateStr}
        </div>

        {/* World Time zones */}
        <div style={{ width: '100%', marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
            Global Reference Clocks
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {worldCities.map(({ city, tz }) => {
              const cityTime = time.toLocaleTimeString(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit' });
              return (
                <div key={city} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{city}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fcd34d', fontFamily: 'monospace' }}>{cityTime}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

class ViewerBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('[GAMIFY] viewer failed:', err?.message); }
  render() {
    return this.state.failed
      ? <div className="stay-white" style={{ marginTop: 120, fontWeight: 700, textAlign: 'center' }}>This view could not start on this device. Close it and try again.</div>
      : this.props.children;
  }
}

export default function PropViewer({ kind, arg, onClose }) {
  const [book, setBook] = useState(null);
  useEscape(onClose);
  return createPortal(
    <div className="gcw-force-dark" style={overlay} onClick={onClose}>
      <style>{CSS}</style>
      <button onClick={onClose} className="stay-white" style={closeBtn} title="Close"><X size={20} /></button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {kind === 'books' && (book ? <BookReader book={book} onBack={() => setBook(null)} /> : <BookshelfView shelfId={arg} onPick={setBook} />)}
        {kind === 'fridge' && <FridgeView set={arg} />}
        {kind === 'oven' && <OvenView set={arg} />}
        {kind === 'stove' && <StoveView set={arg} />}
        {kind === 'wardrobe' && <WardrobeView id={arg} />}
        {kind === 'cosmetics' && <CosmeticsView />}
        {kind === 'telescope' && <ViewerBoundary><Suspense fallback={<div className="stay-white" style={{ marginTop: 120, fontWeight: 700 }}>Pointing the telescope...</div>}><SpaceViewer /></Suspense></ViewerBoundary>}
        {kind === 'garden' && <GardenView arg={arg} />}
        {kind === 'monitor' && <MonitorBrowserView onClose={onClose} />}
        {kind === 'puzzles' && <PuzzleGameView />}
        {kind === 'clock' && <LuxuryClockView />}
      </div>
    </div>,
    document.body,
  );
}
