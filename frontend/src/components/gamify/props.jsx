import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Neon, Plant, useOpenProp, ViewContext, PropDot, ScaledHtml } from './parts';
import { NEON_CYAN, NEON_AMBER } from './constants';
import { autoWeather } from './environment';

const PI = Math.PI;
const ROPE = ['#d0592a', '#2f8f9d', '#f0b020', '#d0592a', '#2f8f9d', '#f0b020', '#d0592a'];

// Faces +z when mounted on a back wall.
export function Clock({ p, rot = 0, r = 0.55 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <mesh><cylinderGeometry args={[r, r, 0.1, 24]} /><meshStandardMaterial color="#241c4a" /></mesh>
      <mesh position={[0, 0, 0.06]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[r - 0.06, r - 0.06, 0.02, 24]} /><meshBasicMaterial color="#f4f1e8" /></mesh>
      <mesh position={[0, 0.12, 0.09]}><boxGeometry args={[0.04, 0.3, 0.02]} /><meshBasicMaterial color="#111" /></mesh>
      <mesh position={[0.1, 0, 0.09]}><boxGeometry args={[0.24, 0.04, 0.02]} /><meshBasicMaterial color="#111" /></mesh>
    </group>
  );
}

export function Telescope({ p, rot = 0 }) {
  const open = useOpenProp('telescope');
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, 2.5, 0]} kind="telescope" />
      {[[0.4, 0.3], [-0.4, 0.3], [0, -0.45]].map(([x, z], i) => (
        <mesh key={i} position={[x * 0.5, 0.7, z * 0.5]} rotation={[z * 0.5, 0, -x * 0.5]}><cylinderGeometry args={[0.03, 0.03, 1.5, 6]} /><meshStandardMaterial color="#2a2140" /></mesh>
      ))}
      <mesh position={[0, 1.55, 0.25]} rotation={[-0.9, 0, 0]} castShadow><cylinderGeometry args={[0.14, 0.18, 1.5, 14]} /><meshStandardMaterial color="#e8e1ff" metalness={0.5} roughness={0.35} /></mesh>
      <mesh position={[0, 1.95, 0.75]} rotation={[-0.9, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.08, 14]} /><meshBasicMaterial color={NEON_CYAN} toneMapped={false} /></mesh>
    </group>
  );
}

// Indian rope cot: wooden frame, turned legs and a woven rope bed.
export function Charpai({ p, rot = 0, cushion = '#ff6fb5' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {[[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]].map(([x, z], i) => <Box key={i} p={[x, 0.3, z]} s={[0.14, 0.6, 0.14]} c="#8a5a34" />)}
      <Box p={[0, 0.58, -0.6]} s={[2.4, 0.1, 0.12]} c="#8a5a34" />
      <Box p={[0, 0.58, 0.6]} s={[2.4, 0.1, 0.12]} c="#8a5a34" />
      <Box p={[-1.1, 0.58, 0]} s={[0.12, 0.1, 1.3]} c="#8a5a34" />
      <Box p={[1.1, 0.58, 0]} s={[0.12, 0.1, 1.3]} c="#8a5a34" />
      {ROPE.map((c, i) => <Box key={i} p={[-0.9 + i * 0.3, 0.6, 0]} s={[0.1, 0.04, 1.14]} c={c} shadow={false} />)}
      {[-0.4, 0, 0.4].map((z, i) => <Box key={i} p={[0, 0.63, z]} s={[2.1, 0.03, 0.1]} c="#f4ecd8" shadow={false} />)}
      <Box p={[-0.8, 0.75, 0]} s={[0.5, 0.2, 0.7]} c={cushion} r={0.08} />
    </group>
  );
}

// Parked hatchback, nose toward +x.
export function Car({ p, rot = 0, color = '#e0529f' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.62, 0]} s={[4.2, 0.8, 1.8]} c={color} r={0.25} rough={0.35} metal={0.3} />
      <Box p={[-0.2, 1.3, 0]} s={[2.4, 0.7, 1.6]} c={color} r={0.25} rough={0.35} metal={0.3} />
      <Box p={[-0.2, 1.32, 0]} s={[2.42, 0.5, 1.62]} c="#10202e" r={0.2} rough={0.1} metal={0.6} shadow={false} />
      {[[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]} rotation={[PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.38, 0.38, 0.28, 16]} /><meshStandardMaterial color="#14121c" roughness={0.9} /></mesh>
      ))}
      <Box p={[2.1, 0.7, 0.55]} s={[0.06, 0.18, 0.4]} c="#fff6c8" emissive="#fff6c8" shadow={false} />
      <Box p={[2.1, 0.7, -0.55]} s={[0.06, 0.18, 0.4]} c="#fff6c8" emissive="#fff6c8" shadow={false} />
      <Box p={[-2.1, 0.7, 0.55]} s={[0.06, 0.16, 0.4]} c="#ff3030" emissive="#ff3030" shadow={false} />
      <Box p={[-2.1, 0.7, -0.55]} s={[0.06, 0.16, 0.4]} c="#ff3030" emissive="#ff3030" shadow={false} />
    </group>
  );
}

export function Scooter({ p, rot = 0, color = '#3ee8ff' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.55, 0]} s={[1.5, 0.4, 0.5]} c={color} r={0.15} metal={0.3} rough={0.4} />
      <Box p={[0.55, 1.0, 0]} s={[0.12, 0.7, 0.12]} c="#2a2140" />
      <Box p={[0.55, 1.35, 0]} s={[0.1, 0.1, 0.8]} c="#2a2140" />
      <Box p={[-0.2, 0.85, 0]} s={[0.8, 0.14, 0.45]} c="#14121c" r={0.06} />
      {[-0.65, 0.65].map(x => <mesh key={x} position={[x, 0.28, 0]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.28, 0.28, 0.14, 14]} /><meshStandardMaterial color="#14121c" /></mesh>)}
    </group>
  );
}

export function Foosball({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.95, 0]} s={[3.2, 0.3, 1.8]} c="#2a1f4d" r={0.06} />
      <Box p={[0, 1.12, 0]} s={[2.9, 0.04, 1.5]} c="#1f8a5a" rough={1} shadow={false} />
      {[-1, -0.35, 0.35, 1].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 1.35, 0]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 2.3, 6]} /><meshStandardMaterial color="#c8ccd6" metalness={0.8} /></mesh>
          {[-0.4, 0, 0.4].map((z, k) => <Box key={k} p={[x, 1.28, z]} s={[0.12, 0.22, 0.14]} c={i % 2 ? '#ff4f6f' : '#4fa8ff'} shadow={false} />)}
        </group>
      ))}
      {[[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]].map(([x, z], i) => <Box key={i} p={[x, 0.4, z]} s={[0.2, 0.8, 0.2]} c="#14121c" />)}
    </group>
  );
}

export function ClawMachine({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.55, 0]} s={[1.5, 1.1, 1.3]} c="#ff4fd8" r={0.06} />
      <Box p={[0, 1.95, 0]} s={[1.4, 1.6, 1.2]} c="#bfe9ff" opacity={0.35} shadow={false} />
      <Box p={[0, 2.85, 0]} s={[1.5, 0.3, 1.3]} c="#ff4fd8" r={0.06} />
      <Neon p={[0, 2.85, 0.66]} s={[1.2, 0.1, 0.03]} color={NEON_AMBER} />
      {[[-0.3, 1.2, '#ffd24f'], [0.2, 1.25, '#4fa8ff'], [-0.1, 1.2, '#8dff9c'], [0.4, 1.2, '#ff7bc0']].map(([x, y, c], i) => (
        <mesh key={i} position={[x, y, 0.1 * (i % 2 ? 1 : -1)]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color={c} /></mesh>
      ))}
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.02, 0.02, 0.5, 6]} /><meshStandardMaterial color="#c8ccd6" /></mesh>
    </group>
  );
}

// Swing seat hung from an A-frame.
export function Jhula({ p, rot = 0, w = 2.4 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {[-w / 2 - 0.2, w / 2 + 0.2].map(x => (
        <group key={x}>
          <mesh position={[x, 1.7, 0.5]} rotation={[-0.2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 3.5, 8]} /><meshStandardMaterial color="#7a4a1a" /></mesh>
          <mesh position={[x, 1.7, -0.5]} rotation={[0.2, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 3.5, 8]} /><meshStandardMaterial color="#7a4a1a" /></mesh>
        </group>
      ))}
      <mesh position={[0, 3.45, 0]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.08, 0.08, w + 0.8, 8]} /><meshStandardMaterial color="#7a4a1a" /></mesh>
      {[-w / 2 + 0.1, w / 2 - 0.1].map(x => <mesh key={x} position={[x, 2.2, 0]}><cylinderGeometry args={[0.02, 0.02, 2.5, 6]} /><meshStandardMaterial color="#c8ccd6" metalness={0.8} /></mesh>)}
      <Box p={[0, 0.95, 0]} s={[w, 0.12, 1.0]} c="#b0773f" r={0.04} />
      <Box p={[0, 1.4, -0.45]} s={[w, 0.8, 0.1]} c="#b0773f" r={0.04} />
      <Box p={[0, 1.08, 0]} s={[w - 0.2, 0.1, 0.8]} c="#d0592a" r={0.05} shadow={false} />
    </group>
  );
}

export function LampPost({ p, color = '#ffd36b' }) {
  return (
    <group position={p}>
      <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.07, 0.1, 3.2, 8]} /><meshStandardMaterial color="#2a2140" /></mesh>
      <mesh position={[0, 3.3, 0]}><sphereGeometry args={[0.28, 12, 10]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  );
}

export function Diya({ p }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.14, 0.08, 0.1, 10]} /><meshStandardMaterial color="#b85a2c" /></mesh>
      <mesh position={[0, 0.2, 0]}><coneGeometry args={[0.05, 0.14, 6]} /><meshBasicMaterial color={NEON_AMBER} toneMapped={false} /></mesh>
    </group>
  );
}

