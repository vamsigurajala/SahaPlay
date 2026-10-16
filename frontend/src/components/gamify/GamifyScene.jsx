import { useMemo, useRef, useContext, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { DoorOpen, LogOut, Shirt, ArrowUp, ArrowDown } from 'lucide-react';
import { Box, Neon, ScaledHtml, DoorFrame, ViewContext, HotChip, FocusContext } from './parts';
import { Study, LivingRoom, Bedroom, Kitchen, GameRoom, Garden, Terrace, FrontYard, Courtyard } from './placedRooms';
import { NEON_PINK, NEON_CYAN, NEON_VIOLET, NEON_AMBER } from './constants';
import { WORLD_W, WORLD_D, CELL_W, CELL_D, COLS, ROWS, FLOORPLAN_ZONES, ALL_ZONES, FLOOR_Y, DOORWAYS, ALL_LINKS } from '../../data/gamifyZones';
import Floor2 from './floor2';
import { WEATHER, Ground, Clouds, Rain } from './environment';

export const WALL_H = 4.8;
const LOW_H = 0.9;
const GAP = 1.6; // half-width of a doorway
const DOOR_COLORS = [NEON_CYAN, NEON_PINK, NEON_VIOLET, NEON_AMBER];

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

const zoneAt = (col, row) => Object.values(FLOORPLAN_ZONES).find(z => z.col === col && z.row === row);

// One run of interior wall. The camera sits on the +x/+z side, so a wall is the
// FAR (back/left) wall of the room on its +x / +z side and the NEAR wall of the
// room on its other side. A near wall would hide the floor behind it, so each
// run is full height only while the room it backs is the one being viewed, and
// eases down to a low cutaway wall otherwise.
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

function WallSeg({ axis, at, a, b, color, tallFor }) {
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
  const capSize = axis === 'x' ? [len, 0.05, 0.07] : [0.07, 0.05, len];
  return (
    <group>
      <group ref={body} scale={[1, LOW_H, 1]}><Box p={pos(0.5)} s={sz} c="#33265a" /></group>
      <group ref={cap} position={pos(LOW_H + 0.03)}><Neon p={[0, 0, 0]} s={capSize} color={color} halo={false} /></group>
    </group>
  );
}

// The wall above a doorway (door-frame height up to the wall top). Collapses to
// nothing while the wall is low.
function GapHeader({ axis, at, g, tallFor }) {
  const ref = useRef();
  useWallHeight(tallFor, (H) => {
    const hh = H - 3.45;
    if (!ref.current) return;
    ref.current.visible = hh > 0.02;
    ref.current.scale.y = Math.max(0.0001, hh);
  });
  const sz = axis === 'x' ? [GAP * 2, 1, 0.25] : [0.25, 1, GAP * 2];
  const pos = axis === 'x' ? [g, 0.5, at] : [at, 0.5, g];
  return <group ref={ref} position={[0, 3.45, 0]} visible={false}><Box p={pos} s={sz} c="#33265a" shadow={false} /></group>;
}

// Interior wall with doorway gaps. axis 'x' runs along x at z=at; 'z' runs along
// z at x=at.
function Divider({ axis, at, from, to, gaps = [], color, tallForAt }) {
  const segs = [];
  let cursor = from;
  [...gaps].sort((p, q) => p - q).forEach(g => {
    if (g - GAP > cursor) segs.push([cursor, g - GAP]);
    cursor = g + GAP;
  });
  if (to > cursor) segs.push([cursor, to]);
  return (
    <group>
      {segs.map(([a, b], i) => <WallSeg key={i} axis={axis} at={at} a={a} b={b} color={color} tallFor={tallForAt((a + b) / 2)} />)}
      {gaps.map(g => <GapHeader key={g} axis={axis} at={at} g={g} tallFor={tallForAt(g)} />)}
    </group>
  );
}

// Directional light that follows the room being viewed, so the shadow map covers
// only what's on screen (sharper shadows than one map stretched over the house).
function FollowLight({ shadows, size, sun }) {
  const view = useContext(ViewContext);
  const light = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const v = view.current;
    // This light lives inside the (maybe mirrored) scene root: undo the mirror to get local coords.
    const lx = v.flip ? v.pz : v.px;
    const lz = v.flip ? v.px : v.pz;
    target.position.set(lx, (v.floor || 0) * FLOOR_Y, lz);
    l.position.set(lx + sun.pos[0], (v.floor || 0) * FLOOR_Y + sun.pos[1], lz + sun.pos[2]);
    target.updateMatrixWorld();
  });
  return (
    <>
      <directionalLight ref={light} target={target} intensity={sun.int} color={sun.color} castShadow={shadows} shadow-mapSize={[size, size]}
        shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0004} />
      <primitive object={target} />
    </>
  );
}

