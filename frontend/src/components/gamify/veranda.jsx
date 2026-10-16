import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Coffee, Lightbulb, Bell, Flame } from 'lucide-react';
import { Box, Plant, Table, Stool, FloorLamp, PropDot, ScaledHtml, FocusContext, ZoneContext } from './parts';
import { Playable } from './gameRoom';
import { Cell } from './cell';
import { StreetWall } from './outdoorRooms';

// The Veranda: the covered sit-out on the street side of the ground floor. A chai
// tapri to pour a glass from, a jhula to push, a wind chime to ring, festoon lights
// that change mood, a rangoli ringed with diyas you can light, a Connect Four table
// and a rattan lounge. Everything tappable is also marked with a pulsing dot.

const PI = Math.PI;
const WOOD = '#7a4a26';
const WOOD_DARK = '#4a2b14';
const BRASS = '#d4af37';

const tapper = (fn) => ({
  onClick: (e) => { if (e.delta > 6) return; e.stopPropagation(); fn(e); },
  onPointerOver: (e) => { e.stopPropagation(); try { document.body.style.cursor = 'pointer'; } catch { /* non-browser */ } },
  onPointerOut: () => { try { document.body.style.cursor = ''; } catch { /* non-browser */ } },
});

// A soft wind-chime ring. Web Audio is only allowed after a tap, which is exactly when this runs.
let audioCtx = null;
const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
function ringChime(count = 3) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < count; i++) {
      const f = CHIME_NOTES[(Math.floor(Math.random() * CHIME_NOTES.length) + i) % CHIME_NOTES.length];
      const t = t0 + i * 0.13 + Math.random() * 0.06;
      for (const [mul, vol] of [[1, 0.06], [2.76, 0.018]]) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = f * mul;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(t);
        o.stop(t + 2.5);
      }
    }
  } catch { /* audio unavailable */ }
}

function Cyl({ p, r, r2, h, c, rot, seg = 14, rough = 0.6, metal = 0, emissive, shadow = true }) {
  return (
    <mesh position={p} rotation={rot} castShadow={shadow}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={emissive} emissiveIntensity={emissive ? 0.9 : 0} />
    </mesh>
  );
}

// A cylinder from point a to point b.
function Rod({ a, b, r = 0.07, c = WOOD }) {
  const { mid, len, quat } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    return { mid: va.clone().add(vb).multiplyScalar(0.5), len: d.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [a, b]);
  return (
    <mesh position={mid} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color={c} roughness={0.7} />
    </mesh>
  );
}

