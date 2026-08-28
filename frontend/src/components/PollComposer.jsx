import React, { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, GripVertical, X, Send } from 'lucide-react';

const QUESTION_LIMIT = 255;
const OPTION_LIMIT = 100;
const MAX_OPTIONS = 12;
const MIN_OPTIONS = 2;

let nextOptionId = 0;
const makeOption = (value = '') => ({ id: nextOptionId++, value });

// Full-screen "Create poll" composer — paperclip menu's Poll option opens
// this instead of the file picker. onSend receives a plain
// { question, options, allowMultiple } object; the caller is responsible
// for encrypting it exactly like normal message text (see
// GlobalChatWidget.jsx/RoomChatPanel.jsx's own send functions) and marking
// the message isPoll:true — this component has no idea messages are
// encrypted at all, matching how CameraCapture.jsx hands back a plain File
// and lets the caller do the actual sending.
//
// initialPoll (optional): { question, options, allowMultiple } to prefill —
// used when reopening this to edit an existing poll message (the caller
// still decides create-vs-edit; onSend's shape is identical either way).
export default function PollComposer({ onSend, onClose, isLight, initialPoll, title }) {
  const [question, setQuestion] = useState(initialPoll?.question || '');
  const [options, setOptions] = useState(() =>
    (initialPoll?.options && initialPoll.options.length)
      ? initialPoll.options.map(v => makeOption(v))
      : [makeOption(), makeOption()]
  );
  const [allowMultiple, setAllowMultiple] = useState(!!initialPoll?.allowMultiple);
  const optionRefs = useRef({});

  // Smooth drag-to-reorder: pointer-events based (not HTML5 drag/drop, which
  // has no real touch support) — same approach CameraCapture.jsx's color
  // slider already uses. Two things make this feel smooth instead of the
  // instant re-layout jump a naive swap gives:
  //  1. Rows are keyed by a stable id (not array index), so reordering moves
  //     real DOM nodes around instead of React re-rendering each index's
  //     content in place.
  //  2. FLIP: whenever the order changes, every row except the one actively
  //     being dragged is snapped back to its last pixel position via
  //     transform, then transitioned to its new (0) position — a real slide,
  //     not a snap. The dragged row itself is written directly to the DOM via
  //     ref on every pointer move (no React re-render per pixel), so it
  //     tracks the pointer with zero lag; only crossing a neighbor's midpoint
  //     triggers an actual state reorder.
  const rowRefs = useRef({});
  const lastTopRef = useRef({});
  const dragIdRef = useRef(null);
  const dragStartPointerYRef = useRef(0);
  const dragStartTopRef = useRef(0);
  const [dragId, setDragId] = useState(null);

  useLayoutEffect(() => {
    options.forEach(opt => {
      const el = rowRefs.current[opt.id];
      if (!el) return;
      const newTop = el.offsetTop;
      const prevTop = lastTopRef.current[opt.id];
      if (prevTop != null && prevTop !== newTop && opt.id !== dragIdRef.current) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${prevTop - newTop}px)`;
        void el.offsetHeight; // force a reflow so the transition below animates from this position
        el.style.transition = 'transform 180ms cubic-bezier(0.22,0.9,0.3,1)';
        el.style.transform = '';
      }
      lastTopRef.current[opt.id] = newTop;
    });
  }, [options]);

  const updateOption = (id, value) => {
    setOptions(prev => {
      const next = prev.map(o => (o.id === id ? { ...o, value: value.slice(0, OPTION_LIMIT) } : o));
      const idx = next.findIndex(o => o.id === id);
      // Typing into the last (currently empty→non-empty) box grows the
      // list — mirrors WhatsApp's own "type in the last row to add
      // another" behavior instead of a separate persistent "+ Add" button
      // the user has to keep re-tapping.
      if (idx === next.length - 1 && next[idx].value.trim() && next.length < MAX_OPTIONS) {
        next.push(makeOption());
      }
      return next;
    });
  };

  const removeOption = (id) => {
    setOptions(prev => (prev.length <= MIN_OPTIONS ? prev : prev.filter(o => o.id !== id)));
  };

  const onHandlePointerDown = (id, e) => {
    e.preventDefault();
    const el = rowRefs.current[id];
    if (!el) return;
    dragIdRef.current = id;
    dragStartPointerYRef.current = e.clientY;
    dragStartTopRef.current = el.offsetTop;
    setDragId(id);
    el.style.transition = 'none';
    el.style.zIndex = 5;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onHandlePointerMove = (e) => {
    const id = dragIdRef.current;
    if (id == null) return;
    const el = rowRefs.current[id];
    if (!el) return;

    // Position the dragged row at (its current natural slot) + (however much
    // the pointer has moved since drag start, minus however much the row's
    // own natural slot has already shifted from prior reorders) — keeps it
    // glued to the pointer continuously even as the underlying array (and
    // therefore the row's own rest position) changes mid-drag.
    const naturalTop = el.offsetTop;
    const netDelta = (e.clientY - dragStartPointerYRef.current) - (naturalTop - dragStartTopRef.current);
    el.style.transform = `translateY(${netDelta}px)`;

    // Crossing detection uses each row's plain layout position (offsetTop),
    // NOT getBoundingClientRect — a neighbor mid-FLIP-animation has a live
    // rect that's still moving toward its rest position, and comparing
    // against that moving target is exactly what made this feel glitchy
    // (the swap trigger point itself was jittering frame to frame). offsetTop
    // is the row's stable rest position regardless of any in-flight
    // transition, so the crossing point stays fixed.
    const draggedMid = naturalTop + netDelta + el.offsetHeight / 2;
    setOptions(prev => {
      const idx = prev.findIndex(o => o.id === id);
      if (idx === -1) return prev;
      for (let i = 0; i < prev.length; i++) {
        if (i === idx) continue;
        const otherEl = rowRefs.current[prev[i].id];
        if (!otherEl) continue;
        const mid = otherEl.offsetTop + otherEl.offsetHeight / 2;
        const crossing = i < idx ? draggedMid < mid : draggedMid > mid;
        if (crossing) {
          const next = [...prev];
          const [moved] = next.splice(idx, 1);
          next.splice(i, 0, moved);
          return next;
        }
      }
      return prev;
    });
  };

  const endDrag = () => {
    const id = dragIdRef.current;
    if (id != null) {
      const el = rowRefs.current[id];
      if (el) {
        el.style.transition = 'transform 180ms cubic-bezier(0.22,0.9,0.3,1)';
        el.style.transform = '';
        el.style.zIndex = '';
      }
    }
    dragIdRef.current = null;
    setDragId(null);
  };

  // Safety net: if the handle never receives its own pointerup/pointercancel
  // (pointer capture can be dropped by the browser without firing either —
  // e.g. certain WebView/touch edge cases), a drag could otherwise get stuck
  // mid-air with its transform never reset. A window-level listener while a
  // drag is active guarantees endDrag always runs.
  useLayoutEffect(() => {
    if (dragId == null) return undefined;
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [dragId]);

  const trimmedOptions = options.map(o => o.value.trim());
  const filledCount = trimmedOptions.filter(Boolean).length;
  const canSend = question.trim().length > 0 && filledCount >= MIN_OPTIONS;

  const send = () => {
    if (!canSend) return;
    const finalOptions = trimmedOptions.filter(Boolean);
    onSend({ question: question.trim(), options: finalOptions, allowMultiple });
  };

  const cardBg = isLight ? '#ffffff' : '#0e0e14';
  const inputBg = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)';
  const inputBorder = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)';
  const textColor = isLight ? '#0f172a' : '#fff';
  const subColor = isLight ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.45)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000005, background: cardBg,
      display: 'flex', flexDirection: 'column', color: textColor,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
        paddingTop: 'calc(16px + var(--sp-status-bar-inset, 0px))',
        borderBottom: `1px solid ${inputBorder}`, flexShrink: 0,
      }}>
        <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: textColor, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{title || 'Create poll'}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 100px', overscrollBehavior: 'contain' }} className="no-scrollbar">
        <div style={{ fontSize: 12, fontWeight: 700, color: subColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Question
        </div>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value.slice(0, QUESTION_LIMIT))}
          placeholder="Ask question"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', background: inputBg, border: `1px solid ${inputBorder}`,
            borderRadius: 12, padding: '12px 14px', color: textColor, fontSize: 15, outline: 'none',
            resize: 'none', fontFamily: 'inherit',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: subColor, marginTop: 4, marginBottom: 22 }}>
          {question.length}/{QUESTION_LIMIT}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: subColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Options
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          {options.map((opt, i) => (
            <div
              key={opt.id}
              ref={el => (rowRefs.current[opt.id] = el)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1.5px solid ${dragId === opt.id ? 'var(--brand-1)' : inputBorder}`,
                borderRadius: 12, padding: '4px 6px 4px 14px', background: inputBg,
                boxShadow: dragId === opt.id ? '0 8px 20px rgba(0,0,0,0.25)' : 'none',
                position: 'relative',
              }}
            >
              <div style={{ flex: 1 }}>
                <input
                  ref={el => (optionRefs.current[opt.id] = el)}
                  value={opt.value}
                  onChange={e => updateOption(opt.id, e.target.value)}
                  placeholder={i < 2 ? `Option ${i + 1}` : 'Add option'}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: 15, padding: '8px 0' }}
                />
                <div style={{ fontSize: 10, color: subColor }}>{opt.value.length}/{OPTION_LIMIT}</div>
              </div>
              {options.length > MIN_OPTIONS && opt.value === '' && i === options.length - 1 ? null : (
                options.length > MIN_OPTIONS && (
                  <button
                    onClick={() => removeOption(opt.id)}
                    aria-label="Remove option"
                    style={{ background: 'transparent', border: 'none', color: subColor, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}
                  >
                    <X size={16} />
                  </button>
                )
              )}
              <div
                onPointerDown={e => onHandlePointerDown(opt.id, e)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                style={{ cursor: 'grab', color: subColor, display: 'flex', padding: '4px 2px', touchAction: 'none', flexShrink: 0 }}
                aria-label="Reorder option"
              >
                <GripVertical size={18} />
              </div>
            </div>
          ))}
        </div>

        <div
          onClick={() => setAllowMultiple(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 26, padding: '14px 16px', borderRadius: 14,
            border: `1px solid ${inputBorder}`, background: inputBg, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Allow multiple answers</span>
          <div style={{
            width: 42, height: 24, borderRadius: 999, position: 'relative', flexShrink: 0,
            background: allowMultiple ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.18)'),
            transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 3, left: allowMultiple ? 21 : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      <button
        onClick={send}
        disabled={!canSend}
        aria-label="Send poll"
        style={{
          position: 'absolute', right: 20, bottom: 'calc(20px + env(safe-area-inset-bottom))',
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canSend ? 'pointer' : 'default',
          opacity: canSend ? 1 : 0.4, boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        }}
      >
        <Send size={22} color="#fff" />
      </button>
    </div>
  );
}
