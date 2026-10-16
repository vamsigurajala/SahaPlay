import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Neon, Plant, Tree, BeanBag, FloorLamp, TableLamp, Chair, Monitor, Keyboard, Dustbin, Bookshelf, Arcade, WallWindow, WallPanel, Rug, Table, Sofa, Wardrobe, useOpenProp } from './parts';
import { StudyBase, LivingRoomBase, BedroomBase, GameRoomBase, GardenBase } from './rooms';
import { NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';
import { Cell } from './cell';
import { Playable, PoolTable, PingPongTable, MiniBar, DjStation, ConsoleCorner, ScoreBoard, TrophyShelf, GameSign } from './gameRoom';
import { Clock, RealTimeClock, Telescope, Foosball, ClawMachine, Jhula, Heart, Candle, Teddy, FairyLights, Curtain, RoseVase, WineGlass, Stairs, FlowerPatch, VegPatch, Hedge, Topiary, FlowerArch, Vanity, RomanticChaiseLounge, ChampagneTable, RomanticFireplace, VelvetPouf, RomanticLantern, ReadingArmchair, ReadingLamp, LoungeTableItems, PuzzleTableSet } from './props';

const ROSES = ['#d0183a', '#ff4f8a', '#ff9ac0', '#fff0f6'];
const MIXED = ['#ff6fb5', '#ffcf5a', '#a56bff', '#ff8a5a', '#ffffff', '#4fa8ff'];
const SUN = ['#f6c030', '#f0a020'];
const PURPLE = ['#9a7aff', '#c85ae0', '#e0529f'];
import IndianKitchen from './indianKitchen';
import DogPet3D from './DogPet3D';

const PI = Math.PI;
export { FrontYard, Courtyard } from './outdoorRooms';
export { Veranda } from './veranda';

function DeskSet({ p, mon, chair }) {
  const [x, , z] = p;
  return (
    <group>
      <Box p={[x, 1.0, z]} s={[3.2, 0.14, 1.5]} c="#3a2d66" r={0.04} />
      <Box p={[x - 1.4, 0.5, z]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
      <Box p={[x + 1.4, 0.5, z]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
      <Monitor p={[x, 1.07, z - 0.2]} color={mon} />
      <Keyboard p={[x, 1.08, z + 0.25]} />
      <Dustbin p={[x + 1.85, 0, z]} />
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

      {/* Table with 3 chairs and playable puzzle games */}
      <Rug p={[13.4, 0, 12.0]} w={7.4} d={4.6} c="#2b5a8a" c2="#3a72a8" />
      <Table p={[13.4, 0, 12.0]} w={5.2} d={2.2} />
      {/* 3 chairs around the puzzle table */}
      <Chair p={[12.0, 0, 10.3]} rot={0} c="#4f7fe0" />
      <Chair p={[14.8, 0, 10.3]} rot={0} c="#4f7fe0" />
      <Chair p={[13.4, 0, 13.7]} rot={PI} c="#c24fa3" />
      {/* Playable puzzle board & Rubik's cube on the table */}
      <PuzzleTableSet p={[13.4, 1.05, 12.0]} />

      <BeanBag p={[3.0, 0, 13.0]} color="#f0b73a" glow={false} />
      <BeanBag p={[4.8, 0, 14.4]} color="#4fa8ff" glow={false} />
      <Clock p={[10.2, 3.6, 0.12]} />
    </Cell>
  );
}

export function LivingRoom({ weather }) {
  return (
    <Cell id="hall" base={<LivingRoomBase weather={weather} />}>
      {/* Bookshelf along the wall */}
      <Bookshelf p={[15.3, 0, 0.45]} w={4.4} h={3.8} d={0.8} shelf="hall" />

      {/* Reading Nook near Bookshelf: one lamp and a cozy chair */}
      <ReadingLamp p={[12.6, 0, 2.6]} />
      <ReadingArmchair p={[12.6, 0, 1.4]} rot={PI / 4} />

      {/* Functioning luxury RealTimeClock depicting actual system/mobile time, positioned between TV and bookshelf */}
      <RealTimeClock p={[10.9, 3.5, 0.12]} r={0.7} />

      {/* Expanded second conversation lounge */}
      <Rug p={[12.8, 0, 12.5]} w={7.2} d={6.0} c="#2b2a6e" c2="#3b3a8c" />
      <Sofa p={[12.8, 0, 10.4]} rot={0} w={4.6} />
      <Sofa p={[12.8, 0, 14.6]} rot={PI} w={4.6} />
      <Table p={[12.8, 0, 12.5]} w={3.0} d={1.4} h={0.5} />
      {/* Coffee table items: stack of magazines, TV remote, ceramic coffee mugs on coasters, succulent, glass carafe */}
      <LoungeTableItems p={[12.8, 0.52, 12.5]} />

      <BeanBag p={[16.6, 0, 11.8]} color="#7a58d6" glow={false} />
      <BeanBag p={[16.6, 0, 13.8]} color="#e0529f" glow={false} />

      {/* Stairs to upstairs */}
      <Stairs p={[1.5, 0, 15.7]} rot={PI / 2} c="#5a4590" dark="#3a2d66" />
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

      {/* Teddy on the bed */}
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

// The Game Room: every table, cabinet and screen opens a game you can play against the
// computer (see ./games). Coordinates are cell-local (x from the left wall, z from the back wall).
const ARCADES = [
  [1.4, NEON_CYAN, 'snake'], [2.8, NEON_PINK, 'breakout'], [4.2, NEON_AMBER, 'tetris'],
  [9.0, NEON_VIOLET, 'invaders'], [10.2, '#8dff9c', 'flappy'], [11.4, NEON_CYAN, 'g2048'],
  [13.4, NEON_PINK, 'whack'], [15.0, NEON_CYAN, 'mines'], [16.6, NEON_AMBER, 'connect4'],
];

export function GameRoom() {
  return (
    <Cell id="gameroom" base={<GameRoomBase />}>
      {ARCADES.map(([x, col, game]) => (
        <Playable key={game} game={game} dot={[x, 3.15, 0.95]}>
          <Arcade p={[x, 0, 0.95]} color={col} />
        </Playable>
      ))}
      <GameSign p={[6.6, 3.55, 0.12]} />
      <FairyLights from={0.6} to={17.4} y={4.15} z={0.3} count={22} sag={0.4} />
      <Neon p={[9.0, 0.12, 0.14]} s={[17.6, 0.05, 0.05]} color="#ffb86b" halo={false} />
      <PoolTable p={[6.2, 0, 5.6]} />
      <mesh position={[6.2, 0.04, 5.6]} rotation={[-PI / 2, 0, 0]}><ringGeometry args={[3.6, 3.8, 48]} /><meshBasicMaterial color={NEON_PINK} transparent opacity={0.45} toneMapped={false} /></mesh>
      <PingPongTable p={[14.6, 0, 7.2]} />
      <Playable game="foosball" dot={[6.0, 2.3, 9.6]}><Foosball p={[6.0, 0, 9.6]} /></Playable>
      <Playable game="claw" dot={[17.0, 4.0, 3.2]}><ClawMachine p={[17.0, 0, 3.2]} rot={-PI / 2} /></Playable>
      <MiniBar p={[10.6, 0, 8.4]} />
      <ConsoleCorner />
      <ScoreBoard p={[0.14, 2.7, 3.7]} />
      <TrophyShelf p={[17.86, 2.5, 10.0]} />
      {/* dance floor + DJ */}
      <Box p={[9.0, 0.04, 13.2]} s={[6.4, 0.06, 3.4]} c="#2a1f6a" rough={0.3} shadow={false} />
      <Neon p={[9.0, 0.09, 11.6]} s={[6.4, 0.04, 0.06]} color={NEON_PINK} />
      <Neon p={[9.0, 0.09, 14.8]} s={[6.4, 0.04, 0.06]} color={NEON_CYAN} />
      <DjStation p={[9.0, 0, 15.3]} />
      <mesh position={[9.0, 4.6, 13.2]}><cylinderGeometry args={[0.012, 0.012, 1.6, 4]} /><meshBasicMaterial color="#9a96b8" /></mesh>
      <mesh position={[9.0, 3.7, 13.2]}><icosahedronGeometry args={[0.36, 1]} /><meshBasicMaterial color="#e8e1ff" toneMapped={false} /></mesh>
      <BeanBag p={[17.0, 0, 10.8]} color="#e0529f" glow={NEON_PINK} />
      <BeanBag p={[1.8, 0, 14.6]} color="#7a58d6" glow={NEON_VIOLET} />
      <FloorLamp p={[1.0, 0, 11.2]} color="#ffb86b" />
      <FloorLamp p={[17.2, 0, 14.6]} color="#ffb86b" />
      <Plant p={[17.1, 0, 5.8]} scale={1.1} color="#34b36a" />
      <Plant p={[0.9, 0, 3.4]} scale={1.0} />
      <Plant p={[12.4, 0, 1.2]} scale={0.9} />
    </Cell>
  );
}

// Animated 3D Swimming & Splashing Koi Fish inside the Pond
function PondKoiFish({ index, orbitR = 1.3, speed = 1.2, color = '#ffffff', patch = '#ef4444' }) {
  const fishRef = useRef();
  const splashRef = useRef();
  const [splashing, setSplashing] = useState(false);

  useFrame((_, delta) => {
    if (!fishRef.current) return;
    const time = Date.now() * 0.001 * speed + index * (Math.PI / 2);
    const fx = Math.cos(time) * orbitR;
    const fz = Math.sin(time) * orbitR;

    // Periodic splash / leap jump
    const leapPhase = (time * 0.4) % (Math.PI * 2);
    const isLeaping = leapPhase > 5.5 && leapPhase < 6.1;
    const leapY = isLeaping ? Math.sin((leapPhase - 5.5) / 0.6 * Math.PI) * 0.22 : 0;

    if (isLeaping && !splashing) setSplashing(true);
    if (!isLeaping && splashing) setSplashing(false);

    fishRef.current.position.set(fx, 0.25 + leapY, fz);
    // Heading tangent to circle
    fishRef.current.rotation.y = -time + Math.PI / 2;
    // Body / tail swish
    fishRef.current.rotation.z = Math.sin(time * 8) * 0.15;
  });

  return (
    <group ref={fishRef}>
      {/* Streamlined Koi Body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.045, 0.065, 0.28, 8]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      {/* Characteristic color patch on back */}
      <mesh position={[0, 0.035, 0.02]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={patch} roughness={0.35} />
      </mesh>
      {/* Swishing caudal tail fin */}
      <mesh position={[0, 0, -0.16]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.05, 0.12, 4]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} roughness={0.4} />
      </mesh>
      {/* Side pectoral fins */}
      <mesh position={[-0.05, -0.01, 0.04]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.06, 0.01, 0.05]} />
        <meshStandardMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.05, -0.01, 0.04]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.06, 0.01, 0.05]} />
        <meshStandardMaterial color={color} transparent opacity={0.8} />
      </mesh>

      {/* Splash ring when leaping */}
      {splashing && (
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.18, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

// Serene Small Stone Pond with sparkling clear water, swimming/splashing Koi, and click-to-view aquarium
function SmallStonePond({ p = [10.5, 0, 8.2], r = 2.2 }) {
  const [x, y, z] = p;
  const openAquarium = useOpenProp('pond');

  const stones = useMemo(() => [
    { a: 0, col: '#6e6882' }, { a: 0.39, col: '#7d7694' }, { a: 0.78, col: '#5f5973' },
    { a: 1.18, col: '#8a83a0' }, { a: 1.57, col: '#6e6882' }, { a: 1.96, col: '#7d7694' },
    { a: 2.35, col: '#5f5973' }, { a: 2.75, col: '#8a83a0' }, { a: 3.14, col: '#6e6882' },
    { a: 3.53, col: '#7d7694' }, { a: 3.93, col: '#5f5973' }, { a: 4.32, col: '#8a83a0' },
    { a: 4.71, col: '#6e6882' }, { a: 5.10, col: '#7d7694' }, { a: 5.50, col: '#5f5973' },
    { a: 5.89, col: '#8a83a0' },
  ], []);

  return (
    <group position={[x, y, z]} {...openAquarium}>
      {/* Stone pond basin base */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r + 0.22, r + 0.28, 0.2, 32]} />
        <meshStandardMaterial color="#4a445d" roughness={0.9} />
      </mesh>

      {/* River stone coping rim */}
      {stones.map((s, i) => {
        const sr = r + 0.14 + (i % 2 === 0 ? 0.08 : -0.04);
        const sx = Math.cos(s.a) * sr;
        const sz = Math.sin(s.a) * sr;
        return (
          <mesh key={i} position={[sx, 0.2, sz]} rotation={[0, s.a, 0]} castShadow>
            <sphereGeometry args={[0.22, 12, 10]} />
            <meshStandardMaterial color={s.col} roughness={0.85} />
          </mesh>
        );
      })}

      {/* VIBRANT, CRYSTALLINE AQUAMARINE POND WATER (clearly visible above stone rim) */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[r, r, 0.05, 32]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.65}
          roughness={0.06}
          metalness={0.15}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Shimmering surface water ripple rings */}
      <mesh position={[0, 0.278, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.48, 24]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0.278, 0]} rotation={[-PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.96, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
      </mesh>

      {/* Small center bubbling rock */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 0.16, 10]} />
        <meshStandardMaterial color="#645e78" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshBasicMaterial color="#e0f2fe" />
      </mesh>

      {/* SWIMMING & SPLASHING 3D KOI FISH */}
      <PondKoiFish index={0} orbitR={1.3} speed={1.2} color="#ffffff" patch="#ef4444" />
      <PondKoiFish index={1} orbitR={1.0} speed={1.4} color="#f59e0b" patch="#fbbf24" />
      <PondKoiFish index={2} orbitR={1.5} speed={1.0} color="#ffffff" patch="#18181b" />
      <PondKoiFish index={3} orbitR={0.7} speed={1.5} color="#ea580c" patch="#fdba74" />

      {/* Water Lily Pads & Floating Lotus Blossoms */}
      {[
        [-0.9, 0.26, -0.6, 0.32, 0.4],
        [0.8, 0.26, -0.5, 0.28, 1.8],
        [-0.5, 0.26, 0.8, 0.35, 3.2],
        [0.9, 0.26, 0.6, 0.26, 4.6],
      ].map(([lx, ly, lz, lr, rot], idx) => (
        <group key={idx} position={[lx, ly, lz]} rotation={[0, rot, 0]}>
          <mesh rotation={[-PI / 2, 0, 0]}>
            <circleGeometry args={[lr, 16, 0, PI * 1.85]} />
            <meshStandardMaterial color={idx % 2 ? '#2d6a4f' : '#40916c'} roughness={0.65} />
          </mesh>
          {idx % 2 === 0 && (
            <group position={[0.08, 0.08, 0]}>
              <mesh position={[0, 0.04, 0]}>
                <coneGeometry args={[0.1, 0.12, 6]} />
                <meshStandardMaterial color={idx === 0 ? '#ffb3c6' : '#ffffff'} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.08, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshBasicMaterial color="#fef08a" />
              </mesh>
            </group>
          )}
        </group>
      ))}

      {/* Flat river stepping stones alongside the pond edge */}
      {[
        [-r - 0.4, 0.05, 0.3, 0.45],
        [-r - 0.5, 0.05, -0.5, 0.4],
        [-r - 0.2, 0.05, -1.2, 0.42],
        [r + 0.3, 0.05, -0.6, 0.4],
        [r + 0.4, 0.05, 0.4, 0.44],
      ].map(([sx, sy, sz, sr], i) => (
        <mesh key={`step-${i}`} position={[sx, sy, sz]} rotation={[-PI / 2, 0, i * 0.4]}>
          <circleGeometry args={[sr, 12]} />
          <meshStandardMaterial color="#68627c" roughness={0.9} />
        </mesh>
      ))}

      {/* Floating indicator tag above pond */}
      <group position={[0, 1.0, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>
    </group>
  );
}

// Romantic Couple's Garden Lounge Nook for peaceful talks
function CoupleLoungeNook({ p = [2.8, 0, 8.2] }) {
  const [x, y, z] = p;
  return (
    <group position={[x, y, z]}>
      {/* Wooden Trellis Pergola Frame */}
      {[[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]].map(([px, pz], i) => (
        <Box key={i} p={[px, 1.5, pz]} s={[0.12, 3.0, 0.12]} c="#5c3a1e" r={0.02} />
      ))}
      {/* Top Arched Lattice Trellis */}
      <Box p={[0, 3.05, 0]} s={[3.1, 0.1, 1.6]} c="#7a4d26" r={0.03} />
      {[-0.5, 0, 0.5].map((offZ, idx) => (
        <Box key={idx} p={[0, 3.12, offZ]} s={[3.0, 0.06, 0.08]} c="#8f5b2e" />
      ))}

      {/* Romantic Hanging Fairy Lanterns */}
      {[-0.9, 0.9].map((lx, idx) => (
        <group key={idx} position={[lx, 2.7, 0]}>
          <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.01, 0.01, 0.25, 4]} /><meshBasicMaterial color="#332" /></mesh>
          <mesh position={[0, -0.04, 0]}><sphereGeometry args={[0.1, 10, 8]} /><meshBasicMaterial color="#ffb347" toneMapped={false} /></mesh>
          <pointLight position={[0, -0.04, 0]} color="#ffe0a0" intensity={25} distance={5} decay={2} />
        </group>
      ))}

      {/* Comfortable Double Love-Seat Sofa Cushion */}
      <Box p={[0, 0.38, 0]} s={[2.4, 0.45, 1.1]} c="#ede9fe" r={0.12} />
      {/* Backrest Cushion */}
      <Box p={[0, 0.85, -0.42]} s={[2.4, 0.65, 0.24]} c="#ddd6fe" r={0.1} />

      {/* Couple Accent Throw Pillows */}
      <Box p={[-0.6, 0.75, -0.32]} s={[0.55, 0.45, 0.2]} c="#ff758f" r={0.08} rot={0.1} />
      <Box p={[0.6, 0.75, -0.32]} s={[0.55, 0.45, 0.2]} c="#fef08a" r={0.08} rot={-0.1} />

      {/* Small Chic Round Tea Table between/in front */}
      <group position={[0, 0, 1.15]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.5, 20]} />
          <meshStandardMaterial color="#7a4d26" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.51, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.04, 20]} />
          <meshStandardMaterial color="#8f5b2e" roughness={0.6} />
        </mesh>
        {/* Two hot ceramic teacups with steam */}
        {[-0.14, 0.14].map((tx, idx) => (
          <group key={idx} position={[tx, 0.58, 0]}>
            <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.05, 0.035, 0.09, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.2} /></mesh>
            <mesh position={[0, 0.07, 0]}><sphereGeometry args={[0.02, 6, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.6} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// Dog Agility Play Bridge (slanted approach, elevated deck, slanted exit ramp)
function DogAgilityBridge({ p = [6.4, 0, 4.8] }) {
  const [x, y, z] = p;
  return (
    <group position={[x, y, z]}>
      {/* Elevated center platform */}
      <Box p={[0, 0.38, 0]} s={[1.4, 0.1, 0.75]} c="#93c5fd" r={0.04} />
      {/* Bridge legs */}
      {[[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].map(([lx, lz], i) => (
        <Box key={i} p={[lx, 0.19, lz]} s={[0.08, 0.38, 0.08]} c="#3b82f6" />
      ))}
      {/* Left Incline Ramp */}
      <group position={[-1.1, 0.19, 0]} rotation={[0, 0, -0.32]}>
        <Box p={[0, 0, 0]} s={[0.9, 0.08, 0.7]} c="#60a5fa" r={0.03} />
        {/* Anti-slip cleats */}
        {[-0.2, 0.2].map((cx, idx) => (
          <Box key={idx} p={[cx, 0.05, 0]} s={[0.04, 0.02, 0.6]} c="#1d4ed8" />
        ))}
      </group>
      {/* Right Decline Ramp */}
      <group position={[1.1, 0.19, 0]} rotation={[0, 0, 0.32]}>
        <Box p={[0, 0, 0]} s={[0.9, 0.08, 0.7]} c="#60a5fa" r={0.03} />
        {/* Anti-slip cleats */}
        {[-0.2, 0.2].map((cx, idx) => (
          <Box key={idx} p={[cx, 0.05, 0]} s={[0.04, 0.02, 0.6]} c="#1d4ed8" />
        ))}
      </group>
      {/* Colorful guide posts */}
      {[-0.65, 0.65].map((px, idx) => (
        <mesh key={idx} position={[px, 0.55, 0.36]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#f43f5e" />
        </mesh>
      ))}
    </group>
  );
}

export function Garden() {
  return (
    <Cell id="lawn" base={<GardenBase />}>
      {/* Front fence with soft lanterns */}
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

      {/* Serene Small Stone Pond with crystal-clear water, swimming/splashing Koi fish, and click-to-view aquarium */}
      <SmallStonePond p={[10.5, 0, 8.2]} r={2.2} />

      {/* Romantic Couple's Garden Lounge Nook for peaceful conversations */}
      <CoupleLoungeNook p={[2.8, 0, 8.2]} />

      {/* Dog Agility Play Bridge (dog runs up, across, and down!) */}
      <DogAgilityBridge p={[6.4, 0, 4.8]} />

      {/* Dog Play Toys on the Lawn */}
      {/* Neon Yellow Tennis Ball */}
      <mesh position={[8.6, 0.1, 4.0]} castShadow>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshStandardMaterial color="#eab308" roughness={0.4} />
      </mesh>
      {/* Red Chew Bone */}
      <group position={[9.4, 0.04, 4.3]} rotation={[0, 0.4, 0]}>
        <Box p={[0, 0, 0]} s={[0.22, 0.05, 0.07]} c="#ef4444" r={0.02} />
        {[-0.1, 0.1].map(bx => (
          <mesh key={bx} position={[bx, 0, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        ))}
      </group>
      {/* Braided Tug Rope */}
      <Box p={[7.4, 0.04, 3.8]} s={[0.35, 0.05, 0.06]} c="#8b5cf6" r={0.02} rot={-0.3} />

      {/* Small neat plants around pond (bonsai, succulents, mini planters) */}
      <Plant p={[7.6, 0, 7.0]} scale={0.65} color="#38bdf8" pot="#d97706" />
      <Plant p={[13.4, 0, 6.8]} scale={0.7} color="#34d399" pot="#7c3aed" />
      <Plant p={[8.0, 0, 9.8]} scale={0.6} color="#4ade80" pot="#2563eb" />
      <Plant p={[13.2, 0, 9.6]} scale={0.7} color="#a3e635" pot="#c026d3" />

      {/* Delicate low flower borders with subtle lavender & daisies */}
      <FlowerPatch p={[9.0, 0, 4.8]} w={2.4} d={0.7} n={12} colors={['#ffffff', '#a78bfa', '#ec4899']} seed={7} tall={0.35} />
      <FlowerPatch p={[12.0, 0, 11.6]} w={2.4} d={0.7} n={12} colors={['#fde047', '#fb923c', '#ffffff']} seed={8} tall={0.35} />

      {/* Warm Ambient Garden Lantern */}
      <FloorLamp p={[1.6, 0, 5.6]} color="#ffe0a0" />

      {/* PET HOUSE MOVED TO TOP-RIGHT CORNER (dog trots inside and rests!) */}
      <group position={[14.2, 0, 3.2]} rotation={[0, -0.6, 0]}>
        {/* Wooden Cabin Walls */}
        <Box p={[0, 0.7, 0]} s={[1.5, 1.25, 1.5]} c="#7c4a1e" r={0.04} />
        {/* Slanted Gabled Roof */}
        <mesh position={[0, 1.55, 0]} rotation={[0, PI / 4, 0]} castShadow>
          <coneGeometry args={[1.4, 0.65, 4]} />
          <meshStandardMaterial color="#b45309" roughness={0.7} />
        </mesh>
        {/* Spacious Entrance Doorway Cutout */}
        <Box p={[0, 0.5, 0.71]} s={[0.65, 0.9, 0.1]} c="#1e1106" />
        {/* Cozy Soft Bed Cushion inside doghouse */}
        <Box p={[0, 0.08, 0]} s={[1.1, 0.12, 1.0]} c="#a855f7" r={0.06} />
        {/* Soft porch mat in front */}
        <Box p={[0, 0.04, 0.95]} s={[0.95, 0.06, 0.6]} c="#8b5cf6" r={0.04} />
        {/* Silver dog food & water bowl with bone outside doorway */}
        <mesh position={[0.75, 0.1, 0.9]}>
          <cylinderGeometry args={[0.18, 0.14, 0.14, 14]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.75, 0.16, 0.9]}>
          <cylinderGeometry args={[0.15, 0.15, 0.02, 14]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
        <Box p={[0.75, 0.06, 1.2]} s={[0.22, 0.06, 0.08]} c="#fef08a" r={0.02} rot={0.3} />
      </group>

      {/* Ultra-Cute 3D Animated Dog with multi-phase adventure (pond -> agility bridge -> toys -> inside doghouse!) */}
      <DogPet3D />
    </Cell>
  );
}
