import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [resetLink, setResetLink] = useState('');

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'Email or username is required';
      isValid = false;
    } else if (email.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Only strictly validate email format when @ is present
      newErrors.email = 'Please enter a valid email format';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setSuccessMsg('');
    setPreviewUrl('');
    setResetLink('');
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMsg(data.message);
        if (data.resetLink) setResetLink(data.resetLink);
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
      } else {
        setGlobalError(data.error || 'Request failed');
      }
    } catch (err) {
      setGlobalError('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel animated-fade-in" style={{ padding: '40px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Reset Password 🔐</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', fontWeight: '300' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {globalError && <div style={{ color: 'var(--danger)', marginBottom: '15px', fontSize: '14px', background: 'var(--danger-bg)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255, 75, 75, 0.2)' }}>{globalError}</div>}
        
        {successMsg ? (
          <div>
            <div style={{ color: '#4ade80', marginBottom: '15px', fontSize: '15px', fontWeight: '500' }}>✅ {successMsg}</div>
            {resetLink && (
              <div style={{ marginBottom: '16px', padding: '14px', background: 'rgba(99,102,241,0.15)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.4)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔐 Your Reset Link (Dev Mode)</p>
                <a href={resetLink} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', background: 'var(--accent)', color: '#fff', padding: '12px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '15px', textAlign: 'center' }}>
                  👉 Click Here to Reset Password
                </a>
              </div>
            )}
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '12px', textDecoration: 'underline' }}>
                📧 View test email in Ethereal
              </a>
            )}
            <Link to="/login" className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
            <div className="input-group">
              <label className="input-label" htmlFor="email">Email or Username</label>
              <input
                id="email"
                type="text"
                className={`input-field ${errors.email ? 'error' : ''}`}
                placeholder="your@email.com  or  your_username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({...errors, email: null});
                }}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <button type="submit" className="btn" style={{ width: '100%', marginTop: '5px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
            </button>
            
            <div style={{ marginTop: '16px', fontSize: '14px' }}>
              <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Back to Login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
