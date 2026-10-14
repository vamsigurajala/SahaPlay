import { useState, useRef, useEffect } from 'react';
import { Crown } from 'lucide-react';
import Avatar from './Avatar';
import { clampToFloorplan, zoneForPoint } from '../data/gamifyZones';

// One participant's sprite inside GamifyFloorPlan. Only the viewer's own
// sprite (isOwn) is draggable — remote sprites just render wherever the
// server last broadcast them (snap, no interpolation — see Room.jsx's
// avatar_moved handler comment for why that's the right call for Phase 1).
//
// Drag math mirrors the existing draggable-camera-tile pattern elsewhere in
// Room.jsx (plain mousedown/touchstart -> window mousemove/touchmove ->
// cleanup on release, no library) rather than introducing a new dependency.
// The one addition specific to this scene: GamifyFloorPlan renders its whole
// "world" at a fixed virtual size and applies the zoom as a single CSS
// transform:scale() on that world div — so raw screen-pixel mouse deltas
// have to be divided by the current `scale` to land in the same virtual
// coordinate space the avatar's x/y (and the server) use.
export default function AvatarSprite({ username, avatarPath, isHost, x, y, isOwn = false, scale = 1, onMove }) {
  const [localPos, setLocalPos] = useState({ x, y });
  const draggingRef = useRef(false);
  const lastEmitRef = useRef(0);
  const pendingRef = useRef(null);

  // Remote moves (and our own position resyncing after a drag completes)
  // apply directly — but never while a local drag is in progress, since
  // that would fight the drag with whatever the last server echo was.
  useEffect(() => {
    if (!draggingRef.current) setLocalPos({ x, y });
  }, [x, y]);

  const commit = (px, py) => {
    const clamped = clampToFloorplan(px, py);
    const zone = zoneForPoint(clamped.x, clamped.y);
    onMove && onMove(clamped.x, clamped.y, zone);
  };

  // Throttle outgoing position updates to ~20/sec (matches the server's own
  // rate bucket for avatar_move) instead of firing on every pixel of mouse
  // movement, but always flush whatever position was last reached the
  // instant the drag ends, so the resting spot never desyncs from what the
  // user actually dropped on.
  const emitThrottled = (px, py) => {
    pendingRef.current = { x: px, y: py };
    const now = performance.now();
    if (now - lastEmitRef.current >= 50) {
      lastEmitRef.current = now;
      commit(px, py);
      pendingRef.current = null;
    }
  };

  const handlePointerDown = (e) => {
    if (!isOwn) return;
    e.preventDefault();
    // Without this, the drag-start would also bubble up to
    // GamifyFloorPlan's background pan handler, panning the whole view
    // underneath you at the same time as you drag your own avatar.
    e.stopPropagation();
    const isTouch = e.type === 'touchstart';
    const point = isTouch ? e.touches[0] : e;
    if (!point) return;
    draggingRef.current = true;
    const start = { clientX: point.clientX, clientY: point.clientY, x: localPos.x, y: localPos.y };

    const onMoveEvt = (moveEvent) => {
      if (!draggingRef.current) return;
      const movePoint = isTouch ? moveEvent.touches[0] : moveEvent;
      if (!movePoint) return;
      if (isTouch && moveEvent.cancelable) moveEvent.preventDefault();
      const dx = (movePoint.clientX - start.clientX) / scale;
      const dy = (movePoint.clientY - start.clientY) / scale;
      const clamped = clampToFloorplan(start.x + dx, start.y + dy);
      setLocalPos(clamped);
      emitThrottled(clamped.x, clamped.y);
    };

    const onUpEvt = () => {
      draggingRef.current = false;
      if (pendingRef.current) {
        commit(pendingRef.current.x, pendingRef.current.y);
        pendingRef.current = null;
      }
      window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMoveEvt);
      window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onUpEvt);
    };

    window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMoveEvt, isTouch ? { passive: false } : undefined);
    window.addEventListener(isTouch ? 'touchend' : 'mouseup', onUpEvt);
  };

  return (
    <div
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      style={{
        position: 'absolute',
        left: localPos.x,
        top: localPos.y,
        transform: 'translate(-50%, -100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        cursor: isOwn ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: isOwn ? 50 : 10,
      }}
    >
      {/* Grounding shadow, pinned to the same bottom edge this wrapper's
          translate(-50%,-100%) anchors to the (x,y) floor position — without
          it the avatar read as floating over the floor rather than standing
          on it. */}
      <div style={{
        position: 'absolute', bottom: -2, left: '50%', width: 26, height: 8, marginLeft: -13,
        borderRadius: '50%', background: 'rgba(0,0,0,0.45)', filter: 'blur(2px)', zIndex: -1,
      }} />
      <Avatar
        avatarPath={avatarPath}
        username={username}
        size={36}
        style={{
          border: isOwn ? '2px solid #fff' : '2px solid rgba(255,255,255,0.55)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      />
      <span style={{
        display: 'flex', alignItems: 'center', gap: 2,
        fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.85)',
        whiteSpace: 'nowrap', maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {isHost && <Crown size={10} color="#fbbf24" />}
        {username}
      </span>
    </div>
  );
}
