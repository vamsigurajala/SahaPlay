import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import AvatarSprite from './AvatarSprite';
import { FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT, FLOORPLAN_ZONES, HALL_PROPS, DEFAULT_SPAWN } from '../data/gamifyZones';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;

// Per-zone floor "material" — a couple of stacked CSS gradients standing in
// for a real tileset (no asset pack found that actually fit a modern-home
// theme without looking thematically mismatched — see the floor base color
// plus a repeating texture layer on top, all within the app's existing
// purple/green accent palette rather than realistic wood-brown/grass-green,
// since this is a branded illustration, not a simulation.
const ZONE_FLOOR_BACKGROUND = {
  hall: `repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 46px),
         linear-gradient(160deg, #363b86 0%, #23264f 100%)`,
  bedroom: `radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px),
            linear-gradient(160deg, #7a4a7a 0%, #4a2d52 100%)`,
  lawn: `repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 18px, transparent 18px, transparent 36px),
         linear-gradient(160deg, #3f8a4c 0%, #25552f 100%)`,
};
const ZONE_FLOOR_BACKGROUND_SIZE = {
  bedroom: '14px 14px, auto',
};

// Decorative-only prop positions (virtual units, same coordinate space as
// FLOORPLAN_ZONES/HALL_PROPS) — kept local to this component rather than
// gamifyZones.js since nothing outside rendering ever needs to know about
// them (no hit-testing, no socket payload references them).
const RUG = { x: 30, y: 400, width: 280, height: 130 };
const PLANT = { x: 520, y: 410, width: 36, height: 70 };
const BED = { x: 680, y: 30, width: 140, height: 190 };
const WINDOW = { x: 860, y: 8, width: 90, height: 16 };
const TREE = { x: 930, y: 330, width: 64, height: 96 };

