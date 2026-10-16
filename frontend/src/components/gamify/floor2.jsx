import { useContext, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Plant, Chair, Table, Rug, Sofa, BeanBag, TableLamp, FloorLamp, Monitor, Bookshelf, Wardrobe, WallWindow, ViewContext, DoorLeaves, useOpenProp, PropDot } from './parts';
import { Cell } from './cell';
import { Telescope, Jhula, Vanity, FairyLights, Curtain, FlowerPatch, Teddy, Stairs } from './props';
import IndianKitchen from './indianKitchen';
import { PaintingFrame, RetroRadio, WaterBottle, WifiRouter, SmartSpeaker, PhoneCharger, Remote, PhoneFlat, SoftCouch } from './livingProps';
import { FLOOR_Y, CELL_W, CELL_D, WORLD_D, FLOOR2_ZONES, DOORWAYS_F2 } from '../../data/gamifyZones';

// The second floor: a plain, natural-coloured home (cream walls, timber floors,
// soft fabrics) — no neon. Two bedrooms, a living room, a kitchen and a balcony.

const PI = Math.PI;
const WALL_H = 4.8;
const LOW_H = 0.9;
const GAP = 1.6;
const WALL = '#efe5d2';
const TRIM = '#8a6a46';
const WOOD = '#a98260';
const DARK_WOOD = '#6e4f33';
const CREAM = '#e6d9bd';
const FRAME = '#8a6a46';
const SKY = '#bfe0f5';
const POT = '#b9663a';

const MIXED = ['#ff8aa8', '#ffd25a', '#ffffff', '#c78bff', '#ff9a5a'];

function tex(size, draw, repeat) {
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

const planks = (base, dark) => (g, n) => {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  const k = 8;
  for (let i = 0; i < k; i++) {
    const v = 0.9 + Math.random() * 0.18;
    g.fillStyle = `rgba(${dark},${(v - 0.9) * 0.6})`; g.fillRect(i * (n / k), 0, n / k, n);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(i * (n / k) + n / k - 2, 0, 2, n);
    for (let j = 0; j < 8; j++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(i * (n / k) + Math.random() * (n / k), Math.random() * n, 1, 10 + Math.random() * 30); }
  }
};

function useWallHeight(tallFor, apply) {
  const view = useContext(ViewContext);
  const h = useRef(LOW_H);
  const first = useRef(true);
  useFrame((_, dt) => {
    const want = view.current.focus === tallFor ? WALL_H : LOW_H;
    const cur = h.current;
    if (cur === want && !first.current) return;
    first.current = false;
    h.current = Math.abs(want - cur) < 0.01 ? want : cur + (want - cur) * (1 - Math.exp(-dt * 7));
    apply(h.current);
  });
}

function Wall2({ axis, at, a, b, tallFor }) {
  const body = useRef();
  const cap = useRef();
  const mid = (a + b) / 2;
  const len = b - a;
  useWallHeight(tallFor, (H) => {
    if (body.current) body.current.scale.y = H;
    if (cap.current) cap.current.position.y = H + 0.03;
  });
  const sz = axis === 'x' ? [len, 1, 0.25] : [0.25, 1, len];
  const pos = (y) => (axis === 'x' ? [mid, y, at] : [at, y, mid]);
  const capSize = axis === 'x' ? [len, 0.08, 0.34] : [0.34, 0.08, len];
  return (
    <group>
      <group ref={body} scale={[1, LOW_H, 1]}><Box p={pos(0.5)} s={sz} c={WALL} /></group>
      <group ref={cap} position={pos(LOW_H + 0.03)}><Box p={[0, 0, 0]} s={capSize} c={TRIM} shadow={false} /></group>
    </group>
  );
}

function Header2({ axis, at, g, tallFor }) {
  const ref = useRef();
  useWallHeight(tallFor, (H) => {
    const hh = H - 3.45;
    if (!ref.current) return;
    ref.current.visible = hh > 0.02;
    ref.current.scale.y = Math.max(0.0001, hh);
  });
  const sz = axis === 'x' ? [GAP * 2, 1, 0.25] : [0.25, 1, GAP * 2];
  const pos = axis === 'x' ? [g, 0.5, at] : [at, 0.5, g];
  return <group ref={ref} position={[0, 3.45, 0]} visible={false}><Box p={pos} s={sz} c={WALL} shadow={false} /></group>;
}

function Divider2({ axis, at, from, to, gaps = [], tallForAt }) {
  const segs = [];
  let cursor = from;
  [...gaps].sort((p, q) => p - q).forEach(g => {
    if (g - GAP > cursor) segs.push([cursor, g - GAP]);
    cursor = g + GAP;
  });
  if (to > cursor) segs.push([cursor, to]);
  return (
    <group>
      {segs.map(([a, b], i) => <Wall2 key={i} axis={axis} at={at} a={a} b={b} tallFor={tallForAt((a + b) / 2)} />)}
      {gaps.map(g => <Header2 key={g} axis={axis} at={at} g={g} tallFor={tallForAt(g)} />)}
    </group>
  );
}

// Wooden door frame (posts, lintel) — a plain home door opening.
function Door2({ p, axis, doorKey }) {
  const along = axis === 'x';
  const s = (len, h, th) => (along ? [len, h, th] : [th, h, len]);
  const at = (o, y) => (along ? [o, y, 0] : [0, y, o]);
  return (
    <group position={p}>
      <Box p={at(-1.75, 1.6)} s={s(0.28, 3.2, 0.34)} c={TRIM} r={0.03} />
      <Box p={at(1.75, 1.6)} s={s(0.28, 3.2, 0.34)} c={TRIM} r={0.03} />
      <Box p={at(0, 3.3)} s={s(3.8, 0.26, 0.34)} c={TRIM} r={0.04} />
      <DoorLeaves along={along} doorKey={doorKey} color="#b08a5c" handle="#e0cf9a" />
    </group>
  );
}

// Wooden railing along an edge of the floor.
function Railing({ axis, at, from, to }) {
  const n = Math.max(2, Math.round((to - from) / 1.1));
  const pos = (o, y) => (axis === 'x' ? [o, y, at] : [at, y, o]);
  const rail = axis === 'x' ? [to - from, 0.1, 0.12] : [0.12, 0.1, to - from];
  const mid = (from + to) / 2;
  return (
    <group>
      {Array.from({ length: n + 1 }).map((_, i) => <Box key={i} p={pos(from + ((to - from) * i) / n, 0.5)} s={[0.12, 1.0, 0.12]} c={TRIM} shadow={false} />)}
      <Box p={pos(mid, 1.02)} s={rail} c={DARK_WOOD} shadow={false} />
      <Box p={pos(mid, 0.55)} s={axis === 'x' ? [to - from, 0.06, 0.06] : [0.06, 0.06, to - from]} c={TRIM} shadow={false} />
    </group>
  );
}

function Bed({ p, rot = 0, w = 4.4, d = 5.4, frame = DARK_WOOD, sheet = '#f6f0e4', blanket = '#c9b08a', pillow = '#fffaf0' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.25, 0]} s={[w, 0.5, d]} c={frame} r={0.08} />
      <Box p={[0, 0.66, 0.05]} s={[w - 0.2, 0.34, d - 0.2]} c={sheet} r={0.1} />
      <Box p={[0, 0.88, d * 0.18]} s={[w - 0.16, 0.2, d * 0.62]} c={blanket} r={0.1} />
      <Box p={[0, 1.7, -d / 2 + 0.1]} s={[w + 0.2, 1.8, 0.22]} c={frame} r={0.05} />
      {(w > 3.8 ? [-w * 0.24, w * 0.24] : [0]).map(x => <Box key={x} p={[x, 0.98, -d / 2 + 0.85]} s={[w > 3.8 ? w * 0.38 : w * 0.7, 0.26, 0.8]} c={pillow} r={0.12} />)}
    </group>
  );
}

