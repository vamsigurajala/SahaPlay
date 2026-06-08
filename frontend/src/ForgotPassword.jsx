import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, Send, CheckCircle, Play, LogIn } from 'lucide-react';

const API = `http://${window.location.hostname}:3001`;

const ForgotPassword = () => {
  const [email, setEmail]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setGlobalError(t('enterEmailOrUsernameError', 'Please enter your email or username.')); return; }
    setGlobalError('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang: i18n.language })
      });
      const data = await response.json();
      if (response.ok) {
        setSubmitted(true);
      } else {
        const errorMsg = data.error === 'Email or username is required' 
          ? t('emailOrUsernameRequired', 'Email or username is required') 
          : (data.error || t('somethingWentWrongError', 'Something went wrong. Please try again.'));
        setGlobalError(errorMsg);
      }
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

        .fp-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: fp-spin 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes fp-spin { to { transform: rotate(360deg); } }

        /* Light Mode */
        html[data-theme='light'] .login-layout { background: #f8fafc; }
        html[data-theme='light'] .login-left {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        }
        html[data-theme='light'] .login-left::before { background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); }
        html[data-theme='light'] .login-left::after  { background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); }
        html[data-theme='light'] .login-left-text { color: #fff !important; }

        html[data-theme='light'] .login-right { background: #f8fafc; }
        html[data-theme='light'] .login-card {
          background: #ffffff; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 24px 60px rgba(0,0,0,0.06);
        }
        html[data-theme='light'] .login-card h1,
        html[data-theme='light'] .login-card label,
        html[data-theme='light'] .login-card span { color: #0f172a !important; }
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
        html[data-theme='light'] .back-box-btn {
          background: rgba(255,255,255,0.8) !important;
          color: #0f172a !important;
          border-color: rgba(0,0,0,0.1) !important;
        }
        html[data-theme='light'] .fp-link { color: #64748b !important; }
        html[data-theme='light'] .fp-link:hover { color: #6366f1 !important; }
        html[data-theme='light'] .fp-success-note {
          background: rgba(16,185,129,0.08) !important;
          color: #059669 !important;
        }
        html[data-theme='light'] .fp-success-email { color: #6366f1 !important; }
      `}</style>

      {/* ── Back Button (same as Login) ── */}
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 50 }}>
        <button
          onClick={() => navigate('/login')}
          className="back-box-btn"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
          title={t('backToLogin', 'Back to Login')}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* ── Left Panel (same as Login) ── */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
              <Play size={24} fill="#fff" color="#fff" style={{ marginLeft: '4px' }} />
            </div>
            <h2 className="login-left-text" style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '1px', margin: 0 }}>SahaPlay</h2>
          </div>
          <h1 className="login-left-text" style={{ fontSize: '52px', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-1px' }}>
            {t('forgotPasswordTitle', 'Forgot your password?')}<br />
            <span style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('noProblem', 'No problem.')}</span>
          </h1>
          <p className="login-left-text" style={{ fontSize: '17px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, maxWidth: '440px' }}>
            {t('forgotPasswordLeftDesc', "Enter your email and we'll send you a secure link to reset your password. Takes less than a minute.")}
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="login-right">
        <div className="login-card animated-fade-in">

          {submitted ? (
            /* ── Success State ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(16,185,129,0.15)' }}>
                <CheckCircle size={36} color="#10b981" strokeWidth={1.5} />
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.5px' }}>{t('checkYourInbox', 'Check your inbox!')}</h1>
              <p style={{ color: '#888', fontSize: '15px', lineHeight: 1.65, margin: '0 0 28px' }}>
                {t('resetLinkSentDesc', 'We sent a reset link to {{email}}. It expires in 10 minutes.', { email: email })}
              </p>
              <div className="fp-success-note" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '14px', padding: '14px 18px', marginBottom: '28px', color: '#34d399', fontSize: '14px', lineHeight: 1.6, textAlign: 'left' }}>
                📬 <strong>{t('dontSeeItTitle', "Don't see it?")}</strong> {t('dontSeeItText', 'Check your Spam or Promotions folder. It may take 1–2 minutes.')}
              </div>
              <button
                onClick={() => navigate('/login')}
                className="login-submit-btn"
              >
                <LogIn size={18} />
                <span>{t('backToLoginBtn', 'Back to Login')}</span>
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.5px', margin: '0 0 8px', color: '#fff' }}>{t('resetPasswordTitle', 'Reset Password')}</h1>
              <p style={{ color: '#888', fontSize: '15px', marginBottom: '32px' }}>
                {t('resetPasswordDesc', "Enter your email or username and we'll send you a reset link.")}
              </p>

              {globalError && (
                <div style={{ color: '#ef4444', marginBottom: '20px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {globalError}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }} noValidate>
                <div>
                  <label style={{ fontSize: '13px', color: '#a0aab2', marginBottom: '8px', display: 'block', fontWeight: 600 }}>{t('emailOrUsernameLabel', 'Email or Username')}</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                      id="fp-email"
                      type="text"
                      className="login-input"
                      placeholder={t('emailOrUsernamePlaceholder', 'name@example.com or username')}
                      value={email}
                      autoComplete="email"
                      onChange={(e) => { setEmail(e.target.value); setGlobalError(''); }}
                    />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="login-submit-btn">
                  {isSubmitting
                    ? <><div className="fp-spinner" /><span>{t('sendingLink', 'Sending link...')}</span></>
                    : <><Send size={18} /><span>{t('sendResetLink', 'Send Reset Link')}</span></>}
                </button>
              </form>

              <p style={{ color: '#888', fontSize: '15px', marginTop: '28px', textAlign: 'center' }}>
                {t('rememberPassword', 'Remember your password?')}{' '}
                <Link to="/login" className="fp-link" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 700 }}>{t('logIn', 'Log In')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