// The 2D social-space view Room.jsx swaps in for the video rectangle when
// Gamify Mode is on. Renders the fixed floor plan (zones + TV/couch props)
// and every participant's draggable avatar, and reports the TV's current
// on-screen rect back to Room.jsx via onTvRectChange so Room.jsx can
// absolutely-position the EXISTING (untouched) player element exactly on
// top of it — the player itself is never unmounted/remounted by toggling
// Gamify Mode, only repositioned, so playback/connection state is never
// disturbed. See Room.jsx's gamify-mode section comment for the full
// rationale on why a "move the JSX into a different parent" approach was
// rejected in favor of this CSS-overlay approach.
export default function GamifyFloorPlan({ userList, mySocketId, avatarPositions, knownAvatars, hostId, onMove, onTvRectChange }) {
  const containerRef = useRef(null);
  const worldRef = useRef(null);
  const tvScreenRef = useRef(null);

  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef(null);

  const scale = baseScale * zoom;

  // Fit the fixed-size virtual world to whatever space the container
  // actually has, and re-center — runs on mount and whenever the player
  // column resizes (sidebar opening/closing, window resize, rotation).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fit = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const next = Math.min(rect.width / FLOORPLAN_WIDTH, rect.height / FLOORPLAN_HEIGHT);
      setBaseScale(next);
      setPan({ x: (rect.width - FLOORPLAN_WIDTH * next) / 2, y: (rect.height - FLOORPLAN_HEIGHT * next) / 2 });
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Desktop zoom. React attaches onWheel as a passive listener, so
  // preventDefault() inside it silently no-ops (same reason touchmove
  // handlers elsewhere in this codebase use a native listener instead of
  // React's synthetic one) — a plain addEventListener with passive:false
  // is the only way to actually stop the page from scrolling while zooming.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-pan on empty background. Avatar sprites stop propagation on
  // their own mousedown/touchstart when it's the viewer's own (draggable)
  // sprite, so dragging yourself never also pans the view underneath you.
  const handleBgPointerDown = useCallback((e) => {
    const isTouch = e.type === 'touchstart';
    if (isTouch && e.touches.length > 1) return; // leave multi-touch alone (no pinch-zoom in Phase 1)
    const point = isTouch ? e.touches[0] : e;
    if (!point) return;
    const start = { clientX: point.clientX, clientY: point.clientY, panX: pan.x, panY: pan.y };
    panDragRef.current = true;
    const onMoveEvt = (moveEvent) => {
      if (!panDragRef.current) return;
      const movePoint = isTouch ? moveEvent.touches[0] : moveEvent;
      if (!movePoint) return;
      setPan({ x: start.panX + (movePoint.clientX - start.clientX), y: start.panY + (movePoint.clientY - start.clientY) });
    };
    const onUpEvt = () => {
      panDragRef.current = false;
      window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMoveEvt);
      window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onUpEvt);
    };
    window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMoveEvt);
    window.addEventListener(isTouch ? 'touchend' : 'mouseup', onUpEvt);
  }, [pan]);

  // Report the TV screen's current on-screen rect, relative to this
  // component's own container, every time the view's pan/zoom or the
  // container's own size changes — this is what lets Room.jsx line the
  // real player element up with it pixel-for-pixel.
  useLayoutEffect(() => {
    const report = () => {
      if (!tvScreenRef.current || !containerRef.current || !onTvRectChange) return;
      const tvRect = tvScreenRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      onTvRectChange({
        top: tvRect.top - containerRect.top,
        left: tvRect.left - containerRect.left,
        width: tvRect.width,
        height: tvRect.height,
      });
    };
    report();
    return () => { if (onTvRectChange) onTvRectChange(null); };
  }, [scale, pan.x, pan.y, onTvRectChange]);

  const zones = Object.values(FLOORPLAN_ZONES);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleBgPointerDown}
      onTouchStart={handleBgPointerDown}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0a12', touchAction: 'none', cursor: 'grab' }}
    >
      <div
        ref={worldRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: FLOORPLAN_WIDTH, height: FLOORPLAN_HEIGHT,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {zones.map(zone => (
          <div key={zone.id} style={{
            position: 'absolute', left: zone.x, top: zone.y, width: zone.width, height: zone.height,
            background: ZONE_FLOOR_BACKGROUND[zone.id] || zone.color,
            backgroundSize: ZONE_FLOOR_BACKGROUND_SIZE[zone.id],
            // A thicker, lighter inner border reads as a wall/skirting board
            // separating one room from the next, instead of a flat color
            // just touching the next flat color with a hairline between them.
            boxShadow: 'inset 0 0 0 6px rgba(0,0,0,0.25), inset 0 0 0 7px rgba(255,255,255,0.06)',
            boxSizing: 'border-box',
          }}>
            <span style={{
              position: 'absolute', top: 14, left: 16, padding: '3px 10px', borderRadius: 99,
              background: 'rgba(0,0,0,0.3)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.75)',
              textTransform: 'uppercase', letterSpacing: '0.06em', backdropFilter: 'blur(2px)',
            }}>
              {zone.label}
            </span>
          </div>
        ))}

        {/* Bedroom window — purely decorative wall flourish */}
        <div style={{
          position: 'absolute', left: WINDOW.x, top: WINDOW.y, width: WINDOW.width, height: WINDOW.height,
          background: 'linear-gradient(180deg, #bcdcf4, #7fb8e0)', borderRadius: 3,
          border: '2px solid rgba(255,255,255,0.5)', boxSizing: 'border-box',
        }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.5)' }} />
        </div>

        {/* Bed */}
        <div style={{ position: 'absolute', left: BED.x, top: BED.y, width: BED.width, height: BED.height }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'linear-gradient(180deg, #d8c3e0, #c6a9d6)', boxShadow: '0 10px 18px rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26, borderRadius: '12px 12px 0 0', background: '#7a4a7a' }} />
          {[0, 1].map(i => (
            <div key={i} style={{ position: 'absolute', top: 34, left: 14 + i * 56, width: 46, height: 30, borderRadius: 8, background: '#fdfbf7', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
          ))}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%', borderRadius: '0 0 12px 12px', background: 'linear-gradient(180deg, #8f5fa8, #764a8f)' }} />
        </div>

        {/* Lawn tree */}
        <div style={{ position: 'absolute', left: TREE.x, top: TREE.y, width: TREE.width, height: TREE.height }}>
          <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 10, height: 34, marginLeft: -5, background: '#6b4a2f', borderRadius: 3 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: TREE.width, height: TREE.width, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #4fae5e, #2c7a3a)', boxShadow: '0 8px 16px rgba(0,0,0,0.25)' }} />
        </div>

        {/* Hall plant */}
        <div style={{ position: 'absolute', left: PLANT.x, top: PLANT.y, width: PLANT.width, height: PLANT.height }}>
          <div style={{ position: 'absolute', left: '50%', bottom: 0, width: PLANT.width * 0.6, height: PLANT.height * 0.35, marginLeft: -(PLANT.width * 0.3), background: '#8a5a3b', borderRadius: '4px 4px 10px 10px' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: PLANT.height * 0.28, width: PLANT.width, height: PLANT.height * 0.72, marginLeft: -(PLANT.width / 2), borderRadius: '50% 50% 45% 45%', background: 'radial-gradient(circle at 35% 30%, #57b767, #2f7a3f)' }} />
        </div>

        {/* Rug, under the couch */}
        <div style={{
          position: 'absolute', left: RUG.x, top: RUG.y, width: RUG.width, height: RUG.height,
          borderRadius: 18, background: 'rgba(140,90,70,0.35)', border: '2px dashed rgba(255,255,255,0.18)', boxSizing: 'border-box',
        }} />

        {/* Couch — backrest + seat base + cushions + a soft grounding shadow */}
        <div style={{ position: 'absolute', left: HALL_PROPS.couch.x, top: HALL_PROPS.couch.y, width: HALL_PROPS.couch.width, height: HALL_PROPS.couch.height }}>
          <div style={{ position: 'absolute', left: 6, right: 6, bottom: -8, height: 14, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', filter: 'blur(3px)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'linear-gradient(180deg, #9a6a45, #6e4527)', boxShadow: '0 6px 14px rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '48%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, #b07e52, #8a5a3b)' }} />
          {[0, 1, 2].map(i => (
            <div key={i} style={{ position: 'absolute', bottom: 10, left: 12 + i * ((HALL_PROPS.couch.width - 24) / 3), width: (HALL_PROPS.couch.width - 24) / 3 - 8, height: 30, borderRadius: 8, background: '#c89468', boxShadow: 'inset 0 -4px 6px rgba(0,0,0,0.15)' }} />
          ))}
        </div>

        {/* TV screen + stand — Room.jsx overlays the real (untouched) player
            element exactly on top of tvScreenRef; this div is purely the
            visual frame underneath it (and is what renders, e.g. "No Media
            Selected", through the player's own existing empty state, since
            that player element sits directly above this at a higher
            z-index). */}
        <div style={{ position: 'absolute', left: HALL_PROPS.tv.x + HALL_PROPS.tv.width / 2 - 24, top: HALL_PROPS.tv.y + HALL_PROPS.tv.height, width: 48, height: 10, background: '#1a1a1a', borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: HALL_PROPS.tv.x + HALL_PROPS.tv.width / 2 - 5, top: HALL_PROPS.tv.y + HALL_PROPS.tv.height - 4, width: 10, height: 10, background: '#1a1a1a' }} />
        <div ref={tvScreenRef} style={{
          position: 'absolute', left: HALL_PROPS.tv.x, top: HALL_PROPS.tv.y,
          width: HALL_PROPS.tv.width, height: HALL_PROPS.tv.height,
          background: 'radial-gradient(circle at 40% 35%, #262b4a, #0c0d16)',
          borderRadius: 6, boxSizing: 'border-box',
          border: '4px solid #1c1c22', boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
        }} />

        {userList.map(user => {
          const pos = avatarPositions?.[user.socketId] || DEFAULT_SPAWN;
          const isOwn = user.socketId === mySocketId;
          return (
            <AvatarSprite
              key={user.socketId}
              username={user.username}
              avatarPath={knownAvatars?.[user.username] || user.avatarPath}
              isHost={user.isHost || user.socketId === hostId}
              x={pos.x}
              y={pos.y}
              isOwn={isOwn}
              scale={scale}
              onMove={isOwn ? onMove : undefined}
            />
          );
        })}
      </div>

      <div
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 60 }}
      >
        <button
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.2))}
          title="Zoom in"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' }}
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.2))}
          title="Zoom out"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' }}
        >
          <ZoomOut size={15} />
        </button>
      </div>
    </div>
  );
}
