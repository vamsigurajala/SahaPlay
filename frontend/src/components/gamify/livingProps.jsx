import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, PropDot, useOpenProp } from './parts';
import { Cyl, Rod, tapper, PI } from './shopParts';
import { getRadioState } from './radioPlayer';
import { PAINTINGS } from '../../data/gamifyPaintings';

// Small things for the upstairs living room: framed paintings you can tap for their
// story, a retro radio that tunes into the world, a Wi-Fi router, a smart speaker, a
// charger, a remote, a phone and a plush couch.

// ---------------------------------------------------------------- paintings
const texCache = new Map();
function usePaintingTexture(url) {
  const [tex, setTex] = useState(() => texCache.get(url) || null);
  useEffect(() => {
    if (texCache.has(url)) { setTex(texCache.get(url)); return undefined; }
    let live = true;
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      texCache.set(url, t);
      if (live) setTex(t);
    });
    return () => { live = false; };
  }, [url]);
  return tex;
}

export function PaintingFrame({ p, id, maxW = 2.2, maxH = 1.6 }) {
  const art = PAINTINGS[id];
  const tex = usePaintingTexture(art.img);
  const open = useOpenProp('painting', id);
  const k = Math.min(maxW / art.w, maxH / art.h);
  const W = art.w * k;
  const H = art.h * k;
  return (
    <group position={p} {...open}>
      <Box p={[0, 0, 0]} s={[W + 0.3, H + 0.3, 0.1]} c="#c9a24a" metal={0.6} rough={0.35} r={0.03} />
      <Box p={[0, 0, 0.02]} s={[W + 0.1, H + 0.1, 0.1]} c="#3a2812" shadow={false} />
      <mesh position={[0, 0, 0.075]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial key={tex ? 'painted' : 'blank'} map={tex} color={tex ? '#ffffff' : '#3a2e24'} toneMapped={false} />
      </mesh>
      {/* picture light */}
      <Box p={[0, H / 2 + 0.28, 0.12]} s={[Math.min(1.1, W * 0.5), 0.06, 0.08]} c="#b08a2e" metal={0.8} rough={0.3} shadow={false} />
      <Box p={[0, H / 2 + 0.2, 0.08]} s={[0.04, 0.2, 0.04]} c="#b08a2e" metal={0.8} shadow={false} />
      <mesh position={[0, H / 2 + 0.25, 0.17]}><boxGeometry args={[Math.min(1.0, W * 0.45), 0.02, 0.03]} /><meshBasicMaterial color="#fff0c0" toneMapped={false} /></mesh>
      <PropDot position={[0, -H / 2 - 0.5, 0.3]} kind="painting" arg={id} />
    </group>
  );
}

// ---------------------------------------------------------------- radio
export function RetroRadio({ p, rot = 0 }) {
  const open = useOpenProp('radio');
  const dial = useRef();
  const needle = useRef();
  const led = useRef();
  const bars = useRef([]);
  const grille = useRef();
  useFrame((state) => {
    const s = getRadioState().status;
    const on = s === 'playing' || s === 'loading';
    const t = state.clock.elapsedTime;
    if (dial.current) dial.current.material.color.set(on ? '#ffd88a' : '#d8c9a0');
    if (needle.current) needle.current.position.x = 0.2 + (on ? -0.02 + 0.1 * Math.sin(t * 0.6) + (s === 'loading' ? 0.08 * Math.sin(t * 5) : 0) : -0.12);
    if (led.current) led.current.material.color.set(s === 'playing' ? '#4ade80' : s === 'loading' ? '#ffb347' : '#3a3a30');
    bars.current.forEach((b, i) => { if (b) { const h = s === 'playing' ? 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(t * (6 + i * 2.3) + i)) : 0.02; b.scale.y = h / 0.1; } });
    if (grille.current) grille.current.scale.setScalar(s === 'playing' ? 1 + 0.01 * Math.sin(t * 14) : 1);
  });
  return (
    <group position={p} rotation={[0, rot, 0]} {...open}>
      <Box p={[0, 0.27, 0]} s={[0.98, 0.54, 0.36]} c="#8a5a30" r={0.05} rough={0.55} />
      <Box p={[0, 0.27, 0.185]} s={[0.9, 0.46, 0.02]} c="#caa070" r={0.02} shadow={false} />
      {/* speaker cloth with slats */}
      <group ref={grille} position={[-0.22, 0.27, 0.2]}>
        <Box p={[0, 0, 0]} s={[0.4, 0.38, 0.02]} c="#4a3524" shadow={false} />
        {[-0.13, -0.065, 0, 0.065, 0.13].map(x => <Box key={x} p={[x, 0, 0.012]} s={[0.025, 0.32, 0.01]} c="#c9a878" shadow={false} />)}
      </group>
      {/* dial window and needle */}
      <mesh ref={dial} position={[0.2, 0.37, 0.2]}><planeGeometry args={[0.38, 0.14]} /><meshBasicMaterial color="#d8c9a0" toneMapped={false} /></mesh>
      {[-0.15, -0.09, -0.03, 0.03, 0.09, 0.15].map(x => <mesh key={x} position={[0.2 + x, 0.37, 0.202]}><planeGeometry args={[0.006, 0.06]} /><meshBasicMaterial color="#4a3524" toneMapped={false} /></mesh>)}
      <mesh ref={needle} position={[-0.1 + 0.2, 0.37, 0.205]}><planeGeometry args={[0.012, 0.12]} /><meshBasicMaterial color="#d6402f" toneMapped={false} /></mesh>
      {/* knobs, LED, level bars */}
      {[0.1, 0.3].map(x => <Cyl key={x} p={[x, 0.15, 0.21]} r={0.045} h={0.05} c="#2a1c10" rot={[PI / 2, 0, 0]} shadow={false} />)}
      <mesh ref={led} position={[0.42, 0.22, 0.2]}><circleGeometry args={[0.017, 12]} /><meshBasicMaterial color="#3a3a30" toneMapped={false} /></mesh>
      <group position={[0.42, 0.1, 0.2]}>
        {[0, 1, 2, 3].map(i => <mesh key={i} ref={(m) => { bars.current[i] = m; }} position={[(i - 1.5) * 0.04 - 0.04, 0, 0]} scale={[1, 0.2, 1]}><boxGeometry args={[0.025, 0.1, 0.01]} /><meshBasicMaterial color="#4ade80" toneMapped={false} /></mesh>)}
      </group>
      {/* handle and antenna */}
      <Box p={[0, 0.58, 0]} s={[0.5, 0.04, 0.05]} c="#2a1c10" shadow={false} />
      <Rod a={[0.4, 0.54, -0.1]} b={[0.72, 1.12, -0.18]} r={0.012} c="#cfd3da" />
      <mesh position={[0.72, 1.13, -0.18]}><sphereGeometry args={[0.03, 8, 6]} /><meshStandardMaterial color="#cfd3da" metalness={0.8} roughness={0.3} /></mesh>
      <PropDot position={[0, 1.2, 0.2]} kind="radio" />
    </group>
  );
}

