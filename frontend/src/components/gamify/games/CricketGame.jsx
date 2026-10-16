import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';
import { GameFrame, ui, useBest, useCanvas, useKeys, useRaf } from './shared';
import { BALLS, WICKETS, judge, leave, nextBall } from './cricketLogic';

// Batting against a computer bowler. Watch the ball come down the pitch, pick a
// side (left / straight / right) and swing so the bat meets the ball at the right
// moment. Perfect timing is a six, good timing a four. Two overs, three wickets.

const W = 420;
const H = 540;
const HORIZON = 150;
const FAR_Y = 178;
const NEAR_Y = 452;
const EVT = { run: 'Ready', };

const pitchHalf = (y) => 16 + ((y - FAR_Y) / (NEAR_Y - FAR_Y)) * 100;

export default function CricketGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('cricket');
  const [hud, setHud] = useState({ runs: 0, balls: 0, wkts: 0, msg: EVT.run, over: false });
  const [aim, setAimState] = useState(0);
  const s = useRef(null);
  const aimRef = useRef(0);
  const setAim = (a) => { aimRef.current = a; setAimState(a); };

  const init = () => {
    s.current = { phase: 'wait', t: 0, runs: 0, balls: 0, wkts: 0, line: 0, dur: 1.4, swung: false, swingT: -1, swingAim: 0, res: null, resT: 0, shake: 0, over: false, crowd: 0 };
    setHud({ runs: 0, balls: 0, wkts: 0, msg: t('gamify.games.cricketReady', 'Get ready'), over: false });
    setAim(0);
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const record = (res) => {
    const g = s.current;
    g.res = res; g.resT = 0; g.phase = 'result';
    g.runs += res.runs; g.balls += 1;
    if (res.wicket) g.wkts += 1;
    if (res.kind === 'six' || res.kind === 'four') g.crowd = 1;
    if (res.wicket) g.shake = 0.5;
    const over = g.balls >= BALLS || g.wkts >= WICKETS;
    g.over = over;
    if (over) submitBest(g.runs);
    setHud({ runs: g.runs, balls: g.balls, wkts: g.wkts, msg: res.msg, over: false, final: over });
  };

  const swing = (side) => {
    const g = s.current;
    if (!g || g.over || g.phase !== 'bowl' || g.swung) return;
    g.swung = true; g.swingT = g.t; g.swingAim = side;
    record(judge(g.t - g.dur, side, g.line));
  };
  const swingAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    swing(x < 0.36 ? -1 : x > 0.64 ? 1 : 0);
  };
  useKeys((k) => {
    if (k === 'ArrowLeft' || k === 'a') setAim(-1);
    else if (k === 'ArrowRight' || k === 'd') setAim(1);
    else if (k === 'ArrowDown' || k === 's') setAim(0);
    else if (k === ' ' || k === 'ArrowUp') swing(aimRef.current);
  });

  useRaf((dt) => {
    const g = s.current;
    const c = canvas.current;
    if (!g || !c) return;
    g.t += dt;
    g.shake = Math.max(0, g.shake - dt);
    g.crowd = Math.max(0, g.crowd - dt * 0.5);
    if (g.phase === 'wait' && !g.over) {
      g.waitT = (g.waitT || 0) + dt;
      if (g.waitT > 1.1) {
        const nb = nextBall(g.balls);
        g.line = nb.line; g.dur = nb.dur; g.t = 0; g.swung = false; g.waitT = 0; g.phase = 'bowl';
        setHud(h => ({ ...h, msg: t('gamify.games.cricketBowl', 'Here it comes') }));
      }
    } else if (g.phase === 'bowl' && !g.swung && g.t > g.dur + 0.4) {
      record(leave(g.line));
    } else if (g.phase === 'result') {
      g.resT += dt;
      if (g.resT > 1.7) {
        if (g.over) { g.phase = 'done'; setHud(h => ({ ...h, over: true })); } else { g.phase = 'wait'; g.waitT = 0; }
      }
    }

    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sx = g.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
    ctx.save(); ctx.translate(sx, 0);
    // sky and stadium
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#4aa8f0'); sky.addColorStop(1, '#bfe4ff');
    ctx.fillStyle = sky; ctx.fillRect(-10, 0, W + 20, HORIZON + 4);
    // crowd band
    ctx.fillStyle = '#3a2f66'; ctx.fillRect(-10, 70, W + 20, 84);
    const palette = ['#e0463a', '#2f7bd6', '#f2b630', '#2ea86a', '#a85ad6', '#ff7a3c', '#18a8b8', '#e0529f'];
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < 30; i++) {
        const x = 8 + i * 14 + (r % 2) * 7;
        const jump = g.crowd > 0 ? Math.abs(Math.sin(g.t * 9 + i + r)) * 7 * Math.min(1, g.crowd * 2) : 0;
        ctx.fillStyle = palette[(i * 3 + r * 5) % palette.length];
        ctx.beginPath(); ctx.arc(x, 90 + r * 15 - jump, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x, 83 + r * 15 - jump, 3.2, 0, 7); ctx.fill();
      }
    }
    // outfield with mown stripes
    ctx.fillStyle = '#3fa24a'; ctx.fillRect(-10, HORIZON, W + 20, H - HORIZON);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(-10, HORIZON + i * 44, W + 20, 44); }
    ctx.fillStyle = '#f4f1e6'; ctx.fillRect(-10, HORIZON - 4, W + 20, 4);
    // pitch
    ctx.fillStyle = '#c8a46c';
    ctx.beginPath(); ctx.moveTo(W / 2 - pitchHalf(FAR_Y - 20), FAR_Y - 20); ctx.lineTo(W / 2 + pitchHalf(FAR_Y - 20), FAR_Y - 20); ctx.lineTo(W / 2 + pitchHalf(H - 40), H - 40); ctx.lineTo(W / 2 - pitchHalf(H - 40), H - 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    const crease = (y, k = 1.25) => { ctx.beginPath(); ctx.moveTo(W / 2 - pitchHalf(y) * k, y); ctx.lineTo(W / 2 + pitchHalf(y) * k, y); ctx.stroke(); };
    crease(FAR_Y); crease(NEAR_Y + 6);
    // far stumps + bowler
    ctx.fillStyle = '#f3e3b8';
    for (const dx of [-5, 0, 5]) ctx.fillRect(W / 2 + dx - 1, FAR_Y - 24, 2, 24);
    const runUp = g.phase === 'wait' ? Math.min(1, (g.waitT || 0) / 1.1) : 1;
    const by = FAR_Y - 40 + runUp * 14;
    ctx.fillStyle = '#e0463a'; ctx.fillRect(W / 2 + 8 - 5, by - 6, 10, 18);
    ctx.fillStyle = '#d8a070'; ctx.beginPath(); ctx.arc(W / 2 + 8, by - 12, 5, 0, 7); ctx.fill();
    const armA = g.phase === 'wait' ? -2.8 + runUp * 2.4 : 0.5;
    ctx.strokeStyle = '#d8a070'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2 + 8, by - 2); ctx.lineTo(W / 2 + 8 + Math.sin(armA) * 11, by - 2 + Math.cos(armA) * -11); ctx.stroke();
    // near stumps (behind the batter)
    ctx.fillStyle = '#f3e3b8';
    for (const dx of [-12, 0, 12]) ctx.fillRect(W / 2 + dx - 2, NEAR_Y - 6, 4, 54);
    // ball position
    let bx = W / 2; let by2 = FAR_Y; let sc = 0.45; let visible = false;
    if (g.phase === 'bowl' || (g.phase === 'result' && !g.res?.dir && g.res?.kind !== 'six' && g.res?.kind !== 'four' && g.res?.runs === 0)) {
      const p = Math.min(1.35, g.t / g.dur);
      const pc = g.phase === 'result' ? 1.35 : p;
      const yy = FAR_Y + (NEAR_Y - FAR_Y) * Math.pow(Math.min(pc, 1.2), 1.55);
      const hop = pc < 0.68 ? (1 - pc / 0.68) * 56 : Math.abs(Math.sin(((pc - 0.68) / 0.32) * 1.5)) * 26;
      bx = W / 2 + g.line * pitchHalf(yy) * 0.34; by2 = yy - hop; sc = 0.45 + Math.min(pc, 1.2) * 1.5; visible = true;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(bx, yy + 2, 5 * sc, 2 * sc, 0, 0, 7); ctx.fill();
    } else if (g.phase === 'result' && g.res && (g.res.runs > 0)) {
      const u = Math.min(1, g.resT / 1.1);
      const far = g.res.kind === 'six' ? 1 : g.res.kind === 'four' ? 0.8 : 0.45;
      bx = W / 2 + (g.res.dir || 0) * 150 * u * far * 1.2 + (g.res.dir ? 0 : Math.sin(g.resT * 2) * 4);
      const gy = NEAR_Y - (NEAR_Y - HORIZON - 30) * u * far;
      by2 = g.res.kind === 'six' ? gy - Math.sin(u * Math.PI) * 170 : gy - Math.sin(u * Math.PI) * 40;
      sc = 1.6 - u * 1.1; visible = true;
    }
    if (visible) {
      ctx.fillStyle = '#d3182c'; ctx.beginPath(); ctx.arc(bx, by2, 6 * sc, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by2, 6 * sc, 0.4, 2.6); ctx.stroke();
    }
    // batter and bat
    const swingU = g.swung ? Math.min(1, (g.t - g.swingT) / 0.18) : 0;
    const side = g.swung ? g.swingAim : aimRef.current;
    const bX = W / 2 - 38 + side * 8;
    ctx.fillStyle = '#2f7bd6'; ctx.fillRect(bX - 14, NEAR_Y - 36, 28, 46);
    ctx.fillStyle = '#27406e'; ctx.fillRect(bX - 12, NEAR_Y + 10, 10, 30); ctx.fillRect(bX + 2, NEAR_Y + 10, 10, 30);
    ctx.fillStyle = '#d8a070'; ctx.beginPath(); ctx.arc(bX, NEAR_Y - 48, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b3f86'; ctx.beginPath(); ctx.arc(bX, NEAR_Y - 52, 13, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.translate(bX + 14, NEAR_Y - 20);
    const ang = g.swung ? -0.9 + swingU * (side === 0 ? 2.2 : 2.2 + side * 0.5) : -0.9 + Math.sin(g.t * 3) * 0.05;
    ctx.rotate(ang);
    ctx.fillStyle = '#d9b27a'; ctx.fillRect(-5, -4, 10, 68);
    ctx.fillStyle = '#2a2140'; ctx.fillRect(-2.5, -26, 5, 22);
    ctx.restore();
    ctx.restore();

    // aim guide and commentary
    ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    if (g.phase === 'bowl' || g.phase === 'wait') {
      for (const [i, lbl] of [[-1, t('gamify.games.cricketLeft', 'Left')], [0, t('gamify.games.cricketStraight', 'Straight')], [1, t('gamify.games.cricketRight', 'Right')]]) {
        ctx.globalAlpha = i === aimRef.current ? 1 : 0.4;
        ctx.fillText(lbl, W / 2 + i * 120, H - 14);
      }
      ctx.globalAlpha = 1;
    }
    if (g.phase === 'result' && g.res) {
      ctx.font = '900 26px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      const label = g.res.kind === 'six' ? 'SIX!' : g.res.kind === 'four' ? 'FOUR!' : g.res.wicket ? 'OUT!' : g.res.runs ? `${g.res.runs}` : '';
      ctx.fillStyle = g.res.wicket ? '#ff6a6a' : '#ffe27a';
      ctx.strokeText(label, W / 2, 130); ctx.fillText(label, W / 2, 130);
    }
  });

  const over = hud.over;
  return (
    <GameFrame title={t('gamify.games.cricket', 'Cricket')} Icon={Trophy} accent="#3fa24a" score={hud.runs} scoreLabel={t('gamify.games.runs', 'Runs')} best={best} onRestart={init} maxWidth={440}
      hint={t('gamify.games.cricketHint', 'Tap the left, middle or right of the pitch (or use the arrow keys and space) when the ball reaches the bat. Perfect timing is a six, good timing a four. Do not swing across the line of the ball.')}>
      <div style={{ display: 'flex', gap: 14, fontWeight: 800, fontSize: 13 }}>
        <span>{t('gamify.games.cricketBalls', 'Balls')} {hud.balls}/{BALLS}</span>
        <span>{t('gamify.games.cricketWickets', 'Wickets')} {hud.wkts}/{WICKETS}</span>
      </div>
      <div style={{ position: 'relative', width: '100%' }}>
        <canvas ref={canvas} style={{ ...ui.canvas, cursor: 'pointer', touchAction: 'none' }} onPointerDown={swingAt} />
        {over && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(5,4,14,0.62)', borderRadius: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{hud.wkts >= WICKETS ? t('gamify.games.cricketAllOut', 'All out') : t('gamify.games.cricketInnings', 'Innings over')}</div>
            <div style={{ opacity: 0.9 }}>{t('gamify.games.cricketFinal', 'You scored')} {hud.runs} {t('gamify.games.runs', 'Runs').toLowerCase()}</div>
            <button style={{ ...ui.btn, ...ui.btnOn }} onClick={init}>{t('gamify.games.playAgain', 'Play again')}</button>
          </div>
        )}
      </div>
      <div style={{ ...ui.panel, fontWeight: 700, fontSize: 13.5, minHeight: 20, textAlign: 'center', width: '100%' }}>{hud.msg}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[[-1, t('gamify.games.cricketLeft', 'Left')], [0, t('gamify.games.cricketStraight', 'Straight')], [1, t('gamify.games.cricketRight', 'Right')]].map(([v, lbl]) => (
          <button key={v} style={{ ...ui.btn, ...(aim === v ? ui.btnOn : null) }} onClick={() => setAim(v)}>{lbl}</button>
        ))}
        <button style={{ ...ui.btn, ...ui.btnOn }} onClick={() => swing(aimRef.current)}>{t('gamify.games.cricketSwing', 'Swing')}</button>
      </div>
    </GameFrame>
  );
}
