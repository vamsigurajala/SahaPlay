import { useEffect, useRef, useState } from 'react';

/**
 * Like useStableHeight, but measures the actual browser viewport
 * (window.innerHeight) instead of one element, and returns the LARGEST
 * value ever seen for it — synchronously available from the very first
 * render (window.innerHeight is known immediately, no ResizeObserver
 * callback to wait for).
 *
 * This exists because useStableHeight's ResizeObserver-based approach has
 * an inherent lag: the callback only fires AFTER the browser has already
 * laid out and painted the shrunk box, so during a live on-screen-keyboard
 * slide animation (and especially a fast open/close, e.g. a swipe-back
 * gesture that re-triggers focus) there's a real window where the clamped
 * height hasn't caught up yet — which is exactly what read as the chat
 * wallpaper "leaking"/sliding for a moment. Reading window.innerHeight
 * directly and keeping only the max needs no such catch-up: the value used
 * for the very first paint is already correct and never has to change for
 * a keyboard-only resize (the keyboard only ever shrinks the viewport below
 * a size already recorded), which is also why a position:fixed layer sized
 * from this hook can stay 100% inert through the whole keyboard animation
 * instead of reacting to it a frame late.
 *
 * The baseline only resets on a genuine device rotation (orientationchange)
 * — the one case a shrink is real and the old baseline needs forgetting.
 */
export function useStableViewportHeight() {
  const getReading = () => (typeof window === 'undefined' ? 0 :
    Math.max(window.innerHeight || 0, window.visualViewport?.height || 0));

  const [height, setHeight] = useState(getReading);
  const maxRef = useRef(height);

  useEffect(() => {
    const measure = () => {
      const h = getReading();
      if (h > maxRef.current) {
        maxRef.current = h;
        setHeight(h);
      }
    };
    const onOrientationChange = () => {
      maxRef.current = 0;
      // Let the browser finish reflowing the rotated layout before the
      // next measurement re-establishes the baseline for the new orientation.
      setTimeout(measure, 50);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  return height;
}
