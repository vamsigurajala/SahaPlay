import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Disc3, Eraser, Pause, Play } from 'lucide-react';
import { GameFrame, ui, useCanvas, useRaf } from './shared';

// A small beat studio: six drum/synth pads you can play live plus a 16-step
// sequencer. All sounds are synthesised with the Web Audio API (no audio files).

const TRACKS = [
  { id: 'kick', label: 'Kick', color: '#ff5a6e' },
  { id: 'snare', label: 'Snare', color: '#ffd24f' },
  { id: 'hat', label: 'Hi-hat', color: '#3ee8ff' },
  { id: 'clap', label: 'Clap', color: '#b04fff' },
  { id: 'bass', label: 'Bass', color: '#6ee37a' },
  { id: 'synth', label: 'Synth', color: '#ff9a3c' },
];
const row = (s) => Array.from({ length: 16 }, (_, i) => s[i] === 'x');
const PRESETS = {
  house: { bpm: 124, p: [row('x...x...x...x...'), row('....x.......x...'), row('..x...x...x...x.'), row('....x.......x...'), row('x..xx..xx..xx..x'), row('..x.....x.x.....')] },
  hiphop: { bpm: 90, p: [row('x.....x...x.....'), row('....x.......x...'), row('x.x.x.x.x.x.x.xx'), row('................'), row('x.....x.....x...'), row('......x.........')] },
  techno: { bpm: 136, p: [row('x...x...x...x...'), row('................'), row('.x.x.x.x.x.x.x.x'), row('............x...'), row('.xx..xx..xx..xx.'), row('x..x..x...x..x..')] },
};
const BASS = [55, 55, 65.41, 73.42, 55, 82.41, 65.41, 49];
const LEAD = [220, 261.63, 329.63, 392, 329.63, 261.63, 440, 392];

