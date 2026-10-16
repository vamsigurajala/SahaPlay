import { Hand, Heart, Laugh, ThumbsUp, PartyPopper, Coffee } from 'lucide-react';
import { EMOTE_IDS } from '../../data/gamifyEmotes';

export const EMOTES = {
  wave: { label: 'Wave', Icon: Hand, color: '#fbbf24' },
  heart: { label: 'Love', Icon: Heart, color: '#fb7185' },
  laugh: { label: 'Laugh', Icon: Laugh, color: '#facc15' },
  thumbs: { label: 'Nice', Icon: ThumbsUp, color: '#60a5fa' },
  party: { label: 'Party', Icon: PartyPopper, color: '#c084fc' },
  cheers: { label: 'Cheers', Icon: Coffee, color: '#fb923c' },
};
export const EMOTE_LIST = EMOTE_IDS.map(id => ({ id, ...EMOTES[id] }));

let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = '@keyframes gp-emote{0%{opacity:0;transform:translate(-50%,6px) scale(.5)}12%{opacity:1;transform:translate(-50%,-4px) scale(1.15)}22%{transform:translate(-50%,-6px) scale(1)}80%{opacity:1;transform:translate(-50%,-26px) scale(1)}100%{opacity:0;transform:translate(-50%,-34px) scale(.9)}}';
  document.head.appendChild(st);
}

// A reaction that pops up over an avatar, floats up and fades. Remount it (change the
// key) to play it again.
export function EmoteBubble({ id }) {
  const e = EMOTES[id];
  if (!e) return null;
  ensureCss();
  const { Icon } = e;
  return (
    <span aria-hidden="true" className="stay-white" style={{ position: 'absolute', left: '50%', top: -34, width: 38, height: 38, borderRadius: '50%', background: 'rgba(12,10,24,0.88)', border: `2px solid ${e.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', animation: 'gp-emote 2.8s ease-out forwards', boxShadow: `0 0 14px ${e.color}88` }}>
      <Icon size={20} color={e.color} />
    </span>
  );
}
