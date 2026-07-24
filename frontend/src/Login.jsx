import { useState, useEffect } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { signInWithApple } from './lib/appleAuth';
import { ArrowLeft, Mail, Lock, LogIn, Eye, EyeOff, User, Shield, Ban } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import { decryptPrivateKey, generateKeyPair, hashRecoveryPhrase } from './lib/crypto.js';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import RecoveryPhraseModal from './components/RecoveryPhraseModal';
import { API } from './lib/api';

const Login = () => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [errors, setErrors]             = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSlowLogin, setIsSlowLogin]   = useState(false);
  const [globalError, setGlobalError]   = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [guestName, setGuestName]       = useState('');
  const [bannedInfo, setBannedInfo]     = useState(null); // { type: 'temp'|'permanent'|'terminated', reason, bannedUntil }
  const [countdown, setCountdown]       = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [postRecoveryNav, setPostRecoveryNav] = useState('/');

  const navigate        = useNavigate();
  const location        = useLocation();
  const { t }           = useTranslation();
  const { setKeyPair }  = useCrypto();

  const locationMsg = location.state?.message;
  const banMessage = location.state?.banMessage;
  const terminateMessage = location.state?.terminateMessage;

  // After login, redirect to ?next= URL if present (same-origin paths only — no open redirect)
  const rawNext = new URLSearchParams(location.search).get('next') || '';
  const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;

  // Live countdown for temp bans
  useEffect(() => {
    if (!bannedInfo || bannedInfo.type !== 'temp' || !bannedInfo.bannedUntil) return;
    function tick() {
      const diff = new Date(bannedInfo.bannedUntil).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Ban has expired — you may try logging in again.'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d > 0 ? d + 'd ' : ''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bannedInfo]);

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
    setIsSlowLogin(false);

    // The backend (Render free tier) spins down when idle and can take
    // 30-60s to cold-start on the first request — without this, that just
    // looked like an indefinite silent hang. Surface a "waking up" message
    // once it's clearly not a normal fast response, and give up with a
    // clear error rather than hanging forever if it never comes back.
    const slowTimer = setTimeout(() => setIsSlowLogin(true), 6000);
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 70000);

    try {
      const response = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      const data = await response.json();

      if (!response.ok) {
        const code   = data.code;
        const reason = data.reason || 'Policy violation';
        if (code === 'ACCOUNT_BANNED_TEMP') {
          setBannedInfo({ type: 'temp', reason, bannedUntil: data.bannedUntil });
        } else if (code === 'ACCOUNT_BANNED_PERMANENT') {
          setBannedInfo({ type: 'permanent', reason });
        } else if (code === 'ACCOUNT_TERMINATED') {
          setBannedInfo({ type: 'terminated', reason });
        } else {
          if (data.needsVerification) {
            setNeedsVerification(true);
            setGlobalError(t('invalidCredentials', 'Invalid credentials'));
          } else {
            setNeedsVerification(false);
            setGlobalError(data.error || t('loginFailed', 'Login failed'));
          }
        }
        return;
      }

      // Clear any previous user's session data to prevent cross-account leakage
      clearUserSession();
      // Store auth token
      localStorage.setItem('watch_token', data.token);
      localStorage.setItem('watch_username', data.username);
      localStorage.setItem('watch_role', data.role || 'user');
      window.dispatchEvent(new Event('login_success'));
      navigate(safeNext || '/');

      // ─── E2EE Key Decryption ─────────────────────────────────────────────
      if (data.encryptedPrivateKey) {
        try {
          const secretKey = await decryptPrivateKey(data.encryptedPrivateKey, password);
          const kp = nacl.box.keyPair.fromSecretKey(secretKey);
          await setKeyPair(kp);
        } catch (cryptoErr) {
          console.warn('[Login] Key decryption failed — wrong password or corrupted blob. Regenerating fresh key.', cryptoErr);
          try {
            const { encryptPrivateKey, secretKeyToMnemonic, hashRecoveryPhrase } = await import('./lib/crypto.js');
            const kp                = generateKeyPair();
            const encryptedPrivKey  = await encryptPrivateKey(kp.secretKey, password);
            const phrase            = await secretKeyToMnemonic(kp.secretKey);
            const recoveryKeyHash   = await hashRecoveryPhrase(phrase);

            await fetch(`${API}/api/auth/setup-keys`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
              body: JSON.stringify({ username: data.username, publicKey: encodeBase64(kp.publicKey), encryptedPrivateKey: encryptedPrivKey, recoveryKeyHash })
            });
            await setKeyPair(kp);
            console.log('[Login] Fresh E2EE key pair generated and synchronized successfully.');
          } catch (repairErr) {
            console.error('[Login] Key repair failed:', repairErr);
          }
        }
      } else {
        try {
          const { encryptPrivateKey, secretKeyToMnemonic, hashRecoveryPhrase } = await import('./lib/crypto.js');
          const kp                = generateKeyPair();
          const encryptedPrivKey  = await encryptPrivateKey(kp.secretKey, password);
          const phrase            = await secretKeyToMnemonic(kp.secretKey);
          const recoveryKeyHash   = await hashRecoveryPhrase(phrase);

          await fetch(`${API}/api/auth/setup-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
            body: JSON.stringify({ username: data.username, publicKey: encodeBase64(kp.publicKey), encryptedPrivateKey: encryptedPrivKey, recoveryKeyHash })
          });
          await setKeyPair(kp);
        } catch (err) {
          console.error('[Login] Legacy key setup failed:', err);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

    } catch (err) {
      if (err.name === 'AbortError') {
        setGlobalError(t('loginTimeout', 'The server is taking longer than expected to respond (it may be waking up from idle). Please try again in a moment.'));
      } else {
        setGlobalError(t('networkErrorLater', 'Network error. Please try again later.'));
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setIsSubmitting(false);
      setIsSlowLogin(false);
    }
  };

  // Shared by Google and Apple sign-in — both return the same { token, username, role,
  // needsKeySetup, rawPrivateKeyB64 } shape from the backend, they only differ in which
  // no-password key-wrapping endpoint to call on first login.
  const completeOAuthLogin = async (data, setupKeysPath, oauthLabel) => {
    clearUserSession();
    localStorage.setItem('watch_token', data.token);
    localStorage.setItem('watch_username', data.username);
    localStorage.setItem('watch_role', data.role || 'user');

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
        setPostRecoveryNav(safeNext || '/');
        setRecoveryPhrase(phrase);
        setShowRecoveryModal(true);
      } catch (keyErr) {
        console.error(`[Login] ${oauthLabel} key setup failed:`, keyErr);
        window.dispatchEvent(new Event('login_success'));
        navigate(safeNext || '/');
      }
    } else {
      if (data.rawPrivateKeyB64) {
        try {
          const secretKey = decodeBase64(data.rawPrivateKeyB64);
          const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
          await setKeyPair(keyPair);
        } catch (restoreErr) {
          console.warn(`[Login] Failed to restore ${oauthLabel} E2EE key:`, restoreErr);
        }
      }
      window.dispatchEvent(new Event('login_success'));
      navigate(safeNext || '/');
    }
  };

  const handleOAuthFailure = (data, fallbackMsg) => {
    const code   = data.code;
    const reason = data.reason || 'Policy violation';
    if (code === 'ACCOUNT_BANNED_TEMP') {
      setBannedInfo({ type: 'temp', reason, bannedUntil: data.bannedUntil });
    } else if (code === 'ACCOUNT_BANNED_PERMANENT') {
      setBannedInfo({ type: 'permanent', reason });
    } else if (code === 'ACCOUNT_TERMINATED') {
      setBannedInfo({ type: 'terminated', reason });
    } else {
      setGlobalError(data.error || fallbackMsg);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGlobalError('');
    setIsSubmitting(true);
    setIsSlowLogin(false);

    // Same Render cold-start protection as handleLogin — without it, the first
    // Google sign-in after the backend has been idle can silently hang or fail
    // with a generic network error, while a retry a few seconds later (backend
    // now warm) succeeds instantly, looking like "first try doesn't work".
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
        await completeOAuthLogin(data, '/api/auth/setup-google-keys', 'Google');
      } else {
        handleOAuthFailure(data, t('googleLoginFailed', 'Google Login failed'));
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

      // Same Render cold-start protection as handleLogin/handleGoogleSuccess —
      // only guards the fetch to our own backend, not the Apple popup step.
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
        await completeOAuthLogin(data, '/api/auth/setup-apple-keys', 'Apple');
      } else {
        handleOAuthFailure(data, t('appleLoginFailed', 'Apple Login failed'));
      }
    } catch (err) {
      if (err?.error === 'popup_closed_by_user') {
        // User cancelled the popup — not an error worth surfacing
      } else if (err.name === 'AbortError') {
        setGlobalError(t('loginTimeout', 'The server is taking longer than expected to respond (it may be waking up from idle). Please try again in a moment.'));
      } else {
        console.error('[Login] Apple Sign-In error:', err);
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
    navigate(postRecoveryNav);
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
    navigate('/');
  };

  const isTerminated = bannedInfo?.type === 'terminated';
  const isPermanent  = bannedInfo?.type === 'permanent';

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

        html[data-theme='light'] .guest-submit-btn {
          background: #64748b !important;
          color: #fff !important;
        }
        html[data-theme='light'] .guest-submit-btn:hover {
          background: #475569 !important;
        }

        @keyframes ban-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .ban-countdown {
          font-family: 'Courier New', monospace;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #f87171;
          animation: ban-pulse 2s ease-in-out infinite;
        }
        html[data-theme='light'] .login-ban-card {
          background: #ffffff !important;
          border-color: rgba(0,0,0,0.08) !important;
        }
        html[data-theme='light'] .ban-reason-box {
          background: rgba(239,68,68,0.06) !important;
          border-color: rgba(239,68,68,0.2) !important;
        }
        html[data-theme='light'] .ban-reason-label { color: rgba(185,28,28,0.6) !important; }
        html[data-theme='light'] .ban-reason-text  { color: #b91c1c !important; }
        html[data-theme='light'] .ban-timer-box {
          background: rgba(0,0,0,0.03) !important;
          border-color: rgba(0,0,0,0.08) !important;
        }
        html[data-theme='light'] .ban-timer-label { color: #6b7280 !important; }
        html[data-theme='light'] .ban-timer-date  { color: #374151 !important; }
        html[data-theme='light'] .ban-switch-btn  { color: #6b7280 !important; border-color: rgba(0,0,0,0.12) !important; }
        html[data-theme='light'] .ban-switch-btn:hover { background: rgba(0,0,0,0.04) !important; }
      `}</style>

      {/* Absolute Back Button — hidden on mobile/iPad, see .login-back-btn media query below */}
      <div className="login-back-btn" style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 50 }}>
        <button onClick={() => navigate('/')} className="back-box-btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }} title={t('backToHome', 'Back to Home')}>
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 48, height: 48 }} />
            <h2 className="login-left-text" style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '1px', margin: 0 }}>SahaPlay</h2>
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
        {/* ── Ban / Terminated screen ────────────────────────────────────────── */}
        {bannedInfo ? (
          <div className="login-card login-ban-card animated-fade-in">
            {/* Icon + title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: isTerminated ? 'rgba(220,38,38,0.18)' : 'rgba(239,68,68,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                boxShadow: isTerminated ? '0 0 40px rgba(220,38,38,0.25)' : '0 0 40px rgba(239,68,68,0.2)',
              }}>
                {isTerminated
                  ? <Shield size={36} color="#ef4444" />
                  : <Ban size={36} color="#f87171" />}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: isTerminated ? '#ef4444' : '#f87171', margin: '0 0 8px', textAlign: 'center' }}>
                {isTerminated ? 'Account Terminated' : 'Account Suspended'}
              </h1>
              <p style={{ color: '#888', fontSize: 13, margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
                {isTerminated
                  ? 'This account has been permanently terminated by an admin.'
                  : isPermanent
                    ? 'This account has been permanently suspended.'
                    : 'This account has been temporarily suspended.'}
              </p>
            </div>

            {/* Reason */}
            <div className="ban-reason-box" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
              <p className="ban-reason-label" style={{ fontSize: 10, fontWeight: 700, color: 'rgba(252,165,165,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 7px' }}>Reason</p>
              <p className="ban-reason-text" style={{ fontSize: 14, color: '#fca5a5', margin: 0, lineHeight: 1.6 }}>{bannedInfo.reason}</p>
            </div>

            {/* Temp ban: lift date + live countdown */}
            {bannedInfo.type === 'temp' && bannedInfo.bannedUntil && (
              <div className="ban-timer-box" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 16px', marginBottom: 18, textAlign: 'center' }}>
                <p className="ban-timer-label" style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>Suspension Lifts On</p>
                <p className="ban-timer-date" style={{ fontSize: 13, color: '#a0aab2', margin: '0 0 18px', lineHeight: 1.4 }}>
                  {new Date(bannedInfo.bannedUntil).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="ban-timer-label" style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Time Remaining</p>
                <div className="ban-countdown">{countdown || '—'}</div>
              </div>
            )}

            {/* Permanent / terminated notice */}
            {(isPermanent || isTerminated) && (
              <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 14, padding: '13px 16px', marginBottom: 18, textAlign: 'center' }}>
                <p style={{ color: 'rgba(252,165,165,0.65)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  {isTerminated
                    ? 'Account termination is permanent and cannot be reversed through this platform.'
                    : 'This suspension is permanent. Contact support if you believe this is a mistake.'}
                </p>
              </div>
            )}

            {/* Switch account */}
            <button
              className="ban-switch-btn"
              onClick={() => { setBannedInfo(null); setCountdown(''); setGlobalError(''); setUsername(''); setPassword(''); }}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#a0aab2', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Try a different account
            </button>
          </div>
        ) : (
        /* ── Normal login form ────────────────────────────────────────────── */
        <div className="login-card animated-fade-in">
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', margin: '0 0 8px', color: '#fff' }}>{t('welcomeBack', 'Welcome Back')}</h1>
          <p style={{ color: '#888', fontSize: '15px', marginBottom: '32px' }}>{t('loginDesc', 'Log in to access your encrypted chats')}</p>

          {locationMsg && <div style={{ color: '#4ade80', marginBottom: '20px', fontSize: '14px', background: 'rgba(74,222,128,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.2)' }}>{locationMsg}</div>}

          {banMessage && (
            <div style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.35)' }}>
              <div style={{ background: 'rgba(239,68,68,0.18)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                <Ban size={15} color="#f87171" />
                <span style={{ color: '#f87171', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em' }}>ACCOUNT BANNED</span>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.08)', padding: '12px 16px' }}>
                {banMessage.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: i === 0 ? '0 0 4px' : 0, color: i === 0 ? '#fca5a5' : 'rgba(252,165,165,0.7)', fontSize: 13, lineHeight: 1.5 }}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {terminateMessage && (
            <div style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(220,38,38,0.5)' }}>
              <div style={{ background: 'rgba(220,38,38,0.22)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(220,38,38,0.25)' }}>
                <Shield size={15} color="#ef4444" />
                <span style={{ color: '#ef4444', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em' }}>ACCOUNT TERMINATED</span>
              </div>
              <div style={{ background: 'rgba(220,38,38,0.1)', padding: '12px 16px' }}>
                {terminateMessage.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: i === 0 ? '0 0 4px' : 0, color: i === 0 ? '#fca5a5' : 'rgba(252,165,165,0.65)', fontSize: 13, lineHeight: 1.5 }}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {globalError && (
            <div style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', padding: '12px 16px' }}>
                {globalError.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: i === 0 ? '0 0 4px' : 0, color: i === 0 ? '#fca5a5' : 'rgba(252,165,165,0.7)', fontSize: 13, lineHeight: 1.5 }}>{line || ' '}</p>
                ))}
              </div>
              {needsVerification && (
                <div style={{ background: 'rgba(239,68,68,0.04)', padding: '10px 16px', borderTop: '1px solid rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(252,165,165,0.8)' }}>Email not verified?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      setResendStatus('sending');
                      try {
                        await fetch(`${API}/api/resend-verification`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: username.trim() }),
                        });
                        setResendStatus('sent');
                      } catch {
                        setResendStatus('error');
                      }
                    }}
                    disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                    style={{ fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: resendStatus === 'sent' ? 'default' : 'pointer', padding: 0, fontWeight: 700 }}
                  >
                    {resendStatus === 'sending' ? 'Sending…' : resendStatus === 'sent' ? '✓ Sent! Check your inbox' : resendStatus === 'error' ? 'Failed — try again' : 'Resend verification email'}
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }} noValidate>
            <div>
              <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('usernameOrEmailLabel', 'Username/Email')}</label>
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
            {isSubmitting && isSlowLogin && (
              <p style={{ margin: '-8px 0 0', fontSize: 12.5, color: '#a0aab2', textAlign: 'center', lineHeight: 1.5 }}>
                {t('serverWakingUp', "Still working — the server may be waking up from idle, this can take up to a minute.")}
              </p>
            )}
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

            <button type="button" className="social-btn apple-btn" onClick={handleAppleClick}>
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
        )}
      </div>
      {showRecoveryModal && <RecoveryPhraseModal phrase={recoveryPhrase} onConfirmed={handlePhraseConfirmed} />}
    </div>
  );
};


export default Login;
