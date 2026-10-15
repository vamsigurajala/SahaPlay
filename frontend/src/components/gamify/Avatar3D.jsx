import { useRef, useMemo, useEffect, useContext } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Crown } from 'lucide-react';
import Avatar from '../Avatar';
import { FLOORPLAN_WIDTH, FLOORPLAN_HEIGHT, WORLD_W, WORLD_D, FLOOR_Y, ALL_ZONES, zoneForPoint } from '../../data/gamifyZones';
import { ScaledHtml, ViewContext } from './parts';

const toWorld = (vx, vy) => ({ x: (vx / FLOORPLAN_WIDTH - 0.5) * WORLD_W, z: (vy / FLOORPLAN_HEIGHT - 0.5) * WORLD_D });
const toVirtual = (wx, wz) => ({ x: (wx / WORLD_W + 0.5) * FLOORPLAN_WIDTH, y: (wz / WORLD_D + 0.5) * FLOORPLAN_HEIGHT });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BOUND_X = WORLD_W / 2 - 0.7;
const BOUND_Z = WORLD_D / 2 - 0.7;
// Upstairs only covers the back two rows of the house.
const BOUND_Z_UP = -WORLD_D / 2 + 2 * (WORLD_D / 3) - 0.7;

// One participant, standing on the floor of the 3D house. Only the viewer's own
// avatar is draggable; dragging raycasts the pointer onto the floor plane so
// movement follows the isometric view correctly at any zoom/pan. Avatars live
// inside the (possibly mirrored) scene root, so positions here are always in
// the un-mirrored local space — a flipped view only changes how they render,
// never what's sent over the socket (everyone shares the same virtual coords).
export default function Avatar3D({ username, avatarPath, isHost, isOwn, x, y, zone, onMove, onDrop, dragLockRef }) {
  const group = useRef();
  const view = useContext(ViewContext);
  const { camera, gl } = useThree();
  const draggingRef = useRef(false);
  const zoneFloor = ALL_ZONES[zone]?.floor || 0;
  const floorRef = useRef(zoneFloor);
  const labelRef = useRef();
  // Remote avatars follow the floor their zone is on; your own changes only when you take the stairs.
  if (!isOwn) floorRef.current = zoneFloor;
  const targetRef = useRef(toWorld(x, y));
  const initialPos = useMemo(() => { const t = toWorld(x, y); return [t.x, zoneFloor * FLOOR_Y, t.z]; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastEmitRef = useRef(0);
  const pendingRef = useRef(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (!draggingRef.current) targetRef.current = toWorld(x, y);
  }, [x, y]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // A door click asks this (own) avatar to walk through to the next room.
    const walk = isOwn ? view.current.walk : null;
    if (walk && !draggingRef.current) {
      view.current.walk = null;
      if (walk.floor != null) floorRef.current = walk.floor;
      targetRef.current = { x: walk.x, z: walk.z };
      if (walk.snap) { g.position.x = walk.x; g.position.z = walk.z; }
      emit(walk.x, walk.z);
    }
    // Climb to the floor you are on, and only show people on a floor that is being drawn.
    g.position.y += (floorRef.current * FLOOR_Y - g.position.y) * (1 - Math.exp(-dt * 5));
    const vw = view.current;
    const shown = floorRef.current === (vw.floor || 0) || vw.cur < 0.8;
    if (g.visible !== shown) g.visible = shown;
    if (labelRef.current) labelRef.current.style.display = shown ? 'flex' : 'none';
    const t = targetRef.current;
    // Frame-rate independent glide; a bit slower while the camera is gliding through a door so the walk is visible.
    const k = 1 - Math.exp(-dt * (draggingRef.current ? 48 : view.current.glide ? 6 : 13.4));
    g.position.x += (t.x - g.position.x) * k;
    g.position.z += (t.z - g.position.z) * k;
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
    if (!isOwn) return;
    e.preventDefault();
    e.stopPropagation();
    const start = pointToGround(e.clientX, e.clientY);
    if (!start) return;
    draggingRef.current = true;
    if (dragLockRef) dragLockRef.current = true;
    const off = { x: targetRef.current.x - start.x, z: targetRef.current.z - start.z };

    const move = (ev) => {
      const p = pointToGround(ev.clientX, ev.clientY);
      if (!p) return;
      const wx = clamp(p.x + off.x, -BOUND_X, BOUND_X);
      let wz = clamp(p.z + off.z, -BOUND_Z, floorRef.current ? BOUND_Z_UP : BOUND_Z);
      // the front-right cell upstairs is open air
      if (floorRef.current && wx > WORLD_W / 6 - 0.3 && wz > -WORLD_D / 6 - 0.7) wz = -WORLD_D / 6 - 0.7;
      targetRef.current = { x: wx, z: wz };
      emitThrottled(wx, wz);
    };
    const up = () => {
      draggingRef.current = false;
      if (dragLockRef) dragLockRef.current = false;
      if (pendingRef.current) { emit(pendingRef.current.wx, pendingRef.current.wz); pendingRef.current = null; }
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
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            cursor: isOwn ? 'grab' : 'default', touchAction: 'none', userSelect: 'none', pointerEvents: 'auto',
          }}
        >
          <Avatar
            avatarPath={avatarPath}
            username={username}
            size={44}
            style={{
              border: isOwn ? '3px solid #fff' : '3px solid rgba(255,255,255,0.7)',
              boxShadow: isOwn ? '0 0 0 3px rgba(139,92,255,0.7), 0 6px 14px rgba(0,0,0,0.5)' : '0 6px 14px rgba(0,0,0,0.5)',
            }}
          />
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
