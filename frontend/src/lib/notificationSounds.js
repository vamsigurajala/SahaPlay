// A small catalog of distinct, synthesized message-notification tones — no
// external audio files, generated on the fly via Web Audio the same way
// GlobalCallOverlay.jsx's call ring/ringback chime already is. Kept
// deliberately short (well under a second) since a notification sound plays
// once per message, not looped like a ringtone.
//
// Two kinds of "notes" build a tone:
//  - tone notes: {freq, freqTo?, at, dur, wave} played on an oscillator —
//    freqTo adds a pitch glide (exponential ramp), used for chirps/drips.
//  - noise notes: {noise:true, at, dur, filterFreq, filterQ} — a burst of
//    filtered white noise, used for rain/water-like textures an oscillator
//    can't produce on its own.
const TONES = {
  none: { name: 'None', notes: [] },
  chime: {
    name: 'Chime',
    notes: [
      { freq: 987.77, at: 0, dur: 0.14, wave: 'triangle' },
      { freq: 1318.51, at: 0.09, dur: 0.22, wave: 'triangle' },
    ],
  },
  ping: {
    name: 'Ping',
    notes: [{ freq: 1567.98, at: 0, dur: 0.18, wave: 'sine' }],
  },
  pop: {
    name: 'Pop',
    notes: [
      { freq: 700, at: 0, dur: 0.05, wave: 'square' },
      { freq: 1200, at: 0.045, dur: 0.06, wave: 'square' },
    ],
  },
  marimba: {
    name: 'Marimba',
    notes: [
      { freq: 523.25, at: 0, dur: 0.16, wave: 'sine' },
      { freq: 659.25, at: 0.08, dur: 0.16, wave: 'sine' },
      { freq: 783.99, at: 0.16, dur: 0.22, wave: 'sine' },
    ],
  },
  bell: {
    name: 'Bell',
    notes: [
      { freq: 1046.5, at: 0, dur: 0.5, wave: 'sine' },
      { freq: 2093, at: 0, dur: 0.3, wave: 'sine' },
    ],
  },
  bird: {
    name: 'Bird',
    notes: [
      { freq: 2400, freqTo: 3400, at: 0, dur: 0.08, wave: 'sine' },
      { freq: 2700, freqTo: 3800, at: 0.11, dur: 0.07, wave: 'sine' },
      { freq: 3200, freqTo: 2100, at: 0.21, dur: 0.06, wave: 'sine' },
    ],
  },
  bubble: {
    name: 'Bubble',
    notes: [
      { freq: 280, freqTo: 900, at: 0, dur: 0.12, wave: 'sine' },
      { freq: 460, freqTo: 1300, at: 0.09, dur: 0.1, wave: 'sine' },
    ],
  },
  waterdrop: {
    name: 'Water Drop',
    notes: [
      { freq: 1500, freqTo: 500, at: 0, dur: 0.18, wave: 'sine' },
      { freq: 2400, freqTo: 1100, at: 0.02, dur: 0.1, wave: 'sine' },
    ],
    noise: [{ at: 0.16, dur: 0.06, filterFreq: 2000, filterQ: 0.6 }],
  },
  rain: {
    name: 'Rain',
    noise: [
      { at: 0, dur: 0.035, filterFreq: 3200, filterQ: 1.4 },
      { at: 0.06, dur: 0.03, filterFreq: 4200, filterQ: 1.4 },
      { at: 0.12, dur: 0.035, filterFreq: 2600, filterQ: 1.2 },
      { at: 0.17, dur: 0.03, filterFreq: 5200, filterQ: 1.6 },
      { at: 0.23, dur: 0.04, filterFreq: 3600, filterQ: 1.3 },
      { at: 0.29, dur: 0.03, filterFreq: 4600, filterQ: 1.5 },
    ],
  },
  windchime: {
    name: 'Wind Chime',
    notes: [
      { freq: 1567.98, at: 0, dur: 0.55, wave: 'sine' },
      { freq: 2093, at: 0.05, dur: 0.5, wave: 'sine' },
      { freq: 1864.66, at: 0.16, dur: 0.45, wave: 'sine' },
      { freq: 2637.02, at: 0.24, dur: 0.4, wave: 'sine' },
    ],
  },
};

export const NOTIFICATION_TONE_LIST = Object.entries(TONES)
  .filter(([id]) => id !== 'none')
  .map(([id, t]) => ({ id, name: t.name }));

let sharedCtx = null;
function getCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  sharedCtx.resume?.().catch(() => {});
  return sharedCtx;
}

// Mobile browsers/WebViews (Android's Capacitor WebView included) refuse to
// let an AudioContext actually produce sound until it's created or resumed
// from directly inside a real user-gesture handler (tap/click) — resuming
// it later from an async socket-event callback with no gesture in the call
// stack is silently ignored, so a message arriving with the app open but
// with no context ever unlocked plays nothing at all, no error. Call this
// once from a document-level, one-time gesture listener at app startup
// (see App.jsx) so the SAME shared context used by playNotificationTone is
// already unlocked by the time any tone needs to play.
export function unlockAudio() {
  getCtx();
}

let noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const len = ctx.sampleRate; // 1s of white noise, sliced per burst via start/stop
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// toneId defaults to 'chime' (the app's own default) when unset/unknown —
// callers pass the user's saved preference, which may be 'none' (silent).
export function playNotificationTone(toneId) {
  const tone = TONES[toneId] || TONES.chime;
  const notes = tone.notes || [];
  const noiseBursts = tone.noise || [];
  if (!notes.length && !noiseBursts.length) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.wave;
    const start = now + note.at;
    if (note.freqTo) {
      osc.frequency.setValueAtTime(note.freq, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(note.freqTo, 1), start + note.dur);
    } else {
      osc.frequency.value = note.freq;
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.dur + 0.02);
  }
  for (const burst of noiseBursts) {
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = burst.filterFreq || 3000;
    filter.Q.value = burst.filterQ || 1.2;
    const gain = ctx.createGain();
    const start = now + burst.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + burst.dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(start);
    src.stop(start + burst.dur + 0.02);
  }
}
