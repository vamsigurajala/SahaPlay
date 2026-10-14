import { Box, Neon, Plant, Tree, BeanBag, FloorLamp, TableLamp, Chair, Stool, Monitor, Bookshelf, Arcade, WallWindow, WallPanel } from './parts';
import { TV_LOCAL, TV_H, NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';

const PI = Math.PI;

// ── STUDY (x -16..-6, z -10..0) ─────────────────────────────────────────────
export function StudyBase() {
  return (
    <group>
      <WallWindow p={[-11, 2.9, -9.9]} w={3.4} h={1.9} color="#7fc4ff" />
      <WallPanel p={[-14.6, 3.1, -9.92]} color={NEON_VIOLET} />
      <WallPanel p={[-7.4, 3.1, -9.92]} color={NEON_PINK} />
      {/* two desks along the back wall, each with a monitor and chair */}
      {[-13.4, -8.6].map((x, i) => (
        <group key={x}>
          <Box p={[x, 1.0, -9.0]} s={[3.2, 0.14, 1.5]} c="#3a2d66" r={0.04} />
          <Box p={[x - 1.4, 0.5, -9.0]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
          <Box p={[x + 1.4, 0.5, -9.0]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
          <Monitor p={[x, 1.07, -9.2]} color={i ? NEON_PINK : NEON_CYAN} />
          <Box p={[x - 0.9, 1.12, -8.7]} s={[0.55, 0.05, 0.22]} c="#161226" shadow={false} />
          <Chair p={[x, 0, -7.5]} rot={PI} c={i ? '#c24fa3' : '#4f7fe0'} />
        </group>
      ))}
      {/* bookshelf wall */}
      <Bookshelf p={[-15.45, 0, -5.2]} rot={PI / 2} w={6.6} h={3.8} d={0.9} />
      {/* reading nook */}
      <Box p={[-10.6, 0.03, -3.6]} s={[5.6, 0.06, 4.2]} c="#2b5a8a" rough={1} shadow={false} />
      <Box p={[-10.6, 0.07, -3.6]} s={[5.0, 0.02, 3.6]} c="#3a72a8" rough={1} shadow={false} />
      <BeanBag p={[-11.6, 0, -3.3]} color="#f0b73a" glow={NEON_AMBER} />
      <BeanBag p={[-9.6, 0, -2.4]} color="#4fa8ff" glow={NEON_CYAN} />
      <FloorLamp p={[-12.9, 0, -2.0]} />
      <Box p={[-10.6, 0.35, -4.4]} s={[1.3, 0.7, 1.3]} c="#2f2358" r={0.1} />
      <TableLamp p={[-10.6, 0.7, -4.4]} />
      {/* globe */}
      <group position={[-7.2, 0, -5.4]}>
        <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.05, 0.05, 1.2, 8]} /><meshStandardMaterial color="#2a2140" /></mesh>
        <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.5, 20, 16]} /><meshStandardMaterial color="#3d7fe0" roughness={0.5} /></mesh>
        <mesh position={[0, 1.55, 0]} rotation={[0.4, 0, 0.3]}><torusGeometry args={[0.56, 0.025, 8, 30]} /><meshStandardMaterial color="#d9c48a" /></mesh>
      </group>
      <Plant p={[-6.9, 0, -1.1]} scale={1.2} />
      <Plant p={[-15.0, 0, -0.9]} scale={1.0} color="#34b36a" />
      <Neon p={[-11, 0.1, -9.9]} s={[9.6, 0.05, 0.05]} color={NEON_CYAN} />
    </group>
  );
}

