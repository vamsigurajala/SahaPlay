import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox, Html } from '@react-three/drei';

// The static 3D room. World units: the floor plan is 20 wide (x) by 12 deep
// (z), centered on the origin; gamifyZones.js's 0-1000 x 0-600 "virtual"
// coordinates (what goes over the socket) map onto it linearly, so the
// backend never needs to know any of this exists.
export const WORLD_W = 20;
export const WORLD_D = 12;

// TV mounted on the back wall of the Hall. Room.jsx's real player element is
// CSS-matrix3d'd onto this exact quad (see GamifyFloorPlan's TvProjector), so
// the video genuinely appears to be playing on this screen.
export const TV = { cx: -0.2, cy: 2.2, z: -5.86, w: 3.6 };
export const TV_NATIVE_W = 420;
export const TV_NATIVE_H = 270;
export const TV_H = TV.w * (TV_NATIVE_H / TV_NATIVE_W);

const NEON_PINK = '#ff4fd8';
const NEON_CYAN = '#3ee8ff';
const NEON_VIOLET = '#8b5cff';

function canvasTexture(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Box({ p, s, c, r = 0.06, emissive, ei = 1, rough = 0.75, shadow = true }) {
  return (
    <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2 - 0.001)} smoothness={3} position={p} castShadow={shadow} receiveShadow>
      <meshStandardMaterial color={c} roughness={rough} emissive={emissive || '#000'} emissiveIntensity={emissive ? ei : 0} toneMapped={!emissive} />
    </RoundedBox>
  );
}

