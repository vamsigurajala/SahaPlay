import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ArrowLeft, Send, X, User, Users, SmilePlus, Reply, Plus, MoreVertical, Search, Paperclip, Loader2, Play, Pause, Trash2, Edit2, MoreHorizontal, ArrowDown, ChevronDown, ChevronLeft, ChevronRight, Lock, ShieldAlert, Pin, Bell, BellOff, MessageSquareX, Eye, EyeOff, CheckCheck, Check, Ban, SquareCheck, Square, Unlock, Timer as TimerIcon, Key, Mic, MicOff, Download, FileText, Music, Clock, Flag, Copy, Forward, Phone, Video, PhoneMissed, Palette, Camera, Image as ImageIcon, BarChart2 } from 'lucide-react';
import { useCall, CALL_LOG_PREFIX } from '../contexts/CallContext';
import ChatLockScreen from './ChatLockScreen';
import ForgotPinModal from './ForgotPinModal';
import ReportMessageModal from './ReportMessageModal';
import CameraCapture from './CameraCapture';
import PinSetupModal from './PinSetupModal';
import PollComposer from './PollComposer';
import PollBubble from './PollBubble';
import PollVotesModal from './PollVotesModal';
import VoiceRecorderBar from './VoiceRecorderBar';
import { castPollVote } from '../lib/pollApi';
import { API } from '../lib/api';
import { appCache } from '../cache/appCache.js';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useNavigate, useLocation } from 'react-router-dom';
import { mergeHistoryBatch } from '../utils/chatHelper.js';
import { getMessagePreview } from '../utils/messagePreview';
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
import { CHAT_CATEGORIES, CHAT_THEMES, CHAT_THEME_BUBBLE_STRIDE, CHAT_WALLPAPERS, findWallpaper, getWallpaperDominantColor, isRgbColorDark } from '../lib/chatThemes';
import ExpiryReminderBanner from './ExpiryReminderBanner';
import { countSoonExpiringMedia, dismissExpiryBanner12h, snoozeExpiryBannerUntilClose, clearExpiryBannerCloseSuppression } from '../utils/expiryReminders';

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