// ---------------------------------------------------------------- built-in bench
function Bench({ p }) {
  const cushions = [['#2f9aa0', 1.3], ['#f0b429', 3.6], ['#e0529f', 5.9]];
  return (
    <group position={p}>
      <Box p={[0, 0.3, 0]} s={[7.4, 0.55, 1.7]} c={WOOD} r={0.05} />
      <Box p={[0, 0.68, 0.05]} s={[7.2, 0.24, 1.5]} c="#d65a31" r={0.09} rough={1} />
      {cushions.map(([c, x], i) => (
        <group key={c}>
          <Box p={[x - 3.6, 1.1, -0.56]} s={[1.9, 0.82, 0.3]} c={c} r={0.12} rough={1} rot={0} />
          <Box p={[x - 3.6 + 0.2, 0.96, -0.2]} s={[0.55, 0.5, 0.5]} c={i % 2 ? '#f6e7c8' : '#c2410c'} r={0.15} rough={1} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- jhula (swing)
function Jhula({ p, say }) {
  const swing = useRef();
  const st = useRef({ amp: 0.07, t: 0 });
  useFrame((_, dt) => {
    const s = st.current;
    s.t += Math.min(dt, 0.1);
    s.amp = 0.05 + (s.amp - 0.05) * Math.exp(-Math.min(dt, 0.1) * 0.45);
    if (swing.current) swing.current.rotation.z = s.amp * Math.sin(s.t * 2.2);
  });
  const push = tapper(() => { st.current.amp = Math.min(0.55, st.current.amp + 0.24); say('The jhula sways', Bell, [p[0], 3.9, p[2]]); });
  return (
    <group position={p}>
      {[-1.9, 1.9].map(z => (
        <group key={z}>
          <Rod a={[-0.95, 0, z]} b={[0, 3.2, z]} r={0.1} c={WOOD_DARK} />
          <Rod a={[0.95, 0, z]} b={[0, 3.2, z]} r={0.1} c={WOOD_DARK} />
          <Cyl p={[0, 3.25, z]} r={0.14} h={0.18} c={BRASS} metal={0.8} rough={0.3} shadow={false} />
        </group>
      ))}
      <Cyl p={[0, 3.2, 0]} r={0.1} h={4.1} c={WOOD} rot={[PI / 2, 0, 0]} />
      <group position={[0, 3.2, 0]} ref={swing} {...push}>
        {[[-0.5, -0.88], [0.5, -0.88], [-0.5, 0.88], [0.5, 0.88]].map(([x, z], i) => (
          <Cyl key={i} p={[x, -1.2, z]} r={0.022} h={2.4} c={BRASS} metal={0.9} rough={0.35} seg={6} shadow={false} />
        ))}
        <Box p={[0, -2.42, 0]} s={[1.3, 0.14, 2.1]} c={WOOD} r={0.04} />
        <Box p={[0, -2.31, 0]} s={[1.1, 0.14, 1.9]} c="#f0a21c" r={0.07} rough={1} />
        <Box p={[-0.6, -1.95, 0]} s={[0.12, 0.95, 2.1]} c={WOOD} r={0.04} />
        <Box p={[-0.5, -1.95, 0]} s={[0.14, 0.7, 1.8]} c="#d65a31" r={0.07} rough={1} />
        <Box p={[0.05, -1.5, 0.9]} s={[1.0, 0.1, 0.1]} c={WOOD} />
        <Box p={[0.05, -1.5, -0.9]} s={[1.0, 0.1, 0.1]} c={WOOD} />
        <Box p={[0.1, -2.1, 0.55]} s={[0.4, 0.4, 0.4]} c="#2f9aa0" r={0.14} rough={1} />
      </group>
      <PropDot position={[0, 2.5, 0]} onClick={() => { st.current.amp = Math.min(0.55, st.current.amp + 0.24); say('The jhula sways', Bell, [p[0], 3.9, p[2]]); }} />
    </group>
  );
}

// ---------------------------------------------------------------- chai tapri
const POUR_S = 2.4;
function ChaiStall({ p, say }) {
  const kettle = useRef();
  const stream = useRef();
  const liquid = useRef();
  const steam = useRef([]);
  const st = useRef({ pour: -1, level: 0.9, boost: 0.35 });
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
    timer.current = setTimeout(() => { setServed(n => n + 1); say('Chai is ready', Coffee, [p[0], 3.3, p[2]]); }, POUR_S * 1000 - 300);
  });

  return (
    <group position={p}>
      {/* painted counter */}
      <Box p={[0, 0.55, 0]} s={[4.4, 1.1, 1.3]} c="#2f6f8f" r={0.05} {...pour} />
      <Box p={[0, 0.2, 0.66]} s={[4.2, 0.12, 0.05]} c="#f6e7c8" />
      <Box p={[0, 1.15, 0]} s={[4.6, 0.1, 1.5]} c="#d9c8a4" r={0.03} />
      {/* striped awning */}
      <group position={[0, 2.7, 0.2]} rotation={[0.28, 0, 0]}>
        {Array.from({ length: 8 }).map((_, i) => <Box key={i} p={[-2.2 + i * 0.63, 0, 0]} s={[0.62, 0.06, 1.9]} c={i % 2 ? '#f8f1e0' : '#d6402f'} shadow={false} />)}
      </group>
      {[-2.15, 2.15].map(x => <Box key={x} p={[x, 1.4, 0.7]} s={[0.1, 2.8, 0.1]} c={WOOD_DARK} />)}
      <Box p={[0, 2.35, -0.55]} s={[3.2, 0.5, 0.06]} c="#1c3b4a" />
      {/* burner and kettle */}
      <Box p={[-1.3, 1.26, 0]} s={[1.0, 0.14, 0.8]} c="#2a2a30" metal={0.6} />
      <Cyl p={[-1.3, 1.37, 0]} r={0.28} r2={0.24} h={0.06} c="#ff7a2a" emissive="#ff6a1a" shadow={false} />
      <group position={[-1.3, 1.4, 0]} ref={kettle} {...pour}>
        <Cyl p={[0, 0.28, 0]} r={0.31} r2={0.27} h={0.56} c="#cfd3da" metal={0.9} rough={0.3} />
        <Cyl p={[0, 0.6, 0]} r={0.2} h={0.08} c="#cfd3da" metal={0.9} rough={0.3} />
        <Cyl p={[0, 0.68, 0]} r={0.05} h={0.1} c="#2a2a30" shadow={false} />
        <Rod a={[0.26, 0.28, 0]} b={[0.58, 0.58, 0]} r={0.05} c="#cfd3da" />
        <mesh position={[-0.12, 0.62, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.28, 0.025, 6, 16, PI]} /><meshStandardMaterial color="#2a2a30" /></mesh>
      </group>
      {/* the glass being filled, and the stream */}
      <Cyl p={[-0.5, 1.36, 0]} r={0.15} r2={0.12} h={0.32} c="#e8f3f5" rough={0.1} shadow={false} />
      <mesh ref={liquid} position={[-0.5, 1.2, 0]} visible={false}><cylinderGeometry args={[0.13, 0.11, 0.28, 12]} /><meshStandardMaterial color="#c47a35" roughness={0.3} /></mesh>
      <mesh ref={stream} position={[-0.48, 1.55, 0]} visible={false}><cylinderGeometry args={[0.025, 0.025, 0.45, 6]} /><meshStandardMaterial color="#c47a35" /></mesh>
      {/* more glasses, jars and a flask */}
      {[0.3, 0.65, 1.0].map(x => <Cyl key={x} p={[x, 1.31, 0.35]} r={0.1} r2={0.08} h={0.26} c="#e8f3f5" rough={0.1} shadow={false} />)}
      {[1.55, 1.95].map((x, i) => (
        <group key={x} position={[x, 1.2, -0.15]}>
          <Cyl p={[0, 0.25, 0]} r={0.2} h={0.5} c="#bfe3ee" rough={0.1} />
          <Cyl p={[0, 0.2, 0]} r={0.16} h={0.36} c={i ? '#e0a55a' : '#c78a4a'} />
          <Cyl p={[0, 0.54, 0]} r={0.22} h={0.06} c="#d6402f" />
        </group>
      ))}
      <Cyl p={[0.2, 1.4, -0.4]} r={0.12} h={0.5} c="#2f9aa0" metal={0.6} />
      {/* steam */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} ref={(m) => { steam.current[i] = m; }}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} /></mesh>
      ))}
      <PropDot position={[0, 1.9, 0.9]} onClick={pour.onClick} />
      {here && (
        <ScaledHtml position={[0, 2.35, 0.1]} pointerEvents="none">
          <div style={{ padding: '2px 10px', borderRadius: 6, background: '#0f2630', border: '1px solid #f6e7c8', color: '#f6e7c8', fontWeight: 900, fontSize: 11, letterSpacing: 1.5, whiteSpace: 'nowrap' }}>
            CHAI TAPRI{served ? ` | ${served} SERVED` : ''}
          </div>
        </ScaledHtml>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- wind chime
function WindChime({ p, say }) {
  const sway = useRef();
  const tubes = useRef([]);
  const st = useRef({ amp: 0.04, t: 0 });
  useFrame((_, dt) => {
    const s = st.current;
    const d = Math.min(dt, 0.1);
    s.t += d;
    s.amp = 0.03 + (s.amp - 0.03) * Math.exp(-d * 0.7);
    if (sway.current) { sway.current.rotation.z = s.amp * Math.sin(s.t * 3.1); sway.current.rotation.x = s.amp * 0.8 * Math.cos(s.t * 2.6); }
    tubes.current.forEach((m, i) => { if (m) m.rotation.z = s.amp * 1.4 * Math.sin(s.t * 6 + i * 1.3); });
  });
  const ring = () => { st.current.amp = 0.4; ringChime(3); say('Ting-a-ling', Bell, [p[0] - 1.0, 3.0, p[2]]); };
  const lens = [1.15, 0.95, 1.3, 0.8, 1.05];
  return (
    <group position={p}>
      <Cyl p={[0, 1.7, 0]} r={0.07} r2={0.09} h={3.4} c={WOOD_DARK} />
      <Cyl p={[0, 0.05, 0]} r={0.4} h={0.1} c="#3a3a40" />
      <Box p={[-0.55, 3.4, 0]} s={[1.2, 0.08, 0.08]} c={WOOD_DARK} />
      <group position={[-1.05, 3.34, 0]} ref={sway} {...tapper(ring)}>
        <Cyl p={[0, -0.04, 0]} r={0.26} h={0.06} c={BRASS} metal={0.8} rough={0.3} />
        {lens.map((l, i) => {
          const a = (i / lens.length) * PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * 0.19, -0.1, Math.sin(a) * 0.19]} ref={(m) => { tubes.current[i] = m; }}>
              <Cyl p={[0, -l / 2, 0]} r={0.045} h={l} c={i % 2 ? BRASS : '#cfd3da'} metal={0.9} rough={0.25} seg={8} />
            </group>
          );
        })}
        <Cyl p={[0, -0.7, 0]} r={0.02} h={1.2} c="#8a6a3a" seg={5} shadow={false} />
        <Box p={[0, -1.5, 0]} s={[0.04, 0.4, 0.3]} c="#d6402f" shadow={false} />
        <mesh position={[0, -0.8, 0]} visible={false}><cylinderGeometry args={[0.4, 0.4, 1.8, 8]} /></mesh>
      </group>
      <PropDot position={[-1.05, 2.5, 0]} onClick={ring} />
    </group>
  );
}

