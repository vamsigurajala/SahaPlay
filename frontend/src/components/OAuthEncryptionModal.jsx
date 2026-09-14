/**
 * OAuthEncryptionModal.jsx
 *
 * Google/Apple accounts have no password, so their E2EE private key can't be
 * wrapped with a client-derived password key the way normal accounts are. This
 * modal collects a separate "encryption passphrase" — never sent to the server,
 * never reused from the account's login and deliberately never called a "PIN" —
 * used only to derive the AES-GCM key that wraps the private key client-side.
 *
 * Email/password accounts use this SAME modal (isPasswordAccount=true) for the
 * identical reason, just phrased differently: their private key was originally
 * wrapped with the account's login password, which the server necessarily sees
 * on every login — so it could, in principle, derive the same wrapping key.
 * An independent passphrase closes that gap the same way it does for OAuth.
 *
 * Four views:
 *   'set'    — first-time key creation, or an existing account migrating off
 *              password/server-side-derivable wrapping onto this passphrase.
 *              Only THIS view supports onSkip (password accounts already have
 *              a working — if weaker — scheme, so migrating is optional and
 *              dismissible; OAuth's brand-new/legacy-migration cases have no
 *              working alternative, so onSkip is simply omitted there).
 *   'unlock' — returning login on any device: decrypt the stored blob locally.
 *   'forgot' — reachable from 'unlock': recover via the account's recovery
 *              phrase (shown once at original key creation) and set a new
 *              passphrase.
 */
import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MIN_LENGTH = 8;

export default function OAuthEncryptionModal({ mode, oauthLabel, isMigration, isPasswordAccount, onSetPassphrase, onUnlock, onRecover, onSkip }) {
  const { t } = useTranslation();
  const [view, setView] = useState('main'); // 'main' | 'forgot'

  // This modal has no "click outside to dismiss" — it's always mounted
  // over real page content behind it (Home/Dashboard), and without this,
  // scrolling inside the modal (mouse wheel, trackpad, touch) scrolled
  // that page underneath right along with it. Locking body ALONE (the
  // idiom PinSetupModal/ChatLockScreen/CreateRoomModal use elsewhere)
  // wasn't enough here — index.css deliberately gives <html> its own
  // independent `overflow-y: auto` (its own comment: "Prevent html-level
  // scroll lock on mobile"), so with body's overflow hidden but html's
  // still auto, the browser promotes <html> to the actual scrolling
  // element and mouse wheel/touch scroll kept moving the page through it.
  // Locking both together actually stops it.
  useEffect(() => {
    const originalHtml = document.documentElement.style.overflow;
    const originalBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = originalHtml;
      document.body.style.overflow = originalBody;
    };
  }, []);
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
    ? { background: '#ffffff', border: '1px solid rgba(var(--brand-1-rgb),0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(var(--brand-1-rgb),0.08)' }
    : { background: 'linear-gradient(145deg, #0f0a23, #1a0f35)', border: '1px solid rgba(var(--brand-2-rgb),0.35)', boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(var(--brand-2-rgb),0.1), inset 0 1px 0 rgba(255,255,255,0.06)' };
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
    // encryption-modal-overlay: App.jsx's runtime light-mode stylesheet has
    // a blanket rule that force-overrides ANY `position: fixed` element's
    // background to a flat #f7f8fc in light mode (its own comment calls it
    // out as the "Chat widget container" catch-all) — it doesn't know about
    // this modal and was silently stomping the translucent tint set below,
    // which is why setting it here alone didn't visibly change anything.
    // This class is in that rule's own exemption list (and gets its own
    // authoritative override right after it) — same pattern every other
    // modal overlay in this app already uses to opt out of that catch-all.
    <div className="encryption-modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: isLight ? 'rgba(241,245,249,0.6)' : 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, backdropFilter: 'blur(12px)'
    }}>
      {/* A DIFFERENT exemption class than the backdrop's, deliberately —
          this card is the direct `div[style*="background"]` child that the
          catch-all's SECOND selector separately targets, so it needs its
          own opt-out, but must NOT share encryption-modal-overlay's own
          dedicated rule (that one intentionally overrides background to a
          translucent tint — exactly what this card, which needs to stay
          solid white/dark per its own `card` variable above, must avoid). */}
      <div className="encryption-modal-card" style={{ maxWidth: 460, width: '100%', ...card, borderRadius: 24, padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 0 8px rgba(var(--brand-1-rgb),0.15), 0 8px 24px rgba(var(--brand-1-rgb),0.4)'
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
                {isPasswordAccount
                  ? (isMigration
                      ? t('encSetMigrationDescPw', "Your encrypted messages are currently protected using your account password — which this server necessarily sees on every login. Set a separate passphrase that only you know, never sent to us, to close that gap.")
                      : t('encSetNewDescPw', "Choose a passphrase to protect your encrypted messages. This is separate from your account password — never sent to us — and different from your chat-lock PIN."))
                  : (isMigration
                      ? t('encSetMigrationDesc', `Your ${oauthLabel} account's encrypted messages are currently protected by this server. Set a passphrase that only you know — never sent to us — to close that gap.`, { oauthLabel })
                      : t('encSetNewDesc', `Since you signed in with ${oauthLabel}, choose a separate passphrase to protect your encrypted messages. This is not your ${oauthLabel} password, and it's different from your chat-lock PIN.`, { oauthLabel }))}
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
            <button type="submit" disabled={isSubmitting} className="stay-white" style={submitBtnStyle(isSubmitting)}>
              {isSubmitting ? t('encSaving', 'Saving...') : t('encSetContinue', 'Set passphrase & continue')}
            </button>
            {onSkip && (
              <button type="button" onClick={onSkip} disabled={isSubmitting}
                style={{ background: 'none', border: 'none', color: labelColor, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {t('encSkipForNow', 'Not now')}
              </button>
            )}
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
            <button type="submit" disabled={isSubmitting} className="stay-white" style={submitBtnStyle(isSubmitting)}>
              {isSubmitting ? t('encUnlocking', 'Unlocking...') : t('encUnlockBtn', 'Unlock')}
            </button>
            <button type="button" onClick={() => { setError(''); setView('forgot'); }}
              style={{ background: 'none', border: 'none', color: 'var(--brand-1-light)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
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
            <button type="submit" disabled={isSubmitting} className="stay-white" style={submitBtnStyle(isSubmitting)}>
              {isSubmitting ? t('encRecovering', 'Recovering...') : t('encRecoverBtn', 'Recover & set new passphrase')}
            </button>
            <button type="button" onClick={() => { setError(''); setView('main'); }}
              style={{ background: 'none', border: 'none', color: 'var(--brand-1-light)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
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
    background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
    color: '#fff', fontSize: 14.5, fontWeight: 700,
    cursor: isSubmitting ? 'not-allowed' : 'pointer',
    opacity: isSubmitting ? 0.7 : 1,
    fontFamily: "'Outfit', sans-serif",
  };
}
