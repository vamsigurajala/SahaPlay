import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CHAT_THEMES, CHAT_WALLPAPERS, CHAT_WALLPAPER_CATEGORIES } from '../lib/chatThemes';

// Unified "Customize chat" picker — replaces what used to be two near-
// identical, hand-copied bottom sheets (GlobalChatWidget.jsx's own sheet,
// and Room.jsx's simpler gradient-only version for group/DM-in-room chat).
// Both surfaces now render this exact component; only the CHAT_THEMES
// gradients and CHAT_WALLPAPERS scenes ever need to change to add a theme,
// nothing here does.
//
// The caller owns persistence: `onSelect(themeId)` is expected to call
// `applyChatThemeShared(...)` (see lib/chatThemes.js) with whatever `target`
// shape that surface uses — this component only needs the already-resolved
// `activeChatKey` (lowercased chatKey string, or null) to know which card is
// currently selected.
const CATEGORY_LABELS = { all: 'All', colors: 'Colors', nature: 'Nature', night: 'Night', fantasy: 'Fantasy' };

export default function ChatThemeSheet({ open, onClose, isLight, t, chatThemes, activeChatKey, onSelect }) {
  const [category, setCategory] = useState('all');
  if (!open) return null;

  const selectedId = activeChatKey ? ((chatThemes && chatThemes[activeChatKey]) || 'default') : 'default';
  const tabs = ['all', 'colors', ...CHAT_WALLPAPER_CATEGORIES];

  const cards = [];
  if (category === 'all' || category === 'colors') {
    CHAT_THEMES.forEach(th => cards.push({ kind: 'theme', ...th }));
  }
  CHAT_WALLPAPERS.forEach(w => {
    if (category === 'all' || category === w.category) cards.push({ kind: 'wallpaper', ...w });
  });

  return createPortal(
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <style>{`
        .chat-theme-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .chat-theme-card:hover { transform: scale(1.04); }
        .chat-theme-card:active { transform: scale(0.98); }
        .chat-theme-cat-btn { transition: background 0.2s, color 0.2s; white-space: nowrap; }
      `}</style>
      <div
        onMouseDown={e => e.stopPropagation()}
        className="no-scrollbar"
        style={{
          width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
          background: isLight ? '#ffffff' : '#111114', borderRadius: '24px 24px 0 0', padding: '10px 20px 28px',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.6)', animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.25)', margin: '4px auto 16px' }} />
        <div style={{ textAlign: 'center', color: isLight ? '#0f172a' : '#fff', fontWeight: 800, fontSize: 17, marginBottom: 14 }}>
          {t('customizeChat', 'Customize')}
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }} className="no-scrollbar">
          {tabs.map(cat => {
            const active = cat === category;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="chat-theme-cat-btn"
                style={{
                  flexShrink: 0, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: active ? 'none' : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)'),
                  background: active ? 'linear-gradient(135deg,var(--brand-1),var(--brand-2))' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)'),
                  color: active ? '#fff' : (isLight ? '#475569' : '#9ca3af'),
                }}
              >
                {t(`chatThemeCat${cat.charAt(0).toUpperCase()}${cat.slice(1)}`, CATEGORY_LABELS[cat] || cat)}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {cards.map(card => {
            const selected = card.id === selectedId;
            const isWallpaper = card.kind === 'wallpaper';
            const labelKey = isWallpaper
              ? `chatBg${card.id.replace(/^wp-/, '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`
              : `chatTheme${card.id.charAt(0).toUpperCase()}${card.id.slice(1)}`;
            return (
              <button
                key={card.id}
                onClick={() => { onSelect(card.id); onClose(); }}
                className="chat-theme-card"
                style={{
                  position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 16, border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden',
                  backgroundImage: isWallpaper ? `url("${card.image}")` : card.gradient,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  boxShadow: selected ? '0 0 0 3px #fff, 0 0 0 5px var(--brand-1), 0 6px 20px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, transparent 70%)' }} />
                <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 800, lineHeight: 1.2 }}>{t(labelKey, card.name)}</div>
                  {isWallpaper && card.description && (
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.description}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
