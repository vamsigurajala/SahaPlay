import { useState, useRef, useCallback } from 'react';

const PEEK_WIDTH = 64;
const H_THRESHOLD = 8;

/**
 * Instagram-DM-style "swipe left to peek timestamps": a single shared drag
 * value applied to every message row at once (not per-row, mirroring
 * useLongPress/useSwipeToReply — one instance per message list). Dragging
 * left from a row's empty background shifts the whole thread left, revealing
 * an absolutely-positioned timestamp anchored just past each row's right
 * edge; releasing springs everything back and hides the timestamps again.
 *
 * Deliberately independent of useLongPress's own gesture: that hook already
 * self-cancels its pending timer once movement exceeds its own threshold, so
 * both can listen to the same touch events without coordinating — starting
 * to drag left cancels the long-press automatically.
 */
export function useTimestampPeek() {
  const [dragX, setDragX] = useState(0);
  const [isPeeking, setIsPeeking] = useState(false);
  const stateRef = useRef({ startX: 0, startY: 0, active: false, peeking: false });
  // dragX is applied to EVERY row's transform at once (see this hook's own
  // top comment) — same reasoning as useSwipeToReply's identical rAF
  // throttle: committing on every raw touchmove tick forced the whole message
  // list to re-render that often, which is what read as this drag feeling
  // slow. Coalescing to one commit per animation frame is visually the same
  // (the browser only paints once per frame regardless) but caps the
  // re-render rate to the frame budget instead of the raw touch-event rate.
  const rafRef = useRef(null);
  const pendingXRef = useRef(null);

  const flushPending = useCallback(() => {
    rafRef.current = null;
    if (pendingXRef.current === null) return;
    setDragX(pendingXRef.current);
    pendingXRef.current = null;
  }, []);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    if (!touch) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingXRef.current = null;
    stateRef.current = { startX: touch.clientX, startY: touch.clientY, active: true, peeking: false };
  }, []);

  const onTouchMove = useCallback((e) => {
    const s = stateRef.current;
    if (!s.active) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - s.startX;
    const deltaY = touch.clientY - s.startY;
    if (!s.peeking) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) return; // vertical scroll wins
      if (deltaX > -H_THRESHOLD) return; // only leftward drags start a peek
      s.peeking = true;
      setIsPeeking(true);
    }
    pendingXRef.current = Math.max(Math.min(deltaX, 0), -PEEK_WIDTH);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(flushPending);
  }, [flushPending]);

  const onTouchEnd = useCallback(() => {
    const s = stateRef.current;
    s.active = false;
    s.peeking = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingXRef.current = null;
    setIsPeeking(false);
    setDragX(0);
  }, []);

  return { dragX, isPeeking, onTouchStart, onTouchMove, onTouchEnd, PEEK_WIDTH };
}
