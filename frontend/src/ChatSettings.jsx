import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Type, CornerDownLeft, Check } from 'lucide-react';
import ToggleSwitch from './components/ToggleSwitch';
import { getChatFontSize, setChatFontSize, CHAT_FONT_SIZES, isEnterToSend, setEnterToSend } from './lib/chatPreferences';

// Profile → Chats. Two purely-local preferences (lib/chatPreferences.js)
// that apply to every chat surface in the app at once — GlobalChatWidget's
// own chat window and RoomChatPanel's in-room Group/DM tabs — not just
// whichever one happened to be open when this page was visited.
const FONT_PREVIEW_PX = { small: 12, medium: 14, big: 17 };

export default function ChatSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [fontSize, setFontSizeState] = useState(getChatFontSize());
  const [enterToSend, setEnterToSendState] = useState(isEnterToSend());

  const FONT_SIZE_LABELS = {
    small: t('fontSizeSmall', 'Small'),
    medium: t('fontSizeMedium', 'Medium'),
    big: t('fontSizeBig', 'Big'),
  };

  const handleFontSizeChange = (size) => {
    setChatFontSize(size);
    setFontSizeState(size);
  };

  const handleEnterToggle = (enabled) => {
    setEnterToSend(enabled);
    setEnterToSendState(enabled);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: 60 }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px 20px 0' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'var(--header-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '8px 0', marginBottom: 20 }}
        >
          <ArrowLeft size={20} /> {t('back', 'Back')}
        </button>

        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px', color: 'var(--header-text)' }}>{t('chatsSettingsTitle', 'Chats')}</h2>

        {/* Font size — applies to every message bubble in every chat
            (room chats and the global chat window) via a single shared CSS
            var, see chatPreferences.js's own comment for why. */}
        <div style={{ background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', borderRadius: 20, padding: '22px 24px', marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--header-text)' }}>
            <Type size={18} color="var(--brand-1)" /> {t('fontSize', 'Font Size')}
          </h3>
          <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--header-btn)' }}>
            {t('fontSizeDesc', 'Changes the text size of every message, across every chat and room.')}
          </p>
          {/* Radio-group semantics (only one size is ever selected) but
              drawn as a square selection box per explicit request, not a
              round radio dot — a small filled/checked square on the right
              of each row instead. Row text uses var(--header-text)/
              var(--room-border), the same theme-adaptive vars every other
              chat surface in the app already reads, so it stays readable in
              both light and dark mode rather than a color hardcoded for
              one theme only. */}
          <div role="radiogroup" aria-label={t('fontSize', 'Font Size')} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHAT_FONT_SIZES.map(size => {
              const active = fontSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleFontSizeChange(size)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: active ? '1.5px solid var(--brand-1)' : '1px solid var(--room-border)',
                    background: active ? 'rgba(var(--brand-1-rgb),0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: FONT_PREVIEW_PX[size], fontWeight: 700, color: 'var(--header-text)', width: 28, textAlign: 'center', flexShrink: 0 }}>Aa</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--header-text)' }}>{FONT_SIZE_LABELS[size]}</span>
                  <span style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    border: active ? 'none' : '2px solid var(--room-border)',
                    background: active ? 'linear-gradient(135deg,var(--brand-1),var(--brand-2))' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {active && <Check size={13} color="#fff" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Enter is Send — same toggle governs every composer in the app
            (room Group tab, room DM tab, global chat window), not just one
            surface. Off means Enter behaves like Shift+Enter always has
            (newline); sending then only happens via the Send button. */}
        <div style={{ background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', borderRadius: 20, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--header-text)' }}>
                <CornerDownLeft size={18} color="var(--brand-1)" /> {t('enterIsSend', 'Enter is Send')}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--header-btn)' }}>
                {enterToSend
                  ? t('enterIsSendOnDesc', 'Pressing Enter sends your message. Use Shift+Enter for a new line.')
                  : t('enterIsSendOffDesc', 'Pressing Enter starts a new line. Tap Send to send your message.')}
              </p>
            </div>
            <ToggleSwitch checked={enterToSend} onChange={handleEnterToggle} label={t('enterIsSend', 'Enter is Send')} />
          </div>
        </div>
      </div>
    </div>
  );
}
