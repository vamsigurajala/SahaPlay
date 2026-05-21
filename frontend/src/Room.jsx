import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { clearUserSession } from './lib/authUtils.js';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import io from 'socket.io-client';
import GlobalChatWidget from './components/GlobalChatWidget';
import RoomChatPanel from './components/RoomChatPanel';
import RoomModals from './components/RoomModals';
import RoomSettingsModal from './components/RoomSettingsModal';
import YouTubeBrowserModal from './components/YouTubeBrowserModal';
import TwitchBrowserModal from './components/TwitchBrowserModal';
import VimeoBrowserModal from './components/VimeoBrowserModal';
import MediaSelectorModal from './components/MediaSelectorModal';
import GuidedShareModal from './components/GuidedShareModal';
import BanConfirmModal from './components/BanConfirmModal';
import ReactPlayerRaw from 'react-player/lazy';
const ReactPlayer = ReactPlayerRaw.default || ReactPlayerRaw;
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { useCrypto } from './contexts/CryptoContext';
import { encryptGroupMessage, decryptGroupMessage, decryptDM, encryptDM, decryptDMSenderCopy, encryptMedia, decryptMedia, robustDecode } from './lib/crypto.js';
import crownImg from './assets/crown.svg';
import { LayoutGrid, Upload, Link as LinkIcon, MessageSquare, Monitor, MonitorPlay, Users, Send, VolumeX, Volume2, Ban, Flag, Play, Pause, Square, X, Share2, MessageCircle, MicOff, LogOut, Reply, Lock, Hash, ChevronLeft, ChevronRight, Settings, Settings2, Video, VideoOff, Mic, MoreVertical, Edit2, Trash2, Globe, Pin, Star, Shield, ShieldOff, SmilePlus, Plus, Maximize, Volume1, Activity, Search, Bell, HelpCircle, User, UserMinus, Cast } from 'lucide-react';
import { FaWhatsapp, FaTelegramPlane, FaYoutube, FaTwitch, FaVimeo, FaSoundcloud, FaInstagram, FaSnapchatGhost, FaDiscord, FaRedditAlien, FaFacebookF, FaLinkedinIn, FaPinterestP, FaApple, FaSpotify, FaTiktok } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiNetflix, SiCrunchyroll, SiHbomax, SiAppletv, SiGmail } from 'react-icons/si';
import toast, { Toaster } from 'react-hot-toast';

// Always connect to port 3001 via HTTP — works for both localhost and LAN IPs (e.g. 192.168.x.x)
// LAN mode is used when the TV/phone opens the app from the Cast URL on the same WiFi network
const SOCKET_SERVER_URL = `http://${window.location.hostname}:3001`;
const QUICK_EMOJIS = ['👍', '❤️', '😊', '😮', '😢'];
const ALL_EMOJIS = ['👍', '❤️', '😊', '😮', '😢', '😍', '🤣', '😂', '🤔', '😎', '😁', '😅', '✨', '🙏', '💚', '💛', '💝', '🤗', '😻', '🥰', '🎉', '😪', '😒', '✔️', '🤞', '😽', '😡', '🤢', '🤡', '🤫'];

// -------------------------------- Helpers --------------------------------
function getInitials(name) { return (name || '?').slice(0, 2).toUpperCase(); }
function getAvatarColor(name) {
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316', '#10b981', '#3b82f6', '#06b6d4'];
  let h = 0; for (let c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}
function formatTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.4);
  } catch (e) { }
}

// -------------------------------- Avatar --------------------------------
function Avatar({ name, size = 36, isHost = false, isAdmin = false, isMuted = false, src, avatarPath, style = {} }) {
  const bg = getAvatarColor(name);
  const imgUrl = src || avatarPath;

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
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0,
        border: `2px solid ${borderColor}`,
        boxShadow: shadow,
        overflow: 'hidden'
      }}>
        {imgUrl ? (
          <img 
            src={imgUrl} 
            alt={name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <span style={{ display: imgUrl ? 'none' : 'flex' }}>{getInitials(name)}</span>
      </div>
      {isMuted && <div className="stay-white" style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #111' }}><MicOff size={8} color="#fff" /></div>}
    </div>
  );
}

// -------------------------------- Video Tile --------------------------------
function VideoTile({ stream, isMuted, style }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.error('Video play error:', e);
        if (e.name === 'NotAllowedError') {
          setPlayBlocked(true);
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.error('Muted fallback failed:', err));
        }
      });
    }
  }, [stream]);

  const handleUnmute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().then(() => setPlayBlocked(false)).catch(console.error);
    }
  };

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted={isMuted} style={style} />
      {playBlocked && !isMuted && (
        <button onClick={handleUnmute} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, zIndex: 10, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}>
          <VolumeX size={18} />
          <span style={{ fontSize: 10, fontWeight: 700 }}>{t('clickToUnmute', 'Click to unmute')}</span>
        </button>
      )}
    </>
  );
}

// -------------------------------- Main Room Component --------------------------------
function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false;
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
}

