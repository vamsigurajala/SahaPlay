import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Download, CheckCircle2, X, ExternalLink } from 'lucide-react';
import { checkForAppUpdate, dismissAppUpdate, startFlexibleAppUpdate, openPlayStore } from '../lib/appUpdate';

// In-app Google Play Store update banner — Android (Play Store build) only.
// Mounted inside Navbar.jsx right before </nav>, so it renders directly under
// the top navigation bar on every page, and the fixed-position spacer expands
// automatically to accommodate it.
export default function AppUpdateBanner() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | installing | downloaded
  const [progressPct, setProgressPct] = useState(null);
  const [downloadedMB, setDownloadedMB] = useState(null);
  const [totalMB, setTotalMB] = useState(null);

  // Theme-awareness for light and dark modes
  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  });

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const recheck = useCallback(() => {
    checkForAppUpdate().then((result) => {
      if (result) setInfo(result);
    });
  }, []);

  useEffect(() => {
    recheck();
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [recheck]);

  if (!info) return null;

  const handleUpdate = async () => {
    setStatus('downloading');
    const started = await startFlexibleAppUpdate((state) => {
      if (typeof state?.bytesDownloaded === 'number' && state?.totalBytesToDownload > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((state.bytesDownloaded / state.totalBytesToDownload) * 100)));
        setProgressPct(pct);
        setDownloadedMB((state.bytesDownloaded / (1024 * 1024)).toFixed(1));
        setTotalMB((state.totalBytesToDownload / (1024 * 1024)).toFixed(1));
      }

      // INSTALL_STATUS_DOWNLOADED = 11
      if (state?.installStatus === 11) {
        setProgressPct(100);
        setStatus('downloaded');
      }
    });

    if (!started) {
      // User cancelled consent or start failed
      setStatus('idle');
    }
  };

  const handleDismiss = () => {
    dismissAppUpdate(info.availableVersionCode);
    setInfo(null);
  };

  // Styling palette depending on theme
  const containerBg = isLight
    ? 'linear-gradient(90deg, #f5f3ff 0%, #e0e7ff 50%, #ede9fe 100%)'
    : 'linear-gradient(90deg, #1e1b4b 0%, #2e1065 50%, #312e81 100%)';
  const borderBottomColor = isLight ? 'rgba(99, 102, 241, 0.25)' : 'rgba(167, 139, 250, 0.35)';
  const titleColor = isLight ? '#1e1b4b' : '#ffffff';
  const subtextColor = isLight ? '#4338ca' : 'rgba(255, 255, 255, 0.85)';
  const stayClass = isLight ? 'stay-color' : 'stay-white';

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 999,
        background: containerBg,
        borderBottom: `1px solid ${borderBottomColor}`,
        boxShadow: isLight ? '0 2px 10px rgba(99, 102, 241, 0.12)' : '0 4px 16px rgba(0,0,0,0.35)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {status === 'downloading' ? (
            <RefreshCw
              size={18}
              className={stayClass}
              style={{
                color: isLight ? '#4f46e5' : '#a855f7',
                flexShrink: 0,
                animation: 'sp-update-spin 1.2s linear infinite',
              }}
            />
          ) : status === 'downloaded' ? (
            <CheckCircle2
              size={18}
              className={stayClass}
              style={{ color: '#22c55e', flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isLight ? 'rgba(79, 70, 229, 0.15)' : 'rgba(139, 92, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Download size={15} style={{ color: isLight ? '#4338ca' : '#c084fc' }} className={stayClass} />
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className={stayClass}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: titleColor,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {status === 'downloading'
                ? `${t('appUpdateDownloading', 'Downloading update…')} ${progressPct != null ? `${progressPct}%` : ''}`
                : status === 'downloaded'
                ? t('appUpdateInstalling', 'Update downloaded! Refreshing app…')
                : t('appUpdateAvailable', 'A new version is available')}
            </div>

            {status === 'downloading' && (
              <div
                className={stayClass}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: subtextColor,
                  marginTop: 2,
                }}
              >
                {downloadedMB && totalMB
                  ? `${downloadedMB} MB / ${totalMB} MB`
                  : progressPct != null
                  ? `${progressPct}%`
                  : 'Syncing with Play Store…'}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {status === 'idle' && (
            <>
              <button
                onClick={handleUpdate}
                className="stay-white"
                style={{
                  background: isLight
                    ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  border: isLight ? 'none' : '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: isLight
                    ? '0 2px 8px rgba(79, 70, 229, 0.35)'
                    : '0 2px 10px rgba(99, 102, 241, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                  outline: 'none',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Download size={13} style={{ strokeWidth: 2.5 }} />
                <span>{t('appUpdateButton', 'Update')}</span>
              </button>

              <button
                onClick={openPlayStore}
                aria-label="Open in Google Play Store"
                title="Open in Google Play Store"
                className={stayClass}
                style={{
                  background: 'transparent',
                  border: isLight ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid rgba(255,255,255,0.2)',
                  color: isLight ? '#4338ca' : '#cbd5e1',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ExternalLink size={12} />
              </button>

              <button
                onClick={handleDismiss}
                aria-label={t('dismiss', 'Dismiss')}
                className={stayClass}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isLight ? '#64748b' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={16} />
              </button>
            </>
          )}

          {status === 'downloading' && (
            <div
              className={stayClass}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isLight ? '#4f46e5' : '#c084fc',
                padding: '4px 8px',
              }}
            >
              {progressPct != null ? `${progressPct}%` : '…'}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar Track during downloading or downloaded state */}
      {(status === 'downloading' || status === 'downloaded') && (
        <div
          style={{
            width: '100%',
            height: 5,
            borderRadius: 3,
            background: isLight ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPct ?? 0}%`,
              height: '100%',
              borderRadius: 3,
              background:
                status === 'downloaded'
                  ? '#22c55e'
                  : isLight
                  ? 'linear-gradient(90deg, #4f46e5, #7c3aed)'
                  : 'linear-gradient(90deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes sp-update-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
