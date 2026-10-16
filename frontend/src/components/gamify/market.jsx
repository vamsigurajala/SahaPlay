import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Coffee, Bell } from 'lucide-react';
import { Box, Tree, PropDot, ScaledHtml, FocusContext, ZoneContext, useOpenProp } from './parts';
import { Cell } from './cell';
import { lampsOn } from './street';
import { FLOORPLAN_ZONES, CELL_W, CELL_D } from '../../data/gamifyZones';
import { SHOPS } from '../../data/gamifyShops';
import { PI, WOOD_DARK, tapper, Cyl, Rod } from './shopParts';

// The Market: a paved plaza to the east of the cricket ground with a row of shops
// along its back (fast food, electronics, a medical store and a clothes shop), a chai
// tapri on the west edge, benches, a fountain and lamps. Tap a shop to walk in and
// browse what it sells; tap the chai tapri to pour a glass.

// ---------------------------------------------------------------- floor
const plazaTexture = (() => {
  let t;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#8a7a68'; g.fillRect(0, 0, 256, 256);
    const tones = ['#d8c4a4', '#cdb894', '#e0cfb2', '#c9b28c'];
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { g.fillStyle = tones[(r * 5 + q * 3) % 4]; g.fillRect(q * 32 + 2, r * 32 + 2, 28, 28); }
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2.7);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

export function MarketFloor() {
  const z = FLOORPLAN_ZONES.market;
  const tex = useMemo(() => plazaTexture(), []);
  return (
    <group position={[z.center.x, 0, z.center.z]}>
      <mesh position={[0, -0.25, 0]} receiveShadow><boxGeometry args={[CELL_W + 0.4, 0.5, CELL_D + 0.2]} /><meshStandardMaterial color="#4a3a28" roughness={1} /></mesh>
      <mesh rotation={[-PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[CELL_W, CELL_D]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <Box p={[0, 0.1, CELL_D / 2 + 0.1]} s={[CELL_W + 0.4, 0.2, 0.3]} c="#6f6a86" shadow={false} />
    </group>
  );
}

// ---------------------------------------------------------------- bits and pieces
function Steam({ p, n = 4, spread = 0.25 }) {
  const puffs = useRef([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.4 + i / n) % 1;
      m.position.set(Math.sin(t * 1.3 + i * 2) * spread * u, u * 1.2, Math.cos(t + i) * spread * u);
      m.scale.setScalar(0.1 + u * 0.28);
      m.material.opacity = Math.sin(u * PI) * 0.3;
    });
  });
  return (
    <group position={p}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} ref={(m) => { puffs.current[i] = m; }}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} /></mesh>
      ))}
    </group>
  );
}

function Screen({ p, s, hue = 0, rot = 0 }) {
  const mat = useRef();
  useFrame((state) => { if (mat.current) mat.current.color.setHSL((state.clock.elapsedTime * 0.04 + hue) % 1, 0.65, 0.5); });
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0, 0]} s={[s[0] + 0.12, s[1] + 0.12, 0.08]} c="#0b0d14" />
      <mesh position={[0, 0, 0.05]}><planeGeometry args={s} /><meshBasicMaterial ref={mat} toneMapped={false} /></mesh>
    </group>
  );
}

function Burger({ p }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.05, 0]} r={0.26} h={0.1} c="#e0a85a" rough={0.8} shadow={false} />
      <Cyl p={[0, 0.13, 0]} r={0.25} h={0.08} c="#5a3420" rough={0.9} shadow={false} />
      <Cyl p={[0, 0.19, 0]} r={0.3} h={0.03} c="#4ade80" rough={0.9} shadow={false} />
      <Box p={[0, 0.215, 0]} s={[0.5, 0.025, 0.5]} c="#ffd23a" rot={PI / 4} shadow={false} />
      <mesh position={[0, 0.24, 0]} scale={[1, 0.62, 1]}><sphereGeometry args={[0.27, 12, 8, 0, PI * 2, 0, PI / 2]} /><meshStandardMaterial color="#e0a85a" roughness={0.8} /></mesh>
    </group>
  );
}

