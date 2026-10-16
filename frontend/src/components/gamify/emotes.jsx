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

export const SAY_MAX = 80; // the server cuts messages at the same length

let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = '@keyframes gp-say{0%{opacity:0;transform:translate(-50%,6px) scale(.85)}8%{opacity:1;transform:translate(-50%,0) scale(1)}88%{opacity:1}100%{opacity:0}}@keyframes gp-emote{0%{opacity:0;transform:translate(-50%,6px) scale(.5)}12%{opacity:1;transform:translate(-50%,-4px) scale(1.15)}22%{transform:translate(-50%,-6px) scale(1)}80%{opacity:1;transform:translate(-50%,-26px) scale(1)}100%{opacity:0;transform:translate(-50%,-34px) scale(.9)}}';
  document.head.appendChild(st);
}

// A short message over an avatar. It stays for about six seconds, then fades.
// Remount it (change the key) to show a new one.
export function SayBubble({ text }) {
  if (!text) return null;
  ensureCss();
  return (
    <span className="stay-white" style={{ position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)', width: 'max-content', maxWidth: 180, padding: '6px 10px', borderRadius: 12, background: 'rgba(14,12,30,0.95)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontSize: 12.5, fontWeight: 700, lineHeight: 1.35, textAlign: 'center', overflowWrap: 'anywhere', pointerEvents: 'none', animation: 'gp-say 6s ease-out forwards', boxShadow: '0 6px 18px rgba(0,0,0,0.45)', zIndex: 3 }}>
      {text}
      <span style={{ position: 'absolute', left: '50%', bottom: -5, width: 10, height: 10, background: 'rgba(14,12,30,0.95)', borderRight: '1px solid rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(255,255,255,0.35)', transform: 'translateX(-50%) rotate(45deg)' }} />
    </span>
  );
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
