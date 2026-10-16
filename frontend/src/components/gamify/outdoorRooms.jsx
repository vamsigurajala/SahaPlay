import { Box, Neon, Plant, Tree, BeanBag, Rug, Table, Stool, FloorLamp, useOpenProp, PropDot } from './parts';
import { Cell } from './cell';
import { Charpai, Car, Scooter, Jhula, LampPost, Diya, Rangoli, Pillar, Telescope, Planter, LotusPond, Banana } from './props';

const MARIGOLD = ['#f0a020', '#ff8a2a', '#f6c030'];
const PINKS = ['#ff6fb5', '#ffffff', '#e0529f', '#a56bff'];
import { NEON_PINK, NEON_VIOLET, NEON_AMBER } from './constants';

const PI = Math.PI;

// Row 3 of the house — authored in cell-local (u, v) like the other extras.

export function Terrace() {
  return (
    <Cell id="terrace">
      {/* low parapet on the open edges */}
      <Box p={[9, 0.4, 15.85]} s={[18, 0.8, 0.3]} c="#a8896a" r={0.03} />
      {/* charpai lounge */}
      <Rug p={[4.2, 0, 6.4]} w={6.2} d={7.6} c="#d0592a" c2="#e8844a" />
      <Charpai p={[4.2, 0, 4.2]} cushion="#ff6fb5" />
      <Charpai p={[4.2, 0, 8.6]} cushion="#3ee8ff" />
      {/* chai table */}
      <Table p={[8.0, 0, 6.4]} w={1.4} d={1.4} h={0.7} c="#8a5a34" leg="#4a2f1a" />
      <mesh position={[8.0, 0.95, 6.4]}><cylinderGeometry args={[0.16, 0.2, 0.32, 12]} /><meshStandardMaterial color="#c8ccd6" metalness={0.85} roughness={0.3} /></mesh>
      {[-0.3, 0.3].map(dx => <mesh key={dx} position={[8.0 + dx, 0.82, 6.9]}><cylinderGeometry args={[0.09, 0.07, 0.12, 10]} /><meshStandardMaterial color="#f4f1e8" /></mesh>)}
      <Stool p={[8.0, 0, 5.2]} c="#d0592a" />
      <Stool p={[8.0, 0, 7.6]} c="#2f8f9d" />
      {/* jhula (swing) */}
      <Jhula p={[13.4, 0, 12.4]} />
      {/* telescope + water tank */}
      <Telescope p={[15.6, 0, 4.0]} rot={0.6} />
      <group position={[16.4, 0, 1.8]}>
        {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => <Box key={i} p={[x, 0.5, z]} s={[0.12, 1.0, 0.12]} c="#6f6a86" />)}
        <Box p={[0, 1.05, 0]} s={[1.4, 0.1, 1.4]} c="#6f6a86" />
        <mesh position={[0, 1.95, 0]} castShadow><cylinderGeometry args={[0.7, 0.7, 1.6, 20]} /><meshStandardMaterial color="#22212c" roughness={0.6} /></mesh>
        <mesh position={[0, 2.8, 0]}><cylinderGeometry args={[0.5, 0.7, 0.2, 20]} /><meshStandardMaterial color="#22212c" roughness={0.6} /></mesh>
      </group>
      {/* clothes line */}
      {[2.0, 9.6].map(x => <mesh key={x} position={[x, 1.2, 13.6]}><cylinderGeometry args={[0.05, 0.05, 2.4, 6]} /><meshStandardMaterial color="#6f6a86" /></mesh>)}
      <mesh position={[5.8, 2.3, 13.6]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.012, 0.012, 7.6, 4]} /><meshBasicMaterial color="#cfd3de" /></mesh>
      {[[2.8, '#ff6fb5', 1.2], [3.8, '#4fa8ff', 1.5], [5.0, '#ffcf5a', 1.1], [6.1, '#8dff9c', 1.4], [7.4, '#e0529f', 1.2], [8.5, '#f4f1e8', 1.0]].map(([x, c, h], i) => (
        <Box key={i} p={[x, 2.3 - h / 2, 13.6]} s={[0.7, h, 0.05]} c={c} shadow={false} />
      ))}
      {/* planters */}
      {[1.0, 2.4, 3.8].map((z, i) => <Planter key={z} p={[0.9, 0, 10.6 + i * 1.3]} scale={0.9} color={i % 2 ? '#34b36a' : '#2f9e5a'} />)}
      {[12.8, 14.2, 15.6].map(x => <Planter key={x} p={[x, 0, 15.2]} scale={0.9} />)}
      <BeanBag p={[14.6, 0, 7.4]} color="#d0592a" glow={NEON_AMBER} />
      <FloorLamp p={[1.2, 0, 1.6]} />
    </Cell>
  );
}

