import { useSyncExternalStore } from 'react';
import { getCalmMusic } from './calmMusic';
import { getRadioState } from './radioPlayer';

// Soft room sounds that change as you move through the house: birds and wind in the
// garden, rain on the veranda, chatter in the market, a hum and the odd clink in the
// kitchen. Everything is made live with the Web Audio API (no sound files), is off until
// someone turns it on, and sits quietly under music or the radio.

export const PROFILES = {
  garden: { wind: 0.05, birds: true },
  rain: { rain: 0.07, wind: 0.015 },
  market: { babble: 0.11, rumble: 0.03 },
  street: { rumble: 0.06, wind: 0.02 },
  kitchen: { hum: 0.05, clink: true },
  calm: { pad: 0.06, rain: 0.025 },
  room: { hum: 0.02 },
};
const ZONE_PROFILE = {
  lawn: 'garden', courtyard: 'garden', frontyard: 'garden', cricket: 'garden',
  terrace: 'rain', f2balcony: 'rain',
  market: 'market', street: 'street',
  kitchen: 'kitchen', f2kitchen: 'kitchen',
  f2breakup: 'calm',
};
export const profileNameFor = (zone) => ZONE_PROFILE[zone] || 'room';
export const profileFor = (zone) => PROFILES[profileNameFor(zone)];

const KEY = 'sp_gamify_ambience';
function readPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { on: !!v.on, volume: Number.isFinite(v.volume) ? Math.min(1, Math.max(0, v.volume)) : 0.5 };
  } catch { return { on: false, volume: 0.5 }; }
}

let prefs = readPrefs();
let snapshot = prefs;
const listeners = new Set();
const publish = () => {
  snapshot = { ...prefs };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  listeners.forEach(l => l());
};
export const getAmbience = () => snapshot;
export const useAmbience = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getAmbience, getAmbience);

// ---------------------------------------------------------------- the audio graph
let ctx = null;
let master = null;
let layers = null; // name -> GainNode
let zone = 'hall';
let timer = null;
let duckTimer = null;

function noiseBuffer(c) {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = (w * 0.5 + last * 3.5) * 0.5; }
  return buf;
}

function noiseLayer(c, buf, nodes) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  let n = src;
  nodes.forEach(node => { n.connect(node); n = node; });
  const g = c.createGain();
  g.gain.value = 0;
  n.connect(g);
  g.connect(master);
  src.start();
  return g;
}

function build() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const buf = noiseBuffer(ctx);
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  layers = {
    wind: noiseLayer(ctx, buf, [filt('lowpass', 420)]),
    rain: noiseLayer(ctx, buf, [filt('highpass', 900), filt('lowpass', 7000)]),
    babble: noiseLayer(ctx, buf, [filt('bandpass', 650, 0.8)]),
    rumble: noiseLayer(ctx, buf, [filt('lowpass', 140)]),
  };
  // a low hum and a soft pad are made from sine waves
  const tone = (freqs, level) => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    freqs.forEach(f => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = level; o.connect(og); og.connect(g); o.start(); });
    return g;
  };
  layers.hum = tone([55, 110.4], 0.5);
  layers.pad = tone([130.81, 196, 261.63], 0.33);
  // the babble swells and fades a little, like a crowd
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.23;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain);
  lfoGain.connect(layers.babble.gain);
  lfo.start();
  return true;
}

function chirp() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = 2 + Math.floor(Math.random() * 3);
  const base = 2200 + Math.random() * 1600;
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    const s = t + i * 0.11;
    o.frequency.setValueAtTime(base, s);
    o.frequency.exponentialRampToValueAtTime(base * 1.45, s + 0.07);
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.05, s + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
    o.connect(g); g.connect(master);
    o.start(s); o.stop(s + 0.1);
  }
}

function clink() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 1900 + Math.random() * 900;
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.4);
}

function applyZone() {
  if (!ctx || !layers) return;
  const p = profileFor(zone);
  Object.entries(layers).forEach(([name, g]) => g.gain.setTargetAtTime(p[name] || 0, ctx.currentTime, 1.2));
}

function applyVolume() {
  if (!ctx || !master) return;
  // sit under music or the radio when either is playing
  const quiet = !!getCalmMusic().current || getRadioState().status === 'playing';
  const level = prefs.on ? prefs.volume * (quiet ? 0.3 : 1) * 2 : 0;
  master.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
}

function schedule() {
  clearTimeout(timer);
  const p = profileFor(zone);
  const next = p.birds ? 1400 + Math.random() * 3200 : p.clink ? 6000 + Math.random() * 8000 : 5000;
  timer = setTimeout(() => {
    if (prefs.on && ctx && ctx.state === 'running') {
      const q = profileFor(zone);
      if (q.birds) chirp();
      if (q.clink && Math.random() < 0.7) clink();
    }
    schedule();
  }, next);
}

// Short one-off sounds: a soft footstep, a door, a ping when someone arrives. They follow the
// same on/off switch and volume as the room sounds.
export function playSfx(kind) {
  if (!prefs.on || !ctx || !master || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const blip = (type, f0, f1, at, len, level) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t + at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + at + len);
    g.gain.setValueAtTime(level, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
    o.connect(g); g.connect(master);
    o.start(t + at); o.stop(t + at + len + 0.02);
  };
  if (kind === 'step') blip('sine', 130 + Math.random() * 30, 70, 0, 0.07, 0.05);
  else if (kind === 'door') { blip('sine', 190, 60, 0, 0.2, 0.14); blip('sawtooth', 320, 210, 0.04, 0.28, 0.018); blip('sine', 170, 60, 0.3, 0.18, 0.1); }
  else if (kind === 'join') { blip('sine', 660, 660, 0, 0.14, 0.05); blip('sine', 880, 880, 0.12, 0.2, 0.05); }
}

// ---------------------------------------------------------------- controls
// Must be called from a tap/click the first time (browsers only start sound then).
export function setAmbienceOn(on) {
  prefs = { ...prefs, on: !!on };
  if (prefs.on) {
    if (!ctx && !build()) { prefs = { ...prefs, on: false }; publish(); return; }
    if (ctx.state === 'suspended') {
      ctx.resume();
      // if the browser still needs a tap before it allows sound, start on the next one
      const c = ctx;
      window.addEventListener('pointerdown', () => { if (c.state === 'suspended') c.resume(); }, { once: true });
    }
    applyZone();
    schedule();
    clearInterval(duckTimer);
    duckTimer = setInterval(applyVolume, 1000);
  } else {
    clearTimeout(timer);
    clearInterval(duckTimer);
  }
  applyVolume();
  publish();
}
export function setAmbienceVolume(v) {
  prefs = { ...prefs, volume: Math.min(1, Math.max(0, Number(v) || 0)) };
  applyVolume();
  publish();
}
export function setAmbienceZone(z) {
  if (z === zone) return;
  zone = z;
  applyZone();
  if (prefs.on) schedule();
}
// When the house closes: stop making sound, but keep the saved choice.
export function stopAmbience() {
  clearTimeout(timer);
  clearInterval(duckTimer);
  if (ctx) { try { ctx.close(); } catch { /* ignore */ } }
  ctx = null; master = null; layers = null;
}
// After the house reopens, bring the sound back if it was on (the browser may need a tap first).
export function resumeAmbience() {
  if (prefs.on) setAmbienceOn(true);
}
