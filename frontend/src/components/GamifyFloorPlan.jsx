import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ZoomIn, ZoomOut } from 'lucide-react';
import GamifyScene, { TV, TV_H, TV_NATIVE_W, TV_NATIVE_H } from './gamify/GamifyScene';
import Avatar3D from './gamify/Avatar3D';
import { DEFAULT_SPAWN } from '../data/gamifyZones';
import { homographyMatrix3d } from '../lib/homography';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.8;
const CAM_OFFSET = new THREE.Vector3(16, 14, 16);
const SIN_ELEV = CAM_OFFSET.y / CAM_OFFSET.length();

// Isometric camera: fits the whole room to the container, then applies the
// user's zoom multiplier and drag-to-pan. Everything is read from refs inside
// useFrame, never React state, so panning/zooming never re-renders Room.jsx.
function Rig({ viewRef, dragLockRef }) {
  const { camera, gl, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const el = gl.domElement;
    let last = null;
    const down = (e) => {
      if (dragLockRef.current) return;
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      const z = camera.zoom || 1;
      const t = target.current;
      // Ground-plane axes of the isometric view: screen-right and screen-up
      // (away from the camera). Vertical drag is foreshortened by the
      // camera's elevation angle.
      t.x += (-dx / z) * (1 / Math.SQRT2) + (dy / (z * SIN_ELEV)) * (-1 / Math.SQRT2);
      t.z += (dx / z) * (1 / Math.SQRT2) + (dy / (z * SIN_ELEV)) * (-1 / Math.SQRT2);
      t.x = Math.max(-8, Math.min(8, t.x));
      t.z = Math.max(-5, Math.min(5, t.z));
    };
    const up = () => { last = null; };
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
  }, [camera, gl, dragLockRef]);

  useFrame(() => {
    const base = Math.min(size.width / 25, size.height / 17);
    camera.zoom = base * viewRef.current.zoom;
    camera.position.copy(target.current).add(CAM_OFFSET);
    camera.lookAt(target.current);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });
  return null;
}

// Projects the 3D TV screen's four corners to container pixels every frame and
// CSS-matrix3d's the REAL player element (Room.jsx's player-wrap) onto that
// quad — so the video plays on the 3D TV's slanted screen. The element is only
// restyled, never moved into a different React parent, so toggling Gamify Mode
// never remounts it (which would drop playback / a live Hyperbeam session).
function TvProjector({ tvElementRef, onTvReady }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const lastRef = useRef('');
  const readyRef = useRef(false);

  useFrame(() => {
    const el = tvElementRef.current;
    if (!el) return;
    const hw = TV.w / 2;
    const hh = TV_H / 2;
    const corners = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([dx, dy]) => {
      v.set(TV.cx + dx, TV.cy + dy, TV.z).project(camera);
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

// The 3D social-space view Room.jsx swaps in for the video rectangle when
// Gamify Mode is on (loaded lazily — three.js is the heaviest dependency in
// the app and only matters to people who turn this on).
export default function GamifyFloorPlan({ userList, mySocketId, avatarPositions, knownAvatars, hostId, onMove, tvElementRef, onTvReady }) {
  const containerRef = useRef(null);
  const viewRef = useRef({ zoom: 1 });
  const dragLockRef = useRef(false);

  // Desktop wheel zoom. Native non-passive listener (React's onWheel is
  // passive, so preventDefault there silently no-ops and the page scrolls).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      viewRef.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewRef.current.zoom - e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (d) => { viewRef.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewRef.current.zoom + d)); };
  const btn = { width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(8,6,20,0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)' };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b0a14', touchAction: 'none' }}>
      <WebGLBoundary>
        <Canvas
          orthographic
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [16, 14, 16], zoom: 30, near: -50, far: 200 }}
          gl={{ antialias: true }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <color attach="background" args={['#0b0a14']} />
          <Rig viewRef={viewRef} dragLockRef={dragLockRef} />
          <GamifyScene />
          {userList.map(user => {
            const pos = avatarPositions?.[user.socketId] || DEFAULT_SPAWN;
            return (
              <Avatar3D
                key={user.socketId}
                username={user.username}
                avatarPath={knownAvatars?.[user.username] || user.avatarPath}
                isHost={user.isHost || user.socketId === hostId}
                isOwn={user.socketId === mySocketId}
                x={pos.x}
                y={pos.y}
                onMove={user.socketId === mySocketId ? onMove : undefined}
                dragLockRef={dragLockRef}
              />
            );
          })}
          <TvProjector tvElementRef={tvElementRef} onTvReady={onTvReady} />
        </Canvas>
      </WebGLBoundary>

      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 60 }}>
        <button onClick={() => zoomBy(0.25)} title="Zoom in" style={btn}><ZoomIn size={16} /></button>
        <button onClick={() => zoomBy(-0.25)} title="Zoom out" style={btn}><ZoomOut size={16} /></button>
      </div>
    </div>
  );
}
