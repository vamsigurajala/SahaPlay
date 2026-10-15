import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 480;
const H = 560;
const COLS = 8;
const ROWS = 5;
const ROW_COLORS = ['#ff5a6e', '#ff9a3c', '#ffd24f', '#6ee37a', '#3ee8ff'];

const makeWave = (wave) => ({
  aliens: Array.from({ length: ROWS * COLS }, (_, i) => ({ c: i % COLS, r: Math.floor(i / COLS), alive: true })),
  ox: 30, oy: 70, dir: 1, speed: 26 + wave * 7, acc: 0,
});

export default function InvadersGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('invaders');
  const [hud, setHud] = useState({ score: 0, lives: 3, over: false });
  const g = useRef(null);
  const keys = useKeys((k) => { if (k === ' ') fire(); });

  const init = () => {
    g.current = { px: W / 2, bullets: [], enemy: [], wave: 1, score: 0, lives: 3, cool: 0, hit: 0, over: false, ...{ w: makeWave(1) } };
    setHud({ score: 0, lives: 3, over: false });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function fire() {
    const s = g.current;
    if (!s || s.over || s.cool > 0) return;
    s.bullets.push({ x: s.px, y: H - 60 });
    s.cool = 0.32;
  }

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    const k = keys.current;
    if (!s.over) {
      if (k.ArrowLeft || k.a) s.px -= 340 * dt;
      if (k.ArrowRight || k.d) s.px += 340 * dt;
      s.px = clamp(s.px, 22, W - 22);
      s.cool -= dt; s.hit -= dt;
      const w = s.w;
      const live = w.aliens.filter(a => a.alive);
      const sp = w.speed * (1 + (1 - live.length / (ROWS * COLS)) * 2.2);
      const cols = live.map(a => w.ox + a.c * 46);
      const minX = Math.min(...cols);
      const maxX = Math.max(...cols) + 30;
      w.ox += w.dir * sp * dt;
      if ((w.dir > 0 && maxX + w.dir * sp * dt > W - 12) || (w.dir < 0 && minX + w.dir * sp * dt < 12)) { w.dir *= -1; w.oy += 16; }
      if (Math.random() < dt * (0.9 + s.wave * 0.25) && live.length) {
        const a = live[Math.floor(Math.random() * live.length)];
        s.enemy.push({ x: w.ox + a.c * 46 + 15, y: w.oy + a.r * 38 + 24 });
      }
      for (const b of s.bullets) b.y -= 520 * dt;
      for (const e of s.enemy) e.y += (220 + s.wave * 14) * dt;
      for (const b of s.bullets) {
        for (const a of live) {
          const ax = w.ox + a.c * 46;
          const ay = w.oy + a.r * 38;
          if (a.alive && b.x > ax - 2 && b.x < ax + 32 && b.y > ay && b.y < ay + 26) { a.alive = false; b.y = -99; s.score += (ROWS - a.r) * 10; setHud(h => ({ ...h, score: s.score })); }
        }
      }
      s.bullets = s.bullets.filter(b => b.y > -10);
      for (const e of s.enemy) {
        if (e.y > H - 62 && e.y < H - 34 && Math.abs(e.x - s.px) < 22) {
          e.y = H + 99; s.lives -= 1; s.hit = 0.6;
          if (s.lives <= 0) { s.over = true; submitBest(s.score); }
          setHud(h => ({ ...h, lives: Math.max(0, s.lives), over: s.over }));
        }
      }
      s.enemy = s.enemy.filter(e => e.y < H + 20);
      if (live.some(a => w.oy + a.r * 38 + 26 > H - 80)) { s.over = true; submitBest(s.score); setHud(h => ({ ...h, lives: 0, over: true })); }
      if (!w.aliens.some(a => a.alive)) { s.wave += 1; s.w = makeWave(s.wave); s.bullets = []; s.enemy = []; s.score += 50; setHud(h => ({ ...h, score: s.score })); }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05030f'); bg.addColorStop(1, '#16093a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53 + (performance.now() / 40) * (0.2 + (i % 3) * 0.2)) % H, 1.5, 1.5);
    for (const a of s.w.aliens) {
      if (!a.alive) continue;
      const x = s.w.ox + a.c * 46;
      const y = s.w.oy + a.r * 38;
      const legs = Math.floor(performance.now() / 380) % 2;
      ctx.fillStyle = ROW_COLORS[a.r];
      ctx.beginPath(); ctx.roundRect(x + 2, y + 4, 28, 16, 6); ctx.fill();
      ctx.fillRect(x + 6, y + 18, 5, legs ? 8 : 5); ctx.fillRect(x + 21, y + 18, 5, legs ? 8 : 5);
      ctx.fillRect(x + 8, y, 3, 6); ctx.fillRect(x + 21, y, 3, 6);
      ctx.fillStyle = '#10062a'; ctx.fillRect(x + 8, y + 9, 5, 5); ctx.fillRect(x + 19, y + 9, 5, 5);
    }
    ctx.fillStyle = '#ffd36b'; for (const b of s.bullets) ctx.fillRect(b.x - 2, b.y, 4, 14);
    ctx.fillStyle = '#ff5a6e'; for (const e of s.enemy) ctx.fillRect(e.x - 2, e.y, 4, 14);
    ctx.fillStyle = s.hit > 0 && Math.floor(s.hit * 14) % 2 ? '#ff5a6e' : '#8dff9c';
    ctx.beginPath(); ctx.moveTo(s.px, H - 62); ctx.lineTo(s.px + 22, H - 36); ctx.lineTo(s.px + 8, H - 40); ctx.lineTo(s.px - 8, H - 40); ctx.lineTo(s.px - 22, H - 36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${t('gamify.games.wave', 'Wave')} ${s.wave}`, 12, 24); ctx.textAlign = 'right'; ctx.fillText('♥'.repeat(Math.max(0, s.lives)), W - 12, 24);
  });

  const move = (e) => { const s = g.current; if (s) s.px = clamp(canvasPoint(e, canvas.current, W, H).x, 22, W - 22); };
  const autoFire = useRef(0);
  useEffect(() => () => clearInterval(autoFire.current), []);

  return (
    <GameFrame title={t('gamify.games.invaders', 'Star Invaders')} Icon={Rocket} accent="#3ee8ff" score={hud.score} best={best} onRestart={init} maxWidth={500} hint={t('gamify.games.invadersHint', 'Drag to steer (or use the arrow keys). Tap to shoot - or hold the fire button. Stop the invaders before they reach you.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={ui.canvas} onPointerMove={move} onPointerDown={(e) => { move(e); fire(); }} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{t('gamify.games.gameOver', 'Game over')}</div>
            <div style={{ opacity: 0.85 }}>{t('gamify.games.score', 'Score')}: {hud.score}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
          </div>
        )}
      </div>
      <button style={{ ...ui.btn, ...ui.btnOn, height: 52, padding: '0 36px', justifyContent: 'center', touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); fire(); clearInterval(autoFire.current); autoFire.current = setInterval(fire, 120); }}
        onPointerUp={() => clearInterval(autoFire.current)} onPointerLeave={() => clearInterval(autoFire.current)}>
        {t('gamify.games.fire', 'Fire')}
      </button>
    </GameFrame>
  );
}
