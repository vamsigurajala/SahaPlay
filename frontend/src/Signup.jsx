import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { Play, ArrowLeft, User, Mail, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useCrypto } from './contexts/CryptoContext';
import {
  generateKeyPair,
  encryptPrivateKey,
  secretKeyToMnemonic,
  hashRecoveryPhrase
} from './lib/crypto.js';
import { encodeBase64 } from 'tweetnacl-util';
import RecoveryPhraseModal from './components/RecoveryPhraseModal';

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

const Signup = () => {
  const [username, setUsername]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [errors, setErrors]             = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError]   = useState('');
  // Key setup phase
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const navigate   = useNavigate();
  const { t }      = useTranslation();
  const { setKeyPair } = useCrypto();

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    if (!username.trim()) { newErrors.username = 'Username is required'; isValid = false; }
    else if (username.length < 3) { newErrors.username = 'Username must be at least 3 characters'; isValid = false; }
    if (!email.trim()) { newErrors.email = 'Email is required'; isValid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { newErrors.email = 'Please enter a valid email format'; isValid = false; }
    if (!password) { newErrors.password = 'Password is required'; isValid = false; }
    else if (password.length < 8) { newErrors.password = 'Must be at least 8 characters'; isValid = false; }
    else if (!/[A-Z]/.test(password)) { newErrors.password = 'Must contain at least 1 uppercase letter'; isValid = false; }
    else if (!/[0-9]/.test(password)) { newErrors.password = 'Must contain at least 1 number'; isValid = false; }
    else if (!/[^A-Za-z0-9]/.test(password)) { newErrors.password = 'Must contain at least 1 special character (!@#$%…)'; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setGlobalError('');
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      // 1. Register account on server first
      const response = await fetch(`${API}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        setGlobalError(data.error || 'Signup failed');
        return;
      }

      // 2. Generate E2EE key pair client-side (never sent to server raw)
      const keyPair = generateKeyPair();

      // 3. Wrap private key with password using PBKDF2 + AES-256-GCM
      const encryptedPrivateKey = await encryptPrivateKey(keyPair.secretKey, password);

      // 4. Generate BIP39 24-word recovery phrase from the raw secret key
      const phrase = await secretKeyToMnemonic(keyPair.secretKey);
      const recoveryKeyHash = await hashRecoveryPhrase(phrase);

      // 5. Send public key + encrypted private key to server (raw key NEVER leaves browser)
      const token = data.token; // server may return token on signup for convenience
      const setupHeaders = { 'Content-Type': 'application/json' };
      if (token) setupHeaders['Authorization'] = `Bearer ${token}`;

      await fetch(`${API}/api/auth/setup-keys`, {
        method: 'POST',
        headers: setupHeaders,
        body: JSON.stringify({
          username,
          publicKey: encodeBase64(keyPair.publicKey),
          encryptedPrivateKey,
          recoveryKeyHash
        })
      });

      // 6. Store key pair in memory + session for immediate use
      await setKeyPair(keyPair);

      // 7. Show recovery phrase modal — user MUST acknowledge before continuing
      setRecoveryPhrase(phrase);
      setShowRecoveryModal(true);

    } catch (err) {
      console.error('Signup error:', err);
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
        // Google OAuth users get ephemeral key (CryptoContext auto-generates on next load)
        navigate('/');
      } else {
        setGlobalError(data.error || 'Google Signup failed');
      }
    } catch (err) {
      setGlobalError('Network error during Google Auth');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhraseConfirmed = () => {
    // User has acknowledged the recovery phrase — go to login
    setShowRecoveryModal(false);
    setRecoveryPhrase('');
    navigate('/login', { state: { message: 'Account created! Please log in with your new password.' } });
  };

  return (
    <>
      {showRecoveryModal && (
        <RecoveryPhraseModal phrase={recoveryPhrase} onConfirmed={handlePhraseConfirmed} />
      )}

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

            <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '1px', margin: '0 0 8px', color: '#fff', textTransform: 'uppercase', background: 'none', WebkitTextFillColor: '#fff' }}>{'Create Account'}</h1>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>{'End-to-end encrypted. Your messages are private.'}</p>

            {globalError && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>{globalError}</div>}

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }} noValidate>
              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '6px', display: 'block' }}>{t('fullName', 'Username')}</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input type="text" style={{ ...inputStyle, borderColor: errors.username ? '#ef4444' : 'rgba(255,255,255,0.12)' }} placeholder="johndoe" value={username}
                    onChange={e => { setUsername(e.target.value); if (errors.username) setErrors({...errors, username: null}); }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = errors.username ? '#ef4444' : 'rgba(255,255,255,0.12)'}
                  />
                </div>
                {errors.username && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.username}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '6px', display: 'block' }}>{t('email', 'Email Address')}</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input type="email" style={{ ...inputStyle, borderColor: errors.email ? '#ef4444' : 'rgba(255,255,255,0.12)' }} placeholder="name@example.com" value={email}
                    onChange={e => { setEmail(e.target.value); if (errors.email) setErrors({...errors, email: null}); }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = errors.email ? '#ef4444' : 'rgba(255,255,255,0.12)'}
                  />
                </div>
                {errors.email && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '6px', display: 'block' }}>Password</label>
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
                <span style={{ fontSize: 18 }}>🔐</span>
                <span style={{ fontSize: 12, color: 'rgba(165,180,252,0.9)', lineHeight: 1.4 }}>
                  After signup you'll receive a <strong>24-word recovery phrase</strong>. Your messages are end-to-end encrypted — not even the server can read them.
                </span>
              </div>

              <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s' }}>
                <UserPlus size={18} /> {isSubmitting ? 'Creating account...' : t('signUp', 'Sign Up')}
              </button>
            </form>

            <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              <span style={{ fontSize: '12px', color: '#555', letterSpacing: '1px' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setGlobalError('Google Signup was unsuccessful')} theme="filled_black" shape="pill" text="signup_with" />
            </div>

            <p style={{ color: '#888', fontSize: '14px' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>{t('logIn', 'Log In')}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;





