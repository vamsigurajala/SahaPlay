import React from 'react';
import { X, ShieldAlert, UserMinus } from 'lucide-react';

export default function BanConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  username 
}) {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 20000, backgroundColor: isLight ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 10, 35, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        className="modal-enter"
        style={{ 
          position: 'relative', 
          background: isLight ? '#fff' : 'linear-gradient(135deg, #2d1654 0%, #150a2e 100%)', 
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(239, 68, 68, 0.3)', 
          borderRadius: 24, 
          width: '100%', 
          maxWidth: 420, 
          padding: 32,
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: isLight ? '0 30px 80px rgba(0,0,0,0.1)' : '0 40px 100px rgba(0,0,0,0.8)' 
        }}
      >
        {/* Absolute Close Button outside the modal */}
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', top: -2, right: -58, width: 44, height: 44, borderRadius: '50%', 
            background: isLight ? '#fff' : 'rgba(30, 27, 46, 0.8)', 
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.1)', 
            color: isLight ? '#000' : '#fff', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, 
            backdropFilter: 'blur(10px)', 
            boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : '0 8px 16px rgba(0,0,0,0.5)', 
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
          }} 
          onMouseEnter={e => { 
            e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(45, 41, 69, 0.9)'; 
            e.currentTarget.style.transform = 'scale(1.1)'; 
            e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(239, 68, 68, 0.4)'; 
          }} 
          onMouseLeave={e => { 
            e.currentTarget.style.background = isLight ? '#fff' : 'rgba(30, 27, 46, 0.8)'; 
            e.currentTarget.style.transform = 'scale(1)'; 
            e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'; 
          }}
        >
          <X size={22} />
        </button>

        {/* Icon */}
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginBottom: 24, boxShadow: 'inset 0 0 20px rgba(239, 68, 68, 0.1)' }}>
          <ShieldAlert size={32} />
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 22, fontWeight: 800, color: isLight ? '#000' : '#fff', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
          Ban User?
        </h3>

        {/* Description */}
        <p style={{ fontSize: 15, color: isLight ? '#64748b' : '#9ca3af', margin: '0 0 32px', lineHeight: 1.6 }}>
          Are you sure you want to ban <span style={{ color: isLight ? '#000' : '#fff', fontWeight: 700 }}>@{username}</span>? This will remove them immediately and prevent them from rejoining this room.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button 
            onClick={onClose}
            style={{ 
              flex: 1, padding: '14px', borderRadius: 14, 
              background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)', 
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', 
              color: isLight ? '#0f172a' : '#fff', 
              fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{ 
              flex: 1, 
              padding: '14px', 
              borderRadius: 14, 
              background: '#ef4444', 
              border: 'none', 
              color: 'white !important', 
              fontSize: 14,
              fontWeight: 700, 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)'; e.currentTarget.style.background = '#ff5555'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.background = '#ef4444'; }}
          >
            <UserMinus size={18} color="white" /> <span style={{ color: 'white' }}>Ban User</span>
          </button>
        </div>
      </div>

      <style>{`
        .modal-enter { animation: modalSpinIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes modalSpinIn {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}





