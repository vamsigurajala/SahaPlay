import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import toast from 'react-hot-toast';
import {
  Users, Send, MessageSquare, Reply, Flag, Lock, BellOff, Bell, Pin, Eye,
  X, ChevronLeft, MoreVertical, Edit2, Trash2, MoreHorizontal, SmilePlus, Plus, ArrowDown, ChevronDown, Ban,
  Image as ImageIcon, Paperclip, FilePlus, Loader2, Play, Pause, CheckCheck, Check, Star, Shield, Mic, Download, Music, FileText
} from 'lucide-react';
import { useScrollToBottom } from '../hooks/useScrollToBottom';
import crownImg from '../assets/crown.svg';
import ChatLockScreen from './ChatLockScreen';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

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

function FileTypeIcon({ mimeType, size = 20 }) {
  if (!mimeType) return <Paperclip size={size} color="#888" />;
  if (mimeType === 'application/pdf') return <FileText size={size} color="#ef4444" />;
  if (mimeType.includes('word')) return <FileText size={size} color="#3b82f6" />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText size={size} color="#10b981" />;
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return <FileText size={size} color="#f97316" />;
  if (mimeType === 'application/zip') return <Paperclip size={size} color="#6b7280" />;
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return <FileText size={size} color="#6b7280" />;
  if (mimeType.startsWith('audio/')) return <Music size={size} color="#a855f7" />;
  if (mimeType.startsWith('video/')) return <Play size={size} color="#3b82f6" fill="#3b82f6" />;
  return <Paperclip size={size} color="#888" />;
}

