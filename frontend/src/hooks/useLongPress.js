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
  // Row element the press started on, captured at touchstart — a menu that
  // opens off this long-press (e.g. GlobalChatWidget's chat-list row menu)
  // needs this to decide whether it fits below or must flip upward, the same
  // way a plain click already measures its own trigger element. Safe to read
  // any time after activeId fires: moving the finger before then cancels the
  // press entirely (see onTouchMove below), so if the press fires at all,
  // this element hasn't scrolled out from under the finger since.
  const elRef = useRef(null);

  const onTouchStart = useCallback((e, id) => {
    const touch = e.touches[0];
    if (!touch) return;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    elRef.current = e.currentTarget;
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

  const getTriggerRect = useCallback(() => elRef.current?.getBoundingClientRect() ?? null, []);

  return { activeId, close, getHandlers, getTriggerRect };
}
