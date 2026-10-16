import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Detailed, low-poly-but-realistic vehicles shared by the Front Yard and the
// supercar viewer: a mid-engine supercar (with a full interior), a superbike and
// road / mountain bicycles. Every model is built along +z (front = +z), 1 unit = 1 m.

const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);

// A cylinder running from point a to point b (frames, forks, pipes, spokes).
export function Tube({ a, b, r = 0.012, color = '#222', metal = 0.6, rough = 0.4, seg = 8 }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    return { pos: va.clone().add(vb).multiplyScalar(0.5).toArray(), quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), len };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, seg]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

// Extrude a side profile (x = along the vehicle, y = up) into a body of the given
// width, then taper the width front/back so the plan view is not a plain slab.
function useBody(upper, bottomY, width, bevel, taper) {
  return useMemo(() => {
    const curve = new THREE.SplineCurve(upper.map(([x, y]) => new THREE.Vector2(x, y)));
    const pts = curve.getPoints(upper.length * 10);
    const sh = new THREE.Shape();
    sh.moveTo(upper[0][0], bottomY);
    pts.forEach(p => sh.lineTo(p.x, p.y));
    sh.lineTo(upper[upper.length - 1][0], bottomY);
    sh.closePath();
    const depth = Math.max(0.02, width - bevel * 2);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, p.getZ(i) * taper(x));
    }
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ───────────────────────────── Wheels ─────────────────────────────

function CarWheel({ x, z, r = 0.36, w = 0.3, spin, left, rimColor = '#c8ccd4' }) {
  const g = useRef();
  useFrame((_, dt) => { if (g.current && spin) g.current.rotation.x -= dt * spin; });
  const dirn = left ? -1 : 1;
  return (
    <group position={[x, r, z]}>
      <group ref={g}>
        <mesh rotation={[0, 0, PI / 2]} castShadow><cylinderGeometry args={[r, r, w, 28]} /><meshStandardMaterial color="#0c0c0e" roughness={0.9} /></mesh>
        <mesh rotation={[0, 0, PI / 2]} position={[dirn * (w / 2 - 0.01), 0, 0]}><cylinderGeometry args={[r * 0.74, r * 0.74, 0.03, 24]} /><meshStandardMaterial color={rimColor} metalness={0.9} roughness={0.22} /></mesh>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[dirn * (w / 2), Math.cos((i / 10) * PI * 2) * r * 0.38, Math.sin((i / 10) * PI * 2) * r * 0.38]} rotation={[(i / 10) * PI * 2, 0, 0]}>
            <boxGeometry args={[0.025, r * 0.55, 0.035]} /><meshStandardMaterial color={rimColor} metalness={0.9} roughness={0.25} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, PI / 2]} position={[dirn * (w / 2 + 0.005), 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.03, 12]} /><meshStandardMaterial color="#222" metalness={0.8} /></mesh>
      </group>
      <mesh rotation={[0, 0, PI / 2]} position={[dirn * (w / 2 - 0.09), 0, 0]}><cylinderGeometry args={[r * 0.62, r * 0.62, 0.025, 24]} /><meshStandardMaterial color="#2c2c32" metalness={0.8} roughness={0.35} /></mesh>
      <mesh position={[dirn * (w / 2 - 0.06), r * 0.28, 0.16]}><boxGeometry args={[0.07, 0.18, 0.2]} /><meshStandardMaterial color="#d11a2a" roughness={0.4} metalness={0.4} /></mesh>
    </group>
  );
}

// ───────────────────────────── Supercar ─────────────────────────────

// The body is built in pieces (nose + tail + side panels) so the cabin stays open for the interior.
const CAR_NOSE = [[0.55, 0.86], [0.9, 0.79], [1.6, 0.6], [2.12, 0.46], [2.3, 0.34]];
const CAR_TAIL = [[-2.28, 0.3], [-2.3, 0.6], [-2.05, 0.86], [-1.5, 0.94], [-1.0, 0.96]];
const CAR_GLASS = [[-1.0, 0.9], [-0.8, 1.06], [-0.4, 1.21], [0.0, 1.235], [0.38, 1.05], [0.58, 0.9]];
const carTaper = (x) => 1 - 0.2 * clamp01((x - 0.4) / 1.9) - 0.2 * clamp01((-x - 1.0) / 1.2);
const glassTaper = (x) => 1 - 0.28 * clamp01(Math.abs(x + 0.35) / 0.9);

