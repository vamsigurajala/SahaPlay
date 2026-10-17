import { useSyncExternalStore } from 'react';
import { getCalmMusic } from './calmMusic';
import { getRadioState } from './radioPlayer';

// Soothing, peaceful procedural ambient music generated in real-time with Web Audio API.
// Zero noise, zero static hiss: each room has its own bespoke calming musical chord,
// harmonic scale, and gentle chimes that seamlessly glide as you roam the house.

export const ROOM_THEMES = {
  // Ground Floor
  hall: {
    name: 'Living Room',
    profile: 'room',
    baseFreqs: [130.81, 196.00, 261.63, 329.63], // C Major (C3, G3, C4, E4) - warm, welcoming, homey
    chimes: [392.00, 523.25, 659.25, 783.99, 1046.50], // G4, C5, E5, G5, C6
    tempo: 3600,
  },
  study: {
    name: 'Study',
    profile: 'room',
    baseFreqs: [146.83, 220.00, 293.66, 349.23], // D Dorian (D3, A3, D4, F4) - focus, thoughtful lo-fi chill
    chimes: [440.00, 523.25, 587.33, 698.46, 880.00], // A4, C5, D5, F5, A5
    tempo: 4200,
  },
  bedroom: {
    name: 'Bedroom',
    profile: 'room',
    baseFreqs: [174.61, 261.63, 349.23, 440.00], // F Major 7 (F3, C4, F4, A4) - dreamy, soft lullaby
    chimes: [523.25, 659.25, 698.46, 880.00, 1046.50], // C5, E5, F5, A5, C6
    tempo: 4600,
  },
  kitchen: {
    name: 'Kitchen',
    profile: 'kitchen',
    baseFreqs: [110.00, 164.81, 220.00, 261.63], // A Minor 7 (A2, E3, A3, C4) - cozy acoustic cafe morning
    chimes: [329.63, 392.00, 440.00, 523.25, 659.25], // E4, G4, A4, C5, E5
    tempo: 3200,
  },
  gameroom: {
    name: 'Game Room',
    profile: 'room',
    baseFreqs: [164.81, 246.94, 329.63, 392.00], // E Minor 9 (E3, B3, E4, G4) - whimsical, synth-fantasy
    chimes: [493.88, 587.33, 659.25, 739.99, 987.77], // B4, D5, E5, F#5, B5
    tempo: 3300,
  },
  lawn: {
    name: 'Garden',
    profile: 'garden',
    baseFreqs: [196.00, 293.66, 392.00, 493.88], // G Major Pentatonic (G3, D4, G4, B4) - sunshine & breeze
    chimes: [587.33, 659.25, 783.99, 880.00, 987.77], // D5, E5, G5, A5, B5
    tempo: 3500,
  },
  frontyard: {
    name: 'Front Yard',
    profile: 'garden',
    baseFreqs: [196.00, 246.94, 293.66, 392.00], // G Major open fifths (G3, B3, D4, G4)
    chimes: [587.33, 783.99, 880.00, 1174.66],
    tempo: 3800,
  },
  courtyard: {
    name: 'Courtyard',
    profile: 'garden',
    baseFreqs: [174.61, 220.00, 261.63, 349.23], // F Major (F3, A3, C4, F4) - peaceful stone patio
    chimes: [440.00, 523.25, 698.46, 880.00],
    tempo: 4000,
  },
  terrace: {
    name: 'Veranda',
    profile: 'rain',
    baseFreqs: [233.08, 349.23, 466.16, 587.33], // Bb Major 9 (Bb3, F4, Bb4, D5) - twilight horizon
    chimes: [698.46, 880.00, 932.33, 1174.66],
    tempo: 4200,
  },
  street: {
    name: 'Street',
    profile: 'street',
    baseFreqs: [146.83, 220.00, 293.66, 369.99], // D Major (D3, A3, D4, F#4) - relaxed daytime stroll
    chimes: [440.00, 587.33, 739.99, 880.00],
    tempo: 3600,
  },
  cricket: {
    name: 'Cricket Ground',
    profile: 'garden',
    baseFreqs: [146.83, 196.00, 293.66, 392.00], // D/G open resonance (D3, G3, D4, G4) - wide green grounds
    chimes: [587.33, 783.99, 880.00, 1046.50],
    tempo: 3800,
  },
  market: {
    name: 'Market',
    profile: 'market',
    baseFreqs: [220.00, 277.18, 329.63, 440.00], // A Major (A3, C#4, E4, A4) - cheerful acoustic warmth
    chimes: [554.37, 659.25, 880.00, 1108.73],
    tempo: 3200,
  },

  // Upstairs
  f2hall: {
    name: 'Upstairs Hall',
    profile: 'room',
    baseFreqs: [130.81, 196.00, 261.63, 329.63], // C Major
    chimes: [392.00, 523.25, 659.25, 783.99],
    tempo: 3800,
  },
  f2bed1: {
    name: 'Master Bedroom',
    profile: 'room',
    baseFreqs: [174.61, 261.63, 329.63, 440.00], // F Major 7 / C - lush, deep calm
    chimes: [523.25, 659.25, 880.00, 1046.50],
    tempo: 4600,
  },
  f2bed2: {
    name: 'Guest Bedroom',
    profile: 'room',
    baseFreqs: [196.00, 261.63, 329.63, 392.00], // C / G Major 9 - cozy sanctuary
    chimes: [523.25, 659.25, 783.99, 987.77],
    tempo: 4500,
  },
  f2kitchen: {
    name: 'Upstairs Cafe',
    profile: 'kitchen',
    baseFreqs: [110.00, 164.81, 220.00, 261.63], // A Minor 7
    chimes: [329.63, 392.00, 440.00, 523.25],
    tempo: 3400,
  },
  f2balcony: {
    name: 'Balcony',
    profile: 'rain',
    baseFreqs: [233.08, 349.23, 466.16, 587.33], // Bb Major 9
    chimes: [698.46, 880.00, 932.33, 1174.66],
    tempo: 4200,
  },
  f2breakup: {
    name: 'Reflection Lounge',
    profile: 'calm',
    baseFreqs: [103.83, 155.56, 207.65, 261.63], // Ab Major (Ab2, Eb3, Ab3, C4) - emotional, restorative, deep peace
    chimes: [415.30, 523.25, 622.25, 830.61],
    tempo: 4800,
  },
};

