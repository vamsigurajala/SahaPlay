import { createContext, useContext, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { NEON_CYAN } from './constants';

// Shared, mutable camera/view state ({ zoom, cur, tx, tz, flip }) provided
// inside the Canvas — read from refs in useFrame so nothing here ever
// triggers a React re-render while panning or zooming.
export const ViewContext = createContext({ current: { cur: 1, flip: false } });

export function Box({ p, s, c, r = 0, emissive, ei = 1, rough = 0.75, shadow = true, rot = 0, opacity }) {
  const material = (
    <meshStandardMaterial
      color={c}
      roughness={rough}
      emissive={emissive || '#000'}
      emissiveIntensity={emissive ? ei : 0}
      transparent={opacity != null}
      opacity={opacity ?? 1}
      toneMapped={!emissive}
    />
  );
  if (r > 0.001) {
    return (
      <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2 - 0.001)} smoothness={3} position={p} rotation={[0, rot, 0]} castShadow={shadow} receiveShadow>
        {material}
      </RoundedBox>
    );
  }
  return (
    <mesh position={p} rotation={[0, rot, 0]} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
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

const BOOK_COLORS = ['#ff6fb5', '#5ad1ff', '#ffcf5a', '#8dff9c', '#a56bff', '#ff8a5a', '#e8e1ff'];

// Front faces +z; rotate with `rot` to face another wall.
export function Bookshelf({ p, rot = 0, w = 3, h = 3.4, d = 0.8 }) {
  const rows = 4;
  const gap = h / rows;
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, h / 2, -d / 2 + 0.05]} s={[w, h, 0.1]} c="#2a1f4d" />
      <Box p={[-w / 2 + 0.05, h / 2, 0]} s={[0.1, h, d]} c="#33265a" />
      <Box p={[w / 2 - 0.05, h / 2, 0]} s={[0.1, h, d]} c="#33265a" />
      {Array.from({ length: rows + 1 }).map((_, i) => <Box key={i} p={[0, i * gap + 0.05, 0]} s={[w, 0.1, d]} c="#33265a" />)}
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

export function WallWindow({ p, rot = 0, w = 3, h = 1.8, color = '#8fd3ff' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0, 0]} s={[w + 0.3, h + 0.3, 0.12]} c="#241c4a" />
      <mesh position={[0, 0, 0.07]}><planeGeometry args={[w, h]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <Box p={[0, 0, 0.09]} s={[0.07, h, 0.04]} c="#241c4a" shadow={false} />
      <Box p={[0, 0, 0.09]} s={[w, 0.07, 0.04]} c="#241c4a" shadow={false} />
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
