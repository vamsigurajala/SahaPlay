import { useState, useRef, useCallback } from 'react';

const MOVE_CANCEL_PX = 5;

/**
 * Single instance shared by an entire message list, mirroring useSwipeToReply
 * — see that file for why this isn't called per-row inside a .map().
 * Any touch movement beyond MOVE_CANCEL_PX both cancels a pending long-press
 * and closes an already-open one (covers "cancel while pressing" and
 * "close popup if a swipe starts on this message" in one path).
 */
export function useLongPress(delay = 500) {
  const [activeId, setActiveId] = useState(null);
  const timerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  const onTouchStart = useCallback((e, id) => {
    const touch = e.touches[0];
    if (!touch) return;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActiveId(id), delay);
  }, [delay]);

  const onTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
    if (deltaX > MOVE_CANCEL_PX || deltaY > MOVE_CANCEL_PX) {
      clearTimeout(timerRef.current);
      setActiveId(null);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    clearTimeout(timerRef.current);
  }, []);

  const close = useCallback(() => setActiveId(null), []);

  const getHandlers = useCallback((id) => ({
    onTouchStart: (e) => onTouchStart(e, id),
    onTouchMove,
    onTouchEnd,
  }), [onTouchStart, onTouchMove, onTouchEnd]);

  return { activeId, close, getHandlers };
}
