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
  // dragX/isThresholdMet are shared state read by every row's inline style
  // (translateX, the reply-icon's opacity/scale) — this whole message list
  // sits inside one big component, so committing a fresh value on every raw
  // touchmove tick (which can fire well over 60 times/sec on a fast drag)
  // was forcing a full re-render of that entire component that often, not
  // just of the one row actually moving. rAF-throttling coalesces a burst of
  // ticks between two frames into a single commit — visually indistinguishable
  // from updating on every tick (the browser only ever paints once per frame
  // anyway) but caps the re-render rate at the browser's own frame budget
  // instead of the raw touch-event rate, which is what read as sluggish.
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  const flushPending = useCallback(() => {
    rafRef.current = null;
    if (!pendingRef.current) return;
    const { x, thresholdMet } = pendingRef.current;
    pendingRef.current = null;
    setDragX(x);
    setIsThresholdMet(thresholdMet);
  }, []);

  const onTouchStart = useCallback((e, id, direction, onReply) => {
    const touch = e.touches[0];
    if (!touch) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingRef.current = null;
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
    pendingRef.current = { x: sign * cappedCapped, thresholdMet: s.thresholdMet };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(flushPending);
  }, [flushPending]);

  const onTouchEnd = useCallback(() => {
    const s = stateRef.current;
    if (!s.dragging) return;
    s.dragging = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingRef.current = null;
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
