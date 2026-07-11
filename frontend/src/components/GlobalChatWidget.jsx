import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ArrowLeft, Send, X, User, Users, SmilePlus, Reply, Plus, MoreVertical, Search, Paperclip, Loader2, Play, Pause, Trash2, Edit2, MoreHorizontal, ArrowDown, ChevronDown, ChevronLeft, ChevronRight, Lock, ShieldAlert, Pin, Bell, BellOff, MessageSquareX, Eye, EyeOff, CheckCheck, Check, Ban, SquareCheck, Square, Unlock, Timer as TimerIcon, Key, Mic, MicOff, Download, FileText, Music, Clock, Flag } from 'lucide-react';
import ChatLockScreen from './ChatLockScreen';
import ForgotPinModal from './ForgotPinModal';
import ReportMessageModal from './ReportMessageModal';
import PinSetupModal from './PinSetupModal';
import { API } from '../lib/api';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { mergeHistoryBatch } from '../utils/chatHelper.js';
import { getMessagePreview } from '../utils/messagePreview';
import { getAvatarUrl } from '../utils/avatarUtils';
import { clearUserSession } from '../lib/authUtils.js';
import { useSwipeToReply } from '../hooks/useSwipeToReply';
import { useLongPress } from '../hooks/useLongPress';

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢'];

const FILE_LIMITS = {
  'image/jpeg':{ max:10*1024*1024, label:'10MB' }, 'image/jpg':{ max:10*1024*1024, label:'10MB' },
  'image/png':{ max:10*1024*1024, label:'10MB' }, 'image/gif':{ max:10*1024*1024, label:'10MB' },
  'image/webp':{ max:10*1024*1024, label:'10MB' },
  'video/mp4':{ max:100*1024*1024, label:'100MB' }, 'video/webm':{ max:100*1024*1024, label:'100MB' },
  'video/mov':{ max:100*1024*1024, label:'100MB' }, 'video/quicktime':{ max:100*1024*1024, label:'100MB' },
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
  if (mimeType.startsWith('audio/')) return <Music size={size} color={c || "#a855f7"} />;
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
  return '#6366f1';
}

function FileCard({ url, type, fileName, fileSize, isMe, isLight, expiresAt, loading }) {
  const isLoading = loading && !url;
  const isExpired = !url && !isLoading;
  const typeLabel = getFileTypeLabel(type, fileName);
  const sizeLabel = formatFileSize(fileSize);
  const iconBg = getFileIconBg(type);
  const subtitle = isLoading ? (isMe ? 'Sending…' : 'Loading…') : (isExpired ? 'Expired' : [typeLabel, sizeLabel].filter(Boolean).join(' • '));

  let expiryLine = null;
  if (expiresAt && !isExpired) {
    const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24));
    if (daysLeft > 0) {
      const expiryColor = isLight ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.6)';
      expiryLine = <div className="fc-expiry" style={{ fontSize: 9, color: expiryColor, WebkitTextFillColor: expiryColor, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={8} color={expiryColor} style={{ flexShrink: 0 }} />Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</div>;
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
  const dlColor = isLight ? '#6d28d9' : (isMe ? 'rgba(255,255,255,0.8)' : '#a5b4fc');
  const iconCircleBg = isLight ? `${iconBg}22` : iconBg;
  const iconColor = isLight ? iconBg : '#fff';

  return (
    <div style={{ background: cardBg, borderRadius: 10, padding: '10px 12px', minWidth: 200, maxWidth: 250, border: `1px solid ${cardBorder}`, marginTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 42, borderRadius: 8, background: iconCircleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (isExpired || isLoading) ? 0.5 : 1 }}>
          {isLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: iconColor }} /> : <FileTypeIcon mimeType={type} size={18} color={iconColor} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fc-name" style={{ fontSize: 11, fontWeight: 700, color: fileNameColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', WebkitTextFillColor: fileNameColor }}>
            {fileName || 'File'}
          </div>
          <div className="fc-sub" style={{ fontSize: 10, fontWeight: 400, color: subtitleColor, marginTop: 2, WebkitTextFillColor: subtitleColor }}>{subtitle}</div>
          {expiryLine}
        </div>
        {!isExpired && !isLoading && (
          <button className="fc-dl" onClick={handleDownload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dlColor, padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Download size={14} color={dlColor} />
          </button>
        )}
      </div>
    </div>
  );
}

const _vnReg_gcw = { el: null, pauseFn: null };

function AudioPlayerBubble({ url, expiresAt, isMe, isLight, loading }) {
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
  const loadBg = isMe ? 'rgba(255,255,255,0.1)' : (isLight ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.06)');

  if (isLoading) return (
    <div style={{ padding: '8px 12px', background: loadBg, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: isMe ? 'rgba(255,255,255,0.12)' : (isLight ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.18)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
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
    ? (isLight ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.15)')
    : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)');
  const playedColor = '#a855f7';
  const unplayedColor = isMe
    ? (isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)')
    : (isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)');
  const timeColor = isMe
    ? (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)')
    : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)');
  const dlColor = isMe
    ? (isLight ? '#6366f1' : 'rgba(255,255,255,0.7)')
    : (isLight ? '#7c3aed' : '#c084fc');
  const displayTime = (playing || currentTime > 0) ? fmtDur(currentTime) : fmtDur(duration);

  return (
    <div style={{ background: bubbleBg, borderRadius: 10, padding: '8px 12px', minWidth: 200, marginTop: 2 }}>
      <audio ref={audioRef} src={url} preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={toggle} style={{ background: '#a855f7', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
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
          <Download size={14} color={dlColor} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginLeft: 40 }}>
        <span className="rcp-vn-time" style={{ fontSize: 10, color: timeColor, WebkitTextFillColor: timeColor }}>{displayTime}</span>
        {expiresAt && (() => {
          const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24));
          if (daysLeft <= 0) return null;
          const expTc = daysLeft <= 7 ? '#f59e0b' : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.55)');
          const expTxt = daysLeft <= 7 ? `⚠️ ${daysLeft}d left` : `${daysLeft}d left`;
          return <span className="rcp-vn-expiry" style={{ fontSize: 10, color: expTc, WebkitTextFillColor: expTc }}>{expTxt}</span>;
        })()}
      </div>
    </div>
  );
}

