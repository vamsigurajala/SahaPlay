import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Edit2, Trash2 } from 'lucide-react';
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
  isLight = false
}) {
  const { t } = useTranslation();

  if (!renameModalOpen && !clearChatModalOpen) return null;

  // Refined overlay: Darker slate tint for premium glassmorphism
  // Using 0.25 opacity in light mode to ensure room contents are visible through the blur
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
    maxWidth: 420,
    boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)',
    animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    position: 'relative'
  };

  const modalContent = (
    <>
      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .modal-input:focus {
          border-color: #6366f1 !important;
          background: ${isLight ? '#fff' : 'rgba(255,255,255,0.02)'} !important;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15) !important;
        }
        .custom-cancel-btn {
          padding: 14px 28px;
          background: ${isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)'} !important;
          border: ${isLight ? '1px solid #e2e8f0' : 'none'} !important;
          color: #000000 !important;
          cursor: pointer;
          font-weight: 800;
          border-radius: 18px;
          font-size: 15px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .custom-cancel-btn:hover {
          transform: translateY(-2px);
          background: ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.12)'} !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        }
        .custom-save-btn {
          padding: 14px 36px;
          background: linear-gradient(135deg, #6366f1, #a855f7) !important;
          border: none !important;
          border-radius: 18px !important;
          color: #ffffff !important;
          cursor: pointer;
          font-weight: 900;
          font-size: 15px;
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3) !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .custom-save-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
          box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4) !important;
        }
        .custom-save-btn span {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }
      `}</style>

      {renameModalOpen && (
        <div style={overlayStyle} className="room-modals-overlay" onClick={() => setRenameModalOpen(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit2 size={24} color="#6366f1" />
              </div>
              <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Rename Room</h3>
            </div>
            
            <p style={{ color: isLight ? '#475569' : '#94a3b8', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
              Update your room name. This change will be visible to all members in real-time.
            </p>

            <input 
              value={renameInput} 
              onChange={e => setRenameInput(e.target.value)} 
              autoFocus 
              className="modal-input"
              style={{
                width: '100%',
                background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 18,
                padding: '18px 22px',
                color: isLight ? '#000' : '#fff',
                marginBottom: 28,
                fontSize: 16,
                outline: 'none',
                transition: 'all 0.2s'
              }} 
              placeholder="Enter new name..."
            />

            <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setRenameModalOpen(false)} 
                className="custom-cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  if(renameInput.trim()){ 
                    socket.emit('mod_rename_room', { roomId, newName: renameInput.trim() }); 
                    toast.success('Room name updated successfully');
                    setRenameModalOpen(false); 
                  } 
                }} 
                className="custom-save-btn"
              >
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {clearChatModalOpen && (
        <div style={overlayStyle} className="room-modals-overlay" onClick={() => setClearChatModalOpen(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} color="#ef4444" />
              </div>
              <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 24, fontWeight: 900 }}>Clear Chat</h3>
            </div>

            <p style={{ color: isLight ? 'rgba(0,0,0,0.6)' : '#94a3b8', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
              Are you sure you want to clear your chat history with <strong style={{ color: isLight ? '#000' : '#fff' }}>{clearChatTarget}</strong>?
            </p>

            <label style={{ 
              display: 'flex', alignItems: 'center', gap: 16, 
              color: isLight ? '#1f2937' : '#eee', fontSize: 15, 
              marginBottom: 36, cursor: 'pointer', padding: '18px',
              background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
              borderRadius: 20, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)'
            }}>
              <input 
                type="checkbox" 
                checked={clearForBoth} 
                onChange={e => setClearForBoth(e.target.checked)} 
                style={{ width: 22, height: 22, accentColor: '#ef4444', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 800 }}>Also clear history for {clearChatTarget}</span>
            </label>

            <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setClearChatModalOpen(false)} 
                className="custom-cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  socket.emit('clear_dm', { targetUsername: clearChatTarget, clearForBoth }); 
                  toast.success('Chat history cleared');
                  setClearChatModalOpen(false); 
                  setClearForBoth(false); 
                }} 
                className="custom-save-btn danger-red-btn"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)', color: '#fff' }}
              >
                <span style={{ color: '#fff' }}>Clear Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}





