import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Shield, Zap, Volume2, Video, Settings, Settings2, Trash2, Check, UserMinus, ShieldAlert, Image as ImageIcon, ZoomIn, ZoomOut, Save, Lock, UserCheck, Link2, Mic, Globe, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/CropImage';
import { getAvatarUrl, getRoomThumbnailUrl } from '../utils/avatarUtils';
import { API } from '../lib/api';

const BannedUserItem = ({ uname, onUnban, socket, roomId }) => {
  const { t } = useTranslation();
  const [avatar, setAvatar] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    fetch(`${API}/api/users/${uname}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.avatarPath) setAvatar(d.avatarPath); })
      .catch(()=>{});
  }, [uname]);

  const h = Array.from(uname).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ['#6366f1','#a855f7','#ec4899','#ef4444','#f97316','#10b981','#3b82f6','#06b6d4'];
  const color = colors[h % colors.length];

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontSize: 13, fontWeight: 800, overflow: 'hidden' }}>
          {avatar ? <img src={getAvatarUrl(avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : uname.slice(0,2).toUpperCase()}
        </div>
        <span style={{ fontSize: 15, color: document.documentElement.getAttribute('data-theme') === 'light' ? '#000' : '#eee', fontWeight: 600 }}>@{uname}</span>
      </div>
        <button
          onClick={() => {
            onUnban(uname);
            socket.emit('mod_unban', { roomId: (roomId || '').toLowerCase(), username: uname });
            toast.success(`User @${uname} has been unbanned.`);
          }}
          style={{ background: 'rgba(16,185,129,0.1)', border: 'none', color: '#10b981', padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {t('unban', 'Unban')}
        </button>
    </div>
  );
};

export default function RoomSettingsModal({
  isOpen,
  onClose,
  room,
  socket,
  isHost,
  roomId,
  onBeforeLeaveNavigate,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [mobileScreen, setMobileScreen] = useState('list');
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  // Reset mobile screen when modal opens
  useEffect(() => { if (isOpen) setMobileScreen('list'); }, [isOpen]);
  const [activeTab, setActiveTab] = useState('general');
  const [roomName, setRoomName] = useState(room?.roomName || '');
  const [permissions, setPermissions] = useState(room?.permissions || { changeMedia: 'all', chat: 'all', cam: 'all' });
  const [settings, setSettings] = useState(room?.settings ? { allUsersPlayerSettings: true, ...room.settings } : { playerCustomName: 'SahaPlay Player', allUsersPlayerSettings: true });
  const [thumbnail, setThumbnail] = useState(room?.thumbnailPath || null);
  const [isUploading, setIsUploading] = useState(false);
  const [bannedUsers, setBannedUsers] = useState(room?.bannedUsers || []);

  // Cropper states
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  useEffect(() => {
    if (activeTab === 'security' && socket) {
      socket.emit('mod_fetch_bans', { roomId: (roomId || '').toLowerCase() });
    }
  }, [activeTab, roomId, socket]);

  useEffect(() => {
    const handleSettingsUpdate = (data) => {
      if (data.bannedUsers !== undefined) {
        setBannedUsers(data.bannedUsers);
      }
    };
    if (socket) {
      socket.on('room_settings_updated', handleSettingsUpdate);
      return () => socket.off('room_settings_updated', handleSettingsUpdate);
    }
  }, [socket]);

  useEffect(() => {
    if (room) {
      setRoomName(room.roomName);
      if (room.permissions) setPermissions(room.permissions);
      if (room.settings) setSettings({ allUsersPlayerSettings: true, ...room.settings });
      setThumbnail(room.thumbnailPath);
      // Removed setBannedUsers sync here to prevent global room_state heartbeats from overwriting the fetched bans list.
    }
  }, [room, isOpen]);

  useEffect(() => {
  }, [roomId, isOpen]);

  const handleSave = () => {
    socket.emit('update_room_settings', {
      roomId: (roomId || '').toLowerCase(),
      newName: roomName,
      permissions,
      settings
    });
    toast.success('Settings updated!');
    onClose();
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result);
      setShowCropper(true);
    });
    reader.readAsDataURL(file);
  };

  const handleConfirmCrop = async () => {
    try {
      setIsUploading(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      const formData = new FormData();
      formData.append('thumbnail', croppedImageBlob, 'thumbnail.jpg');
      formData.append('roomId', roomId);

      const res = await fetch(`${API}/api/rooms/thumbnail`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('watch_token')}` },
        body: formData
      });
      const data = await res.json();
      if (data.thumbnailPath) {
        setThumbnail(data.thumbnailPath);
        toast.success('Thumbnail updated!');
        setShowCropper(false);
        setImageSrc(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process and upload image');
    } finally {
      setIsUploading(false);
    }
  };

  // Was only clear_room_chat (hide messages for me) + leave_room — despite
  // the Danger Zone copy ('Delete Forever', 'permanent action... will be
  // destroyed') promising an actual deletion, this never touched room_names
  // at all, so the room silently kept existing — reachable again via its
  // link/ID, and still listed forever in Room History (which reads directly
  // from room_names), exactly what was reported. The backend has a real,
  // host-authorization-checked 'delete_room' handler that removes the room
  // everywhere (room_names, messages, bans) and broadcasts
  // room_permanently_deleted to every connected client — nothing in the
  // frontend actually emitted it before this. That broadcast is also what
  // GlobalChatWidget already rebroadcasts as the 'room_deleted' window event
  // usePinnedRooms/useRoomHistory listen for, so Room History updates
  // immediately with no extra work needed here.
  const handleDeleteRoom = () => {
    const rId = (roomId || '').toLowerCase();
    socket.emit('delete_room', { roomId: rId });
    try {
      const pinned = JSON.parse(localStorage.getItem('pinned_rooms') || '[]');
      localStorage.setItem('pinned_rooms', JSON.stringify(pinned.filter(id => id !== roomId)));
    } catch(e) {}
    try {
      const chats = JSON.parse(localStorage.getItem('watch_recent_chats') || '[]');
      localStorage.setItem('watch_recent_chats', JSON.stringify(chats.filter(c => (c.id || '').toLowerCase() !== rId)));
      window.dispatchEvent(new Event('conversations_updated'));
    } catch(e) {}
    toast.success(t('roomDeletedForever', 'Room deleted forever'));
    setShowDeleteConfirm(false);
    onBeforeLeaveNavigate && onBeforeLeaveNavigate();
    onClose();
    navigate('/');
  };

  if (!isOpen) return null;

  const TabButton = ({ id, label, icon: Icon }) => (
    <button 
      onClick={() => setActiveTab(id)}
      style={{
        position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, border: 'none',
        background: activeTab === id ? (isLight ? 'rgba(var(--brand-1-rgb),0.08)' : 'rgba(var(--brand-1-rgb),0.15)') : 'transparent',
        color: activeTab === id ? (isLight ? 'var(--brand-1-dark)' : 'var(--brand-1-light)') : (isLight ? '#000' : '#888'),
        fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
      }}
    >
      {activeTab === id && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'var(--brand-1-light)', borderRadius: '0 10px 10px 0'}} />}
      <Icon size={16} /> {label}
    </button>
  );

  return createPortal(
    <>
      <div
        onClick={onClose}
        className={`room-modals-overlay${isMobile ? ' rsm-overlay' : ''}`}
        style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      >
      <div
        onClick={e => e.stopPropagation()}
        className={`modal-enter rsm-container`}
        style={{ position: 'relative', background: isLight ? '#fff' : 'linear-gradient(135deg, #2d1654 0%, #150a2e 100%)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-2-rgb), 0.25)', borderRadius: isMobile ? '20px 20px 0 0' : 28, width: '100%', maxWidth: isMobile ? '100%' : 740, maxHeight: isMobile ? '94vh' : '85vh', display: 'flex', flexDirection: 'column', overflow: 'visible', boxShadow: isLight ? '0 30px 80px rgba(0,0,0,0.1)' : '0 40px 100px rgba(0,0,0,0.8), 0 0 50px rgba(var(--brand-2-rgb), 0.1)' }}
      >

        {/* Close Button */}
        <button
          onClick={onClose}
          className="room-settings-close-btn"
          style={{
            position: 'absolute', top: isMobile ? 12 : -2, right: isMobile ? 12 : -58, width: 48, height: 48, borderRadius: '50%',
            background: isLight ? '#fff' : 'rgba(30, 27, 46, 0.8)',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)',
            color: isLight ? '#000' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10,
            backdropFilter: 'blur(10px)',
            boxShadow: isLight ? 'none' : '0 8px 16px rgba(0,0,0,0.5)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(45, 41, 69, 0.9)';
            e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)';
            e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(var(--brand-2-rgb), 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isLight ? '#fff' : 'rgba(30, 27, 46, 0.8)';
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <X size={22} />
        </button>

        {/* Header */}
        <div style={{ padding: isMobile ? '20px 20px 16px' : '24px 30px', borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: thumbnail ? 'none' : 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(var(--brand-1-rgb),0.2)', overflow: 'hidden' }}>
                {thumbnail ? (
                  <img src={getRoomThumbnailUrl(thumbnail)} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Settings size={22} color="#fff" />
                )}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px' }}>
                  {isMobile && mobileScreen !== 'list' ? t(`${mobileScreen}Tab`, mobileScreen.charAt(0).toUpperCase() + mobileScreen.slice(1)) : t('roomSettings', 'Room Settings')}
                </h2>
                {(!isMobile || mobileScreen === 'list') && (
                  <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 600, marginTop: 2 }}>{t('configureYourSpace', 'Configure your space')}</div>
                )}
              </div>
            </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar — hidden on mobile */}
          <div className="rsm-sidebar" style={{ width: 220, padding: 24, background: isLight ? '#f8fafc' : 'rgba(21, 10, 46, 0.4)', borderRight: isLight ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-2-rgb), 0.15)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TabButton id="general" label={t('generalTab', 'General')} icon={Settings} />
            <TabButton id="media" label={t('mediaPlayerTab', 'Media Player')} icon={Zap} />
            <TabButton id="security" label={t('securityTab', 'Security')} icon={Shield} />
          </div>

          {/* Content */}
          <div className="rsm-content" style={{ flex: 1, padding: 30, overflowY: 'auto' }}>
            {/* Mobile: navigation list */}
            {isMobile && mobileScreen === 'list' && (
              <div>
                <button className="rsm-mob-list-item" onClick={() => { setMobileScreen('general'); setActiveTab('general'); }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Settings size={18} color="var(--brand-1-light)" /> {t('generalTab', 'General')}</span>
                  <ChevronRight size={18} style={{ opacity: 0.5 }} />
                </button>
                <button className="rsm-mob-list-item" onClick={() => { setMobileScreen('media'); setActiveTab('media'); }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Zap size={18} color="var(--brand-1-light)" /> {t('mediaPlayerTab', 'Media Player')}</span>
                  <ChevronRight size={18} style={{ opacity: 0.5 }} />
                </button>
                <button className="rsm-mob-list-item" onClick={() => { setMobileScreen('security'); setActiveTab('security'); }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Shield size={18} color="var(--brand-1-light)" /> {t('securityTab', 'Security')}</span>
                  <ChevronRight size={18} style={{ opacity: 0.5 }} />
                </button>
              </div>
            )}
            {/* Mobile: back button for sub-screens */}
            {isMobile && mobileScreen !== 'list' && (
              <button className="rsm-mob-back" onClick={() => setMobileScreen('list')}>
                <ChevronLeft size={18} /> {t('back', 'Back')}
              </button>
            )}
            {/* Tab content — hidden on mobile list screen */}
            {(!isMobile || mobileScreen !== 'list') && (
            <>{activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Room Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>{t('roomNameLabel', 'Room Name')}</label>
                  <input 
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    style={{ width: '100%', padding: '16px 20px', background: isLight ? '#fff' : 'rgba(0,0,0,0.3)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(var(--brand-2-rgb), 0.2)', borderRadius: 16, color: isLight ? '#000' : '#fff', fontSize: 15, outline: 'none', transition: 'all 0.3s' }}
                    placeholder={t('enterRoomName', 'Enter room name...')}
                    onFocus={e => { e.target.style.borderColor = 'var(--brand-2)'; e.target.style.boxShadow = '0 0 15px rgba(var(--brand-2-rgb), 0.2)'; e.target.style.background = 'rgba(0,0,0,0.4)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(var(--brand-2-rgb), 0.2)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(0,0,0,0.3)'; }}
                  />
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>{t('visibleOnceSaved', 'Visible across the platform once saved.')}</p>
                </div>

                {/* Thumbnail */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isLight ? 'var(--brand-1-dark)' : 'var(--brand-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '1px' }}>{t('roomThumbnailLabel', 'Room Thumbnail')}</label>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ width: 160, height: 100, borderRadius: 18, background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.3)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-2-rgb), 0.2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 10px 30px rgba(0,0,0,0.3)' }}>
                      {thumbnail ? (
                        <img src={getRoomThumbnailUrl(thumbnail)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={24} color="#333" />
                      )}
                      {isUploading && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 20, height: 20, border: '2px solid transparent', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="file" 
                        id="thumb-upload" 
                        hidden 
                        accept="image/*" 
                        onChange={handleFileSelect} 
                      />
                      <label htmlFor="thumb-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: isLight ? '#fff' : 'rgba(255,255,255,0.05)', borderRadius: 10, color: isLight ? '#334155' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)' }}>
                        <Camera size={16} /> {t('chooseNew', 'Choose New')}
                      </label>
                      <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#555', marginTop: 10, lineHeight: 1.4 }}>{t('recommendedSizeInfo', 'Recommended size: 1200x800px. JPG or PNG.')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Custom Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#fff', marginBottom: 10 }}>{t('mediaPlayerName', 'Media Player Name')}</label>
                  <input 
                    value={settings.playerCustomName}
                    onChange={e => setSettings({...settings, playerCustomName: e.target.value})}
                    style={{ width: '100%', padding: '12px 14px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: isLight ? '#000' : '#fff', outline: 'none' }}
                  />
                </div>

                {/* Audio Ducking */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', borderRadius: 16, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-1-light)', flexShrink: 0 }}>
                        <Volume2 size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#000' : '#fff', margin: 0 }}>{t('audioDucking', 'Audio Ducking')}</h4>
                        <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#6b7280', margin: '4px 0 0' }}>{t('audioDuckingDesc', 'When someone with their mic on speaks, media volume lowers for everyone in the room.')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, audioDucking: !s.audioDucking }))}
                      style={{ width: 44, height: 24, borderRadius: 12, background: settings.audioDucking ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : '#333'), border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                    >
                      <div style={{ position: 'absolute', top: 3, left: settings.audioDucking ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }}></div>
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: isLight ? '#94a3b8' : '#4b5563', margin: 0, paddingLeft: 54 }}>{t('audioDuckingNote', 'Uses your microphone only while your Mic is turned on. No mic access happens just from enabling this setting.')}</p>
                </div>

                {/* Enable Player Controls for All Users */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', borderRadius: 16, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--brand-1-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-1-light)', flexShrink: 0 }}>
                        <Settings2 size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#000' : '#fff', margin: 0 }}>{t('allUsersPlayerSettings', 'Enable Player Controls for All Users')}</h4>
                        <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#6b7280', margin: '4px 0 0' }}>{t('allUsersPlayerSettingsDesc', 'Allow any user in the room to play/pause, seek, load media, and upload subtitles.')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, allUsersPlayerSettings: !s.allUsersPlayerSettings }))}
                      style={{ width: 44, height: 24, borderRadius: 12, background: settings.allUsersPlayerSettings ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : '#333'), border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                    >
                      <div style={{ position: 'absolute', top: 3, left: settings.allUsersPlayerSettings ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }}></div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Access Management */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('accessManagement', 'Access Management')}</label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Lock Room Toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 20px', background: isLight ? '#fff' : 'rgba(var(--brand-2-rgb), 0.04)', borderRadius: 16, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-2-rgb), 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Lock size={18} color="var(--brand-2)" />
                          <span style={{ fontSize: 13, color: isLight ? '#1e293b' : '#eee', fontWeight: 700 }}>{t('lockRoom', 'Lock Room')}</span>
                        </div>
                        <button 
                          onClick={() => setSettings({...settings, lockRoom: !settings.lockRoom})}
                          style={{ width: 32, height: 16, borderRadius: 8, background: settings.lockRoom ? 'var(--brand-2)' : (isLight ? '#cbd5e1' : '#333'), border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: settings.lockRoom ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }}></div>
                        </button>
                      </div>
                      <div style={{ paddingLeft: 30 }}>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{t('lockRoomDesc', 'Require host approval to join')}</span>
                      </div>
                    </div>

                    {/* Logged In Only Toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 20px', background: isLight ? '#fff' : 'rgba(59, 130, 246, 0.04)', borderRadius: 16, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(59, 130, 246, 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <UserCheck size={18} color="#3b82f6" />
                          <span style={{ fontSize: 13, color: isLight ? '#1e293b' : '#eee', fontWeight: 700 }}>{t('membersOnly', 'Members Only')}</span>
                        </div>
                        <button 
                          onClick={() => setSettings({...settings, onlyLoggedIn: !settings.onlyLoggedIn})}
                          style={{ width: 32, height: 16, borderRadius: 8, background: settings.onlyLoggedIn ? '#3b82f6' : (isLight ? '#cbd5e1' : '#333'), border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: settings.onlyLoggedIn ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }}></div>
                        </button>
                      </div>
                      <div style={{ paddingLeft: 30 }}>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{t('membersOnlyDesc', 'Only logged-in users enter')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Privileges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('adminPrivileges', 'Admin Privileges')}</label>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 24px', background: isLight ? '#f8fafc' : 'rgba(16, 185, 129, 0.04)', borderRadius: 16, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(16, 185, 129, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <Shield size={20} color="#10b981" />
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#000' : '#fff', margin: 0 }}>{t('autoAdminMembers', 'Auto-Admin Members')}</h4>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, newMembersAdmins: !settings.newMembersAdmins})}
                        style={{ width: 44, height: 24, borderRadius: 12, background: settings.newMembersAdmins ? '#10b981' : (isLight ? '#cbd5e1' : '#333'), border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div style={{ position: 'absolute', top: 3, left: settings.newMembersAdmins ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }}></div>
                      </button>
                    </div>
                    <div style={{ paddingLeft: 34 }}>
                      <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#6b7280', margin: 0 }}>{t('autoAdminMembersDesc', 'Give new members admin permissions by default')}</p>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#fff' }}>{t('permissions', 'Permissions')}</label>
                  
                  {[
                    { id: 'chat', label: t('whoCanSendMessages', 'Who can send messages?'), icon: Zap },
                    { id: 'cam', label: t('whoCanUseWebcam', 'Who can use webcam?'), icon: Video },
                    { id: 'mic', label: t('whoCanUseMicrophone', 'Who can use microphone?'), icon: Mic },
                  ].map(p => {
                    const val = permissions[p.id] || 'all';
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: isLight ? '#f8fafc' : 'rgba(var(--brand-2-rgb), 0.04)', borderRadius: 16, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(var(--brand-2-rgb), 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                           <p.icon size={16} color="var(--brand-2)" />
                           <span style={{ fontSize: 13, color: isLight ? '#1e293b' : '#eee', fontWeight: 500 }}>{p.label}</span>
                        </div>
                        <div style={{ display: 'flex', background: isLight ? '#e2e8f0' : 'rgba(10, 5, 25, 0.6)', padding: 4, borderRadius: 10 }}>
                          {['all', 'host'].map(v => (
                            <button 
                              key={v}
                              onClick={() => setPermissions({...permissions, [p.id]: v})}
                              style={{ padding: '6px 16px', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 800, cursor: 'pointer', background: val === v ? 'linear-gradient(135deg, var(--brand-1), var(--brand-2))' : 'transparent', color: val === v ? (isLight ? '#fefefe' : '#fff') : (isLight ? '#000' : '#555'), transition: 'all 0.3s' }}
                            >
                              {v === 'all' ? t('allLabel', 'ALL') : t('hostOnlyLabel', 'HOST ONLY')}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Filtering */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#fff' }}>{t('messagingControls', 'Messaging Controls')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { id: 'allowLinks', label: t('allowLinks', 'Allow Links'), icon: Link2 },
                      { id: 'allowMedia', label: t('allowMedia', 'Allow Media'), icon: ImageIcon },
                    ].map(f => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)', borderRadius: 14, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <f.icon size={14} color={isLight ? '#64748b' : '#888'} />
                          <span style={{ fontSize: 12, color: isLight ? '#334155' : '#bbb' }}>{f.label}</span>
                        </div>
                        <button 
                          onClick={() => setPermissions({...permissions, [f.id]: permissions[f.id] === false ? true : false})}
                          style={{ width: 32, height: 16, borderRadius: 8, background: permissions[f.id] !== false ? 'var(--brand-1)' : (isLight ? '#cbd5e1' : '#333'), border: 'none', position: 'relative', cursor: 'pointer' }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: permissions[f.id] !== false ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: '0.2s' }}></div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ban Management */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                       <ShieldAlert size={16} color="#ef4444" />
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#fff', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                           {t('securityBannedUsers', 'Security Banned Users')} {bannedUsers.length > 0 ? `(${bannedUsers.length})` : ''}
                        </label>
                       <button 
                         onClick={() => socket.emit('mod_fetch_bans', { roomId })}
                         style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--brand-2)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                       >
                         <Zap size={12} /> {t('syncNow', 'Sync Now')}
                       </button>
                    </div>
                   <div style={{ padding: '24px 28px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', borderRadius: 18, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.05)', minHeight: 140 }}>
                       {bannedUsers.length > 0 ? (
                         bannedUsers.map(uname => (
                           <BannedUserItem 
                             key={uname} 
                             uname={uname} 
                             socket={socket} 
                             roomId={roomId} 
                             onUnban={(u) => setBannedUsers(prev => prev.filter(x => x !== u))} 
                           />
                         ))
                       ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, gap: 14 }}>
                          <UserMinus size={36} color="#555" />
                          <div style={{ textAlign: 'center', color: '#777', fontSize: 14, fontWeight: 500 }}>{t('noBannedUsers', 'No users are banned from this room.')}</div>
                        </div>
                      )}
                   </div>
                </div>

                {/* Danger Zone */}
                <div style={{ marginTop: 24, padding: 32, borderRadius: 16, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.1)' }}>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <ShieldAlert color="#ef4444" size={28} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dangerZone', 'Danger Zone')}</h4>
                      <p style={{ fontSize: 13, color: isLight ? '#991b1b' : '#fca5a5', margin: '8px 0 20px', lineHeight: 1.6 }}>
                        {t('dangerZoneDesc', 'Deleting this room is a permanent action. All metadata, pinned status, and chat messages hosted here will be destroyed.')}
                      </p>
                      <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="stay-white"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#ef4444', border: 'none', borderRadius: 10, color: '#ffffff !important', fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(239, 68, 68, 0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)'; }}
                      >
                        <Trash2 size={18} color="#ffffff" className="stay-white" /> <span style={{ color: '#ffffff' }} className="stay-white">{t('deleteForever', 'Delete Forever')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </> )}
          </div>
        </div>

        <div style={{ padding: '24px 30px', borderTop: isLight ? '1px solid #f1f5f9' : '1px solid rgba(var(--brand-2-rgb), 0.15)', display: 'flex', justifyContent: 'flex-end', gap: 16, background: isLight ? '#f8fafc' : 'rgba(15, 10, 35, 0.2)', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <button onClick={onClose} style={{ padding: '14px 28px', background: isLight ? '#fff' : 'rgba(255, 255, 255, 0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.15)', borderRadius: 16, color: isLight ? '#000' : '#eee', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.borderColor = isLight ? '#94a3b8' : 'rgba(255,255,255,0.3)'; }} onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#fff' : 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'; }}>{t('cancel', 'Cancel')}</button>
          <button onClick={handleSave} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', border: 'none', borderRadius: 16, color: isLight ? '#fefefe' : '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isLight ? 'none' : '0 10px 25px rgba(var(--brand-1-rgb), 0.4)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; if (!isLight) e.currentTarget.style.boxShadow = '0 10px 25px rgba(var(--brand-1-rgb), 0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isLight ? 'none' : '0 10px 25px rgba(var(--brand-1-rgb), 0.4)'; }}>{t('saveChanges', 'Save Changes')}</button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .modal-enter { animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      {/* Cropper Overlay */}
      {showCropper && (
        <div onClick={e => e.stopPropagation()} className="room-modals-overlay" style={{ position: 'fixed', inset: 0, zIndex: 20000, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="modal-enter" style={{ background: isLight ? '#fff' : '#140c21', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 640, boxShadow: isLight ? '0 30px 80px rgba(0,0,0,0.1)' : '0 40px 100px rgba(0,0,0,0.8)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 800, color: isLight ? '#000' : '#fff' }}>{t('cropThumbnail', 'Crop Thumbnail')}</h3>
            
            <div style={{ position: 'relative', width: '100%', height: 350, background: '#111', borderRadius: 16, overflow: 'hidden' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={3 / 2}
                // react-easy-crop defaults to objectFit="contain" — at zoom 1
                // that fits the WHOLE image inside the crop frame without
                // ever filling it, so any image whose aspect ratio doesn't
                // already roughly match 3:2 (a tall screenshot, an ID-card
                // photo, etc.) rendered tiny and letterboxed instead of
                // covering the fixed crop grid. "cover" always scales the
                // image to fill the frame first — cropping/zooming from
                // there, same as every other app's photo cropper — so the
                // saved thumbnail is always an actual crop of the frame, not
                // whatever the original image's own proportions happened to be.
                objectFit="cover"
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Zoom Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)', padding: '12px 20px', borderRadius: 100, border: isLight ? '1px solid #e2e8f0' : 'none' }}>
                <ZoomOut size={18} color="#888" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--brand-2)' }}
                />
                <ZoomIn size={18} color="#888" />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => { setShowCropper(false); setImageSrc(null); }}
                  style={{ flex: 1, padding: '14px', borderRadius: 14, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)', border: isLight ? '1px solid #e2e8f0' : 'none', color: isLight ? '#000' : '#fff', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button 
                  onClick={handleConfirmCrop}
                  disabled={isUploading}
                  style={{ flex: 2, padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg, var(--brand-1), var(--brand-2))', border: 'none', color: isLight ? '#fefefe' : '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: isUploading ? 0.7 : 1, transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {isUploading ? t('uploading', 'Uploading...') : <><Save size={18} /> {t('applyAndSave', 'Apply & Save')}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div className="room-modals-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1100000, background: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="modal-enter" style={{ position: 'relative', background: isLight ? '#ffffff' : '#1a1025', border: isLight ? '1px solid #fecaca' : '1px solid rgba(239,68,68,0.25)', borderRadius: 28, width: '100%', maxWidth: 420, padding: 32, boxShadow: isLight ? '0 20px 60px rgba(0,0,0,0.14)' : '0 25px 50px rgba(0,0,0,0.6)' }}>
            {/* X close button */}
            <button
              onClick={() => { setShowDeleteConfirm(false); setIsDeleteConfirmed(false); }}
              style={{ position: 'absolute', top: 16, right: 16, background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: isLight ? '#6b7280' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = isLight ? '#374151' : '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = isLight ? '#6b7280' : '#888'; }}
            >
              <X size={16} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
              <div style={{ width: 72, height: 72, borderRadius: '24px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginBottom: 8, transform: 'rotate(-5deg)' }}>
                <Trash2 size={36} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: isLight ? '#111827' : '#fff', margin: 0, letterSpacing: '-0.5px' }}>{t('deleteRoomQuestion', 'Delete this room?')}</h3>
              <p style={{ fontSize: 15, color: isLight ? '#6b7280' : '#aaa', lineHeight: 1.6, margin: 0 }}>
                {t('deleteRoomWarningText', 'This is a permanent action. All chats, history, and room metadata will be destroyed forever.')}
              </p>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                width: '100%',
                marginTop: 12,
                padding: '14px 16px',
                background: isLight ? (isDeleteConfirmed ? '#fff0f0' : '#fef2f2') : 'rgba(239,68,68,0.05)',
                borderRadius: 16,
                cursor: 'pointer',
                textAlign: 'left',
                border: isDeleteConfirmed ? '1px solid rgba(239,68,68,0.4)' : (isLight ? '1px solid #fecaca' : '1px solid transparent'),
                transition: 'all 0.2s'
              }}>
                <input
                  type="checkbox"
                  checked={isDeleteConfirmed}
                  onChange={e => setIsDeleteConfirmed(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: isLight ? (isDeleteConfirmed ? '#374151' : '#6b7280') : (isDeleteConfirmed ? '#eee' : '#bbb'), fontWeight: 500, lineHeight: 1.4 }}>
                  {t('deleteRoomAcknowledgeCheckbox', 'I understand that all chats and room data will be permanently deleted.')}
                </span>
              </label>

              <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 12 }}>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setIsDeleteConfirmed(false); }}
                  style={{ flex: 1, padding: '16px 0', borderRadius: 16, border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)', background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.03)', color: isLight ? '#374151' : '#ccc', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14 }}
                  onMouseEnter={e => e.currentTarget.style.background = isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = isLight ? '#f3f4f6' : 'rgba(255,255,255,0.03)'}
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDeleteRoom}
                  disabled={!isDeleteConfirmed}
                  className="stay-white"
                  style={{
                    flex: 1,
                    padding: '16px 0',
                    borderRadius: 16,
                    border: 'none',
                    background: isDeleteConfirmed ? 'linear-gradient(135deg, #ef4444, #f43f5e)' : (isLight ? '#fca5a5' : '#333'),
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: isDeleteConfirmed ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s',
                    opacity: isDeleteConfirmed ? 1 : 0.6
                  }}
                  onMouseEnter={e => { if(isDeleteConfirmed) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(239,68,68,0.35)'; } }}
                  onMouseLeave={e => { if(isDeleteConfirmed) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  {t('deleteRoomButton', 'Delete Room')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}