export function WaterBottle({ p, c = '#8fd3ff' }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.24, 0]} r={0.075} h={0.48} c={c} rough={0.1} shadow={false} />
      <Cyl p={[0, 0.54, 0]} r={0.03} r2={0.04} h={0.12} c={c} rough={0.1} shadow={false} />
      <Cyl p={[0, 0.62, 0]} r={0.04} h={0.05} c="#1d4ed8" shadow={false} />
      <Cyl p={[0, 0.2, 0]} r={0.078} h={0.14} c="#2a7fd0" shadow={false} />
    </group>
  );
}

// ---------------------------------------------------------------- tv table gadgets
export function WifiRouter({ p, rot = 0 }) {
  const leds = useRef([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    leds.current.forEach((m, i) => { if (m) m.material.color.set(Math.sin(t * (3 + i * 1.9) + i * 2) > -0.35 ? (i === 3 ? '#ffb347' : '#4ade80') : '#16301f'); });
  });
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.06, 0]} s={[0.72, 0.12, 0.44]} c="#f4f4f6" r={0.04} rough={0.4} />
      {[[-0.26, -0.22], [0, 0], [0.26, 0.22]].map(([x, tilt]) => (
        <group key={x} position={[x, 0.12, -0.16]} rotation={[0, 0, tilt]}>
          <Cyl p={[0, 0.24, 0]} r={0.016} h={0.48} c="#1c1c22" shadow={false} />
          <Cyl p={[0, 0.02, 0]} r={0.03} h={0.05} c="#1c1c22" shadow={false} />
        </group>
      ))}
      {[0, 1, 2, 3].map(i => <mesh key={i} ref={(m) => { leds.current[i] = m; }} position={[-0.24 + i * 0.1, 0.07, 0.224]}><circleGeometry args={[0.014, 10]} /><meshBasicMaterial color="#4ade80" toneMapped={false} /></mesh>)}
    </group>
  );
}