// Flat colourful floor pattern.
export function Rangoli({ p, r = 1.4 }) {
  const cols = ['#ff4fd8', '#ffb347', '#3ee8ff', '#8dff9c', '#a56bff'];
  return (
    <group position={p}>
      {cols.map((c, i) => (
        <mesh key={i} position={[0, 0.02 + i * 0.002, 0]} rotation={[-PI / 2, 0, 0]}>
          <ringGeometry args={[r * (1 - i * 0.18) - 0.12, r * (1 - i * 0.18), 40]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[Math.cos((i * PI) / 6) * r * 0.55, 0.03, Math.sin((i * PI) / 6) * r * 0.55]} rotation={[-PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 8]} /><meshBasicMaterial color={cols[i % 5]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function Pillar({ p, h = 3.6 }) {
  return (
    <group position={p}>
      <Box p={[0, 0.2, 0]} s={[0.9, 0.4, 0.9]} c="#a8896a" r={0.04} />
      <Box p={[0, h / 2, 0]} s={[0.55, h, 0.55]} c="#c9a77a" r={0.06} />
      <Box p={[0, h - 0.2, 0]} s={[0.9, 0.4, 0.9]} c="#a8896a" r={0.04} />
    </group>
  );
}

export function Planter({ p, scale = 1, color = '#2f9e5a' }) {
  return <Plant p={p} scale={scale} color={color} pot="#c46a3a" />;
}

// ── cosy / romantic bedroom props ─────────────────────────────────────────────
let heartGeo;
function getHeartGeo() {
  if (heartGeo) return heartGeo;
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.1, -0.4, -0.55, -0.1, -0.55, 0.2);
  s.bezierCurveTo(-0.55, 0.5, -0.2, 0.6, 0, 0.35);
  s.bezierCurveTo(0.2, 0.6, 0.55, 0.5, 0.55, 0.2);
  s.bezierCurveTo(0.55, -0.1, 0.1, -0.4, 0, -0.5);
  heartGeo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 14 });
  heartGeo.translate(0, 0, -0.06);
  return heartGeo;
}

// Faces +z by default; flat lays it on the floor.
export function Heart({ p, rot = 0, scale = 1, color = '#ff4f8a', glow = false, flat = false, thin = false }) {
  return (
    <group position={p} rotation={[flat ? -PI / 2 : 0, rot, 0]} scale={[scale, scale, thin ? 0.25 : 1]}>
      <mesh geometry={getHeartGeo()} castShadow={!glow}>
        {glow ? <meshBasicMaterial color={color} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={0.55} />}
      </mesh>
      {glow && (
        <mesh geometry={getHeartGeo()} scale={1.18}>
          <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export function Candle({ p, h = 0.24 }) {
  return (
    <group position={p}>
      <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.06, 0.06, h, 10]} /><meshStandardMaterial color="#f6ecd6" roughness={0.7} /></mesh>
      <mesh position={[0, h + 0.07, 0]}><coneGeometry args={[0.03, 0.12, 8]} /><meshBasicMaterial color="#ffd36b" toneMapped={false} /></mesh>
      <mesh position={[0, h + 0.07, 0]}><sphereGeometry args={[0.13, 10, 8]} /><meshBasicMaterial color="#ffb347" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
    </group>
  );
}

export function Teddy({ p, rot = 0, scale = 1, color = '#b0773f' }) {
  const m = <meshStandardMaterial color={color} roughness={0.95} />;
  return (
    <group position={p} rotation={[0, rot, 0]} scale={scale}>
      <mesh position={[0, 0.35, 0]} castShadow><sphereGeometry args={[0.38, 14, 12]} />{m}</mesh>
      <mesh position={[0, 0.88, 0]} castShadow><sphereGeometry args={[0.28, 14, 12]} />{m}</mesh>
      {[-0.2, 0.2].map(x => <mesh key={x} position={[x, 1.1, 0]}><sphereGeometry args={[0.1, 10, 8]} />{m}</mesh>)}
      <mesh position={[0, 0.82, 0.24]}><sphereGeometry args={[0.11, 10, 8]} /><meshStandardMaterial color="#e8c9a0" /></mesh>
      <mesh position={[0, 0.85, 0.34]}><sphereGeometry args={[0.04, 8, 6]} /><meshStandardMaterial color="#2a1a10" /></mesh>
      {[-0.1, 0.1].map(x => <mesh key={x} position={[x, 0.94, 0.25]}><sphereGeometry args={[0.03, 8, 6]} /><meshStandardMaterial color="#2a1a10" /></mesh>)}
      {[-0.42, 0.42].map(x => <mesh key={x} position={[x, 0.42, 0.1]}><sphereGeometry args={[0.14, 10, 8]} />{m}</mesh>)}
      {[-0.2, 0.2].map(x => <mesh key={x} position={[x, 0.05, 0.25]}><sphereGeometry args={[0.15, 10, 8]} />{m}</mesh>)}
      <mesh position={[0, 0.62, 0.2]}><boxGeometry args={[0.5, 0.08, 0.1]} /><meshStandardMaterial color="#d0392b" /></mesh>
    </group>
  );
}

// A swag of warm fairy lights along a wall (axis x), sagging between its ends.
export function FairyLights({ from, to, y = 4.3, z, count = 16, sag = 0.45 }) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const t = i / (count - 1);
        const x = from + (to - from) * t;
        const yy = y - Math.sin(t * PI * 3) * sag * 0.5 - Math.sin(t * PI) * 0.15;
        return (
          <group key={i} position={[x, yy, z]}>
            <mesh><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial color={i % 3 === 0 ? '#ffb4d6' : '#ffe2a0'} toneMapped={false} /></mesh>
            <mesh><sphereGeometry args={[0.2, 8, 6]} /><meshBasicMaterial color={i % 3 === 0 ? '#ff8fc0' : '#ffd36b'} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Curtain({ p, w = 0.6, h = 2.4, color = '#ff9ad8' }) {
  return (
    <group position={p}>
      {[-1, 0, 1].map(i => <Box key={i} p={[i * (w / 3), h / 2, (i % 2) * 0.04]} s={[w / 3 - 0.01, h, 0.06]} c={color} r={0.02} shadow={false} />)}
      <Box p={[0, h + 0.05, 0]} s={[w + 0.1, 0.06, 0.1]} c="#d9c48a" shadow={false} />
    </group>
  );
}

export function RoseVase({ p }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.1, 0.07, 0.36, 12]} /><meshStandardMaterial color="#d8f0ff" transparent opacity={0.7} /></mesh>
      {[[0, 0.55, 0], [-0.08, 0.45, 0.04], [0.08, 0.48, -0.03]].map(([x, y, z], i) => (
        <group key={i}>
          <mesh position={[x * 0.5, y / 2, z * 0.5]}><cylinderGeometry args={[0.012, 0.012, y, 5]} /><meshStandardMaterial color="#2f8f4a" /></mesh>
          <mesh position={[x, y + 0.03, z]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#d0183a" roughness={0.6} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function WineGlass({ p }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.06, 0.06, 0.02, 10]} /><meshStandardMaterial color="#e8f0ff" transparent opacity={0.8} /></mesh>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.012, 0.012, 0.18, 6]} /><meshStandardMaterial color="#e8f0ff" transparent opacity={0.8} /></mesh>
      <mesh position={[0, 0.27, 0]}><cylinderGeometry args={[0.09, 0.04, 0.16, 12]} /><meshStandardMaterial color="#e8f0ff" transparent opacity={0.55} /></mesh>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.075, 0.035, 0.08, 12]} /><meshStandardMaterial color="#9a1030" /></mesh>
    </group>
  );
}

// ── garden ───────────────────────────────────────────────────────────────────
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// Fills one InstancedMesh from a list of {p, s, c, r}.
function Instances({ items, geo, castShadow = false, rough = 0.8 }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.p[0], it.p[1], it.p[2]);
      o.rotation.set(0, it.r || 0, 0);
      if (Array.isArray(it.s)) o.scale.set(it.s[0], it.s[1], it.s[2]); else o.scale.setScalar(it.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[null, null, items.length]} castShadow={castShadow}>
      {geo}
      <meshStandardMaterial roughness={rough} />
    </instancedMesh>
  );
}

// A raised bed packed with blooms on stems. Tap it to read the flower names.
export function FlowerPatch({ p, w = 3, d = 1.4, n = 40, colors, tall = 0.55, head = 0.17, seed = 1, rot = 0 }) {
  const open = useOpenProp('garden', 'flowers');
  const { stems, heads, cores, leaves } = useMemo(() => {
    const r = rng(seed * 977);
    const stems = []; const heads = []; const cores = []; const leaves = [];
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * (w - 0.3);
      const z = (r() - 0.5) * (d - 0.3);
      const h = tall * (0.7 + r() * 0.6);
      const c = colors[Math.floor(r() * colors.length)];
      stems.push({ p: [x, 0.35 + h / 2, z], s: [1, h, 1], c: '#2f8f4a' });
      const hs = 0.8 + r() * 0.5;
      heads.push({ p: [x, 0.4 + h, z], s: [hs, hs * 0.55, hs], c });
      cores.push({ p: [x, 0.4 + h + head * 0.28, z], s: 1, c: '#f0b020' });
      leaves.push({ p: [x + 0.08, 0.45 + h * 0.3, z], s: [1.3, 0.5, 0.8], c: '#3aa862', r: r() * 3 });
    }
    return { stems, heads, cores, leaves };
  }, [n, w, d, colors, tall, head, seed]);
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, tall + 0.9, 0]} kind="garden" arg="flowers" />
      <Box p={[0, 0.17, 0]} s={[w, 0.34, d]} c="#5a3d2b" r={0.05} />
      <Box p={[0, 0.34, 0]} s={[w - 0.2, 0.05, d - 0.2]} c="#2a1c10" shadow={false} />
      <Instances items={stems} geo={<cylinderGeometry args={[0.018, 0.018, 1, 5]} />} />
      <Instances items={leaves} geo={<sphereGeometry args={[0.1, 6, 4]} />} />
      <Instances items={heads} geo={<sphereGeometry args={[head, 9, 7]} />} castShadow />
      <Instances items={cores} geo={<sphereGeometry args={[head * 0.4, 6, 5]} />} />
    </group>
  );
}

// Vegetable rows in a raised bed: tomato bushes, brinjal, cabbages and carrot tops.
export function VegPatch({ p, w = 3.4, d = 3, rot = 0 }) {
  const open = useOpenProp('garden', 'veg');
  const { bushes, fruit, cabbages, tops, stakes } = useMemo(() => {
    const bushes = []; const fruit = []; const cabbages = []; const tops = []; const stakes = [];
    const rows = 4;
    const r = rng(77);
    for (let ri = 0; ri < rows; ri++) {
      const z = -d / 2 + 0.45 + ri * ((d - 0.9) / (rows - 1));
      const per = Math.floor((w - 0.5) / 0.55);
      for (let i = 0; i < per; i++) {
        const x = -w / 2 + 0.4 + i * ((w - 0.8) / (per - 1));
        if (ri === 0 || ri === 1) {
          bushes.push({ p: [x, 0.65, z], s: [0.9, 1.1, 0.9], c: ri ? '#3a9a4a' : '#2f8f4a' });
          stakes.push({ p: [x, 0.7, z + 0.2], s: [1, 1, 1], c: '#a8884a' });
          for (let k = 0; k < 3; k++) fruit.push({ p: [x + (r() - 0.5) * 0.45, 0.5 + r() * 0.5, z + (r() - 0.5) * 0.45], s: 1, c: ri ? '#6a2a9a' : '#e0392b' });
        } else if (ri === 2) {
          cabbages.push({ p: [x, 0.5, z], s: [1, 0.8, 1], c: i % 2 ? '#8ad06a' : '#5ab04a' });
        } else {
          for (let k = 0; k < 3; k++) tops.push({ p: [x + (k - 1) * 0.12, 0.5, z + (r() - 0.5) * 0.1], s: [0.5, 1.3, 0.5], c: '#4aa83a' });
        }
      }
    }
    return { bushes, fruit, cabbages, tops, stakes };
  }, [w, d]);
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, 1.5, 0]} kind="garden" arg="veg" />
      <Box p={[0, 0.17, 0]} s={[w, 0.34, d]} c="#6a4a2f" r={0.05} />
      <Box p={[0, 0.34, 0]} s={[w - 0.2, 0.05, d - 0.2]} c="#3a2412" shadow={false} />
      <Instances items={stakes} geo={<cylinderGeometry args={[0.02, 0.02, 1, 5]} />} />
      <Instances items={bushes} geo={<icosahedronGeometry args={[0.3, 0]} />} castShadow />
      <Instances items={fruit} geo={<sphereGeometry args={[0.07, 7, 5]} />} />
      <Instances items={cabbages} geo={<sphereGeometry args={[0.24, 9, 7]} />} castShadow />
      <Instances items={tops} geo={<coneGeometry args={[0.1, 0.3, 5]} />} />
    </group>
  );
}

export function Hedge({ p, w = 3, h = 0.9, d = 0.7, rot = 0, color = '#2f8f4a', flowers }) {
  const dots = useMemo(() => {
    if (!flowers) return [];
    const r = rng(Math.round(w * 31));
    return Array.from({ length: Math.round(w * 6) }).map(() => ({ p: [(r() - 0.5) * w, 0.3 + r() * h, d / 2 + 0.02 + r() * 0.05], s: 1, c: flowers }));
  }, [w, h, d, flowers]);
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={color} r={0.22} />
      {dots.length > 0 && <Instances items={dots} geo={<sphereGeometry args={[0.07, 6, 5]} />} />}
    </group>
  );
}

