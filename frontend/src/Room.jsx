import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Hyperbeam from '@hyperbeam/web';
import { clearUserSession } from './lib/authUtils.js';
import { SOCKET_URL as API_SOCKET_URL } from './lib/api';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import io from 'socket.io-client';
import GlobalChatWidget from './components/GlobalChatWidget';
import RoomChatPanel from './components/RoomChatPanel';
import RoomModals from './components/RoomModals';
import ReportMessageModal from './components/ReportMessageModal';
import RoomSettingsModal from './components/RoomSettingsModal';
import YouTubeBrowserModal from './components/YouTubeBrowserModal';
import TwitchBrowserModal from './components/TwitchBrowserModal';
import VimeoBrowserModal from './components/VimeoBrowserModal';
import MediaSelectorModal, { OPTIONS } from './components/MediaSelectorModal';
import GuidedShareModal from './components/GuidedShareModal';
import BanConfirmModal from './components/BanConfirmModal';
import StreamUploadProgress from './components/StreamUploadProgress';
import SubtitleSettingsModal from './components/SubtitleSettingsModal';
import { useVideoUpload } from './hooks/useVideoUpload';
import { useVoiceActivityDetection } from './hooks/useVoiceActivityDetection';
import { useBackIntercept } from './hooks/useBackIntercept';
import { getPersistedGcwOpen } from './utils/gcwPersist';
import { getPersistedReactionPreviews, setPersistedReactionPreview, clearPersistedReactionPreview } from './utils/reactionPreviewsPersist';
import ReactPlayerRaw from 'react-player/lazy';
const ReactPlayer = ReactPlayerRaw.default || ReactPlayerRaw;
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { useCrypto } from './contexts/CryptoContext';
import { encryptGroupMessage, decryptGroupMessage, decryptDM, encryptDM, decryptDMSenderCopy, encryptMedia, decryptMedia, robustDecode } from './lib/crypto.js';
import crownImg from './assets/crown.svg';
import { getFlagUrl, getFlagUrlFromName } from './utils/countryFlags.js';
import { LayoutGrid, Upload, Link as LinkIcon, MessageSquare, Monitor, MonitorPlay, Users, Send, VolumeX, Volume2, Ban, Flag, Play, Pause, Square, X, Share2, MessageCircle, MicOff, LogOut, Reply, Lock, Hash, ChevronLeft, ChevronRight, Settings, Settings2, Video, VideoOff, Mic, MoreVertical, Edit2, Trash2, Globe, Pin, Star, Shield, ShieldOff, SmilePlus, Plus, Maximize, Minimize, Maximize2, Minimize2, Gamepad2, Volume1, Activity, Search, Bell, HelpCircle, User, UserMinus, Cast, RotateCcw, RotateCw, Paintbrush, ChevronDown, ChevronUp, Eye, EyeOff, Sparkles } from 'lucide-react';import { mergeHistoryBatch } from './utils/chatHelper.js';

function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withProto);
    return withProto;
  } catch {
    return null;
  }
}

// Shared ICE server fetch for all camera and screen-share WebRTC peer connections.
// STUN alone only helps peers discover their public IP for a direct connection — it
// fails whenever either side is behind a NAT type that can't hole-punch (mobile
// carrier CGNAT, symmetric NAT, many corporate/hotel networks), which is the common
// case for two strangers on arbitrary real-world networks. TURN credentials are
// fetched from the backend (which holds the Metered.ca API key) once per call
// session — see getSharedIceServers() below, which caches the in-flight/resolved
// promise so repeat peer connections in the same room-join session reuse it
// instead of re-fetching on every camera toggle or additional peer. Falls back to
// STUN-only if the fetch fails, or host-only candidates on localhost.
async function fetchIceServers(socketServerUrl) {
  const isLocalhost = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname);
  if (isLocalhost) return []; // host candidates only — fastest for same-machine

  const stunFallback = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  try {
    const token = localStorage.getItem('watch_token');
    const res = await fetch(`${socketServerUrl}/api/turn-credentials`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error(`turn-credentials returned ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) return data.iceServers;
    throw new Error('empty iceServers response');
  } catch (err) {
    console.warn('[RTC] TURN credential fetch failed, falling back to STUN-only:', err.message);
    return stunFallback;
  }
}
import CustomizeRoomModal from './components/CustomizeRoomModal';
import TimerActivity from './components/TimerActivity';
import CallingActivity from './components/CallingActivity';
import { ROOM_THEMES } from './data/roomThemes';
import { getAvatarUrl, getRoomThumbnailUrl } from './utils/avatarUtils';
import { FaWhatsapp, FaTelegramPlane, FaYoutube, FaTwitch, FaVimeo, FaSoundcloud, FaInstagram, FaSnapchatGhost, FaDiscord, FaRedditAlien, FaFacebookF, FaLinkedinIn, FaPinterestP, FaApple, FaSpotify, FaTiktok } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { SiNetflix, SiCrunchyroll, SiHbomax, SiAppletv, SiGmail } from 'react-icons/si';
import toast, { Toaster } from 'react-hot-toast';

// Always connect to port 3001 via HTTP — works for both localhost and LAN IPs (e.g. 192.168.x.x)
// LAN mode is used when the TV/phone opens the app from the Cast URL on the same WiFi network
const SOCKET_SERVER_URL = API_SOCKET_URL;

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

const TwitchIframe = React.memo(({ channel, parent, reloadKey, isMobile, handleReloadTwitch, isUnmountingTwitch, onLoad }) => {
  const iframeSrc = React.useMemo(() => {
    return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false&muted=false`;
  }, [channel, parent]);

  useEffect(() => {
    console.log('[TWITCH IFRAME] mounted', { channel, reloadKey });
    return () => console.log('[TWITCH IFRAME] unmounted', { channel, reloadKey });
  }, [channel, reloadKey]);

  useEffect(() => {
    console.log('[TWITCH] iframe src =', iframeSrc);
  }, [iframeSrc]);

  console.log('[TWITCH IFRAME] render', { channel, reloadKey });

  if (isUnmountingTwitch) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#000', gap: 12
      }}>
        <div className="stay-white" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #9146ff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>Loading Twitch Stream...</span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      width: '100%',
      height: '100%',
      minHeight: isMobile ? '220px' : 'auto',
      display: 'flex', flexDirection: 'column',
      background: '#000',
      pointerEvents: 'auto',
      visibility: 'visible',
      opacity: 1,
      zIndex: 1,
    }}>
      <iframe
        key={`twitch-${channel}-${reloadKey}`}
        src={iframeSrc}
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        frameBorder="0"
        scrolling="no"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          display: 'block',
          border: 'none',
          background: '#000',
          pointerEvents: 'auto',
        }}
        title={`Twitch – ${channel}`}
        onLoad={onLoad}
      />
      
      {/* Bottom Control & Hint Banner */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '8px 16px',
        background: 'rgba(15,15,15,0.85)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        zIndex: 10,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
          <span style={{ color: '#9146ff', fontWeight: 800 }}>●</span>
          {isMobile ? 'Tap Play inside the Twitch player' : 'Click Play inside the Twitch player if stream doesn\'t start'}
        </div>
        <button
          onClick={handleReloadTwitch}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            pointerEvents: 'auto',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          <RotateCw size={11} />
          Reload Player
        </button>
      </div>
    </div>
  );
});

TwitchIframe.displayName = 'TwitchIframe';

const VimeoIframe = React.memo(({ videoId, isMobile, onLoad }) => {
  const iframeSrc = React.useMemo(() => {
    return `https://player.vimeo.com/video/${videoId}`;
  }, [videoId]);

  useEffect(() => {
    console.log('[VIMEO IFRAME] mounted', { videoId });
    return () => console.log('[VIMEO IFRAME] unmounted', { videoId });
  }, [videoId]);

  useEffect(() => {
    console.log('[VIMEO] iframe src =', iframeSrc);
  }, [iframeSrc]);

  console.log('[VIMEO IFRAME] render', { videoId });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      width: '100%',
      height: '100%',
      minHeight: isMobile ? '220px' : 'auto',
      display: 'flex', flexDirection: 'column',
      background: '#000',
      pointerEvents: 'auto',
      visibility: 'visible',
      opacity: 1,
      zIndex: 1,
    }}>
      <iframe
        key={`vimeo-${videoId}`}
        src={iframeSrc}
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        frameBorder="0"
        onLoad={onLoad}
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          border: 'none',
          background: '#000',
          pointerEvents: 'auto',
        }}
        title={`Vimeo – ${videoId}`}
      />
    </div>
  );
});

VimeoIframe.displayName = 'VimeoIframe';

const QUICK_EMOJIS = ['👍', '❤️', '😊', '😮', '😢'];
const ALL_EMOJIS = ['👍', '❤️', '😊', '😮', '😢', '😍', '🤣', '😂', '🤔', '😎', '😁', '😅', '✨', '🙏', '💚', '💛', '💝', '🤗', '😻', '🥰', '🎉', '😪', '😒', '✔️', '🤞', '😽', '😡', '🤢', '🤡', '🤫'];

// ─── Camera Layout Threshold ──────────────────────────────────────────────────
// Managed Panel Mode activates when active camera users > this value.
const CAMERA_MANAGED_LAYOUT_THRESHOLD = 8;

// -------------------------------- Helpers --------------------------------
function formatUsername(name) {
  if (!name) return '';
  if (name.toLowerCase().startsWith('guest_')) {
    return name.slice(6);
  }
  return name;
}
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
  const imgUrl = getAvatarUrl(src || avatarPath);

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
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <span className="stay-white" style={{ display: imgUrl ? 'none' : 'flex', color: '#fff' }}>{getInitials(name)}</span>
      </div>
      {isMuted && <div className="stay-white" style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #111' }}><MicOff size={8} color="#fff" /></div>}
    </div>
  );
}

// -------------------------------- Video Tile --------------------------------
function VideoTile({ stream, isMuted, style, isLocal, debugLabel }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      // TEMP DEBUG — cross-component local-tile investigation, remove after diagnosis.
      console.log('[CAM DEBUG] VideoTile srcObject assign', {
        isLocal, debugLabel,
        hasStream: !!stream,
        trackCount: stream.getTracks().length,
        videoTrackCount: stream.getVideoTracks().length,
        videoTrackState: stream.getVideoTracks()[0] ? {
          enabled: stream.getVideoTracks()[0].enabled,
          muted: stream.getVideoTracks()[0].muted,
          readyState: stream.getVideoTracks()[0].readyState,
        } : null,
        streamActive: stream.active,
      });
      const el = videoRef.current;
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.error('Video play error:', e);
        if (e.name === 'NotAllowedError') {
          setPlayBlocked(true);
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => console.error('Muted fallback failed:', err));
        }
      });
      setTimeout(() => {
        // TEMP DEBUG — cross-component local-tile investigation, remove after diagnosis.
        // Decisive test: sample actual decoded pixel data via canvas. If the average
        // brightness is near-zero, the camera itself is genuinely producing black
        // frames (hardware/driver/lighting). If it's NOT near-zero, the video has real
        // image data and something is visually hiding/covering the <video> element in
        // CSS despite it playing correctly — two very different fixes.
        let pixelSample = null;
        try {
          const c = document.createElement('canvas');
          c.width = el.videoWidth || 1;
          c.height = el.videoHeight || 1;
          const ctx = c.getContext('2d');
          ctx.drawImage(el, 0, 0, c.width, c.height);
          const { data } = ctx.getImageData(0, 0, c.width, c.height);
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
          pixelSample = { avgBrightness: Math.round(sum / (data.length / 4)), sampledPixels: data.length / 4 };
        } catch (e) {
          pixelSample = { error: e.message };
        }
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        // Flat primitives on purpose — nested objects get collapsed to "…" when the
        // console is copy-pasted as text, which is exactly what hid this data last time.
        console.log(
          '###PIXELCHECK### isLocal=' + isLocal,
          'label=' + debugLabel,
          'brightness=' + (pixelSample?.avgBrightness ?? ('ERROR:' + pixelSample?.error)),
          'videoWH=' + el.videoWidth + 'x' + el.videoHeight,
          'rectWH=' + Math.round(rect.width) + 'x' + Math.round(rect.height),
          'opacity=' + cs.opacity,
          'visibility=' + cs.visibility,
          'display=' + cs.display,
          'paused=' + el.paused
        );
      }, 1500);
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, isLocal, debugLabel]);

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
  if (str.startsWith('encv1:')) return true;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
}

// Snapshot of the message being replied to, sent alongside a reply so the
// recipient can render a preview. Keeps mediaType/mediaFileName (rather than
// collapsing every non-video media type to a hardcoded 'Photo' string) so a
// reply to a voice note or file shows the real label/filename, not just the
// wrong media icon text.
function buildReplySnapshot(src) {
  if (!src) return null;
  return {
    id: src.id,
    username: src.username || src.senderName || src.targetName,
    mediaType: src.mediaType || null,
    mediaFileName: src._fileName || src.mediaFileName || null,
    message: src.mediaType ? null : (src.decryptedText || (looksLikeCiphertext(src.message || '') ? '' : (src.message || '')))
  };
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

const getActiveMediaName = (mediaUrl) => {
  if (!mediaUrl) return '';

  // Try to find matching option in OPTIONS first
  const matchedOption = OPTIONS.find(opt => {
    if (!opt.url) return false;
    if (opt.url === mediaUrl) return true;
    const cleanOptUrl = opt.url.replace(/\/embed$/, '').replace(/\/$/, '');
    const cleanMediaUrl = mediaUrl.replace(/\/embed$/, '').replace(/\/$/, '');
    return cleanOptUrl && cleanMediaUrl && (cleanOptUrl === cleanMediaUrl || cleanMediaUrl.startsWith(cleanOptUrl) || cleanOptUrl.startsWith(cleanMediaUrl));
  });
  if (matchedOption) return matchedOption.name;

  if (mediaUrl === 'lobby://crazygames') return 'CrazyGames Hub';
  if (mediaUrl.startsWith('activity://')) {
    const actId = mediaUrl.replace('activity://', '');
    if (actId === 'videocall') return 'Video Call';
    if (actId === 'voicecall') return 'Voice Call';
    if (actId === 'whiteboard') return 'Whiteboard';
    if (actId === 'notes') return 'Shared Notes';
    if (actId === 'timer') return 'Timer & Clock';
    if (actId === 'truth-or-dare') return 'Truth or Dare';
    if (actId === 'would-you-rather') return 'Would You Rather';
    return actId.charAt(0).toUpperCase() + actId.slice(1);
  }
  // Activities — check specific URLs before generic domain matches
  if (mediaUrl.includes('webwhiteboard.com')) return 'Whiteboard';
  if (mediaUrl.includes('protectedtext.com')) return 'Protected Notes';
  if (mediaUrl.includes('truthordareplay.com')) return 'Truth or Dare';
  if (mediaUrl.includes('playgama.com')) {
    try {
      const parts = new URL(mediaUrl).pathname.split('/').filter(Boolean);
      const gameIdx = parts.indexOf('game');
      if (gameIdx !== -1 && parts.length > gameIdx + 1) {
        return parts[gameIdx + 1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    } catch {}
    return 'Would You Rather';
  }
  if (mediaUrl.includes('triviaduel.com')) return 'Mini Quiz';
  if (mediaUrl.includes('mentimeter.com')) return 'Mentimeter';
  if (mediaUrl.includes('skribbl.io')) return 'Skribbl.io';
  if (mediaUrl.includes('magma.com')) return 'Sketch Together';
  if (mediaUrl.includes('musiclab.chromeexperiments.com')) {
    if (mediaUrl.includes('Shared-Piano')) return 'Shared Piano';
    if (mediaUrl.includes('Song-Maker')) return 'Song Maker';
    if (mediaUrl.includes('Kandinsky')) return 'Kandinsky';
    if (mediaUrl.includes('Voice-Spinner')) return 'Voice Spinner';
    if (mediaUrl.includes('Melody-Maker')) return 'Melody Maker';
    return 'Chrome Music Lab';
  }
  if (mediaUrl.includes('skillwarz')) return 'Skillwarz';
  if (mediaUrl.includes('coolmathgames.com') && mediaUrl.includes('hangman')) return 'Hangman';
  if (mediaUrl.includes('crazygames.com')) return 'CrazyGames';
  if (mediaUrl.includes('poki.com')) return 'Poki Games';
  if (mediaUrl.includes('itch.io')) return 'Itch.io';
  // GamePix: extract slug from URL like https://play.gamepix.com/slug-name/embed
  if (mediaUrl.includes('gamepix.com')) {
    try {
      const parts = new URL(mediaUrl).pathname.split('/').filter(Boolean);
      if (parts.length >= 1) {
        const slug = parts[0];
        return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    } catch {}
    return 'Game';
  }
  // GameZop: map game IDs to human-readable names
  if (mediaUrl.includes('gamezop.com')) {
    const gamezopNames = {
      'SkhljT2fdgb': 'Ludo',
      'SJgx126Qc0H': 'Sudoku',
      '9lpHai56Q': "Assassin's Hunt",
      'gTD1yQp3R': 'Final War Dead Zone',
      'rkWfy2pXq0r': 'Fruit Chop',
      'NyM_JGWcx': '2048',
      'SKLI0L06A': 'Guess The Flag',
      'H1WmafkP9JQ': 'Tic Tac Toe',
      'H1Hgyn6XqAS': 'Carrom Hero',
      'UCS62KJ8c': 'Blocks Adventure',
      'yVywAGBQ6': 'Bubble Shooter',
    };
    for (const [id, name] of Object.entries(gamezopNames)) {
      if (mediaUrl.includes(id)) return name;
    }
    return 'Game';
  }
  if (mediaUrl.includes('foony.com')) {
    const foonyNames = {
      '4-in-a-row-connect': '4 in a Row',
      'sudoku-online': 'Sudoku',
      'mahjong-solitaire': 'Mahjong Solitaire',
      'checkers': 'Master Checkers',
      'foono-online-card-game': 'Fonoo Card Game',
      'ludo': 'Ludo',
      'tic-tac-toe': 'Tic Tac Toe',
      'paintjob': 'Paint Job',
      'breakout': 'Breakout',
      'popaword': 'Pop a Word',
      '9-ball-pool-online-billiards': '8 Ball Pool',
      'jigsaw-puzzle-online': 'Jigsaw Puzzle',
      'spades': 'Spades'
    };
    for (const [slug, name] of Object.entries(foonyNames)) {
      if (mediaUrl.includes(slug)) return name;
    }
    return 'Game';
  }
  if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) return 'YouTube';
  if (mediaUrl.includes('twitch.tv')) return 'Twitch';
  if (mediaUrl.includes('vimeo.com')) return 'Vimeo';
  return 'Media Player';
};

const isGameOrActivity = (url) => {
  if (!url) return false;
  if (url.startsWith('activity://')) return true;
  if (url === 'lobby://crazygames') return true;
  
  // Dynamic lookup in OPTIONS array
  const matched = OPTIONS.find(opt => {
    return opt.url === url || url.includes(opt.url) || (opt.url && opt.url.includes(url));
  });
  if (matched) {
    return matched.category === 'Games' || matched.category === 'Activities';
  }
  
  // Fallbacks for known platforms
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('crazygames') ||
    lowerUrl.includes('poki') ||
    lowerUrl.includes('itch.io') ||
    lowerUrl.includes('coolmathgames') ||
    lowerUrl.includes('gamepix') ||
    lowerUrl.includes('gamezop') ||
    lowerUrl.includes('foony') ||
    lowerUrl.includes('playgama') ||
    lowerUrl.includes('playhop') ||
    lowerUrl.includes('witeboard.com') ||
    lowerUrl.includes('webwhiteboard.com') ||
    lowerUrl.includes('protectedtext.com') ||
    lowerUrl.includes('truthordareplay.com') ||
    lowerUrl.includes('triviaduel.com') ||
    lowerUrl.includes('mentimeter.com') ||
    lowerUrl.includes('skribbl.io') ||
    lowerUrl.includes('magma.com') ||
    lowerUrl.includes('musiclab.chromeexperiments.com') ||
    lowerUrl.includes('mrracer.online') ||
    lowerUrl.includes('stickmankombat.io') ||
    lowerUrl.includes('blockblastmaster.io') ||
    lowerUrl.includes('numicolor.com')
  ) {
    return true;
  }
  return false;
};

const isCallActivity = (url) => url === 'activity://videocall' || url === 'activity://voicecall';

const isMediaGame = (url) => {
  if (!url) return false;
  const matched = OPTIONS.find(opt => {
    return opt.url === url || url.includes(opt.url) || (opt.url && opt.url.includes(url));
  });
  if (matched) {
    return matched.category === 'Games';
  }
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('crazygames.com') ||
    lowerUrl.includes('poki.com') ||
    lowerUrl.includes('itch.io') ||
    lowerUrl.includes('coolmathgames.com') ||
    lowerUrl.includes('gamepix.com') ||
    lowerUrl.includes('gamezop.com') ||
    lowerUrl.includes('foony.com') ||
    lowerUrl.includes('playgama.com') ||
    lowerUrl.includes('playhop.com')
  ) {
    if (
      lowerUrl.includes('magma.com') ||
      lowerUrl.includes('webwhiteboard.com') ||
      lowerUrl.includes('protectedtext.com') ||
      lowerUrl.includes('mentimeter.com')
    ) {
      return false;
    }
    return true;
  }
  return false;
};

// isVirtualBrowserUrl: intentionally always returns false.
// All iframe URLs (crazygames, poki, itch.io, etc.) now load as plain iframes.
// The virtual browser (Cloud Browser) must be opened manually by the user.
const isVirtualBrowserUrl = (_url) => false;

const CrazyGamesCard = ({ game, onSelectGame }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={() => onSelectGame(game.url)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: hovered ? '1px solid rgba(255,87,34,0.4)' : '1px solid rgba(255,255,255,0.04)',
        borderRadius: 12,
        height: 110,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        padding: 0,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 16px rgba(0,0,0,0.4)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'left',
        width: '100%'
      }}
    >
      {game.image ? (
        <img
          src={game.image}
          alt={game.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, zIndex: 0 }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at top right, ${game.color || 'var(--brand-1)'}33 0%, rgba(9,9,14,0.95) 75%)`,
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24
        }}>
          🎮
        </div>
      )}
      <div style={{
        position: 'absolute', inset: 0,
        background: hovered ? 'rgba(0,0,0,0.6)' : 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 10,
        boxSizing: 'border-box',
        transition: 'all 0.2s'
      }}>
        <span className="stay-white" style={{ fontSize: 11, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          {game.name}
        </span>
      </div>
    </button>
  );
};

const CrazyGamesLobby = ({ onSelectGame, isLight }) => {
  const [activeTab, setActiveTab] = React.useState('multiplayer');

  const kosmiPicks = [
    { name: '8 Ball Pool', url: 'https://games.crazygames.com/en_US/8-ball-pool-wyr/index.html', image: '/images/apps/8ball.jpg?v=2' },
    { name: 'WorldGuessr', url: 'https://games.crazygames.com/en_US/worldguessr/index.html', color: '#3b82f6' },
    { name: 'Chess', url: 'https://games.crazygames.com/en_US/chess-free/index.html', image: '/images/apps/chess.jpg?v=2' },
    { name: 'Uno Online', url: 'https://games.crazygames.com/en_US/uno-online/index.html', color: '#ef4444' },
    { name: 'Connect 4', url: 'https://games.crazygames.com/en_US/connect-4/index.html', color: '#eab308' },
    { name: 'Ships 3D', url: 'https://games.crazygames.com/en_US/ships-3d/index.html', color: '#06b6d4' }
  ];

  const multiplayerGames = [
    { name: 'Miniblox', url: 'https://games.crazygames.com/en_US/miniblox/index.html', color: '#51cf66' },
    { name: 'Smash Karts', url: 'https://games.crazygames.com/en_US/smash-karts/index.html', image: '/images/apps/smashkarts.jpg?v=2' },
    { name: 'Shell Shockers', url: 'https://games.crazygames.com/en_US/shellshockersio/index.html', color: '#ff6b6b' },
    { name: 'Hexanaut.io', url: 'https://games.crazygames.com/en_US/hexanaut-io/index.html', color: '#4dadf7' },
    { name: 'Circuit Racing', url: 'https://games.crazygames.com/en_US/circuit-racing/index.html', image: '/images/apps/circuitracing.png?v=2' },
    { name: 'Checkers', url: 'https://games.crazygames.com/en_US/classic-checkers/index.html', image: '/images/apps/checkers.png?v=2' },
    { name: 'Trial Mania', url: 'https://games.crazygames.com/en_US/trial-mania/index.html', image: '/images/apps/trialmania.jpg?v=2' },
    { name: 'Prison Escape 2', url: 'https://games.crazygames.com/en_US/prison-escape-2/index.html', image: '/images/apps/prisonescape.jpg?v=2' },
    { name: 'Skill Warz', url: 'https://games.crazygames.com/en_US/skillwarz/index.html', image: '/images/apps/skillwarz.jpg?v=2' }
  ];

  const singleplayerGames = [
    { name: 'Trial Mania', url: 'https://games.crazygames.com/en_US/trial-mania/index.html', image: '/images/apps/trialmania.jpg?v=2' },
    { name: 'Prison Escape 2', url: 'https://games.crazygames.com/en_US/prison-escape-2/index.html', image: '/images/apps/prisonescape.jpg?v=2' },
    { name: 'Miniblox', url: 'https://games.crazygames.com/en_US/miniblox/index.html', color: '#51cf66' }
  ];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#09090e',
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }} className="gcw-force-dark">
      {/* Lobby Header */}
      <div style={{
        padding: '16px 24px',
        background: '#12121a',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff5722 0%, #ff7a45 100%)',
            color: '#fff',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 'bold'
          }}>
            🎮
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px', background: 'linear-gradient(to right, #ff7a45, #ffa940)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            CRAZY GAMES
          </span>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            className="stay-white"
            onClick={() => setActiveTab('multiplayer')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'multiplayer' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === 'multiplayer' ? '#fff' : '#888',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Multiplayer
          </button>
          <button
            className="stay-white"
            onClick={() => setActiveTab('singleplayer')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'singleplayer' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === 'singleplayer' ? '#fff' : '#888',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Singleplayer
          </button>
        </div>
      </div>

      {/* Games Grid Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
        {activeTab === 'multiplayer' ? (
          <>
            {/* Kosmi Picks */}
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--brand-1-light)', letterSpacing: '0.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#fbbf24' }}>★</span> Kosmi Picks
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 16,
              marginBottom: 28
            }}>
              {kosmiPicks.map(game => (
                <CrazyGamesCard
                  key={game.name}
                  game={game}
                  onSelectGame={onSelectGame}
                />
              ))}
            </div>

            {/* All Games */}
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--brand-1-light)', letterSpacing: '0.5px', marginBottom: 12 }}>
              All Games
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 16
            }}>
              {multiplayerGames.map(game => (
                <CrazyGamesCard
                  key={game.name}
                  game={game}
                  onSelectGame={onSelectGame}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Singleplayer Games */}
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--brand-1-light)', letterSpacing: '0.5px', marginBottom: 12 }}>
              Singleplayer Games
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 16
            }}>
              {singleplayerGames.map(game => (
                <CrazyGamesCard
                  key={game.name}
                  game={game}
                  onSelectGame={onSelectGame}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Phone-width breakpoint, but keyed off the SMALLER of the two viewport dimensions
// instead of just innerWidth. A phone's width alone crosses 640 the moment it's
// physically rotated to real landscape (e.g. 390x844 portrait -> 844x390 landscape),
// which was silently flipping every mobile-only control off mid-session on rotation.
// The smaller dimension stays under 640 in either orientation for an actual phone,
// while tablets/desktops (where the smaller dimension is already well above 640)
// are unaffected — this only fixes the rotation flip, it doesn't change who counts
// as "mobile" for general room layout.
function detectIsMobile() {
  if (typeof window === 'undefined') return false;
  return Math.min(window.innerWidth, window.innerHeight) < 640;
}

// The mobile-fullscreen "rotate trick" (.player-mob-fs) rotates the whole player
// 90deg clockwise around a pivot at (window.innerWidth, 0) to fake a landscape view
// on a phone that's still logically portrait. getBoundingClientRect() on anything
// inside it already returns the POST-rotation visual rect, which is why the tap
// zones/portals elsewhere in this file "just work" off real rects. But an overlay
// that's portaled to document.body and positioned with plain fixed left/top does NOT
// get that rotation — it renders upright in the real (portrait) screen frame, which
// looks sideways to a user who's physically turned their phone to watch the (now
// correctly-oriented-to-them) rotated video. To make an overlay rotate WITH the video,
// render it inside a wrapper that replicates the same box + transform, and position
// content within that wrapper using the button's rect converted into the wrapper's
// own pre-rotation ("local") coordinate space — this inverts the rotation mapping.
function toRotatedLocalRect(globalRect, viewportWidth) {
  return {
    left: globalRect.top,
    top: viewportWidth - globalRect.left - globalRect.width,
    width: globalRect.height,
    height: globalRect.width,
  };
}

const QUALITY_PRESETS = {
  '240p':  { label: '240p',       filter: 'blur(1.5px) brightness(0.85) saturate(0.6) contrast(0.9)',  description: 'Low quality' },
  '360p':  { label: '360p',       filter: 'blur(0.8px) brightness(0.9) saturate(0.75) contrast(0.95)', description: 'Standard quality' },
  '480p':  { label: '480p',       filter: 'blur(0.3px) brightness(0.95) saturate(0.9) contrast(0.98)', description: 'Good quality' },
  '720p':  { label: '720p ✦',     filter: 'none',                                                      description: 'HD quality' },
  '1080p': { label: '1080p ✦',    filter: 'brightness(1.05) saturate(1.15) contrast(1.08)',            description: 'Full HD' },
  '4K':    { label: '4K Ultra ✦', filter: 'brightness(1.12) saturate(1.3) contrast(1.1)',              description: 'Ultra HD' },
};

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
  const [isResizingCam, setIsResizingCam] = useState(false);
  const [isOverRemoveZone, setIsOverRemoveZone] = useState(false);
  const isOverRemoveRef = useRef(false);
  // Local-only camera visibility preference (does NOT affect other users)
  const [areCamerasHidden, setAreCamerasHidden] = useState(
    () => localStorage.getItem('sahaplay_hide_camera_tiles') === 'true'
  );
  // Right-panel tab: 'chat' | 'cameras' — only used when managed layout is active
  const [rightPanelTab, setRightPanelTab] = useState('chat');
  const rightPanelTabRef = useRef(rightPanelTab);
  useEffect(() => {
    rightPanelTabRef.current = rightPanelTab;
  }, [rightPanelTab]);
  // Camera panel display preferences — all local, never sent to server
  const [cameraLayoutMode, setCameraLayoutMode] = useState(
    () => localStorage.getItem('sahaplay_camera_layout_mode') || 'list'
  );
  const [focusVideoEnabled, setFocusVideoEnabled] = useState(false);
  const [focusedCameraUserId, setFocusedCameraUserId] = useState(null);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const cameraMenuRef = useRef(null);
  // Ref for the right column div — used to compute focus-popout fixed position
  const rightColumnRef = useRef(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [clearChatTarget, setClearChatTarget] = useState(null);
  const [clearForBoth, setClearForBoth] = useState(false);
  

  const [profile, setProfile] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showRecentChats, setShowRecentChats] = useState(getPersistedGcwOpen);
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
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const userPanelRef = useRef(null);
  const mobUserPanelTriggerRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(null);
  const [kickedReason, setKickedReason] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPersonalDeleteConfirm, setShowPersonalDeleteConfirm] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [muteRoomJoinLeave, setMuteRoomJoinLeave] = useState(() => {
    try {
      const myUsername = localStorage.getItem('watch_username') || 'guest';
      return localStorage.getItem(`mute_join_leave_${roomId}_${myUsername}`) === 'true';
    } catch {
      return false;
    }
  });
  const [muteAllNotifSounds, setMuteAllNotifSounds] = useState(() => {
    try {
      const myUsername = localStorage.getItem('watch_username') || 'guest';
      return localStorage.getItem(`mute_notif_sounds_${myUsername}`) === 'true';
    } catch {
      return false;
    }
  });
  const muteRoomJoinLeaveRef = useRef(muteRoomJoinLeave);
  useEffect(() => {
    muteRoomJoinLeaveRef.current = muteRoomJoinLeave;
  }, [muteRoomJoinLeave]);
  const muteAllNotifSoundsRef = useRef(muteAllNotifSounds);
  useEffect(() => {
    muteAllNotifSoundsRef.current = muteAllNotifSounds;
  }, [muteAllNotifSounds]);
  const [modMenuTarget, setModMenuTarget] = useState(null);
  const [modMenuPos, setModMenuPos] = useState({ top: 0, left: 0 });
  const [showHeaderModMenu, setShowHeaderModMenu] = useState(false);
  const [headerModMenuPos, setHeaderModMenuPos] = useState({ top: 0, left: 0 });
  const [pinnedRooms, setPinnedRooms] = useState(() => { try { return JSON.parse(localStorage.getItem('pinned_rooms') || '[]'); } catch { return []; } });
  const [roomSettingsModalOpen, setRoomSettingsModalOpen] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [showGameControls, setShowGameControls] = useState(true);
  const gameControlsTimerRef = useRef(null);
  const resetGameControlsTimer = () => {
    setShowGameControls(true);
    clearTimeout(gameControlsTimerRef.current);
    gameControlsTimerRef.current = setTimeout(() => setShowGameControls(false), 2800);
  };
  const [roomTheme, setRoomTheme] = useState('default');
  const [isPublic, setIsPublic] = useState(true);
  const settingsRef = useRef(null);
  const themeChangeInFlightRef = useRef(false);

  const [mediaUrl, setMediaUrl] = useState('');
  const mediaUrlRef = useRef(mediaUrl);
  useEffect(() => {
    mediaUrlRef.current = mediaUrl;
  }, [mediaUrl]);

  const [lastMediaCategory, setLastMediaCategory] = useState('Streaming');
  const [lastMediaGameTab, setLastMediaGameTab] = useState('Multiplayer');
  const [lastMediaActivityTab, setLastMediaActivityTab] = useState('General');

  useEffect(() => {
    if (mediaUrl) {
      const matched = OPTIONS.find(o => o.url === mediaUrl || (o.url && (mediaUrl.includes(o.url) || o.url.includes(mediaUrl))));
      if (matched) {
        if (matched.category) setLastMediaCategory(matched.category);
        if (matched.category === 'Games' && matched.gameMode) setLastMediaGameTab(matched.gameMode);
        if (matched.category === 'Activities' && matched.activityTab) setLastMediaActivityTab(matched.activityTab);
      }
    }
  }, [mediaUrl]);
  const [subtitlesUrl, setSubtitlesUrl] = useState(null);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const subtitleInputRef = useRef(null);
  const [subtitleVttText, setSubtitleVttText] = useState(null);
  const subtitleCuesRef = useRef([]);
  const [activeCue, setActiveCue] = useState(null);
  const [showSubtitleSettingsModal, setShowSubtitleSettingsModal] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const subtitleMenuRef = useRef(null);
  const [subtitleSettings, setSubtitleSettings] = useState(() => {
    try {
      const key = `subtitleSettings_${localStorage.getItem('watch_username') || 'guest'}`;
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { delay: 0, speed: 1.0, fontSize: 'medium', textColor: 'white', bgColor: 'black', opacity: 1.0, position: 'bottom' };
  });
  function convertSrtToVtt(srtText) {
    let text = srtText.trim().replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (text.startsWith('WEBVTT')) {
      return text;
    }
    const lines = text.split('\n');
    const vttLines = ['WEBVTT', ''];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.includes('-->')) {
        line = line.replace(/,/g, '.');
      }
      vttLines.push(line);
    }
    return vttLines.join('\n');
  }
  function parseVttCues(vttText) {
    const cues = [];
    const lines = (vttText || '').split('\n');
    let i = 0;
    while (i < lines.length) {
      if (lines[i].includes('-->')) {
        const m = lines[i].match(/^([\d:,.]+)\s+-->\s+([\d:,.]+)/);
        if (m) {
          const parseT = t => {
            const p = t.replace(',', '.').split(':');
            return p.length === 3 ? +p[0] * 3600 + +p[1] * 60 + +p[2]
              : p.length === 2 ? +p[0] * 60 + +p[1]
              : +p[0];
          };
          const start = parseT(m[1]);
          const end = parseT(m[2]);
          i++;
          const textLines = [];
          while (i < lines.length && lines[i].trim() !== '') {
            textLines.push(lines[i]);
            i++;
          }
          if (textLines.length) {
            cues.push({ start, end, text: textLines.join('\n').replace(/<[^>]+>/g, '') });
          }
        }
      }
      i++;
    }
    return cues;
  }
  const [iframeLoading, setIframeLoading] = useState(false);
  const [isLaunchingVirtualBrowser, setIsLaunchingVirtualBrowser] = useState(false);
  // Sticky (unlike isLaunchingVirtualBrowser, which is only true for the brief
  // window while a session is being created) — stays true for the whole time
  // a placeholder app (Netflix/Prime/etc.) is loaded via the Virtual Browser,
  // so the plain-iframe fallback attempt and its "Page blocks embedding"
  // overlay never render for it, even if hyperbeamSession is momentarily null.
  const [isVirtualBrowserMedia, setIsVirtualBrowserMedia] = useState(false);
  const [iframeError, setIframeError] = useState(false); // true when iframe is blocked/X-Frame-Options denied
  const [iframeBlockSuspected, setIframeBlockSuspected] = useState(false); // true when page loaded but may be a block page (soft block)
  const [iframeHintExpanded, setIframeHintExpanded] = useState(true);
  const [hoveringIframeHint, setHoveringIframeHint] = useState(false);
  const iframeBlockTimeoutRef = useRef(null);
  const [showGlobePopup, setShowGlobePopup] = useState(false);
  const [showGlobeInstruction, setShowGlobeInstruction] = useState(() => {
    return localStorage.getItem('hasSeenGameGlobeInstruction') !== 'true';
  });

  const dismissGlobeInstruction = () => {
    localStorage.setItem('hasSeenGameGlobeInstruction', 'true');
    setShowGlobeInstruction(false);
  };

  const globePopupRef = useRef(null);
  const [hbSessionId, setHbSessionId] = useState(null);
  const [browserDisplayUrl, setBrowserDisplayUrl] = useState('');
  const [browserBarInput, setBrowserBarInput] = useState('');
  // ─── Hyperbeam Cloud Browser fallback state ───────────────────────────────
  // loadFailed: set to true when ReactPlayer errors or 10s timeout fires
  // hyperbeamSession: { session_id, embed_url } when cloud browser is active
  const [loadFailed, setLoadFailed] = useState(false);
  const [failedPlaybackUrl, setFailedPlaybackUrl] = useState('');
  const [hyperbeamSession, setHyperbeamSession] = useState(null);
  const [hbNavStatus, setHbNavStatus] = useState(null); // null | 'navigating' | 'failed'
  const hyperbeamContainerRef = useRef(null);
  const hyperbeamInstanceRef = useRef(null);
  const hyperbeamTargetUrlRef = useRef(null);
  const hbAdminTokenRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [videoPlatform, setVideoPlatform] = useState('direct');
  const [platformData, setPlatformData] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isGuestVerified, setIsGuestVerified] = useState(() => localStorage.getItem('watch_is_guest') !== 'true');
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationTime, setPreparationTime] = useState(25); // Increased for 4K stability
  const [prepProgress, setPrepProgress] = useState(0);
  // True while a locally-streamed (progressive upload) video has stalled mid-playback
  // waiting for more bytes to arrive — distinct from isPreparing, which only covers
  // the *initial* load and is force-disabled for local streams (effectiveIsPreparing).
  // Without this, a viewer catching up to the still-uploading edge of the file just
  // sees the video silently freeze with zero feedback, indistinguishable from broken.
  const [isStreamBuffering, setIsStreamBuffering] = useState(false);
  useEffect(() => { setIsStreamBuffering(false); }, [mediaUrl]);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const lastPrepUrl = useRef('');

  const containerRef = useRef(null);
  const videoFileInputRef = useRef(null); // persistent file input outside any modal
  const [isUploading, setIsUploading] = useState(false);
  const [streamPending, setStreamPending] = useState(null); // { streamKey, filename } while host uploads
  // Set by the (host-inclusive) stream_ready listener the moment the server has enough
  // of the upload on disk for progressive playback — lets the host's own resync effect
  // fire within seconds instead of waiting for the entire upload to finish.
  const [earlyStreamReadyKey, setEarlyStreamReadyKey] = useState(null);
  const { uploadState, uploadFile, cancelUpload } = useVideoUpload({ socket, roomId, serverUrl: SOCKET_SERVER_URL });
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
              border: isLightMode ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-2-rgb), 0.4)',
              borderRadius: 20, padding: '18px 20px',
              boxShadow: isLightMode ? '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' : '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(var(--brand-2-rgb),0.1)',
              backdropFilter: 'blur(12px)',
              minWidth: 340, maxWidth: 420,
              animation: toastState.visible ? 'slideInDown 0.35s cubic-bezier(0.21,1.02,0.73,1)' : 'slideOutUp 0.3s ease forwards',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Purple glow accent top bar */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--brand-1), var(--brand-2), #ec4899)', borderRadius: '20px 20px 0 0' }} />
              
              {/* Avatar */}
              {requesterAvatar ? (
                <img src={getAvatarUrl(requesterAvatar)} alt={requesterName} style={{
                  width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
                  boxShadow: isLightMode ? '0 0 0 2px #fff, 0 2px 8px rgba(var(--brand-1-rgb),0.2)' : '0 0 0 3px rgba(var(--brand-2-rgb),0.25), 0 4px 12px rgba(var(--brand-1-rgb),0.4)',
                  animation: 'joinPulse 2s infinite', flexShrink: 0
                }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0,
                  boxShadow: isLightMode ? '0 0 0 2px #fff, 0 2px 8px rgba(var(--brand-1-rgb),0.2)' : '0 0 0 3px rgba(var(--brand-2-rgb),0.25), 0 4px 12px rgba(var(--brand-1-rgb),0.4)',
                  animation: 'joinPulse 2s infinite',
                }}>
                  {requesterName ? requesterName[0].toUpperCase() : '?'}
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <p style={{ margin: 0, color: isLightMode ? '#0f172a' : '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>{requesterName}</p>
                  <span style={{ fontSize: 10, background: isLightMode ? '#f3e8ff' : 'rgba(var(--brand-2-rgb),0.2)', color: isLightMode ? '#9333ea' : 'var(--brand-2-light)', borderRadius: 6, padding: '2px 7px', fontWeight: 600, border: isLightMode ? '1px solid #e9d5ff' : '1px solid rgba(var(--brand-2-rgb),0.3)' }}>{t('joinRequest', 'JOIN REQUEST')}</span>
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
    setMemberSearchQuery('');
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
          try {
            const ytPlayer = playerRef.current.getInternalPlayer();
            const fraction = (typeof ytPlayer?.getVideoLoadedFraction === 'function')
              ? ytPlayer.getVideoLoadedFraction()
              : 0;
            loadedSeconds = fraction * duration;
          } catch (_e) { loadedSeconds = 0; }
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
        // Progress toward buffering goal
        const isEmbed = mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be') || mediaUrl.includes('twitch.tv') || mediaUrl.includes('vimeo.com');
        const bufferGoal = isEmbed ? 1 : 25;
        const progress = Math.min((loadedSeconds / bufferGoal) * 100, 100);
        setPrepProgress(progress);

        // --- Gate Check ---
        if (loadedSeconds >= bufferGoal || (duration > 0 && Math.abs(duration - playerRef.current.getCurrentTime()) < 1.0)) {
          setIsPreparing(false);
          setBufferedSeconds(0);
          clearTimeout(safetyTimeout);
          lastExternalUpdate.current = Date.now() + 1500;
          playerRef.current.seekTo(prepTargetTimeRef.current || 0, 'seconds');
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
      setIsPreparing((mediaUrl.includes('twitch.tv') || (mediaUrl.includes('vimeo.com') && !useCustomVimeoControls)) ? false : true);
      setPrepProgress(0);
      setBufferedSeconds(0);
      if (!ReactPlayer.canPlay(mediaUrl) && !mediaUrl.includes('/api/stream/') && !mediaUrl.startsWith('blob:')) {
        setIframeLoading(true);
      }
    }
  }, [mediaUrl]);

  useEffect(() => {
    if (!mediaUrl?.includes('/api/stream/') && !mediaUrl?.startsWith('blob:')) return
    // Force dismiss after 3 seconds max
    const timer = setTimeout(() => {
      console.log('[OVERLAY] Force dismissing after 3s')
      setIsPreparing(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [mediaUrl]);

  const [isMobile, setIsMobile] = useState(detectIsMobile);
  // Touch-primary detection (phone or tablet, any width) — `isMobile` above stays a
  // phone-width breakpoint for general room layout (nav/chat/etc, unchanged), but the
  // video player's touch-specific controls (gesture overlay, portal dropdowns, mobile
  // fullscreen rotate-trick, subtitle panel) should also apply on iPad, which never
  // qualifies as "mobile" by width alone. `pointer: coarse` is stable across rotation
  // and identifies the primary input device rather than guessing from screen size.
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsCoarsePointer(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', update); else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update); else mq.removeListener(update);
    };
  }, []);
  // A Smart TV browser can report pointer:coarse (no real pointing device) just
  // like a phone would, which would otherwise route it through the mobile-only
  // fullscreen rotate-trick (.player-mob-fs) meant for a portrait-locked phone
  // screen — on an actually-landscape TV that showed the video rotated 90deg
  // ("tilted right", rendering portrait). TV must never take that path.
  const isTouchPlayer = !isTvMode && (isMobile || isCoarsePointer);
  const [useCustomTwitchControls, setUseCustomTwitchControls] = useState(true);
  const [twitchReloadKey, setTwitchReloadKey] = useState(0);
  const lastTwitchReloadTimeRef = useRef(0);
  const [isUnmountingTwitch, setIsUnmountingTwitch] = useState(false);

  const isTwitch = React.useMemo(() => {
    return !!(mediaUrl && mediaUrl.includes('twitch.tv'));
  }, [mediaUrl]);

  const twitchChannel = React.useMemo(() => {
    if (!mediaUrl) return '';
    const match = mediaUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    return match ? match[1] : '';
  }, [mediaUrl]);

  const twitchParent = React.useMemo(() => {
    return window.location.hostname === 'localhost' ? 'localhost' : (window.location.hostname.includes('sahaplay.com') ? 'sahaplay.com' : window.location.hostname);
  }, []);

  const isVimeo = React.useMemo(() => {
    return !!(mediaUrl && mediaUrl.includes('vimeo.com'));
  }, [mediaUrl]);

  const vimeoId = React.useMemo(() => {
    if (!mediaUrl) return '';
    const match = mediaUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/i);
    return match ? match[1] : '';
  }, [mediaUrl]);

  useEffect(() => {
    console.log('[PROVIDER DETECTED]', {
      url: mediaUrl,
      isTwitch: isTwitch ? 'yes' : 'no',
      isVimeo: isVimeo ? 'yes' : 'no',
      isIVS: 'no',
      component: (isTwitch || isVimeo) ? 'Native IFrame' : 'ReactPlayer',
      mode: isMobile ? 'mobile' : 'desktop'
    });
  }, [mediaUrl, isTwitch, isVimeo, isMobile]);

  useEffect(() => {
    if (mediaUrl && mediaUrl.includes('twitch.tv')) {
      setIsUnmountingTwitch(true);
      const timer = setTimeout(() => {
        setIsUnmountingTwitch(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [mediaUrl]);

  const handleReloadTwitch = useCallback(() => {
    const now = Date.now();
    if (now - lastTwitchReloadTimeRef.current < 10000) {
      toast.error("Twitch is rate-limiting reloads. Wait a few seconds before trying again.");
      return;
    }
    lastTwitchReloadTimeRef.current = now;
    setTwitchReloadKey(k => k + 1);
    toast.success("Reloading Twitch Player...", { id: 'twitch-reload' });
  }, []);

  const handleTwitchOnLoad = useCallback(() => {
    clearTimeout(loadTimeoutRef.current);
    setIsPreparing(false);
    setLoadFailed(false);
  }, []);

  const handleVimeoOnLoad = useCallback(() => {
    clearTimeout(loadTimeoutRef.current);
    setIsPreparing(false);
    setLoadFailed(false);
  }, []);

  const handleIVSPlayerGuard = useCallback((url) => {
    if (!url) return false;
    if (url.includes('twitch.tv')) {
      console.log('[TWITCH IVS GUARD] Hard-bypassing Amazon IVS Player and event listener attachments.');
      return true;
    }
    return false;
  }, []);
  const [useCustomVimeoControls, setUseCustomVimeoControls] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const inactivityTimer = useRef(null);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [showGuidedShare, setShowGuidedShare] = useState(null);
  const [activeExternalApp, setActiveExternalApp] = useState(null);
  const [banConfirmTarget, setBanConfirmTarget] = useState(null);
  const [isFloatingBarMinimized, setIsFloatingBarMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [isMobileFsMode, setIsMobileFsMode] = useState(false);
  // True only for the actual rotated (.player-mob-fs) case — calls use
  // .player-mob-fs-portrait instead, which stays upright, so nothing needs the
  // rotated-overlay treatment there.
  const isRotatedFs = isMobileFsMode && !isCallActivity(mediaUrl);
  const [showCastDiscovery, setShowCastDiscovery] = useState(false);

  // Monitor browser-level fullscreen changes to sync UI state
  useEffect(() => {
    const onFullscreenChange = () => {
      const fsEl = document.fullscreenElement;
      const entering = !!fsEl;
      const isDoc = fsEl === document.documentElement;
      setIsAppFullscreen(isDoc && entering);
      setIsFullscreen(entering && !isDoc);
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

  function isNSFWUrl(_url) {
    return false; // No content restrictions
  }

  const handleFullscreen = () => {
    if (isTouchPlayer) {
      if (isMobileFsMode) {
        setIsMobileFsMode(false);
        if (screen?.orientation?.unlock) screen.orientation.unlock();
      } else {
        setIsMobileFsMode(true);
        // Calls stay portrait (WhatsApp-style) — only real video/game
        // playback rotates into landscape on mobile fullscreen.
        if (screen?.orientation?.lock) {
          screen.orientation.lock(isCallActivity(mediaUrl) ? 'portrait' : 'landscape').catch(() => {});
        }
      }
      return;
    }
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

  function detectMediaType(url) {
    if (!url) return null;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitch.tv/videos')) return 'twitch_vod';
    if (/\.(mp4|webm|mkv|m3u8|avi|mov)(\?|$)/i.test(url)) return 'direct';
    return null;
  }

  function getPlayerPosition() {
    if (localVideoRef.current) return localVideoRef.current.currentTime || 0;
    if (playerRef.current?.getCurrentTime) return playerRef.current.getCurrentTime() || 0;
    if (playerRef.current?.currentTime !== undefined) return playerRef.current.currentTime || 0;
    return currentTime || 0;
  }

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(1);
  const playerVolumeRef = useRef(1); // mirrors playerVolume for reading inside closures without stale state
  const [isDucked, setIsDucked] = useState(false);
  const [duckingNotice, setDuckingNotice] = useState(null);
  const preDuckVolumeRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyzersRef = useRef(new Map());
  const hasAutoResumedRef = useRef(false);
  const savePositionStateRef = useRef({ isEffectiveHost: false, mediaUrl: '', roomId: '' });
  const prepTargetTimeRef = useRef(0);
  const [playerMuted, setPlayerMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);
  // Mobile tap-gesture layer: double-tap left/right thirds of the video to seek ±10s
  // (with a transient ripple), single tap to toggle the control bar, center tap to
  // play/pause — mirrors standard mobile video player conventions (YouTube/Netflix).
  const [seekFeedback, setSeekFeedback] = useState(null); // { dir: 'back'|'forward', key } | null
  const seekFeedbackTimerRef = useRef(null);
  const [centerFeedback, setCenterFeedback] = useState(null); // { type: 'play'|'pause', key } | null
  const centerFeedbackTimerRef = useRef(null);
  const tapTimerRef = useRef(null);
  const lastTapRef = useRef({ zone: null, time: 0 });
  const playerWrapRef = useRef(null);
  // Responsive breakpoints
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Show game controls/name overlay briefly when game starts loading
  useEffect(() => {
    if (mediaUrl && isGameOrActivity(mediaUrl)) {
      resetGameControlsTimer();
    } else {
      setShowGameControls(false);
    }
  }, [mediaUrl]);

  // Tracking intentional navigation vs page refresh
  const isUnloadingRef = useRef(false);
  useEffect(() => {
    const handleBeforeUnload = () => { isUnloadingRef.current = true; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  // Restore which chat view (list/group/dm) was open in this room across a
  // navigate-away-and-back cycle (e.g. tapping a message avatar to view a
  // profile then swiping back) — Room.jsx fully unmounts on that navigation
  // so plain useState would otherwise reset to a closed chat every time.
  const [chatTab, setChatTab] = useState(() => {
    try { return sessionStorage.getItem(`room_chat_tab_${roomId}`) || 'list'; } catch { return 'list'; }
  });
  const [groupMessages, setGroupMessages] = useState([]);
  const [dmTarget, setDmTarget] = useState(() => {
    try { return sessionStorage.getItem(`room_dm_target_${roomId}`) || null; } catch { return null; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(`room_chat_tab_${roomId}`, chatTab); } catch {}
  }, [chatTab, roomId]);
  useEffect(() => {
    try {
      if (dmTarget) sessionStorage.setItem(`room_dm_target_${roomId}`, dmTarget);
      else sessionStorage.removeItem(`room_dm_target_${roomId}`);
    } catch {}
  }, [dmTarget, roomId]);
  const dmTargetRef = useRef(null);
  const [dmThreads, setDmThreads] = useState({});
  const dmClearedTsRef = useRef({});
  const [dmUnread, setDmUnread] = useState({});
  const dmUnreadRef = useRef({});
  // Async-decrypted DM media blob URLs: msgKey -> objectURL (same pattern as GlobalChatWidget)
  const dmDecryptedMediaUrls = useRef({});
  const [dmMediaUrlVersion, setDmMediaUrlVersion] = useState(0);
  const groupDecryptedMediaUrls = useRef({});
  const [groupMediaUrlVersion, setGroupMediaUrlVersion] = useState(0);
  // reaction preview overrides: key → previewText, shown in chat list until user opens that chat.
  // Persisted to localStorage (shared with GlobalChatWidget) so it survives a refresh.
  const [reactionPreviews, setReactionPreviews] = useState(getPersistedReactionPreviews);

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
  const [groupEditingMessage, setGroupEditingMessage] = useState(null);
  const [dmEditingMessage, setDmEditingMessage] = useState(null);
  const [roomName, setRoomName] = useState('Room Chat');
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showDmMenu, setShowDmMenu] = useState(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showAllEmojis, setShowAllEmojis] = useState(false);
  const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false);
  const [showDmEmojiPicker, setShowDmEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [typingStatuses, setTypingStatuses] = useState({}); // chatKey -> Array of usernames typing
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const messagesEndRef = useRef(null);

  // ─── Scoped Chat History Pagination State Ref (Additions 1, 3, 4) ───
  const [groupHistoryLoading, setGroupHistoryLoading] = useState(false);
  const [dmHistoryLoading, setDmHistoryLoading] = useState(false);
  const [hasMoreGroupHistory, setHasMoreGroupHistory] = useState(true);
  const [hasMoreDmHistory, setHasMoreDmHistory] = useState({}); // keyed by partnerUsername.toLowerCase()
  // Tracks whether the initial history fetch has completed at least once since
  // this component mounted (fresh on every mount, e.g. after navigating away to
  // a profile page and back). Used to distinguish "still loading" from "genuinely
  // empty" so the empty-state text doesn't flash before real history arrives.
  const [groupHistoryReady, setGroupHistoryReady] = useState(false);
  const [dmHistoryReady, setDmHistoryReady] = useState(false);

  // Safety net: if the server never responds (dropped connection, etc.) don't
  // leave the chat panel spinning forever — fall back to the real empty state.
  useEffect(() => {
    const timer = setTimeout(() => {
      setGroupHistoryReady(true);
      setDmHistoryReady(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [roomId]);

  const paginationStateRef = useRef({
    group: {
      hasMore: true,
      isLoading: false
    }
  });

  const groupScrollElRef = useRef(null);
  const groupScrollPosRef = useRef(null);
  const dmScrollElRef = useRef(null);
  const dmScrollPosRef = useRef(null);

  // ─── E2EE Decryption & Scoped Pagination Loaders (Additions 1, 2, 3, 4) ───
  const decryptRoomGroupMessages = async (msgs) => {
    const kp = myKeyPair.current;
    const myUserLower = username?.toLowerCase();

    const processed = await Promise.all(msgs.map(async (msg) => {
      try {
        const isMine = msg.isMe !== undefined ? msg.isMe
          : ((msg.username && msg.username.toLowerCase() === username?.toLowerCase()) || (msg.senderName && msg.senderName.toLowerCase() === username?.toLowerCase()));
        const safeReactions = (() => { try { return fixReactions(msg.reactions); } catch { return {}; } })();
        
        let displayMediaUrl = msg.mediaUrl;
        let decryptedText = msg.decryptedText !== undefined ? msg.decryptedText : null;

        if (msg.e2ee && msg.e2ee.keys && kp) {
          try {
            const myEncKey = msg.e2ee.keys[myUserLower]
              || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myUserLower)?.[1];
            const resolvedSenderKey = msg.e2ee.senderPublicKey || (isMine ? encodeBase64(kp.publicKey) : null);
            
            if (myEncKey && resolvedSenderKey) {
               const senderPubKey = decodeBase64(resolvedSenderKey);
               const plain = decryptGroupMessage(msg.message, msg.e2ee.nonce, myEncKey, senderPubKey, kp.secretKey);
               if (plain !== null) {
                 if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                   try {
                     const mediaKeyBytes = robustDecode(plain);
                     const resolvedUrl = resolveMediaUrl(msg.mediaUrl, SOCKET_SERVER_URL);
                     const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                     const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                     const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                     const msgKey = String(msg.id || msg.timestamp);
                     groupDecryptedMediaUrls.current[msgKey] = objectUrl;
                     
                     const msgKeys = [String(msg.id || ''), String(msg.tempId || ''), String(msg.timestamp || '')].filter(Boolean);
                     msgKeys.forEach(k => { groupDecryptedMediaUrls.current[k] = objectUrl; });

                     decryptedText = '';
                     // Leave displayMediaUrl as the original permanent file URL (its initial
                     // value from msg.mediaUrl above) — do NOT overwrite it with the blob:
                     // object URL. Rendering reads the decrypted blob from
                     // groupDecryptedMediaUrls above instead; mediaUrl must stay the real,
                     // fetchable URL so forwarding (which reuses it as-is for already-
                     // encrypted media) never picks up a tab-local blob: reference that's
                     // meaningless to anyone else, including the sender after a reload.
                   } catch (e) {
                     console.warn('[E2EE] Group messages media decrypt failed:', e);
                     // Local preview decrypt/fetch failed (e.g. network hiccup) — the media
                     // key itself was already recovered successfully above, so the real
                     // mediaUrl is still valid and forwardable; only the inline preview
                     // failed. Leave displayMediaUrl untouched (still the real URL).
                   }
                 } else {
                   decryptedText = plain;
                 }
               } else if (msg.edited && !(msg.mediaUrl && msg.mediaUrl.length > 50)) {
                 // Decrypt failed for a message that was edited — most likely one of the
                 // rows corrupted by the pre-fix editGroupMessage bug (plaintext resent,
                 // paired server-side with the OLD nonce/keys). Unrecoverable; say so
                 // distinctly instead of falling through to the generic "Encrypted message".
                 decryptedText = CORRUPTED_EDIT_PLACEHOLDER;
               }
            }
          } catch (e2eeErr) {
            console.warn('[E2EE] Group messages decrypt failed:', e2eeErr);
          }
          if (msg.mediaUrl && msg.mediaUrl.length > 50 && !decryptedText && decryptedText !== '') {
            displayMediaUrl = null;
          }
        } else {
          // No e2ee metadata — predates client-side group E2EE (the old server-side-only
          // scheme). No dual-format decrypt support: show a placeholder instead of the raw
          // (already server-decrypted) plaintext. If server-side decryption itself failed,
          // msg.message keeps the encv1: prefix — treat those as unreadable too. Media was
          // never part of the old scheme (files were always stored unencrypted), so it
          // keeps rendering normally.
          const rawMsg = msg.message || '';
          if (rawMsg.startsWith('encv1:')) {
            decryptedText = null;
          } else if (msg.mediaUrl) {
            decryptedText = '';
          } else {
            decryptedText = LEGACY_GROUP_TEXT_PLACEHOLDER;
          }
        }

        return {
          ...msg,
          mediaUrl: displayMediaUrl,
          isMe: isMine,
          reactions: safeReactions,
          decryptedText: decryptedText !== null ? decryptedText : (msg.decryptedText !== undefined ? msg.decryptedText : null)
        };
      } catch (itemErr) {
        console.warn('[decryptRoomGroupMessages] item process error:', itemErr);
        const isMine = (msg.username && msg.username.toLowerCase() === username?.toLowerCase()) || (msg.senderName && msg.senderName.toLowerCase() === username?.toLowerCase());
        return { ...msg, isMe: isMine, reactions: {} };
      }
    }));
    
    try {
      return resolveReplyMessages(processed);
    } catch {
      return processed;
    }
  };

  const decryptDmMessages = async (msgs) => {
    const kp = myKeyPair.current;
    const processed = await Promise.all(msgs.map(async (msg) => {
      let decryptedText = null;
      let decryptedMediaUrl = msg.mediaUrl;
      let _encryptedOwn = false;
      
      if (msg.nonce && kp) {
        if (msg.isMe) {
          if (msg.senderMessage) {
            const plain = decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(kp.secretKey));
            if (plain) {
              if (msg.mediaType && msg.mediaUrl) {
                decryptedText = '';
                decryptedMediaUrl = null;
                const msgKey = msg.id || String(msg.timestamp);
                const targetMediaUrl = msg.mediaUrl;
                const targetMediaType = msg.mediaType;
                try {
                  const mediaKeyBytes = robustDecode(plain);
                  const resolvedUrl = resolveMediaUrl(targetMediaUrl, SOCKET_SERVER_URL);
                  const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                  const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                  const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                  dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                  setDmMediaUrlVersion(v => v + 1);
                } catch (e) { console.warn('[E2EE] DM messages decrypt file error:', e); }
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
          const plain = decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, encodeBase64(kp.secretKey));
          if (plain) {
            if (msg.mediaType && msg.mediaUrl) {
              decryptedText = '';
              decryptedMediaUrl = null;
              const msgKey = msg.id || String(msg.timestamp);
              const targetMediaUrl = msg.mediaUrl;
              const targetMediaType = msg.mediaType;
              try {
                const mediaKeyBytes = robustDecode(plain);
                const resolvedUrl = resolveMediaUrl(targetMediaUrl, SOCKET_SERVER_URL);
                const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                setDmMediaUrlVersion(v => v + 1);
              } catch (e) { console.warn('[E2EE] DM messages decrypt file error:', e); }
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
      return { ...msg, decryptedText, mediaUrl: decryptedMediaUrl, _encryptedOwn };
    }));

    try {
      return resolveReplyMessages(processed);
    } catch {
      return processed;
    }
  };

  const loadMoreGroupHistory = async (scrollEl) => {
    const state = paginationStateRef.current.group;
    if (state.isLoading || !state.hasMore || !roomId) return;

    if (groupMessages.length === 0) return;
    const oldestMsg = groupMessages[0];
    const cursor = oldestMsg.timestamp;

    state.isLoading = true;
    setGroupHistoryLoading(true);

    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;

    const limit = 200;
    const token = localStorage.getItem('watch_token');

    if (token) {
      try {
        const res = await fetch(`${SOCKET_SERVER_URL}/api/chats/history?type=room&partner=${encodeURIComponent(roomId)}&before=${cursor}&limit=${limit}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          state.isLoading = false;
          setGroupHistoryLoading(false);
          return;
        }
        const msgs = await res.json();
        const fetched = Array.isArray(msgs) ? msgs : [];

        if (fetched.length === 0) {
          state.hasMore = false;
          setHasMoreGroupHistory(false);
          state.isLoading = false;
          setGroupHistoryLoading(false);
          return;
        }

        const processed = await decryptRoomGroupMessages(fetched);

        setGroupMessages(prev => {
          return mergeHistoryBatch(prev, processed);
        });

        if (fetched.length < limit) {
          state.hasMore = false;
          setHasMoreGroupHistory(false);
        }

        // Scroll restoration is handled synchronously in useLayoutEffect in RoomChatPanel.jsx
      } catch (err) {
        console.error('[loadMoreGroupHistory] Error:', err);
      } finally {
        state.isLoading = false;
        setGroupHistoryLoading(false);
      }
    } else {
      groupScrollElRef.current = scrollEl;
      groupScrollPosRef.current = { prevScrollHeight, prevScrollTop };
      socket.emit('chat:request_history', { roomId, before: cursor, limit });
    }
  };

  const loadMoreDmHistory = async (scrollEl) => {
    if (!dmTarget) return;
    const partnerKey = dmTarget.toLowerCase();
    
    if (!paginationStateRef.current[partnerKey]) {
      paginationStateRef.current[partnerKey] = {
        hasMore: true,
        isLoading: false
      };
    }
    
    const state = paginationStateRef.current[partnerKey];
    if (state.isLoading || !state.hasMore) return;

    const thread = dmThreads[partnerKey] || [];
    if (thread.length === 0) return;

    const cursor = thread[0].timestamp;
    state.isLoading = true;
    setDmHistoryLoading(true);

    const prevScrollHeight = scrollEl.scrollHeight;
    const prevScrollTop = scrollEl.scrollTop;

    dmScrollElRef.current = scrollEl;
    dmScrollPosRef.current = { prevScrollHeight, prevScrollTop };

    const limit = 200;
    socket.emit('chat:request_history', { type: 'private', partner: dmTarget, before: cursor, limit });
  };



  useEffect(() => {
    chatTabRef.current = chatTab;
  }, [chatTab]);

  useEffect(() => {
    dmTargetRef.current = dmTarget;
  }, [dmTarget]);

  const handleTypingStatus = (data, isStarting) => {
    const { partner, username, type, roomId: payloadRoomId, isTyping } = data;
    const isActuallyStarting = isStarting && isTyping !== false;
    
    let chatKey = null;
    if (type === 'room') {
      chatKey = (partner || roomId || payloadRoomId || '').toLowerCase();
    } else if (type === 'private') {
      chatKey = (username || partner || '').toLowerCase();
    }
    
    if (!chatKey || !username) return;

    setTypingStatuses(prev => {
      const next = { ...prev };
      const currentList = next[chatKey] || [];
      if (isActuallyStarting) {
        if (!currentList.includes(username)) {
          next[chatKey] = [...currentList, username];
        }
      } else {
        next[chatKey] = currentList.filter(u => u !== username);
        if (next[chatKey].length === 0) {
          delete next[chatKey];
        }
      }
      return next;
    });

    if (isActuallyStarting) {
      setTimeout(() => {
        handleTypingStatus({ ...data, isTyping: false }, false);
      }, 5000);
    }
  };
  const groupMessagesRef = useRef([]);
  const dmInputRef = useRef(null);
  const groupInputRef = useRef(null);
  const groupMenuRef = useRef(null);
  const dmMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close emoji pickers & reaction bars on clicking outside
      const isEmojiPicker = e.target.closest('.emoji-picker-container') || e.target.closest('.emoji-picker-btn') || e.target.closest('.emoji-picker') || e.target.closest('[class*="emoji-picker"]') || e.target.closest('.input-emoji-picker-wrapper') || e.target.closest('.reaction-emoji-picker-wrapper');
      const isEmojiTrigger = e.target.closest('.emoji-btn-group') || e.target.closest('.emoji-btn-dm') || e.target.closest('.react-btn') || e.target.closest('.react-btn-container') || e.target.closest('.input-emoji-trigger') || e.target.closest('.reaction-smile-trigger') || e.target.closest('.reaction-plus-trigger');
      if (!isEmojiPicker && !isEmojiTrigger) {
        setShowGroupEmojiPicker(false);
        setShowDmEmojiPicker(false);
        setActiveReactionMsg(null);
        setShowAllEmojis(false);
      }

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
      const inMobUserPanelTrigger = mobUserPanelTriggerRef.current && mobUserPanelTriggerRef.current.contains(e.target);
      if (showUserPanel && userPanelRef.current && !userPanelRef.current.contains(e.target) && !inMobUserPanelTrigger) {
        setShowUserPanel(false);
      }
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false);
      }
      if (showRecentChats && chatWidgetRef.current && !chatWidgetRef.current.contains(e.target)) {
        // Lightbox is portalled to document.body — don't treat those clicks as "outside"
        const inLightbox = !!e.target.closest?.('.media-lightbox-overlay');
        const inReportModal = !!e.target.closest?.('.report-modal-overlay');
        if (!inNavArea && !inFsGlobalChatBtn && !inLightbox && !inReportModal) setShowRecentChats(false);
      }
      // Close room menus if clicking outside
      if (showGroupMenu && groupMenuRef.current && !groupMenuRef.current.contains(e.target)) {
        setShowGroupMenu(false);
      }
      if (showDmMenu && dmMenuRef.current && !dmMenuRef.current.contains(e.target)) {
        setShowDmMenu(null);
      }
      if ((modMenuTarget || showHeaderModMenu) && !e.target.closest('.mod-menu-container') && !e.target.closest('.mod-btn')) {
        setModMenuTarget(null);
        setShowHeaderModMenu(false);
      }
      // Close the camera three-dot menu if clicking outside it
      if (showCameraMenu && cameraMenuRef.current && !cameraMenuRef.current.contains(e.target)) {
        setShowCameraMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserPanel, showSettings, showRecentChats, showSearch, showNotifications, showGroupMenu, showDmMenu, activeReactionMsg, showAllEmojis, modMenuTarget, showHeaderModMenu, showGroupEmojiPicker, showDmEmojiPicker, showCameraMenu]);

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
        const serverCounts = {};
        let total = 0;
        data.forEach(chat => {
          const chatKey = (chat.id || chat.partner || '').toLowerCase();
          if (chat.unread && chat.unread > 0) {
            serverCounts[chatKey] = chat.unread;
            total += chat.unread;
          }
        });
        // Server is strict source of truth — overwrite local counts completely
        localStorage.setItem('chat_unread_counts', JSON.stringify(serverCounts));
        setUnreadCounts(serverCounts);
        setTotalUnread(total);
        // Restore groupUnread for current room from server data (fixes badge-gone-on-refresh)
        const currentRoomKey = (roomId || '').toLowerCase();
        if (currentRoomKey) {
          setGroupUnread(serverCounts[currentRoomKey] || 0);
        }
        // Sync GCW conversation list badges to match server counts exactly
        chatWidgetRef?.current?.syncUnreadFromServer?.(serverCounts);
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
    if (showRecentChats && chatWidgetRef.current?.activeChat?.partner === partner) return;

    // Play notification sound (only place audio plays in Room.jsx for incoming messages)
    const myUsername = localStorage.getItem('watch_username') || '';
    let isMuted = false;
    try {
      const m = JSON.parse(localStorage.getItem(`muted_chats_${myUsername}`) || '[]');
      if (m.some(u => u.toLowerCase() === partner.toLowerCase())) isMuted = true;
    } catch {}
    if (!isMuted) {
      try {
        const soundMutedGlobal = localStorage.getItem(`mute_notif_sounds_${myUsername}`) === 'true';
        if (!soundMutedGlobal) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(()=>{});
        }
      } catch(e){}
    }

    // Room.jsx's own socket already counts:
    //   (1) current room's group messages (via new_chat_message handler)
    //   (2) all incoming DMs (via private_message handler)
    // Only update counts here for cross-room group messages that Room.jsx's socket never sees.
    const isGroupMsg = msg?.type === 'group' || msg?.type === 'room' || !!msg?.roomId;
    const isCurrentRoom = isGroupMsg && partner.toLowerCase() === roomId.toLowerCase();
    if (!isGroupMsg || isCurrentRoom) return; // already counted by Room.jsx socket

    // Cross-room group message: only GCW's socket sees it, so count it here
    const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
    localCounts[partner] = (localCounts[partner] || 0) + 1;
    localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    setUnreadCounts(prev => ({ ...prev, [partner]: (prev[partner] || 0) + 1 }));
    setTotalUnread(prev => prev + 1);
  }, [roomId, showRecentChats]);


  const handleMarkRead = useCallback((chatId) => {
    const chatKey = (chatId || '').toLowerCase();
    const lastSeen = (() => { try { return JSON.parse(localStorage.getItem('chat_last_seen') || '{}'); } catch { return {}; } })();
    // Always write lastSeen under the lowercase key for case-consistent polling
    lastSeen[chatKey] = Date.now();
    localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));

    setUnreadCounts(prev => {
      const currentUnread = prev[chatId] || prev[chatKey] || 0;
      if (currentUnread > 0) {
        setTotalUnread(t => Math.max(0, t - currentUnread));
      }
      const next = { ...prev };
      delete next[chatId];
      delete next[chatKey];
      return next;
    });

    try {
      const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      delete localCounts[chatId];
      delete localCounts[chatKey];
      localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
    } catch(e) {}

    if (chatId === roomId || chatKey === (roomId || '').toLowerCase()) {
      setGroupUnread(0);
      try {
        const groupUnreadStore = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
        delete groupUnreadStore[chatKey];
        localStorage.setItem('chat_group_unread', JSON.stringify(groupUnreadStore));
      } catch {}
    }

    // Sync GCW's internal conversation list badge
    chatWidgetRef.current?.markReadFor?.(chatKey);
    // Note: checkUnread polling (every 5s) will reconcile totalUnread with the server.
  }, [roomId]);

  // Called by GlobalChatWidget or RoomChatPanel when "Mark all as read" is clicked
  const handleMarkAllRead = useCallback(() => {
    // Atomically clear all unread state
    setUnreadCounts({});
    setTotalUnread(0);
    setGroupUnread(0);
    setDmUnread({});
    if (dmUnreadRef.current) dmUnreadRef.current = {};

    // Also sync GCW's own conversation list badges
    chatWidgetRef.current?.markAllRead?.();

    // Clear all localStorage unread keys
    try {
      const now = Date.now();
      // Update chat_last_seen for all known entries
      const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
      const counts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
      Object.keys(counts).forEach(k => { lastSeen[k] = now; });
      localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
      localStorage.setItem('chat_unread_counts', '{}');
      localStorage.setItem('chat_group_unread', '{}');
    } catch {}

    if (socket) {
      const chatIds = Object.keys(unreadCounts);
      socket.emit('chat:mark_all_read', { chatIds });
    }
  }, [socket, unreadCounts]);

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
  const localVideoRef = useRef(null); // <video> element for local stream playback
  const appWindowRef = useRef(null);
  const lastExternalUpdate = useRef(0);
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const [isScreensharing, setIsScreensharing] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoQuality, setVideoQuality] = useState(() => localStorage.getItem('preferred_quality') || '720p');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const qualityMenuRef = useRef(null);
  // Mobile quality dropdown is portaled to document.body (see render below) so it
  // can't get clipped by the mobile-fullscreen rotate-trick container's overflow:hidden,
  // or pushed off the actual viewport — qualityDropdownPortalRef lets the click-outside
  // handler recognize clicks landing in the portaled content as "inside" too.
  const qualityBtnRef = useRef(null);
  const qualityDropdownPortalRef = useRef(null);
  const [qualityDropdownPos, setQualityDropdownPos] = useState(null);
  // Same portal treatment for the CC/subtitles dropdown — it was still using the old
  // clipped-anchor positioning, which made it unreachable (or appear to just not open)
  // inside the mobile-fullscreen rotate-trick container.
  const subtitleBtnRef = useRef(null);
  const subtitleDropdownPortalRef = useRef(null);
  const [subtitleDropdownPos, setSubtitleDropdownPos] = useState(null);

  const userCount = userList.length;

  const [isCamOn, setIsCamOn] = useState(false);
  const isCamOnRef = useRef(false);
  const [isMicOnCam, setIsMicOnCam] = useState(false);
  const isMicOnCamRef = useRef(false);
  useEffect(() => { isMicOnCamRef.current = isMicOnCam; }, [isMicOnCam]);
  const [camPage, setCamPage] = useState(0);
  const localCamRef = useRef(null);
  const cameraPcRefs = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});
  // Kept in sync every render so the socket-effect (which only mounts once) can always
  // call the LATEST toggleCamera/toggleMic instead of a stale mount-time closure.
  const toggleCameraRef = useRef(null);
  const toggleMicRef = useRef(null);

  // hasVideo (camera tile video-vs-avatar gate, computed on every render from
  // track.enabled/muted/readyState) is a snapshot — it doesn't automatically
  // re-evaluate when a track's muted state flips after the fact. A freshly
  // captured/received video track can briefly report muted:true before its
  // first frame decodes, then fire 'unmute' once real frames start; without
  // listening for that event nothing forces React to re-render, so the tile
  // can get stuck showing the avatar forever even after frames are flowing.
  // videoTrackTick exists purely to force that re-render on mute/unmute.
  const [videoTrackTick, setVideoTrackTick] = useState(0);
  useEffect(() => {
    const tracks = [];
    if (localCamRef.current) tracks.push(...localCamRef.current.getVideoTracks());
    Object.values(remoteStreams).forEach(({ stream }) => {
      if (stream) tracks.push(...stream.getVideoTracks());
    });
    if (tracks.length === 0) return;

    const bump = () => setVideoTrackTick(t => t + 1);
    const localVideoTrackIds = new Set((localCamRef.current?.getVideoTracks() || []).map(t => t.id));
    tracks.forEach(t => {
      const isLocal = localVideoTrackIds.has(t.id);
      // TEMP DEBUG — camera visibility re-investigation, remove after diagnosis.
      console.log('[CAM DEBUG] attaching onmute/onunmute listener', {
        isLocal, trackId: t.id, label: t.label,
        mutedAtAttach: t.muted, enabledAtAttach: t.enabled, readyStateAtAttach: t.readyState
      });
      t.onmute = () => {
        console.log('[CAM DEBUG] onmute FIRED', { isLocal, trackId: t.id, label: t.label });
        bump();
      };
      t.onunmute = () => {
        console.log('[CAM DEBUG] onunmute FIRED', { isLocal, trackId: t.id, label: t.label });
        bump();
      };
    });
    // A track may have already unmuted before this effect ran (e.g. frames
    // started decoding between getUserMedia resolving and this effect
    // mounting) — bump once now so that case self-corrects immediately
    // instead of waiting for some unrelated future re-render.
    bump();

    return () => {
      tracks.forEach(t => { t.onmute = null; t.onunmute = null; });
    };
  }, [isCamOn, remoteStreams]);

  // Auto-switch right panel to "cameras" tab when managed layout activates.
  // Reactive to isCamOn so the host's own camera toggle immediately updates the layout.
  useEffect(() => {
    const activeCamCount = (isCamOn ? 1 : 0) + Object.keys(remoteStreams).length;
    if (activeCamCount > CAMERA_MANAGED_LAYOUT_THRESHOLD) {
      setRightPanelTab('cameras');
    }
  }, [remoteStreams, isCamOn]);

  const [hideCustomControls, setHideCustomControls] = useState(false);

  const isWebIframe = (url) => {
    if (!url) return false;
    if (url.includes('/api/stream/') || url.startsWith('blob:')) return false; // local streams bypass iframe check
    // Any URL ReactPlayer can't embed is opened as a browser iframe
    return !ReactPlayer.canPlay(url);
  };
  const isLocalStream = mediaUrl?.includes('/api/stream/') || mediaUrl?.startsWith('blob:');
  const effectiveIsPreparing = (isLocalStream || mediaUrl?.includes('twitch.tv') || (mediaUrl?.includes('vimeo.com') && !useCustomVimeoControls)) ? false : isPreparing;

  // Track previous tab/target values to distinguish user-driven tab switches
  // from dep-change re-renders (socket init, roomId mount) — don't clear
  // unread on initial mount, only when user actively opens a chat.
  const prevChatTabForReadRef = useRef(chatTab);   // init to same default as useState
  const prevDmTargetForReadRef = useRef(dmTarget); // init to same default as useState

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setActiveReactionMsg(null);
    setShowAllEmojis(false);

    const chatTabChanged = chatTab !== prevChatTabForReadRef.current;
    const dmTargetChanged = dmTarget !== prevDmTargetForReadRef.current;
    prevChatTabForReadRef.current = chatTab;
    prevDmTargetForReadRef.current = dmTarget;

    // Only mark as read when the user actively navigated to a tab / DM.
    // Suppress on: initial mount, socket reconnect, roomId set — those
    // don't represent user intent to "read" a chat.
    if (!chatTabChanged && !dmTargetChanged) return;

    if (chatTab === 'dm' && dmTarget) {
      const dmKey = dmTarget.toLowerCase();
      setReactionPreviews(prev => { const next = { ...prev }; delete next[dmKey]; return next; });
      clearPersistedReactionPreview(dmKey);
      setDmUnread(prev => {
        const next = { ...prev };
        delete next[dmKey];
        return next;
      });
      if (dmUnreadRef.current) {
        dmUnreadRef.current[dmKey] = 0;
      }
      // Clear from unreadCounts (source of truth for totalUnread / chat button badge)
      setUnreadCounts(prev => {
        const next = { ...prev };
        const removedCount = next[dmKey] || next[dmTarget] || 0;
        if (removedCount > 0) setTotalUnread(t => Math.max(0, t - removedCount));
        delete next[dmKey];
        delete next[dmTarget];
        return next;
      });
      try {
        const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
        lastSeen[dmKey] = Date.now();
        localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        delete localCounts[dmKey];
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
      } catch { }
      if (socket) socket.emit('chat:mark_read', { chatId: dmKey, timestamp: Date.now(), isDm: true, userRead: true });
      // Sync GCW list badge immediately (socket echo won't reach same tab)
      chatWidgetRef.current?.markReadFor?.(dmKey);
    } else if (chatTab === 'group') {
      const roomKey = (roomId || '').toLowerCase();
      setReactionPreviews(prev => { const next = { ...prev }; delete next[roomKey]; return next; });
      clearPersistedReactionPreview(roomKey);
      setGroupUnread(0);
      // Clear from unreadCounts (source of truth for totalUnread / chat button badge)
      setUnreadCounts(prev => {
        const next = { ...prev };
        const removedCount = next[roomKey] || next[roomId] || 0;
        if (removedCount > 0) setTotalUnread(t => Math.max(0, t - removedCount));
        delete next[roomKey];
        delete next[roomId];
        return next;
      });
      try {
        const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
        lastSeen[roomKey] = Date.now();
        localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
        // Clear the persisted group unread for this room
        const groupUnreadStore = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
        delete groupUnreadStore[roomKey];
        delete groupUnreadStore[roomId];
        localStorage.setItem('chat_group_unread', JSON.stringify(groupUnreadStore));
        const localCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
        delete localCounts[roomKey];
        delete localCounts[roomId];
        localStorage.setItem('chat_unread_counts', JSON.stringify(localCounts));
      } catch { }
      // Also emit mark_read to sync across all tabs and devices
      if (socket) socket.emit('chat:mark_read', { chatId: roomKey, timestamp: Date.now(), isDm: false, userRead: true });
      // Sync GCW list badge immediately (socket echo won't reach same tab)
      chatWidgetRef.current?.markReadFor?.(roomKey);
    }
  }, [chatTab, dmTarget, roomId, socket]);

  useEffect(() => {
    setHideCustomControls(false);
  }, [mediaUrl]);

  // Synchronize groupMessages to sessionStorage (for guest bridge) and watch_recent_chats in localStorage
  // for ALL users (so GlobalChatWidget and navigation drawers update previews seamlessly).
  useEffect(() => {
    if (!roomId || !groupMessages.length) return;
    const rid = roomId.toLowerCase();
    try {
      const isGuest = localStorage.getItem('watch_is_guest') === 'true';
      if (isGuest) {
        sessionStorage.setItem(`guest_room_messages_${rid}`, JSON.stringify(groupMessages));
        sessionStorage.setItem(`guest_room_has_more_${rid}`, String(hasMoreGroupHistory));
        window.dispatchEvent(new CustomEvent('guest_room_messages_updated', { detail: { roomId: rid } }));
      }
      const cached = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
      const lastMsg = groupMessages[groupMessages.length - 1];
      const _mt = lastMsg?.mediaType;
      const mediaLabel = _mt ? (_mt.startsWith('video') ? 'Video' : _mt.startsWith('image') ? 'Photo' : _mt.startsWith('audio') ? 'Voice Note' : 'File') : null;
      const preview = mediaLabel || lastMsg?.decryptedText || (lastMsg?.message && !lastMsg.message.startsWith('🔒') ? lastMsg.message : (lastMsg?.mediaUrl ? 'File' : ''));
      const lastSender = lastMsg?.senderName || lastMsg?.username || '';
      const isMyLast = lastMsg?.isMe || (lastSender && username && lastSender.toLowerCase() === username.toLowerCase());

      const seen = new Set();
      const deduped = cached.filter(c => {
        const k = `${c.type}:${(c.partner || c.id || '').toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      let found = false;
      const updatedCache = deduped.map(c => {
        if (c.type === 'room' && (c.partner || c.id || '').toLowerCase() === rid) {
          found = true;
          return { 
            ...c, 
            message: preview, 
            decryptedText: lastMsg?.decryptedText || mediaLabel || null,
            lastTimestamp: lastMsg?.timestamp || c.lastTimestamp,
            lastSenderName: lastSender,
            isMyLastMessage: isMyLast,
            lastMediaType: _mt || null,
            mediaType: _mt || null,
            lastMediaFileName: lastMsg?.mediaFileName || lastMsg?._fileName || null,
            mediaFileName: lastMsg?.mediaFileName || lastMsg?._fileName || null,
            lastMediaDuration: lastMsg?.mediaDuration || null,
            mediaDuration: lastMsg?.mediaDuration || null
          };
        }
        return c;
      });
      if (!found && roomName) {
        updatedCache.unshift({
          type: 'room',
          id: rid,
          partner: rid,
          displayName: roomName,
          partnerAvatar: room?.thumbnailPath || null,
          message: preview,
          decryptedText: lastMsg?.decryptedText || mediaLabel || null,
          lastTimestamp: lastMsg?.timestamp || Date.now(),
          lastSenderName: lastSender,
          isMyLastMessage: isMyLast,
          unread: 0
        });
      }
      localStorage.setItem('watch_recent_chats', JSON.stringify(updatedCache));
      window.dispatchEvent(new Event('conversations_updated'));
    } catch (e) {}
  }, [groupMessages, roomId, username, roomName, room?.thumbnailPath]);

  // Synchronize DM threads to watch_recent_chats in localStorage whenever DM messages update in Room view
  useEffect(() => {
    if (!dmThreads || !Object.keys(dmThreads).length) return;
    try {
      const cached = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
      let updatedCache = [...cached];
      let changed = false;

      Object.entries(dmThreads).forEach(([partnerKey, msgs]) => {
        if (!Array.isArray(msgs) || msgs.length === 0) return;
        const lastMsg = msgs[msgs.length - 1];
        const _mt = lastMsg?.mediaType;
        const mediaLabel = _mt ? (_mt.startsWith('video') ? 'Video' : _mt.startsWith('image') ? 'Photo' : _mt.startsWith('audio') ? 'Voice Note' : 'File') : null;
        const preview = mediaLabel || lastMsg?.decryptedText || (lastMsg?.message && !lastMsg.message.startsWith('🔒') ? lastMsg.message : (lastMsg?.mediaUrl ? 'File' : ''));
        const lastSender = lastMsg?.senderName || lastMsg?.username || '';
        const isMyLast = lastMsg?.isMe || (lastSender && username && lastSender.toLowerCase() === username.toLowerCase());

        const idx = updatedCache.findIndex(c => c.type === 'private' && (c.partner || c.id || '').toLowerCase() === partnerKey.toLowerCase());
        if (idx !== -1) {
          updatedCache[idx] = {
            ...updatedCache[idx],
            message: preview,
            decryptedText: lastMsg?.decryptedText || mediaLabel || null,
            lastTimestamp: lastMsg?.timestamp || updatedCache[idx].lastTimestamp,
            lastSenderName: lastSender,
            isMyLastMessage: isMyLast,
            lastMediaType: _mt || null,
            mediaType: _mt || null,
            lastMediaFileName: lastMsg?.mediaFileName || lastMsg?._fileName || null,
            mediaFileName: lastMsg?.mediaFileName || lastMsg?._fileName || null,
            lastMediaDuration: lastMsg?.mediaDuration || null,
            mediaDuration: lastMsg?.mediaDuration || null
          };
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem('watch_recent_chats', JSON.stringify(updatedCache));
        window.dispatchEvent(new Event('conversations_updated'));
      }
    } catch (e) {}
  }, [dmThreads, username]);

  // Stale scroll effects commented out: RoomChatPanel.jsx now manages all scroll restoration and scrolling behaviors.
  /*
  const prevGroupLen = useRef(groupMessages.length);
  const prevDmLen = useRef(dmTarget ? (dmThreads[dmTarget.toLowerCase()]?.length || 0) : 0);
  const prevDmTarget = useRef(dmTarget);

  useLayoutEffect(() => {
    const dmLen = dmTarget ? (dmThreads[dmTarget.toLowerCase()]?.length || 0) : 0;
    if (groupMessages.length > prevGroupLen.current || dmLen > prevDmLen.current || dmTarget !== prevDmTarget.current) {
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
    prevGroupLen.current = groupMessages.length;
    prevDmLen.current = dmLen;
    prevDmTarget.current = dmTarget;
  }, [groupMessages.length, dmTarget ? dmThreads[dmTarget.toLowerCase()]?.length : 0, dmTarget]);

  useLayoutEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [chatTab]);
  */


  useEffect(() => {
    if (!videoRef.current) return;
    if (isViewer && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(() => {
        // Retry muted if autoplay is blocked
        videoRef.current.muted = true;
        videoRef.current.play().catch(console.error);
      });
    } else if (isScreensharing && localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
      videoRef.current.muted = true; // sharer sees their own share muted to avoid feedback
      videoRef.current.play().catch(console.error);
    } else {
      // Clear screenshare/remote stream when neither is active
      if (!videoRef.current.srcObject?.active) {
        videoRef.current.srcObject = null;
      }
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
              Enjoy watching together with friends!
            </div>
          </div>
        ), { duration: 6000, icon: '👋' });
      }
    }
  }, [room, isWaitingApproval, roomNotFound, kickedReason, roomId]);

  const handleSelectTheme = (themeId) => {
    if (isEffectiveHost) {
      // Host: change for everyone — DB write + broadcast
      themeChangeInFlightRef.current = true;
      setRoomTheme(themeId);
      socket?.emit('change_room_theme', { roomId, themeId });
      setTimeout(() => { themeChangeInFlightRef.current = false; }, 2000);
    } else {
      // Non-host: personal override only — localStorage, no socket
      localStorage.setItem(`wt-personal-theme-${roomId}`, themeId);
      setRoomTheme(themeId);
    }
    setShowCustomizeModal(false);
  };

  const handleClearPersonalTheme = useCallback(() => {
    localStorage.removeItem(`wt-personal-theme-${roomId}`);
    setRoomTheme(room?.roomTheme || 'default');
  }, [roomId, room]);

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
      if (chatTabRef.current === 'dm' && dmTargetRef.current) {
        sock.emit('chat:mark_read', { chatId: dmTargetRef.current.toLowerCase(), timestamp: Date.now(), isDm: true, userRead: true });
      } else if (chatTabRef.current === 'group') {
        sock.emit('chat:mark_read', { chatId: roomId, timestamp: Date.now(), isDm: false, userRead: true });
      }
    });

    sock.on('disconnect', (reason) => console.log('[SOCKET] Disconnected:', reason));
    sock.on('connect_error', err => console.error('[SOCKET] Connection error:', err));

    // ─── Hyperbeam cloud browser sync (non-host clients follow host) ───
    sock.on('hyperbeam_opened', ({ session_id, embed_url, targetUrl }) => {
      if (targetUrl) hyperbeamTargetUrlRef.current = targetUrl;
      setHbNavStatus('connecting');
      setHyperbeamSession({ session_id, embed_url });
      setHbSessionId(session_id);
      setLoadFailed(false);
      setIsLaunchingVirtualBrowser(false);
    });
    sock.on('hyperbeam_closed', () => {
      setHyperbeamSession(null);
      setHbSessionId(null);
      setLoadFailed(false);
      setHbNavStatus(null);
      setIsLaunchingVirtualBrowser(false);
    });

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



    sock.on('room_renamed', name => {
      setRoomName(name);
      syncRecentChat({ roomName: name });
    });
    sock.on('dm_cleared', ({ userA, userB, clearedBy, clearForBoth }) => {
      if (!clearForBoth && (username || '').toLowerCase() !== (clearedBy || '').toLowerCase()) return;
      const otherUser = (userA || '').toLowerCase() === (username || '').toLowerCase() ? userB : userA;
      const otherUserLow = otherUser.toLowerCase();
      setDmThreads(prev => {
        const thread = prev[otherUserLow] || [];
        const lastMsg = thread[thread.length - 1];
        if (lastMsg) {
          const ts = Number(lastMsg.timestamp || lastMsg.createdAt || 0);
          if (ts > 0) dmClearedTsRef.current = { ...dmClearedTsRef.current, [otherUserLow]: ts };
        }
        return { ...prev, [otherUserLow]: [] };
      });
    });

    sock.on('room_chat_cleared', ({ roomId: targetRoomId }) => {
      if (roomId === targetRoomId) {
        setGroupMessages([]);
        try {
          const cached = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
          const cleaned = cached.map(c =>
            (c.type === 'room' && (c.partner || '').toLowerCase() === (targetRoomId || '').toLowerCase())
              ? { ...c, message: '', decryptedText: '', mediaType: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0 }
              : c
          );
          localStorage.setItem('watch_recent_chats', JSON.stringify(cleaned));
        } catch {}
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
        // Guests: fetchConversations skips (no token), so the room is never seeded into
        // watch_recent_chats from the API. Insert it here on first join so the
        // Conversations panel shows the room chat for guests too.
        const alreadyExists = cached.some(c => c.type === 'room' && c.partner?.toLowerCase() === rid);
        if (!alreadyExists && localStorage.getItem('watch_is_guest') === 'true') {
          updated.push({ type: 'room', id: rid, partner: rid, displayName: data.roomName || rid, partnerAvatar: data.thumbnailPath || null, message: '', unread: 0, lastTimestamp: Date.now() });
          changed = true;
        }
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
      if (!themeChangeInFlightRef.current) {
        const hostTheme = state.roomTheme || 'default';
        const personalTheme = localStorage.getItem(`wt-personal-theme-${roomId}`);
        setRoomTheme(personalTheme || hostTheme);
      }
      if (state.roomName) setRoomName(state.roomName);
      if (state.currentMedia) {
        setMediaUrl(state.currentMedia);
        const joinedItem = OPTIONS.find(o => o.url === state.currentMedia || (o.url && (state.currentMedia.includes(o.url) || o.url.includes(state.currentMedia))));
        setIsVirtualBrowserMedia(joinedItem?.type === 'placeholder');
        // Set seek target SYNCHRONOUSLY so onLoadedMetadata can seek immediately
        // (the 500ms timeout below runs after onLoadedMetadata fires, so it was too late)
        if (state.currentTime > 0) prepTargetTimeRef.current = state.currentTime;
      }
      if (state.streamPending) {
        setStreamPending(state.streamPending);
      } else {
        setStreamPending(null);
      }
      if (state.subtitles) {
        setSubtitleVttText(state.subtitles);
        setSubtitlesUrl(oldUrl => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          const blob = new Blob([state.subtitles], { type: 'text/vtt' });
          return URL.createObjectURL(blob);
        });
        setSubtitlesVisible(true);
      } else {
        setSubtitleVttText(null);
        setSubtitlesUrl(oldUrl => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return null;
        });
      }
      if (state.isPublic !== undefined) setIsPublic(state.isPublic);
      if (state.activeExternalApp) setActiveExternalApp(state.activeExternalApp);
      
      
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
        lastExternalUpdate.current = Date.now() + 3000;
        if (playerRef.current && state.currentTime > 0) playerRef.current.seekTo(state.currentTime, 'seconds');
        if (localVideoRef.current && state.currentTime > 0) localVideoRef.current.currentTime = state.currentTime;
        setIsPlaying(state.isPlaying);
      }, 500);
    });

    sock.on('room_theme_changed', ({ themeId }) => {
      setRoomTheme(themeId || 'default');
      localStorage.removeItem(`wt-personal-theme-${roomId}`);
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

    // ── Group chat history: use HTTP fetch (same as GlobalChatWidget) for reliability ──
    // The socket 'chat_history' event acts as the trigger; actual data comes via HTTP.
    const loadGroupHistory = async () => {
      const token = localStorage.getItem('watch_token');
      if (!token || !roomId) return;
      try {
        const res = await fetch(`${SOCKET_SERVER_URL}/api/chats/history?type=room&partner=${encodeURIComponent(roomId)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const msgs = await res.json();
        if (!Array.isArray(msgs)) return;

        const resolvedMsgs = await decryptRoomGroupMessages(msgs);

        setGroupMessages(resolvedMsgs);
        groupMessagesRef.current = resolvedMsgs;
        setGroupMediaUrlVersion(v => v + 1);
        // Mark all loaded messages as seen (triggers seen receipts for the sender)
        sock.emit('chat:mark_read', { chatId: roomId, timestamp: Date.now(), isDm: false });
      } catch (err) {
        console.error('[chat_history] HTTP fetch failed:', err);
      } finally {
        setGroupHistoryReady(true);
      }
    };

    sock.on('chat_history', async (socketMsgs) => {
      const token = localStorage.getItem('watch_token');
      if (token) {
        // Authenticated users: use reliable HTTP fetch (same as GlobalChatWidget)
        loadGroupHistory();
      } else {
        // Guest users (no token): process socket payload directly with E2EE decrypt fallback

        // ── DIAGNOSTIC: identity + keypair stability ──────────────────────────
        const _diagUser = username;
        const _diagUserLs = localStorage.getItem('watch_username');
        const _diagKpKey = `wt_guest_kp_${(_diagUser || '').toLowerCase()}`;
        const _diagKpRaw = localStorage.getItem(_diagKpKey);
        const _diagKp = myKeyPair.current;
        console.group('[GUEST DEBUG] chat_history fired');
        console.log('[GUEST DEBUG] username (state):', _diagUser);
        console.log('[GUEST DEBUG] username (localStorage):', _diagUserLs);
        console.log('[GUEST DEBUG] keypair localStorage key:', _diagKpKey);
        console.log('[GUEST DEBUG] keypair found in localStorage:', !!_diagKpRaw);
        console.log('[GUEST DEBUG] myKeyPair.current ready:', !!_diagKp);
        console.log('[GUEST DEBUG] raw socketMsgs length:', Array.isArray(socketMsgs) ? socketMsgs.length : 'NOT AN ARRAY');
        console.groupEnd();
        // ─────────────────────────────────────────────────────────────────────

        if (!Array.isArray(socketMsgs) || socketMsgs.length === 0) { setGroupHistoryReady(true); return; }
        const processedMsgs = await Promise.all(socketMsgs.map(async (msg) => {
          const isMine = msg.isMe !== undefined ? msg.isMe
            : ((msg.username && msg.username.toLowerCase() === username.toLowerCase()) || (msg.senderName && msg.senderName.toLowerCase() === username.toLowerCase()));
          const safeReactions = (() => { try { return fixReactions(msg.reactions); } catch { return {}; } })();

          let decryptedText = null;
          const kp = myKeyPair.current;
          const myUserLower = username?.toLowerCase();

          if (msg.e2ee && msg.e2ee.keys && kp) {
            try {
              const myEncKey = msg.e2ee.keys[myUserLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myUserLower)?.[1];

              // ── DIAGNOSTIC: per-message decrypt attempt ───────────────────
              console.log(
                '[GUEST DEBUG] msg', msg.id, '|',
                'sender:', msg.senderName || msg.username, '|',
                'has e2ee.keys:', !!msg.e2ee?.keys, '|',
                'myEncKey found:', !!myEncKey, '|',
                'senderPublicKey:', msg.e2ee?.senderPublicKey ? msg.e2ee.senderPublicKey.slice(0, 12) + '…' : 'MISSING'
              );
              // ─────────────────────────────────────────────────────────────

              if (myEncKey) {
                const senderPubKey = decodeBase64(msg.e2ee.senderPublicKey);
                const plain = decryptGroupMessage(
                  msg.message,
                  msg.e2ee.nonce,
                  myEncKey,
                  senderPubKey,
                  kp.secretKey
                );

                // ── DIAGNOSTIC: decrypt result ────────────────────────────
                console.log('[GUEST DEBUG] msg', msg.id, '→ decrypt', plain !== null ? '✅ OK: ' + String(plain).slice(0, 30) : '❌ FAILED (null)');
                // ─────────────────────────────────────────────────────────

                if (plain !== null) {
                  if (msg.mediaUrl && msg.mediaUrl.length > 50) {
                    const mediaKeyB64 = plain;
                    const fileUrl = msg.mediaUrl;
                    const msgKeys = [
                      String(msg.id || ''),
                      String(msg.tempId || ''),
                      String(msg.timestamp || '')
                    ].filter(Boolean);

                    (async () => {
                      try {
                        const mediaKeyBytes = robustDecode(mediaKeyB64);
                        const resolvedUrl = resolveMediaUrl(fileUrl, SOCKET_SERVER_URL);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                        const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                        const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                        msgKeys.forEach(k => { groupDecryptedMediaUrls.current[k] = objectUrl; });
                        setGroupMediaUrlVersion(v => v + 1);
                      } catch (e) {
                        console.warn('[E2EE] Guest history media decrypt failed:', e);
                      }
                    })();
                  } else {
                    decryptedText = plain;
                  }
                }
              } else {
                // ── DIAGNOSTIC: no key found for this user ────────────────
                console.log('[GUEST DEBUG] msg', msg.id, '→ no key for user "' + myUserLower + '" in keys:', Object.keys(msg.e2ee?.keys || {}));
                // ─────────────────────────────────────────────────────────
              }
            } catch (err) {
              console.warn('[E2EE] Guest history decrypt error:', err);
            }
          } else {
            // ── DIAGNOSTIC: why decrypt was skipped ──────────────────────
            console.log(
              '[GUEST DEBUG] msg', msg.id, '→ decrypt SKIPPED:',
              !msg.e2ee ? 'no e2ee (plaintext or old message)' : !msg.e2ee.keys ? 'e2ee.keys missing' : !kp ? 'keypair not ready' : 'unknown'
            );
            // ─────────────────────────────────────────────────────────────
          }

          return { ...msg, isMe: isMine, reactions: safeReactions, decryptedText };
        }));
        const resolvedMsgs = (() => { try { return resolveReplyMessages(processedMsgs); } catch { return processedMsgs; } })();

        // ── DIAGNOSTIC: final summary ─────────────────────────────────────
        const _decOk  = resolvedMsgs.filter(m => m.decryptedText !== null).length;
        const _decFail = resolvedMsgs.filter(m => m.e2ee && m.decryptedText === null).length;
        const _plain  = resolvedMsgs.filter(m => !m.e2ee && m.decryptedText === null).length;
        console.log(`[GUEST DEBUG] SUMMARY: ${resolvedMsgs.length} total | ${_decOk} decrypted OK | ${_decFail} decrypt FAILED | ${_plain} plaintext (no e2ee)`);
        // ─────────────────────────────────────────────────────────────────

        setGroupMessages(resolvedMsgs);
        groupMessagesRef.current = resolvedMsgs;
        setGroupHistoryReady(true);
      }
    });

    sock.on('chat_history_more', async ({ roomId: respRoomId, messages: msgs, before }) => {
      if (respRoomId?.toLowerCase() !== roomId?.toLowerCase()) return;
      
      const state = paginationStateRef.current.group;
      if (!Array.isArray(msgs) || msgs.length === 0) {
        state.hasMore = false;
        setHasMoreGroupHistory(false);
        state.isLoading = false;
        setGroupHistoryLoading(false);
        return;
      }

      const processed = await decryptRoomGroupMessages(msgs);

      setGroupMessages(prev => {
        return mergeHistoryBatch(prev, processed);
      });

      if (msgs.length < 200) {
        state.hasMore = false;
        setHasMoreGroupHistory(false);
      }

      state.isLoading = false;
      setGroupHistoryLoading(false);

      // Scroll restoration is handled synchronously in useLayoutEffect in RoomChatPanel.jsx
    });

    sock.on('chat_history_more_dm', async ({ partner, messages: msgs, before }) => {
      const partnerKey = partner.toLowerCase();
      if (dmTargetRef.current?.toLowerCase() !== partnerKey) {
        if (paginationStateRef.current[partnerKey]) {
          paginationStateRef.current[partnerKey].isLoading = false;
        }
        setDmHistoryLoading(false);
        return;
      }

      if (!paginationStateRef.current[partnerKey]) {
        paginationStateRef.current[partnerKey] = {
          hasMore: true,
          isLoading: false
        };
      }
      const state = paginationStateRef.current[partnerKey];
      if (!Array.isArray(msgs) || msgs.length === 0) {
        state.hasMore = false;
        setHasMoreDmHistory(prev => ({ ...prev, [partnerKey]: false }));
        state.isLoading = false;
        setDmHistoryLoading(false);
        return;
      }

      const processed = await decryptDmMessages(msgs);

      setDmThreads(prev => {
        const existing = prev[partnerKey] || [];
        return {
          ...prev,
          [partnerKey]: mergeHistoryBatch(existing, processed)
        };
      });

      if (msgs.length < 200) {
        state.hasMore = false;
        setHasMoreDmHistory(prev => ({ ...prev, [partnerKey]: false }));
      }

      state.isLoading = false;
      setDmHistoryLoading(false);

      // Scroll restoration is handled synchronously in useLayoutEffect in RoomChatPanel.jsx
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
            const full = getAvatarUrl(u.avatarPath);
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
        const full = getAvatarUrl(avatarPath);
        setKnownAvatars(prev => ({ ...prev, [uname]: full }));
      }
      if (notifSettingsRef.current.app && notifSettingsRef.current.join && uname !== usernameRef.current && !muteRoomJoinLeaveRef.current) {
        toast.success(`${uname} joined`);
      }
    });
    sock.on('user_left', ({ username: uname }) => {
      if (notifSettingsRef.current.app && notifSettingsRef.current.leave && uname !== usernameRef.current && !muteRoomJoinLeaveRef.current) {
        toast(`${uname} left`, { icon: '👋' });
      }
    });
    sock.on('host_changed', ({ newHostName }) => {
      if (notifSettingsRef.current.app) {
        toast(`${newHostName} is now the host 👑`, { duration: 4000 });
      }
    });

    sock.on('chat_message', msg => {
      const isMine = msg.isMe !== undefined ? msg.isMe : ((msg.username && msg.username.toLowerCase() === username.toLowerCase()) || (msg.senderName && msg.senderName.toLowerCase() === username.toLowerCase()));

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
                // Store under ALL possible keys: socket id, tempId, timestamp.
                // The msg.id changes from socket-assigned ("socketId-ts") to real DB id
                // after persistence, so we must cover every key the renderer might use.
                const msgKeys = [
                  String(msg.id || ''),
                  String(msg.tempId || ''),
                  String(msg.timestamp || '')
                ].filter(Boolean);

                // Do not block rendering, do async decryption
                (async () => {
                  try {
                    const mediaKeyBytes = robustDecode(mediaKeyB64);
                    const resolvedUrl = resolveMediaUrl(fileUrl, SOCKET_SERVER_URL);
                    const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                    const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                    const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: msg.mediaType }));
                    // Store under all keys so lookup works regardless of id evolution
                    msgKeys.forEach(k => { groupDecryptedMediaUrls.current[k] = objectUrl; });
                    setGroupMediaUrlVersion(v => v + 1);
                    // Restore the real, permanent file URL onto the message now that the
                    // in-flight decrypt is done (rendering already switched to the cached
                    // blob above) — otherwise this message's mediaUrl stays null forever for
                    // a message received live, silently blocking forwarding it later even
                    // though the file is fully accessible. Only patch it in, never clear it.
                    setGroupMessages(prev => prev.map(m => msgKeys.includes(String(m.id)) || msgKeys.includes(String(m.tempId)) || msgKeys.includes(String(m.timestamp)) ? { ...m, mediaUrl: fileUrl } : m));
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
      } else {
        // Legacy message (predates client-side group E2EE) — see decryptRoomGroupMessages
        // for the full rationale. Live receives essentially never hit this once sending is
        // mandatory-encrypted, but kept as a safe fallback (e.g. a stale client mid-deploy).
        decryptedText = msg.mediaUrl ? '' : LEGACY_GROUP_TEXT_PLACEHOLDER;
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
            // Use the server-confirmed real mediaUrl (fixed.mediaUrl), not the sender's local
            // optimistic blob: preview (oldMsg.mediaUrl) — that blob is only valid in this tab
            // and must never be treated as a permanent, forwardable URL. The blob stays
            // available for fast local rendering via _localMediaUrl.
            next[optIdx] = { ...fixed, decryptedText: safeDecryptedText, mediaUrl: fixed.mediaUrl, _localMediaUrl: oldMsg._localMediaUrl || oldMsg.mediaUrl, _fileName: oldMsg._fileName || fixed.mediaFileName || null, _fileSize: oldMsg._fileSize || fixed.mediaFileSize || null, mediaDuration: fixed.mediaDuration || oldMsg.mediaDuration || null };
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

      const isViewingGroupChat = (isMobile || rightPanelTabRef.current === 'chat') && chatTabRef.current === 'group';
      if (!isViewingGroupChat && !isMine && !isMutedRoom) {
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
             const previewText = mediaPreview || (msg.message && looksLikeCiphertext(msg.message) ? 'Encrypted message' : truncateToFewWords(fixed.decryptedText || msg.message));
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
        sock.emit('chat:mark_read', { chatId: roomId, timestamp: msg.timestamp, isDm: false });
        // Also update local storage timestamp for refresh persistence
        try {
          const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
          lastSeen[roomId] = Date.now();
          localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
        } catch {}
      }
    });

    sock.on('chat:mark_read', ({ chatId, timestamp }) => {
      const chatKey = (chatId || '').toLowerCase();
      if (chatId === roomId) {
        setGroupUnread(0);
        setUnreadCounts(prev => {
          const removedCount = prev[chatId] || prev[chatKey] || 0;
          const next = { ...prev };
          delete next[chatId];
          delete next[chatKey];
          // Recalculate totalUnread accurately
          setTotalUnread(t => Math.max(0, t - removedCount));
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
          delete next[chatKey];
          if (dmUnreadRef.current) delete dmUnreadRef.current[chatKey];
          return next;
        });
        setUnreadCounts(prev => {
          const removedCount = prev[chatKey] || prev[chatId] || 0;
          const next = { ...prev };
          delete next[chatKey];
          delete next[chatId];
          // Recalculate totalUnread accurately
          setTotalUnread(t => Math.max(0, t - removedCount));
          return next;
        });
      }
    });

    sock.on('chat:mark_all_read', () => {
      setUnreadCounts({});
      setTotalUnread(0);
      setGroupUnread(0);
      setDmUnread({});
      if (dmUnreadRef.current) dmUnreadRef.current = {};
      try {
        localStorage.setItem('chat_unread_counts', '{}');
        localStorage.setItem('chat_group_unread', '{}');
      } catch {}
    });

    sock.on('chat:messages_seen', ({ roomId: eventRoomId, username: readerName, messageIds, seenAt, avatar }) => {
      if (eventRoomId === roomId) {
        setGroupMessages(prev => {
          const next = prev.map(m => {
            if (m.id && messageIds.some(id => String(id) === String(m.id))) {
              const seenBy = m.seenBy ? [...m.seenBy] : [];
              if (!seenBy.some(u => u.username.toLowerCase() === readerName.toLowerCase())) {
                seenBy.push({ username: readerName, seenAt, avatar });
              }
              return { ...m, seenBy };
            }
            return m;
          });
          groupMessagesRef.current = next;
          return next;
        });
      }

      if (eventRoomId.startsWith('dm-')) {
        // Parse partner from dm-roomId (e.g. "dm-alice-bob"). Usernames may contain hyphens,
        // so we try prefix splits until one half matches the current user (sorted alphabetically).
        const dmBody = eventRoomId.slice(3); // strip leading "dm-"
        const userLower = username.toLowerCase();
        let partner = null;
        const dmParts = dmBody.split('-');
        for (let i = 1; i < dmParts.length; i++) {
          const left = dmParts.slice(0, i).join('-');
          const right = dmParts.slice(i).join('-');
          if (left.toLowerCase() === userLower) { partner = right; break; }
          if (right.toLowerCase() === userLower) { partner = left; break; }
        }
        if (partner) {
          const partnerLower = partner.toLowerCase();
          setDmThreads(prev => {
            const next = { ...prev };
            if (next[partnerLower]) {
              next[partnerLower] = next[partnerLower].map(m => {
                if (m.id && messageIds.some(id => String(id) === String(m.id))) {
                  const seenBy = m.seenBy ? [...m.seenBy] : [];
                  if (!seenBy.some(u => u.username.toLowerCase() === readerName.toLowerCase())) {
                    seenBy.push({ username: readerName, seenAt, avatar });
                  }
                  return { ...m, seenBy };
                }
                return m;
              });
            }
            return next;
          });
        }
      }
    });

    sock.on('chat:private_reaction', ({ messageId, timestampId, senderName, emoji, targetName, reactions, originalSenderName }) => {
      // Notification: someone reacted to MY message in DM
      if (emoji && senderName && senderName.toLowerCase() !== (username || '').toLowerCase() &&
          originalSenderName && originalSenderName.toLowerCase() === (username || '').toLowerCase()) {
        const isViewingThisDm = chatTabRef.current === 'dm' && dmTargetRef.current &&
          dmTargetRef.current.toLowerCase() === senderName.toLowerCase();
        if (!isViewingThisDm) {
          toast(`${senderName} reacted ${emoji} to your message`, {
            id: `rxn-dm-${messageId}-${senderName}`,
            duration: 4000
          });
          // Increment DM unread badge
          const otherNameLower = senderName.toLowerCase();
          const storedCounts = (() => { try { return JSON.parse(localStorage.getItem('chat_unread_counts') || '{}'); } catch { return {}; } })();
          const newCount = Math.max(storedCounts[otherNameLower] || 0, dmUnreadRef.current[otherNameLower] || 0) + 1;
          dmUnreadRef.current[otherNameLower] = newCount;
          setDmUnread(prev => ({ ...prev, [otherNameLower]: newCount }));
          setTotalUnread(p => p + 1);
          // Update Room panel preview + push to GCW — persisted so it survives a refresh
          setReactionPreviews(prev => ({ ...prev, [otherNameLower]: `Reacted ${emoji} to your message` }));
          setPersistedReactionPreview(otherNameLower, `Reacted ${emoji} to your message`);
          chatWidgetRef.current?.updateConversationPreview?.(senderName, `Reacted ${emoji} to your message`, 'private');
        }
      }

      // If this is an echo of our own reaction (we already optimistically updated), let's still apply the server's definitive truth.
      const otherUser = (senderName || '').toLowerCase() === (username || '').toLowerCase() ? targetName : senderName;
      setDmThreads(prev => {
        const key = otherUser.toLowerCase();
        const thread = prev[key];
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
        return { ...prev, [key]: mapped };
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
      const isStarting = data.isTyping !== false;
      handleTypingStatus(data, isStarting);
      if (isStarting) {
        const uname = data.username || data.userA;
        if (uname) setTypingUsers(prev => ({ ...prev, [uname]: uname }));
      }
    });

    sock.on('chat:stop_typing', (data) => {
      handleTypingStatus(data, false);
      const uname = data.username || data.userA;
      if (uname) {
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[uname];
          return next;
        });
      }
    });

    sock.on('chat:reaction', ({ messageId, timestampId, reactions, senderUsername, emoji, originalSenderName }) => {
      // Notification: someone reacted to MY message in group chat
      if (emoji && senderUsername && senderUsername.toLowerCase() !== (username || '').toLowerCase() &&
          originalSenderName && originalSenderName.toLowerCase() === (username || '').toLowerCase()) {
        if (chatTabRef.current !== 'group') {
          toast(`${senderUsername} reacted ${emoji} to your message`, {
            id: `rxn-grp-${messageId}-${senderUsername}`,
            duration: 4000
          });
          // Increment group unread badge
          setGroupUnread(p => {
            const newVal = p + 1;
            try {
              const stored = JSON.parse(localStorage.getItem('chat_group_unread') || '{}');
              stored[roomId] = newVal;
              localStorage.setItem('chat_group_unread', JSON.stringify(stored));
            } catch {}
            return newVal;
          });
          setTotalUnread(p => p + 1);
          // Update Room panel preview + push to GCW — persisted so it survives a refresh
          setReactionPreviews(prev => ({ ...prev, [roomId.toLowerCase()]: `${senderUsername} reacted ${emoji} to your message` }));
          setPersistedReactionPreview(roomId.toLowerCase(), `${senderUsername} reacted ${emoji} to your message`);
          chatWidgetRef.current?.updateConversationPreview?.(roomId, `${senderUsername} reacted ${emoji} to your message`, 'room');
        }
      }

      // Group reactions only update groupMessages — never DM threads (separate event: chat:private_reaction)
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
    });

    // Server sends real DB id once the socket-path INSERT completes
    sock.on('chat:message_persisted', ({ tempId, dbId }) => {
      setGroupMessages(prev => {
        const next = prev.map(m => (String(m.id) === String(tempId) || String(m.tempId) === String(tempId)) ? { ...m, id: dbId } : m);
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          if (Array.isArray(next[user])) {
            next[user] = next[user].map(m => (String(m.id) === String(tempId) || String(m.tempId) === String(tempId)) ? { ...m, id: dbId } : m);
          }
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

    sock.on('message:unsent', ({ messageId, timestampId }) => {
      setGroupMessages(prev => {
        const next = prev.filter(m =>
          String(m.id) !== String(messageId) &&
          !(timestampId && String(m.timestamp) === String(timestampId))
        );
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          next[user] = next[user].filter(m =>
            String(m.id) !== String(messageId) &&
            !(timestampId && String(m.timestamp) === String(timestampId))
          );
        }
        return next;
      });
    });

    // "Delete for me" performed in another component/tab (e.g. Global Chat) —
    // the server broadcasts message:removed-for-me to ALL of this user's sockets.
    sock.on('message:removed-for-me', ({ messageId, originalId, timestampId }) => {
      setGroupMessages(prev => {
        const next = prev.filter(m =>
          String(m.id) !== String(messageId) &&
          !(originalId && String(m.id) === String(originalId)) &&
          !(timestampId && String(m.timestamp) === String(timestampId))
        );
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          next[user] = next[user].filter(m =>
            String(m.id) !== String(messageId) &&
            !(originalId && String(m.id) === String(originalId)) &&
            !(timestampId && String(m.timestamp) === String(timestampId))
          );
        }
        return next;
      });
    });

    // Edit broadcast from the server (own edit reconciliation, or the other
    // participant editing their message live). Branches on whether `keys` (the
    // per-recipient e2ee key map) is present to tell group edits from DM edits —
    // group and DM both always carry a nonce now, so "nonce absent" only means a
    // legacy pre-upgrade group message being edited while still in plaintext.
    sock.on('message:edited', ({ messageId, message: newMessage, senderMessage, nonce, ephemeralPublicKey, keys, editedAt }) => {
      const idStr = String(messageId);
      const decryptFor = (existing) => {
        if (!nonce) return newMessage;
        if (!myKeyPair.current) return existing.decryptedText;
        try {
          if (keys) {
            const myLower = username?.toLowerCase();
            const myEncKey = keys[myLower] || Object.entries(keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
            if (!myEncKey || !ephemeralPublicKey) return existing.decryptedText;
            const senderPubKey = decodeBase64(ephemeralPublicKey);
            return decryptGroupMessage(newMessage, nonce, myEncKey, senderPubKey, myKeyPair.current.secretKey) ?? CORRUPTED_EDIT_PLACEHOLDER;
          }
          if (existing.isMe && senderMessage) {
            return decryptDMSenderCopy(senderMessage, nonce, ephemeralPublicKey, encodeBase64(myKeyPair.current.secretKey)) ?? existing.decryptedText;
          }
          if (!existing.isMe && ephemeralPublicKey) {
            return decryptDM(newMessage, nonce, ephemeralPublicKey, encodeBase64(myKeyPair.current.secretKey)) ?? existing.decryptedText;
          }
        } catch (err) {
          console.warn('[E2EE] message:edited decrypt failed:', err);
        }
        return existing.decryptedText;
      };

      setGroupMessages(prev => {
        const next = prev.map(m => (String(m.id) === idStr ? { ...m, message: newMessage, decryptedText: decryptFor(m), edited: true, editedAt } : m));
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          next[user] = next[user].map(m => (String(m.id) === idStr ? { ...m, message: newMessage, decryptedText: decryptFor(m), edited: true, editedAt } : m));
        }
        return next;
      });
    });

    sock.on('message:edit_failed', ({ error }) => {
      toast.error(error || 'Could not edit this message.');
    });

    // Delivered-tick catch-up: a DM recipient who was offline at send time just
    // reconnected — flip that message's tick from single to double-grey live.
    sock.on('message:delivered', ({ messageId, deliveredAt }) => {
      const idStr = String(messageId);
      setGroupMessages(prev => {
        const next = prev.map(m => (String(m.id) === idStr ? { ...m, deliveredAt } : m));
        groupMessagesRef.current = next;
        return next;
      });
      setDmThreads(prev => {
        const next = { ...prev };
        for (const user in next) {
          next[user] = next[user].map(m => (String(m.id) === idStr ? { ...m, deliveredAt } : m));
        }
        return next;
      });
    });

    sock.on('private_message', msg => {
      const isMine = msg.isMe || (msg.senderName && msg.senderName.toLowerCase() === username.toLowerCase());
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
                       const resolvedUrl = resolveMediaUrl(targetMediaUrl, SOCKET_SERVER_URL);
                       const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                       const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                       const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                       dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                       setDmMediaUrlVersion(v => v + 1);
                       // Restore the real permanent URL now that the in-flight decrypt is
                       // done, so this message stays forwardable — see the matching group fix.
                       setDmThreads(prev => {
                         const key = otherName.toLowerCase();
                         const thread = prev[key];
                         if (!thread) return prev;
                         const next = thread.map(m => (String(m.id) === String(msgKey) || String(m.tempId) === String(msgKey) || String(m.timestamp) === String(msgKey)) ? { ...m, mediaUrl: targetMediaUrl } : m);
                         return { ...prev, [key]: next };
                       });
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
                     const resolvedUrl = resolveMediaUrl(targetMediaUrl, SOCKET_SERVER_URL);
                     const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
                     const decryptedBlob = await decryptMedia(buff, mediaKeyBytes);
                     const objectUrl = URL.createObjectURL(new Blob([decryptedBlob], { type: targetMediaType }));
                     dmDecryptedMediaUrls.current[msgKey] = objectUrl;
                     setDmMediaUrlVersion(v => v + 1);
                     // Restore the real permanent URL now that the in-flight decrypt is
                     // done, so this message stays forwardable — see the matching group fix.
                     setDmThreads(prev => {
                       const key = otherName.toLowerCase();
                       const thread = prev[key];
                       if (!thread) return prev;
                       const next = thread.map(m => (String(m.id) === String(msgKey) || String(m.tempId) === String(msgKey) || String(m.timestamp) === String(msgKey)) ? { ...m, mediaUrl: targetMediaUrl } : m);
                       return { ...prev, [key]: next };
                     });
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
        const key = otherName.toLowerCase();
        const thread = [...(prev[key] || [])];
        
        // Reconciliation: If an optimistic message matches, replace it
        if (msg.tempId) {
          const optIdx = thread.findIndex(m => m.id === msg.tempId || (m.timestamp && String(m.timestamp) === String(msg.tempId)));
          if (optIdx !== -1) {
            const oldMsg = thread[optIdx];
            const safeDecryptedText = newMsg.decryptedText || (oldMsg._isOptimistic ? oldMsg.message : null);
            // Use the server-confirmed real mediaUrl (newMsg.mediaUrl), not the sender's local
            // optimistic blob: preview (oldMsg.mediaUrl) — see the matching group fix above.
            thread[optIdx] = { ...newMsg, decryptedText: safeDecryptedText, mediaUrl: newMsg.mediaUrl, _localMediaUrl: oldMsg._localMediaUrl || oldMsg.mediaUrl, _fileName: oldMsg._fileName || newMsg.mediaFileName || null, _fileSize: oldMsg._fileSize || newMsg.mediaFileSize || null, mediaDuration: newMsg.mediaDuration || oldMsg.mediaDuration || null };
            return { ...prev, [key]: resolveReplyMessages(thread) };
          }
        }

        // Deduplication
        if (thread.some(m => String(m.id) === String(msg.id) || (m.timestamp && String(m.timestamp) === String(msg.timestamp) && (m.senderName === msg.senderName)))) {
          return prev;
        }

        return { ...prev, [key]: resolveReplyMessages([...thread, newMsg]) };
      });

      const otherNameLower = otherName.toLowerCase();
      const isViewingThisDm = (isMobile || rightPanelTabRef.current === 'chat') && chatTabRef.current === 'dm' && dmTargetRef.current && dmTargetRef.current.toLowerCase() === otherNameLower;
      if (!isViewingThisDm) {
        if (!isMine) {
          const storedCounts = JSON.parse(localStorage.getItem('chat_unread_counts') || '{}');
          const currentCount = Math.max(storedCounts[otherNameLower] || 0, dmUnreadRef.current[otherNameLower] || 0);
          const newDmCount = currentCount + 1;
          dmUnreadRef.current[otherNameLower] = newDmCount;
          
          setDmUnread(prev => ({ ...prev, [otherNameLower]: newDmCount }));
          // Also update unreadCounts so totalUnread = sum(unreadCounts) stays in sync
          setUnreadCounts(prev => ({ ...prev, [otherNameLower]: newDmCount }));
          setTotalUnread(p => p + 1);
          if (notifSettingsRef.current.app && notifSettingsRef.current.messages) {
            const gcwActive = chatWidgetRef.current?.getActiveChat?.() || {};
            const isViewingInGCW = gcwActive.view === 'chat' && gcwActive.partner === otherName;

            if (!isViewingInGCW) {
              const mediaPreview = (msg.mediaUrl || msg.mediaType) ? (msg.mediaType?.startsWith('video') ? 'Video' : 'Photo') : null;
              const previewText = mediaPreview || (msg.message && looksLikeCiphertext(msg.message) ? 'Encrypted message' : truncateToFewWords(newMsg.decryptedText || msg.message));
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
          sock.emit('chat:mark_read', { chatId: otherName.toLowerCase(), timestamp: msg.timestamp, isDm: true });
          try {
            const lastSeen = JSON.parse(localStorage.getItem('chat_last_seen') || '{}');
            lastSeen[otherName.toLowerCase()] = Date.now();
            localStorage.setItem('chat_last_seen', JSON.stringify(lastSeen));
          } catch { }
        }
      }
    });

    // ─── DM history from DB (historical, server emits on join) ───
    sock.on('chat_history_dm', (dmHistory) => {
      const threads = {};

      for (const [otherName, messages] of Object.entries(dmHistory)) {
         const key = otherName.toLowerCase();
         threads[key] = messages.map(msg => {
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
                         const resolvedUrl = resolveMediaUrl(targetMediaUrl, SOCKET_SERVER_URL);
                         const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
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
                       const resolvedUrl = resolveMediaUrl(targetMediaUrl, SOCKET_SERVER_URL);
                       const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
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
         threads[key] = resolveReplyMessages(threads[key]);
      }

      setDmThreads(prev => {
        const merged = { ...prev };
        for (const [name, msgs] of Object.entries(threads)) {
          const key = name.toLowerCase();
          // If this conversation was cleared in this session, filter out messages
          // that predate the clear timestamp (secondary defense against server
          // re-sending cleared messages on reconnect before hiddenFor propagates).
          const clearedTs = dmClearedTsRef.current?.[key] || 0;
          merged[key] = clearedTs > 0
            ? msgs.filter(m => Number(m.timestamp || m.createdAt || 0) > clearedTs)
            : msgs;
        }
        return merged;
      });
      setDmHistoryReady(true);
    });

    sock.on('media_stopped', () => {
      setMediaUrl('');
      setIsPlaying(false);
      setBufferedSeconds(0);
      setIsPreparing(false);
      setActiveExternalApp(null);
      setSubtitlesUrl(oldUrl => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return null;
      });
    });

    sock.on('stream_started', (data) => {
      setStreamPending({ streamKey: data.streamKey, filename: data.filename, progress: 0 });
    });

    sock.on('stream_progress', (data) => {
      setStreamPending(prev => {
        if (!prev || prev.streamKey !== data.streamKey) return prev;
        return { ...prev, progress: data.progress };
      });
    });

    sock.on('stream_cancelled', () => {
      setStreamPending(null);
    });

    sock.on('stream_ready', (data) => {
      if (!data?.streamKey) return;
      setStreamPending(null);
      setEarlyStreamReadyKey(data.streamKey);

      // If we are playing locally via blob URL, do not overwrite it
      if (mediaUrlRef.current?.startsWith('blob:')) {
        console.log('[SOCKET] Ignoring stream_ready because we are playing locally');
        return;
      }

      const streamUrl = `${SOCKET_SERVER_URL}/api/stream/${data.streamKey}/video`;
      setMediaUrl(streamUrl);
      setIsPlaying(false);
      prepTargetTimeRef.current = 0;
      if (playerRef.current) playerRef.current.seekTo(0);
    });

    sock.on('media_changed', url => {
      // If we are playing locally via blob URL, do not overwrite it with the stream URL
      if (url.includes('/api/stream/') && mediaUrlRef.current?.startsWith('blob:')) {
        console.log('[SOCKET] Ignoring media_changed because we are playing locally');
        return;
      }
      if (url === mediaUrlRef.current) return;
      setSubtitlesUrl(oldUrl => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return null;
      });
      // PRIORITY RESET: When media changes, stop all interfering processes
      setMediaUrl(url);
      // Viewers never call changeMedia() themselves — this is the only place they
      // learn the room switched to a placeholder app (Netflix/Prime/etc.), so it's
      // where their own isVirtualBrowserMedia stickiness has to be set too, or
      // they'd independently hit the same blocked plain-iframe attempt the host's
      // changeMedia() already avoids.
      const changedItem = OPTIONS.find(o => o.url === url || (o.url && (url.includes(o.url) || o.url.includes(url))));
      setIsVirtualBrowserMedia(changedItem?.type === 'placeholder');
      if (changedItem?.type === 'placeholder') setIframeBlockSuspected(false);
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
    sock.on('browser_url_changed', url => {
      setBrowserDisplayUrl(url);
      setBrowserBarInput(url);
    });
    sock.on('action_play', t => { lastExternalUpdate.current = Date.now() + 3000; if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - t) > 2) playerRef.current.seekTo(t, 'seconds'); if (localVideoRef.current && Math.abs(localVideoRef.current.currentTime - t) > 2) localVideoRef.current.currentTime = t; setIsPlaying(true); });
    sock.on('action_pause', t => { lastExternalUpdate.current = Date.now() + 3000; playerRef.current?.seekTo(t, 'seconds'); if (localVideoRef.current) localVideoRef.current.currentTime = t; setIsPlaying(false); });
    sock.on('action_seek', t => { lastExternalUpdate.current = Date.now() + 3000; playerRef.current?.seekTo(t, 'seconds'); if (localVideoRef.current) localVideoRef.current.currentTime = t; });

    // ── Audio Ducking room-wide events ──
    sock.on('audio_ducking_duck', ({ username }) => {
      if (preDuckVolumeRef.current === null) {
        preDuckVolumeRef.current = playerVolumeRef.current;
      }
      fadeVolume(playerVolumeRef.current, 0.35, 250);
      setIsDucked(true);
      setDuckingNotice(username || 'Someone');
    });
    sock.on('audio_ducking_restore', () => {
      const restoreTo = preDuckVolumeRef.current ?? playerVolumeRef.current;
      preDuckVolumeRef.current = null;
      fadeVolume(playerVolumeRef.current, restoreTo, 350);
      setIsDucked(false);
      setDuckingNotice(null);
    });
    sock.on('action_subtitles_load', (text) => {
      setSubtitleVttText(text || null);
      setSubtitlesUrl(oldUrl => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        if (!text) return null;
        const blob = new Blob([text], { type: 'text/vtt' });
        return URL.createObjectURL(blob);
      });
      setSubtitlesVisible(true);
    });

    // Lazily fetches TURN credentials once per room-join session, on first use by
    // either the camera or screen-share flow below, and caches the promise so
    // additional peers / camera toggles in this session reuse it instead of
    // re-fetching from the backend every time.
    let sharedIceServersPromise = null;
    const getSharedIceServers = () => {
      if (!sharedIceServersPromise) sharedIceServersPromise = fetchIceServers(SOCKET_SERVER_URL);
      return sharedIceServersPromise;
    };
    const camIceCandidateBuffer = {}; // { socketId: RTCIceCandidateInit[] }
    const drainCamIceCandidates = async (pc, sid) => {
      if (!camIceCandidateBuffer[sid]) return;
      for (const c of camIceCandidateBuffer[sid]) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch(e) { console.warn('[CAM RTC] Buffered ICE add failed', e); }
      }
      delete camIceCandidateBuffer[sid];
    };

    sock.on('webrtc_cam_ping', ({ requesterId }) => {
      if (isCamOnRef.current) {
        sock.emit('webrtc_cam_pong', { targetSocketId: requesterId });
      }
    });

    sock.on('cam_started', async ({ socketId, username: uname }) => {
      console.log('Received cam_started from', uname, socketId);
      if (cameraPcRefs.current[socketId]) {
        cameraPcRefs.current[socketId].close();
      }
      const iceServers = await getSharedIceServers();
      const pc = new RTCPeerConnection({ iceServers });
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
    // The other participant hung up — this is a call, not a shared broadcast,
    // so end it on our side too: stop our own camera/mic and close the call screen.
    sock.on('call_ended', async () => {
      try {
        if (isCamOnRef.current) await toggleCameraRef.current?.();
        if (isMicOnCamRef.current) await toggleMicRef.current?.();
      } catch (e) {
        console.error('call_ended cleanup error:', e);
      }
      setMediaUrl('');
      setActiveExternalApp(null);
      setShowMediaSelector(true);
    });
    sock.on('cam_offer', async ({ senderSocketId, senderName, offer }) => {
      console.log('Received cam_offer from', senderName);
      if (cameraPcRefs.current[senderSocketId]) {
        cameraPcRefs.current[senderSocketId].close();
      }
      const iceServers = await getSharedIceServers();
      const pc = new RTCPeerConnection({ iceServers });
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
        // Drain any ICE candidates that arrived before setRemoteDescription
        await drainCamIceCandidates(pc, senderSocketId);
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
        // Drain any ICE candidates buffered before this answer arrived
        await drainCamIceCandidates(pc, senderSocketId);
      } catch (err) {
        console.error('Error handling cam answer', err);
      }
    });
    sock.on('cam_ice', async ({ senderSocketId, candidate }) => {
      const pc = cameraPcRefs.current[senderSocketId];
      if (!pc || !pc.remoteDescription) {
        // Buffer the candidate until remote description is ready
        if (!camIceCandidateBuffer[senderSocketId]) camIceCandidateBuffer[senderSocketId] = [];
        camIceCandidateBuffer[senderSocketId].push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { console.warn('[CAM RTC] addIceCandidate failed:', err); }
    });

    sock.on('kicked_out', ({ reason }) => {
      setKickedReason(reason);
      setIsConnecting(false);
      if (reason === 'room_deleted' || reason === 'room_closed_by_admin') setRoomNotFound(true);
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
    // ── ICE candidate buffer: candidates can arrive before setRemoteDescription() ──
    // completes (especially on localhost where signalling is near-instant).
    // We buffer them and drain the queue as soon as the remote description is set.
    const iceCandidateBuffer = {}; // { senderSocketId: RTCIceCandidateInit[] }

    // Screen-share peer connections reuse the same lazily-fetched TURN credentials
    // as the camera flow above (getSharedIceServers), cached once per session.

    // Helper: apply buffered ICE candidates once remote description is ready
    const drainIceCandidates = async (pc, sid) => {
      if (!iceCandidateBuffer[sid]) return;
      for (const c of iceCandidateBuffer[sid]) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch(e) { console.warn('[RTC] Buffered ICE add failed', e); }
      }
      delete iceCandidateBuffer[sid];
    };

    sock.on('webrtc_viewer_joined', async vid => {
      if (!localStreamRef.current) return;
      const iceServers = await getSharedIceServers();
      const peer = new RTCPeerConnection({ iceServers });
      peerConnectionsRef.current[vid] = peer;

      localStreamRef.current.getTracks().forEach(t => peer.addTrack(t, localStreamRef.current));
      peer.onicecandidate = e => {
        if (e.candidate) sock.emit('webrtc_ice_candidate', { targetSocketId: vid, candidate: e.candidate });
      };
      peer.onconnectionstatechange = () => console.log(`[RTC host→${vid}] connection:`, peer.connectionState);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sock.emit('webrtc_offer', { targetSocketId: vid, offer });
    });

    sock.on('webrtc_offer', async ({ senderSocketId, offer }) => {
      const iceServers = await getSharedIceServers();
      const peer = new RTCPeerConnection({ iceServers });
      peerConnectionsRef.current[senderSocketId] = peer;

      peer.ontrack = e => {
        console.log('[RTC] Remote track received:', e.track.kind);
        if (e.streams && e.streams[0]) {
          setRemoteStream(e.streams[0]);
        } else {
          setRemoteStream(new MediaStream([e.track]));
        }
      };
      peer.onicecandidate = e => {
        if (e.candidate) sock.emit('webrtc_ice_candidate', { targetSocketId: senderSocketId, candidate: e.candidate });
      };
      peer.onconnectionstatechange = () => console.log(`[RTC viewer←${senderSocketId}] connection:`, peer.connectionState);

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      // Drain any ICE candidates that arrived before we set the remote description
      await drainIceCandidates(peer, senderSocketId);

      const ans = await peer.createAnswer();
      await peer.setLocalDescription(ans);
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
        // Drain any candidates that were buffered before the answer was processed
        await drainIceCandidates(pc, senderSocketId);
      } catch (e) {
        console.error('[RTC] Failed to set remote description for answer:', e);
      }
    });

    sock.on('webrtc_ice_candidate', async ({ senderSocketId, candidate }) => {
      const pc = peerConnectionsRef.current[senderSocketId];
      if (!pc || !pc.remoteDescription) {
        // Remote description not yet set — buffer the candidate
        if (!iceCandidateBuffer[senderSocketId]) iceCandidateBuffer[senderSocketId] = [];
        iceCandidateBuffer[senderSocketId].push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch(e) {
        console.warn('[RTC] addIceCandidate failed:', e);
      }
    });

    const onVis = () => {
      if (!document.hidden && sock.connected) {
        sock.emit('request_sync', roomId);
        if (chatTabRef.current === 'dm' && dmTargetRef.current) {
          sock.emit('chat:mark_read', { chatId: dmTargetRef.current.toLowerCase(), timestamp: Date.now(), isDm: true, userRead: true });
        } else if (chatTabRef.current === 'group') {
          sock.emit('chat:mark_read', { chatId: roomId, timestamp: Date.now(), isDm: false, userRead: true });
        }
      }
    };
    const onFocus = () => {
      if (!document.hidden && sock.connected) {
        if (chatTabRef.current === 'dm' && dmTargetRef.current) {
          sock.emit('chat:mark_read', { chatId: dmTargetRef.current.toLowerCase(), timestamp: Date.now(), isDm: true, userRead: true });
        } else if (chatTabRef.current === 'group') {
          sock.emit('chat:mark_read', { chatId: roomId, timestamp: Date.now(), isDm: false, userRead: true });
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
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

      if (localCamRef.current) {
        // TEMP DEBUG — cross-component local-tile investigation, remove after diagnosis.
        // This cleanup fires whenever [roomId, username, SOCKET_SERVER_URL, cryptoReady]
        // change, not only on unmount. If this fires mid-session while isCamOn is still
        // true, it silently kills the local camera stream without resetting isCamOn.
        console.warn('[CAM DEBUG] socket-effect cleanup is stopping localCamRef.current', {
          isCamOnAtCleanup: isCamOnRef.current,
          roomId, username, SOCKET_SERVER_URL, cryptoReady,
          stack: new Error().stack,
        });
        localCamRef.current.getTracks().forEach(t => t.stop());
        localCamRef.current = null;
      }
      Object.values(cameraPcRefs.current).forEach(pc => {
        try { pc.close(); } catch(e) {}
      });
      cameraPcRefs.current = {};

      sock.removeAllListeners();
      sock.close();
    };

  }, [roomId, username, SOCKET_SERVER_URL, cryptoReady]);

  // E2EE: Emit public key when available so others can DM us encrypted
  useEffect(() => {
    if (socket && socket.connected && keyPair && keyPair.publicKey && roomId) {
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
                  const resolvedUrl = resolveMediaUrl(msg.mediaUrl, SOCKET_SERVER_URL);
                  const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
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
        const lowerUser = user.toLowerCase();
        if (lowerUser !== user) {
          delete next[user];
        }
        next[lowerUser] = thread.map(msg => {
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
                        const resolvedUrl = resolveMediaUrl(msg.mediaUrl, SOCKET_SERVER_URL);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
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
                        const resolvedUrl = resolveMediaUrl(msg.mediaUrl, SOCKET_SERVER_URL);
                        const buff = await fetch(resolvedUrl).then(r => r.arrayBuffer());
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
    if (localVideoRef.current) {
      localVideoRef.current.volume = playerVolume;
      localVideoRef.current.muted = playerMuted;
    }
  }, [playerVolume, playerMuted, mediaUrl, isLocalStream]);

  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.textTracks.length > 0) {
      localVideoRef.current.textTracks[0].mode = 'hidden';
    }
  }, [subtitlesVisible, subtitlesUrl]);

  useEffect(() => {
    if (!subtitleVttText) { subtitleCuesRef.current = []; return; }
    subtitleCuesRef.current = parseVttCues(subtitleVttText);
  }, [subtitleVttText]);

  useEffect(() => {
    if (!subtitleCuesRef.current.length || !subtitlesVisible) { setActiveCue(null); return; }
    const adjTime = currentTime + subtitleSettings.delay;
    const speed = subtitleSettings.speed || 1;
    const found = subtitleCuesRef.current.find(c => {
      const adjEnd = c.start + (c.end - c.start) / speed;
      return adjTime >= c.start && adjTime <= adjEnd;
    }) || null;
    setActiveCue(found);
  }, [currentTime, subtitlesVisible, subtitleSettings.delay, subtitleSettings.speed]);

  useEffect(() => {
    try {
      const key = `subtitleSettings_${username || 'guest'}`;
      localStorage.setItem(key, JSON.stringify(subtitleSettings));
    } catch {}
  }, [subtitleSettings, username]);

  useEffect(() => {
    if (!showSubtitleMenu) return;
    const close = e => {
      const insideTrigger = subtitleMenuRef.current && subtitleMenuRef.current.contains(e.target);
      const insidePortal = subtitleDropdownPortalRef.current && subtitleDropdownPortalRef.current.contains(e.target);
      if (!insideTrigger && !insidePortal) {
        setShowSubtitleMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showSubtitleMenu]);

  // Mobile subtitle dropdown position — clamped to the PLAYER's own bounding rect
  // (not just the viewport), and always opening upward from the button, so the menu
  // always renders overlaid on the video itself. It used to sometimes flip to
  // "below the button" when there wasn't much room above, which for a small inline
  // player (video docked above the chat list, not fullscreen) meant the dropdown
  // landed outside the video entirely, over the chat below it. maxHeight + scroll
  // guarantees it never has to spill past the player's own top edge to fit.
  useEffect(() => {
    if (!showSubtitleMenu || !isTouchPlayer || !subtitleBtnRef.current || !playerWrapRef.current) return;
    let btnRect = subtitleBtnRef.current.getBoundingClientRect();
    let playerRect = playerWrapRef.current.getBoundingClientRect();
    const frameHeight = isRotatedFs ? window.innerWidth : window.innerHeight;
    if (isRotatedFs) {
      btnRect = toRotatedLocalRect(btnRect, window.innerWidth);
      playerRect = toRotatedLocalRect(playerRect, window.innerWidth);
    }
    const menuWidth = 220;
    let left = btnRect.left + btnRect.width - menuWidth;
    left = Math.max(playerRect.left + 8, Math.min(left, playerRect.left + playerRect.width - menuWidth - 8));
    const bottom = frameHeight - btnRect.top + 8;
    const maxHeight = Math.max(120, btnRect.top - playerRect.top - 16);
    setSubtitleDropdownPos({ left, bottom, maxHeight });
  }, [showSubtitleMenu, isTouchPlayer, isRotatedFs]);

  // Close globe popup when clicking outside
  useEffect(() => {
    if (!showGlobePopup) return;
    const close = e => {
      if (globePopupRef.current && !globePopupRef.current.contains(e.target)) {
        setShowGlobePopup(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showGlobePopup]);

  useEffect(() => {
    if (!showQualityMenu) return;
    const close = e => {
      const insideTrigger = qualityMenuRef.current && qualityMenuRef.current.contains(e.target);
      const insidePortal = qualityDropdownPortalRef.current && qualityDropdownPortalRef.current.contains(e.target);
      if (!insideTrigger && !insidePortal) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showQualityMenu]);

  // Mobile quality dropdown position — clamped to the PLAYER's own bounding rect
  // (post any CSS transform, e.g. the mobile-fullscreen rotate-trick), not just the
  // viewport, and always opening upward from the button, so it always renders
  // overlaid on the video itself instead of sometimes flipping below the button —
  // which, for a small inline player, landed the menu outside the video entirely.
  // maxHeight + scroll guarantees it never needs to spill past the player's top edge.
  useEffect(() => {
    if (!showQualityMenu || !isTouchPlayer || !qualityBtnRef.current || !playerWrapRef.current) return;
    let btnRect = qualityBtnRef.current.getBoundingClientRect();
    let playerRect = playerWrapRef.current.getBoundingClientRect();
    const frameHeight = isRotatedFs ? window.innerWidth : window.innerHeight;
    if (isRotatedFs) {
      btnRect = toRotatedLocalRect(btnRect, window.innerWidth);
      playerRect = toRotatedLocalRect(playerRect, window.innerWidth);
    }
    const menuWidth = 132;
    let left = btnRect.left + btnRect.width - menuWidth;
    left = Math.max(playerRect.left + 8, Math.min(left, playerRect.left + playerRect.width - menuWidth - 8));
    const bottom = frameHeight - btnRect.top + 8;
    const maxHeight = Math.max(120, btnRect.top - playerRect.top - 16);
    setQualityDropdownPos({ left, bottom, maxHeight });
  }, [showQualityMenu, isTouchPlayer, isRotatedFs]);

  // Reset iframe block state when URL changes so fresh load starts unblocked
  useEffect(() => {
    setIframeBlockSuspected(false);
    setShowGlobePopup(false);
    clearTimeout(iframeBlockTimeoutRef.current);

    if (mediaUrl && isWebIframe(mediaUrl)) {
      // If the iframe is loaded but potentially blocked or taking too long, we show the 
      // bottom-right Globe button option to open in the Virtual Browser after 6 seconds.
      iframeBlockTimeoutRef.current = setTimeout(() => {
        setIframeBlockSuspected(true);
      }, 6000);
    }
    return () => clearTimeout(iframeBlockTimeoutRef.current);
  }, [mediaUrl]);

  // Manage iframe block/fail hint expanded state
  useEffect(() => {
    if (iframeBlockSuspected || iframeError) {
      setIframeHintExpanded(true);
      const timer = setTimeout(() => {
        setIframeHintExpanded(false);
      }, 4000); // Collapse to globe after 4 seconds
      return () => clearTimeout(timer);
    } else {
      setIframeHintExpanded(true);
    }
  }, [iframeBlockSuspected, iframeError]);

  // Ã¢â€ â‚¬Ã¢â€ â‚¬ Helpers Ã¢â€ â‚¬Ã¢â€ â‚¬
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
  const allUsersPlayerSettings = room?.settings?.allUsersPlayerSettings !== false && room?.settings?.allUsersPlayerSettings !== 'false';
  const hasPlayerPrivileges = isEffectiveHost || allUsersPlayerSettings;

  // ── Audio Ducking — room-wide, socket-synced ──

  // Smooth volume fade — drives both ReactPlayer (via state prop) and localVideoRef (via existing effect)
  function fadeVolume(from, to, durationMs) {
    const steps = 12;
    const stepTime = durationMs / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const value = Math.max(0, Math.min(1, from + (to - from) * (step / steps)));
      playerVolumeRef.current = value;
      setPlayerVolume(value);
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }

  // VAD — only active when room audioDucking is on AND this user's mic is on
  const audioDuckingEnabled = !!(room?.settings?.audioDucking && isMicOnCam);

  useVoiceActivityDetection({
    micStream: localCamRef.current,
    enabled: audioDuckingEnabled,
    onSpeakingChange: useCallback((isSpeaking) => {
      if (!socket || !roomId) return;
      if (isSpeaking) {
        socket.emit('audio_ducking_speaking', {
          roomId: (roomId || '').toLowerCase(),
          userId: mySocketIdRef.current,
          username: usernameRef.current,
        });
      } else {
        socket.emit('audio_ducking_stopped', {
          roomId: (roomId || '').toLowerCase(),
          userId: mySocketIdRef.current,
        });
      }
    }, [socket, roomId]), // eslint-disable-line react-hooks/exhaustive-deps
  });

  // ── Keep savePositionStateRef in sync for the beforeunload handler ──
  useEffect(() => {
    savePositionStateRef.current = { isEffectiveHost, mediaUrl, roomId };
  }, [isEffectiveHost, mediaUrl, roomId]);

  // ── Auto-resume: restore saved media when host re-enters an empty room ──
  useEffect(() => {
    if (!room?.lastMediaUrl || !isEffectiveHost || hasAutoResumedRef.current) return;
    if (mediaUrl) return; // another media is already active
    const mType = detectMediaType(room.lastMediaUrl);
    if (!mType) return;

    hasAutoResumedRef.current = true;
    const savedUrl = room.lastMediaUrl;
    const savedPos = room.lastMediaPosition || 0;
    prepTargetTimeRef.current = savedPos;

    // Update server state so new joiners also see the resumed URL
    socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: savedUrl });
    setMediaUrl(savedUrl);
    setIsPlaying(true);

    if (savedPos > 5) {
      setTimeout(() => {
        lastExternalUpdate.current = Date.now();
        if (playerRef.current?.seekTo) {
          playerRef.current.seekTo(savedPos, 'seconds');
        }
      }, 1500);
    }
  }, [room, isEffectiveHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── As soon as the server has enough of the upload for progressive playback
  // (stream_ready, not 100% complete — see backend's readyThreshold), the host kicks
  // viewers from their initial "loaded but paused" state into actually playing, synced
  // to the host's current position. This used to wait for the ENTIRE upload to finish,
  // so a friend on a slow connection watching a multi-minute video would see it load
  // but never actually start until the whole file was up. ──
  const streamCanPlayFiredRef = useRef(false);
  useEffect(() => {
    if (!earlyStreamReadyKey || earlyStreamReadyKey !== uploadState.streamKey || !socket || !isEffectiveHost) return;
    if (streamCanPlayFiredRef.current) return;
    streamCanPlayFiredRef.current = true;

    // Host keeps watching the local blob URL. Seek/play viewers ~1.5s later so their
    // player has had a moment to load the stream URL's metadata first.
    const currentPos = localVideoRef.current?.currentTime || 0;
    setTimeout(() => {
      if (socket) {
        const freshPos = localVideoRef.current?.currentTime || currentPos;
        console.log('[STREAM Sync] Syncing viewers to host time:', freshPos);
        socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: freshPos });
        socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: freshPos });
      }
    }, 1500);
  }, [earlyStreamReadyKey, uploadState.streamKey, isEffectiveHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Once the upload is fully done, just persist the final URL server-side (for
  // anyone who joins/reconnects afterward) via stream_finalize — NOT change_media,
  // which would reset isPlaying/currentTime/subtitles and yank already-playing
  // viewers back to paused/position-0 for no reason, since they're already correctly
  // synced via the early resync above. ──
  const streamFinalizedRef = useRef(false);
  useEffect(() => {
    if (!uploadState.canPlay || !uploadState.streamKey || !socket || !isEffectiveHost) return;
    if (streamFinalizedRef.current) return;
    streamFinalizedRef.current = true;
    const streamUrl = `${SOCKET_SERVER_URL}/api/stream/${uploadState.streamKey}/video`;
    socket.emit('stream_finalize', { roomId: (roomId || '').toLowerCase(), mediaUrl: streamUrl });
  }, [uploadState.canPlay, uploadState.streamKey, isEffectiveHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the fired-refs when a new upload starts
  useEffect(() => {
    if (uploadState.isUploading && !uploadState.canPlay) {
      streamCanPlayFiredRef.current = false;
      streamFinalizedRef.current = false;
    }
  }, [uploadState.isUploading, uploadState.canPlay]);

  // Sync isPlaying state → local <video> element for stream URLs
  useEffect(() => {
    if (!localVideoRef.current) return;
    if (isPlaying) localVideoRef.current.play().catch(() => {});
    else localVideoRef.current.pause();
  }, [isPlaying]);

  // ── 30-second auto-save interval while host is playing ──
  useEffect(() => {
    if (!isEffectiveHost || !isPlaying || !mediaUrl || !socket) return;
    const mType = detectMediaType(mediaUrl);
    if (!mType) return;

    const interval = setInterval(() => {
      const pos = getPlayerPosition();
      if (pos > 0) {
        socket.emit('media_position_save', {
          roomId: (roomId || '').toLowerCase(),
          url: mediaUrl,
          position: pos,
          mediaType: mType
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isEffectiveHost, isPlaying, mediaUrl, roomId, socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save position on page close via sendBeacon ──
  useEffect(() => {
    const handleUnload = () => {
      const { isEffectiveHost: isH, mediaUrl: url, roomId: rid } = savePositionStateRef.current;
      if (!isH || !url || !rid) return;
      const mType = detectMediaType(url);
      if (!mType) return;
      const pos = getPlayerPosition();
      if (pos <= 0) return;
      navigator.sendBeacon(
        `${SOCKET_SERVER_URL}/api/rooms/save-position`,
        new Blob([JSON.stringify({ roomId: rid.toLowerCase(), url, position: pos, mediaType: mType })], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ã¢â€ â‚¬Ã¢â€ â‚¬ Chat typing Ã¢â€ â‚¬Ã¢â€ â‚¬
  const handleChatInputChange = (val, chatType) => {
    if (socket && chatType) {
      const target = chatType === 'private' ? dmTarget : roomId;
      if (Date.now() - lastTypingSent.current > 2000) {
        socket.emit('chat:typing', { partner: target, type: chatType, roomId: (roomId || '').toLowerCase() });
        lastTypingSent.current = Date.now();
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        socket.emit('chat:stop_typing', { partner: target, type: chatType, roomId: (roomId || '').toLowerCase() });
        lastTypingSent.current = 0;
      }, 2000);
    }
  };

  const handleDeleteMessage = (msgId, mode = 'global') => {
    const idStr = String(msgId);
    // Find the message to extract its timestamp as a fallback lookup key for the server.
    // Pre-fix sessions may have stored socket-based ids instead of real DB ids; the server
    // uses timestamp+senderName to locate the row if the primary id lookup misses.
    const msgObj = groupMessagesRef.current.find(m => String(m.id) === idStr || String(m.timestamp) === idStr)
      || Object.values(dmThreads).flat().find(m => String(m.id) === idStr || String(m.timestamp) === idStr);
    const fallbackTs = msgObj?.timestamp ? String(msgObj.timestamp) : undefined;

    // Optimistic: remove from UI immediately regardless of server response
    setGroupMessages(prev => {
      const next = prev.filter(m => String(m.id) !== idStr && String(m.timestamp) !== idStr);
      groupMessagesRef.current = next;
      return next;
    });
    setDmThreads(prev => {
      const next = { ...prev };
      for (const user in next) {
        next[user] = next[user].filter(m => String(m.id) !== idStr && String(m.timestamp) !== idStr);
      }
      return next;
    });

    if (!socket) return;
    if (mode === 'global') {
      // Unsend: deletes for everyone — server broadcasts message:unsent to all room sockets
      socket.emit('message:unsend', { messageId: idStr, timestamp: fallbackTs });
    } else {
      // Delete for me: server updates hiddenFor and broadcasts message:removed-for-me via emitToUser
      socket.emit('message:delete-for-me', { messageId: idStr, timestamp: fallbackTs });
    }
  };

  // Forward selected messages (RoomChatPanel's multi-select) to other chats.
  // Lives here rather than in RoomChatPanel.jsx because it needs myKeyPair for
  // DM re-encryption — RoomChatPanel has no direct access to the keypair,
  // mirroring how editDmMessage/sendDmChat already own all E2EE calls.
  // Always goes through REST (POST /api/chats/send), same as GlobalChatWidget's
  // own forward implementation, since it's the only send path that doesn't
  // require the destination room to already be joined.
  // Resolves the real plaintext for a message being forwarded. Never falls back to
  // msg.message when the message is E2EE (has a nonce) — msg.message there is still
  // ciphertext, and forwarding it as if it were plaintext would re-encrypt already-
  // encrypted bytes, landing as garbled text on the destination side once the outer
  // layer is (correctly) decrypted. If msg.decryptedText wasn't already cached, retry
  // decryption live here using the same sender-copy/recipient branching used elsewhere,
  // and only give up (treat as unforwardable) if that also fails. Group-sourced text
  // (msg.e2ee present) uses decryptGroupMessage against the message's own key map.
  const recoverDmText = (msg) => {
    if (msg.decryptedText != null && msg.decryptedText !== '') return msg.decryptedText;
    if (msg.e2ee && msg.e2ee.keys && msg.e2ee.senderPublicKey) {
      const kp = myKeyPair.current;
      if (!kp) return null;
      try {
        const myLower = username?.toLowerCase();
        const myEncKey = msg.e2ee.keys[myLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
        if (!myEncKey) return null;
        const senderPubKey = decodeBase64(msg.e2ee.senderPublicKey);
        return decryptGroupMessage(msg.message, msg.e2ee.nonce, myEncKey, senderPubKey, kp.secretKey);
      } catch (e) { console.warn('[Forward] group text recovery failed', e); return null; }
    }
    if (!msg.nonce) return msg.message || '';
    const kp = myKeyPair.current;
    if (!kp) return null;
    try {
      if (msg.isMe && msg.senderMessage) {
        return decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(kp.secretKey));
      }
      const senderPK = msg.ephemeralPublicKey || msg.senderPublicKey;
      if (!msg.isMe && senderPK) {
        return decryptDM(msg.message, msg.nonce, senderPK, encodeBase64(kp.secretKey));
      }
    } catch (e) { console.warn('[Forward] text recovery failed', e); }
    return null;
  };

  // Recovers the raw AES media key (base64) for a group-sourced media message via
  // decryptGroupMessage against the message's own per-recipient key map — mirrors
  // recoverDmText's group branch above.
  const recoverGroupMediaKeyB64 = (msg) => {
    if (!msg.e2ee || !msg.e2ee.keys || !msg.e2ee.senderPublicKey) return null;
    const kp = myKeyPair.current;
    if (!kp) return null;
    try {
      const myLower = username?.toLowerCase();
      const myEncKey = msg.e2ee.keys[myLower] || Object.entries(msg.e2ee.keys).find(([k]) => k.toLowerCase() === myLower)?.[1];
      if (!myEncKey) return null;
      const senderPubKey = decodeBase64(msg.e2ee.senderPublicKey);
      return decryptGroupMessage(msg.message, msg.e2ee.nonce, myEncKey, senderPubKey, kp.secretKey);
    } catch (e) { console.warn('[Forward] group media key recovery failed', e); return null; }
  };

  const forwardMessages = async (msgs, destinations) => {
    const token = localStorage.getItem('watch_token');
    if (!token) return { failCount: msgs.length * destinations.length };
    const sorted = [...msgs].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    let failCount = 0;
    for (const dest of destinations) {
      const destType = dest.type === 'room' ? 'room' : 'private';
      const destPartner = dest.id || dest.partner;
      let targetPubKey = null;
      let groupRecipients = null;
      if (destType === 'private') {
        try {
          const pkRes = await fetch(`${SOCKET_SERVER_URL}/api/auth/public-key/${destPartner}`);
          if (pkRes.ok) { const d = await pkRes.json(); targetPubKey = d.publicKey || null; }
        } catch {}
      } else {
        try {
          const pkRes = await fetch(`${SOCKET_SERVER_URL}/api/rooms/${destPartner.toLowerCase()}/public-keys`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (pkRes.ok) {
            const pkData = await pkRes.json();
            groupRecipients = pkData.keys.map(k => ({ username: k.username, publicKey: robustDecode(k.publicKey) }));
          }
        } catch { /* groupRecipients stays null; handled as an unencryptable destination below */ }
      }
      for (const msg of sorted) {
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
            mediaFileName: msg.mediaFileName || null,
            mediaFileSize: msg.mediaFileSize || null,
            mediaDuration: msg.mediaDuration || null,
            forwarded: true,
          };
          const kp = myKeyPair.current;
          if (isMedia) {
            let mediaKeyB64 = null;
            if (msg.e2ee) {
              // Source was a group message (client-encrypted) — recover the existing key.
              mediaKeyB64 = recoverGroupMediaKeyB64(msg);
              if (!mediaKeyB64) { failCount++; continue; }
            } else if (msg.nonce) {
              // Source was already a DM (client-encrypted) — just recover the existing
              // per-recipient key and re-wrap it for the new recipient, same file untouched.
              try {
                if (msg.isMe && msg.senderMessage) {
                  mediaKeyB64 = decryptDMSenderCopy(msg.senderMessage, msg.nonce, msg.ephemeralPublicKey, encodeBase64(kp.secretKey));
                } else if (!msg.isMe && msg.ephemeralPublicKey) {
                  mediaKeyB64 = decryptDM(msg.message, msg.nonce, msg.ephemeralPublicKey, encodeBase64(kp.secretKey));
                }
              } catch (e) { console.warn('[Forward] media key recovery failed', e); }
              if (!mediaKeyB64) { failCount++; continue; }
            } else {
              // Source was never client-encrypted (legacy pre-upgrade group media, stored
              // plain) — there's no existing key to recover. Fetch the plain file, encrypt
              // it fresh with a new random key, and re-upload so the destination gets a
              // real E2EE copy instead of a plaintext file dressed up as encrypted.
              try {
                const resolvedUrl = resolveMediaUrl(msg.mediaUrl, SOCKET_SERVER_URL);
                const rawBlob = await fetch(resolvedUrl).then(r => r.blob());
                const enc = await encryptMedia(rawBlob);
                const fd = new FormData();
                fd.append('media', enc.encryptedBlob, msg.mediaFileName || 'file');
                const uploadResp = await fetch(`${SOCKET_SERVER_URL}/api/upload/chat`, {
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
            if (destType === 'private' && targetPubKey && kp) {
              const wrap = encryptDM(mediaKeyB64, targetPubKey, encodeBase64(kp.publicKey));
              body.message = wrap.ciphertext;
              body.senderMessage = wrap.senderCiphertext;
              body.nonce = wrap.nonce;
              body.ephemeralPublicKey = wrap.ephemeralPublicKey;
            } else if (destType === 'room' && groupRecipients && groupRecipients.length && kp) {
              try {
                const enc = encryptGroupMessage(mediaKeyB64, groupRecipients, kp, username);
                body.message = enc.ciphertext;
                body.nonce = enc.nonce;
                body.e2eeKeys = enc.keys;
                body.ephemeralPublicKey = encodeBase64(kp.publicKey);
              } catch (e) { console.warn('[Forward] group media re-wrap failed', e); failCount++; continue; }
            } else {
              // Can't securely deliver to this destination — never send an unwrapped key.
              failCount++; continue;
            }
          } else {
            const text = recoverDmText(msg);
            if (text == null) { failCount++; continue; }
            if (destType === 'private' && targetPubKey && kp) {
              const enc = encryptDM(text, targetPubKey, encodeBase64(kp.publicKey));
              body.message = enc.ciphertext;
              body.senderMessage = enc.senderCiphertext;
              body.nonce = enc.nonce;
              body.ephemeralPublicKey = enc.ephemeralPublicKey;
            } else if (destType === 'room' && groupRecipients && groupRecipients.length && kp) {
              try {
                const enc = encryptGroupMessage(text, groupRecipients, kp, username);
                body.message = enc.ciphertext;
                body.nonce = enc.nonce;
                body.e2eeKeys = enc.keys;
                body.ephemeralPublicKey = encodeBase64(kp.publicKey);
              } catch (e) { console.warn('[Forward] group text re-wrap failed', e); failCount++; continue; }
            } else {
              // Can't securely deliver to this destination — never send plaintext.
              failCount++; continue;
            }
          }
          const resp = await fetch(`${SOCKET_SERVER_URL}/api/chats/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
          });
          if (!resp.ok) failCount++;
        } catch (e) { console.error('[Forward] send failed', e); failCount++; }
      }
    }
    return { failCount };
  };

  // ─── E2EE: build the recipient list for a group message ───────────────────
  // Merges dbPublicKeys.current (DB fallback covering recently-active room
  // participants, from GET /api/rooms/:roomId/public-keys — see the pre-fetch
  // effect above) with live userList/peerPublicKeys (current socket presence,
  // takes priority since it's the freshest). Recipients are the UNION of both
  // sets, not just userList alone — a message's key must be wrapped for anyone
  // with a known public key, not only whoever happens to be connected at this
  // exact instant, otherwise a member who briefly disconnects/reconnects loses
  // access to messages sent during that gap, permanently.
  const buildGroupRecipients = () => {
    const mergedKeys = { ...dbPublicKeys.current };
    userList.forEach(u => {
      if (u.socketId && peerPublicKeys.current[u.socketId]) {
        mergedKeys[u.username.toLowerCase()] = peerPublicKeys.current[u.socketId];
      }
    });
    const liveUsernames = userList.map(u => u.username.toLowerCase());
    const allUsernames = new Set([...liveUsernames, ...Object.keys(mergedKeys)]);
    allUsernames.delete(username.toLowerCase());
    const recipients = [...allUsernames]
      .map(uname => ({ username: uname, publicKey: mergedKeys[uname] || null }))
      .filter(r => r.publicKey);
    if (myKeyPair.current) recipients.push({ username, publicKey: myKeyPair.current.publicKey });
    return recipients;
  };

  // ─── E2EE: shown instead of raw content for group messages sent before this
  // upgrade (server-side-only encryption, since retired — no dual-format decrypt
  // support). Media wasn't part of that old scheme (files were always stored
  // unencrypted), so it keeps rendering normally; only legacy text is replaced.
  const LEGACY_GROUP_TEXT_PLACEHOLDER = 'Sent before encryption upgrade';

  // ─── E2EE: shown for a group message that was edited before this fix (an
  // edit that resent plaintext, which the backend then paired with the
  // message's OLD nonce/keys — permanently mismatched, so decrypt can never
  // succeed for that row). Distinct from LEGACY_GROUP_TEXT_PLACEHOLDER so it's
  // not confused with an unrelated pre-upgrade message.
  const CORRUPTED_EDIT_PLACEHOLDER = 'This edited message can no longer be decrypted';

  // Ã¢â€ â‚¬Ã¢â€ â‚¬ Send message Ã¢â€ â‚¬Ã¢â€ â‚¬
  // Ref holding the latest raw-send logic so the event listener always has fresh state.
  const sendRawGroupChatRef = useRef(null);
  const sendGroupMediaRef = useRef(null);
  sendRawGroupChatRef.current = (msgText, replyTo) => {
    if (!msgText || !socket) return;
    if (!myKeyPair.current) {
      toast.error('Encryption keys not ready yet. Please wait a moment and try again.');
      return;
    }
    const ts = Date.now();
    const tempId = `opt-${ts}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      id: tempId, username, message: msgText, decryptedText: msgText,
      timestamp: ts, reactions: {}, replyTo: replyTo || null, _isOptimistic: true
    };
    setGroupMessages(prev => {
      const next = [...prev, optimisticMsg];
      groupMessagesRef.current = next;
      return next;
    });
    let encryptedPayload = null;
    try {
      const recipients = buildGroupRecipients();
      encryptedPayload = encryptGroupMessage(msgText, recipients, myKeyPair.current, username);
    } catch (err) {
      console.warn('[E2EE] Group encrypt failed:', err);
    }
    // Group E2EE is mandatory (matches DM's guarantee) — never fall back to plaintext.
    if (!encryptedPayload) {
      toast.error('Message not sent — encryption failed.');
      setGroupMessages(prev => {
        const next = prev.filter(m => m.id !== tempId);
        groupMessagesRef.current = next;
        return next;
      });
      return;
    }
    socket.emit('chat_message', {
      roomId: (roomId || '').toLowerCase(),
      message: encryptedPayload.ciphertext,
      e2ee: { nonce: encryptedPayload.nonce, keys: encryptedPayload.keys, senderPublicKey: encodeBase64(myKeyPair.current.publicKey) },
      username, tempId, replyTo: replyTo || null
    });
  };

  // Guest bridge: GlobalChatWidget has no socket, so it delegates room sends here via event.
  useEffect(() => {
    const handler = (e) => {
      if (localStorage.getItem('watch_is_guest') !== 'true') return;
      const { message, replyTo } = e.detail || {};
      if (message && sendRawGroupChatRef.current) sendRawGroupChatRef.current(message, replyTo || null);
    };
    window.addEventListener('guest_widget_send_room_message', handler);
    return () => window.removeEventListener('guest_widget_send_room_message', handler);
  }, []);

  // Guest bridge: media/voice/files from GlobalChatWidget delegate here (widget lacks upload auth for guests).
  useEffect(() => {
    const handler = (e) => {
      if (localStorage.getItem('watch_is_guest') !== 'true') return;
      const { file, mediaDuration, replyTo } = e.detail || {};
      if (file && sendGroupMediaRef.current) {
        sendGroupMediaRef.current(null, file.type, replyTo || null, file, mediaDuration || null);
      }
    };
    window.addEventListener('guest_widget_send_room_media', handler);
    return () => window.removeEventListener('guest_widget_send_room_media', handler);
  }, []);

  // Guest bridge: GlobalChatWidget has no socket, so it delegates pagination requests here via event.
  useEffect(() => {
    const handler = (e) => {
      if (localStorage.getItem('watch_is_guest') !== 'true') return;
      const { roomId: reqRoomId, before } = e.detail || {};
      if (reqRoomId?.toLowerCase() !== roomId?.toLowerCase()) return;
      
      const state = paginationStateRef.current.group;
      if (state.isLoading || !state.hasMore) return;

      const cursor = before;
      state.isLoading = true;
      setGroupHistoryLoading(true);

      if (socket) socket.emit('chat:request_history', { roomId, before: cursor, limit: 200 });
    };
    window.addEventListener('guest_request_more_history', handler);
    return () => window.removeEventListener('guest_request_more_history', handler);
  }, [roomId, socket]);

  const handleClearRoomChat = (targetRoomId = roomId) => {
    setGroupMessages([]);
    const rid = (targetRoomId || roomId || '').toLowerCase();
    if (socket) socket.emit('clear_room_chat', { roomId: rid });
    try {
      const cached = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
      const cleaned = cached.map(c =>
        (c.type === 'room' && (c.partner || c.id || '').toLowerCase() === rid)
          ? { ...c, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0 }
          : c
      );
      localStorage.setItem('watch_recent_chats', JSON.stringify(cleaned));

      const match = cached.find(c => c.type === 'room' && (c.partner || c.id || '').toLowerCase() === rid);
      const clearedMap = JSON.parse(localStorage.getItem('chat_cleared_partners') || '{}');
      if (match) {
        clearedMap[rid] = { ...match, message: '', decryptedText: '', mediaType: null, lastMediaType: null, lastMediaDuration: null, lastSenderName: null, isMyLastMessage: false, lastTimestamp: 0, clearedAt: Date.now() };
      } else {
        clearedMap[rid] = { type: 'room', partner: rid, id: rid, message: '', decryptedText: '', lastTimestamp: 0, clearedAt: Date.now() };
      }
      localStorage.setItem('chat_cleared_partners', JSON.stringify(clearedMap));

      window.dispatchEvent(new Event('conversations_updated'));
      window.dispatchEvent(new Event('chat_cleared_updated'));
    } catch(e){}
  };

  // Guest bridge: GlobalChatWidget has no socket, so it delegates clear room chat here via event.
  useEffect(() => {
    const handler = (e) => {
      if (localStorage.getItem('watch_is_guest') !== 'true') return;
      const { roomId: reqRoomId } = e.detail || {};
      if (reqRoomId?.toLowerCase() === roomId?.toLowerCase()) {
        handleClearRoomChat(reqRoomId);
      }
    };
    window.addEventListener('guest_widget_clear_room_chat', handler);
    return () => window.removeEventListener('guest_widget_clear_room_chat', handler);
  }, [roomId, socket]);

  // Guest bridge: GlobalChatWidget has no socket, so it delegates rename here via event.
  useEffect(() => {
    const handler = (e) => {
      if (localStorage.getItem('watch_is_guest') !== 'true') return;
      const { roomId: reqRoomId, newName } = e.detail || {};
      if (reqRoomId?.toLowerCase() === roomId?.toLowerCase() && socket) {
        socket.emit('mod_rename_room', { roomId, newName });
      }
    };
    window.addEventListener('guest_widget_rename_room', handler);
    return () => window.removeEventListener('guest_widget_rename_room', handler);
  }, [roomId, socket]);


  // Send message
  const sendGroupChat = (e) => {
    e.preventDefault();
    if (groupEditingMessage) { editGroupMessage(); return; }
    if (!groupChatInput.trim() || !socket) return;
    if (!myKeyPair.current) {
      toast.error('Encryption keys not ready yet. Please wait a moment and try again.');
      return;
    }

    const msgText = groupChatInput.trim();
    const ts = Date.now();
    const tempId = `opt-${ts}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Optimistic Update
    const optimisticMsg = {
      id: tempId,
      username,
      message: msgText,
      decryptedText: msgText,
      timestamp: ts,
      reactions: {},
      replyTo: buildReplySnapshot(groupReplyTo),
      _isOptimistic: true
    };
    
    setGroupMessages(prev => {
      const next = [...prev, optimisticMsg];
      groupMessagesRef.current = next;
      return next;
    });

    // ─── E2EE: Encrypt group message for all current room members ────────────
    let encryptedPayload = null;
    try {
      const recipients = buildGroupRecipients();
      encryptedPayload = encryptGroupMessage(msgText, recipients, myKeyPair.current, username);
    } catch (err) {
      console.warn('[E2EE] Group encrypt failed:', err);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Group E2EE is mandatory (matches DM's guarantee) — never fall back to plaintext.
    if (!encryptedPayload) {
      toast.error('Message not sent — encryption failed.');
      setGroupMessages(prev => {
        const next = prev.filter(m => m.id !== tempId);
        groupMessagesRef.current = next;
        return next;
      });
      return;
    }

    socket.emit('chat_message', {
      roomId: (roomId || '').toLowerCase(),
      message: encryptedPayload.ciphertext,
      e2ee: {
        nonce: encryptedPayload.nonce,
        keys: encryptedPayload.keys,
        senderPublicKey: encodeBase64(myKeyPair.current.publicKey)
      },
      username,
      tempId,
      replyTo: optimisticMsg.replyTo
    });

    setGroupReplyTo(null);
    setGroupChatInput('');
    if (socket) {
      socket.emit('chat:stop_typing', { partner: roomId, type: 'room', roomId: (roomId || '').toLowerCase() });
    }
    clearTimeout(typingTimer.current);
  };

  // Group chat is E2EE (fresh key per message, no persistent group key — see
  // buildGroupRecipients/encryptGroupMessage above), so an edit is treated as a
  // brand new encrypted payload, same as sendRawGroupChatRef: fresh secretbox key,
  // re-wrapped for the CURRENT room recipients, replacing the old ciphertext/
  // nonce/keys atomically. Never resend plaintext — a plaintext edit would pair
  // new content with the old nonce/keys server-side and permanently corrupt the
  // row (decryptGroupMessage would then always fail on it).
  const editGroupMessage = () => {
    if (!groupChatInput.trim() || !socket || !groupEditingMessage) return;
    const newText = groupChatInput.trim();
    const target = groupEditingMessage;
    const idStr = String(target.id);

    if (!myKeyPair.current) {
      toast.error('Encryption keys not ready yet. Please wait a moment and try again.');
      return;
    }

    let encryptedPayload = null;
    try {
      const recipients = buildGroupRecipients();
      encryptedPayload = encryptGroupMessage(newText, recipients, myKeyPair.current, username);
    } catch (err) {
      console.warn('[E2EE] Group edit encrypt failed:', err);
    }
    if (!encryptedPayload) {
      toast.error('Edit not sent — encryption failed.');
      return;
    }

    setGroupMessages(prev => {
      const next = prev.map(m => (String(m.id) === idStr ? { ...m, message: encryptedPayload.ciphertext, decryptedText: newText, edited: true, editedAt: Date.now() } : m));
      groupMessagesRef.current = next;
      return next;
    });

    socket.emit('message:edit', {
      messageId: idStr,
      timestamp: target.timestamp ? String(target.timestamp) : undefined,
      newMessage: encryptedPayload.ciphertext,
      nonce: encryptedPayload.nonce,
      e2eeKeys: encryptedPayload.keys,
      ephemeralPublicKey: encodeBase64(myKeyPair.current.publicKey)
    });

    setGroupEditingMessage(null);
    setGroupChatInput('');
  };

  const sendMediaGroupChat = async (url, type, replyTo = null, rawFile = null, mediaDuration = null) => {
    if (!socket) return;
    if (rawFile && !myKeyPair.current) {
      toast.error('Encryption keys not ready yet. Please wait a moment and try again.');
      return;
    }
    const ts = Date.now();
    const tempId = `opt-media-${ts}-${Math.random().toString(36).substr(2, 9)}`;

    // Optimistic Update
    const optimisticUrl = rawFile ? URL.createObjectURL(rawFile) : url;
    const optimisticMsg = {
      id: tempId,
      username,
      message: '',
      decryptedText: '',
      timestamp: ts,
      mediaUrl: optimisticUrl,
      _localMediaUrl: optimisticUrl,
      mediaType: type,
      isMe: true,
      reactions: {},
      replyTo: buildReplySnapshot(replyTo),
      _isOptimistic: true,
      _fileName: rawFile?.name || null,
      _fileSize: rawFile?.size || null,
      mediaDuration: mediaDuration || null
    };

    setGroupMessages(prev => {
      const next = [...prev, optimisticMsg];
      groupMessagesRef.current = next;
      return next;
    });

    let finalUrl = url;
    const token = localStorage.getItem('watch_token');
    let encryptedPayload = null;

    // Group media/files are E2EE, same pattern as DM media: the file is AES-256-GCM
    // encrypted client-side with a fresh random key before upload (server only ever
    // sees the encrypted blob), and that key is itself wrapped for each recipient the
    // same way group text is (encryptGroupMessage), not a separate scheme.
    if (rawFile) {
      try {
        const { encryptedBlob, mediaKeyBytes } = await encryptMedia(rawFile);
        const mediaKeyB64 = encodeBase64(mediaKeyBytes);
        const recipients = buildGroupRecipients();
        encryptedPayload = encryptGroupMessage(mediaKeyB64, recipients, myKeyPair.current, username);

        const fd = new FormData();
        fd.append('file', encryptedBlob, rawFile.name || 'media');
        if (roomId) fd.append('roomId', roomId);
        console.log('[CLIENT UPLOAD] Sending encrypted file:', { name: rawFile.name, size: encryptedBlob.size, type: rawFile.type });
        const uploadHeaders = {};
        if (token) {
          uploadHeaders['Authorization'] = `Bearer ${token}`;
        }
        const uploadResp = await fetch(`${SOCKET_SERVER_URL}/api/upload/chat`, {
          method: 'POST',
          headers: uploadHeaders,
          body: fd
        });
        console.log('[CLIENT UPLOAD] Response status:', uploadResp.status);
        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          console.error('[CLIENT UPLOAD] Error response:', errText);
          let errData = {};
          try { errData = JSON.parse(errText); } catch {}
          throw new Error(errData.error || `Upload failed (${uploadResp.status}): ${errText}`);
        }
        const uploadData = await uploadResp.json();
        console.log('[CLIENT UPLOAD] Success:', uploadData);
        if (!uploadData.url) throw new Error('Upload returned no URL');
        finalUrl = resolveMediaUrl(uploadData.url, SOCKET_SERVER_URL);
      } catch (err) {
        console.error('[MEDIA] Error:', err);
        const msg = (err.message || '').toLowerCase();
        let toastMsg;
        if (msg.includes('too large') || msg.includes('exceeded') || msg.includes('maximum') || msg.includes('size') || msg.includes('413')) {
          toastMsg = 'Videos larger than 50MB cannot be sent in chat.';
        } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
          toastMsg = 'Connection error. Please check your internet and try again.';
        } else if (msg.includes('storage') || msg.includes('bucket') || msg.includes('500')) {
          toastMsg = 'Unable to send file right now. Please try again.';
        } else if (msg.includes('type') || msg.includes('format') || msg.includes('supported')) {
          toastMsg = 'This file type cannot be sent.';
        } else {
          toastMsg = 'Failed to send. Please try again.';
        }
        toast.error(toastMsg, { duration: 4000 });
        setGroupMessages(prev => {
          const next = prev.filter(m => m.id !== tempId);
          groupMessagesRef.current = next;
          return next;
        });
        URL.revokeObjectURL(optimisticUrl);
        return;
      }

      // Group E2EE is mandatory — if the key couldn't be wrapped for anyone, don't send.
      if (!encryptedPayload) {
        toast.error('File not sent — encryption failed.');
        setGroupMessages(prev => {
          const next = prev.filter(m => m.id !== tempId);
          groupMessagesRef.current = next;
          return next;
        });
        URL.revokeObjectURL(optimisticUrl);
        return;
      }
    }

    socket.emit('chat_message', {
      roomId: (roomId || '').toLowerCase(),
      message: encryptedPayload ? encryptedPayload.ciphertext : '',
      username,
      mediaUrl: finalUrl,
      mediaType: type,
      mediaFileName: rawFile?.name || null,
      mediaFileSize: rawFile?.size || null,
      mediaDuration: mediaDuration || null,
      tempId,
      e2ee: encryptedPayload ? { nonce: encryptedPayload.nonce, keys: encryptedPayload.keys, senderPublicKey: encodeBase64(myKeyPair.current.publicKey) } : null,
      replyTo: optimisticMsg.replyTo
    });
  };
  sendGroupMediaRef.current = sendMediaGroupChat;

  const sendDmChat = async (e) => {
    e.preventDefault();
    if (dmEditingMessage) { editDmMessage(); return; }
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
      replyTo: buildReplySnapshot(dmReplyTo),
      _isOptimistic: true
    };
    setDmThreads(prev => {
      const next = { ...prev };
      const key = dmTarget.toLowerCase();
      if (!next[key]) next[key] = [];
      next[key] = [...next[key], optimisticMsg];
      return next;
    });
    setDmReplyTo(null);
    setDmChatInput('');
    if (socket) {
      socket.emit('chat:stop_typing', { partner: dmTarget, type: 'private', roomId: (roomId || '').toLowerCase() });
    }
    clearTimeout(typingTimer.current);

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
          const key = dmTarget.toLowerCase();
          if (next[key]) next[key] = next[key].filter(m => m.id !== tempId);
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
          const key = dmTarget.toLowerCase();
          if (next[key]) next[key] = next[key].filter(m => m.id !== tempId);
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
        const key = dmTarget.toLowerCase();
        if (next[key]) next[key] = next[key].filter(m => m.id !== tempId);
        return next;
      });
    }
  };

  // DM messages are E2EE, so editing must re-run the same encryption steps
  // sendDmChat does above (same public-key lookup cascade), not just resend
  // plaintext. Edit is delivered over the socket (message:edit), matching how
  // handleDeleteMessage already works for both group and in-room DMs here —
  // only the original send happens to go over REST.
  const editDmMessage = async () => {
    if (!dmChatInput.trim() || !socket || !dmTarget || !dmEditingMessage) return;
    const newText = dmChatInput.trim();
    const target = dmEditingMessage;
    const idStr = String(target.id);

    if (!myKeyPair.current && keyPair) myKeyPair.current = keyPair;
    if (!myKeyPair.current) {
      toast.error('Encryption keys not ready yet. Please refresh.');
      return;
    }

    const targetLower = dmTarget.toLowerCase();
    let isEncrypted = false;
    let messagePayload = '';
    let senderMsgPayload = '';
    let nonceVal = '';
    let ephKeyVal = '';

    try {
      const cachedKey = dbPublicKeys.current[targetLower];
      if (cachedKey && cachedKey.length === 32) {
        const enc = encryptDM(newText, encodeBase64(cachedKey), encodeBase64(myKeyPair.current.publicKey));
        messagePayload = enc.ciphertext; senderMsgPayload = enc.senderCiphertext; nonceVal = enc.nonce; ephKeyVal = enc.ephemeralPublicKey; isEncrypted = true;
      }
      if (!isEncrypted) {
        const targetUser = userList.find(u => u.username?.toLowerCase() === targetLower);
        if (targetUser?.publicKey) {
          const enc = encryptDM(newText, targetUser.publicKey, encodeBase64(myKeyPair.current.publicKey));
          messagePayload = enc.ciphertext; senderMsgPayload = enc.senderCiphertext; nonceVal = enc.nonce; ephKeyVal = enc.ephemeralPublicKey; isEncrypted = true;
        }
      }
      if (!isEncrypted) {
        const localPK = localStorage.getItem(`wt_pk_${targetLower}`);
        if (localPK) {
          const enc = encryptDM(newText, localPK, encodeBase64(myKeyPair.current.publicKey));
          messagePayload = enc.ciphertext; senderMsgPayload = enc.senderCiphertext; nonceVal = enc.nonce; ephKeyVal = enc.ephemeralPublicKey; isEncrypted = true;
        }
      }
      if (!isEncrypted) {
        const pkRes = await fetch(`${SOCKET_SERVER_URL}/api/auth/public-key/${encodeURIComponent(dmTarget)}`);
        if (pkRes.ok) {
          const pkData = await pkRes.json();
          if (pkData.publicKey) {
            const enc = encryptDM(newText, pkData.publicKey, encodeBase64(myKeyPair.current.publicKey));
            messagePayload = enc.ciphertext; senderMsgPayload = enc.senderCiphertext; nonceVal = enc.nonce; ephKeyVal = enc.ephemeralPublicKey; isEncrypted = true;
          }
        }
      }
    } catch (err) {
      console.error('[E2EE] editDmMessage encryption error:', err);
    }

    if (!isEncrypted) {
      toast.error(`Recipient "${dmTarget}" has not set up encryption keys yet.`);
      return;
    }

    setDmThreads(prev => {
      const next = { ...prev };
      const key = dmTarget.toLowerCase();
      if (next[key]) {
        next[key] = next[key].map(m => (String(m.id) === idStr ? { ...m, message: messagePayload, decryptedText: newText, edited: true, editedAt: Date.now() } : m));
      }
      return next;
    });

    socket.emit('message:edit', {
      messageId: idStr,
      timestamp: target.timestamp ? String(target.timestamp) : undefined,
      newMessage: messagePayload,
      newSenderMessage: senderMsgPayload,
      nonce: nonceVal,
      ephemeralPublicKey: ephKeyVal
    });

    setDmEditingMessage(null);
    setDmChatInput('');
  };

  const sendMediaDmChat = async (url, type, replyTo = null, rawFile = null, mediaDuration = null) => {
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
      _localMediaUrl: optimisticUrl,
      mediaType: type,
      timestamp: ts,
      isMe: true,
      reactions: {},
      replyTo: buildReplySnapshot(replyTo),
      _isOptimistic: true,
      _fileName: rawFile?.name || null,
      _fileSize: rawFile?.size || null,
      mediaDuration: mediaDuration || null
    };
    setDmThreads(prev => {
      const next = { ...prev };
      const key = dmTarget.toLowerCase();
      if (!next[key]) next[key] = [];
      next[key] = [...next[key], optimisticMsg];
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
        fd.append('file', encryptedBlob, rawFile.name || 'media');
        console.log('[CLIENT UPLOAD] Sending file:', { name: rawFile.name, size: encryptedBlob.size, type: rawFile.type });
        const uploadResp = await fetch(`${SOCKET_SERVER_URL}/api/upload/chat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });
        console.log('[CLIENT UPLOAD] Response status:', uploadResp.status);
        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          console.error('[CLIENT UPLOAD] Error response:', errText);
          let errData = {};
          try { errData = JSON.parse(errText); } catch {}
          throw new Error(errData.error || `Upload failed (${uploadResp.status}): ${errText}`);
        }
        const uploadData = await uploadResp.json();
        console.log('[CLIENT UPLOAD] Success:', uploadData);
        if (!uploadData.url) throw new Error('Upload returned no URL');
        finalUrl = resolveMediaUrl(uploadData.url, SOCKET_SERVER_URL);

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
          mediaFileName: rawFile?.name || null,
          mediaFileSize: rawFile?.size || null,
          mediaDuration: mediaDuration || null,
          nonce: nonceVal,
          ephemeralPublicKey: ephKeyVal,
          encrypted: isEncrypted,
          replyTo: buildReplySnapshot(replyTo),
          tempId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Media message failed to send.');
        setDmThreads(prev => {
          const next = { ...prev };
          const key = dmTarget.toLowerCase();
          if (next[key]) next[key] = next[key].filter(m => m.id !== tempId);
          return next;
        });
      }
    } catch (err) {
      console.error('[MEDIA] Error:', err);
      const msg = (err.message || '').toLowerCase();
      let toastMsg;
      if (msg.includes('too large') || msg.includes('exceeded') || msg.includes('maximum') || msg.includes('size') || msg.includes('413')) {
        toastMsg = 'Videos larger than 50MB cannot be sent in chat.';
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
        toastMsg = 'Connection error. Please check your internet and try again.';
      } else if (msg.includes('storage') || msg.includes('bucket') || msg.includes('500')) {
        toastMsg = 'Unable to send file right now. Please try again.';
      } else if (msg.includes('type') || msg.includes('format') || msg.includes('supported')) {
        toastMsg = 'This file type cannot be sent.';
      } else {
        toastMsg = 'Failed to send. Please try again.';
      }
      toast.error(toastMsg, { duration: 4000 });
      setDmThreads(prev => {
        const next = { ...prev };
        const key = dmTarget.toLowerCase();
        if (next[key]) next[key] = next[key].filter(m => m.id !== tempId);
        return next;
      });
    }
  };
  const handleGroupReact = async (msgId, emoji) => {
    // Optimistic update — apply locally immediately (same pattern as GCW handleReact)
    setGroupMessages(prev => {
      const next = prev.map(m => {
        if (String(m.id) === String(msgId) || (m.timestamp && String(m.timestamp) === String(msgId))) {
          const rx = {};
          for (const [em, uids] of Object.entries(m.reactions || {})) {
            const filtered = (Array.isArray(uids) ? uids : []).filter(u => u !== username);
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
    setActiveReactionMsg(null);
    setShowAllEmojis(false);

    // Use socket communication directly to support reactions without HTTP auth token restrictions
    if (socket) {
      socket.emit('chat:reaction', { roomId: (roomId || '').toLowerCase(), messageId: String(msgId), emoji });
    }
  };
  // Store username on socket for echo-skip
  if (socket) socket.__username = username;

  const handleStopMedia = useCallback(() => {
    // A call is a two-person conversation, not host-controlled shared media: if we're
    // leaving activity://videocall or activity://voicecall, hang up properly no matter
    // which button triggered this (End Call, Exit, the Stop menu, player Stop, etc.) —
    // stop our own camera/mic and tell the other participant to hang up too.
    if (mediaUrl === 'activity://videocall' || mediaUrl === 'activity://voicecall') {
      if (isCamOn) toggleCameraRef.current?.();
      if (isMicOnCam) toggleMicRef.current?.();
      if (socket) socket.emit('call_ended', { roomId: (roomId || '').toLowerCase() });
    }
    // Cleanup trigger (a): always end cloud browser session when host stops media
    if (hbSessionId || hyperbeamSession) {
      const rid = (roomId || '').toLowerCase();
      const token = localStorage.getItem('watch_token');
      fetch(`${SOCKET_SERVER_URL}/api/hyperbeam/session/${rid}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }).catch(() => {});
      setHyperbeamSession(null);
      setHbSessionId(null);
      if (socket) socket.emit('hyperbeam_closed', { roomId: rid });
    }
    setLoadFailed(false);
    clearTimeout(loadTimeoutRef.current);
    setMediaUrl('');
    setIsPlaying(false);
    setBufferedSeconds(0);
    setIsPreparing(false);
    setActiveExternalApp(null);
    setInputUrl('');
    if (socket) socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: '' });
  }, [socket, roomId, hbSessionId, hyperbeamSession, mediaUrl, isCamOn, isMicOnCam]);

  const handleCast = () => {
    setShowCastDiscovery(true);
  };

  const handleDmReact = async (msgId, emoji) => {
    // Optimistic update (same pattern as GCW handleReact)
    setDmThreads(prev => {
      const tb = { ...prev };
      const key = dmTarget.toLowerCase();
      if (!tb[key]) return tb;
      tb[key] = tb[key].map(m => {
        if (String(m.id) === String(msgId) || (m.timestamp && String(m.timestamp) === String(msgId))) {
          const rx = {};
          for (const [em, uids] of Object.entries(m.reactions || {})) {
            const filtered = (Array.isArray(uids) ? uids : []).filter(u => u !== username);
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
    setActiveReactionMsg(null);
    setShowAllEmojis(false);

    try {
      await fetch(`${SOCKET_SERVER_URL}/api/chats/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('watch_token')}` },
        body: JSON.stringify({ messageId: String(msgId), emoji })
      });
    } catch(e) { console.error('[handleDmReact] react error', e); }
  };


  // Ã¢â€ â‚¬Ã¢â€ â‚¬ Media Ã¢â€ â‚¬Ã¢â€ â‚¬
  const stopBrowser = () => {
    if (hbSessionId) {
      fetch(`${SOCKET_SERVER_URL}/api/browser/session/${hbSessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('watch_token')}` }
      }).catch(() => {});
      setHbSessionId(null);
    }
    setBrowserDisplayUrl('');
    setBrowserBarInput('');
  };

  // ─── Hyperbeam Cloud Browser handlers ──────────────────────────────────────
  // SECURITY: API key never touches the frontend. We only talk to our own backend.

  const handleOpenCloudBrowser = async (overrideUrl) => {
    const rawUrl = (typeof overrideUrl === 'string' ? overrideUrl : null) || failedPlaybackUrl || mediaUrl;
    if (!rawUrl || !socket) return;

    const targetUrl = normalizeUrl(rawUrl);
    if (!targetUrl) {
      toast.error('Invalid URL — cannot open Virtual Browser');
      return;
    }
    console.log('[HYPERBEAM] normalizedUrl:', targetUrl);

    const rid = (roomId || '').toLowerCase();
    const token = localStorage.getItem('watch_token');
    const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    setIsLaunchingVirtualBrowser(true);
    const loadingToast = toast.loading('Opening Virtual Browser…');
    try {
      const isGame = isMediaGame(targetUrl);

      // Detect optimal Hyperbeam server region based on browser timezone
      const getOptimalRegion = () => {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz.includes('Asia') || tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('India')) return 'AS';
          if (tz.includes('Europe') || tz.includes('GMT')) return 'EU';
        } catch (e) {}
        return 'NA';
      };
      const region = getOptimalRegion();

      console.log('[HYPERBEAM] Sending create-session with url:', targetUrl, 'isGame:', isGame, 'region:', region);
      const res = await fetch(`${SOCKET_SERVER_URL}/api/hyperbeam/create-session`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ roomId: rid, url: targetUrl, isGame, region })
      });
      const data = await res.json();
      if (!res.ok || !data.session_id) throw new Error(data.error || 'Unknown error');
      console.log('[HYPERBEAM] session_id received:', data.session_id);
      console.log('[HYPERBEAM] targetUrl from backend:', data.targetUrl);

      hyperbeamTargetUrlRef.current = data.targetUrl || targetUrl;
      hbAdminTokenRef.current = data.admin_token || null;
      setHbNavStatus('connecting');
      toast.success('Virtual Browser ready!', { id: loadingToast, duration: 2000 });
      setHyperbeamSession({ session_id: data.session_id, embed_url: data.embed_url });
      setHbSessionId(data.session_id);
      setLoadFailed(false);
      setIsLaunchingVirtualBrowser(false);
      clearTimeout(loadTimeoutRef.current);
      socket.emit('hyperbeam_opened', {
        roomId: rid,
        session_id: data.session_id,
        embed_url: data.embed_url,
        targetUrl: data.targetUrl || targetUrl
      });

    } catch (err) {
      console.error('[HYPERBEAM] Failed to open virtual browser:', err);
      toast.error('Virtual Browser failed to start. Please try again.', { id: loadingToast });
      setIframeLoading(false);
      setLoadFailed(true);
      setIsLaunchingVirtualBrowser(false);
    }
  };

  const handleCloseCloudBrowser = async () => {
    if (!hyperbeamSession && !hbSessionId) return;
    const rid = (roomId || '').toLowerCase();
    const token = localStorage.getItem('watch_token');
    try {
      await fetch(`${SOCKET_SERVER_URL}/api/hyperbeam/session/${rid}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch (e) {
      console.warn('[HYPERBEAM] Close request error (session may already be gone):', e.message);
    }
    setHyperbeamSession(null);
    setHbSessionId(null);
    setLoadFailed(false);
    setHbNavStatus(null);
    hbAdminTokenRef.current = null;
    hyperbeamTargetUrlRef.current = null;
    if (socket) socket.emit('hyperbeam_closed', { roomId: rid });
  };

  // ─── Responsive breakpoint tracker ──────────────────────────────────────
  useEffect(() => {
    const update = () => setIsMobile(detectIsMobile());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // ─── Hyperbeam SDK initialization ────────────────────────────────────────
  // start_url (set at session creation) handles initial navigation.
  // SDK is responsible for connecting the WebRTC stream and filling the container.
  useEffect(() => {
    const embedUrl = hyperbeamSession?.embed_url;
    if (!embedUrl) return;

    let hb = null;
    let cancelled = false;
    let ro = null;
    let roDebounce = null;
    let watchdogTimer = null;
    let hasAttemptedRecovery = false;

    // Resize the virtual browser to match the container exactly.
    // Session runs at Hyperbeam's default 1280×720 — this account's plan doesn't
    // allow requesting a custom width/height (err_api_restricted), so the SDK's
    // resize() is what stretches/fits it to the actual player container.
    const syncResize = (el, inst) => {
      if (cancelled || !el || !inst) return;
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w < 256 || h < 256) return;
      try {
        inst.resize(w, h);
        console.log('[HYPERBEAM] resize →', w, 'x', h);
      } catch (e) {
        console.warn('[HYPERBEAM] resize skipped:', e.message);
      }
    };

    const init = async () => {
      await new Promise(r => requestAnimationFrame(r));
      if (cancelled || !hyperbeamContainerRef.current) return;
      try {
        const sdkOptions = {
          onConnectionStateChange: ({ state }) => {
            console.log('[HYPERBEAM] connectionState:', state);
            if (cancelled) return;
            if (state === 'playing') {
              setHbNavStatus(null);
              clearTimeout(watchdogTimer);
              hasAttemptedRecovery = false; // a later disconnect deserves its own recovery attempt
            } else {
              setHbNavStatus('connecting');
              armWatchdog();
            }
          },
        };
        // If the connection ever gets stuck outside 'playing' for this long (e.g. a
        // WebRTC renegotiation triggered by navigating inside the remote page — like
        // clicking "Sign In" — that never completes), destroy and reconnect once
        // rather than leaving the viewer staring at a spinner forever. The remote
        // session/VM itself is untouched — this only re-establishes our end's stream.
        const armWatchdog = () => {
          clearTimeout(watchdogTimer);
          watchdogTimer = setTimeout(async () => {
            if (cancelled || hasAttemptedRecovery || !hyperbeamContainerRef.current) return;
            hasAttemptedRecovery = true;
            console.warn('[HYPERBEAM] Stuck outside "playing" for 15s — attempting one automatic reconnect');
            try {
              if (hb) hb.destroy();
              hb = await Hyperbeam(hyperbeamContainerRef.current, embedUrl, sdkOptions);
              if (cancelled) { hb.destroy(); return; }
              hyperbeamInstanceRef.current = hb;
              syncResize(hyperbeamContainerRef.current, hb);
            } catch (err) {
              console.error('[HYPERBEAM] Automatic reconnect failed:', err);
            }
          }, 15000);
        };
        if (hbAdminTokenRef.current) {
          sdkOptions.adminToken = hbAdminTokenRef.current;
        }
        hb = await Hyperbeam(hyperbeamContainerRef.current, embedUrl, sdkOptions);
        if (cancelled) { hb.destroy(); return; }
        hyperbeamInstanceRef.current = hb;
        if (!cancelled) setHbNavStatus(null);

        // Navigate to target URL. start_url covers new VM sessions; tabs.update covers
        // cached/deduped sessions already running on a different (or blank) page.
        const navUrl = hyperbeamTargetUrlRef.current;
        if (navUrl && hbAdminTokenRef.current && !cancelled) {
          try {
            const activeTabs = await hb.tabs.query({ active: true, currentWindow: true });
            if (activeTabs?.[0]?.id != null) {
              await hb.tabs.update(activeTabs[0].id, { url: navUrl });
              console.log('[HYPERBEAM] tabs.update →', navUrl);
            }
          } catch (navErr) {
            console.warn('[HYPERBEAM] tabs.update skipped:', navErr.message);
          }
        }

        // Initial resize to fill container exactly
        syncResize(hyperbeamContainerRef.current, hb);

        // Keep resize in sync when container dimensions change (sidebar, window resize, etc.)
        if (window.ResizeObserver && hyperbeamContainerRef.current) {
          ro = new ResizeObserver(() => {
            clearTimeout(roDebounce);
            roDebounce = setTimeout(() => syncResize(hyperbeamContainerRef.current, hyperbeamInstanceRef.current), 120);
          });
          ro.observe(hyperbeamContainerRef.current);
        }
      } catch (err) {
        console.error('[HYPERBEAM SDK] Failed to initialize:', err);
        if (!cancelled) setHbNavStatus(null);
      }
    };

    init();

    return () => {
      cancelled = true;
      clearTimeout(roDebounce);
      clearTimeout(watchdogTimer);
      if (ro) ro.disconnect();
      hyperbeamTargetUrlRef.current = null;
      hbAdminTokenRef.current = null;
      if (hb) { hb.destroy(); }
      else if (hyperbeamInstanceRef.current) { hyperbeamInstanceRef.current.destroy(); }
      hyperbeamInstanceRef.current = null;
    };
  }, [hyperbeamSession?.embed_url]);

  // Cleanup trigger (d): end cloud browser session on component unmount
  useEffect(() => {
    return () => {
      clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  // Legacy Redirect for CrazyGames Lobby URL to new direct URL
  useEffect(() => {
    if (mediaUrl === 'lobby://crazygames') {
      if (isEffectiveHost) {
        changeMedia('https://www.crazygames.com');
      } else {
        setMediaUrl('https://www.crazygames.com');
      }
    }
  }, [mediaUrl, isEffectiveHost]);

  // Virtual Browser loading timeout removed — virtual browser no longer auto-starts.

  // Clear timeout and loading spinner once Hyperbeam session is active
  useEffect(() => {
    if (hyperbeamSession) {
      clearTimeout(loadTimeoutRef.current);
      setIframeLoading(false);
      setLoadFailed(false);
    }
  }, [hyperbeamSession]);

  // Navigate the active Virtual Browser when mediaUrl changes
  useEffect(() => {
    const inst = hyperbeamInstanceRef.current;
    if (inst && mediaUrl && isEffectiveHost) {
      const navUrl = normalizeUrl(mediaUrl);
      if (navUrl && isVirtualBrowserUrl(navUrl)) {
        console.log('[HYPERBEAM] Navigating active VM to:', navUrl);
        inst.tabs.query({ active: true, currentWindow: true }).then(activeTabs => {
          if (activeTabs?.[0]?.id != null) {
            inst.tabs.update(activeTabs[0].id, { url: navUrl }).catch(err => {
              console.warn('[HYPERBEAM] tabs.update error:', err.message);
            });
          }
        }).catch(err => {
          console.warn('[HYPERBEAM] tabs.query error:', err.message);
        });
      }
    }
  }, [mediaUrl, isEffectiveHost]);

  const changeMedia = async (url, launchType) => {
    if (!url) { toast.error('Enter a URL first'); return; }
    try { new URL(url); } catch { toast.error('Invalid URL'); return; }

    // Virtual browser is no longer auto-launched for any URL.
    // All game/site URLs now load as plain iframes; user must manually click "Cloud Browser" if needed.
    const isVirtual = launchType === 'virtual_browser';
    if (isVirtual) {
      // Already showing this exact Virtual Browser target — don't tear an active,
      // working session down and recreate it (that briefly nulls hyperbeamSession,
      // which is exactly what let the plain-iframe fallback/"blocks embedding"
      // overlay flash back up on re-clicks).
      if ((hyperbeamSession || hbSessionId) && browserDisplayUrl === url) {
        return;
      }
      if (hyperbeamSession || hbSessionId) {
        await handleCloseCloudBrowser();
      }
      setIsVirtualBrowserMedia(true);
      setIframeBlockSuspected(false);
      setLoadFailed(false);
      setIframeError(false);
      setIframeLoading(true);
      clearTimeout(loadTimeoutRef.current);

      if (isScreensharing) stopScreenshare();
      setShowYtBrowser(false);
      setShowTwitchBrowser(false);
      setShowVimeoBrowser(false);

      setBrowserDisplayUrl(url);
      setBrowserBarInput(url);
      socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: url, browserUrl: url });

      if (isEffectiveHost) {
        setTimeout(() => {
          handleOpenCloudBrowser(url);
        }, 100);
      }
      return;
    }

    setIsVirtualBrowserMedia(false);

    if (url.includes('vimeo.com')) {
      const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/i);
      const vId = match ? match[1] : null;
      if (!vId) {
        toast.error('Invalid Vimeo video URL.');
        return;
      }
    }

    // Cleanup trigger (b): close any active cloud browser before loading new media
    if (hyperbeamSession || hbSessionId) {
      await handleCloseCloudBrowser();
    }
    setLoadFailed(false);
    setIframeError(false);
    setIframeLoading(true);
    clearTimeout(loadTimeoutRef.current);

    if (isScreensharing) stopScreenshare();
    setShowYtBrowser(false);
    setShowTwitchBrowser(false);
    setShowVimeoBrowser(false);

    if (!ReactPlayer.canPlay(url)) {
      // Non-embeddable URL — show as iframe directly.
      // User can manually click "🌐 Cloud Browser" if the page blocks iframes.
      setBrowserDisplayUrl(url);
      setBrowserBarInput(url);
      socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: url, browserUrl: url });
      return;
    }

    // ReactPlayer-compatible URL — start the 10s failure detection timer
    setBrowserDisplayUrl('');
    setBrowserBarInput('');
    prepTargetTimeRef.current = 0;
    socket.emit('change_media', { roomId: (roomId || '').toLowerCase(), mediaUrl: url });

    // Start load-failure timer: if ReactPlayer doesn't fire onReady within 10s, show fallback
    loadTimeoutRef.current = setTimeout(() => {
      console.warn('[PLAYBACK] Load timed out — showing Cloud Browser fallback for:', url);
      setFailedPlaybackUrl(url);
      setLoadFailed(true);
    }, 10000);

    // Reset saved position if host loads a new URL
    if (isEffectiveHost) {
      const mType = detectMediaType(url);
      if (mType) {
        socket.emit('media_position_save', { roomId: (roomId || '').toLowerCase(), url, position: 0, mediaType: mType });
      }
    }
  };
  const handleFileUpload = async (file) => {
    console.log('[FILE] handleFileUpload called:', file?.name, 'type:', file?.type, 'size:', file?.size, 'roomId:', roomId, 'socket:', !!socket);
    if (!file) { console.log('[FILE] Rejected: no file'); return; }
    if (file.type && !file.type.startsWith('video/')) {
      console.log('[FILE] Rejected: not a video type:', file.type);
      toast.error('Only video files are allowed!');
      return;
    }
    // Stop any active screenshare/browsers before starting upload
    if (isScreensharing) stopScreenshare();
    setShowYtBrowser(false);
    setShowTwitchBrowser(false);
    setShowVimeoBrowser(false);

    // Create a local blob URL so the host starts watching immediately
    const localUrl = URL.createObjectURL(file);
    setMediaUrl(localUrl);
    setIsPlaying(true);
    prepTargetTimeRef.current = 0;

    console.log('[FILE] Calling uploadFile, roomId:', roomId, 'socket:', !!socket);
    // Kick off chunked upload — progress tracked via uploadState
    uploadFile(file);
  };
  const handlePlay = () => { if (Date.now() - lastExternalUpdate.current < 500) return; socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: playerRef.current?.getCurrentTime() || 0 }); setIsPlaying(true); };
  const handlePause = () => {
    if (Date.now() - lastExternalUpdate.current < 500) return;
    const pos = getPlayerPosition();
    socket.emit('pause', { roomId: (roomId || '').toLowerCase(), currentTime: pos });
    setIsPlaying(false);
    if (isEffectiveHost && mediaUrl) {
      const mType = detectMediaType(mediaUrl);
      if (mType && pos > 0) {
        socket.emit('media_position_save', { roomId: (roomId || '').toLowerCase(), url: mediaUrl, position: pos, mediaType: mType });
      }
    }
  };
  
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

    const currentPos = getPlayerPosition();
    if (isPlaying) {
      socket.emit('pause', { roomId: (roomId || '').toLowerCase(), currentTime: currentPos });
      setIsPlaying(false);
    } else {
      socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: currentPos });
      setIsPlaying(true);
    }
  };

  const handleScrubberChange = (e) => {
    const t = parseFloat(e.target.value);
    if (localVideoRef.current) {
      localVideoRef.current.currentTime = t;
    } else {
      playerRef.current?.seekTo(t, 'seconds');
    }
    lastExternalUpdate.current = Date.now();
    socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: t });
    setCurrentTime(t);
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    playerVolumeRef.current = v;
    setPlayerVolume(v);
    setPlayerMuted(v === 0);
  };

  const skipBack10 = () => {
    const pos = getPlayerPosition();
    const newTime = Math.max(0, pos - 10);
    if (localVideoRef.current) {
      localVideoRef.current.currentTime = newTime;
    } else {
      playerRef.current?.seekTo(newTime, 'seconds');
    }
    lastExternalUpdate.current = Date.now();
    socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: newTime });
    setCurrentTime(newTime);
  };

  const skipForward10 = () => {
    const pos = getPlayerPosition();
    const newTime = Math.min(duration, pos + 10);
    if (localVideoRef.current) {
      localVideoRef.current.currentTime = newTime;
    } else {
      playerRef.current?.seekTo(newTime, 'seconds');
    }
    lastExternalUpdate.current = Date.now();
    socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: newTime });
    setCurrentTime(newTime);
  };

  const toggleMutePlayer = () => setPlayerMuted(m => !m);

  // Mobile tap-gesture handler for the video surface: left/right thirds double-tap to
  // seek ±10s (single tap there toggles the control bar), center third single-tap
  // toggles play/pause. Zone-scoped double-tap detection (not a single global one) so a
  // left-then-right double tap doesn't misfire as a seek.
  const DOUBLE_TAP_MS = 300;
  const handlePlayerZoneTap = (zone) => {
    if (zone === 'center') {
      if (hasPlayerPrivileges) {
        togglePlayPause();
        clearTimeout(centerFeedbackTimerRef.current);
        // isPlaying is still the pre-toggle value here (closure), so its opposite
        // is the state the video is transitioning into — show that icon.
        setCenterFeedback({ type: isPlaying ? 'pause' : 'play', key: Date.now() });
        centerFeedbackTimerRef.current = setTimeout(() => setCenterFeedback(null), 550);
      }
      resetControlsTimer();
      return;
    }

    const now = Date.now();
    const isDoubleTap = lastTapRef.current.zone === zone && (now - lastTapRef.current.time) < DOUBLE_TAP_MS;
    lastTapRef.current = { zone, time: now };

    if (isDoubleTap) {
      clearTimeout(tapTimerRef.current);
      if (hasPlayerPrivileges && duration > 0) {
        if (zone === 'left') skipBack10(); else skipForward10();
        clearTimeout(seekFeedbackTimerRef.current);
        setSeekFeedback({ dir: zone === 'left' ? 'back' : 'forward', key: now });
        seekFeedbackTimerRef.current = setTimeout(() => setSeekFeedback(null), 650);
      }
      return;
    }

    // Not (yet) a double-tap — wait out the window in case a second tap follows,
    // then treat it as a plain single tap that toggles the control bar.
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      if (showControls) {
        clearTimeout(controlsTimerRef.current);
        setShowControls(false);
      } else {
        resetControlsTimer();
      }
    }, DOUBLE_TAP_MS);
  };

  useEffect(() => {
    return () => {
      clearTimeout(tapTimerRef.current);
      clearTimeout(seekFeedbackTimerRef.current);
      clearTimeout(centerFeedbackTimerRef.current);
    };
  }, []);



  const startScreenshare = async (videoConstraints = true, appWindow = null, appInfo = null) => {
    // getDisplayMedia is a desktop-browser API. iOS Safari (all browsers on iOS use
    // Safari's engine, including Chrome/Edge for iOS) has no screen-capture API at all
    // for regular web pages — that's an Apple platform restriction, not something a
    // website can work around. Android Chrome supports it from ~v105 with a native
    // OS picker (which already gives the "entire screen / a window / a tab" choice —
    // we don't need to build our own picker UI for that). Without this check the call
    // below throws synchronously and was being swallowed by console.error with zero
    // user-facing feedback, which is what made this look like "does nothing" on mobile.
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error(
        isMobile
          ? "Screen sharing isn't supported on this browser. iOS (Safari/Chrome/Edge) can't screen-share from a website at all — try a recent Chrome on Android, or share from a desktop browser instead."
          : "Screen sharing isn't supported on this browser. Try Chrome, Edge, or Firefox."
      );
      return;
    }
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
    } catch (err) {
      console.error(err);
      // Surface *something* to the user — this used to fail completely silently,
      // which on mobile (denied permission, or the OS picker being dismissed) looked
      // indistinguishable from "screen share doesn't work at all".
      if (err.name === 'NotAllowedError') {
        toast.error('Screen share permission was denied or cancelled.');
      } else if (err.name === 'NotSupportedError') {
        toast.error("Your browser doesn't support screen sharing.");
      } else if (err.name !== 'AbortError') {
        // AbortError = user closed the OS picker without choosing anything — not worth a toast.
        toast.error(`Couldn't start screen sharing: ${err.message || err.name}`);
      }
    }
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
  // Local-only: a viewer stepping away from someone else's screenshare. Does NOT
  // notify the server or other participants — the broadcast keeps running for
  // everyone else. Mirrors the cleanup the 'webrtc_screenshare_stopped' socket
  // handler does when the actual sharer ends it.
  const leaveScreenshareView = () => {
    setIsViewer(false);
    setRemoteStream(null);
    setActiveExternalApp(null);
    Object.values(peerConnectionsRef.current).forEach(p => p.close());
    peerConnectionsRef.current = {};
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ Camera / Mic Toggle Ã¢â€â‚¬Ã¢â€â‚¬
  // ─── Camera / Mic Toggle ───
  const toggleCamera = async () => {
    console.log('toggleCamera clicked. isCamOn:', isCamOn);
    if (isCamOn) {
      // Turn off — stop every track so the browser releases both camera and mic hardware
      localCamRef.current?.getTracks().forEach(t => t.stop());
      localCamRef.current = null;
      setIsCamOn(false);
      isCamOnRef.current = false;
      // The camera stream carried the mic track too, so mic is now off at the hardware level
      setIsMicOnCam(false);
      if (socket) socket.emit('self_mute', { roomId: (roomId || '').toLowerCase(), isMuted: true });

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

    if (nextState) {
      // ── TURNING ON ──
      const hasLiveAudio = localCamRef.current?.getAudioTracks().some(t => t.readyState === 'live');

      if (!hasLiveAudio) {
        // No stream at all, or audio tracks were stopped — must acquire mic hardware fresh
        try {
          const selectedMic = localStorage.getItem('watch_selected_mic');
          let audioStream;
          if (selectedMic) {
            try {
              audioStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: selectedMic } },
                video: false,
              });
            } catch {
              // Exact device not accessible in this browser — fall back to system default
              audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
          } else {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
          const newTrack = audioStream.getAudioTracks()[0];

          if (localCamRef.current) {
            // Camera is running — graft the new audio track onto the existing stream
            localCamRef.current.getAudioTracks().forEach(t => localCamRef.current.removeTrack(t));
            localCamRef.current.addTrack(newTrack);
            // Slot it into any open camera peer connections
            Object.values(cameraPcRefs.current).forEach(pc => {
              const existingSender = pc.getSenders().find(s => s.track?.kind === 'audio');
              if (existingSender) existingSender.replaceTrack(newTrack).catch(() => {});
              else pc.addTrack(newTrack, localCamRef.current);
            });
          } else {
            // No camera stream — keep the audio-only stream
            localCamRef.current = audioStream;
          }
        } catch (err) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            toast.error('Microphone permission denied. Click the lock icon in your browser address bar and allow microphone access.');
          } else if (err.name === 'NotFoundError') {
            toast.error('No microphone found. Please connect a microphone and try again.');
          } else {
            toast.error('Could not access microphone. Check your browser permissions.');
          }
          return;
        }
      } else {
        // Audio track is already live (was just enabled=false) — re-enable it
        localCamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
      }
    } else {
      // ── TURNING OFF ── stop tracks entirely so the browser releases the mic hardware
      if (localCamRef.current) {
        const audioTracks = localCamRef.current.getAudioTracks();
        audioTracks.forEach(t => {
          t.stop();
          try { localCamRef.current.removeTrack(t); } catch {}
        });
        // Remove audio senders from peer connections so the device indicator clears
        Object.values(cameraPcRefs.current).forEach(pc => {
          pc.getSenders().filter(s => s.track?.kind === 'audio').forEach(s => {
            try { pc.removeTrack(s); } catch {}
          });
        });
        // If camera is also off, clean up the entire stream
        if (!isCamOn) {
          localCamRef.current.getTracks().forEach(t => t.stop());
          localCamRef.current = null;
        }
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = nextState; });
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

  useEffect(() => {
    toggleCameraRef.current = toggleCamera;
    toggleMicRef.current = toggleMic;
  });

  const openDM = (uname) => {
    dmTargetRef.current = uname; setDmTarget(uname); setChatTab('dm');
    chatTabRef.current = 'dm';
    // Seed an empty thread so this person appears in the Chats sidebar immediately,
    // even before the first message is sent.
    setDmThreads(prev => {
      const key = uname.toLowerCase();
      if (prev[key]) return prev;
      return { ...prev, [key]: [] };
    });
    setDmUnread(prev => {
      const next = { ...prev };
      next[uname.toLowerCase()] = 0;
      return next;
    });
    if (dmUnreadRef.current) {
      dmUnreadRef.current[uname.toLowerCase()] = 0;
    }
    setReactionPreviews(prev => { const next = { ...prev }; delete next[uname.toLowerCase()]; return next; });
    clearPersistedReactionPreview(uname.toLowerCase());
  };
  const totalDmUnread = Object.values(dmUnread).reduce((a, b) => a + b, 0);

  const copyRoomLink = () => { if (copied) return; navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Link copied!'); };

  // Shared by the desktop settings dropdown and the mobile bottom sheet.
  const togglePinRoom = async () => {
    const isPinned = pinnedRooms.includes(roomId);
    const next = isPinned ? pinnedRooms.filter(r => r !== roomId) : [...pinnedRooms, roomId];
    setPinnedRooms(next);
    localStorage.setItem('pinned_rooms', JSON.stringify(next));

    const token = localStorage.getItem('watch_token');
    if (token) {
      try {
        await fetch(`${SOCKET_SERVER_URL}/api/profile/pinned-rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ pinnedRooms: next })
        });
      } catch (err) {
        console.error('Failed to sync pinned rooms', err);
      }
    }
    toast.success(isPinned ? 'Room unpinned' : 'Room pinned!');
  };

  const [reportMsgTarget, setReportMsgTarget] = React.useState(null);

  const reportMsg = (msg) => {
    setReportMsgTarget(msg);
  };

  // Mobile/iPad swipe-back should close whichever room modal/browser is
  // open instead of leaving the room. Grouped as a single level since these
  // are mutually exclusive in practice (opening one already closes the
  // others — see MediaSelectorModal's onSelectPlatform etc).
  const anyRoomModalOpen = showMediaSelector || showYtBrowser || showTwitchBrowser || showVimeoBrowser
    || roomSettingsModalOpen || showShareModal || showCustomizeModal || showSubtitleSettingsModal
    || !!showGuidedShare || !!banConfirmTarget || renameModalOpen || clearChatModalOpen
    || showCastDiscovery || !!reportMsgTarget || showMobileMenu || showPersonalDeleteConfirm
    || showNotificationSettings;
  const roomModalsBack = useBackIntercept(anyRoomModalOpen ? 1 : 0, (newLevel) => {
    if (newLevel === 0) {
      setShowMediaSelector(false);
      setShowYtBrowser(false);
      setShowTwitchBrowser(false);
      setShowVimeoBrowser(false);
      setRoomSettingsModalOpen(false);
      setShowShareModal(false);
      setShowCustomizeModal(false);
      setShowSubtitleSettingsModal(false);
      setShowGuidedShare(null);
      setBanConfirmTarget(null);
      setRenameModalOpen(false);
      setClearChatModalOpen(false);
      setShowCastDiscovery(false);
      setReportMsgTarget(null);
      setShowMobileMenu(false);
      setShowPersonalDeleteConfirm(false);
      setShowNotificationSettings(false);
    }
  });

  // Web-view keyboard shortcuts: Space toggles play/pause, ←/→ seek ±10s.
  // Mobile has its own tap-gesture layer for this, so skip there. Bails out
  // whenever focus is on a text field (chat box etc.) or any modal/dropdown
  // is open, so it never hijacks Space-to-click-a-button or typing " " in chat.
  useEffect(() => {
    if (isTouchPlayer || isTvMode || !hasMounted || !mediaUrl) return;
    if (isScreensharing || isViewer) return;
    if (isGameOrActivity(mediaUrl) || isWebIframe(mediaUrl) || isEmbedPlatform(mediaUrl)) return;

    const handleKeyDown = (e) => {
      if (anyRoomModalOpen || showQualityMenu || showSubtitleMenu) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (!hasPlayerPrivileges) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight' && duration > 0) {
        e.preventDefault();
        skipForward10();
      } else if (e.code === 'ArrowLeft' && duration > 0) {
        e.preventDefault();
        skipBack10();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTouchPlayer, isTvMode, hasMounted, mediaUrl, isScreensharing, isViewer, hasPlayerPrivileges, duration, isPlaying, anyRoomModalOpen, showQualityMenu, showSubtitleMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile/iPad swipe-back while in the CSS-driven mobile fullscreen (games,
  // activities, calls) should exit fullscreen instead of navigating away.
  const mobileFsBack = useBackIntercept(isTouchPlayer && isMobileFsMode ? 1 : 0, (newLevel) => {
    if (newLevel === 0) {
      setIsMobileFsMode(false);
      if (screen?.orientation?.unlock) screen.orientation.unlock();
    }
  });

  // Belt-and-suspenders for the mobile/iPad fullscreen edge-gap fix — see the
  // sp-mobile-fs-active CSS rule in index.css.
  useEffect(() => {
    const active = isTouchPlayer && isMobileFsMode;
    document.documentElement.classList.toggle('sp-mobile-fs-active', active);
    document.body.classList.toggle('sp-mobile-fs-active', active);
    return () => {
      document.documentElement.classList.remove('sp-mobile-fs-active');
      document.body.classList.remove('sp-mobile-fs-active');
    };
  }, [isTouchPlayer, isMobileFsMode]);

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
            <p style={{ marginTop: 24, padding: '8px 16px', background: 'rgba(var(--brand-1-rgb),0.1)', borderRadius: 20, border: '1px solid rgba(var(--brand-1-rgb),0.2)', color: 'var(--brand-1)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Verifying Security...</p>
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
        <div style={{ maxWidth: 440, width: '90%', padding: '48px 40px', background: isLightMode ? '#ffffff' : 'rgba(255,255,255,0.02)', borderRadius: 40, border: isLightMode ? '1px solid rgba(var(--brand-2-rgb),0.2)' : '1px solid rgba(var(--brand-2-rgb),0.15)', boxShadow: isLightMode ? '0 20px 40px rgba(0,0,0,0.05)' : '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(var(--brand-2-rgb),0.05)', backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden' }}>
          {/* Top gradient accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--brand-1), var(--brand-2), #ec4899)', borderRadius: '40px 40px 0 0' }} />
          {/* Icon - steady glow */}
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(var(--brand-1-rgb),0.15), rgba(var(--brand-2-rgb),0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', color: 'var(--brand-2)', border: '1px solid rgba(var(--brand-2-rgb),0.25)', boxShadow: '0 0 40px rgba(var(--brand-2-rgb),0.2)' }}>
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
            {t('leaveRoom', 'Leave Room')}
          </button>
        </div>
      </div>
    );
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // ─── Kicked / Not Found Modal ───
  if (roomNotFound || kickedReason || forceMembersOnlyLock) {
    const isDeleted = kickedReason === 'room_deleted' || kickedReason === 'room_closed_by_admin';
    const isBanned = kickedReason === 'banned';
    const isDenied = kickedReason === 'denied';
    const isMembersOnly = kickedReason === 'members_only' || forceMembersOnlyLock;
    const isAdminKick = kickedReason === 'admin_kick';

    return (
      <div style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'linear-gradient(135deg, #0f0a23 0%, #05030a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }} className="room-modals-overlay">
        <div style={{ textAlign: 'center', padding: 48, background: isLight ? '#ffffff' : 'rgba(255,255,255,0.02)', borderRadius: 48, border: isLight ? '1px solid rgba(var(--brand-1-rgb), 0.15)' : '1px solid rgba(255,255,255,0.05)', maxWidth: 500, width: '90%', boxShadow: isLight ? '0 32px 80px rgba(var(--brand-1-rgb), 0.08)' : '0 40px 100px rgba(0,0,0,0.8)' }}>
          <div style={{ width: 120, height: 120, borderRadius: '35%', background: isLight ? 'rgba(var(--brand-1-rgb), 0.08)' : 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px', color: 'var(--brand-1)', transform: 'rotate(-8deg)', border: isLight ? '1px solid rgba(var(--brand-1-rgb), 0.15)' : '1px solid rgba(var(--brand-1-rgb),0.2)', position: 'relative' }}>
            {isBanned ? <Ban size={56} /> : (isDenied || isMembersOnly) ? <Lock size={56} /> : (isDeleted || roomNotFound ? <Hash size={56} /> : <LogOut size={56} />)}
            <div className="stay-white" style={{ position: 'absolute', top: -8, right: -8, width: 42, height: 42, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', border: isLight ? '6px solid #ffffff' : '6px solid #0f0a23', transform: 'rotate(8deg)', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>
              <X size={24} />
            </div>
          </div>

          <h1 style={{ color: isLight ? '#0f172a' : '#fff', fontSize: 36, fontWeight: 950, marginBottom: 20, letterSpacing: '-1.5px' }}>
            {isBanned ? 'You are Banned' : isDenied ? 'Access Denied' : isMembersOnly ? 'Members Only' : isAdminKick ? 'Removed by Admin' : (isDeleted || roomNotFound ? 'Room Closed' : 'You were Kicked')}
          </h1>

          <p style={{ color: isLight ? '#475569' : 'rgba(255,255,255,0.5)', fontSize: 17, lineHeight: 1.7, marginBottom: 48, fontWeight: 500 }}>
            {isBanned ? "The host has restricted your access to this room permanently." :
              (kickedReason === 'denied' ? "The host didn't allow you to join this room." :
                (isMembersOnly ? "This room allows only signed-in users to join. Please log in to gain access." :
                  (kickedReason === 'room_closed_by_admin' ? "This room was closed by a platform administrator." :
                    (isAdminKick ? "You have been removed from this room by a platform administrator." :
                      (isDeleted ? "This room has been permanently deleted by the host and no longer exists." :
                        (roomNotFound ? "We couldn't find the room you're looking for. It might have been deleted or the link is incorrect." :
                          "You have been removed from the room by the host."))))))}
          </p>

          <button
            onClick={() => { socket?.emit('leave_room', { roomId }); navigate('/'); }}
            style={{ width: '100%', padding: '20px 0', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', color: '#fffffe', fontSize: 17, fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isLight ? '0 8px 25px rgba(var(--brand-1-rgb), 0.2)' : '0 8px 25px rgba(var(--brand-1-rgb), 0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = isLight ? '0 12px 30px rgba(var(--brand-1-rgb), 0.35)' : '0 12px 30px rgba(var(--brand-1-rgb), 0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isLight ? '0 8px 25px rgba(var(--brand-1-rgb), 0.2)' : '0 8px 25px rgba(var(--brand-1-rgb), 0.4)'; }}
          >
            <span style={{ color: '#fffffe' }}>Back to Home</span>
          </button>
        </div>
      </div>
    );
  }


  // ─── Camera layout derivation ──────────────────────────────────────────────
  // Build the list of all currently active camera users.
  // Uses isCamOn (not hasStartedCamOnce) so toggling your own camera
  // immediately updates the count — no page refresh needed for host or anyone.
  const activeCameraUsers = (() => {
    const all = [];
    const seen = new Set();
    // Local user: only counted while camera is CURRENTLY on
    if (isCamOn && localCamRef.current) { all.push({ id: 'local', username }); seen.add(username); }
    // Remote users who have established camera streams
    Object.entries(remoteStreams).forEach(([sid, { stream, username: uname }]) => {
      if (!uname || uname === username || seen.has(uname)) return;
      all.push({ id: sid, username: uname });
      seen.add(uname);
    });
    return all;
  })();
  const shouldUseManagedCameraLayout = activeCameraUsers.length > CAMERA_MANAGED_LAYOUT_THRESHOLD;

  // Debug logs — remove after confirming layout works
  console.log('[CameraLayout] active cameras:', activeCameraUsers.length);
  console.log('[CameraLayout] mode:', shouldUseManagedCameraLayout ? 'managed' : 'floating');
  console.log('[CameraLayout] hide cameras local:', areCamerasHidden);

  // ─── Managed Panel renderer ────────────────────────────────────────────────
  // Renders camera tiles for the right-side Cameras tab.
  // Supports: list view, grid view (2 columns), focus mode (click to enlarge).
  const renderCamerasPanel = () => {
    const allCams = [];
    const seenUsers = new Set();
    if (hasStartedCamOnce) {
      allCams.push({ id: 'local', isLocal: true, stream: localCamRef.current, username, isMuted: !isMicOnCam });
      seenUsers.add(username);
    }
    Object.entries(remoteStreams).forEach(([sid, { stream, username: uname }]) => {
      if (uname === username || seenUsers.has(uname)) return;
      const uObj = userList.find(u => u.username?.toLowerCase() === uname?.toLowerCase());
      allCams.push({ id: sid, isLocal: false, stream, username: uname, isMuted: uObj?.isMuted });
      seenUsers.add(uname);
    });

    // Debug logs
    console.log('[CameraMenu] layout mode:', cameraLayoutMode);
    console.log('[CameraMenu] focus enabled:', focusVideoEnabled);
    console.log('[CameraMenu] focused user:', focusedCameraUserId);
    console.log('[CameraMenu] cameras hidden:', areCamerasHidden);

    if (allCams.length === 0) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: 24, color: isLight ? '#94a3b8' : '#555', flex: 1
        }}>
          <VideoOff size={28} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>No cameras active</span>
        </div>
      );
    }

    // Tile height differs between grid and list
    const isGrid = cameraLayoutMode === 'grid';
    const tileHeight = isGrid ? 118 : 160;

    const renderTile = (cam) => {
      const vTracks = cam.stream ? cam.stream.getVideoTracks() : [];
      // readyState === 'live' is trusted as an alternative to !muted — muted can
      // stay stale (see videoTrackTick above) even once a track is genuinely
      // producing frames, whereas readyState reliably reflects whether the
      // track itself is still active.
      const hasVideo = vTracks.length > 0 && vTracks[0].enabled && (vTracks[0].readyState === 'live' || !vTracks[0].muted);
      const uObj = userList.find(u => u.username?.toLowerCase() === cam.username?.toLowerCase());
      const rawAvatar = knownAvatars[cam.username] || uObj?.avatarPath || uObj?.avatar;
      const avatarSrc = (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.trim().length > 5)
        ? getAvatarUrl(rawAvatar) : null;
      const isFocused = focusedCameraUserId === cam.id;

      const handleTileClick = () => {
        if (!focusVideoEnabled) return;
        setFocusedCameraUserId(prev => prev === cam.id ? null : cam.id);
      };

      return (
        <div
          key={cam.id}
          onClick={handleTileClick}
          style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            background: '#000', flexShrink: 0, height: tileHeight,
            border: isFocused
              ? '2px solid var(--brand-1-light)'
              : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)'),
            boxShadow: isFocused
              ? '0 0 0 3px rgba(129,140,248,0.25), 0 4px 20px rgba(0,0,0,0.5)'
              : (isLight ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.4)'),
            cursor: focusVideoEnabled ? 'pointer' : 'default',
            transition: 'border 0.15s, box-shadow 0.15s',
          }}
        >
          {/* Video or avatar fallback */}
          {hasVideo ? (
            <VideoTile
              stream={cam.stream}
              isMuted={cam.isMuted || cam.isLocal}
              isLocal={cam.isLocal}
              debugLabel="renderCamerasPanel"
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #312e81, #1e1b4b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {avatarSrc ? (
                <img src={avatarSrc} style={{ width: isGrid ? 36 : 56, height: isGrid ? 36 : 56, borderRadius: '50%', objectFit: 'cover' }} alt="" />
              ) : (
                <div style={{
                  width: isGrid ? 36 : 56, height: isGrid ? 36 : 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: isGrid ? 13 : 20
                }}>{cam.username?.substring(0, 2).toUpperCase()}</div>
              )}
            </div>
          )}

          {/* Focused indicator */}
          {isFocused && (
            <div className="stay-white" style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(var(--brand-1-rgb),0.92)', borderRadius: 6,
              padding: '2px 7px', fontSize: 10, fontWeight: 800, color: '#fff',
              pointerEvents: 'none', letterSpacing: '0.5px'
            }}>FOCUSED</div>
          )}

          {/* Focus hint overlay (only in focus mode, not focused) */}
          {focusVideoEnabled && !isFocused && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0)', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--brand-1-rgb),0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
            />
          )}

          {/* Bottom name bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            padding: isGrid ? '14px 8px 6px' : '18px 10px 8px',
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            {/* Mic muted badge */}
            {cam.isMuted && (
              <div style={{
                width: isGrid ? 16 : 20, height: isGrid ? 16 : 20, borderRadius: '50%',
                background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <MicOff size={isGrid ? 9 : 11} color="#fff" />
              </div>
            )}
            {/* Camera live dot */}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span style={{
              fontSize: isGrid ? 10 : 12, color: '#fff', fontWeight: 700,
              textShadow: '0 1px 3px rgba(0,0,0,0.8)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
            }}>
              {cam.username}{cam.isLocal ? ' (You)' : ''}
            </span>
          </div>
        </div>
      );
    };

    if (isGrid) {
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10, padding: '8px 10px',
        }}>
          {allCams.map(renderTile)}
        </div>
      );
    }

    // List view
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px' }}>
        {allCams.map(renderTile)}
      </div>
    );
  };

  // Helper to render camera tiles (shared for overlay and dedicated row modes)
  const renderCameras = (isOverlay) => {
    if (mediaUrl?.includes('videocall') || mediaUrl?.includes('voicecall')) return null;
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
            // readyState === 'live' is trusted as an alternative to !muted — muted can
            // stay stale (see videoTrackTick above) even once a track is genuinely
            // producing frames, whereas readyState reliably reflects whether the
            // track itself is still active.
            const hasVideo = vTracks.length > 0 && vTracks[0].enabled && (vTracks[0].readyState === 'live' || !vTracks[0].muted);
            const uObj = userList.find(u => u.username?.toLowerCase() === cam.username?.toLowerCase());
            const rawAvatar = knownAvatars[cam.username] || uObj?.avatarPath || uObj?.avatar || uObj?.profilePic;
            const avatarSrc = (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.trim().length > 5)
              ? getAvatarUrl(rawAvatar) : null;
            const isCircle = circleCams.has(cam.id);
            const isDraggable = allCams.length <= CAMERA_MANAGED_LAYOUT_THRESHOLD;
            const pos = camPositions[cam.id] || { x: 0, y: 0 };
            const currentWidth = camSizes[cam.id] || (isCircle ? 90 : 120);
            const currentHeight = isCircle ? currentWidth : (currentWidth * 0.75);
            // Ghost wrapper defaults — fixed in the flex layout so resizing one tile never reflows others
            const defaultWidth = isCircle ? 90 : 120;
            const defaultHeight = 90;

            return (
              <div key={cam.id} style={{
                width: defaultWidth, height: defaultHeight, flexShrink: 0, position: 'relative',
                zIndex: draggingCamRef.current?.id === cam.id ? 100 : 1
              }}>
              <div className="cam-container"
                onClick={(e) => { 
                  if (e.target.dataset.dragHandle) return; 
                  // Prevent toggle if we just finished dragging or resizing
                  if (draggingCamRef.current?.moved || resizingCamRef.current?.moved) return; 
                  
                  setCircleCams(prev => { 
                    const next = new Set(prev); 
                    if (next.has(cam.id)) next.delete(cam.id);
                    else next.add(cam.id);
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
                onTouchStart={(e) => {
                  if (!isDraggable || e.target.dataset.dragHandle) return;
                  if (e.cancelable) e.preventDefault();
                  const touch = e.touches[0];
                  const initial = camPositions[cam.id] || { x: 0, y: 0 };
                  draggingCamRef.current = { id: cam.id, startX: touch.clientX, startY: touch.clientY, initialX: initial.x, initialY: initial.y, moved: false };
                  setIsDraggingCam(true);
                  const onTouchMove = (m) => {
                    if (!draggingCamRef.current) return;
                    if (m.cancelable) m.preventDefault();
                    const t = m.touches[0];
                    const dx = t.clientX - draggingCamRef.current.startX;
                    const dy = t.clientY - draggingCamRef.current.startY;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) draggingCamRef.current.moved = true;
                    setCamPositions(prev => ({ ...prev, [draggingCamRef.current.id]: { x: draggingCamRef.current.initialX + dx, y: draggingCamRef.current.initialY + dy } }));
                    const zone = document.getElementById('cam-remove-zone');
                    if (zone) {
                      const rect = zone.getBoundingClientRect();
                      const over = t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom;
                      isOverRemoveRef.current = over;
                      setIsOverRemoveZone(over);
                    }
                  };
                  const onTouchEnd = () => {
                    if (draggingCamRef.current) {
                      if (isOverRemoveRef.current) {
                        setHiddenCams(prev => { const next = new Set(prev); next.add(draggingCamRef.current.id); return next; });
                        toast('Video hidden locally', { icon: '🙈' });
                      }
                    }
                    setIsDraggingCam(false);
                    setIsOverRemoveZone(false);
                    isOverRemoveRef.current = false;
                    window.removeEventListener('touchmove', onTouchMove);
                    window.removeEventListener('touchend', onTouchEnd);
                    setTimeout(() => { draggingCamRef.current = null; }, 50);
                  };
                  window.addEventListener('touchmove', onTouchMove, { passive: false });
                  window.addEventListener('touchend', onTouchEnd);
                }}
                style={{
                  position: 'absolute', top: 0, left: 0, width: currentWidth, height: currentHeight, borderRadius: isCircle ? '50%' : 16,
                  background: 'transparent',
                  border: 'none',
                  transition: (resizingCamRef.current?.id === cam.id || draggingCamRef.current?.id === cam.id) ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: isDraggable ? 'move' : 'pointer', transform: `translate(${pos.x}px, ${pos.y}px)`,
                  pointerEvents: 'auto',
                  boxShadow: 'none',
                  touchAction: 'none'
                }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: isCircle ? '50%' : 14, overflow: 'hidden', zIndex: 1 }}>
                  <VideoTile stream={cam.stream} isMuted={cam.isMuted || cam.isLocal} isLocal={cam.isLocal} debugLabel="renderCameras(floating)" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
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
                          setIsResizingCam(true);
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
                            setIsResizingCam(false);
                            // Small delay to ensure the onClick doesn't see 'moved' as false immediately
                            setTimeout(() => {
                              if (resizingCamRef.current) {
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
                        onTouchStart={(e) => {
                          if (e.cancelable) e.preventDefault();
                          e.stopPropagation();
                          setIsResizingCam(true);
                          const touch = e.touches[0];
                          resizingCamRef.current = { id: cam.id, startX: touch.clientX, startY: touch.clientY, startWidth: currentWidth, startPos: { ...pos }, handle: h.id, isCircle, moved: false };
                          const onTouchMove = (me) => {
                            if (!resizingCamRef.current) return;
                            if (me.cancelable) me.preventDefault();
                            const t = me.touches[0];
                            const dx = t.clientX - resizingCamRef.current.startX;
                            const dy = t.clientY - resizingCamRef.current.startY;
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
                          const onTouchEnd = () => {
                            setIsResizingCam(false);
                            setTimeout(() => {
                              if (resizingCamRef.current) { resizingCamRef.current = null; }
                            }, 50);
                            window.removeEventListener('touchmove', onTouchMove);
                            window.removeEventListener('touchend', onTouchEnd);
                          };
                          window.addEventListener('touchmove', onTouchMove, { passive: false });
                          window.addEventListener('touchend', onTouchEnd);
                        }}
                        style={{
                          position: 'absolute', top: h.top, bottom: h.bottom, left: h.left, right: h.right,
                          width: 28, height: 28, cursor: h.cursor, pointerEvents: 'auto',
                          display: 'flex', alignItems: (h.id.startsWith('b') ? 'flex-end' : 'flex-start'), 
                          justifyContent: (h.id.endsWith('r') ? 'flex-end' : 'flex-start'),
                          padding: 4, transform: isCircle ? (h.id === 'br' ? 'translate(30%, 30%)' : h.id === 'bl' ? 'translate(-30%, 30%)' : h.id === 'tr' ? 'translate(30%, -30%)' : 'translate(-30%, -30%)') : 'none',
                          touchAction: 'none'
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
                        <div className="stay-white" style={{ width: currentWidth * 0.55, height: currentWidth * 0.55, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: Math.max(12, currentWidth * 0.18) }}>{cam.username?.substring(0, 2).toUpperCase()}</div>
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

  const activeMediaItem = OPTIONS.find(o => o.url === mediaUrl || (o.url && mediaUrl && (mediaUrl.includes(o.url) || o.url.includes(mediaUrl))));
  const isVirtualBrowserActivity = activeMediaItem?.type === 'virtual_browser' || isLaunchingVirtualBrowser || isVirtualBrowserMedia;

  // ─── RENDER ───

  return (
    <div
      className={isTvMode ? "tv-mode" : ""}
      onMouseMove={() => { if (isGameOrActivity(mediaUrl)) resetGameControlsTimer(); }}
      style={{
        position: isMobile ? 'fixed' : 'relative',
        ...(isMobile
          ? { top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }
          : { height: '100dvh' }
        ),
        display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--room-main-bg)',
        backgroundImage: ROOM_THEMES.find(t => t.id === roomTheme)?.backgroundCss || 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        fontFamily: "'Outfit',sans-serif", color: 'var(--text-primary)',
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
        @keyframes slideInRight { from{opacity:0;transform:translateX(24px) scale(0.96);} to{opacity:1;transform:translateX(0) scale(1);} }
        @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes fadeInScale { from{opacity:0;transform:scale(0.88) translateY(8px);} to{opacity:1;transform:scale(1) translateY(0);} }
        @keyframes bounce { 0%,80%,100%{transform:scale(0);} 40%{transform:scale(1);} }
        @keyframes joinPulse { 0%,100%{box-shadow:0 0 0 0 rgba(var(--brand-2-rgb),0.4);} 50%{box-shadow:0 0 0 8px rgba(var(--brand-2-rgb),0);} }
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
        .player-ctrl-btn{background:transparent;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:7px;border-radius:8px;transition:all 0.15s;}
        .player-ctrl-btn:hover{background:rgba(255,255,255,0.15);transform:scale(1.05);}
        .player-scrubber{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;outline:none;cursor:pointer;background:transparent;}
        .player-scrubber::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--brand-1);cursor:pointer;box-shadow:0 0 4px rgba(var(--brand-1-rgb),0.8);transition:transform 0.1s;}
        .player-scrubber::-webkit-slider-thumb:hover{transform:scale(1.3);}
        .player-vol-slider{-webkit-appearance:none;appearance:none;width:70px;height:3px;border-radius:2px;outline:none;cursor:pointer;background:transparent;}
        .join-req-approve-btn { flex: 1; padding: 7px 16px; background: linear-gradient(135deg, var(--brand-1), var(--brand-2)); border: none; border-radius: 10px; color: #ffffff !important; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 4px 12px rgba(var(--brand-1-rgb),0.2); }
        .join-req-deny-btn { flex: 1; padding: 7px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #ffffff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; text-align: center; }
        .stay-white { color: #ffffff !important; }
        .join-req-approve-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(var(--brand-1-rgb),0.4); filter: brightness(1.1); }
        .join-req-approve-btn:active { transform: translateY(0); scale: 0.98; }
        .join-req-deny-btn:hover { background: rgba(239, 68, 68, 0.2) !important; color: #ff4b4b !important; border-color: rgba(239, 68, 68, 0.4) !important; transform: scale(1.03); }
        .join-badge { 
          position: absolute; top: -6px; right: -6px; background: var(--brand-2); color: #ffffff !important;
          border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 900; border: 2px solid #000; box-shadow: 0 0 10px rgba(var(--brand-2-rgb), 0.4);
          animation: badgePulse 2s infinite; 
        }
        @keyframes badgePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--brand-2-rgb), 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(var(--brand-2-rgb), 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--brand-2-rgb), 0); }
        }
        @keyframes waterWave {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .pulse-orange-dot { animation: waterWave 2s infinite; }
        .nav-icon-btn { position: relative; width: 38px; height: 38px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .nav-icon-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; }
        .nav-icon-btn.active { background: rgba(var(--brand-1-rgb),0.12) !important; border-color: rgba(var(--brand-1-rgb),0.4) !important; color: var(--brand-1-light) !important; }
        html[data-theme='light'] .forced-white, .forced-white { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }

        /* ── Light Mode Overrides ── */
        html[data-theme='light'] .nav-icon-btn.active { color: var(--brand-1) !important; background: rgba(var(--brand-1-rgb),0.1) !important; }
        
        html[data-theme='light'] .room-header { background: #fff !important; border-bottom-color: rgba(0,0,0,0.08) !important; }
        html[data-theme='light'] .back-btn-room { background: rgba(0,0,0,0.04) !important; border-color: rgba(0,0,0,0.08) !important; color: #666 !important; }
        html[data-theme='light'] .back-btn-room:hover { background: rgba(0,0,0,0.08) !important; color: #111 !important; }
        
        html[data-theme='light'] .join-req-approve-btn { background: var(--brand-2); box-shadow: 0 2px 8px rgba(var(--brand-2-rgb),0.3); }
        html[data-theme='light'] .join-req-approve-btn:hover { background: var(--brand-2-dark); box-shadow: 0 4px 12px rgba(var(--brand-2-rgb),0.4); }
        html[data-theme='light'] .join-req-deny-btn { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
        html[data-theme='light'] .join-req-deny-btn:hover { background: #fee2e2 !important; color: #dc2626 !important; border-color: #fecaca !important; }
        html[data-theme='light'] .join-badge { border-color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        
        .cam-container .cam-ui-overlay { opacity: 0; transition: opacity 0.3s ease; }
        .cam-container:hover .cam-ui-overlay { opacity: 1; }
        @media (max-width: 1024px) {
          .cam-container .cam-ui-overlay {
            opacity: 1 !important;
            visibility: visible !important;
          }
        }
        
        @keyframes blobFloat {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          100% { transform: translate(-45%, -55%) scale(1.1) rotate(5deg); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          ROOT-LEVEL CAMERA OVERLAY — FLOATING MODE ONLY
          Only rendered when cameras are ≤ CAMERA_MANAGED_LAYOUT_THRESHOLD (floating/draggable mode).
          When managed layout is active, cameras are rendered in the right-side panel instead.
          When cameras are hidden, nothing is rendered here.
          zIndex:999 keeps it below the nav header (zIndex:1000).
          In fullscreen mode the overlay inside player-wrap is used instead.
      ══════════════════════════════════════════════════════════════ */}
      {!isFullscreen && !isTvMode && !shouldUseManagedCameraLayout && !areCamerasHidden && (
        <>
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999,
            pointerEvents: 'none',
            overflow: 'visible'
          }}>
            {renderCameras(true)}
          </div>

          {/* Drag-to-Remove Zone — also in the root overlay so it receives correct coords */}
          {isDraggingCam && (
            <div
              id="cam-remove-zone"
              style={{
                position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
                zIndex: 1000, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                opacity: 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                animation: 'slideInUp 0.3s ease'
              }}
            >
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
        </>
      )}

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
              <button onClick={copyRoomLink} style={{ background: copied ? '#10b981' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#ffffff', WebkitTextFillColor: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <span style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>{copied ? t('copied', 'Copied!') : t('copyBtn', 'Copy')}</span>
              </button>
            </div>
            <div className="share-social-grid" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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
            <span className="back-btn-text" style={{ fontSize: 13, fontWeight: 700 }}>{t('back', 'Back')}</span>
          </button>
          <div className="room-header-divider" style={{ width: 1, height: 24, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }} />
          <div className="room-header-divider-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'default', padding: 0 }}>
            <img src="/logos/trans_webl.png" alt="SahaPlay" style={{ width: 28, height: 28 }} />
            <span className="room-brand-text" style={{ fontWeight: 800, fontSize: 18, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px' }}>SahaPlay</span>
          </div>
          <div className="room-header-divider" style={{ width: 1, height: 24, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <span className="room-id-text" style={{ fontSize: 13, color: isLight ? '#64748b' : '#666', fontWeight: 600 }}>{t('roomLabel', 'Room:')} <span style={{ color: isLight ? '#1e293b' : '#aaa' }}>{roomId}</span></span>
        </div>

        {/* Mobile center: room avatar + name + members pill (Part 1) */}
        {isMobile && (
          <div ref={mobUserPanelTriggerRef} className="room-mob-center" onClick={() => { setShowUserPanel(v => !v); setShowSettings(false); setShowRecentChats(false); }}>
            {room?.thumbnailPath ? (
              <img src={getRoomThumbnailUrl(room.thumbnailPath)} className="room-mob-avatar" alt="" />
            ) : (
              <div className="room-mob-avatar-placeholder"><Play size={14} fill="#fff" color="#fff" /></div>
            )}
            <div className="room-mob-name-stack">
              <span className="room-mob-name">{roomName}</span>
              <div className="room-mob-members-pill"><Users size={10} style={{ flexShrink: 0 }} /><span>{userCount}</span></div>
            </div>
          </div>
        )}

        {/* Right: Actions & Profile */}
        <div ref={navIconsRef} className="room-header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Watching / Participants Button — wrapper always in DOM so panel can portal from it */}
          <div style={{ position: 'relative' }} ref={userPanelRef}>
            <button className="room-desktop-only" onClick={() => {
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
              <div className="room-participants-panel" style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, background: isLight ? '#fff' : '#0a0a0f', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(129, 140, 248, 0.2)', borderRadius: 24, padding: '20px 12px', minWidth: 300, zIndex: 50000, boxShadow: isLight ? '0 20px 50px rgba(0,0,0,0.1)' : '0 20px 50px rgba(0,0,0,0.9)' }}>
                <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 900, letterSpacing: '1.5px', marginBottom: 20, padding: '0 12px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('roomMembers', 'Room Members')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="stay-white" style={{ background: 'var(--brand-1)', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 900 }}>{userCount}</span>
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

                {/* Search Bar for Members */}
                <div style={{ padding: '0 12px', marginBottom: 16 }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} color={isLight ? '#64748b' : '#94a3b8'} style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder={t('searchMembers', 'Search members...')}
                      value={memberSearchQuery}
                      onChange={e => setMemberSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        borderRadius: 12,
                        border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)',
                        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                        color: isLight ? '#0f172a' : '#ffffff',
                        fontSize: 13,
                        fontWeight: 500,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = 'var(--brand-1)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(var(--brand-1-rgb), 0.15)';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {memberSearchQuery && (
                      <button
                        onClick={() => setMemberSearchQuery('')}
                        style={{
                          position: 'absolute', right: 12, background: 'none', border: 'none',
                          color: isLight ? '#64748b' : '#94a3b8', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', padding: 0
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 350, overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
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
                        const avatarSrc = getAvatarUrl(rawAvatar);
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
                                style={{ background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', border: 'none', color: '#ffffff', padding: '6px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
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

                  {/* User List with sorting and filtering */}
                  {(() => {
                    const query = memberSearchQuery.trim().toLowerCase();
                    const filtered = [...userList].filter(u => 
                      (u.username || '').toLowerCase().includes(query)
                    );

                    if (query && filtered.length === 0) {
                      return (
                        <div style={{ padding: '24px 12px', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                          {t('notExists', 'Not exists')}
                        </div>
                      );
                    }

                    return filtered.sort((a, b) => {
                      if (a.isHost && !b.isHost) return -1;
                      if (!a.isHost && b.isHost) return 1;
                      const aIsMe = a.socketId === socket?.id;
                      const bIsMe = b.socketId === socket?.id;
                      if (aIsMe && !bIsMe) return -1;
                      if (!aIsMe && bIsMe) return 1;
                      return (a.username || '').localeCompare(b.username || '');
                    }).map(u => {
                      const uIsHost = !!u.isHost;
                      const uIsAdmin = !!u.isAdmin;
                      const uIsMe = u.socketId === socket?.id;
                      const rawAvatar = u.avatarPath || knownAvatars[u.username];
                      const avatarSrc = getAvatarUrl(rawAvatar);
                      return (
                        <div key={u.socketId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 16, transition: 'all 0.2s', background: uIsMe ? (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)') : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)'), border: uIsMe ? (isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.1)') : '1px solid transparent' }} className="usr-row">
                          <div onClick={() => navigate(`/profile/${u.username}`)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                            <Avatar name={u.username} src={avatarSrc} isHost={uIsHost} isAdmin={uIsAdmin} isMuted={!!u.isMuted} size={38} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, color: uIsMe ? (isLight ? '#000' : '#fff') : (isLight ? '#1e293b' : '#eee'), fontWeight: uIsMe ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {formatUsername(u.username)}{uIsMe ? t('youSuffix', ' (You)') : ''}
                                </span>
                                {uIsHost ? (
                                  <span title="Host" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Star size={12} color="#fbbf24" fill="#fbbf24" />
                                  </span>
                                ) : uIsAdmin ? (
                                  <span title="Admin" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <Shield size={12} color={isLight ? "var(--brand-1-dark)" : "var(--brand-1-light)"} fill={isLight ? "var(--brand-1-dark)" : "var(--brand-1-light)"} />
                                  </span>
                                ) : null}
                                {(getFlagUrl(u.countryCode) || getFlagUrlFromName(u.country)) && (
                                  <img
                                    src={getFlagUrl(u.countryCode) || getFlagUrlFromName(u.country)}
                                    alt={u.country || u.countryCode}
                                    title={u.country || u.countryCode}
                                    loading="lazy"
                                    style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                  />
                                )}
                              </div>
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
                                style={{ width: 32, height: 32, borderRadius: 10, background: modMenuTarget === u.socketId ? 'rgba(var(--brand-1-rgb),0.2)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)'), border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: modMenuTarget === u.socketId ? 'var(--brand-1-dark)' : (isLight ? '#64748b' : '#888') }}
                              >
                                <MoreVertical size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
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
                            {targetUser.isAdmin ? <ShieldOff size={15} color={isLight ? "var(--brand-1-dark)" : "var(--brand-1-light)"} /> : <Shield size={15} color={isLight ? "var(--brand-1-dark)" : "var(--brand-1-light)"} />}
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

          {/* Mobile cam/mic/⋮ buttons (Part 1) */}
          {isMobile && (() => {
            const camPerm = room?.permissions?.cam || 'all';
            const canUseCam = camPerm === 'all' || (camPerm === 'host' && isEffectiveHost);
            const micPerm = room?.permissions?.mic || 'all';
            const canUseMic = micPerm === 'all' || (micPerm === 'host' && isEffectiveHost);
            return (
              <>
                <button
                  className={`room-mob-icon-btn${isCamOn ? ' active-cam' : ''}`}
                  onClick={canUseCam ? toggleCamera : () => toast.error(canUseCam ? '' : 'Camera not available')}
                  title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
                <button
                  className={`room-mob-icon-btn${isMicOnCam ? ' active-mic' : ''}`}
                  onClick={canUseMic ? toggleMic : () => toast.error('Mic not available')}
                  title={isMicOnCam ? 'Mute mic' : 'Unmute mic'}
                >
                  {isMicOnCam ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  className="room-mob-icon-btn"
                  onClick={() => setShowMobileMenu(true)}
                  title="More options"
                >
                  <MoreVertical size={18} />
                </button>
              </>
            );
          })()}

          {/* App Fullscreen Button */}
          <button
            className={`nav-icon-btn room-fullscreen-btn${isAppFullscreen ? ' active' : ''}`}
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            title={isAppFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', color: isLight ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {isAppFullscreen ? <Minimize size={16} strokeWidth={2.5} /> : <Maximize size={16} strokeWidth={2.5} />}
          </button>

          {/* Global Chats */}
          <div className="room-desktop-only" style={{ position: 'relative' }}>
            <button className={`nav-icon-btn${showRecentChats ? ' active' : ''}`} title="Global Chats" onClick={() => { setShowRecentChats(!showRecentChats); setShowUserPanel(false); setShowSettings(false); }} style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', color: isLight ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
              <MessageSquare size={18} strokeWidth={2.5} />
              {totalUnread > 0 && <div className="unread-badge stay-white" style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', color: '#fff', fontSize: 10, fontWeight: 'bold', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalUnread > 9 ? '9+' : totalUnread}</div>}
            </button>
          </div>

          {/* Hide / Show Cameras — local preference only, does NOT affect other users */}
          {(hasStartedCamOnce || Object.keys(remoteStreams).length > 0) && (
            <button
              className={`nav-icon-btn room-desktop-only${areCamerasHidden ? ' active' : ''}`}
              title={areCamerasHidden ? 'Show Cameras' : 'Hide Cameras'}
              onClick={() => {
                const next = !areCamerasHidden;
                setAreCamerasHidden(next);
                localStorage.setItem('sahaplay_hide_camera_tiles', String(next));
                if (!next && shouldUseManagedCameraLayout) setRightPanelTab('cameras');
              }}
              style={{
                width: 38, height: 38, borderRadius: 12,
                background: areCamerasHidden
                  ? (isLight ? 'rgba(var(--brand-1-rgb),0.1)' : 'rgba(var(--brand-1-rgb),0.15)')
                  : 'var(--room-card-bg)',
                border: areCamerasHidden
                  ? '1px solid rgba(var(--brand-1-rgb),0.4)'
                  : '1px solid var(--room-border)',
                color: areCamerasHidden ? 'var(--brand-1-light)' : (isLight ? '#000' : '#fff'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
              }}
            >
              {areCamerasHidden ? <Eye size={17} strokeWidth={2.5} /> : <EyeOff size={17} strokeWidth={2.5} />}
            </button>
          )}

          {/* Share Button */}
          <button
            className="nav-icon-btn room-desktop-only"
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
          <div className="room-desktop-only" style={{ position: 'relative' }} ref={settingsRef}>
            <button onClick={() => { setShowSettings(!showSettings); setShowUserPanel(false); setShowRecentChats(false); }} className={`nav-icon-btn${showSettings ? ' active' : ''}`} style={{ width: 38, height: 38, background: 'var(--room-card-bg)', border: '1px solid var(--room-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isLight ? '#000' : '#fff' }}>
              <Settings size={18} strokeWidth={2.5} />
            </button>
            {showSettings && (
              <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, background: isLight ? '#fff' : '#141414', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 6, minWidth: 200, zIndex: 5000, boxShadow: isLight ? '0 10px 40px rgba(0,0,0,0.1)' : '0 10px 40px rgba(0,0,0,0.8)' }}>
                <button className="settings-menu-btn" onClick={async () => {
                  await togglePinRoom();
                  setShowSettings(false);
                }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Pin size={16} color={isLight ? 'var(--brand-1-dark)' : '#888'} /> {pinnedRooms.includes(roomId) ? t('unpinRoom', 'Unpin Room') : t('pinRoom', 'Pin Room')}
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
                    <Settings2 size={16} color={isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)'} /> {t('roomSettings', 'Room Settings')}
                  </button>
                )}
                {!isEffectiveHost && (
                  <button className="settings-menu-btn-danger" onClick={() => { setShowPersonalDeleteConfirm(true); setShowSettings(false); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#ef4444' : '#f87171', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Trash2 size={16} color={isLight ? '#ef4444' : '#f87171'} /> {t('deleteRoom', 'Delete Room')}
                  </button>
                )}
                <button className="settings-menu-btn" onClick={() => { setShowNotificationSettings(true); setShowSettings(false); }} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', color: isLight ? '#000' : '#eee', cursor: 'pointer', borderRadius: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Bell size={16} color={isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)'} /> {t('notifications', 'Notifications')}
                </button>
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
          currentUrl={mediaUrl}
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
          initialCategory={lastMediaCategory}
          initialGameTab={lastMediaGameTab}
          initialActivityTab={lastMediaActivityTab}
          onClose={() => setShowMediaSelector(false)}
          onSelectPlatform={(id) => {
            setShowMediaSelector(false);
            if (id === 'youtube') setShowYtBrowser(true);
            if (id === 'twitch') setShowTwitchBrowser(true);
            if (id === 'vimeo') setShowVimeoBrowser(true);
          }}
          onSelectUrl={(url, launchType) => {
            setShowMediaSelector(false);
            changeMedia(url, launchType);
          }}
          onUpload={() => {
            // Modal signals "user wants to upload" — close modal, then trigger Room's own file input
            console.log('[FILE] onUpload trigger received from modal');
            setShowMediaSelector(false);
            // Use setTimeout so modal unmounts cleanly before file dialog opens
            setTimeout(() => {
              console.log('[FILE] Opening file picker via Room.jsx ref');
              videoFileInputRef.current?.click();
            }, 50);
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
        onBeforeLeaveNavigate={roomModalsBack.skipNextClose}
      />

      <SubtitleSettingsModal
        open={showSubtitleSettingsModal}
        onClose={() => setShowSubtitleSettingsModal(false)}
        settings={subtitleSettings}
        onChange={setSubtitleSettings}
        isMobile={isTouchPlayer}
        isRotatedFs={isRotatedFs}
      />

      <CustomizeRoomModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        currentTheme={roomTheme}
        baseRoomTheme={room?.roomTheme || 'default'}
        hasPersonalOverride={!!localStorage.getItem(`wt-personal-theme-${roomId}`)}
        onSelectTheme={handleSelectTheme}
        onClearPersonalTheme={handleClearPersonalTheme}
        isHost={isEffectiveHost}
      />

      {/* close panel on outside click */}


      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main Content Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: isTvMode ? 0 : 12, gap: isTvMode ? 0 : 12 }} className={`no-scrollbar room-main-layout${isMobile && (mediaUrl || isScreensharing || isViewer) && !isFullscreen && !isTvMode ? ' mob-media-active' : ''}${isMobile && isCallActivity(mediaUrl) && !isFullscreen && !isTvMode ? ' mob-call-active' : ''}`}>
        {/* Player column — padded when a theme is active to let the background show */}
        <div
          style={{
            flex: 3, display: 'flex', flexDirection: 'column', gap: isTvMode ? 0 : 12,
            overflow: 'hidden',
            maxHeight: '100%', position: 'relative'
          }}
          className="no-scrollbar room-player-col"
        >
          {/* Customize Room floating button */}
          {!isTvMode && !isFullscreen && !isGameOrActivity(mediaUrl) && (
            <button
              onClick={() => setShowCustomizeModal(true)}
              title="Customize Room"
              className="room-theme-btn"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--brand-2-rgb),0.75)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.transform = 'scale(1)'; }}
              style={{
                position: 'absolute',
                top: 8, left: 8,
                zIndex: 100, width: 34, height: 34, borderRadius: '50%',
                background: roomTheme !== 'default' ? 'rgba(var(--brand-2-rgb),0.55)' : 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(8px)',
                transition: 'all 0.2s',
              }}
            >
              <Paintbrush size={15} color="#fff" />
            </button>
          )}
          {/* ── OLD in-player game overlay REPLACED — game name is now in header ── */}

          <div
            ref={playerWrapRef}
            className={`player-wrap${isTouchPlayer && isMobileFsMode ? (isCallActivity(mediaUrl) ? ' player-mob-fs-portrait' : ' player-mob-fs') : ''}`}
            onMouseMove={() => { resetControlsTimer(); if (isGameOrActivity(mediaUrl)) resetGameControlsTimer(); }}
            onMouseEnter={() => { resetControlsTimer(); if (isGameOrActivity(mediaUrl)) resetGameControlsTimer(); }}
            onMouseLeave={() => {
              // Touch devices synthesize a mouseleave shortly after every tap (there's no
              // real hover to sustain), which was instantly killing the 3s auto-hide timer
              // resetControlsTimer had just armed — controls would flash and vanish right
              // away. Only real mouse-leaving-the-player should force an immediate hide.
              if (!isTouchPlayer) setShowControls(false);
            }}
            onTouchStart={() => { resetControlsTimer(); if (isGameOrActivity(mediaUrl)) resetGameControlsTimer(); }}
            style={{
              flex: 1,
              background: (isLight && !isFullscreen && !isTvMode) ? '#fff' : '#000',
              borderRadius: (isFullscreen || isTvMode || isMobile) ? 0 : 16,
              border: (isLight && !isFullscreen && !isTvMode) ? '1px solid #e2e8f0' : ((isFullscreen || isTvMode) ? 'none' : '1px solid rgba(255,255,255,0.07)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              overflow: 'hidden', 
              position: 'relative',
              boxShadow: (roomTheme !== 'default' && !isFullscreen && !isTvMode)
                ? '0 24px 60px rgba(0,0,0,0.65)'
                : ((isLight && !isFullscreen && !isTvMode) ? '0 8px 30px rgba(0,0,0,0.04)' : 'none'),
              transition: 'box-shadow 0.3s ease',
            }}
          >
            {/* Active Game/Activity Top-Left Dropdown inside room screen */}
            {!isTvMode && (hasMounted && mediaUrl) && isGameOrActivity(mediaUrl) && !mediaUrl.includes('videocall') && !mediaUrl.includes('voicecall') && (
              <div
                className="sp-game-header-overlay gcw-force-dark stay-white"
                style={{
                  position: 'absolute',
                  top: 12, left: 12,
                  zIndex: 200,
                  opacity: showGameControls ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                  pointerEvents: showGameControls ? 'auto' : 'none',
                }}
              >
                <button
                  className="stay-white"
                  onClick={() => setShowActivityMenu(!showActivityMenu)}
                  style={{
                    background: 'rgba(15, 15, 25, 0.75)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '8px 14px',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(15, 15, 25, 0.9)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(15, 15, 25, 0.75)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  <Gamepad2 size={14} color="var(--brand-1-light)" />
                  {!isMobile && <span className="stay-white">{getActiveMediaName(mediaUrl)}</span>}
                  <ChevronDown size={14} color="#ffffff" style={{ transform: showActivityMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {showActivityMenu && (
                  <div className="stay-white" style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    background: 'rgba(15, 15, 25, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: 6,
                    minWidth: 110,
                    boxShadow: '0 10px 32px rgba(0,0,0,0.5)',
                    zIndex: 210,
                  }}>
                    {hasPlayerPrivileges && (
                      <>
                        {/* Stop — end game and open App Directory */}
                        <button
                          className="stay-white"
                          onClick={() => {
                            setShowActivityMenu(false);
                            handleStopMedia();
                            setShowMediaSelector(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            color: '#f59e0b',
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <Square size={11} fill="#f59e0b" stroke="none" />
                          <span style={{ color: '#f59e0b' }}>Stop</span>
                        </button>

                        {/* Exit — end game and return to empty room */}
                        <button
                          className="stay-white"
                          onClick={() => {
                            setShowActivityMenu(false);
                            handleStopMedia();
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <X size={13} color="#ef4444" />
                          <span style={{ color: '#ef4444' }}>Exit</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Game Fullscreen Button — only for games, top-right, hover-revealed, glassmorphic & high-contrast */}
            {!isTvMode && (hasMounted && mediaUrl) && isGameOrActivity(mediaUrl) && !mediaUrl.includes('videocall') && !mediaUrl.includes('voicecall') && (
              <button
                className="stay-white"
                onClick={handleFullscreen}
                title={isFullscreen || isMobileFsMode ? 'Exit Fullscreen' : 'Fullscreen'}
                style={{
                  position: 'absolute', top: 12, right: 12, zIndex: 200,
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(15, 15, 25, 0.75)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#fff',
                  opacity: showGameControls ? 1 : 0,
                  transition: 'opacity 0.4s ease, background 0.18s, border-color 0.18s',
                  pointerEvents: showGameControls ? 'auto' : 'none',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(var(--brand-1-rgb), 0.65)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(15, 15, 25, 0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                {(isFullscreen || isMobileFsMode)
                  ? <Minimize2 size={18} color="#ffffff" />
                  : <Maximize2 size={18} color="#ffffff" />}
              </button>
            )}

            {/* Game Virtual Browser Fallback Button — only for games, top-right, next to fullscreen button */}
            {!isTvMode && (hasMounted && mediaUrl) && isMediaGame(mediaUrl) && !hyperbeamSession && !hbSessionId && (
              <button
                className="stay-white"
                onClick={() => {
                  dismissGlobeInstruction();
                  if (isEffectiveHost) {
                    handleOpenCloudBrowser(mediaUrl);
                  } else {
                    toast.error('Only the host can launch the Virtual Browser. Please ask the host to launch it.');
                  }
                }}
                title="Launch in Virtual Browser"
                style={{
                  position: 'absolute', top: 12, right: 58, zIndex: 200,
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(15, 15, 25, 0.75)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#fff',
                  opacity: showGameControls ? 1 : 0,
                  transition: 'opacity 0.4s ease, background 0.18s, border-color 0.18s',
                  pointerEvents: showGameControls ? 'auto' : 'none',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(var(--brand-1-rgb), 0.65)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(15, 15, 25, 0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                <Globe size={18} color="#ffffff" />
              </button>
            )}

            {/* Onboarding / Instruction Tooltip pointing to the Globe button */}
            {!isTvMode && (hasMounted && mediaUrl) && isMediaGame(mediaUrl) && !hyperbeamSession && !hbSessionId && showGlobeInstruction && (
              <div
                style={{
                  position: 'absolute',
                  top: 58,
                  right: 58,
                  zIndex: 250,
                  width: 280,
                  background: 'rgba(15, 15, 25, 0.98)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(var(--brand-1-rgb), 0.65)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {/* Pointer Triangle pointing upwards to the Globe button */}
                <div style={{
                  position: 'absolute',
                  top: -6,
                  right: 14,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: '6px solid rgba(var(--brand-1-rgb), 0.65)',
                }} />
                
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#e0e7ff', fontWeight: 600 }}>
                  Game not loading properly or showing a blank screen?
                </p>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>
                  Click this **Globe icon** to launch it in a Virtual Browser!
                </p>
                <button
                  onClick={dismissGlobeInstruction}
                  className="stay-white"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(var(--brand-1-rgb), 0.3)',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Got it
                </button>
              </div>
            )}



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
                        background: showRecentChats ? 'rgba(var(--brand-1-rgb),0.85)' : 'rgba(15,15,20,0.8)',
                        borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(12px)', transition: 'all 0.2s', cursor: 'pointer'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = showRecentChats ? 'rgba(var(--brand-1-rgb),0.95)' : 'rgba(25,25,35,0.9)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = showRecentChats ? 'rgba(var(--brand-1-rgb),0.85)' : 'rgba(15,15,20,0.8)'; e.currentTarget.style.transform = 'scale(1)'; }}
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

                {/* No Cloud Browser button here — shown automatically only when page fails to load */}

                {/* Fullscreen button removed — it's in the bottom control bar for all URL types */}
              </div>
            </div>
            )}

            {!isTvMode && room?.settings?.playerCustomName && (isScreensharing || isViewer) && !isFullscreen && (
              <div className="stay-white" style={{
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
                    objectFit: 'contain', zIndex: 0,
                    filter: QUALITY_PRESETS[videoQuality]?.filter || 'none',
                    transition: 'filter 0.4s ease',
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

                  {/* ── Fullscreen + End Screen Share (Top-Right, auto-hides on idle) ── */}
                  {(isScreensharing || isViewer) && (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 20,
                      zIndex: 100,
                      display: 'flex', alignItems: 'center', gap: 8,
                      pointerEvents: showControls ? 'auto' : 'none',
                      opacity: showControls ? 1 : 0,
                      transform: showControls ? 'translateY(0)' : 'translateY(-12px)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                      <button
                        className="stay-white"
                        onClick={handleFullscreen}
                        title={isFullscreen || isMobileFsMode ? 'Exit Fullscreen' : 'Fullscreen'}
                        style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: 'rgba(15, 15, 25, 0.75)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#fff',
                          transition: 'background 0.18s, border-color 0.18s',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--brand-1-rgb), 0.65)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15, 15, 25, 0.75)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
                      >
                        {(isFullscreen || isMobileFsMode)
                          ? <Minimize2 size={16} color="#ffffff" />
                          : <Maximize2 size={16} color="#ffffff" />}
                      </button>
                      <button
                        className="stay-white"
                        title={isScreensharing ? 'End screen share for everyone' : 'Stop watching this screen share'}
                        onClick={isScreensharing ? stopScreenshare : leaveScreenshareView}
                        style={{
                          padding: '7px 16px',
                          background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                          border: 'none',
                          borderRadius: 10,
                          color: '#fff',
                          fontSize: 13, fontWeight: 800, letterSpacing: '0.2px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'transform 0.15s',
                          boxShadow: '0 8px 24px rgba(var(--brand-1-rgb),0.4)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        End
                      </button>
                    </div>
                  )}
                </div>
                {/* Removed local play/pause overlay and LIVE badge for cleaner screenshare */}
              </>
            ) : hasMounted && mediaUrl ? (
              <>
                {mediaUrl === 'lobby://crazygames' ? (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: isMobile ? 0 : 16, overflow: 'hidden' }}>
                    <CrazyGamesLobby
                      onSelectGame={async (gameUrl) => {
                        if (hasPlayerPrivileges) {
                          await changeMedia(gameUrl);
                        } else {
                          toast.error(t('hostPrivilegeError', 'Only the host or users with privileges can load games.'));
                        }
                      }}
                      isLight={isLight}
                    />
                  </div>
                ) : mediaUrl === 'activity://timer' ? (
                  <TimerActivity isLight={isLight} />
                ) : (mediaUrl === 'activity://videocall' || mediaUrl === 'activity://voicecall') ? (
                  <CallingActivity
                    mode={mediaUrl === 'activity://videocall' ? 'video' : 'voice'}
                    isLight={isLight}
                    isCamOn={isCamOn}
                    isMicOn={isMicOnCam}
                    localCamStream={localCamRef.current}
                    remoteStreams={remoteStreams}
                    toggleCamera={toggleCamera}
                    toggleMic={toggleMic}
                    username={username}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={handleFullscreen}
                    localAvatarUrl={getAvatarUrl(knownAvatars[username])}
                    knownAvatars={knownAvatars}
                    socketServerUrl={SOCKET_SERVER_URL}
                    onEndCall={() => {
                      // handleStopMedia() detects we're leaving a call and hangs up
                      // (stops our camera/mic + tells the other side to hang up too).
                      handleStopMedia();
                      setShowMediaSelector(true);
                    }}
                    onStopCall={() => {
                      handleStopMedia();
                      setShowMediaSelector(true);
                    }}
                  />
                ) : isWebIframe(mediaUrl) ? (
                  <div
                    style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: isMobile ? 0 : 16, overflow: 'hidden' }}
                    onMouseMove={resetControlsTimer}
                    onMouseEnter={resetControlsTimer}
                    onTouchStart={resetControlsTimer}
                  >
                    {/* ── iframe content area — no browser toolbar, uses shared bottom control bar ── */}
                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                      {!hyperbeamSession && !hbSessionId && !isVirtualBrowserActivity && (
                        <iframe
                          key={mediaUrl}
                          src={mediaUrl}
                          style={{ width: '100%', height: '100%', border: 'none', display: iframeLoading ? 'none' : 'block' }}
                          allow="autoplay; fullscreen; camera; microphone; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; payment"
                          allowFullScreen
                          onLoad={() => {
                            setIframeLoading(false);
                            setIframeError(false);
                            // Page loaded successfully — clear any block timeout.
                            clearTimeout(iframeBlockTimeoutRef.current);
                            // Note: setIframeBlockSuspected and setShowGlobePopup are NOT auto-triggered.
                            // The user can manually click the Globe icon if the page didn't load correctly.
                          }}
                          onError={() => {
                            // Hard X-Frame-Options / CSP block — show error state.
                            // Do NOT auto-launch the virtual browser; let the user decide.
                            clearTimeout(iframeBlockTimeoutRef.current);
                            setIframeLoading(false);
                            setIframeError(true);
                            setIframeBlockSuspected(true);
                            // Globe popup is available for user to manually click if needed.
                          }}
                        />
                      )}
                      {/* ── Loading spinner ── */}
                      {(iframeLoading || isLaunchingVirtualBrowser) && !hyperbeamSession && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 20,
                          background: 'linear-gradient(135deg, #0a0a0f 0%, #111128 100%)'
                        }}>
                          <div style={{ position: 'relative', width: 64, height: 64 }}>
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(var(--brand-1-rgb),0.15)' }} />
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--brand-1)', borderRightColor: 'var(--brand-2)', animation: 'spin 0.9s linear infinite' }} />
                            <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--brand-2)', animation: 'spin 1.4s linear infinite reverse' }} />
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Loading page…</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            {[0,1,2].map(i => (
                              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-1)', animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
                            ))}
                          </div>
                          <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
                        </div>
                      )}

                      {/* ── Subtle "Page not loading?" settings panel — shown after load, only to host ──
                          Appears as a small pill at the bottom of the iframe area when page is loaded.
                          User sees blocked content and can click to switch to Virtual Browser. */}
                      {/* ── Subtle "Page not loading?" settings panel ── */}
                      {!iframeLoading && !hyperbeamSession && !isVirtualBrowserMedia && (iframeBlockSuspected || iframeError) && (
                        <div
                          className="iframe-settings-hint"
                          style={{
                            position: 'absolute',
                            bottom: 16,
                            right: 16,
                            zIndex: 40,
                            opacity: showControls ? 0.95 : 0,
                            pointerEvents: showControls ? 'auto' : 'none',
                            transition: 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out'
                          }}
                        >
                          {isEffectiveHost ? (
                            <button
                              onClick={() => {
                                setIframeBlockSuspected(false);
                                setIframeError(false);
                                handleOpenCloudBrowser();
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: (iframeHintExpanded || hoveringIframeHint) ? 8 : 0,
                                background: 'rgba(15, 15, 25, 0.95)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(var(--brand-1-rgb), 0.45)',
                                borderRadius: (iframeHintExpanded || hoveringIframeHint) ? 20 : '50%',
                                padding: (iframeHintExpanded || hoveringIframeHint) ? '8px 18px' : '11px',
                                width: (iframeHintExpanded || hoveringIframeHint) ? 'auto' : 40,
                                height: 40,
                                justifyContent: 'center',
                                color: 'var(--brand-1-light)',
                                cursor: 'pointer',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                                transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden'
                              }}
                              onMouseEnter={() => setHoveringIframeHint(true)}
                              onMouseLeave={() => setHoveringIframeHint(false)}
                            >
                              <Globe size={16} />
                              <span style={{
                                opacity: (iframeHintExpanded || hoveringIframeHint) ? 1 : 0,
                                maxWidth: (iframeHintExpanded || hoveringIframeHint) ? 300 : 0,
                                transition: 'opacity 0.25s, max-width 0.35s',
                                fontSize: 12,
                                fontWeight: 700
                              }}>
                                Game not loading? Launch in Cloud Browser
                              </span>
                            </button>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: (iframeHintExpanded || hoveringIframeHint) ? 8 : 0,
                                background: 'rgba(15, 15, 25, 0.95)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: (iframeHintExpanded || hoveringIframeHint) ? 20 : '50%',
                                padding: (iframeHintExpanded || hoveringIframeHint) ? '8px 18px' : '11px',
                                width: (iframeHintExpanded || hoveringIframeHint) ? 'auto' : 40,
                                height: 40,
                                justifyContent: 'center',
                                color: 'rgba(255, 255, 255, 0.65)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                                transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden'
                              }}
                              onMouseEnter={() => setHoveringIframeHint(true)}
                              onMouseLeave={() => setHoveringIframeHint(false)}
                            >
                              <Globe size={15} />
                              <span style={{
                                opacity: (iframeHintExpanded || hoveringIframeHint) ? 1 : 0,
                                maxWidth: (iframeHintExpanded || hoveringIframeHint) ? 350 : 0,
                                transition: 'opacity 0.25s, max-width 0.35s',
                                fontSize: 11,
                                fontWeight: 600
                              }}>
                                If game fails to connect, ask Host to launch Cloud Browser
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Block Fallback Overlay ── */}
                    {iframeBlockSuspected && !hyperbeamSession && !isVirtualBrowserMedia && (
                      <div style={{
                        position: 'absolute', inset: 0, zIndex: 30,
                        background: 'linear-gradient(135deg, rgba(10,10,20,0.97), rgba(20,10,35,0.99))',
                        backdropFilter: 'blur(16px)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 20
                      }}>
                        <div style={{ fontSize: 44 }}>🌐</div>
                        <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 20px' }}>
                          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                            Page blocks embedding
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
                            This portal does not support direct iframe embedding. Open it in a Virtual Browser to browse and play together.
                          </div>
                        </div>
                        {isEffectiveHost ? (
                          <button
                            onClick={() => handleOpenCloudBrowser()}
                            style={{
                              background: 'linear-gradient(135deg, var(--brand-2-dark), var(--brand-2))',
                              border: 'none', borderRadius: 14,
                              padding: '13px 28px', fontSize: 15, fontWeight: 700,
                              color: '#fff', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 10,
                              boxShadow: '0 8px 30px rgba(var(--brand-2-rgb),0.45)',
                              transition: 'all 0.25s cubic-bezier(0.175,0.885,0.32,1.275)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06) translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(var(--brand-2-rgb),0.6)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(var(--brand-2-rgb),0.45)'; }}
                          >
                            🌐 Open in Virtual Browser
                          </button>
                        ) : (
                          <div style={{ color: 'var(--brand-2)', fontSize: 13, fontWeight: 600 }}>
                            Waiting for the host to launch Virtual Browser...
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Hyperbeam Virtual Browser overlay — seamless, no badges ──
                        Covers the entire iframe area when a virtual browser session is active.
                        Only a thin exit bar appears on hover at the top — invisible otherwise. */}
                    {hyperbeamSession && (
                      <div
                        style={{
                          position: 'absolute', inset: 0, zIndex: 50,
                          borderRadius: isMobile ? 0 : 16, overflow: 'hidden'
                        }}
                      >
                        <div
                          ref={hyperbeamContainerRef}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
                        />
                        {/* Hover-revealed thin exit bar — hidden when game/activity overlay is active */}
                        {isEffectiveHost && !isGameOrActivity(mediaUrl) && (
                          <div
                            className="hb-exit-bar"
                            style={{
                              position: 'absolute', top: 0, left: 0, right: 0,
                              height: 36, zIndex: 60,
                              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                              padding: '0 10px',
                              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
                              opacity: 0, transition: 'opacity 0.25s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                          >
                            <button
                              onClick={handleCloseCloudBrowser}
                              style={{
                                background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)',
                                borderRadius: 16, padding: '3px 12px',
                                fontSize: 11, fontWeight: 700, color: '#fca5a5',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#fca5a5'; }}
                            >
                              ✕ Exit Virtual Browser
                            </button>
                          </div>
                        )}
                        {/* Connecting spinner — clears automatically when WebRTC stream starts */}
                        {hbNavStatus === 'connecting' && (
                          <div style={{
                            position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                            zIndex: 65, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                            borderRadius: 20, padding: '6px 14px',
                            color: 'var(--brand-1-light)', fontSize: 12, fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 7, pointerEvents: 'none'
                          }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--brand-1)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                            Connecting to Cloud Browser…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Click/hover-to-toggle overlay — sits above the iframe so mouse/touch
                        events actually reach us instead of being swallowed by it (a genuine
                        cross-origin iframe never bubbles input to the parent page). Used to be
                        skipped for embed platforms (YouTube/SoundCloud) since their native
                        controls handled this directly; now that our own bar is the sole control
                        surface there too, this is what makes click-to-play/pause and mouse-move-
                        resets-the-auto-hide-timer work for them at all. Skipped when the user
                        explicitly asked for native controls (hideCustomControls), and always
                        skipped for Twitch/native-Vimeo — those render a real native iframe with
                        no ReactPlayer ref behind it, so togglePlayPause() is a silent no-op there
                        and this overlay would only swallow clicks meant for the platform's own
                        play button underneath. */}
                    {!hideCustomControls && !isTwitch && !(isVimeo && !useCustomVimeoControls) && (
                      <div
                        onClick={togglePlayPause}
                        onMouseMove={resetControlsTimer}
                        onTouchStart={resetControlsTimer}
                        style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'pointer' }}
                      />
                    )}
                    <div 
                      style={{ 
                        position: 'absolute', inset: 0, 
                        overflow: mediaUrl.includes('twitch.tv') ? 'visible' : 'hidden', 
                        borderRadius: 12,
                        willChange: 'transform',
                        background: '#000'
                      }}
                      onMouseMove={resetInactivityTimer}
                      onMouseEnter={() => setUiVisible(true)}
                    >
                      {/* Audio Ducking toast — non-intrusive, visible during fullscreen */}
                      {duckingNotice && (
                        <div style={{
                          position: 'absolute',
                          bottom: 70,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(0,0,0,0.72)',
                          color: '#fff',
                          fontSize: '0.72rem',
                          padding: '5px 14px',
                          borderRadius: 999,
                          zIndex: 30,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                        }}>
                          🔇 Media lowered — {duckingNotice} is speaking
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        inset: (useCustomVimeoControls && isVimeo) ? '0 0 -40px 0' : 0,
                        zIndex: 0,
                        filter: QUALITY_PRESETS[videoQuality]?.filter || 'none',
                        transition: 'filter 0.4s ease',
                      }}>
                        {isLocalStream ? (
                          <>
                            <video
                              key={mediaUrl}
                              ref={localVideoRef}
                              src={mediaUrl}
                              autoPlay
                              muted={playerMuted}
                              playsInline
                              width="100%"
                              height="100%"
                              style={{
                                background: '#000',
                                display: 'block',
                                zIndex: 9999,
                                position: 'relative'
                              }}
                              onPlay={(e) => {
                                if (!isEffectiveHost) return;
                                if (Date.now() - lastExternalUpdate.current < 500) return;
                                socket.emit('play', { roomId: (roomId || '').toLowerCase(), currentTime: e.target.currentTime });
                                setIsPlaying(true);
                              }}
                              onPause={(e) => {
                                if (!isEffectiveHost) return;
                                if (Date.now() - lastExternalUpdate.current < 500) return;
                                socket.emit('pause', { roomId: (roomId || '').toLowerCase(), currentTime: e.target.currentTime });
                                setIsPlaying(false);
                              }}
                              onSeeked={(e) => {
                                if (!isEffectiveHost) return;
                                if (Date.now() - lastExternalUpdate.current < 500) return;
                                socket.emit('seek', { roomId: (roomId || '').toLowerCase(), currentTime: e.target.currentTime });
                              }}
                              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                              onDurationChange={(e) => setDuration(e.target.duration)}
                              onCanPlay={() => {
                                console.log('[VIDEO] onCanPlay fired')
                                setIsPreparing(false)
                                setIsStreamBuffering(false)
                              }}
                              onLoadStart={() => console.log('[VIDEO] onLoadStart')}
                              onLoadedMetadata={(e) => {
                                console.log('[VIDEO] onLoadedMetadata');
                                e.target.volume = playerVolume;
                                e.target.muted = playerMuted;
                                if (prepTargetTimeRef.current > 0) {
                                  e.target.currentTime = prepTargetTimeRef.current;
                                  prepTargetTimeRef.current = 0;
                                }
                              }}
                              onLoadedData={() => console.log('[VIDEO] onLoadedData')}
                              onError={(e) => {
                                console.error('[VIDEO] onError:',
                                  e.target.error?.code,
                                  e.target.error?.message
                                )
                              }}
                              onStalled={() => setIsStreamBuffering(true)}
                              onWaiting={() => setIsStreamBuffering(true)}
                              onPlaying={() => setIsStreamBuffering(false)}
                            />
                            {/* Custom subtitle overlay */}
                            {activeCue && subtitlesVisible && (() => {
                              const fsMap = { small: 14, medium: 18, large: 24, xlarge: 32 };
                              const colorMap = { white: '#ffffff', yellow: '#ffef00', cyan: '#00e5ff', green: '#00e676' };
                              const fs = fsMap[subtitleSettings.fontSize] || 18;
                              const color = colorMap[subtitleSettings.textColor] || '#ffffff';
                              const bg = subtitleSettings.bgColor === 'transparent' ? 'transparent'
                                : subtitleSettings.bgColor === 'darkgray' ? 'rgba(40,40,40,0.88)'
                                : 'rgba(0,0,0,0.88)';
                              const isCenter = subtitleSettings.position === 'center';
                              const pbottom = subtitleSettings.position === 'bottom-raised' ? '14%' : '8%';
                              return (
                                <div style={{
                                  position: 'absolute', inset: 0, zIndex: 10000,
                                  display: 'flex', justifyContent: 'center',
                                  alignItems: isCenter ? 'center' : 'flex-end',
                                  paddingBottom: isCenter ? 0 : pbottom,
                                  pointerEvents: 'none', userSelect: 'none',
                                }}>
                                  <div style={{
                                    background: bg,
                                    padding: bg === 'transparent' ? '0 8px' : '4px 16px',
                                    borderRadius: 4,
                                    fontSize: fs,
                                    color,
                                    fontFamily: '"Inter", system-ui, sans-serif',
                                    fontWeight: 500,
                                    textAlign: 'center',
                                    lineHeight: 1.5,
                                    textShadow: bg === 'transparent'
                                      ? '1px 1px 4px rgba(0,0,0,0.9), -1px -1px 4px rgba(0,0,0,0.7)'
                                      : 'none',
                                    whiteSpace: 'pre-line',
                                    maxWidth: '88%',
                                    opacity: subtitleSettings.opacity,
                                  }}>
                                    {activeCue.text}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : isTwitch ? (
                          <TwitchIframe
                            channel={twitchChannel}
                            parent={twitchParent}
                            reloadKey={twitchReloadKey}
                            isMobile={isMobile}
                            handleReloadTwitch={handleReloadTwitch}
                            isUnmountingTwitch={isUnmountingTwitch}
                            onLoad={handleTwitchOnLoad}
                          />
                        ) : (isVimeo && !useCustomVimeoControls) ? (
                          <VimeoIframe
                            videoId={vimeoId}
                            isMobile={isMobile}
                            onLoad={handleVimeoOnLoad}
                          />
                        ) : (
                          <ReactPlayer
                            ref={playerRef}
                            url={mediaUrl}
                            width="100%" height="100%"
                            // Was true for YouTube/SoundCloud, rendering the platform's own native
                            // control bar simultaneously with our custom one below (offset up 46px
                            // to avoid fully overlapping it) — a confusing dual-UI that's also why
                            // the custom bar looked "off" position. Our own bar already covers
                            // play/pause/seek/CC/quality/fullscreen, so it's the sole control
                            // surface everywhere now, same as the Vimeo-with-custom-controls case —
                            // except when the user explicitly asked for native controls via
                            // "Use Native Player" (hideCustomControls), which needs somewhere to
                            // fall back to now that it's not already showing underneath.
                            controls={(mediaUrl.includes('vimeo.com') && !useCustomVimeoControls) || hideCustomControls}
                            playing={isPreparing || (isPlaying && !isPreparing)}
                            volume={isPreparing ? 0 : playerVolume}
                            muted={isPreparing || playerMuted}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onReady={() => {
                              // Playback started — clear the failure detection timer
                              clearTimeout(loadTimeoutRef.current);
                              setLoadFailed(false);
                              setIsPreparing(false);
                            }}
                            onBuffer={() => !isPreparing && console.log('Buffering...')}
                            onSeek={handleSeek}
                            onProgress={({ playedSeconds }) => {
                              if (Math.floor(playedSeconds) !== Math.floor(currentTime)) {
                                setCurrentTime(playedSeconds);
                              }
                            }}
                            progressInterval={1000}
                            onDuration={setDuration}
                            onError={(e) => {
                              console.error('[ReactPlayer] Error:', e);
                              clearTimeout(loadTimeoutRef.current);
                              setFailedPlaybackUrl(mediaUrl || mediaUrlRef.current || '');
                              setLoadFailed(true);
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
                              }
                            }}
                          />
                        )}

                        {/* ─── Hyperbeam Cloud Browser SDK — renders when session is active ─── */}
                        {hyperbeamSession && (
                          <div style={{
                            position: 'absolute', inset: 0, zIndex: 30,
                            borderRadius: 12, overflow: 'hidden',
                            display: 'flex', flexDirection: 'column'
                          }}>
                            <div
                              ref={hyperbeamContainerRef}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
                            />
                            {/* Active session badge + close button (host only) */}
                            <div style={{
                              position: 'absolute', top: 10, right: 10,
                              display: 'flex', alignItems: 'center', gap: 8, zIndex: 40
                            }}>
                              <div style={{
                                background: 'rgba(var(--brand-2-rgb),0.18)', border: '1px solid rgba(var(--brand-2-rgb),0.45)',
                                backdropFilter: 'blur(10px)', borderRadius: 20,
                                padding: '5px 12px', fontSize: 12, fontWeight: 700,
                                color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 4px 20px rgba(var(--brand-2-rgb),0.2)'
                              }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-2)', display: 'inline-block', animation: 'prepPulse 2s infinite' }} />
                                Cloud Browser
                              </div>
                              {isEffectiveHost && (
                                <button
                                  id="cloud-browser-close-btn"
                                  onClick={handleCloseCloudBrowser}
                                  title="Close Cloud Browser"
                                  style={{
                                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                                    backdropFilter: 'blur(10px)', borderRadius: 20,
                                    padding: '5px 12px', fontSize: 12, fontWeight: 700,
                                    color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.35)'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                                >
                                  ✕ Close
                                </button>
                              )}
                            </div>
                            {/* Connecting spinner — clears automatically when WebRTC stream starts */}
                            {hbNavStatus === 'connecting' && (
                              <div style={{
                                position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                                zIndex: 45, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                                borderRadius: 20, padding: '6px 14px',
                                color: 'var(--brand-1-light)', fontSize: 12, fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 7, pointerEvents: 'none'
                              }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--brand-1)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                Connecting to Cloud Browser…
                              </div>
                            )}
                          </div>
                        )}

                        {/* ─── Load Failure Overlay — shown when ReactPlayer errors or times out ─── */}
                        {loadFailed && !hyperbeamSession && !isLocalStream && (
                          <div style={{
                            position: 'absolute', inset: 0, zIndex: 25,
                            background: 'linear-gradient(135deg, rgba(10,10,20,0.96), rgba(20,10,35,0.98))',
                            backdropFilter: 'blur(16px)',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            borderRadius: 12, gap: 'clamp(10px, 3vh, 20px)',
                            padding: '16px', boxSizing: 'border-box', overflowY: 'auto'
                          }}>
                            {isVirtualBrowserUrl(mediaUrl) ? (
                              <>
                                <div style={{ fontSize: 44 }}>🎮</div>
                                <div style={{ textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
                                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                                    WebGL Game Load Failed
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
                                    This game needs WebGL/WebGL2. The current virtual browser session does not support it. Try another game or use desktop browser mode.
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 440 }}>
                                  {isEffectiveHost && (
                                    <button
                                      onClick={() => handleOpenCloudBrowser()}
                                      style={{
                                        background: 'linear-gradient(135deg, var(--brand-2-dark), var(--brand-2))',
                                        border: 'none', borderRadius: 12,
                                        padding: '11px 22px', fontSize: 13, fontWeight: 700,
                                        color: '#fff', cursor: 'pointer',
                                        boxShadow: '0 8px 24px rgba(var(--brand-2-rgb),0.3)',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      🔄 Restart Virtual Browser
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      window.open(mediaUrl, '_blank');
                                    }}
                                    style={{
                                      background: 'rgba(255,255,255,0.06)',
                                      border: '1px solid rgba(255,255,255,0.15)',
                                      borderRadius: 12,
                                      padding: '11px 22px', fontSize: 13, fontWeight: 700,
                                      color: '#fff', cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    🖥️ Try Desktop Game Mode
                                  </button>
                                  <button
                                    onClick={() => {
                                      setLoadFailed(false);
                                      setShowMediaSelector(true);
                                    }}
                                    style={{
                                      background: 'rgba(255,255,255,0.06)',
                                      border: '1px solid rgba(255,255,255,0.15)',
                                      borderRadius: 12,
                                      padding: '11px 22px', fontSize: 13, fontWeight: 700,
                                      color: '#fff', cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    🎲 Open simpler HTML5 games
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: 44 }}>⚠️</div>
                                <div style={{ textAlign: 'center', maxWidth: 360 }}>
                                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                                    Video failed to load
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
                                    This URL could not be played directly.
                                    Open it in a Cloud Browser to watch together.
                                  </div>
                                </div>
                                {isEffectiveHost && (
                                  <button
                                    id="open-cloud-browser-btn"
                                    onClick={handleOpenCloudBrowser}
                                    className="stay-white"
                                    style={{
                                      background: 'linear-gradient(135deg, var(--brand-2-dark), var(--brand-2))',
                                      border: 'none', borderRadius: 14,
                                      padding: '13px 28px', fontSize: 15, fontWeight: 700,
                                      color: '#fff', cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      boxShadow: '0 8px 30px rgba(var(--brand-2-rgb),0.45)',
                                      transition: 'all 0.25s cubic-bezier(0.175,0.885,0.32,1.275)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06) translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(var(--brand-2-rgb),0.6)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(var(--brand-2-rgb),0.45)'; }}
                                  >
                                    🌐 Open in Cloud Browser
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => { setLoadFailed(false); handleStopMedia(); }}
                              style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 10, padding: '9px 20px',
                                color: 'rgba(255,255,255,0.55)', fontSize: 13,
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                            >
                              Try a different URL
                            </button>
                          </div>
                        )}
                      </div>

                      {/* --- Smooth Streaming Preparation Overlay (Root of video container for full coverage) ---
                          Deliberately just the loading indicator — no heading/subtitle/cancel button — so it
                          stays compact and never overflows short mobile viewports. */}
                      {effectiveIsPreparing && (
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 1200,
                          background: 'radial-gradient(circle at center, rgba(15, 10, 35, 0.98), rgba(5, 5, 15, 1))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(12px)', transition: 'all 0.5s ease',
                          borderRadius: 12
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1.5vh, 7px)', height: 'clamp(30px, 8vh, 50px)' }}>
                            {[0, 1, 2, 3, 4].map(i => (
                              <div key={i} style={{
                                width: 'clamp(4px, 1.2vh, 7px)', borderRadius: 4,
                                background: 'linear-gradient(180deg,var(--brand-2),#ec4899)',
                                animation: 'prepWaveBar 1s ease-in-out infinite',
                                animationDelay: `${i * 0.12}s`
                              }} />
                            ))}
                          </div>
                          <style>{`
                            @keyframes prepWaveBar {
                              0%, 100% { height: 30%; opacity: 0.6; }
                              50% { height: 100%; opacity: 1; }
                            }
                          `}</style>
                        </div>
                      )}

                      {/* --- Mid-playback buffering indicator for locally-streamed (progressive
                          upload) video. isPreparing only covers the initial load and is disabled
                          for local streams, so without this a viewer catching up to the still-
                          uploading edge of the file saw the video silently freeze — this makes
                          clear it's still loading rather than looking broken. --- */}
                      {isStreamBuffering && isLocalStream && !effectiveIsPreparing && (
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 1150,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 12, pointerEvents: 'none',
                          background: 'rgba(0,0,0,0.35)',
                        }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            border: '3px solid rgba(255,255,255,0.25)', borderTopColor: 'var(--brand-2)',
                            animation: 'sp-buffer-spin 0.8s linear infinite',
                          }} />
                          <span className="stay-white" style={{ color: '#fff', fontSize: 13, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                            {uploadState.isUploading ? 'Buffering — still uploading…' : 'Buffering…'}
                          </span>
                          <style>{`@keyframes sp-buffer-spin { to { transform: rotate(360deg); } }`}</style>
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
                                className="stay-white"
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
                            {(isTwitch || isVimeo) && (
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
                          { ((mediaUrl.includes('twitch.tv') && useCustomTwitchControls) || (mediaUrl.includes('vimeo.com') && useCustomVimeoControls)) && (
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
                  background: isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 24,
                  boxShadow: isLight ? '0 12px 36px rgba(var(--brand-1-rgb),0.12)' : '0 10px 40px rgba(0,0,0,0.4)',
                  border: isLight ? '1px solid rgba(var(--brand-1-rgb),0.1)' : '1px solid rgba(255,255,255,0.08)'
                }}>
                  <MonitorPlay size={44} color={isLight ? 'var(--brand-1)' : '#fff'} strokeWidth={2} />
                </div>
                <h3 className={`no-media-title${(isFullscreen || isTvMode) ? ' stay-white' : ''}`} style={{ margin: '0 0 16px', color: (isFullscreen || isTvMode) ? '#fff' : (isLight ? '#0f172a' : '#fff'), fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px' }}>{t('noMediaSelected', 'No Media Selected')}</h3>
                {!isTvMode && hasPlayerPrivileges && (
                <button
                  onClick={() => setShowMediaSelector(true)}
                  style={{
                    background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
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
                    boxShadow: isLight ? '0 10px 25px rgba(var(--brand-1-rgb),0.3)' : '0 10px 25px rgba(0,0,0,0.5)',
                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)'; e.currentTarget.style.boxShadow = isLight ? '0 15px 30px rgba(var(--brand-1-rgb),0.4)' : '0 15px 30px rgba(0,0,0,0.6)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = isLight ? '0 10px 25px rgba(var(--brand-1-rgb),0.3)' : '0 10px 25px rgba(0,0,0,0.5)'; }}
                >
                  <LayoutGrid size={20} color="#ffffff" />
                  <span className="forced-white">{t('browseMediaAndApps', 'Browse Media & Apps')}</span>
                </button>
                )}
              </div>
            )}

            {/* ── Mobile tap-gesture layer — left/right thirds double-tap to seek ±10s,
                single tap toggles the control bar, center third single-tap play/pauses.
                For media we own custom controls for: uploaded/direct video files and local
                streams always, plus embed platforms (YouTube/SoundCloud) now that our bar
                is their sole control surface too — unless the user explicitly switched to
                native controls (hideCustomControls), where taps should reach that UI
                directly instead. Never over a web iframe (real interactive page) or
                Twitch/Vimeo, which use their own separate iframe components. ── */}
            {isTouchPlayer && !isTvMode && hasMounted && mediaUrl && !(isScreensharing || isViewer) &&
              !isGameOrActivity(mediaUrl) && !isWebIframe(mediaUrl) && (!isEmbedPlatform(mediaUrl) || !hideCustomControls) &&
              !isTwitch && !isVimeo && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex' }}>
                <div style={{ flex: 1 }} onClick={() => handlePlayerZoneTap('left')} />
                <div style={{ flex: 1.2 }} onClick={() => handlePlayerZoneTap('center')} />
                <div style={{ flex: 1 }} onClick={() => handlePlayerZoneTap('right')} />
                {seekFeedback && (
                  <div
                    key={seekFeedback.key}
                    style={{
                      position: 'absolute', top: '50%',
                      [seekFeedback.dir === 'back' ? 'left' : 'right']: '16%',
                      transform: 'translateY(-50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', pointerEvents: 'none',
                      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9)) drop-shadow(0 0 8px rgba(0,0,0,0.5))',
                      animation: 'sp-seek-pulse 0.6s ease-out',
                    }}
                  >
                    {seekFeedback.dir === 'back' ? <RotateCcw size={36} color="#fff" /> : <RotateCw size={36} color="#fff" />}
                  </div>
                )}
                {centerFeedback && (
                  <div
                    key={centerFeedback.key}
                    style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', pointerEvents: 'none',
                      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9)) drop-shadow(0 0 8px rgba(0,0,0,0.5))',
                      animation: 'sp-center-pulse 0.55s ease-out',
                    }}
                  >
                    {centerFeedback.type === 'play' ? <Play size={40} color="#fff" fill="#fff" /> : <Pause size={40} color="#fff" fill="#fff" />}
                  </div>
                )}
                <style>{`
                  @keyframes sp-seek-pulse { 0% { opacity: 0; transform: translateY(-50%) scale(0.8); } 25% { opacity: 1; transform: translateY(-50%) scale(1); } 75% { opacity: 1; } 100% { opacity: 0; transform: translateY(-50%) scale(1); } }
                  @keyframes sp-center-pulse { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); } 30% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1); } }
                `}</style>
              </div>
            )}

            {/* Persistent file input — lives outside the modal so it survives modal unmount */}
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,.mp4,.webm,.mkv,.mov,.avi"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                console.log('[FILE INPUT] onChange fired, file:', file?.name, 'type:', file?.type, 'size:', file?.size);
                e.target.value = ''; // reset so same file can be re-selected
                if (!file) { console.log('[FILE INPUT] No file (cancelled)'); return; }
                handleFileUpload(file);
              }}
            />

            {/* Subtitles file input */}
            <input
              ref={subtitleInputRef}
              type="file"
              accept=".vtt,.srt,.VTT,.SRT,text/vtt,application/x-subrip"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const text = evt.target.result;
                  let vttText = text;
                  if (file.name.toLowerCase().endsWith('.srt')) {
                    vttText = convertSrtToVtt(text);
                  }
                  setSubtitleVttText(vttText);
                  setSubtitlesUrl(oldUrl => {
                    if (oldUrl) URL.revokeObjectURL(oldUrl);
                    const blob = new Blob([vttText], { type: 'text/vtt' });
                    return URL.createObjectURL(blob);
                  });
                  setSubtitlesVisible(true);
                  if (socket) {
                    socket.emit('subtitles_load', { roomId: (roomId || '').toLowerCase(), text: vttText });
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />

            {/* Upload progress and loading status indicators hidden to run silently in the background */}

            {/* Custom Control Bar — visible ONLY for Direct Videos (Hidden for WebRTC to avoid overlapping native streaming controls) */}
            {/* Bottom control bar — shown for direct video AND web-iframe/HB URLs */}
            {!isTvMode && (hasMounted && mediaUrl) && !(isScreensharing || isViewer) && (
              isGameOrActivity(mediaUrl) ? (
                /* Game mode: no bottom/top-right control bar — use the top-left game dropdown instead */
                null
              ) : !((isTwitch && useCustomTwitchControls) || (isVimeo && useCustomVimeoControls)) && (
                /* Existing video player control bar */
                <div className="gcw-force-dark" style={{
                  display: hideCustomControls ? 'none' : 'block',
                  // Used to sit 46px above the bottom edge for embed platforms to dodge YouTube's
                  // own native control bar rendering underneath it — now that our bar is the sole
                  // control surface there too (no native controls left to dodge), it sits flush
                  // like every other platform.
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  zIndex: 25,
                  background: isEmbedPlatform(mediaUrl) ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                  padding: '24px 14px 10px',
                  // Always visible for web iframes (real interactive pages/games) — those get no
                  // click/hover-catching overlay of ours (input must reach the iframe directly),
                  // so we have no reliable way to detect mouse movement over them and would risk
                  // controls getting stuck hidden with nothing to bring them back. Every other
                  // media type (local streams, and embed platforms like YouTube now that our own
                  // overlay/tap-gesture layer catches their clicks/movement instead of the iframe)
                  // follows the normal show-then-auto-hide-after-inactivity behavior.
                  opacity: isWebIframe(mediaUrl) ? 1 : (showControls ? 1 : 0),
                  transition: 'opacity 0.3s ease',
                  pointerEvents: 'none',
                  borderRadius: isEmbedPlatform(mediaUrl) ? '0' : '0 0 16px 16px'
                }}>
                  {/* Scrubber — hidden for web iframes */}
                  {!(isScreensharing || isViewer) && !isWebIframe(mediaUrl) && duration > 0 && (
                    <div style={{ position: 'relative', height: 4, marginBottom: 10, display: 'flex', alignItems: 'center', pointerEvents: showControls ? 'auto' : 'none' }}>
                      <div style={{
                        position: 'absolute', left: 0, height: 4, borderRadius: 2,
                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        background: 'linear-gradient(90deg,var(--brand-1),var(--brand-2))',
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
                        disabled={!hasPlayerPrivileges}
                        style={{
                          position: 'absolute', inset: 0, zIndex: 2, width: '100%',
                          '--track-fill': `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                          cursor: hasPlayerPrivileges ? 'pointer' : 'default',
                          pointerEvents: hasPlayerPrivileges ? 'auto' : 'none'
                        }}
                      />
                    </div>
                  )}
                  {/* Controls row — follows the same isWebIframe exception as the wrapping bar's
                      opacity above. */}
                  <div className="player-controls-row" style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: (isWebIframe(mediaUrl) ? 'auto' : (showControls ? 'auto' : 'none')) }}>

                    {/* 1. Load Media — opens App Directory without stopping current playback */}
                    {hasPlayerPrivileges && (
                      <button
                        className="player-ctrl-btn player-ctrl-load-btn"
                        onClick={() => setShowMediaSelector(true)}
                        title="Load Media"
                      >
                        <LayoutGrid size={16} />
                      </button>
                    )}

                    {/* Play/Pause — only for ReactPlayer URLs (can actually control) and local streams.
                        Hidden for web iframes (webpage, can't control playback) */}
                    {hasPlayerPrivileges && !isWebIframe(mediaUrl) && (
                      <button className="player-ctrl-btn" onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
                      </button>
                    )}

                    {/* Stop button — should be there no matter which video url we pasted */}
                    {hasPlayerPrivileges && (
                      <button className="player-ctrl-btn" onClick={handleStopMedia} title="Stop">
                        <Square size={18} fill="#fff" />
                      </button>
                    )}

                    {/* Skip -10s and +10s (Only for videos with valid seekable duration).
                        Hidden on mobile — replaced by double-tap left/right on the video
                        itself (see the tap-gesture layer above), like a normal mobile player. */}
                    {!isTouchPlayer && duration > 0 && hasPlayerPrivileges && (
                      <>
                        <button className="player-ctrl-btn" onClick={skipBack10} title="Backward 10s">
                          <RotateCcw size={18} />
                        </button>
                        <button className="player-ctrl-btn" onClick={skipForward10} title="Forward 10s">
                          <RotateCw size={18} />
                        </button>
                      </>
                    )}
                    {/* Volume */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button className="player-ctrl-btn" onClick={toggleMutePlayer} title={playerMuted ? 'Unmute' : 'Mute'}>
                        {playerMuted || playerVolume === 0 ? <VolumeX size={18} /> : playerVolume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                      </button>
                      <input
                        type="range" className="player-vol-slider"
                        min={0} max={1} step={0.02}
                        value={playerMuted ? 0 : playerVolume}
                        onChange={handleVolumeChange}
                        style={{
                          background: `linear-gradient(to right, var(--brand-1-light) ${(playerMuted ? 0 : playerVolume) * 100}%, rgba(255,255,255,0.2) ${(playerMuted ? 0 : playerVolume) * 100}%)`
                        }}
                      />
                    </div>
                    {isDucked && (
                      <div className="player-ducked-badge" title={`Audio ducked — ${duckingNotice} is speaking`} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(var(--brand-1-rgb),0.2)', border: '1px solid rgba(var(--brand-1-rgb),0.4)', borderRadius: 10, padding: '2px 7px', fontSize: 10, color: 'var(--brand-1-light)', fontWeight: 700, userSelect: 'none' }}>
                        <Mic size={10} /> DUCKED
                      </div>
                    )}
                    {/* Time — shown for any video with duration */}
                    {!(isScreensharing || isViewer) && duration > 0 && (
                      <span style={{ fontSize: 11, color: '#ccc', whiteSpace: 'nowrap', marginLeft: 2, fontVariantNumeric: 'tabular-nums' }}>
                        {formatDuration(currentTime)} / {formatDuration(duration)}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />

                    {/* Fallback to Native controls — compact icon-only on touch, since
                        .player-native-btn's full text-pill version is hidden by CSS there
                        (too wide for the row); same setHideCustomControls(true) action,
                        the top-center "restore" button (below) already handles switching
                        back and already has its own compact touch styling. */}
                    {isTouchPlayer && (
                      <button
                        className="player-ctrl-btn"
                        onClick={() => setHideCustomControls(true)}
                        title="Use native player controls"
                      >
                        <ChevronDown size={16} />
                      </button>
                    )}
                    <button
                      className="player-native-btn"
                      onClick={() => setHideCustomControls(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        color: 'var(--brand-1-light)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        pointerEvents: 'auto'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(var(--brand-1-rgb), 0.18)';
                        e.currentTarget.style.border = '1px solid rgba(var(--brand-1-rgb), 0.45)';
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(var(--brand-1-rgb), 0.25)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.color = 'var(--brand-1-light)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                      }}
                      title="Hide custom controls and use native player controls"
                    >
                      <ChevronDown size={14} color="var(--brand-1-light)" />
                      <span>Use Native Player</span>
                    </button>

                    <div style={{ flex: 1 }} />
 
                  {/* Globe / Virtual Browser button — only shown for web iframe URLs.
                      Disabled until a block is detected (hard X-Frame error OR soft 10s timeout). */}
                  {isWebIframe(mediaUrl) && isEffectiveHost && (
                    <div ref={globePopupRef} className="player-globe-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button
                        id="globe-virtual-browser-btn"
                        className="player-ctrl-btn"
                        disabled={false}
                        onClick={() => setShowGlobePopup(v => !v)}
                        title="Open in Virtual Browser"
                        style={{
                          opacity: 1,
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'opacity 0.3s, box-shadow 0.3s',
                          boxShadow: (iframeBlockSuspected || iframeError) ? '0 0 10px rgba(var(--brand-1-rgb),0.5)' : 'none',
                          animation: (iframeBlockSuspected || iframeError) ? 'globePing 1.8s ease-out 2' : 'none',
                        }}
                      >
                        <Globe size={17} />
                        {/* Small red dot badge when block is detected */}
                        {(iframeBlockSuspected || iframeError) && (
                          <span style={{
                            position: 'absolute', top: 3, right: 3,
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#ef4444',
                            border: '1.5px solid rgba(0,0,0,0.5)',
                            boxShadow: '0 0 6px rgba(239,68,68,0.7)',
                            animation: 'pulse-red 1.2s infinite',
                          }} />
                        )}
                      </button>

                      {/* Globe Popup — light/dark mode aware */}
                      {showGlobePopup && (iframeBlockSuspected || iframeError) && (
                        <div style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 12px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,10,22,0.97)',
                          border: isLight ? '1px solid rgba(var(--brand-1-rgb),0.2)' : '1px solid rgba(var(--brand-1-rgb),0.35)',
                          borderRadius: 14,
                          padding: '14px 16px',
                          minWidth: 240,
                          maxWidth: 280,
                          zIndex: 9999,
                          boxShadow: isLight
                            ? '0 -4px 24px rgba(0,0,0,0.12), 0 8px 32px rgba(var(--brand-1-rgb),0.1), 0 0 0 1px rgba(var(--brand-1-rgb),0.08)'
                            : '0 -8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(var(--brand-1-rgb),0.15)',
                          backdropFilter: 'blur(18px)',
                          animation: 'slideUpFade 0.2s ease-out',
                        }}>
                          {/* Arrow — border layer */}
                          <div style={{
                            position: 'absolute', bottom: -8, left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0, height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: isLight ? '8px solid rgba(var(--brand-1-rgb),0.2)' : '8px solid rgba(var(--brand-1-rgb),0.35)',
                          }} />
                          {/* Arrow — fill layer */}
                          <div style={{
                            position: 'absolute', bottom: -6, left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0, height: 0,
                            borderLeft: '7px solid transparent',
                            borderRight: '7px solid transparent',
                            borderTop: isLight ? '7px solid rgba(255,255,255,0.98)' : '7px solid rgba(10,10,22,0.97)',
                          }} />

                          {/* Icon + Title */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 10,
                              background: isLight
                                ? 'linear-gradient(135deg, rgba(var(--brand-1-rgb),0.12), rgba(var(--brand-2-rgb),0.1))'
                                : 'linear-gradient(135deg, rgba(var(--brand-1-rgb),0.3), rgba(var(--brand-2-rgb),0.25))',
                              border: isLight ? '1px solid rgba(var(--brand-1-rgb),0.25)' : '1px solid rgba(var(--brand-1-rgb),0.4)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <Globe size={17} color={isLight ? 'var(--brand-1)' : 'var(--brand-1-light)'} />
                            </div>
                            <div>
                              <div style={{ color: isLight ? '#111827' : '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>Page Blocked?</div>
                              <div style={{ color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>This URL isn't loading</div>
                            </div>
                          </div>

                          <div style={{ color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
                            The page may be blocked by your network or doesn't allow embedding.
                            Open it in a <strong style={{ color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)' }}>Virtual Browser</strong> to watch together.
                          </div>

                          <button
                            onClick={() => { setShowGlobePopup(false); handleOpenCloudBrowser(); }}
                            style={{
                              width: '100%', padding: '9px 14px',
                              background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                              border: 'none', borderRadius: 10,
                              color: '#fff', fontSize: 13, fontWeight: 700,
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', gap: 7,
                              boxShadow: '0 4px 18px rgba(var(--brand-1-rgb),0.45)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--brand-1-rgb),0.65)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(var(--brand-1-rgb),0.45)'; }}
                          >
                            <Globe size={14} />
                            Open in Virtual Browser
                          </button>

                          <button
                            onClick={() => setShowGlobePopup(false)}
                            style={{
                              width: '100%', marginTop: 7, padding: '7px 14px',
                              background: 'transparent',
                              border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 10,
                              color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.45)',
                              fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = isLight ? '#111' : '#fff'}
                            onMouseLeave={e => e.currentTarget.style.color = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.45)'}
                          >
                            Dismiss
                          </button>

                          <style>{`
                            @keyframes globePing {
                              0%   { box-shadow: 0 0 0 0 rgba(var(--brand-1-rgb),0.6); }
                              70%  { box-shadow: 0 0 0 10px rgba(var(--brand-1-rgb),0); }
                              100% { box-shadow: 0 0 0 0 rgba(var(--brand-1-rgb),0); }
                            }
                            @keyframes slideUpFade {
                              from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                            }
                            @keyframes pulse-red { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
                          `}</style>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CC Subtitles — shown for all media types */}
                  {(hasPlayerPrivileges || subtitlesUrl) && (
                    <div ref={subtitleMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button
                        ref={subtitleBtnRef}
                        className="player-ctrl-btn"
                        onClick={() => setShowSubtitleMenu(v => !v)}
                        title="Subtitles"
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          background: subtitlesUrl && subtitlesVisible ? 'rgba(var(--brand-2-rgb),0.3)' : 'rgba(var(--brand-1-rgb),0.15)',
                          border: subtitlesUrl && subtitlesVisible ? '1px solid rgba(var(--brand-2-rgb),0.55)' : '1px solid rgba(var(--brand-1-rgb),0.35)',
                          padding: '6px 13px',
                          borderRadius: 8,
                          color: subtitlesUrl && subtitlesVisible ? 'var(--brand-2-light)' : 'var(--brand-1-light)',
                          transition: 'all 0.2s',
                          letterSpacing: '0.5px',
                        }}
                      >
                        CC
                      </button>
                      {showSubtitleMenu && !isTouchPlayer && (
                        <div className="player-subtitle-menu" style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 10px)',
                          right: 0,
                          background: 'rgba(12,12,22,0.97)',
                          border: '1px solid rgba(255,255,255,0.11)',
                          borderRadius: 12,
                          padding: '5px',
                          minWidth: 200,
                          zIndex: 9999,
                          boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
                          backdropFilter: 'blur(16px)',
                        }}>
                          {/* Web iframe (regular webpage) note */}
                          {isWebIframe(mediaUrl) && (
                            <div className="subtitle-menu-info" style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(var(--brand-1-rgb),0.12)', margin: '4px 2px', border: '1px solid rgba(var(--brand-1-rgb),0.2)' }}>
                              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Subtitles not available</div>
                              <div style={{ fontSize: 11, lineHeight: 1.5 }}>This page is loaded as a browser view. Subtitles work for uploaded video files and direct video links.</div>
                            </div>
                          )}
                          {/* YouTube / embed platform note */}
                          {isEmbedPlatform(mediaUrl) && (
                            <div className="subtitle-menu-info" style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(var(--brand-1-rgb),0.12)', margin: '4px 2px', border: '1px solid rgba(var(--brand-1-rgb),0.2)' }}>
                              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Custom subtitles unavailable</div>
                              <div style={{ fontSize: 11, lineHeight: 1.5 }}>Use the CC / subtitles button built into the {mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be') ? 'YouTube' : mediaUrl.includes('twitch') ? 'Twitch' : mediaUrl.includes('vimeo') ? 'Vimeo' : 'platform'} player instead.</div>
                            </div>
                          )}
                          {/* Direct video URL or local stream: full subtitle controls */}
                          {!isEmbedPlatform(mediaUrl) && (
                            <>
                              {subtitlesUrl && (
                                <button
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', padding: '9px 12px',
                                    background: 'none', border: 'none',
                                    color: subtitlesVisible ? 'var(--brand-2-light)' : '#9ca3af',
                                    fontSize: 13, cursor: 'pointer', borderRadius: 8,
                                    textAlign: 'left', fontFamily: 'inherit',
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  onClick={() => { setSubtitlesVisible(v => !v); setShowSubtitleMenu(false); }}
                                >
                                  <div style={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: subtitlesVisible ? 'var(--brand-2-light)' : 'transparent',
                                    border: subtitlesVisible ? 'none' : '1.5px solid #6b7280',
                                  }} />
                                  {subtitlesVisible ? 'Hide Subtitles' : 'Show Subtitles'}
                                </button>
                              )}
                              {hasPlayerPrivileges && (
                                <button
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', padding: '9px 12px',
                                    background: 'none', border: 'none',
                                    color: '#d1d5db', fontSize: 13, cursor: 'pointer',
                                    borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  onClick={() => { subtitleInputRef.current?.click(); setShowSubtitleMenu(false); }}
                                >
                                  <Upload size={14} style={{ flexShrink: 0 }} />
                                  {subtitlesUrl ? 'Change Subtitles' : 'Upload Subtitles'}
                                </button>
                              )}
                              <div style={{ height: 1, background: document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />
                              <button
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  width: '100%', padding: '9px 12px',
                                  background: 'none', border: 'none',
                                  color: '#d1d5db', fontSize: 13, cursor: 'pointer',
                                  borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                onClick={() => { setShowSubtitleSettingsModal(true); setShowSubtitleMenu(false); }}
                              >
                                <Settings size={14} style={{ flexShrink: 0 }} />
                                Subtitle Settings
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {/* Mobile dropdown — portaled to document.body for the same reason as the
                          quality dropdown: the mobile-fullscreen rotate-trick container's
                          overflow:hidden was clipping this anchored-absolute menu, which made
                          "Upload Subtitles" effectively unreachable in landscape fullscreen. While
                          the rotate trick is active it's additionally nested in the same rotated
                          wrapper as the quality dropdown, for the same reason (see comment there). */}
                      {showSubtitleMenu && isTouchPlayer && subtitleDropdownPos && (() => {
                        const content = (
                          <>
                            {isWebIframe(mediaUrl) && (
                              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(var(--brand-1-rgb),0.12)', margin: '4px 2px', border: '1px solid rgba(var(--brand-1-rgb),0.2)', color: isLight ? '#374151' : '#d1d5db' }}>
                                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Subtitles not available</div>
                                <div style={{ fontSize: 11, lineHeight: 1.5 }}>This page is loaded as a browser view. Subtitles work for uploaded video files and direct video links.</div>
                              </div>
                            )}
                            {isEmbedPlatform(mediaUrl) && (
                              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(var(--brand-1-rgb),0.12)', margin: '4px 2px', border: '1px solid rgba(var(--brand-1-rgb),0.2)', color: isLight ? '#374151' : '#d1d5db' }}>
                                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Custom subtitles unavailable</div>
                                <div style={{ fontSize: 11, lineHeight: 1.5 }}>Use the CC / subtitles button built into the {mediaUrl.includes('youtube') || mediaUrl.includes('youtu.be') ? 'YouTube' : mediaUrl.includes('twitch') ? 'Twitch' : mediaUrl.includes('vimeo') ? 'Vimeo' : 'platform'} player instead.</div>
                              </div>
                            )}
                            {!isEmbedPlatform(mediaUrl) && (
                              <>
                                {subtitlesUrl && (
                                  <button
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      width: '100%', padding: '9px 12px',
                                      background: 'none', border: 'none',
                                      color: subtitlesVisible ? 'var(--brand-2-light)' : (isLight ? '#374151' : '#9ca3af'),
                                      fontSize: 13, cursor: 'pointer', borderRadius: 8,
                                      textAlign: 'left', fontFamily: 'inherit',
                                    }}
                                    onClick={() => { setSubtitlesVisible(v => !v); setShowSubtitleMenu(false); }}
                                  >
                                    <div style={{
                                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                      background: subtitlesVisible ? 'var(--brand-2-light)' : 'transparent',
                                      border: subtitlesVisible ? 'none' : '1.5px solid #6b7280',
                                    }} />
                                    {subtitlesVisible ? 'Hide Subtitles' : 'Show Subtitles'}
                                  </button>
                                )}
                                {hasPlayerPrivileges && (
                                  <button
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      width: '100%', padding: '9px 12px',
                                      background: 'none', border: 'none',
                                      color: isLight ? '#374151' : '#d1d5db', fontSize: 13, cursor: 'pointer',
                                      borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
                                    }}
                                    onClick={() => { subtitleInputRef.current?.click(); setShowSubtitleMenu(false); }}
                                  >
                                    <Upload size={14} style={{ flexShrink: 0 }} />
                                    {subtitlesUrl ? 'Change Subtitles' : 'Upload Subtitles'}
                                  </button>
                                )}
                                <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />
                                <button
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', padding: '9px 12px',
                                    background: 'none', border: 'none',
                                    color: isLight ? '#374151' : '#d1d5db', fontSize: 13, cursor: 'pointer',
                                    borderRadius: 8, textAlign: 'left', fontFamily: 'inherit',
                                  }}
                                  onClick={() => { setShowSubtitleSettingsModal(true); setShowSubtitleMenu(false); }}
                                >
                                  <Settings size={14} style={{ flexShrink: 0 }} />
                                  Subtitle Settings
                                </button>
                              </>
                            )}
                          </>
                        );
                        const boxBase = {
                          width: 220, maxHeight: subtitleDropdownPos.maxHeight, overflowY: 'auto',
                          background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(12,12,22,0.97)',
                          border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.11)',
                          borderRadius: 12, padding: 5,
                          boxShadow: isLight ? '0 8px 28px rgba(0,0,0,0.18)' : '0 8px 32px rgba(0,0,0,0.55)',
                          backdropFilter: 'blur(16px)',
                        };
                        return createPortal(
                          isRotatedFs ? (
                            <div className="sp-mobfs-overlay-wrap" style={{ zIndex: 1000000 }}>
                              <div
                                ref={subtitleDropdownPortalRef}
                                className="sp-hidden-scroll"
                                style={{ position: 'absolute', left: subtitleDropdownPos.left, bottom: subtitleDropdownPos.bottom, ...boxBase }}
                              >
                                {content}
                              </div>
                            </div>
                          ) : (
                            <div
                              ref={subtitleDropdownPortalRef}
                              className="sp-hidden-scroll"
                              style={{ position: 'fixed', left: subtitleDropdownPos.left, bottom: subtitleDropdownPos.bottom, zIndex: 1000000, ...boxBase }}
                            >
                              {content}
                            </div>
                          ),
                          document.body
                        );
                      })()}
                    </div>
                  )}

                  {/* Quality Selector */}
                  <div ref={qualityMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button
                      ref={qualityBtnRef}
                      className="player-ctrl-btn"
                      onClick={() => setShowQualityMenu(v => !v)}
                      title="Visual quality"
                      style={isTouchPlayer ? {
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: showQualityMenu ? 'rgba(var(--brand-1-rgb),0.25)' : 'rgba(var(--brand-1-rgb),0.15)',
                        border: showQualityMenu ? '1px solid rgba(var(--brand-1-rgb),0.55)' : '1px solid rgba(var(--brand-1-rgb),0.35)',
                        padding: 7, borderRadius: 8, color: 'var(--brand-1-light)', transition: 'all 0.2s',
                      } : {
                        fontSize: '11px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: showQualityMenu ? 'rgba(var(--brand-1-rgb),0.25)' : 'rgba(var(--brand-1-rgb),0.15)',
                        border: showQualityMenu ? '1px solid rgba(var(--brand-1-rgb),0.55)' : '1px solid rgba(var(--brand-1-rgb),0.35)',
                        padding: '6px 10px', borderRadius: 8,
                        color: 'var(--brand-1-light)', transition: 'all 0.2s',
                        letterSpacing: '0.3px', minWidth: 42, justifyContent: 'center',
                      }}
                    >
                      {isTouchPlayer ? <Sparkles size={16} /> : (QUALITY_PRESETS[videoQuality]?.label || videoQuality)}
                    </button>
                    {/* Desktop/tablet dropdown — unchanged, anchored to the button itself */}
                    {showQualityMenu && !isTouchPlayer && (
                      <div style={{
                        position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
                        background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(12,12,22,0.97)',
                        border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.11)',
                        borderRadius: 12, padding: '5px', minWidth: 185, zIndex: 9999,
                        boxShadow: isLight ? '0 -8px 28px rgba(0,0,0,0.18)' : '0 -8px 32px rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(16px)',
                      }}>
                        <div style={{
                          padding: '8px 12px 6px', color: '#64748b',
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)', marginBottom: 3,
                        }}>
                          Visual quality enhancement
                        </div>
                        {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => { setVideoQuality(key); localStorage.setItem('preferred_quality', key); setShowQualityMenu(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              width: '100%', padding: '9px 12px',
                              background: videoQuality === key ? 'rgba(var(--brand-1-rgb),0.18)' : 'none',
                              border: 'none',
                              color: videoQuality === key ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : (isLight ? '#374151' : '#d1d5db'),
                              fontSize: 13, cursor: 'pointer', borderRadius: 8,
                              textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (videoQuality !== key) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'; }}
                            onMouseLeave={e => { if (videoQuality !== key) e.currentTarget.style.background = 'none'; }}
                          >
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              background: videoQuality === key ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : 'transparent',
                              border: videoQuality === key ? 'none' : (isLight ? '1.5px solid #9ca3af' : '1.5px solid #6b7280'),
                            }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: videoQuality === key ? 700 : 500 }}>{preset.label}</div>
                              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{preset.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mobile dropdown — portaled to document.body, positioned from the trigger
                      button's real on-screen rect and clamped to the player's bounds. Needed
                      because the mobile-fullscreen "rotate trick" container clips/overflow:hidden's
                      anything popped up from an anchored-absolute position. While the rotate trick
                      is active (isRotatedFs), it's additionally nested in a wrapper that replicates
                      the same rotation so the menu turns WITH the video instead of staying upright
                      in the real (portrait) screen frame — which looked sideways/horizontal to a
                      user who'd physically turned their phone to match the (now-rotated) video.
                      Themed for light/dark since it's portaled outside the always-dark player
                      chrome, and rendered as a single-column list rather than a boxy grid. */}
                  {showQualityMenu && isTouchPlayer && qualityDropdownPos && createPortal(
                    isRotatedFs ? (
                      <div className="sp-mobfs-overlay-wrap" style={{ zIndex: 1000000 }}>
                        <div
                          ref={qualityDropdownPortalRef}
                          className="sp-hidden-scroll"
                          style={{
                            position: 'absolute', left: qualityDropdownPos.left, bottom: qualityDropdownPos.bottom,
                            width: 132, maxHeight: qualityDropdownPos.maxHeight, overflowY: 'auto',
                            background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(12,12,22,0.97)',
                            border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.11)',
                            borderRadius: 12, padding: 6,
                            boxShadow: isLight ? '0 8px 28px rgba(0,0,0,0.18)' : '0 8px 32px rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(16px)',
                          }}
                        >
                          {Object.entries(QUALITY_PRESETS).map(([key]) => (
                            <button
                              key={key}
                              onClick={() => { setVideoQuality(key); localStorage.setItem('preferred_quality', key); setShowQualityMenu(false); }}
                              style={{
                                display: 'block', width: '100%', padding: '9px 10px',
                                borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: videoQuality === key ? 'rgba(var(--brand-1-rgb),0.18)' : 'transparent',
                                color: videoQuality === key ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : (isLight ? '#374151' : '#d1d5db'),
                                fontSize: 13, fontWeight: videoQuality === key ? 700 : 500, fontFamily: 'inherit',
                              }}
                            >
                              {key.replace(/p$/, '')}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                    <div
                      ref={qualityDropdownPortalRef}
                      className="sp-hidden-scroll"
                      style={{
                        position: 'fixed', left: qualityDropdownPos.left, bottom: qualityDropdownPos.bottom,
                        width: 132, maxHeight: qualityDropdownPos.maxHeight, overflowY: 'auto',
                        background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(12,12,22,0.97)',
                        border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.11)',
                        borderRadius: 12, padding: 6, zIndex: 1000000,
                        boxShadow: isLight ? '0 8px 28px rgba(0,0,0,0.18)' : '0 8px 32px rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(16px)',
                      }}
                    >
                      {Object.entries(QUALITY_PRESETS).map(([key]) => (
                        <button
                          key={key}
                          onClick={() => { setVideoQuality(key); localStorage.setItem('preferred_quality', key); setShowQualityMenu(false); }}
                          style={{
                            display: 'block', width: '100%', padding: '9px 10px',
                            borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                            background: videoQuality === key ? 'rgba(var(--brand-1-rgb),0.18)' : 'transparent',
                            color: videoQuality === key ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : (isLight ? '#374151' : '#d1d5db'),
                            fontSize: 13, fontWeight: videoQuality === key ? 700 : 500, fontFamily: 'inherit',
                          }}
                        >
                          {key.replace(/p$/, '')}
                        </button>
                      ))}
                    </div>
                    ),
                    document.body
                  )}

                  {/* Fullscreen */}
                  <button className="player-ctrl-btn" onClick={handleFullscreen} title={isMobileFsMode ? 'Exit Fullscreen' : 'Fullscreen'}>
                    {isTouchPlayer && isMobileFsMode ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>

                </div>
              </div>
            )
          )}

            {/* Floating Restore Controls Button — shown at top center for as long as
                custom controls are hidden (native player controls are active). Must stay
                visible the whole time, not just briefly: once native mode is on, the
                overlay that would normally re-arm a timer is gone (clicks need to reach
                the iframe directly), so there'd otherwise be no way back to our own UI. */}
            {!isTvMode && (hasMounted && mediaUrl) && !(isScreensharing || isViewer) && !isGameOrActivity(mediaUrl) && !((isTwitch && useCustomTwitchControls) || (isVimeo && useCustomVimeoControls)) && hideCustomControls && (
              <button
                onClick={() => setHideCustomControls(false)}
                style={isTouchPlayer ? {
                  position: 'absolute',
                  top: '14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 35,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(var(--brand-1-rgb), 0.9), rgba(var(--brand-2-rgb), 0.9))',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  pointerEvents: 'auto'
                } : {
                  position: 'absolute',
                  top: '16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 35,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, rgba(var(--brand-1-rgb), 0.9), rgba(var(--brand-2-rgb), 0.9))',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '24px',
                  padding: '10px 20px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  pointerEvents: 'auto'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateX(-50%) scale(1.05) translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateX(-50%) scale(1) translateY(0)';
                }}
                title="Restore SahaPlay Controls"
              >
                <ChevronUp size={16} color="#fff" />
                {!isTouchPlayer && <span className="stay-white">Show SahaPlay Controls</span>}
              </button>
            )}
            
            {/* Camera Streams Overlay (only inside player-wrap when in fullscreen, floating mode only) */}
            {isFullscreen && !shouldUseManagedCameraLayout && !areCamerasHidden && (
              <div style={{
                position: 'absolute', inset: 0, 
                zIndex: (isDraggingCam || isResizingCam) ? 99999 : 1, 
                pointerEvents: 'none',
                transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s'
              }}>
                {renderCameras(true)}
              </div>
            )}

            {/* Drag-to-Remove Zone (only when in fullscreen — normal view zone is in root overlay) */}
            {isDraggingCam && isFullscreen && (
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

            {!isTvMode && (
              <GlobalChatWidget
                ref={chatWidgetRef}
                isOpen={showRecentChats}
                onClose={() => setShowRecentChats(false)}
                unreadCounts={unreadCounts}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onNewMessage={handleNewMessage}
                activeRoomTab={(isMobile || rightPanelTab === 'chat') ? chatTab : null}
                activeRoomPartner={(isMobile || rightPanelTab === 'chat') ? (chatTab === 'dm' ? dmTarget : roomId) : null}
                transparentMode={isFullscreen}
                roomPermissions={room?.permissions}
                isRoomHost={isEffectiveHost}
              />
            )}

          </div>
          
        </div>
        
        {/* — Right Column — was fully hidden for TV, stripping chat/camera tiles/game
            state from the TV's screen entirely; now shown there too so the TV reflects
            what's actually happening in the room, not just the raw video. */}
        {(
        <div ref={rightColumnRef} className="room-right-column" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }}>
          {/* Mobile: Browse Media button pinned above chat when no media playing.
              Visibility is enforced purely by the .mobile-browse-media-btn CSS media
              query (same max-width: 639px breakpoint that hides .room-quick-controls),
              not by the isMobile JS flag — isMobile also factors in window height
              (detectIsMobile), so a short-but-wide desktop browser window could flip
              it true while the Quick Controls/Cast-to-TV box (width-gated only) stayed
              visible too, showing both stacked/overlapping at once. */}
          {!mediaUrl && !isScreensharing && !isViewer && !isTvMode && (
            <button className="mobile-browse-media-btn" onClick={() => setShowMediaSelector(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>
              <LayoutGrid size={18} color="#fff" />
              <span className="forced-white">{t('browseMediaAndApps', 'Browse Media & Apps')}</span>
            </button>
          )}

          {/* — Controls Box — unchanged in both modes */}
          {!isFullscreen && !isTvMode && (
            <div className="room-quick-controls" style={{
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
                  onClick={handleCast}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 16,
                    background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 16px rgba(var(--brand-1-rgb),0.3)',
                    fontWeight: 800, fontSize: 14
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(var(--brand-1-rgb),0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--brand-1-rgb),0.3)'; }}
                >
                  <Cast size={20} className="stay-white" />
                  <span className="stay-white">{t('castToTv', 'Cast to TV')}</span>
                </button>

                {/* --- Secondary Actions: Cam & Mic Side-by-Side --- */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {(() => {
                    const camPerm = room?.permissions?.cam || 'all';
                    const canUseCam = camPerm === 'all' || (camPerm === 'host' && isEffectiveHost);
                    const camReason = camPerm === 'none' ? 'Webcam is disabled' : (camPerm === 'host' && !isEffectiveHost ? 'Only the host or admins can use webcam' : '');

                    return (
                      <button
                        onClick={canUseCam ? toggleCamera : () => toast.error(camReason)}
                        title={canUseCam ? (isCamOn ? 'Turn off camera' : 'Turn on camera') : camReason}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 12,
                          border: `1px solid ${canUseCam ? (isCamOn ? 'var(--brand-1)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)')) : 'rgba(239,68,68,0.2)'}`,
                          background: canUseCam ? (isCamOn ? 'rgba(var(--brand-1-rgb),0.08)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)')) : 'rgba(239,68,68,0.05)',
                          color: canUseCam ? (isCamOn ? 'var(--brand-1)' : (isLight ? '#475569' : '#888')) : '#ef4444',
                          cursor: canUseCam ? 'pointer' : 'not-allowed',
                          fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { if(canUseCam) { e.currentTarget.style.background = isCamOn ? 'rgba(var(--brand-1-rgb),0.12)' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.06)'); } }}
                        onMouseLeave={e => { if(canUseCam) { e.currentTarget.style.background = isCamOn ? 'rgba(var(--brand-1-rgb),0.08)' : (isLight ? '#fff' : 'rgba(255,255,255,0.03)'); } }}
                      >
                        {isCamOn ? <Video size={18} /> : <VideoOff size={18} />}
                        <span>{t('cameraControl', 'Camera')}</span>
                      </button>
                    );
                  })()}

                  {(() => {
                    const micPerm = room?.permissions?.mic || 'all';
                    const canUseMic = micPerm === 'all' || (micPerm === 'host' && isEffectiveHost);
                    const micReason = micPerm === 'none' ? 'Microphone is disabled' : (micPerm === 'host' && !isEffectiveHost ? 'Only the host or admins can use microphone' : '');

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

          {/* ── Focus Video Popout — rendered here (direct child of room-right-column)
              so it escapes all inner overflow:hidden containers and floats freely
              left into the player area using position:absolute on the right column.
          ─────────────────────────────────────────────────────────────────────── */}
          {focusVideoEnabled && focusedCameraUserId && rightPanelTab === 'cameras' && shouldUseManagedCameraLayout && (() => {
            const allCams = [];
            const seen = new Set();
            if (isCamOn && localCamRef.current) { allCams.push({ id: 'local', isLocal: true, stream: localCamRef.current, username, isMuted: !isMicOnCam }); seen.add(username); }
            Object.entries(remoteStreams).forEach(([sid, { stream, username: uname }]) => {
              if (!uname || uname === username || seen.has(uname)) return;
              const uObj = userList.find(u => u.username?.toLowerCase() === uname?.toLowerCase());
              allCams.push({ id: sid, isLocal: false, stream, username: uname, isMuted: uObj?.isMuted });
              seen.add(uname);
            });
            const focusedCam = allCams.find(c => c.id === focusedCameraUserId);
            if (!focusedCam) return null;
            const vTracks = focusedCam.stream ? focusedCam.stream.getVideoTracks() : [];
            // readyState === 'live' is trusted as an alternative to !muted — muted can
            // stay stale (see videoTrackTick above) even once a track is genuinely
            // producing frames, whereas readyState reliably reflects whether the
            // track itself is still active.
            const hasVideo = vTracks.length > 0 && vTracks[0].enabled && (vTracks[0].readyState === 'live' || !vTracks[0].muted);

            // Shared card content used by both mobile overlay and desktop float
            const cardInner = (
              <div style={{
                width: isMobile ? 'min(calc(100vw - 32px), 440px)' : 340,
                borderRadius: 16,
                background: isLight ? '#ffffff' : '#0d0d14',
                border: isLight ? '1px solid rgba(var(--brand-1-rgb),0.25)' : '1px solid rgba(129,140,248,0.4)',
                boxShadow: isLight
                  ? '0 16px 48px rgba(0,0,0,0.22), 0 0 0 1px rgba(var(--brand-1-rgb),0.12)'
                  : '0 24px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(129,140,248,0.2)',
                overflow: 'hidden',
                animation: 'fadeInScale 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 14px',
                  borderBottom: isLight ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(255,255,255,0.08)',
                  background: isLight ? 'rgba(var(--brand-1-rgb),0.06)' : 'rgba(var(--brand-1-rgb),0.12)',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: isLight ? '#111827' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {focusedCam.username}{focusedCam.isLocal ? ' (You)' : ''}
                  </span>
                  {focusedCam.isMuted && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MicOff size={11} color="#fff" />
                    </div>
                  )}
                  <span className="stay-white" style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(var(--brand-1-rgb),0.85)', borderRadius: 5, padding: '2px 8px', flexShrink: 0 }}>FOCUSED</span>
                  <button
                    onClick={() => setFocusedCameraUserId(null)}
                    title="Close"
                    style={{ width: 28, height: 28, borderRadius: 8, background: isLight ? 'transparent' : 'rgba(255,255,255,0.08)', border: isLight ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(255,255,255,0.12)', color: isLight ? '#374151' : '#bbb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = isLight ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = isLight ? '#dc2626' : '#fca5a5'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isLight ? 'transparent' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = isLight ? '#374151' : '#bbb'; }}
                  >
                    <X size={14} />
                  </button>
                </div>
                {/* 16:9 video — always dark */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
                  {hasVideo ? (
                    <VideoTile stream={focusedCam.stream} isMuted={focusedCam.isMuted || focusedCam.isLocal}
                      isLocal={focusedCam.isLocal} debugLabel="focusedCamView"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #312e81, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                      <div className="stay-white" style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 24 }}>
                        {focusedCam.username?.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="stay-white" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Camera off</span>
                    </div>
                  )}
                </div>
                {/* Footer */}
                <div style={{ padding: '9px 14px', fontSize: 11, textAlign: 'center', color: isLight ? '#374151' : 'rgba(255,255,255,0.4)', borderTop: isLight ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.05)' }}>
                  {isMobile ? 'Tap outside or × to close' : 'Click tile again or × to close'}
                </div>
              </div>
            );

            // Mobile: centered full-screen overlay with backdrop
            if (isMobile) {
              return (
                <div
                  onClick={() => setFocusedCameraUserId(null)}
                  style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                >
                  <div onClick={e => e.stopPropagation()}>{cardInner}</div>
                </div>
              );
            }

            // Desktop/tablet: floating card anchored left of right panel
            const rcRect = rightColumnRef.current?.getBoundingClientRect();
            const popoutWidth = 340;
            const popoutLeft = rcRect ? Math.max(8, rcRect.left - popoutWidth - 14) : 8;
            const popoutTop  = rcRect ? Math.min(rcRect.top + 60, window.innerHeight - 280) : 120;
            return (
              <div style={{ position: 'fixed', left: popoutLeft, top: popoutTop, zIndex: 9999 }}>{cardInner}</div>
            );
          })()}

          {/* ── MANAGED LAYOUT: Tabbed Chat / Cameras panel ──────────────────────
              Shown on ALL screen sizes (including mobile) when cameras > threshold.
              Previously excluded !isMobile — now works on phone/tablet/desktop.
          ─────────────────────────────────────────────────────────────────────── */}
          {!isTvMode && shouldUseManagedCameraLayout ? (
            <div style={{
              display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
              background: isLight ? '#fff' : 'var(--room-sidebar-bg)',
              borderRadius: 16, border: '1px solid var(--room-border)',
              boxShadow: isLight ? '0 8px 30px rgba(0,0,0,0.05)' : 'none',
              marginTop: isFullscreen ? 0 : 0,
            }}>
              {/* Tab bar */}
              <div style={{
                display: 'flex', flexShrink: 0,
                borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.07)'}`,
                padding: '0 4px',
              }}>
                {[
                  { id: 'chat', label: 'Chat', icon: <MessageCircle size={14} /> },
                  {
                    id: 'cameras',
                    label: `Cameras${activeCameraUsers.length > 0 ? ` (${activeCameraUsers.length})` : ''}`,
                    icon: <Video size={14} />
                  }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanelTab(tab.id)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px 8px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      color: rightPanelTab === tab.id
                        ? (isLight ? 'var(--brand-1)' : 'var(--brand-1-light)')
                        : (isLight ? '#94a3b8' : '#555'),
                      borderBottom: rightPanelTab === tab.id
                        ? `2px solid ${isLight ? 'var(--brand-1)' : 'var(--brand-1-light)'}`
                        : '2px solid transparent',
                      transition: 'all 0.2s',
                      marginBottom: -1,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Chat tab — RoomChatPanel rendered but hidden when not active (preserves scroll/state) */}
                <div style={{ flex: 1, display: rightPanelTab === 'chat' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
                  <RoomChatPanel p={{
                    chatTab, setChatTab, chatTabRef,
                    groupMessages, groupUnread, setGroupUnread,
                    room, isAdmin,
                    dmThreads, dmClearedTsRef, dmTarget, setDmTarget, dmTargetRef, dmUnread, setDmUnread,
                    dmDecryptedMediaUrls, dmMediaUrlVersion,
                    groupDecryptedMediaUrls, groupMediaUrlVersion,
                    typingStatuses, typingUsers, messagesEndRef,
                    groupChatInput, setGroupChatInput, groupInputRef,
                    dmChatInput, setDmChatInput, dmInputRef,
                    groupReplyTo, setGroupReplyTo,
                    dmReplyTo, setDmReplyTo,
                    groupEditingMessage, setGroupEditingMessage,
                    dmEditingMessage, setDmEditingMessage,
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
                    forwardMessages,
                    handleChatInputChange,
                    openDM, reportMsg,
                    setRenameInput, setRenameModalOpen,
                    setClearChatTarget, setClearChatModalOpen, setClearForBoth,
                    SOCKET_SERVER_URL, roomId,
                    onMarkRead: handleMarkRead,
                    onMarkAllRead: handleMarkAllRead,
                    clearRoomChat: handleClearRoomChat,
                    setDmThreads,
                    socket,
                    reactionPreviews, setReactionPreviews,
                    groupHistoryLoading, dmHistoryLoading,
                    groupHistoryReady, dmHistoryReady,
                    hasMoreGroupHistory, hasMoreDmHistory,
                    loadMoreGroupHistory, loadMoreDmHistory
                  }} />
                </div>

                {/* Cameras tab */}
                {rightPanelTab === 'cameras' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

                    {/* ── LIVE CAMERAS header row ── */}
                    <div style={{
                      padding: '10px 12px 6px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      flexShrink: 0,
                    }}>
                      {/* Label */}
                      <span style={{
                        fontSize: 11, fontWeight: 900, letterSpacing: '1.2px',
                        textTransform: 'uppercase', flex: 1,
                        color: isLight ? '#64748b' : '#666'
                      }}>
                        Live Cameras
                      </span>
                      {/* Active count pill */}
                      <span style={{
                        background: 'rgba(16,185,129,0.15)', color: '#10b981',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: 20, padding: '2px 9px',
                        fontSize: 11, fontWeight: 800, flexShrink: 0
                      }}>
                        {activeCameraUsers.length} active
                      </span>

                      {/* ⋮ Three-dot menu button */}
                      <div ref={cameraMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          onClick={() => setShowCameraMenu(v => !v)}
                          title="Camera Options"
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: showCameraMenu
                              ? (isLight ? 'rgba(var(--brand-1-rgb),0.12)' : 'rgba(var(--brand-1-rgb),0.18)')
                              : 'transparent',
                            border: showCameraMenu
                              ? '1px solid rgba(var(--brand-1-rgb),0.35)'
                              : '1px solid transparent',
                            color: showCameraMenu ? 'var(--brand-1-light)' : (isLight ? '#94a3b8' : '#555'),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { if (!showCameraMenu) { e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = isLight ? '#475569' : '#aaa'; } }}
                          onMouseLeave={e => { if (!showCameraMenu) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isLight ? '#94a3b8' : '#555'; } }}
                        >
                          <MoreVertical size={15} />
                        </button>

                        {/* ── Dropdown menu ── */}
                        {showCameraMenu && (
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                            background: isLight ? '#fff' : '#1a1a24',
                            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 14,
                            boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.12)' : '0 8px 40px rgba(0,0,0,0.7)',
                            zIndex: 9000,
                            minWidth: 196,
                            padding: '6px 0',
                            overflow: 'hidden',
                          }}>
                            {/* ── Section: Camera Layout ── */}
                            <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 900, letterSpacing: '0.9px', textTransform: 'uppercase', color: isLight ? '#94a3b8' : '#444' }}>
                              Camera Layout
                            </div>
                            {[
                              { id: 'list', label: 'List View', icon: <LayoutGrid size={13} /> },
                              { id: 'grid', label: 'Grid View (2 col)', icon: <Monitor size={13} /> },
                            ].map(item => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setCameraLayoutMode(item.id);
                                  localStorage.setItem('sahaplay_camera_layout_mode', item.id);
                                  setShowCameraMenu(false);
                                }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '9px 14px', background: cameraLayoutMode === item.id
                                    ? (isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.12)')
                                    : 'transparent',
                                  border: 'none', cursor: 'pointer', textAlign: 'left',
                                  fontSize: 13, fontWeight: cameraLayoutMode === item.id ? 700 : 500,
                                  color: cameraLayoutMode === item.id
                                    ? (isLight ? 'var(--brand-1)' : 'var(--brand-1-light)')
                                    : (isLight ? '#334155' : '#ccc'),
                                  transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => { if (cameraLayoutMode !== item.id) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { if (cameraLayoutMode !== item.id) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <span style={{ color: cameraLayoutMode === item.id ? (isLight ? 'var(--brand-1)' : 'var(--brand-1-light)') : (isLight ? '#94a3b8' : '#555') }}>{item.icon}</span>
                                {item.label}
                                {cameraLayoutMode === item.id && <span style={{ marginLeft: 'auto', fontSize: 11, color: isLight ? 'var(--brand-1)' : 'var(--brand-1-light)' }}>✓</span>}
                              </button>
                            ))}

                            {/* Divider */}
                            <div style={{ height: 1, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', margin: '5px 0' }} />

                            {/* ── Section: Focus Video ── */}
                            <div style={{ padding: '4px 14px 4px', fontSize: 10, fontWeight: 900, letterSpacing: '0.9px', textTransform: 'uppercase', color: isLight ? '#94a3b8' : '#444' }}>
                              Focus Video
                            </div>
                            <button
                              onClick={() => {
                                const next = !focusVideoEnabled;
                                setFocusVideoEnabled(next);
                                if (!next) setFocusedCameraUserId(null);
                                setShowCameraMenu(false);
                              }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 14px', background: focusVideoEnabled
                                  ? (isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.12)')
                                  : 'transparent',
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                fontSize: 13, fontWeight: focusVideoEnabled ? 700 : 500,
                                color: focusVideoEnabled
                                  ? (isLight ? 'var(--brand-1)' : 'var(--brand-1-light)')
                                  : (isLight ? '#334155' : '#ccc'),
                                transition: 'background 0.12s',
                              }}
                              onMouseEnter={e => { if (!focusVideoEnabled) e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; }}
                              onMouseLeave={e => { if (!focusVideoEnabled) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Maximize size={13} style={{ color: focusVideoEnabled ? (isLight ? 'var(--brand-1)' : 'var(--brand-1-light)') : (isLight ? '#94a3b8' : '#555') }} />
                              {focusVideoEnabled ? 'Disable Focus Mode' : 'Enable Focus Mode'}
                              {focusVideoEnabled && <span style={{ marginLeft: 'auto', fontSize: 11, color: isLight ? 'var(--brand-1)' : 'var(--brand-1-light)' }}>ON</span>}
                            </button>

                            {/* Divider */}
                            <div style={{ height: 1, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', margin: '5px 0' }} />

                            {/* ── Section: Visibility ── */}
                            <div style={{ padding: '4px 14px 4px', fontSize: 10, fontWeight: 900, letterSpacing: '0.9px', textTransform: 'uppercase', color: isLight ? '#94a3b8' : '#444' }}>
                              Visibility
                            </div>
                            <button
                              onClick={() => {
                                const next = !areCamerasHidden;
                                setAreCamerasHidden(next);
                                localStorage.setItem('sahaplay_hide_camera_tiles', String(next));
                                setShowCameraMenu(false);
                              }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 14px', background: 'transparent',
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                fontSize: 13, fontWeight: 500,
                                color: isLight ? '#334155' : '#ccc',
                                transition: 'background 0.12s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {areCamerasHidden
                                ? <Eye size={13} style={{ color: '#10b981' }} />
                                : <EyeOff size={13} style={{ color: isLight ? '#94a3b8' : '#555' }} />}
                              {areCamerasHidden ? 'Show Cameras' : 'Hide All Cameras'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Focus hint bar ── */}
                    {focusVideoEnabled && !areCamerasHidden && (
                      <div style={{
                        margin: '0 10px 4px',
                        padding: '5px 12px',
                        background: isLight ? 'rgba(67,56,202,0.12)' : 'rgba(var(--brand-1-rgb),0.18)',
                        border: `1px solid ${isLight ? 'rgba(67,56,202,0.3)' : 'rgba(129,140,248,0.35)'}`,
                        borderRadius: 8, flexShrink: 0,
                        fontSize: 11,
                        color: isLight ? 'var(--brand-1-darker)' : '#c7d2fe',
                        fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        <Maximize size={12} />
                        Click a camera to focus · click again to close
                      </div>
                    )}


                    {/* ── Camera tile list / hidden state ── */}
                    {areCamerasHidden ? (
                      /* Always dark-themed — camera content is inherently dark */
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                        padding: 28, flex: 1, justifyContent: 'center',
                        background: 'rgba(0,0,0,0.22)', borderRadius: 10, margin: '6px 8px',
                      }}>
                        <EyeOff size={28} color="var(--brand-1-light)" />
                        <span className="stay-white" style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Cameras hidden</span>
                        <button
                          className="stay-white"
                          onClick={() => { setAreCamerasHidden(false); localStorage.setItem('sahaplay_hide_camera_tiles', 'false'); }}
                          style={{
                            padding: '7px 20px', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
                            border: 'none', borderRadius: 10, color: '#fff',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(var(--brand-1-rgb),0.35)'
                          }}
                        >
                          Show Cameras
                        </button>
                      </div>
                    ) : (
                      /* Scrollable camera tiles */
                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        {renderCamerasPanel()}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          ) : (
            /* FLOATING MODE (≤ threshold) — original RoomChatPanel, no camera management */
            (
              <RoomChatPanel p={{
                chatTab, setChatTab, chatTabRef,
                groupMessages, groupUnread, setGroupUnread,
                room, isAdmin,
                dmThreads, dmClearedTsRef, dmTarget, setDmTarget, dmTargetRef, dmUnread, setDmUnread,
                dmDecryptedMediaUrls, dmMediaUrlVersion,
                groupDecryptedMediaUrls, groupMediaUrlVersion,
                typingStatuses, typingUsers, messagesEndRef,
                groupChatInput, setGroupChatInput, groupInputRef,
                dmChatInput, setDmChatInput, dmInputRef,
                groupReplyTo, setGroupReplyTo,
                dmReplyTo, setDmReplyTo,
                groupEditingMessage, setGroupEditingMessage,
                dmEditingMessage, setDmEditingMessage,
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
                forwardMessages,
                handleChatInputChange,
                openDM, reportMsg,
                setRenameInput, setRenameModalOpen,
                setClearChatTarget, setClearChatModalOpen, setClearForBoth,
                SOCKET_SERVER_URL, roomId,
                onMarkRead: handleMarkRead,
                clearRoomChat: handleClearRoomChat,
                setDmThreads,
                socket,
                reactionPreviews, setReactionPreviews,
                groupHistoryLoading, dmHistoryLoading,
                groupHistoryReady, dmHistoryReady,
                hasMoreGroupHistory, hasMoreDmHistory,
                loadMoreGroupHistory, loadMoreDmHistory
              }} />
            )
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
        onClearDm={(target) => {
          const key = (target || '').toLowerCase();
          if (key) setDmThreads(prev => ({ ...prev, [key]: [] }));
        }}
        isLight={isLight}
        showCastDiscovery={showCastDiscovery}
        setShowCastDiscovery={setShowCastDiscovery}
        userList={userList}
        username={username}
        handleFullscreen={handleFullscreen}
        playerRef={playerRef}
        videoRef={videoRef}
        localVideoRef={localVideoRef}
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

      {/* Part 2 — Mobile ⋮ bottom sheet */}
      {isMobile && showMobileMenu && (
        <>
          <div className="mob-sheet-backdrop" onClick={() => setShowMobileMenu(false)} />
          <div className="mob-bottom-sheet">
            <div className="mob-sheet-handle" />
            <button className="mob-sheet-item" onClick={() => { setShowMobileMenu(false); handleCast(); }}>
              <Cast size={20} /> <span>{t('castScreen', 'Cast Screen')}</span>
            </button>
            {(hasStartedCamOnce || Object.keys(remoteStreams).length > 0) && (
              <button
                className="mob-sheet-item"
                onClick={() => {
                  const next = !areCamerasHidden;
                  setAreCamerasHidden(next);
                  localStorage.setItem('sahaplay_hide_camera_tiles', String(next));
                  if (!next && shouldUseManagedCameraLayout) setRightPanelTab('cameras');
                  setShowMobileMenu(false);
                }}
              >
                {areCamerasHidden ? <Eye size={20} /> : <EyeOff size={20} />}
                <span>{areCamerasHidden ? t('showCameras', 'Show Cameras') : t('hideCameras', 'Hide Cameras')}</span>
              </button>
            )}
            {hiddenCams.size > 0 && (
              <button
                className="mob-sheet-item"
                onClick={() => {
                  setHiddenCams(new Set());
                  toast.success('All videos restored', { icon: '👁️' });
                  setShowMobileMenu(false);
                }}
              >
                <Video size={20} />
                <span>{t('unhideVideosOption', 'Unhide Videos')} ({hiddenCams.size})</span>
              </button>
            )}
            <button className="mob-sheet-item" onClick={() => { setShowMobileMenu(false); setShowShareModal(true); }}>
              <Share2 size={20} /> <span>{t('invite', 'Invite')}</span>
            </button>
            <button className="mob-sheet-item" onClick={async () => { await togglePinRoom(); setShowMobileMenu(false); }}>
              <Pin size={20} /> <span>{pinnedRooms.includes(roomId) ? t('unpinRoom', 'Unpin Room') : t('pinRoom', 'Pin Room')}</span>
            </button>
            {isEffectiveHost && (
              <button className="mob-sheet-item" onClick={() => { socket.emit('toggle_public', { isPublic: !isPublic }); setShowMobileMenu(false); }}>
                {isPublic ? <Lock size={20} color="#f59e0b" /> : <Globe size={20} color="#10b981" />}
                <span>{isPublic ? t('makePrivate', 'Make this private') : t('makePublic', 'Make this public')}</span>
              </button>
            )}
            {isEffectiveHost && (
              <button className="mob-sheet-item" onClick={() => { setShowMobileMenu(false); setRoomSettingsModalOpen(true); }}>
                <Settings2 size={20} /> <span>{t('roomSettings', 'Room Settings')}</span>
              </button>
            )}
            {isEffectiveHost && !isGameOrActivity(mediaUrl) && (
              <button className="mob-sheet-item" onClick={() => { setShowMobileMenu(false); setShowCustomizeModal(true); }}>
                <Paintbrush size={20} /> <span>{t('themes', 'Themes')}</span>
              </button>
            )}
            {!isEffectiveHost && (
              <button className="mob-sheet-item mob-sheet-item-danger" onClick={() => { setShowMobileMenu(false); setShowPersonalDeleteConfirm(true); }}>
                <Trash2 size={20} /> <span>{t('deleteRoom', 'Delete Room')}</span>
              </button>
            )}
            <button className="mob-sheet-item" onClick={() => { setShowMobileMenu(false); handleFullscreen(); }}>
              <Maximize size={20} /> <span>{t('fullscreen', 'Fullscreen')}</span>
            </button>
            <button className="mob-sheet-item" onClick={() => { setShowMobileMenu(false); setShowNotificationSettings(true); }}>
              <Bell size={20} /> <span>{t('notifications', 'Notifications')}</span>
            </button>
            <div className="mob-sheet-divider" />
            <button className="mob-sheet-item mob-sheet-item-danger" onClick={() => { roomModalsBack.skipNextClose(); socket?.emit('leave_room', { roomId }); setShowMobileMenu(false); navigate('/'); }}>
              <LogOut size={20} /> <span>{t('leaveRoom', 'Leave Room')}</span>
            </button>
          </div>
        </>
      )}

      {/* Report Message Modal */}
      {reportMsgTarget && (
        <ReportMessageModal
          msg={reportMsgTarget}
          roomId={roomId}
          reporterUsername={username}
          apiBase={SOCKET_SERVER_URL}
          isDark={!isLight}
          onClose={() => setReportMsgTarget(null)}
        />
      )}

      {/* Personal Delete Room Confirmation */}
      {showPersonalDeleteConfirm && (
        <div className="room-modals-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: isLight ? 'rgba(30,30,50,0.35)' : 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="admin-modal-card" style={{ position: 'relative', background: isLight ? '#ffffff' : '#1a1025', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(239,68,68,0.25)', borderRadius: 24, width: '100%', maxWidth: 400, padding: 32, boxShadow: isLight ? '0 20px 60px rgba(0,0,0,0.12)' : '0 25px 50px rgba(0,0,0,0.6)' }}>
            <button
              onClick={() => setShowPersonalDeleteConfirm(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: isLight ? '#6b7280' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = isLight ? '#374151' : '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = isLight ? '#6b7280' : '#888'; }}
            >
              <X size={15} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', transform: 'rotate(-5deg)' }}>
                <Trash2 size={30} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: isLight ? '#111' : '#fff', margin: 0 }}>
                {t('deleteRoomForMe', 'Delete this room?')}
              </h3>
              <p style={{ fontSize: 14, color: isLight ? '#4b5563' : '#aaa', lineHeight: 1.6, margin: 0 }}>
                {t('deleteRoomForMeDesc', 'This will remove the room, its chats, and all media from your view. Other members won\'t be affected.')}
              </p>
              <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
                <button
                  onClick={() => setShowPersonalDeleteConfirm(false)}
                  style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', color: isLight ? '#374151' : '#ccc', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)'}
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    const rId = (roomId || '').toLowerCase();
                    socket?.emit('clear_room_chat', { roomId: rId });
                    socket?.emit('leave_room', { roomId: rId });
                    try {
                      const pinned = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
                      localStorage.setItem('pinned_rooms', JSON.stringify(pinned.filter(id => id !== roomId)));
                    } catch(e) {}
                    try {
                      const chats = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
                      localStorage.setItem('watch_recent_chats', JSON.stringify(chats.filter(c =>
                        !((c.type === 'room') && ((c.id || '').toLowerCase() === rId || (c.partner || '').toLowerCase() === rId))
                      )));
                      window.dispatchEvent(new Event('conversations_updated'));
                    } catch(e) {}
                    roomModalsBack.skipNextClose();
                    setShowPersonalDeleteConfirm(false);
                    navigate('/');
                    toast.success('Room removed from your view');
                  }}
                  className="stay-white"
                  style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #ef4444, #f43f5e)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {t('deleteRoomButton', 'Delete Room')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div className="room-modals-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: isLight ? 'rgba(30,30,50,0.35)' : 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="admin-modal-card" style={{ position: 'relative', background: isLight ? '#ffffff' : '#141414', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', borderRadius: 24, width: '100%', maxWidth: 400, padding: '24px 28px', boxShadow: isLight ? '0 20px 60px rgba(0,0,0,0.12)' : '0 25px 50px rgba(0,0,0,0.6)' }}>
            <button
              onClick={() => setShowNotificationSettings(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: isLight ? '#6b7280' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = isLight ? '#374151' : '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = isLight ? '#6b7280' : '#888'; }}
            >
              <X size={15} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(var(--brand-1-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-1)' }}>
                  <Bell size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: isLight ? '#111' : '#fff', margin: 0 }}>
                    {t('notificationSettings', 'Notification Settings')}
                  </h3>
                  <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', margin: 0 }}>
                    {t('customizeNotifications', 'Customize notifications for your account')}
                  </p>
                </div>
              </div>

              <div style={{ height: 1, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Toggle 1: Join/Leave for this room */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#1e293b' : '#eee' }}>
                      {t('muteJoinLeaveAlerts', 'Mute Join/Leave Alerts')}
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>
                      {t('muteJoinLeaveAlertsDesc', 'Do not show toast notifications when users join or leave this room.')}
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={muteRoomJoinLeave}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setMuteRoomJoinLeave(val);
                        const myUsername = localStorage.getItem('watch_username') || 'guest';
                        localStorage.setItem(`mute_join_leave_${roomId}_${myUsername}`, String(val));
                      }}
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                    />
                    <span style={{
                      position: 'absolute', inset: 0,
                      backgroundColor: muteRoomJoinLeave ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : '#334155'),
                      borderRadius: 24, transition: 'background-color 0.2s',
                      boxShadow: isLight ? 'inset 0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }} />
                    <span style={{
                      position: 'absolute', height: 18, width: 18, left: muteRoomJoinLeave ? 22 : 4,
                      top: 3, backgroundColor: 'white', borderRadius: '50%', transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </label>
                </div>

                {/* Toggle 2: Mute all notification sounds */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#1e293b' : '#eee' }}>
                      {t('muteNotificationSounds', 'Mute Notification Sounds')}
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>
                      {t('muteNotificationSoundsDesc', 'Turn off sound alerts when receiving messages across all chats.')}
                    </div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={muteAllNotifSounds}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setMuteAllNotifSounds(val);
                        const myUsername = localStorage.getItem('watch_username') || 'guest';
                        localStorage.setItem(`mute_notif_sounds_${myUsername}`, String(val));
                      }}
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                    />
                    <span style={{
                      position: 'absolute', inset: 0,
                      backgroundColor: muteAllNotifSounds ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : '#334155'),
                      borderRadius: 24, transition: 'background-color 0.2s',
                      boxShadow: isLight ? 'inset 0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }} />
                    <span style={{
                      position: 'absolute', height: 18, width: 18, left: muteAllNotifSounds ? 22 : 4,
                      top: 3, backgroundColor: 'white', borderRadius: '50%', transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </label>
                </div>
              </div>

              <div style={{ height: 1, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)' }} />

              <button
                onClick={() => setShowNotificationSettings(false)}
                className="stay-white"
                style={{
                  width: '100%', padding: '12px 16px', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
                  border: 'none', color: '#fff', borderRadius: 14, fontSize: 14, fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(var(--brand-1-rgb),0.2)'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(var(--brand-1-rgb),0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--brand-1-rgb),0.2)'; }}
              >
                {t('done', 'Done')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Room;











