import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ArrowLeft, Send, X, User, Users, SmilePlus, Reply, Plus, MoreVertical, Search, Paperclip, Loader2, Play, Trash2, Edit2, MoreHorizontal, ArrowDown, ChevronDown, Lock, ShieldAlert, Pin, Bell, BellOff, MessageSquareX, Eye, EyeOff, CheckCheck, Ban, SquareCheck, Square, Unlock, Timer as TimerIcon, Key } from 'lucide-react';
import ChatLockScreen from './ChatLockScreen';
import ForgotPinModal from './ForgotPinModal';
import PinSetupModal from './PinSetupModal';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢'];
import { formatDistanceToNow } from 'date-fns';
import { useScrollToBottom } from '../hooks/useScrollToBottom';
import { useDebounce } from '../hooks/useDebounce';
import { useCrypto } from '../contexts/CryptoContext';
import { encryptDM, encryptGroupMessage, decryptDM, decryptGroupMessage, decryptDMSenderCopy, robustDecode, encryptMedia, decryptMedia } from '../lib/crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

// CSS for typing indicators
const typingCss = `
  @keyframes dot-wave {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
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
  // Emoji / lock placeholders we already use — pass them through
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
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
      (original.mediaType ? (original.mediaType.startsWith('video') ? 'Video' : 'Photo') : '') ||
      (looksLikeCiphertext(original.message || '') ? '' : (original.message || ''));
    return { ...m, replyTo: { ...m.replyTo, message: resolved } };
  });
}

// â”€â”€ Media Lightbox â”€â”€
function MediaLightbox({ url, type, onClose }) {
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)'
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
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

// ———— Inline Media Bubble ————
function MediaBubble({ url, type, onOpenLightbox, onMediaLoad }) {
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  if (!url) return null;
  return (
    <div
      onClick={() => onOpenLightbox(url, type)}
      style={{
        marginTop: 0, borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        background: '#000', cursor: 'pointer',
        maxWidth: 220, position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      {isImg ? (
        <img
          src={url}
          alt="Shared media"
          onLoad={onMediaLoad}
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.parentNode.innerHTML = '<div style="color:#666;font-size:11px;padding:16px;text-align:center">Failed to load image</div>';
          }}
        />
      ) : isVid ? (
        <div style={{ position: 'relative', width: '100%', height: 140, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            src={url}
            onLoadedData={onMediaLoad}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.7 }}
            muted
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(99,102,241,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(99,102,241,0.5)'
            }}>
              <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const GlobalChatWidget = forwardRef(({ 
  isOpen, 
  onClose, 
  unreadCounts, 
  onMarkRead, 
  onNewMessage,
  activeRoomTab,
  activeRoomPartner,
  transparentMode = false
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
  const clearedPartnersRef = useRef(() => {
    try { return JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}'); } catch { return {}; }
  });
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
        
        // Only sync conversations for external storage changes or explicit updates
        // to prevent local state changes from triggering recursive sync loops
        if (e && (e.type === 'storage' || e.type === 'conversations_updated' || e.type === 'hidden_chats_updated')) {
          const cached = localStorage.getItem('watch_recent_chats');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setConversations(prev => {
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
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('muted_chats_updated', handleSync);
      window.removeEventListener('locked_chats_updated', handleSync);
      window.removeEventListener('blocked_chats_updated', handleSync);
      window.removeEventListener('pinned_chats_updated', handleSync);
      window.removeEventListener('hidden_chats_updated', handleSync);
      window.removeEventListener('conversations_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [activeChat, setActiveChat] = useState(null);
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
  const [lightbox, setLightbox] = useState(null); // { url, type }
  const [typingStatuses, setTypingStatuses] = useState({}); // chatKey -> Set of usernames typing
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  // Re-auth overlay state (shown when sessionStorage key is missing after tab close)
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  // Async-decrypted media blob URLs: msgId -> objectURL
  const decryptedMediaUrls = useRef({});
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
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const activeChatRef = useRef(null);
  const viewRef = useRef('list');
  const containerRef = useRef(null);
  const processedMsgsRef = useRef(new Set());

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

  const { showScrollArrow, handleScroll, scrollToBottom } = useScrollToBottom(messagesEndRef);
  const conversationsRef = useRef([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

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
      .catch(() => {});
    // Also sync locked chats from server
    fetch(`${API}/api/chat-lock/locked-chats`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.lockedChats)) {
          setLockedChats(data.lockedChats);
          localStorage.setItem(`locked_chats_${myUsername}`, JSON.stringify(data.lockedChats));
        }
      })
      .catch(() => {});
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
    if (socketRef.current) {
      if (chatType === 'room') {
        socketRef.current.emit('clear_room_chat', { roomId: chatKey });
      } else {
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
    setConversations(prev => (Array.isArray(prev) ? prev : []).map(c =>
      (c.id === chatKey || c.partner === chatKey) ? { ...c, unread: 0 } : c
    ));
    if (socketRef.current) {
      socketRef.current.emit('chat:mark_read', { chatId: chatKey });
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
    }
  }));

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

    sock.on('chat:mark_read', ({ chatId, timestamp }) => {
      // Sync unread status across multiple browser tabs/windows
      setConversations(prev => (Array.isArray(prev) ? prev : []).map(c => 
        (c.id === chatId || c.partner === chatId) ? { ...c, unread: 0 } : c
      ));
      if (onMarkRead && activeChatRef.current?.id === chatId) {
        onMarkRead(chatId);
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

    sock.on('chat:message_deleted', ({ messageId, originalId, timestampId, roomId }) => {
      setMessages(prev => prev.filter(m => 
        !flexibleMatch(messageId, m) && 
        !flexibleMatch(originalId, m) &&
        (!timestampId || !flexibleMatch(timestampId, m))
      ));
      
      // Sync Sidebar: If the deleted message was the latest preview, refresh conversation list
      setConversations(prev => {
        const conversations = Array.isArray(prev) ? prev : [];
        const match = conversations.find(c => 
          String(c.lastTimestamp) === String(timestampId) || 
          String(c.lastTimestamp) === String(originalId) ||
          String(c.lastTimestamp) === String(messageId)
        );
        if (match) {
          // Trigger a silent re-fetch to get correct new preview and timestamps
          fetchConversations();
        }
        return conversations;
      });
    });



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
      const mediaPreview = msg.mediaUrl 
        ? (msg.mediaType?.startsWith('video') ? 'Video' : 'Photo') 
        : null;
      const previewText = mediaPreview || 
        (msg.message && looksLikeCiphertext(msg.message) ? (isMine ? 'Message sent' : 'Encrypted message') : (msg.message || 'New message'));
      
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
                        const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
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
                        const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
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
                        const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
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
      const finalizedMediaPreview = (msg.mediaUrl || msg.mediaType)
        ? (msg.mediaType?.startsWith('video') ? 'Video' : 'Photo')
        : null;
      
      const finalizedPreview = finalizedMediaPreview || 
        (msg.decryptedText || (msg.message && looksLikeCiphertext(msg.message) ? (isMine ? 'Message sent' : 'Encrypted message') : (msg.message || 'New message')));

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
              updated[optIdx] = { ...msg, tempId: optimistic.tempId, decryptedText: safeDecryptedText, mediaUrl: msg.mediaUrl, isMe: isMine, reactions: msg.reactions || {} };
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
        if (!isMine && onMarkRead) onMarkRead(partner);
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
                const hiddenList = JSON.parse(localStorage.getItem(`hidden_chats_${currentMyUser}`) || '[]');
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
          const convDecryptedText = msg.mediaType
            ? (msg.mediaType.startsWith('video') ? 'Video' : 'Photo')
            : (msg.decryptedText || null);
          const updatedItem = { 
            ...exists, 
            message: finalizedPreview, 
            decryptedText: convDecryptedText,
            lastMediaType: msg.mediaType || null,
            lastTimestamp: msgTs, 
            lastSenderName: msg.senderName || msg.username, 
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
          const convDecryptedText = msg.mediaType
            ? (msg.mediaType.startsWith('video') ? 'Video' : 'Photo')
            : (msg.decryptedText || null);
          updatedList = [{
            id: isGroup ? partner : undefined,
            partner, 
            displayName: isGroup ? (msg.roomName || 'Room Chat') : (isMine ? partner : (msg.senderName || msg.username || partner)),
            partnerAvatar: isMine ? (msg.partnerAvatar || null) : (msg.senderAvatar || msg.partnerAvatar || null),
            lastTimestamp: msgTs,
            message: finalizedPreview,
            decryptedText: convDecryptedText,
            lastMediaType: msg.mediaType || null,
            lastSenderName: msg.senderName || msg.username,
            type: isGroup ? 'room' : 'private',
            unread: !isMine && !isViewingThis ? 1 : 0
          }, ...conversations];
        }
        return updatedList.sort((a,b) => (Number(b.lastTimestamp)||0) - (Number(a.lastTimestamp)||0));
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
      const targetUsername = legacyTarget || (userA === myUsername ? userB : userA);

      // Only clear messages — keep the conversation entry in the list
      if (activeChatRef.current && (activeChatRef.current.partner === targetUsername || activeChatRef.current.id === targetUsername)) {
        setMessages([]);
      }
      // Update the conversation preview to show empty state (no message)
      setConversations(prev => {
        const updated = prev.map(c =>
          c.partner === targetUsername
            ? { ...c, message: '', decryptedText: '', mediaType: null, lastTimestamp: 0 }
            : c
        );
        // Guard: only persist to chat_cleared_partners if the chat was NOT explicitly deleted.
        // deleteChat() removes the entry from watch_recent_chats synchronously before this
        // socket event fires, so we use that as the source of truth.
        const stillExists = (() => {
          try {
            const stored = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
            return stored.some(c => c.partner === targetUsername);
          } catch { return false; }
        })();
        const match = prev.find(c => c.partner === targetUsername);
        if (match && stillExists) {
          const entry = { ...match, message: '', decryptedText: '', mediaType: null, lastTimestamp: 0 };
          clearedPartnersRef.current = { ...clearedPartnersRef.current, [targetUsername]: entry };
          try { localStorage.setItem('chat_cleared_partners', JSON.stringify(clearedPartnersRef.current)); } catch {}
        }
        return updated;
      });
      // Do NOT navigate away — stay in the chat view
    });

    sock.on('room_chat_cleared', ({ roomId }) => {
      if (activeChatRef.current && activeChatRef.current.type === 'room' && activeChatRef.current.partner === roomId) {
        setMessages([]);
      }
      setConversations(prev => {
        const updated = prev.map(c =>
          (c.type === 'room' && c.partner === roomId)
            ? { ...c, message: '', decryptedText: '', mediaType: null, lastTimestamp: 0 }
            : c
        );
        // Guard: only persist to chat_cleared_partners if the chat was NOT explicitly deleted.
        const roomStillExists = (() => {
          try {
            const stored = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
            return stored.some(c => c.partner === roomId || c.id === roomId);
          } catch { return false; }
        })();
        const match = prev.find(c => c.type === 'room' && c.partner === roomId);
        if (match && roomStillExists) {
          const entry = { ...match, message: '', decryptedText: '', mediaType: null, lastTimestamp: 0 };
          clearedPartnersRef.current = { ...clearedPartnersRef.current, [roomId]: entry };
          try { localStorage.setItem('chat_cleared_partners', JSON.stringify(clearedPartnersRef.current)); } catch {}
        }
        // Also scrub the stale preview from watch_recent_chats so a page refresh
        // doesn't resurrect old "You: Message sent" text
        try {
          const stored = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
          const cleaned = stored.map(c =>
            (c.type === 'room' && (c.partner === roomId || c.id === roomId))
              ? { ...c, message: '', decryptedText: '', mediaType: null, lastTimestamp: 0 }
              : c
          );
          localStorage.setItem('watch_recent_chats', JSON.stringify(cleaned));
        } catch {}
        return updated;
      });
    });

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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages]);

  // Autofocus input when opening a chat or replying
  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [view, activeChat, replyToMsg]);

  const fetchConversations = async () => {
    if (!token) return;
    
    // Only show blocking loader if we have no cached data at all
    const cached = localStorage.getItem('watch_recent_chats');
    if (!cached || JSON.parse(cached).length === 0) {
      setLoading(true);
    }
    
    try {
      const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
      const param = encodeURIComponent(JSON.stringify(lastSeen));
      const res = await fetch(`${API}/api/chats/recent?lastSeen=${param}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const fetched = Array.isArray(data) ? data : [];
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
            const privateMeta = c.mediaType ? { lastMediaType: c.mediaType, message: c.mediaType.startsWith('video') ? 'Video' : 'Photo' } : {};
            // Also normalize message to decrypted text for non-media so localStorage never stores ciphertext
            const msgNormalize = (!c.mediaType && plainText) ? { message: plainText } : {};
            return { ...c, ...privateMeta, ...msgNormalize, decryptedText: plainText };
          } else if (c.type === 'room') {
            // Always attach lastMediaType for room media so the list renderer never shows ciphertext
            const mediaMeta = c.mediaType ? { lastMediaType: c.mediaType, message: c.mediaType.startsWith('video') ? 'Video' : 'Photo' } : {};
            if (c.e2ee && c.nonce) {
              if (!kp) return { ...c, ...mediaMeta, decryptedText: null };
              try {
                const myLower = myUsername?.toLowerCase();
                const myEncKey = c.e2ee.keys?.[myLower] || Object.entries(c.e2ee.keys || {}).find(([k]) => k.toLowerCase() === myLower)?.[1];
                if (myEncKey && c.e2ee.senderPublicKey) {
                  const senderPubKey = decodeBase64(c.e2ee.senderPublicKey);
                  const plain = decryptGroupMessage(c.message, c.nonce, myEncKey, senderPubKey, kp.secretKey);
                  if (plain !== null) {
                    if (c.mediaType) {
                      const mediaLabel = c.mediaType.startsWith('video') ? 'Video' : 'Photo';
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
        const fetchedPartners = new Set(decryptedFetched.map(c => c.partner));
        // Keep conversations (private AND room) that server didn't return this cycle.
        // For ROOM type: if the server didn't return it, all messages are hidden (cleared) —
        // zero out the preview so it shows "Start a conversation" instead of stale text.
        const preserved = (Array.isArray(prev) ? prev : [])
          .filter(c => !fetchedPartners.has(c.partner))
          .map(c => {
            if (c.type === 'room') {
              return { ...c, message: '', decryptedText: '', lastTimestamp: 0, lastMediaType: null };
            }
            return c;
          });
        // Merge cleared-partner extras
        const extrasMap = clearedPartnersRef.current || {};
        const extras = Object.values(extrasMap).filter(c => !fetchedPartners.has(c.partner) && !preserved.find(p => p.partner === c.partner));

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

          // CLEARED ROOM OVERRIDE: if this room was cleared by the user, always show it as empty
          // regardless of what the server returned (handles partial hiddenFor DB updates gracefully)
          if (c.type === 'room' && clearedRoomsMap[chatKey]) {
            return { ...finalC, message: '', decryptedText: '', lastTimestamp: 0, lastMediaType: null, unread: 0 };
          }
          
          // Bug 5 fix: Keep real-time local state if it's newer than the cached server response.
          // But always apply freshly-decrypted text from the server fetch if available,
          // to prevent 'Encrypted message' from localStorage persisting.
          const existing = Array.isArray(prev) ? prev.find(p => (p.id || p.partner) === chatKey) : null;
          if (existing && Number(existing.lastTimestamp) > Number(c.lastTimestamp)) {
            // Prefer fresh decryptedText from server if existing has none or has a stale encrypted value
            const betterDecryptedText = finalC.decryptedText || existing.decryptedText;
            return { ...existing, targetId: finalC.targetId, decryptedText: betterDecryptedText };
          }

          // Media-preview stability fix: If local entry has lastMediaType set for the same message,
          // preserve the human-readable message label ("Photo"/"Video") and lastMediaType
          // so fetchConversations() never overwrites them with raw server ciphertext.
          if (existing && existing.lastMediaType && Number(existing.lastTimestamp) >= Number(c.lastTimestamp)) {
            // Still apply fresh decryptedText so preview is correct
            const betterDecryptedText = finalC.decryptedText || existing.decryptedText;
            return { ...finalC, lastMediaType: existing.lastMediaType, message: existing.message, decryptedText: betterDecryptedText };
          }

          const seenTs = lastSeen[chatKey];
          // If we have a lastSeen entry for this chat AND the existing conv already has unread=0,
          // then the user opened this chat and it should stay 0
          if (seenTs && existing && existing.unread === 0) {
            return { ...finalC, unread: 0 };
          }
          return finalC;
        });

        const all = [...finalFetched, ...preserved, ...extras];
        
        // FORCE LIFO SORT: Newest activity first
        return all.sort((a,b) => (Number(b.lastTimestamp)||0) - (Number(a.lastTimestamp)||0));
      });
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-track rooms whenever conversation list changes to ensure we get typing/messages for all active chats
  useEffect(() => {
    if (socketRef.current && Array.isArray(conversations)) {
      const roomIds = conversations.filter(c => c.type === 'room').map(c => (c.id || c.partner)?.toLowerCase());
      if (roomIds.length > 0) {
        socketRef.current.emit('track_rooms', { roomIds });
      }
    }
  }, [conversations.length]);


  const latestHistoryRequestRef = useRef(0);
  
  const fetchHistory = async (type, partner) => {
    if (!token) return;
    const requestId = ++latestHistoryRequestRef.current;
    
    // Normalize partner to lowercase for consistent lookup
    const cleanPartner = partner ? partner.toLowerCase() : '';
    
    // Always read from ref so we're never bound to stale render-cycle closures.
    const kp = keyPairRef.current;
    
    // Only block UI if we don't have any messages yet
    setLoading(messages.length === 0);
    try {
      const res = await fetch(`${API}/api/chats/history?type=${type}&partner=${cleanPartner}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const fetched = Array.isArray(data) ? data : [];

      // ─── E2EE Decryption for History ───
      const decrypted = await Promise.all(fetched.map(async (m) => {
        const mUserLower = myUsername?.toLowerCase();
        const msgIsMe = m.isMe || (m.senderName && m.senderName.toLowerCase() === mUserLower) || (m.username && m.username.toLowerCase() === mUserLower);

        if (!m.nonce) return { ...m, decryptedText: null }; 
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
                      const buff = await fetch(m.mediaUrl).then(r => r.arrayBuffer());
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
                      const buff = await fetch(m.mediaUrl).then(r => r.arrayBuffer());
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
                      const buff = await fetch(m.mediaUrl).then(r => r.arrayBuffer());
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

      if (requestId !== latestHistoryRequestRef.current) return;
      
      // Replace messages atomically — no merge needed since we cleared before fetching
      setMessages(resolveReplyMessages(decrypted));
    } catch(e) {
      if (requestId === latestHistoryRequestRef.current) console.error(e);
    } finally {
      if (requestId === latestHistoryRequestRef.current) setLoading(false);
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
      return updated.sort((a,b) => (Number(b.lastTimestamp)||0) - (Number(a.lastTimestamp)||0));
    });
    // Mark this chat as read
    if (onMarkRead) {
      onMarkRead(targetPartner);
    }
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
        message: replyToMsg.mediaType ? (replyToMsg.mediaType.startsWith('video') ? 'Video' : 'Photo') : (replyToMsg.decryptedText || (looksLikeCiphertext(replyToMsg.message||'') ? '' : (replyToMsg.message||'')))
      } : null
    };
    const previousConversations = [...conversations];
    
    setMessages(prev => [...prev, optimisticMsg]);
    setInputValue('');
    setReplyToMsg(null);
    
    // Immediately update sidebar preview and order for sender
    setConversations(prev => {
      const convs = Array.isArray(prev) ? prev : [];
      const partner = activeChat.partner || activeChat.id;
      const exists = convs.find(c => c.partner === partner || c.id === partner);
      const isGroup = activeChat.type === 'room';
      
      const previewText = inputValue.slice(0, 50);
      const updatedItem = exists 
        ? { ...exists, message: previewText, decryptedText: previewText, lastTimestamp: optimisticMsg.timestamp, lastSenderName: myUsername, unread: 0 }
        : { 
            id: isGroup ? partner : undefined,
            partner,
            displayName: activeChat.displayName,
            partnerAvatar: activeChat.partnerAvatar,
            lastTimestamp: optimisticMsg.timestamp,
            message: previewText,
            decryptedText: previewText,
            lastSenderName: myUsername,
            type: activeChat.type,
            unread: 0
          };
      const others = convs.filter(c => c.partner !== partner && c.id !== partner);
      return [updatedItem, ...others].sort((a,b) => (Number(b.lastTimestamp)||0) - (Number(a.lastTimestamp)||0));
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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');
    if (!isImg && !isVid) {
      toast.error('Only images and videos are supported');
      e.target.value = null;
      return;
    }

    // ── Client-side room permission check for media ──
    if (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) {
      toast.error('📷 Media sharing is not allowed in this room.');
      e.target.value = null;
      return;
    }

    // Optimistic placeholder
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
      timestamp: ts,
      _isOptimistic: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setIsUploading(true);
    e.target.value = null;

    try {
      const { encryptedBlob, mediaKeyBytes } = await encryptMedia(file);
      const mediaKeyB64 = encodeBase64(mediaKeyBytes);

      const fd = new FormData();
      fd.append('media', encryptedBlob, file.name);
      if (activeChat?.type === 'room') {
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

      const fullUrl = `${API}${uploadData.url}`;

      // ─── E2EE Encryption for Media ───
      let mediaNonce = null;
      let mediaEphemeral = null;
      let isEncrypted = false;
      let messagePayload = ''; 
      let senderMessagePayload = null;
      let e2eeKeysGroup = null;

      try {
        if (activeChat.type === 'private' && keyPair) {
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
        } else if (activeChat.type === 'room' && keyPair) {
          const roomIdStr = (activeChat.partner || activeChat.id).toLowerCase();
          const pkRes = await fetch(`${API}/api/rooms/${roomIdStr}/public-keys`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (pkRes.ok) {
            const pkData = await pkRes.json();
            const recipients = pkData.keys.map(k => ({ username: k.username, publicKey: robustDecode(k.publicKey) }));
            const enc = encryptGroupMessage(mediaKeyB64, recipients, keyPair, myUsername);
            messagePayload = enc.ciphertext;
            mediaNonce = enc.nonce;
            e2eeKeysGroup = enc.keys;
            mediaEphemeral = encodeBase64(keyPair.publicKey);
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
            message: replyToMsg.mediaType ? (replyToMsg.mediaType.startsWith('video') ? 'Video' : 'Photo') : (replyToMsg.decryptedText || replyToMsg.message)
          } : null,
          tempId: tempId
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
    // Optimistic delete
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      const qs = mode === 'local' ? '?action=local' : '';
      await fetch(`${API}/api/chats/message/${msgId}${qs}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch(e) { console.error('delete error', e); }
  };

  const openLightbox = (url, type) => setLightbox({ url, type });

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
        {/* Lightbox — rendered inside widget so clicks don't escape to parent */}
        {lightbox && (
          <MediaLightbox url={lightbox.url} type={lightbox.type} onClose={() => setLightbox(null)} />
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
                          <button onClick={() => { setClearChatModalOpen(activeChat); setShowChatMenu(false); }}
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
                          setConversations(prev =>
                            (Array.isArray(prev) ? prev : []).map(c => ({ ...c, unread: 0 }))
                          );
                          if (socketRef.current) {
                            socketRef.current.emit('chat:mark_all_read');
                          }
                          // Notify parent to clear all unread counts from its state
                          if (typeof onMarkRead === 'function') {
                            // We can loop through current conversations and mark each read in parent
                            conversations.forEach(c => onMarkRead(c.id || c.partner));
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
                        <img src={`${API}${u.avatarPath}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            return b.lastTimestamp - a.lastTimestamp;
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
                              <img src={`${API}${displayAvatar}`} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Users size={20} color="#fff" />
                            )}
                          </div>
                        ) : (
                          displayAvatar ? (
                            <img src={`${API}${displayAvatar}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: getAvatarColor(displayName || chat.partner), display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{getInitials(displayName || chat.partner)}</span>
                            </div>
                          )
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display:'flex', alignItems:'center', color: 'var(--header-text)' }}>
                            {displayName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {typingStatuses[chatKey] ? (
                              <div className="typing-dots">
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                              </div>
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
                            <span className="chat-tag" style={{ 
                              background: chat.type === 'room' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.2)', 
                              color: chat.type === 'room' ? '#818cf8' : '#4ade80',
                              padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', marginRight: 6, textTransform: 'uppercase', fontWeight: 600, flexShrink: 0
                            }}>
                              {chat.type}
                            </span>
                            <span className="chat-preview" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {(() => {
                                // If chat has been cleared / no messages yet, show a friendly placeholder
                                if (chat.type === 'room' && (!chat.lastTimestamp || chat.lastTimestamp === 0)) {
                                  return <span style={{ color: 'var(--menu-icon)' }}>Start a conversation</span>;
                                }
                                const mediaLabel = chat.lastMediaType ? (chat.lastMediaType.startsWith('video') ? 'Video' : 'Photo') : null;
                                const rawMsg = chat.message || '';
                                const msgLabel = mediaLabel || chat.decryptedText || (looksLikeCiphertext(rawMsg) ? (isMe ? 'Message sent' : 'Encrypted message') : (rawMsg || ''));
                                if (chat.type === 'room') {
                                  const senderLabel = isMe ? 'You' : (chat.lastSenderName || '');
                                  return senderLabel ? `${senderLabel}: ${msgLabel}` : msgLabel;
                                }
                                return `${isMe ? 'You: ' : ''}${msgLabel}`;
                              })()}
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
                      else setClearChatModalOpen(chat);
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
              onScroll={handleScroll}
              onClick={() => { setActiveReactionMsg(null); setShowAllEmojis(false); setShowEmojiPicker(false); setActiveMessageMenu(null); }} 
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}
            >
              {messages.length === 0 ? (
                loading ? (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13 }}>No messages yet. Say hi!</div>
                )
              ) : (
                messages.map((msg, i) => {
                  const mUserLower = myUsername?.toLowerCase();
                  const isMe = msg.isMe || 
                               (msg.senderName && msg.senderName.toLowerCase() === mUserLower) || 
                               (msg.username && msg.username.toLowerCase() === mUserLower);
                  const reactions = msg.reactions || {};
                  const isMediaOnly = !!(msg.mediaType && (!msg.decryptedText || msg.decryptedText === '') && (!msg.message || !msg.message.trim() || msg.nonce || msg.e2ee || looksLikeCiphertext(msg.message)));
                  return (
                    <div key={msg.tempId || msg.id || i} 
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
                           const aSrc = isBlocked ? null : (msg.senderAvatar ? `${API}${msg.senderAvatar}` : null);
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
                               {aSrc ? (<img src={aSrc} alt={sName} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex';}}/>) : null}
                               <span style={{display:aSrc?'none':'flex',color:'#fff',fontSize:11,fontWeight:700}}>{getInitials(sName)}</span>
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
                               onMouseLeave={() => setHoveredRowId(null)}>
                            <div className={`msg-bubble ${isMe ? 'msg-sent stay-white' : 'msg-received'}`} style={{
                               position: 'relative',
                               background: isMediaOnly ? 'transparent' : (transparentMode ? 'rgba(0,0,0,0.3)' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'))),
                               padding: isMediaOnly ? '0' : '10px 16px',
                               borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                               fontSize: 14, color: transparentMode ? '#fff' : (isMe ? '#ffffff' : (isLight ? '#000000' : '#ffffff')),
                               textShadow: transparentMode ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
                               maxWidth: '100%', wordBreak: 'break-word'
                             }}
                               onMouseEnter={() => setHoveredMsgId(msg.id||i)} 
                               onMouseLeave={() => setHoveredMsgId(null)}>
                              {msg.decryptedText !== null ? (
                                <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.decryptedText, isMe)}</div>
                              ) : (
                                (msg.message && looksLikeCiphertext(msg.message)) ? (
                                  <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}><em>Encrypted message</em></div>
                                ) : (
                                  msg.message && !msg.mediaType && <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.message, isMe)}</div>
                                )
                              )}
                              {(() => {
                                // Prefer async-decrypted blob URL if available, else fall back to msg.mediaUrl (optimistic blob)
                                const msgKey = String(msg.id || msg.timestamp);
                                const resolvedUrl = decryptedMediaUrls.current[msgKey] || msg.mediaUrl || null;
                                return resolvedUrl ? (
                                  <MediaBubble url={resolvedUrl} type={msg.mediaType} onOpenLightbox={openLightbox} onMediaLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })} />
                                ) : msg.mediaType ? (
                                  <div style={{ color: '#555', fontSize: 11, padding: '8px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Decrypting media…
                                  </div>
                                ) : null;
                              })()}
                              
                              {(hoveredMsgId === (msg.id||i) || activeMessageMenu === msg.id) && (
                                <div style={{position: 'absolute', top: isMediaOnly ? 4 : 2, right: isMediaOnly ? 4 : 2, zIndex: 20}}>
                                  <button onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowChatMenu(false); setShowAllEmojis(false); setActiveReactionMsg(null); }} style={{background:isMediaOnly ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
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
                                          <button onClick={() => { handleDeleteMessage(msg.id, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#ef4444', WebkitTextFillColor:'#ef4444', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', transition: 'background 0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                            <Trash2 size={12} color="#ef4444"/> {t('unsend', 'Unsend')}
                                          </button>
                                          <button onClick={() => { handleDeleteMessage(msg.id, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'var(--menu-item-text)', WebkitTextFillColor:'var(--menu-item-text)', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', transition: 'background 0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--menu-item-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                            <Trash2 size={12} color={isLight ? '#475569' : '#aaa'}/> {t('deleteForMe', 'Delete for me')}
                                          </button>
                                        </>
                                      ) : (
                                        <button onClick={() => { handleDeleteMessage(msg.id, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#ef4444', WebkitTextFillColor:'#ef4444', cursor:'pointer', padding:'8px 10px', fontSize:12, borderRadius:6, whiteSpace:'nowrap', transition: 'background 0.2s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
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
                                      <button onClick={(e)=>{e.stopPropagation(); setActiveReactionMsg(msg.id); setShowAllEmojis(true);}} style={{background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:12,width:26,height:26,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',color: isLight ? '#111' : '#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background= isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}><Plus size={14}/></button>
                                    </div>
                                  </div>
                                )}
                            </div>
                            
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

                          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                            <span style={{fontSize:10,color:'#444'}}>{formatDistanceToNow(Number(msg.timestamp) || Date.now())} ago</span>
                            <button onClick={(e) => { e.stopPropagation(); setReplyToMsg(msg); }} style={{background:'none',border:'none',color:'#555',cursor:'pointer',padding:0,fontSize:10,display:'flex',alignItems:'center',gap:3}}><Reply size={10}/>Reply</button>
                          </div>
                        </div>
                      </div>
                   </div>
                  );
                })
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
                      if (r.mediaType) return r.mediaType.startsWith('video') ? 'Video' : 'Photo';
                      if (r.decryptedText) return r.decryptedText.slice(0,50);
                      const raw = r.message || '';
                      if (typeof looksLikeCiphertext === 'function' && looksLikeCiphertext(raw)) return 'Message';
                      return raw.slice(0,50) || 'Media';
                    })()}</span>
                    <button onClick={()=>setReplyToMsg(null)} style={{background:'none',border:'none',color:'#666',cursor:'pointer'}}><X size={12}/></button>
                  </div>
                )}
                
                {showEmojiPicker && (
                  <div style={{position:'absolute', bottom:'100%', left:12, marginBottom:10, zIndex:100, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', borderRadius:10}} onClick={(e) => e.stopPropagation()}>
                    <Picker data={data} onEmojiSelect={(e) => { setInputValue(prev => prev + e.native); }} theme="dark" previewPosition="none" searchPosition="none" navPosition="bottom" />
                  </div>
                )}
                
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                />


                {activeChat && typingStatuses[activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner] && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 45, marginBottom: 8, fontSize: 11, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>
                      {[...typingStatuses[activeChat.type === 'room' ? (activeChat.partner || activeChat.id) : activeChat.partner]].join(', ')}
                    </span>
                    <span>is typing</span>
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
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
                  {activeChat?.type === 'room' && (() => {
                    const perms = activeChat.permissions;
                    const isHost = activeChat.isHost;
                    if (!perms || isHost) return null;
                    const chatLocked = perms.chat === 'host';
                    const linksBlocked = perms.allowLinks === false;
                    const mediaBlocked = perms.allowMedia === false;
                    if (!chatLocked && !linksBlocked && !mediaBlocked) return null;
                    return (
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
                    );
                  })()}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                      <input 
                        ref={inputRef}
                        type="text" 
                        placeholder={activeChat?.type === 'room' && activeChat.permissions?.chat === 'host' && !activeChat.isHost ? t('onlyHostCanMessage', 'Only the host can message...') : t('messagePlaceholder', 'Message...')}
                        disabled={!!(activeChat?.type === 'room' && activeChat.permissions?.chat === 'host' && !activeChat.isHost)}
                        value={inputValue}
                        onChange={e => {
                          setInputValue(e.target.value);
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
                          paddingRight: (!inputValue && !isUploading) ? '75px' : '18px',
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
                          <button type="button" onClick={()=>setShowEmojiPicker(!showEmojiPicker)} style={{background:'transparent',border:'none',color:'#555',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                            <SmilePlus size={20}/>
                          </button>
                          <button
                            type="button"
                            disabled={isUploading || !!(activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost)}
                            onClick={() => {
                              if (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) {
                                toast.error('📷 Media sharing is not allowed in this room.');
                                return;
                              }
                              fileInputRef.current?.click();
                            }}
                            title={activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost ? 'Media disabled by host' : 'Attach media'}
                            style={{
                              background:'transparent',border:'none',
                              color: (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) ? '#444' : (isUploading ? '#6366f1' : '#555'),
                              cursor: (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) ? 'not-allowed' : 'pointer',
                              display:'flex',alignItems:'center',justifyContent:'center',padding:4,
                              opacity: (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) ? 0.4 : 1
                            }}
                          >
                            <Paperclip size={18}/>
                          </button>
                        </div>
                      )}
                      
                      {isUploading && (
                        <div style={{ position: 'absolute', right: 12 }}>
                          <Loader2 size={18} className="animate-spin" color="#6366f1" />
                        </div>
                      )}
                    </div>

                    <button type="submit" disabled={(!inputValue.trim() && !isUploading) || !!(activeChat?.type === 'room' && activeChat.permissions?.chat === 'host' && !activeChat.isHost)} style={{
                      width:44, height:44, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#a855f7)', border:'none', color:'#fff', cursor: (activeChat?.type === 'room' && activeChat.permissions?.chat === 'host' && !activeChat.isHost) ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:((!inputValue.trim() && !isUploading) || (activeChat?.type === 'room' && activeChat.permissions?.chat === 'host' && !activeChat.isHost))?0.5:1, flexShrink: 0
                    }}>
                      <Send size={18} />
                    </button>
                  </div>
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
                  if (socketRef.current) socketRef.current.emit('clear_dm', { targetUsername: clearChatModalOpen.partner, clearForBoth }); 
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
                  if (socketRef.current) socketRef.current.emit('clear_room_chat', { roomId: clearGroupChatModalOpen.partner }); 
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
    </div>
  );
});

GlobalChatWidget.displayName = 'GlobalChatWidget';

export default GlobalChatWidget;







