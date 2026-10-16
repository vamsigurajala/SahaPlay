import { useContext, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Plant, BeanBag, FloorLamp, PropDot, ScaledHtml, FocusContext, ZoneContext, useOpenProp } from './parts';
import { Cell } from './cell';
import { Teddy, FairyLights } from './props';
import { PaintingFrame, SoftCouch } from './livingProps';
import { Cyl, Rod, PI } from './shopParts';
import { getCalmMusic } from './calmMusic';
import { useBreakupLang } from './breakupLang';
import { ROOM_PAINTING } from '../../data/gamifyIndianPaintings';

// The Breakup Room: a quiet, warm corner for people who are hurting. Soft light, a deep
// couch and cushions, candles, a cup of tea, a desk for unsent letters and a record
// player. Tapping the record player opens calm music (the song then plays in a small
// player in the corner); the desk and the notebook open the letters and the journal.

const WOOD = '#6b4a33';
const WOOD_DARK = '#4a3222';

function Candle({ p, seed = 0, h = 0.22 }) {
  const flame = useRef();
  const glow = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime + seed * 3;
    const f = 0.9 + 0.2 * Math.sin(t * 11) * Math.sin(t * 5.3);
    if (flame.current) flame.current.scale.set(0.9 + 0.1 * Math.sin(t * 9), f, 0.9);
    if (glow.current) glow.current.scale.setScalar(0.9 + 0.15 * f);
  });
  return (
    <group position={p}>
      <Cyl p={[0, h / 2, 0]} r={0.06} h={h} c="#f3e9d2" rough={0.8} shadow={false} />
      <mesh ref={flame} position={[0, h + 0.07, 0]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#ffc058" toneMapped={false} /></mesh>
      <mesh ref={glow} position={[0, h + 0.08, 0]}><sphereGeometry args={[0.2, 10, 8]} /><meshBasicMaterial color="#ffae42" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
    </group>
  );
}

function TeaMug({ p }) {
  const puffs = useRef([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.35 + i / 3) % 1;
      m.position.set(Math.sin(t + i * 2) * 0.04 * u, 0.1 + u * 0.6, Math.cos(t * 0.8 + i) * 0.04 * u);
      m.scale.setScalar(0.05 + u * 0.12);
      m.material.opacity = Math.sin(u * PI) * 0.28;
    });
  });
  return (
    <group position={p}>
      <Cyl p={[0, 0.1, 0]} r={0.11} r2={0.09} h={0.2} c="#f6efe2" rough={0.5} shadow={false} />
      <Cyl p={[0, 0.19, 0]} r={0.085} h={0.01} c="#a3622b" shadow={false} />
      <mesh position={[0.13, 0.11, 0]} rotation={[0, 0, PI / 2]}><torusGeometry args={[0.05, 0.015, 6, 12, PI]} /><meshStandardMaterial color="#f6efe2" /></mesh>
      {[0, 1, 2].map(i => <mesh key={i} ref={(m) => { puffs.current[i] = m; }} position={[0, 0.3, 0]}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} /></mesh>)}
    </group>
  );
}

