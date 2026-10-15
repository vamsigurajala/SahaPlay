import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import {
  Telescope,
  Orbit,
  Sparkles,
  RotateCcw,
  Play,
  Pause,
  Tag,
  Spline,
  ArrowLeft,
  MapPin,
  Crosshair,
  X,
  Sun as SunIcon,
  Moon as MoonIcon,
  Compass,
  Eye,
  Info,
} from 'lucide-react';
import { useWikiImage } from '../../data/wikiImages';

// Observatory behind the balcony telescope:
// 1. Photorealistic night sky: real Solar System Scope textures, Milky Way panorama,
//    full star catalogue (~9,000 stars from Yale BSC), all 88 constellations,
//    dynamic Sun & horizon with real sunrise/sunset times, optional GPS-based sky,
//    and tap-to-identify with targeting reticle and info HUD.
// 2. Solar system: real NASA / Solar System Scope planet textures, Saturn rings,
//    real orbits, zoomable and touch-friendly (drag & pinch).
// 3. Milky Way galaxy view with galactic core and "You are here" Sun marker.

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (() => {
  let s = 12345;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
})();
const gauss = () => {
  let u = 0;
  for (let i = 0; i < 4; i++) u += rand();
  return (u - 2) * 1.7;
};

// ── Equatorial & Coordinate Utilities ──────────────────────────────────────
const eqVecDeg = (raDeg, decDeg, r = 100) => {
  const a = raDeg * RAD;
  const d = decDeg * RAD;
  return new THREE.Vector3(
    Math.cos(d) * Math.cos(a) * r,
    Math.cos(d) * Math.sin(a) * r,
    Math.sin(d) * r,
  );
};

const eqVec = (raH, decD, r = 100) => eqVecDeg(raH * 15, decD, r);

// Galactic to Equatorial transformation matrix
const GAL = [
  [-0.0548755604, 0.4941094279, -0.867666149],
  [-0.8734370902, -0.44482963, -0.1980763734],
  [-0.4838350155, 0.7469822445, 0.4559837762],
];

const galMatrix = new THREE.Matrix4();
galMatrix.set(
  GAL[0][0], GAL[0][1], GAL[0][2], 0,
  GAL[1][0], GAL[1][1], GAL[1][2], 0,
  GAL[2][0], GAL[2][1], GAL[2][2], 0,
  0, 0, 0, 1,
);

const julian = (date) => date.getTime() / 86400000 + 2440587.5;

function lstDeg(date, lonE) {
  const jd = julian(date);
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return (((gmst + lonE) % 360) + 360) % 360;
}

// Matrix mapping equatorial vectors to local horizon frame: X = East, Y = Up, -Z = North
function skyMatrix(lst, lat) {
  const t = lst * RAD;
  const p = lat * RAD;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const m = new THREE.Matrix4();
  m.set(
    -s, c, 0, 0,
    cp * c, cp * s, sp, 0,
    sp * c, sp * s, -cp, 0,
    0, 0, 0, 1,
  );
  return m;
}

function altAz(raH, decD, lst, lat) {
  const H = (lst - raH * 15) * RAD;
  const d = decD * RAD;
  const p = lat * RAD;
  const sinAlt = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const az = Math.atan2(
    -Math.cos(d) * Math.sin(H),
    Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(H) * Math.sin(p),
  );
  return { alt: alt / RAD, az: ((az / RAD) + 360) % 360 };
}

