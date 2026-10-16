import { Footprints, X, Crown } from 'lucide-react';
import Avatar from '../Avatar';
import { ALL_ZONES } from '../../data/gamifyZones';

// Who is in which room. Tap a person to walk over to them.
export default function GamifyPeople({ people, onGo, onClose }) {
  const groups = {};
  people.forEach(p => { (groups[p.zone] = groups[p.zone] || []).push(p); });
  const rooms = Object.keys(groups).sort((a, b) => (ALL_ZONES[a]?.label || a).localeCompare(ALL_ZONES[b]?.label || b));
  return (
    <div className="stay-white" role="dialog" aria-label="People in the house" style={{ position: 'absolute', right: 56, bottom: 12, zIndex: 66, width: 'min(280px, calc(100% - 80px))', maxHeight: 'min(60%, 420px)', overflowY: 'auto', overscrollBehavior: 'contain', padding: 10, borderRadius: 16, background: 'rgba(14,12,30,0.94)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 12px 36px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 4px 8px' }}>
        <span style={{ fontWeight: 900, fontSize: 13.5 }}>In the house ({people.length})</span>
        <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
      </div>
      {rooms.map(z => (
        <div key={z} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65, margin: '0 4px 4px' }}>{ALL_ZONES[z]?.label || z}</div>
          {groups[z].map(p => (
            <button key={p.socketId} onClick={() => !p.own && onGo(p)} disabled={p.own} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: p.own ? 'default' : 'pointer', marginBottom: 4, textAlign: 'left' }}>
              <Avatar avatarPath={p.avatarPath} username={p.username} size={30} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                {p.isHost && <Crown size={12} color="#fbbf24" />}{p.username}{p.own ? ' (you)' : ''}
              </span>
              {!p.own && <Footprints size={15} style={{ opacity: 0.8, flex: 'none' }} aria-label="Walk to them" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
