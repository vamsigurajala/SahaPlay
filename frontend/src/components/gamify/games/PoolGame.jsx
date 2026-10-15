import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle } from 'lucide-react';
import { GameFrame, canvasPoint, ui, useBest, useCanvas, useRaf } from './shared';
import { TABLE, POCKETS, rackBalls, stepPool, shoot, allStopped, aimTrace, cpuChoose, legalTargets, groupOf } from './poolPhysics';

const OFF = 44; // rail thickness around the cloth
const W = TABLE.w + OFF * 2;
const H = TABLE.h + OFF * 2;
const COLORS = ['#fff', '#f2c230', '#2b5fd8', '#d63a2f', '#6a3fb0', '#f08a24', '#1f9a4a', '#8a2a2a', '#111', '#f2c230', '#2b5fd8', '#d63a2f', '#6a3fb0', '#f08a24', '#1f9a4a', '#8a2a2a'];
const other = (p) => (p === 'you' ? 'cpu' : 'you');

function drawBall(ctx, b) {
  const r = TABLE.r;
  ctx.save();
  ctx.translate(OFF + b.x, OFF + b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, r, r * 0.9, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.fillStyle = b.id > 8 ? '#f5f1e6' : COLORS[b.id];
  ctx.fillRect(-r, -r, r * 2, r * 2);
  if (b.id > 8) { ctx.fillStyle = COLORS[b.id]; ctx.fillRect(-r, -r * 0.55, r * 2, r * 1.1); }
  if (b.id > 0) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.48, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(b.id), 0, 0.5);
  }
  const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

