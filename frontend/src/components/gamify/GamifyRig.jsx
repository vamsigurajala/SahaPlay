import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WALL_H } from './GamifyScene';
import { FLOORPLAN_ZONES, ALL_ZONES, FLOOR_Y, CELL_W, CELL_D, COLS, ROWS } from '../../data/gamifyZones';

export const MIN_ZOOM = 0.08; // zoomed all the way out shows entire house, all floors, cricket, market and outer grounds as a complete map
export const MAX_ZOOM = 3.2; // deep zoom into rooms, shops & cricket ground
export const CAM_OFFSET = new THREE.Vector3(18, 15.5, 18);
export const SIN_ELEV = CAM_OFFSET.y / CAM_OFFSET.length();
export const COS_ELEV = Math.sqrt(1 - SIN_ELEV * SIN_ELEV);
// Zoom 1 = exactly one room (floor + its back walls) fills the view. Screen
// extent of a CELL_W x CELL_D cell under the isometric camera:
export const FIT_W = (CELL_W + CELL_D) / Math.SQRT2;
export const FIT_H = FIT_W * SIN_ELEV + WALL_H * COS_ELEV;
// Aim a little above the floor so the room's walls + floor (not just the floor)
// are centred on screen.
export const TARGET_Y = WALL_H / 2;
export const ZONES_BY_FLOOR = [Object.values(FLOORPLAN_ZONES), Object.values(ALL_ZONES).filter(z => z.floor === 1)];