export const PROFILES = {
  garden: { birds: true, name: 'Garden Calm' },
  rain: { birds: false, name: 'Veranda Serenade' },
  market: { birds: false, name: 'Market Harmony' },
  street: { birds: false, name: 'Promenade Calm' },
  kitchen: { birds: false, name: 'Cafe Melodies' },
  calm: { birds: false, name: 'Reflection Lounge' },
  room: { birds: false, name: 'Living Peace' },
};

const ZONE_PROFILE = {
  lawn: 'garden', courtyard: 'garden', frontyard: 'garden', cricket: 'garden',
  terrace: 'rain', f2balcony: 'rain',
  market: 'market', street: 'street',
  kitchen: 'kitchen', f2kitchen: 'kitchen',
  f2breakup: 'calm',
};

export const profileNameFor = (z) => ZONE_PROFILE[z] || 'room';
export const profileFor = (z) => PROFILES[profileNameFor(z)];

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
let padFilter = null;
let chimeFilter = null;
let padOscs = null; // array of 4 OscillatorNode
let lfo = null;
let lfoGain = null;
let zone = 'hall';
let timer = null;
let duckTimer = null;

function getTheme(z) {
  return ROOM_THEMES[z] || ROOM_THEMES.hall;
}

function build() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Soft lowpass filter for warm, rounded ambient musical pads (no harsh sizzle or buzz)
  padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 850;
  padFilter.Q.value = 0.6;
  padFilter.connect(master);

  // Breathing LFO: slow 0.08Hz sine wave creating an organic, relaxing breathing swell
  lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);

  const theme = getTheme(zone);
  const freqs = theme.baseFreqs;

  // 4 polyphonic voices creating rich, soothing ambient pads with subtle micro-detuning
  padOscs = [0, 1, 2, 3].map((i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseF = freqs[i % freqs.length];
    // Gentle detune micro-chorus
    if (osc.detune) {
      osc.detune.value = (i - 1.5) * 1.2;
      osc.frequency.value = baseF;
    } else {
      osc.frequency.value = baseF * (1 + (i - 1.5) * 0.001);
    }

    const g = ctx.createGain();
    g.gain.value = 0.042;
    lfoGain.connect(g.gain);

    osc.connect(g);
    g.connect(padFilter);
    osc.start();
    return osc;
  });
  lfo.start();

  // Chime filter for gentle acoustic piano/bell chimes
  chimeFilter = ctx.createBiquadFilter();
  chimeFilter.type = 'lowpass';
  chimeFilter.frequency.value = 1800;
  chimeFilter.Q.value = 0.5;
  chimeFilter.connect(master);

  return true;
}

