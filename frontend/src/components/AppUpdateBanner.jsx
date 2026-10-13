import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { checkForAppUpdate, dismissAppUpdate, startFlexibleAppUpdate } from '../lib/appUpdate';

// Groww-style "a new version is available" strip — Android (Play Store
// build) only, see lib/appUpdate.js. Mounted once inside Navbar.jsx, right
// before </nav>, so it renders directly under the app's own top bar on
// every page with zero per-page wiring, and — since it's INSIDE the same
// ref Navbar.jsx already measures for its fixed-position spacer — that
// spacer grows to reserve space for this banner too, automatically, the
// moment it mounts.
export default function AppUpdateBanner() {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | downloading | downloaded
  const [progressPct, setProgressPct] = useState(null);

  const recheck = useCallback(() => {
    checkForAppUpdate().then(result => { if (result) setInfo(result); });
  }, []);

  useEffect(() => {
    recheck();
    // nativeShell.js's initNativeResumeBridge rebroadcasts Capacitor's own
    // 'resume' lifecycle event as a plain 'focus' event, so this catches an
    // update that became available while the app was backgrounded without
    // needing its own native listener.
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [recheck]);

  if (!info || status === 'downloaded') return null;

  const handleUpdate = async () => {
    setStatus('downloading');
    const started = await startFlexibleAppUpdate((state) => {
      if (typeof state?.bytesDownloaded === 'number' && state?.totalBytesToDownload > 0) {
        setProgressPct(Math.min(100, Math.round((state.bytesDownloaded / state.totalBytesToDownload) * 100)));
      }
      // installStatus DOWNLOADED means lib/appUpdate.js has already kicked
      // off completeFlexibleUpdate() (install + restart) on its own — this
      // is purely cosmetic, so the banner doesn't flash back to its "Update"
      // button during the brief moment before the app actually restarts.
      if (state?.installStatus === 11) setStatus('downloaded');
    });
    if (!started) {
      // User dismissed Play Core's own download-consent dialog, or the
      // flow failed outright — let them try again rather than getting stuck
      // on a "Downloading…" label forever.
      setStatus('idle');
    }
  };

  const handleDismiss = () => {
    dismissAppUpdate(info.availableVersionCode);
    setInfo(null);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px', background: 'var(--brand-gradient)', color: '#fff',
    }}>
      <RefreshCw size={15} style={{ flexShrink: 0, animation: status === 'downloading' ? 'sp-update-spin 1.4s linear infinite' : 'none' }} />
      <style>{`@keyframes sp-update-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0 }}>
        {status === 'downloading'
          ? `${t('appUpdateDownloading', 'Downloading update…')}${progressPct != null ? ` ${progressPct}%` : ''}`
          : t('appUpdateAvailable', 'A new version is available')}
      </span>
      {status === 'idle' && (
        <button
          onClick={handleUpdate}
          className="stay-white"
          style={{
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)',
            color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 8,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {t('appUpdateButton', 'Update')}
        </button>
      )}
      {status === 'idle' && (
        <button
          onClick={handleDismiss}
          aria-label={t('dismiss', 'Dismiss')}
          className="stay-white"
          style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.85, cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 2 }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
