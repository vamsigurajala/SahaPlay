import { createContext, useContext, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { RoundedBoxGeometry } from 'three-stdlib';
import { useFrame } from '@react-three/fiber';
import { NEON_CYAN } from './constants';

// Shared, mutable camera/view state ({ zoom, cur, tx, tz, flip }) provided
// inside the Canvas — read from refs in useFrame so nothing here ever
// triggers a React re-render while panning or zooming.
export const ViewContext = createContext({ current: { cur: 1, flip: false } });

// Rounded boxes with the same size/radius share one geometry — the scene has
// hundreds of them, and building each separately dominated load time and memory
// on phones.
// Tap handlers that ask the Gamify container to open a full-screen viewer
// (bookshelf / fridge). `delta` filters out a drag that merely ended on the prop.
export function useOpenProp(kind, arg) {
  const view = useContext(ViewContext);
  return {
    onClick: (e) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      view.current.openProp?.(kind, arg);
    },
    onPointerOver: () => { try { document.body.style.cursor = 'pointer'; } catch { /* non-browser */ } },
    onPointerOut: () => { try { document.body.style.cursor = ''; } catch { /* non-browser */ } },
  };
}

const boxGeoCache = new Map();
function roundedGeo(s, r) {
  const key = `${s[0]}|${s[1]}|${s[2]}|${r}`;
  let g = boxGeoCache.get(key);
  if (!g) { g = new RoundedBoxGeometry(s[0], s[1], s[2], 3, r); boxGeoCache.set(key, g); }
  return g;
}
const plainGeoCache = new Map();
function plainGeo(s) {
  const key = `${s[0]}|${s[1]}|${s[2]}`;
  let g = plainGeoCache.get(key);
  if (!g) { g = new THREE.BoxGeometry(s[0], s[1], s[2]); plainGeoCache.set(key, g); }
  return g;
}

export function Box({ p, s, c, r = 0, emissive, ei = 1, rough = 0.75, shadow = true, rot = 0, opacity, metal = 0, onClick, onPointerOver, onPointerOut }) {
  const material = (
    <meshStandardMaterial
      color={c}
      roughness={rough}
      metalness={metal}
      emissive={emissive || '#000'}
      emissiveIntensity={emissive ? ei : 0}
      transparent={opacity != null}
      opacity={opacity ?? 1}
      toneMapped={!emissive}
    />
  );
  const geometry = r > 0.001 ? roundedGeo(s, Math.min(r, Math.min(...s) / 2 - 0.001)) : plainGeo(s);
  return (
    <mesh geometry={geometry} position={p} rotation={[0, rot, 0]} castShadow={shadow} receiveShadow onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      {material}
    </mesh>
  );
}

// Glowing strip with a fake additive halo (no postprocessing dependency).
export function Neon({ p, s, color, halo = true }) {
  return (
    <group position={p}>
      <mesh>
        <boxGeometry args={s} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {halo && (
        <mesh>
          <boxGeometry args={[s[0] + 0.18, s[1] + 0.18, s[2] + 0.18]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export function Plant({ p, scale = 1, color = '#2f9e5a', pot = '#6e4bb8' }) {
  const leaves = [[0, 1.0, 0, 0.5], [0.28, 0.8, 0.1, 0.38], [-0.3, 0.75, -0.1, 0.4], [0.05, 1.35, 0.05, 0.32], [-0.1, 0.55, 0.3, 0.3]];
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.26, 0.6, 14]} />
        <meshStandardMaterial color={pot} roughness={0.6} />
      </mesh>
      {leaves.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 1.15, 1]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={color} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function Tree({ p, scale = 1 }) {
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 1.8, 10]} />
        <meshStandardMaterial color="#6b4a2f" roughness={1} />
      </mesh>
      {[[0, 2.5, 0, 1.3], [0.6, 2.1, 0.3, 0.9], [-0.6, 2.2, -0.2, 0.95]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i === 0 ? '#3aa862' : '#2f9456'} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function BeanBag({ p, color, glow }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.34, 0]} scale={[1, 0.62, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.7, 20, 16]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.86, 28]} />
        <meshBasicMaterial color={glow} transparent opacity={0.75} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function FloorLamp({ p, color = '#ffd36b', h = 2.6 }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.28, 0.32, 0.1, 14]} /><meshStandardMaterial color="#1d1740" /></mesh>
      <mesh position={[0, h / 2, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, h, 8]} /><meshStandardMaterial color="#2a2140" /></mesh>
      <mesh position={[0, h, 0]}><cylinderGeometry args={[0.28, 0.4, 0.5, 14]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  );
}