function Nightstand({ p }) {
  return (
    <group position={p}>
      <Box p={[0, 0.42, 0]} s={[0.9, 0.84, 0.8]} c={WOOD} r={0.05} />
      <Box p={[0, 0.55, 0.41]} s={[0.6, 0.05, 0.03]} c="#d9c48a" shadow={false} />
      <TableLamp p={[0, 0.84, 0]} color="#ffe2b0" />
    </group>
  );
}

function PictureFrame({ p, w = 1.0, h = 1.3, tint = '#d8c39a' }) {
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={[w, h, 0.08]} c={FRAME} shadow={false} />
      <Box p={[0, 0, 0.05]} s={[w - 0.16, h - 0.16, 0.03]} c={tint} shadow={false} />
    </group>
  );
}

function MasterBedroom() {
  return (
    <Cell id="f2bed1">
      <WallWindow p={[8, 3.4, 0.1]} w={3.2} h={1.6} color={SKY} frame={FRAME} />
      <Curtain p={[5.4, 1.55, 0.25]} w={0.9} h={2.6} color="#e9dcc4" />
      <Curtain p={[10.6, 1.55, 0.25]} w={0.9} h={2.6} color="#e9dcc4" />
      <Rug p={[8, 0, 5.2]} w={8.4} d={6.6} c="#d9c9a8" c2="#cdb88f" />
      <Bed p={[8, 0, 3.4]} w={5} d={5.6} blanket="#b9a07a" />
      <Nightstand p={[4.3, 0, 1.2]} />
      <Nightstand p={[11.7, 0, 1.2]} />
      <Wardrobe p={[13.9, 0, 0.7]} c={WOOD} id="wd-d" />
      <Wardrobe p={[16.1, 0, 0.7]} c={WOOD} id="wd-e" />
      <Vanity p={[1.9, 0, 0.8]} />
      <Box p={[8, 0.3, 7.3]} s={[3.8, 0.6, 0.9]} c="#b59470" r={0.1} />
      <Box p={[8, 0.66, 7.3]} s={[3.6, 0.12, 0.8]} c="#e9dcc4" r={0.06} shadow={false} />
      <Chair p={[2.6, 0, 12.8]} rot={0.6} c="#c9b08a" />
      <Table p={[4.2, 0, 13.6]} w={1.0} d={1.0} h={0.55} c={WOOD} leg={DARK_WOOD} />
      <Plant p={[1.2, 0, 7.0]} scale={1.1} pot={POT} />
      <Plant p={[16.8, 0, 10.4]} scale={1.2} pot={POT} />
      <FloorLamp p={[15.6, 0, 13.4]} color="#ffe2b0" />
      <PictureFrame p={[3.0, 3.1, 0.09]} />
      <PictureFrame p={[13.0, 3.1, 0.09]} w={1.5} h={1.0} tint="#b8c9b0" />
    </Cell>
  );
}

