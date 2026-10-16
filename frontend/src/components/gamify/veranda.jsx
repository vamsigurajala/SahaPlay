import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Lightbulb, Bell, Flame } from 'lucide-react';
import { Box, Plant, Table, Stool, FloorLamp, PropDot, ScaledHtml, FocusContext, ZoneContext } from './parts';
import { Playable } from './gameRoom';
import { Cell } from './cell';
import { StreetWall } from './outdoorRooms';
import { PI, WOOD, WOOD_DARK, BRASS, tapper, Cyl, Rod } from './shopParts';

// The Veranda: the covered sit-out on the street side of the ground floor. A chai
// tapri to pour a glass from, a jhula to push, a wind chime to ring, festoon lights
// that change mood, a rangoli ringed with diyas you can light, an XOXO table
// and a rattan lounge. Everything tappable is also marked with a pulsing dot.


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

// ---------------------------------------------------------------- xoxo table
const XO = ['X', 'O', 'X', null, 'X', 'O', 'O', null, 'X'];

function XoxoBoard() {
  return (
    <group position={[0, 0.98, 0]}>
      <Box p={[0, 0.02, 0]} s={[1.5, 0.06, 1.5]} c="#e8c98a" r={0.02} rough={0.8} />
      {[-0.25, 0.25].map(o => (
        <group key={o}>
          <Box p={[o, 0.06, 0]} s={[0.05, 0.02, 1.3]} c="#3a2412" shadow={false} />
          <Box p={[0, 0.06, o]} s={[1.3, 0.02, 0.05]} c="#3a2412" shadow={false} />
        </group>
      ))}
      {XO.map((v, i) => {
        if (!v) return null;
        const x = ((i % 3) - 1) * 0.5;
        const z = (Math.floor(i / 3) - 1) * 0.5;
        return v === 'X' ? (
          <group key={i} position={[x, 0.1, z]}>
            <Box p={[0, 0, 0]} s={[0.34, 0.06, 0.07]} c="#ff3d8a" rot={PI / 4} shadow={false} />
            <Box p={[0, 0, 0]} s={[0.34, 0.06, 0.07]} c="#ff3d8a" rot={-PI / 4} shadow={false} />
          </group>
        ) : (
          <mesh key={i} position={[x, 0.1, z]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.04, 8, 20]} /><meshStandardMaterial color="#18c6e0" roughness={0.5} /></mesh>
        );
      })}
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
      <div className="stay-white" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(15,12,30,0.88)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
        <toast.Icon size={14} />{toast.text}
      </div>
    </ScaledHtml>
  ) : null;

  return (
    <Cell id="terrace">
      {/* compound wall along the street edge */}
      <StreetWall color="#8a5a3a" cap="#c28a5a" />

      <Bench p={[4.5, 0, 1.05]} />
      <Jhula p={[3.0, 0, 8.4]} say={say} />
      <WindChime p={[16.6, 0, 12.6]} say={say} />

      <Festoon mode={lights} onTap={cycleLights} />
      <PropDot position={[9, 3.1, 0.7]} onClick={cycleLights} />

      <Rangoli p={[11.4, 0, 10.4]} />
      <DiyaRing p={[11.4, 0, 10.4]} say={say} />

      <group position={[7.4, 0, 5.6]}>
        <Playable game="xoxo" dot={[0, 2.0, 0]}>
          <Table p={[0, 0, 0]} w={1.9} d={1.9} h={0.9} c="#8a5f33" leg="#4a2b14" />
          <XoxoBoard />
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
      <Plant p={[16.6, 0, 1.5]} scale={1.35} color="#2f9e5a" pot="#6d4fd0" />
      <Box p={[14.4, 0.35, 1.2]} s={[2.6, 0.7, 1.1]} c={WOOD} r={0.05} />
      <Box p={[14.4, 0.78, 1.2]} s={[2.5, 0.16, 1.0]} c="#2f9aa0" r={0.08} rough={1} />
      <Box p={[13.7, 0.98, 1.1]} s={[0.5, 0.3, 0.5]} c="#f0b429" r={0.12} rough={1} />
      <Plant p={[0.9, 0, 5.2]} scale={1.1} color="#34b36a" pot="#c2410c" />
      <FloorLamp p={[1.1, 0, 14.0]} />
      {/* a doormat just inside the door to the front yard */}
      <Box p={[16.7, 0.03, 8]} s={[1.5, 0.05, 2.3]} c="#8a2f2a" r={0.02} rough={1} shadow={false} />
      <Box p={[16.7, 0.06, 8]} s={[1.1, 0.02, 1.9]} c="#f0b429" rough={1} shadow={false} />
      {toastNode}
    </Cell>
  );
}
