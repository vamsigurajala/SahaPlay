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
          <div style={{ ...modalStyle, maxWidth: 420, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Header gradient strip */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%)',
              borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)',
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(99,102,241,0.3)' }}>
                  <Cast size={18} color="#fff" />
                </div>
                <h3 style={{ margin: 0, color: textPrimary, fontSize: 16, fontWeight: 800 }}>Cast Screen</h3>
              </div>
              <button onClick={() => setShowCastDiscovery(false)} style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                fontSize: 48,
                marginBottom: 16,
                animation: 'pulse-slow 2s infinite'
              }}>🛠️</div>
              <h4 style={{ margin: '0 0 8px 0', color: textPrimary, fontSize: 18, fontWeight: 800 }}>Work is in Progress</h4>
              <p style={{ margin: '0 0 24px 0', color: textSecondary, fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
                This option is currently under development. It will be fully functional and available in the next version of SahaPlay!
              </p>
              <button
                onClick={() => setShowCastDiscovery(false)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                Got it
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}
