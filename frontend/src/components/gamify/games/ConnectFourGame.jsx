import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid3x3 } from 'lucide-react';
import { GameFrame, ui, useBest } from './shared';
import { C4_H, C4_W, c4Best, c4Drop, c4Empty, c4Full, c4Winner } from './logic';

export default function ConnectFourGame() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('connect4');
  const [board, setBoard] = useState(c4Empty);
  const [turn, setTurn] = useState(1); // 1 = you (red), 2 = computer (yellow)
  const [result, setResult] = useState(null); // { winner, line } | 'draw'
  const [wins, setWins] = useState(0);
  const [hover, setHover] = useState(-1);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const finish = (b, who) => {
    const w = c4Winner(b);
    if (w) { setResult(w); if (w.winner === 1) { setWins(wins + 1); submitBest(wins + 1); } return true; }
    if (c4Full(b)) { setResult('draw'); return true; }
    return false;
  };

  const play = (col) => {
    if (turn !== 1 || result) return;
    const d = c4Drop(board, col, 1);
    if (!d) return;
    setBoard(d.board);
    if (finish(d.board, 1)) return;
    setTurn(2);
    timer.current = setTimeout(() => {
      const c = c4Best(d.board, 2, 5);
      const m = c4Drop(d.board, c, 2);
      if (m) { setBoard(m.board); if (finish(m.board, 2)) return; }
      setTurn(1);
    }, 450);
  };

  const init = () => { clearTimeout(timer.current); setBoard(c4Empty()); setTurn(1); setResult(null); };
  const winCells = new Set(result && result !== 'draw' ? result.line.map(([x, y]) => `${x}-${y}`) : []);

  return (
    <GameFrame title={t('gamify.games.connect4', 'Connect Four')} Icon={Grid3x3} accent="#e0529f" score={wins} scoreLabel={t('gamify.games.wins', 'Wins')} best={best} bestLabel={t('gamify.games.bestWins', 'Best wins')} onRestart={init} maxWidth={460}
      hint={t('gamify.games.c4Hint', 'Drop your red discs and connect four in a row - across, up or diagonally - before the computer does.')}>
      <div style={{ fontWeight: 800, minHeight: 22 }}>
        {result === 'draw' ? t('gamify.games.draw', 'A draw') : result ? (result.winner === 1 ? t('gamify.games.youWin', 'You win!') : t('gamify.games.cpuWins', 'Computer wins')) : turn === 1 ? t('gamify.games.yourTurn', 'Your turn') : t('gamify.games.cpuThinking', 'Computer is thinking...')}
      </div>
      <div style={{ width: '100%', maxWidth: 420, background: 'linear-gradient(180deg,#2a4fd0,#1b3596)', borderRadius: 16, padding: 10, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', touchAction: 'manipulation' }} onPointerLeave={() => setHover(-1)}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${C4_W}, 1fr)`, gap: 6 }}>
          {Array.from({ length: C4_H * C4_W }).map((_, i) => {
            const x = i % C4_W;
            const y = Math.floor(i / C4_W);
            const v = board[y][x];
            return (
              <button key={i} onClick={() => play(x)} onPointerEnter={() => setHover(x)} aria-label={`column ${x + 1}`}
                style={{ aspectRatio: '1 / 1', borderRadius: '50%', border: 'none', cursor: turn === 1 && !result ? 'pointer' : 'default', padding: 0,
                  background: v === 1 ? 'radial-gradient(circle at 35% 30%, #ff8a8a, #d4223a)' : v === 2 ? 'radial-gradient(circle at 35% 30%, #fff2a0, #e8b81c)' : (hover === x && turn === 1 && !result ? '#34459a' : '#0c1236'),
                  boxShadow: winCells.has(`${x}-${y}`) ? '0 0 0 4px #fff, 0 0 16px 4px #fff' : 'inset 0 3px 6px rgba(0,0,0,0.5)', animation: v ? 'gp-pop .2s ease-out' : 'none' }} />
            );
          })}
        </div>
      </div>
      {result && <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>}
    </GameFrame>
  );
}
