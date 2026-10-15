import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Snail } from 'lucide-react';
import { DPad, GameFrame, ui, useBest, useCanvas, useKeys, useRaf, useSwipe } from './shared';

const N = 20;
const CELL = 22;
const W = N * CELL;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

const placeFood = (snake) => {
  for (let i = 0; i < 200; i++) {
    const f = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
    if (!snake.some(([x, y]) => x === f[0] && y === f[1])) return f;
  }
  return [0, 0];
};

export default function SnakeGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, W);
  const [best, submitBest] = useBest('snake');
  const [hud, setHud] = useState({ score: 0, over: false, started: false });
  const g = useRef(null);

  const init = () => {
    const snake = [[10, 10], [9, 10], [8, 10]];
    g.current = { snake, dir: 'right', queue: [], food: placeFood(snake), acc: 0, score: 0, over: false, started: false };
    setHud({ score: 0, over: false, started: false });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const turn = (d) => {
    const s = g.current;
    if (!s || s.over) return;
    s.started = true;
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    const [lx, ly] = DIRS[last];
    const [nx, ny] = DIRS[d];
    if (lx + nx === 0 && ly + ny === 0) return;
    if (s.queue.length < 3) s.queue.push(d);
  };
  useKeys((k) => { if (KEYMAP[k]) turn(KEYMAP[k]); else if (k === ' ' && g.current?.over) init(); });
  const swipe = useSwipe(turn);

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    if (s.started && !s.over) {
      s.acc += dt;
      const step = Math.max(0.065, 0.15 - s.score * 0.0025);
      while (s.acc >= step) {
        s.acc -= step;
        if (s.queue.length) s.dir = s.queue.shift();
        const [dx, dy] = DIRS[s.dir];
        const head = [s.snake[0][0] + dx, s.snake[0][1] + dy];
        const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N;
        const hitSelf = s.snake.slice(0, -1).some(([x, y]) => x === head[0] && y === head[1]);
        if (hitWall || hitSelf) { s.over = true; submitBest(s.score); setHud({ score: s.score, over: true, started: true }); break; }
        s.snake.unshift(head);
        if (head[0] === s.food[0] && head[1] === s.food[1]) { s.score += 1; s.food = placeFood(s.snake); setHud({ score: s.score, over: false, started: true }); } else s.snake.pop();
      }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d1b14'; ctx.fillRect(0, 0, W, W);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.arc(s.food[0] * CELL + CELL / 2, s.food[1] * CELL + CELL / 2, CELL * 0.38, 0, 7); ctx.fill();
    ctx.fillStyle = '#6ee37a'; ctx.fillRect(s.food[0] * CELL + CELL / 2 - 1, s.food[1] * CELL + 2, 3, 5);
    s.snake.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? '#b6ff7a' : `hsl(${120 - Math.min(i, 30)},70%,${52 - Math.min(i, 20) * 0.6}%)`;
      ctx.beginPath(); ctx.roundRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, i === 0 ? 8 : 6); ctx.fill();
    });
    if (!s.started) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t('gamify.games.pressArrow', 'Press an arrow to start'), W / 2, W / 2 + 60); }
  });

  return (
    <GameFrame title={t('gamify.games.snake', 'Snake')} Icon={Snail} accent="#2f9e5a" score={hud.score} best={best} onRestart={init} maxWidth={480} hint={t('gamify.games.snakeHint', 'Eat the apples, avoid the walls and your own tail. Arrow keys, WASD, swipe or the pad.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={ui.canvas} {...swipe} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{t('gamify.games.gameOver', 'Game over')}</div>
            <div style={{ opacity: 0.85 }}>{t('gamify.games.score', 'Score')}: {hud.score}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
          </div>
        )}
      </div>
      <DPad onPress={turn} size={46} />
    </GameFrame>
  );
}
