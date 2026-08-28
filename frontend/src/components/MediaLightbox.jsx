import React from 'react';
import { X, ChevronLeft, ChevronRight, Download, MoreVertical, Trash2 } from 'lucide-react';

const SWIPE_THRESHOLD = 50;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 24;

function distance(t1, t2) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

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
  const [showArrows, setShowArrows] = React.useState(true);
  const touchRef = React.useRef({ x: 0, y: 0, active: false });
  // Set on a confirmed swipe navigation so the click that (on some mobile
  // browsers/webviews) still fires right after a drag doesn't also toggle
  // arrow visibility — swiping should never bring the arrows back.
  const swipedRef = React.useRef(false);

  // ── Zoom/pan state ──────────────────────────────────────────────────────
  // Pinch (two-finger touch), trackpad pinch (wheel + ctrlKey — that's how
  // Chrome/Firefox/Safari all report a trackpad pinch gesture), mouse wheel,
  // and double-tap/double-click all drive the same scale/pan state. While
  // zoomed in, a single-finger drag pans instead of triggering the
  // swipe-to-next/prev-image navigation below.
  const [scale, setScale] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = React.useState(false);
  const containerRef = React.useRef(null);
  const pinchRef = React.useRef(null); // { startDist, startScale }
  const panDragRef = React.useRef(null); // { startX, startY, startPanX, startPanY }
  const lastTapRef = React.useRef({ time: 0, x: 0, y: 0 });
  // Set while a desktop click-drag pan actually moved the image, so the
  // "click" that follows the mouseup right after isn't also read as a
  // click-to-zoom toggle (mirrors the touch side's swipedRef/panDistance
  // check below) — without this, finishing a pan-drag would immediately
  // zoom back out.
  const mouseDragMovedRef = React.useRef(false);
  const isZoomed = scale > 1.01;
  // Both images and videos zoom/pan the same way — this covers desktop
  // apps (Tauri .exe) with no trackpad/touchscreen to pinch with, where a
  // hand cursor + click is the only available zoom gesture.
  const isZoomable = isImg || isVid;

  React.useEffect(() => {
    setShowItemMenu(false);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  // Shown briefly on open (or whenever a tap reveals them again), then
  // auto-hide — teaches the swipe affordance without permanently
  // obstructing the view. Mount-only-plus-showArrows-toggle on purpose:
  // navigating via swipe changes `index` but must NOT re-trigger this.
  React.useEffect(() => {
    if (!showArrows) return;
    const t = setTimeout(() => setShowArrows(false), 2500);
    return () => clearTimeout(t);
  }, [showArrows]);

  const handleMediaClick = (e) => {
    if (swipedRef.current) { swipedRef.current = false; return; }
    if (mouseDragMovedRef.current) { mouseDragMovedRef.current = false; return; }
    // Desktop has no pinch gesture, so a plain click does what double-tap
    // does on touch: zoom in centered on the click, or zoom back out.
    if (isZoomable) {
      toggleDoubleTapZoom(e.clientX, e.clientY);
      setShowArrows(true);
      return;
    }
    setShowArrows(v => !v);
  };

  // Reveals the prev/next arrows on mouse movement (a plain click is now
  // spent on zoom, so hover is the only way left for a desktop user to
  // bring them back once they've auto-hidden).
  const handleMediaMouseMove = () => {
    setShowArrows(v => (v ? v : true));
  };

  React.useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple && index > 0 && !isZoomed) onPrev?.();
      if (e.key === 'ArrowRight' && hasMultiple && index < items.length - 1 && !isZoomed) onNext?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext, hasMultiple, index, items?.length, isZoomed]);

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

  // Keeps a zoomed image from being panned entirely off-screen — a rough
  // heuristic (not pixel-perfect against the media's actual rendered size)
  // that's plenty for "don't lose the picture," not a precision clamp.
  const clampPan = (nextPan, atScale) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || atScale <= 1) return { x: 0, y: 0 };
    const maxX = (rect.width * (atScale - 1)) / 2;
    const maxY = (rect.height * (atScale - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, nextPan.x)),
      y: Math.min(maxY, Math.max(-maxY, nextPan.y)),
    };
  };

  const toggleDoubleTapZoom = (clientX, clientY) => {
    if (isZoomed) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      // Zoom in centered roughly toward where the user tapped/clicked,
      // rather than always snapping to dead-center.
      const offsetX = rect ? (rect.width / 2 - (clientX - rect.left)) : 0;
      const offsetY = rect ? (rect.height / 2 - (clientY - rect.top)) : 0;
      setScale(DOUBLE_TAP_SCALE);
      setPan(clampPan({ x: offsetX * (DOUBLE_TAP_SCALE - 1), y: offsetY * (DOUBLE_TAP_SCALE - 1) }, DOUBLE_TAP_SCALE));
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsGesturing(true);
      pinchRef.current = { startDist: distance(e.touches[0], e.touches[1]), startScale: scale };
      panDragRef.current = null;
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY, active: true };
    if (isZoomed) {
      setIsGesturing(true);
      panDragRef.current = { startX: touch.clientX, startY: touch.clientY, startPanX: pan.x, startPanY: pan.y };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = distance(e.touches[0], e.touches[1]);
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRef.current.startScale * (dist / pinchRef.current.startDist)));
      setScale(next);
      if (next <= 1.01) setPan({ x: 0, y: 0 });
      else setPan(p => clampPan(p, next));
      return;
    }
    if (panDragRef.current && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - panDragRef.current.startX;
      const dy = touch.clientY - panDragRef.current.startY;
      setPan(clampPan({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy }, scale));
    }
    // Not zoomed, single touch — direction/threshold for swipe-nav is
    // resolved entirely on touchend from the start point (unchanged).
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length > 0) return; // still one finger down (pinch → pan transition) — wait for full release
    const wasPinching = !!pinchRef.current;
    const pan_ = panDragRef.current;
    pinchRef.current = null;
    panDragRef.current = null;
    setIsGesturing(false);

    const touch = e.changedTouches[0];

    // A pan that barely moved is really a tap that happened to land while
    // zoomed in (e.g. the tap that started a would-be pan) — still worth
    // checking for a double-tap so double-tapping while zoomed can zoom
    // back out. A pinch, or a pan that actually traveled, is a real gesture
    // and shouldn't also fall through to tap/swipe handling below.
    const panDistance = pan_ && touch ? Math.hypot(touch.clientX - pan_.startX, touch.clientY - pan_.startY) : Infinity;
    if (wasPinching || (pan_ && panDistance >= 10)) { swipedRef.current = true; return; }

    const s = touchRef.current;
    if (!s.active) return;
    s.active = false;
    if (!touch) return;
    const deltaX = touch.clientX - s.x;
    const deltaY = touch.clientY - s.y;

    if (!isZoomed) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) return; // vertical drag — ignore
      if (deltaX > SWIPE_THRESHOLD && hasMultiple && index > 0) { swipedRef.current = true; onPrev?.(); return; }
      if (deltaX < -SWIPE_THRESHOLD && hasMultiple && index < items.length - 1) { swipedRef.current = true; onNext?.(); return; }
    }
    // A real tap (not a swipe, not on a button — those handle their own
    // taps) — toggle directly here rather than depending solely on the
    // synthetic click event fired after touchend, which some embedded
    // WebViews (e.g. the Capacitor Android build) don't reliably dispatch.
    // swipedRef suppresses that synthetic click if it does still fire, so
    // it can't immediately toggle a second time.
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && !e.target.closest('button')) {
      e.preventDefault();
      swipedRef.current = true;
      const now = Date.now();
      const last = lastTapRef.current;
      const isDoubleTap = (now - last.time) < DOUBLE_TAP_MS && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < DOUBLE_TAP_DIST;
      lastTapRef.current = { time: isDoubleTap ? 0 : now, x: touch.clientX, y: touch.clientY };
      if (isDoubleTap) {
        toggleDoubleTapZoom(touch.clientX, touch.clientY);
      } else if (!isZoomed) {
        setShowArrows(v => !v);
      }
    }
  };

  // Desktop: mouse wheel zooms; a trackpad pinch is reported by the browser
  // as a wheel event with ctrlKey set (Chrome/Firefox/Safari convention) —
  // handling both here means "zoom with two fingers" also covers laptop
  // trackpads, not just touchscreens.
  const handleWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    // Trackpad pinch arrives as wheel+ctrlKey with small per-event deltas;
    // plain mouse-wheel notches are much larger — scale each so either one
    // zooms at a comfortable, similar-feeling rate.
    const step = e.deltaY * (e.ctrlKey ? -0.02 : -0.0015);
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + step));
    if (next <= 1.01) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    if (rect) {
      const offsetX = rect.width / 2 - (e.clientX - rect.left);
      const offsetY = rect.height / 2 - (e.clientY - rect.top);
      const ratio = next / scale;
      setPan(p => clampPan({ x: (p.x + offsetX) * ratio - offsetX, y: (p.y + offsetY) * ratio - offsetY }, next));
    }
    setScale(next);
  };

  // Desktop: click-drag to pan while zoomed (mirrors the touch pan above).
  const handleMouseDown = (e) => {
    if (!isZoomed || e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startPan = pan;
    mouseDragMovedRef.current = false;
    setIsGesturing(true);
    const onMove = (ev) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) mouseDragMovedRef.current = true;
      setPan(clampPan({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) }, scale));
    };
    const onUp = () => {
      setIsGesturing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const expiryDaysLeft = item?.expiresAt ? Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const showExpiry = expiryDaysLeft !== null && expiryDaysLeft > 0;

  if (!item) return null;

  const mediaTransformStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    transformOrigin: 'center center',
    transition: isGesturing ? 'none' : 'transform 0.2s ease',
  };

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
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleMediaClick}
          onMouseMove={isZoomable ? handleMediaMouseMove : undefined}
          onWheel={isZoomable ? handleWheel : undefined}
          onMouseDown={isZoomable ? handleMouseDown : undefined}
          style={{
            position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', background: '#000', minHeight: 200,
            touchAction: isZoomable ? 'none' : 'auto', // let the browser's own native pinch/zoom stay out of the way of ours
            cursor: isZoomable ? (isGesturing ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {isImg ? (
            <img
              src={url}
              alt="Media"
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', ...mediaTransformStyle }}
            />
          ) : isVid ? (
            <video src={url} controls autoPlay onContextMenu={e => e.preventDefault()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', ...mediaTransformStyle }} />
          ) : null}

          {showExpiry && (
            <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '4px 8px', backdropFilter: 'blur(4px)' }}>
              Expires in {expiryDaysLeft} day{expiryDaysLeft !== 1 ? 's' : ''}
            </div>
          )}

          {hasMultiple && index > 0 && !isZoomed && (
            <button onClick={e => { e.stopPropagation(); onPrev?.(); }}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2, opacity: showArrows ? 1 : 0, pointerEvents: showArrows ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}>
              <span style={{ color: '#fff', display: 'flex' }}><ChevronLeft size={20} /></span>
            </button>
          )}
          {hasMultiple && index < items.length - 1 && !isZoomed && (
            <button onClick={e => { e.stopPropagation(); onNext?.(); }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2, opacity: showArrows ? 1 : 0, pointerEvents: showArrows ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}>
              <span style={{ color: '#fff', display: 'flex' }}><ChevronRight size={20} /></span>
            </button>
          )}

          {isZoomable && isZoomed && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '4px 8px', backdropFilter: 'blur(4px)' }}>
              {Math.round(scale * 100)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