export function TableLamp({ p, color = '#ffd36b' }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.08, 0.14, 0.36, 10]} /><meshStandardMaterial color="#2a2140" /></mesh>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.16, 0.26, 0.3, 12]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  );
}

export function Chair({ p, rot = 0, c = '#6d4fd0' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.5, 0]} s={[0.9, 0.18, 0.9]} c={c} r={0.07} />
      <Box p={[0, 1.0, -0.4]} s={[0.9, 0.9, 0.14]} c={c} r={0.07} />
      <Box p={[0, 0.25, 0]} s={[0.14, 0.5, 0.14]} c="#2a2140" />
    </group>
  );
}

export function Stool({ p, c = '#e0529f' }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.32, 0.32, 0.14, 16]} /><meshStandardMaterial color={c} roughness={0.6} /></mesh>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 8]} /><meshStandardMaterial color="#2a2140" /></mesh>
      <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.28, 0.28, 0.06, 14]} /><meshStandardMaterial color="#2a2140" /></mesh>
    </group>
  );
}

export function Monitor({ p, rot = 0, color = '#3ee8ff' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.12, 0]} s={[0.5, 0.06, 0.34]} c="#1a1530" />
      <Box p={[0, 0.3, 0]} s={[0.08, 0.3, 0.08]} c="#1a1530" />
      <Box p={[0, 0.75, 0]} s={[1.3, 0.78, 0.07]} c="#0e0c1c" />
      <mesh position={[0, 0.75, 0.04]}><planeGeometry args={[1.2, 0.68]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    </group>
  );
}

// Which room a prop sits in (set by Cell) and which room is being viewed (set by
// the scene), so a prop can show its tap dot only while you are in that room.
export const ZoneContext = createContext(null);
export const FocusContext = createContext(null);

let dotCss = false;
function ensureDotCss() {
  if (dotCss || typeof document === 'undefined') return;
  dotCss = true;
  const el = document.createElement('style');
  el.textContent = '@keyframes gp-dot { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.75) } 70% { box-shadow: 0 0 0 11px rgba(255,255,255,0) } 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0) } }';
  document.head.appendChild(el);
}

function PropDotInner({ position, kind, arg, onClick }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  ensureDotCss();
  useFrame(() => {
    const el = ref.current;
    if (!el) return;
    const on = view.current.uiVisible !== false && !view.current.out;
    el.style.opacity = on ? '1' : '0';
    el.style.pointerEvents = on ? 'auto' : 'none';
  });
  return (
    <ScaledHtml position={position} zIndexRange={[33, 0]}>
      <div ref={ref} style={{ transition: 'opacity .25s' }}>
        <button
          aria-label="Look closer"
          onPointerDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (onClick) onClick(e); else view.current.openProp?.(kind, arg); }}
          style={{ width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'rgba(255,255,255,0.94)', border: '4px solid rgba(139,92,255,0.95)', animation: 'gp-dot 1.8s infinite' }}
        />
      </div>
    </ScaledHtml>
  );
}

// A small pulsing dot over something you can tap (wardrobe, shelf, fridge...). Only
// mounted for the room you are in, and it fades out when the pointer is idle.
export function PropDot(props) {
  const zone = useContext(ZoneContext);
  const focus = useContext(FocusContext);
  if (!zone || focus !== zone) return null;
  return <PropDotInner {...props} />;
}