function Seat({ x, z, color = '#15151a', accent = '#c1121f' }) {
  return (
    <group position={[x, 0.42, z]}>
      <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.46, 0.12, 0.5]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <mesh position={[0, 0.34, -0.25]} rotation={[-0.22, 0, 0]}><boxGeometry args={[0.46, 0.64, 0.12]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <mesh position={[0, 0.66, -0.31]}><boxGeometry args={[0.32, 0.16, 0.1]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <mesh position={[0.2, 0.05, 0]}><boxGeometry args={[0.05, 0.14, 0.5]} /><meshStandardMaterial color={accent} roughness={0.6} /></mesh>
      <mesh position={[-0.2, 0.05, 0]}><boxGeometry args={[0.05, 0.14, 0.5]} /><meshStandardMaterial color={accent} roughness={0.6} /></mesh>
      <mesh position={[0, 0.36, -0.185]} rotation={[-0.22, 0, 0]}><boxGeometry args={[0.1, 0.5, 0.02]} /><meshStandardMaterial color={accent} roughness={0.6} /></mesh>
    </group>
  );
}

function Interior({ started, lightsOn }) {
  const wheel = useRef();
  useFrame((st) => { if (wheel.current && started) wheel.current.position.y = 0.88 + Math.sin(st.clock.elapsedTime * 46) * 0.0012; });
  const glow = started ? '#38bdf8' : '#1b2430';
  return (
    <group>
      {/* floor + tub */}
      <mesh position={[0, 0.38, -0.05]}><boxGeometry args={[1.5, 0.05, 1.9]} /><meshStandardMaterial color="#0e0e12" roughness={0.9} /></mesh>
      <Seat x={-0.38} z={-0.28} />
      <Seat x={0.38} z={-0.28} />
      {/* centre console + gear selector buttons */}
      <mesh position={[0, 0.55, 0.05]}><boxGeometry args={[0.22, 0.2, 1.0]} /><meshStandardMaterial color="#17171d" roughness={0.6} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0, 0.66, 0.38 - i * 0.12]}><boxGeometry args={[0.08, 0.02, 0.07]} /><meshStandardMaterial color="#c1121f" emissive="#c1121f" emissiveIntensity={started ? 0.6 : 0.1} /></mesh>)}
      {/* dashboard */}
      <mesh position={[0, 0.78, 0.3]} rotation={[0.25, 0, 0]}><boxGeometry args={[1.3, 0.26, 0.4]} /><meshStandardMaterial color="#101015" roughness={0.55} /></mesh>
      <mesh position={[0, 0.9, 0.34]} rotation={[0.25, 0, 0]}><boxGeometry args={[1.3, 0.03, 0.42]} /><meshStandardMaterial color="#1c1c24" roughness={0.5} /></mesh>
      {/* instrument cluster in front of the driver */}
      <mesh position={[-0.38, 0.9, 0.2]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.34, 0.15, 0.04]} /><meshStandardMaterial color="#05080c" emissive={glow} emissiveIntensity={started ? 0.9 : 0.15} /></mesh>
      <mesh position={[0.38, 0.88, 0.26]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.3, 0.12, 0.03]} /><meshStandardMaterial color="#05080c" emissive={glow} emissiveIntensity={started ? 0.6 : 0.1} /></mesh>
      {/* steering column + wheel (left-hand drive) */}
      <mesh position={[-0.38, 0.78, 0.1]} rotation={[0.9, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.34, 8]} /><meshStandardMaterial color="#222" metalness={0.6} /></mesh>
      <group ref={wheel} position={[-0.38, 0.88, 0.0]} rotation={[1.0, 0, 0]}>
        <mesh><torusGeometry args={[0.17, 0.022, 10, 28]} /><meshStandardMaterial color="#0b0b0e" roughness={0.6} /></mesh>
        <mesh><cylinderGeometry args={[0.045, 0.045, 0.03, 12]} /><meshStandardMaterial color="#d6a516" metalness={0.7} roughness={0.35} /></mesh>
        <mesh rotation={[PI / 2, 0, 0]}><boxGeometry args={[0.3, 0.02, 0.025]} /><meshStandardMaterial color="#0b0b0e" /></mesh>
        <mesh position={[0, 0.17, 0]}><boxGeometry args={[0.03, 0.02, 0.03]} /><meshStandardMaterial color="#e11d2e" emissive="#e11d2e" emissiveIntensity={0.8} /></mesh>
      </group>
      {/* pedals */}
      {[-0.46, -0.38, -0.3].map((x, i) => <mesh key={x} position={[x, 0.46, 0.5 + i * 0.01]} rotation={[0.6, 0, 0]}><boxGeometry args={[0.06, 0.13, 0.015]} /><meshStandardMaterial color="#9aa0aa" metalness={0.8} roughness={0.3} /></mesh>)}
      {lightsOn && <pointLight position={[0, 0.95, 0]} intensity={started ? 0.9 : 0.5} distance={2.6} color="#ffd9b0" />}
    </group>
  );
}

