import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, Key, AlertTriangle, Check } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import {
  mnemonicToSecretKey,
  encryptPrivateKey,
  hashRecoveryPhrase
} from './lib/crypto.js';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

const API = 'http://localhost:3001';

const ResetPassword = () => {
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken]                     = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [errors, setErrors]                   = useState({});
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [globalError, setGlobalError]         = useState('');
  const [successMsg, setSuccessMsg]           = useState('');

  // Recovery phrase step
  const [phrase, setPhrase]                   = useState('');
  const [phraseError, setPhraseError]         = useState('');
  const [phraseVerified, setPhraseVerified]   = useState(false);
  const [isVerifyingPhrase, setIsVerifyingPhrase] = useState(false);
  // Optional: account may not have a recovery phrase (old account)
  const [skipPhrase, setSkipPhrase]           = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { setKeyPair } = useCrypto();

  useEffect(() => {
    const params   = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setGlobalError('Invalid or missing reset token.');
    }
  }, [location]);

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    if (!password) { newErrors.password = 'Password is required'; isValid = false; }
    else if (password.length < 8) { newErrors.password = 'Password must be at least 8 characters'; isValid = false; }
    else if (!/(?=.*[A-Z])/.test(password)) { newErrors.password = 'Must contain at least one uppercase letter'; isValid = false; }
    else if (!/(?=.*\d)/.test(password)) { newErrors.password = 'Must contain at least one number'; isValid = false; }
    if (password !== confirmPassword) { newErrors.confirmPassword = 'Passwords do not match'; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  // Step 1: Verify recovery phrase
  const handleVerifyPhrase = async () => {
    setPhraseError('');
    setIsVerifyingPhrase(true);
    try {
      const words = phrase.trim().toLowerCase().split(/\s+/);
      if (words.length !== 24) {
        setPhraseError('Please enter all 24 words of your recovery phrase.');
        return;
      }
      // Try to decode — this validates the checksum
      await mnemonicToSecretKey(phrase);
      setPhraseVerified(true);
    } catch (err) {
      setPhraseError('Invalid recovery phrase. Please check your words and try again.');
    } finally {
      setIsVerifyingPhrase(false);
    }
  };

  // Step 2: Reset password + re-wrap key
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    if (!token) { setGlobalError('Invalid reset token.'); return; }
    if (!validateForm()) return;
    if (!phraseVerified && !skipPhrase) {
      setGlobalError('Please verify your recovery phrase first.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Reset password on server
      const response = await fetch(`${API}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await response.json();

      if (!response.ok) {
        setGlobalError(data.error || 'Password reset failed');
        return;
      }

      // 2. If user provided recovery phrase, re-wrap key with new password
      if (phraseVerified && phrase.trim()) {
        try {
          const secretKey          = await mnemonicToSecretKey(phrase);
          const kp                 = nacl.box.keyPair.fromSecretKey(secretKey);
          const encryptedPrivKey   = await encryptPrivateKey(secretKey, password);
          const recoveryKeyHash    = await hashRecoveryPhrase(phrase);

          // Use the token from reset response to authenticate the rekey request
          const loginToken = data.token || null;
          if (loginToken) {
            await fetch(`${API}/api/auth/rekey`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loginToken}`
              },
              body: JSON.stringify({
                encryptedPrivateKey: encryptedPrivKey,
                publicKey: encodeBase64(kp.publicKey),
                recoveryKeyHash
              })
            });
            // Load key into session for immediate use
            await setKeyPair(kp);
          }
        } catch (rekeyErr) {
          console.warn('[ResetPassword] Re-key failed:', rekeyErr);
          // Not fatal — user can still log in but without E2EE history recovery
        }
      }

      setSuccessMsg(data.message || 'Password reset successful!');
    } catch (err) {
      setGlobalError('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: '#0a0a0a', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ maxWidth: '480px', width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '40px 36px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 0 8px rgba(99,102,241,0.12)' }}>
            <Key size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: '24px', margin: 0, color: '#fff', fontWeight: 800 }}>Reset Password</h1>
          <p style={{ color: '#666', fontSize: 14, margin: '8px 0 0', lineHeight: 1.5 }}>
            Enter your 24-word recovery phrase to re-lock your encrypted messages with your new password.
          </p>
        </div>

        {globalError && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>{globalError}</div>}

        {successMsg ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} color="#10b981" />
            </div>
            <div style={{ color: '#4ade80', marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>{successMsg}</div>
            <Link to="/login" style={{ textDecoration: 'none', display: 'inline-block', padding: '14px 32px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontWeight: 700 }}>Go to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>

            {/* ─ STEP 1: Recovery Phrase ─ */}
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 14, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Shield size={16} color="#818cf8" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#a5b4fc' }}>Step 1 — Recovery Phrase</span>
                {phraseVerified && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Verified</span>}
              </div>

              {phraseVerified ? (
                <p style={{ margin: 0, color: '#34d399', fontSize: 13 }}>✓ Recovery phrase verified. Your encrypted messages will be re-locked with your new password.</p>
              ) : (
                <>
                  <textarea
                    placeholder="Enter your 24 recovery words separated by spaces…"
                    value={phrase}
                    onChange={e => { setPhrase(e.target.value); setPhraseError(''); }}
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0d0d1a', border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: 10, color: '#e2e8f0', fontSize: 13,
                      padding: '12px 14px', resize: 'vertical', outline: 'none',
                      fontFamily: 'monospace', lineHeight: 1.6,
                      marginBottom: phraseError ? 8 : 12
                    }}
                  />
                  {phraseError && <p style={{ margin: '0 0 8px', color: '#f87171', fontSize: 12 }}>{phraseError}</p>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleVerifyPhrase}
                      disabled={isVerifyingPhrase || !phrase.trim()}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: isVerifyingPhrase || !phrase.trim() ? 0.6 : 1 }}
                    >
                      {isVerifyingPhrase ? 'Verifying…' : 'Verify Phrase'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkipPhrase(s => !s)}
                      style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}
                    >
                      {skipPhrase ? "I'll provide my phrase" : "I lost my recovery phrase"}
                    </button>
                  </div>
                  {skipPhrase && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                        <p style={{ margin: 0, color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>
                          Without your recovery phrase, your previous encrypted messages cannot be decrypted. You'll get a fresh key pair after reset — old messages will appear encrypted.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ─ STEP 2: New Password ─ */}
            <div>
              <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '6px', display: 'block' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Step 2 — New Password</span>
              </label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: `1px solid ${errors.password ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: '12px', color: '#fff', fontSize: '15px', padding: '12px 44px 12px 16px', outline: 'none' }}
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({...errors, password: null}); }}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span style={{ color: '#ef4444', fontSize: '12px' }}>{errors.password}</span>}
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '6px', display: 'block' }}>Confirm New Password</label>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: `1px solid ${errors.confirmPassword ? '#ef4444' : 'rgba(255,255,255,0.12)'}`, borderRadius: '12px', color: '#fff', fontSize: '15px', padding: '12px 44px 12px 16px', outline: 'none' }}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({...errors, confirmPassword: null}); }}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && <span style={{ color: '#ef4444', fontSize: '12px' }}>{errors.confirmPassword}</span>}
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: isSubmitting || !token ? 'not-allowed' : 'pointer', opacity: isSubmitting || !token ? 0.7 : 1, transition: 'opacity 0.2s' }}
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? 'Resetting & Re-keying…' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;