const renderMedia = (url, type, isMe, fileName, fileSize, expiresAt, loading, onOpenLightbox, isLight) => {
  if (!url && !type) return null;
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  const isAudio = type?.startsWith('audio/');

  if (isAudio) return <AudioPlayerBubble url={url} expiresAt={expiresAt} isMe={isMe} isLight={isLight} loading={loading} />;

  if (!isImg && !isVid) return <FileCard url={url} type={type} fileName={fileName} fileSize={fileSize} isMe={isMe} isLight={isLight} expiresAt={expiresAt} loading={loading} />;

  if (!url) {
    if (loading) return <div style={{ width: 220, height: isVid ? 140 : 160, borderRadius: 10, background: isMe ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#6366f1', opacity: 0.6 }} /></div>;
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
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
            onClick={() => onOpenLightbox(url, type)}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<div style="color:#666;font-size:11px;padding:16px;text-align:center">Failed to load image</div>';
            }}
          />
          {expiresAt && (() => { const dL = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24)); if (dL <= 0) return null; return <div style={{ position: 'absolute', bottom: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Clock size={8} color="#fff" style={{ flexShrink: 0 }} />Expires in {dL} day{dL !== 1 ? 's' : ''}</div>; })()}
        </>
      ) : (
        <div onClick={() => onOpenLightbox(url, type)} style={{ position: 'relative', width: '100%', height: 140, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} muted />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(99,102,241,0.5)' }}>
              <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </div>
          </div>
          {expiresAt && (() => { const dL = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24)); if (dL <= 0) return null; return <div style={{ position: 'absolute', bottom: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Clock size={8} color="#fff" style={{ flexShrink: 0 }} />Expires in {dL} day{dL !== 1 ? 's' : ''}</div>; })()}
        </div>
      )}
    </div>
  );
};

