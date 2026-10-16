import { EMOTE_LIST } from './emotes';

// A small row of quick reactions, shown next to the right-hand menu.
export default function EmotePicker({ onPick }) {
  return (
    <div className="stay-white" role="group" aria-label="Quick reactions" style={{ position: 'absolute', right: 56, bottom: 12, zIndex: 66, display: 'flex', gap: 6, padding: 8, borderRadius: 16, background: 'rgba(14,12,30,0.94)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 12px 36px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', maxWidth: 'calc(100% - 80px)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {EMOTE_LIST.map(({ id, label, Icon, color }) => (
        <button key={id} onClick={() => onPick(id)} title={label} aria-label={label} style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${color}66`, background: 'rgba(255,255,255,0.06)', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}
