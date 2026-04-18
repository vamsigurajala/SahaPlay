import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { Play, ArrowLeft, Mail, Lock, LogIn, Eye, EyeOff, User, Shield } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import { decryptPrivateKey, generateKeyPair } from './lib/crypto.js';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

const API = 'http://localhost:3001';

const inputStyle = {
  width: '100%',
  background: '#111',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '15px',
  padding: '12px 16px 12px 44px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

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
    if (!username.trim()) { newErrors.username = 'Username or Email is required'; isValid = false; }
    if (!password) { newErrors.password = 'Password is required'; isValid = false; }
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
        setGlobalError(data.error || 'Login failed');
        return;
      }

      // Store auth token
      localStorage.setItem('watch_token', data.token);
      localStorage.setItem('watch_username', data.username);
      localStorage.removeItem('watch_is_guest');

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
      setGlobalError('Network error. Please try again later.');
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
        localStorage.setItem('watch_token', data.token);
        localStorage.setItem('watch_username', data.username);
        localStorage.removeItem('watch_is_guest');
        // Google OAuth: CryptoContext will auto-generate ephemeral keys
        navigate('/');
      } else {
        setGlobalError(data.error || 'Google Login failed');
      }
    } catch (err) {
      setGlobalError('Network error during Google Auth');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestJoin = (e) => {
    e.preventDefault();
    setGlobalError('');
    if (!guestName.trim()) {
      setGlobalError('Please enter a display name to join as guest');
      return;
    }
    localStorage.removeItem('watch_token');
    localStorage.setItem('watch_username', 'guest_' + guestName.trim());
    localStorage.setItem('watch_is_guest', 'true');
    // CryptoContext will auto-generate an ephemeral key pair for guests
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
      {/* Back link */}
      <div style={{ padding: '20px 32px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0aab2', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', padding: 0 }}>
          <ArrowLeft size={16} /> {t('backToHome', 'Back to Home')}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', minHeight: 'calc(100vh - 72px)' }}>
        <div className="animated-fade-in" style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>

          {/* Logo */}
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Play size={24} fill="#fff" color="#fff" />
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '1px', margin: '0 0 8px', color: '#fff', textTransform: 'uppercase', background: 'none', WebkitTextFillColor: '#fff' }}>{'Welcome Back'}</h1>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>{'Log in to decrypt your encrypted chats'}</p>

          {/* Success message from signup redirect */}
          {locationMsg && <div style={{ color: '#4ade80', marginBottom: '16px', fontSize: '14px', background: 'rgba(74,222,128,0.1)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(74,222,128,0.2)' }}>{locationMsg}</div>}

          {globalError && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>{globalError}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }} noValidate>
            <div>
              <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '6px', display: 'block' }}>{t('email', 'Username or Email')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input type="text" style={{ ...inputStyle, borderColor: errors.username ? '#ef4444' : 'rgba(255,255,255,0.12)' }} placeholder="name@example.com" value={username}
                  onChange={e => { setUsername(e.target.value); if (errors.username) setErrors({...errors, username: null}); }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = errors.username ? '#ef4444' : 'rgba(255,255,255,0.12)'}
                />
              </div>
              {errors.username && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.username}</span>}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', color: '#a0aab2' }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none' }}>Forgot Password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input type={showPassword ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: '44px', borderColor: errors.password ? '#ef4444' : 'rgba(255,255,255,0.12)' }} placeholder="••••••••" value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({...errors, password: null}); }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = errors.password ? '#ef4444' : 'rgba(255,255,255,0.12)'}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.password}</span>}
            </div>

            {/* E2EE info badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px' }}>
              <Shield size={14} color="#818cf8" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(165,180,252,0.9)', lineHeight: 1.4 }}>
                Your password decrypts your private key locally. The server never sees it.
              </span>
            </div>

            <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s' }}>
              <LogIn size={18} /> {isSubmitting ? 'Unlocking keys...' : t('logIn', 'Log In')}
            </button>
          </form>

          <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <span style={{ fontSize: '12px', color: '#555', letterSpacing: '1px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setGlobalError('Google Login was unsuccessful')} theme="filled_black" shape="pill" />
          </div>

          <p style={{ color: '#888', fontSize: '14px' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>{t('signUp', 'Sign Up')}</Link>
          </p>

          <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <span style={{ fontSize: '12px', color: '#555', letterSpacing: '1px' }}>GUEST</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          {!showGuestInput ? (
            <button onClick={() => setShowGuestInput(true)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <User size={18} /> Join as Guest
            </button>
          ) : (
            <form onSubmit={handleGuestJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', animation: 'slideInDown 0.3s ease' }}>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                <input type="text" style={inputStyle} placeholder="Display Name" value={guestName} onChange={e => setGuestName(e.target.value)} autoFocus />
              </div>
              <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#333', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#444'} onMouseLeave={e => e.currentTarget.style.background = '#333'}>
                Continue
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