// The record player. The record spins and the speakers pulse while music is playing.
function MusicCorner({ p, rot = 0 }) {
  const open = useOpenProp('breakup', 'music');
  const record = useRef();
  const arm = useRef();
  const cones = useRef([]);
  useFrame((state, dt) => {
    const on = !!getCalmMusic().current;
    const t = state.clock.elapsedTime;
    if (record.current && on) record.current.rotation.y -= Math.min(dt, 0.1) * 3.4;
    if (arm.current) arm.current.rotation.y += ((on ? -0.55 : 0.1) - arm.current.rotation.y) * Math.min(1, dt * 4);
    cones.current.forEach((c, i) => { if (c) c.scale.setScalar(on ? 1 + 0.06 * Math.sin(t * (9 + i * 2)) : 1); });
  });
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <group {...open}>
        <Box p={[0, 0.5, 0]} s={[5.4, 1.0, 1.1]} c={WOOD} r={0.04} />
        {[-1.8, 0, 1.8].map(x => <Box key={x} p={[x, 0.5, 0.56]} s={[1.6, 0.8, 0.04]} c={WOOD_DARK} shadow={false} />)}
        {[-2.4, 2.4].map(x => <Cyl key={x} p={[x, -0.0, 0.3]} r={0.05} h={0.02} c={WOOD_DARK} shadow={false} />)}
        {/* turntable */}
        <Box p={[-0.2, 1.08, 0]} s={[1.5, 0.14, 1.0]} c="#26262c" r={0.03} />
        <group ref={record} position={[-0.38, 1.18, 0.02]}>
          <Cyl p={[0, 0, 0]} r={0.43} h={0.025} c="#0c0c10" rough={0.3} shadow={false} />
          <Cyl p={[0, 0.015, 0]} r={0.14} h={0.01} c="#d6402f" shadow={false} />
          <Cyl p={[0.2, 0.014, 0]} r={0.2} h={0.004} c="#1a1a20" rough={0.2} shadow={false} />
        </group>
        <group position={[0.38, 1.16, -0.3]}>
          <Cyl p={[0, 0.05, 0]} r={0.06} h={0.1} c="#b8bcc4" metal={0.8} shadow={false} />
          <group ref={arm} rotation={[0, 0.1, 0]}><Rod a={[0, 0.1, 0]} b={[-0.1, 0.1, 0.62]} r={0.014} c="#cfd3da" /></group>
        </group>
        {/* speakers */}
        {[-2.0, 1.9].map((x, i) => (
          <group key={x} position={[x, 1.0, 0]}>
            <Box p={[0, 0.62, 0]} s={[0.85, 1.24, 0.75]} c="#4a3524" r={0.04} />
            <group ref={(m) => { cones.current[i] = m; }} position={[0, 0.5, 0.39]}>
              <Cyl p={[0, 0, 0]} r={0.27} h={0.04} c="#1c1c20" rot={[PI / 2, 0, 0]} shadow={false} />
              <Cyl p={[0, 0, 0.03]} r={0.09} h={0.04} c="#3a3a40" rot={[PI / 2, 0, 0]} shadow={false} />
            </group>
            <group position={[0, 0.98, 0.39]}><Cyl p={[0, 0, 0]} r={0.1} h={0.03} c="#1c1c20" rot={[PI / 2, 0, 0]} shadow={false} /></group>
          </group>
        ))}
        {/* a few records leaning on the cabinet */}
        {['#d9b36a', '#7a8fa8', '#c06a6a', '#6a8a6a'].map((c, i) => <Box key={c} p={[1.0 + i * 0.07, 1.25, 0.05 - i * 0.02]} s={[0.04, 0.55, 0.55]} c={c} shadow={false} />)}
      </group>
      <PropDot position={[-0.2, 2.2, 0.2]} kind="breakup" arg="music" />
    </group>
  );
}

// The writing desk: unsent letters.
function LetterDesk({ p }) {
  const open = useOpenProp('breakup', 'letters');
  return (
    <group position={p}>
      <group {...open}>
        <Box p={[0, 0.78, 0]} s={[3.0, 0.1, 1.3]} c={WOOD} r={0.03} />
        {[[-1.35, -0.5], [1.35, -0.5], [-1.35, 0.5], [1.35, 0.5]].map(([x, z], i) => <Box key={i} p={[x, 0.37, z]} s={[0.1, 0.74, 0.1]} c={WOOD_DARK} />)}
        <Box p={[0.8, 0.45, 0]} s={[1.0, 0.7, 1.1]} c={WOOD_DARK} r={0.03} />
        {/* paper, an envelope and a pen */}
        <Box p={[-0.5, 0.85, 0.1]} s={[0.7, 0.012, 0.5]} c="#f6efe2" rot={0.2} shadow={false} />
        <Box p={[-0.2, 0.86, -0.2]} s={[0.45, 0.014, 0.3]} c="#e8d6b0" rot={-0.3} shadow={false} />
        <Box p={[-0.9, 0.86, 0.25]} s={[0.3, 0.01, 0.015]} c="#1d4ed8" rot={0.6} shadow={false} />
        <TableLampLite p={[1.0, 0.83, -0.35]} />
      </group>
      <Box p={[0.1, 0.5, 1.15]} s={[0.9, 0.1, 0.9]} c="#8a6a52" r={0.04} />
      <Box p={[0.1, 0.25, 1.15]} s={[0.12, 0.5, 0.12]} c={WOOD_DARK} />
      <Box p={[0.1, 0.95, 1.55]} s={[0.9, 0.9, 0.1]} c="#8a6a52" r={0.04} />
      <PropDot position={[-0.3, 1.6, 0]} kind="breakup" arg="letters" />
    </group>
  );
}