// ── LIVING ROOM (x -6..6, z -10..0) — the TV lives here ───────────────────────
export function LivingRoomBase() {
  return (
    <group>
      {/* TV + console */}
      <Box p={[TV_LOCAL.cx, TV_LOCAL.cy, -9.94]} s={[TV_LOCAL.w + 0.35, TV_H + 0.35, 0.12]} c="#0c0b14" r={0.08} />
      <mesh position={[TV_LOCAL.cx, TV_LOCAL.cy, TV_LOCAL.z]}>
        <planeGeometry args={[TV_LOCAL.w, TV_H]} />
        <meshBasicMaterial color="#0a0a18" />
      </mesh>
      <Box p={[TV_LOCAL.cx, 0.5, -9.35]} s={[7, 1.0, 1.2]} c="#2c2150" r={0.06} />
      <Neon p={[TV_LOCAL.cx, 1.03, -8.8]} s={[6.8, 0.04, 0.04]} color={NEON_CYAN} />
      {[[-2.6, '#ffcf5a'], [-1.9, '#ff6fb5'], [2.1, '#5ad1ff'], [2.8, '#8dff9c']].map(([x, col], i) => (
        <Box key={i} p={[x, 1.25, -9.4]} s={[0.4, 0.45 + (i % 2) * 0.2, 0.4]} c={col} r={0.08} />
      ))}
      {/* wall art + shelf */}
      <WallPanel p={[-4.9, 3.2, -9.92]} color={NEON_VIOLET} />
      <WallPanel p={[-3.9, 3.2, -9.92]} color={NEON_CYAN} />
      <WallPanel p={[3.9, 3.2, -9.92]} color={NEON_PINK} />
      <WallPanel p={[4.9, 3.2, -9.92]} color={NEON_AMBER} />
      <Box p={[-4.4, 0.7, -9.3]} s={[2.0, 1.4, 1.0]} c="#2f2358" r={0.06} />
      <Box p={[4.4, 0.7, -9.3]} s={[2.0, 1.4, 1.0]} c="#2f2358" r={0.06} />
      {/* rug + L-sofa facing the TV + coffee table */}
      <Box p={[-0.4, 0.03, -4.4]} s={[8.6, 0.06, 5.8]} c="#43357f" r={0.02} rough={1} shadow={false} />
      <Box p={[-0.4, 0.065, -4.4]} s={[8.0, 0.02, 5.2]} c="#5846a0" r={0.01} rough={1} shadow={false} />
      <Box p={[-0.6, 0.45, -1.6]} s={[6.6, 0.9, 1.9]} c="#5a4bb5" r={0.2} />
      <Box p={[-0.6, 1.3, -0.75]} s={[6.6, 1.5, 0.5]} c="#4a3c9e" r={0.2} />
      {[-2.9, -0.9, 1.1].map((x, i) => <Box key={i} p={[x, 1.0, -1.7]} s={[1.7, 0.3, 1.3]} c="#7664d6" r={0.14} />)}
      <Box p={[-0.6, 0.32, -4.6]} s={[3.2, 0.5, 1.6]} c="#1d1740" r={0.08} />
      <Neon p={[-0.6, 0.6, -4.6]} s={[3.0, 0.03, 1.4]} color={NEON_CYAN} />
      {/* side tables, lamps, extra seating */}
      <Box p={[3.4, 0.4, -1.4]} s={[0.9, 0.8, 0.9]} c="#2f2358" r={0.08} />
      <TableLamp p={[3.4, 0.8, -1.4]} />
      <BeanBag p={[3.2, 0, -4.2]} color="#7a58d6" glow={NEON_CYAN} />
      <BeanBag p={[4.3, 0, -2.6]} color="#e0529f" glow={NEON_PINK} />
      <FloorLamp p={[-5.2, 0, -8.4]} />
      <FloorLamp p={[5.2, 0, -8.4]} color="#ff9ad8" />
      <Plant p={[-5.2, 0, -0.9]} scale={1.2} />
      <Plant p={[5.2, 0, -0.9]} scale={1.1} color="#38a86a" />
    </group>
  );
}

