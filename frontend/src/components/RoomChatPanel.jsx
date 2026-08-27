import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import toast from 'react-hot-toast';
import {
  Users, Send, MessageSquare, Reply, Flag, Lock, BellOff, Bell, Pin, Eye,
  X, ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, MoreHorizontal, SmilePlus, Plus, ArrowDown, ChevronDown, Ban,
  Image as ImageIcon, Paperclip, FilePlus, Loader2, Play, Pause, CheckCheck, Check, Star, Shield, Mic, Download, Music, FileText, Clock, Copy,
  SquareCheck, Square, Forward, User, Phone, Video, PhoneMissed, Palette, Camera
} from 'lucide-react';
import { CHAT_THEMES, CHAT_THEME_BUBBLE_STRIDE } from '../lib/chatThemes';
import CameraCapture from './CameraCapture';
import ExpiryReminderBanner from './ExpiryReminderBanner';
import { countSoonExpiringMedia, dismissExpiryBanner12h, snoozeExpiryBannerUntilClose, clearExpiryBannerCloseSuppression } from '../utils/expiryReminders';
import { useCall, CALL_LOG_PREFIX } from '../contexts/CallContext';
import { useScrollToBottom } from '../hooks/useScrollToBottom';
import { useSwipeToReply } from '../hooks/useSwipeToReply';
import { useLongPress } from '../hooks/useLongPress';
import { useTimestampPeek } from '../hooks/useTimestampPeek';
import { useBackIntercept } from '../hooks/useBackIntercept';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';
import crownImg from '../assets/crown.svg';
import { getAvatarUrl, getRoomThumbnailUrl } from '../utils/avatarUtils';
import ChatLockScreen from './ChatLockScreen';
import MediaLightbox from './MediaLightbox';
import { getMessagePreview } from '../utils/messagePreview';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const getMessageCopyText = (msg) => {
  if (!msg) return '';
  if (msg.decryptedText) return msg.decryptedText;
  if (!msg.mediaType && msg.message && !looksLikeCiphertext(msg.message)) return msg.message;
  return '';
};

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const isMessageEditable = (msg) => !!getMessageCopyText(msg) && (Date.now() - Number(msg.timestamp) <= EDIT_WINDOW_MS);

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

const formatUsername = (name) => {
  if (!name) return '';
  if (name.toLowerCase().startsWith('guest_')) {
    return name.slice(6);
  }
  return name;
};

// WhatsApp-style call-summary bubble — renders in place of raw text whenever
// a decrypted DM message starts with CALL_LOG_PREFIX (see
// CallContext.writeCallLog). Mirrors GlobalChatWidget's CallLogBubble so a
// call log looks identical whether viewed from the global chat widget or a
// room's own DM tab. Tap to redial, mirroring WhatsApp.
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
  'application/zip':{ max:25*1024*1024, label:'25MB' }, 'application/x-zip-compressed':{ max:25*1024*1024, label:'25MB' },
  'audio/mp3':{ max:10*1024*1024, label:'10MB' }, 'audio/mpeg':{ max:10*1024*1024, label:'10MB' },
  'audio/wav':{ max:10*1024*1024, label:'10MB' }, 'audio/ogg':{ max:10*1024*1024, label:'10MB' },
  'audio/m4a':{ max:10*1024*1024, label:'10MB' }, 'audio/webm':{ max:10*1024*1024, label:'10MB' },
  'audio/mp4':{ max:10*1024*1024, label:'10MB' },
  'application/octet-stream':{ max:50*1024*1024, label:'50MB' },
};

const EXTENSION_LIMITS = {
  'jpg':{ max:10*1024*1024, label:'10MB' }, 'jpeg':{ max:10*1024*1024, label:'10MB' },
  'png':{ max:10*1024*1024, label:'10MB' }, 'gif':{ max:10*1024*1024, label:'10MB' },
  'webp':{ max:10*1024*1024, label:'10MB' },
  'mp4':{ max:50*1024*1024, label:'50MB' }, 'webm':{ max:50*1024*1024, label:'50MB' },
  'mov':{ max:50*1024*1024, label:'50MB' }, 'mkv':{ max:50*1024*1024, label:'50MB' },
  'pdf':{ max:25*1024*1024, label:'25MB' },
  'doc':{ max:25*1024*1024, label:'25MB' }, 'docx':{ max:25*1024*1024, label:'25MB' },
  'xls':{ max:25*1024*1024, label:'25MB' }, 'xlsx':{ max:25*1024*1024, label:'25MB' },
  'ppt':{ max:25*1024*1024, label:'25MB' }, 'pptx':{ max:25*1024*1024, label:'25MB' },
  'txt':{ max:25*1024*1024, label:'25MB' }, 'csv':{ max:25*1024*1024, label:'25MB' },
  'zip':{ max:25*1024*1024, label:'25MB' },
  'mp3':{ max:10*1024*1024, label:'10MB' }, 'wav':{ max:10*1024*1024, label:'10MB' },
  'ogg':{ max:10*1024*1024, label:'10MB' }, 'm4a':{ max:10*1024*1024, label:'10MB' },
};

const ALLOWED_EXTENSIONS = new Set([
  'jpg','jpeg','png','gif','webp',
  'mp4','webm','mov','mkv',
  'pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip',
  'mp3','wav','ogg','m4a'
]);

function getMediaType(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  if (['jpg','jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (['mov','mkv'].includes(ext)) return 'video/quicktime';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'xls') return 'application/vnd.ms-excel';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'ppt') return 'application/vnd.ms-powerpoint';
  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (ext === 'zip') return 'application/zip';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  return file.type || 'application/octet-stream';
}

function validateFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(ext)) return { valid: false, error: `❌ File type .${ext} is not supported` };
  const limit = FILE_LIMITS[file.type] || EXTENSION_LIMITS[ext] || { max: 25*1024*1024, label: '25MB' };
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

function resolveDecryptedUrl(m, decryptedUrlsRef) {
  const decrypted = decryptedUrlsRef?.current && (
    decryptedUrlsRef.current[m.id] ||
    decryptedUrlsRef.current[m.tempId] ||
    decryptedUrlsRef.current[String(m.timestamp)]
  );
  return decrypted || m._localMediaUrl || ((m.mediaUrl && m.mediaUrl.startsWith('blob:')) ? m.mediaUrl : (m.nonce ? null : m.mediaUrl));
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
    } catch { toast.error('Download failed'); }
  };

  // In light mode all cards use white bg + pure black text regardless of sender
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

// One voice note plays at a time across the room chat panel
const _vnReg_rcp = { el: null, pauseFn: null };

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

  // Cleanup RAF and global registry on unmount
  React.useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (_vnReg_rcp.el === audioRef.current) { _vnReg_rcp.el = null; _vnReg_rcp.pauseFn = null; }
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

  // MediaRecorder WebM files have duration=Infinity — seek to end to force real duration
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
    if (_vnReg_rcp.el === audioRef.current) { _vnReg_rcp.el = null; _vnReg_rcp.pauseFn = null; }
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    // If mid-duration-detection (seeked to 1e9), reset position first
    if (el.currentTime > 1e5) el.currentTime = 0;

    if (isPlayingRef.current) {
      el.pause();
      isPlayingRef.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setPlaying(false);
      if (_vnReg_rcp.el === el) { _vnReg_rcp.el = null; _vnReg_rcp.pauseFn = null; }
    } else {
      // Stop any other playing voice note in this panel
      if (_vnReg_rcp.el && _vnReg_rcp.el !== el && _vnReg_rcp.pauseFn) {
        _vnReg_rcp.pauseFn();
        _vnReg_rcp.el.pause();
      }
      isPlayingRef.current = true;
      setPlaying(true); // immediate UI feedback
      // Start RAF immediately — fills bars as soon as audio data arrives
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
      _vnReg_rcp.el = el;
      _vnReg_rcp.pauseFn = () => {
        isPlayingRef.current = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setPlaying(false);
      };
      el.play().catch(() => {
        isPlayingRef.current = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setPlaying(false);
        if (_vnReg_rcp.el === el) { _vnReg_rcp.el = null; _vnReg_rcp.pauseFn = null; }
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
    } catch { toast.error('Download failed'); }
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
  // Before play: show total duration. While playing or paused mid-track: show elapsed.
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

const MenuStyles = () => (
  <style>{`
    #room-chat-panel {
      --dropdown-bg: #1f2026;
      --dropdown-border: rgba(255,255,255,0.08);
      --dropdown-shadow: 0 8px 32px rgba(0,0,0,0.7);
      --menu-item-text: #eee;
      --menu-divider: rgba(255,255,255,0.22);
    }
    html[data-theme='light'] #room-chat-panel {
      --dropdown-bg: #ffffff;
      --dropdown-border: rgba(0,0,0,0.08);
      --dropdown-shadow: 0 10px 30px rgba(0,0,0,0.1);
      --menu-item-text: #0f172a;
      --menu-divider: #cbd5e1;
    }

    @keyframes menuFadeIn {
      from { opacity: 0; transform: translateY(10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pulse-red { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes wave-bar { from { height: 3px; } to { height: 100%; } }
    /* ── Document card text: override msg-sent/stay-white !important rules in light mode ── */
    html[data-theme='light'] .fc-name,
    html[data-theme='light'] .msg-sent .fc-name,
    html[data-theme='light'] .stay-white .fc-name { color: #111111 !important; -webkit-text-fill-color: #111111 !important; }
    html[data-theme='light'] .fc-sub,
    html[data-theme='light'] .msg-sent .fc-sub,
    html[data-theme='light'] .stay-white .fc-sub { color: rgba(0,0,0,0.65) !important; -webkit-text-fill-color: rgba(0,0,0,0.65) !important; }
    html[data-theme='light'] .fc-expiry,
    html[data-theme='light'] .msg-sent .fc-expiry,
    html[data-theme='light'] .stay-white .fc-expiry { color: rgba(0,0,0,0.62) !important; -webkit-text-fill-color: rgba(0,0,0,0.62) !important; }
    /* ── Voice note time and expiry: override stay-white / msg-sent forcing ── */
    html[data-theme='light'] .rcp-vn-time,
    html[data-theme='light'] .msg-sent .rcp-vn-time,
    html[data-theme='light'] .stay-white .rcp-vn-time { color: rgba(0,0,0,0.6) !important; -webkit-text-fill-color: rgba(0,0,0,0.6) !important; }
    html[data-theme='light'] .rcp-vn-expiry,
    html[data-theme='light'] .msg-sent .rcp-vn-expiry,
    html[data-theme='light'] .stay-white .rcp-vn-expiry { color: rgba(0,0,0,0.6) !important; -webkit-text-fill-color: rgba(0,0,0,0.6) !important; }
    .voice-trash-btn { background: transparent !important; border: none !important; cursor: pointer !important; display: flex !important; align-items: center !important; padding: 4px !important; border-radius: 6px !important; transition: color 0.2s !important; }
    html:not([data-theme='light']) .voice-trash-btn svg { color: rgba(255,255,255,0.45) !important; }
    html:not([data-theme='light']) .voice-trash-btn:hover svg { color: #ef4444 !important; }
    html[data-theme='light'] .voice-trash-btn svg { color: rgba(0,0,0,0.55) !important; }
    html[data-theme='light'] .voice-trash-btn:hover svg { color: #dc2626 !important; }
    .menu-dropdown {
      animation: menuFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: top right;
    }
    .menu-btn {
      transition: all 0.2s ease !important;
      color: var(--menu-item-text) !important;
      -webkit-text-fill-color: var(--menu-item-text) !important;
    }
    .menu-btn svg {
      color: var(--menu-item-text) !important;
      -webkit-text-fill-color: var(--menu-item-text) !important;
      transition: all 0.2s ease !important;
    }
    /* Hover = background tint only. Icon/text color deliberately does NOT
       change here (kept at the base .menu-btn color) — a prior version forced
       both to var(--brand-1) on hover, which is what needs to stop. */
    .menu-btn:hover {
      background: rgba(59, 130, 246, 0.14) !important;
    }
    html[data-theme='light'] .menu-btn:hover {
      background: rgba(59, 130, 246, 0.12) !important;
    }
    
    .menu-btn-danger {
      color: #ef4444 !important;
      -webkit-text-fill-color: #ef4444 !important;
    }
    .menu-btn-danger svg {
      color: #ef4444 !important;
      -webkit-text-fill-color: #ef4444 !important;
    }
    .menu-btn-danger:hover {
      background: rgba(239, 68, 68, 0.12) !important;
      color: #ef4444 !important;
      -webkit-text-fill-color: #ef4444 !important;
    }
    .menu-btn-danger:hover svg {
      color: #ef4444 !important;
      -webkit-text-fill-color: #ef4444 !important;
    }
    html[data-theme='light'] .menu-btn-danger:hover {
      background: rgba(239, 68, 68, 0.12) !important;
      color: #dc2626 !important;
      -webkit-text-fill-color: #dc2626 !important;
    }
    html[data-theme='light'] .menu-btn-danger:hover svg {
      color: #dc2626 !important;
      -webkit-text-fill-color: #dc2626 !important;
    }

    /* "Delete for me" in message dropdown: keep original text color, light red background on hover.
       Overrides the global .menu-btn:hover { color: var(--brand-1) } rule without changing the text. */
    .menu-btn-del-me {
      color: var(--menu-item-text) !important;
      -webkit-text-fill-color: var(--menu-item-text) !important;
    }
    .menu-btn-del-me svg {
      color: var(--menu-item-text) !important;
      -webkit-text-fill-color: var(--menu-item-text) !important;
    }
    .menu-btn-del-me:hover {
      background: rgba(239, 68, 68, 0.1) !important;
      color: var(--menu-item-text) !important;
      -webkit-text-fill-color: var(--menu-item-text) !important;
    }
    .menu-btn-del-me:hover svg {
      color: var(--menu-item-text) !important;
      -webkit-text-fill-color: var(--menu-item-text) !important;
    }

    /* Specific overrides to prevent stay-white/msg-sent inside the dropdown from turning text white in light mode */
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

    /* Hover states for the dropdown items under stay-white/msg-sent in light mode */
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

    /* menu-btn-del-me inside stay-white/msg-sent: keep text color, light red bg on hover */
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

    /* ── Mobile/tablet: replace visible Reply/timestamp/Report with swipe + long-press gestures ── */
    @media (max-width: 1023.98px) {
      #room-chat-panel .msg-meta-row { display: none !important; }
      /* "Select messages" is desktop-only there — touch users long-press a
         message row's empty side area to enter select mode instead. */
      #room-chat-panel .desktop-only-menu-item { display: none !important; }
    }
  `}</style>
);

function getDateKey(ts) {
  const d = new Date(Number(ts));
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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

function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false;
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
  if (str.startsWith('encv1:')) return true;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
}

function getInitials(name) { return (name||'?').slice(0,2).toUpperCase(); }
function getAvatarColor(name) {
  const colors = ['#6366f1','#a855f7','#ec4899','#ef4444','#f97316','#10b981','#3b82f6','#06b6d4'];
  let h = 0; for (let c of (name||'')) h = c.charCodeAt(0) + ((h<<5)-h);
  return colors[Math.abs(h) % colors.length];
}
function formatTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Detect URLs (http/https AND bare domains like .com/.in/.org etc) and make them clickable
const URL_REGEX = /(https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|in|org|net|io|co|app|dev|xyz|info|me|tv|ai|uk|us|au|ca|gg|to|link|ly|store|online|tech|live)[^\s]*)/g;

function enforceWordLimit(val) {
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
}

function MessageText({ text, isMe }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  if (!text) return null;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

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

  const renderedText = renderMessageText(displayText, isMe);

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

function renderMessageText(text, isMe) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: isMe ? 'rgba(255,255,255,0.9)' : (document.documentElement.getAttribute('data-theme')==='light' ? 'var(--brand-1-dark)' : 'var(--brand-1-light)'), textDecoration: 'underline', wordBreak: 'break-all', cursor: 'pointer', fontWeight: 500 }}
          onClick={e => e.stopPropagation()}
        >{part}</a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

