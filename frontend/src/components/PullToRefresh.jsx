import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Drag-down-anywhere-to-refresh, WhatsApp/Twitter-style — a thin gesture
// layer, not a scroll container of its own. It watches the real window
// scroll position (this only applies to pages that scroll the window/
// document itself — landing-style pages like Home/PublicRooms/PinnedRooms,
// not a fixed-viewport app shell like the Room/chat page, which manages its
// own internal scrollable panels and already has several careful,
// purpose-built touch gestures of its own; wiring this same window-scroll
// check in there would misfire constantly since window.scrollY is always 0
// on a page that never scrolls the window at all). Listeners are passive
// and never call preventDefault, so normal scrolling anywhere on the page
// is completely unaffected — this only ever shows an indicator and acts
// once the user is already at the very top and pulls further down.
const PULL_THRESHOLD = 68;
const MAX_PULL = 100;
const MAX_INDICATOR_ROTATE = 200;

export default function PullToRefresh({ children }) {
  const dragRef = useRef(null); // { startY, active }
  const indicatorRef = useRef(null);
  const iconRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');

  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const setIndicator = (pull, animateBack) => {
      const el = indicatorRef.current;
      if (!el) return;
      el.style.transition = animateBack ? 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease' : 'none';
      el.style.transform = `translate(-50%, ${Math.max(-44, pull - 44)}px)`;
      el.style.opacity = pull > 4 ? '1' : '0';
      if (iconRef.current) {
        iconRef.current.style.transform = `rotate(${Math.min(pull / PULL_THRESHOLD, 1) * MAX_INDICATOR_ROTATE}deg)`;
      }
    };

    const onTouchStart = (e) => {
      if (refreshing || e.touches.length !== 1) return;
      // Only ever starts tracking a pull when the window is already fully
      // scrolled to the top — a downward drag anywhere else is just a
      // normal scroll, left completely alone.
      if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) return;
      dragRef.current = { startY: e.touches[0].clientY, active: true };
    };
    const onTouchMove = (e) => {
      const d = dragRef.current;
      if (!d || !d.active) return;
      if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) {
        d.active = false;
        setIndicator(0, true);
        return;
      }
      const delta = e.touches[0].clientY - d.startY;
      if (delta <= 0) { setIndicator(0, false); return; }
      // Rubber-band resistance past the trigger point, matching the
      // swipe-down-to-dismiss feel already used elsewhere in this app
      // (CameraCapture.jsx).
      const pulled = delta < PULL_THRESHOLD ? delta : PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.35;
      d.lastPull = Math.min(pulled, MAX_PULL);
      setIndicator(d.lastPull, false);
    };
    const onTouchEnd = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.active) return;
      if ((d.lastPull || 0) >= PULL_THRESHOLD) {
        setRefreshing(true);
        setIndicator(PULL_THRESHOLD, true);
        if (iconRef.current) iconRef.current.style.animation = 'ptr-spin 0.7s linear infinite';
        // A real full reload — every page this wraps re-fetches its own
        // data on load already, so this is the simplest way to guarantee
        // "refresh the page" actually means everything on it, not just
        // whichever bit of state a more surgical refetch would remember to
        // cover.
        setTimeout(() => window.location.reload(), 320);
      } else {
        setIndicator(0, true);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing]);

  return (
    <>
      <div
        ref={indicatorRef}
        style={{
          position: 'fixed', top: 'calc(10px + var(--sp-status-bar-inset, 0px) + env(safe-area-inset-top))',
          left: '50%', transform: 'translate(-50%, -44px)', opacity: 0,
          width: 38, height: 38, borderRadius: '50%',
          background: isLight ? '#ffffff' : '#1c1c1e',
          boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.18)' : '0 4px 16px rgba(0,0,0,0.5)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998, pointerEvents: 'none',
        }}
      >
        <span ref={iconRef} style={{ display: 'flex', transformOrigin: 'center' }}>
          <RefreshCw size={17} color="var(--brand-1)" />
        </span>
      </div>
      {children}
      <style>{`@keyframes ptr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