export default function PoolGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('pool');
  const g = useRef(null);
  const [hud, setHud] = useState({ turn: 'you', groups: { you: null, cpu: null }, msg: '', over: null, wins: 0 });

  const init = (keepWins) => {
    g.current = {
      balls: rackBalls(), phase: 'aim', turn: 'you', groups: { you: null, cpu: null },
      pull: null, ev: null, legal: [], shooter: 'you', wait: 0,
    };
    setHud(h => ({ turn: 'you', groups: { you: null, cpu: null }, msg: t('gamify.games.poolBreak', 'Your break - drag back from the white ball and let go'), over: null, wins: keepWins ? h.wins : 0 }));
  };
  useEffect(() => { init(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const take = (who, angle, power) => {
    const s = g.current;
    s.shooter = who;
    s.legal = legalTargets(s.balls, s.groups[who]).map(b => b.id);
    s.ev = { pocketed: [], firstHit: null, hits: 0 };
    shoot(s.balls, angle, power);
    s.phase = 'rolling';
  };

  const respot = (s) => {
    const cue = s.balls[0];
    cue.out = false; cue.vx = 0; cue.vy = 0;
    let x = 200;
    while (s.balls.some(b => b.id !== 0 && !b.out && Math.hypot(b.x - x, b.y - TABLE.h / 2) < TABLE.r * 2.2)) x -= 24;
    cue.x = Math.max(TABLE.r + 4, x); cue.y = TABLE.h / 2;
  };

  const resolve = () => {
    const s = g.current;
    const me = s.shooter;
    const foe = other(me);
    const { pocketed, firstHit } = s.ev;
    const cuePot = pocketed.includes(0);
    const nums = pocketed.filter(id => id !== 0);
    let foul = cuePot || firstHit == null || !s.legal.includes(firstHit);
    let msg = '';
    if (nums.includes(8)) {
      const gr = s.groups[me];
      const left = s.balls.filter(b => !b.out && b.id !== 0 && b.id !== 8 && gr && groupOf(b.id) === gr).length;
      const won = !foul && gr && left === 0;
      const winner = won ? me : foe;
      if (winner === 'you') submitBest(1 + (hud.wins || 0));
      setHud(h => ({ ...h, over: winner, wins: h.wins + (winner === 'you' ? 1 : 0), msg: won ? t('gamify.games.poolEightWin', 'The 8-ball drops - game over!') : t('gamify.games.poolEightLose', 'The 8-ball went in too early') }));
      s.phase = 'over';
      return;
    }
    if (!s.groups[me] && !foul) {
      const first = nums[0];
      if (first) { s.groups[me] = groupOf(first); s.groups[foe] = s.groups[me] === 'solid' ? 'stripe' : 'solid'; msg = `${me === 'you' ? t('gamify.games.you', 'You') : t('gamify.games.cpu', 'Computer')}: ${s.groups[me] === 'solid' ? t('gamify.games.solids', 'solids') : t('gamify.games.stripes', 'stripes')}. `; }
    }
    const mineIn = s.groups[me] ? nums.some(id => groupOf(id) === s.groups[me]) : false;
    if (cuePot) respot(s);
    const keep = !foul && mineIn;
    if (foul) msg += me === 'you' ? t('gamify.games.foulYou', 'Foul - computer to shoot') : t('gamify.games.foulCpu', 'Computer fouled - your shot');
    else if (keep) msg += me === 'you' ? t('gamify.games.potAgain', 'Nice pot - shoot again') : t('gamify.games.cpuAgain', 'Computer potted one and shoots again');
    else msg += me === 'you' ? t('gamify.games.missed', 'No pot - computer to shoot') : t('gamify.games.cpuMissed', 'Computer missed - your shot');
    s.turn = keep ? me : foe;
    s.phase = s.turn === 'cpu' ? 'cpuwait' : 'aim';
    s.wait = 0.9;
    setHud(h => ({ ...h, turn: s.turn, groups: { ...s.groups }, msg }));
  };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    if (s.phase === 'rolling') {
      stepPool(s.balls, dt, s.ev);
      if (allStopped(s.balls)) resolve();
    } else if (s.phase === 'cpuwait') {
      s.wait -= dt;
      if (s.wait <= 0) { const shot = cpuChoose(s.balls, s.groups.cpu); take('cpu', shot.angle, shot.power); }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // wooden rails + cloth
    ctx.fillStyle = '#3a2417'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.fill();
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.roundRect(5, 5, W - 10, H - 10, 18); ctx.fill();
    const cloth = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 1.6);
    cloth.addColorStop(0, '#1fa162'); cloth.addColorStop(1, '#0f6b43');
    ctx.fillStyle = cloth; ctx.fillRect(OFF - 4, OFF - 4, TABLE.w + 8, TABLE.h + 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(OFF + 200, OFF); ctx.lineTo(OFF + 200, OFF + TABLE.h); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(OFF + 560, OFF + TABLE.h / 2, 3, 0, 7); ctx.fill();
    for (const [px, py] of POCKETS) { ctx.fillStyle = '#060606'; ctx.beginPath(); ctx.arc(OFF + px, OFF + py, TABLE.pocketR + 2, 0, 7); ctx.fill(); }
    for (const b of s.balls) if (!b.out) drawBall(ctx, b);
    const cue = s.balls[0];
    if (s.pull && s.phase === 'aim' && !cue.out) {
      const tr = aimTrace(s.balls, s.pull.angle);
      ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(OFF + cue.x, OFF + cue.y); ctx.lineTo(OFF + tr.x, OFF + tr.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(OFF + tr.x, OFF + tr.y, TABLE.r, 0, 7); ctx.stroke();
      // the cue stick pulled back by the power
      const back = 18 + s.pull.power * 90;
      const ax = Math.cos(s.pull.angle);
      const ay = Math.sin(s.pull.angle);
      ctx.strokeStyle = '#e8c68a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(OFF + cue.x - ax * (back + 8), OFF + cue.y - ay * (back + 8)); ctx.lineTo(OFF + cue.x - ax * (back + 260), OFF + cue.y - ay * (back + 260)); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(14, H - 26, 160, 12);
      ctx.fillStyle = `hsl(${120 - s.pull.power * 120},85%,55%)`; ctx.fillRect(14, H - 26, 160 * s.pull.power, 12);
    }
  });

  const down = (e) => {
    const s = g.current;
    if (!s || s.phase !== 'aim' || s.turn !== 'you') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    s.pull = { angle: 0, power: 0, active: true };
    move(e);
  };
  const move = (e) => {
    const s = g.current;
    if (!s?.pull) return;
    const p = canvasPoint(e, canvas.current, W, H);
    const cue = s.balls[0];
    const dx = cue.x - (p.x - OFF);
    const dy = cue.y - (p.y - OFF);
    s.pull.angle = Math.atan2(dy, dx);
    s.pull.power = Math.min(1, Math.hypot(dx, dy) / 170);
  };
  const up = () => {
    const s = g.current;
    if (!s?.pull) return;
    const { angle, power } = s.pull;
    s.pull = null;
    if (power > 0.07 && s.phase === 'aim' && s.turn === 'you') take('you', angle, power);
  };

  const grpLabel = (p) => (hud.groups[p] ? (hud.groups[p] === 'solid' ? t('gamify.games.solids', 'solids') : t('gamify.games.stripes', 'stripes')) : t('gamify.games.open', 'open table'));
  const trays = (p) => (hud.groups[p] ? g.current?.balls.filter(b => b.out && groupOf(b.id) === hud.groups[p]) || [] : []);

  return (
    <GameFrame title={t('gamify.games.pool', '8-Ball Pool')} Icon={Circle} accent="#1f9a4a" score={hud.wins} scoreLabel={t('gamify.games.wins', 'Wins')} best={best} bestLabel={t('gamify.games.bestWins', 'Best wins')} onRestart={() => init(true)} maxWidth={920}
      hint={t('gamify.games.poolHint', 'Drag back from anywhere like pulling a cue - the further you pull, the harder the shot. Pot all your balls, then the 8.')}>
      <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center', flexWrap: 'wrap', fontWeight: 800, fontSize: 13 }}>
        {['you', 'cpu'].map(p => (
          <div key={p} style={{ ...ui.panel, display: 'flex', alignItems: 'center', gap: 8, outline: hud.turn === p && !hud.over ? '2px solid #ffd36b' : 'none' }}>
            <span>{p === 'you' ? t('gamify.games.you', 'You') : t('gamify.games.cpu', 'Computer')}</span>
            <span style={{ opacity: 0.7, fontWeight: 600 }}>{grpLabel(p)}</span>
            <span style={{ display: 'flex', gap: 2 }}>{trays(p).map(b => <i key={b.id} style={{ width: 11, height: 11, borderRadius: '50%', background: b.id > 8 ? '#f5f1e6' : COLORS[b.id], border: `2px solid ${COLORS[b.id]}`, display: 'inline-block' }} />)}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={{ ...ui.canvas, cursor: hud.turn === 'you' ? 'crosshair' : 'wait' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: hud.over === 'you' ? '#7dffa1' : '#ff8a8a' }}>{hud.over === 'you' ? t('gamify.games.youWin', 'You win!') : t('gamify.games.cpuWins', 'Computer wins')}</div>
            <div style={{ opacity: 0.8 }}>{hud.msg}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={() => init(true)}>{t('gamify.games.rematch', 'Rematch')}</button>
          </div>
        )}
      </div>
      <div style={{ ...ui.panel, fontWeight: 700, fontSize: 13.5, textAlign: 'center', minHeight: 20 }}>{hud.msg}</div>
    </GameFrame>
  );
}
