import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from './lib/api';

// ─── Animated digit component ─────────────────────────────────────────────────
function CodeDigit({ char, index, revealed }) {
  return (
    <div
      style={{
        width: 64, height: 80,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(99,102,241,0.12)',
        border: `2px solid ${revealed ? '#6366f1' : 'rgba(99,102,241,0.25)'}`,
        borderRadius: 16,
        fontSize: 42, fontWeight: 900, letterSpacing: 0,
        color: revealed ? '#c7d2fe' : 'transparent',
        fontFamily: "'Courier New', monospace",
        transition: `all 0.4s cubic-bezier(0.34,1.56,0.64,1) ${index * 80}ms`,
        transform: revealed ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
        boxShadow: revealed ? '0 0 20px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
      }}
    >
      {char}
    </div>
  );
}

// ─── Pulsing ring animation ───────────────────────────────────────────────────
function PulsingRing({ color = '#6366f1', size = 120 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${color}`,
          animation: `tvPulse 2.4s ease-out ${i * 0.8}s infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `rgba(${color === '#10b981' ? '16,185,129' : '99,102,241'},0.15)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <TvIcon size={40} color={color} />
      </div>
    </div>
  );
}

function TvIcon({ size = 40, color = '#6366f1' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

function SpinnerIcon({ size = 36, color = '#6366f1' }) {
  const spinStyle = {
    animation: 'tvSpin 1s linear infinite',
    display: 'block',
  };
  return (
    <svg style={spinStyle} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

function CheckIcon({ size = 72, color = '#10b981' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function Countdown({ seconds }) {
  const pct = (seconds / 600) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: seconds < 60 ? '#f59e0b' : '#64748b', fontSize: 13, fontWeight: 600 }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Code expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TvPairing() {
  const [state, setState] = useState('welcome'); // welcome | connecting | ready | linked | expired | error
  const [code, setCode] = useState('');
  const [revealedCount, setRevealedCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const sockRef = useRef(null);

  const startPairing = () => {
    setState('connecting');
    // Minimal guest session so the Room page can work when we redirect
    if (!localStorage.getItem('watch_token')) {
      localStorage.setItem('watch_token', 'tv_guest_token');
      localStorage.setItem('watch_is_guest', 'true');
      localStorage.setItem('watch_username', 'Smart TV');
    }

    const sock = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000
    });
    sockRef.current = sock;

    sock.on('connect', () => {
      sock.emit('request_tv_code', { username: localStorage.getItem('watch_username') || 'Smart TV' });
    });

    sock.on('tv_code_generated', ({ code: c }) => {
      setCode(c);
      setState('ready');
      setSecondsLeft(600);
      // Reveal digits one by one
      setRevealedCount(0);
      c.split('').forEach((_, i) => {
        setTimeout(() => setRevealedCount(prev => prev + 1), i * 120 + 200);
      });
    });

    sock.on('tv_linked', ({ roomId, guestToken, guestUsername }) => {
      setState('linked');
      if (guestToken) {
        localStorage.setItem('watch_token', guestToken);
        localStorage.setItem('watch_username', guestUsername || 'smart_tv');
      }
      localStorage.setItem('watch_is_guest', 'true');
      setTimeout(() => {
        window.location.href = `/room/${roomId}?mode=tv`;
      }, 1800);
    });

    sock.on('tv_code_expired', () => {
      setState('expired');
    });

    sock.on('disconnect', () => {
      setState(prev => prev !== 'linked' ? 'error' : prev);
    });

    sock.on('connect_error', () => setState('error'));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (state === 'welcome' && (e.key === 'Enter' || e.keyCode === 13)) {
        startPairing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  // Socket lifecycle is independent of `state` — this must only tear the
  // socket down when the component actually unmounts. Previously this
  // cleanup lived in the [state]-keyed effect above, so it re-ran on every
  // state transition (including the very tick startPairing() creates the
  // socket and calls setState('connecting')), disconnecting the brand-new
  // socket before it ever finished connecting.
  useEffect(() => {
    return () => {
      sockRef.current?.disconnect();
    };
  }, []);

  // Safety net: if we're stuck on 'connecting' for too long (no
  // tv_code_generated or connect_error arrived), fail loudly instead of
  // spinning forever so regressions of this kind are obvious.
  useEffect(() => {
    if (state !== 'connecting') return;
    const timer = setTimeout(() => {
      setState(prev => (prev === 'connecting' ? 'error' : prev));
    }, 9000);
    return () => clearTimeout(timer);
  }, [state]);

  // Countdown timer
  useEffect(() => {
    if (state !== 'ready') return;
    const iv = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(iv); setState('expired'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [state]);

  const requestNewCode = () => {
    setState('connecting');
    setCode('');
    setRevealedCount(0);
    if (sockRef.current?.connected) {
      sockRef.current.emit('request_tv_code', { username: localStorage.getItem('watch_username') || 'Smart TV' });
    } else {
      startPairing();
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060714; }
        @keyframes tvPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes tvSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes tvFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tvGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 60px rgba(99,102,241,0.6); }
        }
        @keyframes successBounce {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* gcw-force-dark: this page is always dark-themed regardless of the site's
          light/dark setting (it's a standalone TV kiosk display, not theme-aware) —
          without it, the app-wide light-mode "force dark text" system (App.jsx)
          was matching every hardcoded white/light inline color here (including
          the Start Pairing button) and overriding it to near-black, unreadable
          against this page's own always-dark background. */}
      <div className="gcw-force-dark" style={{
        width: '100vw', height: '100vh',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, #060714 60%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
        position: 'fixed', inset: 0,
        overflow: 'hidden',
      }}>
        {/* Ambient bg dots */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 300 + i * 80, height: 300 + i * 80,
              borderRadius: '50%',
              border: '1px solid rgba(99,102,241,0.05)',
              top: `${20 + i * 8}%`, left: `${10 + i * 12}%`,
              transform: 'translate(-50%, -50%)',
            }} />
          ))}
        </div>

        {/* Branding */}
        <div style={{ position: 'absolute', top: 32, left: 40, display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TvIcon size={20} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px' }}>SahaPlay</span>
        </div>

        {/* ── WELCOME SCREEN ── */}
        {state === 'welcome' && (
          <div style={{ textAlign: 'center', animation: 'tvFadeIn 0.5s ease', maxWidth: 600, padding: '0 24px', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
              <PulsingRing size={110} />
            </div>

            <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px', marginBottom: 16 }}>
              SahaPlay TV
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1.6, marginBottom: 48 }}>
              Ready to pair this TV with your phone or laptop?<br/>
              Press <strong style={{ color: '#fff' }}>OK</strong> on your TV remote or click below to start.
            </p>

            <button
              onClick={startPairing}
              autoFocus
              style={{
                background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                border: '2px solid transparent', borderRadius: 16, padding: '18px 48px',
                color: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.transform = 'scale(1.05)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(99,102,241,0.4)'; }}
            >
              Start Pairing
            </button>
          </div>
        )}

        {/* ── CONNECTING ── */}
        {state === 'connecting' && (
          <div style={{ textAlign: 'center', animation: 'tvFadeIn 0.5s ease' }}>
            <div style={{ marginBottom: 28 }}><SpinnerIcon size={56} /></div>
            <h2 style={{ color: '#94a3b8', fontSize: 22, fontWeight: 700 }}>Connecting to server…</h2>
          </div>
        )}

        {/* ── READY: show the code ── */}
        {state === 'ready' && (
          <div style={{ textAlign: 'center', animation: 'tvFadeIn 0.5s ease', maxWidth: 640, padding: '0 24px', zIndex: 2 }}>
            {/* Big animated icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
              <PulsingRing size={110} />
            </div>

            <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, color: '#f8fafc', letterSpacing: '-1px', marginBottom: 12 }}>
              Cast to this TV
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1.6, marginBottom: 48 }}>
              Open <strong style={{ color: '#fff' }}>SahaPlay</strong> on your phone or laptop,<br/>
              click <strong style={{ color: '#c7d2fe' }}>Cast to TV</strong>, then enter this code:
            </p>

            {/* The big code display */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'center',
              marginBottom: 20,
              animation: 'tvGlow 3s ease-in-out infinite',
            }}>
              {code.split('').map((ch, i) => (
                <CodeDigit key={i} char={ch} index={i} revealed={i < revealedCount} />
              ))}
            </div>

            {/* Countdown */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
              <Countdown seconds={secondsLeft} />
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Instruction footer */}
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
              You can also open <span style={{ color: '#818cf8', fontWeight: 700 }}>{window.location.origin}/tv</span> in any browser on your device
            </p>
          </div>
        )}

        {/* ── LINKED ── */}
        {state === 'linked' && (
          <div style={{ textAlign: 'center', animation: 'tvFadeIn 0.5s ease', zIndex: 2 }}>
            <div style={{ marginBottom: 28, animation: 'successBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
              <CheckIcon size={80} />
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 900, color: '#10b981', marginBottom: 12, letterSpacing: '-1px' }}>
              Connected! 🎉
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 20 }}>Joining the room…</p>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {state === 'expired' && (
          <div style={{ textAlign: 'center', animation: 'tvFadeIn 0.5s ease', zIndex: 2 }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>⏱️</div>
            <h1 style={{ fontSize: 40, fontWeight: 900, color: '#f8fafc', marginBottom: 12 }}>Code Expired</h1>
            <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 36 }}>Your pairing code expired after 10 minutes.</p>
            <button onClick={requestNewCode} style={{
              background: 'linear-gradient(135deg,#6366f1,#a855f7)',
              border: 'none', borderRadius: 14, padding: '16px 36px',
              color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,102,241,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)'; }}
            >
              Get New Code
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {state === 'error' && (
          <div style={{ textAlign: 'center', animation: 'tvFadeIn 0.5s ease', zIndex: 2 }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>⚠️</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f8fafc', marginBottom: 12 }}>Connection Error</h1>
            <p style={{ color: '#94a3b8', fontSize: 17, marginBottom: 32, maxWidth: 400 }}>
              Could not connect to the SahaPlay server.<br/>Check your internet connection and try again.
            </p>
            <button onClick={() => window.location.reload()} style={{
              background: 'linear-gradient(135deg,#6366f1,#a855f7)',
              border: 'none', borderRadius: 14, padding: '14px 32px',
              color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
            }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </>
  );
}
