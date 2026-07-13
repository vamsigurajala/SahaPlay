import { useEffect } from 'react';

/**
 * Grows a <textarea> to fit its content (up to maxHeight, then scrolls),
 * and shrinks it back down when the value is cleared/edited externally.
 */
export function useAutoResizeTextarea(ref, value, maxHeight = 120) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [ref, value, maxHeight]);
}