export function Supercar3D({ color = '#c8102e', lightsOn = true, doorsOpen = false, started = false, spin = 0, interior = true, wingUp = false, cutaway = false }) {
  const nose = useBody(CAR_NOSE, 0.22, 1.9, 0.09, carTaper);
  const tail = useBody(CAR_TAIL, 0.22, 1.9, 0.09, carTaper);
  const glass = useBody(CAR_GLASS, 0.88, 1.3, 0.03, glassTaper);
  const root = useRef();
  const doorL = useRef();
  const doorR = useRef();
  const wing = useRef();
  useFrame((st, dt) => {
    const k = 1 - Math.exp(-dt * 6);
    const open = doorsOpen ? 1 : 0;
    for (const [r, s] of [[doorL, -1], [doorR, 1]]) {
      if (r.current) r.current.rotation.z += ((open ? s * 1.05 : 0) - r.current.rotation.z) * k;
    }
    if (wing.current) wing.current.rotation.x += ((wingUp || spin > 5 ? -0.3 : 0) - wing.current.rotation.x) * k;
    if (root.current && started) root.current.position.y = Math.sin(st.clock.elapsedTime * 55) * 0.0014;
  });
  const paint = useMemo(() => ({ color, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 }), [color]);
  const glowHead = lightsOn ? 2.2 : 0.15;
  return (
    <group ref={root}>
      {/* body shell, glass greenhouse and roof */}
      <mesh geometry={nose} rotation={[0, -PI / 2, 0]} castShadow receiveShadow><meshPhysicalMaterial {...paint} /></mesh>
      <mesh geometry={tail} rotation={[0, -PI / 2, 0]} castShadow receiveShadow><meshPhysicalMaterial {...paint} /></mesh>
      {/* sills and rear quarter panels around the open cabin */}
      {[-1, 1].map(sd => (
        <group key={`sd${sd}`}>
          <mesh position={[sd * 0.9, 0.46, -0.25]} castShadow><boxGeometry args={[0.1, 0.34, 1.62]} /><meshPhysicalMaterial {...paint} /></mesh>
          <mesh position={[sd * 0.9, 0.8, -0.78]} castShadow><boxGeometry args={[0.1, 0.4, 0.45]} /><meshPhysicalMaterial {...paint} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.7, 0.62]}><boxGeometry args={[1.6, 0.2, 0.1]} /><meshPhysicalMaterial {...paint} /></mesh>
      <mesh position={[0, 0.86, -0.97]}><boxGeometry args={[1.5, 0.2, 0.08]} /><meshStandardMaterial color="#0a0a0c" roughness={0.8} /></mesh>
      {!cutaway && <mesh geometry={glass} rotation={[0, -PI / 2, 0]}><meshPhysicalMaterial color="#0a1822" metalness={0.85} roughness={0.06} transparent opacity={0.42} depthWrite={false} /></mesh>}
      {!cutaway && <mesh position={[0, 1.23, -0.2]}><boxGeometry args={[0.9, 0.03, 0.7]} /><meshPhysicalMaterial {...paint} /></mesh>}
      <mesh position={[0, 0.4, 0]}><boxGeometry args={[1.8, 0.06, 4.3]} /><meshStandardMaterial color="#09090b" roughness={0.9} /></mesh>
      {interior && <Interior started={started} lightsOn={lightsOn} />}

      {/* nose: splitter, intake and light blades */}
      <mesh position={[0, 0.25, 2.2]}><boxGeometry args={[1.7, 0.04, 0.5]} /><meshStandardMaterial color="#0a0a0c" roughness={0.4} metalness={0.5} /></mesh>
      <mesh position={[0, 0.4, 2.27]}><boxGeometry args={[1.0, 0.13, 0.05]} /><meshStandardMaterial color="#050506" roughness={0.6} /></mesh>
      {[-1, 1].map(s => (
        <group key={s}>
          <mesh position={[s * 0.5, 0.545, 1.99]} rotation={[0.3, s * 0.2, 0]}><boxGeometry args={[0.34, 0.03, 0.16]} /><meshStandardMaterial color="#f6f9ff" emissive="#dbeafe" emissiveIntensity={glowHead} toneMapped={false} /></mesh>
          <mesh position={[s * 0.5, 0.52, 1.98]} rotation={[0.3, s * 0.2, 0]}><boxGeometry args={[0.4, 0.05, 0.2]} /><meshStandardMaterial color="#0b0f14" metalness={0.9} roughness={0.1} /></mesh>
          {/* side blade intake */}
          <mesh position={[s * 0.88, 0.52, -0.55]}><boxGeometry args={[0.05, 0.22, 0.75]} /><meshStandardMaterial color="#050506" roughness={0.7} /></mesh>
          {/* mirror */}
          <mesh position={[s * 0.82, 0.98, 0.5]}><boxGeometry args={[0.18, 0.1, 0.1]} /><meshPhysicalMaterial {...paint} /></mesh>
          <mesh position={[s * 0.76, 0.93, 0.5]}><boxGeometry args={[0.1, 0.04, 0.04]} /><meshStandardMaterial color="#111" /></mesh>
          {/* exhaust tips */}
          {[0.12, 0.34].map(o => (
            <mesh key={o} position={[s * o + s * 0.0, 0.46, -2.27]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.06, 0.16, 14]} /><meshStandardMaterial color="#8d95a3" metalness={0.95} roughness={0.2} emissive={started ? '#ff6a1a' : '#000000'} emissiveIntensity={started ? 0.5 : 0} /></mesh>
          ))}
        </group>
      ))}
      {/* tail lamp bar + diffuser */}
      <mesh position={[0, 0.72, -2.29]}><boxGeometry args={[1.5, 0.06, 0.03]} /><meshStandardMaterial color="#ff2a3a" emissive="#ff1030" emissiveIntensity={lightsOn ? 2.4 : 0.5} toneMapped={false} /></mesh>
      <mesh position={[0, 0.3, -2.2]} rotation={[0.35, 0, 0]}><boxGeometry args={[1.5, 0.05, 0.4]} /><meshStandardMaterial color="#0a0a0c" roughness={0.5} /></mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map(x => <mesh key={x} position={[x, 0.3, -2.3]}><boxGeometry args={[0.02, 0.16, 0.25]} /><meshStandardMaterial color="#050506" /></mesh>)}
      {/* active wing */}
      <group ref={wing} position={[0, 0.98, -2.12]}>
        {[-0.5, 0.5].map(x => <mesh key={x} position={[x, -0.06, 0.03]}><boxGeometry args={[0.05, 0.16, 0.08]} /><meshStandardMaterial color="#0a0a0c" metalness={0.6} /></mesh>)}
        <mesh position={[0, 0.03, 0]}><boxGeometry args={[1.62, 0.035, 0.34]} /><meshPhysicalMaterial {...paint} /></mesh>
        {[-0.81, 0.81].map(x => <mesh key={x} position={[x, 0.03, 0]}><boxGeometry args={[0.03, 0.12, 0.36]} /><meshStandardMaterial color="#0a0a0c" /></mesh>)}
      </group>
      {/* engine cover vents */}
      {[-0.5, -0.65, -0.8, -0.95, -1.1].map(z => <mesh key={z} position={[0, 0.955 - (z + 0.5) * -0.08, z - 0.4]} rotation={[0.04, 0, 0]}><boxGeometry args={[0.6, 0.012, 0.07]} /><meshStandardMaterial color="#060607" /></mesh>)}

      {/* scissor doors: hinge at the front pillar, swing up */}
      {[[doorL, -1], [doorR, 1]].map(([ref, s]) => (
        <group key={s} ref={ref} position={[s * 0.84, 0.74, 0.55]}>
          <mesh position={[0, 0.06, -0.55]}><boxGeometry args={[0.07, 0.4, 1.1]} /><meshPhysicalMaterial {...paint} /></mesh>
          <mesh position={[s * 0.01, 0.4, -0.5]} rotation={[0, 0, s * -0.22]}><boxGeometry args={[0.04, 0.3, 0.86]} /><meshPhysicalMaterial color="#0a1822" metalness={0.8} roughness={0.08} transparent opacity={0.5} /></mesh>
          <mesh position={[s * 0.045, 0.14, -0.9]}><boxGeometry args={[0.03, 0.03, 0.16]} /><meshStandardMaterial color="#cfd3da" metalness={0.9} roughness={0.2} /></mesh>
        </group>
      ))}

      {/* wheels: wider and slightly larger at the back */}
      <CarWheel x={-0.84} z={1.4} left spin={spin} />
      <CarWheel x={0.84} z={1.4} spin={spin} />
      <CarWheel x={-0.9} z={-1.35} r={0.38} w={0.34} left spin={spin} />
      <CarWheel x={0.9} z={-1.35} r={0.38} w={0.34} spin={spin} />
      {[[-1, 1.4], [1, 1.4], [-1, -1.35], [1, -1.35]].map(([s, z]) => (
        <mesh key={`${s}${z}`} position={[s * (z > 0 ? 0.8 : 0.86), 0.38, z]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.45, 0.45, 0.04, 24]} /><meshStandardMaterial color="#030304" roughness={1} /></mesh>
      ))}
    </group>
  );
}

