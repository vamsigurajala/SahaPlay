import { useContext, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Plant, Chair, Table, Rug, Sofa, TableLamp, FloorLamp, Monitor, Bookshelf, Wardrobe, WallWindow, ViewContext, DoorLeaves } from './parts';
import { Cell } from './cell';
import { Telescope, Jhula, Vanity, FairyLights, Curtain, FlowerPatch, Teddy, Stairs } from './props';
import IndianKitchen from './indianKitchen';
import { FLOOR_Y, CELL_W, CELL_D, FLOOR2_ZONES, DOORWAYS_F2 } from '../../data/gamifyZones';

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
      <Box p={[9, 2.3, 0.08]} s={[6.6, 3.8, 0.1]} c="#d6c6a4" shadow={false} />
      <Box p={[9, 0.35, 0.8]} s={[5.4, 0.7, 1.0]} c={WOOD} r={0.05} />
      <Box p={[9, 2.0, 0.42]} s={[4.4, 2.4, 0.12]} c="#14161c" r={0.03} />
      <Box p={[9, 2.0, 0.49]} s={[4.2, 2.2, 0.02]} c="#232a36" shadow={false} />
      <Rug p={[9, 0, 7.4]} w={8.6} d={6.4} c="#d8c8a6" c2="#c9b48a" />
      <Sofa p={[9, 0, 11.0]} rot={PI} w={5.6} c="#d9c9a9" back="#c9b690" />
      <Table p={[9, 0, 7.4]} w={2.6} d={1.4} h={0.5} c={WOOD} leg={DARK_WOOD} />
      <Bookshelf p={[0.45, 0, 2.4]} rot={PI / 2} w={3.0} h={3.2} d={0.7} shelf="up-hall" wood="#a07850" />
      {/* dining set */}
      <Table p={[4.8, 0, 13.0]} w={3.2} d={1.8} h={0.95} c={WOOD} leg={DARK_WOOD} />
      {[3.8, 5.8].map(x => <Chair key={x} p={[x, 0, 11.7]} rot={0} c="#c9b08a" />)}
      {[3.8, 5.8].map(x => <Chair key={`b${x}`} p={[x, 0, 14.3]} rot={PI} c="#c9b08a" />)}
      <Plant p={[16.8, 0, 1.4]} scale={1.2} pot={POT} />
      <Stairs p={[12.8, 0, 14.2]} dir="down" />
      <Plant p={[1.2, 0, 15.0]} scale={1.0} pot={POT} />
      <FloorLamp p={[14.6, 0, 9.6]} color="#ffe2b0" />
      <PictureFrame p={[3.4, 3.1, 0.09]} w={1.3} h={1.0} tint="#c9b8a0" />
      <PictureFrame p={[14.6, 3.1, 0.09]} w={1.3} h={1.0} tint="#b8c9b0" />
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
  const z0 = -24;
  const x1 = 27;
  const mz = -8; // row boundary
  const zEnd = 8; // front edge of row 1
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

      {/* outer walls: back and left are always full height; the near edges are railings */}
      <Box p={[0, WALL_H / 2, z0 - 0.15]} s={[x1 - x0 + 0.6, WALL_H, 0.3]} c={WALL} />
      <Box p={[x0 - 0.15, WALL_H / 2, (z0 + zEnd) / 2]} s={[0.3, WALL_H, zEnd - z0 + 0.6]} c={WALL} />
      <Box p={[0, 0.2, z0 + 0.1]} s={[x1 - x0, 0.4, 0.08]} c={TRIM} shadow={false} />
      <Box p={[x0 + 0.1, 0.2, (z0 + zEnd) / 2]} s={[0.08, 0.4, zEnd - z0]} c={TRIM} shadow={false} />
      <Box p={[0, WALL_H + 0.05, z0 - 0.15]} s={[x1 - x0 + 0.7, 0.14, 0.4]} c={TRIM} shadow={false} />
      <Box p={[x0 - 0.15, WALL_H + 0.05, (z0 + zEnd) / 2]} s={[0.4, 0.14, zEnd - z0 + 0.7]} c={TRIM} shadow={false} />

      {/* interior walls with doorways */}
      <Divider2 axis="z" at={-9} from={z0} to={zEnd} gaps={vGaps(-9)}
        tallForAt={(m) => (m < mz ? 'f2hall' : 'f2balcony')} />
      <Divider2 axis="z" at={9} from={z0} to={mz} gaps={vGaps(9)} tallForAt={() => 'f2bed2'} />
      <Divider2 axis="x" at={mz} from={x0} to={9} gaps={hGaps(mz)} tallForAt={(m) => (m < -9 ? 'f2kitchen' : 'f2balcony')} />
      {DOORWAYS_F2.map((d, i) => <Door2 key={i} p={[d.x, 0, d.z]} axis={d.axis === 'v' ? 'z' : 'x'} doorKey={[d.a, d.b].sort().join('|')} />)}

      {/* railings along the open edges */}
      <Railing axis="x" at={zEnd} from={x0} to={9} />
      <Railing axis="z" at={9} from={mz} to={zEnd} />
      <Railing axis="z" at={x1} from={z0} to={mz} />
      <Railing axis="x" at={mz} from={9} to={x1} />

      <MasterBedroom />
      <UpstairsHall />
      <GuestBedroom />
      <UpstairsKitchen />
      <Balcony />
    </group>
  );
}
