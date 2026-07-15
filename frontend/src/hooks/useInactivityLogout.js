import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearUserSession } from '../lib/authUtils.js';

// Auto-logout after sustained inactivity to protect unattended accounts/devices.
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const CHECK_INTERVAL_MS = 10 * 1000; // Check every 10 seconds
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];

export function useInactivityLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      // Throttle localStorage writes to prevent performance overhead
      if (now - lastWrite > 2000) {
        localStorage.setItem('watch_last_activity', String(now));
        lastWrite = now;
      }
    };

    // Ensure we have an initial timestamp
    if (!localStorage.getItem('watch_last_activity')) {
      localStorage.setItem('watch_last_activity', String(Date.now()));
    }

    const checkInactivity = () => {
      const token = localStorage.getItem('watch_token');
      const isGuest = localStorage.getItem('watch_is_guest') === 'true';
      if (!token && !isGuest) return; // Nothing logged in to protect

      // Don't log out if media (movie/audio) is currently playing
      const mediaPlaying = Array.from(document.querySelectorAll('video, audio'))
        .some(el => !el.paused && !el.ended);
      if (mediaPlaying) {
        localStorage.setItem('watch_last_activity', String(Date.now()));
        return;
      }

      const lastActivityStr = localStorage.getItem('watch_last_activity');
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();

      if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        clearUserSession();
        toast.error('You were logged out due to inactivity, for your security.');
        navigate('/login', { replace: true });
        localStorage.setItem('watch_last_activity', String(Date.now()));
      }
    };

    // Run check immediately on mount
    checkInactivity();

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActive));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [navigate]);
}
