// A small catalog of distinct, synthesized message-notification tones — no
// external audio files, generated on the fly via Web Audio the same way
// GlobalCallOverlay.jsx's call ring/ringback chime already is. Kept
// deliberately short (well under a second) since a notification sound plays
// once per message, not looped like a ringtone.
//
// Each entry is a list of {freq, at, dur, wave} notes played relative to a
// shared start time — a tiny declarative "song" rather than one-off
// oscillator code duplicated per tone.
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

// toneId defaults to 'chime' (the app's own default) when unset/unknown —
// callers pass the user's saved preference, which may be 'none' (silent).
export function playNotificationTone(toneId) {
  const tone = TONES[toneId] || TONES.chime;
  if (!tone.notes.length) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const note of tone.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.wave;
    osc.frequency.value = note.freq;
    const start = now + note.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.dur + 0.02);
  }
}