function FileCard({ url, type, fileName, fileSize, isMe, isLight, expiresAt, loading, tick, forwarded }) {
  const isLoading = loading && !url;
  const isExpired = !url && !isLoading;
  const typeLabel = getFileTypeLabel(type, fileName);
  const sizeLabel = formatFileSize(fileSize);
  const iconBg = getFileIconBg(type);
  const subtitle = isLoading ? (isMe ? 'Sending…' : 'Loading…') : (isExpired ? 'Expired' : [typeLabel, sizeLabel].filter(Boolean).join(' • '));
  // Same color as the expiry line below — no background pill, just muted text
  // matching the existing "Expires in X days" color pattern in both themes.
  const infoColor = isLight ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.6)';

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
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName || 'download';
      a.click();
    } catch { toast?.error?.('Download failed'); }
  };

  const cardBg = isLight ? '#ffffff' : (isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)');
  const cardBorder = isLight ? 'rgba(0,0,0,0.1)' : (isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.09)');
  const fileNameColor = isLight ? '#000000' : (isMe ? '#fff' : '#e2e8f0');
  const subtitleColor = isLight ? 'rgba(0,0,0,0.65)' : (isMe ? 'rgba(255,255,255,0.65)' : '#888');
  const dlColor = isLight ? 'var(--brand-2-darker)' : (isMe ? 'rgba(255,255,255,0.8)' : 'var(--brand-1-light)');
  const iconCircleBg = isLight ? `${iconBg}22` : iconBg;
  const iconColor = isLight ? iconBg : '#fff';

  return (
    <div style={{ background: cardBg, borderRadius: 10, padding: '10px 12px', minWidth: 200, maxWidth: 250, border: `1px solid ${cardBorder}`, marginTop: 2 }}>
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

function AudioPlayerBubble({ url, expiresAt, isMe, isLight, loading, tick, forwarded }) {
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
  const loadBg = isMe ? 'rgba(255,255,255,0.1)' : (isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(255,255,255,0.06)');

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
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `voice_note_${Date.now()}.${ext}`;
      a.click();
    } catch { toast?.error?.('Download failed'); }
  };

  const bubbleBg = isMe
    ? (isLight ? 'rgba(var(--brand-1-rgb),0.12)' : 'rgba(255,255,255,0.15)')
    : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)');
  const playedColor = 'var(--brand-2)';
  const unplayedColor = isMe
    ? (isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)')
    : (isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)');
  const timeColor = isMe
    ? (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)')
    : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)');
  const dlColor = isMe
    ? (isLight ? 'var(--brand-1)' : 'rgba(255,255,255,0.7)')
    : (isLight ? 'var(--brand-2-dark)' : 'var(--brand-2-light)');
  const displayTime = (playing || currentTime > 0) ? fmtDur(currentTime) : fmtDur(duration);

  return (
    <div style={{ background: bubbleBg, borderRadius: 10, padding: '8px 12px', minWidth: 200, marginTop: 2 }}>
      {forwarded && (
        <div className="rcp-vn-expiry" style={{ fontSize: 9, color: timeColor, WebkitTextFillColor: timeColor, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <Forward size={8} color={timeColor} style={{ flexShrink: 0 }} />Forwarded
        </div>
      )}
      <audio ref={audioRef} src={url} preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggle} style={{ background: 'var(--brand-2)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
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
                // No static frame preview here by design — a <video> element
                // auto-loads and shows its first frame even without playing,
                // which read as an unwanted "thumbnail" flash before the
                // user ever taps to play. Plain placeholder + Play icon
                // (rendered just below) only.
                <div style={{ width: '100%', height: '100%', background: '#1a1a1a' }} />
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

const renderMedia = (url, type, isMe, fileName, fileSize, expiresAt, loading, onOpenLightbox, isLight, msg, username) => {
  if (!url && !type) return null;
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  const isAudio = type?.startsWith('audio/');
  const tick = (isMe && msg) ? <MessageTick msg={msg} username={username} isLight={isLight} /> : null;
  const cardTick = (isMe && msg) ? <MessageTick msg={msg} username={username} isLight={isLight} onLightSurface /> : null;
  // Voice note bubbles use a light tinted background in light mode (unlike the dark
  // text/media bubbles the default white tick assumes), so treat it as a light
  // surface in light mode only — dark mode keeps the original white tick unchanged.
  const voiceTick = (isMe && msg) ? <MessageTick msg={msg} username={username} isLight={isLight} onLightSurface={isLight} /> : null;

  if (isAudio) return <AudioPlayerBubble url={url} expiresAt={expiresAt} isMe={isMe} isLight={isLight} loading={loading} tick={voiceTick} forwarded={msg?.forwarded} />;

  if (!isImg && !isVid) return <FileCard url={url} type={type} fileName={fileName} fileSize={fileSize} isMe={isMe} isLight={isLight} expiresAt={expiresAt} loading={loading} tick={cardTick} forwarded={msg?.forwarded} />;

  if (!url) {
    if (loading) return <div style={{ width: 220, height: isVid ? 140 : 160, borderRadius: 10, background: isMe ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-1)', opacity: 0.6 }} /></div>;
    return null;
  }

  return (
    <div style={{ marginTop: 0, borderRadius: 10, overflow: 'hidden', background: '#000', maxWidth: 220, position: 'relative', cursor: 'pointer' }}>
      {isImg ? (
        <>
          <img
            src={url}
            alt="Shared media"
            loading="lazy"
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
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
        <div onClick={() => onOpenLightbox(url, type)} style={{ position: 'relative', width: '100%', height: 140, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* No static frame preview by design — see the matching comment
              in the grid-preview renderer above. */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
import { encryptDM, encryptGroupMessage, decryptDM, decryptGroupMessage, decryptDMSenderCopy, robustDecode, encryptMedia, decryptMedia } from '../lib/crypto';
import { isSahaplayOfficialGroup } from '../lib/sahaplayOfficial';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Shown instead of raw content for group messages sent before client-side group E2EE
// shipped (the old server-side-only encryption scheme, since retired — no dual-format
// decrypt support). Media wasn't part of that old scheme (files were always stored
// unencrypted), so it keeps rendering normally; only legacy text is replaced.
const LEGACY_GROUP_TEXT_PLACEHOLDER = 'Sent before encryption upgrade';

// Shown for a group message that was edited before this fix (an edit that resent
// plaintext, which the backend then paired with the message's OLD nonce/keys —
// permanently mismatched, so decrypt can never succeed for that row). Distinct
// from LEGACY_GROUP_TEXT_PLACEHOLDER so it's not confused with an unrelated
// pre-upgrade message.
const CORRUPTED_EDIT_PLACEHOLDER = 'This edited message can no longer be decrypted';

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

  /* Voice note text overrides inside message bubbles in light mode */
  html[data-theme='light'] .msg-bubble .rcp-vn-time,
  html[data-theme='light'] .msg-bubble .rcp-vn-time * {
    color: rgba(0,0,0,0.6) !important;
    -webkit-text-fill-color: rgba(0,0,0,0.6) !important;
  }
  html[data-theme='light'] .msg-bubble .rcp-vn-expiry,
  html[data-theme='light'] .msg-bubble .rcp-vn-expiry * {
    color: rgba(0,0,0,0.6) !important;
    -webkit-text-fill-color: rgba(0,0,0,0.6) !important;
  }

  /* Document card text overrides — on a sent (msg-sent/stay-white) bubble in
     light mode, App.jsx's global .fc-name/.fc-sub rule alone wasn't winning
     against the white-text-forcing those classes apply here, so pin all three
     locally the same way RoomChatPanel.jsx already does. */
  html[data-theme='light'] .msg-bubble .fc-name,
  html[data-theme='light'] .msg-bubble .fc-name * {
    color: #111111 !important;
    -webkit-text-fill-color: #111111 !important;
  }
  html[data-theme='light'] .msg-bubble .fc-sub,
  html[data-theme='light'] .msg-bubble .fc-sub * {
    color: rgba(0,0,0,0.65) !important;
    -webkit-text-fill-color: rgba(0,0,0,0.65) !important;
  }
  html[data-theme='light'] .msg-bubble .fc-expiry,
  html[data-theme='light'] .msg-bubble .fc-expiry * {
    color: rgba(0,0,0,0.62) !important;
    -webkit-text-fill-color: rgba(0,0,0,0.62) !important;
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

// WhatsApp-style call-summary bubble — renders in place of plain text
// whenever a decrypted DM message starts with CALL_LOG_PREFIX (see
// CallContext.writeCallLog). Tap to redial, mirroring WhatsApp.
function CallLogBubble({ data, isMe, myUsername, onRedial }) {
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
  return (
    <div onClick={onRedial} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onRedial ? 'pointer' : 'default', minWidth: 130 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: missedForMe ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.14)' }}>
        {missedForMe ? <PhoneMissed size={15} color="#ef4444" /> : <Icon size={15} color={isMe ? '#fff' : 'var(--brand-1-light)'} />}
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
                  <div 
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

const GlobalChatWidget = forwardRef(({ 
  isOpen, 
  onClose, 
  unreadCounts, 
  onMarkRead, 
  onMarkAllRead,
  onNewMessage,
  activeRoomTab,
  activeRoomPartner,
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
    window.addEventListener('locked_chats_updated', handleSync);
    window.addEventListener('blocked_chats_updated', handleSync);
    window.addEventListener('pinned_chats_updated', handleSync);
    window.addEventListener('hidden_chats_updated', handleSync);
    window.addEventListener('conversations_updated', handleSync);
    window.addEventListener('chat_cleared_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('muted_chats_updated', handleSync);
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
      let targetPubKey = localStorage.getItem(`wt_pk_${partnerLower}`);
      if (!targetPubKey) {
        const pkRes = await fetch(`${API}/api/auth/public-key/${encodeURIComponent(partnerLower)}`);
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          targetPubKey = pkData.publicKey || null;
        }
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
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
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
  const [hoveredConvId, setHoveredConvId] = useState(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [hoveredMenuBtn, setHoveredMenuBtn] = useState(null); // tracks hovered header menu button
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const [keysMissing, setKeysMissing] = useState(false);
  const [repairingKeys, setRepairingKeys] = useState(false);
  const [showMasterKeyModal, setShowMasterKeyModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [vaultMasterKey, setVaultMasterKey] = useState('');
  const [repairPassword, setRepairPassword] = useState('');
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
  const gcwLevel = showThemeSheet ? gcwBaseLevel + 1 : gcwBaseLevel;
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

  // True only while the user reached the current /profile/* route by leaving
  // an already-open chat (see leaveChatToViewProfile / hiddenByProfileRoute
  // below); reset to false the moment a chat is opened fresh from outside.
  const cameFromOpenChatRef = useRef(false);

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
  const leaveChatToViewProfile = (targetUsername) => {
    cameFromOpenChatRef.current = true;
    suppressNextPop();
    navigate(`/profile/${targetUsername}`);
  };
  // Only hide behind the profile route if we actually GOT to this profile by
  // leaving an already-open chat (leaveChatToViewProfile). Without this flag,
  // landing on a profile page any other way (e.g. clicking someone's avatar
  // in a room's group chat) and then opening a fresh chat from that profile's
  // own Message button would set activeChat/view correctly but stay
  // display:none forever — this widget instance never became visible because
  // the route-based hide fired unconditionally for every /profile/* route.
  const hiddenByProfileRoute = location.pathname.startsWith('/profile') && cameFromOpenChatRef.current;
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
  // Re-auth overlay state (shown when sessionStorage key is missing after tab close)
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  // Async-decrypted media blob URLs: msgId -> objectURL
  const decryptedMediaUrls = useRef({});
  // Incremented after each async media decrypt to force a re-render that picks up the new blob URL
  const [mediaUrlVersion, setMediaUrlVersion] = useState(0);
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
  const activeRoomTabRef = useRef(activeRoomTab);
  const activeRoomPartnerRef = useRef(activeRoomPartner);
  useEffect(() => { activeRoomTabRef.current = activeRoomTab; }, [activeRoomTab]);
  useEffect(() => { activeRoomPartnerRef.current = activeRoomPartner; }, [activeRoomPartner]);

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
    if (composerFocusedRef.current && wasNearBottomOnFocusRef.current) scrollToBottom(true);
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
    if (socketRef.current) {
      socketRef.current.emit('chat:mark_read', { chatId: chatKey, isDm });
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
      openChat({
        id: partnerUsername,
        partner: partnerUsername,
        displayName: displayName || partnerUsername,
        partnerAvatar: avatarPath,
        type: 'private'
      });
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
      if (onMarkRead && (activeChatRef.current?.id || '').toLowerCase() === target) {
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
        let decryptedText = newMessage;
        if (nonce && keyPair) {
          try {
            if (keys) {
              const myLower = myUsername?.toLowerCase();
              const myEncKey = keys[myLower] || Object.entries(keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
              if (myEncKey && ephemeralPublicKey) {
                const senderPubKey = decodeBase64(ephemeralPublicKey);
                decryptedText = decryptGroupMessage(newMessage, nonce, myEncKey, senderPubKey, keyPair.secretKey) ?? CORRUPTED_EDIT_PLACEHOLDER;
              } else {
                decryptedText = m.decryptedText;
              }
            } else if (m.isMe && senderMessage) {
              decryptedText = decryptDMSenderCopy(senderMessage, nonce, ephemeralPublicKey, encodeBase64(keyPair.secretKey)) ?? m.decryptedText;
            } else if (!m.isMe && ephemeralPublicKey) {
              decryptedText = decryptDM(newMessage, nonce, ephemeralPublicKey, encodeBase64(keyPair.secretKey)) ?? m.decryptedText;
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

    sock.on('blocking_updated', ({ blocker, blocked, isBlocked }) => {
      const myUsername = localStorage.getItem('watch_username');
      if (!myUsername) return;
      
      const blockerLow = blocker.toLowerCase();
      const blockedLow = blocked.toLowerCase();
      const meLow = myUsername.toLowerCase();

      if (blockerLow === meLow) {
        // I blocked/unblocked someone
        setBlockedChats(prev => {
          const next = isBlocked ? [...new Set([...prev, blocked])] : prev.filter(u => u.toLowerCase() !== blockedLow);
          localStorage.setItem(`blocked_chats_${myUsername}`, JSON.stringify(next));
          return next;
        });
        fetchConversations();
      } else if (blockedLow === meLow) {
        // Someone blocked/unblocked me
        setBlockingMe(prev => {
          const next = isBlocked ? [...new Set([...prev, blocker])] : prev.filter(u => u.toLowerCase() !== blockedLow);
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

    const handleFollowEvent = (data) => {
      const actor = data.requester || data.follower || data.actor;
      const target = data.accepter || data.following || data.target;
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

    sock.on('follow_accepted', handleFollowEvent);
    sock.on('follow_request', handleFollowEvent);
    sock.on('unfollow', handleFollowEvent);


    const handleNewMsg = (msg) => {
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
                  // msg.message holds the ENCRYPTED MEDIA KEY
                  decryptedMessage = '';
                  const mediaKeyB64 = decryptGroupMessage(msg.message, msgNonce, userKeyWrap, senderPK, activeKey.secretKey);
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
                  decryptedMessage = decryptGroupMessage(msg.message, msgNonce, userKeyWrap, senderPK, activeKey.secretKey) || (msg.edited ? CORRUPTED_EDIT_PLACEHOLDER : '\uD83D\uDD12 Encrypted message');
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
                    // plain = the base64 media key — schedule async file decrypt
                    const msgKey = msg.id || msg.tempId || String(msg.timestamp);
                    const targetMediaUrl = msg.mediaUrl;
                    const targetMediaType = msg.mediaType;
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(plain);
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
              if (senderPK) {
                if (msg.mediaType && msg.mediaUrl) {
                  // msg.message holds the ENCRYPTED MEDIA KEY — always clear it from display
                  decryptedMessage = '';
                  const mediaKeyB64 = decryptDM(msg.message, msg.nonce, senderPK, encodeBase64(activeKey.secretKey));
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
                  decryptedMessage = decryptDM(msg.message, msg.nonce, senderPK, encodeBase64(activeKey.secretKey)) || '\uD83D\uDD12 Encrypted message';
                }
              }
            }
          }
        } catch (e) { console.warn('[E2EE] Decryption failed', e); }
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
        ((msg.decryptedText && !looksLikeCiphertext(msg.decryptedText))
          ? truncateToFewWords(msg.decryptedText)
          : (msg.message && looksLikeCiphertext(msg.message) ? (isMine ? 'Message sent' : 'Message') : truncateToFewWords(msg.message || 'New message')));

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
          // Call-log control messages ("sahaplay_call{...}") are rendered
          // specially inside the chat bubble itself (see the CALL_LOG_PREFIX
          // check further down this file) — showing them here would leak the
          // raw, un-templated control string as toast text (e.g.
          // `sahaplay_call{"callType":"voice","status":"m...`). The call's
          // own native/JS UI already told the user it ended; this toast
          // would just be unwanted, malformed-looking noise on top of that.
          if (msg.decryptedText && msg.decryptedText.startsWith(CALL_LOG_PREFIX)) skipToast = true;
          // 1. Check if user is looking at this chat in the Global Widget itself
          if (isViewingThis) skipToast = true;

          // 2. Check if user is looking at this chat in the specialized Room panel
          const lowerPartner = partner.toLowerCase();
          const lowerActivePartner = (activeRoomPartnerRef.current || '').toLowerCase();
          if (isGroup) {
             if (activeRoomTabRef.current === 'group' && lowerPartner === lowerActivePartner) skipToast = true;
          } else {
             if (activeRoomTabRef.current === 'dm' && lowerPartner === lowerActivePartner) skipToast = true;
          }

          if (!skipToast) {
            if (!isMuted) {
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

              const textToDisplay = isHidden
                ? (isGroup ? `${groupName}: ${msgSender}: ${msgStr}` : `${msgSender}: ${msgStr}`)
                : (isGroup
                  ? `${groupName}: ${msgSender}: ${finalizedPreview}`
                  : `${msgSender}: ${finalizedPreview}`);

              toast(textToDisplay, { id: `msg-${msgKey || Date.now()}`, icon: '💬', duration: 3500 });

              const notifBody = isHidden ? msgStr : finalizedPreview;
              showDesktopNotification(isGroup ? groupName : msgSender, notifBody, partnerLower);
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
            partnerAvatar: exists.partnerAvatar || (isMine ? msg.partnerAvatar : msg.senderAvatar) || null,
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
            partnerAvatar: isMine ? (msg.partnerAvatar || null) : (msg.senderAvatar || msg.partnerAvatar || null),
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

    // Re-unified typing indicator is now handled by sock.on('chat:typing') at the top
    sock.on('dm_cleared', (data) => {
      const { userA, userB, targetUsername: legacyTarget } = data;
      // Case-insensitive: socket.username from backend may differ in casing from localStorage myUsername
      const targetUsername = legacyTarget || (
        (userA || '').toLowerCase() === myUsername ? userB : userA
      );
      const targetLower = (targetUsername || '').toLowerCase();

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

    // ── Host permanently deleted a room ──────────────────────────────────────
    // Same cleanup as admin_room_deleted but triggered by the room host via socket
    sock.on('room_permanently_deleted', ({ roomId }) => {
      const roomLower = (roomId || '').toLowerCase();

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

    if (shouldScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 50);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 150);
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
            if (Object.keys(mediaMeta).length > 0) return { ...c, ...mediaMeta };
            return { ...c, message: LEGACY_GROUP_TEXT_PLACEHOLDER, decryptedText: LEGACY_GROUP_TEXT_PLACEHOLDER };
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

        // Bug 4 fix: If we already have lastSeen for a partner, trust local read state
        // and zero out any server unread count so going back from chat view doesn't re-show badge
        
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
          // mediaType/Duration: always fall back to local state regardless of timestamp.
          // Rationale: if the server sends the same message but without mediaType (legacy
          // rows where mediaType was never stored, or the DB field is null), we should keep
          // whatever the real-time socket update gave us. We only clear them when the SERVER
          // returned a genuinely NEWER message — but in that case finalC would have the new
          // message's own mediaType set, so the fallback never fires anyway.
          const betterMediaType     = finalC.lastMediaType || existing?.lastMediaType || null;
          const betterMediaFileName = finalC.lastMediaFileName || existing?.lastMediaFileName || null;
          const betterMediaDuration = finalC.lastMediaDuration || existing?.lastMediaDuration || null;

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

          const seenTs = lastSeen[chatKey] || lastSeen[chatKey.toLowerCase()] || 0;
          const keepUnreadZero = seenTs && existing && existing.unread === 0;

          // Preserve clearedAt from local state so getSortTime keeps a cleared chat at the
          // correct sort position even after a server fetch overwrites lastTimestamp.
          // Only carry it forward when no genuinely newer message arrived after the clear.
          const localClearedAt = Number(existing?.clearedAt) || 0;
          const keepClearedAt = localClearedAt > 0 && serverTs <= localClearedAt;

          return {
            ...finalC,
            decryptedText: betterDecryptedText,
            lastMediaType: betterMediaType,
            lastMediaFileName: betterMediaFileName,
            lastMediaDuration: betterMediaDuration,
            message: betterMessage,
            ...(keepClearedAt ? { clearedAt: localClearedAt } : {}),
            ...(keepUnreadZero ? { unread: 0 } : {})
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
                    const mediaKeyBytes = robustDecode(plainText);
                    const resolvedUrl = resolveMediaUrl(m.mediaUrl, API);
                    const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                    const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                    const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: m.mediaType }));
                    decryptedMediaUrls.current[msgKey] = objectUrl;
                    // decryptedMediaUrl stays m.mediaUrl (its initial value) — the real,
                    // permanent file URL — not the blob: object URL. Rendering reads the
                    // decrypted blob from decryptedMediaUrls above; mediaUrl must stay
                    // forwardable/fetchable by anyone, not just this tab.
                    decryptedText = '';
                  } catch(e) { console.warn('[E2EE] History media decrypt (sender) failed:', e); }
                } else { decryptedText = plainText; }
              }
            }
          } else {
            const senderPK = m.ephemeralPublicKey || m.senderPublicKey || null;
            if (senderPK) {
              if (m.mediaType && m.mediaUrl) {
                const mediaKeyB64 = decryptDM(m.message, m.nonce, senderPK, encodeBase64(kp.secretKey));
                if (mediaKeyB64) {
                  try {
                    const mediaKeyBytes = robustDecode(mediaKeyB64);
                    const resolvedUrl = resolveMediaUrl(m.mediaUrl, API);
                    const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                    const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                    const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: m.mediaType }));
                    decryptedMediaUrls.current[msgKey] = objectUrl;
                    // decryptedMediaUrl stays m.mediaUrl — see sender-copy branch above.
                    decryptedText = '';
                  } catch(e) { console.warn('[E2EE] History media decrypt (recipient) failed:', e); }
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
                const mediaKeyB64 = decryptGroupMessage(m.message, m.nonce, userKeyWrap, senderPK, kp.secretKey);
                if (mediaKeyB64) {
                  try {
                    const mediaKeyBytes = robustDecode(mediaKeyB64);
                    const resolvedUrl = resolveMediaUrl(m.mediaUrl, API);
                    const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                    const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                    const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: m.mediaType }));
                    decryptedMediaUrls.current[msgKey] = objectUrl;
                    // decryptedMediaUrl stays m.mediaUrl — see DM branches above.
                    decryptedText = '';
                  } catch(e) { console.warn('[E2EE] Group history media decrypt failed:', e); }
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
      setMessages(resolveReplyMessages(decrypted));

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
      if (requestId === latestHistoryRequestRef.current) setLoading(false);
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

    const limit = 200;

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

    // For room chats, attach permissions from the conversations list so the input UI can enforce them
    let chatPerms = chat.permissions || null;
    let chatIsHost = chat.isHost || false;
    if (chat.type === 'room') {
      const existing = Array.isArray(conversations)
        ? conversations.find(c => c.id === targetPartner || c.partner === targetPartner)
        : null;
      if (existing) {
        chatPerms = existing.permissions || chatPerms || null;
        chatIsHost = existing.isHost || chatIsHost || false;
      }
    }

    const chatToOpen = { ...chat, partner: targetPartner, permissions: chatPerms, isHost: chatIsHost };
    
    const chatKey = (chat.id || chat.partner || '').toLowerCase();
    clearTimeout(perChatTimersRef.current[chatKey]);
    setActiveChat(chatToOpen);
    setView('chat');
    setActiveRelation(null); // Reset
    setMessages([]); // Clear previous chat context immediately
    // Set loading synchronously in the same batch as the clear above, so there is never
    // a render where messages is empty AND loading is false (that gap is what briefly
    // flashed "No messages yet" before the real history arrived) — fetchHistory's own
    // setLoading(messages.length === 0) is a stale closure at the instant it fires and
    // can't be trusted to catch this specific transition reliably.
    // Guests skip this: their messages come from sessionStorage/window events (see the
    // guest_room_messages_updated sync effect below), never through fetchHistory, so
    // nothing would ever flip loading back to false for them.
    if (localStorage.getItem('watch_is_guest') !== 'true') {
      setLoading(true);
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



  // ─── E2EE Key Repair ───
  const setupE2EEKeys = async (password) => {
    if (!password) return;
    setRepairingKeys(true);
    try {
      const { encryptPrivateKey, secretKeyToMnemonic, hashRecoveryPhrase, generateKeyPair } = await import('../lib/crypto.js');
      const kp = generateKeyPair();
      const encryptedPrivKey = await encryptPrivateKey(kp.secretKey, password);
      const phrase = await secretKeyToMnemonic(kp.secretKey);
      const recoveryKeyHash = await hashRecoveryPhrase(phrase);

      const res = await fetch(`${API}/api/auth/setup-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: myUsername,
          publicKey: encodeBase64(kp.publicKey),
          encryptedPrivateKey: encryptedPrivKey,
          recoveryKeyHash
        })
      });
      if (!res.ok) throw new Error('Failed to save keys to server');
      
      await setKeyPair(kp);
      setKeysMissing(false);
      toast.success('Encryption keys set up successfully!');
    } catch (err) {
      console.error('[KeyRepair] Failed:', err);
      toast.error('Failed to setup encryption keys.');
    } finally {
      setRepairingKeys(false);
    }
  };

  // Check for missing keys on load
  useEffect(() => {
    if (isReady && !keyPair && token && !localStorage.getItem('watch_is_guest')) {
      // Check if server has keys but they just aren't in session
      const checkKeys = async () => {
        try {
          const res = await fetch(`${API}/api/auth/public-key/${myUsername}`);
          if (res.ok) {
            const data = await res.json();
            if (!data.publicKey) {
              setKeysMissing(true);
            }
          }
        } catch {}
      };
      checkKeys();
    }
  }, [isReady, keyPair, token, myUsername]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (editingMsg) { handleEditMessage(); return; }
    if (!inputValue.trim() || !activeChat) return;

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

    const ts = Date.now();
    const tempId = `opt-${ts}`;
    const optimisticMsg = {
      id: tempId,
      isMe: true,
      senderName: myUsername,
      message: inputValue.trim(),
      decryptedText: inputValue.trim(),
      timestamp: ts,
      replyTo: buildReplySnapshot(replyToMsg, activeChat?.displayName)
    };
    const previousConversations = [...conversations];
    
    setMessages(prev => [...prev, optimisticMsg]);
    setInputValue('');
    setReplyToMsg(null);
    // Tapping the send button (not a physical Enter key) moves focus onto it
    // first — once the input clears and the button goes disabled again right
    // after, nothing holds focus and the on-screen keyboard closes itself
    // between every single message. Reclaiming focus keeps it open across
    // sends; closing it is left entirely to the user's own back gesture/tap-away.
    requestAnimationFrame(() => inputRef.current?.focus());

    // Register this as the most-recently-sent message for this partner.
    // handleNewMsg uses this to ignore stale server echoes (message 1's echo arriving after
    // message 2 was already sent) which would otherwise revert the sidebar preview.
    lastSentTempIdRef.current[activeChat.partner || activeChat.id] = tempId;

    // Immediately update sidebar preview and order for sender
    setConversations(prev => {
      const convs = Array.isArray(prev) ? prev : [];
      const partner = activeChat.partner || activeChat.id;
      const exists = convs.find(c => c.partner === partner || c.id === partner);
      const isGroup = activeChat.type === 'room';
      
      const previewText = inputValue.slice(0, 50);
      const updatedItem = exists
        ? { ...exists, message: previewText, decryptedText: previewText, lastMediaType: null, lastMediaDuration: null, lastTimestamp: optimisticMsg.timestamp, lastSenderName: myUsername, isMyLastMessage: true, unread: 0 }
        : {
            id: isGroup ? partner : undefined,
            partner,
            displayName: activeChat.displayName,
            partnerAvatar: activeChat.partnerAvatar,
            lastTimestamp: optimisticMsg.timestamp,
            message: previewText,
            decryptedText: previewText,
            lastMediaType: null,
            lastMediaDuration: null,
            lastSenderName: myUsername,
            isMyLastMessage: true,
            type: activeChat.type,
            unread: 0
          };
      const others = convs.filter(c => c.partner !== partner && c.id !== partner);
      return [updatedItem, ...others].sort((a,b) => getSortTime(b) - getSortTime(a));
    });

    // ─── E2EE Encryption ───
    let messagePayload    = null; // [SECURE] Initialized to null
    let senderMessagePayload = null;
    let isEncrypted       = false;
    let nonceValue        = null;
    let ephemeralKey      = null;
    let e2eeKeysGroup     = null;

    try {
      // ─── E2EE Encryption ───
      let targetPubKey = null;
      if (activeChat.type === 'private' && keyPair) {
        try {
          const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`);
          if (pkRes.ok) {
            const pkData = await pkRes.json();
            if (pkData.publicKey) {
              targetPubKey = pkData.publicKey;
            }
          } else if (pkRes.status === 404) {
            const pkResLower = await fetch(`${API}/api/auth/public-key/${activeChat.partner.toLowerCase()}`);
            if (pkResLower.ok) {
              const pkDataLower = await pkResLower.json();
              if (pkDataLower.publicKey) {
                targetPubKey = pkDataLower.publicKey;
              }
            }
          }
        } catch(e) { console.warn("[E2EE] Public key fetch failed", e); }

        if (targetPubKey && keyPair) {
           console.log('=== ENCRYPTION DEBUG ===');
           console.log('myPrivateKey exists:', !!keyPair.secretKey);
           console.log('recipientPublicKey:', targetPubKey);
           console.log('message:', optimisticMsg.message);
           
           try {
             // pass my publicKey so our own message copy can be rendered
             const enc = encryptDM(optimisticMsg.message, targetPubKey, encodeBase64(keyPair.publicKey));
             messagePayload = enc.ciphertext;
             nonceValue = enc.nonce;
             ephemeralKey = enc.ephemeralPublicKey; 
             senderMessagePayload = enc.senderCiphertext;
             isEncrypted = true;
             console.log('[E2EE] DM Encryption success');
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
        replyTo: optimisticMsg.replyTo,
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
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setConversations(previousConversations);
      }
    } catch(e) {
      console.error(e);
      toast.error('Failed to send message. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setConversations(previousConversations);
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
        const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`);
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

    let messagePayload = newText;
    let senderMessagePayload = undefined;
    let nonceValue = undefined;
    let ephemeralKey = undefined;
    let e2eeKeysGroup = undefined;
    let isEncrypted = false;

    try {
      if (activeChat.type === 'private' && keyPair) {
        let targetPubKey = null;
        const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`);
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          if (pkData.publicKey) targetPubKey = pkData.publicKey;
        }
        if (!targetPubKey) {
          toast.error('Could not find recipient encryption key.');
          return;
        }
        const enc = encryptDM(newText, targetPubKey, encodeBase64(keyPair.publicKey));
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
            const enc = encryptGroupMessage(newText, recipients, keyPair, myUsername);
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

  const handleMediaUpload = async (file, mediaDuration = null, mediaGroupId = null) => {
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
          const pkRes = await fetch(`${API}/api/auth/public-key/${activeChat.partner}`);
          if (pkRes.ok) {
            targetPubKey = (await pkRes.json()).publicKey;
          } else if (pkRes.status === 404) {
             const pkResLower = await fetch(`${API}/api/auth/public-key/${activeChat.partner.toLowerCase()}`);
             if (pkResLower.ok) targetPubKey = (await pkResLower.json()).publicKey;
          }
          if (targetPubKey) {
            // STRATEGY: Encrypt the media key, not the URL.
            const enc = encryptDM(mediaKeyB64, targetPubKey, encodeBase64(keyPair.publicKey));
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
            const enc = encryptGroupMessage(mediaKeyB64, recipients, keyPair, myUsername);
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
      setMessages(prev => prev.map(m =>
        m.id === optimisticMsg.id
          ? { ...m, mediaType: file.type, _isOptimistic: false }   // keep mediaUrl = objectUrl (blob)
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
          replyTo: buildReplySnapshot(replyToMsg, activeChat?.displayName),
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
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
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

      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 299) { stopRecording(); return 300; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied. Please allow microphone permission.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  }

  function cancelRecording() {
    if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null; }
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
    if (mediaRecorderRef.current) {
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
          const pkRes = await fetch(`${API}/api/auth/public-key/${destPartner}`);
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
  const wallpaperIsDark = isRgbColorDark(wallpaperColor);
  const wallpaperTextColor = wallpaperIsDark ? '#ffffff' : '#111111';
  // Opaque enough to never look "transparent" over a busy/bright patch of the
  // photo, plus backdrop-blur (applied at the bubble itself, see below) so
  // whatever detail still shows through reads as frosted glass, not a raw see-
  // through rectangle — this replaces the old flat rgba(255,255,255,0.14),
  // which was too faint to register as a bubble at all against a bright image.
  const wallpaperReceivedBg = wallpaperIsDark ? 'rgba(24,24,24,0.62)' : 'rgba(255,255,255,0.70)';

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

  if (!isOpen) return null;

  return (
    <div ref={wrapperRef} style={{ display: hiddenByProfileRoute ? 'none' : 'contents' }}>
      <style>{typingCss}</style>
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
      <div onClick={() => setReactorsSheet(null)} style={{position:'fixed',inset:0,zIndex:1000000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-end',justifyContent:'center',animation:'fadeIn 0.15s ease'}}>
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
                let avatarPath = isBlocked ? null : (fromMsg?.senderAvatar || (activeChat?.type === 'private' && (activeChat.partner||'').toLowerCase() === uLower ? activeChat.partnerAvatar : null));
                const avatarSrc = getAvatarUrl(avatarPath);
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
        border: transparentMode ? 'none' : '1px solid rgba(255,255,255,0.08)',
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
            ...(isMobileOrTablet && stableViewportHeight ? { height: stableViewportHeight } : {}),
            backgroundImage: `linear-gradient(rgba(0,0,0,0.38),rgba(0,0,0,0.38)), url("${activeWallpaper.image}")`,
            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {view === 'chat' && (
              <button onClick={handleBackToList} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
                <ArrowLeft size={20} />
              </button>
            )}
            <span
              className="chat-header-title"
              style={{
                fontWeight: 600, fontSize: '1.1rem',
                color: 'var(--header-text)',
                textDecoration: 'none',
                cursor: view === 'chat' && (activeChat?.type === 'private' || activeChat?.type === 'room') ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (view === 'chat' && activeChat?.type === 'private' && activeChat?.partner) {
                  const partner = activeChat.partner.toLowerCase();
                  const isBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner);
                  if (!isBlocked) {
                    leaveChatToViewProfile(activeChat.partner);
                  }
                } else if (view === 'chat' && activeChat?.type === 'room') {
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    onClick={() => { if (!busy) call.startCall(activeChat.partner, 'voice', activeChat.displayName, activeChat.partnerAvatar); }}
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
                    onClick={() => { if (!busy) call.startCall(activeChat.partner, 'video', activeChat.displayName, activeChat.partnerAvatar); }}
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
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {view === 'list' && (
            <div className="chat-list-header" style={{ 
              padding: '16px 20px', 
              position: 'sticky', 
              top: 0,
              // Literal match to the panel's own #0a0a0a — see the top
              // header's identical comment just above in this file.
              background: transparentMode ? 'transparent' : (selectMode ? 'rgba(18, 14, 35, 0.98)' : '#0a0a0a'),
              zIndex: 30,
              borderBottom: transparentMode ? 'none' : '1px solid rgba(255,255,255,0.03)',
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
                      {selectedChats.length} selected
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
                              Mark as read
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
                                  Unmute notifications
                                </>
                              ) : (
                                <>
                                  <BellOff size={16} color="var(--menu-icon)" />
                                  Mute notifications
                                </>
                              )}
                            </button>
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
                                Unlock selected
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
                              {showHiddenChats ? 'Unhide chats' : 'Hide chats'}
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
                Locked Vault {lockedChats.length > 0 ? `(${lockedChats.length})` : ''}
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
                    <div style={{ padding: '4px 8px 12px', fontSize: '0.7rem', fontWeight: 800, color: isLight ? 'var(--brand-2-darker)' : 'var(--brand-1-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vault Security</div>
                    
                    <button
                      onClick={() => {
                        const next = !autoLockOnClose;
                        setAutoLockOnClose(next);
                        localStorage.setItem('chat_lock_auto_on_close', next.toString());
                        toast.success(`Auto-lock on close ${next ? 'enabled' : 'disabled'}`);
                      }}
                      className="chat-menu-item"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.03)', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: 'var(--menu-item-text)', cursor: 'pointer', marginBottom: 6, transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={16} color={autoLockOnClose ? 'var(--brand-1-light)' : 'var(--menu-icon)'} />
                      </div>
                      <div style={{ flex: 1, fontWeight: 500 }}>Auto-lock on close</div>
                      <div style={{ width: 32, height: 18, borderRadius: 20, background: autoLockOnClose ? 'var(--brand-2)' : (isLight ? '#d1d5db' : 'rgba(255,255,255,0.15)'), position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <div style={{ position: 'absolute', top: 3, left: autoLockOnClose ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                      </div>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--brand-2-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TimerIcon size={16} color="var(--brand-2)" />
                      </div>
                      <div style={{ flex: 1, fontSize: '0.85rem', color: isLight ? '#374151' : '#e2e8f0', fontWeight: 500 }}>Auto-lock idle</div>
                      <select
                        value={autoLockMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setAutoLockMinutes(val);
                          localStorage.setItem('chat_lock_auto_minutes', val.toString());
                          toast.success(`Idle lock set to ${val === 0 ? 'Immediate' : val === -1 ? 'Never' : val + ' mins'}`);
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
                        <option value="0">Immediate</option>
                        <option value="1">1 min</option>
                        <option value="5">5 mins</option>
                        <option value="15">15 mins</option>
                        <option value="-1">Never</option>
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
                      <span style={{ fontWeight: 500 }}>Change Vault PIN</span>
                    </button>

                    <button
                      onClick={() => {
                        unlockedSessionsRef.current = {};
                        setShowVaultMenu(false);
                        setShowLockedChats(false);
                        toast.success('Vault locked immediately');
                        window.dispatchEvent(new Event('locked_chats_updated'));
                      }}
                      className="chat-menu-item menu-btn-destructive"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.08)', width: '100%', textAlign: 'left', fontSize: '0.85rem', color: '#ef4444', cursor: 'pointer', marginTop: 4, transition: 'all 0.2s' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldAlert size={16} />
                      </div>
                      <span style={{ fontWeight: 600 }}>Lock Vault Now</span>
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
                Hidden Chats {hiddenChats.length > 0 ? `(${hiddenChats.length})` : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--header-btn)' }}>Tap a chat to open</span>
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
                  <div style={{ fontSize: 14, color: 'var(--header-btn)' }}>Vault is empty</div>
                  <div style={{ fontSize: 12, color: 'var(--menu-icon)' }}>Lock a chat to move it to the vault</div>
                </>
              ) : showHiddenChats ? (
                <>
                  <EyeOff size={28} color="var(--header-btn)" />
                  <div style={{ fontSize: 14, color: 'var(--header-btn)' }}>No hidden chats</div>
                  <div style={{ fontSize: 12, color: 'var(--menu-icon)' }}>Chats you hide will appear here</div>
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
                background: selectedChats.includes(chatKey) ? 'rgba(var(--brand-1-rgb),0.1)' : 'transparent'
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
                  return (
                    <>
                      <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: '50%', background: '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        {chat.type === 'room' ? (
                          <div style={{ width: '100%', height: '100%', background: displayAvatar ? 'none' : 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden' }}>
                            {displayAvatar ? (
                              <img src={getAvatarUrl(displayAvatar)} alt="Room" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Users size={20} color="#fff" />
                            )}
                          </div>
                        ) : (
                          displayAvatar ? (
                            <img src={getAvatarUrl(displayAvatar)} alt="Avatar" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: getAvatarColor(displayName || chat.partner), display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                              <span className="stay-white" style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{getInitials(displayName || chat.partner)}</span>
                            </div>
                          )
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

                        <div style={{ fontSize: '0.85rem', color: isLight ? 'var(--header-btn)' : '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                            <span className="chat-preview" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {reactionPreviewOverrides[chatKey]
                                ? reactionPreviewOverrides[chatKey]
                                : (!chat.lastTimestamp || chat.lastTimestamp === 0)
                                ? <span style={{ color: 'var(--menu-icon)' }}>{chat.type === 'room' ? 'Start a conversation' : 'Start a private chat'}</span>
                                : getMessagePreview(chat, myUsername)
                              }
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 8 }}>
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
                      ...(idx >= arr.length - 2 && arr.length > 3 ? { bottom: 30 } : { top: 55 }),
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
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13 }}>No messages yet. Say hi!</div>
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
                    const isMe = msg.isMe ||
                                 (msg.senderName && msg.senderName.toLowerCase() === mUserLower) ||
                                 (msg.username && msg.username.toLowerCase() === mUserLower);
                  const rowKey = msg.tempId || msg.id || i;
                  if (mediaRuns.memberKeys.has(rowKey)) return null;
                  const mediaGroupItems = mediaRuns.heads.get(rowKey) || null;
                  const reactions = msg.reactions || {};
                  const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const showDateSep = !prevMsg || getDateKey(prevMsg.timestamp) !== getDateKey(msg.timestamp);
                  // The SahaPlay Updates channel is a one-way broadcast — regular users
                  // can't post there at all (see the composer gate below), so reporting/
                  // replying to the admin's own announcement messages doesn't make sense.
                  const canReport = activeChat?.type === 'room' && !isMe && !isSahaplayOfficialGroup(activeChat);
                  const canReplyToMsg = !(activeChat?.type === 'room' && !isMe && isSahaplayOfficialGroup(activeChat));
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
                      else { const touch = e.touches[0]; if (touch) setLongPressPlacement((window.innerHeight - touch.clientY) < 260 ? 'up' : 'down'); }
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
                         style={{marginTop: i === 0 ? 'auto' : 0, display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4, position: 'relative', zIndex: (showLongPressMenu || activeMessageMenu === msg.id) ? 50 : undefined, background: (msgSelectMode && selectedMsgIds.has(rowKey)) ? (isLight ? 'rgba(var(--brand-1-rgb),0.10)' : 'rgba(var(--brand-1-rgb),0.18)') : 'transparent', borderRadius: 12, padding: (msgSelectMode && selectedMsgIds.has(rowKey)) ? '4px 0' : 0, transition: timestampPeek.isPeeking ? 'background 0.15s ease' : 'background 0.15s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1)', transform: `translateX(${timestampPeek.dragX}px)`}}
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
                        <div onClick={() => { const el = document.getElementById(`gcw-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(var(--brand-1-rgb),0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'var(--brand-1)':'var(--brand-2)'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%',cursor:'pointer'}}>
                          <span style={{color:isMe?'var(--brand-1)':'var(--brand-2)',fontWeight:600}}>{(() => {
                            const rName = msg.replyTo.username || msg.replyTo.senderName;
                            if (rName === myUsername) return 'You';
                            const partner = (rName || '').toLowerCase();
                            if (blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner)) return 'User';
                            return rName;
                          })()}: </span>{(() => {
                            const r = msg.replyTo;
                            if (r.mediaType) { const rmt6=r.mediaType; return rmt6.startsWith('video')?'Video':rmt6.startsWith('image')?'Photo':rmt6.startsWith('audio')?'Voice Note':(r.mediaFileName || r._fileName || 'File'); }
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
                           <div style={{ flexShrink:0, width:32, height:32, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'#000', marginTop:2 }}>
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
                               style={{ flexShrink:0, cursor:isBlocked?'default':'pointer', width:32, height:32, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:getAvatarColor(sNameOriginal), marginTop:2 }}
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
                              <span style={{ fontSize: 10, color: '#888', marginBottom: 1 }}>SahaPlay</span>
                            ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                const sName = msg.senderName || msg.username;
                                if (sName && !blockingMe.some(u => u.toLowerCase() === sName.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === sName.toLowerCase())) { leaveChatToViewProfile(sName); }
                              }}
                              style={{ fontSize: 10, color: '#888', marginBottom: 1, cursor: (blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) || blockedChats.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase())) ? 'default' : 'pointer' }}
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
                              className={`msg-bubble ${isMe
                                ? `msg-sent${(!msg.isPoll && (!activeWallpaper || wallpaperIsDark)) ? ' stay-white' : ''}`
                                : (activeWallpaper ? `msg-received${(!msg.isPoll && wallpaperIsDark) ? ' stay-white' : ''}` : 'msg-received')}`}
                              onMouseEnter={() => setHoveredMsgId(msg.id || i)}
                              onMouseLeave={() => setHoveredMsgId(null)}
                              onDoubleClick={(e) => { e.stopPropagation(); handleReact(msg.id, '❤️'); }}
                              style={{
                                position: 'relative',
                                zIndex: 2,
                                // Polls get their own neutral card background regardless of isMe/
                                // wallpaper/custom theme — the vivid sent-bubble gradient (fine for
                                // a line of text) made option rows/vote bars unreadable once a poll's
                                // whole card was painted in it.
                                background: isMediaOnly ? 'transparent' : (msg.isPoll ? (isLight ? '#ffffff' : '#1b1b25') : (transparentMode ? 'rgba(0,0,0,0.3)' : (isMe
                                  ? (activeWallpaper ? (wallpaperColor || 'rgba(255,255,255,0.25)') : (isCustomTheme ? activeTheme.gradient : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))'))
                                  : (activeWallpaper ? wallpaperReceivedBg : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'))))),
                                border: msg.isPoll ? `1px solid ${isLight ? '#e6e9ef' : 'rgba(255,255,255,0.08)'}` : 'none',
                                boxShadow: msg.isPoll ? (isLight ? '0 1px 3px rgba(15,23,42,0.06)' : '0 2px 10px rgba(0,0,0,0.25)') : 'none',
                                ...(activeWallpaper && !isMe && !isMediaOnly && !msg.isPoll ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {}),
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
                                padding: isMediaOnly ? '0' : '10px 16px',
                                borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                fontSize: 14,
                                color: msg.isPoll ? (isLight ? '#0f172a' : '#ffffff') : (transparentMode ? '#fff' : (activeWallpaper ? wallpaperTextColor : (isMe ? '#ffffff' : (isLight ? '#000000' : '#ffffff')))),
                                textShadow: (msg.isPoll || !transparentMode) ? 'none' : '0 1px 4px rgba(0,0,0,0.8)',
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                                transform: `translateX(${rowDragX}px)`,
                                transition: rowDragging ? 'none' : (rowBounce ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.2s ease'),
                                display: isMediaOnly ? 'block' : 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'flex-end',
                                columnGap: 6
                              }}
                            >
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
                                      if (uname === (msg.senderName || '').toLowerCase()) return getAvatarUrl(msg.senderAvatar);
                                      if (activeChat?.type === 'private' && uname === (activeChat.partner || '').toLowerCase()) return getAvatarUrl(activeChat.partnerAvatar);
                                      return null;
                                    };
                                    return (
                                      <PollBubble
                                        poll={pollDef}
                                        pollVotes={msg.pollVotes}
                                        myUsername={myUsername}
                                        onVote={(indices) => handlePollVote(msg, indices)}
                                        onViewVotes={() => setPollVotesTargetKey(String(msg.id || msg.timestamp))}
                                        isLight={isLight}
                                        resolveAvatar={resolveAvatar}
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
                                        onRedial={activeChat?.type === 'private' && !call.callState ? () => call.startCall(activeChat.partner, callData.callType, activeChat.displayName, activeChat.partnerAvatar) : undefined}
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
                              {(() => {
                                if (mediaGroupItems) {
                                  return (
                                    <MediaGrid
                                      items={mediaGroupItems}
                                      forwarded={msg?.forwarded}
                                      expiresAt={msg.mediaExpiresAt}
                                      tick={isMe ? <MessageTick msg={msg} username={myUsername} isLight={isLight} /> : null}
                                      resolveUrl={(it) => resolveDecryptedUrl(it, decryptedMediaUrls)}
                                      onOpenItem={(it, url) => openLightbox(url, it.mediaType)}
                                    />
                                  );
                                }
                                const msgKey = String(msg.id || msg.timestamp);
                                const resolvedUrl = decryptedMediaUrls.current[msgKey] || msg._localMediaUrl || ((msg.mediaUrl && msg.mediaUrl.startsWith('blob:')) ? msg.mediaUrl : (msg.nonce ? null : msg.mediaUrl));
                                const mt = msg.mediaType || '';
                                if (!mt) return null;

                                const isImg = mt.startsWith('image/');
                                const isVid = mt.startsWith('video/');
                                const isAudio = mt.startsWith('audio/');
                                const isFile = mt && !isImg && !isVid && !isAudio;

                                const isDecrypting = !resolvedUrl && !!msg.nonce && (Date.now() - Number(msg.timestamp)) < 30000;

                                return renderMedia(
                                  resolvedUrl,
                                  mt,
                                  isMe,
                                  msg._fileName || msg.mediaFileName,
                                  msg._fileSize || msg.mediaFileSize,
                                  msg.mediaExpiresAt,
                                  isDecrypting,
                                  openLightbox,
                                  isLight,
                                  msg,
                                  myUsername
                                );
                              })()}
                              
                              {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                                <div className="msg-hover-menu" style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                  <button className={(!isMe && isLight) ? 'stay-white' : ''} onClick={(e)=>{ e.stopPropagation(); if (activeMessageMenu !== msg.id) setDropdownPlacement((window.innerHeight - e.clientY) < 240 ? 'up' : 'down'); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowChatMenu(false); setShowAllEmojis(false); setActiveReactionMsg(null); }} style={{background: (!isMe && isLight) ? 'rgba(0,0,0,0.4)' : ((isLight && msg.mediaType) ? 'rgba(0,0,0,0.5)' : (isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)')),backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: '#fff',WebkitTextFillColor: '#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                    <ChevronDown size={14}/>
                                  </button>
                                  {activeMessageMenu === msg.id && (
                                    <div className="menu-dropdown" style={{
                                      position:'absolute',
                                      [dropdownPlacement === 'up' ? 'bottom' : 'top']: '100%',
                                      [dropdownPlacement === 'up' ? 'marginBottom' : 'marginTop']: 4,
                                      // The trigger button always sits at the bubble's own top-right
                                      // corner (regardless of sender). For wide media bubbles that
                                      // corner is near the panel's right edge, so expanding the menu
                                      // further right (as narrow received text bubbles safely do)
                                      // pushes it outside the chat box — anchor it to the right (grow
                                      // leftward, into the bubble) for media the same as for isMe.
                                      [(isMe || isMediaOnly) ? 'right' : 'left']:0,
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
                                        <button key={em} onClick={(e)=>{e.stopPropagation(); handleReact(msg.id, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                      ))}
                                      <button onClick={(e)=>{e.stopPropagation(); setActiveReactionMsg(msg.id); setShowAllEmojis(true);}} style={{background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:12,width:26,height:26,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',color: isLight ? '#000' : '#fff',WebkitTextFillColor: isLight ? '#000' : '#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}><Plus size={14} color={isLight ? '#000' : '#fff'} style={{ color: isLight ? '#000' : '#fff', WebkitTextFillColor: isLight ? '#000' : '#fff' }}/></button>
                                    </div>
                                  </div>
                                )}
                            </div>
                            {showLongPressMenu && (
                              <div className="long-press-menu" style={{
                                position:'absolute',
                                [longPressPlacement === 'up' ? 'bottom' : 'top']: '100%',
                                [longPressPlacement === 'up' ? 'marginBottom' : 'marginTop']: 8,
                                [isMe?'right':'left']:0,
                                background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)',
                                borderRadius:14, padding:10, zIndex:100, display:'flex',
                                flexDirection:'column', gap:8, minWidth:180, boxShadow: 'var(--dropdown-shadow)', fontSize:13
                              }} onClick={e => e.stopPropagation()}>
                                <div style={{display:'flex',alignItems:'center',gap:4}}>
                                  {QUICK_EMOJIS.map(em=>(
                                    <button key={em} onClick={(e)=>{ e.stopPropagation(); handleReact(msg.id, em); longPress.close(); }} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,padding:4,borderRadius:8}}>{em}</button>
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

                                                    <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: (activeReactionMsg === msg.id || hoveredRowId === (msg.id||i)) ? 1 : 0, transition: 'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className={`react-btn-${msg.id||i} react-btn-container`}>
                              <button onClick={(e)=>{ e.stopPropagation(); setActiveReactionMsg(activeReactionMsg===msg.id?null:msg.id); setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: isLight ? '#111' : '#aaa',padding:2}}>
                                <SmilePlus size={16}/>
                              </button>
                            </div>
                          </div>

                          {/* Render active reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={{display:'flex',gap:4,marginTop:2,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start'}}>
                              {Object.entries(msg.reactions).map(([em, users]) => users.length > 0 && (
                                <span key={em} onClick={(e)=>{e.stopPropagation(); setReactorsSheet({ msgId: msg.id, emoji: em, users });}} style={{background: isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.16)', border:`1px solid ${users.includes(myUsername)?'var(--brand-1)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`, borderRadius:12, padding:'2px 8px', fontSize:11, cursor:'pointer', userSelect:'none', color: isLight ? '#1e293b' : '#ddd'}}>
                                  {em} {users.length>1?users.length:''}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="msg-meta-row" style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                            {msg.edited && <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa'}}>{t('edited', 'Edited')}</span>}
                            <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa'}}>{formatTime(msg.timestamp)}</span>
                            {canReplyToMsg && (
                              <button onClick={(e) => { e.stopPropagation(); setReplyToMsg(msg); }} style={{background:'none',border:'none',color: isLight ? '#555' : '#aaa',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                            )}
                            {canReport && (
                              <button onClick={(e) => { e.stopPropagation(); setReportMsgTarget(msg); }} title="Report this message" style={{background:'none',border:'none',color: isLight ? '#555' : '#aaa',cursor:'pointer',padding:0,flexShrink:0}}><Flag size={9}/></button>
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
                              isLight={isLight}
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
          <div style={{
            padding: '12px 14px',
            // A wallpaper theme sits directly on the shared backdrop layer
            // instead of this bar painting its own opaque strip on top of
            // the picture — no border/tint here in that case, same as the
            // messages area right above it. A color-only theme (isCustomTheme
            // with no image) gets the same transparent treatment — it's only
            // meant to recolor bubble text, not paint a background strip
            // under the composer.
            borderTop: (activeWallpaper || isCustomTheme || transparentMode) ? 'none' : '1px solid rgba(255,255,255,0.05)',
            background: (activeWallpaper || isCustomTheme) ? 'transparent' : (transparentMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.2)'),
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
                  <div style={{padding:'6px 12px',marginBottom:6,background:'rgba(var(--brand-1-rgb),0.08)',borderTop:'1px solid rgba(var(--brand-1-rgb),0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                    <span><span style={{color:'var(--brand-1)',fontWeight:600}}>{replyToMsg.senderName || replyToMsg.username || activeChat?.displayName}: </span>{(() => {
                      const r = replyToMsg;
                      if (r.mediaType) { const rmt5=r.mediaType; return rmt5.startsWith('video')?'Video':rmt5.startsWith('image')?'Photo':rmt5.startsWith('audio')?'Voice Note':(r._fileName || r.mediaFileName || 'File'); }
                      if (r.decryptedText) return r.decryptedText.slice(0,50);
                      const raw = r.message || '';
                      if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                      return raw.slice(0,50) || 'Media';
                    })()}</span>
                    <button onClick={()=>setReplyToMsg(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
                  </div>
                )}
                {editingMsg && (
                  <div style={{padding:'6px 12px',marginBottom:6,background:'rgba(56,189,248,0.08)',borderTop:'1px solid rgba(56,189,248,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                    <span style={{display:'flex',alignItems:'center',gap:6}}><Edit2 size={12} color="#38bdf8"/><span style={{color:'#38bdf8',fontWeight:600}}>{t('editingMessage', 'Editing message')}</span></span>
                    <button onClick={()=>{ setEditingMsg(null); setInputValue(''); }} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
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
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 1024) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                          style={{
                            flex: 1,
                            resize: 'none',
                            maxHeight: 120,
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
                                  <div
                                    className="chat-attach-menu-overlay"
                                    onMouseDown={() => setShowAttachMenu(false)}
                                    style={{ position: 'fixed', inset: 0, zIndex: 100020 }}
                                  >
                                    <div
                                      onMouseDown={e => e.stopPropagation()}
                                      style={{
                                        position: 'absolute', bottom: 46, right: 0, minWidth: 180,
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
                        {showCamera && (
                          <CameraCapture
                            onCapture={async (file, caption) => {
                              await handleMediaUpload(file);
                              if (caption && caption.trim()) {
                                setInputValue(caption.trim());
                                setTimeout(() => composerFormRef.current?.requestSubmit(), 60);
                              }
                            }}
                            onClose={() => setShowCamera(false)}
                          />
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
            if (uname === (pollVotesTarget.senderName || '').toLowerCase()) return getAvatarUrl(pollVotesTarget.senderAvatar);
            if (activeChat?.type === 'private' && uname === (activeChat.partner || '').toLowerCase()) return getAvatarUrl(activeChat.partnerAvatar);
            return null;
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
              <p style={{color: isLight ? '#475569' : '#aaa',fontSize:15,marginBottom:16,lineHeight:1.4}}>Are you sure you want to clear your chat history with <strong>{clearChatModalOpen.displayName || clearChatModalOpen.partner}</strong>?</p>
              <label style={{display:'flex',alignItems:'center',gap:12,color: isLight ? '#0f172a' : '#eee',fontSize:14,marginBottom:24,cursor:'pointer', padding: '12px 16px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)'}}>
                <input type="checkbox" checked={clearForBoth} onChange={e=>setClearForBoth(e.target.checked)} style={{accentColor:'#ef4444',cursor:'pointer', width: 20, height: 20}}/>
                Also clear chat history for {clearChatModalOpen.displayName || clearChatModalOpen.partner}
              </label>
              <div style={{display:'flex',gap:14,justifyContent:'flex-end'}}>
                <button onClick={()=>setClearChatModalOpen(false)} className="modal-btn-transition" style={{padding:'14px 28px',background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:800, borderRadius: 18, fontSize: 15}}>Cancel</button>
                <button onClick={()=>{
                  const dmPartner = clearChatModalOpen?.partner;
                  const dmPartnerLower = (dmPartner || '').toLowerCase();
                  if (socketRef.current) socketRef.current.emit('clear_dm', { targetUsername: dmPartner, clearForBoth });
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
                  toast.success('Chat history cleared');
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
      {/* E2EE Key Repair Overlay */}
      {keysMissing && (
        <div style={{
          position: 'absolute', bottom: 80, left: 20, right: 20,
          background: 'rgba(17,18,28,0.95)', border: '1px solid rgba(var(--brand-1-rgb),0.3)',
          borderRadius: 16, padding: '16px', zIndex: 1000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={20} color="var(--brand-1-light)" />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>Secure Chat Setup</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Complete setup to send encrypted messages</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              type="password"
              placeholder="Confirm Password"
              value={repairPassword}
              onChange={e => setRepairPassword(e.target.value)}
              style={{ flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#fff' }}
            />
            <button 
              onClick={() => setupE2EEKeys(repairPassword)}
              disabled={repairingKeys || !repairPassword}
              style={{ background: 'var(--brand-1)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              {repairingKeys ? <Loader2 size={16} className="animate-spin" /> : 'Setup'}
            </button>
            <button onClick={() => setKeysMissing(false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X size={16} /></button>
          </div>
        </div>
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
              onEmojiSelect={(emojiObj) => { setShowAllEmojis(false); handleReact(activeReactionMsg, emojiObj.native); setActiveReactionMsg(null); }}
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
    </div>
  );
});

GlobalChatWidget.displayName = 'GlobalChatWidget';

export default GlobalChatWidget;








