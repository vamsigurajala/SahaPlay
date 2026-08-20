import React, { useState, useEffect, useRef, useCallback } from 'react';

function pad(n) { return String(Math.max(0, n)).padStart(2, '0'); }

function formatMs(ms, showCentis = true) {
  const total = Math.max(0, ms);
  const totalSec = Math.floor(total / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const cs = Math.floor((total % 1000) / 10);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return showCentis ? `${pad(m)}:${pad(s)}.${pad(cs)}` : `${pad(m)}:${pad(s)}`;
}

const R = 115;
const CIRC = 2 * Math.PI * R;

// Shared across the whole room via the server (see backend/server.js's
// timer_action/timer_sync handlers) — Start/Pause/Reset used to be 100% local
// per-client state, so everyone's copy drifted independently instead of
// staying in sync. The server now owns the authoritative phase/mode/
// baseValueMs/startedAt/totalMs; every client renders the SAME broadcast
// (timer_state) by computing elapsed/remaining from the shared startedAt
// epoch, so a click here shows up for everyone at (network-latency-bound)
// the same moment, not "whenever their own local ticker happens to notice."
export default function TimerActivity({ isLight = false, socket, roomId }) {
  const [mode, setMode] = useState('stopwatch');
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [cdH, setCdH] = useState(0);
  const [cdM, setCdM] = useState(5);
  const [cdS, setCdS] = useState(0);

  const startedAtRef = useRef(null);
  const baseValueRef = useRef(0);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const getTotalMs = useCallback(() => (cdH * 3600 + cdM * 60 + cdS) * 1000, [cdH, cdM, cdS]);

  // Applies a server-broadcast state snapshot — the single source of truth,
  // identical for every client in the room regardless of who triggered it.
  const applyServerState = useCallback((ts) => {
    if (!ts) return;
    setMode(ts.mode);
    setPhase(ts.phase);
    baseValueRef.current = ts.baseValueMs || 0;
    startedAtRef.current = ts.startedAt || null;
    // Reflects the agreed-on countdown duration in the H/M/S inputs so they
    // don't silently drift back to whatever this client last typed —
    // harmless while running (the inputs aren't shown then anyway).
    if (ts.mode === 'countdown' && ts.totalMs) {
      const totalSec = Math.round(ts.totalMs / 1000);
      setCdH(Math.floor(totalSec / 3600));
      setCdM(Math.floor((totalSec % 3600) / 60));
      setCdS(totalSec % 60);
    }
    if (ts.phase === 'running') {
      const delta = Date.now() - ts.startedAt;
      if (ts.mode === 'stopwatch') setElapsed(ts.baseValueMs + delta);
      else setRemaining(Math.max(0, ts.baseValueMs - delta));
    } else if (ts.mode === 'stopwatch') {
      setElapsed(ts.baseValueMs || 0);
    } else {
      setRemaining(ts.baseValueMs || 0);
    }
  }, []);

  // Learns the room's current timer state the moment this view mounts
  // (switching into it, joining mid-session, reconnecting) — without this,
  // a client would only find out about the timer on the NEXT action anyone
  // takes, showing a stale idle/zero state until then.
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit('timer_sync', { roomId });
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket) return;
    const onState = (ts) => applyServerState(ts);
    socket.on('timer_state', onState);
    return () => socket.off('timer_state', onState);
  }, [socket, applyServerState]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const delta = Date.now() - startedAtRef.current;
      if (modeRef.current === 'stopwatch') {
        setElapsed(baseValueRef.current + delta);
      } else {
        const rem = baseValueRef.current - delta;
        if (rem <= 0) { setRemaining(0); setPhase('done'); }
        else setRemaining(rem);
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  const emitAction = (action, extra) => {
    if (!socket || !roomId) return;
    socket.emit('timer_action', { roomId, action, ...extra });
  };

  const handleStart = () => {
    emitAction('start', mode === 'countdown' ? { totalMs: getTotalMs() } : undefined);
  };

  const handlePause = () => emitAction('pause');

  const handleReset = () => emitAction('reset');

  const switchMode = (m) => {
    if (phase === 'running') return;
    emitAction('mode', { mode: m });
  };

  const displayMs = mode === 'stopwatch' ? elapsed : (phase === 'idle' ? getTotalMs() : remaining);
  const totalMs = getTotalMs();
  const progressRatio = mode === 'countdown' && totalMs > 0
    ? (phase === 'idle' ? 1 : displayMs / totalMs)
    : 1;
  const dashOffset = CIRC * (1 - Math.max(0, Math.min(1, progressRatio)));
  const isDone = phase === 'done';
  const ringColor = isDone ? '#ef4444' : mode === 'countdown' ? 'var(--brand-2)' : 'var(--brand-1)';

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const numInput = (setter) => (e) => {
    if (phase === 'running') return;
    setter(clamp(parseInt(e.target.value) || 0, 0, 59));
    setPhase('idle'); setRemaining(0);
  };

  // Theme tokens
  const bg = isLight
    ? 'radial-gradient(ellipse at 50% 25%, rgba(var(--brand-1-rgb),0.06) 0%, #f8fafc 70%)'
    : 'radial-gradient(ellipse at 50% 25%, rgba(var(--brand-1-rgb),0.14) 0%, #050508 65%)';
  const timeColor = isDone ? '#ef4444' : (isLight ? '#0f172a' : '#ffffff');
  const timeShadow = isDone
    ? '0 0 32px rgba(239,68,68,0.35)'
    : isLight
      ? `0 2px 12px ${ringColor}33`
      : `0 0 32px ${ringColor}55`;
  const subColor = isLight ? '#64748b' : 'rgba(255,255,255,0.25)';
  const toggleBg = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
  const toggleBorder = isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.07)';
  const toggleInactiveColor = isLight ? '#94a3b8' : 'rgba(255,255,255,0.35)';
  const ringTrack = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
  const inputBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
  const inputBorder = isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)';
  const inputColor = isLight ? '#0f172a' : '#ffffff';
  const resetBtnBg = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
  const resetBtnBorder = isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)';
  const resetBtnColor = isLight ? '#64748b' : '#64748b';
  const resetBtnHoverBg = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
  const resetBtnHoverColor = isLight ? '#0f172a' : '#ffffff';
  const sepColor = isLight ? '#cbd5e1' : '#2d3748';

  return (
    <div className="timer-container" style={{ background: bg }}>

      {/* Ring + display (Left Side on mobile) */}
      <div className="timer-ring-wrapper">
        <svg viewBox="0 0 270 270" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="135" cy="135" r={R} fill="none" stroke={ringTrack} strokeWidth="10" />
          <circle cx="135" cy="135" r={R} fill="none"
            stroke={ringColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={dashOffset}
            style={{
              transition: phase === 'running' ? 'stroke-dashoffset 0.05s linear' : 'stroke-dashoffset 0.4s ease',
              filter: `drop-shadow(0 0 ${isLight ? '6px' : '10px'} ${ringColor}${isLight ? '66' : '99'})`,
            }}
          />
        </svg>

        <div className="timer-display-inner">
          <span className={`timer-time-text ${displayMs >= 3600000 ? 'long-time' : ''}`} style={{
            color: timeColor,
            textShadow: timeShadow,
          }}>
            {formatMs(displayMs, mode === 'stopwatch')}
          </span>

          {isDone && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#ef4444',
              letterSpacing: '2.5px', textTransform: 'uppercase',
              animation: 'tmr-pulse 1s ease-in-out infinite',
            }}>Time's up!</span>
          )}
          {!isDone && phase === 'idle' && (
            <span style={{ fontSize: 11, color: subColor, fontWeight: 600, letterSpacing: '1.5px' }}>READY</span>
          )}
          {!isDone && phase === 'running' && (
            <span style={{ fontSize: 10, color: mode === 'countdown' ? 'var(--brand-2)' : 'var(--brand-1)', fontWeight: 700, letterSpacing: '1.5px' }}>
              {mode === 'countdown' ? 'COUNTING' : 'RUNNING'}
            </span>
          )}
          {!isDone && phase === 'paused' && (
            <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1.5px' }}>PAUSED</span>
          )}
        </div>
      </div>

      {/* Right controls column on mobile/tablet */}
      <div className="timer-right-content">
        {/* Mode toggle */}
        <div className="timer-toggle" style={{
          background: toggleBg, border: toggleBorder,
        }}>
          {[['stopwatch', 'Stopwatch'], ['countdown', 'Timer']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={mode === m ? 'stay-white' : ''}
              style={{
                padding: '9px 28px', borderRadius: 10, border: 'none',
                cursor: phase === 'running' ? 'not-allowed' : 'pointer',
                background: mode === m ? 'linear-gradient(135deg,var(--brand-1),var(--brand-2))' : 'transparent',
                color: mode === m ? '#ffffff' : toggleInactiveColor,
                fontSize: 13, fontWeight: 800, transition: 'all 0.22s',
                boxShadow: mode === m ? '0 4px 16px rgba(var(--brand-1-rgb),0.35)' : 'none',
                opacity: phase === 'running' && mode !== m ? 0.35 : 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Countdown inputs */}
        {mode === 'countdown' && phase !== 'running' && !isDone && (
          <div className="timer-inputs-wrapper">
            {[['H', cdH, setCdH, 23], ['M', cdM, setCdM, 59], ['S', cdS, setCdS, 59]].map(([lbl, val, setter, max], i) => (
              <React.Fragment key={lbl}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span className="timer-input-label" style={{ color: subColor }}>{lbl}</span>
                  <input
                    type="number" min={0} max={max} value={val}
                    onChange={numInput(setter)}
                    disabled={phase === 'paused'}
                    className="timer-input-box"
                    style={{
                      background: inputBg,
                      border: inputBorder,
                      color: phase === 'paused' ? subColor : inputColor,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(var(--brand-1-rgb),0.5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'; }}
                  />
                </div>
                {i < 2 && <span className="timer-input-sep" style={{ color: sepColor }}>:</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="timer-controls">
          {/* Reset */}
          <button
            onClick={handleReset}
            title="Reset"
            className="timer-btn-reset"
            style={{
              background: resetBtnBg, border: resetBtnBorder,
              color: resetBtnColor, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = resetBtnHoverBg; e.currentTarget.style.color = resetBtnHoverColor; }}
            onMouseLeave={e => { e.currentTarget.style.background = resetBtnBg; e.currentTarget.style.color = resetBtnColor; }}
          >
            <svg className="timer-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
            </svg>
          </button>

          {/* Start / Pause */}
          <button
            onClick={phase === 'running' ? handlePause : handleStart}
            disabled={mode === 'countdown' && phase === 'idle' && getTotalMs() === 0}
            className="timer-btn-start"
            style={{
              background: isDone
                ? (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)')
                : phase === 'running'
                  ? (isLight ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.15)')
                  : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
              cursor: (mode === 'countdown' && phase === 'idle' && getTotalMs() === 0) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: phase === 'running'
                ? '0 0 0 2px rgba(245,158,11,0.4), 0 8px 28px rgba(245,158,11,0.15)'
                : isDone ? 'none'
                : '0 8px 32px rgba(var(--brand-1-rgb),0.45)',
              transition: 'all 0.22s',
              opacity: (mode === 'countdown' && phase === 'idle' && getTotalMs() === 0) ? 0.3 : 1,
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'scale(1.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {phase === 'running' ? (
              <svg className="timer-svg-icon-large" viewBox="0 0 24 24" fill="rgba(245,158,11,0.9)" stroke="none">
                <rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg className="timer-svg-icon-large" viewBox="0 0 24 24" fill="#fff" stroke="none">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Spacer for symmetry */}
          <div className="timer-btn-spacer" />
        </div>
      </div>

      <style>{`
        @keyframes tmr-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        
        .timer-container {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', 'Inter', sans-serif;
          user-select: none;
          overflow: hidden;
          padding: 10px;
          box-sizing: border-box;
        }

        .timer-right-content {
          display: contents;
        }

        .timer-toggle {
          display: flex;
          gap: 3px;
          margin-bottom: 30px;
          border-radius: 14px;
          padding: 4px;
        }

        .timer-ring-wrapper {
          position: relative;
          width: 250px;
          height: 250px;
          margin-bottom: 24px;
        }

        .timer-display-inner {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .timer-time-text {
          font-size: 54px;
          font-weight: 900;
          letter-spacing: -3px;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          transition: color 0.3s, text-shadow 0.3s;
        }
        
        .timer-time-text.long-time {
          font-size: 44px;
        }

        .timer-inputs-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          margin-bottom: 24px;
        }

        .timer-input-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .timer-input-box {
          width: 62px;
          height: 50px;
          border-radius: 12px;
          font-size: 22px;
          font-weight: 800;
          text-align: center;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .timer-input-box::-webkit-inner-spin-button,
        .timer-input-box::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .timer-input-sep {
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .timer-controls {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .timer-btn-reset {
          width: 50px;
          height: 50px;
          border-radius: 14px;
        }

        .timer-btn-start {
          width: 78px;
          height: 78px;
          border-radius: 22px;
        }

        .timer-btn-spacer {
          width: 50px;
          height: 50px;
        }

        .timer-svg-icon {
          width: 20px;
          height: 20px;
        }

        .timer-svg-icon-large {
          width: 28px;
          height: 28px;
        }

        /* iPad / Tablet viewports & Medium Heights */
        @media (max-width: 1024px) or (max-height: 700px) {
          .timer-container {
            flex-direction: row;
            justify-content: space-evenly;
            align-items: center;
            padding: 8px;
          }
          .timer-right-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          .timer-toggle {
            margin-bottom: 0;
          }
          .timer-ring-wrapper {
            width: 170px;
            height: 170px;
            margin-bottom: 0;
          }
          .timer-display-inner {
            gap: 4px;
          }
          .timer-time-text {
            font-size: 32px;
          }
          .timer-time-text.long-time {
            font-size: 26px;
          }
          .timer-inputs-wrapper {
            margin-bottom: 0;
            gap: 4px;
          }
          .timer-input-box {
            width: 44px;
            height: 36px;
            font-size: 16px;
            border-radius: 8px;
          }
          .timer-input-label {
            font-size: 8px;
          }
          .timer-input-sep {
            font-size: 16px;
            margin-bottom: 4px;
          }
          .timer-controls {
            gap: 12px;
          }
          .timer-btn-start {
            width: 56px;
            height: 56px;
            border-radius: 16px;
          }
          .timer-btn-start svg {
            width: 22px;
            height: 22px;
          }
          .timer-btn-reset, .timer-btn-spacer {
            width: 40px;
            height: 40px;
            border-radius: 12px;
          }
          .timer-btn-reset svg {
            width: 18px;
            height: 18px;
          }
        }

        /* Mobile viewports */
        @media (max-width: 500px) or (max-height: 500px) {
          .timer-container {
            flex-direction: row;
            justify-content: space-evenly;
            align-items: center;
            padding: 4px;
          }
          .timer-right-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .timer-toggle {
            margin-bottom: 0;
          }
          .timer-toggle button {
            padding: 5px 12px !important;
            font-size: 10px !important;
            border-radius: 8px !important;
          }
          .timer-ring-wrapper {
            width: 130px;
            height: 130px;
            margin-bottom: 0;
          }
          .timer-display-inner {
            gap: 2px;
          }
          .timer-display-inner span:not(.timer-time-text) {
            font-size: 8px !important;
            letter-spacing: 1px !important;
          }
          .timer-time-text {
            font-size: 22px;
            letter-spacing: -1px;
          }
          .timer-time-text.long-time {
            font-size: 16px;
            letter-spacing: -0.5px;
          }
          .timer-inputs-wrapper {
            margin-bottom: 0;
            gap: 2px;
          }
          .timer-input-box {
            width: 32px;
            height: 26px;
            font-size: 12px;
            border-radius: 6px;
          }
          .timer-input-label {
            font-size: 7px;
            margin-bottom: 1px;
            letter-spacing: 0.5px;
          }
          .timer-input-sep {
            font-size: 12px;
            margin-bottom: 2px;
          }
          .timer-controls {
            gap: 8px;
          }
          .timer-btn-start {
            width: 42px;
            height: 42px;
            border-radius: 12px;
          }
          .timer-btn-start svg {
            width: 16px;
            height: 16px;
          }
          .timer-btn-reset, .timer-btn-spacer {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }
          .timer-btn-reset svg {
            width: 14px;
            height: 14px;
          }
        }
      `}</style>
    </div>
  );
}