// ───────────────────────────── Superbike ─────────────────────────────

const FAIRING = [[0.4, 1.0], [0.62, 1.1], [0.86, 1.0], [1.02, 0.88], [1.06, 0.78], [0.8, 0.66], [0.4, 0.62]];
const BIKE_TAPER = (x) => 0.38 + 0.62 * clamp01(1 - Math.abs(x - 0.5) / 0.65);

function BikeWheel({ z, r = 0.33, spin, tube = 0.085, disc = true }) {
  const g = useRef();
  useFrame((_, dt) => { if (g.current && spin) g.current.rotation.x -= dt * spin; });
  return (
    <group position={[0, r, z]}>
      <group ref={g}>
        <mesh rotation={[0, PI / 2, 0]} castShadow><torusGeometry args={[r - tube * 0.2, tube, 12, 36]} /><meshStandardMaterial color="#0b0b0d" roughness={0.9} /></mesh>
        <mesh rotation={[0, PI / 2, 0]}><torusGeometry args={[r - tube * 1.3, 0.016, 8, 32]} /><meshStandardMaterial color="#d4a017" metalness={0.9} roughness={0.25} /></mesh>
        {Array.from({ length: 5 }).map((_, i) => {
          const a = (i / 5) * PI * 2;
          return <Tube key={i} a={[0, 0, 0]} b={[0, Math.cos(a) * (r - tube * 1.3), Math.sin(a) * (r - tube * 1.3)]} r={0.016} color="#d4a017" metal={0.9} rough={0.25} seg={6} />;
        })}
      </group>
      {disc && <mesh rotation={[0, 0, PI / 2]} position={[0.055, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.008, 20]} /><meshStandardMaterial color="#9aa0aa" metalness={0.9} roughness={0.3} /></mesh>}
      {disc && <mesh position={[0.09, 0.07, 0.05]}><boxGeometry args={[0.04, 0.07, 0.1]} /><meshStandardMaterial color="#d11a2a" /></mesh>}
    </group>
  );
}

