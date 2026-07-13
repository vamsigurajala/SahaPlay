import { useEffect, useRef } from 'react';

/**
 * Makes the mobile swipe-back / hardware-back gesture close an in-app
 * overlay (modal, chat view, etc.) instead of navigating the browser away
 * from the page. Works by pushing one history entry per open "level" and
 * popping one level at a time as the user swipes back.
 *
 * Several components using this hook can be open at once and nested
 * (e.g. a lock-screen opened on top of an already-open chat widget), so
 * all instances share a single global stack + a single 'popstate'
 * listener. A swipe always resolves the most-recently-opened level,
 * regardless of which component instance pushed it.
 *
 * @param {number} level - current UI depth. 0 means fully closed/resting.
 *   Pass a higher number for nested views (e.g. 1 = panel open, 2 = a
 *   sub-view inside the panel is open).
 * @param {(newLevel:number)=>void} onPop - called with the new (lower)
 *   level when the user swipes/back-navigates; the caller should update
 *   its own state to match (e.g. close the modal, or go back one view).
 * @returns {{ skipNextClose: () => void }} call skipNextClose()
 *   synchronously right before closing AND navigating to a different route
 *   in the same click handler (e.g. a mobile-menu link). Without it, this
 *   hook's own history.go() cleanup races with the router's pushState and
 *   can undo the navigation. The pushed entry is left inert in the shared
 *   history stack instead of being consumed — harmless, just costs one
 *   extra no-op swipe if the user ever backs all the way through it.
 */
const sharedStack = [];
let suppressCount = 0;
let listenerAttached = false;

function ensureListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener('popstate', () => {
    if (suppressCount > 0) {
      suppressCount -= 1;
      return;
    }
    const entry = sharedStack.pop();
    if (entry) entry.onPop();
  });
}

export function useBackIntercept(level, onPop) {
  const currentLevelRef = useRef(0);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;
  const skipConsumeRef = useRef(false);

  useEffect(() => {
    ensureListener();
  }, []);

  useEffect(() => {
    if (level > currentLevelRef.current) {
      for (let i = currentLevelRef.current; i < level; i++) {
        const depthAtPush = i + 1;
        window.history.pushState({ __backLevel: depthAtPush }, '');
        sharedStack.push({
          onPop: () => {
            currentLevelRef.current = depthAtPush - 1;
            onPopRef.current(currentLevelRef.current);
          }
        });
      }
      currentLevelRef.current = level;
    } else if (level < currentLevelRef.current) {
      const diff = currentLevelRef.current - level;
      if (skipConsumeRef.current) {
        // A real route navigation is happening in this same tick — leave
        // the pushed entries in place (both in the browser's real history
        // and in sharedStack) rather than calling history.go(), which
        // would race the router's own pushState and undo the navigation.
        skipConsumeRef.current = false;
        currentLevelRef.current = level;
      } else {
        // Closed via an in-app control (X button, back arrow) rather than a
        // swipe/back gesture — consume the now-unused history entries so a
        // future swipe doesn't land on a stale level.
        for (let i = 0; i < diff; i++) sharedStack.pop();
        currentLevelRef.current = level;
        suppressCount += 1; // history.go coalesces into a single popstate
        window.history.go(-diff);
      }
    }
  }, [level]);

  useEffect(() => () => {
    const diff = currentLevelRef.current;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) sharedStack.pop();
      currentLevelRef.current = 0;
      suppressCount += 1;
      window.history.go(-diff);
    }
  }, []);

  return { skipNextClose: () => { skipConsumeRef.current = true; } };
}
