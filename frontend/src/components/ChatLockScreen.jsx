import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, ShieldAlert, Timer, Eye, EyeOff, ChevronRight, Loader2, Key, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const API = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;
const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 4; 
const LOCKOUT_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30000; // 30 seconds

function CooldownTimer({ blockedUntil, onExpired }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
      setRemaining(diff);
      if (diff === 0) onExpired?.();
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [blockedUntil, onExpired]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.05)',
      border: '1px solid rgba(239, 68, 68, 0.12)',
      borderRadius: 24,
      padding: 'clamp(20px, 5vh, 32px) clamp(16px, 4vw, 24px)',
      boxSizing: 'border-box',
      textAlign: 'center',
      margin: '20px 0',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ padding: 16, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', position: 'relative' }}>
           <Timer size={28} color="#f87171" />
           <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.2)', animation: 'ping 2s infinite' }} />
        </div>
      </div>
      <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Security Lockout</div>
      <div style={{ color: '#fff', fontWeight: 900, fontSize: '3rem', letterSpacing: 2, fontFamily: 'monospace', lineHeight: 1 }}>
        {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 16, lineHeight: 1.6, fontWeight: 500 }}>Too many failed attempts.<br/>Access is temporarily restricted.</p>
    </div>
  );
}

export default function ChatLockScreen({ chatKey, chatName, action = 'unlock', onUnlock, onClose, onToggleSuccess }) {
  const { t } = useTranslation();
  const myUsername = localStorage.getItem('watch_username') || '';
  const storageKey = `chat_lock_state_${myUsername}`;
  
  const [attempts, setAttempts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved?.attempts || 0;
    } catch { return 0; }
  });
  
  const [blockedUntil, setBlockedUntil] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.blockedUntil && saved.blockedUntil > Date.now()) return saved.blockedUntil;
      return null;
    } catch { return null; }
  });

  const [pin, setPin] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [mode, setMode] = useState('pin'); // 'pin' or 'recovery'
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [wiping, setWiping] = useState(false);
  const inputRef = useRef(null);
  
  const token = localStorage.getItem('watch_token');
  const isBlocked = blockedUntil && blockedUntil > Date.now();

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = original;
      setPin('');
      setRecoveryKey('');
    };
  }, []);

  useEffect(() => {
    if (!isBlocked) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isBlocked]);

  const handlePinChange = (val) => {
    if (isBlocked || checking) return;
    const clean = val.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(clean);
    setError(false);
    setErrorMsg('');
  };

  const handleVerify = () => {
    if (mode === 'pin') {
      if (pin.length === PIN_LENGTH) verifyPin(pin);
    } else {
      if (recoveryKey.trim().length >= 16) verifyRecovery(recoveryKey.trim());
    }
  };

  const verifyPin = async (enteredPin) => {
    setChecking(true);
    setError(false);
    try {
      let url = `${API}/api/chat-lock/verify`;
      let body = { pin: enteredPin };
      
      if (action === 'toggle-lock') {
        url = `${API}/api/chat-lock/toggle-chat`;
        body = { chatId: chatKey, lock: true, pin: enteredPin };
      } else if (action === 'toggle-unlock') {
        url = `${API}/api/chat-lock/toggle-chat`;
        body = { chatId: chatKey, lock: false, pin: enteredPin };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (res.ok && (data.success || action !== 'unlock')) {
        setAttempts(0);
        setBlockedUntil(null);
        localStorage.setItem(storageKey, JSON.stringify({ attempts: 0, blockedUntil: null }));
        if (action === 'unlock') onUnlock?.(chatKey);
        else onToggleSuccess?.(action === 'toggle-lock');
      } else if (res.status === 403 && data.error === 'SELF_DESTRUCT_TRIGGERED') {
        handleSelfDestruct();
      } else if (res.status === 429) {
        const until = data.blockedUntil || Date.now() + LOCKOUT_DURATION;
        setBlockedUntil(until);
        setAttempts(LOCKOUT_ATTEMPTS);
        localStorage.setItem(storageKey, JSON.stringify({ attempts: LOCKOUT_ATTEMPTS, blockedUntil: until }));
        setPin('');
      } else {
        setError(true);
        setErrorMsg(data.error || 'Incorrect PIN');
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        let newBlockedUntil = blockedUntil;
        if (newAttempts === LOCKOUT_ATTEMPTS) {
          newBlockedUntil = Date.now() + LOCKOUT_DURATION;
          setBlockedUntil(newBlockedUntil);
        }
        localStorage.setItem(storageKey, JSON.stringify({ attempts: newAttempts, blockedUntil: newBlockedUntil }));
        
        setTimeout(() => { 
          if (newAttempts < MAX_ATTEMPTS && newAttempts !== LOCKOUT_ATTEMPTS) {
            setPin(''); 
            setError(false);
            setErrorMsg('');
          }
        }, 1500);
      }
    } catch (err) {
      console.error('Verify PIN error:', err);
      setError(true); setErrorMsg(t('connectionLost', 'Connection lost. Please try again.'));
    } finally { setChecking(false); }
  };

  const verifyRecovery = async (key) => {
    setChecking(true);
    setError(false);
    try {
      const res = await fetch(`${API}/api/chat-lock/verify-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ recoveryKey: key })
      });
      const data = await res.json();
      if (res.ok) {
        setAttempts(0);
        setBlockedUntil(null);
        localStorage.setItem(storageKey, JSON.stringify({ attempts: 0, blockedUntil: null }));
        toast.success(t('accessRestoredMasterKey', 'Access restored via Master Key'));
        if (action === 'unlock') onUnlock?.(chatKey);
        else onToggleSuccess?.(action === 'toggle-lock');
      } else {
        setError(true);
        setErrorMsg(data.error || 'Invalid Master Key');
      }
    } catch (err) {
      console.error('Verify Recovery error:', err);
      setError(true); setErrorMsg(t('networkError', 'Network error. Check connection.'));
    } finally { setChecking(false); }
  };

  const handleSelfDestruct = async () => {
    setWiping(true);
    try {
      const res = await fetch(`${API}/api/chat-lock/self-destruct`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.error(t('selfDestructTriggered', 'FINAL ATTEMPT FAILED: LOCKED CHATS WIPED'), { duration: 6000, icon: '🔥' });
        localStorage.removeItem(storageKey);
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      toast.error(t('criticalWipeError', 'Critical Error: Failed to wipe data locally.'));
    }
  };

  if (wiping) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000000, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
        <Trash2 size={80} color="#ef4444" style={{ marginBottom: 24, animation: 'pulse 1s infinite' }} />
        <h1 style={{ color: '#fff', fontSize: '2rem', marginBottom: 16 }}>{t('wipingTitle', 'SECURITY OVERRIDE: WIPING LOCKED DATA')}</h1>
        <div style={{ width: 200, height: 4, background: '#111', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: '100%', background: '#ef4444', width: '100%', animation: 'progressWipe 2s linear infinite' }} />
        </div>
        <p style={{ color: '#666', fontSize: 14 }}>{t('selfDestructDesc', 'Too many failed attempts. For your security, all')} <strong>{t('lockedChats', 'locked chats')}</strong> {t('selfDestructDesc2', 'are being permanently deleted.')}</p>
        <style>{`
          @keyframes progressWipe { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        `}</style>
      </div>
    );
  }

  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const isEnabled = mode === 'pin' ? pin.length === PIN_LENGTH : recoveryKey.trim().length >= 16;

  return (
    <div 
      className="lock-screen-overlay"
      onMouseDown={e => e.stopPropagation()}
      style={{ 
        position: 'fixed', inset: 0, zIndex: 9999999, 
        background: isLight ? 'rgba(59, 130, 246, 0.45)' : 'rgba(0,0,0,0.85)', 
        backdropFilter: 'blur(20px)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        animation: 'fadeIn 0.4s ease-out' 
      }}
    >
      <div 
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: 440, 
          background: isLight ? '#ffffff' : 'linear-gradient(165deg, #161725 0%, #0c0d16 100%)', 
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 36, 
          padding: 'clamp(24px, 6vh, 48px) clamp(16px, 5vw, 36px)', 
          textAlign: 'center', 
          boxShadow: isLight ? '0 25px 80px rgba(0,0,0,0.15)' : '0 50px 120px rgba(0,0,0,0.9)', 
          animation: 'scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Glow Effect - Hidden in Light Mode */}
        {!isLight && (
          <div style={{ position: 'absolute', top: '-10%', left: '10%', width: '80%', height: '40%', background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        )}

        {onClose && (
          <button 
            onClick={onClose} 
            style={{ 
              position: 'absolute', top: 28, right: 28, 
              background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)', border: 'none', 
              color: isLight ? '#64748b' : '#4b5563', cursor: 'pointer', display: 'flex', padding: 8, borderRadius: '50%',
              transition: 'all 0.3s ease',
              zIndex: 2
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = isLight ? '#64748b' : '#4b5563'; }}
          >
            <X size={20} />
          </button>
        )}

        <div style={{ 
          width: 'clamp(60px, 15vw, 80px)', height: 'clamp(60px, 15vw, 80px)', borderRadius: 28, margin: '0 auto clamp(16px, 4vh, 28px)', 
          background: isLight ? '#f8fafc' : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))', 
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(99,102,241,0.2)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {mode === 'pin' ? <Lock size={36} color="#818cf8" strokeWidth={2.5} /> : <Key size={36} color="#a855f7" strokeWidth={2.5} />}
        </div>

        <h2 style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', color: isLight ? '#1e293b' : '#fff', letterSpacing: '-0.03em' }}>
          {mode === 'pin'
            ? (action === 'unlock'
                ? (chatName === 'Locked Chats Vault' ? t('unlockVault', 'Unlock Vault') : t('privateAccess', 'Private Access'))
                : t('secureChat', 'Secure Chat'))
            : t('masterRecovery', 'Master Recovery')}
        </h2>
        
        {attempts === 3 && mode === 'pin' && !isBlocked ? (
          <div style={{ 
            marginTop: 16, marginBottom: 24, padding: '12px 16px', borderRadius: 12, 
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center'
          }}>
            <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
              {t('lastAttemptWarning', 'Last attempt. If incorrect, all locked chats will be deleted.')}
            </div>
          </div>
        ) : (
          <p style={{ margin: '12px 0 clamp(16px, 4vh, 32px)', fontSize: 'clamp(0.9rem, 3.5vw, 1rem)', color: isLight ? '#475569' : '#64748b', fontWeight: 500 }}>
            {isBlocked ? t('securityLockoutActive', 'Security lockout enabled') : (mode === 'pin' ? t('enterPin6Digit', 'Please enter your 6-digit PIN') : t('enterMasterKey', 'Enter your Master Key'))}
          </p>
        )}

        {isBlocked ? (
          <CooldownTimer blockedUntil={blockedUntil} onExpired={() => {
            setBlockedUntil(null);
            localStorage.setItem(storageKey, JSON.stringify({ attempts, blockedUntil: null }));
            setErrorMsg('');
          }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {mode === 'pin' ? (
              <div style={{ position: 'relative' }}>
                <input 
                  ref={inputRef}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={PIN_LENGTH}
                  value={pin}
                  autoFocus
                  onChange={(e) => handlePinChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === PIN_LENGTH) handleVerify(); }}
                  style={{
                    width: '100%', padding: 'clamp(14px, 4vw, 24px)', borderRadius: 24, 
                    background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.3)',
                    border: `2px solid ${error ? '#ef4444' : (pin.length > 0 ? 'rgba(99,102,241,0.4)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'))}`,
                    color: isLight ? '#1e293b' : '#fff', fontSize: 'clamp(24px, 7vw, 36px)', fontWeight: 900, textAlign: 'center', 
                    letterSpacing: '0.4em', outline: 'none', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace', paddingRight: 'clamp(40px, 12vw, 60px)'
                  }}
                />
                {pin.length > 0 && (
                  <button
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', color: showPin ? '#818cf8' : (isLight ? '#94a3b8' : '#4b5563'),
                      cursor: 'pointer', display: 'flex', padding: 8, transition: 'color 0.3s'
                    }}
                  >
                    {showPin ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <textarea 
                  ref={inputRef}
                  placeholder="XXXX-XXXX-XXXX-XXXX..."
                  value={recoveryKey}
                  autoFocus
                  onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                  style={{
                    width: '100%', padding: 'clamp(12px, 3.5vw, 20px)', borderRadius: 20, 
                    background: isLight ? '#f8fafc' : 'rgba(0, 0, 0, 0.3)',
                    border: `2px solid ${error ? '#ef4444' : (isLight ? '#e2e8f0' : 'rgba(168,85,247,0.4)')}`,
                    color: isLight ? '#1e293b' : '#fff', fontSize: 'clamp(14px, 3.5vw, 16px)', fontWeight: 600, textAlign: 'center', 
                    letterSpacing: '0.1em', outline: 'none', transition: 'all 0.3s',
                    boxSizing: 'border-box',
                    minHeight: 'clamp(100px, 15vh, 120px)', resize: 'none', fontFamily: 'monospace', boxShadow: 'none'
                  }}
                />
              </div>
            )}

            {errorMsg && (
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                color: '#ef4444', fontSize: 14, fontWeight: 600,
                background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.08)', padding: '12px', borderRadius: 12,
                border: isLight ? '1px solid #fee2e2' : 'none',
                animation: 'fadeInUp 0.3s ease-out'
              }}>
                <ShieldAlert size={18} />
                {errorMsg} {mode === 'pin' && attempts > 0 && `(${attempts}/${MAX_ATTEMPTS})`}
              </div>
            )}

            <button
              disabled={!isEnabled || checking}
              onClick={handleVerify}
              className={`unlock-submit-btn ${isEnabled ? 'enabled' : ''}`}
              style={{
                width: '100%', padding: 'clamp(12px, 3.5vw, 20px)', borderRadius: 20, border: 'none',
                background: isEnabled
                  ? (mode === 'pin' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #a855f7, #9333ea)')
                  : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)'),
                color: isEnabled ? '#ffffff' : (isLight ? '#94a3b8' : '#4b5563'),
                fontSize: 'clamp(0.95rem, 3.5vw, 1.1rem)', fontWeight: 800, cursor: isEnabled ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: (isEnabled && !isLight) ? '0 15px 35px rgba(79, 70, 229, 0.3)' : 'none',
                boxSizing: 'border-box',
                transform: 'translateY(0)',
                position: 'relative',
                zIndex: 1
              }}
            >
              {checking ? <Loader2 className="animate-spin" size={24} color="#ffffff" /> : (
                <div style={{ color: isEnabled ? '#ffffff' : (isLight ? '#94a3b8' : '#4b5563'), display: 'flex', alignItems: 'center', gap: 12 }}>
                  {mode === 'pin' ? t('unlockChats', 'Unlock Chats') : t('verifyMasterKey', 'Verify Master Key')} 
                  <ChevronRight size={20} color={isEnabled ? "#ffffff" : "inherit"} />
                </div>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              {mode === 'pin' && attempts >= 2 && (
                <button 
                  onClick={() => { setMode('recovery'); setRecoveryKey(''); setPin(''); setError(false); setErrorMsg(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = isLight ? '#4f46e5' : '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#818cf8'}
                >
                  {t('useMasterKey', 'Use Master Key')}
                </button>
              )}
              {mode === 'recovery' && (
                <button 
                  onClick={() => { setMode('pin'); setPin(''); setError(false); setErrorMsg(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = isLight ? '#1e293b' : '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                >
                  {t('backToPin', 'Back to PIN')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scaleUp { from { opacity:0; transform: scale(0.9) translateY(20px); } to { opacity:1; transform: scale(1) translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeInUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .unlock-submit-btn.enabled { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
        .unlock-submit-btn.enabled div { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
        .unlock-submit-btn.enabled svg { color: #ffffff !important; }
      `}</style>
    </div>
  );
}





