import { useContext, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Neon, Tree, ScaledHtml, FocusContext } from './parts';
import { Playable } from './gameRoom';
import { Cell } from './cell';
import { WEATHER } from './environment';
import { FLOORPLAN_ZONES, CELL_W, CELL_D } from '../../data/gamifyZones';

// The cricket ground in front of the Front Yard gate: a small oval stadium with a
// mown outfield, a pitch, kids playing (a bowler, batter, keeper, fielders, an
// umpire) and kids cheering from a stand and a bench. It only comes alive when the
// weather is dry and bright; at night or in the rain the ground is closed — covers
// on the pitch, dark floodlights, no players.

const PI = Math.PI;
const CX = 9; // cell-local centre of the field
const CZ = 8;
const RX = 6.3; // boundary rope radii
const RZ = 6.2;
const CYC = 6.5; // seconds per delivery
const BOWL_Z = CZ - 3.2; // bowler's stumps
const BAT_Z = CZ + 3.2; // batter's stumps
export const CRICKET_OPEN = ['sunrise', 'day', 'cloudy', 'sunset'];
export const cricketOpen = (weather) => CRICKET_OPEN.includes(weather);

const SHIRTS = ['#e0463a', '#2f7bd6', '#f2b630', '#2ea86a', '#a85ad6', '#ff7a3c', '#18a8b8', '#e0529f'];
const SKINS = ['#f0c8a0', '#d8a070', '#b87a4c', '#8a5a38', '#e8b890'];
const HAIR = ['#1c1410', '#2b1d14', '#4a3020', '#0e0a08'];

// Outcome of each delivery, cycled: the ball is hit, missed or runs for four / six.
const OUTCOMES = ['hit', 'miss', 'four', 'hit', 'six', 'wicket', 'hit', 'four'];
const ANGLES = [-0.9, 0.7, 2.5, -2.0, 0.2, 1.7, -0.3, 2.9];

// Shared state ticked once per frame by <CricketGround>; kids read it.
function useCricketClock() {
  const ev = useRef({ t: 0, n: 0, ph: 0, outcome: 'hit', ang: 0, cheer: 0, hitAt: 0 });
  return ev;
}

