/**
 * OAuthEncryptionModal.jsx
 *
 * Google/Apple accounts have no password, so their E2EE private key can't be
 * wrapped with a client-derived password key the way normal accounts are. This
 * modal collects a separate "encryption passphrase" — never sent to the server,
 * never reused from the account's login and deliberately never called a "PIN" —
 * used only to derive the AES-GCM key that wraps the private key client-side.
 *
 * Three views:
 *   'set'    — first-time key creation, or an existing account migrating off the
 *              old server-side wrapping onto this passphrase.
 *   'unlock' — returning login on any device: decrypt the stored blob locally.
 *   'forgot' — reachable from 'unlock': recover via the account's recovery
 *              phrase (shown once at original key creation) and set a new
 *              passphrase.
 */
import { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MIN_LENGTH = 8;

export default function OAuthEncryptionModal({ mode, oauthLabel, isMigration, onSetPassphrase, onUnlock, onRecover }) {
  const { t } = useTranslation();
  const [view, setView] = useState('main'); // 'main' | 'forgot'
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [newConfirmPassphrase, setNewConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLight = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  const card = isLight
    ? { background: '#ffffff', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(99,102,241,0.08)' }
    : { background: 'linear-gradient(145deg, #0f0a23, #1a0f35)', border: '1px solid rgba(168,85,247,0.35)', boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.06)' };
  const titleColor = isLight ? '#1a1a2e' : '#ffffff';
  const descColor  = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
  const inputBg    = isLight ? '#ffffff' : '#1a1a1f';
  const inputBdr   = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)';
  const inputColor = isLight ? '#0f172a' : '#fff';
  const labelColor = isLight ? '#334155' : '#a0aab2';

  const inputStyle = {
    width: '100%', background: inputBg, border: `1px solid ${inputBdr}`,
    borderRadius: 12, color: inputColor, fontSize: 14, padding: '12px 44px 12px 14px',
    outline: 'none', boxSizing: 'border-box', fontFamily: "'Outfit', sans-serif",
  };

  const validatePassphrase = (p, confirm) => {
    if (p.length < MIN_LENGTH) return t('encPassphraseTooShort', `Must be at least ${MIN_LENGTH} characters`);
    if (p !== confirm) return t('encPassphraseMismatch', 'Passphrases do not match');
    return null;
  };

  const handleSetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationErr = validatePassphrase(passphrase, confirmPassphrase);
    if (validationErr) { setError(validationErr); return; }
    setIsSubmitting(true);
    try {
      await onSetPassphrase(passphrase);
    } catch (err) {
      setError(err.message || t('somethingWentWrongError', 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passphrase) { setError(t('encPassphraseRequired', 'Enter your encryption passphrase')); return; }
    setIsSubmitting(true);
    try {
      await onUnlock(passphrase);
    } catch (err) {
      setError(err.message || t('encPassphraseWrong', 'Incorrect passphrase. If this account also has a password set, try that.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!recoveryPhrase.trim()) { setError(t('encRecoveryPhraseRequired', 'Enter your recovery phrase')); return; }
    const validationErr = validatePassphrase(newPassphrase, newConfirmPassphrase);
    if (validationErr) { setError(validationErr); return; }
    setIsSubmitting(true);
    try {
      await onRecover(recoveryPhrase.trim(), newPassphrase);
    } catch (err) {
      setError(err.message || t('encRecoveryPhraseInvalid', "That recovery phrase doesn't match this account."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(12px)'
    }}>
      <div style={{ maxWidth: 460, width: '100%', ...card, borderRadius: 24, padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 0 8px rgba(99,102,241,0.15), 0 8px 24px rgba(99,102,241,0.4)'
          }}>
            {view === 'forgot' ? <ShieldAlert size={28} color="#fff" /> : <KeyRound size={28} color="#fff" />}
          </div>

          {view === 'main' && mode === 'set' && (
            <>
              <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: titleColor, fontFamily: "'Outfit', sans-serif" }}>
                {isMigration
                  ? t('encSetMigrationTitle', 'Secure your encrypted messages')
                  : t('encSetNewTitle', 'Set an encryption passphrase')}
              </h2>
              <p style={{ margin: '8px 0 0', color: descColor, fontSize: 13.5, lineHeight: 1.5 }}>
                {isMigration
                  ? t('encSetMigrationDesc', `Your ${oauthLabel} account's encrypted messages are currently protected by this server. Set a passphrase that only you know — never sent to us — to close that gap.`, { oauthLabel })
                  : t('encSetNewDesc', `Since you signed in with ${oauthLabel}, choose a separate passphrase to protect your encrypted messages. This is not your ${oauthLabel} password, and it's different from your chat-lock PIN.`, { oauthLabel })}
              </p>
            </>
          )}
          {view === 'main' && mode === 'unlock' && (
            <>
              <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: titleColor, fontFamily: "'Outfit', sans-serif" }}>
                {t('encUnlockTitle', 'Enter your encryption passphrase')}
              </h2>
              <p style={{ margin: '8px 0 0', color: descColor, fontSize: 13.5, lineHeight: 1.5 }}>
                {t('encUnlockDesc', 'This unlocks your encrypted messages on this device. It is not your login password or your chat-lock PIN.')}
              </p>
            </>
          )}
          {view === 'forgot' && (
            <>
              <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: titleColor, fontFamily: "'Outfit', sans-serif" }}>
                {t('encRecoverTitle', 'Recover with your recovery phrase')}
              </h2>
              <p style={{ margin: '8px 0 0', color: descColor, fontSize: 13.5, lineHeight: 1.5 }}>
                {t('encRecoverDesc', 'Enter the recovery phrase you saved when this key was first created, then choose a new encryption passphrase.')}
              </p>
            </>
          )}
        </div>

        {error && (
          <div style={{
            color: '#f87171', marginBottom: 16, fontSize: 13, background: 'rgba(239,68,68,0.1)',
            padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)'
          }}>
            {error}
          </div>
        )}

        {view === 'main' && mode === 'set' && (
          <form onSubmit={handleSetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, color: labelColor, marginBottom: 6, display: 'block', fontWeight: 600 }}>
                {t('encPassphraseLabel', 'Encryption passphrase')}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingLeft: 40 }}
                  placeholder={t('encPassphrasePlaceholder', `Min ${MIN_LENGTH} characters`)}
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassphrase(p => !p)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: labelColor, marginBottom: 6, display: 'block', fontWeight: 600 }}>
                {t('encConfirmPassphraseLabel', 'Confirm passphrase')}
              </label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                style={inputStyle}
                placeholder={t('encConfirmPassphrasePlaceholder', 'Re-enter passphrase')}
                value={confirmPassphrase}
                onChange={e => setConfirmPassphrase(e.target.value)}
              />
            </div>
            <button type="submit" disabled={isSubmitting} style={submitBtnStyle(isSubmitting)}>
              {isSubmitting ? t('encSaving', 'Saving...') : t('encSetContinue', 'Set passphrase & continue')}
            </button>
          </form>
        )}

        {view === 'main' && mode === 'unlock' && (
          <form onSubmit={handleUnlockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, color: labelColor, marginBottom: 6, display: 'block', fontWeight: 600 }}>
                {t('encPassphraseLabel', 'Encryption passphrase')}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingLeft: 40 }}
                  placeholder={t('encPassphrasePlaceholder', `Min ${MIN_LENGTH} characters`)}
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassphrase(p => !p)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} style={submitBtnStyle(isSubmitting)}>
              {isSubmitting ? t('encUnlocking', 'Unlocking...') : t('encUnlockBtn', 'Unlock')}
            </button>
            <button type="button" onClick={() => { setError(''); setView('forgot'); }}
              style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              {t('encForgotPassphrase', 'Forgot passphrase?')}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleRecoverSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, color: labelColor, marginBottom: 6, display: 'block', fontWeight: 600 }}>
                {t('encRecoveryPhraseLabel', 'Recovery phrase')}
              </label>
              <input
                type="text"
                style={inputStyle}
                placeholder={t('encRecoveryPhrasePlaceholder', 'e.g. ABCDEFGHIJKLMNOPQRSTUVWX')}
                value={recoveryPhrase}
                onChange={e => setRecoveryPhrase(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: labelColor, marginBottom: 6, display: 'block', fontWeight: 600 }}>
                {t('encNewPassphraseLabel', 'New encryption passphrase')}
              </label>
              <input
                type="password"
                style={inputStyle}
                placeholder={t('encPassphrasePlaceholder', `Min ${MIN_LENGTH} characters`)}
                value={newPassphrase}
                onChange={e => setNewPassphrase(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: labelColor, marginBottom: 6, display: 'block', fontWeight: 600 }}>
                {t('encConfirmPassphraseLabel', 'Confirm passphrase')}
              </label>
              <input
                type="password"
                style={inputStyle}
                placeholder={t('encConfirmPassphrasePlaceholder', 'Re-enter passphrase')}
                value={newConfirmPassphrase}
                onChange={e => setNewConfirmPassphrase(e.target.value)}
              />
            </div>
            <button type="submit" disabled={isSubmitting} style={submitBtnStyle(isSubmitting)}>
              {isSubmitting ? t('encRecovering', 'Recovering...') : t('encRecoverBtn', 'Recover & set new passphrase')}
            </button>
            <button type="button" onClick={() => { setError(''); setView('main'); }}
              style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              {t('encBackToUnlock', '← Back')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function submitBtnStyle(isSubmitting) {
  return {
    width: '100%', padding: 13, borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    color: '#fff', fontSize: 14.5, fontWeight: 700,
    cursor: isSubmitting ? 'not-allowed' : 'pointer',
    opacity: isSubmitting ? 0.7 : 1,
    fontFamily: "'Outfit', sans-serif",
  };
}
