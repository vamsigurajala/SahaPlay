import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const Verify = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('Verifying...');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('Invalid verification link.');
      setError(true);
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:3001/api/verify?token=${token}`);
        const data = await response.json();
        
        if (response.ok) {
          setStatus('Email successfully verified! You can now log in.');
          setError(false);
        } else {
          setStatus(data.error || 'Verification failed.');
          setError(true);
        }
      } catch (err) {
        setStatus('Network error during verification.');
        setError(true);
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel animated-fade-in" style={{ padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Email Verification</h1>
        <div style={{ color: error ? 'var(--accent)' : '#4ade80', marginBottom: '20px', fontSize: '18px' }}>
          {status}
        </div>
        {!error && (
          <Link to="/login" className="btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Go to Login
          </Link>
        )}
      </div>
    </div>
  );
};

export default Verify;