// Two door leaves that stay shut until someone goes through (view.doors[key] holds
// the time until which the door stays open).
export function DoorLeaves({ along, doorKey, color, handle = '#d9c48a' }) {
  const view = useContext(ViewContext);
  const l = useRef();
  const r = useRef();
  const a = useRef(0);
  useFrame((_, dt) => {
    const until = view.current.doors?.[doorKey] || 0;
    const want = performance.now() < until ? 1.35 : 0;
    if (Math.abs(want - a.current) < 0.002) return;
    a.current += (want - a.current) * (1 - Math.exp(-dt * 7));
    if (l.current) l.current.rotation.y = a.current;
    if (r.current) r.current.rotation.y = -a.current;
  });
  return (
    <group rotation={[0, along ? 0 : Math.PI / 2, 0]}>
      <group ref={l} position={[-1.6, 0, 0]}>
        <Box p={[0.8, 1.5, 0]} s={[1.6, 3.0, 0.1]} c={color} r={0.03} />
        <Box p={[1.4, 1.5, 0.08]} s={[0.1, 0.1, 0.05]} c={handle} shadow={false} />
      </group>
      <group ref={r} position={[1.6, 0, 0]}>
        <Box p={[-0.8, 1.5, 0]} s={[1.6, 3.0, 0.1]} c={color} r={0.03} />
        <Box p={[-1.4, 1.5, 0.08]} s={[0.1, 0.1, 0.05]} c={handle} shadow={false} />
      </group>
    </group>
  );
}

const BOOK_COLORS = ['#ff6fb5', '#5ad1ff', '#ffcf5a', '#8dff9c', '#a56bff', '#ff8a5a', '#e8e1ff'];

// Front faces +z; rotate with `rot` to face another wall.
export function Bookshelf({ p, rot = 0, w = 3, h = 3.4, d = 0.8, shelf, wood }) {
  const rows = 4;
  const gap = h / rows;
  const open = useOpenProp('books', shelf);
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <PropDot position={[0, h + 0.3, 0.2]} kind="books" arg={shelf} />
      <Box p={[0, h / 2, -d / 2 + 0.05]} s={[w, h, 0.1]} c={wood || "#2a1f4d"} />
      <Box p={[-w / 2 + 0.05, h / 2, 0]} s={[0.1, h, d]} c={wood || "#33265a"} />
      <Box p={[w / 2 - 0.05, h / 2, 0]} s={[0.1, h, d]} c={wood || "#33265a"} />
      {Array.from({ length: rows + 1 }).map((_, i) => <Box key={i} p={[0, i * gap + 0.05, 0]} s={[w, 0.1, d]} c={wood || "#33265a"} />)}
      {Array.from({ length: rows }).map((_, row) => {
        const n = Math.floor((w - 0.3) / 0.3);
        return Array.from({ length: n }).map((__, i) => {
          const seed = row * 31 + i * 17;
          const bh = 0.5 + ((seed * 7) % 5) * 0.08;
          return <Box key={`${row}-${i}`} p={[-w / 2 + 0.3 + i * 0.3, row * gap + 0.1 + bh / 2, 0]} s={[0.22, bh, d * 0.6]} c={BOOK_COLORS[seed % BOOK_COLORS.length]} shadow={false} />;
        });
      })}
    </group>
  );
}

export function Arcade({ p, rot = 0, color = NEON_CYAN }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 1.1, 0]} s={[1.2, 2.2, 1.0]} c="#1a1530" r={0.06} />
      <Box p={[0, 2.3, 0.05]} s={[1.2, 0.4, 0.9]} c="#241c4a" />
      <Neon p={[0, 2.3, 0.52]} s={[1.0, 0.22, 0.03]} color={color} />
      <mesh position={[0, 1.55, 0.51]}><planeGeometry args={[0.95, 0.7]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <Box p={[0, 0.95, 0.5]} s={[1.1, 0.12, 0.5]} c="#2f2358" />
      <Box p={[-0.25, 1.05, 0.58]} s={[0.1, 0.1, 0.1]} c="#ff4fd8" r={0.04} />
      <Box p={[0.15, 1.05, 0.58]} s={[0.1, 0.1, 0.1]} c="#ffd36b" r={0.04} />
      <Box p={[0.35, 1.05, 0.58]} s={[0.1, 0.1, 0.1]} c="#3ee8ff" r={0.04} />
    </group>
  );
}

export function WallWindow({ p, rot = 0, w = 3, h = 1.8, color = '#8fd3ff', frame = '#241c4a' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0, 0]} s={[w + 0.3, h + 0.3, 0.12]} c={frame} />
      <mesh position={[0, 0, 0.07]}><planeGeometry args={[w, h]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <Box p={[0, 0, 0.09]} s={[0.07, h, 0.04]} c={frame} shadow={false} />
      <Box p={[0, 0, 0.09]} s={[w, 0.07, 0.04]} c={frame} shadow={false} />
    </group>
  );
}

