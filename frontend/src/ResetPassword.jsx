import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Key, LogIn, CheckCircle, Shield } from 'lucide-react';
import { mnemonicToSecretKey, encryptPrivateKey, hashRecoveryPhrase } from './lib/crypto.js';
import { encodeBase64 } from 'tweetnacl-util';
import nacl from 'tweetnacl';
import PasswordResetWarningModal from './components/PasswordResetWarningModal';

const API = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

const ResetPassword = () => {
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [recoveryKey, setRecoveryKey]     = useState('');
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

      // If user provides a recovery key, regenerate their keys so they don't lose data
      if (recoveryKey.trim()) {
        try {
          const secretKey = await mnemonicToSecretKey(recoveryKey.trim());
          const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
          
          const publicKeyBase64 = encodeBase64(keyPair.publicKey);
          const encryptedPrivKey = await encryptPrivateKey(keyPair.secretKey, password);
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
          overflow: hidden;
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
          border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%);
          filter: blur(60px);
        }
        .login-left::after {
          content: ''; position: absolute; bottom: -10%; right: -10%; width: 60%; height: 60%;
          border-radius: 50%; background: radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0) 70%);
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
        .login-input:focus { border-color: #6366f1; background: #1f1f26; }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover, 
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #1a1a1f inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        .login-submit-btn {
          width: 100%; padding: 16px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff !important; font-size: 16px; font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 8px; transition: all 0.2s; box-shadow: 0 8px 20px rgba(99,102,241,0.3);
        }
        .login-submit-btn * { color: #fff !important; fill: #fff !important; }
        .login-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(99,102,241,0.4); }
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
        html[data-theme='light'] .login-left { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); }
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
          background: #ffffff !important; border-color: #6366f1 !important; box-shadow: 0 0 0 4px rgba(99,102,241,0.1) !important;
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
            <span style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('staySecure', 'Stay secure.')}</span>
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
                      <Link to="/forgot-password" style={{ color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>
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
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(99,102,241,0.1)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99,102,241,0.3)', color: '#c7d2fe', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>i</div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#a5b4fc', lineHeight: 1.5 }}>
                      {t('recoveryKeyInfoText', 'If you enter your recovery key, your password will be updated without losing any data. If you leave this blank, your old encrypted messages will be permanently erased for your security.')}
                    </p>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting || !token} className="login-submit-btn">
                  {isSubmitting
                    ? <><div className="rp-spinner" /><span>{t('resettingText', 'Resetting...')}</span></>
                    : <><LogIn size={18} /><span>{t('resetPasswordBtn', 'Reset Password')}</span></>}
                </button>
              </form>

              <p style={{ color: '#888', fontSize: '15px', marginTop: '28px', textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 700 }}>{t('backToLoginArrow', '← Back to Login')}</Link>
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
