import { memo, useRef, useMemo, useEffect, useContext } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Crown, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Avatar from '../Avatar';
import { FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT, WORLD_W, WORLD_D, CELL_D, FLOOR_Y, ALL_ZONES, zoneForPoint } from '../../data/gamifyZones';
import { ScaledHtml, ViewContext } from './parts';
import { EmoteBubble, SayBubble } from './emotes';
import { freeSpot } from './avatarSpacing';
import { playSfx } from './ambience';

const toWorld = (vx, vy) => ({ x: (vx / FLOORPLAN_WIDTH - 0.5) * WORLD_W, z: (vy / FLOORPLAN_HEIGHT - 0.5) * WORLD_D });
const toVirtual = (wx, wz) => ({ x: (wx / WORLD_W + 0.5) * FLOORPLAN_WIDTH, y: (wz / WORLD_D + 0.5) * FLOORPLAN_HEIGHT });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BOUND_X = WORLD_W / 2 - 0.7;
const BOUND_Z = WORLD_D / 2 - 0.7;
// Upstairs only covers the back two rows of the house.
const BOUND_Z_UP = -WORLD_D / 2 + 2 * CELL_D - 0.7;

// One participant, standing on the floor of the 3D house. Only the viewer's own
// avatar is draggable; dragging raycasts the pointer onto the floor plane so
// movement follows the isometric view correctly at any zoom/pan. Avatars live
// inside the (possibly mirrored) scene root, so positions here are always in
// the un-mirrored local space — a flipped view only changes how they render,
// never what's sent over the socket (everyone shares the same virtual coords).
function Avatar3D({ avatarId, username, avatarPath, isHost, isOwn, speaking, x, y, zone, emote, say, onWave, onMove, onDrop, dragLockRef }) {
  const group = useRef();
  const { t } = useTranslation();
  const view = useContext(ViewContext);
  const { camera, gl } = useThree();
  const draggingRef = useRef(false);
  const zoneFloor = ALL_ZONES[zone]?.floor || 0;
  const floorRef = useRef(zoneFloor);
  const labelRef = useRef();
  const shownRef = useRef(true);
  // Remote avatars follow the floor their zone is on; your own changes only when you take the stairs.
  if (!isOwn) floorRef.current = zoneFloor;
  const targetRef = useRef(toWorld(x, y));
  const initialPos = useMemo(() => { const t = toWorld(x, y); return [t.x, zoneFloor * FLOOR_Y, t.z]; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastEmitRef = useRef(0);
  const lastZoneRef = useRef(zone);
  const stepAt = useRef(0);
  const pendingRef = useRef(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  // Where everyone is standing (or heading), so nobody lands on top of anybody else.
  const spot = useRef({ x: 0, z: 0, floor: 0 });
  useEffect(() => {
    const spots = view.current.spots || (view.current.spots = {});
    spots[avatarId] = spot.current;
    spot.current.x = targetRef.current.x; spot.current.z = targetRef.current.z; spot.current.floor = floorRef.current;
    return () => { delete spots[avatarId]; };
  }, [avatarId, view]);
  // keeps a spot inside the house (upstairs covers the back two rows, Breakup Room included)
  const limit = (wx, wz) => {
    const x = clamp(wx, -BOUND_X, BOUND_X);
    const z = clamp(wz, -BOUND_Z, floorRef.current ? BOUND_Z_UP : BOUND_Z);
    return { x, z };
  };
  // The nearest free place to (wx, wz): beside whoever is already there.
  const place = (wx, wz) => {
    const spots = view.current.spots || {};
    const others = Object.keys(spots).filter(k => k !== avatarId && spots[k].floor === floorRef.current).map(k => spots[k]);
    const r = freeSpot({ x: wx, z: wz }, others, limit);
    return limit(r.x, r.z);
  };

  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const movingViaInputRef = useRef(false);

  useEffect(() => {
    if (!isOwn) return;
    const isInputActive = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const onKeyDown = (e) => {
      if (isInputActive()) return;
      const k = e.key?.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') { keysRef.current.w = true; }
      if (k === 's' || e.key === 'ArrowDown') { keysRef.current.s = true; }
      if (k === 'a' || e.key === 'ArrowLeft') { keysRef.current.a = true; }
      if (k === 'd' || e.key === 'ArrowRight') { keysRef.current.d = true; }
    };

    const onKeyUp = (e) => {
      const k = e.key?.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') { keysRef.current.w = false; }
      if (k === 's' || e.key === 'ArrowDown') { keysRef.current.s = false; }
      if (k === 'a' || e.key === 'ArrowLeft') { keysRef.current.a = false; }
      if (k === 'd' || e.key === 'ArrowRight') { keysRef.current.d = false; }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOwn]);

  useEffect(() => {
    if (!draggingRef.current && !movingViaInputRef.current) targetRef.current = toWorld(x, y);
  }, [x, y]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Keyboard & Joystick WASD navigation for own avatar
    if (isOwn && !draggingRef.current) {
      let nx = 0;
      let ny = 0;
      if (keysRef.current.w) ny -= 1;
      if (keysRef.current.s) ny += 1;
      if (keysRef.current.a) nx -= 1;
      if (keysRef.current.d) nx += 1;

      if (view.current?.joystick) {
        nx += view.current.joystick.x || 0;
        ny += view.current.joystick.y || 0;
      }

      const inputLen = Math.hypot(nx, ny);
      if (inputLen > 0.05) {
        const snx = nx / inputLen;
        const sny = ny / inputLen;
        let moveX = sny + snx;
        let moveZ = sny - snx;
        if (view.current?.flip) {
          const tmp = moveX;
          moveX = moveZ;
          moveZ = tmp;
        }

        const moveLen = Math.hypot(moveX, moveZ);
        if (moveLen > 0.001) {
          const speed = 12.0;
          const step = Math.min(inputLen, 1.0) * speed * dt;
          const nextX = targetRef.current.x + (moveX / moveLen) * step;
          const nextZ = targetRef.current.z + (moveZ / moveLen) * step;
          const clamped = limit(nextX, nextZ);
          targetRef.current = clamped;
          emitThrottled(clamped.x, clamped.z);
          movingViaInputRef.current = true;

          // If crossing into a different room while moving, smoothly glide camera to the new room
          const v = toVirtual(clamped.x, clamped.z);
          const curZone = zoneForPoint(clamp(v.x, 0, FLOORPLAN_WIDTH), clamp(v.y, 0, FLOORPLAN_HEIGHT), floorRef.current);
          if (curZone && curZone !== lastZoneRef.current) {
            lastZoneRef.current = curZone;
            if (onDrop) onDrop(curZone);
          }
        }
      } else if (movingViaInputRef.current) {
        movingViaInputRef.current = false;
        const settled = place(targetRef.current.x, targetRef.current.z);
        targetRef.current = settled;
        emit(settled.x, settled.z);
        if (onDrop) {
          const v = toVirtual(settled.x, settled.z);
          const curZone = zoneForPoint(clamp(v.x, 0, FLOORPLAN_WIDTH), clamp(v.y, 0, FLOORPLAN_HEIGHT), floorRef.current);
          lastZoneRef.current = curZone;
          onDrop(curZone);
        }
      }
    }

    // A door click asks this (own) avatar to walk through to the next room.
    const walk = isOwn ? view.current.walk : null;
    if (walk && !draggingRef.current && !movingViaInputRef.current) {
      view.current.walk = null;
      if (walk.floor != null) floorRef.current = walk.floor;
      const r = place(walk.x, walk.z);
      targetRef.current = r;
      if (walk.snap) { g.position.x = r.x; g.position.z = r.z; }
      emit(r.x, r.z);
    }
    // Climb to the floor you are on, and only show people on a floor that is being drawn.
    g.position.y += (floorRef.current * FLOOR_Y - g.position.y) * (1 - Math.exp(-dt * 5));
    const vw = view.current;
    const shown = floorRef.current === (vw.floor || 0) || vw.cur < 0.8;
    if (g.visible !== shown) g.visible = shown;
    if (labelRef.current && shownRef.current !== shown) { shownRef.current = shown; labelRef.current.style.display = shown ? 'flex' : 'none'; }
    const t = targetRef.current;
    spot.current.x = t.x; spot.current.z = t.z; spot.current.floor = floorRef.current;
    // Frame-rate independent glide; a bit slower while the camera is gliding through a door so the walk is visible.
    const k = 1 - Math.exp(-dt * (draggingRef.current ? 48 : view.current.glide ? 6 : 13.4));
    const dx = (t.x - g.position.x) * k;
    const dz = (t.z - g.position.z) * k;
    g.position.x += dx;
    g.position.z += dz;
    // a soft footstep while you walk (only when room sounds are on)
    if (isOwn && shown && dx * dx + dz * dz > 0.0004) {
      const now = performance.now();
      if (now - stepAt.current > 260) { stepAt.current = now; playSfx('step'); }
    }
  });

  // Pointer -> floor position in the scene root's LOCAL space (undoing the
  // x<->z reflection when the view is flipped).
  const pointToGround = (cx, cy) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -floorRef.current * FLOOR_Y;
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return view.current.flip ? { x: hit.z, z: hit.x } : { x: hit.x, z: hit.z };
  };

  const emit = (wx, wz) => {
    const v = toVirtual(wx, wz);
    const vx = clamp(v.x, 0, FLOORPLAN_WIDTH);
    const vy = clamp(v.y, 0, FLOORPLAN_HEIGHT);
    onMove && onMove(vx, vy, zoneForPoint(vx, vy, floorRef.current));
  };

  // ~20/sec to match the server's avatar_move rate bucket, always flushing the
  // final position on release so the resting spot never desyncs.
  const emitThrottled = (wx, wz) => {
    pendingRef.current = { wx, wz };
    const now = performance.now();
    if (now - lastEmitRef.current >= 50) {
      lastEmitRef.current = now;
      emit(wx, wz);
      pendingRef.current = null;
    }
  };

  const onPointerDown = (e) => {
    // never let a press on someone's face fall through to whatever is behind them in the house
    e.stopPropagation();
    if (!isOwn) return;
    e.preventDefault();
    const start = pointToGround(e.clientX, e.clientY);
    if (!start) return;
    draggingRef.current = true;
    if (dragLockRef) dragLockRef.current = true;
    const off = { x: targetRef.current.x - start.x, z: targetRef.current.z - start.z };

    const move = (ev) => {
      const p = pointToGround(ev.clientX, ev.clientY);
      if (!p) return;
      const { x: wx, z: wz } = limit(p.x + off.x, p.z + off.z);
      targetRef.current = { x: wx, z: wz };
      emitThrottled(wx, wz);
    };
    const up = () => {
      draggingRef.current = false;
      if (dragLockRef) dragLockRef.current = false;
      // let go on someone's spot and you settle right beside them
      const settled = place(targetRef.current.x, targetRef.current.z);
      targetRef.current = settled;
      pendingRef.current = null;
      emit(settled.x, settled.z);
      if (onDrop) {
        const v = toVirtual(targetRef.current.x, targetRef.current.z);
        onDrop(zoneForPoint(clamp(v.x, 0, FLOORPLAN_WIDTH), clamp(v.y, 0, FLOORPLAN_HEIGHT), floorRef.current));
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <group ref={group} position={initialPos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <ScaledHtml position={[0, 0.95, 0]} zIndexRange={[40, 0]}>
        <div
          ref={labelRef}
          onPointerDown={onPointerDown}
          onClick={!isOwn && onWave ? () => onWave(avatarId) : undefined}
          title={!isOwn && onWave ? t('gamify.wave.tip', { defaultValue: 'Wave at {{name}}', name: username }) : undefined}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            cursor: isOwn ? 'grab' : onWave ? 'pointer' : 'default', touchAction: 'none', userSelect: 'none', pointerEvents: 'auto',
          }}
        >
          <div style={{ position: 'relative' }}>
          {emote && <EmoteBubble key={emote.n} id={emote.id} />}
          {say && <SayBubble key={say.n} text={say.text} />}
          <Avatar
            avatarPath={avatarPath}
            username={username}
            size={44}
            style={{
              border: speaking ? '3px solid #22c55e' : isOwn ? '3px solid #fff' : '3px solid rgba(255,255,255,0.7)',
              boxShadow: speaking ? '0 0 0 4px rgba(34,197,94,0.55), 0 6px 14px rgba(0,0,0,0.5)' : isOwn ? '0 0 0 3px rgba(139,92,255,0.7), 0 6px 14px rgba(0,0,0,0.5)' : '0 6px 14px rgba(0,0,0,0.5)',
            }}
          />
          {speaking && <span aria-label={username} style={{ position: 'absolute', right: -4, bottom: -2, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0c0a18' }}><Mic size={10} color="#fff" /></span>}
          </div>
          <span className="stay-white" style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 99,
            background: 'rgba(12,10,24,0.72)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 700,
            whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {isHost && <Crown size={11} color="#fbbf24" />}
            {username}
          </span>
        </div>
      </ScaledHtml>
    </group>
  );
}

// Only re-render when something about this person actually changed.
export default memo(Avatar3D);