export function FrontYard() {
  return (
    <Cell id="frontyard">
      {/* driveway + paving */}
      <Box p={[9, 0.02, 9]} s={[5.0, 0.04, 14]} c="#3a3a48" shadow={false} rough={0.9} />
      <Box p={[9, 0.045, 9]} s={[0.12, 0.02, 12]} c="#f4e6a8" shadow={false} />
      <Car p={[13.6, 0, 11.4]} rot={-PI / 2 + 0.15} />
      <Scooter p={[3.4, 0, 12.0]} rot={0.4} />
      {/* compound wall + gate pillars (exit door) */}
      <Box p={[3.6, 0.9, 15.8]} s={[7.2, 1.8, 0.4]} c="#d9c9a8" r={0.03} />
      <Box p={[14.4, 0.9, 15.8]} s={[7.2, 1.8, 0.4]} c="#d9c9a8" r={0.03} />
      <Box p={[3.6, 1.85, 15.8]} s={[7.4, 0.12, 0.5]} c="#a8896a" />
      <Box p={[14.4, 1.85, 15.8]} s={[7.4, 0.12, 0.5]} c="#a8896a" />
      {[7.3, 10.7].map(x => (
        <group key={x}>
          <Box p={[x, 1.4, 15.8]} s={[0.7, 2.8, 0.7]} c="#c9a77a" r={0.05} />
          <Box p={[x, 2.9, 15.8]} s={[0.9, 0.2, 0.9]} c="#a8896a" />
          <mesh position={[x, 3.25, 15.8]}><sphereGeometry args={[0.28, 12, 10]} /><meshBasicMaterial color={NEON_AMBER} toneMapped={false} /></mesh>
        </group>
      ))}
      {[7.9, 8.5].map(x => <Box key={x} p={[x - 0.2, 1.0, 15.8]} s={[0.06, 2.0, 0.06]} c="#1d1b2a" metal={0.6} />)}
      {[10.1, 9.5].map(x => <Box key={x} p={[x + 0.2, 1.0, 15.8]} s={[0.06, 2.0, 0.06]} c="#1d1b2a" metal={0.6} />)}
      <Neon p={[9.0, 3.5, 15.8]} s={[3.4, 0.12, 0.12]} color={NEON_PINK} />
      {/* lamp posts, trees, mailbox, mat */}
      <LampPost p={[2.0, 0, 14.6]} />
      <LampPost p={[16.0, 0, 14.6]} />
      <Tree p={[1.8, 0, 3.0]} scale={1.0} />
      <Tree p={[11.4, 0, 2.2]} scale={0.85} />
      <Box p={[6.2, 0.55, 13.4]} s={[0.5, 0.7, 0.4]} c="#d0392b" r={0.05} />
      <Box p={[6.2, 0.2, 13.4]} s={[0.1, 0.4, 0.1]} c="#2a2140" />
      <Rug p={[9.0, 0, 3.4]} w={3.2} d={1.6} c="#2f8f9d" c2="#4fb0bd" />
      {[3.0, 15.0].map(x => <Plant key={x} p={[x, 0, 11.0]} scale={1.1} pot="#c46a3a" />)}
      <Plant p={[1.0, 0, 15.0]} scale={1.2} color="#34b36a" />
      <Plant p={[17.0, 0, 15.0]} scale={1.2} color="#34b36a" />
    </Cell>
  );
}