function TableLampLite({ p }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.02, 0]} r={0.13} h={0.04} c="#3a2a1e" shadow={false} />
      <Cyl p={[0, 0.22, 0]} r={0.02} h={0.4} c="#b8955a" metal={0.6} shadow={false} />
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.1, 0.2, 0.26, 14, 1, true]} /><meshStandardMaterial color="#ffe2b0" emissive="#ffc06a" emissiveIntensity={0.9} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

// A small music player on the low table: tap it to open the music panel. Its speaker
// cones pulse and its level bars dance while something is playing.
function TablePlayer({ p, rot = 0 }) {
  const open = useOpenProp('breakup', 'music');
  const cones = useRef([]);
  const bars = useRef([]);
  const led = useRef();
  useFrame((state) => {
    const on = !!getCalmMusic().current;
    const t = state.clock.elapsedTime;
    cones.current.forEach((c, i) => { if (c) c.scale.setScalar(on ? 1 + 0.08 * Math.sin(t * (10 + i * 3)) : 1); });
    bars.current.forEach((b, i) => { if (b) b.scale.y = on ? 0.35 + 0.65 * Math.abs(Math.sin(t * (4 + i * 1.7) + i)) : 0.15; });
    if (led.current) led.current.material.color.set(on ? '#5cff9d' : '#ff6a5c');
  });
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <group {...open}>
        <Box p={[0, 0.17, 0]} s={[0.78, 0.34, 0.3]} c="#2b2b33" r={0.04} />
        <Box p={[0, 0.355, 0]} s={[0.5, 0.03, 0.04]} c="#9a9aa6" metal={0.7} shadow={false} />
        {[-0.28, 0.28].map((x, i) => (
          <group key={x} ref={(m) => { cones.current[i] = m; }} position={[x, 0.17, 0.155]}>
            <Cyl p={[0, 0, 0]} r={0.1} h={0.02} c="#15151a" rot={[PI / 2, 0, 0]} shadow={false} />
            <Cyl p={[0, 0, 0.012]} r={0.04} h={0.02} c="#3a3a44" rot={[PI / 2, 0, 0]} shadow={false} />
          </group>
        ))}
        {/* level bars and a status light */}
        {[0, 1, 2, 3, 4].map(i => (
          <mesh key={i} ref={(m) => { bars.current[i] = m; }} position={[-0.1 + i * 0.05, 0.2, 0.156]} scale={[1, 0.15, 1]}>
            <boxGeometry args={[0.03, 0.14, 0.01]} /><meshBasicMaterial color="#7dd3fc" toneMapped={false} />
          </mesh>
        ))}
        <mesh ref={led} position={[0.2, 0.28, 0.156]}><sphereGeometry args={[0.014, 8, 6]} /><meshBasicMaterial color="#ff6a5c" toneMapped={false} /></mesh>
      </group>
      <PropDot position={[0, 0.8, 0.1]} kind="breakup" arg="music" />
    </group>
  );
}

// The low table with candles, tea, tissues and the journal.
function LowTable({ p }) {
  const openJournal = useOpenProp('breakup', 'burn');
  return (
    <group position={p}>
      <Cyl p={[0, 0.42, 0]} r={1.0} h={0.08} c="#8a6a52" />
      <Cyl p={[0, 0.2, 0]} r={0.14} h={0.4} c={WOOD_DARK} />
      <Cyl p={[0, 0.03, 0]} r={0.55} h={0.06} c={WOOD_DARK} />
      <Candle p={[-0.1, 0.46, 0.05]} seed={0} h={0.28} />
      <Candle p={[0.12, 0.46, -0.12]} seed={1} h={0.18} />
      <Candle p={[0.02, 0.46, 0.28]} seed={2} h={0.12} />
      <TeaMug p={[0.5, 0.46, 0.2]} />
      <TablePlayer p={[0.1, 0.46, -0.55]} rot={0.15} />
      {/* tissues */}
      <Box p={[-0.5, 0.55, 0.3]} s={[0.36, 0.16, 0.2]} c="#cfe3ef" r={0.03} shadow={false} />
      <Box p={[-0.5, 0.66, 0.3]} s={[0.14, 0.1, 0.1]} c="#ffffff" r={0.04} rot={0.4} shadow={false} />
      {/* the journal */}
      <group position={[-0.62, 0.48, -0.1]} rotation={[0, 0.9, 0]} {...openJournal}>
        <Box p={[0, 0.02, 0]} s={[0.5, 0.05, 0.36]} c="#5a4a7a" r={0.015} />
        <Box p={[0, 0.052, 0]} s={[0.46, 0.012, 0.32]} c="#f6efe2" shadow={false} />
        <Box p={[0.12, 0.07, 0.05]} s={[0.22, 0.012, 0.012]} c="#1d4ed8" rot={0.5} shadow={false} />
      </group>
    </group>
  );
}

