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
import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useCrypto } from '../contexts/CryptoContext';
import { isBrowserDeviceUnlockAvailable } from '../lib/browserDeviceUnlock.js';

export default function KeyRecoveryModal() {
  const { needsReauth, reloadPrivateKeyWithPassword, switchToPassphraseUnlock, enrollBrowserDeviceUnlock } = useCrypto();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  // "Remember this browser" — only ever offered where WebAuthn PRF is
  // actually available (see browserDeviceUnlock.js's own doc comment); on
  // every other browser this stays permanently unmounted, so existing
  // behavior here is completely unchanged for anyone who can't use it.
  const [rememberBrowser, setRememberBrowser] = useState(false);
  const canRememberBrowser = isBrowserDeviceUnlockAvailable();

  // This component is always mounted at the App level and only
  // conditionally renders (the `if (!needsReauth) return null` below), so
  // this hook has to run every render regardless — it just no-ops unless
  // the modal is actually showing. Locking body ALONE wasn't enough here —
  // index.css deliberately gives <html> its own independent
  // `overflow-y: auto` (its own comment: "Prevent html-level scroll lock
  // on mobile"), so with body's overflow hidden but html's still auto, the
  // browser promotes <html> to the actual scrolling element and mouse
  // wheel/touch scroll kept moving the page behind this modal through it.
  // Locking both together actually stops it.
  useEffect(() => {
    if (!needsReauth) return;
    const originalHtml = document.documentElement.style.overflow;
    const originalBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = originalHtml;
      document.body.style.overflow = originalBody;
    };
  }, [needsReauth]);

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
      const kp = await reloadPrivateKeyWithPassword(password);
      setPassword('');
      // Explicit, user-initiated only (the checkbox) — separate try/catch
      // from the unlock itself: a failure here must never make it look
      // like the password/unlock failed, and the user made a real choice
      // here that deserves its own visible outcome (unlike native device
      // unlock's silent auto-enrollment elsewhere in this app).
      if (rememberBrowser) {
        try {
          await enrollBrowserDeviceUnlock(kp.secretKey);
          toast.success(t('rememberBrowserEnabled', 'This browser will unlock your encrypted chats without asking for your password next time.'));
        } catch {
          toast.error(t('rememberBrowserFailed', "Couldn't remember this browser — you'll be asked for your password again next time."));
        }
      }
    } catch (err) {
      setError(err.message || t('somethingWentWrongError', 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // key-recovery-overlay: opts this out of App.jsx's runtime light-mode
    // stylesheet, which has a blanket rule that force-overrides ANY
    // `position: fixed` element's background to a flat #f7f8fc in light
    // mode — it doesn't know about this modal and was silently stomping
    // the translucent tint below (this class is in that rule's own
    // exemption list, and gets its own authoritative override right after
    // it — same pattern every other modal overlay in this app uses).
    <div className="key-recovery-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 2147483600,
      background: isLight ? 'rgba(241,245,249,0.6)' : 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
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
        {canRememberBrowser && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberBrowser}
              onChange={e => setRememberBrowser(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--brand-1)', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }}>
              <strong style={{ color: isLight ? '#1a1a2e' : '#fff', fontWeight: 700 }}>{t('rememberBrowser', 'Remember this browser')}</strong>
              {' — '}
              {t('rememberBrowserDesc', "Unlock your encrypted chats on this browser using your device's fingerprint/PIN instead of your password. Your password still works everywhere and is the only way to recover this on a new device.")}
            </span>
          </label>
        )}
        {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
        <button
          type="submit"
          disabled={isSubmitting || !password}
          // stay-white: App.jsx's runtime light-mode stylesheet pattern-
          // matches `color: rgb(255, 255, 255)` in any inline style and
          // force-overrides it to near-black — that's what was actually
          // turning this label dark despite the inline color:'#fff' below;
          // this class is that rule's own documented escape hatch
          // (OAuthEncryptionModal's equivalent buttons already use it).
          className="stay-white"
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            // Dimming the whole button (background AND text together) via
            // opacity made the label read as washed-out grey rather than
            // white while empty/submitting, especially against a light-mode
            // card. Fading just the background gradient keeps the label a
            // solid, legible white in both states.
            background: (isSubmitting || !password)
              ? 'linear-gradient(135deg, rgba(var(--brand-1-rgb),0.5), rgba(var(--brand-2-rgb),0.5))'
              : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: (isSubmitting || !password) ? 'default' : 'pointer',
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
