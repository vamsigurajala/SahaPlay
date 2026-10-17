import { useContext, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ViewContext, Tree } from './parts';

// The world around the house: grass plot, road, trees, drifting clouds, rain, and
// the weather presets that tint every light in the scene. The sky itself is a CSS
// gradient behind the (transparent) canvas — see SkyBackdrop.

export const WEATHER = {
  sunrise: {
    label: 'Sunrise', sky: ['#5b6aa8', '#f4a6a0', '#ffd9a0'], ambient: ['#ffe0c8', 0.85], hemi: ['#ffc8a0', '#4a4a4a', 0.6],
    sun: { color: '#ffc890', int: 1.3, pos: [-16, 11, 18] }, neon: 0.8, cloud: { color: '#ffd8c8', count: 8, op: 0.95 }, grass: '#7aa05a', disc: { x: '78%', y: '58%', color: '#ffe0a0', size: 90 }, stars: 0.1,
  },
  day: {
    label: 'Day', sky: ['#3d8be0', '#7cc0f2', '#cfe9fa'], ambient: ['#ffffff', 0.95], hemi: ['#c4e2ff', '#5a7a4a', 0.7],
    sun: { color: '#fff4e0', int: 1.8, pos: [14, 26, 16] }, neon: 0.45, cloud: { color: '#ffffff', count: 7, op: 1 }, grass: '#5aa550', disc: { x: '80%', y: '16%', color: '#fff6c8', size: 80 }, stars: 0,
  },
  cloudy: {
    label: 'Cloudy', sky: ['#7d8da3', '#a9b6c5', '#d0d8e0'], ambient: ['#d4dce8', 0.85], hemi: ['#b6c2d2', '#4f6048', 0.6],
    sun: { color: '#e4eaf2', int: 0.85, pos: [14, 26, 16] }, neon: 0.7, cloud: { color: '#d8dee6', count: 16, op: 1 }, grass: '#4f8f4c', disc: null, stars: 0,
  },
  rain: {
    label: 'Rainy', sky: ['#4a5565', '#69758a', '#8a96a6'], ambient: ['#9eacc0', 0.7], hemi: ['#7d8ca2', '#38483a', 0.5],
    sun: { color: '#aabbd0', int: 0.55, pos: [14, 26, 16] }, neon: 0.95, cloud: { color: '#7c8798', count: 16, op: 1 }, grass: '#3e7a45', disc: null, stars: 0, rain: true,
  },
  sunset: {
    label: 'Sunset', sky: ['#3b3a78', '#e9786a', '#ffc178'], ambient: ['#ffd2b4', 0.85], hemi: ['#ffb890', '#4a4458', 0.6],
    sun: { color: '#ffb070', int: 1.2, pos: [22, 9, -10] }, neon: 0.95, cloud: { color: '#ffb0a0', count: 9, op: 0.95 }, grass: '#6a8c4c', disc: { x: '20%', y: '60%', color: '#ffb060', size: 110 }, stars: 0.2,
  },
  night: {
    label: 'Night', sky: ['#070b1f', '#101a3d', '#26305a'], ambient: ['#8a8cff', 0.5], hemi: ['#6a70e0', '#141028', 0.5],
    sun: { color: '#9ab0ff', int: 0.55, pos: [14, 26, 16] }, neon: 1.25, cloud: { color: '#2c3556', count: 6, op: 0.9 }, grass: '#1f4a35', disc: { x: '82%', y: '14%', color: '#f4f6ff', size: 54 }, stars: 1,
  },
  storm: {
    label: 'Thunderstorm', sky: ['#121020', '#221b33', '#392d4f'], ambient: ['#7c7499', 0.5], hemi: ['#655b85', '#1a1424', 0.45],
    sun: { color: '#887fad', int: 0.45, pos: [14, 26, 16] }, neon: 1.35, cloud: { color: '#27203b', count: 18, op: 1 }, grass: '#253d2d', disc: null, stars: 0, rain: true, storm: true,
  },
};
export const WEATHER_ORDER = ['sunrise', 'day', 'sunset', 'night', 'cloudy', 'rain', 'storm'];

// Weather that matches the viewer's local clock.
export function autoWeather(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 8) return 'sunrise';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'sunset';
  return 'night';
}

// Maps WMO weather interpretation codes to our 6 3D weather presets
export function mapWmoToPreset(code, isDay, cloudCover = 0, precip = 0) {
  if (precip > 0.1 || [51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    return 'rain';
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return 'rain';
  }
  if ([45, 48, 3].includes(code) || cloudCover > 70) {
    return 'cloudy';
  }
  if (!isDay) {
    return 'night';
  }
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 8) return 'sunrise';
  if (h >= 17 && h < 19.5) return 'sunset';
  return 'day';
}