export function WallPanel({ p, rot = 0, w = 0.85, h = 1.5, color }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0, 0]} s={[w, h, 0.08]} c="#171230" />
      <Neon p={[0, 0, 0.07]} s={[w - 0.3, h - 0.35, 0.02]} color={color} />
    </group>
  );
}

export function Rug({ p, w, d, c = '#43357f', c2 = '#5846a0' }) {
  return (
    <group position={p}>
      <Box p={[0, 0.03, 0]} s={[w, 0.06, d]} c={c} r={0.02} rough={1} shadow={false} />
      <Box p={[0, 0.065, 0]} s={[w - 0.6, 0.02, d - 0.6]} c={c2} r={0.01} rough={1} shadow={false} />
    </group>
  );
}

export function Table({ p, w = 3, d = 1.6, h = 1, c = '#3a2d66', leg = '#241c4a', rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, h, 0]} s={[w, 0.12, d]} c={c} r={0.04} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} p={[sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2)]} s={[0.14, h, 0.14]} c={leg} />
      ))}
    </group>
  );
}

// Faces +z (back at -z); rotate with `rot`.
export function Sofa({ p, rot = 0, w = 3.6, c = '#5a4bb5', back = '#4a3c9e' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.45, 0]} s={[w, 0.9, 1.5]} c={c} r={0.2} />
      <Box p={[0, 1.2, -0.6]} s={[w, 1.4, 0.4]} c={back} r={0.18} />
      <Box p={[-w / 2 + 0.2, 0.85, 0]} s={[0.4, 0.9, 1.5]} c={back} r={0.16} />
      <Box p={[w / 2 - 0.2, 0.85, 0]} s={[0.4, 0.9, 1.5]} c={back} r={0.16} />
    </group>
  );
}

// Small pill that floats over an interactive prop; only visible/clickable while
// `zone` is the room being viewed (so a house full of them stays uncluttered).
export function HotChip({ position, zone, label, icon, onClick }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  useFrame(() => {
    const el = ref.current;
    if (!el) return;
    const on = view.current.focus === zone && view.current.uiVisible !== false;
    el.style.opacity = on ? '1' : '0';
    el.style.pointerEvents = on ? 'auto' : 'none';
  });
  return (
    <ScaledHtml position={position} zIndexRange={[34, 0]}>
      <div ref={ref} style={{ transition: 'opacity .18s' }}>
        <button
          className="stay-white"
          onClick={onClick}
          onPointerDown={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
            background: 'rgba(12,10,24,0.78)', color: '#fff', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(4px)',
          }}
        >{icon}{label}</button>
      </div>
    </ScaledHtml>
  );
}

const CLOTHES = ['#ff6fb5', '#4fa8ff', '#ffcf5a', '#8dff9c', '#a56bff', '#ff8a5a', '#e8e1ff', '#3ee8ff', '#e0529f', '#f0b73a', '#5ad1ff'];

