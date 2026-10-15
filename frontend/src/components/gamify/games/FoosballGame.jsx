import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Goal } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 720;
const H = 400;
const M = 22; // wall thickness
const GOAL = 64; // half goal-mouth
const BR = 9;
const MR = 13;
const WIN = 5;
// Real foosball order from the left: GK, DEF, ATT, MID | MID, ATT, DEF, GK
const RODS = [
  { x: 52, n: 1, sp: 0, side: 'you' }, { x: 132, n: 2, sp: 130, side: 'you' }, { x: 212, n: 3, sp: 104, side: 'cpu' }, { x: 292, n: 5, sp: 68, side: 'you' },
  { x: 428, n: 5, sp: 68, side: 'cpu' }, { x: 508, n: 3, sp: 104, side: 'you' }, { x: 588, n: 2, sp: 130, side: 'cpu' }, { x: 668, n: 1, sp: 0, side: 'cpu' },
];

const rodRange = (r) => {
  const half = ((r.n - 1) * r.sp) / 2;
  return [M + MR + half, H - M - MR - half];
};
const menOf = (r) => Array.from({ length: r.n }, (_, i) => ({ x: r.x + (r.side === 'you' ? 1 : -1) * r.kick * 18, y: r.y + (i - (r.n - 1) / 2) * r.sp }));