function FileCard({ url, type, fileName, isMe, isLight }) {
  const typeName = type?.split('/').pop()?.toUpperCase() || 'FILE';
  const isExpired = !url;

  const handleDownload = async () => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName || 'download';
      a.click();
    } catch { toast.error('Download failed'); }
  };

  const cardBg = isMe ? 'rgba(255,255,255,0.15)' : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)');
  const cardBorder = isMe ? 'rgba(255,255,255,0.2)' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.09)');
  const fileNameColor = isMe ? '#fff' : (isLight ? '#1e293b' : '#e2e8f0');
  const typeColor = isMe ? 'rgba(255,255,255,0.7)' : (isLight ? '#64748b' : '#888');
  const expiredColor = isMe ? 'rgba(255,255,255,0.5)' : (isLight ? '#94a3b8' : '#666');
  const dlBg = isMe ? 'rgba(255,255,255,0.2)' : (isLight ? 'rgba(30,41,59,0.12)' : 'rgba(99,102,241,0.2)');
  const dlBorder = isMe ? 'rgba(255,255,255,0.3)' : (isLight ? 'rgba(30,41,59,0.22)' : 'rgba(99,102,241,0.3)');
  const dlColor = isMe ? '#fff' : (isLight ? '#334155' : '#a5b4fc');

  return (
    <div style={{ background: cardBg, borderRadius: 10, padding: '10px 14px', minWidth: 160, maxWidth: 220, border: `1px solid ${cardBorder}`, marginTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isExpired ? 0 : 8 }}>
        <FileTypeIcon mimeType={type} size={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: fileNameColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isExpired ? <s style={{ color: expiredColor }}>{fileName || 'File'}</s> : (fileName || 'File')}
          </div>
          <div style={{ fontSize: 10, color: typeColor, marginTop: 1 }}>{typeName}</div>
        </div>
      </div>
      {isExpired
        ? <div style={{ fontSize: 11, color: expiredColor, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Paperclip size={11} color={expiredColor} /> Expired</div>
        : <button onClick={handleDownload} style={{ width: '100%', padding: '4px', borderRadius: 6, background: dlBg, border: `1px solid ${dlBorder}`, color: dlColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Download size={11} color={dlColor} /> Download
          </button>
      }
    </div>
  );
}

function AudioPlayerBubble({ url, isMe, isLight }) {
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const audioRef = React.useRef(null);
  const isExpired = !url;
  const expColor = isMe ? 'rgba(255,255,255,0.5)' : (isLight ? '#94a3b8' : '#666');

  if (isExpired) return (
    <div style={{ padding: '8px 12px', background: isMe ? 'rgba(255,255,255,0.1)' : (isLight ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.06)'), borderRadius: 10, fontSize: 12, color: expColor, display: 'flex', alignItems: 'center', gap: 6 }}>
      <Music size={12} color={expColor} /> Voice note expired
    </div>
  );

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(prev => !prev);
  };
  const fmtDur = (s) => (!s || !isFinite(s) || isNaN(s) || s <= 0) ? null : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const bubbleBg = isMe ? 'rgba(255,255,255,0.15)' : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)');
  const trackBg = isMe ? 'rgba(255,255,255,0.2)' : (isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.15)');
  const metaColor = isMe ? 'rgba(255,255,255,0.7)' : (isLight ? '#64748b' : '#888');
  const durationStr = fmtDur(duration);

  return (
    <div style={{ background: bubbleBg, borderRadius: 10, padding: '8px 12px', minWidth: 160, marginTop: 2 }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={() => audioRef.current && setProgress(audioRef.current.currentTime / (audioRef.current.duration || 1))}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Music size={14} color="#a855f7" style={{ flexShrink: 0 }} />
        <button onClick={toggle} style={{ background: 'rgba(99,102,241,0.35)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {playing ? <Pause size={10} color="#fff" fill="#fff" /> : <Play size={10} color="#fff" fill="#fff" />}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ height: 3, background: trackBg, borderRadius: 2, overflow: 'hidden', cursor: 'pointer' }} onClick={e => { if (!audioRef.current) return; const rect = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; audioRef.current.currentTime = pct * (audioRef.current.duration || 0); }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: '#6366f1', transition: 'width 0.1s linear' }} />
          </div>
          <div style={{ fontSize: 10, color: metaColor, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Voice Note</span>
            {durationStr && <span>{durationStr}</span>}
          </div>
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
    }
    html[data-theme='light'] #room-chat-panel {
      --dropdown-bg: #ffffff;
      --dropdown-border: rgba(0,0,0,0.08);
      --dropdown-shadow: 0 10px 30px rgba(0,0,0,0.1);
      --menu-item-text: #0f172a;
    }

    @keyframes menuFadeIn {
      from { opacity: 0; transform: translateY(10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pulse-red { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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
    .menu-btn:hover {
      background: rgba(99, 102, 241, 0.1) !important;
      color: #6366f1 !important;
      -webkit-text-fill-color: #6366f1 !important;
    }
    .menu-btn:hover svg {
      color: #6366f1 !important;
      -webkit-text-fill-color: #6366f1 !important;
    }
    html[data-theme='light'] .menu-btn:hover {
      background: rgba(99, 102, 241, 0.1) !important;
      color: #4f46e5 !important;
      -webkit-text-fill-color: #4f46e5 !important;
    }
    html[data-theme='light'] .menu-btn:hover svg {
      color: #4f46e5 !important;
      -webkit-text-fill-color: #4f46e5 !important;
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
      background: rgba(99, 102, 241, 0.1) !important;
      color: #4f46e5 !important;
      -webkit-text-fill-color: #4f46e5 !important;
    }
    html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn:hover svg,
    html[data-theme='light'] .stay-white .menu-dropdown .chat-menu-item.menu-btn:hover svg *,
    html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn:hover svg,
    html[data-theme='light'] .msg-sent .menu-dropdown .chat-menu-item.menu-btn:hover svg * {
      color: #4f46e5 !important;
      -webkit-text-fill-color: #4f46e5 !important;
      stroke: #4f46e5 !important;
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
  `}</style>
);

function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false;
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
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
          style={{ color: isMe ? 'rgba(255,255,255,0.9)' : (document.documentElement.getAttribute('data-theme')==='light' ? '#4f46e5' : '#818cf8'), textDecoration: 'underline', wordBreak: 'break-all', cursor: 'pointer', fontWeight: 500 }}
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Media Lightbox Ã¢â€â‚¬Ã¢â€â‚¬
function MediaLightbox({ url, type, onClose }) {
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  React.useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)'
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          borderRadius: '50%', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', zIndex: 1
        }}
      >
        <X size={20} />
      </button>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
        {isImg ? (
          <img
            src={url}
            alt="Media"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          />
        ) : isVid ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function RoomChatPanel({ p }) {
  const { showScrollArrow, handleScroll, scrollToBottom } = useScrollToBottom(p.messagesEndRef);
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
  const [activeMessageMenu, setActiveMessageMenu] = React.useState(null);
  const messageMenuRef = React.useRef(null);

  const [hoveredMsgId, setHoveredMsgId] = React.useState(null);
  const [clearGroupChatModalOpen, setClearGroupChatModalOpen] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const dmFileInputRef = React.useRef(null);
  const myUser = (localStorage.getItem('watch_username') || p.username || '').toLowerCase();
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
      // If clicking outside the active message menu
      if (activeMessageMenu && messageMenuRef.current && !messageMenuRef.current.contains(e.target)) {
        setActiveMessageMenu(null);
      }
      // If clicking outside the header 3-dots menu
      if (showHeaderMenu && headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowHeaderMenu(false);
      }
      if (showHiddenMenu && hiddenMenuRef.current && !hiddenMenuRef.current.contains(e.target)) {
        setShowHiddenMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMessageMenu, showHeaderMenu, showHiddenMenu]);
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
  };

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

  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      e.target.value = null;
      return;
    }

    // Permission check for media in rooms
    if (type === 'group' && p.allowMedia === false) {
      toast.error('Sharing media is disabled in this room');
      e.target.value = null;
      return;
    }

    setIsUploading(true);
    const objectUrl = URL.createObjectURL(file);

    try {
      if (type === 'group') {
        p.sendMediaGroupChat(objectUrl, file.type, p.groupReplyTo, file);
        p.setGroupReplyTo(null);
      } else {
        p.sendMediaDmChat(objectUrl, file.type, p.dmReplyTo, file);
        p.setDmReplyTo(null);
      }
      toast.success('Sent!');
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
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordingFor(chatType);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingFor(null);
    audioChunksRef.current = [];
  };

  const sendVoiceNote = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const blob = new Blob([audioBlob], { type: audioBlob.type || 'audio/webm' });
      const url = audioUrl;
      if (recordingFor === 'group') {
        p.sendMediaGroupChat(url, blob.type, p.groupReplyTo, blob);
        p.setGroupReplyTo(null);
      } else {
        p.sendMediaDmChat(url, blob.type, p.dmReplyTo, blob);
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
        p.socket.emit('chat:mark_read', { chatId: key });
      }
    });

    toast.success('All marked as read');
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
        delete next[chatKey];
        return next;
      });
    }

    window.dispatchEvent(new Event('conversations_updated'));
    toast.success('Chat deleted');
  };

  const renderMedia = (url, type, isMe, fileName) => {
    if (!url && !type) return null;
    const isImg = type?.startsWith('image/');
    const isVid = type?.startsWith('video/');
    const isAudio = type?.startsWith('audio/');

    if (isAudio) return <AudioPlayerBubble url={url} isMe={isMe} isLight={isLight} />;

    if (!isImg && !isVid) return <FileCard url={url} type={type} fileName={fileName} isMe={isMe} isLight={isLight} />;

    if (!url) return null;

    return (
      <div style={{ marginTop: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000', maxWidth: 220, position: 'relative', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        {isImg ? (
          <img
            src={url}
            alt="Shared media"
            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
            onClick={() => setLightbox({ url, type })}
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<div style="color:#666;font-size:11px;padding:16px;text-align:center">Failed to load image</div>';
            }}
          />
        ) : (
          <div onClick={() => setLightbox({ url, type })} style={{ position: 'relative', width: '100%', height: 140, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} muted />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(99,102,241,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(99,102,241,0.5)' }}>
                <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
              </div>
            </div>
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
      {lightbox && <MediaLightbox url={lightbox.url} type={lightbox.type} onClose={() => setLightbox(null)} />}
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
            <div style={{ padding: '10px 14px', background: isLight ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--room-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button 
                  onClick={() => setShowHiddenChats(false)}
                  style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#888', cursor: 'pointer', padding: '2px 4px', display: 'flex' }}
                >
                  <ChevronLeft size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isLight ? '#4f46e5' : '#a5b4fc', fontSize: 12, fontWeight: 700 }}>
                  <Lock size={14} /> {t('hiddenFolder', 'Hidden Folder')}
                </div>
              </div>
              <div ref={hiddenMenuRef} style={{position:'relative', display:'flex', alignItems:'center'}}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowHiddenMenu(!showHiddenMenu); }}
                  style={{ background: 'none', border: 'none', color: isLight ? '#4f46e5' : '#888', cursor: 'pointer', padding: 4, display: 'flex' }}
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
              // Also clear the global navbar badge for this room
              if (p.onMarkRead) p.onMarkRead(p.roomId);
            }} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'transparent',border:'none',borderBottom:'1px solid var(--room-border)',cursor:'pointer',color: isLight ? '#1e293b' : '#fff',width:'100%',textAlign:'left',position:'relative'}}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: p.room?.thumbnailPath ? 'none' : 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {p.room?.thumbnailPath ? (
                  <img src={`${p.SOCKET_SERVER_URL}${p.room.thumbnailPath}`} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Users size={18} color="#fff" />
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color: isLight ? '#1e293b' : '#fff'}}>{p.roomName}</div>
                <div style={{fontSize:11,color: isLight ? '#475569' : '#a1a1aa',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {(() => {
                    const lastMsg = p.groupMessages.length > 0 ? p.groupMessages[p.groupMessages.length-1] : null;
                    if (!lastMsg) return t('groupConv', 'Group conversation');
                    const sender = lastMsg.username || lastMsg.senderName;
                    const mt = lastMsg.mediaType;
                    const preview = lastMsg.decryptedText
                      || (mt ? (mt.startsWith('video') ? 'Video' : mt.startsWith('image') ? 'Photo' : mt.startsWith('audio') ? 'Voice Note' : 'File')
                        : (lastMsg.message && looksLikeCiphertext(lastMsg.message) ? 'Message' : (lastMsg.message?.slice(0,32) || '...')));
                    return sender ? `${sender}: ${preview}` : preview;
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
                      <Lock size={16} color={isLight ? "#4f46e5" : "#818cf8"} style={{flexShrink:0}} />
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
              const allUsernames = Array.from(new Set([
                ...p.userList.filter(u=>u.username!==p.username).map(u=>u.username), 
                ...Object.keys(p.dmThreads), 
                ...Array.from(p.knownUsers)
              ])).filter(n => n && n !== p.username);

              const sortedUsernames = allUsernames.sort((a, b) => {
                const isAPinned = pinnedRoomChats.includes(a.toLowerCase());
                const isBPinned = pinnedRoomChats.includes(b.toLowerCase());
                if (isAPinned && !isBPinned) return -1;
                if (!isAPinned && isBPinned) return 1;
                return 0;
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
              const unread = p.dmUnread[uname]||0;
              const thread = p.dmThreads[uname]||[];
              const last = thread[thread.length-1];
              const uObj = p.userList.find(u=>u.username===uname);
              const isOnline = !!uObj;

              const partner = uname.toLowerCase();
              const isBlockedByThem = blockingMe.some(u => u.toLowerCase() === partner);
              const isBlocked = isBlockedByThem || blockedChats.some(u => u.toLowerCase() === partner);
              const displayUname = isBlocked ? 'User' : uname;

              // Find avatar from thread or group history if user is not currently in the room list
              const threadAvatar = thread.find(m => m.senderName === uname && m.senderAvatar)?.senderAvatar;
              const groupAvatar = p.groupMessages.find(m => (m.username === uname || m.senderName === uname) && m.senderAvatar)?.senderAvatar;
              const fallbackAvatar = threadAvatar || groupAvatar || p.knownAvatars?.[uname] || p.knownAvatars?.[uname.toLowerCase()];

              const displayAvatarSrc = isBlocked ? null : (
                (uObj?.avatarPath ? `${p.SOCKET_SERVER_URL}${uObj.avatarPath}` : null) || 
                (fallbackAvatar ? (fallbackAvatar.startsWith('http') ? fallbackAvatar : `${p.SOCKET_SERVER_URL}${fallbackAvatar}`) : null)
              );

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
                      {last ? (() => {
                        const lmt = last.mediaType;
                        const preview = last.decryptedText
                          || (lmt ? (lmt.startsWith('video') ? 'Video' : lmt.startsWith('image') ? 'Photo' : lmt.startsWith('audio') ? 'Voice Note' : 'File')
                            : (last.message && looksLikeCiphertext(last.message) ? 'Message' : (last.message?.slice(0,32) || '')));
                        return last.isMe ? `You: ${preview}` : preview;
                      })() : 'Start a private chat'}
                    </div>
                  </div>
                  <div style={{position:'relative',display:'flex',alignItems:'center',gap:4}}>
                    {isPinned && <Pin size={12} color="#6366f1" />}
                    {mutedChats.includes(chatKey) && <BellOff size={14} color={isLight ? "#475569" : "#888"} style={{flexShrink:0}} />}
                    {isDmLocked ? (
                      <Lock size={16} color={isLight ? "#4f46e5" : "#818cf8"} style={{flexShrink:0}} />
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
            {Array.from(new Set([...p.userList.filter(u=>u.username!==p.username).map(u=>u.username), ...Object.keys(p.dmThreads)])).length===0 && (
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
            <div style={{ width: 32, height: 32, borderRadius: 10, background: p.room?.thumbnailPath ? 'none' : 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {p.room?.thumbnailPath ? (
                <img src={`${p.SOCKET_SERVER_URL}${p.room.thumbnailPath}`} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); if(p.isHost){ p.setRenameInput(p.roomName); p.setRenameModalOpen(true); } else toast.error(t('onlyHostRename', 'Only host can edit this room name'));}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                    <Edit2 size={16}/> {t('editName', 'Edit Name')}
                  </div>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); toggleMuteChat(p.roomId);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                    {mutedChats.includes((p.roomId||'').toLowerCase()) ? <Bell size={16}/> : <BellOff size={16}/>} {mutedChats.includes((p.roomId||'').toLowerCase()) ? t('unmute', 'Unmute') : t('mute', 'Mute')}
                  </div>
                  <div onClick={e=>{e.stopPropagation(); p.setShowGroupMenu(false); setClearGroupChatModalOpen(true);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                    <Trash2 size={16}/> {t('clearChat', 'Clear Chat')}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div 
            className="no-scrollbar"
            onScroll={handleScroll} 
            onClick={() => { p.setActiveReactionMsg(null); p.setShowAllEmojis(false); p.setShowGroupEmojiPicker(false); p.setShowDmEmojiPicker(false); setActiveMessageMenu(null); }} style={{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:10}}>
            {p.groupMessages.length===0 && <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:8}}><MessageSquare size={36} opacity={0.2}/><p style={{margin:0,fontSize:13}}>{t('sayHi', 'No messages yet. Say hi!')}</p></div>}
            {p.groupMessages.map((msg,i)=>{
              const isMe = msg.isMe || (msg.username && msg.username === p.username) || (msg.senderName && msg.senderName === p.username);
              const reactions = msg.reactions||{};
              const resolvedMedia = (p.groupDecryptedMediaUrls?.current && (
                p.groupDecryptedMediaUrls.current[msg.id] ||
                p.groupDecryptedMediaUrls.current[msg.tempId] ||
                p.groupDecryptedMediaUrls.current[String(msg.timestamp)]
              )) || (msg.nonce ? null : msg.mediaUrl);
              const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
              
              return (
                <div key={msg.tempId || msg.id || i} id={`group-msg-${msg.id || msg.tempId || i}`} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                  {msg.replyTo && (
                    <div onClick={() => { const el = document.getElementById(`group-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(99,102,241,0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',borderLeft:'3px solid #6366f1',borderRadius:6,padding:'4px 8px',fontSize:11,color: isLight ? '#64748b' : '#888',maxWidth:'80%',cursor:'pointer'}}>
                      <span style={{color: isLight ? '#1e293b' : '#a0aab2',fontWeight:600}}>{(() => { 
                        const n = msg.replyTo.username || msg.replyTo.senderName; 
                        const partner = (n||'').toLowerCase();
                        const isRepBlocked = blockingMe.some(u => u.toLowerCase() === partner) || blockedChats.some(u => u.toLowerCase() === partner); 
                        return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); 
                      })()}: </span>{(() => {
                        const raw = msg.replyTo.message || '';
                        if (msg.replyTo.mediaType) { const rmt=msg.replyTo.mediaType; return rmt.startsWith('video')?'Video':rmt.startsWith('image')?'Photo':rmt.startsWith('audio')?'Voice Note':'File'; }
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
                      
                      const displayUsername = amIBlockedBySender ? 'User' : partnerName;
                      const fallbackAvatar = msg.senderAvatar || p.knownAvatars?.[partnerName];
                      const displayAvatarSrc = amIBlockedBySender ? null : (fallbackAvatar ? (fallbackAvatar.startsWith('http') ? fallbackAvatar : `${p.SOCKET_SERVER_URL}${fallbackAvatar}`) : null);
                      
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
                              style={{ fontSize: 10, color: '#888', cursor: blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) ? 'default' : 'pointer' }}
                              title={blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) ? 'Blocked User' : `View ${msg.senderName || msg.username}'s profile`}
                            >
                              {blockingMe.some(u => u.toLowerCase() === (msg.senderName||msg.username||'').toLowerCase()) ? 'User' : (msg.senderName || msg.username)}
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
                      <div style={{position:'relative', display:'flex', alignItems:'center'}}>
                        <div className={isMe ? 'msg-sent stay-white' : 'msg-received'} style={{
                          position: 'relative',
                          background: isMediaOnly ? 'transparent' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)')),
                          padding: isMediaOnly ? '0' : '8px 12px',
                          borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',
                          fontSize:14,
                          color: isMe ? '#fff' : (isLight ? '#000000' : '#fff'),
                          maxWidth:'100%',
                          wordBreak:'break-word'
                        }}
                        onMouseEnter={() => setHoveredMsgId(msg.id||i)}
                        onMouseLeave={() => setHoveredMsgId(null)}>
                          {msg.decryptedText !== null ? (
                            <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.decryptedText, isMe)}</div>
                          ) : (
                            (!msg.mediaType && (msg.e2ee || msg.nonce || (msg.message && looksLikeCiphertext(msg.message)))) ? (
                              <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                            ) : (
                              !msg.mediaType && msg.message && <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.message, isMe)}</div>
                            )
                          )}
                          {renderMedia(resolvedMedia, msg.mediaType, isMe, msg._fileName || msg.mediaFileName)}
                          
                          {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                            <div style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                              <button onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowHeaderMenu(false); p.setShowAllEmojis(false); p.setActiveReactionMsg(null); }} style={{background:isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                <ChevronDown size={14}/>
                              </button>
                              {activeMessageMenu === msg.id && (
                                 <div className="menu-dropdown" style={{
                                   position:'absolute', top:'100%', [isMe?'right':'left']:0, marginTop:4, 
                                   background: 'var(--dropdown-bg)', 
                                   border: '1px solid var(--dropdown-border)', 
                                   borderRadius:12, padding:6, zIndex:100, 
                                   boxShadow: 'var(--dropdown-shadow)', minWidth: 160
                                 }} onClick={e => e.stopPropagation()}>
                                   {isMe ? (
                                     <>
                                       <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
                                         <Trash2 size={16}/> {t('unsend', 'Unsend')}
                                       </button>
                                       <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn">
                                         <Trash2 size={16}/> {t('deleteForMe', 'Delete for me')}
                                       </button>
                                     </>
                                   ) : (
                                     <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
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
                                <button onClick={(e)=>{e.stopPropagation(); p.setActiveReactionMsg(msg.id); p.setShowAllEmojis(true);}} style={{background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color: isLight ? '#111' : '#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}><Plus size={16}/></button>
                              </div>
                            </div>
                          )}

                        </div>
                        {!blockingMe.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && (
                          <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: p.activeReactionMsg === msg.id ? 1 : undefined, transition:'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className="react-btn-container">
                            <button className="react-btn" onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(p.activeReactionMsg===msg.id?null:msg.id); p.setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: isLight ? '#111' : '#aaa',padding:2}}>
                              <SmilePlus size={16}/>
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:10,color:'#444'}}>{formatTime(msg.timestamp)}</span>
                        {!blockingMe.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === (msg.username || msg.senderName || '').toLowerCase()) && (
                          <button onClick={()=>p.setGroupReplyTo(msg)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                        )}
                        <button onClick={()=>p.reportMsg(msg)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.15)',cursor:'pointer',padding:0}}><Flag size={9}/></button>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4}}>
                    {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                      <button key={emoji} onClick={()=>p.handleGroupReact(msg.id || msg.timestamp, emoji)} style={{background:'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(p.username)?'#6366f1':'rgba(255,255,255,0.1)'}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color:'#ddd'}}>
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.values(p.typingUsers).length>0 && (
              <div style={{display:'flex',alignItems:'center',gap:8,color: isLight ? '#64748b' : '#666',fontSize:12}}>
                <div style={{display:'flex',gap:3}}><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>
                {Object.values(p.typingUsers).join(', ')} {Object.values(p.typingUsers).length===1?'is':'are'} typing...
              </div>
            )}
            <div ref={p.messagesEndRef}/>
          </div>
          {p.groupReplyTo && (
            <div style={{padding:'6px 12px',background:'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
              <span><span style={{color:'#6366f1',fontWeight:600}}>{(() => { const n = p.groupReplyTo.username || p.groupReplyTo.senderName; const isRepBlocked = blockingMe.some(u => u.toLowerCase() === (n||'').toLowerCase()); return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); })()}: </span>{(() => {
                const r = p.groupReplyTo;
                if (r.mediaType) { const rmt3=r.mediaType; return rmt3.startsWith('video')?'Video':rmt3.startsWith('image')?'Photo':rmt3.startsWith('audio')?'Voice Note':'File'; }
                if (r.decryptedText) return r.decryptedText.slice(0,50);
                const raw = r.message || '';
                if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                return raw.slice(0,50) || 'Message';
              })()}</span>
              <button onClick={()=>p.setGroupReplyTo(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
            </div>
          )}
          <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0,position:'relative'}}>
            {/* Restriction badges */}
            {(() => {
              const isGuest = localStorage.getItem('watch_is_guest') === 'true';
              const chatLocked = p.chatPerm === 'host' && !p.isHost;
              const showBadges = isGuest || p.isMuted || chatLocked || p.allowLinks === false || p.allowMedia === false;
              if (!showBadges) return null;
              return (
                <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                  {isGuest && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Guests cannot chat</div>}
                  {p.isMuted && !isGuest && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> You are muted</div>}
                  {chatLocked && !isGuest && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Host-only messaging</div>}
                  {p.allowLinks === false && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Links Disabled</div>}
                  {p.allowMedia === false && <div style={{fontSize:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:3}}><Lock size={10}/> Media Disabled</div>}
                </div>
              );
            })()}
            
            {p.showGroupEmojiPicker && (
              <div style={{position:'absolute', bottom:'100%', left:12, marginBottom:10, zIndex:100, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', borderRadius:10}} onClick={(e) => e.stopPropagation()}>
                <Picker data={data} onEmojiSelect={(e) => p.setGroupChatInput(prev => prev + e.native)} theme="dark" previewPosition="none" searchPosition="none" navPosition="bottom" />
              </div>
            )}
            
            {/* Group recording UI */}
            {isRecording && recordingFor === 'group' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, minWidth: 28 }}>{formatRecordingTime(recordingTime)}</span>
                <div style={{ flex: 1 }} />
                <button type="button" onClick={cancelRecording} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
                <button type="button" onClick={stopRecording} style={{ background: '#6366f1', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  <Check size={11} color="#fff" strokeWidth={2.5} /> Done
                </button>
              </div>
            )}
            {!isRecording && audioBlob && audioUrl && recordingFor === 'group' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
                <Music size={14} color="#a855f7" style={{ flexShrink: 0 }} />
                <audio src={audioUrl} controls style={{ height: 24, flex: 1 }} />
                <button type="button" onClick={cancelRecording} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
                <button type="button" onClick={sendVoiceNote} disabled={isUploading} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  {isUploading ? <Loader2 size={11} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={11} color="#fff" /> Send</>}
                </button>
              </div>
            )}
            {(!isRecording || recordingFor !== 'group') && !(audioBlob && recordingFor === 'group') && (() => {
              const isGuest = localStorage.getItem('watch_is_guest') === 'true';
              const chatLocked = p.chatPerm === 'host' && !p.isHost;
              const isDisabled = isGuest || p.isMuted || chatLocked;
              return (
                <form onSubmit={(e) => {
                    const val = p.groupChatInput.trim();
                    const hasLink = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/.test(val);
                    const hasImage = /data:image\/[a-zA-Z]*;base64,/.test(val);
                    if (isGuest) { e.preventDefault(); toast.error('Guests cannot chat'); return; }
                    if (chatLocked) { e.preventDefault(); toast.error('Only the host can send messages'); return; }
                    if (hasLink && p.allowLinks === false) { e.preventDefault(); toast.error('Links are not allowed in this room'); return; }
                    if (hasImage && p.allowMedia === false) { e.preventDefault(); toast.error('Media (images/videos) are not allowed in this room'); return; }
                    p.sendGroupChat(e); 
                    p.setShowGroupEmojiPicker(false); 
                  }} style={{display:'flex',gap:8, alignItems:'center'}}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                      <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/mpeg,audio/wav,audio/ogg,audio/m4a" onChange={(e) => handleFileSelect(e, 'group')} />
                      <input 
                        ref={p.groupInputRef} 
                        value={p.groupChatInput} 
                        onChange={e=>{p.handleChatInputChange(e.target.value, 'room'); p.setGroupChatInput(e.target.value);}} 
                        onFocus={() => p.setShowGroupEmojiPicker(false)} 
                        placeholder={isGuest ? t('guestsCannotChat', 'Guests cannot chat') : t('msgRoomPlace', 'Message the room...')} 
                        disabled={isDisabled} 
                        style={{
                          flex:1,
                          background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius:10,
                          padding:'8px 12px',
                          paddingRight: (!p.groupChatInput && !isUploading) ? '95px' : '12px',
                          color: isLight ? '#1e293b' : '#fff',
                          fontSize:13,
                          outline:'none',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                      
                      {(!p.groupChatInput && !isUploading) && (
                        <div style={{ position: 'absolute', right: 6, display: 'flex', alignItems: 'center', gap: 0 }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); p.setShowGroupEmojiPicker(!p.setShowGroupEmojiPicker); }} style={{background:'transparent',border:'none',color: isLight ? '#64748b' : '#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                            <SmilePlus size={18}/>
                          </button>
                          <button type="button" disabled={isUploading || isDisabled || p.allowMedia === false} onClick={() => fileInputRef.current?.click()} style={{background:'transparent',border:'none',color:isUploading?'#6366f1' : (isLight ? '#64748b' : '#aaa'),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isDisabled || p.allowMedia === false ? 0.4 : 1}}>
                            <Paperclip size={18}/>
                          </button>
                          <button type="button" disabled={isDisabled} onClick={() => startRecording('group')} title="Record voice note" style={{background:'transparent',border:'none',color:'#818cf8',cursor:isDisabled?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isDisabled?0.4:1}}>
                            <Mic size={18}/>
                          </button>
                        </div>
                      )}

                      {isUploading && (
                        <div style={{ position: 'absolute', right: 10 }}>
                          <Loader2 size={16} className="animate-spin" color="#6366f1" />
                        </div>
                      )}
                    </div>
                    <button type="submit" disabled={isDisabled||!p.groupChatInput.trim()} style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:isDisabled||!p.groupChatInput.trim()?0.5:1, flexShrink: 0}}>
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
                    const displayUname = isBlocked ? 'User' : p.dmTarget;
                    const uObj = p.userList.find(u => u.username === p.dmTarget);
                    
                    // Check if we have public keys for this user in any cache
                    const hasTargetKeys = (uObj?.publicKey) || (p.dbPublicKeys?.current?.[partner]) || localStorage.getItem(`wt_pk_${partner}`);
                    
                    const threadAvatar = (p.dmThreads[p.dmTarget]||[]).find(m => m.senderName === p.dmTarget && m.senderAvatar)?.senderAvatar;
                    const groupAvatar = p.groupMessages.find(m => (m.username === p.dmTarget || m.senderName === p.dmTarget) && m.senderAvatar)?.senderAvatar;
                    const fallbackAvatar = threadAvatar || groupAvatar || p.knownAvatars?.[p.dmTarget] || p.knownAvatars?.[p.dmTarget.toLowerCase()];

                    const displayAvatarSrc = isBlocked ? null : (
                      (uObj?.avatarPath ? `${p.SOCKET_SERVER_URL}${uObj.avatarPath}` : null) || 
                      (fallbackAvatar ? (fallbackAvatar.startsWith('http') ? fallbackAvatar : `${p.SOCKET_SERVER_URL}${fallbackAvatar}`) : null)
                    );

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
                      }} onMouseLeave={()=>p.setShowDmMenu(null)}>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); togglePinRoomChat(p.dmTarget);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          <Pin size={16}/> {pinnedRoomChats.includes((p.dmTarget||'').toLowerCase()) ? t('unpinChat', 'Unpin Chat') : t('pinChat', 'Pin Chat')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); toggleHideChat((p.dmTarget||'').toLowerCase());}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          <Lock size={16}/> {hiddenChats.includes((p.dmTarget||'').toLowerCase()) ? t('unhideChat', 'Unhide Chat') : t('hideChat', 'Hide Chat')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); toggleMuteChat(p.dmTarget);}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: 'var(--menu-item-text)',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn">
                          {mutedChats.includes((p.dmTarget||'').toLowerCase()) ? <Bell size={16}/> : <BellOff size={16}/>} {mutedChats.includes((p.dmTarget||'').toLowerCase()) ? t('unmute', 'Unmute') : t('mute', 'Mute')}
                        </div>
                        <div style={{ height: '1px', background: 'var(--menu-divider)', margin: '6px 8px' }} />
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); setBlockUserConfirm({username: p.dmTarget}); }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                          <Ban size={16}/> {blockedChats.some(u => u.toLowerCase() === (p.dmTarget||'').toLowerCase()) ? t('unblock', 'Unblock') : t('block', 'Block')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); p.setClearChatTarget(p.dmTarget); p.setClearChatModalOpen(true); }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                          <Trash2 size={16}/> {t('clearChat', 'Clear Chat')}
                        </div>
                        <div onClick={e=>{e.stopPropagation(); p.setShowDmMenu(null); setDeleteChatConfirm({key: p.dmTarget, type: 'dm', name: p.dmTarget}); }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'transparent',border:'none',color: '#ef4444',fontSize:13,cursor:'pointer',textAlign:'left',borderRadius:8}} className="chat-menu-item menu-btn menu-btn-danger">
                          <Trash2 size={16}/> {t('deleteChat', 'Delete Chat')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div 
                  className="no-scrollbar"
                  onScroll={handleScroll} 
                  onClick={() => { p.setActiveReactionMsg(null); p.setShowAllEmojis(false); p.setShowGroupEmojiPicker(false); p.setShowDmEmojiPicker(false); setActiveMessageMenu(null); }} style={{flex:1,overflowY:'auto',padding:10,display:'flex',flexDirection:'column',gap:8}}>
                  {(p.dmThreads[p.dmTarget]||[]).length===0 && (
                    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#444',gap:6}}>
                      <Lock size={28} opacity={0.2}/><p style={{margin:0,fontSize:12}}>Start a private conversation</p>
                    </div>
                  )}
                  {(p.dmThreads[p.dmTarget]||[]).map((msg,i)=>{
                    const isMe = msg.isMe;
                    const reactions = msg.reactions||{};
                    const resolvedMedia = (p.dmDecryptedMediaUrls?.current && (
                      p.dmDecryptedMediaUrls.current[msg.id] ||
                      p.dmDecryptedMediaUrls.current[msg.tempId] ||
                      p.dmDecryptedMediaUrls.current[String(msg.timestamp)]
                    )) || (msg.nonce ? null : msg.mediaUrl);
                    const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));

                    return (
                      <div key={msg.tempId || msg.id || i} id={`dm-msg-${msg.id || msg.tempId || i}`} className="msg-row msg-enter" style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                        {msg.replyTo && (
                          <div onClick={() => { const el = document.getElementById(`dm-msg-${msg.replyTo.id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.transition='background 0.3s ease'; el.style.background='rgba(99,102,241,0.22)'; setTimeout(()=>{ el.style.background=''; el.style.transition=''; },1300); } }} style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'#6366f1':'#a855f7'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%',cursor:'pointer'}}>
                            <span style={{color:'#6366f1',fontWeight:600}} className="reply-sender">
                              {(() => { const n = msg.replyTo.username || msg.replyTo.senderName || msg.replyTo.targetName; const isRepBlocked = blockingMe.some(u => u.toLowerCase() === (n||'').toLowerCase()); return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); })()}: 
                            </span> {(() => {
                              const raw = msg.replyTo.message || '';
                              if (msg.replyTo.mediaType) { const rmt2=msg.replyTo.mediaType; return rmt2.startsWith('video')?'Video':rmt2.startsWith('image')?'Photo':rmt2.startsWith('audio')?'Voice Note':'File'; }
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
                            const avatarSrc = isSenderBlocked ? null : (fallbackMsgAvatar
                              ? (fallbackMsgAvatar.startsWith('http') ? fallbackMsgAvatar : `${p.SOCKET_SERVER_URL}${fallbackMsgAvatar}`)
                              : null);
                            return <Avatar name={displayUsername} size={28} src={avatarSrc}/>;
                          })()}
                          <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                            <div style={{position:'relative', display:'flex', alignItems:'center'}}>
                              <div className={isMe ? 'msg-sent stay-white' : 'msg-received'} style={{
                                position: 'relative',
                                background: isMediaOnly ? 'transparent' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)')),
                                padding: isMediaOnly ? '0' : '8px 12px',
                                borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',
                                fontSize:14,
                                color: isMe ? '#fff' : (isLight ? '#000000' : '#ddd'),
                                maxWidth:'100%',
                                wordBreak:'break-word'
                              }}
                              onMouseEnter={() => setHoveredMsgId(msg.id||i)}
                              onMouseLeave={() => setHoveredMsgId(null)}>
                                {msg.decryptedText !== null ? (
                                  <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.decryptedText, isMe)}</div>
                                ) : (
                                  (!msg.mediaType && (msg.nonce || msg.e2ee || (msg.message && looksLikeCiphertext(msg.message)))) ? (
                                    <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                                  ) : (
                                    !msg.mediaType && msg.message && <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.message, isMe)}</div>
                                  )
                                )}
                                {renderMedia(resolvedMedia, msg.mediaType, isMe, msg._fileName || msg.mediaFileName)}
                                
                                {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                                  <div style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                    <button 
                                      ref={activeMessageMenu === msg.id ? messageMenuRef : null}
                                      onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); p.setShowDmMenu(null); p.setShowAllEmojis(false); p.setActiveReactionMsg(null); }} style={{background: isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                      <ChevronDown size={14}/>
                                    </button>
                                    {activeMessageMenu === msg.id && (
                                      <div className="menu-dropdown" style={{
                                        position:'absolute', top:'100%', [isMe?'right':'left']:0, marginTop:4, 
                                        background: 'var(--dropdown-bg)', 
                                        border: '1px solid var(--dropdown-border)', 
                                        borderRadius:12, padding:6, zIndex:100, 
                                        boxShadow: 'var(--dropdown-shadow)', minWidth: 160
                                      }} onClick={e => e.stopPropagation()}>
                                        {isMe ? (
                                          <>
                                            <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
                                              <Trash2 size={16}/> {t('unsend', 'Unsend')}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: 'var(--menu-item-text)', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn">
                                              <Trash2 size={16}/> {t('deleteForMe', 'Delete for me')}
                                            </button>
                                          </>
                                        ) : (
                                          <button onClick={(e) => { e.stopPropagation(); p.handleDeleteMessage(msg.id || msg.timestamp, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color: '#ef4444', cursor:'pointer', padding:'10px 12px', fontSize:13, borderRadius:8, whiteSpace:'nowrap'}} className="chat-menu-item menu-btn menu-btn-danger">
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
                                      <button onClick={(e)=>{e.stopPropagation(); p.setActiveReactionMsg(msg.id); p.setShowAllEmojis(true);}} style={{background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:14,width:34,height:34,borderRadius:'50%',marginLeft:4,display:'flex',alignItems:'center',justifyContent:'center',color: isLight ? '#111' : '#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}><Plus size={16}/></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                                {!blockingMe.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && (
                                  <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: p.activeReactionMsg === msg.id ? 1 : undefined, transition:'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className="react-btn-container">
                                    <button className="react-btn" onClick={(e)=>{ e.stopPropagation(); p.setActiveReactionMsg(p.activeReactionMsg===msg.id?null:msg.id); p.setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color: isLight ? '#111' : '#aaa',padding:2}}>
                                      <SmilePlus size={16}/>
                                    </button>
                                  </div>
                                )}
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:10,color:'#444'}}>{formatTime(msg.timestamp)}</span>
                              {!blockingMe.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && !blockedChats.some(u => u.toLowerCase() === p.dmTarget.toLowerCase()) && (
                                <button onClick={()=>p.setDmReplyTo(msg)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start', marginTop:-4}}>
                          {Object.entries(reactions).filter(([,v])=>v.length>0).map(([emoji,uids])=>(
                            <button key={emoji} onClick={()=>p.handleDmReact(msg.id || msg.timestamp, emoji)} style={{background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',border:`1px solid ${uids.includes(p.username)?'#6366f1' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')}`,borderRadius:12,padding:'2px 8px',cursor:'pointer',fontSize:12,color: isLight ? '#1e293b' : '#ddd'}}>
                              {emoji} {uids.length}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={p.messagesEndRef}/>
                </div>
                <div style={{padding:'10px 12px',borderTop:'1px solid var(--room-border)',flexShrink:0,position:'relative'}}>
                  {p.dmReplyTo && (
                    <div style={{padding:'6px 12px',marginBottom:6,background: isLight ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color: isLight ? '#64748b' : '#a0aab2'}}>
                      <span><span style={{color:'#6366f1',fontWeight:600}}>
                        {(() => { const n = p.dmReplyTo.username || p.dmReplyTo.senderName || p.dmReplyTo.targetName; const isRepBlocked = blockingMe.some(u => u.toLowerCase() === (n||'').toLowerCase()); return (n||'').toLowerCase() === (p.username||'').toLowerCase() ? 'You' : (isRepBlocked ? 'User' : n); })()}: 
                      </span> {(() => {
                        const r = p.dmReplyTo;
                        if (r.mediaType) { const rmt4=r.mediaType; return rmt4.startsWith('video')?'Video':rmt4.startsWith('image')?'Photo':rmt4.startsWith('audio')?'Voice Note':'File'; }
                        if (r.decryptedText) return r.decryptedText.slice(0,50);
                        return (r.message||'').slice(0,50) + ((r.message||'').length > 50 ? '...' : '');
                      })()}</span>
                      <button onClick={()=>p.setDmReplyTo(null)} style={{background:'none',border:'none',color:'#6366f1',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center'}}>&times;</button>
                    </div>
                  )}

                  {(() => {
                    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
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
                          <a className="stay-white" href={`/profile/${p.dmTarget}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 12, padding: '8px 20px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff !important', borderRadius: 10, textDecoration: 'none', fontSize: 11, fontWeight: 800, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(99,102,241,0.4)'; e.currentTarget.style.filter = 'brightness(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.2)'; e.currentTarget.style.filter = 'brightness(1)'; }}>
                            {t('viewProfile', 'View Profile')}
                          </a>
                        </div>
                      );
                    }

                    if (isRecording && recordingFor === 'dm') return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 12px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, minWidth: 28 }}>{formatRecordingTime(recordingTime)}</span>
                        <div style={{ flex: 1 }} />
                        <button type="button" onClick={cancelRecording} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
                        <button type="button" onClick={stopRecording} style={{ background: '#6366f1', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                          <Check size={11} color="#fff" strokeWidth={2.5} /> Done
                        </button>
                      </div>
                    );
                    if (!isRecording && audioBlob && audioUrl && recordingFor === 'dm') return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '8px 12px' }}>
                        <Music size={14} color="#a855f7" style={{ flexShrink: 0 }} />
                        <audio src={audioUrl} controls style={{ height: 24, flex: 1 }} />
                        <button type="button" onClick={cancelRecording} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
                        <button type="button" onClick={sendVoiceNote} disabled={isUploading} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                          {isUploading ? <Loader2 size={11} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={11} color="#fff" /> Send</>}
                        </button>
                      </div>
                    );

                    return (
                      <form onSubmit={(e) => {
                        if (isGuest) { e.preventDefault(); toast.error('Guests cannot chat'); return; }
                        p.sendDmChat(e);
                        p.setShowDmEmojiPicker(false);
                      }} style={{display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                          <input type="file" ref={dmFileInputRef} style={{display:'none'}} accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/mpeg,audio/wav,audio/ogg,audio/m4a" onChange={(e) => handleFileSelect(e, 'dm')} />
                          <input 
                            ref={p.dmInputRef} 
                            value={p.dmChatInput} 
                            onChange={e=>{p.handleChatInputChange(e.target.value, 'private'); p.setDmChatInput(e.target.value);}} 
                            onFocus={() => p.setShowDmEmojiPicker(false)} 
                            placeholder={isGuest ? t('guestsCannotChat', 'Guests cannot chat') : p.userList.some(u => u.username === p.dmTarget) ? t('privateMessage', 'Private message...') : t('offlineMessage', 'Offline message...')} 
                            disabled={isGuest} 
                            style={{
                              flex:1,
                              background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)',
                              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                              borderRadius:10,
                              padding:'8px 12px',
                              paddingRight: (!p.dmChatInput && !isUploading) ? '95px' : '12px',
                              color: isLight ? '#1e293b' : '#fff',
                              fontSize:13,
                              outline:'none',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                          />
                          
                          {(!p.dmChatInput && !isUploading) && (
                            <div style={{ position: 'absolute', right: 6, display: 'flex', alignItems: 'center', gap: 0 }}>
                              <button type="button" disabled={isGuest} onClick={(e) => { e.stopPropagation(); p.setShowDmEmojiPicker(!p.showDmEmojiPicker); }} style={{background:'transparent',border:'none',color:isGuest?'#555': (isLight ? '#64748b' : '#aaa'),cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                <SmilePlus size={18}/>
                              </button>
                              <button type="button" disabled={isUploading || isGuest} onClick={() => dmFileInputRef.current?.click()} style={{background:'transparent',border:'none',color:isUploading?'#6366f1':(isGuest?'#555': (isLight ? '#64748b' : '#aaa')),cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                                <Paperclip size={18}/>
                              </button>
                              <button type="button" disabled={isGuest} onClick={() => startRecording('dm')} title="Record voice note" style={{background:'transparent',border:'none',color:'#818cf8',cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4,opacity:isGuest?0.4:1}}>
                                <Mic size={18}/>
                              </button>
                            </div>
                          )}

                          {isUploading && (
                            <div style={{ position: 'absolute', right: 10 }}>
                              <Loader2 size={16} className="animate-spin" color="#6366f1" />
                            </div>
                          )}
                        </div>
                        <button type="submit" disabled={!p.dmChatInput.trim() || isGuest || isUploading} style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',cursor:isGuest?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(!p.dmChatInput.trim()||isGuest||isUploading)?0.5:1, flexShrink: 0}}>
                          <Send size={14} color="#fff"/>
                        </button>
                      </form>
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

      {/* Global Emoji Picker positioned fixed in panel */}
      {p.showAllEmojis && p.activeReactionMsg && (
        <div className="emoji-picker-container" style={{position:'absolute', bottom: 84, right: 16, zIndex: 99999, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.8)', borderRadius:10, transform: 'scale(0.95)', transformOrigin: 'bottom right'}} onClick={e=>e.stopPropagation()}>
          <Picker 
            data={data} 
            theme={isLight ? 'light' : 'dark'} 
            previewPosition="none" 
            searchPosition="none" 
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
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: '50%',
            width: 42,
            height: 42,
            cursor: 'pointer',
            zIndex: 9999,
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4), 0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            border: '2px solid rgba(255,255,255,0.15)',
            animation: 'msg-enter 0.4s ease forwards'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)'; e.currentTarget.style.boxShadow = '0 0 25px rgba(99, 102, 241, 0.6), 0 6px 15px rgba(0,0,0,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.4), 0 4px 12px rgba(0,0,0,0.5)'; }}
        >
          <ArrowDown color="white" size={22} />
        </div>
      )}

    </div>
    
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
        <div style={{position:'fixed',inset:0,zIndex:99999,background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)'}} className="room-modals-overlay">
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