// ---------------------------------------------------------------- festoon lights
const LIGHT_SEGS = [];
for (let i = 0; i < 6; i++) LIGHT_SEGS.push([[17.7 - i * 2.9, 3.5, 0.35], [17.7 - (i + 1) * 2.9, 3.5, 0.35]]);
for (let i = 0; i < 5; i++) LIGHT_SEGS.push([[0.35, 3.5, 0.35 + i * 3.05], [0.35, 3.5, 0.35 + (i + 1) * 3.05]]);

function Festoon({ mode, onTap }) {
  const bulbs = useRef();
  const halos = useRef();
  const { points, wire, hit, count } = useMemo(() => {
    const pts = [];
    const wirePts = [];
    LIGHT_SEGS.forEach(([a, b]) => {
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const y = a[1] - 0.55 * (1 - (u * 2 - 1) ** 2);
        wirePts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, y, a[2] + (b[2] - a[2]) * u));
      }
      for (let k = 1; k <= 4; k++) {
        const u = k / 5;
        pts.push([a[0] + (b[0] - a[0]) * u, a[1] - 0.55 * (1 - (u * 2 - 1) ** 2) - 0.1, a[2] + (b[2] - a[2]) * u]);
      }
    });
    const curve = new THREE.CatmullRomCurve3(wirePts, false, 'catmullrom', 0.05);
    return { points: pts, wire: new THREE.TubeGeometry(curve, wirePts.length * 2, 0.013, 4, false), hit: new THREE.TubeGeometry(curve, wirePts.length, 0.32, 5, false), count: pts.length };
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    [bulbs.current, halos.current].forEach(m => {
      if (!m) return;
      points.forEach((q, i) => { tmp.position.set(q[0], q[1], q[2]); tmp.scale.setScalar(m === halos.current ? 2.6 : 1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
      m.instanceMatrix.needsUpdate = true;
    });
  }, [points, tmp]);

  const paint = (t) => {
    [bulbs.current, halos.current].forEach(m => {
      if (!m) return;
      for (let i = 0; i < count; i++) {
        if (mode === 0) col.set('#4a3d2e');
        else if (mode === 1) col.set(i % 2 ? '#ffd27a' : '#ffbf5a');
        else col.setHSL(((i * 0.071 + t * 0.35) % 1), 0.95, 0.58);
        m.setColorAt(i, col);
      }
      m.instanceColor.needsUpdate = true;
    });
  };
  useLayoutEffect(() => { paint(0); });
  useFrame((state) => { if (mode === 2) paint(state.clock.elapsedTime); });

  return (
    <group>
      <mesh geometry={wire}><meshStandardMaterial color="#2a2118" roughness={0.9} /></mesh>
      <mesh geometry={hit} visible={false} {...tapper(onTap)} />
      <instancedMesh ref={bulbs} args={[null, null, count]} {...tapper(onTap)}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halos} args={[null, null, count]} visible={mode !== 0}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------- rangoli and diyas
const circleGeo = new THREE.CircleGeometry(1, 40);
const RANGOLI = [[2.45, '#d9304a'], [2.2, '#ffd23a'], [1.95, '#fff6e5'], [1.78, '#1b8f5a'], [1.5, '#ff7a2a'], [1.22, '#6d3fd0'], [0.98, '#ffd23a'], [0.62, '#e0306a'], [0.3, '#fff6e5']];

function Rangoli({ p }) {
  return (
    <group position={p}>
      {RANGOLI.map(([r, c], i) => (
        <mesh key={r} geometry={circleGeo} position={[0, 0.02 + i * 0.004, 0]} rotation={[-PI / 2, 0, 0]} scale={[r, r, 1]} receiveShadow>
          <meshStandardMaterial color={c} roughness={1} />
        </mesh>
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={i} rotation={[0, (i / 8) * PI * 2, 0]}>
          <mesh geometry={circleGeo} position={[1.62, 0.05, 0]} rotation={[-PI / 2, 0, 0]} scale={[0.5, 0.26, 1]}><meshStandardMaterial color={i % 2 ? '#ff7a2a' : '#fff6e5'} roughness={1} /></mesh>
          <mesh geometry={circleGeo} position={[2.08, 0.05, 0.0]} rotation={[-PI / 2, 0, 0]} scale={[0.1, 0.1, 1]}><meshStandardMaterial color="#d9304a" roughness={1} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Diya({ p, seed, lit, onToggle }) {
  const flame = useRef();
  const glow = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const f = lit ? 0.92 + 0.22 * Math.sin(t * 13 + seed * 2.1) * Math.sin(t * 7.3 + seed) : 0;
    if (flame.current) { flame.current.visible = lit; flame.current.scale.set(0.9 + 0.1 * Math.sin(t * 9 + seed), f, 0.9); }
    if (glow.current) { glow.current.visible = lit; glow.current.scale.setScalar(0.85 + 0.15 * f); }
  });
  return (
    <group position={p} {...tapper(onToggle)}>
      <Cyl p={[0, 0.07, 0]} r={0.24} r2={0.13} h={0.14} c="#b5562b" rough={0.9} />
      <Cyl p={[0, 0.145, 0]} r={0.2} h={0.02} c="#e0a24a" rough={0.5} shadow={false} />
      <mesh ref={flame} position={[0, 0.3, 0]}><coneGeometry args={[0.07, 0.24, 8]} /><meshBasicMaterial color="#ffb347" toneMapped={false} /></mesh>
      <mesh ref={glow} position={[0, 0.3, 0]}><sphereGeometry args={[0.36, 10, 8]} /><meshBasicMaterial color="#ff9a2a" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      {/* a generous invisible target so a finger can hit it */}
      <mesh position={[0, 0.2, 0]} visible={false}><sphereGeometry args={[0.45, 6, 5]} /></mesh>
    </group>
  );
}

function DiyaRing({ p, say }) {
  const [lit, setLit] = useState([true, true, true, true, true, true]);
  const n = lit.length;
  return (
    <group position={p}>
      {lit.map((on, i) => {
        const a = (i / n) * PI * 2 + 0.3;
        return <Diya key={i} seed={i} lit={on} p={[Math.cos(a) * 3.0, 0.03, Math.sin(a) * 3.0]} onToggle={() => { setLit(l => l.map((v, j) => (j === i ? !v : v))); say(on ? 'Diya blown out' : 'Diya lit', Flame, [p[0] + Math.cos(a) * 3.0, 1.6, p[2] + Math.sin(a) * 3.0]); }} />;
      })}
    </group>
  );
}

// ---------------------------------------------------------------- connect four
const C4 = (() => {
  const grid = ['..R....', '..Y.R..', '.RY.Y..', '.YRYR.Y', 'RYRRYYR', 'YRYYRRY'];
  const cells = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => cells.push({ x: (c - 3) * 0.19, y: (2.5 - r) * 0.19, ch })));
  return cells;
})();

function ConnectFour() {
  const ref = useRef();
  const m = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    C4.forEach((c, i) => {
      m.position.set(c.x, c.y, 0.09);
      m.rotation.set(PI / 2, 0, 0);
      m.updateMatrix();
      im.setMatrixAt(i, m.matrix);
      color.set(c.ch === 'R' ? '#e0302f' : c.ch === 'Y' ? '#ffd23a' : '#0e1a52');
      im.setColorAt(i, color);
    });
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  }, [m, color]);
  return (
    <group position={[0, 0.96 + 0.62, 0]}>
      <Box p={[0, 0, 0]} s={[1.5, 1.28, 0.16]} c="#2a4bd0" r={0.03} />
      <Box p={[-0.68, -0.68, 0]} s={[0.12, 0.1, 0.5]} c="#1d38a0" />
      <Box p={[0.68, -0.68, 0]} s={[0.12, 0.1, 0.5]} c="#1d38a0" />
      <instancedMesh ref={ref} args={[null, null, C4.length]}>
        <cylinderGeometry args={[0.075, 0.075, 0.05, 14]} />
        <meshStandardMaterial roughness={0.35} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------- rattan lounge
function RattanChair({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z], i) => <Box key={i} p={[x, 0.22, z]} s={[0.09, 0.44, 0.09]} c="#8a5f33" />)}
      <Box p={[0, 0.48, 0]} s={[1.0, 0.16, 1.0]} c="#b98a55" r={0.06} rough={1} />
      <Box p={[-0.46, 1.0, 0]} s={[0.12, 1.0, 1.0]} c="#b98a55" r={0.06} rough={1} />
      <Box p={[0, 0.82, -0.5]} s={[0.9, 0.08, 0.1]} c="#b98a55" />
      <Box p={[0, 0.82, 0.5]} s={[0.9, 0.08, 0.1]} c="#b98a55" />
      <Box p={[0.02, 0.62, 0]} s={[0.84, 0.16, 0.84]} c="#2f9aa0" r={0.08} rough={1} />
      <Box p={[-0.34, 1.0, 0]} s={[0.14, 0.62, 0.74]} c="#f6e7c8" r={0.07} rough={1} />
    </group>
  );
}

