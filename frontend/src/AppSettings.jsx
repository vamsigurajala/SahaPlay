import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, ArrowLeft, Globe2, Mic, Video, Bell, BellOff, ChevronDown, Eye, EyeOff, MessageSquare, UserPlus, LogIn, LogOut as LogOutIcon, Volume2, VolumeX, Languages, MapPin, User as UserIcon, HelpCircle, Search, Settings, Lock, ShieldCheck, Image, FileText, Smile, HardDrive, Sparkles, Download, Check, Palette, Paperclip, Phone, Music, Upload, Trash2, Pause, BatteryWarning } from 'lucide-react';
import { APP_THEMES } from './data/appThemes';
import toast, { Toaster } from 'react-hot-toast';
import GlobalChatWidget from './components/GlobalChatWidget';
import SupportModal from './components/SupportModal';
import DownloadAppModal from './components/DownloadAppModal';
import { appCache } from './cache/appCache.js';
import { getFlagClass, getFlagClassFromName } from './utils/countryFlags.js';
import { getAvatarUrl } from './utils/avatarUtils';
import { API } from './lib/api';
import { getPersistedGcwOpen } from './utils/gcwPersist';
import { isTauriApp, isStandalonePWA, isCapacitorApp } from './lib/platform';
import { getTauriNotifyPermissionStatus, openWindowsNotificationSettings, sendTestDesktopNotification } from './lib/desktopNotify';
import { requestMediaAccess } from './lib/mediaPermissionGate';
import { ensureWebPushSubscription } from './lib/webPushSubscribe';
import { NOTIFICATION_TONE_LIST, playNotificationTone } from './lib/notificationSounds';
import { setNativeRingtonePreference, setNativeMessageTonePreference, isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations, openAutostartSettings } from './lib/nativeMedia';

// Minimum time the skeleton loader stays visible on first load, so the shimmer wave
// has time to actually be perceived instead of flashing by on fast (local) connections.
const MIN_SKELETON_MS = 500;

// Sentinel "device ids" for phone/tablet camera selection — see the matching
// comment on isMobileCameraDevice() below for why these exist instead of
// relying on enumerateDevices()'s real deviceIds on mobile.
const FACING_PREFIX = 'facing:';
const FACING_FRONT = FACING_PREFIX + 'user';
const FACING_BACK = FACING_PREFIX + 'environment';

// navigator.mediaDevices.enumerateDevices() is unreliable for telling front
// and back cameras apart on a lot of real Android phones/tablets — on some
// devices/WebViews it only ever surfaces ONE videoinput entry regardless of
// how many physical cameras exist, so "Back Camera" never appeared as a
// selectable option at all (this is exactly why CallContext.jsx's own
// in-call flipCamera() never used deviceId selection either — see its
// comment on facingMode — and does a plain facingMode getUserMedia request
// instead, which works reliably across devices). On mobile/tablet we mirror
// that: skip deviceId enumeration for the picker entirely and always offer
// a fixed Front/Back pair driven by facingMode. Desktop/web (real external
// webcams, no facingMode concept) keeps the existing enumerateDevices()
// dropdown unchanged.
function isMobileCameraDevice() {
  return isCapacitorApp() || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
}

