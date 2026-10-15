import { useMemo } from 'react';
import * as THREE from 'three';
import { Box, Neon, PropDot, useOpenProp } from './parts';
import { NEON_AMBER, NEON_CYAN, NEON_PINK, NEON_VIOLET } from './constants';

// Pieces of the Game Room. Everything here is authored in the room's cell-local
// frame (x from the left wall, z from the back wall) and is tappable: it opens a
// game in the prop viewer (see ./games). `Playable` adds the tap handlers and the
// pulsing dot that the rest of the house uses.

const PI = Math.PI;
const WOOD = '#6b4a2f';
const WOOD_DARK = '#3d2a1c';

export function Playable({ game, dot, children }) {
  const open = useOpenProp('game', game);
  return (
    <group {...open}>
      {dot && <PropDot position={dot} kind="game" arg={game} />}
      {children}
    </group>
  );
}

export function PoolTable({ p }) {
  return (
    <group position={p}>
      <Playable game="pool" dot={[0, 2.0, 0]}>
        <Box p={[0, 0.85, 0]} s={[4.6, 0.3, 2.6]} c="#3b2a1f" r={0.06} />
        <Box p={[0, 1.02, 0]} s={[4.1, 0.06, 2.1]} c="#1f8a5a" rough={1} />
        {[[-1.2, -0.5, '#ff4f4f'], [0.2, 0.3, '#ffd24f'], [0.5, -0.4, '#4f9bff'], [1.2, 0.5, '#ffffff'], [-0.3, -0.1, '#b04fff'], [0.9, -0.1, '#111111']].map(([x, z, col], i) => (
          <mesh key={i} position={[x, 1.12, z]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color={col} roughness={0.3} />
          </mesh>
        ))}
        {[[-2.0, -1.0], [2.0, -1.0], [-2.0, 1.0], [2.0, 1.0]].map(([x, z], i) => <Box key={i} p={[x, 0.4, z]} s={[0.25, 0.8, 0.25]} c="#2a1c14" />)}
        <Neon p={[0, 0.72, 1.32]} s={[4.4, 0.04, 0.04]} color={NEON_CYAN} halo={false} />
        {/* cue stick leaning on the rail */}
        <mesh position={[-2.45, 1.3, 0.2]} rotation={[0, 0, 0.12]}><cylinderGeometry args={[0.03, 0.05, 2.5, 8]} /><meshStandardMaterial color="#e8c68a" /></mesh>
      </Playable>
    </group>
  );
}

export function PingPongTable({ p }) {
  return (
    <group position={p}>
      <Playable game="pingpong" dot={[0, 2.2, 0]}>
        <Box p={[0, 0.95, 0]} s={[4.0, 0.1, 2.2]} c="#1f6aa8" rough={0.5} />
        <Box p={[0, 1.15, 0]} s={[0.04, 0.3, 2.3]} c="#e8f4ff" opacity={0.7} shadow={false} />
        <Neon p={[0, 1.0, 0]} s={[3.9, 0.02, 0.05]} color="#fff" halo={false} />
        {[[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]].map(([x, z], i) => <Box key={i} p={[x, 0.45, z]} s={[0.14, 0.9, 0.14]} c="#2a2140" />)}
        {[[-1.2, 0.5, '#ff7a3c'], [1.2, -0.4, '#e8f4ff']].map(([x, z, col], i) => (
          <mesh key={i} position={[x, 1.03, z]} rotation={[-PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.03, 16]} /><meshStandardMaterial color={col} /></mesh>
        ))}
        <mesh position={[0.3, 1.04, 0.1]}><sphereGeometry args={[0.05, 10, 8]} /><meshBasicMaterial color="#fff" /></mesh>
      </Playable>
    </group>
  );
}

export function MiniBar({ p }) {
  return (
    <group position={p}>
      <Playable game="mixbar" dot={[0, 2.4, 0]}>
        <Box p={[0, 0.6, 0]} s={[1.3, 1.2, 4.0]} c="#2f2358" r={0.06} />
        <Box p={[0, 1.24, 0]} s={[1.5, 0.08, 4.2]} c="#3a2d66" />
        {[[0.3, -1.2, '#ff6fb5'], [0.3, -0.6, '#5ad1ff'], [0.3, 0, '#ffcf5a'], [0.3, 0.7, '#8dff9c']].map(([x, z, col], i) => (
          <mesh key={i} position={[x, 1.55, z]}><cylinderGeometry args={[0.1, 0.1, 0.5, 8]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
        ))}
        {[[-0.2, -0.9, '#ff7a9a'], [-0.2, 0.3, '#7ad8ff'], [-0.2, 1.1, '#ffe27a']].map(([x, z, col], i) => (
          <mesh key={i} position={[x, 1.42, z]}><cylinderGeometry args={[0.13, 0.09, 0.3, 12]} /><meshStandardMaterial color={col} transparent opacity={0.75} roughness={0.2} /></mesh>
        ))}
        <Neon p={[0.68, 0.62, 0]} s={[0.03, 0.08, 3.8]} color={NEON_PINK} halo={false} />
        {/* menu board */}
        <Box p={[0, 2.35, -2.1]} s={[0.1, 0.8, 0.7]} c="#15112f" />
        <Neon p={[0.06, 2.35, -2.1]} s={[0.02, 0.5, 0.45]} color={NEON_AMBER} halo={false} />
      </Playable>
      {[-1.6, 0, 1.6].map(z => (
        <group key={z} position={[-1.3, 0, z]}>
          <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.32, 0.32, 0.14, 16]} /><meshStandardMaterial color="#3ee8ff" roughness={0.6} /></mesh>
          <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 8]} /><meshStandardMaterial color="#2a2140" /></mesh>
        </group>
      ))}
    </group>
  );
}

