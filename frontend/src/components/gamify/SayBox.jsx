import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SAY_MAX } from './emotes';

// A one-line box: what you type floats over your head for everyone in the house.
export default function SayBox({ onSend }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  const send = (e) => {
    e.preventDefault();
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    onSend(clean.slice(0, SAY_MAX));
    setText('');
  };
  return (
    <form onSubmit={send} className="stay-white" style={{ position: 'absolute', right: 56, bottom: 12, zIndex: 66, display: 'flex', gap: 6, padding: 8, borderRadius: 16, width: 'min(320px, calc(100% - 80px))', background: 'rgba(14,12,30,0.94)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 12px 36px rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
      <input
        ref={input}
        value={text}
        maxLength={SAY_MAX}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.stopPropagation()}
        placeholder={t('gamify.say.placeholder', 'Say something...')}
        aria-label={t('gamify.say.title', 'Say something')}
        style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.08)', color: '#fff', WebkitTextFillColor: '#fff', fontSize: 16, outline: 'none' }}
      />
      <button type="submit" disabled={!text.trim()} aria-label={t('gamify.say.send', 'Send')} title={t('gamify.say.send', 'Send')} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: text.trim() ? 'linear-gradient(135deg,#8b5cff,#4f46e5)' : 'rgba(255,255,255,0.12)', color: '#fff', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Send size={17} />
      </button>
    </form>
  );
}
