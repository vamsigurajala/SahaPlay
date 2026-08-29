import { useState, useRef, useCallback } from 'react';

export function useScrollToBottom(messagesEndRef) {
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  const isScrollingRef = useRef(false);
  const scrollStopTimeoutRef = useRef(null);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    // Check if user has scrolled up from the extreme bottom by more than 200px
    const isScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 300;

    if (isScrolledUp) {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        setShowScrollArrow(false); // Hide smoothly while user is actively scrolling
      }
      
      if (scrollStopTimeoutRef.current) clearTimeout(scrollStopTimeoutRef.current);
      
      scrollStopTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
        setShowScrollArrow(true); // Pop back up once they stop moving their scroll wheel
      }, 200);
    } else {
      // User is at or near the bottom, completely hide the arrow
      isScrollingRef.current = false;
      setShowScrollArrow(false);
      if (scrollStopTimeoutRef.current) clearTimeout(scrollStopTimeoutRef.current);
    }
  }, []);

  // instant=true skips the smooth-scroll animation — used when the keyboard
  // opening/closing is what's pushing the list, where a visible "message
  // scrolling up" animation reads as an unwanted extra motion on top of the
  // keyboard's own resize; everything should just already be in place the
  // moment the resize finishes, not visibly slide there afterward.
  //
  // block: 'nearest' (not the default 'start'/'end' alignment) matters here:
  // scrollIntoView walks every scrollable ancestor of the target, not just
  // its immediate scroll container, adjusting each one enough to bring the
  // target into view. In a layout with several nested scroll contexts above
  // the chat panel (room chat sits inside a few more of them than the
  // simpler, portaled global chat widget), that could nudge an outer
  // ancestor's scroll position by a stray pixel too — which, since that
  // ancestor also contains normal-flow chrome like the room's own top nav
  // bar, read as that bar visibly shifting every time the composer was
  // focused. 'nearest' only scrolls an ancestor the minimum required (often
  // zero, if the target is already at least partially in view there)
  // instead of aligning it to an edge, which removes the room for that
  // stray movement without changing the intended within-panel scroll.
  const scrollToBottom = useCallback((instant = false) => {
    if (messagesEndRef && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'nearest' });
    }
  }, [messagesEndRef]);

  return {
    showScrollArrow,
    handleScroll,
    scrollToBottom,
    setShowScrollArrow
  };
}