function Speaker({ p, color }) {
  return (
    <group position={p}>
      <Box p={[0, 1.1, 0]} s={[1.0, 2.2, 1.0]} c="#1a1634" r={0.05} />
      <Box p={[0, 1.1, -0.51]} s={[0.92, 2.1, 0.03]} c="#2a2450" />
      {/* neon trim + a rear bass-port ring so the speaker reads from every side */}
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => <Neon key={i} p={[x, 1.1, z]} s={[0.05, 2.14, 0.05]} color={color} halo={false} />)}
      <Neon p={[0, 2.2, 0]} s={[1.06, 0.05, 1.06]} color={color} halo={false} />
      <mesh position={[0, 1.0, 0.52]}><ringGeometry args={[0.2, 0.28, 24]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[0, 1.0, 0.515]}><circleGeometry args={[0.2, 20]} /><meshStandardMaterial color="#0e0c1c" /></mesh>
      {[[0.55, 0.38], [1.55, 0.26]].map(([y, r], i) => (
        <group key={i} position={[0, y + 0.3, -0.54]}>
          <mesh rotation={[0, PI, 0]}><ringGeometry args={[r * 0.78, r, 28]} /><meshBasicMaterial color={color} toneMapped={false} side={THREE.DoubleSide} /></mesh>
          <mesh rotation={[0, PI, 0]} position={[0, 0, 0.01]}><circleGeometry args={[r * 0.72, 24]} /><meshStandardMaterial color="#0e0c1c" /></mesh>
          <mesh rotation={[0, PI, 0]} position={[0, 0, -0.01]}><circleGeometry args={[r * 0.24, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function DjStation({ p }) {
  return (
    <group position={p}>
      <Playable game="dj" dot={[0, 2.5, 0]}>
        <Box p={[0, 0.6, 0]} s={[3.2, 1.2, 1.0]} c="#1a1530" r={0.05} />
        <Neon p={[0, 1.25, -0.52]} s={[3.0, 0.05, 0.05]} color={NEON_PINK} />
        <Box p={[0, 1.24, 0]} s={[3.0, 0.06, 0.8]} c="#2b2150" />
        {[-0.95, 0.95].map(x => (
          <group key={x} position={[x, 1.3, 0]}>
            <mesh><cylinderGeometry args={[0.36, 0.36, 0.06, 28]} /><meshStandardMaterial color="#0c0a18" roughness={0.4} /></mesh>
            <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.12, 0.12, 0.02, 16]} /><meshBasicMaterial color={x < 0 ? NEON_CYAN : NEON_AMBER} toneMapped={false} /></mesh>
          </group>
        ))}
        <Box p={[0, 1.3, 0]} s={[0.7, 0.08, 0.6]} c="#2f2a5a" />
        {[-0.2, 0, 0.2].map(x => <Box key={x} p={[x, 1.36, 0]} s={[0.05, 0.05, 0.3]} c="#8dff9c" shadow={false} />)}
      </Playable>
      <Speaker p={[-2.6, 0, 0]} color={NEON_CYAN} />
      <Speaker p={[2.6, 0, 0]} color={NEON_PINK} />
    </group>
  );
}

function Gamepad({ p, rot = 0, body = '#1b1830', accent = NEON_CYAN }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0, 0]} s={[0.34, 0.07, 0.2]} c={body} r={0.03} />
      <Box p={[-0.15, -0.01, 0.07]} s={[0.07, 0.07, 0.12]} c={body} r={0.03} />
      <Box p={[0.15, -0.01, 0.07]} s={[0.07, 0.07, 0.12]} c={body} r={0.03} />
      {[-0.07, 0.07].map((x, i) => (
        <group key={i} position={[x, 0.05, i ? 0.03 : -0.03]}>
          <mesh><cylinderGeometry args={[0.03, 0.03, 0.03, 10]} /><meshStandardMaterial color="#dfe3ee" /></mesh>
          <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.04, 0.03, 0.02, 10]} /><meshStandardMaterial color="#2a2740" /></mesh>
        </group>
      ))}
      {[[0.1, -0.06, '#ff5a6e'], [0.14, -0.02, '#ffd24f'], [0.06, -0.02, '#3ee8ff'], [0.1, 0.02, '#6ee37a']].map(([x, z, col], i) => (
        <mesh key={i} position={[x + 0.02, 0.045, z - 0.03]}><sphereGeometry args={[0.018, 8, 6]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
      ))}
      <Neon p={[0, 0.04, -0.101]} s={[0.22, 0.012, 0.012]} color={accent} halo={false} />
    </group>
  );
}