// Second-pass resolver: after decrypting history, replaces any ciphertext stored in
// replyTo.message with the decryptedText of the original message in the same batch.
function resolveReplyMessages(messages) {
  return messages.map(m => {
    if (!m.replyTo) return m;
    const raw = m.replyTo.message || '';
    if (raw && !looksLikeCiphertext(raw)) return m; // already a readable preview — keep it
    const original = messages.find(o => String(o.id) === String(m.replyTo.id));
    if (!original) return m;
    const resolved =
      original.decryptedText ||
      (original.mediaType ? (original.mediaType.startsWith('video') ? 'Video' : 'Photo') : '') ||
      (looksLikeCiphertext(original.message || '') ? '' : (original.message || ''));
    return { ...m, replyTo: { ...m.replyTo, message: resolved } };
  });
}

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const urlParams = new URLSearchParams(window.location.search);
  const isTvMode = urlParams.get('mode') === 'tv';

  const [username, setUsername] = useState(localStorage.getItem('watch_username') || '');
  const usernameRef = useRef(username);
  useEffect(() => { usernameRef.current = username; }, [username]);

  const [socket, setSocket] = useState(null);
  // socketRef always points to the latest live socket — used inside toast closures
  // which capture their environment at creation time and would otherwise hold stale refs.
  const socketRef = useRef(null);
  // Keep socketRef in sync with the socket state so closures always have the live socket
  useEffect(() => { socketRef.current = socket; }, [socket]);

  const [userList, setUserList] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [knownUsers, setKnownUsers] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('watch_known_users') || '[]'));
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('watch_known_users', JSON.stringify(Array.from(knownUsers)));
  }, [knownUsers]);
  const [knownAvatars, setKnownAvatars] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('watch_known_avatars') || '{}');
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('watch_known_avatars', JSON.stringify(knownAvatars));
  }, [knownAvatars]);
  const [circleCams, setCircleCams] = useState(new Set());
  const [camSizes, setCamSizes] = useState({}); // { camId: width }
  const [camPositions, setCamPositions] = useState({}); // { id: { x, y } }
  const resizingCamRef = useRef(null); // { id, startX, startWidth }
  const draggingCamRef = useRef(null); // { id, startX, startY, initialX, initialY }
  const [hasStartedCamOnce, setHasStartedCamOnce] = useState(false);
  const [hiddenCams, setHiddenCams] = useState(new Set());
  const [isDraggingCam, setIsDraggingCam] = useState(false);
  const [isOverRemoveZone, setIsOverRemoveZone] = useState(false);
  const isOverRemoveRef = useRef(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [clearChatTarget, setClearChatTarget] = useState(null);
  const [clearForBoth, setClearForBoth] = useState(false);
  
  const broadcastUIState = useCallback((customData = {}) => {
    if (!socket) return;
    const data = {
      camPositions: customData.camPositions || camPositions,
      camSizes: customData.camSizes || camSizes,
      circleCams: Array.from(customData.circleCams || circleCams),
    };
    socket.emit('ui_sync', { roomId, data });
  }, [socket, roomId, camPositions, camSizes, circleCams]);

  const [profile, setProfile] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [followRequests, setFollowRequests] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const navIconsRef = useRef(null);
  const chatWidgetRef = useRef(null);
  // Ref for the fullscreen global-chat toggle button — excluded from the outside-click
  // handler so mousedown on the button doesn't close the widget before onClick toggles it.
  const fsGlobalChatBtnRef = useRef(null);
  const fetchProfile = useCallback(async () => {
    const tkn = localStorage.getItem('watch_token');
    if (!tkn) return;
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/profile`, { headers: { 'Authorization': `Bearer ${tkn}` } });
      const data = await res.json();
      if (data && !data.error) setProfile(data);
    } catch { }
  }, [SOCKET_SERVER_URL]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    clearUserSession();
    window.location.reload();
  };

  const mySocketIdRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const userPanelRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(null);
  const [kickedReason, setKickedReason] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [modMenuTarget, setModMenuTarget] = useState(null);
  const [modMenuPos, setModMenuPos] = useState({ top: 0, left: 0 });
  const [showHeaderModMenu, setShowHeaderModMenu] = useState(false);
  const [headerModMenuPos, setHeaderModMenuPos] = useState({ top: 0, left: 0 });
  const [pinnedRooms, setPinnedRooms] = useState(() => { try { return JSON.parse(localStorage.getItem('pinned_rooms') || '[]'); } catch { return []; } });
  const [roomSettingsModalOpen, setRoomSettingsModalOpen] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const settingsRef = useRef(null);

  const [mediaUrl, setMediaUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [videoPlatform, setVideoPlatform] = useState('direct');
  const [platformData, setPlatformData] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isGuestVerified, setIsGuestVerified] = useState(() => localStorage.getItem('watch_is_guest') !== 'true');
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationTime, setPreparationTime] = useState(25); // Increased for 4K stability
  const [prepProgress, setPrepProgress] = useState(0);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const lastPrepUrl = useRef('');

  const containerRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(() => sessionStorage.getItem(`lobby_waiting_${roomId}`) === 'true');
  const [isConnecting, setIsConnecting] = useState(!isWaitingApproval);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const lobbyKey = `lobby_waiting_${roomId}`;

  useEffect(() => {
    if (!room && !kickedReason && !roomNotFound && !isWaitingApproval) {
      const timer = setTimeout(() => {
        setLoadTimeout(true);
        setIsConnecting(false); // Stop blocking even if it takes too long
      }, 15000);
      return () => clearTimeout(timer);
    } else {
      setLoadTimeout(false);
      setIsConnecting(false);
    }
  }, [room, kickedReason, roomNotFound]);
  const [joinRequests, setJoinRequests] = useState([]);
  const activeJoinToastIds = useRef(new Set());
  const prevShowUserPanel = useRef(false);

  const showJoinRequestToast = useCallback((sockId, requesterName, requesterAvatar) => {
    // console.log(`[TOAST] showJoinRequestToast for ${requesterName}. Current size: ${activeJoinToastIds.current.size}`);
    if (activeJoinToastIds.current.size >= 2) return; 

    const toastId = `join-req-${requesterName}`;
    const toastDuration = Infinity;

    activeJoinToastIds.current.add(toastId);
    toast.dismiss(toastId, 'system');
    setTimeout(() => {
      toast.custom(
        (toastState) => {
          const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: isLightMode ? '#ffffff' : 'linear-gradient(135deg, rgba(15, 10, 35, 0.99), rgba(25, 15, 50, 0.99))',
              border: isLightMode ? '1px solid #e2e8f0' : '1px solid rgba(168, 85, 247, 0.4)',
              borderRadius: 20, padding: '18px 20px',
              boxShadow: isLightMode ? '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' : '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(168,85,247,0.1)',
              backdropFilter: 'blur(12px)',
              minWidth: 340, maxWidth: 420,
              animation: toastState.visible ? 'slideInDown 0.35s cubic-bezier(0.21,1.02,0.73,1)' : 'slideOutUp 0.3s ease forwards',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Purple glow accent top bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)', borderRadius: '20px 20px 0 0' }} />
              
              {/* Avatar */}
              {requesterAvatar ? (
                <img src={requesterAvatar.startsWith('http') ? requesterAvatar : `${SOCKET_SERVER_URL}${requesterAvatar}`} alt={requesterName} style={{
                  width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
                  boxShadow: isLightMode ? '0 0 0 2px #fff, 0 2px 8px rgba(99,102,241,0.2)' : '0 0 0 3px rgba(168,85,247,0.25), 0 4px 12px rgba(99,102,241,0.4)',
                  animation: 'joinPulse 2s infinite', flexShrink: 0
                }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0,
                  boxShadow: isLightMode ? '0 0 0 2px #fff, 0 2px 8px rgba(99,102,241,0.2)' : '0 0 0 3px rgba(168,85,247,0.25), 0 4px 12px rgba(99,102,241,0.4)',
                  animation: 'joinPulse 2s infinite',
                }}>
                  {requesterName ? requesterName[0].toUpperCase() : '?'}
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <p style={{ margin: 0, color: isLightMode ? '#0f172a' : '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>{requesterName}</p>
                  <span style={{ fontSize: 10, background: isLightMode ? '#f3e8ff' : 'rgba(168,85,247,0.2)', color: isLightMode ? '#9333ea' : '#c084fc', borderRadius: 6, padding: '2px 7px', fontWeight: 600, border: isLightMode ? '1px solid #e9d5ff' : '1px solid rgba(168,85,247,0.3)' }}>{t('joinRequest', 'JOIN REQUEST')}</span>
                </div>
                <p style={{ margin: '0 0 12px', color: isLightMode ? '#64748b' : 'rgba(255,255,255,0.5)', fontSize: 13 }}>{t('wantsToJoinThisRoom', 'wants to join this room')}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="join-req-deny-btn"
                    onClick={() => {
                      if (socketRef.current) socketRef.current.emit('deny_join', { roomId, targetSocketId: sockId });
                      setJoinRequests(prev => prev.filter(r => r.socketId !== sockId));
                      toast.dismiss(toastId, 'system');
                      activeJoinToastIds.current.delete(toastId);
                      if (notifSettingsRef.current.app && notifSettingsRef.current.joinRequests) {
                        setTimeout(() => toast(t('deniedUser', 'Denied {{username}}', { username: requesterName }), { icon: '🚫', duration: 2500 }), 320);
                      }
                    }}
                  >
                    {t('deny', 'Deny')}
                  </button>
                  <button
                    className="stay-white join-req-approve-btn"
                    onClick={() => {
                      if (socketRef.current) socketRef.current.emit('approve_join', { roomId, targetSocketId: sockId });
                      setJoinRequests(prev => prev.filter(r => r.socketId !== sockId));
                      toast.dismiss(toastId, 'system');
                      activeJoinToastIds.current.delete(toastId);
                      if (notifSettingsRef.current.app && notifSettingsRef.current.joinRequests) {
                        setTimeout(() => toast.success(t('approvedUser', '{{username}} approved!', { username: requesterName }) + ' ✓', { duration: 2500 }), 320);
                      }
                    }}
                  >
                    ✓ {t('approve', 'Approve')}
                  </button>
                </div>
              </div>
            </div>
          );
        },
        { id: toastId, position: 'top-center', duration: toastDuration, toasterId: 'system' }
      );

      // If it's a temporary toast, ensure it's removed from the Set after it expires
      if (toastDuration !== Infinity) {
        setTimeout(() => {
          activeJoinToastIds.current.delete(toastId);
        }, toastDuration + 1000); // 1s buffer for exit animations
      }
    }, 50);
  }, [roomId, socket, SOCKET_SERVER_URL]);

  useEffect(() => {
    if (showUserPanel) {
      // Dismiss all toasts when panel opens
      activeJoinToastIds.current.forEach(id => toast.dismiss(id, 'system'));
      activeJoinToastIds.current.clear();
    } else if (prevShowUserPanel.current === true && !showUserPanel) {
      // Transitioned from open to closed -> re-show only the first 2 pending requests
      joinRequests.slice(0, 2).forEach(req => {
        showJoinRequestToast(req.socketId, req.username, req.avatarPath);
      });
    }
    prevShowUserPanel.current = showUserPanel;
  }, [showUserPanel, joinRequests, showJoinRequestToast]);

  const [showYtBrowser, setShowYtBrowser] = useState(false);
  const [showTwitchBrowser, setShowTwitchBrowser] = useState(false);
  const [showVimeoBrowser, setShowVimeoBrowser] = useState(false);
  const [showPlayerBranding, setShowPlayerBranding] = useState(true);

  // Smart Buffering & High-Watermark Monitoring (every 500ms)
  useEffect(() => {
    let checkInterval;
    let safetyTimeout;

    if (isPreparing && mediaUrl && playerRef.current) {
      // Hard safety timeout: don't block the user forever if buffer detection fails
      safetyTimeout = setTimeout(() => {
        setIsPreparing(false);
      }, 30000); // 30s timeout for 4K

      checkInterval = setInterval(() => {
        const internal = playerRef.current.getInternalPlayer();
        const duration = playerRef.current.getDuration();
        let loadedSeconds = 0;

        if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
          const fraction = playerRef.current.getInternalPlayer()?.getVideoLoadedFraction() || 0;
          loadedSeconds = fraction * duration;
        } else if (internal?.buffered && internal.buffered.length > 0) {
          const buffered = internal.buffered;
          const current = playerRef.current.getCurrentTime() || 0;
          for (let i = 0; i < buffered.length; i++) {
            if (buffered.start(i) <= current + 1.0 && buffered.end(i) >= current) {
              loadedSeconds = buffered.end(i) - current;
              break;
            }
          }
        }

        setBufferedSeconds(Math.floor(loadedSeconds));
        // Progress toward 25s goal
        const progress = Math.min((loadedSeconds / 25) * 100, 100);
        setPrepProgress(progress);

        // --- Gate Check ---
        if (loadedSeconds >= 25 || (duration > 0 && Math.abs(duration - playerRef.current.getCurrentTime()) < 1.0)) {
          console.log('[SMOOTHING] Ready. Resetting to start.');
          setIsPreparing(false);
          setBufferedSeconds(0);
          clearTimeout(safetyTimeout);
          // Jump back to start so user doesn't miss the beginning while ghost-buffering
          playerRef.current.seekTo(0);
        }
      }, 500);
    }
    return () => {
      clearInterval(checkInterval);
      clearTimeout(safetyTimeout);
    };
  }, [isPreparing, mediaUrl]);

  // Universal Pre-loading Trigger
  useEffect(() => {
    if (mediaUrl && mediaUrl !== lastPrepUrl.current) {
      lastPrepUrl.current = mediaUrl;
      setIsPreparing(true);
      setPrepProgress(0);
      setBufferedSeconds(0);
    }
  }, [mediaUrl]);
  const [useCustomTwitchControls, setUseCustomTwitchControls] = useState(true);
  const [useCustomVimeoControls, setUseCustomVimeoControls] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const inactivityTimer = useRef(null);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [showGuidedShare, setShowGuidedShare] = useState(null);
  const [activeExternalApp, setActiveExternalApp] = useState(null);
  const [banConfirmTarget, setBanConfirmTarget] = useState(null);
  const [isFloatingBarMinimized, setIsFloatingBarMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCastDiscovery, setShowCastDiscovery] = useState(false);

  // Monitor browser-level fullscreen changes to sync UI state
  useEffect(() => {
    const onFullscreenChange = () => {
      const entering = !!document.fullscreenElement;
      setIsFullscreen(entering);
      // Auto-close global chat when exiting fullscreen so it doesn't
      // unexpectedly reappear as a normal-mode panel.
      if (!entering) setShowRecentChats(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleNavigateHome = (menu = 'selector') => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsPlaying(false);
    openDiscoveryMenu(menu);
  };

  const getAppIcon = (appId) => {
    switch (appId) {
      case 'netflix': return SiNetflix;
      case 'hbomax': return SiHbomax;
      case 'crunchyroll': return SiCrunchyroll;
      case 'youtube': return FaYoutube;
      case 'twitch': return FaTwitch;
      case 'vimeo': return FaVimeo;
      case 'spotify': return FaSpotify;
      case 'apple': return FaApple;
      case 'appletv': return SiAppletv;
      case 'tiktok': return FaTiktok;
      case 'instagram': return FaInstagram;
      case 'soundcloud': return FaSoundcloud;
      default: return Monitor;
    }
  };

  function isEmbedPlatform(url) {
    if (!url) return false;
    return /youtube\.com|youtu\.be|twitch\.tv|vimeo\.com|soundcloud\.com/i.test(url);
  }

  function isNSFWUrl(url) {
    if (!url) return false;
    const nsfwKeywords = ['porn', 'xxx', 'sex', 'xrated', 'nsfw', 'adult', 'erotic', 'brazers', 'redtube', 'xvideos', 'pornhub', 'youporn'];
    const nsfwDomains = ['pornhub.com', 'xvideos.com', 'redtube.com', 'youporn.com', 'xnxx.com', 'brazzers.com', 'xhamster.com', 'chaturbate.com', 'bongacams.com'];
    const lowerUrl = url.toLowerCase();
    return nsfwKeywords.some(k => lowerUrl.includes(k)) || nsfwDomains.some(d => lowerUrl.includes(d));
  }

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (playerWrapRef.current?.requestFullscreen) {
        playerWrapRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  function formatDuration(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(1);
  const [lastNonDuckedVolume, setLastNonDuckedVolume] = useState(1);
  const [isDucking, setIsDucking] = useState(false);
  const audioContextRef = useRef(null);
  const analyzersRef = useRef(new Map());
  const [playerMuted, setPlayerMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);
  const playerWrapRef = useRef(null);

  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  // Tracking intentional navigation vs page refresh
  const isUnloadingRef = useRef(false);
  useEffect(() => {
    const handleBeforeUnload = () => { isUnloadingRef.current = true; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  const [chatTab, setChatTab] = useState('list');
  const [groupMessages, setGroupMessages] = useState([]);
  const [dmTarget, setDmTarget] = useState(null);
  const dmTargetRef = useRef(null);
  const [dmThreads, setDmThreads] = useState({});
  const [dmUnread, setDmUnread] = useState({});
  const dmUnreadRef = useRef({});
  // Async-decrypted DM media blob URLs: msgKey -> objectURL (same pattern as GlobalChatWidget)
  const dmDecryptedMediaUrls = useRef({});
  const [dmMediaUrlVersion, setDmMediaUrlVersion] = useState(0);
  const groupDecryptedMediaUrls = useRef({});
  const [groupMediaUrlVersion, setGroupMediaUrlVersion] = useState(0);
  const [groupUnread, setGroupUnread] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
      return stored[roomId] || 0;
    } catch { return 0; }
  });


  const chatTabRef = useRef('list');
  const [groupChatInput, setGroupChatInput] = useState('');
  const [dmChatInput, setDmChatInput] = useState('');
  const [groupReplyTo, setGroupReplyTo] = useState(null);
  const [dmReplyTo, setDmReplyTo] = useState(null);
  const [roomName, setRoomName] = useState('Room Chat');
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showDmMenu, setShowDmMenu] = useState(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false);
  const [showDmEmojiPicker, setShowDmEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const groupMessagesRef = useRef([]);
  const dmInputRef = useRef(null);
  const groupInputRef = useRef(null);
  const groupMenuRef = useRef(null);
  const dmMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const inNavArea = navIconsRef.current && navIconsRef.current.contains(e.target);
      const inChatWidget = chatWidgetRef.current && chatWidgetRef.current.contains(e.target);
      // Also exclude the fullscreen chat toggle button itself so mousedown doesn't
      // close the widget before the button's onClick has a chance to toggle it.
      const inFsGlobalChatBtn = fsGlobalChatBtnRef.current && fsGlobalChatBtnRef.current.contains(e.target);
      if (!inNavArea && !inChatWidget) {
        setShowSearch(false);
        setShowNotifications(false);
        // Only close showRecentChats if click is outside widget
      }
      if (showUserPanel && userPanelRef.current && !userPanelRef.current.contains(e.target)) {
        setShowUserPanel(false);
      }
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
      if (showRecentChats && chatWidgetRef.current && !chatWidgetRef.current.contains(e.target)) {
        if (!inNavArea && !inFsGlobalChatBtn) setShowRecentChats(false);
      }
      // Close room menus if clicking outside
      if (showGroupMenu && groupMenuRef.current && !groupMenuRef.current.contains(e.target)) {
        setShowGroupMenu(false);
      }
      if (showDmMenu && dmMenuRef.current && !dmMenuRef.current.contains(e.target)) {
        setShowDmMenu(null);
      }
      // Also close reaction pickers
      if (activeReactionMsg || showAllEmojis) {
        const isPicker = e.target.closest('.emoji-picker-container') || e.target.closest('.react-btn-container');
        if (!isPicker) {
          setActiveReactionMsg(null);
          setShowAllEmojis(false);
        }
      }
      if ((modMenuTarget || showHeaderModMenu) && !e.target.closest('.mod-menu-container') && !e.target.closest('.mod-btn')) {
        setModMenuTarget(null);
        setShowHeaderModMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserPanel, showSettings, showRecentChats, showSearch, showNotifications, showGroupMenu, showDmMenu, activeReactionMsg, showAllEmojis, modMenuTarget, showHeaderModMenu]);

  useEffect(() => {
    if (chatTab === 'group') {
      setTimeout(() => groupInputRef.current?.focus(), 50);
    } else if (chatTab === 'dm') {
      setTimeout(() => dmInputRef.current?.focus(), 50);
    }
  }, [chatTab, dmTarget, groupReplyTo, dmReplyTo]);

  useEffect(() => {
    const tkn = localStorage.getItem('watch_token');
    if (!tkn) return;
    const getLastSeen = () => {
      try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; }
    };
    const checkUnread = async () => {
      try {
        const lastSeen = getLastSeen();
        const param = encodeURIComponent(JSON.stringify(lastSeen));
        const res = await fetch(`${SOCKET_SERVER_URL}/api/chats/recent?lastSeen=${param}`, { headers: { 'Authorization': `Bearer ${tkn}` } });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        const serverCounts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = chat.id || chat.partner;
          if (chat.unread && chat.unread > 0) {
            serverCounts[chatKey] = chat.unread;
            total += chat.unread;
            localCounts[chatKey] = chat.unread;
          } else {
            delete localCounts[chatKey];
          }
        });
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
        setUnreadCounts(prev => {
          const merged = { ...serverCounts };
          for (const key of Object.keys(prev)) {
            if ((prev[key] || 0) > (merged[key] || 0)) {
              merged[key] = prev[key];
            }
          }
          let mergedTotal = 0;
          Object.values(merged).forEach(v => { mergedTotal += v; });
          setTotalUnread(mergedTotal);
          return merged;
        });
      } catch { }
    };
    checkUnread();
    const inv = setInterval(checkUnread, 5000);
    return () => clearInterval(inv);
  }, []);

  // ── Search Logic ──
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const tkn = localStorage.getItem('watch_token');
        const res = await fetch(`${SOCKET_SERVER_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { 'Authorization': `Bearer ${tkn}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) setSearchResults(data);
      } catch { }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Follow Notifications ──
  useEffect(() => {
    const tkn = localStorage.getItem('watch_token');
    if (!tkn) return;
    const fetchFollows = async () => {
      try {
        const res = await fetch(`${SOCKET_SERVER_URL}/api/profile/notifications`, {
          headers: { 'Authorization': `Bearer ${tkn}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) setFollowRequests(data);
      } catch { }
    };
    fetchFollows();
    const inv = setInterval(fetchFollows, 10000);
    return () => clearInterval(inv);
  }, []);

  const handleNewMessage = useCallback((partner, msg) => {
    const chatKey = partner;
    if (showRecentChats && chatWidgetRef.current?.activeChat?.partner === partner) return;
    if (partner === roomId && chatTabRef.current === 'group') return;

    // Check if muted before playing sound
    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}

    if (!isMuted) {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(()=>{});
      } catch(e){}
    }

    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[chatKey] = (localCounts[chatKey] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));

    setUnreadCounts(prev => ({ ...prev, [chatKey]: (prev[chatKey] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, [roomId, showRecentChats]);


  const handleMarkRead = useCallback((chatId) => {
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    lastSeen[chatId] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));

    setUnreadCounts(prev => {
      const currentUnread = prev[chatId] || 0;
      if (currentUnread > 0) {
        setTotalUnread(t => Math.max(0, t - currentUnread));
      }
      const next = { ...prev };
      delete next[chatId];
      return next;
    });

    try {
      const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      if (localCounts[chatId]) {
        delete localCounts[chatId];
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
      }
    } catch(e) {}

    if (chatId === roomId) {
      setGroupUnread(0);
      try {
        const groupUnreadStore = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
        delete groupUnreadStore[chatId];
        localStorage.setItem('chat_group_unread', JSON.stringify(groupUnreadStore));
      } catch {}
    }

    const tkn = localStorage.getItem('watch_token');
    if (tkn) {
      const param = encodeURIComponent(JSON.stringify(lastSeen));
      fetch(`${SOCKET_SERVER_URL}/api/chats/recent?lastSeen=${param}`, {
        headers: { 'Authorization': `Bearer ${tkn}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            let total = 0;
            data.forEach(c => { total += (c.unread || 0); });
            setTotalUnread(total);
          }
        }).catch(() => { });
    }
  }, [roomId, SOCKET_SERVER_URL]);

  useEffect(() => {
    const tkn = localStorage.getItem('watch_token');
    if (tkn) {
      fetch(`${SOCKET_SERVER_URL}/api/profile`, { headers: { 'Authorization': `Bearer ${tkn}` } })
        .then(r => r.json())
        .then(data => {
          if (data.pinnedRooms) {
            try {
              const arr = JSON.parse(data.pinnedRooms);
              setPinnedRooms(arr);
              localStorage.setItem('pinned_rooms', JSON.stringify(arr));
            } catch (e) { }
          }
        }).catch(() => { });
    }
  }, []);

  const notifSettingsRef = useRef({
    app: true,
    join: true,
    leave: true,
    messages: true,
    friendRequests: true,
    joinRequests: true
  });

  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    if (token) {
      fetch(`${SOCKET_SERVER_URL}/api/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (!data.error) {
            notifSettingsRef.current = {
              app: data.notifyApp !== 0 && data.notifyApp !== false,
              join: data.notifyJoin !== 0 && data.notifyJoin !== false,
              leave: data.notifyLeave !== 0 && data.notifyLeave !== false,
              messages: data.notifyMessages !== 0 && data.notifyMessages !== false,
              friendRequests: data.notifyFriendRequests !== 0 && data.notifyFriendRequests !== false,
              joinRequests: data.notifyJoinRequests !== 0 && data.notifyJoinRequests !== false
            };
          }
        }).catch(err => console.error('notif sync err', err));
    }
  }, []);

  const myKeyPair = useRef(null);
  const peerPublicKeys = useRef({});   // socketId → Uint8Array (real-time, from user_list)
  const dbPublicKeys = useRef({});     // username.toLowerCase() → Uint8Array (from API, reliable fallback)
  const publicKeySentRef = useRef(false);

  const playerRef = useRef(null);
  const appWindowRef = useRef(null);
  const lastExternalUpdate = useRef(0);
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const [isScreensharing, setIsScreensharing] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const userCount = userList.length;

  const [isCamOn, setIsCamOn] = useState(false);
  const isCamOnRef = useRef(false);
  const [isMicOnCam, setIsMicOnCam] = useState(false);
  const [camPage, setCamPage] = useState(0);
  const localCamRef = useRef(null);
  const cameraPcRefs = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});

  const isWebIframe = (url) => {
    if (!url) return false;
    return url.includes('crazygames.com') || url.includes('slither.io') || url.includes('krunker.io') || url.includes('smashkarts.io');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setActiveReactionMsg(null);
    setShowAllEmojis(false);
    if (chatTab === 'dm' && dmTarget) {
      setDmUnread(prev => {
        const next = { ...prev };
        const oldVal = next[dmTarget] || 0;
        delete next[dmTarget];
        setTotalUnread(t => Math.max(0, t - oldVal));
        return next;
      });
      try {
        const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
        lastSeen[dmTarget] = Date.now();
        localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
      } catch { }
    } else if (chatTab === 'group') {
      setTotalUnread(t => Math.max(0, t - groupUnread));
      setGroupUnread(0);
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
      try {
        const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
        lastSeen[roomId] = Date.now();
        localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
        // Clear the persisted group unread for this room
        const groupUnreadStore = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
        delete groupUnreadStore[roomId];
        localStorage.setItem('chat_group_unread', JSON.stringify(groupUnreadStore));
      } catch { }
      // Also emit mark_read to sync across all tabs and devices
      if (socket) socket.emit('chat:mark_read', { chatId: roomId, timestamp: Date.now() });
    }
  }, [chatTab, dmTarget, roomId]);

  const prevGroupLen = useRef(groupMessages.length);
  const prevDmLen = useRef(dmThreads[dmTarget]?.length || 0);
  const prevDmTarget = useRef(dmTarget);

  useLayoutEffect(() => {
    const dmLen = dmThreads[dmTarget]?.length || 0;
    if (groupMessages.length > prevGroupLen.current || dmLen > prevDmLen.current || dmTarget !== prevDmTarget.current) {
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
    prevGroupLen.current = groupMessages.length;
    prevDmLen.current = dmLen;
    prevDmTarget.current = dmTarget;
  }, [groupMessages.length, dmThreads[dmTarget]?.length, dmTarget]);

  useLayoutEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [chatTab]);

  useEffect(() => {
    if (videoRef.current) {
      if (isViewer && remoteStream) videoRef.current.srcObject = remoteStream;
      else if (isScreensharing && localStreamRef.current) videoRef.current.srcObject = localStreamRef.current;
    }
  }, [remoteStream, isViewer, isScreensharing]);

  useEffect(() => { setHasMounted(true); }, []);

  // ─── E2EE: Get key pair from CryptoContext (never from localStorage) ───────
  const { keyPair, isReady: cryptoReady } = useCrypto();
  useEffect(() => {
    if (keyPair) {
      myKeyPair.current = keyPair;
      // Clean up old insecure localStorage key if it exists
      localStorage.removeItem(`e2e_keypair_${username}`);

      const publicKeyB64 = encodeBase64(keyPair.publicKey);

      // ─── Persist public key to DB immediately (handles old accounts + timing race) ───
      const token = localStorage.getItem('watch_token');
      if (token) {
        fetch(`${SOCKET_SERVER_URL}/api/auth/save-public-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ publicKey: publicKeyB64 })
        }).catch(err => console.warn('[E2EE] Failed to persist publicKey to DB:', err));
      }

      // ─── Re-emit via socket in case socket connected before keyPair was ready ───
      if (socket && socket.connected && roomId) {
        socket.emit('chat:publicKey', { roomId: (roomId || '').toLowerCase(), publicKey: publicKeyB64 });
      }
    }
  }, [keyPair, username]);
  useEffect(() => {
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (isGuest && room && !isWaitingApproval && !roomNotFound && !kickedReason) {
      const guestNotifKey = `guest_alert_shown_${roomId}`;
      if (!sessionStorage.getItem(guestNotifKey)) {
        sessionStorage.setItem(guestNotifKey, 'true');
        toast((toastItem) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Welcome, Guest! 👋</div>
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
              Guests have restricted access. You cannot send messages, use media controls, or create rooms. Please log in to unlock all features.
            </div>
          </div>
        ), { duration: 8000, style: { background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#e0f2fe' }});
      }
    }
  }, [room, isWaitingApproval, roomNotFound, kickedReason, roomId]);

  const handleLeaveRoom = useCallback(() => {
    toast.remove(); // Immediately purge ALL toasts from the global store (no replay on next page)
    // No need to manually emit leave_room here anymore as the useEffect cleanup handles it,
    // but keeping it for immediate server-side state reset before navigation completes.
    socket?.emit('leave_room', { roomId });
    navigate('/');
  }, [socket, roomId, navigate]);

  useEffect(() => {
    if (!roomId || !cryptoReady) return;
    const token = localStorage.getItem('watch_token');
    
    console.log(`[SOCKET] Connecting to ${SOCKET_SERVER_URL} for room ${roomId}`);
    const sock = io(SOCKET_SERVER_URL, { 
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });
    setSocket(sock);

    sock.on('connect', () => {
      console.log('[SOCKET] Connected to server');
      mySocketIdRef.current = sock.id;
      setMySocketId(sock.id);
      sock.emit('join_room', { roomId: (roomId || '').toLowerCase(), username });
      sock.emit('webrtc_cam_ping', { roomId: (roomId || '').toLowerCase() });
      if (myKeyPair.current && myKeyPair.current.publicKey) {
        sock.emit('chat:publicKey', { roomId: (roomId || '').toLowerCase(), publicKey: encodeBase64(myKeyPair.current.publicKey) });
      }
    });

    sock.on('disconnect', (reason) => console.log('[SOCKET] Disconnected:', reason));
    sock.on('connect_error', err => console.error('[SOCKET] Connection error:', err));

    sock.on('waiting_for_approval', () => {
      sessionStorage.setItem(lobbyKey, 'true');
      setIsWaitingApproval(true);
      setIsConnecting(false);
    });
    sock.on('join_approved', () => {
      sessionStorage.removeItem(lobbyKey);
      setIsWaitingApproval(false);
    });
    sock.on('join_denied', () => {
      sessionStorage.removeItem(lobbyKey);
      setIsWaitingApproval(false);
      setKickedReason('denied');
      setIsConnecting(false);
    });
    sock.on('room_kicked', ({ reason }) => {
      setKickedReason(reason);
      sock.disconnect();
    });
    sock.on('ui_sync', (data) => {
      if (data.camPositions) setCamPositions(data.camPositions);
      if (data.camSizes) setCamSizes(data.camSizes);
      if (data.circleCams) setCircleCams(new Set(data.circleCams));
    });
    sock.on('remote_command', ({ command, mediaUrl: mUrl, isScreensharing: isSharing, senderName }) => {
      if (command === 'go_fullscreen_and_play') {
        toast(`Host (${senderName}) is pushing stream to this device...`, { icon: '📺', duration: 4000 });
        if (!document.fullscreenElement) {
          handleFullscreen();
        }
        setUiVisible(false);
      }
    });
    sock.on('join_rejected', ({ reason }) => {
      sessionStorage.removeItem(lobbyKey);
      setIsWaitingApproval(false);
      setKickedReason(reason);
      setIsConnecting(false);
    });
    sock.on('join_requested', ({ socketId, username: requesterName, avatarPath }) => {
      // ALWAYS update state so the request is tracked in the room state
      setJoinRequests(prev => {
        const exists = prev.find(r => r.socketId === socketId || r.username === requesterName);
        if (exists) return prev;
        return [...prev, { socketId, username: requesterName, avatarPath }];
      });

      // Only show the toast if the user panel is NOT open and we have less than 2 toasts
      if (!showUserPanel && activeJoinToastIds.current.size < 2) {
        showJoinRequestToast(socketId, requesterName, avatarPath);
      }
    });

    sock.on('join_request_handled', ({ socketId, username: handledUsername }) => {
      // Dismiss by username-based ID (new) and legacy socketId-based ID (backwards compat)
      if (handledUsername) {
        const tid = `join-req-${handledUsername}`;
        toast.dismiss(tid, 'system');
        activeJoinToastIds.current.delete(tid);
      }
      toast.dismiss(`join-req-${socketId}`, 'system');
      activeJoinToastIds.current.delete(`join-req-${socketId}`);
      setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
    });


    sock.on('connect_error', err => console.error('Socket error:', err));

    sock.on('room_renamed', name => {
      setRoomName(name);
      syncRecentChat({ roomName: name });
    });
    sock.on('dm_cleared', ({ userA, userB, clearedBy, clearForBoth }) => {
      if (!clearForBoth && username !== clearedBy) return;
      const otherUser = userA === username ? userB : userA;
      setDmThreads(prev => ({ ...prev, [otherUser]: [] }));
      if (clearForBoth) {
        sock.emit('request_dm_history', roomId);
      }
    });

    sock.on('room_chat_cleared', ({ roomId: targetRoomId }) => {
      if (roomId === targetRoomId) {
        setGroupMessages([]);
      }
    });

    const syncRecentChat = (data) => {
      try {
        const rid = (roomId || '').toLowerCase();
        const cached = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
        let changed = false;
        const updated = cached.map(c => {
          if (c.type === 'room' && c.partner?.toLowerCase() === rid) {
            let next = { ...c };
            if (data.roomName && next.displayName !== data.roomName) { next.displayName = data.roomName; changed = true; }
            if (data.thumbnailPath !== undefined && next.partnerAvatar !== data.thumbnailPath) { next.partnerAvatar = data.thumbnailPath; changed = true; }
            return next;
          }
          return c;
        });
        if (changed) {
          localStorage.setItem('watch_recent_chats', JSON.stringify(updated));
          window.dispatchEvent(new Event('conversations_updated'));
        }
      } catch(e){}
    };

    sock.on('room_state', state => {
      console.log('[SOCKET] Received room_state');
      sessionStorage.removeItem(lobbyKey);
      setIsWaitingApproval(false);
      setIsConnecting(false);
      
      // Frontend Security Fail-Safe: Enforce Members Only lock proactively
      const isGuest = localStorage.getItem('watch_is_guest') === 'true';
      if (isGuest) {
        if (state.settings?.onlyLoggedIn) {
          setKickedReason('members_only');
          sock.disconnect();
          return;
        } else {
          setIsGuestVerified(true);
        }
      }

      setRoom(state);
      if (state.roomName) setRoomName(state.roomName);
      if (state.currentMedia) setMediaUrl(state.currentMedia);
      if (state.isPublic !== undefined) setIsPublic(state.isPublic);
      if (state.activeExternalApp) setActiveExternalApp(state.activeExternalApp);
      
      if (state.uiState) {
        if (state.uiState.camPositions) setCamPositions(state.uiState.camPositions);
        if (state.uiState.camSizes) setCamSizes(state.uiState.camSizes);
        if (state.uiState.circleCams) setCircleCams(new Set(state.uiState.circleCams));
      }
      
      syncRecentChat({ roomName: state.roomName, thumbnailPath: state.thumbnailPath });
      
      // Central screenshare synchronization:
      // If someone else is screensharing, ensure I am in "Viewer" mode.
      const isOthersSharing = state.screenshareHostId && state.screenshareHostId !== sock.id;
      setIsViewer(!!isOthersSharing);
      if (isOthersSharing) {
        console.log('[RTC] Joining existing screenshare from state:', state.screenshareHostId);
        setActiveExternalApp(state.activeExternalApp);
        sock.emit('webrtc_join_request', { targetSocketId: state.screenshareHostId });
      }

      setTimeout(() => {
        if (playerRef.current && state.currentTime > 0) { lastExternalUpdate.current = Date.now(); playerRef.current.seekTo(state.currentTime, 'seconds'); }
        setIsPlaying(state.isPlaying);
      }, 500);
    });

    sock.on('room_settings_updated', (updatedData) => {
      setRoom(prev => {
        if (!prev) return prev;
        const nextState = { ...prev };
        if (updatedData.roomName) nextState.roomName = updatedData.roomName;
        if (updatedData.permissions) nextState.permissions = updatedData.permissions;
        if (updatedData.settings) {
          nextState.settings = updatedData.settings;
          
          // Frontend Security Fail-Safe: Retroactive eviction if host turns on Members Only
          const isGuest = localStorage.getItem('watch_is_guest') === 'true';
          if (updatedData.settings.onlyLoggedIn && isGuest) {
            setKickedReason('members_only');
            sock.disconnect();
          }
        }
        if (updatedData.bannedUsers) nextState.bannedUsers = updatedData.bannedUsers;
        return nextState;
      });
    });

    sock.on('room_thumbnail_updated', ({ thumbnailPath }) => {
      setRoom(prev => prev ? { ...prev, thumbnailPath } : null);
      syncRecentChat({ thumbnailPath });
      if (notifSettingsRef.current.app) {
        toast.success('Room thumbnail updated! 🖼️');
      }
    });

    sock.on('error_notification', (msg) => {
      toast.error(msg);
    });

    sock.on('room_public_status', data => {
      setIsPublic(data.isPublic);
      toast.success(`Room is now ${data.isPublic ? 'public' : 'private'}`);
    });

    sock.on('chat_history', async (msgs) => {
      // Always read from ref — immune to stale closure race with CryptoContext initialization
      const kp = myKeyPair.current;
      const myUserLower = username?.toLowerCase();

      const decryptedMsgs = await Promise.all(msgs.map(async (msg) => {
        const isMine = msg.isMe !== undefined ? msg.isMe : ((msg.username && msg.username === username) || (msg.senderName && msg.senderName === username));
        let displayMessage = msg.message;
        let displayMediaUrl = msg.mediaUrl;
        const msgKey = String(msg.id || msg.timestamp);

        if (msg.e2ee && msg.e2ee.keys) {
          if (kp) {
            try {
              const myEncKey = msg.e2ee.keys[myUserLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myUserLower)?.[1];
              const resolvedSenderKey = msg.e2ee.senderPublicKey || (isMine ? encodeBase64(kp.publicKey) : null);
              if (myEncKey && resolvedSenderKey) {
                const senderPubKey = decodeBase64(resolvedSenderKey);
                const plain = decryptGroupMessage(
                  msg.message,
                  msg.e2ee.nonce,
                  myEncKey,
                  senderPubKey,
                  kp.secretKey
                );
                if (plain !== null) {
                  if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                    try {
                      const mediaKeyBytes = robustDecode(plain);
                      const buff = await fetch(msg.mediaUrl).then(r => r.arrayBuffer());
                      const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                      const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                      groupDecryptedMediaUrls.current[msgKey] = objectUrl;
                      msg.decryptedText = '';
                      displayMediaUrl = objectUrl;
                    } catch (e) {
                      console.warn('[E2EE] Group history media decrypt failed:', e);
                      displayMediaUrl = null;
                    }
                  } else {
                    msg.decryptedText = plain;
                    displayMediaUrl = msg.mediaUrl;
                  }
                }
              }
            } catch (err) {
              console.warn('[E2EE] Group history decrypt failed:', err);
            }
          }
          // If media URL is ciphertext, hide it until decrypted
          if (msg.mediaUrl && msg.mediaUrl.length > 50 && !msg.decryptedText && msg.decryptedText !== '') {
            displayMediaUrl = null;
          }
        }

        return { ...msg, mediaUrl: displayMediaUrl, isMe: isMine, reactions: fixReactions(msg.reactions) };
      }));

      const resolvedMsgs = resolveReplyMessages(decryptedMsgs);
      setGroupMessages(resolvedMsgs);
      groupMessagesRef.current = resolvedMsgs;
      // Trigger a re-render so async-set objectUrls in groupDecryptedMediaUrls are picked up
      setGroupMediaUrlVersion(v => v + 1);
    });

    sock.on('user_list', ({ users, hostId: hid }) => {
      setUserList(users);
      setHostId(hid);
      setKnownUsers(prev => { const n = new Set(prev); users.forEach(u => n.add(u.username)); return n; });
      setKnownAvatars(prev => {
        const next = { ...prev };
        let changed = false;
        users.forEach(u => {
          if (u.avatarPath) {
            const full = u.avatarPath.startsWith('http') ? u.avatarPath : `${SOCKET_SERVER_URL}${u.avatarPath}`;
            if (next[u.username] !== full) {
              next[u.username] = full;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
      if (!mySocketIdRef.current && sock.id) { mySocketIdRef.current = sock.id; setMySocketId(sock.id); }
      users.forEach(u => {
        if (u.publicKey && u.socketId !== sock.id) {
          try {
            const decoded = decodeBase64(u.publicKey);
            peerPublicKeys.current[u.socketId] = decoded;
            // Also store by username so sendGroupChat can always find it (even after socket reconnects)
            if (u.username) {
              dbPublicKeys.current[u.username.toLowerCase()] = decoded;
              // Persist to localStorage so DMs work even when target is offline next session
              try { localStorage.setItem(`wt_pk_${u.username.toLowerCase()}`, u.publicKey); } catch {}
            }
          } catch { }
        }
      });
      if (myKeyPair.current && !publicKeySentRef.current) {
        publicKeySentRef.current = true;
        sock.emit('chat:publicKey', { roomId, publicKey: encodeBase64(myKeyPair.current.publicKey) });
      }
    });

    sock.on('user_joined', ({ username: uname, avatarPath }) => {
      setKnownUsers(prev => new Set(prev).add(uname));
      if (avatarPath) {
        const full = avatarPath.startsWith('http') ? avatarPath : `${SOCKET_SERVER_URL}${avatarPath}`;
        setKnownAvatars(prev => ({ ...prev, [uname]: full }));
      }
      if (notifSettingsRef.current.app && notifSettingsRef.current.join && uname !== usernameRef.current) {
        toast.success(`${uname} joined`);
      }
    });
    sock.on('user_left', ({ username: uname }) => {
      if (notifSettingsRef.current.app && notifSettingsRef.current.leave && uname !== usernameRef.current) {
        toast(`${uname} left`, { icon: '👋' });
      }
    });
    sock.on('host_changed', ({ newHostName }) => {
      if (notifSettingsRef.current.app) {
        toast(`${newHostName} is now the host 👑`, { duration: 4000 });
      }
    });

    sock.on('chat_message', msg => {
      const isMine = msg.isMe !== undefined ? msg.isMe : ((msg.username && msg.username === username) || (msg.senderName && msg.senderName === username));

      // ─── E2EE: Decrypt group message if encrypted payload is present ──────────────────
      let decryptedText = null;
      if (msg.e2ee && msg.e2ee.keys && myKeyPair.current) {
        try {
          const myLower = username?.toLowerCase();
          const myEncKey = msg.e2ee.keys[myLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
          if (myEncKey) {
            const senderPubKey = decodeBase64(msg.e2ee.senderPublicKey);
            const plain = decryptGroupMessage(
              msg.message,
              msg.e2ee.nonce,
              myEncKey,
              senderPubKey,
              myKeyPair.current.secretKey
            );
            if (plain !== null) {
              if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                // 'plain' is the AES symmetric key for the media blob.
                const mediaKeyB64 = plain;
                const fileUrl = msg.mediaUrl;
                const msgKey = String(msg.id || msg.timestamp);
                
                // Do not block rendering, do async decryption
                (async () => {
                  try {
                    const mediaKeyBytes = robustDecode(mediaKeyB64);
                    const buff = await fetch(fileUrl).then(r => r.arrayBuffer());
                    const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                    const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                    groupDecryptedMediaUrls.current[msgKey] = objectUrl;
                    setGroupMediaUrlVersion(v => v + 1);
                  } catch (e) {
                    console.warn('[E2EE] Group media decrypt (recipient) failed:', e);
                  }
                })();
                
                decryptedText = ''; // Media key decrypted
                msg.mediaUrl = null; // Do not attempt to render the ciphertext blob immediately!
              } else {
                decryptedText = plain;
              }
            }
          }
        } catch (err) {
          console.warn('[E2EE] Group decrypt failed:', err);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const fixed = { ...msg, decryptedText, isMe: isMine, reactions: fixReactions(msg.reactions) };
      
      setGroupMessages(prev => {
        // Reconciliation: replace optimistic message by tempId — this is the dedup for OWN messages
        if (msg.tempId) {
          const optIdx = prev.findIndex(m => m.id === msg.tempId || String(m.timestamp) === String(msg.tempId));
          if (optIdx !== -1) {
            const next = [...prev];
            const oldMsg = next[optIdx];
            // CRITICAL SENDER FIX: If decryption failed (e.g. key mismatch or late key),
            // PRESERVE the optimistic plaintext instead of overwriting with ciphertext or null.
            const safeDecryptedText = fixed.decryptedText || (oldMsg._isOptimistic ? oldMsg.message : null);
            next[optIdx] = { ...fixed, decryptedText: safeDecryptedText, mediaUrl: oldMsg.mediaUrl };
            const resolved = resolveReplyMessages(next);
            groupMessagesRef.current = resolved;
            return resolved;
          }
        }
        // Also dedup by server-assigned ID to prevent any duplicate from double delivery
        if (prev.some(m => String(m.id) === String(msg.id))) {
          return prev;
        }
        const n = [...prev, fixed];
        const resolved = resolveReplyMessages(n);
        groupMessagesRef.current = resolved;
        return resolved;
      });
      
      // Only increment unread if NOT currently viewing the group chat tab AND not own message
      // AND NOT muted
      let isMutedRoom = false;
      try {
        const myUsername = localStorage.getItem('watch_username') || '';
        const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
        if (m.some(u => u.toLowerCase() === roomId.toLowerCase())) isMutedRoom = true;
      } catch {}

      if (chatTabRef.current !== 'group' && !isMine && !isMutedRoom) {
        setGroupUnread(p => {
          const newVal = p + 1;
          // Persist so badge survives room remounts
          try {
            const stored = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
            stored[roomId] = newVal;
            localStorage.setItem('chat_group_unread', JSON.stringify(stored));
          } catch {}
          return newVal;
        });
        setTotalUnread(p => p + 1);
        // Also update global unreadCounts so the char icon badge and GlobalChatWidget list badge update
        setUnreadCounts(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
        // Show toast alert
        if (notifSettingsRef.current.app && notifSettingsRef.current.messages) {
          // Sync Suppression: Don't show toast if it's already open in GlobalChatWidget
          const gcwActive = chatWidgetRef.current?.getActiveChat?.() || {};
          const isViewingInGCW = gcwActive.view === 'chat' && gcwActive.partner === roomId;
          
          if (!isViewingInGCW) {
             const mediaPreview = (msg.mediaUrl || msg.mediaType) ? (msg.mediaType?.startsWith('video') ? 'Video' : 'Photo') : null;
             const previewText = mediaPreview || (fixed.decryptedText || (msg.message && looksLikeCiphertext(msg.message) ? 'Encrypted message' : (msg.message?.slice(0, 45) || 'New message')));
             // ─── Mute Check: skip toast if this room chat is muted ───
             let isChatMuted = false;
             try {
               const mutedList = JSON.parse(localStorage.getItem(`muted_chats_${username}`) || '[]');
               if (mutedList.includes(roomId)) isChatMuted = true;
             } catch {}
             if (!isChatMuted) {
               // ─── Hidden Check: use privacy-safe preview if this chat is hidden ───
               let isChatHidden = false;
               try {
                 const hiddenList = JSON.parse(localStorage.getItem(`hidden_chats_${username}`) || '[]');
                 if (hiddenList.includes(roomId)) isChatHidden = true;
               } catch {}
               
               let unreadCount = 1;
               try {
                 const stored = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
                 unreadCount = stored[roomId] || 1;
               } catch {}
               const msgStr = unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`;

               const toastText = isChatHidden
                 ? `${roomName || roomId}: ${msg.username || 'User'}: ${msgStr}`
                 : `${roomName || roomId}: ${msg.username || 'User'}: ${previewText}`;
               toast(toastText, { id: `msg-${msg.id}`, icon: '💬', duration: 3500 });
             }
          }
        }
      } else if (chatTabRef.current === 'group' && !isMine) {
        // We are already looking at group chat, but another tab might need to know we saw this
        if (socket) socket.emit('chat:mark_read', { chatId: roomId, timestamp: msg.timestamp });
        // Also update local storage timestamp for refresh persistence
        try {
          const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
          lastSeen[roomId] = Date.now();
          localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
        } catch {}
      }
    });

    sock.on('chat:mark_read', ({ chatId, timestamp }) => {
      if (chatId === roomId) {
        setGroupUnread(0);
        setUnreadCounts(prev => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
        // Also clear from localStorage so remount doesn't re-show old badge
        try {
          const groupUnreadStore = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
          delete groupUnreadStore[chatId];
          localStorage.setItem('chat_group_unread', JSON.stringify(groupUnreadStore));
        } catch {}
      } else {
        setDmUnread(prev => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
        setUnreadCounts(prev => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
      }
      setTotalUnread(prev => {
        // Since we don't know the exact count we just removed without checking prev state,
        // it's safer to let the periodic checkUnread fix the total, 
        // or just subtract what we had in dmUnread/groupUnread.
        return prev; // checkUnread interval will fix this within 5s
      });
    });

    sock.on('chat:private_reaction', ({ messageId, timestampId, senderName, emoji, targetName, reactions }) => {
      // If this is an echo of our own reaction (we already optimistically updated), let's still apply the server's definitive truth.
      const otherUser = senderName === username ? targetName : senderName;
      setDmThreads(prev => {
        const thread = prev[otherUser];
        if (!thread) return prev;
        const mapped = thread.map(m => {
          const matchById = String(m.id) === String(messageId) || String(m.timestamp) === String(messageId);
          const matchByTs = timestampId && (String(m.id) === String(timestampId) || String(m.timestamp) === String(timestampId));
          if (matchById || matchByTs) {
            // Apply the definitive state if provided by the new HTTP payload logic
            if (reactions) {
              return { ...m, reactions: fixReactions(reactions) };
            }
            // Fallback parsing for the pure socket logic
            const rx = m.reactions ? { ...m.reactions } : {};
            if (!rx[emoji]) rx[emoji] = [];
            const uidStr = senderName;
            if (rx[emoji].includes(uidStr)) rx[emoji] = rx[emoji].filter(id => id !== uidStr);
            else rx[emoji].push(uidStr);
            return { ...m, reactions: rx };
          }
          return m;
        });
        return { ...prev, [otherUser]: mapped };
      });
    });

    sock.on('blocking_updated', ({ type, by }) => {
      const lowerBy = (by || '').toLowerCase();
      const isBlocked = type === 'blocked';
      try {
        const myUsername = localStorage.getItem('watch_username') || '';
        const list = JSON.parse(localStorage.getItem(`blocking_me_${myUsername}`) || '[]');
        let newList;
        if (isBlocked) {
          newList = list.includes(lowerBy) ? list : [...list, lowerBy];
        } else {
          newList = list.filter(u => u.toLowerCase() !== lowerBy);
        }
        localStorage.setItem(`blocking_me_${myUsername}`, JSON.stringify(newList));
        window.dispatchEvent(new Event('blocked_chats_updated'));
      } catch {}
    });

    sock.on('chat:typing', (data) => {
      if (data.isTyping === false) return;
      const uname = data.username || data.userA;
      if (uname) {
        setTypingUsers(prev => ({ ...prev, [uname]: uname }));
      }
    });

    sock.on('chat:stop_typing', (data) => {
      const uname = data.username || data.userA;
      if (uname) {
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[uname];
          return next;
        });
      }
    });

    sock.on('chat:reaction', ({ messageId, timestampId, reactions, senderUsername }) => {
      // Always apply server's definitive reaction state (enables multi-tab sync for own reactions too)
      const fixed = fixReactions(reactions);
      setGroupMessages(prev => {
        const next = prev.map(m =>
          (String(m.id) === String(messageId) || String(m.timestamp) === String(messageId) ||
           (timestampId && (String(m.id) === String(timestampId) || String(m.timestamp) === String(timestampId))))
            ? { ...m, reactions: fixed } : m
        );
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          next[user] = next[user].map(m =>
            (String(m.id) === String(messageId) || String(m.timestamp) === String(messageId) ||
             (timestampId && (String(m.id) === String(timestampId) || String(m.timestamp) === String(timestampId))))
              ? { ...m, reactions: fixed } : m
          );
        }
        return next;
      });
    });

    sock.on('chat:message_deleted', ({ messageId, originalId, timestampId }) => {
      setGroupMessages(prev => {
        const next = prev.filter(m => 
          String(m.id) !== String(messageId) && 
          String(m.id) !== String(originalId) && 
          (!timestampId || String(m.timestamp) !== String(timestampId))
        );
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          next[user] = next[user].filter(m => 
            String(m.id) !== String(messageId) && 
            String(m.id) !== String(originalId) && 
            (!timestampId || String(m.timestamp) !== String(timestampId))
          );
        }
        return next;
      });
    });

    sock.on('private_message', msg => {
      const isMine = msg.isMe || (msg.senderName && msg.senderName === username);
      const otherName = isMine ? msg.targetName : msg.senderName;
      
      // Block Check
      if (!isMine) {
        const myUsername = localStorage.getItem('watch_username') || '';
        try {
          const blocked = JSON.parse(localStorage.getItem(`blocked_chats_${myUsername}`) || '[]');
          if (blocked.some(u => u.toLowerCase() === otherName.toLowerCase())) return;
        } catch {}
      }
      let decryptedText = null;
      let decryptedMediaUrl = msg.mediaUrl;

      // ─── E2EE: Decrypt DM ──────────────────────────────────────────
      if (msg.nonce && myKeyPair.current) {
        try {
          if (isMine) {
            if (msg.senderMessage) {
               const plain = decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(myKeyPair.current.secretKey));
               if (plain) {
                 if (msg.mediaType && msg.mediaUrl) {
                   decryptedText = '';
                   decryptedMediaUrl = null;
                   const msgKey = msg.id || msg.tempId || String(msg.timestamp);
                   const targetMediaUrl = msg.mediaUrl;
                   const targetMediaType = msg.mediaType;
                   (async () => {
                     try {
                       const mediaKeyBytes = robustDecode(plain);
                       const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
                       const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                       const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                       dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                       setDmMediaUrlVersion(v => v + 1);
                     } catch (e) { console.warn('[E2EE] DM async media decrypt failed (sender copy):', e); }
                   })();
                 } else if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                   decryptedMediaUrl = plain; decryptedText = '';
                 } else {
                   decryptedText = plain;
                 }
               }
            } else if (msg.mediaType) {
              decryptedText = '';
            }
          } else if (msg.ephemeralPublicKey) {
            const plain = decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, encodeBase64(myKeyPair.current.secretKey));
            if (plain) {
               if (msg.mediaType && msg.mediaUrl) {
                 decryptedText = '';
                 decryptedMediaUrl = null;
                 const msgKey = msg.id || String(msg.timestamp);
                 const targetMediaUrl = msg.mediaUrl;
                 const targetMediaType = msg.mediaType;
                 (async () => {
                   try {
                     const mediaKeyBytes = robustDecode(plain);
                     const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
                     const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                     const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                     dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                     setDmMediaUrlVersion(v => v + 1);
                   } catch (e) { console.warn('[E2EE] DM async media decrypt failed:', e); }
                 })();
               } else if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                 decryptedMediaUrl = plain; decryptedText = '';
               } else {
                 decryptedText = plain;
               }
            } else if (msg.mediaType) {
              decryptedText = '';
            }
          }
        } catch (err) {
          console.warn('[E2EE] DM decrypt failed:', err);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const newMsg = {
        ...msg,
        isMe: isMine,
        decryptedText,
        mediaUrl: decryptedMediaUrl,
        mediaType: msg.mediaType,
        reactions: msg.reactions || {}
      };

      setDmThreads(prev => {
        const thread = [...(prev[otherName] || [])];
        
        // Reconciliation: If an optimistic message matches, replace it
        if (msg.tempId) {
          const optIdx = thread.findIndex(m => m.id === msg.tempId || (m.timestamp && String(m.timestamp) === String(msg.tempId)));
          if (optIdx !== -1) {
            const oldMsg = thread[optIdx];
            const safeDecryptedText = newMsg.decryptedText || (oldMsg._isOptimistic ? oldMsg.message : null);
            thread[optIdx] = { ...newMsg, decryptedText: safeDecryptedText };
            return { ...prev, [otherName]: resolveReplyMessages(thread) };
          }
        }

        // Deduplication
        if (thread.some(m => String(m.id) === String(msg.id) || (m.timestamp && String(m.timestamp) === String(msg.timestamp) && (m.senderName === msg.senderName)))) {
          return prev;
        }

        return { ...prev, [otherName]: resolveReplyMessages([...thread, newMsg]) };
      });

      if (chatTabRef.current !== 'dm' || dmTargetRef.current !== otherName) {
        if (!isMine) {
          const storedCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
          const currentCount = Math.max(storedCounts[otherName] || 0, dmUnreadRef.current[otherName] || 0);
          const newDmCount = currentCount + 1;
          dmUnreadRef.current[otherName] = newDmCount;
          
          setDmUnread(prev => ({ ...prev, [otherName]: newDmCount }));
          setTotalUnread(p => p + 1);
          if (notifSettingsRef.current.app && notifSettingsRef.current.messages) {
            const gcwActive = chatWidgetRef.current?.getActiveChat?.() || {};
            const isViewingInGCW = gcwActive.view === 'chat' && gcwActive.partner === otherName;

            if (!isViewingInGCW) {
              const mediaPreview = (msg.mediaUrl || msg.mediaType) ? (msg.mediaType?.startsWith('video') ? 'Video' : 'Photo') : null;
              const previewText = mediaPreview || (newMsg.decryptedText || (msg.message && looksLikeCiphertext(msg.message) ? 'Encrypted message' : (msg.message?.slice(0, 45) || 'New message')));
              // ─── Mute Check: skip toast if this DM partner is muted ───
              let isDmMuted = false;
              try {
                const mutedList = JSON.parse(localStorage.getItem(`muted_chats_${username}`) || '[]');
                if (mutedList.includes(otherName)) isDmMuted = true;
              } catch {}
              if (!isDmMuted) {
                // ─── Hidden Check: use privacy-safe preview if this DM is hidden ───
                let isDmHidden = false;
                try {
                  const hiddenList = JSON.parse(localStorage.getItem(`hidden_chats_${username}`) || '[]');
                  if (hiddenList.includes(otherName)) isDmHidden = true;
                } catch {}
                
                const msgStr = newDmCount === 1 ? '1 new message' : `${newDmCount} new messages`;

                const toastText = isDmHidden
                  ? `${msg.senderName}: ${msgStr}`
                  : `${msg.senderName}: ${previewText}`;
                toast(toastText, { id: `msg-${msg.id}`, icon: '💬', duration: 3500 });
              }
            }
          }
        }
      } else {
        if (!isMine) {
          if (socket) socket.emit('chat:mark_read', { chatId: otherName, timestamp: msg.timestamp });
          try {
            const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
            lastSeen[otherName] = Date.now();
            localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
          } catch { }
        }
      }
    });

    // ─── DM history from DB (historical, server emits on join) ───
    sock.on('chat_history_dm', (dmHistory) => {
      const threads = {};

      for (const [otherName, messages] of Object.entries(dmHistory)) {
         threads[otherName] = messages.map(msg => {
          let decryptedText = null;
          let decryptedMediaUrl = msg.mediaUrl;
          let _encryptedOwn = false;
          // Attempt decryption for messages
          if (msg.nonce && myKeyPair.current) {
            if (msg.isMe) {
               if (msg.senderMessage) {
                 const plain = decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(myKeyPair.current.secretKey));
                 if (plain) {
                   if (msg.mediaType && msg.mediaUrl) {
                     decryptedText = '';
                     decryptedMediaUrl = null;
                     const msgKey = msg.id || String(msg.timestamp);
                     const targetMediaUrl = msg.mediaUrl;
                     const targetMediaType = msg.mediaType;
                     (async () => {
                       try {
                         const mediaKeyBytes = robustDecode(plain);
                         const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
                         const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                         const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                         dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                         setDmMediaUrlVersion(v => v + 1);
                       } catch (e) { console.warn('[E2EE] DM history async decrypt failed:', e); }
                     })();
                   } else if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                     decryptedMediaUrl = plain; decryptedText = '';
                   } else { decryptedText = plain; }
                 } else if (msg.mediaType) {
                   decryptedText = '';
                 }
               } else {
                 _encryptedOwn = true;
                 if (msg.mediaType) decryptedText = '';
               }
            } else if (msg.ephemeralPublicKey) {
              const plain = decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, encodeBase64(myKeyPair.current.secretKey));
              if (plain) {
                 if (msg.mediaType && msg.mediaUrl) {
                   decryptedText = '';
                   decryptedMediaUrl = null;
                   const msgKey = msg.id || String(msg.timestamp);
                   const targetMediaUrl = msg.mediaUrl;
                   const targetMediaType = msg.mediaType;
                   (async () => {
                     try {
                       const mediaKeyBytes = robustDecode(plain);
                       const buff = await fetch(targetMediaUrl).then(r => r.arrayBuffer());
                       const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                       const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                       dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                       setDmMediaUrlVersion(v => v + 1);
                     } catch (e) { console.warn('[E2EE] DM history async decrypt failed:', e); }
                   })();
                 } else if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                   decryptedMediaUrl = plain; decryptedText = '';
                 } else { decryptedText = plain; }
              } else if (msg.mediaType) {
                decryptedText = '';
              }
            }
          } else if (msg.mediaType) {
            decryptedText = msg.message || '';
          }
          return { ...msg, message: msg.message, decryptedText, mediaUrl: decryptedMediaUrl, _encryptedOwn };
        });
        threads[otherName] = resolveReplyMessages(threads[otherName]);
      }

      setDmThreads(prev => {
        const merged = { ...prev };
        for (const [name, msgs] of Object.entries(threads)) {
          merged[name] = msgs;
        }
        return merged;
      });
    });

    sock.on('media_stopped', () => {
      setMediaUrl('');
      setIsPlaying(false);
      setBufferedSeconds(0);
      setIsPreparing(false);
      setActiveExternalApp(null);
    });

    sock.on('media_changed', url => { 
      // PRIORITY RESET: When media changes, stop all interfering processes
      setMediaUrl(url); 
      setIsPlaying(false); 
      playerRef.current?.seekTo(0); 

      // Clear all embedded browsers
      setShowYtBrowser(false);
      setShowTwitchBrowser(false);
      setShowVimeoBrowser(false);
      
      // Stop screen sharing for this user (they are now viewing the new media)
      if (isScreensharing) {
        stopScreenshare();
        toast('New media shared! Stopping screenshare...');
      }
      setIsViewer(false); 
    });
    sock.on('action_play', t => { lastExternalUpdate.current = Date.now(); if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - t) > 2) playerRef.current.seekTo(t, 'seconds'); setIsPlaying(true); });
    sock.on('action_pause', t => { lastExternalUpdate.current = Date.now(); playerRef.current?.seekTo(t, 'seconds'); setIsPlaying(false); });
    sock.on('action_seek', t => { lastExternalUpdate.current = Date.now(); playerRef.current?.seekTo(t, 'seconds'); });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Camera p2p listeners Ã¢â€â‚¬Ã¢â€â‚¬
    sock.on('webrtc_cam_ping', ({ requesterId }) => {
      if (isCamOnRef.current) {
        sock.emit('webrtc_cam_pong', { targetSocketId: requesterId });
      }
    });

    sock.on('cam_started', ({ socketId, username: uname }) => {
      console.log('Received cam_started from', uname, socketId);
      if (cameraPcRefs.current[socketId]) {
        cameraPcRefs.current[socketId].close();
      }
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      cameraPcRefs.current[socketId] = pc;
      pc.onicecandidate = e => { if (e.candidate) sock.emit('cam_ice', { targetSocketId: socketId, candidate: e.candidate }); };
      pc.ontrack = e => {
        console.log('Received remote track from', uname, e.streams[0]);
        if (e.streams[0]) {
          const stream = e.streams[0];
          setRemoteStreams(prev => ({ ...prev, [socketId]: { stream, username: uname } }));

          // Audio Ducking Analyzer
          if (stream.getAudioTracks().length > 0) {
            try {
              if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
              const source = audioContextRef.current.createMediaStreamSource(stream);
              const analyzer = audioContextRef.current.createAnalyser();
              analyzer.fftSize = 256;
              source.connect(analyzer);
              analyzersRef.current.set(socketId, analyzer);
            } catch (e) { console.error('AudioContext error:', e); }
          }
        }
      };
      if (localCamRef.current) {
        console.log('Adding local tracks to new PC for', uname);
        localCamRef.current.getTracks().forEach(t => pc.addTrack(t, localCamRef.current));
      }
      pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true }).then(o => {
        console.log('Sending cam_offer to', uname);
        pc.setLocalDescription(o);
        sock.emit('cam_offer', { targetSocketId: socketId, offer: o });
      }).catch(err => console.error('Error creating offer', err));
    });
    sock.on('cam_stopped', ({ socketId }) => {
      console.log('Received cam_stopped from', socketId);
      if (!isCamOnRef.current) {
        cameraPcRefs.current[socketId]?.close();
        delete cameraPcRefs.current[socketId];
      }
      setRemoteStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
      analyzersRef.current.delete(socketId);
    });
    sock.on('cam_offer', async ({ senderSocketId, senderName, offer }) => {
      console.log('Received cam_offer from', senderName);
      if (cameraPcRefs.current[senderSocketId]) {
        cameraPcRefs.current[senderSocketId].close();
      }
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      cameraPcRefs.current[senderSocketId] = pc;
      pc.onicecandidate = e => { if (e.candidate) sock.emit('cam_ice', { targetSocketId: senderSocketId, candidate: e.candidate }); };
      pc.ontrack = e => {
        console.log('Received remote track (offer handler) from', senderName, e.streams[0]);
        if (e.streams[0]) {
          const stream = e.streams[0];
          setRemoteStreams(prev => ({ ...prev, [senderSocketId]: { stream, username: senderName } }));

          // Audio Ducking Analyzer
          if (stream.getAudioTracks().length > 0) {
            try {
              if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
              const source = audioContextRef.current.createMediaStreamSource(stream);
              const analyzer = audioContextRef.current.createAnalyser();
              analyzer.fftSize = 256;
              source.connect(analyzer);
              analyzersRef.current.set(senderSocketId, analyzer);
            } catch (e) { console.error('AudioContext error:', e); }
          }
        }
      };
      if (localCamRef.current) {
        localCamRef.current.getTracks().forEach(t => pc.addTrack(t, localCamRef.current));
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        console.log('Sending cam_answer back to', senderName);
        sock.emit('cam_answer', { targetSocketId: senderSocketId, answer: ans });
      } catch (err) { console.error('Error handling offer', err); }
    });
    sock.on('cam_answer', async ({ senderSocketId, answer }) => {
      console.log('Received cam_answer from', senderSocketId);
      const pc = cameraPcRefs.current[senderSocketId];
      if (!pc) return;
      if (pc.signalingState !== 'have-local-offer') {
        console.warn('[RTC] Ignoring answer: PC is in state', pc.signalingState);
        return;
      }
      try { 
        await pc.setRemoteDescription(new RTCSessionDescription(answer)); 
      } catch (err) { 
        console.error('Error handling answer', err); 
      }
    });
    sock.on('cam_ice', async ({ senderSocketId, candidate }) => {
      try { await cameraPcRefs.current[senderSocketId]?.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { console.error('Error adding ICE candidate', err); }
    });

    sock.on('kicked_out', ({ reason }) => {
      setKickedReason(reason);
      setIsConnecting(false);
      if (reason === 'room_deleted') setRoomNotFound(true);
    });
    sock.on('room_not_found', () => {
      setRoomNotFound(true);
      setIsConnecting(false);
    });
    sock.on('you_are_muted', () => {
      setIsMuted(true);
      setIsMicOnCam(false); // Update UI button
      // Disable the actual audio tracks in browser
      if (localCamRef.current) {
        localCamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
      }
      if (notifSettingsRef.current.app) toast('🔇 Muted by host');
    });
    sock.on('you_are_unmuted', () => {
      setIsMuted(false);
      if (notifSettingsRef.current.app) toast('Unmuted');
    });
    sock.on('you_are_now_host', () => {
      if (notifSettingsRef.current.app) toast.success(t('youAreNowHost', 'You now have admin controls!'), { icon: '⭐' });
    });
    sock.on('you_are_now_admin', () => {
      if (notifSettingsRef.current.app) toast.success(t('youAreNowAdmin', 'You now have admin controls!'), { icon: '🛡️' });
    });
    sock.on('you_are_no_longer_admin', () => {
      if (notifSettingsRef.current.app) toast.error(t('youAreNoLongerAdmin', 'Your admin controls have been removed.'), { icon: '🚫' });
    });

    // WebRTC
    sock.on('webrtc_screenshare_started', (data) => {
      // Robust payload handling: backend can emit string or object
      const sid = typeof data === 'string' ? data : data.socketId;
      const app = typeof data === 'object' ? data.app : null;
      if (!sid) return;

      console.log('[RTC] New screenshare detected from:', sid);
      setIsViewer(true);
      setActiveExternalApp(app);
      sock.emit('webrtc_join_request', { targetSocketId: sid });
    });
    sock.on('webrtc_screenshare_stopped', () => { 
      setIsViewer(false); 
      setRemoteStream(null); 
      setActiveExternalApp(null);
      Object.values(peerConnectionsRef.current).forEach(p => p.close()); 
      peerConnectionsRef.current = {}; 
    });
    sock.on('webrtc_viewer_joined', async vid => {
      if (!localStreamRef.current) return;
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionsRef.current[vid] = peer;
      localStreamRef.current.getTracks().forEach(t => peer.addTrack(t, localStreamRef.current));
      peer.onicecandidate = e => { if (e.candidate) sock.emit('webrtc_ice_candidate', { targetSocketId: vid, candidate: e.candidate }); };
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      sock.emit('webrtc_offer', { targetSocketId: vid, offer });
    });
    sock.on('webrtc_offer', async ({ senderSocketId, offer }) => {
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionsRef.current[senderSocketId] = peer;
      peer.ontrack = e => { 
        console.log('[RTC] Remote track received:', e.track.kind);
        if (e.streams && e.streams[0]) {
          setRemoteStream(e.streams[0]); 
        } else {
          // Fallback for browsers that don't group tracks into streams automatically
          setRemoteStream(new MediaStream([e.track]));
        }
      };
      peer.onicecandidate = e => { if (e.candidate) sock.emit('webrtc_ice_candidate', { targetSocketId: senderSocketId, candidate: e.candidate }); };
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const ans = await peer.createAnswer(); await peer.setLocalDescription(ans);
      sock.emit('webrtc_answer', { targetSocketId: senderSocketId, answer: ans });
    });
    sock.on('webrtc_answer', async ({ senderSocketId, answer }) => { 
      const pc = peerConnectionsRef.current[senderSocketId];
      if (!pc) return;
      if (pc.signalingState !== 'have-local-offer') {
        console.warn('[RTC] Ignoring screenshare answer: PC is in state', pc.signalingState);
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer)); 
      } catch (e) {
        console.error('[RTC] Failed to set remote description for answer:', e);
      }
    });
    sock.on('webrtc_ice_candidate', async ({ senderSocketId, candidate }) => { peerConnectionsRef.current[senderSocketId]?.addIceCandidate(new RTCIceCandidate(candidate)); });

    const onVis = () => { if (!document.hidden && sock.connected) sock.emit('request_sync', roomId); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      appWindowRef.current?.close();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error('Error closing AudioContext:', e));
      }
      analyzersRef.current.clear();
      
      // Immediately remove ALL toasts from the global store when leaving the room
      // toast.remove() (not dismiss) is critical — dismiss() keeps toasts in store during exit
      // animation, which causes Home.jsx's <Toaster> to replay them on mount.
      toast.remove();
      activeJoinToastIds.current.clear();

      // If we are navigating away (unmounting) but NOT refreshing the page,
      // explicitly tell the server to clear our approval status so the room stays locked on re-entry.
      if (!isUnloadingRef.current && sock.connected) {
        sock.emit('leave_room', { roomId });
      }

      sock.close();
    };

  }, [roomId, username, SOCKET_SERVER_URL, cryptoReady]);

  // E2EE: Emit public key when available so others can DM us encrypted
  useEffect(() => {
    if (socket && socket.connected && keyPair && keyPair.publicKey && roomId && !disconnectedRef.current) {
      socket.emit('chat:publicKey', { roomId: roomId.toLowerCase(), publicKey: encodeBase64(keyPair.publicKey) });
    }
  }, [socket, keyPair, roomId]);

  // E2EE: Pre-fetch ALL room member public keys from DB/API so encryption includes every recipient
  // regardless of whether their socket-based chat:publicKey has been received yet.
  useEffect(() => {
    if (!roomId || !keyPair) return;
    const token = localStorage.getItem('watch_token');
    if (!token) return;
    fetch(`${SOCKET_SERVER_URL}/api/rooms/${roomId.toLowerCase()}/public-keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.keys)) {
          data.keys.forEach(({ username: uname, publicKey: pk }) => {
            if (uname && pk) {
              try { dbPublicKeys.current[uname.toLowerCase()] = decodeBase64(pk); } catch {}
            }
          });
        }
      })
      .catch(() => {});
  }, [roomId, keyPair]);

  // E2EE: Re-decrypt history if keys arrived LATE (e.g. after refresh)
  useEffect(() => {
    if (!keyPair || !cryptoReady) return;

    // 1. Re-decrypt Group Messages that have a raw ciphertext or a '🔒' placeholder
    //    (placeholder is set in chat_history handler when keyPair was not ready yet)
    const myUserLower = username?.toLowerCase();

    const groupMsgsCopy = groupMessagesRef.current;
    const needsRedecrypt = groupMsgsCopy.some(msg =>
      msg.e2ee && msg.e2ee.keys && msg.e2ee.senderPublicKey && (
        looksLikeCiphertext(msg.message) ||        // raw ciphertext stored (shouldn't happen with backend fix, safety net)
        (msg.message && msg.message.startsWith('🔒')) // placeholder set when key was nil
      )
    );

    if (needsRedecrypt) {
      (async () => {
        let changed = false;
        const next = await Promise.all(groupMsgsCopy.map(async (msg) => {
          const needsDec = msg.e2ee && msg.e2ee.keys && msg.e2ee.senderPublicKey && (
            looksLikeCiphertext(msg.message) ||
            (msg.message && msg.message.startsWith('🔒'))
          );
          if (!needsDec) return msg;
          try {
            const myEncKey = msg.e2ee.keys[myUserLower];
            if (!myEncKey) return msg;
            const senderPubKey = decodeBase64(msg.e2ee.senderPublicKey);
            // Use the message field as ciphertext. For '🔒' placeholder, the original ciphertext
            // is gone — this case is now prevented by the new async chat_history handler.
            // Still handle as best-effort in case of edge cases.
            const ciphertextToTry = looksLikeCiphertext(msg.message) ? msg.message : null;
            if (!ciphertextToTry) return msg; // placeholder without recoverable ciphertext
            const plain = decryptGroupMessage(ciphertextToTry, msg.e2ee.nonce, myEncKey, senderPubKey, keyPair.secretKey);
            if (plain !== null) {
              changed = true;
              if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                // Media: inline await to get objectUrl directly
                try {
                  const mediaKeyBytes = robustDecode(plain);
                  const buff = await fetch(msg.mediaUrl).then(r => r.arrayBuffer());
                  const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                  const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                  const msgKey = String(msg.id || msg.timestamp);
                  groupDecryptedMediaUrls.current[msgKey] = objectUrl;
                  return { ...msg, decryptedText: '', mediaUrl: objectUrl };
                } catch(e) {
                  return { ...msg, decryptedText: '', mediaUrl: null };
                }
              }
              return { ...msg, decryptedText: plain };
            }
          } catch(e) { console.warn('[E2EE] Re-decrypt group msg failed:', e); }
          return msg;
        }));

        if (changed) {
          setGroupMessages(next);
          groupMessagesRef.current = next;
          setGroupMediaUrlVersion(v => v + 1);
        }
      })();
    }

    // 2. Re-decrypt DM Threads
    setDmThreads(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [user, thread] of Object.entries(next)) {
        next[user] = thread.map(msg => {
          if (msg.nonce && (looksLikeCiphertext(msg.message) || (msg.mediaUrl && msg.mediaUrl.length > 50))) {
            try {
              let decrypted = msg.message;
              let decryptedMediaUrl = msg.mediaUrl;
              if (msg.isMe && msg.senderMessage) {
                const plain = decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
                if (plain) {
                  changed = true;
                  if (msg.mediaType && msg.mediaUrl) {
                    decrypted = ''; decryptedMediaUrl = null;
                    const msgKey = msg.id || String(msg.timestamp);
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(plain);
                        const buff = await fetch(msg.mediaUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                        dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                        setDmMediaUrlVersion(v => v + 1);
                      } catch(e) {}
                    })();
                  } else { decrypted = plain; }
                }
              } else if (!msg.isMe && msg.ephemeralPublicKey) {
                const plain = decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, encodeBase64(keyPair.secretKey));
                if (plain) {
                  changed = true;
                  if (msg.mediaType && msg.mediaUrl) {
                    decrypted = ''; decryptedMediaUrl = null;
                    const msgKey = msg.id || String(msg.timestamp);
                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(plain);
                        const buff = await fetch(msg.mediaUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                        dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                        setDmMediaUrlVersion(v => v + 1);
                      } catch(e) {}
                    })();
                  } else { decrypted = plain; }
                }
              }
              return { ...msg, decryptedText: decrypted, mediaUrl: decryptedMediaUrl };
            } catch(e) {}
          }
          return msg;
        });
      }
      return changed ? next : prev;
    });
  }, [keyPair, cryptoReady, username]);

  // Sync volume state explicitly to WebRTC native video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = playerVolume;
      videoRef.current.muted = isScreensharing ? true : playerMuted;
    }
  }, [playerVolume, playerMuted, isScreensharing]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬
  function fixReactions(r) {
    if (!r) return {};
    const out = {};
    for (const [e, v] of Object.entries(r)) out[e] = Array.isArray(v) ? v : [...v];
    return out;
  }

  const myUserObj = userList.find(u => u.socketId === socket?.id);
  const isHost = !!(mySocketId && hostId && mySocketId === hostId);
  // isAdmin is derived from the server-sent user list status
  const isAdmin = !!(myUserObj?.isAdmin);
  const isEffectiveHost = isHost || isAdmin; // use this everywhere host features are gated
  const audioDuckingEnabled = room?.settings?.audioDucking;


  // Audio Ducking Loop
  useEffect(() => {
    if (!audioDuckingEnabled) {
      if (isDucking) {
        setPlayerVolume(lastNonDuckedVolume);
        setIsDucking(false);
      }
      return;
    }

    const checkVolume = () => {
      if (!audioDuckingEnabled) return;
      let maxVol = 0;
      analyzersRef.current.forEach(analyzer => {
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((num, val) => num + val, 0) / dataArray.length;
        if (avg > maxVol) maxVol = avg;
      });

      const threshold = 15; // Speaking threshold
      if (maxVol > threshold) {
        if (!isDucking) {
          setLastNonDuckedVolume(playerVolume);
          setPlayerVolume(prev => prev * 0.35); // Duck to 35%
          setIsDucking(true);
        }
      } else {
        if (isDucking) {
          setPlayerVolume(lastNonDuckedVolume);
          setIsDucking(false);
        }
      }
    };

    const interval = setInterval(checkVolume, 250);
    return () => clearInterval(interval);
  }, [audioDuckingEnabled, isDucking, playerVolume, lastNonDuckedVolume]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Chat typing Ã¢â€â‚¬Ã¢â€â‚¬
  const handleChatInputChange = (val, chatType) => {
    if (socket && chatType) {
      const target = chatType === 'private' ? dmTarget : roomId;
      socket.emit('chat:typing', { partner: target, type: chatType, roomId: (roomId || '').toLowerCase() });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        socket.emit('chat:stop_typing', { partner: target, type: chatType, roomId: (roomId || '').toLowerCase() });
      }, 2000);
    }
  };

  const handleDeleteMessage = async (msgId, mode = 'global') => {
    // optimistic delete
    setGroupMessages(prev => {
      const next = prev.filter(m => m.id !== msgId && m.timestamp !== msgId);
      groupMessagesRef.current = next;
      return next;
    });
    setDmThreads(prev => {
      const next = { ...prev };
      for (const user in next) {
        next[user] = next[user].filter(m => m.id !== msgId && m.timestamp !== msgId);
      }
      return next;
    });

    try {
      const qs = mode === 'local' ? '?action=local' : '';
      await fetch(`http://${window.location.hostname}:3001/api/chats/message/${msgId}${qs}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('watch_token')}` }
      });
    } catch (e) { console.error('Delete error', e); }
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Send message Ã¢â€â‚¬Ã¢â€â‚¬
  // Send message
  const sendGroupChat = (e) => {
    e.preventDefault();
    if (!groupChatInput.trim() || !socket) return;
    
    const msgText = groupChatInput.trim();
    const ts = Date.now();
    const tempId = `opt-${ts}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Optimistic Update (show plaintext locally, server gets ciphertext)
    const optimisticMsg = {
      id: tempId,
      username,
      message: msgText,
      decryptedText: msgText,
      timestamp: ts,
      reactions: {},
      replyTo: groupReplyTo ? { id: groupReplyTo.id, username: groupReplyTo.username || groupReplyTo.senderName, message: groupReplyTo.mediaType ? (groupReplyTo.mediaType.startsWith('video') ? 'Video' : 'Photo') : (groupReplyTo.decryptedText || (looksLikeCiphertext(groupReplyTo.message||'') ? '' : (groupReplyTo.message||''))) } : null,
      _isOptimistic: true
    };
    
    setGroupMessages(prev => {
      const next = [...prev, optimisticMsg];
      groupMessagesRef.current = next;
      return next;
    });

    // ─── E2EE: Encrypt group message for all current room members ────────────
    let encryptedPayload = null;
    if (myKeyPair.current && userList.length > 0) {
      try {
        // Build a merged username → publicKey map:
        //   1. dbPublicKeys.current  — fetched from API/DB, always current, keyed by username
        //   2. peerPublicKeys.current — from live user_list events, keyed by socketId (override if newer)
        const mergedKeys = { ...dbPublicKeys.current };
        userList.forEach(u => {
          if (u.socketId && peerPublicKeys.current[u.socketId]) {
            mergedKeys[u.username.toLowerCase()] = peerPublicKeys.current[u.socketId];
          }
        });

        const recipients = userList
          .filter(u => u.username.toLowerCase() !== username.toLowerCase())
          .map(u => ({
            username: u.username,
            publicKey: mergedKeys[u.username.toLowerCase()] || null
          }))
          .filter(r => r.publicKey);
          
        recipients.push({
          username: username,
          publicKey: encodeBase64(myKeyPair.current.publicKey)
        });

        encryptedPayload = encryptGroupMessage(
          msgText,
          recipients,
          myKeyPair.current,
          username
        );
      } catch (err) {
        console.warn('[E2EE] Group encrypt failed, falling back to plaintext:', err);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    socket.emit('chat_message', {
      roomId: (roomId || '').toLowerCase(), 
      message: encryptedPayload ? encryptedPayload.ciphertext : msgText,
      plaintextMessage: !encryptedPayload ? msgText : undefined, // fallback for server-side link/media checks
      e2ee: encryptedPayload ? {
        nonce: encryptedPayload.nonce,
        keys: encryptedPayload.keys,
        senderPublicKey: encodeBase64(myKeyPair.current.publicKey)
      } : null,
      username, 
      tempId,
      replyTo: optimisticMsg.replyTo
    });
    
    setGroupReplyTo(null);
    setGroupChatInput('');
  };
  const sendMediaGroupChat = async (url, type, replyTo = null, rawFile = null) => {
    if (!socket) return;
    const ts = Date.now();
    const tempId = `opt-media-${ts}-${Math.random().toString(36).substr(2, 9)}`;

    // Optimistic Update
    const optimisticUrl = rawFile ? URL.createObjectURL(rawFile) : url;
    const optimisticMsg = {
      id: tempId,
      username,
      message: '',
      decryptedText: type.startsWith('video') ? 'Video' : 'Photo',
      timestamp: ts,
      mediaUrl: optimisticUrl,
      mediaType: type,
      isMe: true,
      reactions: {},
      replyTo: replyTo ? { id: replyTo.id, username: replyTo.username, message: replyTo.mediaType ? (replyTo.mediaType.startsWith('video') ? 'Video' : 'Photo') : (replyTo.decryptedText || replyTo.message) } : null,
      _isOptimistic: true
    };
    
    setGroupMessages(prev => {
      const next = [...prev, optimisticMsg];
      groupMessagesRef.current = next;
      return next;
    });

    let finalUrl = url;
    let encryptedPayload = null;
    let isEncrypted = false;
    const token = localStorage.getItem('watch_token');

    // ─── E2EE: AES blob encryption + metadata wrap ───
    if (rawFile && myKeyPair.current && token && userList.length > 0) {
      try {
        const { encryptedBlob, mediaKeyBytes } = await encryptMedia(rawFile);
        const mediaKeyB64 = encodeBase64(mediaKeyBytes);

        // Upload encrypted blob to authenticated endpoint
        const fd = new FormData();
        fd.append('media', encryptedBlob, rawFile.name || 'media');
        if (roomId) fd.append('roomId', roomId);
        
        const uploadResp = await fetch(`${SOCKET_SERVER_URL}/api/upload/chat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });
        if (!uploadResp.ok) throw new Error('Encrypted upload failed');
        const uploadData = await uploadResp.json();
        if (!uploadData.url) throw new Error('Upload returned no URL');
        finalUrl = `${SOCKET_SERVER_URL}${uploadData.url}`;

        // Merge socket-based and DB-based public keys for recipients
        const mergedKeys = { ...dbPublicKeys.current };
        userList.forEach(u => {
          if (u.socketId && peerPublicKeys.current[u.socketId]) {
            mergedKeys[u.username.toLowerCase()] = peerPublicKeys.current[u.socketId];
          }
        });

        const recipients = userList
          .filter(u => u.username.toLowerCase() !== username.toLowerCase())
          .map(u => ({
            username: u.username,
            publicKey: mergedKeys[u.username.toLowerCase()] || null
          }))
          .filter(r => r.publicKey);
          
        recipients.push({
          username: username,
          publicKey: encodeBase64(myKeyPair.current.publicKey)
        });

        // Encrypt the AES key for group recipients
        encryptedPayload = encryptGroupMessage(mediaKeyB64, recipients, myKeyPair.current, username);
        isEncrypted = true;
      } catch (err) {
        console.warn('[E2EE] Group media encrypt failed:', err);
      }
    } else if (myKeyPair.current && userList.length > 0) {
      // Fallback: URL string encryption only
      try {
        const mergedKeys2 = { ...dbPublicKeys.current };
        userList.forEach(u => {
          if (u.socketId && peerPublicKeys.current[u.socketId]) {
            mergedKeys2[u.username.toLowerCase()] = peerPublicKeys.current[u.socketId];
          }
        });
        const recipients = userList
          .filter(u => u.username !== username)
          .map(u => ({
            username: u.username,
            publicKey: mergedKeys2[u.username.toLowerCase()] || null
          }))
          .filter(r => r.publicKey);
          
        recipients.push({
          username: username,
          publicKey: encodeBase64(myKeyPair.current.publicKey)
        });
        encryptedPayload = encryptGroupMessage(url, recipients, myKeyPair.current, username);
        finalUrl = encryptedPayload.ciphertext; // stored encrypted string
        isEncrypted = true;
      } catch (err) {
        console.warn('[E2EE] Room Group URL media encrypt failed:', err);
      }
    }

    if (!isEncrypted) {
      console.error('[E2EE] Blocking Room group media — encryption failed.');
      toast.error('Could not encrypt media. Please try again.');
      setGroupMessages(prev => {
        const next = prev.filter(m => m.id !== tempId);
        groupMessagesRef.current = next;
        return next;
      });
      return;
    }

    // IMPORTANT: For Group AES Media, `message` holds the encrypted AES key and `mediaUrl` holds the ciphertext URL.
    // If it's the fallback URL encryption, both get the ciphertext to maintain backward compat.
    // However, our new standard is to put the encrypted AES mediaKey in `message` and the actual URL in `mediaUrl`.
    const msgPayload = (rawFile && encryptedPayload) ? encryptedPayload.ciphertext : (encryptedPayload ? encryptedPayload.ciphertext : '');

    socket.emit('chat_message', {
      roomId: (roomId || '').toLowerCase(), 
      message: msgPayload,
      username,
      mediaUrl: finalUrl, 
      mediaType: type,
      tempId,
      e2ee: encryptedPayload ? {
        nonce: encryptedPayload.nonce,
        keys: encryptedPayload.keys,
        senderPublicKey: encodeBase64(myKeyPair.current.publicKey)
      } : null,
      replyTo: optimisticMsg.replyTo
    });
  };

  const sendDmChat = async (e) => {
    e.preventDefault();
    if (!dmChatInput.trim() || !socket || !dmTarget) return;

    const token = localStorage.getItem('watch_token');
    const ts = Date.now();
    const tempId = `opt-dm-${ts}`;
    const plaintext = dmChatInput.trim();

    // Optimistic: show plaintext immediately in UI
    const optimisticMsg = {
      id: tempId,
      senderName: username,
      targetName: dmTarget,
      message: plaintext,
      decryptedText: plaintext,
      timestamp: ts,
      isMe: true,
      reactions: {},
      replyTo: dmReplyTo ? { id: dmReplyTo.id, username: dmReplyTo.username || dmReplyTo.senderName || dmReplyTo.targetName, message: dmReplyTo.mediaType ? (dmReplyTo.mediaType.startsWith('video') ? 'Video' : 'Photo') : (dmReplyTo.decryptedText || (looksLikeCiphertext(dmReplyTo.message||'') ? '' : (dmReplyTo.message||''))) } : null,
      _isOptimistic: true
    };
    setDmThreads(prev => {
      const next = { ...prev };
      if (!next[dmTarget]) next[dmTarget] = [];
      next[dmTarget] = [...next[dmTarget], optimisticMsg];
      return next;
    });
    setDmReplyTo(null);
    setDmChatInput('');

    try {
      // ─── Phase 1: Sender Key Validation ───
      if (!myKeyPair.current && keyPair) {
        console.log('[E2EE] myKeyPair.current was missing, re-hydrated from context.');
        myKeyPair.current = keyPair;
      }

      const token = localStorage.getItem('watch_token');
      if (!myKeyPair.current) {
        console.error('[E2EE] ABORT: My own keyPair is still missing from CryptoContext.');
        toast.error('Encryption keys not ready yet. Please refresh.');
        return;
      }

      // ─── Phase 2: Recipient Key Discovery ───
      const targetLower = dmTarget.toLowerCase();
      let isEncrypted = false;
      let messagePayload = '';
      let senderMsgPayload = '';
      let nonceVal = '';
      let ephKeyVal = '';

      console.log(`[E2EE] Attempting to encrypt DM for target: ${dmTarget}`);

      try {
        // 1a: check in-memory cache
        const cachedKey = dbPublicKeys.current[targetLower];
        if (cachedKey && cachedKey.length === 32) {
          console.log('[E2EE] Using in-memory cached key.');
          const enc = encryptDM(plaintext, encodeBase64(cachedKey), encodeBase64(myKeyPair.current.publicKey));
          messagePayload   = enc.ciphertext;
          senderMsgPayload = enc.senderCiphertext;
          nonceVal         = enc.nonce;
          ephKeyVal        = enc.ephemeralPublicKey;
          isEncrypted      = true;
        }

        // 1b: check userList state
        if (!isEncrypted) {
          const targetUser = userList.find(u => u.username?.toLowerCase() === targetLower);
          if (targetUser?.publicKey) {
            console.log('[E2EE] Found key in current userList.');
            const enc = encryptDM(plaintext, targetUser.publicKey, encodeBase64(myKeyPair.current.publicKey));
            messagePayload   = enc.ciphertext;
            senderMsgPayload = enc.senderCiphertext;
            nonceVal         = enc.nonce;
            ephKeyVal        = enc.ephemeralPublicKey;
            isEncrypted      = true;
            try { dbPublicKeys.current[targetLower] = decodeBase64(targetUser.publicKey); } catch {}
          }
        }

        // 2: check localStorage
        if (!isEncrypted) {
          const localPK = localStorage.getItem(`wt_pk_${targetLower}`);
          if (localPK) {
            console.log('[E2EE] Found key in localStorage cache.');
            const enc = encryptDM(plaintext, localPK, encodeBase64(myKeyPair.current.publicKey));
            messagePayload   = enc.ciphertext;
            senderMsgPayload = enc.senderCiphertext;
            nonceVal         = enc.nonce;
            ephKeyVal        = enc.ephemeralPublicKey;
            isEncrypted      = true;
            try { dbPublicKeys.current[targetLower] = decodeBase64(localPK); } catch {}
          }
        }

        // 3: HTTP API lookup
        if (!isEncrypted) {
          console.log('[E2EE] Key not found locally, fetching from API...');
          const pkRes = await fetch(`${SOCKET_SERVER_URL}/api/auth/public-key/${encodeURIComponent(dmTarget)}`);
          if (pkRes.ok) {
            const pkData = await pkRes.json();
            if (pkData.publicKey) {
              console.log('[E2EE] Found key via API.');
              const enc = encryptDM(plaintext, pkData.publicKey, encodeBase64(myKeyPair.current.publicKey));
              messagePayload   = enc.ciphertext;
              senderMsgPayload = enc.senderCiphertext;
              nonceVal         = enc.nonce;
              ephKeyVal        = enc.ephemeralPublicKey;
              isEncrypted      = true;
              try { localStorage.setItem(`wt_pk_${targetLower}`, pkData.publicKey); } catch {}
              try { dbPublicKeys.current[targetLower] = decodeBase64(pkData.publicKey); } catch {}
            }
          }
        }

        // 4: Case-insensitive API lookup
        if (!isEncrypted) {
          console.log('[E2EE] Fetching from API with lowercase fallback...');
          const pkRes2 = await fetch(`${SOCKET_SERVER_URL}/api/auth/public-key/${encodeURIComponent(targetLower)}`);
          if (pkRes2.ok) {
            const pkData2 = await pkRes2.json();
            if (pkData2.publicKey) {
              console.log('[E2EE] Found key via lowercase API.');
              const enc = encryptDM(plaintext, pkData2.publicKey, encodeBase64(myKeyPair.current.publicKey));
              messagePayload   = enc.ciphertext;
              senderMsgPayload = enc.senderCiphertext;
              nonceVal         = enc.nonce;
              ephKeyVal        = enc.ephemeralPublicKey;
              isEncrypted      = true;
              try { localStorage.setItem(`wt_pk_${targetLower}`, pkData2.publicKey); } catch {}
              try { dbPublicKeys.current[targetLower] = decodeBase64(pkData2.publicKey); } catch {}
            }
          }
        }
      } catch (err) {
        console.error('[E2EE] Encryption pipeline error:', err);
      }

      if (!isEncrypted) {
        console.error(`[E2EE] CRITICAL: Could not find any encryption key for user "${dmTarget}". All lookup methods failed.`);
        toast.error(`Recipient "${dmTarget}" has not set up encryption keys yet.`);
        // Rollback optimistic message
        setDmThreads(prev => {
          const next = { ...prev };
          if (next[dmTarget]) next[dmTarget] = next[dmTarget].filter(m => m.id !== tempId);
          return next;
        });
        return;
      }

      // ─── POST to /api/chats/send (same as GlobalChatWidget) ───
      const res = await fetch(`${SOCKET_SERVER_URL}/api/chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          type: 'private',
          partner: dmTarget.toLowerCase(),
          message: messagePayload,
          senderMessage: senderMsgPayload,
          nonce: nonceVal,
          ephemeralPublicKey: ephKeyVal,
          encrypted: true,
          replyTo: optimisticMsg.replyTo,
          tempId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Message failed to send.');
        // Rollback optimistic
        setDmThreads(prev => {
          const next = { ...prev };
          if (next[dmTarget]) next[dmTarget] = next[dmTarget].filter(m => m.id !== tempId);
          return next;
        });
      }
      // On success: backend emits private_message via emitToUser to ALL sockets for dmTarget.
      // The private_message listener below will also fire for the sender's socket (isMe:true)
      // but since backend does NOT re-echo to sender from HTTP path, the optimistic msg stays as-is.
    } catch (err) {
      console.error('[Room DM] sendDmChat error:', err);
      toast.error('Failed to send message.');
      setDmThreads(prev => {
        const next = { ...prev };
        if (next[dmTarget]) next[dmTarget] = next[dmTarget].filter(m => m.id !== tempId);
        return next;
      });
    }
  };
  const sendMediaDmChat = async (url, type, replyTo = null, rawFile = null) => {
    if (!socket || !dmTarget) return;

    const token = localStorage.getItem('watch_token');
    const ts = Date.now();
    const tempId = `opt-dm-media-${ts}`;

    // Optimistic: use blob URL from rawFile if available, else use server URL
    const optimisticUrl = rawFile ? URL.createObjectURL(rawFile) : url;
    const optimisticMsg = {
      id: tempId,
      senderName: username,
      targetName: dmTarget,
      message: '',
      mediaUrl: optimisticUrl,
      mediaType: type,
      timestamp: ts,
      isMe: true,
      reactions: {},
      replyTo: replyTo ? { id: replyTo.id, username: replyTo.username || replyTo.senderName || replyTo.targetName, message: replyTo.mediaType ? (replyTo.mediaType.startsWith('video') ? 'Video' : 'Photo') : (replyTo.decryptedText || replyTo.message) } : null,
      _isOptimistic: true
    };
    setDmThreads(prev => {
      const next = { ...prev };
      if (!next[dmTarget]) next[dmTarget] = [];
      next[dmTarget] = [...next[dmTarget], optimisticMsg];
      return next;
    });

    try {
      let finalUrl = url;         // URL of (encrypted) blob on server
      let messagePayload = '';    // encrypted AES key (or empty for URL-only)
      let senderMsgPayload = null;
      let nonceVal = null;
      let ephKeyVal = null;
      let isEncrypted = false;

      // ─── Fetch recipient public key (always via HTTP, like GCW) ───
      let targetPubKey = null;
      if (myKeyPair.current && token) {
        try {
          const pkRes = await fetch(`${SOCKET_SERVER_URL}/api/auth/public-key/${dmTarget}`);
          const pkData = pkRes.ok ? await pkRes.json() : null;
          targetPubKey = pkData?.publicKey || null;
          if (!targetPubKey) {
            // try lowercase fallback
            const pkRes2 = await fetch(`${SOCKET_SERVER_URL}/api/auth/public-key/${dmTarget.toLowerCase()}`);
            const pkData2 = pkRes2.ok ? await pkRes2.json() : null;
            targetPubKey = pkData2?.publicKey || null;
          }
        } catch (err) {
          console.warn('[E2EE] Room media DM key fetch failed:', err);
        }
      }

      if (rawFile && myKeyPair.current && targetPubKey && token) {
        // ─── AES blob encryption (same as GlobalChatWidget) ───
        const { encryptedBlob, mediaKeyBytes } = await encryptMedia(rawFile);
        const mediaKeyB64 = encodeBase64(mediaKeyBytes);

        // Upload encrypted blob to authenticated endpoint
        const fd = new FormData();
        fd.append('media', encryptedBlob, rawFile.name || 'media');
        const uploadResp = await fetch(`${SOCKET_SERVER_URL}/api/upload/chat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });
        if (!uploadResp.ok) throw new Error('Encrypted upload failed');
        const uploadData = await uploadResp.json();
        if (!uploadData.url) throw new Error('Upload returned no URL');
        finalUrl = `${SOCKET_SERVER_URL}${uploadData.url}`;

        // Encrypt AES key with DM E2EE (same as GCW)
        const enc = encryptDM(mediaKeyB64, targetPubKey, encodeBase64(myKeyPair.current.publicKey));
        messagePayload   = enc.ciphertext;         // encrypted AES key
        senderMsgPayload = enc.senderCiphertext;   // sender-readable copy of AES key
        nonceVal         = enc.nonce;
        ephKeyVal        = enc.ephemeralPublicKey;
        isEncrypted      = true;
      } else if (targetPubKey && myKeyPair.current) {
        // ─── Fallback: URL-only encryption (no raw file available) ───
        const enc = encryptDM(url, targetPubKey, encodeBase64(myKeyPair.current.publicKey));
        messagePayload   = enc.ciphertext;
        senderMsgPayload = enc.senderCiphertext;
        nonceVal         = enc.nonce;
        ephKeyVal        = enc.ephemeralPublicKey;
        finalUrl         = enc.ciphertext; // encrypted URL in mediaUrl
        isEncrypted      = true;
      }

      const res = await fetch(`${SOCKET_SERVER_URL}/api/chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          type: 'private',
          partner: dmTarget.toLowerCase(),
          message: messagePayload,           // encrypted AES key (GCW-compatible)
          senderMessage: senderMsgPayload,
          mediaUrl: finalUrl,               // encrypted blob URL
          mediaType: type,
          nonce: nonceVal,
          ephemeralPublicKey: ephKeyVal,
          encrypted: isEncrypted,
          replyTo: replyTo ? { id: replyTo.id, username: replyTo.username || replyTo.senderName, message: replyTo.mediaType ? (replyTo.mediaType.startsWith('video') ? 'Video' : 'Photo') : (replyTo.decryptedText || replyTo.message) } : null,
          tempId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Media message failed to send.');
        setDmThreads(prev => {
          const next = { ...prev };
          if (next[dmTarget]) next[dmTarget] = next[dmTarget].filter(m => m.id !== tempId);
          return next;
        });
      }
    } catch (err) {
      console.error('[Room DM] sendMediaDmChat error:', err);
      toast.error('Failed to send media.');
      setDmThreads(prev => {
        const next = { ...prev };
        if (next[dmTarget]) next[dmTarget] = next[dmTarget].filter(m => m.id !== tempId);
        return next;
      });
    }
  };
  const handleGroupReact = (msgId, emoji) => {
    // Optimistic update — apply locally immediately
    setGroupMessages(prev => {
      const next = prev.map(m => {
        if (String(m.id) === String(msgId) || (m.timestamp && String(m.timestamp) === String(msgId))) {
          const rx = {};
          for (const [em, uids] of Object.entries(m.reactions || {})) {
            const filtered = uids.filter(u => u !== username);
            if (filtered.length > 0) rx[em] = filtered;
          }
          const hadIt = (m.reactions?.[emoji] || []).includes(username);
          if (!hadIt) {
            if (!rx[emoji]) rx[emoji] = [];
            rx[emoji].push(username);
          }
          return { ...m, reactions: rx };
        }
        return m;
      });
      groupMessagesRef.current = next;
      return next;
    });

    // Room group messages are stored in SQLite via the socket handler — so reactions MUST
    // go through the socket chat:reaction event (which queries SQLite), NOT the HTTP
    // /api/chats/react endpoint (which queries PostgreSQL and finds nothing).
    if (socket && socket.connected) {
      socket.emit('chat:reaction', {
        roomId: (roomId || '').toLowerCase(),
        messageId: String(msgId),
        emoji
      });
    }
    
    setActiveReactionMsg(null);
    setShowAllEmojis(false);
  };
  // Store username on socket for echo-skip
  if (socket) socket.__username = username;

  const handleStopMedia = useCallback(() => {
    setMediaUrl('');
    setIsPlaying(false);
    setBufferedSeconds(0);
    setIsPreparing(false);
    setActiveExternalApp(null);
    setInputUrl('');
    if (socket) socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: '' });
  }, [socket, roomId]);

  const handleCast = () => {
    setShowCastDiscovery(true);
  };

  const handleDmReact = (msgId, emoji) => {
    setDmThreads(prev => {
      const tb = { ...prev };
      if (!tb[dmTarget]) return tb;
      tb[dmTarget] = tb[dmTarget].map(m => {
        if (m.id === msgId || (m.timestamp && m.timestamp === msgId)) {
          const rx = {};
          for (const [em, uids] of Object.entries(m.reactions || {})) {
            const filtered = uids.filter(u => u !== username);
            if (filtered.length > 0) rx[em] = filtered;
          }
          const hadIt = (m.reactions?.[emoji] || []).includes(username);
          if (!hadIt) {
            if (!rx[emoji]) rx[emoji] = [];
            rx[emoji].push(username);
          }
          return { ...m, reactions: rx };
        }
        return m;
      });
      return tb;
    });
    try {
      fetch(`${SOCKET_SERVER_URL}/api/chats/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('watch_token')}` },
        body: JSON.stringify({ messageId: msgId, emoji })
      });
    } catch(e) { console.error('React error', e); }

    setActiveReactionMsg(null);
    setShowAllEmojis(false);
  };


  // Ã¢â€â‚¬Ã¢â€â‚¬ Media Ã¢â€â‚¬Ã¢â€â‚¬
  const changeMedia = (url) => {
    if (!url) { toast.error('Enter a URL first'); return; }
    
    // Safety Check: block 18+ content locally for immediate feedback
    if (isNSFWUrl(url)) {
      toast.error('18+ (NSFW) content is NOT allowed here!');
      return;
    }

    if (!ReactPlayer.canPlay(url) && !isWebIframe(url)) { toast.error('Invalid URL'); return; }

    // Priority Shift: Stop all active processes before switching to new media
    if (isScreensharing) stopScreenshare();
    setShowYtBrowser(false);
    setShowTwitchBrowser(false);
    setShowVimeoBrowser(false);

    socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: url });
  };
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    // LOGGING: See what the browser reports
    console.log('[UPLOAD] File Name:', file.name);
    console.log('[UPLOAD] File Type (MIME):', file.type);
    console.log('[UPLOAD] File Size:', file.size);

    // Relaxed Validation: Only block if we are CERTAIN it is NOT a video
    // Browsers often report "" for files without extensions
    if (file.type && !file.type.startsWith('video/')) {
       toast.error('Only video files are allowed!');
       return;
    }

    setIsUploading(true);
    toast.loading(`Uploading "${file.name}"...`, { duration: 3000, icon: '⬆️' });
    
    const fd = new FormData(); 
    fd.append('media', file); 
    fd.append('roomId', roomId || '');

    console.log('[UPLOAD] Starting fetch to:', `${SOCKET_SERVER_URL}/api/upload`);
    try {
      const r = await fetch(`${SOCKET_SERVER_URL}/api/upload`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.url) {
        const fullLocalUrl = `${SOCKET_SERVER_URL}${d.url}`;

        // PRIORITY STOP: Ensure all browsers and screenshares are closed before file starts
        if (isScreensharing) stopScreenshare();
        setShowYtBrowser(false);
        setShowTwitchBrowser(false);
        setShowVimeoBrowser(false);

        // Immediately trigger the switch for the entire room
        socket.emit('change_media', { 
          roomId: (roomId || '').toLowerCase(), 
          mediaUrl: fullLocalUrl 
        });

        // LOCAL FIX: Host should switch immediately to prevent 'Black Screen' or delay
        setMediaUrl(fullLocalUrl);
        setIsPlaying(false);
        if (playerRef.current) playerRef.current.seekTo(0);
        
        toast.success('Video uploaded! Starting smoothing...');
      }
    } catch { 
      toast.error('Upload failed'); 
    } finally { 
      setIsUploading(false); 
    }
  };
  const handlePlay = () => { if (Date.now() - lastExternalUpdate.current < 500) return; socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: playerRef.current?.getCurrentTime() || 0 }); setIsPlaying(true); };
  const handlePause = () => { if (Date.now() - lastExternalUpdate.current < 500) return; socket.emit('pause', { roomId: (roomId || '').toLowerCase(), currentTime: playerRef.current?.getCurrentTime() || 0 }); setIsPlaying(false); };
  
  const openDiscoveryMenu = (type) => {
    // Automatically pause video for the whole room before opening menus
    if (isPlaying) {
      handlePause();
    }
    
    if (type === 'twitch') setShowTwitchBrowser(true);
    else if (type === 'vimeo') setShowVimeoBrowser(true);
    else if (type === 'youtube') setShowYtBrowser(true);
    else if (type === 'selector') setShowMediaSelector(true);
  };
  const handleSeek = (s) => { if (Date.now() - lastExternalUpdate.current < 500) return; socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: s }); };

  const resetInactivityTimer = useCallback(() => {
    setUiVisible(true);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setUiVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (mediaUrl?.includes('twitch.tv') || mediaUrl?.includes('vimeo.com')) {
      resetInactivityTimer();
    }
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [mediaUrl, resetInactivityTimer]);

  const togglePlayPause = () => {
    if (isScreensharing || isViewer) {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(e => console.error("Could not play", e));
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
      return;
    }

    if (isPlaying) {
      socket.emit('pause', { roomId: (roomId || '').toLowerCase(), currentTime: playerRef.current?.getCurrentTime() || 0 });
      setIsPlaying(false);
    } else {
      socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: playerRef.current?.getCurrentTime() || 0 });
      setIsPlaying(true);
    }
  };

  const handleScrubberChange = (e) => {
    const t = parseFloat(e.target.value);
    playerRef.current?.seekTo(t, 'seconds');
    lastExternalUpdate.current = Date.now();
    socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: t });
    setCurrentTime(t);
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setPlayerVolume(v);
    setPlayerMuted(v === 0);
  };

  const toggleMutePlayer = () => setPlayerMuted(m => !m);



  const startScreenshare = async (videoConstraints = true, appWindow = null, appInfo = null) => {
    try {
      if (appWindow) appWindowRef.current = appWindow;

      // Extract the enhancement filter before passing constraints to getDisplayMedia
      const enhancementFilter = (typeof videoConstraints === 'object' && videoConstraints?.enhancement && videoConstraints.enhancement !== 'none')
        ? videoConstraints.enhancement
        : null;

      // Strip 'enhancement' from the constraints object (getDisplayMedia doesn't know it)
      const mediaConstraints = (typeof videoConstraints === 'object')
        ? { width: videoConstraints.width, height: videoConstraints.height, frameRate: videoConstraints.frameRate }
        : videoConstraints;

      const rawStream = await navigator.mediaDevices.getDisplayMedia({ video: mediaConstraints, audio: true });

      let streamToShare = rawStream;
      let enhanceCleanup = null; // Holds the cancelAnimationFrame ID

      // ── Canvas Enhancement Pipeline ──────────────────────────────────
      // If an enhancement filter is set, draw every frame through a canvas
      // with CSS filter applied. canvas.captureStream() is what WebRTC broadcasts.
      // All viewers receive the visually enhanced stream.
      if (enhancementFilter) {
        const videoTrack = rawStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const canvasW = settings.width  || (typeof mediaConstraints === 'object' ? (mediaConstraints.width?.ideal  || 1280) : 1280);
        const canvasH = settings.height || (typeof mediaConstraints === 'object' ? (mediaConstraints.height?.ideal || 720)  : 720);
        const captureFps = (typeof mediaConstraints === 'object' ? (mediaConstraints.frameRate?.ideal || 30) : 30);

        const canvas  = document.createElement('canvas');
        canvas.width  = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        // Source video element — hidden, used only for drawing
        const srcVideo = document.createElement('video');
        srcVideo.srcObject = rawStream;
        srcVideo.muted = true;
        srcVideo.playsInline = true;
        await srcVideo.play();

        // Draw loop — applies the enhancement filter on every frame
        let rafId;
        const drawFrame = () => {
          if (srcVideo.readyState >= 2) {
            ctx.filter = enhancementFilter;
            ctx.drawImage(srcVideo, 0, 0, canvasW, canvasH);
            ctx.filter = 'none';
          }
          rafId = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        // Compose final stream: canvas video + original audio
        const canvasStream = canvas.captureStream(captureFps);
        rawStream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
        streamToShare = canvasStream;

        // Cleanup function — called when screenshare ends
        enhanceCleanup = () => {
          cancelAnimationFrame(rafId);
          srcVideo.pause();
          srcVideo.srcObject = null;
        };

        // Also stop if the original video track ends
        videoTrack.addEventListener('ended', () => {
          if (enhanceCleanup) enhanceCleanup();
        }, { once: true });
      }
      // ────────────────────────────────────────────────────────────────

      localStreamRef.current = streamToShare;
      // Store cleanup so stopScreenshare can call it
      localStreamRef.current._enhanceCleanup = enhanceCleanup;

      // Regain focus to the room tab immediately after sharing starts
      setTimeout(() => {
        window.focus();
        if (appWindow) {
          try { appWindow.blur(); } catch (e) {}
        }
      }, 500);

      // End the previous process: stop group media and set status
      handlePause();
      socket.emit('pause', { roomId: (roomId || '').toLowerCase(), currentTime: playerRef.current?.getCurrentTime() || 0 });
      
      setIsScreensharing(true); 
      setActiveExternalApp(appInfo);
      socket.emit('webrtc_start_screenshare', { roomId: (roomId || '').toLowerCase(), app: appInfo });
      streamToShare.getVideoTracks()[0].onended = () => stopScreenshare();
    } catch (err) { console.error(err); }
  };
  const stopScreenshare = () => {
    // Stop the canvas enhancement pipeline (animation loop + source video) if active
    if (localStreamRef.current?._enhanceCleanup) {
      localStreamRef.current._enhanceCleanup();
    }
    localStreamRef.current?.getTracks().forEach(t => t.stop()); 
    localStreamRef.current = null; 
    setIsScreensharing(false);
    setActiveExternalApp(null);
    appWindowRef.current?.close(); appWindowRef.current = null;
    Object.values(peerConnectionsRef.current).forEach(p => p.close()); peerConnectionsRef.current = {};
    socket?.emit('webrtc_stop_screenshare', (roomId || '').toLowerCase());
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Camera / Mic Toggle Ã¢â€â‚¬Ã¢â€â‚¬
  // ─── Camera / Mic Toggle ───
  const toggleCamera = async () => {
    console.log('toggleCamera clicked. isCamOn:', isCamOn);
    if (isCamOn) {
      // Turn off
      localCamRef.current?.getTracks().forEach(t => t.stop());
      localCamRef.current = null;
      setIsCamOn(false);
      isCamOnRef.current = false;
      
      // Close peer connections ONLY for users who don't have their cameras on.
      Object.keys(cameraPcRefs.current).forEach(sid => {
        if (!remoteStreams[sid]) {
          cameraPcRefs.current[sid]?.close();
          delete cameraPcRefs.current[sid];
        }
      });
      
      socket?.emit('cam_stopped', { roomId: (roomId || '').toLowerCase() });
    } else {
      // Turn on
      // Permission check
      if (!isEffectiveHost && room?.permissions?.cam === 'host') {
        toast.error('Only the host can use their webcam in this room.');
        return;
      }

      try {
        console.log('Requesting getUserMedia... mic:', isMicOnCam);
        const selectedCam = localStorage.getItem('watch_selected_cam');
        const selectedMic = localStorage.getItem('watch_selected_mic');
        const constraints = {
          video: selectedCam ? { deviceId: { exact: selectedCam } } : true,
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
        };
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (exactErr) {
          console.warn('Failed with exact device constraints, falling back to defaults', exactErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        console.log('getUserMedia success', stream.getTracks());

        if (localCamRef.current) {
          localCamRef.current.getTracks().forEach(t => t.stop());
        }

        // Ensure mic starts in the correct state
        stream.getAudioTracks().forEach(t => t.enabled = isMicOnCam);

        localCamRef.current = stream;
        setIsCamOn(true);
        isCamOnRef.current = true;
        setHasStartedCamOnce(true);
        socket?.emit('cam_started', { roomId: (roomId || '').toLowerCase() });

        // If others already have cameras on but we just joined, we need to renegotiate with them
        // Actually, we should let the existing peers know we turned on our camera, so `cam_started` signals that.
        // Wait, `cam_started` makes THEM create an offer to US.
      } catch (err) {
        toast.error(`Camera error: ${err.name} - ${err.message}. ${err.name === 'NotAllowedError' ? 'Check browser site settings.' : 'Device might be in use by another app.'}`);
        console.error('getUserMedia error:', err);
      }
    }
  };

  const toggleMic = async () => {
    const nextState = !isMicOnCam;
    
    // If turning ON and no stream exists, we must start one (audio-only for now)
    if (nextState && !localCamRef.current) {
      try {
        const selectedMic = localStorage.getItem('watch_selected_mic');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: false 
        });
        localCamRef.current = stream;
        // Don't set isCamOn=true here, it's just audio
      } catch (err) {
        toast.error('Could not access microphone.');
        return;
      }
    }

    // Toggle tracks in existing streams
    if (localCamRef.current) {
      localCamRef.current.getAudioTracks().forEach(t => t.enabled = nextState);
      
      // If we are turning OFF and camera is also off, cleanup stream
      if (!nextState && !isCamOn) {
        localCamRef.current.getTracks().forEach(t => t.stop());
        localCamRef.current = null;
      }
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = nextState);
    }
    
    setIsMicOnCam(nextState);
    // Optimistic update: immediately reflect this user's mute state in their own user list view
    if (usernameRef.current) {
      setUserList(prev => prev.map(u =>
        u.username === usernameRef.current
          ? { ...u, isMuted: !nextState, isModMuted: nextState ? false : u.isModMuted }
          : u
      ));
    }
    if (socket) socket.emit('self_mute', { roomId: (roomId || '').toLowerCase(), isMuted: !nextState });
  };

  const openDM = (uname) => {
    dmTargetRef.current = uname; setDmTarget(uname); setChatTab('dm');
    chatTabRef.current = 'dm';
    setDmUnread(prev => ({ ...prev, [uname]: 0 }));
  };
  const totalDmUnread = Object.values(dmUnread).reduce((a, b) => a + b, 0);

  const copyRoomLink = () => { if (copied) return; navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Link copied!'); };

  const reportMsg = async (msg) => {
    try { await fetch(`${SOCKET_SERVER_URL}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, reporterUsername: username, reportedUsername: msg.username, message: msg.message }) }); toast.success('Reported'); } catch { }
  };

  const isGuestForLock = localStorage.getItem('watch_is_guest') === 'true';
  const forceMembersOnlyLock = isGuestForLock && room?.settings?.onlyLoggedIn;

  // ─── Guest Security & Loading Screens ───
  if (!isGuestVerified && !kickedReason && !roomNotFound) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(50px)', background: 'rgba(0,0,0,0.5)', zIndex: 1 }}></div>
         <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div className="cube-loader" style={{ margin: '0 auto' }}>
              <div className="cube-top"></div>
              <div className="cube-wrapper">
                <span style={{"--i":0}} className="cube-span"></span>
                <span style={{"--i":1}} className="cube-span"></span>
                <span style={{"--i":2}} className="cube-span"></span>
                <span style={{"--i":3}} className="cube-span"></span>
              </div>
            </div>
            <p style={{ marginTop: 24, padding: '8px 16px', background: 'rgba(99,102,241,0.1)', borderRadius: 20, border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Verifying Security...</p>
         </div>
      </div>
    );
  }

  // ─── Connection Loading State (Prevents Content Flickering for Banned Users) ───
  if (isConnecting && !isWaitingApproval) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#05030a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="lobby-dot" style={{ margin: '0 8px', display: 'inline-block' }} />
          <div className="lobby-dot" style={{ margin: '0 8px', display: 'inline-block', animationDelay: '0.2s' }} />
          <div className="lobby-dot" style={{ margin: '0 8px', display: 'inline-block', animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // ─── Lobby Waiting Screen (full page, no navbar) ───
  if (isWaitingApproval) {
    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
    return (
      <div style={{ position: 'fixed', inset: 0, background: isLightMode ? '#f8fafc' : 'linear-gradient(135deg, #0f0a23 0%, #05030a 100%)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 440, width: '90%', padding: '48px 40px', background: isLightMode ? '#ffffff' : 'rgba(255,255,255,0.02)', borderRadius: 40, border: isLightMode ? '1px solid rgba(168,85,247,0.2)' : '1px solid rgba(168,85,247,0.15)', boxShadow: isLightMode ? '0 20px 40px rgba(0,0,0,0.05)' : '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.05)', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden' }}>
          {/* Top gradient accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)', borderRadius: '40px 40px 0 0' }} />
          {/* Icon - steady glow */}
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)', boxShadow: '0 0 40px rgba(168,85,247,0.2)' }}>
            <Lock size={44} />
          </div>
          <h2 style={{ color: isLightMode ? '#1e293b' : '#fff', fontSize: 28, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-0.5px' }}>You're in the Lobby</h2>
          <p style={{ color: isLightMode ? '#334155' : 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 1.7, margin: '0 0 10px' }}>This room requires host approval to join.</p>
          <p style={{ color: isLightMode ? '#64748b' : 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, margin: '0 0 36px' }}>The host has been notified of your request. Please wait while they review it.</p>
          {/* Wave dots */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 36 }}>
            <div className="lobby-dot" />
            <div className="lobby-dot" />
            <div className="lobby-dot" />
          </div>
          <button
            onClick={() => { socket?.emit('leave_room', { roomId }); sessionStorage.removeItem(lobbyKey); navigate('/'); }}
            style={{ width: '100%', padding: '16px', background: isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.05)', border: isLightMode ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 20, color: isLightMode ? '#334155' : 'rgba(255,255,255,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: 15, transition: 'all 0.2s', letterSpacing: '0.2px' }}
            onMouseEnter={e => { e.currentTarget.style.background = isLightMode ? '#e2e8f0' : 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = isLightMode ? '#0f172a' : '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLightMode ? '#f1f5f9' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = isLightMode ? '#334155' : 'rgba(255,255,255,0.85)'; }}
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // ─── Kicked / Not Found Modal ───
  if (roomNotFound || kickedReason || forceMembersOnlyLock) {
    const isDeleted = kickedReason === 'room_deleted';
    const isBanned = kickedReason === 'banned';
    const isDenied = kickedReason === 'denied';
    const isMembersOnly = kickedReason === 'members_only' || forceMembersOnlyLock;

    return (
      <div style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'linear-gradient(135deg, #0f0a23 0%, #05030a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }} className="room-modals-overlay">
        <div style={{ textAlign: 'center', padding: 48, background: isLight ? '#ffffff' : 'rgba(255,255,255,0.02)', borderRadius: 48, border: isLight ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid rgba(255,255,255,0.05)', maxWidth: 500, width: '90%', boxShadow: isLight ? '0 32px 80px rgba(99, 102, 241, 0.08)' : '0 40px 100px rgba(0,0,0,0.8)' }}>
          <div style={{ width: 120, height: 120, borderRadius: '35%', background: isLight ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px', color: '#6366f1', transform: 'rotate(-8deg)', border: isLight ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid rgba(99,102,241,0.2)', position: 'relative' }}>
            {isBanned ? <Ban size={56} /> : (isDenied || isMembersOnly) ? <Lock size={56} /> : (isDeleted || roomNotFound ? <Hash size={56} /> : <LogOut size={56} />)}
            <div className="stay-white" style={{ position: 'absolute', top: -8, right: -8, width: 42, height: 42, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', border: isLight ? '6px solid #ffffff' : '6px solid #0f0a23', transform: 'rotate(8deg)', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>
              <X size={24} />
            </div>
          </div>

          <h1 style={{ color: isLight ? '#0f172a' : '#fff', fontSize: 36, fontWeight: 950, marginBottom: 20, letterSpacing: '-1.5px' }}>
            {isBanned ? 'You are Banned' : isDenied ? 'Access Denied' : isMembersOnly ? 'Members Only' : (isDeleted || roomNotFound ? 'Room Not Found' : 'You were Kicked')}
          </h1>

          <p style={{ color: isLight ? '#475569' : 'rgba(255,255,255,0.5)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, fontWeight: 500 }}>
            {isBanned ? "The host has restricted your access to this room permanently." :
              (kickedReason === 'denied' ? "The host didn't allow you to join this room." :
                (isMembersOnly ? "This room allows only signed-in users to join. Please log in to gain access." :
                  (isDeleted ? "This room has been permanently deleted by the host and no longer exists." :
                    (roomNotFound ? "We couldn't find the room you're looking for. It might have been deleted or the link is incorrect." :
                      "You have been removed from the room by the host."))))}
          </p>

          <button
            onClick={() => { socket?.emit('leave_room', { roomId }); navigate('/'); }}
            style={{ width: '100%', padding: '20px 0', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fffffe', fontSize: 17, fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isLight ? '0 8px 25px rgba(99, 102, 241, 0.2)' : '0 8px 25px rgba(99, 102, 241, 0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = isLight ? '0 12px 30px rgba(99, 102, 241, 0.35)' : '0 12px 30px rgba(99, 102, 241, 0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isLight ? '0 8px 25px rgba(99, 102, 241, 0.2)' : '0 8px 25px rgba(99, 102, 241, 0.4)'; }}
          >
            <span style={{ color: '#fffffe' }}>Back to Home</span>
          </button>
        </div>
      </div>
    );
  }



  // Helper to render camera tiles (shared for overlay and dedicated row modes)
  const renderCameras = (isOverlay) => {
    const allCams = [];
    const seenUsers = new Set();
    if (hasStartedCamOnce) {
      allCams.push({ id: 'local', isLocal: true, stream: localCamRef.current, username, isMuted: !isMicOnCam, userMicOff: !isMicOnCam });
      seenUsers.add(username);
    }
    Object.entries(remoteStreams).forEach(([sid, { stream, username: uname }]) => {
      if (uname === username || seenUsers.has(uname)) return;
      const uObj = userList.find(u => u.username?.toLowerCase() === uname?.toLowerCase());
      allCams.push({ id: sid, isLocal: false, stream, username: uname, isMuted: uObj?.isMuted });
      seenUsers.add(uname);
    });
    
    // Filter out locally hidden cams
    const filteredCams = allCams.filter(c => !hiddenCams.has(c.id));
    if (filteredCams.length === 0) return null;
    
    const PER_PAGE = 5;
    const totalPages = Math.ceil(filteredCams.length / PER_PAGE);
    const currentPage = Math.min(camPage, Math.max(0, totalPages - 1));
    const paginatedCams = filteredCams.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE);

    return (
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, 
        padding: isOverlay ? '8px 0' : '16px 0', 
        position: isOverlay ? 'absolute' : 'relative', 
        bottom: isOverlay ? (isFloatingBarMinimized ? 20 : 60) : 'auto', 
        left: 0, right: 0, zIndex: 100, pointerEvents: 'none',
        marginTop: isOverlay ? 0 : 12,
        marginBottom: isOverlay ? 0 : 12,
        background: isOverlay ? 'transparent' : (isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'),
        borderRadius: isOverlay ? 0 : 24,
        border: isOverlay ? 'none' : (isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)')
      }}>
        {totalPages > 1 && (
          <button onClick={() => setCamPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentPage === 0 ? '#444' : '#fff', cursor: currentPage === 0 ? 'default' : 'pointer' }}>
            <ChevronLeft size={18} />
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', pointerEvents: 'none' }}>
          {paginatedCams.map(cam => {
            const vTracks = cam.stream ? cam.stream.getVideoTracks() : [];
            const hasVideo = vTracks.length > 0 && vTracks[0].enabled && !vTracks[0].muted;
            const uObj = userList.find(u => u.username?.toLowerCase() === cam.username?.toLowerCase());
            const rawAvatar = knownAvatars[cam.username] || uObj?.avatarPath || uObj?.avatar || uObj?.profilePic;
            const avatarSrc = (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.trim().length > 5) 
              ? (rawAvatar.startsWith('http') ? rawAvatar : `${SOCKET_SERVER_URL}${rawAvatar}`) : null;
            const isCircle = circleCams.has(cam.id);
            const isDraggable = allCams.length <= 3;
            const pos = camPositions[cam.id] || { x: 0, y: 0 };
            const currentWidth = camSizes[cam.id] || (isCircle ? 90 : 120);
            const currentHeight = isCircle ? currentWidth : (currentWidth * 0.75);

            return (
              <div key={cam.id} className="cam-container" 
                onClick={(e) => { 
                  if (e.target.dataset.dragHandle) return; 
                  // Prevent toggle if we just finished dragging or resizing
                  if (draggingCamRef.current?.moved || resizingCamRef.current?.moved) return; 
                  
                  setCircleCams(prev => { 
                    const next = new Set(prev); 
                    if (next.has(cam.id)) next.delete(cam.id); 
                    else next.add(cam.id); 
                    broadcastUIState({ circleCams: next });
                    return next; 
                  }); 
                }} 
                onMouseDown={(e) => { 
                  if (!isDraggable || e.target.dataset.dragHandle) return; 
                  e.preventDefault(); 
                  const initial = camPositions[cam.id] || { x: 0, y: 0 }; 
                  draggingCamRef.current = { id: cam.id, startX: e.clientX, startY: e.clientY, initialX: initial.x, initialY: initial.y, moved: false }; 
                  setIsDraggingCam(true);
                  const onMouseMove = (m) => { 
                    if (!draggingCamRef.current) return; 
                    const dx = m.clientX - draggingCamRef.current.startX; 
                    const dy = m.clientY - draggingCamRef.current.startY; 
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) draggingCamRef.current.moved = true; 
                    setCamPositions(prev => ({ ...prev, [draggingCamRef.current.id]: { x: draggingCamRef.current.initialX + dx, y: draggingCamRef.current.initialY + dy } })); 
                    
                    // Improved detection using bounding rect
                    const zone = document.getElementById('cam-remove-zone');
                    if (zone) {
                      const rect = zone.getBoundingClientRect();
                      const over = m.clientX >= rect.left && m.clientX <= rect.right &&
                                   m.clientY >= rect.top && m.clientY <= rect.bottom;
                      isOverRemoveRef.current = over;
                      setIsOverRemoveZone(over);
                    }
                  }; 
                  const onMouseUp = () => { 
                    if (draggingCamRef.current) {
                      if (isOverRemoveRef.current) {
                        setHiddenCams(prev => {
                          const next = new Set(prev);
                          next.add(draggingCamRef.current.id);
                          return next;
                        });
                        toast('Video hidden locally', { icon: '🙈' });
                      }
                      broadcastUIState();
                    }
                    setIsDraggingCam(false);
                    setIsOverRemoveZone(false);
                    isOverRemoveRef.current = false;
                    window.removeEventListener('mousemove', onMouseMove); 
                    window.removeEventListener('mouseup', onMouseUp); 
                    setTimeout(() => { draggingCamRef.current = null; }, 50); 
                  }; 
                  window.addEventListener('mousemove', onMouseMove); 
                  window.addEventListener('mouseup', onMouseUp); 
                }} 
                style={{ 
                  position: 'relative', width: currentWidth, height: currentHeight, borderRadius: isCircle ? '50%' : 16, 
                  background: 'transparent', 
                  border: 'none', 
                  flexShrink: 0, transition: (resizingCamRef.current?.id === cam.id || draggingCamRef.current?.id === cam.id) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                  cursor: isDraggable ? 'move' : 'pointer', transform: `translate(${pos.x}px, ${pos.y}px)`, 
                  zIndex: draggingCamRef.current?.id === cam.id ? 100 : 1, pointerEvents: 'auto',
                  boxShadow: 'none'
                }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: isCircle ? '50%' : 14, overflow: 'hidden', zIndex: 1 }}>
                  <VideoTile stream={cam.stream} isMuted={cam.isMuted || cam.isLocal} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                </div>

                {/* Resize Handles - High-end Glassmorphic Overlays */}
                {isDraggable && (
                  <div className="cam-ui-overlay" style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', borderRadius: isCircle ? '50%' : 14 }}>
                    {[
                      { id: 'br', cursor: 'nwse-resize', bottom: isCircle ? '14.6%' : -4, right: isCircle ? '14.6%' : -4 },
                      { id: 'bl', cursor: 'nesw-resize', bottom: isCircle ? '14.6%' : -4, left: isCircle ? '14.6%' : -4 },
                      { id: 'tr', cursor: 'nesw-resize', top: isCircle ? '14.6%' : -4, right: isCircle ? '14.6%' : -4 },
                      { id: 'tl', cursor: 'nwse-resize', top: isCircle ? '14.6%' : -4, left: isCircle ? '14.6%' : -4 }
                    ].map(h => (
                      <div key={h.id} data-drag-handle="true" 
                        onMouseDown={(e) => { 
                          e.preventDefault(); e.stopPropagation(); 
                          resizingCamRef.current = { id: cam.id, startX: e.clientX, startY: e.clientY, startWidth: currentWidth, startPos: { ...pos }, handle: h.id, isCircle, moved: false }; 
                          const onMouseMove = (me) => { 
                            if (!resizingCamRef.current) return;
                            const dx = me.clientX - resizingCamRef.current.startX;
                            const dy = me.clientY - resizingCamRef.current.startY;
                            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) resizingCamRef.current.moved = true;

                            let newWidth = resizingCamRef.current.startWidth;
                            let newX = resizingCamRef.current.startPos.x;
                            let newY = resizingCamRef.current.startPos.y;

                            if (h.id === 'br') newWidth += dx;
                            else if (h.id === 'bl') { newWidth -= dx; newX += dx; }
                            else if (h.id === 'tr') { newWidth += dx; newY += dy; }
                            else if (h.id === 'tl') { newWidth -= dx; newX += dx; newY += dy; }

                            const min = resizingCamRef.current.isCircle ? 60 : 80; 
                            if (newWidth < min) return;
                            
                            setCamSizes(prev => ({ ...prev, [cam.id]: newWidth }));
                            if (!isCircle) setCamPositions(prev => ({ ...prev, [cam.id]: { x: newX, y: newY } }));
                          }; 
                          const onMouseUp = () => { 
                            // Small delay to ensure the onClick doesn't see 'moved' as false immediately
                            setTimeout(() => { 
                              if (resizingCamRef.current) {
                                broadcastUIState();
                                resizingCamRef.current = null;
                              }
                            }, 50);
                            window.removeEventListener('mousemove', onMouseMove); 
                            window.removeEventListener('mouseup', onMouseUp); 
                            document.body.style.cursor = 'default'; 
                          }; 
                          window.addEventListener('mousemove', onMouseMove); 
                          window.addEventListener('mouseup', onMouseUp); 
                          document.body.style.cursor = h.cursor; 
                        }} 
                        style={{ 
                          position: 'absolute', top: h.top, bottom: h.bottom, left: h.left, right: h.right,
                          width: 28, height: 28, cursor: h.cursor, pointerEvents: 'auto',
                          display: 'flex', alignItems: (h.id.startsWith('b') ? 'flex-end' : 'flex-start'), 
                          justifyContent: (h.id.endsWith('r') ? 'flex-end' : 'flex-start'),
                          padding: 4, transform: isCircle ? (h.id === 'br' ? 'translate(30%, 30%)' : h.id === 'bl' ? 'translate(-30%, 30%)' : h.id === 'tr' ? 'translate(30%, -30%)' : 'translate(-30%, -30%)') : 'none'
                        }}>
                        {isCircle ? (
                          <div style={{ 
                            width: 12, height: 12, 
                            background: 'rgba(255,255,255,0.4)', 
                            backdropFilter: 'blur(8px)',
                            borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%', // Blob shape
                            border: '1.5px solid rgba(255,255,255,0.6)',
                            boxShadow: '0 4px 12px rgba(255,255,255,0.2)',
                            animation: 'blobFloat 3s infinite alternate ease-in-out'
                          }} />
                        ) : (
                          <div style={{ 
                            width: 14, height: 14, 
                            background: 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(6px)',
                            borderRight: h.id.endsWith('r') ? '2.5px solid rgba(255,255,255,0.9)' : 'none',
                            borderLeft: h.id.endsWith('l') ? '2.5px solid rgba(255,255,255,0.9)' : 'none',
                            borderTop: h.id.startsWith('t') ? '2.5px solid rgba(255,255,255,0.9)' : 'none',
                            borderBottom: h.id.startsWith('b') ? '2.5px solid rgba(255,255,255,0.9)' : 'none',
                            borderRadius: h.id === 'tl' ? '6px 0 0 0' : h.id === 'tr' ? '0 6px 0 0' : h.id === 'bl' ? '0 0 0 6px' : '0 0 6px 0',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!hasVideo && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: isCircle ? '50%' : 14, overflow: 'hidden', zIndex: 1 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #312e81, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {avatarSrc ? (
                        <img src={avatarSrc} style={{ width: currentWidth * 0.55, height: currentWidth * 0.55, borderRadius: '50%', objectFit: 'cover', border: 'none' }} alt="" />
                      ) : (
                        <div className="stay-white" style={{ width: currentWidth * 0.55, height: currentWidth * 0.55, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: Math.max(12, currentWidth * 0.18) }}>{cam.username?.substring(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Info Overlay - Only visible on hover */}
                <div className="cam-ui-overlay" style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
                  <div className="cam-name-overlay stay-white" style={{ 
                    position: 'absolute', 
                    top: isCircle ? 'auto' : 10,
                    bottom: isCircle ? 14 : 'auto',
                    left: isCircle ? '50%' : 12,
                    transform: isCircle ? 'translateX(-50%)' : 'none',
                    textAlign: isCircle ? 'center' : 'left',
                    fontSize: isCircle ? Math.max(9, currentWidth/12) : 11,
                    color: '#fff', fontWeight: 800, 
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)', 
                    whiteSpace: 'nowrap',
                    background: 'rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(4px)',
                    padding: isCircle ? '2px 8px' : '3px 10px',
                    borderRadius: 10
                  }}>
                    {cam.username} {cam.isLocal ? '(You)' : ''}
                  </div>
                  {(Math.abs(cam.userMicOff) === 1 || cam.isMuted) && (
                    <div style={{ 
                      position: 'absolute', 
                      top: isCircle ? 14 : 8,
                      right: isCircle ? 'auto' : 8,
                      left: isCircle ? '50%' : 'auto',
                      transform: isCircle ? 'translateX(-50%)' : 'none',
                      background: 'rgba(239,68,68,0.95)', 
                      borderRadius: 8, padding: '4px 8px', 
                      display: 'flex',
                      boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <MicOff size={isCircle ? Math.max(10, currentWidth/15) : 12} color="#fff" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <button onClick={() => setCamPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1} style={{ pointerEvents: 'auto', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentPage === totalPages - 1 ? '#444' : '#fff', cursor: currentPage === totalPages - 1 ? 'default' : 'pointer' }}>
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    );
  };

  // ─── RENDER ───

  return (
    <div 
      className={isTvMode ? "tv-mode" : ""}
      style={{ 
        position: 'relative', display: 'flex', height: '100vh', flexDirection: 'column', 
        background: 'var(--room-main-bg)', fontFamily: "'Outfit',sans-serif", color: 'var(--text-primary)',
        pointerEvents: isTvMode ? 'none' : 'auto'
      }}>
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 99999, top: 8 }}
        toastOptions={{
          duration: 2500,
          style: {
            background: isLight ? '#fff' : 'rgba(18, 14, 35, 0.97)',
            color: isLight ? '#1e293b' : '#fff',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'Outfit', sans-serif",
            boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            padding: '12px 18px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
            style: {
              background: isLight ? '#fff' : 'rgba(16, 12, 30, 0.97)',
              border: isLight ? '1px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
            }
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
            style: {
              background: isLight ? '#fff' : 'rgba(16, 12, 30, 0.97)',
              border: isLight ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
            }
          }
        }}
      />
      {/* System Toaster for Join Requests (Lower z-index when modal open) */}
      <Toaster
        toasterId="system"
        position="top-center"
        containerStyle={{ zIndex: (roomSettingsModalOpen || showShareModal || showYtBrowser || showTwitchBrowser || showVimeoBrowser || showMediaSelector || banConfirmTarget || showGuidedShare || renameModalOpen || clearChatModalOpen) ? 8000 : 99999, top: 8 }}
      />
      <style>{`
        @keyframes crownPulse { 0%,100%{filter:drop-shadow(0 0 4px #FFD700);} 50%{filter:drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FF8C00);} }
        @keyframes slideIn { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
        @keyframes slideInDown { from{opacity:0;transform:translateY(-24px) scale(0.96);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes slideOutUp { from{opacity:1;transform:translateY(0) scale(1);} to{opacity:0;transform:translateY(-20px) scale(0.95);} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0);} 40%{transform:scale(1);} }
        @keyframes joinPulse { 0%,100%{box-shadow:0 0 0 0 rgba(168,85,247,0.4);} 50%{box-shadow:0 0 0 8px rgba(168,85,247,0);} }
        .msg-enter{animation:slideIn 0.2s ease;}
        .typing-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#888;animation:bounce 1.4s infinite ease-in-out;}
        .typing-dot:nth-child(1){animation-delay:-0.32s;} .typing-dot:nth-child(2){animation-delay:-0.16s;}
        .react-btn{opacity:0;transition:opacity 0.15s;} .msg-row:hover .react-btn{opacity:1;}
        .usr-btn{background:transparent;border:none;color:#555;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:7px;transition:background 0.15s,color 0.15s;width:28px;height:28px;}
        .usr-btn:hover{background:rgba(255,255,255,0.12);color:#fff;}
        .usr-menu-item{width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;background:transparent;border:none;cursor:pointer;border-radius:7px;font-size:12px;font-weight:500;font-family:inherit;transition:background 0.12s;}
        .usr-menu-item:hover{background:rgba(255,255,255,0.07);}
        ::-webkit-scrollbar{display:none !important;} *{-ms-overflow-style:none !important;scrollbar-width:none !important;}
        .share-btn { transition: transform 0.2s ease, filter 0.2s ease; }
        .share-btn:hover { filter: brightness(1.2); }
        .player-ctrl-btn{background:transparent;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:4px;border-radius:6px;transition:background 0.15s;}
        .player-ctrl-btn:hover{background:rgba(255,255,255,0.15);}
        .player-scrubber{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;outline:none;cursor:pointer;background:transparent;}
        .player-scrubber::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#6366f1;cursor:pointer;box-shadow:0 0 4px rgba(99,102,241,0.8);transition:transform 0.1s;}
        .player-scrubber::-webkit-slider-thumb:hover{transform:scale(1.3);}
        .player-vol-slider{-webkit-appearance:none;appearance:none;width:70px;height:3px;border-radius:2px;outline:none;cursor:pointer;background:transparent;}
        .join-req-approve-btn { flex: 1; padding: 7px 16px; background: linear-gradient(135deg, #6366f1, #a855f7); border: none; border-radius: 10px; color: #ffffff !important; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
        .join-req-deny-btn { flex: 1; padding: 7px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #ffffff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; text-align: center; }
        .stay-white { color: #ffffff !important; }
        .join-req-approve-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); filter: brightness(1.1); }
        .join-req-approve-btn:active { transform: translateY(0); scale: 0.98; }
        .join-req-deny-btn:hover { background: rgba(239, 68, 68, 0.2) !important; color: #ff4b4b !important; border-color: rgba(239, 68, 68, 0.4) !important; transform: scale(1.03); }
        .join-badge { 
          position: absolute; top: -6px; right: -6px; background: #8b5cf6; color: #ffffff !important; 
          border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; 
          font-size: 10px; font-weight: 900; border: 2px solid #000; box-shadow: 0 0 10px rgba(139, 92, 246, 0.4); 
          animation: badgePulse 2s infinite; 
        }
        @keyframes badgePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes waterWave {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .pulse-orange-dot { animation: waterWave 2s infinite; }
        .nav-icon-btn { position: relative; width: 38px; height: 38px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .nav-icon-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
        .nav-icon-btn.active { background: rgba(99,102,241,0.12) !important; border-color: rgba(99,102,241,0.4) !important; color: #818cf8 !important; }
        html[data-theme='light'] .forced-white, .forced-white { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }

        /* ── Light Mode Overrides ── */
        html[data-theme='light'] .nav-icon-btn.active { color: #6366f1 !important; background: rgba(99,102,241,0.1) !important; }
        
        html[data-theme='light'] .room-header { background: #fff !important; border-bottom-color: rgba(0,0,0,0.08) !important; }
        html[data-theme='light'] .back-btn-room { background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.08) !important; color: #666 !important; }
        html[data-theme='light'] .back-btn-room:hover { background: rgba(0,0,0,0.08) !important; color: #111 !important; }
        
        html[data-theme='light'] .join-req-approve-btn { background: #8b5cf6; box-shadow: 0 2px 8px rgba(139,92,246,0.3); }
        html[data-theme='light'] .join-req-approve-btn:hover { background: #7c3aed; box-shadow: 0 4px 12px rgba(139,92,246,0.4); }
        html[data-theme='light'] .join-req-deny-btn { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
        html[data-theme='light'] .join-req-deny-btn:hover { background: #fee2e2 !important; color: #dc2626 !important; border-color: #fecaca !important; }
        html[data-theme='light'] .join-badge { border-color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        
        .cam-container .cam-ui-overlay { opacity: 0; transition: opacity 0.3s ease; }
        .cam-container:hover .cam-ui-overlay { opacity: 1; }
        
        @keyframes blobFloat {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          100% { transform: translate(-45%, -55%) scale(1.1) rotate(5deg); }
        }
      `}</style>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Share Modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {showShareModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={() => setShowShareModal(false)}>
          <div style={{ background: isLight ? '#fff' : '#141420', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, maxWidth: 440, width: '90%', position: 'relative', boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.9)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowShareModal(false)} style={{ position: 'absolute', top: -2, right: -64, width: 44, height: 44, borderRadius: '50%', background: isLight ? '#fff' : '#2a2a3e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#1e293b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 4px 12px rgba(0,0,0,0.5)', transition: 'background 0.2s, transform 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f8fafc' : '#3a3a4e'; e.currentTarget.style.transform = 'scale(1.05)' }} onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#fff' : '#2a2a3e'; e.currentTarget.style.transform = 'scale(1)' }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 800, color: isLight ? '#1e293b' : '#fff' }}>{t('inviteFriends', 'Invite Friends')}</h2>
            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ flex: 1, fontSize: 13, color: isLight ? '#475569' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{window.location.href}</span>
              <button onClick={copyRoomLink} style={{ background: copied ? '#10b981' : 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <span style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>{copied ? t('copied', 'Copied!') : t('copyBtn', 'Copy')}</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[{ icon: <FaWhatsapp size={20} />, label: 'WhatsApp', color: '#25D366', href: `https://api.whatsapp.com/send?text=${encodeURIComponent(window.location.href)}` },
              { icon: <FaTelegramPlane size={20} />, label: 'Telegram', color: '#0088cc', href: `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}` },
              { icon: <FaInstagram size={20} />, label: 'Instagram', color: '#E1306C', href: `https://www.instagram.com/` },
              { icon: <FaSnapchatGhost size={20} />, label: 'Snapchat', color: '#FFFC00', href: `https://www.snapchat.com/` },
              { icon: <FaXTwitter size={20} />, label: 'X', color: isLight ? '#000' : '#e5e5e5', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}` },
              { icon: <SiGmail size={20} />, label: 'Email', color: '#EA4335', href: `mailto:?body=${encodeURIComponent(window.location.href)}` },
              { icon: <FaDiscord size={20} />, label: 'Discord', color: '#5865F2', href: `https://discord.com/channels/@me` },
              { icon: <FaRedditAlien size={20} />, label: 'Reddit', color: '#FF4500', href: `https://reddit.com/submit?url=${encodeURIComponent(window.location.href)}` },
              { icon: <FaFacebookF size={20} />, label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}` },
              { icon: <FaLinkedinIn size={20} />, label: 'LinkedIn', color: '#0A66C2', href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(window.location.href)}` },
              { icon: <FaPinterestP size={20} />, label: 'Pinterest', color: '#E60023', href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}` },
              { icon: <FaTwitch size={20} />, label: 'Twitch', color: '#9146FF', href: `https://www.twitch.tv/` }
              ].map(s => (
                <a key={s.label} className="share-btn" href={s.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', color: s.color === '#FFFC00' ? '#eab308' : s.color }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                  <span style={{ fontSize: 11, color: isLight ? '#64748b' : '#666' }}>{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      {!isTvMode && (
      <div className="room-header" style={{ height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--room-header-bg)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--room-border)', flexShrink: 0, position: 'relative', zIndex: 1000 }}>
        {/* Left: Navigation & Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="back-btn-room" onClick={handleLeaveRoom} title="Back to Home" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', borderRadius: 12, padding: '8px 14px', color: isLight ? '#475569' : '#888', cursor: 'pointer', transition: 'all 0.2s' }}>
            <ChevronLeft size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('back', 'Back')}</span>
          </button>
          <div style={{ width: 1, height: 24, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'default', padding: 0 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 10, 
              background: 'linear-gradient(135deg,#6366f1,#a855f7)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
              overflow: 'hidden'
            }}>
              <Play size={14} fill="#fff" color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px' }}>WatchTogether</span>
          </div>
          <div style={{ width: 1, height: 24, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <span style={{ fontSize: 13, color: isLight ? '#64748b' : '#666', fontWeight: 600 }}>{t('roomLabel', 'Room:')} <span style={{ color: isLight ? '#1e293b' : '#aaa' }}>{roomId}</span></span>
        </div>

        {/* Right: Actions & Profile */}
        <div ref={navIconsRef} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Watching / Participants Button */}
          <div style={{ position: 'relative' }} ref={userPanelRef}>
            <button onClick={() => { 
              setShowUserPanel(!showUserPanel); setShowSettings(false); setShowRecentChats(false); 
            }} 
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8, 
                background: isLight ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)', 
                border: isLight ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(16,185,129,0.3)', 
                borderRadius: 14, padding: '8px 14px', fontSize: 13, color: '#10b981', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: isLight ? '0 2px 8px rgba(16,185,129,0.05)' : 'none'
              }}
            >
              <Users size={16} color="#10b981" />
              {userCount}
              {isEffectiveHost && joinRequests.length > 0 && (
                <div className="join-badge stay-white">
                  {joinRequests.length}
                </div>
              )}
            </button>
            {showUserPanel && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, background: isLight ? '#fff' : '#0a0a0f', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(129, 140, 248, 0.2)', borderRadius: 24, padding: '20px 12px', minWidth: 300, zIndex: 50000, boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.9)' }}>
                <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 900, letterSpacing: '1.5px', marginBottom: 20, padding: '0 12px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('roomMembers', 'Room Members')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="stay-white" style={{ background: '#6366f1', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 900 }}>{userCount}</span>
                    {isEffectiveHost && userList.some(u => !u.isMuted) && (
                      <button 
                        className="usr-btn mod-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHeaderModMenuPos({ top: rect.bottom + 8, left: rect.left - 100 });
                          setShowHeaderModMenu(!showHeaderModMenu);
                          setModMenuTarget(null);
                        }}
                        style={{ background: 'transparent', border: 'none', color: isLight ? '#64748b' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                  {/* — Pending Joins (if host) — */}
                  {isEffectiveHost && joinRequests.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 900, letterSpacing: '1.2px', marginBottom: 12, padding: '0 4px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div 
                          className="pulse-orange-dot"
                          style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} 
                        />
                        {t('pendingJoinRequests', 'Pending Join Requests')}
                      </div>
                      {joinRequests.map(req => {
                        const rawAvatar = req.avatarPath || knownAvatars[req.username];
                        const avatarSrc = rawAvatar ? (rawAvatar.startsWith('http') ? rawAvatar : `${SOCKET_SERVER_URL}${rawAvatar}`) : null;
                        return (
                          <div key={req.socketId} style={{ 
                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px', borderRadius: 16, 
                            background: isLight ? '#fff' : 'rgba(255,255,255,0.03)', 
                            border: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.08)', 
                            marginBottom: 8,
                            boxShadow: isLight ? '0 2px 10px rgba(0,0,0,0.03)' : '0 4px 20px rgba(0,0,0,0.2)'
                          }}>
                            <Avatar name={req.username} src={avatarSrc} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, color: isLight ? '#0f172a' : '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                {req.username}
                              </span>
                              <span style={{ fontSize: 10, color: isLight ? '#64748b' : '#888', fontWeight: 500 }}>{t('wantsToJoin', 'wants to join')}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button 
                                onClick={() => { 
                                  socket.emit('deny_join', { roomId, targetSocketId: req.socketId }); 
                                  setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
                                  const tid = `join-req-${req.username}`;
                                  toast.dismiss(tid, 'system');
                                  activeJoinToastIds.current.delete(tid);
                                  if (notifSettingsRef.current.app && notifSettingsRef.current.joinRequests) {
                                    toast(t('deniedUser', 'Denied {{username}}', { username: req.username }), { icon: '🚫', duration: 2000 });
                                  }
                                }} 
                                style={{ background: isLight ? '#fff1f2' : 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', padding: '6px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = isLight ? '#ffe4e6' : 'rgba(239,68,68,0.2)'}
                                onMouseLeave={e => e.currentTarget.style.background = isLight ? '#fff1f2' : 'rgba(239,68,68,0.1)'}
                              >
                                {t('deny', 'Deny')}
                              </button>
                               <button 
                                onClick={() => { 
                                  socket.emit('approve_join', { roomId, targetSocketId: req.socketId }); 
                                  setJoinRequests(prev => prev.filter(r => r.socketId !== req.socketId));
                                  const tid = `join-req-${req.username}`;
                                  toast.dismiss(tid, 'system');
                                  activeJoinToastIds.current.delete(tid);
                                  if (notifSettingsRef.current.app && notifSettingsRef.current.joinRequests) {
                                    toast.success(t('approvedUser', '{{username}} approved!', { username: req.username }));
                                  }
                                }} 
                                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', color: '#ffffff', padding: '6px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                                className="stay-white"
                              >
                                ✓ {t('approve', 'Approve')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', margin: '16px 12px' }} />
                    </div>
                  )}

                  {/* User List with sorting: Host first, then Me, then others */}
                  {[...userList].sort((a, b) => {
                    // 1. Host always first
                    if (a.isHost && !b.isHost) return -1;
                    if (!a.isHost && b.isHost) return 1;
                    // 2. Me second (if not host)
                    const aIsMe = a.socketId === socket?.id;
                    const bIsMe = b.socketId === socket?.id;
                    if (aIsMe && !bIsMe) return -1;
                    if (!aIsMe && bIsMe) return 1;
                    // 3. Alphabetical for others
                    return (a.username || '').localeCompare(b.username || '');
                  }).map(u => {
                    const uIsHost = !!u.isHost;
                    const uIsAdmin = !!u.isAdmin;
                    
                    const uIsMe = u.socketId === socket?.id;
                    const rawAvatar = u.avatarPath || knownAvatars[u.username];
                    const avatarSrc = rawAvatar
                      ? (rawAvatar.startsWith('http') ? rawAvatar : `${SOCKET_SERVER_URL}${rawAvatar}`)
                      : null;
                    return (
                      <div key={u.socketId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 16, transition: 'all 0.2s', background: uIsMe ? (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)') : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)'), border: uIsMe ? (isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.1)') : '1px solid transparent' }} className="usr-row">
                        <Avatar name={u.username} src={avatarSrc} isHost={uIsHost} isAdmin={uIsAdmin} isMuted={!!u.isMuted} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, color: uIsMe ? (isLight ? '#000' : '#fff') : (isLight ? '#1e293b' : '#eee'), fontWeight: uIsMe ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.username}{uIsMe ? t('youSuffix', ' (You)') : ''}
                            </span>
                            {uIsHost ? (
                              <span title="Host" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Star size={12} color="#fbbf24" fill="#fbbf24" />
                              </span>
                            ) : uIsAdmin ? (
                              <span title="Admin" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Shield size={12} color={isLight ? "#4f46e5" : "#818cf8"} fill={isLight ? "#4f46e5" : "#818cf8"} />
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {!uIsMe && (
                            <button className="usr-btn" title="Private chat" onClick={() => { openDM(u.username); setShowUserPanel(false); }} style={{ width: 32, height: 32, borderRadius: 10, background: isLight ? '#fff' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isLight ? '#64748b' : '#888' }}>
                              <MessageCircle size={14} />
                            </button>
                          )}
                          
                          {/* Moderation Menu (3 dots) */}
                          {isEffectiveHost && !uIsMe && (
                            <button 
                              className={`usr-btn mod-btn${modMenuTarget === u.socketId ? ' active' : ''}`} 
                              title="Moderation" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const rect = e.currentTarget.getBoundingClientRect();
                                setModMenuPos({ top: rect.bottom + 8, left: rect.left - 110 });
                                setModMenuTarget(modMenuTarget === u.socketId ? null : u.socketId); 
                                setShowHeaderModMenu(false);
                              }}
                              style={{ width: 32, height: 32, borderRadius: 10, background: modMenuTarget === u.socketId ? 'rgba(99,102,241,0.2)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)'), border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: modMenuTarget === u.socketId ? '#4f46e5' : (isLight ? '#64748b' : '#888') }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Floating Moderation Dropdown (Fixed to avoid clipping) */}
                {modMenuTarget && (
                  <div style={{ position: 'fixed', top: modMenuPos.top, left: modMenuPos.left, background: isLight ? '#fff' : '#16161e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 6, zIndex: 60001, minWidth: 150, boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 15px 40px rgba(0,0,0,0.8)', animation: 'slideUp 0.2s ease' }} onMouseDown={e => e.stopPropagation()} className="mod-menu-container">
                    {(() => {
                      const targetUser = userList.find(u => u.socketId === modMenuTarget);
                      if (!targetUser) return null;
                      return (
                        <>
                          {!targetUser.isMuted && (
                            <button onClick={() => { socket.emit('mod_mute', { roomId, targetSocketId: modMenuTarget, isMuted: true }); setModMenuTarget(null); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <MicOff size={15} color={isLight ? "#dc2626" : "#ef4444"} /> {t('muteUser', 'Mute User')}
                            </button>
                          )}
                          <button onClick={() => { socket.emit('mod_kick', { roomId, targetSocketId: modMenuTarget }); setModMenuTarget(null); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <UserMinus size={15} color={isLight ? "#d97706" : "#f59e0b"} /> {t('kickUser', 'Kick User')}
                          </button>
                          <button onClick={() => { socket.emit('mod_toggle_admin', { roomId, targetSocketId: modMenuTarget }); setModMenuTarget(null); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {targetUser.isAdmin ? <ShieldOff size={15} color={isLight ? "#4f46e5" : "#818cf8"} /> : <Shield size={15} color={isLight ? "#4f46e5" : "#818cf8"} />}
                            {targetUser.isAdmin ? t('removeAdmin', 'Remove Admin') : t('makeAdmin', 'Make Admin')}
                          </button>
                          <button onClick={() => { setBanConfirmTarget(targetUser); setModMenuTarget(null); setShowUserPanel(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', borderTop: isLight ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 14, color: isLight ? '#000' : '#f87171', cursor: 'pointer', borderRadius: '0 0 10px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isLight ? '#000' : '#f87171' }}>
                            <Ban size={15} color={isLight ? "#be123c" : "#f87171"} /> {t('banUser', 'Ban User')}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}

                {showHeaderModMenu && (
                  <div style={{ position: 'fixed', top: headerModMenuPos.top, left: headerModMenuPos.left, background: isLight ? '#fff' : '#16161e', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 6, zIndex: 60002, minWidth: 150, boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.1)' : '0 15px 40px rgba(0,0,0,0.8)' }} onMouseDown={e => e.stopPropagation()} className="mod-menu-container">
                    <button onClick={() => { socket.emit('mod_mute_all', { roomId }); setShowHeaderModMenu(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <MicOff size={15} color={isLight ? "#dc2626" : "#ef4444"} /> {t('muteAll', 'Mute All')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Global Chats */}
          <div style={{ position: 'relative' }}>
            <button className={`nav-icon-btn${showRecentChats ? ' active' : ''}`} title="Global Chats" onClick={() => { setShowRecentChats(!showRecentChats); setShowUserPanel(false); setShowSettings(false); }} style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', color: isLight ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
              <MessageSquare size={18} strokeWidth={2.5} />
              {totalUnread > 0 && <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalUnread > 9 ? '9+' : totalUnread}</div>}
            </button>
          </div>

          {/* Share Button */}
          <button 
            className="nav-icon-btn"
            onClick={() => {
              setShowShareModal(true);
              setShowUserPanel(false);
              setShowSettings(false);
              setShowRecentChats(false);
            }} 
            title="Share Room" 
            style={{ 
              width: 38, height: 38, borderRadius: 12, 
              background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', 
              color: isLight ? '#000' : '#fff', cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              transition: 'all 0.2s' 
            }}
          >
            <Share2 size={16} strokeWidth={2.5} />
          </button>

          {/* Settings Button */}
          <div style={{ position: 'relative' }} ref={settingsRef}>
            <button onClick={() => { setShowSettings(!showSettings); setShowUserPanel(false); setShowRecentChats(false); }} className={`nav-icon-btn${showSettings ? ' active' : ''}`} style={{ width: 38, height: 38, background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isLight ? '#000' : '#fff' }}>
              <Settings size={18} strokeWidth={2.5} />
            </button>
            {showSettings && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, background: isLight ? '#fff' : '#141414', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, minWidth: 200, zIndex: 5000, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 10px 40px rgba(0,0,0,0.8)' }}>
                <button className="settings-menu-btn" onClick={async () => {
                  const isPinned = pinnedRooms.includes(roomId);
                  const next = isPinned ? pinnedRooms.filter(r => r !== roomId) : [...pinnedRooms, roomId];
                  setPinnedRooms(next);
                  localStorage.setItem('pinned_rooms', JSON.stringify(next));
                  
                  const token = localStorage.getItem('watch_token');
                  if (token) {
                    try {
                      await fetch(`${SOCKET_SERVER_URL}/api/profile/pinned-rooms`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ pinnedRooms: next })
                      });
                    } catch (err) {
                      console.error('Failed to sync pinned rooms', err);
                    }
                  }

                  toast.success(isPinned ? 'Room unpinned' : 'Room pinned!');
                  setShowSettings(false);
                }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Pin size={16} color={isLight ? '#4f46e5' : '#888'} /> {pinnedRooms.includes(roomId) ? t('unpinRoom', 'Unpin Room') : t('pinRoom', 'Pin Room')}
                </button>
                <button className="settings-menu-btn" disabled={!isEffectiveHost} onClick={() => {
                  if (!isEffectiveHost) return;
                  socket.emit('toggle_public', { isPublic: !isPublic });
                  setShowSettings(false);
                }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: isEffectiveHost ? 'pointer' : 'not-allowed', opacity: isEffectiveHost ? 1 : 0.4, borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isPublic ? <Lock size={16} color={isLight ? '#d97706' : '#f59e0b'} /> : <Globe size={16} color={isLight ? '#059669' : '#10b981'} />}
                  {isPublic ? t('makePrivate', 'Make this private') : t('makePublic', 'Make this public')}
                </button>
                {isEffectiveHost && (
                  <button className="settings-menu-btn" onClick={() => { setRoomSettingsModalOpen(true); setShowSettings(false); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Settings2 size={16} color={isLight ? '#4f46e5' : '#818cf8'} /> {t('roomSettings', 'Room Settings')}
                  </button>
                )}
                <div style={{ height: 1, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                <button className="settings-menu-btn-danger" onClick={() => { socket?.emit('leave_room', { roomId }); setShowSettings(false); navigate('/'); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#ef4444' : '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <LogOut size={16} color={isLight ? '#ef4444' : '#f87171'} /> {t('leaveRoom', 'Leave Room')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      {/* YouTube Browser Modal */}
      {showYtBrowser && (
        <YouTubeBrowserModal
          isLight={isLight}
          onSelect={(url) => {
            changeMedia(url);
            setInputUrl(url);
          }}
          onClose={() => setShowYtBrowser(false)}
        />
      )}

      {/* Twitch Browser Modal */}
      {showTwitchBrowser && (
        <TwitchBrowserModal
          isLight={isLight}
          onSelect={(url) => {
            changeMedia(url);
            setInputUrl(url);
          }}
          onClose={() => setShowTwitchBrowser(false)}
        />
      )}

      {/* Vimeo Browser Modal */}
      {showVimeoBrowser && (
        <VimeoBrowserModal
          isLight={isLight}
          onSelect={(url) => {
            changeMedia(url);
            setInputUrl(url);
          }}
          onClose={() => setShowVimeoBrowser(false)}
        />
      )}

      {/* Media Selector Modal */}
      {showMediaSelector && (
        <MediaSelectorModal
          isLight={isLight}
          onClose={() => setShowMediaSelector(false)}
          onSelectPlatform={(id) => {
            setShowMediaSelector(false);
            if (id === 'youtube') setShowYtBrowser(true);
            if (id === 'twitch') setShowTwitchBrowser(true);
            if (id === 'vimeo') setShowVimeoBrowser(true);
          }}
          onSelectUrl={(url) => {
            setShowMediaSelector(false);
            changeMedia(url);
          }}
          onUpload={(file) => {
            setShowMediaSelector(false);
            handleFileUpload(file);
          }}
          onScreenshare={() => {
            setShowMediaSelector(false);
            if (!isScreensharing) startScreenshare();
          }}
          onSelectPlaceholder={(app) => {
            setShowMediaSelector(false);
            setShowGuidedShare(app);
          }}
        />
      )}

      {/* Guided Share Modal */}
      {showGuidedShare && (
        <GuidedShareModal
          app={showGuidedShare}
          isLight={isLight}
          onClose={() => setShowGuidedShare(null)}
          onScreenshare={(quality, popup, appData) => {
            if (!isScreensharing) startScreenshare(quality || true, popup, appData);
          }}
        />
      )}




      {/* Global Chat Widget — MUST live inside playerWrapRef so it is visible in fullscreen.
          In fullscreen, only the content inside the fullscreen element is rendered by the browser.
          position:fixed here targets the viewport (= the fullscreen element when active).
          transparentMode switches styling: opaque panel in normal mode, glass overlay in fullscreen. */}

      <RoomSettingsModal
        isOpen={roomSettingsModalOpen}
        onClose={() => setRoomSettingsModalOpen(false)}
        room={room}
        socket={socket}
        isHost={isEffectiveHost}
        roomId={roomId}
      />

      {/* close panel on outside click */}


      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main Content Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: isTvMode ? 0 : 12, gap: isTvMode ? 0 : 12 }} className="no-scrollbar">
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: isTvMode ? 0 : 12, overflowY: 'hidden', maxHeight: '100%' }} className="no-scrollbar">
          <div
            ref={playerWrapRef}
            onMouseMove={resetControlsTimer}
            onMouseEnter={resetControlsTimer}
            onMouseLeave={() => setShowControls(false)}
            style={{ 
              flex: 1, 
              background: (isLight && !isFullscreen && !isTvMode) ? '#fff' : '#000', 
              borderRadius: (isFullscreen || isTvMode) ? 0 : 16, 
              border: (isLight && !isFullscreen && !isTvMode) ? '1px solid #e2e8f0' : ((isFullscreen || isTvMode) ? 'none' : '1px solid rgba(255,255,255,0.07)'), 
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
              boxShadow: (isLight && !isFullscreen && !isTvMode) ? '0 8px 30px rgba(0,0,0,0.04)' : 'none'
            }}
          >
            {/* ── Management Controls Overlay (Visible for ALL media types) ── */}
            {!isTvMode && (
            <div style={{
              position: 'absolute', bottom: 20, right: 20, zIndex: 500,
              display: 'flex', alignItems: 'center', gap: 12,
              pointerEvents: 'none',
              opacity: isFullscreen ? (showControls ? 1 : 0) : (showControls || uiVisible) ? 1 : 0,
              visibility: isFullscreen ? (showControls ? 'visible' : 'hidden') : (showControls || uiVisible) ? 'visible' : 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {/* Right: Management Actions (Chat, Fullscreen) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
                {/* Chat Toggle (Fullscreen Only or Always) */}
                {isFullscreen && (
                  <div ref={fsGlobalChatBtnRef} style={{ position: 'relative' }}>
                    <button
                      className="player-ctrl-btn stay-white"
                      onClick={() => setShowRecentChats(v => !v)}
                      title="Open Chats"
                      style={{
                        width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: showRecentChats ? 'rgba(99,102,241,0.85)' : 'rgba(15,15,20,0.8)',
                        borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(12px)', transition: 'all 0.2s', cursor: 'pointer'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = showRecentChats ? 'rgba(99,102,241,0.95)' : 'rgba(25,25,35,0.9)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = showRecentChats ? 'rgba(99,102,241,0.85)' : 'rgba(15,15,20,0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <MessageSquare size={18} color="#fff" />
                    </button>
                    {totalUnread > 0 && (
                      <span className="unread-badge stay-white" style={{
                        position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,0,0,0.5)', boxShadow: '0 2px 6px rgba(239,68,68,0.6)', pointerEvents: 'none'
                      }}>{Math.min(totalUnread, 99)}</span>
                    )}
                  </div>
                )}

                {/* Fullscreen Toggle / Exit */}
                <button 
                  className="player-ctrl-btn stay-white" 
                  onClick={handleFullscreen} 
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  style={{ 
                    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(15,15,20,0.8)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', 
                    backdropFilter: 'blur(12px)', transition: 'all 0.2s', cursor: 'pointer'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(25,25,35,0.9)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,15,20,0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {isFullscreen ? <X size={20} color="#fff" /> : <Maximize size={20} color="#fff" />}
                </button>
              </div>
            </div>
            )}

            {!isTvMode && room?.settings?.playerCustomName && (isScreensharing || isViewer) && !isFullscreen && (
              <div style={{ 
                position: 'absolute', top: 12, left: 12, zIndex: 10, 
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', 
                padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, 
                color: '#fff', border: '1px solid rgba(255,255,255,0.1)', 
                pointerEvents: 'none',
                opacity: (showPlayerBranding && showControls) ? 1 : 0,
                display: (showPlayerBranding && showControls) ? 'block' : 'none',
                visibility: (showPlayerBranding && showControls) ? 'visible' : 'hidden',
                transform: `translateY(${showPlayerBranding ? 0 : -10}px)`,
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
              }}>
                {room.settings.playerCustomName}
              </div>
            )}
            {(isScreensharing || isViewer) ? (
              <>
                <video
                  ref={videoRef} autoPlay playsInline controls={false} muted={isScreensharing ? true : playerMuted}
                  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                  onDoubleClick={handleFullscreen}
                  style={{ 
                    width: '100%', 
                    height: (isScreensharing && isFullscreen) ? 'calc(100% - 60px)' : '100%',
                    marginTop: (isScreensharing && isFullscreen) ? 60 : 0,
                    objectFit: 'contain', zIndex: 0
                  }}
                />
                {isViewer && !isPlaying && (
                  <div onClick={togglePlayPause} style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <Play size={40} fill="#fff" style={{ marginLeft: 6 }} />
                    </div>
                  </div>
                )}
                {/* Standalone Controls Overlay for WebRTC */}
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  pointerEvents: 'none',
                  opacity: showControls ? 1 : 0, transition: 'opacity 0.2s',
                  display: showControls ? 'block' : 'none'
                }}>
                  {/* Navigation & Header - Hidden in Screenshare Fullscreen as per request */}
                  {activeExternalApp && ['youtube', 'twitch', 'vimeo'].includes(activeExternalApp.id) && !isFullscreen && (
                    <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'auto' }}>
                      <button
                        onClick={() => handleNavigateHome(activeExternalApp.id === 'youtube' ? 'selector' : activeExternalApp.id)}
                        title="Return to App Directory"
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(15,15,20,0.8)', color: activeExternalApp.color || '#fff',
                          border: `1px solid ${activeExternalApp.color || 'rgba(255,255,255,0.1)'}`,
                          cursor: 'pointer', backdropFilter: 'blur(4px)',
                          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${activeExternalApp.color || 'transparent'}20`,
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'rgba(25,25,35,0.9)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(15,15,20,0.8)'; }}
                      >
                        {(() => {
                          const IconComp = getAppIcon(activeExternalApp.id);
                          return <IconComp size={20} />;
                        })()}
                      </button>
                    </div>
                  )}

                  <div style={{ 
                    position: 'absolute', bottom: 20, right: 20, 
                    display: 'flex', alignItems: 'center', gap: 16, 
                    pointerEvents: (isFullscreen && !showControls) ? 'none' : 'auto',
                    opacity: (isFullscreen && !showControls) ? 0 : 1,
                    transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>
                    {/* Redundant Fullscreen/Chat buttons removed - relying on Global Overlay at same position */}
                  </div>

                  {/* ── Minimal Single Stop Button (Bottom-Left, auto-hides on idle) ── */}
                  {(isScreensharing || isViewer) && (
                    <div style={{
                      position: 'absolute',
                      bottom: 24,
                      left: 20,
                      zIndex: 100,
                      pointerEvents: showControls ? 'auto' : 'none',
                      opacity: showControls ? 1 : 0,
                      transform: showControls ? 'translateY(0)' : 'translateY(12px)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                      <button
                        title="Stop & exit stream"
                        onClick={stopScreenshare}
                        style={{
                          width: 42, height: 42,
                          background: 'rgba(15, 15, 20, 0.8)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 12,
                          color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15, 15, 20, 0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        <div style={{ width: 14, height: 14, background: '#ef4444', borderRadius: 2 }} />
                      </button>
                    </div>
                  )}
                </div>
                {/* Removed local play/pause overlay and LIVE badge for cleaner screenshare */}
              </>
            ) : hasMounted && mediaUrl ? (
              <>
                {isWebIframe(mediaUrl) ? (
                  <div 
                    style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 16, overflow: 'hidden' }}
                    onMouseMove={resetControlsTimer}
                    onMouseEnter={resetControlsTimer}
                  >
                    <iframe src={mediaUrl} style={{ width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen" />
                    
                    {/* Game Controls Overlay */}
                    <div style={{
                      position: 'absolute', top: 20, right: 20, zIndex: 10,
                      opacity: showControls ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      pointerEvents: showControls ? 'auto' : 'none',
                      display: 'flex', gap: 12
                    }}>
                      <button 
                        onClick={handleFullscreen}
                        title={isFullscreen ? "Minimize" : "Full Screen"}
                        className="stay-white"
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(15,15,20,0.85)', color: '#fff',
                          border: '1px solid rgba(255,255,255,0.15)', 
                          cursor: 'pointer', backdropFilter: 'blur(12px)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'rgba(25,25,35,0.95)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(15,15,20,0.85)'; }}
                      >
                        {isFullscreen ? <X size={22} /> : <Maximize size={22} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Click-to-toggle only for non-embed (direct video) */}
                    {!isEmbedPlatform(mediaUrl) && (
                      <div onClick={togglePlayPause} style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'pointer' }} />
                    )}
                    <div 
                      style={{ 
                        position: 'absolute', inset: 0, 
                        overflow: 'hidden', 
                        borderRadius: 12,
                        willChange: 'transform',
                        background: '#000'
                      }}
                      onMouseMove={resetInactivityTimer}
                      onMouseEnter={() => setUiVisible(true)}
                    >
                      <div style={{
                        position: 'absolute',
                        inset: (useCustomTwitchControls && mediaUrl.includes('twitch.tv')) || (useCustomVimeoControls && mediaUrl.includes('vimeo.com')) ? '0 0 -40px 0' : 0,
                        zIndex: 0
                      }}>
                        <ReactPlayer
                          ref={playerRef}
                          url={mediaUrl}
                          width="100%" height="100%"
                          controls={(mediaUrl.includes('twitch.tv') && !useCustomTwitchControls) || (mediaUrl.includes('vimeo.com') && !useCustomVimeoControls) || (!mediaUrl.includes('twitch.tv') && !mediaUrl.includes('vimeo.com') && isEmbedPlatform(mediaUrl))}
                          playing={isPreparing || (isPlaying && !isPreparing)}
                          volume={isPreparing ? 0 : playerVolume}
                          muted={isPreparing || playerMuted}
                          onPlay={handlePlay}
                          onPause={handlePause}
                          onBuffer={() => !isPreparing && console.log('Buffering...')}
                          onSeek={handleSeek}
                          onProgress={({ playedSeconds }) => {
                            // Throttle state update to once per second to reduce re-renders
                            if (Math.floor(playedSeconds) !== Math.floor(currentTime)) {
                              setCurrentTime(playedSeconds);
                            }
                          }}
                          progressInterval={1000}
                          onDuration={setDuration}
                          onError={(e) => {
                            console.error('[ReactPlayer] Error:', e);
                            toast.error('Video unavailable or error loading media.');
                            handleStopMedia();
                          }}
                          config={{
                            file: {
                              attributes: {
                                preload: 'auto',
                                controlsList: 'nodownload',
                                crossOrigin: "anonymous"
                              },
                              forceVideo: true,
                              hlsOptions: {
                                maxBufferLength: 60,
                                maxMaxBufferLength: 120,
                                startLevel: -1,
                                enableWorker: true
                              }
                            },
                            youtube: {
                              playerVars: {
                                modestbranding: 1,
                                rel: 0,
                                playsinline: 1,
                                origin: window.location.origin
                              }
                            },
                            twitch: {
                              options: {
                                parent: [window.location.hostname]
                              }
                            }
                          }}
                        />
                      </div>

                      {/* --- Smooth Streaming Preparation Overlay (Root of video container for full coverage) --- */}
                      {isPreparing && (
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 1200,
                          background: 'radial-gradient(circle at center, rgba(15, 10, 35, 0.98), rgba(5, 5, 15, 1))',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(12px)', transition: 'all 0.5s ease',
                          borderRadius: 12
                        }}>
                          {/* Beautiful Geometric Animation */}
                          <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 40 }}>
                            <div style={{
                              width: '100%', height: '100%',
                              background: 'linear-gradient(45deg, #a855f7, #6366f1)',
                              maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'1\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z\'/%3E%3C/svg%3E")',
                              maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
                              animation: 'prepPulse 2s infinite ease-in-out'
                            }} />
                            <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: '1px solid rgba(168, 85, 247, 0.3)', animation: 'spin 4s linear infinite' }} />
                            <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', border: '1px solid rgba(99, 102, 241, 0.2)', animation: 'spin-reverse 6s linear infinite' }} />
                          </div>

                          <div style={{ textAlign: 'center', maxWidth: 400 }}>
                            <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>Smoothing Experience...</h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>Optimizing high-bitrate clusters for buffer-free playback</p>

                            <div style={{ width: 300, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', position: 'relative', margin: '0 auto 16px' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prepProgress}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)', boxShadow: '0 0 12px rgba(168, 85, 247, 0.6)', transition: 'width 1s linear' }} />
                            </div>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
                              {bufferedSeconds > 0 ? (
                                <>
                                  <span style={{ color: '#a855f7', fontWeight: 800 }}>{bufferedSeconds}s / 25s</span>
                                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>buffered in 'Fueling' stage</span>
                                </>
                              ) : (
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>OPTIMIZING CONNECTION...</span>
                              )}
                            </div>
                            <button
                              onClick={handleStopMedia}
                              className="stay-white"
                              style={{
                                display: 'block', margin: '16px auto 0', padding: '10px 24px', borderRadius: 20,
                                background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.5)', cursor: 'pointer',
                                fontWeight: 600, transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                              Cancel & Return
                            </button>
                          </div>
                          
                          <style>{`
                            @keyframes prepPulse {
                              0%, 100% { transform: scale(1); opacity: 0.8; filter: drop-shadow(0 0 0px #a855f7); }
                              50% { transform: scale(1.05); opacity: 4; filter: drop-shadow(0 0 20px #a855f7); }
                            }
                            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                            @keyframes spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                          `}</style>
                        </div>
                      )}
                      
                      {/* --- Platform UI Layer (Twitch/Vimeo) --- */}
                      {(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com')) && (
                        <>
                          {/* Top Navigation & Settings */}
                          <div style={{
                            position: 'absolute', top: 16, left: 16, right: 16, zIndex: 1000,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                            pointerEvents: 'none',
                            opacity: uiVisible ? 1 : 0,
                            visibility: uiVisible ? 'visible' : 'hidden',
                            transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.2s'
                          }}>
                            {/* Smart Multi-Platform Home Navigation */}
                            {(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com')) && (
                              <button
                                onClick={() => handleNavigateHome(mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? 'youtube' : (mediaUrl.includes('twitch.tv') ? 'twitch' : 'vimeo'))}
                                title={`${mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? 'YouTube' : (mediaUrl.includes('twitch.tv') ? 'Twitch' : 'Vimeo')} Home`}
                                style={{
                                  pointerEvents: 'auto',
                                  width: 44, height: 44, borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))
                                    ? 'linear-gradient(135deg, #ef4444 0%, #cc0000 100%)'
                                    : (mediaUrl.includes('twitch.tv') 
                                      ? 'linear-gradient(135deg, #9146ff 0%, #6441a5 100%)' 
                                      : 'linear-gradient(135deg, #00adef 0%, #007bb5 100%)'),
                                  color: '#fff', border: '1px solid rgba(255,255,255,0.2)', 
                                  cursor: 'pointer',
                                  boxShadow: (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))
                                    ? '0 8px 24px rgba(204, 0, 0, 0.4)'
                                    : (mediaUrl.includes('twitch.tv') 
                                      ? '0 8px 24px rgba(100, 65, 165, 0.4)' 
                                      : '0 8px 24px rgba(0, 173, 239, 0.4)'),
                                  backdropFilter: uiVisible ? 'blur(8px)' : 'none', 
                                  transition: 'all 0.3s'
                                }}
                                onMouseEnter={e => { 
                                  e.currentTarget.style.transform = 'scale(1.1)'; 
                                  e.currentTarget.style.boxShadow = mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')
                                    ? '0 12px 30px rgba(204,0,0,0.6)'
                                    : (mediaUrl.includes('twitch.tv') 
                                      ? '0 12px 30px rgba(100,65,165,0.6)' 
                                      : '0 12px 30px rgba(0,173,239,0.6)'); 
                                }}
                                onMouseLeave={e => { 
                                  e.currentTarget.style.transform = 'scale(1)'; 
                                  e.currentTarget.style.boxShadow = mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')
                                    ? '0 8px 24px rgba(204,0,0,0.4)'
                                    : (mediaUrl.includes('twitch.tv') 
                                      ? '0 8px 24px rgba(110,65,165,0.4)' 
                                      : '0 8px 24px rgba(0,173,239,0.4)'); 
                                }}
                              >
                                {mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') ? <FaYoutube size={18} /> : (mediaUrl.includes('twitch.tv') ? <FaTwitch size={18} /> : <FaVimeo size={18} />)}
                              </button>
                            )}

                            {/* Control Mode Toggle (Not for YouTube) */}
                            {(mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com')) && (
                              <button
                                onClick={() => {
                                  if (mediaUrl.includes('twitch.tv')) setUseCustomTwitchControls(!useCustomTwitchControls);
                                  else setUseCustomVimeoControls(!useCustomVimeoControls);
                                }}
                                className="stay-white"
                                style={{
                                  pointerEvents: 'auto',
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  background: 'rgba(15,15,15,0.7)', color: '#fff',
                                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                                  padding: '10px 14px', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', backdropFilter: 'blur(12px)',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,30,30,0.9)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,15,15,0.7)'}
                              >
                                <Settings2 size={16} color={
                                  (mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || 
                                  (mediaUrl.includes('vimeo.com') && useCustomVimeoControls) 
                                  ? (mediaUrl.includes('twitch.tv') ? '#9146ff' : '#00adef') 
                                  : '#666'
                                } />
                                { (mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || 
                                  (mediaUrl.includes('vimeo.com') && useCustomVimeoControls) 
                                  ? 'Custom Controls' : 'Native Mode' }
                              </button>
                            )}
                          </div>

                          {/* Custom Bottom Control Bar */}
                          { ((mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || 
                             (mediaUrl.includes('vimeo.com') && useCustomVimeoControls)) && (
                            <div style={{
                              position: 'absolute', bottom: 0, left: 0, right: 0,
                              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
                              padding: '40px 24px 20px', zIndex: 10,
                              display: 'flex', alignItems: 'center', gap: 20,
                              opacity: uiVisible ? 1 : 0,
                              transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <button 
                                  onClick={togglePlayPause}
                                  className="stay-white"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
                                  title={isPlaying ? 'Pause' : 'Play'}
                                >
                                  {isPlaying ? <Pause fill="#fff" size={24} /> : <Play fill="#fff" size={24} />}
                                </button>
                                <button 
                                  onClick={handleStopMedia}
                                  className="stay-white"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}
                                  title="Stop"
                                >
                                  <Square fill="#fff" size={20} />
                                </button>
                              </div>
                              
                              <div style={{ flex: 1 }} />

                              {/* Volume */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button 
                                  onClick={() => setPlayerMuted(!playerMuted)}
                                  className="stay-white"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                  {playerMuted || playerVolume === 0 ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
                                </button>
                                <input 
                                  type="range" min="0" max="1" step="0.01"
                                  value={playerVolume}
                                  onChange={e => setPlayerVolume(parseFloat(e.target.value))}
                                  style={{ width: 80, accentColor: mediaUrl.includes('twitch.tv') ? '#9146ff' : '#00adef' }}
                                />
                              </div>

                              <button 
                                onClick={handleFullscreen}
                                className="stay-white"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <Maximize size={20} color="#fff" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                <div style={{ 
                  width: 86, height: 86, borderRadius: 28, 
                  background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 24,
                  boxShadow: isLight ? '0 12px 36px rgba(99,102,241,0.12)' : '0 10px 40px rgba(0,0,0,0.4)',
                  border: isLight ? '1px solid rgba(99,102,241,0.1)' : '1px solid rgba(255,255,255,0.08)'
                }}>
                  <MonitorPlay size={44} color={isLight ? '#6366f1' : '#fff'} strokeWidth={2} />
                </div>
                <h3 style={{ margin: '0 0 16px', color: isLight ? '#0f172a' : '#fff', fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px' }}>{t('noMediaSelected', 'No Media Selected')}</h3>
                {!isTvMode && (
                <button 
                  onClick={() => setShowMediaSelector(true)} 
                  style={{ 
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
                    border: 'none', 
                    borderRadius: 14, 
                    padding: '14px 28px', 
                    color: '#ffffff', 
                    fontSize: 15, 
                    fontWeight: 700, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    boxShadow: isLight ? '0 10px 25px rgba(99,102,241,0.3)' : '0 10px 25px rgba(0,0,0,0.5)', 
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                  }} 
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)'; e.currentTarget.style.boxShadow = isLight ? '0 15px 30px rgba(99,102,241,0.4)' : '0 15px 30px rgba(0,0,0,0.6)'; }} 
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = isLight ? '0 10px 25px rgba(99,102,241,0.3)' : '0 10px 25px rgba(0,0,0,0.5)'; }}
                >
                  <LayoutGrid size={20} color="#ffffff" /> 
                  <span className="forced-white">{t('browseMediaAndApps', 'Browse Media & Apps')}</span>
                </button>
                )}
              </div>
            )}

            {/* Custom Control Bar Ã¢â‚¬â€ visible ONLY for Direct Videos (Hidden for WebRTC to avoid overlapping native streaming controls) */}
            {!isTvMode && (hasMounted && mediaUrl && !isWebIframe(mediaUrl)) && !(isScreensharing || isViewer) && !((mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || (mediaUrl.includes('vimeo.com') && useCustomVimeoControls)) && (
              <div style={{
                position: 'absolute', bottom: isEmbedPlatform(mediaUrl) ? 46 : 0, left: 0, right: 0, zIndex: 2,
                background: isEmbedPlatform(mediaUrl) ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                padding: '24px 14px 10px',
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
                borderRadius: isEmbedPlatform(mediaUrl) ? '0' : '0 0 16px 16px'
              }}>
                {/* Scrubber (Hidden during WebRTC since it's a live stream) */}
                {!(isScreensharing || isViewer) && (
                  <div style={{ position: 'relative', height: 4, marginBottom: 10, display: 'flex', alignItems: 'center', pointerEvents: showControls ? 'auto' : 'none' }}>
                    <div style={{
                      position: 'absolute', left: 0, height: 4, borderRadius: 2,
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                      background: 'linear-gradient(90deg,#6366f1,#a855f7)',
                      pointerEvents: 'none', zIndex: 1
                    }} />
                    <div style={{
                      position: 'absolute', left: 0, right: 0, height: 4,
                      borderRadius: 2, background: 'rgba(255,255,255,0.15)', zIndex: 0
                    }} />
                    <input
                      type="range" className="player-scrubber"
                      min={0} max={duration || 100} step={0.1}
                      value={currentTime}
                      onChange={handleScrubberChange}
                      style={{
                        position: 'absolute', inset: 0, zIndex: 2, width: '100%',
                        '--track-fill': `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
                      }}
                    />
                  </div>
                )}
                {/* Controls row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: showControls ? 'auto' : 'none' }}>
                  {/* Play/Pause (Hidden during WebRTC to avoid local freezing confusion) */}
                  {!(isScreensharing || isViewer) && (
                    <>
                      <button className="player-ctrl-btn" onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" />}
                      </button>
                      <button className="player-ctrl-btn" onClick={handleStopMedia} title="Stop">
                        <Square size={16} fill="#fff" />
                      </button>
                    </>
                  )}
                  {/* Volume */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button className="player-ctrl-btn" onClick={toggleMutePlayer} title={playerMuted ? 'Unmute' : 'Mute'}>
                      {playerMuted || playerVolume === 0 ? <VolumeX size={16} /> : playerVolume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range" className="player-vol-slider"
                      min={0} max={1} step={0.02}
                      value={playerMuted ? 0 : playerVolume}
                      onChange={handleVolumeChange}
                      style={{
                        background: `linear-gradient(to right, #a5b4fc ${(playerMuted ? 0 : playerVolume) * 100}%, rgba(255,255,255,0.2) ${(playerMuted ? 0 : playerVolume) * 100}%)`
                      }}
                    />
                  </div>
                  {/* Time (Hidden during WebRTC) */}
                  {!(isScreensharing || isViewer) && (
                    <span style={{ fontSize: 11, color: '#ccc', whiteSpace: 'nowrap', marginLeft: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {/* Fullscreen */}
                  <button className="player-ctrl-btn" onClick={handleFullscreen} title="Fullscreen">
                    <Maximize size={15} />
                  </button>
                </div>
              </div>
            )}
            
            {/* Camera Streams Overlay */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
              transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s'
            }}>
              {renderCameras(true)}
            </div>

            {/* Drag-to-Remove Zone */}
            {isDraggingCam && (
              <div 
                id="cam-remove-zone"
                style={{
                  position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
                zIndex: 1000, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                opacity: 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                animation: 'slideInUp 0.3s ease'
              }}>
                <div className="stay-white" style={{
                  width: isOverRemoveZone ? 72 : 64, height: isOverRemoveZone ? 72 : 64,
                  borderRadius: '50%', background: isOverRemoveZone ? '#ef4444' : 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(12px)', border: `2px solid ${isOverRemoveZone ? '#ff6b6b' : 'rgba(255,255,255,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', boxShadow: isOverRemoveZone ? '0 0 30px rgba(239,68,68,0.5)' : '0 10px 30px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s'
                }}>
                  <X size={isOverRemoveZone ? 32 : 24} strokeWidth={2.5} color="#fff" />
                </div>
                <span style={{ 
                  color: isOverRemoveZone ? '#ef4444' : '#fff', fontSize: 11, fontWeight: 800, 
                  textTransform: 'uppercase', letterSpacing: '0.05em', 
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                  {isOverRemoveZone ? 'Drop to Remove' : 'Drag here to hide'}
                </span>
              </div>
            )}

            {/* Unhide Videos Bubble */}
            {hiddenCams.size > 0 && !isTvMode && (
              <button
                onClick={() => {
                  setHiddenCams(new Set());
                  toast.success('All videos restored', { icon: '👁️' });
                }}
                style={{
                  position: 'absolute', top: 20, right: 20,
                  zIndex: 1100, padding: '8px 16px', borderRadius: 12,
                  background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 15, 15, 0.85)',
                  color: isLight ? '#000' : '#fff',
                  border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  boxShadow: 'none', fontWeight: 600, fontSize: 12,
                  opacity: showControls ? 1 : 0,
                  visibility: showControls ? 'visible' : 'hidden',
                  pointerEvents: showControls ? 'auto' : 'none',
                  animation: 'slideInRight 0.3s ease',
                  transition: 'all 0.2s ease, opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isLight ? '#f8fafc' : '#222';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 15, 15, 0.85)';
                }}
              >
                <Video size={14} />
                <span>Unhide Videos</span>
                <div style={{
                  background: 'transparent', 
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}`,
                  color: 'inherit',
                  borderRadius: 6,
                  padding: '1px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  minWidth: 18
                }}>
                  {hiddenCams.size}
                </div>
              </button>
            )}

            {/* Global Chat Widget — rendered inside the fullscreen element so it
                remains visible when playerWrapRef.requestFullscreen() is active.
                position:fixed (no transform parent) targets the true viewport = the
                fullscreen screen, giving us correct overlay positioning in both modes. */}
            {!isTvMode && (
            <GlobalChatWidget
              ref={chatWidgetRef}
              isOpen={showRecentChats}
              onClose={() => setShowRecentChats(false)}
              unreadCounts={unreadCounts}
              onMarkRead={handleMarkRead}
              onNewMessage={handleNewMessage}
              transparentMode={isFullscreen}
            />
            )}


          </div>
          
        </div>
        
        {/* — Right Column — */}
        {!isTvMode && (
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, height: '100%' }}>
          
          {/* — Controls Box — */}
          {!isFullscreen && !isTvMode && (
            <div style={{ 
              background: isLight ? '#fff' : 'var(--room-sidebar-bg)', 
              borderRadius: 16, 
              border: '1px solid var(--room-border)', 
              padding: '20px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 12,
              boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isLight ? '#1e293b' : '#fff', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{t('quickControls', 'Quick Controls')}</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* --- Primary Action: Screen Cast (Teams Style) --- */}
                <button
                  onClick={() => {
                    if (mediaUrl || isScreensharing) {
                      handleCast();
                    } else {
                      openDiscoveryMenu('selector');
                    }
                  }}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 16,
                    background: (mediaUrl || isScreensharing) ? 'rgba(99, 102, 241, 0.1)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                    border: (mediaUrl || isScreensharing) ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(255,255,255,0.1)',
                    color: (mediaUrl || isScreensharing) ? '#6366f1' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: 'none',
                    fontWeight: 800, fontSize: 14
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'none'; }}
                >
                  <Cast size={20} className={(mediaUrl || isScreensharing) ? '' : 'stay-white'} />
                  <span className={(mediaUrl || isScreensharing) ? '' : 'stay-white'}>
                    {(mediaUrl || isScreensharing) ? t('castToTv', 'Cast to TV') : t('castScreen', 'Cast Screen')}
                  </span>
                </button>

                {/* --- Secondary Actions: Cam & Mic Side-by-Side --- */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {(() => {
                    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
                    const camPerm = room?.permissions?.cam || 'all';
                    const canUseCam = !isGuest && (camPerm === 'all' || (camPerm === 'host' && isEffectiveHost));
                    const camReason = isGuest ? 'Guests cannot use webcam' : (camPerm === 'none' ? 'Webcam is disabled' : (camPerm === 'host' && !isEffectiveHost ? 'Only the host or admins can use webcam' : ''));

                    return (
                      <button
                        onClick={canUseCam ? toggleCamera : () => toast.error(camReason)}
                        title={canUseCam ? (isCamOn ? 'Turn off camera' : 'Turn on camera') : camReason}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 12,
                          border: `1px solid ${canUseCam ? (isCamOn ? '#6366f1' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')) : 'rgba(239,68,68,0.2)'}`,
                          background: canUseCam ? (isCamOn ? 'rgba(99,102,241,0.08)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)')) : 'rgba(239,68,68,0.05)',
                          color: canUseCam ? (isCamOn ? '#6366f1' : (isLight ? '#475569' : '#888')) : '#ef4444',
                          cursor: canUseCam ? 'pointer' : 'not-allowed',
                          fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { if(canUseCam) { e.currentTarget.style.background = isCamOn ? 'rgba(99,102,241,0.12)' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.06)'); } }}
                        onMouseLeave={e => { if(canUseCam) { e.currentTarget.style.background = isCamOn ? 'rgba(99,102,241,0.08)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)'); } }}
                      >
                        {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
                        <span>{t('cameraControl', 'Camera')}</span>
                      </button>
                    );
                  })()}

                  {(() => {
                    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
                    const micPerm = room?.permissions?.mic || 'all';
                    const canUseMic = !isGuest && (micPerm === 'all' || (micPerm === 'host' && isEffectiveHost));
                    const micReason = isGuest ? 'Guests cannot use microphone' : (micPerm === 'none' ? 'Microphone is disabled' : (micPerm === 'host' && !isEffectiveHost ? 'Only the host or admins can use microphone' : ''));

                    return (
                      <button
                        onClick={canUseMic ? toggleMic : () => toast.error(micReason)}
                        title={canUseMic ? (isMicOnCam ? 'Mute mic' : 'Unmute mic') : micReason}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 12,
                          border: `1px solid ${canUseMic ? (isMicOnCam ? '#10b981' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')) : 'rgba(239,68,68,0.2)'}`,
                          background: canUseMic ? (isMicOnCam ? 'rgba(16,185,129,0.08)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)')) : 'rgba(239,68,68,0.05)',
                          color: canUseMic ? (isMicOnCam ? '#10b981' : (isLight ? '#475569' : '#888')) : '#ef4444',
                          cursor: canUseMic ? 'pointer' : 'not-allowed',
                          fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { if(canUseMic) { e.currentTarget.style.background = isMicOnCam ? 'rgba(16,185,129,0.12)' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.06)'); } }}
                        onMouseLeave={e => { if(canUseMic) { e.currentTarget.style.background = isMicOnCam ? 'rgba(16,185,129,0.08)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)'); } }}
                      >
                        {isMicOnCam ? <Mic size={18} /> : <MicOff size={18} />}
                        <span>{t('micControl', 'Mic')}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* — Chat Panel — */}
          {!isTvMode && (
            <RoomChatPanel p={{
              chatTab, setChatTab, chatTabRef,
              groupMessages, groupUnread, setGroupUnread,
              userList, room, isHost, isAdmin, // added roles for avatar visualization
              dmThreads, dmTarget, setDmTarget, dmTargetRef, dmUnread, setDmUnread,
              dmDecryptedMediaUrls, dmMediaUrlVersion,
              groupDecryptedMediaUrls, groupMediaUrlVersion,
              typingUsers, messagesEndRef,
              groupChatInput, setGroupChatInput, groupInputRef,
              dmChatInput, setDmChatInput, dmInputRef,
              groupReplyTo, setGroupReplyTo,
              dmReplyTo, setDmReplyTo,
              activeReactionMsg, setActiveReactionMsg,
              showAllEmojis, setShowAllEmojis,
              showGroupEmojiPicker, setShowGroupEmojiPicker,
              showDmEmojiPicker, setShowDmEmojiPicker,
              showGroupMenu, setShowGroupMenu, groupMenuRef,
              showDmMenu, setShowDmMenu, dmMenuRef,
              isMuted, isHost: isEffectiveHost,
              allowLinks: room?.permissions?.allowLinks !== false,
              allowMedia: room?.permissions?.allowMedia !== false,
              chatPerm: room?.permissions?.chat || 'all',
              roomName, userCount, userList,
              username, mySocketId, mySocketIdRef,
              knownUsers, knownAvatars,
              keyPair, dbPublicKeys,
              sendGroupChat, sendDmChat,
              sendMediaGroupChat, sendMediaDmChat,
              handleGroupReact, handleDmReact,
              handleDeleteMessage,
              handleChatInputChange,
              openDM, reportMsg,
              setRenameInput, setRenameModalOpen,
              setClearChatTarget, setClearChatModalOpen,
              SOCKET_SERVER_URL, roomId,
              onMarkRead: handleMarkRead,
              clearRoomChat: () => { if (socket) socket.emit('clear_room_chat', { roomId }); },
              setDmThreads,
              socket
            }} />
          )}
        </div>
        )}
      </div>
      <RoomModals
        renameModalOpen={renameModalOpen}
        setRenameModalOpen={setRenameModalOpen}
        renameInput={renameInput}
        setRenameInput={setRenameInput}
        socket={socket}
        roomId={roomId}
        clearChatModalOpen={clearChatModalOpen}
        setClearChatModalOpen={setClearChatModalOpen}
        clearChatTarget={clearChatTarget}
        clearForBoth={clearForBoth}
        setClearForBoth={setClearForBoth}
        isLight={isLight}
        showCastDiscovery={showCastDiscovery}
        setShowCastDiscovery={setShowCastDiscovery}
        userList={userList}
        username={username}
        handleFullscreen={handleFullscreen}
        playerRef={playerRef}
        videoRef={videoRef}
        isScreensharing={isScreensharing}
        mediaUrl={mediaUrl}
      />



      {banConfirmTarget && (
        <BanConfirmModal
          isOpen={!!banConfirmTarget}
          username={banConfirmTarget.username}
          onClose={() => setBanConfirmTarget(null)}
          onConfirm={() => {
            socket.emit('mod_ban', { roomId, targetSocketId: banConfirmTarget.socketId });
          }}
        />
      )}

    </div>
  );
};

export default Room;











