import React, { useRef, useEffect, useMemo, useState, useContext } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ZoomIn, ZoomOut, Maximize2, FlipHorizontal2, Users } from 'lucide-react';
import GamifyScene, { WALL_H } from './gamify/GamifyScene';
const PropViewer = React.lazy(() => import('./gamify/PropViewers'));
import Avatar3D from './gamify/Avatar3D';
import { ViewContext } from './gamify/parts';
import { TV, TV_H, TV_NATIVE_W, TV_NATIVE_H } from './gamify/constants';
import { DEFAULT_SPAWN, FLOORPLAN_ZONES, CELL_W, CELL_D, COLS, ROWS } from '../data/gamifyZones';
import { homographyMatrix3d } from '../lib/homography';

const MIN_ZOOM = 0.36; // zoomed all the way out shows most of the house
const MAX_ZOOM = 2.8;
const FLIP_KEY = 'sp_gamify_flip';
const CAM_OFFSET = new THREE.Vector3(18, 15.5, 18);
const SIN_ELEV = CAM_OFFSET.y / CAM_OFFSET.length();
const COS_ELEV = Math.sqrt(1 - SIN_ELEV * SIN_ELEV);
// Zoom 1 = exactly one room (floor + its back walls) fills the view. Screen
// extent of a CELL_W x CELL_D cell under the isometric camera:
const FIT_W = (CELL_W + CELL_D) / Math.SQRT2;
const FIT_H = FIT_W * SIN_ELEV + WALL_H * COS_ELEV;
// Aim a little above the floor so the room's walls + floor (not just the floor)
// are centred on screen.
const TARGET_Y = WALL_H / 2;
const ZONE_LIST = Object.values(FLOORPLAN_ZONES);
// Camera targets may roam over every room centre plus a margin. Mirrored (flipped)
// view reflects the house across the x=z diagonal, so the two limits swap.
const panLimits = (flip) => {
  const lx = ((COLS - 1) * CELL_W) / 2 + 4;
  const lz = ((ROWS - 1) * CELL_D) / 2 + 4;
  return flip ? { x: lz, z: lx } : { x: lx, z: lz };
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Isometric camera. `view.zoom` is the TARGET zoom; `view.cur` eases toward it
// every frame (so wheel ticks, buttons and pinch all feel smooth, and zooming
// out from a deep zoom is as fast as zooming in — zoom is multiplicative, not
// a fixed linear step). Pan targets ease the same way. Everything is read from
// refs inside useFrame, never React state, so panning/zooming never re-renders
// Room.jsx.
function Rig({ viewRef, dragLockRef, onFocusChange, onOutChange, onReady }) {
  const readyRef = useRef(false);
  const { camera, gl, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map();
    let last = null;
    let lastT = 0;
    let vel = { x: 0, z: 0 }; // smoothed world-units/sec, for the release fling
    let pinch = null;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const down = (e) => {
      if (dragLockRef.current) return;
      viewRef.current.glide = false; // grabbing the view cancels a door glide
      viewRef.current.vel = null; // ...and any fling in progress
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: dist(a, b), z: viewRef.current.zoom };
        last = null;
      } else if (pts.size === 1) {
        last = { x: e.clientX, y: e.clientY };
        lastT = e.timeStamp;
        vel = { x: 0, z: 0 };
        viewRef.current.dragging = true;
      }
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = viewRef.current;
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        v.zoom = clamp(pinch.z * (dist(a, b) / Math.max(pinch.d, 1)), MIN_ZOOM, MAX_ZOOM);
        return;
      }
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      const dtMs = Math.max(1, e.timeStamp - lastT);
      last = { x: e.clientX, y: e.clientY };
      lastT = e.timeStamp;
      const z = camera.zoom || 1;
      // Ground-plane axes of the isometric view: screen-right and screen-up
      // (away from the camera). Vertical drags are foreshortened by the
      // camera's elevation angle.
      const k = 1 / Math.SQRT2;
      const up = dy / (z * SIN_ELEV);
      const lim = panLimits(v.flip);
      const dwx = (-dx / z) * k - up * k;
      const dwz = (dx / z) * k - up * k;
      v.tx = clamp(v.tx + dwx, -lim.x, lim.x);
      v.tz = clamp(v.tz + dwz, -lim.z, lim.z);
      // blend into the running velocity estimate (units/sec)
      const a = 0.4;
      vel = { x: vel.x * (1 - a) + (dwx / dtMs) * 1000 * a, z: vel.z * (1 - a) + (dwz / dtMs) * 1000 * a };
    };
    const up = (e) => {
      const wasDragging = pts.size === 1 && last;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      last = pts.size === 1 ? { ...[...pts.values()][0] } : null;
      if (pts.size === 0) {
        const v = viewRef.current;
        v.dragging = false;
        // Fling: keep coasting in the release direction if the finger was still moving.
        if (wasDragging && e.type === 'pointerup' && e.timeStamp - lastT < 80 && Math.hypot(vel.x, vel.z) > 1.5) v.vel = { x: vel.x, z: vel.z };
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [camera, gl, dragLockRef, viewRef]);

  useFrame((_, dt) => {
    const v = viewRef.current;
    const kz = 1 - Math.exp(-dt * 11);
    v.cur += (v.zoom - v.cur) * kz;
    if (v.vel) {
      // fling: coast with friction, stopping at the pan limits
      const lim = panLimits(v.flip);
      v.tx = clamp(v.tx + v.vel.x * dt, -lim.x, lim.x);
      v.tz = clamp(v.tz + v.vel.z * dt, -lim.z, lim.z);
      const f = Math.exp(-dt * 3.2);
      v.vel.x *= f; v.vel.z *= f;
      if (Math.hypot(v.vel.x, v.vel.z) < 0.4) v.vel = null;
    }
    if (v.dragging || v.vel) {
      // the view sticks to the finger 1:1 while dragging (no easing lag)
      v.px = v.tx; v.pz = v.tz;
    } else {
      // a door glide eases slowly between rooms; everything else settles quickly
      const kp = 1 - Math.exp(-dt * (v.glide ? 4.2 : 14));
      v.px += (v.tx - v.px) * kp;
      v.pz += (v.tz - v.pz) * kp;
    }
    if (v.glide && Math.abs(v.tx - v.px) + Math.abs(v.tz - v.pz) < 0.05) v.glide = false;
    camera.zoom = Math.min(size.width / (FIT_W * 0.95), size.height / (FIT_H * 0.9)) * v.cur;
    target.set(v.px, TARGET_Y, v.pz);
    camera.position.copy(target).add(CAM_OFFSET);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    if (!readyRef.current) { readyRef.current = true; onReady && onReady(); }

    // Which room is the view centred on? (local, un-mirrored coordinates)
    const lx = v.flip ? v.pz : v.px;
    const lz = v.flip ? v.px : v.pz;
    let best = v.focus;
    let bestD = Infinity;
    for (const z of ZONE_LIST) {
      const d = (z.center.x - lx) ** 2 + (z.center.z - lz) ** 2;
      if (d < bestD) { bestD = d; best = z.id; }
    }
    const out = v.cur < 0.8;
    if (out !== v.out) { v.out = out; onOutChange && onOutChange(out); }
    if (best !== v.focus) {
      v.focus = best;
      onFocusChange && onFocusChange(best);
    }
  });
  return null;
}

