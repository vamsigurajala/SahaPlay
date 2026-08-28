// MediaPermissionModal.jsx — mounted once, globally, in App.jsx. Listens for
// the 'media_permission_needed' event mediaPermissionGate.js's
// requestMediaAccess()/requestPhotoAccess() dispatch whenever a camera/mic-
// touching feature (a 1:1 call, joining a room, the AppSettings device-test
// previews) or a gallery/attachment button finds permission not yet granted
// on the Capacitor app — detail.kind ('media' | 'photos') picks which copy/
// icon/retry-function below. Replaces the old behavior of just
// toast.error()-ing "access is required" with a real way back to "allow it":
// a first tap re-runs the native permission request (Android can still show
// its own dialog at this point unless the user already denied it before),
// and if that still doesn't grant it, a second button deep-links to this
// app's Settings page — the only way left once Android stops showing its
// own dialog for an already-denied permission.
import { useEffect, useState } from 'react';
import { Video, Image as ImageIcon, Settings as SettingsIcon } from 'lucide-react';
import { ensureNativeMediaPermissions, ensureNativePhotoPermissions, openNativeAppSettings } from '../lib/nativeMedia';

const COPY = {
  media: {
    icon: Video,
    title: 'Camera & microphone access',
    body: 'SahaPlay needs camera and microphone access to make and answer calls, and for video in rooms.',
    deniedBody: 'Access is still turned off. Open Settings and allow Camera and Microphone for SahaPlay to continue.',
  },
  photos: {
    icon: ImageIcon,
    title: 'Photos & files access',
    body: 'SahaPlay needs access to your photos and files to attach them in chat.',
    deniedBody: 'Access is still turned off. Open Settings and allow Photos and videos for SahaPlay to continue.',
  },
};

export default function MediaPermissionModal() {
  return null;
}

  useEffect(() => {
    const handler = (e) => {
      setDeniedOnce(false);
      setKind(e.detail.kind || 'media');
      setResolveFn(() => e.detail.resolve);
    };
    window.addEventListener('media_permission_needed', handler);
    return () => window.removeEventListener('media_permission_needed', handler);
  }, []);

  if (!resolve) return null;
  const copy = COPY[kind] || COPY.media;
  const Icon = copy.icon;

  const finish = (granted) => {
    resolve(granted);
    setResolveFn(null);
  };

  const tryAgain = async () => {
    setBusy(true);
    const granted = kind === 'photos' ? await ensureNativePhotoPermissions() : await ensureNativeMediaPermissions();
    setBusy(false);
    if (granted) finish(true);
    else setDeniedOnce(true);
  };

  const goToSettings = async () => {
    setBusy(true);
    await openNativeAppSettings();
    setBusy(false);
    // The user has to leave the app to grant it in Settings, so there's no
    // "come back already granted" moment to catch here — resolve false and
    // let them re-tap whatever they were doing, which re-checks from
    // scratch and will now find it already granted.
    finish(false);
  };

  return (
    <div
      onClick={() => finish(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483600,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, background: '#14171F', borderRadius: 20,
          padding: '28px 24px 22px', textAlign: 'center', color: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Icon size={26} color="#818cf8" />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#fff' }}>
          {copy.title}
        </h3>
        <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)' }}>
          {deniedOnce ? copy.deniedBody : copy.body}
        </p>

        {!deniedOnce ? (
          <button
            onClick={tryAgain}
            disabled={busy}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: '#6366f1', color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, marginBottom: 10,
            }}
          >
            {busy ? 'Requesting…' : 'Allow Access'}
          </button>
        ) : (
          <button
            onClick={goToSettings}
            disabled={busy}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: '#6366f1', color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <SettingsIcon size={16} /> Open Settings
          </button>
        )}

        <button
          onClick={() => finish(false)}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
