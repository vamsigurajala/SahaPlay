import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Layers, RotateCw } from 'lucide-react';
import { GameFrame, ui, useBest, useCanvas, useKeys, useRaf } from './shared';
import { LINE_SCORES, PIECES, PIECE_KEYS, TETRIS_H, TETRIS_W, clearLines, collides, merge, newBoard, rotateCells } from './logic';

const CELL = 28;
const W = TETRIS_W * CELL;
const H = TETRIS_H * CELL;

const spawn = (key) => ({ key, cells: PIECES[key].cells.map(c => c.slice()), x: 3, y: -1 });
const bag = () => { const a = [...PIECE_KEYS]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default function TetrisGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const nextCanvas = useCanvas(112, 84);
  const [best, submitBest] = useBest('tetris');
  const [hud, setHud] = useState({ score: 0, lines: 0, level: 1, over: false });
  const g = useRef(null);

  const repeatTimer = useRef(null);
  const stopRepeat = () => {
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      clearTimeout(repeatTimer.current);
      repeatTimer.current = null;
    }
  };
  useEffect(() => stopRepeat, []);

  const holdBtn = (action) => (e) => {
    if (e.cancelable) e.preventDefault();
    action();
    stopRepeat();
    repeatTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(action, 120);
    }, 200);
  };

  const draw1 = (ctx, x, y, color, size = CELL) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, size - 1, size - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, size - 1, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, y + size - 5, size - 1, 4);
  };

  const nextPiece = (s) => { if (s.queue.length < 3) s.queue.push(...bag()); return spawn(s.queue.shift()); };
  const init = () => {
    stopRepeat();
    const s = { board: newBoard(), queue: bag(), score: 0, lines: 0, level: 1, acc: 0, over: false, flash: 0 };
    s.piece = nextPiece(s);
    g.current = s;
    setHud({ score: 0, lines: 0, level: 1, over: false });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lock = () => {
    const s = g.current;
    s.board = merge(s.board, s.piece.cells, s.piece.x, s.piece.y, PIECES[s.piece.key].color);
    const r = clearLines(s.board);
    s.board = r.board;
    if (r.cleared) { s.lines += r.cleared; s.score += LINE_SCORES[r.cleared] * s.level; s.level = 1 + Math.floor(s.lines / 10); }
    s.piece = nextPiece(s);
    if (collides(s.board, s.piece.cells, s.piece.x, s.piece.y)) { s.over = true; submitBest(s.score); }
    setHud({ score: s.score, lines: s.lines, level: s.level, over: s.over });
  };
  const tryMove = (dx, dy) => {
    const s = g.current;
    if (!s || s.over) return false;
    if (!collides(s.board, s.piece.cells, s.piece.x + dx, s.piece.y + dy)) { s.piece.x += dx; s.piece.y += dy; return true; }
    return false;
  };
  const rotate = () => {
    const s = g.current;
    if (!s || s.over || s.piece.key === 'O') return;
    const cells = rotateCells(s.piece.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(s.board, cells, s.piece.x + kick, s.piece.y)) { s.piece.cells = cells; s.piece.x += kick; return; }
    }
  };
  const down = () => { if (!tryMove(0, 1)) lock(); else g.current.score += 1; };
  const hard = () => { const s = g.current; if (!s || s.over) return; let n = 0; while (tryMove(0, 1)) n++; s.score += n * 2; lock(); };
  const press = (dir) => { if (dir === 'left') tryMove(-1, 0); else if (dir === 'right') tryMove(1, 0); else if (dir === 'up') rotate(); else if (dir === 'down') down(); };

  useKeys((k) => {
    if (k === 'ArrowLeft' || k === 'a') press('left'); else if (k === 'ArrowRight' || k === 'd') press('right');
    else if (k === 'ArrowUp' || k === 'w') rotate(); else if (k === 'ArrowDown' || k === 's') down(); else if (k === ' ') hard();
  });

  // Direct swipe & tap gestures on canvas for mobile comfort
  const pointerStart = useRef(null);
  const onPointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };
  const onPointerUp = (e) => {
    const s = pointerStart.current;
    pointerStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dist = Math.hypot(dx, dy);
    const dt = Date.now() - s.time;
    if (dist < 12 && dt < 300) {
      rotate();
      return;
    }
    if (dist >= 18) {
      if (Math.abs(dx) > Math.abs(dy)) {
        press(dx > 0 ? 'right' : 'left');
      } else {
        if (dy > 0) down();
        else rotate();
      }
    }
  };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    if (!s.over) {
      s.acc += dt;
      const step = Math.max(0.07, 0.8 - (s.level - 1) * 0.07);
      if (s.acc >= step) { s.acc = 0; if (!tryMove(0, 1)) lock(); }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0720'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let x = 1; x < TETRIS_W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke(); }
    for (let y = 1; y < TETRIS_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke(); }
    s.board.forEach((row, y) => row.forEach((col, x) => { if (col) draw1(ctx, x * CELL, y * CELL, col); }));
    let gy = s.piece.y;
    while (!collides(s.board, s.piece.cells, s.piece.x, gy + 1)) gy++;
    for (const [cx, cy] of s.piece.cells) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect((cx + s.piece.x) * CELL + 1, (cy + gy) * CELL + 1, CELL - 3, CELL - 3); }
    for (const [cx, cy] of s.piece.cells) if (cy + s.piece.y >= 0) draw1(ctx, (cx + s.piece.x) * CELL, (cy + s.piece.y) * CELL, PIECES[s.piece.key].color);
    const n = nextCanvas.current?.getContext('2d');
    if (n) {
      n.fillStyle = '#0a0720'; n.fillRect(0, 0, 112, 84);
      const np = PIECES[s.queue[0]];
      np.cells.forEach(([cx, cy]) => draw1(n, 14 + cx * 22, 14 + cy * 22, np.color, 22));
    }
  });

  const btn = {
    ...ui.btn,
    width: 'clamp(36px, 10.4vw, 52px)',
    height: 'clamp(35px, 9.4vw, 48px)',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 'clamp(8px, 2vw, 12px)',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  const iconStyle = { width: 'clamp(16px, 4.4vw, 20px)', height: 'clamp(16px, 4.4vw, 20px)' };

  return (
    <GameFrame
      title={t('gamify.games.tetris', 'Block Stack')}
      Icon={Layers}
      accent="#4f7bff"
      score={hud.score}
      best={best}
      onRestart={init}
      maxWidth={520}
      hint={t('gamify.games.tetrisHint', 'Arrows move, up rotates, space drops. Complete rows to clear them - every 10 rows is a new level.')}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: 'clamp(6px, 2vw, 14px)',
          alignItems: 'center',
          width: '100%',
          justifyContent: 'center',
          maxWidth: 520,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(270px, 46vw, calc((100dvh - 170px) * 0.5))',
            maxWidth: '48vw',
            aspectRatio: '10 / 20',
            flexShrink: 0,
          }}
        >
          <canvas
            ref={canvas}
            style={{ ...ui.canvas, width: '100%', height: '100%', aspectRatio: '10 / 20' }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          />
          {hud.over && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'rgba(5,4,14,0.78)',
                borderRadius: 14,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 'clamp(18px, 5vw, 26px)', fontWeight: 900 }}>
                {t('gamify.games.gameOver', 'Game over')}
              </div>
              <button style={{ ...ui.btn, ...ui.btnOn, padding: '8px 16px', fontSize: 13 }} onClick={init}>
                {t('gamify.games.playAgain', 'Play again')}
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(5px, 1.1vh, 9px)',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              ...ui.panel,
              textAlign: 'center',
              fontSize: 'clamp(10.5px, 2.7vw, 12px)',
              fontWeight: 800,
              padding: 'clamp(4px, 0.7vh, 7px) clamp(6px, 1.5vw, 10px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 'clamp(8px, 2vw, 12px)',
            }}
          >
            <span>{t('gamify.games.next', 'Next')}</span>
            <canvas
              ref={nextCanvas}
              style={{
                display: 'block',
                width: 'clamp(62px, 17vw, 104px)',
                height: 'auto',
                aspectRatio: '112 / 84',
                marginTop: 3,
                borderRadius: 8,
                background: '#0a0720',
              }}
            />
          </div>

          <div
            style={{
              ...ui.panel,
              textAlign: 'center',
              fontSize: 'clamp(10.5px, 2.8vw, 12.5px)',
              fontWeight: 800,
              lineHeight: 1.45,
              padding: 'clamp(4px, 0.7vh, 6px) clamp(6px, 1.5vw, 10px)',
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: 'clamp(8px, 2vw, 12px)',
            }}
          >
            <div>{t('gamify.games.level', 'Level')}: {hud.level}</div>
            <div>{t('gamify.games.lines', 'Lines')}: {hud.lines}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, clamp(36px, 10.4vw, 52px))',
              gap: 'clamp(4px, 1.2vw, 6px)',
            }}
          >
            <button
              style={btn}
              onPointerDown={holdBtn(() => press('left'))}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              aria-label="left"
            >
              <ArrowLeft size={18} style={iconStyle} />
            </button>
            <button
              style={btn}
              onPointerDown={() => rotate()}
              aria-label="rotate"
            >
              <RotateCw size={18} style={iconStyle} />
            </button>
            <button
              style={btn}
              onPointerDown={holdBtn(() => press('right'))}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              aria-label="right"
            >
              <ArrowRight size={18} style={iconStyle} />
            </button>
            <button
              style={btn}
              onPointerDown={holdBtn(down)}
              onPointerUp={stopRepeat}
              onPointerLeave={stopRepeat}
              onPointerCancel={stopRepeat}
              aria-label="down"
            >
              <ArrowDown size={18} style={iconStyle} />
            </button>
            <button
              style={{ ...btn, gridColumn: 'span 2', width: '100%' }}
              onPointerDown={hard}
              aria-label="drop"
            >
              <ChevronsDown size={18} style={iconStyle} />
            </button>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}
