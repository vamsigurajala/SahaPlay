import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SAY_MAX } from './emotes';
import { useIsLight } from './useIsLight';

// A one-line box: what you type floats over your head for everyone in the house.
export default function SayBox({ onSend }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const input = useRef(null);
  const isLight = useIsLight();

  useEffect(() => { input.current?.focus(); }, []);

  const send = (e) => {
    e.preventDefault();
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    onSend(clean.slice(0, SAY_MAX));
    setText('');
  };

  const formStyle = isLight ? {
    position: 'absolute',
    right: 56,
    bottom: 12,
    zIndex: 66,
    display: 'flex',
    gap: 6,
    padding: 8,
    borderRadius: 16,
    width: 'min(340px, calc(100% - 80px))',
    background: 'rgba(255, 255, 255, 0.97)',
    border: '1.5px solid rgba(139, 92, 255, 0.45)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18), 0 3px 10px rgba(139, 92, 255, 0.15)',
    backdropFilter: 'blur(16px)',
  } : {
    position: 'absolute',
    right: 56,
    bottom: 12,
    zIndex: 66,
    display: 'flex',
    gap: 6,
    padding: 8,
    borderRadius: 16,
    width: 'min(340px, calc(100% - 80px))',
    background: 'rgba(14, 12, 30, 0.94)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(10px)',
  };

  const inputStyle = isLight ? {
    flex: 1,
    minWidth: 0,
    height: 40,
    padding: '0 14px',
    borderRadius: 12,
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    WebkitTextFillColor: '#0f172a',
    fontSize: 15,
    fontWeight: 600,
    outline: 'none',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
  } : {
    flex: 1,
    minWidth: 0,
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.22)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    WebkitTextFillColor: '#ffffff',
    fontSize: 15,
    outline: 'none',
  };

  const btnStyle = isLight ? {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    background: text.trim() ? 'linear-gradient(135deg, #8b5cff, #6366f1)' : '#e2e8f0',
    color: text.trim() ? '#ffffff' : '#94a3b8',
    cursor: text.trim() ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: text.trim() ? '0 4px 12px rgba(139, 92, 255, 0.35)' : 'none',
    transition: 'all 0.2s ease',
  } : {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    background: text.trim() ? 'linear-gradient(135deg, #8b5cff, #4f46e5)' : 'rgba(255, 255, 255, 0.12)',
    color: '#fff',
    cursor: text.trim() ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  };

  return (
    <form onSubmit={send} className={isLight ? 'gamify-say-light' : 'stay-white'} style={formStyle}>
      <input
        ref={input}
        value={text}
        maxLength={SAY_MAX}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.stopPropagation()}
        placeholder={t('gamify.say.placeholder', 'Say something...')}
        aria-label={t('gamify.say.title', 'Say something')}
        style={inputStyle}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        aria-label={t('gamify.say.send', 'Send')}
        title={t('gamify.say.send', 'Send')}
        style={btnStyle}
      >
        <Send size={17} />
      </button>
    </form>
  );
}