export function Topiary({ p, scale = 1, color = '#2f9a4a' }) {
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.32, 0.26, 0.6, 12]} /><meshStandardMaterial color="#c46a3a" roughness={0.7} /></mesh>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.05, 0.05, 0.6, 6]} /><meshStandardMaterial color="#6b4a2f" /></mesh>
      <mesh position={[0, 1.4, 0]} castShadow><icosahedronGeometry args={[0.5, 1]} /><meshStandardMaterial color={color} roughness={0.85} flatShading /></mesh>
      <mesh position={[0, 1.95, 0]} castShadow><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color={color} roughness={0.85} flatShading /></mesh>
    </group>
  );
}

// Round pond with lily pads and lotus flowers; tap for the flower names.
export function LotusPond({ p, r = 2.0 }) {
  const open = useOpenProp('garden', 'flowers');
  const pads = [[0.6, 0.5, 0.42], [-0.8, 0.3, 0.38], [0.1, -0.9, 0.4], [-0.5, -0.6, 0.34], [1.0, -0.4, 0.32], [-1.1, 0.9, 0.36]];
  const lotus = [[0.6, 0.5, '#ff9ac0'], [-0.8, 0.3, '#fff0f6'], [0.1, -0.9, '#ff7aa8']];
  return (
    <group position={p} {...open}>
      <PropDot position={[0, 1.2, 0]} kind="garden" arg="flowers" />
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow><cylinderGeometry args={[r, r + 0.12, 0.32, 28]} /><meshStandardMaterial color="#a8896a" roughness={0.9} /></mesh>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[r - 0.25, r - 0.25, 0.04, 28]} /><meshStandardMaterial color="#1f7ab0" emissive="#1f7ab0" emissiveIntensity={0.45} roughness={0.2} /></mesh>
      {pads.map(([x, z, s], i) => <mesh key={i} position={[x * r / 2, 0.34, z * r / 2]} rotation={[0, i, 0]}><cylinderGeometry args={[s, s, 0.02, 12, 1, false, 0.4, 5.5]} /><meshStandardMaterial color="#2f9a4a" roughness={0.7} /></mesh>)}
      {lotus.map(([x, z, c], i) => (
        <group key={i} position={[x * r / 2, 0.36, z * r / 2]}>
          {[0, 1, 2, 3, 4, 5].map(k => <mesh key={k} position={[Math.cos(k * 1.047) * 0.1, 0.1, Math.sin(k * 1.047) * 0.1]} rotation={[Math.sin(k * 1.047) * 0.5, 0, -Math.cos(k * 1.047) * 0.5]}><coneGeometry args={[0.07, 0.3, 5]} /><meshStandardMaterial color={c} roughness={0.6} /></mesh>)}
          <mesh position={[0, 0.12, 0]}><sphereGeometry args={[0.05, 6, 5]} /><meshStandardMaterial color="#f0c030" /></mesh>
        </group>
      ))}
    </group>
  );
}

export function Banana({ p, scale = 1 }) {
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 1.0, 0]} castShadow><cylinderGeometry args={[0.14, 0.2, 2.0, 8]} /><meshStandardMaterial color="#7aa84a" roughness={0.9} /></mesh>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <group key={i} position={[0, 2.0, 0]} rotation={[0, i * 1.05, 0]}>
          <mesh position={[0.75, 0, 0]} rotation={[0, 0, -0.5 - (i % 2) * 0.25]} castShadow><boxGeometry args={[1.7, 0.03, 0.5]} /><meshStandardMaterial color={i % 2 ? '#4aa83a' : '#3a9a3a'} roughness={0.8} /></mesh>
        </group>
      ))}
      <mesh position={[0.18, 1.6, 0.1]}><sphereGeometry args={[0.16, 8, 6]} /><meshStandardMaterial color="#f0d030" /></mesh>
    </group>
  );
}

// Arch of trellis covered in bright bougainvillea. Faces +z.
export function FlowerArch({ p, rot = 0, color = '#e0187a' }) {
  const open = useOpenProp('garden', 'flowers');
  const dots = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 60 }).map(() => {
      const a = r() * PI;
      return { p: [Math.cos(a) * 1.5 + (r() - 0.5) * 0.3, 2.4 + Math.sin(a) * 0.9 - r() * 0.2 - (r() > 0.7 ? 1.2 * r() : 0), (r() - 0.5) * 0.3], s: 0.6 + r() * 0.9, c: r() > 0.3 ? color : '#ff7ac0' };
    });
  }, [color]);
  const leaves = useMemo(() => dots.map(d => ({ p: [d.p[0] * 0.98, d.p[1] - 0.05, d.p[2] - 0.1], c: '#2f8f4a', s: d.s * 0.9 })), [dots]);
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, 3.6, 0]} kind="garden" arg="flowers" />
      {[-1.5, 1.5].map(x => <Box key={x} p={[x, 1.25, 0]} s={[0.14, 2.5, 0.14]} c="#f6efe0" />)}
      <mesh position={[0, 2.5, 0]}><torusGeometry args={[1.5, 0.07, 6, 18, PI]} /><meshStandardMaterial color="#f6efe0" /></mesh>
      <Instances items={leaves} geo={<sphereGeometry args={[0.15, 6, 4]} />} />
      <Instances items={dots} geo={<sphereGeometry args={[0.13, 7, 5]} />} />
    </group>
  );
}

// Dressing table: drawer unit, mirror, and a clutter of makeup. Tap for the full shelf.
export function Vanity({ p, rot = 0 }) {
  const open = useOpenProp('cosmetics');
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, 2.4, 0.5]} kind="cosmetics" />
      <Box p={[0, 0.6, 0]} s={[1.9, 1.2, 1.1]} c="#5a3a4a" r={0.05} />
      <Box p={[0, 1.22, 0]} s={[2.0, 0.08, 1.2]} c="#7a5a6a" r={0.03} />
      {[-0.45, 0.45].map(x => <Box key={x} p={[x, 0.8, 0.57]} s={[0.8, 0.4, 0.04]} c="#6a4a5a" shadow={false} />)}
      {[-0.45, 0.45].map(x => <Box key={x} p={[x, 0.8, 0.61]} s={[0.3, 0.05, 0.04]} c="#d9c48a" shadow={false} />)}
      {[-0.45, 0.45].map(x => <Box key={x} p={[x, 0.32, 0.57]} s={[0.8, 0.4, 0.04]} c="#6a4a5a" shadow={false} />)}
      {[-0.45, 0.45].map(x => <Box key={x} p={[x, 0.32, 0.61]} s={[0.3, 0.05, 0.04]} c="#d9c48a" shadow={false} />)}
      {/* mirror on the wall behind */}
      <mesh position={[0, 2.5, -0.46]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.9, 0.9, 0.08, 24]} /><meshStandardMaterial color="#d9c48a" metalness={0.5} roughness={0.35} /></mesh>
      <mesh position={[0, 2.5, -0.41]}><circleGeometry args={[0.78, 24]} /><meshBasicMaterial color="#d6ecff" toneMapped={false} /></mesh>
      <mesh position={[0, 2.5, -0.4]} rotation={[0, 0, 0.5]}><planeGeometry args={[0.15, 1.4]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.35} /></mesh>
      {/* makeup on top */}
      {[[-0.7, '#d0183a'], [-0.55, '#e0529f'], [-0.4, '#f0b73a']].map(([x, c], i) => <mesh key={i} position={[x, 1.38, 0.1]}><cylinderGeometry args={[0.04, 0.04, 0.24, 8]} /><meshStandardMaterial color={c} /></mesh>)}
      <mesh position={[0.2, 1.4, 0]}><cylinderGeometry args={[0.1, 0.12, 0.28, 10]} /><meshStandardMaterial color="#c8a0ff" transparent opacity={0.8} /></mesh>
      <mesh position={[0.5, 1.33, 0.2]}><cylinderGeometry args={[0.2, 0.2, 0.1, 14]} /><meshStandardMaterial color="#e8c9a0" /></mesh>
      <mesh position={[0.78, 1.36, -0.1]} rotation={[0, 0.3, 0]}><boxGeometry args={[0.06, 0.04, 0.5]} /><meshStandardMaterial color="#c9a77a" /></mesh>
      <mesh position={[-0.1, 1.31, 0.3]}><cylinderGeometry args={[0.07, 0.07, 0.06, 10]} /><meshStandardMaterial color="#e0529f" /></mesh>
      {/* stool */}
      <mesh position={[0, 0.55, 1.15]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.12, 14]} /><meshStandardMaterial color="#e0529f" roughness={0.8} /></mesh>
      <mesh position={[0, 0.27, 1.15]}><cylinderGeometry args={[0.07, 0.07, 0.5, 8]} /><meshStandardMaterial color="#d9c48a" /></mesh>
    </group>
  );
}

// Staircase. 'up' climbs (along +x before rotation) to a landing; 'down' is a
// railed stairwell opening. Tap it to change floor.
export function Stairs({ p, rot = 0, dir = 'up', steps = 9, c = '#a98260', dark = '#6e4f33' }) {
  const view = useContext(ViewContext);
  const go = {
    onClick: (e) => { if (e.delta > 6) return; e.stopPropagation(); view.current.changeFloor?.(); },
    onPointerOver: () => { try { document.body.style.cursor = 'pointer'; } catch { /* non-browser */ } },
    onPointerOut: () => { try { document.body.style.cursor = ''; } catch { /* non-browser */ } },
  };
  const run = 0.62;
  const rise = 0.4;
  if (dir === 'down') {
    return (
      <group position={p} rotation={[0, rot, 0]} {...go}>
        <PropDot position={[2.2, 1.4, 0]} onClick={() => view.current.changeFloor?.()} />
        <Box p={[2.2, 0.03, 0]} s={[4.6, 0.06, 2.2]} c="#1c1612" shadow={false} />
        {[0, 1, 2, 3, 4, 5].map(i => <Box key={i} p={[0.4 + i * 0.7, 0.07 + 0.001 * i, 0]} s={[0.55, 0.02, 1.8]} c={i % 2 ? '#2a211a' : '#33281f'} shadow={false} />)}
        <Box p={[2.2, 0.5, 1.15]} s={[4.7, 0.1, 0.1]} c={dark} shadow={false} />
        <Box p={[2.2, 0.5, -1.15]} s={[4.7, 0.1, 0.1]} c={dark} shadow={false} />
        {[0, 1.2, 2.4, 3.6, 4.5].map(x => [1.15, -1.15].map(z => <Box key={`${x}${z}`} p={[x, 0.25, z]} s={[0.1, 0.5, 0.1]} c={dark} shadow={false} />))}
      </group>
    );
  }
  return (
    <group position={p} rotation={[0, rot, 0]} {...go}>
      <PropDot position={[(steps * run) / 2, rise * steps + 0.8, 0]} onClick={() => view.current.changeFloor?.()} />
      {Array.from({ length: steps }).map((_, i) => <Box key={i} p={[i * run + run / 2, (rise * (i + 1)) / 2, 0]} s={[run, rise * (i + 1), 2]} c={c} />)}
      {[1.05, -1.05].map(z => <Box key={z} p={[(steps * run) / 2, (rise * steps) / 2 + 0.2, z]} s={[steps * run, 0.1, 0.1]} c={dark} rot={0} shadow={false} />)}
      {[1.05, -1.05].map(z => Array.from({ length: 4 }).map((_, k) => {
        const x = 0.3 + (k * (steps * run - 0.6)) / 3;
        const h = rise * (x / run) + 0.5;
        return <Box key={`${z}${k}`} p={[x, h / 2 + 0.3, z]} s={[0.09, h * 0.5 + 0.2, 0.09]} c={dark} shadow={false} />;
      }))}
    </group>
  );
}

