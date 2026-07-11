import { useState, useRef, useCallback } from 'react';

const THRESHOLD = 60;
const MAX_DRAG = 80;
const RESISTANCE = 0.3;
const BOUNCE_MS = 300;

/**
 * Single instance shared by an entire message list (not one-per-row — calling
 * hooks inside a .map() over a dynamic messages array would violate the Rules
 * of Hooks). getHandlers(id, ...) returns per-row touch handlers that close
 * over shared refs/state, so only one message can be mid-gesture at a time.
 */
export function useSwipeToReply() {
  const [activeId, setActiveId] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [isThresholdMet, setIsThresholdMet] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bounceId, setBounceId] = useState(null);
  const bounceTimerRef = useRef(null);
  const stateRef = useRef({ startX: 0, startY: 0, id: null, direction: null, onReply: null, dragging: false, thresholdMet: false });

  const onTouchStart = useCallback((e, id, direction, onReply) => {
    const touch = e.touches[0];
    if (!touch) return;
    stateRef.current = { startX: touch.clientX, startY: touch.clientY, id, direction, onReply, dragging: true, thresholdMet: false };
    setActiveId(id);
    setIsDragging(true);
    setDragX(0);
    setIsThresholdMet(false);
  }, []);

  const onTouchMove = useCallback((e) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - s.startX;
    const deltaY = touch.clientY - s.startY;
    // Let vertical scroll win if the gesture isn't predominantly horizontal.
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (s.direction === 'right' && deltaX < 0) return;
    if (s.direction === 'left' && deltaX > 0) return;

    const absDelta = Math.abs(deltaX);
    const capped = absDelta > THRESHOLD ? THRESHOLD + (absDelta - THRESHOLD) * RESISTANCE : absDelta;
    const cappedCapped = Math.min(capped, MAX_DRAG);
    const sign = s.direction === 'right' ? 1 : -1;
    s.thresholdMet = absDelta >= THRESHOLD;
    setDragX(sign * cappedCapped);
    setIsThresholdMet(s.thresholdMet);
  }, []);

  const onTouchEnd = useCallback(() => {
    const s = stateRef.current;
    if (!s.dragging) return;
    s.dragging = false;
    setIsDragging(false);
    if (s.thresholdMet && s.onReply) {
      s.onReply();
      const doneId = s.id;
      clearTimeout(bounceTimerRef.current);
      setBounceId(doneId);
      bounceTimerRef.current = setTimeout(() => setBounceId(null), BOUNCE_MS);
    }
    setDragX(0);
    setIsThresholdMet(false);
    setActiveId(null);
  }, []);

  const getHandlers = useCallback((id, direction, onReply) => ({
    onTouchStart: (e) => onTouchStart(e, id, direction, onReply),
    onTouchMove,
    onTouchEnd,
  }), [onTouchStart, onTouchMove, onTouchEnd]);

  return { activeId, dragX, isThresholdMet, isDragging, bounceId, getHandlers };
}