function GuestBedroom() {
  return (
    <Cell id="f2bed2">
      <WallWindow p={[9, 3.4, 0.1]} w={3.4} h={1.6} color={SKY} frame={FRAME} />
      <Curtain p={[6.5, 1.55, 0.25]} w={0.9} h={2.6} color="#cfdcc9" />
      <Curtain p={[11.5, 1.55, 0.25]} w={0.9} h={2.6} color="#cfdcc9" />
      <Rug p={[9, 0, 10.2]} w={6.6} d={4.4} c="#cbd8c4" c2="#bccbb4" />
      <Bed p={[4.2, 0, 3.4]} w={3.2} d={5.4} blanket="#9fb59a" />
      <Bed p={[13.8, 0, 3.4]} w={3.2} d={5.4} blanket="#a9b8c9" />
      <Nightstand p={[9, 0, 1.2]} />
      <Teddy p={[4.2, 1.0, 4.6]} rot={0.2} scale={0.5} color="#c9a070" />
      {/* study desk */}
      <Box p={[1.5, 0.95, 10.4]} s={[1.5, 0.12, 3.0]} c={WOOD} r={0.04} />
      <Box p={[1.5, 0.45, 9.0]} s={[1.3, 0.9, 0.14]} c={DARK_WOOD} />
      <Box p={[1.5, 0.45, 11.8]} s={[1.3, 0.9, 0.14]} c={DARK_WOOD} />
      <Monitor p={[1.4, 1.0, 10.4]} rot={PI / 2} color="#d8ecff" />
      <Chair p={[3.2, 0, 10.4]} rot={-PI / 2} c="#b59470" />
      <Bookshelf p={[17.55, 0, 9.6]} rot={-PI / 2} w={3.4} h={3.0} d={0.7} shelf="up-guest" wood="#a07850" />
      <Box p={[15.2, 0.4, 14.4]} s={[2.0, 0.8, 1.0]} c={WOOD} r={0.06} />
      <Plant p={[16.8, 0, 14.8]} scale={1.1} pot={POT} />
      <Plant p={[1.2, 0, 15.0]} scale={1.0} pot={POT} />
      <PictureFrame p={[1.8, 3.2, 0.09]} w={1.2} h={0.9} tint="#c9b8d8" />
    </Cell>
  );
}