// TV on the left wall + console, a coffee table with two controllers, beanbags and a warm rug.
export function ConsoleCorner() {
  const road = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.07, 0.04); s.lineTo(0.07, 0.04); s.lineTo(0.8, -0.9); s.lineTo(-0.8, -0.9); s.closePath();
    return s;
  }, []);
  return (
    <group>
      {/* warm rug */}
      <Box p={[2.7, 0.03, 7.8]} s={[4.8, 0.06, 6.2]} c="#6b2f2a" r={0.03} rough={1} shadow={false} />
      <Box p={[2.7, 0.065, 7.8]} s={[4.2, 0.02, 5.6]} c="#a4543a" r={0.02} rough={1} shadow={false} />
      <Box p={[2.7, 0.08, 7.8]} s={[3.2, 0.02, 4.6]} c="#d98a4a" r={0.02} rough={1} shadow={false} />
      {/* TV unit + console */}
      <Playable game="console" dot={[0.7, 3.9, 7.8]}>
        <Box p={[0.55, 0.3, 7.8]} s={[0.8, 0.6, 4.0]} c={WOOD} r={0.04} />
        <Box p={[0.57, 0.62, 7.8]} s={[0.8, 0.05, 4.1]} c={WOOD_DARK} />
        <Box p={[0.62, 0.74, 7.0]} s={[0.55, 0.1, 0.85]} c="#14121e" r={0.03} />
        <Neon p={[0.9, 0.74, 7.0]} s={[0.02, 0.04, 0.7]} color={NEON_CYAN} halo={false} />
        {[[0.6, 8.4, '#ff5a6e'], [0.6, 8.6, '#3ee8ff'], [0.6, 8.8, '#ffd24f'], [0.6, 9.0, '#6ee37a'], [0.6, 9.2, '#b04fff']].map(([x, z, col], i) => (
          <Box key={i} p={[x, 0.82, z]} s={[0.4, 0.2, 0.07]} c={col} shadow={false} />
        ))}
        <group position={[0.13, 2.5, 7.8]} rotation={[0, PI / 2, 0]}>
          <Box p={[0, 0, 0]} s={[3.7, 2.1, 0.12]} c="#0c0a18" r={0.05} />
          <mesh position={[0, 0.5, 0.07]}><planeGeometry args={[3.4, 0.95]} /><meshBasicMaterial color="#5ac0ff" toneMapped={false} /></mesh>
          <mesh position={[0, -0.47, 0.07]}><planeGeometry args={[3.4, 0.95]} /><meshBasicMaterial color="#2f9a4a" toneMapped={false} /></mesh>
          <mesh position={[0, 0, 0.075]}><shapeGeometry args={[road]} /><meshBasicMaterial color="#4a4d5a" toneMapped={false} /></mesh>
          {[[-0.0, -0.18, 0.025], [0, -0.42, 0.04], [0, -0.7, 0.06]].map(([x, y, w], i) => <mesh key={i} position={[x, y, 0.08]}><planeGeometry args={[w, 0.12]} /><meshBasicMaterial color="#fff" toneMapped={false} /></mesh>)}
          <Box p={[0.0, -0.55, 0.09]} s={[0.34, 0.16, 0.02]} c="#ff4f6e" shadow={false} />
          <Box p={[-0.5, -0.3, 0.09]} s={[0.22, 0.1, 0.02]} c="#3ee8ff" shadow={false} />
          <Neon p={[0, -1.12, 0]} s={[3.5, 0.04, 0.04]} color={NEON_VIOLET} />
        </group>
      </Playable>
      {/* coffee table with two controllers (joysticks) */}
      <Playable game="console" dot={[2.3, 1.5, 7.8]}>
        <Box p={[2.3, 0.52, 7.8]} s={[1.1, 0.07, 1.9]} c={WOOD} r={0.03} />
        {[[-0.45, -0.8], [0.45, -0.8], [-0.45, 0.8], [0.45, 0.8]].map(([x, z], i) => <Box key={i} p={[2.3 + x, 0.25, 7.8 + z]} s={[0.07, 0.5, 0.07]} c={WOOD_DARK} />)}
        <Gamepad p={[2.15, 0.6, 7.2]} rot={-PI / 2} accent={NEON_CYAN} />
        <Gamepad p={[2.15, 0.6, 8.4]} rot={-PI / 2 + 0.25} body="#2a1830" accent={NEON_PINK} />
        <mesh position={[2.55, 0.6, 7.8]}><cylinderGeometry args={[0.16, 0.12, 0.08, 14]} /><meshStandardMaterial color="#f2d7a0" /></mesh>
        {[0, 1, 2].map(i => <mesh key={i} position={[2.55 + (i - 1) * 0.06, 0.66, 7.8 + (i % 2) * 0.05]}><sphereGeometry args={[0.04, 8, 6]} /><meshStandardMaterial color={['#ffb347', '#ff6a3c', '#ffd24f'][i]} /></mesh>)}
      </Playable>
      {/* cosy seating */}
      <group position={[3.2, 0, 5.3]}>
        <mesh position={[0, 0.34, 0]} scale={[1, 0.62, 1]} castShadow><sphereGeometry args={[0.7, 18, 14]} /><meshStandardMaterial color="#e0723a" roughness={0.95} /></mesh>
        <mesh position={[0.1, 0.62, 0.05]} rotation={[0, 0.4, 0]}><boxGeometry args={[0.7, 0.05, 0.5]} /><meshStandardMaterial color="#f4e3c0" roughness={1} /></mesh>
      </group>
      <group position={[3.4, 0, 10.4]}>
        <mesh position={[0, 0.34, 0]} scale={[1, 0.62, 1]} castShadow><sphereGeometry args={[0.7, 18, 14]} /><meshStandardMaterial color="#7a58d6" roughness={0.95} /></mesh>
        <mesh position={[-0.05, 0.6, 0]} rotation={[0, -0.3, 0.1]}><boxGeometry args={[0.45, 0.14, 0.4]} /><meshStandardMaterial color="#ffd8a8" roughness={1} /></mesh>
      </group>
    </group>
  );
}