import { formatDistanceToNow } from 'date-fns';
import { useScrollToBottom } from '../hooks/useScrollToBottom';
import { useDebounce } from '../hooks/useDebounce';
import { useCrypto } from '../contexts/CryptoContext';
import { encryptDM, encryptGroupMessage, decryptDM, decryptGroupMessage, decryptDMSenderCopy, robustDecode, encryptMedia, decryptMedia } from '../lib/crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

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

  /* ── Mobile/tablet: replace visible Reply/timestamp/Report with swipe + long-press gestures ── */
  @media (max-width: 1023.98px) {
    .msg-meta-row { display: none !important; }
  }
  .typing-dots { display: inline-flex; gap: 2px; align-items: center; margin-left: 4px; }
  .typing-dot { width: 4px; height: 4px; background: #6366f1; borderRadius: 50%; display: inline-block; animation: dot-wave 1.3s infinite ease-in-out; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  
  /* ── Chat Menu Hover Effects ── */
  .menu-btn { color: var(--menu-item-text); transition: color 0.2s ease, background 0.2s ease; }
  .menu-btn svg { transition: color 0.2s ease; }
  .menu-btn-danger:hover { background: rgba(239, 68, 68, 0.12) !important; color: #ef4444 !important; }
  .menu-btn-danger:hover svg { color: #ef4444 !important; }

  /* ── Data-hovertype: guaranteed color change for both icon and text ── */
  [data-hovertype="danger"]:hover { color: #dc2626 !important; background: rgba(239, 68, 68, 0.12) !important; }
  [data-hovertype="danger"]:hover * { color: #dc2626 !important; }
  [data-hovertype="primary"]:hover { color: #4f46e5 !important; background: rgba(99, 102, 241, 0.1) !important; }
  [data-hovertype="primary"]:hover * { color: #4f46e5 !important; }
  
  /* Modal Button Transitions */
  .modal-btn-transition { transition: transform 0.2s ease-in-out; }
  .modal-btn-transition:hover { transform: translateY(-2px); }

  html[data-theme='light'] .menu-btn-danger:hover { background: rgba(239, 68, 68, 0.12) !important; color: #dc2626 !important; }
  html[data-theme='light'] .menu-btn-danger:hover svg { color: #dc2626 !important; }
  .menu-btn-primary:hover { background: rgba(99, 102, 241, 0.1) !important; color: #6366f1 !important; }
  .menu-btn-primary:hover svg { color: #6366f1 !important; }
  html[data-theme='light'] .menu-btn-primary:hover { background: rgba(99, 102, 241, 0.1) !important; color: #4f46e5 !important; }
  html[data-theme='light'] .menu-btn-primary:hover svg { color: #4f46e5 !important; }

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
    --menu-divider: rgba(255,255,255,0.08);
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
    --menu-divider: #e2e8f0;
    --header-text: #0f172a;
    --header-btn: #475569;
    --input-bg: #f8fafc;
    --input-border: #e2e8f0;
    --input-text: #0f172a;
  }

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
    color: #4f46e5 !important;
    text-decoration: underline !important;
  }
  .stay-white { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
  /* Ensure stay-white elements inside received messages stay white (higher specificity than msg-received *) */
  html[data-theme='light'] .msg-received .stay-white,
  html[data-theme='light'] .msg-received .stay-white * {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
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
    --menu-divider: rgba(255,255,255,0.08);
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
    color: #a5b4fc !important;
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

  /* msg-menu-unsend = "Unsend" (sent) + "Delete" (received): always RED.
     html[data-theme] prefix lifts specificity to (0,3,1) to beat the
     html[data-theme='light'] .msg-bubble * white rule (0,2,1) from index.css. */
  .chat-widget-main-panel .msg-menu-unsend {
    color: #ef4444 !important;
    -webkit-text-fill-color: #ef4444 !important;
  }
  .chat-widget-main-panel .msg-menu-unsend svg {
    color: #ef4444 !important;
    stroke: #ef4444 !important;
  }
  .chat-widget-main-panel .msg-menu-unsend:hover {
    color: #ef4444 !important;
    -webkit-text-fill-color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.1) !important;
  }
  .chat-widget-main-panel .msg-menu-unsend:hover svg {
    color: #ef4444 !important;
    stroke: #ef4444 !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-unsend,
  html[data-theme='dark'] .chat-widget-main-panel .msg-menu-unsend {
    color: #ef4444 !important;
    -webkit-text-fill-color: #ef4444 !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-unsend svg,
  html[data-theme='dark'] .chat-widget-main-panel .msg-menu-unsend svg {
    color: #ef4444 !important;
    stroke: #ef4444 !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-unsend:hover,
  html[data-theme='dark'] .chat-widget-main-panel .msg-menu-unsend:hover {
    color: #ef4444 !important;
    -webkit-text-fill-color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.1) !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-unsend:hover svg,
  html[data-theme='dark'] .chat-widget-main-panel .msg-menu-unsend:hover svg {
    color: #ef4444 !important;
    stroke: #ef4444 !important;
  }

  /* msg-menu-delete = "Delete for me" (sent only): WHITE in dark mode, BLACK in light mode. */
  .chat-widget-main-panel .msg-menu-delete {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  .chat-widget-main-panel .msg-menu-delete svg {
    color: #ffffff !important;
    stroke: #ffffff !important;
  }
  .chat-widget-main-panel .msg-menu-delete:hover {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    background: rgba(239, 68, 68, 0.1) !important;
  }
  .chat-widget-main-panel .msg-menu-delete:hover svg {
    color: #ffffff !important;
    stroke: #ffffff !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-delete {
    color: #1e293b !important;
    -webkit-text-fill-color: #1e293b !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-delete svg {
    color: #1e293b !important;
    stroke: #1e293b !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-delete:hover {
    color: #1e293b !important;
    -webkit-text-fill-color: #1e293b !important;
    background: rgba(239, 68, 68, 0.1) !important;
  }
  html[data-theme='light'] .chat-widget-main-panel .msg-menu-delete:hover svg {
    color: #1e293b !important;
    stroke: #1e293b !important;
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
                    background: '#6366f1',
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
                      background: '#6366f1',
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


// â”€â”€ Media Lightbox â”€â”€
function MediaLightbox({ items, index, onClose, onPrev, onNext }) {
  const item = items?.[index];
  const url = item?.url;
  const type = item?.type;
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  const hasMultiple = items?.length > 1;

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple && index > 0) onPrev?.();
      if (e.key === 'ArrowRight' && hasMultiple && index < items.length - 1) onNext?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext, hasMultiple, index, items?.length]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!url) return;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = isImg ? `image_${Date.now()}.jpg` : `video_${Date.now()}.mp4`;
      a.click();
    } catch {}
  };

  if (!item) return null;

  return (
    <div
      onClick={onClose}
      className="media-lightbox-overlay gcw-force-dark"
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="media-lightbox-card"
        style={{
          position: 'relative', background: '#111', borderRadius: 16, overflow: 'hidden',
          width: 'min(640px, 92vw)', height: 'min(520px, 88vh)',
          display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a1a1a', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
          <span style={{ color: '#ccc', fontSize: 13, fontWeight: 600 }}>
            {hasMultiple ? `${index + 1} / ${items.length}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDownload} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', color: '#111', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#111', display: 'flex' }}><Download size={14} /></span> Save
            </button>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#111', display: 'flex' }}><X size={16} /></span>
            </button>
          </div>
        </div>

        {/* Media area */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#000', minHeight: 200 }}>
          {isImg ? (
            <img src={url} alt="Media" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain' }} />
          ) : isVid ? (
            <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
          ) : null}

          {hasMultiple && index > 0 && (
            <button onClick={e => { e.stopPropagation(); onPrev?.(); }}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
              <span style={{ color: '#fff', display: 'flex' }}><ChevronLeft size={20} /></span>
            </button>
          )}
          {hasMultiple && index < items.length - 1 && (
            <button onClick={e => { e.stopPropagation(); onNext?.(); }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
              <span style={{ color: '#fff', display: 'flex' }}><ChevronRight size={20} /></span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
  isRoomHost
}, ref) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const vaultMenuRef = useRef(null);
  const myUsername = (localStorage.getItem('watch_username') || '').toLowerCase();
  // ─── E2EE Keys ───
  const { keyPair, setKeyPair, needsReauth, reloadPrivateKeyWithPassword, isReady } = useCrypto();
  // keyPairRef lets socket event handlers (stale closures from mount time) always see the
  // latest key pair — without this, handlers capture keyPair=null and silently fail to decrypt.
  const keyPairRef = useRef(null);
  useEffect(() => { keyPairRef.current = keyPair; }, [keyPair]);
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
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [activeChat, setActiveChat] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const paginationStateRef = useRef({});
  const scrollContainerRef = useRef(null);
  const scrollAnchorRef = useRef(null);
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
  };
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [reportMsgTarget, setReportMsgTarget] = useState(null);
  // Single shared instance for the whole thread — see hooks/useSwipeToReply.js for why
  // these aren't called per-message inside the .map() below.
  const swipe = useSwipeToReply();
  const longPress = useLongPress();
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [activeRelation, setActiveRelation] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { items: [{url, type}], index }
  const [typingStatuses, setTypingStatuses] = useState({}); // chatKey -> Set of usernames typing
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
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
  const prevMsgCountRef = useRef(0);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
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

  useLayoutEffect(() => {
    if (scrollAnchorRef.current && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      const { prevScrollHeight, prevScrollTop } = scrollAnchorRef.current;
      el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
      scrollAnchorRef.current = null;
    }
  }, [messages]);

  const { showScrollArrow, handleScroll, scrollToBottom } = useScrollToBottom(messagesEndRef);
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
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{color:isMe?'#fff':(isLight ? '#4f46e5' : '#6366f1'), textDecoration:'underline'}} onClick={e=>e.stopPropagation()}>{part}</a>;
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
    if (!token || socketRef.current || !isReady) return;
    const sock = io(API, { auth: { token }, transports: ['websocket'] });
    socketRef.current = sock;

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
        if (match) {
          fetchConversations();
        }
        return conversations;
      });
    };

    sock.on('chat:message_deleted', handleRemoteDelete);
    sock.on('message:unsent', handleRemoteDelete);
    sock.on('message:removed-for-me', handleRemoteDelete);



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
      window.dispatchEvent(new CustomEvent('follow_status_updated', { detail: data }));
      const currentChat = activeChatRef.current;
      const actor = data.requester || data.follower || data.actor;
      const target = data.accepter || data.following || data.target;
      
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
      
      const isViewingThis = currentView === 'chat' && (currentChat?.partner === partner || currentChat?.id === partner);

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
                      } catch (e) { console.warn('[E2EE] Async group media decrypt failed:', e); }
                    })();
                    decryptedMediaUrl = null;
                  }
                } else if (msg.message) {
                  decryptedMessage = decryptGroupMessage(msg.message, msgNonce, userKeyWrap, senderPK, activeKey.secretKey) || '\uD83D\uDD12 Encrypted message';
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
          // 1. Check if user is looking at this chat in the Global Widget itself
          if (isViewingThis) skipToast = true;

          // 2. Check if user is looking at this chat in the specialized Room panel
          const lowerPartner = partner.toLowerCase();
          const lowerActivePartner = (activeRoomPartner || '').toLowerCase();
          if (isGroup) {
             if (activeRoomTab === 'group' && lowerPartner === lowerActivePartner) skipToast = true;
          } else {
             if (activeRoomTab === 'dm' && lowerPartner === lowerActivePartner) skipToast = true;
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
            }
          }
        }
      }
      
      // Always refresh conversation list to show latest preview
      setConversations(prev => {
        const conversations = Array.isArray(prev) ? prev : [];
        const exists = conversations.find(c => c.partner === partner || c.id === partner);
        const isViewingThis = currentView === 'chat' && (currentChat?.partner === partner || currentChat?.id === partner);

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

    return () => { sock.disconnect(); socketRef.current = null; };
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
    if (messages.length > prevMsgCountRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // Autofocus input when opening a chat or replying
  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [view, activeChat, replyToMsg]);

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
            return { ...c, ...mediaMeta };
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

        const finalFetched = decryptedFetched.map(c => {
          const chatKey = c.id || c.partner;
          const finalC = { ...c, targetId: c.partnerId || c.targetId };

          // CLEARED ROOM OVERRIDE: zero out if no new messages arrived after the clear.
          // Compare server's lastTimestamp against the moment the user cleared the chat.
          // Only show the preview if a truly NEW message (sent after the clear) exists.
          if (c.type === 'room' && clearedRoomsMap[chatKey]) {
            const clearTs = clearedRoomsMap[chatKey]?.clearedAt || 0;
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
  
  const decryptGlobalChatMessages = async (fetched, type) => {
    const kp = keyPairRef.current;
    const decrypted = await Promise.all(fetched.map(async (m) => {
      const mUserLower = myUsername?.toLowerCase();
      const msgIsMe = m.isMe || (m.senderName && m.senderName.toLowerCase() === mUserLower) || (m.username && m.username.toLowerCase() === mUserLower);

      if (!m.nonce) return { ...m, decryptedText: m.message || '' }; 
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
                    decryptedMediaUrl = objectUrl; decryptedText = '';
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
                    decryptedMediaUrl = objectUrl; decryptedText = '';
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
                    decryptedMediaUrl = objectUrl; decryptedText = '';
                  } catch(e) { console.warn('[E2EE] Group history media decrypt failed:', e); }
                }
              } else if (m.message && m.message !== '') {
                decryptedText = decryptGroupMessage(m.message, m.nonce, userKeyWrap, senderPK, kp.secretKey);
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

      const decrypted = await decryptGlobalChatMessages(fetched, type);

      if (requestId !== latestHistoryRequestRef.current) return;
      
      // Replace messages atomically — no merge needed since we cleared before fetching
      setMessages(resolveReplyMessages(decrypted));

      // Sync the sidebar preview with the latest message from history.
      // This fixes rooms that show "Start a conversation" because fetchConversations didn't
      // find them (e.g. user never sent a message, or room was restarted from memory).
      if (decrypted.length > 0 && type === 'room') {
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

        const processed = await decryptGlobalChatMessages(fetched, type);

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
      replyTo: replyToMsg ? {
        id: replyToMsg.id,
        username: replyToMsg.senderName || replyToMsg.username || activeChat?.displayName,
        message: replyToMsg.mediaType ? (replyToMsg.mediaType.startsWith('video') ? 'Video' : replyToMsg.mediaType.startsWith('image') ? 'Photo' : replyToMsg.mediaType.startsWith('audio') ? 'Voice Note' : 'File') : (replyToMsg.decryptedText || (looksLikeCiphertext(replyToMsg.message||'') ? '' : (replyToMsg.message||'')))
      } : null
    };
    const previousConversations = [...conversations];
    
    setMessages(prev => [...prev, optimisticMsg]);
    setInputValue('');
    setReplyToMsg(null);

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
      } else if (false && activeChat.type === 'room' && keyPair) {
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
            console.log('[E2EE] Group Encryption success');
          } catch (err) {
            console.error('[E2EE] Group Encryption failed:', err);
            // isEncrypted remains false
          }
        }
      }

      const postBody = {
        type: activeChat.type,
        partner: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : activeChat.partner,
        targetId: activeChat.type === 'private' ? activeChat.targetId : null,
        roomId: activeChat.type === 'room' ? (activeChat.partner || activeChat.id).toLowerCase() : null,
        message: messagePayload || optimisticMsg.message, // Fallback to plaintext ONLY if NO keyPair
        senderMessage: senderMessagePayload,
        plaintextMessage: !isEncrypted ? optimisticMsg.message : undefined,
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

  const handleMediaUpload = async (file, mediaDuration = null) => {
    const validation = validateFile(file);
    if (!validation.valid) { toast.error(validation.error); return; }

    if (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) {
      toast.error('📷 Media sharing is not allowed in this room.');
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
      _fileSize: file.size
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
      let encryptedBlob = null;
      let mediaKeyBytes = null;
      let mediaKeyB64 = null;

      if (!isRoom) {
        const enc = await encryptMedia(file);
        encryptedBlob = enc.encryptedBlob;
        mediaKeyBytes = enc.mediaKeyBytes;
        mediaKeyB64 = encodeBase64(mediaKeyBytes);
      }

      const fd = new FormData();
      fd.append('media', isRoom ? file : encryptedBlob, file.name);
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

      // STRICT SECURITY: For private chats, E2E encryption is mandatory.
      if (activeChat.type === 'private' && !isEncrypted) {
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
          replyTo: replyToMsg ? {
            id: replyToMsg.id,
            username: replyToMsg.senderName || replyToMsg.username || activeChat?.displayName,
            message: replyToMsg.mediaType ? (replyToMsg.mediaType.startsWith('video') ? 'Video' : replyToMsg.mediaType.startsWith('image') ? 'Photo' : replyToMsg.mediaType.startsWith('audio') ? 'Voice Note' : 'File') : (replyToMsg.decryptedText || replyToMsg.message)
          } : null,
          tempId: tempId,
          mediaFileName: file.name || null,
          mediaFileSize: file.size || null,
          mediaDuration: mediaDuration ? Number(mediaDuration) : null
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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    e.target.value = null;
    if (!file) return;
    await handleMediaUpload(file);
  };

  function formatRecordingTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

  const buildMediaItems = (msgs) => msgs.map(m => {
    const mt = m.mediaType || '';
    if (!mt.startsWith('image/') && !mt.startsWith('video/')) return null;
    const msgKey = String(m.id || m.timestamp);
    const url = decryptedMediaUrls.current[msgKey] || m._localMediaUrl ||
      ((m.mediaUrl && m.mediaUrl.startsWith('blob:')) ? m.mediaUrl : (m.nonce ? null : m.mediaUrl));
    return url ? { url, type: mt } : null;
  }).filter(Boolean);

  const openLightbox = (url, type) => {
    const items = buildMediaItems(messages);
    const idx = items.findIndex(i => i.url === url);
    setLightbox({ items: items.length ? items : [{ url, type }], index: idx >= 0 ? idx : 0 });
  };

  const perms = activeChat?.permissions || roomPermissions;
  const isHost = activeChat?.isHost || isRoomHost;
  const chatLocked = perms?.chat === 'host';
  const linksBlocked = perms?.allowLinks === false;
  const mediaBlocked = perms?.allowMedia === false;

  if (!isOpen) return null;

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <style>{typingCss}</style>
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
    <div ref={containerRef} className={`chat-widget-main-panel${transparentMode ? ' gcw-force-dark' : ''}`} style={{
        position: 'fixed',
        top: transparentMode ? 0 : 80,
        right: transparentMode ? 0 : 20,
        width: transparentMode ? 400 : 380,
        height: transparentMode ? '100vh' : 'calc(100vh - 100px)',
        background: transparentMode ? 'transparent' : 'rgba(10, 10, 10, 0.82)',
        backdropFilter: transparentMode ? 'none' : 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: transparentMode ? 'none' : 'blur(24px) saturate(180%)',
        boxShadow: transparentMode ? 'none' : '0 20px 50px rgba(0,0,0,0.5)',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        zIndex: 10000,
        overflow: 'hidden',
        borderRadius: transparentMode ? 0 : 32,
        border: transparentMode ? 'none' : '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Lightbox portal — fixed overlay above everything */}
        {lightbox && createPortal(
          <MediaLightbox
            items={lightbox.items}
            index={lightbox.index}
            onClose={() => setLightbox(null)}
            onPrev={() => setLightbox(lb => lb ? { ...lb, index: Math.max(0, lb.index - 1) } : null)}
            onNext={() => setLightbox(lb => lb ? { ...lb, index: Math.min(lb.items.length - 1, lb.index + 1) } : null)}
          />,
          document.body
        )}
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '16px 20px', 
          background: transparentMode ? 'transparent' : 'rgba(0,0,0,0.3)',
          borderBottom: transparentMode ? 'none' : '1px solid rgba(255,255,255,0.06)' 
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
                cursor: view === 'chat' && activeChat?.type === 'private' ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (view === 'chat' && activeChat?.type === 'private' && activeChat?.partner) {
                  const partner = activeChat.partner.toLowerCase();
                  const isBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner);
                  if (!isBlocked) {
                    navigate(`/profile/${activeChat.partner}`);
                  }
                }
              }}
              title={view === 'chat' && activeChat?.type === 'private' ? ((blockingMe.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase()) || blockedChats.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase())) ? 'Blocked User' : `Go to ${activeChat?.partner}'s profile`) : ''}
            >
              {view === 'list' ? t('conversations', 'Conversations') : (activeChat?.type === 'private' && (blockingMe.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase()) || blockedChats.some(u => u.toLowerCase() === activeChat.partner?.toLowerCase())) ? t('user', 'User') : activeChat?.displayName)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'10px 14px', background: hoveredMenuBtn==='editName' ? 'rgba(99,102,241,0.1)' : 'transparent', border:'none', color: hoveredMenuBtn==='editName' ? '#4f46e5' : 'var(--menu-item-text)', WebkitTextFillColor: hoveredMenuBtn==='editName' ? '#4f46e5' : 'var(--menu-item-text)', textAlign:'left', cursor:'pointer', borderRadius:8, fontSize:13, fontWeight:600, transition:'all 0.2s' }}>
                          <Edit2 size={14} color={hoveredMenuBtn==='editName' ? '#4f46e5' : undefined}/> {t('editName', 'Edit Name')}
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
                          background: showLockedChats ? 'rgba(99,102,241,0.12)' : 'transparent',
                          width: '100%', textAlign: 'left',
                          fontSize: '0.85rem', color: showLockedChats ? '#818cf8' : 'var(--menu-item-text)',
                          cursor: 'pointer', transition: 'background 0.18s'
                        }}
                        className="chat-menu-item"
                      >
                        {showLockedChats ? <Unlock size={16} color="#818cf8" /> : <Lock size={16} color="var(--menu-icon)" />}
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
                          background: showHiddenChats ? 'rgba(99,102,241,0.12)' : 'transparent',
                          width: '100%', textAlign: 'left',
                          fontSize: '0.85rem', color: showHiddenChats ? '#818cf8' : 'var(--menu-item-text)',
                          cursor: 'pointer', transition: 'background 0.18s'
                        }}
                        className="chat-menu-item"
                      >
                        <EyeOff size={16} color={showHiddenChats ? '#818cf8' : 'var(--menu-icon)'} />
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
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {view === 'list' && (
            <div className="chat-list-header" style={{ 
              padding: '16px 20px', 
              position: 'sticky', 
              top: 0,
              background: transparentMode ? 'transparent' : (selectMode ? 'rgba(18, 14, 35, 0.98)' : 'rgba(10, 10, 10, 0.98)'), 
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
                          <SquareCheck size={20} color="#818cf8" fill="rgba(129,140,248,0.1)" />
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
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: 20,
                      color: 'var(--input-text)',
                      fontSize: 13,
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.background = 'var(--menu-item-hover)';
                      e.target.style.borderColor = 'rgba(99,102,241,0.3)';
                    }}
                    onBlur={(e) => {
                      e.target.style.background = 'var(--input-bg)';
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
                    <div style={{ padding: '4px 8px 12px', fontSize: '0.7rem', fontWeight: 800, color: isLight ? '#6d28d9' : '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vault Security</div>
                    
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
                        <Lock size={16} color={autoLockOnClose ? '#818cf8' : 'var(--menu-icon)'} />
                      </div>
                      <div style={{ flex: 1, fontWeight: 500 }}>Auto-lock on close</div>
                      <div style={{ width: 32, height: 18, borderRadius: 20, background: autoLockOnClose ? '#8b5cf6' : (isLight ? '#d1d5db' : 'rgba(255,255,255,0.15)'), position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <div style={{ position: 'absolute', top: 3, left: autoLockOnClose ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                      </div>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TimerIcon size={16} color="#a855f7" />
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
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pin size={16} color="#6366f1" />
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
              background: 'rgba(99,102,241,0.08)',
              borderBottom: '1px solid rgba(99,102,241,0.15)'
            }}>
              <button
                onClick={() => setShowHiddenChats(false)}
                style={{
                  background: 'transparent', border: 'none', color: '#818cf8',
                  cursor: 'pointer', display: 'flex', padding: 0
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <EyeOff size={14} color="#818cf8" />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#818cf8', flex: 1 }}>
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
            return (
              <div key={chatKey} onClick={() => selectMode ? toggleSelectChat(chatKey) : openChat(chat)} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                transition: 'background 0.2s', position: 'relative',
                background: selectedChats.includes(chatKey) ? 'rgba(99,102,241,0.1)' : 'transparent'
              }} 
              onMouseEnter={(e) => {
                e.currentTarget.style.background = selectedChats.includes(chatKey) ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)';
                setHoveredConvId(chatKey);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = selectedChats.includes(chatKey) ? 'rgba(99,102,241,0.1)' : 'transparent';
                setHoveredConvId(null);
              }}
              >
                {selectMode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                    {selectedChats.includes(chatKey) ? (
                      <SquareCheck size={20} color="#818cf8" fill="rgba(129,140,248,0.1)" />
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
                          <div style={{ width: '100%', height: '100%', background: displayAvatar ? 'none' : 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden' }}>
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
                              background: chat.type === 'room' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.2)',
                              color: chat.type === 'room' ? '#818cf8' : '#4ade80',
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
                              {(!chat.lastTimestamp || chat.lastTimestamp === 0)
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
                              <Lock size={14} className="chat-status-icon" color="#818cf8" style={{ flexShrink: 0 }} />
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
                    }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', color: lockedChats.includes(chatKey) ? '#818cf8' : 'var(--menu-item-text)', cursor: 'pointer', transition: 'background 0.2s' }}>
                      {lockedChats.includes(chatKey) ? <Unlock size={16} color="#818cf8" /> : <Lock size={16} color="var(--menu-icon)" />}
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

          {view === 'chat' && (
            <div 
              ref={scrollContainerRef}
              onScroll={(e) => {
                handleScroll(e);
                const el = e.currentTarget;
                if (el.scrollTop < 50) {
                  loadMoreHistory(el);
                }
              }}
              onClick={() => { setActiveReactionMsg(null); setShowAllEmojis(false); setShowEmojiPicker(false); setActiveMessageMenu(null); longPress.close(); }} 
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}
            >
              {historyLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              )}
              {messages.length === 0 ? (
                loading ? (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13 }}>No messages yet. Say hi!</div>
                )
              ) : (
                (() => {
                  const effectiveSeenMap = getEffectiveSeenBy(messages, myUsername);
                  const lastMsg = messages[messages.length - 1];
                  const isLastSentByMe = lastMsg && (lastMsg.isMe || (lastMsg.username && lastMsg.username.toLowerCase() === myUsername?.toLowerCase()) || (lastMsg.senderName && lastMsg.senderName.toLowerCase() === myUsername?.toLowerCase()));
                  const renderReceiptIndex = isLastSentByMe ? messages.length - 1 : -1;
                  return messages.map((msg, i) => {
                    const mUserLower = myUsername?.toLowerCase();
                    const isMe = msg.isMe ||
                                 (msg.senderName && msg.senderName.toLowerCase() === mUserLower) ||
                                 (msg.username && msg.username.toLowerCase() === mUserLower);
                  const reactions = msg.reactions || {};
                  const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const showDateSep = !prevMsg || getDateKey(prevMsg.timestamp) !== getDateKey(msg.timestamp);
                  const rowKey = msg.tempId || msg.id || i;
                  const canReport = activeChat?.type === 'room' && !isMe;
                  const swipeHandlers = swipe.getHandlers(rowKey, isMe ? 'left' : 'right', () => setReplyToMsg(msg));
                  const longPressHandlers = longPress.getHandlers(rowKey);
                  const gestureHandlers = {
                    onTouchStart: (e) => { if (longPress.activeId === rowKey) longPress.close(); swipeHandlers.onTouchStart(e); longPressHandlers.onTouchStart(e); },
                    onTouchMove: (e) => { swipeHandlers.onTouchMove(e); longPressHandlers.onTouchMove(e); },
                    onTouchEnd: (e) => { swipeHandlers.onTouchEnd(e); longPressHandlers.onTouchEnd(e); },
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
                         style={{marginTop: i === 0 ? 'auto' : 0, display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                      {msg.replyTo && (
                        <div onClick={() => { const el = document.getElementById(`gcw-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(99,102,241,0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'#6366f1':'#a855f7'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%',cursor:'pointer'}}>
                          <span style={{color:isMe?'#6366f1':'#a855f7',fontWeight:600}}>{(() => {
                            const rName = msg.replyTo.username || msg.replyTo.senderName;
                            if (rName === myUsername) return 'You';
                            const partner = (rName || '').toLowerCase();
                            if (blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner)) return 'User';
                            return rName;
                          })()}: </span>{(() => {
                            const r = msg.replyTo;
                            const raw = r.message || '';
                            if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                            return raw.slice(0,60) || 'Media';
                          })()}
                        </div>
                      )}
                      <div style={{display:'flex',alignItems:'flex-start',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'95%'}}>
                         {/* Profile avatar — left side for all incoming messages */}
                         {!isMe && (() => {
                           const sNameOriginal = msg.senderName || msg.username || '?';
                           const partner = sNameOriginal.toLowerCase();
                           const isBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner);
                           const sName = isBlocked ? 'User' : sNameOriginal;
                           const aSrc = isBlocked ? null : getAvatarUrl(msg.senderAvatar);
                           return (
                             <div
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 if (!isBlocked) {
                                   navigate(`/profile/${sNameOriginal}`); 
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
                            <span
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const sName = msg.senderName || msg.username;
                                if (sName && !blockingMe.some(u => u.toLowerCase() === sName.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === sName.toLowerCase())) navigate(`/profile/${sName}`); 
                              }}
                              style={{ fontSize: 10, color: '#888', marginBottom: 1, cursor: (blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) || blockedChats.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase())) ? 'default' : 'pointer' }}
                              title={`View ${msg.senderName || msg.username}'s profile`}
                            >{(blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) || blockedChats.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase())) ? 'User' : (msg.senderName || msg.username)}</span>
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
                              color: '#7c3aed', zIndex: 1, pointerEvents: 'none'
                            }}>
                              <Reply size={18} style={{ transform: isMe ? 'scaleX(-1)' : 'none' }} />
                            </div>
                            <div
                              className={`msg-bubble ${isMe ? 'msg-sent stay-white' : 'msg-received'}`}
                              onMouseEnter={() => setHoveredMsgId(msg.id || i)}
                              onMouseLeave={() => setHoveredMsgId(null)}
                              style={{
                                position: 'relative',
                                zIndex: 2,
                                background: isMediaOnly ? 'transparent' : (transparentMode ? 'rgba(0,0,0,0.3)' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'))),
                                padding: isMediaOnly ? '0' : '10px 16px',
                                borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                fontSize: 14,
                                color: transparentMode ? '#fff' : (isMe ? '#ffffff' : (isLight ? '#000000' : '#ffffff')),
                                textShadow: transparentMode ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                                transform: `translateX(${rowDragX}px)`,
                                transition: rowDragging ? 'none' : (rowBounce ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.2s ease')
                              }}
                            >
                              {(!msg.mediaType && !msg.message && !msg.e2ee && !msg.nonce) ? (
                                <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, fontStyle:'italic'}}>{t('messageUnavailable', '[Message unavailable]')}</div>
                              ) : msg.decryptedText !== null ? (
                                <MessageText text={msg.decryptedText} isMe={isMe} isLight={isLight} />
                              ) : (
                                (!msg.mediaType && msg.message && looksLikeCiphertext(msg.message)) ? (
                                  <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                                ) : (
                                  msg.message && !msg.mediaType && <MessageText text={msg.message} isMe={isMe} isLight={isLight} />
                                )
                              )}
                              {(() => {
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
                                  isLight
                                );
                              })()}
                              
                              {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                                <div style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                  <button className={(!isMe && isLight) ? 'stay-white' : ''} onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowChatMenu(false); setShowAllEmojis(false); setActiveReactionMsg(null); }} style={{background: (!isMe && isLight) ? 'rgba(0,0,0,0.4)' : ((isLight && msg.mediaType) ? 'rgba(0,0,0,0.5)' : (isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)')),backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: '#fff',WebkitTextFillColor: '#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                    <ChevronDown size={14}/>
                                  </button>
                                  {activeMessageMenu === msg.id && (
                                    <div style={{
                                      position:'absolute', top:'100%', [isMe?'right':'left']:0, marginTop:4, 
                                      background:'var(--dropdown-bg)', border:'1px solid var(--dropdown-border)', 
                                      borderRadius:12, padding:6, zIndex:100, 
                                      boxShadow:'var(--dropdown-shadow)', minWidth: 145,
                                      WebkitTextFillColor: 'currentColor', color: 'var(--menu-item-text)'
                                    }} onClick={e => e.stopPropagation()}>
                                      {isMe ? (
                                        <>
                                          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn msg-menu-unsend" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#ef4444', WebkitTextFillColor:'#ef4444', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', transition: 'background 0.2s'}}>
                                            <Trash2 size={12} color="#ef4444"/> {t('unsend', 'Unsend')}
                                          </button>
                                          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn msg-menu-delete" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', transition: 'background 0.2s'}}>
                                            <Trash2 size={12} color="currentColor"/> {t('deleteForMe', 'Delete for me')}
                                          </button>
                                        </>
                                      ) : (
                                        <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} className="chat-menu-item menu-btn msg-menu-unsend" style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#ef4444', WebkitTextFillColor:'#ef4444', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', transition: 'background 0.2s'}}>
                                          <Trash2 size={12} color="#ef4444"/> {t('delete', 'Delete')}
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
                                position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8,
                                background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)',
                                borderRadius:12, padding:'8px 12px', zIndex:100, display:'flex',
                                flexDirection:'column', gap:8, minWidth:130, boxShadow: 'var(--dropdown-shadow)', fontSize:13
                              }} onClick={e => e.stopPropagation()}>
                                <span style={{ color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: 11 }}>{formatTime(msg.timestamp)}</span>
                                <button onClick={() => { setReplyToMsg(msg); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                  <Reply size={14} style={{ transform: isMe ? 'scaleX(-1)' : 'none' }} /> {t('reply', 'Reply')}
                                </button>
                                {canReport && (
                                  <button onClick={() => { setReportMsgTarget(msg); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                    <Flag size={14} /> {t('report', 'Report')}
                                  </button>
                                )}
                              </div>
                            )}

                                                    <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: (activeReactionMsg === msg.id || hoveredRowId === (msg.id||i)) ? 1 : 0, transition: 'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className={`react-btn-${msg.id||i}`}>
                              <button onClick={(e)=>{ e.stopPropagation(); setActiveReactionMsg(activeReactionMsg===msg.id?null:msg.id); setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: isLight ? '#111' : '#aaa',padding:2}}>
                                <SmilePlus size={16}/>
                              </button>
                            </div>
                          </div>

                          {/* Render active reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={{display:'flex',gap:4,marginTop:2,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start'}}>
                              {Object.entries(msg.reactions).map(([em, users]) => users.length > 0 && (
                                <span key={em} onClick={(e)=>{e.stopPropagation(); handleReact(msg.id, em);}} style={{background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)', border:`1px solid ${users.includes(myUsername)?'#6366f1' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`, borderRadius:12, padding:'2px 8px', fontSize:11, cursor:'pointer', userSelect:'none', color: isLight ? '#1e293b' : '#ddd'}}>
                                  {em} {users.length>1?users.length:''}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="msg-meta-row" style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                            <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa'}}>{formatDistanceToNow(Number(msg.timestamp) || Date.now())} ago</span>
                            <button onClick={(e) => { e.stopPropagation(); setReplyToMsg(msg); }} style={{background:'none',border:'none',color: isLight ? '#555' : '#aaa',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                            {activeChat?.type === 'room' && !isMe && (
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
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '50%',
                width: 42,
                height: 42,
                cursor: 'pointer',
                zIndex: 9999,
                boxShadow: '0 8px 20px rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                border: '2px solid rgba(255,255,255,0.15)',
                animation: 'msg-enter 0.4s ease forwards'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(99,102,241,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(99,102,241,0.2)'; }}
            >
              <ArrowDown color="white" size={22} />
            </div>
          )}

        </div>

        {/* Input area for chat view */}
        {view === 'chat' && (
          <div style={{
            padding: '12px 14px',
            borderTop: transparentMode ? 'none' : '1px solid rgba(255,255,255,0.05)',
            background: transparentMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.2)',
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
                <a className="stay-white" href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }} style={{ display: 'inline-block', marginTop: 12, padding: '8px 20px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff !important', borderRadius: 10, textDecoration: 'none', fontSize: 11, fontWeight: 800, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
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
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Plus size={18} color="#6366f1" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{t('friendshipRequired', 'Friendship Required')}</div>
                <p style={{ fontSize: 11, color: '#888', margin: 0, lineHeight: 1.5 }}>
                  {activeRelation.followStatus === 'accepted' 
                    ? t('waitingForFollowBack', { name: activeChat.displayName, defaultValue: `Waiting for ${activeChat.displayName} to follow you back.` }) 
                    : activeRelation.isFollowingMe 
                      ? t('needToFollowBack', { name: activeChat.displayName, defaultValue: `You need to follow ${activeChat.displayName} back to chat.` })
                      : t('needMutualFollow', 'You need to follow each other to start messaging.')}
                </p>
                {activeRelation.followStatus !== 'accepted' && (
                  <button className="stay-white" onClick={() => navigate(`/profile/${activeChat.partner}`)} style={{ marginTop: 12, padding: '8px 20px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 10, color: '#fff !important', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(99,102,241,0.4)'; e.currentTarget.style.filter = 'brightness(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.2)'; e.currentTarget.style.filter = 'brightness(1)'; }}>
                    {t('viewProfile', 'View Profile')}
                  </button>
                )}
              </div>
            ) : (
              <>
                {replyToMsg && (
                  <div style={{padding:'6px 12px',marginBottom:6,background:'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                    <span><span style={{color:'#6366f1',fontWeight:600}}>{replyToMsg.senderName || replyToMsg.username || activeChat?.displayName}: </span>{(() => {
                      const r = replyToMsg;
                      if (r.mediaType) { const rmt5=r.mediaType; return rmt5.startsWith('video')?'Video':rmt5.startsWith('image')?'Photo':rmt5.startsWith('audio')?'Voice Note':'File'; }
                      if (r.decryptedText) return r.decryptedText.slice(0,50);
                      const raw = r.message || '';
                      if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                      return raw.slice(0,50) || 'Media';
                    })()}</span>
                    <button onClick={()=>setReplyToMsg(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
                  </div>
                )}
                
                {showEmojiPicker && (
                  <div className="emoji-picker-container" style={{position:'absolute', bottom:'100%', left:12, marginBottom:10, zIndex:100, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', borderRadius:10}} onMouseDown={(e) => e.stopPropagation()}>
                    <Picker data={data} onEmojiSelect={(e) => { setInputValue(prev => prev + e.native); }} theme={isLight ? 'light' : 'dark'} previewPosition="none" searchPosition="none" navPosition="bottom" />
                  </div>
                )}
                
                {/* Hidden file input — accepts all supported types; validateFile() enforces limits */}
                <input type="file" ref={fileInputRef} style={{ display: 'none' }}
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/mov,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/mpeg,audio/wav,audio/ogg,audio/m4a,audio/webm"
                  onChange={handleFileSelect} />


                {activeChat && typingStatuses[activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner] && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 45, marginBottom: 8, fontSize: 11, color: '#10b981', fontWeight: 500 }}>
                    {[...typingStatuses[activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner]].join(', ')} typing...
                  </div>
                )}

                <form onSubmit={(e) => {
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

                  {/* ── Voice recording UI ── */}
                  {isRecording && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 12px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, minWidth: 28, letterSpacing: '0.5px' }}>{formatRecordingTime(recordingTime)}</span>
                      <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', height: 22, overflow: 'hidden' }}>
                        {waveHeights.map((h, i) => (
                          <div key={i} style={{ width: 3, borderRadius: 3, background: 'linear-gradient(to top, #6366f1, #a855f7)', flexShrink: 0, height: `${h}%`, transition: 'height 0.08s ease', minHeight: 3 }} />
                        ))}
                      </div>
                      <button type="button" onClick={cancelRecording} title="Delete Recording" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}><Trash2 size={14} /></button>
                      <button className="stay-white" type="button" onClick={stopRecording} style={{ background: '#6366f1', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                        <Check size={11} color="#fff" strokeWidth={2.5} /> <span className="stay-white" style={{ color: '#fff' }}>Done</span>
                      </button>
                    </div>
                  )}

                  {/* ── Voice note preview ── */}
                  {!isRecording && audioBlob && audioUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '8px 12px' }}>
                      <Music size={14} color="#a855f7" style={{ flexShrink: 0 }} />
                      <audio src={audioUrl} controls style={{ height: 24, flex: 1 }} />
                      <button type="button" onClick={cancelRecording} title="Delete Recording" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}><Trash2 size={14} /></button>
                      <button className="stay-white" type="button" onClick={sendVoiceNote} disabled={isUploading} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                        {isUploading ? <Loader2 size={11} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={11} color="#fff" /> <span className="stay-white" style={{ color: '#fff' }}>Send</span></>}
                      </button>
                    </div>
                  )}

                  {!isRecording && !audioBlob && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          ref={inputRef}
                          type="text"
                          placeholder={activeChat?.type === 'room' && chatLocked && !isHost ? t('onlyHostCanMessage', 'Only the host can message...') : t('messagePlaceholder', 'Message...')}
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
                          style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 14,
                            padding: '12px 18px',
                            paddingRight: (!inputValue && !isUploading) ? '108px' : '18px',
                            color: '#fff',
                            fontSize: 14,
                            outline: 'none',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onFocus={e => { e.target.style.background = 'rgba(255,255,255,0.07)'; e.target.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                          onBlur={e => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        />

                        {!inputValue && !isUploading && (
                          <div style={{ position: 'absolute', right: 8, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button type="button" className="emoji-toggle-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background:'transparent', border:'none', color:'#555', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}>
                              <SmilePlus size={20} />
                            </button>
                            {/* Attachment button — opens unified file picker */}
                            <button
                              type="button"
                              disabled={isUploading || !!(activeChat?.type === 'room' && mediaBlocked && !isHost)}
                              onClick={() => {
                                if (activeChat?.type === 'room' && mediaBlocked && !isHost) {
                                  toast.error('📷 Media sharing is not allowed in this room.');
                                  return;
                                }
                                fileInputRef.current?.click();
                              }}
                              title="Attach image, video, document or file"
                              style={{ background:'transparent', border:'none', color: isUploading ? '#6366f1' : '#555', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4, opacity: (activeChat?.type === 'room' && mediaBlocked && !isHost) ? 0.4 : 1 }}
                            >
                              <Paperclip size={18} />
                            </button>
                            {/* Mic button — inside input box, hidden while typing */}
                            <button
                              type="button"
                              onClick={startRecording}
                              title="Record voice note"
                              style={{ background:'transparent', border:'none', color:'#818cf8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}
                            >
                              <Mic size={18} />
                            </button>
                          </div>
                        )}

                        {isUploading && (
                          <div style={{ position: 'absolute', right: 12 }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} color="#6366f1" />
                          </div>
                        )}
                      </div>

                      <button type="submit" disabled={(!inputValue.trim() && !isUploading) || !!(activeChat?.type === 'room' && chatLocked && !isHost)} style={{
                        width:44, height:44, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#a855f7)', border:'none', cursor: (activeChat?.type === 'room' && chatLocked && !isHost) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:((!inputValue.trim() && !isUploading) || (activeChat?.type === 'room' && chatLocked && !isHost))?0.5:1, flexShrink: 0
                      }}>
                        <Send size={18} color="#fff" />
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
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
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={22} color="#6366f1" />
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
                  <button type="submit" className="modal-btn-transition stay-white" style={{padding:'14px 36px',background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:18,color:'#ffffff',cursor:'pointer',fontWeight:900, fontSize: 15, boxShadow: '0 6px 20px rgba(99,102,241,0.4)'}}><span className="stay-white">Save</span></button>
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
          background: 'rgba(17,18,28,0.95)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 16, padding: '16px', zIndex: 1000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={20} color="#818cf8" />
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
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
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
          <div style={{ width: 400, background: '#161725', borderRadius: 24, padding: 32, textAlign: 'center', border: '1px solid rgba(168,85,247,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Key size={32} color="#a855f7" />
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
              searchPosition="none" 
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