// ---------------------------------------------------------------- one shop
const SHOP_W = 4.0;
const SHOP_D = 3.4;

function Interior({ id }) {
  const bz = -SHOP_D / 2 + 0.2; // inner face of the back wall
  if (id === 'fastfood') {
    return (
      <group>
        <Box p={[0, 2.45, bz + 0.05]} s={[SHOP_W - 0.8, 1.0, 0.06]} c="#1c1410" />
        {[[0.0, 2.75, 2.2, '#ffd23a'], [0.1, 2.55, 1.6, '#ffffff'], [-0.1, 2.35, 2.0, '#ffd23a'], [0.2, 2.15, 1.2, '#ffffff']].map(([x, y, w, c], i) => (
          <mesh key={i} position={[x, y, bz + 0.1]}><boxGeometry args={[w, 0.07, 0.02]} /><meshBasicMaterial color={c} toneMapped={false} /></mesh>
        ))}
        <Box p={[-1.1, 0.55, bz + 0.65]} s={[1.5, 1.1, 0.9]} c="#9ca3af" metal={0.5} />
        <Box p={[-1.1, 1.13, bz + 0.65]} s={[1.4, 0.06, 0.8]} c="#2a2a30" />
        {[-1.4, -1.1, -0.8].map(x => <Cyl key={x} p={[x, 1.2, bz + 0.65]} r={0.14} h={0.06} c="#5a3420" shadow={false} />)}
        <Box p={[-1.1, 2.05, bz + 0.5]} s={[1.6, 0.5, 0.7]} c="#cbd5e1" metal={0.6} rough={0.4} />
        <Steam p={[-1.1, 1.3, bz + 0.65]} />
        <Box p={[0.95, 0.55, bz + 0.65]} s={[1.0, 1.1, 0.8]} c="#cbd5e1" metal={0.4} />
        <Box p={[0.95, 1.13, bz + 0.65]} s={[0.7, 0.1, 0.5]} c="#3a3a40" />
        {[-0.2, -0.07, 0.06, 0.19].map((o, i) => <Box key={i} p={[0.95 + o, 1.2, bz + 0.65]} s={[0.07, 0.06, 0.4]} c="#f2b630" shadow={false} />)}
        <Burger p={[-0.7, 1.12, SHOP_D / 2 - 0.5]} />
        <Burger p={[-0.1, 1.12, SHOP_D / 2 - 0.5]} />
        <Box p={[0.9, 1.15, SHOP_D / 2 - 0.5]} s={[0.7, 0.1, 0.7]} c="#d9402f" shadow={false} />
        {[1.5, 1.72].map(x => <Cyl key={x} p={[x, 1.28, SHOP_D / 2 - 0.5]} r={0.1} r2={0.07} h={0.3} c={x > 1.6 ? '#ffffff' : '#e0302f'} shadow={false} />)}
      </group>
    );
  }
  if (id === 'electronics') {
    return (
      <group>
        <Screen p={[0, 2.3, bz + 0.06]} s={[1.5, 0.88]} hue={0.1} />
        <Screen p={[-1.35, 2.0, bz + 0.06]} s={[0.9, 0.56]} hue={0.45} />
        <Screen p={[1.35, 2.0, bz + 0.06]} s={[0.9, 0.56]} hue={0.75} />
        <Box p={[0, 1.2, bz + 0.3]} s={[SHOP_W - 0.5, 0.07, 0.5]} c="#374151" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Box key={i} p={[-1.5 + i * 0.375, 1.38, bz + 0.3]} s={[0.26, 0.3, 0.1]} c={i % 3 === 0 ? '#e5e7eb' : i % 3 === 1 ? '#111827' : '#6d4fd0'} shadow={false} />
        ))}
        <group position={[-0.85, 1.1, SHOP_D / 2 - 0.5]}>
          <Box p={[0, 0.03, 0]} s={[0.75, 0.04, 0.5]} c="#9ca3af" metal={0.6} shadow={false} />
          <group position={[0, 0.05, -0.24]} rotation={[-0.35, 0, 0]}><Box p={[0, 0.24, 0]} s={[0.75, 0.48, 0.03]} c="#111827" shadow={false} /><mesh position={[0, 0.24, 0.02]}><planeGeometry args={[0.66, 0.4]} /><meshBasicMaterial color="#7fb2ff" toneMapped={false} /></mesh></group>
        </group>
        {[0.55, 0.95].map(x => <Cyl key={x} p={[x, 1.38, SHOP_D / 2 - 0.5]} r={0.17} h={0.56} c="#1f2937" shadow={false} />)}
        <mesh position={[1.5, 1.3, SHOP_D / 2 - 0.5]} rotation={[PI / 2.4, 0, 0]}><torusGeometry args={[0.16, 0.04, 8, 16]} /><meshStandardMaterial color="#e0529f" /></mesh>
      </group>
    );
  }
  if (id === 'medical') {
    const cols = ['#ffffff', '#f59e0b', '#38bdf8', '#16a34a', '#ffffff', '#e0529f'];
    return (
      <group>
        {[0.8, 1.45, 2.1].map((y, r) => (
          <group key={y}>
            <Box p={[0, y, bz + 0.3]} s={[SHOP_W - 0.5, 0.06, 0.5]} c="#d1d5db" />
            {Array.from({ length: 8 }).map((_, i) => (
              r === 1
                ? <Box key={i} p={[-1.5 + i * 0.43, y + 0.17, bz + 0.3]} s={[0.3, 0.28, 0.2]} c={i % 2 ? '#ffffff' : '#bbf7d0'} shadow={false} />
                : <group key={i} position={[-1.5 + i * 0.43, y + 0.03, bz + 0.3]}><Cyl p={[0, 0.17, 0]} r={0.11} h={0.34} c={cols[(i + r) % cols.length]} shadow={false} /><Cyl p={[0, 0.37, 0]} r={0.07} h={0.07} c="#1f2937" shadow={false} /></group>
            ))}
          </group>
        ))}
        <Box p={[0.9, 1.2, SHOP_D / 2 - 0.5]} s={[0.4, 0.3, 0.3]} c="#ffffff" shadow={false} />
        <Box p={[0.9, 1.37, SHOP_D / 2 - 0.5]} s={[0.4, 0.04, 0.3]} c="#16a34a" shadow={false} />
        <Cyl p={[-0.4, 1.3, SHOP_D / 2 - 0.5]} r={0.14} h={0.3} c="#bfe3ee" rough={0.1} shadow={false} />
        <Box p={[-1.1, 1.14, SHOP_D / 2 - 0.5]} s={[0.5, 0.12, 0.34]} c="#38bdf8" shadow={false} />
      </group>
    );
  }
  // dressings
  const garments = ['#e0452f', '#2563eb', '#f2b630', '#16a34a', '#a85ad6', '#ffffff', '#0ea5e9'];
  return (
    <group>
      <Cyl p={[0, 2.35, bz + 0.5]} r={0.04} h={SHOP_W - 0.6} c="#cfd3da" metal={0.8} rot={[0, 0, PI / 2]} shadow={false} />
      {garments.map((c, i) => (
        <group key={i} position={[-1.5 + i * 0.5, 1.88, bz + 0.5]}>
          <Box p={[0, 0, 0]} s={[0.42, 0.8, 0.07]} c={c} r={0.03} rough={1} />
          <Box p={[0, 0.46, 0]} s={[0.04, 0.12, 0.04]} c="#cfd3da" shadow={false} />
        </group>
      ))}
      <Box p={[-1.2, 0.4, bz + 1.1]} s={[1.2, 0.8, 0.7]} c="#fde7f1" r={0.03} />
      {['#e0452f', '#2563eb', '#f2b630'].map((c, i) => <Box key={c} p={[-1.2, 0.86 + i * 0.12, bz + 1.1]} s={[0.9, 0.1, 0.55]} c={c} r={0.03} rough={1} shadow={false} />)}
      {[-0.3, 1.3].map((x, i) => (
        <group key={x} position={[x, 0, 0.2]}>
          <Cyl p={[0, 0.04, 0]} r={0.32} h={0.08} c="#3a3a40" />
          <Cyl p={[0, 0.8, 0]} r={0.04} h={1.5} c="#cfd3da" metal={0.8} shadow={false} />
          <Box p={[0, 1.55, 0]} s={[0.52, 0.8, 0.3]} c={i ? '#d6338a' : '#0ea5e9'} r={0.08} rough={1} />
          <mesh position={[0, 2.15, 0]}><sphereGeometry args={[0.18, 12, 10]} /><meshStandardMaterial color="#f1e4d3" roughness={0.6} /></mesh>
        </group>
      ))}
      <group position={[1.0, 1.1, SHOP_D / 2 - 0.5]}>
        <Cyl p={[0, 0.1, 0]} r={0.2} h={0.2} c="#22c55e" shadow={false} />
        <Cyl p={[0, 0.02, 0]} r={0.34} h={0.04} c="#22c55e" shadow={false} />
      </group>
      <Box p={[0.3, 1.14, SHOP_D / 2 - 0.5]} s={[0.4, 0.08, 0.14]} c="#111827" shadow={false} />
    </group>
  );
}

