import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ArrowLeft, Send, X, User, SmilePlus, Reply, Plus, MoreVertical, Search, Paperclip, Loader2, Play, Trash2, MoreHorizontal, ChevronDown, Lock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢'];
import { formatDistanceToNow } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';
import { useCrypto } from '../contexts/CryptoContext';
import { encryptDM, encryptGroupMessage, decryptDM, decryptGroupMessage, decryptDMSenderCopy, robustDecode, encryptMedia, decryptMedia } from '../lib/crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const API = 'http://127.0.0.1:3001';

// CSS for typing indicators
const typingCss = `
  @keyframes dot-wave {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .typing-dots { display: inline-flex; gap: 2px; align-items: center; margin-left: 4px; }
  .typing-dot { width: 4px; height: 4px; background: #6366f1; borderRadius: 50%; display: inline-block; animation: dot-wave 1.3s infinite ease-in-out; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
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
  activeRoomPartner
}, ref) => {
  const navigate = useNavigate();
  // ─── E2EE Keys ───
  const { keyPair, needsReauth, reloadPrivateKeyWithPassword, isReady } = useCrypto();
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
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [clearForBoth, setClearForBoth] = useState(false);
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
  const [mediaUrlVersion, setMediaUrlVersion] = useState(0); // bump to force re-render

  const token = localStorage.getItem('watch_token');
  const myUsername = localStorage.getItem('watch_username');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const activeChatRef = useRef(null);
  const viewRef = useRef('list');
  const containerRef = useRef(null);
  const processedMsgsRef = useRef(new Set());

  // Keep refs in sync with state (for use inside socket closures)
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { viewRef.current = view; }, [view]);
  const conversationsRef = useRef([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

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
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{color:isMe?'#fff':'#6366f1', textDecoration:'underline'}} onClick={e=>e.stopPropagation()}>{part}</a>;
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
    const sock = io('http://127.0.0.1:3001', { auth: { token }, transports: ['websocket'] });
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
      
      const isViewingThis = currentView === 'chat' && (currentChat?.partner === partner || currentChat?.id === partner);

      // Compute a short preview text
      const mediaPreview = msg.mediaUrl 
        ? (msg.mediaType?.startsWith('video') ? 'Video' : 'Photo') 
        : null;
      const previewText = mediaPreview || 
        (msg.message && looksLikeCiphertext(msg.message) ? '🔒 Encrypted message' : (msg.message || 'New message'));
      
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
            }
          } else {
            // DM Decryption
            if (isMine) {
              if (msg.mediaType) decryptedMessage = ''; // always clear encrypted media key from display
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
        (msg.decryptedText || (msg.message && looksLikeCiphertext(msg.message) ? '🔒 Encrypted message' : (msg.message || 'New message')));

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
              updated[optIdx] = { ...msg, decryptedText: safeDecryptedText, mediaUrl: safeMediaUrl, isMe: isMine, reactions: msg.reactions || {} };
              return updated;
            }
          }

          // Dedup by ID or by timestamp+sender (prevents double-socket delivery)
          const alreadyExists = prev.some(m =>
            (msg.id && String(m.id) === String(msg.id)) ||
            (msg.timestamp && m.timestamp && String(m.timestamp) === String(msg.timestamp) &&
             (m.senderName || m.username || m.senderId) === (msg.senderName || msg.username || msg.senderId))
          );
          if (alreadyExists) return prev;
          return [...prev, { ...msg, isMe: isMine, reactions: msg.reactions || {} }];
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
            // Robust Room Name Lookup from conversation cache if msg payload lacks it
            let groupName = msg.roomName || msg.displayName;
            if (isGroup && !groupName) {
               const cached = conversationsRef.current.find(c => c.partner === partner);
               if (cached) groupName = cached.displayName;
            }
            if (!groupName) groupName = isGroup ? 'Group Chat' : 'User';

            const msgSender = msg.senderName || msg.username || partner || 'User';
            
            const textToDisplay = isGroup 
              ? `${groupName}: ${msgSender}: ${finalizedPreview}`
              : `${msgSender}: ${finalizedPreview}`;

            toast(textToDisplay, { id: `msg-${msgKey || Date.now()}`, icon: '💬', duration: 3500 });
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
          const updatedItem = { 
            ...exists, 
            message: finalizedPreview, 
            lastTimestamp: msgTs, 
            lastSenderName: msg.senderName || msg.username, 
            unread: Number(exists.unread || 0) + (!isMine && !isViewingThis ? 1 : 0),
            // BUG FIX: Ensure we store the plain username in partner but keep display info
            partner: partner, 
            displayName: isGroup ? (msg.roomName || exists.displayName || 'Room Chat') : (msg.senderName || msg.username || exists.displayName || partner)
          };
          const others = conversations.filter(c => c.partner !== partner && c.id !== partner);
          updatedList = [updatedItem, ...others];
        } else {
          updatedList = [{
            id: isGroup ? partner : undefined,
            partner, // Unique ID (username or roomId)
            displayName: isGroup ? (msg.roomName || 'Room Chat') : (msg.senderName || msg.username || partner),
            partnerAvatar: msg.partnerAvatar || null,
            lastTimestamp: msgTs,
            message: finalizedPreview,
            lastSenderName: msg.senderName || msg.username,
            type: isGroup ? 'room' : 'private',
            unread: isMine ? 0 : 1
          }, ...conversations];
        }
        // Force LIFO sort
        return updatedList.sort((a,b) => (Number(b.lastTimestamp)||0) - (Number(a.lastTimestamp)||0));
      });
    };

    // new_chat_message: group notifications for other participants (sender excluded server-side)
    // private_message: DM delivery to both sender (isMe:true) and recipient (isMe:false)
    sock.on('chat_message', handleNewMsg);
    sock.on('new_chat_message', handleNewMsg);
    sock.on('global_new_chat_message', handleNewMsg);
    sock.on('private_message', handleNewMsg);

    // Re-unified typing indicator is now handled by sock.on('chat:typing') at the top
    sock.on('dm_cleared', ({ targetUsername }) => {
      // Only clear messages — keep the conversation entry in the list
      if (activeChatRef.current && activeChatRef.current.partner === targetUsername) {
        setMessages([]);
      }
      // Update the conversation preview to show empty state (no message)
      setConversations(prev => {
        const updated = prev.map(c =>
          c.partner === targetUsername
            ? { ...c, message: '', lastTimestamp: 0 }
            : c
        );
        // Remember this cleared partner in memory AND localStorage so we keep them after refresh
        const match = prev.find(c => c.partner === targetUsername);
        if (match) {
          const entry = { ...match, message: '', lastTimestamp: 0 };
          clearedPartnersRef.current = { ...clearedPartnersRef.current, [targetUsername]: entry };
          try { localStorage.setItem('chat_cleared_partners', JSON.stringify(clearedPartnersRef.current)); } catch {}
        }
        return updated;
      });
      // Do NOT navigate away — stay in the chat view
    });

    return () => { sock.disconnect(); socketRef.current = null; };
  }, [token, onNewMessage, isReady]);

  // Persist conversation list to localStorage whenever it changes (enables LIFO across refreshes)
  useEffect(() => {
    try {
      if (Array.isArray(conversations) && conversations.length > 0) {
        localStorage.setItem('watch_recent_chats', JSON.stringify(conversations));
      }
    } catch {}
  }, [conversations]);

  useEffect(() => {
    if (isOpen && view === 'list') {
      fetchConversations();
    }
  }, [isOpen, view]);

  // Reset to list view when widget is closed
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setActiveChat(null);
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
    setLoading(true);
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
            return { ...c, decryptedText: plainText };
          } else if (c.type === 'room' && c.e2ee && c.nonce) {
             if (!kp) return { ...c, decryptedText: null };
             try {
               const myLower = myUsername?.toLowerCase();
               const myEncKey = c.e2ee.keys?.[myLower] || Object.entries(c.e2ee.keys || {}).find(([k]) => k.toLowerCase() === myLower)?.[1];
               if (myEncKey && c.e2ee.senderPublicKey) {
                 const senderPubKey = decodeBase64(c.e2ee.senderPublicKey);
                 const plain = decryptGroupMessage(c.message, c.nonce, myEncKey, senderPubKey, kp.secretKey);
                 if (plain !== null) {
                   if (c.mediaUrl && c.mediaType) {
                     return { ...c, decryptedText: c.mediaType.startsWith('video') ? 'Video' : 'Photo' };
                   }
                   return { ...c, decryptedText: plain };
                 }
               }
             } catch(e) {}
             return { ...c, decryptedText: null };
          }
          return c;
       });
      
      // Merge: preserve dynamically-added real-time conversations not returned by server
      setConversations(prev => {
        const fetchedPartners = new Set(decryptedFetched.map(c => c.partner));
        // Keep conversations (private AND room) that server didn't return this cycle
        const preserved = (Array.isArray(prev) ? prev : []).filter(c => !fetchedPartners.has(c.partner));
        // Merge cleared-partner extras
        const extrasMap = clearedPartnersRef.current || {};
        const extras = Object.values(extrasMap).filter(c => !fetchedPartners.has(c.partner) && !preserved.find(p => p.partner === c.partner));

        // Bug 4 fix: If we already have lastSeen for a partner, trust local read state
        // and zero out any server unread count so going back from chat view doesn't re-show badge
        const finalFetched = decryptedFetched.map(c => {
          const chatKey = c.id || c.partner;
          const finalC = { ...c, targetId: c.partnerId || c.targetId };
          
          // Bug 5 fix: Keep real-time local state if it's newer than the cached server response
          const existing = Array.isArray(prev) ? prev.find(p => (p.id || p.partner) === chatKey) : null;
          if (existing && Number(existing.lastTimestamp) > Number(c.lastTimestamp)) {
            return { ...existing, targetId: finalC.targetId };
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
    
    setLoading(true);
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
      setMessages(decrypted);
    } catch(e) {
      if (requestId === latestHistoryRequestRef.current) console.error(e);
    } finally {
      if (requestId === latestHistoryRequestRef.current) setLoading(false);
    }
  };

  const openChat = async (chat) => {
    // Ensure we have the correct identifier for history
    const targetPartner = chat.id || chat.partner;

    // For room chats, attach permissions from the conversations list so the input UI can enforce them
    let chatPerms = chat.permissions || null;
    let chatIsHost = chat.isHost || false;
    if (chat.type === 'room' && !chatPerms) {
      const existing = Array.isArray(conversations)
        ? conversations.find(c => c.id === targetPartner || c.partner === targetPartner)
        : null;
      if (existing) {
        chatPerms = existing.permissions || null;
        chatIsHost = existing.isHost || false;
      }
    }

    const chatToOpen = { ...chat, partner: targetPartner, permissions: chatPerms, isHost: chatIsHost };
    
    setActiveChat(chatToOpen);
    setView('chat');
    setActiveRelation(null); // Reset
    setMessages([]); // Clear previous chat context immediately
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeChat) return;

    // ── Client-side room permission checks ──
    if (activeChat.type === 'room' && activeChat.permissions && !activeChat.isHost) {
      const perms = activeChat.permissions;
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
      timestamp: ts,
      replyTo: replyToMsg ? {
        id: replyToMsg.id,
        username: replyToMsg.senderName || replyToMsg.username || activeChat?.displayName,
        message: replyToMsg.message
      } : null
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setInputValue('');
    setReplyToMsg(null);
    
    // Immediately update sidebar preview and order for sender
    setConversations(prev => {
      const conversations = Array.isArray(prev) ? prev : [];
      const partner = activeChat.partner || activeChat.id;
      const exists = conversations.find(c => c.partner === partner || c.id === partner);
      const isGroup = activeChat.type === 'room';
      
      const previewText = inputValue.slice(0, 50);
      const updatedItem = exists 
        ? { ...exists, message: previewText, lastTimestamp: optimisticMsg.timestamp, lastSenderName: myUsername, unread: 0 }
        : { 
            id: isGroup ? partner : undefined,
            partner,
            displayName: activeChat.displayName,
            partnerAvatar: activeChat.partnerAvatar,
            lastTimestamp: optimisticMsg.timestamp,
            message: previewText,
            lastSenderName: myUsername,
            type: activeChat.type,
            unread: 0
          };
      const others = conversations.filter(c => c.partner !== partner && c.id !== partner);
      return [updatedItem, ...others].sort((a,b) => (Number(b.lastTimestamp)||0) - (Number(a.lastTimestamp)||0));
    });

    // ─── E2EE Encryption ───
    let messagePayload    = null; // [SECURE] Initialized to null
    let senderMessagePayload = null;
    let fallbackPlaintext = undefined;
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
             // isEncrypted remains false -> will throw security error below
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

      // STRICT SECURITY: For private chats, E2E encryption is mandatory.
      if (activeChat.type === 'private' && !isEncrypted) {
        console.error("[E2EE] Blocking insecure send — encryption keys missing.");
        throw new Error("Encryption keys missing. Message not sent for security.");
      }

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
      }
    } catch(e) {
      console.error(e);
      toast.error('Failed to send message. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
            message: replyToMsg.message
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
    <div ref={containerRef} onMouseDown={(e) => e.stopPropagation()} style={{
        position: 'fixed',
        top: 65,
        right: 0,
        width: 380,
        height: 'calc(100vh - 65px)',
        background: 'rgba(10, 10, 10, 0.75)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(200px) saturate(180%)',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        zIndex: 10000,
        overflow: 'hidden',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: "'Inter', sans-serif"
      }}>
        <style>{typingCss}</style>
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
          background: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.06)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {view === 'chat' && (
              <button onClick={() => setView('list')} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
                <ArrowLeft size={20} />
              </button>
            )}
            <span
              style={{
                fontWeight: 600, fontSize: '1.1rem',
                color: '#fff',
                textDecoration: 'none',
                cursor: view === 'chat' && activeChat?.type === 'private' ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (view === 'chat' && activeChat?.type === 'private' && activeChat?.partner) {
                  navigate(`/profile/${activeChat.partner}`);
                }
              }}
              title={view === 'chat' && activeChat?.type === 'private' ? `Go to ${activeChat?.partner}'s profile` : ''}
            >
              {view === 'list' ? 'Conversations' : activeChat?.displayName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {view === 'chat' && activeChat && (
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowChatMenu(!showChatMenu); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
                  <MoreVertical size={20} />
                </button>
                {showChatMenu && (
                  <>
                    {/* Invisible overlay to catch outside clicks */}
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
                      onClick={() => setShowChatMenu(false)}
                    />
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 4, zIndex: 100000, minWidth: 140, boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
                      
                      {activeChat.type === 'private' && (
                        <button onClick={() => {
                          setClearChatModalOpen(true);
                          setShowChatMenu(false);
                        }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#ef4444', textAlign: 'left', cursor: 'pointer', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                          Clear Chat
                        </button>
                      )}

                      {activeChat.type === 'room' && (
                        <button disabled={!activeChat.isHost} onClick={() => {
                          if (!activeChat.isHost) {
                             toast.error('Only host can rename room');
                             return;
                          }
                          setRenameInput(activeChat.displayName);
                          setRenameModalOpen(true);
                          setShowChatMenu(false);
                        }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: activeChat.isHost?'pointer':'not-allowed', opacity: activeChat.isHost?1:0.5, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                          Edit Name
                        </button>
                      )}
                      
                    </div>
                  </>
                )}
              </div>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {view === 'list' && (
            <div style={{ padding: '16px 20px', position: 'relative', background: 'rgba(0,0,0,0.2)', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#666" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.06)';
                    e.target.style.borderColor = 'rgba(99,102,241,0.3)';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.04)';
                    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
              </div>
            </div>
          )}

          {loading && <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading...</div>}
          
          {!loading && view === 'list' && searchQuery && (
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
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{u.displayName || u.username}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>@{u.username}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 13 }}>No users found matching "{searchQuery}"</div>
              )}
            </div>
          )}

          {!loading && view === 'list' && !searchQuery && conversations.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No recent chats.</div>
          )}

          {!loading && view === 'list' && !searchQuery && conversations.map((chat, idx) => {
            const chatKey = chat.id || chat.partner;
            // unreadCounts from Home.jsx is for the navbar badge only — don't add it here or it doubles the count
            const unread = chat.unread || 0;
            const isMe = (chat.lastSenderName === myUsername);
            return (
              <div key={idx} onClick={() => openChat(chat)} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                transition: 'background 0.2s'
              }} 
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: '50%', background: '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {chat.type === 'room' ? (
                    // For group/room chats: show a gradient group avatar with members icon
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                      {chat.partnerAvatar ? (
                        <img src={`${API}${chat.partnerAvatar}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      )}
                    </div>
                  ) : (
                    chat.partnerAvatar ? (
                      <img src={`${API}${chat.partnerAvatar}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: getAvatarColor(chat.displayName || chat.partner), display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{getInitials(chat.displayName || chat.partner)}</span>
                      </div>
                    )
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display:'flex', alignItems:'center' }}>
                      {chat.displayName}
                      {typingStatuses[chatKey] && (
                        <div className="typing-dots">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {chat.lastTimestamp > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap' }}>
                          {formatDistanceToNow(Number(chat.lastTimestamp))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <span style={{ 
                        background: chat.type === 'room' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.2)', 
                        color: chat.type === 'room' ? '#818cf8' : '#4ade80',
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', marginRight: 6, textTransform: 'uppercase', fontWeight: 600, flexShrink: 0
                      }}>
                        {chat.type}
                      </span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {isMe ? 'You: ' : ''}{chat.decryptedText || (looksLikeCiphertext(chat.message) ? '🔒 Encrypted message' : (chat.message || ''))}
                      </span>
                    </div>
                    {unread > 0 && (
                      <div style={{
                        background: '#ef4444', borderRadius: '50%', color: '#fff',
                        fontSize: 10, fontWeight: 'bold', minWidth: 18, height: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', marginLeft: 8, flexShrink: 0
                      }}>
                        {unread > 99 ? '99+' : unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Key-loading overlay: brief spinner while PBKDF2 restores key from sessionStorage ── */}
          {!loading && view === 'chat' && !isReady && !keyPair && (
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

          {/* ── Re-auth overlay: shown when session key is missing (tab was closed) ── */}
          {!loading && view === 'chat' && isReady && needsReauth && !keyPair && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.88)',
              backdropFilter: 'blur(8px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, borderRadius: '0'
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
                Enter your password
              </p>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 20, textAlign: 'center', maxWidth: 260 }}>
                Your session key expired. Enter your login password to decrypt messages.
              </p>
              <input
                type="password"
                placeholder="Your password"
                value={reauthPassword}
                onChange={e => { setReauthPassword(e.target.value); setReauthError(''); }}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter' || reauthLoading) return;
                  setReauthLoading(true);
                  setReauthError('');
                  try {
                    await reloadPrivateKeyWithPassword(reauthPassword);
                    setReauthPassword('');
                  } catch (err) {
                    setReauthError(err.message?.includes('Wrong') || err.message?.includes('decrypt') ? 'Wrong password. Try again.' : (err.message || 'Failed. Try again.'));
                  } finally { setReauthLoading(false); }
                }}
                style={{
                  padding: '11px 14px', borderRadius: 10, width: 240,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: 14, outline: 'none'
                }}
                autoFocus
              />
              {reauthError && (
                <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{reauthError}</p>
              )}
              <button
                disabled={reauthLoading || !reauthPassword}
                onClick={async () => {
                  setReauthLoading(true);
                  setReauthError('');
                  try {
                    await reloadPrivateKeyWithPassword(reauthPassword);
                    setReauthPassword('');
                  } catch (err) {
                    setReauthError(err.message?.includes('Wrong') || err.message?.includes('decrypt') ? 'Wrong password. Try again.' : (err.message || 'Failed. Try again.'));
                  } finally { setReauthLoading(false); }
                }}
                style={{
                  marginTop: 12, padding: '10px 28px', borderRadius: 10, border: 'none',
                  background: reauthLoading || !reauthPassword ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366f1,#a855f7)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: reauthLoading || !reauthPassword ? 'not-allowed' : 'pointer'
                }}
              >
                {reauthLoading ? 'Unlocking…' : 'Unlock Messages'}
              </button>
              <p style={{ color: '#555', fontSize: 11, marginTop: 12 }}>End-to-end encrypted · key never sent to server</p>
            </div>
          )}

          {!loading && view === 'chat' && (
            <div onClick={() => { setActiveReactionMsg(null); setShowAllEmojis(false); setShowEmojiPicker(false); setActiveMessageMenu(null); }} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', marginTop: 20, fontSize: 13 }}>No messages yet. Say hi!</div>
              ) : (
                messages.map((msg, i) => {
                  const mUserLower = myUsername?.toLowerCase();
                  const isMe = msg.isMe || 
                               (msg.senderName && msg.senderName.toLowerCase() === mUserLower) || 
                               (msg.username && msg.username.toLowerCase() === mUserLower);
                  const reactions = msg.reactions || {};
                  return (
                   <div key={msg.id||i} 
                        style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                      {msg.replyTo && (
                        <div style={{background:'rgba(255,255,255,0.05)',borderLeft:`3px solid ${isMe?'#6366f1':'#a855f7'}`,borderRadius:6,padding:'4px 8px',fontSize:11,color:'#888',maxWidth:'80%'}}>
                          <span style={{color:isMe?'#6366f1':'#a855f7',fontWeight:600}}>{msg.replyTo.username || msg.replyTo.senderName}: </span>{msg.replyTo.message?.slice(0,60)}
                        </div>
                      )}
                      <div style={{display:'flex',alignItems:'flex-start',gap:8,flexDirection:isMe?'row-reverse':'row',maxWidth:'95%'}}>
                         {/* Profile avatar — left side for all incoming messages */}
                         {!isMe && (() => {
                           const sName = msg.senderName || msg.username || '?';
                           const aSrc = msg.senderAvatar ? `${API}${msg.senderAvatar}` : null;
                           return (
                             <div
                               onClick={(e) => { e.stopPropagation(); navigate(`/profile/${sName}`); }}
                               title={`View ${sName}'s profile`}
                               style={{ flexShrink:0, cursor:'pointer', width:32, height:32, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:getAvatarColor(sName), marginTop:2 }}
                             >
                               {aSrc ? (<img src={aSrc} alt={sName} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{e.target.style.display='none'; if(e.target.nextSibling) e.target.nextSibling.style.display='flex';}}/>) : null}
                               <span style={{display:aSrc?'none':'flex',color:'#fff',fontSize:11,fontWeight:700}}>{getInitials(sName)}</span>
                             </div>
                           );
                         })()}
                        <div style={{display:'flex',flexDirection:'column',gap:2,alignItems:isMe?'flex-end':'flex-start'}}>
                          {!isMe && activeChat?.type === 'room' && (
                            <span
                              onClick={(e) => { e.stopPropagation(); if (msg.senderName) navigate(`/profile/${msg.senderName}`); }}
                              style={{ fontSize: 10, color: '#888', marginBottom: 1, cursor: 'pointer' }}
                              title={`View ${msg.senderName}'s profile`}
                            >{msg.senderName}</span>
                          )}
                          <div style={{position:'relative', display:'flex', alignItems:'center'}}
                               onMouseEnter={() => setHoveredRowId(msg.id||i)} 
                               onMouseLeave={() => setHoveredRowId(null)}>
                            <div style={{
                              position: 'relative',
                              background: (msg.mediaUrl && !msg.message) ? 'transparent' : (isMe ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.06)'),
                              padding: (msg.mediaUrl && !msg.message) ? '0' : '8px 12px',
                              borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                              fontSize: 14, color: isMe ? '#fff' : '#ddd',
                              maxWidth: '100%', wordBreak: 'break-word'
                            }}
                               onMouseEnter={() => setHoveredMsgId(msg.id||i)} 
                               onMouseLeave={() => setHoveredMsgId(null)}>
                              {msg.decryptedText !== null ? (
                                <div style={{whiteSpace:"pre-wrap"}}>{renderMessageText(msg.decryptedText, isMe)}</div>
                              ) : (
                                (msg.message && looksLikeCiphertext(msg.message)) ? (
                                  <div style={{whiteSpace:'pre-wrap', opacity:0.5, fontSize:12, display:'flex', alignItems:'center', gap:4}}>🔒 <em>Encrypted message</em></div>
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
                                <div style={{position: 'absolute', top: (msg.mediaUrl && !msg.message) ? 4 : 2, right: (msg.mediaUrl && !msg.message) ? 4 : 2, zIndex: 20}}>
                                  <button onClick={(e)=>{ e.stopPropagation(); setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id); setShowAllEmojis(false); setActiveReactionMsg(null); }} style={{background:(msg.mediaUrl && !msg.message) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',backdropFilter:'blur(4px)',border:'none',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',padding:2, opacity: 0.8}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.8}>
                                    <ChevronDown size={14}/>
                                  </button>
                                  {activeMessageMenu === msg.id && (
                                    <div style={{position:'absolute', top:'100%', [isMe?'right':'left']:0, marginTop:4, background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:4, zIndex:100, boxShadow:'0 4px 12px rgba(0,0,0,0.5)', minWidth: 140}} onClick={e => e.stopPropagation()}>
                                      {isMe ? (
                                        <>
                                          <button onClick={() => { handleDeleteMessage(msg.id, 'global'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                            <Trash2 size={12}/> Unsend
                                          </button>
                                          <button onClick={() => { handleDeleteMessage(msg.id, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#aaa', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                            <Trash2 size={12}/> Delete for me
                                          </button>
                                        </>
                                      ) : (
                                        <button onClick={() => { handleDeleteMessage(msg.id, 'local'); setActiveMessageMenu(null); }} style={{display:'flex', alignItems:'center', gap:6, width:'100%', background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:'6px 8px', fontSize:12, borderRadius:4, whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                          <Trash2 size={12}/> Delete
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {activeReactionMsg === msg.id && !showAllEmojis && (
                                <div style={{position:'absolute', bottom:'100%', [isMe?'right':'left']:0, marginBottom:8, zIndex:100}}>
                                  <div style={{background:'rgba(26,26,46,0.95)',backdropFilter:'blur(4px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius: 30,padding:'6px 8px',display:'flex',alignItems:'center',gap:6,width:'max-content',boxShadow:'0 8px 24px rgba(0,0,0,0.6)'}}>
                                    {(QUICK_EMOJIS).map(em=>(
                                      <button key={em} onClick={(e)=>{e.stopPropagation(); handleReact(msg.id, em);}} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:'4px',borderRadius:8,transition:'transform 0.1s',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.3)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>{em}</button>
                                    ))}
                                    <button onClick={(e)=>{e.stopPropagation(); setShowAllEmojis(true);}} style={{background:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',fontSize:12,width:26,height:26,borderRadius:'50%',marginLeft:2,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',transition:'background 0.2s'}} onMouseEnter={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e)=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}><Plus size={14}/></button>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                                                    <div style={{position:'absolute', top:'50%', transform:'translateY(-50%)', [isMe?'right':'left']:'100%', padding:isMe?'0 6px 0 0':'0 0 0 6px', opacity: (activeReactionMsg === msg.id || hoveredRowId === (msg.id||i)) ? 1 : 0, transition: 'opacity 0.2s', zIndex:10, display:'flex', alignItems:'center', gap:2}} className={`react-btn-${msg.id||i}`}>
                              <button onClick={(e)=>{ e.stopPropagation(); setActiveReactionMsg(activeReactionMsg===msg.id?null:msg.id); setShowAllEmojis(false); setActiveMessageMenu(null); }} style={{background:'transparent',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#aaa',padding:2}}>
                                <SmilePlus size={16}/>
                              </button>
                            </div>
                          </div>

                          {/* Render active reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={{display:'flex',gap:4,marginTop:2,flexWrap:'wrap',justifyContent:isMe?'flex-end':'flex-start'}}>
                              {Object.entries(msg.reactions).map(([em, users]) => users.length > 0 && (
                                <span key={em} onClick={(e)=>{e.stopPropagation(); handleReact(msg.id, em);}} style={{background:'rgba(255,255,255,0.1)',borderRadius:10,padding:'2px 6px',fontSize:11,cursor:'pointer',userSelect:'none'}}>
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

          {/* Full Emoji Picker positioned inside chat container */}
          {showAllEmojis && activeReactionMsg && (
            <div style={{position:'absolute', bottom: 76, right: 16, zIndex: 99999, boxShadow:'0 8px 32px rgba(0,0,0,0.8)', borderRadius:10}}>
              <Picker data={data} theme="dark" previewPosition="none" searchPosition="none" navPosition="bottom" perLine={6} onEmojiSelect={(emojiObj) => { setShowAllEmojis(false); handleReact(activeReactionMsg, emojiObj.native); }}/>
            </div>
          )}
        </div>

        {/* Input area for chat view */}
        {view === 'chat' && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.2)',
            flexShrink: 0,
            position: 'relative'
          }}>
            {activeChat.type === 'private' && activeRelation && !(activeRelation.followStatus === 'accepted' && activeRelation.isFollowingMe) ? (
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Friendship Required</div>
                <p style={{ fontSize: 11, color: '#888', margin: 0, lineHeight: 1.5 }}>
                  {activeRelation.followStatus === 'accepted' 
                    ? `Waiting for ${activeChat.displayName} to follow you back.` 
                    : activeRelation.isFollowingMe 
                      ? `You need to follow ${activeChat.displayName} back to chat.`
                      : `You need to follow each other to start messaging.`}
                </p>
                {activeRelation.followStatus !== 'accepted' && (
                  <button onClick={() => navigate(`/profile/${activeChat.partner}`)} style={{ marginTop: 12, padding: '8px 16px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    View Profile
                  </button>
                )}
              </div>
            ) : (
              <>
                {replyToMsg && (
                  <div style={{padding:'6px 12px',marginBottom:6,background:'rgba(99,102,241,0.08)',borderTop:'1px solid rgba(99,102,241,0.2)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'#a0aab2'}}>
                    <span><span style={{color:'#6366f1',fontWeight:600}}>{replyToMsg.senderName || replyToMsg.username || activeChat?.displayName}: </span>{replyToMsg.message?.slice(0,50)}</span>
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
                    const linksBlocked = perms.allowLinks === false;
                    const mediaBlocked = perms.allowMedia === false;
                    if (!linksBlocked && !mediaBlocked) return null;
                    return (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        {linksBlocked && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: '#f59e0b',
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                            borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
                          }}>🔗 Links disabled</span>
                        )}
                        {mediaBlocked && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: '#f59e0b',
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                            borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3
                          }}>📷 Media disabled</span>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" onClick={()=>setShowEmojiPicker(!showEmojiPicker)} style={{background:'transparent',border:'none',color:'#aaa',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
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
                      color: (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) ? '#555' : (isUploading ? '#6366f1' : '#aaa'),
                      cursor: (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) ? 'not-allowed' : 'pointer',
                      display:'flex',alignItems:'center',justifyContent:'center',padding:4,
                      opacity: (activeChat?.type === 'room' && activeChat.permissions?.allowMedia === false && !activeChat.isHost) ? 0.4 : 1
                    }}
                  >
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18}/>}
                  </button>
                  <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="Message..."
                    value={inputValue}
                    onChange={e => {
                      setInputValue(e.target.value);
                      
                      // Emit typing status
                      if (socketRef.current && activeChat) {
                        socketRef.current.emit('chat:typing', { 
                          partner: activeChat.type === 'room' ? activeChat.partner || activeChat.id : activeChat.partner, 
                          type: activeChat.type 
                        });
                        
                        // Clear existing stop-typing timeout
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        
                        // Set new timeout to stop typing after 3 seconds of inactivity
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
                      borderRadius: 12,
                      padding: '10px 16px',
                      color: '#fff',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'background 0.2s'
                    }}
                    onFocus={e => e.target.style.background = 'rgba(255,255,255,0.07)'}
                    onBlur={e => e.target.style.background = 'rgba(255,255,255,0.04)'}
                  />
                  <button type="submit" disabled={!inputValue.trim() && !isUploading} style={{
                    width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(!inputValue.trim() && !isUploading)?0.5:1
                  }}>
                    <Send size={15} />
                  </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
        {/* Clear Chat Modal */}
        {clearChatModalOpen && activeChat && (
          <div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
              <h3 style={{marginTop:0,color:'#fff',fontSize:18,marginBottom:12}}>Clear Chat</h3>
              <p style={{color:'#aaa',fontSize:14,marginBottom:16,lineHeight:1.4}}>Are you sure you want to clear your chat history with <strong>{activeChat.displayName}</strong>?</p>
              <label style={{display:'flex',alignItems:'center',gap:8,color:'#eee',fontSize:13,marginBottom:24,cursor:'pointer'}}>
                <input type="checkbox" checked={clearForBoth} onChange={e=>setClearForBoth(e.target.checked)} style={{accentColor:'#ef4444',cursor:'pointer'}}/>
                Also clear chat history for {activeChat.displayName}
              </label>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button onClick={()=>setClearChatModalOpen(false)} style={{padding:'8px 16px',background:'transparent',border:'none',color:'#aaa',cursor:'pointer',fontWeight:600}}>Cancel</button>
                <button onClick={()=>{ 
                  if (socketRef.current) socketRef.current.emit('clear_dm', { targetUsername: activeChat.partner, clearForBoth }); 
                  setClearChatModalOpen(false); 
                  setClearForBoth(false); 
                }} style={{padding:'8px 16px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600}}>Clear Chat</button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Room Modal */}
        {renameModalOpen && activeChat && (
          <div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
              <h3 style={{marginTop:0,color:'#fff',fontSize:18,marginBottom:16}}>Rename Room</h3>
              <form onSubmit={(e)=>{ 
                e.preventDefault(); 
                if(renameInput.trim()){ 
                  if (socketRef.current) {
                    socketRef.current.emit('mod_rename_room',{roomId: activeChat.partner, newName: renameInput.trim()});
                    setActiveChat(prev => ({ ...prev, displayName: renameInput.trim() }));
                    setConversations(prev => prev.map(c => c.partner === activeChat.partner ? { ...c, displayName: renameInput.trim() } : c));
                    toast.success('Room renamed successfully');
                  }
                  setRenameModalOpen(false); 
                } 
              }}>
                <input value={renameInput} onChange={e=>setRenameInput(e.target.value)} autoFocus style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'#fff',marginBottom:20,fontSize:14,outline:'none'}} placeholder="Enter new name..."/>
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <button type="button" onClick={()=>setRenameModalOpen(false)} style={{padding:'8px 16px',background:'transparent',border:'none',color:'#aaa',cursor:'pointer',fontWeight:600}}>Cancel</button>
                  <button type="submit" style={{padding:'8px 16px',background:'linear-gradient(135deg,#6366f1,#a855f7)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600}}>Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
  );
});

GlobalChatWidget.displayName = 'GlobalChatWidget';

export default GlobalChatWidget;





