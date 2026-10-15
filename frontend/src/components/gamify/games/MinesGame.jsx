import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bomb, Flag } from 'lucide-react';
import { GameFrame, ui, useBest } from './shared';
import { makeMines, minesWon, openCell } from './logic';

const SIZE = 9;
const MINES = 10;
const NUM_COLORS = ['', '#4f9bff', '#4fd37a', '#ff6a6a', '#9a6aff', '#ff9a3c', '#3ee8ff', '#e8e8e8', '#9a9a9a'];

const blank = () => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ mine: false, open: false, flag: false, n: 0 })));

export default function MinesGame() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('mines', true);
  const [cells, setCells] = useState(blank);
  const [state, setState] = useState('ready'); // ready | play | won | lost
  const [flagMode, setFlagMode] = useState(false);
  const [time, setTime] = useState(0);
  const t0 = useRef(0);

  useEffect(() => {
    if (state !== 'play') return undefined;
    const id = setInterval(() => setTime(Math.floor((Date.now() - t0.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [state]);

  const init = () => { setCells(blank()); setState('ready'); setTime(0); };
  const flags = cells.flat().filter(c => c.flag).length;

  const act = (x, y, asFlag) => {
    if (state === 'won' || state === 'lost') return;
    let cur = cells;
    if (state === 'ready') { cur = makeMines(SIZE, SIZE, MINES, x, y); t0.current = Date.now(); setState('play'); }
    const cell = cur[y][x];
    if (asFlag) {
      if (cell.open) return;
      setCells(cur.map((row, j) => row.map((c, i) => (i === x && j === y ? { ...c, flag: !c.flag } : c))));
      return;
    }
    const r = openCell(cur, x, y);
    if (r.hitMine) {
      setCells(r.cells.map(row => row.map(c => (c.mine ? { ...c, open: true } : c))));
      setState('lost');
    } else {
      setCells(r.cells);
      if (minesWon(r.cells)) { const secs = Math.max(1, Math.floor((Date.now() - t0.current) / 1000)); setTime(secs); setState('won'); submitBest(secs); }
    }
  };

  return (
    <GameFrame title={t('gamify.games.mines', 'Minesweeper')} Icon={Bomb} accent="#4f7bff" score={`${time}s`} scoreLabel={t('gamify.games.time', 'Time')} best={best ? `${best}s` : 0} bestLabel={t('gamify.games.bestTime', 'Best time')} onRestart={init} maxWidth={440}
      hint={t('gamify.games.minesHint', 'Open every square without hitting a mine. Numbers show how many mines touch a square. Use the flag button (or right-click) to mark mines.')}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={{ ...ui.btn, ...(flagMode ? ui.btnOn : null) }} onClick={() => setFlagMode(f => !f)}><Flag size={15} />{t('gamify.games.flag', 'Flag')}</button>
        <span style={{ fontWeight: 800 }}>{t('gamify.games.minesLeft', 'Mines left')}: {MINES - flags}</span>
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 3, padding: 8, background: '#15112f', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', touchAction: 'manipulation' }}>
          {cells.map((row, y) => row.map((c, x) => (
            <button key={`${x}-${y}`} onClick={() => act(x, y, flagMode)} onContextMenu={(e) => { e.preventDefault(); act(x, y, true); }}
              style={{ aspectRatio: '1 / 1', border: 'none', borderRadius: 6, padding: 0, cursor: 'pointer', fontWeight: 900, fontSize: 15, color: NUM_COLORS[c.n] || '#fff', background: c.open ? (c.mine ? '#7a1f2a' : '#2a2548') : 'linear-gradient(180deg,#5a4fa0,#40367c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {c.open ? (c.mine ? <Bomb size={15} color="#fff" /> : c.n || '') : c.flag ? <Flag size={14} color="#ffd36b" /> : ''}
            </button>
          )))}
        </div>
        {(state === 'won' || state === 'lost') && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.62)', borderRadius: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: state === 'won' ? '#7dffa1' : '#ff8a8a' }}>{state === 'won' ? `${t('gamify.games.cleared', 'Cleared')} - ${time}s` : t('gamify.games.boom', 'Boom!')}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
