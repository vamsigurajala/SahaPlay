import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Blocks } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 480;
const H = 540;
const PW = 84;
const PH = 12;
const COLS = 9;
const ROWS = 6;
const BW = (W - 20) / COLS;
const BH = 22;
const ROW_COLORS = ['#ff5a6e', '#ff9a3c', '#ffd24f', '#6ee37a', '#3ee8ff', '#b04fff'];

const makeBricks = () => Array.from({ length: ROWS * COLS }, (_, i) => ({ x: 10 + (i % COLS) * BW, y: 60 + Math.floor(i / COLS) * (BH + 4), c: ROW_COLORS[Math.floor(i / COLS)], pts: (ROWS - Math.floor(i / COLS)) * 10, alive: true }));

export default function BreakoutGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('breakout');
  const [hud, setHud] = useState({ score: 0, lives: 3, over: null });
  const g = useRef(null);
  const keys = useKeys((k) => { if (k === ' ') launch(); });

  const resetBall = (s) => { s.ball = { x: s.px, y: H - 52, vx: 0, vy: 0, stuck: true }; };
  const init = () => {
    const s = { px: W / 2, bricks: makeBricks(), score: 0, lives: 3, level: 1, speed: 330, done: false };
    resetBall(s);
    g.current = s;
    setHud({ score: 0, lives: 3, over: null });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function launch() {
    const s = g.current;
    if (s?.ball.stuck && !s.done) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6; s.ball.vx = Math.cos(a) * s.speed; s.ball.vy = Math.sin(a) * s.speed; s.ball.stuck = false; }
  }

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    const k = keys.current;
    if (k.ArrowLeft || k.a) s.px -= 520 * dt;
    if (k.ArrowRight || k.d) s.px += 520 * dt;
    s.px = clamp(s.px, PW / 2, W - PW / 2);
    const b = s.ball;
    if (!s.done) {
      if (b.stuck) { b.x = s.px; b.y = H - 52; } else {
        const sub = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 5) || 1;
        for (let i = 0; i < sub; i++) {
          b.x += (b.vx * dt) / sub; b.y += (b.vy * dt) / sub;
          if (b.x < 7) { b.x = 7; b.vx = Math.abs(b.vx); }
          if (b.x > W - 7) { b.x = W - 7; b.vx = -Math.abs(b.vx); }
          if (b.y < 7) { b.y = 7; b.vy = Math.abs(b.vy); }
          if (b.vy > 0 && b.y > H - 40 - 7 && b.y < H - 40 + PH && Math.abs(b.x - s.px) < PW / 2 + 6) {
            const off = clamp((b.x - s.px) / (PW / 2), -1, 1);
            const sp = Math.hypot(b.vx, b.vy);
            const a = -Math.PI / 2 + off * 1.05;
            b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.y = H - 40 - 7;
          }
          for (const br of s.bricks) {
            if (!br.alive) continue;
            if (b.x > br.x - 5 && b.x < br.x + BW - 1 + 5 && b.y > br.y - 5 && b.y < br.y + BH + 5) {
              br.alive = false; s.score += br.pts;
              const fromSide = Math.min(b.x - br.x, br.x + BW - b.x) < Math.min(b.y - br.y, br.y + BH - b.y);
              if (fromSide) b.vx = -b.vx; else b.vy = -b.vy;
              const h0 = Math.hypot(b.vx, b.vy) || 1; const sp = h0 * 1.012; b.vx = (b.vx / h0) * sp; b.vy = (b.vy / h0) * sp;
              setHud(h => ({ ...h, score: s.score }));
              break;
            }
          }
        }
        if (b.y > H + 12) {
          s.lives -= 1;
          if (s.lives <= 0) { s.done = true; submitBest(s.score); setHud({ score: s.score, lives: 0, over: 'lose' }); } else { resetBall(s); setHud(h => ({ ...h, lives: s.lives })); }
        }
        if (s.bricks.every(x => !x.alive)) {
          s.level += 1; s.speed += 50; s.bricks = makeBricks(); resetBall(s); s.score += 100;
          setHud(h => ({ ...h, score: s.score }));
        }
      }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#12082e'); bg.addColorStop(1, '#070416');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const br of s.bricks) if (br.alive) { ctx.fillStyle = br.c; ctx.beginPath(); ctx.roundRect(br.x, br.y, BW - 3, BH, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(br.x + 3, br.y + 3, BW - 9, 4); }
    ctx.fillStyle = '#e8ecf5'; ctx.beginPath(); ctx.roundRect(s.px - PW / 2, H - 40, PW, PH, 6); ctx.fill();
    ctx.fillStyle = '#ff7a3c'; ctx.fillRect(s.px - PW / 2 + 4, H - 38, PW - 8, 3);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${t('gamify.games.level', 'Level')} ${s.level}`, 12, 24); ctx.textAlign = 'right'; ctx.fillText(`${'♥'.repeat(Math.max(0, s.lives))}`, W - 12, 24);
    if (b.stuck && !s.done) { ctx.textAlign = 'center'; ctx.font = 'bold 17px sans-serif'; ctx.fillText(t('gamify.games.tapLaunch', 'Tap or press space to launch'), W / 2, H - 100); }
  });

  const move = (e) => { const s = g.current; if (s) s.px = clamp(canvasPoint(e, canvas.current, W, H).x, PW / 2, W - PW / 2); };

  return (
    <GameFrame title={t('gamify.games.breakout', 'Brick Breaker')} Icon={Blocks} accent="#b04fff" score={hud.score} best={best} onRestart={init} maxWidth={500} hint={t('gamify.games.breakoutHint', 'Slide the paddle with your finger, mouse or the arrow keys. Clear every brick - each level is faster.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={ui.canvas} onPointerMove={move} onPointerDown={(e) => { move(e); launch(); }} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{t('gamify.games.gameOver', 'Game over')}</div>
            <div style={{ opacity: 0.85 }}>{t('gamify.games.score', 'Score')}: {hud.score}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
