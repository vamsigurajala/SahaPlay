import React, { useRef, useState } from 'react';
import { ArrowLeft, GripVertical, X, Send } from 'lucide-react';

const QUESTION_LIMIT = 255;
const OPTION_LIMIT = 100;
const MAX_OPTIONS = 12;
const MIN_OPTIONS = 2;

// Full-screen "Create poll" composer — paperclip menu's Poll option opens
// this instead of the file picker. onSend receives a plain
// { question, options, allowMultiple } object; the caller is responsible
// for encrypting it exactly like normal message text (see
// GlobalChatWidget.jsx/RoomChatPanel.jsx's own send functions) and marking
// the message isPoll:true — this component has no idea messages are
// encrypted at all, matching how CameraCapture.jsx hands back a plain File
// and lets the caller do the actual sending.
export default function PollComposer({ onSend, onClose, isLight }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const optionRefs = useRef([]);

  // Drag-to-reorder: pointer-events based (not HTML5 drag/drop, which has
  // no real touch support) so this works the same on a mouse or a phone —
  // same approach CameraCapture.jsx's color slider already uses. Dragging
  // the handle on one row swaps it live with whichever row the pointer is
  // currently over, using each row's own measured position rather than a
  // fixed row height, so this stays correct even if a row has wrapped to
  // two lines from a long option.
  const rowRefs = useRef([]);
  const dragIndexRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);

  const updateOption = (i, value) => {
    setOptions(prev => {
      const next = [...prev];
      next[i] = value.slice(0, OPTION_LIMIT);
      // Typing into the last (currently empty→non-empty) box grows the
      // list — mirrors WhatsApp's own "type in the last row to add
      // another" behavior instead of a separate persistent "+ Add" button
      // the user has to keep re-tapping.
      if (i === next.length - 1 && next[i].trim() && next.length < MAX_OPTIONS) {
        next.push('');
      }
      return next;
    });
  };

  const removeOption = (i) => {
    setOptions(prev => {
      if (prev.length <= MIN_OPTIONS) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const onHandlePointerDown = (i, e) => {
    e.preventDefault();
    dragIndexRef.current = i;
    setDragIndex(i);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHandlePointerMove = (e) => {
    if (dragIndexRef.current == null) return;
    const from = dragIndexRef.current;
    const clientY = e.clientY;
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el || i === from) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const crossing = i < from ? clientY < mid : clientY > mid;
      if (crossing) {
        setOptions(prev => {
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(i, 0, moved);
          return next;
        });
        dragIndexRef.current = i;
        setDragIndex(i);
        break;
      }
    }
  };
  const onHandlePointerUp = () => {
    dragIndexRef.current = null;
    setDragIndex(null);
  };

  const trimmedOptions = options.map(o => o.trim());
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
        <span style={{ fontWeight: 700, fontSize: 17 }}>Create poll</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((opt, i) => (
            <div
              key={i}
              ref={el => (rowRefs.current[i] = el)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                border: `1.5px solid ${dragIndex === i ? 'var(--brand-1)' : inputBorder}`,
                borderRadius: 12, padding: '4px 6px 4px 14px', background: inputBg,
                opacity: dragIndex === i ? 0.85 : 1,
                transition: dragIndex === i ? 'none' : 'border-color 0.15s',
              }}
            >
              <div style={{ flex: 1 }}>
                <input
                  ref={el => (optionRefs.current[i] = el)}
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={i < 2 ? `Option ${i + 1}` : 'Add option'}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: 15, padding: '8px 0' }}
                />
                <div style={{ fontSize: 10, color: subColor }}>{opt.length}/{OPTION_LIMIT}</div>
              </div>
              {options.length > MIN_OPTIONS && opt === '' && i === options.length - 1 ? null : (
                options.length > MIN_OPTIONS && (
                  <button
                    onClick={() => removeOption(i)}
                    aria-label="Remove option"
                    style={{ background: 'transparent', border: 'none', color: subColor, cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}
                  >
                    <X size={16} />
                  </button>
                )
              )}
              <div
                onPointerDown={e => onHandlePointerDown(i, e)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerUp}
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
