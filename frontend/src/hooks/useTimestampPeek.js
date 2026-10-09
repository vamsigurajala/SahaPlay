import { useState, useRef, useCallback } from 'react';

const PEEK_WIDTH = 64;
const H_THRESHOLD = 8;
const CSS_VAR = '--sp-ts-peek-x';
// Toggled on <html> for the DURATION of an active drag only — see
// index.css's matching rule. Read on by plain DOM classList, never React
// state, for the same reason the drag position itself is a CSS variable
// (see below): it has to change in the exact same synchronous tick as the
// transform value, with no React re-render in between.
const DRAGGING_CLASS = 'sp-ts-dragging';

/**
 * Instagram-DM-style "swipe left to peek timestamps": a single shared drag
 * value applied to every message row at once (not per-row, mirroring
 * useLongPress/useSwipeToReply — one instance per message list). Dragging
 * left from a row's empty background shifts the whole thread left, revealing
 * an absolutely-positioned timestamp anchored just past each row's right
 * edge; releasing springs everything back and hides the timestamps again.
 *
 * The live drag value is applied via a CSS custom property written directly
 * to document.documentElement, NOT React state — a plain `transform:
 * translateX(var(--sp-ts-peek-x, 0px))` rule on .msg-row (see index.css)
 * picks it up automatically on every row, with the browser's own style
 * engine doing the work. This used to be React state (setDragX) read by
 * each row's own inline style, which meant every touchmove tick — even
 * rAF-throttled to one commit per frame — still had to re-render every
 * mounted row in the list to apply the new value. That re-render cost (not
 * the throttling, which was already in place) is what read as the drag
 * feeling sluggish on mid/low-end mobile hardware: the browser was doing a
 * full React reconciliation pass across the whole message list, 60 times a
 * second, just to move a translateX value it could have applied natively.
 * Writing the CSS variable directly skips React (and any re-render) for
 * the continuous part of the gesture entirely.
 *
 * Real-device report: releasing the drag didn't spring back at all — the
 * thread stayed shifted left, "stuck" exactly where the finger let go,
 * until the next render happened to touch it. Root cause: .msg-row's
 * spring-back transition used to be toggled via REACT STATE (isPeeking,
 * read by each row's own inline `transition` style) in lockstep with this
 * hook's own direct, synchronous DOM write of the CSS variable back to 0 on
 * release. Those two writes raced: setIsPeeking(false) only takes effect on
 * React's NEXT render, but setCssX(0) lands immediately in the SAME call —
 * so the value snapped to 0 while every row's inline style still said
 * "no transform transition" (the active-drag setting from a moment ago),
 * and by the time React re-rendered with the spring-back transition
 * restored, there was nothing left to animate. Fixed by moving the
 * transition toggle OFF React state entirely and onto the same
 * synchronous-DOM-write channel the drag value itself already uses — see
 * DRAGGING_CLASS above and its matching index.css rule: the class comes
 * off (re-enabling the transition) in the exact same synchronous call that
 * then sets the value back to 0, so the browser always has an active
 * transition to animate that final snap-back through.
 *
 * Deliberately independent of useLongPress's own gesture: that hook already
 * self-cancels its pending timer once movement exceeds its own threshold, so
 * both can listen to the same touch events without coordinating — starting
 * to drag left cancels the long-press automatically.
 */
export function useTimestampPeek() {
  const [isPeeking, setIsPeeking] = useState(false);
  const stateRef = useRef({ startX: 0, startY: 0, active: false, peeking: false });
  const rafRef = useRef(null);
  const pendingXRef = useRef(null);

  const setCssX = useCallback((x) => {
    document.documentElement.style.setProperty(CSS_VAR, `${x}px`);
  }, []);

  const flushPending = useCallback(() => {
    rafRef.current = null;
    if (pendingXRef.current === null) return;
    setCssX(pendingXRef.current);
    pendingXRef.current = null;
  }, [setCssX]);

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
      // Synchronous DOM write, same tick as the first setCssX below — see
      // this hook's own doc comment for why this can't be React state.
      document.documentElement.classList.add(DRAGGING_CLASS);
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
    // Order matters: the transition has to already be re-enabled (class
    // off) BEFORE the value changes back to 0, in the same synchronous
    // call, or the browser has nothing to animate — see this hook's own
    // doc comment for the full race this fixes.
    document.documentElement.classList.remove(DRAGGING_CLASS);
    setCssX(0);
  }, [setCssX]);

  return { isPeeking, onTouchStart, onTouchMove, onTouchEnd, PEEK_WIDTH };
}