// ── Romantic Ground Floor Master Bedroom Suite Props ────────────────────────

export function RomanticCanopyBed({ p = [10.2, 0, -7.2] }) {
  const corners = useMemo(() => [
    [-2.25, -2.6], [2.25, -2.6], [-2.25, 2.6], [2.25, 2.6]
  ], []);

  return (
    <group position={p}>
      {/* Seductive underbed ambient glow */}
      <mesh position={[0, 0.04, 0]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 5.8]} />
        <meshBasicMaterial color="#ff4f7a" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.8, 4.8]} />
        <meshBasicMaterial color="#ffa26b" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* Deep velvet espresso base platform */}
      <Box p={[0, 0.28, 0]} s={[4.6, 0.54, 5.6]} c="#1e1026" r={0.14} />

      {/* Plush mattress in warm ivory silk */}
      <Box p={[0, 0.68, 0.05]} s={[4.36, 0.38, 5.3]} c="#faf3f5" r={0.12} />

      {/* Royal wine velvet duvet / comforter */}
      <Box p={[0, 0.98, 0.55]} s={[4.3, 0.32, 4.1]} c="#521226" r={0.16} />

      {/* Folded dusty rose satin coverlet */}
      <Box p={[0, 1.09, 1.7]} s={[4.32, 0.16, 1.7]} c="#be4a75" r={0.12} />

      {/* Champagne gold satin runner across foot */}
      <Box p={[0, 1.15, 2.3]} s={[4.34, 0.06, 0.8]} c="#dfbe82" r={0.06} />

      {/* Pillows: 2 king velvet back pillows */}
      {[-1.0, 1.0].map(x => (
        <Box key={`king-${x}`} p={[x, 1.18, -2.0]} s={[1.65, 0.44, 0.75]} c="#3c1126" r={0.15} />
      ))}
      {/* 2 sleeping pillows in silk ivory */}
      {[-1.0, 1.0].map(x => (
        <Box key={`silk-${x}`} p={[x, 1.26, -1.45]} s={[1.5, 0.34, 0.7]} c="#fff9fa" r={0.14} />
      ))}
      {/* 2 round velvet accent cushions with gold button */}
      {[-0.6, 0.6].map(x => (
        <group key={`cushion-${x}`} position={[x, 1.28, -0.95]} rotation={[0.4, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.12, 16]} />
            <meshStandardMaterial color="#c8567e" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Tufted headboard in deep wine velvet with brass border */}
      <Box p={[0, 1.9, -2.64]} s={[4.9, 2.6, 0.2]} c="#2e1022" r={0.14} />
      <Box p={[0, 1.9, -2.68]} s={[5.06, 2.76, 0.14]} c="#d4af37" r={0.08} />
      {/* Vertical fluted velvet ribs */}
      {[-1.8, -0.9, 0, 0.9, 1.8].map(dx => (
        <Box key={`rib-${dx}`} p={[dx, 1.9, -2.52]} s={[0.78, 2.3, 0.08]} c="#401630" r={0.06} />
      ))}
      {/* Soft warm headboard backglow */}
      <mesh position={[0, 3.15, -2.6]}>
        <planeGeometry args={[4.6, 0.12]} />
        <meshBasicMaterial color="#ff6b96" transparent opacity={0.65} toneMapped={false} />
      </mesh>

      {/* Four-poster brass canopy posts & top rails */}
      {corners.map(([cx, cz], i) => (
        <group key={`post-${i}`} position={[cx, 2.1, cz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.04, 4.2, 10]} />
            <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0, 2.14, 0]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.2} />
          </mesh>
        </group>
      ))}
      {/* Top connecting rails at y = 4.2 */}
      <Box p={[0, 4.2, -2.6]} s={[4.55, 0.05, 0.05]} c="#d4af37" shadow={false} />
      <Box p={[0, 4.2, 2.6]} s={[4.55, 0.05, 0.05]} c="#d4af37" shadow={false} />
      <Box p={[-2.25, 4.2, 0]} s={[0.05, 0.05, 5.25]} c="#d4af37" shadow={false} />
      <Box p={[2.25, 4.2, 0]} s={[0.05, 0.05, 5.25]} c="#d4af37" shadow={false} />

      {/* Sheer silk canopy drapery */}
      <mesh position={[0, 3.1, -2.55]}>
        <planeGeometry args={[4.3, 2.1]} />
        <meshStandardMaterial color="#fff0f5" transparent opacity={0.34} depthWrite={false} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {corners.map(([cx, cz], i) => (
        <group key={`drape-${i}`} position={[cx, 2.9, cz]}>
          <mesh>
            <cylinderGeometry args={[0.13, 0.2, 2.4, 8, 1, true]} />
            <meshStandardMaterial color="#fff2f6" transparent opacity={0.38} depthWrite={false} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function BedBench({ p = [10.2, 0, -3.7] }) {
  return (
    <group position={p}>
      {/* Velvet upholstered bench in rich berry wine */}
      <Box p={[0, 0.44, 0]} s={[3.6, 0.32, 1.05]} c="#6b1c3b" r={0.14} />
      <Box p={[0, 0.26, 0]} s={[3.5, 0.05, 0.95]} c="#d4af37" r={0.02} shadow={false} />
      {/* 4 tapered brass legs */}
      {[[-1.6, -0.38], [1.6, -0.38], [-1.6, 0.38], [1.6, 0.38]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.13, lz]}>
          <cylinderGeometry args={[0.035, 0.022, 0.26, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Draped ivory cashmere throw */}
      <Box p={[-0.85, 0.49, 0]} s={[1.1, 0.24, 1.1]} c="#fff6ed" r={0.08} />
      {/* Polished brass tray with champagne glass */}
      <mesh position={[0.8, 0.62, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.25} />
      </mesh>
      <WineGlass p={[0.8, 0.63, 0]} />
    </group>
  );
}

export function RomanticNightstand({ p, side = 'left' }) {
  const isLeft = side === 'left';
  return (
    <group position={p}>
      {/* Fluted dark plum cabinet with Italian Carrara marble top */}
      <Box p={[0, 0.44, 0]} s={[1.1, 0.88, 1.0]} c="#24142a" r={0.08} />
      <Box p={[0, 0.90, 0]} s={[1.16, 0.06, 1.06]} c="#f5ede9" r={0.02} />
      <Box p={[0, 0.55, 0.52]} s={[0.25, 0.04, 0.04]} c="#d4af37" shadow={false} />

      {/* Designer bedside lamp with warm fluted amber glow */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.04, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.34, 14]} />
        <meshStandardMaterial color="#ffe6d4" roughness={0.6} />
      </mesh>
      {/* Warm ambient sphere inside the lamp */}
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshBasicMaterial color="#ffaa55" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      {isLeft ? (
        <>
          {/* Amber glass scented candle jar */}
          <mesh position={[0.3, 0.98, 0.2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 10]} />
            <meshStandardMaterial color="#d98236" transparent opacity={0.75} />
          </mesh>
          <mesh position={[0.3, 1.08, 0.2]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshBasicMaterial color="#ffd56b" toneMapped={false} />
          </mesh>
          {/* Golden jewelry tray */}
          <mesh position={[-0.28, 0.94, 0.15]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
          </mesh>
        </>
      ) : (
        <>
          {/* Single red rose in crystal bud vase */}
          <mesh position={[0.28, 1.04, 0.15]}>
            <cylinderGeometry args={[0.04, 0.06, 0.22, 10]} />
            <meshStandardMaterial color="#e0f4ff" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.28, 1.2, 0.15]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#c01230" />
          </mesh>
          {/* Scented reed diffuser */}
          <mesh position={[-0.26, 0.98, 0.2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.1, 10]} />
            <meshStandardMaterial color="#2a1824" />
          </mesh>
          {[-0.03, 0, 0.03].map((dx, k) => (
            <mesh key={k} position={[-0.26 + dx, 1.12, 0.2]} rotation={[0, 0, dx * 4]}>
              <cylinderGeometry args={[0.006, 0.006, 0.22, 4]} />
              <meshStandardMaterial color="#1a1118" />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export function RomanticChaiseLounge({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Sculpted curved velvet base in deep ruby wine */}
      <Box p={[0, 0.42, 0]} s={[3.8, 0.36, 1.7]} c="#6b1836" r={0.16} />
      {/* High curved backrest */}
      <Box p={[0, 0.95, -0.68]} s={[3.8, 0.78, 0.32]} c="#58122a" r={0.14} />
      {/* Armrests */}
      <Box p={[-1.76, 0.72, 0]} s={[0.32, 0.56, 1.65]} c="#58122a" r={0.12} />
      <Box p={[1.76, 0.72, 0]} s={[0.32, 0.56, 1.65]} c="#58122a" r={0.12} />
      {/* 4 tapered brass legs */}
      {[[-1.65, -0.65], [1.65, -0.65], [-1.65, 0.65], [1.65, 0.65]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.12, lz]}>
          <cylinderGeometry args={[0.04, 0.025, 0.24, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Champagne silk pillows */}
      <Box p={[-1.1, 0.72, -0.38]} s={[0.65, 0.45, 0.22]} c="#f5e6d3" r={0.1} />
      <Box p={[1.1, 0.72, -0.38]} s={[0.65, 0.45, 0.22]} c="#f5e6d3" r={0.1} />
      {/* Ivory cashmere throw */}
      <Box p={[0.2, 0.52, 0.1]} s={[1.2, 0.24, 1.6]} c="#fff6ee" r={0.08} />
    </group>
  );
}

export function ChampagneTable({ p }) {
  return (
    <group position={p}>
      {/* Carrara marble top with brass rim */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.06, 24]} />
        <meshStandardMaterial color="#f7f2ed" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.028, 8, 24]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Brass pedestal */}
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.46, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Silver champagne ice bucket */}
      <mesh position={[-0.32, 0.64, -0.1]}>
        <cylinderGeometry args={[0.2, 0.16, 0.28, 14]} />
        <meshStandardMaterial color="#e8eff5" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Ice cubes */}
      <mesh position={[-0.32, 0.76, -0.1]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 12]} />
        <meshStandardMaterial color="#d8ecfc" transparent opacity={0.8} />
      </mesh>
      {/* Champagne bottle */}
      <mesh position={[-0.32, 0.82, -0.1]} rotation={[0.1, 0, 0.2]}>
        <cylinderGeometry args={[0.05, 0.06, 0.28, 10]} />
        <meshStandardMaterial color="#1a3522" />
      </mesh>
      {/* Gold foil neck */}
      <mesh position={[-0.29, 0.97, -0.1]} rotation={[0.1, 0, 0.2]}>
        <cylinderGeometry args={[0.025, 0.035, 0.1, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} />
      </mesh>

      {/* Two champagne flutes */}
      <WineGlass p={[0.15, 0.51, -0.22]} />
      <WineGlass p={[0.38, 0.51, -0.08]} />

      {/* Scented candle on mirrored brass tray */}
      <mesh position={[0.2, 0.52, 0.3]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.25} />
      </mesh>
      <Candle p={[0.2, 0.53, 0.3]} h={0.22} />

      {/* Plate with chocolate-covered strawberries */}
      <mesh position={[-0.2, 0.52, 0.3]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 14]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
      {[-0.08, 0, 0.08].map((dx, k) => (
        <mesh key={k} position={[-0.2 + dx, 0.56, 0.3 + (k % 2 ? 0.04 : -0.04)]}>
          <sphereGeometry args={[0.038, 8, 8]} />
          <meshStandardMaterial color="#8b0d26" />
        </mesh>
      ))}
    </group>
  );
}

export function RomanticFireplace({ p }) {
  return (
    <group position={p}>
      {/* Floating dark Nero Marquina console */}
      <Box p={[0, 0.48, 0]} s={[4.4, 0.92, 0.9]} c="#161120" r={0.06} />
      {/* Recessed linear electric fireplace chamber */}
      <Box p={[0, 0.44, -0.42]} s={[3.0, 0.42, 0.08]} c="#08060d" />

      {/* Glowing ember bed */}
      <mesh position={[0, 0.32, -0.46]}>
        <boxGeometry args={[2.8, 0.08, 0.04]} />
        <meshBasicMaterial color="#ff3814" toneMapped={false} />
      </mesh>
      {/* Ambient flame glow sphere */}
      <mesh position={[0, 0.42, -0.46]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshBasicMaterial color="#ff7a18" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Emissive flame tongues */}
      {[-0.9, -0.45, 0, 0.45, 0.9].map((fx, fi) => (
        <mesh key={fi} position={[fx, 0.42 + (fi % 2) * 0.04, -0.47]}>
          <coneGeometry args={[0.06, 0.18 + (fi % 3) * 0.06, 6]} />
          <meshBasicMaterial color={fi % 2 ? '#ffb034' : '#ff4a1c'} toneMapped={false} />
        </mesh>
      ))}
      <Neon p={[0, 0.44, -0.48]} s={[2.7, 0.08, 0.02]} color="#ff6b22" halo />

      {/* Sleek OLED screen above fireplace */}
      <Box p={[0, 1.88, 0]} s={[3.2, 1.7, 0.1]} c="#0c0b14" r={0.03} />
      <Neon p={[0, 1.88, -0.06]} s={[3.0, 1.5, 0.02]} color="#ff7597" halo={false} />

      {/* Mantle pillar candles */}
      <Candle p={[-1.7, 0.95, -0.1]} h={0.28} />
      <Candle p={[-1.5, 0.95, -0.1]} h={0.38} />
      <Candle p={[-1.3, 0.95, -0.1]} h={0.22} />

      {/* Scent diffuser on mantle */}
      <mesh position={[1.6, 1.02, -0.1]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 10]} />
        <meshStandardMaterial color="#2b1a26" />
      </mesh>
      {[-0.04, 0, 0.04].map((dx, k) => (
        <mesh key={k} position={[1.6 + dx, 1.18, -0.1]} rotation={[0, 0, dx * 3]}>
          <cylinderGeometry args={[0.006, 0.006, 0.24, 4]} />
          <meshStandardMaterial color="#1a1118" />
        </mesh>
      ))}
    </group>
  );
}

export function VelvetPouf({ p }) {
  return (
    <group position={p}>
      <mesh castShadow position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.44, 20]} />
        <meshStandardMaterial color="#9e345c" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.49, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function RomanticLantern({ p }) {
  return (
    <group position={p}>
      <Box p={[0, 0.42, 0]} s={[0.38, 0.84, 0.38]} c="#d4af37" metalness={0.7} roughness={0.3} />
      <Box p={[0, 0.42, 0]} s={[0.34, 0.8, 0.34]} c="#fff8e8" opacity={0.35} transparent shadow={false} />
      <Candle p={[0, 0.08, 0]} h={0.32} />
    </group>
  );
}

// ── Living Room Upgrades (Speakers, Clock, Window, Snacks, Reading Nook) ───

export function RealTimeClock({ p, rot = 0, r = 0.85 }) {
  const hrRef = useRef();
  const minRef = useRef();
  const secRef = useRef();
  const [digitalTime, setDigitalTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  const open = useOpenProp('clock');

  useFrame(() => {
    const d = new Date();
    const sec = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + sec / 60;
    const hr = (d.getHours() % 12) + min / 60;

    if (secRef.current) secRef.current.rotation.z = -sec * (PI * 2 / 60);
    if (minRef.current) minRef.current.rotation.z = -min * (PI * 2 / 60);
    if (hrRef.current) hrRef.current.rotation.z = -hr * (PI * 2 / 12);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setDigitalTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, r + 0.35, 0]} kind="clock" />
      {/* Outer brushed brass / gold bezel oriented facing +Z */}
      <mesh rotation={[PI / 2, 0, 0]}>
        <cylinderGeometry args={[r + 0.06, r + 0.06, 0.06, 36]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* High-contrast crisp ivory/porcelain dial face */}
      <mesh position={[0, 0, 0.035]} rotation={[PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, 0.015, 36]} />
        <meshStandardMaterial color="#f8f5ee" roughness={0.2} metalness={0.1} />
      </mesh>

      {/* 12 Hour tick markers in bold dark purple-black & gold */}
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = (i / 12) * PI * 2;
        const isMajor = i % 3 === 0;
        const tickDist = r - (isMajor ? 0.13 : 0.09);
        const tickLen = isMajor ? 0.15 : 0.07;
        const tickW = isMajor ? 0.045 : 0.022;
        return (
          <group key={i} position={[Math.sin(ang) * tickDist, Math.cos(ang) * tickDist, 0.05]} rotation={[0, 0, -ang]}>
            <mesh><boxGeometry args={[tickW, tickLen, 0.012]} /><meshStandardMaterial color={isMajor ? "#120e24" : "#4a3c66"} metalness={0.5} roughness={0.3} /></mesh>
          </group>
        );
      })}

      {/* Hour Hand (Bold dark with luminous gold insert) */}
      <group position={[0, 0, 0.06]}>
        <group ref={hrRef}>
          <mesh position={[0, (r * 0.48) / 2, 0]}>
            <boxGeometry args={[0.052, r * 0.48, 0.015]} />
            <meshStandardMaterial color="#140e24" metalness={0.6} />
          </mesh>
          <mesh position={[0, (r * 0.48) / 2, 0.008]}>
            <boxGeometry args={[0.028, r * 0.38, 0.006]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Minute Hand (Sleek bold dark with luminous gold insert) */}
      <group position={[0, 0, 0.07]}>
        <group ref={minRef}>
          <mesh position={[0, (r * 0.74) / 2, 0]}>
            <boxGeometry args={[0.038, r * 0.74, 0.014]} />
            <meshStandardMaterial color="#140e24" metalness={0.6} />
          </mesh>
          <mesh position={[0, (r * 0.74) / 2, 0.008]}>
            <boxGeometry args={[0.02, r * 0.62, 0.006]} />
            <meshStandardMaterial color="#d4af37" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Second Hand (Vibrant crimson / neon red with counterbalance) */}
      <group position={[0, 0, 0.08]}>
        <group ref={secRef}>
          <mesh position={[0, (r * 0.82) / 2 - 0.08, 0]}>
            <boxGeometry args={[0.018, r * 0.82 + 0.16, 0.012]} />
            <meshBasicMaterial color="#e63946" />
          </mesh>
        </group>
      </group>

      {/* Center gold cap pin */}
      <mesh position={[0, 0, 0.09]} rotation={[PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.022, 18]} />
        <meshStandardMaterial color="#ffd700" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Crystal Clear Live Digital Time Readout Badge */}
      <ScaledHtml position={[0, -r * 0.38, 0.08]} zIndexRange={[33, 0]} pointerEvents="none">
        <div style={{
          background: 'rgba(18, 14, 34, 0.94)',
          border: '1.5px solid #d4af37',
          borderRadius: 8,
          padding: '3px 10px',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 1.2,
          color: '#3ee8ff',
          fontFamily: 'monospace',
          boxShadow: '0 4px 14px rgba(0,0,0,0.6), 0 0 10px rgba(62,232,255,0.45)',
          whiteSpace: 'nowrap',
          textShadow: '0 0 6px rgba(62,232,255,0.8)',
        }}>
          {digitalTime}
        </div>
      </ScaledHtml>
    </group>
  );
}

export function ScenicWeatherWindow({ p, w = 3.6, h = 2.4, weather }) {
  const currentWx = weather || autoWeather();
  const isNight = currentWx === 'night';
  const isSunset = currentWx === 'sunset';
  const isSunrise = currentWx === 'sunrise';
  const isRain = currentWx === 'rain';
  const isCloudy = currentWx === 'cloudy';
  const isDay = currentWx === 'day';

  const skyColor = isNight ? '#0b102b'
    : isSunset ? '#db6452'
    : isSunrise ? '#e28882'
    : isRain ? '#4e596b'
    : isCloudy ? '#8696ab'
    : '#4da8f7';

  const horizonColor = isNight ? '#1e2454'
    : isSunset ? '#fca052'
    : isSunrise ? '#ffd08a'
    : isRain ? '#6d7b8f'
    : isCloudy ? '#b6c5d4'
    : '#b8e2ff';

  const sunColor = isNight ? '#f0f3ff'
    : isSunset ? '#ff5522'
    : isSunrise ? '#ffc870'
    : '#fff9bd';

  return (
    <group position={p}>
      {/* Wooden frame trim */}
      <Box p={[0, h / 2, 0.04]} s={[w + 0.28, h + 0.28, 0.12]} c="#1b162a" r={0.06} />

      {/* Window sill */}
      <Box p={[0, -0.06, 0.1]} s={[w + 0.44, 0.12, 0.26]} c="#28203d" r={0.04} />

      {/* Ambient glowing sill accent */}
      <mesh position={[0, -0.01, 0.12]}>
        <boxGeometry args={[w + 0.24, 0.02, 0.04]} />
        <meshBasicMaterial color={isNight ? '#4fa8ff' : '#ffe0a0'} toneMapped={false} />
      </mesh>

      {/* Inside backdrop recess (proud of back wall to prevent z-fighting) */}
      <mesh position={[0, h / 2, 0.015]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={skyColor} />
      </mesh>

      {/* Horizon atmospheric glow */}
      <mesh position={[0, h * 0.32, 0.02]}>
        <planeGeometry args={[w, h * 0.64]} />
        <meshBasicMaterial color={horizonColor} transparent opacity={0.78} />
      </mesh>

      {/* Sun / Moon disc */}
      {!isCloudy && !isRain && (
        <group position={[isSunset ? -w * 0.25 : w * 0.25, isSunset ? h * 0.45 : h * 0.72, 0.025]}>
          <mesh>
            <circleGeometry args={[isNight ? 0.28 : 0.36, 24]} />
            <meshBasicMaterial color={sunColor} toneMapped={false} />
          </mesh>
          {isNight && (
            <mesh position={[0.09, 0.06, 0.005]}>
              <circleGeometry args={[0.26, 24]} />
              <meshBasicMaterial color={skyColor} />
            </mesh>
          )}
        </group>
      )}

      {/* Night stars */}
      {isNight && (
        <group position={[0, h / 2, 0.022]}>
          {[
            [-1.2, 0.6], [-0.8, 0.8], [-0.3, 0.4], [0.1, 0.7], [0.6, 0.9], [1.1, 0.5],
            [-1.4, 0.2], [-0.5, 0.9], [0.4, 0.3], [1.3, 0.8], [-0.9, -0.1], [0.8, -0.2]
          ].map(([sx, sy], i) => (
            <mesh key={i} position={[sx * (w / 3.2), sy * (h / 2.2), 0]}>
              <circleGeometry args={[0.02 + (i % 3) * 0.008, 6]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* Clouds */}
      {(isDay || isSunset || isSunrise || isCloudy) && (
        <group position={[0, h * 0.62, 0.025]}>
          {[-1.0, 0.5, -0.2, 1.1].map((cx, i) => (
            <group key={i} position={[cx * (w / 3), (i % 2) * 0.14, 0]}>
              <mesh>
                <circleGeometry args={[0.35 + (i % 2) * 0.1, 16]} />
                <meshBasicMaterial color={isSunset ? '#ffd0b8' : isCloudy ? '#c2ced9' : '#ffffff'} transparent opacity={0.88} />
              </mesh>
              <mesh position={[0.22, -0.04, 0]}>
                <circleGeometry args={[0.25, 14]} />
                <meshBasicMaterial color={isSunset ? '#ffd0b8' : isCloudy ? '#c2ced9' : '#ffffff'} transparent opacity={0.88} />
              </mesh>
              <mesh position={[-0.22, -0.04, 0]}>
                <circleGeometry args={[0.25, 14]} />
                <meshBasicMaterial color={isSunset ? '#ffd0b8' : isCloudy ? '#c2ced9' : '#ffffff'} transparent opacity={0.88} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Rain streaks */}
      {isRain && (
        <group position={[0, h / 2, 0.025]}>
          {Array.from({ length: 16 }).map((_, i) => (
            <mesh key={i} position={[((i % 8) - 3.5) * (w / 8), ((i / 8) - 1) * (h / 2) + (i % 2) * 0.2, 0]} rotation={[0, 0, -0.25]}>
              <planeGeometry args={[0.015, 0.35]} />
              <meshBasicMaterial color="#b2c6dc" transparent opacity={0.7} />
            </mesh>
          ))}
        </group>
      )}

      {/* Rolling distant green hills */}
      <group position={[0, 0, 0.022]}>
        {[-0.8, 0.9].map((hx, i) => (
          <mesh key={i} position={[hx * (w / 3), 0.28, 0]}>
            <circleGeometry args={[w * 0.65, 24, 0, PI]} />
            <meshBasicMaterial color={isNight ? '#0e241e' : isSunset ? '#3a2e38' : isRain ? '#284632' : '#3d8246'} />
          </mesh>
        ))}
      </group>

      {/* Window mullions & dividers */}
      <Box p={[0, h * 0.55, 0.045]} s={[w, 0.05, 0.05]} c="#1b162a" shadow={false} />
      <Box p={[-w / 3, h / 2, 0.045]} s={[0.05, h, 0.05]} c="#1b162a" shadow={false} />
      <Box p={[w / 3, h / 2, 0.045]} s={[0.05, h, 0.05]} c="#1b162a" shadow={false} />

      {/* Glass reflection */}
      <mesh position={[0, h / 2, 0.05]} rotation={[0, 0, -0.6]}>
        <planeGeometry args={[0.2, h * 1.3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function SnackPlatter({ p = [0, 0.55, 0] }) {
  return (
    <group position={p}>
      {/* ── 1. Gourmet Pizza on wooden peel ── */}
      <group position={[-1.1, 0, -0.2]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.62, 0.03, 24]} />
          <meshStandardMaterial color="#b37c46" roughness={0.7} />
        </mesh>
        <mesh position={[-0.7, 0.02, 0]}>
          <boxGeometry args={[0.35, 0.03, 0.12]} />
          <meshStandardMaterial color="#b37c46" roughness={0.7} />
        </mesh>
        {/* Baked crust */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.03, 20]} />
          <meshStandardMaterial color="#d49b55" roughness={0.8} />
        </mesh>
        {/* Melted mozzarella & marinara */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.49, 0.49, 0.015, 20]} />
          <meshStandardMaterial color="#f7be38" roughness={0.55} />
        </mesh>
        {/* Pepperoni slices */}
        {Array.from({ length: 8 }).map((_, i) => {
          const ang = (i / 8) * PI * 2 + 0.2;
          const r = 0.28 + (i % 2) * 0.1;
          return (
            <mesh key={`pep-${i}`} position={[Math.cos(ang) * r, 0.075, Math.sin(ang) * r]} rotation={[0, ang, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.015, 10]} />
              <meshStandardMaterial color="#9b1e1e" roughness={0.5} />
            </mesh>
          );
        })}
        {/* Basil flakes */}
        {Array.from({ length: 6 }).map((_, i) => {
          const ang = (i / 6) * PI * 2 + 0.6;
          return (
            <mesh key={`basil-${i}`} position={[Math.cos(ang) * 0.2, 0.08, Math.sin(ang) * 0.2]} rotation={[0, ang, 0]}>
              <boxGeometry args={[0.04, 0.005, 0.05]} />
              <meshStandardMaterial color="#2d7c35" />
            </mesh>
          );
        })}
      </group>

      {/* ── 2. Two Double Cheeseburgers ── */}
      {[[-0.2, 0.4], [0.35, 0.45]].map(([bx, bz], bi) => (
        <group key={`burger-${bi}`} position={[bx, 0, bz]}>
          {/* Bottom brioche bun */}
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.07, 14]} />
            <meshStandardMaterial color="#d89c56" roughness={0.65} />
          </mesh>
          {/* Grilled beef patty */}
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.05, 14]} />
            <meshStandardMaterial color="#4a2718" roughness={0.9} />
          </mesh>
          {/* Melted cheddar slice */}
          <mesh position={[0, 0.12, 0]} rotation={[0, 0.4 * bi + 0.3, 0]}>
            <boxGeometry args={[0.25, 0.018, 0.25]} />
            <meshStandardMaterial color="#ffaa00" roughness={0.5} />
          </mesh>
          {/* Lettuce */}
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.02, 12]} />
            <meshStandardMaterial color="#489b38" />
          </mesh>
          {/* Ripe tomato slice */}
          <mesh position={[0, 0.165, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 14]} />
            <meshStandardMaterial color="#d62828" roughness={0.4} />
          </mesh>
          {/* Second patty */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.045, 14]} />
            <meshStandardMaterial color="#4a2718" roughness={0.9} />
          </mesh>
          {/* Top sesame bun */}
          <mesh position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.21, 14, 10, 0, PI * 2, 0, PI / 2]} />
            <meshStandardMaterial color="#d89c56" roughness={0.6} />
          </mesh>
          {/* Sesame seeds */}
          {[-0.08, 0, 0.08].map((sx, si) => (
            <mesh key={si} position={[sx, 0.36, (si % 2 ? 0.06 : -0.06)]}>
              <sphereGeometry args={[0.015, 4, 4]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── 3. Party Drinks (Soda cups with lids & straws + cans) ── */}
      <group position={[1.1, 0, -0.3]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.09, 0.36, 14]} />
          <meshStandardMaterial color="#d62828" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.125, 0.125, 0.025, 14]} />
          <meshStandardMaterial color="#f0f0f0" />
        </mesh>
        <mesh position={[0.04, 0.44, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      <group position={[1.4, 0, 0.1]}>
        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.08, 0.32, 14]} />
          <meshStandardMaterial color="#1d6fc2" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.02, 14]} />
          <meshStandardMaterial color="#f0f0f0" />
        </mesh>
        <mesh position={[0.03, 0.39, 0]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
          <meshBasicMaterial color="#ffd166" />
        </mesh>
      </group>

      <group position={[0.85, 0, 0.3]}>
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.26, 14]} />
          <meshStandardMaterial color="#2d9348" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.265, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.01, 14]} />
          <meshStandardMaterial color="#d8d8d8" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* ── 4. Golden Crispy French Fries Basket ── */}
      <group position={[-0.2, 0, -0.45]}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.42, 0.18, 0.28]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
        {[-0.14, -0.07, 0, 0.07, 0.14].map((fx, fi) => (
          <group key={`fry-${fi}`}>
            <mesh position={[fx, 0.22 + (fi % 3) * 0.03, -0.04]} rotation={[0.2, 0, (fi - 2) * 0.1]}>
              <boxGeometry args={[0.035, 0.2, 0.035]} />
              <meshStandardMaterial color="#f4c430" roughness={0.7} />
            </mesh>
            <mesh position={[fx + 0.02, 0.2 + (fi % 2) * 0.03, 0.04]} rotation={[-0.15, 0, (fi - 1) * 0.08]}>
              <boxGeometry args={[0.035, 0.18, 0.035]} />
              <meshStandardMaterial color="#e6b828" roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function HiFiSpeaker({ p, rot = 0, neon = '#3ee8ff' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Main speaker cabinet with beveled edges */}
      <Box p={[0, 0.7, 0]} s={[0.76, 1.4, 0.68]} c="#161220" r={0.06} />
      <Box p={[0, 0.7, 0.33]} s={[0.7, 1.34, 0.04]} c="#221c30" r={0.03} />

      {/* Glowing Neon Plinth Underglow Ring */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.82, 0.04, 0.74]} />
        <meshBasicMaterial color={neon} toneMapped={false} />
      </mesh>

      {/* Vertical Neon Accent Stripes on cabinet front flanks */}
      <mesh position={[-0.32, 0.7, 0.355]}>
        <boxGeometry args={[0.025, 1.25, 0.02]} />
        <meshBasicMaterial color={neon} toneMapped={false} />
      </mesh>
      <mesh position={[0.32, 0.7, 0.355]}>
        <boxGeometry args={[0.025, 1.25, 0.02]} />
        <meshBasicMaterial color={neon} toneMapped={false} />
      </mesh>

      {/* Gold-accented dome tweeter with glowing neon cyan rim */}
      <mesh position={[0, 1.08, 0.355]}>
        <ringGeometry args={[0.13, 0.165, 24]} />
        <meshBasicMaterial color={neon} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.08, 0.36]} rotation={[PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 18]} />
        <meshStandardMaterial color="#2a2038" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.08, 0.38]}>
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Mid/Bass woofer cone with vibrant glowing neon magenta/pink halo ring */}
      <mesh position={[0, 0.58, 0.355]}>
        <ringGeometry args={[0.26, 0.30, 28]} />
        <meshBasicMaterial color="#ff4fd8" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.58, 0.36]} rotation={[PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 22]} />
        <meshStandardMaterial color="#2d263d" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.58, 0.37]} rotation={[PI / 2, 0, 0]}>
        <coneGeometry args={[0.22, -0.06, 18]} />
        <meshStandardMaterial color="#1a1626" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.58, 0.38]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color="#3ee8ff" toneMapped={false} />
      </mesh>

      {/* Digital Graphic Equalizer / VU Meter LEDs */}
      {[-0.08, -0.04, 0, 0.04, 0.08].map((lx, li) => (
        <mesh key={li} position={[lx, 0.18, 0.36]}>
          <boxGeometry args={[0.025, 0.05 + (li % 3) * 0.03, 0.01]} />
          <meshBasicMaterial color={li < 3 ? '#39ff14' : '#00f0ff'} toneMapped={false} />
        </mesh>
      ))}

      {/* Power status LED */}
      <mesh position={[0, 0.09, 0.36]}>
        <circleGeometry args={[0.022, 10]} />
        <meshBasicMaterial color="#3ee8ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SoundBar({ p, neon = '#3ee8ff' }) {
  return (
    <group position={p}>
      {/* Soundbar acoustic body */}
      <Box p={[0, 0.09, 0]} s={[3.8, 0.18, 0.36]} c="#140f22" r={0.04} />
      <Box p={[0, 0.09, 0.17]} s={[3.72, 0.14, 0.02]} c="#1e182e" r={0.02} />

      {/* Vibrant Neon Light Bar running along the front */}
      <mesh position={[0, 0.09, 0.185]}>
        <boxGeometry args={[3.5, 0.025, 0.01]} />
        <meshBasicMaterial color={neon} toneMapped={false} />
      </mesh>

      {/* Underglow neon bar */}
      <mesh position={[0, 0.01, 0.1]}>
        <boxGeometry args={[3.6, 0.02, 0.16]} />
        <meshBasicMaterial color="#ff4fd8" toneMapped={false} />
      </mesh>

      {/* Dual stereo driver neon rings */}
      {[-1.3, -0.6, 0.6, 1.3].map((dx, di) => (
        <mesh key={di} position={[dx, 0.09, 0.183]}>
          <ringGeometry args={[0.04, 0.058, 16]} />
          <meshBasicMaterial color={di % 2 === 0 ? '#3ee8ff' : '#ff4fd8'} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function TrioTVLights({ p }) {
  const heights = [2.05, 2.75, 3.45];
  return (
    <group position={p}>
      {heights.map((y, i) => (
        <group key={i} position={[0, y, 0]}>
          <Box p={[0, 0, -0.04]} s={[0.18, 0.12, 0.08]} c="#d4af37" metalness={0.75} roughness={0.25} shadow={false} />
          <mesh position={[0, 0, 0.06]}>
            <cylinderGeometry args={[0.08, 0.08, 0.28, 12]} />
            <meshStandardMaterial color="#fff3e0" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshBasicMaterial color="#ffb347" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshBasicMaterial color="#ff9e54" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function ReadingArmchair({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Deep plush lounge armchair in rich caramel leather */}
      <Box p={[0, 0.38, 0]} s={[1.4, 0.32, 1.3]} c="#8c4e28" r={0.14} />
      <Box p={[0, 0.95, -0.52]} s={[1.4, 0.85, 0.28]} c="#764020" r={0.12} />
      <Box p={[-0.62, 0.65, 0]} s={[0.22, 0.45, 1.25]} c="#764020" r={0.1} />
      <Box p={[0.62, 0.65, 0]} s={[0.22, 0.45, 1.25]} c="#764020" r={0.1} />
      {[[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.11, lz]}>
          <cylinderGeometry args={[0.035, 0.022, 0.22, 8]} />
          <meshStandardMaterial color="#1a120b" />
        </mesh>
      ))}
      <Box p={[0, 0.65, -0.32]} s={[0.7, 0.35, 0.18]} c="#faf0e6" r={0.08} />
    </group>
  );
}

export function ReadingLamp({ p }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 2.3, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 0.45, 16]} />
        <meshStandardMaterial color="#fef5ea" roughness={0.65} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshBasicMaterial color="#ffa84a" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function LoungeTableItems({ p = [0, 0.52, 0] }) {
  return (
    <group position={p}>
      {/* ── 1. Stack of glossy lifestyle/gaming magazines ── */}
      <group position={[-0.75, 0, -0.1]} rotation={[0, 0.18, 0]}>
        {/* Bottom Magazine */}
        <Box p={[0, 0.012, 0]} s={[0.65, 0.022, 0.88]} c="#241e3a" r={0.02} />
        <mesh position={[0, 0.024, 0]} rotation={[-PI / 2, 0, 0]}>
          <planeGeometry args={[0.63, 0.86]} />
          <meshBasicMaterial color="#3ee8ff" />
        </mesh>
        {/* Top Magazine (slightly skewed) */}
        <group position={[0.04, 0.028, 0.03]} rotation={[0, -0.12, 0]}>
          <Box p={[0, 0.012, 0]} s={[0.65, 0.022, 0.88]} c="#1e182e" r={0.02} />
          <mesh position={[0, 0.024, 0]} rotation={[-PI / 2, 0, 0]}>
            <planeGeometry args={[0.63, 0.86]} />
            <meshBasicMaterial color="#ff4fd8" />
          </mesh>
          {/* Magazine title bar */}
          <mesh position={[0, 0.025, -0.32]} rotation={[-PI / 2, 0, 0]}>
            <planeGeometry args={[0.55, 0.14]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Graphic cover art block */}
          <mesh position={[0, 0.025, 0.08]} rotation={[-PI / 2, 0, 0]}>
            <planeGeometry args={[0.52, 0.48]} />
            <meshBasicMaterial color="#ffeaa7" />
          </mesh>
        </group>
      </group>

      {/* ── 2. TV / Streaming Remote Control ── */}
      <group position={[-0.1, 0.015, -0.35]} rotation={[0, -0.25, 0]}>
        <Box p={[0, 0.015, 0]} s={[0.13, 0.028, 0.42]} c="#120f1e" r={0.03} />
        {/* D-Pad */}
        <mesh position={[0, 0.032, -0.1]}>
          <circleGeometry args={[0.038, 12]} />
          <meshStandardMaterial color="#4a3e66" />
        </mesh>
        {/* Colored app buttons (Netflix red, Disney blue, Prime cyan) */}
        {[-0.03, 0.03].map((bx, bi) => (
          <group key={bi}>
            <mesh position={[bx, 0.032, 0.04]}>
              <boxGeometry args={[0.032, 0.008, 0.028]} />
              <meshBasicMaterial color={bi === 0 ? '#e50914' : '#00d2ff'} />
            </mesh>
            <mesh position={[bx, 0.032, 0.1]}>
              <boxGeometry args={[0.032, 0.008, 0.028]} />
              <meshBasicMaterial color={bi === 0 ? '#00a8e1' : '#ffeaa7'} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 3. Designer Ceramic Coffee Mugs on wooden coasters ── */}
      <group position={[0.28, 0, 0.15]}>
        {/* Coaster */}
        <mesh position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.015, 18]} />
          <meshStandardMaterial color="#b37c46" roughness={0.7} />
        </mesh>
        {/* Pastel Teal Mug */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 0.22, 16]} />
          <meshStandardMaterial color="#4ecdc4" roughness={0.3} />
        </mesh>
        {/* Coffee surface */}
        <mesh position={[0, 0.21, 0]} rotation={[-PI / 2, 0, 0]}>
          <circleGeometry args={[0.095, 14]} />
          <meshStandardMaterial color="#3d2314" roughness={0.4} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.12, 0.12, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.055, 0.016, 8, 14]} />
          <meshStandardMaterial color="#4ecdc4" roughness={0.3} />
        </mesh>
      </group>

      <group position={[0.62, 0, -0.15]}>
        {/* Coaster */}
        <mesh position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.015, 18]} />
          <meshStandardMaterial color="#b37c46" roughness={0.7} />
        </mesh>
        {/* Pastel Lilac Mug */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 0.22, 16]} />
          <meshStandardMaterial color="#a56bff" roughness={0.3} />
        </mesh>
        {/* Coffee surface */}
        <mesh position={[0, 0.21, 0]} rotation={[-PI / 2, 0, 0]}>
          <circleGeometry args={[0.095, 14]} />
          <meshStandardMaterial color="#3d2314" roughness={0.4} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.12, 0.12, 0]}>
          <torusGeometry args={[0.055, 0.016, 8, 14]} />
          <meshStandardMaterial color="#a56bff" roughness={0.3} />
        </mesh>
      </group>

      {/* ── 4. Mini Succulent in Faceted Ceramic Pot ── */}
      <group position={[-0.1, 0, 0.25]}>
        <mesh position={[0, 0.07, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.08, 0.14, 6]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        {/* Soil */}
        <mesh position={[0, 0.135, 0]} rotation={[-PI / 2, 0, 0]}>
          <circleGeometry args={[0.105, 8]} />
          <meshStandardMaterial color="#2d1c10" roughness={0.9} />
        </mesh>
        {/* Succulent leaves */}
        {[0, 1, 2, 3, 4, 5].map((ang, i) => (
          <mesh key={i} position={[Math.sin((ang / 6) * PI * 2) * 0.05, 0.16, Math.cos((ang / 6) * PI * 2) * 0.05]} rotation={[0.4, (ang / 6) * PI * 2, 0]}>
            <sphereGeometry args={[0.038, 6, 6]} />
            <meshStandardMaterial color="#48c774" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.19, 0]}>
          <sphereGeometry args={[0.032, 6, 6]} />
          <meshStandardMaterial color="#5dd389" roughness={0.6} />
        </mesh>
      </group>

      {/* ── 5. Elegant Glass Water Carafe ── */}
      <group position={[1.0, 0, 0.1]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.16, 0.44, 16]} />
          <meshStandardMaterial color="#a0d8ef" transparent opacity={0.65} roughness={0.1} />
        </mesh>
        {/* Lemon slice inside carafe */}
        <mesh position={[0, 0.14, 0]} rotation={[0.6, 0.3, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.015, 12]} />
          <meshStandardMaterial color="#ffd700" />
        </mesh>
        {/* Carafe cork stopper */}
        <mesh position={[0, 0.45, 0]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial color="#b37c46" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

export function FramedArt({ p, w = 1.8, h = 2.2, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {/* Outer brushed brass / dark wood frame */}
      <Box p={[0, 0, 0.03]} s={[w + 0.16, h + 0.16, 0.06]} c="#1b1424" r={0.03} />
      <Box p={[0, 0, 0.05]} s={[w + 0.08, h + 0.08, 0.03]} c="#d4af37" metalness={0.7} r={0.02} />
      {/* White gallery matting */}
      <mesh position={[0, 0, 0.066]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#f8f4ec" />
      </mesh>
      {/* Artistic abstract canvas artwork */}
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[w - 0.22, h - 0.26]} />
        <meshBasicMaterial color="#3a2468" />
      </mesh>
      {/* Abstract geometric color waves */}
      <mesh position={[0, 0.15, 0.072]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#ff5e7e" toneMapped={false} />
      </mesh>
      <mesh position={[-0.2, -0.25, 0.073]}>
        <planeGeometry args={[0.6, 0.5]} />
        <meshBasicMaterial color="#3ee8ff" toneMapped={false} />
      </mesh>
      <mesh position={[0.22, -0.15, 0.074]}>
        <circleGeometry args={[0.28, 20]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function WallGuitar({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, -0.25]}>
      {/* Guitar body - lower bout */}
      <mesh position={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.38, 0.38, 0.09, 24]} />
        <meshStandardMaterial color="#c2753a" roughness={0.4} />
      </mesh>
      {/* Guitar body - upper bout */}
      <mesh position={[0, 0.44, 0.06]}>
        <cylinderGeometry args={[0.29, 0.29, 0.088, 24]} />
        <meshStandardMaterial color="#b3662d" roughness={0.4} />
      </mesh>
      {/* Waist transition */}
      <mesh position={[0, 0.22, 0.06]}>
        <boxGeometry args={[0.48, 0.35, 0.086]} />
        <meshStandardMaterial color="#c2753a" roughness={0.4} />
      </mesh>
      {/* Soundhole */}
      <mesh position={[0, 0.28, 0.106]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[0.11, 20]} />
        <meshBasicMaterial color="#1a0f08" />
      </mesh>
      {/* Rosette ring */}
      <mesh position={[0, 0.28, 0.107]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[0.115, 0.14, 20]} />
        <meshBasicMaterial color="#ffeaa7" />
      </mesh>
      {/* Bridge */}
      <mesh position={[0, -0.08, 0.11]}>
        <boxGeometry args={[0.24, 0.05, 0.02]} />
        <meshStandardMaterial color="#4a2810" />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 0.95, 0.06]}>
        <boxGeometry args={[0.12, 0.75, 0.05]} />
        <meshStandardMaterial color="#5a3418" />
      </mesh>
      {/* Fretboard */}
      <mesh position={[0, 0.95, 0.088]}>
        <boxGeometry args={[0.11, 0.74, 0.012]} />
        <meshStandardMaterial color="#1f140e" />
      </mesh>
      {/* Frets */}
      {[-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map((fy, i) => (
        <mesh key={i} position={[0, 0.95 + fy, 0.096]}>
          <boxGeometry args={[0.1, 0.008, 0.005]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} />
        </mesh>
      ))}
      {/* Headstock */}
      <mesh position={[0, 1.45, 0.06]}>
        <boxGeometry args={[0.16, 0.28, 0.05]} />
        <meshStandardMaterial color="#c2753a" />
      </mesh>
      {/* Tuning pegs */}
      {[-0.09, 0.09].map((px, pi) => (
        [1.38, 1.45, 1.52].map((py, yi) => (
          <mesh key={`${pi}-${yi}`} position={[px, py, 0.06]}>
            <cylinderGeometry args={[0.02, 0.02, 0.04, 8]} />
            <meshStandardMaterial color="#ffd700" metalness={0.9} />
          </mesh>
        ))
      ))}
      {/* Wall hanger bracket */}
      <mesh position={[0, 1.25, 0.02]}>
        <boxGeometry args={[0.2, 0.06, 0.06]} />
        <meshStandardMaterial color="#1a1426" metalness={0.8} />
      </mesh>
    </group>
  );
}

export function CuteTreeVase({ p, potColor = '#4ecdc4', leavesColor = '#2ecc71' }) {
  return (
    <group position={p}>
      {/* Cute ceramic pot with round bulbous base */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.16, 0.44, 18]} />
        <meshStandardMaterial color={potColor} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <torusGeometry args={[0.24, 0.03, 8, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      {/* Dark soil */}
      <mesh position={[0, 0.41, 0]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 16]} />
        <meshStandardMaterial color="#2c1a0e" roughness={0.9} />
      </mesh>
      {/* Woody bonsai trunk */}
      <mesh position={[0, 0.65, 0]} rotation={[0.08, 0, 0.1]}>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
        <meshStandardMaterial color="#5c381e" roughness={0.8} />
      </mesh>
      {/* Cute fluffy rounded foliage clouds */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.38, 14, 12]} />
        <meshStandardMaterial color={leavesColor} roughness={0.7} />
      </mesh>
      <mesh position={[-0.18, 0.95, 0.1]} castShadow>
        <sphereGeometry args={[0.25, 12, 10]} />
        <meshStandardMaterial color={leavesColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.18, 0.98, -0.08]} castShadow>
        <sphereGeometry args={[0.26, 12, 10]} />
        <meshStandardMaterial color={leavesColor} roughness={0.7} />
      </mesh>
    </group>
  );
}

