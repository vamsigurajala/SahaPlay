import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, User, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  mnemonicToSecretKey,
  hashRecoveryPhrase
} from './lib/crypto.js';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import RecoveryPhraseModal from './components/RecoveryPhraseModal';
import OAuthEncryptionModal from './components/OAuthEncryptionModal';
import SeoHead from './components/SeoHead';
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
  const [tooltipOpen, setTooltipOpen]             = useState(false);
  const tooltipRef = useRef(null);
  const [oauthModalMode, setOauthModalMode] = useState(null); // null | 'set' | 'unlock'
  const [oauthModalCtx, setOauthModalCtx] = useState(null);   // { data, oauthLabel, isMigration }

  const navigate       = useNavigate();
  const { t }          = useTranslation();
  const { setKeyPair } = useCrypto();

  // Tap-to-toggle for touch devices — :hover alone never fires on a phone/PWA,
  // so without this the tooltip could only be dismissed, never opened, by tap.
  useEffect(() => {
    if (!tooltipOpen) return;
    const handleOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) setTooltipOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [tooltipOpen]);

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

  // Used by Google sign-in. OAuth accounts have no password, so their E2EE private key is
  // protected by a separate encryption passphrase (OAuthEncryptionModal) instead
  // — never the OAuth login itself, never the chat-lock PIN. Three cases:
  //   needsKeySetup            — brand-new account (or unrecoverable legacy blob):
  //                               generate a fresh key, ask for a passphrase.
  //   needsPassphraseMigration — account still on the old server-side-wrapped
  //                               format: reuse the SAME key (server handed back
  //                               the raw key one final time), ask for a passphrase.
  //   otherwise                — already migrated: ask for the passphrase to
  //                               decrypt the stored blob locally.
  const completeOAuthSignup = async (data, oauthLabel) => {
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
      setOauthModalCtx({ data, oauthLabel, isMigration: false });
      setOauthModalMode('set');
    } else if (data.needsPassphraseMigration) {
      setOauthModalCtx({ data, oauthLabel, isMigration: true });
      setOauthModalMode('set');
    } else if (data.encryptedPrivateKey) {
      setOauthModalCtx({ data, oauthLabel });
      setOauthModalMode('unlock');
    } else {
      window.dispatchEvent(new Event('login_success'));
      navigate('/');
    }
  };

  // 'set' view of OAuthEncryptionModal — covers both brand-new key creation and
  // migrating an existing legacy-wrapped key onto a passphrase.
  const handleOAuthSetPassphrase = async (passphrase) => {
    const { data, isMigration } = oauthModalCtx;
    let keyPair;
    let phrase = null;
    if (isMigration) {
      // Migration reuses the account's existing key, so its original recovery
      // phrase (if the user still has it) already recovers it — nothing new to
      // generate or hash. Omitting recoveryKeyHash below relies on setup-keys'
      // COALESCE to leave the previously-stored hash untouched.
      keyPair = nacl.box.keyPair.fromSecretKey(decodeBase64(data.migrationRawKeyB64));
    } else {
      // Same compact 24-letter recovery key as password-account signup (see
      // handleSignup above) instead of the legacy 24-word BIP39 mnemonic — the
      // phrase itself is the seed, hashed to derive the secret key.
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      let phraseStr = '';
      const randBytes = crypto.getRandomValues(new Uint8Array(24));
      for (let i = 0; i < 24; i++) phraseStr += chars[randBytes[i] % chars.length];
      phrase = phraseStr.toUpperCase();
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phrase.toLowerCase()));
      keyPair = nacl.box.keyPair.fromSecretKey(new Uint8Array(hashBuf));
    }

    const encryptedPrivKey = await encryptPrivateKey(keyPair.secretKey, passphrase);
    const body = { publicKey: encodeBase64(keyPair.publicKey), encryptedPrivateKey: encryptedPrivKey };
    if (phrase) {
      body.recoveryKeyHash = await hashRecoveryPhrase(phrase);
    }

    const res = await fetch(`${API}/api/auth/setup-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(t('encSetupFailed', 'Failed to save your encryption key. Please try again.'));

    await setKeyPair(keyPair);
    setOauthModalMode(null);
    setOauthModalCtx(null);
    window.dispatchEvent(new Event('login_success'));

    if (phrase) {
      setRecoveryPhrase(phrase);
      setShowRecoveryModal(true);
    } else {
      navigate('/');
    }
  };

  // 'unlock' view — decrypt the already-migrated blob locally with the passphrase.
  const handleOAuthUnlock = async (passphrase) => {
    const { data } = oauthModalCtx;
    let keyPair;
    try {
      const secretKey = await decryptPrivateKey(data.encryptedPrivateKey, passphrase);
      keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
    } catch {
      throw new Error(t('encPassphraseWrong', 'Incorrect passphrase. If this account also has a password set, try that.'));
    }
    await setKeyPair(keyPair);
    setOauthModalMode(null);
    setOauthModalCtx(null);
    window.dispatchEvent(new Event('login_success'));
    navigate('/');
  };

  // 'forgot' view — restore via the account's recovery phrase, verify it against
  // the server's known publicKey, then re-wrap with a new passphrase.
  const handleOAuthRecover = async (phrase, newPassphrase) => {
    const { data } = oauthModalCtx;
    let keyPair;
    try {
      const secretKey = await mnemonicToSecretKey(phrase);
      keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
    } catch {
      throw new Error(t('encRecoveryPhraseInvalid', "That recovery phrase doesn't match this account."));
    }
    if (encodeBase64(keyPair.publicKey) !== data.publicKey) {
      throw new Error(t('encRecoveryPhraseInvalid', "That recovery phrase doesn't match this account."));
    }

    const encryptedPrivKey = await encryptPrivateKey(keyPair.secretKey, newPassphrase);
    const recoveryKeyHash = await hashRecoveryPhrase(phrase);
    const res = await fetch(`${API}/api/auth/setup-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
      body: JSON.stringify({ publicKey: data.publicKey, encryptedPrivateKey: encryptedPrivKey, recoveryKeyHash })
    });
    if (!res.ok) throw new Error(t('encSetupFailed', 'Failed to save your encryption key. Please try again.'));

    await setKeyPair(keyPair);
    setOauthModalMode(null);
    setOauthModalCtx(null);
    window.dispatchEvent(new Event('login_success'));
    navigate('/');
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
        await completeOAuthSignup(data, 'Google');
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

  const handlePhraseConfirmed = () => {
    setShowRecoveryModal(false);
    setRecoveryPhrase('');
    navigate('/login', { state: { message: t('accountCreatedVerify', 'Account created! Please check your email to verify your account.') } });
  };

  return (
    <>
      <SeoHead path="/signup" />
      {showRecoveryModal && (
        <RecoveryPhraseModal phrase={recoveryPhrase} onConfirmed={handlePhraseConfirmed} />
      )}
      {oauthModalMode && (
        <OAuthEncryptionModal
          mode={oauthModalMode}
          oauthLabel={oauthModalCtx?.oauthLabel}
          isMigration={!!oauthModalCtx?.isMigration}
          onSetPassphrase={handleOAuthSetPassphrase}
          onUnlock={handleOAuthUnlock}
          onRecover={handleOAuthRecover}
        />
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
            background: rgba(var(--brand-1-rgb),0.06) !important;
            border-color: rgba(var(--brand-1-rgb),0.15) !important;
          }
          html[data-theme='light'] .su-e2ee-label { color: var(--brand-1-darker) !important; }
          html[data-theme='light'] .su-e2ee-label strong { color: #3730a3 !important; }
          html[data-theme='light'] .su-e2ee .tooltip-container {
            background: rgba(var(--brand-1-rgb), 0.15) !important;
            color: var(--brand-1-darker) !important;
          }
          /* Tooltip styles */
          .tooltip-container { position: relative; display: inline-flex; cursor: help; }
          .tooltip-container .tooltip-text {
            visibility: hidden; width: 220px; background-color: #1a1a2e; color: #fff;
            text-align: center; border-radius: 8px; padding: 10px; position: absolute;
            z-index: 100; bottom: 125%; left: 50%; transform: translateX(-50%);
            opacity: 0; transition: opacity 0.3s; font-size: 11px; font-weight: normal;
            border: 1px solid rgba(var(--brand-1-rgb),0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }
          .tooltip-container .tooltip-text::after {
            content: ""; position: absolute; top: 100%; left: 50%;
            margin-left: -5px; border-width: 5px; border-style: solid;
            border-color: #1a1a2e transparent transparent transparent;
          }
          .tooltip-container:hover .tooltip-text,
          .tooltip-container.tooltip-open .tooltip-text { visibility: visible; opacity: 1; }
          html[data-theme='light'] .tooltip-container .tooltip-text {
            background-color: #ffffff !important; color: #1e293b !important; border: 1px solid rgba(var(--brand-1-rgb),0.2) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          }
          html[data-theme='light'] .tooltip-container .tooltip-text::after {
            border-color: #ffffff transparent transparent transparent !important;
          }

          /* Mobile/PWA: the icon sits near the right edge of the E2EE banner,
             so a 220px box centered on it (left:50%/translateX(-50%)) spilled
             off the right side of the screen. Anchor it to the icon's right
             edge instead and cap its width to the viewport so it always
             stays inside the app. */
          @media (max-width: 640px) {
            .tooltip-container .tooltip-text {
              width: 200px;
              max-width: calc(100vw - 56px);
              left: auto;
              right: -10px;
              transform: none;
            }
            .tooltip-container .tooltip-text::after {
              left: auto;
              right: 14px;
              margin-left: 0;
            }
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
              <Link to="/login" style={{ color: 'var(--brand-1)', textDecoration: 'none', fontWeight: 700 }}>{t('logIn', 'Log In')}</Link>
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
              <div className="su-e2ee" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(var(--brand-1-rgb),0.08)', border: '1px solid rgba(var(--brand-1-rgb),0.2)', borderRadius: '12px', padding: '10px 14px', marginBottom: '24px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🔐</span>
                <span className="su-e2ee-label" style={{ fontSize: '12px', color: 'var(--brand-1-light)', flex: 1 }}>
                  <strong style={{ color: '#c7d2fe' }}>{t('saveRecoveryPhrase', 'Save Recovery Phrase')}</strong>
                </span>
                <div
                  ref={tooltipRef}
                  className={`tooltip-container${tooltipOpen ? ' tooltip-open' : ''}`}
                  onClick={() => setTooltipOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.2)', color: '#c7d2fe', fontSize: '11px', fontWeight: 'bold' }}>
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
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-1)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    {t('agreeTermsPrefix', 'I agree to the')}{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-1)', fontWeight: 600, textDecoration: 'underline' }}>
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
                    style={{ width: '16px', height: '16px', accentColor: 'var(--brand-1)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    {t('agreePrivacyPrefix', 'I agree to the')}{' '}
                    <a href="https://www.iubenda.com/privacy-policy/25516226" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-1)', fontWeight: 600, textDecoration: 'underline' }}>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
