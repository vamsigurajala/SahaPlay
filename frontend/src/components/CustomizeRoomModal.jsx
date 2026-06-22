import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { ROOM_THEMES } from '../data/roomThemes';

export default function CustomizeRoomModal({
  isOpen, onClose,
  currentTheme, baseRoomTheme,
  hasPersonalOverride,
  onSelectTheme, onClearPersonalTheme,
  isHost,
}) {
  const [isLight, setIsLight] = useState(
    document.documentElement.getAttribute('data-theme') === 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="customize-room-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 50000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: isLight ? '#ffffff' : '#0d0d1a',
        border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '28px',
        width: 580,
        maxWidth: '95vw',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: isLight ? '0 8px 40px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.8)',
        fontFamily: 'Outfit, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isLight ? '#111827' : '#f9fafb', letterSpacing: '-0.3px' }}>
            Customize Room Background Theme
          </h2>
          <button
            onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = isLight ? '#6b7280' : '#9ca3af'; }}
            style={{
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: isLight ? '#6b7280' : '#9ca3af', cursor: 'pointer',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scope info */}
        <p style={{ margin: '0 0 16px', fontSize: 12, color: isHost ? '#a78bfa' : '#6b7280' }}>
          {isHost
            ? 'As the host, your theme choice applies to everyone in this room.'
            : 'This only changes your own view. The host controls the shared room theme for everyone else.'}
        </p>

        {/* Reset to room theme (shown when user has a personal override) */}
        {hasPersonalOverride && (
          <button
            onClick={() => { onClearPersonalTheme(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              width: '100%', marginBottom: 16,
              padding: '9px 14px',
              borderRadius: 10,
              background: 'transparent',
              border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
              color: isLight ? '#4b5563' : '#9ca3af',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.color = '#a78bfa'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = isLight ? '#4b5563' : '#9ca3af'; }}
          >
            <RotateCcw size={13} />
            Reset to room theme
            {baseRoomTheme && baseRoomTheme !== 'default' && (
              <span style={{ marginLeft: 4, color: '#a78bfa', fontWeight: 700 }}>
                ({ROOM_THEMES.find(t => t.id === baseRoomTheme)?.name || baseRoomTheme})
              </span>
            )}
          </button>
        )}

        {/* Theme section label */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>
          Backgrounds
        </div>

        {/* Theme grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {ROOM_THEMES.map(theme => {
            const isActive = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: isActive ? '3px solid #7c3aed' : '2px solid transparent',
                  outline: isActive ? '2px solid rgba(124,58,237,0.3)' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  aspectRatio: '16/10',
                  background: theme.previewCss,
                  transition: 'transform 0.15s, border-color 0.15s',
                  boxShadow: isActive ? '0 0 0 4px rgba(124,58,237,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="stay-white" style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  padding: '14px 10px 8px',
                  textAlign: 'left',
                }}>
                  {theme.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
