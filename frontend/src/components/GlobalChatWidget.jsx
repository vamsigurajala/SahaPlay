import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ArrowLeft, Send, X, User, Users, SmilePlus, Reply, Plus, MoreVertical, Search, Paperclip, Loader2, Play, Pause, Trash2, Edit2, MoreHorizontal, ArrowDown, ChevronDown, ChevronLeft, ChevronRight, Lock, ShieldAlert, Pin, Bell, BellOff, MessageSquareX, Eye, EyeOff, CheckCheck, Check, Ban, SquareCheck, Square, Unlock, Timer as TimerIcon, Key, Mic, MicOff, Download, FileText, Music, Clock, Flag, Copy, Forward, Phone, Video, PhoneMissed, PhoneOff, Palette, Camera, Image as ImageIcon, BarChart2, ImageOff, RefreshCw } from 'lucide-react';
import { useCall, CALL_LOG_PREFIX } from '../contexts/CallContext';
import ChatLockScreen from './ChatLockScreen';
import ForgotPinModal from './ForgotPinModal';
import ReportMessageModal from './ReportMessageModal';
import DoubleTapBurst from './DoubleTapBurst';
import CameraCapture from './CameraCapture';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { blockPullToRefresh, unblockPullToRefresh } from '../lib/pullToRefreshGate';
import { getMenuFloorY } from '../lib/chatMenuPlacement';
import PinSetupModal from './PinSetupModal';
import PollComposer from './PollComposer';
import PollBubble from './PollBubble';
import PollVotesModal from './PollVotesModal';
import VoiceRecorderBar from './VoiceRecorderBar';
import { castPollVote } from '../lib/pollApi';
import { getRecentMessagesCache, setRecentMessagesCache, clearRecentMessagesCache } from '../utils/recentMessagesCache';
import { API } from '../lib/api';
import { appCache } from '../cache/appCache.js';
import { wipeLockedChatsData } from '../lib/chatLockUtils';
import toast from 'react-hot-toast';
import { downloadBlobToDevice } from '../lib/nativeDownload';
import { io } from 'socket.io-client';
import { useNavigate, useLocation } from 'react-router-dom';
import { mergeHistoryBatch } from '../utils/chatHelper.js';
import { getMessagePreview } from '../utils/messagePreview';
import { keepMenuInView } from '../utils/keepMenuInView';
import { getAvatarUrl } from '../utils/avatarUtils';
import { clearUserSession } from '../lib/authUtils.js';
import { useSwipeToReply } from '../hooks/useSwipeToReply';
import { useLongPress } from '../hooks/useLongPress';
import { useTimestampPeek } from '../hooks/useTimestampPeek';
import { useBackIntercept, suppressNextPop } from '../hooks/useBackIntercept';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import { getPersistedReactionPreviews, setPersistedReactionPreview, clearPersistedReactionPreview } from '../utils/reactionPreviewsPersist';
import MediaLightbox from './MediaLightbox';
import { ensureDesktopNotifyPermission, showDesktopNotification } from '../lib/desktopNotify';
import { playNotificationTone } from '../lib/notificationSounds';
import { CHAT_CATEGORIES, CHAT_THEMES, CHAT_THEME_BUBBLE_STRIDE, CHAT_WALLPAPERS, findWallpaper, getWallpaperDominantColor, getThemeSolidColor, isRgbColorDark } from '../lib/chatThemes';
import ExpiryReminderBanner from './ExpiryReminderBanner';
import KeyResetSyncBanner from './KeyResetSyncBanner';
import { shouldShowKeyResetBanner, dismissKeyResetBanner } from '../lib/keyResetBanner.js';
import { countSoonExpiringMedia, dismissExpiryBanner12h, snoozeExpiryBannerUntilClose, clearExpiryBannerCloseSuppression } from '../utils/expiryReminders';
import DownloadAppModal from './DownloadAppModal';
import { isCapacitorApp, isTauriApp } from '../lib/platform';
import { isNotifyCategoryEnabled } from '../lib/notifyGating';

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢'];

const getMessageCopyText = (msg) => {
  if (!msg) return '';
  if (msg.decryptedText) return msg.decryptedText;
  if (!msg.mediaType && msg.message && !looksLikeCiphertext(msg.message)) return msg.message;
  return '';
};

const copyMessageText = async (msg) => {
  const text = getMessageCopyText(msg);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Message copied');
  } catch {
    toast.error('Could not copy message');
  }
};

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const isMessageEditable = (msg) => !!getMessageCopyText(msg) && (Date.now() - Number(msg.timestamp) <= EDIT_WINDOW_MS);

const FILE_LIMITS = {
  'image/jpeg':{ max:10*1024*1024, label:'10MB' }, 'image/jpg':{ max:10*1024*1024, label:'10MB' },
  'image/png':{ max:10*1024*1024, label:'10MB' }, 'image/gif':{ max:10*1024*1024, label:'10MB' },
  'image/webp':{ max:10*1024*1024, label:'10MB' },
  // Server-enforced ceiling: /api/upload/chat's multer config caps every
  // upload at 50MB regardless of type (`limits: { fileSize: 50*1024*1024 }`,
  // server.js) — these video entries used to claim 100MB, which the server
  // would then reject past 50MB anyway, an inconsistent/misleading check.
  'video/mp4':{ max:50*1024*1024, label:'50MB' }, 'video/webm':{ max:50*1024*1024, label:'50MB' },
  'video/mov':{ max:50*1024*1024, label:'50MB' }, 'video/quicktime':{ max:50*1024*1024, label:'50MB' },
  'application/pdf':{ max:25*1024*1024, label:'25MB' },
  'application/msword':{ max:25*1024*1024, label:'25MB' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{ max:25*1024*1024, label:'25MB' },
  'application/vnd.ms-excel':{ max:25*1024*1024, label:'25MB' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':{ max:25*1024*1024, label:'25MB' },
  'application/vnd.ms-powerpoint':{ max:25*1024*1024, label:'25MB' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':{ max:25*1024*1024, label:'25MB' },
  'text/plain':{ max:25*1024*1024, label:'25MB' }, 'text/csv':{ max:25*1024*1024, label:'25MB' },
  'application/zip':{ max:25*1024*1024, label:'25MB' },
  'audio/mp3':{ max:10*1024*1024, label:'10MB' }, 'audio/mpeg':{ max:10*1024*1024, label:'10MB' },
  'audio/wav':{ max:10*1024*1024, label:'10MB' }, 'audio/ogg':{ max:10*1024*1024, label:'10MB' },
  'audio/m4a':{ max:10*1024*1024, label:'10MB' }, 'audio/webm':{ max:10*1024*1024, label:'10MB' },
};

function validateFile(file) {
  const limit = FILE_LIMITS[file.type];
  if (!limit) return { valid: false, error: `❌ File type not supported` };
  if (file.size > limit.max) return { valid: false, error: `❌ File too large. Max size is ${limit.label}` };
  return { valid: true };
}

function FileTypeIcon({ mimeType, size = 20, color }) {
  const c = color || null;
  if (!mimeType) return <Paperclip size={size} color={c || "#888"} />;
  if (mimeType === 'application/pdf') return <FileText size={size} color={c || "#ef4444"} />;
  if (mimeType.includes('word')) return <FileText size={size} color={c || "#3b82f6"} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText size={size} color={c || "#10b981"} />;
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return <FileText size={size} color={c || "#f97316"} />;
  if (mimeType === 'application/zip') return <Paperclip size={size} color={c || "#6b7280"} />;
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return <FileText size={size} color={c || "#6b7280"} />;
  if (mimeType.startsWith('audio/')) return <Music size={size} color={c || "var(--brand-2)"} />;
  if (mimeType.startsWith('video/')) return <Play size={size} color={c || "#3b82f6"} fill={c || "#3b82f6"} />;
  return <Paperclip size={size} color={c || "#888"} />;
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType, fileName) {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType?.includes('word')) return 'Word';
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'Excel';
  if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation')) return 'PowerPoint';
  if (mimeType === 'text/plain') return 'Text';
  if (mimeType === 'text/csv') return 'CSV';
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'ZIP';
  const ext = fileName?.split('.').pop()?.toUpperCase();
  if (ext) return ext;
  return 'File';
}

function getFileIconBg(mimeType) {
  if (mimeType === 'application/pdf') return '#ef4444';
  if (mimeType?.includes('word')) return '#3b82f6';
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return '#10b981';
  if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation')) return '#f97316';
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return '#6b7280';
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return '#64748b';
  return 'var(--brand-1)';
}

function FileCard({ url, type, fileName, fileSize, isMe, isLight, expiresAt, loading, tick, forwarded, wallpaperBg = null, wallpaperForceBlack = false, themeGradient = null, themeColor = null }) {
  const isLoading = loading && !url;
  const isExpired = !url && !isLoading;
  const typeLabel = getFileTypeLabel(type, fileName);
  const sizeLabel = formatFileSize(fileSize);
  const iconBg = getFileIconBg(type);
  const subtitle = isLoading ? (isMe ? 'Sending…' : 'Loading…') : (isExpired ? 'Expired' : [typeLabel, sizeLabel].filter(Boolean).join(' • '));
  // Computed early (normally declared below, alongside cardBg/fileNameColor)
  // because infoColor — and the Clock/Forward icons that use it as their SVG
  // `color` prop, unreachable by the .fc-expiry CSS class override — needs
  // it before expiryLine is built just below.
  const onColoredCard = isMe && !!(wallpaperBg || themeGradient);
  // Same color as the expiry line below — no background pill, just muted text
  // matching the existing "Expires in X days" color pattern in both themes.
  const infoColor = onColoredCard ? 'rgba(255,255,255,0.75)' : (isLight ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.6)');

  let expiryLine = null;
  if (expiresAt && !isExpired) {
    const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24));
    if (daysLeft > 0) {
      expiryLine = <div className="fc-expiry" style={{ fontSize: 9, color: infoColor, WebkitTextFillColor: infoColor, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={8} color={infoColor} style={{ flexShrink: 0 }} />Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</div>;
    }
  }

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      await downloadBlobToDevice(blob, fileName || 'download', toast);
    } catch { toast?.error?.('Download failed'); }
  };

  // On a wallpaper, the card follows the exact same per-theme color plain
  // message bubbles use (wallpaperColor/wallpaperReceivedBg — see
  // renderMedia's wallpaperBg arg) instead of a fixed light/dark card; its
  // own text (.fc-name/.fc-sub/.fc-expiry) is repainted to match by the
  // .on-wallpaper CSS rules regardless of what's computed below.
  //
  // A picked Chat Theme (a "Colors" gradient, not a wallpaper — see
  // isCustomTheme in the caller) gets the exact same treatment: a sent
  // text bubble already goes fully gradient-colored when one's picked, but
  // this card kept its plain white/dark surface regardless, since nothing
  // here ever looked at the theme at all. themeGradient/themeColor (passed
  // only for isMe) make this card and its accents follow suit.
  // (onColoredCard itself is declared earlier, above infoColor.)
  const cardBg = wallpaperBg || themeGradient || (isLight ? '#ffffff' : (isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'));
  const cardBorder = (wallpaperBg || themeGradient) ? 'transparent' : (isLight ? 'rgba(0,0,0,0.1)' : (isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.09)'));
  const fileNameColor = onColoredCard ? '#ffffff' : (isLight ? '#000000' : (isMe ? '#fff' : '#e2e8f0'));
  const subtitleColor = onColoredCard ? 'rgba(255,255,255,0.75)' : (isLight ? 'rgba(0,0,0,0.65)' : (isMe ? 'rgba(255,255,255,0.65)' : '#888'));
  // Zen Interior sent card: the download icon is an SVG `color` prop, not a
  // CSS `color` style, so the .fc-name/.fc-sub class-based override (which
  // uses !important to win the wallpaper-forces-white cascade war) can't
  // reach it — it needs its own explicit dark value here instead of the
  // white this branch normally picks for a dark-app-mode sent bubble.
  const dlColor = onColoredCard ? 'rgba(255,255,255,0.85)' : (isLight ? 'var(--brand-2-darker)' : (isMe ? (wallpaperForceBlack ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)') : 'var(--brand-1-light)'));
  // The file-type icon's own circle normally reads as a translucent tint of
  // its type color on a plain white light-mode card — against a vivid
  // gradient/wallpaper card that alpha blend can disappear or clash, so it
  // switches to the same solid-circle treatment dark mode already uses.
  const iconCircleBg = onColoredCard ? iconBg : (isLight ? `${iconBg}22` : iconBg);
  const iconColor = onColoredCard ? '#fff' : (isLight ? iconBg : '#fff');
  // App.jsx's light-mode .fc-name/.fc-sub/.fc-expiry overrides read these
  // (falling back to their normal defaults when unset) so a themed sent
  // card's text follows the theme instead of those overrides' hardcoded
  // dark values, which are only correct against this card's default white.
  const themeTextVars = onColoredCard ? { '--fc-name-c': '#ffffff', '--fc-sub-c': 'rgba(255,255,255,0.75)', '--fc-dl-c': 'rgba(255,255,255,0.85)' } : {};

  return (
    <div style={{ background: cardBg, borderRadius: 10, padding: '10px 12px', minWidth: 200, maxWidth: 250, border: `1px solid ${cardBorder}`, marginTop: 2, ...themeTextVars }}>
      {forwarded && (
        <div className="fc-expiry" style={{ fontSize: 9, color: infoColor, WebkitTextFillColor: infoColor, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <Forward size={8} color={infoColor} style={{ flexShrink: 0 }} />Forwarded
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 42, borderRadius: 8, background: iconCircleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (isExpired || isLoading) ? 0.5 : 1 }}>
          {isLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: iconColor }} /> : <FileTypeIcon mimeType={type} size={18} color={iconColor} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fc-name" style={{ fontSize: 11, fontWeight: 700, color: fileNameColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', WebkitTextFillColor: fileNameColor }}>
            {fileName || 'File'}
          </div>
          <div className="fc-sub" style={{ fontSize: 10, fontWeight: 400, color: subtitleColor, marginTop: 2, WebkitTextFillColor: subtitleColor }}>{subtitle}</div>
        </div>
        {!isExpired && !isLoading && (
          <button className="fc-dl" onClick={handleDownload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dlColor, padding: 4, marginLeft: 6, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Download size={20} color={dlColor} />
          </button>
        )}
      </div>
      {(expiryLine || (tick && !isExpired && !isLoading)) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, paddingLeft: 48 }}>
          {expiryLine || <span />}
          {tick && !isExpired && !isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{tick}</div>
          )}
        </div>
      )}
    </div>
  );
}

const _vnReg_gcw = { el: null, pauseFn: null };

function AudioPlayerBubble({ url, expiresAt, isMe, isLight, loading, tick, forwarded, wallpaperBg = null, wallpaperForceBlack = false, themeGradient = null, themeColor = null }) {
  const [duration, setDuration] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const audioRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const isPlayingRef = React.useRef(false);

  const fmtDur = (s) => (!s || !isFinite(s) || isNaN(s) || s < 0) ? '0:00' :
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  React.useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (_vnReg_gcw.el === audioRef.current) { _vnReg_gcw.el = null; _vnReg_gcw.pauseFn = null; }
  }, []);

  const BAR_COUNT = 30;
  const bars = React.useMemo(() => {
    const arr = []; let s = 42;
    for (let i = 0; i < BAR_COUNT; i++) { s = (s * 9301 + 49297) % 233280; arr.push(3 + (s / 233280) * 18); }
    return arr;
  }, []);

  const isLoading = loading && !url;
  const isExpired = !url && !isLoading;
  const expColor = isMe ? 'rgba(255,255,255,0.5)' : (isLight ? '#94a3b8' : '#666');
  // Same per-theme color plain message bubbles use whenever a wallpaper's
  // active, instead of a low-alpha tint over the photo (reads as "barely
  // there") or a fixed card unrelated to the picked theme.
  const loadBg = wallpaperBg || (isMe ? 'rgba(255,255,255,0.1)' : (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(255,255,255,0.06)'));

  if (isLoading) return (
    <div style={{ padding: '8px 12px', background: loadBg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: isMe ? 'rgba(255,255,255,0.12)' : (isLight ? 'rgba(var(--brand-1-rgb),0.12)' : 'rgba(var(--brand-1-rgb),0.18)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-1)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20, marginBottom: 4 }}>
          {Array.from({length: 20}, (_, j) => (
            <div key={j} style={{ width: 2, height: 4 + (j % 5) * 2, borderRadius: 1, background: isMe ? 'rgba(255,255,255,0.2)' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)') }} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: expColor, WebkitTextFillColor: expColor }}>{isMe ? 'Sending…' : 'Loading…'}</div>
      </div>
    </div>
  );

  if (isExpired) return (
    <div style={{ padding: '8px 12px', background: loadBg, borderRadius: 10, fontSize: 12, color: expColor, display: 'flex', alignItems: 'center', gap: 6 }}>
      Voice note expired
    </div>
  );

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isFinite(el.duration) && el.duration > 0 && el.duration < 1e8) {
      setDuration(el.duration);
    } else {
      const waitForDuration = () => {
        if (isFinite(el.duration) && el.duration > 0 && el.duration < 1e8) {
          el.removeEventListener('timeupdate', waitForDuration);
          setDuration(el.duration);
          if (!isPlayingRef.current) el.currentTime = 0;
        }
      };
      el.addEventListener('timeupdate', waitForDuration);
      el.currentTime = 1e9;
    }
  };

  const handleEnded = () => {
    isPlayingRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (_vnReg_gcw.el === audioRef.current) { _vnReg_gcw.el = null; _vnReg_gcw.pauseFn = null; }
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.currentTime > 1e5) el.currentTime = 0;

    if (isPlayingRef.current) {
      el.pause();
      isPlayingRef.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setPlaying(false);
      if (_vnReg_gcw.el === el) { _vnReg_gcw.el = null; _vnReg_gcw.pauseFn = null; }
    } else {
      if (_vnReg_gcw.el && _vnReg_gcw.el !== el && _vnReg_gcw.pauseFn) {
        _vnReg_gcw.pauseFn();
        _vnReg_gcw.el.pause();
      }
      isPlayingRef.current = true;
      setPlaying(true);
      const tick = () => {
        const a = audioRef.current;
        if (!a || !isPlayingRef.current) return;
        const ct = a.currentTime;
        const dur = isFinite(a.duration) && a.duration > 0 && a.duration < 1e8 ? a.duration : 0;
        setCurrentTime(ct);
        setProgress(dur > 0 ? ct / dur : 0);
        rafRef.current = requestAnimationFrame(tick);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
      _vnReg_gcw.el = el;
      _vnReg_gcw.pauseFn = () => {
        isPlayingRef.current = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setPlaying(false);
      };
      el.play().catch(() => {
        isPlayingRef.current = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setPlaying(false);
        if (_vnReg_gcw.el === el) { _vnReg_gcw.el = null; _vnReg_gcw.pauseFn = null; }
      });
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      await downloadBlobToDevice(blob, `voice_note_${Date.now()}.${ext}`, toast);
    } catch { toast?.error?.('Download failed'); }
  };

  // Same per-theme reasoning as loadBg above — plus a picked Chat Theme
  // color, same as FileCard just above (see its own comment for why).
  const onColoredCard = isMe && !!(wallpaperBg || themeGradient);
  const bubbleBg = wallpaperBg || themeGradient || (isMe
    ? (isLight ? 'rgba(var(--brand-1-rgb),0.12)' : 'rgba(255,255,255,0.15)')
    : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'));
  const playedColor = themeColor || 'var(--brand-2)';
  // Waveform bars (a `background` fill) and the download icon (an SVG
  // `color` prop) aren't reachable by the .rcp-vn-time-style class override
  // — that only wins the cascade war for actual CSS `color` on classed text
  // nodes — so Zen Interior's forced-black sent bubble needs these two
  // computed explicitly instead of the white a dark-app-mode sent bubble
  // normally gets.
  const unplayedColor = onColoredCard
    ? 'rgba(255,255,255,0.35)'
    : (isMe
      ? ((isLight || wallpaperForceBlack) ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)')
      : (isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)'));
  const timeColor = isMe
    ? (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)')
    : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)');
  const dlColor = onColoredCard
    ? 'rgba(255,255,255,0.85)'
    : (isMe
      ? ((isLight || wallpaperForceBlack) ? 'var(--brand-1)' : 'rgba(255,255,255,0.7)')
      : (isLight ? 'var(--brand-2-dark)' : 'var(--brand-2-light)'));
  const displayTime = (playing || currentTime > 0) ? fmtDur(currentTime) : fmtDur(duration);
  // App.jsx's light-mode .rcp-vn-time/.rcp-vn-expiry overrides read this
  // (falling back to their normal hardcoded dark default when unset), same
  // mechanism as FileCard's --fc-sub-c just above.
  const themeTextVars = onColoredCard ? { '--fc-sub-c': 'rgba(255,255,255,0.75)' } : {};

  return (
    <div style={{ background: bubbleBg, borderRadius: 10, padding: '8px 12px', minWidth: 200, marginTop: 2, ...themeTextVars }}>
      {forwarded && (
        <div className="rcp-vn-expiry" style={{ fontSize: 9, color: timeColor, WebkitTextFillColor: timeColor, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <Forward size={8} color={timeColor} style={{ flexShrink: 0 }} />Forwarded
        </div>
      )}
      <audio ref={audioRef} src={url} preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggle} style={{ background: themeColor || 'var(--brand-2)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {playing ? <Pause size={12} color="#fff" fill="#fff" /> : <Play size={12} color="#fff" fill="#fff" />}
        </button>
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', height: 28, gap: 1.5, cursor: 'pointer' }}
          onClick={e => {
            const el = audioRef.current;
            if (!el) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const dur = isFinite(el.duration) && el.duration < 1e8 ? el.duration : duration;
            if (dur > 0) {
              el.currentTime = pct * dur;
              setProgress(pct);
              setCurrentTime(pct * dur);
            }
          }}
        >
          {bars.map((h, i) => (
            <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: i / BAR_COUNT < progress ? playedColor : unplayedColor, flexShrink: 0 }} />
          ))}
        </div>
        <button onClick={handleDownload} title="Download voice note" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Download size={18} color={dlColor} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginLeft: 40 }}>
        <span className="rcp-vn-time" style={{ fontSize: 10, color: timeColor, WebkitTextFillColor: timeColor }}>{displayTime}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expiresAt && (() => {
            const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24));
            if (daysLeft <= 0) return null;
            const expTc = daysLeft <= 7 ? '#f59e0b' : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.55)');
            const expTxt = daysLeft <= 7 ? `⚠️ ${daysLeft}d left` : `${daysLeft}d left`;
            return <span className="rcp-vn-expiry" style={{ fontSize: 10, color: expTc, WebkitTextFillColor: expTc }}>{expTxt}</span>;
          })()}
          {tick && <div style={{ display: 'flex', alignItems: 'center' }}>{tick}</div>}
        </div>
      </div>
    </div>
  );
}

// Multi-media send (album) grouping: a batch of up to 5 files shares one client-generated
// mediaGroupId, sent as separate messages (own E2EE, own expiry, own row) so the existing
// single-media-per-message pipeline stays untouched. This scans a chronological message list
// and collapses each run of consecutive image/video messages sharing a mediaGroupId into one
// grid tile — the run's first message becomes the "head" (rendered as a grid), the rest are
// hidden (their content already appears inside the head's grid).
function groupMediaRuns(list) {
  const heads = new Map();
  const memberKeys = new Set();
  let i = 0;
  while (i < list.length) {
    const m = list[i];
    const rowKey = m.tempId || m.id || i;
    const mt = m.mediaType || '';
    const isVisual = mt.startsWith('image/') || mt.startsWith('video/');
    const gid = m.mediaGroupId;
    if (gid && isVisual) {
      const run = [m];
      const runKeys = [rowKey];
      let j = i + 1;
      while (j < list.length) {
        const n = list[j];
        const nmt = n.mediaType || '';
        const nVisual = nmt.startsWith('image/') || nmt.startsWith('video/');
        if (n.mediaGroupId === gid && nVisual) {
          run.push(n);
          runKeys.push(n.tempId || n.id || j);
          j++;
        } else break;
      }
      if (run.length > 1) {
        heads.set(rowKey, run);
        for (let k = 1; k < runKeys.length; k++) memberKeys.add(runKeys[k]);
      }
      i = j;
    } else {
      i++;
    }
  }
  return { heads, memberKeys };
}

// Consecutive "changed the chat theme" system lines (isNotice) collapse into
// one "Theme changed N times" pill instead of flooding the chat — a user
// idly clicking through wallpaper options produced one full-width line per
// click. Only runs of 2+ IN A ROW collapse; a single isolated theme change
// (or one separated from another by a real message) still renders as its
// own line, unchanged. Returns rowKey -> { headKey, isHead, isLast, runLength }
// for every message that's part of a collapsible run; messages not in the
// map render exactly as before.
function groupNoticeRuns(list) {
  const info = new Map();
  let i = 0;
  while (i < list.length) {
    if (list[i].isNotice) {
      let j = i;
      while (j < list.length && list[j].isNotice) j++;
      const runLength = j - i;
      if (runLength > 1) {
        const headKey = list[i].tempId || list[i].id || i;
        for (let k = i; k < j; k++) {
          const key = list[k].tempId || list[k].id || k;
          info.set(key, { headKey, isHead: k === i, isLast: k === j - 1, runLength });
        }
      }
      i = j;
    } else {
      i++;
    }
  }
  return info;
}

function resolveDecryptedUrl(m, decryptedMediaUrlsRef) {
  const msgKey = String(m.id || m.timestamp);
  return decryptedMediaUrlsRef.current[msgKey] || m._localMediaUrl ||
    ((m.mediaUrl && m.mediaUrl.startsWith('blob:')) ? m.mediaUrl : (m.nonce ? null : m.mediaUrl));
}

// WhatsApp-style grid: 2 items side by side, 3 items as one tall tile + two stacked,
// 4-5 items as a 2x2 grid with a "+N" overlay on the last visible tile when there are more.
function MediaGrid({ items, forwarded, expiresAt, tick, onOpenItem, resolveUrl }) {
  const total = items.length;
  const visibleCount = Math.min(total, 4);
  const overflow = total - 4;
  const cell = 128;
  const gap = 3;
  const size = cell * 2 + gap;
  const expiryDaysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const showExpiry = expiryDaysLeft !== null && expiryDaysLeft > 0;

  return (
    <div style={{
      width: size, borderRadius: 10, overflow: 'hidden', position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: total === 2 ? `${cell}px` : `${cell}px ${cell}px`,
      gap
    }}>
      {forwarded && (
        <div style={{ position: 'absolute', top: 5, left: 6, zIndex: 3, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>
          <Forward size={8} color="#fff" style={{ flexShrink: 0 }} />Forwarded
        </div>
      )}
      {showExpiry && (
        <div style={{ position: 'absolute', bottom: 5, left: 6, zIndex: 3, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>
          <Clock size={8} color="#fff" style={{ flexShrink: 0 }} />Expires in {expiryDaysLeft} day{expiryDaysLeft !== 1 ? 's' : ''}
        </div>
      )}
      {tick && (
        <div style={{ position: 'absolute', bottom: 5, right: 6, zIndex: 3, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>
          {tick}
        </div>
      )}
      {items.slice(0, visibleCount).map((it, idx) => {
        const isLastVisible = idx === visibleCount - 1;
        const showOverlay = isLastVisible && overflow > 0;
        const tallLeft = total === 3 && idx === 0;
        const url = resolveUrl(it);
        const isVid = (it.mediaType || '').startsWith('video/');
        return (
          <div key={it.tempId || it.id || idx}
            onClick={() => url && onOpenItem(it, url)}
            style={{ position: 'relative', cursor: url ? 'pointer' : 'default', background: '#111', gridRow: tallLeft ? 'span 2' : undefined, overflow: 'hidden' }}>
            {url ? (
              isVid ? (
                // Real first-frame thumbnail, same treatment as the single-video
                // branch in renderMedia below — muted+no controls so it renders
                // as a static poster, the Play icon overlay (below) is what
                // actually invites the tap-to-open-lightbox interaction.
                // autoPlay+immediate-pause (not just preload="metadata") — on
                // mobile Chrome/Android WebView, preload="metadata" alone only
                // fetches duration/dimensions, not an actual decoded frame, so
                // the thumbnail stayed blank until the video was played. A
                // muted autoplay is exempt from browser autoplay-blocking and
                // forces the first frame to decode+paint; onLoadedData pauses
                // it right away so nothing actually plays.
                <video src={url} autoPlay muted playsInline preload="auto" disablePictureInPicture onLoadedData={e => { try { e.target.pause(); } catch {} }} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#1a1a1a' }} />
              ) : (
                <img src={url} alt="" loading="lazy" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                  onError={(e) => { e.target.onerror = null; e.target.style.opacity = 0.2; }} />
              )
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-1)', opacity: 0.6 }} />
              </div>
            )}
            {isVid && url && !showOverlay && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={13} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                </div>
              </div>
            )}
            {showOverlay && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>+{overflow}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const renderMedia = (url, type, isMe, fileName, fileSize, expiresAt, loading, onOpenLightbox, isLight, msg, username, hideTick = false, flush = false, wallpaperBg = null, wallpaperForceBlack = false, themeGradient = null, themeColor = null) => {
  if (!url && !type) return null;
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  const isAudio = type?.startsWith('audio/');
  // hideTick: this media has a caption, which already gets its own tick on
  // the caption's own line (see the msg-bubble layout) — showing a second
  // one on the media itself, right next to the caption's, was the "we
  // already had a tick" duplicate the caption/media stacking fix removed.
  const tick = (isMe && msg && !hideTick) ? <MessageTick msg={msg} username={username} isLight={isLight} /> : null;
  const cardTick = (isMe && msg && !hideTick) ? <MessageTick msg={msg} username={username} isLight={isLight} onLightSurface /> : null;
  // Voice note bubbles use a light tinted background in light mode (unlike the dark
  // text/media bubbles the default white tick assumes), so treat it as a light
  // surface in light mode only — dark mode keeps the original white tick unchanged.
  const voiceTick = (isMe && msg && !hideTick) ? <MessageTick msg={msg} username={username} isLight={isLight} onLightSurface={isLight} /> : null;

  if (isAudio) return <AudioPlayerBubble url={url} expiresAt={expiresAt} isMe={isMe} isLight={isLight} loading={loading} tick={voiceTick} forwarded={msg?.forwarded} wallpaperBg={wallpaperBg} wallpaperForceBlack={isMe && wallpaperForceBlack} themeGradient={isMe ? themeGradient : null} themeColor={isMe ? themeColor : null} />;

  if (!isImg && !isVid) return <FileCard url={url} type={type} fileName={fileName} fileSize={fileSize} isMe={isMe} isLight={isLight} expiresAt={expiresAt} loading={loading} tick={cardTick} forwarded={msg?.forwarded} wallpaperBg={wallpaperBg} wallpaperForceBlack={isMe && wallpaperForceBlack} themeGradient={isMe ? themeGradient : null} themeColor={isMe ? themeColor : null} />;

  if (!url) {
    // 300/320 (not the old 220/200) — matches roughly what WhatsApp renders a
    // photo at; the old size made every image look like a thumbnail next to
    // a normal-width caption line.
    if (loading) return <div style={{ width: 300, height: isVid ? 200 : 240, borderRadius: flush ? '20px 20px 0 0' : 10, background: isMe ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-1)', opacity: 0.6 }} /></div>;
    // Decrypt/download never finished (or failed) within the wait window —
    // rendering nothing here is what read as "I sent it but there's no
    // video/image in the chat at all". Say so instead, so a failure is
    // visible and diagnosable instead of silent. Reopening the chat re-runs
    // history decryption from scratch, which is a real retry path.
    return (
      <div style={{ width: 300, height: isVid ? 200 : 240, borderRadius: flush ? '20px 20px 0 0' : 10, background: isMe ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', padding: 12, textAlign: 'center' }}>
        <ImageOff size={18} style={{ opacity: 0.7 }} />
        <span style={{ fontSize: 11.5 }}>Couldn't load {isVid ? 'video' : 'image'} — reopen chat to retry</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 0, borderRadius: flush ? '20px 20px 0 0' : 10, overflow: 'hidden', background: '#000', maxWidth: 300, position: 'relative', cursor: 'pointer' }}>
      {isImg ? (
        <>
          <img
            src={url}
            alt="Shared media"
            loading="lazy"
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            onClick={() => onOpenLightbox(url, type)}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<div style="color:#666;font-size:11px;padding:16px;text-align:center">Failed to load image</div>';
            }}
          />
          {msg?.forwarded && <div style={{ position: 'absolute', top: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Forward size={8} color="#fff" style={{ flexShrink: 0 }} />Forwarded</div>}
          {expiresAt && (() => { const dL = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24)); if (dL <= 0) return null; return <div style={{ position: 'absolute', bottom: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Clock size={8} color="#fff" style={{ flexShrink: 0 }} />Expires in {dL} day{dL !== 1 ? 's' : ''}</div>; })()}
          {tick && <div style={{ position: 'absolute', bottom: 5, right: 6, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>{tick}</div>}
        </>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Real first-frame thumbnail, same sizing as the image branch above
              (width 100%, capped height, cover) — muted+no controls so it
              renders as a static poster instead of actually playing; tapping
              opens the lightbox, which is where it actually plays.
              autoPlay+immediate-pause (not just preload="metadata") — on
              mobile Chrome/Android WebView, preload="metadata" alone only
              fetches duration/dimensions, not an actual decoded frame, so the
              thumbnail stayed blank until played. A muted autoplay is exempt
              from browser autoplay-blocking and forces the first frame to
              decode+paint; onLoadedData pauses it right away. */}
          <video
            src={url}
            autoPlay
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            onLoadedData={e => { try { e.target.pause(); } catch {} }}
            onContextMenu={e => e.preventDefault()}
            style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block', background: '#000' }}
            onClick={() => onOpenLightbox(url, type)}
          />
          <div onClick={() => onOpenLightbox(url, type)} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(var(--brand-1-rgb),0.5)' }}>
              <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </div>
          </div>
          {msg?.forwarded && <div style={{ position: 'absolute', top: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Forward size={8} color="#fff" style={{ flexShrink: 0 }} />Forwarded</div>}
          {expiresAt && (() => { const dL = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24)); if (dL <= 0) return null; return <div style={{ position: 'absolute', bottom: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Clock size={8} color="#fff" style={{ flexShrink: 0 }} />Expires in {dL} day{dL !== 1 ? 's' : ''}</div>; })()}
          {tick && <div style={{ position: 'absolute', bottom: 5, right: 6, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>{tick}</div>}
        </div>
      )}
    </div>
  );
};

import { formatDistanceToNow } from 'date-fns';
import { useScrollToBottom } from '../hooks/useScrollToBottom';
import { useVisualViewportResize } from '../hooks/useVisualViewportResize';
import { useStableViewportHeight } from '../hooks/useStableViewportHeight';
import { useDebounce } from '../hooks/useDebounce';
import { useCrypto } from '../contexts/CryptoContext';
import { encryptDM, encryptGroupMessage, decryptDM, decryptGroupMessage, decryptDMSenderCopy, robustDecode, encryptMedia, decryptMedia, packMediaKeyAndCaption, unpackMediaKeyAndCaption, sanitizeReplyToForWire } from '../lib/crypto';
import { resolveDmRecipientPublicKey } from '../lib/dmKeyResolution.js';
import { isSahaplayOfficialGroup } from '../lib/sahaplayOfficial';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Shown instead of raw content for group messages sent before client-side group E2EE
// shipped (the old server-side-only encryption scheme, since retired — no dual-format
// decrypt support). Media wasn't part of that old scheme (files were always stored
// unencrypted), so it keeps rendering normally; only legacy text is replaced.
const LEGACY_GROUP_TEXT_PLACEHOLDER = 'Start a conversation';

// Shown for a group message that was edited before this fix (an edit that resent
// plaintext, which the backend then paired with the message's OLD nonce/keys —
// permanently mismatched, so decrypt can never succeed for that row). Distinct
// from LEGACY_GROUP_TEXT_PLACEHOLDER so it's not confused with an unrelated
// pre-upgrade message.
const CORRUPTED_EDIT_PLACEHOLDER = 'This edited message can no longer be decrypted';
// A message decrypted with whatever keyPair happened to be available the
// INSTANT it arrived over the socket (see the retry effect near
// keyPairRef below for why that's sometimes too early) — never
// re-attempted afterward on its own, so this exact string doubles as the
// marker the retry effect looks for.
const ENCRYPTED_PLACEHOLDER = '🔒 Encrypted message';

const resolveMediaUrl = (url, baseUrl) => {
  if (!url) return '';
  // Clean up any double-prepended URLs (e.g. "http://localhost:3001https://...")
  if (url.includes('http://') || url.includes('https://')) {
    const httpIdx = url.lastIndexOf('http');
    if (httpIdx > 0) {
      url = url.substring(httpIdx);
    }
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

// CSS for typing indicators
const typingCss = `
  @keyframes dot-wave {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes pulse-red { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
  @keyframes wave-bar { from { height: 20%; } to { height: 80%; } }
  @keyframes reactorsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  /* ── Mobile/tablet: replace visible Reply/timestamp/Report with swipe + long-press gestures ── */
  @media (max-width: 1023.98px) {
    .msg-meta-row { display: none !important; }
    /* "Select messages" is desktop-only there — touch users long-press a message
       row's empty side area to enter select mode instead. */
    .desktop-only-menu-item { display: none !important; }
  }
  .typing-dots { display: inline-flex; gap: 2px; align-items: center; margin-left: 4px; }
  .typing-dot { width: 4px; height: 4px; background: var(--brand-1); borderRadius: 50%; display: inline-block; animation: dot-wave 1.3s infinite ease-in-out; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  
  /* ── Chat Menu Hover Effects — mirrors RoomChatPanel.jsx's dropdown exactly, so the
     message context menu looks/behaves identically in both surfaces. ── */
  .menu-btn { color: var(--menu-item-text); transition: all 0.2s ease; }
  .menu-btn svg { transition: all 0.2s ease; }
  /* Hover = background tint only. Icon/text color deliberately does NOT
     change here (kept at the base .menu-btn color) — a prior version forced
     both to var(--brand-1) on hover, which is what needs to stop. */
  .chat-widget-main-panel .menu-btn:hover {
    background: rgba(59, 130, 246, 0.14) !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .menu-btn:hover {
    background: rgba(59, 130, 246, 0.12) !important;
  }

  .chat-widget-main-panel .menu-btn-danger { color: #ef4444 !important; }
  .chat-widget-main-panel .menu-btn-danger svg { color: #ef4444 !important; }
  /* NOTE: these two must carry the same ".chat-widget-main-panel" prefix as
     ".menu-btn:hover" above (same specificity tier), declared AFTER it, so the
     danger/del-me color wins the tie by source order instead of the generic
     indigo hover color winning on raw specificity (that was the actual cause of
     "Unsend/Delete for me turning blue on hover" — .menu-btn:hover's prefixed
     selector was accidentally MORE specific than the unprefixed .menu-btn-danger:hover). */
  .chat-widget-main-panel .menu-btn-danger:hover { background: rgba(239, 68, 68, 0.12) !important; color: #ef4444 !important; }
  .chat-widget-main-panel .menu-btn-danger:hover svg { color: #ef4444 !important; }

  /* "Delete for me": keep the normal text color, only the hover background turns light red */
  .chat-widget-main-panel .menu-btn-del-me { color: var(--menu-item-text) !important; }
  .chat-widget-main-panel .menu-btn-del-me svg { color: var(--menu-item-text) !important; }
  .chat-widget-main-panel .menu-btn-del-me:hover {
    background: rgba(239, 68, 68, 0.1) !important;
    color: var(--menu-item-text) !important;
  }
  .chat-widget-main-panel .menu-btn-del-me:hover svg { color: var(--menu-item-text) !important; }

  /* ── Data-hovertype: guaranteed color change for both icon and text ── */
  [data-hovertype="danger"]:hover { color: #dc2626 !important; background: rgba(239, 68, 68, 0.12) !important; }
  [data-hovertype="danger"]:hover * { color: #dc2626 !important; }
  [data-hovertype="primary"]:hover { color: var(--brand-1-dark) !important; background: rgba(var(--brand-1-rgb), 0.1) !important; }
  [data-hovertype="primary"]:hover * { color: var(--brand-1-dark) !important; }

  /* Modal Button Transitions */
  .modal-btn-transition { transition: transform 0.2s ease-in-out; }
  .modal-btn-transition:hover { transform: translateY(-2px); }

  html[data-theme='light'] .menu-btn-danger:hover { background: rgba(239, 68, 68, 0.12) !important; color: #dc2626 !important; }
  html[data-theme='light'] .menu-btn-danger:hover svg { color: #dc2626 !important; }
  html[data-theme='light'] .chat-widget-main-panel .menu-btn-danger:hover { background: rgba(239, 68, 68, 0.12) !important; color: #dc2626 !important; }
  html[data-theme='light'] .chat-widget-main-panel .menu-btn-danger:hover svg { color: #dc2626 !important; }
  .menu-btn-primary:hover { background: rgba(var(--brand-1-rgb), 0.1) !important; color: var(--brand-1) !important; }
  .menu-btn-primary:hover svg { color: var(--brand-1) !important; }
  html[data-theme='light'] .menu-btn-primary:hover { background: rgba(var(--brand-1-rgb), 0.1) !important; color: var(--brand-1-dark) !important; }
  html[data-theme='light'] .menu-btn-primary:hover svg { color: var(--brand-1-dark) !important; }

  /* ── Modal Light Mode Overrides ── */
  html[data-theme='light'] .chat-modal-box { 
    background: #ffffff !important; 
    border-color: #e2e8f0 !important; 
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
    --modal-title: #0f172a; 
    --modal-desc: #475569;
    --modal-warn-bg: #fff1f2;
    --modal-warn-border: #fecaca;
    --modal-warn-text: #000;
    --modal-btn-bg: #f1f5f9;
    --modal-btn-border: #e2e8f0;
    --modal-btn-text: #0f172a;
  }
  .chat-modal-cancel {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  .chat-modal-cancel:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    transform: translateY(-1px);
  }
  html[data-theme='light'] .chat-modal-cancel:hover {
    background: #e2e8f0 !important;
    color: #000 !important;
  }
  .chat-modal-danger-btn {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  .chat-modal-danger-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
  html[data-theme='light'] .chat-modal-danger-btn:hover {
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2) !important;
  }
  /* ── Dropdown Menu Themes ── */
  .chat-widget-main-panel {
    --dropdown-bg: #1f2026;
    --dropdown-border: rgba(255,255,255,0.08);
    --dropdown-shadow: 0 8px 32px rgba(0,0,0,0.7);
    --menu-item-text: #eee;
    --menu-item-hover: rgba(255,255,255,0.05);
    --menu-icon: #aaa;
    --menu-divider: rgba(255,255,255,0.22);
    --header-text: #ffffff;
    --header-btn: #888888;
    --input-bg: rgba(255,255,255,0.04);
    --input-border: rgba(255,255,255,0.08);
    --input-text: #ffffff;
  }

  html[data-theme='light'] .chat-widget-main-panel {
    --dropdown-bg: #ffffff;
    --dropdown-border: #e2e8f0;
    --dropdown-shadow: 0 10px 40px rgba(0,0,0,0.12);
    --menu-item-text: #0f172a;
    --menu-item-hover: #f1f5f9;
    --menu-icon: #475569;
    --menu-divider: #cbd5e1;
    --header-text: #0f172a;
    --header-btn: #475569;
    --input-bg: #f8fafc;
    --input-border: #e2e8f0;
    --input-text: #0f172a;
  }

  /* Own-message ("msg-sent stay-white") bubbles force color:#fff !important on all
     descendants in light mode (to keep the purple gradient bubble readable) — the
     Copy/Delete-for-me items in this dropdown got caught by that and rendered
     invisible (white text/icon on the white dropdown popup). Same fix already
     applied in RoomChatPanel.jsx's own dropdown. */
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn {
    color: var(--menu-item-text) !important;
    -webkit-text-fill-color: var(--menu-item-text) !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn svg,
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn svg *,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn svg,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn svg * {
    color: var(--menu-item-text) !important;
    -webkit-text-fill-color: var(--menu-item-text) !important;
    stroke: var(--menu-item-text) !important;
  }

  /* Same context (own-message bubble, light mode) but for the hover state, and for the
     danger (Unsend/Delete) and del-me (Delete for me) variants — mirrors
     RoomChatPanel.jsx's dropdown line for line so both surfaces match exactly. */
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn:hover,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn:hover {
    background: rgba(var(--brand-1-rgb), 0.1) !important;
    color: var(--brand-1-dark) !important;
    -webkit-text-fill-color: var(--brand-1-dark) !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn:hover svg,
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn:hover svg *,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn:hover svg,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn:hover svg * {
    color: var(--brand-1-dark) !important;
    -webkit-text-fill-color: var(--brand-1-dark) !important;
    stroke: var(--brand-1-dark) !important;
  }

  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-danger,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-danger {
    color: #ef4444 !important;
    -webkit-text-fill-color: #ef4444 !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-danger svg,
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-danger svg *,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-danger svg,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-danger svg * {
    color: #ef4444 !important;
    -webkit-text-fill-color: #ef4444 !important;
    stroke: #ef4444 !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-danger:hover,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-danger:hover {
    background: rgba(239, 68, 68, 0.12) !important;
    color: #dc2626 !important;
    -webkit-text-fill-color: #dc2626 !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-danger:hover svg,
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-danger:hover svg *,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-danger:hover svg,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-danger:hover svg * {
    color: #dc2626 !important;
    -webkit-text-fill-color: #dc2626 !important;
    stroke: #dc2626 !important;
  }

  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-del-me,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-del-me {
    color: var(--menu-item-text) !important;
    -webkit-text-fill-color: var(--menu-item-text) !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-del-me:hover,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-del-me:hover {
    background: rgba(239, 68, 68, 0.1) !important;
    color: var(--menu-item-text) !important;
    -webkit-text-fill-color: var(--menu-item-text) !important;
  }
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-del-me:hover svg,
  html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn-del-me:hover svg *,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-del-me:hover svg,
  html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn-del-me:hover svg * {
    color: var(--menu-item-text) !important;
    -webkit-text-fill-color: var(--menu-item-text) !important;
    stroke: var(--menu-item-text) !important;
  }

  /* Mobile & iPad view: the panel's fixed 380px width + right:20 anchor can push it
     past the left edge on narrow screens. Make it a proper full-screen, centered
     takeover instead — matches how the rest of the app treats modals on small screens. */
  @media (max-width: 1024px) {
    .chat-widget-main-panel:not(.gcw-force-dark) {
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      /* width/height forced to auto (not 100% / 100dvh, what this used to
         be) so nothing overrides the top/left/right/bottom pinning above —
         a fixed-position box with all four offsets at 0 and an auto size
         always fills exactly the real current viewport, which is the one
         thing that's reliably correct through an Android on-screen-
         keyboard resize. 100dvh (and 100%, which for a fixed element with
         explicit offsets on all sides would otherwise win over them and
         reintroduce the same issue) was seen to reflect a transient,
         narrower viewport while the keyboard was still animating open —
         which is what read as "the chat theme shrinks on both sides when
         the keyboard opens". This sidesteps that rather than chasing which
         specific viewport unit is unreliable on which device. */
      width: auto !important;
      height: auto !important;
      max-width: 100% !important;
      border-radius: 0 !important;
    }
  }

  /* The old CSS-only position:fixed + height:100lvh rule that used to live
     here was replaced by an inline style driven by useStableViewportHeight
     (see the backdrop's JSX) — 100lvh has real device/WebView support gaps,
     and even where it is supported the CSS media query only reacted to the
     keyboard's resize, not before it, leaving the same catch-up-lag window
     a fully synchronous JS value doesn't have. See the backdrop's own
     comment for the full reasoning. */

  .chat-menu-item {
    transition: background 0.18s ease-in-out !important;
  }

  .chat-menu-item:hover {
    background: var(--menu-item-hover) !important;
  }

  /* ── Message Text Overrides ── */
  html[data-theme='light'] .msg-received {
    color: #000000 !important;
  }
  html[data-theme='light'] .msg-received * {
    color: #000000 !important;
  }
  html[data-theme='light'] .msg-received a {
    color: var(--brand-1-dark) !important;
    text-decoration: underline !important;
  }
  .stay-white { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
  /* Ensure stay-white elements inside received messages stay white (higher specificity than msg-received *) */
  html[data-theme='light'] .msg-received .stay-white,
  html[data-theme='light'] .msg-received .stay-white * {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }

  /* Voice note text overrides inside message bubbles in light mode — only
     when there's no wallpaper; a wallpaper's own per-image color (see
     .on-wallpaper block below) takes over otherwise. Reads --fc-sub-c (set
     by AudioPlayerBubble alongside FileCard's own vars) so a themed sent
     voice note's time/expiry turn white the same way fc-name/fc-sub do
     below — this stylesheet (not App.jsx's) is the one that actually wins
     the cascade for these two classes (see the comment just below), so it's
     the one that has to carry the var, not just a hardcoded default. */
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-time,
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-time * {
    color: var(--fc-sub-c, rgba(0,0,0,0.6)) !important;
    -webkit-text-fill-color: var(--fc-sub-c, rgba(0,0,0,0.6)) !important;
  }
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-expiry,
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .rcp-vn-expiry * {
    color: var(--fc-sub-c, rgba(0,0,0,0.6)) !important;
    -webkit-text-fill-color: var(--fc-sub-c, rgba(0,0,0,0.6)) !important;
  }

  /* Document card text overrides — on a sent (msg-sent/stay-white) bubble in
     light mode, App.jsx's global .fc-name/.fc-sub rule alone wasn't winning
     against the white-text-forcing those classes apply here, so pin all three
     locally the same way RoomChatPanel.jsx already does. Skipped on a
     wallpaper (see .on-wallpaper block below) for the same reason as above.
     Reads --fc-name-c/--fc-sub-c (set by FileCard when a Chat Theme color is
     active) so a themed sent card's text turns white — this stylesheet ties
     App.jsx's own copy of these same three selectors on specificity, and
     (being a component-local <style> tag mounted after App.jsx's) wins the
     tie in practice, so THIS is the copy that has to carry the var, not
     just App.jsx's. */
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-name,
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-name * {
    color: var(--fc-name-c, #111111) !important;
    -webkit-text-fill-color: var(--fc-name-c, #111111) !important;
  }
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-sub,
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-sub * {
    color: var(--fc-sub-c, rgba(0,0,0,0.65)) !important;
    -webkit-text-fill-color: var(--fc-sub-c, rgba(0,0,0,0.65)) !important;
  }
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-expiry,
  html[data-theme='light'] .msg-bubble:not(.on-wallpaper) .fc-expiry * {
    color: var(--fc-sub-c, rgba(0,0,0,0.62)) !important;
    -webkit-text-fill-color: var(--fc-sub-c, rgba(0,0,0,0.62)) !important;
  }

  /* On a wallpaper, file-card/voice-note text is always white — same as
     dark mode already renders it — instead of a color keyed to the
     light/dark theme toggle. Applies in both light and dark mode (no
     html[data-theme] gate) since it's the wallpaper, not the toggle, that
     decides these need it. */
  .msg-bubble.on-wallpaper .fc-name,
  .msg-bubble.on-wallpaper .fc-name *,
  .msg-bubble.on-wallpaper .fc-sub,
  .msg-bubble.on-wallpaper .fc-sub *,
  .msg-bubble.on-wallpaper .fc-expiry,
  .msg-bubble.on-wallpaper .fc-expiry *,
  .msg-bubble.on-wallpaper .rcp-vn-time,
  .msg-bubble.on-wallpaper .rcp-vn-time *,
  .msg-bubble.on-wallpaper .rcp-vn-expiry,
  .msg-bubble.on-wallpaper .rcp-vn-expiry * {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  /* App.jsx also carries its own global "html[data-theme='light']
     .msg-bubble .fc-name"-style rule (no .on-wallpaper awareness) at the
     SAME specificity tier (html + attr + 2 classes) as the unprefixed
     override just above in light mode, so which one won was coming down to
     DOM order between two unrelated <style> tags — fragile, and it was
     losing in practice. This adds one more class to the tally (via the
     harmless ".on-wallpaper.on-wallpaper" repeat, since .msg-bubble here is
     already guaranteed) so it wins outright in light mode regardless of
     source order. */
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .fc-name,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .fc-name *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .fc-sub,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .fc-sub *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .fc-expiry,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .fc-expiry *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .rcp-vn-time,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .rcp-vn-time *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .rcp-vn-expiry,
  html[data-theme='light'] .msg-bubble.on-wallpaper.on-wallpaper .rcp-vn-expiry * {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  /* Zen Interior override, sent side only: the blanket white-on-wallpaper
     rules above assume every wallpaper needs white text for contrast, which
     is wrong for a sent bubble on a light wallpaper like this one (it gets
     its own light/white fill, not a dark glass overlay). wp-sent-black is
     only added to isMe bubbles on this specific wallpaper (see className
     below). Two variants, each with one more class than the rule it needs
     to beat, so this wins regardless of app light/dark mode or source order
     — same reasoning as the two blocks above. */
  .msg-bubble.on-wallpaper.wp-sent-black .fc-name,
  .msg-bubble.on-wallpaper.wp-sent-black .fc-name *,
  .msg-bubble.on-wallpaper.wp-sent-black .fc-sub,
  .msg-bubble.on-wallpaper.wp-sent-black .fc-sub *,
  .msg-bubble.on-wallpaper.wp-sent-black .fc-expiry,
  .msg-bubble.on-wallpaper.wp-sent-black .fc-expiry *,
  .msg-bubble.on-wallpaper.wp-sent-black .rcp-vn-time,
  .msg-bubble.on-wallpaper.wp-sent-black .rcp-vn-time *,
  .msg-bubble.on-wallpaper.wp-sent-black .rcp-vn-expiry,
  .msg-bubble.on-wallpaper.wp-sent-black .rcp-vn-expiry * {
    color: #111111 !important;
    -webkit-text-fill-color: #111111 !important;
  }
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .fc-name,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .fc-name *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .fc-sub,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .fc-sub *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .fc-expiry,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .fc-expiry *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .rcp-vn-time,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .rcp-vn-time *,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .rcp-vn-expiry,
  html[data-theme='light'] .msg-bubble.on-wallpaper.wp-sent-black.wp-sent-black .rcp-vn-expiry * {
    color: #111111 !important;
    -webkit-text-fill-color: #111111 !important;
  }

  /* ── Fullscreen Force-Dark: override every light-mode selector ── */
  /* Applied via .gcw-force-dark on the panel root when transparentMode=true */
  html[data-theme='light'] .chat-widget-main-panel.gcw-force-dark {
    --dropdown-bg: #1f2026;
    --dropdown-border: rgba(255,255,255,0.08);
    --dropdown-shadow: 0 8px 32px rgba(0,0,0,0.7);
    --menu-item-text: #eee;
    --menu-item-hover: rgba(255,255,255,0.05);
    --menu-icon: #aaa;
    --menu-divider: rgba(255,255,255,0.22);
    --header-text: #ffffff;
    --header-btn: #888888;
    --input-bg: rgba(255,255,255,0.04);
    --input-border: rgba(255,255,255,0.08);
    --input-text: #ffffff;
  }
  html[data-theme='light'] .gcw-force-dark .msg-received {
    color: #ffffff !important;
  }
  html[data-theme='light'] .gcw-force-dark .msg-received * {
    color: #ffffff !important;
  }
  html[data-theme='light'] .gcw-force-dark .msg-received a {
    color: var(--brand-1-light) !important;
  }
  html[data-theme='light'] .gcw-force-dark .chat-modal-box {
    background: rgba(20,20,25,0.95) !important;
    border-color: rgba(255,255,255,0.08) !important;
    box-shadow: 0 25px 50px rgba(0,0,0,0.8) !important;
  }
  
  /* Ensure selects and options are readable in ALL themes (Light/Dark) within the chat panel */
  .chat-widget-main-panel select,
  .chat-widget-main-panel option {
    background: #1f2026 !important;
    color: #ffffff !important;
    border-color: rgba(255,255,255,0.15) !important;
  }
  
  /* Guarantee Dropdown Menus within Force-Dark stay dark even against global !important rules */
  /* This part is specifically for Light Mode + Fullscreen */
  html[data-theme='light'] .gcw-force-dark .nav-dropdown {
    background: #1f2026 !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
  }
  html[data-theme='light'] .gcw-force-dark .chat-menu-item {
    color: #eee !important;
  }
  html[data-theme='light'] .gcw-force-dark .chat-menu-item svg {
    color: #aaa !important;
    stroke: #aaa !important;
  }
  html[data-theme='light'] .gcw-force-dark .chat-menu-item:hover {
    background: rgba(255,255,255,0.12) !important;
  }

  /* Destructive hover in Force-Dark: ensure icon ALSO turns red */
  html[data-theme='light'] .gcw-force-dark .menu-btn-destructive:hover {
    background: rgba(239, 68, 68, 0.2) !important;
    color: #ef4444 !important;
  }
  html[data-theme='light'] .gcw-force-dark .menu-btn-destructive:hover svg {
    color: #ef4444 !important;
    stroke: #ef4444 !important;
  }

`;

// Avatar helpers
function getInitials(name) { return (name || '?').slice(0, 2).toUpperCase(); }
function getAvatarColor(name) {
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#10b981', '#3b82f6', '#06b6d4'];
  let h = 0; for (let c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

// Detects raw E2EE ciphertext that slipped through decryption —
// Base64 blob: ≥20 chars, no spaces, only base64 alphabet (plus urlsafe variants).
// Used to guard the conversation list preview and notifications from showing raw ciphertext.
function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false;
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
  if (str.startsWith('encv1:')) return true;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
}

// A poll message's decryptedText IS the raw poll definition JSON (see
// sendPollMessage/submitPollEdit — JSON.stringify({question, options,
// allowMultiple})). Neither the toast/notification preview nor replyTo
// snapshots carry an isPoll flag, so it's detected by shape instead,
// matching messagePreview.jsx's isPollJSON — otherwise a poll leaks as raw
// JSON in toasts, desktop notifications, and reply previews.
function isPollJSON(text) {
  if (!text || typeof text !== 'string' || text[0] !== '{') return false;
  try {
    const obj = JSON.parse(text);
    return !!(obj && typeof obj.question === 'string' && Array.isArray(obj.options));
  } catch {
    return false;
  }
}

// WhatsApp-style call-summary bubble — renders in place of plain text
// whenever a decrypted DM message starts with CALL_LOG_PREFIX (see
// CallContext.writeCallLog). Tap to redial, mirroring WhatsApp.
// wallpaperTextColor: pass the SAME color already computed for the rest of
// this bubble's text when a wallpaper theme is active ('#ffffff' or
// '#111111' depending on the wallpaper's own darkness), null/undefined
// otherwise. Without it, the icon circle always used a faint WHITE tint
// with a WHITE icon for a sent call — invisible on a light-toned wallpaper
// (e.g. Zen Interior) where the bubble itself renders light/white, since
// that's white-icon-on-white-circle-on-white-bubble. Default (no wallpaper)
// behavior is untouched.
function CallLogBubble({ data, isMe, myUsername, onRedial, wallpaperTextColor }) {
  const { callType, status, durationSeconds, initiatedBy } = data || {};
  const isVideo = callType === 'video';
  const Icon = isVideo ? Video : Phone;
  const iWasCaller = !!(initiatedBy && myUsername && initiatedBy.toLowerCase() === myUsername.toLowerCase());
  let sub = '';
  let missedForMe = false;
  if (status === 'ended') {
    const secs = Math.max(0, Number(durationSeconds) || 0);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    sub = `${m}:${String(s).padStart(2, '0')}`;
  } else if (status === 'missed') {
    sub = iWasCaller ? 'No answer' : 'Missed call';
    missedForMe = !iWasCaller;
  } else if (status === 'declined') {
    sub = iWasCaller ? 'Call declined' : 'You declined';
  } else if (status === 'busy') {
    sub = 'Unavailable';
  }
  const onWallpaper = !!wallpaperTextColor;
  const wallpaperNeedsDarkIcon = wallpaperTextColor === '#111111';
  const circleBg = missedForMe
    ? 'rgba(239,68,68,0.18)'
    : (onWallpaper ? (wallpaperNeedsDarkIcon ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)') : 'rgba(255,255,255,0.14)');
  const iconColor = missedForMe ? '#ef4444' : (onWallpaper ? wallpaperTextColor : (isMe ? '#fff' : 'var(--brand-1-light)'));
  return (
    <div onClick={onRedial} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onRedial ? 'pointer' : 'default', minWidth: 130 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: circleBg }}>
        {missedForMe ? <PhoneMissed size={15} color="#ef4444" /> : <Icon size={15} color={iconColor} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{isVideo ? 'Video call' : 'Voice call'}</div>
        <div style={{ fontSize: 11, opacity: 0.8, color: missedForMe ? '#f87171' : undefined }}>{sub}</div>
      </div>
    </div>
  );
}

// Snapshot of the message being replied to, sent alongside a reply so the
// recipient can render a preview. Keeps mediaType/mediaFileName (rather than
// collapsing every non-video media type to a hardcoded 'Photo' string) so a
// reply to a voice note or file shows the real label/filename.
function buildReplySnapshot(src, fallbackUsername) {
  if (!src) return null;
  return {
    id: src.id,
    username: src.senderName || src.username || fallbackUsername,
    mediaType: src.mediaType || null,
    mediaFileName: src._fileName || src.mediaFileName || null,
    message: src.mediaType ? null : (src.decryptedText || (looksLikeCiphertext(src.message || '') ? '' : (src.message || '')))
  };
}

// Resolves a poll voter's avatar for someone who's neither the poll's own
// sender nor me — a group poll's other voters have no dedicated avatar
// source otherwise. Any OTHER message already decrypted in this chat from
// that username carries their real senderAvatar, so reusing it here is the
// same trick this file's own blocked-user-avatar lookup already relies on
// (see the `fromMsg` lookup a few hundred lines below).
function findAvatarFromMessages(uname, msgs) {
  const m = (msgs || []).find(mm => (mm.senderName || mm.username || '').toLowerCase() === uname && mm.senderAvatar);
  return m ? getAvatarUrl(m.senderAvatar) : null;
}

function truncateToFewWords(str) {
  if (!str) return 'New message';
  const lines = str.split('\n');
  const firstLine = lines[0] || '';
  const words = firstLine.trim().split(/\s+/);
  if (lines.length > 1 || words.length > 10) {
    return words.slice(0, 10).join(' ') + '...';
  }
  return firstLine;
}

function getDateKey(ts) {
  const d = new Date(Number(ts));
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(ts) {
  const date = new Date(Number(ts));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - msgDay) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

// Second-pass resolver: after history decryption, fix any ciphertext stored in
// replyTo.message by substituting the decryptedText of the original message.
function resolveReplyMessages(messages) {
  return messages.map(m => {
    if (!m.replyTo) return m;
    const raw = m.replyTo.message || '';
    if (raw && !looksLikeCiphertext(raw)) return m; // already readable — keep it
    const original = messages.find(o => String(o.id) === String(m.replyTo.id));
    if (!original) return m;
    const resolved =
      original.decryptedText ||
      (original.mediaType ? (original.mediaType.startsWith('video') ? 'Video' : original.mediaType.startsWith('image') ? 'Photo' : original.mediaType.startsWith('audio') ? 'Voice Note' : 'File') : '') ||
      (looksLikeCiphertext(original.message || '') ? '' : (original.message || ''));
    return { ...m, replyTo: { ...m.replyTo, message: resolved } };
  });
}

function ReadReceipt({ msg, isGroup, username, isLight }) {
  const [isOpen, setIsOpen] = useState(false);
  const readers = (msg.seenBy || []).filter(r => r.username.toLowerCase() !== username.toLowerCase());
  
  if (readers.length === 0) return null;
  
  const formatSeenTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className="read-receipt-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
        fontSize: 11,
        color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none'
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(!isOpen)}
    >
      {isGroup ? (
        <>
          {/* Avatar stack */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {readers.slice(0, 3).map((r, idx) => {
              const avatar = r.avatar;
              const avatarSrc = getAvatarUrl(avatar);
              return (
                <div
                  key={r.username}
                  // stay-white: this letter sits on the brand-colored circle
                  // above, never on a plain light-mode card, so it always
                  // needs to read white — without this class, App.jsx's
                  // light-mode stylesheet has a blanket rule that rewrites
                  // any literal white inline color (this one included) to
                  // near-black, same bug as the poll voter-avatar letter fix.
                  className="stay-white"
                  style={{
                    marginLeft: idx > 0 ? -8 : 0,
                    border: isLight ? '1.5px solid #fff' : '1.5px solid var(--room-chat-bg, #0f0f1a)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    width: 16,
                    height: 16,
                    background: 'var(--brand-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    color: '#fff',
                    zIndex: 10 - idx
                  }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={r.username} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    r.username.slice(0, 1).toUpperCase()
                  )}
                </div>
              );
            })}
            {readers.length > 3 && (
              <div
                className="stay-white"
                style={{
                  marginLeft: -8,
                  border: isLight ? '1.5px solid #fff' : '1.5px solid var(--room-chat-bg, #0f0f1a)',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 7,
                  color: '#fff',
                  fontWeight: 600,
                  zIndex: 5
                }}
              >
                +{readers.length - 3}
              </div>
            )}
          </div>
          <span style={{ color: isLight ? '#475569' : 'var(--text-muted, #94a3b8)', opacity: 0.8 }}>Seen</span>
        </>
      ) : (
        <span style={{ color: isLight ? '#475569' : 'var(--text-muted, #94a3b8)', opacity: 0.8 }}>Seen</span>
      )}

      {/* Tooltip */}
      {isOpen && (
        <div 
          className="read-receipt-tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 6,
            background: isLight ? 'rgba(100, 116, 139, 0.98)' : 'rgba(15, 15, 26, 0.95)',
            backdropFilter: 'blur(10px)',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.15)' : '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 1000,
            minWidth: 150,
            maxWidth: 250,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            pointerEvents: 'auto'
          }}
        >
          <div className="stay-color" style={{ fontWeight: 600, fontSize: 10, color: isLight ? '#cbd5e1' : '#ffffff', borderBottom: isLight ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
            Seen by
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
            {readers.map(r => {
              const avatar = r.avatar;
              const avatarSrc = getAvatarUrl(avatar);
              return (
                <div key={r.username} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* stay-white: same fallback-letter-on-brand-circle case as
                      the avatar stack above. */}
                  <div
                    className="stay-white"
                    style={{
                      borderRadius: '50%',
                      overflow: 'hidden',
                      width: 14,
                      height: 14,
                      background: 'var(--brand-1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      color: '#fff',
                      flexShrink: 0
                    }}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={r.username} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      r.username.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <span className="stay-color" style={{ fontSize: 10, color: isLight ? '#cbd5e1' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {r.username}
                  </span>
                  <span className="stay-white" style={{ fontSize: 9, color: isLight ? '#ffffff' : 'rgba(255,255,255,0.9)', flexShrink: 0 }}>
                    {formatSeenTime(r.seenAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const getEffectiveSeenBy = (messages, username) => {
  if (!Array.isArray(messages)) return new Map();
  const latestSeenMap = new Map();
  messages.forEach((msg, idx) => {
    const sender = (msg.senderName || msg.username || '').toLowerCase();
    const readers = (msg.seenBy || []).filter(r => r.username.toLowerCase() !== sender);
    readers.forEach(r => {
      const rName = r.username.toLowerCase();
      if (rName !== username.toLowerCase()) {
        latestSeenMap.set(rName, { msgId: msg.id || msg.timestamp, reader: r, idx });
      }
    });
  });

  const messageSeenByMap = new Map();
  for (const [rName, val] of latestSeenMap.entries()) {
    const key = String(val.msgId);
    if (!messageSeenByMap.has(key)) {
      messageSeenByMap.set(key, []);
    }
    messageSeenByMap.get(key).push(val.reader);
  }
  return messageSeenByMap;
};

// WhatsApp-style tick status for a message *I* sent: 'read' (someone else's seenBy
// entry exists — blue), 'delivered' (delivered_at was recorded — grey double-check),
// or 'sent' (neither yet — single grey check). Mirrors RoomChatPanel.jsx's helper.
const getTickStatus = (msg, username) => {
  const seenByOthers = (msg.seenBy || []).some(r => r.username.toLowerCase() !== (username || '').toLowerCase());
  if (seenByOthers) return 'read';
  if (msg.deliveredAt) return 'delivered';
  return 'sent';
};

// onLightSurface: true for contexts that are always a whitish surface regardless
// of theme (e.g. FileCard, which is solid white in light mode and a translucent
// white overlay in dark mode) — a white tick there would be unreadable, so those
// use the theme-aware dark/grey tick instead. Everywhere else (text bubble, voice
// note bubble, image/video overlay) is always a colored/dark surface, so those
// default to a light tick regardless of theme.
const MessageTick = ({ msg, username, isLight, onLightSurface = false }) => {
  const status = getTickStatus(msg, username);
  const greyColor = onLightSurface ? (isLight ? 'rgba(0,0,0,0.4)' : '#8696a0') : 'rgba(255,255,255,0.85)';
  if (status === 'read') return <CheckCheck size={13} color="#34b7f1" style={{ flexShrink: 0 }} />;
  if (status === 'delivered') return <CheckCheck size={13} color={greyColor} style={{ flexShrink: 0 }} />;
  return <Check size={13} color={greyColor} style={{ flexShrink: 0 }} />;
};

function MessageText({ text, isMe, isLight }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  if (!text) return null;

  const words = text.trim().split(/\s+/);
  const lines = text.split('\n');
  const isLong = lines.length > 3 || words.length > 30 || text.length > 150;

  let displayText = text;
  if (isLong && !isExpanded) {
    if (lines.length > 3) {
      displayText = lines.slice(0, 3).join('\n') + '...';
    } else if (words.length > 30) {
      const parts = text.split(/(\s+)/);
      let wordCount = 0;
      const previewParts = [];
      for (const part of parts) {
        if (part.trim() !== '') {
          wordCount++;
        }
        previewParts.push(part);
        if (wordCount >= 30) {
          break;
        }
      }
      displayText = previewParts.join('') + '...';
    } else {
      displayText = text.substring(0, 150) + '...';
    }
  }

  const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
  const parts = displayText.split(urlRegex);
  const renderedText = parts.map((part, i) => {
    if (!part) return null;
    if (typeof part === 'string' && part.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i)) {
      let href = part;
      if (!href.match(/^https?:\/\//i)) href = 'http://' + href;
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{color: isMe ? '#fff' : (isLight ? '#2563eb' : '#38bdf8'), textDecoration: 'underline'}} 
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });

  return (
    <div>
      <div style={{ whiteSpace: "pre-wrap" }}>{renderedText}</div>
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: isMe ? '#93c5fd' : (isLight ? '#2563eb' : '#38bdf8'),
            cursor: 'pointer',
            padding: '2px 0 0 0',
            fontSize: '11px',
            fontWeight: 700,
            textDecoration: 'underline',
            display: 'inline-block',
            marginTop: 4
          }}
        >
          {isExpanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

// React.memo — this panel is mounted alongside a chat composer elsewhere
// on the page (e.g. Room.jsx's own RoomChatPanel) whose every keystroke
// re-renders that parent; without this, this whole ~9k-line widget (its
// own message list included) was re-rendering in lockstep with typing it
// has nothing to do with, on every character. Only helps as much as the
// props passed in are actually stable across those re-renders — see each
// caller's own props (Room.jsx wraps its inline onClose in useCallback
// for exactly this reason).
const GlobalChatWidget = React.memo(forwardRef(({
  isOpen, 
  onClose, 
  unreadCounts, 
  onMarkRead, 
  onMarkAllRead,
  onNewMessage,
  activeRoomTab,
  activeRoomPartner,
  // The roomId of whichever room hosts this GlobalChatWidget instance (see
  // Room.jsx's own mount), if any — always set for that instance regardless
  // of which chat tab is currently focused there, unlike activeRoomTab/
  // activeRoomPartner below which only reflect the CURRENTLY FOCUSED tab.
  // Room.jsx's own chat panel has its own dedicated toast for this room's
  // group chat no matter what else is on screen, so this widget must never
  // also toast for it — that gap (only suppressed on an exact tab-focus
  // match) was producing a second, duplicate toast whenever the room's own
  // chat panel wasn't the focused tab (e.g. desktop with the video tab up).
  hostRoomId,
  transparentMode = false,
  roomPermissions,
  isRoomHost,
  // Set by a parent that wants to jump straight into a specific chat from
  // outside the normal conversation-list click path — currently only the
  // push-notification tap handler (see lib/nativePush.js). Shape:
  // { partner, type: 'private' | 'room' }.
  pendingOpenChat,
  onPendingOpenChatHandled
}, ref) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const vaultMenuRef = useRef(null);
  const myUsername = (localStorage.getItem('watch_username') || '').toLowerCase();
  // My own avatar, used to resolve poll-vote avatars for MYSELF specifically
  // (see resolveAvatar in the poll bubble/view-votes renders below) — a poll's
  // own message object only ever carries `senderAvatar`, which is absent on
  // our own optimistic send and, for group polls someone else sent, never
  // describes my own vote at all. Fetched once and cached for the session;
  // failures just leave it null (resolveAvatar falls back to initials, same
  // as today).
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);
  useEffect(() => {
    if (!myUsername) return;
    let cancelled = false;
    const selfToken = localStorage.getItem('watch_token');
    fetch(`${API}/api/users/${myUsername}`, { headers: selfToken ? { Authorization: `Bearer ${selfToken}` } : {} })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.avatarPath) setMyAvatarUrl(getAvatarUrl(d.avatarPath)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [myUsername]);
  // ─── E2EE Keys ───
  const { keyPair, setKeyPair, needsReauth, reloadPrivateKeyWithPassword, isReady } = useCrypto();
  const call = useCall();
  // keyPairRef lets socket event handlers (stale closures from mount time) always see the
  // latest key pair — without this, handlers capture keyPair=null and silently fail to decrypt.
  const keyPairRef = useRef(null);
  useEffect(() => { keyPairRef.current = keyPair; }, [keyPair]);
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  // Tracks partners whose chat was cleared — persisted in localStorage so they survive page refresh
  const clearedPartnersRef = useRef((() => {
    try { return JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}'); } catch { return {}; }
  })());
  // Initialise from localStorage once on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
      clearedPartnersRef.current = saved;
    } catch {}
    
    const handleSync = (e) => {
      try {
        const user = (localStorage.getItem('watch_username') || '').toLowerCase();
        if (!user) return;
        
        const safeParse = (key, fallback) => {
          try {
            return JSON.parse(localStorage.getItem(key) || fallback);
          } catch { return JSON.parse(fallback); }
        };

        setMutedChats(prev => {
          const next = safeParse(`muted_chats_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setMutedCallChats(prev => {
          const next = safeParse(`muted_call_chats_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setLockedChats(prev => {
          const next = safeParse(`locked_chats_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setBlockedChats(prev => {
          const next = safeParse(`blocked_chats_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setBlockingMe(prev => {
          const next = safeParse(`blocking_me_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setPinnedChats(prev => {
          const next = safeParse(`pinned_chats_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setHiddenChats(prev => {
          const next = safeParse(`hidden_chats_${user}`, '[]');
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        
        try {
          const savedCleared = JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
          clearedPartnersRef.current = savedCleared;
        } catch {}

        // Only sync conversations for external storage changes or explicit updates
        // to prevent local state changes from triggering recursive sync loops
        if (e && (e.type === 'storage' || e.type === 'conversations_updated' || e.type === 'hidden_chats_updated' || e.type === 'chat_cleared_updated')) {
          const cached = localStorage.getItem('watch_recent_chats');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setConversations(prev => {
                // For guests: preserve in-memory unread counts that are ahead of localStorage,
                // because Room.jsx writes localStorage without unread and fires conversations_updated
                // right after guest_room_messages_updated — which would wipe any unread we just set.
                if (localStorage.getItem('watch_is_guest') === 'true') {
                  const prevUnread = new Map(
                    (Array.isArray(prev) ? prev : []).map(c => [(c.partner || c.id || '').toLowerCase(), c.unread || 0])
                  );
                  const merged = parsed.map(c => {
                    const key = (c.partner || c.id || '').toLowerCase();
                    const memUnread = prevUnread.get(key) || 0;
                    return memUnread > (c.unread || 0) ? { ...c, unread: memUnread } : c;
                  });
                  return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
                }
                // Shallow equality check for the array itself is not enough due to JSON.parse,
                // so we use stringify for a reliable check against the cached version.
                return JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed;
              });
            }
          }
        }
      } catch {}
    };

    window.addEventListener('muted_chats_updated', handleSync);
    window.addEventListener('muted_call_chats_updated', handleSync);
    window.addEventListener('locked_chats_updated', handleSync);
    window.addEventListener('blocked_chats_updated', handleSync);
    window.addEventListener('pinned_chats_updated', handleSync);
    window.addEventListener('hidden_chats_updated', handleSync);
    window.addEventListener('conversations_updated', handleSync);
    window.addEventListener('chat_cleared_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('muted_chats_updated', handleSync);
      window.removeEventListener('muted_call_chats_updated', handleSync);
      window.removeEventListener('locked_chats_updated', handleSync);
      window.removeEventListener('blocked_chats_updated', handleSync);
      window.removeEventListener('pinned_chats_updated', handleSync);
      window.removeEventListener('hidden_chats_updated', handleSync);
      window.removeEventListener('conversations_updated', handleSync);
      window.removeEventListener('chat_cleared_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);
  const getSortTime = React.useCallback((c) => Math.max(Number(c.lastTimestamp) || 0, Number(c.clearedAt) || 0), []);
  // Restore last open view/conversation across page navigations (e.g. tapping
  // a message avatar to view a profile) — this + isOpen persistence below is
  // what makes a swipe-back land back on the same open chat instead of a
  // freshly-mounted, closed widget.
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem('gcw_view') || 'list'; } catch { return 'list'; }
  }); // 'list' or 'chat'
  const [activeChat, setActiveChat] = useState(() => {
    try { const raw = sessionStorage.getItem('gcw_active_chat'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  // usernames currently online — seeded by the server's presence_snapshot
  // right after connect, kept live via presence_update deltas. Used for the
  // green dot on DM avatars (list) and the "online" line under the header
  // name in an open DM.
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  useEffect(() => {
    try { sessionStorage.setItem('gcw_view', view); } catch {}
  }, [view]);
  useEffect(() => {
    try {
      if (activeChat) sessionStorage.setItem('gcw_active_chat', JSON.stringify(activeChat));
      else sessionStorage.removeItem('gcw_active_chat');
    } catch {}
  }, [activeChat]);
  // Prefetch the Room route's lazy chunk (App.jsx: lazy(() => import('./Room')))
  // as soon as a room-type conversation is open here, well before the user
  // might tap the group name to jump there. Room.jsx is a large chunk; if it
  // isn't already cached, clicking the header used to leave the PREVIOUS page
  // (behind this widget, which closes itself first — see that onClick) fully
  // visible for however long the fetch+parse took, since the route's own
  // Suspense fallback is deliberately delayed 200ms so it doesn't flash for
  // fast/cached loads — which read as "it shows the home page, then
  // redirects" instead of a direct, instant jump into the room.
  useEffect(() => {
    if (activeChat?.type === 'room') import('../Room').catch(() => {});
  }, [activeChat?.type, activeChat?.id, activeChat?.partner]);
  useEffect(() => {
    try { sessionStorage.setItem('gcw_is_open', isOpen ? 'true' : 'false'); } catch {}
  }, [isOpen]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const paginationStateRef = useRef({});
  const scrollContainerRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const isPrependingHistoryRef = useRef(false);
  // Narrow viewports already close this widget via swipe-back/hardware-back
  // (useBackIntercept, see gcwBack below) — the header's X button is only
  // needed on desktop, where there's no back gesture to fall back on.
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsNarrowViewport(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [conversations, setConversations] = useState(() => {
    try {
      const cached = localStorage.getItem('watch_recent_chats');
      const parsed = cached ? JSON.parse(cached) : [];
      // Include all types (private + room) so room chats survive refresh
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  // Warm the browser image cache for every chat-list avatar as soon as the
  // list is known (even while the widget is closed / app locked), so the
  // avatars are already loaded when the chat icon is tapped.
  const preloadedAvatarsRef = useRef(new Set());
  useEffect(() => {
    for (const c of conversations) {
      const url = getAvatarUrl(c.partnerAvatar);
      if (!url || preloadedAvatarsRef.current.has(url)) continue;
      preloadedAvatarsRef.current.add(url);
      const img = new Image();
      img.src = url;
    }
  }, [conversations]);
  const [pinnedChats, setPinnedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`pinned_chats_${myUsername}`) || '[]');
    } catch { return []; }
  });
  const [mutedChats, setMutedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
    } catch { return []; }
  });
  // Mirror the mute list server-side on every change — push notifications
  // fire from the backend with no access to this (or any) device's
  // localStorage, so muting a chat only ever suppressed the in-app toast
  // without this. Fires once on mount too, which is what backfills the
  // server the first time for an existing local mute list. Reads the token
  // directly rather than closing over the component's `token` const, which
  // is declared further down this component and would be a TDZ error here.
  useEffect(() => {
    const tkn = localStorage.getItem('watch_token');
    if (!tkn || tkn === 'null' || tkn === 'undefined') return;
    fetch(`${API}/api/profile/muted-chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
      body: JSON.stringify({ mutedChats }),
    }).catch(() => {});
  }, [mutedChats]);
  // Separate from mutedChats above — muting a person's CALLS (private/DM
  // chats only) must not also silence their messages, and vice versa. Same
  // push-to-server-on-change pattern, enforced backend-side in call:invite
  // (the only place a call ring/push actually originates from).
  const [mutedCallChats, setMutedCallChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`muted_call_chats_${myUsername}`) || '[]');
    } catch { return []; }
  });
  useEffect(() => {
    const tkn = localStorage.getItem('watch_token');
    if (!tkn || tkn === 'null' || tkn === 'undefined') return;
    fetch(`${API}/api/profile/muted-call-chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
      body: JSON.stringify({ mutedCallChats }),
    }).catch(() => {});
  }, [mutedCallChats]);
  const [hiddenChats, setHiddenChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`hidden_chats_${myUsername}`) || '[]');
    } catch { return []; }
  });
  const [lockedChats, setLockedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`locked_chats_${myUsername}`) || '[]');
    } catch { return []; }
  });
  const [chatLockEnabled, setChatLockEnabled] = useState(false);
  // Chat bubble "Customize" theme — chatKey -> theme id (see CHAT_THEMES).
  // localStorage seeds instant paint on load; the server fetch below (and the
  // POST on every change) is what makes a theme picked here show up for this
  // same account on every other platform (mobile web, TWA, PWA, desktop).
  // For a PRIVATE chat, the backend also writes the same theme into the
  // OTHER participant's own map (see /api/chat-theme-prefs) — it's a shared
  // conversation property there, not a personal preference, so both sides
  // land on the same theme. Group chats stay purely per-user.
  const [chatThemes, setChatThemes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`chat_themes_${myUsername}`) || '{}');
    } catch { return {}; }
  });
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  // Closes the Browse/Poll popup on any click that isn't on it or its own
  // toggle button — a plain document 'click' listener (not mousedown/
  // touchstart, and only attached while the menu is actually open) rather
  // than the shared mousedown-based outside-click effect further below,
  // which would reintroduce the exact bug a full-screen catcher div used to
  // exist to avoid: closing on mousedown lets the browser's own click (for
  // the SAME tap) fire afterward against whatever's newly exposed once
  // React re-renders, which for this button specifically could fall
  // through onto a nav control underneath. Using 'click' throughout avoids
  // that split entirely, and unlike the old catcher div (a full-screen
  // position:fixed element the click had to physically land ON), this
  // fires from whatever the user actually clicked — a message row, an
  // image, empty space, or truly outside the panel — via normal
  // bubbling, so it isn't at the mercy of any stacking/z-index quirk
  // between that div and the message list.
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleAttachMenuOutsideClick = (e) => {
      const t = e.target;
      if (t.closest && (t.closest('.chat-attach-menu-popup') || t.closest('.chat-attach-toggle-btn'))) return;
      setShowAttachMenu(false);
    };
    document.addEventListener('click', handleAttachMenuOutsideClick);
    return () => document.removeEventListener('click', handleAttachMenuOutsideClick);
  }, [showAttachMenu]);
  const [showPollComposer, setShowPollComposer] = useState(false);
  // Key only (not the message object itself) — the live message is looked
  // up from `messages` on every render below, so this screen keeps
  // reflecting new votes as chat:poll_vote updates arrive instead of
  // freezing on whatever pollVotes looked like the moment "View votes"
  // was tapped.
  const [pollVotesTargetKey, setPollVotesTargetKey] = useState(null);
  const [themeCategoryFilter, setThemeCategoryFilter] = useState('all');
  // Dominant color extracted from the active conversation's Background
  // wallpaper (if any) — resolved asynchronously (canvas pixel sampling, see
  // getWallpaperDominantColor) since it's not known until the image decodes,
  // unlike CHAT_THEMES' hand-picked gradients which are available instantly.
  const [wallpaperColor, setWallpaperColor] = useState(null);
  // Which collapsed "Theme changed N times" runs (keyed by the run's head
  // message key — see groupNoticeRuns) the user has manually expanded.
  const [expandedNoticeRuns, setExpandedNoticeRuns] = useState(() => new Set());
  // Which conversation the open theme sheet applies to — NOT necessarily
  // activeChat, since the sheet can also be opened from a conversation row's
  // "..." menu in the list view without that chat being open at all.
  const [themeSheetTarget, setThemeSheetTarget] = useState(null);
  useEffect(() => {
    const tkn = localStorage.getItem('watch_token');
    if (!tkn || tkn === 'null' || tkn === 'undefined') return;
    fetch(`${API}/api/chat-theme-prefs`, { headers: { 'Authorization': `Bearer ${tkn}` } })
      .then(r => r.json())
      .then(data => {
        if (data.themes && typeof data.themes === 'object') {
          setChatThemes(data.themes);
          localStorage.setItem(`chat_themes_${myUsername}`, JSON.stringify(data.themes));
        }
      })
      .catch((err) => console.error('[CHAT THEME] Fetch failure:', err.message));
  }, []);
  // Same-tab resync when a theme is changed from a DIFFERENT mounted chat
  // surface (Room.jsx's own RoomChatPanel picker, or another GlobalChatWidget
  // instance — Room.jsx mounts a second one of these alongside RoomChatPanel).
  // See the matching dispatch in applyChatTheme below for why a plain
  // localStorage write alone doesn't reach an already-mounted sibling.
  useEffect(() => {
    const onThemesUpdated = (e) => { if (e.detail) setChatThemes(e.detail); };
    window.addEventListener('chat_themes_updated', onThemesUpdated);
    return () => window.removeEventListener('chat_themes_updated', onThemesUpdated);
  }, []);
  // Sends the "so-and-so changed the chat theme" notice as a REAL, persisted,
  // E2EE-encrypted private message (isNotice:true, noticeThemeId) so it
  // survives a refresh and reaches the other person's account on every
  // platform via the exact same history-fetch/realtime pipeline every other
  // DM already uses — see /api/chats/send. The plaintext content itself is
  // never shown (the renderer branches on msg.isNotice instead), it just
  // needs to be a normal encrypted message for the pipeline to accept it.
  const sendThemeNoticeMessage = useCallback(async (partner, themeId) => {
    if (!keyPair) return;
    const partnerLower = (partner || '').toLowerCase();
    try {
      let targetPubKey = null;
      try {
        const pkRes = await fetch(`${API}/api/auth/public-key/${encodeURIComponent(partnerLower)}`, { cache: 'no-store' });
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          targetPubKey = pkData.publicKey || null;
          if (targetPubKey) {
            try { localStorage.setItem(`wt_pk_${partnerLower}`, targetPubKey); } catch {}
          }
        }
      } catch (e) {}
      if (!targetPubKey) {
        targetPubKey = localStorage.getItem(`wt_pk_${partnerLower}`);
      }
      if (!targetPubKey) return;
      const enc = encryptDM('Changed the chat theme', targetPubKey, encodeBase64(keyPair.publicKey));
      const tkn = localStorage.getItem('watch_token');
      if (!tkn || tkn === 'null' || tkn === 'undefined') return;
      await fetch(`${API}/api/chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
        body: JSON.stringify({
          type: 'private',
          partner: partnerLower,
          message: enc.ciphertext,
          senderMessage: enc.senderCiphertext,
          nonce: enc.nonce,
          ephemeralPublicKey: enc.ephemeralPublicKey,
          isNotice: true,
          noticeThemeId: themeId || 'default',
        }),
      });
    } catch (err) { console.error('[CHAT THEME] Notice send failure:', err); }
  }, [keyPair]);
  const applyChatTheme = useCallback((target, themeId) => {
    if (!target) return;
    const chatKey = (target.type === 'room' ? (target.partner || target.id) : target.partner)?.toLowerCase();
    if (!chatKey) return;
    setChatThemes(prev => {
      const next = { ...prev };
      if (themeId && themeId !== 'default') next[chatKey] = themeId;
      else delete next[chatKey];
      localStorage.setItem(`chat_themes_${myUsername}`, JSON.stringify(next));
      // Room.jsx keeps its own separate copy of this same map (RoomChatPanel's
      // group/DM chat uses its own theme picker, independent of this widget) —
      // it only ever fetched it once on mount, so a theme picked HERE never
      // reached an already-open room without a full page reload. This same-tab
      // custom event (localStorage's own 'storage' event deliberately does NOT
      // fire in the document that made the write, only in other tabs) lets
      // Room.jsx — and any other mounted GlobalChatWidget instance — resync
      // instantly regardless of which surface changed it.
      window.dispatchEvent(new CustomEvent('chat_themes_updated', { detail: next }));
      return next;
    });
    if (target.type === 'private') {
      sendThemeNoticeMessage(target.partner, themeId);
    }
    const tkn = localStorage.getItem('watch_token');
    if (!tkn || tkn === 'null' || tkn === 'undefined') return;
    fetch(`${API}/api/chat-theme-prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tkn}` },
      body: JSON.stringify({ chatKey, themeId, chatType: target.type }),
    }).catch((err) => console.error('[CHAT THEME] Save failure:', err.message));
  }, [myUsername, sendThemeNoticeMessage]);

  // The widget is a fixed, very-high-zIndex overlay — a page-level react-hot-toast
  // (default zIndex much lower) renders BEHIND it, so errors like "too many files"
  // fired while the widget is open were silently invisible. This banner lives inside
  // the widget's own stacking context instead, guaranteeing it's seen.
  const [inlineNotice, setInlineNotice] = useState(null);
  const inlineNoticeTimerRef = useRef(null);
  const showInlineNotice = useCallback((text) => {
    setInlineNotice(text);
    clearTimeout(inlineNoticeTimerRef.current);
    inlineNoticeTimerRef.current = setTimeout(() => setInlineNotice(null), 3000);
  }, []);

  const wrapperRef = useRef(null);
  useImperativeHandle(ref, () => ({
    get container() { return wrapperRef.current; },
    get isOpen() { return isOpen; },
    get activeChat() { return activeChat; },
    contains: (target) => wrapperRef.current?.contains(target)
  }));

  // chatKey => timestamp when it was unlocked this session
  const unlockedSessionsRef = useRef({});
  const autoLockTimerRef = useRef(null);
  const perChatTimersRef = useRef({});
  // Pending: which chat the user is trying to open (blocked by lock screen)
  const [pendingLockedChat, setPendingLockedChat] = useState(null);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [vaultUnlockPending, setVaultUnlockPending] = useState(false);
  const [bulkUnlockPending, setBulkUnlockPending] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupTrigger, setSetupTrigger] = useState(null);
  const [lockToggleTarget, setLockToggleTarget] = useState(null); // { chat, action }
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [blockedChats, setBlockedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`blocked_chats_${myUsername}`) || '[]');
    } catch { return []; }
  });
  const [blockingMe, setBlockingMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`blocking_me_${myUsername}`) || '[]');
    } catch { return []; }
  });

  const handleBackToList = () => {
    const autoOnClose = autoLockOnClose;
    const autoMins = autoLockMinutes;
    
    if (activeChat && chatLockEnabled) {
      const chatKey = (activeChat.id || activeChat.partner || '').toLowerCase();
      if (lockedChats.includes(chatKey)) {
        if (autoOnClose || autoMins === 0) {
          delete unlockedSessionsRef.current[chatKey];
          window.dispatchEvent(new Event('locked_chats_updated'));
        } else if (autoMins > 0) {
          clearTimeout(perChatTimersRef.current[chatKey]);
          perChatTimersRef.current[chatKey] = setTimeout(() => {
            delete unlockedSessionsRef.current[chatKey];
            window.dispatchEvent(new Event('locked_chats_updated'));
          }, autoMins * 60 * 1000);
        }
      }
    }
    setView('list');
    // Leaving the chat entirely should reset multi-select — reopening a chat
    // should never resurface a stale selection from before it was closed.
    exitMsgSelectMode();
  };

  // useBackIntercept for the chat view + its transient overlays is set up
  // further below, once forwardPickerOpen/bulkDeleteConfirm/etc. are declared.

  const [messages, setMessages] = useState([]);
  // A DM's decrypt is attempted exactly once, at the instant it arrives over
  // the socket, using whatever keyPairRef.current happens to be right then
  // (see the "─── DM Decryption ───" block further down) — never retried on
  // its own. keyPair genuinely cycles through null/guest/real-account states
  // during app start (confirmed live), so a message landing in that window
  // gets stuck showing ENCRYPTED_PLACEHOLDER forever, with nothing short of
  // reopening the chat (which re-fetches and decrypts the whole history
  // fresh) ever fixing it. This re-attempts just those specific messages —
  // never touching pagination, scroll position, or any other open-chat
  // state — the moment keyPair actually becomes available or changes (e.g.
  // after CryptoContext's own mount-time server-verification resolves).
  // Scoped to private chats only; group decrypt needs each message's own
  // per-recipient key wrap, which already always uses a live-fetched
  // recipient list on send and isn't affected by this specific race.
  useEffect(() => {
    if (!keyPair || !activeChat || activeChat.type !== 'private') return;
    // TEMPORARY DIAGNOSTIC — remove once the intermittent "Encrypted
    // message" DM issue is confirmed fixed.
    console.log('[DEBUG-DM-RETRY] effect fired', { partner: activeChat.partner, ownPublicKey: encodeBase64(keyPair.publicKey) });
    setMessages(prev => {
      let changed = false;
      let attempted = 0, fixed = 0;
      const next = prev.map(m => {
        if (m.decryptedText !== ENCRYPTED_PLACEHOLDER || m.mediaType || !m.nonce) return m;
        attempted++;
        try {
          let plain = null;
          if (m.isMe) {
            if (m.senderMessage && m.ephemeralPublicKey) {
              plain = decryptDMSenderCopy(m.senderMessage, m.nonce, m.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
            }
          } else {
            const senderPK = m.ephemeralPublicKey || m.senderPublicKey || null;
            if (senderPK && m.message) {
              plain = decryptDM(m.message, m.nonce, senderPK, encodeBase64(keyPair.secretKey));
            }
          }
          if (plain != null) {
            changed = true;
            fixed++;
            return { ...m, decryptedText: plain };
          }
        } catch { /* still not decryptable with this key — leave the placeholder */ }
        return m;
      });
      if (attempted > 0) {
        // TEMPORARY DIAGNOSTIC — see above; remove together.
        console.log('[DEBUG-DM-RETRY] result', { attempted, fixed, stillStuck: attempted - fixed });
      }
      return changed ? next : prev;
    });
  }, [keyPair, activeChat?.partner, activeChat?.type]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  // Who-reacted-with-this-emoji sheet (tapping an existing reaction pill) —
  // { msgId, emoji, users }. See RoomChatPanel's identical sheet for the
  // full reasoning; kept as its own copy here rather than a shared component
  // since the two files don't currently share any UI component, only hooks.
  const [reactorsSheet, setReactorsSheet] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  // Poll messages get their own edit path (reopen PollComposer prefilled)
  // instead of the plain-text edit bar above — editing a poll's raw JSON as
  // text was confusing/broken, see commitEditedText/submitPollEdit below.
  const [editingPollMsg, setEditingPollMsg] = useState(null);
  const [reportMsgTarget, setReportMsgTarget] = useState(null);
  // Single shared instance for the whole thread — see hooks/useSwipeToReply.js for why
  // these aren't called per-message inside the .map() below.
  const swipe = useSwipeToReply();
  // Faster than the 500ms default — the reaction/unsend menu felt sluggish
  // to open on both sent and received messages; 300ms is still comfortably
  // past a normal tap/scroll-start so it doesn't false-trigger.
  const longPress = useLongPress(300);
  // Mobile/iPad: long-press a chat-list row to open the same "..." menu the
  // desktop dropdown arrow opens (hide/pin/mute/etc), instead of requiring a
  // second tap on the tiny arrow. Separate instance from the message-row
  // `longPress` above since the list and an open chat never render together.
  const chatListLongPress = useLongPress();
  useEffect(() => {
    if (chatListLongPress.activeId) {
      // Same up/down decision the desktop dropdown-arrow click already makes
      // (see its onClick below) — measured against the real trigger row
      // rather than left at whatever convMenuPlacement last happened to be,
      // which is what made a long-pressed row near the bottom of the (mobile-
      // scrolled) list always open downward and run off-screen regardless of
      // how little room was actually left below it.
      const rect = chatListLongPress.getTriggerRect?.();
      if (rect) {
        const panelBottom = containerRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
        setConvMenuPlacement((panelBottom - rect.bottom) < 300 ? 'up' : 'down');
      }
      setActiveConvMenu(chatListLongPress.activeId);
      setShowGlobalMenu(false);
      setShowSelectionMenu(false);
      setShowVaultMenu(false);
    }
  }, [chatListLongPress.activeId]);

  // ── Multi-select messages (bulk delete / forward) ──
  // Desktop entry: "Select messages" in the chat's "⋮" menu. Touch entry: a
  // THIRD independent useLongPress instance (same precedent as chatListLongPress
  // above), attached to each message row's own background — not the bubble,
  // which keeps its existing `longPress` (reactions/menu) behavior untouched.
  const [msgSelectMode, setMsgSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const rowSelectLongPress = useLongPress();
  // Instagram-DM-style "swipe left to peek timestamps" — see useTimestampPeek.js.
  const timestampPeek = useTimestampPeek();
  useEffect(() => {
    if (rowSelectLongPress.activeId) {
      setMsgSelectMode(true);
      setSelectedMsgIds(prev => new Set(prev).add(rowSelectLongPress.activeId));
      rowSelectLongPress.close();
    }
  }, [rowSelectLongPress.activeId]);
  const toggleMsgSelect = (rowKey) => {
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
      return next;
    });
  };
  const exitMsgSelectMode = () => { setMsgSelectMode(false); setSelectedMsgIds(new Set()); };
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [selectedForwardChats, setSelectedForwardChats] = useState([]);
  const [forwarding, setForwarding] = useState(false);
  const MAX_FORWARD_CHATS = 5;
  const [hoveredRowId, setHoveredRowId] = useState(null);
  // Instagram-style double-tap-to-like burst — see DoubleTapBurst.jsx. Only
  // one message ever bursts at a time; the timeout mirrors the component's
  // own ~0.85s pop+fade animation so the overlay unmounts right as it
  // finishes rather than lingering invisibly.
  const [burstMsgId, setBurstMsgId] = useState(null);
  // Which emoji the current burst shows — defaults to the double-click
  // shortcut's own ❤️, but every other way to react (quick-reaction bar,
  // long-press bar, the full emoji picker, re-tapping your own reaction in
  // the reactors sheet) passes its own emoji through so the burst always
  // matches whatever was actually picked, not always a heart.
  const [burstEmoji, setBurstEmoji] = useState('❤️');
  const burstTimeoutRef = useRef(null);
  const triggerReactionBurst = (key, emoji = '❤️') => {
    clearTimeout(burstTimeoutRef.current);
    setBurstEmoji(emoji);
    setBurstMsgId(key);
    burstTimeoutRef.current = setTimeout(() => setBurstMsgId(null), 900);
  };
  // 'up' = long-press menu opens above the touched row, 'down' = below —
  // derived from raw touch Y at press-start so it tracks the row's actual
  // on-screen position (mirrors the same pattern in RoomChatPanel.jsx).
  const [longPressPlacement, setLongPressPlacement] = useState('up');
  // Client-side-only override shown in place of the real last-message preview
  // (e.g. "krish reacted 🔥 to your message") — mirrors Room.jsx's own
  // reactionPreviews state so both surfaces show the same thing. Cleared
  // when that chat is opened (doOpenChat) or marked read from elsewhere
  // (markReadFor).
  const [reactionPreviewOverrides, setReactionPreviewOverrides] = useState(getPersistedReactionPreviews);
  // Same idea but for the desktop click-to-open dropdown (chevron button),
  // derived from the click's mouse Y.
  const [dropdownPlacement, setDropdownPlacement] = useState('down');
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  // Close the long-press action menu / quick-reaction row / emoji pickers on any
  // click outside them. The scroll container's own onClick already did this for
  // clicks inside the message list, but tapping the header or the compose bar
  // (outside that container) left them stuck open — a real bug on mobile/tablet
  // where there's no hover-away to naturally dismiss them.
  useEffect(() => {
    const handleClickOutside = (e) => {
      const t = e.target;
      const closest = (sel) => !!(t.closest && t.closest(sel));
      if (activeMessageMenu && !closest('.msg-hover-menu')) {
        setActiveMessageMenu(null);
      }
      if (longPress.activeId && !closest('.long-press-menu')) {
        longPress.close();
      }
      if ((activeReactionMsg || showAllEmojis) && !closest('.react-btn-container') && !closest('.emoji-picker-container')) {
        setActiveReactionMsg(null);
        setShowAllEmojis(false);
      }
      if (showEmojiPicker && !closest('.emoji-picker-container') && !closest('.emoji-toggle-btn')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeMessageMenu, longPress.activeId, longPress, activeReactionMsg, showAllEmojis, showEmojiPicker]);
  const [activeConvMenu, setActiveConvMenu] = useState(null);
  // Same "does it fit below?" problem the long-press/desktop message menus
  // had (see chatMenuPlacement.js) — this row-level "..." menu used to
  // decide up/down from the row's ARRAY INDEX (only the last 2 rows ever
  // flipped up), which breaks the moment the panel is short enough that even
  // a row further up doesn't have 300ish px of real room below it: the menu
  // still opened downward and ran past the panel's own bottom edge. Computed
  // from the trigger's actual on-screen position at click time instead.
  const [convMenuPlacement, setConvMenuPlacement] = useState('down');
  const [hoveredConvId, setHoveredConvId] = useState(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [hoveredMenuBtn, setHoveredMenuBtn] = useState(null); // tracks hovered header menu button
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const [showMasterKeyModal, setShowMasterKeyModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [vaultMasterKey, setVaultMasterKey] = useState('');
  const globalMenuRef = useRef(null);
  const selectionMenuRef = useRef(null);
  const chatMenuRef = useRef(null);
  const convMenuRef = useRef(null); // Ref for the active conversation's 3-dots menu
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [showHiddenChats, setShowHiddenChats] = useState(false);
  const [showLockedChats, setShowLockedChats] = useState(false);
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [clearGroupChatModalOpen, setClearGroupChatModalOpen] = useState(false);
  const [clearForBoth, setClearForBoth] = useState(false);
  const [deleteChatPending, setDeleteChatPending] = useState(null); // chatKey pending deletion confirm
  const [blockUserPending, setBlockUserPending] = useState(null); // chat object pending block confirm
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');

  // True only while the user reached the current /profile/* route by leaving
  // an already-open chat (see leaveChatToViewProfile / hiddenByProfileRoute
  // below); reset to false the moment a chat is opened fresh from outside.
  //
  // Seeded from sessionStorage (not just `false`) because this ref alone
  // cannot survive the exact case it exists for: Room.jsx's own embedded
  // widget instance calls leaveChatToViewProfile and sets this true, but
  // Room.jsx (the /room/:roomId route) then fully unmounts as the route
  // switches to /profile/:username — taking that instance, and its in-memory
  // ref, down with it. Profile.jsx mounts its OWN separate widget instance
  // (every non-persistent mount site does — see this file's own "self-
  // contained" precedent), whose ref starts fresh at `false` with no memory
  // of why we're here. Without seeding from the persisted flag, that fresh
  // instance's hiddenByProfileRoute reads false, so it renders fully visible
  // — showing the just-restored (view/activeChat already read from
  // sessionStorage below) but not-yet-fetched chat right on top of the
  // profile the user actually tapped through to see: a blank pane with a
  // spinner that looks like "the chat came back instead of the profile."
  // Validated against the SPECIFIC profile leaveChatToViewProfile actually
  // navigated to (gcw_hidden_for_profile_target), not just "are we anywhere
  // under /profile" — without this, tapping through to a second, different
  // profile from the first one (a follower/following list, a search result,
  // anything that stays within /profile/* the whole time) never left that
  // path prefix, so the effect below that clears this flag never fired: the
  // widget stayed display:none behind EVERY later profile page, permanently,
  // with its chat icon toggling internal state that had nothing to show.
  // Confirmed worse on Tauri (.exe) specifically because its WebView's
  // sessionStorage can outlive a full app restart, unlike a plain browser
  // tab losing it on close — so the stuck flag survives even relaunching.
  const cameFromOpenChatRef = useRef((() => {
    try {
      const target = sessionStorage.getItem('gcw_hidden_for_profile_target');
      const here = location.pathname.startsWith('/profile/') ? location.pathname.slice('/profile/'.length).toLowerCase() : null;
      return sessionStorage.getItem('gcw_hidden_for_profile') === 'true' && !!target && target === here;
    } catch { return false; }
  })());
  // Declared up here (ahead of gcwBaseLevel/gcwLevel below, which reads it)
  // rather than down by leaveChatToViewProfile where it conceptually
  // belongs, specifically so gcwLevel can force itself to 0 while true — see
  // gcwLevel's own comment for why that ordering matters.
  //
  // Only hide behind the profile route if we actually GOT to this profile by
  // leaving an already-open chat (leaveChatToViewProfile). Without this flag,
  // landing on a profile page any other way (e.g. clicking someone's avatar
  // in a room's group chat) and then opening a fresh chat from that profile's
  // own Message button would set activeChat/view correctly but stay
  // display:none forever — this widget instance never became visible because
  // the route-based hide fired unconditionally for every /profile/* route.
  // Checked against the live pathname on every render (not just the ref,
  // which only updates via the effect below on the NEXT commit) so
  // navigating from the profile a chat led to straight into a different one
  // — still under /profile/*, so no prefix change ever fires that effect —
  // never renders hidden even for the one frame before it would catch up.
  const hiddenByProfileRouteTarget = (() => {
    try { return sessionStorage.getItem('gcw_hidden_for_profile_target'); } catch { return null; }
  })();
  const hiddenByProfileRouteHere = location.pathname.startsWith('/profile/') ? location.pathname.slice('/profile/'.length).toLowerCase() : null;
  const hiddenByProfileRoute = cameFromOpenChatRef.current
    && !!hiddenByProfileRouteTarget
    && hiddenByProfileRouteTarget === hiddenByProfileRouteHere;

  // Any transient overlay (forward picker, rename/clear-chat confirms, vault
  // modals) open on top of the chat view gets its own back-intercept level,
  // so a swipe-back/hardware-back closes just that overlay instead of
  // falling through and closing the entire chat.
  const anyChatOverlayOpen = !!(forwardPickerOpen || bulkDeleteConfirm || clearChatModalOpen || clearGroupChatModalOpen || renameModalOpen || showMasterKeyModal || showChangePinModal || showPollComposer || pollVotesTargetKey);

  // Mobile/iPad swipe-back (and hardware back) should step back one level
  // instead of leaving the page: closed -> list -> folder (hidden/locked
  // chats filter) -> chat -> overlay. Without this, a swipe-left gesture
  // falls through to the browser's real back navigation and exits the
  // whole site. showHiddenChats/showLockedChats are orthogonal to `view`
  // (a filter applied to the same list, not a separate screen) — without
  // their own level here, opening one and swiping back skipped straight
  // past it to level 1's "close the whole chat widget" handling instead of
  // just clearing the filter.
  const anyFolderOpen = showHiddenChats || showLockedChats;
  const gcwBaseLevel = !isOpen ? 0
    : view === 'chat' ? (anyChatOverlayOpen ? 4 : 3)
    : anyFolderOpen ? 2
    : 1;
  // The theme sheet (chat-theme-sheet-overlay) can be opened from either the
  // chat view or the plain conversations list (its 3-dot menu), so it isn't
  // one of the view==='chat'-only overlays folded into anyChatOverlayOpen
  // above — it's a level layered on top of whatever gcwBaseLevel already is,
  // closeable back down to exactly that base level regardless of which one
  // it was.
  //
  // Forced to 0 while hiddenByProfileRoute (declared just above) is true,
  // instead of the normal showThemeSheet/gcwBaseLevel value — a widget
  // sitting invisible behind /profile/:username has nothing on screen for a
  // swipe to meaningfully step through. Without this, a fresh instance that
  // mounts directly into an already-open chat (restored from sessionStorage
  // — see cameFromOpenChatRef above) backfills 3 real history entries in one
  // shot the instant it mounts (useBackIntercept has no way to know the
  // component didn't actually traverse list->chat live), stacked right on
  // top of the single entry the profile navigation itself created. One
  // swipe off /profile then only unwound one of those 4, landing back on
  // /profile every time — the "2-3 swipes, and it lands on the whole
  // conversation list" the user reported. Holding level at 0 the entire
  // time the widget is hidden means it never pushes anything of its own
  // during the detour, so the lone profile-nav entry (already protected by
  // suppressNextPop() in leaveChatToViewProfile) is the only one a swipe
  // has to get through. Once hiddenByProfileRoute goes back to false — the
  // instant the widget is visible again, whether that's this same instance
  // (the persistent case) or a fresh one on whatever page comes back into
  // view — level jumps to its real value and backfills normally; by then
  // the chat is already the thing on screen, so those entries only affect
  // how many further swipes it takes to close the widget from there, not
  // how many it took to get back to it.
  const gcwLevel = hiddenByProfileRoute ? 0 : (showThemeSheet ? gcwBaseLevel + 1 : gcwBaseLevel);
  const gcwBack = useBackIntercept(gcwLevel, (newLevel) => {
    if (showThemeSheet && newLevel === gcwBaseLevel) {
      setShowThemeSheet(false);
      return;
    }
    if (newLevel === 0) {
      onClose && onClose();
    } else if (newLevel === 1) {
      if (view === 'chat') handleBackToList();
      else { setShowHiddenChats(false); setShowLockedChats(false); }
    } else if (newLevel === 2) {
      handleBackToList();
    } else if (newLevel === 3) {
      setForwardPickerOpen(false);
      setBulkDeleteConfirm(false);
      setClearChatModalOpen(false);
      setClearGroupChatModalOpen(false);
      setRenameModalOpen(false);
      setShowMasterKeyModal(false);
      setShowChangePinModal(false);
      setShowPollComposer(false);
      setEditingPollMsg(null);
      setPollVotesTargetKey(null);
    }
  });

  // Leaving to view someone's profile from within an open chat does NOT
  // close this overlay (unlike every other "leave" path) — it stays fully
  // mounted with its state untouched (activeChat, view, scroll position...)
  // and is only visually hidden below (`hiddenByProfileRoute`) while the
  // profile route is showing. A real back/swipe-back gesture off that route
  // then just reveals the exact same chat again, same as leaving one
  // Activity and returning to the last one on Android — no explicit
  // "restore" step needed since nothing was ever torn down.
  // suppressNextPop() tells the shared back-intercept listener (see
  // useBackIntercept.js) that the popstate this navigate() eventually
  // consumes on the way back isn't one of this widget's own tracked levels
  // — without it, that pop gets misattributed to whichever level is on top
  // of the shared stack and incorrectly collapses the chat view instead of
  // just revealing it.
  // Guards against a fast double/triple-tap firing this more than once
  // while still ON the profile route it leads to — see the identical
  // comment on RoomChatPanel.jsx's own copy of this guard, same fix, same
  // reason (RoomChatPanel doesn't need the pathname check below, since
  // Room.jsx fully unmounts/remounts across the trip and hands it a brand
  // new ref every time; this widget instance normally stays mounted
  // through the whole round trip, so nothing does that for it here).
  //
  // The `|| !location.pathname.startsWith('/profile')` half of the check
  // below is deliberate, not redundant with the reset effect further down
  // that clears the ref once the pathname leaves /profile: that reset runs
  // in a useEffect, which only fires after React commits AND paints the
  // post-navigation render — on a slower device, with this same render also
  // needing to re-fetch/re-decrypt the chat that just came back into view
  // (the "chat took some time to load" a real swipe-back already costs),
  // that commit can be visibly delayed. A second avatar tap landing in that
  // window found navigatingToProfileRef still true from the FIRST trip and
  // got silently dropped — read here as "second avatar click just doesn't
  // redirect at all," reliably worse on mobile than a fast laptop precisely
  // because the gap this races is proportional to how loaded the main
  // thread already is. Checking the pathname directly, synchronously, at
  // call time trusts the one signal that's never stale — if we're
  // demonstrably not on a profile route right now, a leftover `true` from
  // an earlier trip is stale by definition and shouldn't block a new one.
  const navigatingToProfileRef = useRef(false);
  const leaveChatToViewProfile = (targetUsername) => {
    if (navigatingToProfileRef.current && location.pathname.startsWith('/profile')) return;
    navigatingToProfileRef.current = true;
    // Setting cameFromOpenChatRef true (next line) drops gcwLevel to 0 on
    // the very next render (see gcwLevel's own comment) — without telling
    // the hook that's an intentional side effect of navigating forward, not
    // an in-app close, it would physically call history.go() to consume
    // this instance's already-pushed entries right as navigate() below is
    // trying to push a new one, racing it. skipNextClose() is the same
    // escape hatch already used a few hundred lines down for the "view a
    // room from an open chat" navigation — same reason, same fix.
    gcwBack.skipNextClose();
    cameFromOpenChatRef.current = true;
    // Belt-and-suspenders write, redundant with the useEffects above that
    // persist view/activeChat on every change — see the identical comment
    // on RoomChatPanel.jsx's goToProfile; same fix, same reason. Matters
    // even though this widget instance itself normally stays mounted
    // through a profile visit: when it's the copy Room.jsx mounts alongside
    // RoomChatPanel (rather than a persistent app-shell instance), Room.jsx
    // unmounting out from under it takes this instance down too, and only
    // sessionStorage survives that remount.
    try {
      sessionStorage.setItem('gcw_view', view);
      if (activeChat) sessionStorage.setItem('gcw_active_chat', JSON.stringify(activeChat));
      sessionStorage.setItem('gcw_is_open', 'true');
      // Persisted counterpart to cameFromOpenChatRef — see its declaration
      // above for why the in-memory ref alone doesn't survive this trip.
      // The target username is stored alongside it so a LATER, different
      // profile visit (still under /profile/*, so the pathname-based reset
      // effect never fires) doesn't inherit this hide flag — only the exact
      // profile this navigation is headed to honors it.
      sessionStorage.setItem('gcw_hidden_for_profile', 'true');
      sessionStorage.setItem('gcw_hidden_for_profile_target', (targetUsername || '').toLowerCase());
    } catch {}
    suppressNextPop();
    navigate(`/profile/${targetUsername}`);
  };
  // Profile is a route-level lazy chunk (see App.jsx's lazy(() =>
  // import('./Profile'))) — with avatars all over this panel, an actual
  // click is a near-certain next action, so warm the chunk once up front
  // rather than paying for the network fetch only once someone taps an
  // avatar. import() for an already-fetched module resolves from cache, so
  // this is a one-time cost regardless of how many times it's called.
  useEffect(() => { import('../Profile'); }, []);
  // Once the profile route is actually left, this widget is reachable again
  // for a fresh leaveChatToViewProfile() call — release the double-tap guard.
  // Also clear the persisted "hide behind profile" flag here (not just the
  // in-memory ref, which may belong to an already-dead instance by now) so
  // it doesn't wrongly seed cameFromOpenChatRef=true on some unrelated later
  // page that happens to render a fresh widget instance while a chat is
  // still flagged open — e.g. swiping back from /profile to /room mounts a
  // brand-new Room.jsx widget instance whose first render already needs to
  // decide hiddenByProfileRoute correctly, before this effect even runs.
  useEffect(() => {
    // Also clears when we're STILL under /profile/* but it's now a
    // DIFFERENT profile than the one leaveChatToViewProfile actually sent us
    // to (e.g. tapping a follower/following entry, or a search result, from
    // the profile the chat led to) — this component doesn't necessarily
    // remount across that navigation, so cameFromOpenChatRef's value from
    // the FIRST profile visit would otherwise silently carry over and hide
    // this widget behind every later profile page too, with no pathname-
    // prefix change to ever trigger a reset.
    const here = location.pathname.startsWith('/profile/') ? location.pathname.slice('/profile/'.length).toLowerCase() : null;
    let target = null;
    try { target = sessionStorage.getItem('gcw_hidden_for_profile_target'); } catch {}
    const stillOnTheHiddenForTarget = !!here && !!target && here === target;
    if (!stillOnTheHiddenForTarget) {
      navigatingToProfileRef.current = false;
      cameFromOpenChatRef.current = false;
      try {
        sessionStorage.removeItem('gcw_hidden_for_profile');
        sessionStorage.removeItem('gcw_hidden_for_profile_target');
      } catch {}
    }
  }, [location.pathname]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [activeRelation, setActiveRelation] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { items: [{url, type}], index }
  const [typingStatuses, setTypingStatuses] = useState({}); // chatKey -> Set of usernames typing
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerFormRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  // Composer layout (emoji far-left, camera next to mic) only differs below
  // the same 1023.98px breakpoint every other mobile/tablet-only chrome in
  // this file already uses (see .desktop-only-menu-item) — tracked via
  // matchMedia, not a one-time innerWidth read, so rotating a tablet or
  // resizing a desktop window updates it live instead of needing a reload.
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023.98px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023.98px)');
    const onChange = (e) => setIsMobileOrTablet(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // Calling is only reliable from: a real mobile device (any browser tab,
  // PWA, or the APK — WebRTC works fine there), or the installed Tauri
  // desktop app. A plain desktop browser tab is the one case blocked —
  // rather than let it half-work, the call buttons below prompt installing
  // the desktop app instead of ever calling call.startCall from there.
  const canMakeCalls = isMobileOrTablet || isTauriApp() || isCapacitorApp();
  const [showCallInstallPrompt, setShowCallInstallPrompt] = useState(false);
  // This widget stays MOUNTED while visually hidden (`if (!isOpen) return
  // null` further down just skips rendering, it doesn't unmount — see
  // hiddenByProfileRoute's own comment above for why that's deliberate), so
  // this state would otherwise survive a close/reopen untouched — reopening
  // the widget showed this prompt again immediately, with no call button
  // ever clicked, because it was still sitting at `true` from before.
  useEffect(() => { if (!isOpen) setShowCallInstallPrompt(false); }, [isOpen]);
  // Viewport-anchored stable height for the wallpaper backdrop below — see
  // its usage for why this replaced the old CSS-only position:fixed +
  // height:100lvh media-query approach.
  const stableViewportHeight = useStableViewportHeight();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const [waveHeights, setWaveHeights] = useState(() => Array(20).fill(3));
  const analyserRef = useRef(null);
  const waveAnimRef = useRef(null);
  // Bumped by startRecording (new attempt) and stop/cancelRecording (abort) so
  // a getUserMedia() call that resolves AFTER the user already stopped/cancelled
  // can tell it's stale and back out instead of reviving a dead recording UI —
  // see the sequencing comment inside startRecording.
  const recordingSeqRef = useRef(0);
  // Re-auth overlay state (shown when sessionStorage key is missing after tab close)
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  // Async-decrypted media blob URLs: msgId -> objectURL
  const decryptedMediaUrls = useRef({});
  // Incremented after each async media decrypt to force a re-render that picks up the new blob URL
  const [mediaUrlVersion, setMediaUrlVersion] = useState(0);
  // Real wall-clock time this client FIRST rendered each still-encrypted media message:
  // msgKey -> Date.now(), lazily stamped at that first render (see the isDecrypting check
  // below). The "still decrypting, show a spinner" render check used to measure elapsed time
  // against the MESSAGE's own timestamp (when it was originally sent) instead of against when
  // this client actually started trying to decrypt it — fine for a message that just arrived
  // over the socket, but every message loaded from history is already minutes/days old the
  // instant it's decrypted, so that check read as "decrypt window expired" before the real
  // fetch+decrypt (which kicks off in that same first-render instant) had any chance to
  // finish, flashing "Couldn't load" for the second or two the fetch genuinely takes on every
  // reopen/reload.
  const mediaDecryptStartedAt = useRef({});
  // Tracks the most recently sent tempId per partner so that stale server echoes (message 1's
  // server timestamp may exceed the client-optimistic timestamp of message 2) don't revert the
  // sidebar preview to an older message.
  const lastSentTempIdRef = useRef({});
  const [autoLockOnClose, setAutoLockOnClose] = useState(localStorage.getItem('chat_lock_auto_on_close') === 'true');
  const [autoLockMinutes, setAutoLockMinutes] = useState(parseInt(localStorage.getItem('chat_lock_auto_minutes') || '5'));

  const token = localStorage.getItem('watch_token');
  // _isLight tracks the real system theme; isLight is derived and forced to false
  // in fullscreen (transparentMode) so the overlay always uses dark styling over video.
  const [_isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  const isLight = _isLight && !transparentMode;
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  const messagesEndRef = useRef(null);
  // Bumped after the expiry-reminder banner's own buttons are clicked, since
  // dismissal/snooze state lives in localStorage (shared across chats), not
  // React state — this forces a re-check of countSoonExpiringMedia.
  const [expiryBannerTick, setExpiryBannerTick] = useState(0);
  // Same localStorage-backed re-render-forcing trick as expiryBannerTick
  // above — see keyResetBanner.js's own doc comment for what sets the flag
  // this reads.
  const [keyResetBannerTick, setKeyResetBannerTick] = useState(0);
  const bannerChatKey = activeChat ? (activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner)?.toLowerCase() : null;
  // "Remind me later" only suppresses the banner until this chat is closed
  // (navigated back to the list, or the target/widget itself changes) —
  // clear that suppression here so it reappears next time the same chat is
  // reopened, instead of it being time-based. `view` is included since
  // handleBackToList() only flips view to 'list' without clearing
  // activeChat, so bannerChatKey alone wouldn't change on "back".
  useEffect(() => {
    return () => { clearExpiryBannerCloseSuppression(bannerChatKey); };
  }, [bannerChatKey, view, isOpen]);
  const prevMsgCountRef = useRef(0);
  const isFirstRenderGlobalChat = useRef(true);
  const inputRef = useRef(null);
  const isSendingGlobalRef = useRef(false);
  useAutoResizeTextarea(inputRef, inputValue);
  const socketRef = useRef(null);
  // Tracks which token the live socket was authenticated with, so a token
  // change (re-login as a different account without this widget unmounting)
  // tears down the old connection instead of silently staying authenticated
  // as the previous account — see socketRef.current's own guard below.
  const socketTokenRef = useRef(null);
  const activeChatRef = useRef(null);
  const viewRef = useRef('list');
  const containerRef = useRef(null);
  const processedMsgsRef = useRef(new Set());
  const guestLastMsgCountRef = useRef({});

  const handleSilentLock = async (chat) => {
    if (!chat) return;
    const chatKey = (chat.id || chat.partner || '').toLowerCase();
    try {
      const res = await fetch(`${API}/api/chat-lock/toggle-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chatId: chatKey, lock: true }) // Silent lock: no PIN required on server for 'lock: true'
      });
      if (res.ok) {
        setLockedChats(prev => {
          const next = [...new Set([...prev, chatKey])];
          localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(next));
          window.dispatchEvent(new Event('locked_chats_updated'));
          return next;
        });
        toast.success('Chat locked');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to lock chat');
      }
    } catch (err) {
      toast.error('Network error. Failed to lock chat.');
    }
  };

  // Keep refs in sync with state (for use inside socket closures)
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Tells the server which chat (if any) this user is actively looking at
  // right now, so notifyChatMessage (server.js) can skip a push notification
  // for it — the in-app toast/desktop-notification suppression already
  // existed (isViewingThis below), but a real push had no way to know the
  // recipient's chat was open. chatId matches the identifier the server
  // already uses per chat type: the other person's username for a DM, the
  // room id for a group (see chat.id || chat.partner used the same way
  // elsewhere in this file for muting/marking-read).
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const chatId = (isOpen && view === 'chat' && activeChat) ? (activeChat.id || activeChat.partner) : null;
    // Nothing to mark active — no emit needed: if a PREVIOUS run of this
    // effect had a real chatId, its own cleanup below (still holding that
    // value in closure) already ran and deactivated it before this run. A
    // bare, chatId-less 'chat_inactive' here would instead wipe this user's
    // ENTIRE active-chat set on the backend, clobbering whatever Room.jsx's
    // own in-room chat panel (a separate socket) may have marked active —
    // exactly what the server's Set-based tracking exists to prevent.
    if (!chatId) return;
    sock.emit('chat_active', { chatId });
    return () => sock.emit('chat_inactive', { chatId });
  }, [isOpen, view, activeChat]);
  const activeRoomTabRef = useRef(activeRoomTab);
  const activeRoomPartnerRef = useRef(activeRoomPartner);
  const hostRoomIdRef = useRef(hostRoomId);
  useEffect(() => { activeRoomTabRef.current = activeRoomTab; }, [activeRoomTab]);
  useEffect(() => { activeRoomPartnerRef.current = activeRoomPartner; }, [activeRoomPartner]);
  useEffect(() => { hostRoomIdRef.current = hostRoomId; }, [hostRoomId]);

  useLayoutEffect(() => {
    if (scrollAnchorRef.current && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      const { prevScrollHeight, prevScrollTop } = scrollAnchorRef.current;
      el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
      scrollAnchorRef.current = null;
    }
  }, [messages]);

  const { showScrollArrow, handleScroll, scrollToBottom } = useScrollToBottom(messagesEndRef);
  // Tracks whether the composer is the thing the user is actually typing
  // into right now, so a visual-viewport resize caused by something else
  // entirely (device rotation while just reading, an OS UI element toggling)
  // doesn't yank the scroll position around when there's no keyboard in play.
  const composerFocusedRef = useRef(false);
  // Captured at the moment the composer is focused (before the keyboard has
  // resized anything) — whether the user was already looking at the latest
  // messages. Reading a live scroll position here rather than trusting
  // showScrollArrow's state avoids any lag between a scroll and that state
  // catching up. Scrolled up reading older history, then tapping the
  // composer, used to always jump the list to the newest message the moment
  // the keyboard opened — this is what makes that conditional: only snap to
  // the bottom if that's actually where the user already was, otherwise
  // leave the scroll position alone and let the container just resize in
  // place around it, so the keyboard covers the same messages you were
  // already reading instead of yanking you down to the end.
  const wasNearBottomOnFocusRef = useRef(true);
  const isScrollNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 300;
  };
  // instant (no smooth-scroll animation): this fires once the keyboard's
  // resize has actually settled (see useVisualViewportResize's own debounce),
  // so the list should already just BE in its final position the moment this
  // runs, not visibly slide there afterward — a smooth scroll here read as
  // "messages scrolling upward" on top of the keyboard's own motion.
  useVisualViewportResize(() => {
    // Belt-and-suspenders on top of composerFocusedRef — see the identical
    // comment on RoomChatPanel.jsx's own copy of this hook call; same fix,
    // same reason (Android not always firing blur on a gesture-dismissed
    // keyboard, which without this could yank scroll to the bottom on an
    // unrelated tap — e.g. an avatar, mid profile-navigation).
    const composerActuallyFocused = document.activeElement === inputRef.current;
    if (composerActuallyFocused && composerFocusedRef.current && wasNearBottomOnFocusRef.current) scrollToBottom(true);
  });
  const conversationsRef = useRef([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  // Persist every conversations state change to localStorage so that:
  //  - handleNewMsg updates survive widget close/reopen (which triggers fetchConversations)
  //  - Media sends (which have no optimistic conversations update) persist immediately after socket bounce
  //  - Page refresh always loads the latest preview without relying solely on the server fetch
  useEffect(() => {
    if (Array.isArray(conversations) && conversations.length > 0) {
      try {
        localStorage.setItem('watch_recent_chats', JSON.stringify(conversations));
      } catch(e) {}
    }
  }, [conversations]);

  useEffect(() => {
    const closeMenus = (e) => {
      // Don't close if clicking the toggle buttons themselves (let their own onClick handle it)
      if (globalMenuRef.current && globalMenuRef.current.contains(e.target)) return;
      if (selectionMenuRef.current && selectionMenuRef.current.contains(e.target)) return;
      if (chatMenuRef.current && chatMenuRef.current.contains(e.target)) return;
      if (convMenuRef.current && convMenuRef.current.contains(e.target)) return;
      if (vaultMenuRef.current && vaultMenuRef.current.contains(e.target)) return;

      setShowGlobalMenu(false);
      setShowSelectionMenu(false);
      setShowChatMenu(false);
      setShowVaultMenu(false);
      setActiveConvMenu(null);
      setActiveMessageMenu(null);
      chatListLongPress.close();

      // Close input emoji picker when clicking outside of it or its toggle button
      const inEmojiPicker = e.target.closest('.emoji-picker-container');
      const isEmojiToggle = e.target.closest('.emoji-toggle-btn');
      if (!inEmojiPicker && !isEmojiToggle) {
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener('mousedown', closeMenus);
    return () => window.removeEventListener('mousedown', closeMenus);
  }, []);

  // ── Chat Lock: fetch enabled status on mount ──
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/chat-lock/status`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.enabled !== undefined) setChatLockEnabled(!!data.enabled); })
      .catch((err) => console.error('[CHAT LOCK] Fetch failure:', err.message));
    // Also sync locked chats from server
    fetch(`${API}/api/chat-lock/locked-chats`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.lockedChats)) {
          setLockedChats(data.lockedChats);
          localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(data.lockedChats));
        }
      })
      .catch((err) => console.error('[CHAT LOCK] Fetch failure:', err.message));
  }, [token]);

  // ── Auto-lock: relock unlocked sessions when tab hides ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const autoMins = autoLockMinutes;
        if (autoMins === 0) {
          // Lock immediately — clear all session unlocks
          unlockedSessionsRef.current = {};
        }
        // For non-zero: schedule a relock after autoMins
        if (autoMins > 0) {
          clearTimeout(autoLockTimerRef.current);
          autoLockTimerRef.current = setTimeout(() => {
            unlockedSessionsRef.current = {};
          }, autoMins * 60 * 1000);
        }
      } else {
        clearTimeout(autoLockTimerRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(autoLockTimerRef.current);
    };
  }, []);

  const togglePinChat = (chatKey) => {
    setPinnedChats(prev => {
      const isPinned = prev.includes(chatKey);
      const next = isPinned ? prev.filter(k => k !== chatKey) : [...prev, chatKey];
      localStorage.setItem(`pinned_chats_${myUsername}`, JSON.stringify(next));
      return next;
    });
    setActiveConvMenu(null);
  };

  // ── Auto-lock: relock unlocked sessions when widget closes ──
  useEffect(() => {
    if (!isOpen && autoLockOnClose) {
      unlockedSessionsRef.current = {};
    }
  }, [isOpen, autoLockOnClose]);

  // ── Lock background page scroll while the widget is open ──
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [isOpen]);

  const deleteChat = (chatKey) => {
    // Step 1: Find the chat so we know its type (private vs room)
    const chat = conversations.find(c => (c.id || c.partner) === chatKey);
    const chatType = chat?.type || 'private';

    // Step 2: Emit socket event to update hiddenFor in Supabase and
    //         trigger dm_cleared / room_chat_cleared on all connected sessions
    if (chatType === 'room') {
      if (socketRef.current) {
        socketRef.current.emit('clear_room_chat', { roomId: chatKey });
      } else if (localStorage.getItem('watch_is_guest') === 'true') {
        window.dispatchEvent(new CustomEvent('guest_widget_clear_room_chat', { detail: { roomId: chatKey } }));
      }
    } else {
      if (socketRef.current) {
        // targetUsername is the partner's username
        const targetUsername = chat?.partner || chatKey;
        socketRef.current.emit('clear_dm', { targetUsername, clearForBoth: false });
      }
    }

    // Step 3: Immediately clear messages if this chat is currently open
    if (activeChatRef.current && (activeChatRef.current.partner === chatKey || activeChatRef.current.id === chatKey)) {
      setMessages([]);
      // Navigate back to the list view so the deleted chat is no longer shown
      setView('list');
      setActiveChat(null);
    }

    // Step 4: Remove from conversation list and all localStorage stores
    setConversations(prev => {
      const next = prev.filter(c => c.partner !== chatKey && c.id !== chatKey);
      localStorage.setItem('watch_recent_chats', JSON.stringify(next));
      return next;
    });
    setPinnedChats(prev => {
      const next = prev.filter(k => k !== chatKey);
      localStorage.setItem(`pinned_chats_${myUsername}`, JSON.stringify(next));
      return next;
    });
    setMutedChats(prev => {
      const next = prev.filter(k => k !== chatKey);
      localStorage.setItem(`muted_chats_${myUsername}`, JSON.stringify(next));
      return next;
    });

    // Step 5: Purge from chat_cleared_partners so it won't resurface on refresh
    try {
      if (socketRef.current) {
        socketRef.current.on('chat_cleared', ({ roomId, clearedBy }) => {
          if (clearedBy === myUsername) {
            const saved = { ...clearedPartnersRef.current, [roomId]: Date.now() };
            clearedPartnersRef.current = saved;
            localStorage.setItem('chat_cleared_partners', JSON.stringify(saved));
            setMessages([]);
          }
        });
      }
      const cleared = JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
      delete cleared[chatKey];
      localStorage.setItem('chat_cleared_partners', JSON.stringify(cleared));
      clearedPartnersRef.current = cleared;
    } catch {}

    setActiveConvMenu(null);
    toast.success('Chat deleted');
  };

  const toggleMuteChat = (chatKey) => {
    setMutedChats(prev => {
      const isMuted = prev.includes(chatKey);
      const next = isMuted ? prev.filter(k => k !== chatKey) : [...prev, chatKey];
      localStorage.setItem(`muted_chats_${myUsername}`, JSON.stringify(next));
      window.dispatchEvent(new Event('muted_chats_updated'));
      return next;
    });
    setActiveConvMenu(null);
  };

  // Private (DM) chats only — no ring, no push, no missed-call notification
  // for calls from this specific person, enforced entirely backend-side (see
  // call:invite in server.js). Nothing to do client-side beyond persisting
  // the list — if the server never sends call:incoming for a muted caller,
  // there's nothing here to suppress.
  const toggleMuteCallChat = (chatKey) => {
    setMutedCallChats(prev => {
      const isMuted = prev.includes(chatKey);
      const next = isMuted ? prev.filter(k => k !== chatKey) : [...prev, chatKey];
      localStorage.setItem(`muted_call_chats_${myUsername}`, JSON.stringify(next));
      window.dispatchEvent(new Event('muted_call_chats_updated'));
      return next;
    });
    setActiveConvMenu(null);
  };

  const toggleHideChat = (chatKey) => {
    setHiddenChats(prev => {
      const normalizedKey = (chatKey || '').toLowerCase();
      const isHidden = prev.some(k => k.toLowerCase() === normalizedKey);
      const next = isHidden ? prev.filter(k => k.toLowerCase() !== normalizedKey) : [...prev, normalizedKey];
      localStorage.setItem(`hidden_chats_${myUsername}`, JSON.stringify(next));
      window.dispatchEvent(new Event('hidden_chats_updated'));
      toast.success(isHidden ? 'Chat unhidden' : 'Chat hidden');
      return next;
    });
    setActiveConvMenu(null);
  };

  const markChatAsRead = (chatKey, silent = false) => {
    const conv = (conversations || []).find(c => c.id === chatKey || c.partner === chatKey);
    const isDm = conv ? conv.type === 'private' : true;
    setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
      (c.id === chatKey || c.partner === chatKey) ? { ...c, unread: 0 } : c
    ));
    try {
      const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      delete localCounts[chatKey];
      delete localCounts[(chatKey || '').toLowerCase()];
      localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    } catch (e) {}

    if (socketRef.current) {
      socketRef.current.emit('chat:mark_read', { chatId: chatKey, isDm });
    }
    const token = localStorage.getItem('watch_token');
    if (token) {
      fetch(`${API}/api/chats/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chatId: chatKey, isDm })
      }).catch(() => {});
    }

    // Also notify parent (Room.jsx) so the global badge updates immediately
    if (typeof onMarkRead === 'function') {
      onMarkRead(chatKey);
    }
    setActiveConvMenu(null);
    if (!silent) toast.success('Marked as read');
  };

  const toggleLockChat = (chatKey) => {
    setLockedChats(prev => {
      const isLocked = prev.includes(chatKey);
      const next = isLocked ? prev.filter(k => k !== chatKey) : [...prev, chatKey];
      localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(next));
      window.dispatchEvent(new Event('locked_chats_updated'));
      return next;
    });
    setActiveConvMenu(null);
    toast.success(lockedChats.includes(chatKey) ? 'Chat unlocked' : 'Chat locked');
  };

  const toggleSelectChat = (chatKey) => {
    setSelectedChats(prev => prev.includes(chatKey) ? prev.filter(k => k !== chatKey) : [...prev, chatKey]);
  };

  const toggleBlockChat = async (chatKey) => {
    // Always use lowercase for consistent matching
    const partnerLow = (chatKey || '').toLowerCase();
    const isBlocked = blockedChats.some(k => k.toLowerCase() === partnerLow);
    const token = localStorage.getItem('watch_token');
    
    // Optimistic UI update — store as lowercase so all comparisons work
    setBlockedChats(prev => {
      // Remove any existing entries (any case) then add lowercase if blocking
      const filtered = prev.filter(k => k.toLowerCase() !== partnerLow);
      const next = isBlocked ? filtered : [...filtered, partnerLow];
      localStorage.setItem(`blocked_chats_${myUsername}`, JSON.stringify(next));
      window.dispatchEvent(new Event('blocked_chats_updated'));
      return next;
    });

    setActiveChat(prev => {
      if (!prev) return prev;
      if (prev.partner?.toLowerCase() === partnerLow || prev.id?.toLowerCase() === partnerLow) {
        return { ...prev, isBlocked: !isBlocked, amIBlocked: false };
      }
      return prev;
    });

    // When unblocking: immediately set activeRelation to "no friendship" BEFORE the
    // refetch completes — so the chat input is NEVER shown in that brief gap
    if (isBlocked) {
      const currentChat = activeChatRef.current;
      if (currentChat && (currentChat.partner?.toLowerCase() === partnerLow || currentChat.id?.toLowerCase() === partnerLow)) {
        setActiveRelation({ followStatus: null, isFollowingMe: false });
      }
    }

    setActiveConvMenu(null);
    toast.success(isBlocked ? 'User unblocked' : 'User blocked');

    if (token) {
      try {
        const r = await fetch(`${API}/api/block/${partnerLow}`, {
          method: isBlocked ? 'DELETE' : 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!r.ok) {
          console.error('Block API returned error', r.status);
        } else {
          // Refresh conversations so the UI picks up the change immediately
          fetchConversations();
          // Refetch relationship to get the accurate Friendship Required state
          const currentChat = activeChatRef.current;
          if (currentChat && (currentChat.partner?.toLowerCase() === partnerLow || currentChat.id?.toLowerCase() === partnerLow)) {
            fetch(`${API}/api/users/${partnerLow}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
              .then(res => res.json())
              .then(d => setActiveRelation(d))
              .catch(err => console.error('Failed to refetch relation', err));
          }
        }
      } catch (err) {
        console.error('Failed to update block status on server', err);
      }
    }
  };


  useImperativeHandle(ref, () => ({
    openChatWith: (partnerUsername, displayName, avatarPath) => {
      cameFromOpenChatRef.current = false;
      try {
        sessionStorage.removeItem('gcw_hidden_for_profile');
        sessionStorage.removeItem('gcw_hidden_for_profile_target');
      } catch {}
      openChat({
        id: partnerUsername,
        partner: partnerUsername,
        displayName: displayName || partnerUsername,
        partnerAvatar: avatarPath,
        type: 'private'
      });
    },
    // As of the render that produced this handle — re-created every render
    // (no deps array below), so always current by the time a caller reads it.
    isHiddenBehindProfile: hiddenByProfileRoute,
    // The nav bar's chat icon exists on every page, including a /profile/*
    // page reached by leaving an already-open chat — clicking it there used
    // to just toggle isOpen, which the caller was already doing, with no
    // effect: hiddenByProfileRoute forces display:none regardless of isOpen,
    // so the click looked like it did nothing (or, since isOpen usually
    // started true from before the profile nav, toggled it invisibly closed
    // then invisibly open again on alternating clicks). This is what actually
    // brings the chat forward, on top of the profile currently showing,
    // instead of leaving it stuck behind it until the user navigates away
    // entirely — the caller still also sets isOpen true so the panel is
    // showing once this clears the hide.
    revealOverProfile: () => {
      cameFromOpenChatRef.current = false;
      try {
        sessionStorage.removeItem('gcw_hidden_for_profile');
        sessionStorage.removeItem('gcw_hidden_for_profile_target');
      } catch {}
    },
    getActiveChat: () => ({
      partner: activeChatRef.current?.partner,
      view: viewRef.current
    }),
    contains: (node) => {
      return containerRef.current && containerRef.current.contains(node);
    },
    // Called by Room.jsx when user reads a chat in the room right-panel
    // (not via GCW) so GCW's own conversation list badge stays in sync.
    markReadFor: (chatId) => {
      const key = (chatId || '').toLowerCase();
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
        (c.id === key || c.id === chatId || c.partner === key || c.partner === chatId)
          ? { ...c, unread: 0 }
          : c
      ));
      setReactionPreviewOverrides(prev => {
        if (!(key in prev)) return prev;
        const next = { ...prev }; delete next[key]; return next;
      });
      clearPersistedReactionPreview(key);
    },
    // Called by Room.jsx when someone reacts to the current user's message,
    // so the conversation list shows "X reacted 🙂 to your message" like
    // Room's own chat-list panel does — persists until that chat is opened.
    updateConversationPreview: (key, previewText) => {
      const chatKey = (key || '').toLowerCase();
      setConversations(prev => {
        const convs = Array.isArray(prev) ? prev : [];
        if (!convs.some(c => ((c.id || c.partner) || '').toLowerCase() === chatKey)) return convs;
        return convs.map(c => (((c.id || c.partner) || '').toLowerCase() === chatKey) ? { ...c, lastTimestamp: Date.now() } : c)
          .sort((a, b) => getSortTime(b) - getSortTime(a));
      });
      setReactionPreviewOverrides(prev => ({ ...prev, [chatKey]: previewText }));
      setPersistedReactionPreview(chatKey, previewText);
    },
    markAllRead: () => {
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c => ({ ...c, unread: 0 })));
    },
    // Called by Room.jsx's checkUnread polling — syncs GCW list badges to server-authoritative counts.
    // serverCounts is { chatKeyLower: unreadNumber } — any key not present has 0 unread.
    syncUnreadFromServer: (serverCounts) => {
      if (!serverCounts || typeof serverCounts !== 'object') return;
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c => {
        const key = ((c.id || c.partner) || '').toLowerCase();
        const serverUnread = serverCounts[key] ?? 0;
        return c.unread === serverUnread ? c : { ...c, unread: serverUnread };
      }));
    }
  }));

  const enforceWordLimit = (val) => {
    const parts = val.split(/(\s+)/);
    let wordCount = 0;
    const result = [];
    for (const part of parts) {
      if (part.trim() !== '') {
        wordCount++;
      }
      if (wordCount > 250) {
        break;
      }
      result.push(part);
    }
    return result.join('');
  };

  const renderMessageText = (text, isMe) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (!part) return null;
      // Use case-insensitive matching for regex
      if (typeof part === 'string' && part.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i)) {
        let href = part;
        if (!href.match(/^https?:\/\//i)) href = 'http://' + href;
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{color:isMe?'#fff':(isLight ? 'var(--brand-1-dark)' : 'var(--brand-1)'), textDecoration:'underline'}} onClick={e=>e.stopPropagation()}>{part}</a>;
      }
      return part;
    });
  };

  const handleTypingStatus = (data, isStarting) => {
    const { partner, username, type, roomId, userA, userB, isRoom, isTyping } = data;
    const isActuallyStarting = isStarting && isTyping !== false;
    const finalChatKey = isRoom ? roomId : (type === 'room' ? partner : (userA === myUsername ? userB : (username || userA)));
    const finalUsername = username || userA;
    if (!finalChatKey || !finalUsername) return;

    setTypingStatuses(prev => {
      const next = { ...prev };
      const currentSet = next[finalChatKey] || new Set();
      const newSet = new Set(currentSet);
      if (isActuallyStarting) {
        newSet.add(finalUsername);
      } else {
        newSet.delete(finalUsername);
      }
      if (newSet.size === 0) delete next[finalChatKey];
      else next[finalChatKey] = newSet;
      return next;
    });

    if (isActuallyStarting) {
      setTimeout(() => handleTypingStatus(data, false), 5000);
    }
  };

  // Expose an imperative method to open a chat directly from parent


  // Connect socket for live updates (reactions + new messages)
  useEffect(() => {
    if (!token || !isReady) return;
    // Already connected with this exact token — nothing to do.
    if (socketRef.current && socketTokenRef.current === token) return;
    // A socket exists but for a DIFFERENT token (re-login as another account
    // without this widget unmounting) — tear it down before reconnecting,
    // otherwise it would keep running authenticated as the old account.
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    const sock = io(API, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    socketTokenRef.current = token;
    ensureDesktopNotifyPermission();

    sock.on('connect', () => {
      console.log('[WIDGET SOCKET] Connected/Reconnected');
      fetchConversationsWithRetry();
      // Vital for retaining real-time tracking if socket reconnects gracefully after a brief dropout or server bounce
      setConversations(currentConvos => {
        if (!Array.isArray(currentConvos)) return currentConvos;
        const roomIds = currentConvos.filter(c => c.type === 'room').map(c => c.id || c.partner);
        if (roomIds.length > 0) {
          sock.emit('track_rooms', { roomIds });
        }
        return currentConvos;
      });
    });

    sock.on('presence_snapshot', ({ online }) => {
      setOnlineUsers(new Set((online || []).map(u => u.toLowerCase())));
    });
    sock.on('presence_update', ({ username: presenceUser, online }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        const key = (presenceUser || '').toLowerCase();
        if (online) next.add(key); else next.delete(key);
        return next;
      });
    });

    sock.on('account_banned', ({ reason, isPermanent, expiresAt }) => {
      clearUserSession();
      sock.disconnect();
      const msg = isPermanent
        ? `Your account has been permanently banned by an admin.\nReason: ${reason}`
        : `Your account has been banned until ${new Date(expiresAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}.\nReason: ${reason}`;
      navigate('/login', { state: { banMessage: msg } });
    });

    sock.on('account_terminated', ({ reason }) => {
      clearUserSession();
      sock.disconnect();
      navigate('/login', { state: { terminateMessage: `Your account has been permanently terminated by an admin.\nReason: ${reason}\nYou can no longer use this account.` } });
    });

    sock.on('chat:mark_read', ({ chatId, timestamp }) => {
      // Sync unread status across multiple browser tabs/windows (case-insensitive check)
      const target = (chatId || '').toLowerCase();
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c => {
        const cId = (c.id || '').toLowerCase();
        const cPartner = (c.partner || '').toLowerCase();
        return (cId === target || cPartner === target) ? { ...c, unread: 0 } : c;
      }));
      // Every mounted instance of this widget (Room's inline chat panel,
      // the floating overlay, BottomNav's own instance that owns the nav
      // icon badge) has its own socket connection and its own onMarkRead
      // callback wired to its own app-wide unread counter. This event
      // fires whenever THIS chat was marked read anywhere by this same
      // account — so every instance's counter needs to drop it, not just
      // whichever one instance happens to currently have this exact chat
      // "active". Gating this on activeChatRef (as before) is why reading
      // a chat in Room's panel, or the floating widget, never reliably
      // cleared BottomNav's icon badge — that badge's owning instance
      // almost never has the same chat marked "active" in its own state.
      if (onMarkRead) {
        onMarkRead(chatId);
      }
    });

    sock.on('chat:mark_all_read', () => {
      // Another tab/device marked all as read — sync this tab too
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c => ({ ...c, unread: 0 })));
      if (typeof onMarkAllRead === 'function') onMarkAllRead();
    });

    sock.on('chat:messages_seen', ({ roomId: eventRoomId, username: readerName, messageIds, seenAt, avatar }) => {
      const currentChat = activeChatRef.current;
      if (!currentChat) return;

      let isMatch = false;
      if (currentChat.type === 'room') {
        const activeRoomId = (currentChat.partner || currentChat.id || '').toLowerCase();
        isMatch = (eventRoomId || '').toLowerCase() === activeRoomId;
      } else if (currentChat.type === 'private') {
        const activePartner = (currentChat.partner || currentChat.id || '').toLowerCase();
        const sorted = [myUsername.toLowerCase(), activePartner].sort().join('-');
        const expectedDmRoomId = 'dm-' + sorted;
        isMatch = (eventRoomId || '').toLowerCase() === expectedDmRoomId;
      }

      if (isMatch) {
        setMessages(prev => prev.map(m => {
          const msgIdStr = String(m.id);
          if (messageIds.some(id => String(id) === msgIdStr)) {
            const seenBy = m.seenBy ? [...m.seenBy] : [];
            if (!seenBy.some(u => u.username.toLowerCase() === readerName.toLowerCase())) {
              seenBy.push({ username: readerName, seenAt, avatar });
            }
            return { ...m, seenBy };
          }
          return m;
        }));
      }
    });

    // Flexible matching for reactions and deletions (by id, timestamp, tempId, or timestampId from server)
    const flexibleMatch = (msgIdOrTs, m) => {
      const sId = String(m.id);
      const sMatch = String(msgIdOrTs);
      const sTs = String(m.timestamp);
      return sId === sMatch || sTs === sMatch || (m.tempId && String(m.tempId) === sMatch);
    };

    sock.on('chat:reaction', ({ roomId, messageId, timestampId, reactions }) => {
      setMessages(prev => prev.map(m =>
        (flexibleMatch(messageId, m) || (timestampId && flexibleMatch(timestampId, m))) ? { ...m, reactions } : m
      ));
    });

    sock.on('chat:private_reaction', ({ messageId, timestampId, reactions }) => {
      if (!reactions) return;
      setMessages(prev => prev.map(m =>
        (flexibleMatch(messageId, m) || (timestampId && flexibleMatch(timestampId, m))) ? { ...m, reactions } : m
      ));
    });

    // Poll vote cast/changed by anyone (self included, so every open tab
    // stays in sync) — one shared event for both private and group polls,
    // see POST /api/chats/vote's dual emitToUser/io.in(roomId) broadcast.
    sock.on('chat:poll_vote', ({ messageId, timestampId, pollVotes }) => {
      if (!pollVotes) return;
      setMessages(prev => prev.map(m =>
        (flexibleMatch(messageId, m) || (timestampId && flexibleMatch(timestampId, m))) ? { ...m, pollVotes } : m
      ));
    });

    const handleRemoteDelete = ({ messageId, originalId, timestampId }) => {
      setMessages(prev => prev.filter(m => 
        !flexibleMatch(messageId, m) && 
        (!originalId || !flexibleMatch(originalId, m)) &&
        (!timestampId || !flexibleMatch(timestampId, m))
      ));
      
      setConversations(prev => {
        const conversations = Array.isArray(prev) ? prev : [];
        const match = conversations.find(c =>
          String(c.lastTimestamp) === String(timestampId) ||
          (originalId && String(c.lastTimestamp) === String(originalId)) ||
          String(c.lastTimestamp) === String(messageId)
        );
        if (!match) return conversations;
        fetchConversations();
        // Zero out lastTimestamp on the tracked entry immediately, rather than
        // waiting on fetchConversations() to land: that fetch's own merge logic
        // treats a HIGHER local lastTimestamp than what the server just returned
        // as "local is ahead, probably an optimistic send still in flight" and
        // keeps the (now-deleted) stale preview — this was the exact reason
        // unsending the conversation's last message left it stuck showing text/
        // media that no longer exists, even across a hard refresh (localStorage
        // persists the wrong merge result right back into the next fetch's
        // "existing" side). Resetting to 0 here guarantees the server's fresh
        // "real" last message always wins once that fetch resolves.
        return conversations.map(c => (c === match ? { ...c, lastTimestamp: 0 } : c));
      });
    };

    sock.on('chat:message_deleted', handleRemoteDelete);
    sock.on('message:unsent', handleRemoteDelete);
    sock.on('message:removed-for-me', handleRemoteDelete);

    // Edit broadcast — own edit reconciliation (this client's own PUT request
    // already patched local state optimistically) or the other participant
    // editing their message live. Branches on whether `keys` (the per-recipient
    // e2ee key map) is present to tell group edits from DM edits — group and DM
    // both always carry a nonce now, so "nonce absent" only means a legacy
    // pre-upgrade group message being edited while still in plaintext.
    const handleRemoteEdit = ({ messageId, message: newMessage, senderMessage, nonce, ephemeralPublicKey, keys, editedAt }) => {
      setMessages(prev => prev.map(m => {
        if (!flexibleMatch(messageId, m)) return m;
        // A captioned media message's decrypted plaintext is the packed
        // {k: mediaKeyB64, c: caption} envelope (see commitEditedText /
        // packMediaKeyAndCaption) — only the caption half is ever shown
        // here; the key isn't needed again since the media itself was
        // already decrypted once at initial render and stays cached.
        // Without this, an edited caption on a media message would render
        // as the literal '{"k":"...","c":"..."}' JSON string on screen.
        const extractCaption = (plain) => (m.mediaType ? unpackMediaKeyAndCaption(plain).caption : plain);
        let decryptedText = m.mediaType ? m.decryptedText : newMessage;
        if (nonce && keyPair) {
          try {
            if (keys) {
              const myLower = myUsername?.toLowerCase();
              const myEncKey = keys[myLower] || Object.entries(keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
              if (myEncKey && ephemeralPublicKey) {
                const senderPubKey = decodeBase64(ephemeralPublicKey);
                const plain = decryptGroupMessage(newMessage, nonce, myEncKey, senderPubKey, keyPair.secretKey);
                decryptedText = plain != null ? extractCaption(plain) : CORRUPTED_EDIT_PLACEHOLDER;
              } else {
                decryptedText = m.decryptedText;
              }
            } else if (m.isMe && senderMessage) {
              const plain = decryptDMSenderCopy(senderMessage, nonce, ephemeralPublicKey, encodeBase64(keyPair.secretKey));
              decryptedText = plain != null ? extractCaption(plain) : m.decryptedText;
            } else if (!m.isMe && ephemeralPublicKey) {
              const plain = decryptDM(newMessage, nonce, ephemeralPublicKey, encodeBase64(keyPair.secretKey));
              decryptedText = plain != null ? extractCaption(plain) : m.decryptedText;
            }
          } catch (err) {
            console.warn('[E2EE] chat:message_edited decrypt failed:', err);
            decryptedText = m.decryptedText;
          }
        }
        return { ...m, message: newMessage, decryptedText, edited: true, editedAt };
      }));
    };
    sock.on('chat:message_edited', handleRemoteEdit);
    sock.on('message:edited', handleRemoteEdit);

    // Delivered-tick catch-up: a DM recipient who was offline at send time just
    // reconnected — flip that message's tick from single to double-grey live.
    sock.on('message:delivered', ({ messageId, deliveredAt }) => {
      setMessages(prev => prev.map(m => (flexibleMatch(messageId, m) ? { ...m, deliveredAt } : m)));
    });

    // A private-chat theme is a shared conversation property (see
    // applyChatTheme) — the backend double-writes both participants'
    // chat_theme_prefs and pushes this to both over the socket, so whichever
    // side DIDN'T make the change still updates live instead of only on next
    // fetch. chatKey here is already expressed from THIS client's own point
    // of view (their username, for the person who changed it).

    sock.on('chat:typing', (data) => {
      // Handle both formats: explicit isTyping flag or implicit start
      const isStarting = data.isTyping !== false;
      handleTypingStatus(data, isStarting);
    });

    sock.on('public_key_updated', ({ username: targetUser, publicKey: newPK }) => {
      // Real-time key-rotation propagation: this fires the instant a peer
      // establishes/rotates their E2EE identity (signup, password reset,
      // etc.), so the cache below is corrected immediately instead of only
      // on the next page load. Every DM send already does its own live
      // fetch before encrypting (see handleSend), so this alone isn't what
      // makes sends correct — it just keeps the localStorage fallback (used
      // only if that live fetch itself fails) from ever going stale.
      if (!targetUser) return;
      const targetLower = targetUser.toLowerCase();
      if (newPK) {
        try { localStorage.setItem(`wt_pk_${targetLower}`, newPK); } catch {}
      } else {
        try { localStorage.removeItem(`wt_pk_${targetLower}`); } catch {}
      }
    });

    sock.on('blocking_updated', ({ blocker, blocked, isBlocked }) => {
      const myUsername = localStorage.getItem('watch_username');
      if (!myUsername) return;

      const blockerLow = blocker.toLowerCase();
      const blockedLow = blocked.toLowerCase();
      const meLow = myUsername.toLowerCase();

      // Blocking deletes the follow relationship both ways server-side (see
      // /api/block/:username), so any /api/users/:username response cached
      // by appCache for either party is now describing a stale relationship —
      // same treatment handleFollowEvent below already gives an accept/
      // reject, since this changes the exact same follow-based data.
      appCache.invalidatePrefix(`/api/users/${blockerLow}`);
      appCache.invalidatePrefix(`/api/users/${blockedLow}`);

      if (blockerLow === meLow) {
        // I blocked/unblocked someone
        setBlockedChats(prev => {
          const next = isBlocked ? [...new Set([...prev, blocked])] : prev.filter(u => u.toLowerCase() !== blockedLow);
          localStorage.setItem(`blocked_chats_${myUsername}`, JSON.stringify(next));
          return next;
        });
        fetchConversations();
      } else if (blockedLow === meLow) {
        // Someone blocked/unblocked me — blockingMe holds THEIR usernames, so
        // an unblock must filter out blockerLow (whoever unblocked me), not
        // blockedLow (my own username, from the destructured event payload —
        // never actually in this array). That mismatch meant this branch's
        // filter never matched anything, so a formerly-blocking contact
        // stayed stuck in blockingMe (and this chat kept showing "you were
        // blocked by this person" instead of the normal friend-request UI)
        // until a full page reload re-fetched it from scratch.
        setBlockingMe(prev => {
          const next = isBlocked ? [...new Set([...prev, blocker])] : prev.filter(u => u.toLowerCase() !== blockerLow);
          localStorage.setItem(`blocking_me_${myUsername}`, JSON.stringify(next));
          return next;
        });
        fetchConversations();
      }
      window.dispatchEvent(new Event('blocked_chats_updated'));

      // If this is an UNBLOCK event and the current active chat is affected,
      // immediately pre-set activeRelation to "no friendship" so the input 
      // is NEVER shown in the gap before the real refetch completes.
      const currentChat = activeChatRef.current;
      if (!isBlocked && currentChat && (
        currentChat.partner?.toLowerCase() === blockerLow ||
        currentChat.partner?.toLowerCase() === blockedLow
      )) {
        setActiveRelation({ followStatus: null, isFollowingMe: false });
      }

      // Refetch actual relation for the active chat
      if (currentChat && (currentChat.partner?.toLowerCase() === blockerLow || currentChat.partner?.toLowerCase() === blockedLow)) {
        const token = localStorage.getItem('watch_token');
        if (token) {
          fetch(`${API}/api/users/${currentChat.partner}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(d => setActiveRelation(d))
            .catch(err => console.error('Failed to refetch relation', err));
        }
      }
    });

    const handleFollowEvent = (data, eventType) => {
      const actor = data.requester || data.follower || data.actor;
      const target = data.accepter || data.following || data.target;
      // Desktop/browser equivalent of the FCM push server.js already sends
      // for this exact event (sendPushToUser(following, {... data: { type:
      // 'friend_request', ... }}, 'friendRequests')) — nothing showed this
      // on desktop at all before, since this handler previously only ever
      // invalidated caches. Only for an incoming request addressed to ME,
      // never the accepted/unfollow variants sharing this same handler.
      // Clicking it dispatches the same 'open_chat_from_notification' event
      // Navbar.jsx's own friend-tap listener already reacts to (opens the
      // notifications bell dropdown), matching what tapping the mobile push
      // already does.
      if (eventType === 'follow_request' && target && target.toLowerCase() === myUsername && isNotifyCategoryEnabled('friendRequests')) {
        showDesktopNotification('New Friend Request', `${actor} sent you a friend request`, `friend-request-${actor}`, { type: 'friend_request', username: actor });
      }
      // A socket push is instant, but the refetch that
      // follow_status_updated's listeners (Profile.jsx, useFollowRequests)
      // trigger goes through the same cached window.fetch every other GET
      // does — /api/users/:username has a 5-minute client-side TTL (see
      // fetchInterceptor.js), so without busting it here that refetch just
      // re-served the pre-accept response for up to several minutes,
      // making an instant server-side change look like it "didn't update"
      // on the receiving device.
      if (actor) appCache.invalidatePrefix(`/api/users/${actor.toLowerCase()}`);
      if (target) appCache.invalidatePrefix(`/api/users/${target.toLowerCase()}`);
      appCache.invalidatePrefix('/api/follow/requests');
      appCache.invalidatePrefix('/api/profile');
      window.dispatchEvent(new CustomEvent('follow_status_updated', { detail: data }));
      const currentChat = activeChatRef.current;

      if (currentChat && (
        (actor && actor.toLowerCase() === currentChat.partner?.toLowerCase()) || 
        (target && target.toLowerCase() === currentChat.partner?.toLowerCase())
      )) {
        const token = localStorage.getItem('watch_token');
        if (token) {
          fetch(`${API}/api/users/${currentChat.partner}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(d => setActiveRelation(d))
            .catch(err => console.error('Failed to refetch relation', err));
        }
      }
    };

    sock.on('follow_accepted', (data) => handleFollowEvent(data, 'follow_accepted'));
    sock.on('follow_request', (data) => handleFollowEvent(data, 'follow_request'));
    sock.on('unfollow', handleFollowEvent);


    const handleNewMsg = (msg) => {
      // TEMPORARY DIAGNOSTIC — remove once the intermittent "Encrypted
      // message" DM issue and the wrong/missing group-chat avatar issue are
      // both confirmed fixed. This is the RAW payload exactly as the server
      // sent it, before any client-side processing — the ground truth for
      // telling a server-side bug (wrong data sent) apart from a client
      // rendering bug (right data, wrong display).
      console.log('[DEBUG-RAW-MSG]', {
        id: msg.id, type: msg.type, isGroup: !!(msg.type === 'group' || msg.type === 'room' || msg.roomId),
        senderName: msg.senderName || msg.username, senderAvatar: msg.senderAvatar,
        hasNonce: !!msg.nonce, hasEphemeralPublicKey: !!msg.ephemeralPublicKey,
        hasSenderPublicKey: !!msg.senderPublicKey, hasE2ee: !!msg.e2ee, isMe: !!msg.isMe,
      });
      // Standardize timestamp
      const msgTs = Number(msg.timestamp) || Date.now();
      msg.timestamp = msgTs;

      // Deduplicate at the very top: prevents unread counts doubling when receiving both 
      // 'chat_message' (room channel) and 'new_chat_message' (user channel)
      const msgKey = msg.id ? String(msg.id) : (msg.timestamp ? `${msg.timestamp}-${msg.senderName || msg.username || 'unknown'}` : null);
      if (msgKey) {
        if (!processedMsgsRef.current) processedMsgsRef.current = new Set();
        if (processedMsgsRef.current.has(msgKey)) return; // Already processed!
        if (processedMsgsRef.current.size > 500) processedMsgsRef.current.clear();
        processedMsgsRef.current.add(msgKey);
      }

      const currentChat = activeChatRef.current;
      const currentView = viewRef.current;
      
      const isGroup = msg.type === 'group' || msg.type === 'room' || !!msg.roomId;
      const partner = isGroup ? (msg.roomId || msg.partner) : ((msg.isMe || (msg.senderName && msg.senderName === myUsername)) ? msg.targetName : msg.senderName);
      if (!partner) return;

      // A genuine new message supersedes any pending "reacted to your
      // message" preview override for this chat.
      setReactionPreviewOverrides(prev => {
        const key = partner.toLowerCase();
        if (!(key in prev)) return prev;
        const next = { ...prev }; delete next[key]; return next;
      });
      clearPersistedReactionPreview(partner.toLowerCase());

      // Purge partner from clearedPartnersRef if a new message arrives
      if (clearedPartnersRef.current) {
        const cRef = typeof clearedPartnersRef.current === 'object' ? { ...clearedPartnersRef.current } : {};
        let changed = false;
        Object.keys(cRef).forEach(k => {
          if (k.toLowerCase() === partner.toLowerCase()) {
            delete cRef[k];
            changed = true;
          }
        });
        if (changed) {
          clearedPartnersRef.current = cRef;
          try { localStorage.setItem('chat_cleared_partners', JSON.stringify(cRef)); } catch {}
        }
      }

      const myUname = (myUsername || '').toLowerCase();
      const isMine = msg.isMe || 
        (msg.senderName && msg.senderName.toLowerCase() === myUname) || 
        (msg.username && msg.username.toLowerCase() === myUname);
      
      let isMuted = false;
      try {
        const currentMyUser = localStorage.getItem('watch_username') || '';
        const m = JSON.parse(localStorage.getItem(`muted_chats_${currentMyUser}`) || '[]');
        if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
      } catch {}
      
      const partnerLower = (partner || '').toLowerCase();
      const isViewingThis = isOpenRef.current && currentView === 'chat' && ((currentChat?.partner || '').toLowerCase() === partnerLower || (currentChat?.id || '').toLowerCase() === partnerLower);

      // Compute a short preview text
      const _mt0 = msg.mediaType;
      const mediaPreview = (msg.mediaUrl || _mt0)
        ? (_mt0?.startsWith('video') ? 'Video' : _mt0?.startsWith('image') ? 'Photo' : _mt0?.startsWith('audio') ? 'Voice Note' : 'File')
        : null;
      const previewText = mediaPreview ||
        (msg.message && looksLikeCiphertext(msg.message) ? (isMine ? 'Message sent' : 'Message') : (msg.message || 'New message'));
      
      // ─── E2EE Decryption ─── (uses keyPairRef.current to avoid stale closure)
      let decryptedMessage = msg.message;
      let decryptedMediaUrl = msg.mediaUrl;
      const activeKey = keyPairRef.current;
      const msgNonce = msg.nonce || (msg.e2ee && msg.e2ee.nonce);
      if (isGroup && !msgNonce && !isSahaplayOfficialGroup(msg.roomId)) {
        // Legacy group message (predates client-side group E2EE) — see
        // LEGACY_GROUP_TEXT_PLACEHOLDER definition for the full rationale.
        decryptedMessage = msg.mediaUrl ? '' : LEGACY_GROUP_TEXT_PLACEHOLDER;
      }
      if (msgNonce && activeKey) {
        try {
          if (isGroup) {
            // Group: decrypt text message; for media, the URL is stored encrypted in message field
            if (msg.e2ee && msg.e2ee.keys && msg.e2ee.senderPublicKey) {
              const senderPK = decodeBase64(msg.e2ee.senderPublicKey);
              const userKeyWrap = msg.e2ee.keys[myUsername?.toLowerCase()];
              if (userKeyWrap) {
                if (msg.mediaType && msg.mediaUrl) {
                  // msg.message holds the ENCRYPTED MEDIA KEY (and, if this
                  // media was sent with a caption, that caption too — see
                  // packMediaKeyAndCaption).
                  decryptedMessage = '';
                  const decryptedPayload = decryptGroupMessage(msg.message, msgNonce, userKeyWrap, senderPK, activeKey.secretKey);
                  const { mediaKeyB64, caption } = unpackMediaKeyAndCaption(decryptedPayload);
                  decryptedMessage = caption;
                  if (mediaKeyB64) {
                    const msgKey = msg.id || msg.tempId || String(msg.timestamp);
                    const targetMediaUrl = msg.mediaUrl;
                    const targetMediaType = msg.mediaType;
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(mediaKeyB64);
                        const resolvedUrl = resolveMediaUrl(targetMediaUrl, API);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                        decryptedMediaUrls.current[msgKey] = objectUrl;
                        setMediaUrlVersion(v => v + 1);
                        // Restore the real permanent URL now that the in-flight decrypt is
                        // done, so this message stays forwardable — matches Room.jsx's fix.
                        setMessages(prev => prev.map(m => (String(m.id) === String(msgKey) || String(m.tempId) === String(msgKey) || String(m.timestamp) === String(msgKey)) ? { ...m, mediaUrl: targetMediaUrl } : m));
                      } catch (e) { console.warn('[E2EE] Async group media decrypt failed:', e); }
                    })();
                    decryptedMediaUrl = null;
                  }
                } else if (msg.message) {
                  decryptedMessage = decryptGroupMessage(msg.message, msgNonce, userKeyWrap, senderPK, activeKey.secretKey) || (msg.edited ? CORRUPTED_EDIT_PLACEHOLDER : ENCRYPTED_PLACEHOLDER);
                }
              }
            } else {
              // Bug fix: if senderPublicKey is missing from the e2ee object, fallback to partnerPublicKey if available or wait for it
              // (This shouldn't happen with the Room.jsx fix, but good for robustness)
            }
          } else {
            // DM Decryption
            if (isMine) {
              if (msg.mediaType) decryptedMessage = ''; 
              if (msg.senderMessage) {
                const plain = decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(activeKey.secretKey));
                if (plain) {
                  if (msg.mediaType) {
                    // plain = the base64 media key, plus a caption if one was
                    // sent alongside — see packMediaKeyAndCaption.
                    const { mediaKeyB64, caption } = unpackMediaKeyAndCaption(plain);
                    decryptedMessage = caption;
                    const msgKey = msg.id || msg.tempId || String(msg.timestamp);
                    const targetMediaUrl = msg.mediaUrl;
                    const targetMediaType = msg.mediaType;
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(mediaKeyB64);
                        const resolvedUrl = resolveMediaUrl(targetMediaUrl, API);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                        decryptedMediaUrls.current[msgKey] = objectUrl;
                        setMediaUrlVersion(v => v + 1);
                        // Restore the real permanent URL now that the in-flight decrypt is
                        // done, so this message stays forwardable — matches Room.jsx's fix.
                        setMessages(prev => prev.map(m => (String(m.id) === String(msgKey) || String(m.tempId) === String(msgKey) || String(m.timestamp) === String(msgKey)) ? { ...m, mediaUrl: targetMediaUrl } : m));
                      } catch (e) { console.warn('[E2EE] Async media decrypt failed (sender copy):', e); }
                    })();
                    decryptedMediaUrl = null; // will be populated async
                  } else {
                    decryptedMessage = plain;
                  }
                }
              }
            } else {
              const senderPK = msg.ephemeralPublicKey || msg.senderPublicKey || null;
              // TEMPORARY DIAGNOSTIC — remove once the intermittent
              // "Encrypted message" DM issue is confirmed fixed. Logs only
              // metadata (ids, key presence/length, a boolean) — never
              // plaintext, the raw ciphertext, or key material itself.
              console.log('[DEBUG-DM-RECV]', {
                msgId: msg.id, from: msg.senderName || msg.username,
                haveOwnKey: !!activeKey,
                ownPublicKey: activeKey ? encodeBase64(activeKey.publicKey) : null,
                senderPKFromPayload: senderPK,
                usedEphemeralPublicKey: !!msg.ephemeralPublicKey,
                usedSenderPublicKeyFallback: !msg.ephemeralPublicKey && !!msg.senderPublicKey,
                hasNonce: !!msg.nonce, hasCiphertext: !!msg.message,
              });
              if (senderPK) {
                if (msg.mediaType && msg.mediaUrl) {
                  // msg.message holds the ENCRYPTED MEDIA KEY (plus a caption,
                  // if one was sent alongside — see packMediaKeyAndCaption).
                  decryptedMessage = '';
                  const decryptedPayload = decryptDM(msg.message, msg.nonce, senderPK, encodeBase64(activeKey.secretKey));
                  const { mediaKeyB64, caption } = unpackMediaKeyAndCaption(decryptedPayload);
                  decryptedMessage = caption;
                  if (mediaKeyB64) {
                    const msgKey = msg.id || String(msg.timestamp);
                    const targetMediaUrl = msg.mediaUrl;
                    const targetMediaType = msg.mediaType;
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(mediaKeyB64);
                        const resolvedUrl = resolveMediaUrl(targetMediaUrl, API);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                        decryptedMediaUrls.current[msgKey] = objectUrl;
                        setMediaUrlVersion(v => v + 1);
                        // Restore the real permanent URL now that the in-flight decrypt is
                        // done, so this message stays forwardable, matching Room.jsx's fix.
                        setMessages(prev => prev.map(m => (String(m.id) === String(msgKey) || String(m.tempId) === String(msgKey) || String(m.timestamp) === String(msgKey)) ? { ...m, mediaUrl: targetMediaUrl } : m));
                      } catch (e) { console.warn('[E2EE] Async media decrypt failed:', e); }
                    })();
                    decryptedMediaUrl = null;
                  }
                } else if (msg.message) {
                  const plain = decryptDM(msg.message, msg.nonce, senderPK, encodeBase64(activeKey.secretKey));
                  decryptedMessage = plain != null ? plain : ENCRYPTED_PLACEHOLDER;
                  // TEMPORARY DIAGNOSTIC — see [DEBUG-DM-RECV] above; remove together.
                  console.log('[DEBUG-DM-RECV] decrypt result', { msgId: msg.id, success: plain != null });
                }
              } else {
                console.log('[DEBUG-DM-RECV] no senderPK at all — cannot even attempt decrypt', { msgId: msg.id });
              }
            }
          }
        } catch (e) { console.warn('[E2EE] Decryption failed', e); }
      }
      if (!isGroup && !isMine && msg.message && !activeKey) {
        // TEMPORARY DIAGNOSTIC — see [DEBUG-DM-RECV] above; remove together.
        // This is the specific "own key wasn't ready yet at arrival" case
        // the retry effect near keyPairRef exists to fix.
        console.log('[DEBUG-DM-RECV] activeKey was null at arrival — this message will show Encrypted message until the retry effect fires', { msgId: msg.id });
      }
      if (!isGroup && !msg.mediaType && !decryptedMessage && msg.message && (msg.nonce || msg.ephemeralPublicKey || msg.message.startsWith('Vs!') || (msg.message.length > 25 && !msg.message.includes(' ') && (msg.message.endsWith('=') || msg.message.includes('+') || msg.message.includes('/'))))) {
        // Most commonly reached with activeKey === null \u2014 this account's own
        // key hadn't finished being established yet at the exact instant
        // this message arrived (see the retry effect near keyPairRef below).
        // Never a permanent failure by itself; the retry effect re-attempts
        // exactly this case once keyPair actually becomes available.
        decryptedMessage = ENCRYPTED_PLACEHOLDER;
      }
      // ─── Post-Decryption Processing ───
      msg.decryptedText = decryptedMessage;
      msg.mediaUrl = decryptedMediaUrl;

      // Chat-theme-change system message: apply the theme locally right away
      // (covers this account's other open tabs/devices instantly) and, if this
      // DM thread is currently open, append it so the pill renders live — but
      // never touch the sidebar preview/unread count/toast for it, since it's
      // not a real message the user sent or received.
      if (msg.isNotice && !isGroup) {
        setChatThemes(prev => {
          const next = { ...prev };
          if (msg.noticeThemeId && msg.noticeThemeId !== 'default') next[partnerLower] = msg.noticeThemeId;
          else delete next[partnerLower];
          try { localStorage.setItem(`chat_themes_${myUsername}`, JSON.stringify(next)); } catch {}
          return next;
        });
        if (isViewingThis) {
          setMessages(prev => [...prev, msg]);
        }
        return;
      }

      // RE-COMPUTE PREVIEW TEXT AFTER DECRYPTION
      // This is what shows in the conversation list (sidebar) and toasts
      const _mt1 = msg.mediaType;
      const finalizedMediaPreview = (msg.mediaUrl || _mt1)
        ? (_mt1?.startsWith('video') ? 'Video' : _mt1?.startsWith('image') ? 'Photo' : _mt1?.startsWith('audio') ? 'Voice Note' : 'File')
        : null;

      const finalizedPreview = finalizedMediaPreview ||
        ((msg.isPoll || isPollJSON(msg.decryptedText) || isPollJSON(msg.message))
          ? '📊 Poll'
          : ((msg.decryptedText && !looksLikeCiphertext(msg.decryptedText))
            ? truncateToFewWords(msg.decryptedText)
            : (msg.message && looksLikeCiphertext(msg.message) ? (isMine ? 'Message sent' : 'Message') : truncateToFewWords(msg.message || 'New message'))));

      // If this message belongs to the currently open chat, append it to the message list
      if (isViewingThis) {
        setMessages(prev => {
          // Reconciliation: If we have an optimistic message with the same tempId, replace it.
          if (msg.tempId) {
            const optIdx = prev.findIndex(m => m.id === msg.tempId || (m.timestamp && String(m.timestamp) === String(msg.tempId)));
            if (optIdx !== -1) {
              const updated = [...prev];
              const optimistic = prev[optIdx];
              // If decryption failed (activeKey was null) but the optimistic bubble had good
              // plaintext, preserve it so we don't overwrite readable content with ciphertext.
              const safeDecryptedText = msg.decryptedText || (msg.nonce && !activeKey && optimistic.message && !optimistic.message.startsWith('\uD83D\uDD12') ? optimistic.message : null);
              updated[optIdx] = { 
                ...msg, 
                tempId: optimistic.tempId, 
                decryptedText: safeDecryptedText, 
                mediaUrl: msg.mediaUrl, 
                _localMediaUrl: optimistic._localMediaUrl || optimistic.mediaUrl, 
                _fileName: optimistic._fileName || msg.mediaFileName || null,
                _fileSize: optimistic._fileSize || msg.mediaFileSize || null,
                mediaDuration: msg.mediaDuration || optimistic.mediaDuration || null,
                isMe: isMine, 
                reactions: msg.reactions || {} 
              };
              return resolveReplyMessages(updated);
            }
          }

          // Dedup by ID or by timestamp+sender (prevents double-socket delivery)
          const alreadyExists = prev.some(m =>
            (msg.id && String(m.id) === String(msg.id)) ||
            (msg.timestamp && m.timestamp && String(m.timestamp) === String(msg.timestamp) &&
             (m.senderName || m.username || m.senderId) === (msg.senderName || msg.username || msg.senderId))
          );
          if (alreadyExists) return prev;
          return resolveReplyMessages([...prev, { ...msg, isMe: isMine, reactions: msg.reactions || {} }]);
        });
        
        // Notify Home/Navbar to clear unread if we're currently viewing it
        if (!isMine) {
          markChatAsRead(partner, true);
        }
      } else {
        // New message for a different/closed chat — notify for ALL non-own messages
        if (!isMine) {
          if (onNewMessage) onNewMessage(partner, msg);
          
          let skipToast = false;
          // Separate from skipToast: whether the DESKTOP (.exe) OS
          // notification should stay silent. Explicit ask: only suppress it
          // when this exact chat/room's THREAD is actually open somewhere
          // in the app — not merely "inside the room at all" the way
          // skipToast's own hostRoomId branch below treats it. RoomChatPanel
          // has a 'list' pseudo-tab (its conversation-picker view, before
          // drilling into an actual thread) where chatTab isn't 'group' —
          // reported live: sitting on that list with the room's own group
          // chat just showing an unread badge produced no Windows toast at
          // all, because hostRoomId's unconditional match doesn't care
          // whether 'list' or 'group' is actually showing. Built off the
          // same precise activeRoomTabRef+partner match already used for
          // the DM case below, which never had this bug.
          let skipDesktopNotif = false;
          // Call-log control messages ("sahaplay_call{...}") are rendered
          // specially inside the chat bubble itself (see the CALL_LOG_PREFIX
          // check further down this file) — showing them here would leak the
          // raw, un-templated control string as toast text (e.g.
          // `sahaplay_call{"callType":"voice","status":"m...`). The call's
          // own native/JS UI already told the user it ended; this toast
          // (and the desktop notification below) would just be unwanted,
          // malformed-looking noise on top of that — the only one of these
          // checks that also applies to the desktop notification, since
          // CallContext.jsx already sends its own dedicated call
          // notifications.
          const isCallLog = !!(msg.decryptedText && msg.decryptedText.startsWith(CALL_LOG_PREFIX));
          if (isCallLog) { skipToast = true; skipDesktopNotif = true; }
          // 1. Check if user is looking at this chat in the Global Widget itself
          if (isViewingThis) { skipToast = true; skipDesktopNotif = true; }

          // 2. Check if user is looking at this chat in the specialized Room panel
          const lowerPartner = partner.toLowerCase();
          const lowerActivePartner = (activeRoomPartnerRef.current || '').toLowerCase();
          if (isGroup) {
             if (activeRoomTabRef.current === 'group' && lowerPartner === lowerActivePartner) { skipToast = true; skipDesktopNotif = true; }
             // 2b. This widget instance's own host room's group chat — suppress
             // just the in-page TOAST unconditionally, not just when its tab
             // happens to be focused (see hostRoomId's own comment above for
             // why): RoomChatPanel.jsx renders the message live the instant it
             // arrives regardless of which of its own tabs is active, so a
             // toast popping up on top of the room UI would be redundant.
             //
             // Deliberately NOT applied to skipDesktopNotif — see that
             // variable's own comment just above for the 'list'-tab bug this
             // avoids, plus the original reasoning this file already had for
             // never applying this unconditional branch to the desktop
             // notification: "I closed the room's chat panel (not just
             // switched tabs) but left the room open, then backgrounded the
             // app, and got nothing for a new group message." RoomChatPanel
             // has no notification of its own to fall back on once its chat
             // isn't the visible content, and showDesktopNotification already
             // has its own, better-targeted guard for "the user is currently
             // looking at this window at all" (document.hidden / hasFocus())
             // — this blanket per-room suppression only ever needs to
             // protect the toast.
             if (hostRoomIdRef.current && lowerPartner === hostRoomIdRef.current.toLowerCase()) skipToast = true;
          } else {
             if (activeRoomTabRef.current === 'dm' && lowerPartner === lowerActivePartner) { skipToast = true; skipDesktopNotif = true; }
          }

          if (!isMuted && isNotifyCategoryEnabled('messages')) {
            // Robust Room Name Lookup from conversation cache if msg payload lacks it
            let groupName = msg.roomName || msg.displayName;
            if (isGroup && !groupName) {
               const cached = conversationsRef.current.find(c => c.partner === partner);
               if (cached) groupName = cached.displayName;
            }
            if (!groupName) groupName = isGroup ? 'Group Chat' : 'User';

            const msgSender = msg.senderName || msg.username || partner || 'User';

            // ─── Hidden Chat: show privacy-safe preview if this chat is hidden ───
            let isHidden = false;
            try {
              const hiddenList = JSON.parse(localStorage.getItem(`hidden_chats_${myUsername}`) || '[]');
              if (hiddenList.some(u => u.toLowerCase() === partner.toLowerCase())) isHidden = true;
            } catch {}

            const cachedConv = conversationsRef.current.find(c => c.partner === partner || c.id === partner);
            const unreadCount = (cachedConv?.unread || 0) + 1;
            const msgStr = unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`;

            if (!skipToast) {
              // User's chosen message tone (see AppSettings.jsx's Sound
              // section) — mirrored into localStorage the same way
              // notifyCalls already is, since this widget has no settings-
              // fetch of its own. Defaults to 'chime' when never set.
              try { playNotificationTone(localStorage.getItem('watch_notify_sound') || 'chime'); } catch {}

              const textToDisplay = isHidden
                ? (isGroup ? `${groupName}: ${msgSender}: ${msgStr}` : `${msgSender}: ${msgStr}`)
                : (isGroup
                  ? `${groupName}: ${msgSender}: ${finalizedPreview}`
                  : `${msgSender}: ${finalizedPreview}`);

              toast(textToDisplay, { id: `msg-${msgKey || Date.now()}`, icon: '💬', duration: 3500 });
            }

            if (!isCallLog) {
              const notifBody = isHidden ? msgStr : finalizedPreview;
              // chatId/type let a click open this exact chat — see
              // showDesktopNotification's own comment on the 4th param.
              // 5th param (Tauri/.exe only, see that same comment): this
              // exact chat/room's THREAD is actually open somewhere in the
              // app (skipDesktopNotif, computed above — deliberately
              // stricter than skipToast) — stay silent instead of also
              // popping a Windows toast for a message the user can already
              // see live in that panel.
              // Sender's avatar (not the group's — a group has none of its own,
              // same distinction the conversation-list avatar logic already
              // makes) shown as the notification icon on browser/.exe.
              showDesktopNotification(isGroup ? groupName : msgSender, notifBody, partnerLower, { chatId: partner, type: isGroup ? 'room' : 'dm' }, isTauriApp() && skipDesktopNotif, getAvatarUrl(msg.senderAvatar));
            }
          }
        }
      }
      
      // Always refresh conversation list to show latest preview
      setConversations(prev => {
        const conversations = Array.isArray(prev) ? prev : [];
        const exists = conversations.find(c => c.partner === partner || c.id === partner);
        const isViewingThis = isOpenRef.current && currentView === 'chat' && ((currentChat?.partner || '').toLowerCase() === partnerLower || (currentChat?.id || '').toLowerCase() === partnerLower);

        let updatedList;
        if (exists) {
          // For our own message echoes, use tempId to detect staleness instead of timestamps.
          // Server timestamps can exceed the client-optimistic timestamp of a later message due
          // to clock skew, which would otherwise make message-1's echo overwrite message-2's preview.
          const isOwnEcho = isMine && !!msg.tempId;
          const hasTrackedTempId = isOwnEcho && !!lastSentTempIdRef.current[partner];
          const isLatestOwnEcho = hasTrackedTempId 
            ? msg.tempId === lastSentTempIdRef.current[partner]
            : msgTs >= (Number(exists.lastTimestamp) || 0);

          const isNewerTs = msgTs > (Number(exists.lastTimestamp) || 0);
          const isSameTs = msgTs === (Number(exists.lastTimestamp) || 0);
          let isNewerId = false;
          if (isSameTs) {
            const newIdNum = Number(msg.id);
            const oldIdNum = Number(exists.lastMessageId);
            if (!isNaN(newIdNum) && !isNaN(oldIdNum)) {
              isNewerId = newIdNum >= oldIdNum;
            } else {
              isNewerId = String(msg.id) >= String(exists.lastMessageId || '');
            }
          }

          const isNewer = isOwnEcho
            ? isLatestOwnEcho
            : (isNewerTs || (isSameTs && isNewerId));

          const _mt2 = msg.mediaType;
          const rawConvDecryptedText = _mt2
            ? (_mt2.startsWith('video') ? 'Video' : _mt2.startsWith('image') ? 'Photo' : _mt2.startsWith('audio') ? 'Voice Note' : 'File')
            : (msg.decryptedText || null);
          // If the sender's own key wasn't in e2ee.keys, decryption fails and msg.decryptedText
          // is still ciphertext. Fall back to the existing value (set by the optimistic update).
          const convDecryptedText = (!_mt2 && rawConvDecryptedText && looksLikeCiphertext(rawConvDecryptedText))
            ? exists.decryptedText
            : rawConvDecryptedText;
          // Same guard for the preview string itself
          const safePreview = (finalizedPreview && looksLikeCiphertext(finalizedPreview))
            ? exists.message
            : finalizedPreview;
          const updatedItem = {
            ...exists,
            message: isNewer ? safePreview : exists.message,
            decryptedText: isNewer ? convDecryptedText : exists.decryptedText,
            lastMediaType: isNewer ? (msg.mediaType || null) : exists.lastMediaType,
            lastMediaFileName: isNewer ? (msg.mediaFileName || null) : exists.lastMediaFileName,
            lastMediaDuration: isNewer ? (msg.mediaDuration || null) : exists.lastMediaDuration,
            lastTimestamp: isNewer ? msgTs : exists.lastTimestamp,
            lastMessageId: isNewer ? (msg.id || null) : (exists.lastMessageId || null),
            lastSenderName: isNewer ? (msg.senderName || msg.username) : exists.lastSenderName,
            isMyLastMessage: isNewer ? isMine : exists.isMyLastMessage,
            unread: Number(exists.unread || 0) + (!isMine && !isViewingThis ? 1 : 0),
            partner: partner,
            displayName: isGroup
              ? (msg.roomName || exists.displayName || 'Room Chat')
              : (exists.displayName || (isMine ? partner : (msg.senderName || msg.username || partner))),
            // A group chat has no per-message "avatar" of its own — msg.senderAvatar
            // is that ONE member's personal avatar, never the room's. Falling back to
            // it here (as the private-DM branch correctly does for a partner's avatar)
            // briefly painted a group's list entry with whoever just happened to send
            // the live message, snapping back to the real (often blank) group avatar
            // only on the next full conversation refetch — confirmed live: "sender's
            // avatar shows on the group for a moment after going back to the list."
            partnerAvatar: isGroup ? (exists.partnerAvatar || null) : (exists.partnerAvatar || (isMine ? msg.partnerAvatar : msg.senderAvatar) || null),
            // Sync permissions from each incoming message so the widget stays current
            ...(isGroup && msg.roomPermissions ? { permissions: msg.roomPermissions } : {}),
            ...(isGroup && msg.isHost !== undefined ? { isHost: msg.isHost } : {})
          };
          const others = conversations.filter(c => c.partner !== partner && c.id !== partner);
          updatedList = [updatedItem, ...others];
        } else {
          const _mt3 = msg.mediaType;
          const convDecryptedText = _mt3
            ? (_mt3.startsWith('video') ? 'Video' : _mt3.startsWith('image') ? 'Photo' : _mt3.startsWith('audio') ? 'Voice Note' : 'File')
            : (msg.decryptedText || null);
          updatedList = [{
            id: isGroup ? partner : undefined,
            partner,
            displayName: isGroup ? (msg.roomName || 'Room Chat') : (isMine ? partner : (msg.senderName || msg.username || partner)),
            // See the matching comment on the other branch above — a group has no
            // per-message avatar, so this must never borrow msg.senderAvatar.
            partnerAvatar: isGroup ? null : (isMine ? (msg.partnerAvatar || null) : (msg.senderAvatar || msg.partnerAvatar || null)),
            lastTimestamp: msgTs,
            lastMessageId: msg.id || null,
            message: finalizedPreview,
            decryptedText: convDecryptedText,
            lastMediaType: msg.mediaType || null,
            lastMediaFileName: msg.mediaFileName || null,
            lastMediaDuration: msg.mediaDuration || null,
            lastSenderName: msg.senderName || msg.username,
            isMyLastMessage: isMine,
            type: isGroup ? 'room' : 'private',
            unread: !isMine && !isViewingThis ? 1 : 0
          }, ...conversations];
        }
        return updatedList.sort((a,b) => getSortTime(b) - getSortTime(a));
      });
    };

    // new_chat_message: group notifications for other participants (sender excluded server-side)
    // private_message: DM delivery to both sender (isMe:true) and recipient (isMe:false)
    sock.on('chat_message', handleNewMsg);
    sock.on('new_chat_message', handleNewMsg);
    sock.on('global_new_chat_message', handleNewMsg);
    sock.on('private_message', handleNewMsg);

    // A follower/following/DM contact renamed their username server-side —
    // the backend has already cascaded follows/blocks/messages to the new
    // name, but this client's conversations list, any currently-open chat
    // with them, and their cached avatar/relation are still built from the
    // old one. Without this, the other person's avatar looked "stuck" and,
    // if a chat with them happened to be open, the follow-status refetch
    // that gates DMs kept resolving against the now-dead old username —
    // exactly the intermittent "Friendship required" flash on an otherwise
    // still-mutual pair. Refresh both live instead of waiting on this
    // page's next full reload or the 5-minute profile cache TTL.
    sock.on('user_renamed', ({ oldUsername, newUsername }) => {
      if (!oldUsername || !newUsername) return;
      const oldLower = oldUsername.toLowerCase();
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
        (c.partner || c.id || '').toLowerCase() === oldLower
          ? { ...c, partner: newUsername, id: newUsername }
          : c
      ));
      const active = activeChatRef.current;
      const isActiveChatWithThem = !!active && active.type === 'private' &&
        (active.partner || active.id || '').toLowerCase() === oldLower;
      if (isActiveChatWithThem) {
        setActiveChat(prev => (prev ? { ...prev, partner: newUsername, id: newUsername } : prev));
      }
      fetch(`${API}/api/users/${newUsername}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.json())
        .then(d => {
          if (!d || d.error) return;
          setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
            (c.partner || c.id || '').toLowerCase() === newUsername.toLowerCase()
              ? { ...c, displayName: d.displayName || c.displayName, partnerAvatar: d.avatarPath || c.partnerAvatar }
              : c
          ));
          if (isActiveChatWithThem) {
            setActiveChat(prev => (prev ? { ...prev, displayName: d.displayName || prev.displayName, partnerAvatar: d.avatarPath || prev.partnerAvatar } : prev));
            setActiveRelation(d);
          }
        })
        .catch(() => {});
    });

    // Sync room permissions into conversations + activeChat when:
    // (a) widget first connects/reconnects — server sends a snapshot
    // (b) host changes room settings live
    const applyRoomPermissions = ({ roomId, permissions, isHost }) => {
      if (!roomId || !permissions) return;
      const rid = roomId.toLowerCase();
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
        (c.id === rid || (c.partner || '').toLowerCase() === rid)
          ? { ...c, permissions, isHost: !!isHost }
          : c
      ));
      // Also update activeChat if the user is currently viewing this room chat
      setActiveChat(prev => {
        if (!prev || prev.type !== 'room') return prev;
        const chatId = (prev.id || prev.partner || '').toLowerCase();
        if (chatId !== rid) return prev;
        return { ...prev, permissions, isHost: !!isHost };
      });
    };

    sock.on('room_permissions_snapshot', applyRoomPermissions);
    sock.on('room_settings_updated', ({ roomId, permissions, hostUsername, admins = [] }) => {
      if (!roomId || !permissions) return;
      const rid = roomId.toLowerCase();
      const myUser = (myUsername || localStorage.getItem('watch_username') || '').toLowerCase();
      // Determine isHost: if hostUsername matches current user, or if they are in the admins array
      const isHost = !!(
        (hostUsername && myUser && hostUsername.toLowerCase() === myUser) || 
        admins.map(a => a.toLowerCase()).includes(myUser)
      );
      applyRoomPermissions({ roomId: rid, permissions, isHost });
    });

    // A room rename (from this widget, Room.jsx's settings, or any other
    // session/device) should show up here immediately without waiting on a
    // reload — this socket already joined every room-type conversation's
    // channel via track_rooms above, so it receives this live regardless of
    // whether the rename happened in THIS session or somewhere else. Also
    // updates the conversation list's own localStorage cache (the effect
    // syncing `conversations` there already exists) so a cold reload picks
    // up the fresh name too, not just this live update.
    const applyRoomRename = ({ roomId, newName }) => {
      if (!roomId || !newName) return;
      const rid = roomId.toLowerCase();
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
        (c.type === 'room' && (c.partner || c.id || '').toLowerCase() === rid) ? { ...c, displayName: newName } : c
      ));
      const current = activeChatRef.current;
      if (current && current.type === 'room' && (current.partner || current.id || '').toLowerCase() === rid) {
        setActiveChat(prev => (prev ? { ...prev, displayName: newName } : prev));
      }
    };
    sock.on('room_renamed', applyRoomRename);
    sock.on('room_renamed_global', applyRoomRename);

    sock.on('public_key_updated', ({ username, publicKey }) => {
      if (!username) return;
      const userLower = username.toLowerCase();
      if (publicKey) {
        try { localStorage.setItem(`wt_pk_${userLower}`, publicKey); } catch {}
      } else {
        try { localStorage.removeItem(`wt_pk_${userLower}`); } catch {}
      }
    });

    // Re-unified typing indicator is now handled by sock.on('chat:typing') at the top
    sock.on('dm_cleared', (data) => {
      const { userA, userB, targetUsername: legacyTarget } = data;
      // Case-insensitive: socket.username from backend may differ in casing from localStorage myUsername
      const targetUsername = legacyTarget || (
        (userA || '').toLowerCase() === myUsername ? userB : userA
      );
      const targetLower = (targetUsername || '').toLowerCase();

      // Server-authoritative confirmation of the clear (fired back to the
      // actor's own socket on every path — see backend's clear_dm handler),
      // so this is the one place guaranteed to run regardless of which UI
      // triggered it. Without this, the stale last-4 tail this same chat
      // wrote to localStorage before the clear survives untouched — reopening
      // the chat after a reload flashes those old messages for a beat before
      // the real (now-empty) fetch overwrites them, reading as "cleared, but
      // reload brought it back".
      clearRecentMessagesCache('private', targetLower);

      // Only clear messages — keep the conversation entry in the list
      // Prevent loadMoreHistory from fetching pre-clear pages
      paginationStateRef.current[targetLower] = { hasMore: false, isLoading: false };
      if (activeChatRef.current && (
        (activeChatRef.current.partner || '').toLowerCase() === targetLower ||
        (activeChatRef.current.id || '').toLowerCase() === targetLower
      )) {
        // Cancel any in-flight fetchHistory before clearing so a stale response can't restore messages
        latestHistoryRequestRef.current++;
        setMessages([]);
      }
      // Update the conversation preview to show empty state (no message)
      setConversations(prev => {
        const updated = prev.map(c =>
          (c.partner || '').toLowerCase() === targetLower
            ? { ...c, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() }
            : c
        );
        // Guard: only persist to chat_cleared_partners if the chat was NOT explicitly deleted.
        // deleteChat() removes the entry from watch_recent_chats synchronously before this
        // socket event fires, so we use that as the source of truth.
        const stillExists = (() => {
          try {
            const stored = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
            return stored.some(c => (c.partner || '').toLowerCase() === targetLower);
          } catch { return false; }
        })();
        const match = prev.find(c => (c.partner || '').toLowerCase() === targetLower);
        if (match && stillExists) {
          const entry = { ...match, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() };
          clearedPartnersRef.current = { ...clearedPartnersRef.current, [targetUsername]: entry };
          try { localStorage.setItem('chat_cleared_partners', JSON.stringify(clearedPartnersRef.current)); } catch {}
        }
        return updated;
      });
      // Do NOT navigate away — stay in the chat view
    });

    sock.on('room_chat_cleared', ({ roomId }) => {
      const roomLower = (roomId || '').toLowerCase();
      // Same reasoning as the dm_cleared handler above — this is the one
      // place guaranteed to fire regardless of whether the clear was
      // triggered from this widget's own modal or RoomChatPanel's.
      clearRecentMessagesCache('room', roomLower);
      if (activeChatRef.current && activeChatRef.current.type === 'room' &&
          (activeChatRef.current.partner || '').toLowerCase() === roomLower) {
        setMessages([]);
      }
      setConversations(prev => {
        const updated = prev.map(c =>
          (c.type === 'room' && (c.partner || '').toLowerCase() === roomLower)
            ? { ...c, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() }
            : c
        );
        // Guard: only persist to chat_cleared_partners if the chat was NOT explicitly deleted.
        const roomStillExists = (() => {
          try {
            const stored = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
            return stored.some(c => (c.partner || '').toLowerCase() === roomLower || (c.id || '').toLowerCase() === roomLower);
          } catch { return false; }
        })();
        const match = prev.find(c => c.type === 'room' && (c.partner || '').toLowerCase() === roomLower);
        if (match && roomStillExists) {
          const entry = { ...match, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() };
          clearedPartnersRef.current = { ...clearedPartnersRef.current, [roomId]: entry };
          try { localStorage.setItem('chat_cleared_partners', JSON.stringify(clearedPartnersRef.current)); } catch {}
        }
        // Also scrub the stale preview from watch_recent_chats so a page refresh
        // doesn't resurrect old "You: Message sent" text
        try {
          const stored = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
          const cleaned = stored.map(c =>
            (c.type === 'room' && ((c.partner || '').toLowerCase() === roomLower || (c.id || '').toLowerCase() === roomLower))
              ? { ...c, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() }
              : c
          );
          localStorage.setItem('watch_recent_chats', JSON.stringify(cleaned));
        } catch {}
        return updated;
      });
    });

    // ── Admin permanently deleted a room ─────────────────────────────────────
    // Remove the room from this user's conversation list, messages, and all
    // localStorage stores — for every connected user, instantly.
    sock.on('admin_room_deleted', ({ roomId }) => {
      const roomLower = (roomId || '').toLowerCase();

      // Home.jsx's Pinned Rooms / Room History (usePinnedRooms.js /
      // useRoomHistory.js) have no socket of their own and only ever refetch
      // on mount/focus — without this, a deleted room stayed listed there
      // (and, if it happened to be pinned, in the 'pinned_rooms' localStorage
      // list this widget never otherwise touches) until something else
      // happened to trigger a refetch. This widget is the one thing already
      // guaranteed to receive the delete event regardless of which page is
      // open, so it's the natural place to rebroadcast it as a plain DOM
      // event those hooks can listen for with no socket of their own.
      window.dispatchEvent(new CustomEvent('room_deleted', { detail: { roomId } }));

      // If the user is currently viewing this chat, kick them back to the list
      if (activeChatRef.current && activeChatRef.current.type === 'room' &&
          (activeChatRef.current.partner || '').toLowerCase() === roomLower) {
        latestHistoryRequestRef.current++;
        setMessages([]);
        setView('list');
        setActiveChat(null);
      }

      // Remove from conversations state and localStorage
      setConversations(prev => {
        const next = prev.filter(c =>
          !((c.type === 'room') &&
            ((c.partner || '').toLowerCase() === roomLower || (c.id || '').toLowerCase() === roomLower))
        );
        try { localStorage.setItem('watch_recent_chats', JSON.stringify(next)); } catch {}
        return next;
      });

      // Remove from pinned, muted, hidden lists
      setPinnedChats(prev => {
        const next = prev.filter(k => k.toLowerCase() !== roomLower);
        try { localStorage.setItem(`pinned_chats_${myUsername}`, JSON.stringify(next)); } catch {}
        return next;
      });
      setMutedChats(prev => {
        const next = prev.filter(k => k.toLowerCase() !== roomLower);
        try { localStorage.setItem(`muted_chats_${myUsername}`, JSON.stringify(next)); } catch {}
        return next;
      });
      setHiddenChats(prev => {
        const next = prev.filter(k => k.toLowerCase() !== roomLower);
        try { localStorage.setItem(`hidden_chats_${myUsername}`, JSON.stringify(next)); } catch {}
        return next;
      });

      // Purge from cleared-partners tracking
      try {
        const cleared = { ...clearedPartnersRef.current };
        Object.keys(cleared).forEach(k => {
          if (k.toLowerCase() === roomLower) delete cleared[k];
        });
        clearedPartnersRef.current = cleared;
        localStorage.setItem('chat_cleared_partners', JSON.stringify(cleared));
      } catch {}

      // Stop pagination for this room
      delete paginationStateRef.current[roomLower];
    });

    // ── A room's thumbnail changed ───────────────────────────────────────────
    // Same "this widget is the one thing guaranteed to be listening
    // regardless of which page is open" reasoning as admin_room_deleted just
    // above: the server now broadcasts this to every connected client (not
    // just sockets inside that room — see server.js), so any page's cached
    // room list can catch it. Room.jsx already patches its own live `room`
    // state directly (it has the socket event too, filtered to its own
    // roomId); this handler instead covers everything Room.jsx can't reach:
    // this widget's own conversations list, and — via the rebroadcast —
    // Home/Pinned Rooms/Room History/Search history's cached lists.
    sock.on('room_thumbnail_updated', ({ roomId, thumbnailPath }) => {
      const roomLower = (roomId || '').toLowerCase();
      setConversations(prev => {
        let changed = false;
        const next = prev.map(c => {
          if (c.type === 'room' && (c.partner || c.id || '').toLowerCase() === roomLower && c.partnerAvatar !== thumbnailPath) {
            changed = true;
            return { ...c, partnerAvatar: thumbnailPath };
          }
          return c;
        });
        if (changed) { try { localStorage.setItem('watch_recent_chats', JSON.stringify(next)); } catch {} }
        return changed ? next : prev;
      });

      window.dispatchEvent(new CustomEvent('room_thumbnail_updated', { detail: { roomId, thumbnailPath } }));
    });

    // ── Host permanently deleted a room ──────────────────────────────────────
    // Same cleanup as admin_room_deleted but triggered by the room host via socket
    sock.on('room_permanently_deleted', ({ roomId }) => {
      const roomLower = (roomId || '').toLowerCase();

      // See the identical dispatch in admin_room_deleted just above — same
      // reason, same fix, just the host-initiated delete path instead of
      // the admin one.
      window.dispatchEvent(new CustomEvent('room_deleted', { detail: { roomId } }));

      if (activeChatRef.current && activeChatRef.current.type === 'room' &&
          (activeChatRef.current.partner || '').toLowerCase() === roomLower) {
        latestHistoryRequestRef.current++;
        setMessages([]);
        setView('list');
        setActiveChat(null);
      }

      setConversations(prev => {
        const next = prev.filter(c =>
          !((c.type === 'room') &&
            ((c.partner || '').toLowerCase() === roomLower || (c.id || '').toLowerCase() === roomLower))
        );
        try { localStorage.setItem('watch_recent_chats', JSON.stringify(next)); } catch {}
        return next;
      });

      setPinnedChats(prev => {
        const next = prev.filter(k => k.toLowerCase() !== roomLower);
        try { localStorage.setItem(`pinned_chats_${myUsername}`, JSON.stringify(next)); } catch {}
        return next;
      });
      setMutedChats(prev => {
        const next = prev.filter(k => k.toLowerCase() !== roomLower);
        try { localStorage.setItem(`muted_chats_${myUsername}`, JSON.stringify(next)); } catch {}
        return next;
      });
      setHiddenChats(prev => {
        const next = prev.filter(k => k.toLowerCase() !== roomLower);
        try { localStorage.setItem(`hidden_chats_${myUsername}`, JSON.stringify(next)); } catch {}
        return next;
      });

      try {
        const cleared = { ...clearedPartnersRef.current };
        Object.keys(cleared).forEach(k => {
          if (k.toLowerCase() === roomLower) delete cleared[k];
        });
        clearedPartnersRef.current = cleared;
        localStorage.setItem('chat_cleared_partners', JSON.stringify(cleared));
      } catch {}

      delete paginationStateRef.current[roomLower];
    });

    // ── Self destruct event broadcasted when 4 failed PIN attempts occur ──────
    sock.on('self_destruct_executed', () => {
      wipeLockedChatsData(myUsername);
      setMessages([]);
      setView('list');
      setActiveChat(null);
      setConversations([]);
      setLockedChats([]);
      setHiddenChats([]);
      setPinnedChats([]);
      setMutedChats([]);
      setShowLockedChats(false);
      setShowHiddenChats(false);
      toast.error('Security override: Locked chats wiped.', { duration: 5000, icon: '🔥' });
    });
    // ─────────────────────────────────────────────────────────────────────────

    return () => {
      sock.disconnect();
      if (socketRef.current === sock) {
        socketRef.current = null;
        socketTokenRef.current = null;
      }
    };
  }, [token, onNewMessage, isReady]);

  // Persist conversation list to localStorage whenever it changes (enables LIFO across refreshes)
  useEffect(() => {
    try {
      if (Array.isArray(conversations)) {
        if (conversations.length > 0) {
          localStorage.setItem('watch_recent_chats', JSON.stringify(conversations));
        }
        // Sync "blocking me" status for other components (like RoomChatPanel)
        const blockingMeUsers = conversations.filter(c => c.amIBlocked).map(c => c.partner?.toLowerCase()).filter(Boolean);
        localStorage.setItem(`blocking_me_${myUsername}`, JSON.stringify(blockingMeUsers));

        // Sync "I blocked" status — conversations flagged isBlocked came from DB
        // Merge with existing local list to avoid overwriting manual blocks
        const serverBlocked = conversations.filter(c => c.isBlocked).map(c => c.partner?.toLowerCase()).filter(Boolean);
        if (serverBlocked.length > 0) {
          setBlockedChats(prev => {
            const merged = [...new Set([...prev.map(k => k.toLowerCase()), ...serverBlocked])];
            localStorage.setItem(`blocked_chats_${myUsername}`, JSON.stringify(merged));
            return merged;
          });
        }

        // No longer dispatching 'blocked_chats_updated' here to avoid loop with handleSync.
        // setBlockedChats above will trigger local re-renders, and other components 
        // will pick up changes via their own fetch or storage events.
      }
    } catch {}
  }, [conversations, myUsername]);

  useEffect(() => {
    if (isOpen && view === 'list') {
      fetchConversations();
    }
  }, [isOpen, view]);

  // Reset to list view when widget is closed
  useEffect(() => {
    if (!isOpen) {
      handleBackToList();
      setReplyToMsg(null);
      setActiveReactionMsg(null);
      setShowEmojiPicker(false);
      setSearchQuery('');
      setSearchResults([]);
      setLightbox(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!debouncedSearchQuery) {
      setSearchResults([]);
      return;
    }
    fetch(`${API}/api/users/search?q=${debouncedSearchQuery}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if(Array.isArray(d)) setSearchResults(d); else setSearchResults([]); })
      .catch(() => {});
  }, [debouncedSearchQuery, token]);

  // Re-run fetchHistory when keyPair becomes available (fixes race condition where history
  // was fetched before CryptoContext finished loading the key from sessionStorage).
  useEffect(() => {
    if (activeChat && view === 'chat') {
      fetchHistory(activeChat.type, activeChat.partner);
    }
  }, [activeChat, view, keyPair]);

  // Guest Room Messages sync listener
  useEffect(() => {
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (!isGuest || !activeChat || activeChat.type !== 'room') return;

    const rid = (activeChat.partner || activeChat.id || '').toLowerCase();

    const syncMessages = () => {
      try {
        const stored = sessionStorage.getItem(`guest_room_messages_${rid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setMessages(parsed);
          // Update baseline so the global unread listener doesn't re-count messages we're already viewing
          guestLastMsgCountRef.current[rid] = parsed.length;
        }
        const hasMoreStored = sessionStorage.getItem(`guest_room_has_more_${rid}`);
        if (hasMoreStored !== null) {
          if (!paginationStateRef.current[rid]) {
            paginationStateRef.current[rid] = { hasMore: true, isLoading: false };
          }
          paginationStateRef.current[rid].hasMore = hasMoreStored === 'true';
        }
      } catch (e) {
        console.error('Error syncing guest room messages:', e);
      }
    };

    // Sync once initially
    syncMessages();

    // Listen for updates from Room.jsx
    const handler = (e) => {
      if (e.detail?.roomId?.toLowerCase() === rid) {
        syncMessages();
        
        // Scroll restoration is handled synchronously in useLayoutEffect

        // Reset loading flags
        if (paginationStateRef.current[rid]) {
          paginationStateRef.current[rid].isLoading = false;
        }
        setHistoryLoading(false);
      }
    };

    window.addEventListener('guest_room_messages_updated', handler);
    return () => window.removeEventListener('guest_room_messages_updated', handler);
  }, [activeChat, view]);

  // Guest: global unread badge tracking for all room chats
  useEffect(() => {
    if (localStorage.getItem('watch_is_guest') !== 'true') return;
    const handler = (e) => {
      const rid = e.detail?.roomId?.toLowerCase();
      if (!rid) return;
      try {
        const stored = sessionStorage.getItem(`guest_room_messages_${rid}`);
        if (!stored) return;
        const msgs = JSON.parse(stored);
        if (!Array.isArray(msgs)) return;
        const newCount = msgs.length;

        if (guestLastMsgCountRef.current[rid] === undefined) {
          // First event for this room — establish baseline, no badge
          guestLastMsgCountRef.current[rid] = newCount;
          return;
        }

        const prevCount = guestLastMsgCountRef.current[rid];
        const isViewingThis = viewRef.current === 'chat' &&
          activeChatRef.current &&
          ((activeChatRef.current.partner || '').toLowerCase() === rid ||
           (activeChatRef.current.id || '').toLowerCase() === rid);

        if (newCount > prevCount && !isViewingThis) {
          const newFromOthers = msgs.slice(prevCount).filter(m => !m.isMe);
          if (newFromOthers.length > 0) {
            setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
              ((c.partner || '').toLowerCase() === rid || (c.id || '').toLowerCase() === rid)
                ? { ...c, unread: (c.unread || 0) + newFromOthers.length }
                : c
            ));
          }
        }
        guestLastMsgCountRef.current[rid] = newCount;
      } catch {}
    };
    window.addEventListener('guest_room_messages_updated', handler);
    return () => window.removeEventListener('guest_room_messages_updated', handler);
  }, []); // empty deps — reads activeChatRef/viewRef to avoid stale closures

  // Re-run fetchConversations when keyPair loads so list previews show decrypted text
  useEffect(() => {
    if (keyPair && view === 'list') {
      fetchConversations();
    }
  }, [keyPair]);

  // ── Server-sync blockedChats on mount so page refreshes stay correct ──
  // Blocks created via profile page or other sessions are persisted in the DB.
  // On mount we fetch the authoritative list from /api/blocks and merge into local state.
  useEffect(() => {
    if (!token || !myUsername) return;
    fetch(`${API}/api/blocks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data)) return;
        const serverBlocked = data.map(u => (u.username || '').toLowerCase()).filter(Boolean);
        setBlockedChats(serverBlocked);
        localStorage.setItem(`blocked_chats_${myUsername}`, JSON.stringify(serverBlocked));
        window.dispatchEvent(new Event('blocked_chats_updated'));
      })
      .catch(() => {});
  }, [token, myUsername]);

  useLayoutEffect(() => {
    // Older-history prepends grow messages.length too, but must NOT jump the
    // view to the bottom — the scrollAnchorRef effect above already restored
    // the correct scroll position for those. Only auto-scroll-to-bottom for
    // genuinely new (appended) messages or the initial chat open.
    if (isPrependingHistoryRef.current) {
      isPrependingHistoryRef.current = false;
      prevMsgCountRef.current = messages.length;
      return;
    }

    const isChatView = view === 'chat' && activeChat;
    const shouldScroll = (messages.length > prevMsgCountRef.current) || (isChatView && isFirstRenderGlobalChat.current);
    if (isChatView) {
      isFirstRenderGlobalChat.current = false;
    } else {
      isFirstRenderGlobalChat.current = true;
    }

    // Direct scrollTop assignment on the message container itself, not
    // messagesEndRef.current.scrollIntoView() — scrollIntoView with no
    // `block` override defaults to 'start', which (per spec) walks and
    // realigns EVERY scrollable ancestor of the target, not just this one
    // container. For a sentinel at the very end of a long list that
    // typically clamps to the same visual result as scrolling this
    // container to its bottom, but it can also nudge an outer ancestor's
    // scroll position along the way — which on first opening a chat is
    // what read as the message landing stranded near the top instead of
    // sitting right above the composer. RoomChatPanel's identical initial-
    // scroll effect already uses this same direct-scrollTop approach for
    // the same reason; this brings GlobalChatWidget in line with it.
    if (shouldScroll && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
      setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; }, 50);
      setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight; }, 150);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, view, activeChat]);

  // Autofocus input when opening a chat, replying, or editing — for edit, also
  // place the cursor at the end of the pre-filled text rather than leaving the
  // user to click into the box themselves.
  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        if (editingMsg) {
          const len = el.value.length;
          el.setSelectionRange?.(len, len);
        }
      }, 50);
    }
  }, [view, activeChat, replyToMsg, editingMsg]);

  const fetchConversations = async () => {
    if (!token) return true; // nothing to do — not a failure

    // Only show blocking loader if we have no cached data at all
    const cached = localStorage.getItem('watch_recent_chats');
    let localRooms = [];
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localRooms = parsed.filter(c => c.type === 'room').map(c => c.id || c.partner);
        }
      } catch {}
    }
    if (!cached || JSON.parse(cached).length === 0) {
      setLoading(true);
    }
    
    try {
      const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
      const param = encodeURIComponent(JSON.stringify(lastSeen));
      const roomsParam = encodeURIComponent(JSON.stringify(localRooms));
      const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}&localRooms=${roomsParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const rawFetched = Array.isArray(data) ? data : [];
      
      const fetched = rawFetched.filter(c => {
        if (c.isDeleted && c.type === 'room') {
          const roomLower = (c.id || c.partner || '').toLowerCase();
          
          setConversations(prev => {
            const next = (Array.isArray(prev) ? prev : []).filter(item =>
              !((item.type === 'room') &&
                ((item.partner || '').toLowerCase() === roomLower || (item.id || '').toLowerCase() === roomLower))
            );
            try { localStorage.setItem('watch_recent_chats', JSON.stringify(next)); } catch {}
            return next;
          });

          setPinnedChats(prev => {
            const next = prev.filter(k => k.toLowerCase() !== roomLower);
            try { localStorage.setItem(`pinned_chats_${myUsername}`, JSON.stringify(next)); } catch {}
            return next;
          });
          setMutedChats(prev => {
            const next = prev.filter(k => k.toLowerCase() !== roomLower);
            try { localStorage.setItem(`muted_chats_${myUsername}`, JSON.stringify(next)); } catch {}
            return next;
          });
          setHiddenChats(prev => {
            const next = prev.filter(k => k.toLowerCase() !== roomLower);
            try { localStorage.setItem(`hidden_chats_${myUsername}`, JSON.stringify(next)); } catch {}
            return next;
          });

          try {
            const cleared = { ...clearedPartnersRef.current };
            Object.keys(cleared).forEach(k => {
              if (k.toLowerCase() === roomLower) delete cleared[k];
            });
            clearedPartnersRef.current = cleared;
            localStorage.setItem('chat_cleared_partners', JSON.stringify(cleared));
          } catch {}

          delete paginationStateRef.current[roomLower];

          if (activeChatRef.current && activeChatRef.current.type === 'room' &&
              (activeChatRef.current.partner || '').toLowerCase() === roomLower) {
            latestHistoryRequestRef.current++;
            setMessages([]);
            setView('list');
            setActiveChat(null);
          }

          return false;
        }
        return true;
      });
      const kp = keyPairRef.current;

      const decryptedFetched = fetched.map(c => {
         if (c.type === 'private' && c.nonce) {
            if (!kp) return { ...c, decryptedText: null }; 
            let plainText = null;
            if (c.isMyLastMessage) {
               if (c.senderMessage) {
                  plainText = decryptDMSenderCopy(c.senderMessage, c.nonce, c.ephemeralPublicKey, encodeBase64(kp.secretKey));
               }
            } else {
               const senderPK = c.ephemeralPublicKey || c.partnerPublicKey || null;
               if (senderPK && c.message) {
                  plainText = decryptDM(c.message, c.nonce, senderPK, encodeBase64(kp.secretKey));
               }
            }
            // For private media: attach lastMediaType so list can show "Photo"/"Video" regardless of decryption status
            const _pmt = c.mediaType || c.lastMediaType;
            const privateMeta = _pmt ? { lastMediaType: _pmt, message: _pmt.startsWith('video') ? 'Video' : _pmt.startsWith('image') ? 'Photo' : _pmt.startsWith('audio') ? 'Voice Note' : 'File' } : {};
            // Also normalize message to decrypted text for non-media so localStorage never stores ciphertext
            const msgNormalize = (!(_pmt) && plainText) ? { message: plainText } : {};
            return { ...c, ...privateMeta, ...msgNormalize, decryptedText: plainText };
          } else if (c.type === 'room') {
            // The mandatory SahaPlay announcements group is intentionally
            // unencrypted (see isSahaplayOfficialGroup) — its preview text is
            // already plain, never ciphertext, so skip decryption entirely.
            if (isSahaplayOfficialGroup(c)) return { ...c, decryptedText: c.message };
            // Always attach lastMediaType for room media so the list renderer never shows ciphertext
            const _rmt = c.mediaType || c.lastMediaType;
            const mediaMeta = _rmt ? { lastMediaType: _rmt, message: _rmt.startsWith('video') ? 'Video' : _rmt.startsWith('image') ? 'Photo' : _rmt.startsWith('audio') ? 'Voice Note' : 'File' } : {};
            if (c.e2ee && (c.e2ee.nonce || c.nonce)) {
              if (!kp) return { ...c, ...mediaMeta, decryptedText: null };
              try {
                const myLower = myUsername?.toLowerCase();
                const myEncKey = c.e2ee.keys?.[myLower] || Object.entries(c.e2ee.keys || {}).find(([k]) => k.toLowerCase() === myLower)?.[1];
                if (myEncKey && c.e2ee.senderPublicKey) {
                  const senderPubKey = decodeBase64(c.e2ee.senderPublicKey);
                  const msgNonce = c.e2ee.nonce || c.nonce;
                  const plain = decryptGroupMessage(c.message, msgNonce, myEncKey, senderPubKey, kp.secretKey);
                  if (plain !== null) {
                    if (c.mediaType) {
                      const mediaLabel = c.mediaType.startsWith('video') ? 'Video' : c.mediaType.startsWith('image') ? 'Photo' : c.mediaType.startsWith('audio') ? 'Voice Note' : 'File';
                      // Normalize message to readable label so localStorage never stores ciphertext
                      return { ...c, ...mediaMeta, message: mediaLabel, decryptedText: mediaLabel };
                    }
                    // Normalize message to plain text so localStorage stores readable preview
                    return { ...c, ...mediaMeta, message: plain, decryptedText: plain };
                  }
                }
              } catch(e) {}
              return { ...c, ...mediaMeta, decryptedText: null };
            }
            // Legacy conversation preview (predates client-side group E2EE) — media
            // still renders via mediaMeta; legacy text gets the placeholder instead.
            if (!c.message || !c.lastTimestamp || Number(c.lastTimestamp) === 0) {
              return { ...c, message: 'Start a conversation', decryptedText: 'Start a conversation' };
            }
            if (Object.keys(mediaMeta).length > 0) return { ...c, ...mediaMeta };
            return { ...c, message: 'Start a conversation', decryptedText: 'Start a conversation' };
          }
          return c;
       });
      
      // Merge: preserve dynamically-added real-time conversations not returned by server
      setConversations(prev => {
        // Build a lowercase set so username casing differences (e.g. "Krishna" vs "krishna")
        // don't cause local conversations to be treated as missing from the server response.
        const fetchedPartners = new Set(decryptedFetched.map(c => (c.partner || '').toLowerCase()));
        // Keep conversations (private AND room) that server didn't return this cycle.
        // NOTE: The server only returns rooms where the user *sent* a message (SQL query uses
        // senderName filter). Rooms where the user only received messages won't appear in the
        // server response — DO NOT zero them out. Only zero a room if it was explicitly cleared
        // (local state already has lastTimestamp:0 from the room_chat_cleared socket event,
        // or it's recorded in clearedRoomsMap).
        const clearedRoomsMapForPreserved = (() => {
          try {
            const ref = clearedPartnersRef.current;
            if (typeof ref === 'function') return JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
            return (typeof ref === 'object' && ref !== null) ? ref : {};
          } catch { return {}; }
        })();
        const preserved = (Array.isArray(prev) ? prev : [])
          .filter(c => !fetchedPartners.has((c.partner || '').toLowerCase()))
          .map(c => {
            if (c.type === 'room') {
              // Only zero out if there are genuinely no new messages (timestamp stayed at 0 from the clear).
              // If handleNewMsg has updated the timestamp with a new message, preserve that preview.
              const isExplicitlyCleared = !c.lastTimestamp || c.lastTimestamp === 0;
              if (isExplicitlyCleared) {
                return { ...c, message: '', decryptedText: '', lastTimestamp: 0, lastMediaType: null, lastMediaDuration: null };
              }
            }
            return c;
          });
        // Merge cleared-partner extras
        const extrasMap = clearedPartnersRef.current || {};
        const extras = Object.values(extrasMap).filter(c => !fetchedPartners.has((c.partner || '').toLowerCase()) && !preserved.find(p => (p.partner || '').toLowerCase() === (c.partner || '').toLowerCase()));

        // Load cleared rooms directly from localStorage (bypass ref timing issues)
        const clearedRoomsMap = (() => {
          try {
            const ref = clearedPartnersRef.current;
            // If ref is still a function (useRef lazy-init race), fall back to localStorage
            if (typeof ref === 'function') return JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
            return (typeof ref === 'object' && ref !== null) ? ref : {};
          } catch { return {}; }
        })();
        // Case-insensitive lookup: private-chat clear entries are keyed by the partner's
        // raw-case username (from the dm_cleared socket payload), which may not match the
        // server's row.partner.toLowerCase() id used as chatKey below.
        const clearedRoomsMapLower = {};
        for (const k in clearedRoomsMap) clearedRoomsMapLower[k.toLowerCase()] = clearedRoomsMap[k];

        const finalFetched = decryptedFetched.map(c => {
          const chatKey = c.id || c.partner;
          const finalC = { ...c, targetId: c.partnerId || c.targetId };

          // CLEARED CHAT OVERRIDE: zero out if no new messages arrived after the clear.
          // Compare server's lastTimestamp against the moment the user cleared the chat.
          // Only show the preview if a truly NEW message (sent after the clear) exists.
          // Applies to private chats too, not just rooms — otherwise a cleared DM's real
          // last message (still in the DB) resurfaces the next time this list is fetched
          // (e.g. reopening the widget), even though the chat was just cleared.
          const clearedEntry = clearedRoomsMapLower[String(chatKey).toLowerCase()];
          if (clearedEntry) {
            const clearTs = clearedEntry?.clearedAt || 0;
            const serverTs = Number(finalC.lastTimestamp) || 0;
            if (!serverTs || (clearTs && serverTs <= clearTs)) {
              // Carry clearedAt forward so getSortTime keeps this chat at its cleared position
              return { ...finalC, message: '', decryptedText: '', lastTimestamp: 0, lastMediaType: null, lastMediaDuration: null, unread: 0, clearedAt: clearTs };
            }
          }
          
          // Bug 5 fix: Keep real-time local state if it's newer than the cached server response.
          // Merge strategy: server data (finalC) is authoritative for structure/unread.
          // Local state (existing) is authoritative for decrypted preview text and media labels
          // when both refer to the same message (same or close timestamp).
          const existing = Array.isArray(prev) ? prev.find(p => {
            // Case-insensitive partner match so username casing differences don't create duplicates
            const pKey = ((p.id || p.partner) || '').toLowerCase();
            return pKey === chatKey.toLowerCase();
          }) : null;

          const existingTs = Number(existing?.lastTimestamp) || 0;
          const serverTs   = Number(c.lastTimestamp) || 0;

          // "Local ahead of server" normally means an optimistic update (our own
          // send, or a real-time received message) that this fetch raced and the
          // DB write hasn't caught up to yet — trust local in that case. The one
          // case this must NOT apply is a local entry that's stale because the
          // message it was tracking got unsent/deleted — handleRemoteDelete
          // (above) zeroes lastTimestamp the instant that happens specifically so
          // existingTs can never win here once that's happened, without needing
          // this merge to guess at intent from timing alone.
          if (existing && existingTs > serverTs) {
            // Local state is ahead of server (e.g. optimistic update not yet flushed to DB).
            // Keep local structure, but apply any fresher decryptedText from the server fetch.
            const betterDecryptedText = finalC.decryptedText || existing.decryptedText;
            return { ...existing, targetId: finalC.targetId, decryptedText: betterDecryptedText };
          }

          // Server timestamp is equal-or-newer. Use server data as base but rescue any good
          // local decryption / media label that the server response can't provide.
          //
          // mediaType/Duration: fall back to local state ONLY when server and local are
          // describing the SAME message (equal timestamp) — e.g. legacy rows where mediaType
          // was never stored server-side but a real-time socket update already had it.
          // A genuinely newer message (serverTs > existingTs) must NOT fall back: a plain-text
          // message (a call-log bubble, a normal chat message) legitimately has no mediaType at
          // all, and resurrecting the OLD cached mediaType here previously made a brand-new
          // call-log/text message render as whatever media type the PREVIOUS message happened
          // to be (e.g. a call showing up as "Photo" because the prior message was an image).
          const sameMsgAsLocal = existingTs > 0 && serverTs === existingTs;
          const betterMediaType     = finalC.lastMediaType || (sameMsgAsLocal ? existing?.lastMediaType : null) || null;
          const betterMediaFileName = finalC.lastMediaFileName || (sameMsgAsLocal ? existing?.lastMediaFileName : null) || null;
          const betterMediaDuration = finalC.lastMediaDuration || (sameMsgAsLocal ? existing?.lastMediaDuration : null) || null;

          // betterDecryptedText: server wins if available, then local (regardless of timestamp).
          const betterDecryptedText = finalC.decryptedText || existing?.decryptedText || null;

          // betterMessage: recompute from mediaType when possible so we never show raw filenames
          // or ciphertext stored in the message column for legacy/encrypted uploads.
          // For text messages (no mediaType) fall back to server message then local.
          const _computedLabel = betterMediaType
            ? (betterMediaType.startsWith('video') ? 'Video'
               : betterMediaType.startsWith('image') ? 'Photo'
               : betterMediaType.startsWith('audio') ? 'Voice Note'
               : 'File')
            : null;
          const betterMessage = _computedLabel
            || finalC.message
            || (existingTs === serverTs ? existing?.message : null)
            || '';

          // Preserve clearedAt from local state so getSortTime keeps a cleared chat at the
          // correct sort position even after a server fetch overwrites lastTimestamp.
          // Only carry it forward when no genuinely newer message arrived after the clear.
          const localClearedAt = Number(existing?.clearedAt) || 0;
          const keepClearedAt = localClearedAt > 0 && serverTs <= localClearedAt;

          // finalC.unread (the server's own count) is trusted by default — it already
          // factors in the very same lastSeen this request just sent. The one exception:
          // if OUR OWN lastSeen cutoff for this chat is at or after this row's own
          // lastTimestamp, no message in it can possibly be unread, full stop — that's
          // true by definition regardless of what finalC.unread says. This matters right
          // after the user actually reads a chat: markChatAsRead's chat:mark_read socket
          // emit updates the server's persisted lastSeen asynchronously (a DB write), and
          // this same widget refetches on every socket reconnect (a network blip, or
          // several other everyday triggers already elsewhere in this file) — if that
          // refetch's GET request lands before the mark-read write has committed, the
          // server would truthfully report its own not-yet-updated count, which used to
          // flash the badge back on right after reading it.
          //
          // A prior version of this check instead asked "does *any* lastSeen exist here,
          // and does the locally cached copy already read 0" — which is also true, for a
          // totally different and far more common reason, the very first time this chat's
          // row is fetched after the app was fully closed and a message arrived while it
          // was: the cached copy is correctly still 0 from before, and lastSeen is simply
          // whenever this chat was last read, ordinarily and unrelated to the new message.
          // That version couldn't tell the two apart and force-zeroed both, which is what
          // made every row in the list show no badge after a cold start. Comparing actual
          // timestamps instead of presence/cached-value tells them apart directly: only
          // the first case has seenTs sitting at or after this row's own lastTimestamp.
          const seenTs = lastSeen[chatKey] || lastSeen[chatKey.toLowerCase()] || 0;
          const definitelyRead = seenTs > 0 && serverTs > 0 && seenTs >= serverTs;

          return {
            ...finalC,
            decryptedText: betterDecryptedText,
            lastMediaType: betterMediaType,
            lastMediaFileName: betterMediaFileName,
            lastMediaDuration: betterMediaDuration,
            message: betterMessage,
            ...(keepClearedAt ? { clearedAt: localClearedAt } : {}),
            ...(definitelyRead ? { unread: 0 } : {}),
          };
        });

        const all = [...finalFetched, ...preserved, ...extras];

        // FORCE LIFO SORT: Newest activity first
        return all.sort((a,b) => getSortTime(b) - getSortTime(a));
      });
      return true;
    } catch(e) {
      console.error(e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // fetchConversations already catches its own errors internally (so other
  // fire-and-forget callers never see a rejection) and now reports success via
  // its return value instead. Retries on that signal rather than a thrown
  // error, since nothing here ever actually throws.
  const fetchConversationsWithRetry = async (retries = 3, delayMs = 1000) => {
    for (let i = 0; i < retries; i++) {
      const ok = await fetchConversations();
      if (ok) return;
      console.warn(`[GlobalChat] fetchConversations attempt ${i + 1} failed`);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
    console.error('[GlobalChat] fetchConversations failed after all retries — conversations may be stale until next reconnect');
  };

  // Auto-track rooms whenever conversation list changes to ensure we get typing/messages for all active chats
  const activeRoomIdsStr = Array.isArray(conversations) 
    ? conversations.filter(c => c.type === 'room').map(c => (c.id || c.partner)?.toLowerCase()).sort().join(',') 
    : '';

  useEffect(() => {
    if (socketRef.current && Array.isArray(conversations)) {
      const roomIds = conversations.filter(c => c.type === 'room').map(c => (c.id || c.partner)?.toLowerCase());
      if (roomIds.length > 0) {
        socketRef.current.emit('track_rooms', { roomIds });
      }
    }
  }, [activeRoomIdsStr]);


  const latestHistoryRequestRef = useRef(0);
  
  const decryptGlobalChatMessages = async (fetched, type, partner) => {
    const kp = keyPairRef.current;
    const decrypted = await Promise.all(fetched.map(async (m) => {
      const mUserLower = myUsername?.toLowerCase();
      const msgIsMe = m.isMe || (m.senderName && m.senderName.toLowerCase() === mUserLower) || (m.username && m.username.toLowerCase() === mUserLower);

      if (!m.nonce) {
        // The mandatory SahaPlay announcements group is intentionally
        // unencrypted (see isSahaplayOfficialGroup) — never route it through
        // the legacy-ciphertext placeholder, its text is already plain.
        if (isSahaplayOfficialGroup(partner)) return { ...m, decryptedText: m.message || '' };
        // Legacy group message (predates client-side group E2EE) — DM's own legacy
        // path (pre-DM-E2EE messages, if any) is untouched below, unchanged.
        const isGroupMsgLegacy = m.type === 'group' || m.type === 'room' || type === 'room';
        if (isGroupMsgLegacy) return { ...m, decryptedText: m.mediaUrl ? '' : LEGACY_GROUP_TEXT_PLACEHOLDER };
        return { ...m, decryptedText: m.message || '' };
      }
      if (!kp) return { ...m, decryptedText: null, mediaUrl: null }; 
      const msgKey = String(m.id || m.timestamp);
      let decryptedText = null;
      let decryptedMediaUrl = m.mediaUrl;
      try {
        const isPrivateDM = m.type === 'private' || type === 'private';
        const isGroupMsg  = m.type === 'group' || m.type === 'room' || type === 'room';
        if (isPrivateDM) {
          if (msgIsMe) {
            if (m.senderMessage) {
              const plainText = decryptDMSenderCopy(m.senderMessage, m.nonce, m.ephemeralPublicKey, encodeBase64(kp.secretKey));
              if (plainText) {
                if (m.mediaType && m.mediaUrl) {
                  try {
                    const { mediaKeyB64, caption } = unpackMediaKeyAndCaption(plainText);
                    decryptedText = caption;
                    // decryptedMediaUrl stays m.mediaUrl (its initial value) — the real,
                    // permanent file URL — not the blob: object URL. Rendering reads the
                    // decrypted blob from decryptedMediaUrls above; mediaUrl must stay
                    // forwardable/fetchable by anyone, not just this tab.
                    const targetMediaUrl = m.mediaUrl;
                    const targetMediaType = m.mediaType;
                    // Fetch+decrypt in the background instead of awaiting inline — this
                    // whole function runs inside a Promise.all over the entire history
                    // batch, so awaiting a full video download (up to 50MB) here held up
                    // EVERY message in the batch from appearing until it finished, or
                    // forever if the fetch never settled on a bad connection. Matches
                    // the real-time (non-history) decrypt path above, which already does
                    // this correctly.
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(mediaKeyB64);
                        const resolvedUrl = resolveMediaUrl(targetMediaUrl, API);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                        decryptedMediaUrls.current[msgKey] = objectUrl;
                        setMediaUrlVersion(v => v + 1);
                      } catch(e) { console.warn('[E2EE] History media decrypt (sender) failed:', e); }
                    })();
                  } catch(e) { console.warn('[E2EE] History media key unpack (sender) failed:', e); }
                } else { decryptedText = plainText; }
              }
            }
          } else {
            const senderPK = m.ephemeralPublicKey || m.senderPublicKey || null;
            if (senderPK) {
              if (m.mediaType && m.mediaUrl) {
                const decryptedPayload = decryptDM(m.message, m.nonce, senderPK, encodeBase64(kp.secretKey));
                const { mediaKeyB64, caption } = unpackMediaKeyAndCaption(decryptedPayload);
                if (mediaKeyB64) {
                  // decryptedMediaUrl stays m.mediaUrl — see sender-copy branch above.
                  decryptedText = caption;
                  const targetMediaUrl = m.mediaUrl;
                  const targetMediaType = m.mediaType;
                  // Background fetch+decrypt — see the comment on the sender-copy branch above.
                  (async () => {
                    try {
                      const mediaKeyBytes = robustDecode(mediaKeyB64);
                      const resolvedUrl = resolveMediaUrl(targetMediaUrl, API);
                      const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                      const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                      const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                      decryptedMediaUrls.current[msgKey] = objectUrl;
                      setMediaUrlVersion(v => v + 1);
                    } catch(e) { console.warn('[E2EE] History media decrypt (recipient) failed:', e); }
                  })();
                }
              } else if (m.message && m.message !== '') {
                decryptedText = decryptDM(m.message, m.nonce, senderPK, encodeBase64(kp.secretKey));
              }
            }
          }
        } else if (isGroupMsg) {
          const e2eeData = m.e2ee;
          if (e2eeData && e2eeData.keys && e2eeData.senderPublicKey) {
            const senderPK = decodeBase64(e2eeData.senderPublicKey);
            const userKeyWrap = e2eeData.keys[myUsername?.toLowerCase()];
            if (userKeyWrap) {
              if (m.mediaType && m.mediaUrl) {
                const decryptedPayload = decryptGroupMessage(m.message, m.nonce, userKeyWrap, senderPK, kp.secretKey);
                const { mediaKeyB64, caption } = unpackMediaKeyAndCaption(decryptedPayload);
                if (mediaKeyB64) {
                  // decryptedMediaUrl stays m.mediaUrl — see DM branches above.
                  decryptedText = caption;
                  const targetMediaUrl = m.mediaUrl;
                  const targetMediaType = m.mediaType;
                  // Background fetch+decrypt — see the comment on the DM sender-copy branch above.
                  (async () => {
                    try {
                      const mediaKeyBytes = robustDecode(mediaKeyB64);
                      const resolvedUrl = resolveMediaUrl(targetMediaUrl, API);
                      const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                      const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                      const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                      decryptedMediaUrls.current[msgKey] = objectUrl;
                      setMediaUrlVersion(v => v + 1);
                    } catch(e) { console.warn('[E2EE] Group history media decrypt failed:', e); }
                  })();
                }
              } else if (m.message && m.message !== '') {
                // A message that was edited but still fails to decrypt is most likely one of
                // the rows corrupted by the pre-fix editGroupMessage bug — say so distinctly
                // instead of falling through to the generic "Encrypted message" fallback.
                decryptedText = decryptGroupMessage(m.message, m.nonce, userKeyWrap, senderPK, kp.secretKey) ?? (m.edited ? CORRUPTED_EDIT_PLACEHOLDER : null);
              }
            }
          }
        }
      } catch (e) { console.warn('[E2EE] History decryption error:', e); }
      return { ...m, decryptedText, mediaUrl: decryptedMediaUrl };
    }));
    return decrypted;
  };

  const fetchHistory = async (type, partner) => {
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (isGuest) return; // Guest history is managed via window events from Room.jsx
    if (!token) return;
    const requestId = ++latestHistoryRequestRef.current;
    
    // Normalize partner to lowercase for consistent lookup
    const cleanPartner = partner ? partner.toLowerCase() : '';
    
    // Only block UI if we don't have any messages yet
    setLoading(messages.length === 0);
    try {
      const res = await fetch(`${API}/api/chats/history?type=${type}&partner=${cleanPartner}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const fetched = Array.isArray(data) ? data : [];

      const decrypted = await decryptGlobalChatMessages(fetched, type, cleanPartner);

      if (requestId !== latestHistoryRequestRef.current) return;
      
      // Replace messages atomically — no merge needed since we cleared before fetching
      const resolved = resolveReplyMessages(decrypted);
      setMessages(resolved);
      // Refresh the instant-open cache with this thread's real tail so the
      // NEXT open/reopen of this exact chat flashes accurate, current
      // messages instead of whatever was cached before.
      //
      // Guarded on keyPairRef.current: decryptGlobalChatMessages bails out
      // per-message to { decryptedText: null } for every E2EE message
      // whenever the key isn't loaded yet (see its own `if (!kp) return`
      // branch) — this genuinely happens on a chat opened in the first
      // instant after app start, before CryptoContext finishes restoring
      // the key. Caching that batch would have overwritten a perfectly
      // good previous snapshot with an all-blank one, so the NEXT reopen's
      // "instant flash" would show nothing (or get skipped as empty by
      // getRecentMessagesCache) even though a real successful load had
      // already happened earlier — exactly the "sometimes it flashes,
      // usually it doesn't" pattern this was reported as.
      if (keyPairRef.current) {
        setRecentMessagesCache(type === 'room' ? 'room' : 'private', cleanPartner, resolved);
      }

      // Sync the sidebar preview with the latest message from history — the
      // just-loaded thread is unambiguously correct, so use it to override
      // whatever the conversation list's real-time/fetch-merge heuristics
      // landed on. Originally room-only ("fixes rooms that show 'Start a
      // conversation' because fetchConversations didn't find them"), but
      // private DMs need the exact same correction: two messages received in
      // quick succession could each update the list via their own socket
      // event, and if the connection has any hiccup that drops or reorders
      // one of those, the list gets stuck on an earlier message with nothing
      // to naturally correct it. Opening the chat always re-derives the truth.
      if (decrypted.length > 0 && (type === 'room' || type === 'private')) {
        const latestMsg = decrypted[decrypted.length - 1];
        const latestTs = Number(latestMsg.timestamp) || 0;
        const _mtype = latestMsg.mediaType || '';
        const latestPreview = _mtype
          ? (_mtype.startsWith('video') ? 'Video' : _mtype.startsWith('image') ? 'Photo' : _mtype.startsWith('audio') ? 'Voice Note' : 'File')
          : (latestMsg.decryptedText || 'Message');
        setConversations(prev => (Array.isArray(prev) ? prev : []).map(c => {
          if ((c.partner || c.id || '').toLowerCase() !== cleanPartner) return c;
          if (Number(c.lastTimestamp) >= latestTs) return c; // already up to date
          return {
            ...c,
            lastTimestamp: latestTs,
            message: latestPreview,
            decryptedText: latestPreview,
            lastSenderName: latestMsg.senderName || latestMsg.username || c.lastSenderName,
            isMyLastMessage: (latestMsg.senderName || latestMsg.username || '').toLowerCase() === (myUsername || '').toLowerCase(),
            lastMediaType: latestMsg.mediaType || null,
            lastMediaDuration: latestMsg.mediaDuration || null,
          };
        }));
      }
    } catch(e) {
      if (requestId === latestHistoryRequestRef.current) console.error(e);
    } finally {
      if (requestId === latestHistoryRequestRef.current) {
        setLoading(false);
        setHistoryLoading(false);
      }
    }
  };

  const loadMoreHistory = async (scrollEl) => {
    if (!activeChat) return;
    const type = activeChat.type;
    const partner = activeChat.partner || activeChat.id;
    const chatKey = partner.toLowerCase();

    if (!paginationStateRef.current[chatKey]) {
      paginationStateRef.current[chatKey] = {
        hasMore: true,
        isLoading: false
      };
    }

    const state = paginationStateRef.current[chatKey];
    
    if (state.isLoading || !state.hasMore) return;
    if (messages.length === 0) return;

    const oldestMsg = messages[0];
    const cursor = oldestMsg.timestamp;

    state.isLoading = true;
    setHistoryLoading(true);

    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;
    scrollAnchorRef.current = { prevScrollHeight, prevScrollTop };

    const limit = 100;

    const isGuest = localStorage.getItem('watch_is_guest') === 'true';

    if (!isGuest && token) {
      try {
        const cleanPartner = partner.toLowerCase();
        const res = await fetch(`${API}/api/chats/history?type=${type}&partner=${cleanPartner}&before=${cursor}&limit=${limit}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          state.isLoading = false;
          setHistoryLoading(false);
          return;
        }
        const data = await res.json();
        const fetched = Array.isArray(data) ? data : [];

        if (fetched.length === 0) {
          state.hasMore = false;
          state.isLoading = false;
          setHistoryLoading(false);
          return;
        }

        const processed = await decryptGlobalChatMessages(fetched, type, cleanPartner);

        isPrependingHistoryRef.current = true;
        setMessages(prev => {
          return mergeHistoryBatch(prev, processed);
        });

        if (fetched.length < limit) {
          state.hasMore = false;
        }

      } catch (err) {
        console.error('[loadMoreHistory] Error:', err);
      } finally {
        state.isLoading = false;
        setHistoryLoading(false);
      }
    } else if (isGuest) {

      isPrependingHistoryRef.current = true;
      window.dispatchEvent(new CustomEvent('guest_request_more_history', {
        detail: {
          roomId: partner,
          cursor,
          limit
        }
      }));
    } else {
      state.isLoading = false;
      setHistoryLoading(false);
    }
  };

  const openChat = async (chat) => {
    // ── Chat Lock gate ──
    const chatKey = (chat.id || chat.partner || '').toLowerCase();
    const isLocked = lockedChats.includes(chatKey) || lockedChats.includes(chat.id || chat.partner);
    const vaultUnlocked = !!unlockedSessionsRef.current['vault'];
    const alreadyUnlocked = !!unlockedSessionsRef.current[chatKey] || (showLockedChats && vaultUnlocked) || vaultUnlocked;
    if (isLocked && !alreadyUnlocked && chatLockEnabled) {
      setPendingLockedChat(chat);
      setShowLockScreen(true);
      return;
    }
    await doOpenChat(chat);
  };

  const doOpenChat = async (chat) => {
    // Ensure we have the correct identifier for history
    const targetPartner = chat.id || chat.partner;
    // Resets the server-side pending-notification aggregation for this chat
    // (see backend/server.js's notifyChatMessage) so the next burst of
    // messages starts a fresh count instead of continuing a stale one.
    // Harmless no-op for guests/web — only matters for the native push path.
    if (token && targetPartner) {
      fetch(`${API}/api/push/chat-opened`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId: targetPartner }),
      }).catch(() => {});
    }
    setReactionPreviewOverrides(prev => {
      const key = (targetPartner || '').toLowerCase();
      if (!(key in prev)) return prev;
      const next = { ...prev }; delete next[key]; return next;
    });
    clearPersistedReactionPreview((targetPartner || '').toLowerCase());

    // For room chats, attach permissions from the conversations list so the input UI can enforce them.
    // Also backfills displayName (and partnerAvatar) when the caller didn't
    // supply one — a notification-triggered open (see pendingOpenChat below)
    // only knows the raw chatId/type, not a proper name, which otherwise
    // left the header blank until the panel was closed and reopened from
    // the conversations list (which DOES carry displayName already).
    let chatPerms = chat.permissions || null;
    let chatIsHost = chat.isHost || false;
    let chatDisplayName = chat.displayName || null;
    let chatPartnerAvatar = chat.partnerAvatar || null;
    const existingConvo = Array.isArray(conversations)
      ? conversations.find(c => c.id === targetPartner || c.partner === targetPartner)
      : null;
    if (existingConvo) {
      chatDisplayName = chatDisplayName || existingConvo.displayName || null;
      chatPartnerAvatar = chatPartnerAvatar || existingConvo.partnerAvatar || null;
    }
    if (chat.type === 'room') {
      if (existingConvo) {
        chatPerms = existingConvo.permissions || chatPerms || null;
        chatIsHost = existingConvo.isHost || chatIsHost || false;
      }
      // Last resort so the header is never blank, even if this room hasn't
      // shown up in the conversations list yet. Private chats get the
      // equivalent fallback further below once /api/users/:partner resolves.
      chatDisplayName = chatDisplayName || targetPartner;
    }

    const chatToOpen = { ...chat, partner: targetPartner, permissions: chatPerms, isHost: chatIsHost, displayName: chatDisplayName, partnerAvatar: chatPartnerAvatar };
    
    const chatKey = (chat.id || chat.partner || '').toLowerCase();
    clearTimeout(perChatTimersRef.current[chatKey]);
    setActiveChat(chatToOpen);
    setView('chat');
    setActiveRelation(null); // Reset
    // The composer's own popovers (attach menu, emoji picker, poll composer)
    // belong to whichever chat was open when they were opened. Resetting
    // this on every doOpenChat call (not e.g. an effect keyed on the
    // partner id) matters specifically for reopening the SAME chat — going
    // back to the list and tapping the same conversation again (or a
    // notification landing on the chat that's already active) doesn't
    // change activeChat.partner at all, so a dependency-based reset would
    // never fire even though the panel was, from the user's point of view,
    // closed and reopened.
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setShowPollComposer(false);
    setEditingPollMsg(null);
    // If this chat's messages are already sitting in memory from the
    // previous time it was open (this widget instance never unmounted —
    // going "back to list" only changes `view`, it doesn't clear
    // `messages`), that in-memory copy is always at least as complete as
    // anything in the localStorage flash-cache below (which only ever keeps
    // the last 50, and can lag behind live socket messages received while
    // browsing other chats). Overwriting it with the cache on every reopen
    // was actively making things WORSE for the single most common case —
    // close a chat, reopen the same one seconds later — regressing however
    // much you'd scrolled/paginated back down to just the cached tail, and
    // relying on localStorage read reliability for a case that never needed
    // to leave memory at all. Only fall back to the cache when there's
    // nothing already loaded for this exact chat.
    const prevKey = (activeChatRef.current?.id || activeChatRef.current?.partner || '').toLowerCase();
    const alreadyLoaded = prevKey === chatKey && messages.length > 0;
    // Instead of blanking the panel on every open (including reopening the
    // SAME chat seconds later — e.g. tap a sender's avatar to view their
    // profile, then go back), flash the last few already-decrypted messages
    // from this chat's last successful load. It's replaced the moment the
    // real fetch below resolves, so a reopen now reads as instant instead
    // of "blank, then a beat of loading, then everything at once".
    const cachedTail = alreadyLoaded ? messages : getRecentMessagesCache(chat.type === 'room' ? 'room' : 'private', chatKey);
    if (!alreadyLoaded) setMessages(cachedTail || []);
    // Set loading synchronously in the same batch as the clear above, so there is never
    // a render where messages is empty AND loading is false (that gap is what briefly
    // flashed "No messages yet" before the real history arrived) — fetchHistory's own
    // setLoading(messages.length === 0) is a stale closure at the instant it fires and
    // can't be trusted to catch this specific transition reliably.
    // Guests skip this: their messages come from sessionStorage/window events (see the
    // guest_room_messages_updated sync effect below), never through fetchHistory, so
    // nothing would ever flip loading back to false for them.
    if (localStorage.getItem('watch_is_guest') !== 'true') {
      setLoading(!cachedTail);
      // Shows the same small top-of-list spinner used for "loading older
      // messages" on scroll-up — here it doubles as "still fetching/
      // reconciling the real history behind this flash", right above the
      // flashed messages, until fetchHistory's finally clears it. Only
      // when there IS a flash to sit above — with nothing cached yet
      // (first-ever open of this chat since login), showing this AND the
      // centered `loading` spinner at once was just two redundant spinners
      // stacked on an empty panel; the centered one alone already covers
      // that case.
      setHistoryLoading(!!cachedTail);
    }
    paginationStateRef.current[chatKey] = {
      hasMore: true,
      isLoading: false
    };

    // For room chats: request a fresh permissions snapshot immediately.
    // This ensures the widget has current restrictions even if no messages have been exchanged recently.
    if (chat.type === 'room' && socketRef.current) {
      socketRef.current.emit('track_rooms', { roomIds: [targetPartner] });
    }
    if (chat.type === 'private') {
      try {
        const r = await fetch(`${API}/api/users/${chat.partner}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        setActiveRelation(d);
        // Fix: propagate fresh avatarPath back into activeChat + conversations cache
        // so the avatar renders correctly on the FIRST open after a page refresh,
        // without needing to close and reopen the chat.
        if (d && d.avatarPath) {
          setActiveChat(prev => prev ? { ...prev, partnerAvatar: d.avatarPath } : prev);
          setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
            (c.partner === targetPartner || c.id === targetPartner)
              ? { ...c, partnerAvatar: d.avatarPath }
              : c
          ));
        }
        // Same fix as above, for the header title: a notification-triggered
        // open has no displayName to start with (see chatDisplayName above),
        // so fill it in from the fresh profile fetch once it resolves —
        // falling back to the raw username rather than leaving it blank if
        // even that comes back empty somehow.
        if (!chatDisplayName) {
          const resolvedName = (d && (d.displayName || d.username)) || chat.partner;
          setActiveChat(prev => prev ? { ...prev, displayName: prev.displayName || resolvedName } : prev);
          setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
            (c.partner === targetPartner || c.id === targetPartner)
              ? { ...c, displayName: c.displayName || resolvedName }
              : c
          ));
        }
      } catch (e) { console.error('Failed to fetch relation', e); }
    }
    // Reset unread count in local conversation list
    setConversations(prev => {
      const updated = (Array.isArray(prev) ? prev : []).map(c => 
        (c.partner === targetPartner || c.id === targetPartner) ? { ...c, unread: 0 } : c
      );
      return updated.sort((a,b) => getSortTime(b) - getSortTime(a));
    });
    // Mark this chat as read
    markChatAsRead(targetPartner, true);
    // NOTE: fetchHistory is intentionally NOT called here.
    // The useEffect([activeChat, view, keyPair]) handles it, and it always uses
    // keyPairRef.current so it's immune to stale-closure key issues.
    // A direct call here would create a race condition where two concurrent async
    // fetches finish in non-deterministic order and the wrong one overwrites state.
  };

  // Tapping a push notification lands here — jump straight to that chat the
  // same way clicking its row in the conversation list would. openChat must
  // already be defined above this point (it's a `const`, not a hoisted
  // function declaration) or this closure would reference it before
  // initialization.
  useEffect(() => {
    if (!pendingOpenChat?.partner) return;
    openChat({ id: pendingOpenChat.partner, partner: pendingOpenChat.partner, type: pendingOpenChat.type || 'private' });
    onPendingOpenChatHandled?.();
  }, [pendingOpenChat]);

  // Called by ChatLockScreen when PIN is correct
  const handleChatUnlock = (chatKey) => {
    const key = (chatKey || '').toLowerCase();
    unlockedSessionsRef.current[key] = Date.now();
    // Reset security attempts in localStorage immediately upon success
    const storageKey = `chat_lock_state_${myUsername}`;
    localStorage.setItem(storageKey, JSON.stringify({ attempts: 0, blockedUntil: null }));
    setShowLockScreen(false);
    if (pendingLockedChat) {
      const pending = pendingLockedChat;
      setPendingLockedChat(null);
      doOpenChat(pending);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (editingMsg) { handleEditMessage(); return; }
    if (!inputValue.trim() || !activeChat || isSendingGlobalRef.current) return;

    isSendingGlobalRef.current = true;
    let tempId = null;
    let previousConversations = null;
    try {
      // ── Client-side room permission checks ──
      if (activeChat.type === 'room' && activeChat.permissions && !activeChat.isHost) {
        const perms = activeChat.permissions;

        // Check host-only messaging FIRST — before any optimistic update
        if (perms.chat === 'host') {
          toast.error('Only the host can send messages in this room.');
          return;
        }

        const linkRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/g;
        if (perms.allowLinks === false && linkRegex.test(inputValue.trim())) {
          toast.error('🔗 Links are not allowed in this room.');
          return;
        }
      }

      const rawText = inputValue.trim();
      const ts = Date.now();
      tempId = `opt-${ts}`;
      const optimisticMsg = {
        id: tempId,
        isMe: true,
        senderName: myUsername,
        message: rawText,
        decryptedText: rawText,
        timestamp: ts,
        replyTo: buildReplySnapshot(replyToMsg, activeChat?.displayName)
      };
      previousConversations = [...conversations];

      // Optimistically show message in UI immediately, clear input field and reply preview
      setMessages(prev => [...prev, optimisticMsg]);
      setInputValue('');
      setReplyToMsg(null);
      
      // ─── E2EE Encryption ───
      let messagePayload = null, senderMessagePayload = null, isEncrypted = false;
      let nonceValue = null, ephemeralKey = null, e2eeKeysGroup = null;
      let targetPubKey = null;
      let dmNetworkFailure = false;
      if (activeChat.type === 'private' && keyPair) {
        // Live-fetch-first, authoritative-on-success, cache-fallback only on
        // a genuine network failure — same vetted resolver Room.jsx's DM
        // sends use (see dmKeyResolution.js's own doc comment for why a
        // hand-rolled "fetch, then unconditionally fall back to whatever's
        // in localStorage" pattern is exactly how a message ends up
        // encrypted against a recipient's stale, already-rotated key.
        const resolved = await resolveDmRecipientPublicKey({
          targetUsername: activeChat.partner,
          apiBase: API,
          memoryCache: {},
        });
        targetPubKey = resolved.publicKey;
        dmNetworkFailure = resolved.networkFailure;

        if (targetPubKey && keyPair) {
           try {
             // pass my publicKey so our own message copy can be rendered
             const enc = encryptDM(optimisticMsg.message, targetPubKey, encodeBase64(keyPair.publicKey));
             messagePayload = enc.ciphertext;
             nonceValue = enc.nonce;
             ephemeralKey = enc.ephemeralPublicKey;
             senderMessagePayload = enc.senderCiphertext;
             isEncrypted = true;
           } catch (err) {
             console.error('[E2EE] DM Encryption failed:', err);
             // isEncrypted remains false
           }
        }
      } else if (activeChat.type === 'room' && isSahaplayOfficialGroup(activeChat)) {
        // Mandatory SahaPlay announcements group: intentionally unencrypted —
        // see isSahaplayOfficialGroup for why (public bulletin, no fixed
        // participant list to wrap a group key for).
        messagePayload = optimisticMsg.message;
        isEncrypted = true; // not a lie here: this room's messages are defined as always-plain, matching the mandatory-encryption guard below on purpose
      } else if (activeChat.type === 'room' && keyPair) {
        const roomIdStr = (activeChat.partner || activeChat.id).toLowerCase();
        const pkRes = await fetch(`${API}/api/rooms/${roomIdStr}/public-keys`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          const recipients = pkData.keys.map(k => ({
            username: k.username,
            publicKey: robustDecode(k.publicKey)
          }));

          try {
            const enc = encryptGroupMessage(optimisticMsg.message, recipients, keyPair, myUsername);
            messagePayload = enc.ciphertext;
            nonceValue = enc.nonce;
            e2eeKeysGroup = enc.keys;
            ephemeralKey = encodeBase64(keyPair.publicKey);
            isEncrypted = true;
          } catch (err) {
            console.error('[E2EE] Group Encryption failed:', err);
            // isEncrypted remains false
          }
        }
      }

      // E2EE is mandatory for both DM and group text — never fall back to plaintext.
      // Aborting here (before postBody is built) means an unencrypted message never
      // leaves the client at all, not even inside a request the server goes on to
      // reject — matching how group send/edit/forward and DM media already behave.
      //
      // Order matters here: !keyPair (no send attempted at all — the whole
      // fetch-and-encrypt block above is gated on it) must be checked BEFORE
      // !targetPubKey, or a sender who skipped their own passphrase setup
      // sees the confusing, factually wrong "@<recipient> hasn't set up
      // encryption keys yet" — it's the sender who hasn't, not them.
      if (activeChat.type === 'private' && !keyPair) {
        throw new Error('Set up your encryption key in Account Settings first.');
      }
      if (activeChat.type === 'private' && !targetPubKey) {
        throw new Error(dmNetworkFailure
          ? "Couldn't verify the recipient's encryption key — check your connection and try again."
          : `@${activeChat.displayName || activeChat.partner} has not set up encryption keys yet.`);
      }
      if ((activeChat.type === 'private' || activeChat.type === 'room') && !isEncrypted) {
        throw new Error('Message not sent — encryption failed.');
      }

      const postBody = {
        type: activeChat.type,
        partner: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : activeChat.partner,
        targetId: activeChat.type === 'private' ? activeChat.targetId : null,
        roomId: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : null,
        message: messagePayload,
        senderMessage: senderMessagePayload,
        nonce: nonceValue,
        ephemeralPublicKey: ephemeralKey,
        e2eeKeys: e2eeKeysGroup,
        encrypted: isEncrypted,
        replyTo: sanitizeReplyToForWire(optimisticMsg.replyTo),
        tempId: tempId
      };

      const resp = await fetch(`${API}/api/chats/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postBody)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Message could not be sent.');
        if (tempId) setMessages(prev => prev.filter(m => m.id !== tempId));
        if (previousConversations) setConversations(previousConversations);
        setInputValue(rawText);
        // The server's mutual-friendship check is the one truly authoritative
        // source here — this client's own activeRelation can be stale (e.g.
        // this chat was already open through a block/unblock cycle and never
        // re-synced), which is exactly why the input was showing at all when
        // the server went on to reject the send. Rather than leave the UI
        // looking like nothing happened (still showing the input, ready for
        // another doomed attempt), fold the rejection straight into
        // activeRelation immediately, then confirm it with a real refetch.
        if (activeChat.type === 'private' && resp.status === 403 && /mutual friends/i.test(err.error || '')) {
          setActiveRelation({ followStatus: null, isFollowingMe: false });
          fetch(`${API}/api/users/${activeChat.partner}`, { headers: { 'Authorization': `Bearer ${token}` }, cache: 'no-store' })
            .then(res => res.json())
            .then(d => setActiveRelation(d))
            .catch(() => {});
        }
      }
    } catch(e) {
      console.error(e);
      toast.error(e.message || 'Failed to send message. Please try again.');
      if (tempId) setMessages(prev => prev.filter(m => m.id !== tempId));
      if (previousConversations) setConversations(previousConversations);
      setInputValue(rawText);
    } finally {
      isSendingGlobalRef.current = false;
    }
  };

  // Sends a poll — mirrors handleSend's E2EE block almost exactly, just
  // encrypting JSON.stringify({question, options, allowMultiple}) instead
  // of inputValue, and marking the message isPoll:true so both the
  // optimistic bubble and the real server row render via PollBubble
  // instead of plain text. The poll definition itself goes through the
  // SAME per-recipient encryption every other message uses (no new crypto
  // code at all) — only votes (cast via castPollVote/POST /api/chats/vote)
  // are unencrypted metadata, same trust level as message reactions.
  const sendPollMessage = async (pollDef) => {
    if (!activeChat) return;
    const pollText = JSON.stringify(pollDef);
    const ts = Date.now();
    const tempId = `opt-poll-${ts}`;
    const optimisticMsg = {
      id: tempId,
      isMe: true,
      senderName: myUsername,
      message: pollText,
      decryptedText: pollText,
      isPoll: true,
      pollVotes: {},
      timestamp: ts,
      replyTo: null,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    let messagePayload = null, senderMessagePayload = null, isEncrypted = false;
    let nonceValue = null, ephemeralKey = null, e2eeKeysGroup = null;

    try {
      let targetPubKey = null;
      if (activeChat.type === 'private' && keyPair) {
        const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`, { cache: 'no-store' });
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          if (pkData.publicKey) targetPubKey = pkData.publicKey;
        }
        if (targetPubKey) {
          const enc = encryptDM(pollText, targetPubKey, encodeBase64(keyPair.publicKey));
          messagePayload = enc.ciphertext;
          nonceValue = enc.nonce;
          ephemeralKey = enc.ephemeralPublicKey;
          senderMessagePayload = enc.senderCiphertext;
          isEncrypted = true;
        }
      } else if (activeChat.type === 'room' && keyPair) {
        const roomIdStr = (activeChat.partner || activeChat.id).toLowerCase();
        const pkRes = await fetch(`${API}/api/rooms/${roomIdStr}/public-keys`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          const recipients = pkData.keys.map(k => ({ username: k.username, publicKey: robustDecode(k.publicKey) }));
          const enc = encryptGroupMessage(pollText, recipients, keyPair, myUsername);
          messagePayload = enc.ciphertext;
          nonceValue = enc.nonce;
          e2eeKeysGroup = enc.keys;
          ephemeralKey = encodeBase64(keyPair.publicKey);
          isEncrypted = true;
        }
      }

      if (!isEncrypted) throw new Error('Poll not sent — encryption failed.');

      const postBody = {
        type: activeChat.type,
        partner: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : activeChat.partner,
        targetId: activeChat.type === 'private' ? activeChat.targetId : null,
        roomId: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : null,
        message: messagePayload,
        senderMessage: senderMessagePayload,
        nonce: nonceValue,
        ephemeralPublicKey: ephemeralKey,
        e2eeKeys: e2eeKeysGroup,
        encrypted: isEncrypted,
        replyTo: null,
        tempId,
        isPoll: true,
      };
      const resp = await fetch(`${API}/api/chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(postBody),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Poll could not be sent.');
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to send poll. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // Casts/changes/withdraws this user's own vote — optimistic update first
  // (so it feels instant), then the real POST; the socket's chat:poll_vote
  // listener (registered above) is what reconciles this across this user's
  // OTHER open tabs/devices and pushes it live to everyone else.
  const handlePollVote = async (msg, optionIndices) => {
    const myKey = myUsername.toLowerCase();
    setMessages(prev => prev.map(m => {
      if (String(m.id) !== String(msg.id) && String(m.timestamp) !== String(msg.timestamp)) return m;
      const nextVotes = { ...(m.pollVotes || {}) };
      if (optionIndices.length > 0) nextVotes[myKey] = optionIndices;
      else delete nextVotes[myKey];
      return { ...m, pollVotes: nextVotes };
    }));
    // Guests have no JWT, so POST /api/chats/vote's authenticateToken always
    // rejected them outright ("guest votes not registering"). This widget
    // has no socket of its own (see the matching send-path comments below),
    // so a guest's vote is delegated to Room.jsx's own
    // guest_widget_cast_poll_vote listener, which does have one — same
    // bridge pattern every other guest room action here already uses.
    if (localStorage.getItem('watch_is_guest') === 'true') {
      if (activeChat?.type === 'room') {
        window.dispatchEvent(new CustomEvent('guest_widget_cast_poll_vote', {
          detail: { messageId: msg.id || msg.timestamp, optionIndices }
        }));
      }
      return;
    }
    try {
      await castPollVote(msg.id || msg.timestamp, optionIndices, token);
    } catch (e) {
      console.error('[poll] vote failed', e);
      toast.error('Vote failed. Please try again.');
    }
  };

  // Both DM and group edits re-run full encryption, mirroring handleSend above:
  // DM re-encrypts against the already-known partner's key; group re-encrypts as
  // a brand new payload (fresh secretbox key, re-wrapped for current recipients).
  // Shared by the plain-text edit bar (handleEditMessage) and poll edits
  // (submitPollEdit, which passes JSON.stringify(pollDef) as newText) — the
  // encryption/PUT mechanics don't care what the text represents.
  const commitEditedText = async (target, newText) => {
    if (!newText.trim() || !target || !activeChat) return;
    const idStr = String(target.id);

    // A captioned media message's "message" field packs the media
    // DECRYPTION KEY together with the caption (packMediaKeyAndCaption) —
    // encrypting the edited caption alone, as this function used to,
    // silently threw that key away: the only copy of it lived in the
    // ciphertext this PUT is about to overwrite, permanently breaking
    // that image/video for everyone (not recoverable by reopening —
    // the key really is gone from the row). Re-derive the existing key
    // from what this sender can already decrypt of their own message
    // (the same senderMessage/group-key-map paths render already uses),
    // and re-pack it with the new caption before encrypting, exactly the
    // envelope a normal send already uses.
    let textToEncrypt = newText;
    if (target.mediaType) {
      try {
        let existingMediaKeyB64 = null;
        if (activeChat.type === 'private' && keyPair && target.senderMessage) {
          const plain = decryptDMSenderCopy(target.senderMessage, target.nonce, target.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
          if (plain) existingMediaKeyB64 = unpackMediaKeyAndCaption(plain).mediaKeyB64;
        } else if (activeChat.type === 'room' && keyPair && target.e2ee?.keys) {
          const myLower = myUsername?.toLowerCase();
          // Case-insensitive fallback — this direct lookup used to be the
          // only attempt, unlike Room.jsx's identical block, which already
          // had this fallback. A key map entry stored under a different
          // case than myUsername's current case silently missed here.
          const myKeyWrap = target.e2ee.keys[myLower] || Object.entries(target.e2ee.keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
          // senderPublicKey can be missing on a message loaded from history
          // (a backend join-casing gap, now fixed server-side, but older
          // cached/in-flight data can still hit it) even though it's
          // genuinely ours — editing only ever operates on this account's
          // own message, so reconstructing it from this account's current
          // keyPair is always safe here, matching the same fallback
          // GlobalChatWidget's own render path already uses for this.
          const senderPubKeyB64 = target.e2ee.senderPublicKey || encodeBase64(keyPair.publicKey);
          // nonce: e2ee.nonce first, target.nonce as fallback — this used to
          // read target.nonce ONLY, but a group message's nonce commonly
          // lives at e2ee.nonce instead (see this file's own live-receive
          // handler, which already checks both in this same order), so a
          // message shaped that way had decryptGroupMessage called with an
          // undefined nonce and failed outright every time.
          const msgNonce = target.e2ee.nonce || target.nonce;
          console.log('[E2EE DEBUG] GlobalChatWidget commitEditedText media-key recovery:', {
            msgId: target.id, keyOwners: Object.keys(target.e2ee.keys || {}), myLower,
            hasMyKeyWrap: !!myKeyWrap, usedSenderPKFallback: !target.e2ee.senderPublicKey, hasNonce: !!msgNonce,
          });
          if (myKeyWrap) {
            const plain = decryptGroupMessage(target.message, msgNonce, myKeyWrap, decodeBase64(senderPubKeyB64), keyPair.secretKey);
            console.log('[E2EE DEBUG] GlobalChatWidget commitEditedText decrypt result:', plain === null ? 'FAILED (null)' : `OK, len ${plain.length}`);
            if (plain !== null) existingMediaKeyB64 = unpackMediaKeyAndCaption(plain).mediaKeyB64;
          }
        }
        if (!existingMediaKeyB64) {
          toast.error("Couldn't verify this media's encryption key — reopen the chat and try again.");
          return;
        }
        textToEncrypt = packMediaKeyAndCaption(existingMediaKeyB64, newText);
      } catch (err) {
        console.error('[E2EE] Could not preserve media key while editing caption:', err);
        toast.error('Could not save this caption — the image/video would have been lost.');
        return;
      }
    }

    let messagePayload = textToEncrypt;
    let senderMessagePayload = undefined;
    let nonceValue = undefined;
    let ephemeralKey = undefined;
    let e2eeKeysGroup = undefined;
    let isEncrypted = false;

    try {
      if (activeChat.type === 'private' && keyPair) {
        let targetPubKey = null;
        const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`, { cache: 'no-store' });
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          if (pkData.publicKey) targetPubKey = pkData.publicKey;
        }
        if (!targetPubKey) {
          toast.error('Could not find recipient encryption key.');
          return;
        }
        const enc = encryptDM(textToEncrypt, targetPubKey, encodeBase64(keyPair.publicKey));
        messagePayload = enc.ciphertext;
        senderMessagePayload = enc.senderCiphertext;
        nonceValue = enc.nonce;
        ephemeralKey = enc.ephemeralPublicKey;
        isEncrypted = true;
      } else if (activeChat.type === 'room' && keyPair) {
        // Group edit is a brand new encrypted payload (fresh secretbox key, re-wrapped
        // for the CURRENT room recipients), same as a fresh send — never resend plaintext,
        // which would pair new content with the message's OLD nonce/keys server-side and
        // permanently corrupt the row.
        const roomIdStr = (activeChat.partner || activeChat.id).toLowerCase();
        const pkRes = await fetch(`${API}/api/rooms/${roomIdStr}/public-keys`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          const recipients = pkData.keys.map(k => ({ username: k.username, publicKey: robustDecode(k.publicKey) }));
          try {
            const enc = encryptGroupMessage(textToEncrypt, recipients, keyPair, myUsername);
            messagePayload = enc.ciphertext;
            nonceValue = enc.nonce;
            e2eeKeysGroup = enc.keys;
            ephemeralKey = encodeBase64(keyPair.publicKey);
            isEncrypted = true;
          } catch (err) {
            console.error('[E2EE] Group edit encryption failed:', err);
          }
        }
        if (!isEncrypted) {
          toast.error('Edit not sent — encryption failed.');
          return;
        }
      }

      setMessages(prev => prev.map(m => (String(m.id) === idStr ? { ...m, message: messagePayload, decryptedText: newText, edited: true, editedAt: Date.now() } : m)));
      setEditingMsg(null);
      setInputValue('');

      const resp = await fetch(`${API}/api/chats/message/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: messagePayload, senderMessage: senderMessagePayload, nonce: nonceValue, ephemeralPublicKey: ephemeralKey, e2eeKeys: e2eeKeysGroup })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Could not edit message.');
      }
    } catch (e) {
      console.error('[GlobalChatWidget] edit error', e);
      toast.error('Could not edit message.');
    }
  };

  const handleEditMessage = async () => {
    if (!inputValue.trim() || !editingMsg) return;
    const newText = inputValue.trim();
    const target = editingMsg;
    setEditingMsg(null);
    setInputValue('');
    await commitEditedText(target, newText);
  };

  // Poll edit: PollComposer (opened prefilled via editingPollMsg, see the
  // Edit menu-item handlers below) hands back a fresh { question, options,
  // allowMultiple } object — re-stringify and run it through the exact same
  // encrypt+PUT path as any other edit. Vote counts stay on the message as-is
  // (editing the question/options doesn't touch poll_votes server-side).
  const submitPollEdit = async (target, pollDef) => {
    await commitEditedText(target, JSON.stringify(pollDef));
  };

  const handleMediaUpload = async (file, mediaDuration = null, mediaGroupId = null, caption = '') => {
    const validation = validateFile(file);
    if (!validation.valid) { showInlineNotice(validation.error); return; }

    if (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) {
      showInlineNotice('📷 Media sharing is not allowed in this room.');
      return;
    }

    const ts = Date.now();
    const tempId = `opt-media-${ts}`;
    const objectUrl = URL.createObjectURL(file);
    const optimisticMsg = {
      id: tempId,
      isMe: true,
      senderName: myUsername,
      message: '',
      decryptedText: caption || '',
      mediaUrl: objectUrl,
      mediaType: file.type,
      mediaDuration: mediaDuration || null,
      timestamp: ts,
      _isOptimistic: true,
      _fileName: file.name,
      _fileSize: file.size,
      mediaGroupId: mediaGroupId || null
    };
    setMessages(prev => [...prev, optimisticMsg]);
    if (activeChat?.partner || activeChat?.id) {
      lastSentTempIdRef.current[activeChat.partner || activeChat.id] = tempId;
    }

    // Optimistically update the conversations list for the sender so the preview
    // shows the media type immediately (before the socket bounce arrives).
    const _mType = file.type;
    const _mLabel = _mType.startsWith('video') ? 'Video' : _mType.startsWith('image') ? 'Photo' : _mType.startsWith('audio') ? 'Voice Note' : 'File';
    setConversations(prev => {
      const convs = Array.isArray(prev) ? prev : [];
      const _partner = activeChat?.partner || activeChat?.id;
      if (!_partner) return convs;
      const _exists = convs.find(c => c.partner === _partner || c.id === _partner);
      const _isGroup = activeChat?.type === 'room';
      const _updated = _exists
        ? { ..._exists, message: _mLabel, decryptedText: _mLabel, lastMediaType: _mType, lastMediaFileName: file.name || null, lastMediaDuration: mediaDuration || null, lastTimestamp: optimisticMsg.timestamp, lastSenderName: myUsername, isMyLastMessage: true, unread: 0 }
        : { id: _isGroup ? _partner : undefined, partner: _partner, displayName: activeChat?.displayName, partnerAvatar: activeChat?.partnerAvatar, lastTimestamp: optimisticMsg.timestamp, message: _mLabel, decryptedText: _mLabel, lastMediaType: _mType, lastMediaFileName: file.name || null, lastMediaDuration: mediaDuration || null, lastSenderName: myUsername, isMyLastMessage: true, type: activeChat?.type, unread: 0 };
      const _others = convs.filter(c => c.partner !== _partner && c.id !== _partner);
      return [_updated, ..._others].sort((a, b) => getSortTime(b) - getSortTime(a));
    });

    setIsUploading(true);

    try {
      const isRoom = activeChat?.type === 'room';
      // Group media/files are E2EE too now — same AES-256-GCM-then-NaCl-wrap-the-key
      // pattern as DM media, just wrapped for every room recipient instead of one partner.
      const enc = await encryptMedia(file);
      const encryptedBlob = enc.encryptedBlob;
      const mediaKeyBytes = enc.mediaKeyBytes;
      const mediaKeyB64 = encodeBase64(mediaKeyBytes);

      const fd = new FormData();
      fd.append('media', encryptedBlob, file.name);
      if (isRoom) {
        fd.append('roomId', (activeChat.partner || activeChat.id).toLowerCase());
      }
      const uploadResp = await fetch(`${API}/api/upload/chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!uploadResp.ok) {
        const uploadErr = await uploadResp.json().catch(() => ({}));
        throw new Error(uploadErr.error || 'Upload failed');
      }
      const uploadData = await uploadResp.json();
      if (!uploadData.url) throw new Error('Upload failed');

      const fullUrl = resolveMediaUrl(uploadData.url, API);

      // ─── E2EE Encryption for Media ───
      let mediaNonce = null;
      let mediaEphemeral = null;
      let isEncrypted = false;
      let messagePayload = ''; 
      let senderMessagePayload = null;
      let e2eeKeysGroup = null;

      try {
        if (activeChat.type === 'private' && keyPair && mediaKeyB64) {
          let targetPubKey = null;
          const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`, { cache: 'no-store' });
          if (pkRes.ok) {
            targetPubKey = (await pkRes.json()).publicKey;
          } else if (pkRes.status === 404) {
             const pkResLower = await fetch(`${API}/api/auth/public-key/${activeChat.partner.toLowerCase()}`, { cache: 'no-store' });
             if (pkResLower.ok) targetPubKey = (await pkResLower.json()).publicKey;
          }
          if (targetPubKey) {
            // STRATEGY: Encrypt the media key, not the URL. A caption (if any)
            // rides along in the same encrypted payload — see
            // packMediaKeyAndCaption's own comment for why.
            const enc = encryptDM(packMediaKeyAndCaption(mediaKeyB64, caption), targetPubKey, encodeBase64(keyPair.publicKey));
            messagePayload = enc.ciphertext; // This now holds the encrypted media key
            mediaNonce = enc.nonce;
            mediaEphemeral = enc.ephemeralPublicKey;
            senderMessagePayload = enc.senderCiphertext;
            isEncrypted = true;
          }
        } else if (activeChat.type === 'room' && keyPair && mediaKeyB64) {
          const roomIdStr = (activeChat.partner || activeChat.id).toLowerCase();
          const pkRes = await fetch(`${API}/api/rooms/${roomIdStr}/public-keys`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (pkRes.ok) {
            const pkData = await pkRes.json();
            const recipients = pkData.keys.map(k => ({ username: k.username, publicKey: robustDecode(k.publicKey) }));
            // STRATEGY: same as DM — encrypt the media key (not the URL), wrapped per recipient.
            const enc = encryptGroupMessage(packMediaKeyAndCaption(mediaKeyB64, caption), recipients, keyPair, myUsername);
            messagePayload = enc.ciphertext;
            mediaNonce = enc.nonce;
            e2eeKeysGroup = enc.keys;
            mediaEphemeral = encodeBase64(keyPair.publicKey); // sender's own long-term public key
            isEncrypted = true;
          }
        }
      } catch (err) {
         console.warn("[E2EE] Media encryption error:", err);
      }

      // IMPORTANT: Do NOT replace the optimistic blob URL with `fullUrl`.
      // `fullUrl` points to the AES-GCM encrypted binary on the server — the browser
      // cannot render it as an image/video. Keep the local blob so the sender sees their
      // media immediately. The recipient's side decrypts asynchronously in handleNewMsg.
      // Also stamp the encrypted payload onto the optimistic entry itself —
      // without this, editing the caption before the chat is reopened (the
      // only other place these fields get populated, via a fresh history
      // fetch) finds target.e2ee/senderMessage/nonce undefined and can't
      // recover the media key to re-pack, so commitEditedText refuses the
      // edit with "Couldn't verify this media's encryption key".
      setMessages(prev => prev.map(m =>
        m.id === optimisticMsg.id
          ? {
              ...m, mediaType: file.type, _isOptimistic: false,   // keep mediaUrl = objectUrl (blob)
              message: isEncrypted ? messagePayload : '',
              senderMessage: senderMessagePayload,
              nonce: mediaNonce,
              ephemeralPublicKey: mediaEphemeral,
              e2ee: e2eeKeysGroup ? { keys: e2eeKeysGroup, nonce: mediaNonce, senderPublicKey: mediaEphemeral } : undefined,
            }
          : m
      ));

      // STRICT SECURITY: E2E encryption is mandatory for both private and group chats.
      if ((activeChat.type === 'private' || activeChat.type === 'room') && !isEncrypted) {
         throw new Error("Encryption keys missing. Media not sent for security.");
      }

      // Send to backend to persist/broadcast
      const sendResp = await fetch(`${API}/api/chats/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: activeChat.type,
          partner: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : activeChat.partner,
          targetId: activeChat.type === 'private' ? activeChat.targetId : null,
          roomId: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : null,
          mediaUrl: fullUrl, // Store real URL as-is, but access will be blocked without decryption
          senderMessage: senderMessagePayload,
          message: isEncrypted ? messagePayload : '', // If encrypted, message field holds encrypted media key
          mediaType: file.type,
          nonce: mediaNonce,
          ephemeralPublicKey: mediaEphemeral,
          e2eeKeys: e2eeKeysGroup,
          encrypted: isEncrypted,
          replyTo: sanitizeReplyToForWire(buildReplySnapshot(replyToMsg, activeChat?.displayName)),
          tempId: tempId,
          mediaFileName: file.name || null,
          mediaFileSize: file.size || null,
          mediaDuration: mediaDuration ? Number(mediaDuration) : null,
          mediaGroupId: mediaGroupId || null
        })
      });
      if (!sendResp.ok) {
        const sendErr = await sendResp.json().catch(() => ({}));
        throw new Error(sendErr.error || 'Send failed');
      }
      setReplyToMsg(null);
      toast.success('Media sent!');
    } catch (err) {
      console.error('Media upload error:', err);
      toast.error(err.message || 'Error uploading media');
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      URL.revokeObjectURL(objectUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const MAX_MEDIA_PER_SEND = 5;

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = null;
    if (!files.length) return;

    if (files.length > MAX_MEDIA_PER_SEND) {
      showInlineNotice(`You can only send up to ${MAX_MEDIA_PER_SEND} files at a time`);
      return;
    }

    const mediaGroupId = files.length > 1 ? `mg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : null;
    for (const file of files) {
      await handleMediaUpload(file, null, mediaGroupId);
    }
  };

  async function startRecording() {
    // Show the recording UI the instant the button is tapped instead of
    // after getUserMedia + MediaRecorder + AudioContext setup all finish —
    // that round trip (mic permission handshake, Android WebView first-touch
    // overhead) is a real, user-visible beat, and waiting for all of it
    // before switching the composer over is what read as "not starting
    // immediately". mySeq/recordingSeqRef lets a getUserMedia that resolves
    // AFTER the user already cancelled tell it's stale and back out instead
    // of reviving a dead recording.
    const mySeq = ++recordingSeqRef.current;
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 299) { stopRecording(); return 300; }
        return prev + 1;
      });
    }, 1000);
    try {
      // Explicitly OFF (not just omitted): leaving these unset lets Chromium
      // pick its default WebRTC-oriented "communications" audio source on
      // Android, which puts the OS in MODE_IN_COMMUNICATION for as long as
      // the mic is open — the hardware volume rocker then controls the
      // in-call volume stream instead of media volume, and Android shows its
      // real ongoing-call chrome (route/speaker icons) over the page. A
      // plain voice-note recording isn't a call; asking for these off keeps
      // Android on the normal mic/media audio path.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      if (recordingSeqRef.current !== mySeq) {
        // Stopped/cancelled while getUserMedia was still resolving — tear
        // this stream down and don't touch state, it's already been reset.
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        // MediaRecorder.stop() is async — this can fire AFTER
        // cancelRecording() has already synchronously cleared audioBlob/
        // audioUrl, silently repopulating them a moment later and making a
        // just-deleted recording reappear in the preview bar. The recorder
        // itself is tagged right before the cancel path calls .stop(), so
        // this can tell "stopped to review" apart from "stopped to discard."
        if (recorder._cancelled) return;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null; }
        if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
        setWaveHeights(Array(20).fill(3));
      };
      recorder.start(100);
      
      // Set up Web Audio analyser for real waveform
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        const animate = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArr);
          const bars = Array.from({ length: 20 }, (_, i) => {
            const idx = Math.floor(i * dataArr.length / 20);
            const v = dataArr[idx] / 255;
            return Math.max(3, Math.round(v * 100));
          });
          setWaveHeights(bars);
          waveAnimRef.current = requestAnimationFrame(animate);
        };
        animate();
      } catch {}
    } catch {
      // getUserMedia rejected (permission denied, no mic, etc) — only roll
      // the optimistic UI back if a later stop/cancel hasn't already done so.
      if (recordingSeqRef.current === mySeq) {
        clearInterval(timerRef.current);
        setIsRecording(false);
      }
      toast.error('Microphone access denied. Please allow microphone permission.');
    }
  }

  function stopRecording() {
    // Invalidates any getUserMedia() from startRecording that's still
    // in-flight — it'll see a stale seq when it resolves and back out
    // instead of reviving a recording that was already stopped.
    recordingSeqRef.current++;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  }

  function cancelRecording() {
    recordingSeqRef.current++;
    if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null; }
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current._cancelled = true;
      try { mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop()); } catch {}
      try { if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch {}
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    setWaveHeights(Array(20).fill(3));
  }

  async function sendVoiceNote() {
    if (!audioBlob) return;
    if (audioBlob.size > 10 * 1024 * 1024) { toast.error('❌ Voice note too large. Max 10MB.'); return; }
    const mimeType = audioBlob.type || 'audio/webm';
    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mimeType });
    const prevUrl = audioUrl;
    const duration = recordingTime;
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    await handleMediaUpload(file, duration);
  }

  const handleReact = async (msgId, emoji) => {
    // Optimistic update: enforce single reaction per user
    setMessages(prev => prev.map(m => {
      if (m.id === msgId || String(m.id) === String(msgId)) {
        const rx = {};
        // Copy reactions but remove user from all
        for (const [em, users] of Object.entries(m.reactions || {})) {
          const filtered = users.filter(u => u !== myUsername);
          if (filtered.length > 0) rx[em] = filtered;
        }
        // If user didn't have this emoji before, add them
        const hadIt = (m.reactions?.[emoji] || []).includes(myUsername);
        if (!hadIt) {
          if (!rx[emoji]) rx[emoji] = [];
          rx[emoji].push(myUsername);
        }
        return { ...m, reactions: rx };
      }
      return m;
    }));
    setActiveReactionMsg(null);
    setShowAllEmojis(false);

    try {
      await fetch(`${API}/api/chats/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messageId: msgId, emoji })
      });
    } catch(e) {
      console.error('react error', e);
    }
  };

  const handleDeleteMessage = async (msgId, mode = 'global') => {
    const idStr = String(msgId);
    // Optimistic delete
    setMessages(prev => prev.filter(m => String(m.id) !== idStr && String(m.timestamp) !== idStr));
    try {
      const qs = mode === 'local' ? '?action=local' : '';
      const resp = await fetch(`${API}/api/chats/message/${msgId}${qs}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        console.error('[Delete] failed:', resp.status, err);
      }
    } catch(e) { console.error('delete error', e); }
  };

  // Resolves the same rowKey used for checkbox selection (msg.tempId || msg.id || i)
  // back to the actual message objects, for bulk delete/forward. A media-group grid
  // tile only ever exposes ONE checkbox (on its head message — the rest of the run
  // renders nothing, see groupMediaRuns), so selecting it must expand back out to
  // every message in that batch or only the first photo would be acted on.
  const getSelectedMessages = () => {
    const runs = groupMediaRuns(messages);
    const result = [];
    const seen = new Set();
    messages.forEach((m, i) => {
      const rowKey = m.tempId || m.id || i;
      if (!selectedMsgIds.has(rowKey)) return;
      const group = runs.heads.get(rowKey) || [m];
      for (const gm of group) {
        const gid = gm.tempId || gm.id;
        if (seen.has(gid)) continue;
        seen.add(gid);
        result.push(gm);
      }
    });
    return result;
  };

  const handleBulkDelete = async (mode) => {
    const ids = getSelectedMessages().map(m => m.id || m.timestamp);
    setBulkDeleteConfirm(false);
    for (const id of ids) {
      await handleDeleteMessage(id, mode);
    }
    exitMsgSelectMode();
  };

  // Recovers the raw AES media key (base64) for a media message so it can be
  // re-wrapped for a NEW recipient when forwarding — mirrors the exact same
  // sender-copy/recipient-copy decrypt branching already used to render this
  // message the first time (see handleRemoteEdit above for the same pattern).
  // Group-sourced media (msg.e2ee present) is recovered via decryptGroupMessage
  // against the message's own per-recipient key map, not the DM-only functions.
  const recoverMediaKeyB64 = (msg) => {
    if (msg.e2ee && msg.e2ee.keys && msg.e2ee.senderPublicKey) {
      if (!keyPair) return null;
      try {
        const myLower = myUsername?.toLowerCase();
        const myEncKey = msg.e2ee.keys[myLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
        if (!myEncKey) return null;
        const senderPK = decodeBase64(msg.e2ee.senderPublicKey);
        return decryptGroupMessage(msg.message, msg.e2ee.nonce, myEncKey, senderPK, keyPair.secretKey);
      } catch (e) { console.warn('[Forward] group media key recovery failed', e); return null; }
    }
    if (!msg.nonce || !keyPair) return null;
    try {
      if (msg.isMe && msg.senderMessage) {
        return decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
      }
      if (!msg.isMe && msg.ephemeralPublicKey) {
        return decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
      }
    } catch (e) { console.warn('[Forward] media key recovery failed', e); }
    return null;
  };

  // Resolves the real plaintext for a message being forwarded. Never falls back to
  // msg.message when the message is E2EE (has a nonce) — msg.message there is still
  // ciphertext, and forwarding it as if it were plaintext would re-encrypt already-
  // encrypted bytes, landing as garbled text on the destination side once the outer
  // layer is (correctly) decrypted. If msg.decryptedText wasn't already cached, retry
  // decryption live here with the same sender-copy/recipient branching used above,
  // and only give up (treat as unforwardable) if that also fails. Group-sourced text
  // (msg.e2ee present) uses decryptGroupMessage against the message's own key map.
  const recoverDmText = (msg) => {
    if (msg.decryptedText != null && msg.decryptedText !== '') return msg.decryptedText;
    if (msg.e2ee && msg.e2ee.keys && msg.e2ee.senderPublicKey) {
      if (!keyPair) return null;
      try {
        const myLower = myUsername?.toLowerCase();
        const myEncKey = msg.e2ee.keys[myLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
        if (!myEncKey) return null;
        const senderPK = decodeBase64(msg.e2ee.senderPublicKey);
        return decryptGroupMessage(msg.message, msg.e2ee.nonce, myEncKey, senderPK, keyPair.secretKey);
      } catch (e) { console.warn('[Forward] group text recovery failed', e); return null; }
    }
    if (!msg.nonce) return msg.message || '';
    if (!keyPair) return null;
    try {
      if (msg.isMe && msg.senderMessage) {
        return decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
      }
      const senderPK = msg.ephemeralPublicKey || msg.senderPublicKey;
      if (!msg.isMe && senderPK) {
        return decryptDM(msg.message, msg.nonce, senderPK, encodeBase64(keyPair.secretKey));
      }
    } catch (e) { console.warn('[Forward] text recovery failed', e); }
    return null;
  };

  // Forwarding always goes through the REST send endpoint (POST /api/chats/send)
  // regardless of destination type — unlike the socket send paths, it doesn't
  // require the destination room to be currently joined, which most forward
  // destinations won't be. A room destination is E2EE just like a fresh send:
  // the destination room's own recipients are fetched once per destination and
  // the content (text, or the media AES key) is run through encryptGroupMessage —
  // forwarding must never write plaintext into a room just because the source
  // message's plaintext was already recovered client-side.
  const handleForwardSend = async () => {
    if (selectedForwardChats.length === 0) return;
    setForwarding(true);
    const msgsToForward = getSelectedMessages().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    // Forwarding a multi-image/video batch (a grid tile the user selected as one
    // unit) should reassemble as a grid at the destination too, not scatter into
    // separate bubbles — tag every visual media item in this forward with one
    // shared mediaGroupId, same as a fresh multi-file send.
    const forwardVisualCount = msgsToForward.filter(m => (m.mediaType || '').startsWith('image/') || (m.mediaType || '').startsWith('video/')).length;
    const forwardGroupId = forwardVisualCount > 1 ? `mg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : null;
    let failCount = 0;
    for (const destKey of selectedForwardChats) {
      const dest = conversations.find(c => (c.id || c.partner) === destKey);
      if (!dest) continue;
      const destType = dest.type === 'room' ? 'room' : 'private';
      const destPartner = dest.id || dest.partner;
      let targetPubKey = null;
      let groupRecipients = null;
      if (destType === 'private') {
        try {
          const pkRes = await fetch(`${API}/api/auth/public-key/${destPartner}`, { cache: 'no-store' });
          if (pkRes.ok) { const d = await pkRes.json(); targetPubKey = d.publicKey || null; }
        } catch {}
      } else {
        try {
          const pkRes = await fetch(`${API}/api/rooms/${destPartner.toLowerCase()}/public-keys`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (pkRes.ok) {
            const pkData = await pkRes.json();
            groupRecipients = pkData.keys.map(k => ({ username: k.username, publicKey: robustDecode(k.publicKey) }));
          }
        } catch { /* groupRecipients stays null; handled as an unencryptable destination below */ }
      }
      for (const msg of msgsToForward) {
        try {
          // A message with mediaType but no live mediaUrl is expired media — msg.message
          // there is still the wrapped media key, not text. Skip rather than let it fall
          // into the text branch below and forward the raw key as visible text.
          if (msg.mediaType && !msg.mediaUrl) { failCount++; continue; }
          const isMedia = !!msg.mediaType && !!msg.mediaUrl;
          const body = {
            type: destType,
            partner: destType === 'room' ? destPartner.toLowerCase() : destPartner,
            message: null,
            mediaUrl: isMedia ? msg.mediaUrl : null,
            mediaType: isMedia ? msg.mediaType : null,
            mediaFileName: msg._fileName || msg.mediaFileName || null,
            mediaFileSize: msg._fileSize || msg.mediaFileSize || null,
            mediaDuration: msg.mediaDuration || null,
            forwarded: true,
            mediaGroupId: (isMedia && forwardGroupId && ((msg.mediaType || '').startsWith('image/') || (msg.mediaType || '').startsWith('video/'))) ? forwardGroupId : null,
            // Missing meant a forwarded poll's content (still genuinely a
            // poll — recoverDmText below just carries its JSON through like
            // any other text) landed with is_poll unset at the destination,
            // so it rendered as raw JSON there instead of a real poll UI —
            // the render side gates strictly on isPoll, never sniffing
            // content shape. isPollJSON is a safety net for msg.isPoll
            // itself being unset (an older/other gap this session already
            // found and fixed server-side, but a stale client-side copy of
            // that same message could still be missing it).
            isPoll: !!msg.isPoll || isPollJSON(msg.decryptedText) || isPollJSON(msg.message),
          };
          if (isMedia) {
            let mediaKeyB64 = null;
            if (msg.nonce || msg.e2ee) {
              // Source was already client-encrypted (DM or group) — recover the existing
              // per-recipient key and re-wrap it for the new destination, file untouched.
              mediaKeyB64 = recoverMediaKeyB64(msg);
              if (!mediaKeyB64) { failCount++; continue; }
            } else {
              // Source was never client-encrypted (legacy pre-upgrade group media, stored
              // plain) — there's no existing key to recover. Fetch the plain file, encrypt
              // it fresh with a new random key, and re-upload so the destination gets a
              // real E2EE copy instead of a plaintext file dressed up as encrypted.
              try {
                const resolvedUrl = resolveMediaUrl(msg.mediaUrl, API);
                const rawBlob = await fetch(resolvedUrl).then(r => r.blob());
                const enc = await encryptMedia(rawBlob);
                const fd = new FormData();
                fd.append('media', enc.encryptedBlob, msg.mediaFileName || 'file');
                const uploadResp = await fetch(`${API}/api/upload/chat`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: fd
                });
                if (uploadResp.ok) {
                  const uploadData = await uploadResp.json();
                  if (uploadData.url) {
                    body.mediaUrl = uploadData.url;
                    mediaKeyB64 = encodeBase64(enc.mediaKeyBytes);
                  }
                }
              } catch (e) { console.warn('[Forward] media re-encrypt failed', e); }
              if (!mediaKeyB64) { failCount++; continue; }
            }
            if (destType === 'private' && targetPubKey && keyPair) {
              const wrap = encryptDM(mediaKeyB64, targetPubKey, encodeBase64(keyPair.publicKey));
              body.message = wrap.ciphertext;
              body.senderMessage = wrap.senderCiphertext;
              body.nonce = wrap.nonce;
              body.ephemeralPublicKey = wrap.ephemeralPublicKey;
            } else if (destType === 'room' && groupRecipients && groupRecipients.length && keyPair) {
              try {
                const enc = encryptGroupMessage(mediaKeyB64, groupRecipients, keyPair, myUsername);
                body.message = enc.ciphertext;
                body.nonce = enc.nonce;
                body.e2eeKeys = enc.keys;
                body.ephemeralPublicKey = encodeBase64(keyPair.publicKey);
              } catch (e) { console.warn('[Forward] group media re-wrap failed', e); failCount++; continue; }
            } else {
              // Can't securely deliver to this destination — never send an unwrapped key.
              failCount++; continue;
            }
          } else {
            const text = recoverDmText(msg);
            if (text == null) { failCount++; continue; }
            if (destType === 'private' && targetPubKey && keyPair) {
              const enc = encryptDM(text, targetPubKey, encodeBase64(keyPair.publicKey));
              body.message = enc.ciphertext;
              body.senderMessage = enc.senderCiphertext;
              body.nonce = enc.nonce;
              body.ephemeralPublicKey = enc.ephemeralPublicKey;
            } else if (destType === 'room' && groupRecipients && groupRecipients.length && keyPair) {
              try {
                const enc = encryptGroupMessage(text, groupRecipients, keyPair, myUsername);
                body.message = enc.ciphertext;
                body.nonce = enc.nonce;
                body.e2eeKeys = enc.keys;
                body.ephemeralPublicKey = encodeBase64(keyPair.publicKey);
              } catch (e) { console.warn('[Forward] group text re-wrap failed', e); failCount++; continue; }
            } else {
              // Can't securely deliver to this destination — never send plaintext.
              failCount++; continue;
            }
          }
          const resp = await fetch(`${API}/api/chats/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
          });
          if (!resp.ok) failCount++;
        } catch (e) { console.error('[Forward] send failed', e); failCount++; }
      }
    }
    setForwarding(false);
    setForwardPickerOpen(false);
    exitMsgSelectMode();
    if (failCount > 0) toast.error(`${failCount} message(s) could not be forwarded.`);
    else toast.success('Forwarded');
  };

  const buildMediaItems = (msgs) => msgs.map(m => {
    const mt = m.mediaType || '';
    if (!mt.startsWith('image/') && !mt.startsWith('video/')) return null;
    const msgKey = String(m.id || m.timestamp);
    const url = decryptedMediaUrls.current[msgKey] || m._localMediaUrl ||
      ((m.mediaUrl && m.mediaUrl.startsWith('blob:')) ? m.mediaUrl : (m.nonce ? null : m.mediaUrl));
    const mUserLower = myUsername?.toLowerCase();
    const isMe = m.isMe || (m.senderName && m.senderName.toLowerCase() === mUserLower) || (m.username && m.username.toLowerCase() === mUserLower);
    return url ? { url, type: mt, id: m.id || m.tempId, isMe, expiresAt: m.mediaExpiresAt, filename: m._fileName || m.mediaFileName || null } : null;
  }).filter(Boolean);

  const openLightbox = (url, type) => {
    const items = buildMediaItems(messages);
    const idx = items.findIndex(i => i.url === url);
    setLightbox({ items: items.length ? items : [{ url, type }], index: idx >= 0 ? idx : 0 });
  };

  const handleLightboxDelete = (item, mode) => {
    if (!item?.id) return;
    handleDeleteMessage(item.id, mode);
    setLightbox(null);
  };

  const perms = activeChat?.permissions || roomPermissions;
  // isRoomHost is "am I the host of whatever real Room I currently have open"
  // (a prop from Room.jsx) — meaningless for the SahaPlay announcements group,
  // which isn't a real room at all, so ORing it in there would wrongly unlock
  // posting for any user who merely happens to host their own room elsewhere.
  const isHost = isSahaplayOfficialGroup(activeChat) ? !!activeChat?.isHost : (activeChat?.isHost || isRoomHost);
  // The mandatory SahaPlay announcements group has no permissions object of
  // its own (it's not a real room) — always locked here, same as a
  // perms.chat==='host' room; isHost (backend-computed true for
  // admin/super_admin viewing this group, see /api/chats/recent) unlocks it
  // for them via the same !isHost checks every other host-only room uses.
  const chatLocked = perms?.chat === 'host' || isSahaplayOfficialGroup(activeChat);
  const linksBlocked = perms?.allowLinks === false;
  const mediaBlocked = perms?.allowMedia === false;

  // Chat bubble "Customize" theme for whichever conversation is open. Always
  // lowercased — RoomChatPanel.jsx (a second, independent chat UI reachable
  // from within a room) computes the same private-chat chatKey as
  // dmTarget.toLowerCase(), so a theme set from either surface has to land on
  // the identical map key for the other to see it too.
  // Gated on view === 'chat' too, not just activeChat — handleBackToList()
  // deliberately only flips `view` back to 'list' without clearing
  // activeChat (see its own comment), so activeChat still points at the
  // chat you just left. Without this gate, that chat's theme/wallpaper kept
  // resolving (and its backdrop kept rendering, see activeWallpaper's usage
  // below) behind the plain Conversations list too, which is the "theme
  // leaks outside of chat" bug — a theme must only ever be visible while
  // that specific chat is actually the thing on screen.
  const activeChatKey = (activeChat && view === 'chat') ? (activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner)?.toLowerCase() : null;
  const activeThemeId = activeChatKey ? (chatThemes[activeChatKey] || 'default') : 'default';
  // wp- ids (see chatThemes.js) share this same storage slot as the plain
  // gradient CHAT_THEMES ids above — a full-chat background image instead of
  // just a sent-bubble gradient, so it's resolved from a separate list.
  const activeWallpaper = findWallpaper(activeThemeId);
  const activeTheme = activeWallpaper ? null : (CHAT_THEMES.find(th => th.id === activeThemeId) || CHAT_THEMES[0]);
  const isCustomTheme = activeThemeId !== 'default';
  // Both bubble kinds derive their look from the SAME extracted color instead
  // of hardcoding white text everywhere — the sent bubble's own background
  // IS wallpaperColor, so its darkness is the exact right signal for that
  // bubble's text; the received bubble is a neutral frosted panel (not an
  // attempt to match the image's color, WhatsApp doesn't do that either) but
  // picking dark-panel-vs-light-panel off the same signal keeps both bubbles
  // reading as one coherent "dark theme" or "light theme" pick per wallpaper.
  // Zen Interior's dominant-color sample sits right on the light/dark
  // threshold and was occasionally coming out "dark", forcing white sent-
  // message text onto this wallpaper's own light bubble fill — unreadable
  // white-on-white. Forced to the light branch for this one wallpaper
  // specifically: always black sent-message text on it, in both app
  // light and dark mode, not a flaky per-image heuristic.
  const activeWallpaperIsZen = activeWallpaper?.id === 'wp-zen-interior';
  const wallpaperIsDark = activeWallpaperIsZen ? false : isRgbColorDark(wallpaperColor);
  const wallpaperTextColor = wallpaperIsDark ? '#ffffff' : '#111111';
  // Opaque enough to never look "transparent" over a busy/bright patch of the
  // photo, plus backdrop-blur (applied at the bubble itself, see below) so
  // whatever detail still shows through reads as frosted glass, not a raw see-
  // through rectangle — this replaces the old flat rgba(255,255,255,0.14),
  // which was too faint to register as a bubble at all against a bright image.
  const wallpaperReceivedBg = wallpaperIsDark ? 'rgba(24,24,24,0.62)' : 'rgba(255,255,255,0.70)';
  // User asked directly: on Zen Interior, a sent bubble should look like a
  // received one (the soft frosted panel) instead of the bold opaque
  // dominant-color fill sent bubbles normally get — this flag swaps just
  // that bubble's background/blur over to the received branch's values
  // wherever it's checked below, without touching which side it's aligned
  // to or any other isMe-driven behavior.
  const paintSentAsReceived = activeWallpaperIsZen;

  useEffect(() => {
    if (!activeWallpaper) { setWallpaperColor(null); return; }
    let cancelled = false;
    getWallpaperDominantColor(activeWallpaper).then(c => { if (!cancelled) setWallpaperColor(c); });
    return () => { cancelled = true; };
  }, [activeWallpaper]);
  // Separate from the above: the sheet can be open for a conversation that
  // isn't the one currently on screen (opened from a list row's "..." menu),
  // so its "currently selected" swatch is computed from themeSheetTarget, not
  // activeChat.
  const sheetChatKey = themeSheetTarget ? (themeSheetTarget.type === 'room' ? (themeSheetTarget.partner || themeSheetTarget.id) : themeSheetTarget.partner)?.toLowerCase() : null;
  const sheetThemeId = sheetChatKey ? (chatThemes[sheetChatKey] || 'default') : 'default';

  // The category filter pills' active-state color is a flat purple,
  // independent of whichever chat theme is applied — keeps the sheet's
  // own filter UI visually consistent regardless of theme selection.
  const sheetFilterAccent = '#a855f7';

  // Pull-to-refresh, scoped to the conversation LIST only — dragging down
  // while an actual conversation is open (view === 'chat') must never
  // trigger this: that's exactly the gesture used to scroll toward older
  // messages, and it isn't "refresh the page" territory at all.
  const ptr = usePullToRefresh({
    disabled: view !== 'list',
  });

  // This widget sits on top of Home/PublicRooms/PinnedRooms without
  // unmounting them whenever it's open — block their own window-scroll
  // pull-to-refresh for as long as that's the case (see pullToRefreshGate.js).
  useEffect(() => {
    if (!isOpen) return undefined;
    blockPullToRefresh();
    return () => unblockPullToRefresh();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={wrapperRef} style={{ display: hiddenByProfileRoute ? 'none' : 'contents' }}>
      <style>{typingCss}</style>
      <div ref={ptr.indicatorRef} style={{
        position: 'fixed', top: 'calc(10px + var(--sp-status-bar-inset, 0px) + env(safe-area-inset-top))',
        left: '50%', transform: 'translate(-50%, -44px)', opacity: 0,
        width: 38, height: 38, borderRadius: '50%',
        background: isLight ? '#ffffff' : '#1c1c1e',
        boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.18)' : '0 4px 16px rgba(0,0,0,0.5)',
        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000001, pointerEvents: 'none',
      }}>
        <span ref={ptr.iconRef} style={{ display: 'flex', transformOrigin: 'center' }}>
          <RefreshCw size={17} color="var(--brand-1)" />
        </span>
      </div>
      <style>{`@keyframes ptr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    {/* In-widget notice banner — portalled above the widget's own high z-index so it's
        never hidden behind it (unlike a page-level react-hot-toast). */}
    {inlineNotice && createPortal(
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000000, background: 'rgba(20,20,20,0.94)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.45)', maxWidth: '85%', textAlign: 'center', pointerEvents: 'none' }}>
        {inlineNotice}
      </div>,
      document.body
    )}
    {/* ── Chat Lock Screen overlay ── */}
    {showLockScreen && pendingLockedChat && (
      <ChatLockScreen
        chatKey={(pendingLockedChat.id || pendingLockedChat.partner || '').toLowerCase()}
        chatName={pendingLockedChat.displayName || pendingLockedChat.partner}
        action="unlock"
        onUnlock={handleChatUnlock}
        onClose={() => { setShowLockScreen(false); setPendingLockedChat(null); }}
      />
    )}
    {bulkUnlockPending && (
      <ChatLockScreen
        chatKey="bulk_unlock"
        chatName={`${selectedChats.length} selected chats`}
        action="unlock"
        onUnlock={() => {
          setLockedChats(prev => {
            const next = prev.filter(k => !selectedChats.map(s => s.toLowerCase()).includes(k.toLowerCase()));
            localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(next));
            window.dispatchEvent(new Event('locked_chats_updated'));
            return next;
          });
          toast.success(`Unlocked ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''}`);
          setSelectedChats([]);
          setSelectMode(false);
          setBulkUnlockPending(false);
        }}
        onClose={() => setBulkUnlockPending(false)}
      />
    )}
    {vaultUnlockPending && (
      <ChatLockScreen
        chatKey="vault"
        chatName="Locked Chats Vault"
        action="unlock"
        onUnlock={() => {
          unlockedSessionsRef.current['vault'] = Date.now();
          // Reset security attempts for this user upon any successful vault/chat unlock
          const storageKey = `chat_lock_state_${myUsername}`;
          localStorage.setItem(storageKey, JSON.stringify({ attempts: 0, blockedUntil: null }));
          setVaultUnlockPending(false);
          setShowLockedChats(true);
        }}
        onClose={() => setVaultUnlockPending(false)}
      />
    )}
    {showPinSetup && (
      <PinSetupModal
        onClose={() => setShowPinSetup(false)}
        onSuccess={() => {
          setChatLockEnabled(true);
          setShowPinSetup(false);
          if (setupTrigger === 'vault') {
            setShowLockedChats(true);
          } else if (setupTrigger?.chat) {
            // After setup, automatically lock the chat silently
            handleSilentLock(setupTrigger.chat);
          }
          setSetupTrigger(null);
        }}
      />
    )}
    {lockToggleTarget && (
      <ChatLockScreen
        chatKey={(lockToggleTarget.chat.id || lockToggleTarget.chat.partner || '').toLowerCase()}
        chatName={lockToggleTarget.chat.displayName || lockToggleTarget.chat.partner}
        action={lockToggleTarget.action}
        onClose={() => setLockToggleTarget(null)}
        onToggleSuccess={(isLocked) => {
          const key = (lockToggleTarget.chat.id || lockToggleTarget.chat.partner || '').toLowerCase();
          setLockedChats(prev => {
            const next = isLocked ? [...new Set([...prev, key])] : prev.filter(k => k !== key);
            localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(next));
            window.dispatchEvent(new Event('locked_chats_updated'));
            return next;
          });
          if (!isLocked) delete unlockedSessionsRef.current[key];
          toast.success(isLocked ? 'Chat locked' : 'Chat unlocked');
          setLockToggleTarget(null);
        }}
      />
    )}
    {/* ── Forgot PIN Modal ── */}
    {showForgotPin && (
      <ForgotPinModal
        onClose={() => setShowForgotPin(false)}
        onSuccess={() => { setShowForgotPin(false); }}
      />
    )}
    <style dangerouslySetInnerHTML={{ __html: typingCss }} />
    {deleteChatPending && createPortal(
      <div
        onMouseDown={e => e.stopPropagation()}
        className="chat-modal-overlay"
        style={{
          position: 'fixed', inset: 0, zIndex: 1000000,
          background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.85)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 32, padding: 32,
            width: '100%', maxWidth: 380,
            boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column', gap: 20,
            animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="chat-modal-box"
        >
          {/* Header Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Trash2 size={22} color="#ef4444" />
            </div>
            <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Delete Chat?</h3>
          </div>

          <p style={{ color: isLight ? '#475569' : '#aaa', fontSize: 15, lineHeight: 1.4, margin: 0 }}>
            Are you sure you want to delete your chat history? This action is permanent and cannot be undone.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={() => setDeleteChatPending(null)}
              className="modal-btn-transition"
              style={{
                padding: '14px 28px', background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)', 
                border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff',
                cursor: 'pointer', fontWeight: 800, borderRadius: 18, fontSize: 15
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => { deleteChat(deleteChatPending); setDeleteChatPending(null); }}
              className="modal-btn-transition danger-red-btn stay-white"
              style={{
                padding: '14px 36px', background: '#ef4444', border: 'none',
                borderRadius: 18, color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 15, 
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)'
              }}
            >
              <span className="stay-white" style={{color: '#fff'}}>Delete</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {/* Reactors sheet — tapping an existing reaction pill shows who reacted
        with that emoji (Instagram-style), self first with a tap-to-remove
        row instead of the pill itself re-toggling the reaction. See
        RoomChatPanel's identical sheet for the full reasoning. */}
    {reactorsSheet && createPortal(
      // reactors-sheet-overlay: registered in App.jsx's light-mode fixed-
      // overlay override list (see that rule's own comment) — without it,
      // this translucent scrim got forced to a solid pale background in
      // light mode instead of dimming the chat behind it.
      <div onClick={() => setReactorsSheet(null)} className="reactors-sheet-overlay" style={{position:'fixed',inset:0,zIndex:1000000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-end',justifyContent:'center',animation:'fadeIn 0.15s ease'}}>
        <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:460,maxHeight:'65vh',display:'flex',flexDirection:'column',background: isLight ? '#fff' : '#1c1c1e',borderTopLeftRadius:20,borderTopRightRadius:20,boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',animation:'reactorsSlideUp 0.2s cubic-bezier(0.22,1,0.36,1)'}}>
          <div style={{display:'flex',justifyContent:'center',padding:'10px 0 6px'}}>
            <div style={{width:36,height:4,borderRadius:2,background: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'}} />
          </div>
          <div style={{padding:'4px 20px 14px',fontWeight:800,fontSize:16,color: isLight ? '#0f172a' : '#fff',textAlign:'center',borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.08)'}}>
            Reactions
          </div>
          <div className="no-scrollbar" style={{overflowY:'auto',padding:'6px 8px'}}>
            {(() => {
              const selfUid = reactorsSheet.users.find(u => (u||'').toLowerCase() === myUsername.toLowerCase());
              const orderedUids = selfUid ? [selfUid, ...reactorsSheet.users.filter(u => u !== selfUid)] : reactorsSheet.users;
              return orderedUids.map(uid => {
                const uLower = (uid || '').toLowerCase();
                const isSelf = uLower === myUsername.toLowerCase();
                const isBlocked = !isSelf && (blockingMe.some(u => String(u||'').toLowerCase() === uLower) || blockedChats.some(u => String(u||'').toLowerCase() === uLower));
                const fromMsg = messages.find(m => (isSelf ? m.isMe : ((m.senderName||m.username||'').toLowerCase() === uLower)) && m.senderAvatar);
                let displayName = isSelf ? 'You' : (isBlocked ? 'User' : (fromMsg?.senderName || fromMsg?.username || (activeChat?.type === 'private' && (activeChat.partner||'').toLowerCase() === uLower ? activeChat.partner : uid)));
                // Our OWN messages never carry a senderAvatar (see myAvatarUrl's
                // own comment — same gap this sheet had for poll-vote avatars),
                // so fromMsg?.senderAvatar is always empty for isSelf and this
                // row fell through to plain initials even when the viewer has a
                // real avatar set. myAvatarUrl (fetched once at mount) is the
                // fix, same source resolveAvatar already uses for poll votes.
                let avatarPath = isBlocked ? null : (fromMsg?.senderAvatar || (activeChat?.type === 'private' && (activeChat.partner||'').toLowerCase() === uLower ? activeChat.partnerAvatar : null));
                const avatarSrc = isBlocked ? null : (isSelf ? (myAvatarUrl || getAvatarUrl(avatarPath)) : getAvatarUrl(avatarPath));
                return (
                  <div
                    key={uid}
                    onClick={() => { if (isSelf) { handleReact(reactorsSheet.msgId, reactorsSheet.emoji); setReactorsSheet(null); } }}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,cursor: isSelf ? 'pointer' : 'default'}}
                    onMouseEnter={isSelf ? (e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)') : undefined}
                    onMouseLeave={isSelf ? (e => e.currentTarget.style.background = 'transparent') : undefined}
                  >
                    <div style={{ flexShrink:0, width:40, height:40, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:getAvatarColor(displayName) }}>
                      {avatarSrc ? (<img src={avatarSrc} alt={displayName} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/>) : (<span className="stay-white" style={{color:'#fff',fontSize:13,fontWeight:700}}>{getInitials(displayName)}</span>)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color: isLight ? '#0f172a' : '#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{displayName}</div>
                      {isSelf && <div style={{fontSize:12,color: isLight ? '#64748b' : '#9ca3af'}}>Tap to remove</div>}
                    </div>
                    <span style={{fontSize:20,flexShrink:0}}>{reactorsSheet.emoji}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>,
      document.body
    )}
    <div ref={containerRef} className={`chat-widget-main-panel${transparentMode ? ' gcw-force-dark' : ''}`} style={{
        position: 'fixed',
        top: transparentMode ? 0 : 80,
        right: transparentMode ? 0 : 20,
        // transparentMode used to pin only top/right/bottom and size itself
        // with an explicit width — three sides pinned, one derived. Every
        // OTHER keyboard-tracking fixed panel in this codebase (the mobile
        // media query just below, Room.jsx's own mobile root) uses the same
        // proven shape instead: all FOUR sides pinned to 0 with BOTH width
        // and height left to 'auto', so the browser has nothing to derive —
        // it just fills whatever the real current viewport is on every
        // resize. transparentMode was the one place still doing it the
        // partial way, and that's what was leaving it not actually tracking
        // the keyboard: the message box sitting stranded above a gap instead
        // of right on top of it. left:0 + width:'auto' here matches that
        // proven shape exactly (the 400px cap wasn't buying anything extra
        // on the phone screens this mode is actually used on — 100vw was
        // already narrower than 400px there).
        left: transparentMode ? 0 : undefined,
        // A fixed 380px width anchored `right` pushed this off the LEFT
        // edge of the screen on any device narrower than ~400-420px — most
        // phones. min()/calc() cap the width to whatever actually fits
        // (leaving a matching 20px gap on the left, same as the existing
        // right gap) instead of a fixed size that only ever worked on wide
        // desktop viewports.
        width: transparentMode ? 'auto' : 'min(380px, calc(100vw - 40px))',
        bottom: transparentMode ? 0 : undefined,
        height: transparentMode ? 'auto' : 'calc(100vh - 100px)',
        background: transparentMode ? 'transparent' : '#0a0a0a',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: transparentMode ? 'none' : '0 20px 50px rgba(0,0,0,0.5)',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        zIndex: 10000,
        overflow: 'hidden',
        borderRadius: transparentMode ? 0 : 32,
        // A wallpaper/chat theme is meant to fill this panel edge-to-edge —
        // this 1px frame was still drawn on top of it regardless (and in
        // light mode App.jsx's global [style*="border: 1px solid rgba(255,
        // 255, 255"] rule recolors it to a light grey, rgba(0,0,0,0.1)),
        // reading as a thin white-ish line around the whole chat. Same fix
        // as RoomChatPanel.jsx's #room-chat-panel.
        border: (transparentMode || activeWallpaper) ? 'none' : '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        // NOT `transition: all` — this used to also animate height/width/top/
        // right, which meant every on-screen-keyboard resize (the mobile
        // media query's height:100dvh recalculating as the keyboard slides
        // in/out) got dragged through this same 0.4s overshoot easing. Since
        // the panel's background is opaque, that just looked like a stray
        // flash of the page behind it for the transition's duration — most
        // visible in dark mode against the page's lighter chrome. Only the
        // purely cosmetic properties need to animate.
        transition: 'border-radius 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Shared wallpaper backdrop — spans the messages area AND the
            composer bar below it as ONE continuous image (negative z-index
            keeps it behind all normal-flow content in this panel without
            needing to restructure the message-list/composer DOM). Both of
            those containers go background:transparent when a wallpaper is
            active (see below) so this single layer shows through both,
            instead of the composer painting its own opaque bar on top of
            the picture like a separate panel glued on. */}
        {activeWallpaper && (
          <div className="chat-wallpaper-backdrop" style={{
            // Stays position:absolute + inset:0 inside the panel, clipped by
            // its own overflow:hidden (a position:fixed version was tried —
            // it escapes overflow:hidden entirely, since fixed positioning
            // is computed against the viewport rather than the ancestor, and
            // on the room-chat equivalent of this same backdrop that let the
            // wallpaper paint straight through the surrounding chrome —
            // reverted here too before the same bug could surface here).
            // The panel's own inset:0 box shrinking when the keyboard opened
            // used to recompute the background-size:cover crop against a
            // shorter box, reading as the wallpaper sliding upward — fixed
            // by giving this an explicit height from useStableViewportHeight
            // (window.innerHeight, clamped to the largest value ever seen,
            // known synchronously on first paint) instead of tracking the
            // panel's live height, so there's nothing to catch up on even on
            // a fast keyboard open/close (e.g. a swipe-back gesture while
            // the composer is focused).
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, pointerEvents: 'none',
            // Unconditional (not gated on isMobileOrTablet) — matches the
            // room-chat equivalent of this same backdrop exactly, which
            // applies its explicit height regardless of viewport width.
            // minHeight:'100%' alongside it — the explicit height alone can
            // leave the panel's own (white in light mode, so visible as a
            // thin line/border; invisible in dark mode) background peeking
            // through at the bottom edge whenever the live container is
            // taller than the largest-ever-seen snapshot the height is
            // clamped to. min-height always wins over a smaller height per
            // spec, so this guarantees full coverage without touching the
            // anti-shrink behavior the explicit height exists for.
            minHeight: '100%',
            ...(stableViewportHeight ? { height: stableViewportHeight } : {}),
            backgroundImage: `linear-gradient(rgba(0,0,0,0.38),rgba(0,0,0,0.38)), url("${activeWallpaper.image}")`,
            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            // Promotes this into its own GPU compositor layer, rasterized once
            // and then just repositioned — not re-rasterized — on every layout
            // pass its ancestors go through. Real Android WebViews
            // (adjustResize) genuinely shrink window.innerHeight when the
            // on-screen keyboard opens, re-running layout on this whole
            // subtree; without its own layer, a large cover-image + gradient
            // like this is expensive enough to repaint on a mid/low-end
            // device that a dropped frame mid-transition can read as the
            // header/composer visibly glitching, even though this element's
            // own box (per its fixed height above) never actually changes.
            willChange: 'transform',
            transform: 'translateZ(0)',
          }} />
        )}
        {/* Lightbox portal — fixed overlay above everything */}
        {lightbox && createPortal(
          <MediaLightbox
            items={lightbox.items}
            index={lightbox.index}
            onClose={() => setLightbox(null)}
            onPrev={() => setLightbox(lb => lb ? { ...lb, index: Math.max(0, lb.index - 1) } : null)}
            onNext={() => setLightbox(lb => lb ? { ...lb, index: Math.min(lb.items.length - 1, lb.index + 1) } : null)}
            onDeleteItem={handleLightboxDelete}
          />,
          document.body
        )}
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '16px 20px',
          // env(safe-area-inset-top) was here as a fallback for non-Capacitor
          // contexts (PWA/TWA/plain browser), but a plain mobile Chrome tab
          // can report a real nonzero value for it (matching the device's
          // notch/cutout) even though this panel has nothing to clear —
          // reserving that much empty, see-through padding-top left a
          // theme-colored gap (the page's own --bg-color showing through the
          // transparent header) between the URL bar and this panel's own
          // header. --sp-status-bar-inset (native only) still applies
          // normally; every other context just gets flat 16px, matching how
          // the rest of the app (Room's own header, Navbar) already does it.
          paddingTop: 'calc(16px + var(--sp-status-bar-inset, 0px))',
          // A per-chat wallpaper's backdrop image sits behind this whole
          // panel (see activeWallpaper's z-index:-1 layer below), including
          // the area under this header — the header's own background here
          // MUST stay solid whenever a wallpaper is active, or the name/
          // call icons/3-dots read as "transparent" with the wallpaper
          // showing through them. transparentMode's normal translucent look
          // only applies when there's no wallpaper to protect against.
          // Flat, literal match to the panel's own #0a0a0a background (not a
          // translucent black tint stacked on top of it) — a semi-transparent
          // overlay compositing against the exact same solid color underneath
          // should in theory read identically, but in practice (blend order,
          // this element's own stacking context) it was landing as a visibly
          // different shade from the plain list/message areas right below it.
          // A literal value removes any room for that mismatch.
          background: activeWallpaper ? 'rgba(10,10,10,0.94)' : (transparentMode ? 'transparent' : '#0a0a0a'),
          borderBottom: activeWallpaper ? '1px solid rgba(255,255,255,0.08)' : (transparentMode ? 'none' : '1px solid rgba(255,255,255,0.06)')
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {view === 'chat' && (
              <button onClick={handleBackToList} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                <ArrowLeft size={20} />
              </button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
            <span
              className="chat-header-title"
              style={{
                fontWeight: 600, fontSize: '1.1rem',
                color: 'var(--header-text)',
                textDecoration: 'none',
                cursor: view === 'chat' && (activeChat?.type === 'private' || (activeChat?.type === 'room' && !isSahaplayOfficialGroup(activeChat))) ? 'pointer' : 'default',
                display: 'block',
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
              onClick={() => {
                if (view === 'chat' && activeChat?.type === 'private' && activeChat?.partner) {
                  const partner = activeChat.partner.toLowerCase();
                  const isBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner);
                  if (!isBlocked) {
                    leaveChatToViewProfile(activeChat.partner);
                  }
                } else if (view === 'chat' && activeChat?.type === 'room' && !isSahaplayOfficialGroup(activeChat)) {
                  // The mandatory SahaPlay announcements group (see
                  // isSahaplayOfficialGroup) is a reserved chat-only bulletin,
                  // not a real joinable video room — it has no actual Room.jsx
                  // page behind it. Reaching this navigate() for it opened
                  // Room.jsx anyway (it happily renders an empty room shell
                  // for any roomId), which read as "tapping the channel name
                  // dumps me into a broken video-call room." Excluding it here
                  // makes the title inert for this one chat instead.
                  // Room.jsx's own mount-time logic (membership/approval/
                  // password/ban checks, same as every other "open a room"
                  // entry point — Dashboard's join-by-code, PublicRooms,
                  // PinnedRoomsGrid) is what actually enforces whatever the
                  // host has configured; this click has no business
                  // pre-checking any of that itself.
                  //
                  // Unlike leaveChatToViewProfile (which deliberately leaves
                  // this widget open/hidden behind the profile route — see
                  // hiddenByProfileRoute — so it's exactly as you left it on
                  // return), this widget needs to actually CLOSE here: since
                  // /room/:roomId has no key, Room.jsx (and the copy of this
                  // widget it renders) doesn't remount across a room-to-room
                  // navigation, so gcwLevel's already-pushed history entries
                  // would otherwise dangle underneath this navigate()'s own
                  // history entry. A later, unrelated in-app close of this
                  // widget or of the room's own media-selector modal (each a
                  // separate useBackIntercept instance) would then call
                  // history.go() for a step count computed before this
                  // navigation happened, overshooting it and landing back on
                  // a stale pre-navigation URL — the exact "uploading media
                  // exits the room" bug this fixes. skipNextClose(), called
                  // before the close actually drops gcwLevel, makes the hook
                  // leave its own pushed entries inert instead of physically
                  // consuming them here, so nothing races this navigate()'s
                  // own pushState.
                  const roomId = activeChat.partner || activeChat.id;
                  if (roomId) {
                    gcwBack.skipNextClose();
                    onClose && onClose();
                    navigate(`/room/${roomId}`);
                  }
                }
              }}
              title={view === 'chat' && activeChat?.type === 'private' ? ((blockingMe.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase()) || blockedChats.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase())) ? 'Blocked User' : `Go to ${activeChat?.partner}'s profile`) : (view === 'chat' && activeChat?.type === 'room' ? `Go to ${activeChat?.displayName || 'room'}` : '')}
            >
              {view === 'list' ? t('conversations', 'Conversations') : (activeChat?.type === 'private' && (blockingMe.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase()) || blockedChats.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase())) ? t('user', 'User') : activeChat?.displayName)}
            </span>
            {view === 'chat' && activeChat?.type === 'private' && onlineUsers.has((activeChat.partner || '').toLowerCase()) && (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#22c55e' }}>{t('online', 'Online')}</span>
            )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {view === 'chat' && activeChat?.type === 'private' && (() => {
              const partnerLower = (activeChat.partner || '').toLowerCase();
              const isBlocked = blockingMe.some(u => u.toLowerCase() === partnerLower) || blockedChats.some(u => u.toLowerCase() === partnerLower);
              if (isBlocked) return null;
              const busy = !!call.callState;
              const callBtnStyle = {
                background: 'transparent', border: 'none', color: busy ? 'var(--header-btn)' : 'var(--header-btn)',
                opacity: busy ? 0.4 : 1, cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, padding: 0, borderRadius: '50%', transition: 'all 0.2s',
              };
              return (
                <>
                  <button
                    onClick={() => { if (busy) return; if (!canMakeCalls) { setShowCallInstallPrompt(true); return; } call.startCall(activeChat.partner, 'voice', activeChat.displayName, activeChat.partnerAvatar); }}
                    disabled={busy}
                    title={t('voiceCall', 'Voice call')}
                    style={callBtnStyle}
                    onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--header-btn)'; }}
                  >
                    {/* Confirmed on-device: Phone's solid handset silhouette carries
                        more visual weight than Video's outlined rect+lens at the same
                        numeric size, so it reads bigger even though the bounding boxes
                        are identical — sized down slightly to actually match. */}
                    <Phone size={18} strokeWidth={2.1} />
                  </button>
                  <button
                    onClick={() => { if (busy) return; if (!canMakeCalls) { setShowCallInstallPrompt(true); return; } call.startCall(activeChat.partner, 'video', activeChat.displayName, activeChat.partnerAvatar); }}
                    disabled={busy}
                    title={t('videoCall', 'Video call')}
                    style={callBtnStyle}
                    onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--header-btn)'; }}
                  >
                    <Video size={20} strokeWidth={2.1} />
                  </button>
                </>
              );
            })()}
            {view === 'chat' && activeChat && (
              <div style={{ position: 'relative' }} ref={chatMenuRef}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowChatMenu(!showChatMenu); setActiveMessageMenu(null); }} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--header-btn)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: '50%', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
                >
                  <MoreVertical size={20} />
                </button>
                {showChatMenu && (
                  <div className="nav-dropdown" style={{ 
                    position: 'absolute', right: 0, top: '100%', marginTop: 8, 
                    background: 'var(--dropdown-bg)', 
                    border: '1px solid var(--dropdown-border)', 
                    borderRadius: 10, padding: 4, zIndex: 100000, minWidth: 140, 
                    boxShadow: 'var(--dropdown-shadow)'
                  }}>
                      {/* Desktop-only entry point — hidden below the tablet/mobile breakpoint via
                          the "desktop-only-menu-item" class (see the @media rule near
                          .msg-meta-row); touch users instead long-press a message row's empty
                          side area to enter select mode. */}
                      <button onClick={() => {
                        setMsgSelectMode(true);
                        setSelectedMsgIds(new Set());
                        setShowChatMenu(false);
                      }} className="chat-menu-item menu-btn desktop-only-menu-item"
                      onMouseEnter={() => setHoveredMenuBtn('selectMessages')}
                      onMouseLeave={() => setHoveredMenuBtn(null)}
                      style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='selectMessages' ? 'rgba(59,130,246,0.14)' : 'transparent', border:'none', color: 'var(--menu-item-text)', WebkitTextFillColor: 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                        <SquareCheck size={14}/> {t('selectMessages', 'Select messages')}
                      </button>
                      <button onClick={() => {
                        setThemeSheetTarget(activeChat);
                        setShowThemeSheet(true);
                        setShowChatMenu(false);
                      }} className="chat-menu-item menu-btn"
                      onMouseEnter={() => setHoveredMenuBtn('chatTheme')}
                      onMouseLeave={() => setHoveredMenuBtn(null)}
                      style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='chatTheme' ? 'rgba(59,130,246,0.14)' : 'transparent', border:'none', color: 'var(--menu-item-text)', WebkitTextFillColor: 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                        <Palette size={14}/> {t('chatTheme', 'Chat theme')}
                      </button>
                      {activeChat.type === 'private' && (
                        <>
                          <button onClick={() => {
                            const isBlocked = blockedChats.some(k => k.toLowerCase() === (activeChat.partner || activeChat.id).toLowerCase());
                            if (isBlocked) { toggleBlockChat(activeChat.partner || activeChat.id); } else { setBlockUserPending(activeChat); }
                            setShowChatMenu(false);
                          }} data-hovertype="danger" className="chat-menu-item menu-btn menu-btn-danger"
                          onMouseEnter={() => setHoveredMenuBtn('block')}
                          onMouseLeave={() => setHoveredMenuBtn(null)}
                          style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='block' ? 'rgba(239,68,68,0.12)' : 'transparent', border:'none', color: hoveredMenuBtn==='block' ? '#dc2626' : 'var(--menu-item-text)', WebkitTextFillColor: hoveredMenuBtn==='block' ? '#dc2626' : 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                            <Ban size={14} color={hoveredMenuBtn==='block' ? '#dc2626' : undefined}/> {blockedChats.some(k => k.toLowerCase() === (activeChat.partner || activeChat.id).toLowerCase()) ? t('unblockUser', 'Unblock User') : t('blockUser', 'Block User')}
                          </button>
                          <button onClick={() => { setClearChatModalOpen(activeChat); setClearForBoth(false); setShowChatMenu(false); }}
                          data-hovertype="danger" className="chat-menu-item menu-btn menu-btn-danger"
                          onMouseEnter={() => setHoveredMenuBtn('clearPrivate')}
                          onMouseLeave={() => setHoveredMenuBtn(null)}
                          style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='clearPrivate' ? 'rgba(239,68,68,0.12)' : 'transparent', border:'none', color: hoveredMenuBtn==='clearPrivate' ? '#dc2626' : 'var(--menu-item-text)', WebkitTextFillColor: hoveredMenuBtn==='clearPrivate' ? '#dc2626' : 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                            <Trash2 size={14} color={hoveredMenuBtn==='clearPrivate' ? '#dc2626' : undefined}/> {t('clearChat', 'Clear Chat')}
                          </button>
                        </>
                      )}

                      {activeChat.type === 'room' && (
                        <>
                        <button onClick={() => {
                          if (!activeChat.isHost) { toast.error('Only host can edit this room name'); return; }
                          setRenameInput(activeChat.displayName); setRenameModalOpen(true); setShowChatMenu(false);
                        }} data-hovertype="primary" className="chat-menu-item menu-btn menu-btn-primary"
                        onMouseEnter={() => setHoveredMenuBtn('editName')}
                        onMouseLeave={() => setHoveredMenuBtn(null)}
                        style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='editName' ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent', border:'none', color: hoveredMenuBtn==='editName' ? 'var(--brand-1-dark)' : 'var(--menu-item-text)', WebkitTextFillColor: hoveredMenuBtn==='editName' ? 'var(--brand-1-dark)' : 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                          <Edit2 size={14} color={hoveredMenuBtn==='editName' ? 'var(--brand-1-dark)' : undefined}/> {t('editName', 'Edit Name')}
                        </button>
                        <button onClick={() => { setClearGroupChatModalOpen(activeChat); setShowChatMenu(false); }}
                        data-hovertype="danger" className="chat-menu-item menu-btn menu-btn-danger"
                        onMouseEnter={() => setHoveredMenuBtn('clearRoom')}
                        onMouseLeave={() => setHoveredMenuBtn(null)}
                        style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='clearRoom' ? 'rgba(239,68,68,0.12)' : 'transparent', border:'none', color: hoveredMenuBtn==='clearRoom' ? '#dc2626' : 'var(--menu-item-text)', WebkitTextFillColor: hoveredMenuBtn==='clearRoom' ? '#dc2626' : 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                          <Trash2 size={14} color={hoveredMenuBtn==='clearRoom' ? '#dc2626' : undefined}/> {t('clearChat', 'Clear Chat')}
                        </button>
                        </>
                      )}
                      
                    </div>
                )}
              </div>
            )}
            {/* Global 3-dots menu — always visible in list view */}
            {view === 'list' && (
              <div style={{ position: 'relative' }} ref={globalMenuRef}>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    const next = !showGlobalMenu;
                    setShowGlobalMenu(next);
                    if (next) {
                      setShowSelectionMenu(false);
                      setActiveConvMenu(null);
                      setShowVaultMenu(false);
                    }
                  }}
                  style={{
                    background: 'transparent', border: 'none',
                    color: showGlobalMenu ? 'var(--header-text)' : 'var(--header-btn)',
                    cursor: 'pointer', display: 'flex',
                    padding: '4px', borderRadius: '50%',
                    transition: 'all 0.18s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--header-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = showGlobalMenu ? 'var(--header-text)' : 'var(--header-btn)'; }}
                  title="More options"
                >
                  <MoreVertical size={20} />
                </button>
                {showGlobalMenu && (
                  <div className="nav-dropdown" style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    background: 'var(--dropdown-bg)',
                    border: '1px solid var(--dropdown-border)',
                    borderRadius: 12, padding: '6px',
                    minWidth: 185,
                    boxShadow: 'var(--dropdown-shadow)',
                    zIndex: 99999,
                    display: 'flex', flexDirection: 'column', gap: 2
                  }}>
                      {/* Locked chats — shows count badge when there are locked chats */}
                      <button
                        onClick={() => {
                          setShowGlobalMenu(false);
                          if (showLockedChats) {
                            setShowLockedChats(false);
                          } else {
                            if (!chatLockEnabled) {
                              setSetupTrigger('vault');
                              setShowPinSetup(true);
                            } else {
                              setVaultUnlockPending(true);
                            }
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 8, border: 'none',
                          background: showLockedChats ? 'rgba(var(--brand-1-rgb),0.12)' : 'transparent',
                          width: '100%', textAlign: 'left',
                          fontSize: '0.85rem', color: showLockedChats ? 'var(--brand-1-light)' : 'var(--menu-item-text)',
                          cursor: 'pointer', transition: 'background 0.18s'
                        }}
                        className="chat-menu-item"
                      >
                        {showLockedChats ? <Unlock size={16} color="var(--brand-1-light)" /> : <Lock size={16} color="var(--menu-icon)" />}
                        <span style={{ flex: 1 }}>{showLockedChats ? t('closeVault', 'Close vault') : t('lockedChatsTitle', 'Locked chats')}</span>
                        {lockedChats.length > 0 && (
                          <span className="unread-badge stay-white" style={{
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.65rem', fontWeight: 800,
                            padding: '1px 6px', borderRadius: 10, minWidth: 18, 
                            textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}>{lockedChats.length}</span>
                        )}
                      </button>
                      {/* Hidden chats — shows count badge when there are hidden chats */}
                      <button
                        onClick={() => {
                          setShowHiddenChats(v => !v);
                          setShowGlobalMenu(false);
                          setShowLockedChats(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 8, border: 'none',
                          background: showHiddenChats ? 'rgba(var(--brand-1-rgb),0.12)' : 'transparent',
                          width: '100%', textAlign: 'left',
                          fontSize: '0.85rem', color: showHiddenChats ? 'var(--brand-1-light)' : 'var(--menu-item-text)',
                          cursor: 'pointer', transition: 'background 0.18s'
                        }}
                        className="chat-menu-item"
                      >
                        <EyeOff size={16} color={showHiddenChats ? 'var(--brand-1-light)' : 'var(--menu-icon)'} />
                        <span style={{ flex: 1 }}>{showHiddenChats ? t('backToChats', 'Back to chats') : t('hiddenChatsTitle', 'Hidden chats')}</span>
                        {hiddenChats.length > 0 && (
                          <span className="unread-badge stay-white" style={{
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.65rem', fontWeight: 800,
                            padding: '1px 6px', borderRadius: 10, minWidth: 18, 
                            textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}>{hiddenChats.length}</span>
                        )}
                      </button>
                      <div style={{ height: 1, background: 'var(--menu-divider)', margin: '4px 8px' }} />
                      {/* Mark all as read */}
                      <button
                        onClick={() => {
                          // Zero out all unread counts in GCW's own conversation list
                          setConversations(prev =>
                            (Array.isArray(prev) ? prev : []).map(c => ({ ...c, unread: 0 }))
                          );
                          if (socketRef.current) {
                            socketRef.current.emit('chat:mark_all_read');
                          }
                          // Update last_seen timestamps for all conversations
                          try {
                            const now = Date.now();
                            const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
                            (conversations || []).forEach(c => {
                              const key = (c.id || c.partner || '').toLowerCase();
                              if (key) lastSeen[key] = now;
                            });
                            localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
                            localStorage.setItem('chat_unread_counts', '{}');
                            localStorage.setItem('chat_group_unread', '{}');
                          } catch {}
                          // Notify parent (Room.jsx) to atomically zero all its unread state
                          if (typeof onMarkAllRead === 'function') {
                            onMarkAllRead();
                          } else if (typeof onMarkRead === 'function') {
                            // Fallback: loop through conversations
                            (conversations || []).forEach(c => onMarkRead(c.id || c.partner));
                          }
                          setShowGlobalMenu(false);
                          toast.success('All chats marked as read');
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 8, border: 'none',
                          background: 'transparent', width: '100%', textAlign: 'left',
                          fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer',
                          transition: 'background 0.18s'
                        }}
                        className="chat-menu-item"
                      >
                        <CheckCheck size={16} color="var(--menu-icon)" />
                        {t('markAllAsRead', 'Mark all as read')}
                      </button>
                      {!selectMode && (
                        <>
                          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px' }} />
                          {/* Select chats */}
                          <button
                            onClick={() => {
                              setSelectMode(true);
                              setSelectedChats([]);
                              setShowGlobalMenu(false);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 8, border: 'none',
                              background: 'transparent',
                              width: '100%', textAlign: 'left',
                              fontSize: '0.85rem', color: 'var(--menu-item-text)',
                              cursor: 'pointer', transition: 'background 0.18s'
                            }}
                            className="chat-menu-item"
                          >
                            <SquareCheck size={16} color="var(--menu-icon)" />
                            {t('selectChats', 'Select chats')}
                          </button>
                        </>
                      )}
                    </div>
                )}
              </div>
            )}
            {!isNarrowViewport && (
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Message multi-select bar — overlays the normal header while active */}
        {msgSelectMode && view === 'chat' && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20000,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', paddingTop: 'calc(16px + var(--sp-status-bar-inset, 0px))',
            background: transparentMode ? 'rgba(10,10,10,0.92)' : '#0a0a0a',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={exitMsgSelectMode} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
                <X size={20} />
              </button>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--header-text)' }}>
                {selectedMsgIds.size} {t('selected', 'selected')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <button
                onClick={() => { setSelectedForwardChats([]); setForwardPickerOpen(true); }}
                disabled={selectedMsgIds.size === 0}
                style={{ background: 'transparent', border: 'none', color: selectedMsgIds.size === 0 ? '#444' : 'var(--header-text)', cursor: selectedMsgIds.size === 0 ? 'default' : 'pointer', display: 'flex' }}
                title="Forward"
              >
                <Forward size={20} />
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={selectedMsgIds.size === 0}
                style={{ background: 'transparent', border: 'none', color: selectedMsgIds.size === 0 ? '#444' : '#ef4444', cursor: selectedMsgIds.size === 0 ? 'default' : 'pointer', display: 'flex' }}
                title="Delete"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div ref={ptr.containerRef} className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {view === 'list' && (
            <div className="chat-list-header" style={{ 
              padding: '16px 20px', 
              position: 'sticky', 
              top: 0,
              // Literal match to the panel's own #0a0a0a — see the top
              // header's identical comment just above in this file.
              background: transparentMode ? 'transparent' : (selectMode ? 'rgba(18, 14, 35, 0.98)' : '#0a0a0a'),
              zIndex: 30,
              // App.jsx's global light-mode CSS turns this div's own
              // background: #0a0a0a into white (matching by literal inline-
              // style substring) but leaves the border-bottom below alone —
              // that border gets its OWN global override (turning it into a
              // visible rgba(0,0,0,0.1) line), so the two together produced
              // a divider line under the search bar in light mode that was
              // never intended to show against a white header.
              borderBottom: (transparentMode || isLight) ? 'none' : '1px solid rgba(255,255,255,0.03)',
              transition: 'background 0.25s',
              backdropFilter: transparentMode ? 'none' : 'blur(10px)'
            }}>
              {selectMode ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '38px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* X to cancel select mode */}
                    <button
                      onClick={() => { setSelectMode(false); setSelectedChats([]); setShowSelectionMenu(false); }}
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#aaa', cursor: 'pointer', display: 'flex',
                        padding: '6px', borderRadius: '50%',
                        transition: 'all 0.18s',
                        marginLeft: '-6px'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa'; }}
                      title="Cancel selection"
                    >
                      <X size={20} />
                    </button>

                    {/* Select All Checkbox */}
                    <button
                      onClick={() => {
                        const visible = conversations.filter(c => {
                          const cId = (c.id || c.partner).toLowerCase();
                          if (showLockedChats) return lockedChats.includes(cId);
                          if (showHiddenChats) return hiddenChats.includes(c.id || c.partner);
                          return !hiddenChats.includes(c.id || c.partner) && !lockedChats.includes(cId);
                        });
                        const visibleKeys = visible.map(c => c.id || c.partner);
                        const isAllSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedChats.includes(k));
                        
                        if (isAllSelected) {
                          setSelectedChats(prev => prev.filter(k => !visibleKeys.includes(k)));
                        } else {
                          setSelectedChats(prev => [...new Set([...prev, ...visibleKeys])]);
                        }
                      }}
                      style={{
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', display: 'flex',
                        padding: '6px', transition: 'all 0.18s'
                      }}
                      title="Select all visible"
                    >
                      {(() => {
                        const visible = conversations.filter(c => {
                          const cId = (c.id || c.partner).toLowerCase();
                          if (showLockedChats) return lockedChats.includes(cId);
                          if (showHiddenChats) return hiddenChats.includes(c.id || c.partner);
                          return !hiddenChats.includes(c.id || c.partner) && !lockedChats.includes(cId);
                        });
                        const visibleKeys = visible.map(c => c.id || c.partner);
                        const isAllSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedChats.includes(k));
                        return isAllSelected ? (
                          <SquareCheck size={20} color="var(--brand-1-light)" fill="rgba(129,140,248,0.1)" />
                        ) : (
                          <Square size={20} color="#444" />
                        );
                      })()}
                    </button>

                    <span style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>
                      {selectedChats.length} {t('selected', 'selected')}
                    </span>
                  </div>

                  {/* 3-dot menu — only visible when at least 1 chat is selected */}
                  {selectedChats.length > 0 && (
                    <div style={{ position: 'relative' }} ref={selectionMenuRef}>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const next = !showSelectionMenu;
                          setShowSelectionMenu(next);
                          if (next) {
                            setShowGlobalMenu(false);
                            setActiveConvMenu(null);
                          }
                        }}
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#aaa', cursor: 'pointer', display: 'flex',
                          padding: '6px', borderRadius: '50%',
                          transition: 'all 0.18s',
                          marginRight: '-6px'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--header-text)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--header-btn)'; }}
                        title="Actions"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {showSelectionMenu && (
                        <div className="nav-dropdown" style={{
                          position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                          background: 'var(--dropdown-bg)',
                          border: '1px solid var(--dropdown-border)',
                          borderRadius: 12, padding: '6px',
                          minWidth: 195,
                          boxShadow: 'var(--dropdown-shadow)',
                          zIndex: 99999,
                          display: 'flex', flexDirection: 'column', gap: 2,
                          animation: 'scaleUp 0.15s cubic-bezier(0.25,0.8,0.25,1)'
                        }}>
                            {/* Mark as read */}
                            <button
                              onClick={() => {
                                selectedChats.forEach(k => markChatAsRead(k, true));
                                setShowSelectionMenu(false);
                                toast.success(`Marked ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''} as read`);
                                setSelectedChats([]);
                                setSelectMode(false);
                              }}
                              className="chat-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.18s' }}
                            >
                              <CheckCheck size={16} color="var(--menu-icon)" />
                              {t('markAsRead', 'Mark as read')}
                            </button>
                            {/* Mute / Unmute notifications */}
                            <button
                              onClick={() => {
                                const allMuted = selectedChats.every(k => mutedChats.includes(k));
                                setMutedChats(prev => {
                                  let next = [...prev];
                                  if (allMuted) {
                                    // Unmute all selected
                                    next = next.filter(k => !selectedChats.includes(k));
                                  } else {
                                    // Mute all selected
                                    selectedChats.forEach(k => {
                                      if (!next.includes(k)) next.push(k);
                                    });
                                  }
                                  localStorage.setItem(`muted_chats_${myUsername}`, JSON.stringify(next));
                                  window.dispatchEvent(new Event('muted_chats_updated'));
                                  return next;
                                });
                                setShowSelectionMenu(false);
                                toast.success(`${allMuted ? 'Unmuted' : 'Muted'} ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''}`);
                                setSelectedChats([]);
                                setSelectMode(false);
                              }}
                              className="chat-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.18s' }}
                            >
                              {selectedChats.every(k => mutedChats.includes(k)) ? (
                                <>
                                  <Bell size={16} color="var(--menu-icon)" />
                                  {t('unmuteNotifications', 'Unmute notifications')}
                                </>
                              ) : (
                                <>
                                  <BellOff size={16} color="var(--menu-icon)" />
                                  {t('muteNotifications', 'Mute notifications')}
                                </>
                              )}
                            </button>
                            {/* Mute / Unmute calls — only offered once at least one
                                selected chat is private (DM); calls have no group-
                                chat concept, so a selection that's entirely rooms
                                never shows this. Any room keys among the selection
                                are simply skipped when applying it. */}
                            {selectedChats.some(k => {
                              const c = conversations.find(cv => (cv.partner || cv.id || '').toLowerCase() === k);
                              return c && c.type !== 'room';
                            }) && (
                              <button
                                onClick={() => {
                                  const privateSelected = selectedChats.filter(k => {
                                    const c = conversations.find(cv => (cv.partner || cv.id || '').toLowerCase() === k);
                                    return c && c.type !== 'room';
                                  });
                                  const allMuted = privateSelected.every(k => mutedCallChats.includes(k));
                                  setMutedCallChats(prev => {
                                    let next = [...prev];
                                    if (allMuted) {
                                      next = next.filter(k => !privateSelected.includes(k));
                                    } else {
                                      privateSelected.forEach(k => {
                                        if (!next.includes(k)) next.push(k);
                                      });
                                    }
                                    localStorage.setItem(`muted_call_chats_${myUsername}`, JSON.stringify(next));
                                    window.dispatchEvent(new Event('muted_call_chats_updated'));
                                    return next;
                                  });
                                  setShowSelectionMenu(false);
                                  toast.success(`${allMuted ? 'Unmuted' : 'Muted'} calls for ${privateSelected.length} chat${privateSelected.length > 1 ? 's' : ''}`);
                                  setSelectedChats([]);
                                  setSelectMode(false);
                                }}
                                className="chat-menu-item"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.18s' }}
                              >
                                {selectedChats.filter(k => {
                                  const c = conversations.find(cv => (cv.partner || cv.id || '').toLowerCase() === k);
                                  return c && c.type !== 'room';
                                }).every(k => mutedCallChats.includes(k)) ? (
                                  <>
                                    <Phone size={16} color="var(--menu-icon)" />
                                    {t('unmuteCalls', 'Unmute calls')}
                                  </>
                                ) : (
                                  <>
                                    <PhoneOff size={16} color="var(--menu-icon)" />
                                    {t('muteCalls', 'Mute calls')}
                                  </>
                                )}
                              </button>
                            )}
                            {/* Lock chats — moves selected chats into the locked
                                vault, same as the per-row "Lock chat" action, just
                                applied to every selection at once. Only offered
                                outside the vault view itself, which already has its
                                own "Unlock selected" below. */}
                            {!showLockedChats && (
                              <button
                                onClick={() => {
                                  setLockedChats(prev => {
                                    const next = [...prev];
                                    selectedChats.forEach(k => {
                                      if (!next.includes(k)) next.push(k);
                                    });
                                    localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(next));
                                    window.dispatchEvent(new Event('locked_chats_updated'));
                                    return next;
                                  });
                                  setShowSelectionMenu(false);
                                  toast.success(`Locked ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''}`);
                                  setSelectedChats([]);
                                  setSelectMode(false);
                                }}
                                className="chat-menu-item"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.18s' }}
                              >
                                <Lock size={16} color="var(--menu-icon)" />
                                {t('lockSelected', 'Lock selected')}
                              </button>
                            )}
                            {/* Unlock chats — only in locked vault */}
                            {showLockedChats && (
                              <button
                                onClick={() => {
                                  setShowSelectionMenu(false);
                                  setBulkUnlockPending(true);
                                }}
                                className="chat-menu-item"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.18s' }}
                              >
                                <Unlock size={16} color="var(--menu-icon)" />
                                {t('unlockSelected', 'Unlock selected')}
                              </button>
                            )}
                            {/* Hide / Unhide chats */}
                            <button
                              onClick={() => {
                                setHiddenChats(prev => {
                                  let next = [...prev];
                                  if (showHiddenChats) {
                                    next = next.filter(k => !selectedChats.includes(k));
                                  } else {
                                    selectedChats.forEach(k => {
                                      if (!next.includes(k)) next.push(k);
                                    });
                                  }
                                  localStorage.setItem(`hidden_chats_${myUsername}`, JSON.stringify(next));
                                  window.dispatchEvent(new Event('hidden_chats_updated'));
                                  return next;
                                });
                                setShowSelectionMenu(false);
                                toast.success(`${showHiddenChats ? 'Unhidden' : 'Hidden'} ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''}`);
                                setSelectedChats([]);
                                setSelectMode(false);
                              }}
                              className="chat-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.18s' }}
                            >
                              {showHiddenChats ? <Eye size={16} color="var(--menu-icon)" /> : <EyeOff size={16} color="var(--menu-icon)" />}
                              {showHiddenChats ? t('unhideChats', 'Unhide chats') : t('hideChats', 'Hide chats')}
                            </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search size={16} color="#666" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    placeholder={t('searchUsers', 'Search users...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 38px',
                      // Literal match to the panel's own #0a0a0a, not the
                      // theme-reactive --input-bg (a faint 4% white tint in
                      // dark mode) — this shell is always dark regardless of
                      // the app's own light/dark setting (see the header's
                      // identical background above), so the theme-reactive
                      // variable was the one visibly different resting-state
                      // background in the whole list view. The border alone
                      // still marks this as an input field.
                      background: '#0a0a0a',
                      border: '1px solid var(--input-border)',
                      borderRadius: 20,
                      color: 'var(--input-text)',
                      fontSize: 13,
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.background = 'var(--menu-item-hover)';
                      e.target.style.borderColor = 'rgba(var(--brand-1-rgb),0.3)';
                    }}
                    onBlur={(e) => {
                      e.target.style.background = '#0a0a0a';
                      e.target.style.borderColor = 'var(--input-border)';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Locked chats mode banner */}
          {!loading && view === 'list' && !searchQuery && showLockedChats && (
            <div className="vault-header" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              background: 'rgba(239,68,68,0.08)',
              borderBottom: '1px solid rgba(239,68,68,0.15)'
            }}>
              <button
                onClick={() => setShowLockedChats(false)}
                style={{
                  background: 'transparent', border: 'none', color: '#ef4444',
                  cursor: 'pointer', display: 'flex', padding: 0
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <Lock size={14} color="#ef4444" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ef4444', flex: 1 }}>
                {t('lockedVault', 'Locked Vault')} {lockedChats.length > 0 ? `(${lockedChats.length})` : ''}
              </span>
              <div style={{ position: 'relative' }} ref={vaultMenuRef}>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    const next = !showVaultMenu;
                    setShowVaultMenu(next); 
                    if (next) {
                      setShowGlobalMenu(false);
                      setActiveConvMenu(null);
                    }
                  }}
                  style={{
                    background: 'transparent', border: 'none', color: '#666',
                    cursor: 'pointer', display: 'flex', padding: 4, borderRadius: '50%',
                    transition: 'all 0.2s',
                    position: 'relative',
                    zIndex: 10
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--header-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--header-btn)'; }}
                >
                  <MoreVertical size={20} />
                </button>
                {showVaultMenu && (
                  <div className="nav-dropdown" style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)',
                    borderRadius: 16, padding: '8px', minWidth: 220,
                    boxShadow: 'var(--dropdown-shadow)', zIndex: 100,
                    animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex', flexDirection: 'column', gap: 4
                  }}>
                    <div style={{ padding: '4px 8px 12px', fontSize: '0.7rem', fontWeight: 800, color: isLight ? 'var(--brand-2-darker)' : 'var(--brand-1-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('vaultSecurity', 'Vault Security')}</div>

                    <button
                      onClick={() => {
                        const next = !autoLockOnClose;
                        setAutoLockOnClose(next);
                        localStorage.setItem('chat_lock_auto_on_close', next.toString());
                        toast.success(next ? t('autoLockOnCloseEnabled', 'Auto-lock on close enabled') : t('autoLockOnCloseDisabled', 'Auto-lock on close disabled'));
                      }}
                      className="chat-menu-item"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.03)', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', marginBottom: 6, transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={16} color={autoLockOnClose ? 'var(--brand-1-light)' : 'var(--menu-icon)'} />
                      </div>
                      <div style={{ flex: 1, fontWeight: 500 }}>{t('autoLockOnClose', 'Auto-lock on close')}</div>
                      <div style={{ width: 32, height: 18, borderRadius: 20, background: autoLockOnClose ? 'var(--brand-2)' : (isLight ? '#d1d5db' : 'rgba(255,255,255,0.15)'), position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <div style={{ position: 'absolute', top: 3, left: autoLockOnClose ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                      </div>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-2-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TimerIcon size={16} color="var(--brand-2)" />
                      </div>
                      <div style={{ flex: 1, fontSize: '0.85rem', color: isLight ? '#374151' : '#e2e8f0', fontWeight: 500 }}>{t('autoLockIdle', 'Auto-lock idle')}</div>
                      <select
                        value={autoLockMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setAutoLockMinutes(val);
                          localStorage.setItem('chat_lock_auto_minutes', val.toString());
                          const labels = { 0: t('idleLockImmediate', 'Immediate'), 1: t('idleLock1Min', '1 min'), 5: t('idleLock5Mins', '5 mins'), 15: t('idleLock15Mins', '15 mins'), '-1': t('idleLockNever', 'Never') };
                          toast.success(t('idleLockSetTo', 'Idle lock set to {{label}}', { label: labels[val] }));
                        }}
                        style={{
                          background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
                          color: isLight ? '#374151' : '#e2e8f0',
                          borderRadius: 10,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '5px 10px',
                          outline: 'none',
                          cursor: 'pointer',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          paddingRight: 24,
                          backgroundImage: isLight
                            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`
                            : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 6px center',
                          transition: 'border-color 0.2s ease, background 0.2s ease'
                        }}
                      >
                        <option value="0">{t('idleLockImmediate', 'Immediate')}</option>
                        <option value="1">{t('idleLock1Min', '1 min')}</option>
                        <option value="5">{t('idleLock5Mins', '5 mins')}</option>
                        <option value="15">{t('idleLock15Mins', '15 mins')}</option>
                        <option value="-1">{t('idleLockNever', 'Never')}</option>
                      </select>
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 4px' }} />

                    <button
                      onClick={() => { setShowVaultMenu(false); setShowChangePinModal(true); }}
                      className="chat-menu-item"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pin size={16} color="var(--brand-1)" />
                      </div>
                      <span style={{ fontWeight: 500 }}>{t('changeVaultPin', 'Change Vault PIN')}</span>
                    </button>

                    <button
                      onClick={() => {
                        unlockedSessionsRef.current = {};
                        setShowVaultMenu(false);
                        setShowLockedChats(false);
                        toast.success(t('vaultLockedImmediately', 'Vault locked immediately'));
                        window.dispatchEvent(new Event('locked_chats_updated'));
                      }}
                      className="chat-menu-item menu-btn-destructive"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.08)', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: '#ef4444', cursor: 'pointer', marginTop: 4, transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldAlert size={16} />
                      </div>
                      <span style={{ fontWeight: 600 }}>{t('lockVaultNow', 'Lock Vault Now')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hidden chats mode banner */}
          {!loading && view === 'list' && !searchQuery && showHiddenChats && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              background: 'rgba(var(--brand-1-rgb),0.08)',
              borderBottom: '1px solid rgba(var(--brand-1-rgb),0.15)'
            }}>
              <button
                onClick={() => setShowHiddenChats(false)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--brand-1-light)',
                  cursor: 'pointer', display: 'flex', padding: 0
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <EyeOff size={14} color="var(--brand-1-light)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--brand-1-light)', flex: 1 }}>
                {t('hiddenChats', 'Hidden Chats')} {hiddenChats.length > 0 ? `(${hiddenChats.length})` : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--header-btn)' }}>{t('tapChatToOpen', 'Tap a chat to open')}</span>
            </div>
          )}

          {view === 'list' && searchQuery && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {searchResults.length > 0 ? (
                searchResults.map((u, idx) => (
                  <div key={idx} onClick={() => {
                    setSearchQuery('');
                    openChat({
                      id: u.username,
                      partner: u.username,
                      targetId: String(u.id),
                      displayName: u.displayName || u.username,
                      partnerAvatar: u.avatarPath,
                      type: 'private'
                    });
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 36, height: 36, minWidth: 36, borderRadius: '50%', background: '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {u.avatarPath ? (
                        <img src={getAvatarUrl(u.avatarPath)} alt="Avatar" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={18} color="#888" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--header-text)' }}>{u.displayName || u.username}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--header-btn)' }}>@{u.username}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 13 }}>No users found matching "{searchQuery}"</div>
              )}
            </div>
          )}

          {view === 'list' && !searchQuery && conversations.filter(c => {
            const cId = (c.id || c.partner).toLowerCase();
            if (showLockedChats) return lockedChats.includes(cId);
            const isHidden = hiddenChats.some(k => k.toLowerCase() === cId);
            if (showHiddenChats) return isHidden;
            return !isHidden && (!chatLockEnabled || !lockedChats.includes(cId));
          }).length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#555', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {showLockedChats ? (
                <>
                  <Lock size={28} color="var(--header-btn)" />
                  <div style={{ fontSize: 14, color: 'var(--header-btn)' }}>{t('vaultEmpty', 'Vault is empty')}</div>
                  <div style={{ fontSize: 12, color: 'var(--menu-icon)' }}>{t('vaultEmptyDesc', 'Lock a chat to move it to the vault')}</div>
                </>
              ) : showHiddenChats ? (
                <>
                  <EyeOff size={28} color="var(--header-btn)" />
                  <div style={{ fontSize: 14, color: 'var(--header-btn)' }}>{t('noHiddenChats', 'No hidden chats')}</div>
                  <div style={{ fontSize: 12, color: 'var(--menu-icon)' }}>{t('hiddenChatsEmptyDesc', 'Chats you hide will appear here')}</div>
                </>
              ) : (
                <div style={{ color: 'var(--header-btn)' }}>No recent chats.</div>
              )}
            </div>
          )}

          {view === 'list' && !searchQuery && [...conversations]
            .filter(c => {
              const cId = (c.id || c.partner).toLowerCase();
              if (showLockedChats) return lockedChats.includes(cId);
              const isHidden = hiddenChats.some(k => k.toLowerCase() === cId);
              if (showHiddenChats) return isHidden;
              return !isHidden && (!chatLockEnabled || !lockedChats.includes(cId));
            })
            .sort((a, b) => {
            const aKey = a.id || a.partner;
            const bKey = b.id || b.partner;
            const aPinned = pinnedChats.includes(aKey);
            const bPinned = pinnedChats.includes(bKey);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return getSortTime(b) - getSortTime(a);
          }).map((chat, idx, arr) => {
            const chatKey = chat.id || chat.partner;
            // unreadCounts from Home.jsx is for the navbar badge only — don't add it here or it doubles the count
            const unread = chat.unread || 0;
            const isMe = chat.isMyLastMessage || (chat.lastSenderName && chat.lastSenderName === myUsername);
            const chatRowLongPressHandlers = chatListLongPress.getHandlers(chatKey);
            return (
              <div key={chatKey} onClick={() => {
                if (chatListLongPress.activeId === chatKey) return;
                selectMode ? toggleSelectChat(chatKey) : openChat(chat);
              }} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                transition: 'background 0.2s', position: 'relative',
                background: selectedChats.includes(chatKey) ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent',
                // Same fix as .msg-sent/.msg-received in index.css — a
                // long-press (this row's own long-press-to-open-menu gesture)
                // used to also trigger the browser's native text-selection
                // (copy/cut/select-all) on the name/tag/preview text
                // underneath, since nothing here told touch devices this row
                // wasn't selectable text. user-select is inherited, so this
                // one declaration covers every child (name, ROOM/PRIVATE tag,
                // last-message preview) without needing it on each of them.
                userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = selectedChats.includes(chatKey) ? 'rgba(var(--brand-1-rgb),0.15)' : 'rgba(255,255,255,0.05)';
                setHoveredConvId(chatKey);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = selectedChats.includes(chatKey) ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent';
                setHoveredConvId(null);
              }}
              onTouchStart={chatRowLongPressHandlers.onTouchStart}
              onTouchMove={chatRowLongPressHandlers.onTouchMove}
              onTouchEnd={chatRowLongPressHandlers.onTouchEnd}
              >
                {selectMode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                    {selectedChats.includes(chatKey) ? (
                      <SquareCheck size={20} color="var(--brand-1-light)" fill="rgba(129,140,248,0.1)" />
                    ) : (
                      <Square size={20} color="#444" />
                    )}
                  </div>
                )}
                {(() => {
                  const isBlockedByThem = chat.type === 'private' && blockingMe.some(u => u.toLowerCase() === chat.partner.toLowerCase());
                  const iBlockedThem = chat.type === 'private' && blockedChats.some(u => u.toLowerCase() === chat.partner.toLowerCase());
                  const eitherBlocked = isBlockedByThem || iBlockedThem;
                  const displayAvatar = eitherBlocked ? null : chat.partnerAvatar;
                  const displayName = eitherBlocked ? 'User' : chat.displayName;
                  // The mandatory SahaPlay announcements group's avatar is the
                  // app's own transparent-background logo mark (see
                  // SAHAPLAY_OFFICIAL_AVATAR_URL) — rendered on the same 'none'
                  // background as any other room thumbnail, the transparent
                  // PNG just showed whatever dark background sat behind it,
                  // reading as a plain black circle with the logo barely
                  // visible. A fixed white backing plate is this channel's own
                  // brand treatment (like a badge), independent of dark/light
                  // theme, so it isn't wired to isLight here.
                  const isOfficial = chat.type === 'room' && isSahaplayOfficialGroup(chat);
                  return (
                    <>
                      {/* Outer wrapper carries no overflow:hidden of its own —
                          only the inner circle does, to clip the avatar image
                          itself. The online-dot badge below is a sibling of
                          that inner circle (not a child of it), so it renders
                          fully outside the avatar's own clip region instead of
                          being cut off by it. */}
                      <div style={{ width: 40, height: 40, minWidth: 40, position: 'relative' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: isOfficial ? '#fff' : '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {chat.type === 'room' ? (
                          <div style={{ width: '100%', height: '100%', background: isOfficial ? '#fff' : (displayAvatar ? 'none' : 'linear-gradient(135deg, var(--brand-1), var(--brand-2))'), display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden' }}>
                            {displayAvatar ? (
                              <img src={getAvatarUrl(displayAvatar)} alt="Room" loading="eager" decoding="sync"style={{ width: isOfficial ? '68%' : '100%', height: isOfficial ? '68%' : '100%', objectFit: isOfficial ? 'contain' : 'cover' }} />
                            ) : (
                              <Users size={20} color="#fff" />
                            )}
                          </div>
                        ) : (
                          displayAvatar ? (
                            <img src={getAvatarUrl(displayAvatar)} alt="Avatar" loading="eager" decoding="sync"style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: getAvatarColor(displayName || chat.partner), display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                              <span className="stay-white" style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{getInitials(displayName || chat.partner)}</span>
                            </div>
                          )
                        )}
                      </div>
                        {chat.type !== 'room' && !eitherBlocked && onlineUsers.has((chat.partner || '').toLowerCase()) && (
                          <span style={{
                            position: 'absolute', bottom: -1, right: -1,
                            width: 11, height: 11, borderRadius: '50%',
                            background: '#22c55e', border: `2px solid ${isLight ? '#ffffff' : '#16161e'}`,
                            boxSizing: 'content-box',
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--header-text)' }}>
                              {displayName}
                            </span>
                            <span className="chat-tag" style={{
                              background: chat.type === 'room' ? 'rgba(var(--brand-1-rgb),0.2)' : 'rgba(34,197,94,0.2)',
                              color: chat.type === 'room' ? 'var(--brand-1-light)' : '#4ade80',
                              padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, flexShrink: 0
                            }}>
                              {chat.type}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {typingStatuses[chatKey] ? (
                              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 500 }}>typing...</span>
                            ) : (
                              chat.lastTimestamp > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--header-btn)', whiteSpace: 'nowrap' }}>
                                  {formatDistanceToNow(Number(chat.lastTimestamp))}
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: isLight ? 'var(--header-btn)' : '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1, minWidth: 0, paddingRight: 6 }}>
                            <span className="chat-preview" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', display: 'block' }}>
                              {reactionPreviewOverrides[chatKey]
                                ? reactionPreviewOverrides[chatKey]
                                : (!chat.lastTimestamp || chat.lastTimestamp === 0)
                                ? <span style={{ color: 'var(--menu-icon)' }}>{chat.type === 'room' ? 'Start a conversation' : 'Start a private chat'}</span>
                                : getMessagePreview(chat, myUsername)
                              }
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 8, marginLeft: 'auto' }}>
                            {mutedChats.includes(chatKey) && (
                              <BellOff size={14} className="chat-status-icon" color="var(--header-btn)" style={{ flexShrink: 0 }} />
                            )}
                            {chatLockEnabled && lockedChats.includes(chatKey) && (
                              <Lock size={14} className="chat-status-icon" color="var(--brand-1-light)" style={{ flexShrink: 0 }} />
                            )}
                            {pinnedChats.includes(chatKey) && (
                              <Pin size={14} className="chat-status-icon" color="var(--header-btn)" style={{ flexShrink: 0, fill: 'var(--header-btn)' }} />
                            )}
                            {unread > 0 && (
                              <div className="unread-badge stay-white" style={{
                                background: '#ef4444', borderRadius: '50%', color: '#fff',
                                fontSize: 10, fontWeight: 'bold', minWidth: 18, height: 18,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px', flexShrink: 0
                              }}>
                                {unread > 99 ? '99+' : unread}
                              </div>
                            )}
                            {/* Dropdown Menu Arrow (Flex Flow, sliding transition inside bottom row) */}
                             <div
                              className="chat-item-arrow"
                              ref={activeConvMenu === chatKey ? convMenuRef : null}
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = activeConvMenu === chatKey ? null : chatKey;
                                if (next) {
                                  const triggerRect = e.currentTarget.getBoundingClientRect();
                                  const panelBottom = containerRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
                                  // ~300px covers this menu's tallest form (every
                                  // item shown at once: Hide/Pin/Mute/Theme/Mark
                                  // read/Lock/Clear/Delete) — a shorter render
                                  // still fits comfortably under this margin.
                                  setConvMenuPlacement((panelBottom - triggerRect.bottom) < 300 ? 'up' : 'down');
                                }
                                setActiveConvMenu(next);
                                if (next) {
                                  setShowGlobalMenu(false);
                                  setShowSelectionMenu(false);
                                  setShowVaultMenu(false);
                                }
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: (hoveredConvId === chatKey || activeConvMenu === chatKey) ? 20 : 0,
                                opacity: (hoveredConvId === chatKey || activeConvMenu === chatKey) ? 1 : 0,
                                transform: (hoveredConvId === chatKey || activeConvMenu === chatKey) ? 'translateX(0)' : 'translateX(10px)',
                                overflow: 'hidden',
                                transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                color: '#aaa',
                                marginLeft: 0,
                                flexShrink: 0,
                                cursor: 'pointer'
                              }}
                            >
                              <ChevronDown size={18} />
                            </div>
                          </div>
                        </div>
                      </div>

                {/* Dropdown Menu Box */}
                {activeConvMenu === chatKey && (
                  <div 
                    ref={convMenuRef}
                    className="nav-dropdown"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', right: 40,
                      ...(convMenuPlacement === 'up' ? { bottom: 30 } : { top: 55 }),
                      background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)',
                      borderRadius: 12, padding: '6px', minWidth: 195, overflow: 'hidden',
                      boxShadow: 'var(--dropdown-shadow)', zIndex: 20,
                      display: 'flex', flexDirection: 'column', gap: 2
                  }}>
                    {/* Hide chat */}
                    <div className="chat-menu-item" onClick={() => toggleHideChat(chatKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <EyeOff size={16} color="var(--menu-icon)" /> {hiddenChats.includes(chatKey) ? t('unhideChat', 'Unhide chat') : t('hideChat', 'Hide chat')}
                    </div>
                    {/* Pin chat */}
                    <div className="chat-menu-item" onClick={() => togglePinChat(chatKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <Pin size={16} color="var(--menu-icon)" /> {pinnedChats.includes(chatKey) ? t('unpinChat', 'Unpin chat') : t('pinChat', 'Pin chat')}
                    </div>
                    {/* Mute notifications */}
                    <div className="chat-menu-item" onClick={() => toggleMuteChat(chatKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <BellOff size={16} color="var(--menu-icon)" /> {mutedChats.includes(chatKey) ? t('unmuteNotifications', 'Unmute notifications') : t('muteNotifications', 'Mute notifications')}
                    </div>
                    {/* Mute calls — private (DM) chats only, distinct from muting
                        messages above. No ring, no push, no missed-call
                        notification for calls from this person, enforced
                        server-side in call:invite; nothing to toggle client-side
                        beyond this list. */}
                    {chat.type !== 'room' && (
                      <div className="chat-menu-item" onClick={() => toggleMuteCallChat(chatKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                        {mutedCallChats.includes(chatKey) ? <Phone size={16} color="var(--menu-icon)" /> : <PhoneOff size={16} color="var(--menu-icon)" />} {mutedCallChats.includes(chatKey) ? t('unmuteCalls', 'Unmute calls') : t('muteCalls', 'Mute calls')}
                      </div>
                    )}
                    {/* Chat theme — works whether or not this conversation is currently open */}
                    <div className="chat-menu-item" onClick={() => { setThemeSheetTarget(chat); setShowThemeSheet(true); setActiveConvMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <Palette size={16} color="var(--menu-icon)" /> {t('chatTheme', 'Chat theme')}
                    </div>
                    {/* Mark as read */}
                    <div className="chat-menu-item" onClick={() => markChatAsRead(chatKey)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <CheckCheck size={16} color="var(--menu-icon)" /> {t('markAsRead', 'Mark as read')}
                    </div>
                    {/* Chat lock */}
                    <div className="chat-menu-item" onClick={() => {
                      const isAlreadyLocked = lockedChats.includes(chatKey);
                      setActiveConvMenu(null);
                      if (!chatLockEnabled) {
                        setSetupTrigger({ chat: chat });
                        setShowPinSetup(true);
                      } else {
                        if (isAlreadyLocked) {
                          setLockToggleTarget({ chat: chat, action: 'toggle-unlock' });
                        } else {
                          handleSilentLock(chat);
                        }
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: lockedChats.includes(chatKey) ? 'var(--brand-1-light)' : 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      {lockedChats.includes(chatKey) ? <Unlock size={16} color="var(--brand-1-light)" /> : <Lock size={16} color="var(--menu-icon)" />}
                      {lockedChats.includes(chatKey) ? t('unlockChat', 'Unlock chat') : t('lockChat', 'Lock chat')}
                    </div>

                    {/* Divider before last 3 options */}
                    <div style={{ height: 1, background: 'var(--menu-divider)', margin: '4px 8px' }} />
                    {/* Block */}
                    {chat.type === 'private' && (
                      <div className="chat-menu-item menu-btn-destructive" onClick={() => {
                        const isBlocked = blockedChats.some(k => k.toLowerCase() === chatKey.toLowerCase());
                        if (isBlocked) {
                          toggleBlockChat(chatKey);
                        } else {
                          setActiveConvMenu(null);
                          setBlockUserPending(chat);
                        }
                      }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: '#f97316', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <Ban size={16} className="menu-icon" color="#f97316" /> {blockedChats.some(k => k.toLowerCase() === chatKey.toLowerCase()) ? t('unblock', 'Unblock') : t('block', 'Block')}
                      </div>
                    )}
                    {/* Clear chat */}
                    <div className="chat-menu-item menu-btn-destructive" onClick={() => {
                      setActiveConvMenu(null);
                      if (chat.type === 'room') setClearGroupChatModalOpen(chat);
                      else { setClearChatModalOpen(chat); setClearForBoth(false); }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <MessageSquareX size={16} className="menu-icon" color="var(--menu-icon)" /> {t('clearChat', 'Clear chat')}
                    </div>
                    {/* Delete chat */}
                    <div className="chat-menu-item menu-btn-destructive" onClick={() => {
                      setActiveConvMenu(null);
                      setDeleteChatPending(chatKey);
                    }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: '#ef4444', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <Trash2 size={16} className="menu-icon" color="#ef4444" /> {t('deleteChat', 'Delete chat')}
                    </div>
                  </div>
                )}
              </>
            ); })()}

              </div>
            );
          })}

          {/* ── Key-loading overlay: brief spinner while PBKDF2 restores key from sessionStorage ── */}
          {view === 'chat' && !isReady && !keyPair && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 9999
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🔑</div>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Unlocking messages…</p>
              <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>Restoring your encryption keys</p>
            </div>
          )}

          {/* ── Re-auth overlay removed as requested ── */}

          {view === 'chat' && activeChat && (() => {
            // eslint-disable-next-line no-unused-expressions
            expiryBannerTick;
            const soonCount = countSoonExpiringMedia(messages, bannerChatKey);
            if (!soonCount) return null;
            return (
              <ExpiryReminderBanner
                count={soonCount}
                isLight={isLight}
                onGotIt={() => { dismissExpiryBanner12h(bannerChatKey); setExpiryBannerTick(v => v + 1); }}
                onRemindLater={() => { snoozeExpiryBannerUntilClose(bannerChatKey); setExpiryBannerTick(v => v + 1); }}
                onClose={() => { snoozeExpiryBannerUntilClose(bannerChatKey); setExpiryBannerTick(v => v + 1); }}
              />
            );
          })()}

          {view === 'chat' && activeChat?.type === 'private' && (() => {
            // eslint-disable-next-line no-unused-expressions
            keyResetBannerTick;
            if (!shouldShowKeyResetBanner(myUsername)) return null;
            return (
              <KeyResetSyncBanner
                isLight={isLight}
                onGotIt={() => { dismissKeyResetBanner(myUsername); setKeyResetBannerTick(v => v + 1); }}
              />
            );
          })()}

          {view === 'chat' && (
            <div
              ref={scrollContainerRef}
              className="no-scrollbar"
              onScroll={(e) => {
                handleScroll(e);
                const el = e.currentTarget;
                if (el.scrollTop < 50) {
                  loadMoreHistory(el);
                }
              }}
              onClick={() => { setActiveReactionMsg(null); setShowAllEmojis(false); setShowEmojiPicker(false); setActiveMessageMenu(null); longPress.close(); }}
              style={{
                padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
                // The wallpaper image+scrim itself now lives on the shared
                // backdrop layer behind the whole panel (see above) so it
                // shows through here AND behind the composer bar as one
                // continuous picture — this container just stays transparent.
                background: activeWallpaper ? 'transparent' : (isCustomTheme ? (isLight ? '#ffffff' : '#0a0a0a') : 'transparent'),
              }}
            >
              {historyLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(var(--brand-1-rgb),0.2)', borderTop: '2px solid var(--brand-1)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
              {messages.length === 0 ? (
                loading ? (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid rgba(var(--brand-1-rgb),0.2)', borderTop: '2px solid var(--brand-1)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  // A chat background sits behind this empty state the same way it does
                  // behind every message — the plain grey default read fine on the app's
                  // own flat background, but disappeared against a busy/dark wallpaper
                  // image in both light and dark mode. White regardless of theme once a
                  // wallpaper is active, same as the message text painted on top of it.
                  // stay-white: App.jsx's light-mode stylesheet has a blanket rule that
                  // rewrites any literal white inline color back to near-black — same
                  // escape hatch the poll/avatar-letter text already needs.
                  <div className={activeWallpaper ? 'stay-white' : ''} style={{ textAlign: 'center', color: activeWallpaper ? '#fff' : '#888', marginTop: 20, fontSize: 13 }}>No messages yet. Say hi!</div>
                )
              ) : (
                (() => {
                  const effectiveSeenMap = getEffectiveSeenBy(messages, myUsername);
                  const mediaRuns = groupMediaRuns(messages);
                  const noticeRuns = groupNoticeRuns(messages);
                  // A "seen" event can land on any message in a media batch (whichever one
                  // the reader's client happened to report), not necessarily the head — but
                  // only the head row ever renders a receipt. Merge readers from every
                  // message in the run onto the head's own lookup key so none get lost.
                  for (const [headKey, runMsgs] of mediaRuns.heads.entries()) {
                    const headMsg = runMsgs[0];
                    const headMapKey = String(headMsg.id || headMsg.timestamp);
                    const merged = new Map();
                    for (const rm of runMsgs) {
                      const readers = effectiveSeenMap.get(String(rm.id || rm.timestamp)) || [];
                      for (const r of readers) merged.set(r.username.toLowerCase(), r);
                    }
                    if (merged.size > 0) effectiveSeenMap.set(headMapKey, Array.from(merged.values()));
                  }
                  // A media-batch's non-head rows render null, so the "last message" for
                  // read-receipt purposes must resolve to the batch's head row (the one
                  // that actually renders), not the raw last index — otherwise the last
                  // message being part of a batch silently hides the Seen indicator.
                  let lastRenderIdx = messages.length - 1;
                  while (lastRenderIdx >= 0) {
                    const lm = messages[lastRenderIdx];
                    const lrk = lm.tempId || lm.id || lastRenderIdx;
                    if (!mediaRuns.memberKeys.has(lrk)) break;
                    lastRenderIdx--;
                  }
                  const lastMsg = messages[lastRenderIdx];
                  const isLastSentByMe = lastMsg && (lastMsg.isMe || (lastMsg.username && lastMsg.username.toLowerCase() === myUsername?.toLowerCase()) || (lastMsg.senderName && lastMsg.senderName.toLowerCase() === myUsername?.toLowerCase()));
                  const renderReceiptIndex = isLastSentByMe ? lastRenderIdx : -1;
                  return messages.map((msg, i) => {
                    if (msg.isNotice) {
                      const isMeChange = msg.isMe;
                      const otherParty = activeChat?.partner || activeChat?.id;
                      const rowKey = msg.tempId || msg.id || i;
                      const runInfo = noticeRuns.get(rowKey);
                      const noticeLine = (keyOverride) => (
                        <div key={keyOverride} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
                            background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                            color: isLight ? '#475569' : '#9ca3af', fontSize: 12, fontWeight: 500,
                            padding: '6px 14px', borderRadius: 14, maxWidth: '85%', textAlign: 'center',
                          }}>
                            <span>{isMeChange ? t('youChangedTheme', 'You changed the chat theme') : t('userChangedTheme', '{{username}} changed the chat theme', { username: msg.senderName })}</span>
                            <button
                              onClick={() => { setThemeSheetTarget({ type: 'private', partner: otherParty }); setShowThemeSheet(true); }}
                              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-1-light)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {t('changeTheme', 'Change theme')}
                            </button>
                          </div>
                        </div>
                      );

                      if (!runInfo) return noticeLine(rowKey);

                      const isExpanded = expandedNoticeRuns.has(runInfo.headKey);
                      if (!isExpanded) {
                        if (!runInfo.isHead) return null;
                        return (
                          <div key={rowKey} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                            <button
                              onClick={() => setExpandedNoticeRuns(prev => new Set(prev).add(runInfo.headKey))}
                              style={{
                                background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                                color: isLight ? '#475569' : '#9ca3af', fontSize: 12, fontWeight: 600,
                                border: 'none', padding: '6px 14px', borderRadius: 14, cursor: 'pointer',
                              }}
                            >
                              {t('themeChangedNTimes', 'Theme changed {{n}} times', { n: runInfo.runLength })} · <span style={{ color: 'var(--brand-1-light)', fontWeight: 700 }}>{t('seeUpdates', 'See updates')}</span>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <React.Fragment key={rowKey}>
                          {noticeLine(undefined)}
                          {runInfo.isLast && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 6px' }}>
                              <button
                                onClick={() => setExpandedNoticeRuns(prev => { const next = new Set(prev); next.delete(runInfo.headKey); return next; })}
                                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-1-light)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                {t('hideUpdates', 'Hide updates')}
                              </button>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    }
                    const mUserLower = myUsername?.toLowerCase();
                    let isMe = msg.isMe ||
                                 (msg.senderName && msg.senderName.toLowerCase() === mUserLower) ||
                                 (msg.username && msg.username.toLowerCase() === mUserLower);
                    // Call-log bubbles: writeCallLog() (CallContext.jsx) is
                    // always posted by whichever side's client happens to run
                    // the code that writes it (e.g. the callee's own device on
                    // decline) — regardless of who actually placed the call.
                    // Rendering it on that sender's side would show the
                    // person who declined a call as if THEY made it. Override
                    // isMe using the logged initiatedBy (the real caller)
                    // instead, so the bubble always lands on the actual
                    // caller's side, the same way a phone's own call log
                    // distinguishes outgoing vs incoming regardless of which
                    // device technically wrote the entry.
                    if (msg.decryptedText && msg.decryptedText.startsWith(CALL_LOG_PREFIX)) {
                      try {
                        const callData = JSON.parse(msg.decryptedText.slice(CALL_LOG_PREFIX.length));
                        if (callData?.initiatedBy) isMe = callData.initiatedBy.toLowerCase() === mUserLower;
                      } catch {}
                    }
                  const rowKey = msg.tempId || msg.id || i;
                  if (mediaRuns.memberKeys.has(rowKey)) return null;
                  const mediaGroupItems = mediaRuns.heads.get(rowKey) || null;
                  const reactions = msg.reactions || {};
                  const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
                  // Computed once per message so it can be placed either before the caption
                  // row (captioned media — image on top) or after it (media-only — unchanged
                  // spot). `flush`/hideTick (the shared !isMediaOnly condition) drops the
                  // media's own corner-rounding and overlay tick whenever a caption row is
                  // about to render right underneath it with its own rounding/tick.
                  const mediaNode = mediaGroupItems ? (
                    <MediaGrid
                      items={mediaGroupItems}
                      forwarded={msg?.forwarded}
                      expiresAt={msg.mediaExpiresAt}
                      tick={isMe ? <MessageTick msg={msg} username={myUsername} isLight={isLight} /> : null}
                      resolveUrl={(it) => resolveDecryptedUrl(it, decryptedMediaUrls)}
                      onOpenItem={(it, url) => openLightbox(url, it.mediaType)}
                    />
                  ) : (() => {
                    const msgKey = String(msg.id || msg.timestamp);
                    const resolvedUrl = decryptedMediaUrls.current[msgKey] || msg._localMediaUrl || ((msg.mediaUrl && msg.mediaUrl.startsWith('blob:')) ? msg.mediaUrl : (msg.nonce ? null : msg.mediaUrl));
                    const mt = msg.mediaType || '';
                    if (!mt) return null;
                    const isImg = mt.startsWith('image/');
                    const isVid = mt.startsWith('video/');
                    // Videos can be up to 50MB and are fetched+decrypted in full before
                    // they can render at all (see the async decrypt IIFEs above) — a slow
                    // connection can genuinely take longer than the 30s window images/
                    // audio/files need, which was flipping isDecrypting false (and the
                    // placeholder to "couldn't load") while the decrypt was still in flight.
                    const decryptWindowMs = isVid ? 120000 : 30000;
                    // Measured from the first time THIS client ever rendered this message
                    // without a resolved URL (mediaDecryptStartedAt — lazily stamped right
                    // here, the moment that happens), not from msg.timestamp (when it was
                    // originally sent). The background fetch+decrypt (see the async IIFEs
                    // above) kicks off in that same instant, so this is effectively "how
                    // long has the decrypt actually had to run" — but every message loaded
                    // from history is already old by the time it's decrypted, so timing off
                    // the send timestamp instead made isDecrypting read false (and flashed
                    // the "Couldn't load" placeholder) immediately on every reopen/reload,
                    // even though the real fetch had only just begun.
                    if (!resolvedUrl && !mediaDecryptStartedAt.current[msgKey]) mediaDecryptStartedAt.current[msgKey] = Date.now();
                    const decryptStartedAt = mediaDecryptStartedAt.current[msgKey] || Number(msg.timestamp);
                    const isDecrypting = !resolvedUrl && !!msg.nonce && (Date.now() - decryptStartedAt) < decryptWindowMs;
                    return renderMedia(
                      resolvedUrl,
                      mt,
                      isMe,
                      msg._fileName || msg.mediaFileName,
                      msg._fileSize || msg.mediaFileSize,
                      msg.mediaExpiresAt,
                      isDecrypting,
                      openLightbox,
                      // Same "on the wallpaper's dark scrim, use the dark-mode-appropriate
                      // colors regardless of the light/dark toggle" rule as metaIsLight
                      // below — voice-note bars/time/expiry and the file-card tick were
                      // still using bare isLight, so picking a wallpaper in light mode
                      // made them render near-black-on-black.
                      isLight && !activeWallpaper,
                      msg,
                      myUsername,
                      !isMediaOnly, // hideTick
                      !isMediaOnly, // flush — caption row underneath handles its own rounding
                      // Opaque wallpaper color, same for sent and received — see the
                      // identical (msg.isPoll || msg.mediaType) background calc above.
                      activeWallpaper ? (wallpaperColor || 'rgba(255,255,255,0.25)') : null,
                      activeWallpaperIsZen,
                      // A picked Chat Theme (Colors tab, not a wallpaper) — same
                      // condition the sent text bubble's own gradient background
                      // uses (isMe && isCustomTheme && !activeWallpaper).
                      (isMe && isCustomTheme && !activeWallpaper) ? activeTheme.gradient : null,
                      (isMe && isCustomTheme && !activeWallpaper) ? getThemeSolidColor(activeTheme) : null
                    );
                  })();
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const showDateSep = !prevMsg || getDateKey(prevMsg.timestamp) !== getDateKey(msg.timestamp);
                  // The SahaPlay Updates channel is a one-way broadcast — regular users
                  // can't post there at all (see the composer gate below), so reporting/
                  // replying to the admin's own announcement messages doesn't make sense.
                  const canReport = activeChat?.type === 'room' && !isMe && !isSahaplayOfficialGroup(activeChat);
                  const canReplyToMsg = !(activeChat?.type === 'room' && !isMe && isSahaplayOfficialGroup(activeChat));
                  // Secondary/meta UI (timestamp, Reply, Flag, react button,
                  // read receipt, reaction pills) sits directly on the
                  // wallpaper backdrop, not inside the bubble — the backdrop
                  // always has a dark scrim over it (see its linear-gradient),
                  // so these reuse the same light-appropriate colors the
                  // dark-mode branch already has, whenever a wallpaper is
                  // active, regardless of the light/dark toggle.
                  const metaIsLight = isLight && !activeWallpaper;
                  const swipeHandlers = swipe.getHandlers(rowKey, isMe ? 'left' : 'right', () => setReplyToMsg(msg));
                  const longPressHandlers = longPress.getHandlers(rowKey);
                  const rowSelectHandlers = rowSelectLongPress.getHandlers(rowKey);
                  const gestureHandlers = {
                    // Taps inside the open long-press menu bubble through to
                    // this wrapper's own touchstart (sibling under the same
                    // gesture div), which was closing the menu on touch-DOWN
                    // before the tap could register on a button — skip when
                    // the touch actually started on the menu itself.
                    onTouchStart: (e) => {
                      if (e.target.closest && e.target.closest('.long-press-menu')) return;
                      if (longPress.activeId === rowKey) { longPress.close(); }
                      // Measured from the ROW's own bottom edge, not the touch point —
                      // for a tall row (a poll, an image) a touch near the row's TOP can
                      // still be far from the composer while the row's bottom (where the
                      // menu actually anchors via top:'100%'/bottom:'100%') is right up
                      // against it, which the old touch.clientY-based distance never
                      // caught: it read "plenty of room" and opened the menu downward
                      // straight under the composer.
                      else { const touch = e.touches[0]; if (touch) setLongPressPlacement((getMenuFloorY(e.currentTarget, wrapperRef.current) - e.currentTarget.getBoundingClientRect().bottom) < 260 ? 'up' : 'down'); }
                      swipeHandlers.onTouchStart(e); longPressHandlers.onTouchStart(e);
                    },
                    onTouchMove: (e) => { if (e.target.closest && e.target.closest('.long-press-menu')) return; swipeHandlers.onTouchMove(e); longPressHandlers.onTouchMove(e); },
                    onTouchEnd: (e) => { if (e.target.closest && e.target.closest('.long-press-menu')) return; swipeHandlers.onTouchEnd(e); longPressHandlers.onTouchEnd(e); },
                  };
                  const isSwipingRow = swipe.activeId === rowKey;
                  const rowDragX = isSwipingRow ? swipe.dragX : 0;
                  const rowThresholdMet = isSwipingRow && swipe.isThresholdMet;
                  const rowDragging = isSwipingRow && swipe.isDragging;
                  const rowBounce = swipe.bounceId === rowKey;
                  const showLongPressMenu = longPress.activeId === rowKey;
                  return (
                    <React.Fragment key={msg.tempId || msg.id || i}>
                    {showDateSep && (
                      <div style={{display:'flex',alignItems:'center',gap:8,margin:'10px 0 4px',userSelect:'none'}}>
                        <div style={{flex:1,height:1,background:'rgba(128,128,128,0.25)'}}/>
                        <span style={{fontSize:11,color:'var(--menu-icon)',whiteSpace:'nowrap',padding:'0 4px'}}>{formatDateSeparator(msg.timestamp)}</span>
                        <div style={{flex:1,height:1,background:'rgba(128,128,128,0.25)'}}/>
                      </div>
                    )}
                    <div
                         id={`gcw-msg-${msg.id || msg.tempId || i}`}
                         // msg-row: shared with RoomChatPanel.jsx, picks up the
                         // timestamp-peek transform from index.css's global rule.
                         className="msg-row"
                         // z-index boost also covers an open reaction picker (activeReactionMsg),
                         // not just the long-press/dropdown menu — a message's own z-index:2
                         // stacking context otherwise stays at the default tier, and its
                         // absolutely-positioned picker (however high ITS OWN z-index is) can
                         // never out-stack a LATER sibling row's equal-z-index bubble: a
                         // descendant's z-index only wins comparisons made INSIDE its own
                         // ancestor's stacking context, never against a completely different
                         // sibling stacking context — see the matching comment in
                         // RoomChatPanel.jsx's own copy of this row.
                         style={{marginTop: i === 0 ? 'auto' : 0, display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4, position: 'relative', zIndex: (showLongPressMenu || activeMessageMenu === msg.id || activeReactionMsg === msg.id) ? 50 : undefined, background: (msgSelectMode && selectedMsgIds.has(rowKey)) ? (isLight ? 'rgba(var(--brand-1-rgb),0.10)' : 'rgba(var(--brand-1-rgb),0.18)') : 'transparent', borderRadius: 12, padding: (msgSelectMode && selectedMsgIds.has(rowKey)) ? '4px 0' : 0, transition: timestampPeek.isPeeking ? 'background 0.15s ease' : 'background 0.15s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1)'}}
                         onTouchStart={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchStart(e); timestampPeek.onTouchStart(e); } }}
                         onTouchMove={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchMove(e); timestampPeek.onTouchMove(e); } }}
                         onTouchEnd={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchEnd(e); timestampPeek.onTouchEnd(e); } }}>
                      <div style={{ position:'absolute', top:0, bottom:0, right: -(timestampPeek.PEEK_WIDTH + 20), width: 60, overflow: 'hidden', display:'flex', alignItems:'center', fontSize:11, color: isLight ? '#64748b' : '#94a3b8', pointerEvents:'none', whiteSpace:'nowrap' }}>
                        {formatTime(msg.timestamp)}
                      </div>
                      {/* Multi-select overlay: covers the whole row so a tap anywhere toggles
                          selection instead of reaching the reaction/menu buttons underneath —
                          the checkbox itself sits in the row's own empty side (opposite the
                          bubble), the same zone the long-press gesture above uses to enter this mode. */}
                      {msgSelectMode && (
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleMsgSelect(rowKey); }}
                          style={{ position:'absolute', inset:0, zIndex:70, cursor:'pointer', display:'flex', alignItems:'center', justifyContent: isMe ? 'flex-start' : 'flex-end', padding: '0 6px' }}
                        >
                          {selectedMsgIds.has(rowKey)
                            ? <SquareCheck size={20} color="var(--brand-1-light)" fill="rgba(129,140,248,0.15)" />
                            : <Square size={20} color={isLight ? '#94a3b8' : '#666'} />}
                        </div>
                      )}
                      {msg.replyTo && (
                        // Grey pill + white text, unconditionally — see the
                        // identical comment on RoomChatPanel.jsx's quoted-
                        // reply block; same fix, same reason. stay-white
                        // exempts this from the global light-mode "force
                        // white-ish text to black" rule (see App.jsx).
                        // userSelect:none — this renders as a SIBLING of the
                        // .msg-sent/.msg-received bubble (before it in the
                        // DOM), so it never inherited that class's own
                        // user-select:none — a long-press landing here fell
                        // through to native text selection instead of the
                        // message's long-press menu.
                        <div className={(isMe && activeWallpaperIsZen) ? '' : 'stay-white'} onClick={() => { const el = document.getElementById(`gcw-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(var(--brand-1-rgb),0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background:'rgba(120,120,128,0.45)',borderLeft:`3px solid ${isMe?'var(--brand-1)':'var(--brand-2)'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:(isMe && activeWallpaperIsZen) ? '#111111' : '#fff',maxWidth:'80%',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none'}}>
                          <span className={(isMe && activeWallpaperIsZen) ? '' : 'stay-white'} style={{color:(isMe && activeWallpaperIsZen) ? '#111111' : '#fff',fontWeight:600}}>{(() => {
                            const rName = msg.replyTo.username || msg.replyTo.senderName;
                            if (rName === myUsername) return 'You';
                            const partner = (rName || '').toLowerCase();
                            if (blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner)) return 'User';
                            return rName;
                          })()}: </span>{(() => {
                            const r = msg.replyTo;
                            if (r.mediaType) { const rmt6=r.mediaType; return rmt6.startsWith('video')?'Video':rmt6.startsWith('image')?'Photo':rmt6.startsWith('audio')?'Voice Note':(r.mediaFileName || r._fileName || 'File'); }
                            if (isPollJSON(r.message)) return '📊 Poll';
                            const raw = r.message || '';
                            if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                            return raw.slice(0,60) || 'Media';
                          })()}
                        </div>
                      )}
                      <div style={{display:'flex',alignItems:'flex-start',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'95%'}}>
                         {/* Profile avatar — left side for all incoming messages */}
                         {!isMe && activeChat?.type === 'room' && isSahaplayOfficialGroup(activeChat) ? (
                           // Broadcast channel — always the app's own mark, never whichever
                           // admin account actually posted it (matches the "SahaPlay" sender
                           // label below, which already avoids leaking the poster's identity;
                           // this closes the same gap for the avatar itself).
                           <div style={{ flexShrink:0, width:32, height:32, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff', marginTop:2 }}>
                             <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width:'62%', height:'62%', objectFit:'contain' }} />
                           </div>
                         ) : !isMe && (() => {
                           const sNameOriginal = msg.senderName || msg.username || '?';
                           const partner = sNameOriginal.toLowerCase();
                           let isBlocked = false;
                           try {
                             isBlocked = blockingMe.some(u => String(u || '').toLowerCase() === partner) || blockedChats.some(u => String(u || '').toLowerCase() === partner);
                           } catch (err) { console.error('[GCW] block-check failed, treating as not blocked', err); }
                           const sName = isBlocked ? 'User' : sNameOriginal;
                           const aSrc = isBlocked ? null : getAvatarUrl(msg.senderAvatar);
                           return (
                             <div
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (!isBlocked && sNameOriginal && sNameOriginal !== '?') {
                                   leaveChatToViewProfile(sNameOriginal);
                                 }
                               }}
                               title={isBlocked ? 'Blocked User' : `View ${sNameOriginal}'s profile`}
                               // userSelect:none — a plain sibling of the message
                               // bubble (not a descendant), so a long-press on the
                               // initials fallback (no avatar photo) fell through
                               // to native text selection instead of the
                               // message's long-press menu.
                               style={{ flexShrink:0, cursor:isBlocked?'default':'pointer', width:32, height:32, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:getAvatarColor(sNameOriginal), marginTop:2, userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none' }}
                             >
                               {aSrc ? (<img src={aSrc} alt={sName} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex';}}/>) : null}
                               <span className="stay-white" style={{display:aSrc?'none':'flex',color:'#fff',fontSize:11,fontWeight:700}}>{getInitials(sName)}</span>
                             </div>
                           );
                         })()}
                        <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                          {!isMe && activeChat?.type === 'room' && (
                            isSahaplayOfficialGroup(activeChat) ? (
                              // Broadcast channel — recipients should see "SahaPlay" as the
                              // sender, not whichever admin account actually posted it.
                              <span style={{ fontSize: 10, color: activeWallpaper ? 'rgba(255,255,255,0.85)' : '#888', marginBottom: 1 }}>SahaPlay</span>
                            ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                const sName = msg.senderName || msg.username;
                                if (sName && !blockingMe.some(u => u.toLowerCase() === sName.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === sName.toLowerCase())) { leaveChatToViewProfile(sName); }
                              }}
                              style={{ fontSize: 10, color: activeWallpaper ? 'rgba(255,255,255,0.85)' : '#888', marginBottom: 1, cursor: (blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) || blockedChats.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase())) ? 'default' : 'pointer' }}
                              title={`View ${msg.senderName || msg.username}'s profile`}
                            >{(blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) || blockedChats.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase())) ? 'User' : (msg.senderName || msg.username)}</span>
                            )
                          )}
                          <div style={{position:'relative', display:'flex', alignItems:'center'}}
                               onMouseEnter={() => setHoveredRowId(msg.id||i)}
                               onMouseLeave={() => setHoveredRowId(null)}
                               onTouchStart={gestureHandlers.onTouchStart}
                               onTouchMove={gestureHandlers.onTouchMove}
                               onTouchEnd={gestureHandlers.onTouchEnd}>
                            {burstMsgId === (msg.id || i) && <DoubleTapBurst emoji={burstEmoji} />}
                            <div className="swipe-reply-icon" style={{
                              position:'absolute', [isMe ? 'right' : 'left']: 8, top:'50%',
                              transform: `translateY(-50%) scale(${rowThresholdMet ? 1 : 0})`,
                              transition: 'transform 0.15s ease',
                              opacity: isSwipingRow ? 1 : 0,
                              color: 'var(--brand-2-dark)', zIndex: 1, pointerEvents: 'none'
                            }}>
                              <Reply size={18} style={{ transform: isMe ? 'scaleX(-1)' : 'none' }} />
                            </div>
                            <div
                              // paintSentAsReceived (Zen Interior, isMe only): a sent bubble here
                              // drops the "msg-sent" class entirely and picks up "msg-received"
                              // instead — not just a cosmetic swap. App.jsx's global light-theme
                              // stylesheet has an unconditional `.msg-sent, .msg-sent *{ color:
                              // #fff !important }` rule with no wallpaper awareness at all, which
                              // was silently white-texting every sent bubble's contents in light
                              // mode (call-log cards, plain message text, everything without its
                              // own narrower wp-sent-black override) — losing to nothing beats
                              // !important short of not carrying the class at all. Actually
                              // switching to msg-received sidesteps that rule completely instead of
                              // trying to out-specificity it again.
                              className={`msg-bubble${activeWallpaper ? ' on-wallpaper' : ''}${activeWallpaperIsZen ? ' wp-sent-black' : ''} ${(isMe && !paintSentAsReceived)
                                ? `msg-sent${(!activeWallpaper || wallpaperIsDark) ? ' stay-white' : ''}`
                                : (activeWallpaper && wallpaperIsDark ? 'msg-received stay-white' : 'msg-received')}`}
                              onDoubleClick={(e) => { e.stopPropagation(); handleReact(msg.id, '❤️'); triggerReactionBurst(msg.id || i); }}
                              style={{
                                position: 'relative',
                                zIndex: 2,
                                // Polls get their own neutral card background when there's no
                                // wallpaper/theme — the vivid sent-bubble gradient (fine for a line
                                // of text) made option rows/vote bars unreadable once a poll's
                                // whole card was painted in it. A picked Chat Theme is the one
                                // exception: PollBubble's own text/track/option colors already
                                // flip to their white-on-dark set whenever it's handed accentColor
                                // (isMe && isCustomTheme && !wallpaper, same condition as here), so
                                // painting the card in the theme's gradient too is what actually
                                // makes a themed sent poll "look like dark mode" instead of just
                                // matching dark mode's neutral card by coincidence. Once a
                                // wallpaper IS active, polls (and a captioned image's caption row,
                                // and — see AudioPlayerBubble/FileCard's own wallpaperBg — voice
                                // notes/documents) instead follow the wallpaper's own opaque
                                // dominant color, the SAME value for both sent and received (unlike
                                // plain text's received bubble, which stays the translucent frosted
                                // wallpaperReceivedBg — these "card" UI types looked half-see-
                                // through with that treatment).
                                background: isMediaOnly ? 'transparent' : (activeWallpaper ? (
                                  (msg.isPoll || msg.mediaType)
                                    ? (wallpaperColor || 'rgba(255,255,255,0.25)')
                                    : ((isMe && !paintSentAsReceived) ? (wallpaperColor || 'rgba(255,255,255,0.25)') : wallpaperReceivedBg)
                                ) : (
                                  msg.isPoll ? ((isMe && isCustomTheme) ? activeTheme.gradient : (isLight ? '#ffffff' : '#1b1b25')) : (transparentMode ? 'rgba(0,0,0,0.3)' : (isMe
                                    ? (isCustomTheme ? activeTheme.gradient : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))')
                                    : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)')))
                                )),
                                // Same subtle frame for polls and a captioned image/video (WhatsApp
                                // draws a thin border around the whole image+caption block) — not
                                // for media-only (uncaptioned) messages, which stay edge-to-edge
                                // borderless like WhatsApp's own uncaptioned photos, and not on a
                                // wallpaper, whose own opaque bubble color already reads as a frame.
                                border: ((msg.isPoll || (msg.mediaType && !isMediaOnly)) && !activeWallpaper) ? `1px solid ${isLight ? '#e6e9ef' : 'rgba(255,255,255,0.08)'}` : 'none',
                                boxShadow: ((msg.isPoll || (msg.mediaType && !isMediaOnly)) && !activeWallpaper) ? (isLight ? '0 1px 3px rgba(15,23,42,0.06)' : '0 2px 10px rgba(0,0,0,0.25)') : 'none',
                                // Skipped for captioned media and polls — both are now opaque
                                // (see background above), so blurring the wallpaper behind them is
                                // a no-op that, combined with this element's own overflow:hidden +
                                // border-radius clip, triggers a real Chromium rendering bug: the
                                // blur backdrop isn't clipped cleanly at the rounded corners,
                                // showing as a faint gap/glow at the edges — only ever visible on
                                // received bubbles, since sent bubbles never get backdropFilter.
                                ...(activeWallpaper && (!isMe || paintSentAsReceived) && !isMediaOnly && !msg.mediaType && !msg.isPoll ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {}),
                                // isMe + custom theme: every sent bubble reads its own slice of ONE
                                // continuous gradient spanning the whole conversation (index-based
                                // background-position/-size — see CHAT_THEME_BUBBLE_STRIDE), instead
                                // of each bubble independently repeating the full gradient. That's
                                // what makes older vs. newer sent messages land in a visibly
                                // different shade, matching Instagram's own per-conversation theme.
                                // Not applied for a Background/wallpaper theme — its sent-bubble
                                // color is one flat color extracted from the image (see
                                // wallpaperColor), not a multi-stop gradient to slice.
                                ...(isMe && isCustomTheme && !isMediaOnly && !activeWallpaper && !msg.isPoll ? {
                                  backgroundSize: `100% ${Math.max(messages.length, 1) * CHAT_THEME_BUBBLE_STRIDE}px`,
                                  backgroundPosition: `0 -${i * CHAT_THEME_BUBBLE_STRIDE}px`,
                                } : {}),
                                padding: msg.mediaType ? '0' : '10px 16px',
                                // A captioned image clips to the bubble's own rounded
                                // corners (see flexDirection below) instead of showing its
                                // own separately-rounded corners floating inside — see the
                                // flush param passed to renderMedia further down.
                                overflow: (msg.mediaType && !isMediaOnly) ? 'hidden' : 'visible',
                                borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                fontSize: 14,
                                color: activeWallpaper ? wallpaperTextColor : (msg.isPoll ? (isLight ? '#0f172a' : '#ffffff') : (transparentMode ? '#fff' : (isMe ? '#ffffff' : (isLight ? '#000000' : '#ffffff')))),
                                textShadow: (msg.isPoll || !transparentMode) ? 'none' : '0 1px 4px rgba(0,0,0,0.8)',
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                                transform: `translateX(${rowDragX}px)`,
                                transition: rowDragging ? 'none' : (rowBounce ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.2s ease'),
                                display: isMediaOnly ? 'block' : 'flex',
                                // Captioned media stacks in a column (image on top, caption
                                // row directly under it, WhatsApp-style) so the caption's
                                // width — and therefore how far the tick sits from the text —
                                // is bounded by the image's own rendered width instead of the
                                // whole chat panel. Plain text/poll bubbles keep the original
                                // wrapping row (text + tick, tick wraps below if text is long).
                                flexDirection: (msg.mediaType && !isMediaOnly) ? 'column' : 'row',
                                flexWrap: (msg.mediaType && !isMediaOnly) ? 'nowrap' : 'wrap',
                                alignItems: (msg.mediaType && !isMediaOnly) ? 'stretch' : 'flex-end',
                                columnGap: (msg.mediaType && !isMediaOnly) ? 0 : 6
                              }}
                            >
                              {/* Captioned media renders its image/video first (flush, full
                                  width) — the caption+tick row further below renders after it
                                  instead of before, so it lands underneath, not on top. */}
                              {(msg.mediaType && !isMediaOnly) && mediaNode}
                              {/* maxWidth:300 matches renderMedia's own hard-coded image cap
                                  (see the mediaNode wrapper's maxWidth:300). Without it, a long
                                  caption's max-content width (its full unwrapped line length) is
                                  what this flex COLUMN auto-sizes to — align-items:stretch then
                                  stretched the image wrapper along for the ride, so the whole
                                  bubble (border/background included) visibly grew past the
                                  image's own 300px, with the caption spilling out unwrapped
                                  alongside it. Capping this row's own contribution to the
                                  column's width forces the caption to actually wrap at 300px,
                                  the same width the image already renders at. */}
                              <div style={{ display: isMediaOnly ? 'contents' : 'flex', alignItems: 'flex-end', columnGap: 6, minWidth: 0, ...(msg.mediaType && !isMediaOnly ? { padding: '6px 10px 8px', maxWidth: 300 } : {}) }}>
                              <div style={{ flex: isMediaOnly ? undefined : '0 1 auto', minWidth: 0 }}>
                                {!msg.mediaType && msg.forwarded && (
                                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontStyle:'italic', opacity:0.75, marginBottom:2 }}>
                                    <Forward size={11} /> Forwarded
                                  </div>
                                )}
                                {(!msg.mediaType && !msg.message && !msg.e2ee && !msg.nonce) ? (
                                  <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, fontStyle:'italic'}}>{t('messageUnavailable', '[Message unavailable]')}</div>
                                ) : msg.isPoll ? (
                                  (() => {
                                    let pollDef = null;
                                    try { pollDef = JSON.parse(msg.decryptedText); } catch {}
                                    if (!pollDef) return <MessageText text="📊 Poll" isMe={isMe} isLight={isLight} />;
                                    const resolveAvatar = (u) => {
                                      const uname = (u || '').toLowerCase();
                                      // Check "is this voter the poll's SENDER" first — msg.
                                      // senderAvatar is only ever that person's avatar, so using
                                      // it for "is this voter me" instead (checked first) leaked
                                      // the sender's own avatar onto MY vote on someone ELSE's
                                      // poll whenever they happened to have one set.
                                      if (uname === (msg.senderName || '').toLowerCase()) return getAvatarUrl(msg.senderAvatar);
                                      // My own vote on a poll I did NOT send: our own optimistic
                                      // send never carries a senderAvatar, and a group poll
                                      // someone else sent never carries mine at all — myAvatarUrl
                                      // (fetched once above) is the only correct source here.
                                      if (uname === myUsername.toLowerCase()) return myAvatarUrl;
                                      if (activeChat?.type === 'private' && uname === (activeChat.partner || '').toLowerCase()) {
                                        return getAvatarUrl(activeChat.partnerAvatar) || findAvatarFromMessages(uname, messages);
                                      }
                                      // Any other voter (a group poll's other members): reuse
                                      // their avatar from any OTHER message they've sent in this
                                      // chat, same fallback the poll-votes modal below uses.
                                      return findAvatarFromMessages(uname, messages);
                                    };
                                    return (
                                      <PollBubble
                                        poll={pollDef}
                                        pollVotes={msg.pollVotes}
                                        myUsername={myUsername}
                                        onVote={(indices) => handlePollVote(msg, indices)}
                                        onViewVotes={() => setPollVotesTargetKey(String(msg.id || msg.timestamp))}
                                        // Same white-on-wallpaper rule as fc-name/rcp-vn-* —
                                        // the option-circle border, checkmark, and text all key
                                        // off this same isLight prop internally.
                                        isLight={isLight && !activeWallpaper}
                                        resolveAvatar={resolveAvatar}
                                        accentColor={(isMe && isCustomTheme && !activeWallpaper) ? getThemeSolidColor(activeTheme) : null}
                                        isMe={isMe}
                                        wallpaperActive={!!activeWallpaper}
                                      />
                                    );
                                  })()
                                ) : (msg.decryptedText && msg.decryptedText.startsWith(CALL_LOG_PREFIX)) ? (
                                  (() => {
                                    let callData = null;
                                    try { callData = JSON.parse(msg.decryptedText.slice(CALL_LOG_PREFIX.length)); } catch {}
                                    if (!callData) return <MessageText text="Call" isMe={isMe} isLight={isLight} />;
                                    return (
                                      <CallLogBubble
                                        data={callData}
                                        isMe={isMe}
                                        myUsername={myUsername}
                                        wallpaperTextColor={activeWallpaper ? wallpaperTextColor : null}
                                        onRedial={activeChat?.type === 'private' && !call.callState ? () => { if (!canMakeCalls) { setShowCallInstallPrompt(true); return; } call.startCall(activeChat.partner, callData.callType, activeChat.displayName, activeChat.partnerAvatar); } : undefined}
                                      />
                                    );
                                  })()
                                ) : msg.decryptedText !== null ? (
                                  <MessageText text={msg.decryptedText} isMe={isMe} isLight={isLight} />
                                ) : (
                                  (!msg.mediaType && msg.message && looksLikeCiphertext(msg.message)) ? (
                                    <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                                  ) : (
                                    msg.message && !msg.mediaType && <MessageText text={msg.message} isMe={isMe} isLight={isLight} />
                                  )
                                )}
                              </div>
                              {!isMediaOnly && isMe && (
                                <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingBottom: 1 }}>
                                  <MessageTick msg={msg} username={myUsername} isLight={isLight} />
                                </div>
                              )}
                              </div>
                              {isMediaOnly && mediaNode}
                            </div>
                            {/* msg-hover-menu (chevron + its dropdown) and the
                                emoji-picker/long-press/react-btn siblings below are all
                                deliberately OUTSIDE .msg-bubble, not nested inside it — a
                                captioned media bubble sets overflow:'hidden' on itself (to
                                clip the flush image to its own rounded corners), which was
                                silently clipping the hover-menu's dropdown away for any
                                message with BOTH media and a caption. It also fixed a second,
                                separate bug: nested inside the bubble (itself position:relative
                                with its own z-index:2, its own stacking context), the dropdown's
                                z-index:100 only ever won against other things INSIDE that same
                                context — against react-btn-container (a real sibling, z-index:10,
                                outside the bubble), the whole bubble's z-index:2 lost regardless,
                                so the quick-react emoji button rendered on top of an open menu.
                                Living out here as a real sibling lets z-index compare normally. */}
                            {/* hoveredRowId (set on the row wrapper above, covering both
                                the bubble and this sibling menu) rather than a
                                bubble-only hover state — the menu used to vanish the
                                instant the cursor moved from the bubble onto the
                                button/dropdown itself, since that crossed out of a
                                bubble-only mouseenter/mouseleave region into empty
                                space between two separate elements. */}
                            {(hoveredRowId === (msg.id||i) || activeMessageMenu === msg.id) && (
                              <div className="msg-hover-menu" style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                <button className={(!isMe && isLight) ? 'stay-white' : ''} onClick={(e)=>{ e.stopPropagation(); if (activeMessageMenu !== msg.id) {
                                  // Measured from the ROW's own bottom edge, not the click
                                  // point — this chevron sits pinned near the row's TOP
                                  // corner regardless of the row's actual height, so for a
                                  // tall row (a poll, an image) e.clientY here reads roughly
                                  // as the row's TOP position even when its bottom — where a
                                  // "down"-opening menu actually renders — is right up
                                  // against the composer. See the identical long-press fix.
                                  const rowEl = e.currentTarget.closest('.msg-row');
                                  const floorRef = rowEl ? rowEl.getBoundingClientRect().bottom : e.clientY;
                                  setDropdownPlacement((getMenuFloorY(e.currentTarget, wrapperRef.current) - floorRef) < 240 ? 'up' : 'down');
                                } setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowChatMenu(false); setShowAllEmojis(false); setActiveReactionMsg(null); }} style={{background: (!isMe && isLight) ? 'rgba(0,0,0,0.4)' : ((isLight && msg.mediaType) ? 'rgba(0,0,0,0.5)' : (isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)')),backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: '#fff',WebkitTextFillColor: '#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                  <ChevronDown size={14}/>
                                </button>
                                {activeMessageMenu === msg.id && (
                                  <div className="menu-dropdown" style={{
                                    position:'absolute',
                                    [dropdownPlacement === 'up' ? 'bottom' : 'top']: '100%',
                                    [dropdownPlacement === 'up' ? 'marginBottom' : 'marginTop']: 4,
                                    // Always anchored to the bubble's own right edge, growing
                                    // LEFTWARD into the bubble — never grows rightward off of
                                    // the bubble's left edge anymore (that used to be the
                                    // behavior for a received, non-media bubble specifically),
                                    // since a received bubble can sit close enough to the
                                    // panel's own right edge that growing further right pushed
                                    // the menu past the panel — even past the whole app window
                                    // — instead of staying "on top of" the message it belongs
                                    // to. Anchoring to the bubble's own right edge keeps the
                                    // menu's growth bounded by the bubble's own width, which is
                                    // always within the panel, regardless of sender.
                                    right:0,
                                    background:'var(--dropdown-bg)', border:'1px solid var(--dropdown-border)',
                                    borderRadius:12, padding:6, zIndex:100,
                                    boxShadow:'var(--dropdown-shadow)', minWidth: 145,
                                    WebkitTextFillColor: 'currentColor', color: 'var(--menu-item-text)'
                                  }} onClick={e => e.stopPropagation()}>
                                    {!!getMessageCopyText(msg) && (
                                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); copyMessageText(msg); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap'}}>
                                        <Copy size={12}/> {t('copy', 'Copy')}
                                      </button>
                                    )}
                                    {isMe ? (
                                      <>
                                        {isMessageEditable(msg) && (
                                          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (msg.isPoll) { setEditingPollMsg(msg); setShowPollComposer(true); } else { setReplyToMsg(null); setEditingMsg(msg); setInputValue(getMessageCopyText(msg)); } setActiveMessageMenu(null); }} className="chat-menu-item menu-btn" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap'}}>
                                            <Edit2 size={12}/> {t('edit', 'Edit')}
                                          </button>
                                        )}
                                        <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn menu-btn-danger" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap'}}>
                                          <Trash2 size={12}/> {t('unsend', 'Unsend')}
                                        </button>
                                        <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn menu-btn-del-me" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap'}}>
                                          <Trash2 size={12}/> {t('deleteForMe', 'Delete for me')}
                                        </button>
                                      </>
                                    ) : (
                                      <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn menu-btn-danger" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap'}}>
                                        <Trash2 size={12} color="#ef4444" style={{ color: '#ef4444' }}/> {t('delete', 'Delete')}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {activeReactionMsg === msg.id && !showAllEmojis && (
                              <div className="emoji-picker-container" style={{position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8, zIndex:100}}>
                                <div style={{
                                  background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,26,46,0.95)',
                                  backdropFilter:'blur(12px)',
                                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 30,
                                  padding:'6px 8px',
                                  display:'flex',
                                  alignItems:'center',
                                  gap:6,
                                  width:'max-content',
                                  boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 8px 24px rgba(0,0,0,0.6)'
                                }}>
                                  {(QUICK_EMOJIS).map(em=>(
                                    <button key={em} onClick={(e)=>{e.stopPropagation(); handleReact(msg.id, em); triggerReactionBurst(msg.id || i, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                  ))}
                                  <button onClick={(e)=>{e.stopPropagation(); setActiveReactionMsg(msg.id); setShowAllEmojis(true);}} style={{background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:12,width:26,height:26,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',color: isLight ? '#000' : '#fff',WebkitTextFillColor: isLight ? '#000' : '#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}><Plus size={14} color={isLight ? '#000' : '#fff'} style={{ color: isLight ? '#000' : '#fff', WebkitTextFillColor: isLight ? '#000' : '#fff' }}/></button>
                                </div>
                              </div>
                            )}
                            {showLongPressMenu && (
                              <div className="long-press-menu" ref={keepMenuInView} style={{
                                position:'absolute',
                                [longPressPlacement === 'up' ? 'bottom' : 'top']: '100%',
                                [longPressPlacement === 'up' ? 'marginBottom' : 'marginTop']: 8,
                                // Always right:0 (grows leftward into the bubble) — same fix
                                // as menu-dropdown above, for the same reason: anchored to the
                                // bubble's own edge instead of the panel's, so it can never
                                // grow past the panel regardless of sender.
                                right:0,
                                background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)',
                                borderRadius:14, padding:10, zIndex:100, display:'flex',
                                flexDirection:'column', gap:8, minWidth:180, boxShadow: 'var(--dropdown-shadow)', fontSize:13
                              }} onClick={e => e.stopPropagation()}>
                                <div style={{display:'flex',alignItems:'center',gap:4}}>
                                  {QUICK_EMOJIS.map(em=>(
                                    <button key={em} onClick={(e)=>{ e.stopPropagation(); handleReact(msg.id, em); triggerReactionBurst(msg.id || i, em); longPress.close(); }} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,padding:4,borderRadius:8}}>{em}</button>
                                  ))}
                                  <button onClick={(e)=>{ e.stopPropagation(); setActiveReactionMsg(msg.id); setShowAllEmojis(true); longPress.close(); }} style={{background: isLight ? '#d1d5db' : '#e2e8f0',border:'none',cursor:'pointer',width:30,height:30,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                    <Plus size={15} color="#000" style={{ WebkitTextFillColor: '#000' }}/>
                                  </button>
                                </div>
                                <div style={{height:1,background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}} />
                                {!!getMessageCopyText(msg) && (
                                  <button onClick={() => { copyMessageText(msg); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                    <Copy size={14}/> {t('copy', 'Copy')}
                                  </button>
                                )}
                                {isMe ? (
                                  <>
                                    {isMessageEditable(msg) && (
                                      <button onClick={() => { if (msg.isPoll) { setEditingPollMsg(msg); setShowPollComposer(true); } else { setReplyToMsg(null); setEditingMsg(msg); setInputValue(getMessageCopyText(msg)); } longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                        <Edit2 size={14}/> {t('edit', 'Edit')}
                                      </button>
                                    )}
                                    <button onClick={() => { handleDeleteMessage(msg.id || msg.timestamp, 'global'); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                      <Trash2 size={14}/> {t('unsend', 'Unsend')}
                                    </button>
                                    <button onClick={() => { handleDeleteMessage(msg.id || msg.timestamp, 'local'); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                      <Trash2 size={14}/> {t('deleteForMe', 'Delete for me')}
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => { handleDeleteMessage(msg.id || msg.timestamp, 'local'); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                    <Trash2 size={14}/> {t('delete', 'Delete')}
                                  </button>
                                )}
                                {canReport && (
                                  <button onClick={() => { setReportMsgTarget(msg); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                    <Flag size={14} /> {t('report', 'Report')}
                                  </button>
                                )}
                              </div>
                            )}

                                                    <div style={
                                      // Was overlaid on top of the media itself for isMediaOnly
                                      // (top-left corner) to dodge the panel's own edge — but
                                      // that's exactly the "on top of the message" placement the
                                      // user reported, for sent media/documents/voice notes, as
                                      // wrong: it should sit outside the bubble, the same way it
                                      // already does for polls and plain text. Unified onto that
                                      // one placement for every message type.
                                      {position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: (activeReactionMsg === msg.id || hoveredRowId === (msg.id||i)) ? 1 : 0, transition: 'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className={`react-btn-${msg.id||i} react-btn-container`}>
                              <button onClick={(e)=>{ e.stopPropagation(); setActiveReactionMsg(activeReactionMsg===msg.id?null:msg.id); setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: activeWallpaper ? 'rgba(255,255,255,0.85)' : (metaIsLight ? '#111' : '#aaa'),padding:2}}>
                                <SmilePlus size={16}/>
                              </button>
                            </div>
                          </div>

                          {/* Render active reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={{display:'flex',gap:4,marginTop:2,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start'}}>
                              {Object.entries(msg.reactions).map(([em, users]) => users.length > 0 && (
                                <span key={em} onClick={(e)=>{
                                  e.stopPropagation();
                                  // Who-reacted is a privacy-sensitive detail on the mandatory
                                  // SahaPlay announcements group specifically (every signed-in
                                  // user is a forced member, unlike a room/DM someone chose to
                                  // join) — restricted to the 'super_admin' role only, so
                                  // anyone else tapping a pill there just sees the emoji+count
                                  // that's already visible, no sheet.
                                  if (isSahaplayOfficialGroup(activeChat) && !activeChat?.isSuperAdmin) return;
                                  setReactorsSheet({ msgId: msg.id, emoji: em, users });
                                }} style={{background: metaIsLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.16)', border:`1px solid ${users.includes(myUsername)?'var(--brand-1)' : (metaIsLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`, borderRadius:12, padding:'2px 8px', fontSize:11, cursor: (isSahaplayOfficialGroup(activeChat) && !activeChat?.isSuperAdmin) ? 'default' : 'pointer', userSelect:'none', color: metaIsLight ? '#1e293b' : '#ddd'}}>
                                  {em} {users.length>1?users.length:''}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="msg-meta-row" style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                            {msg.edited && <span style={{fontSize:10,color: metaIsLight ? 'rgba(0,0,0,0.62)' : '#aaa'}}>{t('edited', 'Edited')}</span>}
                            <span style={{fontSize:10,color: metaIsLight ? 'rgba(0,0,0,0.62)' : '#aaa'}}>{formatTime(msg.timestamp)}</span>
                            {canReplyToMsg && (
                              <button onClick={(e) => { e.stopPropagation(); setReplyToMsg(msg); }} style={{background:'none',border:'none',color: metaIsLight ? '#555' : '#aaa',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                            )}
                            {canReport && (
                              <button onClick={(e) => { e.stopPropagation(); setReportMsgTarget(msg); }} title="Report this message" style={{background:'none',border:'none',color: metaIsLight ? '#555' : '#aaa',cursor:'pointer',padding:0,flexShrink:0}}><Flag size={9}/></button>
                            )}
                          </div>
                          {i === renderReceiptIndex && (
                            <ReadReceipt
                              msg={{
                                ...msg,
                                seenBy: effectiveSeenMap.get(String(msg.id || msg.timestamp)) || []
                              }}
                              isGroup={activeChat.type === 'room'}
                              username={myUsername}
                              socketServerUrl={API}
                              isLight={metaIsLight}
                            />
                          )}
                        </div>
                      </div>
                   </div>
                    </React.Fragment>
                  );
                });
              })()
              )}
              <div ref={messagesEndRef} style={{ height: 1 }} />
            </div>
          )}

          {/* Scroll to Bottom Button */}
          {showScrollArrow && view === 'chat' && (
            <div 
              onClick={(e) => { e.stopPropagation(); scrollToBottom(); }}
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                borderRadius: '50%',
                width: 42,
                height: 42,
                cursor: 'pointer',
                zIndex: 9999,
                boxShadow: '0 8px 20px rgba(var(--brand-1-rgb),0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                border: '2px solid rgba(255,255,255,0.15)',
                animation: 'msg-enter 0.4s ease forwards'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(var(--brand-1-rgb),0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(var(--brand-1-rgb),0.2)'; }}
            >
              <ArrowDown color="white" size={22} />
            </div>
          )}

        </div>

        {/* Input area for chat view */}
        {view === 'chat' && (
          // gcw-composer-bar: registered in App.jsx's light-mode fixed-overlay
          // exclusion list. This div is a direct child of the fixed
          // chat-widget-main-panel with its own inline `background` — that
          // override rule was matching it and forcing a solid #f7f8fc fill
          // in light mode even in the idle/transparent state above, which is
          // exactly what read as a leftover white strip under the composer.
          <div className="gcw-composer-bar" style={{
            padding: '12px 14px',
            // A wallpaper theme sits directly on the shared backdrop layer
            // instead of this bar painting its own opaque strip on top of
            // the picture — no border/tint here in that case, same as the
            // messages area right above it. A color-only theme (isCustomTheme
            // with no image) gets the same transparent treatment — it's only
            // meant to recolor bubble text, not paint a background strip
            // under the composer. That transparent treatment is overridden
            // the moment a reply/edit preview is showing though — its own
            // opaque fill (below) needs this wrapper solid too, or there's a
            // gap of wallpaper between the preview and the input row.
            // Matches Instagram: once you're replying, the whole composer
            // area reads as one solid surface. Otherwise fully transparent —
            // no background strip under the composer when not replying,
            // regardless of theme or wallpaper (the old default dark tint
            // showed up as an unwanted gray strip specifically in light
            // mode).
            borderTop: (activeWallpaper || isCustomTheme || transparentMode) ? 'none' : '1px solid rgba(255,255,255,0.05)',
            background: (replyToMsg || editingMsg) ? (isLight ? '#f1f5f9' : '#1c1c1e') : 'transparent',
            flexShrink: 0,
            position: 'relative'
          }}>
            {activeChat.type === 'private' && (
              activeChat.isBlocked || 
              activeChat.amIBlocked || 
              blockedChats.some(u => u.toLowerCase() === activeChat.partner.toLowerCase()) ||
              blockingMe.some(u => u.toLowerCase() === activeChat.partner.toLowerCase())
            ) ? (
              <div style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.07)', 
                borderRadius: 16, 
                padding: '16px 20px', 
                textAlign: 'center',
                marginBottom: 4
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Ban size={18} color="#ef4444" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  { (activeChat.isBlocked || blockedChats.some(u => u.toLowerCase() === activeChat.partner.toLowerCase())) ? 'You blocked this person' : "You can't message this person right now"}
                </div>
                <p style={{ fontSize: 11, color: '#888', margin: 0, lineHeight: 1.5 }}>
                  { (activeChat.isBlocked || blockedChats.some(u => u.toLowerCase() === activeChat.partner.toLowerCase())) ? 'Unblock them in your account settings to send messages.' : 'This user is currently unavailable.'}
                </p>
              </div>
            ) : (activeChat.type === 'private' && localStorage.getItem('watch_is_guest') === 'true') ? (
              <div className="blocked-banner-v2" onClick={() => navigate('/login')} style={{
                background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', 
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', 
                borderRadius: 16, 
                padding: '16px 20px', 
                textAlign: 'center',
                marginBottom: 4,
                cursor: 'pointer'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#1e293b' : '#fff', marginBottom: 4 }}>
                  {t('loginRequired', 'Login Required')}
                </div>
                <p style={{ fontSize: 11, color: isLight ? '#64748b' : '#888', margin: 0, lineHeight: 1.5 }}>
                  {t('loginToMessage', 'You need to be logged in to send private messages.')}
                </p>
                <a className="stay-white" href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }} style={{ display: 'inline-block', marginTop: 12, padding: '8px 20px', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', color: '#fff !important', borderRadius: 10, textDecoration: 'none', fontSize: 11, fontWeight: 800, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(var(--brand-1-rgb),0.2)' }}>
                  {t('logIn', 'Log In')}
                </a>
              </div>
            ) : activeChat.type === 'private' && activeRelation && !(activeRelation.followStatus === 'accepted' && activeRelation.isFollowingMe) ? (
              <div style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.07)', 
                borderRadius: 16, 
                padding: '16px 20px', 
                textAlign: 'center',
                marginBottom: 4
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Plus size={18} color="var(--brand-1)" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{t('friendshipRequired', 'Friendship Required')}</div>
                <p style={{ fontSize: 11, color: '#888', margin: 0, lineHeight: 1.5 }}>
                  {activeRelation.followStatus === 'accepted' 
                    ? t('waitingForFollowBack', { name: activeChat.displayName, defaultValue: `Waiting for ${activeChat.displayName} to follow you back.` }) 
                    : activeRelation.isFollowingMe 
                      ? t('needToFollowBack', { name: activeChat.displayName, defaultValue: `You need to follow ${activeChat.displayName} back to chat.` })
                      : t('needMutualFollow', 'You need to follow each other to start messaging.')}
                </p>
                <button className="stay-white" onClick={() => leaveChatToViewProfile(activeChat.partner)} style={{ marginTop: 12, padding: '8px 20px', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', borderRadius: 10, color: '#fff !important', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(var(--brand-1-rgb),0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(var(--brand-1-rgb),0.4)'; e.currentTarget.style.filter = 'brightness(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--brand-1-rgb),0.2)'; e.currentTarget.style.filter = 'brightness(1)'; }}>
                  {t('viewProfile', 'View Profile')}
                </button>
              </div>
            ) : (
              <>
                {replyToMsg && (
                  // Solid fill, not a faint tint the wallpaper/theme shows
                  // through — matches Instagram's reply preview (fully
                  // opaque, readable regardless of what's behind the
                  // composer). Same solid shade the composer's own input uses.
                  // Two-line layout ("Replying to X" then the quoted text
                  // below it) — matches Instagram exactly rather than the
                  // single-line "X: text" this used to show, and reads the
                  // same way in a private chat as it does in a group.
                  // Theme-aware fill (light gray in light mode, matching room
                  // chat's reply preview exactly — was hardcoded dark
                  // regardless of theme) and no top border: that border read
                  // as an unwanted divider line sitting on top of the preview.
                  <div style={{padding:'6px 12px',marginBottom:6,background: isLight ? '#f1f5f9' : '#1c1c1e',display:'flex',flexDirection:'column',gap:2,fontSize:12,color: isLight ? '#64748b' : '#a0aab2'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'var(--brand-1)',fontWeight:600}}>{t('replyingTo', 'Replying to')} {replyToMsg.senderName || replyToMsg.username || activeChat?.displayName}</span>
                      <button onClick={()=>setReplyToMsg(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer',display:'flex',alignItems:'center'}}><X size={18}/></button>
                    </div>
                    <span style={{opacity:0.85}}>{(() => {
                      const r = replyToMsg;
                      if (r.mediaType) { const rmt5=r.mediaType; return rmt5.startsWith('video')?'Video':rmt5.startsWith('image')?'Photo':rmt5.startsWith('audio')?'Voice Note':(r._fileName || r.mediaFileName || 'File'); }
                      if (r.isPoll || isPollJSON(r.decryptedText) || isPollJSON(r.message)) return '📊 Poll';
                      if (r.decryptedText) return r.decryptedText.slice(0,50);
                      const raw = r.message || '';
                      if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                      return raw.slice(0,50) || 'Media';
                    })()}</span>
                  </div>
                )}
                {editingMsg && (
                  // Same solid-fill treatment as the reply preview above.
                  <div style={{padding:'6px 12px',marginBottom:6,background: isLight ? '#f1f5f9' : '#1c1c1e',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color: isLight ? '#64748b' : '#a0aab2'}}>
                    <span style={{display:'flex',alignItems:'center',gap:6}}><Edit2 size={12} color="#38bdf8"/><span style={{color:'#38bdf8',fontWeight:600}}>{t('editingMessage', 'Editing message')}</span></span>
                    <button onClick={()=>{ setEditingMsg(null); setInputValue(''); }} style={{background:'none',border:'none',color:'#666',cursor:'pointer',display:'flex',alignItems:'center'}}><X size={18}/></button>
                  </div>
                )}

                {showEmojiPicker && (
                  <div className="emoji-picker-container" style={{position:'absolute', bottom:'100%', left:12, marginBottom:10, zIndex:100, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', borderRadius:10}} onMouseDown={(e) => e.stopPropagation()}>
                    <Picker data={data} onEmojiSelect={(e) => { setInputValue(prev => prev + e.native); }} theme={isLight ? 'light' : 'dark'} previewPosition="none" searchPosition="sticky" navPosition="bottom" />
                  </div>
                )}
                
                {/* Hidden file input — accepts all supported types; validateFile() enforces limits */}
                <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }}
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/mov,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/mpeg,audio/wav,audio/ogg,audio/m4a,audio/webm"
                  onChange={handleFileSelect} />


                {activeChat && typingStatuses[activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner] && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 45, marginBottom: 8, fontSize: 11, color: '#10b981', fontWeight: 500 }}>
                    {[...typingStatuses[activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner]].join(', ')} typing...
                  </div>
                )}

                {/* Nobody but an actual admin/super_admin can ever post in the SahaPlay
                    announcements group (enforced server-side regardless), so for every
                    other viewer the whole composer — banners, recording UI, textarea,
                    emoji/attach/mic/send — is skipped entirely rather than shown
                    disabled; there's nothing for them to do here at all. */}
                {(!isSahaplayOfficialGroup(activeChat) || isHost) && (
                <form ref={composerFormRef} onSubmit={(e) => {
                  handleSend(e);
                  // stop typing immediately on send
                  if (socketRef.current && activeChat) {
                    socketRef.current.emit('chat:stop_typing', {
                      partner: activeChat.type === 'room' ? activeChat.partner || activeChat.id : activeChat.partner,
                      type: activeChat.type
                    });
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

                  {/* Room restriction banners */}
                  {activeChat?.type === 'room' && !isHost && (chatLocked || linksBlocked || mediaBlocked) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {chatLocked && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#ef4444',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
                        }}>🔒 Host-only messaging</span>
                      )}
                      {linksBlocked && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#ef4444',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
                        }}>🔗 Links Disabled</span>
                      )}
                      {mediaBlocked && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#ef4444',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
                        }}>📷 Media Disabled</span>
                      )}
                    </div>
                  )}

                  {/* ── Voice recording / review UI (WhatsApp-style) ── */}
                  {(isRecording || (audioBlob && audioUrl)) && (
                    <VoiceRecorderBar
                      isRecording={isRecording}
                      recordingTime={recordingTime}
                      waveHeights={waveHeights}
                      audioUrl={audioUrl}
                      isLight={isLight}
                      isUploading={isUploading}
                      onCancel={cancelRecording}
                      onStop={stopRecording}
                      onSend={sendVoiceNote}
                    />
                  )}

                  {!isRecording && !audioBlob && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                        <textarea
                          className="chat-msg-textarea no-scrollbar"
                          ref={inputRef}
                          rows={1}
                          placeholder={
                            activeChat?.type === 'room' && chatLocked && !isHost
                              ? (isSahaplayOfficialGroup(activeChat) ? t('officialGroupReadOnly', 'Only SahaPlay admins can post here') : t('onlyHostCanMessage', 'Only the host can message...'))
                              : t('messagePlaceholder', 'Message...')
                          }
                          disabled={!!(activeChat?.type === 'room' && chatLocked && !isHost)}
                          value={inputValue}
                          onChange={e => {
                            setInputValue(enforceWordLimit(e.target.value));
                            if (socketRef.current && activeChat) {
                              socketRef.current.emit('chat:typing', {
                                partner: activeChat.type === 'room' ? activeChat.partner || activeChat.id : activeChat.partner,
                                type: activeChat.type
                              });
                              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                               typingTimeoutRef.current = setTimeout(() => {
                                 socketRef.current.emit('chat:stop_typing', {
                                   partner: activeChat.type === 'room' ? activeChat.partner || activeChat.id : activeChat.partner,
                                   type: activeChat.type
                                 });
                               }, 3000);
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                          // Re-captured on every physical tap, not just
                          // onFocus below: dismissing the on-screen keyboard
                          // via Android's back gesture doesn't always fire a
                          // real blur event, so the textarea can stay
                          // logically "focused" the whole time — meaning a
                          // second tap after scrolling up produced no fresh
                          // focus event at all, and wasNearBottomOnFocusRef
                          // kept whatever value it had from the FIRST tap
                          // (often true, from back when the user really was
                          // at the bottom), snapping the list back down every
                          // time regardless of where they'd since scrolled.
                          // pointerdown fires on every tap unconditionally,
                          // before the click/focus events, so it always
                          // re-measures the real pre-keyboard scroll position.
                          onPointerDown={() => { wasNearBottomOnFocusRef.current = isScrollNearBottom(); }}
                          style={{
                            flex: 1,
                            resize: 'none',
                            // Mirrors useAutoResizeTextarea's own default cap — this
                            // CSS max-height is just a defensive ceiling (the hook
                            // sets style.height directly, already capped), kept in
                            // sync so it's never a higher, inactive number here.
                            maxHeight: 68,
                            overflowY: 'auto',
                            lineHeight: 1.4,
                            fontFamily: 'inherit',
                            // Scopes the auto-resize hook's forced-reflow
                            // measurement (reading scrollHeight) to just this
                            // box instead of the whole message history in the
                            // same document — see useAutoResizeTextarea's own
                            // comment for the full reasoning.
                            contain: 'layout',
                            // A solid opaque fill, not a faint tint on top of
                            // whatever's behind the composer (page background
                            // or, with a wallpaper theme, the picture) — this
                            // box needs to read as a clearly defined input at
                            // a glance, regardless of what's behind the bar.
                            background: '#1c1c1e',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 14,
                            padding: '12px 18px',
                            paddingRight: (!inputValue && !isUploading) ? '108px' : '18px',
                            paddingLeft: (isMobileOrTablet && !inputValue && !isUploading) ? '40px' : '18px',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                            // NOT `transition: all` — this was also animating
                            // height (the textarea auto-resizes as you type)
                            // and the paddingLeft/paddingRight swap above,
                            // which stacked a 0.2s eased delay on top of the
                            // keyboard's own opening animation: the composer
                            // visibly kept settling into its final size/
                            // position for a moment after the keyboard was
                            // already up, reading as the box briefly showing
                            // underneath it. Only the two purely cosmetic
                            // focus/blur properties need to animate.
                            transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onFocus={e => {
                            e.target.style.background = '#242426';
                            e.target.style.borderColor = 'rgba(var(--brand-1-rgb),0.3)';
                            composerFocusedRef.current = true;
                            // Measured now, before the keyboard has resized
                            // anything — see wasNearBottomOnFocusRef's comment.
                            wasNearBottomOnFocusRef.current = isScrollNearBottom();
                            // Instant, and fired right away (not a 300ms-later
                            // guess) — this is only the fallback for a WebView
                            // with no VisualViewport API at all; wherever that
                            // API does exist, useVisualViewportResize's own
                            // debounced handler above is what actually reacts
                            // once the keyboard's resize has settled. The old
                            // 300ms delay plus a smooth-scroll here is what
                            // read as the composer sitting under the keyboard
                            // for a beat before slowly sliding into place.
                            if (wasNearBottomOnFocusRef.current) { try { scrollToBottom(true); } catch {} }
                          }}
                          onBlur={e => { e.target.style.background = '#1c1c1e'; e.target.style.borderColor = 'rgba(255,255,255,0.08)'; composerFocusedRef.current = false; }}
                        />

                        {!inputValue && !isUploading && (
                          <>
                            {/* Mobile/tablet only: emoji lives on the far left of the box
                                instead of grouped with the other icons on the right. */}
                            {isMobileOrTablet && (
                              <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                                <button type="button" className="emoji-toggle-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background:'transparent', border:'none', color:'#ffffff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}>
                                  <SmilePlus size={20} />
                                </button>
                              </div>
                            )}
                            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 2 }}>
                              {!isMobileOrTablet && (
                                <button type="button" className="emoji-toggle-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background:'transparent', border:'none', color:'#ffffff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}>
                                  <SmilePlus size={20} />
                                </button>
                              )}
                              {/* Attachment button — opens a small "Browse / Poll" menu instead
                                  of the file picker directly, so a poll has somewhere to live
                                  alongside the existing file-attach flow. */}
                              <div style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  className="chat-attach-toggle-btn"
                                  disabled={isUploading || !!(activeChat?.type === 'room' && mediaBlocked && !isHost)}
                                  onClick={() => {
                                    if (activeChat?.type === 'room' && mediaBlocked && !isHost) {
                                      toast.error('📷 Media sharing is not allowed in this room.');
                                      return;
                                    }
                                    setShowAttachMenu(v => !v);
                                  }}
                                  title="Attach"
                                  style={{ background:'transparent', border:'none', color: isUploading ? 'var(--brand-1)' : '#ffffff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4, opacity: (activeChat?.type === 'room' && mediaBlocked && !isHost) ? 0.4 : 1 }}
                                >
                                  <Paperclip size={18} />
                                </button>
                                {showAttachMenu && (
                                  // Plain absolutely-positioned popup, closed by the
                                  // document-level click listener below — a previous
                                  // version used a full-screen position:fixed catcher
                                  // div instead, which a click landing on a message row
                                  // (plain tap, long-press, or otherwise) wasn't reliably
                                  // reaching, leaving the menu stuck open. This mirrors
                                  // the same closest()-based pattern already used for
                                  // showEmojiPicker/activeMessageMenu/etc above instead
                                  // of inventing a second mechanism.
                                  <div
                                    className="chat-attach-menu-popup"
                                    style={{
                                      position: 'absolute', bottom: 46, right: 0, minWidth: 180, zIndex: 100020,
                                      background: isLight ? '#fff' : '#1c1c22', borderRadius: 14,
                                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                      boxShadow: '0 12px 32px rgba(0,0,0,0.35)', overflow: 'hidden', padding: 6,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAttachMenu(false);
                                        fileInputRef.current?.click();
                                      }}
                                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: isLight ? '#0f172a' : '#fff', fontSize: 13.5, fontWeight: 600 }}
                                    >
                                      <ImageIcon size={17} color="#3b82f6" /> Browse
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setShowAttachMenu(false); setEditingPollMsg(null); setShowPollComposer(true); }}
                                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', color: isLight ? '#0f172a' : '#fff', fontSize: 13.5, fontWeight: 600 }}
                                    >
                                      <BarChart2 size={17} color="#f59e0b" /> Poll
                                    </button>
                                  </div>
                                )}
                              </div>
                              {/* Mic button — inside input box, hidden while typing */}
                              <button
                                type="button"
                                onClick={startRecording}
                                title="Record voice note"
                                style={{ background:'transparent', border:'none', color:'#ffffff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}
                              >
                                <Mic size={18} />
                              </button>
                              {/* Camera button — mobile/tablet only, opens in-app capture. Sits
                                  after mic (not between attach and mic) per explicit request. */}
                              {isMobileOrTablet && (
                                <button
                                  type="button"
                                  disabled={isUploading || !!(activeChat?.type === 'room' && mediaBlocked && !isHost)}
                                  onClick={() => {
                                    if (activeChat?.type === 'room' && mediaBlocked && !isHost) {
                                      toast.error('📷 Media sharing is not allowed in this room.');
                                      return;
                                    }
                                    setShowCamera(true);
                                  }}
                                  title="Open camera"
                                  style={{ background:'transparent', border:'none', color: isUploading ? 'var(--brand-1)' : '#ffffff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4, opacity: (activeChat?.type === 'room' && mediaBlocked && !isHost) ? 0.4 : 1 }}
                                >
                                  <Camera size={18} />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        {/* Portal to document.body — same reasoning as
                            RoomChatPanel's own CameraCapture usage: rendered
                            inline, this widget's own frequent re-renders
                            (a socket message landing in an unrelated chat,
                            the 5s unread poll, etc.) reflow/repaint this
                            whole nested subtree while the camera is open,
                            which is what read as taps on Send/gallery not
                            registering the first time. Portaling it out
                            makes it a stable, independent top-level tree
                            that this widget's own re-renders never touch. */}
                        {showCamera && createPortal(
                          <CameraCapture
                            onCapture={async (file, caption) => {
                              // Caption rides along in the SAME message as the
                              // image (WhatsApp-style), not as a second,
                              // separate text message sent right after.
                              await handleMediaUpload(file, null, null, caption && caption.trim() ? caption.trim() : '');
                            }}
                            onClose={() => setShowCamera(false)}
                          />,
                          document.body
                        )}
                        {showPollComposer && (
                          <PollComposer
                            isLight={isLight}
                            title={editingPollMsg ? 'Edit poll' : 'Create poll'}
                            initialPoll={editingPollMsg ? (() => { try { return JSON.parse(editingPollMsg.decryptedText); } catch { return null; } })() : null}
                            onClose={() => { setShowPollComposer(false); setEditingPollMsg(null); }}
                            onSend={(pollDef) => {
                              setShowPollComposer(false);
                              if (editingPollMsg) { submitPollEdit(editingPollMsg, pollDef); setEditingPollMsg(null); }
                              else sendPollMessage(pollDef);
                            }}
                          />
                        )}

                        {isUploading && (
                          <div style={{ position: 'absolute', right: 12 }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} color="var(--brand-1)" />
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={(!inputValue.trim() && !isUploading) || !!(activeChat?.type === 'room' && chatLocked && !isHost)}
                        // Tapping a button naturally blurs whatever was
                        // focused first, THEN the click fires — on mobile
                        // that's the on-screen keyboard visibly closing and
                        // reopening (the requestAnimationFrame refocus below
                        // in handleSend brings it back a frame later), which
                        // read as a flicker. preventDefault on the pointer-
                        // down itself stops the browser from ever moving
                        // focus off the input in the first place, so the
                        // keyboard never even starts to animate closed.
                        onMouseDown={e => e.preventDefault()}
                        onTouchStart={e => e.preventDefault()}
                        style={{
                        width:44, height:44, borderRadius:10, background:'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border:'none', cursor: (activeChat?.type === 'room' && chatLocked && !isHost) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:((!inputValue.trim() && !isUploading) || (activeChat?.type === 'room' && chatLocked && !isHost))?0.5:1, flexShrink: 0
                      }}>
                        <Send size={18} color="#fff" />
                      </button>
                    </div>
                  )}
                </form>
                )}
              </>
            )}
          </div>
        )}
        {pollVotesTargetKey && (() => {
          const pollVotesTarget = messages.find(m => String(m.id || m.timestamp) === pollVotesTargetKey);
          if (!pollVotesTarget) return null;
          let poll = null;
          try { poll = JSON.parse(pollVotesTarget.decryptedText); } catch {}
          if (!poll) return null;
          const resolveAvatar = (u) => {
            const uname = (u || '').toLowerCase();
            // See the identical ordering comment on the poll bubble's own
            // resolveAvatar above — sender check has to come first.
            if (uname === (pollVotesTarget.senderName || '').toLowerCase()) return getAvatarUrl(pollVotesTarget.senderAvatar);
            if (uname === myUsername.toLowerCase()) return myAvatarUrl;
            if (activeChat?.type === 'private' && uname === (activeChat.partner || '').toLowerCase()) {
              return getAvatarUrl(activeChat.partnerAvatar) || findAvatarFromMessages(uname, messages);
            }
            return findAvatarFromMessages(uname, messages);
          };
          const resolveDisplayName = (u) => {
            const uname = (u || '').toLowerCase();
            if (uname === myUsername.toLowerCase()) return 'You';
            if (activeChat?.type === 'private' && uname === (activeChat.partner || '').toLowerCase()) return activeChat.displayName || activeChat.partner;
            return u;
          };
          return (
            <PollVotesModal
              poll={poll}
              pollVotes={pollVotesTarget.pollVotes}
              onClose={() => setPollVotesTargetKey(null)}
              isLight={isLight}
              resolveAvatar={resolveAvatar}
              resolveDisplayName={resolveDisplayName}
            />
          );
        })()}
        {/* Chat bubble "Customize" theme sheet — opened via the "Chat theme"
            item in either the open-chat header menu or a conversation row's
            "..." menu (see themeSheetTarget). Tapping a swatch applies +
            persists it immediately (server + local cache) and closes the
            sheet; no separate "Apply" step. */}
        {showThemeSheet && themeSheetTarget && createPortal(
          <div
            onMouseDown={() => setShowThemeSheet(false)}
            className="chat-theme-sheet-overlay"
            style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <div
              onMouseDown={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
                // Without this, scrolling this list to its end and
                // continuing to scroll "chained" straight through to the
                // page behind the (fixed, full-screen) backdrop — on a
                // desktop/laptop with a real scroll wheel this was very
                // noticeable as the whole site scrolling underneath the
                // modal. overscrollBehavior stops the scroll gesture at
                // this container's own boundary instead of handing it off.
                overscrollBehavior: 'contain',
                background: isLight ? '#ffffff' : '#111114', borderRadius: '24px 24px 0 0', padding: '10px 20px 28px',
                boxShadow: '0 -20px 60px rgba(0,0,0,0.6)', animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="no-scrollbar"
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.25)', margin: '4px auto 16px' }} />
              <div style={{ textAlign: 'center', color: isLight ? '#0f172a' : '#fff', fontWeight: 800, fontSize: 17, marginBottom: 16 }}>
                {t('customizeChat', 'Customize')}
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }} className="no-scrollbar">
                {CHAT_CATEGORIES.map(cat => {
                  const active = themeCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setThemeCategoryFilter(cat.id)}
                      // stay-white: light mode has a global rule that turns any
                      // inline white-ish text black (see App.jsx) — without this,
                      // the selected pill's deliberately-white text on its purple
                      // fill was getting auto-darkened, unreadable-looking.
                      className={active ? 'stay-white' : undefined}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: 'none',
                        fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
                        background: active ? sheetFilterAccent : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)'),
                        color: active ? '#ffffff' : (isLight ? '#475569' : '#cbd5e1'),
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const wallpapersToShow = CHAT_WALLPAPERS.filter(w => themeCategoryFilter === 'all' || w.category === themeCategoryFilter);
                const showColors = themeCategoryFilter === 'all' || themeCategoryFilter === 'colors';
                const showWallpapers = themeCategoryFilter !== 'colors';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {showColors && (
                      <>
                        {themeCategoryFilter === 'all' && (
                          <div style={{ textAlign: 'center', color: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            {t('colors', 'Colors')}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                          {CHAT_THEMES.map(th => {
                            const selected = th.id === sheetThemeId;
                            return (
                              <button
                                key={th.id}
                                onClick={() => { applyChatTheme(themeSheetTarget, th.id); setShowThemeSheet(false); }}
                                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                              >
                                <div style={{
                                  width: '100%', aspectRatio: '3/4', borderRadius: 16, backgroundImage: th.gradient,
                                  border: selected ? '3px solid #fff' : '3px solid transparent',
                                  boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.4)',
                                }} />
                                <span style={{ color: isLight ? '#0f172a' : '#fff', fontSize: 13, fontWeight: selected ? 800 : 500, opacity: selected ? 1 : 0.85 }}>{t(`chatTheme${th.id.charAt(0).toUpperCase()}${th.id.slice(1)}`, th.name)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {showWallpapers && (
                      <>
                        {themeCategoryFilter === 'all' && (
                          <div style={{ textAlign: 'center', color: isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12, letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: 10 }}>
                            {t('chatBackgrounds', 'Backgrounds')}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                          {wallpapersToShow.map(w => {
                            const selected = w.id === sheetThemeId;
                            const bgKey = `chatBg${w.id.replace(/^wp-/, '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
                            return (
                              <button
                                key={w.id}
                                onClick={() => { applyChatTheme(themeSheetTarget, w.id); setShowThemeSheet(false); }}
                                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                              >
                                <div style={{
                                  width: '100%', aspectRatio: '3/4', borderRadius: 16,
                                  backgroundImage: `url("${w.image}")`, backgroundSize: 'cover', backgroundPosition: 'center',
                                  border: selected ? '3px solid #fff' : '3px solid transparent',
                                  boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.4)',
                                }} />
                                <span style={{ color: isLight ? '#0f172a' : '#fff', fontSize: 13, fontWeight: selected ? 800 : 500, opacity: selected ? 1 : 0.85, textAlign: 'center', wordBreak: 'break-word' }}>{t(bgKey, w.name)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>,
          document.body
        )}
        {/* Block User Confirmation Modal */}
         {blockUserPending && createPortal(
          <div onMouseDown={e => e.stopPropagation()} className="chat-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(12px) saturate(180%)', WebkitBackdropFilter: 'blur(12px) saturate(180%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div className="chat-modal-box" style={{ background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(10px)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', borderRadius: 32, padding: 32, width: '100%', maxWidth: 380, boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ban size={22} color="#ef4444" />
                </div>
                <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Block User?</h3>
              </div>
              <p style={{ color: isLight ? '#475569' : '#aaa', fontSize: 15, marginBottom: 24, lineHeight: 1.4 }}>
                Are you sure you want to block <strong>{blockUserPending.displayName || blockUserPending.partner}</strong>? They won't be able to message you or view your profile.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setBlockUserPending(null)} 
                  className="modal-btn-transition"
                  style={{ padding: '14px 28px', background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff', cursor: 'pointer', fontWeight: 800, borderRadius: 18, fontSize: 15 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    toggleBlockChat(blockUserPending.partner || blockUserPending.id);
                    setBlockUserPending(null);
                  }} 
                  className="modal-btn-transition danger-red-btn stay-white"
                  style={{ padding: '14px 36px', background: '#ef4444', border: 'none', borderRadius: 18, color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 15, boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)' }} 
                >
                  <span className="stay-white" style={{color: '#fff'}}>Block</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Clear Chat Modal */}
        {clearChatModalOpen && createPortal(
          <div onMouseDown={e => e.stopPropagation()} className="chat-modal-overlay" style={{position:'fixed',inset:0,zIndex:999999,background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 0, 0, 0.65)',backdropFilter:'blur(12px) saturate(180%)',WebkitBackdropFilter:'blur(12px) saturate(180%)',display:'flex',alignItems:'center',justifyContent:'center', padding: 20}}>
            <div className="chat-modal-box" style={{background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(10px)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',borderRadius:32,padding:32,width:'100%',maxWidth:380, boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={22} color="#ef4444" />
                </div>
                <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Clear Chat</h3>
              </div>
              <p style={{color: isLight ? '#475569' : '#aaa',fontSize:15,marginBottom:16,lineHeight:1.4}}>
                Are you sure you want to clear your chat history with <strong>{clearChatModalOpen.displayName || clearChatModalOpen.partner}</strong>? {clearForBoth ? 'This will clear messages for both of you.' : 'This will clear messages for your view only.'}
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24, fontSize: 14, color: isLight ? '#334155' : '#cbd5e1', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={clearForBoth}
                  onChange={e => setClearForBoth(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#ef4444', cursor: 'pointer', borderRadius: 4 }}
                />
                <span>Also clear for <strong>@{clearChatModalOpen.displayName || clearChatModalOpen.partner}</strong></span>
              </label>
              <div style={{display:'flex',gap:14,justifyContent:'flex-end'}}>
                <button onClick={()=>{ setClearChatModalOpen(false); setClearForBoth(false); }} className="modal-btn-transition" style={{padding:'14px 28px',background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:800, borderRadius: 18, fontSize: 15}}>Cancel</button>
                <button onClick={()=>{
                  const dmPartner = clearChatModalOpen?.partner;
                  const dmPartnerLower = (dmPartner || '').toLowerCase();
                  if (socketRef.current) socketRef.current.emit('clear_dm', { targetUsername: dmPartner, clearForBoth: clearForBoth });
                  // Cancel any in-flight history fetch so it can't restore cleared messages
                  latestHistoryRequestRef.current++;
                  // Prevent loadMoreHistory from fetching pre-clear pages
                  paginationStateRef.current[dmPartnerLower] = { hasMore: false, isLoading: false };
                  // Optimistic UI clear for both "clear for me" and "clear for both"
                  if ((activeChatRef.current?.partner || '').toLowerCase() === dmPartnerLower ||
                      (activeChatRef.current?.id || '').toLowerCase() === dmPartnerLower) {
                    setMessages([]);
                  }
                  setConversations(prev => prev.map(c =>
                    (c.partner || '').toLowerCase() === dmPartnerLower
                      ? { ...c, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() }
                      : c
                  ));
                  setClearChatModalOpen(false);
                  setClearForBoth(false);
                  toast.success(clearForBoth ? 'Chat history cleared for both users' : 'Chat history cleared');
                }} className="modal-btn-transition danger-red-btn stay-white" style={{padding:'14px 36px',background:'#ef4444',border:'none',borderRadius:18,color:'#fff',cursor:'pointer',fontWeight:900, fontSize: 15, boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)'}}>
                  <span className="stay-white" style={{color: '#fff'}}>Clear Chat</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bulk delete confirmation for multi-selected messages */}
        {bulkDeleteConfirm && createPortal(
          <div onMouseDown={e => e.stopPropagation()} className="chat-modal-overlay" style={{position:'fixed',inset:0,zIndex:999999,background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 0, 0, 0.65)',backdropFilter:'blur(12px) saturate(180%)',WebkitBackdropFilter:'blur(12px) saturate(180%)',display:'flex',alignItems:'center',justifyContent:'center', padding: 20}}>
            <div className="chat-modal-box" style={{background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(10px)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',borderRadius:32,padding:32,width:'100%',maxWidth:380, boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={22} color="#ef4444" />
                </div>
                <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Delete {selectedMsgIds.size} message{selectedMsgIds.size === 1 ? '' : 's'}?</h3>
              </div>
              {(() => {
                const selected = getSelectedMessages();
                const allMine = selected.length > 0 && selected.every(m => m.isMe || (m.senderName || m.username || '').toLowerCase() === myUsername?.toLowerCase());
                return (
                  <>
                    <p style={{color: isLight ? '#475569' : '#aaa',fontSize:15,marginBottom:24,lineHeight:1.4}}>
                      {allMine ? 'You can delete these just for you, or unsend them for everyone.' : 'This only removes them from your own view — you can only unsend your own messages.'}
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {allMine && (
                        <button onClick={() => handleBulkDelete('global')} className="modal-btn-transition danger-red-btn stay-white" style={{padding:'14px 20px',background:'#ef4444',border:'none',borderRadius:18,color:'#fff',cursor:'pointer',fontWeight:900, fontSize: 15}}>
                          <span className="stay-white" style={{color: '#fff'}}>Unsend for everyone</span>
                        </button>
                      )}
                      <button onClick={() => handleBulkDelete('local')} className="modal-btn-transition" style={{padding:'14px 20px',background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:800, borderRadius: 18, fontSize: 15}}>Delete for me</button>
                      <button onClick={() => setBulkDeleteConfirm(false)} className="modal-btn-transition" style={{padding:'14px 20px',background:'transparent', border:'none', color: isLight ? '#64748b' : '#888',cursor:'pointer',fontWeight:700, borderRadius: 18, fontSize: 15}}>Cancel</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

        {/* Forward picker — pick up to 5 destination chats for the selected messages */}
        {forwardPickerOpen && createPortal(
          <div onMouseDown={e => e.stopPropagation()} className="chat-modal-overlay" style={{position:'fixed',inset:0,zIndex:999999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0, 0, 0, 0.75)',backdropFilter:'blur(12px) saturate(180%)',WebkitBackdropFilter:'blur(12px) saturate(180%)',display:'flex',alignItems:'center',justifyContent:'center', padding: 20}}>
            <div className="chat-modal-box" style={{background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',borderRadius:32,padding:28,width:'100%',maxWidth:400, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'}}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 20, fontWeight: 900 }}>{t('forwardTo', 'Forward to')}</h3>
                <button onClick={() => setForwardPickerOpen(false)} style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#888',cursor:'pointer',display:'flex'}}><X size={20}/></button>
              </div>
              <p style={{color: isLight ? '#64748b' : '#888', fontSize: 13, marginTop: 0, marginBottom: 12}}>Select up to {MAX_FORWARD_CHATS} chats ({selectedForwardChats.length}/{MAX_FORWARD_CHATS})</p>
              <div style={{flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:4, marginBottom:20}}>
                {(Array.isArray(conversations) ? conversations : []).map(c => {
                  const key = c.id || c.partner;
                  const checked = selectedForwardChats.includes(key);
                  const disabled = !checked && selectedForwardChats.length >= MAX_FORWARD_CHATS;
                  return (
                    <div key={key} onClick={() => {
                      if (disabled) return;
                      setSelectedForwardChats(prev => checked ? prev.filter(k => k !== key) : [...prev, key]);
                    }} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, background: checked ? (isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.15)') : 'transparent'}}>
                      {checked ? <SquareCheck size={20} color="var(--brand-1-light)" /> : <Square size={20} color={isLight ? '#94a3b8' : '#666'} />}
                      <div style={{width:34,height:34,borderRadius:'50%',background:'var(--brand-1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                        {getAvatarUrl(c.partnerAvatar) ? <img src={getAvatarUrl(c.partnerAvatar)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (c.type === 'room' ? <Users size={16} color="#fff"/> : <User size={16} color="#fff"/>)}
                      </div>
                      <span style={{fontSize:14,color: isLight ? '#0f172a' : '#eee',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.displayName || c.partner || c.id}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleForwardSend}
                disabled={selectedForwardChats.length === 0 || forwarding}
                className={`modal-btn-transition${selectedForwardChats.length > 0 && !forwarding ? ' stay-white' : ''}`}
                style={{padding:'14px 20px',background: selectedForwardChats.length === 0 || forwarding ? (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)') : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border:'none', borderRadius:18, color: selectedForwardChats.length === 0 || forwarding ? (isLight ? '#94a3b8' : '#666') : '#fff', cursor: selectedForwardChats.length === 0 || forwarding ? 'default' : 'pointer', fontWeight:800, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
                {forwarding ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />} {forwarding ? 'Sending…' : `Send${selectedForwardChats.length ? ` (${selectedForwardChats.length})` : ''}`}
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Clear Group Chat Modal */}
        {clearGroupChatModalOpen && createPortal(
          <div onMouseDown={e => e.stopPropagation()} className="chat-modal-overlay" style={{position:'fixed',inset:0,zIndex:999999,background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 0, 0, 0.65)',backdropFilter:'blur(12px) saturate(180%)',WebkitBackdropFilter:'blur(12px) saturate(180%)',display:'flex',alignItems:'center',justifyContent:'center', padding: 20}}>
            <div className="chat-modal-box" style={{background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(10px)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',borderRadius:32,padding:32,width:'100%',maxWidth:380, boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={22} color="#ef4444" />
                </div>
                <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Clear Chat</h3>
              </div>
              <p style={{color: isLight ? '#475569' : '#aaa',fontSize:15,marginBottom:24,lineHeight:1.4}}>Are you sure you want to clear your chat history with <strong>{clearGroupChatModalOpen.displayName || clearGroupChatModalOpen.partner}</strong>?</p>
              <div style={{display:'flex',gap:14,justifyContent:'flex-end'}}>
                <button onClick={()=>setClearGroupChatModalOpen(false)} className="modal-btn-transition" style={{padding:'14px 28px',background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:800, borderRadius: 18, fontSize: 15}}>Cancel</button>
                <button onClick={()=>{
                  const rid = (clearGroupChatModalOpen.partner || '').toLowerCase();
                  if (socketRef.current) {
                    socketRef.current.emit('clear_room_chat', { roomId: clearGroupChatModalOpen.partner });
                  } else if (localStorage.getItem('watch_is_guest') === 'true') {
                    window.dispatchEvent(new CustomEvent('guest_widget_clear_room_chat', { detail: { roomId: rid } }));
                    try { sessionStorage.setItem(`guest_room_messages_${rid}`, '[]'); } catch {}
                    window.dispatchEvent(new CustomEvent('guest_room_messages_updated', { detail: { roomId: rid } }));
                  }
                  // Optimistic UI clear — don't wait for room_chat_cleared socket event
                  if (activeChatRef.current?.type === 'room' &&
                      (activeChatRef.current?.partner || '').toLowerCase() === rid) {
                    setMessages([]);
                  }
                  setConversations(prev => prev.map(c =>
                    (c.type === 'room' && (c.partner || '').toLowerCase() === rid)
                      ? { ...c, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() }
                      : c
                  ));
                  setClearGroupChatModalOpen(false);
                  toast.success('Chat history cleared');
                }} className="modal-btn-transition danger-red-btn stay-white" style={{padding:'14px 36px',background:'#ef4444',border:'none',borderRadius:18,color:'#fff',cursor:'pointer',fontWeight:900, fontSize: 15, boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)'}}>
                  <span className="stay-white" style={{color: '#fff'}}>Clear Chat</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Rename Room Modal */}
        {renameModalOpen && activeChat && createPortal(
          <div onMouseDown={e => e.stopPropagation()} className="chat-modal-overlay" style={{position:'fixed',inset:0,zIndex:999999,background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 0, 0, 0.65)',backdropFilter:'blur(12px) saturate(180%)',WebkitBackdropFilter:'blur(12px) saturate(180%)',display:'flex',alignItems:'center',justifyContent:'center', padding: 20}}>
            <div className="chat-modal-box" style={{background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(10px)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',borderRadius:32,padding:32,width:'100%',maxWidth:380, boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(var(--brand-1-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={22} color="var(--brand-1)" />
                </div>
                <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Rename Room</h3>
              </div>
              <p style={{ color: isLight ? '#475569' : '#888', fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
                Update your room name. This change will be visible to all members in real-time.
              </p>
              <form onSubmit={(e)=>{ 
                e.preventDefault(); 
                if(renameInput.trim()){ 
                  if (socketRef.current) {
                    socketRef.current.emit('mod_rename_room',{roomId: activeChat.partner, newName: renameInput.trim()});
                    setActiveChat(prev => ({ ...prev, displayName: renameInput.trim() }));
                    setConversations(prev => prev.map(c => c.partner === activeChat.partner ? { ...c, displayName: renameInput.trim() } : c));
                    toast.success('Room name updated successfully');
                  } else if (localStorage.getItem('watch_is_guest') === 'true') {
                    window.dispatchEvent(new CustomEvent('guest_widget_rename_room', { 
                      detail: { roomId: activeChat.partner, newName: renameInput.trim() } 
                    }));
                    setActiveChat(prev => ({ ...prev, displayName: renameInput.trim() }));
                    setConversations(prev => prev.map(c => c.partner === activeChat.partner ? { ...c, displayName: renameInput.trim() } : c));
                    toast.success('Room name updated successfully');
                  }
                  setRenameModalOpen(false); 
                } 
              }}>
                <input value={renameInput} onChange={e=>setRenameInput(e.target.value)} autoFocus style={{width:'100%',background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)',border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',borderRadius:18,padding:'18px 22px',color: isLight ? '#000' : '#fff',marginBottom:28,fontSize:15,outline:'none'}} placeholder="Enter new name..."/>
                <div style={{display:'flex',gap:14,justifyContent:'flex-end'}}>
                  <button type="button" onClick={()=>setRenameModalOpen(false)} className="modal-btn-transition" style={{padding:'14px 28px',background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #e2e8f0' : 'none', color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:800, borderRadius: 18, fontSize: 15}}>Cancel</button>
                  <button type="submit" className="modal-btn-transition stay-white" style={{padding:'14px 36px',background:'linear-gradient(135deg,var(--brand-1),var(--brand-2))',border:'none',borderRadius:18,color:'#ffffff',cursor:'pointer',fontWeight:900, fontSize: 15, boxShadow: '0 6px 20px rgba(var(--brand-1-rgb),0.4)'}}><span className="stay-white">Save</span></button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}


      {/* Show Master Key Modal */}
      {showMasterKeyModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 400, background: '#161725', borderRadius: 24, padding: 32, textAlign: 'center', border: '1px solid rgba(var(--brand-2-rgb),0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(var(--brand-2-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Key size={32} color="var(--brand-2)" />
            </div>
            <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Your Master Key</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>Use this key if you forget your PIN. Keep it safe!</p>
            <div style={{ background: '#0a0a0a', borderRadius: 12, padding: 16, fontFamily: 'monospace', fontSize: 14, color: '#fff', border: '1px solid #333', userSelect: 'all', wordBreak: 'break-all' }}>
              {vaultMasterKey}
            </div>
            <button onClick={() => setShowMasterKeyModal(false)} style={{ marginTop: 24, width: '100%', padding: 12, borderRadius: 12, border: 'none', background: '#333', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Change PIN Modal placeholder */}
      {showChangePinModal && (
        <PinSetupModal 
          onClose={() => setShowChangePinModal(false)}
          onSuccess={() => { setShowChangePinModal(false); toast.success('PIN changed successfully'); }}
          action="reset"
        />
      )}
        {/* Full Emoji Picker positioned inside main widget container */}
        {showAllEmojis && activeReactionMsg && (
          <div className="emoji-picker-container" style={{position:'absolute', bottom: 84, right: 16, zIndex: 99999, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.8)', borderRadius:10}} onClick={e=>e.stopPropagation()}>
            <Picker 
              data={data} 
              theme={isLight ? 'light' : 'dark'} 
              previewPosition="none" 
              searchPosition="sticky"
              navPosition="bottom" 
              perLine={6} 
              onEmojiSelect={(emojiObj) => { setShowAllEmojis(false); handleReact(activeReactionMsg, emojiObj.native); triggerReactionBurst(activeReactionMsg, emojiObj.native); setActiveReactionMsg(null); }}
            />
          </div>
        )}
      </div>
    {/* Report Message Modal - group chat flag */}
    {reportMsgTarget && (
      <ReportMessageModal
        msg={reportMsgTarget}
        roomId={activeChat?.partner || activeChat?.roomId || null}
        reporterUsername={myUsername}
        apiBase={API}
        isDark={!isLight}
        onClose={() => setReportMsgTarget(null)}
      />
    )}
    <DownloadAppModal isOpen={showCallInstallPrompt} onClose={() => setShowCallInstallPrompt(false)} />
    </div>
  );
}));

GlobalChatWidget.displayName = 'GlobalChatWidget';

export default GlobalChatWidget;








