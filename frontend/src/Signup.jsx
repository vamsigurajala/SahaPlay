import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { signInWithApple } from './lib/appleAuth';
import { ArrowLeft, User, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import {
  generateKeyPair,
  encryptPrivateKey,
  secretKeyToMnemonic,
  hashRecoveryPhrase
} from './lib/crypto.js';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import RecoveryPhraseModal from './components/RecoveryPhraseModal';
import nacl from 'tweetnacl';
import { API } from './lib/api';

const Signup = () => {
  const [username, setUsername]             = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors]                 = useState({});
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isSlowLogin, setIsSlowLogin]       = useState(false);
  const [globalError, setGlobalError]       = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [agreeTerms, setAgreeTerms]               = useState(false);
  const [agreePrivacy, setAgreePrivacy]            = useState(false);

  const navigate       = useNavigate();
  const { t }          = useTranslation();
  const { setKeyPair } = useCrypto();

  const validateForm = () => {
    const e = {};
    if (!username.trim())          e.username = t('usernameRequired', 'Username is required');
    else if (username.length < 3)  e.username = t('usernameTooShort', 'At least 3 characters');
    if (!email.trim())             e.email = t('emailRequired', 'Email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('emailInvalid', 'Enter a valid email');
    if (!password)                 e.password = t('passwordRequired', 'Password is required');
    else if (password.length < 8)  e.password = t('passwordTooShort', 'At least 8 characters');
    else if (!/[A-Z]/.test(password))   e.password = t('passwordUpper', 'Include at least 1 uppercase letter');
    else if (!/[0-9]/.test(password))   e.password = t('passwordNumber', 'Include at least 1 number');
    else if (!/[^A-Za-z0-9]/.test(password)) e.password = t('passwordSpecial', 'Include at least 1 special character');
    if (confirmPassword !== password) e.confirmPassword = t('passwordsMismatch', 'Passwords do not match');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async (ev) => {
    ev.preventDefault();
    setGlobalError('');
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await response.json();
      if (!response.ok) { setGlobalError(data.error || t('signupFailed', 'Signup failed')); return; }

      // Generate a 24-letter recovery key
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      let phraseStr = '';
      const randBytes = crypto.getRandomValues(new Uint8Array(24));
      for (let i = 0; i < 24; i++) phraseStr += chars[randBytes[i] % chars.length];
      const phrase = phraseStr.toUpperCase(); // e.g. "ABCDEF..."

      // Hash it to get a 32-byte secret key for the keypair
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phrase.toLowerCase()));
      const secretKey = new Uint8Array(hashBuf);
      const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);

      const encryptedPrivateKey = await encryptPrivateKey(keyPair.secretKey, password);
      const recoveryKeyHash = await hashRecoveryPhrase(phrase);

      const token = data.token;
      const setupHeaders = { 'Content-Type': 'application/json' };
      if (token) setupHeaders['Authorization'] = `Bearer ${token}`;

      await fetch(`${API}/api/auth/setup-keys`, {
        method: 'POST',
        headers: setupHeaders,
        body: JSON.stringify({ username, publicKey: encodeBase64(keyPair.publicKey), encryptedPrivateKey, recoveryKeyHash })
      });

      await setKeyPair(keyPair);
      setRecoveryPhrase(phrase);
      setShowRecoveryModal(true);
    } catch (err) {
      console.error('Signup error:', err);
      setGlobalError(t('networkError', 'Network error. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared by Google and Apple sign-in — both return the same { token, username,
  // needsKeySetup, rawPrivateKeyB64 } shape from the backend, they only differ in which
  // no-password key-wrapping endpoint to call on first login.
  const completeOAuthSignup = async (data, setupKeysPath, oauthLabel) => {
    // Clear any previous user's session data to prevent cross-account leakage
    try {
      const { clearUserSession } = await import('./lib/authUtils.js');
      clearUserSession();
    } catch (e) {}
    localStorage.setItem('watch_token', data.token);
    localStorage.setItem('watch_username', data.username);
    // useInactivityLogout only mounts on protected routes, so watch_last_activity can
    // be stale from a session that ended 20+ minutes ago — reset it here so the first
    // protected-route mount after this login doesn't immediately force-logout.
    localStorage.setItem('watch_last_activity', String(Date.now()));

    if (data.needsKeySetup) {
      // First login (or a legacy account missing keys): generate an E2EE key pair.
      // OAuth users have no password, so it's wrapped server-side instead (see
      // setupKeysPath) rather than with a client-derived password key.
      try {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let phraseStr = '';
        const randBytes = crypto.getRandomValues(new Uint8Array(24));
        for (let i = 0; i < 24; i++) phraseStr += chars[randBytes[i] % chars.length];
        const phrase = phraseStr.toUpperCase();

        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phrase.toLowerCase()));
        const secretKey = new Uint8Array(hashBuf);
        const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
        const recoveryKeyHash = await hashRecoveryPhrase(phrase);

        await fetch(`${API}${setupKeysPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
          body: JSON.stringify({
            publicKey: encodeBase64(keyPair.publicKey),
            rawPrivateKey: encodeBase64(keyPair.secretKey),
            recoveryKeyHash
          })
        });

        await setKeyPair(keyPair);
        window.dispatchEvent(new Event('login_success'));
        setRecoveryPhrase(phrase);
        setShowRecoveryModal(true);
      } catch (keyErr) {
        console.error(`[Signup] ${oauthLabel} key setup failed:`, keyErr);
        window.dispatchEvent(new Event('login_success'));
        navigate('/');
      }
    } else {
      if (data.rawPrivateKeyB64) {
        try {
          const secretKey = decodeBase64(data.rawPrivateKeyB64);
          const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
          await setKeyPair(keyPair);
        } catch (restoreErr) {
          console.warn(`[Signup] Failed to restore ${oauthLabel} E2EE key:`, restoreErr);
        }
      }
      window.dispatchEvent(new Event('login_success'));
      navigate('/');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGlobalError('');
    setIsSubmitting(true);
    setIsSlowLogin(false);

    // Render free tier spins down when idle and can take 30-60s to cold-start
    // on the first request — without this, the first Google sign-in after any
    // idle period silently hangs/fails with a generic error, while a retry a
    // few seconds later (backend now warm) succeeds instantly.
    const slowTimer = setTimeout(() => setIsSlowLogin(true), 6000);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 70000);

    try {
      const response = await fetch(`${API}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
        signal: controller.signal
      });
      const data = await response.json();
      if (response.ok) {
        await completeOAuthSignup(data, '/api/auth/setup-google-keys', 'Google');
      } else {
        setGlobalError(data.error || t('googleSignupFailed', 'Google Signup failed'));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setGlobalError(t('loginTimeout', 'The server is taking longer than expected to respond (it may be waking up from idle). Please try again in a moment.'));
      } else {
        setGlobalError(t('networkErrorGoogle', 'Network error during Google Auth'));
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setIsSubmitting(false);
      setIsSlowLogin(false);
    }
  };

  const handleAppleClick = async () => {
    setGlobalError('');
    setIsSubmitting(true);
    setIsSlowLogin(false);
    let slowTimer, abortTimer;
    try {
      const authData = await signInWithApple();

      slowTimer = setTimeout(() => setIsSlowLogin(true), 6000);
      const controller = new AbortController();
      abortTimer = setTimeout(() => controller.abort(), 70000);

      const response = await fetch(`${API}/api/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: authData.authorization?.id_token,
          user: authData.user || null,
        }),
        signal: controller.signal
      });
      const data = await response.json();
      if (response.ok) {
        await completeOAuthSignup(data, '/api/auth/setup-apple-keys', 'Apple');
      } else {
        setGlobalError(data.error || t('appleSignupFailed', 'Apple Signup failed'));
      }
    } catch (err) {
      if (err?.error === 'popup_closed_by_user') {
        // User cancelled the popup — not an error worth surfacing
      } else if (err.name === 'AbortError') {
        setGlobalError(t('loginTimeout', 'The server is taking longer than expected to respond (it may be waking up from idle). Please try again in a moment.'));
      } else {
        console.error('[Signup] Apple Sign-In error:', err);
        setGlobalError(t('networkErrorApple', 'Network error during Apple Auth'));
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setIsSubmitting(false);
      setIsSlowLogin(false);
    }
  };

  const handlePhraseConfirmed = () => {
    setShowRecoveryModal(false);
    setRecoveryPhrase('');
    navigate('/login', { state: { message: t('accountCreatedVerify', 'Account created! Please check your email to verify your account.') } });
  };

  return (
    <>
      {showRecoveryModal && (
        <RecoveryPhraseModal phrase={recoveryPhrase} onConfirmed={handlePhraseConfirmed} />
      )}

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
            padding: 32px 24px;
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

          .social-btn {
            width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.1); background: #1a1a1f; color: #fff; cursor: pointer;
            transition: all 0.2s;
          }
          .social-btn:hover { background: #25252d; transform: translateY(-2px); }

          .su-spinner {
            width: 18px; height: 18px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: #fff; border-radius: 50%;
            animation: su-spin 0.65s linear infinite; flex-shrink: 0;
          }
          @keyframes su-spin { to { transform: rotate(360deg); } }

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
          html[data-theme='light'] .login-left-gradient-text {
            background: none !important;
            -webkit-text-fill-color: #ffffff !important;
            color: #ffffff !important;
          }
          html[data-theme='light'] .social-btn {
            background: #ffffff; border-color: rgba(0,0,0,0.1); color: #0f172a;
          }
          html[data-theme='light'] .social-btn:hover { background: #f8fafc; }
          html[data-theme='light'] .back-box-btn {
            background: rgba(255,255,255,0.8) !important;
            color: #0f172a !important;
            border-color: rgba(0,0,0,0.1) !important;
          }
          html[data-theme='light'] .su-e2ee {
            background: rgba(99,102,241,0.06) !important;
            border-color: rgba(99,102,241,0.15) !important;
          }
          html[data-theme='light'] .su-e2ee-label { color: #4338ca !important; }
          html[data-theme='light'] .su-e2ee-label strong { color: #3730a3 !important; }
          html[data-theme='light'] .su-e2ee .tooltip-container {
            background: rgba(99, 102, 241, 0.15) !important;
            color: #4338ca !important;
          }
          .apple-btn { background: #fff !important; color: #000 !important; border: none !important; }
          .apple-btn:hover { background: #f0f0f0 !important; }
          html[data-theme='light'] .apple-btn { background: #000 !important; color: #fff !important; }
          html[data-theme='light'] .apple-btn:hover { background: #222 !important; }
          
          /* Tooltip styles */
          .tooltip-container { position: relative; display: inline-flex; cursor: help; }
          .tooltip-container .tooltip-text {
            visibility: hidden; width: 220px; background-color: #1a1a2e; color: #fff;
            text-align: center; border-radius: 8px; padding: 10px; position: absolute;
            z-index: 100; bottom: 125%; left: 50%; transform: translateX(-50%);
            opacity: 0; transition: opacity 0.3s; font-size: 11px; font-weight: normal;
            border: 1px solid rgba(99,102,241,0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }
          .tooltip-container .tooltip-text::after {
            content: ""; position: absolute; top: 100%; left: 50%;
            margin-left: -5px; border-width: 5px; border-style: solid;
            border-color: #1a1a2e transparent transparent transparent;
          }
          .tooltip-container:hover .tooltip-text { visibility: visible; opacity: 1; }
          html[data-theme='light'] .tooltip-container .tooltip-text {
            background-color: #ffffff !important; color: #1e293b !important; border: 1px solid rgba(99,102,241,0.2) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          }
          html[data-theme='light'] .tooltip-container .tooltip-text::after {
            border-color: #ffffff transparent transparent transparent !important;
          }
        `}</style>

        {/* ── Back Button — hidden on mobile/iPad, see .login-back-btn media query ── */}
        <div className="login-back-btn" style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 50 }}>
          <button
            onClick={() => navigate('/')}
            className="back-box-btn"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
            title={t('backToHome', 'Back to Home')}
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* ── Left Panel ── */}
        <div className="login-left">
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 48, height: 48 }} />
              <h2 className="login-left-text" style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '1px', margin: 0 }}>SahaPlay</h2>
            </div>
            <h1 className="login-left-text" style={{ fontSize: '56px', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1px' }}>
              {t('joinFutureWatching', 'Join the future of watching.')}
            </h1>
            <p className="login-left-text" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: '480px' }}>
              {t('signupSubtitle', 'Create your free account and start watching with friends in synchronized rooms — with end-to-end encrypted chat.')}
            </p>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="login-right">
          <div className="login-card animated-fade-in">
            <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', margin: '0 0 8px', color: '#fff' }}>{t('createAccount', 'Create Account')}</h1>
            <p style={{ color: '#888', fontSize: '15px', marginBottom: '32px' }}>
              {t('alreadyHaveOne', 'Already have one?')}{' '}
              <Link to="/login" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 700 }}>{t('logIn', 'Log In')}</Link>
            </p>

            {globalError && (
              <div style={{ color: '#ef4444', marginBottom: '20px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                {globalError}
              </div>
            )}

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }} noValidate>
              {/* Username */}
              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('usernameLabel', 'Username')}</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input
                    type="text" className="login-input"
                    style={{ borderColor: errors.username ? '#ef4444' : undefined }}
                    placeholder={t('usernamePlaceholder', 'Username')} value={username}
                    onChange={e => { setUsername(e.target.value); if (errors.username) setErrors({ ...errors, username: null }); }}
                  />
                </div>
                {errors.username && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.username}</span>}
              </div>

              {/* Email */}
              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('emailAddressLabel', 'Email Address')}</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input
                    type="email" className="login-input"
                    style={{ borderColor: errors.email ? '#ef4444' : undefined }}
                    placeholder={t('emailPlaceholder', 'name@example.com')} value={email}
                    onChange={e => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: null }); }}
                  />
                </div>
                {errors.email && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.email}</span>}
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('passwordLabel', 'Password')}</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input
                    type={showPassword ? 'text' : 'password'} className="login-input"
                    style={{ paddingRight: '48px', borderColor: errors.password ? '#ef4444' : undefined }}
                    placeholder={t('passwordPlaceholder', 'Password')} value={password}
                    onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: null }); }}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('confirmPasswordLabel', 'Confirm Password')}</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'} className="login-input"
                    style={{ paddingRight: '48px', borderColor: errors.confirmPassword ? '#ef4444' : undefined }}
                    placeholder={t('confirmPasswordPlaceholder', 'Confirm your password')} value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null }); }}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(p => !p)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.confirmPassword}</span>}
              </div>

              {/* E2EE notice */}
              <div className="su-e2ee" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '10px 14px', marginBottom: '24px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🔐</span>
                <span className="su-e2ee-label" style={{ fontSize: '12px', color: '#a5b4fc', flex: 1 }}>
                  <strong style={{ color: '#c7d2fe' }}>{t('saveRecoveryPhrase', 'Save Recovery Phrase')}</strong>
                </span>
                <div className="tooltip-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', fontSize: '11px', fontWeight: 'bold' }}>
                  i
                  <span className="tooltip-text">
                    {t('recoveryTooltip', "After signup you'll receive a 24-letter recovery key. It's the only way to recover your encrypted messages if you forget your password or change your device. The server never sees your messages.")}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'inherit' }}>
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    required
                    style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    {t('agreeTermsPrefix', 'I agree to the')}{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'underline' }}>
                      {t('termsAndConditions', 'Terms & Conditions')}
                    </a>
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'inherit' }}>
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={e => setAgreePrivacy(e.target.checked)}
                    required
                    style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    {t('agreePrivacyPrefix', 'I agree to the')}{' '}
                    <a href="https://www.iubenda.com/privacy-policy/25516226" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'underline' }}>
                      {t('privacyPolicy', 'Privacy Policy')}
                    </a>
                  </span>
                </label>
              </div>

              <button type="submit" disabled={isSubmitting || !agreeTerms || !agreePrivacy} className="login-submit-btn">
                {isSubmitting
                  ? <><div className="su-spinner" /><span>{t('creatingAccount', 'Creating account...')}</span></>
                  : <><UserPlus size={18} /><span>{t('signUp', 'Sign Up')}</span></>}
              </button>
              {isSubmitting && isSlowLogin && (
                <p style={{ margin: '-8px 0 0', fontSize: 12.5, color: '#a0aab2', textAlign: 'center', lineHeight: 1.5 }}>
                  {t('serverWakingUp', "Still working — the server may be waking up from idle, this can take up to a minute.")}
                </p>
              )}
            </form>

            <div style={{ margin: '28px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(150,150,150,0.15)' }} />
              <span style={{ fontSize: '11px', color: '#888', letterSpacing: '1px', fontWeight: 700 }}>{t('orSignUpWith', 'OR SIGN UP WITH')}</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(150,150,150,0.15)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '8px' }}>
              {/* Google */}
              <div className="social-btn" style={{ position: 'relative', overflow: 'hidden', background: '#fff', width: '50px', height: '50px' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
                  <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" />
                    <path fill="#34A853" d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8766 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7253 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4059 48.0016 24.48 48.0016Z" />
                    <path fill="#FBBC05" d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03296C-0.371021 20.0112 -0.371021 28.0009 3.03296 34.7825L11.0051 28.6006Z" />
                    <path fill="#EA4335" d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6869 13.0973L40.5387 6.24553C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4059 0.00161733 7.10718 5.11644 3.03296 13.2296L11.0051 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" />
                  </svg>
                </div>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.001, zIndex: 2 }}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setGlobalError(t('googleUnsuccessful', 'Google Signup was unsuccessful'))}
                    type="icon" shape="circle" size="large"
                  />
                </div>
              </div>

              {/* Apple */}
              <button
                type="button"
                className="social-btn apple-btn"
                onClick={handleAppleClick}
                style={{ width: '50px', height: '50px' }}
              >
                <svg width="22" height="22" viewBox="0 0 384 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
