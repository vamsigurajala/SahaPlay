import { useEffect, useRef } from 'react';

/**
 * Fires `callback` once the visual viewport's height has finished changing —
 * the reliable way to know "the on-screen keyboard just finished opening or
 * closing" on every platform this app ships on (Chrome, Android's Capacitor
 * WebView, Tauri's WebView2 all implement the VisualViewport API). Chat
 * composers were previously guessing with a fixed setTimeout(..., 300) after
 * a focus event, which could fire before a slower device's keyboard
 * animation had actually finished (or after it, wasting time) — that's what
 * read as "the last message stays hidden behind the keyboard".
 *
 * Debounced (trailing-edge, debounceMs) rather than firing on every raw
 * 'resize' event: a live keyboard slide animation dispatches several of
 * these in quick succession as the height changes progressively, not one
 * clean before/after pair. Calling something like scrollIntoView() on each
 * intermediate tick — while the scroll container's own height is ALSO still
 * changing between calls — computes each scroll against a geometry that's
 * already stale by the next tick, which is what was reading as the chat's
 * last message (and, since it's the same container, the wallpaper under it)
 * visibly jumping/hunting for position, worst on a fast keyboard open/close
 * (a swipe-back gesture while the composer is focused, firing a burst of
 * these events close together). Waiting for the burst to go quiet and
 * firing once afterward means the callback only ever runs against the
 * final, settled geometry.
 *
 * No-op (never fires) on a WebView with no VisualViewport support — callers
 * should keep their existing focus-based fallback for that case, this is an
 * addition, not a replacement of it.
 */
export function useVisualViewportResize(callback, debounceMs = 120) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let timer = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; callbackRef.current?.(); }, debounceMs);
    };
    vv.addEventListener('resize', handler);
    return () => {
      vv.removeEventListener('resize', handler);
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);
}