// A scoreboard on the left wall and a trophy shelf on the right wall: both open the game hub.
export function ScoreBoard({ p }) {
  return (
    <group position={p} rotation={[0, PI / 2, 0]}>
      <Playable game="hub" dot={[0, 1.1, 0.3]}>
        <Box p={[0, 0, 0]} s={[2.4, 1.5, 0.1]} c="#0f0c20" r={0.04} />
        <Neon p={[0, 0.82, 0.06]} s={[2.3, 0.04, 0.03]} color={NEON_AMBER} />
        {[[0.3, 1.5, NEON_CYAN], [0.0, 1.1, NEON_PINK], [-0.3, 0.8, '#8dff9c']].map(([y, w, col], i) => (
          <group key={i}>
            <mesh position={[-0.95 + 0.14, y, 0.07]}><circleGeometry args={[0.08, 12]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
            <mesh position={[-0.75 + w / 2, y, 0.07]}><planeGeometry args={[w, 0.12]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>
          </group>
        ))}
      </Playable>
    </group>
  );
}

export function TrophyShelf({ p }) {
  return (
    <group position={p} rotation={[0, -PI / 2, 0]}>
      <Playable game="hub" dot={[0, 0.9, 0.3]}>
        <Box p={[0, 0, 0]} s={[3.2, 0.1, 0.55]} c={WOOD} r={0.02} />
        <Box p={[0, -0.7, 0]} s={[3.2, 0.1, 0.55]} c={WOOD} r={0.02} />
        {[-1.0, -0.2, 0.7].map((x, i) => (
          <group key={i} position={[x, 0.05, 0]}>
            <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.16, 0.18, 0.1, 12]} /><meshStandardMaterial color="#5a3a24" /></mesh>
            <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.2, 0.08, 0.38, 12]} /><meshStandardMaterial color="#e8b82c" metalness={0.8} roughness={0.25} emissive="#a07810" emissiveIntensity={0.3} /></mesh>
            <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color="#ffd24f" metalness={0.8} roughness={0.25} /></mesh>
          </group>
        ))}
        {[[-1.3, '#ff5a6e'], [-1.15, '#3ee8ff'], [1.2, '#6ee37a'], [1.35, '#b04fff']].map(([x, col], i) => <Box key={i} p={[x, -0.5, 0]} s={[0.12, 0.3, 0.38]} c={col} shadow={false} />)}
      </Playable>
    </group>
  );
}