// Camera targets may roam over every room centre plus a wide margin (reaching shops,
// market, front street and cricket pitch).
export const panLimits = (flip, floor = 0) => {
  const lx = ((COLS - 1) * CELL_W) / 2 + 36;
  const zmin = -(((ROWS - 1) * CELL_D) / 2 + 36);
  const zmax = floor ? CELL_D / 2 - 4 : -zmin + 36;
  return flip ? { xmin: zmin, xmax: zmax, zmin: -lx, zmax: lx } : { xmin: -lx, xmax: lx, zmin, zmax };
};
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Isometric camera. `view.zoom` is the TARGET zoom; `view.cur` eases toward it
// every frame (so wheel ticks, buttons and pinch all feel smooth, and zooming
// out from a deep zoom is as fast as zooming in — zoom is multiplicative, not
// a fixed linear step). Pan targets ease the same way. Everything is read from
// refs inside useFrame, never React state, so panning/zooming never re-renders
// Room.jsx.
export default function Rig({ viewRef, dragLockRef, onFocusChange, onOutChange, onInChange, onReady }) {
  const readyRef = useRef(false);
  const lastFocusCommitRef = useRef(0);
  const isPinchingRef = useRef(false);
  const frameCount = useRef(0);
  const { camera, gl, size, events } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  // three.js starts an orthographic pointer ray at the camera plane, so anything above
  // and in front of it (the drifting clouds) could never be tapped. Start the ray well
  // behind the camera instead; hit order is unchanged.
  useEffect(() => {
    const prev = events.compute;
    events.compute = (event, state) => {
      state.pointer.set((event.offsetX / state.size.width) * 2 - 1, -(event.offsetY / state.size.height) * 2 + 1);
      state.raycaster.setFromCamera(state.pointer, state.camera);
      if (state.camera.isOrthographicCamera) state.raycaster.ray.origin.addScaledVector(state.raycaster.ray.direction, -90);
    };
    return () => { events.compute = prev; };
  }, [events]);

  useEffect(() => {
    const el = gl.domElement;
    try {
      el.style.touchAction = 'none';
      el.style.userSelect = 'none';
      el.style.webkitUserSelect = 'none';
    } catch {}

    const pts = new Map();
    let last = null;
    let lastT = 0;
    let vel = { x: 0, z: 0 }; // smoothed world-units/sec, for the release fling
    let pinch = null;
    let lastPinchT = 0;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const down = (e) => {
      if (dragLockRef.current) return;
      viewRef.current.glide = false; // grabbing the view cancels a door glide
      viewRef.current.vel = null; // ...and any fling in progress

      // If this is the primary pointer beginning a gesture, wipe any stale touch points
      if (e.isPrimary) {
        pts.clear();
        pinch = null;
        isPinchingRef.current = false;
      }

      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pts.size === 1) {
        last = { x: e.clientX, y: e.clientY };
        lastT = e.timeStamp;
        vel = { x: 0, z: 0 };
        viewRef.current.dragging = true;
      } else if (pts.size >= 2) {
        // Multi-touch pinch: release any single pointer capture and cancel drag
        isPinchingRef.current = true;
        viewRef.current.dragging = false;
        try {
          for (const pid of pts.keys()) {
            el.releasePointerCapture?.(pid);
          }
        } catch (_) {}
        const [a, b] = [...pts.values()];
        const d = dist(a, b);
        pinch = {
          lastD: d,
          startD: d,
          lastCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
        last = null;
        lastPinchT = performance.now();
      }
    };

    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = viewRef.current;

      if (pts.size >= 2) {
        // Multi-touch pinch gesture: fingers moving together zoom out; fingers moving apart zoom in
        isPinchingRef.current = true;
        const [a, b] = [...pts.values()];
        const curD = dist(a, b);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinch && pinch.lastD > 8 && curD > 8) {
          const delta = curD / pinch.lastD;
          v.zoom = clamp(v.zoom * delta, MIN_ZOOM, MAX_ZOOM);
          // Instant 1:1 camera zoom tracking under two fingers
          v.cur = v.zoom;

          // Simultaneous two-finger pan with center position
          if (pinch.lastCenter) {
            const dx = center.x - pinch.lastCenter.x;
            const dy = center.y - pinch.lastCenter.y;
            const z = camera.zoom || 1;
            const k = 1 / Math.SQRT2;
            const up = dy / (z * SIN_ELEV);
            const lim = panLimits(v.flip, v.floor);
            const dwx = (-dx / z) * k - up * k;
            const dwz = (dx / z) * k - up * k;
            v.tx = clamp(v.tx + dwx, lim.xmin, lim.xmax);
            v.tz = clamp(v.tz + dwz, lim.zmin, lim.zmax);
            v.px = v.tx;
            v.pz = v.tz;
          }
          pinch.lastD = curD;
          pinch.lastCenter = center;
          lastPinchT = performance.now();
        } else if (!pinch && curD > 8) {
          pinch = { lastD: curD, lastCenter: center };
        }
        return;
      }

      // Single-finger drag: ONLY moves canvas to see other rooms, NEVER zooms!
      if (performance.now() - lastPinchT < 80) {
        last = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!last) {
        last = { x: e.clientX, y: e.clientY };
        lastT = e.timeStamp;
        return;
      }

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
      const lim = panLimits(v.flip, v.floor);
      const dwx = (-dx / z) * k - up * k;
      const dwz = (dx / z) * k - up * k;
      v.tx = clamp(v.tx + dwx, lim.xmin, lim.xmax);
      v.tz = clamp(v.tz + dwz, lim.zmin, lim.zmax);
      // blend into the running velocity estimate (units/sec)
      const a = 0.4;
      vel = { x: vel.x * (1 - a) + (dwx / dtMs) * 1000 * a, z: vel.z * (1 - a) + (dwz / dtMs) * 1000 * a };
    };

    const up = (e) => {
      const wasDragging = pts.size === 1 && last && (performance.now() - lastPinchT > 100);
      try { el.releasePointerCapture?.(e.pointerId); } catch (_) {}
      pts.delete(e.pointerId);

      if (pts.size < 2) {
        pinch = null;
        isPinchingRef.current = false;
        lastPinchT = performance.now();
      }

      last = pts.size === 1 ? { ...[...pts.values()][0] } : null;
      if (pts.size === 0) {
        const v = viewRef.current;
        v.dragging = false;
        lastFocusCommitRef.current = performance.now();
        onFocusChange && onFocusChange(v.focus);
        // Fling: keep coasting in the release direction if the finger was still moving and not post-pinch
        if (wasDragging && e.type === 'pointerup' && e.timeStamp - lastT < 80 && Math.hypot(vel.x, vel.z) > 1.5) {
          v.vel = { x: vel.x, z: vel.z };
        }
      }
    };

    // Hardware touch synchronization to ensure zero stale touches on mobile
    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        pts.clear();
        pinch = null;
        isPinchingRef.current = false;
        last = null;
        viewRef.current.dragging = false;
      } else if (e.touches.length === 1) {
        pinch = null;
        isPinchingRef.current = false;
        const t = e.touches[0];
        last = { x: t.clientX, y: t.clientY };
        lastT = performance.now();
        lastPinchT = performance.now();
      }
    };

    const wheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      if (!v) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 25; // line mode
      else if (e.deltaMode === 2) dy *= 250; // page mode
      // Smooth continuous exponential zooming for both trackpads and mouse wheels
      const rate = e.ctrlKey ? 0.008 : 0.0018;
      const factor = Math.exp(-dy * rate);
      v.zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', wheel);
    };
  }, [camera, gl, dragLockRef, viewRef]);

  // Shadows and frame updates:
  useFrame((_, dt) => {
    const v = viewRef.current;
    if (isPinchingRef.current) {
      // Direct 1:1 camera zoom tracking while actively pinching with fingers
      v.cur = v.zoom;
    } else {
      // Responsive, buttery-smooth ease (settles cleanly in ~60ms without lag or sticking)
      const kz = 1 - Math.exp(-dt * 26);
      v.cur += (v.zoom - v.cur) * kz;
    }

    // Shadow optimization: alternate updates every 2 frames for a rock-solid 60-120fps
    if (gl.shadowMap?.enabled) {
      gl.shadowMap.autoUpdate = false;
      frameCount.current = (frameCount.current + 1) % 2;
      if (frameCount.current === 0) {
        gl.shadowMap.needsUpdate = true;
      }
    }

    if (v.vel) {
      // fling: coast with friction, stopping at the pan limits
      const lim = panLimits(v.flip, v.floor);
      v.tx = clamp(v.tx + v.vel.x * dt, lim.xmin, lim.xmax);
      v.tz = clamp(v.tz + v.vel.z * dt, lim.zmin, lim.zmax);
      const f = Math.exp(-dt * 3.4);
      v.vel.x *= f; v.vel.z *= f;
      if (Math.hypot(v.vel.x, v.vel.z) < 0.3) v.vel = null;
    }
    if (v.dragging) {
      // Smooth high-speed tracking to finger (silky 60-120fps response)
      const kp = 1 - Math.exp(-dt * 32);
      v.px += (v.tx - v.px) * kp;
      v.pz += (v.tz - v.pz) * kp;
    } else if (v.vel) {
      const kp = 1 - Math.exp(-dt * 24);
      v.px += (v.tx - v.px) * kp;
      v.pz += (v.tz - v.pz) * kp;
    } else {
      // a room glide eases smoothly between rooms
      const kp = 1 - Math.exp(-dt * (v.glide ? 6.0 : 18));
      v.px += (v.tx - v.px) * kp;
      v.pz += (v.tz - v.pz) * kp;
    }
    if (v.glide && Math.abs(v.tx - v.px) + Math.abs(v.tz - v.pz) < 0.05) v.glide = false;

    // Camera zoom scale:
    camera.zoom = Math.min(size.width / (FIT_W * 0.95), size.height / (FIT_H * 0.9)) * v.cur;
    v.py += (v.floor * FLOOR_Y - v.py) * (1 - Math.exp(-dt * 6));

    target.set(v.px, TARGET_Y + v.py, v.pz);
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
    for (const z of ZONES_BY_FLOOR[v.floor]) {
      const d = (z.center.x - lx) ** 2 + (z.center.z - lz) ** 2;
      if (d < bestD) { bestD = d; best = z.id; }
    }
    const inn = v.cur > 1.45;
    if (inn !== v.inn) { v.inn = inn; onInChange && onInChange(inn); }
    const out = v.cur < 0.72;
    if (out !== v.out) { v.out = out; onOutChange && onOutChange(out); }
    if (best !== v.focus) {
      v.focus = best;
      const now = performance.now();
      if (!v.dragging || now - lastFocusCommitRef.current > 350) {
        lastFocusCommitRef.current = now;
        onFocusChange && onFocusChange(best);
      }
    }
  });
  return null;
}
