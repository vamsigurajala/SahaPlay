import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, PlayCircle, MonitorUp, Info, ArrowRight, CheckCircle2, ChevronRight, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isTauriApp } from '../lib/platform';

export default function GuidedShareModal({ app, onClose, onScreenshare, isLight }) {
  const [step, setStep] = useState(1);
  const { t } = useTranslation();
  const [quality, setQuality] = useState('auto');
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const popupRef = useRef(null);
  const qualityBtnRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // The Step 2 panel sits inside a translateX'd, overflow-clipped track on mobile (needed
  // for the slide transition), so an ancestor-relative absolute-positioned dropdown would
  // get clipped. Portal it to document.body instead, positioned from the trigger's own
  // rect — immune to any ancestor overflow/transform.
  useEffect(() => {
    if (showQualityDropdown && qualityBtnRef.current) {
      setDropdownRect(qualityBtnRef.current.getBoundingClientRect());
    }
  }, [showQualityDropdown]);

  if (!app) return null;

  // 'auto' passes no video constraints — browser negotiates best quality based on available bandwidth
  // 'enhancement' is a CSS filter string applied on the sender's canvas — all viewers see the result
  const qualityOptions = {
    'auto':  { labelKey: 'qualityAutoLabel', label: 'Auto',      subKey: 'qualityAutoSub', sub: 'Adapts to your network',     width: undefined,       height: undefined,       frameRate: undefined,              enhancement: 'none' },
    '360p':  { labelKey: 'quality360pLabel', label: '360p',      subKey: 'quality360pSub', sub: 'Low bandwidth',              width: { ideal: 640 },  height: { ideal: 360 },  frameRate: { ideal: 24 },          enhancement: 'none' },
    '480p':  { labelKey: 'quality480pLabel', label: '480p',      subKey: 'quality480pSub', sub: 'Standard + light enhance',   width: { ideal: 854 },  height: { ideal: 480 },  frameRate: { ideal: 30 },          enhancement: 'saturate(1.12) contrast(1.06) brightness(1.02)' },
    '720p':  { labelKey: 'quality720pLabel', label: '720p HD',   subKey: 'quality720pSub', sub: 'HD + enhanced visuals',      width: { ideal: 1280 }, height: { ideal: 720 },  frameRate: { ideal: 30 },          enhancement: 'saturate(1.22) contrast(1.1) brightness(1.03)' },
    '1080p': { labelKey: 'quality1080pLabel', label: '1080p FHD', subKey: 'quality1080pSub', sub: 'Full HD + vivid enhance',    width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },          enhancement: 'saturate(1.3) contrast(1.14) brightness(1.04)' },
    '4k':    { labelKey: 'quality4kLabel', label: '4K UHD',    subKey: 'quality4kSub', sub: 'Ultra HD + max enhance',     width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 60 },          enhancement: 'saturate(1.35) contrast(1.16) brightness(1.04)' },
  };

  const handleLaunch = () => {
    const url = app.url || `https://${app.id}.com`;
    if (isTauriApp()) {
      // The Tauri desktop webview has no real window.open() support for a
      // third-party origin like netflix.com — it silently no-ops instead of
      // opening anything, which is exactly why Launch did nothing on the
      // .exe build. Hand it to the OS's own default browser instead (same
      // pattern desktopNotify.js's openWindowsNotificationSettings already
      // uses). There's no window handle to keep afterward — popupRef stays
      // null, which startScreenshare already treats as "no popup to auto-
      // close later" via its own default appWindow = null.
      import('@tauri-apps/plugin-opener')
        .then((mod) => mod.openUrl(url))
        .catch(() => {});
    } else {
      const width = 1200;
      const height = 800;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);
      popupRef.current = window.open(url, app.name, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    }
    setStep(2);
  };

  const handleShare = () => {
    onClose();
    onScreenshare(qualityOptions[quality], popupRef.current, app);
  };

  // Internal brand color safety map — prevents white/near-white button backgrounds
  const BRAND_COLORS = {
    tiktok:    '#EE1D52',
    instagram: '#E1306C',
    netflix:   '#E50914',
    spotify:   '#1DB954',
    prime:     '#00A8E1',
    hbomax:    '#991ef2',
    hulu:      '#1ce783',
    crunchyroll: '#F47521',
    hotstar:   '#0063e5',
    appletv:   '#a855f7',
    apple:     '#555555',
    minigolf:  '#10b981',
    '8ball':   '#3b82f6',
    slither:   '#a855f7',
    smashkarts:'#e11d48',
    krunker:   '#f59e0b',
    zee5:      '#5E2A8C',
    sonyliv:   '#D50000',
    peacocktv: '#4FC3F7',
    viki:      '#00B8D4',
    mxplayer:  '#FF6B35',
    aha:       '#FF5722',
    facebook:  '#1877F2',
    xtwitter:  '#15202B',
  };

  const isColorWhite = (c) => !c || c === '#fff' || c === '#ffffff' || c === 'white' || c === 'rgb(255,255,255)';

  const rawBrand = app.brandColor || app.color || '#a855f7';
  const brandColor = rawBrand;  // Used for decorative elements (glow, header bar, step circles)
  // For button backgrounds — always a visible, non-white color
  const btnColor = BRAND_COLORS[app.id] || (isColorWhite(rawBrand) ? '#a855f7' : rawBrand);

  // Theme-aware styles
  const modalBg = isLight ? '#ffffff' : '#0d0d12';
  const modalBorder = isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)';
  const titleColor = isLight ? '#0f172a' : '#fff';
  const subTextColor = isLight ? '#222' : '#d1d1d6';
  const stepCardBorder = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)';
  const safetyTextColor = isLight ? '#111' : '#ccc';

  // Number circle logic
  const getStepBg = (s) => {
    if (step > s) return brandColor; // Completed
    if (step === s) return '#000000'; // Current (Force black as requested)
    return isLight ? '#f1f5f9' : '#1e1e2d'; // Inactive
  };
  const getStepColor = (s) => {
    if (step >= s) return '#ffffff'; // Force white for active/completed
    return isLight ? '#94a3b8' : '#888'; // Inactive
  };

  const cardPadding = isMobile ? 20 : 24;

  // Step 1 panel: Preparation / Launch. `active` controls the highlighted-vs-dimmed look —
  // on desktop that's tied to which step is current (both panels are visible side-by-side),
  // on mobile it's always true (only one panel is ever in the viewport, the other is fully
  // off-screen behind the sliding track, so dimming it would be pointless).
  const renderStep1Panel = (active) => (
    <div style={{
      width: '100%', boxSizing: 'border-box',
      background: active ? (isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)') : 'transparent',
      border: `1px solid ${active ? (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)') : stepCardBorder}`,
      borderRadius: 24, padding: cardPadding, opacity: active ? 1 : 0.4,
      transition: 'all 0.4s', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: getStepBg(1),
        color: getStepColor(1), display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, marginBottom: 16, border: `2px solid ${step === 1 ? brandColor : 'transparent'}`
      }}>
        {step > 1 ? (
          <CheckCircle2 size={20} color="#fff" />
        ) : (
          <span style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>1</span>
        )}
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color: titleColor, marginBottom: 8 }}>{t('preparation', 'Preparation')}</span>
      <p style={{ fontSize: 12, color: subTextColor, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
        {t('preparationDesc', 'Launch and log in to your account.')}
      </p>
      {step === 1 ? (
        <button
          onClick={handleLaunch}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${btnColor} 0%, ${btnColor}cc 100%)`,
            border: 'none', borderRadius: 14,
            padding: '14px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: `0 4px 20px ${btnColor}66`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textTransform: 'uppercase', letterSpacing: '1px',
            color: '#ffffff', WebkitTextFillColor: '#ffffff'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 28px ${btnColor}88`; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=`0 4px 20px ${btnColor}66`; }}
        >
          <PlayCircle size={18} color="#fff" />
          <span style={{ color: '#fff', WebkitTextFillColor: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{t('launchApp', 'Launch App')}</span>
          <ChevronRight size={14} color="#fff" />
        </button>
      ) : (
        <div style={{ color: brandColor, fontSize: 12, fontWeight: 700 }}>{t('ready', 'Ready!')}</div>
      )}
    </div>
  );

  // Step 2 panel: Discovery / quality select + share. Same `active` contract as renderStep1Panel.
  const renderStep2Panel = (active) => (
    <div style={{
      width: '100%', boxSizing: 'border-box',
      background: active ? (isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)') : 'transparent',
      border: `1px solid ${active ? (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)') : stepCardBorder}`,
      borderRadius: 24, padding: cardPadding, opacity: active ? 1 : 0.4,
      transition: 'all 0.4s', display: 'flex', flexDirection: 'column', alignItems: 'center'
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: getStepBg(2),
        color: getStepColor(2), display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, marginBottom: 16, border: `2px solid ${step === 2 ? brandColor : 'transparent'}`
      }}>
        <span style={{ color: getStepColor(2), WebkitTextFillColor: getStepColor(2) }}>2</span>
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color: titleColor, marginBottom: 8 }}>{t('shareTab', 'Discovery')}</span>
      <p style={{ fontSize: 12, color: subTextColor, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
        {t('shareTabDesc', 'Select quality and share tab.')}
      </p>
      {active && (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Quality Dropdown */}
        <div style={{ position: 'relative', width: '100%', zIndex: 100 }}>
          <button
            ref={qualityBtnRef}
            onClick={(e) => { e.stopPropagation(); setShowQualityDropdown(!showQualityDropdown); }}
            style={{
              width: '100%', background: isLight ? '#fff' : 'rgba(255,255,255,0.05)',
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: isLight ? '#0f172a' : '#fff', cursor: 'pointer', outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={14} color={btnColor} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0f172a' : '#fff' }}>{t(qualityOptions[quality].labelKey, qualityOptions[quality].label)}</div>
                <div style={{ fontSize: 10, color: isLight ? '#94a3b8' : '#888', marginTop: 1 }}>{t(qualityOptions[quality].subKey, qualityOptions[quality].sub)}</div>
              </div>
            </div>
            <div style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${isLight ? '#94a3b8' : '#666'}` }} />
          </button>

          {showQualityDropdown && dropdownRect && createPortal(
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed', left: dropdownRect.left, width: dropdownRect.width,
                bottom: window.innerHeight - dropdownRect.top + 8,
                background: isLight ? '#fff' : '#16161c',
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, overflow: 'hidden', boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.08)' : '0 20px 40px rgba(0,0,0,0.6)',
                zIndex: 200000,
              }}
            >
              {Object.keys(qualityOptions).map(id => (
                <div
                  key={id}
                  onClick={() => { setQuality(id); setShowQualityDropdown(false); }}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: quality === id ? (isLight ? '#f1f5f9' : `${btnColor}18`) : 'transparent',
                    borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.04)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = quality === id ? (isLight ? '#f1f5f9' : `${btnColor}18`) : 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: quality === id ? 700 : 500, color: quality === id ? btnColor : (isLight ? '#0f172a' : '#fff') }}>{t(qualityOptions[id].labelKey, qualityOptions[id].label)}</div>
                    <div style={{ fontSize: 10, color: isLight ? '#94a3b8' : '#666', marginTop: 1 }}>{t(qualityOptions[id].subKey, qualityOptions[id].sub)}</div>
                  </div>
                  {quality === id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: btnColor }} />}
                </div>
              ))}
            </div>,
            document.body
          )}
        </div>

        <button
          onClick={handleShare}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${btnColor} 0%, ${btnColor}cc 100%)`,
            border: 'none', borderRadius: 14,
            padding: '14px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: `0 4px 20px ${btnColor}66`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            textTransform: 'uppercase', letterSpacing: '1px',
            color: '#ffffff', WebkitTextFillColor: '#ffffff'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 28px ${btnColor}88`; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=`0 4px 20px ${btnColor}66`; }}
        >
          <MonitorUp size={18} color="#fff" />
          <span style={{ color: '#fff', WebkitTextFillColor: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{t('startSharing', 'Start Sharing')}</span>
        </button>
      </div>
      )}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0,0,0,0.9)', zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(16px)', padding: isMobile ? '16px' : '24px'
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 50%, ${brandColor}${isLight ? '10' : '15'} 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />
      <div
        onClick={(e) => { e.stopPropagation(); setShowQualityDropdown(false); }}
        style={{
          background: modalBg,
          border: modalBorder, position: 'relative',
          borderRadius: isMobile ? 24 : 36, width: '100%', maxWidth: isMobile ? 420 : 680,
          display: 'flex', flexDirection: 'column',
          boxShadow: isLight ? '0 40px 100px rgba(0,0,0,0.1)' : `0 40px 120px rgba(0,0,0,0.9), 0 0 100px ${brandColor}10, inset 0 1px 1px rgba(255,255,255,0.05)`,
          fontFamily: "'Outfit',sans-serif",
          overflow: 'visible'
        }}
      >
        {/* Header Bar — top accent line, present and full-width at every breakpoint */}
        <div style={{ height: 4, width: '100%', flexShrink: 0, background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`, borderRadius: isMobile ? '24px 24px 0 0' : '36px 36px 0 0' }} />

        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: isMobile ? 14 : 20, right: isMobile ? 14 : 20, width: 36, height: 36,
            borderRadius: '50%', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)', border: 'none',
            color: isLight ? '#0f172a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background=isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background=isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)'}
        >
          <X size={18} />
        </button>

        <div style={{ padding: isMobile ? '36px 20px 28px' : '48px 50px 40px', overflow: 'visible' }}>

          <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 44 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: isMobile ? 26 : 42, fontWeight: 900, color: titleColor, letterSpacing: isMobile ? '-1px' : '-2px' }}>
              {t('watchPlatform', 'Watch {{name}}', { name: app.name }).split(app.name).map((part, index, arr) => {
                if (index === arr.length - 1) return part;
                return (
                  <React.Fragment key={index}>
                    {part}
                    <span style={{ color: brandColor, textShadow: `0 0 20px ${brandColor}40` }}>
                      {app.name}
                    </span>
                  </React.Fragment>
                );
              })}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 10 : 16 }}>
               <div style={{ height: 1, width: isMobile ? 32 : 60, background: `linear-gradient(90deg, transparent, ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'})` }} />
               <span style={{ fontSize: 10, fontWeight: 900, color: isLight ? '#94a3b8' : '#777', letterSpacing: '3px', textTransform: 'uppercase' }}>{t('twoStepSetup', 'Two Step Setup')}</span>
               <div style={{ height: 1, width: isMobile ? 32 : 60, background: `linear-gradient(90deg, ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}, transparent)` }} />
            </div>
          </div>

          {/* Mobile: compact stepper showing progress through the single visible panel below */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: getStepBg(1), color: getStepColor(1),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                border: `2px solid ${step === 1 ? brandColor : 'transparent'}`, transition: 'all 0.3s'
              }}>
                {step > 1 ? <CheckCircle2 size={13} color="#fff" /> : <span style={{ color: '#fff', WebkitTextFillColor: '#fff' }}>1</span>}
              </div>
              <div style={{ width: 32, height: 2, borderRadius: 2, background: step > 1 ? brandColor : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'), transition: 'background 0.3s' }} />
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: getStepBg(2), color: getStepColor(2),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                border: `2px solid ${step === 2 ? brandColor : 'transparent'}`, transition: 'all 0.3s'
              }}>
                <span style={{ color: getStepColor(2), WebkitTextFillColor: getStepColor(2) }}>2</span>
              </div>
            </div>
          )}

          {isMobile ? (
            // Sliding wizard: both panels sit side-by-side in a track twice the viewport
            // width; translateX shows exactly one at a time, animating between them.
            // The quality dropdown (Step 2 panel) is portaled to document.body so it's
            // unaffected by this clipping or the track's transform.
            <div style={{ overflow: 'hidden', position: 'relative' }}>
              <div style={{
                display: 'flex', width: '200%',
                transform: `translateX(${step === 1 ? '0%' : '-50%'})`,
                transition: 'transform 300ms ease-out'
              }}>
                <div style={{ width: '50%', flexShrink: 0, boxSizing: 'border-box', paddingRight: 6 }}>
                  {renderStep1Panel(true)}
                </div>
                <div style={{ width: '50%', flexShrink: 0, boxSizing: 'border-box', paddingLeft: 6 }}>
                  {renderStep2Panel(true)}
                </div>
              </div>
            </div>
          ) : (
            // Desktop/tablet: both panels visible side-by-side, non-current one dimmed
            <div style={{ display: 'flex', gap: 24, position: 'relative' }}>
              <div style={{ flex: 1 }}>{renderStep1Panel(step === 1)}</div>
              <div style={{ flex: 1 }}>{renderStep2Panel(step === 2)}</div>
            </div>
          )}

          <div style={{ marginTop: isMobile ? 24 : 40, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <Info size={14} color={isLight ? "#475569" : "#666"} />
            <span style={{ fontSize: 12, color: safetyTextColor, fontWeight: 500 }}>{t('streamSafelyNotice', 'Stream safely. We never store or access your personal data.')}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