function Shop({ x, id, say }) {
  const shop = SHOPS[id];
  const open = useOpenProp('shop', id);
  const focus = useContext(FocusContext);
  const zone = useContext(ZoneContext);
  const here = focus === zone;
  const wall = { fastfood: '#fff1d6', electronics: '#e8eefc', medical: '#f0fdf4', dressings: '#fff0f7' }[id];
  const floor = { fastfood: '#6b4a2f', electronics: '#1f2937', medical: '#cfd4da', dressings: '#a16207' }[id];
  return (
    <group position={[x, 0, 0.2 + SHOP_D / 2]} {...open}>
      <Box p={[0, 0.04, 0]} s={[SHOP_W, 0.08, SHOP_D]} c={floor} shadow={false} />
      <Box p={[0, 1.8, -SHOP_D / 2 + 0.1]} s={[SHOP_W, 3.6, 0.2]} c={wall} />
      {[-1, 1].map(s => <Box key={s} p={[s * (SHOP_W / 2 - 0.1), 0.95, 0]} s={[0.2, 1.9, SHOP_D]} c={wall} />)}
      <Box p={[0, 3.7, SHOP_D / 2 - 0.1]} s={[SHOP_W, 0.75, 0.2]} c={shop.color} r={0.04} />
      <mesh position={[0, 3.38, SHOP_D / 2 + 0.02]}><boxGeometry args={[SHOP_W - 0.2, 0.05, 0.05]} /><meshBasicMaterial color={shop.accent} toneMapped={false} /></mesh>
      <Box p={[0, 0.5, SHOP_D / 2 - 0.45]} s={[SHOP_W - 0.5, 1.0, 0.7]} c={shop.color} r={0.04} />
      <Box p={[0, 1.04, SHOP_D / 2 - 0.45]} s={[SHOP_W - 0.4, 0.08, 0.85]} c="#f3efe4" r={0.02} />
      {/* striped awning */}
      <group position={[0, 3.1, SHOP_D / 2 + 0.1]} rotation={[0.42, 0, 0]}>
        {Array.from({ length: 8 }).map((_, i) => <Box key={i} p={[-1.75 + i * 0.5, 0, 0]} s={[0.5, 0.06, 0.9]} c={i % 2 ? '#fffaf0' : shop.color} shadow={false} />)}
      </group>
      <Interior id={id} />
      {id === 'medical' && (
        <group position={[0, 4.35, SHOP_D / 2 - 0.1]}>
          <mesh><boxGeometry args={[0.95, 0.3, 0.12]} /><meshBasicMaterial color="#22ff88" toneMapped={false} /></mesh>
          <mesh><boxGeometry args={[0.3, 0.95, 0.12]} /><meshBasicMaterial color="#22ff88" toneMapped={false} /></mesh>
        </group>
      )}
      {/* a generous invisible target so a tap anywhere on the shop opens it */}
      <mesh position={[0, 1.8, 0]} visible={false}><boxGeometry args={[SHOP_W, 3.6, SHOP_D]} /></mesh>
      <PropDot position={[0, 3.2, SHOP_D / 2 + 0.2]} kind="shop" arg={id} />
      {here && (
        <ScaledHtml position={[0, 3.7, SHOP_D / 2 + 0.2]} pointerEvents="none">
          <div className="stay-white" style={{ padding: '2px 10px', borderRadius: 6, background: 'rgba(10,8,20,0.9)', border: `1px solid ${shop.accent}`, color: '#fff', fontWeight: 900, fontSize: 11, letterSpacing: 1.2, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{shop.name}</div>
        </ScaledHtml>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- chai tapri
const POUR_S = 2.4;
function ChaiStall({ p, rot = 0, say }) {
  const kettle = useRef();
  const stream = useRef();
  const liquid = useRef();
  const steam = useRef([]);
  const st = useRef({ pour: -1, boost: 0.35 });
  const [served, setServed] = useState(0);
  const focus = useContext(FocusContext);
  const zone = useContext(ZoneContext);
  const here = focus === zone;
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  useFrame((state, dt) => {
    const s = st.current;
    const d = Math.min(dt, 0.1);
    if (s.pour >= 0) {
      s.pour += d;
      const u = s.pour;
      const tilt = u < 0.35 ? u / 0.35 : u > POUR_S - 0.5 ? Math.max(0, (POUR_S - u) / 0.5) : 1;
      if (kettle.current) kettle.current.rotation.z = -0.55 * tilt;
      const flowing = u > 0.3 && u < POUR_S - 0.6;
      if (stream.current) stream.current.visible = flowing;
      const fill = Math.min(1, Math.max(0, (u - 0.4) / (POUR_S - 1.2)));
      if (liquid.current) { liquid.current.visible = fill > 0.01; liquid.current.scale.y = Math.max(0.01, fill); liquid.current.position.y = 1.21 + 0.14 * fill; }
      s.boost = 1;
      if (u >= POUR_S) { s.pour = -1; if (kettle.current) kettle.current.rotation.z = 0; if (stream.current) stream.current.visible = false; }
    } else {
      s.boost += (0.35 - s.boost) * (1 - Math.exp(-d * 1.5));
    }
    const t = state.clock.elapsedTime;
    steam.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.45 + i / steam.current.length) % 1;
      m.position.set(-0.68 + Math.sin(t + i * 2) * 0.1 * u, 1.9 + u * 1.3, 0.05 + Math.cos(t * 0.8 + i) * 0.08 * u);
      m.scale.setScalar(0.12 + u * 0.3);
      m.material.opacity = Math.sin(u * PI) * 0.32 * s.boost;
    });
  });

  const pour = tapper(() => {
    const s = st.current;
    if (s.pour >= 0) return;
    s.pour = 0;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setServed(n => n + 1); say('Chai is ready', Coffee, [p[0] + 0.5, 3.3, p[2]]); }, POUR_S * 1000 - 300);
  });

  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.55, 0]} s={[4.4, 1.1, 1.3]} c="#2f6f8f" r={0.05} {...pour} />
      <Box p={[0, 0.2, 0.66]} s={[4.2, 0.12, 0.05]} c="#f6e7c8" />
      <Box p={[0, 1.15, 0]} s={[4.6, 0.1, 1.5]} c="#d9c8a4" r={0.03} />
      <group position={[0, 2.7, 0.2]} rotation={[0.28, 0, 0]}>
        {Array.from({ length: 8 }).map((_, i) => <Box key={i} p={[-2.2 + i * 0.63, 0, 0]} s={[0.62, 0.06, 1.9]} c={i % 2 ? '#f8f1e0' : '#d6402f'} shadow={false} />)}
      </group>
      {[-2.15, 2.15].map(x => <Box key={x} p={[x, 1.4, 0.7]} s={[0.1, 2.8, 0.1]} c={WOOD_DARK} />)}
      <Box p={[-1.3, 1.26, 0]} s={[1.0, 0.14, 0.8]} c="#2a2a30" metal={0.6} />
      <Cyl p={[-1.3, 1.37, 0]} r={0.28} r2={0.24} h={0.06} c="#ff7a2a" emissive="#ff6a1a" shadow={false} />
      <group position={[-1.3, 1.4, 0]} ref={kettle} {...pour}>
        <Cyl p={[0, 0.28, 0]} r={0.31} r2={0.27} h={0.56} c="#cfd3da" metal={0.9} rough={0.3} />
        <Cyl p={[0, 0.6, 0]} r={0.2} h={0.08} c="#cfd3da" metal={0.9} rough={0.3} />
        <Cyl p={[0, 0.68, 0]} r={0.05} h={0.1} c="#2a2a30" shadow={false} />
        <Rod a={[0.26, 0.28, 0]} b={[0.58, 0.58, 0]} r={0.05} c="#cfd3da" />
        <mesh position={[-0.12, 0.62, 0]}><torusGeometry args={[0.28, 0.025, 6, 16, PI]} /><meshStandardMaterial color="#2a2a30" /></mesh>
      </group>
      <Cyl p={[-0.5, 1.36, 0]} r={0.15} r2={0.12} h={0.32} c="#e8f3f5" rough={0.1} shadow={false} />
      <mesh ref={liquid} position={[-0.5, 1.2, 0]} visible={false}><cylinderGeometry args={[0.13, 0.11, 0.28, 12]} /><meshStandardMaterial color="#c47a35" roughness={0.3} /></mesh>
      <mesh ref={stream} position={[-0.48, 1.55, 0]} visible={false}><cylinderGeometry args={[0.025, 0.025, 0.45, 6]} /><meshStandardMaterial color="#c47a35" /></mesh>
      {[0.3, 0.65, 1.0].map(x => <Cyl key={x} p={[x, 1.31, 0.35]} r={0.1} r2={0.08} h={0.26} c="#e8f3f5" rough={0.1} shadow={false} />)}
      {[1.55, 1.95].map((x, i) => (
        <group key={x} position={[x, 1.2, -0.15]}>
          <Cyl p={[0, 0.25, 0]} r={0.2} h={0.5} c="#bfe3ee" rough={0.1} />
          <Cyl p={[0, 0.2, 0]} r={0.16} h={0.36} c={i ? '#e0a55a' : '#c78a4a'} />
          <Cyl p={[0, 0.54, 0]} r={0.22} h={0.06} c="#d6402f" />
        </group>
      ))}
      <Cyl p={[0.2, 1.4, -0.4]} r={0.12} h={0.5} c="#2f9aa0" metal={0.6} />
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} ref={(m) => { steam.current[i] = m; }}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} /></mesh>
      ))}
      <PropDot position={[0, 1.9, 0.9]} onClick={pour.onClick} />
      {here && (
        <ScaledHtml position={[0, 2.35, 0.1]} pointerEvents="none">
          <div className="stay-white" style={{ padding: '2px 10px', borderRadius: 6, background: '#0f2630', border: '1px solid #f6e7c8', color: '#f6e7c8', fontWeight: 900, fontSize: 11, letterSpacing: 1.5, whiteSpace: 'nowrap' }}>
            CHAI TAPRI{served ? ` | ${served} SERVED` : ''}
          </div>
        </ScaledHtml>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- plaza dressing
function Fountain({ p }) {
  const ring = useRef([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ring.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.7 + i / 6) % 1;
      m.position.set(Math.cos(i * 1.05) * (0.15 + u * 0.5), 1.45 + Math.sin(u * PI) * 0.55, Math.sin(i * 1.05) * (0.15 + u * 0.5));
      m.scale.setScalar(0.06);
    });
  });
  return (
    <group position={p}>
      <Cyl p={[0, 0.2, 0]} r={1.5} h={0.4} c="#b9a88a" />
      <mesh position={[0, 0.38, 0]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[1.32, 28]} /><meshStandardMaterial color="#3aa6d6" roughness={0.15} metalness={0.2} /></mesh>
      <Cyl p={[0, 0.8, 0]} r={0.22} r2={0.3} h={0.8} c="#c9b896" />
      <Cyl p={[0, 1.25, 0]} r={0.6} r2={0.3} h={0.14} c="#c9b896" />
      {Array.from({ length: 6 }).map((_, i) => <mesh key={i} ref={(m) => { ring.current[i] = m; }}><sphereGeometry args={[1, 6, 5]} /><meshBasicMaterial color="#bfe9ff" /></mesh>)}
    </group>
  );
}

