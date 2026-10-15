import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Car, ChevronsUp, OctagonX } from 'lucide-react';
import { GameFrame, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';
import { ROAD, TRACK, TRACK_H, TRACK_W, advanceLap, aiControl, nearestIndex, startGrid } from './racing';

const VW = 640;
const VH = 400;
const LAPS = 3;
const MAX_SPEED = 330;
const COLORS = ['#ff4f6e', '#3ee8ff', '#ffd24f', '#8dff9c'];
const NAMES = ['You', 'Zoom', 'Blaze', 'Turbo'];

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export default function RacingGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(VW, VH);
  const [best, submitBest] = useBest('racing', true);
  const [hud, setHud] = useState({ lap: 1, place: 1, over: null, count: 3 });
  const input = useRef({ l: false, r: false, g: false, b: false });
  const g = useRef(null);
  const keys = useKeys();

  const init = () => {
    const grid = startGrid();
    const cars = grid.map((p, i) => {
      const idx = 0;
      return { id: i, x: p.x, y: p.y, a: p.a, s: 0, idx, lap: 0, prog: 0, done: false, finish: 0, skill: i === 0 ? 1 : 0.9 + i * 0.025 + Math.random() * 0.03 };
    });
    // the start line is at sample 0, cars begin just behind it: count them as the lap before
    cars.forEach(c => { c.idx = TRACK.length - 2; c.lap = -1; c.prog = c.lap * TRACK.length + c.idx; });
    g.current = { cars, t: 0, count: 3.0, over: false, order: [], place: 0, time: 0 };
    setHud({ lap: 1, place: 4, over: null, count: 3 });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    const k = keys.current;
    const inp = input.current;
    if (s.count > 0) {
      s.count -= dt;
    } else if (!s.over) {
      s.t += dt;
      const me = s.cars[0];
      for (const car of s.cars) {
        let steer = 0;
        let thr = 0;
        let brake = 0;
        if (car.id === 0) {
          steer = (k.ArrowRight || k.d || k.D || inp.r ? 1 : 0) - (k.ArrowLeft || k.a || k.A || inp.l ? 1 : 0);
          thr = k.ArrowUp || k.w || k.W || inp.g ? 1 : 0;
          brake = k.ArrowDown || k.s || k.S || inp.b ? 1 : 0;
        } else {
          const ai = aiControl(car);
          steer = ai.steer; thr = ai.throttle * car.skill;
          // rubber band: back-markers push a little harder, leaders ease off
          const gap = me.prog - car.prog;
          thr *= clamp(1 + gap / 4000, 0.9, 1.1);
        }
        const near = nearestIndex(car.x, car.y, car.idx);
        const off = near.dist > ROAD / 2 + 6;
        const top = (off ? 120 : MAX_SPEED) * (car.id === 0 ? 1 : 0.94);
        if (thr) car.s += 250 * thr * dt;
        if (brake) car.s -= 420 * dt;
        car.s -= (off ? 260 : 70) * dt * (car.s > 0 ? 1 : -1);
        if (car.s > top) car.s -= 400 * dt;
        car.s = clamp(car.s, -90, top + 40);
        car.a += steer * 2.1 * clamp(Math.abs(car.s) / 110, 0, 1) * Math.sign(car.s || 1) * dt;
        car.x += Math.cos(car.a) * car.s * dt;
        car.y += Math.sin(car.a) * car.s * dt;
        car.x = clamp(car.x, 10, TRACK_W - 10); car.y = clamp(car.y, 10, TRACK_H - 10);
        const nn = nearestIndex(car.x, car.y, car.idx);
        advanceLap(car, nn.idx);
        if (!car.done && car.lap >= LAPS) { car.done = true; car.finish = s.t; s.order.push(car.id); }
      }
      // simple bumping
      for (let i = 0; i < s.cars.length; i++) for (let j = i + 1; j < s.cars.length; j++) {
        const a = s.cars[i];
        const b = s.cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 24 && d > 0) { const push = (24 - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; const m = (a.s + b.s) / 2; a.s = a.s * 0.6 + m * 0.4; b.s = b.s * 0.6 + m * 0.4; }
      }
      const rank = [...s.cars].sort((a, b) => (b.done ? 1e9 - b.finish : b.prog) - (a.done ? 1e9 - a.finish : a.prog)).findIndex(x => x.id === 0) + 1;
      if (me.done && !s.over) {
        s.over = true; s.time = me.finish; s.place = s.order.indexOf(0) + 1;
        if (s.place === 1) submitBest(Math.round(me.finish * 10));
        setHud({ lap: LAPS, place: s.place, over: s.place, count: 0 });
      } else if (Math.floor(s.t * 4) !== s.tick) { s.tick = Math.floor(s.t * 4); setHud(h => ({ ...h, lap: clamp(me.lap + 1, 1, LAPS), place: rank, count: 0 })); }
    }
    if (s.count > 0 && Math.ceil(s.count) !== s.shown) { s.shown = Math.ceil(s.count); setHud(h => ({ ...h, count: s.shown })); }
    // draw
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const me = s.cars[0];
    const cx = clamp(me.x - VW / 2, 0, TRACK_W - VW);
    const cy = clamp(me.y - VH / 2, 0, TRACK_H - VH);
    ctx.save();
    ctx.fillStyle = '#2f7d3a'; ctx.fillRect(0, 0, VW, VH);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = '#3b8c46'; for (let gx = 0; gx < TRACK_W; gx += 80) for (let gy = 0; gy < TRACK_H; gy += 80) if (((gx + gy) / 80) % 2 === 0) ctx.fillRect(gx, gy, 80, 80);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const path = () => { ctx.beginPath(); TRACK.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    path(); ctx.strokeStyle = '#d33a3a'; ctx.lineWidth = ROAD + 16; ctx.stroke();
    path(); ctx.strokeStyle = '#f2f2f2'; ctx.setLineDash([18, 18]); ctx.lineWidth = ROAD + 16; ctx.stroke(); ctx.setLineDash([]);
    path(); ctx.strokeStyle = '#4a4d5a'; ctx.lineWidth = ROAD; ctx.stroke();
    path(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([22, 26]); ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    const [sx, sy] = TRACK[0];
    const [nx, ny] = TRACK[3];
    const sa = Math.atan2(ny - sy, nx - sx);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa);
    for (let r = 0; r < 6; r++) for (let q = 0; q < 2; q++) { ctx.fillStyle = (r + q) % 2 ? '#fff' : '#111'; ctx.fillRect(q * 9 - 9, -ROAD / 2 + r * (ROAD / 6), 9, ROAD / 6); }
    ctx.restore();
    for (const car of [...s.cars].sort((a, b) => a.y - b.y)) {
      ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.a);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-14, -7, 30, 18);
      ctx.fillStyle = COLORS[car.id]; ctx.beginPath(); ctx.roundRect(-16, -9, 32, 18, 5); ctx.fill();
      ctx.fillStyle = 'rgba(20,20,40,0.85)'; ctx.fillRect(-3, -6, 9, 12);
      ctx.fillStyle = '#fff'; ctx.fillRect(12, -7, 3, 4); ctx.fillRect(12, 3, 3, 4);
      ctx.fillStyle = '#111'; ctx.fillRect(-12, -11, 8, 3); ctx.fillRect(-12, 8, 8, 3); ctx.fillRect(6, -11, 8, 3); ctx.fillRect(6, 8, 8, 3);
      if (car.id === 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-18, -11, 36, 22); }
      ctx.restore();
    }
    ctx.restore();
    // mini map + speed
    ctx.fillStyle = 'rgba(8,6,20,0.7)'; ctx.fillRect(VW - 128, 8, 120, 80);
    ctx.save(); ctx.translate(VW - 124, 12); ctx.scale(112 / TRACK_W, 72 / TRACK_H);
    ctx.strokeStyle = '#8a8fa8'; ctx.lineWidth = 34; ctx.beginPath(); TRACK.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    s.cars.forEach(car => { ctx.fillStyle = COLORS[car.id]; ctx.beginPath(); ctx.arc(car.x, car.y, 30, 0, 7); ctx.fill(); });
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '800 20px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(Math.abs(me.s) * 0.55)} km/h`, 14, VH - 16);
    if (s.count > 0) { ctx.textAlign = 'center'; ctx.font = '900 84px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(String(Math.ceil(s.count)), VW / 2, VH / 2 + 20); } else if (s.t < 0.9) { ctx.textAlign = 'center'; ctx.font = '900 70px sans-serif'; ctx.fillStyle = '#7dffa1'; ctx.fillText('GO!', VW / 2, VH / 2 + 20); }
  });

  const hold = (key) => ({
    onPointerDown: (e) => { e.preventDefault(); input.current[key] = true; },
    onPointerUp: () => { input.current[key] = false; },
    onPointerLeave: () => { input.current[key] = false; },
    onPointerCancel: () => { input.current[key] = false; },
  });
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;
  const pad = { ...ui.btn, height: 62, justifyContent: 'center', touchAction: 'none', userSelect: 'none' };

  return (
    <GameFrame title={t('gamify.games.racing', 'Turbo Racing')} Icon={Car} accent="#ff4f6e" score={`${ord(hud.place)} - ${t('gamify.games.lap', 'Lap')} ${hud.lap}/${LAPS}`} scoreLabel={t('gamify.games.race', 'Race')} best={best ? fmt(best / 10) : 0} bestLabel={t('gamify.games.bestTime', 'Best time')} onRestart={init} maxWidth={760}
      hint={t('gamify.games.racingHint', 'Race three computer drivers for 3 laps. Arrow keys or WASD: up to accelerate, down to brake, left and right to steer. Stay on the tarmac - grass slows you down.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={ui.canvas} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: hud.over === 1 ? '#ffd36b' : '#fff' }}>{ord(hud.over)} {t('gamify.games.place', 'place')}</div>
            <div style={{ opacity: 0.85 }}>{t('gamify.games.time', 'Time')}: {fmt(g.current?.time || 0)}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{(g.current?.order || []).map((id, i) => `${i + 1}. ${NAMES[id] === 'You' ? t('gamify.games.you', 'You') : NAMES[id]}`).join('   ')}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.raceAgain', 'Race again')}</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, width: '100%', maxWidth: 520 }}>
        <button style={pad} {...hold('l')} aria-label="left"><ArrowLeft size={24} /></button>
        <button style={pad} {...hold('r')} aria-label="right"><ArrowRight size={24} /></button>
        <button style={pad} {...hold('b')} aria-label="brake"><OctagonX size={22} /></button>
        <button style={{ ...pad, ...ui.btnOn }} {...hold('g')} aria-label="gas"><ChevronsUp size={26} /></button>
      </div>
    </GameFrame>
  );
}
