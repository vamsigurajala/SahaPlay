import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Lock, Eye, EyeOff, Copy, Check, ChevronRight, Shield, Key, X, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const API = `http://${window.location.hostname}:3001`;
const PIN_LENGTH = 6;

function SimplePinDisplay({ value, secret, active, error }) {
  const displayValue = secret ? '●'.repeat(value.length) : value;
  const placeholders = '○'.repeat(Math.max(0, PIN_LENGTH - value.length));
  
  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: 8,
        margin: '20px 0',
        padding: '10px',
        opacity: active ? 1 : 0.4,
        transition: 'all 0.3s ease',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        position: 'relative'
      }}>
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: '0.5em',
        color: error ? '#fca5a5' : '#fff',
        fontFamily: 'monospace',
        textShadow: active ? '0 0 15px rgba(129,140,248,0.5)' : 'none',
      }}>
        {displayValue}
        <span style={{ color: 'rgba(255,255,255,0.1)' }}>{placeholders}</span>
      </div>
      {active && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: '20%',
          right: '20%',
          height: 2,
          background: 'linear-gradient(90deg, transparent, #818cf8, transparent)',
          animation: 'pulse 1.5s infinite'
        }} />
      )}
    </div>
  );
}

export default function PinSetupModal({ onClose, onSuccess, action }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1); // 1=Entry, 2=Recovery
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activeField, setActiveField] = useState('pin'); // 'pin' or 'confirm'
  const confirmInputRef = useRef(null);
  const [showPin, setShowPin] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('watch_token');

  // Disable background scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Global keydown removed in favor of real input onChange

  const generateKey = useCallback(() => {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const key = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const formatted = key.match(/.{1,4}/g).join('-');
    setRecoveryKey(formatted);
    setStep(2);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey).then(() => {
      setCopied(true);
      setHasCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = async () => {
    if (!hasCopied) {
      toast.error(t('copyRecoveryKeyFirst', 'Please copy your recovery key first'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat-lock/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin, recoveryKey: recoveryKey.replace(/-/g, '') })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('setupFailed', 'Setup failed'));
      toast.success(action === 'reset' ? t('pinUpdatedSuccess', 'PIN updated successfully!') : t('chatLockEnabled', 'Chat Lock enabled!'));
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="chat-modal-overlay"
      onMouseDown={e => e.stopPropagation()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} 
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}>
      <div 
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()} 
        style={{
        width: 390, maxWidth: '95vw', maxHeight: '95vh', overflowY: 'auto',
        background: 'linear-gradient(165deg, #16162a 0%, #0a0a14 100%)',
        border: '1px solid rgba(129,140,248,0.2)',
        borderRadius: 28, padding: '32px 28px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
        animation: 'scaleUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        position: 'relative'
      }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.03)', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', padding: 8, borderRadius: '50%', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = '#666'}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '22px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(168,85,247,0.1))',
            border: '1px solid rgba(129,140,248,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(129,140,248,0.1)',
          }}>
            {step === 2 ? <Shield size={28} color="#818cf8" /> : <Lock size={28} color="#818cf8" />}
          </div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.5rem', color: '#fff', letterSpacing: '-0.02em' }}>
            {step === 1 ? (action === 'reset' ? t('changeVaultPin', 'Change Vault PIN') : t('secureVault', 'Secure Your Vault')) : t('newRecoveryKey', 'New Master Recovery Key')}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#71717a', fontWeight: 500, lineHeight: 1.5 }}>
            {step === 1 ? (action === 'reset' ? t('changeVaultPinDesc', 'This will update your PIN across all locked chats.') : t('secureVaultDesc', 'This PIN will be set for every chat you choose to lock.'))
             : t('newRecoveryKeyDesc', 'Keep this new key safe. If you forget your PIN, this will be your only way to recover access. Previous keys will become invalid.')}
          </p>
        </div>

        {/* Progress Bar */}
        {step === 1 && (
          <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, margin: '0 40px 32px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: activeField === 'confirm' ? '100%' : '50%', 
              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, color: '#fca5a5', fontSize: 13, textAlign: 'center', fontWeight: 500 }}>
            {error}
          </div>
        )}
        
        {/* Step 1: PIN entry */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Primary PIN */}
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginLeft: 4 }}>{t('setPin', 'Set 6-Digit PIN')}</div>
              <input 
                type={showPin ? 'text' : 'password'}
                maxLength={6}
                value={pin}
                autoFocus
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(val);
                  setError('');
                  if (val.length === 6) {
                    setActiveField('confirm');
                    confirmInputRef.current?.focus();
                  }
                }}
                onFocus={() => setActiveField('pin')}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${activeField === 'pin' ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center', letterSpacing: '0.8em',
                  outline: 'none', transition: 'all 0.2s',
                  boxShadow: activeField === 'pin' ? '0 0 20px rgba(129,140,248,0.1)' : 'none'
                }}
              />
              <button 
                onClick={() => setShowPin(!showPin)}
                style={{ position: 'absolute', right: 16, bottom: 14, background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', padding: 4 }}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm PIN */}
            <div style={{ position: 'relative', opacity: pin.length === 6 ? 1 : 0.5, transition: 'all 0.3s' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginLeft: 4 }}>{t('confirmPin', 'Confirm 6-Digit PIN')}</div>
              <input 
                ref={confirmInputRef}
                type={showPin ? 'text' : 'password'}
                maxLength={6}
                value={confirmPin}
                disabled={pin.length < 6}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setConfirmPin(val);
                  setError('');
                }}
                onFocus={() => setActiveField('confirm')}
                style={{
                  width: '100%', padding: '16px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${activeField === 'confirm' ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center', letterSpacing: '0.8em',
                  outline: 'none', transition: 'all 0.2s',
                  boxShadow: activeField === 'confirm' ? '0 0 20px rgba(129,140,248,0.1)' : 'none'
                }}
              />
            </div>


            <button 
              disabled={pin.length < 6 || confirmPin.length < 6}
              onClick={() => {
                if (pin === confirmPin) generateKey();
                else setError(t('pinsDoNotMatch', 'PINs do not match'));
              }}
              className={(pin.length === 6 && confirmPin.length === 6) ? 'pin-submit-btn enabled' : 'pin-submit-btn'}
              style={{
                marginTop: 12, padding: '16px', borderRadius: 16, border: 'none',
                background: (pin.length === 6 && confirmPin.length === 6) ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.05)',
                color: (pin.length === 6 && confirmPin.length === 6) ? '#fff' : '#444',
                fontSize: 15, fontWeight: 800, cursor: (pin.length === 6 && confirmPin.length === 6) ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s'
              }}
            >
              {t('setLockPinBtn', 'Set Lock PIN')}
            </button>
          </div>
        )}

        {/* Step 2: Recovery key */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={14} color="#818cf8" />
                  <span style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('recoveryKeyLabel', 'Recovery Key')}</span>
                </div>
                <button onClick={handleCopy} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(129,140,248,0.1)',
                  border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(129,140,248,0.2)'}`,
                  borderRadius: 10, padding: '6px 12px',
                  color: copied ? '#10b981' : '#4f46e5', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  {copied ? <Check size={14} /> : <Copy size={14} color="#4f46e5" />}
                  {copied ? t('copiedLabel', 'Copied') : t('copy', 'Copy')}
                </button>
              </div>
              
              <div style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: 18, fontWeight: 800, color: '#ffffff',
                letterSpacing: '0.15em', textAlign: 'center', padding: '12px 0',
                background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)'
              }}>{recoveryKey}</div>
            </div>

            <div style={{
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 16, padding: '16px',
              display: 'flex', gap: 12, alignItems: 'flex-start'
            }}>
              <Shield size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 12.5, color: '#ef4444', lineHeight: 1.6, fontWeight: 700 }}>
                {t('recoveryWarning1', 'If you forget both your PIN and this key, all your')} <strong>{t('recoveryWarning2', 'chats, media, and data will be permanently deleted')}</strong> {t('recoveryWarning3', 'for security.')}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button onClick={handleSave} disabled={loading || !hasCopied} 
                className={hasCopied ? 'pin-submit-btn enabled' : 'pin-submit-btn'}
                style={{
                padding: '16px 0', borderRadius: 16, border: 'none',
                background: !hasCopied ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: !hasCopied ? '#444' : '#fff', fontSize: '1rem', fontWeight: 800,
                cursor: !hasCopied ? 'not-allowed' : 'pointer',
                boxShadow: !hasCopied ? 'none' : '0 12px 32px rgba(99,102,241,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
              }}>
                {loading ? t('activating', 'Activating...') : (hasCopied ? t('enableChatLock', 'Enable Chat Lock') : t('copyKeyToContinue', 'Copy Key to Continue'))}
                {!loading && <ChevronRight size={20} color={hasCopied ? "#ffffff" : "inherit"} />}
              </button>
              
              <button 
                onClick={() => setStep(1)} 
                disabled={loading}
                style={{ 
                  background: 'transparent', border: 'none', color: '#555', 
                  fontSize: 13, fontWeight: 600, padding: 8, cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
              >
                {t('backToPinEntry', 'Back to PIN Entry')}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scaleUp { from { opacity:0; transform: scale(0.95) translateY(10px); } to { opacity:1; transform: scale(1) translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .pin-box-filled:hover .delete-overlay { opacity: 1 !important; }
        .pin-submit-btn.enabled { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
      `}</style>
    </div>
  );
}





