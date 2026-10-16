import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Tree } from './parts';
import { FLOORPLAN_ZONES, WORLD_W } from '../../data/gamifyZones';

// The street between the house and the cricket ground: a two-lane asphalt road
// with kerbs, pavements, a zebra crossing at the gates, street lamps and a few
// cars driving past. Everything is placed in world coordinates (it runs the full
// width of the plot) and stays visible from every room. Lamps light up whenever
// the sun is not at full strength.

const PI = Math.PI;
const HALF = WORLD_W / 2 + 21; // the road runs past the house on both sides
const LEN = HALF * 2;
export const lampsOn = (weather) => weather !== 'day';

const pavingTexture = (() => {
  let t;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#9a9aa4'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    for (let k = 0; k < 500; k++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

const asphaltTexture = (() => {
  let t;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#2c2c33'; g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 1400; k++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.14)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5); }
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

const glowTexture = (() => {
  let t;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,226,160,0.95)'); gr.addColorStop(0.45, 'rgba(255,200,110,0.35)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

function StreetLamp({ x, z, dir, on }) {
  // dir = +1 when the arm reaches towards +z (the lamp stands on the house side)
  const glow = useMemo(() => glowTexture(), []);
  return (
    <group position={[x, 0.14, z]}>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.2, 0.26, 0.24, 10]} /><meshStandardMaterial color="#2a2a32" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 2.7, 0]} castShadow><cylinderGeometry args={[0.07, 0.11, 5.4, 10]} /><meshStandardMaterial color="#3a3a44" metalness={0.7} roughness={0.4} /></mesh>
      <mesh position={[0, 5.45, dir * 0.9]} rotation={[PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 1.9, 8]} /><meshStandardMaterial color="#3a3a44" metalness={0.7} roughness={0.4} /></mesh>
      <group position={[0, 5.4, dir * 1.85]}>
        <mesh><boxGeometry args={[0.5, 0.12, 0.95]} /><meshStandardMaterial color="#26262e" metalness={0.6} roughness={0.5} /></mesh>
        <mesh position={[0, -0.075, 0]}><boxGeometry args={[0.4, 0.03, 0.8]} /><meshStandardMaterial color={on ? '#fff3cf' : '#7b7b86'} emissive={on ? '#ffd88a' : '#000'} emissiveIntensity={on ? 2.6 : 0} toneMapped={false} /></mesh>
        {on && <mesh position={[0, -5.2, 0]} rotation={[-PI / 2, 0, 0]}><planeGeometry args={[6.4, 6.4]} /><meshBasicMaterial map={glow} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>}
        {on && <mesh position={[0, -0.9, 0]}><coneGeometry args={[1.0, 1.7, 14, 1, true]} /><meshBasicMaterial color="#ffe2a0" transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      </group>
    </group>
  );
}

const CAR_COLORS = ['#1d4ed8', '#e5e7eb', '#16a34a', '#f59e0b', '#7c3aed', '#be123c'];

function TrafficCar({ lane, dir, speed, color, startX, on, kind = 'sedan' }) {
  const ref = useRef();
  const x = useRef(startX);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    x.current += dir * speed * Math.min(dt, 0.1);
    if (x.current > HALF + 4) x.current = -HALF - 4;
    if (x.current < -HALF - 4) x.current = HALF + 4;
    g.position.x = x.current;
  });
  const len = kind === 'van' ? 4.6 : 3.9;
  const h = kind === 'van' ? 1.35 : 0.62;
  return (
    <group ref={ref} position={[startX, 0.02, lane]} rotation={[0, dir > 0 ? PI / 2 : -PI / 2, 0]}>
      <Box p={[0, 0.5, 0]} s={[1.7, kind === 'van' ? 1.0 : 0.5, len]} c={color} r={0.12} metal={0.4} rough={0.3} />
      {kind === 'van'
        ? <Box p={[0, 1.25, -0.4]} s={[1.6, 0.5, len - 1.4]} c={color} r={0.1} />
        : <Box p={[0, 0.75 + h * 0.35, -0.2]} s={[1.5, h * 0.7, 2.0]} c="#16222c" r={0.14} metal={0.8} rough={0.1} />}
      {[-0.86, 0.86].map(wx => [-len / 2 + 0.75, len / 2 - 0.75].map(wz => (
        <mesh key={`${wx}${wz}`} position={[wx, 0.3, wz]} rotation={[0, 0, PI / 2]} castShadow><cylinderGeometry args={[0.3, 0.3, 0.22, 14]} /><meshStandardMaterial color="#0c0c0e" roughness={0.9} /></mesh>
      )))}
      {[-0.55, 0.55].map(hx => <mesh key={hx} position={[hx, 0.55, len / 2]}><boxGeometry args={[0.3, 0.14, 0.04]} /><meshStandardMaterial color="#fff6dc" emissive="#fff0c0" emissiveIntensity={on ? 3 : 0.4} toneMapped={false} /></mesh>)}
      {[-0.55, 0.55].map(hx => <mesh key={`t${hx}`} position={[hx, 0.58, -len / 2]}><boxGeometry args={[0.3, 0.1, 0.04]} /><meshStandardMaterial color="#ff2030" emissive="#ff1030" emissiveIntensity={on ? 2.2 : 0.5} toneMapped={false} /></mesh>)}
      {on && [-0.55, 0.55].map(hx => <mesh key={`b${hx}`} position={[hx, 0.04, len / 2 + 2.4]} rotation={[-PI / 2, 0, 0]}><planeGeometry args={[1.2, 4.6]} /><meshBasicMaterial color="#fff2c8" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>)}
    </group>
  );
}

