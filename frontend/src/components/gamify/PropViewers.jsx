import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { BOOKS, FRIDGE_SHELVES } from '../../data/gamifyBooks';

// Full-screen "look closer" views for props in the Gamify house: the bookshelf
// (tap a book to read it) and the fridge (hover an item for its name). They are
// plain DOM portals above the whole app, so they work the same on phones.

const overlay = {
  position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  background: 'radial-gradient(circle at 50% 35%, rgba(40,26,80,0.96), rgba(8,6,20,0.98))', backdropFilter: 'blur(8px)',
  padding: 16, overflow: 'auto', animation: 'gp-fade .2s ease-out',
};
const closeBtn = {
  position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(12,10,24,0.75)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2,
};
const pill = { background: 'rgba(12,10,24,0.78)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 99, color: '#fff' };

const CSS = `
@keyframes gp-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes gp-open { from { opacity: 0; transform: perspective(1200px) rotateY(-28deg) scale(.92) } to { opacity: 1; transform: perspective(1200px) rotateY(0) scale(1) } }
@keyframes gp-page { from { opacity: 0; transform: perspective(1200px) rotateY(14deg) translateX(18px) } to { opacity: 1; transform: perspective(1200px) rotateY(0) translateX(0) } }
`;

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

function BookReader({ book, onBack }) {
  // 0 = closed cover, 1 = open spread, 2 = the end
  const [sheet, setSheet] = useState(0);
  const paper = { background: 'linear-gradient(90deg,#efe3c8,#f8eed8 12%,#f8eed8)', color: '#2a1f10', fontFamily: 'Georgia, "Times New Roman", serif' };
  const small = typeof window !== 'undefined' && window.innerWidth < 640;
  const pageStyle = { ...paper, flex: 1, padding: small ? '22px 20px' : '34px 30px', fontSize: small ? 15 : 17, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflow: 'auto', minHeight: 0 };
  const next = () => setSheet(s => Math.min(2, s + 1));
  const prev = () => setSheet(s => Math.max(0, s - 1));
  return (
    <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <button onClick={onBack} className="stay-white" style={{ ...pill, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
        <ArrowLeft size={15} /> Back to shelf
      </button>
      <div key={sheet} style={{ width: '100%', height: small ? '62vh' : 'min(66vh, 520px)', animation: sheet === 1 ? 'gp-open .45s ease-out' : 'gp-page .35s ease-out', display: 'flex', borderRadius: 10, boxShadow: '0 30px 70px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
        {sheet === 0 && (
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${book.color}, #1a1030)`, color: book.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, fontFamily: 'Georgia, serif', border: '6px double rgba(255,255,255,0.35)', boxSizing: 'border-box' }}>
            <div style={{ fontSize: small ? 24 : 34, fontWeight: 700, lineHeight: 1.2 }}>{book.title}</div>
            <div style={{ width: 80, height: 2, background: 'currentColor', opacity: 0.6, margin: '18px 0' }} />
            <div style={{ fontSize: small ? 15 : 19, fontStyle: 'italic' }}>{book.author}</div>
          </div>
        )}
        {sheet === 1 && (
          <>
            <div style={{ ...pageStyle, borderRight: '1px solid rgba(0,0,0,0.15)' }}>{book.pages[0]}<div style={{ marginTop: 18, fontSize: 12, opacity: 0.55, textAlign: 'center' }}>1</div></div>
            {!small && <div style={pageStyle}>{book.pages[1]}<div style={{ marginTop: 18, fontSize: 12, opacity: 0.55, textAlign: 'center' }}>2</div></div>}
          </>
        )}
        {sheet === 2 && (
          <div style={{ ...paper, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontSize: 15, lineHeight: 1.6 }}>
            <div>The End of this excerpt.<div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>Public-domain text or original retelling.</div></div>
          </div>
        )}
      </div>
      {sheet === 1 && small && (
        <div style={{ ...paper, width: '100%', borderRadius: 10, padding: '18px 20px', fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>{book.pages[1]}</div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={prev} disabled={sheet === 0} className="stay-white" style={{ ...pill, padding: '9px 16px', cursor: sheet === 0 ? 'default' : 'pointer', opacity: sheet === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}><ChevronLeft size={16} /> Previous</button>
        <button onClick={next} disabled={sheet === 2} className="stay-white" style={{ ...pill, padding: '9px 16px', cursor: sheet === 2 ? 'default' : 'pointer', opacity: sheet === 2 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>{sheet === 0 ? 'Open book' : 'Next'} <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function BookshelfView({ onPick }) {
  const rows = [BOOKS.slice(0, 4), BOOKS.slice(4)];
  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      <div className="stay-white" style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Bookshelf</div>
      <div className="stay-white" style={{ textAlign: 'center', fontSize: 13, opacity: 0.7, marginBottom: 18 }}>Tap a book to read it</div>
      <div style={{ background: 'linear-gradient(180deg,#3a2a1a,#2a1d12)', borderRadius: 14, padding: '18px 18px 10px', boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 4px #4a3322' }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6, minHeight: 190, padding: '0 6px', background: 'rgba(0,0,0,0.28)', borderRadius: 6 }}>
              {row.map(b => (
                <button
                  key={b.id}
                  onClick={() => onPick(b)}
                  title={b.title}
                  style={{
                    width: 44 + b.w * 110, height: 90 + b.h * 100, border: 'none', cursor: 'pointer', borderRadius: '3px 3px 1px 1px', position: 'relative',
                    background: `linear-gradient(90deg, rgba(255,255,255,0.18), rgba(0,0,0,0.18) 85%), ${b.color}`, color: b.ink, boxShadow: '2px 0 6px rgba(0,0,0,0.5)',
                    transition: 'transform .18s', padding: '8px 2px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-12px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                >
                  <span style={{ writingMode: 'vertical-rl', fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: '0.02em', maxHeight: '100%', overflow: 'hidden', display: 'block', margin: '0 auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                </button>
              ))}
            </div>
            <div style={{ height: 12, background: 'linear-gradient(180deg,#7a5232,#4a3322)', borderRadius: 3, boxShadow: '0 4px 8px rgba(0,0,0,0.5)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── fridge ───────────────────────────────────────────────────────────────────
function ItemArt({ kind, color, accent }) {
  const stroke = 'rgba(0,0,0,0.35)';
  const common = { stroke, strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 60 80" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      {kind === 'carton' && (<><polygon points="12,22 30,8 48,22" fill={accent} {...common} /><rect x="12" y="22" width="36" height="52" rx="2" fill={color} {...common} /><rect x="12" y="38" width="36" height="12" fill={accent} opacity="0.85" /></>)}
      {kind === 'tub' && (<><path d="M10 36 L50 36 L45 74 Q45 76 43 76 L17 76 Q15 76 15 74 Z" fill={color} {...common} /><rect x="8" y="28" width="44" height="10" rx="3" fill={accent} {...common} /></>)}
      {kind === 'block' && (<><rect x="6" y="46" width="48" height="28" rx="4" fill={color} {...common} /><rect x="6" y="46" width="48" height="8" rx="4" fill={accent} opacity="0.6" /></>)}
      {kind === 'eggs' && (<><rect x="4" y="56" width="52" height="18" rx="4" fill="#cdbf9f" {...common} />{[14, 30, 46].map(x => <ellipse key={x} cx={x} cy="54" rx="8" ry="11" fill={color} {...common} />)}</>)}
      {kind === 'bottle' && (<><rect x="23" y="6" width="14" height="14" rx="3" fill={accent} {...common} /><path d="M23 20 L37 20 L48 34 L48 72 Q48 76 44 76 L16 76 Q12 76 12 72 L12 34 Z" fill={color} {...common} /><rect x="12" y="44" width="36" height="14" fill={accent} opacity="0.7" /></>)}
      {kind === 'jar' && (<><rect x="14" y="14" width="32" height="10" rx="3" fill={accent} {...common} /><rect x="10" y="24" width="40" height="50" rx="8" fill={color} {...common} /><rect x="16" y="40" width="28" height="18" rx="3" fill="#f4efe0" opacity="0.85" /></>)}
      {kind === 'can' && (<><rect x="14" y="14" width="32" height="60" rx="5" fill={color} {...common} /><ellipse cx="30" cy="14" rx="16" ry="4" fill={accent} {...common} /><rect x="14" y="36" width="32" height="14" fill={accent} opacity="0.9" /></>)}
      {kind === 'cake' && (<><path d="M6 70 L54 70 L54 42 L6 54 Z" fill={color} {...common} /><path d="M6 54 L54 42 L54 36 L6 48 Z" fill={accent} {...common} /><circle cx="46" cy="32" r="5" fill="#d0392b" {...common} /></>)}
      {kind === 'veg' && (<><circle cx="30" cy="48" r="24" fill={color} {...common} /><path d="M30 24 Q40 14 48 22 Q38 28 30 24 Z" fill={accent} {...common} /></>)}
      {kind === 'leaf' && (<>{[[18, 52, -18], [30, 46, 0], [42, 52, 18]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="9" ry="24" fill={i === 1 ? accent : color} transform={`rotate(${r} ${x} ${y + 12})`} {...common} />)}</>)}
    </svg>
  );
}

function FridgeView() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(null); // touch: tap an item to keep its name up
  const [hover, setHover] = useState(null);
  useEffect(() => { const t = setTimeout(() => setOpen(true), 60); return () => clearTimeout(t); }, []);
  const shown = hover || pinned;
  return (
    <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="stay-white" style={{ fontSize: 20, fontWeight: 800 }}>Fridge</div>
      <div className="stay-white" style={{ ...pill, minHeight: 34, padding: '6px 18px', margin: '10px 0 14px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        {shown || 'Hover or tap an item'}
      </div>
      <div style={{ position: 'relative', width: '100%', perspective: 1400 }}>
        {/* interior */}
        <div style={{ background: 'linear-gradient(180deg,#eaf4ff,#cfe3f5)', borderRadius: 16, padding: '14px 14px 10px', boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 0 0 6px #dfe3ee, inset 0 0 40px rgba(120,180,255,0.4)' }}>
          {FRIDGE_SHELVES.map((shelf, si) => (
            <div key={si} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 108, borderBottom: '5px solid rgba(255,255,255,0.9)', boxShadow: '0 6px 8px -6px rgba(0,0,0,0.25)', marginBottom: 8, paddingBottom: 2 }}>
              {shelf.map(it => (
                <div
                  key={it.name}
                  onMouseEnter={() => setHover(it.name)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setPinned(p => (p === it.name ? null : it.name))}
                  style={{ width: '17%', height: it.kind === 'block' || it.kind === 'eggs' ? '70%' : '92%', cursor: 'pointer', transition: 'transform .15s', transform: shown === it.name ? 'translateY(-6px) scale(1.08)' : 'none', filter: shown === it.name ? 'drop-shadow(0 6px 8px rgba(0,0,0,0.35))' : 'none' }}
                >
                  <ItemArt kind={it.kind} color={it.color} accent={it.accent} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* doors swing open on mount */}
        {[['left', -1], ['right', 1]].map(([side, dir]) => (
          <div key={side} style={{
            position: 'absolute', top: 0, bottom: 0, [side]: 0, width: '50%', transformOrigin: `${side} center`,
            transform: open ? `rotateY(${dir * -105}deg)` : 'rotateY(0)', transition: 'transform .9s cubic-bezier(.22,1,.36,1)',
            background: 'linear-gradient(135deg,#eef0f6,#c9cde0)', borderRadius: 16, boxShadow: '0 0 0 2px #aab0c6', pointerEvents: 'none', opacity: open ? 0.0 : 1,
            transitionProperty: 'transform, opacity', transitionDuration: '.9s, .5s', transitionDelay: '0s, .55s',
          }}>
            <div style={{ position: 'absolute', top: '30%', [dir > 0 ? 'left' : 'right']: 10, width: 8, height: '30%', borderRadius: 4, background: '#8f95a8' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PropViewer({ kind, onClose }) {
  const [book, setBook] = useState(null);
  useEscape(onClose);
  return createPortal(
    <div style={overlay} onClick={onClose}>
      <style>{CSS}</style>
      <button onClick={onClose} className="stay-white" style={closeBtn} title="Close"><X size={20} /></button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center', maxHeight: '100%' }}>
        {kind === 'books' && (book ? <BookReader book={book} onBack={() => setBook(null)} /> : <BookshelfView onPick={setBook} />)}
        {kind === 'fridge' && <FridgeView />}
      </div>
    </div>,
    document.body,
  );
}
