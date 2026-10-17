import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WALL_H } from './GamifyScene';
import { FLOORPLAN_ZONES, ALL_ZONES, FLOOR_Y, CELL_W, CELL_D, COLS, ROWS } from '../../data/gamifyZones';

export const MIN_ZOOM = 0.28; // zoomed all the way out shows entire house and outdoors
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
  const lx = ((COLS - 1) * CELL_W) / 2 + 18;
  const zmin = -(((ROWS - 1) * CELL_D) / 2 + 18);
  const zmax = floor ? CELL_D / 2 - 4 : -zmin + 18;
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
      if (pts.size === 1) {
        try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
        last = { x: e.clientX, y: e.clientY };
        lastT = e.timeStamp;
        vel = { x: 0, z: 0 };
        viewRef.current.dragging = true;
      } else if (pts.size >= 2) {
        // Multi-touch pinch: release single finger capture if held so pinch doesn't stall
        try { el.releasePointerCapture?.(e.pointerId); } catch (_) {}
        const [a, b] = [...pts.values()];
        pinch = { d: dist(a, b), z: viewRef.current.zoom };
        last = null;
      }
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = viewRef.current;
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const curD = dist(a, b);
        if (curD > 10 && pinch.d > 10) {
          v.zoom = clamp(pinch.z * (curD / pinch.d), MIN_ZOOM, MAX_ZOOM);
        }
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
      const wasDragging = pts.size === 1 && last;
      try { el.releasePointerCapture?.(e.pointerId); } catch (_) {}
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      last = pts.size === 1 ? { ...[...pts.values()][0] } : null;
      if (pts.size === 0) {
        const v = viewRef.current;
        v.dragging = false;
        lastFocusCommitRef.current = performance.now();
        onFocusChange && onFocusChange(v.focus);
        // Fling: keep coasting in the release direction if the finger was still moving.
        if (wasDragging && e.type === 'pointerup' && e.timeStamp - lastT < 80 && Math.hypot(vel.x, vel.z) > 1.5) v.vel = { x: vel.x, z: vel.z };
      }
    };

    const wheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      if (!v) return;
      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      v.zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [camera, gl, dragLockRef, viewRef]);

  // Shadows are the single biggest per-frame cost when the whole house is on
  // screen, and the scene barely moves: refresh them every few frames (less often
  // while panning or zooming) instead of every frame, and render at 1x pixel
  // density during a pan/zoom, restoring full sharpness once the view settles.
  useFrame((_, dt) => {
    const v = viewRef.current;
    const kz = 1 - Math.exp(-dt * 12);
    v.cur += (v.zoom - v.cur) * kz;
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
      // Smooth high-speed tracking to finger (silky 60-120fps response, zero buffer stutter)
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
    const out = v.cur < 0.8;
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