export const MONA_LISA_IMG = '/images/gamify/art/mona-lisa.webp';
const MONA_ASPECT = 500 / 745;
let monaTexPromise = null;
function loadMonaTexture() {
  if (!monaTexPromise) {
    monaTexPromise = new Promise((resolve) => {
      new THREE.TextureLoader().load(
        MONA_LISA_IMG,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); },
        undefined,
        () => { monaTexPromise = null; resolve(null); }, // let the next attempt retry
      );
    });
  }
  return monaTexPromise;
}

export function MonaLisaPainting({ p, w = 2.4, h = 2.6 }) {
  const open = useOpenProp('monalisa');
  const [monaTex, setMonaTex] = useState(null);
  useEffect(() => {
    let live = true;
    let timer = 0;
    const attempt = (n) => loadMonaTexture().then((t) => {
      if (!live) return;
      if (t) setMonaTex(t);
      else if (n < 3) timer = setTimeout(() => attempt(n + 1), 2500 * (n + 1));
    });
    attempt(0);
    return () => { live = false; clearTimeout(timer); };
  }, []);
  return (
    <group position={p} {...open}>
      <PropDot position={[0, h / 2 + 0.35, 0.1]} kind="monalisa" />
      {/* Outer dark wood frame backboard */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w + 0.35, h + 0.35, 0.08]} />
        <meshStandardMaterial color="#1a120c" roughness={0.7} />
      </mesh>
      {/* Gilded ornamental baroque frame */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[w + 0.25, h + 0.25, 0.08]} />
        <meshStandardMaterial color="#b8860b" roughness={0.3} metalness={0.75} />
      </mesh>
      {/* Inner gold fillet bevel */}
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.06]} />
        <meshStandardMaterial color="#ffd700" roughness={0.25} metalness={0.85} />
      </mesh>
      {/* Off-white canvas mat border */}
      <mesh position={[0, 0, 0.09]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#2d2218" roughness={0.9} />
      </mesh>

      {/* The real painting (public domain, Louvre) once its texture has loaded; the drawn version below is the fallback */}
      {monaTex && (
        <mesh position={[0, 0, 0.125]}>
          <planeGeometry args={[Math.min(w, h * MONA_ASPECT), Math.min(w, h * MONA_ASPECT) / MONA_ASPECT]} />
          <meshBasicMaterial map={monaTex} toneMapped={false} />
        </mesh>
      )}
      {/* Mona Lisa Canvas composition (warm Renaissance palette & sfumato portrait) */}
      <group position={[0, 0, 0.1]} visible={!monaTex}>
        {/* Sky & background Italian landscape */}
        <mesh position={[0, h * 0.22, 0]}>
          <planeGeometry args={[w * 0.88, h * 0.44]} />
          <meshBasicMaterial color="#556254" />
        </mesh>
        <mesh position={[0, h * 0.08, 0.001]}>
          <planeGeometry args={[w * 0.88, h * 0.28]} />
          <meshBasicMaterial color="#3a4232" />
        </mesh>
        {/* River/road winding through landscape */}
        <mesh position={[-w * 0.2, h * 0.1, 0.002]} rotation={[0, 0, 0.4]}>
          <planeGeometry args={[w * 0.14, h * 0.3]} />
          <meshBasicMaterial color="#6a7860" />
        </mesh>
        {/* Mona Lisa Torso & dark veil drapery */}
        <mesh position={[0, -h * 0.12, 0.003]}>
          <planeGeometry args={[w * 0.65, h * 0.62]} />
          <meshBasicMaterial color="#1b1713" />
        </mesh>
        {/* Warm ochre dress bodice */}
        <mesh position={[0, -h * 0.08, 0.004]}>
          <planeGeometry args={[w * 0.38, h * 0.32]} />
          <meshBasicMaterial color="#3a2f20" />
        </mesh>
        {/* Mona Lisa Head & glowing skin */}
        <mesh position={[0, h * 0.15, 0.005]}>
          <circleGeometry args={[w * 0.18, 24]} />
          <meshBasicMaterial color="#dfc09c" />
        </mesh>
        {/* Dark curled hair & delicate translucent veil */}
        <mesh position={[0, h * 0.18, 0.006]}>
          <circleGeometry args={[w * 0.21, 24, 0, Math.PI]} />
          <meshBasicMaterial color="#15120f" />
        </mesh>
        <mesh position={[-w * 0.14, h * 0.1, 0.006]}>
          <planeGeometry args={[w * 0.08, h * 0.22]} />
          <meshBasicMaterial color="#1f1a14" />
        </mesh>
        <mesh position={[w * 0.14, h * 0.1, 0.006]}>
          <planeGeometry args={[w * 0.08, h * 0.22]} />
          <meshBasicMaterial color="#1f1a14" />
        </mesh>
        {/* Iconic soft smile & eyes shadow */}
        <mesh position={[0, h * 0.13, 0.007]}>
          <planeGeometry args={[w * 0.12, h * 0.04]} />
          <meshBasicMaterial color="#4a3726" />
        </mesh>
        {/* Folded hands in the foreground */}
        <mesh position={[0, -h * 0.32, 0.005]}>
          <planeGeometry args={[w * 0.32, h * 0.14]} />
          <meshBasicMaterial color="#d4b490" />
        </mesh>
      </group>

      {/* Brass Museum Plaque */}
      <mesh position={[0, -h / 2 - 0.1, 0.05]}>
        <boxGeometry args={[1.4, 0.12, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Subtle art spotlight */}
      <pointLight position={[0, 0.4, 1.2]} intensity={18} distance={4} color="#fff1d6" decay={2} />
    </group>
  );
}