function Bench({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.5, 0]} s={[2.0, 0.1, 0.6]} c="#8a5a30" r={0.03} />
      <Box p={[0, 0.9, -0.28]} s={[2.0, 0.5, 0.08]} c="#8a5a30" r={0.03} />
      {[-0.85, 0.85].map(x => <Box key={x} p={[x, 0.25, 0]} s={[0.1, 0.5, 0.5]} c="#2a2a30" />)}
    </group>
  );
}

function Lamp({ p, on }) {
  return (
    <group position={p}>
      <Cyl p={[0, 1.7, 0]} r={0.06} r2={0.08} h={3.4} c="#2a2a30" />
      <Cyl p={[0, 0.06, 0]} r={0.22} h={0.12} c="#2a2a30" />
      <mesh position={[0, 3.5, 0]}><sphereGeometry args={[0.25, 12, 10]} /><meshBasicMaterial color={on ? '#ffe2a0' : '#9a958a'} toneMapped={false} /></mesh>
      {on && <mesh position={[0, 3.5, 0]}><sphereGeometry args={[0.7, 12, 10]} /><meshBasicMaterial color="#ffcf70" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>}
    </group>
  );
}

// ---------------------------------------------------------------- the market
export function Market({ weather = 'day' }) {
  const [toast, setToast] = useState(null);
  const focus = useContext(FocusContext);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  const say = (text, Icon, pos) => setToast({ text, Icon: Icon || Bell, pos, id: performance.now() });
  const on = lampsOn(weather);
  const xs = [2.1, 6.7, 11.3, 15.9];
  return (
    <Cell id="market">
      {['fastfood', 'electronics', 'medical', 'dressings'].map((id, i) => <Shop key={id} id={id} x={xs[i]} />)}
      <ChaiStall p={[1.7, 0, 10.5]} rot={PI / 2} say={say} />
      <Fountain p={[10.2, 0, 9.4]} />
      <Bench p={[6.0, 0, 12.8]} />
      <Bench p={[14.0, 0, 12.8]} />
      <Lamp p={[4.2, 0, 7.2]} on={on} />
      <Lamp p={[16.8, 0, 7.2]} on={on} />
      {[[0.9, 15.0], [17.1, 15.0]].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}><Box p={[0, 0.25, 0]} s={[1.3, 0.5, 1.3]} c="#7a7a84" r={0.05} /><Tree p={[0, 0.5, 0]} scale={0.6} /></group>
      ))}
      {toast && focus === 'market' && (
        <ScaledHtml position={toast.pos} pointerEvents="none">
          <div className="stay-white" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(15,12,30,0.88)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
            <toast.Icon size={14} />{toast.text}
          </div>
        </ScaledHtml>
      )}
    </Cell>
  );
}