// ── BEDROOM (x 6..16, z -10..0) ─────────────────────────────────────────────
export function BedroomBase() {
  return (
    <group>
      <WallWindow p={[10.2, 3.1, -9.9]} w={3.6} h={1.7} color="#9ad7ff" />
      <Box p={[10.2, 0.03, -6.2]} s={[7, 0.06, 5.6]} c="#6a4796" rough={1} shadow={false} />
      <Box p={[10.2, 0.07, -6.2]} s={[6.4, 0.02, 5.0]} c="#7d58ad" rough={1} shadow={false} />
      {/* bed */}
      <Box p={[10.2, 0.4, -7.2]} s={[4.4, 0.8, 5.4]} c="#3b2d66" r={0.12} />
      <Box p={[10.2, 0.9, -7.1]} s={[4.2, 0.35, 5.2]} c="#efe7ff" r={0.12} />
      <Box p={[10.2, 1.12, -5.9]} s={[4.2, 0.22, 3.0]} c="#8f6bff" r={0.1} />
      <Box p={[9.3, 1.2, -9.3]} s={[1.5, 0.34, 0.8]} c="#fff" r={0.15} />
      <Box p={[11.1, 1.2, -9.3]} s={[1.5, 0.34, 0.8]} c="#fff" r={0.15} />
      <Box p={[10.2, 1.5, -9.85]} s={[4.8, 2.1, 0.22]} c="#2a1f4d" r={0.06} />
      <Neon p={[10.2, 2.65, -9.7]} s={[4.6, 0.06, 0.06]} color={NEON_PINK} />
      {/* nightstands + lamps */}
      <Box p={[7.3, 0.45, -9.3]} s={[0.95, 0.9, 0.95]} c="#2f2358" r={0.08} />
      <TableLamp p={[7.3, 0.9, -9.3]} color="#ffb4e6" />
      <Box p={[13.1, 0.45, -9.3]} s={[0.95, 0.9, 0.95]} c="#2f2358" r={0.08} />
      <TableLamp p={[13.1, 0.9, -9.3]} color="#b4e0ff" />
      {/* wardrobe */}
      <Box p={[14.95, 1.75, -9.3]} s={[2.0, 3.5, 1.2]} c="#3a2d66" r={0.05} />
      <Box p={[14.95, 1.75, -8.68]} s={[0.05, 3.2, 0.04]} c="#150f2b" shadow={false} />
      <Box p={[14.5, 1.75, -8.68]} s={[0.07, 0.5, 0.05]} c="#d9c48a" shadow={false} />
      <Box p={[15.4, 1.75, -8.68]} s={[0.07, 0.5, 0.05]} c="#d9c48a" shadow={false} />
      <Neon p={[14.95, 3.58, -8.7]} s={[1.8, 0.04, 0.04]} color={NEON_VIOLET} halo={false} />
      {/* desk + laptop + chair */}
      <Box p={[13.8, 0.9, -2.2]} s={[2.4, 0.12, 1.2]} c="#3a2d66" r={0.04} />
      <Box p={[12.7, 0.45, -2.2]} s={[0.12, 0.9, 1.0]} c="#241c4a" />
      <Box p={[14.9, 0.45, -2.2]} s={[0.12, 0.9, 1.0]} c="#241c4a" />
      <Monitor p={[13.8, 0.96, -2.45]} color={NEON_AMBER} />
      <Chair p={[13.8, 0, -0.9]} rot={PI} c="#e0529f" />
      <Plant p={[15.2, 0, -5.4]} scale={1.2} />
      <Plant p={[6.9, 0, -0.8]} scale={0.9} color="#3bbf74" />
    </group>
  );
}

