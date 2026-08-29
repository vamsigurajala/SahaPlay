import { useEffect, useState } from 'react';

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
 *
 * The baseline itself lives at module scope, not in a per-instance ref: a
 * page like Room.jsx that hosts this (via RoomChatPanel/GlobalChatWidget)
 * can fully unmount and remount — e.g. navigating out to view a profile and
 * swiping back — and a fresh component instance means a fresh ref with no
 * memory of the largest height already established. If that remount lands
 * while the on-screen keyboard happens to still be mid-close (a live
 * possibility right after a swipe-back), window.innerHeight at that exact
 * instant can read the smaller, keyboard-open value, which a fresh ref
 * would then wrongly adopt as its new ceiling — sizing the wallpaper
 * backdrop short and exposing a plain colored gap where the keyboard used
 * to be (white in light mode, off-black in dark) until some later resize
 * event happens to correct it, if one even fires. A module-level baseline
 * survives the remount entirely, so the very first render of the new
 * instance already has the correct, previously-established ceiling.
 */
let sharedMaxViewportHeight = 0;

export function useStableViewportHeight() {
  const getReading = () => (typeof window === 'undefined' ? 0 :
    Math.max(window.innerHeight || 0, window.visualViewport?.height || 0));

  // Reading (never writing) sharedMaxViewportHeight here is fine during
  // render — the lazy useState initializer only runs once, on mount, and
  // the actual reassignment of the module-level baseline happens
  // exclusively inside the effect below, never here.
  const [height, setHeight] = useState(() => Math.max(sharedMaxViewportHeight, getReading()));

  useEffect(() => {
    // This instance's own initial reading may be larger than what the
    // module baseline already knew about — fold it in before listening for
    // further changes.
    if (height > sharedMaxViewportHeight) sharedMaxViewportHeight = height;
    const measure = () => {
      const h = getReading();
      if (h > sharedMaxViewportHeight) {
        sharedMaxViewportHeight = h;
        setHeight(h);
      }
    };
    const onOrientationChange = () => {
      sharedMaxViewportHeight = 0;
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