function TeaTable({ p }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.55, 0]} r={0.62} h={0.06} c="#8a5f33" />
      {[0, 2.1, 4.2].map(a => <Rod key={a} a={[Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]} b={[Math.cos(a) * 0.1, 0.55, Math.sin(a) * 0.1]} r={0.04} c="#6e4a28" />)}
      <Cyl p={[-0.2, 0.7, 0.05]} r={0.14} r2={0.12} h={0.24} c="#fff6e5" rough={0.2} shadow={false} />
      <Cyl p={[0.2, 0.62, -0.18]} r={0.07} r2={0.055} h={0.09} c="#fff6e5" rough={0.2} shadow={false} />
      <Cyl p={[0.28, 0.62, 0.22]} r={0.07} r2={0.055} h={0.09} c="#fff6e5" rough={0.2} shadow={false} />
      <Box p={[0.0, 0.61, -0.3]} s={[0.4, 0.08, 0.3]} c="#e0529f" r={0.02} />
    </group>
  );
}

function Planter({ p, w }) {
  const n = Math.floor(w / 0.75);
  return (
    <group position={p}>
      <Box p={[0, 0.25, 0]} s={[w, 0.5, 0.7]} c="#6b4426" r={0.04} />
      <Box p={[0, 0.5, 0]} s={[w - 0.1, 0.04, 0.6]} c="#2a1c12" shadow={false} />
      {Array.from({ length: n }).map((_, i) => {
        const x = -w / 2 + (w / n) * (i + 0.5);
        return (
          <group key={i} position={[x, 0.5, 0]}>
            <mesh position={[0, 0.3, 0]} castShadow><sphereGeometry args={[0.32, 8, 6]} /><meshStandardMaterial color="#2f9e5a" roughness={0.9} /></mesh>
            {[[-0.12, 0.5, 0.1], [0.14, 0.55, -0.05], [0.0, 0.62, 0.14]].map(([fx, fy, fz], k) => (
              <mesh key={k} position={[fx, fy, fz]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color={(i + k) % 2 ? '#ff9a1f' : '#ffc21a'} roughness={0.8} /></mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Matka({ p }) {
  return (
    <group position={p}>
      {[0, 2.1, 4.2].map(a => <Rod key={a} a={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]} b={[Math.cos(a) * 0.3, 0.7, Math.sin(a) * 0.3]} r={0.05} c={WOOD_DARK} />)}
      <mesh position={[0, 1.1, 0]} scale={[1, 0.9, 1]} castShadow><sphereGeometry args={[0.46, 14, 12]} /><meshStandardMaterial color="#b5562b" roughness={0.95} /></mesh>
      <Cyl p={[0, 1.55, 0]} r={0.2} h={0.12} c="#a24b24" rough={0.95} />
      <Cyl p={[0, 1.66, 0]} r={0.09} r2={0.07} h={0.16} c={BRASS} metal={0.85} rough={0.3} shadow={false} />
    </group>
  );
}

// ---------------------------------------------------------------- the room
export function Veranda() {
  const [lights, setLights] = useState(1); // 0 off, 1 warm, 2 festive
  const [toast, setToast] = useState(null);
  const focus = useContext(FocusContext);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  const say = (text, Icon, pos) => setToast({ text, Icon, pos, id: performance.now() });
  const cycleLights = () => {
    const next = (lights + 1) % 3;
    setLights(next);
    say(['Lights off', 'Warm lights', 'Festive lights'][next], Lightbulb, [9, 3.9, 0.6]);
  };
  const toastNode = toast && focus === 'terrace' ? (
    <ScaledHtml position={toast.pos} pointerEvents="none">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(15,12,30,0.88)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
        <toast.Icon size={14} />{toast.text}
      </div>
    </ScaledHtml>
  ) : null;

  return (
    <Cell id="terrace">
      {/* compound wall along the street edge */}
      <StreetWall color="#8a5a3a" cap="#c28a5a" />

      <Bench p={[4.5, 0, 1.05]} />
      <ChaiStall p={[15.2, 0, 1.3]} say={say} />
      <Jhula p={[3.0, 0, 8.4]} say={say} />
      <WindChime p={[16.6, 0, 12.6]} say={say} />

      <Festoon mode={lights} onTap={cycleLights} />
      <PropDot position={[9, 3.1, 0.7]} onClick={cycleLights} />

      <Rangoli p={[11.4, 0, 10.4]} />
      <DiyaRing p={[11.4, 0, 10.4]} say={say} />

      <group position={[7.4, 0, 5.6]}>
        <Playable game="connect4" dot={[0, 3.0, 0]}>
          <Table p={[0, 0, 0]} w={1.9} d={1.2} h={0.9} c="#8a5f33" leg="#4a2b14" />
          <ConnectFour />
        </Playable>
        <Stool p={[-1.5, 0, 0]} c="#d65a31" />
        <Stool p={[1.5, 0, 0]} c="#2f9aa0" />
      </group>

      <RattanChair p={[5.2, 0, 12.6]} rot={0} />
      <RattanChair p={[8.0, 0, 12.6]} rot={PI} />
      <TeaTable p={[6.6, 0, 12.6]} />

      <Planter p={[3.4, 0, 14.75]} w={4.2} />
      <Planter p={[12.2, 0, 14.75]} w={4.6} />
      <Matka p={[17.2, 0, 4.9]} />
      <Plant p={[0.9, 0, 5.2]} scale={1.1} color="#34b36a" pot="#c2410c" />
      <FloorLamp p={[1.1, 0, 14.0]} />
      {/* a doormat just inside the door to the front yard */}
      <Box p={[16.7, 0.03, 8]} s={[1.5, 0.05, 2.3]} c="#8a2f2a" r={0.02} rough={1} shadow={false} />
      <Box p={[16.7, 0.06, 8]} s={[1.1, 0.02, 1.9]} c="#f0b429" rough={1} shadow={false} />
      {toastNode}
    </Cell>
  );
}