export function StudyCenterLamp({ p }) {
  return (
    <group position={p}>
      {/* Glazed porcelain base */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 0.28, 18]} />
        <meshStandardMaterial color="#f8eedf" roughness={0.2} metalness={0.1} />
      </mesh>
      {/* Brass collar ring */}
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.04, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Brass stem */}
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.32, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Pleated linen lampshade */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.38, 0.38, 24, 1, true]} />
        <meshStandardMaterial color="#fff6ea" roughness={0.9} side={2} />
      </mesh>
      {/* Inner glowing lamp bulb */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshBasicMaterial color="#fff3cc" />
      </mesh>
      {/* Warm cozy reading glow */}
      <pointLight position={[0, 0.72, 0]} intensity={22} distance={6} color="#ffe5b4" decay={2} />
    </group>
  );
}

export function PuzzleTableSet({ p }) {
  const open = useOpenProp('puzzles');
  return (
    <group position={p} {...open}>
      <PropDot position={[0, 0.6, 0]} kind="puzzles" />
      {/* Main Jigsaw Puzzle Board with mahogany rim */}
      <Box p={[0, 0.02, 0]} s={[2.4, 0.04, 1.6]} c="#6e4726" r={0.03} />
      <Box p={[0, 0.045, 0]} s={[2.24, 0.02, 1.44]} c="#1f1832" r={0.02} />
      
      {/* Visual jigsaw puzzle picture in progress on the board */}
      {[
        [-0.7, 0.06, -0.4, '#38bdf8'],
        [-0.25, 0.06, -0.4, '#818cf8'],
        [0.2, 0.06, -0.4, '#c084fc'],
        [0.65, 0.06, -0.4, '#f472b6'],
        [-0.7, 0.06, 0.0, '#0284c7'],
        [-0.25, 0.06, 0.0, '#6366f1'],
        [0.2, 0.06, 0.0, '#a855f7'],
        [0.65, 0.06, 0.0, '#ec4899'],
        [-0.7, 0.06, 0.4, '#059669'],
        [-0.25, 0.06, 0.4, '#10b981'],
        [0.2, 0.06, 0.4, '#eab308'],
        [0.65, 0.06, 0.4, '#f97316'],
      ].map(([px, py, pz, col], i) => (
        <mesh key={`grid-${i}`} position={[px, py, pz]}>
          <planeGeometry args={[0.42, 0.36]} />
          <meshStandardMaterial color={col} roughness={0.4} />
        </mesh>
      ))}

      {/* Grid line overlay to simulate jigsaw interlocking cut lines */}
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 1.4]} />
        <meshBasicMaterial color="#0b0716" wireframe />
      </mesh>

      {/* Loose scattered jigsaw puzzle pieces around the table */}
      {[
        [-1.4, 0.03, -0.3, '#38bdf8', 0.4],
        [-1.3, 0.03, 0.2, '#f472b6', 1.2],
        [-1.5, 0.03, 0.5, '#eab308', -0.5],
        [1.3, 0.03, -0.4, '#10b981', 0.8],
        [1.4, 0.03, 0.1, '#a855f7', -1.1],
        [1.35, 0.03, 0.45, '#f97316', 0.3],
      ].map(([px, py, pz, col, rot], i) => (
        <mesh key={`loose-${i}`} position={[px, py, pz]} rotation={[0, rot, 0]}>
          <boxGeometry args={[0.2, 0.015, 0.2]} />
          <meshStandardMaterial color={col} roughness={0.3} />
        </mesh>
      ))}

      {/* Jigsaw Puzzle Box Lid with colorful game art cover */}
      <group position={[-1.6, 0.08, -0.1]} rotation={[0, 0.25, 0]}>
        <Box p={[0, 0, 0]} s={[0.8, 0.12, 0.6]} c="#241e3a" r={0.02} />
        <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.74, 0.54]} />
          <meshBasicMaterial color="#8b5cf6" />
        </mesh>
      </group>

      {/* 3D Rubik's cube on the side */}
      <group position={[1.5, 0.14, -0.2]} rotation={[0.08, 0.45, 0]}>
        <Box p={[0, 0, 0]} s={[0.3, 0.3, 0.3]} c="#120e1f" r={0.03} />
        {[-0.075, 0.075].map(fx => (
          [-0.075, 0.075].map(fy => (
            <mesh key={`rc-${fx}-${fy}`} position={[fx, fy, 0.155]}>
              <planeGeometry args={[0.12, 0.12]} />
              <meshBasicMaterial color={fx > 0 ? '#ff4fd8' : '#3ee8ff'} />
            </mesh>
          ))
        ))}
      </group>
    </group>
  );
}



