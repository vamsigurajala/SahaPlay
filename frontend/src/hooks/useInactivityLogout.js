import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearUserSession } from '../lib/authUtils.js';

// This is a website (not a native app) that stays logged in via a token in
// localStorage indefinitely, so a device left unattended on someone's
// profile/room is a real exposure. Auto-logout after sustained inactivity.
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const CHECK_INTERVAL_MS = 30 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];

export function useInactivityLogout() {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const markActive = () => { lastActivityRef.current = Date.now(); };
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') markActive(); };
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(() => {
      const token = localStorage.getItem('watch_token');
      const isGuest = localStorage.getItem('watch_is_guest') === 'true';
      if (!token && !isGuest) return; // nothing logged in to protect

      // Watching a movie/show or being in a voice/video call with no mouse
      // or keyboard input for the whole runtime is normal use, not idleness
      // — don't count it against the timeout.
      const mediaPlaying = Array.from(document.querySelectorAll('video, audio'))
        .some(el => !el.paused && !el.ended);
      if (mediaPlaying) { lastActivityRef.current = Date.now(); return; }

      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        clearUserSession();
        toast.error('You were logged out due to inactivity, for your security.');
        navigate('/login', { replace: true });
        lastActivityRef.current = Date.now();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActive));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [navigate]);
}
