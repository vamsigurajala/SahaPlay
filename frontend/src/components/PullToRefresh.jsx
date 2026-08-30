import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { isPullToRefreshBlocked } from '../lib/pullToRefreshGate';

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
//
// isPullToRefreshBlocked() additionally bails a drag out when a full-screen
// overlay (GlobalChatWidget's floating chat, opened on top of this same
// page without unmounting it) is currently open — see pullToRefreshGate.js
// for why that's necessary.
const PULL_THRESHOLD = 68;
const MAX_PULL = 100;
const MAX_INDICATOR_ROTATE = 200;
// Keeps the spinner visible for at least this long once triggered, even if
// onRefresh (or the reload itself) resolves near-instantly — otherwise a
// fast refresh reads as "the icon just came down and popped back up", not
// "it refreshed".
const MIN_VISIBLE_MS = 500;

// onRefresh: optional async function. When given, a completed pull calls
// this and waits for it instead of reloading the whole app — "refresh"
// should mean "reload this page's own data", not "restart everything".
// Falls back to a full window.location.reload() only when the page hasn't
// wired up anything more targeted.
export default function PullToRefresh({ children, onRefresh }) {
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
      if (isPullToRefreshBlocked()) return;
      dragRef.current = { startY: e.touches[0].clientY, active: true };
    };
    const onTouchMove = (e) => {
      const d = dragRef.current;
      if (!d || !d.active) return;
      if ((window.scrollY || document.documentElement.scrollTop || 0) > 0 || isPullToRefreshBlocked()) {
        d.active = false;
        setIndicator(0, true);
        return;
      }
      const delta = e.touches[0].clientY - d.startY;
      // Clamp rather than hard-resetting to 0 on any single backward sample
      // — a real drag isn't perfectly monotonic (small hand tremor/mouse
      // jitter), and snapping the indicator fully shut on every tiny
      // upward blip read as it "coming and going" instead of following the
      // finger smoothly.
      const clampedDelta = Math.max(0, delta);
      const pulled = clampedDelta < PULL_THRESHOLD ? clampedDelta : PULL_THRESHOLD + (clampedDelta - PULL_THRESHOLD) * 0.35;
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
        const startedAt = Date.now();
        if (onRefresh) {
          // Reload just this page's own data and stop — the whole point of
          // wiring a real onRefresh in is to avoid a full app reload.
          Promise.resolve().then(() => onRefresh())
            .catch(() => {})
            .finally(() => {
              const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
              setTimeout(() => {
                setIndicator(0, true);
                if (iconRef.current) iconRef.current.style.animation = '';
                setRefreshing(false);
              }, wait);
            });
        } else {
          setTimeout(() => window.location.reload(), 320);
        }
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
  }, [refreshing, onRefresh]);

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
