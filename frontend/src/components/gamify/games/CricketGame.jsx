import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';
import { GameFrame, ui, useBest } from './shared';
import { ball, chase, cpuBat, cpuBowl, outcomeText } from './handCricketLogic';

// Hand cricket against the computer. Each ball you both show 1 to 6 fingers (6 is a
// thumbs-up). Same number: the batter is out. Different: the batter scores their
// number. You bat first, then the computer chases your score while you bowl.

// A right hand showing n (1-4 fingers, 5 = open palm with thumb, 6 = thumb up).
export function HandSign({ n, color = '#f0c8a0', size = 96, flip = false, shake = false }) {
  const fingers = n >= 1 && n <= 5 ? Math.min(4, n) : 0;
  const thumbOut = n === 5 || n === 6;
  const xs = [29, 43, 57, 71];
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" style={{ transform: flip ? 'scaleX(-1)' : undefined, animation: shake ? 'hc-shake 0.28s ease-in-out infinite' : undefined, overflow: 'visible' }} role="img" aria-label={`${n || 'hidden'} fingers`}>
      {/* sleeve and palm */}
      <rect x="26" y="96" width="52" height="24" rx="6" fill="#4f46e5" />
      <rect x="24" y="58" width="56" height="48" rx="16" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
      {/* four fingers: extended or curled */}
      {xs.map((x, i) => {
        const up = i < fingers;
        return <rect key={x} x={x - 5} y={up ? 14 + (i === 1 ? -4 : i === 3 ? 8 : 0) : 56} width="11" height={up ? 50 - (i === 1 ? -4 : i === 3 ? 8 : 0) : 15} rx="5.5" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />;
      })}
      {/* thumb */}
      {thumbOut
        ? <rect x="9" y={n === 6 ? 42 : 64} width="15" height={n === 6 ? 56 : 40} rx="7.5" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" transform={n === 6 ? 'rotate(-10 20 96)' : 'rotate(-36 20 100)'} />
        : <rect x="22" y="76" width="30" height="12" rx="6" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />}
    </svg>
  );
}

const SKIN_YOU = '#f0c8a0';
const SKIN_CPU = '#c58a62';

