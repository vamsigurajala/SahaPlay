import { Volume2, VolumeX, X } from 'lucide-react';
import { useAmbience, setAmbienceOn, setAmbienceVolume } from './ambience';

// Room sounds on/off and how loud. Off until someone turns it on.
export default function AmbiencePanel({ onClose }) {
  const { on, volume } = useAmbience();
  return (
    <div className="stay-white" role="dialog" aria-label="Room sounds" style={{ position: 'absolute', right: 56, bottom: 12, zIndex: 66, width: 'min(270px, calc(100% - 80px))', padding: 12, borderRadius: 16, background: 'rgba(14,12,30,0.94)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 12px 36px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 900, fontSize: 13.5 }}>Room sounds</span>
        <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
      </div>
      <button onClick={() => setAmbienceOn(!on)} aria-pressed={on} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, color: '#fff', background: on ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.12)' }}>
        {on ? <Volume2 size={16} /> : <VolumeX size={16} />}{on ? 'Sounds are on' : 'Turn sounds on'}
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12, fontWeight: 700 }}>
        <span style={{ flex: 'none' }}>Volume</span>
        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setAmbienceVolume(e.target.value)} aria-label="Room sound volume" style={{ flex: 1, minWidth: 0, accentColor: '#8b5cff' }} />
      </label>
      <div style={{ fontSize: 11.5, lineHeight: 1.5, opacity: 0.75, marginTop: 10 }}>
        Birds and wind in the garden, rain on the veranda, chatter in the market, a hum and the odd clink in the kitchen. It gets quieter when music or the radio plays.
      </div>
    </div>
  );
}
