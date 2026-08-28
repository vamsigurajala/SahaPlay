import { useEffect, useRef, useState } from 'react';

/**
 * Measures `elementRef`'s own content height and returns the LARGEST value
 * ever observed for it — i.e. the height right before anything (most
 * commonly the on-screen keyboard opening, which shrinks whatever flex
 * region sits above it) started shrinking it. A decorative background layer
 * (a chat wallpaper) can then be given this as an explicit pixel height
 * instead of tracking the element's live, keyboard-shrinking height — which
 * is what was making a background-size:cover image recompute its crop and
 * visibly jump every time the keyboard opened or closed.
 *
 * The baseline only ever resets on a genuine device rotation
 * (orientationchange) — the one case a shrink is real and the old baseline
 * needs to be forgotten rather than clamped against.
 */
export function useStableHeight(elementRef) {
  const [stableHeight, setStableHeight] = useState(0);
  const stableHeightRef = useRef(0);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect?.height;
      if (!h || h <= stableHeightRef.current) return;
      stableHeightRef.current = h;
      setStableHeight(h);
    });
    observer.observe(el);

    const onOrientationChange = () => {
      stableHeightRef.current = 0;
      setStableHeight(0);
    };
    window.addEventListener('orientationchange', onOrientationChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, [elementRef]);

  return stableHeight;
}
