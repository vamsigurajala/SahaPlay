import React, { useRef, useEffect, useMemo, useContext } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ViewContext } from './parts';
import { TV, TV_H, TV_UP, TV_UP_H, TV_NATIVE_W, TV_NATIVE_H } from './constants';
import { homographyMatrix3d } from '../../lib/homography';

// Projects the 3D TV screen's four corners to container pixels every frame and
// CSS-matrix3d's the REAL player element (Room.jsx's player-wrap) onto that
// quad — so the video plays on the 3D TV's slanted screen. The element is only
// restyled, never moved into a different React parent, so toggling Gamify Mode
// never remounts it (which would drop playback / a live Hyperbeam session).
export default function TvProjector({ tvElementRef, onTvReady }) {
  const { camera, size } = useThree();
  const view = useContext(ViewContext);
  const v = useMemo(() => new THREE.Vector3(), []);
  const lastRef = useRef('');
  const readyRef = useRef(false);

  useFrame(() => {
    const el = tvElementRef.current;
    if (!el) return;

    // Floating Picture-in-Picture mode: float video to top-right corner
    if (view.current?.pip) {
      const pipW = Math.min(320, Math.max(220, size.width * 0.32));
      const pipH = (pipW * 9) / 16;
      const targetX = size.width - pipW - 16;
      const targetY = 64;
      const scaleX = pipW / TV_NATIVE_W;
      const scaleY = pipH / TV_NATIVE_H;

      const m = `translate3d(${targetX}px, ${targetY}px, 0) scale(${scaleX}, ${scaleY})`;
      if (m !== lastRef.current) {
        lastRef.current = m;
        el.style.transformOrigin = '0 0';
        el.style.transform = m;
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.borderRadius = `${14 / scaleX}px`;
        el.style.boxShadow = '0 16px 40px rgba(0,0,0,0.7)';
      }
      if (!readyRef.current) {
        readyRef.current = true;
        onTvReady && onTvReady(true);
      }
      return;
    }

    // Upstairs the video moves to the upstairs hall's TV; zoomed out from the ground
    // floor the roof hides the living room, so the picture is hidden (it keeps playing).
    const up = view.current.floor === 1;
    const T = up ? TV_UP : TV;
    const hw = T.w / 2;
    const hh = (up ? TV_UP_H : TV_H) / 2;
    const covered = !up && view.current.cur < 0.8;
    const vis = covered ? '0' : '1';
    if (el.dataset.gpVis !== vis) { el.dataset.gpVis = vis; el.style.opacity = vis; el.style.pointerEvents = covered ? 'none' : ''; }
    // Mirrored view: the scene is reflected across x=z, so a local point
    // (x, y, z) lands at world (z, y, x), and the video's left edge belongs on
    // the mirror image of the screen's original right edge.
    const flip = view.current.flip;
    const corners = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([dx, dy]) => {
      const lx = flip ? T.cx - dx : T.cx + dx;
      if (flip) v.set(T.z, T.cy + dy, lx); else v.set(lx, T.cy + dy, T.z);
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
    if (el) { el.style.transform = ''; el.style.transformOrigin = ''; el.style.opacity = ''; el.style.pointerEvents = ''; delete el.dataset.gpVis; }
    onTvReady && onTvReady(false);
  }, [tvElementRef, onTvReady]);

  return null;
}
