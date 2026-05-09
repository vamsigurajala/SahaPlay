import React, { useState, useRef } from 'react';
import { X, PlayCircle, MonitorUp, Info, ArrowRight, CheckCircle2, ChevronRight, Settings } from 'lucide-react';

export default function GuidedShareModal({ app, onClose, onScreenshare }) {
  if (!app) return null;

  const [step, setStep] = useState(1);
  const [quality, setQuality] = useState('720p');
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const popupRef = useRef(null);

  const qualityOptions = {
    'auto': { label: 'Auto', width: undefined, height: undefined, frameRate: undefined },
    '360p': { label: '360p', width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
    '480p': { label: '480p', width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    '720p': { label: '720p', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    '1080p': { label: '1080p ✦', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
    'unlimited': { label: 'Unlimited ✦', width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 60 } }
  };

  const handleLaunch = () => {
    const width = 1200;
    const height = 800;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    popupRef.current = window.open(app.url || `https://${app.id}.com`, app.name, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    setStep(2);
  };

  const handleShare = () => {
    onClose();
    onScreenshare(qualityOptions[quality], popupRef.current, app);
  };

  const brandColor = app.brandColor || app.color || '#a855f7';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(16px)', padding: '24px'
      }}
    >
      <div 
        style={{ 
          position: 'absolute', inset: 0, 
          background: `radial-gradient(circle at 50% 50%, ${brandColor}15 0%, transparent 70%)`,
          pointerEvents: 'none'
        }} 
      />
      <div
        onClick={(e) => { e.stopPropagation(); setShowQualityDropdown(false); }}
        style={{
          background: '#0d0d12',
          border: '1px solid rgba(255,255,255,0.08)', position: 'relative',
          borderRadius: 36, width: '100%', maxWidth: 680,
          display: 'flex', flexDirection: 'column',
          boxShadow: `0 40px 120px rgba(0,0,0,0.9), 0 0 100px ${brandColor}10, inset 0 1px 1px rgba(255,255,255,0.05)`,
          fontFamily: "'Outfit',sans-serif",
          overflow: 'visible'
        }}
      >
        {/* Header Bar */}
        <div style={{ height: 4, width: '100%', background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />

        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20, width: 36, height: 36,
            borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: 'none',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
        >
          <X size={18} />
        </button>

        <div style={{ padding: '48px 50px 40px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-2px' }}>
              Watch <span style={{ 
                color: brandColor, 
                textShadow: `0 0 20px ${brandColor}40`
              }}>{app.name}</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
               <div style={{ height: 1, width: 60, background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.1))` }} />
               <span style={{ fontSize: 10, fontWeight: 900, color: '#777', letterSpacing: '3px', textTransform: 'uppercase' }}>Two Step Setup</span>
               <div style={{ height: 1, width: 60, background: `linear-gradient(90deg, rgba(255,255,255,0.1), transparent)` }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, position: 'relative' }}>
            
            {/* Step 1 Card */}
            <div style={{
              flex: 1, background: step === 1 ? 'rgba(255,255,255,0.03)' : 'transparent',
              border: `1px solid ${step === 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}`,
              borderRadius: 24, padding: 24, opacity: step === 1 ? 1 : 0.4,
              transition: 'all 0.4s', display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: '50%', background: step > 1 ? brandColor : '#1e1e2d',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, marginBottom: 16, border: `2px solid ${step === 1 ? brandColor : 'transparent'}`
              }}>
                {step > 1 ? <CheckCircle2 size={20} /> : '1'}
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Preparation</span>
              <p style={{ fontSize: 12, color: '#adadb8', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
                Launch and log in to your account.
              </p>
              {step === 1 ? (
                <button 
                  onClick={handleLaunch}
                  style={{
                    width: '100%', background: brandColor, color: '#fff', border: 'none', borderRadius: 14,
                    padding: '14px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: `0 12px 24px ${brandColor}40`, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 16px 32px ${brandColor}60`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=`0 12px 24px ${brandColor}40`; }}
                >
                  <PlayCircle size={18} /> Launch App <ChevronRight size={14} />
                </button>
              ) : (
                <div style={{ color: brandColor, fontSize: 12, fontWeight: 700 }}>Ready!</div>
              )}
            </div>

            {/* Step 2 Card */}
            <div style={{
              flex: 1, background: step === 2 ? 'rgba(255,255,255,0.03)' : 'transparent',
              border: `1px solid ${step === 2 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}`,
              borderRadius: 24, padding: 24, opacity: step === 2 ? 1 : 0.4,
              transition: 'all 0.4s', display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: '50%', background: step === 2 ? brandColor : '#1e1e2d',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, marginBottom: 16, border: `2px solid ${step === 2 ? brandColor : 'transparent'}`
              }}>2</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Discovery</span>
              <p style={{ fontSize: 12, color: '#adadb8', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
                Select quality and share tab.
              </p>
              {step === 2 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  
                  {/* Custom Pro Dropdown */}
                  <div style={{ position: 'relative', width: '100%', zIndex: 100 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowQualityDropdown(!showQualityDropdown); }}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Settings size={14} color={brandColor} />
                        {qualityOptions[quality].label}
                      </div>
                      <div style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid #666` }} />
                    </button>

                    {showQualityDropdown && (
                      <div style={{
                        position: 'absolute', bottom: '110%', left: 0, right: 0, 
                        background: '#16161c', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        animation: 'fadeInUp 0.2s ease'
                      }}>
                        {Object.keys(qualityOptions).map(id => (
                          <div
                            key={id}
                            onClick={() => { setQuality(id); setShowQualityDropdown(false); }}
                            style={{
                              padding: '12px 16px', fontSize: 13, color: quality === id ? brandColor : '#aaa',
                              fontWeight: quality === id ? 700 : 500, cursor: 'pointer', 
                              background: quality === id ? 'rgba(255,255,255,0.03)' : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.03)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = quality === id ? 'rgba(255,255,255,0.03)' : 'transparent'}
                          >
                            {qualityOptions[id].label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleShare}
                    style={{
                      width: '100%', background: '#fff', color: '#000', border: 'none', borderRadius: 14,
                      padding: '14px 0', fontSize: 13, fontWeight: 900, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      boxShadow: '0 12px 24px rgba(255,255,255,0.1)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 16px 32px rgba(255,255,255,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(255,255,255,0.1)'; }}
                  >
                    <MonitorUp size={18} /> Start Sharing
                  </button>
                </div>
              )}
            </div>

          </div>

          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <Info size={14} color="#666" />
            <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Stream safely. We never store or access your personal data.</span>
          </div>

        </div>
      </div>
    </div>
  );
}





