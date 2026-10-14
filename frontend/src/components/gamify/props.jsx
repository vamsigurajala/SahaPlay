import { Box, Neon, Plant } from './parts';
import { NEON_CYAN, NEON_AMBER } from './constants';

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
  return (
    <group position={p} rotation={[0, rot, 0]}>
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
