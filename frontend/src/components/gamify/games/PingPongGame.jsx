import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 640;
const H = 380;
const PH = 76;
const PW = 11;
const R = 8;
const WIN = 7;

export default function PingPongGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('pingpong');
  const keys = useKeys();
  const [hud, setHud] = useState({ you: 0, cpu: 0, over: null, msg: '' });
  const g = useRef(null);

  const serve = (s, dir) => {
    s.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, spin: 0 };
    s.wait = 0.9;
    s.dir = dir;
    s.cpuErr = (Math.random() - 0.5) * 70;
  };
  const init = () => {
    const s = { py: H / 2, cy: H / 2, you: 0, cpu: 0, speed: 330, done: false, trail: [] };
    serve(s, 1);
    g.current = s;
    setHud({ you: 0, cpu: 0, over: null, msg: '' });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (who) => {
    const s = g.current;
    s[who] += 1;
    setHud(h => ({ ...h, you: s.you, cpu: s.cpu }));
    if (s.you >= WIN || s.cpu >= WIN) {
      s.done = true;
      const won = s.you > s.cpu;
      if (won) submitBest(s.you - s.cpu);
      setHud(h => ({ ...h, over: won ? 'you' : 'cpu', msg: `${s.you} - ${s.cpu}` }));
    } else serve(s, who === 'you' ? 1 : -1);
    s.speed = 330;
  };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    if (!s.done) {
      const k = keys.current;
      if (k.ArrowUp || k.w || k.W) s.py -= 430 * dt;
      if (k.ArrowDown || k.s || k.S) s.py += 430 * dt;
      s.py = clamp(s.py, PH / 2, H - PH / 2);
      const b = s.ball;
      if (s.wait > 0) {
        s.wait -= dt;
        if (s.wait <= 0) { const a = (Math.random() - 0.5) * 0.7; b.vx = Math.cos(a) * s.speed * s.dir; b.vy = Math.sin(a) * s.speed; }
      } else {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
        if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy); }
        const hit = (px, py, dirOut) => {
          if (Math.abs(b.y - py) < PH / 2 + R * 0.6 && Math.abs(b.x - px) < PW / 2 + R) {
            const off = clamp((b.y - py) / (PH / 2), -1, 1);
            s.speed = Math.min(760, s.speed + 22);
            const a = off * 0.95;
            b.vx = Math.cos(a) * s.speed * dirOut; b.vy = Math.sin(a) * s.speed;
            b.x = px + dirOut * (PW / 2 + R + 0.5);
          }
        };
        if (b.vx < 0) hit(26, s.py, 1); else hit(W - 26, s.cy, -1);
        // computer paddle: tracks the ball with limited speed and a per-rally aiming error
        const target = b.vx > 0 ? b.y + s.cpuErr : H / 2;
        const maxMove = (210 + Math.min(120, (s.cpu - s.you) * -14 + 60)) * dt;
        s.cy += clamp(target - s.cy, -maxMove, maxMove);
        s.cy = clamp(s.cy, PH / 2, H - PH / 2);
        if (b.x < -R) point('cpu');
        else if (b.x > W + R) point('you');
        s.trail.push([b.x, b.y]); if (s.trail.length > 8) s.trail.shift();
      }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2a7fd0'); grad.addColorStop(1, '#17508f');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 6); ctx.lineTo(W / 2, H - 6); ctx.moveTo(6, H / 2); ctx.lineTo(W - 6, H / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; for (let y = 8; y < H; y += 14) ctx.fillRect(W / 2 - 1.5, y, 3, 8);
    s.trail.forEach(([x, y], i) => { ctx.fillStyle = `rgba(255,255,255,${i / 24})`; ctx.beginPath(); ctx.arc(x, y, R * (i / 9), 0, 7); ctx.fill(); });
    ctx.fillStyle = '#ff7a3c'; ctx.beginPath(); ctx.roundRect(26 - PW / 2, s.py - PH / 2, PW, PH, 5); ctx.fill();
    ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.roundRect(W - 26 - PW / 2, s.cy - PH / 2, PW, PH, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, R, 0, 7); ctx.fill();
    if (s.wait > 0 && !s.done) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t('gamify.games.getReady', 'Get ready'), W / 2, H / 2 - 24); }
  });

  const move = (e) => { const s = g.current; if (!s) return; s.py = clamp(canvasPoint(e, canvas.current, W, H).y, PH / 2, H - PH / 2); };

  return (
    <GameFrame title={t('gamify.games.pingpong', 'Ping Pong')} Icon={Zap} accent="#2a7fd0" score={`${hud.you} - ${hud.cpu}`} scoreLabel={t('gamify.games.youCpu', 'You - CPU')} best={best} bestLabel={t('gamify.games.bestMargin', 'Best margin')} onRestart={init}
      hint={t('gamify.games.pingpongHint', 'Move your finger or mouse up and down (or use W/S or the arrow keys). First to 7 wins - the ball speeds up every hit.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={ui.canvas} onPointerMove={move} onPointerDown={move} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: hud.over === 'you' ? '#7dffa1' : '#ff8a8a' }}>{hud.over === 'you' ? t('gamify.games.youWin', 'You win!') : t('gamify.games.cpuWins', 'Computer wins')}</div>
            <div style={{ opacity: 0.8 }}>{hud.msg}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.rematch', 'Rematch')}</button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