// Glowing strip with a fake additive halo around it (no postprocessing
// dependency — keeps the lazy 3D chunk small).
function Neon({ p, s, color }) {
  return (
    <group position={p}>
      <mesh>
        <boxGeometry args={s} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[s[0] + 0.18, s[1] + 0.18, s[2] + 0.18]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Plant({ p, scale = 1, color = '#2f9e5a' }) {
  const leaves = [[0, 1.0, 0, 0.5], [0.28, 0.8, 0.1, 0.38], [-0.3, 0.75, -0.1, 0.4], [0.05, 1.35, 0.05, 0.32], [-0.1, 0.55, 0.3, 0.3]];
  return (
    <group position={p} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.26, 0.6, 14]} />
        <meshStandardMaterial color="#6e4bb8" roughness={0.6} />
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

function BeanBag({ p, color, glow }) {
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

function Label({ p, text }) {
  return (
    <Html position={p} center zIndexRange={[30, 0]} pointerEvents="none">
      <div style={{
        padding: '2px 10px', borderRadius: 99, background: 'rgba(8,6,20,0.55)', color: 'rgba(255,255,255,0.8)',
        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(3px)', userSelect: 'none',
      }}>{text}</div>
    </Html>
  );
}

export default function GamifyScene() {
  const plankTex = useMemo(() => canvasTexture(512, (g, n) => {
    g.fillStyle = '#3b2a66'; g.fillRect(0, 0, n, n);
    const planks = 8;
    for (let i = 0; i < planks; i++) {
      const w = n / planks;
      const v = 0.85 + Math.random() * 0.3;
      g.fillStyle = `rgb(${Math.round(60 * v)},${Math.round(42 * v)},${Math.round(104 * v)})`;
      g.fillRect(i * w, 0, w - 2, n);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * w + w - 2, 0, 2, n);
      for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(i * w + Math.random() * w, Math.random() * n, 1, 18 + Math.random() * 40); }
    }
  }, [3, 3]), []);

  const grassTex = useMemo(() => canvasTexture(256, (g, n) => {
    g.fillStyle = '#2b7a47'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.04)'; g.fillRect(0, i * (n / 8), n, n / 8); }
    for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * n, Math.random() * n, 1, 3); }
  }, [3, 2]), []);

  const carpetTex = useMemo(() => canvasTexture(128, (g, n) => {
    g.fillStyle = '#5a3a86'; g.fillRect(0, 0, n, n);
    for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
  }, [4, 3]), []);

  return (
    <group>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.7} color="#b7a4ff" />
      <hemisphereLight args={['#9c8cff', '#1a1030', 0.5]} />
      <directionalLight position={[8, 16, 9]} intensity={1.5} color="#ffe7ff" castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-bias={-0.0004} />
      <pointLight position={[-4, 3.4, -4.2]} color={NEON_PINK} intensity={55} distance={13} decay={2} />
      <pointLight position={[6.5, 3, -3]} color={NEON_CYAN} intensity={40} distance={11} decay={2} />
      <pointLight position={[5, 1.2, 3.6]} color="#ff9a3c" intensity={14} distance={6} decay={2} />

      {/* ── Slab + floors ── */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[WORLD_W + 0.8, 0.5, WORLD_D + 0.8]} />
        <meshStandardMaterial color="#1b1430" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.005, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial map={plankTex} roughness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.005, -3]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial map={carpetTex} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.005, 3]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial map={grassTex} roughness={1} />
      </mesh>

      {/* ── Back + left walls (cutaway: the two nearest the camera are omitted) ── */}
      <Box p={[0, 2.1, -6.15]} s={[WORLD_W + 0.6, 4.2, 0.3]} c="#3a2a62" r={0.02} />
      <Box p={[-10.15, 2.1, 0]} s={[0.3, 4.2, WORLD_D + 0.6]} c="#33265a" r={0.02} />
      <Neon p={[0, 3.95, -5.95]} s={[WORLD_W, 0.07, 0.07]} color={NEON_PINK} />
      <Neon p={[-9.95, 3.95, 0]} s={[0.07, 0.07, WORLD_D]} color={NEON_CYAN} />
      <Neon p={[0, 0.12, -5.95]} s={[WORLD_W, 0.05, 0.05]} color={NEON_VIOLET} />

      {/* low dividers between the three areas */}
      <Box p={[2, 0.35, -3]} s={[0.2, 0.7, 6]} c="#2a1f4d" />
      <Neon p={[2, 0.74, -3]} s={[0.06, 0.05, 6]} color={NEON_CYAN} />
      <Box p={[6, 0.35, 0]} s={[8, 0.7, 0.2]} c="#2a1f4d" />
      <Neon p={[6, 0.74, 0]} s={[8, 0.05, 0.06]} color={NEON_PINK} />
      <Box p={[2, 0.35, 3]} s={[0.2, 0.7, 6]} c="#2a1f4d" />
      <Neon p={[2, 0.74, 3]} s={[0.06, 0.05, 6]} color={NEON_VIOLET} />

      {/* ── HALL: TV wall ── */}
      <Box p={[TV.cx, TV.cy, -5.94]} s={[TV.w + 0.3, TV_H + 0.3, 0.12]} c="#0c0b14" r={0.08} />
      <mesh position={[TV.cx, TV.cy, TV.z]}>
        <planeGeometry args={[TV.w, TV_H]} />
        <meshBasicMaterial color="#0a0a18" />
      </mesh>
      <Box p={[TV.cx, 0.45, -5.5]} s={[5.4, 0.9, 1]} c="#2c2150" />
      <Neon p={[TV.cx, 0.92, -5.0]} s={[5.2, 0.04, 0.04]} color={NEON_CYAN} />
      {/* wall panels + shelf */}
      {[[-7.4, NEON_VIOLET], [-6.3, NEON_CYAN], [-5.2, NEON_PINK]].map(([x, col], i) => (
        <group key={i}>
          <Box p={[x, 2.5, -5.95]} s={[0.85, 1.5, 0.08]} c="#171230" />
          <Neon p={[x, 2.5, -5.88]} s={[0.55, 1.15, 0.02]} color={col} />
        </group>
      ))}
      <Box p={[-6.3, 0.65, -5.55]} s={[4.2, 1.3, 0.8]} c="#2f2358" />
      {[[-7.6, '#ffcf5a'], [-6.9, '#ff6fb5'], [-6.0, '#5ad1ff'], [-5.2, '#8dff9c']].map(([x, col], i) => (
        <Box key={i} p={[x, 1.5, -5.55]} s={[0.4, 0.4 + (i % 2) * 0.2, 0.4]} c={col} r={0.08} />
      ))}

      {/* HALL: rug, L-sofa, coffee table */}
      <Box p={[-3.6, 0.03, 1.6]} s={[7.2, 0.06, 5.2]} c="#43357f" r={0.02} rough={1} shadow={false} />
      <Box p={[-3.6, 0.065, 1.6]} s={[6.6, 0.02, 4.6]} c="#5846a0" r={0.01} rough={1} shadow={false} />
      <Box p={[-3.6, 0.4, 3.9]} s={[5.4, 0.8, 1.6]} c="#5a4bb5" r={0.2} />
      <Box p={[-3.6, 1.15, 4.5]} s={[5.4, 1.4, 0.5]} c="#4a3c9e" r={0.2} />
      <Box p={[-6.7, 0.4, 1.4]} s={[1.6, 0.8, 3.6]} c="#5a4bb5" r={0.2} />
      <Box p={[-7.3, 1.15, 1.4]} s={[0.5, 1.4, 3.6]} c="#4a3c9e" r={0.2} />
      {[-5.4, -3.6, -1.8].map((x, i) => <Box key={i} p={[x, 0.95, 3.7]} s={[1.5, 0.3, 1.2]} c="#7664d6" r={0.14} />)}
      <Box p={[-3.6, 0.3, 1.6]} s={[2.6, 0.45, 1.3]} c="#1d1740" r={0.08} />
      <Neon p={[-3.6, 0.55, 1.6]} s={[2.4, 0.03, 1.1]} color={NEON_CYAN} />
      <Box p={[-1.0, 0.45, 3.3]} s={[0.5, 0.9, 0.5]} c="#2a1f4d" />
      <Neon p={[-1.0, 1.05, 3.3]} s={[0.3, 0.3, 0.3]} color="#ffd36b" />
      <BeanBag p={[0.2, 0, 2.2]} color="#7a58d6" glow={NEON_CYAN} />
      <Plant p={[-9.0, 0, -5.0]} scale={1.3} />
      <Plant p={[-9.0, 0, 5.0]} scale={1.1} color="#34b36a" />
      <Plant p={[1.2, 0, -5.0]} scale={1.2} color="#38a86a" />
      <Plant p={[1.0, 0, 5.2]} scale={0.9} />

      {/* ── BEDROOM ── */}
      <Box p={[6.2, 0.35, -4.0]} s={[3.4, 0.7, 4.4]} c="#3b2d66" r={0.12} />
      <Box p={[6.2, 0.86, -3.9]} s={[3.2, 0.34, 4.2]} c="#efe7ff" r={0.12} />
      <Box p={[6.2, 1.1, -2.9]} s={[3.2, 0.2, 2.3]} c="#8f6bff" r={0.1} />
      <Box p={[5.5, 1.1, -5.4]} s={[1.2, 0.3, 0.7]} c="#fff" r={0.14} />
      <Box p={[6.9, 1.1, -5.4]} s={[1.2, 0.3, 0.7]} c="#fff" r={0.14} />
      <Box p={[6.2, 1.5, -5.9]} s={[3.6, 1.8, 0.16]} c="#2a1f4d" r={0.06} />
      <Neon p={[6.2, 2.45, -5.8]} s={[3.4, 0.06, 0.06]} color={NEON_PINK} />
      <Box p={[4.1, 0.4, -5.3]} s={[0.7, 0.8, 0.7]} c="#2f2358" />
      <Neon p={[4.1, 0.95, -5.3]} s={[0.25, 0.25, 0.25]} color="#ffd36b" />
      {/* desk + glowing monitor */}
      <Box p={[9.3, 0.55, -3.4]} s={[1.0, 0.12, 2.8]} c="#2c2150" />
      <Box p={[9.3, 0.27, -2.2]} s={[0.9, 0.55, 0.12]} c="#1d1740" />
      <Box p={[9.3, 0.27, -4.6]} s={[0.9, 0.55, 0.12]} c="#1d1740" />
      <Box p={[9.55, 1.15, -3.4]} s={[0.1, 0.8, 1.4]} c="#0e0c1c" r={0.03} />
      <Neon p={[9.48, 1.15, -3.4]} s={[0.02, 0.66, 1.26]} color={NEON_CYAN} />
      <BeanBag p={[8.0, 0, -2.1]} color="#e0529f" glow={NEON_PINK} />
      <Plant p={[9.2, 0, -0.9]} scale={1.1} />
      <Plant p={[2.9, 0, -0.9]} scale={0.9} color="#3bbf74" />

      {/* ── LAWN / lounge ── */}
      <mesh position={[5.2, 0.05, 3.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#473a6e" roughness={1} />
      </mesh>
      <mesh position={[5.2, 0.25, 3.4]} castShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.5, 14]} />
        <meshStandardMaterial color="#2a2140" roughness={0.9} />
      </mesh>
      <mesh position={[5.2, 0.65, 3.4]}>
        <icosahedronGeometry args={[0.26, 1]} />
        <meshBasicMaterial color="#ffb347" toneMapped={false} />
      </mesh>
      <BeanBag p={[3.7, 0, 3.0]} color="#4fa8ff" glow={NEON_CYAN} />
      <BeanBag p={[6.6, 0, 3.0]} color="#a56bff" glow={NEON_VIOLET} />
      <BeanBag p={[5.2, 0, 5.0]} color="#ff7bc0" glow={NEON_PINK} />
      {/* tree */}
      <group position={[8.8, 0, 4.2]}>
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
      <Plant p={[3.0, 0, 5.4]} scale={1.0} color="#34b36a" />

      <Label p={[-8.8, 0.1, -4.4]} text="Hall" />
      <Label p={[3.2, 0.1, -4.8]} text="Bedroom" />
      <Label p={[3.2, 0.1, 0.8]} text="Lawn" />
    </group>
  );
}
