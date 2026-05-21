import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Edit2, Trash2, Cast, Tv, Monitor, Activity, ChevronRight, Search, Copy, Check, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [isSearching, setIsSearching] = useState(true);
  const [tvPairingCode, setTvPairingCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    if (showCastDiscovery) {
      setIsSearching(true);
      const timer = setTimeout(() => setIsSearching(false), 2500);

      // Fetch real LAN IP from backend
      fetch(`http://${window.location.hostname}:3001/api/server-info`)
        .then(r => r.json())
        .then(data => setServerInfo(data))
        .catch(() => setServerInfo(null));

      return () => clearTimeout(timer);
    }
  }, [showCastDiscovery]);

  // Listen for TV link success
  useEffect(() => {
    if (!socket) return;
    const handler = ({ message }) => {
      toast.success(t('tvLinkedSuccess', 'TV linked! It will join the room shortly.'), { icon: '📺', duration: 4000 });
    };
    socket.on('tv_link_success', handler);
    return () => socket.off('tv_link_success', handler);
  }, [socket]);

  const tvUrl = serverInfo?.tvUrl || `${window.location.origin}/tv`;
  const qrUrl = `https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=${encodeURIComponent(tvUrl)}&choe=UTF-8`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(tvUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
      toast.success(t('urlCopied', 'URL copied!'), { icon: '📋' });
    });
  };


  if (!renameModalOpen && !clearChatModalOpen && !showCastDiscovery) return null;

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

  const triggerNativeCast = () => {
    // 1. Try casting screenshare video if active
    if (isScreensharing && videoRef.current) {
      if (videoRef.current.remotePlayback) {
        videoRef.current.remotePlayback.prompt().catch(err => console.warn('[Cast] Native fail:', err));
        setShowCastDiscovery(false);
        return;
      }
    }

    // 2. Try casting main media player
    const internalPlayer = playerRef.current?.getInternalPlayer();
    const videoElement = internalPlayer instanceof HTMLVideoElement 
      ? internalPlayer 
      : internalPlayer?.querySelector?.('video');

    if (videoElement && videoElement.remotePlayback) {
      videoElement.remotePlayback.prompt().catch(err => console.warn('[Cast] Native fail:', err));
    } else {
      toast(t('nativeCastOpened', 'Native Cast picker opened in browser menu.'), { icon: '📺' });
    }
    setShowCastDiscovery(false);
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
      setShowCastDiscovery(false);
    }, 1500); // Wait for the tv_link_success socket event toast to appear
  };

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 999999,
    background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(14px) saturate(180%)',
    WebkitBackdropFilter: 'blur(14px) saturate(180%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    animation: 'fadeInOverlay 0.3s ease-out'
  };

  const modalStyle = {
    background: isLight ? '#ffffff' : '#1a1b22',
    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)',
    animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    position: 'relative',
    overflow: 'hidden'
  };

  const modalContent = (
    <>
      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes radar {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .discovery-item:hover {
          background: ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'} !important;
          transform: translateX(4px);
        }
        .discovery-item:active { transform: scale(0.98); }
        .radar-circle {
          position: absolute;
          inset: 0;
          border: 2px solid #6366f1;
          border-radius: 50%;
          animation: radar 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* --- RENAME MODAL --- */}
      {renameModalOpen && (
        <div style={overlayStyle} className="room-modals-overlay" onClick={() => setRenameModalOpen(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit2 size={24} color="#6366f1" />
              </div>
              <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>{t('renameRoomTitle', 'Rename Room')}</h3>
            </div>
            <input 
              value={renameInput} 
              onChange={e => setRenameInput(e.target.value)} 
              autoFocus 
              style={{
                width: '100%', background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 18, padding: '18px 22px', color: isLight ? '#000' : '#fff',
                marginBottom: 28, fontSize: 16, outline: 'none'
              }} 
              placeholder={t('enterNewName', 'Enter new name...')}
            />
            <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameModalOpen(false)} style={{ padding: '14px 28px', background: 'transparent', border: 'none', color: isLight ? '#64748b' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>{t('cancel', 'Cancel')}</button>
              <button 
                onClick={() => { 
                  if(renameInput.trim()){ socket.emit('mod_rename_room', { roomId, newName: renameInput.trim() }); setRenameModalOpen(false); } 
                }} 
                style={{ padding: '14px 36px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 6px 20px rgba(99, 102, 241, 0.3)' }}
              >{t('save', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CLEAR CHAT MODAL --- */}
      {clearChatModalOpen && (
        <div style={overlayStyle} className="room-modals-overlay" onClick={() => setClearChatModalOpen(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>{t('clearChatTitle', 'Clear Chat')}</h3>
            </div>
            <p style={{ color: isLight ? '#64748b' : '#94a3b8', fontSize: 15, marginBottom: 28 }}>{t('clearHistoryPrompt', 'Clear history with')} <strong>{clearChatTarget}</strong>?</p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setClearChatModalOpen(false)} style={{ padding: '14px 28px', background: 'transparent', border: 'none', color: isLight ? '#64748b' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>{t('cancel', 'Cancel')}</button>
              <button 
                onClick={() => { socket.emit('clear_dm', { targetUsername: clearChatTarget, clearForBoth }); setClearChatModalOpen(false); }} 
                style={{ padding: '14px 36px', background: '#ef4444', border: 'none', borderRadius: 18, color: '#fff', fontWeight: 900, cursor: 'pointer' }}
              >{t('clear', 'Clear')}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CAST DISCOVERY MODAL --- */}
      {showCastDiscovery && (
        <div style={overlayStyle} className="room-modals-overlay" onClick={() => setShowCastDiscovery(false)}>
          <div style={{ ...modalStyle, maxWidth: 520 }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative', width: 48, height: 48 }}>
                  {isSearching && (
                    <>
                      <div className="radar-circle" style={{ animationDelay: '0s' }} />
                      <div className="radar-circle" style={{ animationDelay: '0.6s' }} />
                    </>
                  )}
                  <div style={{ position: 'relative', zIndex: 2, width: 48, height: 48, borderRadius: 16, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cast size={22} color="#6366f1" />
                  </div>
                </div>
                <div>
                  <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 20, fontWeight: 900 }}>{t('castToTvTitle', 'Cast to TV')}</h3>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{t('sameWifiRequired', 'Same WiFi network required')}</p>
                </div>
              </div>
              <button onClick={() => setShowCastDiscovery(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 8 }}><X size={20} /></button>
            </div>

            {/* Step 1 — Open TV URL */}
            <div style={{
              background: isLight ? '#f8fafc' : 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 20, padding: '20px', marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>1</div>
                <span style={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 800, fontSize: 15 }}>{t('openUrlInstruction', 'Open this URL on your TV or phone')}</span>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* QR Code */}
                <div style={{ flexShrink: 0, background: '#fff', padding: 6, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    width={90} height={90}
                    style={{ display: 'block', borderRadius: 6 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{t('scanQrInstruction', 'Scan the QR code or type this URL:')}</p>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isLight ? '#fff' : 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '8px 12px'
                  }}>
                    <Wifi size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, color: isLight ? '#1e293b' : '#c7d2fe', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>{tvUrl}</span>
                    <button
                      onClick={handleCopyUrl}
                      title={t('copyUrlTitle', 'Copy URL')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: urlCopied ? '#10b981' : '#6366f1', padding: 4, flexShrink: 0 }}
                    >
                      {urlCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  {serverInfo?.lanIp === '127.0.0.1' && (
                    <p style={{ margin: '6px 0 0 0', fontSize: 11, color: '#f59e0b' }}>⚠️ {t('lanIpWarning', "Could not detect LAN IP. Make sure you're connected to a network.")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2 — Enter the code shown on TV */}
            <div style={{
              background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '20px', marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 }}>2</div>
                <span style={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 800, fontSize: 15 }}>{t('enterTvCodeInstruction', 'Enter the code shown on your TV')}</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder={t('tvCodePlaceholder', 'e.g. A1B2C3')}
                  value={tvPairingCode}
                  onChange={(e) => setTvPairingCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={6}
                  style={{
                    flex: 1,
                    background: isLight ? '#fff' : 'rgba(0,0,0,0.25)',
                    border: tvPairingCode.length === 6
                      ? '1.5px solid #6366f1'
                      : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)'),
                    borderRadius: 14,
                    padding: '14px 18px',
                    color: isLight ? '#0f172a' : '#fff',
                    fontSize: 22,
                    fontWeight: 900,
                    textAlign: 'center',
                    letterSpacing: 4,
                    outline: 'none',
                    fontFamily: 'monospace',
                    transition: 'border-color 0.2s'
                  }}
                />
                <button
                  onClick={handleLinkTv}
                  disabled={tvPairingCode.length !== 6 || isLinking}
                  style={{
                    padding: '0 24px',
                    background: tvPairingCode.length === 6 && !isLinking
                      ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                      : (isLight ? '#e2e8f0' : '#334155'),
                    color: tvPairingCode.length === 6 ? '#fff' : (isLight ? '#94a3b8' : '#64748b'),
                    border: 'none',
                    borderRadius: 14,
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: tvPairingCode.length === 6 && !isLinking ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    boxShadow: tvPairingCode.length === 6 ? '0 4px 16px rgba(99,102,241,0.35)' : 'none'
                  }}
                >
                  {isLinking ? t('linking', 'Linking…') : t('link', 'Link')}
                </button>
              </div>
            </div>

            {/* In-room users list */}
            {!isSearching && userList.filter(u => u.username !== username).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{t('castToSomeone', 'Or cast to someone already in the room')}</p>
                {userList.filter(u => u.username !== username).map(user => {
                  const isTV = user.username.toLowerCase().includes('tv') || user.username.toLowerCase().includes('smart');
                  return (
                    <button
                      key={user.socketId}
                      onClick={() => pushToDevice(user.socketId, user.username)}
                      className="discovery-item"
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                        marginBottom: 8, textAlign: 'left'
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: isTV ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isTV ? <Tv size={18} color="#6366f1" /> : <Monitor size={18} color="#94a3b8" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isLight ? '#0f172a' : '#fff', fontSize: 14, fontWeight: 700 }}>{user.username}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>{isTV ? t('smartTv', 'Smart TV') : t('computer', 'Computer')}</div>
                      </div>
                      <ChevronRight size={16} color="#6366f1" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Native cast fallback */}
            <button
              onClick={triggerNativeCast}
              style={{
                width: '100%', padding: '14px', background: 'transparent',
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontSize: 13, transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}
            >
              <Cast size={16} />
              <span>{t('useNativeCast', 'Use Browser Native Cast')}</span>
            </button>

          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}