function Avatar({ name, size=36, isHost=false, isAdmin=false, isMuted=false, src, style={} }) {
  const bg = getAvatarColor(name);
  
  let borderColor = 'rgba(255,255,255,0.15)';
  let shadow = 'none';
  if (isHost) {
    borderColor = '#FFD700';
    shadow = '0 0 8px #FFD70055';
  } else if (isAdmin) {
    borderColor = '#3b82f6';
    shadow = '0 0 8px #3b82f655';
  }

  return (
    <div style={{ position:'relative', display:'inline-flex', flexShrink:0, ...style }}>
      <div className="stay-white" style={{ width:size, height:size, borderRadius:'50%', background:bg,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0,
        border: `2px solid ${borderColor}`,
        boxShadow: shadow,
        overflow:'hidden' }}>
        {src ? (
          <img src={src} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
        ) : null}
        <span className="stay-white" style={{display: src ? 'none' : 'flex', color: '#fff'}}>{getInitials(name)}</span>
      </div>
      {isMuted && (
        <div className="stay-white" style={{ position: 'absolute', bottom: -2, right: -2, width: size * 0.4, height: size * 0.4, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #16161e', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          <MicOff size={size * 0.25} color="#fff" />
        </div>
      )}
    </div>
  );
}

// MediaLightbox is imported from ./MediaLightbox (shared with Admin.jsx's Reports/Support attachment viewers).

function ReadReceipt({ msg, isGroup, username, userList, isLight }) {
  const [isOpen, setIsOpen] = React.useState(false);
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
              const uObj = userList?.find(u => u.username.toLowerCase() === r.username.toLowerCase());
              const avatar = r.avatar || uObj?.avatarPath;
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
                    <img src={avatarSrc} alt={r.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              const uObj = userList?.find(u => u.username.toLowerCase() === r.username.toLowerCase());
              const avatar = r.avatar || uObj?.avatarPath;
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
                      <img src={avatarSrc} alt={r.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
// or 'sent' (neither yet — single grey check).
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

export default function RoomChatPanel({ p }) {
  const { showScrollArrow, handleScroll, scrollToBottom } = useScrollToBottom(p.messagesEndRef);
  
  const groupScrollContainerRef = React.useRef(null);
  const dmScrollContainerRef = React.useRef(null);
  // Which collapsed "Theme changed N times" runs (keyed by the run's head
  // message key — see groupNoticeRuns) the user has manually expanded.
  const [expandedNoticeRuns, setExpandedNoticeRuns] = React.useState(() => new Set());
  const myUser = (localStorage.getItem('watch_username') || p.username || '').toLowerCase();
  const call = useCall();

  // "Remind me later" on the expiry banner only suppresses it until this
  // chat is closed (switched away from group/dm/list, or unmounted) — clear
  // that suppression whenever chatTab changes away or the target changes, so
  // it reappears next time the same chat is reopened.
  const roomExpiryKey = (p.roomId || '').toLowerCase();
  React.useEffect(() => {
    return () => { clearExpiryBannerCloseSuppression(roomExpiryKey); };
  }, [roomExpiryKey, p.chatTab, p.chatVisible]);
  const dmExpiryKey = (p.dmTarget || '').toLowerCase();
  React.useEffect(() => {
    return () => { clearExpiryBannerCloseSuppression(dmExpiryKey); };
  }, [dmExpiryKey, p.chatTab, p.chatVisible]);

  const prevGroupMsgCount = React.useRef(p.groupMessages.length);
  const prevFirstGroupMsgId = React.useRef(null);
  const groupScrollAnchorRef = React.useRef(null);
  const prevGroupChatTabRef = React.useRef(p.chatTab);
  const isFirstRenderGroup = React.useRef(true);

  React.useLayoutEffect(() => {
    const container = groupScrollContainerRef.current;
    const justSwitchedIntoView = prevGroupChatTabRef.current !== 'group' && p.chatTab === 'group';
    prevGroupChatTabRef.current = p.chatTab;

    if (!container || p.chatTab !== 'group') {
      if (p.chatTab === 'group') {
        prevGroupMsgCount.current = p.groupMessages.length;
        prevFirstGroupMsgId.current = p.groupMessages.length > 0 ? p.groupMessages[0].id || p.groupMessages[0].tempId : null;
      }
      return;
    }

    const firstMsgId = p.groupMessages.length > 0 ? p.groupMessages[0].id || p.groupMessages[0].tempId : null;
    const isPrepend = firstMsgId !== prevFirstGroupMsgId.current && prevFirstGroupMsgId.current !== null && p.groupMessages.length > prevGroupMsgCount.current;

    if (isFirstRenderGroup.current && p.groupMessages.length > 0) {
      isFirstRenderGroup.current = false;
      container.scrollTop = container.scrollHeight;
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
    } else if (isPrepend && groupScrollAnchorRef.current) {
      const { prevScrollHeight, prevScrollTop } = groupScrollAnchorRef.current;
      container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
      groupScrollAnchorRef.current = null;
    } else if (!isPrepend) {
      const isNewMsg = p.groupMessages.length > prevGroupMsgCount.current && prevGroupMsgCount.current > 0;
      const isInitialLoad = prevGroupMsgCount.current === 0 && p.groupMessages.length > 0;
      if (isNewMsg) {
        const lastMsg = p.groupMessages[p.groupMessages.length - 1];
        const isMe = lastMsg && (lastMsg.isMe || lastMsg.username?.toLowerCase() === myUser || lastMsg.senderName?.toLowerCase() === myUser);
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 350;
        if (isMe || isNearBottom) {
          container.scrollTop = container.scrollHeight;
          setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
          setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
        }
      } else if (justSwitchedIntoView || isInitialLoad) {
        container.scrollTop = container.scrollHeight;
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
      }
    }

    prevGroupMsgCount.current = p.groupMessages.length;
    prevFirstGroupMsgId.current = firstMsgId;
  }, [p.groupMessages, p.chatTab]);

  const dmMessages = p.dmTarget ? p.dmThreads[p.dmTarget.toLowerCase()] || [] : [];
  const prevDmMsgCount = React.useRef(dmMessages.length);
  const prevFirstDmMsgId = React.useRef(null);
  const prevDmTarget = React.useRef(p.dmTarget);
  const dmScrollAnchorRef = React.useRef(null);
  const prevDmChatTabRef = React.useRef(p.chatTab);
  const isFirstRenderDm = React.useRef(true);

  React.useLayoutEffect(() => {
    const container = dmScrollContainerRef.current;
    const targetChanged = p.dmTarget !== prevDmTarget.current;
    const justSwitchedIntoView = targetChanged || (prevDmChatTabRef.current !== 'dm' && p.chatTab === 'dm');
    prevDmChatTabRef.current = p.chatTab;

    if (!container || p.chatTab !== 'dm') {
      if (p.chatTab === 'dm') {
        prevDmMsgCount.current = dmMessages.length;
        prevFirstDmMsgId.current = dmMessages.length > 0 ? dmMessages[0].id || dmMessages[0].tempId : null;
        prevDmTarget.current = p.dmTarget;
      }
      return;
    }

    const firstMsgId = dmMessages.length > 0 ? dmMessages[0].id || dmMessages[0].tempId : null;
    const isPrepend = !targetChanged && firstMsgId !== prevFirstDmMsgId.current && prevFirstDmMsgId.current !== null && dmMessages.length > prevDmMsgCount.current;

    if (isFirstRenderDm.current && dmMessages.length > 0) {
      isFirstRenderDm.current = false;
      container.scrollTop = container.scrollHeight;
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
    } else if (isPrepend && dmScrollAnchorRef.current) {
      const { prevScrollHeight, prevScrollTop } = dmScrollAnchorRef.current;
      container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
      dmScrollAnchorRef.current = null;
    } else if (!isPrepend) {
      const isNewMsg = !targetChanged && dmMessages.length > prevDmMsgCount.current && prevDmMsgCount.current > 0;
      const isInitialLoad = prevDmMsgCount.current === 0 && dmMessages.length > 0;
      if (isNewMsg) {
        const lastMsg = dmMessages[dmMessages.length - 1];
        const isMe = lastMsg && (lastMsg.isMe || lastMsg.username?.toLowerCase() === myUser || lastMsg.senderName?.toLowerCase() === myUser);
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 350;
        if (isMe || isNearBottom) {
          container.scrollTop = container.scrollHeight;
          setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
          setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
        }
      } else if (justSwitchedIntoView || isInitialLoad) {
        container.scrollTop = container.scrollHeight;
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
      }
    }

    prevDmMsgCount.current = dmMessages.length;
    prevFirstDmMsgId.current = firstMsgId;
    prevDmTarget.current = p.dmTarget;
  }, [dmMessages, p.chatTab, p.dmTarget]);

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = React.useState(false);
  const [lightbox, setLightbox] = React.useState(null); // { url, type }
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [audioBlob, setAudioBlob] = React.useState(null);
  const [audioUrl, setAudioUrl] = React.useState(null);
  const [recordingFor, setRecordingFor] = React.useState(null); // 'group' | 'dm'
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const timerRef = React.useRef(null);
  const analyserRef = React.useRef(null);
  const waveAnimRef = React.useRef(null);
  const [waveHeights, setWaveHeights] = React.useState(() => Array(20).fill(3));
  const [activeMessageMenu, setActiveMessageMenu] = React.useState(null);
  const messageMenuRef = React.useRef(null);

  const [hoveredMsgId, setHoveredMsgId] = React.useState(null);
  // Shared across the whole panel (both group + DM tabs) — only one message
  // can be mid-swipe or long-pressed at a time, so a single instance is enough.
  const swipe = useSwipeToReply();
  // Faster than the 500ms default — the reaction/unsend menu felt sluggish
  // to open on both sent and received messages; 300ms is still comfortably
  // past a normal tap/scroll-start so it doesn't false-trigger.
  const longPress = useLongPress(300);
  // 'up' = menu opens above the touched row (row is near the bottom of the
  // screen, close to the composer); 'down' = opens below (row is near the
  // top, close to the header). Computed from raw touch Y at press-start so
  // it tracks the row's actual on-screen position, not its array index.
  const [longPressPlacement, setLongPressPlacement] = React.useState('up');
  // Same idea as longPressPlacement but for the desktop click-to-open
  // dropdown (the chevron button), derived from the click's mouse Y.
  const [dropdownPlacement, setDropdownPlacement] = React.useState('down');
  const [clearGroupChatModalOpen, setClearGroupChatModalOpen] = React.useState(false);

  // ── Multi-select messages (bulk delete / forward) ── shared across group + DM
  // tabs (only one is visible at a time). Desktop entry: "Select messages" in
  // either 3-dot menu. Touch entry: a separate useLongPress instance attached to
  // each row's own empty side area (not the bubble, which keeps its existing
  // long-press-for-reactions/menu behavior via `longPress` above).
  const [msgSelectMode, setMsgSelectMode] = React.useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = React.useState(new Set());
  const rowSelectLongPress = useLongPress();
  // Instagram-DM-style "swipe left to peek timestamps" — shares the same row
  // background touch handlers as rowSelectLongPress above (both listen to the
  // same events independently; dragging left auto-cancels the long-press).
  const timestampPeek = useTimestampPeek();
  React.useEffect(() => {
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
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState(false);
  const [forwardPickerOpen, setForwardPickerOpen] = React.useState(false);
  const [forwardChats, setForwardChats] = React.useState([]);
  const [forwardChatsLoading, setForwardChatsLoading] = React.useState(false);
  const [selectedForwardChats, setSelectedForwardChats] = React.useState([]);
  const [forwarding, setForwarding] = React.useState(false);
  const MAX_FORWARD_CHATS = 5;
  const fetchForwardChats = () => {
    const token = localStorage.getItem('watch_token');
    if (!token) return;
    setForwardChatsLoading(true);
    fetch(`${p.SOCKET_SERVER_URL}/api/chats/recent?lastSeen=${encodeURIComponent('{}')}&localRooms=${encodeURIComponent('[]')}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setForwardChats(Array.isArray(d) ? d : []))
      .catch(() => setForwardChats([]))
      .finally(() => setForwardChatsLoading(false));
  };
  // Resolves the same rowKey used for checkbox selection back to the actual
  // message object, searching whichever tab (group/DM) is currently active. A
  // media-group grid tile only ever exposes ONE checkbox (on its head message —
  // the rest of the run renders nothing, see groupMediaRuns), so selecting it
  // must expand back out to every message in that batch or only the first photo
  // would be acted on (forwarded/deleted).
  const getSelectedMessages = (activeList) => {
    const runs = groupMediaRuns(activeList);
    const result = [];
    const seen = new Set();
    activeList.forEach((m, i) => {
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
  const activeSelectionList = () => (p.chatTab === 'dm' ? dmMessages : (p.groupMessages || []));
  const handleBulkDelete = (mode) => {
    const ids = getSelectedMessages(activeSelectionList()).map(m => m.id || m.timestamp);
    setBulkDeleteConfirm(false);
    ids.forEach(id => p.handleDeleteMessage(id, mode));
    exitMsgSelectMode();
  };
  const handleForwardSend = async () => {
    if (selectedForwardChats.length === 0) return;
    setForwarding(true);
    const msgs = getSelectedMessages(activeSelectionList());
    const destinations = selectedForwardChats
      .map(key => forwardChats.find(c => (c.id || c.partner) === key))
      .filter(Boolean);
    const { failCount } = await p.forwardMessages(msgs, destinations);
    setForwarding(false);
    setForwardPickerOpen(false);
    exitMsgSelectMode();
    if (failCount > 0) toast.error(`${failCount} message(s) could not be forwarded.`);
    else toast.success('Forwarded');
  };
  const fileInputRef = React.useRef(null);
  const dmFileInputRef = React.useRef(null);
  const [showGroupCamera, setShowGroupCamera] = React.useState(false);
  const [showDmCamera, setShowDmCamera] = React.useState(false);
  const groupFormRef = React.useRef(null);
  const dmFormRef = React.useRef(null);
  // Composer layout (emoji far-left, camera next to mic) only differs below
  // the same 1023.98px breakpoint every other mobile/tablet-only chrome in
  // this codebase already uses — tracked via matchMedia so rotating a tablet
  // or resizing a desktop window updates it live instead of needing a reload.
  const [isMobileOrTablet, setIsMobileOrTablet] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023.98px)').matches : false
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023.98px)');
    const onChange = (e) => setIsMobileOrTablet(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [hiddenChats, setHiddenChats] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`hidden_chats_${myUser}`) || '[]'); } catch { return []; }
  });
  const [showHiddenChats, setShowHiddenChats] = React.useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = React.useState(false);
  const headerMenuRef = React.useRef(null);
  const [showHiddenMenu, setShowHiddenMenu] = React.useState(false);
  const hiddenMenuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      const t = e.target;
      const closest = (sel) => !!(t.closest && t.closest(sel));
      // If clicking outside the active message menu
      if (activeMessageMenu && messageMenuRef.current && !messageMenuRef.current.contains(t)) {
        setActiveMessageMenu(null);
      }
      // If clicking outside the header 3-dots menu
      if (showHeaderMenu && headerMenuRef.current && !headerMenuRef.current.contains(t)) {
        setShowHeaderMenu(false);
      }
      if (showHiddenMenu && hiddenMenuRef.current && !hiddenMenuRef.current.contains(t)) {
        setShowHiddenMenu(false);
      }
      // Long-press action menu (mobile/tablet: reactions/reply/edit/delete/report) —
      // only reachable via the scroll container's own onClick before this fix, which
      // meant tapping the header, compose bar, or anything outside the message list
      // left it stuck open.
      if (longPress.activeId && !closest('.long-press-menu')) {
        longPress.close();
      }
      // Quick-reaction row + full emoji picker attached to a specific message
      if ((p.activeReactionMsg || p.showAllEmojis) && !closest('.react-btn-container') && !closest('.emoji-picker-container')) {
        p.setActiveReactionMsg(null);
        p.setShowAllEmojis(false);
      }
      // Compose-bar emoji pickers (group/DM)
      if (p.showGroupEmojiPicker && !closest('.emoji-picker-container') && !closest('.emoji-btn-group')) {
        p.setShowGroupEmojiPicker(false);
      }
      if (p.showDmEmojiPicker && !closest('.emoji-picker-container') && !closest('.emoji-btn-dm')) {
        p.setShowDmEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeMessageMenu, showHeaderMenu, showHiddenMenu, longPress.activeId, longPress, p.activeReactionMsg, p.showAllEmojis, p.showGroupEmojiPicker, p.showDmEmojiPicker]);
  const dmTargetRef = React.useRef(p.dmTarget);
  const [dmRelation, setDmRelation] = React.useState(null);
  // 'loading' = fetching in progress (show nothing), null = not a private chat, object = resolved
  const [dmRelationLoading, setDmRelationLoading] = React.useState(false);

  React.useEffect(() => {
    dmTargetRef.current = p.dmTarget;
  }, [p.dmTarget]);

  const [blockedChats, setBlockedChats] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`blocked_chats_${myUser}`) || '[]'); } catch { return []; }
  });
  const [blockingMe, setBlockingMe] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`blocking_me_${myUser}`) || '[]'); } catch { return []; }
  });

  const autoLockTimersRef = React.useRef({});

  // ── Chat Lock state ──
  const [lockedChats, setLockedChats] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`locked_chats_${myUser}`) || '[]'); } catch { return []; }
  });
  const [chatLockEnabled, setChatLockEnabled] = React.useState(() => {
    // Try to read from localStorage if GlobalChatWidget already fetched it
    try {
      const stored = localStorage.getItem(`chat_lock_enabled_${myUser}`);
      return stored === 'true';
    } catch { return false; }
  });
  const [pendingUnlockChat, setPendingUnlockChat] = React.useState(null); // { key, name, type }
  const unlockedSessionsRef = React.useRef({});

  // Sync chatLockEnabled from server and listen for locked_chats_updated
  React.useEffect(() => {
    const token = localStorage.getItem('watch_token');
    if (token && p.SOCKET_SERVER_URL) {
      fetch(`${p.SOCKET_SERVER_URL}/api/chat-lock/status`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.enabled !== undefined) {
            setChatLockEnabled(!!data.enabled);
            localStorage.setItem(`chat_lock_enabled_${myUser}`, String(!!data.enabled));
          }
        })
        .catch(() => {});
    }
    const syncLocked = () => {
      try { setLockedChats(JSON.parse(localStorage.getItem(`locked_chats_${myUser}`) || '[]')); } catch {}
    };
    window.addEventListener('locked_chats_updated', syncLocked);

    // Sync muted chats
    const [mutedChatsState, setMutedChatsState_] = [null, null]; // declared below, just sync on event
    const syncMuted = () => {
      try { setMutedChats(JSON.parse(localStorage.getItem(`muted_chats_${myUser}`) || '[]')); } catch {}
    };
    window.addEventListener('muted_chats_updated', syncMuted);

    return () => {
      window.removeEventListener('locked_chats_updated', syncLocked);
      window.removeEventListener('muted_chats_updated', syncMuted);
    };
  }, [p.username, p.SOCKET_SERVER_URL]);

  
  React.useEffect(() => {
    const syncPinned = () => {
      try { setPinnedRoomChats(JSON.parse(localStorage.getItem(`pinned_room_chats_${myUser}`) || '[]')); } catch {}
    };
    window.addEventListener('pinned_room_chats_updated', syncPinned);
    return () => window.removeEventListener('pinned_room_chats_updated', syncPinned);
  }, [myUser]);

  // ── Muted chats ──
  const [mutedChats, setMutedChats] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`muted_chats_${myUser}`) || '[]'); } catch { return []; }
  });
  const [pinnedRoomChats, setPinnedRoomChats] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`pinned_room_chats_${myUser}`) || '[]'); } catch { return []; }
  });
  const [deleteChatConfirm, setDeleteChatConfirm] = React.useState(null); // { key, type, name }
  const [blockUserConfirm, setBlockUserConfirm] = React.useState(null); // { username }

  React.useEffect(() => {
    const handleStorage = (e) => {
      try { 
        if (!e || e.key === `blocked_chats_${p.username}` || !e.key)
          setBlockedChats(JSON.parse(localStorage.getItem(`blocked_chats_${p.username}`) || '[]'));
        if (!e || e.key === `blocking_me_${p.username}` || !e.key)
          setBlockingMe(JSON.parse(localStorage.getItem(`blocking_me_${p.username}`) || '[]'));
        if (!e || e.key === `hidden_chats_${myUser}` || !e.key)
          setHiddenChats(JSON.parse(localStorage.getItem(`hidden_chats_${myUser}`) || '[]'));
        if (!e || e.key === `muted_chats_${myUser}` || !e.key)
          setMutedChats(JSON.parse(localStorage.getItem(`muted_chats_${myUser}`) || '[]'));
        if (!e || e.key === `pinned_room_chats_${myUser}` || !e.key)
          setPinnedRoomChats(JSON.parse(localStorage.getItem(`pinned_room_chats_${myUser}`) || '[]'));
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('blocked_chats_updated', handleStorage);
    window.addEventListener('hidden_chats_updated', handleStorage);
    window.addEventListener('muted_chats_updated', handleStorage);
    window.addEventListener('pinned_room_chats_updated', handleStorage);

    if (p.socket) {
      p.socket.on('blocking_updated', ({ blocker, blocked, isBlocked }) => {
        const myU = (localStorage.getItem('watch_username') || '').toLowerCase();
        if (blocker.toLowerCase() === myU) {
          setBlockedChats(prev => {
            const next = isBlocked ? [...new Set([...prev, blocked])] : prev.filter(u => u.toLowerCase() !== blocked.toLowerCase());
            localStorage.setItem(`blocked_chats_${p.username}`, JSON.stringify(next));
            return next;
          });
        } else if (blocked.toLowerCase() === myU) {
          setBlockingMe(prev => {
            const next = isBlocked ? [...new Set([...prev, blocker])] : prev.filter(u => u.toLowerCase() !== blocker.toLowerCase());
            localStorage.setItem(`blocking_me_${p.username}`, JSON.stringify(next));
            return next;
          });
        }
        // Refetch relationship if the active DM target is involved
        const currentTarget = dmTargetRef.current;
        if (currentTarget && (blocker.toLowerCase() === currentTarget.toLowerCase() || blocked.toLowerCase() === currentTarget.toLowerCase())) {
          // Pre-set to "no friendship" immediately if unblocking — prevents input from briefly showing
          if (!isBlocked) {
            setDmRelation({ followStatus: null, isFollowingMe: false });
          }
          const tok = localStorage.getItem('watch_token');
          if (tok) {
            setDmRelationLoading(true);
            fetch(`${p.SOCKET_SERVER_URL}/api/users/${currentTarget}`, { 
              headers: { 'Authorization': `Bearer ${tok}` } 
            })
              .then(res => res.json())
              .then(data => {
                // Server returns flat: { followStatus, isFollowingMe, ... }
                if (data && !data.error) {
                  setDmRelation({ followStatus: data.followStatus || null, isFollowingMe: !!data.isFollowingMe });
                } else {
                  setDmRelation({ followStatus: null, isFollowingMe: false });
                }
              })
              .catch(() => setDmRelation({ followStatus: null, isFollowingMe: false }))
              .finally(() => setDmRelationLoading(false));
          }
        }

      });
    }

    const handleFollowStatus = (e) => {
      const data = e.detail || {};
      const currentTarget = dmTargetRef.current;
      if (!currentTarget) return;
      
      const actor = data.requester || data.follower;
      const target = data.accepter || data.following;
      
      if ((actor && actor.toLowerCase() === currentTarget.toLowerCase()) || 
          (target && target.toLowerCase() === currentTarget.toLowerCase())) {
        const tok = localStorage.getItem('watch_token');
        if (tok) {
          setDmRelationLoading(true);
          fetch(`${p.SOCKET_SERVER_URL}/api/users/${currentTarget}`, { 
            headers: { 'Authorization': `Bearer ${tok}` } 
          })
            .then(res => res.json())
            .then(d => {
              if (d && !d.error) {
                setDmRelation({ followStatus: d.followStatus || null, isFollowingMe: !!d.isFollowingMe });
              }
            })
            .catch(() => setDmRelation({ followStatus: null, isFollowingMe: false }))
            .finally(() => setDmRelationLoading(false));
        }
      }
    };
    
    window.addEventListener('follow_status_updated', handleFollowStatus);

    const handleMutedUpdated = () => {
      try { setMutedChats(JSON.parse(localStorage.getItem(`muted_chats_${p.username}`) || '[]')); } catch {}
    };
    window.addEventListener('muted_chats_updated', handleMutedUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('blocked_chats_updated', handleStorage);
      window.removeEventListener('follow_status_updated', handleFollowStatus);
      window.removeEventListener('muted_chats_updated', handleMutedUpdated);
      if (p.socket) p.socket.off('blocking_updated');
    };
  }, [p.username, p.SOCKET_SERVER_URL, p.socket]);

  const handleBackToList = () => {
    const autoOnClose = localStorage.getItem('chat_lock_auto_on_close') === 'true';
    const autoMins = parseInt(localStorage.getItem('chat_lock_auto_minutes') || '5');
    
    let chatKey = '';
    if (p.chatTab === 'group') chatKey = (p.roomId || '').toLowerCase();
    else if (p.chatTab === 'dm') chatKey = (p.dmTarget || '').toLowerCase();

    if (chatKey && chatLockEnabled && lockedChats.includes(chatKey)) {
      if (autoOnClose || autoMins === 0) {
        delete unlockedSessionsRef.current[chatKey];
        window.dispatchEvent(new Event('locked_chats_updated'));
      } else if (autoMins > 0) {
        clearTimeout(autoLockTimersRef.current[chatKey]);
        autoLockTimersRef.current[chatKey] = setTimeout(() => {
          delete unlockedSessionsRef.current[chatKey];
          window.dispatchEvent(new Event('locked_chats_updated'));
        }, autoMins * 60 * 1000);
      }
    }

    p.setChatTab('list');
    p.chatTabRef.current = 'list';
    p.setDmTarget(null);
    if(p.dmTargetRef) p.dmTargetRef.current = null;
    // Leaving the chat entirely should reset multi-select — reopening a chat
    // should never resurface a stale selection from before it was closed.
    exitMsgSelectMode();
  };

  // Any transient overlay (forward picker, bulk-delete confirm, clear-chat
  // confirm) open on top of the chat gets its own back-intercept level, so a
  // swipe-back/hardware-back closes just that overlay instead of falling
  // through and closing the whole chat. Message multi-select itself is NOT
  // part of this stack — it should stay selected while the overlay above it
  // closes, and only clears via its own Cancel/X or when the chat is left.
  const anyChatOverlayOpen = !!(forwardPickerOpen || bulkDeleteConfirm || clearGroupChatModalOpen);

  // Mobile/iPad swipe-back (and hardware back) should return to the chat
  // list instead of leaving the room. Without this, swiping back while a
  // group/DM chat is open falls through to the browser's real back
  // navigation and exits to the home page.
  useBackIntercept(p.chatTab === 'list' ? 0 : (anyChatOverlayOpen ? 2 : 1), (newLevel) => {
    if (newLevel === 0) handleBackToList();
    else if (newLevel === 1) {
      setForwardPickerOpen(false);
      setBulkDeleteConfirm(false);
      setClearGroupChatModalOpen(false);
    }
  });

  useAutoResizeTextarea(p.groupInputRef, p.groupChatInput);
  useAutoResizeTextarea(p.dmInputRef, p.dmChatInput);

  // Fetch block/relation status when DM target changes to ensure sync
  React.useEffect(() => {
    if (p.dmTarget && p.username) {
      const tok = localStorage.getItem('watch_token');
      if (!tok) return;
      setDmRelationLoading(true);
      setDmRelation(null);
      // Use absolute URL to avoid nested route fetch issues (Room is at /room/:id)
      fetch(`${p.SOCKET_SERVER_URL}/api/users/${p.dmTarget}`, { 
        headers: { 'Authorization': `Bearer ${tok}` } 
      })
        .then(res => res.json())
        .then(data => {
          if (!data || data.error) {
            // If user not found (e.g. blocked by them), restrict but allow room logic to handle
            setDmRelation({ followStatus: null, isFollowingMe: false });
            return;
          }
          // Server returns flat: { followStatus, isFollowingMe, ... }
          setDmRelation({ 
            followStatus: data.followStatus || null, 
            isFollowingMe: !!data.isFollowingMe 
          });
          // Also sync block states
          if (data.isBlockedByMe) {
            setBlockedChats(prev => prev.includes(p.dmTarget) ? prev : [...prev, p.dmTarget]);
          } else {
            setBlockedChats(prev => prev.filter(u => u.toLowerCase() !== p.dmTarget.toLowerCase()));
          }
        })
        .catch(err => {
          console.error('[RoomChatPanel] Failed to fetch relation:', err);
          // On network error, default to restricted state to prevent unauthorized message attempts
          setDmRelation({ followStatus: null, isFollowingMe: false }); 
        })
        .finally(() => setDmRelationLoading(false));
    } else {
      setDmRelation(null);
    }
  }, [p.dmTarget, p.username, p.SOCKET_SERVER_URL]);

  const MAX_MEDIA_PER_SEND = 5;

  // A page-level react-hot-toast can end up hidden behind the room chat panel's own
  // stacked overlays on mobile/tablet — this banner renders inside the panel's own
  // tree instead, so file-selection errors are always visible.
  const [inlineNotice, setInlineNotice] = React.useState(null);
  const inlineNoticeTimerRef = React.useRef(null);
  const showInlineNotice = React.useCallback((text) => {
    setInlineNotice(text);
    clearTimeout(inlineNoticeTimerRef.current);
    inlineNoticeTimerRef.current = setTimeout(() => setInlineNotice(null), 3000);
  }, []);

  const handleFileSelect = async (e, type) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (files.length > MAX_MEDIA_PER_SEND) {
      showInlineNotice(`You can only send up to ${MAX_MEDIA_PER_SEND} files at a time`);
      e.target.value = null;
      return;
    }

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        showInlineNotice(validation.error);
        e.target.value = null;
        return;
      }
    }

    // Permission check for media in rooms
    if (type === 'group' && p.allowMedia === false) {
      showInlineNotice('Sharing media is disabled in this room');
      e.target.value = null;
      return;
    }

    setIsUploading(true);
    const mediaGroupId = files.length > 1 ? `mg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : null;

    try {
      for (const file of files) {
        const objectUrl = URL.createObjectURL(file);
        if (type === 'group') {
          await p.sendMediaGroupChat(objectUrl, getMediaType(file), p.groupReplyTo, file, null, mediaGroupId);
        } else {
          await p.sendMediaDmChat(objectUrl, getMediaType(file), p.dmReplyTo, file, null, mediaGroupId);
        }
      }
      if (type === 'group') p.setGroupReplyTo(null); else p.setDmReplyTo(null);
      toast.success(files.length > 1 ? `${files.length} files sent!` : 'Sent!');
    } catch (err) {
      console.error('File send error:', err);
      toast.error('Error sending file');
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const formatRecordingTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const startRecording = async (chatType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
        if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null; }
        if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
        setWaveHeights(Array(20).fill(3));
      };
      mr.start();
      mediaRecorderRef.current = mr;
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
      setRecordingFor(chatType);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => {
        if (prev >= 299) { stopRecording(); return 300; }
        return prev + 1;
      }), 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (waveAnimRef.current) { cancelAnimationFrame(waveAnimRef.current); waveAnimRef.current = null; }
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingFor(null);
    setWaveHeights(Array(20).fill(3));
    audioChunksRef.current = [];
  };

  const sendVoiceNote = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const blob = new Blob([audioBlob], { type: audioBlob.type || 'audio/webm' });
      const url = audioUrl;
      if (recordingFor === 'group') {
        p.sendMediaGroupChat(url, blob.type, p.groupReplyTo, blob, recordingTime);
        p.setGroupReplyTo(null);
      } else {
        p.sendMediaDmChat(url, blob.type, p.dmReplyTo, blob, recordingTime);
        p.setDmReplyTo(null);
      }
      toast.success('Voice note sent!');
      cancelRecording();
    } catch {
      toast.error('Failed to send voice note');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleMuteChat = (chatKey) => {
    const key = (chatKey || '').toLowerCase();
    const next = mutedChats.includes(key) ? mutedChats.filter(k => k !== key) : [...mutedChats, key];
    setMutedChats(next);
    localStorage.setItem(`muted_chats_${myUser}`, JSON.stringify(next));
    window.dispatchEvent(new Event('muted_chats_updated'));
    toast.success(mutedChats.includes(key) ? 'Notifications unmuted' : 'Notifications muted');
  };

  const togglePinRoomChat = (chatKey) => {
    const key = (chatKey || '').toLowerCase();
    const next = pinnedRoomChats.includes(key) ? pinnedRoomChats.filter(k => k !== key) : [...pinnedRoomChats, key];
    setPinnedRoomChats(next);
    localStorage.setItem(`pinned_room_chats_${myUser}`, JSON.stringify(next));
    window.dispatchEvent(new Event('pinned_room_chats_updated'));
    toast.success(pinnedRoomChats.includes(key) ? 'Chat unpinned' : 'Chat pinned');
  };

  const toggleHideChat = (chatKey) => {
    setHiddenChats(prev => {
      const isHidden = prev.includes(chatKey);
      const next = isHidden ? prev.filter(k => k !== chatKey) : [...prev, chatKey];
      localStorage.setItem(`hidden_chats_${myUser}`, JSON.stringify(next));
      window.dispatchEvent(new Event('hidden_chats_updated'));
      toast.success(isHidden ? 'Chat unhidden' : 'Chat hidden');
      return next;
    });
    p.setShowDmMenu(null);
  };

  const markAllAsRead = () => {
    if (typeof p.onMarkAllRead === 'function') {
      p.onMarkAllRead();
      toast.success('All marked as read');
    } else {
      // Collect all unread chat keys (DMs and Room Group)
      const dmKeys = Object.keys(p.dmUnread).filter(k => p.dmUnread[k] > 0);
      const keysToMark = [...dmKeys];
      if (p.groupUnread > 0) keysToMark.push(p.roomId);
      
      if (keysToMark.length === 0) {
        toast.success('All messages are read');
        setShowHeaderMenu(false);
        return;
      }

      keysToMark.forEach(key => {
        if (typeof p.onMarkRead === 'function') {
          p.onMarkRead(key);
        }
        if (p.socket) {
          p.socket.emit('chat:mark_read', { chatId: key, isDm: key !== p.roomId, userRead: true });
        }
      });

      toast.success('All marked as read');
    }
    setShowHeaderMenu(false);
  };

  const unhideAllChats = () => {
    localStorage.setItem(`hidden_chats_${myUser}`, JSON.stringify([]));
    setHiddenChats([]);
    window.dispatchEvent(new Event('hidden_chats_updated'));
    // Force a re-sync for other listeners
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('conversations_updated'));
    toast.success('All chats unhidden');
    setShowHiddenMenu(false);
    setShowHiddenChats(false);
  };

  const toggleBlockUser = async (target) => {
    const partnerLow = (target || '').toLowerCase();
    const isCurrentlyBlocked = blockedChats.some(k => k.toLowerCase() === partnerLow);
    const token = localStorage.getItem('watch_token');

    // Optimistic UI update
    const next = isCurrentlyBlocked ? blockedChats.filter(k => k.toLowerCase() !== partnerLow) : [...blockedChats, partnerLow];
    setBlockedChats(next);
    localStorage.setItem(`blocked_chats_${myUser}`, JSON.stringify(next));
    window.dispatchEvent(new Event('blocked_chats_updated'));

    toast.success(isCurrentlyBlocked ? 'User unblocked' : 'User blocked');

    if (token) {
      try {
        await fetch(`${p.SOCKET_SERVER_URL}/api/block/${partnerLow}`, {
          method: isCurrentlyBlocked ? 'DELETE' : 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Block error:', err);
      }
    }
  };

  const handleDeleteChat = (chatKey, type) => {
    const key = (chatKey || '').toLowerCase();
    
    // 1. Remove from watch_recent_chats
    try {
      const recent = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
      const nextRecent = recent.filter(c => (c.id || c.partner || '').toLowerCase() !== key);
      localStorage.setItem('watch_recent_chats', JSON.stringify(nextRecent));

      // Clean up chat_cleared_partners map too
      const cleared = JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
      delete cleared[key];
      localStorage.setItem('chat_cleared_partners', JSON.stringify(cleared));
    } catch {}

    // 2. Emit socket event
    if (p.socket) {
      if (type === 'room') {
        p.socket.emit('clear_room_chat', { roomId: chatKey });
      } else {
        p.socket.emit('clear_dm', { targetUsername: chatKey, clearForBoth: false });
      }
    }

    // 3. Remove from local pinned/muted/locked
    setPinnedRoomChats(prev => prev.filter(k => k !== key));
    localStorage.setItem(`pinned_room_chats_${myUser}`, JSON.stringify(pinnedRoomChats.filter(k => k !== key)));
    
    // 4. If active, go back
    if (p.chatTab !== 'list') {
      handleBackToList();
    }

    // 5. Notify Room.jsx if it can remove from dmThreads
    if (type === 'dm' && p.setDmThreads) {
      p.setDmThreads(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    window.dispatchEvent(new Event('conversations_updated'));
    window.dispatchEvent(new Event('chat_cleared_updated'));
    toast.success('Chat deleted');
  };

  const buildMediaItems = (messages, decryptedUrlsRef) => {
    const mUserLower = p.username?.toLowerCase();
    return (messages || []).map(m => {
      const mt = m.mediaType || '';
      if (!mt.startsWith('image/') && !mt.startsWith('video/')) return null;
      const decrypted = decryptedUrlsRef?.current && (
        decryptedUrlsRef.current[m.id] ||
        decryptedUrlsRef.current[m.tempId] ||
        decryptedUrlsRef.current[String(m.timestamp)]
      );
      const url = decrypted || m._localMediaUrl || ((m.mediaUrl && m.mediaUrl.startsWith('blob:')) ? m.mediaUrl : (m.nonce ? null : m.mediaUrl));
      const isMe = m.isMe || (m.username && m.username.toLowerCase() === mUserLower) || (m.senderName && m.senderName.toLowerCase() === mUserLower);
      return url ? { url, type: mt, id: m.id || m.tempId, isMe, expiresAt: m.mediaExpiresAt, filename: m._fileName || m.mediaFileName || null } : null;
    }).filter(Boolean);
  };

  const openLightboxAt = (url, type, messages, decryptedUrlsRef) => {
    const items = buildMediaItems(messages, decryptedUrlsRef);
    const idx = items.findIndex(i => i.url === url);
    if (!items.length) {
      setLightbox({ items: [{ url, type }], index: 0 });
    } else {
      setLightbox({ items, index: idx >= 0 ? idx : 0 });
    }
  };

  const handleLightboxDelete = (item, mode) => {
    if (!item?.id) return;
    p.handleDeleteMessage(item.id, mode);
    setLightbox(null);
  };

  const renderMedia = (url, type, isMe, fileName, fileSize, expiresAt, allMessages, decryptedUrlsRef, loading, msg) => {
    if (!url && !type) return null;
    const isImg = type?.startsWith('image/');
    const isVid = type?.startsWith('video/');
    const isAudio = type?.startsWith('audio/');
    const tick = (isMe && msg) ? <MessageTick msg={msg} username={p.username} isLight={isLight} /> : null;
    const cardTick = (isMe && msg) ? <MessageTick msg={msg} username={p.username} isLight={isLight} onLightSurface /> : null;
    // Voice note bubbles use a light tinted background in light mode (unlike the dark
    // text/media bubbles the default white tick assumes), so treat it as a light
    // surface in light mode only — dark mode keeps the original white tick unchanged.
    const voiceTick = (isMe && msg) ? <MessageTick msg={msg} username={p.username} isLight={isLight} onLightSurface={isLight} /> : null;

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
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              onClick={() => openLightboxAt(url, type, allMessages, decryptedUrlsRef)}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML = '<div style="color:#666;font-size:11px;padding:16px;text-align:center">Failed to load image</div>';
              }}
            />
            {msg?.forwarded && <div style={{ position: 'absolute', top: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Forward size={8} color="#fff" style={{ flexShrink: 0 }} />Forwarded</div>}
            {expiresAt && (() => { const dL = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24)); if (dL <= 0) return null; return <div style={{ position: 'absolute', bottom: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Clock size={8} color="rgba(255,255,255,0.9)" style={{ flexShrink: 0 }} />Expires in {dL} day{dL !== 1 ? 's' : ''}</div>; })()}
            {tick && <div style={{ position: 'absolute', bottom: 5, right: 6, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>{tick}</div>}
          </>
        ) : (
          <div onClick={() => openLightboxAt(url, type, allMessages, decryptedUrlsRef)} style={{ position: 'relative', width: '100%', height: 140, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* No static frame preview by design — see the matching comment
                in the grid-preview renderer above. */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(var(--brand-1-rgb),0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(var(--brand-1-rgb),0.5)' }}>
                <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
              </div>
            </div>
            {msg?.forwarded && <div style={{ position: 'absolute', top: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#fff', WebkitTextFillColor: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Forward size={8} color="#fff" style={{ flexShrink: 0 }} />Forwarded</div>}
            {expiresAt && (() => { const dL = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000*60*60*24)); if (dL <= 0) return null; return <div style={{ position: 'absolute', bottom: 5, left: 6, display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}><Clock size={8} color="rgba(255,255,255,0.9)" style={{ flexShrink: 0 }} />Expires in {dL} day{dL !== 1 ? 's' : ''}</div>; })()}
            {tick && <div style={{ position: 'absolute', bottom: 5, right: 6, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 5px', backdropFilter: 'blur(4px)' }}>{tick}</div>}
          </div>
        )}
      </div>
    );
  };

  const [isLight, setIsLight] = React.useState(document.documentElement.getAttribute('data-theme') === 'light');
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <MenuStyles />
      {inlineNotice && createPortal(
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000000, background: 'rgba(20,20,20,0.94)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.45)', maxWidth: '85%', textAlign: 'center', pointerEvents: 'none' }}>
          {inlineNotice}
        </div>,
        document.body
      )}
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
      {pendingUnlockChat && (
        <ChatLockScreen
          chatKey={pendingUnlockChat.key}
          chatName={pendingUnlockChat.name}
          action="unlock"
          onClose={() => setPendingUnlockChat(null)}
          onUnlock={() => {
            unlockedSessionsRef.current[pendingUnlockChat.key] = Date.now();
            const chat = pendingUnlockChat;
            setPendingUnlockChat(null);
            // Open the chat after unlock
            if (chat.type === 'group') {
              p.setChatTab('group'); p.chatTabRef.current = 'group'; p.setGroupUnread(0);
              if (p.onMarkRead) p.onMarkRead(p.roomId);
            } else {
              p.openDM(chat.name);
            }
          }}
        />
      )}
      <div id="room-chat-panel" style={{flex:1,display:'flex',flexDirection:'column',background:'var(--room-sidebar-bg)',borderRadius:16,border:'1px solid var(--room-border)',overflow:'hidden',flexShrink:0,position:'relative', boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.05)' : 'none'}}>
      {/* Message multi-select bar — overlays whichever tab's header is showing (group or DM) */}
      {msgSelectMode && (p.chatTab === 'group' || p.chatTab === 'dm') && (
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:200,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 14px',
          background: 'var(--room-sidebar-bg)',
          borderBottom:'1px solid var(--room-border)'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={exitMsgSelectMode} style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#aaa',cursor:'pointer',display:'flex'}}>
              <X size={20}/>
            </button>
            <span style={{fontWeight:700,fontSize:14,color: isLight ? '#1e293b' : '#ddd'}}>{selectedMsgIds.size} {t('selected', 'selected')}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <button
              onClick={() => { setSelectedForwardChats([]); setForwardPickerOpen(true); fetchForwardChats(); }}
              disabled={selectedMsgIds.size === 0}
              style={{background:'transparent',border:'none',color: selectedMsgIds.size === 0 ? (isLight ? '#cbd5e1' : '#444') : (isLight ? '#1e293b' : '#ddd'),cursor: selectedMsgIds.size === 0 ? 'default' : 'pointer',display:'flex'}}
              title="Forward"
            >
              <Forward size={20}/>
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={selectedMsgIds.size === 0}
              style={{background:'transparent',border:'none',color: selectedMsgIds.size === 0 ? (isLight ? '#cbd5e1' : '#444') : '#ef4444',cursor: selectedMsgIds.size === 0 ? 'default' : 'pointer',display:'flex'}}
              title="Delete"
            >
              <Trash2 size={20}/>
            </button>
          </div>
        </div>
      )}
      {p.chatTab === 'list' ? (
        /* ===== CHAT LIST VIEW ===== */
        <>
          <div style={{
            padding:'12px 14px',
            background: 'var(--room-sidebar-bg)',
            borderBottom:'1px solid var(--room-border)',
            fontWeight:700,fontSize:14,color: isLight ? '#1e293b' : '#ddd',
            letterSpacing:'0.2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            zIndex: 10,
            position: 'relative'
          }}>
            <span>{showHiddenChats ? t('hiddenChatsTitle', 'Hidden Chats') : t('chats', 'Chats')}</span>
            <div ref={headerMenuRef} style={{position:'relative', display:'flex', alignItems:'center'}}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); setActiveMessageMenu(null); }} 
                style={{background:'none', border:'none', color: isLight ? '#475569' : '#aaa', cursor:'pointer', padding:4, display:'flex'}}
              >
                <MoreVertical size={18} />
              </button>
              {showHeaderMenu && (
                <div className="menu-dropdown" style={{position:'absolute', right:0, top:'100%', marginTop:8, background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:6, zIndex:1000, minWidth:180, boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.6)'}} onMouseLeave={() => setShowHeaderMenu(false)}>
                  <button 
                    onClick={() => { setShowHiddenChats(!showHiddenChats); setShowHeaderMenu(false); }}
                    style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'transparent', border:'none', color: isLight ? '#1e293b' : '#fff', fontSize:13, cursor:'pointer', textAlign:'left', borderRadius:8}} 
                    className="menu-btn"
                  >
                    {showHiddenChats ? <MessageSquare size={16} /> : <Lock size={16} />}
                    {showHiddenChats ? t('showAllChats', 'Show All Chats') : t('hiddenChatsTitle', 'Hidden Chats')}
                  </button>
                  <button 
                    onClick={markAllAsRead}
                    style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'transparent', border:'none', color: isLight ? '#1e293b' : '#fff', fontSize:13, cursor:'pointer', textAlign:'left', borderRadius:8}} 
                    className="menu-btn"
                  >
                    <CheckCheck size={16} /> {t('markAllAsRead', 'Mark all as read')}
                  </button>
                </div>
              )}
            </div>
          </div>
          {showHiddenChats && (
            <div style={{ padding: '10px 14px', background: isLight ? 'rgba(var(--brand-1-rgb),0.05)' : 'rgba(var(--brand-1-rgb),0.08)', borderBottom: '1px solid var(--room-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button 
                  onClick={() => setShowHiddenChats(false)}
                  style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#888', cursor: 'pointer', padding: '2px 4px', display: 'flex' }}
                >
                  <ChevronLeft size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)', fontSize: 12, fontWeight: 700 }}>
                  <Lock size={14} /> {t('hiddenFolder', 'Hidden Folder')}
                </div>
              </div>
              <div ref={hiddenMenuRef} style={{position:'relative', display:'flex', alignItems:'center'}}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowHiddenMenu(!showHiddenMenu); }}
                  style={{ background: 'none', border: 'none', color: isLight ? 'var(--brand-1-dark)' : '#888', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <MoreVertical size={18} />
                </button>
                {showHiddenMenu && (
                  <div className="menu-dropdown" style={{position:'absolute', right:0, top:'100%', marginTop:8, background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:6, zIndex:1000, minWidth:180, boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.6)'}} onMouseLeave={() => setShowHiddenMenu(false)}>
                    <button 
                      onClick={unhideAllChats}
                      style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'transparent', border:'none', color: isLight ? '#1e293b' : '#fff', fontSize:13, cursor:'pointer', textAlign:'left', borderRadius:8}} 
                      className="menu-btn"
                    >
                      <Eye size={16} /> {t('unhideAllChats', 'Unhide all chats')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="no-scrollbar" style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            {!showHiddenChats && (
            <button onClick={()=>{
              const groupKey = (p.roomId || '').toLowerCase();
              const isGroupLocked = chatLockEnabled && lockedChats.includes(groupKey) && !unlockedSessionsRef.current[groupKey];
              if (isGroupLocked) {
                setPendingUnlockChat({ key: groupKey, name: p.roomName || 'Group Chat', type: 'group' });
                return;
              }
              clearTimeout(autoLockTimersRef.current[groupKey]);
              p.setChatTab('group');
              p.chatTabRef.current='group';
              p.setGroupUnread(0);
              if (p.setReactionPreviews) p.setReactionPreviews(prev => { const next = { ...prev }; delete next[(p.roomId||'').toLowerCase()]; return next; });
              // Also clear the global navbar badge for this room
              if (p.onMarkRead) p.onMarkRead(p.roomId);
            }} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid var(--room-border)',cursor:'pointer',color: isLight ? '#1e293b' : '#fff',width:'100%',textAlign:'left',position:'relative'}}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: p.room?.thumbnailPath ? 'none' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {p.room?.thumbnailPath ? (
                  <img src={getRoomThumbnailUrl(p.room.thumbnailPath)} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Users size={18} color="#fff" />
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color: isLight ? '#1e293b' : '#fff'}}>{p.roomName}</div>
                <div style={{fontSize:11,color: isLight ? '#475569' : '#a1a1aa',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {(() => {
                    const rId = (p.roomId || '').toLowerCase();
                    const typers = p.typingStatuses?.[rId];
                    if (typers && typers.length > 0) {
                      return <span style={{ color: '#10b981' }}>{typers.join(', ')} typing...</span>;
                    }
                    const rxnPreview = p.reactionPreviews?.[(p.roomId||'').toLowerCase()];
                    if (rxnPreview) return rxnPreview;
                    const lastMsg = p.groupMessages.length > 0 ? p.groupMessages[p.groupMessages.length-1] : null;
                    if (!lastMsg) return t('startConv', 'Start a conversation');
                    const chatObj = {
                      type: 'room',
                      lastSenderName: lastMsg.username || lastMsg.senderName,
                      isMyLastMessage: lastMsg.isMe !== undefined ? lastMsg.isMe : ((lastMsg.username || lastMsg.senderName) === p.username),
                      lastMediaType: lastMsg.mediaType,
                      lastMediaFileName: lastMsg.mediaFileName || lastMsg._fileName,
                      lastMediaDuration: lastMsg.mediaDuration,
                      decryptedText: lastMsg.decryptedText,
                      message: lastMsg.message
                    };
                    return getMessagePreview(chatObj, p.username);
                  })()}
                </div>
              </div>
              {(() => {
                const groupKey = (p.roomId || '').toLowerCase();
                const isGroupLocked = chatLockEnabled && lockedChats.includes(groupKey) && !unlockedSessionsRef.current[groupKey];
                const isGroupMuted = mutedChats.includes(groupKey);
                return (
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    {isGroupMuted && <BellOff size={14} color={isLight ? "#475569" : "#888"} style={{flexShrink:0}} />}
                    {isGroupLocked ? (
                      <Lock size={16} color={isLight ? "var(--brand-1-dark)" : "var(--brand-1-light)"} style={{flexShrink:0}} />
                    ) : p.groupUnread > 0 ? (
                      <span className="unread-badge stay-white" style={{width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {p.groupUnread > 9 ? '9+' : p.groupUnread}
                      </span>
                    ) : null}
                  </div>
                );
              })()}
            </button>
            )}

            {(() => {
              // Only show users the current viewer has explicitly started a DM with,
              // or who have sent a DM to them. Room membership alone does NOT add a row.
              const allUsernames = Object.keys(p.dmThreads).filter(n => n && n !== p.username);

              // Helper: get timestamp of the last message in a DM thread
              const getLastMsgTs = (uname) => {
                const thread = p.dmThreads[uname?.toLowerCase()];
                if (!thread || thread.length === 0) return p.dmClearedTsRef?.current?.[uname?.toLowerCase()] || 0;
                const last = thread[thread.length - 1];
                return Number(last.timestamp || last.createdAt || last.id || 0);
              };

              const sortedUsernames = allUsernames.sort((a, b) => {
                const isAPinned = pinnedRoomChats.includes(a.toLowerCase());
                const isBPinned = pinnedRoomChats.includes(b.toLowerCase());
                if (isAPinned && !isBPinned) return -1;
                if (!isAPinned && isBPinned) return 1;
                // Both pinned or both not pinned — sort by last message time (newest first)
                return getLastMsgTs(b) - getLastMsgTs(a);
              });

              const filteredUsernames = sortedUsernames.filter(uname => {
                const isHidden = hiddenChats.includes(uname.toLowerCase());
                return showHiddenChats ? isHidden : !isHidden;
              });

              if (filteredUsernames.length === 0) {
                return (
                  <div style={{padding:40, textAlign:'center', color:'#444'}}>
                    <MessageSquare size={32} opacity={0.2} style={{margin:'0 auto 12px', display:'block'}}/>
                    <div style={{fontSize:12}}>{showHiddenChats ? 'No hidden chats' : 'No conversations yet'}</div>
                  </div>
                );
              }

              return filteredUsernames.map(uname => {
              const unread = p.dmUnread[uname?.toLowerCase()]||0;
              const thread = p.dmThreads[uname?.toLowerCase()]||[];
              const last = thread[thread.length-1];
              const uObj = p.userList.find(u=>u.username===uname);
              const isOnline = !!uObj;

              const partner = uname.toLowerCase();
              const isBlockedByThem = blockingMe.some(u => u.toLowerCase() === partner);
              const isBlocked = isBlockedByThem || blockedChats.some(u => u.toLowerCase() === partner);
              const displayUname = isBlocked ? 'User' : formatUsername(uname);

              // Find avatar from thread or group history if user is not currently in the room list
              const threadAvatar = thread.find(m => m.senderName === uname && m.senderAvatar)?.senderAvatar;
              const groupAvatar = p.groupMessages.find(m => (m.username === uname || m.senderName === uname) && m.senderAvatar)?.senderAvatar;
              const fallbackAvatar = threadAvatar || groupAvatar || p.knownAvatars?.[uname] || p.knownAvatars?.[uname.toLowerCase()];

              const displayAvatarSrc = isBlocked ? null : (getAvatarUrl(uObj?.avatarPath) || getAvatarUrl(fallbackAvatar));

              const chatKey = partner;
              const isDmLocked = chatLockEnabled && lockedChats.includes(chatKey) && !unlockedSessionsRef.current[chatKey];
              const isPinned = pinnedRoomChats.includes(chatKey);

              return (
                <button key={uname} onClick={()=>{
                  if (isDmLocked) {
                    setPendingUnlockChat({ key: chatKey, name: uname, type: 'dm' });
                    return;
                  }
                  clearTimeout(autoLockTimersRef.current[chatKey]);
                  p.openDM(uname);
                }} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid var(--room-border)',cursor:'pointer',color: isLight ? '#1e293b' : '#fff',width:'100%',textAlign:'left',position:'relative'}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <Avatar name={displayUname} size={40} src={displayAvatarSrc}/>
                    <div style={{position:'absolute',bottom:0,right:0,width:11,height:11,borderRadius:'50%',background:isOnline?'#10b981':'#666',border: isLight ? '2px solid #fff' : '2px solid #111'}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color: isLight ? '#1e293b' : '#fff',display:'flex',alignItems:'center',gap:5}}>
                      {displayUname}
                      {!isBlockedByThem && uObj?.isHost && <img src={crownImg} alt="host" style={{width:12,height:10}}/>}
                    </div>
                    <div style={{fontSize:11,color: isLight ? '#475569' : '#a1a1aa',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {(() => {
                        const typers = p.typingStatuses?.[uname.toLowerCase()];
                        if (typers && typers.length > 0) {
                          return <span style={{ color: '#10b981' }}>typing...</span>;
                        }
                        const dmRxnPreview = p.reactionPreviews?.[uname.toLowerCase()];
                        if (dmRxnPreview) return dmRxnPreview;
                        return last ? (() => {
                          const chatObj = {
                            type: 'private',
                            lastSenderName: last.senderName || last.username,
                            isMyLastMessage: last.isMe,
                            lastMediaType: last.mediaType,
                            lastMediaFileName: last.mediaFileName || last._fileName,
                            lastMediaDuration: last.mediaDuration,
                            decryptedText: last.decryptedText,
                            message: last.message
                          };
                          return getMessagePreview(chatObj, p.username);
                        })() : 'Start a private chat';
                      })()}
                    </div>
                  </div>
                  <div style={{position:'relative',display:'flex',alignItems:'center',gap:4}}>
                    {isPinned && <Pin size={12} color="var(--brand-1)" />}
                    {mutedChats.includes(chatKey) && <BellOff size={14} color={isLight ? "#475569" : "#888"} style={{flexShrink:0}} />}
                    {isDmLocked ? (
                      <Lock size={16} color={isLight ? "var(--brand-1-dark)" : "var(--brand-1-light)"} style={{flexShrink:0}} />
                    ) : unread > 0 && (
                      <span className="unread-badge stay-white" style={{width:20,height:20,borderRadius:'50%',background:'#ef4444',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </button>
              );
              });
            })()}
            {Object.keys(p.dmThreads).length===0 && (
              <div style={{padding:'20px',color:'#444',fontSize:12,textAlign:'center'}}>No other users in room</div>
            )}
          </div>
        </>
      ) : p.chatTab === 'group' ? (
        /* ===== GROUP CHAT THREAD ===== */
        <>
          <div style={{
            padding:'8px 14px',
            background: 'var(--room-sidebar-bg)',
            borderBottom:'1px solid var(--room-border)',
            display:'flex',alignItems:'center',gap:10,flexShrink:0,
            zIndex: 10,
            position: 'relative'
          }}>
            <button onClick={handleBackToList} style={{width:30,height:30,borderRadius:8,background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',border:'none',color: isLight ? '#64748b' : '#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ChevronLeft size={16}/>
            </button>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: p.room?.thumbnailPath ? 'none' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {p.room?.thumbnailPath ? (
                <img src={getRoomThumbnailUrl(p.room.thumbnailPath)} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Users size={15} color="#fff" />
              )}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color: isLight ? '#1e293b' : '#fff'}}>{p.roomName}</div>
              <div style={{fontSize:10,color: isLight ? '#64748b' : '#555'}}>{p.userCount} members online</div>
            </div>
            <div ref={p.groupMenuRef} style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center'}}>
              <div 
                onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(prev=>!prev);}} 
                style={{background:'none',border:'none',color: isLight ? '#64748b' : '#aaa',cursor:'pointer',padding:4, transition: 'color 0.2s'}}
                onMouseEnter={e => e.currentTarget.style.color = isLight ? '#000' : '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = isLight ? '#64748b' : '#aaa'}
              >
                <MoreVertical size={16}/>
              </div>
              {p.showGroupMenu && (
                <div className="menu-dropdown" style={{
                  position:'absolute',right:0,top:'100%',
                  background: 'var(--dropdown-bg)',
                  border: '1px solid var(--dropdown-border)',
                  borderRadius:12,padding:6,zIndex:100,minWidth:160,
                  boxShadow: 'var(--dropdown-shadow)'
                }} onMouseLeave={()=>p.setShowGroupMenu(false)}>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); setMsgSelectMode(true); setSelectedMsgIds(new Set());}} className="chat-menu-item menu-btn desktop-only-menu-item" style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}}>
                    <SquareCheck size={16}/> {t('selectMessages', 'Select messages')}
                  </div>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); if(p.isHost){ p.setRenameInput(p.roomName); p.setRenameModalOpen(true); } else toast.error(t('onlyHostRename', 'Only host can edit this room name'));}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                    <Edit2 size={16}/> {t('editName', 'Edit Name')}
                  </div>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); toggleMuteChat(p.roomId);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                    {mutedChats.includes((p.roomId||'').toLowerCase()) ? <Bell size={16}/> : <BellOff size={16}/>} {mutedChats.includes((p.roomId||'').toLowerCase()) ? t('unmute', 'Unmute') : t('mute', 'Mute')}
                  </div>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); p.openChatThemeSheet({ type: 'room', id: p.roomId });}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                    <Palette size={16}/> {t('chatTheme', 'Chat theme')}
                  </div>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); setClearGroupChatModalOpen(true);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                    <Trash2 size={16}/> {t('clearChat', 'Clear Chat')}
                  </div>
                </div>
              )}
            </div>
          </div>
          {(() => {
            const soonCount = countSoonExpiringMedia(p.groupMessages, roomExpiryKey);
            if (!soonCount) return null;
            return (
              <ExpiryReminderBanner
                count={soonCount}
                isLight={isLight}
                onGotIt={() => { dismissExpiryBanner12h(roomExpiryKey); p.bumpExpiryBannerTick?.(); }}
                onRemindLater={() => { snoozeExpiryBannerUntilClose(roomExpiryKey); p.bumpExpiryBannerTick?.(); }}
                onClose={() => { snoozeExpiryBannerUntilClose(roomExpiryKey); p.bumpExpiryBannerTick?.(); }}
              />
            );
          })()}
          <div
            ref={groupScrollContainerRef}
            className="no-scrollbar"
            onScroll={(e) => {
              handleScroll(e);
              const el = e.currentTarget;
              if (el.scrollTop < 50 && p.loadMoreGroupHistory && !p.groupHistoryLoading && p.hasMoreGroupHistory) {
                groupScrollAnchorRef.current = {
                  prevScrollHeight: el.scrollHeight,
                  prevScrollTop: el.scrollTop
                };
                p.loadMoreGroupHistory(el);
              }
            }} 
            onClick={() => { p.setActiveReactionMsg(null); p.setShowAllEmojis(false); p.setShowGroupEmojiPicker(false); p.setShowDmEmojiPicker(false); setActiveMessageMenu(null); longPress.close(); }} style={{flex:1,overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',padding:12,display:'flex',flexDirection:'column',gap:10, ...((p.chatThemes && p.chatThemes[(p.roomId||'').toLowerCase()] && p.chatThemes[(p.roomId||'').toLowerCase()] !== 'default') ? { background: isLight ? '#ffffff' : '#0a0a0a' } : {})}}>
            {p.groupHistoryLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', flexShrink: 0 }}>
                <Loader2 size={20} style={{ color: 'var(--brand-1)', animation: 'spin 1s linear infinite' }} />
              </div>
            )}
            {p.groupMessages.length===0 && (
              p.groupHistoryReady ? (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:8}}><MessageSquare size={36} opacity={0.2}/><p style={{margin:0,fontSize:13}}>{t('sayHi', 'No messages yet. Say hi!')}</p></div>
              ) : (
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><Loader2 size={24} style={{ color: 'var(--brand-1)', animation: 'spin 1s linear infinite' }} /></div>
              )
            )}
            {(() => {
              const effectiveGroupSeenMap = getEffectiveSeenBy(p.groupMessages, p.username);
              const groupMediaRunsInfo = groupMediaRuns(p.groupMessages);
              // A "seen" event can land on any message in a media batch (whichever one
              // the reader's client happened to report), not necessarily the head — but
              // only the head row ever renders a receipt. Merge readers from every
              // message in the run onto the head's own lookup key so none get lost.
              for (const [, runMsgs] of groupMediaRunsInfo.heads.entries()) {
                const headMsg = runMsgs[0];
                const headMapKey = String(headMsg.id || headMsg.timestamp);
                const merged = new Map();
                for (const rm of runMsgs) {
                  const readers = effectiveGroupSeenMap.get(String(rm.id || rm.timestamp)) || [];
                  for (const r of readers) merged.set(r.username.toLowerCase(), r);
                }
                if (merged.size > 0) effectiveGroupSeenMap.set(headMapKey, Array.from(merged.values()));
              }
              // A media-batch's non-head rows render null, so the "last message" for
              // read-receipt purposes must resolve to the batch's head row (the one
              // that actually renders), not the raw last index.
              let lastGroupRenderIdx = p.groupMessages.length - 1;
              while (lastGroupRenderIdx >= 0) {
                const lm = p.groupMessages[lastGroupRenderIdx];
                const lrk = lm.tempId || lm.id || lastGroupRenderIdx;
                if (!groupMediaRunsInfo.memberKeys.has(lrk)) break;
                lastGroupRenderIdx--;
              }
              const lastGroupMsg = p.groupMessages[lastGroupRenderIdx];
              const isLastGroupSentByMe = lastGroupMsg && (lastGroupMsg.isMe || (lastGroupMsg.username && lastGroupMsg.username.toLowerCase() === p.username?.toLowerCase()) || (lastGroupMsg.senderName && lastGroupMsg.senderName.toLowerCase() === p.username?.toLowerCase()));
              const renderGroupReceiptIndex = isLastGroupSentByMe ? lastGroupRenderIdx : -1;
              const groupThemeId = (p.chatThemes && p.chatThemes[(p.roomId||'').toLowerCase()]) || 'default';
              const groupTheme = CHAT_THEMES.find(th => th.id === groupThemeId) || CHAT_THEMES[0];
              const isGroupCustomTheme = groupThemeId !== 'default';
              return p.groupMessages.map((msg,i)=>{
              const rowKey = msg.tempId || msg.id || i;
              if (groupMediaRunsInfo.memberKeys.has(rowKey)) return null;
              const mediaGroupItems = groupMediaRunsInfo.heads.get(rowKey) || null;
              const isMe = msg.isMe || (msg.username && msg.username.toLowerCase() === p.username?.toLowerCase()) || (msg.senderName && msg.senderName.toLowerCase() === p.username?.toLowerCase());
              const reactions = msg.reactions||{};
              const prevMsg = i > 0 ? p.groupMessages[i - 1] : null;
              const showDateSep = !prevMsg || getDateKey(prevMsg.timestamp) !== getDateKey(msg.timestamp);
              const resolvedMedia = (p.groupDecryptedMediaUrls?.current && (
                p.groupDecryptedMediaUrls.current[msg.id] ||
                p.groupDecryptedMediaUrls.current[msg.tempId] ||
                p.groupDecryptedMediaUrls.current[String(msg.timestamp)]
              )) || msg._localMediaUrl || ((msg.mediaUrl && msg.mediaUrl.startsWith('blob:')) ? msg.mediaUrl : (msg.nonce ? null : msg.mediaUrl));
              const isDecryptingGroup = !resolvedMedia && !!msg.nonce && !!msg.mediaType && (Date.now() - Number(msg.timestamp)) < 30000;
              const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
              const swipeHandlers = swipe.getHandlers(rowKey, isMe ? 'left' : 'right', () => p.setGroupReplyTo(msg));
              const longPressHandlers = longPress.getHandlers(rowKey);
              const rowSelectHandlers = rowSelectLongPress.getHandlers(rowKey);
              const gestureHandlers = {
                // Taps inside the open long-press menu bubble through to this
                // wrapper's own touchstart (it's a sibling under the same
                // gesture div), which was closing the menu on touch-DOWN
                // before the tap could register on a button — skip entirely
                // when the touch actually started on the menu itself.
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
                    <span style={{fontSize:11,color: isLight ? '#64748b' : '#888',whiteSpace:'nowrap',padding:'0 4px'}}>{formatDateSeparator(msg.timestamp)}</span>
                    <div style={{flex:1,height:1,background:'rgba(128,128,128,0.25)'}}/>
                  </div>
                )}
                <div id={`group-msg-${msg.id || msg.tempId || i}`} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4, position: 'relative', zIndex: (showLongPressMenu || activeMessageMenu === msg.id) ? 50 : undefined, background: (msgSelectMode && selectedMsgIds.has(rowKey)) ? (isLight ? 'rgba(var(--brand-1-rgb),0.10)' : 'rgba(var(--brand-1-rgb),0.18)') : 'transparent', borderRadius: 12, padding: (msgSelectMode && selectedMsgIds.has(rowKey)) ? '4px 0' : 0, transition: timestampPeek.isPeeking ? 'background 0.15s ease' : 'background 0.15s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1)', transform: `translateX(${timestampPeek.dragX}px)`}}
                     onTouchStart={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchStart(e); timestampPeek.onTouchStart(e); } }}
                     onTouchMove={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchMove(e); timestampPeek.onTouchMove(e); } }}
                     onTouchEnd={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchEnd(e); timestampPeek.onTouchEnd(e); } }}>
                  <div style={{ position:'absolute', top:0, bottom:0, right: -(timestampPeek.PEEK_WIDTH + 20), width: 60, overflow: 'hidden', display:'flex', alignItems:'center', fontSize:11, color: isLight ? '#64748b' : '#94a3b8', pointerEvents:'none', whiteSpace:'nowrap' }}>
                    {formatTime(msg.timestamp)}
                  </div>
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
                    <div onClick={() => { const el = document.getElementById(`group-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(var(--brand-1-rgb),0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',borderLeft:'3px solid var(--brand-1)',borderRadius:6,padding:'4px 8px',fontSize:11,color: isLight ? '#64748b' : '#888',maxWidth:'80%',cursor:'pointer'}}>
                      <span style={{color: isLight ? '#1e293b' : '#a0aab2',fontWeight:600}}>{(() => { 
                        const n = msg.replyTo.username || msg.replyTo.senderName; 
                        const partner = (n||'').toLowerCase();
                        const isRepBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner); 
                        return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : formatUsername(n)); 
                      })()}: </span>{(() => {
                        const raw = msg.replyTo.message || '';
                        if (msg.replyTo.mediaType) { const rmt=msg.replyTo.mediaType; return rmt.startsWith('video')?'Video':rmt.startsWith('image')?'Photo':rmt.startsWith('audio')?'Voice Note':(msg.replyTo.mediaFileName || msg.replyTo._fileName || 'File'); }
                        if (msg.replyTo.decryptedText) return msg.replyTo.decryptedText.slice(0,60);
                        if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                        return raw.slice(0,60) || 'Message';
                      })()}
                    </div>
                  )}
                  <div style={{display:'flex',alignItems:'center',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'85%'}}>
                    {!isMe && (() => {
                      const partnerName = (msg.username || msg.senderName || '');
                      const partner = partnerName.toLowerCase();
                      const isSenderBlockedByMe = blockedChats.some(u => u.toLowerCase() === partner);
                      const amIBlockedBySender = blockingMe.some(u => u.toLowerCase() === partner);
                      
                      const displayUsername = amIBlockedBySender ? 'User' : formatUsername(partnerName);
                      const fallbackAvatar = msg.senderAvatar || p.knownAvatars?.[partnerName];
                      const displayAvatarSrc = amIBlockedBySender ? null : getAvatarUrl(fallbackAvatar);
                      
                      const userObj = p.userList?.find(u => u.username === partnerName);
                      const uIsHost = userObj?.isHost || (p.room?.hostUsername && partnerName.toLowerCase() === p.room.hostUsername.toLowerCase());
                      const uIsAdmin = !!(p.room?.settings?.newMembersAdmins && partnerName && partnerName !== 'Anonymous' && !partnerName.toLowerCase().startsWith('guest_') && !uIsHost);
                      
                      return <span onClick={() => !amIBlockedBySender && navigate(`/profile/${partnerName}`)} title={amIBlockedBySender ? 'Blocked User' : `View ${partnerName}'s profile`} style={{cursor:amIBlockedBySender?'default':'pointer'}}><Avatar name={displayUsername} size={28} src={displayAvatarSrc} isHost={uIsHost} isAdmin={uIsAdmin}/></span>;
                    })()}
                    <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                      {!isMe && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const sName = msg.senderName || msg.username;
                                if (sName && !blockingMe.some(u => u.toLowerCase() === sName.toLowerCase())) navigate(`/profile/${sName}`); 
                              }}
                              style={{ fontSize: 10, color: isLight ? '#374151' : '#888', cursor: blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) ? 'default' : 'pointer' }}
                              title={blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) ? 'Blocked User' : `View ${msg.senderName || msg.username}'s profile`}
                            >
                              {blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) ? 'User' : formatUsername(msg.senderName || msg.username)}
                            </span>
                            {(() => {
                              const sName = msg.senderName || msg.username;
                              if (!sName || blockingMe.some(u => u.toLowerCase() === sName.toLowerCase())) return null;
                              const userObj = p.userList?.find(u => u.username === sName);
                              const isH = userObj?.isHost || (p.room?.hostUsername && sName.toLowerCase() === p.room.hostUsername.toLowerCase());
                              const isA = !!(p.room?.settings?.newMembersAdmins && sName && sName !== 'Anonymous' && !sName.toLowerCase().startsWith('guest_') && !isH);
                              if (isH) return <Star size={8} color="#fbbf24" fill="#fbbf24" />;
                              if (isA) return <Shield size={8} color="#3b82f6" fill="#3b82f6" />;
                              return null;
                            })()}
                          </div>
                      )}
                      <div style={{position:'relative', display:'flex', alignItems:'center'}}
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
                        <div className={isMe ? 'msg-sent stay-white' : 'msg-received'} style={{
                          position: 'relative',
                          zIndex: 2,
                          background: isMediaOnly ? 'transparent' : (isMe ? (isGroupCustomTheme ? groupTheme.gradient : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))') : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.1)')),
                          ...(isMe && isGroupCustomTheme && !isMediaOnly ? {
                            backgroundSize: `100% ${Math.max(p.groupMessages.length, 1) * CHAT_THEME_BUBBLE_STRIDE}px`,
                            backgroundPosition: `0 -${i * CHAT_THEME_BUBBLE_STRIDE}px`,
                          } : {}),
                          padding: isMediaOnly ? '0' : '8px 12px',
                          borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',
                          fontSize:14,
                          color: isMe ? '#fff' : (isLight ? '#111827' : '#fff'),
                          maxWidth:'100%',
                          wordBreak:'break-word',
                          transform: `translateX(${rowDragX}px)`,
                          transition: rowDragging ? 'none' : (rowBounce ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.2s ease'),
                          display: isMediaOnly ? 'block' : 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'flex-end',
                          columnGap: 6
                        }}
                        onMouseEnter={() => setHoveredMsgId(msg.id||i)}
                        onMouseLeave={() => setHoveredMsgId(null)}>
                          <div style={{ flex: isMediaOnly ? undefined : '0 1 auto', minWidth: 0 }}>
                            {!msg.mediaType && msg.forwarded && (
                              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontStyle:'italic', opacity:0.75, marginBottom:2 }}>
                                <Forward size={11} /> Forwarded
                              </div>
                            )}
                            {(!msg.mediaType && !msg.message && !msg.e2ee && !msg.nonce) ? (
                              <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, fontStyle:'italic'}}>{t('messageUnavailable', '[Message unavailable]')}</div>
                            ) : msg.decryptedText !== null ? (
                              <MessageText text={msg.decryptedText} isMe={isMe} />
                            ) : (
                              (!msg.mediaType && (msg.e2ee || msg.nonce || (msg.message && looksLikeCiphertext(msg.message)))) ? (
                                <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                              ) : (
                                !msg.mediaType && msg.message && <MessageText text={msg.message} isMe={isMe} />
                              )
                            )}
                          </div>
                          {!isMediaOnly && isMe && (
                            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingBottom: 1 }}>
                              <MessageTick msg={msg} username={p.username} isLight={isLight} />
                            </div>
                          )}
                          {mediaGroupItems ? (
                            <MediaGrid
                              items={mediaGroupItems}
                              forwarded={msg?.forwarded}
                              expiresAt={msg.mediaExpiresAt}
                              tick={isMe ? <MessageTick msg={msg} username={p.username} isLight={isLight} /> : null}
                              resolveUrl={(it) => resolveDecryptedUrl(it, p.groupDecryptedMediaUrls)}
                              onOpenItem={(it, url) => openLightboxAt(url, it.mediaType, p.groupMessages, p.groupDecryptedMediaUrls)}
                            />
                          ) : renderMedia(resolvedMedia, msg.mediaType, isMe, msg._fileName || msg.mediaFileName, msg._fileSize || msg.mediaFileSize, msg.mediaExpiresAt, p.groupMessages, p.groupDecryptedMediaUrls, isDecryptingGroup, msg)}

                          {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                            <div className="msg-hover-menu" style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                              <button className={(isLight && msg.mediaType) ? 'stay-white' : ''} onClick={(e)=>{ e.stopPropagation(); if (activeMessageMenu !== msg.id) setDropdownPlacement((window.innerHeight - e.clientY) < 240 ? 'up' : 'down'); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowHeaderMenu(false); p.setShowAllEmojis(false); p.setActiveReactionMsg(null); }} style={{background: (isLight && msg.mediaType) ? 'rgba(0,0,0,0.45)' : (isMediaOnly ? 'rgba(0,0,0,0.35)' : (isMe ? 'rgba(255,255,255,0.15)' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'))),backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: (isLight && msg.mediaType) ? '#fff' : (isMediaOnly ? '#fff' : (isMe ? '#fff' : (isLight ? '#374151' : '#fff'))), WebkitTextFillColor: (isLight && msg.mediaType) ? '#fff' : (isMediaOnly ? '#fff' : (isMe ? '#fff' : (isLight ? '#374151' : '#fff'))),padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
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
                                   background: 'var(--dropdown-bg)',
                                   border: '1px solid var(--dropdown-border)',
                                   borderRadius:12, padding:6, zIndex:100,
                                   boxShadow: 'var(--dropdown-shadow)', minWidth: 160
                                 }} onClick={e => e.stopPropagation()}>
                                   {!!getMessageCopyText(msg) && (
                                     <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); copyMessageText(msg); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn">
                                       <Copy size={16}/> {t('copy', 'Copy')}
                                     </button>
                                   )}
                                   {isMe ? (
                                     <>
                                       {isMessageEditable(msg) && (
                                         <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.setGroupReplyTo(null); p.setGroupEditingMessage(msg); p.setGroupChatInput(getMessageCopyText(msg)); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn">
                                           <Edit2 size={16}/> {t('edit', 'Edit')}
                                         </button>
                                       )}
                                       <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
                                         <Trash2 size={16}/> {t('unsend', 'Unsend')}
                                       </button>
                                       <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-del-me">
                                         <Trash2 size={16}/> {t('deleteForMe', 'Delete for me')}
                                       </button>
                                     </>
                                   ) : (
                                     <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
                                       <Trash2 size={16}/> {t('delete', 'Delete')}
                                     </button>
                                   )}
                                 </div>
                               )}
                            </div>
                          )}

                          {p.activeReactionMsg === msg.id && !p.showAllEmojis && (
                            <div className="emoji-picker-container" style={{position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8, zIndex:100}}>
                              <div style={{
                                background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,26,46,0.95)',
                                backdropFilter:'blur(12px)',
                                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius:30,
                                padding:'6px 8px',
                                display:'flex',
                                alignItems:'center',
                                gap:6,
                                width:'max-content',
                                boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 8px 24px rgba(0,0,0,0.6)'
                              }}>
                                {QUICK_EMOJIS.map(em=>(
                                  <button key={em} onClick={(e)=>{e.stopPropagation(); p.handleGroupReact(msg.id || msg.timestamp, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} className="menu-btn" onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                ))}
                                <button className="reaction-plus-trigger" onClick={(e)=>{e.stopPropagation(); p.setActiveReactionMsg(msg.id); p.setShowAllEmojis(true);}} style={{background: isLight ? '#d1d5db' : '#e2e8f0',border: isLight ? '1px solid #9ca3af' : '1px solid #cbd5e1',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',WebkitTextFillColor:'#000',transition:'background 0.2s'}} onMouseEnter={(e)=>{e.currentTarget.style.background= isLight ? '#b8bfc9' : '#f8fafc'}} onMouseLeave={(e)=>{e.currentTarget.style.background= isLight ? '#d1d5db' : '#e2e8f0'}}><Plus size={16} color="#000" style={{ color: '#000', WebkitTextFillColor: '#000' }}/></button>
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
                                <button key={em} onClick={(e)=>{ e.stopPropagation(); p.handleGroupReact(msg.id || msg.timestamp, em); longPress.close(); }} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,padding:4,borderRadius:8}} className="menu-btn">{em}</button>
                              ))}
                              <button onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(msg.id); p.setShowAllEmojis(true); longPress.close(); }} style={{background: isLight ? '#d1d5db' : '#e2e8f0',border:'none',cursor:'pointer',width:30,height:30,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
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
                                  <button onClick={() => { p.setGroupReplyTo(null); p.setGroupEditingMessage(msg); p.setGroupChatInput(getMessageCopyText(msg)); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                    <Edit2 size={14}/> {t('edit', 'Edit')}
                                  </button>
                                )}
                                <button onClick={() => { p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                  <Trash2 size={14}/> {t('unsend', 'Unsend')}
                                </button>
                                <button onClick={() => { p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                  <Trash2 size={14}/> {t('deleteForMe', 'Delete for me')}
                                </button>
                              </>
                            ) : (
                              <button onClick={() => { p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                <Trash2 size={14}/> {t('delete', 'Delete')}
                              </button>
                            )}
                            {!isMe && (
                              <button onClick={() => { p.reportMsg(msg); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                <Flag size={14} /> {t('report', 'Report')}
                              </button>
                            )}
                          </div>
                        )}
                        {!blockingMe.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && (
                          <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: p.activeReactionMsg === msg.id ? 1 : undefined, transition:'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className="react-btn-container">
                            <button className="react-btn" onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(p.activeReactionMsg===msg.id?null:msg.id); p.setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: isLight ? '#6b7280' : '#9ca3af',padding:'3px 5px',transition:'color 0.15s'}} onMouseEnter={(e)=>{e.currentTarget.style.color= isLight ? '#111' : '#fff'}} onMouseLeave={(e)=>{e.currentTarget.style.color= isLight ? '#6b7280' : '#9ca3af'}}>
                              <SmilePlus size={16}/>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="msg-meta-row" style={{display:'flex',alignItems:'center',gap:6,minWidth:0,width:'100%',alignSelf:'stretch'}}>
                        {(() => { if (!msg.mediaExpiresAt) return null; const mt = msg.mediaType || ''; return null; })()}
                        <span style={{flex:1}}></span>
                        {msg.edited && <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa',flexShrink:0}}>{t('edited', 'Edited')}</span>}
                        <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa',flexShrink:0}}>{formatTime(msg.timestamp)}</span>
                        {!blockingMe.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && (
                          <button onClick={()=>p.setGroupReplyTo(msg)} style={{background:'none',border:'none',color: isLight ? '#555' : '#aaa',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3,flexShrink:0}}><Reply size={10}/>Reply</button>
                        )}
                        {!isMe && (
                          <button onClick={()=>p.reportMsg(msg)} style={{background:'none',border:'none',color: isLight ? '#555' : '#aaa',cursor:'pointer',padding:0,flexShrink:0}}><Flag size={9}/></button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4, paddingLeft: isMe ? 0 : 36}}>
                    {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                      <button key={emoji} onClick={()=>p.handleGroupReact(msg.id || msg.timestamp, emoji)} style={{background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(p.username)?'var(--brand-1)' : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)')}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color: isLight ? '#374151' : '#ddd'}}>
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                  {i === renderGroupReceiptIndex && (
                    <ReadReceipt 
                      msg={{
                        ...msg,
                        seenBy: effectiveGroupSeenMap.get(String(msg.id || msg.timestamp)) || []
                      }}
                      isGroup={true} 
                      username={p.username} 
                      userList={p.userList} 
                      socketServerUrl={p.SOCKET_SERVER_URL} 
                      isLight={isLight}
                    />
                  )}
                </div>
                </React.Fragment>
              );
            })})()}
            {(() => {
              const rId = (p.roomId || '').toLowerCase();
              const typers = p.typingStatuses?.[rId];
              if (!typers || typers.length === 0) return null;
              return (
                <div style={{color:'#10b981',fontSize:12,marginTop:4,marginBottom:4,paddingLeft:4}}>
                  {typers.join(', ')} typing...
                </div>
              );
            })()}
            <div ref={p.messagesEndRef}/>
          </div>
          {p.groupReplyTo && (
            <div style={{padding:'6px 12px',background:'rgba(var(--brand-1-rgb),0.08)',borderTop:'1px solid rgba(var(--brand-1-rgb),0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
              <span><span style={{color:'var(--brand-1)',fontWeight:600}}>{(() => { const n = p.groupReplyTo.username || p.groupReplyTo.senderName; const isRepBlocked = blockingMe.some(u => u.toLowerCase() === (n||'').toLowerCase()); return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); })()}: </span>{(() => {
                const r = p.groupReplyTo;
                if (r.mediaType) { const rmt3=r.mediaType; return rmt3.startsWith('video')?'Video':rmt3.startsWith('image')?'Photo':rmt3.startsWith('audio')?'Voice Note':(r._fileName || r.mediaFileName || 'File'); }
                if (r.decryptedText) return r.decryptedText.slice(0,50);
                const raw = r.message || '';
                if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                return raw.slice(0,50) || 'Message';
              })()}</span>
              <button onClick={()=>p.setGroupReplyTo(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
            </div>
          )}
          {p.groupEditingMessage && (
            <div style={{padding:'6px 12px',background:'rgba(56,189,248,0.08)',borderTop:'1px solid rgba(56,189,248,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
              <span style={{display:'flex',alignItems:'center',gap:6}}><Edit2 size={12} color="#38bdf8"/><span style={{color:'#38bdf8',fontWeight:600}}>{t('editingMessage', 'Editing message')}</span></span>
              <button onClick={()=>{ p.setGroupEditingMessage(null); p.setGroupChatInput(''); }} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
            </div>
          )}
          <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0,position:'relative'}}>
            {/* Restriction badges */}
            {(() => {
              const chatLocked = p.chatPerm === 'host' && !p.isHost;
              const showBadges = p.isMuted || chatLocked || p.allowLinks === false || p.allowMedia === false;
              if (!showBadges) return null;
              return (
                <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                  {p.isMuted && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> You are muted</div>}
                  {chatLocked && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Host-only messaging</div>}
                  {p.allowLinks === false && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Links Disabled</div>}
                  {p.allowMedia === false && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Media Disabled</div>}
                </div>
              );
            })()}
            
            {/* Group + DM emoji pickers moved to global section below to avoid overflow clipping */}
            
            {/* Group recording UI */}
            {isRecording && recordingFor === 'group' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, minWidth: 28, letterSpacing: '0.5px' }}>{formatRecordingTime(recordingTime)}</span>
                <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', height: 22, overflow: 'hidden' }}>
                  {waveHeights.map((h, i) => (
                    <div key={i} style={{ width: 3, borderRadius: 3, background: 'linear-gradient(to top, var(--brand-1), var(--brand-2))', flexShrink: 0, height: `${h}%`, transition: 'height 0.08s ease', minHeight: 3 }} />
                  ))}
                </div>
                <button type="button" className="voice-trash-btn" onClick={cancelRecording} title="Delete Recording"><Trash2 size={14} /></button>
                <button className="stay-white" type="button" onClick={stopRecording} style={{ background: 'var(--brand-1)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  <Check size={11} color="#fff" strokeWidth={2.5} /> <span className="stay-white" style={{ color: '#fff' }}>Done</span>
                </button>
              </div>
            )}
            {!isRecording && audioBlob && audioUrl && recordingFor === 'group' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.1)', border: '1px solid rgba(var(--brand-1-rgb),0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
                <Music size={14} color="var(--brand-2)" style={{ flexShrink: 0 }} />
                <audio src={audioUrl} controls style={{ height: 24, flex: 1 }} />
                <button type="button" className="voice-trash-btn" onClick={cancelRecording} title="Delete Recording"><Trash2 size={14} /></button>
                <button className="stay-white" type="button" onClick={sendVoiceNote} disabled={isUploading} style={{ background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  {isUploading ? <Loader2 size={11} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={11} color="#fff" /> <span className="stay-white" style={{ color: '#fff' }}>Send</span></>}
                </button>
              </div>
            )}
            {(!isRecording || recordingFor !== 'group') && !(audioBlob && recordingFor === 'group') && (() => {
              const chatLocked = p.chatPerm === 'host' && !p.isHost;
              const isDisabled = p.isMuted || chatLocked;
              return (
                <form ref={groupFormRef} onSubmit={(e) => {
                    const val = p.groupChatInput.trim();
                    const hasLink = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/.test(val);
                    const hasImage = /data:image\/[a-zA-Z]*;base64,/.test(val);
                    if (chatLocked) { e.preventDefault(); toast.error('Only the host can send messages'); return; }
                    if (hasLink && p.allowLinks === false) { e.preventDefault(); toast.error('Links are not allowed in this room'); return; }
                    if (hasImage && p.allowMedia === false) { e.preventDefault(); toast.error('Media (images/videos) are not allowed in this room'); return; }
                    p.sendGroupChat(e); 
                    p.setShowGroupEmojiPicker(false); 
                  }} style={{display:'flex',gap:8, alignItems:'flex-end'}}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                      <input type="file" multiple ref={fileInputRef} style={{display:'none'}} accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/mpeg,audio/wav,audio/ogg,audio/m4a" onChange={(e) => handleFileSelect(e, 'group')} />
                      <textarea
                        className="chat-msg-textarea no-scrollbar"
                        ref={p.groupInputRef}
                        rows={1}
                        value={p.groupChatInput}
                        onChange={e=>{const limited = enforceWordLimit(e.target.value); p.handleChatInputChange(limited, 'room'); p.setGroupChatInput(limited);}}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 1024) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                        onFocus={(e) => { p.setShowGroupEmojiPicker(false); setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch {} }, 300); }}
                        placeholder={t('msgRoomPlace', 'Message the room...')}
                        disabled={isDisabled}
                        style={{
                          flex:1,
                          resize:'none',
                          maxHeight:120,
                          overflowY:'auto',
                          lineHeight:1.4,
                          fontFamily:'inherit',
                          // Solid opaque fill in dark mode, not a faint tint —
                          // light mode's #f1f5f9 was already opaque.
                          background: isLight ? '#f1f5f9' : '#1c1c1e',
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius:10,
                          padding:'8px 12px',
                          paddingRight: (!p.groupChatInput && !isUploading) ? '95px' : '12px',
                          paddingLeft: (isMobileOrTablet && !p.groupChatInput && !isUploading) ? '36px' : '12px',
                          color: isLight ? '#1e293b' : '#fff',
                          fontSize:13,
                          outline:'none',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />

                      {(!p.groupChatInput && !isUploading) && (
                        <>
                          {/* Mobile/tablet only: emoji lives on the far left of the box. */}
                          {isMobileOrTablet && (
                            <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                              <button type="button" className="emoji-btn-group" onClick={(e) => { e.stopPropagation(); p.setShowGroupEmojiPicker(!p.showGroupEmojiPicker); }} style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#ffffff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                <SmilePlus size={18}/>
                              </button>
                            </div>
                          )}
                          <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 0 }}>
                            {!isMobileOrTablet && (
                              <button type="button" className="emoji-btn-group" onClick={(e) => { e.stopPropagation(); p.setShowGroupEmojiPicker(!p.showGroupEmojiPicker); }} style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#ffffff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                <SmilePlus size={18}/>
                              </button>
                            )}
                            <button type="button" disabled={isUploading || isDisabled || p.allowMedia === false} onClick={() => fileInputRef.current?.click()} style={{background:'transparent',border:'none',color:isUploading?'var(--brand-1)' : (isLight ? '#64748b' : '#ffffff'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isDisabled || p.allowMedia === false ? 0.4 : 1}}>
                              <Paperclip size={18}/>
                            </button>
                            <button type="button" disabled={isDisabled} onClick={() => startRecording('group')} title="Record voice note" style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#ffffff',cursor:isDisabled?'pointer':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isDisabled?0.4:1}}>
                              <Mic size={18}/>
                            </button>
                            {/* Camera — mobile/tablet only, after mic per explicit request */}
                            {isMobileOrTablet && (
                              <button type="button" disabled={isDisabled || p.allowMedia === false} onClick={() => setShowGroupCamera(true)} title="Open camera" style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#ffffff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isDisabled || p.allowMedia === false ? 0.4 : 1}}>
                                <Camera size={18}/>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      {showGroupCamera && (
                        <CameraCapture
                          onCapture={async (file, caption) => {
                            await handleFileSelect({ target: { files: [file], value: null } }, 'group');
                            if (caption && caption.trim()) {
                              p.setGroupChatInput(caption.trim());
                              setTimeout(() => groupFormRef.current?.requestSubmit(), 60);
                            }
                          }}
                          onClose={() => setShowGroupCamera(false)}
                        />
                      )}

                      {isUploading && (
                        <div style={{ position: 'absolute', right: 10 }}>
                          <Loader2 size={16} className="animate-spin" color="var(--brand-1)" />
                        </div>
                      )}
                    </div>
                    <button type="submit" disabled={isDisabled||!p.groupChatInput.trim()} style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,var(--brand-1),var(--brand-2))',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:isDisabled||!p.groupChatInput.trim()?0.5:1, flexShrink: 0}}>
                      <Send size={15} color="#fff"/>
                    </button>
                  </form>
              );
            })()}
          </div>
        </>
      ) : (
        /* ===== DM Thread ===== */
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,minHeight:0}}>
            {p.dmTarget ? (() => {
              const uObj = p.userList.find(u=>u.username===p.dmTarget);
              const isOnline = !!uObj;
              return (
              <>
                <div style={{
                  padding:'8px 14px',
                  background: 'var(--room-sidebar-bg)',
                  borderBottom:'1px solid var(--room-border)',
                  display:'flex',alignItems:'center',gap:10,flexShrink:0,
                  zIndex: 10,
                  position: 'relative'
                }}>
                  <button onClick={handleBackToList} style={{width:30,height:30,borderRadius:8,background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',border:'none',color: isLight ? '#64748b' : '#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <ChevronLeft size={16}/>
                  </button>
                  {(() => {
                    const partner = p.dmTarget.toLowerCase();
                    const isBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner);
                    const displayUname = isBlocked ? 'User' : formatUsername(p.dmTarget);
                    const uObj = p.userList.find(u => u.username === p.dmTarget);
                    
                    // Check if we have public keys for this user in any cache
                    const hasTargetKeys = (uObj?.publicKey) || (p.dbPublicKeys?.current?.[partner]) || localStorage.getItem(`wt_pk_${partner}`);
                    
                    const threadAvatar = (p.dmThreads[p.dmTarget?.toLowerCase()]||[]).find(m => m.senderName === p.dmTarget && m.senderAvatar)?.senderAvatar;
                    const groupAvatar = p.groupMessages.find(m => (m.username === p.dmTarget || m.senderName === p.dmTarget) && m.senderAvatar)?.senderAvatar;
                    const fallbackAvatar = threadAvatar || groupAvatar || p.knownAvatars?.[p.dmTarget] || p.knownAvatars?.[p.dmTarget.toLowerCase()];

                    const displayAvatarSrc = isBlocked ? null : (getAvatarUrl(uObj?.avatarPath) || getAvatarUrl(fallbackAvatar));

                    return (
                      <>
                        <Avatar name={displayUname} size={32} src={displayAvatarSrc}/>
                        <div>
                          <div
                            onClick={() => !isBlocked && navigate(`/profile/${p.dmTarget}`)}
                            title={isBlocked ? 'Blocked User' : `View ${p.dmTarget}'s profile`}
                            style={{fontSize:13,fontWeight:700,color: isLight ? '#1e293b' : '#fff',display:'flex',alignItems:'center',gap:5,cursor:isBlocked?'default':'pointer'}}
                          >
                            {displayUname}
                          </div>
                          <div style={{fontSize:10,color:(isOnline && !isBlocked)?(hasTargetKeys ? '#10b981' : (isLight ? '#f59e0b' : '#f59e0b')):(isLight ? '#64748b' : '#666'),display:'flex',alignItems:'center',gap:4}}>
                            {(isOnline && !isBlocked) ? (
                              hasTargetKeys ? <><Lock size={9}/>Online / E2E Encrypted</> : <><Lock size={9} style={{color:'#f59e0b'}}/>Online / Keys Missing</>
                            ) : 'Offline'}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  <div ref={p.dmMenuRef} style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center'}}>
                    <div 
                      onClick={e=>{e.stopPropagation(); p.setShowDmMenu(p.showDmMenu===p.dmTarget?null:p.dmTarget); setActiveMessageMenu(null);}} 
                      style={{background:'none',border:'none',color: isLight ? '#64748b' : '#aaa',cursor:'pointer',padding:4, transition: 'color 0.2s'}}
                      onMouseEnter={e => e.currentTarget.style.color = isLight ? '#000' : '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = isLight ? '#64748b' : '#aaa'}
                    >
                      <MoreVertical size={16}/>
                    </div>
                    {p.showDmMenu === p.dmTarget && (
                      <div className="menu-dropdown" style={{
                        position:'absolute',right:0,top:'100%',
                        background: 'var(--dropdown-bg)',
                        border: '1px solid var(--dropdown-border)',
                        borderRadius:12,padding:6,zIndex:100,minWidth:180,
                        boxShadow: 'var(--dropdown-shadow)'
                      }}>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); setMsgSelectMode(true); setSelectedMsgIds(new Set());}} className="chat-menu-item menu-btn desktop-only-menu-item" style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}}>
                          <SquareCheck size={16}/> {t('selectMessages', 'Select messages')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); togglePinRoomChat(p.dmTarget);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          <Pin size={16}/> {pinnedRoomChats.includes((p.dmTarget||'').toLowerCase()) ? t('unpinChat', 'Unpin Chat') : t('pinChat', 'Pin Chat')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); toggleHideChat((p.dmTarget||'').toLowerCase());}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          <Lock size={16}/> {hiddenChats.includes((p.dmTarget||'').toLowerCase()) ? t('unhideChat', 'Unhide Chat') : t('hideChat', 'Hide Chat')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); toggleMuteChat(p.dmTarget);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          {mutedChats.includes((p.dmTarget||'').toLowerCase()) ? <Bell size={16}/> : <BellOff size={16}/>} {mutedChats.includes((p.dmTarget||'').toLowerCase()) ? t('unmute', 'Unmute') : t('mute', 'Mute')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); p.openChatThemeSheet({ type: 'private', partner: p.dmTarget });}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          <Palette size={16}/> {t('chatTheme', 'Chat theme')}
                        </div>
                        <div style={{ height: '1px', background: 'var(--menu-divider)', margin: '6px 8px' }} />
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); setBlockUserConfirm({username: p.dmTarget}); }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                          <Ban size={16}/> {blockedChats.some(u => u.toLowerCase() === (p.dmTarget||'').toLowerCase()) ? t('unblock', 'Unblock') : t('block', 'Block')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); p.setClearChatTarget(p.dmTarget); p.setClearForBoth(false); p.setClearChatModalOpen(true); }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                          <Trash2 size={16}/> {t('clearChat', 'Clear Chat')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); setDeleteChatConfirm({key: p.dmTarget, type: 'dm', name: p.dmTarget}); }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                          <Trash2 size={16}/> {t('deleteChat', 'Delete Chat')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {(() => {
                  const soonCount = countSoonExpiringMedia(dmMessages, dmExpiryKey);
                  if (!soonCount) return null;
                  return (
                    <ExpiryReminderBanner
                      count={soonCount}
                      isLight={isLight}
                      onGotIt={() => { dismissExpiryBanner12h(dmExpiryKey); p.bumpExpiryBannerTick?.(); }}
                      onRemindLater={() => { snoozeExpiryBannerUntilClose(dmExpiryKey); p.bumpExpiryBannerTick?.(); }}
                      onClose={() => { snoozeExpiryBannerUntilClose(dmExpiryKey); p.bumpExpiryBannerTick?.(); }}
                    />
                  );
                })()}
                <div
                  ref={dmScrollContainerRef}
                  className="no-scrollbar"
                  onScroll={(e) => {
                    handleScroll(e);
                    const el = e.currentTarget;
                    const partnerKey = p.dmTarget?.toLowerCase();
                    const hasMore = p.hasMoreDmHistory && p.hasMoreDmHistory[partnerKey] !== false;
                    if (el.scrollTop < 50 && p.loadMoreDmHistory && !p.dmHistoryLoading && hasMore) {
                      dmScrollAnchorRef.current = {
                        prevScrollHeight: el.scrollHeight,
                        prevScrollTop: el.scrollTop
                      };
                      p.loadMoreDmHistory(el);
                    }
                  }} 
                  onClick={() => { p.setActiveReactionMsg(null); p.setShowAllEmojis(false); p.setShowGroupEmojiPicker(false); p.setShowDmEmojiPicker(false); setActiveMessageMenu(null); longPress.close(); }} style={{flex:1,overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',padding:10,display:'flex',flexDirection:'column',gap:8, ...((p.chatThemes && p.chatThemes[(p.dmTarget||'').toLowerCase()] && p.chatThemes[(p.dmTarget||'').toLowerCase()] !== 'default') ? { background: isLight ? '#ffffff' : '#0a0a0a' } : {})}}>
                  {p.dmHistoryLoading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', flexShrink: 0 }}>
                      <Loader2 size={20} style={{ color: 'var(--brand-1)', animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                  {(p.dmThreads[p.dmTarget?.toLowerCase()]||[]).length===0 && (
                    p.dmHistoryReady ? (
                      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:6}}>
                        <Lock size={28} opacity={0.2}/><p style={{margin:0,fontSize:12}}>Start a private conversation</p>
                      </div>
                    ) : (
                      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><Loader2 size={24} style={{ color: 'var(--brand-1)', animation: 'spin 1s linear infinite' }} /></div>
                    )
                  )}
                  {(() => {
                    const dmMessages = p.dmThreads[p.dmTarget?.toLowerCase()] || [];
                    const effectiveDmSeenMap = getEffectiveSeenBy(dmMessages, p.username);
                    const dmMediaRunsInfo = groupMediaRuns(dmMessages);
                    // A "seen" event can land on any message in a media batch (whichever one
                    // the reader's client happened to report), not necessarily the head — but
                    // only the head row ever renders a receipt. Merge readers from every
                    // message in the run onto the head's own lookup key so none get lost.
                    for (const [, runMsgs] of dmMediaRunsInfo.heads.entries()) {
                      const headMsg = runMsgs[0];
                      const headMapKey = String(headMsg.id || headMsg.timestamp);
                      const merged = new Map();
                      for (const rm of runMsgs) {
                        const readers = effectiveDmSeenMap.get(String(rm.id || rm.timestamp)) || [];
                        for (const r of readers) merged.set(r.username.toLowerCase(), r);
                      }
                      if (merged.size > 0) effectiveDmSeenMap.set(headMapKey, Array.from(merged.values()));
                    }
                    // A media-batch's non-head rows render null, so the "last message" for
                    // read-receipt purposes must resolve to the batch's head row (the one
                    // that actually renders), not the raw last index.
                    let lastDMRenderIdx = dmMessages.length - 1;
                    while (lastDMRenderIdx >= 0) {
                      const lm = dmMessages[lastDMRenderIdx];
                      const lrk = lm.tempId || lm.id || lastDMRenderIdx;
                      if (!dmMediaRunsInfo.memberKeys.has(lrk)) break;
                      lastDMRenderIdx--;
                    }
                    const lastDMMsg = dmMessages[lastDMRenderIdx];
                    const isLastDMSentByMe = lastDMMsg && (lastDMMsg.isMe || (lastDMMsg.username && lastDMMsg.username.toLowerCase() === p.username?.toLowerCase()) || (lastDMMsg.senderName && lastDMMsg.senderName.toLowerCase() === p.username?.toLowerCase()));
                    const renderDMReceiptIndex = isLastDMSentByMe ? lastDMRenderIdx : -1;
                    const dmThemeId = (p.chatThemes && p.chatThemes[(p.dmTarget||'').toLowerCase()]) || 'default';
                    const dmTheme = CHAT_THEMES.find(th => th.id === dmThemeId) || CHAT_THEMES[0];
                    const isDMCustomTheme = dmThemeId !== 'default';
                    const dmNoticeRuns = groupNoticeRuns(dmMessages);
                    return dmMessages.map((msg,i)=>{
                    if (msg.isNotice) {
                      const isMeChange = msg.isMe;
                      const noticeRowKey = msg.tempId || msg.id || i;
                      const noticeRunInfo = dmNoticeRuns.get(noticeRowKey);
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
                              onClick={() => p.openChatThemeSheet({ type: 'private', partner: p.dmTarget })}
                              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-1-light)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {t('changeTheme', 'Change theme')}
                            </button>
                          </div>
                        </div>
                      );

                      if (!noticeRunInfo) return noticeLine(noticeRowKey);

                      const isExpanded = expandedNoticeRuns.has(noticeRunInfo.headKey);
                      if (!isExpanded) {
                        if (!noticeRunInfo.isHead) return null;
                        return (
                          <div key={noticeRowKey} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                            <button
                              onClick={() => setExpandedNoticeRuns(prev => new Set(prev).add(noticeRunInfo.headKey))}
                              style={{
                                background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
                                color: isLight ? '#475569' : '#9ca3af', fontSize: 12, fontWeight: 600,
                                border: 'none', padding: '6px 14px', borderRadius: 14, cursor: 'pointer',
                              }}
                            >
                              {t('themeChangedNTimes', 'Theme changed {{n}} times', { n: noticeRunInfo.runLength })} · <span style={{ color: 'var(--brand-1-light)', fontWeight: 700 }}>{t('seeUpdates', 'See updates')}</span>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <React.Fragment key={noticeRowKey}>
                          {noticeLine(undefined)}
                          {noticeRunInfo.isLast && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 6px' }}>
                              <button
                                onClick={() => setExpandedNoticeRuns(prev => { const next = new Set(prev); next.delete(noticeRunInfo.headKey); return next; })}
                                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-1-light)', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                {t('hideUpdates', 'Hide updates')}
                              </button>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    }
                    const rowKey = msg.tempId || msg.id || i;
                    if (dmMediaRunsInfo.memberKeys.has(rowKey)) return null;
                    const mediaGroupItems = dmMediaRunsInfo.heads.get(rowKey) || null;
                    const isMe = msg.isMe || (msg.username && msg.username.toLowerCase() === p.username?.toLowerCase()) || (msg.senderName && msg.senderName.toLowerCase() === p.username?.toLowerCase());
                    const reactions = msg.reactions||{};
                    const prevMsg = i > 0 ? dmMessages[i - 1] : null;
                    const showDateSep = !prevMsg || getDateKey(prevMsg.timestamp) !== getDateKey(msg.timestamp);
                    const resolvedMedia = (p.dmDecryptedMediaUrls?.current && (
                      p.dmDecryptedMediaUrls.current[msg.id] ||
                      p.dmDecryptedMediaUrls.current[msg.tempId] ||
                      p.dmDecryptedMediaUrls.current[String(msg.timestamp)]
                    )) || msg._localMediaUrl || ((msg.mediaUrl && msg.mediaUrl.startsWith('blob:')) ? msg.mediaUrl : (msg.nonce ? null : msg.mediaUrl));
                    const isDecryptingDm = !resolvedMedia && !!msg.nonce && !!msg.mediaType && (Date.now() - Number(msg.timestamp)) < 30000;
                    const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
                    const swipeHandlers = swipe.getHandlers(rowKey, isMe ? 'left' : 'right', () => p.setDmReplyTo(msg));
                    const longPressHandlers = longPress.getHandlers(rowKey);
                    const rowSelectHandlers = rowSelectLongPress.getHandlers(rowKey);
                    const gestureHandlers = {
                      // See the group-chat gestureHandlers above for why the
                      // '.long-press-menu' guard is needed.
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
                          <span style={{fontSize:11,color: isLight ? '#64748b' : '#888',whiteSpace:'nowrap',padding:'0 4px'}}>{formatDateSeparator(msg.timestamp)}</span>
                          <div style={{flex:1,height:1,background:'rgba(128,128,128,0.25)'}}/>
                        </div>
                      )}
                      <div id={`dm-msg-${msg.id || msg.tempId || i}`} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4, position: 'relative', zIndex: (showLongPressMenu || activeMessageMenu === msg.id) ? 50 : undefined, background: (msgSelectMode && selectedMsgIds.has(rowKey)) ? (isLight ? 'rgba(var(--brand-1-rgb),0.10)' : 'rgba(var(--brand-1-rgb),0.18)') : 'transparent', borderRadius: 12, padding: (msgSelectMode && selectedMsgIds.has(rowKey)) ? '4px 0' : 0, transition: timestampPeek.isPeeking ? 'background 0.15s ease' : 'background 0.15s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1)', transform: `translateX(${timestampPeek.dragX}px)`}}
                           onTouchStart={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchStart(e); timestampPeek.onTouchStart(e); } }}
                           onTouchMove={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchMove(e); timestampPeek.onTouchMove(e); } }}
                           onTouchEnd={(e) => { if (e.target === e.currentTarget) { rowSelectHandlers.onTouchEnd(e); timestampPeek.onTouchEnd(e); } }}>
                        <div style={{ position:'absolute', top:0, bottom:0, right: -(timestampPeek.PEEK_WIDTH + 20), width: 60, overflow: 'hidden', display:'flex', alignItems:'center', fontSize:11, color: isLight ? '#64748b' : '#94a3b8', pointerEvents:'none', whiteSpace:'nowrap' }}>
                          {formatTime(msg.timestamp)}
                        </div>
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
                          <div onClick={() => { const el = document.getElementById(`dm-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(var(--brand-1-rgb),0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'var(--brand-1)':'var(--brand-2)'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%',cursor:'pointer'}}>
                            <span style={{color:'var(--brand-1)',fontWeight:600}} className="reply-sender">
                              {(() => { const n = msg.replyTo.username || msg.replyTo.senderName || msg.replyTo.targetName; const isRepBlocked = blockingMe.some(u => u.toLowerCase() === (n||'').toLowerCase()); return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); })()}: 
                            </span> {(() => {
                              const raw = msg.replyTo.message || '';
                              if (msg.replyTo.mediaType) { const rmt2=msg.replyTo.mediaType; return rmt2.startsWith('video')?'Video':rmt2.startsWith('image')?'Photo':rmt2.startsWith('audio')?'Voice Note':(msg.replyTo.mediaFileName || msg.replyTo._fileName || 'File'); }
                              if (msg.replyTo.decryptedText) return msg.replyTo.decryptedText.slice(0,60);
                              if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                              return raw.slice(0,60) || 'Message';
                            })()}
                          </div>
                        )}
                        <div style={{display:'flex',alignItems:'center',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'85%'}}>
                          {!isMe && (() => {
                            const rName = msg.senderName || msg.username;
                            const partner = (rName || '').toLowerCase();
                            const isSenderBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner);
                            const displayUsername = isSenderBlocked ? 'User' : rName;
                            const uObj = p.userList.find(u => u.username === rName);
                            const fallbackMsgAvatar = msg.senderAvatar || p.knownAvatars?.[rName] || p.knownAvatars?.[rName.toLowerCase()] || uObj?.avatarPath;
                            const avatarSrc = isSenderBlocked ? null : getAvatarUrl(fallbackMsgAvatar);
                            return <span onClick={() => !isSenderBlocked && navigate(`/profile/${rName}`)} title={isSenderBlocked ? 'Blocked User' : `View ${rName}'s profile`} style={{cursor:isSenderBlocked?'default':'pointer'}}><Avatar name={displayUsername} size={28} src={avatarSrc}/></span>;
                          })()}
                          <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                            <div style={{position:'relative', display:'flex', alignItems:'center'}}
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
                              <div className={isMe ? 'msg-sent stay-white' : 'msg-received'} style={{
                                position: 'relative',
                                zIndex: 2,
                                background: isMediaOnly ? 'transparent' : (isMe ? (isDMCustomTheme ? dmTheme.gradient : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))') : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.1)')),
                                ...(isMe && isDMCustomTheme && !isMediaOnly ? {
                                  backgroundSize: `100% ${Math.max(dmMessages.length, 1) * CHAT_THEME_BUBBLE_STRIDE}px`,
                                  backgroundPosition: `0 -${i * CHAT_THEME_BUBBLE_STRIDE}px`,
                                } : {}),
                                padding: isMediaOnly ? '0' : '8px 12px',
                                borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',
                                fontSize:14,
                                color: isMe ? '#fff' : (isLight ? '#111827' : '#ddd'),
                                maxWidth:'100%',
                                wordBreak:'break-word',
                                transform: `translateX(${rowDragX}px)`,
                                transition: rowDragging ? 'none' : (rowBounce ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.2s ease'),
                                display: isMediaOnly ? 'block' : 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'flex-end',
                                columnGap: 6
                              }}
                              onMouseEnter={() => setHoveredMsgId(msg.id||i)}
                              onMouseLeave={() => setHoveredMsgId(null)}>
                                <div style={{ flex: isMediaOnly ? undefined : '0 1 auto', minWidth: 0 }}>
                                  {!msg.mediaType && msg.forwarded && (
                                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontStyle:'italic', opacity:0.75, marginBottom:2 }}>
                                      <Forward size={11} /> Forwarded
                                    </div>
                                  )}
                                  {(!msg.mediaType && !msg.message && !msg.e2ee && !msg.nonce) ? (
                                    <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, fontStyle:'italic'}}>{t('messageUnavailable', '[Message unavailable]')}</div>
                                  ) : (msg.decryptedText !== null && msg.decryptedText?.startsWith(CALL_LOG_PREFIX)) ? (
                                    (() => {
                                      let callData = null;
                                      try { callData = JSON.parse(msg.decryptedText.slice(CALL_LOG_PREFIX.length)); } catch {}
                                      if (!callData) return <MessageText text="Call" isMe={isMe} />;
                                      return (
                                        <CallLogBubble
                                          data={callData}
                                          isMe={isMe}
                                          myUsername={p.username}
                                          onRedial={p.dmTarget && !call.callState ? () => call.startCall(p.dmTarget, callData.callType) : undefined}
                                        />
                                      );
                                    })()
                                  ) : msg.decryptedText !== null ? (
                                    <MessageText text={msg.decryptedText} isMe={isMe} />
                                  ) : (
                                    (!msg.mediaType && (msg.nonce || msg.e2ee || (msg.message && looksLikeCiphertext(msg.message)))) ? (
                                      <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                                    ) : (
                                      !msg.mediaType && msg.message && <MessageText text={msg.message} isMe={isMe} />
                                    )
                                  )}
                                </div>
                                {!isMediaOnly && isMe && (
                                  <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingBottom: 1 }}>
                                    <MessageTick msg={msg} username={p.username} isLight={isLight} />
                                  </div>
                                )}
                                {mediaGroupItems ? (
                                  <MediaGrid
                                    items={mediaGroupItems}
                                    forwarded={msg?.forwarded}
                                    expiresAt={msg.mediaExpiresAt}
                                    tick={isMe ? <MessageTick msg={msg} username={p.username} isLight={isLight} /> : null}
                                    resolveUrl={(it) => resolveDecryptedUrl(it, p.dmDecryptedMediaUrls)}
                                    onOpenItem={(it, url) => openLightboxAt(url, it.mediaType, p.dmThreads[p.dmTarget?.toLowerCase()] || [], p.dmDecryptedMediaUrls)}
                                  />
                                ) : renderMedia(resolvedMedia, msg.mediaType, isMe, msg._fileName || msg.mediaFileName, msg._fileSize || msg.mediaFileSize, msg.mediaExpiresAt, p.dmThreads[p.dmTarget?.toLowerCase()] || [], p.dmDecryptedMediaUrls, isDecryptingDm, msg)}
                                
                                {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                                  <div className="msg-hover-menu" style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                    <button
                                      className={(isLight && msg.mediaType) ? 'stay-white' : ''}
                                      ref={activeMessageMenu === msg.id ? messageMenuRef : null}
                                      onClick={(e)=>{ e.stopPropagation(); if (activeMessageMenu !== msg.id) setDropdownPlacement((window.innerHeight - e.clientY) < 240 ? 'up' : 'down'); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); p.setShowDmMenu(null); p.setShowAllEmojis(false); p.setActiveReactionMsg(null); }} style={{background: (isLight && msg.mediaType) ? 'rgba(0,0,0,0.45)' : (isMediaOnly ? 'rgba(0,0,0,0.35)' : (isMe ? 'rgba(255,255,255,0.15)' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'))),backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: (isLight && msg.mediaType) ? '#fff' : (isMediaOnly ? '#fff' : (isMe ? '#fff' : (isLight ? '#374151' : '#fff'))), WebkitTextFillColor: (isLight && msg.mediaType) ? '#fff' : (isMediaOnly ? '#fff' : (isMe ? '#fff' : (isLight ? '#374151' : '#fff'))),padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                      <ChevronDown size={14}/>
                                    </button>
                                    {activeMessageMenu === msg.id && (
                                      <div className="menu-dropdown" style={{
                                        position:'absolute',
                                        [dropdownPlacement === 'up' ? 'bottom' : 'top']: '100%',
                                        [dropdownPlacement === 'up' ? 'marginBottom' : 'marginTop']: 4,
                                        // Same overflow fix as the group dropdown above — anchor to the
                                        // right (grow leftward) for media bubbles too, not just isMe.
                                        [(isMe || isMediaOnly) ? 'right' : 'left']:0,
                                        background: 'var(--dropdown-bg)',
                                        border: '1px solid var(--dropdown-border)',
                                        borderRadius:12, padding:6, zIndex:100,
                                        boxShadow: 'var(--dropdown-shadow)', minWidth: 160
                                      }} onClick={e => e.stopPropagation()}>
                                        {!!getMessageCopyText(msg) && (
                                          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); copyMessageText(msg); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn">
                                            <Copy size={16}/> {t('copy', 'Copy')}
                                          </button>
                                        )}
                                        {isMe ? (
                                          <>
                                            {isMessageEditable(msg) && (
                                              <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.setDmReplyTo(null); p.setDmEditingMessage(msg); p.setDmChatInput(getMessageCopyText(msg)); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn">
                                                <Edit2 size={16}/> {t('edit', 'Edit')}
                                              </button>
                                            )}
                                            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
                                              <Trash2 size={16}/> {t('unsend', 'Unsend')}
                                            </button>
                                            <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-del-me">
                                              <Trash2 size={16}/> {t('deleteForMe', 'Delete for me')}
                                            </button>
                                          </>
                                        ) : (
                                          <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
                                            <Trash2 size={16}/> {t('delete', 'Delete')}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {p.activeReactionMsg === msg.id && !p.showAllEmojis && (
                                  <div className="emoji-picker-container" style={{position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8, zIndex:100}}>
                                    <div style={{
                                      background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,26,46,0.95)',
                                      backdropFilter:'blur(12px)',
                                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                      borderRadius:30,
                                      padding:'6px 8px',
                                      display:'flex',
                                      alignItems:'center',
                                      gap:6,
                                      width:'max-content',
                                      boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 8px 24px rgba(0,0,0,0.6)'
                                    }}>
                                      {QUICK_EMOJIS.map(em=>(
                                        <button key={em} onClick={(e)=>{e.stopPropagation(); p.handleDmReact(msg.id || msg.timestamp, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} className="menu-btn" onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                      ))}
                                      <button className="reaction-plus-trigger" onClick={(e)=>{e.stopPropagation(); p.setActiveReactionMsg(msg.id); p.setShowAllEmojis(true);}} style={{background: isLight ? '#d1d5db' : '#e2e8f0',border: isLight ? '1px solid #9ca3af' : '1px solid #cbd5e1',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#000',WebkitTextFillColor:'#000',transition:'background 0.2s'}} onMouseEnter={(e)=>{e.currentTarget.style.background= isLight ? '#b8bfc9' : '#f8fafc'}} onMouseLeave={(e)=>{e.currentTarget.style.background= isLight ? '#d1d5db' : '#e2e8f0'}}><Plus size={16} color="#000" style={{ color: '#000', WebkitTextFillColor: '#000' }}/></button>
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
                                        <button key={em} onClick={(e)=>{ e.stopPropagation(); p.handleDmReact(msg.id || msg.timestamp, em); longPress.close(); }} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,padding:4,borderRadius:8}} className="menu-btn">{em}</button>
                                      ))}
                                      <button onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(msg.id); p.setShowAllEmojis(true); longPress.close(); }} style={{background: isLight ? '#d1d5db' : '#e2e8f0',border:'none',cursor:'pointer',width:30,height:30,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
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
                                          <button onClick={() => { p.setDmReplyTo(null); p.setDmEditingMessage(msg); p.setDmChatInput(getMessageCopyText(msg)); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                            <Edit2 size={14}/> {t('edit', 'Edit')}
                                          </button>
                                        )}
                                        <button onClick={() => { p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                          <Trash2 size={14}/> {t('unsend', 'Unsend')}
                                        </button>
                                        <button onClick={() => { p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); longPress.close(); }} style={{background:'none',border:'none',color: 'var(--menu-item-text)',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                          <Trash2 size={14}/> {t('deleteForMe', 'Delete for me')}
                                        </button>
                                      </>
                                    ) : (
                                      <button onClick={() => { p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); longPress.close(); }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:8,fontSize:13}}>
                                        <Trash2 size={14}/> {t('delete', 'Delete')}
                                      </button>
                                    )}
                                  </div>
                                )}
                                {!blockingMe.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && (
                                  <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: p.activeReactionMsg === msg.id ? 1 : undefined, transition:'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className="react-btn-container">
                                    <button className="react-btn" onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(p.activeReactionMsg===msg.id?null:msg.id); p.setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: isLight ? '#6b7280' : '#9ca3af',padding:'3px 5px',transition:'color 0.15s'}} onMouseEnter={(e)=>{e.currentTarget.style.color= isLight ? '#111' : '#fff'}} onMouseLeave={(e)=>{e.currentTarget.style.color= isLight ? '#6b7280' : '#9ca3af'}}>
                                      <SmilePlus size={16}/>
                                    </button>
                                  </div>
                                )}
                            </div>
                            <div className="msg-meta-row" style={{display:'flex',alignItems:'center',gap:6,minWidth:0,width:'100%',alignSelf:'stretch'}}>
                              {(() => { if (!msg.mediaExpiresAt) return null; const mt = msg.mediaType || ''; return null; })()}
                              <span style={{flex:1}}></span>
                              {msg.edited && <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa',flexShrink:0}}>{t('edited', 'Edited')}</span>}
                              <span style={{fontSize:10,color: isLight ? 'rgba(0,0,0,0.62)' : '#aaa',flexShrink:0}}>{formatTime(msg.timestamp)}</span>
                              {!blockingMe.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && (
                                <button onClick={()=>p.setDmReplyTo(msg)} style={{background:'none',border:'none',color: isLight ? '#555' : '#aaa',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3,flexShrink:0}}><Reply size={10}/>Reply</button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4, paddingLeft: isMe ? 0 : 36}}>
                          {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                            <button key={emoji} onClick={()=>p.handleDmReact(msg.id || msg.timestamp, emoji)} style={{background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(p.username)?'var(--brand-1)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color: isLight ? '#1e293b' : '#ddd'}}>
                              {emoji} {uids.length}
                            </button>
                          ))}
                        </div>
                        {i === renderDMReceiptIndex && (
                          <ReadReceipt 
                            msg={{
                              ...msg,
                              seenBy: effectiveDmSeenMap.get(String(msg.id || msg.timestamp)) || []
                            }}
                            isGroup={false} 
                            username={p.username} 
                            userList={p.userList} 
                            socketServerUrl={p.SOCKET_SERVER_URL} 
                            isLight={isLight}
                          />
                        )}
                      </div>
                      </React.Fragment>
                    )
                  })})()}
                  {(() => {
                    const dmKey = p.dmTarget?.toLowerCase();
                    const typers = p.typingStatuses?.[dmKey];
                    if (!typers || typers.length === 0) return null;
                    return (
                      <div style={{color:'#10b981',fontSize:12,marginTop:4,marginBottom:4,paddingLeft:4}}>
                        {[...typers].join(', ')} typing...
                      </div>
                    );
                  })()}
                  <div ref={p.messagesEndRef}/>
                </div>
                <div style={{padding:'10px 12px',borderTop:'1px solid var(--room-border)',flexShrink:0,position:'relative'}}>
                  {p.dmReplyTo && (
                    <div style={{padding:'6px 12px',marginBottom:6,background: isLight ? 'rgba(var(--brand-1-rgb),0.04)' : 'rgba(var(--brand-1-rgb),0.08)',borderTop:'1px solid rgba(var(--brand-1-rgb),0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color: isLight ? '#64748b' : '#a0aab2'}}>
                      <span><span style={{color:'var(--brand-1)',fontWeight:600}}>
                        {(() => { const n = p.dmReplyTo.username || p.dmReplyTo.senderName || p.dmReplyTo.targetName; const isRepBlocked = blockingMe.some(u => u.toLowerCase() === (n||'').toLowerCase()); return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); })()}: 
                      </span> {(() => {
                        const r = p.dmReplyTo;
                        if (r.mediaType) { const rmt4=r.mediaType; return rmt4.startsWith('video')?'Video':rmt4.startsWith('image')?'Photo':rmt4.startsWith('audio')?'Voice Note':(r._fileName || r.mediaFileName || 'File'); }
                        if (r.decryptedText) return r.decryptedText.slice(0,50);
                        return (r.message||'').slice(0,50) + ((r.message||'').length > 50 ? '...' : '');
                      })()}</span>
                      <button onClick={()=>p.setDmReplyTo(null)} style={{background:'none',border:'none',color:'var(--brand-1)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center'}}>&times;</button>
                    </div>
                  )}
                  {p.dmEditingMessage && (
                    <div style={{padding:'6px 12px',marginBottom:6,background: isLight ? 'rgba(56,189,248,0.05)' : 'rgba(56,189,248,0.08)',borderTop:'1px solid rgba(56,189,248,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color: isLight ? '#64748b' : '#a0aab2'}}>
                      <span style={{display:'flex',alignItems:'center',gap:6}}><Edit2 size={12} color="#38bdf8"/><span style={{color:'#38bdf8',fontWeight:600}}>{t('editingMessage', 'Editing message')}</span></span>
                      <button onClick={()=>{ p.setDmEditingMessage(null); p.setDmChatInput(''); }} style={{background:'none',border:'none',color:'var(--brand-1)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center'}}>&times;</button>
                    </div>
                  )}

                  {(() => {
                    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
                    if (isGuest) {
                      return (
                        <div className="blocked-banner-v2" onClick={() => navigate('/login')} style={{
                          background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', 
                          border: '1px solid var(--room-border)', 
                          borderRadius: 16, 
                          padding: '16px 20px', 
                          textAlign: 'center',
                          margin: '16px',
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
                      );
                    }

                    const didIBlock = blockedChats.some(u => u.toLowerCase() === (p.dmTarget||'').toLowerCase());
                    const amIBlocked = blockingMe.some(u => u.toLowerCase() === (p.dmTarget||'').toLowerCase());

                    if (didIBlock || amIBlocked) {
                      return (
                        <div className="blocked-banner-v2" style={{
                          background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', 
                          border: '1px solid var(--room-border)', 
                          borderRadius: 16, 
                          padding: '16px 20px', 
                          textAlign: 'center',
                          margin: '16px',
                          marginBottom: 4
                        }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <Ban size={18} color="#ef4444" />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#1e293b' : '#fff', marginBottom: 4 }}>
                            {didIBlock ? 'You blocked this person' : "You can't message this person right now"}
                          </div>
                          <p style={{ fontSize: 11, color: isLight ? '#64748b' : '#888', margin: 0, lineHeight: 1.5 }}>
                            {didIBlock 
                              ? 'Unblock them in your account settings to send messages.' 
                              : 'This user is currently unavailable.'}
                          </p>
                        </div>
                      );
                    }

                    // While fetching relation, show a neutral loading state — never show the input prematurely
                    if (dmRelationLoading) {
                      return (
                        <div style={{ padding: '16px 20px', textAlign: 'center', color: '#555', fontSize: 12 }}>
                          Checking permissions...
                        </div>
                      );
                    }

                    // Friendship required — not mutual followers
                    const areFriends = dmRelation && dmRelation.followStatus === 'accepted' && dmRelation.isFollowingMe;
                    if (dmRelation && !areFriends) {
                      return (
                        <div className="blocked-banner-v2" style={{
                          background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', 
                          border: '1px solid var(--room-border)', 
                          borderRadius: 16, 
                          padding: '16px 20px', 
                          textAlign: 'center',
                          margin: '16px',
                          marginBottom: 4
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#1e293b' : '#fff', marginBottom: 4 }}>
                            {t('friendshipRequired', 'Friendship Required')}
                          </div>
                          <p style={{ fontSize: 11, color: isLight ? '#64748b' : '#888', margin: 0, lineHeight: 1.5 }}>
                            {t('needMutualFollow', 'You need to follow each other to start messaging.')}
                          </p>
                          <button type="button" className="stay-white" onClick={() => navigate(`/profile/${p.dmTarget}`)} style={{ display: 'inline-block', marginTop: 12, padding: '8px 20px', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', color: '#fff !important', borderRadius: 10, textDecoration: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(var(--brand-1-rgb),0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(var(--brand-1-rgb),0.4)'; e.currentTarget.style.filter = 'brightness(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--brand-1-rgb),0.2)'; e.currentTarget.style.filter = 'brightness(1)'; }}>
                            {t('viewProfile', 'View Profile')}
                          </button>
                        </div>
                      );
                    }

                    if (isRecording && recordingFor === 'dm') return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 12px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, minWidth: 28, letterSpacing: '0.5px' }}>{formatRecordingTime(recordingTime)}</span>
                        <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', height: 22, overflow: 'hidden' }}>
                          {waveHeights.map((h, i) => (
                            <div key={i} style={{ width: 3, borderRadius: 3, background: 'linear-gradient(to top, var(--brand-1), var(--brand-2))', flexShrink: 0, height: `${h}%`, transition: 'height 0.08s ease', minHeight: 3 }} />
                          ))}
                        </div>
                        <button type="button" className="voice-trash-btn" onClick={cancelRecording} title="Delete Recording"><Trash2 size={14} /></button>
                        <button className="stay-white" type="button" onClick={stopRecording} style={{ background: 'var(--brand-1)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                          <Check size={11} color="#fff" strokeWidth={2.5} /> <span className="stay-white" style={{ color: '#fff' }}>Done</span>
                        </button>
                      </div>
                    );
                    if (!isRecording && audioBlob && audioUrl && recordingFor === 'dm') return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? 'rgba(var(--brand-1-rgb),0.07)' : 'rgba(var(--brand-1-rgb),0.1)', border: '1px solid rgba(var(--brand-1-rgb),0.25)', borderRadius: 10, padding: '8px 12px' }}>
                        <Music size={14} color="var(--brand-2)" style={{ flexShrink: 0 }} />
                        <audio src={audioUrl} controls style={{ height: 24, flex: 1 }} />
                        <button type="button" className="voice-trash-btn" onClick={cancelRecording} title="Delete Recording"><Trash2 size={14} /></button>
                        <button className="stay-white" type="button" onClick={sendVoiceNote} disabled={isUploading} style={{ background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                          {isUploading ? <Loader2 size={11} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={11} color="#fff" /> <span className="stay-white" style={{ color: '#fff' }}>Send</span></>}
                        </button>
                      </div>
                    );

                    return (
                      <>
                        <form ref={dmFormRef} onSubmit={(e) => {
                          p.sendDmChat(e);
                          p.setShowDmEmojiPicker(false);
                        }} style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                          <input type="file" multiple ref={dmFileInputRef} style={{display:'none'}} accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/mpeg,audio/wav,audio/ogg,audio/m4a" onChange={(e) => handleFileSelect(e, 'dm')} />
                          <textarea
                            className="chat-msg-textarea no-scrollbar"
                            ref={p.dmInputRef}
                            rows={1}
                            value={p.dmChatInput}
                            onChange={e=>{const limited = enforceWordLimit(e.target.value); p.handleChatInputChange(limited, 'private'); p.setDmChatInput(limited);}}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 1024) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                            onFocus={(e) => { p.setShowDmEmojiPicker(false); setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch {} }, 300); }}
                            placeholder={p.userList.some(u => u.username === p.dmTarget) ? t('privateMessage', 'Private message...') : t('offlineMessage', 'Offline message...')}
                            style={{
                              flex:1,
                              resize:'none',
                              maxHeight:120,
                              overflowY:'auto',
                              lineHeight:1.4,
                              fontFamily:'inherit',
                              // Solid opaque fill in dark mode, not a faint tint —
                              // light mode's #f1f5f9 was already opaque.
                              background: isLight ? '#f1f5f9' : '#1c1c1e',
                              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                              borderRadius:10,
                              padding:'8px 12px',
                              paddingRight: (!p.dmChatInput && !isUploading) ? '95px' : '12px',
                              paddingLeft: (isMobileOrTablet && !p.dmChatInput && !isUploading) ? '36px' : '12px',
                              color: isLight ? '#1e293b' : '#fff',
                              fontSize:13,
                              outline:'none',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                          />

                          {(!p.dmChatInput && !isUploading) && (
                            <>
                              {/* Mobile/tablet only: emoji lives on the far left of the box. */}
                              {isMobileOrTablet && (
                                <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                                  <button type="button" className="emoji-btn-dm" onClick={(e) => { e.stopPropagation(); p.setShowDmEmojiPicker(!p.showDmEmojiPicker); }} style={{background:'transparent',border:'none',color: (isLight ? '#64748b' : '#ffffff'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                    <SmilePlus size={18}/>
                                  </button>
                                </div>
                              )}
                              <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 0 }}>
                                {!isMobileOrTablet && (
                                  <button type="button" className="emoji-btn-dm" onClick={(e) => { e.stopPropagation(); p.setShowDmEmojiPicker(!p.showDmEmojiPicker); }} style={{background:'transparent',border:'none',color: (isLight ? '#64748b' : '#ffffff'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                    <SmilePlus size={18}/>
                                  </button>
                                )}
                                <button type="button" disabled={isUploading} onClick={() => dmFileInputRef.current?.click()} style={{background:'transparent',border:'none',color:isUploading?'var(--brand-1)':(isLight ? '#64748b' : '#ffffff'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                  <Paperclip size={18}/>
                                </button>
                                <button type="button" onClick={() => startRecording('dm')} title="Record voice note" style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#ffffff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:1}}>
                                  <Mic size={18}/>
                                </button>
                                {/* Camera — mobile/tablet only, after mic per explicit request */}
                                {isMobileOrTablet && (
                                  <button type="button" onClick={() => setShowDmCamera(true)} title="Open camera" style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#ffffff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                    <Camera size={18}/>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {showDmCamera && (
                            <CameraCapture
                              onCapture={async (file, caption) => {
                                await handleFileSelect({ target: { files: [file], value: null } }, 'dm');
                                if (caption && caption.trim()) {
                                  p.setDmChatInput(caption.trim());
                                  setTimeout(() => dmFormRef.current?.requestSubmit(), 60);
                                }
                              }}
                              onClose={() => setShowDmCamera(false)}
                            />
                          )}

                          {isUploading && (
                            <div style={{ position: 'absolute', right: 10 }}>
                              <Loader2 size={16} className="animate-spin" color="var(--brand-1)" />
                            </div>
                          )}
                        </div>
                        <button type="submit" disabled={!p.dmChatInput.trim() || isUploading} style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,var(--brand-1),var(--brand-2))',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(!p.dmChatInput.trim()||isUploading)?0.5:1, flexShrink: 0}}>
                          <Send size={14} color="#fff"/>
                        </button>
                      </form>
                      </>
                    );
                  })()}
                </div>
              </>
              );
            })() : (
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:8}}>
                <MessageSquare size={36} opacity={0.2}/><p style={{margin:0,fontSize:13}}>Select a user to start a private chat</p>
              </div>
            )}
        </div>
      )}

      {/* Group Emoji Picker — positioned at panel level so it isn't clipped by overflow:hidden */}
      {p.showGroupEmojiPicker && (
        <div className="emoji-picker-container" style={{position:'absolute', bottom: 72, left: 8, zIndex: 99999, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.8)', borderRadius:10}} onMouseDown={e => e.stopPropagation()}>
          <Picker
            data={data}
            onEmojiSelect={(e) => { p.setGroupChatInput(prev => prev + e.native); }}
            theme={isLight ? 'light' : 'dark'}
            previewPosition="none"
            searchPosition="sticky"
            navPosition="bottom"
            perLine={7}
          />
        </div>
      )}

      {/* DM Emoji Picker — panel level, not inside overflow:hidden */}
      {p.showDmEmojiPicker && (
        <div className="emoji-picker-container" style={{position:'absolute', bottom: 72, left: 8, zIndex: 99999, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.8)', borderRadius:10}} onMouseDown={e => e.stopPropagation()}>
          <Picker
            data={data}
            onEmojiSelect={(e) => { p.setDmChatInput(prev => prev + e.native); }}
            theme={isLight ? 'light' : 'dark'}
            previewPosition="none"
            searchPosition="sticky"
            navPosition="bottom"
            perLine={7}
          />
        </div>
      )}

      {/* Global (Reaction) Emoji Picker */}
      {p.showAllEmojis && p.activeReactionMsg && (
        <div className="emoji-picker-container" style={{position:'absolute', bottom: 84, right: 16, zIndex: 99999, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.8)', borderRadius:10, transform: 'scale(0.95)', transformOrigin: 'bottom right'}} onClick={e=>e.stopPropagation()}>
          <Picker 
            data={data} 
            theme={isLight ? 'light' : 'dark'} 
            previewPosition="none" 
            searchPosition="sticky" 
            navPosition="bottom" 
            perLine={6} 
            onEmojiSelect={(emojiObj) => { 
              p.setShowAllEmojis(false);
              if (p.chatTab === 'group') p.handleGroupReact(p.activeReactionMsg, emojiObj.native);
              else p.handleDmReact(p.activeReactionMsg, emojiObj.native);
              p.setActiveReactionMsg(null);
            }}
          />
        </div>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollArrow && p.chatTab !== 'list' && (
        <div 
          onClick={(e) => { e.stopPropagation(); scrollToBottom(); }}
          style={{
            position: 'absolute',
            bottom: 85,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
            borderRadius: '50%',
            width: 42,
            height: 42,
            cursor: 'pointer',
            zIndex: 9999,
            boxShadow: '0 0 20px rgba(var(--brand-1-rgb), 0.4), 0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            border: '2px solid rgba(255,255,255,0.15)',
            animation: 'msg-enter 0.4s ease forwards'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)'; e.currentTarget.style.boxShadow = '0 0 25px rgba(var(--brand-1-rgb), 0.6), 0 6px 15px rgba(0,0,0,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(var(--brand-1-rgb), 0.4), 0 4px 12px rgba(0,0,0,0.5)'; }}
        >
          <ArrowDown color="white" size={22} />
        </div>
      )}

    </div>
    
      {/* Bulk delete confirmation for multi-selected messages */}
      {bulkDeleteConfirm && (() => {
        const selected = getSelectedMessages(activeSelectionList());
        const allMine = selected.length > 0 && selected.every(m => m.isMe || (m.senderName || m.username || '').toLowerCase() === p.username?.toLowerCase());
        return (
          <div style={{position:'fixed',inset:0,zIndex:99999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)'}} className="room-modals-overlay">
            <div style={{background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.5)'}}>
              <h3 style={{marginTop:0,color: isLight ? '#0f172a' : '#fff',fontSize:22,fontWeight:900,marginBottom:16}}>Delete {selectedMsgIds.size} message{selectedMsgIds.size === 1 ? '' : 's'}?</h3>
              <p style={{color: isLight ? 'rgba(0,0,0,0.6)' : '#aaa',fontSize:15,marginBottom:24,lineHeight:1.6}}>
                {allMine ? 'You can delete these just for you, or unsend them for everyone.' : 'This only removes them from your own view — you can only unsend your own messages.'}
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {allMine && (
                  <button onClick={() => handleBulkDelete('global')} className="danger-red-btn stay-white" style={{padding:'14px 20px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:14,color:'#fff',cursor:'pointer',fontWeight:800,fontSize:14}}>
                    <span className="stay-white" style={{color: '#fff'}}>Unsend for everyone</span>
                  </button>
                )}
                <button onClick={() => handleBulkDelete('local')} style={{padding:'14px 20px',background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',border: isLight ? '1px solid #e2e8f0' : 'none',borderRadius:14,color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:700,fontSize:14}}>Delete for me</button>
                <button onClick={() => setBulkDeleteConfirm(false)} style={{padding:'14px 20px',background:'transparent',border:'none',borderRadius:14,color: isLight ? '#64748b' : '#888',cursor:'pointer',fontWeight:600,fontSize:14}}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Forward picker — pick up to 5 destination chats for the selected messages */}
      {forwardPickerOpen && (
        <div style={{position:'fixed',inset:0,zIndex:99999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)'}} className="room-modals-overlay">
          <div style={{background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, maxHeight: '80vh', display:'flex', flexDirection:'column', boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.5)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{margin:0,color: isLight ? '#0f172a' : '#fff',fontSize:20,fontWeight:900}}>{t('forwardTo', 'Forward to')}</h3>
              <button onClick={() => setForwardPickerOpen(false)} style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#888',cursor:'pointer',display:'flex'}}><X size={20}/></button>
            </div>
            <p style={{color: isLight ? '#64748b' : '#888', fontSize: 13, marginTop: 0, marginBottom: 12}}>Select up to {MAX_FORWARD_CHATS} chats ({selectedForwardChats.length}/{MAX_FORWARD_CHATS})</p>
            <div style={{flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:4, marginBottom:20}}>
              {forwardChatsLoading ? (
                <div style={{display:'flex',justifyContent:'center',padding:20}}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color={isLight ? '#64748b' : '#888'}/></div>
              ) : (forwardChats || []).map(c => {
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
              className={selectedForwardChats.length > 0 && !forwarding ? 'stay-white' : ''}
              style={{padding:'14px 20px',background: selectedForwardChats.length === 0 || forwarding ? (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)') : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border:'none', borderRadius:14, color: selectedForwardChats.length === 0 || forwarding ? (isLight ? '#94a3b8' : '#666') : '#fff', cursor: selectedForwardChats.length === 0 || forwarding ? 'default' : 'pointer', fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              {forwarding ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />} {forwarding ? 'Sending…' : `Send${selectedForwardChats.length ? ` (${selectedForwardChats.length})` : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Clear Group Chat Modal */}
      {clearGroupChatModalOpen && (
        <div style={{position:'fixed',inset:0,zIndex:99999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)'}} className="room-modals-overlay">
          <div style={{background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.5)'}}>
            <h3 style={{marginTop:0,color: isLight ? '#0f172a' : '#fff',fontSize:22,fontWeight:900,marginBottom:16}}>Clear Chat</h3>
            <p style={{color: isLight ? 'rgba(0,0,0,0.6)' : '#aaa',fontSize:15,marginBottom:28,lineHeight:1.6}}>Are you sure you want to clear your chat history with <strong style={{color: isLight ? '#000' : '#fff'}}>{p.roomName}</strong>?</p>
            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <button onClick={()=>setClearGroupChatModalOpen(false)} style={{padding:'12px 24px',background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',border: isLight ? '1px solid #e2e8f0' : 'none',borderRadius:14,color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:700,fontSize:14, transition: 'all 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>Cancel</button>
              <button onClick={()=>{ 
                if (p.clearRoomChat) p.clearRoomChat(); 
                setClearGroupChatModalOpen(false); 
              }} 
                className="danger-red-btn stay-white"
                style={{padding:'12px 24px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:14,color:'#fff',cursor:'pointer',fontWeight:800,fontSize:14, boxShadow: '0 4px 12px rgba(239,68,68,0.3)', transition: 'all 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <span className="stay-white" style={{color: '#fff'}}>Clear Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {deleteChatConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:99999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)'}} className="room-modals-overlay">
          <div style={{background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.5)'}}>
            <h3 style={{marginTop:0,color: isLight ? '#0f172a' : '#fff',fontSize:22,fontWeight:900,marginBottom:16}}>Delete Chat</h3>
            <p style={{color: isLight ? 'rgba(0,0,0,0.6)' : '#aaa',fontSize:15,marginBottom:28,lineHeight:1.6}}>Are you sure you want to delete your conversation with <strong style={{color: isLight ? '#000' : '#fff'}}>{deleteChatConfirm.name}</strong>? This will remove it from your chat list.</p>
            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <button onClick={()=>setDeleteChatConfirm(null)} style={{padding:'12px 24px',background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',border: isLight ? '1px solid #e2e8f0' : 'none',borderRadius:14,color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:700,fontSize:14, transition: 'all 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>Cancel</button>
              <button onClick={()=>{ 
                handleDeleteChat(deleteChatConfirm.key, deleteChatConfirm.type);
                setDeleteChatConfirm(null); 
              }} 
                className="danger-red-btn stay-white"
                style={{padding:'12px 24px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:14,color:'#fff',cursor:'pointer',fontWeight:800,fontSize:14, boxShadow: '0 4px 12px rgba(239,68,68,0.3)', transition: 'all 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <span className="stay-white" style={{color: '#fff'}}>Delete Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block User Confirmation Modal */}
      {blockUserConfirm && (
        <div className="block-confirm-overlay" style={{position:'fixed',inset:0,zIndex:99999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)'}}>
          <div style={{background: isLight ? '#fff' : '#1a1a2e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.5)'}}>
            <h3 style={{marginTop:0,color: isLight ? '#0f172a' : '#fff',fontSize:22,fontWeight:900,marginBottom:16}}>
              {blockedChats.some(u => u.toLowerCase() === blockUserConfirm.username.toLowerCase()) ? 'Unblock User' : 'Block User'}
            </h3>
            <p style={{color: isLight ? 'rgba(0,0,0,0.6)' : '#aaa',fontSize:15,marginBottom:28,lineHeight:1.6}}>
              {blockedChats.some(u => u.toLowerCase() === blockUserConfirm.username.toLowerCase()) 
                ? `Are you sure you want to unblock ` 
                : `Are you sure you want to block `}
              <strong style={{color: isLight ? '#000' : '#fff'}}>{blockUserConfirm.username}</strong>
              {blockedChats.some(u => u.toLowerCase() === blockUserConfirm.username.toLowerCase()) 
                ? `?` 
                : `? They won't be able to message you.`}
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <button onClick={()=>setBlockUserConfirm(null)} style={{padding:'12px 24px',background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',border: isLight ? '1px solid #e2e8f0' : 'none',borderRadius:14,color: isLight ? '#000' : '#fff',cursor:'pointer',fontWeight:700,fontSize:14, transition: 'all 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>Cancel</button>
              <button onClick={()=>{ 
                toggleBlockUser(blockUserConfirm.username);
                setBlockUserConfirm(null); 
              }} 
                className="danger-red-btn stay-white"
                style={{padding:'12px 24px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:14,color:'#fff',cursor:'pointer',fontWeight:800,fontSize:14, boxShadow: '0 4px 12px rgba(239,68,68,0.3)', transition: 'all 0.2s'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <span className="stay-white" style={{color: '#fff'}}>{blockedChats.some(u => u.toLowerCase() === blockUserConfirm.username.toLowerCase()) ? 'Unblock' : 'Block'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}












