import { useMemo } from 'react';
import * as THREE from 'three';
import { Box, Neon, ScaledHtml } from './parts';
import { Study, LivingRoom, Bedroom, Kitchen, GameRoom, Garden } from './rooms';
import { NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';
import { WORLD_W, WORLD_D, FLOORPLAN_ZONES } from '../../data/gamifyZones';

const WALL_H = 4.8;

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

const carpet = (base) => (g, n) => {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
};

// Interior wall with doorway gaps. axis 'x' runs along x at z=at; 'z' runs
// along z at x=at. Kept low (0.9) so the cutaway camera can still see over it.
function Divider({ axis, at, from, to, gaps = [], h = 0.9, color }) {
  const segs = [];
  let cursor = from;
  [...gaps].sort((a, b) => a - b).forEach(g => {
    if (g - 1.3 > cursor) segs.push([cursor, g - 1.3]);
    cursor = g + 1.3;
  });
  if (to > cursor) segs.push([cursor, to]);
  return segs.map(([a, b], i) => {
    const mid = (a + b) / 2;
    const len = b - a;
    return axis === 'x' ? (
      <group key={i}>
        <Box p={[mid, h / 2, at]} s={[len, h, 0.25]} c="#2a1f4d" r={0.04} />
        <Neon p={[mid, h + 0.03, at]} s={[len, 0.05, 0.07]} color={color} />
      </group>
    ) : (
      <group key={i}>
        <Box p={[at, h / 2, mid]} s={[0.25, h, len]} c="#2a1f4d" r={0.04} />
        <Neon p={[at, h + 0.03, mid]} s={[0.07, 0.05, len]} color={color} />
      </group>
    );
  });
}

export default function GamifyScene() {
  const textures = useMemo(() => ({
    hall: canvasTexture(512, (g, n) => {
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
    }, [3, 3]),
    study: canvasTexture(128, carpet('#2a4a80'), [4, 4]),
    bedroom: canvasTexture(128, carpet('#5a3a86'), [4, 4]),
    kitchen: canvasTexture(256, (g, n) => {
      const t = n / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#bdb2e6' : '#d9d2f2'; g.fillRect(i * t, j * t, t, t); }
      g.strokeStyle = 'rgba(60,40,110,0.35)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, n); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(n, i * t); g.stroke(); }
    }, [3, 3]),
    gameroom: canvasTexture(256, (g, n) => {
      g.fillStyle = '#17133a'; g.fillRect(0, 0, n, n);
      g.strokeStyle = 'rgba(62,232,255,0.28)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * n / 4, 0); g.lineTo(i * n / 4, n); g.stroke(); g.beginPath(); g.moveTo(0, i * n / 4); g.lineTo(n, i * n / 4); g.stroke(); }
    }, [3, 3]),
    lawn: canvasTexture(256, (g, n) => {
      g.fillStyle = '#2b7a47'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.04)'; g.fillRect(0, i * (n / 8), n, n / 8); }
      for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * n, Math.random() * n, 1, 3); }
    }, [3, 2.5]),
  }), []);

  const zones = Object.values(FLOORPLAN_ZONES);
  const halfW = WORLD_W / 2;
  const halfD = WORLD_D / 2;

  return (
    <group>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.75} color="#b7a4ff" />
      <hemisphereLight args={['#9c8cff', '#1a1030', 0.55]} />
      <directionalLight position={[14, 26, 16]} intensity={1.5} color="#ffe7ff" castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-near={1} shadow-camera-far={80} shadow-bias={-0.0004} />
      <pointLight position={[0, 3.6, -6]} color={NEON_PINK} intensity={70} distance={16} decay={2} />
      <pointLight position={[10.5, 3.2, -5]} color={NEON_VIOLET} intensity={45} distance={13} decay={2} />
      <pointLight position={[-11, 3.4, -5]} color={NEON_CYAN} intensity={40} distance={13} decay={2} />
      <pointLight position={[-11, 3.4, 5]} color="#ffd9a0" intensity={34} distance={13} decay={2} />
      <pointLight position={[0, 3.2, 5]} color={NEON_CYAN} intensity={40} distance={13} decay={2} />
      <pointLight position={[10, 1.6, 3.4]} color={NEON_AMBER} intensity={22} distance={9} decay={2} />

      {/* ── Slab + per-room floors ── */}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[WORLD_W + 0.8, 0.5, WORLD_D + 0.8]} />
        <meshStandardMaterial color="#1b1430" roughness={0.9} />
      </mesh>
      {zones.map(z => (
        <mesh key={z.id} rotation={[-Math.PI / 2, 0, 0]} position={[(z.world.x0 + z.world.x1) / 2, 0.005, (z.world.z0 + z.world.z1) / 2]} receiveShadow>
          <planeGeometry args={[z.world.x1 - z.world.x0, z.world.z1 - z.world.z0]} />
          <meshStandardMaterial map={textures[z.id === 'hall' ? 'hall' : z.id]} roughness={z.id === 'kitchen' ? 0.35 : 0.8} />
        </mesh>
      ))}

      {/* ── Back + left outer walls (cutaway: the two nearest the camera are omitted) ── */}
      <Box p={[0, WALL_H / 2, -halfD - 0.15]} s={[WORLD_W + 0.6, WALL_H, 0.3]} c="#3a2a62" />
      <Box p={[-halfW - 0.15, WALL_H / 2, 0]} s={[0.3, WALL_H, WORLD_D + 0.6]} c="#33265a" />
      <Neon p={[0, WALL_H - 0.15, -halfD + 0.05]} s={[WORLD_W, 0.07, 0.07]} color={NEON_PINK} />
      <Neon p={[-halfW + 0.05, WALL_H - 0.15, 0]} s={[0.07, 0.07, WORLD_D]} color={NEON_CYAN} />
      <Neon p={[0, 0.12, -halfD + 0.05]} s={[WORLD_W, 0.05, 0.05]} color={NEON_VIOLET} />
      <Neon p={[-halfW + 0.05, 0.12, 0]} s={[0.05, 0.05, WORLD_D]} color={NEON_VIOLET} />

      {/* ── Interior walls with doorways ── */}
      <Divider axis="z" at={-6} from={-halfD} to={halfD} gaps={[-5, 5]} color={NEON_CYAN} />
      <Divider axis="z" at={6} from={-halfD} to={halfD} gaps={[-5, 5]} color={NEON_PINK} />
      <Divider axis="x" at={0} from={-halfW} to={halfW} gaps={[-11, 0, 11]} color={NEON_VIOLET} />

      {/* ── Rooms ── */}
      <Study />
      <LivingRoom />
      <Bedroom />
      <Kitchen />
      <GameRoom />
      <Garden />

      {/* ── Room labels ── */}
      {zones.map(z => (
        <ScaledHtml key={z.id} position={[z.world.x0 + 2.2, 0.15, z.world.z0 + 1.0]} pointerEvents="none">
          <div style={{
            padding: '2px 10px', borderRadius: 99, background: 'rgba(8,6,20,0.55)', color: 'rgba(255,255,255,0.85)',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(3px)', userSelect: 'none',
          }}>{z.label}</div>
        </ScaledHtml>
      ))}
    </group>
  );
}
