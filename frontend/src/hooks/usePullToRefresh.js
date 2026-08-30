import { useEffect, useRef, useState } from 'react';
import { isPullToRefreshBlocked } from '../lib/pullToRefreshGate';

// Same drag-down-to-refresh gesture as components/PullToRefresh.jsx, but for
// a component with its OWN internal scroll container (a fixed-viewport
// overlay like GlobalChatWidget's floating chat panel, which never scrolls
// the window/document itself) instead of the page. Renders nothing itself —
// GlobalChatWidget is a single, deeply-nested render tree with no easy spot
// to wrap children in another component (its matching closing tag is
// thousands of lines away), so this just returns refs; the caller renders
// the small indicator markup itself, anywhere convenient, using them.
const PULL_THRESHOLD = 68;
const MAX_PULL = 100;
const MAX_INDICATOR_ROTATE = 200;

// containerRef: ref to the scrollable element to track (its own scrollTop,
//   not window.scrollY).
// disabled: while true, no drag can start — e.g. while an open conversation
//   is showing rather than the conversation list, so scrolling through
//   message history is never misread as pulling to refresh.
// onRefresh: optional async function, called (and awaited) once a completed
//   pull crosses the threshold.
export function usePullToRefresh({ containerRef, disabled, onRefresh }) {
  const dragRef = useRef(null);
  const indicatorRef = useRef(null);
  const iconRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

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
      if (disabled || refreshing || isPullToRefreshBlocked() || e.touches.length !== 1) return;
      if (container.scrollTop > 0) return;
      dragRef.current = { startY: e.touches[0].clientY, active: true };
    };
    const onTouchMove = (e) => {
      const d = dragRef.current;
      if (!d || !d.active) return;
      if (disabled || container.scrollTop > 0) {
        d.active = false;
        setIndicator(0, true);
        return;
      }
      const delta = e.touches[0].clientY - d.startY;
      if (delta <= 0) { setIndicator(0, false); return; }
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
        Promise.resolve().then(() => onRefresh?.())
          .catch(() => {})
          .finally(() => {
            setIndicator(0, true);
            if (iconRef.current) iconRef.current.style.animation = '';
            setRefreshing(false);
          });
      } else {
        setIndicator(0, true);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, disabled, refreshing]);

  return { indicatorRef, iconRef, refreshing };
}
