import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Edit2, Trash2, Cast, Tv, Monitor, ChevronRight, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API } from '../lib/api';

export default function RoomModals({
  renameModalOpen,
  setRenameModalOpen,
  renameInput,
  setRenameInput,
  socket,
  roomId,
  clearChatModalOpen,
  setClearChatModalOpen,
  clearChatTarget,
  clearForBoth,
  setClearForBoth,
  onClearDm,
  isLight = false,
  showCastDiscovery = false,
  setShowCastDiscovery,
  userList = [],
  username = '',
  playerRef,
  videoRef,
  isScreensharing,
  mediaUrl
}) {
  const { t } = useTranslation();
  const [tvPairingCode, setTvPairingCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'users'
  const [castConnecting, setCastConnecting] = useState(false);

  // Dynamic TV URL state — fallback to origin /tv
  const [tvUrl, setTvUrl] = useState(`${window.location.origin}/tv`);

  // Fetch the actual LAN IP address/URL from backend in local development
  useEffect(() => {
    if (showCastDiscovery) {
      if (/localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)) {
        fetch(`${API}/api/server-info`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('watch_token')}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.tvUrl) {
              setTvUrl(data.tvUrl);
            }
          })
          .catch(err => {
            console.warn('Failed to fetch server LAN IP, falling back to origin TV URL:', err);
          });
      } else {
        setTvUrl(`${window.location.origin}/tv`);
      }
    }
  }, [showCastDiscovery]);

  // Listen for TV link success
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      toast.success(t('tvLinkedSuccess', 'TV linked! It will join the room shortly.'), { icon: '📺', duration: 4000 });
      setShowCastDiscovery(false);
    };
    socket.on('tv_link_success', handler);
    return () => socket.off('tv_link_success', handler);
  }, [socket]);

  // Reset state when modal closes
  useEffect(() => {
    if (!showCastDiscovery) {
      setTvPairingCode('');
      setIsLinking(false);
      setActiveTab('code');
    }
  }, [showCastDiscovery]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(tvUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
      toast.success('TV URL copied!', { icon: '📋' });
    });
  };

  const handleLinkTv = () => {
    if (tvPairingCode.trim().length !== 6) {
      toast.error(t('invalidTvCode', 'Please enter a valid 6-character code.'));
      return;
    }
    setIsLinking(true);
    socket.emit('link_tv_code', { code: tvPairingCode.trim().toUpperCase(), roomId });
    setTimeout(() => {
      setIsLinking(false);
      setTvPairingCode('');
    }, 2000);
  };

  const pushToDevice = (targetSocketId, targetName) => {
    socket.emit('remote_command', {
      roomId,
      targetSocketId,
      command: 'go_fullscreen_and_play',
      mediaUrl,
      isScreensharing,
      senderName: username
    });
    toast.success(t('castingPushed', 'Casting pushed to {{targetName}}!', { targetName }), { icon: '📺' });
    setShowCastDiscovery(false);
  };

  // Real Google Chromecast support via the browser's built-in Remote Playback API
  // (HTMLMediaElement.remote.prompt()) — Chrome/Edge use this to open their native
  // Chromecast device picker and stream directly from the device to the TV, no
  // Google Cast SDK / receiver app registration needed. Only works against an
  // actual <video> element playing a directly reachable media URL — YouTube/Twitch
  // (iframe-embedded) and the Virtual Browser have no such element to hand off.
  const getCastableVideoElement = () => {
    if (isScreensharing && videoRef?.current) return videoRef.current;
    if (playerRef?.current) {
      try {
        const internal = playerRef.current.getInternalPlayer ? playerRef.current.getInternalPlayer() : null;
        if (internal instanceof HTMLVideoElement) return internal;
      } catch {}
    }
    if (videoRef?.current && videoRef.current.tagName === 'VIDEO' && videoRef.current.currentSrc) return videoRef.current;
    return null;
  };

  const chromecastSupported = typeof window !== 'undefined' && 'RemotePlayback' in window;

  const handleChromecast = async () => {
    const videoEl = getCastableVideoElement();
    if (!videoEl || !('remote' in videoEl)) {
      toast.error(t('chromecastNoSource', 'Chromecast needs a direct video or screen share currently playing.'));
      return;
    }
    try {
      setCastConnecting(true);
      await videoEl.remote.prompt();
      toast.success(t('chromecastStarted', 'Casting to Chromecast!'), { icon: '📡' });
      setShowCastDiscovery(false);
    } catch (e) {
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
        toast.error(t('chromecastFailed', 'Could not start Chromecast. Make sure a Chromecast device is on the same Wi-Fi network.'));
      }
    } finally {
      setCastConnecting(false);
    }
  };

  if (!renameModalOpen && !clearChatModalOpen && !showCastDiscovery) return null;

  const bg = isLight ? '#ffffff' : '#12131e';
  const border = isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)';
  const textPrimary = isLight ? '#0f172a' : '#f8fafc';
  const textSecondary = isLight ? '#64748b' : '#94a3b8';
  const surfaceBg = isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)';

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 999999,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
    animation: 'rmFadeIn 0.25s ease-out',
  };

  const modalStyle = {
    background: bg, border,
    borderRadius: 28, padding: 0,
    width: '100%', maxWidth: 480,
    boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
    animation: 'rmSlideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
    position: 'relative', overflow: 'hidden',
  };

  const modalContent = (
    <>
      <style>{`
        @keyframes rmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rmSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .rm-tab-btn { transition: all 0.2s; cursor: pointer; border: none; background: transparent; }
        .rm-tab-btn:hover { opacity: 0.85; }
        .rm-code-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .rm-user-row { transition: all 0.2s; cursor: pointer; }
        .rm-user-row:hover { background: ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'} !important; transform: translateX(3px); }
        .rm-link-btn { transition: all 0.2s; }
        .rm-link-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .rm-link-btn:active:not(:disabled) { transform: scale(0.97); }
      `}</style>

      {/* ── RENAME MODAL ── */}
      {renameModalOpen && (
        <div style={overlayStyle} onClick={() => setRenameModalOpen(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '28px 28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={20} color="#6366f1" />
                </div>
                <h3 style={{ margin: 0, color: textPrimary, fontSize: 20, fontWeight: 900 }}>{t('renameRoomTitle', 'Rename Room')}</h3>
              </div>
              <input
                value={renameInput}
                onChange={e => setRenameInput(e.target.value)}
                autoFocus
                style={{
                  width: '100%', background: surfaceBg, border,
                  borderRadius: 14, padding: '14px 18px', color: textPrimary,
                  marginBottom: 20, fontSize: 15, outline: 'none', boxSizing: 'border-box'
                }}
                placeholder={t('enterNewName', 'Enter new name...')}
                onKeyDown={e => { if (e.key === 'Enter' && renameInput.trim()) { socket.emit('mod_rename_room', { roomId, newName: renameInput.trim() }); setRenameModalOpen(false); } }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setRenameModalOpen(false)} style={{ padding: '12px 24px', background: 'transparent', border: 'none', color: textSecondary, fontWeight: 700, cursor: 'pointer', borderRadius: 12 }}>{t('cancel', 'Cancel')}</button>
                <button onClick={() => { if (renameInput.trim()) { socket.emit('mod_rename_room', { roomId, newName: renameInput.trim() }); setRenameModalOpen(false); } }} style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>{t('save', 'Save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CLEAR CHAT MODAL ── */}
      {clearChatModalOpen && (
        <div style={overlayStyle} onClick={() => { setClearChatModalOpen(false); if (setClearForBoth) setClearForBoth(false); }}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '28px 28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} color="#ef4444" />
                </div>
                <h3 style={{ margin: 0, color: textPrimary, fontSize: 20, fontWeight: 900 }}>{t('clearChatTitle', 'Clear Chat')}</h3>
              </div>
              <p style={{ color: textSecondary, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                {t('clearChatConfirm', 'Are you sure you want to clear your chat history with')} <strong style={{ color: textPrimary }}>{clearChatTarget}</strong>?
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: textPrimary, fontSize: 14, marginBottom: 20, cursor: 'pointer', padding: '10px 14px', background: surfaceBg, borderRadius: 12, border }}>
                <input type="checkbox" checked={clearForBoth} onChange={e => setClearForBoth && setClearForBoth(e.target.checked)} style={{ accentColor: '#ef4444', cursor: 'pointer', width: 16, height: 16 }} />
                {t('alsoClearFor', 'Also clear chat history for')} {clearChatTarget}
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setClearChatModalOpen(false); if (setClearForBoth) setClearForBoth(false); }} style={{ padding: '12px 24px', background: surfaceBg, border, color: textPrimary, cursor: 'pointer', fontWeight: 700, borderRadius: 12, fontSize: 14 }}>{t('cancel', 'Cancel')}</button>
                <button onClick={() => { if (onClearDm) onClearDm(clearChatTarget); socket.emit('clear_dm', { targetUsername: clearChatTarget, clearForBoth }); setClearChatModalOpen(false); if (setClearForBoth) setClearForBoth(false); toast.success(t('chatCleared', 'Chat history cleared')); }} className="danger-red-btn stay-white" style={{ padding: '12px 28px', background: '#ef4444', border: 'none', borderRadius: 14, color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 14, boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}><span className="stay-white" style={{ color: '#fff' }}>{t('clearChat', 'Clear Chat')}</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── CAST TO TV MODAL ── */}
      {showCastDiscovery && (
        <div style={overlayStyle} onClick={() => setShowCastDiscovery(false)}>
          <div style={{ ...modalStyle, maxWidth: 440, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.05) 100%)',
              borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
              padding: '24px 28px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(99,102,241,0.3)' }}>
                  <Cast size={18} color="#fff" />
                </div>
                <h3 style={{ margin: 0, color: textPrimary, fontSize: 18, fontWeight: 900 }}>{t('castToTv', 'Cast to TV')}</h3>
              </div>
              <button onClick={() => setShowCastDiscovery(false)} style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '28px 28px 24px' }}>
              
              {/* Instructions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#6366f1', flexShrink: 0, marginTop: 1
                  }}>1</div>
                  <p style={{ margin: 0, color: textSecondary, fontSize: 13.5, lineHeight: 1.5 }}>
                    Open <a href="/tv" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 700, textDecoration: 'none' }}>sahaplay.com/tv</a> on your TV or projector.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#6366f1', flexShrink: 0, marginTop: 1
                  }}>2</div>
                  <p style={{ margin: 0, color: textSecondary, fontSize: 13.5, lineHeight: 1.5 }}>
                    Enter the 6-character pairing code shown on the TV below:
                  </p>
                </div>
              </div>

              {/* Code Input */}
              <input
                type="text"
                maxLength={6}
                value={tvPairingCode}
                onChange={e => setTvPairingCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="CODE"
                className="rm-code-input"
                style={{
                  width: '100%',
                  height: '56px',
                  fontSize: '28px',
                  fontWeight: '900',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  borderRadius: '16px',
                  border: isLight ? '2px solid #e2e8f0' : '2px solid rgba(255,255,255,0.08)',
                  background: surfaceBg,
                  color: textPrimary,
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  marginBottom: 20,
                  fontFamily: "'Courier New', monospace"
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tvPairingCode.trim().length === 6) {
                    handleLinkTv();
                  }
                }}
              />

              {/* Action Button */}
              <button
                onClick={handleLinkTv}
                disabled={isLinking || tvPairingCode.trim().length !== 6}
                className="rm-link-btn stay-white"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '14px 24px',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: (isLinking || tvPairingCode.trim().length !== 6) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
                  opacity: tvPairingCode.trim().length === 6 ? 1 : 0.6,
                  transition: 'all 0.2s',
                  marginBottom: 24
                }}
              >
                {isLinking ? 'Linking TV...' : 'Link TV Screen'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />
                <span style={{ color: textSecondary, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('or', 'or')}</span>
                <div style={{ flex: 1, height: 1, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Google Chromecast */}
              <button
                onClick={handleChromecast}
                disabled={castConnecting || !chromecastSupported}
                title={!chromecastSupported ? t('chromecastUnsupported', 'Chromecast requires Google Chrome or Microsoft Edge.') : undefined}
                className={`rm-link-btn${chromecastSupported ? ' stay-white' : ''}`}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: !chromecastSupported ? (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)') : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                  color: !chromecastSupported ? (isLight ? '#94a3b8' : '#666') : '#fff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '14px 24px',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: (castConnecting || !chromecastSupported) ? 'not-allowed' : 'pointer',
                  boxShadow: !chromecastSupported ? 'none' : '0 8px 24px rgba(37,99,235,0.25)',
                  opacity: castConnecting ? 0.75 : 1,
                  transition: 'all 0.2s',
                  marginBottom: 24
                }}
              >
                {castConnecting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Cast size={18} />}
                {castConnecting ? t('chromecastConnecting', 'Connecting…') : t('castChromecast', 'Cast with Google Chromecast')}
              </button>

              {/* Help & Testing Section */}
              <div style={{
                background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                borderRadius: 16,
                padding: 16,
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tv size={16} color={isLight ? '#475569' : '#94a3b8'} />
                    <span style={{ color: textSecondary, fontSize: 13, fontWeight: 600 }}>Pairing URL:</span>
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    style={{
                      background: 'transparent', border: 'none', color: '#6366f1',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {urlCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    {urlCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div style={{
                  fontSize: 13, color: textPrimary, fontWeight: 700, wordBreak: 'break-all',
                  background: isLight ? '#fff' : 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 10,
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span>{tvUrl}</span>
                  <a
                    href="/tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open TV mode in a new tab"
                    style={{
                      color: '#6366f1', display: 'flex', alignItems: 'center',
                      padding: 4, borderRadius: 6, cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}