export function Superbike3D({ color = '#d1121f', lightsOn = true, spin = 0 }) {
  const fairing = useBody(FAIRING, 0.62, 0.3, 0.04, BIKE_TAPER);
  const paint = { color, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 };
  return (
    <group>
      <BikeWheel z={0.72} spin={spin} />
      <BikeWheel z={-0.7} r={0.34} tube={0.11} spin={spin} />
      {/* front fork (gold inner tubes) and triple clamp */}
      {[-0.11, 0.11].map(x => (
        <group key={x}>
          <Tube a={[x, 0.33, 0.72]} b={[x, 0.97, 0.42]} r={0.024} color="#d4a017" metal={0.9} rough={0.25} />
          <Tube a={[x, 0.7, 0.55]} b={[x, 1.0, 0.4]} r={0.034} color="#1a1a1e" metal={0.7} rough={0.35} />
        </group>
      ))}
      <mesh position={[0, 1.0, 0.4]}><boxGeometry args={[0.3, 0.05, 0.08]} /><meshStandardMaterial color="#2a2a30" metalness={0.8} roughness={0.3} /></mesh>
      {/* clip-ons, mirrors, levers */}
      {[-1, 1].map(s => (
        <group key={s}>
          <Tube a={[s * 0.13, 1.03, 0.4]} b={[s * 0.27, 1.06, 0.3]} r={0.016} color="#18181c" />
          <mesh position={[s * 0.3, 1.13, 0.33]}><boxGeometry args={[0.1, 0.07, 0.025]} /><meshStandardMaterial color="#10141a" metalness={0.8} roughness={0.15} /></mesh>
          <Tube a={[s * 0.3, 1.07, 0.33]} b={[s * 0.3, 1.12, 0.33]} r={0.008} color="#111" />
        </group>
      ))}
      {/* aluminium twin-spar frame + engine */}
      <Tube a={[0, 0.98, 0.34]} b={[0, 0.62, -0.28]} r={0.045} color="#3a3d44" metal={0.9} rough={0.3} />
      <Tube a={[0.14, 0.95, 0.3]} b={[0.14, 0.6, -0.3]} r={0.03} color="#3a3d44" metal={0.9} rough={0.3} />
      <Tube a={[-0.14, 0.95, 0.3]} b={[-0.14, 0.6, -0.3]} r={0.03} color="#3a3d44" metal={0.9} rough={0.3} />
      <mesh position={[0, 0.5, 0.12]}><boxGeometry args={[0.3, 0.3, 0.46]} /><meshStandardMaterial color="#2a2c32" metalness={0.8} roughness={0.35} /></mesh>
      <mesh position={[0, 0.74, 0.18]}><boxGeometry args={[0.26, 0.16, 0.36]} /><meshStandardMaterial color="#8b9099" metalness={0.85} roughness={0.3} /></mesh>
      {[0.28, 0.12, -0.04].map(z => <mesh key={z} position={[0, 0.86, z]}><boxGeometry args={[0.22, 0.03, 0.04]} /><meshStandardMaterial color="#3a3d44" metalness={0.9} /></mesh>)}
      {/* swingarm and rear shock */}
      {[-0.1, 0.1].map(x => <Tube key={x} a={[x, 0.56, -0.28]} b={[x, 0.34, -0.7]} r={0.03} color="#9aa0aa" metal={0.9} rough={0.3} />)}
      <Tube a={[0, 0.9, -0.18]} b={[0, 0.5, -0.42]} r={0.022} color="#e0a416" metal={0.8} rough={0.3} />
      {/* exhaust */}
      <Tube a={[0.13, 0.36, 0.2]} b={[0.17, 0.36, -0.4]} r={0.042} color="#7a7f88" metal={0.95} rough={0.25} />
      <mesh position={[0.2, 0.42, -0.82]} rotation={[PI / 2.15, 0, 0]}><cylinderGeometry args={[0.07, 0.065, 0.55, 14]} /><meshStandardMaterial color="#aeb4be" metalness={0.95} roughness={0.2} /></mesh>
      <mesh position={[0.2, 0.46, -1.09]} rotation={[PI / 2.15, 0, 0]}><cylinderGeometry args={[0.058, 0.058, 0.03, 14]} /><meshStandardMaterial color="#111" metalness={0.5} /></mesh>
      {/* body: fairing, screen, headlights, tank, seat, tail */}
      <mesh geometry={fairing} rotation={[0, -PI / 2, 0]} castShadow><meshPhysicalMaterial {...paint} /></mesh>
      <mesh position={[0, 1.2, 0.5]} rotation={[0.75, 0, 0]}><boxGeometry args={[0.24, 0.17, 0.014]} /><meshPhysicalMaterial color="#a8c6d8" transparent opacity={0.35} roughness={0.05} /></mesh>
      {[-0.07, 0.07].map(x => <mesh key={x} position={[x, 0.9, 1.04]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.07, 0.06, 0.03]} /><meshStandardMaterial color="#f6f9ff" emissive="#e8f0ff" emissiveIntensity={lightsOn ? 2.4 : 0.15} toneMapped={false} /></mesh>)}
      <mesh position={[0, 0.9, 0.0]} scale={[0.25, 0.2, 0.5]}><sphereGeometry args={[1, 18, 14]} /><meshPhysicalMaterial {...paint} /></mesh>
      <mesh position={[0, 0.84, -0.38]} rotation={[0.12, 0, 0]}><boxGeometry args={[0.26, 0.08, 0.5]} /><meshStandardMaterial color="#111114" roughness={0.8} /></mesh>
      <mesh position={[0, 0.9, -0.82]} rotation={[-0.25, 0, 0]}><boxGeometry args={[0.2, 0.14, 0.42]} /><meshPhysicalMaterial {...paint} /></mesh>
      <mesh position={[0, 0.88, -1.04]}><boxGeometry args={[0.15, 0.03, 0.03]} /><meshStandardMaterial color="#ff2030" emissive="#ff1030" emissiveIntensity={lightsOn ? 2.2 : 0.4} toneMapped={false} /></mesh>
      <mesh position={[0, 0.7, -0.98]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.16, 0.1, 0.012]} /><meshStandardMaterial color="#e8e8e0" roughness={0.6} /></mesh>
      {/* foot pegs */}
      {[-1, 1].map(s => <mesh key={s} position={[s * 0.18, 0.42, -0.34]}><boxGeometry args={[0.07, 0.025, 0.1]} /><meshStandardMaterial color="#222" metalness={0.7} /></mesh>)}
    </group>
  );
}

