import React from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

// Shared image/video lightbox — used by chat (RoomChatPanel) and Admin (Reports / Support ticket attachments).
// items: [{ url, type, filename? }]
export default function MediaLightbox({ items, index, onClose, onPrev, onNext }) {
  const item = items?.[index];
  const url = item?.url;
  const type = item?.type;
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  const hasMultiple = items?.length > 1;

  React.useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple && index > 0) onPrev?.();
      if (e.key === 'ArrowRight' && hasMultiple && index < items.length - 1) onNext?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext, hasMultiple, index, items?.length]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!url) return;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = item.filename || (isImg ? `image_${Date.now()}.jpg` : `video_${Date.now()}.mp4`);
      a.click();
    } catch {}
  };

  if (!item) return null;

  return (
    <div
      onClick={onClose}
      className="media-lightbox-overlay gcw-force-dark"
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)'
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        className="media-lightbox-card"
        style={{
          position: 'relative',
          background: '#111',
          borderRadius: 16,
          overflow: 'hidden',
          width: 'min(640px, 92vw)',
          height: 'min(520px, 88vh)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a1a1a', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
          <span style={{ color: '#ccc', fontSize: 13, fontWeight: 600 }}>
            {item.filename || ''}{hasMultiple ? `  ${index + 1} / ${items.length}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDownload} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', color: '#111', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#111', display: 'flex' }}><Download size={14} /></span> Save
            </button>
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#111', display: 'flex' }}><X size={16} /></span>
            </button>
          </div>
        </div>

        {/* Media area */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#000', minHeight: 200 }}>
          {isImg ? (
            <img src={url} alt="Media" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain' }} />
          ) : isVid ? (
            <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
          ) : null}

          {hasMultiple && index > 0 && (
            <button onClick={e => { e.stopPropagation(); onPrev?.(); }}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
              <span style={{ color: '#fff', display: 'flex' }}><ChevronLeft size={20} /></span>
            </button>
          )}
          {hasMultiple && index < items.length - 1 && (
            <button onClick={e => { e.stopPropagation(); onNext?.(); }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
              <span style={{ color: '#fff', display: 'flex' }}><ChevronRight size={20} /></span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