// ── KITCHEN (x -16..-6, z 0..10) ────────────────────────────────────────────
export function KitchenBase() {
  const counter = '#c9c0ea';
  return (
    <group>
      {/* run of cabinets along the left wall: fridge, stove, sink, prep */}
      <Box p={[-15.2, 1.7, 1.7]} s={[1.3, 3.4, 1.4]} c="#d9d6e8" r={0.06} />
      <Box p={[-14.52, 2.4, 1.7]} s={[0.04, 1.4, 0.06]} c="#8f8aa8" shadow={false} />
      <Box p={[-14.52, 1.0, 1.7]} s={[0.04, 1.2, 0.06]} c="#8f8aa8" shadow={false} />
      <Box p={[-15.2, 0.5, 4.0]} s={[1.3, 1.0, 2.4]} c="#33265a" r={0.04} />
      <Box p={[-15.2, 1.03, 4.0]} s={[1.4, 0.07, 2.5]} c={counter} />
      {[[-0.5, -0.5], [-0.5, 0.5], [0.0, -0.5], [0.0, 0.5]].map(([dx, dz], i) => (
        <mesh key={i} position={[-15.2 + dx * 0.7, 1.09, 4.0 + dz * 0.9]} rotation={[-PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.22, 20]} /><meshBasicMaterial color={NEON_AMBER} toneMapped={false} />
        </mesh>
      ))}
      <Box p={[-15.2, 0.5, 6.4]} s={[1.3, 1.0, 2.4]} c="#33265a" r={0.04} />
      <Box p={[-15.2, 1.03, 6.4]} s={[1.4, 0.07, 2.5]} c={counter} />
      <Box p={[-15.2, 1.0, 6.4]} s={[0.9, 0.12, 1.4]} c="#1b1632" shadow={false} />
      <mesh position={[-15.5, 1.5, 6.4]}><cylinderGeometry args={[0.05, 0.05, 0.9, 8]} /><meshStandardMaterial color="#d6d2ea" /></mesh>
      <Box p={[-15.2, 0.5, 8.8]} s={[1.3, 1.0, 2.2]} c="#33265a" r={0.04} />
      <Box p={[-15.2, 1.03, 8.8]} s={[1.4, 0.07, 2.3]} c={counter} />
      <mesh position={[-15.2, 1.35, 8.4]}><cylinderGeometry args={[0.2, 0.17, 0.6, 12]} /><meshStandardMaterial color="#8fd3ff" transparent opacity={0.8} /></mesh>
      <Box p={[-15.45, 3.5, 5.6]} s={[0.8, 1.1, 5.6]} c="#3a2d66" r={0.04} />
      <Neon p={[-15.0, 2.7, 5.6]} s={[0.04, 0.04, 5.4]} color={NEON_AMBER} halo={false} />
      {/* island with stools */}
      <Box p={[-11.6, 0.55, 3.8]} s={[4.4, 1.1, 1.8]} c="#33265a" r={0.06} />
      <Box p={[-11.6, 1.14, 3.8]} s={[4.6, 0.08, 2.0]} c={counter} />
      {[-12.8, -11.6, -10.4].map(x => <Stool key={x} p={[x, 0, 5.3]} c="#e0529f" />)}
      {[-12.8, -10.4].map(x => (
        <group key={x}>
          <mesh position={[x, 3.5, 3.8]}><cylinderGeometry args={[0.015, 0.015, 2.0, 6]} /><meshBasicMaterial color="#2a2140" /></mesh>
          <mesh position={[x, 2.4, 3.8]}><sphereGeometry args={[0.32, 16, 12]} /><meshBasicMaterial color={NEON_AMBER} toneMapped={false} /></mesh>
        </group>
      ))}
      {/* dining set */}
      <Box p={[-9.4, 1.0, 8.0]} s={[3.2, 0.12, 1.9]} c="#3a2d66" r={0.04} />
      <Box p={[-10.8, 0.5, 8.0]} s={[0.14, 1.0, 1.5]} c="#241c4a" />
      <Box p={[-8.0, 0.5, 8.0]} s={[0.14, 1.0, 1.5]} c="#241c4a" />
      {[[-10.2, 6.8, 0], [-8.6, 6.8, 0], [-10.2, 9.2, PI], [-8.6, 9.2, PI]].map(([x, z, r], i) => <Chair key={i} p={[x, 0, z]} rot={r} c="#4f7fe0" />)}
      <Box p={[-9.4, 1.12, 8.0]} s={[0.6, 0.06, 0.6]} c="#ff6fb5" r={0.02} />
      <Plant p={[-6.9, 0, 9.0]} scale={1.2} />
    </group>
  );
}

