import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CryptoProvider } from './contexts/CryptoContext';
import Home from './Home';
import Room from './Room';
import Login from './Login';
import Signup from './Signup';
import Verify from './Verify';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import PublicRooms from './PublicRooms';
import Profile from './Profile';
import AppSettings from './AppSettings';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('watch_token');
  const isGuest = localStorage.getItem('watch_is_guest') === 'true';
  return (isAuthenticated || isGuest) ? children : <Navigate to="/login" replace />;
};

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    if (token) {
      fetch('http://127.0.0.1:3001/api/settings', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (!data.error && data.language) i18n.changeLanguage(data.language);
        }).catch(()=>{});
    }
  }, [i18n]);

  // Hardcoded Client ID for demonstration - user will need to replace this in production
  const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';

  return (
    <CryptoProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/public" element={<ProtectedRoute><PublicRooms /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/app-settings" element={<ProtectedRoute><AppSettings /></ProtectedRoute>} />
            <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
          </Routes>
        </Router>
      </GoogleOAuthProvider>
    </CryptoProvider>
  );
}

export default App;
