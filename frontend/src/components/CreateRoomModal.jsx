import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Play } from 'lucide-react';
import toast from 'react-hot-toast';

const API = 'http://localhost:3001';

const CreateRoomModal = ({ isOpen, onClose, loggedInUsername }) => {
  const navigate = useNavigate();
  const [pendingRoomId, setPendingRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('movies');
  const [newRoomPublic, setNewRoomPublic] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  // Initialize room ID when modal opens
  useEffect(() => {
    if (isOpen) {
      setPendingRoomId(Math.random().toString(36).substring(2, 8));
      setNewRoomName('');
      setNewRoomCategory('movies');
      setNewRoomPublic(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleLaunchRoom = async () => {
    const name = newRoomName.trim() || 'Room Chat';
    onClose(); // Close immediately for perceived speed
    
    try {
      const response = await fetch(`${API}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: pendingRoomId,
          roomName: name,
          category: newRoomCategory,
          isPublic: newRoomPublic,
          hostUsername: loggedInUsername
        })
      });
      if (!response.ok) {
        toast.error('Failed to create room metadata');
      }
    } catch(e) {
      console.error('Room create API error:', e);
      toast.error('Network error during room creation');
    }
    navigate(`/room/${pendingRoomId}`);
  };

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (!isOpen) return null;

  return (
    <div className="cr-overlay" onClick={onClose}>
      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        {/* Close Button Outside */}
        <button className="cr-close-btn" onClick={onClose}>×</button>
 
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px' }}>Create a Room</h2>
          <p style={{ margin: '4px 0 0', color: isLight ? '#475569' : '#6b7280', fontSize: 13 }}>Set up your watch party below</p>
        </div>

        {/* Room ID (read-only) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Room ID (auto-generated)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isLight ? '#f8fafc' : 'rgba(99,102,241,0.08)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '12px 16px' }}>
            <Hash size={15} color="#6366f1" />
            <span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, color: isLight ? '#4338ca' : '#a5b4fc', letterSpacing: '2px' }}>{pendingRoomId}</span>
            <button
              className={`cr-copy-btn${idCopied ? ' copied' : ''}`}
              onClick={() => {
                navigator.clipboard.writeText(pendingRoomId).then(() => {
                  setIdCopied(true);
                  setTimeout(() => setIdCopied(false), 2000);
                });
              }}
            >{idCopied ? '✓ Copied!' : 'Copy ID'}</button>
          </div>
        </div>

        {/* Room Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Room Name</label>
          <input
            className="cr-input"
            type="text"
            placeholder="e.g. Friday Night Movies 🍿"
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Category</label>
          <div className="cr-cat-grid">
            {[
              { id: 'movies', label: '🎬 Movies' },
              { id: 'anime', label: '⛩️ Anime' },
              { id: 'songs', label: '🎵 Music' },
              { id: 'gaming', label: '🎮 Gaming' },
              { id: 'sports', label: '⚽ Sports' },
              { id: 'other', label: '✨ Other' },
            ].map(cat => (
              <button
                key={cat.id}
                className={`cr-cat-btn${newRoomCategory === cat.id ? ' active' : ''}`}
                onClick={() => setNewRoomCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Public / Private Toggle */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Visibility</label>
          <div className="cr-toggle-row" onClick={() => setNewRoomPublic(p => !p)}>
            <div className="cr-toggle-track" style={{ background: newRoomPublic ? 'linear-gradient(135deg,#6366f1,#a855f7)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)') }}>
              <div className="cr-toggle-thumb" style={{ transform: newRoomPublic ? 'translateX(18px)' : 'translateX(0)', background: '#fff', boxShadow: isLight ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }} />
            </div>
            <div>
              <div className="toggle-label" style={{ fontWeight: 700, color: isLight ? '#0f172a' : '#fff', fontSize: 14 }}>{newRoomPublic ? '🌐 Public Room' : '🔒 Private Room'}</div>
              <div className="toggle-desc" style={{ color: isLight ? '#475569' : '#6b7280', fontSize: 12, marginTop: 2 }}>{newRoomPublic ? 'Anyone can find and join this room' : 'Only people with the Room ID can join'}</div>
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <button className="cr-launch-btn" onClick={handleLaunchRoom}>
          <Play size={16} fill="#fff" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#fff' }} />
          Launch Room
        </button>
      </div>
    </div>
  );
};

export default CreateRoomModal;