export function Courtyard() {
  const openHerbs = useOpenProp('garden', 'herbs');
  return (
    <Cell id="courtyard">
      {/* corner pillars */}
      {[[1.6, 1.6], [16.4, 1.6], [1.6, 14.4], [16.4, 14.4]].map(([x, z], i) => <Pillar key={i} p={[x, 0, z]} />)}
      {/* tulsi vrindavan */}
      <group position={[12.0, 0, 9.6]} {...openHerbs}>
        <PropDot position={[0, 2.8, 0]} kind="garden" arg="herbs" />
        <Box p={[0, 0.2, 0]} s={[1.6, 0.4, 1.6]} c="#d9c9a8" r={0.03} />
        <Box p={[0, 0.6, 0]} s={[1.2, 0.4, 1.2]} c="#c9a77a" r={0.03} />
        <Box p={[0, 1.0, 0]} s={[0.9, 0.4, 0.9]} c="#d9c9a8" r={0.03} />
        <Plant p={[0, 1.2, 0]} scale={0.9} color="#3aa862" pot="#c46a3a" />
        <Neon p={[0, 1.22, 0.5]} s={[0.4, 0.05, 0.05]} color={NEON_AMBER} halo={false} />
      </group>
      {[[10.9, 10.8], [13.1, 10.8], [10.9, 8.4], [13.1, 8.4]].map(([x, z], i) => <Diya key={i} p={[x, 0, z]} />)}
      <Rangoli p={[7.0, 0, 11.4]} r={1.7} />
      <Rangoli p={[14.4, 0, 3.6]} r={1.1} />
      {/* swing, cot, kuan (well) */}
      <Jhula p={[4.4, 0, 12.8]} w={2.2} />
      <Charpai p={[14.4, 0, 13.6]} cushion="#a56bff" />
      <group position={[15.0, 0, 6.0]}>
        <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.9, 1.0, 1.0, 18]} /><meshStandardMaterial color="#a8896a" roughness={0.9} /></mesh>
        <mesh position={[0, 1.01, 0]}><cylinderGeometry args={[0.7, 0.7, 0.04, 18]} /><meshStandardMaterial color="#1b6a9a" emissive="#1b6a9a" emissiveIntensity={0.4} /></mesh>
        {[-0.8, 0.8].map(x => <Box key={x} p={[x, 1.6, 0]} s={[0.1, 1.2, 0.1]} c="#7a4a1a" />)}
        <Box p={[0, 2.25, 0]} s={[1.9, 0.1, 0.12]} c="#7a4a1a" />
      </group>
      <LotusPond p={[5.8, 0, 4.6]} r={2.0} />
      <Banana p={[1.3, 0, 2.6]} scale={1.1} />
      <Banana p={[17.0, 0, 9.4]} scale={1.0} />
      {/* Clean, neat small potted plants around courtyard */}
      <Planter p={[10.8, 0, 2.6]} scale={0.9} color="#34b36a" />
      <Planter p={[16.0, 0, 3.2]} scale={0.9} color="#2f9e5a" />
      <Planter p={[2.4, 0, 7.4]} scale={0.9} color="#34b36a" />
      <Planter p={[1.0, 0, 11.4]} scale={1.0} />
      <Planter p={[17.0, 0, 11.0]} scale={1.0} color="#3bbf74" />
      <Planter p={[8.6, 0, 15.0]} scale={1.0} />
      <BeanBag p={[9.6, 0, 6.4]} color="#d0592a" glow={NEON_VIOLET} />
    </Cell>
  );
}
