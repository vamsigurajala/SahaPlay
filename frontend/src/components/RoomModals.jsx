import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Edit2, Trash2, Cast, Tv, Monitor, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const API = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)
  ? `http://${window.location.hostname}:3001`
  : `https://${window.location.hostname}`;

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
  const [tvPairingCode, setTvPairingCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'users'

  // Dynamic TV URL state — fallback to origin /tv
  const [tvUrl, setTvUrl] = useState(`${window.location.origin}/tv`);

  // Fetch the actual LAN IP address/URL from backend in local development
  useEffect(() => {
    if (showCastDiscovery) {
      if (/localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname)) {
        fetch(`${API}/api/server-info`)
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
                <button onClick={() => { socket.emit('clear_dm', { targetUsername: clearChatTarget, clearForBoth }); setClearChatModalOpen(false); if (setClearForBoth) setClearForBoth(false); toast.success(t('chatCleared', 'Chat history cleared')); }} className="danger-red-btn stay-white" style={{ padding: '12px 28px', background: '#ef4444', border: 'none', borderRadius: 14, color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 14, boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}><span className="stay-white" style={{ color: '#fff' }}>{t('clearChat', 'Clear Chat')}</span></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CAST TO TV MODAL ── */}
      {showCastDiscovery && (
        <div style={overlayStyle} onClick={() => setShowCastDiscovery(false)}>
          <div style={{ ...modalStyle, maxWidth: 500 }} onClick={e => e.stopPropagation()}>

            {/* Header gradient strip */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%)',
              borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
              padding: '24px 24px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                  <Cast size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: textPrimary, fontSize: 18, fontWeight: 900 }}>Cast to TV</h3>
                  <p style={{ margin: 0, color: textSecondary, fontSize: 12, fontWeight: 600 }}>Works on any network — no WiFi pairing needed</p>
                </div>
              </div>
              <button onClick={() => setShowCastDiscovery(false)} style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step 1 — Open on TV */}
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0, marginTop: 2 }}>1</div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: textPrimary, fontWeight: 800, fontSize: 14, margin: '0 0 10px' }}>Open on your TV browser</p>
                  {/* URL row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: isLight ? '#fff' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(99,102,241,0.3)'}`,
                    borderRadius: 12, padding: '10px 12px',
                    marginBottom: 8,
                  }}>
                    <Tv size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, color: isLight ? '#1e293b' : '#c7d2fe', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>{tvUrl}</span>
                    <button onClick={handleCopyUrl} title="Copy URL" style={{ background: 'none', border: 'none', cursor: 'pointer', color: urlCopied ? '#10b981' : '#6366f1', padding: 4, flexShrink: 0, display: 'flex' }}>
                      {urlCopied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                    <a href={tvUrl} target="_blank" rel="noreferrer" style={{ color: '#6366f1', display: 'flex', flexShrink: 0 }} title="Open in new tab">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <p style={{ color: textSecondary, fontSize: 12, margin: 0 }}>
                    Works on Smart TV, Fire Stick, Chromecast, phone, or any browser. Make sure both devices are on the same WiFi network.
                  </p>
                </div>
              </div>

              {/* Step 2 — Enter code */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0, marginTop: 2 }}>2</div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: textPrimary, fontWeight: 800, fontSize: 14, margin: '0 0 10px' }}>Enter the code shown on your TV</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="e.g. A1B2C3"
                      value={tvPairingCode}
                      onChange={e => setTvPairingCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      maxLength={6}
                      className="rm-code-input"
                      onKeyDown={e => { if (e.key === 'Enter') handleLinkTv(); }}
                      style={{
                        flex: 1, background: isLight ? '#fff' : 'rgba(0,0,0,0.25)',
                        border: `${tvPairingCode.length === 6 ? '1.5px solid #6366f1' : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)')}`,
                        borderRadius: 12, padding: '14px 16px', color: textPrimary,
                        fontSize: 24, fontWeight: 900, textAlign: 'center',
                        letterSpacing: 6, fontFamily: 'monospace', transition: 'border-color 0.2s',
                      }}
                    />
                    <button
                      className="rm-link-btn"
                      onClick={handleLinkTv}
                      disabled={tvPairingCode.length !== 6 || isLinking}
                      style={{
                        padding: '0 22px',
                        background: tvPairingCode.length === 6 && !isLinking
                          ? 'linear-gradient(135deg,#6366f1,#a855f7)'
                          : (isLight ? '#e2e8f0' : '#1e2035'),
                        color: tvPairingCode.length === 6 ? '#fff' : textSecondary,
                        border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14,
                        cursor: tvPairingCode.length === 6 && !isLinking ? 'pointer' : 'not-allowed',
                        boxShadow: tvPairingCode.length === 6 ? '0 4px 14px rgba(99,102,241,0.4)' : 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isLinking ? 'Linking…' : 'Connect'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* In-room users (collapsed section) */}
            {userList.filter(u => u.username !== username).length > 0 && (
              <div style={{ padding: '0 24px 20px' }}>
                <div style={{ height: 1, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)', margin: '0 0 16px' }} />
                <p style={{ margin: '0 0 10px', fontSize: 11, color: textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Or cast to someone in this room</p>
                {userList.filter(u => u.username !== username).map(user => {
                  const isTV = user.username.toLowerCase().includes('tv') || user.username.toLowerCase().includes('smart');
                  return (
                    <button key={user.socketId} onClick={() => pushToDevice(user.socketId, user.username)} className="rm-user-row"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: surfaceBg, border, borderRadius: 12, marginBottom: 6, textAlign: 'left' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: isTV ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isTV ? <Tv size={16} color="#6366f1" /> : <Monitor size={16} color="#94a3b8" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: textPrimary, fontSize: 13, fontWeight: 700 }}>{user.username}</div>
                        <div style={{ color: textSecondary, fontSize: 11, fontWeight: 600 }}>{isTV ? 'Smart TV' : 'Computer'}</div>
                      </div>
                      <ChevronRight size={14} color="#6366f1" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bottom padding if no users list */}
            {userList.filter(u => u.username !== username).length === 0 && (
              <div style={{ height: 20 }} />
            )}

          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}
