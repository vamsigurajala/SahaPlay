import { Box, Neon, Plant, Tree, BeanBag, FloorLamp, TableLamp, Chair, Stool, Monitor, Keyboard, Dustbin, Bookshelf, Arcade, WallWindow, WallPanel, Wardrobe } from './parts';
import { TV_LOCAL, TV_H, NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';
import { RomanticCanopyBed, BedBench, RomanticNightstand, ScenicWeatherWindow, SnackPlatter, HiFiSpeaker, SoundBar, TrioTVLights, FramedArt, MonaLisaPainting, WallGuitar, CuteTreeVase, StudyCenterLamp } from './props';

const PI = Math.PI;

// ── STUDY (x -16..-6, z -10..0) ─────────────────────────────────────────────
export function StudyBase() {
  return (
    <group>
      {/* Clean clear daylight window with no colored panels */}
      <WallWindow p={[-11, 2.9, -9.9]} w={3.4} h={1.9} color="#7fc4ff" />

      {/* Two desks along the back wall, each with a clickable monitor, keyboard, and dustbin */}
      {[-13.4, -8.6].map((x, i) => (
        <group key={x}>
          <Box p={[x, 1.0, -9.0]} s={[3.2, 0.14, 1.5]} c="#3a2d66" r={0.04} />
          <Box p={[x - 1.4, 0.5, -9.0]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
          <Box p={[x + 1.4, 0.5, -9.0]} s={[0.14, 1.0, 1.3]} c="#241c4a" />
          <Monitor p={[x, 1.07, -9.2]} color={i ? NEON_PINK : NEON_CYAN} />
          <Keyboard p={[x, 1.08, -8.72]} />
          <Dustbin p={[x + 1.85, 0, -9.0]} />
          <Chair p={[x, 0, -7.5]} rot={PI} c={i ? '#c24fa3' : '#4f7fe0'} />
        </group>
      ))}

      {/* Bookshelf wall */}
      <Bookshelf p={[-15.45, 0, -5.2]} rot={PI / 2} w={6.6} h={3.8} d={0.9} shelf="study-a" />

      {/* Acoustic guitar securely attached to the left room wall, separated from bookshelf */}
      <WallGuitar p={[-15.88, 2.3, 0.4]} rot={PI / 2} />

      {/* Cute tree vases on the floor: bottom-left and bottom-right of the guitar */}
      <CuteTreeVase p={[-15.3, 0, -0.4]} potColor="#3ee8ff" leavesColor="#2ecc71" />
      <CuteTreeVase p={[-15.3, 0, 1.2]} potColor="#ff70a6" leavesColor="#27ae60" />

      {/* Center Reading Nook Carpet */}
      <Box p={[-10.6, 0.03, -3.6]} s={[5.6, 0.06, 4.2]} c="#2b5a8a" rough={1} shadow={false} />
      <Box p={[-10.6, 0.07, -3.6]} s={[5.0, 0.02, 3.6]} c="#3a72a8" rough={1} shadow={false} />

      {/* Small center coffee table on carpet with warm study reading lamp (replaces flower vase) */}
      <Box p={[-10.6, 0.35, -3.6]} s={[1.4, 0.7, 1.4]} c="#2f2358" r={0.1} />
      <StudyCenterLamp p={[-10.6, 0.7, -3.6]} />

      {/* Couch bags (beanbags) placed around 3 sides of the center table */}
      <BeanBag p={[-12.4, 0, -3.6]} color="#f0b73a" glow={false} />
      <BeanBag p={[-8.8, 0, -3.6]} color="#4fa8ff" glow={false} />
      <BeanBag p={[-10.6, 0, -2.1]} color="#a56bff" glow={false} />

      <Neon p={[-11, 0.1, -9.9]} s={[9.6, 0.05, 0.05]} color={NEON_CYAN} />
    </group>
  );
}

// ── LIVING ROOM (x -6..6, z -10..0) — the TV lives here ───────────────────────
export function LivingRoomBase({ weather = 'night' }) {
  return (
    <group>
      {/* TV Screen + Frame */}
      <Box p={[TV_LOCAL.cx, TV_LOCAL.cy, -9.94]} s={[TV_LOCAL.w + 0.35, TV_H + 0.35, 0.12]} c="#0c0b14" r={0.08} />
      <mesh position={[TV_LOCAL.cx, TV_LOCAL.cy, TV_LOCAL.z]}>
        <planeGeometry args={[TV_LOCAL.w, TV_H]} />
        <meshBasicMaterial color="#0a0a18" />
      </mesh>

      {/* TV Console Table */}
      <Box p={[TV_LOCAL.cx, 0.5, -9.35]} s={[7.2, 1.0, 1.2]} c="#1e1830" r={0.06} />
      <Neon p={[TV_LOCAL.cx, 1.03, -8.8]} s={[7.0, 0.04, 0.04]} color={NEON_CYAN} />

      {/* Realistic HiFi Speakers flanking TV + SoundBar underneath with vivid Neon accents */}
      <HiFiSpeaker p={[-3.1, 1.02, -9.35]} neon="#3ee8ff" />
      <HiFiSpeaker p={[3.1, 1.02, -9.35]} neon="#ff4fd8" />
      <SoundBar p={[0, 1.02, -9.1]} neon="#3ee8ff" />

      {/* 3 Sleek Lights on Left and 3 Lights on Right side of TV */}
      <TrioTVLights p={[-2.75, 0, -9.9]} />
      <TrioTVLights p={[2.75, 0, -9.9]} />

      {/* Mona Lisa Painting on the TV wall (replaces the black/green screen) */}
      <MonaLisaPainting p={[-4.3, 2.9, -9.9]} w={2.2} h={2.4} />

      {/* Floor Lamp positioned elegantly in front of the Mona Lisa painting, moved somewhat forward */}
      <FloorLamp p={[-4.4, 0, -7.8]} color="#ffe0a0" />

      {/* Warm ambient light over sectional couch near the study opening */}
      <pointLight position={[-4.8, 2.4, -4.5]} intensity={45} distance={9} color="#ffe2b0" decay={2} />

      {/* Expanded Luxury Rug */}
      <Box p={[-0.6, 0.03, -4.0]} s={[12.6, 0.06, 7.8]} c="#241e3a" r={0.2} rough={0.9} shadow={false} />
      <Box p={[-0.6, 0.065, -4.0]} s={[11.8, 0.02, 7.0]} c="#322a50" r={0.15} rough={0.85} shadow={false} />

      {/* Massive Expanded L-Sectional Sofa (fits many members comfortably) */}
      <Box p={[-0.6, 0.45, -1.5]} s={[10.4, 0.9, 2.0]} c="#363158" r={0.2} />
      <Box p={[-0.6, 1.3, -0.6]} s={[10.4, 1.5, 0.55]} c="#2a2546" r={0.2} />
      {/* Left chaise return extending forward towards TV & study door */}
      <Box p={[-4.8, 0.45, -3.2]} s={[2.0, 0.9, 3.4]} c="#363158" r={0.2} />
      <Box p={[-5.5, 1.1, -3.2]} s={[0.45, 1.1, 3.4]} c="#2a2546" r={0.16} />
      {/* 5 wide plush cushions along the main sofa */}
      {[-3.6, -1.8, 0, 1.8, 3.6].map((x, i) => (
        <Box key={i} p={[x - 0.6, 1.0, -1.6]} s={[1.65, 0.32, 1.35]} c="#4b4478" r={0.14} />
      ))}
      {/* Chaise lounge cushion */}
      <Box p={[-4.8, 1.0, -3.2]} s={[1.7, 0.32, 3.1]} c="#4b4478" r={0.14} />
      {/* Accent throw pillows */}
      {[[-3.8, '#e5a840'], [-1.6, '#faf0e6'], [1.2, '#d66850'], [3.6, '#faf0e6']].map(([px, col], i) => (
        <Box key={`pillow-${i}`} p={[px - 0.6, 1.25, -0.9]} s={[0.6, 0.5, 0.25]} c={col} r={0.1} />
      ))}

      {/* Expanded Coffee Table with Gourmet Party Snacks: Pizza, Burgers, Drinks, Fries */}
      <Box p={[-0.2, 0.32, -4.6]} s={[4.8, 0.48, 2.2]} c="#1d1630" r={0.08} />
      <Box p={[-0.2, 0.54, -4.6]} s={[5.0, 0.06, 2.4]} c="#292042" r={0.04} />
      <SnackPlatter p={[-0.2, 0.57, -4.6]} />
    </group>
  );
}

// ── BEDROOM (x 6..16, z -10..0) ─────────────────────────────────────────────
export function BedroomBase() {
  return (
    <group>
      <WallWindow p={[10.2, 3.1, -9.9]} w={3.6} h={1.7} color="#9ad7ff" />

      {/* Plush layered velvet & dusty rose rugs under the bed */}
      <Box p={[10.2, 0.02, -6.6]} s={[8.2, 0.04, 7.2]} c="#36193e" rough={0.9} shadow={false} r={0.3} />
      <Box p={[10.2, 0.05, -6.6]} s={[7.4, 0.03, 6.4]} c="#4f2652" rough={0.85} shadow={false} r={0.25} />
      <Box p={[10.2, 0.06, -6.6]} s={[6.8, 0.02, 5.8]} c="#6e3768" rough={0.8} shadow={false} r={0.2} />

      {/* Romantic Four-Poster Canopy Master Bed with underbed glow & sheer silk drapes */}
      <RomanticCanopyBed p={[10.2, 0, -7.2]} />

      {/* Velvet upholstered bench at the foot of the bed (replaces cold office desk) */}
      <BedBench p={[10.2, 0, -3.7]} />

      {/* Designer bedside nightstands with fluted cabinets & warm ambient lamps */}
      <RomanticNightstand p={[7.3, 0, -9.4]} side="left" />
      <RomanticNightstand p={[13.1, 0, -9.4]} side="right" />

      {/* Wardrobe — tap to open (preserved!) */}
      <Wardrobe p={[14.95, 0, -9.3]} id="wd-a" />
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
// The Game Room furniture lives in placedRooms.jsx / gameRoom.jsx (everything there is playable).
export function GameRoomBase() {
  return <group />;
}

// ── GARDEN LAWN BASE ─────────────────────────────────────────────────────────
export function GardenBase() {
  return (
    <group>
      {/* stone path from the house doorway */}
      {[1.4, 2.7, 4.0, 5.3].map((z, i) => <Box key={z} p={[10.6 + (i % 2) * 0.3, 0.05, z]} s={[1.4, 0.1, 1.0]} c="#6f6a86" r={0.04} shadow={false} />)}
      {/* decorative clean perimeter garden pavers */}
      {[2.0, 3.6, 5.2].map((x) => <Box key={x} p={[x, 0.04, 5.5]} s={[0.85, 0.08, 0.85]} c="#6f6a86" r={0.04} shadow={false} />)}
      {/* corner trees */}
      <Tree p={[16.2, 0, 1.2]} scale={0.9} />
      <Tree p={[1.8, 0, 1.4]} scale={0.8} />
    </group>
  );
}
