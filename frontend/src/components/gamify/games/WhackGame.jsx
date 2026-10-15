import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hammer } from 'lucide-react';
import { GameFrame, ui, useBest } from './shared';

const DURATION = 30;

export default function WhackGame() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('whack');
  const [phase, setPhase] = useState('idle'); // idle | play | over
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [moles, setMoles] = useState(() => Array(9).fill(null)); // null | 'mole' | 'bomb' | 'hit'
  const timers = useRef([]);
  const scoreRef = useRef(0);
  const phaseRef = useRef('idle');

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const start = () => {
    clear();
    scoreRef.current = 0; phaseRef.current = 'play';
    setScore(0); setTime(DURATION); setMoles(Array(9).fill(null)); setPhase('play');
    const t0 = Date.now();
    const tick = () => {
      if (phaseRef.current !== 'play') return;
      const left = Math.max(0, DURATION - Math.floor((Date.now() - t0) / 1000));
      setTime(left);
      if (left <= 0) { phaseRef.current = 'over'; setPhase('over'); submitBest(scoreRef.current); setMoles(Array(9).fill(null)); return; }
      timers.current.push(setTimeout(tick, 250));
    };
    tick();
    const pop = () => {
      if (phaseRef.current !== 'play') return;
      const elapsed = (Date.now() - t0) / 1000;
      const up = Math.max(420, 1000 - elapsed * 18);
      const idx = Math.floor(Math.random() * 9);
      const kind = Math.random() < 0.14 ? 'bomb' : 'mole';
      setMoles(m => (m[idx] ? m : m.map((v, i) => (i === idx ? kind : v))));
      timers.current.push(setTimeout(() => setMoles(m => m.map((v, i) => (i === idx && v !== 'hit' ? null : v))), up));
      timers.current.push(setTimeout(() => setMoles(m => m.map((v, i) => (i === idx && v === 'hit' ? null : v))), up + 220));
      timers.current.push(setTimeout(pop, Math.max(260, 700 - elapsed * 12)));
    };
    pop();
  };

  const whack = (i) => {
    if (phaseRef.current !== 'play') return;
    const kind = moles[i];
    if (kind === 'mole') { scoreRef.current += 1; setScore(scoreRef.current); setMoles(m => m.map((v, j) => (j === i ? 'hit' : v))); } else if (kind === 'bomb') { scoreRef.current = Math.max(0, scoreRef.current - 2); setScore(scoreRef.current); setMoles(m => m.map((v, j) => (j === i ? 'hit' : v))); }
  };

  return (
    <GameFrame title={t('gamify.games.whack', 'Whack-a-Mole')} Icon={Hammer} accent="#c0763a" score={score} best={best} onRestart={start} maxWidth={440}
      extra={<span style={{ color: time <= 5 ? '#ff8a8a' : '#fff' }}>{time}s</span>}
      hint={t('gamify.games.whackHint', 'Tap the moles as they pop up. Careful - bombs cost you 2 points. You have 30 seconds.')}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: 16, borderRadius: 18, background: 'linear-gradient(180deg,#3a7a3a,#27582f)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', touchAction: 'manipulation' }}>
          {moles.map((m, i) => (
            <button key={i} onPointerDown={(e) => { e.preventDefault(); whack(i); }} style={{ position: 'relative', aspectRatio: '1 / 1', border: 'none', borderRadius: '50%', background: 'radial-gradient(circle at 50% 35%, #2a1a10, #120a05)', overflow: 'hidden', cursor: 'pointer', padding: 0 }} aria-label={`hole ${i + 1}`}>
              <div style={{ position: 'absolute', left: '12%', right: '12%', bottom: m && m !== 'hit' ? '4%' : m === 'hit' ? '-10%' : '-70%', height: '86%', transition: 'bottom .12s ease-out', borderRadius: '50% 50% 30% 30%', background: m === 'bomb' ? '#222' : '#9a6a3a', border: '3px solid rgba(0,0,0,0.4)' }}>
                {m === 'mole' || m === 'hit' ? (
                  <>
                    <i style={{ position: 'absolute', top: '26%', left: '24%', width: '14%', height: '14%', borderRadius: '50%', background: m === 'hit' ? '#fff' : '#111' }} />
                    <i style={{ position: 'absolute', top: '26%', right: '24%', width: '14%', height: '14%', borderRadius: '50%', background: m === 'hit' ? '#fff' : '#111' }} />
                    <i style={{ position: 'absolute', top: '46%', left: '38%', width: '24%', height: '16%', borderRadius: '50%', background: '#e58a8a' }} />
                    {m === 'hit' && <b style={{ position: 'absolute', top: -4, left: '34%', fontSize: 22, color: '#ffd36b' }}>+1</b>}
                  </>
                ) : m === 'bomb' ? <b style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff5a5a', fontSize: 30 }}>!</b> : null}
              </div>
            </button>
          ))}
        </div>
        {phase !== 'play' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.7)', borderRadius: 18 }}>
            {phase === 'over' && <><div style={{ fontSize: 28, fontWeight: 900 }}>{t('gamify.games.timeUp', "Time's up")}</div><div style={{ opacity: 0.85 }}>{t('gamify.games.score', 'Score')}: {score}</div></>}
            <button style={{ ...ui.btn, ...ui.btnOn, fontSize: 16, padding: '12px 28px' }} onClick={start}>{phase === 'over' ? t('gamify.games.playAgain', 'Play again') : t('gamify.games.start', 'Start')}</button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
