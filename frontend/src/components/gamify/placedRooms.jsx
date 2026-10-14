import { Box, Neon, Plant, Tree, BeanBag, FloorLamp, TableLamp, Chair, Monitor, Bookshelf, Arcade, WallWindow, WallPanel, Rug, Table, Sofa, Wardrobe } from './parts';
import { StudyBase, LivingRoomBase, BedroomBase, GameRoomBase, GardenBase } from './rooms';
import { NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';
import { Cell } from './cell';
import { Clock, Telescope, Foosball, ClawMachine, Jhula } from './props';
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
      <Bookshelf p={[17.45, 0, 11.0]} rot={-PI / 2} w={5} h={3.8} d={0.9} />
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
      <Bookshelf p={[15.3, 0, 0.45]} w={4.4} h={3.8} d={0.8} />
      <WallPanel p={[12.6, 3.2, 0.08]} color={NEON_PINK} />
      <Rug p={[12.8, 0, 12.5]} w={6.4} d={5.6} c="#2b2a6e" c2="#3b3a8c" />
      <Sofa p={[12.8, 0, 10.6]} rot={0} w={3.8} />
      <Sofa p={[12.8, 0, 14.4]} rot={PI} w={3.8} />
      <Table p={[12.8, 0, 12.5]} w={2.4} d={1.2} h={0.5} />
      <BeanBag p={[16.4, 0, 11.8]} color="#7a58d6" glow={NEON_VIOLET} />
      <BeanBag p={[16.4, 0, 13.8]} color="#e0529f" glow={NEON_PINK} />
      <Box p={[17.1, 0.4, 9.6]} s={[0.9, 0.8, 0.9]} c="#2f2358" r={0.08} />
      <TableLamp p={[17.1, 0.8, 9.6]} />
      <BeanBag p={[1.6, 0, 12.6]} color="#4fa8ff" glow={NEON_CYAN} />
      <BeanBag p={[2.6, 0, 14.4]} color="#f0b73a" glow={NEON_AMBER} />
      <FloorLamp p={[1.0, 0, 10.8]} color="#ff9ad8" />
      <FloorLamp p={[17.0, 0, 2.6]} />
      <Plant p={[1.0, 0, 15.0]} scale={1.2} />
      <Plant p={[17.0, 0, 15.2]} scale={1.2} color="#38a86a" />
      <Plant p={[9.4, 0, 15.0]} scale={1.0} />
      <Clock p={[9.0, 4.0, 0.12]} r={0.6} />
    </Cell>
  );
}

export function Bedroom() {
  return (
    <Cell id="bedroom" base={<BedroomBase />}>
      <Wardrobe p={[11.8, 0, 0.7]} id="wd-b" />
      <Wardrobe p={[14.0, 0, 0.7]} c="#33265a" id="wd-c" />
      <Box p={[16.7, 0.6, 0.8]} s={[1.9, 1.2, 1.2]} c="#33265a" r={0.05} />
      {[16.2, 17.2].map(x => <Box key={x} p={[x, 0.8, 1.42]} s={[0.5, 0.1, 0.04]} c="#d9c48a" shadow={false} />)}
      <Neon p={[16.7, 2.5, 0.12]} s={[1.6, 1.8, 0.06]} color="#d6ecff" halo={false} />
      <Rug p={[13.4, 0, 8.8]} w={6.4} d={4.6} c="#6a4796" c2="#7d58ad" />
      <Sofa p={[13.4, 0, 7.4]} rot={0} w={3.8} c="#8f6bff" back="#7a58e0" />
      <Table p={[13.4, 0, 9.4]} w={2.0} d={1.0} h={0.5} />
      <Box p={[13.4, 0.45, 12.7]} s={[3.6, 0.9, 0.9]} c="#2f2358" r={0.06} />
      <Box p={[13.4, 1.75, 12.7]} s={[3.0, 1.6, 0.1]} c="#0c0b14" r={0.03} />
      <Neon p={[13.4, 1.75, 12.64]} s={[2.8, 1.4, 0.02]} color="#7a8cff" halo={false} />
      <Box p={[7.0, 0.04, 12.0]} s={[1.2, 0.05, 3.0]} c="#ff6fb5" r={0.02} shadow={false} />
      <BeanBag p={[9.2, 0, 13.4]} color="#5a8cff" glow={NEON_CYAN} />
      <FloorLamp p={[10.6, 0, 10.8]} color="#ffb4e6" />
      <Plant p={[1.0, 0, 14.8]} scale={1.1} color="#3bbf74" />
      <Plant p={[17.1, 0, 14.8]} scale={1.2} />
      <Bookshelf p={[0.45, 0, 12.5]} rot={PI / 2} w={3.2} h={2.8} d={0.7} />
      <Clock p={[6.6, 4.25, 0.12]} r={0.5} />
      <WallPanel p={[1.6, 3.2, 0.08]} color={NEON_AMBER} />
      <Plant p={[17.2, 0, 5.2]} scale={1.0} color="#34b36a" />
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
      <Box p={[13.0, 0.2, 4.4]} s={[3.2, 0.4, 1.2]} c="#5a3d2b" r={0.04} />
      {[11.9, 12.5, 13.1, 13.7].map((x, i) => (
        <mesh key={x} position={[x, 0.5, 4.4]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color={['#ff6fb5', '#ffcf5a', '#a56bff', '#ff8a5a'][i]} /></mesh>
      ))}
      <Tree p={[17.0, 0, 1.2]} scale={1.05} />
      <Tree p={[12.6, 0, 1.3]} scale={0.85} />
      <Tree p={[17.3, 0, 7.0]} scale={0.9} />
      <Plant p={[10.8, 0, 3.0]} scale={1.3} color="#34b36a" />
      <Plant p={[17.0, 0, 15.0]} scale={1.2} color="#34b36a" />
    </Cell>
  );
}
