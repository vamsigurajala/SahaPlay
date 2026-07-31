import React from 'react';
import { X, ChevronLeft, ChevronRight, Download, MoreVertical, Trash2 } from 'lucide-react';

const SWIPE_THRESHOLD = 50;

// Shared image/video lightbox — used by chat (RoomChatPanel) and Admin (Reports / Support ticket attachments).
// items: [{ url, type, filename?, expiresAt?, isMe?, id? }]
// onDeleteItem?: (item, mode) => void — mode is 'global' (unsend/everyone) or 'local' (delete for me).
// Passing onDeleteItem opts a caller into the per-item 3-dot menu; omit it (as Admin.jsx does) for a read-only viewer.
export default function MediaLightbox({ items, index, onClose, onPrev, onNext, onDeleteItem }) {
  const item = items?.[index];
  const url = item?.url;
  const type = item?.type;
  const isImg = type?.startsWith('image/');
  const isVid = type?.startsWith('video/');
  const hasMultiple = items?.length > 1;
  const [showItemMenu, setShowItemMenu] = React.useState(false);
  const touchRef = React.useRef({ x: 0, y: 0, active: false });

  React.useEffect(() => { setShowItemMenu(false); }, [index]);

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

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY, active: true };
  };
  const handleTouchMove = (e) => {
    // No-op — direction/threshold is all resolved on touchend from the start point,
    // matching the simple swipe-to-reply pattern used elsewhere in chat.
  };
  const handleTouchEnd = (e) => {
    const s = touchRef.current;
    if (!s.active) return;
    s.active = false;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - s.x;
    const deltaY = touch.clientY - s.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return; // vertical drag — ignore
    if (deltaX > SWIPE_THRESHOLD && hasMultiple && index > 0) onPrev?.();
    else if (deltaX < -SWIPE_THRESHOLD && hasMultiple && index < items.length - 1) onNext?.();
  };

  const expiryDaysLeft = item?.expiresAt ? Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const showExpiry = expiryDaysLeft !== null && expiryDaysLeft > 0;

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            <button onClick={handleDownload} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', color: '#111', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#111', display: 'flex' }}><Download size={14} /></span> Save
            </button>
            {onDeleteItem && (
              <button onClick={e => { e.stopPropagation(); setShowItemMenu(v => !v); }} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 8px', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#111', display: 'flex' }}><MoreVertical size={16} /></span>
              </button>
            )}
            <button onClick={onClose} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', color: '#111', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#111', display: 'flex' }}><X size={16} /></span>
            </button>
            {showItemMenu && onDeleteItem && (
              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#1e1e1e', border: '1px solid #333', borderRadius: 10, padding: 6, minWidth: 150, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {item.isMe && (
                  <button onClick={() => { setShowItemMenu(false); onDeleteItem(item, 'global'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px 10px', fontSize: 13, borderRadius: 6 }}>
                    <Trash2 size={14} /> Unsend
                  </button>
                )}
                <button onClick={() => { setShowItemMenu(false); onDeleteItem(item, 'local'); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', color: '#eee', cursor: 'pointer', padding: '8px 10px', fontSize: 13, borderRadius: 6 }}>
                  <Trash2 size={14} /> {item.isMe ? 'Delete for me' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Media area */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#000', minHeight: 200 }}
        >
          {isImg ? (
            <img src={url} alt="Media" draggable={false} onContextMenu={e => e.preventDefault()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} />
          ) : isVid ? (
            <video src={url} controls autoPlay onContextMenu={e => e.preventDefault()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
          ) : null}

          {showExpiry && (
            <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '4px 8px', backdropFilter: 'blur(4px)' }}>
              Expires in {expiryDaysLeft} day{expiryDaysLeft !== 1 ? 's' : ''}
            </div>
          )}

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