// Tap (or use the chip) to swing the doors open and see what is inside: hanging
// clothes on a rail, folded stacks and shoe boxes on shelves. Open/closed is a
// local, cosmetic state — it is not synced between people.
export function Wardrobe({ p, rot = 0, c = '#3a2d66', w = 2.0, id }) {
  const view = useContext(ViewContext);
  const left = useRef();
  const right = useRef();
  const angle = useRef(0);
  useFrame((_, dt) => {
    const want = view.current.open?.[id] ? 1.95 : 0;
    if (Math.abs(want - angle.current) < 0.002) return;
    angle.current += (want - angle.current) * (1 - Math.exp(-dt * 9));
    if (left.current) left.current.rotation.y = -angle.current;
    if (right.current) right.current.rotation.y = angle.current;
  });
  const toggle = (e) => {
    if (e?.delta > 6) return;
    e?.stopPropagation?.();
    const o = view.current.open || (view.current.open = {});
    o[id] = !o[id];
    if (o[id]) view.current.openProp?.('wardrobe', id);
  };
  const hover = (on) => () => { try { document.body.style.cursor = on ? 'pointer' : ''; } catch { /* non-browser */ } };
  const n = Math.max(4, Math.floor((w - 0.4) / 0.2));
  const door = (side) => (
    <group ref={side < 0 ? left : right} position={[side * (w / 2 - 0.04), 0, 0.6]}>
      <Box p={[-side * (w / 4 - 0.02), 1.75, 0]} s={[w / 2 - 0.04, 3.4, 0.07]} c={c} r={0.03} onClick={toggle} onPointerOver={hover(true)} onPointerOut={hover(false)} />
      <Box p={[-side * (w / 2 - 0.2), 1.75, 0.06]} s={[0.06, 0.5, 0.05]} c="#d9c48a" shadow={false} />
    </group>
  );
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <PropDot position={[0, 3.8, 0.7]} onClick={toggle} />
      <Box p={[0, 1.75, -0.55]} s={[w, 3.5, 0.1]} c="#241c4a" />
      <Box p={[-w / 2 + 0.05, 1.75, 0]} s={[0.1, 3.5, 1.2]} c={c} />
      <Box p={[w / 2 - 0.05, 1.75, 0]} s={[0.1, 3.5, 1.2]} c={c} />
      <Box p={[0, 3.45, 0]} s={[w, 0.1, 1.2]} c={c} />
      <Box p={[0, 0.05, 0]} s={[w, 0.1, 1.2]} c={c} />
      {/* hanging rail + clothes */}
      <mesh position={[0, 3.05, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, w - 0.2, 8]} /><meshStandardMaterial color="#b8bccb" metalness={0.8} roughness={0.3} /></mesh>
      {Array.from({ length: n }).map((_, i) => {
        const h = 1.1 + ((i * 7) % 4) * 0.22;
        return <Box key={i} p={[-w / 2 + 0.3 + i * ((w - 0.6) / (n - 1)), 3.0 - h / 2, 0]} s={[0.09, h, 0.55]} c={CLOTHES[i % CLOTHES.length]} shadow={false} />;
      })}
      {/* shelf: folded stacks; floor: shoe boxes */}
      <Box p={[0, 1.3, 0]} s={[w - 0.2, 0.06, 1.1]} c={c} shadow={false} />
      {[-0.55, -0.1, 0.35].map((x, i) => (
        <group key={x}>
          {[0, 1, 2, 3].slice(0, 2 + (i % 3)).map(k => <Box key={k} p={[x * (w / 2), 1.37 + k * 0.12 + 0.06, 0.05]} s={[0.55, 0.1, 0.7]} c={CLOTHES[(i * 3 + k) % CLOTHES.length]} r={0.02} shadow={false} />)}
        </group>
      ))}
      {[-0.5, 0.05, 0.55].map((x, i) => <Box key={i} p={[x * (w / 2), 0.28, 0.05]} s={[0.5, 0.3, 0.8]} c={['#c9a77a', '#e8e1ff', '#7a8cff'][i]} r={0.03} shadow={false} />)}
      {door(-1)}
      {door(1)}
    </group>
  );
}

// A framed doorway cut into a divider wall: two posts, a lintel with a neon
// strip, and a door leaf swung open against one post. `axis` follows Divider's
// convention ('x' = wall runs along x).
export function DoorFrame({ p, axis, color, doorKey }) {
  const along = axis === 'x';
  const s = (len, h, th) => (along ? [len, h, th] : [th, h, len]);
  const at = (o, y) => (along ? [o, y, 0] : [0, y, o]);
  return (
    <group position={p}>
      <Box p={at(-1.75, 1.6)} s={s(0.3, 3.2, 0.34)} c="#4a3a82" r={0.04} />
      <Box p={at(1.75, 1.6)} s={s(0.3, 3.2, 0.34)} c="#4a3a82" r={0.04} />
      <Box p={at(0, 3.3)} s={s(3.8, 0.28, 0.34)} c="#4a3a82" r={0.05} />
      <Neon p={at(0, 3.12)} s={s(3.2, 0.06, 0.1)} color={color} />
      <DoorLeaves along={along} doorKey={doorKey} color="#7a5cc4" />
    </group>
  );
}

// Html overlays (zone labels, avatar bubbles) keep a constant pixel size by
// default, which looked huge when zoomed in and tiny when zoomed out — scale
// them gently with the camera zoom instead, via a direct DOM write per frame.
export function ScaledHtml({ position, children, zIndexRange = [30, 0], pointerEvents }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const s = Math.max(0.65, Math.min(1.3, Math.sqrt(view.current.cur || 1)));
    ref.current.style.transform = `scale(${s})`;
  });
  return (
    <Html position={position} center zIndexRange={zIndexRange} pointerEvents={pointerEvents}>
      <div ref={ref} style={{ transformOrigin: 'center center' }}>{children}</div>
    </Html>
  );
}
