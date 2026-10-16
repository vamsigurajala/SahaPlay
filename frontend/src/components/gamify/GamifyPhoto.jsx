import { useContext, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ViewContext } from './parts';
import { FLOOR_Y } from '../../data/gamifyZones';

// Photo mode. Lives inside the canvas so it can draw the current view, then adds the room
// name, the people standing in it (their faces are page elements, so they are painted on
// here) and a small caption. view.current.snap(info) resolves to a PNG blob.
export default function PhotoRig() {
  const view = useContext(ViewContext);
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const v = view.current;
    v.snap = (info) => new Promise((resolve) => {
      gl.render(scene, camera); // draw right now so the copy below is never blank
      const src = gl.domElement;
      const W = src.width, H = src.height;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      if (!g) { resolve(null); return; }
      g.fillStyle = '#0b0a14';
      g.fillRect(0, 0, W, H);
      g.drawImage(src, 0, 0);
      const k = Math.max(1, W / 900);
      const spots = v.spots || {};
      const p = new THREE.Vector3();
      Object.keys(spots).forEach((id) => {
        const s = spots[id];
        if (s.floor !== (v.floor || 0)) return;
        const wx = v.flip ? s.z : s.x; // a flipped house swaps the two floor axes
        const wz = v.flip ? s.x : s.z;
        p.set(wx, s.floor * FLOOR_Y + 0.95, wz).project(camera);
        const px = (p.x * 0.5 + 0.5) * W;
        const py = (-p.y * 0.5 + 0.5) * H;
        if (px < -40 || px > W + 40 || py < -40 || py > H + 40) return;
        const name = info.names?.[id] || '';
        const r = 22 * k;
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
        g.fillStyle = id === info.me ? '#8b5cff' : '#4f46e5'; g.fill();
        g.lineWidth = 3 * k; g.strokeStyle = '#fff'; g.stroke();
        g.fillStyle = '#fff'; g.font = `800 ${18 * k}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText((name[0] || '?').toUpperCase(), px, py + 1);
        g.font = `700 ${12 * k}px sans-serif`;
        const w = g.measureText(name).width + 14 * k;
        g.fillStyle = 'rgba(12,10,24,0.78)';
        g.fillRect(px - w / 2, py + r + 4 * k, w, 18 * k);
        g.fillStyle = '#fff'; g.fillText(name, px, py + r + 13 * k);
      });
      const cap = `${info.room || ''}  -  ${info.date || ''}`;
      g.font = `800 ${16 * k}px sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const cw = g.measureText(cap).width + 24 * k;
      g.fillStyle = 'rgba(12,10,24,0.72)'; g.fillRect(12 * k, H - 44 * k, cw, 32 * k);
      g.fillStyle = '#fff'; g.fillText(cap, 24 * k, H - 22 * k);
      g.font = `700 ${12 * k}px sans-serif`; g.textAlign = 'right';
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText('SahaPlay', W - 16 * k, H - 16 * k);
      c.toBlob((b) => resolve(b), 'image/png');
    });
    return () => { v.snap = null; };
  }, [view, gl, scene, camera]);
  return null;
}
