import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import AvatarSprite from './AvatarSprite';
import { FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT, FLOORPLAN_ZONES, HALL_PROPS, DEFAULT_SPAWN } from '../data/gamifyZones';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;

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
            background: zone.color, border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box',
          }}>
            <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {zone.label}
            </span>
          </div>
        ))}

        {/* Couch — placeholder flat shape, real furniture art is a later phase */}
        <div style={{
          position: 'absolute', left: HALL_PROPS.couch.x, top: HALL_PROPS.couch.y,
          width: HALL_PROPS.couch.width, height: HALL_PROPS.couch.height,
          background: HALL_PROPS.couch.color, borderRadius: 10, boxSizing: 'border-box',
          border: '1px solid rgba(0,0,0,0.3)',
        }} />

        {/* TV screen — Room.jsx overlays the real (untouched) player element
            exactly on top of this rect; this div is purely the visual frame
            underneath it (and is what renders, e.g. "No Media Selected",
            through the player's own existing empty state, since that player
            element sits directly above this at a higher z-index). */}
        <div ref={tvScreenRef} style={{
          position: 'absolute', left: HALL_PROPS.tv.x, top: HALL_PROPS.tv.y,
          width: HALL_PROPS.tv.width, height: HALL_PROPS.tv.height,
          background: HALL_PROPS.tv.color, borderRadius: 6, boxSizing: 'border-box',
          border: '3px solid #333',
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
