import { Box, Neon, Plant, Chair, Table, Rug, FloorLamp, WallWindow, useOpenProp } from './parts';
import { NEON_AMBER, NEON_CYAN } from './constants';

const PI = Math.PI;
const STEEL = '#cfd3de';
const GRANITE = '#1d1b2a';
const CREAM = '#e8d9bd';
const WOOD = '#8a5a34';

const Steel = ({ args, p, rot, scale, color = STEEL }) => (
  <mesh position={p} rotation={rot} scale={scale} castShadow>
    <cylinderGeometry args={args} />
    <meshStandardMaterial color={color} metalness={0.85} roughness={0.28} />
  </mesh>
);

const Pot = ({ p, r = 0.35, h = 0.4, color = STEEL }) => (
  <group position={p}>
    <Steel p={[0, h / 2, 0]} args={[r, r * 0.9, h, 18]} color={color} />
    <mesh position={[r + 0.08, h * 0.7, 0]}><boxGeometry args={[0.22, 0.05, 0.06]} /><meshStandardMaterial color="#2a2140" /></mesh>
    <mesh position={[-r - 0.08, h * 0.7, 0]}><boxGeometry args={[0.22, 0.05, 0.06]} /><meshStandardMaterial color="#2a2140" /></mesh>
  </group>
);

const Flame = ({ p }) => (
  <mesh position={p}><coneGeometry args={[0.06, 0.14, 8]} /><meshBasicMaterial color="#5ab8ff" toneMapped={false} /></mesh>
);