// Floating room name — only shown when zoomed out (up close, the top-of-screen
// pill already says which room you are in).
function RoomSign({ z }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.style.opacity = view.current.cur < 0.8 ? '1' : '0'; });
  return (
    <ScaledHtml position={[z.center.x, 0.3 + (z.floor || 0) * FLOOR_Y, z.center.z]} pointerEvents="none">
      <div ref={ref} className="stay-white" style={{
        padding: '3px 14px', borderRadius: 99, background: 'rgba(12,10,24,0.72)', color: 'rgba(255,255,255,0.9)',
        fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(3px)', userSelect: 'none', transition: 'opacity .25s',
      }}>{z.label}</div>
    </ScaledHtml>
  );
}

function DoorChip({ link, onGo }) {
  const view = useContext(ViewContext);
  const ref = useRef();
  const dest = ALL_ZONES[link.to];
  const stairs = !!link.dir;
  const base = (ALL_ZONES[link.from].floor || 0) * FLOOR_Y;
  useFrame(() => {
    const el = ref.current;
    if (!el) return;
    const on = view.current.focus === link.from && (view.current.alwaysDots || view.current.uiVisible !== false);
    el.style.opacity = on ? '1' : '0';
    el.style.pointerEvents = on ? 'auto' : 'none';
  });
  return (
    <ScaledHtml position={[link.chip.x, base + 2.3, link.chip.z]} zIndexRange={[35, 0]}>
      <div ref={ref} style={{ transition: 'opacity .18s' }}>
        <button
          className="stay-white"
          onClick={() => onGo(link)}
          onPointerDown={e => e.stopPropagation()}
          title={link.label || `Go to ${dest.label}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
            background: 'rgba(12,10,24,0.78)', color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
            border: '1px solid rgba(139,92,255,0.8)', boxShadow: '0 0 14px rgba(139,92,255,0.55)', backdropFilter: 'blur(4px)',
          }}
        >
          {stairs ? (link.dir === 'up' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <DoorOpen size={14} />}
          {link.label || dest.label}
        </button>
      </div>
    </ScaledHtml>
  );
}

// Bedroom: one tap swings every wardrobe open (or shut) — or tap a wardrobe itself.
const WARDROBE_IDS = ['wd-a', 'wd-b', 'wd-c'];
function WardrobeChip() {
  const view = useContext(ViewContext);
  const [, force] = useState(0);
  const z = FLOORPLAN_ZONES.bedroom.world;
  const open = WARDROBE_IDS.some(id => view.current.open?.[id]);
  const toggle = () => {
    const o = view.current.open || (view.current.open = {});
    const next = !WARDROBE_IDS.some(id => o[id]);
    WARDROBE_IDS.forEach(id => { o[id] = next; });
    if (next) view.current.openProp?.('wardrobe', WARDROBE_IDS[0]);
    force(n => n + 1);
  };
  return (
    <HotChip position={[z.x0 + 11.8, 2.2, z.z0 + 2.6]} zone="bedroom" label={open ? 'Close wardrobes' : 'Open wardrobes'} icon={<Shirt size={12} />} onClick={toggle} />
  );
}

// The front gate: leaves the house to visit another one.
function ExitChip({ onExit }) {
  const gate = FLOORPLAN_ZONES.frontyard;
  return (
    <HotChip
      position={[gate.center.x, 2.6, gate.world.z1 - 2.6]}
      zone="frontyard"
      label="Leave house"
      icon={<LogOut size={13} />}
      onClick={() => onExit && onExit()}
    />
  );
}

// A fixed handful of point lights that glide to the rooms nearest the view. Every
// point light costs every pixel, so 14 static ones (one per room) were far too
// many; this keeps the glow of the rooms you can see at a fraction of the cost.
const POOL = 5;
function LightPool({ lights, neon }) {
  const view = useContext(ViewContext);
  const refs = useRef([]);
  const slots = useRef(Array.from({ length: POOL }, (_, i) => ({ id: lights[i].id })));
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const v = view.current;
    const lx = v.flip ? v.pz : v.px;
    const lz = v.flip ? v.px : v.pz;
    const fl = v.floor || 0;
    const ranked = lights
      .map(l => ({ l, d: Math.hypot(l.x - lx, l.z - lz) + (l.floor === fl ? 0 : 14) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, POOL)
      .map(r => r.l);
    const want = new Set(ranked.map(l => l.id));
    const have = new Set(slots.current.map(s => s.id));
    const missing = ranked.filter(l => !have.has(l.id));
    slots.current.forEach(s => { if (!want.has(s.id) && missing.length) s.id = missing.shift().id; });
    const k = 1 - Math.exp(-dt * 5);
    slots.current.forEach((s, i) => {
      const light = refs.current[i];
      const t = lights.find(l => l.id === s.id);
      if (!light || !t) return;
      light.position.x += (t.x - light.position.x) * k;
      light.position.y += (t.y - light.position.y) * k;
      light.position.z += (t.z - light.position.z) * k;
      light.color.lerp(tmp.set(t.color), k);
      light.intensity += (t.intensity * neon - light.intensity) * k;
    });
  });
  return (
    <>
      {slots.current.map((s, i) => {
        const t = lights.find(l => l.id === s.id);
        return <pointLight key={i} ref={el => { refs.current[i] = el; }} position={[t.x, t.y, t.z]} color={t.color} intensity={t.intensity * neon} distance={26} decay={2} />;
      })}
    </>
  );
}

export default function GamifyScene({ onGoToRoom, onExitHouse, focus, zoomedOut, lowQ, coarse, weather = 'night' }) {
  const wx = WEATHER[weather];
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
    }, [5.4, 4.8]),
    study: canvasTexture(128, carpet('#2a4a80'), [7, 6.4]),
    bedroom: canvasTexture(128, carpet('#5a3a86'), [7, 6.4]),
    kitchen: canvasTexture(256, (g, n) => {
      const t = n / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#e0b88a' : '#f1e0c0'; g.fillRect(i * t, j * t, t, t); }
      g.strokeStyle = 'rgba(90,50,20,0.35)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, n); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(n, i * t); g.stroke(); }
    }, [5.4, 4.8]),
    gameroom: canvasTexture(256, (g, n) => {
      g.fillStyle = '#17133a'; g.fillRect(0, 0, n, n);
      g.strokeStyle = 'rgba(62,232,255,0.28)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * n / 4, 0); g.lineTo(i * n / 4, n); g.stroke(); g.beginPath(); g.moveTo(0, i * n / 4); g.lineTo(n, i * n / 4); g.stroke(); }
    }, [5.4, 4.8]),
    terrace: canvasTexture(256, (g, n) => {
      g.fillStyle = '#9a7a56'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,255,0.06' : '0,0,0,0.12'})`; g.fillRect(0, i * (n / 6), n, n / 6 - 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, i * (n / 6) + n / 6 - 2, n, 2); }
    }, [5.4, 4.8]),
    frontyard: canvasTexture(256, (g, n) => {
      g.fillStyle = '#6a687a'; g.fillRect(0, 0, n, n);
      const t = n / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#757386' : '#615f72'; g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4); }
    }, [5.4, 4.8]),
    courtyard: canvasTexture(256, (g, n) => {
      g.fillStyle = '#c98a5a'; g.fillRect(0, 0, n, n);
      const t = n / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#d49a6a' : '#be7d4c'; g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4); }
    }, [5.4, 4.8]),
    lawn: canvasTexture(512, (g, n) => {
      // Smooth realistic meadow grass with organic dappled shading
      g.fillStyle = '#256335'; g.fillRect(0, 0, n, n);
      const shades = ['#2b733e', '#1f532c', '#318247', '#1b4a26', '#399151'];
      for (let p = 0; p < 28; p++) {
        g.fillStyle = shades[p % shades.length];
        g.beginPath();
        g.arc(Math.random() * n, Math.random() * n, 25 + Math.random() * 45, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < 2500; k++) {
        const bright = Math.random() > 0.45;
        g.fillStyle = bright ? 'rgba(120, 230, 150, 0.12)' : 'rgba(10, 40, 18, 0.15)';
        g.fillRect(Math.random() * n, Math.random() * n, 1.5, 2.5);
      }
    }, [4, 3.5]),
  }), []);

  const zones = Object.values(FLOORPLAN_ZONES);
  const halfW = WORLD_W / 2;
  const halfD = WORLD_D / 2;
  const roomLights = [
    ['study', NEON_CYAN, 3.4, 44], ['hall', NEON_PINK, 3.6, 60], ['bedroom', NEON_VIOLET, 3.4, 48],
    ['kitchen', '#ffd9a0', 3.4, 40], ['gameroom', NEON_CYAN, 3.2, 52], ['lawn', NEON_AMBER, 2.2, 30], ['terrace', '#ffb98a', 3.0, 34], ['frontyard', '#ffe0a0', 3.4, 36], ['courtyard', NEON_AMBER, 2.6, 38],
  ];
  const allLights = [
    ...roomLights.map(([id, color, y, intensity]) => ({ id, color, y, intensity, x: FLOORPLAN_ZONES[id].center.x, z: FLOORPLAN_ZONES[id].center.z, floor: 0 })),
    ...Object.values(ALL_ZONES).filter(z => z.floor === 1).map(z => ({ id: z.id, color: '#ffe8c4', y: FLOOR_Y + 3.4, intensity: 26, x: z.center.x, z: z.center.z, floor: 1 })),
  ];
  const vLines = [];
  for (let c = 1; c < COLS; c++) vLines.push(-halfW + c * CELL_W);
  const hLines = [];
  for (let r = 1; r < ROWS; r++) hLines.push(-halfD + r * CELL_D);

  return (
    <FocusContext.Provider value={focus}>
    <group>
      {/* ── Lighting (tinted by the weather) ── */}
      <ambientLight intensity={wx.ambient[1]} color={wx.ambient[0]} />
      <hemisphereLight args={[wx.hemi[0], wx.hemi[1], wx.hemi[2]]} />
      <FollowLight shadows={!lowQ} size={coarse ? 1024 : 2048} sun={wx.sun} />
      <LightPool lights={allLights} neon={wx.neon} />

      {/* ── Grass plot, trees, clouds and rain around the house, then the slab and per-room floors ── */}
      <Ground weather={weather} />
      <Clouds weather={weather} />
      {wx.rain && <Rain />}
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[WORLD_W + 0.8, 0.5, WORLD_D + 0.8]} />
        <meshStandardMaterial color="#1b1430" roughness={0.9} />
      </mesh>
      {zones.map(z => (
        <mesh key={z.id} rotation={[-Math.PI / 2, 0, 0]} position={[z.center.x, 0.005, z.center.z]} receiveShadow>
          <planeGeometry args={[CELL_W, CELL_D]} />
          <meshStandardMaterial map={textures[z.id]} roughness={z.id === 'kitchen' ? 0.35 : 0.8} />
        </mesh>
      ))}

      {/* ── Back + left outer walls (cutaway: the two nearest the camera are omitted) ── */}
      <Box p={[0, WALL_H / 2, -halfD - 0.15]} s={[WORLD_W + 0.6, WALL_H, 0.3]} c="#3a2a62" />
      <Box p={[-halfW - 0.15, WALL_H / 2, 0]} s={[0.3, WALL_H, WORLD_D + 0.6]} c="#33265a" />
      <Neon p={[0, WALL_H - 0.15, -halfD + 0.05]} s={[WORLD_W, 0.07, 0.07]} color={NEON_PINK} />
      <Neon p={[-halfW + 0.05, WALL_H - 0.15, 0]} s={[0.07, 0.07, WORLD_D]} color={NEON_CYAN} />
      <Neon p={[0, 0.12, -halfD + 0.05]} s={[WORLD_W, 0.05, 0.05]} color={NEON_VIOLET} />
      <Neon p={[-halfW + 0.05, 0.12, 0]} s={[0.05, 0.05, WORLD_D]} color={NEON_VIOLET} />

      {/* ── Interior walls with doorways + door frames ── */}
      {vLines.map((x, i) => (
        <Divider key={`v${x}`} axis="z" at={x} from={-halfD} to={halfD} color={DOOR_COLORS[i % 4]}
          gaps={DOORWAYS.filter(d => d.axis === 'v' && d.x === x).map(d => d.z)}
          tallForAt={(m) => zoneAt(i + 1, Math.min(ROWS - 1, Math.max(0, Math.floor((m + halfD) / CELL_D)))).id} />
      ))}
      {hLines.map((z, i) => (
        <Divider key={`h${z}`} axis="x" at={z} from={-halfW} to={halfW} color={DOOR_COLORS[(i + 2) % 4]}
          gaps={DOORWAYS.filter(d => d.axis === 'h' && d.z === z).map(d => d.x)}
          tallForAt={(m) => zoneAt(Math.min(COLS - 1, Math.max(0, Math.floor((m + halfW) / CELL_W))), i + 1).id} />
      ))}
      {DOORWAYS.map((d, i) => (
        <DoorFrame key={i} p={[d.x, 0, d.z]} axis={d.axis === 'v' ? 'z' : 'x'} color={DOOR_COLORS[i % 4]} doorKey={[d.a, d.b].sort().join('|')} />
      ))}

      {/* ── Rooms ── */}
      <Study />
      <LivingRoom weather={weather} />
      <Bedroom />
      <Kitchen />
      <GameRoom />
      <Garden />
      <Terrace />
      <FrontYard />
      <Courtyard />
      <Floor2 />

      {/* ── Room signs + door hotspots ── */}
      {zoomedOut && zones.filter(z => z.row === 2).map(z => <RoomSign key={z.id} z={z} />)}
      {zoomedOut && Object.values(ALL_ZONES).filter(z => z.floor === 1).map(z => <RoomSign key={z.id} z={z} />)}
      {focus === 'frontyard' && <ExitChip onExit={onExitHouse} />}
      {ALL_LINKS.filter(l => l.from === focus).map(l => <DoorChip key={`${l.from}-${l.to}`} link={l} onGo={onGoToRoom} />)}
    </group>
    </FocusContext.Provider>
  );
}
