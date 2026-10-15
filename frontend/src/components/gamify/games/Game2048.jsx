import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash } from 'lucide-react';
import { DPad, GameFrame, ui, useBest, useKeys, useSwipe } from './shared';
import { addTile, canMove2048, move2048 } from './logic';

const TILE = { 0: '#2a2548', 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };

const fresh = () => addTile(addTile(Array.from({ length: 4 }, () => Array(4).fill(0))));

export default function Game2048() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('g2048');
  const [state, setState] = useState(() => ({ board: fresh(), score: 0, over: false, won: false, ack: false }));
  const ref = useRef(state);
  ref.current = state;

  const init = () => setState({ board: fresh(), score: 0, over: false, won: false, ack: false });
  const go = (dir) => {
    const cur = ref.current;
    if (cur.over) return;
    const r = move2048(cur.board, dir);
    if (!r.moved) return;
    const board = addTile(r.board);
    const score = cur.score + r.score;
    const over = !canMove2048(board);
    if (over) submitBest(score);
    setState({ board, score, over, ack: cur.ack, won: !cur.ack && board.some(row => row.includes(2048)) });
  };
  useKeys((k) => { if (KEYMAP[k]) go(KEYMAP[k]); });
  useEffect(() => { if (state.score) submitBest(state.score); }, [state.score]); // eslint-disable-line react-hooks/exhaustive-deps
  const swipe = useSwipe(go);

  return (
    <GameFrame title="2048" Icon={Hash} accent="#edc22e" score={state.score} best={best} onRestart={init} maxWidth={440} hint={t('gamify.games.g2048Hint', 'Swipe or use the arrow keys to slide the tiles. Equal numbers merge - make 2048!')}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, aspectRatio: '1 / 1', background: '#15112f', borderRadius: 14, padding: 10, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', touchAction: 'none' }} {...swipe}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 10, width: '100%', height: '100%' }}>
          {state.board.flat().map((v, i) => (
            <div key={i} style={{ background: TILE[v] || '#3c3a32', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: v >= 1024 ? 26 : v >= 128 ? 32 : 38, color: v <= 4 ? '#5a4a3a' : '#fff', transition: 'background .12s', animation: v ? 'gp-pop .16s ease-out' : 'none' }}>{v || ''}</div>
          ))}
        </div>
        {(state.over || state.won) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{state.over ? t('gamify.games.gameOver', 'Game over') : t('gamify.games.youMade2048', 'You made 2048!')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!state.over && <button style={ui.btn} onClick={() => setState(s => ({ ...s, won: false, ack: true }))}>{t('gamify.games.keepGoing', 'Keep going')}</button>}
              <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
            </div>
          </div>
        )}
      </div>
      <DPad onPress={go} size={46} />
    </GameFrame>
  );
}