// ─── Accent theme swatch ──────────────────────────────────────────────────
// Square tile (not a circle) with the theme's name always visible underneath,
// so picking one of 30 themes doesn't rely on a hover tooltip to tell them apart.
// Converts a kebab-case theme id (e.g. "ocean-blue") into its i18n key (e.g. "themeOceanBlue").
function themeNameKey(id) {
  return 'theme' + id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function ThemeSwatch({ themeOpt, isActive, onSelect, t }) {
  const displayName = t ? t(themeNameKey(themeOpt.id), themeOpt.name) : themeOpt.name;
  return (
    <button
      onClick={() => onSelect(themeOpt.id)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <div
        style={{
          position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 8,
          border: isActive ? '2px solid #fff' : '2px solid transparent',
          outline: isActive ? `2px solid ${themeOpt.accent1}` : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isActive ? `0 0 0 3px rgba(${themeOpt.accent1Rgb},0.25)` : '0 1px 4px rgba(0,0,0,0.25)',
          background: themeOpt.previewCss, transition: 'transform 0.15s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 600, color: isActive ? '#fff' : '#9ca3af', textAlign: 'center', lineHeight: 1.2, maxWidth: 60 }}>{displayName}</span>
    </button>
  );
}

// ─── Isolated camera preview ─────────────────────────────────────────────────
// Owns its own stream + video ref so parent re-renders never blank the preview.
function CameraPreview({ selectedCam, t, isLight, micDevices = [], onStaleDevice }) {
  const [active, setActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [camInfo, setCamInfo] = useState(null);
  const [measuredFps, setMeasuredFps] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Measure real-time FPS
  useEffect(() => {
    if (!active || !videoRef.current) return;
    
    let frameCount = 0;
    let lastTime = performance.now();
    let rVFCId;
    
    const measure = (now) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        setMeasuredFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = now;
      }
      if (videoRef.current && videoRef.current.requestVideoFrameCallback) {
        rVFCId = videoRef.current.requestVideoFrameCallback(measure);
      }
    };
    
    if (videoRef.current && videoRef.current.requestVideoFrameCallback) {
      rVFCId = videoRef.current.requestVideoFrameCallback(measure);
    }
    
    return () => {
      if (rVFCId && videoRef.current && videoRef.current.cancelVideoFrameCallback) {
        videoRef.current.cancelVideoFrameCallback(rVFCId);
      }
    };
  }, [active]);

  // Requests the given device (or the browser's default if camId is falsy),
  // falling back to the default device if a remembered deviceId has gone
  // stale (unplugged, browser profile reset, etc. — surfaces as
  // OverconstrainedError/NotFoundError, not a real permission denial).
  const acquireStream = async (camId) => {
    // Front/Back sentinel (see FACING_PREFIX above) — request by facingMode,
    // not deviceId. Exact-match first (guarantees the physical camera
    // actually flips), softening to a hint-only match if the device can't
    // satisfy "exact" but does have a usable camera in roughly that
    // direction — same two-step pattern CallContext.jsx's flipCamera uses.
    if (camId && camId.startsWith(FACING_PREFIX)) {
      const facing = camId.slice(FACING_PREFIX.length);
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } });
      } catch (err) {
        try {
          return await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        } catch (err2) {
          // Genuinely no camera facing that direction on this device (e.g. a
          // tablet with only a front camera) — same "fall back to whatever
          // default the device has" recovery as a stale real deviceId below.
          if (err2.name === 'OverconstrainedError' || err2.name === 'NotFoundError') {
            onStaleDevice?.();
            return await navigator.mediaDevices.getUserMedia({ video: true });
          }
          throw err2;
        }
      }
    }
    const constraints = { video: camId ? { deviceId: { exact: camId } } : true };
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (camId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        onStaleDevice?.();
        return await navigator.mediaDevices.getUserMedia({ video: true });
      }
      throw err;
    }
  };

  const bindStream = (stream) => {
    streamRef.current = stream;
    // Assign srcObject BEFORE setting state so the element already has a stream
    // when React re-renders and shows the video.
    const vid = videoRef.current;
    if (vid) {
      vid.srcObject = stream;
      vid.play().catch(() => {});
    }

    try {
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const w = settings.width || 0;
      const h = settings.height || 0;
      const fps = settings.frameRate || 0;
      const aspect = settings.aspectRatio || (h ? w / h : 0);

      let builtInMic = t ? t('noneLabel', 'None') : 'None';
      if (settings.groupId && micDevices.length > 0) {
        const mic = micDevices.find(m => m.groupId === settings.groupId);
        if (mic) builtInMic = mic.label || (t ? t('yesLabel', 'Yes') : 'Yes');
      }

      let standard = t ? t('unknownLabel', 'Unknown') : 'Unknown';
      if (h >= 2160) standard = '4K UHD';
      else if (h >= 1440) standard = 'QHD 1440p';
      else if (h >= 1080) standard = 'FHD 1080p';
      else if (h >= 720) standard = 'HD 720p';
      else if (h >= 480) standard = 'SD 480p';
      else if (h > 0) standard = t ? t('lowResLabel', 'Low Res') : 'Low Res';

      setCamInfo({
        name: track.label || (t ? t('unknownCamera', 'Unknown Camera') : 'Unknown Camera'),
        builtInMic,
        resolution: w && h ? `${w}×${h}` : (t ? t('unknownLabel', 'Unknown') : 'Unknown'),
        standard: standard,
        megaPixels: w && h ? ((w * h) / 1000000).toFixed(2) + ' MP' : (t ? t('unknownLabel', 'Unknown') : 'Unknown'),
        targetFps: fps,
        aspectRatio: aspect ? aspect.toFixed(2) : (t ? t('unknownLabel', 'Unknown') : 'Unknown'),
        streamType: 'video'
      });
    } catch (err) {
      console.error('Error reading camera info:', err);
    }
  };

  const reportCamError = (err) => {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      toast.error(t ? t('camAccessDenied', "Camera access denied — allow it in your browser's site settings") : "Camera access denied — allow it in your browser's site settings");
    } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      toast.error(t ? t('camNotFound', 'No camera found') : 'No camera found');
    } else if (err?.name === 'NotReadableError') {
      toast.error(t ? t('camInUse', 'Camera is already in use by another app') : 'Camera is already in use by another app');
    } else {
      toast.error(t ? t('camGenericError', 'Could not start camera') : 'Could not start camera');
    }
  };

  const start = async () => {
    if (isStarting || active) return;
    setIsStarting(true);
    try {
      // Native app: same permission gate call buttons/Room.jsx use — shows a
      // real retry/Open-Settings modal instead of a dead-end toast if the
      // camera isn't already allowed. No-op on plain web/PWA.
      if (!(await requestMediaAccess())) return;
      // Release any stale stream FIRST, before requesting the new one —
      // requesting a second camera stream while the first is still open
      // throws OverconstrainedError on many phones/mobile browsers even
      // when the other camera genuinely exists (only one getUserMedia video
      // stream at a time, regardless of which physical camera it's from —
      // same limitation Room.jsx's own flipCamera works around the same way).
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
        streamRef.current = null;
      }
      const stream = await acquireStream(selectedCam);
      bindStream(stream);
      setActive(true);
    } catch (err) {
      reportCamError(err);
    } finally {
      setIsStarting(false);
    }
  };

  // Switching the device dropdown used to only take effect the NEXT time
  // the preview was manually stopped and restarted — selecting "Camera 2
  // (back)" while the preview was already running visibly did nothing,
  // reading as "the back camera option doesn't work". Restarts with the
  // newly selected device immediately whenever it changes while active.
  // Bypasses start()'s own isStarting/active guard deliberately (calling
  // start() here would just no-op since active is still true) rather than
  // going through stop()+start(), which would race across two renders.
  const prevSelectedCamRef = useRef(selectedCam);
  useEffect(() => {
    if (prevSelectedCamRef.current === selectedCam) return;
    prevSelectedCamRef.current = selectedCam;
    if (!active) return;
    let cancelled = false;
    (async () => {
      setIsStarting(true);
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(tr => tr.stop());
          streamRef.current = null;
        }
        const stream = await acquireStream(selectedCam);
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
        bindStream(stream);
      } catch (err) {
        if (!cancelled) { reportCamError(err); setActive(false); }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCam]);

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setIsStarting(false);
    setCamInfo(null);
    setMeasuredFps(0);
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {active ? (
          <button className="test-btn" onClick={stop} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            <Video size={15} /> {t ? t('stopCamera', 'Stop Camera') : 'Stop Camera'}
          </button>
        ) : (
          <button className="test-btn" onClick={start} disabled={isStarting} style={{ background: isStarting ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.15)', color: isStarting ? '#059669' : '#10b981', cursor: isStarting ? 'wait' : 'pointer' }}>
            <Video size={15} /> {isStarting ? (t ? t('starting', 'Starting...') : 'Starting...') : (t ? t('startCamera', 'Start Camera') : 'Start Camera')}
          </button>
        )}
      </div>

      {/* Container with fixed size — video is ALWAYS display:block so browser never suspends tracks */}
      <div style={{ width: '100%', maxWidth: 380, aspectRatio: '16/9', background: '#000', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
        />
      </div>

      {active && camInfo && (
        <div style={{ marginTop: 16, maxWidth: 380, background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)', fontWeight: 600, fontSize: 13, color: isLight ? '#334155' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={14} color={isLight ? '#64748b' : '#aaa'} />
            {t ? t('webcamInfo', 'Webcam Information') : 'Webcam Information'}
          </div>
          <div style={{ padding: '8px 16px' }}>
            {[
              { label: t ? t('webcamNameLabel', 'Webcam Name') : 'Webcam Name', value: camInfo.name },
              { label: t ? t('builtinMicLabel', 'Built-in Microphone') : 'Built-in Microphone', value: camInfo.builtInMic },
              { label: t ? t('webcamResolutionLabel', 'Webcam Resolution') : 'Webcam Resolution', value: camInfo.resolution },
              { label: t ? t('videoStandardLabel', 'Video Standard') : 'Video Standard', value: camInfo.standard },
              { label: t ? t('webcamMegaPixelsLabel', 'Webcam MegaPixels') : 'Webcam MegaPixels', value: camInfo.megaPixels },
              { label: t ? t('frameRateLabel', 'Frame rate') : 'Frame rate', value: (measuredFps > 0 ? measuredFps : (camInfo.targetFps ? Math.round(camInfo.targetFps) : '--')) + ' FPS' },
              { label: t ? t('aspectRatioLabel', 'Aspect Ratio') : 'Aspect Ratio', value: camInfo.aspectRatio },
              { label: t ? t('streamTypeLabel', 'Stream Type') : 'Stream Type', value: camInfo.streamType }
            ].map((row, idx) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx < 7 ? (isLight ? '1px dashed #e2e8f0' : '1px dashed rgba(255,255,255,0.05)') : 'none', fontSize: 13 }}>
                <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{row.label}:</span>
                <span style={{ color: isLight ? '#0f172a' : '#f8fafc', fontWeight: 600, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-word' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
];

const AppSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const token = localStorage.getItem('watch_token');
  const myUsername = localStorage.getItem('watch_username');
  const isGuest = !token || token === 'null' || token === 'undefined' || localStorage.getItem('watch_is_guest') === 'true';
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);
  const isDesktopApp = isTauriApp();
  const standalone = isStandalonePWA();

  // Settings state
  // Cache-first, same reasoning as Profile.jsx's own-profile fix: this page's
  // skeleton is gated purely on `!settings`, and /api/settings was refetched
  // from scratch (no cache) on every visit — invisible on a warm connection,
  // but a long visible skeleton whenever the request is slow (e.g. the
  // Render backend cold-starting after being idle). Hydrating from the last
  // response shows real data immediately; fetchSettings() below silently
  // refreshes it.
  const [settings, setSettings] = useState(() => {
    if (isGuest) return null;
    try {
      const cached = localStorage.getItem(`app_settings_cache_${(myUsername || '').toLowerCase()}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const hasLoadedSettingsOnce = useRef(false);
  const [language, setLanguage] = useState(() => (localStorage.getItem('watch_language') || i18n.language || 'en').split('-')[0].toLowerCase());
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [showCountry, setShowCountry] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('watch_theme') || 'dark');
  const [accentTheme, setAccentTheme] = useState(() => localStorage.getItem('watch_accent_theme') || 'default');
  const isLight = theme === 'light';
  const [notifyApp, setNotifyApp] = useState(true);
  const [notifyJoin, setNotifyJoin] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyFriendRequests, setNotifyFriendRequests] = useState(true);
  const [notifyLeave, setNotifyLeave] = useState(true);
  const [notifyJoinRequests, setNotifyJoinRequests] = useState(true);
  const [notifyCalls, setNotifyCalls] = useState(true);
  // null = not checked yet (or not on Capacitor) — only render the fix-it
  // banner once we actually know the device is exempting the app, since a
  // "fix background notifications" nag would be pure noise for the many
  // users the OEM already exempts by default.
  const [batteryOptIgnoring, setBatteryOptIgnoring] = useState(null);
  const [notifySound, setNotifySound] = useState('chime');
  const [ringtonePath, setRingtonePath] = useState(null);
  const [ringtoneUploading, setRingtoneUploading] = useState(false);
  const [previewingTone, setPreviewingTone] = useState(null);
  const ringtonePreviewRef = useRef(null);
  const [browserNotifPermission, setBrowserNotifPermission] = useState(
    (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'unsupported'
  );
  // The plain Notification.permission above isn't meaningful inside the
  // Tauri desktop app (see desktopNotify.js) — real status has to come from
  // the native plugin instead, which is the only thing that actually knows
  // whether Windows' own notification toggle for SahaPlay is on.
  const [desktopNotifyStatus, setDesktopNotifyStatus] = useState(null);
  useEffect(() => {
    if (!isTauriApp()) return;
    const checkStatus = () => { getTauriNotifyPermissionStatus().then(setDesktopNotifyStatus).catch(() => {}); };
    checkStatus();
    // "Open Settings" sends the user out to the Windows Settings app to flip
    // the toggle there — there's no callback for that, so re-check on window
    // focus (the user alt-tabbing/returning from Settings) instead of only
    // ever checking once on mount, which would otherwise leave the "off"
    // hint showing forever until the next full app restart.
    window.addEventListener('focus', checkStatus);
    return () => window.removeEventListener('focus', checkStatus);
  }, []);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [openSection, setOpenSection] = useState('general');
  const [expiryReminders, setExpiryReminders] = useState(() => localStorage.getItem('expiry_reminders') !== 'false');
  const [profile, setProfile] = useState(() => {
    const isG = !token || token === 'null' || token === 'undefined' || localStorage.getItem('watch_is_guest') === 'true';
    if (isG) {
      return {
        id: 0,
        username: localStorage.getItem('watch_username') || 'guest',
        displayName: 'Guest User',
        avatarPath: null,
        isGuest: true
      };
    }
    try {
      const username = localStorage.getItem('watch_username');
      const cached = username ? localStorage.getItem(`profile_cache_${username.toLowerCase()}`) : null;
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [watchRole, setWatchRole] = useState(localStorage.getItem('watch_role') || 'user');
  const isAdminRole = ['super_admin', 'admin', 'moderator', 'support'].includes(watchRole);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(getPersistedGcwOpen);
  const [recentChats, setRecentChats] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; }
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    try {
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      return Object.values(counts).reduce((a, b) => a + b, 0);
    } catch { return 0; }
  });

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isGuest) return;
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) { localStorage.setItem('watch_role', d.role); setWatchRole(d.role); } })
      .catch(() => {});
  }, []);

  const ReactIsAwesome = React; // just dummy not to conflict
  const navIconsRef = ReactIsAwesome.useRef(null);
  const chatWidgetRef = ReactIsAwesome.useRef(null);

  useEffect(() => {
    toast.remove(); // Fully purge all toasts from the global store (prevents replay by this page's Toaster)
    const handleClickOutside = (e) => {
      // Don't close if clicking inside the nav icons area OR inside the chat widget itself
      const inNavArea = navIconsRef.current && navIconsRef.current.contains(e.target);
      const inChatWidget = chatWidgetRef.current && chatWidgetRef.current.contains(e.target);
      if (!inNavArea && !inChatWidget) {
        setShowSearch(false);
        setShowNotifications(false);
        setShowUserMenu(false);
        // Only close showRecentChats (which drives isOpen on widget) if the click is outside the widget
        setShowRecentChats(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Unread message tracking ──
  useEffect(() => {
    if (isGuest || !token) return;
    const getLastSeen = () => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } };
    const checkUnread = async () => {
      try {
        const lastSeen = getLastSeen();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        const counts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = chat.id || chat.partner;
          if (chat.unread && chat.unread > 0) {
            counts[chatKey] = chat.unread;
            total += chat.unread;
            localCounts[chatKey] = chat.unread;
          } else {
            delete localCounts[chatKey];
          }
        });
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
        setUnreadCounts(counts);
        setTotalUnread(total);
      } catch {}
    };
    checkUnread();
    const inv = setInterval(checkUnread, 5000);
    return () => clearInterval(inv);
  }, [token, isGuest]);

  const handleNewMessage = useCallback((partner, msg) => {
    const chatKey = partner;

    // Check if muted
    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}
    
    if (isMuted) return;

    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, []);

  const handleMarkRead = useCallback((chatId) => {
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    lastSeen[chatId] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    delete localCounts[chatId];
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setTotalUnread(prev => Math.max(0, prev - (unreadCounts[chatId] || 1)));
  }, [unreadCounts]);

  useEffect(() => {
    const fetchRequests = () => {
      if (isGuest || !token) return;
      fetch(`${API}/api/follow/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setFollowRequests(d); }).catch(() => {});
    };
    fetchRequests();
    const inv = setInterval(fetchRequests, 3000);
    window.addEventListener('follow_status_updated', fetchRequests);
    return () => {
      clearInterval(inv);
      window.removeEventListener('follow_status_updated', fetchRequests);
    };
  }, [token]);

  const handleAllowRequest = async (requestingUser, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}/accept`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (!d.error) {
         toast.success(`Accepted ${requestingUser}'s follow request`);
         setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, status: 'accepted' } : u));
      }
    } catch {}
  };

  const handleFollowBack = async (requestingUser, e) => {
    e.stopPropagation();
    // Optimistically update UI immediately so button changes to "Request Sent"
    setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: 'pending' } : u));
    try {
      const r = await fetch(`${API}/api/follow/${requestingUser}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (d.error) {
        toast.error(d.error);
        // Revert optimistic update on error
        setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
      } else {
        toast.success(`Follow request sent to ${requestingUser}!`);
        window.dispatchEvent(new Event('follow_status_updated'));
      }
    } catch {
      // Revert on network error
      setFollowRequests(prev => prev.map(u => u.username === requestingUser ? { ...u, myFollowStatus: null } : u));
    }
  };


  // Camera / Mic test
  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  const [micDevices, setMicDevices] = useState([]);
  const [camDevices, setCamDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState(() => localStorage.getItem('watch_selected_mic') || '');
  const [selectedCam, setSelectedCam] = useState(() => localStorage.getItem('watch_selected_cam') || '');
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const micCanvasRef = useRef(null);

  const fetchSettings = useCallback(() => {
    const isInitialLoad = !hasLoadedSettingsOnce.current;
    const startedAt = Date.now();
    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API}/api/settings`, { headers })
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        const apply = () => {
          hasLoadedSettingsOnce.current = true;
          setSettings(data);
          if (!isGuest && myUsername) {
            try { localStorage.setItem(`app_settings_cache_${myUsername.toLowerCase()}`, JSON.stringify(data)); } catch {}
          }
          setLanguage((data.language || 'en').split('-')[0].toLowerCase());
          setCountry(data.country || '');
          setCountryCode(data.country_code || '');
          setShowCountry(data.showCountry === 1 || data.showCountry === true);
          const appEnabled = data.notifyApp === 1 || data.notifyApp === true;
          setNotifyApp(appEnabled);
          setNotifyJoin(data.notifyJoin === 1 || data.notifyJoin === true);
          const messagesEnabled = data.notifyMessages === 1 || data.notifyMessages === true;
          setNotifyMessages(messagesEnabled);
          const friendRequestsEnabled = data.notifyFriendRequests === 1 || data.notifyFriendRequests === true;
          setNotifyFriendRequests(friendRequestsEnabled);
          setNotifyLeave(data.notifyLeave === 1 || data.notifyLeave === true);
          setNotifyJoinRequests(data.notifyJoinRequests === 1 || data.notifyJoinRequests === true);
          const callsEnabled = data.notifyCalls === 1 || data.notifyCalls === true;
          setNotifyCalls(callsEnabled);
          // Mirrored into localStorage so CallContext.jsx/GlobalChatWidget.jsx
          // (neither has a settings-fetch of its own) can read these
          // synchronously — notifyApp is the master switch both of them also
          // check alongside their own specific category.
          try {
            localStorage.setItem('notifyApp', String(appEnabled));
            localStorage.setItem('notifyMessages', String(messagesEnabled));
            localStorage.setItem('notifyCalls', String(callsEnabled));
            localStorage.setItem('notifyFriendRequests', String(friendRequestsEnabled));
          } catch {}
          setRingtonePath(data.ringtonePath || null);
          setNotifySound(data.notifySound || 'chime');
          // Same mirroring as notifyCalls above — CallContext.jsx (custom
          // ringtone on incoming calls) and GlobalChatWidget.jsx (message
          // tone) both read these synchronously off localStorage rather
          // than doing their own settings fetch.
          try {
            if (data.ringtonePath) localStorage.setItem('watch_ringtone_url', data.ringtonePath);
            else localStorage.removeItem('watch_ringtone_url');
            localStorage.setItem('watch_notify_sound', data.notifySound || 'chime');
          } catch {}
          // Also mirrors into native SharedPreferences on Android (no-op
          // elsewhere) — see setNativeRingtonePreference's own comment for
          // why IncomingCallActivity.java needs its own copy of this.
          setNativeRingtonePreference(data.ringtonePath || '');
          setNativeMessageTonePreference(data.notifySound || 'chime');
        };
        const remaining = isInitialLoad ? MIN_SKELETON_MS - (Date.now() - startedAt) : 0;
        if (remaining > 0) setTimeout(apply, remaining);
        else apply();
      })
      .catch(() => toast.error('Failed to load settings'));

    if (isGuest || !token) return;

    fetch(`${API}/api/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        try { if (data?.username) localStorage.setItem(`profile_cache_${data.username.toLowerCase()}`, JSON.stringify(data)); } catch {}
      })
      .catch(() => {});
  }, [token, isGuest]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Checked once on mount, not re-checked reactively — the user has to leave
  // this screen to go grant it via the system dialog anyway, so re-checking
  // on window focus (App.jsx already tracks that elsewhere) would just be
  // extra plumbing for a value that only realistically changes right after
  // the user taps the banner's own button below.
  useEffect(() => {
    if (!isCapacitorApp()) return;
    isIgnoringBatteryOptimizations().then(setBatteryOptIgnoring);
  }, []);

  const fixBackgroundNotifications = async () => {
    await requestIgnoreBatteryOptimizations();
    // Re-check shortly after returning from the system dialog — there's no
    // callback/promise resolution tied to the user's actual choice, just the
    // activity result of having shown it.
    setTimeout(() => { isIgnoringBatteryOptimizations().then(setBatteryOptIgnoring); }, 1500);
  };

  useEffect(() => {
    if (window.location.hash === '#privacy-storage') {
      setOpenSection('privacy');
      setTimeout(() => {
        requestAnimationFrame(() => {
          document.getElementById('privacy-storage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }, 450);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    const t = setTimeout(() => {
      fetch(`${API}/api/users/search?q=${searchQuery}`, { headers })
        .then(r => r.json()).then(setSearchResults).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, token, isGuest]);

  useEffect(() => {
    if (showRecentChats) {
      if (isGuest || !token) return;
      fetch(`${API}/api/chats/recent`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(d => { if(Array.isArray(d)) setRecentChats(d); else setRecentChats([]); }).catch(() => {});
    }
  }, [showRecentChats, token, isGuest]);

  // Enumerate devices
  const updateDevices = useCallback(async (forceRequest = false, type = 'both') => {
    try {
      if (forceRequest) {
        const constraints = {};
        if (type === 'audio' || type === 'both') constraints.audio = true;
        if (type === 'video' || type === 'both') constraints.video = true;
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach(t => t.stop());
      }
      
      const devices = await navigator.mediaDevices?.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      // See isMobileCameraDevice()'s comment — on phones/tablets, replace
      // whatever enumerateDevices() found (often just one entry, or two
      // indistinguishable ones) with a fixed Front/Back pair driven by
      // facingMode instead, which is what actually reflects real hardware
      // there. Desktop/web keeps the real enumerated device list.
      const cams = isMobileCameraDevice()
        ? [
            { deviceId: FACING_FRONT, label: t ? t('frontCamera', 'Front Camera') : 'Front Camera' },
            { deviceId: FACING_BACK, label: t ? t('backCamera', 'Back Camera') : 'Back Camera' },
          ]
        : devices.filter(d => d.kind === 'videoinput');

      setMicDevices(mics);
      setCamDevices(cams);

      // Auto-select first device if none selected
      if (mics.length > 0 && !selectedMic) {
        const d = mics[0].deviceId;
        setSelectedMic(d);
        localStorage.setItem('watch_selected_mic', d);
      }
      if (cams.length > 0 && !selectedCam) {
        const d = cams[0].deviceId;
        setSelectedCam(d);
        localStorage.setItem('watch_selected_cam', d);
      }
    } catch (err) {
      console.error('Error updating devices:', err);
    }
  }, [selectedMic, selectedCam]);

  useEffect(() => {
    // We only fetch devices initially WITHOUT triggering a prompt.
    // This avoids accessing camera/mic immediately on page load.
    updateDevices(false);
  }, [updateDevices]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const saveSetting = (key, value) => {
    // Optimistically update settings state
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);

    // Direct-write the update into client-side appCache
    try {
      const cached = appCache.getData('/api/settings');
      if (cached) {
        appCache.set('/api/settings', { ...cached, [key]: value }, 10 * 60_000);
      }
    } catch (e) {
      console.error('Error writing to appCache:', e);
    }

    const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API}/api/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ [key]: value })
    }).then(r => r.json()).then(data => {
      if (data.error) toast.error(data.error);
    }).catch(() => toast.error('Failed to save'));
  };

  // Language change
  const handleLangChange = (code) => {
    const normalized = code.split('-')[0].toLowerCase();
    setLanguage(normalized);
    setShowLangDropdown(false);
    i18n.changeLanguage(normalized);
    localStorage.setItem('watch_language', normalized);
    saveSetting('language', normalized);
    // Do NOT dispatch 'settings_changed' here — App.jsx's listener re-fetches
    // /api/settings and re-applies whatever language it finds. Since the PUT
    // above is fire-and-forget, that GET can race ahead of it and read back the
    // pre-change language, silently reverting the switch the user just made
    // (this was the "have to click twice" bug). The language is already fully
    // applied locally above, so no resync is needed.
    toast.success('Language updated!');
  };

  const handleLogout = () => {
    clearUserSession();
    // Explicit redirect rather than reload() — reload() re-fetches whatever
    // (possibly protected) route the user was on, which then has to bounce
    // to /login itself, an extra hop that read as "logout didn't take
    // effect" until that second redirect landed.
    window.location.href = '/login';
  };

  // Country toggle
  const handleShowCountryToggle = () => {
    const next = !showCountry;
    setShowCountry(next);
    saveSetting('showCountry', next ? 1 : 0);
  };

  // Theme toggle
  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('watch_theme', next);
    window.dispatchEvent(new Event('theme_changed'));
  };

  // Accent color theme — independent axis from light/dark above (App.jsx's
  // accent-theme effect applies it via CSS custom properties).
  const handleAccentThemeSelect = (themeId) => {
    setAccentTheme(themeId);
    localStorage.setItem('watch_accent_theme', themeId);
    window.dispatchEvent(new Event('accent_theme_changed'));
  };

  // Notification toggles
  const toggleNotifSetting = (key, current, setter) => {
    const next = !current;
    setter(next);
    saveSetting(key, next ? 1 : 0);
    // notifyApp/notifyMessages/notifyFriendRequests are mirrored into
    // localStorage (same as notifyCalls below) so CallContext.jsx/
    // GlobalChatWidget.jsx — neither has a settings-fetch of its own — see
    // the change immediately, without needing a reload. Harmless no-op
    // write for every other key.
    if (key === 'notifyApp' || key === 'notifyMessages' || key === 'notifyFriendRequests') {
      try { localStorage.setItem(key, String(next)); } catch {}
    }
  };

  // Same as toggleNotifSetting, plus mirroring into localStorage — calls are
  // the one notification type CallContext.jsx actually reads back out (it
  // has no settings-fetch of its own, so this is the only way it can see the
  // setting change without a page reload).
  const toggleCallNotifSetting = () => {
    const next = !notifyCalls;
    setNotifyCalls(next);
    saveSetting('notifyCalls', next ? 1 : 0);
    try { localStorage.setItem('notifyCalls', String(next)); } catch {}
    // Turning this ON is a real click, so it's the one place in the app that
    // can actually get the browser to show its OS notification-permission
    // prompt (see requestBrowserCallAlerts's own comment for why the
    // automatic request CallContext.jsx fires on every page load doesn't
    // work — browsers silently suppress permission requests that aren't
    // tied to a user gesture like this one).
    if (next) requestBrowserCallAlerts({ silent: true });
  };

  const handleToneSelect = (toneId) => {
    setNotifySound(toneId);
    saveSetting('notifySound', toneId);
    try { localStorage.setItem('watch_notify_sound', toneId); } catch {}
    setNativeMessageTonePreference(toneId);
  };

  const previewTone = (toneId) => {
    setPreviewingTone(toneId);
    playNotificationTone(toneId);
    setTimeout(() => setPreviewingTone(null), 700);
  };

  const ringtoneInputRef = useRef(null);
  const handleRingtoneUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets picking the same file again re-fire onChange
    if (!file) return;
    // Soft duration guidance rather than a hard server-side check (parsing
    // real audio duration needs a decoder, not worth it for a personal
    // settings upload) — reads the file's own metadata via a throwaway
    // <audio> element before ever uploading it.
    const durationOk = await new Promise((resolve) => {
      const probe = document.createElement('audio');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => resolve(!probe.duration || probe.duration <= 75);
      probe.onerror = () => resolve(true); // can't tell — let the server's size cap be the real gate
      probe.src = URL.createObjectURL(file);
    });
    if (!durationOk) {
      toast.error(t('ringtoneTooLong', 'Please choose a clip around a minute or shorter'));
      return;
    }
    setRingtoneUploading(true);
    try {
      const form = new FormData();
      form.append('ringtone', file);
      const res = await fetch(`${API}/api/settings/ringtone`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setRingtonePath(data.ringtonePath);
      try { localStorage.setItem('watch_ringtone_url', data.ringtonePath); } catch {}
      setNativeRingtonePreference(data.ringtonePath);
      toast.success(t('ringtoneSaved', 'Ringtone saved'));
    } catch (err) {
      toast.error(err.message || t('ringtoneUploadFailed', 'Could not upload that file'));
    } finally {
      setRingtoneUploading(false);
    }
  };

  const handleRingtoneRemove = async () => {
    try {
      await fetch(`${API}/api/settings/ringtone/remove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {}
    setRingtonePath(null);
    try { localStorage.removeItem('watch_ringtone_url'); } catch {}
    setNativeRingtonePreference('');
  };

  const previewRingtone = () => {
    if (!ringtonePath) return;
    if (!ringtonePreviewRef.current) ringtonePreviewRef.current = new Audio();
    const el = ringtonePreviewRef.current;
    if (!el.paused) { el.pause(); el.currentTime = 0; setPreviewingTone(null); return; }
    el.src = ringtonePath;
    el.play().catch(() => {});
    setPreviewingTone('__ringtone__');
    el.onended = () => setPreviewingTone(null);
  };

  // Real, gesture-backed request for OS-level call notifications on the
  // web/desktop app — as opposed to CallContext.jsx's automatic call to the
  // same underlying API on every socket connect (page load), which fires
  // with no click behind it at all. Chrome (and other browsers) treat a
  // gesture-less Notification.requestPermission() as spammy: it either shows
  // a tiny, easy-to-miss address-bar chip instead of a real prompt, or gets
  // silently ignored outright — so users who never happened to notice that
  // chip were never actually asked, and permission stayed stuck on
  // 'default' forever with no visible sign anything was wrong. Wiring an
  // explicit ask to this button (and to turning the toggle on above) gives
  // the browser a genuine click to attribute the prompt to.
  const requestBrowserCallAlerts = async ({ silent } = {}) => {
    if (isCapacitorApp() || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      setBrowserNotifPermission('granted');
      ensureWebPushSubscription(token);
      if (!silent) toast.success(t('browserAlertsAlreadyOn', 'Browser call alerts are already on'));
      return;
    }
    if (Notification.permission === 'denied') {
      setBrowserNotifPermission('denied');
      if (!silent) toast.error(t('browserAlertsBlocked', "Notifications are blocked for this site in your browser settings — enable them there, then reload the page."));
      return;
    }
    const result = await Notification.requestPermission();
    setBrowserNotifPermission(result);
    if (result === 'granted') {
      ensureWebPushSubscription(token);
      if (!silent) toast.success(t('browserAlertsEnabled', 'Browser call alerts enabled'));
    } else if (!silent) {
      toast.error(t('browserAlertsDismissed', "Browser alerts weren't enabled"));
    }
  };

  // Native app (Android/tablet) equivalent of sendTestDesktopNotification —
  // a local in-page Notification there wouldn't prove anything (FCM/system
  // tray is the actual delivery path a real call/message push uses), so this
  // round-trips through the backend's POST /api/push/test, which sends a
  // real push to whatever device tokens are registered for this account.
  const sendTestPushNotification = async () => {
    try {
      const headers = (!isGuest && token) ? { 'Authorization': `Bearer ${token}` } : {};
      const r = await fetch(`${API}/api/push/test`, { method: 'POST', headers });
      const data = await r.json().catch(() => ({}));
      if (data.error) toast.error(data.error);
      // No success toast here on Capacitor — the real push notification IS
      // the confirmation, arriving moments later. Showing both read as two
      // separate, slightly confusing signals for what's meant to be one
      // test. Plain browser/Tauri still get the toast since that path's
      // "test" already happens via a synchronous in-page Notification call
      // (sendTestDesktopNotification), not a round-tripped push.
    } catch {
      toast.error(t('testNotifFailed', 'Could not send test notification'));
    }
  };

  const testNotifBtnStyle = {
    marginTop: 6, background: 'none', border: 'none', padding: 0,
    color: 'var(--brand-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    textDecoration: 'underline',
  };

  // Shared by the Call and Message notification rows below — platform
  // decides whether "test" means a real backend push (Capacitor: the only
  // way to actually confirm FCM + OS notification permission work) or a
  // local in-page Notification (plain browser/Tauri, where that IS the real
  // delivery mechanism for a foreground tab).
  const renderTestNotifButton = () => {
    if (isCapacitorApp()) {
      return (
        <button onClick={sendTestPushNotification} style={testNotifBtnStyle}>
          {t('sendTestNotif', 'Send a test notification')}
        </button>
      );
    }
    if (isDesktopApp) {
      if (desktopNotifyStatus !== 'granted') return null;
      return (
        <button
          onClick={() => sendTestDesktopNotification(t('testNotifTitle', 'Test notification'), t('testNotifBody', 'This is what call and message alerts look like'))}
          style={testNotifBtnStyle}
        >
          {t('sendTestNotif', 'Send a test notification')}
        </button>
      );
    }
    if (browserNotifPermission !== 'granted') return null;
    return (
      <button
        onClick={() => sendTestDesktopNotification(t('testNotifTitle', 'Test notification'), t('testNotifBody', 'This is what call and message alerts look like'))}
        style={testNotifBtnStyle}
      >
        {t('sendTestNotif', 'Send a test notification')}
      </button>
    );
  };

  // Mic test
  const startMicTest = async () => {
    try {
      if (!(await requestMediaAccess())) return;
      let stream;
      try {
        const constraints = { audio: selectedMic ? { deviceId: { exact: selectedMic } } : true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // A remembered device ID can go stale (unplugged, browser profile
        // reset, etc.) and throws OverconstrainedError/NotFoundError rather
        // than a real permission denial — fall back to the default device
        // instead of surfacing a misleading "access denied" error.
        if (selectedMic && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setSelectedMic('');
          localStorage.removeItem('watch_selected_mic');
        } else {
          throw err;
        }
      }
      setMicStream(stream);
      setMicTesting(true);
      
      // If we didn't have labels before, we have them now. Refresh the list.
      if (!micDevices.some(d => d.label)) {
        updateDevices(false);
      }
      
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > peak) peak = dataArray[i];
        }
        
        const vol = Math.min(100, (peak / 255) * 100);
        setMicLevel(vol);

        if (micCanvasRef.current) {
          const canvas = micCanvasRef.current;
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          
          const barWidth = (w / 40); // focus on vocal freq
          let x = 0;
          
          for(let i = 0; i < 40; i++) {
            const barHeight = (dataArray[i] / 255) * h;
            
            // Dynamic color based on loudness
            if (vol > 70) ctx.fillStyle = '#10b981';
            else if (vol > 30) ctx.fillStyle = '#f59e0b';
            else ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--brand-1').trim() || '#6366f1';

            // Draw wave centered vertically
            const y = (h - barHeight) / 2;
            
            // Draw rounded bar
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth - 2, barHeight || 2, 2);
            ctx.fill();
            
            x += barWidth;
          }
        }
        
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        toast.error(t ? t('micAccessDenied', "Microphone access denied — allow it in your browser's site settings") : "Microphone access denied — allow it in your browser's site settings");
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        toast.error(t ? t('micNotFound', 'No microphone found') : 'No microphone found');
      } else if (err?.name === 'NotReadableError') {
        toast.error(t ? t('micInUse', 'Microphone is already in use by another app') : 'Microphone is already in use by another app');
      } else {
        toast.error(t ? t('micGenericError', 'Could not start microphone') : 'Could not start microphone');
      }
    }
  };

  const stopMicTest = () => {
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    setMicStream(null);
    setMicTesting(false);
    setMicLevel(0);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };


  const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // A plain `transition: background` between a solid color and a gradient
  // can't actually interpolate — the browser just snaps at the end, no
  // matter the declared duration, which is why this read as un-smooth
  // despite already having a transition on it. Layering the gradient as a
  // separate element and cross-fading its opacity (which DOES interpolate)
  // fixes that; the knob's own slide was already smooth and is unchanged.
  // Notification rows: tapping a row's title shows its full description
  // (some don't fit on the row's forced single line — see .notif-desc)
  // and tapping it again collapses back — independent per row, not tied
  // to that row's on/off Toggle.
  const [expandedNotifRows, setExpandedNotifRows] = useState(() => new Set());
  const toggleNotifRowExpanded = (id) => setExpandedNotifRows(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const NotifRowText = ({ id, title, titleColor = '#fff', titleWeight = 500, titleSize = 14, desc, descColor = '#666' }) => {
    const isExpanded = expandedNotifRows.has(id);
    return (
      <div style={{ minWidth: 0 }}>
        <div
          onClick={() => toggleNotifRowExpanded(id)}
          style={{ color: titleColor, fontWeight: titleWeight, fontSize: titleSize, cursor: 'pointer' }}
        >
          {title}
        </div>
        <div className={isExpanded ? undefined : 'notif-desc'} style={{ color: descColor, fontSize: 12 }}>
          {desc}
        </div>
      </div>
    );
  };

  const Toggle = ({ on, onToggle, disabled }) => (
    <button className={`custom-toggle ${on ? 'toggle-on' : 'toggle-off'}`} onClick={onToggle} disabled={disabled} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--brand-gradient)', opacity: on ? 1 : 0, transition: 'opacity 0.25s ease' }} />
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 25 : 3, transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 1 }} />
    </button>
  );

  const toggleSection = (sec) => setOpenSection(p => p === sec ? null : sec);

  if (!settings) {
    return (
      <div style={{ minHeight: '100vh', background: isLight ? '#f7fafc' : '#0a0a0f', color: isLight ? '#111' : '#fff' }}>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -450px 0; }
            100% { background-position: 450px 0; }
          }
          .sk-shim {
            background: ${isLight ? 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)' : 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)'} !important;
            background-size: 900px 100% !important;
            animation: shimmer 1.6s infinite linear !important;
            border-radius: 12px;
          }
          .sk-circle {
            border-radius: 50% !important;
          }
        `}</style>

        {/* Skeleton Navbar */}
        <nav style={{ padding: isMobile ? '12px 16px' : '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)', background: isLight ? '#fff' : 'transparent' }}>
          <div style={{ flex: 1, display: 'flex' }}>
            <div className="sk-shim" style={{ width: isMobile ? 38 : 100, height: 38, borderRadius: isMobile ? '50%' : 16 }} />
          </div>
          <div style={{ flex: 1 }}></div>
          {/* Matches the real navbar's !standalone gate below — the native
              app and installed PWA never show these icons once loaded, so
              the skeleton shouldn't fake them either (was rendering as a
              half-cut icon row next to the back button on mobile). */}
          {!standalone && (
            <div style={{ flex: 2, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <div className="sk-shim sk-circle" style={{ width: 34, height: 34 }} />
              <div className="sk-shim sk-circle" style={{ width: 34, height: 34 }} />
              <div className="sk-shim sk-circle" style={{ width: 34, height: 34 }} />
            </div>
          )}
        </nav>

        {/* Skeleton Content */}
        <div style={{ maxWidth: '620px', margin: '40px auto 80px', padding: '0 20px' }}>
          {/* App Settings Page Title */}
          <div className="sk-shim" style={{ height: 38, width: 220, marginBottom: 40 }} />

          {/* Shimmering settings group cards (general, notification, media settings etc.) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
            <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
            <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
            <div className="sk-shim" style={{ height: 70, width: '100%', borderRadius: 20 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Toaster position="top-center" />
      <style>{`
        .settings-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 24px 28px; margin-bottom: 24px; transition: all 0.2s; }
        .settings-card:hover { border-color: rgba(255,255,255,0.15); }
        html[data-theme='light'] .custom-toggle.toggle-off { background: rgba(0,0,0,0.15) !important; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1) !important; }
        .acc-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
        .acc-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .acc-body { margin-top: 24px; animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .notif-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 12px; }
        .notif-row:last-child { border-bottom: none; }
        .notif-label { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
        .notif-label > div:last-child { min-width: 0; }
        .notif-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        /* Keeps every row's description on one line regardless of translation
           length, so a long string can't stretch that row taller and make its
           (fixed-size) icon look small/misaligned next to its neighbors. */
        .notif-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .device-select { 
          width: 100%; 
          padding: 12px 16px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 12px; 
          color: #fff; 
          font-size: 14px; 
          outline: none; 
          appearance: none; 
          cursor: pointer; 
          transition: all 0.2s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .device-select:focus { border-color: var(--brand-1); background-color: rgba(255,255,255,0.08); }
        .device-select option { background: #1a1a2e; color: #fff; }
        
        html[data-theme='light'] .device-select { 
          background-color: #fff; 
          border-color: #e2e8f0; 
          color: #1a202c; 
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        html[data-theme='light'] .device-select option { background: #fff; color: #1a202c; }
        .test-btn { padding: 8px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
        .back-btn { 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          color: #fff; 
          padding: 10px 20px; 
          border-radius: 16px; 
          cursor: pointer; 
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); 
          font-size: 14px; 
          font-weight: 700; 
          backdrop-filter: blur(12px); 
        }
        .back-btn:hover { 
          background: rgba(255,255,255,0.1); 
          border-color: rgba(255,255,255,0.2); 
        }
        .nav-icon-btn { 
          position: relative; 
          background: rgba(255,255,255,0.05); 
          border: none; 
          padding: 8px;
          border-radius: 50%; 
          color: #94a3b8; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .nav-icon-btn:hover { 
          background: rgba(255,255,255,0.1); 
          border-color: rgba(255,255,255,0.2); 
          color: #fff; 
        }
        .nav-icon-btn.active {
          background: rgba(var(--brand-1-rgb),0.12);
          color: var(--brand-1-light);
          border-radius: 12px;
        }
        .profile-pill {
          display: flex; 
          align-items: center; 
          gap: 10px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          border-radius: 16px; 
          padding: 8px 18px; 
          font-size: 14px; 
          color: #eee; 
          cursor: pointer; 
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .profile-pill:hover { 
          background: rgba(255,255,255,0.1) !important; 
          border-color: rgba(255,255,255,0.2) !important; 
        }
        @media (max-width: 768px) {
          .back-btn span {
            display: none !important;
          }
          .back-btn {
            padding: 10px !important;
            border-radius: 50% !important;
          }
          .profile-pill span {
            display: none !important;
          }
          .profile-pill {
            padding: 8px !important;
            border-radius: 50% !important;
          }
        }

        /* ── Light Mode Overrides ── */
        html[data-theme='light'] body { background: #f7fafc !important; color: #111 !important; }
        html[data-theme='light'] nav { background: #fff !important; border-bottom: 1px solid rgba(0,0,0,0.08) !important; }
        
        html[data-theme='light'] .section-heading { color: #000 !important; }
        html[data-theme='light'] .section-desc { color: #4a5568 !important; }

        html[data-theme='light'] h2 { color: #000 !important; }

        @media (max-width: 767px) {
          nav .nav-dropdown {
            position: fixed !important;
            top: 68px !important;
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
          }
        }
      `}</style>

      {/* Navbar */}
      <nav style={{ padding: isMobile ? '12px 16px' : '16px 40px', paddingTop: `calc(${isMobile ? '12px' : '16px'} + var(--sp-status-bar-inset, 0px))`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1000 }}>
        {/* Left: Back Button */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            <span>{t('back', 'Back')}</span>
          </button>
        </div>

        {/* Center: Empty (identity moved to right) */}
        <div style={{ flex: 1 }}></div>

        {/* Right: Actions — hidden in standalone PWA mode, redundant with the
            bottom nav / top-bar notifications icon there. */}
        {!standalone && (
        <div ref={navIconsRef} style={{ flex: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <button 
              title="Search"
              onClick={() => { setShowSearch(!showSearch); setShowRecentChats(false); setShowNotifications(false); setShowUserMenu(false); }}
              className={`nav-icon-btn${showSearch ? ' active' : ''}`}
            >
              <Search size={18} />
            </button>
            {showSearch && (
              <div className="nav-dropdown" style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? '68px' : 'calc(100% + 12px)',
                left: isMobile ? '16px' : 'auto',
                right: isMobile ? '16px' : -60,
                width: isMobile ? 'auto' : 320,
                background: isLight ? '#ffffff' : '#111',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                zIndex: 10000
              }}>
                <input 
                  autoFocus
                  placeholder="Search users..."
                  className="nav-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
                    border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: isLight ? '#111' : '#fff',
                    fontSize: 13,
                    outline: 'none',
                    marginBottom: 8
                  }}
                />
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {searchResults.length > 0 ? (
                    searchResults.map(u => (
                      <div key={u.username} onClick={() => { setShowSearch(false); navigate(`/profile/${u.username}`); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s' }}
                           onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                           onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <UserIcon size={14} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: isLight ? '#666' : '#6b7280', fontSize: 11 }}>@{u.username}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    searchQuery ? <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 12 }}>No users found</div> : null
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Global Chat */}
          <div style={{ position: 'relative' }}>
            <button 
              title="Chats"
              onClick={() => { setShowRecentChats(!showRecentChats); setShowNotifications(false); setShowSearch(false); setShowUserMenu(false); }}
              className={`nav-icon-btn${showRecentChats ? ' active' : ''}`}
            >
              <MessageSquare size={18} />
              {totalUnread > 0 && (
                <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </div>
              )}
            </button>
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button title="Notifications" onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false); setShowRecentChats(false); setShowUserMenu(false); }} className={`nav-icon-btn${showNotifications ? ' active' : ''}`}>
              <Bell size={18} />
              {followRequests.filter(r => r.status === 'pending').length > 0 && (
                <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {followRequests.filter(r => r.status === 'pending').length}
                </div>
              )}
            </button>
            {showNotifications && (
              <div className="nav-dropdown" style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? '68px' : 'calc(100% + 12px)',
                left: isMobile ? '16px' : 'auto',
                right: isMobile ? '16px' : 0,
                width: isMobile ? 'auto' : 340,
                background: isLight ? '#ffffff' : '#111',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '12px 6px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                zIndex: 10000
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#666' : '#555', padding: '0 12px 8px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t('followNotifications', 'Follow Notifications')}</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {followRequests.length > 0 ? (
                    followRequests.map(u => (
                      <div key={u.username} onClick={() => { setShowNotifications(false); navigate(`/profile/${u.username}`); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: u.status === 'pending' ? (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.05)') : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = u.status === 'pending' ? (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.05)') : 'transparent'}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {u.avatarPath ? <img src={getAvatarUrl(u.avatarPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={18} color={isLight ? '#666' : '#888'} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13, fontWeight: 700 }}>{u.displayName || u.username}</div>
                          <div style={{ color: isLight ? '#444' : '#6b7280', fontSize: 11, marginTop: 2 }}>
                            {u.status === 'pending' ? t('wantsToFollow', { username: `@${u.username}`, defaultValue: `@${u.username} wants to follow you` }) : t('startedFollowing', { username: `@${u.username}`, defaultValue: `@${u.username} started following you` })}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {u.status === 'pending' ? (
                              <button onClick={(e) => handleAllowRequest(u.username, e)} className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(var(--brand-1-rgb),0.15)', border: 'none', color: isLight ? '#000000' : 'var(--brand-1-light)', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('allow', 'Allow')}</button>
                            ) : (
                              <button disabled className="notif-action-btn" style={{ padding: '6px 12px', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLight ? '#666' : '#6b7280', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followerStatus', 'Follower')}</button>
                            )}

                            {u.myFollowStatus === 'accepted' ? (
                              <button disabled className="notif-action-btn" style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.15)', border: 'none', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t('followingStatus', 'Following')}</button>
                            ) : (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (u.myFollowStatus === 'pending') return;
                                handleFollowBack(u.username, e);
                              }} className={`notif-action-btn${u.myFollowStatus === 'pending' ? '' : ' stay-white'}`} style={{ padding: '6px 12px', background: u.myFollowStatus === 'pending' ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') : 'var(--brand-gradient)', border: 'none', color: u.myFollowStatus === 'pending' ? (isLight ? '#666' : '#6b7280') : '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: u.myFollowStatus === 'pending' ? 'default' : 'pointer' }}>
                                {u.myFollowStatus === 'pending' ? t('requestSent', 'Request Sent') : t('followBack', 'Follow Back')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: isLight ? '#666' : '#444', fontSize: 12, padding: 24 }}>{t('noNewNotifications', 'No new notifications')}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }} onMouseLeave={() => setShowUserMenu(false)}>
            <div className="profile-pill"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
                setShowSearch(false);
                setShowRecentChats(false);
                setShowNotifications(false);
              }}
              onMouseEnter={() => { setShowUserMenu(true); setShowSearch(false); setShowRecentChats(false); setShowNotifications(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 14px', fontSize: '14px', color: '#ddd', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile?.avatarPath ? (
                  <img src={getAvatarUrl(profile.avatarPath)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={14} style={{ color: 'var(--brand-1)' }} />
                )}
              </div>
              <span style={{ fontWeight: 600 }}>{myUsername}</span>
            </div>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 8, zIndex: 9999 }}>
                <div className="nav-dropdown" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8, minWidth: 220, boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}>
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/profile'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserIcon size={16} color="var(--brand-1)" />
                    </div>
                    {t('account', 'Account')}
                  </button>
                  <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/app-settings'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Settings size={16} color="#10b981" />
                    </div>
                    {t('app', 'App')}
                  </button>
                  {!isGuest && (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowSupportModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HelpCircle size={16} color="#f59e0b" />
                      </div>
                      {t('contactSupport', 'Contact Support')}
                    </button>
                  )}
                  {!isDesktopApp && (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); setShowDownloadAppModal(true); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f1f1f1', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Download size={16} color="#38bdf8" />
                      </div>
                      {t('getDesktopApp', 'Get Desktop App')}
                    </button>
                  )}
                  {isAdminRole && (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); navigate('/admin'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'rgba(var(--brand-2-rgb),0.1)', border: 'none', color: 'var(--brand-2-light)', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-2-rgb),0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--brand-2-rgb),0.1)'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-2-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={16} color="var(--brand-2)" />
                      </div>
                      {t('adminDashboard', 'Admin Dashboard')}
                    </button>
                  )}
                  <div className="profile-divider" />
                  {isGuest ? (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserIcon size={16} color="var(--brand-1)" />
                      </div>
                      {t('logIn', 'Sign In')}
                    </button>
                  ) : (
                    <button onMouseDown={(e) => { e.preventDefault(); setShowUserMenu(false); handleLogout(); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LogOutIcon size={16} color="#f87171" />
                      </div>
                      {t('logOut', 'Log Out')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </nav>


      <section style={{ maxWidth: '620px', margin: isMobile ? '14px auto 80px' : '40px auto 80px', padding: '0 20px' }}>
        <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, margin: '0 0 24px', color: '#fff' }}>{t('appSettings', 'App Settings')}</h2>

        {/* Language */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('language')}>
            <h3><Languages size={18} color="var(--brand-1)" /> {t('language', 'Language')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'language' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'language' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{t('languageDesc', 'Select your preferred language for the app interface')}</p>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowLangDropdown(p => !p)} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{selectedLang.flag} {selectedLang.name}</span>
                  <ChevronDown size={16} color="#888" style={{ transform: showLangDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {showLangDropdown && (
                  <div className="nav-dropdown" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 6, maxHeight: 260, overflowY: 'auto', zIndex: 50, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => handleLangChange(lang.code)} style={{ width: '100%', padding: '10px 14px', background: language === lang.code ? 'rgba(var(--brand-1-rgb),0.15)' : 'transparent', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (language !== lang.code) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { if (language !== lang.code) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 18 }}>{lang.flag}</span> {lang.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>



        {/* Appearance */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('appearance')}>
            <h3><Eye size={18} color="#0ea5e9" /> {t('appearance', 'Appearance')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'appearance' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'appearance' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{t('appearanceDesc', 'Choose how the app looks to you.')}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {theme === 'light' ? <Eye size={20} color="#0ea5e9" /> : <EyeOff size={20} color="#0ea5e9" />}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{theme === 'light' ? t('lightMode', 'Light Mode') : t('darkMode', 'Dark Mode')}</div>
                    {/* 'darkModeDesc' is shared with Features.jsx's marketing card, which
                        legitimately wants its own longer copy — every locale file already
                        has that key populated ("Switch to dark theme for comfortable late
                        night watching"), so re-using it here just re-displayed the long
                        marketing line no matter what fallback text was passed. A distinct
                        key (not present in any locale file yet, so it always falls back to
                        the short default below) keeps this row independent of that. */}
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{theme === 'light' ? t('lightModeDesc', 'Bright and clean') : t('darkModeDescShort', 'For comfortable watching')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle on={theme === 'light'} onToggle={handleThemeToggle} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Themes */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('themes')}>
            <h3><Palette size={18} color="var(--brand-2)" /> {t('themes', 'Themes')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'themes' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'themes' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 20px' }}>{t('themesDesc', 'Pick an accent color for the whole app. Choose Default to go back to the original colors.')}</p>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 12px' }}>
                {t('duotoneThemes', 'Duotone — 2 Colors')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 52px)', gap: 10, marginBottom: 22 }}>
                {APP_THEMES.filter(themeOpt => themeOpt.category === 'duotone').map(themeOpt => (
                  <ThemeSwatch key={themeOpt.id} themeOpt={themeOpt} isActive={accentTheme === themeOpt.id} onSelect={handleAccentThemeSelect} t={t} />
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 12px' }}>
                {t('tritoneThemes', 'Tritone — 3 Colors')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 52px)', gap: 10 }}>
                {APP_THEMES.filter(themeOpt => themeOpt.category === 'tritone').map(themeOpt => (
                  <ThemeSwatch key={themeOpt.id} themeOpt={themeOpt} isActive={accentTheme === themeOpt.id} onSelect={handleAccentThemeSelect} t={t} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Country */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('country')}>
            <h3><MapPin size={18} color="#10b981" /> {t('country', 'Country')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'country' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'country' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>{t('countryDesc', 'Your country is auto-detected when you sign up. You can choose to hide it from your profile.')}</p>
              {country || countryCode ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                    {(getFlagClass(countryCode) || getFlagClassFromName(country)) && (
                      <span className={getFlagClass(countryCode) || getFlagClassFromName(country)} style={{ fontSize: 28, flexShrink: 0, borderRadius: 4 }} />
                    )}
                    <span style={{ color: isLight ? '#1e293b' : '#fff', fontWeight: 600, fontSize: 15 }}>
                      {(() => {
                        if (!countryCode) return country;
                        try {
                          const displayNames = new Intl.DisplayNames([i18n.language || 'en'], { type: 'region' });
                          return displayNames.of(countryCode.toUpperCase()) || country;
                        } catch (e) {
                          return country;
                        }
                      })()}
                    </span>
                  </div>
                  <div className="notif-row" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="notif-label">
                      <div className="notif-icon" style={{ background: 'rgba(16,185,129,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={16} color="#10b981" />
                      </div>
                      <NotifRowText
                        id="country"
                        title={showCountry ? t('showMyCountryShort', 'Show Country') : t('countryHiddenShort', 'Country Hidden')}
                        titleColor={isLight ? '#1e293b' : '#fff'}
                        titleWeight={600}
                        desc={showCountry
                          ? t('showMyCountryDesc', 'Your flag and country are visible in rooms and on your profile')
                          : t('countryHiddenDesc', 'Your flag and country are hidden in rooms and on your profile')}
                      />
                    </div>
                    <Toggle on={showCountry} onToggle={handleShowCountryToggle} />
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', color: '#888', fontSize: 13 }}>
                  {t('locationNotDetected', 'Location not detected')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mic / Webcam */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('mic')}>
            <h3><Mic size={18} color="#f59e0b" /> {t('microphone', 'Microphone')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'mic' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'mic' && (
            <div className="acc-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ color: '#888', fontSize: 13, margin: 0 }}>{t('micDesc', 'Test your microphone before joining a room')}</p>
                {micDevices.some(d => !d.label) && (
                  <button onClick={() => updateDevices(true, 'audio')} style={{ background: 'none', border: 'none', color: 'var(--brand-1)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    {t('refreshLabels', 'Refresh Labels')}
                  </button>
                )}
              </div>
              
              <select className="device-select" value={selectedMic} onChange={e => {
                setSelectedMic(e.target.value);
                localStorage.setItem('watch_selected_mic', e.target.value);
              }} style={{ marginBottom: 14 }}>
                <option value="">{t('defaultMic', 'Default Microphone')}</option>
                {micDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `${t('mic', 'Microphone')} ${i + 1}`}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {micTesting ? (
                  <button className="test-btn" onClick={stopMicTest} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                    <VolumeX size={15} /> {t('stopTest', 'Stop Test')}
                  </button>
                ) : (
                  <button className="test-btn" onClick={startMicTest} style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                    <Volume2 size={15} /> {t('testMic', 'Test Mic')}
                  </button>
                )}
                <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  {micTesting ? (
                    <canvas ref={micCanvasRef} width={240} height={24} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <div style={{ width: '100%', textAlign: 'center', color: '#555', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{t('clickToTest', 'CLICK TO TEST')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('camera')}>
            <h3><Video size={18} color="#ef4444" /> {t('camera', 'Camera')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'camera' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'camera' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
                {t('camDesc', 'Test your camera preview before entering a room')}
              </p>

              {/* Device selector — changes selectedCam prop which CameraPreview uses on next Start */}
              <select className="device-select" value={selectedCam} onChange={e => {
                setSelectedCam(e.target.value);
                localStorage.setItem('watch_selected_cam', e.target.value);
              }} style={{ marginBottom: 16 }}>
                <option value="">{t('defaultCam', 'Default Camera')}</option>
                {camDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `${t('camera', 'Camera')} ${i + 1}`}
                  </option>
                ))}
              </select>

              {/* Fully isolated — parent re-renders never affect this component */}
              <CameraPreview selectedCam={selectedCam} t={t} isLight={theme === 'light'} micDevices={micDevices} onStaleDevice={() => { setSelectedCam(''); localStorage.removeItem('watch_selected_cam'); }} />
            </div>
          )}
        </div>

        {/* Sound */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('sound')}>
            <h3><Music size={18} color="#a855f7" /> {t('sound', 'Sound')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'sound' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'sound' && (
            <div className="acc-body">
              <p style={{ color: isLight ? '#4b5563' : '#888', fontSize: 13, margin: '0 0 4px', fontWeight: 700 }}>{t('messageSound', 'Message notification sound')}</p>
              <p style={{ color: isLight ? '#6b7280' : '#666', fontSize: 12, margin: '0 0 12px' }}>{t('messageSoundDesc', 'Plays when a new message arrives')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {[{ id: 'none', name: t('soundNone', 'None') }, ...NOTIFICATION_TONE_LIST].map(tone => {
                  // Tone names come from notificationSounds.js in English only
                  // (that module just synthesizes audio, it has no i18n of its
                  // own) — translate the display label here via a per-tone key,
                  // falling back to the English name if a language hasn't got
                  // around to translating it yet.
                  const label = tone.id === 'none'
                    ? tone.name
                    : t(`tone${tone.id.charAt(0).toUpperCase()}${tone.id.slice(1)}`, tone.name);
                  return (
                  <div
                    key={tone.id}
                    onClick={() => handleToneSelect(tone.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      background: notifySound === tone.id ? 'rgba(var(--brand-1-rgb),0.12)' : (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)'),
                      border: notifySound === tone.id ? '1px solid rgba(var(--brand-1-rgb),0.4)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', border: '2px solid',
                        borderColor: notifySound === tone.id ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : '#555'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {notifySound === tone.id && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-1)' }} />}
                      </div>
                      <span style={{ color: isLight ? '#111' : '#fff', fontSize: 14, fontWeight: 600 }}>{label}</span>
                    </div>
                    {tone.id !== 'none' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); previewTone(tone.id); }}
                        style={{
                          width: 30, height: 30, borderRadius: '50%', border: isLight ? '1px solid rgba(0,0,0,0.12)' : 'none',
                          background: isLight ? '#fff' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0, boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}
                        aria-label={`Preview ${label}`}
                      >
                        {previewingTone === tone.id ? <Volume2 size={14} color="var(--brand-1)" /> : <Play size={13} color={isLight ? '#374151' : '#ccc'} />}
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>

              <div style={{ borderTop: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
                <p style={{ color: isLight ? '#4b5563' : '#888', fontSize: 13, margin: '0 0 4px', fontWeight: 700 }}>{t('callRingtone', 'Call ringtone')}</p>
                <p style={{ color: isLight ? '#6b7280' : '#666', fontSize: 12, margin: '0 0 12px' }}>{t('callRingtoneDesc', 'Upload your own clip (about a minute or shorter) to play when you get a call, instead of the default ring')}</p>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? 8 : 10, padding: '12px 14px', background: isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.03)', borderRadius: 12, border: isLight ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Music size={16} color="#a855f7" />
                  </div>
                  {/* Status text ("Custom ringtone set" / "Default ring") is
                      dropped on mobile — the row was cramped enough there to
                      overflow, and the section's own heading above already
                      says "Call ringtone", so the label was redundant. */}
                  {!isMobile && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: isLight ? '#111' : '#fff', fontSize: 13.5, fontWeight: 700 }}>
                        {ringtonePath ? t('customRingtoneSet', 'Custom ringtone set') : t('defaultRingtone', 'Default ring')}
                      </div>
                      {ringtoneUploading && <div style={{ color: isLight ? '#6b7280' : '#888', fontSize: 12 }}>{t('uploading', 'Uploading…')}</div>}
                    </div>
                  )}
                  {isMobile && <div style={{ flex: 1 }} />}
                  {isMobile && ringtoneUploading && <div style={{ color: isLight ? '#6b7280' : '#888', fontSize: 12, width: '100%' }}>{t('uploading', 'Uploading…')}</div>}
                  {ringtonePath && (
                    <button
                      onClick={previewRingtone}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: isLight ? '1px solid rgba(0,0,0,0.12)' : 'none', background: isLight ? '#fff' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
                      aria-label="Preview ringtone"
                    >
                      {previewingTone === '__ringtone__' ? <Pause size={14} color="var(--brand-1)" /> : <Play size={13} color={isLight ? '#374151' : '#ccc'} />}
                    </button>
                  )}
                  {ringtonePath && (
                    <button
                      onClick={handleRingtoneRemove}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      aria-label="Remove custom ringtone"
                    >
                      <Trash2 size={14} color={isLight ? '#dc2626' : '#f87171'} />
                    </button>
                  )}
                  <button
                    onClick={() => ringtoneInputRef.current?.click()}
                    disabled={ringtoneUploading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: 'none',
                      background: 'rgba(var(--brand-1-rgb),0.15)', color: isLight ? '#000000' : 'var(--brand-1-light)', fontSize: 12.5, fontWeight: 700,
                      cursor: ringtoneUploading ? 'default' : 'pointer', opacity: ringtoneUploading ? 0.6 : 1, flexShrink: 0,
                    }}
                  >
                    <Upload size={13} /> {ringtonePath ? t('replace', 'Replace') : t('upload', 'Upload')}
                  </button>
                  <input ref={ringtoneInputRef} type="file" accept="audio/*" onChange={handleRingtoneUpload} style={{ display: 'none' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('notifications')}>
            <h3><Bell size={18} color="var(--brand-2)" /> {t('notifications', 'Notifications')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'notifications' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'notifications' && (
            <div className="acc-body">
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 8px' }}>{t('notifDesc', 'Control which notifications you receive across the app')}</p>

              {/* Only ever shown once we've actually confirmed the OS is
                  throttling this app — the real reason notifications (calls,
                  messages, everything) can arrive fine while the app sits in
                  Recents but silently never show up once it's swiped away or
                  fully closed. Many devices already exempt SahaPlay by
                  default, so this is deliberately not a permanent fixture. */}
              {isCapacitorApp() && batteryOptIgnoring === false && (
                <div style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                }}>
                  <BatteryWarning size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>
                      {t('bgNotifWarningTitle', "Notifications may stop when the app isn't open")}
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                      {t('bgNotifWarningDesc', "Your phone's battery settings can block SahaPlay from waking up in the background. Allow it to run unrestricted so calls and messages always come through, even when the app is closed.")}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                      <button onClick={fixBackgroundNotifications} style={{ background: 'none', border: 'none', padding: 0, color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                        {t('fixBgNotif', 'Fix background notifications')}
                      </button>
                      <button onClick={() => openAutostartSettings()} style={{ background: 'none', border: 'none', padding: 0, color: '#aaa', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                        {t('openAutostart', 'Open autostart settings')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Master toggle */}
              <div className="notif-row" style={{ paddingBottom: 18, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(var(--brand-2-rgb),0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifyApp ? <Bell size={16} color="var(--brand-2)" /> : <BellOff size={16} color="#666" />}
                  </div>
                  <NotifRowText id="app" title={t('appNotifications', 'App Notifications')} titleWeight={600} titleSize={15} desc={t('masterNotifToggle', 'Master toggle for all notifications')} descColor="#888" />
                </div>
                <Toggle on={notifyApp} onToggle={() => toggleNotifSetting('notifyApp', notifyApp, setNotifyApp)} />
              </div>

              {/* Individual toggles */}
              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(16,185,129,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogIn size={16} color="#10b981" />
                  </div>
                  <NotifRowText id="join" title={t('joinNotifications', 'Join Notifications')} desc={t('whenSomeoneJoins', 'When someone joins your room')} />
                </div>
                <Toggle on={notifyJoin} onToggle={() => toggleNotifSetting('notifyJoin', notifyJoin, setNotifyJoin)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(var(--brand-2-rgb),0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={16} color="var(--brand-2)" />
                  </div>
                  <NotifRowText id="joinReq" title={t('joinReqNotifications', 'Join Request Result Toasts')} desc={t('whenSomeoneAsksJoin', 'Toast after you approve or deny a request')} />
                </div>
                <Toggle on={notifyJoinRequests} onToggle={() => toggleNotifSetting('notifyJoinRequests', notifyJoinRequests, setNotifyJoinRequests)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(var(--brand-1-rgb),0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={16} color="var(--brand-1)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <NotifRowText id="msg" title={t('msgNotifications', 'Message Notifications')} desc={t('whenSomeoneSendsChat', 'When someone sends a chat message')} />
                    {renderTestNotifButton()}
                  </div>
                </div>
                <Toggle on={notifyMessages} onToggle={() => toggleNotifSetting('notifyMessages', notifyMessages, setNotifyMessages)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(34,197,94,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={16} color="#22c55e" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <NotifRowText id="call" title={t('callNotifications', 'Call Notifications')} desc={t('whenSomeoneCalls', 'Incoming and missed calls')} />
                    {/* The plain Notification API's permission isn't a
                        meaningful signal inside the Tauri desktop app (it
                        goes through a separate native plugin instead — see
                        desktopNotifyStatus below), so this hint is scoped to
                        everywhere else. */}
                    {!isCapacitorApp() && !isDesktopApp && browserNotifPermission !== 'unsupported' && browserNotifPermission !== 'granted' && (
                      <button
                        onClick={requestBrowserCallAlerts}
                        style={{
                          marginTop: 6, background: 'none', border: 'none', padding: 0,
                          color: 'var(--brand-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {browserNotifPermission === 'denied'
                          ? t('browserAlertsBlockedHint', 'Notifications blocked — tap for how to enable')
                          : t('enableBrowserAlerts', 'Enable browser alerts on this device')}
                      </button>
                    )}
                    {/* Desktop app: real status from the native plugin, with
                        a direct path to actually fix it — the app can't
                        grant its own OS notification permission, only
                        Windows' own Settings page can, so "enable" here
                        means opening that page for the user rather than
                        pretending a plain requestPermission() would work. */}
                    {isDesktopApp && (desktopNotifyStatus === 'denied' || desktopNotifyStatus === 'unsupported') && (
                      <button
                        onClick={openWindowsNotificationSettings}
                        style={{
                          marginTop: 6, background: 'none', border: 'none', padding: 0,
                          color: '#f59e0b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {t('desktopNotifsBlockedHint', 'Windows notifications are off for SahaPlay — tap to open Settings')}
                      </button>
                    )}
                    {renderTestNotifButton()}
                  </div>
                </div>
                <Toggle on={notifyCalls} onToggle={toggleCallNotifSetting} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(245,158,11,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={16} color="#f59e0b" />
                  </div>
                  <NotifRowText id="friendReq" title={t('friendRequestNotifications', 'Friend Request Notifications')} desc={t('whenFriendRequest', 'When you receive a friend request')} />
                </div>
                <Toggle on={notifyFriendRequests} onToggle={() => toggleNotifSetting('notifyFriendRequests', notifyFriendRequests, setNotifyFriendRequests)} disabled={!notifyApp} />
              </div>

              <div className="notif-row">
                <div className="notif-label">
                  <div className="notif-icon" style={{ background: 'rgba(239,68,68,0.15)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogOutIcon size={16} color="#ef4444" />
                  </div>
                  <NotifRowText id="leave" title={t('leaveNotifications', 'Leave Notifications')} desc={t('whenSomeoneLeaves', 'When someone leaves your room')} />
                </div>
                <Toggle on={notifyLeave} onToggle={() => toggleNotifSetting('notifyLeave', notifyLeave, setNotifyLeave)} disabled={!notifyApp} />
              </div>
            </div>
          )}
        </div>
        {/* Privacy & Storage */}
        <div id="privacy-storage" className="settings-card">
          <div className="acc-header" onClick={() => toggleSection('privacy')}>
            <h3><ShieldCheck size={18} color="var(--brand-1)" /> {t('privacyStorage', 'Privacy & Storage')}</h3>
            <ChevronDown size={18} color="#aaa" style={{ transform: openSection === 'privacy' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {openSection === 'privacy' && (
            <div className="acc-body">
              <div style={{
                background: (theme === 'light') ? '#fff' : '#13131f',
                border: `1px solid ${(theme === 'light') ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16,
                padding: 24,
                marginTop: 8
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HardDrive size={20} color="var(--brand-1)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: (theme === 'light') ? '#111' : '#f9fafb' }}>{t('mediaStoragePolicy', 'Media Storage Policy')}</div>
                    <div style={{ fontSize: 13, color: (theme === 'light') ? '#6b7280' : '#9ca3af', marginTop: 2 }}>{t('mediaStoragePolicyDesc', 'How long your shared files are kept')}</div>
                  </div>
                </div>

                {/* Policy table */}
                {[
                  { Icon: MessageSquare, typeKey: 'mediaTypeTextMessages', typeDefault: 'Text Messages', durationKey: 'durationKeptForever', durationDefault: 'Kept forever', color: '#10b981' },
                  { Icon: Image, typeKey: 'mediaTypeImages', typeDefault: 'Images', durationKey: 'duration30Days', durationDefault: '30 days', color: '#6366f1' },
                  { Icon: Video, typeKey: 'mediaTypeVideos', typeDefault: 'Videos', durationKey: 'duration7Days', durationDefault: '7 days', color: '#f59e0b' },
                  { Icon: FileText, typeKey: 'mediaTypeFilesDocuments', typeDefault: 'Files & Documents', durationKey: 'duration7Days', durationDefault: '7 days', color: '#ef4444' },
                  { Icon: Mic, typeKey: 'mediaTypeVoiceNotes', typeDefault: 'Voice Notes', durationKey: 'duration14Days', durationDefault: '14 days', color: '#a855f7' },
                  { Icon: Smile, typeKey: 'mediaTypeEmojiReactions', typeDefault: 'Emoji Reactions', durationKey: 'durationKeptForever', durationDefault: 'Kept forever', color: '#10b981' },
                ].map((item, i, arr) => (
                  <div key={item.typeKey} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: i < arr.length - 1 ? `1px solid ${(theme === 'light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'}` : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <item.Icon size={16} color={item.color} />
                      </div>
                      <span style={{ fontSize: 14, color: (theme === 'light') ? '#374151' : '#d1d5db', fontWeight: 500 }}>
                        {t(item.typeKey, item.typeDefault)}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: item.color, background: `${item.color}15`, padding: '3px 10px', borderRadius: 20 }}>
                      {t(item.durationKey, item.durationDefault)}
                    </span>
                  </div>
                ))}

                {/* Info note */}
                <div style={{
                  marginTop: 20, padding: '12px 16px',
                  background: (theme === 'light') ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.1)',
                  border: '1px solid rgba(var(--brand-1-rgb),0.2)', borderRadius: 10,
                  fontSize: 13, color: (theme === 'light') ? '#4b5563' : '#9ca3af', lineHeight: 1.6
                }}>
                  {t('mediaStorageNote', 'Files are automatically deleted after the above period to save storage space. Download important files before they expire. Text messages and reactions are never deleted.')}
                </div>

                {/* Upload size limits — same everywhere (web, tablet, mobile web, TWA/PWA, app) since it's the same client-side check regardless of platform */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Paperclip size={20} color="var(--brand-1)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: (theme === 'light') ? '#111' : '#f9fafb' }}>{t('uploadSizeLimits', 'Upload Size Limits')}</div>
                    <div style={{ fontSize: 13, color: (theme === 'light') ? '#6b7280' : '#9ca3af', marginTop: 2 }}>{t('uploadSizeLimitsDesc', 'Same on web, tablet, mobile, and the app')}</div>
                  </div>
                </div>
                {[
                  { Icon: Image, typeKey: 'mediaTypeImages', typeDefault: 'Images', limit: '10 MB', color: '#6366f1' },
                  { Icon: Video, typeKey: 'mediaTypeVideos', typeDefault: 'Videos', limit: '50 MB', color: '#f59e0b' },
                  { Icon: FileText, typeKey: 'mediaTypeFilesDocuments', typeDefault: 'Files & Documents', limit: '25 MB', color: '#ef4444' },
                  { Icon: Mic, typeKey: 'mediaTypeVoiceNotes', typeDefault: 'Voice Notes', limit: '10 MB', color: '#a855f7' },
                ].map((item, i, arr) => (
                  <div key={item.typeKey} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: i < arr.length - 1 ? `1px solid ${(theme === 'light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'}` : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <item.Icon size={16} color={item.color} />
                      </div>
                      <span style={{ fontSize: 14, color: (theme === 'light') ? '#374151' : '#d1d5db', fontWeight: 500 }}>
                        {t(item.typeKey, item.typeDefault)}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: item.color, background: `${item.color}15`, padding: '3px 10px', borderRadius: 20 }}>
                      {t('maxSizeValue', 'Max {{limit}}', { limit: item.limit })}
                    </span>
                  </div>
                ))}

                {/* Download reminder toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 16, padding: '14px 16px',
                  background: (theme === 'light') ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  border: `1px solid ${(theme === 'light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: (theme === 'light') ? '#111' : '#f9fafb' }}>
                      {t('expiryRemindersTitle', 'Show expiry reminders in chat')}
                    </div>
                    <div style={{ fontSize: 12, color: (theme === 'light') ? '#6b7280' : '#9ca3af', marginTop: 2 }}>
                      {t('expiryRemindersDesc', 'Show a banner when files are close to expiring')}
                    </div>
                  </div>
                  <div
                    onClick={() => {
                      const next = !expiryReminders;
                      setExpiryReminders(next);
                      localStorage.setItem('expiry_reminders', String(next));
                    }}
                    style={{
                      width: 44, height: 24, borderRadius: 999,
                      background: expiryReminders ? 'var(--brand-1)' : ((theme === 'light') ? '#d1d5db' : '#374151'),
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3,
                      left: expiryReminders ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>

                {expiryReminders && (
                  <div style={{
                    marginTop: 10, padding: '12px 16px',
                    background: (theme === 'light') ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.1)',
                    border: '1px solid rgba(var(--brand-1-rgb),0.2)', borderRadius: 10,
                    fontSize: 12.5, color: (theme === 'light') ? '#4b5563' : '#9ca3af', lineHeight: 1.6
                  }}>
                    {t('expiryRemindersButtonsNote', '"Got it" hides the banner for about 12 hours. "Remind me later" hides it only until you close and reopen the chat. Both are the same whether you use the Room chat or the chat window, and turning this toggle off stops the banner everywhere.')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      <GlobalChatWidget
        ref={chatWidgetRef}
        isOpen={showRecentChats} 
        onClose={() => setShowRecentChats(false)} 
        unreadCounts={unreadCounts}
        onMarkRead={handleMarkRead}
        onNewMessage={handleNewMessage}
      />
      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      <DownloadAppModal isOpen={showDownloadAppModal} onClose={() => setShowDownloadAppModal(false)} />
    </div>
  );
};

export default AppSettings;





