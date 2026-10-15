import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Disc } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useRaf } from './shared';

const W = 640;
const H = 380;
const PR = 11; // puck radius
const MR = 28; // mallet radius
const GOAL = 62;
const WIN = 7;

export default function AirHockeyGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('airhockey');
  const [hud, setHud] = useState({ you: 0, cpu: 0, over: null });
  const g = useRef(null);

  const serve = (s, dir) => { s.puck = { x: W / 2 + dir * 80, y: H / 2, vx: 0, vy: 0 }; s.hold = 0.8; };
  const init = () => {
    const s = { me: { x: 90, y: H / 2, vx: 0, vy: 0 }, cpu: { x: W - 90, y: H / 2, vx: 0, vy: 0 }, you: 0, cpu_: 0, done: false, flash: 0 };
    serve(s, -1);
    g.current = s;
    setHud({ you: 0, cpu: 0, over: null });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goal = (who) => {
    const s = g.current;
    if (who === 'you') s.you += 1; else s.cpu_ += 1;
    const over = s.you >= WIN || s.cpu_ >= WIN;
    if (over) { s.done = true; if (s.you > s.cpu_) submitBest(s.you - s.cpu_); }
    setHud({ you: s.you, cpu: s.cpu_, over: over ? (s.you > s.cpu_ ? 'you' : 'cpu') : null });
    serve(s, who === 'you' ? 1 : -1);
    s.flash = 0.8;
  };

  const hit = (m, p) => {
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d < MR + PR && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      p.x = m.x + nx * (MR + PR + 0.5); p.y = m.y + ny * (MR + PR + 0.5);
      const rel = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
      if (rel < 0) { p.vx -= 2 * rel * nx; p.vy -= 2 * rel * ny; }
      p.vx += m.vx * 0.35; p.vy += m.vy * 0.35;
    }
  };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    if (!s.done) {
      const p = s.puck;
      s.hold = Math.max(0, s.hold - dt);
      // computer mallet
      const cp = s.cpu;
      let tx;
      let ty;
      if (p.x > W / 2 + 10 && s.hold <= 0) { tx = p.x - 24; ty = p.y + clamp(p.vy * 0.05, -20, 20); if (Math.abs(p.vx) < 30 && p.x < W - 60) { tx = p.x + 6; } } else { tx = W - 70; ty = H / 2 + (p.y - H / 2) * 0.35; }
      const sp = 330 + Math.min(120, (s.you - s.cpu_) * 22);
      const ox = cp.x;
      const oy = cp.y;
      const ddx = tx - cp.x;
      const ddy = ty - cp.y;
      const dd = Math.hypot(ddx, ddy) || 1;
      const mv = Math.min(dd, sp * dt);
      cp.x = clamp(cp.x + (ddx / dd) * mv, W / 2 + MR, W - MR); cp.y = clamp(cp.y + (ddy / dd) * mv, MR, H - MR);
      cp.vx = (cp.x - ox) / dt; cp.vy = (cp.y - oy) / dt;
      if (s.hold <= 0) {
        const n = Math.ceil((Math.hypot(p.vx, p.vy) * dt) / 6) || 1;
        for (let i = 0; i < n; i++) {
          p.x += (p.vx * dt) / n; p.y += (p.vy * dt) / n;
          if (p.y < PR) { p.y = PR; p.vy = Math.abs(p.vy) * 0.95; }
          if (p.y > H - PR) { p.y = H - PR; p.vy = -Math.abs(p.vy) * 0.95; }
          const inMouth = Math.abs(p.y - H / 2) < GOAL;
          if (p.x < PR) { if (inMouth) { goal('cpu'); break; } p.x = PR; p.vx = Math.abs(p.vx) * 0.95; }
          if (p.x > W - PR) { if (inMouth) { goal('you'); break; } p.x = W - PR; p.vx = -Math.abs(p.vx) * 0.95; }
          hit(s.me, p); hit(s.cpu, p);
        }
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 900) { p.vx *= 900 / speed; p.vy *= 900 / speed; }
        p.vx *= 1 - 0.28 * dt; p.vy *= 1 - 0.28 * dt;
      }
      s.flash = Math.max(0, s.flash - dt);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, '#103a6a'); bg.addColorStop(1, '#1c2a78');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2, 4); ctx.lineTo(W / 2, H - 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 50, 0, 7); ctx.stroke();
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, H / 2 - GOAL, 8, GOAL * 2); ctx.fillRect(W - 8, H / 2 - GOAL, 8, GOAL * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, H / 2, GOAL + 30, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.beginPath(); ctx.arc(W, H / 2, GOAL + 30, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    const mallet = (m, col) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(m.x + 3, m.y + 4, MR, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, MR, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(m.x, m.y, MR * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, MR * 0.22, 0, 7); ctx.fill();
    };
    mallet(s.me, '#ff7a3c'); mallet(s.cpu, '#5aa8ff');
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(s.puck.x, s.puck.y, PR, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.stroke();
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  });

  const move = (e) => {
    const s = g.current;
    if (!s || s.done) return;
    const p = canvasPoint(e, canvas.current, W, H);
    const nx = clamp(p.x, MR, W / 2 - MR);
    const ny = clamp(p.y, MR, H - MR);
    const dt = 1 / 60;
    s.me.vx = (nx - s.me.x) / dt * 0.6; s.me.vy = (ny - s.me.y) / dt * 0.6;
    s.me.x = nx; s.me.y = ny;
  };
  useEffect(() => { const id = setInterval(() => { const s = g.current; if (s) { s.me.vx *= 0.5; s.me.vy *= 0.5; } }, 40); return () => clearInterval(id); }, []);

  return (
    <GameFrame title={t('gamify.games.airhockey', 'Air Hockey')} Icon={Disc} accent="#2a7fd0" score={`${hud.you} - ${hud.cpu}`} scoreLabel={t('gamify.games.youCpu', 'You - CPU')} best={best} bestLabel={t('gamify.games.bestMargin', 'Best margin')} onRestart={init}
      hint={t('gamify.games.airHint', 'Slide your orange mallet on the left half with your finger or mouse and smash the puck into the computer\'s goal. First to 7.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={{ ...ui.canvas, cursor: 'none' }} onPointerMove={move} onPointerDown={move} />
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
