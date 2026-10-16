import { Component, lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, ArrowLeft, RotateCcw,
  Globe, ExternalLink, ArrowRight, Search, Trophy,
  Brain, Compass, Flame, Gamepad2, Heart, Sparkles,
  HelpCircle, Check, Clock, RefreshCw, Shuffle, Lightbulb,
  Maximize2, Laptop, Home, Lock, Eye, ZoomIn, Info, Layers,
  CheckCircle2, AlertCircle, Utensils, UtensilsCrossed, ShieldAlert, Award, Play, Filter, Target
} from 'lucide-react';
import { GENRES, SHELVES, FRIDGE_SHELVES, FRIDGE_SHELVES_UP, DISHES, DISHES_UP, OVEN_ITEMS, OVEN_ITEMS_UP } from '../../data/gamifyBooks';
import { WARDROBES, COSMETICS, GARDEN } from '../../data/gamifyItems';
import { useBookCover, preloadImage, coverUrl } from '../../data/bookCovers';
import { useWikiImage } from '../../data/wikiImages';
import { FOOD_WIKI } from '../../data/foodWiki';
import { WARDROBE_PHOTOS, COSMETICS_PHOTOS, GARDEN_PHOTOS, FOOD_PHOTOS } from '../../data/gamifyManifest';

const SpaceViewer = lazy(() => import('./SpaceViewer'));
const GameViewer = lazy(() => import('./games'));
import { ClothArt, BeautyArt, PlantArt } from './viewerArt';
import { MONA_LISA_IMG } from './props';
import DogCareView from './DogCareView';

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
@keyframes gp-pulse { 0%, 100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.38); opacity: 0.35; } }
@keyframes gp-radar { 0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); } 70% { box-shadow: 0 0 0 16px rgba(255, 215, 0, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); } }
@keyframes gp-puff { 0% { transform: scale(0.95); } 50% { transform: scale(1.15); } 100% { transform: scale(1.06); } }
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
  const localUrl = label ? FOOD_PHOTOS[label] : null;
  const wikiUrl = useWikiImage(title, label);
  const url = localUrl || wikiUrl;
  const [ok, setOk] = useState(Boolean(localUrl));
  useEffect(() => { setOk(Boolean(localUrl)); }, [localUrl, url]);
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
  const allItems = useMemo(() => SHELVES_IN.flat(), [SHELVES_IN]);

  const [open, setOpen] = useState(false);
  const [caseNumber, setCaseNumber] = useState(101);
  const [targets, setTargets] = useState(() => {
    const pool = [...allItems];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 6);
  });
  const [found, setFound] = useState([]);
  const [clueItem, setClueItem] = useState(null);
  const [inspectMessage, setInspectMessage] = useState('Click any suspect item hidden in the messy fridge to secure evidence!');
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 60);
    return () => clearTimeout(t);
  }, []);

  const startNewCase = () => {
    const pool = [...allItems];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setTargets(pool.slice(0, 6));
    setFound([]);
    setClueItem(null);
    setCaseNumber(c => c + 1);
    setInspectMessage('New case file opened! Locate the 6 suspect items from the messy fridge.');
  };

  const triggerClue = () => {
    const unfound = targets.find(t => !found.includes(t.name));
    if (!unfound) {
      setInspectMessage('All evidence in this case has already been secured!');
      return;
    }
    setClueItem(unfound.name);
    setInspectMessage(`Detective clue: Check carefully for "${unfound.name}" inside the fridge shelves!`);
    setTimeout(() => setClueItem(null), 4000);
  };

  const handleItemClick = (it) => {
    const isTarget = targets.some(t => t.name === it.name);
    if (isTarget) {
      if (found.includes(it.name)) {
        setInspectMessage(`Evidence Already Secured: "${it.name}" is catalogued in Case File #${caseNumber}.`);
      } else {
        const nextFound = [...found, it.name];
        setFound(nextFound);
        if (nextFound.length >= targets.length) {
          setInspectMessage(`Case Solved! All 6 suspect evidence items secured!`);
        } else {
          setInspectMessage(`Evidence Secured: "${it.name}" moved to completed findings! (${nextFound.length}/${targets.length})`);
        }
      }
    } else {
      setInspectMessage(`Inspected "${it.name}" — Item cleared, not listed on current suspect warrant.`);
    }
  };

  const isCaseSolved = targets.length > 0 && found.length >= targets.length;

  // Staggered offsets for messy natural kitchen placement
  const messyOffsets = [
    { rot: -5, dx: -4, dy: 3, z: 2 },
    { rot: 4, dx: 6, dy: -2, z: 3 },
    { rot: -3, dx: -2, dy: 5, z: 1 },
    { rot: 6, dx: 4, dy: -4, z: 4 },
    { rot: -2, dx: 0, dy: 2, z: 2 },
  ];

  return (
    <div style={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* ── CRIMINAL INVESTIGATION HEADER ── */}
      <div style={{ width: '100%', background: 'linear-gradient(135deg, rgba(20,16,36,0.95), rgba(36,20,60,0.92))', border: '1px solid rgba(255,215,120,0.3)', borderRadius: 16, padding: '14px 18px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', boxShadow: '0 0 14px rgba(245,158,11,0.5)' }}>
              <Search size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="stay-white" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Fridge Crime Scene Investigation
              </div>
              <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                Case File #{caseNumber} • Forensic Food Evidence Recovery
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: isCaseSolved ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.2)', border: isCaseSolved ? '1px solid #22c55e' : '1px solid #f59e0b', borderRadius: 99, padding: '5px 14px', fontSize: 12.5, fontWeight: 800, color: isCaseSolved ? '#4ade80' : '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
              {isCaseSolved ? <CheckCircle2 size={14} /> : <Target size={14} />}
              <span>{isCaseSolved ? 'CASE SOLVED' : `FOUND: ${found.length} / ${targets.length}`}</span>
            </div>

            <button onClick={triggerClue} className="stay-white" style={{ ...btnPill, padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.12)' }} title="Reveal detective clue">
              <Lightbulb size={14} color="#fcd34d" /> Clue Hint
            </button>
            <button onClick={startNewCase} className="stay-white" style={{ ...btnPill, padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.12)' }} title="Generate new investigation case">
              <Shuffle size={14} /> New Case
            </button>
          </div>
        </div>

        {/* ── TOP EVIDENCE CHECKLIST: TARGETS TO FIND & COMPLETED FINDING ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Suspect Evidence Targets (Click items inside fridge to complete finding):
            </span>
            <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>
              {found.length} of {targets.length} Secured
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
            {targets.map((tgt) => {
              const isFound = found.includes(tgt.name);
              return (
                <div
                  key={tgt.name}
                  style={{
                    background: isFound ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))' : 'rgba(255,255,255,0.06)',
                    border: isFound ? '1.5px solid #22c55e' : '1px dashed rgba(255,215,120,0.4)',
                    borderRadius: 12,
                    padding: '8px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all .3s ease',
                    boxShadow: isFound ? '0 4px 12px rgba(34,197,94,0.3)' : 'none',
                    transform: isFound ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', position: 'relative' }}>
                    <FoodPhoto title={FOOD_WIKI[tgt.name]} label={tgt.name} fallback={<ItemArt kind={tgt.kind} color={tgt.color} accent={tgt.accent} label={tgt.label} />} />
                    {isFound && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={20} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div className="stay-white" style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {tgt.name}
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    borderRadius: 99,
                    background: isFound ? '#22c55e' : 'rgba(245,158,11,0.2)',
                    color: isFound ? '#ffffff' : '#fbbf24',
                    border: isFound ? 'none' : '1px solid rgba(245,158,11,0.5)',
                  }}>
                    {isFound ? 'COMPLETED' : 'TO FIND'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TICKER MESSAGE ── */}
        <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={15} color="#60a5fa" flex="none" />
          <span style={{ fontWeight: 600 }}>{inspectMessage}</span>
        </div>
      </div>

      {/* ── REALISTIC MESSY FRIDGE INTERIOR ── */}
      <div style={{ position: 'relative', width: '100%', perspective: 1400 }}>
        <div style={{
          background: 'linear-gradient(180deg, #f2f7fc 0%, #d8e8f8 60%, #c4dcf2 100%)',
          borderRadius: 20,
          padding: '16px 16px 12px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7), inset 0 0 0 6px #cfd8e5, inset 0 0 60px rgba(100,165,245,0.4)',
          border: '2px solid rgba(255,255,255,0.8)',
        }}>
          {/* Top internal chiller light */}
          <div style={{ height: 6, width: '40%', margin: '0 auto 12px', borderRadius: 4, background: '#a5d8ff', boxShadow: '0 0 16px #38bdf8' }} />

          {SHELVES_IN.map((shelf, si) => {
            const shelfTitles = ['Chiller & Dairy Shelf', 'Beverages & Delights', 'Pickles, Sauces & Leftovers', 'Crisper Drawer Produce'];
            return (
              <div key={si} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 4px' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.08em' }}>
                    {shelfTitles[si] || `Shelf ${si + 1}`}
                  </span>
                  <span style={{ fontSize: 9, color: '#64748b' }}>packed messy</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-around',
                  height: 116,
                  borderBottom: '6px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 8px 12px -6px rgba(0,0,0,0.3)',
                  padding: '4px 6px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.4), rgba(240,248,255,0.85))',
                  borderRadius: 8,
                  position: 'relative',
                  overflow: 'visible',
                }}>
                  {shelf.map((it, idx) => {
                    const offset = messyOffsets[idx % messyOffsets.length];
                    const isTarget = targets.some(t => t.name === it.name);
                    const isFound = found.includes(it.name);
                    const isClue = clueItem === it.name;
                    const isHovered = hovered === it.name;

                    return (
                      <div
                        key={it.name}
                        onMouseEnter={() => setHovered(it.name)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => handleItemClick(it)}
                        style={{
                          width: it.kind === 'block' || it.kind === 'eggs' ? '17%' : '19%',
                          height: it.kind === 'block' || it.kind === 'eggs' ? '82%' : '98%',
                          cursor: 'pointer',
                          position: 'relative',
                          zIndex: isHovered ? 30 : offset.z,
                          transform: isHovered
                            ? 'translateY(-12px) scale(1.16) rotate(0deg)'
                            : `translate(${offset.dx}px, ${offset.dy}px) rotate(${offset.rot}deg)`,
                          transition: 'transform .18s cubic-bezier(0.2, 0.8, 0.4, 1), box-shadow .18s ease',
                          filter: isHovered ? 'drop-shadow(0 12px 14px rgba(0,0,0,0.45))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
                          borderRadius: 10,
                          animation: isClue ? 'gp-radar 1.2s infinite' : 'none',
                        }}
                      >
                        <FoodPhoto
                          title={FOOD_WIKI[it.name]}
                          label={it.name}
                          fallback={<ItemArt kind={it.kind} color={it.color} accent={it.accent} label={it.label} />}
                        />

                        {/* Detective Target Badge or Found checkmark */}
                        {isFound && (
                          <div style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: '#22c55e',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                            border: '1.5px solid #fff',
                            zIndex: 10,
                          }}>
                            <Check size={13} strokeWidth={3} />
                          </div>
                        )}

                        {isTarget && !isFound && (
                          <div style={{
                            position: 'absolute',
                            top: -4,
                            left: -4,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#f59e0b',
                            color: '#111',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                            border: '1.5px solid #fff',
                            zIndex: 10,
                          }}>
                            <Target size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fridge Doors Opening Animation */}
        {[['left', -1], ['right', 1]].map(([side, dir]) => (
          <div key={side} style={{
            position: 'absolute', top: 0, bottom: 0, [side]: 0, width: '50%', transformOrigin: `${side} center`,
            transform: open ? `rotateY(${dir * -105}deg)` : 'rotateY(0)', background: 'linear-gradient(135deg,#eef0f6,#c9cde0)', borderRadius: 20, boxShadow: '0 0 0 2px #aab0c6',
            pointerEvents: 'none', opacity: open ? 0 : 1, transitionProperty: 'transform, opacity', transitionDuration: '.9s, .5s', transitionDelay: '0s, .55s', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
          }}>
            <div style={{ position: 'absolute', top: '30%', [dir > 0 ? 'left' : 'right']: 10, width: 8, height: '30%', borderRadius: 4, background: '#8f95a8' }} />
          </div>
        ))}
      </div>

      {/* ── CASE SOLVED CELEBRATION MODAL OVERLAY ── */}
      {isCaseSolved && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,8,22,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100001,
          animation: 'gp-fade .3s ease-out',
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1f1a3a, #131024)',
            border: '2px solid #22c55e',
            borderRadius: 24,
            padding: '30px 26px',
            maxWidth: 480,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(34,197,94,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 28px rgba(34,197,94,0.6)',
            }}>
              <Trophy size={36} />
            </div>

            <div className="stay-white" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.04em' }}>
              CASE CLOSED • EVIDENCE SECURED!
            </div>
            <div style={{ fontSize: 14, color: '#86efac', fontWeight: 600, lineHeight: 1.45 }}>
              Magnificent detective investigation! You located all 6 suspect food items hidden across the messy fridge shelves.
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', margin: '8px 0' }}>
              {targets.map(t => (
                <span key={t.name} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#86efac' }}>
                  {t.name}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={startNewCase}
                className="stay-white"
                style={{
                  ...btnPill,
                  padding: '12px 24px',
                  fontSize: 14,
                  background: 'linear-gradient(135deg, #22c55e, #15803d)',
                  border: 'none',
                  boxShadow: '0 6px 18px rgba(34,197,94,0.4)',
                }}
              >
                <Shuffle size={16} /> Investigate Next Case
              </button>
            </div>
          </div>
        </div>
      )}
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

// ── MULTI-CUISINE STOVE DISHES CATALOG ──
const ALL_STOVE_DISHES = [
  // ── INDIAN ──
  {
    id: 'chai',
    name: 'Masala chai',
    cuisine: 'Indian',
    vessel: 'pot',
    plate: 'cup',
    time: '6m',
    spicy: 'Mild',
    desc: 'Spiced Indian milk tea brewed with fresh crushed ginger, fragrant green cardamom & Assam CTC leaves.',
    img: '/images/gamify/foods/masala-chai.jpg',
    steps: ['Boil water with crushed ginger and green cardamom', 'Add Assam CTC tea leaves and let steep', 'Pour fresh whole milk and simmer until rich golden', 'Strain through fine mesh into clay kulhad']
  },
  {
    id: 'dal',
    name: 'Dal tadka',
    cuisine: 'Indian',
    vessel: 'pot',
    plate: 'bowl',
    time: '12m',
    spicy: 'Medium',
    desc: 'Velvety yellow lentils tempered with hot desi ghee, cumin seeds, garlic, dried red chillies and coriander.',
    img: '/images/gamify/foods/dal-tadka.jpg',
    steps: ['Boil toor dal with turmeric and pink salt', 'Heat pure desi ghee in tadka pan', 'Splutter cumin, dried red chillies and garlic', 'Pour sizzling tadka over dal and garnish with coriander']
  },
  {
    id: 'paneer_butter',
    name: 'Paneer butter masala',
    cuisine: 'Indian',
    vessel: 'pan',
    plate: 'bowl',
    time: '15m',
    spicy: 'Medium',
    desc: 'Soft cottage cheese cubes simmered in a luscious rich satin gravy of tomatoes, butter, cashew and cream.',
    img: '/images/gamify/foods/paneer-butter-masala.jpg',
    steps: ['Sauté pureed vine tomatoes with ginger-garlic paste in butter', 'Add Kashmiri red chilli, garam masala and cream', 'Slide in fresh soft paneer cubes', 'Finish with crushed kasuri methi and butter drizzle']
  },
  {
    id: 'veg_biryani',
    name: 'Veg biryani',
    cuisine: 'Indian',
    vessel: 'pot',
    plate: 'bowl',
    time: '20m',
    spicy: 'Rich',
    desc: 'Fragrant aged basmati rice layered with spiced vegetables, saffron strands, caramelized onions and mint.',
    img: '/images/gamify/foods/veg-biryani.jpg',
    steps: ['Parboil aged basmati rice with whole spices', 'Layer with saffron milk, mint, and spiced vegetables', 'Seal the pot rim with dough for dum', 'Slow-cook until every grain is fluffy and fragrant']
  },
  {
    id: 'aloo_paratha',
    name: 'Aloo paratha',
    cuisine: 'Indian',
    vessel: 'tawa',
    plate: 'roti',
    time: '10m',
    spicy: 'Medium',
    desc: 'Golden crisp flatbread stuffed with spiced mashed potatoes, roasted on a heavy iron tawa with white butter.',
    img: '/images/gamify/foods/aloo-paratha.jpg',
    steps: ['Stuff whole wheat dough with spiced mashed potato filling', 'Roll out gently with wooden belan', 'Roast on hot cast iron tawa with pure ghee', 'Flip until golden-crisp with brown speckles']
  },
  {
    id: 'masala_dosa',
    name: 'Masala dosa',
    cuisine: 'Indian',
    vessel: 'tawa',
    plate: 'flat',
    time: '8m',
    spicy: 'Medium',
    desc: 'Crispy fermented rice and lentil crepe rolled with aromatic spiced mustard potato masala.',
    img: '/images/gamify/foods/masala-dosa.jpg',
    steps: ['Spread fermented batter thin on smoking tawa', 'Drizzle sesame oil around the crispy edges', 'Spoon spiced potato filling in the centre', 'Fold into a crisp roll and serve with chutney']
  },
  {
    id: 'pav_bhaji',
    name: 'Pav bhaji',
    cuisine: 'Indian',
    vessel: 'pan',
    plate: 'bowl',
    time: '14m',
    spicy: 'Zesty',
    desc: 'Spicy mashed vegetable curry topped with a generous dollop of butter, served with butter-toasted ladi pav.',
    img: '/images/gamify/foods/pav-bhaji.jpg',
    steps: ['Boil and mash potatoes, cauliflower, peas and tomatoes', 'Sauté with onions, garlic and special pav bhaji masala', 'Simmer into thick gravy with a mountain of butter', 'Serve sizzling with butter-toasted pav and lemon']
  },
  {
    id: 'chole',
    name: 'Chole bhature',
    cuisine: 'Indian',
    vessel: 'pot',
    plate: 'bowl',
    time: '18m',
    spicy: 'Spicy',
    desc: 'Tangy dark spiced chickpea curry infused with anardana, amla and roasted spices.',
    img: '/images/gamify/foods/chole.jpg',
    steps: ['Simmer chickpeas with black tea leaves and dried amla', 'Prepare dark onion-tomato gravy with anardana', 'Add chickpeas and crushed roasted spices', 'Garnish with ginger juliennes and green chillies']
  },

  // ── ITALIAN ──
  {
    id: 'pizza_margherita',
    name: 'Margherita Pizza',
    cuisine: 'Italian',
    vessel: 'pan',
    plate: 'flat',
    time: '12m',
    spicy: 'Mild',
    desc: 'Classic Neapolitan pizza with crushed San Marzano tomatoes, fresh torn mozzarella, and aromatic basil.',
    img: '/images/gamify/foods/pizza.jpg',
    steps: ['Stretch fermented pizza dough into a thin disc', 'Spread crushed San Marzano tomato sauce and sea salt', 'Tear fresh buffalo mozzarella over the sauce', 'Bake at blistering heat until crust blisters and cheese bubbles']
  },
  {
    id: 'fettuccine_alfredo',
    name: 'Creamy Fettuccine Alfredo',
    cuisine: 'Italian',
    vessel: 'pan',
    plate: 'bowl',
    time: '10m',
    spicy: 'Mild',
    desc: 'Silky bronze-cut ribbon pasta tossed in European butter, sweet cream and freshly grated Parmigiano-Reggiano.',
    img: '/images/gamify/foods/creamy-pasta.jpg',
    steps: ['Boil bronze-die fettuccine in salted water until al dente', 'Melt sweet butter in wide sauté skillet with cracked pepper', 'Toss pasta with warm cream and grated Parmigiano', 'Whisk in starchy pasta water until emulsified and velvety']
  },
  {
    id: 'penne_arrabbiata',
    name: 'Penne all\'Arrabbiata',
    cuisine: 'Italian',
    vessel: 'pan',
    plate: 'bowl',
    time: '11m',
    spicy: 'Fiery',
    desc: 'Al dente tubular penne pasta tossed in a fiery Roman garlic, extra virgin olive oil, and crushed chili tomato sauce.',
    img: 'https://images.unsplash.com/photo-1621996346565-e3d5d62817ee?w=600&auto=format&fit=crop&q=80',
    steps: ['Sauté sliced garlic and red pepper flakes in cold-pressed olive oil', 'Pour in crushed Italian plum tomatoes and simmer until sweet', 'Toss al dente penne directly into the bubbling fiery sauce', 'Finish with torn fresh basil and aged Pecorino Romano']
  },
  {
    id: 'mushroom_risotto',
    name: 'Wild Mushroom Risotto',
    cuisine: 'Italian',
    vessel: 'pot',
    plate: 'bowl',
    time: '16m',
    spicy: 'Mild',
    desc: 'Creamy slow-stirred Carnaroli rice with sauteed porcini and cremini mushrooms, white wine, and aged parmesan.',
    img: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=600&auto=format&fit=crop&q=80',
    steps: ['Toast Carnaroli rice in olive oil and minced shallots', 'Deglaze with a splash of dry white wine', 'Ladle warm vegetable broth gradually while stirring constantly', 'Mantecatura: vigorously beat in cold butter, sautéed porcini and parmesan']
  },
  {
    id: 'four_cheese_lasagna',
    name: 'Four-Cheese Lasagna',
    cuisine: 'Italian',
    vessel: 'pan',
    plate: 'flat',
    time: '18m',
    spicy: 'Mild',
    desc: 'Layered fresh egg pasta sheets with silken béchamel, rich marinara, ricotta, fontina and melted mozzarella.',
    img: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&auto=format&fit=crop&q=80',
    steps: ['Layer egg pasta sheets with creamy béchamel and marinara', 'Scatter fresh ricotta, mozzarella, fontina and provolone', 'Build multi-tiered savory pasta layers', 'Bake until the top crown is golden, bubbly and caramelized']
  },
  {
    id: 'tomato_bruschetta',
    name: 'Tomato Basil Bruschetta',
    cuisine: 'Italian',
    vessel: 'tawa',
    plate: 'flat',
    time: '7m',
    spicy: 'Mild',
    desc: 'Grilled rustic artisan country bread rubbed with fresh garlic, topped with vine-ripened tomatoes and basil.',
    img: '/images/gamify/foods/garlic-bread.jpg',
    steps: ['Slice crusty sourdough bread and toast on tawa until crisp', 'Rub hot bread surface with raw garlic clove for aroma', 'Mound diced ripe tomatoes tossed with extra virgin olive oil and basil', 'Drizzle aged Modena balsamic glaze and sea salt flakes']
  },

  // ── CONTINENTAL ──
  {
    id: 'grilled_sizzler',
    name: 'Grilled Vegetable Sizzler',
    cuisine: 'Continental',
    vessel: 'tawa',
    plate: 'flat',
    time: '15m',
    spicy: 'Zesty',
    desc: 'Smoking cast iron platter with rosemary grilled zucchini, bell peppers, baby corn, butter rice and pepper sauce.',
    img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
    steps: ['Marinate vegetables in olive oil, crushed garlic and fresh herbs', 'Sear on smoking cast iron grill for authentic char lines', 'Heat heavy iron sizzler plate over open flame until smoking', 'Assemble over shredded cabbage and pour sizzling pepper sauce']
  },
  {
    id: 'mushroom_soup',
    name: 'Cream of Mushroom Soup',
    cuisine: 'Continental',
    vessel: 'pot',
    plate: 'cup',
    time: '12m',
    spicy: 'Mild',
    desc: 'Rich velvety bisque crafted with sautéed button and wild forest mushrooms, shallots, thyme and heavy cream.',
    img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80',
    steps: ['Sauté sliced mushrooms with shallots and fresh thyme in butter', 'Whisk in warm vegetable stock and simmer gently', 'Blend to a velvety smooth consistency', 'Swirl in heavy cream and finish with garlic herb croutons']
  },
  {
    id: 'jacket_potato',
    name: 'Baked Stuffed Jacket Potato',
    cuisine: 'Continental',
    vessel: 'pan',
    plate: 'flat',
    time: '14m',
    spicy: 'Mild',
    desc: 'Crisp sea-salted potato jackets filled with fluffy mashed potato, sour cream, chives, sweetcorn and cheddar.',
    img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    steps: ['Roast russet potatoes until skins are crisp and flesh is tender', 'Scoop interior and mash with sweet butter, sour cream and chives', 'Fold in sweetcorn kernels and sharp cheddar cheese', 'Broil until cheese melts into a golden toasted crust']
  },
  {
    id: 'garlic_crostini',
    name: 'Garlic Butter Crostini',
    cuisine: 'Continental',
    vessel: 'tawa',
    plate: 'flat',
    time: '6m',
    spicy: 'Mild',
    desc: 'Toasted baguette rounds slathered with roasted garlic butter, fresh parsley and flaky Maldon salt.',
    img: '/images/gamify/foods/garlic-bread.jpg',
    steps: ['Whip sweet butter with slow-roasted garlic and chopped parsley', 'Spread generously over artisan baguette rounds', 'Toast on tawa until golden-brown and fragrant', 'Serve warm with flaky sea salt garnish']
  },
  {
    id: 'greek_salad',
    name: 'Mediterranean Greek Salad',
    cuisine: 'Continental',
    vessel: 'pan',
    plate: 'bowl',
    time: '6m',
    spicy: 'Zesty',
    desc: 'Crisp Persian cucumbers, vine tomatoes, red onion rings, Kalamata olives, and a slab of barrel-aged feta cheese.',
    img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
    steps: ['Chop crisp cucumbers, sweet bell peppers and heirloom tomatoes', 'Toss with sliced red onions and pitted Kalamata olives', 'Dress with Greek extra virgin olive oil, lemon juice and wild oregano', 'Crown with a generous slab of barrel-aged sheep feta cheese']
  },

  // ── CHINESE ──
  {
    id: 'hakka_noodles',
    name: 'Hakka Street Noodles',
    cuisine: 'Chinese',
    vessel: 'pan',
    plate: 'bowl',
    time: '9m',
    spicy: 'Zesty',
    desc: 'High-heat wok-tossed thin noodles with crunchy shredded cabbage, capsicum, carrots, dark soy and spring onion.',
    img: '/images/gamify/foods/masala-noodles.jpg',
    steps: ['Boil wheat noodles al dente and toss with sesame oil', 'Heat seasoned iron wok over roaring flame until smoking', 'Flash fry julienned vegetables for crisp texture', 'Toss noodles with dark soy, chilli vinegar and spring onions']
  },
  {
    id: 'veg_manchurian',
    name: 'Veg Manchurian Gravy',
    cuisine: 'Chinese',
    vessel: 'pan',
    plate: 'bowl',
    time: '13m',
    spicy: 'Spicy',
    desc: 'Golden crispy minced vegetable balls simmered in a glossy, savory ginger-garlic dark soy Manchurian sauce.',
    img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
    steps: ['Form vegetable mince into dumplings and fry until crisp', 'Sauté minced ginger, garlic and green chillies in wok', 'Simmer dark soy sauce, chilli sauce and broth', 'Thicken with cornstarch slurry and coat crispy dumplings']
  },
  {
    id: 'schezwan_fried_rice',
    name: 'Schezwan Fried Rice',
    cuisine: 'Chinese',
    vessel: 'pan',
    plate: 'bowl',
    time: '11m',
    spicy: 'Fiery',
    desc: 'Wok-charred fragrant rice tossed with pungent red Schezwan chili paste, crunchy celery, and bell peppers.',
    img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80',
    steps: ['Steam aged long-grain rice and chill thoroughly', 'Heat wok with spicy Sichuan pepper and garlic chili paste', 'Stir-fry diced vegetables over smoking flame', 'Toss cold rice vigorously for distinct smoky wok hei flavor']
  },
  {
    id: 'chilli_paneer',
    name: 'Chilli Garlic Paneer',
    cuisine: 'Chinese',
    vessel: 'pan',
    plate: 'bowl',
    time: '10m',
    spicy: 'Spicy',
    desc: 'Crispy batter-fried paneer cubes tossed in high-heat wok with onions, capsicum, garlic and sweet chili sauce.',
    img: '/images/gamify/foods/schezwan-sauce.jpg',
    steps: ['Dust fresh paneer with cornstarch and sear till crisp', 'Sauté cubed onions, green peppers and sliced garlic', 'Add soy sauce, red chili paste and rice vinegar', 'Toss paneer swiftly so exterior stays crunchy']
  },
  {
    id: 'steamed_dimsum',
    name: 'Steamed Dim Sum Dumplings',
    cuisine: 'Chinese',
    vessel: 'pot',
    plate: 'bowl',
    time: '8m',
    spicy: 'Mild',
    desc: 'Delicate translucent wheat-starch parcels filled with water chestnuts, mushrooms, and ginger, steamed in bamboo.',
    img: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80',
    steps: ['Roll translucent dumpling dough paper-thin', 'Spoon in seasoned filling of mushrooms and water chestnuts', 'Pleat edges into delicate floral crescent folds', 'Steam inside bamboo steamer basket over boiling water for 6m']
  },
  {
    id: 'spring_rolls',
    name: 'Crispy Spring Rolls',
    cuisine: 'Chinese',
    vessel: 'pan',
    plate: 'flat',
    time: '10m',
    spicy: 'Medium',
    desc: 'Golden shatteringly-crisp pastry rolls stuffed with wok-tossed seasoned vegetables, served with sweet chili dip.',
    img: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600&auto=format&fit=crop&q=80',
    steps: ['Stir-fry julienned cabbage, carrots and glass noodles with white pepper', 'Wrap tightly in thin wheat pastry skins and seal edges', 'Deep fry in smoking oil until bubbly and amber-gold', 'Slice on bias and serve with tangy plum sweet chili sauce']
  }
];

function StoveView({ set }) {
  const [cuisineFilter, setCuisineFilter] = useState('All');
  const [dish, setDish] = useState(null);
  const [stage, setStage] = useState(0);
  const [tick, setTick] = useState(0);

  const filteredDishes = useMemo(() => {
    if (cuisineFilter === 'All') return ALL_STOVE_DISHES;
    return ALL_STOVE_DISHES.filter(d => d.cuisine === cuisineFilter);
  }, [cuisineFilter]);

  useEffect(() => {
    if (!dish) return undefined;
    setStage(0);
    setTick(0);
    const t = setInterval(() => setTick(x => x + 1), 600);
    return () => clearInterval(t);
  }, [dish]);

  useEffect(() => {
    if (dish) setStage(Math.min(dish.steps.length, Math.floor(tick / 3)));
  }, [tick, dish]);

  const cuisineTabs = ['All', 'Indian', 'Italian', 'Continental', 'Chinese'];

  if (!dish) {
    return (
      <div style={{ width: '100%', maxWidth: 880, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="stay-white" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Flame size={24} color="#ff8a4a" /> Master Chef Stove
          </div>
          <div className="stay-white" style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
            Choose an authentic dish with original photos to cook on the stove burner
          </div>
        </div>

        {/* ── CUISINE TABS ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '4px 0 8px' }}>
          {cuisineTabs.map(c => {
            const active = cuisineFilter === c;
            return (
              <button
                key={c}
                onClick={() => setCuisineFilter(c)}
                className="stay-white"
                style={{
                  ...pill,
                  padding: '7px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: active ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.08)',
                  color: active ? '#111' : '#fff',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.18)',
                  boxShadow: active ? '0 4px 14px rgba(245,158,11,0.4)' : 'none',
                  transition: 'all .16s ease',
                }}
              >
                {c} {c !== 'All' ? `(${ALL_STOVE_DISHES.filter(d => d.cuisine === c).length})` : `(${ALL_STOVE_DISHES.length})`}
              </button>
            );
          })}
        </div>

        {/* ── DISHES GRID WITH REAL ORIGINAL PHOTOGRAPHY ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 14,
          width: '100%',
        }}>
          {filteredDishes.map(d => {
            const photoUrl = d.img || FOOD_PHOTOS[d.name] || null;
            return (
              <button
                key={d.id}
                onClick={() => setDish(d)}
                className="stay-white"
                style={{
                  background: 'linear-gradient(145deg, rgba(28,24,48,0.92), rgba(16,14,28,0.95))',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 16,
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.borderColor = '#f59e0b';
                  e.currentTarget.style.boxShadow = '0 14px 28px rgba(245,158,11,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.45)';
                }}
              >
                {/* Real Dish Photo Container */}
                <div style={{ width: '100%', height: 125, position: 'relative', overflow: 'hidden', background: '#181426' }}>
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={d.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s ease' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Utensils size={32} color="#f59e0b" />
                    </div>
                  )}

                  {/* Badges on photo */}
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(12,10,24,0.85)', backdropFilter: 'blur(4px)', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800, color: '#fcd34d', border: '1px solid rgba(255,215,120,0.3)' }}>
                    {d.cuisine}
                  </div>
                  <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(12,10,24,0.85)', backdropFilter: 'blur(4px)', padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} /> {d.time}
                  </div>
                </div>

                {/* Card Info */}
                <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {d.desc}
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fbbf24', textTransform: 'capitalize' }}>
                      {d.vessel === 'tawa' ? 'Cast Iron Tawa' : d.vessel === 'pan' ? 'Sauté Pan / Wok' : 'Boiling Pot'}
                    </span>
                    <span style={{ fontSize: 10, color: '#a7f3d0', fontWeight: 700, background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: 4 }}>
                      {d.spicy}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const done = stage >= dish.steps.length;
  const prog = Math.min(1, tick / (dish.steps.length * 3));
  const photoUrl = dish.img || FOOD_PHOTOS[dish.name] || null;

  return (
    <div style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <button onClick={() => setDish(null)} className="stay-white" style={{ ...btnPill, alignSelf: 'flex-start' }}>
        <ArrowLeft size={15} /> Select Another Dish
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 4 }}>
          {dish.cuisine} Cuisine • {dish.time} Cook Time
        </div>
        <div className="stay-white" style={{ fontSize: 24, fontWeight: 900 }}>{dish.name}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', maxWidth: 440, margin: '2px auto 0' }}>
          {dish.desc}
        </div>
      </div>

      {/* ── INTERACTIVE STOVE VESSEL & SIZZLING REAL DISH PREVIEW ── */}
      <div style={{
        width: '100%',
        borderRadius: 20,
        padding: '20px 16px',
        background: 'linear-gradient(180deg, #242038, #12101e)',
        boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 2px rgba(255,255,255,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 220,
      }}>
        {/* Real photo reveal */}
        <div style={{
          width: done ? 210 : 170,
          height: done ? 210 : 170,
          borderRadius: 20,
          overflow: 'hidden',
          border: '4px solid #f59e0b',
          boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
          position: 'relative',
          flex: 'none',
          animation: done ? 'gp-pop .5s ease-out' : 'none',
          transition: 'all .4s ease',
        }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={dish.name}
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: done ? 'none' : `blur(${(1 - prog) * 8}px) grayscale(${(1 - prog) * 0.75}) brightness(${0.7 + prog * 0.3})`,
                transition: 'filter .5s linear',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c192b' }}>
              <Utensils size={40} color="#f59e0b" />
            </div>
          )}
          {!done && [0, 1, 2].map(i => (
            <span key={i} style={{ position: 'absolute', top: 10, left: `${30 + i * 18}%`, width: 14, height: 36, borderRadius: 14, background: 'rgba(255,255,255,0.35)', filter: 'blur(5px)', animation: `gp-steam 2.6s ease-in ${i * 0.7}s infinite` }} />
          ))}
          {done && (
            <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(16,185,129,0.92)', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 800, color: '#fff', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <CheckCircle2 size={13} /> Sizzling & Ready!
            </div>
          )}
        </div>

        {/* Dynamic cooking vessel on burner flame */}
        <div style={{ flex: '1 1 200px', maxWidth: 280 }}>
          <Vessel dish={{ ...dish, fill: '#e07a2a', bubble: '#ffbe76' }} stage={stage} done={done} />
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, prog * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #ef4444)', transition: 'width .6s linear' }} />
      </div>

      {/* Cooking Steps Checklist */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dish.steps.map((s, i) => (
          <div
            key={s}
            className="stay-white"
            style={{
              ...pill,
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13.5,
              fontWeight: 600,
              opacity: i < stage ? 0.6 : i === stage ? 1 : 0.35,
              border: i === stage && !done ? '1.5px solid #f59e0b' : pill.border,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: i < stage ? '#22c55e' : i === stage ? '#f59e0b' : 'rgba(255,255,255,0.15)',
              color: i === stage ? '#111' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              flex: 'none',
            }}>
              {i < stage ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            {s}
          </div>
        ))}
      </div>

      {done && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
          <button onClick={() => { setDish(null); }} className="stay-white" style={{ ...btnPill, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#111', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>
            <RotateCcw size={14} /> Cook Another Dish
          </button>
        </div>
      )}
    </div>
  );
}

// ── INDIAN UTENSILS CUPBOARD MODAL VIEW ──
const INDIAN_UTENSILS = [
  {
    id: 'chakla_belan',
    name: 'Chakla & Belan',
    hindi: 'चकला बेलन',
    category: 'Cookware',
    material: 'Makrana Marble & Sheesham Wood',
    desc: 'Circular marble rolling board and tapered wooden rolling pin. Designed with weighted balance to roll paper-thin rotis, puris and parathas without sticking.',
    uses: 'Roti, Phulka, Puri, Paratha rolling',
    tip: 'Dust marble chakla lightly with whole wheat flour (palethan) before rolling for smooth gliding.',
    img: '/images/gamify/foods/roti-on-the-tawa.jpg',
  },
  {
    id: 'loha_tawa',
    name: 'Loha Roti Tawa',
    hindi: 'लोहा तवा',
    category: 'Cookware',
    material: 'Hand-Forged Cast Iron with Wood Handle',
    desc: 'Heavy concave black iron griddle that holds intense, even heat. The porous iron seasons over generations to impart authentic charred aroma to rotis.',
    uses: 'Phulkas, Chapatis, Stuffed Parathas',
    tip: 'Never wash with harsh soaps; wipe with warm water and rub a drop of mustard oil to keep seasoned.',
    img: '/images/gamify/foods/aloo-paratha.jpg',
  },
  {
    id: 'pital_kadhai',
    name: 'Pital & Loha Kadhai',
    hindi: 'पीतल व लोहा कड़ाही',
    category: 'Cookware',
    material: 'Heavy Brass with Kalai (Tin) Lining or Cast Iron',
    desc: 'Deep round-bottomed Indian wok with dual brass loop handles. Perfect for deep-frying puris and samosas, or slow-braising rich curries over high heat.',
    uses: 'Deep frying, Sabzi, Halwa, Gravies',
    tip: 'The steep curved sides retain heat and reduce oil needed for deep frying.',
    img: '/images/gamify/foods/pakora.jpg',
  },
  {
    id: 'mitti_handi',
    name: 'Mitti & Tamba Handi',
    hindi: 'मिट्टी की हाँडी',
    category: 'Heritage Tools',
    material: 'Terracotta Clay & Hammered Copper',
    desc: 'Spherical pot with a wide belly and narrow rim. Traps steam naturally, allowing juices to condense and drip back for aromatic Awadhi Dum cooking.',
    uses: 'Dum Biryani, Dal Makhani, Champaran Stew',
    tip: 'Seal rim with whole wheat dough to create a natural pressure lock that preserves volatile aromas.',
    img: '/images/gamify/foods/veg-biryani.jpg',
  },
  {
    id: 'chimta',
    name: 'Roti Chimta',
    hindi: 'रोटी चिमटा',
    category: 'Cookware',
    material: 'Heavy-gauge Stainless Steel',
    desc: 'Spring-loaded culinary tongs with flattened, serrated tips. Safely flips hot rotis on the tawa and holds them directly over open flames to puff into balloons.',
    uses: 'Flipping and puffing rotis over direct gas flame',
    tip: 'Grip near the rim gently to avoid puncturing the expanding air pocket in the phulka.',
    img: '/images/gamify/foods/roti-on-the-tawa.jpg',
  },
  {
    id: 'tadka_pan',
    name: 'Tadka Pan (Vagharia)',
    hindi: 'तड़का पैन (वघारिया)',
    category: 'Cookware',
    material: 'Cast Iron or Pure Brass',
    desc: 'Miniature deep ladle-shaped pan with an extended heat-resistant handle. Concentrates heat to sizzle whole spices in hot desi ghee in seconds.',
    uses: 'Tempering dal, sambar, rasam, and raita',
    tip: 'Add cumin and mustard seeds first, then ginger and hing at the very end to prevent burning.',
    img: '/images/gamify/foods/dal-tadka.jpg',
  },
  {
    id: 'masala_dabba',
    name: 'Pital Masala Dabba',
    hindi: 'पीतल मसाला दानी',
    category: 'Dining & Storage',
    material: 'Solid Brass with 7 Inner Cups & Spoon',
    desc: 'Heritage circular brass spice box containing the seven sacred daily Indian spices: Haldi, Lal Mirch, Dhaniya, Jeera, Rai, Garam Masala, and Amchur.',
    uses: 'Instant access to core spices while cooking',
    tip: 'Brass naturally keeps ground spices dry, aromatic, and shielded from humidity.',
    img: '/images/gamify/foods/garam-masala.jpg',
  },
  {
    id: 'pressure_cooker',
    name: 'Pressure Cooker',
    hindi: 'प्रेशर कुकर',
    category: 'Cookware',
    material: 'Heavy Tri-Ply Stainless Steel / Hard Anodised',
    desc: 'The iconic rhythmic heartbeat of Indian households. Cooks lentils, chickpeas, and fragrant rice in minutes under 15 PSI steam pressure.',
    uses: 'Dals, Khichdi, Chole, Pulao, Steaming',
    tip: 'Listen for the whistle count; let pressure release naturally for velvety soft lentils.',
    img: '/images/gamify/foods/khichdi.jpg',
  },
  {
    id: 'sil_batta',
    name: 'Sil Batta',
    hindi: 'सिल बट्टा',
    category: 'Heritage Tools',
    material: 'Rough-Hewn Black Granite Stone',
    desc: 'Ancient Indian flat grinding slab and cylindrical muller stone. Stone-crushes garlic, chillies, mint, and spices without friction heat, preserving pure flavor.',
    uses: 'Fresh wet chutney, Garam masala paste, Thandai',
    tip: 'Sprinkle few drops of water while rolling back and forth for silky smooth chutneys.',
    img: '/images/gamify/foods/mint-chutney.jpg',
  },
  {
    id: 'idli_steamer',
    name: 'Idli & Dhokla Steamer',
    hindi: 'इडली व ढोकला स्टीमर',
    category: 'Cookware',
    material: 'Mirror-Polished Stainless Steel',
    desc: 'Tiered steaming vessel with perforated circular cavity plates. Circulates gentle steam to cook soft, pillowy fermented South Indian idlis.',
    uses: 'Steamed Idlis, Gujarati Dhokla, Muthia',
    tip: 'Lightly grease idli plates with sesame or coconut oil before pouring fermented batter.',
    img: '/images/gamify/foods/idli.jpg',
  },
  {
    id: 'dosa_palta',
    name: 'Dosa Palta / Khunti',
    hindi: 'डोसा पलटा (खुंटी)',
    category: 'Cookware',
    material: 'Ultra-Thin Flexible Stainless Steel',
    desc: 'Flat spatula with beveled razor-thin edge. Slips effortlessly beneath paper-thin crispy dosas and parathas without tearing or wrinkling.',
    uses: 'Flipping dosas, uttapams, cheelas, parathas',
    tip: 'Slide the edge under the rim once the dosa edges naturally pull away from the tawa.',
    img: '/images/gamify/foods/masala-dosa.jpg',
  },
  {
    id: 'kansa_thali',
    name: 'Kansa Dining Thali Set',
    hindi: 'काँसा थाली सेट',
    category: 'Dining & Storage',
    material: 'Pure Bell Metal (78% Copper, 22% Tin)',
    desc: 'Ancient Ayurvedic bronze dinnerware comprising a rimmed thali, katoris for dal and subzi, sweet bowl, and brass tumbler. Revered for balancing Pitta and promoting gut health.',
    uses: 'Traditional Indian family feasting & Ayurvedic dining',
    tip: 'Eating from pure Kansa alkalizes food and enhances digestion.',
    img: '/images/gamify/foods/paneer-butter-masala.jpg',
  }
];

function IndianUtensilsCupboardView({ onClose }) {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedUtensil, setSelectedUtensil] = useState(null);

  const categories = ['All', 'Cookware', 'Heritage Tools', 'Dining & Storage'];

  const filtered = useMemo(() => {
    if (activeTab === 'All') return INDIAN_UTENSILS;
    return INDIAN_UTENSILS.filter(u => u.category === activeTab);
  }, [activeTab]);

  return (
    <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="stay-white" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <UtensilsCrossed size={24} color="#f59e0b" /> Traditional Indian Kitchen Cupboard
        </div>
        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600, marginTop: 4 }}>
          भारतीय बर्तन • Authentic Cookware, Brass Vessels & Heritage Indian Utensils
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {categories.map(cat => {
          const active = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className="stay-white"
              style={{
                ...pill,
                padding: '7px 18px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                background: active ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.08)',
                color: active ? '#111' : '#fff',
                border: active ? 'none' : '1px solid rgba(255,255,255,0.18)',
                boxShadow: active ? '0 4px 14px rgba(245,158,11,0.4)' : 'none',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── UTENSILS SHOWCASE GRID ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14,
        width: '100%',
      }}>
        {filtered.map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedUtensil(item)}
            style={{
              background: 'linear-gradient(145deg, rgba(28,24,46,0.95), rgba(16,14,26,0.98))',
              border: selectedUtensil?.id === item.id ? '2px solid #f59e0b' : '1px solid rgba(255,215,120,0.22)',
              borderRadius: 16,
              padding: 14,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              transition: 'transform .18s ease, box-shadow .18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,215,120,0.3)', flex: 'none', background: '#1c192b' }}>
                <img src={item.img} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <div className="stay-white" style={{ fontSize: 15, fontWeight: 800 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>{item.hindi}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{item.material}</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
              {item.desc}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6ee7b7' }}>Primary: {item.uses}</span>
              <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 800 }}>Inspect</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── DETAIL INSPECTION DRAWER ── */}
      {selectedUtensil && (
        <div style={{
          width: '100%',
          background: 'linear-gradient(135deg, rgba(24,20,40,0.95), rgba(36,26,56,0.95))',
          border: '1.5px solid rgba(245,158,11,0.5)',
          borderRadius: 18,
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
          animation: 'gp-pop .25s ease-out',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{selectedUtensil.name} ({selectedUtensil.hindi})</span>
              <span style={{ background: '#f59e0b', color: '#111', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>{selectedUtensil.category}</span>
            </div>
            <button onClick={() => setSelectedUtensil(null)} className="stay-white" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#fcd34d', fontWeight: 700, textTransform: 'uppercase' }}>Authentic Material</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{selectedUtensil.material}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#fcd34d', fontWeight: 700, textTransform: 'uppercase' }}>Culinary Uses</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{selectedUtensil.uses}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: '#fcd34d', fontWeight: 700, textTransform: 'uppercase' }}>Heritage Kitchen Tip</div>
              <div style={{ fontSize: 12.5, color: '#86efac', fontWeight: 600, lineHeight: 1.4 }}>{selectedUtensil.tip}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROTI STICK (CHAKLA-BELAN) INTERACTIVE GAME ──
function RotiMakerGame({ onClose }) {
  // Stages: 0: Peda Prep, 1: Rolling with Belan, 2: Tawa Sizzle & Flip, 3: Direct Flame Balloon Puff, 4: Ghee & Plating
  const [stage, setStage] = useState(0);
  const [flourDusted, setFlourDusted] = useState(false);
  const [rollsCount, setRollsCount] = useState(0);
  const [diameter, setDiameter] = useState(6); // cm
  const [roundness, setRoundness] = useState(88); // %
  const [tawaSide, setTawaSide] = useState(1);
  const [tawaSecs, setTawaSecs] = useState(0);
  const [puffProgress, setPuffProgress] = useState(0);
  const [gheeApplied, setGheeApplied] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  // Timer on Tawa
  useEffect(() => {
    if (stage !== 2) return undefined;
    const t = setInterval(() => setTawaSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage, tawaSide]);

  // Rolling Belan Action
  const rollBelan = () => {
    if (stage !== 1) return;
    setIsRolling(true);
    setRollsCount(r => r + 1);
    setDiameter(d => Math.min(18, +(d + 1.2).toFixed(1)));
    setRoundness(r => Math.min(98, r + Math.floor(Math.random() * 2) + 1));
    setTimeout(() => setIsRolling(false), 300);
  };

  const handleDustFlour = () => {
    setFlourDusted(true);
  };

  const startRolling = () => {
    setStage(1);
  };

  const transferToTawa = () => {
    setStage(2);
    setTawaSide(1);
    setTawaSecs(0);
  };

  const flipWithChimta = () => {
    setTawaSide(2);
    setTawaSecs(0);
  };

  const moveToFlame = () => {
    setStage(3);
    setPuffProgress(0);
    const interval = setInterval(() => {
      setPuffProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 25;
      });
    }, 400);
  };

  const applyDesiGhee = () => {
    setGheeApplied(true);
    setStage(4);
  };

  const resetGame = () => {
    setStage(0);
    setFlourDusted(false);
    setRollsCount(0);
    setDiameter(6);
    setRoundness(88);
    setTawaSide(1);
    setTawaSecs(0);
    setPuffProgress(0);
    setGheeApplied(false);
  };

  return (
    <div style={{ width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* ── HEADER ── */}
      <div style={{ textAlign: 'center' }}>
        <div className="stay-white" style={{ fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Sparkles size={24} color="#f59e0b" /> Ghar Ki Roti • Master Roti Maker
        </div>
        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600, marginTop: 4 }}>
          Experience the art of dough peda, wooden belan rolling, and flame balloon puffing!
        </div>
      </div>

      {/* ── GAME STAGES STEPPER ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        {[
          { id: 0, label: '1. Peda & Flour' },
          { id: 1, label: '2. Belan Rolling' },
          { id: 2, label: '3. Tawa Sizzle' },
          { id: 3, label: '4. Flame Balloon' },
          { id: 4, label: '5. Desi Ghee & Plate' },
        ].map(st => (
          <div
            key={st.id}
            style={{
              padding: '6px 12px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 800,
              background: stage === st.id ? 'linear-gradient(135deg, #f59e0b, #d97706)' : stage > st.id ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
              color: stage === st.id ? '#111' : stage > st.id ? '#86efac' : 'rgba(255,255,255,0.6)',
              border: stage === st.id ? 'none' : stage > st.id ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {stage > st.id && <Check size={12} strokeWidth={3} />}
            <span>{st.label}</span>
          </div>
        ))}
      </div>

      {/* ── INTERACTIVE WORKSPACE ARENA ── */}
      <div style={{
        width: '100%',
        minHeight: 330,
        background: 'linear-gradient(180deg, #1f1b34, #120f22)',
        border: '2px solid rgba(255,215,120,0.3)',
        borderRadius: 24,
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        {/* ── STAGE 0: PEDA & FLOUR DUSTING ── */}
        {stage === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
              Step 1: Whole wheat atta dough ball (Peda) is ready!
            </div>

            {/* Dough Ball visual on marble chakla */}
            <div style={{ position: 'relative', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, #f3ede2, #d5c8b5)', border: '8px solid #b8a692', boxShadow: '0 12px 28px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #fef3c7, #d97706)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
                border: flourDusted ? '3px dashed #fff' : 'none',
                transition: 'all .3s ease',
              }} />
              {flourDusted && (
                <div style={{ position: 'absolute', top: 20, right: 20, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 99 }}>
                  Dusted with Flour
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {!flourDusted ? (
                <button
                  onClick={handleDustFlour}
                  className="stay-white"
                  style={{
                    ...btnPill,
                    padding: '10px 20px',
                    fontSize: 13,
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#111',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                  }}
                >
                  <Sparkles size={15} /> Dust with Dry Flour (Palethan)
                </button>
              ) : (
                <button
                  onClick={startRolling}
                  className="stay-white"
                  style={{
                    ...btnPill,
                    padding: '10px 22px',
                    fontSize: 14,
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                  }}
                >
                  Start Rolling with Belan <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STAGE 1: BELAN ROLLING ON MARBLE CHAKLA ── */}
        {stage === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
            {/* Live gauges */}
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>DIAMETER</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: diameter >= 17 ? '#4ade80' : '#f59e0b' }}>{diameter} cm / 18 cm</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>ROUNDNESS</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8' }}>{roundness}%</div>
              </div>
            </div>

            {/* Marble Chakla + Expanding Roti + Belan */}
            <div style={{
              position: 'relative',
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #f5f0e8, #c8bba8)',
              border: '10px solid #9c8a74',
              boxShadow: '0 16px 36px rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }} onClick={rollBelan}>
              {/* Expanding Roti Disc */}
              <div style={{
                width: `${(diameter / 18) * 200}px`,
                height: `${(diameter / 18) * 200}px`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 45%, #fef3c7, #fde68a 70%, #d97706 100%)',
                boxShadow: 'inset 0 0 10px rgba(180,120,40,0.3), 0 4px 10px rgba(0,0,0,0.2)',
                transition: 'width .2s ease, height .2s ease',
              }} />

              {/* Wooden Belan (Rolling Pin) overlay */}
              <div style={{
                position: 'absolute',
                width: 230,
                height: 18,
                borderRadius: 9,
                background: 'linear-gradient(180deg, #8b5a2b, #5c3a1e 60%, #3e2714)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                transform: isRolling ? 'rotate(15deg) translateY(-8px)' : 'rotate(-10deg)',
                transition: 'transform .18s ease',
                pointerEvents: 'none',
              }}>
                {/* Belan Handles */}
                <div style={{ position: 'absolute', left: 4, top: 4, width: 28, height: 10, borderRadius: 5, background: '#a06a38' }} />
                <div style={{ position: 'absolute', right: 4, top: 4, width: 28, height: 10, borderRadius: 5, background: '#a06a38' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={rollBelan}
                className="stay-white"
                style={{
                  ...btnPill,
                  padding: '11px 24px',
                  fontSize: 14,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#111',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                }}
              >
                <RotateCcw size={16} /> Roll Belan Pin ({rollsCount} rolls)
              </button>

              {diameter >= 17 && (
                <button
                  onClick={transferToTawa}
                  className="stay-white"
                  style={{
                    ...btnPill,
                    padding: '11px 24px',
                    fontSize: 14,
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                  }}
                >
                  Place on Hot Tawa <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STAGE 2: HOT CAST IRON TAWA SIZZLE ── */}
        {stage === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
              {tawaSide === 1 ? 'Side 1 cooking: Watch for small steam bubbles...' : 'Side 2 cooking: Faint golden speckles formed!'}
            </div>

            {/* Black Cast Iron Tawa on burner */}
            <div style={{
              position: 'relative',
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #2d2f3d, #12131a)',
              border: '10px solid #1c1d24',
              boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Roti on tawa with bubbles */}
              <div style={{
                width: 190,
                height: 190,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 45% 45%, #fde68a, #d97706 85%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                position: 'relative',
              }}>
                {/* Chitthi / Golden roasted brown dots on Side 2 */}
                {tawaSide === 2 && (
                  <>
                    <div style={{ position: 'absolute', top: 40, left: 60, width: 14, height: 10, borderRadius: '50%', background: '#78350f' }} />
                    <div style={{ position: 'absolute', top: 80, right: 50, width: 18, height: 12, borderRadius: '50%', background: '#78350f' }} />
                    <div style={{ position: 'absolute', bottom: 50, left: 80, width: 16, height: 14, borderRadius: '50%', background: '#78350f' }} />
                    <div style={{ position: 'absolute', bottom: 70, right: 70, width: 12, height: 8, borderRadius: '50%', background: '#78350f' }} />
                  </>
                )}
                {/* Steam wisps */}
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ position: 'absolute', top: 20, left: `${30 + i * 20}%`, width: 12, height: 32, borderRadius: 12, background: 'rgba(255,255,255,0.4)', filter: 'blur(4px)', animation: `gp-steam 2.2s ease-in ${i * 0.6}s infinite` }} />
                ))}
              </div>

              {/* Tawa Handle */}
              <div style={{ position: 'absolute', right: -36, top: '46%', width: 44, height: 18, borderRadius: 6, background: '#3e2714' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {tawaSide === 1 ? (
                <button
                  onClick={flipWithChimta}
                  className="stay-white"
                  style={{
                    ...btnPill,
                    padding: '10px 22px',
                    fontSize: 14,
                    background: tawaSecs >= 3 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.15)',
                    color: tawaSecs >= 3 ? '#111' : '#fff',
                    border: 'none',
                    boxShadow: tawaSecs >= 3 ? '0 4px 16px rgba(245,158,11,0.5)' : 'none',
                  }}
                >
                  <RotateCcw size={15} /> Flip with Chimta Tongs ({tawaSecs}s)
                </button>
              ) : (
                <button
                  onClick={moveToFlame}
                  className="stay-white"
                  style={{
                    ...btnPill,
                    padding: '10px 24px',
                    fontSize: 14,
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    boxShadow: '0 4px 18px rgba(239,68,68,0.5)',
                  }}
                >
                  <Flame size={16} /> Puff on Open Gas Flame <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STAGE 3: DIRECT GAS FLAME BALLOON PUFF ── */}
        {stage === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fef08a', textAlign: 'center' }}>
              Step 4: Held over glowing flame — Phulka is ballooning up!
            </div>

            {/* Glowing gas stove burner with blue flames */}
            <div style={{ position: 'relative', width: 230, height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Blue gas flames underneath */}
              <div style={{ position: 'absolute', bottom: 30, width: 140, height: 20, display: 'flex', justifyContent: 'space-around' }}>
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{ width: 8, height: 22, borderRadius: '50% 50% 20% 20%', background: 'linear-gradient(180deg, #60a5fa, #2563eb)', animation: 'gp-flame .4s infinite alternate' }} />
                ))}
              </div>

              {/* Ballooning Phulka */}
              <div style={{
                width: 170 + (puffProgress / 100) * 40,
                height: 170 + (puffProgress / 100) * 40,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 35%, #fffbeb 0%, #fde68a 50%, #d97706 90%)',
                boxShadow: '0 0 35px rgba(245,158,11,0.6), inset 0 0 20px rgba(217,119,6,0.5)',
                transition: 'all .4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.6)',
              }}>
                {/* Chitthi charred spots */}
                <div style={{ position: 'absolute', top: 30, left: 50, width: 16, height: 10, borderRadius: '50%', background: '#78350f' }} />
                <div style={{ position: 'absolute', top: 70, right: 40, width: 18, height: 14, borderRadius: '50%', background: '#78350f' }} />
                <div style={{ position: 'absolute', bottom: 40, left: 70, width: 14, height: 10, borderRadius: '50%', background: '#78350f' }} />
              </div>

              {/* Rising steam */}
              {[0, 1, 2].map(i => (
                <span key={i} style={{ position: 'absolute', top: 10, left: `${30 + i * 20}%`, width: 14, height: 40, borderRadius: 14, background: 'rgba(255,255,255,0.45)', filter: 'blur(5px)', animation: `gp-steam 2s ease-in ${i * 0.5}s infinite` }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={applyDesiGhee}
                className="stay-white"
                style={{
                  ...btnPill,
                  padding: '11px 26px',
                  fontSize: 14,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#111',
                  border: 'none',
                  boxShadow: '0 4px 18px rgba(245,158,11,0.5)',
                }}
              >
                <Sparkles size={16} /> Brush Desi Ghee & Plate
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 4: DESI GHEE & ROYAL THALI PLATING ── */}
        {stage === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', animation: 'gp-pop .4s ease-out' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={22} /> Perfectly Puffed Balloon Phulka Ready!
            </div>

            {/* Gleaming Indian Steel Thali with Dal, Subzi & Phulka */}
            <div style={{
              position: 'relative',
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #e2e8f0, #94a3b8)',
              border: '10px solid #cbd5e1',
              boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Golden Butter Phulka */}
              <div style={{
                width: 170,
                height: 170,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 40% 40%, #fef3c7, #fde68a 60%, #d97706 90%)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
                border: '2px solid rgba(255,255,255,0.7)',
                position: 'relative',
              }}>
                {/* Desi Ghee Golden Glaze */}
                <div style={{ position: 'absolute', top: 35, left: 35, right: 35, bottom: 35, borderRadius: '50%', background: 'radial-gradient(circle, rgba(253,224,71,0.7), transparent 70%)' }} />
                {/* Chitthi spots */}
                <div style={{ position: 'absolute', top: 35, left: 55, width: 14, height: 10, borderRadius: '50%', background: '#78350f' }} />
                <div style={{ position: 'absolute', top: 75, right: 45, width: 16, height: 12, borderRadius: '50%', background: '#78350f' }} />
                <div style={{ position: 'absolute', bottom: 45, left: 70, width: 14, height: 10, borderRadius: '50%', background: '#78350f' }} />
              </div>

              {/* Little Dal Katori on side */}
              <div style={{ position: 'absolute', top: 10, right: 10, width: 62, height: 62, borderRadius: '50%', background: '#f59e0b', border: '4px solid #cbd5e1', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
              </div>
            </div>

            {/* Scorecard */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>ROUNDNESS</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#4ade80' }}>{roundness}% (Circle Master)</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>BALLOON PUFF</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>100% Full Air Phulka</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>CHEF RATING</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fcd34d' }}>5 Stars (Master Roti Ustad)</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button
                onClick={resetGame}
                className="stay-white"
                style={{
                  ...btnPill,
                  padding: '10px 22px',
                  fontSize: 14,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#111',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                }}
              >
                <RotateCcw size={15} /> Make Another Roti
              </button>
            </div>
          </div>
        )}
      </div>
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

// ── laptop in-screen browser workstation ──────────────────────────────────────
function MonitorBrowserView({ onClose }) {
  const [activeUrl, setActiveUrl] = useState('https://en.m.wikipedia.org/wiki/Portal:Arts');
  const [inputUrl, setInputUrl] = useState('https://en.m.wikipedia.org/wiki/Portal:Arts');
  const [history, setHistory] = useState(['https://en.m.wikipedia.org/wiki/Portal:Arts']);
  const [histIndex, setHistIndex] = useState(0);
  const [frameKey, setFrameKey] = useState(1);
  const [loading, setLoading] = useState(false);

  const presets = [
    { label: 'Wikipedia', url: 'https://en.m.wikipedia.org', desc: 'Free encyclopedia' },
    { label: 'DuckDuckGo', url: 'https://lite.duckduckgo.com/lite/', desc: 'Web search engine' },
    { label: '2048 Game', url: 'https://gabrielecirulli.github.io/2048/', desc: 'Play 2048 in screen' },
    { label: 'Hacker News', url: 'https://news.ycombinator.com', desc: 'Tech & Discussions' },
    { label: 'Open Library', url: 'https://openlibrary.org', desc: 'Millions of free books' },
  ];

  const resolveTarget = (raw) => {
    let clean = (raw || '').trim();
    if (!clean) return null;

    if (/^https?:\/\//i.test(clean)) {
      return { url: clean, display: clean, isSearch: false };
    }

    const hasSpace = /\s/.test(clean);
    const isDomain = !hasSpace && /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+(\/.*)?$/i.test(clean);

    if (isDomain) {
      return { url: 'https://' + clean, display: 'https://' + clean, isSearch: false };
    }

    // Treat as web search query (e.g. "william hope", "mona lisa", etc.)
    const searchUrl = `https://en.m.wikipedia.org/w/index.php?search=${encodeURIComponent(clean)}`;
    return { url: searchUrl, display: `Search: ${clean}`, isSearch: true, query: clean };
  };

  const navigateTo = (urlToLoad) => {
    const raw = (urlToLoad || inputUrl);
    const target = resolveTarget(raw);
    if (!target) return;

    setInputUrl(target.url);
    setActiveUrl(target.url);
    setFrameKey(k => k + 1);
    setLoading(true);
    setHistory(prev => [...prev.slice(0, histIndex + 1), target.url]);
    setHistIndex(prev => prev + 1);
  };

  const handleBack = () => {
    if (histIndex > 0) {
      const prevUrl = history[histIndex - 1];
      setHistIndex(i => i - 1);
      setInputUrl(prevUrl);
      setActiveUrl(prevUrl);
      setFrameKey(k => k + 1);
      setLoading(true);
    }
  };

  const handleForward = () => {
    if (histIndex < history.length - 1) {
      const nextUrl = history[histIndex + 1];
      setHistIndex(i => i + 1);
      setInputUrl(nextUrl);
      setActiveUrl(nextUrl);
      setFrameKey(k => k + 1);
      setLoading(true);
    }
  };

  const handleReload = () => {
    setFrameKey(k => k + 1);
    setLoading(true);
  };

  const handleHome = () => {
    navigateTo('https://en.m.wikipedia.org/wiki/Portal:Arts');
  };

  const getDomain = (raw) => {
    try {
      const u = new URL(raw);
      if (u.searchParams.has('search')) {
        return `Wiki: "${u.searchParams.get('search')}"`;
      }
      if (u.searchParams.has('q')) {
        return `Search: "${u.searchParams.get('q')}"`;
      }
      return u.hostname.replace('www.', '');
    } catch {
      return raw || 'Web Browser';
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 940, display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      {/* ── LAPTOP LID / SCREEN CHASSIS ── */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(180deg, #2d2640 0%, #171326 100%)',
        borderRadius: '24px 24px 8px 8px',
        padding: '16px 18px 12px',
        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.85), 0 0 45px rgba(139, 92, 246, 0.18)',
        border: '2px solid rgba(139, 92, 246, 0.35)',
        position: 'relative'
      }}>
        {/* Top Bezel with Webcam and privacy LED */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 16, marginBottom: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#090710', border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
        </div>

        {/* ── LAPTOP DISPLAY (High-res glass screen) ── */}
        <div style={{
          width: '100%',
          background: '#0d0b18',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)'
        }}>
          {/* Browser Window Bar & Tab */}
          <div style={{
            background: 'linear-gradient(180deg, #1f1934 0%, #151124 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 14px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            {/* Window control dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            </div>

            {/* Active Browser Tab */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#0d0b18',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderBottom: 'none',
              borderRadius: '10px 10px 0 0',
              padding: '6px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#ffffff',
              maxWidth: 240,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              <Globe size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{getDomain(activeUrl)}</span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
              <Laptop size={14} />
              <span>Study Laptop Session</span>
            </div>
          </div>

          {/* Browser Navigation Toolbar */}
          <div style={{
            background: '#151124',
            padding: '8px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap'
          }}>
            {/* Navigation buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handleBack}
                disabled={histIndex <= 0}
                style={{ background: 'none', border: 'none', color: histIndex > 0 ? '#fff' : 'rgba(255,255,255,0.2)', cursor: histIndex > 0 ? 'pointer' : 'default', padding: 4 }}
                title="Back"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleForward}
                disabled={histIndex >= history.length - 1}
                style={{ background: 'none', border: 'none', color: histIndex < history.length - 1 ? '#fff' : 'rgba(255,255,255,0.2)', cursor: histIndex < history.length - 1 ? 'pointer' : 'default', padding: 4 }}
                title="Forward"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={handleReload}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                title="Reload"
              >
                <RefreshCw size={14} style={{ animation: loading ? 'gp-spin 1s linear infinite' : 'none' }} />
              </button>
              <button
                onClick={handleHome}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
                title="Home"
              >
                <Home size={15} />
              </button>
            </div>

            {/* Address Input Bar */}
            <div style={{
              flex: '1 1 300px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0, 0, 0, 0.55)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 10,
              padding: '6px 12px'
            }}>
              <Lock size={13} style={{ color: '#10b981', flexShrink: 0 }} />
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && navigateTo()}
                placeholder="Search web or type URL (e.g. william hope, wikipedia.org)..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 500
                }}
              />
              <button
                onClick={() => navigateTo()}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>Go</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {/* In-screen Preset Shortcuts */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => navigateTo(p.url)}
                  style={{
                    background: activeUrl === p.url ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.06)',
                    border: activeUrl === p.url ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: '3px 9px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── THE IN-SCREEN BROWSER VIEWPORT ── */}
          <div style={{ position: 'relative', width: '100%', height: '490px', background: '#ffffff' }}>
            <iframe
              key={frameKey}
              src={activeUrl}
              title="Laptop Web Screen"
              onLoad={() => setLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                background: '#ffffff'
              }}
            />

            {/* Note banner at bottom of the embedded screen */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(18, 14, 30, 0.92)',
              backdropFilter: 'blur(8px)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '6px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11.5,
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={12} color="#10b981" />
                <span>Rendered directly inside your Study Room workstation laptop.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => window.open(activeUrl, '_blank', 'noopener,noreferrer')}
                  style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}
                  title="If site has strict security preventing iframe display"
                >
                  <span>Open in Tab</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LAPTOP LOWER HINGE & KEYBOARD DECK BASE ── */}
      <div style={{
        width: '98%',
        height: 28,
        background: 'linear-gradient(180deg, #1b162a 0%, #100d1c 100%)',
        borderRadius: '0 0 20px 20px',
        border: '2px solid rgba(139, 92, 246, 0.25)',
        borderTop: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 14px 28px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Trackpad notch indent */}
        <div style={{
          width: 90,
          height: 6,
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '0 0 6px 6px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderTop: 'none'
        }} />
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
  const ICONS_POOL = [
    { id: 'brain', label: 'Logic', Icon: Brain, color: '#a855f7' },
    { id: 'compass', label: 'Explore', Icon: Compass, color: '#38bdf8' },
    { id: 'flame', label: 'Fire', Icon: Flame, color: '#f97316' },
    { id: 'game', label: 'Play', Icon: Gamepad2, color: '#10b981' },
    { id: 'heart', label: 'Life', Icon: Heart, color: '#f43f5e' },
    { id: 'sparkles', label: 'Magic', Icon: Sparkles, color: '#eab308' },
    { id: 'trophy', label: 'Victory', Icon: Trophy, color: '#f59e0b' },
    { id: 'clock', label: 'Time', Icon: Clock, color: '#06b6d4' },
    { id: 'search', label: 'Search', Icon: Search, color: '#818cf8' },
    { id: 'globe', label: 'World', Icon: Globe, color: '#14b8a6' },
    { id: 'external', label: 'Launch', Icon: ExternalLink, color: '#ec4899' },
    { id: 'help', label: 'Mystery', Icon: HelpCircle, color: '#eab308' },
    { id: 'bulb', label: 'Idea', Icon: Lightbulb, color: '#facc15' },
    { id: 'shuffle', label: 'Random', Icon: Shuffle, color: '#8b5cf6' },
    { id: 'refresh', label: 'Renew', Icon: RefreshCw, color: '#84cc16' },
    { id: 'maximize', label: 'Focus', Icon: Maximize2, color: '#3b82f6' },
    { id: 'check', label: 'Done', Icon: Check, color: '#22c55e' },
    { id: 'laptop', label: 'Tech', Icon: Laptop, color: '#0ea5e9' },
  ];

  const [cardCount, setCardCount] = useState(32); // 32 cards (16 pairs) or 36 cards (18 pairs)
  const pairCount = cardCount / 2;

  const createDeck = (count) => {
    const pairs = count / 2;
    const selectedIcons = ICONS_POOL.slice(0, pairs);
    const deck = [];
    selectedIcons.forEach(item => {
      deck.push({ uid: `${item.id}-1`, id: item.id, item });
      deck.push({ uid: `${item.id}-2`, id: item.id, item });
    });
    return deck.sort(() => Math.random() - 0.5);
  };

  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);

  const reset = (count = cardCount) => {
    setCards(createDeck(count));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  useEffect(() => {
    reset(cardCount);
  }, [cardCount]);

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
        setTimeout(() => setFlipped([]), 650);
      }
    }
  };

  const isWon = matched.length === pairCount && pairCount > 0;
  const cols = cardCount === 32 ? 8 : 6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 12 }}>
      {/* Top Controls & Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 580, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setCardCount(32)}
            style={{
              ...btnPill,
              padding: '4px 10px', fontSize: 11.5,
              background: cardCount === 32 ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.06)',
              border: cardCount === 32 ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)'
            }}
          >
            32 Cards (16 Pairs)
          </button>
          <button
            onClick={() => setCardCount(36)}
            style={{
              ...btnPill,
              padding: '4px 10px', fontSize: 11.5,
              background: cardCount === 36 ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.06)',
              border: cardCount === 36 ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)'
            }}
          >
            36 Cards (18 Pairs)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>Moves: <span style={{ color: '#a78bfa' }}>{moves}</span></div>
          <div>Matched: <span style={{ color: '#34d399' }}>{matched.length} / {pairCount}</span></div>
          <button
            onClick={() => reset(cardCount)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RotateCcw size={12} />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* Responsive Card Grid (32 or 36 cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
        width: '100%',
        maxWidth: cols === 8 ? 620 : 520,
        padding: 12,
        background: 'rgba(0, 0, 0, 0.45)',
        borderRadius: 18,
        border: '2px solid rgba(139, 92, 246, 0.35)',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
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
                height: 58,
                borderRadius: 10,
                border: isMatched ? '2px solid #10b981' : isOpen ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.12)',
                background: isOpen
                  ? (isMatched ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.1)')
                  : 'linear-gradient(135deg, rgba(32, 24, 58, 0.95), rgba(18, 14, 36, 0.95))',
                cursor: isOpen ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isMatched ? '0 0 14px rgba(16, 185, 129, 0.45)' : '0 3px 8px rgba(0,0,0,0.3)',
                transition: 'all .16s ease-out',
                transform: isOpen ? 'scale(1)' : 'scale(0.97)',
                padding: 0
              }}
            >
              {isOpen ? (
                <Icon size={24} color={color} />
              ) : (
                <HelpCircle size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
            </button>
          );
        })}
      </div>

      {isWon && (
        <div style={{
          marginTop: 8, padding: '12px 26px', borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.45))',
          border: '1.5px solid #10b981', display: 'flex', alignItems: 'center', gap: 10, color: '#34d399', fontWeight: 800, fontSize: 15
        }}>
          <Trophy size={22} />
          <span>Extraordinary! All {pairCount} pairs matched in {moves} moves!</span>
        </div>
      )}
    </div>
  );
}

function WordScramblePuzzle() {
  const WORDS = [
    { word: 'STUDY', clue: 'Quiet room with desks, bookshelf, and cozy beanbags' },
    { word: 'GUITAR', clue: 'Six-string acoustic instrument mounted on the wall' },
    { word: 'PUZZLE', clue: 'Brain-teasing game testing logic, patience, and patterns' },
    { word: 'KEYBOARD', clue: 'Tactile typing peripheral beside each desktop monitor' },
    { word: 'MONITOR', clue: 'High-res display screen perched on every study desk' },
    { word: 'CANVAS', clue: 'Framed artwork hanging proudly in the living room' },
    { word: 'LIBRARY', clue: 'Tall wooden shelves packed with classic and modern literature' },
    { word: 'COMPASS', clue: 'Navigation instrument guiding explorers across uncharted maps' },
    { word: 'TELESCOPE', clue: 'Stargazing optic for viewing distant nebulae and planets' },
    { word: 'FOOSBALL', clue: 'Fast-paced tabletop soccer match in the game room' },
    { word: 'ARCADE', clue: 'Glowing cabinet loaded with vintage retro games' },
    { word: 'BALCONY', clue: 'Outdoor deck looking out at the skyline and night sky' },
    { word: 'FIREPLACE', clue: 'Cozy hearth radiating warmth and dancing embers' },
    { word: 'LANTERN', clue: 'Gentle glowing light casting shadows through the night' },
    { word: 'SUNSHINE', clue: 'Bright rays pouring in through the panoramic windows' },
    { word: 'SNACKS', clue: 'Delicious pizza, burgers, fries, and cold party drinks' },
  ];

  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [scramble, setScramble] = useState([]);
  const [streak, setStreak] = useState(0);
  const [status, setStatus] = useState(null); // 'correct' | 'wrong' | null
  const current = WORDS[index % WORDS.length];

  const setupWord = (w) => {
    const letters = w.word.split('').map((char, i) => ({ id: `${char}-${i}`, char, used: false }));
    // Shuffle ensuring different from target word if length > 1
    for (let attempts = 0; attempts < 5; attempts++) {
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      if (letters.map(l => l.char).join('') !== w.word) break;
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
    setStatus(null);
    setGuess(g => g + item.char);
    setScramble(prev => prev.map(l => l.id === item.id ? { ...l, used: true } : l));
  };

  const handleRemoveLetterAt = (charIdx) => {
    if (status === 'correct') return;
    setStatus(null);
    const targetChar = guess[charIdx];
    const newGuess = guess.slice(0, charIdx) + guess.slice(charIdx + 1);
    setGuess(newGuess);

    // Unmark the corresponding used letter chip
    let restored = false;
    setScramble(prev => prev.map(l => {
      if (!restored && l.used && l.char === targetChar) {
        restored = true;
        return { ...l, used: false };
      }
      return l;
    }));
  };

  const handleBackspace = () => {
    if (!guess.length || status === 'correct') return;
    handleRemoveLetterAt(guess.length - 1);
  };

  const handleClearAll = () => {
    setGuess('');
    setScramble(prev => prev.map(l => ({ ...l, used: false })));
    setStatus(null);
  };

  const checkAnswer = () => {
    if (!guess) return;
    if (guess.trim().toUpperCase() === current.word.toUpperCase()) {
      setStatus('correct');
      setStreak(s => s + 1);
    } else {
      setStatus('wrong');
    }
  };

  const nextWord = () => {
    setIndex(i => i + 1);
  };

  const giveHint = () => {
    if (status === 'correct') return;
    setStatus(null);
    const targetChar = current.word[guess.length];
    if (!targetChar) return;
    const found = scramble.find(l => !l.used && l.char === targetChar);
    if (found) {
      handleLetterClick(found);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 14 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 460, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
        <div>Word: <span style={{ color: '#a78bfa' }}>{(index % WORDS.length) + 1} / {WORDS.length}</span></div>
        <div>Streak: <span style={{ color: '#f59e0b' }}>{streak}</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={giveHint}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Lightbulb size={12} color="#f59e0b" />
            <span>Hint</span>
          </button>
          <button
            onClick={nextWord}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            title="Skip to next word"
          >
            <span>Skip</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 460, padding: '16px 20px',
        background: 'rgba(0, 0, 0, 0.45)', borderRadius: 18,
        border: '1.5px solid rgba(139, 92, 246, 0.35)',
        display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center'
      }}>
        <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', textAlign: 'center' }}>
          Clue: &ldquo;{current.clue}&rdquo;
        </div>

        {/* Current Guess Slot with tap-to-remove letters */}
        <div style={{
          minHeight: 56, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.05)', borderRadius: 14,
          padding: '8px 14px',
          border: status === 'correct' ? '2.5px solid #10b981' : status === 'wrong' ? '2.5px solid #ef4444' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: status === 'correct' ? '0 0 16px rgba(16, 185, 129, 0.3)' : status === 'wrong' ? '0 0 16px rgba(239, 68, 68, 0.3)' : 'none',
          transition: 'border .2s, box-shadow .2s'
        }}>
          {guess ? guess.split('').map((c, i) => (
            <button
              key={i}
              onClick={() => handleRemoveLetterAt(i)}
              title="Tap to remove this letter"
              style={{
                background: 'rgba(139, 92, 246, 0.25)',
                border: '1px solid rgba(139, 92, 246, 0.45)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 22,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '0.04em',
                cursor: 'pointer'
              }}
            >
              {c}
            </button>
          )) : (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Tap letters below to arrange your answer</span>
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
                boxShadow: item.used ? 'none' : '0 4px 10px rgba(0,0,0,0.35)',
                transition: 'all .14s ease-out'
              }}
            >
              {item.char}
            </button>
          ))}
        </div>

        {/* Action Buttons: Clear All, Clear Last, Check Answer / Next Word */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={handleClearAll}
            disabled={!guess.length}
            style={{
              ...btnPill,
              padding: '8px 14px', fontSize: 12,
              background: guess.length ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              opacity: guess.length ? 1 : 0.4,
              cursor: guess.length ? 'pointer' : 'default'
            }}
          >
            Clear All
          </button>
          <button
            onClick={handleBackspace}
            disabled={!guess.length}
            style={{
              ...btnPill,
              padding: '8px 14px', fontSize: 12,
              background: guess.length ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              opacity: guess.length ? 1 : 0.4,
              cursor: guess.length ? 'pointer' : 'default'
            }}
          >
            Clear Last
          </button>

          {status !== 'correct' ? (
            <button
              onClick={checkAnswer}
              disabled={!guess}
              style={{
                ...btnPill,
                padding: '8px 22px',
                fontSize: 13,
                background: guess ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                border: 'none',
                opacity: guess ? 1 : 0.5,
                boxShadow: guess ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none'
              }}
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={nextWord}
              style={{
                ...btnPill,
                padding: '8px 26px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                border: '1px solid #a78bfa',
                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.5)',
                animation: 'gp-glow 1.5s ease-in-out infinite'
              }}
            >
              <span>Next Word</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Clear Textual Feedback Banner for Wrong / Correct states */}
      {status === 'wrong' && (
        <div style={{
          padding: '10px 20px', borderRadius: 12,
          background: 'rgba(239, 68, 68, 0.25)', border: '1.5px solid #ef4444',
          color: '#fca5a5', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <X size={18} color="#ef4444" />
          <span>Not quite! &ldquo;{guess}&rdquo; is not the secret word for this clue. Tap &ldquo;Clear All&rdquo; or use a Hint.</span>
        </div>
      )}

      {status === 'correct' && (
        <div style={{
          padding: '12px 24px', borderRadius: 14,
          background: 'rgba(16, 185, 129, 0.28)', border: '1.5px solid #10b981',
          color: '#34d399', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)'
        }}>
          <Check size={20} />
          <span>Brilliant! &ldquo;{current.word}&rdquo; is correct! Click &ldquo;Next Word&rdquo; to continue your streak!</span>
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

// ── luxury live analog clock component ──────────────────────────────────────
function LuxuryAnalogClock({ time }) {
  const { t } = useTranslation();
  const sec = time.getSeconds();
  const min = time.getMinutes();
  const hr = time.getHours();

  const secAngle = sec * 6;
  const minAngle = min * 6 + (sec / 60) * 6;
  const hrAngle = (hr % 12) * 30 + (min / 60) * 30;

  const romanNumerals = [
    { num: 'XII', angle: 0 },
    { num: 'I', angle: 30 },
    { num: 'II', angle: 60 },
    { num: 'III', angle: 90 },
    { num: 'IV', angle: 120 },
    { num: 'V', angle: 150 },
    { num: 'VI', angle: 180 },
    { num: 'VII', angle: 210 },
    { num: 'VIII', angle: 240 },
    { num: 'IX', angle: 270 },
    { num: 'X', angle: 300 },
    { num: 'XI', angle: 330 },
  ];

  const size = 250;
  const radius = size / 2;
  const center = radius;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '4px 0 10px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="clockDialGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#241b3e" />
            <stop offset="65%" stopColor="#141026" />
            <stop offset="100%" stopColor="#0a0815" />
          </radialGradient>
          <linearGradient id="clockGoldBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="25%" stopColor="#d97706" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="75%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
          <linearGradient id="clockHandGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          <filter id="clockDropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Outer casing */}
        <circle cx={center} cy={center} r={radius - 4} fill="url(#clockDialGrad)" stroke="url(#clockGoldBezel)" strokeWidth="7" filter="url(#clockDropShadow)" />
        <circle cx={center} cy={center} r={radius - 11} fill="none" stroke="rgba(255, 215, 120, 0.45)" strokeWidth="1" strokeDasharray="3,3" />

        {/* 60 Minute tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const isMajor = i % 5 === 0;
          const a = (i * 6) * Math.PI / 180;
          const r1 = radius - 14;
          const r2 = radius - (isMajor ? 26 : 19);
          const x1 = center + r1 * Math.sin(a);
          const y1 = center - r1 * Math.cos(a);
          const x2 = center + r2 * Math.sin(a);
          const y2 = center - r2 * Math.cos(a);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMajor ? '#fcd34d' : 'rgba(255,255,255,0.28)'}
              strokeWidth={isMajor ? 2.2 : 1}
            />
          );
        })}

        {/* 12 Roman Numerals */}
        {romanNumerals.map(({ num, angle }) => {
          const a = (angle * Math.PI) / 180;
          const numR = radius - 41;
          const nx = center + numR * Math.sin(a);
          const ny = center - numR * Math.cos(a) + 4.5;
          return (
            <text
              key={num}
              x={nx}
              y={ny}
              textAnchor="middle"
              fill="#fef08a"
              fontSize={num === 'XII' || num === 'VI' ? 13.5 : 11.5}
              fontWeight="800"
              fontFamily="Georgia, 'Times New Roman', serif"
              letterSpacing="0.05em"
              style={{ textShadow: '0 0 4px rgba(253,224,71,0.4)' }}
            >
              {num}
            </text>
          );
        })}

        {/* Inscription text */}
        <text x={center} y={center - 30} textAnchor="middle" fill="rgba(255,215,120,0.85)" fontSize="9" fontWeight="800" letterSpacing="0.18em">
          SAHAPLAY
        </text>
        <text x={center} y={center - 20} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="700" letterSpacing="0.14em">
          {t('gamify.clock.chronometer', 'CHRONOMETER').toUpperCase()}
        </text>

        {/* Hour Hand */}
        <g transform={`rotate(${hrAngle}, ${center}, ${center})`}>
          <polygon
            points={`${center - 4},${center + 12} ${center - 3},${center - 55} ${center},${center - 65} ${center + 3},${center - 55} ${center + 4},${center + 12}`}
            fill="url(#clockHandGold)"
            stroke="#92400e"
            strokeWidth="0.8"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
          />
          <line x1={center} y1={center - 15} x2={center} y2={center - 50} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Minute Hand */}
        <g transform={`rotate(${minAngle}, ${center}, ${center})`}>
          <polygon
            points={`${center - 3},${center + 15} ${center - 2.5},${center - 78} ${center},${center - 90} ${center + 2.5},${center - 78} ${center + 3},${center + 15}`}
            fill="url(#clockHandGold)"
            stroke="#92400e"
            strokeWidth="0.8"
            filter="drop-shadow(0 3px 6px rgba(0,0,0,0.7))"
          />
          <line x1={center} y1={center - 20} x2={center} y2={center - 72} stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Second Hand */}
        <g transform={`rotate(${secAngle}, ${center}, ${center})`}>
          <line x1={center} y1={center + 24} x2={center} y2={center - 98} stroke="#ef4444" strokeWidth="1.6" filter="drop-shadow(0 2px 4px rgba(239,68,68,0.5))" />
          <circle cx={center} cy={center + 15} r="4" fill="#ef4444" />
          <circle cx={center} cy={center - 72} r="2.5" fill="#ef4444" />
        </g>

        {/* Center Pinion Jewel Cap */}
        <circle cx={center} cy={center} r={6.5} fill="url(#clockHandGold)" stroke="#92400e" strokeWidth="1" />
        <circle cx={center} cy={center} r={2.5} fill="#ef4444" />
      </svg>
    </div>
  );
}

// ── luxury live clock view ───────────────────────────────────────────────────
function LuxuryClockView() {
  const { t, i18n } = useTranslation();
  const lng = i18n.language || undefined;
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

  const dateStr = time.toLocaleDateString(lng, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const worldCities = [
    { city: t('gamify.clock.london', 'London'), id: 'london', tz: 'Europe/London' },
    { city: t('gamify.clock.newyork', 'New York'), id: 'newyork', tz: 'America/New_York' },
    { city: t('gamify.clock.tokyo', 'Tokyo'), id: 'tokyo', tz: 'Asia/Tokyo' },
    { city: t('gamify.clock.mumbai', 'Mumbai'), id: 'mumbai', tz: 'Asia/Kolkata' },
  ];

  return (
    <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(38,28,74,0.95), rgba(12,10,24,0.98))',
        border: '1px solid rgba(255, 215, 120, 0.4)',
        borderRadius: 24,
        boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 50px rgba(255, 215, 120, 0.15)',
        padding: '24px 22px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fcd34d' }}>
          <Clock size={24} />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {t('gamify.clock.title', 'Living Room Timepiece')}
          </span>
        </div>

        {/* Analog Clock Dial */}
        <LuxuryAnalogClock time={time} />

        {/* Digital display */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.65)',
          border: '1.5px solid rgba(255, 215, 120, 0.5)',
          borderRadius: 18,
          padding: '12px 32px',
          display: 'flex', alignItems: 'baseline', gap: 12,
          boxShadow: 'inset 0 0 25px rgba(255, 215, 120, 0.15)',
        }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: '#ffffff', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {pad(displayHours)}:{pad(minutes)}:{pad(seconds)}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fcd34d' }}>
            {ampm}
          </span>
        </div>

        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>
          {dateStr}
        </div>

        {/* World Time zones */}
        <div style={{ width: '100%', marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}>
            {t('gamify.clock.reference', 'Global Reference Clocks')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {worldCities.map(({ city, id, tz }) => {
              const cityTime = time.toLocaleTimeString(lng, { timeZone: tz, hour: '2-digit', minute: '2-digit' });
              return (
                <div key={id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{city}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fcd34d', fontFamily: 'monospace' }}>{cityTime}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mona Lisa Masterpiece Detail & Secrets Viewer ───────────────────────────
const MONA_LISA_SECRETS = [
  {
    id: 'smile',
    num: 1,
    title: 'The Elusive Sfumato Smile',
    subtitle: 'Optical Neuroscience & 30 Micro-Glazes',
    hotspot: { x: 50, y: 35 },
    side: 'left',
    targetY: 85,
    curator: 'Why the smile appears and vanishes as you gaze across her face',
    details: [
      'Leonardo pioneered his revolutionary "sfumato" technique (from Italian sfumare, "to evaporate like smoke"), fusing shades without sharp lines or perceptible brushstrokes.',
      'He painted with up to 30 ultrathin micro-layers of tinted oil glaze, each less than 2 micrometers thick—one-fiftieth the thickness of a human hair.',
      'Harvard neurobiologist Prof. Margaret Livingstone proved her smile engages human peripheral vision: looking straight at her mouth activates central foveal sharpness where lips look serene; glancing at her eyes triggers peripheral low-frequency shadow vision, causing the smile to dramatically broaden!'
    ],
    discovery: 'Louvre High-Resolution Multispectral Analysis & Harvard Medical School'
  },
  {
    id: 'eyebrows',
    num: 2,
    title: 'The Vanished Eyebrows & Lashes',
    subtitle: 'Florentine Aristocratic Trend & 240MP Scans',
    hotspot: { x: 48, y: 28 },
    side: 'left',
    targetY: 230,
    curator: '16th-century high fashion and 500 years of gentle conservation',
    details: [
      'In high Renaissance Florence, aristocratic noblewomen plucked their eyebrows and upper hairlines to accentuate high, curved foreheads—the supreme symbol of spiritual elegance.',
      'In 2007, French optical engineer Pascal Cotte conducted 240-megapixel multispectral scans across 13 light frequencies at the Louvre, discovering microscopic strokes of a single eyebrow hair.',
      'This proved Leonardo did initially paint fine eyebrows and eyelashes, but 500 years of gentle varnish cleanings gradually dissolved the delicate top surface glaze.'
    ],
    discovery: 'Pascal Cotte 240MP Multispectral Camera Investigation (2007)'
  },
  {
    id: 'veil',
    num: 3,
    title: 'The Maternity "Guarnello" Veil',
    subtitle: 'Lisa Gherardini\'s Postpartum Secret',
    hotspot: { x: 37, y: 20 },
    side: 'left',
    targetY: 375,
    curator: 'Costume evidence confirming portrait timing and sitter identity',
    details: [
      'Draped delicately across her dark curled hair is an ethereal, nearly transparent silk gauze veil known in Renaissance Italy as a "guarnello".',
      'Historical costume researchers confirmed that a guarnello was worn exclusively by Italian Renaissance mothers during pregnancy or shortly after giving birth.',
      'This crucial detail confirmed archival records in Florence: wealthy silk merchant Francesco del Giocondo commissioned Leonardo to paint his wife Lisa Gherardini to celebrate the birth of their second son, Andrea, in December 1502.'
    ],
    discovery: 'Archivio di Stato di Firenze & NRC Canada 3D Laser Scanning'
  },
  {
    id: 'horizon',
    num: 4,
    title: 'The Asymmetric Tuscan Horizon',
    subtitle: 'Optical Forced Depth & Ponte Buriano',
    hotspot: { x: 77, y: 44 },
    side: 'right',
    targetY: 85,
    curator: 'Intentional horizon mismatch that creates monumental presence',
    details: [
      'Look closely at the background horizon: the landscape on the left is positioned noticeably lower than the rocky landscape on the right.',
      'Leonardo intentionally engineered this horizon mismatch: because human eyes scan horizontally, the forced perspective discrepancy tricks the brain into perceiving continuous motion, making Mona Lisa appear taller and more commanding.',
      'Art historians and Tuscan geologists identified the medieval stone bridge over her left shoulder as Ponte Buriano, built across the River Arno near Arezzo in 1277.'
    ],
    discovery: 'Tuscan Landscape Topography & Geological Field Studies'
  },
  {
    id: 'initials',
    num: 5,
    title: 'Microscopic Letters in the Eyes',
    subtitle: 'Da Vinci\'s Clandestine Micro-Signatures',
    hotspot: { x: 53, y: 30 },
    side: 'right',
    targetY: 230,
    curator: 'Secret alphanumeric codes hidden inside her dark pupils',
    details: [
      'In 2010, Italy\'s National Committee for Cultural Heritage discovered tiny alphanumeric characters painted into Mona Lisa\'s pupils under 50x magnification.',
      'Inside her right pupil, researchers identified the distinct letters "LV"—Leonardo da Vinci\'s personal signature initials.',
      'Inside her left pupil are faint symbols resembling "CE" or "B", alongside the number "72" painted beneath an arch of the background bridge.'
    ],
    discovery: 'Italian National Committee for Cultural Heritage Microscope Analysis (2010)'
  },
  {
    id: 'hands',
    num: 6,
    title: 'The Golden Pyramidal Hands',
    subtitle: 'Pozzetto Armchair & Renaissance Harmony',
    hotspot: { x: 52, y: 77 },
    side: 'right',
    targetY: 375,
    curator: 'The supreme standard of classical portrait composition',
    details: [
      'Mona Lisa\'s folded hands rest upon the wooden arm of a "pozzetto" chair, forming the solid base of Leonardo\'s Golden Ratio pyramidal triangle (Φ ≈ 1.618).',
      'Her right hand gently rests atop her left wrist—a gesture praised by Giorgio Vasari in 1550 as "more divine than human," embodying serenity, fidelity, and timeless grace.',
      'Raphael was so captivated when visiting Leonardo\'s workshop that he sketched her hands, establishing this pose as the gold standard for European portraiture for centuries.'
    ],
    discovery: 'Louvre Structural Analysis & Giorgio Vasari "Lives of the Artists" (1550)'
  }
];

function MonaLisaDetailViewer({ onClose }) {
  const { t } = useTranslation();
  const tx = (sc, f) => t(`gamify.monalisa.${sc.id}.${f}`, sc[f]);
  const td = (sc) => sc.details.map((d, i) => t(`gamify.monalisa.${sc.id}.d${i + 1}`, d));
  const [activeSecret, setActiveSecret] = useState('smile');
  const [showAllLines, setShowAllLines] = useState(true);

  const pw = 340;
  const ph = 506;

  return (
    <div style={{ width: '100%', maxWidth: 1160, display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', padding: '10px 0 30px' }}>
      {/* ── MUSEUM HEADER ── */}
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(90deg, rgba(22, 16, 40, 0.95), rgba(42, 28, 66, 0.95))',
        border: '1.5px solid rgba(255, 215, 120, 0.4)',
        borderRadius: 20,
        padding: '14px 24px',
        marginBottom: 18,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #d4af37, #b45309)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#120e24', boxShadow: '0 4px 14px rgba(212,175,55,0.4)'
          }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fcd34d', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {t('gamify.monalisa.museum', 'Musée du Louvre • Paris • Salle des États')}
              </span>
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em' }}>
              {t('gamify.monalisa.title', 'La Gioconda — The Mona Lisa')}
            </h2>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
              {t('gamify.monalisa.subtitle', 'Leonardo di ser Piero da Vinci (c. 1503–1519) • Interactive Masterpiece Inspection')}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowAllLines(!showAllLines)}
            style={{
              background: showAllLines ? 'linear-gradient(135deg, #d4af37, #92400e)' : 'rgba(255,255,255,0.08)',
              border: showAllLines ? '1px solid #fef08a' : '1px solid rgba(255,255,255,0.18)',
              color: '#ffffff',
              borderRadius: 10,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all .2s'
            }}
          >
            <Compass size={14} />
            <span>{showAllLines ? t('gamify.monalisa.linesOn', 'All Pointer Lines Visible') : t('gamify.monalisa.linesOff', 'Show All Pointer Lines')}</span>
          </button>
        </div>
      </div>

      {/* ── 3-COLUMN EXHIBITION STAGE ── */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: 18,
        flexWrap: 'wrap'
      }}>
        {/* Left Secrets Column (1, 2, 3) */}
        <div style={{ flex: '1 1 320px', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MONA_LISA_SECRETS.filter(s => s.side === 'left').map(s => {
            const isSelected = activeSecret === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActiveSecret(s.id)}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, rgba(62,40,94,0.95), rgba(28,18,48,0.98))' : 'rgba(20, 16, 34, 0.75)',
                  border: isSelected ? '1.5px solid #fcd34d' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(252,211,77,0.2)' : '0 4px 14px rgba(0,0,0,0.4)',
                  transition: 'all .25s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: isSelected ? '#fcd34d' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#120e24' : '#fff',
                      fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {s.num}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: isSelected ? '#fcd34d' : '#ffffff' }}>
                      {tx(s, 'title')}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 11.5, color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 8 }}>
                  {tx(s, 'subtitle')}
                </div>

                {isSelected ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,215,120,0.2)' }}>
                    <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.55 }}>
                      {td(s).map((d, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>{d}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} />
                      <span>{tx(s, 'discovery')}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                    {tx(s, 'curator')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Center Framed Canvas with SVG Leader Lines */}
        <div style={{
          position: 'relative',
          width: pw,
          height: ph,
          flexShrink: 0,
          background: '#0d0914',
          borderRadius: 14,
          boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.25)',
          border: '10px solid #b8860b',
          outline: '3px solid #1a120c'
        }}>
          {/* Baroque Gilded Frame Inset */}
          <div style={{
            position: 'absolute', inset: 0,
            boxShadow: 'inset 0 0 25px rgba(0,0,0,0.85), inset 0 0 6px rgba(255,215,120,0.5)',
            border: '2px solid rgba(255,215,120,0.6)',
            pointerEvents: 'none',
            zIndex: 15
          }} />

          {/* The real painting (public domain, Louvre) */}
          <img src={MONA_LISA_IMG} alt={t('gamify.monalisa.title', 'La Gioconda - The Mona Lisa')} draggable={false} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />

          {/* ── SVG DYNAMIC LEADER LINES ── */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 12 }}>
            <defs>
              <filter id="leaderGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {MONA_LISA_SECRETS.map(s => {
              const isSelected = activeSecret === s.id;
              const isVisible = showAllLines || isSelected;
              if (!isVisible) return null;

              const px = (s.hotspot.x / 100) * pw;
              const py = (s.hotspot.y / 100) * ph;
              const edgeX = s.side === 'left' ? 0 : pw;
              const edgeY = s.targetY;
              const midX = s.side === 'left' ? px - 35 : px + 35;

              return (
                <g key={`line-${s.id}`}>
                  <path
                    d={`M ${px} ${py} Q ${midX} ${edgeY} ${edgeX} ${edgeY}`}
                    fill="none"
                    stroke={isSelected ? '#fcd34d' : 'rgba(255, 215, 120, 0.45)'}
                    strokeWidth={isSelected ? 3.0 : 1.6}
                    strokeDasharray={isSelected ? 'none' : '4,3'}
                    filter={isSelected ? 'url(#leaderGlow)' : 'none'}
                  />
                  <circle cx={edgeX} cy={edgeY} r={isSelected ? 5 : 3.5} fill="#fcd34d" stroke="#120e24" strokeWidth="1.5" />
                </g>
              );
            })}
          </svg>

          {/* ── INTERACTIVE HOTSPOT PINS ── */}
          {MONA_LISA_SECRETS.map(s => {
            const isSelected = activeSecret === s.id;
            return (
              <div
                key={`pin-${s.id}`}
                onClick={() => setActiveSecret(s.id)}
                style={{
                  position: 'absolute',
                  left: `${s.hotspot.x}%`,
                  top: `${s.hotspot.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20,
                  cursor: 'pointer'
                }}
                title={tx(s, 'title')}
              >
                <div style={{
                  position: 'absolute', inset: -7, borderRadius: '50%',
                  background: isSelected ? 'rgba(253, 224, 71, 0.45)' : 'rgba(255, 255, 255, 0.22)',
                  animation: 'gp-pulse 1.8s infinite ease-out'
                }} />
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: isSelected ? 'linear-gradient(135deg, #fef08a, #d97706)' : 'rgba(18, 14, 36, 0.92)',
                  border: isSelected ? '2px solid #ffffff' : '1.5px solid #fcd34d',
                  color: isSelected ? '#120e24' : '#fcd34d',
                  fontSize: 11, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isSelected ? '0 0 14px #fcd34d' : '0 2px 6px rgba(0,0,0,0.6)',
                  transition: 'all .2s'
                }}>
                  {s.num}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Secrets Column (4, 5, 6) */}
        <div style={{ flex: '1 1 320px', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MONA_LISA_SECRETS.filter(s => s.side === 'right').map(s => {
            const isSelected = activeSecret === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActiveSecret(s.id)}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, rgba(62,40,94,0.95), rgba(28,18,48,0.98))' : 'rgba(20, 16, 34, 0.75)',
                  border: isSelected ? '1.5px solid #fcd34d' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(252,211,77,0.2)' : '0 4px 14px rgba(0,0,0,0.4)',
                  transition: 'all .25s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: isSelected ? '#fcd34d' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#120e24' : '#fff',
                      fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {s.num}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: isSelected ? '#fcd34d' : '#ffffff' }}>
                      {tx(s, 'title')}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 11.5, color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 8 }}>
                  {tx(s, 'subtitle')}
                </div>

                {isSelected ? (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,215,120,0.2)' }}>
                    <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.55 }}>
                      {td(s).map((d, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>{d}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} />
                      <span>{tx(s, 'discovery')}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                    {tx(s, 'curator')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── LOUVRE OFFICIAL DOSSIER BAR ── */}
      <div style={{
        width: '100%',
        maxWidth: 1060,
        marginTop: 20,
        background: 'rgba(15, 12, 26, 0.85)',
        border: '1px solid rgba(255, 215, 120, 0.25)',
        borderRadius: 16,
        padding: '12px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('gamify.monalisa.labelMedium', 'Artwork Medium')}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>{t('gamify.monalisa.valueMedium', 'Oil on Poplar Wood Panel')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('gamify.monalisa.labelDims', 'Physical Dimensions')}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>{t('gamify.monalisa.valueDims', '77 cm × 53 cm (30 in × 21 in)')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('gamify.monalisa.labelAccession', 'Louvre Accession')}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>{t('gamify.monalisa.valueAccession', 'INV. 779 • Salle des États (Room 711)')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('gamify.monalisa.labelCommission', 'Historical Commission')}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>{t('gamify.monalisa.valueCommission', 'Francesco del Giocondo (Florence, 1503)')}</span>
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
  const { t } = useTranslation();
  const [book, setBook] = useState(null);
  useEscape(onClose);
  return createPortal(
    <div className="gcw-force-dark" style={overlay} onClick={onClose}>
      <style>{CSS}</style>
      <button onClick={onClose} className="stay-white" style={closeBtn} title={t('gamify.close', 'Close')}><X size={20} /></button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {kind === 'books' && (book ? <BookReader book={book} onBack={() => setBook(null)} /> : <BookshelfView shelfId={arg} onPick={setBook} />)}
        {kind === 'fridge' && <FridgeView set={arg} />}
        {kind === 'oven' && <OvenView set={arg} />}
        {kind === 'stove' && <StoveView set={arg} />}
        {kind === 'cupboard' && <IndianUtensilsCupboardView onClose={onClose} />}
        {kind === 'roti' && <RotiMakerGame onClose={onClose} />}
        {kind === 'wardrobe' && <WardrobeView id={arg} />}
        {kind === 'cosmetics' && <CosmeticsView />}
        {kind === 'telescope' && <ViewerBoundary><Suspense fallback={<div className="stay-white" style={{ marginTop: 120, fontWeight: 700 }}>Pointing the telescope...</div>}><SpaceViewer /></Suspense></ViewerBoundary>}
        {kind === 'garden' && <GardenView arg={arg} />}
        {kind === 'game' && <ViewerBoundary><Suspense fallback={<div className="stay-white" style={{ marginTop: 120, fontWeight: 700 }}>Loading...</div>}><GameViewer id={arg} /></Suspense></ViewerBoundary>}
        {kind === 'monitor' && <MonitorBrowserView onClose={onClose} />}
        {kind === 'puzzles' && <PuzzleGameView />}
        {kind === 'clock' && <LuxuryClockView />}
        {kind === 'monalisa' && <MonaLisaDetailViewer onClose={onClose} />}
        {kind === 'dog' && <DogCareView onClose={onClose} />}
      </div>
    </div>,
    document.body,
  );
}