// ── GAME ROOM (x -6..6, z 0..10) ────────────────────────────────────────────
export function GameRoomBase() {
  return (
    <group>
      {/* arcade row */}
      {[[-4.6, NEON_CYAN], [-3.2, NEON_PINK], [-1.8, NEON_AMBER], [3.0, NEON_VIOLET], [4.2, '#8dff9c'], [5.4, NEON_CYAN]].map(([x, col], i) => (
        <Arcade key={i} p={[x, 0, 0.95]} color={col} />
      ))}
      {/* pool table */}
      <group position={[0.2, 0, 5.6]}>
        <Box p={[0, 0.85, 0]} s={[4.6, 0.3, 2.6]} c="#3b2a1f" r={0.06} />
        <Box p={[0, 1.02, 0]} s={[4.1, 0.06, 2.1]} c="#1f8a5a" rough={1} />
        {[[-1.2, -0.5], [0.2, 0.3], [0.5, -0.4], [1.2, 0.5], [-0.3, -0.1]].map(([x, z], i) => (
          <mesh key={i} position={[x, 1.12, z]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color={['#ff4f4f', '#ffd24f', '#4f9bff', '#fff', '#b04fff'][i]} roughness={0.3} />
          </mesh>
        ))}
        {[[-2.0, -1.0], [2.0, -1.0], [-2.0, 1.0], [2.0, 1.0]].map(([x, z], i) => <Box key={i} p={[x, 0.4, z]} s={[0.25, 0.8, 0.25]} c="#2a1c14" />)}
        <Neon p={[0, 0.72, 1.32]} s={[4.4, 0.04, 0.04]} color={NEON_CYAN} halo={false} />
      </group>
      <mesh position={[0.2, 0.04, 5.6]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[3.6, 3.8, 48]} /><meshBasicMaterial color={NEON_PINK} transparent opacity={0.55} toneMapped={false} /></mesh>
      {/* chill corner with a screen */}
      <Box p={[-5.2, 0.4, 5.0]} s={[1.0, 0.8, 3.4]} c="#4a3c9e" r={0.18} />
      <BeanBag p={[-3.8, 0, 3.6]} color="#7a58d6" glow={NEON_VIOLET} />
      <BeanBag p={[-3.8, 0, 6.8]} color="#e0529f" glow={NEON_PINK} />
      <Box p={[-5.9, 2.3, 7.8]} s={[0.1, 1.6, 2.8]} c="#0e0c1c" />
      <Neon p={[-5.84, 2.3, 7.8]} s={[0.02, 1.4, 2.6]} color="#7fe9ff" halo={false} />
      {/* mini bar */}
      <Box p={[4.6, 0.6, 7.6]} s={[1.3, 1.2, 4.0]} c="#2f2358" r={0.06} />
      <Box p={[4.6, 1.24, 7.6]} s={[1.5, 0.08, 4.2]} c="#3a2d66" />
      {[6.0, 7.6, 9.2].map(z => <Stool key={z} p={[3.2, 0, z]} c="#3ee8ff" />)}
      {[[5.0, '#ff6fb5'], [5.5, '#5ad1ff'], [6.0, '#ffcf5a']].map(([x, col], i) => (
        <mesh key={i} position={[4.9, 1.6, 6.4 + i * 0.5]}><cylinderGeometry args={[0.1, 0.1, 0.5, 8]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
      ))}
      <Neon p={[5.9, 0.12, 5.0]} s={[0.05, 0.05, 9.6]} color={NEON_VIOLET} />
      <Plant p={[-5.2, 0, 9.0]} scale={1.1} />
    </group>
  );
}

// ── GARDEN + POOL (x 6..16, z 0..10) ────────────────────────────────────────
export function GardenBase() {
  return (
    <group>
      {/* stone path from the house doorway */}
      {[1.4, 2.7, 4.0, 5.3].map((z, i) => <Box key={z} p={[10.6 + (i % 2) * 0.3, 0.05, z]} s={[1.4, 0.1, 1.0]} c="#6f6a86" r={0.04} shadow={false} />)}
      {/* pool */}
      <group position={[12.4, 0, 7.2]}>
        <Box p={[0, 0.12, 0]} s={[7.4, 0.24, 4.6]} c="#6f6a86" r={0.05} />
        <Box p={[0, 0.2, 0]} s={[6.6, 0.14, 3.8]} c="#27b3ff" emissive="#27b3ff" ei={0.55} opacity={0.85} rough={0.2} shadow={false} />
        <Neon p={[0, 0.3, 0]} s={[6.5, 0.02, 3.7]} color="#6fd8ff" halo={false} />
      </group>
      {/* loungers + parasol */}
      {[8.3, 9.4].map((z, i) => (
        <group key={z} position={[8.0, 0, z + 0.4]}>
          <Box p={[0, 0.3, 0]} s={[1.8, 0.2, 0.8]} c="#efe7ff" r={0.08} />
          <Box p={[-0.7, 0.62, 0]} s={[0.6, 0.2, 0.8]} c="#efe7ff" r={0.08} rot={0} />
          <Box p={[0, 0.15, 0]} s={[1.6, 0.1, 0.6]} c="#2a2140" shadow={false} />
        </group>
      ))}
      <group position={[8.0, 0, 6.6]}>
        <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.05, 0.05, 2.4, 8]} /><meshStandardMaterial color="#2a2140" /></mesh>
        <mesh position={[0, 2.5, 0]} castShadow><coneGeometry args={[1.5, 0.7, 20]} /><meshStandardMaterial color="#ff6fb5" roughness={0.8} /></mesh>
      </group>
      {/* fire pit lounge */}
      <mesh position={[9.8, 0.05, 2.8]} rotation={[-PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.9, 32]} /><meshStandardMaterial color="#473a6e" roughness={1} /></mesh>
      <mesh position={[9.8, 0.25, 2.8]} castShadow><cylinderGeometry args={[0.5, 0.6, 0.5, 14]} /><meshStandardMaterial color="#2a2140" roughness={0.9} /></mesh>
      <mesh position={[9.8, 0.7, 2.8]}><icosahedronGeometry args={[0.3, 1]} /><meshBasicMaterial color={NEON_AMBER} toneMapped={false} /></mesh>
      <BeanBag p={[8.2, 0, 2.5]} color="#4fa8ff" glow={NEON_CYAN} />
      <BeanBag p={[11.4, 0, 2.4]} color="#a56bff" glow={NEON_VIOLET} />
      <BeanBag p={[9.8, 0, 4.4]} color="#ff7bc0" glow={NEON_PINK} />
      {/* grill + side table */}
      <Box p={[14.6, 0.55, 2.0]} s={[1.4, 1.1, 0.9]} c="#1d1740" r={0.06} />
      <Box p={[14.6, 1.2, 2.0]} s={[1.5, 0.3, 1.0]} c="#2a2140" r={0.12} />
      <Box p={[14.6, 0.8, 3.3]} s={[1.2, 0.1, 1.2]} c="#3a2d66" />
      {/* trees, bushes, low fence with lanterns along the front edge */}
      <Tree p={[15.3, 0, 1.0]} scale={0.95} />
      <Tree p={[7.0, 0, 1.0]} scale={0.8} />
      {[7.2, 15.6].map(x => <Plant key={x} p={[x, 0, 0.8]} scale={0.9} color="#34b36a" />)}
    </group>
  );
}