// Fetches real live weather for user's location via Open-Meteo (free, no API key required)
export async function fetchLiveWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day,precipitation,cloud_cover`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const curr = data?.current;
    if (!curr) return null;
    const preset = mapWmoToPreset(curr.weather_code, curr.is_day, curr.cloud_cover, curr.precipitation);
    return {
      preset,
      wmo: curr.weather_code,
      isDay: curr.is_day,
      cloudCover: curr.cloud_cover,
      precip: curr.precipitation,
    };
  } catch (e) {
    return null;
  }
}

const STARS = Array.from({ length: 70 }).map((_, i) => ({ x: (i * 53.7) % 100, y: (i * 31.3) % 62, s: 1 + (i % 3) * 0.6, o: 0.4 + (i % 5) * 0.12 }));

// CSS sky behind the transparent canvas: gradient, sun / moon disc, stars, and atmospheric lightning.
export function SkyBackdrop({ weather }) {
  const w = WEATHER[weather] || WEATHER.day;
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!w.storm) {
      setFlash(false);
      return;
    }
    let timer;
    const trigger = () => {
      const wait = 4000 + Math.random() * 7000;
      timer = setTimeout(() => {
        setFlash(true);
        setTimeout(() => {
          setFlash(false);
          // 45% chance of secondary rumble flash
          if (Math.random() > 0.55) {
            setTimeout(() => {
              setFlash(true);
              setTimeout(() => setFlash(false), 80);
            }, 100);
          }
        }, 120);
        trigger();
      }, wait);
    };
    trigger();
    return () => clearTimeout(timer);
  }, [w.storm]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${w.sky[0]} 0%, ${w.sky[1]} 55%, ${w.sky[2]} 100%)`, transition: 'background 1.2s' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: w.stars, transition: 'opacity 1.2s' }}>
        {STARS.map((s, i) => <span key={i} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: '50%', background: '#fff', opacity: s.o }} />)}
      </div>
      {w.stars > 0.5 && (
        <div style={{
          position: 'absolute',
          top: '22%',
          left: '65%',
          width: 90,
          height: 1.5,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.85), transparent)',
          transform: 'rotate(-32deg)',
          pointerEvents: 'none',
          animation: 'shootingStarAnim 10s ease-in-out infinite',
        }} />
      )}
      {w.disc && (
        <div style={{ position: 'absolute', left: w.disc.x, top: w.disc.y, width: w.disc.size, height: w.disc.size, marginLeft: -w.disc.size / 2, marginTop: -w.disc.size / 2, borderRadius: '50%', background: w.disc.color, boxShadow: `0 0 ${w.disc.size}px ${w.disc.size / 3}px ${w.disc.color}66`, transition: 'all 1.2s' }} />
      )}
      {w.storm && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(224, 231, 255, 0.45)',
          opacity: flash ? 1 : 0,
          pointerEvents: 'none',
          transition: flash ? 'opacity 0.03s' : 'opacity 0.28s',
          zIndex: 2,
        }} />
      )}
    </div>
  );
}

const grassTexture = (() => {
  let t;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.02)'; g.fillRect(0, i * 32, 256, 32); }
    for (let k = 0; k < 1400; k++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 3); }
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(16, 16);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

// The house fills x -27..27, z -40..8, with the street and the cricket ground in front
// (z 8..40). Trees stay well outside that box - behind the house, beyond its side
// walls and past the cricket ground - so none ever grows through a room.
const TREES = [
  [-48, -50, 1.3], [-37, -52, 1.5], [-24, -49, 1.2], [-11, -53, 1.4], [3, -50, 1.1], [16, -52, 1.5], [29, -49, 1.2], [41, -52, 1.4], [51, -48, 1.2],
  [-41, -32, 1.3], [-47, -14, 1.2], [-41, 1, 1.5], [-48, 16, 1.1], [-42, 31, 1.3], [-48, 46, 1.2],
  [43, -34, 1.2], [49, -14, 1.4], [44, 3, 1.1], [50, 22, 1.3], [44, 39, 1.2], [49, 54, 1.4],
  [-30, 58, 1.2], [-12, 62, 1.4], [8, 59, 1.1], [27, 63, 1.3],
];

// Grass plot with a soil edge, a lane at the front and trees around — so the house
// sits in a garden instead of floating in a void.
export function Ground({ weather }) {
  const w = WEATHER[weather];
  const tex = useMemo(() => grassTexture(), []);
  const PW = 112; // plot width; it reaches past the street and the cricket ground in front of the house
  const PD = 124;
  const cz = 8;
  return (
    <group>
      <mesh position={[0, -3.6, cz]} receiveShadow>
        <boxGeometry args={[PW, 6, PD]} />
        <meshStandardMaterial color="#5e4630" roughness={1} />
      </mesh>
      <mesh position={[0, -0.59, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PW, PD]} />
        <meshStandardMaterial map={tex} color={w.grass} roughness={1} />
      </mesh>
      {TREES.map(([x, z, s], i) => <Tree key={i} p={[x, -0.6, z]} scale={s} />)}
    </group>
  );
}

