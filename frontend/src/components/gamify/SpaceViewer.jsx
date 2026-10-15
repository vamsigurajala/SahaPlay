import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Telescope, Orbit, Sparkles, RotateCcw, Play, Pause, Tag, Spline, ArrowLeft } from 'lucide-react';
import { useWikiImage } from '../../data/wikiImages';

// A full-screen observatory behind the balcony telescope: the real night sky for
// where you are and when (bright stars, constellations, the Moon and planets at
// their true positions, the Milky Way), then the solar system and the galaxy as
// 3D scenes you can zoom through. Bright-star and planet positions are computed
// from real catalogue coordinates and orbital elements; the faint background
// stars and the Milky Way's grain are generated, so only the bright ones are real.

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rand(); return (u - 2) * 1.7; };

// ── bright stars: [name, RA hours, Dec degrees, magnitude, colour] ──────────
const STARS = [
  ['Sirius', 6.752, -16.72, -1.46, '#cfe0ff'], ['Canopus', 6.399, -52.70, -0.74, '#fff4e0'], ['Arcturus', 14.261, 19.18, -0.05, '#ffc890'],
  ['Alpha Centauri', 14.660, -60.83, -0.27, '#fff0d0'], ['Vega', 18.616, 38.78, 0.03, '#d8e4ff'], ['Capella', 5.278, 46.00, 0.08, '#ffeec0'],
  ['Rigel', 5.242, -8.20, 0.13, '#b0ccff'], ['Procyon', 7.655, 5.22, 0.34, '#fff4dc'], ['Betelgeuse', 5.919, 7.41, 0.5, '#ffa070'],
  ['Achernar', 1.629, -57.24, 0.46, '#b8d0ff'], ['Hadar', 14.064, -60.37, 0.61, '#b8d0ff'], ['Altair', 19.846, 8.87, 0.77, '#e8f0ff'],
  ['Acrux', 12.443, -63.10, 0.76, '#b0ccff'], ['Aldebaran', 4.599, 16.51, 0.85, '#ffb070'], ['Antares', 16.490, -26.43, 1.06, '#ff8a60'],
  ['Spica', 13.420, -11.16, 0.97, '#b0ccff'], ['Pollux', 7.755, 28.03, 1.14, '#ffd8a0'], ['Fomalhaut', 22.961, -29.62, 1.16, '#e8f0ff'],
  ['Deneb', 20.690, 45.28, 1.25, '#e8f0ff'], ['Mimosa', 12.795, -59.69, 1.25, '#b0ccff'], ['Regulus', 10.140, 11.97, 1.35, '#c8dcff'],
  ['Castor', 7.577, 31.89, 1.58, '#e8f0ff'], ['Gacrux', 12.519, -57.11, 1.64, '#ff9a70'], ['Shaula', 17.560, -37.10, 1.62, '#b0ccff'],
  ['Bellatrix', 5.419, 6.35, 1.64, '#b8d0ff'], ['Alnilam', 5.604, -1.20, 1.69, '#b0ccff'], ['Alnitak', 5.679, -1.94, 1.77, '#b0ccff'],
  ['Mintaka', 5.533, -0.30, 2.23, '#b0ccff'], ['Saiph', 5.796, -9.67, 2.09, '#b0ccff'], ['Polaris', 2.530, 89.26, 1.98, '#fff4dc'],
  ['Dubhe', 11.062, 61.75, 1.79, '#ffc890'], ['Merak', 11.031, 56.38, 2.37, '#e8f0ff'], ['Phecda', 11.897, 53.69, 2.44, '#e8f0ff'],
  ['Megrez', 12.257, 57.03, 3.31, '#e8f0ff'], ['Alioth', 12.900, 55.96, 1.77, '#e8f0ff'], ['Mizar', 13.399, 54.93, 2.04, '#e8f0ff'],
  ['Alkaid', 13.792, 49.31, 1.86, '#b8d0ff'], ['Schedar', 0.675, 56.54, 2.24, '#ffc890'], ['Caph', 0.153, 59.15, 2.27, '#fff4dc'],
  ['Gamma Cas', 0.945, 60.72, 2.47, '#b8d0ff'], ['Ruchbah', 1.430, 60.24, 2.68, '#e8f0ff'], ['Segin', 1.907, 63.67, 3.37, '#b8d0ff'],
  ['Graffias', 16.090, -19.81, 2.62, '#b8d0ff'], ['Dschubba', 16.006, -22.62, 2.32, '#b8d0ff'], ['Pi Sco', 15.981, -26.11, 2.89, '#b8d0ff'],
  ['Sigma Sco', 16.353, -25.59, 2.9, '#b8d0ff'], ['Tau Sco', 16.598, -28.22, 2.82, '#b8d0ff'], ['Epsilon Sco', 16.836, -34.29, 2.29, '#ffc890'],
  ['Mu Sco', 16.865, -38.05, 3.04, '#b8d0ff'], ['Zeta Sco', 16.909, -42.36, 3.62, '#ffc890'], ['Eta Sco', 17.203, -43.24, 3.33, '#fff4dc'],
  ['Theta Sco', 17.622, -42.99, 1.87, '#fff4dc'], ['Iota Sco', 17.793, -40.13, 3.03, '#e8f0ff'], ['Kappa Sco', 17.708, -39.03, 2.41, '#b8d0ff'],
  ['Lesath', 17.512, -37.30, 2.69, '#b8d0ff'], ['Algieba', 10.333, 19.84, 2.28, '#ffd8a0'], ['Zosma', 11.235, 20.52, 2.56, '#e8f0ff'],
  ['Denebola', 11.818, 14.57, 2.14, '#e8f0ff'], ['Eta Leo', 10.122, 16.76, 3.52, '#e8f0ff'], ['Adhafera', 10.278, 23.42, 3.44, '#fff4dc'],
  ['Chertan', 11.237, 15.43, 3.34, '#e8f0ff'], ['Sadr', 20.370, 40.26, 2.23, '#fff4dc'], ['Albireo', 19.512, 27.96, 3.18, '#ffd8a0'],
  ['Gienah Cyg', 20.770, 33.97, 2.48, '#ffc890'], ['Delta Cyg', 19.750, 45.13, 2.87, '#b8d0ff'], ['Delta Cru', 12.252, -58.75, 2.8, '#b8d0ff'],
  ['Alphard', 9.460, -8.66, 1.98, '#ffb070'], ['Hamal', 2.119, 23.46, 2.0, '#ffc890'], ['Mirfak', 3.405, 49.86, 1.79, '#fff4dc'],
  ['Alphecca', 15.578, 26.71, 2.23, '#e8f0ff'], ['Rasalhague', 17.582, 12.56, 2.07, '#e8f0ff'], ['Meissa', 5.585, 9.93, 3.3, '#b8d0ff'],
];
const STAR_BY = Object.fromEntries(STARS.map(s => [s[0], s]));
const NAMED = new Set(['Sirius', 'Canopus', 'Arcturus', 'Alpha Centauri', 'Vega', 'Capella', 'Rigel', 'Procyon', 'Betelgeuse', 'Achernar', 'Altair', 'Acrux', 'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Fomalhaut', 'Deneb', 'Regulus', 'Castor', 'Polaris', 'Dubhe', 'Mizar', 'Alkaid', 'Shaula', 'Denebola']);

