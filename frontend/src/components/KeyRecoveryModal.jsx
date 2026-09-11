/**
 * KeyRecoveryModal.jsx
 *
 * Shown whenever CryptoContext detects this device has no local encryption
 * key, but the account already has one registered on the server (see the
 * mount-time check in CryptoContext.jsx). Without this prompt, the app used
 * to silently mint a brand-new keypair in that situation — overwriting the
 * account's one shared public key and permanently breaking decryption of
 * everything encrypted under the old key, on every device. Entering the
 * account password here decrypts and restores the SAME identity key instead.
 */
import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCrypto } from '../contexts/CryptoContext';

export default function KeyRecoveryModal() {
  const { needsReauth, reloadPrivateKeyWithPassword, switchToPassphraseUnlock } = useCrypto();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!needsReauth) return null;

  // Explicit, user-initiated only — never inferred from a decrypt failure,
  // which would be ambiguous with a genuine password typo. For an account
  // that has migrated to an independent encryption passphrase (see
  // Profile.jsx), the login password entered above will never unwrap the
  // key, so this hands off to that flow instead (EncryptionUnlockGate).
  const handleUsePassphraseInstead = async () => {
    setSwitching(true);
    setError('');
    try {
      await switchToPassphraseUnlock();
    } catch (err) {
      setError(err.message || t('somethingWentWrongError', 'Something went wrong. Please try again.'));
      setSwitching(false);
    }
  };

  const isLight = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setError('');
    setIsSubmitting(true);
    try {
      await reloadPrivateKeyWithPassword(password);
      setPassword('');
    } catch (err) {
      setError(err.message || t('somethingWentWrongError', 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2147483600,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 380, borderRadius: 20, padding: '32px 28px',
        background: isLight ? '#ffffff' : 'linear-gradient(145deg, #0f0a23, #1a0f35)',
        border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
        }}>
          <Lock size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: isLight ? '#1a1a2e' : '#fff' }}>
            {t('unlockEncryptedChats', 'Unlock your encrypted chats')}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)' }}>
            {t('unlockEncryptedChatsDesc', "This device doesn't have your encryption key yet. Enter your account password to restore it so your private messages decrypt correctly here too.")}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('password', 'Password')}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px',
              borderRadius: 12, fontSize: 14, outline: 'none',
              background: isLight ? '#ffffff' : '#1a1a1f',
              border: `1px solid ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)'}`,
              color: isLight ? '#0f172a' : '#fff',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: isLight ? '#64748b' : '#888', cursor: 'pointer', display: 'flex' }}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
        <button
          type="submit"
          disabled={isSubmitting || !password}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: (isSubmitting || !password) ? 'default' : 'pointer',
            opacity: (isSubmitting || !password) ? 0.6 : 1,
          }}
        >
          {isSubmitting ? t('unlocking', 'Unlocking…') : t('unlock', 'Unlock')}
        </button>
        <button
          type="button"
          onClick={handleUsePassphraseInstead}
          disabled={switching}
          style={{ background: 'none', border: 'none', color: 'var(--brand-1-light)', fontSize: 12.5, cursor: 'pointer', fontWeight: 600, padding: 0 }}
        >
          {switching ? t('encSwitching', 'One moment…') : t('encUsePassphraseInstead', 'Have an encryption passphrase instead of a password? Use that.')}
        </button>
      </form>
    </div>
  );
}
