import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Heart, Quote, Eye, Brush } from 'lucide-react';
import { PAINTINGS, PAINTING_IDS } from '../../data/gamifyPaintings';

// A close look at one of the sad love paintings in the upstairs living room: the
// picture itself, why the artist painted it, and the story behind it. Arrows and the
// thumbnails browse the other four.

const CSS = `
@keyframes art-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
.art-thumb { transition: transform .15s ease, opacity .15s ease, border-color .15s ease; }
.art-thumb:hover { transform: translateY(-2px); opacity: 1 !important; }
`;

const sectionTitle = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#ffd36b', margin: '0 0 6px' };

export default function PaintingViewer({ id }) {
  const { t } = useTranslation();
  const [cur, setCur] = useState(PAINTINGS[id] ? id : PAINTING_IDS[0]);
  const p = PAINTINGS[cur];
  const i = PAINTING_IDS.indexOf(cur);
  const go = (d) => setCur(PAINTING_IDS[(i + d + PAINTING_IDS.length) % PAINTING_IDS.length]);

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1100, color: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{CSS}</style>
      <div key={cur} style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start', animation: 'art-in .3s ease-out' }}>
        <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 560, padding: 12, borderRadius: 6, background: 'linear-gradient(135deg,#e6c36a,#9a7420 45%,#d9b455)', boxShadow: '0 24px 60px rgba(0,0,0,0.65), inset 0 0 0 2px rgba(0,0,0,0.25)' }}>
            <img src={p.img} alt={`${p.title} by ${p.artist}`} draggable={false} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '64vh', objectFit: 'contain', background: '#150f0a', boxShadow: '0 0 0 3px rgba(0,0,0,0.5)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => go(-1)} aria-label="Previous painting" style={navBtn}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 12.5, opacity: 0.7, minWidth: 70, textAlign: 'center' }}>{i + 1} / {PAINTING_IDS.length}</span>
            <button onClick={() => go(1)} aria-label="Next painting" style={navBtn}><ChevronRight size={18} /></button>
          </div>
        </div>

        <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {p.mood.map(m => <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,90,138,0.18)', border: '1px solid rgba(255,90,138,0.45)', fontSize: 12, fontWeight: 700 }}><Heart size={11} />{m}</span>)}
            </div>
            <div style={{ fontSize: 'clamp(24px,5vw,34px)', fontWeight: 900, lineHeight: 1.1 }}>{p.title}</div>
            <div style={{ fontSize: 14.5, opacity: 0.85, marginTop: 4 }}>{p.artist}, {p.year}</div>
            {p.place && <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 2 }}>{p.place}</div>}
          </div>

          <section>
            <h3 style={sectionTitle}><Brush size={13} />{t('gamify.art.why', 'Why the artist painted it')}</h3>
            <p style={para}>{p.why}</p>
          </section>
          <section>
            <h3 style={sectionTitle}><Quote size={13} />{t('gamify.art.story', 'The story')}</h3>
            <p style={para}>{p.story}</p>
          </section>
          <section>
            <h3 style={sectionTitle}><Brush size={13} />{t('gamify.art.behind', 'Behind the canvas')}</h3>
            <p style={para}>{p.behind}</p>
          </section>
          <section>
            <h3 style={sectionTitle}><Eye size={13} />{t('gamify.art.look', 'Look closer')}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {p.look.map(l => <li key={l} style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>{l}</li>)}
            </ul>
          </section>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
        {PAINTING_IDS.map(k => (
          <button key={k} className="art-thumb" onClick={() => setCur(k)} aria-label={PAINTINGS[k].title} style={{ padding: 0, width: 92, height: 68, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', opacity: k === cur ? 1 : 0.55, border: `2px solid ${k === cur ? '#ffd36b' : 'rgba(255,255,255,0.2)'}`, background: '#150f0a' }}>
            <img src={PAINTINGS[k].img} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.5, textAlign: 'center' }}>{t('gamify.art.credit', 'Public-domain paintings, shown with short retellings of their stories.')}</div>
    </div>
  );
}

const para = { margin: 0, fontSize: 14.5, lineHeight: 1.6, opacity: 0.92 };
const navBtn = { width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 };
