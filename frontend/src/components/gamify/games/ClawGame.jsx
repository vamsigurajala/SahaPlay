import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowRight, Grab } from 'lucide-react';
import { GameFrame, canvasPoint, clamp, ui, useBest, useCanvas, useKeys, useRaf } from './shared';

const W = 380;
const H = 520;
const FLOOR = 470;
const CHUTE = 64;
const TRIES = 6;
const COLORS = ['#ff6fb5', '#5ad1ff', '#ffcf5a', '#8dff9c', '#b04fff', '#ff8a5a', '#fff'];

function makePrizes() {
  const list = [];
  let guard = 0;
  while (list.length < 14 && guard++ < 400) {
    const r = 24 + Math.random() * 6;
    const x = CHUTE + 40 + Math.random() * (W - CHUTE - 80);
    const y = FLOOR - r + (Math.random() < 0.35 ? -r * 1.2 : 0);
    if (list.every(p => Math.hypot(p.x - x, p.y - y) > (p.r + r) * 0.85)) list.push({ x, y, r, c: COLORS[list.length % COLORS.length], id: list.length });
  }
  return list.sort((a, b) => a.y - b.y);
}

export default function ClawGame() {
  const { t } = useTranslation();
  const canvas = useCanvas(W, H);
  const [best, submitBest] = useBest('claw');
  const [hud, setHud] = useState({ won: 0, tries: TRIES, msg: '', over: false });
  const g = useRef(null);
  const keys = useKeys((k) => { if (k === ' ' || k === 'Enter') drop(); });

  const init = () => {
    g.current = { x: 200, y: 60, open: 1, phase: 'move', prizes: makePrizes(), held: null, won: 0, tries: TRIES, falling: null, t: 0, ty: null };
    setHud({ won: 0, tries: TRIES, msg: t('gamify.games.clawStart', 'Line the claw up over a toy, then press Drop'), over: false });
  };
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function drop() {
    const s = g.current;
    if (!s || s.phase !== 'move' || s.tries <= 0) return;
    s.tries -= 1;
    s.phase = 'down';
    setHud(h => ({ ...h, tries: s.tries, msg: '' }));
  }

  const finishTry = (msg) => {
    const s = g.current;
    s.phase = 'move';
    const over = s.tries <= 0;
    if (over) submitBest(s.won);
    setHud({ won: s.won, tries: s.tries, msg: over ? `${t('gamify.games.clawOver', 'Out of tries')} - ${s.won}` : msg, over });
  };

  useRaf((dt) => {
    const s = g.current;
    const c = canvas.current;
    if (!s || !c) return;
    const k = keys.current;
    if (s.phase === 'move') {
      if (k.ArrowLeft || k.a || k.A) s.x -= 180 * dt;
      if (k.ArrowRight || k.d || k.D) s.x += 180 * dt;
      if (s.ty != null) { s.x += clamp(s.ty - s.x, -260 * dt, 260 * dt); }
    }
    s.x = clamp(s.x, 26, W - 26);
    if (s.phase === 'down') {
      s.y += 230 * dt;
      const hit = s.prizes.find(p => Math.abs(p.x - s.x) < p.r + 10 && s.y + 34 >= p.y - p.r * 0.6);
      if (s.y >= FLOOR - 10 || hit) { s.phase = 'close'; s.t = 0; s.target = hit || null; }
    } else if (s.phase === 'close') {
      s.t += dt; s.open = Math.max(0, 1 - s.t / 0.5);
      if (s.t >= 0.55) {
        const p = s.target;
        if (p) {
          const grip = 1 - Math.min(1, Math.abs(p.x - s.x) / (p.r + 6));
          s.held = Math.random() < 0.3 + 0.65 * grip ? p : null;
          s.slipAt = s.held && Math.random() < (1 - grip) * 0.8 ? s.y - 120 - Math.random() * 120 : null;
        } else s.held = null;
        s.phase = 'up';
      }
    } else if (s.phase === 'up') {
      s.y -= 200 * dt;
      if (s.held) { s.held.x = s.x; s.held.y = s.y + 34 + s.held.r * 0.35; }
      if (s.held && s.slipAt != null && s.y < s.slipAt) {
        s.falling = s.held; s.held = null; s.slipAt = null;
      }
      if (s.y <= 60) { s.y = 60; s.phase = 'return'; }
    } else if (s.phase === 'return') {
      s.x += clamp(CHUTE / 2 - s.x, -230 * dt, 230 * dt);
      if (s.held) { s.held.x = s.x; s.held.y = s.y + 34 + s.held.r * 0.35; }
      if (Math.abs(s.x - CHUTE / 2) < 2) { s.phase = 'release'; s.t = 0; }
    } else if (s.phase === 'release') {
      s.t += dt; s.open = Math.min(1, s.t / 0.4);
      if (s.t > 0.2 && s.held) { s.falling = s.held; s.held.chute = true; s.held = null; }
      if (s.t >= 0.6) {
        const won = s.falling?.chute;
        if (won) { s.prizes = s.prizes.filter(p => p !== s.falling); s.won += 1; }
        s.falling = null;
        s.phase = 'back';
        s.msg = won ? t('gamify.games.clawWin', 'You got one!') : t('gamify.games.clawMiss', 'Missed - try again');
      }
    } else if (s.phase === 'back') {
      s.open = Math.min(1, s.open + dt * 3);
      s.x += clamp(200 - s.x, -260 * dt, 260 * dt);
      if (Math.abs(s.x - 200) < 3) finishTry(s.msg);
    }
    if (s.falling) {
      const f = s.falling;
      const floorY = f.chute ? FLOOR + 10 : FLOOR - f.r;
      f.y = Math.min(floorY, f.y + 420 * dt);
      if (!f.chute && f.y >= floorY) s.falling = null;
      if (f.chute) f.x += clamp(CHUTE / 2 - f.x, -40 * dt, 40 * dt);
    }
    // draw
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#25134f'); bg.addColorStop(1, '#10082a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(190,233,255,0.07)'; ctx.fillRect(8, 8, W - 16, FLOOR + 22 - 8);
    ctx.fillStyle = '#ff4fd8'; ctx.fillRect(0, FLOOR + 14, W, H - FLOOR - 14);
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, FLOOR - 40, CHUTE, 80);
    ctx.fillStyle = '#ffd36b'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('WIN', CHUTE / 2, FLOOR - 48);
    const toys = [...s.prizes, ...(s.falling && !s.prizes.includes(s.falling) ? [s.falling] : [])];
    for (const p of toys) {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.7, p.y - p.r * 0.8, p.r * 0.35, 0, 7); ctx.arc(p.x + p.r * 0.7, p.y - p.r * 0.8, p.r * 0.35, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - 2, 2.6, 0, 7); ctx.arc(p.x + p.r * 0.35, p.y - 2, 2.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y + p.r * 0.3, p.r * 0.25, 0, Math.PI); ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 2; ctx.stroke();
    }
    // rail, cable, claw
    ctx.fillStyle = '#9aa0b3'; ctx.fillRect(14, 32, W - 28, 8);
    ctx.strokeStyle = '#cfd3dd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x, 40); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.fillStyle = '#ffd36b'; ctx.fillRect(s.x - 16, 34, 32, 12);
    ctx.fillStyle = '#cfd3dd'; ctx.beginPath(); ctx.roundRect(s.x - 13, s.y, 26, 14, 4); ctx.fill();
    ctx.strokeStyle = '#e8ecf5'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      const spread = 8 + s.open * 20;
      ctx.beginPath(); ctx.moveTo(s.x + sgn * 10, s.y + 12); ctx.lineTo(s.x + sgn * spread, s.y + 36); ctx.lineTo(s.x + sgn * (spread - 14 + (1 - s.open) * 8), s.y + 54); ctx.stroke();
    }
  });

  const move = (e) => { const s = g.current; if (s && (e.buttons || e.pointerType === 'touch')) s.ty = canvasPoint(e, canvas.current, W, H).x; };
  const holdTimer = useRef(0);
  const release = () => { clearInterval(holdTimer.current); };
  const hold = (dx) => (e) => {
    e.preventDefault();
    const s = g.current;
    if (!s) return;
    s.ty = null;
    release();
    holdTimer.current = setInterval(() => { if (g.current?.phase === 'move') g.current.x += dx; }, 16);
  };
  useEffect(() => release, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameFrame title={t('gamify.games.claw', 'Claw Machine')} Icon={Grab} accent="#ff4fd8" score={hud.won} scoreLabel={t('gamify.games.toys', 'Toys won')} best={best} bestLabel={t('gamify.games.bestToys', 'Best')} onRestart={init} maxWidth={440}
      hint={t('gamify.games.clawHint', 'Move the claw with the arrows (or drag across the glass). The closer you are to the centre of a toy, the better the grip. You get 6 tries.')}>
      <canvas ref={canvas} style={ui.canvas} onPointerMove={move} onPointerDown={move} onPointerUp={() => { if (g.current) g.current.ty = null; }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button style={{ ...ui.btn, width: 56, height: 56, justifyContent: 'center', touchAction: 'none' }} onPointerDown={hold(-3.4)} onPointerUp={release} onPointerLeave={release} aria-label="left"><ArrowLeft size={22} /></button>
        <button style={{ ...ui.btn, ...ui.btnOn, height: 56, padding: '0 28px', fontSize: 16, justifyContent: 'center' }} onClick={drop} disabled={hud.over}><ArrowDown size={20} />{t('gamify.games.drop', 'Drop')} ({hud.tries})</button>
        <button style={{ ...ui.btn, width: 56, height: 56, justifyContent: 'center', touchAction: 'none' }} onPointerDown={hold(3.4)} onPointerUp={release} onPointerLeave={release} aria-label="right"><ArrowRight size={22} /></button>
      </div>
      <div style={{ ...ui.panel, fontWeight: 700, fontSize: 13.5, minHeight: 20, textAlign: 'center' }}>{hud.msg}</div>
    </GameFrame>
  );
}
