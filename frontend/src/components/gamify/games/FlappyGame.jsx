import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bird } from 'lucide-react';
import { GameFrame, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 380;
const H = 560;
const GAP = 150;
const PIPE_W = 62;
const GROUND = 60;

export default function FlappyGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('flappy');
  const [hud, setHud] = useState({ score: 0, over: false });
  const g = useRef(null);
  useKeys((k) => { if (k === ' ' || k === 'ArrowUp') flap(); });

  const init = () => {
    g.current = { y: H / 2 - 40, vy: 0, pipes: [], t: 0, score: 0, over: false, started: false, nextPipe: 0 };
    setHud({ score: 0, over: false });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function flap() {
    const s = g.current;
    if (!s) return;
    if (s.over) return;
    s.started = true;
    s.vy = -340;
  }

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    s.t += dt;
    if (s.started && !s.over) {
      s.vy += 1050 * dt; s.y += s.vy * dt;
      s.nextPipe -= dt;
      if (s.nextPipe <= 0) { s.pipes.push({ x: W + 20, gy: 90 + Math.random() * (H - GROUND - GAP - 140), passed: false }); s.nextPipe = 1.55; }
      for (const p of s.pipes) {
        p.x -= (150 + Math.min(80, s.score * 4)) * dt;
        if (!p.passed && p.x + PIPE_W < 80) { p.passed = true; s.score += 1; setHud({ score: s.score, over: false }); }
        const bx = 80;
        if (bx + 13 > p.x && bx - 13 < p.x + PIPE_W && (s.y - 11 < p.gy || s.y + 11 > p.gy + GAP)) s.over = true;
      }
      s.pipes = s.pipes.filter(p => p.x > -PIPE_W - 10);
      if (s.y > H - GROUND - 11 || s.y < -20) s.over = true;
      if (s.over) { submitBest(s.score); setHud({ score: s.score, over: true }); }
    } else if (!s.started) { s.y = H / 2 - 40 + Math.sin(s.t * 4) * 8; }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5ac8fa'); sky.addColorStop(1, '#bfeaff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) { const x = ((i * 190 - s.t * 12) % (W + 120) + W + 120) % (W + 120) - 60; ctx.beginPath(); ctx.arc(x, 90 + i * 55, 22, 0, 7); ctx.arc(x + 24, 96 + i * 55, 17, 0, 7); ctx.arc(x - 22, 98 + i * 55, 15, 0, 7); ctx.fill(); }
    for (const p of s.pipes) {
      ctx.fillStyle = '#3fbf5a';
      ctx.fillRect(p.x, 0, PIPE_W, p.gy); ctx.fillRect(p.x, p.gy + GAP, PIPE_W, H);
      ctx.fillStyle = '#2f9a46'; ctx.fillRect(p.x - 4, p.gy - 22, PIPE_W + 8, 22); ctx.fillRect(p.x - 4, p.gy + GAP, PIPE_W + 8, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(p.x + 6, 0, 8, p.gy - 22); ctx.fillRect(p.x + 6, p.gy + GAP + 22, 8, H);
    }
    ctx.fillStyle = '#d8b66a'; ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = '#7ac24a'; ctx.fillRect(0, H - GROUND, W, 12);
    ctx.save(); ctx.translate(80, s.y); ctx.rotate(Math.max(-0.5, Math.min(1.1, s.vy / 600)));
    ctx.fillStyle = '#ffd24f'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffb03c'; ctx.beginPath(); ctx.ellipse(-4, 3 + Math.sin(s.t * 18) * 3, 8, 5, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -4, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(8.5, -4, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff6a3c'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(23, 3); ctx.lineTo(13, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.font = '900 40px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText(String(s.score), W / 2, 62); ctx.fillText(String(s.score), W / 2, 62);
    if (!s.started) { ctx.font = 'bold 18px sans-serif'; ctx.lineWidth = 3; ctx.strokeText(t('gamify.games.tapFlap', 'Tap to flap'), W / 2, H / 2 + 60); ctx.fillText(t('gamify.games.tapFlap', 'Tap to flap'), W / 2, H / 2 + 60); }
  });

  return (
    <GameFrame title={t('gamify.games.flappy', 'Flappy Bird')} Icon={Bird} accent="#ffb03c" score={hud.score} best={best} onRestart={init} maxWidth={420} hint={t('gamify.games.flappyHint', 'Tap, click or press space to flap. Fly through the gaps without touching a pipe.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={{ ...ui.canvas, cursor: 'pointer' }} onPointerDown={flap} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.6)', borderRadius: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{t('gamify.games.gameOver', 'Game over')}</div>
            <div style={{ opacity: 0.9 }}>{t('gamify.games.score', 'Score')}: {hud.score}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
