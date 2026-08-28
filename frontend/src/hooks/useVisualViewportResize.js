import { useEffect, useRef } from 'react';

/**
 * Fires `callback` whenever the visual viewport's height actually changes —
 * the reliable way to know "the on-screen keyboard just finished opening or
 * closing" on every platform this app ships on (Chrome, Android's Capacitor
 * WebView, Tauri's WebView2 all implement the VisualViewport API). Chat
 * composers were previously guessing with a fixed setTimeout(..., 300) after
 * a focus event, which could fire before a slower device's keyboard
 * animation had actually finished (or after it, wasting time) — that's what
 * read as "the last message stays hidden behind the keyboard". This fires
 * exactly when the geometry itself changes, regardless of what caused it or
 * how long the animation took.
 *
 * No-op (never fires) on a WebView with no VisualViewport support — callers
 * should keep their existing focus-based fallback for that case, this is an
 * addition, not a replacement of it.
 */
export function useVisualViewportResize(callback) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => callbackRef.current?.();
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);
}