// ───────────────────────────── Bicycles ─────────────────────────────

function CycleWheel({ z, r, tire, color, spin, spokes = 18 }) {
  const g = useRef();
  useFrame((_, dt) => { if (g.current && spin) g.current.rotation.x -= dt * spin; });
  return (
    <group position={[0, r, z]}>
      <group ref={g}>
        <mesh rotation={[0, PI / 2, 0]} castShadow><torusGeometry args={[r, tire, 8, 40]} /><meshStandardMaterial color="#111114" roughness={0.9} /></mesh>
        <mesh rotation={[0, PI / 2, 0]}><torusGeometry args={[r - tire - 0.004, 0.008, 6, 40]} /><meshStandardMaterial color={color} metalness={0.9} roughness={0.25} /></mesh>
        {Array.from({ length: spokes }).map((_, i) => {
          const a = (i / spokes) * PI * 2;
          const ox = i % 2 ? 0.012 : -0.012;
          return <Tube key={i} a={[ox, 0, 0]} b={[0, Math.cos(a) * (r - tire - 0.004), Math.sin(a) * (r - tire - 0.004)]} r={0.0025} color="#c9ced6" metal={0.9} rough={0.3} seg={4} />;
        })}
        <mesh rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.022, 0.022, 0.09, 10]} /><meshStandardMaterial color="#aab0ba" metalness={0.9} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

