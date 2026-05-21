import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Trash2, Clock, Shield, ChevronDown, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import PinSetupModal from './PinSetupModal';

const API = `http://${window.location.hostname}:3001`;

const AUTO_LOCK_OPTIONS = [
  { value: 0,  labelKey: 'autoLockImmediately', label: 'Immediately' },
  { value: 1,  labelKey: 'autoLock1Min',         label: '1 minute'     },
  { value: 5,  labelKey: 'autoLock5Min',         label: '5 minutes'    },
  { value: 15, labelKey: 'autoLock15Min',        label: '15 minutes'   },
  { value: 30, labelKey: 'autoLock30Min',        label: '30 minutes'   },
  { value: 60, labelKey: 'autoLock1Hour',        label: '1 hour'       },
];

function Toggle({ on, onToggle, disabled }) {
  return (
    <button onClick={onToggle} disabled={disabled} style={{ width: 46, height: 25, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: on ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.25s', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      <div style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 24 : 3, transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

export default function ChatLockSettings({ onRefresh }) {
  const { t } = useTranslation();
  const [lockEnabled, setLockEnabled] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disablePin, setDisablePin] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [showAutoLockDrop, setShowAutoLockDrop] = useState(false);

  const token = localStorage.getItem('watch_token');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/chat-lock/status`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setLockEnabled(!!data.enabled);
        setAutoLockMinutes(data.autoLockMinutes ?? 5);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleDisable = async () => {
    if (!disablePin || disablePin.length !== 6) { toast.error(t('enterCurrentPin', 'Enter your current 6-digit PIN')); return; }
    setDisabling(true);
    try {
      const res = await fetch(`${API}/api/chat-lock/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: disablePin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLockEnabled(false);
      setShowDisableConfirm(false);
      setDisablePin('');
      toast.success(t('chatLockDisabled', 'Chat Lock disabled'));
      onRefresh?.();
    } catch (err) { toast.error(err.message); }
    finally { setDisabling(false); }
  };

  const handleAutoLockChange = async (minutes) => {
    setAutoLockMinutes(minutes);
    setShowAutoLockDrop(false);
    localStorage.setItem('chat_lock_auto_minutes', minutes);
    try {
      await fetch(`${API}/api/chat-lock/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ autoLockMinutes: minutes })
      });
    } catch {}
  };

  const selectedAutoLabel = AUTO_LOCK_OPTIONS.find(o => o.value === autoLockMinutes)?.label || '5 minutes';
  const selectedAutoLabelKey = AUTO_LOCK_OPTIONS.find(o => o.value === autoLockMinutes)?.labelKey || 'autoLock5Min';

  const row = (icon, title, desc, right, accent = '#818cf8') => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{title}</div>
          {desc && <div style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>{desc}</div>}
        </div>
      </div>
      {right}
    </div>
  );

  if (loading) return <div style={{ color: '#555', fontSize: 13, padding: 8 }}>{t('loading', 'Loading…')}</div>;

  return (
    <>
    {showSetup && <PinSetupModal onClose={() => setShowSetup(false)} onSuccess={() => { setLockEnabled(true); fetchStatus(); onRefresh?.(); }} />}
    <div>
      {/* Enable / Disable toggle row */}
      {row(
        lockEnabled ? <Lock size={17} color="#818cf8" /> : <Unlock size={17} color="#818cf8" />,
        t('chatLockTitle', 'Chat Lock'),
        lockEnabled ? t('pinProtectionActive', 'PIN protection is active') : t('pinProtectionDesc', 'Protect specific chats with a PIN'),
        <Toggle on={lockEnabled} onToggle={() => lockEnabled ? setShowDisableConfirm(true) : setShowSetup(true)} />
      )}

      {lockEnabled && (
        <>
          {/* Auto-lock timing */}
          {row(
            <Clock size={17} color="#f59e0b" />,
            t('autoLockAfter', 'Auto-Lock After'),
            t('autoLockDesc', 'Automatically relock when you leave the app'),
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowAutoLockDrop(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {t(selectedAutoLabelKey, selectedAutoLabel)}
                <ChevronDown size={13} color="#666" style={{ transform: showAutoLockDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {showAutoLockDrop && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, zIndex: 9999, minWidth: 140, boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}>
                  {AUTO_LOCK_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => handleAutoLockChange(opt.value)} style={{ display: 'block', width: '100%', padding: '9px 14px', background: autoLockMinutes === opt.value ? 'rgba(129,140,248,0.12)' : 'transparent', border: 'none', color: autoLockMinutes === opt.value ? '#818cf8' : '#ccc', fontSize: 13, fontWeight: autoLockMinutes === opt.value ? 700 : 500, cursor: 'pointer', textAlign: 'left', borderRadius: 9 }}>
                      {t(opt.labelKey, opt.label)}
                    </button>
                  ))}
                </div>
              )}
            </div>,
            '#f59e0b'
          )}

          {/* Security info */}
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Shield size={15} color="#6366f1" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              {t('chatLockSecurityInfo', 'Locked chats are hidden from the conversation list. Only your PIN or recovery key can reveal them.')}
            </p>
          </div>
        </>
      )}

      {/* Disable confirm */}
      {showDisableConfirm && (
        <div onClick={() => setShowDisableConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 360, maxWidth: '95vw', background: 'linear-gradient(165deg,#1e1e30,#12121f)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 22, padding: '28px 24px', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{t('disableChatLockTitle', 'Disable Chat Lock?')}</h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>{t('enterCurrentPinConfirm', 'Enter your current PIN to confirm')}</p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <input type="password" inputMode="numeric" maxLength={6} value={disablePin} onChange={e => setDisablePin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('pinPlaceholder', '6-digit PIN')} style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 16, textAlign: 'center', letterSpacing: '0.3em', outline: 'none', fontFamily: 'inherit' }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowDisableConfirm(false); setDisablePin(''); }} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t('cancel', 'Cancel')}</button>
              <button onClick={handleDisable} disabled={disabling || disablePin.length !== 6} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: disabling || disablePin.length !== 6 ? 'not-allowed' : 'pointer', opacity: disabling || disablePin.length !== 6 ? 0.5 : 1 }}>{disabling ? t('disabling', 'Disabling…') : t('disable', 'Disable')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}