export default function CricketGame() {
  const { t } = useTranslation();
  const [best, submitBest] = useBest('cricket');
  const [innings, setInnings] = useState(1); // 1 you bat, 2 computer bats
  const [yourRuns, setYourRuns] = useState(0);
  const [cpuRuns, setCpuRuns] = useState(0);
  const [balls, setBalls] = useState(0);
  const [shown, setShown] = useState(null); // { you, cpu, text, kind }
  const [shaking, setShaking] = useState(false);
  const [result, setResult] = useState(null); // 'you' | 'cpu' | 'tie'
  const [msg, setMsg] = useState('');
  const history = useRef([]); // your numbers, for the computer's guesses
  const timer = useRef(0);
  const busy = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const reset = () => {
    clearTimeout(timer.current);
    busy.current = false;
    history.current = [];
    setInnings(1); setYourRuns(0); setCpuRuns(0); setBalls(0); setShown(null); setShaking(false); setResult(null);
    setMsg(t('gamify.games.hcStart', 'You bat first. Pick a number from 1 to 6.'));
  };
  useEffect(() => { reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (n) => {
    if (busy.current || result) return;
    busy.current = true;
    setShaking(true);
    setShown(null);
    history.current.push(n);
    const target = yourRuns;
    // the computer commits to its number as soon as you do
    const cpu = innings === 1 ? cpuBowl(history.current.slice(0, -1)) : cpuBat(target + 1 - cpuRuns);
    timer.current = setTimeout(() => {
      setShaking(false);
      const you = n;
      const batNum = innings === 1 ? you : cpu;
      const bowlNum = innings === 1 ? cpu : you;
      const r = ball(batNum, bowlNum);
      setBalls(b => b + 1);
      if (innings === 1) {
        if (r.out) {
          submitBest(yourRuns);
          setShown({ you, cpu, kind: 'out', text: t('gamify.games.hcOut', 'OUT! Same number') });
          setInnings(2);
          setMsg(`${t('gamify.games.hcTarget', 'You scored')} ${yourRuns}. ${t('gamify.games.hcBowl', 'Now bowl: the computer needs')} ${yourRuns + 1}.`);
        } else {
          const total = yourRuns + r.runs;
          setYourRuns(total);
          submitBest(total);
          setShown({ you, cpu, kind: 'run', text: `+${r.runs}` });
          setMsg(`${t('gamify.games.hcScored', 'You scored')} ${r.runs}. ${t('gamify.games.hcKeep', 'Keep going or risk it!')}`);
        }
      } else {
        const total = cpuRuns + r.runs;
        setCpuRuns(total);
        const res = chase(total, yourRuns, r.out);
        setShown({ you, cpu, kind: r.out ? 'out' : 'run', text: r.out ? t('gamify.games.hcCpuOut', 'OUT! You got the computer') : `+${r.runs}` });
        if (res) { setResult(res); setMsg(outcomeText(res)); } else setMsg(`${t('gamify.games.hcCpuScored', 'The computer scored')} ${r.runs}. ${t('gamify.games.hcNeeds', 'It needs')} ${yourRuns + 1 - total} ${t('gamify.games.hcMore', 'more')}.`);
      }
      busy.current = false;
    }, 650);
  };

  const youBat = innings === 1;
  return (
    <GameFrame title={t('gamify.games.cricket', 'Hand Cricket')} Icon={Trophy} accent="#3fa24a" score={yourRuns} scoreLabel={t('gamify.games.runs', 'Runs')} best={best} onRestart={reset} maxWidth={560}
      hint={t('gamify.games.hcHint', 'Show 1 to 6 fingers at the same time as the computer. The same number means the batter is out. Otherwise the batter scores their number. You bat first, then bowl while the computer chases your score.')}>
      <style>{'@keyframes hc-shake { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-14px) rotate(-6deg); } } @keyframes hc-pop { 0% { transform: scale(.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }'}</style>
      <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ ...ui.panel, flex: '1 1 150px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
          {youBat ? t('gamify.games.hcInn1', 'Innings 1: you bat') : t('gamify.games.hcInn2', 'Innings 2: you bowl')}
        </div>
        <div style={{ ...ui.panel, flex: '1 1 150px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
          {youBat ? `${t('gamify.games.hcBalls', 'Balls')}: ${balls}` : `${t('gamify.games.hcCpu', 'Computer')} ${cpuRuns} / ${t('gamify.games.hcTargetLbl', 'Target')} ${yourRuns + 1}`}
        </div>
      </div>

      {/* the two hands */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 'clamp(12px, 8vw, 56px)', padding: '10px 0 2px', width: '100%' }}>
        {[[t('gamify.games.hcYou', 'You'), shown ? shown.you : 0, SKIN_YOU, false], [t('gamify.games.hcCpu', 'Computer'), shown ? shown.cpu : 0, SKIN_CPU, true]].map(([name, n, skin, flip]) => (
          <div key={name} style={{ textAlign: 'center', minWidth: 110 }}>
            <div style={{ height: 130, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {shaking ? <HandSign n={0} color={skin} flip={flip} shake /> : shown ? <div style={{ animation: 'hc-pop .25s ease-out' }}><HandSign n={n} color={skin} flip={flip} /></div> : <HandSign n={0} color={skin} flip={flip} />}
            </div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{name}</div>
            <div style={{ fontSize: 24, fontWeight: 900, minHeight: 30, color: shown && shown.kind === 'out' ? '#ff6a6a' : '#ffe27a' }}>{shown && !shaking ? n : ''}</div>
          </div>
        ))}
      </div>
      <div aria-live="polite" style={{ fontWeight: 900, fontSize: 20, minHeight: 28, color: shown && shown.kind === 'out' ? '#ff6a6a' : '#ffe27a' }}>{!shaking && shown ? shown.text : ''}</div>
      <div style={{ ...ui.panel, fontWeight: 700, fontSize: 13.5, minHeight: 20, textAlign: 'center', width: '100%' }}>{msg}</div>

      {result ? (
        <div style={{ ...ui.panel, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{outcomeText(result)}</div>
          <div style={{ opacity: 0.85 }}>{t('gamify.games.hcFinal', 'You scored')} {yourRuns}, {t('gamify.games.hcCpu', 'Computer')} {cpuRuns}</div>
          <button style={{ ...ui.btn, ...ui.btnOn }} onClick={reset}>{t('gamify.games.playAgain', 'Play again')}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, width: '100%', maxWidth: 420 }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => pick(n)} disabled={shaking} aria-label={`${n}`}
              style={{ ...ui.btn, ...(shaking ? { opacity: 0.5 } : null), flexDirection: 'column', gap: 2, padding: '8px 4px', minHeight: 92, justifyContent: 'center', touchAction: 'manipulation' }}>
              <HandSign n={n} color={SKIN_YOU} size={40} />
              <span style={{ fontWeight: 900, fontSize: 16 }}>{n}</span>
            </button>
          ))}
        </div>
      )}
    </GameFrame>
  );
}