function UpstairsHall() {
  return (
    <Cell id="f2hall">
      {/* a wide TV on a long console, with the gadgets that live around it */}
      <Box p={[9, 2.4, 0.08]} s={[7.6, 4.4, 0.1]} c="#d6c6a4" shadow={false} />
      <Box p={[9, 0.35, 0.85]} s={[6.8, 0.7, 1.1]} c={WOOD} r={0.05} />
      <Box p={[9, 2.5, 0.42]} s={[5.3, 3.45, 0.12]} c="#14161c" r={0.03} />
      <Box p={[9, 2.5, 0.49]} s={[5.08, 3.26, 0.02]} c="#232a36" shadow={false} />
      <WifiRouter p={[6.5, 0.7, 0.75]} rot={0.1} />
      <PhoneCharger p={[8.1, 0.7, 0.55]} rot={-0.1} />
      <SmartSpeaker p={[11.4, 0.7, 0.85]} />
      <Plant p={[12.3, 0.7, 0.9]} scale={0.45} pot={POT} />
      <Rug p={[9, 0, 7.4]} w={11.2} d={6.6} c="#d8c8a6" c2="#c9b48a" />
      <Sofa p={[9, 0, 11.0]} rot={PI} w={5.6} c="#d9c9a9" back="#c9b690" />
      <Sofa p={[5.3, 0, 7.4]} rot={PI / 2} w={3.4} c="#c9d2bf" back="#b4c0a8" />
      <SoftCouch p={[13.0, 0, 7.4]} rot={-PI / 2} w={2.6} />
      <BeanBag p={[13.5, 0, 4.7]} color="#e3a13c" glow="#f2c978" />
      <Table p={[9, 0, 7.4]} w={2.6} d={1.4} h={0.5} c={WOOD} leg={DARK_WOOD} />
      <Remote p={[8.4, 0.56, 7.2]} rot={0.5} />
      <PhoneFlat p={[9.6, 0.56, 7.6]} rot={-0.4} />
      <Bookshelf p={[0.45, 0, 2.4]} rot={PI / 2} w={3.0} h={3.2} d={0.7} shelf="up-hall" wood="#a07850" />
      {/* a console against the wall beside the bookshelf: the radio and some water */}
      <Table p={[2.9, 0, 0.7]} w={2.2} d={0.8} h={0.9} c={WOOD} leg={DARK_WOOD} />
      <RetroRadio p={[2.5, 0.96, 0.62]} />
      <WaterBottle p={[3.55, 0.96, 0.6]} />
      <WaterBottle p={[3.85, 0.96, 0.7]} c="#bfe3ee" />
      {/* dining set */}
      <Table p={[4.8, 0, 13.0]} w={3.2} d={1.8} h={0.95} c={WOOD} leg={DARK_WOOD} />
      {[3.8, 5.8].map(x => <Chair key={x} p={[x, 0, 11.7]} rot={0} c="#c9b08a" />)}
      {[3.8, 5.8].map(x => <Chair key={`b${x}`} p={[x, 0, 14.3]} rot={PI} c="#c9b08a" />)}
      <Plant p={[16.8, 0, 1.4]} scale={1.2} pot={POT} />
      <Stairs p={[12.8, 0, 14.2]} dir="down" />
      <Plant p={[1.2, 0, 15.0]} scale={1.0} pot={POT} />
      <FloorLamp p={[15.2, 0, 10.4]} color="#ffe2b0" />
      <PaintingFrame p={[3.0, 3.25, 0.12]} id="ophelia" />
      <PaintingFrame p={[15.0, 3.25, 0.12]} id="shalott" />
    </Cell>
  );
}

function UpstairsKitchen() {
  return (
    <Cell id="f2kitchen">
      <IndianKitchen natural set="up" />
    </Cell>
  );
}

function Balcony() {
  return (
    <Cell id="f2balcony">
      <Rug p={[4.2, 0, 4.4]} w={5.4} d={4.2} c="#d9c9a8" c2="#cdb88f" />
      <Sofa p={[4.2, 0, 2.2]} rot={0} w={4.2} c="#c9a77a" back="#b08a5c" />
      <Table p={[4.2, 0, 5.0]} w={1.8} d={1.0} h={0.5} c={WOOD} leg={DARK_WOOD} />
      <Table p={[13.6, 0, 4.0]} w={2.0} d={2.0} h={0.95} c={WOOD} leg={DARK_WOOD} />
      <Chair p={[12.4, 0, 4.0]} rot={PI / 2} c="#c9b08a" />
      <Chair p={[14.8, 0, 4.0]} rot={-PI / 2} c="#c9b08a" />
      <Jhula p={[13.0, 0, 10.6]} w={2.6} />
      <Telescope p={[16.2, 0, 1.8]} />
      <FlowerPatch p={[6.0, 0, 15.0]} w={5.0} d={1.2} n={36} colors={MIXED} seed={21} />
      <FlowerPatch p={[11.5, 0, 15.0]} w={3.0} d={1.2} n={24} colors={MIXED} seed={22} />
      <FlowerPatch p={[17.2, 0, 8.4]} w={1.2} d={5.4} n={30} colors={MIXED} seed={23} />
      <Plant p={[1.2, 0, 15.0]} scale={1.2} pot={POT} />
      <Plant p={[16.8, 0, 14.8]} scale={1.1} pot={POT} />
      <FairyLights from={1.0} to={17.0} y={4.1} z={0.3} count={22} />
    </Cell>
  );
}


// ============================================================================
// BREAKUP & HEARTBREAK ROOM (Solitude, Melancholy & Grief)
// ============================================================================

