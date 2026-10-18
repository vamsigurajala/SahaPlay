import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Trophy } from 'lucide-react';
import { reportScore } from '../dailyGame';

// Shared pieces for the Game Room games: best-score storage, the frame every game
// sits in, a requestAnimationFrame loop, canvas scaling and touch/keyboard input.

const LS = 'sp_gamify_best_';

export function getBest(id) {
  try { return Number(localStorage.getItem(LS + id)) || 0; } catch { return 0; }
}

// Returns [best, submit(score)]. Higher is better unless `lowerIsBetter` (e.g. a time).
export function useBest(id, lowerIsBetter = false) {
  const [best, setBest] = useState(() => getBest(id));
  const submit = useCallback((score) => {
    if (!lowerIsBetter) reportScore(id, score); // feeds the game-of-the-day board
    setBest((b) => {
      const better = lowerIsBetter ? (b === 0 || score < b) : score > b;
      if (!better) return b;
      try { localStorage.setItem(LS + id, String(score)); } catch { /* storage blocked */ }
      return score;
    });
  }, [id, lowerIsBetter]);
  return [best, submit];
}

export function useRaf(cb, active = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return undefined;
    let id = 0;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      ref.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

// Sizes a canvas for the screen's pixel density and returns a ref to it. Drawing code
// keeps working in the logical w x h space.
export function useCanvas(w, h) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [w, h]);
  return ref;
}

export function canvasPoint(e, canvas, w, h) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / (r.width || 1)) * w, y: ((e.clientY - r.top) / (r.height || 1)) * h };
}

const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
// Tracks held keys; `onDown(key)` fires once per key press. Arrow keys and space are
// kept from scrolling the page while a game is open.
export function useKeys(onDown) {
  const keys = useRef({});
  const cb = useRef(onDown);
  cb.current = onDown;
  useEffect(() => {
    const down = (e) => {
      if (GAME_KEYS.includes(e.key)) e.preventDefault();
      if (!keys.current[e.key]) cb.current?.(e.key, e);
      keys.current[e.key] = true;
    };
    const up = (e) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

// Swipe detection on an element: calls onSwipe('up'|'down'|'left'|'right').
export function useSwipe(onSwipe, minDist = 24) {
  const start = useRef(null);
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  return {
    onPointerDown: (e) => { start.current = { x: e.clientX, y: e.clientY }; },
    onPointerUp: (e) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < minDist) return;
      if (Math.abs(dx) > Math.abs(dy)) cb.current(dx > 0 ? 'right' : 'left');
      else cb.current(dy > 0 ? 'down' : 'up');
    },
  };
}

export const ui = {
  card: { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(6px, 1.2vh, 12px)', color: '#fff', boxSizing: 'border-box' },
  panel: { background: 'rgba(14,12,30,0.82)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: '8px 14px' },
  btn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', borderRadius: 12, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  btnOn: { background: 'linear-gradient(135deg,#8b5cff,#4f46e5)', border: '1px solid rgba(255,255,255,0.4)' },
  canvas: { width: '100%', height: 'auto', display: 'block', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.65)', touchAction: 'none', background: '#0b0918' },
};

export function GameFrame({ title, Icon, score, scoreLabel, best, bestLabel, hint, onRestart, maxWidth = 760, accent = '#8b5cff', extra, children }) {
  const { t } = useTranslation();
  return (
    <div data-no-pull="true" onClick={(e) => e.stopPropagation()} style={{ ...ui.card, maxWidth }}>
      <div style={{ ...ui.panel, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'clamp(6px, 1.5vw, 10px)', flexWrap: 'wrap', padding: 'clamp(6px, 0.9vh, 8px) clamp(8px, 2vw, 14px)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.8vw, 10px)', fontWeight: 900, fontSize: 'clamp(14px, 3.8vw, 18px)', letterSpacing: '0.02em' }}>
          {Icon && <span style={{ width: 'clamp(28px, 6.5vw, 34px)', height: 'clamp(28px, 6.5vw, 34px)', borderRadius: 10, background: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={18} style={{ width: 'clamp(15px, 4vw, 19px)', height: 'clamp(15px, 4vw, 19px)' }} /></span>}
          <span style={{ whiteSpace: 'nowrap' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)', fontWeight: 800, fontSize: 'clamp(11.5px, 3vw, 14px)', flexWrap: 'wrap' }}>
          {score !== undefined && <span>{scoreLabel || t('gamify.games.score', 'Score')}: <span style={{ color: '#ffd36b' }}>{score}</span></span>}
          {best !== undefined && <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85 }}><Trophy size={14} color="#ffd36b" />{bestLabel || t('gamify.games.best', 'Best')}: {best}</span>}
          {onRestart && <button style={{ ...ui.btn, padding: 'clamp(4px, 0.8vh, 8px) clamp(8px, 2vw, 14px)', fontSize: 'clamp(11px, 2.8vw, 13px)' }} onClick={onRestart}><RotateCcw size={13} />{t('gamify.games.restart', 'Restart')}</button>}
          {extra}
        </div>
      </div>
      {children}
      {hint && <div style={{ fontSize: 'clamp(10.5px, 2.6vw, 12px)', opacity: 0.65, textAlign: 'center', maxWidth: 560, lineHeight: 1.3, padding: '0 4px' }}>{hint}</div>}
    </div>
  );
}

// On-screen arrows for phones. onPress(dir) fires on tap and repeats while held.
export function DPad({ onPress, extra, size = 52 }) {
  const timer = useRef(0);
  const stop = () => { clearInterval(timer.current); };
  useEffect(() => stop, []);
  const hold = (dir) => (e) => {
    e.preventDefault();
    onPress(dir);
    stop();
    timer.current = setInterval(() => onPress(dir), 140);
  };
  const b = { ...ui.btn, width: size, height: size, justifyContent: 'center', padding: 0, borderRadius: 14, touchAction: 'none' };
  const Btn = ({ dir, Icon }) => <button style={b} onPointerDown={hold(dir)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} aria-label={dir}><Icon size={22} /></button>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${size}px)`, gridTemplateRows: `repeat(2, ${size}px)`, gap: 6 }}>
        <span /><Btn dir="up" Icon={ArrowUp} /><span />
        <Btn dir="left" Icon={ArrowLeft} /><Btn dir="down" Icon={ArrowDown} /><Btn dir="right" Icon={ArrowRight} />
      </div>
      {extra}
    </div>
  );
}

export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