// Mirrors the whole house (and the avatars standing in it) left<->right. A
// pure view preference: avatar positions travel in shared virtual coordinates,
// so a flipped viewer and a normal viewer still agree on who is where.
// (three.js flips triangle winding automatically for negative-determinant objects.)
function MirrorRoot({ children }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  const applied = useRef(null);
  useFrame(() => {
    const g = ref.current;
    if (!g || applied.current === view.current.flip) return;
    applied.current = view.current.flip;
    // Reflection across the plane x = z (swap the x and z axes). A fixed
    // isometric camera at (+d, +h, +d) sits ON that plane, so this is exactly a
    // left<->right mirror of the screen image — cutaway walls stay on the far
    // side — which a plain x-negation is not.
    if (applied.current) g.matrix.set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    else g.matrix.identity();
    g.matrixWorldNeedsUpdate = true;
  });
  return <group ref={ref} matrixAutoUpdate={false}>{children}</group>;
}

// Projects the 3D TV screen's four corners to container pixels every frame and
// CSS-matrix3d's the REAL player element (Room.jsx's player-wrap) onto that
// quad — so the video plays on the 3D TV's slanted screen. The element is only
// restyled, never moved into a different React parent, so toggling Gamify Mode
// never remounts it (which would drop playback / a live Hyperbeam session).
function TvProjector({ tvElementRef, onTvReady }) {
  const { camera, size } = useThree();
  const view = useContext(ViewContext);
  const v = useMemo(() => new THREE.Vector3(), []);
  const lastRef = useRef('');
  const readyRef = useRef(false);

  useFrame(() => {
    const el = tvElementRef.current;
    if (!el) return;
    const hw = TV.w / 2;
    const hh = TV_H / 2;
    // Mirrored view: the scene is reflected across x=z, so a local point
    // (x, y, z) lands at world (z, y, x), and the video's left edge belongs on
    // the mirror image of the screen's original right edge.
    const flip = view.current.flip;
    const corners = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([dx, dy]) => {
      const lx = flip ? TV.cx - dx : TV.cx + dx;
      if (flip) v.set(TV.z, TV.cy + dy, lx); else v.set(lx, TV.cy + dy, TV.z);
      v.project(camera);
      return [(v.x * 0.5 + 0.5) * size.width, (-v.y * 0.5 + 0.5) * size.height];
    });
    const m = homographyMatrix3d(TV_NATIVE_W, TV_NATIVE_H, corners);
    if (!m) return;
    if (m !== lastRef.current) {
      lastRef.current = m;
      el.style.transformOrigin = '0 0';
      el.style.transform = m;
    }
    if (!readyRef.current) {
      readyRef.current = true;
      onTvReady && onTvReady(true);
    }
  });

  useEffect(() => () => {
    const el = tvElementRef.current;
    if (el) { el.style.transform = ''; el.style.transformOrigin = ''; }
    onTvReady && onTvReady(false);
  }, [tvElementRef, onTvReady]);

  return null;
}

class WebGLBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('[GAMIFY] 3D view failed to start:', err?.message); }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', padding: 24 }}>
          3D view isn't supported on this device — turn Gamify Mode off to go back to the normal player.
        </div>
      );
    }
    return this.props.children;
  }
}

function readFlip() {
  try { return localStorage.getItem(FLIP_KEY) === '1'; } catch { return false; }
}

const roomCenterTarget = (id, flip) => {
  const c = FLOORPLAN_ZONES[id].center;
  return flip ? { x: c.z, z: c.x } : { x: c.x, z: c.z };
};

// The 3D social-space view Room.jsx swaps in for the video rectangle when
// Gamify Mode is on (loaded lazily — three.js is the heaviest dependency in
// the app and only matters to people who turn this on). One room fills the
// screen at a time; drag to roam to the next, or use a door / the room map.
export default function GamifyFloorPlan({ userList, mySocketId, avatarPositions, knownAvatars, hostId, onMove, onExitHouse, tvElementRef, onTvReady }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const myZoneRef = useRef(avatarPositions?.[mySocketId]?.zone || DEFAULT_SPAWN.zone);
  if (!viewRef.current) {
    const flip = readFlip();
    const t = roomCenterTarget(myZoneRef.current, flip);
    viewRef.current = { uiVisible: true, openProp: null, zoom: 1, cur: 1, tx: t.x, tz: t.z, px: t.x, pz: t.z, flip, focus: myZoneRef.current, glide: false, walk: null, vel: null, dragging: false, out: false, open: {} };
  }
  const dragLockRef = useRef(false);
  const [flipped, setFlipped] = useState(() => viewRef.current.flip);
  const [focus, setFocus] = useState(() => viewRef.current.focus);
  const [zoomedOut, setZoomedOut] = useState(false);
  const [myZone, setMyZone] = useState(() => myZoneRef.current);
  const [viewer, setViewer] = useState(null); // 'books' | 'fridge'
  const [uiShown, setUiShown] = useState(true);
  // drei <Html> overlays (avatars, door buttons, signs) must not mount until the
  // canvas has rendered its first frame: mounted earlier, their DOM parent is
  // still changing, and the resulting unmount/remount race leaves some of them
  // missing for good.
  const [ready, setReady] = useState(false);
  // Phones/tablets: lighter render settings from the start, and PerformanceMonitor
  // drops further (no shadows, 1x pixels) if the frame rate is still poor.
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const [lowQ, setLowQ] = useState(false);

  // In-room labels (door buttons, prop chips, the hint) fade out after a few idle
  // seconds so they stop covering the scene, and come back on any pointer/touch/wheel.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let t;
    const show = () => {
      viewRef.current.uiVisible = true;
      setUiShown(true);
      clearTimeout(t);
      t = setTimeout(() => { viewRef.current.uiVisible = false; setUiShown(false); }, 3500);
    };
    show();
    const evs = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown'];
    evs.forEach(e => el.addEventListener(e, show, { passive: true }));
    return () => { clearTimeout(t); evs.forEach(e => el.removeEventListener(e, show)); };
  }, []);
  // Scene props (bookshelf, fridge) open their full-screen viewer through this hook.
  useEffect(() => {
    const v = viewRef.current;
    v.openProp = setViewer;
    return () => { v.openProp = null; };
  }, []);

  // Wheel zoom: multiplicative (each tick scales by a fixed ratio) so it feels
  // the same at any zoom level. Native non-passive listener — React's onWheel
  // is passive, so preventDefault there silently no-ops and the page scrolls.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      const rate = e.ctrlKey ? 0.012 : 0.0016; // trackpad pinch reports ctrlKey with small deltas
      v.zoom = clamp(v.zoom * Math.exp(-e.deltaY * rate), MIN_ZOOM, MAX_ZOOM);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Glide the camera so room `id` fills the view.
  const focusRoom = (id, zoom = 1) => {
    const v = viewRef.current;
    const t = roomCenterTarget(id, v.flip);
    v.tx = t.x; v.tz = t.z; v.zoom = zoom; v.glide = true;
  };
  // A door: glide into the next room and, if that is where you were standing, walk through it.
  const goThroughDoor = (link) => {
    focusRoom(link.to);
    if (myZoneRef.current === link.from) viewRef.current.walk = { x: link.entry.x, z: link.entry.z };
  };
  const handleMove = (x, y, zone) => {
    if (zone !== myZoneRef.current) { myZoneRef.current = zone; setMyZone(zone); } // keeps the room map's head-count live
    if (onMove) onMove(x, y, zone);
  };
  // Dropping your avatar into another room brings the camera along.
  const handleDrop = (zone) => { if (zone !== viewRef.current.focus) focusRoom(zone, viewRef.current.zoom); };

  const zoomBy = (ratio) => { const v = viewRef.current; v.zoom = clamp(v.zoom * ratio, MIN_ZOOM, MAX_ZOOM); };
  const resetView = () => focusRoom(myZoneRef.current);
  const toggleFlip = () => {
    const v = viewRef.current;
    const next = !v.flip;
    v.flip = next;
    // The mirrored world is the old one reflected across x=z, so swap the camera
    // target too — otherwise a panned view would jump to a different spot.
    [v.tx, v.tz] = [v.tz, v.tx];
    [v.px, v.pz] = [v.pz, v.px];
    setFlipped(next);
    try { localStorage.setItem(FLIP_KEY, next ? '1' : '0'); } catch { /* private mode etc. */ }
  };

  const counts = useMemo(() => {
    const c = {};
    // Your own moves are not echoed back through avatarPositions, so use the live local zone for you.
    userList.forEach(u => { const z = u.socketId === mySocketId ? myZone : (avatarPositions?.[u.socketId]?.zone || DEFAULT_SPAWN.zone); c[z] = (c[z] || 0) + 1; });
    return c;
  }, [userList, avatarPositions, myZone, mySocketId]);

  const btn = { width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(12,10,24,0.72)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' };
  const glass = { background: 'rgba(12,10,24,0.72)', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', color: '#fff' };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b0a14', touchAction: 'none' }}>
      <WebGLBoundary>
        <Canvas
          orthographic
          shadows={!lowQ}
          dpr={lowQ ? 1 : [1, coarse ? 1.25 : 1.5]}
          camera={{ position: [18, 15.5, 18], zoom: 30, near: -120, far: 320 }}
          gl={{ antialias: true }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <color attach="background" args={['#0b0a14']} />
          <ViewContext.Provider value={viewRef}>
            <PerformanceMonitor onDecline={() => setLowQ(true)} flipflops={2} />
            <Rig viewRef={viewRef} dragLockRef={dragLockRef} onFocusChange={setFocus} onOutChange={setZoomedOut} onReady={() => setReady(true)} />
            <MirrorRoot>
              <GamifyScene onGoToRoom={goThroughDoor} onExitHouse={onExitHouse} focus={ready ? focus : null} zoomedOut={ready && zoomedOut} lowQ={lowQ} coarse={coarse} />
              {ready && userList.map(user => {
                const pos = avatarPositions?.[user.socketId] || DEFAULT_SPAWN;
                const own = user.socketId === mySocketId;
                return (
                  <Avatar3D
                    key={user.socketId}
                    username={user.username}
                    avatarPath={knownAvatars?.[user.username] || user.avatarPath}
                    isHost={user.isHost || user.socketId === hostId}
                    isOwn={own}
                    x={pos.x}
                    y={pos.y}
                    onMove={own ? handleMove : undefined}
                    onDrop={own ? handleDrop : undefined}
                    dragLockRef={dragLockRef}
                  />
                );
              })}
            </MirrorRoot>
            <TvProjector tvElementRef={tvElementRef} onTvReady={onTvReady} />
          </ViewContext.Provider>
        </Canvas>
      </WebGLBoundary>

      {/* current room + hint */}
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
        <div className="stay-white" style={{ ...glass, padding: '5px 16px', borderRadius: 99, fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>{FLOORPLAN_ZONES[focus].label}</div>
        <div className="stay-white" style={{ transition: 'opacity .4s', fontSize: 11, opacity: uiShown ? 0.7 : 0, textShadow: '0 1px 3px #000' }}>Drag to look around, tap a door to go through</div>
      </div>

      {viewer && (
        <React.Suspense fallback={null}>
          <PropViewer kind={viewer} onClose={() => setViewer(null)} />
        </React.Suspense>
      )}

      {/* room map */}
      <div className="stay-white" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 60, display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4, padding: 6, borderRadius: 12, ...glass }}>
        {ZONE_LIST.slice().sort((a, b) => a.row - b.row || a.col - b.col).map(z => (
          <button
            key={z.id}
            className="stay-white"
            onClick={() => focusRoom(z.id)}
            title={`Go to ${z.label}`}
            style={{
              minWidth: 62, padding: '6px 6px 5px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#fff',
              background: z.id === focus ? 'rgba(139,92,255,0.8)' : 'rgba(255,255,255,0.07)',
              border: z.id === focus ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {z.label}
            {counts[z.id] > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4, fontSize: 10 }}>
                <Users size={9} />{counts[z.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 60 }}>
        <button className="stay-white" onClick={toggleFlip} title="Flip house left/right" style={{ ...btn, background: flipped ? 'rgba(139,92,255,0.75)' : btn.background }}><FlipHorizontal2 size={16} /></button>
        <button className="stay-white" onClick={resetView} title="Back to my room" style={btn}><Maximize2 size={16} /></button>
        <button className="stay-white" onClick={() => zoomBy(1.3)} title="Zoom in" style={btn}><ZoomIn size={16} /></button>
        <button className="stay-white" onClick={() => zoomBy(1 / 1.3)} title="Zoom out" style={btn}><ZoomOut size={16} /></button>
      </div>
    </div>
  );
}
