import { Music2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCalmMusic, stopCalm, setCalmSmall } from './calmMusic';

// A small floating player in the corner of the house. It keeps the song going while
// you walk around or sit in the Breakup Room.

export default function CalmMusicDock() {
  const { current, small } = useCalmMusic();
  if (!current) return null;
  const yt = current.provider === 'youtube';
  const width = 'min(300px, calc(100vw - 24px))';
  return (
    <div className="stay-white" style={{ position: 'absolute', top: 10, right: 10, zIndex: 70, width, borderRadius: 16, overflow: 'hidden', background: 'rgba(14,12,26,0.9)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 12px' }}>
        <Music2 size={15} style={{ flex: 'none' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.title}</div>
          {current.by && <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.by}</div>}
        </div>
        <button onClick={() => setCalmSmall(!small)} aria-label={small ? 'Show player' : 'Hide player'} style={iconBtn}>{small ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
        <button onClick={stopCalm} aria-label="Stop music" style={iconBtn}><X size={16} /></button>
      </div>
      {/* the player stays mounted while hidden so the song keeps playing */}
      <div style={{ height: small ? 0 : (yt ? 169 : 152), transition: 'height .2s ease', overflow: 'hidden' }}>
        <iframe
          key={current.src}
          title={current.title}
          src={current.src}
          width="100%"
          height={yt ? 169 : 152}
          style={{ border: 0, display: 'block' }}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

const iconBtn = { width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' };