// Cell-local (u from left wall, v from back wall) Indian-style kitchen: gas hob
// with chimney, LPG cylinder, masala dabba, tawa/kadhai/pressure cooker, mixer
// grinder, microwave, double-door fridge, RO purifier, matka, chakla-belan board,
// steel thali dining set and a jute mat.
export default function IndianKitchen({ natural = false }) {
  const openFridge = useOpenProp('fridge');
  const openStove = useOpenProp('stove');
  const openOven = useOpenProp('oven');
  return (
    <group>
      {/* backsplash tiles behind both counter runs */}
      <Box p={[3.4, 1.6, 0.18]} s={[5.8, 1.2, 0.06]} c="#f2e6cf" shadow={false} />
      <Box p={[3.4, 1.9, 0.2]} s={[5.8, 0.18, 0.04]} c="#2f8f9d" shadow={false} />
      <Box p={[14.2, 1.6, 0.18]} s={[6.8, 1.2, 0.06]} c="#f2e6cf" shadow={false} />
      <Box p={[14.2, 1.9, 0.2]} s={[6.8, 0.18, 0.04]} c="#2f8f9d" shadow={false} />

      {/* ── cooking run (left of the north door) ── */}
      <Box p={[3.4, 0.5, 0.95]} s={[5.8, 1.0, 1.3]} c={CREAM} r={0.03} />
      <Box p={[3.4, 1.04, 0.95]} s={[5.9, 0.08, 1.4]} c={GRANITE} rough={0.25} metal={0.2} />
      {[-1.3, -0.4, 0.5, 1.4].map((dx, i) => <Box key={i} p={[3.4 + dx, 0.5, 1.62]} s={[0.85, 0.85, 0.03]} c="#d6c3a0" shadow={false} />)}
      {/* gas hob + kadhai + tawa — tap to choose what to cook */}
      <group {...openStove}>
      <Box p={[2.2, 1.1, 0.95]} s={[1.7, 0.06, 0.85]} c={STEEL} metal={0.8} rough={0.3} />
      {[[-0.4, 0], [0.4, 0]].map(([dx], i) => (
        <group key={i}>
          <mesh position={[2.2 + dx, 1.15, 0.95]}><torusGeometry args={[0.2, 0.035, 8, 20]} /><meshStandardMaterial color="#111" metalness={0.5} /></mesh>
          <Flame p={[2.2 + dx + 0.12, 1.2, 0.95]} /><Flame p={[2.2 + dx - 0.12, 1.2, 0.95]} /><Flame p={[2.2 + dx, 1.2, 1.07]} />
        </group>
      ))}
      {[-0.55, -0.15, 0.25, 0.65].map((dx, i) => <mesh key={i} position={[2.2 + dx, 1.16, 1.4]}><cylinderGeometry args={[0.04, 0.04, 0.05, 8]} /><meshStandardMaterial color="#222" /></mesh>)}
      {/* kadhai (round-bottom wok) and tawa */}
      <mesh position={[1.8, 1.32, 0.95]} castShadow>
        <sphereGeometry args={[0.4, 18, 10, 0, PI * 2, PI / 2, PI / 2]} />
        <meshStandardMaterial color="#26222f" metalness={0.6} roughness={0.4} side={2} />
      </mesh>
      <mesh position={[2.6, 1.17, 0.95]}><cylinderGeometry args={[0.42, 0.42, 0.04, 22]} /><meshStandardMaterial color="#141218" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[3.15, 1.17, 0.95]}><boxGeometry args={[0.5, 0.05, 0.07]} /><meshStandardMaterial color="#141218" /></mesh>
      </group>
      {/* pressure cooker + masala dabba + utensils */}
      <Pot p={[4.6, 1.08, 0.9]} r={0.36} h={0.55} />
      <Steel p={[4.6, 1.68, 0.9]} args={[0.38, 0.36, 0.1, 18]} />
      <Steel p={[4.6, 1.78, 0.9]} args={[0.05, 0.05, 0.1, 8]} color="#c0392b" />
      <Steel p={[5.5, 1.14, 0.9]} args={[0.26, 0.26, 0.14, 16]} />
      {[0, 1, 2, 3, 4, 5].map(k => <mesh key={k} position={[5.5 + Math.cos(k * PI / 3) * 0.14, 1.23, 0.9 + Math.sin(k * PI / 3) * 0.14]}><cylinderGeometry args={[0.06, 0.06, 0.04, 8]} /><meshStandardMaterial color={['#e0b020', '#d04a2a', '#7a4a1a', '#2f8f4a', '#d04a2a', '#e0b020'][k]} /></mesh>)}
      {/* chimney */}
      <Box p={[2.2, 3.6, 0.7]} s={[1.9, 0.5, 1.1]} c={STEEL} metal={0.8} rough={0.3} r={0.04} />
      <Box p={[2.2, 4.3, 0.4]} s={[0.55, 1.2, 0.5]} c={STEEL} metal={0.8} rough={0.3} />
      {!natural && <Neon p={[2.2, 3.33, 0.9]} s={[1.5, 0.03, 0.03]} color={NEON_AMBER} halo={false} />}
      {/* wall cabinets + spice shelf */}
      <Box p={[5.2, 3.2, 0.45]} s={[2.4, 1.3, 0.7]} c={CREAM} r={0.03} />
      <Box p={[0.9, 3.2, 0.45]} s={[0.8, 1.3, 0.7]} c={CREAM} r={0.03} />
      <Box p={[3.4, 2.4, 0.3]} s={[2.0, 0.06, 0.4]} c={WOOD} shadow={false} />
      {[2.6, 2.95, 3.3, 3.65, 4.0].map((x, i) => <Steel key={x} p={[x - 0.4, 2.54, 0.3]} args={[0.1, 0.1, 0.22, 10]} color={['#d04a2a', '#e0b020', '#7a4a1a', '#2f8f4a', '#c0a060'][i]} />)}
      {/* LPG cylinder */}
      <mesh position={[6.2, 0.5, 2.6]} castShadow><cylinderGeometry args={[0.34, 0.34, 1.0, 16]} /><meshStandardMaterial color="#c0392b" roughness={0.5} /></mesh>
      <mesh position={[6.2, 1.07, 2.6]}><sphereGeometry args={[0.34, 16, 8, 0, PI * 2, 0, PI / 2]} /><meshStandardMaterial color="#c0392b" roughness={0.5} /></mesh>
      <Steel p={[6.2, 1.25, 2.6]} args={[0.08, 0.08, 0.14, 8]} color="#222" />

      {/* ── sink / appliance run (right of the north door) ── */}
      <Box p={[14.2, 0.5, 0.95]} s={[6.8, 1.0, 1.3]} c={CREAM} r={0.03} />
      <Box p={[14.2, 1.04, 0.95]} s={[6.9, 0.08, 1.4]} c={GRANITE} rough={0.25} metal={0.2} />
      {[-2.6, -1.6, -0.6, 0.4, 1.4, 2.4].map((dx, i) => <Box key={i} p={[14.2 + dx, 0.5, 1.62]} s={[0.85, 0.85, 0.03]} c="#d6c3a0" shadow={false} />)}
      {/* sink + tap + dish rack */}
      <Box p={[12.2, 1.07, 0.95]} s={[1.5, 0.08, 0.9]} c="#8f95a8" metal={0.8} rough={0.3} />
      <Box p={[12.2, 1.03, 0.95]} s={[1.2, 0.04, 0.7]} c="#4a4f60" shadow={false} />
      <Steel p={[12.2, 1.4, 0.45]} args={[0.04, 0.04, 0.7, 8]} />
      <mesh position={[12.2, 1.74, 0.62]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.36, 8]} /><meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.3} /></mesh>
      <Box p={[13.4, 1.4, 0.8]} s={[0.9, 0.04, 0.5]} c="#9aa0b3" metal={0.7} shadow={false} />
      {[-0.3, -0.1, 0.1, 0.3].map(dx => <mesh key={dx} position={[13.4 + dx, 1.6, 0.8]}><cylinderGeometry args={[0.2, 0.2, 0.03, 14]} /><meshStandardMaterial color="#f4f1e8" /></mesh>)}
      {/* microwave / OTG — tap to watch something bake */}
      <group {...openOven}>
      <Box p={[15.0, 1.4, 0.9]} s={[1.3, 0.7, 0.85]} c="#1c1a28" r={0.04} />
      <Box p={[14.85, 1.4, 1.33]} s={[0.85, 0.5, 0.03]} c="#1a2a45" emissive="#1a3a6a" ei={0.5} shadow={false} />
      {!natural && <Neon p={[15.5, 1.4, 1.34]} s={[0.12, 0.45, 0.02]} color={NEON_CYAN} halo={false} />}
      </group>
      {/* mixer grinder */}
      <Steel p={[16.2, 1.25, 0.9]} args={[0.26, 0.3, 0.38, 16]} color="#c0392b" />
      <mesh position={[16.2, 1.7, 0.9]}><cylinderGeometry args={[0.24, 0.2, 0.55, 16]} /><meshStandardMaterial color="#d8f0ff" transparent opacity={0.55} /></mesh>
      {/* RO purifier on the wall */}
      <Box p={[13.2, 2.7, 0.4]} s={[0.9, 1.1, 0.4]} c="#f4f6ff" r={0.06} />
      {!natural && <Neon p={[13.2, 2.5, 0.62]} s={[0.5, 0.05, 0.02]} color="#4fc3ff" halo={false} />}
      <Box p={[11.2, 3.3, 0.45]} s={[1.6, 1.3, 0.7]} c={CREAM} r={0.03} />
      <Box p={[15.3, 3.3, 0.45]} s={[3.6, 1.3, 0.7]} c={CREAM} r={0.03} />
      {/* double-door fridge — tap to look inside */}
      <group {...openFridge}>
      <Box p={[17.1, 1.85, 1.0]} s={[1.3, 3.7, 1.4]} c="#dfe3ee" r={0.06} metal={0.3} rough={0.35} />
      <Box p={[17.1, 2.4, 1.72]} s={[1.28, 0.03, 0.04]} c="#8f95a8" shadow={false} />
      <Box p={[16.65, 2.9, 1.74]} s={[0.05, 0.9, 0.06]} c="#8f95a8" shadow={false} />
      <Box p={[16.65, 1.3, 1.74]} s={[0.05, 1.2, 0.06]} c="#8f95a8" shadow={false} />
      {['#ff6fb5', '#ffcf5a', '#4fa8ff'].map((col, i) => <Box key={col} p={[17.4 - i * 0.28, 3.1 + (i % 2) * 0.2, 1.73]} s={[0.14, 0.14, 0.03]} c={col} shadow={false} />)}
      </group>

      {/* ── left wall: pantry, prep counter with chakla-belan, matka ── */}
      <WallWindow p={[0.1, 3.2, 9.5]} rot={PI / 2} w={3.0} h={1.5} color="#ffe3a8" />
      <Box p={[0.9, 1.95, 4.6]} s={[1.3, 3.9, 2.0]} c={CREAM} r={0.04} />
      <Box p={[1.56, 1.95, 4.6]} s={[0.03, 3.6, 0.04]} c="#8a7a5a" shadow={false} />
      {[0.8, 1.9, 3.0].map(y => <Box key={y} p={[1.57, y + 0.4, 4.0]} s={[0.04, 0.15, 0.6]} c="#c9b48a" shadow={false} />)}
      <Box p={[0.9, 0.5, 7.4]} s={[1.3, 1.0, 3.2]} c={CREAM} r={0.03} />
      <Box p={[0.9, 1.04, 7.4]} s={[1.4, 0.08, 3.3]} c={GRANITE} rough={0.25} metal={0.2} />
      <mesh position={[1.0, 1.1, 7.0]} castShadow><cylinderGeometry args={[0.5, 0.5, 0.04, 22]} /><meshStandardMaterial color="#b88a5a" roughness={0.8} /></mesh>
      <mesh position={[1.0, 1.17, 7.0]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.035, 0.035, 0.6, 8]} /><meshStandardMaterial color="#6b4a2f" /></mesh>
      <Steel p={[1.0, 1.2, 8.3]} args={[0.3, 0.2, 0.22, 16]} />
      <mesh position={[1.0, 1.28, 8.3]}><sphereGeometry args={[0.24, 12, 8, 0, PI * 2, 0, PI / 2]} /><meshStandardMaterial color="#f4ecd8" /></mesh>
      {/* matka (clay water pot) on a stand */}
      <group position={[1.0, 0, 11.6]}>
        {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z], i) => <Box key={i} p={[x, 0.55, z]} s={[0.08, 1.1, 0.08]} c="#2a2140" />)}
        <Box p={[0, 1.1, 0]} s={[1.0, 0.06, 1.0]} c="#3a2d66" />
        <mesh position={[0, 1.55, 0]} scale={[1, 0.95, 1]} castShadow><sphereGeometry args={[0.42, 18, 14]} /><meshStandardMaterial color="#c46a3a" roughness={0.9} /></mesh>
        <mesh position={[0, 1.98, 0]}><cylinderGeometry args={[0.2, 0.26, 0.14, 14]} /><meshStandardMaterial color="#b85a2c" roughness={0.9} /></mesh>
        <Steel p={[0.4, 1.4, 0]} args={[0.03, 0.03, 0.2, 6]} rot={[0, 0, PI / 2]} />
      </group>

      {/* ── dining: wooden table, steel thalis, jute mat ── */}
      <Rug p={[9.2, 0, 8.4]} w={6.8} d={4.8} c="#a9875a" c2="#c6a577" />
      <Table p={[9.2, 0, 8.4]} w={4.4} d={2.2} c={WOOD} leg="#4a2f1a" />
      {[-1.4, -0.45, 0.5, 1.4].map((dx, i) => (
        <group key={i}>
          <Steel p={[9.2 + dx, 1.08, i % 2 ? 7.8 : 9.0]} args={[0.32, 0.32, 0.03, 20]} />
          <Steel p={[9.2 + dx + 0.12, 1.15, i % 2 ? 7.8 : 9.0]} args={[0.1, 0.08, 0.08, 10]} />
          <Steel p={[9.2 + dx - 0.12, 1.15, i % 2 ? 7.8 : 9.0]} args={[0.1, 0.08, 0.08, 10]} />
        </group>
      ))}
      <Steel p={[9.2, 1.4, 8.4]} args={[0.15, 0.15, 0.6, 12]} />
      <Steel p={[8.4, 1.25, 8.4]} args={[0.14, 0.12, 0.3, 12]} />
      {[7.6, 9.2].map(x => (
        <group key={x}>
          <Chair p={[x - 0.8, 0, 6.6]} rot={0} c="#2f8f9d" />
          <Chair p={[x - 0.8, 0, 10.2]} rot={PI} c="#d0592a" />
        </group>
      ))}
      <Box p={[12.3, 0.4, 8.4]} s={[0.9, 0.8, 0.9]} c={WOOD} r={0.04} />
      {[0, 1, 2].map(i => <Steel key={i} p={[12.3, 0.88 + i * 0.1, 8.4]} args={[0.28 - i * 0.03, 0.28 - i * 0.03, 0.1, 14]} />)}
      {/* peeda stools + vegetable crate */}
      {[[4.0, 10.6], [5.2, 11.4]].map(([x, z], i) => <Steel key={i} p={[x, 0.22, z]} args={[0.3, 0.3, 0.44, 12]} color="#b0773f" />)}
      <Box p={[3.4, 0.25, 14.0]} s={[1.3, 0.5, 0.9]} c="#a9875a" r={0.04} />
      {[[-0.4, '#d0392b'], [0, '#3aa862'], [0.4, '#f0a020']].map(([dx, col], i) => (
        <mesh key={i} position={[3.4 + dx, 0.6, 14.0]}><sphereGeometry args={[0.22, 10, 8]} /><meshStandardMaterial color={col} roughness={0.6} /></mesh>
      ))}
      <Plant p={[1.0, 0, 14.8]} scale={1.1} pot="#c46a3a" color="#3aa862" />
      <Plant p={[17.2, 0, 15.0]} scale={1.2} color="#3bbf74" />
      <FloorLamp p={[6.6, 0, 14.8]} />
    </group>
  );
}