// Neon controller above the back-wall doorway.
export function GameSign({ p }) {
  return (
    <group position={p}>
      <Playable game="hub" dot={[0, 0.95, 0.3]}>
        <Box p={[0, 0, 0]} s={[3.0, 1.1, 0.1]} c="#100c24" r={0.05} />
        <Neon p={[0, 0.52, 0.06]} s={[2.9, 0.04, 0.03]} color={NEON_PINK} />
        <Neon p={[0, -0.52, 0.06]} s={[2.9, 0.04, 0.03]} color={NEON_CYAN} />
        <Box p={[-0.8, 0, 0.07]} s={[0.46, 0.12, 0.03]} c={NEON_CYAN} emissive={NEON_CYAN} shadow={false} />
        <Box p={[-0.8, 0, 0.07]} s={[0.12, 0.46, 0.03]} c={NEON_CYAN} emissive={NEON_CYAN} shadow={false} />
        {[[0.6, 0.0, NEON_AMBER], [0.82, 0.18, NEON_PINK], [0.82, -0.18, '#8dff9c'], [1.04, 0.0, NEON_CYAN]].map(([x, y, col], i) => <mesh key={i} position={[x, y, 0.09]}><circleGeometry args={[0.1, 14]} /><meshBasicMaterial color={col} toneMapped={false} /></mesh>)}
        <mesh position={[0, -0.02, 0.09]}><circleGeometry args={[0.07, 12]} /><meshBasicMaterial color="#e8e1ff" toneMapped={false} /></mesh>
      </Playable>
    </group>
  );
}