// Gentle, soothing chime note (Rhodes tine / crystal bell timbre with pure sines)
function playChime(freq) {
  if (!ctx || ctx.state !== 'running' || !prefs.on) return;
  const t = ctx.currentTime;

  const o1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(freq, t);

  // Subtle octave overtone
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(freq * 2, t);

  const dur = 2.4 + Math.random() * 0.8;
  g1.gain.setValueAtTime(0.0001, t);
  g1.gain.linearRampToValueAtTime(0.038, t + 0.04);
  g1.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.linearRampToValueAtTime(0.009, t + 0.03);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.65);

  o1.connect(g1);
  g1.connect(chimeFilter);

  o2.connect(g2);
  g2.connect(chimeFilter);

  o1.start(t);
  o1.stop(t + dur + 0.05);
  o2.start(t);
  o2.stop(t + dur + 0.05);
}

function applyZone() {
  if (!ctx || !padOscs) return;
  const theme = getTheme(zone);
  const freqs = theme.baseFreqs;
  const t = ctx.currentTime;
  // Seamless 2-second chord progression glide as you transition between rooms
  padOscs.forEach((osc, i) => {
    const targetFreq = freqs[i % freqs.length];
    if (typeof osc.frequency.setTargetAtTime === 'function') {
      osc.frequency.setTargetAtTime(targetFreq, t, 0.65);
    } else {
      osc.frequency.value = targetFreq;
    }
  });
}

function applyVolume() {
  if (!ctx || !master) return;
  // Sit softly under music or radio when either is playing
  const quiet = !!getCalmMusic().current || getRadioState().status === 'playing';
  const level = prefs.on ? prefs.volume * (quiet ? 0.25 : 1) * 1.8 : 0;
  master.gain.setTargetAtTime(level, ctx.currentTime, 0.5);
}

function schedule() {
  clearTimeout(timer);
  const theme = getTheme(zone);
  const next = theme.tempo + (Math.random() * 1200 - 600);
  timer = setTimeout(() => {
    if (prefs.on && ctx && ctx.state === 'running') {
      const chimes = theme.chimes;
      if (chimes && chimes.length > 0) {
        const note = chimes[Math.floor(Math.random() * chimes.length)];
        playChime(note);
      }
    }
    schedule();
  }, next);
}

// Short one-off sounds: a soft footstep, a door, a ping when someone arrives
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
  if (kind === 'step') blip('sine', 130 + Math.random() * 30, 70, 0, 0.07, 0.035);
  else if (kind === 'door') { blip('sine', 190, 60, 0, 0.2, 0.1); blip('sine', 170, 60, 0.25, 0.16, 0.08); }
  else if (kind === 'join') { blip('sine', 660, 660, 0, 0.14, 0.04); blip('sine', 880, 880, 0.12, 0.2, 0.04); }
  else if (kind === 'pop') { blip('sine', 520, 260, 0, 0.11, 0.05); }
}

// ---------------------------------------------------------------- controls
export function setAmbienceOn(on) {
  prefs = { ...prefs, on: !!on };
  if (prefs.on) {
    if (!ctx && !build()) { prefs = { ...prefs, on: false }; publish(); return; }
    if (ctx.state === 'suspended') {
      ctx.resume();
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

export function stopAmbience() {
  clearTimeout(timer);
  clearInterval(duckTimer);
  if (ctx) { try { ctx.close(); } catch { /* ignore */ } }
  ctx = null; master = null; padOscs = null; padFilter = null; chimeFilter = null; lfo = null; lfoGain = null;
}

export function resumeAmbience() {
  if (prefs.on) setAmbienceOn(true);
}
