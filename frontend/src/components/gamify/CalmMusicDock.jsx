import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Music2, X, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useCalmMusic, stopCalm, setCalmSmall, joinInvite, dismissInvite } from './calmMusic';
import { stopRadio } from './radioPlayer';

// One player for the whole room. Normally it is a small card in the top-right corner of
// the house. While the Calm Music panel is open it is drawn over the empty box the panel
// reserves, so it looks like the panel's own player. It is the same iframe in both
// places (always portalled to the page body, above the viewer overlay), so the song never
// restarts when the panel opens or closes.

const CORNER_W = 300;

function useTrackedRect(slot, anchor) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let next = null;
      if (slot) {
        const r = slot.getBoundingClientRect();
        // keep the player inside the panel's scrolling area, so it never paints over the header
        const sc = slot.closest('[data-calm-scroll]');
        const c = sc ? sc.getBoundingClientRect() : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
        const clip = `inset(${Math.max(0, c.top - r.top)}px ${Math.max(0, r.right - c.right)}px ${Math.max(0, r.bottom - c.bottom)}px ${Math.max(0, c.left - r.left)}px)`;
        next = { mode: 'slot', left: r.left, top: r.top, width: r.width, height: r.height, clip };
      } else if (anchor) {
        const a = anchor.getBoundingClientRect();
        const width = Math.min(CORNER_W, window.innerWidth - 24);
        next = { mode: 'corner', left: Math.max(12, a.right - 10 - width), top: a.top + 10, width, height: 0, clip: 'none' };
      }
      setRect(prev => (prev && next && prev.mode === next.mode && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height && prev.clip === next.clip ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [slot, anchor]);
  return rect;
}

// Someone in the house is playing a song and asks you to listen with them. It only plays if you say yes.
function InviteCard({ invite }) {
  return (
    <div className="stay-white" role="alert" style={{ position: 'absolute', top: 10, right: 10, zIndex: 72, width: 'min(300px, calc(100% - 24px))', padding: 12, borderRadius: 16, background: 'rgba(14,12,30,0.95)', border: '1px solid rgba(139,92,255,0.7)', boxShadow: '0 12px 36px rgba(0,0,0,0.55), 0 0 22px rgba(139,92,255,0.3)', backdropFilter: 'blur(10px)', color: '#fff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 11, background: 'linear-gradient(145deg,#8b5cff,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={17} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{invite.from} wants to listen together</div>
          <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{invite.item.title}{invite.item.by ? `, ${invite.item.by}` : ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button onClick={dismissInvite} style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Not now</button>
        <button onClick={() => { stopRadio(); joinInvite(); }} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cff,#4f46e5)', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Listen</button>
      </div>
    </div>
  );
}

export default function CalmMusicDock() {
  const { current, small, slot, invite } = useCalmMusic();
  const [anchor, setAnchor] = useState(null);
  const anchorRef = useRef(null);
  useEffect(() => { setAnchor(anchorRef.current); }, []);
  const rect = useTrackedRect(slot, anchor);
  const yt = current && current.provider === 'youtube';

  // The same children in the same order in every return, so the anchor and the player keep their place.
  const anchorEl = <div ref={anchorRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
  const inviteEl = invite ? <InviteCard invite={invite} /> : null;
  if (!current || !rect) return <>{anchorEl}{inviteEl}{null}</>;

  const inSlot = rect.mode === 'slot';
  const box = inSlot
    ? { position: 'fixed', zIndex: 2147483000, left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: 16, overflow: 'hidden', background: '#0e0c1a', clipPath: rect.clip === 'inset(0px 0px 0px 0px)' ? undefined : rect.clip }
    : { position: 'fixed', zIndex: 70, left: rect.left, top: rect.top, width: rect.width, borderRadius: 16, overflow: 'hidden', background: 'rgba(14,12,26,0.9)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: '#fff' };

  // The same elements stay in the same places in both modes, so the iframe is never re-created.
  return (
    <>
      {anchorEl}
      {inviteEl}
      {createPortal(
        <div className="stay-white" style={box}>
          {!inSlot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 12px' }}>
              <Music2 size={15} style={{ flex: 'none' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.title}</div>
                {current.by && <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.by}</div>}
              </div>
              <button onClick={() => setCalmSmall(!small)} aria-label={small ? 'Show player' : 'Hide player'} style={iconBtn}>{small ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
              <button onClick={stopCalm} aria-label="Stop music" style={iconBtn}><X size={16} /></button>
            </div>
          )}
          <div style={{ height: inSlot ? '100%' : (small ? 0 : (yt ? 169 : 152)), transition: inSlot ? 'none' : 'height .2s ease', overflow: 'hidden' }}>
            <iframe
              key={current.src}
              title={current.title}
              src={current.src}
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

const iconBtn = { width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' };