// Calculate approximate sunrise and sunset for location
function getSunTimes(latDeg, decDeg) {
  const phi = latDeg * RAD;
  const delta = decDeg * RAD;
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  if (cosH0 > 1) return { polarNight: true, text: 'Polar Night' };
  if (cosH0 < -1) return { midnightSun: true, text: 'Midnight Sun' };
  const H0 = Math.acos(cosH0) / RAD;
  const hRise = 12 - H0 / 15;
  const hSet = 12 + H0 / 15;
  const fmt = (h) => {
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  return { rise: fmt(hRise), set: fmt(hSet), text: `Rise: ${fmt(hRise)} · Set: ${fmt(hSet)}` };
}

// ── B-V Color Mapping ───────────────────────────────────────────────────────
function bvToColor(bv) {
  if (bv === undefined || isNaN(bv)) return '#ffffff';
  if (bv < -0.1) return '#9bb0ff';
  if (bv < 0.15) return '#bbccff';
  if (bv < 0.45) return '#f8f9ff';
  if (bv < 0.75) return '#fff4d6';
  if (bv < 1.3) return '#ffd2a1';
  return '#ff8d6d';
}

// ── Planetary Orbital Elements (Paul Schlyter) ──────────────────────────────
const ELEM = {
  Mercury: { N: [48.3313, 3.24587e-5], i: [7.0047, 5e-8], w: [29.1241, 1.01444e-5], a: [0.387098, 0], e: [0.205635, 5.59e-10], M: [168.6562, 4.0923344368] },
  Venus: { N: [76.6799, 2.4659e-5], i: [3.3946, 2.75e-8], w: [54.891, 1.38374e-5], a: [0.72333, 0], e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
  Mars: { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: [1.523688, 0], e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766] },
  Jupiter: { N: [100.4542, 2.76854e-5], i: [1.303, -1.557e-7], w: [273.8777, 1.64505e-5], a: [5.20256, 0], e: [0.048498, 4.469e-9], M: [19.895, 0.0830853001] },
  Saturn: { N: [113.6634, 2.3898e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: [9.55475, 0], e: [0.055546, -9.499e-9], M: [316.967, 0.0334442282] },
  Uranus: { N: [74.0005, 1.3978e-5], i: [0.7733, 1.9e-8], w: [96.6612, 3.0565e-5], a: [19.18171, -1.55e-8], e: [0.047318, 7.45e-9], M: [142.5905, 0.011725806] },
  Neptune: { N: [131.7806, 3.0173e-5], i: [1.77, -2.55e-7], w: [272.8461, -6.027e-6], a: [30.05826, 3.313e-8], e: [0.008606, 2.15e-9], M: [260.2471, 0.005995147] },
};
const SUN_EL = { w: [282.9404, 4.70935e-5], e: [0.016709, -1.151e-9], M: [356.047, 0.9856002585] };
const dayNum = (date) => julian(date) - 2451543.5;

function solve(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

function helio(el, d) {
  const N = (el.N[0] + el.N[1] * d) * RAD;
  const inc = (el.i[0] + el.i[1] * d) * RAD;
  const w = (el.w[0] + el.w[1] * d) * RAD;
  const a = el.a[0] + el.a[1] * d;
  const e = el.e[0] + el.e[1] * d;
  const M = (((el.M[0] + el.M[1] * d) % 360) * RAD);
  const E = solve(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const u = v + w;
  return {
    x: r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(inc)),
    y: r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(inc)),
    z: r * Math.sin(u) * Math.sin(inc),
    r,
  };
}

function sunGeo(d) {
  const w = (SUN_EL.w[0] + SUN_EL.w[1] * d) * RAD;
  const e = SUN_EL.e[0] + SUN_EL.e[1] * d;
  const M = (((SUN_EL.M[0] + SUN_EL.M[1] * d) % 360) * RAD);
  const E = solve(M, e);
  const xv = Math.cos(E) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const lon = Math.atan2(yv, xv) + w;
  const r = Math.hypot(xv, yv);
  return { x: r * Math.cos(lon), y: r * Math.sin(lon), z: 0, lon };
}

const planetHelio = (name, d) => {
  if (name === 'Earth') {
    const g = sunGeo(d);
    return { x: -g.x, y: -g.y, z: 0, r: Math.hypot(g.x, g.y) };
  }
  return helio(ELEM[name], d);
};
const planetA = (name) => (name === 'Earth' ? 1 : ELEM[name].a[0]);

function eclToEq(x, y, z, d) {
  const eps = (23.4393 - 3.563e-7 * d) * RAD;
  const ye = y * Math.cos(eps) - z * Math.sin(eps);
  const ze = y * Math.sin(eps) + z * Math.cos(eps);
  return {
    ra: (((Math.atan2(ye, x) / RAD + 360) % 360) / 15),
    dec: Math.atan2(ze, Math.hypot(x, ye)) / RAD,
  };
}

const PLANET_LOOK = {
  Mercury: ['#c8c0b8', 0],
  Venus: ['#fff3d0', -3.5],
  Mars: ['#ff9a70', 0.6],
  Jupiter: ['#ffe8c8', -2.2],
  Saturn: ['#ffe0a0', 0.7],
  Uranus: ['#a4dce4', 5.5],
  Neptune: ['#3558d0', 7.8],
};

function skyBodies(date) {
  const d = dayNum(date);
  const sg = sunGeo(d);
  const out = [];
  Object.keys(PLANET_LOOK).forEach((name) => {
    const h = helio(ELEM[name], d);
    const e = eclToEq(h.x + sg.x, h.y + sg.y, h.z, d);
    out.push({ name, ra: e.ra, dec: e.dec, color: PLANET_LOOK[name][0], mag: PLANET_LOOK[name][1] });
  });
  const t = julian(date) - 2451545.0;
  const Mm = (134.963 + 13.064993 * t) * RAD;
  const F = (93.272 + 13.22935 * t) * RAD;
  const lonM = (218.316 + 13.176396 * t + 6.289 * Math.sin(Mm)) * RAD;
  const latM = 5.128 * Math.sin(F) * RAD;
  const moon = eclToEq(Math.cos(latM) * Math.cos(lonM), Math.cos(latM) * Math.sin(lonM), Math.sin(latM), d);
  const sunDir = eclToEq(sg.x, sg.y, 0, d);
  const elong = lonM - sg.lon;
  return {
    planets: out,
    moon,
    sunDir,
    phase: (1 - Math.cos(elong)) / 2,
    waxing: Math.sin(elong) > 0,
  };
}

// ── Real NASA / Solar System Scope Texture Manager ─────────────────────────
const TEX_CACHE = {};
function getSpaceTexture(name) {
  if (TEX_CACHE[name]) return TEX_CACHE[name];

  const mapFile = {
    Sun: 'sun.jpg',
    Mercury: 'mercury.jpg',
    Venus: 'venus.jpg',
    Earth: 'earth.jpg',
    Moon: 'moon.jpg',
    Mars: 'mars.jpg',
    Jupiter: 'jupiter.jpg',
    Saturn: 'saturn.jpg',
    SaturnRing: 'saturn_ring.png',
    Uranus: 'uranus.jpg',
    Neptune: 'neptune.jpg',
    MilkyWay: 'milkyway.jpg',
  }[name];

  const url = mapFile ? `/images/gamify/space/${mapFile}` : '';
  const loader = new THREE.TextureLoader();
  const tex = loader.load(
    url,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    },
    undefined,
    () => {
      // Fallback procedural canvas texture if file missing
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = name === 'Sun' ? '#ffd27a' : name === 'Earth' ? '#1c4f9a' : '#888';
      ctx.fillRect(0, 0, 128, 64);
      tex.image = canvas;
      tex.needsUpdate = true;
    },
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  TEX_CACHE[name] = tex;
  return tex;
}

const glowTex = (() => {
  let t;
  return () =>
    t ||
    (t = (() => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d');
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.25, 'rgba(255,255,255,0.5)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
      const ct = new THREE.CanvasTexture(c);
      ct.colorSpace = THREE.SRGBColorSpace;
      return ct;
    })());
})();

// ── Point Cloud Shaders ────────────────────────────────────────────────────
const POINT_VERT = `
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vC; varying float vA; uniform float uScale; uniform float uAtten;
void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  float k = uAtten > 0.5 ? (60.0 / max(1.0, -mv.z)) : 1.0; gl_PointSize = aSize * uScale * k; }`;
const POINT_FRAG = `
varying vec3 vC; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a; gl_FragColor = vec4(vC, a * vA); }`;

function Points({ data, uniforms, additive = true }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(data.size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(data.color, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(data.alpha, 1));
    return g;
  }, [data]);
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        vertexShader={POINT_VERT}
        fragmentShader={POINT_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}

const col = new THREE.Color();
function pack(items) {
  const n = items.length;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const color = new Float32Array(n * 3);
  const alpha = new Float32Array(n);
  items.forEach((it, i) => {
    pos.set(it.p, i * 3);
    size[i] = it.s;
    col.set(it.c).convertLinearToSRGB();
    color.set([col.r, col.g, col.b], i * 3);
    alpha[i] = it.a;
  });
  return { pos, size, color, alpha };
}

// ── Target Selection Reticle (3D Animated Ring) ────────────────────────────
function SelectionReticle({ position }) {
  const ringRef = useRef();
  useFrame((_, dt) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.8;
      const s = 1 + Math.sin(Date.now() * 0.005) * 0.12;
      ringRef.current.scale.set(s, s, s);
    }
  });
  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <ringGeometry args={[1.2, 1.45, 32]} />
        <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.3, 0.45, 16]} />
        <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Star & Constellation Lazy Loader ───────────────────────────────────────
let cachedCatalog = null;
let cachedConstellations = null;

function useSpaceCatalog() {
  const [stars, setStars] = useState(cachedCatalog);
  const [constellations, setConstellations] = useState(cachedConstellations);

  useEffect(() => {
    let active = true;
    if (!cachedCatalog) {
      fetch('/images/gamify/space/stars.json')
        .then((r) => r.json())
        .then((data) => {
          cachedCatalog = data;
          if (active) setStars(data);
        })
        .catch((e) => console.warn('Could not load stars.json', e));
    }
    if (!cachedConstellations) {
      fetch('/images/gamify/space/constellations.json')
        .then((r) => r.json())
        .then((data) => {
          cachedConstellations = data;
          if (active) setConstellations(data);
        })
        .catch((e) => console.warn('Could not load constellations.json', e));
    }
    return () => {
      active = false;
    };
  }, []);

  return { stars, constellations };
}