export default function FoosballGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('foosball');
  const [hud, setHud] = useState({ you: 0, cpu: 0, over: null, flash: '' });
  const g = useRef(null);
  const keys = useKeys((k) => {
    const s = g.current;
    if (!s) return;
    if (k === ' ') kick(s.active);
    const idx = ['1', '2', '3', '4'].indexOf(k);
    if (idx >= 0) s.active = s.rods.findIndex(r => r === s.rods.filter(q => q.side === 'you')[idx]);
  });

  const reset = (s, dir) => {
    s.ball = { x: W / 2, y: H / 2, vx: dir * 150, vy: (Math.random() - 0.5) * 120, still: 0 };
  };
  const init = () => {
    const rods = RODS.map(r => ({ ...r, y: H / 2, ty: H / 2, kick: 0, kicking: 0, cool: 0, vy: 0 }));
    const s = { rods, active: 3, you: 0, cpu: 0, done: false, flash: 0 };
    reset(s, Math.random() < 0.5 ? 1 : -1);
    g.current = s;
    setHud({ you: 0, cpu: 0, over: null, flash: '' });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function kick(i) {
    const r = g.current?.rods[i];
    if (r && r.kicking <= 0 && r.cool <= 0) { r.kicking = 0.2; r.cool = 0.25; }
  }

  const goal = (who) => {
    const s = g.current;
    s[who] += 1;
    s.flash = 1.2;
    const over = s.you >= WIN || s.cpu >= WIN;
    if (over) { s.done = true; if (s.you > s.cpu) submitBest(s.you - s.cpu); }
    setHud({ you: s.you, cpu: s.cpu, over: over ? (s.you > s.cpu ? 'you' : 'cpu') : null, flash: who === 'you' ? t('gamify.games.goal', 'GOAL!') : t('gamify.games.cpuGoal', 'Computer scores') });
    reset(s, who === 'you' ? -1 : 1);
  };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    const b = s.ball;
    if (!s.done) {
      const k = keys.current;
      const act = s.rods[s.active];
      if (k.ArrowUp || k.w || k.W) act.ty -= 520 * dt;
      if (k.ArrowDown || k.s || k.S) act.ty += 520 * dt;
      for (const r of s.rods) {
        const [lo, hi] = rodRange(r);
        if (r.side === 'cpu') {
          const dirOut = -1;
          const near = Math.abs(b.x - r.x) < 190;
          if (near) {
            let bestC = r.y;
            let bestD = 1e9;
            for (let i = 0; i < r.n; i++) { const need = b.y - (i - (r.n - 1) / 2) * r.sp; if (Math.abs(need - r.y) < bestD) { bestD = Math.abs(need - r.y); bestC = need; } }
            r.ty = bestC + (Math.sin(performance.now() / 700 + r.x) * 9);
            const men = menOf(r);
            const front = men.some(m => Math.abs(m.y - b.y) < 17 && (b.x - m.x) * dirOut > -4 && (b.x - m.x) * dirOut < 34);
            if (front && Math.random() < dt * 5) kick(s.rods.indexOf(r));
          } else r.ty = H / 2;
        }
        r.ty = clamp(r.ty, lo, hi);
        const prev = r.y;
        const maxMove = (r.side === 'cpu' ? 360 : 760) * dt;
        r.y += clamp(r.ty - r.y, -maxMove, maxMove);
        r.vy = (r.y - prev) / Math.max(dt, 0.001);
        r.cool = Math.max(0, r.cool - dt);
        r.kicking = Math.max(0, r.kicking - dt);
        r.kick = r.kicking > 0 ? Math.sin((1 - r.kicking / 0.2) * Math.PI) : 0;
      }
      // ball
      const sub = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 6) || 1;
      const h = dt / sub;
      for (let st = 0; st < sub; st++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.y < M + BR) { b.y = M + BR; b.vy = Math.abs(b.vy) * 0.92; }
        if (b.y > H - M - BR) { b.y = H - M - BR; b.vy = -Math.abs(b.vy) * 0.92; }
        const inMouth = Math.abs(b.y - H / 2) < GOAL;
        if (b.x < M + BR) { if (inMouth && b.x < M - 2) { goal('cpu'); break; } if (!inMouth) { b.x = M + BR; b.vx = Math.abs(b.vx) * 0.9; } }
        if (b.x > W - M - BR) { if (inMouth && b.x > W - M + 2) { goal('you'); break; } if (!inMouth) { b.x = W - M - BR; b.vx = -Math.abs(b.vx) * 0.9; } }
        for (const r of s.rods) {
          if (Math.abs(b.x - r.x) > 40) continue;
          for (const m of menOf(r)) {
            const dx = b.x - m.x;
            const dy = b.y - m.y;
            const d = Math.hypot(dx, dy);
            if (d < BR + MR && d > 0) {
              const nx = dx / d;
              const ny = dy / d;
              b.x = m.x + nx * (BR + MR + 0.3); b.y = m.y + ny * (BR + MR + 0.3);
              const rel = b.vx * nx + (b.vy - r.vy) * ny;
              if (rel < 0) { b.vx -= 1.85 * rel * nx; b.vy -= 1.85 * rel * ny; }
              if (r.kick > 0.25) { const f = r.side === 'you' ? 1 : -1; b.vx = f * Math.max(Math.abs(b.vx), 560); b.vy += (Math.random() - 0.5) * 140 + r.vy * 0.25; }
            }
          }
        }
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 920) { b.vx *= 920 / sp; b.vy *= 920 / sp; }
      b.vx *= 1 - 0.12 * dt; b.vy *= 1 - 0.12 * dt;
      b.still = sp < 30 ? b.still + dt : 0;
      if (b.still > 1.2) { b.vx += (Math.random() - 0.5) * 260; b.vy += (Math.random() - 0.5) * 260; b.still = 0; }
      s.flash = Math.max(0, s.flash - dt);
    }
    // draw
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#3a2417'; ctx.fillRect(0, 0, W, H);
    const gr = ctx.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#1a8a52'); gr.addColorStop(0.5, '#1fa062'); gr.addColorStop(1, '#1a8a52');
    ctx.fillStyle = gr; ctx.fillRect(M, M, W - M * 2, H - M * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, M); ctx.lineTo(W / 2, H - M); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 46, 0, 7); ctx.stroke();
    ctx.strokeRect(M, H / 2 - 92, 70, 184); ctx.strokeRect(W - M - 70, H / 2 - 92, 70, 184);
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, H / 2 - GOAL, M, GOAL * 2); ctx.fillRect(W - M, H / 2 - GOAL, M, GOAL * 2);
    for (let i = 0; i < s.rods.length; i++) {
      const r = s.rods[i];
      ctx.fillStyle = i === s.active ? '#fff3c4' : '#cfd3dd';
      ctx.fillRect(r.x - 3, M - 8, 6, H - M * 2 + 16);
      for (const m of menOf(r)) {
        ctx.fillStyle = r.side === 'you' ? '#ff7a3c' : '#5aa8ff';
        ctx.beginPath(); ctx.arc(m.x, m.y, MR, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(m.x - 3, m.y - 3, 4, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(b.x + 2, b.y + 3, BR, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, 7); ctx.fill();
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, s.flash)})`; ctx.font = '900 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hud.flash || '', W / 2, H / 2 - 60); }
  });

  const move = (e) => {
    const s = g.current;
    if (!s) return;
    const p = canvasPoint(e, canvas.current, W, H);
    let bi = s.active;
    let bd = 1e9;
    s.rods.forEach((r, i) => { if (r.side === 'you' && Math.abs(r.x - p.x) < bd) { bd = Math.abs(r.x - p.x); bi = i; } });
    s.active = bi;
    s.rods[bi].ty = p.y;
  };
  const down = (e) => { move(e); const s = g.current; if (s) kick(s.active); };

  return (
    <GameFrame title={t('gamify.games.foosball', 'Foosball')} Icon={Goal} accent="#ff7a3c" score={`${hud.you} - ${hud.cpu}`} scoreLabel={t('gamify.games.youCpu', 'You - CPU')} best={best} bestLabel={t('gamify.games.bestMargin', 'Best margin')} onRestart={init} maxWidth={820}
      hint={t('gamify.games.foosHint', 'Slide over a rod to grab it and move up and down. Tap or press space to kick. You are orange, first to 5 goals wins.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={ui.canvas} onPointerMove={move} onPointerDown={down} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: hud.over === 'you' ? '#7dffa1' : '#ff8a8a' }}>{hud.over === 'you' ? t('gamify.games.youWin', 'You win!') : t('gamify.games.cpuWins', 'Computer wins')}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.rematch', 'Rematch')}</button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