const CLOUD_SPOTS = Array.from({ length: 16 }).map((_, i) => {
  const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.2;
  const r = 58 + (i % 4) * 11;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 20 + (i % 5) * 3, s: 1.4 + (i % 3) * 0.7, v: 0.25 + (i % 4) * 0.12 };
});

// A drifting cloud. Tap or click it and it bursts into puffs and droplets (so it never
// hides what is behind it); a while later a new one drifts back in from the edge.
const FLECKS = Array.from({ length: 9 }).map((_, i) => {
  const a = (i / 9) * Math.PI * 2;
  return { dx: Math.cos(a), dz: Math.sin(a), up: 2 + (i % 3), r: 0.45 + (i % 3) * 0.15 };
});
const BURST_MS = 650;

function Cloud({ spot, color }) {
  const ref = useRef();
  const mats = useRef([]);
  const flecks = useRef([]);
  const life = useRef({ gone: false, t0: 0, back: 0 });
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const L = life.current;
    const now = performance.now();
    if (L.gone) {
      const tb = Math.min(1, (now - L.t0) / BURST_MS);
      if (tb < 1) {
        // the puffs swell and fade, droplets fly outwards and fall
        g.scale.setScalar(spot.s * (1 + 0.55 * tb));
        mats.current.forEach(m => { if (m) m.opacity = 1 - tb; });
        flecks.current.forEach((m, i) => {
          if (!m) return;
          const f = FLECKS[i];
          m.visible = true;
          m.position.set(f.dx * tb * 7, f.up * tb * 3 - tb * tb * 6, f.dz * tb * 7);
          m.scale.setScalar(f.r * (1 - tb * 0.7));
        });
      } else {
        if (g.visible) { g.visible = false; flecks.current.forEach(m => { if (m) m.visible = false; }); L.back = now + 25000; }
        if (L.back && now > L.back) { L.gone = false; L.back = 0; g.position.x = -100 + Math.random() * 25; }
      }
      return;
    }
    if (!g.visible) { g.visible = true; mats.current.forEach(m => { if (m) m.opacity = 1; }); }
    g.scale.setScalar(spot.s);
    g.position.x += spot.v * Math.min(dt, 0.1);
    if (g.position.x > 100) g.position.x = -100;
  });
  const puffs = [[0, 0, 0, 3.2], [3, -0.4, 0.8, 2.5], [-3, -0.3, -0.6, 2.4]];
  const pop = (e) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const L = life.current;
    if (!L.gone) { L.gone = true; L.t0 = performance.now(); }
  };
  return (
    <group
      ref={ref}
      position={[spot.x, spot.y, spot.z]}
      scale={spot.s}
      onClick={pop}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {puffs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.6, 1]}>
          <sphereGeometry args={[r, 8, 6]} />
          <meshLambertMaterial ref={(m) => { mats.current[i] = m; }} color={color} transparent />
        </mesh>
      ))}
      {FLECKS.map((f, i) => (
        <mesh key={'f' + i} ref={(m) => { flecks.current[i] = m; }} visible={false}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

// Clouds drift past the edges of the plot (never over the house, so they cannot
// hide it) and show against the sky when the view is zoomed out.
export function Clouds({ weather }) {
  const w = WEATHER[weather];
  return (
    <group>
      {CLOUD_SPOTS.slice(0, Math.min(12, w.cloud.count)).map((s, i) => <Cloud key={i} spot={s} color={w.cloud.color} opacity={w.cloud.op} />)}
    </group>
  );
}

const DROPS = 520;

// Slanted rain streaks that follow whatever the camera is looking at.
export function Rain() {
  const view = useContext(ViewContext);
  const ref = useRef();
  const data = useMemo(() => Array.from({ length: DROPS }).map(() => ({ x: Math.random() * 56 - 28, y: Math.random() * 26, z: Math.random() * 56 - 28, v: 22 + Math.random() * 10 })), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => { if (ref.current) ref.current.frustumCulled = false; }, []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const v = view.current;
    const cx = v.flip ? v.pz : v.px;
    const cz = v.flip ? v.px : v.pz;
    const base = (v.floor || 0) * 5.8;
    for (let i = 0; i < DROPS; i++) {
      const d = data[i];
      d.y -= d.v * dt;
      if (d.y < 0) { d.y += 26; d.x = Math.random() * 56 - 28; d.z = Math.random() * 56 - 28; }
      o.position.set(cx + d.x + d.y * 0.18, base + d.y, cz + d.z);
      o.rotation.set(0, 0, 0.18);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, DROPS]}>
      <boxGeometry args={[0.025, 0.75, 0.025]} />
      <meshBasicMaterial color="#cfe2ff" transparent opacity={0.6} depthWrite={false} />
    </instancedMesh>
  );
}
