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

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    if (!touch) return;
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
    setDragX(Math.max(Math.min(deltaX, 0), -PEEK_WIDTH));
  }, []);

  const onTouchEnd = useCallback(() => {
    const s = stateRef.current;
    s.active = false;
    s.peeking = false;
    setIsPeeking(false);
    setDragX(0);
  }, []);

  return { dragX, isPeeking, onTouchStart, onTouchMove, onTouchEnd, PEEK_WIDTH };
}