export function SmartSpeaker({ p }) {
  const ring = useRef();
  const halo = useRef();
  const until = useRef(0);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = performance.now() < until.current;
    if (ring.current) {
      ring.current.material.color.set(active ? '#7fe9ff' : '#2aa6d6');
      ring.current.material.opacity = active ? 0.8 + 0.2 * Math.sin(t * 12) : 0.5 + 0.15 * Math.sin(t * 1.4);
    }
    if (halo.current) { halo.current.visible = active; halo.current.scale.setScalar(1 + 0.12 * Math.sin(t * 10)); }
  });
  const tap = tapper(() => { until.current = performance.now() + 3200; });
  return (
    <group position={p} {...tap}>
      <mesh position={[0, 0.17, 0]} scale={[1, 0.82, 1]} castShadow><sphereGeometry args={[0.2, 20, 14]} /><meshStandardMaterial color="#2c2f36" roughness={0.9} /></mesh>
      <mesh ref={ring} position={[0, 0.035, 0]} rotation={[PI / 2, 0, 0]}><torusGeometry args={[0.19, 0.012, 8, 32]} /><meshBasicMaterial color="#2aa6d6" transparent opacity={0.6} toneMapped={false} /></mesh>
      <mesh ref={halo} position={[0, 0.06, 0]} rotation={[PI / 2, 0, 0]} visible={false}><torusGeometry args={[0.2, 0.05, 8, 32]} /><meshBasicMaterial color="#5fd8ff" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
      {[[-0.07, 0.07], [0.07, 0.07], [-0.07, -0.07], [0.07, -0.07]].map(([x, z], i) => <mesh key={i} position={[x, 0.335, z]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[0.014, 10]} /><meshBasicMaterial color="#8a8f99" /></mesh>)}
      <mesh position={[0, 0.34, 0]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[0.02, 10]} /><meshBasicMaterial color="#3a3f48" /></mesh>
      <mesh position={[0, 0.2, 0]} visible={false}><sphereGeometry args={[0.32, 6, 5]} /></mesh>
    </group>
  );
}

export function PhoneCharger({ p, rot = 0 }) {
  const cable = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 0.2, 0.06), new THREE.Vector3(-0.2, 0.05, 0.26), new THREE.Vector3(0.0, 0.012, 0.46), new THREE.Vector3(0.3, 0.014, 0.52),
  ]), 24, 0.008, 5, false), []);
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.03, 0]} s={[0.8, 0.06, 0.18]} c="#2a2a30" r={0.02} shadow={false} />
      {[-0.28, -0.06, 0.16].map(x => <Box key={x} p={[x, 0.063, 0.02]} s={[0.1, 0.008, 0.07]} c="#e8e8ee" shadow={false} />)}
      <mesh position={[0.32, 0.065, 0.04]}><circleGeometry args={[0.012, 10]} /><meshBasicMaterial color="#ff6a3a" toneMapped={false} /></mesh>
      <Box p={[-0.2, 0.15, 0.03]} s={[0.17, 0.17, 0.1]} c="#f6f6f8" r={0.025} rough={0.4} shadow={false} />
      <mesh geometry={cable}><meshStandardMaterial color="#f2f2f4" roughness={0.6} /></mesh>
      <group position={[0.55, 0.012, 0.52]} rotation={[0, 0.35, 0]}>
        <Box p={[0, 0, 0]} s={[0.17, 0.022, 0.34]} c="#101114" r={0.012} shadow={false} />
        <mesh position={[0, 0.013, 0]} rotation={[-PI / 2, 0, 0]}><planeGeometry args={[0.15, 0.31]} /><meshBasicMaterial color="#0c2030" toneMapped={false} /></mesh>
        <mesh position={[0, 0.0145, 0]} rotation={[-PI / 2, 0, 0]}><planeGeometry args={[0.07, 0.03]} /><meshBasicMaterial color="#4ade80" toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- coffee table bits
