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

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesEndRef]);

  return {
    showScrollArrow,
    handleScroll,
    scrollToBottom,
    setShowScrollArrow
  };
}
