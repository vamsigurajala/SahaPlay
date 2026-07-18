import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

const FONT_SIZES = [
  { value: 'small', label: 'Small', px: 13 },
  { value: 'medium', label: 'Medium', px: 17 },
  { value: 'large', label: 'Large', px: 22 },
  { value: 'xlarge', label: 'XL', px: 30 },
];

const TEXT_COLORS = [
  { value: 'white', label: 'White', hex: '#ffffff' },
  { value: 'yellow', label: 'Yellow', hex: '#ffef00' },
  { value: 'cyan', label: 'Cyan', hex: '#00e5ff' },
  { value: 'green', label: 'Green', hex: '#00e676' },
];

const BG_COLORS = [
  { value: 'black', label: 'Black', previewBg: 'rgba(0,0,0,0.88)' },
  { value: 'darkgray', label: 'Dark Gray', previewBg: 'rgba(40,40,40,0.88)' },
  { value: 'transparent', label: 'Transparent', previewBg: 'transparent' },
];

const POSITIONS = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottom-raised', label: 'Raised' },
  { value: 'center', label: 'Center' },
];

const SPEEDS = [
  { value: 0.8, label: 'Slow' },
  { value: 1.0, label: 'Normal' },
  { value: 1.2, label: 'Fast' },
];

const DEFAULT_SETTINGS = {
  delay: 0,
  speed: 1.0,
  fontSize: 'medium',
  textColor: 'white',
  bgColor: 'black',
  opacity: 1.0,
  position: 'bottom',
};

