import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const API_BASE_URL = `http://${window.location.hostname}:3001`;

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    fetch(`${API_BASE_URL}/api/verify?token=${token}`)
      .then(res => res.json().then(data => ({ status: res.status, body: data })))
      .then(({ status, body }) => {
        if (status === 200) {
          setStatus('success');
          setMessage(body.message || 'Email successfully verified!');
        } else {
          setStatus('error');
          setMessage(body.error || 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error while verifying email.');
      });
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        padding: '40px',
        borderRadius: '24px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--card-shadow)',
        border: '1px solid var(--border-color)'
      }}>
        {status === 'verifying' && (
          <>
            <Loader2 className="spinner" size={48} color="#6366f1" style={{ margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ margin: '0 0 10px', fontSize: '24px', fontWeight: 'bold' }}>Verifying Email</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Please wait while we verify your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 10px', fontSize: '24px', fontWeight: 'bold' }}>Verified!</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: '1.6' }}>{message}</p>
            <button 
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Continue to Login
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={56} color="#ef4444" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 10px', fontSize: '24px', fontWeight: 'bold' }}>Verification Failed</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: '1.6' }}>{message}</p>
            <button 
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                padding: '14px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