const CONSTELLATIONS = [
  { name: 'Orion', lines: [['Betelgeuse', 'Bellatrix'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Saiph'], ['Saiph', 'Rigel'], ['Rigel', 'Mintaka'], ['Betelgeuse', 'Alnitak'], ['Betelgeuse', 'Meissa'], ['Meissa', 'Bellatrix']] },
  { name: 'Ursa Major (Big Dipper)', lines: [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid']] },
  { name: 'Cassiopeia', lines: [['Caph', 'Schedar'], ['Schedar', 'Gamma Cas'], ['Gamma Cas', 'Ruchbah'], ['Ruchbah', 'Segin']] },
  { name: 'Scorpius', lines: [['Graffias', 'Dschubba'], ['Dschubba', 'Pi Sco'], ['Dschubba', 'Sigma Sco'], ['Sigma Sco', 'Antares'], ['Antares', 'Tau Sco'], ['Tau Sco', 'Epsilon Sco'], ['Epsilon Sco', 'Mu Sco'], ['Mu Sco', 'Zeta Sco'], ['Zeta Sco', 'Eta Sco'], ['Eta Sco', 'Theta Sco'], ['Theta Sco', 'Iota Sco'], ['Iota Sco', 'Kappa Sco'], ['Kappa Sco', 'Shaula'], ['Shaula', 'Lesath']] },
  { name: 'Leo', lines: [['Regulus', 'Eta Leo'], ['Eta Leo', 'Algieba'], ['Algieba', 'Adhafera'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Denebola', 'Chertan'], ['Chertan', 'Regulus']] },
  { name: 'Southern Cross', lines: [['Gacrux', 'Acrux'], ['Mimosa', 'Delta Cru']] },
  { name: 'Cygnus', lines: [['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah Cyg', 'Sadr'], ['Sadr', 'Delta Cyg']] },
  { name: 'Summer Triangle', lines: [['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega']] },
];

const eqVec = (raH, decD, r = 100) => {
  const a = raH * 15 * RAD;
  const d = decD * RAD;
  return new THREE.Vector3(Math.cos(d) * Math.cos(a) * r, Math.cos(d) * Math.sin(a) * r, Math.sin(d) * r);
};

// ── time and place ──────────────────────────────────────────────────────────
const julian = (date) => date.getTime() / 86400000 + 2440587.5;
function lstDeg(date, lonE) {
  const jd = julian(date);
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return (((gmst + lonE) % 360) + 360) % 360;
}
// Matrix taking equatorial (x to the vernal equinox, z to the pole) vectors to the
// scene's local frame: x = east, y = up, -z = north.
function skyMatrix(lst, lat) {
  const t = lst * RAD;
  const p = lat * RAD;
  const c = Math.cos(t); const s = Math.sin(t);
  const cp = Math.cos(p); const sp = Math.sin(p);
  // v' = Rz(-lst) v, then X = y', Y = cos(lat) x' + sin(lat) z', Z = sin(lat) x' - cos(lat) z'
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
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(H) * Math.sin(p));
  return { alt: alt / RAD, az: ((az / RAD) + 360) % 360 };
}

// ── planets: Paul Schlyter's low-precision orbital elements ─────────────────
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
  return { x: r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(inc)), y: r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(inc)), z: r * Math.sin(u) * Math.sin(inc), r };
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
  if (name === 'Earth') { const g = sunGeo(d); return { x: -g.x, y: -g.y, z: 0, r: Math.hypot(g.x, g.y) }; }
  return helio(ELEM[name], d);
};
const planetA = (name) => (name === 'Earth' ? 1 : ELEM[name].a[0]);
function eclToEq(x, y, z, d) {
  const eps = (23.4393 - 3.563e-7 * d) * RAD;
  const ye = y * Math.cos(eps) - z * Math.sin(eps);
  const ze = y * Math.sin(eps) + z * Math.cos(eps);
  return { ra: ((Math.atan2(ye, x) / RAD + 360) % 360) / 15, dec: Math.atan2(ze, Math.hypot(x, ye)) / RAD };
}
const PLANET_LOOK = { Mercury: ['#c8c0b8', 0], Venus: ['#fff3d0', -3.5], Mars: ['#ff9a70', 0.6], Jupiter: ['#ffe8c8', -2.2], Saturn: ['#ffe0a0', 0.7] };
function skyBodies(date) {
  const d = dayNum(date);
  const sg = sunGeo(d);
  const out = [];
  Object.keys(PLANET_LOOK).forEach((name) => {
    const h = helio(ELEM[name], d);
    const e = eclToEq(h.x + sg.x, h.y + sg.y, h.z, d);
    out.push({ name, ra: e.ra, dec: e.dec, color: PLANET_LOOK[name][0], mag: PLANET_LOOK[name][1] });
  });
  // Moon (mean elements, good to about half a degree) and Sun direction for its phase
  const t = julian(date) - 2451545.0;
  const Mm = (134.963 + 13.064993 * t) * RAD;
  const F = (93.272 + 13.22935 * t) * RAD;
  const lonM = (218.316 + 13.176396 * t + 6.289 * Math.sin(Mm)) * RAD;
  const latM = 5.128 * Math.sin(F) * RAD;
  const moon = eclToEq(Math.cos(latM) * Math.cos(lonM), Math.cos(latM) * Math.sin(lonM), Math.sin(latM), d);
  const sunDir = eclToEq(sg.x, sg.y, 0, d);
  const elong = lonM - sg.lon;
  return { planets: out, moon, sunDir, phase: (1 - Math.cos(elong)) / 2, waxing: Math.sin(elong) > 0 };
}

// ── procedural textures ─────────────────────────────────────────────────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const blotches = (g, w, h, colors, n, minR, maxR, alpha) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rand() * colors.length)];
    g.globalAlpha = alpha * (0.4 + rand() * 0.6);
    g.beginPath();
    g.arc(rand() * w, rand() * h, minR + rand() * (maxR - minR), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
};
const bands = (g, w, h, cols, jitter) => {
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i];
    g.fillRect(0, (i / n) * h, w, h / n + 1);
  }
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rand() * 0.07})`;
    const y = rand() * h;
    g.fillRect(0, y, w, 2 + rand() * jitter);
  }
};
const TEX = {};
function planetTexture(name) {
  if (TEX[name]) return TEX[name];
  const t = canvasTex(512, 256, (g, w, h) => {
    if (name === 'Mercury') { g.fillStyle = '#9a948c'; g.fillRect(0, 0, w, h); blotches(g, w, h, ['#6e6962', '#b5aea4', '#58544e'], 260, 2, 12, 0.5); }
    else if (name === 'Venus') { g.fillStyle = '#e6c88a'; g.fillRect(0, 0, w, h); bands(g, w, h, ['#e8cf94', '#d9b574', '#eed9a4', '#d2ab6a'], 8); blotches(g, w, h, ['#f4e6bc'], 40, 10, 40, 0.25); }
    else if (name === 'Earth') {
      g.fillStyle = '#1c4f9a'; g.fillRect(0, 0, w, h);
      blotches(g, w, h, ['#2f7a3a', '#3b8a45', '#8a7a46', '#2a6a34'], 90, 8, 34, 0.95);
      g.fillStyle = '#eef3f8'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 16, w, 16);
      blotches(g, w, h, ['#ffffff'], 70, 6, 26, 0.35);
    } else if (name === 'Mars') { g.fillStyle = '#b8582e'; g.fillRect(0, 0, w, h); blotches(g, w, h, ['#8a3e20', '#d07a48', '#9a4a28'], 150, 4, 26, 0.5); g.fillStyle = '#f4ece4'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); }
    else if (name === 'Jupiter') { bands(g, w, h, ['#d8c4a0', '#b88a5a', '#e8d8b8', '#a8744a', '#e0c8a0', '#c09468', '#efe0c4', '#b07e52', '#d8bc94'], 6); g.fillStyle = '#b8502a'; g.beginPath(); g.ellipse(w * 0.62, h * 0.64, 26, 13, 0, 0, Math.PI * 2); g.fill(); }
    else if (name === 'Saturn') { bands(g, w, h, ['#e6d4a4', '#d4bc84', '#efe0b8', '#c8ae78', '#e0cc9c', '#d0b886'], 5); }
    else if (name === 'Uranus') { g.fillStyle = '#9ad8e0'; g.fillRect(0, 0, w, h); bands(g, w, h, ['#a4dce4', '#94d0da', '#acdfe6'], 3); }
    else if (name === 'Neptune') { g.fillStyle = '#2c4fc8'; g.fillRect(0, 0, w, h); bands(g, w, h, ['#3558d0', '#2a48b8', '#3c62d8', '#2c4cc0'], 4); blotches(g, w, h, ['#e8f0ff'], 12, 6, 18, 0.35); }
    else if (name === 'Moon') { g.fillStyle = '#b8b6b2'; g.fillRect(0, 0, w, h); blotches(g, w, h, ['#7d7b78', '#d2d0cc', '#908e8a'], 300, 2, 22, 0.45); }
    else { g.fillStyle = '#888'; g.fillRect(0, 0, w, h); }
  });
  TEX[name] = t;
  return t;
}
const glowTex = (() => {
  let t;
  return () => t || (t = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  }));
})();

// ── point clouds ────────────────────────────────────────────────────────────
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
      <shaderMaterial vertexShader={POINT_VERT} fragmentShader={POINT_FRAG} uniforms={uniforms} transparent depthWrite={false} blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </points>
  );
}
const col = new THREE.Color();
function pack(items) {
  const n = items.length;
  const pos = new Float32Array(n * 3); const size = new Float32Array(n); const color = new Float32Array(n * 3); const alpha = new Float32Array(n);
  items.forEach((it, i) => { pos.set(it.p, i * 3); size[i] = it.s; col.set(it.c).convertLinearToSRGB(); color.set([col.r, col.g, col.b], i * 3); alpha[i] = it.a; });
  return { pos, size, color, alpha };
}

// galactic -> equatorial
const GAL = [[-0.0548755604, 0.4941094279, -0.867666149], [-0.8734370902, -0.44482963, -0.1980763734], [-0.4838350155, 0.7469822445, 0.4559837762]];
const galToEq = (x, y, z) => [GAL[0][0] * x + GAL[0][1] * y + GAL[0][2] * z, GAL[1][0] * x + GAL[1][1] * y + GAL[1][2] * z, GAL[2][0] * x + GAL[2][1] * y + GAL[2][2] * z];

function useSkyData() {
  return useMemo(() => {
    const bright = STARS.map(s => ({ p: eqVec(s[1], s[2], 100).toArray(), s: clamp(5.5 + (2.2 - s[3]) * 3.4, 4, 24), c: s[4], a: 1 }));
    const faint = [];
    for (let i = 0; i < 9000; i++) {
      const u = rand() * 2 - 1; const a = rand() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
      const m = 3.4 + Math.pow(rand(), 0.45) * 3.4;
      const tint = rand();
      faint.push({ p: [r * Math.cos(a) * 100, r * Math.sin(a) * 100, u * 100], s: clamp(4.2 - (m - 3.4) * 0.9, 1.1, 4), c: tint < 0.15 ? '#ffd2a8' : tint < 0.35 ? '#c8dcff' : '#ffffff', a: clamp(1.1 - (m - 3.4) * 0.22, 0.25, 0.95) });
    }
    const mw = [];
    for (let i = 0; i < 52000; i++) {
      const bulge = rand() < 0.3;
      const l = bulge ? gauss() * 0.55 : rand() * Math.PI * 2;
      const b = (bulge ? gauss() * 0.16 : gauss() * (0.075 + 0.05 * Math.exp(-Math.pow(Math.min(l, Math.PI * 2 - l), 2) * 1.3))) * (rand() < 0.04 ? 3 : 1);
      const x = Math.cos(b) * Math.cos(l); const y = Math.cos(b) * Math.sin(l); const z = Math.sin(b);
      const e = galToEq(x, y, z);
      const warm = bulge || Math.min(l, Math.PI * 2 - l) < 0.9;
      // the dust lane: dim points close to the plane
      const dust = Math.abs(b) < 0.018 && Math.min(l, Math.PI * 2 - l) < 1.6 ? 0.35 : 1;
      mw.push({ p: [e[0] * 100, e[1] * 100, e[2] * 100], s: 1.6 + rand() * 2.2, c: warm ? (rand() < 0.5 ? '#ffe6c0' : '#fff4e0') : (rand() < 0.5 ? '#cfe0ff' : '#e8eeff'), a: (0.08 + rand() * 0.16) * dust });
    }
    for (let i = 0; i < 700; i++) {
      const l = rand() * Math.PI * 2;
      const b = gauss() * 0.07;
      const e = galToEq(Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b));
      const nearCentre = Math.min(l, Math.PI * 2 - l) < 1.1;
      mw.push({ p: [e[0] * 100, e[1] * 100, e[2] * 100], s: 38 + rand() * 46, c: nearCentre ? '#ffe2b8' : '#b8c8ee', a: nearCentre ? 0.035 : 0.022 });
    }
    const lineVerts = [];
    const labels = [];
    CONSTELLATIONS.forEach((c) => {
      const pts = new Set();
      c.lines.forEach(([a, b]) => {
        const A = STAR_BY[a]; const B = STAR_BY[b];
        if (!A || !B) return;
        lineVerts.push(...eqVec(A[1], A[2], 99.5).toArray(), ...eqVec(B[1], B[2], 99.5).toArray());
        pts.add(a); pts.add(b);
      });
      const v = new THREE.Vector3();
      pts.forEach(n => v.add(eqVec(STAR_BY[n][1], STAR_BY[n][2], 1)));
      v.normalize().multiplyScalar(99);
      labels.push({ name: c.name, p: v });
    });
    return { bright: pack(bright), faint: pack(faint), mw: pack(mw), lineVerts: new Float32Array(lineVerts), labels };
  }, []);
}

// ── night sky ───────────────────────────────────────────────────────────────
function SkyScene({ date, lat, lon, showLines, showLabels, ctl, bodies }) {
  const data = useSkyData();
  const { camera, gl, size } = useThree();
  const group = useRef();
  const uniforms = useMemo(() => ({ uScale: { value: 1 }, uAtten: { value: 0 } }), []);
  const lst = lstDeg(date, lon);
  const mat = useMemo(() => skyMatrix(lst, lat), [lst, lat]);
  const sunLight = useRef();
  const lineGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(data.lineVerts, 3)); return g; }, [data]);
  const planetData = useMemo(() => pack(bodies.planets.map(p => ({ p: eqVec(p.ra, p.dec, 98).toArray(), s: clamp(13 + (1 - p.mag) * 3.2, 10, 30), c: p.color, a: 1 }))), [bodies]);
  const moonPos = useMemo(() => eqVec(bodies.moon.ra, bodies.moon.dec, 90), [bodies]);
  const sunDir = useMemo(() => eqVec(bodies.sunDir.ra, bodies.sunDir.dec, 1), [bodies]);
  const moonTex = useMemo(() => planetTexture('Moon'), []);

  useEffect(() => { camera.rotation.order = 'YXZ'; }, [camera]);
  // drag / pinch / wheel to look and zoom
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map();
    let last = null; let pinch = null;
    const st = ctl.current;
    const down = (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture?.(e.pointerId); st.fly = null; if (pts.size === 1) { last = { x: e.clientX, y: e.clientY }; st.vy = 0; st.vp = 0; } if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), f: st.fov }; last = null; } };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; st.fov = clamp(pinch.f * (pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))), 3, 90); return; }
      if (!last) return;
      const k = (st.fov * RAD) / el.clientHeight;
      const dx = e.clientX - last.x; const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      st.yaw = (st.yaw - dx * k * 57.2958 + 360) % 360;
      st.pitch = clamp(st.pitch + dy * k * 57.2958, -8, 89);
      st.vy = -dx * k * 57.2958 * 30; st.vp = dy * k * 57.2958 * 30;
    };
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) last = null; };
    const wheel = (e) => { e.preventDefault(); st.fov = clamp(st.fov * Math.exp(e.deltaY * 0.0014), 3, 90); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); };
  }, [gl, ctl]);

  useFrame((_, dt) => {
    const st = ctl.current;
    if (st.fly) {
      const f = st.fly; const k = 1 - Math.exp(-dt * 4);
      let dy = ((f.yaw - st.yaw + 540) % 360) - 180;
      st.yaw = (st.yaw + dy * k + 360) % 360;
      st.pitch += (f.pitch - st.pitch) * k;
      st.fov += (f.fov - st.fov) * k;
      if (Math.abs(dy) < 0.05 && Math.abs(f.pitch - st.pitch) < 0.05) st.fly = null;
    } else if (Math.abs(st.vy) > 0.05 || Math.abs(st.vp) > 0.05) {
      st.yaw = (st.yaw + st.vy * dt + 360) % 360; st.pitch = clamp(st.pitch + st.vp * dt, -8, 89);
      const f = Math.exp(-dt * 4); st.vy *= f; st.vp *= f;
    }
    camera.rotation.set(st.pitch * RAD, -st.yaw * RAD, 0);
    if (camera.fov !== st.fov) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
    uniforms.uScale.value = Math.min(2, gl.getPixelRatio()) * Math.pow(60 / st.fov, 0.55) * (size.height / 800);
    if (group.current) { group.current.matrix.copy(mat); group.current.matrixWorldNeedsUpdate = true; }
    if (sunLight.current) { sunLight.current.position.copy(sunDir).applyMatrix4(mat.clone().setPosition(0, 0, 0)).multiplyScalar(50); }
  });

  return (
    <>
      <color attach="background" args={['#02030a']} />
      <ambientLight intensity={0.06} />
      <directionalLight ref={sunLight} intensity={3.2} color="#fff6e6" />
      <group ref={group} matrixAutoUpdate={false}>
        <Points data={data.mw} uniforms={uniforms} />
        <Points data={data.faint} uniforms={uniforms} />
        <Points data={data.bright} uniforms={uniforms} />
        <Points data={planetData} uniforms={uniforms} />
        {showLines && <lineSegments geometry={lineGeo}><lineBasicMaterial color="#6f93ff" transparent opacity={0.4} depthWrite={false} /></lineSegments>}
        <mesh position={moonPos}>
          <sphereGeometry args={[0.85, 32, 24]} />
          <meshStandardMaterial map={moonTex} roughness={1} />
        </mesh>
        {showLabels && (
          <>
            {STARS.filter(s => NAMED.has(s[0])).map(s => (
              <Html key={s[0]} position={eqVec(s[1], s[2], 100)} center zIndexRange={[20, 0]} pointerEvents="none">
                <div style={{ transform: 'translate(0, 14px)', color: '#cfe0ff', fontSize: 11, fontWeight: 600, textShadow: '0 0 4px #000', whiteSpace: 'nowrap' }}>{s[0]}</div>
              </Html>
            ))}
            {data.labels.map(l => (
              <Html key={l.name} position={l.p} center zIndexRange={[20, 0]} pointerEvents="none">
                <div style={{ color: '#8fb0ff', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: '0 0 6px #000', whiteSpace: 'nowrap' }}>{l.name}</div>
              </Html>
            ))}
            {bodies.planets.map(p => (
              <Html key={p.name} position={eqVec(p.ra, p.dec, 98)} center zIndexRange={[20, 0]} pointerEvents="none">
                <div style={{ transform: 'translate(0, 20px)', color: '#ffe0a0', fontSize: 12, fontWeight: 800, textShadow: '0 0 6px #000', whiteSpace: 'nowrap' }}>{p.name}</div>
              </Html>
            ))}
            <Html position={moonPos} center zIndexRange={[20, 0]} pointerEvents="none">
              <div style={{ transform: 'translate(0, 24px)', color: '#fff', fontSize: 12, fontWeight: 800, textShadow: '0 0 6px #000' }}>Moon</div>
            </Html>
          </>
        )}
      </group>
      {/* below the horizon: dark ground, with a faint glow at the horizon */}
      <mesh>
        <sphereGeometry args={[94, 32, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshBasicMaterial color="#04060c" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[93, 93, 8, 48, 1, true]} />
        <meshBasicMaterial color="#27406e" transparent opacity={0.16} side={THREE.BackSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {[['N', 0, -90], ['E', 90, 0], ['S', 0, 90], ['W', -90, 0]].map(([n, x, z]) => (
        <Html key={n} position={[x, 2, z]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div style={{ color: '#7fa0e0', fontSize: 15, fontWeight: 800, textShadow: '0 0 6px #000' }}>{n}</div>
        </Html>
      ))}
    </>
  );
}

// ── solar system ────────────────────────────────────────────────────────────
const PLANETS = [
  { name: 'Mercury', wiki: 'Mercury_(planet)', radius: 0.28, dia: '4,879 km', dist: '0.39 AU', day: '59 Earth days', year: '88 days', moons: '0', fact: 'The smallest planet and the closest to the Sun, with temperatures from -180 to 430 C.' },
  { name: 'Venus', wiki: 'Venus', radius: 0.5, dia: '12,104 km', dist: '0.72 AU', day: '243 Earth days (backwards)', year: '225 days', moons: '0', fact: 'The hottest planet, wrapped in thick clouds of sulphuric acid, spinning the wrong way.' },
  { name: 'Earth', wiki: 'Earth', radius: 0.54, dia: '12,742 km', dist: '1 AU', day: '24 hours', year: '365.25 days', moons: '1', fact: 'Home, and the only world known to have life and liquid oceans on its surface.' },
  { name: 'Mars', wiki: 'Mars', radius: 0.38, dia: '6,779 km', dist: '1.52 AU', day: '24.6 hours', year: '687 days', moons: '2', fact: 'A cold red desert with the tallest volcano in the solar system, Olympus Mons.' },
  { name: 'Jupiter', wiki: 'Jupiter', radius: 1.6, dia: '139,820 km', dist: '5.2 AU', day: '9.9 hours', year: '11.9 years', moons: '90+', fact: 'The largest planet; its Great Red Spot is a storm bigger than Earth.' },
  { name: 'Saturn', wiki: 'Saturn', radius: 1.3, dia: '116,460 km', dist: '9.58 AU', day: '10.7 hours', year: '29.4 years', moons: '140+', fact: 'Famous for its rings of ice and rock, and light enough to float on water.' },
  { name: 'Uranus', wiki: 'Uranus', radius: 0.85, dia: '50,724 km', dist: '19.2 AU', day: '17.2 hours', year: '84 years', moons: '28', fact: 'An ice giant that rolls around the Sun tipped on its side.' },
  { name: 'Neptune', wiki: 'Neptune', radius: 0.82, dia: '49,244 km', dist: '30.1 AU', day: '16.1 hours', year: '165 years', moons: '16', fact: 'The windiest planet, with supersonic storms, so far away it was found by maths.' },
];
const SUN_INFO = { name: 'Sun', wiki: 'Sun', dia: '1,392,700 km', dist: 'the centre', day: '25 days at the equator', year: '230 million years around the galaxy', moons: '8 planets', fact: 'A star that holds 99.86% of the solar system\'s mass.' };
const orbitR = (a) => 7 * Math.pow(a, 0.55);

function SolarScene({ onSelect, focus, playing, simRef }) {
  const { camera } = useThree();
  const controls = useRef();
  const refs = useRef({});
  const moonRef = useRef();
  const stars = useMemo(() => {
    const items = [];
    for (let i = 0; i < 3500; i++) { const u = rand() * 2 - 1; const a = rand() * Math.PI * 2; const r = Math.sqrt(1 - u * u); items.push({ p: [r * Math.cos(a) * 420, u * 420, r * Math.sin(a) * 420], s: 1.4 + rand() * 2.6, c: rand() < 0.2 ? '#ffd8b0' : '#ffffff', a: 0.4 + rand() * 0.6 }); }
    return pack(items);
  }, []);
  const belt = useMemo(() => {
    const items = [];
    for (let i = 0; i < 2600; i++) { const a = rand() * Math.PI * 2; const r = orbitR(2.1) + rand() * (orbitR(3.3) - orbitR(2.1)); items.push({ p: [Math.cos(a) * r, gauss() * 0.25, Math.sin(a) * r], s: 0.7 + rand() * 1.2, c: '#b8aa98', a: 0.8 }); }
    return pack(items);
  }, []);
  const uniforms = useMemo(() => ({ uScale: { value: 1 }, uAtten: { value: 0 } }), []);
  const beltU = useMemo(() => ({ uScale: { value: 1 }, uAtten: { value: 1 } }), []);
  const sunGlow = useMemo(() => glowTex(), []);
  const ring = useMemo(() => canvasTex(256, 8, (g, w, h) => { for (let x = 0; x < w; x++) { const t = x / w; const a = t < 0.12 ? 0 : (0.35 + 0.5 * Math.abs(Math.sin(t * 38))) * (t > 0.66 && t < 0.72 ? 0.1 : 1); g.fillStyle = `rgba(226,205,160,${a})`; g.fillRect(x, 0, 1, h); } }), []);
  const orbitLines = useMemo(() => PLANETS.map(p => { const r = orbitR(planetA(p.name)); const pts = []; for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } return new THREE.BufferGeometry().setFromPoints(pts); }), []);
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
      if (g) { g.position.set(Math.cos(ang) * r, 0, -Math.sin(ang) * r); g.children[0].rotation.y += dt * 0.4; }
    });
    const eg = refs.current.Earth;
    if (eg && moonRef.current) { const a = sim.d / 27.3 * Math.PI * 2; moonRef.current.position.set(Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3); }
    uniforms.uScale.value = 1.2; beltU.uScale.value = 1.2;
    const c = controls.current;
    if (focus && c) {
      const g = focus === 'Sun' ? null : refs.current[focus];
      const tgt = g ? g.position : new THREE.Vector3(0, 0, 0);
      const rad = focus === 'Sun' ? 2.6 : PLANETS.find(p => p.name === focus).radius;
      if (!fly.current.active || fly.current.name !== focus) { fly.current = { active: true, name: focus }; }
      c.target.lerp(tgt, 1 - Math.exp(-dt * 4));
      const want = tgt.clone().add(new THREE.Vector3(rad * 3.4, rad * 1.6, rad * 4.4));
      if (fly.current.active) { camera.position.lerp(want, 1 - Math.exp(-dt * 2.4)); if (camera.position.distanceTo(want) < 0.3) fly.current.active = false; }
    } else if (c && fly.current.name) {
      fly.current = { active: false, name: null };
    }
  });

  return (
    <>
      <color attach="background" args={['#000005']} />
      <ambientLight intensity={0.22} />
      <pointLight position={[0, 0, 0]} intensity={6.5} decay={0} color="#fff1d8" />
      <Points data={stars} uniforms={uniforms} />
      <Points data={belt} uniforms={beltU} />
      {/* Sun */}
      <mesh onClick={(e) => { e.stopPropagation(); onSelect('Sun'); }}>
        <sphereGeometry args={[2.6, 48, 32]} />
        <meshBasicMaterial color="#ffd27a" />
      </mesh>
      <sprite scale={[16, 16, 1]}><spriteMaterial map={sunGlow} color="#ffb04a" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[34, 34, 1]}><spriteMaterial map={sunGlow} color="#ff8a30" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      {orbitLines.map((g, i) => <lineLoop key={i} geometry={g}><lineBasicMaterial color="#4a5a88" transparent opacity={0.45} /></lineLoop>)}
      {PLANETS.map(p => (
        <group key={p.name} ref={(el) => { refs.current[p.name] = el; }}>
          <mesh onClick={(e) => { e.stopPropagation(); onSelect(p.name); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
            <sphereGeometry args={[p.radius, 40, 28]} />
            <meshStandardMaterial map={planetTexture(p.name)} roughness={0.95} />
          </mesh>
          {p.name === 'Saturn' && (
            <mesh rotation={[Math.PI / 2 - 0.45, 0, 0.2]}>
              <ringGeometry args={[p.radius * 1.35, p.radius * 2.35, 96]} />
              <meshBasicMaterial map={ring} transparent side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}
          {p.name === 'Earth' && (
            <mesh ref={moonRef}><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial map={planetTexture('Moon')} roughness={1} /></mesh>
          )}
          <Html position={[0, p.radius + 0.7, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
            <div style={{ color: '#dfe8ff', fontSize: 11, fontWeight: 700, textShadow: '0 0 4px #000', whiteSpace: 'nowrap' }}>{p.name}</div>
          </Html>
        </group>
      ))}
      <Html position={[0, 3.6, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div style={{ color: '#ffe3a0', fontSize: 12, fontWeight: 800, textShadow: '0 0 4px #000' }}>Sun</div>
      </Html>
      <OrbitControls ref={controls} enableDamping dampingFactor={0.08} minDistance={1.5} maxDistance={260} zoomSpeed={1.2} />
    </>
  );
}

// ── the Milky Way galaxy ────────────────────────────────────────────────────
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
        items.push({ p: [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.55, r * Math.sin(ph) * Math.sin(th)], s: 2.4 + rand() * 3, c: rand() < 0.6 ? '#ffe2b0' : '#ffcf90', a: 0.55 });
        continue;
      }
      const r = Math.pow(rand(), 0.62) * R;
      const arm = Math.floor(rand() * 4);
      const th = arm * (Math.PI / 2) + Math.log(1 + r / 3) * 3.3 + gauss() * (0.1 + 0.28 * (r / R));
      const y = gauss() * (0.5 * (1 - r / R) + 0.12);
      const hot = rand() < 0.07;
      items.push({ p: [Math.cos(th) * r, y, Math.sin(th) * r], s: hot ? 4.4 : 2 + rand() * 2.4, c: hot ? '#ff9ac8' : rand() < 0.6 ? '#bcd0ff' : '#e8eeff', a: hot ? 0.8 : 0.4 });
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
      <sprite scale={[34, 34, 1]}><spriteMaterial map={glow} color="#ffd9a0" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <sprite scale={[120, 120, 1]}><spriteMaterial map={glow} color="#7f9bff" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      <Html position={[0, 3, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div style={{ color: '#ffe3b0', fontSize: 12, fontWeight: 800, textShadow: '0 0 6px #000', whiteSpace: 'nowrap' }}>Galactic centre (Sagittarius A*)</div>
      </Html>
      <group position={[Math.cos(sunAng) * sunR, 0.2, Math.sin(sunAng) * sunR]}>
        <mesh><sphereGeometry args={[0.35, 16, 12]} /><meshBasicMaterial color="#fff2b0" /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.9, 1.05, 40]} /><meshBasicMaterial color="#6fe0ff" side={THREE.DoubleSide} transparent opacity={0.9} /></mesh>
        <Html position={[0, 1.6, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div style={{ color: '#9aeaff', fontSize: 13, fontWeight: 800, textShadow: '0 0 6px #000', whiteSpace: 'nowrap' }}>You are here: the Sun</div>
        </Html>
      </group>
      <OrbitControls enableDamping dampingFactor={0.06} autoRotate autoRotateSpeed={0.35} minDistance={4} maxDistance={220} />
    </>
  );
}

// ── interface ───────────────────────────────────────────────────────────────
const bar = { background: 'rgba(8,10,22,0.78)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 99, color: '#fff', backdropFilter: 'blur(6px)' };
const chipBtn = (on) => ({ ...bar, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: on ? 'rgba(99,102,241,0.85)' : bar.background });

function PlanetCard({ name, onBack }) {
  const info = name === 'Sun' ? SUN_INFO : PLANETS.find(p => p.name === name);
  const photo = useWikiImage(info.wiki);
  return (
    <div className="stay-white" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, maxWidth: 440, zIndex: 8, ...bar, borderRadius: 16, padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {photo && <img src={photo} alt={info.name} referrerPolicy="no-referrer" style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover', flex: 'none', background: '#000' }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{info.name}</div>
        <div style={{ fontSize: 12, opacity: 0.85, margin: '2px 0 6px' }}>{info.fact}</div>
        <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.5 }}>Diameter {info.dia} - Distance from the Sun {info.dist}<br />Day {info.day} - Year {info.year} - Moons {info.moons}</div>
        <button onClick={onBack} className="stay-white" style={{ ...chipBtn(false), marginTop: 8, padding: '5px 12px' }}><ArrowLeft size={13} />Back to the whole system</button>
      </div>
    </div>
  );
}

export default function SpaceViewer() {
  const [mode, setMode] = useState('sky');
  const [lines, setLines] = useState(true);
  const [labels, setLabels] = useState(true);
  const [hours, setHours] = useState(0);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying] = useState(false);
  const lon = useMemo(() => clamp(-new Date().getTimezoneOffset() / 4, -180, 180), []); // from the time zone
  const [lat, setLat] = useState(20);
  const [now, setNow] = useState(() => Date.now());
  const ctl = useRef({ yaw: 180, pitch: 38, fov: 75, vy: 0, vp: 0, fly: null });
  const simRef = useRef({ d: dayNum(new Date()) });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const date = useMemo(() => new Date(now + hours * 3600000), [now, hours]);
  const bodies = useMemo(() => skyBodies(date), [date]);
  const lst = lstDeg(date, lon);

  const targets = useMemo(() => {
    const list = [{ name: 'Moon', ra: bodies.moon.ra, dec: bodies.moon.dec, fov: 9 }];
    bodies.planets.forEach(p => list.push({ name: p.name, ra: p.ra, dec: p.dec, fov: 10 }));
    [['Orion', 'Alnilam', 40], ['Big Dipper', 'Megrez', 38], ['Scorpius', 'Antares', 36], ['Southern Cross', 'Acrux', 30], ['Cassiopeia', 'Schedar', 34], ['Polaris', 'Polaris', 40]].forEach(([n, s, f]) => list.push({ name: n, ra: STAR_BY[s][1], dec: STAR_BY[s][2], fov: f }));
    list.push({ name: 'Milky Way core', ra: 17.76, dec: -28.9, fov: 55 });
    return list;
  }, [bodies]);
  const [note, setNote] = useState('');
  const goTo = (t) => {
    const a = altAz(t.ra, t.dec, lst, lat);
    if (a.alt < -2) { setNote(`${t.name} is below the horizon right now. Move the time slider.`); return; }
    setNote('');
    ctl.current.fly = { yaw: a.az, pitch: clamp(a.alt, -5, 85), fov: t.fov };
  };
  const phasePct = Math.round(bodies.phase * 100);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1, touchAction: 'none' }}>
      <Canvas key={mode} dpr={[1, 1.75]} camera={mode === 'sky' ? { fov: 75, near: 0.1, far: 1000, position: [0, 0, 0] } : mode === 'solar' ? { fov: 50, near: 0.05, far: 2000, position: [0, 36, 62] } : { fov: 50, near: 0.1, far: 2000, position: [0, 55, 85] }} gl={{ antialias: true }}>
        {mode === 'sky' && <SkyScene date={date} lat={lat} lon={lon} showLines={lines} showLabels={labels} ctl={ctl} bodies={bodies} />}
        {mode === 'solar' && <SolarScene onSelect={setSelected} focus={selected} playing={playing} simRef={simRef} />}
        {mode === 'galaxy' && <GalaxyScene />}
      </Canvas>

      <div style={{ position: 'absolute', top: 12, left: 12, right: 64, display: 'flex', flexWrap: 'wrap', gap: 8, zIndex: 6 }}>
        <button className="stay-white" style={chipBtn(mode === 'sky')} onClick={() => { setMode('sky'); setSelected(null); }}><Telescope size={14} />Night sky</button>
        <button className="stay-white" style={chipBtn(mode === 'solar')} onClick={() => { setMode('solar'); setSelected(null); }}><Orbit size={14} />Solar system</button>
        <button className="stay-white" style={chipBtn(mode === 'galaxy')} onClick={() => { setMode('galaxy'); setSelected(null); }}><Sparkles size={14} />Milky Way</button>
      </div>

      {mode === 'sky' && (
        <>
          <div style={{ position: 'absolute', top: 58, left: 12, display: 'flex', flexWrap: 'wrap', gap: 8, zIndex: 6, maxWidth: 'calc(100% - 24px)' }}>
            <button className="stay-white" style={chipBtn(lines)} onClick={() => setLines(v => !v)}><Spline size={14} />Constellations</button>
            <button className="stay-white" style={chipBtn(labels)} onClick={() => setLabels(v => !v)}><Tag size={14} />Names</button>
            <button className="stay-white" style={chipBtn(false)} onClick={() => { ctl.current.fly = { yaw: 180, pitch: 38, fov: 75 }; setHours(0); }}><RotateCcw size={14} />Reset</button>
          </div>
          <div className="stay-white" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {note && <div style={{ ...bar, padding: '6px 14px', fontSize: 12 }}>{note}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 760 }}>
              {targets.map(t => <button key={t.name} className="stay-white" style={{ ...chipBtn(false), padding: '5px 11px', fontSize: 11 }} onClick={() => goTo(t)}>{t.name}</button>)}
            </div>
            <div style={{ ...bar, borderRadius: 14, padding: '8px 14px', width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, gap: 8, flexWrap: 'wrap' }}>
                <span>{date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}{hours === 0 ? ' (now)' : ''}</span>
                <span style={{ opacity: 0.8 }}>Moon {phasePct}% lit, {bodies.waxing ? 'waxing' : 'waning'}</span>
              </div>
              <input type="range" min={-12} max={12} step={0.25} value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%' }} />
              <label style={{ fontSize: 11, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 8 }}>Latitude {lat} N
                <input type="range" min={-60} max={65} step={1} value={lat} onChange={e => setLat(Number(e.target.value))} style={{ flex: 1 }} />
              </label>
              <div style={{ fontSize: 10, opacity: 0.6, textAlign: 'center' }}>Drag to look around, scroll or pinch to zoom. Bright stars, the Moon and planets are in their true places; the faint stars are generated.</div>
            </div>
          </div>
        </>
      )}

      {mode === 'solar' && (
        <>
          <div style={{ position: 'absolute', top: 58, left: 12, display: 'flex', gap: 8, zIndex: 6, flexWrap: 'wrap' }}>
            <button className="stay-white" style={chipBtn(playing)} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause time' : 'Run time'}</button>
            <button className="stay-white" style={chipBtn(false)} onClick={() => { setSelected(null); simRef.current.d = dayNum(new Date()); }}><RotateCcw size={14} />Today</button>
          </div>
          {selected ? <PlanetCard name={selected} onBack={() => setSelected(null)} /> : (
            <div className="stay-white" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 6, textAlign: 'center', fontSize: 11, opacity: 0.75, textShadow: '0 1px 3px #000' }}>Tap a planet to fly to it. Drag to orbit, scroll or pinch to zoom. Planets are at today&apos;s real positions; sizes and distances are compressed to fit.</div>
          )}
        </>
      )}

      {mode === 'galaxy' && (
        <div className="stay-white" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 6, textAlign: 'center', fontSize: 11, opacity: 0.75, textShadow: '0 1px 3px #000' }}>Our galaxy is about 100,000 light-years across; the Sun sits about 26,000 light-years from the centre. This is an artist-style model. Drag to orbit, scroll or pinch to zoom.</div>
      )}
    </div>
  );
}