export default function SubtitleSettingsModal({ open, onClose, settings, onChange, isMobile, isRotatedFs }) {
  const [isLight, setIsLight] = useState(
    document.documentElement.getAttribute('data-theme') === 'light'
  );
  const [resetPressed, setResetPressed] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!open) return null;

  const s = settings || DEFAULT_SETTINGS;

  const previewColor = TEXT_COLORS.find(c => c.value === s.textColor)?.hex || '#ffffff';
  const previewBg = BG_COLORS.find(c => c.value === s.bgColor)?.previewBg || 'rgba(0,0,0,0.88)';
  const previewFontSize = FONT_SIZES.find(f => f.value === s.fontSize)?.px || 17;

  const resetBg = resetPressed
    ? (isLight ? '#d1d5db' : 'rgba(255,255,255,0.16)')
    : resetHovered
      ? (isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)')
      : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.08)');

  // Shared drawer-panel look (mobile portrait AND rotated-fullscreen both use this —
  // only how the panel is positioned/wrapped differs between the two).
  const panelBase = {
    background: isLight ? '#ffffff' : '#0d0d1a',
    padding: '20px 18px',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
    color: isLight ? '#111827' : '#e5e7eb',
    fontFamily: 'Outfit, sans-serif',
  };

  const content = (
    <>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isLight ? '#111827' : '#f9fafb', letterSpacing: '-0.2px' }}>
            Subtitle Settings
          </h3>
          <button
            onClick={onClose}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)';
              e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = isLight ? '#6b7280' : '#9ca3af';
            }}
            style={{
              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: isLight ? '#6b7280' : '#9ca3af',
              cursor: 'pointer',
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            ×
          </button>
        </div>

        {/* Live Preview */}
        <div style={{
          background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)',
          border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '14px 16px 18px',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600 }}>
            Preview
          </span>
          <div
            className="gcw-force-dark"
            style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 48,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 6,
            padding: '8px',
          }}>
            <div style={{
              background: previewBg,
              padding: previewBg === 'transparent' ? '0 8px' : '4px 14px',
              borderRadius: 4,
              fontSize: previewFontSize,
              color: previewColor,
              fontFamily: '"Inter", system-ui, sans-serif',
              fontWeight: 500,
              textAlign: 'center',
              textShadow: previewBg === 'transparent'
                ? '1px 1px 4px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.7)'
                : 'none',
              opacity: s.opacity,
              lineHeight: 1.5,
              maxWidth: '100%',
            }}>
              The quick brown fox jumps over the lazy dog.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Subtitle Delay */}
          <SettingRow
            label="Subtitle Delay"
            hint={`${s.delay >= 0 ? '+' : ''}${s.delay.toFixed(1)}s`}
            isLight={isLight}
          >
            <input
              type="range" min={-10} max={10} step={0.1} value={s.delay}
              onChange={e => onChange({ ...s, delay: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              <span>-10s (earlier)</span>
              <span>+10s (later)</span>
            </div>
          </SettingRow>

          {/* Subtitle Speed */}
          <SettingRow label="Subtitle Speed" isLight={isLight}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SPEEDS.map(sp => (
                <Chip key={sp.value} active={s.speed === sp.value} isLight={isLight}
                  onClick={() => onChange({ ...s, speed: sp.value })}>
                  {sp.label} ({sp.value}x)
                </Chip>
              ))}
            </div>
          </SettingRow>

          {/* Font Size */}
          <SettingRow label="Font Size" isLight={isLight}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FONT_SIZES.map(f => (
                <Chip key={f.value} active={s.fontSize === f.value} isLight={isLight}
                  onClick={() => onChange({ ...s, fontSize: f.value })}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </SettingRow>

          {/* Text Color */}
          <SettingRow label="Text Color" isLight={isLight}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {TEXT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => onChange({ ...s, textColor: c.value })}
                  title={c.label}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                    background: c.hex,
                    border: s.textColor === c.value
                      ? '3px solid #8b5cf6'
                      : isLight ? '2px solid #d1d5db' : '2px solid rgba(255,255,255,0.2)',
                    outline: 'none', padding: 0, flexShrink: 0,
                    boxShadow: s.textColor === c.value ? '0 0 0 2px rgba(139,92,246,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>
          </SettingRow>

          {/* Background Color */}
          <SettingRow label="Background" isLight={isLight}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BG_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => onChange({ ...s, bgColor: c.value })}
                  title={c.label}
                  style={{
                    padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    fontFamily: 'inherit', fontWeight: 500,
                    background: c.value === 'transparent'
                      ? (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)')
                      : c.previewBg,
                    border: s.bgColor === c.value
                      ? '1.5px solid #8b5cf6'
                      : isLight ? '1.5px solid #e5e7eb' : '1.5px solid rgba(255,255,255,0.15)',
                    color: c.value === 'transparent'
                      ? (isLight ? '#374151' : '#9ca3af')
                      : '#e5e7eb',
                    outline: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Opacity */}
          <SettingRow
            label="Opacity"
            hint={`${Math.round(s.opacity * 100)}%`}
            isLight={isLight}
          >
            <input
              type="range" min={0.1} max={1} step={0.05} value={s.opacity}
              onChange={e => onChange({ ...s, opacity: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              <span>10%</span>
              <span>100%</span>
            </div>
          </SettingRow>

          {/* Position */}
          <SettingRow label="Position" isLight={isLight}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {POSITIONS.map(p => (
                <Chip key={p.value} active={s.position === p.value} isLight={isLight}
                  onClick={() => onChange({ ...s, position: p.value })}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </SettingRow>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            onMouseEnter={() => setResetHovered(true)}
            onMouseLeave={() => { setResetHovered(false); setResetPressed(false); }}
            onMouseDown={() => setResetPressed(true)}
            onMouseUp={() => setResetPressed(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: resetBg,
              border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
              color: isLight ? '#374151' : '#e5e7eb',
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
              fontFamily: 'inherit',
              transform: resetPressed ? 'scale(0.96)' : 'scale(1)',
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
          >
            <RotateCcw size={14} />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="stay-white"
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{
              padding: '9px 24px', borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              transition: 'transform 0.12s ease',
            }}
          >
            Done
          </button>
        </div>
    </>
  );

  if (isRotatedFs) {
    // The mobile-fullscreen "rotate trick" (.player-mob-fs in Room.jsx) rotates the
    // whole video 90deg so it fakes landscape on a still-portrait-locked phone; the
    // user then physically turns the phone to match. That physical turn is the part
    // that matters here: a rect pinned to the LOCAL top edge (pre-rotation frame)
    // lands on the real DOM's right edge, but the real DOM frame is fixed to the
    // device body — after the user's physical turn, that real-right edge is what
    // they now perceive as the TOP of their view, not the right. (This checks out
    // against the player controls bar, which sits at LOCAL bottom and is correctly
    // perceived at the bottom post-rotation, confirming the mapping direction.) So
    // a panel meant to look like a right-side drawer must anchor to the LOCAL RIGHT
    // edge instead — same wrapper the quality/subtitle dropdowns already use, just
    // pinned to the opposite local edge. Local width (not height) is the capped
    // axis now, and it maps to the real DOM's height (window.innerHeight) — the
    // phone's long dimension, which becomes the perceived screen WIDTH once
    // rotated — so that's the ceiling this fraction is measured against.
    const capPx = Math.min(window.innerHeight * 0.38, 300);
    return (
      <div
        className="sp-mobfs-overlay-wrap"
        style={{ zIndex: 1000050, pointerEvents: 'auto' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="sp-hidden-scroll sp-panel-slide-in"
          style={{
            ...panelBase,
            position: 'absolute', top: 0, right: 0, width: capPx, height: '100%',
            borderLeft: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: isLight ? '-4px 0 24px rgba(0,0,0,0.12)' : '-4px 0 32px rgba(0,0,0,0.5)',
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="subtitle-modal-overlay"
      style={isMobile ? {
        // No dimming/blur on mobile — this sits above the fullscreen video, and the
        // user wants the video still clearly visible beside the settings panel
        // rather than darkened everywhere behind it.
        position: 'fixed', inset: 0, zIndex: 1000050,
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
        background: 'transparent',
      } : {
        position: 'fixed', inset: 0, zIndex: 1000050,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isLight ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
        backdropFilter: isLight ? 'blur(4px)' : 'blur(8px)',
        WebkitBackdropFilter: isLight ? 'blur(4px)' : 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={isMobile ? 'sp-hidden-scroll' : ''} style={isMobile ? {
        ...panelBase,
        borderLeft: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px 0 0 16px',
        width: 'min(86vw, 340px)',
        height: '100%',
        maxHeight: '100%',
        boxShadow: isLight ? '-4px 0 24px rgba(0,0,0,0.12)' : '-4px 0 32px rgba(0,0,0,0.5)',
      } : {
        background: isLight ? '#ffffff' : '#0d0d1a',
        border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '24px',
        width: 420,
        maxWidth: '96vw',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: isLight ? '0 4px 24px rgba(0,0,0,0.10)' : 'none',
        color: isLight ? '#111827' : '#e5e7eb',
        fontFamily: 'Outfit, sans-serif',
      }}>
        {content}
      </div>
    </div>
  );
}

function SettingRow({ label, hint, isLight, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: isLight ? '#111827' : '#d1d5db' }}>{label}</span>
        {hint && <span style={{ fontSize: 13, color: '#8b5cf6', fontWeight: 700 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, isLight, children }) {
  return (
    <button
      onClick={onClick}
      className={active && isLight ? 'stay-white' : ''}
      style={{
        padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
        fontSize: 12, fontWeight: 500,
        background: active
          ? (isLight ? '#7c3aed' : 'rgba(139,92,246,0.22)')
          : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.07)'),
        border: active
          ? (isLight ? '1.5px solid #7c3aed' : '1.5px solid rgba(139,92,246,0.6)')
          : (isLight ? '1.5px solid #e5e7eb' : '1.5px solid rgba(255,255,255,0.1)'),
        color: active
          ? (isLight ? '#ffffff' : '#c084fc')
          : (isLight ? '#374151' : '#9ca3af'),
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
