import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowRight, Shield } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 640;
const H = 400;
const GX0 = 120; // goal mouth
const GX1 = 520;
const GY0 = 110;
const GY1 = 250;
const KICKS = 5;
const SPOT = [W / 2, 360];
const zoneOf = (x) => (x < GX0 + (GX1 - GX0) / 3 ? 0 : x > GX1 - (GX1 - GX0) / 3 ? 2 : 1);

export default function PenaltyGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('penalty');
  const [hud, setHud] = useState({ you: 0, cpu: 0, round: 1, role: 'shoot', msg: '', over: null });
  const g = useRef(null);
  const keys = useKeys((k) => { if (k === 'ArrowLeft') pick(0); else if (k === 'ArrowDown') pick(1); else if (k === 'ArrowRight') pick(2); });

  const init = () => {
    g.current = { you: 0, cpu: 0, round: 1, role: 'shoot', phase: 'aim', aim: [W / 2, 180], meter: 0, ball: null, keeper: { zone: 1, x: W / 2, dive: 0 }, t: 0, result: '', yourKicks: 0, cpuKicks: 0, wait: 0 };
    setHud({ you: 0, cpu: 0, round: 1, role: 'shoot', msg: t('gamify.games.penStart', 'Aim at the goal and tap to shoot - tap when the ring is small for a sharper shot'), over: null });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(zone) { const s = g.current; if (s && s.role === 'defend' && s.phase === 'flight') s.keeper.pick = zone; }

  const settle = (s, result, who) => {
    s.phase = 'result'; s.wait = 1.2; s.result = result;
    if (result === 'goal') s[who] += 1;
    if (who === 'you') s.yourKicks += 1; else s.cpuKicks += 1;
    const msg = result === 'goal' ? (who === 'you' ? t('gamify.games.penGoal', 'GOAL!') : t('gamify.games.penCpuGoal', 'Computer scores')) : result === 'save' ? (who === 'you' ? t('gamify.games.penSaved', 'Saved by the keeper') : t('gamify.games.penYouSave', 'What a save!')) : t('gamify.games.penMiss', 'Missed the target');
    setHud(h => ({ ...h, you: s.you, cpu: s.cpu, msg }));
  };

  const nextRound = (s) => {
    const done = s.yourKicks >= KICKS && s.cpuKicks >= KICKS;
    const sudden = done && s.you === s.cpu;
    if (done && !sudden) {
      const won = s.you > s.cpu;
      if (won) submitBest(s.you - s.cpu);
      setHud(h => ({ ...h, over: won ? 'you' : 'cpu', round: s.round }));
      s.phase = 'over';
      return;
    }
    if (s.role === 'shoot') { s.role = 'defend'; s.phase = 'ready'; s.wait = 1.1; setHud(h => ({ ...h, role: 'defend', msg: t('gamify.games.penDefend', 'Your turn in goal - dive with left, down or right before the ball arrives') })); } else {
      s.role = 'shoot'; s.phase = 'aim'; s.round += 1;
      setHud(h => ({ ...h, role: 'shoot', round: s.round, msg: sudden ? t('gamify.games.penSudden', 'Sudden death!') : t('gamify.games.penAim', 'Your kick - aim and tap') }));
    }
    s.keeper = { zone: 1, x: W / 2, dive: 0 };
    s.ball = null;
  };

  const launch = (s, tx, ty, from) => { s.ball = { x: SPOT[0], y: SPOT[1], tx, ty, t: 0, dur: from === 'cpu' ? 0.85 : 0.65 }; s.phase = 'flight'; };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    s.t += dt;
    s.meter = (Math.sin(s.t * 4.2) + 1) / 2; // 0 = sharp, 1 = wild
    if (s.phase === 'ready') {
      s.wait -= dt;
      if (s.wait <= 0) {
        const aimZone = Math.random() < 0.14 ? -1 : Math.floor(Math.random() * 3);
        const tx = aimZone < 0 ? (Math.random() < 0.5 ? GX0 - 30 : GX1 + 30) : GX0 + (GX1 - GX0) * (aimZone + 0.5) / 3 + (Math.random() - 0.5) * 50;
        const ty = GY0 + 20 + Math.random() * (GY1 - GY0 - 40);
        s.cpuZone = aimZone;
        launch(s, tx, ty, 'cpu');
      }
    } else if (s.phase === 'flight' && s.ball) {
      const b = s.ball;
      b.t += dt;
      const f = Math.min(1, b.t / b.dur);
      if (s.role === 'shoot') {
        if (b.keeperZone === undefined) { b.keeperZone = Math.random() < 0.38 ? zoneOf(b.tx) : Math.floor(Math.random() * 3); s.keeper.pick = b.keeperZone; }
      }
      if (s.keeper.pick !== undefined) {
        const target = GX0 + (GX1 - GX0) * (s.keeper.pick + 0.5) / 3;
        s.keeper.x += (target - s.keeper.x) * Math.min(1, dt * 7);
        s.keeper.dive = clamp((s.keeper.x - W / 2) / 120, -1, 1);
      }
      if (f >= 1) {
        const inside = b.tx > GX0 && b.tx < GX1 && b.ty > GY0 && b.ty < GY1;
        const zone = zoneOf(b.tx);
        const who = s.role === 'shoot' ? 'you' : 'cpu';
        if (!inside) settle(s, 'miss', who);
        else if (s.keeper.pick === zone && Math.random() < 0.88) settle(s, 'save', who);
        else settle(s, 'goal', who);
      }
    } else if (s.phase === 'result') {
      s.wait -= dt;
      if (s.wait <= 0) nextRound(s);
    }
    // draw
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b2a5a'); sky.addColorStop(0.42, '#3b7ad0'); sky.addColorStop(0.43, '#2f9a4a'); sky.addColorStop(1, '#1e7a38');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(0, 175 + i * 19, W, 19); }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 70; i++) { ctx.fillRect(10 + (i * 53) % (W - 20), 120 + ((i * 37) % 50), 6, 8); }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(GX0 - 80, 168, GX1 - GX0 + 160, 120);
    ctx.beginPath(); ctx.arc(W / 2, SPOT[1] + 6, 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    // net + posts
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
    for (let x = GX0; x <= GX1; x += 16) { ctx.beginPath(); ctx.moveTo(x, GY0); ctx.lineTo(x, GY1); ctx.stroke(); }
    for (let y = GY0; y <= GY1; y += 14) { ctx.beginPath(); ctx.moveTo(GX0, y); ctx.lineTo(GX1, y); ctx.stroke(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(GX0, GY1 + 4); ctx.lineTo(GX0, GY0); ctx.lineTo(GX1, GY0); ctx.lineTo(GX1, GY1 + 4); ctx.stroke();
    // keeper
    const kx = s.keeper.x;
    ctx.save(); ctx.translate(kx, GY1 - 8); ctx.rotate(s.keeper.dive * 0.9);
    ctx.fillStyle = '#ffd24f'; ctx.beginPath(); ctx.roundRect(-14, -52, 28, 46, 8); ctx.fill();
    ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(0, -62, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd24f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(-30 - Math.abs(s.keeper.dive) * 8, -62); ctx.moveTo(14, -44); ctx.lineTo(30 + Math.abs(s.keeper.dive) * 8, -62); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(-12, -8, 10, 16); ctx.fillRect(2, -8, 10, 16);
    ctx.restore();
    // ball
    const b = s.ball;
    let bx = SPOT[0];
    let by = SPOT[1];
    let br = 15;
    if (b) { const f = Math.min(1, b.t / b.dur); const e = 1 - (1 - f) * (1 - f); bx = SPOT[0] + (b.tx - SPOT[0]) * e; by = SPOT[1] + (b.ty - SPOT[1]) * e - Math.sin(f * Math.PI) * 50; br = 15 - 9 * e; }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(bx, (b ? SPOT[1] + (b.ty - SPOT[1]) * (1 - (1 - Math.min(1, b.t / b.dur)) ** 2) : SPOT[1]) + 8, br, br * 0.35, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(bx, by, br * 0.38, 0, 7); ctx.fill();
    // crosshair
    if (s.role === 'shoot' && s.phase === 'aim') {
      const rr = 8 + s.meter * 34;
      ctx.strokeStyle = s.meter < 0.3 ? '#7dffa1' : s.meter < 0.65 ? '#ffd36b' : '#ff7a7a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.aim[0], s.aim[1], rr, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.aim[0] - 6, s.aim[1]); ctx.lineTo(s.aim[0] + 6, s.aim[1]); ctx.moveTo(s.aim[0], s.aim[1] - 6); ctx.lineTo(s.aim[0], s.aim[1] + 6); ctx.stroke();
    }
    if (s.phase === 'result') { ctx.textAlign = 'center'; ctx.font = '900 46px sans-serif'; ctx.fillStyle = s.result === 'goal' ? '#fff' : '#ffd36b'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 6; const txt = s.result === 'goal' ? 'GOAL!' : s.result === 'save' ? 'SAVED' : 'MISS'; ctx.strokeText(txt, W / 2, 70); ctx.fillText(txt, W / 2, 70); }
    if (s.role === 'defend' && (s.phase === 'ready' || s.phase === 'flight')) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t('gamify.games.penPickSide', 'Dive: left, middle or right'), W / 2, 36); }
  });

  const aimMove = (e) => { const s = g.current; if (s?.role === 'shoot' && s.phase === 'aim') { const p = canvasPoint(e, canvas.current, W, H); s.aim = [clamp(p.x, GX0 - 40, GX1 + 40), clamp(p.y, GY0 - 25, GY1 + 10)]; } };
  const shoot = (e) => {
    const s = g.current;
    if (!s) return;
    aimMove(e);
    if (s.role === 'shoot' && s.phase === 'aim') {
      const err = 8 + s.meter * 34;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * err * 1.1;
      launch(s, s.aim[0] + Math.cos(a) * r, s.aim[1] + Math.sin(a) * r * 0.8, 'you');
    } else if (s.role === 'defend' && s.phase === 'flight') {
      const p = canvasPoint(e, canvas.current, W, H);
      pick(zoneOf(p.x));
    }
  };

  const kicks = (n) => Math.min(KICKS, n);
  return (
    <GameFrame title={t('gamify.games.penalty', 'Penalty Shootout')} Icon={Shield} accent="#2f9a4a" score={`${hud.you} - ${hud.cpu}`} scoreLabel={t('gamify.games.youCpu', 'You - CPU')} best={best} bestLabel={t('gamify.games.bestMargin', 'Best margin')} onRestart={init} maxWidth={760}
      hint={t('gamify.games.penHint', 'Five kicks each, then sudden death. When you shoot: aim and tap - the smaller the ring, the more accurate. When the computer shoots: dive to the correct side.')}>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={{ ...ui.canvas, cursor: 'crosshair' }} onPointerMove={aimMove} onPointerDown={shoot} />
        {hud.over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.72)', borderRadius: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: hud.over === 'you' ? '#7dffa1' : '#ff8a8a' }}>{hud.over === 'you' ? t('gamify.games.youWin', 'You win!') : t('gamify.games.cpuWins', 'Computer wins')}</div>
            <div style={{ opacity: 0.85 }}>{hud.you} - {hud.cpu}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.rematch', 'Rematch')}</button>
          </div>
        )}
      </div>
      <div style={{ ...ui.panel, fontWeight: 700, fontSize: 13.5, minHeight: 20, textAlign: 'center' }}>{hud.msg} ({t('gamify.games.kicks', 'kicks')} {kicks(g.current?.yourKicks || 0)}/{KICKS} - {kicks(g.current?.cpuKicks || 0)}/{KICKS})</div>
      {hud.role === 'defend' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={ui.btn} onClick={() => pick(0)}><ArrowLeft size={18} /></button>
          <button style={ui.btn} onClick={() => pick(1)}><ArrowDown size={18} /></button>
          <button style={ui.btn} onClick={() => pick(2)}><ArrowRight size={18} /></button>
        </div>
      )}
    </GameFrame>
  );
}