export function Bicycle3D({ type = 'road', color = '#1d4ed8', accent = '#f8fafc', spin = 0 }) {
  const mtb = type === 'mtb';
  const R = mtb ? 0.345 : 0.34;
  const tire = mtb ? 0.036 : 0.016;
  const rear = [0, R, -0.5];
  const front = [0, R, 0.52];
  const bb = [0, 0.27, -0.06];
  const seat = [0, mtb ? 0.76 : 0.8, -0.18];
  const headTop = [0, mtb ? 0.77 : 0.8, 0.37];
  const headBot = [0, mtb ? 0.64 : 0.67, 0.4];
  const fr = { r: mtb ? 0.02 : 0.016, color, metal: 0.55, rough: 0.28 };
  return (
    <group>
      <CycleWheel z={rear[2]} r={R} tire={tire} color={accent} spin={spin} spokes={mtb ? 16 : 22} />
      <CycleWheel z={front[2]} r={R} tire={tire} color={accent} spin={spin} spokes={mtb ? 16 : 22} />
      {/* frame */}
      <Tube a={bb} b={seat} {...fr} />
      <Tube a={seat} b={headTop} {...fr} />
      <Tube a={bb} b={headBot} {...fr} r={fr.r * 1.25} />
      <Tube a={headTop} b={headBot} {...fr} r={fr.r * 1.3} />
      {[-0.05, 0.05].map(x => <Tube key={`cs${x}`} a={[x, bb[1], bb[2]]} b={[x * 0.9, rear[1], rear[2]]} {...fr} r={0.011} />)}
      {[-0.05, 0.05].map(x => <Tube key={`ss${x}`} a={[0, seat[1] - 0.04, seat[2]]} b={[x * 0.9, rear[1], rear[2]]} {...fr} r={0.009} />)}
      {/* fork, stem, bars */}
      {[-0.045, 0.045].map(x => <Tube key={`f${x}`} a={[x * 0.6, headBot[1], headBot[2]]} b={[x, front[1], front[2]]} {...fr} r={0.014} />)}
      <Tube a={headTop} b={[0, headTop[1] + 0.1, headTop[2] + 0.03]} r={0.016} color="#16161a" metal={0.7} rough={0.3} />
      {mtb ? (
        <Tube a={[-0.31, headTop[1] + 0.11, headTop[2] + 0.03]} b={[0.31, headTop[1] + 0.11, headTop[2] + 0.03]} r={0.011} color="#16161a" metal={0.7} rough={0.3} />
      ) : (
        <group position={[0, headTop[1] + 0.1, headTop[2] + 0.03]}>
          <Tube a={[-0.2, 0, 0]} b={[0.2, 0, 0]} r={0.011} color="#16161a" metal={0.7} rough={0.3} />
          {[-1, 1].map(s => <group key={s}>
            <Tube a={[s * 0.2, 0, 0]} b={[s * 0.2, -0.07, 0.1]} r={0.011} color="#16161a" metal={0.7} rough={0.3} />
            <Tube a={[s * 0.2, -0.07, 0.1]} b={[s * 0.2, -0.12, 0.04]} r={0.011} color="#16161a" metal={0.7} rough={0.3} />
          </group>)}
        </group>
      )}
      {/* saddle + seatpost */}
      <Tube a={[0, seat[1] - 0.02, seat[2]]} b={[0, seat[1] + 0.1, seat[2] - 0.01]} r={0.012} color="#c9ced6" metal={0.9} rough={0.25} />
      <mesh position={[0, seat[1] + 0.12, seat[2] - 0.02]} scale={[0.07, 0.03, 0.15]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#16161a" roughness={0.8} /></mesh>
      {/* drivetrain */}
      <mesh position={[0.06, bb[1], bb[2]]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.095, 0.095, 0.008, 28]} /><meshStandardMaterial color="#9aa0aa" metalness={0.9} roughness={0.3} /></mesh>
      <mesh position={[0.045, rear[1], rear[2]]} rotation={[0, 0, PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.03, 18]} /><meshStandardMaterial color="#8b9099" metalness={0.9} roughness={0.3} /></mesh>
      <Tube a={[0.06, bb[1] + 0.09, bb[2]]} b={[0.05, rear[1] + 0.05, rear[2]]} r={0.005} color="#2b2b30" metal={0.7} />
      <Tube a={[0.06, bb[1] - 0.09, bb[2]]} b={[0.05, rear[1] - 0.05, rear[2]]} r={0.005} color="#2b2b30" metal={0.7} />
      <Tube a={[0.07, bb[1] + 0.02, bb[2] - 0.0]} b={[0.07, bb[1] - 0.14, bb[2] + 0.05]} r={0.011} color="#1a1a1e" metal={0.8} />
      <Tube a={[-0.07, bb[1] - 0.02, bb[2]]} b={[-0.07, bb[1] + 0.14, bb[2] - 0.05]} r={0.011} color="#1a1a1e" metal={0.8} />
      {mtb && <Tube a={[0, headBot[1] + 0.04, headBot[2] - 0.02]} b={[0, front[1] + 0.12, front[2] - 0.02]} r={0.026} color="#2a2a30" metal={0.8} rough={0.3} />}
      {mtb && <Tube a={[0, bb[1] + 0.2, bb[2] - 0.09]} b={[0, rear[1] + 0.16, rear[2] + 0.1]} r={0.02} color="#e0a416" metal={0.8} rough={0.3} />}
    </group>
  );
}
