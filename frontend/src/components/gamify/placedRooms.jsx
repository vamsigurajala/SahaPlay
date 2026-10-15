import { Box, Neon, Plant, Tree, BeanBag, FloorLamp, TableLamp, Chair, Monitor, Bookshelf, Arcade, WallWindow, WallPanel, Rug, Table, Sofa, Wardrobe } from './parts';
import { StudyBase, LivingRoomBase, BedroomBase, GameRoomBase, GardenBase } from './rooms';
import { NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';
import { Cell } from './cell';
import { Clock, Telescope, Foosball, ClawMachine, Jhula, Heart, Candle, Teddy, FairyLights, Curtain, RoseVase, WineGlass, Stairs, FlowerPatch, VegPatch, Hedge, Topiary, FlowerArch, Vanity, RomanticChaiseLounge, ChampagneTable, RomanticFireplace, VelvetPouf, RomanticLantern } from './props';

const ROSES = ['#d0183a', '#ff4f8a', '#ff9ac0', '#fff0f6'];
const MIXED = ['#ff6fb5', '#ffcf5a', '#a56bff', '#ff8a5a', '#ffffff', '#4fa8ff'];
const SUN = ['#f6c030', '#f0a020'];
const PURPLE = ['#9a7aff', '#c85ae0', '#e0529f'];
import IndianKitchen from './indianKitchen';

const PI = Math.PI;
export { Terrace, FrontYard, Courtyard } from './outdoorRooms';

function DeskSet({ p, mon, chair }) {
  const [x, , z] = p;
  return (
    <group>
      <Box p={[x, 1.0, z]} s={[3.2, 0.14, 1.5]} c="#3a2d66" r={0.04} />
      <Box p={[x - 1.4, 0.5, z]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
      <Box p={[x + 1.4, 0.5, z]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
      <Monitor p={[x, 1.07, z - 0.2]} color={mon} />
      <Chair p={[x, 0, z + 1.5]} rot={PI} c={chair} />
    </group>
  );
}

const Bench = ({ p, rot = 0 }) => (
  <group position={p} rotation={[0, rot, 0]}>
    <Box p={[0, 0.5, 0]} s={[2.2, 0.14, 0.7]} c="#7a5a3a" r={0.03} />
    <Box p={[0, 0.95, -0.3]} s={[2.2, 0.5, 0.1]} c="#7a5a3a" r={0.03} />
    {[-0.9, 0.9].map(x => <Box key={x} p={[x, 0.25, 0]} s={[0.14, 0.5, 0.5]} c="#2a2140" />)}
  </group>
);

export function Study() {
  return (
    <Cell id="study" base={<StudyBase />}>
      <WallWindow p={[14, 3.3, 0.1]} w={4.4} h={1.5} color="#7fc4ff" />
      <DeskSet p={[12.2, 0, 1.0]} mon={NEON_AMBER} chair="#e0529f" />
      <DeskSet p={[15.8, 0, 1.0]} mon={NEON_VIOLET} chair="#4fa8ff" />
      <Bookshelf p={[17.45, 0, 11.0]} rot={-PI / 2} w={5} h={3.8} d={0.9} shelf="study-b" />
      <Rug p={[13.4, 0, 12.0]} w={7.4} d={4.6} c="#2b5a8a" c2="#3a72a8" />
      <Table p={[13.4, 0, 12.0]} w={5.2} d={2.2} />
      {[12.0, 14.8].map(x => (
        <group key={x}>
          <Chair p={[x, 0, 10.3]} rot={0} c="#4f7fe0" />
          <Chair p={[x, 0, 13.7]} rot={PI} c="#c24fa3" />
        </group>
      ))}
      <BeanBag p={[3.0, 0, 13.0]} color="#f0b73a" glow={NEON_AMBER} />
      <BeanBag p={[4.8, 0, 14.4]} color="#4fa8ff" glow={NEON_CYAN} />
      <FloorLamp p={[1.2, 0, 11.6]} />
      <Plant p={[1.0, 0, 14.8]} scale={1.2} />
      <Plant p={[17.2, 0, 15.0]} scale={1.1} color="#34b36a" />
      <Plant p={[11.0, 0, 6.8]} scale={1.0} />
      <Clock p={[10.2, 3.6, 0.12]} />
      <Telescope p={[16.4, 0, 6.0]} rot={-0.8} />
    </Cell>
  );
}

export function LivingRoom() {
  return (
    <Cell id="hall" base={<LivingRoomBase />}>
      <Bookshelf p={[15.3, 0, 0.45]} w={4.4} h={3.8} d={0.8} shelf="hall" />
      <WallPanel p={[12.6, 3.2, 0.08]} color={NEON_PINK} />
      <Rug p={[12.8, 0, 12.5]} w={6.4} d={5.6} c="#2b2a6e" c2="#3b3a8c" />
      <Sofa p={[12.8, 0, 10.6]} rot={0} w={3.8} />
      <Sofa p={[12.8, 0, 14.4]} rot={PI} w={3.8} />
      <Table p={[12.8, 0, 12.5]} w={2.4} d={1.2} h={0.5} />
      <BeanBag p={[16.4, 0, 11.8]} color="#7a58d6" glow={NEON_VIOLET} />
      <BeanBag p={[16.4, 0, 13.8]} color="#e0529f" glow={NEON_PINK} />
      <Box p={[17.1, 0.4, 9.6]} s={[0.9, 0.8, 0.9]} c="#2f2358" r={0.08} />
      <TableLamp p={[17.1, 0.8, 9.6]} />
      <FloorLamp p={[17.0, 0, 2.6]} />
      <Stairs p={[1.5, 0, 15.7]} rot={PI / 2} c="#5a4590" dark="#3a2d66" />
      <Plant p={[4.4, 0, 15.2]} scale={1.1} />
      <Plant p={[17.0, 0, 15.2]} scale={1.2} color="#38a86a" />
      <Plant p={[9.4, 0, 15.0]} scale={1.0} />
      <Clock p={[9.0, 4.0, 0.12]} r={0.6} />
    </Cell>
  );
}

export function Bedroom() {
  return (
    <Cell id="bedroom" base={<BedroomBase />}>
      {/* Interactive wardrobes & vanity along back wall — preserved! */}
      <Wardrobe p={[11.8, 0, 0.7]} id="wd-b" />
      <Wardrobe p={[14.0, 0, 0.7]} c="#33265a" id="wd-c" />
      <Vanity p={[16.7, 0, 0.8]} />

      {/* Vanity corner enhancement: plush sheepskin rug & Hollywood vanity glow */}
      <mesh position={[16.7, 0.02, 2.0]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 20]} />
        <meshStandardMaterial color="#fff6f2" roughness={0.9} />
      </mesh>
      {/* Hollywood vanity mirror bulbs around mirror rim */}
      {Array.from({ length: 8 }).map((_, i) => {
        const ang = (i / 8) * PI * 2;
        return (
          <mesh key={`vanity-bulb-${i}`} position={[16.7 + Math.cos(ang) * 0.88, 2.5 + Math.sin(ang) * 0.88, 0.38]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color="#ffe8d6" toneMapped={false} />
          </mesh>
        );
      })}

      {/* Romantic Lounge Area: Circular Velvet Rugs, Chaise Lounge & Champagne Table */}
      <mesh position={[13.4, 0.02, 8.8]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 28]} />
        <meshStandardMaterial color="#4a2142" roughness={0.85} />
      </mesh>
      <mesh position={[13.4, 0.03, 8.8]} rotation={[-PI / 2, 0, 0]}>
        <circleGeometry args={[2.7, 28]} />
        <meshStandardMaterial color="#682c5a" roughness={0.8} />
      </mesh>
      <RomanticChaiseLounge p={[13.4, 0, 7.4]} />
      <ChampagneTable p={[13.4, 0, 9.4]} />
      <VelvetPouf p={[9.2, 0, 13.0]} />

      {/* Modern Romantic Linear Electric Fireplace Console */}
      <RomanticFireplace p={[13.4, 0, 12.7]} />

      {/* Floor Lamp in lounge corner with soft ambient glow */}
      <FloorLamp p={[10.6, 0, 10.8]} color="#ffb4e6" />

      {/* Interactive Bookshelf along left wall — preserved! */}
      <Bookshelf p={[0.45, 0, 12.5]} rot={PI / 2} w={3.2} h={2.8} d={0.7} shelf="bed" />

      {/* Romantic Brass & Glass Floor Lanterns with glowing pillar candles */}
      <RomanticLantern p={[1.2, 0, 14.2]} />
      <RomanticLantern p={[16.4, 0, 11.2]} />

      {/* Soft romantic window drapery & fairy lights */}
      <FairyLights from={0.8} to={7.6} y={4.35} z={0.22} count={18} />
      <Curtain p={[2.0, 1.55, 0.2]} w={0.7} h={2.6} color="#f5b8d0" />
      <Curtain p={[6.4, 1.55, 0.2]} w={0.7} h={2.6} color="#f5b8d0" />

      {/* Romantic Wall Art & Heart Motifs */}
      <Heart p={[0.14, 3.3, 9.4]} rot={PI / 2} scale={1.5} color="#ff4f8a" glow />
      <Heart p={[4.2, 1.5, 1.45]} rot={0.2} scale={0.7} color="#e0183a" />
      <Heart p={[7.6, 0.07, 10.8]} scale={2.1} color="#e0527a" flat thin />
      <Teddy p={[5.0, 1.24, 4.5]} rot={-0.3} scale={0.55} />

      {/* Scattered Velvet Rose Petals on the Bed */}
      {[[3.1, 3.2], [3.7, 3.9], [4.5, 3.4], [5.3, 4.0], [3.4, 4.6], [4.2, 4.2], [5.5, 2.9], [3.0, 2.4], [4.0, 3.0], [4.8, 3.6]].map(([x, z], i) => (
        <mesh key={`bed-petal-${i}`} position={[x, 1.245, z]} rotation={[-PI / 2, 0, i]}>
          <circleGeometry args={[0.11, 8]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#b5122e' : '#d81e42'} />
        </mesh>
      ))}

      {/* Seductive Rose Petal Trail across the floor */}
      {[
        [2.0, 5.0], [2.4, 5.8], [3.0, 6.4], [3.6, 7.2], [4.4, 7.8],
        [5.0, 8.6], [6.2, 9.2], [7.0, 8.5], [8.0, 7.8], [9.0, 6.8],
        [9.8, 5.5], [10.2, 4.2], [8.6, 9.8], [9.4, 10.4], [10.2, 10.0]
      ].map(([x, z], i) => (
        <mesh key={`trail-${i}`} position={[x, 0.08, z]} rotation={[-PI / 2, 0, i * 0.7]}>
          <circleGeometry args={[0.085, 6]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#b5122e' : i % 3 === 1 ? '#d81e42' : '#8b0d26'} />
        </mesh>
      ))}

      {/* Intimate Bistro Date Night Corner with Wine & Candelabra */}
      <group position={[5.6, 0, 11.4]}>
        <Table p={[0, 0, 0]} w={1.1} d={1.1} h={0.75} c="#1e1828" leg="#d4af37" />
        <RoseVase p={[0, 0.81, 0]} />
        <WineGlass p={[-0.28, 0.81, 0.2]} />
        <WineGlass p={[0.28, 0.81, -0.2]} />
        <Candle p={[0.25, 0.81, 0.25]} />
        <Candle p={[-0.25, 0.81, -0.25]} h={0.18} />
      </group>

      <Clock p={[6.6, 4.25, 0.12]} r={0.5} />
      <WallPanel p={[1.6, 3.2, 0.08]} color={NEON_AMBER} />
    </Cell>
  );
}

export function Kitchen() {
  return (
    <Cell id="kitchen">
      <IndianKitchen />
    </Cell>
  );
}

export function GameRoom() {
  return (
    <Cell id="gameroom" base={<GameRoomBase />}>
      {[[13.4, NEON_PINK], [15.0, NEON_CYAN], [16.6, NEON_AMBER]].map(([x, col], i) => (
        <Arcade key={i} p={[x, 0, 0.95]} color={col} />
      ))}
      {/* ping-pong table */}
      <group position={[14.6, 0, 7.2]}>
        <Box p={[0, 0.95, 0]} s={[4.0, 0.1, 2.2]} c="#1f6aa8" rough={0.5} />
        <Box p={[0, 1.12, 0]} s={[0.05, 0.3, 2.2]} c="#fff" shadow={false} />
        {[[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]].map(([x, z], i) => <Box key={i} p={[x, 0.45, z]} s={[0.14, 0.9, 0.14]} c="#2a2140" />)}
        <Neon p={[0, 1.0, 0]} s={[3.9, 0.02, 0.05]} color="#fff" halo={false} />
      </group>
      {/* dance floor + DJ booth */}
      <Box p={[9.0, 0.04, 13.4]} s={[6.4, 0.06, 3.6]} c="#2a1f6a" rough={0.3} shadow={false} />
      <Neon p={[9.0, 0.09, 11.6]} s={[6.4, 0.04, 0.06]} color={NEON_PINK} />
      <Neon p={[9.0, 0.09, 15.2]} s={[6.4, 0.04, 0.06]} color={NEON_CYAN} />
      <Box p={[9.0, 0.6, 15.3]} s={[3.2, 1.2, 1.0]} c="#1a1530" r={0.05} />
      <Neon p={[9.0, 1.25, 14.78]} s={[3.0, 0.05, 0.05]} color={NEON_PINK} />
      {[6.4, 11.6].map(x => <Box key={x} p={[x, 1.1, 15.2]} s={[1.0, 2.2, 1.0]} c="#120e26" r={0.05} />)}
      <mesh position={[9.0, 4.0, 13.4]}><sphereGeometry args={[0.45, 16, 12]} /><meshBasicMaterial color="#e8e1ff" toneMapped={false} /></mesh>
      <BeanBag p={[17.0, 0, 10.6]} color="#e0529f" glow={NEON_PINK} />
      <Foosball p={[6.0, 0, 9.6]} />
      <ClawMachine p={[17.0, 0, 3.2]} rot={-PI / 2} />
      <BeanBag p={[1.8, 0, 15.0]} color="#7a58d6" glow={NEON_VIOLET} />
      <FloorLamp p={[1.0, 0, 11.0]} color="#8dd8ff" />
      <Plant p={[17.1, 0, 5.4]} scale={1.1} color="#34b36a" />
      <Plant p={[10.4, 0, 9.6]} scale={1.0} />
    </Cell>
  );
}

export function Garden() {
  return (
    <Cell id="lawn" base={<GardenBase />}>
      {/* front fence with lanterns */}
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 0.6 + i * 1.68;
        return (
          <group key={i}>
            <Box p={[x, 0.35, 15.85]} s={[0.14, 0.7, 0.14]} c="#4a3a6e" />
            <mesh position={[x, 0.82, 15.85]}><sphereGeometry args={[0.1, 10, 8]} /><meshBasicMaterial color={i % 2 ? NEON_PINK : NEON_AMBER} toneMapped={false} /></mesh>
          </group>
        );
      })}
      <Box p={[9.0, 0.5, 15.85]} s={[16.8, 0.06, 0.06]} c="#4a3a6e" shadow={false} />
      {/* fountain */}
      <group position={[4.8, 0, 13.2]}>
        <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[1.9, 2.0, 0.5, 28]} /><meshStandardMaterial color="#6f6a86" roughness={0.8} /></mesh>
        <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[1.65, 1.65, 0.05, 28]} /><meshStandardMaterial color="#27b3ff" emissive="#27b3ff" emissiveIntensity={0.55} toneMapped={false} /></mesh>
        <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.2, 0.3, 0.8, 12]} /><meshStandardMaterial color="#8a84a8" /></mesh>
        <mesh position={[0, 1.5, 0]}><sphereGeometry args={[0.28, 14, 10]} /><meshBasicMaterial color="#9ae6ff" toneMapped={false} /></mesh>
      </group>
      {/* gazebo */}
      <group position={[14.6, 0, 11.6]}>
        {[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z], i) => <Box key={i} p={[x, 1.6, z]} s={[0.22, 3.2, 0.22]} c="#4a3a82" />)}
        <Box p={[0, 3.3, 0]} s={[4.8, 0.2, 4.8]} c="#5a4a9a" r={0.04} />
        <mesh position={[0, 3.95, 0]} rotation={[0, PI / 4, 0]} castShadow><coneGeometry args={[3.6, 1.2, 4]} /><meshStandardMaterial color="#ff6fb5" roughness={0.8} /></mesh>
        <Rug p={[0, 0, 0]} w={3.8} d={3.8} c="#4a3a82" c2="#5d4aa0" />
        <Table p={[0, 0, 0]} w={1.6} d={1.6} h={0.8} />
        <BeanBag p={[-1.2, 0, 1.2]} color="#4fa8ff" glow={NEON_CYAN} />
        <BeanBag p={[1.2, 0, -1.2]} color="#ff7bc0" glow={NEON_PINK} />
        <Neon p={[0, 3.12, -2]} s={[4.4, 0.05, 0.05]} color={NEON_AMBER} halo={false} />
      </group>
      <Jhula p={[10.4, 0, 6.2]} w={2.2} />
      <Bench p={[1.6, 0, 8.0]} rot={PI / 2} />
      {/* flower beds + trees */}
      <FlowerPatch p={[13.6, 0, 4.2]} w={5.0} d={1.8} n={70} colors={MIXED} seed={3} />
      <FlowerPatch p={[1.6, 0, 12.0]} w={1.7} d={4.2} n={44} colors={SUN} tall={1.1} head={0.28} seed={4} />
      <FlowerPatch p={[8.6, 0, 9.2]} w={2.6} d={1.4} n={36} colors={ROSES} tall={0.7} seed={5} />
      <FlowerPatch p={[16.3, 0, 9.0]} w={1.5} d={3.4} n={36} colors={PURPLE} tall={0.8} seed={6} />
      <VegPatch p={[9.3, 0, 13.2]} />
      <Hedge p={[9.3, 0, 15.2]} w={3.8} flowers="#ff6fb5" />
      <Hedge p={[17.4, 0, 12.4]} w={4.2} rot={PI / 2} flowers="#ffcf5a" />
      <Topiary p={[4.6, 0, 5.4]} scale={0.9} />
      <Topiary p={[4.6, 0, 8.0]} scale={0.9} />
      <FlowerArch p={[4.6, 0, 10.4]} rot={PI / 2} />
      <Tree p={[17.0, 0, 1.2]} scale={1.05} />
      <Tree p={[12.6, 0, 1.3]} scale={0.85} />
      <Tree p={[17.3, 0, 7.0]} scale={0.9} />
      <Plant p={[10.8, 0, 3.0]} scale={1.3} color="#34b36a" />
      <Plant p={[17.0, 0, 15.0]} scale={1.2} color="#34b36a" />
    </Cell>
  );
}
