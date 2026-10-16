import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { GameFrame, ui, useBest } from './shared';
import { computerMove, emptyBoard, isFull, winner } from './xoxoLogic';

// XOXO (noughts and crosses) against the computer. You are X and always go first.

const Mark = ({ v, win }) => (
  <svg viewBox="0 0 100 100" width="70%" height="70%" style={{ overflow: 'visible', animation: 'gp-pop .22s ease-out' }} aria-hidden="true">
    {v === 'X' ? (
      <g stroke={win ? '#fff' : '#ff6fb5'} strokeWidth="13" strokeLinecap="round"><path d="M20 20 L80 80" /><path d="M80 20 L20 80" /></g>
    ) : (
      <circle cx="50" cy="50" r="31" fill="none" stroke={win ? '#fff' : '#3ee8ff'} strokeWidth="13" />
    )}
  </svg>
);

export default function XoxoGame() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('xoxo');
  const [board, setBoard] = useState(emptyBoard);
  const [result, setResult] = useState(null); // { who, line } | 'draw'
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [draws, setDraws] = useState(0);
  const [thinking, setThinking] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const settle = (b) => {
    const w = winner(b);
    if (w) {
      setResult(w);
      if (w.who === 'X') { submitBest(wins + 1); setWins(wins + 1); } else setLosses(n => n + 1);
      return true;
    }
    if (isFull(b)) { setResult('draw'); setDraws(n => n + 1); return true; }
    return false;
  };

  const play = (i) => {
    if (thinking || result || board[i]) return;
    const b = board.slice();
    b[i] = 'X';
    setBoard(b);
    if (settle(b)) return;
    setThinking(true);
    timer.current = setTimeout(() => {
      const c = b.slice();
      const m = computerMove(c);
      if (m >= 0) c[m] = 'O';
      setBoard(c);
      setThinking(false);
      settle(c);
    }, 450);
  };

  const again = () => { clearTimeout(timer.current); setBoard(emptyBoard()); setResult(null); setThinking(false); };
  const restart = () => { again(); setWins(0); setLosses(0); setDraws(0); };
  const winCells = new Set(result && result !== 'draw' ? result.line : []);
  const status = result === 'draw' ? t('gamify.games.draw', 'A draw')
    : result ? (result.who === 'X' ? t('gamify.games.youWin', 'You win!') : t('gamify.games.cpuWins', 'Computer wins'))
      : thinking ? t('gamify.games.cpuThinking', 'Computer is thinking...') : t('gamify.games.yourTurn', 'Your turn');

  return (
    <GameFrame title={t('gamify.games.xoxo', 'XOXO')} Icon={X} accent="#ff6fb5" score={wins} scoreLabel={t('gamify.games.wins', 'Wins')} best={best} bestLabel={t('gamify.games.bestWins', 'Best wins')} onRestart={restart} maxWidth={440}
      hint={t('gamify.games.xoxoHint', 'You are X and go first. Get three in a row - across, down or diagonally - before the computer does.')}>
      <div aria-live="polite" style={{ fontWeight: 800, minHeight: 22 }}>{status}</div>
      <div style={{ width: '100%', maxWidth: 340, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, touchAction: 'manipulation' }}>
        {board.map((v, i) => (
          <button key={i} onClick={() => play(i)} aria-label={`cell ${i + 1}${v ? ` ${v}` : ''}`}
            style={{ aspectRatio: '1 / 1', borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', cursor: !v && !result && !thinking ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              background: winCells.has(i) ? (result.who === 'X' ? '#d63384' : '#1aa3bd') : 'rgba(255,255,255,0.07)', transition: 'background .2s' }}>
            {v && <Mark v={v} win={winCells.has(i)} />}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12.5, fontWeight: 700, opacity: 0.85 }}>
        <span>{t('gamify.games.wins', 'Wins')} {wins}</span><span>{t('gamify.games.draws', 'Draws')} {draws}</span><span>{t('gamify.games.losses', 'Losses')} {losses}</span>
      </div>
      {result && <button style={{ ...ui.btn, ...ui.btnOn }} onClick={again}>{t('gamify.games.playAgain', 'Play again')}</button>}
    </GameFrame>
  );
}
