import React, { useState } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { Play, ArrowLeft, Mail, Lock, LogIn, Eye, EyeOff, User, Shield } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import { decryptPrivateKey, generateKeyPair } from './lib/crypto.js';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

const API = `http://${window.location.hostname}:3001`;

const Login = () => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [errors, setErrors]             = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError]   = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [guestName, setGuestName]       = useState('');

  const navigate        = useNavigate();
  const location        = useLocation();
  const { t }           = useTranslation();
  const { setKeyPair }  = useCrypto();

  const locationMsg = location.state?.message;

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    if (!username.trim()) { newErrors.username = t('usernameOrEmailRequired', 'Username or Email is required'); isValid = false; }
    if (!password) { newErrors.password = t('passwordRequired', 'Password is required'); isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setGlobalError('');
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || '';
        if (errMsg === 'Invalid credentials') {
          setGlobalError(t('invalidCredentials', 'Invalid credentials'));
        } else if (errMsg === 'Login failed') {
          setGlobalError(t('loginFailed', 'Login failed'));
        } else {
          setGlobalError(errMsg || t('loginFailed', 'Login failed'));
        }
        return;
      }

      // Clear any previous user's session data to prevent cross-account leakage
      clearUserSession();
      // Store auth token
      localStorage.setItem('watch_token', data.token);
      localStorage.setItem('watch_username', data.username);

      // ─── E2EE Key Decryption ─────────────────────────────────────────────
      if (data.encryptedPrivateKey) {
        try {
          // Decrypt the private key using the user's password (PBKDF2 + AES-256-GCM)
          const secretKey = await decryptPrivateKey(data.encryptedPrivateKey, password);
          const kp = nacl.box.keyPair.fromSecretKey(secretKey);
          await setKeyPair(kp);
        } catch (cryptoErr) {
          console.warn('[Login] Key decryption failed — wrong password or corrupted blob. Regenerating fresh key.', cryptoErr);
          // If we can't decrypt the old key, we MUST generate a fresh one and re-sync with server
          // otherwise E2EE will be broken for this session (sender/receiver key mismatch).
          try {
            const { encryptPrivateKey, secretKeyToMnemonic, hashRecoveryPhrase } = await import('./lib/crypto.js');
            const kp                = generateKeyPair();
            const encryptedPrivKey  = await encryptPrivateKey(kp.secretKey, password);
            const phrase            = await secretKeyToMnemonic(kp.secretKey);
            const recoveryKeyHash   = await hashRecoveryPhrase(phrase);

            await fetch(`${API}/api/auth/setup-keys`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`
              },
              body: JSON.stringify({
                username: data.username,
                publicKey: encodeBase64(kp.publicKey),
                encryptedPrivateKey: encryptedPrivKey,
                recoveryKeyHash
              })
            });
            await setKeyPair(kp);
            console.log('[Login] Fresh E2EE key pair generated and synchronized successfully.');
          } catch (repairErr) {
            console.error('[Login] Key repair failed:', repairErr);
          }
        }
      } else {
        // Account predates E2EE setup — generate fresh keys and set them up
        try {
          const { encryptPrivateKey, secretKeyToMnemonic, hashRecoveryPhrase } = await import('./lib/crypto.js');
          const kp                = generateKeyPair();
          const encryptedPrivKey  = await encryptPrivateKey(kp.secretKey, password);
          const phrase            = await secretKeyToMnemonic(kp.secretKey);
          const recoveryKeyHash   = await hashRecoveryPhrase(phrase);

          await fetch(`${API}/api/auth/setup-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`
            },
            body: JSON.stringify({
              username: data.username,
              publicKey: encodeBase64(kp.publicKey),
              encryptedPrivateKey: encryptedPrivKey,
              recoveryKeyHash
            })
          });
          await setKeyPair(kp);
        } catch (err) {
          console.error('[Login] Legacy key setup failed:', err);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      navigate('/');
    } catch (err) {
      setGlobalError(t('networkErrorLater', 'Network error. Please try again later.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGlobalError('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const data = await response.json();
      if (response.ok) {
        clearUserSession();
        localStorage.setItem('watch_token', data.token);
        localStorage.setItem('watch_username', data.username);
        // Google OAuth: CryptoContext will auto-generate ephemeral keys
        navigate('/');
      } else {
        setGlobalError(data.error || t('googleLoginFailed', 'Google Login failed'));
      }
    } catch (err) {
      setGlobalError(t('networkErrorGoogle', 'Network error during Google Auth'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestJoin = (e) => {
    e.preventDefault();
    setGlobalError('');
    if (!guestName.trim()) {
      setGlobalError(t('enterGuestNameError', 'Please enter a display name to join as guest'));
      return;
    }
    clearUserSession();
    localStorage.setItem('watch_username', 'guest_' + guestName.trim());
    localStorage.setItem('watch_is_guest', 'true');
    // CryptoContext will auto-generate an ephemeral key pair for guests
    navigate('/');
  };

  return (
    <div className="login-layout">
      <style>{`
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
        }
        .login-input:focus { border-color: #6366f1; background: #1f1f26; }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover, 
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #1a1a1f inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        
        .social-btn {
          width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.1); background: #1a1a1f; color: #fff; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .social-btn:hover { background: #25252d; transform: translateY(-2px); }
        
        .apple-btn { background: #fff !important; color: #000 !important; border: none !important; }
        .apple-btn:hover { background: #f0f0f0 !important; }
        
        .login-submit-btn {
          width: 100%; padding: 16px; border-radius: 14px; border: none; 
          background: linear-gradient(135deg, #6366f1, #a855f7); 
          color: #fff !important; font-size: 16px; font-weight: 700; 
          cursor: pointer; display: flex; align-items: center; justify-content: center; 
          gap: 8px; transition: all 0.2s; box-shadow: 0 8px 20px rgba(99,102,241,0.3);
        }
        .login-submit-btn * { color: #fff !important; fill: #fff !important; }
        .login-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(99,102,241,0.4); }
        .login-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        
        /* Light Mode */
        html[data-theme='light'] .login-layout { background: #f8fafc; }
        html[data-theme='light'] .login-left {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        }
        html[data-theme='light'] .login-left::before { background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); }
        html[data-theme='light'] .login-left::after { background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); }
        html[data-theme='light'] .login-left-text { color: #fff !important; }
        
        html[data-theme='light'] .login-right { background: #f8fafc; }
        html[data-theme='light'] .login-card {
          background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 24px 60px rgba(0,0,0,0.06);
        }
        html[data-theme='light'] .login-card h1, html[data-theme='light'] .login-card label, html[data-theme='light'] .login-card span { color: #0f172a !important; }
        html[data-theme='light'] .login-submit-btn span { color: #ffffff !important; }
        html[data-theme='light'] .login-card p { color: #64748b !important; }
        html[data-theme='light'] .login-input {
          background: #ffffff !important; border: 1px solid rgba(0,0,0,0.15) !important; color: #0f172a !important;
        }
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
        html[data-theme='light'] .social-btn {
          background: #ffffff; border-color: rgba(0,0,0,0.1); color: #0f172a;
        }
        html[data-theme='light'] .social-btn:hover { background: #f8fafc; }
        
        html[data-theme='light'] .apple-btn { background: #000 !important; color: #fff !important; }
        html[data-theme='light'] .apple-btn:hover { background: #222 !important; }
        
        html[data-theme='light'] .back-box-btn {
          background: rgba(255,255,255,0.8) !important;
          color: #0f172a !important;
          border-color: rgba(0,0,0,0.1) !important;
        }
        
        .guest-outline-btn {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid rgba(150,150,150,0.2);
          background: transparent !important;
          color: #a0aab2 !important;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .guest-outline-btn:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        html[data-theme='light'] .guest-outline-btn {
          background: #64748b !important;
          color: #fff !important;
          border-color: #64748b !important;
        }
        html[data-theme='light'] .guest-outline-btn:hover {
          background: #475569 !important;
          border-color: #475569 !important;
        }

        /* Light mode — Continue as Guest filled button */
        html[data-theme='light'] .guest-submit-btn {
          background: #64748b !important;
          color: #fff !important;
        }
        html[data-theme='light'] .guest-submit-btn:hover {
          background: #475569 !important;
        }
      `}</style>

      {/* Absolute Back Button */}
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 50 }}>
        <button onClick={() => navigate('/')} className="back-box-btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }} title={t('backToHome', 'Back to Home')}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
              <Play size={24} fill="#fff" color="#fff" style={{ marginLeft: '4px' }} />
            </div>
            <h2 className="login-left-text" style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '1px', margin: 0 }}>Watch Together</h2>
          </div>
          <h1 className="login-left-text" style={{ fontSize: '56px', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1px' }}>
            {t('syncPerfectly', 'Sync perfectly.')}<br/>{t('watchSeamlessly', 'Watch seamlessly.')}
          </h1>
          <p className="login-left-text" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: '480px' }}>
            {t('loginSubtitle', 'Experience the next generation of synchronized streaming. Crystal clear chat, zero-latency playback, and end-to-end encryption.')}
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card animated-fade-in">
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', margin: '0 0 8px', color: '#fff' }}>{t('welcomeBack', 'Welcome Back')}</h1>
          <p style={{ color: '#888', fontSize: '15px', marginBottom: '32px' }}>{t('loginDesc', 'Log in to access your encrypted chats')}</p>

          {locationMsg && <div style={{ color: '#4ade80', marginBottom: '20px', fontSize: '14px', background: 'rgba(74,222,128,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.2)' }}>{locationMsg}</div>}
          {globalError && <div style={{ color: '#ef4444', marginBottom: '20px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>{globalError}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }} noValidate>
            <div>
              <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('email', 'Username or Email')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input type="text" className="login-input" style={{ borderColor: errors.username ? '#ef4444' : undefined }} placeholder="name@example.com" value={username} onChange={e => { setUsername(e.target.value); if (errors.username) setErrors({...errors, username: null}); }} />
              </div>
              {errors.username && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.username}</span>}
            </div>

            <div>
              <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('password', 'Password')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input type={showPassword ? 'text' : 'password'} className="login-input" style={{ paddingRight: '48px', borderColor: errors.password ? '#ef4444' : undefined }} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({...errors, password: null}); }} />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.password}</span>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Link to="/forgot-password" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>{t('forgotPassword', 'Forgot Password?')}</Link>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="login-submit-btn">
              <LogIn size={20} /> <span>{isSubmitting ? t('loggingIn', 'Logging in...') : t('logIn', 'Log In')}</span>
            </button>
          </form>

          <div style={{ margin: '28px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(150,150,150,0.15)' }}></div>
            <span style={{ fontSize: '11px', color: '#888', letterSpacing: '1px', fontWeight: 700 }}>{t('orContinueWith', 'OR CONTINUE WITH')}</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(150,150,150,0.15)' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
            <div className="social-btn" style={{ position: 'relative', overflow: 'hidden', background: '#fff' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" />
                  <path fill="#34A853" d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8766 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7253 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4059 48.0016 24.48 48.0016Z" />
                  <path fill="#FBBC05" d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03296C-0.371021 20.0112 -0.371021 28.0009 3.03296 34.7825L11.0051 28.6006Z" />
                  <path fill="#EA4335" d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6869 13.0973L40.5387 6.24553C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4059 0.00161733 7.10718 5.11644 3.03296 13.2296L11.0051 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" />
                </svg>
              </div>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.001, zIndex: 2 }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setGlobalError(t('googleFailed', 'Google Login was unsuccessful'))} type="icon" shape="circle" size="large" />
              </div>
            </div>
            
            <button type="button" className="social-btn apple-btn" onClick={() => setGlobalError(t('appleNotConfigured', 'Apple Login is not yet configured'))}>
              <svg width="22" height="22" viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
            </button>
          </div>

          <p style={{ color: '#888', fontSize: '15px', marginBottom: '24px', textAlign: 'center' }}>
            {t('dontHaveAccount', "Don't have an account?")}{' '}
            <Link to="/signup" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 700 }}>{t('signUp', 'Sign Up')}</Link>
          </p>

          {!showGuestInput ? (
            <button onClick={() => setShowGuestInput(true)} className="guest-outline-btn">
              <User size={18} /> {t('joinAsGuest', 'Join as Guest')}
            </button>
          ) : (
            <form onSubmit={handleGuestJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', animation: 'slideInDown 0.3s ease' }}>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input type="text" className="login-input guest-input" placeholder={t('guestDisplayName', 'Guest Display Name')} value={guestName} onChange={e => setGuestName(e.target.value)} autoFocus />
              </div>
              <button type="submit" className="guest-submit-btn stay-white" style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: '#334155', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#1e293b'} onMouseLeave={e => e.currentTarget.style.background = '#334155'}>
                {t('continueAsGuest', 'Continue as Guest')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};


export default Login;
