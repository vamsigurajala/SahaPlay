import { useEffect, useState } from 'react';

/**
 * Returns a CSS-pixel height guaranteed to be at least as tall as the
 * viewport can ever be in the current orientation — for sizing a
 * position:absolute background layer (a chat wallpaper) that must never
 * need to resize, and therefore never need to repaint, as the on-screen
 * keyboard opens/closes, switches between its plain-text and emoji
 * sub-panels (a taller keyboard than the text one), or the browser's own
 * chrome (URL bar) shows/hides.
 *
 * Previous approach (kept here in spirit, not code, as the reason this
 * looks the way it does): track the largest window.innerHeight/
 * visualViewport.height ever observed via resize listeners, ratcheting
 * up-only. That's vulnerable to a bad reading landing mid-transition — a
 * resize event fires while the on-screen keyboard is switching to its
 * emoji panel, a WebView reports a momentarily-too-large value there, and
 * the ratchet adopts it permanently (it only ever grows), oversizing this
 * layer relative to what's actually visible with no way to self-correct
 * afterward. On a chat panel that also shares the screen with a video/game
 * player (its own fixed-height area competing for the same space), that
 * mismatch is exactly what read as the header disappearing and the
 * composer jumping — confirmed still happening after two narrower fixes
 * at the sizing logic, which is what motivated ditching resize-driven
 * measurement entirely rather than trying to patch the ratchet further.
 *
 * window.screen.height sidesteps the whole class of bug: it's the
 * PHYSICAL screen's extent in CSS pixels for the CURRENT orientation
 * (mobile browsers/WebViews swap screen.width/height on rotation, so this
 * is already orientation-aware with no separate portrait/landscape
 * branching needed). Browser chrome and the keyboard only ever carve INTO
 * that space, never exceed it, so it's always a safe, correct ceiling —
 * nothing to get wrong, and nothing that ever needs to change except on an
 * actual rotation.
 */
export function useStableViewportHeight() {
  const getReading = () => {
    if (typeof window === 'undefined') return 0;
    return window.screen?.height || window.innerHeight || 0;
  };

  const [height, setHeight] = useState(getReading);

  useEffect(() => {
    const onOrientationChange = () => {
      // Some devices still report the pre-rotation screen.height for a
      // moment right when this event fires — a short delay lets it settle
      // before reading the new value.
      setTimeout(() => setHeight(getReading()), 50);
    };
    window.addEventListener('orientationchange', onOrientationChange);
    window.screen?.orientation?.addEventListener?.('change', onOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', onOrientationChange);
      window.screen?.orientation?.removeEventListener?.('change', onOrientationChange);
    };
  }, []);

  return height;
}