function makeNoise(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function play(ctx, out, noise, id, t, step = 0) {
  const env = (g, a, peak, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
  const noiseHit = (type, freq, peak, dur, at = 0) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(peak, t + at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t + at); s.stop(t + at + dur + 0.05);
  };
  if (id === 'kick') {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    env(g, 0.002, 1, 0.34); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
  } else if (id === 'snare') {
    noiseHit('bandpass', 1900, 0.7, 0.18);
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 190; env(g, 0.002, 0.5, 0.12); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
  } else if (id === 'hat') noiseHit('highpass', 7500, 0.35, 0.05);
  else if (id === 'clap') { noiseHit('bandpass', 1300, 0.6, 0.02, 0); noiseHit('bandpass', 1300, 0.6, 0.02, 0.014); noiseHit('bandpass', 1300, 0.7, 0.16, 0.03); } else if (id === 'bass') {
    const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = BASS[Math.floor(step / 2) % BASS.length]; f.type = 'lowpass'; f.frequency.value = 420;
    env(g, 0.01, 0.55, 0.26); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
  } else if (id === 'synth') {
    const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = LEAD[step % LEAD.length]; f.type = 'lowpass'; f.frequency.value = 2400;
    env(g, 0.01, 0.16, 0.2); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
  }
}

export default function DjBooth() {
  const { t } = useTranslation();
  const canvas = useCanvas(560, 110);
  const [pattern, setPattern] = useState(PRESETS.house.p);
  const [bpm, setBpm] = useState(PRESETS.house.bpm);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const audio = useRef(null);
  const sched = useRef({ next: 0, i: 0, timer: 0 });
  const patRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  patRef.current = pattern; bpmRef.current = bpm;

  const ensure = () => {
    if (!audio.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const master = ctx.createGain(); master.gain.value = 0.8;
      const an = ctx.createAnalyser(); an.fftSize = 128;
      master.connect(an); an.connect(ctx.destination);
      audio.current = { ctx, master, an, noise: makeNoise(ctx), data: new Uint8Array(an.frequencyBinCount) };
    }
    if (audio.current.ctx.state === 'suspended') audio.current.ctx.resume();
    return audio.current;
  };

  const stop = () => { clearInterval(sched.current.timer); setPlaying(false); setStep(-1); };
  const start = () => {
    const a = ensure();
    if (!a) return;
    sched.current.i = 0; sched.current.next = a.ctx.currentTime + 0.06;
    clearInterval(sched.current.timer);
    sched.current.timer = setInterval(() => {
      const sc = sched.current;
      while (sc.next < a.ctx.currentTime + 0.12) {
        const i = sc.i;
        patRef.current.forEach((r, ti) => { if (r[i]) play(a.ctx, a.master, a.noise, TRACKS[ti].id, sc.next, i); });
        const delay = Math.max(0, (sc.next - a.ctx.currentTime) * 1000);
        setTimeout(() => setStep(i), delay);
        sc.next += 60 / bpmRef.current / 4;
        sc.i = (i + 1) % 16;
      }
    }, 25);
    setPlaying(true);
  };
  useEffect(() => () => { clearInterval(sched.current.timer); try { audio.current?.ctx.close(); } catch { /* already closed */ } }, []);

  const hit = (ti) => { const a = ensure(); if (a) play(a.ctx, a.master, a.noise, TRACKS[ti].id, a.ctx.currentTime + 0.005, Math.floor(Math.random() * 8)); };
  const toggle = (ti, i) => { setPattern(p => p.map((r, k) => (k === ti ? r.map((v, j) => (j === i ? !v : v)) : r))); if (!patRef.current[ti][i]) hit(ti); };
  const loadPreset = (k) => { setPattern(PRESETS[k].p.map(r => r.slice())); setBpm(PRESETS[k].bpm); };

  useRaf(() => {
    const c = canvas.current;
    const a = audio.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 560, 110);
    const bars = 28;
    if (a) a.an.getByteFrequencyData(a.data);
    for (let i = 0; i < bars; i++) {
      const v = a ? a.data[Math.floor((i / bars) * 40)] / 255 : 0.05;
      const h = 6 + v * 98;
      ctx.fillStyle = `hsl(${300 - i * 7},90%,${50 + v * 15}%)`;
      ctx.beginPath(); ctx.roundRect(i * 20 + 3, 108 - h, 14, h, 4); ctx.fill();
    }
  });

  return (
    <GameFrame title={t('gamify.games.dj', 'DJ Booth')} Icon={Disc3} accent="#e0529f" maxWidth={680}
      hint={t('gamify.games.djHint', 'Tap the big pads to play live, or switch squares on in the grid and press play to build a beat. Pick a preset to start.')}>
      <canvas ref={canvas} style={{ ...ui.canvas, background: 'rgba(8,6,20,0.9)', boxShadow: 'none', maxWidth: 560 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <button style={{ ...ui.btn, ...ui.btnOn }} onClick={playing ? stop : start}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? t('gamify.games.stop', 'Stop') : t('gamify.games.play', 'Play')}</button>
        {Object.keys(PRESETS).map(k => <button key={k} style={ui.btn} onClick={() => loadPreset(k)}>{{ house: 'House', hiphop: 'Hip-hop', techno: 'Techno' }[k]}</button>)}
        <button style={ui.btn} onClick={() => setPattern(TRACKS.map(() => Array(16).fill(false)))}><Eraser size={14} />{t('gamify.games.clear', 'Clear')}</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13 }}>BPM {bpm}<input type="range" min="70" max="170" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, width: '100%', maxWidth: 560 }}>
        {TRACKS.map((tr, ti) => (
          <button key={tr.id} onPointerDown={(e) => { e.preventDefault(); hit(ti); }} style={{ height: 64, borderRadius: 14, border: '2px solid rgba(255,255,255,0.25)', background: `radial-gradient(circle at 35% 30%, ${tr.color}, #1a1030)`, color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer', touchAction: 'none' }}>{tr.label}</button>
        ))}
      </div>
      <div style={{ ...ui.panel, width: '100%', maxWidth: 640, overflowX: 'auto' }}>
        {TRACKS.map((tr, ti) => (
          <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ width: 52, fontSize: 11, fontWeight: 800, color: tr.color, flex: 'none' }}>{tr.label}</span>
            {pattern[ti].map((on, i) => (
              <button key={i} onClick={() => toggle(ti, i)} style={{ flex: 'none', width: 28, height: 28, borderRadius: 6, border: step === i ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)', background: on ? tr.color : (i % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'), cursor: 'pointer', padding: 0, opacity: on ? 1 : 0.9 }} aria-label={`${tr.label} ${i + 1}`} />
            ))}
          </div>
        ))}
      </div>
    </GameFrame>
  );
}
