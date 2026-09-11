import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Key, LogIn, CheckCircle, Shield, Lock } from 'lucide-react';
import { mnemonicToSecretKey, encryptPrivateKey, decryptPrivateKey, hashRecoveryPhrase } from './lib/crypto.js';
import { encodeBase64 } from 'tweetnacl-util';
import nacl from 'tweetnacl';
import PasswordResetWarningModal from './components/PasswordResetWarningModal';
import { API } from './lib/api';

const ResetPassword = () => {
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [recoveryKey, setRecoveryKey]     = useState('');
  // Independent secret from both the login password above and the recovery
  // phrase — wraps the E2EE private key going forward. Only relevant when a
  // recovery key is supplied (see the security verification pass, "Bug B":
  // this used to silently re-wrap the recovered key with the NEW LOGIN
  // PASSWORD, re-coupling E2EE protection to a secret the server sees on
  // every login — exactly what an encryption passphrase exists to avoid,
  // mirroring Profile.jsx's "Encryption passphrase" section and the OAuth
  // migration flow).
  const [encPassphrase, setEncPassphrase] = useState('');
  const [encConfirmPassphrase, setEncConfirmPassphrase] = useState('');
  const [showEncPassphrase, setShowEncPassphrase] = useState(false);
  const [token, setToken]                 = useState('');
  const [errors, setErrors]               = useState({});
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [globalError, setGlobalError]     = useState('');
  const [successMsg, setSuccessMsg]       = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const params   = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setGlobalError(t('invalidResetToken', 'Invalid or missing reset token. Please request a new reset link.'));
    }
  }, [location, t]);

  const validate = () => {
    const errs = {};
    if (!password) errs.password = t('passwordRequired', 'Password is required');
    else if (password.length < 8) errs.password = t('resetPasswordMinLength', 'Must be at least 8 characters');
    else if (!/(?=.*[A-Z])/.test(password)) errs.password = t('resetPasswordUppercase', 'Must include at least one uppercase letter');
    else if (!/(?=.*\d)/.test(password)) errs.password = t('resetPasswordNumber', 'Must include at least one number');
    if (password !== confirmPassword) errs.confirmPassword = t('passwordsMismatch', 'Passwords do not match');

    // Only relevant when recovering via the recovery key — see encPassphrase's
    // declaration above for why this can't just reuse `password`.
    if (recoveryKey.trim()) {
      if (!encPassphrase) errs.encPassphrase = t('encPassphraseRequired', 'Enter an encryption passphrase');
      else if (encPassphrase.length < 8) errs.encPassphrase = t('encPassphraseTooShort', 'Must be at least 8 characters');
      if (!errs.encPassphrase && encPassphrase !== encConfirmPassphrase) {
        errs.encConfirmPassphrase = t('encPassphraseMismatch', 'Passphrases do not match');
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setGlobalError('');
    if (!token) { setGlobalError(t('invalidResetTokenShort', 'Invalid reset token.')); return; }
    if (!validate()) return;
    // Warn the user about the consequences (message loss without a recovery key) before
    // actually submitting — see PasswordResetWarningModal.
    setShowConfirmModal(true);
  };

  const performReset = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      let payload = { token, newPassword: password };

      // If user provides a recovery key, recover their EXISTING keypair (never
      // regenerated) so they don't lose data. The recovered key is re-wrapped
      // with the independent encryption passphrase entered above — NOT with
      // `password` (the login password being reset here). Wrapping with the
      // login password would re-couple E2EE key protection to a secret the
      // server necessarily sees on every login, silently undoing the point of
      // the encryption-passphrase migration for any account that had one.
      if (recoveryKey.trim()) {
        try {
          const secretKey = await mnemonicToSecretKey(recoveryKey.trim());
          const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);

          const publicKeyBase64 = encodeBase64(keyPair.publicKey);
          const encryptedPrivKey = await encryptPrivateKey(keyPair.secretKey, encPassphrase);

          // Verify the just-wrapped blob actually unwraps back to the SAME
          // secret key, locally, before this ever reaches the server — never
          // replace the server's blob with something that turns out to be
          // unrecoverable.
          const verifySecretKey = await decryptPrivateKey(encryptedPrivKey, encPassphrase);
          const matches = verifySecretKey
            && verifySecretKey.length === keyPair.secretKey.length
            && encodeBase64(verifySecretKey) === encodeBase64(keyPair.secretKey);
          if (!matches) {
            throw new Error('Re-wrapped key failed local verification');
          }

          const recKeyHash = await hashRecoveryPhrase(recoveryKey.trim());

          payload.publicKey = publicKeyBase64;
          payload.encryptedPrivateKey = encryptedPrivKey;
          payload.recoveryKeyHash = recKeyHash;
        } catch (err) {
          console.error("Recovery key error:", err);
          setGlobalError(t('invalidRecoveryKey', 'Invalid recovery key format.'));
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch(`${API}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        let errorKey = 'passwordResetFailed';
        let defaultMsg = 'Password reset failed. Please try again.';
        if (data.error === 'Invalid or expired reset token') {
          errorKey = 'invalidResetTokenShort';
          defaultMsg = 'Invalid reset token.';
        } else if (data.error === 'Reset token has expired. Please request a new one.') {
          errorKey = 'invalidResetToken';
          defaultMsg = 'Invalid or missing reset token. Please request a new reset link.';
        } else if (data.error === 'Token and new password are required') {
          errorKey = 'somethingWentWrongError';
          defaultMsg = 'Something went wrong. Please try again.';
        }
        setGlobalError(t(errorKey, data.error || defaultMsg));
        return;
      }

      setSuccessMsg(data.message || t('passwordResetSuccessDesc', 'Your password has been updated successfully. You can now log in with your new password.'));
    } catch {
      setGlobalError(t('networkErrorLater', 'Network error. Please try again later.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-layout">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

        .login-layout {
          display: flex;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
          background: #050505;
          color: #fff;
          overflow-x: hidden;
          overflow-y: auto;
        }

        .login-left {
          flex: 1.2;
          display: none;
          position: relative;
          background: linear-gradient(135deg, #111115 0%, #1a1a2e 100%);
          overflow: hidden;
        }
        @media (min-width: 900px) {
          .login-left { display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; }
        }
        .login-left::before {
          content: ''; position: absolute; top: -20%; left: -20%; width: 70%; height: 70%;
          border-radius: 50%; background: radial-gradient(circle, rgba(var(--brand-1-rgb),0.15) 0%, rgba(var(--brand-1-rgb),0) 70%);
          filter: blur(60px);
        }
        .login-left::after {
          content: ''; position: absolute; bottom: -10%; right: -10%; width: 60%; height: 60%;
          border-radius: 50%; background: radial-gradient(circle, rgba(var(--brand-2-rgb),0.15) 0%, rgba(var(--brand-2-rgb),0) 70%);
          filter: blur(60px);
        }

        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #050505;
          padding: 24px;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          background: #111114;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 28px;
          padding: 48px 40px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
          position: relative;
          z-index: 10;
        }

        .login-input {
          width: 100%; background: #1a1a1f; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; color: #fff; font-size: 15px; padding: 14px 16px 14px 46px;
          outline: none; box-sizing: border-box; transition: all 0.2s;
          font-family: 'Outfit', sans-serif;
        }
        .login-input::placeholder { color: #444; }
        .login-input:focus { border-color: var(--brand-1); background: #1f1f26; }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover, 
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #1a1a1f inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        .login-submit-btn {
          width: 100%; padding: 16px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
          color: #fff !important; font-size: 16px; font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 8px; transition: all 0.2s; box-shadow: 0 8px 20px rgba(var(--brand-1-rgb),0.3);
        }
        .login-submit-btn * { color: #fff !important; fill: #fff !important; }
        .login-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(var(--brand-1-rgb),0.4); }
        .login-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        .rp-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: rp-spin 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes rp-spin { to { transform: rotate(360deg); } }

        /* Light Mode */
        html[data-theme='light'] .login-layout { background: #f8fafc; }
        html[data-theme='light'] .login-left { background: linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 100%); }
        html[data-theme='light'] .login-left::before { background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); }
        html[data-theme='light'] .login-left::after  { background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); }
        html[data-theme='light'] .login-left-text { color: #fff !important; }
        html[data-theme='light'] .login-right { background: #f8fafc; }
        html[data-theme='light'] .login-card {
          background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 24px 60px rgba(0,0,0,0.06);
        }
        html[data-theme='light'] .login-card h1,
        html[data-theme='light'] .login-card label { color: #0f172a !important; }
        html[data-theme='light'] .login-submit-btn span { color: #ffffff !important; }
        html[data-theme='light'] .login-card p { color: #64748b !important; }
        html[data-theme='light'] .login-input {
          background: #ffffff !important; border: 1px solid rgba(0,0,0,0.15) !important; color: #0f172a !important;
        }
        html[data-theme='light'] .login-input::placeholder { color: #94a3b8; }
        html[data-theme='light'] .login-input:focus {
          background: #ffffff !important; border-color: var(--brand-1) !important; box-shadow: 0 0 0 4px rgba(var(--brand-1-rgb),0.1) !important;
        }
        html[data-theme='light'] .login-input:-webkit-autofill,
        html[data-theme='light'] .login-input:-webkit-autofill:hover, 
        html[data-theme='light'] .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #0f172a !important;
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Left Panel ── */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 48, height: 48 }} />
            <h2 className="login-left-text" style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '1px', margin: 0 }}>SahaPlay</h2>
          </div>
          <h1 className="login-left-text" style={{ fontSize: '52px', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1px' }}>
            {t('createNewPassword', 'Create your new password.')}<br />
            <span style={{ background: 'linear-gradient(135deg, var(--brand-2-light), var(--brand-1-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('staySecure', 'Stay secure.')}</span>
          </h1>
          <p className="login-left-text" style={{ fontSize: '17px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, maxWidth: '440px' }}>
            {t('resetPasswordLeftDesc', 'Choose a strong password with at least 8 characters, one uppercase letter, and one number.')}
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="login-right">
        <div className="login-card animated-fade-in">

          {successMsg ? (
            /* ── Success ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(16,185,129,0.15)' }}>
                <CheckCircle size={36} color="#10b981" strokeWidth={1.5} />
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', margin: '0 0 10px' }}>{t('passwordResetSuccess', 'Password Reset!')}</h1>
              <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.65, margin: '0 0 32px' }}>
                {t('passwordResetSuccessDesc', 'Your password has been updated successfully. You can now log in with your new password.')}
              </p>
              <button onClick={() => navigate('/login')} className="login-submit-btn">
                <LogIn size={18} /><span>{t('goToLogin', 'Go to Login')}</span>
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', margin: '0 0 8px', color: '#fff' }}>{t('newPasswordTitle', 'New Password')}</h1>
              <p style={{ color: '#888', fontSize: '15px', marginBottom: '32px' }}>
                {t('newPasswordDesc', 'Choose a strong password for your account.')}
              </p>

              {globalError && (
                <div style={{ color: '#ef4444', marginBottom: '20px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {globalError}
                  {globalError.includes('expired') && (
                    <div style={{ marginTop: '10px' }}>
                      <Link to="/forgot-password" style={{ color: 'var(--brand-1)', fontWeight: 700, textDecoration: 'none' }}>
                        {t('requestNewResetLink', 'Request a new reset link →')}
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }} noValidate>
                {/* New Password */}
                <div>
                  <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('newPasswordLabel', 'New Password')}</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="login-input"
                      style={{ paddingRight: '48px', borderColor: errors.password ? '#ef4444' : undefined }}
                      placeholder={t('newPasswordPlaceholder', 'Min 8 chars, 1 uppercase, 1 number')}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: null }); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.password}</span>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('confirmPasswordLabel', 'Confirm Password')}</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="login-input"
                      style={{ paddingRight: '48px', borderColor: errors.confirmPassword ? '#ef4444' : undefined }}
                      placeholder={t('reenterPasswordPlaceholder', 'Re-enter your new password')}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null }); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(p => !p)}
                      style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.confirmPassword}</span>}
                </div>

                {/* Recovery Key (Optional) */}
                <div>
                  <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                    {t('recoveryKeyLabel', 'Recovery Key')} <span style={{ color: '#666', fontWeight: 400 }}>{t('optionalRecommended', '(Optional but recommended)')}</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Shield size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                      type="text"
                      className="login-input"
                      placeholder={t('recoveryKeyPlaceholder', 'e.g. ABCD EFGH IJKL MNOP QRST UVWX')}
                      value={recoveryKey}
                      onChange={e => setRecoveryKey(e.target.value)}
                    />
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(var(--brand-1-rgb),0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(var(--brand-1-rgb),0.2)' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.3)', color: '#c7d2fe', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>i</div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--brand-1-light)', lineHeight: 1.5 }}>
                      {t('recoveryKeyInfoText', "If you enter your recovery key, your existing encrypted messages will be kept — you'll set a separate encryption passphrase below to protect them. If you leave this blank, your old encrypted messages will be permanently erased for your security.")}
                    </p>
                  </div>
                </div>

                {/* Encryption Passphrase (only relevant when recovering via Recovery Key) */}
                {recoveryKey.trim() && (
                  <>
                    <div>
                      <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                        {t('encPassphraseLabel', 'Encryption passphrase')}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <input
                          type={showEncPassphrase ? 'text' : 'password'}
                          className="login-input"
                          style={{ paddingRight: '48px', borderColor: errors.encPassphrase ? '#ef4444' : undefined }}
                          placeholder={t('encPassphrasePlaceholder', 'Min 8 characters')}
                          value={encPassphrase}
                          onChange={e => { setEncPassphrase(e.target.value); if (errors.encPassphrase) setErrors({ ...errors, encPassphrase: null }); }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowEncPassphrase(p => !p)}
                          style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                          {showEncPassphrase ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {errors.encPassphrase && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.encPassphrase}</span>}
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                        {t('encConfirmPassphraseLabel', 'Confirm passphrase')}
                      </label>
                      <input
                        type={showEncPassphrase ? 'text' : 'password'}
                        className="login-input"
                        style={{ borderColor: errors.encConfirmPassphrase ? '#ef4444' : undefined }}
                        placeholder={t('encConfirmPassphrasePlaceholder', 'Re-enter passphrase')}
                        value={encConfirmPassphrase}
                        onChange={e => { setEncConfirmPassphrase(e.target.value); if (errors.encConfirmPassphrase) setErrors({ ...errors, encConfirmPassphrase: null }); }}
                      />
                      {errors.encConfirmPassphrase && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.encConfirmPassphrase}</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(var(--brand-1-rgb),0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(var(--brand-1-rgb),0.2)' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.3)', color: '#c7d2fe', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>i</div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--brand-1-light)', lineHeight: 1.5 }}>
                        {t('encPassphraseResetInfoText', "This protects your encrypted messages going forward. It's separate from your new password above and from your recovery key — never sent to us, and not recoverable if you forget it (unless you still have your recovery key).")}
                      </p>
                    </div>
                  </>
                )}

                <button type="submit" disabled={isSubmitting || !token} className="login-submit-btn">
                  {isSubmitting
                    ? <><div className="rp-spinner" /><span>{t('resettingText', 'Resetting...')}</span></>
                    : <><LogIn size={18} /><span>{t('resetPasswordBtn', 'Reset Password')}</span></>}
                </button>
              </form>

              <p style={{ color: '#888', fontSize: '15px', marginTop: '28px', textAlign: 'center' }}>
                <Link to="/login" style={{ color: 'var(--brand-1)', textDecoration: 'none', fontWeight: 700 }}>{t('backToLoginArrow', '← Back to Login')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
      {showConfirmModal && (
        <PasswordResetWarningModal
          hasRecoveryKey={!!recoveryKey.trim()}
          onCancel={() => setShowConfirmModal(false)}
          onConfirm={performReset}
        />
      )}
    </div>
  );
};

export default ResetPassword;