function BreakupRoom() {
  const openBreakup = useOpenProp('breakup');

  return (
    <Cell id="f2breakup">
      {/* ── 1. MOODY COLD LIGHTING & SHADOW RUGS ── */}
      <Rug p={[12.5, 0, 5.0]} w={7.5} d={7.8} c="#1e2230" c2="#161924" />
      <Rug p={[4.2, 0, 12.0]} w={4.2} d={4.2} c="#181a24" c2="#12141c" />

      {/* ── 2. THE DISHEVELED LOW PLATFORM BED OF TEARS & INSOMNIA ── */}
      <group position={[13.2, 0, 4.6]}>
        {/* Dark Ebony Wood Low Platform Bed Frame */}
        <Box p={[0, 0.22, 0]} s={[4.6, 0.44, 5.8]} c="#181a22" r={0.04} />
        {/* Mattress with Faded Navy Fitted Sheet */}
        <Box p={[0, 0.52, 0.05]} s={[4.2, 0.26, 5.4]} c="#1e2433" r={0.06} />
        {/* Tangled, Rumpled Dark Charcoal / Midnight Duvet Thrown to the Side */}
        <Box p={[-0.45, 0.68, 0.4]} s={[2.9, 0.18, 4.0]} c="#272b38" r={0.08} />
        {/* Crumpled Heavy Weighted Wool Blanket Fallen Halfway off the Bed onto Floor */}
        <Box p={[1.2, 0.36, 1.4]} s={[2.2, 0.22, 2.8]} c="#181b24" r={0.1} />

        {/* Two Pillows: One Indented with Dark Tear-Stained Hollow */}
        <Box p={[-1.1, 0.72, -2.0]} s={[1.7, 0.2, 1.0]} c="#1a1e29" r={0.12} />
        <group position={[1.1, 0.72, -2.0]}>
          <Box p={[0, 0, 0]} s={[1.7, 0.16, 1.0]} c="#161822" r={0.12} />
          {/* Tear-stain darker spot */}
          <mesh position={[0.15, 0.09, 0.05]}>
            <circleGeometry args={[0.22, 14]} />
            <meshBasicMaterial color="#0f1118" />
          </mesh>
        </group>

        {/* Headboard in Distressed Black Wood */}
        <Box p={[0, 1.4, -2.8]} s={[4.8, 2.0, 0.2]} c="#11131a" r={0.04} />

        {/* Abandoned Smartphone Face-Up with Soft Glowing Screen ("No New Messages") */}
        <group position={[0.4, 0.66, 0.7]} rotation={[0, 0.25, 0]}>
          <Box p={[0, 0.015, 0]} s={[0.3, 0.02, 0.6]} c="#09090b" r={0.02} />
          <mesh position={[0, 0.028, 0]}>
            <planeGeometry args={[0.26, 0.54]} />
            <meshBasicMaterial color="#38bdf8" toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* ── 3. MELANCHOLIC RAIN-STREAKED PICTURE WINDOW ON RIGHT WALL ── */}
      <group position={[17.85, 2.3, 8.0]}>
        <Box p={[0, 0, 0]} s={[0.1, 4.4, 6.2]} c="#0f121a" />
        <Box p={[0, 0, 0]} s={[0.12, 4.2, 0.1]} c="#1e2230" />
        <Box p={[0, 0, 0]} s={[0.12, 0.1, 6.0]} c="#1e2230" />
        {/* Tinted Rain Glass with Blue Cold Moonlight Filter */}
        <mesh position={[-0.01, 0, 0]} rotation={[0, PI / 2, 0]}>
          <planeGeometry args={[5.8, 4.0]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transparent
            opacity={0.35}
            roughness={0.1}
            transmission={0.8}
          />
        </mesh>
        {/* Cold Blue Moonlight Beam on Floor */}
        <Box p={[-3.6, -2.28, 0]} s={[7.0, 0.015, 5.6]} c="#182236" shadow={false} />
      </group>

      {/* ── 4. WRITING DESK OF BURNED LETTERS & BROKEN MEMORIES (Interactive Prop!) ── */}
      <group position={[4.2, 0, 3.4]} {...openBreakup} style={{ cursor: 'pointer' }}>
        <PropDot position={[0, 1.45, 0]} kind="breakup" />

        {/* Vintage Dark Walnut Writing Bureau */}
        <Box p={[0, 0.52, 0]} s={[3.0, 1.04, 1.6]} c="#1c1622" r={0.04} />
        <Box p={[0, 1.05, -0.6]} s={[3.0, 0.45, 0.4]} c="#15101a" />

        {/* Wooden Spindle-Back Chair Pushed Back Awkwardly */}
        <group position={[0, 0, 1.25]} rotation={[0, 0.24, 0]}>
          <Box p={[0, 0.26, -0.2]} s={[0.08, 0.52, 0.08]} c="#1a141f" />
          <Box p={[0, 0.26, 0.2]} s={[0.08, 0.52, 0.08]} c="#1a141f" />
          <Box p={[-0.4, 0.26, 0]} s={[0.08, 0.52, 0.08]} c="#1a141f" />
          <Box p={[0.4, 0.26, 0]} s={[0.08, 0.52, 0.08]} c="#1a141f" />
          <Box p={[0, 0.54, 0]} s={[0.9, 0.06, 0.85]} c="#231a2a" r={0.04} />
          <Box p={[0, 1.02, 0.38]} s={[0.9, 0.9, 0.08]} c="#1a141f" r={0.04} />
        </group>

        {/* The Heartbreak Memory Box & Journal (Embossed Leather) */}
        <group position={[0, 1.07, 0]}>
          <Box p={[0, 0.04, 0]} s={[0.7, 0.08, 0.9]} c="#4a1525" r={0.03} />
          <mesh position={[0, 0.085, 0]} rotation={[-PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* Melting Taper Candle with Dripping Wax & Fragile Flickering Flame */}
        <group position={[-1.1, 1.05, -0.2]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.06, 12]} />
            <meshStandardMaterial color="#b45309" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.024, 0.028, 0.36, 10]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.44, 0]}>
            <coneGeometry args={[0.022, 0.07, 8]} />
            <meshBasicMaterial color="#f59e0b" toneMapped={false} />
          </mesh>
        </group>

        {/* Scattered Crumpled Handwritten Letters on Desk */}
        {[
          [-0.6, 1.06, 0.3, 0.35],
          [0.7, 1.06, 0.2, -0.4],
          [-0.2, 1.06, -0.25, 0.15],
          [0.8, 1.06, -0.3, 0.6],
        ].map(([px, py, pz, prot], idx) => (
          <mesh key={idx} position={[px, py, pz]} rotation={[-PI / 2, 0, prot]}>
            <planeGeometry args={[0.26, 0.35]} />
            <meshStandardMaterial color="#fefce8" roughness={0.9} />
          </mesh>
        ))}

        {/* Small Ash Bowl with Charred Edges of Burnt Letters */}
        <group position={[1.1, 1.05, 0.2]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.12, 0.08, 0.06, 12]} />
            <meshStandardMaterial color="#1e222d" />
          </mesh>
          <mesh position={[0, 0.062, 0]} rotation={[-PI / 2, 0, 0]}>
            <circleGeometry args={[0.09, 12]} />
            <meshBasicMaterial color="#09090b" />
          </mesh>
        </group>

        {/* Face-Down Framed Couple Photo */}
        <group position={[-0.8, 1.06, 0.4]} rotation={[0, 0.6, 0]}>
          <Box p={[0, 0.015, 0]} s={[0.34, 0.03, 0.45]} c="#332211" />
          <Box p={[0, 0.032, 0]} s={[0.28, 0.005, 0.39]} c="#1e1822" />
        </group>

        {/* Cold Coffee Mug */}
        <group position={[-1.0, 1.05, 0.5]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.06, 0.05, 0.16, 12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      </group>

      {/* ── 5. THE DEAD BLACK ROSE & TOPPLED VASE IN SPILLED WATER ── */}
      <group position={[8.8, 0, 8.2]}>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.84, 16]} />
          <meshStandardMaterial color="#1a1420" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.04, 18]} />
          <meshStandardMaterial color="#231b2b" roughness={0.6} />
        </mesh>

        {/* Spilled Water Puddle */}
        <mesh position={[0.1, 0.875, 0]} rotation={[-PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
        </mesh>

        {/* Toppled Glass Vase */}
        <mesh position={[0, 0.92, -0.1]} rotation={[0, 0, PI / 2]}>
          <cylinderGeometry args={[0.07, 0.11, 0.32, 12]} />
          <meshPhysicalMaterial color="#94a3b8" transmission={0.9} transparent opacity={0.5} roughness={0.1} />
        </mesh>

        {/* Drooping Withered Crimson / Black Rose with Fallen Petals */}
        <group position={[0.15, 0.9, 0.1]}>
          <mesh position={[0, 0, 0]} rotation={[0.4, 0.2, 1.2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.38, 6]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          <mesh position={[0.18, -0.02, 0.08]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#4c0519" roughness={0.8} />
          </mesh>
          {[-0.15, 0.05, 0.2, -0.08].map((px, i) => (
            <mesh key={i} position={[px, 0.88, 0.08 + (i % 2) * 0.1]} rotation={[-PI / 2, 0, Math.random() * PI]}>
              <circleGeometry args={[0.035, 6]} />
              <meshBasicMaterial color="#881337" />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 6. THE WEEPING VELVET ARMCHAIR & COMFORT CORNER ── */}
      <group position={[3.8, 0, 12.6]}>
        <Box p={[0, 0.45, 0]} s={[1.9, 0.9, 1.8]} c="#151726" r={0.1} />
        <Box p={[0, 0.65, 0.1]} s={[1.4, 0.28, 1.3]} c="#1e2238" r={0.08} />
        <Box p={[0, 1.2, -0.7]} s={[1.9, 1.1, 0.38]} c="#151726" r={0.08} />
        <Box p={[-0.85, 0.88, 0]} s={[0.32, 0.55, 1.7]} c="#121420" r={0.06} />
        <Box p={[0.85, 0.88, 0]} s={[0.32, 0.55, 1.7]} c="#121420" r={0.06} />

        {/* Giant Heavy Knit Comfort Blanket Bundled on Armchair */}
        <Box p={[0.2, 0.86, 0.1]} s={[1.1, 0.34, 1.1]} c="#2e3548" r={0.14} />

        {/* Small Stool with Tissue Box */}
        <group position={[1.5, 0, 0.2]}>
          <Box p={[0, 0.25, 0]} s={[0.7, 0.5, 0.7]} c="#12141c" r={0.04} />
          <Box p={[0, 0.58, 0]} s={[0.38, 0.16, 0.24]} c="#475569" r={0.02} />
          <Box p={[0, 0.68, 0]} s={[0.1, 0.08, 0.08]} c="#f8fafc" />
        </group>

        {/* Crumpled Tissues Discarded on Floor Rug */}
        {[
          [0.8, 0.04, 1.2],
          [1.3, 0.04, 0.9],
          [-0.6, 0.04, 1.1],
          [0.2, 0.04, 1.4],
        ].map(([tx, ty, tz], i) => (
          <mesh key={i} position={[tx, ty, tz]}>
            <sphereGeometry args={[0.055, 6, 6]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
          </mesh>
        ))}

        {/* Lonely Teddy Bear Slumped against Chair */}
        <group position={[-1.2, 0, 0.6]} rotation={[0, 0.4, 0]}>
          <Teddy p={[0, 0, 0]} c="#453123" />
          <mesh position={[0, 0.35, 0.24]} rotation={[-0.4, 0, 0]}>
            <planeGeometry args={[0.16, 0.12]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
        </group>

        {/* Half-Eaten Ice Cream Tub with Spoon on Floor */}
        <group position={[1.4, 0, 1.1]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.09, 0.08, 0.16, 12]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          <mesh position={[0.04, 0.18, 0]} rotation={[0.4, 0, 0.3]}>
            <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ── 7. THE VINTAGE TURNTABLE PLAYING SAD RECORDS ON REPEAT ── */}
      <group position={[14.2, 0, 12.6]}>
        <Box p={[0, 0.44, 0]} s={[3.4, 0.88, 1.4]} c="#1c1622" r={0.04} />
        <Box p={[-0.4, 0.94, 0]} s={[1.2, 0.14, 1.0]} c="#271d30" r={0.03} />
        <mesh position={[-0.4, 1.02, 0]} rotation={[-PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.015, 24]} />
          <meshStandardMaterial color="#09090b" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[-0.4, 1.03, 0]} rotation={[-PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 16]} />
          <meshBasicMaterial color="#991b1b" />
        </mesh>
        <group position={[-0.05, 1.04, 0.25]} rotation={[0, 0.4, 0]}>
          <mesh rotation={[PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.4, 6]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
          </mesh>
        </group>

        {/* Stack of Sad Vinyl Record Sleeves on Table & Floor */}
        <Box p={[0.8, 0.95, -0.1]} s={[0.8, 0.08, 0.8]} c="#1e1828" r={0.02} />
        <Box p={[0.8, 1.02, -0.1]} s={[0.78, 0.06, 0.78]} c="#2b1a38" r={0.02} />
        <mesh position={[1.4, 0.35, 0.6]} rotation={[-0.2, -0.4, 0.1]}>
          <boxGeometry args={[0.65, 0.65, 0.03]} />
          <meshStandardMaterial color="#1e1b2b" />
        </mesh>
        <Box p={[-1.2, 0.93, 0.1]} s={[0.5, 0.16, 0.7]} c="#334155" />
      </group>

      {/* ── 8. THE WALL OF UNSPOKEN ECHOES & FADED POLAROIDS ── */}
      <group position={[9.0, 3.2, 0.15]}>
        <mesh position={[0, 0, 0]} rotation={[0, 0, PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 6.4, 6]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        {[-2.4, -1.2, 0, 1.2, 2.4].map((px, i) => (
          <group key={i} position={[px, -0.22, 0]} rotation={[0, 0, (i % 2 === 0 ? 0.08 : -0.08)]}>
            <mesh>
              <planeGeometry args={[0.38, 0.46]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.04, 0.005]}>
              <planeGeometry args={[0.3, 0.3]} />
              <meshBasicMaterial color={i === 2 ? '#450a0a' : '#1e293b'} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Minimalist Wall Framed Art: "Kintsugi Shattered Heart" */}
      <group position={[14.5, 2.8, 0.15]}>
        <Box p={[0, 0, 0]} s={[1.8, 2.4, 0.06]} c="#0f121a" />
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[1.6, 2.2]} />
          <meshBasicMaterial color="#181c28" />
        </mesh>
        <mesh position={[0, 0.1, 0.04]}>
          <ringGeometry args={[0.35, 0.4, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </Cell>
  );
}

export default function Floor2() {
  const view = useContext(ViewContext);
  const root = useRef();
  const z = FLOOR2_ZONES;
  const list = Object.values(z);
  const textures = useMemo(() => ({
    f2bed1: tex(256, planks('#b48a5e', '60,40,20'), [4.4, 4]),
    f2bed2: tex(256, planks('#bd9a6c', '60,40,20'), [4.4, 4]),
    f2hall: tex(256, planks('#c9a77a', '60,40,20'), [4.4, 4]),
    f2balcony: tex(256, planks('#9a7650', '40,24,10'), [4.4, 4]),
    f2breakup: tex(256, planks('#2c303c', '16,20,28'), [4.4, 4]),
    f2kitchen: tex(256, (g, n) => {
      const t = n / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#d9cfba' : '#ece4d2'; g.fillRect(i * t, j * t, t, t); }
      g.strokeStyle = 'rgba(80,60,40,0.3)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, n); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(n, i * t); g.stroke(); }
    }, [4.4, 4]),
  }), []);
  // Only drawn while you are upstairs, or when zoomed out to see the whole house.
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const v = view.current;
    const show = v.floor === 1 || v.cur < 0.8;
    if (g.visible !== show) g.visible = show;
  });
  const x0 = -27;
  const z0 = -WORLD_D / 2;
  const x1 = 27;
  const mz = z0 + CELL_D; // row boundary
  const zEnd = z0 + 2 * CELL_D; // front edge of row 1
  const vGaps = (x) => DOORWAYS_F2.filter(d => d.axis === 'v' && d.x === x).map(d => d.z);
  const hGaps = (zz) => DOORWAYS_F2.filter(d => d.axis === 'h' && d.z === zz).map(d => d.x);
  return (
    <group ref={root} position={[0, FLOOR_Y, 0]} visible={false}>
      {list.map(r => (
        <group key={r.id}>
          <Box p={[r.center.x, -0.4, r.center.z]} s={[CELL_W + 0.1, 0.8, CELL_D + 0.1]} c="#d6cdbb" />
          <mesh rotation={[-PI / 2, 0, 0]} position={[r.center.x, 0.005, r.center.z]} receiveShadow>
            <planeGeometry args={[CELL_W, CELL_D]} />
            <meshStandardMaterial map={textures[r.id]} roughness={r.id === 'f2kitchen' ? 0.4 : 0.8} />
          </mesh>
        </group>
      ))}

      {/* outer walls: back, left, and right outer walls */}
      <Box p={[0, WALL_H / 2, z0 - 0.15]} s={[x1 - x0 + 0.6, WALL_H, 0.3]} c={WALL} />
      <Box p={[x0 - 0.15, WALL_H / 2, (z0 + zEnd) / 2]} s={[0.3, WALL_H, zEnd - z0 + 0.6]} c={WALL} />
      <Box p={[x1 + 0.15, WALL_H / 2, (z0 + zEnd) / 2]} s={[0.3, WALL_H, zEnd - z0 + 0.6]} c={WALL} />
      <Box p={[0, 0.2, z0 + 0.1]} s={[x1 - x0, 0.4, 0.08]} c={TRIM} shadow={false} />
      <Box p={[x0 + 0.1, 0.2, (z0 + zEnd) / 2]} s={[0.08, 0.4, zEnd - z0]} c={TRIM} shadow={false} />
      <Box p={[x1 - 0.1, 0.2, (z0 + zEnd) / 2]} s={[0.08, 0.4, zEnd - z0]} c={TRIM} shadow={false} />
      <Box p={[0, WALL_H + 0.05, z0 - 0.15]} s={[x1 - x0 + 0.7, 0.14, 0.4]} c={TRIM} shadow={false} />
      <Box p={[x0 - 0.15, WALL_H + 0.05, (z0 + zEnd) / 2]} s={[0.4, 0.14, zEnd - z0 + 0.7]} c={TRIM} shadow={false} />
      <Box p={[x1 + 0.15, WALL_H + 0.05, (z0 + zEnd) / 2]} s={[0.4, 0.14, zEnd - z0 + 0.7]} c={TRIM} shadow={false} />

      {/* interior walls with doorways */}
      <Divider2 axis="z" at={-9} from={z0} to={zEnd} gaps={vGaps(-9)}
        tallForAt={(m) => (m < mz ? 'f2hall' : 'f2balcony')} />
      <Divider2 axis="z" at={9} from={z0} to={zEnd} gaps={vGaps(9)} tallForAt={(m) => (m < mz ? 'f2bed2' : 'f2breakup')} />
      <Divider2 axis="x" at={mz} from={x0} to={x1} gaps={hGaps(mz)} tallForAt={(m) => (m < -9 ? 'f2kitchen' : m < 9 ? 'f2balcony' : 'f2breakup')} />
      {DOORWAYS_F2.map((d, i) => <Door2 key={i} p={[d.x, 0, d.z]} axis={d.axis === 'v' ? 'z' : 'x'} doorKey={[d.a, d.b].sort().join('|')} />)}

      {/* railings along the open front edge */}
      <Railing axis="x" at={zEnd} from={x0} to={x1} />

      <MasterBedroom />
      <UpstairsHall />
      <GuestBedroom />
      <UpstairsKitchen />
      <Balcony />
      <BreakupRoom />
    </group>
  );
}
