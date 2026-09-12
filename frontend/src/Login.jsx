import { useState, useEffect } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { ArrowLeft, Mail, Lock, LogIn, Eye, EyeOff, User, Shield, Ban } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import { decryptPrivateKey, encryptPrivateKey, generateKeyPair, mnemonicToSecretKey, hashRecoveryPhrase } from './lib/crypto.js';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import RecoveryPhraseModal from './components/RecoveryPhraseModal';
import OAuthEncryptionModal from './components/OAuthEncryptionModal';
import SeoHead from './components/SeoHead';
import { API } from './lib/api';
import { isCapacitorApp, isTauriApp } from './lib/platform';
import { openNativeGoogleSignIn } from './lib/nativeGoogleAuth';
import { resyncPushTokenAfterLogin } from './lib/nativePush';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
  const [oauthModalMode, setOauthModalMode] = useState(null); // null | 'set' | 'unlock'
  const [oauthModalCtx, setOauthModalCtx] = useState(null);   // { data, oauthLabel, isMigration }

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
      // Right after a Render cold boot, the Node process itself answers
      // requests before its DB connection pool has actually finished
      // establishing — so the very first request can come back FAST with a
      // real 500 "Database error", not a slow timeout (that case is what
      // the AbortController below is for). A silent one-time retry here is
      // what "just click login again and it works" was actually doing
      // manually; a genuine 4xx (wrong password, banned, etc.) still
      // surfaces immediately without waiting on a pointless retry.
      let response, data;
      for (let attempt = 1; attempt <= 2; attempt++) {
        response = await fetch(`${API}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: controller.signal
        });
        data = await response.json();
        if (response.ok || response.status !== 500 || attempt === 2) break;
        await new Promise(r => setTimeout(r, 1200));
      }

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
      resyncPushTokenAfterLogin();
      // useInactivityLogout only mounts on protected routes, so watch_last_activity
      // never gets refreshed while sitting on this logged-out login page — it can be
      // stale from a session that ended 20+ minutes ago. Without resetting it here,
      // the very next route (ProtectedRoute mounting for the first time this session)
      // runs its immediate-on-mount inactivity check against that stale value and
      // force-logs-out right after a perfectly valid login, bouncing back to /login.
      localStorage.setItem('watch_last_activity', String(Date.now()));
      window.dispatchEvent(new Event('login_success'));
      navigate(safeNext || '/');

      // ─── E2EE Key Decryption ─────────────────────────────────────────────
      if (data.encryptedPrivateKey) {
        try {
          const secretKey = await decryptPrivateKey(data.encryptedPrivateKey, password);
          const kp = nacl.box.keyPair.fromSecretKey(secretKey);
          await setKeyPair(kp);
        } catch (cryptoErr) {
          // The login password no longer unwraps this account's stored key
          // blob. This used to be treated as "corrupted, regenerate a fresh
          // key" — which silently overwrote the account's public key
          // server-side, permanently orphaning every message anyone had
          // ever encrypted to the OLD key (on every device, including this
          // account's own sent history). That is never the right response
          // to a decrypt failure here.
          //
          // The real cause, now that email/password accounts can migrate to
          // an independent encryption passphrase (see Profile.jsx's
          // "Encryption passphrase" section — the same fix this closes:
          // wrapping with the login password meant the server, which sees
          // it on every login, could in principle derive the same wrapping
          // key): this account has already migrated, so the login password
          // is no longer the right secret. Ask for the passphrase instead —
          // dispatched as an event (not rendered here) because navigate()
          // above already unmounts this component before this async block
          // resolves; EncryptionUnlockGate (mounted once at the App level)
          // picks it up and renders the unlock/recover flow.
          console.warn('[Login] Login password did not unwrap the stored key — likely migrated to an independent passphrase.', cryptoErr);
          window.dispatchEvent(new CustomEvent('encryption_needs_passphrase', {
            detail: { encryptedPrivateKey: data.encryptedPrivateKey, publicKey: data.publicKey, token: data.token }
          }));
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
  const completeOAuthLogin = async (data, oauthLabel) => {
    clearUserSession();
    // isNewAccount (see /api/auth/google): clicking "Continue with Google" on
    // the LOGIN page for an email Google has never sent us before creates the
    // account right here, same as the Signup page's own Google button would
    // — and it's just as unverified. Persisting a working session before the
    // passphrase step below finishes let that brand-new, unverified account
    // straight into the app (any protected route only ever checks whether
    // this token exists, never the server's isVerified flag) — deferred the
    // same way Signup.jsx's completeOAuthSignup does.
    if (!data.isNewAccount) {
      localStorage.setItem('watch_token', data.token);
      localStorage.setItem('watch_username', data.username);
      localStorage.setItem('watch_role', data.role || 'user');
      resyncPushTokenAfterLogin();
      // See handleLogin's comment above — resets the inactivity clock so the
      // first protected-route mount after login doesn't see a stale timestamp.
      localStorage.setItem('watch_last_activity', String(Date.now()));
    }

    if (data.needsKeySetup) {
      setOauthModalCtx({ data, oauthLabel, isMigration: false, oauthPendingVerification: !!data.isNewAccount });
      setOauthModalMode('set');
    } else if (data.needsPassphraseMigration) {
      setOauthModalCtx({ data, oauthLabel, isMigration: true });
      setOauthModalMode('set');
    } else if (data.encryptedPrivateKey) {
      setOauthModalCtx({ data, oauthLabel });
      setOauthModalMode('unlock');
    } else {
      // No key on file and not flagged needsKeySetup — inconsistent state;
      // don't block navigation on it.
      window.dispatchEvent(new Event('login_success'));
      navigate(safeNext || '/');
    }
  };

  // 'set' view of OAuthEncryptionModal — covers both brand-new key creation and
  // migrating an existing legacy-wrapped key onto a passphrase.
  const handleOAuthSetPassphrase = async (passphrase) => {
    const { data, isMigration, oauthPendingVerification } = oauthModalCtx;
    let keyPair;
    let phrase = null;
    if (isMigration) {
      // Migration reuses the account's existing key, so its original recovery
      // phrase (if the user still has it) already recovers it — nothing new to
      // generate or hash. Omitting recoveryKeyHash below relies on setup-keys'
      // COALESCE to leave the previously-stored hash untouched.
      keyPair = nacl.box.keyPair.fromSecretKey(decodeBase64(data.migrationRawKeyB64));
    } else {
      // Same compact 24-letter recovery key as password-account signup instead
      // of the legacy 24-word BIP39 mnemonic — the phrase itself is the seed,
      // hashed to derive the secret key.
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
    // oauthPendingVerification (a brand-new, unverified Google account
    // created right here — see completeOAuthLogin above): no logged-in
    // session actually exists yet, so don't announce one. The recovery-
    // phrase-confirmed handler below still routes this case to /login with
    // the "check your email" message instead of straight into the app.
    if (!oauthPendingVerification) window.dispatchEvent(new Event('login_success'));

    if (phrase) {
      setPostRecoveryNav(oauthPendingVerification ? null : (safeNext || '/'));
      setRecoveryPhrase(phrase);
      setShowRecoveryModal(true);
    } else if (!oauthPendingVerification) {
      navigate(safeNext || '/');
    } else {
      navigate('/login', { state: { message: t('accountCreatedVerify', 'Account created! Please check your email to verify your account.') } });
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
    navigate(safeNext || '/');
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
    navigate(safeNext || '/');
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
        await completeOAuthLogin(data, 'Google');
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

  // Fired by main.jsx's initNativeGoogleAuthCallback once the native Google
  // sign-in Custom Tab hands an id_token back to the app (see
  // lib/nativeGoogleAuth.js) — routes it through the exact same completion
  // path the web <GoogleLogin> button's onSuccess already uses.
  useEffect(() => {
    if (!isCapacitorApp()) return;
    const onNativeGoogleAuth = (e) => {
      if (e.detail?.idToken) handleGoogleSuccess({ credential: e.detail.idToken });
    };
    window.addEventListener('native-google-auth', onNativeGoogleAuth);
    return () => window.removeEventListener('native-google-auth', onNativeGoogleAuth);
  }, []);

  const handlePhraseConfirmed = () => {
    setShowRecoveryModal(false);
    setRecoveryPhrase('');
    // postRecoveryNav is null exactly for the brand-new, unverified Google
    // account case (see handleOAuthSetPassphrase) — route to /login with the
    // verify-email message instead of straight into the app, matching what
    // a password-account signup already does.
    if (postRecoveryNav === null) {
      navigate('/login', { state: { message: t('accountCreatedVerify', 'Account created! Please check your email to verify your account.') } });
    } else {
      navigate(postRecoveryNav);
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
    localStorage.setItem('watch_last_activity', String(Date.now()));
    navigate('/');
  };

  const isTerminated = bannedInfo?.type === 'terminated';
  const isPermanent  = bannedInfo?.type === 'permanent';
  const isDesktopApp = isTauriApp();

  return (
    <div className={`login-layout${isDesktopApp ? ' login-layout--app' : ''}`}>
      <SeoHead path="/login" />
      <style>{`
        .login-layout {
          display: flex;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
          background: #050505;
          color: #fff;
          overflow-x: hidden;
          overflow-y: auto;
        }

        /* Compact auth screen for the Tauri desktop app: it's a fixed native
           window, not a full-width marketing page, so the card (sized for a
           browser viewport, with lots of inter-field spacing) reads as
           oversized. Branding panel stays -- only the form card shrinks.
           max-height+overflow is a safety net for an unusually short window;
           it scopes the scroll to the card itself, never the page/navbar. */
        .login-layout--app .login-card {
          padding: 22px 26px !important; max-width: 400px !important;
          max-height: calc(100vh - 32px) !important; overflow-y: auto !important;
        }
        .login-layout--app .login-right { padding: 16px !important; }
        .login-layout--app .login-card h1 { font-size: 20px !important; margin-bottom: 14px !important; }
        .login-layout--app .login-card > p { margin-bottom: 14px !important; }
        .login-layout--app .login-card form { gap: 12px !important; }
        .login-layout--app .login-card label { margin-bottom: 4px !important; }
        .login-layout--app .login-input { padding-top: 9px !important; padding-bottom: 9px !important; }
        .login-layout--app .login-submit-btn { padding: 11px !important; }
        .login-layout--app .login-card form + div { margin: 14px 0 !important; }
        .login-layout--app .login-card form + div + div { margin-bottom: 12px !important; }

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
        }
        .login-input:focus { border-color: var(--brand-1); background: #1f1f26; }
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

        .login-submit-btn {
          width: 100%; padding: 16px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, var(--brand-1), var(--brand-2));
          color: #fff !important; font-size: 16px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 8px; transition: all 0.2s; box-shadow: 0 8px 20px rgba(var(--brand-1-rgb),0.3);
        }
        .login-submit-btn * { color: #fff !important; fill: #fff !important; }
        .login-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(var(--brand-1-rgb),0.4); }
        .login-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        /* Light Mode */
        html[data-theme='light'] .login-layout { background: #f8fafc; }
        html[data-theme='light'] .login-left {
          background: linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 100%);
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
          background: #ffffff !important; border-color: var(--brand-1) !important; box-shadow: 0 0 0 4px rgba(var(--brand-1-rgb),0.1) !important;
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
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', margin: '0 0 24px', color: '#fff' }}>{t('welcomeBack', 'Welcome Back')}</h1>

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
                    style={{ fontSize: 12, color: 'var(--brand-1-light)', background: 'none', border: 'none', cursor: resendStatus === 'sent' ? 'default' : 'pointer', padding: 0, fontWeight: 700 }}
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
                <input type={showPassword ? 'text' : 'password'} className="login-input" style={{ paddingRight: password ? '48px' : undefined, borderColor: errors.password ? '#ef4444' : undefined }} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({...errors, password: null}); }} />
                {password && (
                  <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
              {errors.password && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', display: 'block' }}>{errors.password}</span>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--brand-1)', textDecoration: 'none', fontWeight: 600 }}>{t('forgotPassword', 'Forgot Password?')}</Link>
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
                {isCapacitorApp() ? (
                  // Google blocks its own OAuth screen inside any embedded WebView —
                  // the web <GoogleLogin> popup silently shows nothing here. Same
                  // visible icon, but the click opens a real Chrome Custom Tab instead
                  // (see lib/nativeGoogleAuth.js); handleGoogleSuccess still runs, just
                  // via the 'native-google-auth' listener above instead of onSuccess.
                  <button type="button" onClick={() => openNativeGoogleSignIn(GOOGLE_CLIENT_ID)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Sign in with Google" />
                ) : (
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setGlobalError(t('googleFailed', 'Google Login was unsuccessful'))} type="icon" shape="circle" size="large" />
                )}
              </div>
            </div>
          </div>

          <p style={{ color: '#888', fontSize: '15px', marginBottom: '24px', textAlign: 'center' }}>
            {t('dontHaveAccount', "Don't have an account?")}{' '}
            <Link to="/signup" style={{ color: 'var(--brand-1)', textDecoration: 'none', fontWeight: 700 }}>{t('signUp', 'Sign Up')}</Link>
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
    </div>
  );
};


export default Login;
