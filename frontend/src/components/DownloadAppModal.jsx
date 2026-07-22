import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Monitor, Apple, Download } from 'lucide-react';

// Published via .github/workflows/desktop-build.yml -> GitHub Releases.
const WINDOWS_INSTALLER_URL = 'https://github.com/vamsigurajala/SahaPlay/releases/download/desktop-v0.1.0/SahaPlay_0.1.0_x64-setup.exe';

const DownloadAppModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const platforms = [
    {
      key: 'windows',
      label: t('downloadAppWindows', 'Windows'),
      sub: t('downloadAppWindowsSub', '.exe installer'),
      Icon: Monitor,
      color: '#38bdf8',
      href: WINDOWS_INSTALLER_URL || null,
    },
    {
      key: 'mac',
      label: t('downloadAppMac', 'Mac'),
      sub: t('downloadAppComingSoon', 'Coming soon'),
      Icon: Apple,
      color: '#a1a1aa',
      href: null,
    },
  ];

  return (
    <div onClick={onClose} className="download-app-modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="download-app-modal-card">
        <div style={{ padding: '24px 24px 16px', borderBottom: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
            {t('downloadAppTitle', 'Get the SahaPlay App')}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLight ? '#64748b' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: '50%', backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 14, color: isLight ? '#475569' : '#9ca3af', lineHeight: 1.6, margin: 0 }}>
            {t('downloadAppSubtitle', 'Install SahaPlay as a native desktop app — same account, same rooms, its own window.')}
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            {platforms.map((platform) => {
              const { key, label, sub, color, href } = platform;
              const Icon = platform.Icon;
              const disabled = !href;
              const Tag = disabled ? 'div' : 'a';
              return (
                <Tag
                  key={key}
                  {...(!disabled ? { href, download: true } : {})}
                  style={{
                    flex: 1,
                    padding: '20px 16px',
                    borderRadius: 16,
                    border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    textDecoration: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'transform 0.15s, background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isLight ? `${color}2a` : `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color={color} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>{label}</span>
                  <span style={{ fontSize: 12, color: isLight ? '#475569' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {!disabled && <Download size={12} />}
                    {sub}
                  </span>
                </Tag>
              );
            })}
          </div>

          <p style={{ fontSize: 11.5, color: isLight ? '#64748b' : '#6b7280', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
            {t('downloadAppSmartScreenNote', "Windows may show an \"Unknown publisher\" warning on first launch — that's expected until the app is code-signed, not a sign of a problem.")}
          </p>
        </div>
      </div>

      <style>{`
        .download-app-modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 11000;
          padding: 16px;
          animation: fadeIn 0.2s ease-out;
        }
        html[data-theme='light'] .download-app-modal-overlay {
          background-color: rgba(15, 23, 42, 0.4) !important;
        }
        .download-app-modal-card {
          background-color: #141418;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          width: 100%;
          max-width: 460px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        html[data-theme='light'] .download-app-modal-card {
          background-color: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(226, 232, 240, 0.8) !important;
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.15) !important;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default DownloadAppModal;
