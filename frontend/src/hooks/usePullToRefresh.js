import { useCallback, useEffect, useRef, useState } from 'react';
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
// Keeps the spinner visible for at least this long once triggered, even if
// onRefresh resolves near-instantly — otherwise a fast refetch reads as "the
// icon just came down and popped back up", not "it refreshed".
const MIN_VISIBLE_MS = 500;

// disabled: while true, no drag can start — e.g. while an open conversation
//   is showing rather than the conversation list, so scrolling through
//   message history is never misread as pulling to refresh.
// onRefresh: optional async function, called (and awaited) once a completed
//   pull crosses the threshold.
//
// Returns { containerRef, indicatorRef, iconRef, refreshing }. containerRef
// is a CALLBACK ref — pass it as the scrollable element's own `ref` prop.
// A plain useRef object here would silently never attach any listeners: the
// widget conditionally renders `null` while closed (see its own `if
// (!isOpen) return null`), so the very first time this hook's effect ran,
// the ref's `.current` was still null; since neither `disabled` nor
// `refreshing` necessarily changes value once the panel actually opens and
// the DOM node appears, the effect would never re-run to pick it up. A
// callback ref fires exactly when the node mounts, regardless of any of
// that, so it can't go stale the same way.
export function usePullToRefresh({ disabled, onRefresh }) {
  const dragRef = useRef(null);
  const indicatorRef = useRef(null);
  const iconRef = useRef(null);
  const [container, setContainer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useCallback((node) => { setContainer(node); }, []);

  useEffect(() => {
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
      // Clamp rather than hard-resetting to 0 on any single backward sample
      // — a real drag isn't perfectly monotonic (small hand tremor/mouse
      // jitter), and snapping the indicator fully shut on every tiny
      // upward blip read as it "coming and going" instead of following the
      // finger smoothly.
      const delta = Math.max(0, e.touches[0].clientY - d.startY);
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
        if (onRefresh) {
          const startedAt = Date.now();
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
          // No scoped refresh wired up — same as every other pull-to-refresh
          // surface in this app, a completed pull just reloads the whole app.
          setTimeout(() => window.location.reload(), 320);
        }
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
  }, [container, disabled, refreshing]);

  return { containerRef, indicatorRef, iconRef, refreshing };
}