function Kid({ p, rot = 0, shirt, pants = '#27406e', skin, hair, s = 1, role = 'idle', ev, seed = 0, bat = false, hat = null, sit = false }) {
  const root = useRef();
  const armL = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();
  const body = useRef();
  const base = useMemo(() => ({ y: p[1], z: p[2], x: p[0] }), [p]);

  useFrame((st) => {
    const g = root.current;
    if (!g) return;
    const e = ev.current;
    const t = st.clock.elapsedTime;
    const set = (r, v) => { if (r.current) r.current.rotation.x = v; };
    let by = 0;
    if (role === 'bowler') {
      const ph = e.ph;
      if (ph < 0.3) {
        const u = ph / 0.3;
        g.position.z = 1.4 + (BOWL_Z - 0.1 - 1.4) * u;
        g.rotation.y = 0;
        const sw = Math.sin(t * 16) * 0.9;
        set(legL, sw); set(legR, -sw);
        const a = u > 0.82 ? -3.2 + (u - 0.82) * 22 : -0.6 + Math.sin(t * 16) * 0.3;
        set(armR, a); set(armL, -sw * 0.5);
        by = Math.abs(Math.sin(t * 16)) * 0.08;
      } else {
        const u = Math.min(1, (ph - 0.3) / 0.6);
        g.position.z = BOWL_Z - 0.1 - (BOWL_Z - 1.5) * u;
        g.rotation.y = PI;
        const sw = Math.sin(t * 6) * 0.35 * (1 - u);
        set(legL, sw); set(legR, -sw); set(armR, 0.2); set(armL, -0.2);
      }
    } else if (role === 'batter') {
      const ph = e.ph;
      const swing = ph > 0.4 && ph < 0.56 ? (ph - 0.4) / 0.16 : 0;
      const idleTap = Math.sin(t * 3) * 0.05;
      // arms hold the bat low, then swing through
      set(armR, -0.7 + swing * 2.6 + idleTap);
      set(armL, -0.7 + swing * 2.6 + idleTap);
      g.rotation.y = PI + (ph > 0.44 && ph < 0.6 ? Math.sin(((ph - 0.44) / 0.16) * PI) * 0.7 : 0);
      by = 0;
    } else if (role === 'keeper') {
      set(armL, -1.0 + Math.sin(t * 2) * 0.05); set(armR, -1.0 + Math.sin(t * 2) * 0.05);
      by = -0.12;
    } else if (role === 'fielder') {
      // ready crouch, a little shuffle, arms up when something big happens
      const cheer = e.cheer > 0.2 && e.outcome !== 'miss' && e.outcome !== 'wicket';
      by = Math.max(0, Math.sin(t * 2 + seed)) * 0.04;
      set(armL, cheer ? -2.7 : -0.4 + Math.sin(t * 2 + seed) * 0.1); set(armR, cheer ? -2.7 : -0.4 + Math.cos(t * 2 + seed) * 0.1);
      g.position.x = base.x + Math.sin(t * 0.7 + seed) * 0.18;
      g.position.z = base.z + Math.cos(t * 0.6 + seed * 2) * 0.18;
    } else if (role === 'umpire') {
      set(armL, 0); set(armR, e.outcome === 'six' && e.cheer > 0.3 ? -3.0 : (e.outcome === 'four' && e.cheer > 0.3 ? -1.4 : 0));
    } else if (role === 'spectator') {
      const bounce = Math.abs(Math.sin(t * 7 + seed)) * 0.2 * Math.min(1, e.cheer * 1.5);
      by = bounce;
      const up = e.cheer > 0.15;
      set(armL, up ? -2.8 + Math.sin(t * 9 + seed) * 0.3 : -0.1 + Math.sin(t * 1.5 + seed) * 0.05);
      set(armR, up ? -2.8 + Math.cos(t * 9 + seed) * 0.3 : -0.1 + Math.cos(t * 1.5 + seed) * 0.05);
      if (body.current) body.current.rotation.x = up ? -0.05 : Math.sin(t * 0.8 + seed) * 0.03;
    }
    g.position.y = base.y + by;
  });

  const legH = sit ? 0.28 : 0.42;
  return (
    <group ref={root} position={p} rotation={[0, rot, 0]} scale={s}>
      <group ref={body}>
        {/* torso */}
        <mesh position={[0, legH + 0.26, 0]} castShadow><boxGeometry args={[0.38, 0.5, 0.24]} /><meshStandardMaterial color={shirt} roughness={0.8} /></mesh>
        {/* head + hair */}
        <mesh position={[0, legH + 0.74, 0]} castShadow><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
        <mesh position={[0, legH + 0.84, -0.03]}><sphereGeometry args={[0.205, 12, 8, 0, PI * 2, 0, PI * 0.55]} /><meshStandardMaterial color={hair} roughness={0.9} /></mesh>
        {hat && <mesh position={[0, legH + 0.93, 0]}><cylinderGeometry args={[0.2, 0.28, 0.12, 12]} /><meshStandardMaterial color={hat} roughness={0.8} /></mesh>}
        {/* arms pivot at the shoulder */}
        <group ref={armL} position={[-0.25, legH + 0.46, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow><boxGeometry args={[0.1, 0.44, 0.1]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
        </group>
        <group ref={armR} position={[0.25, legH + 0.46, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow><boxGeometry args={[0.1, 0.44, 0.1]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
          {bat && (
            <group position={[0, -0.42, 0.06]} rotation={[0.2, 0, 0]}>
              <mesh position={[0, -0.28, 0.02]} castShadow><boxGeometry args={[0.14, 0.7, 0.05]} /><meshStandardMaterial color="#d9b27a" roughness={0.6} /></mesh>
              <mesh position={[0, 0.12, 0.02]}><cylinderGeometry args={[0.025, 0.025, 0.24, 6]} /><meshStandardMaterial color="#2a2140" /></mesh>
            </group>
          )}
        </group>
      </group>
      {/* legs pivot at the hip */}
      <group ref={legL} position={[-0.1, legH, 0]}>
        <mesh position={[0, -legH / 2, 0]} castShadow><boxGeometry args={[0.13, legH, 0.13]} /><meshStandardMaterial color={pants} roughness={0.85} /></mesh>
      </group>
      <group ref={legR} position={[0.1, legH, 0]}>
        <mesh position={[0, -legH / 2, 0]} castShadow><boxGeometry args={[0.13, legH, 0.13]} /><meshStandardMaterial color={pants} roughness={0.85} /></mesh>
      </group>
    </group>
  );
}

function Stumps({ z }) {
  return (
    <group position={[CX, 0, z]}>
      {[-0.1, 0, 0.1].map(x => (
        <mesh key={x} position={[x, 0.36, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.72, 6]} /><meshStandardMaterial color="#f3e3b8" roughness={0.7} /></mesh>
      ))}
      <mesh position={[-0.05, 0.74, 0]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.1, 5]} /><meshStandardMaterial color="#c0392b" /></mesh>
      <mesh position={[0.05, 0.74, 0]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.1, 5]} /><meshStandardMaterial color="#c0392b" /></mesh>
    </group>
  );
}

function Ball({ ev }) {
  const ref = useRef();
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const { ph, outcome, ang } = ev.current;
    let x = CX; let y = 1.2; let z = BOWL_Z + 0.1;
    if (ph < 0.3) { z = BOWL_Z - 3.0 + (ph / 0.3) * 3.0; y = 1.1; x = CX + 0.25; }
    else if (ph < 0.46) {
      const u = (ph - 0.3) / 0.16;
      x = CX; z = BOWL_Z + (BAT_Z - 0.4 - BOWL_Z) * u;
      y = u < 0.62 ? 1.7 * (1 - u / 0.62) + 0.1 : 0.1 + (0.75 - 0.1) * ((u - 0.62) / 0.38);
    } else if (ph < 0.78) {
      const u = (ph - 0.46) / 0.32;
      if (outcome === 'miss' || outcome === 'wicket') {
        x = CX; z = BAT_Z - 0.4 + (1.3 + 0.4) * Math.min(1, u * 2.4); y = 0.75 - 0.05 * Math.min(1, u * 2.4);
        if (u > 0.42) { z = BAT_Z + 1.0; y = 0.55; }
      } else {
        const far = outcome === 'six' ? 1.12 : outcome === 'four' ? 0.95 : 0.55;
        const dx = Math.sin(ang);
        const dz = -Math.cos(ang);
        const rr = 1 / Math.hypot(dx / RX, dz / RZ);
        // start at the bat, arrive at the landing point
        const sx = CX; const sz = BAT_Z - 0.4;
        const k = Math.min(1, u * 1.25);
        x = sx + (CX + dx * rr * far - sx) * k; z = sz + (CZ + dz * rr * far - sz) * k;
        const peak = outcome === 'six' ? 4.6 : outcome === 'four' ? 0.9 : 2.0;
        y = 0.7 + Math.sin(k * PI) * peak * (outcome === 'four' ? 0.35 : 1);
        if (outcome === 'four') y = 0.12 + Math.abs(Math.sin(k * PI * 3)) * 0.35 * (1 - k);
      }
    } else {
      // returned to the bowler's hand
      const u = (ph - 0.78) / 0.22;
      const far = outcome === 'six' ? 1.12 : outcome === 'four' ? 0.95 : 0.55;
      const lx = CX + (outcome === 'miss' || outcome === 'wicket' ? 0 : Math.sin(ang) * (1 / Math.hypot(Math.sin(ang) / RX, Math.cos(ang) / RZ)) * far);
      const lz = outcome === 'miss' || outcome === 'wicket' ? BAT_Z + 1.0 : CZ - Math.cos(ang) * (1 / Math.hypot(Math.sin(ang) / RX, Math.cos(ang) / RZ)) * far;
      x = lx + (CX - lx) * u; z = lz + ((BOWL_Z - 2.6) - lz) * u; y = 0.5 + Math.sin(u * PI) * 1.4 * (1 - u * 0.2);
      if (u > 0.96) { x = CX + 0.25; z = BOWL_Z - 3.0; y = 1.1; }
    }
    m.position.set(x, y, z);
  });
  return (
    <mesh ref={ref} castShadow><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color="#c0172b" roughness={0.45} emissive="#5a0a12" emissiveIntensity={0.3} /></mesh>
  );
}

function Floodlight({ p, on }) {
  return (
    <group position={p}>
      <mesh position={[0, 2.6, 0]} castShadow><cylinderGeometry args={[0.07, 0.11, 5.2, 8]} /><meshStandardMaterial color="#8d8aa6" roughness={0.6} metalness={0.4} /></mesh>
      <group position={[0, 5.3, 0]}>
        <Box p={[0, 0, 0]} s={[1.3, 0.8, 0.14]} c="#2a2640" />
        {[-0.45, 0, 0.45].map(x => [-0.2, 0.2].map(y => (
          <mesh key={`${x}${y}`} position={[x, y, 0.09]}><circleGeometry args={[0.13, 10]} /><meshBasicMaterial color={on ? '#fff6d8' : '#4a4660'} toneMapped={false} /></mesh>
        )))}
      </group>
    </group>
  );
}

// Two tiers of wooden seats on the east side, and a bench on the west.
function Stand({ ev, open }) {
  const kids = useMemo(() => {
    const out = [];
    for (let i = 0; i < 9; i++) out.push({ p: [1.95, 0.52, 3.2 + i * 1.1], shirt: SHIRTS[(i * 3) % 8], skin: SKINS[i % 5], hair: HAIR[i % 4], seed: i * 1.7 });
    for (let i = 0; i < 8; i++) out.push({ p: [1.05, 1.02, 3.6 + i * 1.1], shirt: SHIRTS[(i * 5 + 2) % 8], skin: SKINS[(i + 2) % 5], hair: HAIR[(i + 1) % 4], seed: i * 2.3 + 1 });
    return out;
  }, []);
  const benchKids = useMemo(() => [0, 1, 2, 3].map(i => ({ p: [16.9, 0.3, 5.6 + i * 1.0], shirt: SHIRTS[(i * 2 + 1) % 8], skin: SKINS[(i + 1) % 5], hair: HAIR[i % 4], seed: i * 3.1 })), []);
  return (
    <group>
      {/* west stand (the far side from the camera, so the crowd is in view) */}
      <Box p={[1.95, 0.2, 7.6]} s={[0.9, 0.4, 9.6]} c="#8a6a46" />
      <Box p={[1.05, 0.45, 7.6]} s={[0.9, 0.9, 9.6]} c="#7a5a3a" />
      <Box p={[0.25, 1.85, 7.6]} s={[0.12, 2.5, 9.8]} c="#5a4a8a" />
      <Box p={[1.0, 3.2, 7.6]} s={[2.2, 0.14, 10]} c="#3b6fd0" r={0.04} />
      {[3, 12.2].map(z => <Box key={z} p={[2.3, 1.6, z]} s={[0.12, 3.2, 0.12]} c="#cfcbe0" />)}
      <Neon p={[2.5, 3.1, 7.6]} s={[0.05, 0.05, 9.9]} color="#3ee8ff" halo={false} />
      {open && kids.map((k, i) => <Kid key={i} {...k} s={0.78} rot={PI / 2} role="spectator" ev={ev} sit={false} />)}
      {/* low bench on the east side */}
      <Box p={[16.7, 0.28, 7.5]} s={[0.5, 0.1, 4.6]} c="#8a6a46" />
      <Box p={[17.0, 0.5, 7.5]} s={[0.1, 0.4, 4.6]} c="#7a5a3a" />
      {[5.4, 9.6].map(z => <Box key={z} p={[16.7, 0.14, z]} s={[0.4, 0.28, 0.1]} c="#3a2d66" />)}
      {open && benchKids.map((k, i) => <Kid key={i} {...k} s={0.78} rot={-PI / 2} role="spectator" ev={ev} sit />)}
    </group>
  );
}

function Scoreboard({ ev, open }) {
  const here = useContext(FocusContext) === 'cricket';
  const ref = useRef();
  const last = useRef('');
  useFrame(() => {
    const el = ref.current;
    if (!el) return;
    const n = ev.current.n;
    const txt = open ? `${(n * 4 + (n % 3) * 2 + 18) % 211}/${Math.min(9, Math.floor(n / 4))}  OV ${Math.floor(n / 6)}.${n % 6}` : 'CLOSED';
    if (txt !== last.current) { last.current = txt; el.textContent = txt; }
  });
  return (
    <group position={[CX, 0, 0.3]}>
      <Box p={[-1.3, 1.3, 0]} s={[0.14, 2.6, 0.14]} c="#4a4660" />
      <Box p={[1.3, 1.3, 0]} s={[0.14, 2.6, 0.14]} c="#4a4660" />
      <Box p={[0, 2.5, 0]} s={[3.2, 1.2, 0.18]} c="#16132b" r={0.05} />
      <Neon p={[0, 2.5, 0.12]} s={[3.0, 1.0, 0.02]} color={open ? '#ffb347' : '#3a3552'} halo={false} />
      {here && <ScaledHtml position={[0, 2.5, 0.2]} pointerEvents="none">
        <div ref={ref} className="stay-white" style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 13, color: '#fff2c8', background: '#16132b', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>-</div>
      </ScaledHtml>}
    </group>
  );
}

export function CricketFloor({ weather = 'day' }) {
  const z = FLOORPLAN_ZONES.cricket;
  const w = WEATHER[weather] || WEATHER.day;
  const strips = useMemo(() => {
    const a = new THREE.Color(w.grass);
    const b = a.clone().multiplyScalar(0.86);
    const n = 12;
    return Array.from({ length: n }, (_, i) => ({ x: -CELL_W / 2 + (i + 0.5) * (CELL_W / n), w: CELL_W / n, c: i % 2 ? b : a }));
  }, [w.grass]);
  return (
    <group position={[z.center.x, 0, z.center.z]}>
      <mesh position={[0, -0.25, 0]} receiveShadow><boxGeometry args={[CELL_W + 0.4, 0.5, CELL_D + 0.2]} /><meshStandardMaterial color="#4a3a28" roughness={1} /></mesh>
      {strips.map((s, i) => (
        <mesh key={i} rotation={[-PI / 2, 0, 0]} position={[s.x, 0.005, 0]} receiveShadow>
          <planeGeometry args={[s.w, CELL_D]} />
          <meshStandardMaterial color={s.c} roughness={1} />
        </mesh>
      ))}
      {/* the front kerb along the lane */}
      <Box p={[0, 0.12, CELL_D / 2 + 0.1]} s={[CELL_W + 0.4, 0.24, 0.3]} c="#6f6a86" shadow={false} />
    </group>
  );
}

export function CricketGround({ weather = 'day' }) {
  const open = cricketOpen(weather);
  const here = useContext(FocusContext) === 'cricket';
  const raining = !!WEATHER[weather]?.rain;
  const ev = useCricketClock();
  useFrame((_, dt) => {
    const e = ev.current;
    e.t += Math.min(dt, 0.1);
    const n = Math.floor(e.t / CYC);
    const ph = (e.t % CYC) / CYC;
    if (n !== e.n) { e.n = n; e.outcome = OUTCOMES[n % OUTCOMES.length]; e.ang = ANGLES[n % ANGLES.length]; }
    if (e.outcome === undefined) e.outcome = OUTCOMES[0];
    const prev = e.ph;
    e.ph = ph;
    if (prev < 0.47 && ph >= 0.47 && e.outcome !== 'miss' && e.outcome !== 'wicket') e.cheer = e.outcome === 'hit' ? 0.7 : 1;
    if (prev < 0.47 && ph >= 0.47 && e.outcome === 'wicket') e.cheer = 0.5;
    e.cheer = Math.max(0, e.cheer - dt * 0.45);
  });

  const fielders = useMemo(() => [
    [-0.55, 0.62], [0.5, 0.7], [1.55, 0.55], [2.4, 0.72], [-1.6, 0.5], [3.4, 0.62],
  ].map(([a, r], i) => ({ p: [CX + Math.sin(a) * RX * r, 0, CZ - Math.cos(a) * RZ * r], rot: PI + a, shirt: SHIRTS[(i * 2) % 8], skin: SKINS[i % 5], hair: HAIR[i % 4], seed: i * 1.3 })), []);

  const ropeRing = (
    <group position={[CX, 0.06, CZ]} scale={[1, 1, RZ / RX]} rotation={[PI / 2, 0, 0]}>
      <mesh><torusGeometry args={[RX, 0.05, 6, 64]} /><meshStandardMaterial color="#f4f1e6" roughness={0.9} /></mesh>
    </group>
  );
  const boardColors = ['#e0463a', '#2f7bd6', '#f2b630', '#2ea86a'];

  return (
    <Cell id="cricket">
      {ropeRing}
      {/* advertising boards just inside the rope on the far side */}
      {Array.from({ length: 11 }).map((_, i) => {
        const a = PI * 1.12 + (i / 10) * PI * 0.76;
        return <Box key={i} p={[CX + Math.cos(a) * (RX + 0.2), 0.22, CZ + Math.sin(a) * (RZ + 0.2)]} s={[1.1, 0.44, 0.08]} c={boardColors[i % 4]} rot={-a + PI / 2} shadow={false} />;
      })}
      {/* pitch */}
      <Box p={[CX, 0.012, CZ]} s={[1.3, 0.02, 7.6]} c="#c8a46c" rough={1} shadow={false} />
      {[BOWL_Z, BAT_Z].map(z => <Box key={z} p={[CX, 0.026, z]} s={[1.7, 0.01, 0.05]} c="#ffffff" shadow={false} />)}
      {[BOWL_Z - 0.55, BAT_Z + 0.55].map(z => <Box key={z} p={[CX, 0.026, z]} s={[1.9, 0.01, 0.05]} c="#ffffff" shadow={false} />)}
      <Stumps z={BOWL_Z} />
      <Stumps z={BAT_Z} />
      <Stand ev={ev} open={open} />
      <Scoreboard ev={ev} open={open} />
      {/* sight screen behind the bowler */}
      <Box p={[CX, 1.0, 0.9]} s={[3.2, 2.0, 0.1]} c="#f4f1e6" shadow={false} />
      {/* floodlights at the corners */}
      {[[1.0, 1.0], [17.0, 1.0], [1.0, 15.0], [17.0, 15.0]].map(([x, z]) => <Floodlight key={`${x}-${z}`} p={[x, 0, z]} on={weather === 'sunset'} />)}
      {/* trees outside the ground */}
      <Tree p={[17.4, 0, 14.8]} scale={1.0} />
      <Tree p={[0.8, 0, 14.6]} scale={0.9} />

      {open ? (
        <>
          <Playable game="cricket" dot={[CX, 2.2, CZ]}>
            <mesh position={[CX, 0.5, CZ]} visible={false}><boxGeometry args={[3, 1, 9]} /></mesh>
          </Playable>
          <Ball ev={ev} />
          <Kid p={[CX + 0.25, 0, 1.4]} rot={0} role="bowler" shirt="#e0463a" skin={SKINS[1]} hair={HAIR[0]} s={0.95} ev={ev} />
          <Kid p={[CX - 0.1, 0, BAT_Z + 0.15]} rot={PI} role="batter" bat shirt="#2f7bd6" skin={SKINS[2]} hair={HAIR[1]} s={0.95} ev={ev} hat="#1b3f86" />
          <Kid p={[CX, 0, BAT_Z + 1.5]} rot={PI} role="keeper" shirt="#f2b630" pants="#1c1c2c" skin={SKINS[0]} hair={HAIR[3]} s={0.9} ev={ev} />
          <Kid p={[CX + 1.5, 0, BOWL_Z - 0.9]} rot={0} role="umpire" shirt="#f4f1e6" pants="#2b2b3a" skin={SKINS[3]} hair={HAIR[0]} s={1.0} ev={ev} hat="#f4f1e6" />
          {fielders.map((f, i) => <Kid key={i} {...f} role="fielder" s={0.9} ev={ev} />)}
        </>
      ) : (
        <>
          {/* covers over the pitch, puddles and a closed sign */}
          <Box p={[CX, 0.06, CZ]} s={[1.9, 0.1, 8.0]} c="#27527a" r={0.04} rough={0.5} />
          {raining && [[5.5, 4.5, 1.1], [12.5, 10.6, 1.4], [6.4, 11.2, 0.9], [13.1, 4.4, 0.8]].map(([x, z, r], i) => (
            <mesh key={i} rotation={[-PI / 2, 0, 0]} position={[x, 0.02, z]}><circleGeometry args={[r, 18]} /><meshStandardMaterial color="#7fb0e0" transparent opacity={0.55} roughness={0.1} /></mesh>
          ))}
          <group position={[CX + 3.4, 0, CZ + 5.6]}>
            <Box p={[0, 0.45, 0]} s={[0.08, 0.9, 0.08]} c="#4a4660" />
            <Box p={[0, 1.0, 0]} s={[2.1, 0.7, 0.1]} c="#c0392b" r={0.04} />
            {here && <ScaledHtml position={[0, 1.0, 0.1]} pointerEvents="none">
              <div className="stay-white" style={{ color: '#fff', fontWeight: 900, fontSize: 11, letterSpacing: '0.06em', textAlign: 'center', whiteSpace: 'nowrap', background: 'rgba(192,57,43,0.95)', padding: '2px 8px', borderRadius: 4 }}>
                {raining ? 'GROUND CLOSED - RAIN' : 'GROUND CLOSED - TOO DARK'}
              </div>
            </ScaledHtml>}
          </group>
        </>
      )}
    </Cell>
  );
}