// ── Night Sky Scene ────────────────────────────────────────────────────────
function SkyScene({
  date,
  lat,
  lon,
  showLines,
  showLabels,
  ctl,
  bodies,
  identified,
  onIdentify,
}) {
  const { stars, constellations } = useSpaceCatalog();
  const { camera, gl, size } = useThree();
  const group = useRef();
  const uniforms = useMemo(() => ({ uScale: { value: 1 }, uAtten: { value: 0 } }), []);
  const lst = lstDeg(date, lon);
  const mat = useMemo(() => skyMatrix(lst, lat), [lst, lat]);
  const invMat = useMemo(() => mat.clone().invert(), [mat]);

  // Milky Way panorama texture
  const mwTex = useMemo(() => getSpaceTexture('MilkyWay'), []);
  const moonTex = useMemo(() => getSpaceTexture('Moon'), []);
  const sunTex = useMemo(() => getSpaceTexture('Sun'), []);
  const sunCorona = useMemo(() => glowTex(), []);

  // Sun horizontal coordinates
  const sunAltAz = useMemo(
    () => altAz(bodies.sunDir.ra, bodies.sunDir.dec, lst, lat),
    [bodies.sunDir, lst, lat],
  );
  const sunAlt = sunAltAz.alt;
  const sunPos = useMemo(() => eqVec(bodies.sunDir.ra, bodies.sunDir.dec, 94), [bodies.sunDir]);
  const moonPos = useMemo(() => eqVec(bodies.moon.ra, bodies.moon.dec, 90), [bodies.moon]);

  // Full star points buffer (9,412 stars when loaded, or fast procedural subset)
  const starData = useMemo(() => {
    if (!stars || stars.length === 0) {
      // Fallback bright seeds
      const faint = [];
      for (let i = 0; i < 2000; i++) {
        const u = rand() * 2 - 1;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        faint.push({
          p: [r * Math.cos(a) * 100, r * Math.sin(a) * 100, u * 100],
          s: 2.5,
          c: '#ffffff',
          a: 0.8,
        });
      }
      return pack(faint);
    }
    const items = stars.map((s) => {
      const v = eqVecDeg(s.ra, s.dec, 100);
      const isNamed = s.name && s.name.length > 0;
      const baseSize = clamp(7.5 - s.mag * 1.0, 1.4, 22.0);
      const sz = isNamed ? baseSize * 1.25 : baseSize;
      const alpha = clamp(1.05 - s.mag * 0.11, 0.45, 1.0);
      return {
        p: v.toArray(),
        s: sz,
        c: bvToColor(s.bv),
        a: alpha,
      };
    });
    return pack(items);
  }, [stars]);

  // Constellation Line Segments (all 88 constellations)
  const lineGeo = useMemo(() => {
    if (!constellations) return new THREE.BufferGeometry();
    const verts = [];
    constellations.forEach((c) => {
      if (!c.lines) return;
      c.lines.forEach((seg) => {
        for (let i = 0; i < seg.length - 1; i++) {
          const p1 = eqVecDeg(seg[i][0], seg[i][1], 99.4);
          const p2 = eqVecDeg(seg[i + 1][0], seg[i + 1][1], 99.4);
          verts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    return g;
  }, [constellations]);

  // Planet Points
  const planetData = useMemo(
    () =>
      pack(
        bodies.planets.map((p) => ({
          p: eqVec(p.ra, p.dec, 98).toArray(),
          s: clamp(14 + (1 - p.mag) * 3.5, 10, 32),
          c: p.color,
          a: 1,
        })),
      ),
    [bodies],
  );

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  // Touch & pointer interaction: 1-finger drag, 2-finger pinch, tap-to-identify
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map();
    let last = null;
    let pinch = null;
    let startPos = null;
    const st = ctl.current;

    const down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      st.fly = null;
      if (pts.size === 1) {
        last = { x: e.clientX, y: e.clientY };
        startPos = { x: e.clientX, y: e.clientY, time: Date.now() };
        st.vy = 0;
        st.vp = 0;
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), f: st.fov };
        last = null;
        startPos = null;
      }
    };

    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        st.fov = clamp(pinch.f * (pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))), 3, 90);
        return;
      }
      if (!last) return;
      const k = (st.fov * RAD) / el.clientHeight;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      st.yaw = (st.yaw - dx * k * 57.2958 + 360) % 360;
      st.pitch = clamp(st.pitch + dy * k * 57.2958, -8, 89);
      st.vy = -dx * k * 57.2958 * 30;
      st.vp = dy * k * 57.2958 * 30;
    };

    const up = (e) => {
      // Tap detection: minimal movement and short duration
      if (startPos && pts.size === 1) {
        const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
        const dur = Date.now() - startPos.time;
        if (dist < 7 && dur < 400) {
          handleTap(e.clientX, e.clientY);
        }
      }
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        last = null;
        startPos = null;
      }
    };

    const wheel = (e) => {
      e.preventDefault();
      st.fov = clamp(st.fov * Math.exp(e.deltaY * 0.0014), 3, 90);
    };

    const handleTap = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      // Project ray into world frame, then into equatorial frame
      const ray = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
      const eqRay = ray.clone().applyMatrix4(invMat).normalize();

      // Check Sun
      const sVec = eqVec(bodies.sunDir.ra, bodies.sunDir.dec, 1).normalize();
      if (eqRay.angleTo(sVec) < 0.08) {
        onIdentify({
          name: 'Sun',
          type: 'Star (Sol)',
          desig: 'G2V Main-sequence Star',
          mag: -26.74,
          ra: bodies.sunDir.ra,
          dec: bodies.sunDir.dec,
          alt: sunAltAz.alt,
          az: sunAltAz.az,
          position: sunPos,
        });
        return;
      }

      // Check Moon
      const mVec = eqVec(bodies.moon.ra, bodies.moon.dec, 1).normalize();
      if (eqRay.angleTo(mVec) < 0.08) {
        const mAltAz = altAz(bodies.moon.ra, bodies.moon.dec, lst, lat);
        onIdentify({
          name: 'Moon',
          type: 'Natural Satellite',
          desig: `${Math.round(bodies.phase * 100)}% illuminated, ${bodies.waxing ? 'waxing' : 'waning'}`,
          mag: -12.7,
          ra: bodies.moon.ra,
          dec: bodies.moon.dec,
          alt: mAltAz.alt,
          az: mAltAz.az,
          position: moonPos,
        });
        return;
      }

      // Check Planets
      for (const p of bodies.planets) {
        const pVec = eqVec(p.ra, p.dec, 1).normalize();
        if (eqRay.angleTo(pVec) < 0.08) {
          const pAltAz = altAz(p.ra, p.dec, lst, lat);
          onIdentify({
            name: p.name,
            type: 'Planet',
            desig: `Apparent Magnitude: ${p.mag}`,
            mag: p.mag,
            ra: p.ra,
            dec: p.dec,
            alt: pAltAz.alt,
            az: pAltAz.az,
            position: eqVec(p.ra, p.dec, 96),
          });
          return;
        }
      }

      // Check Catalog Stars
      if (stars && stars.length > 0) {
        let bestStar = null;
        let minScore = 0.08; // ~4.5 degrees threshold
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const sv = eqVecDeg(s.ra, s.dec, 1).normalize();
          const ang = eqRay.angleTo(sv);
          // Bias slightly towards brighter stars when tapping in dense fields
          const score = ang + Math.max(0, s.mag) * 0.005;
          if (score < minScore) {
            minScore = score;
            bestStar = s;
          }
        }
        if (bestStar) {
          const sAltAz = altAz(bestStar.ra / 15, bestStar.dec, lst, lat);
          onIdentify({
            name: bestStar.name || bestStar.desig || `HIP ${bestStar.id}`,
            type: 'Star',
            desig: bestStar.desig ? `${bestStar.desig}` : `HIP ${bestStar.id}`,
            con: bestStar.con || '',
            mag: bestStar.mag,
            ra: bestStar.ra / 15,
            dec: bestStar.dec,
            alt: sAltAz.alt,
            az: sAltAz.az,
            position: eqVecDeg(bestStar.ra, bestStar.dec, 96),
          });
          return;
        }
      }

      // Check Constellations Center
      if (constellations && constellations.length > 0) {
        let bestCon = null;
        let minAng = 0.28; // ~16 degrees
        for (const c of constellations) {
          const cv = eqVecDeg(c.center[0], c.center[1], 1).normalize();
          const ang = eqRay.angleTo(cv);
          if (ang < minAng) {
            minAng = ang;
            bestCon = c;
          }
        }
        if (bestCon) {
          const cAltAz = altAz(bestCon.center[0] / 15, bestCon.center[1], lst, lat);
          onIdentify({
            name: bestCon.name,
            type: 'Constellation',
            desig: bestCon.en ? `"${bestCon.en}"` : bestCon.id,
            con: bestCon.id,
            ra: bestCon.center[0] / 15,
            dec: bestCon.center[1],
            alt: cAltAz.alt,
            az: cAltAz.az,
            position: eqVecDeg(bestCon.center[0], bestCon.center[1], 96),
          });
          return;
        }
      }

      // Tap on empty space: deselect
      onIdentify(null);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, ctl, camera, invMat, bodies, stars, constellations, lst, lat, onIdentify, sunAltAz, sunPos, moonPos]);

  useFrame((_, dt) => {
    const st = ctl.current;
    if (st.fly) {
      const f = st.fly;
      const k = 1 - Math.exp(-dt * 4.5);
      const dy = ((f.yaw - st.yaw + 540) % 360) - 180;
      st.yaw = (st.yaw + dy * k + 360) % 360;
      st.pitch += (f.pitch - st.pitch) * k;
      st.fov += (f.fov - st.fov) * k;
      if (Math.abs(dy) < 0.05 && Math.abs(f.pitch - st.pitch) < 0.05) st.fly = null;
    } else if (Math.abs(st.vy) > 0.05 || Math.abs(st.vp) > 0.05) {
      st.yaw = (st.yaw + st.vy * dt + 360) % 360;
      st.pitch = clamp(st.pitch + st.vp * dt, -8, 89);
      const f = Math.exp(-dt * 4);
      st.vy *= f;
      st.vp *= f;
    }
    camera.rotation.set(st.pitch * RAD, -st.yaw * RAD, 0);
    if (camera.fov !== st.fov) {
      camera.fov = st.fov;
      camera.updateProjectionMatrix();
    }
    uniforms.uScale.value =
      Math.min(2, gl.getPixelRatio()) * Math.pow(60 / st.fov, 0.55) * (size.height / 800);
    if (group.current) {
      group.current.matrix.copy(mat);
      group.current.matrixWorldNeedsUpdate = true;
    }
  });

  // Calculate sky atmosphere color based on Sun altitude
  const skyColor = useMemo(() => {
    if (sunAlt > 12) return '#0d2b56';
    if (sunAlt > 0) return '#151d3b';
    if (sunAlt > -6) return '#0c1024';
    if (sunAlt > -12) return '#050714';
    return '#02030a';
  }, [sunAlt]);

  // Horizon glow color and intensity
  const horizonGlow = useMemo(() => {
    if (sunAlt > 5) return { color: '#3b82f6', opacity: 0.28 };
    if (sunAlt > -6) return { color: '#f97316', opacity: 0.45 }; // golden hour / sunset
    if (sunAlt > -14) return { color: '#6366f1', opacity: 0.2 };
    return { color: '#1e3a8a', opacity: 0.12 };
  }, [sunAlt]);

  return (
    <>
      <color attach="background" args={[skyColor]} />
      <ambientLight intensity={sunAlt > 0 ? 0.35 : 0.06} />
      {sunAlt > -4 && (
        <directionalLight position={sunPos.clone().multiplyScalar(0.5)} intensity={sunAlt > 10 ? 2.8 : 1.2} color="#fff6e6" />
      )}

      {/* Celestial Sphere rotated by local sky matrix */}
      <group ref={group} matrixAutoUpdate={false}>
        {/* Real Milky Way Panorama Sphere oriented in Galactic coordinates */}
        <group matrix={galMatrix} matrixAutoUpdate={false}>
          <mesh>
            <sphereGeometry args={[99.2, 48, 32]} />
            <meshBasicMaterial
              map={mwTex}
              side={THREE.BackSide}
              transparent
              opacity={sunAlt > 0 ? 0.15 : 0.65}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>

        {/* 9,412 Catalog Stars Buffer */}
        <Points data={starData} uniforms={uniforms} />

        {/* Real Planets */}
        <Points data={planetData} uniforms={uniforms} />

        {/* All 88 Constellation Lines */}
        {showLines && (
          <lineSegments geometry={lineGeo}>
            <lineBasicMaterial color="#60a5fa" transparent opacity={0.35} depthWrite={false} />
          </lineSegments>
        )}

        {/* Real Moon Disc with Phase */}
        <mesh position={moonPos}>
          <sphereGeometry args={[0.9, 32, 24]} />
          <meshStandardMaterial map={moonTex} roughness={1} />
        </mesh>

        {/* Real Sun Disc with Dynamic Corona Glow */}
        <mesh position={sunPos}>
          <sphereGeometry args={[1.8, 32, 24]} />
          <meshBasicMaterial map={sunTex} color="#fff8e7" />
        </mesh>
        <sprite position={sunPos} scale={[18, 18, 1]}>
          <spriteMaterial
            map={sunCorona}
            color={sunAlt > 5 ? '#ffd27a' : '#f97316'}
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite position={sunPos} scale={[38, 38, 1]}>
          <spriteMaterial
            map={sunCorona}
            color={sunAlt > 5 ? '#ffae42' : '#ea580c'}
            transparent
            opacity={0.25}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>

        {/* 3D Targeting Reticle for Identified Object */}
        {identified && identified.position && (
          <SelectionReticle position={identified.position} />
        )}

        {/* Labels */}
        {showLabels && (
          <>
            {stars &&
              stars
                .filter((s) => s.name && s.mag <= 2.2)
                .map((s) => (
                  <Html
                    key={s.id}
                    position={eqVecDeg(s.ra, s.dec, 100)}
                    center
                    zIndexRange={[20, 0]}
                    pointerEvents="none"
                  >
                    <div
                      style={{
                        transform: 'translate(0, 14px)',
                        color: '#cfe0ff',
                        fontSize: 11,
                        fontWeight: 600,
                        textShadow: '0 0 4px #000',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.name}
                    </div>
                  </Html>
                ))}

            {constellations &&
              constellations
                .filter((c) => c.rank <= 2)
                .map((c) => (
                  <Html
                    key={c.id}
                    position={eqVecDeg(c.center[0], c.center[1], 99)}
                    center
                    zIndexRange={[20, 0]}
                    pointerEvents="none"
                  >
                    <div
                      style={{
                        color: '#93c5fd',
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        textShadow: '0 0 6px #000',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </div>
                  </Html>
                ))}

            {bodies.planets.map((p) => (
              <Html
                key={p.name}
                position={eqVec(p.ra, p.dec, 98)}
                center
                zIndexRange={[20, 0]}
                pointerEvents="none"
              >
                <div
                  style={{
                    transform: 'translate(0, 20px)',
                    color: '#fef08a',
                    fontSize: 12,
                    fontWeight: 800,
                    textShadow: '0 0 6px #000',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </div>
              </Html>
            ))}

            <Html position={moonPos} center zIndexRange={[20, 0]} pointerEvents="none">
              <div
                style={{
                  transform: 'translate(0, 24px)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  textShadow: '0 0 6px #000',
                }}
              >
                Moon
              </div>
            </Html>
            <Html position={sunPos} center zIndexRange={[20, 0]} pointerEvents="none">
              <div
                style={{
                  transform: 'translate(0, 28px)',
                  color: '#fde047',
                  fontSize: 12,
                  fontWeight: 800,
                  textShadow: '0 0 6px #000',
                }}
              >
                Sun
              </div>
            </Html>
          </>
        )}
      </group>

      {/* Ground horizon hemisphere */}
      <mesh>
        <sphereGeometry args={[94, 32, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshBasicMaterial color="#03050a" side={THREE.BackSide} />
      </mesh>

      {/* Atmospheric Horizon Ring with Dynamic Rise/Set Glow */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[93, 93, 8, 48, 1, true]} />
        <meshBasicMaterial
          color={horizonGlow.color}
          transparent
          opacity={horizonGlow.opacity}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Cardinal & Intercardinal Compass Markers */}
      {[
        ['N', 0, -90],
        ['NE', 63, -63],
        ['E', 90, 0],
        ['SE', 63, 63],
        ['S', 0, 90],
        ['SW', -63, 63],
        ['W', -90, 0],
        ['NW', -63, -63],
      ].map(([n, x, z]) => (
        <Html key={n} position={[x, 2, z]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div
            style={{
              color: n.length === 1 ? '#93c5fd' : 'rgba(147,197,253,0.6)',
              fontSize: n.length === 1 ? 15 : 11,
              fontWeight: 800,
              textShadow: '0 0 6px #000',
            }}
          >
            {n}
          </div>
        </Html>
      ))}
    </>
  );
}

// ── Solar System Scene ─────────────────────────────────────────────────────
const PLANETS = [
  { name: 'Mercury', wiki: 'Mercury_(planet)', radius: 0.28, dia: '4,879 km', dist: '0.39 AU', day: '59 Earth days', year: '88 days', moons: '0', fact: 'The smallest planet and closest to the Sun, with temperatures from -180 to 430 C.' },
  { name: 'Venus', wiki: 'Venus', radius: 0.5, dia: '12,104 km', dist: '0.72 AU', day: '243 Earth days (backwards)', year: '225 days', moons: '0', fact: 'The hottest planet, wrapped in dense sulphuric acid clouds, rotating in retrograde.' },
  { name: 'Earth', wiki: 'Earth', radius: 0.54, dia: '12,742 km', dist: '1 AU', day: '24 hours', year: '365.25 days', moons: '1', fact: 'Our home world, the only known place in the universe with abundant liquid water and life.' },
  { name: 'Mars', wiki: 'Mars', radius: 0.38, dia: '6,779 km', dist: '1.52 AU', day: '24.6 hours', year: '687 days', moons: '2', fact: 'A cold red desert home to the largest volcano in the solar system, Olympus Mons.' },
  { name: 'Jupiter', wiki: 'Jupiter', radius: 1.6, dia: '139,820 km', dist: '5.2 AU', day: '9.9 hours', year: '11.9 years', moons: '95', fact: 'The largest planet; its swirling Great Red Spot storm is wider than the entire Earth.' },
  { name: 'Saturn', wiki: 'Saturn', radius: 1.3, dia: '116,460 km', dist: '9.58 AU', day: '10.7 hours', year: '29.4 years', moons: '146', fact: 'Iconic for its sweeping rings of ice and rock, with a density so low it could float in water.' },
  { name: 'Uranus', wiki: 'Uranus', radius: 0.85, dia: '50,724 km', dist: '19.2 AU', day: '17.2 hours', year: '84 years', moons: '28', fact: 'An ice giant rolling on its side with an axial tilt of 98 degrees.' },
  { name: 'Neptune', wiki: 'Neptune', radius: 0.82, dia: '49,244 km', dist: '30.1 AU', day: '16.1 hours', year: '165 years', moons: '16', fact: 'The windiest planet, lashed by supersonic storms at over 2,000 km/h.' },
];

const SUN_INFO = {
  name: 'Sun',
  wiki: 'Sun',
  dia: '1,392,700 km',
  dist: 'Centre of the system',
  day: '25 days at the equator',
  year: '230 million years around Milky Way',
  moons: '8 planets',
  fact: 'A yellow dwarf star comprising 99.86% of the mass in our solar system.',
};

const orbitR = (a) => 7 * Math.pow(a, 0.55);

function SolarScene({ onSelect, focus, playing, simRef }) {
  const { camera } = useThree();
  const controls = useRef();
  const refs = useRef({});
  const moonRef = useRef();

  // Background stars
  const stars = useMemo(() => {
    const items = [];
    for (let i = 0; i < 3500; i++) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      items.push({
        p: [r * Math.cos(a) * 420, u * 420, r * Math.sin(a) * 420],
        s: 1.4 + rand() * 2.6,
        c: rand() < 0.2 ? '#ffd8b0' : '#ffffff',
        a: 0.4 + rand() * 0.6,
      });
    }
    return pack(items);
  }, []);

  // Asteroid belt
  const belt = useMemo(() => {
    const items = [];
    for (let i = 0; i < 2600; i++) {
      const a = rand() * Math.PI * 2;
      const r = orbitR(2.1) + rand() * (orbitR(3.3) - orbitR(2.1));
      items.push({
        p: [Math.cos(a) * r, gauss() * 0.25, Math.sin(a) * r],
        s: 0.7 + rand() * 1.2,
        c: '#b8aa98',
        a: 0.8,
      });
    }
    return pack(items);
  }, []);

  const uniforms = useMemo(() => ({ uScale: { value: 1 }, uAtten: { value: 0 } }), []);
  const beltU = useMemo(() => ({ uScale: { value: 1 }, uAtten: { value: 1 } }), []);
  const sunGlow = useMemo(() => glowTex(), []);

  // Textures from Solar System Scope
  const sunTex = useMemo(() => getSpaceTexture('Sun'), []);
  const saturnRingTex = useMemo(() => getSpaceTexture('SaturnRing'), []);
  const mwTex = useMemo(() => getSpaceTexture('MilkyWay'), []);

  const orbitLines = useMemo(
    () =>
      PLANETS.map((p) => {
        const r = orbitR(planetA(p.name));
        const pts = [];
        for (let i = 0; i <= 128; i++) {
          const a = (i / 128) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [],
  );

  const fly = useRef({ target: new THREE.Vector3(), pos: new THREE.Vector3(), active: false });

  useEffect(() => {
    camera.position.set(0, 36, 62);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame((_, dt) => {
    const sim = simRef.current;
    if (playing) sim.d += dt * 25;
    PLANETS.forEach((p) => {
      const h = planetHelio(p.name, sim.d);
      const r = orbitR(h.r);
      const ang = Math.atan2(h.y, h.x);
      const g = refs.current[p.name];
      if (g) {
        g.position.set(Math.cos(ang) * r, 0, -Math.sin(ang) * r);
        g.children[0].rotation.y += dt * 0.4;
      }
    });
    const eg = refs.current.Earth;
    if (eg && moonRef.current) {
      const a = (sim.d / 27.3) * Math.PI * 2;
      moonRef.current.position.set(Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3);
    }
    uniforms.uScale.value = 1.2;
    beltU.uScale.value = 1.2;
    const c = controls.current;
    if (focus && c) {
      const g = focus === 'Sun' ? null : refs.current[focus];
      const tgt = g ? g.position : new THREE.Vector3(0, 0, 0);
      const rad = focus === 'Sun' ? 2.6 : PLANETS.find((p) => p.name === focus).radius;
      if (!fly.current.active || fly.current.name !== focus) {
        fly.current = { active: true, name: focus };
      }
      c.target.lerp(tgt, 1 - Math.exp(-dt * 4));
      const want = tgt.clone().add(new THREE.Vector3(rad * 3.4, rad * 1.6, rad * 4.4));
      if (fly.current.active) {
        camera.position.lerp(want, 1 - Math.exp(-dt * 2.4));
        if (camera.position.distanceTo(want) < 0.3) fly.current.active = false;
      }
    } else if (c && fly.current.name) {
      fly.current = { active: false, name: null };
    }
  });

  return (
    <>
      <color attach="background" args={['#000005']} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 0]} intensity={7.5} decay={0} color="#fff1d8" />

      {/* Milky Way deep background */}
      <mesh>
        <sphereGeometry args={[450, 32, 24]} />
        <meshBasicMaterial map={mwTex} side={THREE.BackSide} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <Points data={stars} uniforms={uniforms} />
      <Points data={belt} uniforms={beltU} />

      {/* Sun */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect('Sun');
        }}
      >
        <sphereGeometry args={[2.6, 48, 32]} />
        <meshBasicMaterial map={sunTex} color="#ffd27a" />
      </mesh>
      <sprite scale={[16, 16, 1]}>
        <spriteMaterial map={sunGlow} color="#ffb04a" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={[34, 34, 1]}>
        <spriteMaterial map={sunGlow} color="#ff8a30" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {/* Orbits */}
      {orbitLines.map((g, i) => (
        <lineLoop key={i} geometry={g}>
          <lineBasicMaterial color="#4a5a88" transparent opacity={0.45} />
        </lineLoop>
      ))}

      {/* Planets */}
      {PLANETS.map((p) => (
        <group
          key={p.name}
          ref={(el) => {
            refs.current[p.name] = el;
          }}
        >
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.name);
            }}
            onPointerOver={() => {
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = '';
            }}
          >
            <sphereGeometry args={[p.radius, 40, 28]} />
            <meshStandardMaterial map={getSpaceTexture(p.name)} roughness={0.85} />
          </mesh>

          {/* Saturn's Rings */}
          {p.name === 'Saturn' && (
            <mesh rotation={[Math.PI / 2 - 0.45, 0, 0.2]}>
              <ringGeometry args={[p.radius * 1.35, p.radius * 2.45, 96]} />
              <meshBasicMaterial map={saturnRingTex} transparent side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}

          {/* Earth's Moon */}
          {p.name === 'Earth' && (
            <mesh ref={moonRef}>
              <sphereGeometry args={[0.15, 20, 16]} />
              <meshStandardMaterial map={getSpaceTexture('Moon')} roughness={1} />
            </mesh>
          )}

          <Html position={[0, p.radius + 0.7, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
            <div style={{ color: '#dfe8ff', fontSize: 11, fontWeight: 700, textShadow: '0 0 4px #000', whiteSpace: 'nowrap' }}>
              {p.name}
            </div>
          </Html>
        </group>
      ))}

      <Html position={[0, 3.6, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div style={{ color: '#ffe3a0', fontSize: 12, fontWeight: 800, textShadow: '0 0 4px #000' }}>
          Sun
        </div>
      </Html>

      <OrbitControls ref={controls} enableDamping dampingFactor={0.08} minDistance={1.5} maxDistance={280} zoomSpeed={1.2} />
    </>
  );
}

// ── Milky Way Galaxy Scene ─────────────────────────────────────────────────
function GalaxyScene() {
  const data = useMemo(() => {
    const items = [];
    const R = 50;
    for (let i = 0; i < 70000; i++) {
      const bulge = rand() < 0.22;
      if (bulge) {
        const r = Math.abs(gauss()) * 4.2;
        const th = rand() * Math.PI * 2;
        const ph = Math.acos(rand() * 2 - 1);
        items.push({
          p: [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.55, r * Math.sin(ph) * Math.sin(th)],
          s: 2.4 + rand() * 3,
          c: rand() < 0.6 ? '#ffe2b0' : '#ffcf90',
          a: 0.55,
        });
        continue;
      }
      const r = Math.pow(rand(), 0.62) * R;
      const arm = Math.floor(rand() * 4);
      const th = arm * (Math.PI / 2) + Math.log(1 + r / 3) * 3.3 + gauss() * (0.1 + 0.28 * (r / R));
      const y = gauss() * (0.5 * (1 - r / R) + 0.12);
      const hot = rand() < 0.07;
      items.push({
        p: [Math.cos(th) * r, y, Math.sin(th) * r],
        s: hot ? 4.4 : 2 + rand() * 2.4,
        c: hot ? '#ff9ac8' : rand() < 0.6 ? '#bcd0ff' : '#e8eeff',
        a: hot ? 0.8 : 0.4,
      });
    }
    return pack(items);
  }, []);

  const uniforms = useMemo(() => ({ uScale: { value: 1.2 }, uAtten: { value: 1 } }), []);
  const glow = useMemo(() => glowTex(), []);
  const sunAng = 1.1;
  const sunR = 26;

  return (
    <>
      <color attach="background" args={['#01010a']} />
      <Points data={data} uniforms={uniforms} />
      <sprite scale={[34, 34, 1]}>
        <spriteMaterial map={glow} color="#ffd9a0" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={[120, 120, 1]}>
        <spriteMaterial map={glow} color="#7f9bff" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <Html position={[0, 3, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div style={{ color: '#ffe3b0', fontSize: 12, fontWeight: 800, textShadow: '0 0 6px #000', whiteSpace: 'nowrap' }}>
          Galactic centre (Sagittarius A*)
        </div>
      </Html>

      <group position={[Math.cos(sunAng) * sunR, 0.2, Math.sin(sunAng) * sunR]}>
        <mesh>
          <sphereGeometry args={[0.35, 16, 12]} />
          <meshBasicMaterial color="#fff2b0" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.05, 40]} />
          <meshBasicMaterial color="#6fe0ff" side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
        <Html position={[0, 1.6, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div style={{ color: '#9aeaff', fontSize: 13, fontWeight: 800, textShadow: '0 0 6px #000', whiteSpace: 'nowrap' }}>
            You are here: the Sun
          </div>
        </Html>
      </group>

      <OrbitControls enableDamping dampingFactor={0.06} autoRotate autoRotateSpeed={0.35} minDistance={4} maxDistance={220} />
    </>
  );
}

// ── UI Cards & Controls ────────────────────────────────────────────────────
const bar = {
  background: 'rgba(8,10,22,0.82)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 99,
  color: '#fff',
  backdropFilter: 'blur(8px)',
};

const chipBtn = (on) => ({
  ...bar,
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: on ? 'rgba(99,102,241,0.85)' : bar.background,
  border: on ? '1px solid rgba(165,180,252,0.6)' : bar.border,
});

function PlanetCard({ name, onBack }) {
  const info = name === 'Sun' ? SUN_INFO : PLANETS.find((p) => p.name === name);
  const photo = useWikiImage(info.wiki);
  const localImage = `/images/gamify/space/${name.toLowerCase()}.jpg`;

  return (
    <div
      className="stay-white"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        maxWidth: 440,
        zIndex: 8,
        ...bar,
        borderRadius: 16,
        padding: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <img
        src={localImage}
        onError={(e) => {
          if (photo) e.target.src = photo;
        }}
        alt={info.name}
        referrerPolicy="no-referrer"
        style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover', flex: 'none', background: '#000' }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{info.name}</div>
        <div style={{ fontSize: 12, opacity: 0.85, margin: '2px 0 6px' }}>{info.fact}</div>
        <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>
          Diameter {info.dia} · Distance from the Sun {info.dist}
          <br />
          Day {info.day} · Year {info.year} · Moons {info.moons}
        </div>
        <button
          onClick={onBack}
          className="stay-white"
          style={{ ...chipBtn(false), marginTop: 8, padding: '5px 12px' }}
        >
          <ArrowLeft size={13} />
          Back to the whole system
        </button>
      </div>
    </div>
  );
}

// Tap-To-Identify HUD Card
function IdentifyCard({ item, onCenter, onClose }) {
  if (!item) return null;
  const isAltAbove = item.alt > 0;

  return (
    <div
      className="stay-white"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        maxWidth: 460,
        zIndex: 8,
        ...bar,
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={16} color="#38bdf8" />
          <div style={{ fontSize: 16, fontWeight: 800 }}>{item.name}</div>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'rgba(56,189,248,0.2)',
              color: '#7dd3fc',
              fontWeight: 700,
            }}
          >
            {item.type}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {item.desig} {item.con ? `· in ${item.con}` : ''}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 11,
        }}
      >
        <div>
          <div style={{ opacity: 0.6 }}>Altitude</div>
          <div style={{ fontWeight: 700, color: isAltAbove ? '#86efac' : '#f87171' }}>
            {item.alt ? `${Math.round(item.alt * 10) / 10}°` : 'N/A'}
          </div>
        </div>
        <div>
          <div style={{ opacity: 0.6 }}>Azimuth</div>
          <div style={{ fontWeight: 700 }}>
            {item.az ? `${Math.round(item.az)}°` : 'N/A'}
          </div>
        </div>
        <div>
          <div style={{ opacity: 0.6 }}>Magnitude</div>
          <div style={{ fontWeight: 700, color: '#fde047' }}>
            {item.mag !== undefined ? `${item.mag}` : 'N/A'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
        <button
          onClick={onCenter}
          className="stay-white"
          style={{ ...chipBtn(true), padding: '5px 12px', fontSize: 11 }}
        >
          <Crosshair size={13} />
          Center in view
        </button>
      </div>
    </div>
  );
}

// ── Main SpaceViewer Component ─────────────────────────────────────────────
export default function SpaceViewer() {
  const [mode, setMode] = useState('sky');
  const [lines, setLines] = useState(true);
  const [labels, setLabels] = useState(true);
  const [hours, setHours] = useState(0);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [identified, setIdentified] = useState(null);

  // Geolocation state: try to restore saved location or fallback to timezone
  const defaultLon = useMemo(() => clamp(-new Date().getTimezoneOffset() / 4, -180, 180), []);
  const [lon, setLon] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sp_gamify_space_geo'));
      if (saved && typeof saved.lon === 'number') return saved.lon;
    } catch (e) {}
    return defaultLon;
  });
  const [lat, setLat] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sp_gamify_space_geo'));
      if (saved && typeof saved.lat === 'number') return saved.lat;
    } catch (e) {}
    return 20;
  });
  const [isGps, setIsGps] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  const ctl = useRef({ yaw: 180, pitch: 38, fov: 75, vy: 0, vp: 0, fly: null });
  const simRef = useRef({ d: dayNum(new Date()) });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const date = useMemo(() => new Date(now + hours * 3600000), [now, hours]);
  const bodies = useMemo(() => skyBodies(date), [date]);
  const lst = lstDeg(date, lon);

  // Sun Rise & Set
  const sunTimes = useMemo(() => getSunTimes(lat, bodies.sunDir.dec), [lat, bodies.sunDir.dec]);
  const sunAlt = useMemo(() => altAz(bodies.sunDir.ra, bodies.sunDir.dec, lst, lat).alt, [bodies.sunDir, lst, lat]);

  // Geolocation trigger
  const handleUseGps = useCallback(() => {
    if (!navigator.geolocation) {
      setNote('Geolocation not supported on this browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nLat = Math.round(pos.coords.latitude * 100) / 100;
        const nLon = Math.round(pos.coords.longitude * 100) / 100;
        setLat(nLat);
        setLon(nLon);
        setIsGps(true);
        setGpsLoading(false);
        try {
          localStorage.setItem('sp_gamify_space_geo', JSON.stringify({ lat: nLat, lon: nLon }));
        } catch (e) {}
        setNote(`Location set to GPS: ${nLat > 0 ? nLat + '°N' : -nLat + '°S'}, ${nLon > 0 ? nLon + '°E' : -nLon + '°W'}`);
      },
      (err) => {
        setGpsLoading(false);
        setNote('Could not acquire GPS position. Keeping manual coordinates.');
      },
      { timeout: 8000 },
    );
  }, []);

  // Quick jump targets
  const targets = useMemo(() => {
    const list = [
      { name: 'Sun', ra: bodies.sunDir.ra, dec: bodies.sunDir.dec, fov: 15 },
      { name: 'Moon', ra: bodies.moon.ra, dec: bodies.moon.dec, fov: 10 },
    ];
    bodies.planets.forEach((p) => list.push({ name: p.name, ra: p.ra, dec: p.dec, fov: 12 }));
    [
      ['Orion', 5.6, 0.0, 38],
      ['Big Dipper', 11.9, 55.0, 38],
      ['Scorpius', 16.8, -30.0, 36],
      ['Southern Cross', 12.5, -60.0, 28],
      ['Cassiopeia', 1.0, 60.0, 32],
      ['Polaris', 2.5, 89.2, 35],
    ].forEach(([n, r, d, f]) => list.push({ name: n, ra: r, dec: d, fov: f }));
    list.push({ name: 'Milky Way Core', ra: 17.76, dec: -28.9, fov: 55 });
    return list;
  }, [bodies]);

  const [note, setNote] = useState('');

  const goTo = (t) => {
    const a = altAz(t.ra, t.dec, lst, lat);
    if (a.alt < -4) {
      setNote(`${t.name} is currently below the horizon. Adjust the time slider.`);
      return;
    }
    setNote('');
    ctl.current.fly = { yaw: a.az, pitch: clamp(a.alt, -5, 85), fov: t.fov };
  };

  const handleCenterIdentified = () => {
    if (!identified) return;
    const a = altAz(identified.ra, identified.dec, lst, lat);
    ctl.current.fly = { yaw: a.az, pitch: clamp(a.alt, -5, 85), fov: Math.min(ctl.current.fov, 32) };
  };

  const phasePct = Math.round(bodies.phase * 100);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1, touchAction: 'none' }}>
      <Canvas
        key={mode}
        dpr={[1, 1.75]}
        camera={
          mode === 'sky'
            ? { fov: 75, near: 0.1, far: 1000, position: [0, 0, 0] }
            : mode === 'solar'
            ? { fov: 50, near: 0.05, far: 2000, position: [0, 36, 62] }
            : { fov: 50, near: 0.1, far: 2000, position: [0, 55, 85] }
        }
        gl={{ antialias: true }}
      >
        {mode === 'sky' && (
          <SkyScene
            date={date}
            lat={lat}
            lon={lon}
            showLines={lines}
            showLabels={labels}
            ctl={ctl}
            bodies={bodies}
            identified={identified}
            onIdentify={setIdentified}
          />
        )}
        {mode === 'solar' && (
          <SolarScene onSelect={setSelected} focus={selected} playing={playing} simRef={simRef} />
        )}
        {mode === 'galaxy' && <GalaxyScene />}
      </Canvas>

      {/* Top Mode Selection */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 64,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          zIndex: 6,
        }}
      >
        <button
          className="stay-white"
          style={chipBtn(mode === 'sky')}
          onClick={() => {
            setMode('sky');
            setSelected(null);
          }}
        >
          <Telescope size={14} />
          Night sky
        </button>
        <button
          className="stay-white"
          style={chipBtn(mode === 'solar')}
          onClick={() => {
            setMode('solar');
            setSelected(null);
            setIdentified(null);
          }}
        >
          <Orbit size={14} />
          Solar system
        </button>
        <button
          className="stay-white"
          style={chipBtn(mode === 'galaxy')}
          onClick={() => {
            setMode('galaxy');
            setSelected(null);
            setIdentified(null);
          }}
        >
          <Sparkles size={14} />
          Milky Way
        </button>
      </div>

      {/* Night Sky View Controls */}
      {mode === 'sky' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              zIndex: 6,
              maxWidth: 'calc(100% - 24px)',
            }}
          >
            <button
              className="stay-white"
              style={chipBtn(lines)}
              onClick={() => setLines((v) => !v)}
            >
              <Spline size={14} />
              Constellations
            </button>
            <button
              className="stay-white"
              style={chipBtn(labels)}
              onClick={() => setLabels((v) => !v)}
            >
              <Tag size={14} />
              Names
            </button>
            <button
              className="stay-white"
              style={chipBtn(isGps)}
              onClick={handleUseGps}
              title="Use GPS Geolocation"
            >
              <MapPin size={14} />
              {gpsLoading ? 'Locating...' : isGps ? 'GPS Sky Active' : 'Use GPS'}
            </button>
            <button
              className="stay-white"
              style={chipBtn(false)}
              onClick={() => {
                ctl.current.fly = { yaw: 180, pitch: 38, fov: 75 };
                setHours(0);
                setIdentified(null);
              }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          {/* Identified Object Card */}
          {identified ? (
            <IdentifyCard
              item={identified}
              onCenter={handleCenterIdentified}
              onClose={() => setIdentified(null)}
            />
          ) : (
            <div
              className="stay-white"
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                zIndex: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                alignItems: 'center',
              }}
            >
              {note && <div style={{ ...bar, padding: '6px 14px', fontSize: 12 }}>{note}</div>}

              {/* Quick Jump Targets */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  justifyContent: 'center',
                  maxWidth: 780,
                }}
              >
                {targets.map((t) => (
                  <button
                    key={t.name}
                    className="stay-white"
                    style={{ ...chipBtn(false), padding: '5px 11px', fontSize: 11 }}
                    onClick={() => goTo(t)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* Interactive Sky & Time Panel */}
              <div
                style={{
                  ...bar,
                  borderRadius: 14,
                  padding: '8px 14px',
                  width: '100%',
                  maxWidth: 580,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 700,
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sunAlt > 0 ? <SunIcon size={14} color="#fde047" /> : <MoonIcon size={14} color="#93c5fd" />}
                    {date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    {hours === 0 ? ' (now)' : ''}
                  </span>
                  <span style={{ opacity: 0.85, fontSize: 11 }}>
                    {sunTimes.text} · Sun {Math.round(sunAlt)}°
                  </span>
                  <span style={{ opacity: 0.85, fontSize: 11 }}>
                    Moon {phasePct}%, {bodies.waxing ? 'waxing' : 'waning'}
                  </span>
                </div>

                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  style={{ width: '100%' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      fontSize: 11,
                      opacity: 0.9,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      minWidth: 180,
                    }}
                  >
                    <Compass size={13} color="#93c5fd" />
                    Latitude: {lat >= 0 ? `${lat}° N` : `${-lat}° S`}
                    <input
                      type="range"
                      min={-60}
                      max={65}
                      step={1}
                      value={lat}
                      onChange={(e) => {
                        setLat(Number(e.target.value));
                        setIsGps(false);
                      }}
                      style={{ flex: 1 }}
                    />
                  </label>
                  <span style={{ fontSize: 10, opacity: 0.65 }}>
                    Lon: {lon >= 0 ? `${lon}° E` : `${-lon}° W`}
                  </span>
                </div>

                <div style={{ fontSize: 10, opacity: 0.6, textAlign: 'center' }}>
                  Tap any star, planet or constellation to identify it. Drag to pan, scroll or pinch to zoom.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Solar System View Controls */}
      {mode === 'solar' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 12,
              display: 'flex',
              gap: 8,
              zIndex: 6,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="stay-white"
              style={chipBtn(playing)}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? 'Pause time' : 'Run time'}
            </button>
            <button
              className="stay-white"
              style={chipBtn(false)}
              onClick={() => {
                setSelected(null);
                simRef.current.d = dayNum(new Date());
              }}
            >
              <RotateCcw size={14} />
              Today
            </button>
          </div>
          {selected ? (
            <PlanetCard name={selected} onBack={() => setSelected(null)} />
          ) : (
            <div
              className="stay-white"
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                zIndex: 6,
                textAlign: 'center',
                fontSize: 11,
                opacity: 0.75,
                textShadow: '0 1px 3px #000',
              }}
            >
              Tap any planet to fly to it. Drag to orbit, scroll or pinch to zoom. Real Solar System Scope planetary textures.
            </div>
          )}
        </>
      )}

      {/* Milky Way View Controls */}
      {mode === 'galaxy' && (
        <div
          className="stay-white"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 6,
            textAlign: 'center',
            fontSize: 11,
            opacity: 0.75,
            textShadow: '0 1px 3px #000',
          }}
        >
          Our galaxy spans 100,000 light-years; the Sun orbits 26,000 light-years from Sagittarius A*. Drag to orbit, scroll or pinch to zoom.
        </div>
      )}
    </div>
  );
}