export function Remote({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.02, 0]} s={[0.44, 0.04, 0.12]} c="#25262c" r={0.02} shadow={false} />
      <mesh position={[-0.15, 0.042, 0]} rotation={[-PI / 2, 0, 0]}><circleGeometry args={[0.014, 10]} /><meshBasicMaterial color="#e0302f" /></mesh>
      {[-0.06, 0, 0.06, 0.12].map(x => <Box key={x} p={[x, 0.043, 0]} s={[0.04, 0.008, 0.04]} c="#8a8f99" shadow={false} />)}
      {[-0.06, 0.06].map(x => <Box key={x} p={[x, 0.043, 0.04]} s={[0.04, 0.008, 0.025]} c="#ffd23a" shadow={false} />)}
    </group>
  );
}

export function PhoneFlat({ p, rot = 0 }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.01, 0]} s={[0.17, 0.02, 0.34]} c="#101114" r={0.012} shadow={false} />
      <mesh position={[0, 0.0215, 0]} rotation={[-PI / 2, 0, 0]}><planeGeometry args={[0.15, 0.31]} /><meshBasicMaterial color="#274a7a" toneMapped={false} /></mesh>
      <mesh position={[0, 0.022, 0.08]} rotation={[-PI / 2, 0, 0]}><planeGeometry args={[0.1, 0.1]} /><meshBasicMaterial color="#6aa8ff" toneMapped={false} /></mesh>
    </group>
  );
}

// ---------------------------------------------------------------- plush couch
export function SoftCouch({ p, rot = 0, w = 2.7, c = '#d9a6a0', seat = '#e6b9b2', pillow = '#f6e7c8' }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {[[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].map(([x, z], i) => <Cyl key={i} p={[x * (w - 0.5), 0.07, z * 1.1]} r={0.06} r2={0.045} h={0.14} c="#6e4a28" shadow={false} />)}
      <Box p={[0, 0.36, 0]} s={[w, 0.46, 1.25]} c={c} r={0.22} rough={1} />
      {[-1, 1].map(s => <Box key={s} p={[s * (w / 4 - 0.02), 0.66, 0.12]} s={[w / 2 - 0.4, 0.3, 1.0]} c={seat} r={0.15} rough={1} />)}
      <Box p={[0, 1.02, -0.46]} s={[w - 0.1, 0.92, 0.36]} c={c} r={0.17} rough={1} />
      {[-1, 1].map(s => <Box key={s} p={[s * (w / 2 - 0.17), 0.62, 0.02]} s={[0.36, 0.62, 1.2]} c={c} r={0.18} rough={1} />)}
      <group position={[-w / 4 - 0.05, 1.0, -0.18]} rotation={[-0.22, 0.2, 0.12]}><Box p={[0, 0, 0]} s={[0.55, 0.52, 0.17]} c={pillow} r={0.1} rough={1} /></group>
      <group position={[w / 4 + 0.1, 0.98, -0.2]} rotation={[-0.2, -0.25, -0.1]}><Box p={[0, 0, 0]} s={[0.5, 0.5, 0.17]} c="#7a8fa8" r={0.1} rough={1} /></group>
      <Box p={[w / 2 - 0.17, 0.96, 0.1]} s={[0.42, 0.04, 0.9]} c="#b9c6ad" r={0.02} rot={0} shadow={false} />
    </group>
  );
}
