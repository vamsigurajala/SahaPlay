import { useEffect, useRef } from 'react';

/**
 * Grows a <textarea> to fit its content (up to maxHeight, then scrolls),
 * and shrinks it back down when the value is cleared/edited externally.
 *
 * Default maxHeight caps growth at ~2 lines (measured against this app's
 * actual composer padding/line-height/border-box, not a round guess) rather
 * than the previous 120px (~5-6 lines) — growing across that many lines
 * read as the box "just kept increasing" rather than a small, expected
 * bump, even though it was always capped and scrollable past that point.
 *

 * Deferred to a rAF (and cancels any pending one from the previous
 * keystroke) rather than measuring synchronously inside the effect: reading
 * `scrollHeight` right after writing `height:'auto'` forces the browser to
 * run a real layout pass there and then, on the same tick as the keystroke
 * that triggered it. In a chat with a lot of message history sitting in the
 * same document, that's not a cheap, textarea-scoped computation — it's a
 * synchronous reflow of everything layout-dependent on the page, right in
 * the middle of handling input. Typed fast (or holding backspace), each
 * keystroke was queuing another one of these before the last one's work had
 * even finished, which is what read as "typing/clearing feels slow". Moving
 * the measurement to a rAF lets the keystroke's own render commit and paint
 * first, and coalesces a fast burst of keystrokes into a single layout pass
 * instead of one per character.
 */
export function useAutoResizeTextarea(ref, value, maxHeight = 68) {
  const rafRef = useRef(null);
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ref, value, maxHeight]);
}
