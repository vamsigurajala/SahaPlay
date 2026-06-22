import React, { useState } from 'react';
import { Key, Mail, ArrowLeft, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const API = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

export default function ForgotPinModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('choose'); // choose | recovery-key | email
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('watch_token');

  const handleRecoveryKeyReset = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) { toast.error(t('pinLengthError', 'PIN must be exactly 6 digits')); return; }
    if (newPin !== confirmPin) { toast.error(t('pinsDoNotMatch', 'PINs do not match')); return; }
    const cleanKey = recoveryKey.replace(/-/g, '').toUpperCase();
    if (cleanKey.length !== 32) { toast.error(t('recoveryKeyLengthError', 'Recovery key must be 32 characters')); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat-lock/recover-with-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ recoveryKey: cleanKey, newPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('recoveryFailed', 'Recovery failed'));
      toast.success(t('pinResetSuccess', 'PIN reset successfully!'));
      onSuccess?.();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleSendEmailToken = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat-lock/request-email-reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('emailSendFailed', 'Failed to send email'));
      setEmailSent(true);
      toast.success(t('resetCodeSent', 'Reset code sent to your email'));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleEmailReset = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) { toast.error(t('pinLengthError', 'PIN must be exactly 6 digits')); return; }
    if (newPin !== confirmPin) { toast.error(t('pinsDoNotMatch', 'PINs do not match')); return; }
    if (!emailToken.trim()) { toast.error(t('enterEmailCode', 'Enter the code from your email')); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/chat-lock/reset-with-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ token: emailToken.trim(), newPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('resetFailed', 'Reset failed'));
      toast.success(t('pinResetSuccess', 'PIN reset successfully!'));
      onSuccess?.();
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s', fontFamily: 'inherit'
  };

  return (
    <div className="chat-modal-overlay" onMouseDown={e => e.stopPropagation()} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 380, maxWidth: '95vw', background: 'linear-gradient(165deg,#1a1a30,#0f0f1e)', border: '1px solid rgba(129,140,248,0.18)', borderRadius: 24, padding: '28px 24px', boxShadow: '0 32px 80px rgba(0,0,0,0.9)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', padding: 4 }}><X size={18} /></button>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px', background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.1))', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={22} color="#818cf8" />
          </div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#fff' }}>{t('resetPinTitle', 'Reset PIN')}</h2>
          <p style={{ margin: '5px 0 0', fontSize: '0.82rem', color: '#475569' }}>{t('chooseRecoveryMethod', 'Choose a recovery method')}</p>
        </div>

        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setMode('recovery-key')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,140,248,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(129,140,248,0.06)'}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(129,140,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Key size={18} color="#818cf8" /></div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{t('recoveryKeyMethod', 'Recovery Key')}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{t('recoveryKeyDesc', 'Use the 32-character key you saved during setup')}</div>
              </div>
            </button>
            <button onClick={() => setMode('email')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mail size={18} color="#6366f1" /></div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{t('emailResetMethod', 'Email Reset')}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{t('emailResetDesc', 'Get a one-time code sent to your account email')}</div>
              </div>
            </button>
          </div>
        )}

        {mode === 'recovery-key' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => setMode('choose')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 4 }}><ArrowLeft size={14} /> {t('back', 'Back')}</button>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('recoveryKeyFormat', 'Recovery Key (XXXX-XXXX-XXXX-XXXX)')}</label>
              <input value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} placeholder="E.g. A1B2-C3D4-E5F6-G7H8" style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }} onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('newPinLabel', 'New 6-digit PIN')}</label>
              <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="••••••" style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('confirmNewPinLabel', 'Confirm New PIN')}</label>
              <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="••••••" style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <button onClick={handleRecoveryKeyReset} disabled={loading} style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}>{loading ? t('resetting', 'Resetting…') : t('resetPinBtn', 'Reset PIN')}</button>
          </div>
        )}

        {mode === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => setMode('choose')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#818cf8', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 4 }}><ArrowLeft size={14} /> {t('back', 'Back')}</button>
            {!emailSent ? (
              <>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{t('emailResetInfo', 'A one-time reset code will be sent to your registered email address.')}</p>
                <button onClick={handleSendEmailToken} disabled={loading} style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? t('sending', 'Sending…') : t('sendResetCodeBtn', 'Send Reset Code')}</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
                  <Check size={14} color="#10b981" /><span style={{ fontSize: 12, color: '#6ee7b7' }}>{t('codeSent', 'Code sent! Check your email.')}</span>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('emailResetCodeLabel', 'Email Reset Code')}</label>
                  <input value={emailToken} onChange={e => setEmailToken(e.target.value)} placeholder={t('enterCodePlaceholder', 'Enter code from email')} style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('newPinLabel', 'New 6-digit PIN')}</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('confirmNewPinLabel', 'Confirm New PIN')}</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" style={inputStyle} onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <button onClick={handleEmailReset} disabled={loading} style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? t('resetting', 'Resetting…') : t('resetPinBtn', 'Reset PIN')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}





