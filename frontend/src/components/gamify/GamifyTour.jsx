import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Move, MousePointerClick, DoorOpen, SlidersHorizontal, Layers, Star, X, ArrowRight, Check } from 'lucide-react';

// A short first-visit tour of the house. It shows once (remembered on this device) and
// can be replayed from the help button in the right-hand menu.

const KEY = 'sp_gamify_tour_done';

export const tourSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };

const STEPS = [
  { Icon: Move, k: 1, enTitle: 'Look around and walk', enBody: 'Drag the empty floor to look around. Drag your own avatar, the one with the white ring, to walk. Pinch or scroll to zoom, and double-tap to zoom back out.' },
  { Icon: MousePointerClick, k: 2, enTitle: 'Tap the glowing dots', enBody: 'A pulsing dot means you can tap that thing: games, shops, the fridge, the radio, paintings and more. Dots fade when you stop touching the screen, and tapping anywhere brings them back.' },
  { Icon: DoorOpen, k: 3, enTitle: 'Use doors and stairs', enBody: 'Tap a door button to walk into the next room. "Go upstairs" takes you to the upper floor, where the Breakup Room, the kitchen and the upstairs living room are.' },
  { Icon: SlidersHorizontal, k: 4, enTitle: 'The menu on the right', enBody: 'There you can see who is in which room, send a quick reaction, hide the names and dots, switch weather, flip the house and turn on Smooth mode if things feel slow.' },
  { Icon: Layers, k: 5, enTitle: 'Jump to any room', enBody: 'The panel at the bottom left lists every room with how many people are inside. Tap one to go straight there.' },
  { Icon: Star, k: 6, enTitle: 'Game of the day and your shortcuts', enBody: "Under the two round buttons at the top left you will see today's game for everyone. Tap the star inside any window, like a game, the radio or a shop, and it is pinned there so you can open it again in one tap." },
];

export default function GamifyTour({ open, onClose }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { markSeen(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const finish = () => { markSeen(); onClose(); };
  const { Icon } = step;
  return (
    <div className="stay-white" role="dialog" aria-label={t('gamify.tour.label', 'House tour')} style={{ position: 'absolute', left: '50%', bottom: 'max(16px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 80, width: 'min(420px, calc(100% - 24px))', padding: 16, borderRadius: 18, background: 'rgba(14,12,30,0.94)', border: '1px solid rgba(139,92,255,0.6)', boxShadow: '0 16px 50px rgba(0,0,0,0.6), 0 0 28px rgba(139,92,255,0.35)', backdropFilter: 'blur(10px)', color: '#fff' }}>
      <button onClick={finish} aria-label={t('gamify.tour.skip', 'Skip tour')} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 28 }}>
        <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 13, background: 'linear-gradient(145deg,#8b5cff,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 15.5 }}>{t(`gamify.tour.t${step.k}`, step.enTitle)}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.88, marginTop: 4 }}>{t(`gamify.tour.b${step.k}`, step.enBody)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 6 }} aria-label={t('gamify.tour.step', { defaultValue: 'Step {{n}} of {{total}}', n: i + 1, total: STEPS.length })}>
          {STEPS.map((_, k) => <span key={k} style={{ width: k === i ? 18 : 7, height: 7, borderRadius: 9, background: k === i ? '#8b5cff' : 'rgba(255,255,255,0.3)', transition: 'width .2s' }} />)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {i > 0 && <button onClick={() => setI(i - 1)} style={ghost}>{t('gamify.tour.back', 'Back')}</button>}
          <button onClick={() => (last ? finish() : setI(i + 1))} style={primary}>{last ? <><Check size={14} />{t('gamify.tour.gotIt', 'Got it')}</> : <>{t('gamify.tour.next', 'Next')}<ArrowRight size={14} /></>}</button>
        </div>
      </div>
    </div>
  );
}

const ghost = { padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const primary = { padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cff,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