function RoundRug({ p, r, c, c2 }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.03, 0]} r={r} h={0.06} c={c} rough={1} shadow={false} seg={40} />
      <Cyl p={[0, 0.065, 0]} r={r * 0.78} h={0.02} c={c2} rough={1} shadow={false} seg={40} />
      <Cyl p={[0, 0.08, 0]} r={r * 0.5} h={0.012} c={c} rough={1} shadow={false} seg={40} />
    </group>
  );
}

function FloorCushion({ p, c, r = 0.42 }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.11, 0]} scale={[1, 0.38, 1]} castShadow><sphereGeometry args={[r, 16, 12]} /><meshStandardMaterial color={c} roughness={1} /></mesh>
    </group>
  );
}

export function BreakupRoom() {
  const lang = useBreakupLang();
  const focus = useContext(FocusContext);
  const zone = useContext(ZoneContext);
  const here = focus === zone;
  return (
    <Cell id="f2breakup">
      <RoundRug p={[10.6, 0, 8.6]} r={4.2} c="#d9cbb2" c2="#b9c7d6" />

      <MusicCorner p={[0.7, 0, 13.0]} rot={PI / 2} />
      <LetterDesk p={[3.0, 0, 0.9]} />
      <PaintingFrame p={[13.6, 3.3, 0.12]} id={ROOM_PAINTING[lang]} maxW={2.4} maxH={2.3} />

      {/* the deep couch against the back wall, with a blanket and cushions */}
      <SoftCouch p={[13.8, 0, 2.1]} rot={0} w={3.6} c="#8aa0b8" seat="#a3b6cb" pillow="#f2e6d0" />
      <Box p={[12.7, 0.98, 2.3]} s={[1.5, 0.08, 1.0]} c="#c9a7b3" r={0.04} rot={0.15} rough={1} shadow={false} />
      <Box p={[12.2, 0.88, 2.9]} s={[1.0, 0.1, 0.5]} c="#c9a7b3" r={0.04} rot={-0.2} rough={1} shadow={false} />

      <LowTable p={[10.2, 0, 8.4]} />
      <FloorCushion p={[8.3, 0, 10.4]} c="#a89cc8" />
      <FloorCushion p={[9.2, 0, 11.2]} c="#e0b4a0" r={0.36} />
      <BeanBag p={[14.6, 0, 8.0]} color="#b9a7d6" glow="#d9cbf0" />
      <BeanBag p={[13.8, 0, 10.7]} color="#a8c0a0" glow="#cfe0c8" />
      <Teddy p={[13.8, 0.55, 10.5]} rot={-2.2} scale={0.5} color="#c9a070" />

      <FloorLamp p={[17.0, 0, 1.2]} color="#ffcf8a" />
      <FloorLamp p={[2.0, 0, 14.6]} color="#ffcf8a" />
      <Plant p={[1.4, 0, 6.0]} scale={1.25} color="#2f9e5a" pot="#b9663a" />
      <Plant p={[17.0, 0, 13.6]} scale={0.95} color="#38a869" pot="#8a6a52" />
      <Plant p={[5.6, 0, 1.0]} scale={0.8} color="#4ab57a" pot="#b9663a" />
      <FairyLights from={0.8} to={17.2} y={4.2} z={0.35} count={26} sag={0.5} />

      {here && (
        <ScaledHtml position={[9, 3.6, 0.5]} pointerEvents="none">
          <div className="stay-white" style={{ padding: '4px 14px', borderRadius: 99, background: 'rgba(20,16,32,0.82)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontWeight: 700, fontSize: 12, fontStyle: 'italic', whiteSpace: 'nowrap' }}>Take your time. You are safe here.</div>
        </ScaledHtml>
      )}
    </Cell>
  );
}
