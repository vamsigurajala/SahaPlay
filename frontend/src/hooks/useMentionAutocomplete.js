import { useState, useCallback, useRef } from 'react';

/**
 * useMentionAutocomplete.js
 *
 * Drives an "@mention" autocomplete dropdown for a single group/room chat
 * composer. Pure text-editing state — it never sends anything, never
 * touches encryption, and has no opinion on WHO can be mentioned (that's
 * the caller's candidate list, passed in only when rendering the dropdown).
 *
 * Usage: call `handleChange(newValue, caretIndex)` from the textarea's
 * onChange (caretIndex = el.selectionStart right after the value updates —
 * React keeps this in sync with the value it just set). Render a dropdown
 * when `isOpen` is true, filtered by `query` against the caller's own
 * roster; call `selectCandidate(username)` when a row is picked to splice
 * "@username " into the text at the right spot and restore focus/caret.
 */
export function useMentionAutocomplete({ value, setValue, textareaRef }) {
  const [query, setQuery] = useState(null); // null = closed; '' or partial text = open
  const triggerIndexRef = useRef(-1); // index of the '@' that opened this session

  const handleChange = useCallback((newValue, caretIndex) => {
    const caret = typeof caretIndex === 'number' ? caretIndex : newValue.length;
    // Scan left from the caret for a '@' that starts the current "word" —
    // bail (close the dropdown) the moment whitespace, a newline, or
    // another '@' is hit first, so "name@example.com" or "a @ b" never
    // opens/reopens it mid-sentence.
    let i = caret - 1;
    while (i >= 0) {
      const ch = newValue[i];
      if (ch === '@') {
        const atLineStart = i === 0 || newValue[i - 1] === '\n';
        const before = atLineStart ? ' ' : newValue[i - 1];
        if (/\s/.test(before)) {
          triggerIndexRef.current = i;
          setQuery(newValue.slice(i + 1, caret));
          return;
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    setQuery(null);
    triggerIndexRef.current = -1;
  }, []);

  const close = useCallback(() => {
    setQuery(null);
    triggerIndexRef.current = -1;
  }, []);

  const selectCandidate = useCallback((username) => {
    const el = textareaRef?.current;
    const start = triggerIndexRef.current;
    if (start < 0) return;
    const caret = el ? el.selectionStart : value.length;
    const before = value.slice(0, start);
    const after = value.slice(caret);
    const next = `${before}@${username} ${after}`;
    setValue(next);
    close();
    requestAnimationFrame(() => {
      if (el) {
        const pos = before.length + username.length + 2; // '@' + name + trailing space
        el.focus();
        try { el.setSelectionRange(pos, pos); } catch { /* not focusable yet — ignore */ }
      }
    });
  }, [value, setValue, textareaRef, close]);

  return {
    mentionQuery: query,
    isMentionOpen: query !== null,
    handleMentionInputChange: handleChange,
    selectMentionCandidate: selectCandidate,
    closeMentionDropdown: close,
  };
}
