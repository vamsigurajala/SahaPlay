import React, { useState, useEffect } from 'react';
import { Monitor, Loader2, CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';

const TvPairing = () => {
  const [pairingCode, setPairingCode] = useState(null);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Silently create a guest session if the TV isn't logged in
    // This allows it to bypass ProtectedRoute and join rooms instantly
    if (!localStorage.getItem('watch_token')) {
      const guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('watch_token', 'tv_guest_token'); 
      localStorage.setItem('watch_is_guest', 'true');
      localStorage.setItem('watch_guest_id', guestId);
      localStorage.setItem('watch_username', 'Smart TV');
    }

    const socketHost = window.location.hostname;
    const socketUrl = `http://${socketHost}:3001`;
    const sock = io(socketUrl, { transports: ['websocket'] });

    sock.on('connect', () => {
      sock.emit('request_tv_code', { username: localStorage.getItem('watch_username') || 'Smart TV' });
    });

    sock.on('tv_code_generated', ({ code }) => {
      setPairingCode(code);
    });

    sock.on('tv_linked', ({ roomId, guestToken, guestUsername }) => {
      setPaired(true);
      // Store the REAL signed JWT so the Room page can authenticate API calls
      if (guestToken) {
        localStorage.setItem('watch_token', guestToken);
        localStorage.setItem('watch_username', guestUsername || 'smart_tv');
      }
      localStorage.setItem('watch_is_guest', 'true');
      setTimeout(() => {
        // Redirect to the room with mode=tv to auto-fullscreen
        window.location.href = `/room/${roomId}?mode=tv`;
      }, 1500);
    });

    sock.on('disconnect', () => {
      setError('Disconnected from server. Retrying...');
    });

    return () => sock.disconnect();
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh', 
      background: '#0f172a', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'fixed', top: 0, left: 0, zIndex: 99999
    }}>
      <div style={{
        background: '#1e293b', padding: '50px 70px', borderRadius: '32px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.05)', maxWidth: '600px', width: '90%'
      }}>
        {paired ? (
          <>
            <CheckCircle size={72} color="#10b981" style={{ margin: '0 auto 24px' }} />
            <h1 style={{ fontSize: '36px', margin: '0 0 16px', color: '#10b981', fontWeight: 800 }}>Connected!</h1>
            <p style={{ fontSize: '20px', color: '#94a3b8', margin: 0 }}>Joining the room...</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '40px' }}>
              <Monitor size={56} color="#6366f1" />
              <h1 style={{ fontSize: '42px', margin: 0, fontWeight: 900, color: '#f8fafc' }}>Cast to TV</h1>
            </div>
            
            <p style={{ fontSize: '22px', color: '#94a3b8', margin: '0 0 40px 0', lineHeight: 1.6 }}>
              A code will appear below.<br/>
              Enter it in the <strong style={{ color: '#fff', borderBottom: '2px solid #6366f1' }}>Cast to TV</strong> dialog
              <br/>on your computer.
            </p>
            
            <div style={{
              background: '#0b0f19', padding: '24px 40px', borderRadius: '20px',
              fontSize: '64px', fontWeight: '900', letterSpacing: '12px',
              color: '#818cf8', border: '2px dashed rgba(99, 102, 241, 0.4)',
              minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)'
            }}>
              {pairingCode || <Loader2 size={48} color="#6366f1" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
            </div>

            {error && (
              <p style={{ color: '#ef4444', marginTop: '24px', fontSize: '16px', fontWeight: 500 }}>{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TvPairing;
