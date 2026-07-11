import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hash, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { API } from '../lib/api';

const CLOSE_DURATION = 220; // ms — must match CSS animation duration

const CreateRoomModal = ({ isOpen, onClose, loggedInUsername }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [visible, setVisible]             = useState(false);
  const [isClosing, setIsClosing]         = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState('');
  const [newRoomName, setNewRoomName]     = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('movies');
  const [newRoomPublic, setNewRoomPublic] = useState(false);
  const [idCopied, setIdCopied]           = useState(false);

  /* ── open / close lifecycle ── */
  useEffect(() => {
    if (isOpen) {
      setPendingRoomId(Math.random().toString(36).substring(2, 8));
      setNewRoomName('');
      setNewRoomCategory('movies');
      setNewRoomPublic(false);
      setIdCopied(false);
      setIsClosing(false);
      setVisible(true);
      document.body.style.overflow = 'hidden';
    } else if (visible && !isClosing) {
      // Trigger exit animation then unmount
      setIsClosing(true);
      document.body.style.overflow = 'unset';
      const t = setTimeout(() => {
        setVisible(false);
        setIsClosing(false);
      }, CLOSE_DURATION);
      return () => clearTimeout(t);
    }
  }, [isOpen]); // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => { document.body.style.overflow = 'unset'; }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    onClose();
  }, [isClosing, onClose]);

  const handleLaunchRoom = async () => {
    const name = newRoomName.trim() || 'Room Chat';
    handleClose();
    try {
      const response = await fetch(`${API}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('watch_token')}`
        },
        body: JSON.stringify({
          roomId: pendingRoomId,
          roomName: name,
          category: newRoomCategory,
          isPublic: newRoomPublic,
        })
      });
      if (!response.ok) toast.error(t('roomCreateFailed', 'Failed to create room metadata'));
    } catch (e) {
      console.error('Room create API error:', e);
      toast.error(t('roomCreateNetworkError', 'Network error during room creation'));
    }
    navigate(`/room/${pendingRoomId}`);
  };

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (!visible) return null;

  return (
    <div
      className={`cr-overlay${isClosing ? ' cr-overlay--closing' : ''}`}
      onClick={handleClose}
    >
      {/* ── Self-contained styles — works on any page ── */}
      <style>{`
        .cr-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 99999;
          overflow-y: auto;
          padding: 40px 16px;
          overscroll-behavior: contain;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          animation: crOverlayIn ${CLOSE_DURATION}ms ease forwards;
        }
        .cr-overlay--closing {
          animation: crOverlayOut ${CLOSE_DURATION}ms ease forwards;
        }
        @keyframes crOverlayIn  { from { opacity: 0; } to   { opacity: 1; } }
        @keyframes crOverlayOut { from { opacity: 1; } to   { opacity: 0; } }

        .cr-modal {
          background: #13131f;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 32px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.85);
          position: relative;
          animation: crModalIn ${CLOSE_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          will-change: transform, opacity;
        }
        .cr-overlay--closing .cr-modal {
          animation: crModalOut ${CLOSE_DURATION}ms cubic-bezier(0.4, 0, 1, 1) forwards;
        }
        @keyframes crModalIn  {
          from { transform: translateY(32px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes crModalOut {
          from { transform: translateY(0)    scale(1);    opacity: 1; }
          to   { transform: translateY(24px) scale(0.97); opacity: 0; }
        }

        .cr-close-btn {
          position: absolute; top: 0; right: -56px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%; width: 44px; height: 44px;
          cursor: pointer; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; line-height: 1;
          transition: background 0.2s, transform 0.2s;
        }
        .cr-close-btn:hover { background: rgba(255,255,255,0.18); transform: scale(1.1) rotate(90deg); }

        .cr-modal-header {
          margin-bottom: 28px;
        }

        .cr-id-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 12px;
          padding: 12px 16px;
        }

        .cr-input {
          width: 100%; padding: 12px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; color: #fff;
          font-size: 15px; outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .cr-input:focus { border-color: rgba(99,102,241,0.7); background: rgba(255,255,255,0.08); }
        .cr-input option { background: #1a1a2e; }

        .cr-cat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 8px; }
        .cr-cat-btn {
          padding: 10px 6px; border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04); color: #aaa;
          font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; text-align: center;
        }
        .cr-cat-btn:hover { border-color: rgba(99,102,241,0.4); color: #fff; background: rgba(99,102,241,0.08); }
        .cr-cat-btn.active { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.7); color: #a5b4fc; }

        .cr-toggle-row {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: 14px;
          border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
        }
        .cr-toggle-row:hover { border-color: rgba(99,102,241,0.35); background: rgba(99,102,241,0.04); }
        .cr-toggle-track {
          width: 42px; height: 24px; border-radius: 999px;
          transition: background 0.3s; position: relative; flex-shrink: 0;
        }
        .cr-toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }

        .cr-launch-btn {
          width: 100%; padding: 14px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff;
          font-size: 16px; font-weight: 700; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s; letter-spacing: 0.3px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .cr-launch-btn:hover { transform: scale(1.02); box-shadow: 0 8px 28px rgba(168,85,247,0.5); }
        .cr-launch-btn:active { transform: scale(0.99); }

        .cr-copy-btn {
          margin-left: auto; flex-shrink: 0;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc;
          padding: 4px 12px; border-radius: 8px;
          font-size: 11px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.5px; transition: all 0.2s;
        }
        .cr-copy-btn:hover { background: rgba(99,102,241,0.28); }
        .cr-copy-btn.copied {
          background: #10b981 !important;
          border-color: #10b981 !important;
          color: #ffffff !important;
        }

        /* ── Light Mode ── */
        html[data-theme='light'] .cr-overlay { background: rgba(0,0,0,0.38); }
        html[data-theme='light'] .cr-modal { background: #fff; border-color: rgba(0,0,0,0.09); box-shadow: 0 32px 80px rgba(0,0,0,0.14); }
        html[data-theme='light'] .cr-modal h2 { color: #0f172a !important; }
        html[data-theme='light'] .cr-modal p  { color: #334155 !important; }
        html[data-theme='light'] .cr-modal label { color: #1e293b !important; font-weight: 800 !important; }
        html[data-theme='light'] .cr-input { background: #f8fafc; border-color: #e2e8f0; color: #0f172a; }
        html[data-theme='light'] .cr-input:focus { border-color: #6366f1; background: #fff; }
        html[data-theme='light'] .cr-cat-btn { background: #f1f5f9; border-color: #e2e8f0; color: #334155; }
        html[data-theme='light'] .cr-cat-btn:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.06); }
        html[data-theme='light'] .cr-cat-btn.active { background: rgba(99,102,241,0.1); border-color: #6366f1; color: #4f46e5; }
        html[data-theme='light'] .cr-toggle-row { background: #f8fafc; border-color: #e2e8f0; }
        html[data-theme='light'] .cr-toggle-row:hover { border-color: #cbd5e1; background: #f1f5f9; }
        html[data-theme='light'] .cr-toggle-row .toggle-label { color: #0f172a !important; }
        html[data-theme='light'] .cr-toggle-row .toggle-desc  { color: #334155 !important; }
        html[data-theme='light'] .cr-copy-btn { background: #f1f5f9; border-color: #cbd5e1; color: #4f46e5; }
        html[data-theme='light'] .cr-copy-btn:hover { background: #e2e8f0; }
        html[data-theme='light'] .cr-close-btn { background: #f1f5f9; border-color: #e2e8f0; color: #64748b; }
        html[data-theme='light'] .cr-close-btn:hover { background: #e2e8f0; color: #1e293b; }
        html[data-theme='light'] .cr-launch-btn { color: #fff !important; box-shadow: 0 4px 16px rgba(99,102,241,0.25); }
        html[data-theme='light'] .cr-id-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }

        /* ── Tablet & Mobile View ── */
        @media (max-width: 1023px) {
          .cr-modal {
            max-width: 400px !important;
            padding: 20px !important;
            border-radius: 20px !important;
          }
          .cr-close-btn {
            position: absolute !important;
            top: 14px !important;
            right: 14px !important;
            width: 32px !important;
            height: 32px !important;
            font-size: 18px !important;
          }
          .cr-modal-header {
            padding-right: 36px !important;
            margin-bottom: 20px !important;
          }
          .cr-id-box {
            padding: 8px 12px !important;
          }
          .cr-input {
            padding: 10px 14px !important;
            font-size: 14px !important;
          }
          .cr-cat-grid {
            gap: 8px !important;
            margin-top: 6px !important;
          }
          .cr-cat-btn {
            padding: 8px 4px !important;
            font-size: 12px !important;
            border-radius: 10px !important;
          }
          .cr-toggle-row {
            padding: 10px 12px !important;
            border-radius: 12px !important;
          }
          .cr-launch-btn {
            padding: 12px !important;
            font-size: 15px !important;
            border-radius: 12px !important;
          }
        }
      `}</style>

      <div className="cr-modal" onClick={e => e.stopPropagation()}>
        {/* ✕ Close button */}
        <button className="cr-close-btn" onClick={handleClose} aria-label={t('close', 'Close')}>×</button>

        {/* Header */}
        <div className="cr-modal-header">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: isLight ? '#0f172a' : '#fff', letterSpacing: '-0.5px' }}>
            {t('createRoomTitle', 'Create a Room')}
          </h2>
          <p style={{ margin: '4px 0 0', color: isLight ? '#475569' : '#6b7280', fontSize: 13 }}>
            {t('setupWatchPartyDesc', 'Set up your watch party below')}
          </p>
        </div>

        {/* Room ID */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
            {t('roomIdLabel', 'Room ID (auto-generated)')}
          </label>
          <div className="cr-id-box">
            <Hash size={15} color="#6366f1" />
            <span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, color: isLight ? '#4338ca' : '#a5b4fc', letterSpacing: '2px' }}>
              {pendingRoomId}
            </span>
            <button
              className={`cr-copy-btn${idCopied ? ' copied' : ''}`}
              onClick={() => navigator.clipboard.writeText(pendingRoomId).then(() => {
                setIdCopied(true);
                setTimeout(() => setIdCopied(false), 2000);
              })}
            >
              {idCopied ? t('copied', '✓ Copied!') : t('copyId', 'Copy ID')}
            </button>
          </div>
        </div>

        {/* Room Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
            {t('roomNameLabel', 'Room Name')}
          </label>
          <input
            className="cr-input"
            type="text"
            placeholder={t('roomNamePlaceholder', 'e.g. Friday Night Movies 🍿')}
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
            {t('categoryLabel', 'Category')}
          </label>
          <div className="cr-cat-grid">
            {[
              { id: 'movies', label: `🎬 ${t('catMovies', 'Movies')}` },
              { id: 'anime',  label: `⛩️ ${t('catAnime',  'Anime')}` },
              { id: 'songs',  label: `🎵 ${t('catMusic',  'Music')}` },
              { id: 'gaming', label: `🎮 ${t('catGaming', 'Gaming')}` },
              { id: 'sports', label: `⚽ ${t('catSports', 'Sports')}` },
              { id: 'other',  label: `✨ ${t('catOther',  'Other')}` },
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

        {/* Visibility Toggle */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#6b7280', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
            {t('visibilityLabel', 'Visibility')}
          </label>
          <div className="cr-toggle-row" onClick={() => setNewRoomPublic(p => !p)}>
            <div className="cr-toggle-track" style={{ background: newRoomPublic ? 'linear-gradient(135deg,#6366f1,#a855f7)' : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)') }}>
              <div className="cr-toggle-thumb" style={{ transform: newRoomPublic ? 'translateX(18px)' : 'translateX(0)', boxShadow: isLight ? '0 2px 4px rgba(0,0,0,0.12)' : 'none' }} />
            </div>
            <div>
              <div className="toggle-label" style={{ fontWeight: 700, color: isLight ? '#0f172a' : '#fff', fontSize: 14 }}>
                {newRoomPublic ? t('publicRoom', '🌐 Public Room') : t('privateRoom', '🔒 Private Room')}
              </div>
              <div className="toggle-desc" style={{ color: isLight ? '#475569' : '#6b7280', fontSize: 12, marginTop: 2 }}>
                {newRoomPublic ? t('publicRoomDesc', 'Anyone can find and join this room') : t('privateRoomDesc', 'Only people with the Room ID can join')}
              </div>
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <button className="cr-launch-btn" onClick={handleLaunchRoom}>
          <Play size={16} fill="#fff" strokeWidth={0} />
          {t('launchRoom', 'Launch Room')}
        </button>
      </div>
    </div>
  );
};

export default CreateRoomModal;