function BusStop({ x, z }) {
  return (
    <group position={[x, 0.14, z]}>
      {[-1.6, 1.6].map(px => <Box key={px} p={[px, 1.2, 0]} s={[0.1, 2.4, 0.1]} c="#33343c" metal={0.7} />)}
      <Box p={[0, 2.45, 0.1]} s={[3.6, 0.1, 1.5]} c="#1f6feb" r={0.04} />
      <Box p={[0, 1.2, -0.6]} s={[3.2, 2.0, 0.05]} c="#bfe6ff" opacity={0.3} rough={0.1} shadow={false} />
      <Box p={[0, 0.45, -0.3]} s={[2.6, 0.08, 0.5]} c="#8a6a46" />
      <Box p={[0, 1.9, -0.55]} s={[1.0, 0.4, 0.06]} c="#facc15" />
    </group>
  );
}

export function Street({ weather = 'day' }) {
  const z = FLOORPLAN_ZONES.street;
  const on = lampsOn(weather);
  const pave = useMemo(() => { const t = pavingTexture().clone(); t.needsUpdate = true; t.repeat.set(LEN / 4, 1.4); return t; }, []);
  const road = useMemo(() => { const t = asphaltTexture().clone(); t.needsUpdate = true; t.repeat.set(LEN / 6, 1.5); return t; }, []);
  const z0 = z.world.z0;
  const z1 = z.world.z1;
  const roadZ0 = z0 + 3.6;
  const roadZ1 = z1 - 3.6;
  const mid = (roadZ0 + roadZ1) / 2;
  const lamps = [];
  for (let x = -HALF + 4.5; x <= HALF - 3; x += 9) lamps.push(x);
  const dashes = [];
  for (let x = -HALF + 2; x < HALF; x += 4.2) dashes.push(x);

  return (
    <group>
      {/* base slab flush with the house floor, then pavements, asphalt, kerbs */}
      <mesh position={[0, -0.3, z.center.z]} receiveShadow><boxGeometry args={[LEN, 0.6, z1 - z0]} /><meshStandardMaterial color="#2a2a30" roughness={1} /></mesh>
      {[[z0 + 1.8, 'a'], [z1 - 1.8, 'b']].map(([pz, k]) => (
        <mesh key={k} position={[0, 0.07, pz]} receiveShadow><boxGeometry args={[LEN, 0.14, 3.6]} /><meshStandardMaterial map={pave} roughness={0.95} /></mesh>
      ))}
      <mesh position={[0, 0.01, mid]} receiveShadow><boxGeometry args={[LEN, 0.02, roadZ1 - roadZ0]} /><meshStandardMaterial map={road} roughness={1} /></mesh>
      {[roadZ0 + 0.1, roadZ1 - 0.1].map(kz => <mesh key={kz} position={[0, 0.1, kz]}><boxGeometry args={[LEN, 0.2, 0.22]} /><meshStandardMaterial color="#c4c4cc" roughness={0.8} /></mesh>)}
      {/* lane markings */}
      {dashes.map(x => <mesh key={x} position={[x, 0.025, mid]}><boxGeometry args={[2.2, 0.01, 0.16]} /><meshStandardMaterial color="#f4c430" roughness={0.8} /></mesh>)}
      {[roadZ0 + 0.55, roadZ1 - 0.55].map(ez => <mesh key={ez} position={[0, 0.025, ez]}><boxGeometry args={[LEN, 0.01, 0.1]} /><meshStandardMaterial color="#f3f3f3" roughness={0.8} /></mesh>)}
      {/* zebra crossing in line with both gates */}
      {Array.from({ length: 8 }).map((_, i) => <mesh key={i} position={[0, 0.028, roadZ0 + 0.85 + i * 0.9]}><boxGeometry args={[3.4, 0.01, 0.48]} /><meshStandardMaterial color="#f3f3f3" roughness={0.8} /></mesh>)}

      {/* street lamps on both pavements, arms reaching over the road */}
      {lamps.map((x, i) => <StreetLamp key={`a${x}`} x={x + (i % 2 ? 0 : 0)} z={z0 + 0.7} dir={1} on={on} />)}
      {lamps.map(x => <StreetLamp key={`b${x}`} x={x + 4.5} z={z1 - 0.7} dir={-1} on={on} />)}

      {/* pavement dressing: trees in planters, a bus stop, a bench and bins */}
      {[-30, -18, 18, 30].map(x => <group key={x} position={[x, 0.14, z0 + 2.4]}><Box p={[0, 0.15, 0]} s={[1.4, 0.3, 1.4]} c="#7a7a84" r={0.05} /><Tree p={[0, 0.25, 0]} scale={0.5} /></group>)}
      {[-26, 24].map(x => <group key={x} position={[x, 0.14, z1 - 2.4]}><Box p={[0, 0.15, 0]} s={[1.4, 0.3, 1.4]} c="#7a7a84" r={0.05} /><Tree p={[0, 0.25, 0]} scale={0.5} /></group>)}
      <BusStop x={-14} z={z0 + 2.3} />
      <group position={[14, 0.14, z1 - 2.2]}>
        <Box p={[0, 0.45, 0]} s={[2.0, 0.1, 0.55]} c="#8a6a46" /><Box p={[0, 0.72, -0.22]} s={[2.0, 0.4, 0.08]} c="#7a5a3a" />
        {[-0.8, 0.8].map(bx => <Box key={bx} p={[bx, 0.22, 0]} s={[0.08, 0.44, 0.5]} c="#33343c" metal={0.7} />)}
      </group>
      {[-6.5, 6.5].map(bx => <Box key={bx} p={[bx, 0.14 + 0.45, z0 + 0.9]} s={[0.5, 0.9, 0.5]} c="#2f9e5a" r={0.06} />)}

      {/* traffic: a few cars in each lane */}
      <TrafficCar lane={mid - 2.0} dir={1} speed={7} color={CAR_COLORS[0]} startX={-40} on={on} />
      <TrafficCar lane={mid - 2.0} dir={1} speed={5.2} color={CAR_COLORS[3]} startX={12} on={on} kind="van" />
      <TrafficCar lane={mid + 2.0} dir={-1} speed={6.2} color={CAR_COLORS[1]} startX={30} on={on} />
      <TrafficCar lane={mid + 2.0} dir={-1} speed={8.2} color={CAR_COLORS[5]} startX={-20} on={on} />
    </group>
  );
}
