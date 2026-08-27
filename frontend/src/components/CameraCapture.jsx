import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RotateCw, RotateCcw, Send, Zap, ZapOff, Image as ImageIcon, Download } from 'lucide-react';
import { useBackIntercept } from '../hooks/useBackIntercept';
import { hasSeenAccessPrimer } from '../lib/accessPrimer';
import AccessPrimerModal from './AccessPrimerModal';

// Full-screen in-app camera capture — mobile/tablet composer's "Camera" button
// opens this instead of the OS's own camera app, so the whole flow (open →
// shoot → edit → caption → send) stays inside the chat UI, matching
// WhatsApp's own camera composer rather than a native intent hand-off.
//
// onCapture(file, caption) is called with a real File (image/jpeg) and
// whatever caption text was typed (may be ''). Callers pass the file straight
// into their existing media-upload function, then (if caption is non-empty)
// drive their own text-send the same way Enter-to-send already does.
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const dragStartY = useRef(null);
  const draggingRef = useRef(false);
  const galleryInputRef = useRef(null);
  const textDragRef = useRef(null); // { startX, startY, origX, origY, moved }

  const [facingMode, setFacingMode] = useState('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [flashActive, setFlashActive] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [textOverlay, setTextOverlay] = useState(null); // { text, xPct, yPct }
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [cameraPrimer, setCameraPrimer] = useState(() => !hasSeenAccessPrimer('camera'));
  const [galleryPrimer, setGalleryPrimer] = useState(false);

  // Mobile/tablet swipe-back (and Android hardware back) should close just
  // this camera screen and return to the chat, not fall through to whatever
  // else is listening for back and close the whole chat panel instead.
  const { skipNextClose } = useBackIntercept(1, (newLevel) => { if (newLevel === 0) onClose && onClose(); });

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async (mode) => {
    setError(null);
    setReady(false);
    stopStream();
    try {
      // A plain ideal width (no forced square height) lets the camera driver
      // pick its own native aspect ratio, which negotiates much faster on
      // most Android devices than an unusual 1:1 constraint does — this is
      // the actual "camera takes forever to open" fix, not just UI polish.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (err) {
      setError(err?.name === 'NotAllowedError'
        ? 'Camera access denied. Allow camera permission and try again.'
        : 'Could not open camera on this device.');
    }
  }, [stopStream]);

  useEffect(() => {
    // First-ever use asks via AccessPrimerModal below instead of firing
    // getUserMedia (and its real OS/browser permission dialog) with zero
    // warning — every later open skips straight to the stream, same as any
    // real permission only ever being asked once.
    if (!cameraPrimer) startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Any close triggered from inside the UI (X, discard) is an in-app action,
  // not a real back/swipe gesture — skipNextClose() must run first so
  // useBackIntercept's own history cleanup doesn't race a real back gesture
  // firing in close succession (see useBackIntercept.js's docs).
  const requestClose = useCallback(() => {
    skipNextClose();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    stopStream();
    setClosing(true);
    setTimeout(() => onClose(), 220);
  }, [capturedUrl, stopStream, onClose, skipNextClose]);

  const flipCamera = () => {
    if (capturedUrl) return;
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startStream(next);
  };

  const doScreenFlash = () => {
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 180);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Real hardware torch when the active (rear) camera track supports it —
    // most browsers only expose this on Android Chrome for the environment-
    // facing camera, and there's no web API for it on iOS at all, so the
    // screen-flash below always fires too as the guaranteed-to-work fallback.
    let torchTrack = null;
    if (flashOn && facingMode === 'environment' && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track?.getCapabilities?.().torch) {
        torchTrack = track;
        try { await track.applyConstraints({ advanced: [{ torch: true }] }); } catch { /* torch toggle unsupported here, screen-flash below still fires */ }
        await new Promise(r => setTimeout(r, 150));
      }
    }
    if (flashOn) doScreenFlash();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (torchTrack) {
      try { await torchTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch { /* best-effort torch-off */ }
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setRotation(0);
      setTextOverlay(null);
      setCaption('');
      stopStream();
    }, 'image/jpeg', 0.92);
  };

  const pickFromGallery = (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    stopStream();
    setCapturedBlob(file);
    setCapturedUrl(URL.createObjectURL(file));
    setRotation(0);
    setTextOverlay(null);
    setCaption('');
  };

  const rotateImage = () => setRotation(r => (r + 90) % 360);

  const openGallery = () => {
    if (!hasSeenAccessPrimer('gallery')) { setGalleryPrimer(true); return; }
    galleryInputRef.current?.click();
  };

  // Bakes rotation + the (optional) draggable text label into a real,
  // final JPEG — this is what actually gets downloaded/sent, not just what
  // CSS shows in the editor, so recipients see exactly what was previewed.
  const buildFinalBlob = () => new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const swap = rotation === 90 || rotation === 270;
      const w = swap ? img.height : img.width;
      const h = swap ? img.width : img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      if (textOverlay?.text) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const fontSize = Math.max(18, Math.round(w * 0.055));
        ctx.font = `700 ${fontSize}px 'Outfit', -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.fillStyle = '#ffffff';
        const tx = textOverlay.xPct * w;
        const ty = textOverlay.yPct * h;
        ctx.strokeText(textOverlay.text, tx, ty);
        ctx.fillText(textOverlay.text, tx, ty);
      }
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    };
    img.src = capturedUrl;
  });

  const downloadImage = async () => {
    const blob = await buildFinalBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SahaPlay-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const commitText = () => {
    const t = textDraft.trim();
    setEditingText(false);
    if (!t) { setTextOverlay(null); return; }
    setTextOverlay(prev => ({ text: t, xPct: prev?.xPct ?? 0.5, yPct: prev?.yPct ?? 0.5 }));
  };

  const onTextPointerDown = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    textDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: textOverlay?.xPct ?? 0.5, origY: textOverlay?.yPct ?? 0.5,
      rect, moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onTextPointerMove = (e) => {
    if (!textDragRef.current) return;
    const d = textDragRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    const xPct = Math.min(0.95, Math.max(0.05, d.origX + dx / d.rect.width));
    const yPct = Math.min(0.95, Math.max(0.05, d.origY + dy / d.rect.height));
    setTextOverlay(prev => prev ? { ...prev, xPct, yPct } : prev);
  };
  const onTextPointerUp = () => {
    const moved = textDragRef.current?.moved;
    textDragRef.current = null;
    if (!moved && textOverlay) {
      setTextDraft(textOverlay.text);
      setEditingText(true);
    }
  };

  const send = async () => {
    if (!capturedBlob || sending) return;
    setSending(true);
    const blob = await buildFinalBlob();
    const file = new File([blob || capturedBlob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    skipNextClose();
    try {
      await onCapture(file, caption);
    } finally {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      stopStream();
      setClosing(true);
      setTimeout(() => onClose(), 180);
    }
  };

  // Swipe-down-to-dismiss: follows the finger 1:1 while dragging, snaps back
  // if released short of the threshold, commits to a full close otherwise —
  // same physical feel as a WhatsApp/Instagram full-screen sheet. Independent
  // of the OS back-gesture handling above (useBackIntercept) — this is a
  // hand-rolled in-overlay drag, so it must also call requestClose() (which
  // itself calls skipNextClose()) rather than closing directly.
  const onTouchStart = (e) => {
    if (e.touches.length !== 1 || editingText) return;
    // The draggable text label has its own pointer-based drag handling —
    // without this check, the SAME touch also drove this swipe-to-dismiss
    // tracking (touch and pointer events both fire independently for one
    // physical touch), so every attempt to move the text also dragged the
    // whole camera screen down at the same time, and neither gesture read
    // as working properly.
    if (e.target.closest && e.target.closest('[data-no-swipe]')) return;
    dragStartY.current = e.touches[0].clientY;
    draggingRef.current = true;
  };
  const onTouchMove = (e) => {
    if (!draggingRef.current || dragStartY.current == null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const onTouchEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > 120) requestClose();
    else setDragY(0);
    dragStartY.current = null;
  };

  const translateY = closing ? '100%' : (entered ? `${dragY}px` : '100%');
  const opacity = closing ? 0 : (entered ? Math.max(1 - dragY / 500, 0.4) : 0);

  const iconBtnStyle = { width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999, background: '#000',
        transform: `translateY(${translateY})`,
        opacity,
        transition: draggingRef.current ? 'none' : 'transform 0.24s cubic-bezier(0.32,0.72,0,1), opacity 0.24s ease',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {!capturedUrl && (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            opacity: ready ? 1 : 0, transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {capturedUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src={capturedUrl}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${rotation}deg)`, transition: 'transform 0.25s ease' }}
          />
          {textOverlay && (
            <div
              data-no-swipe="true"
              onPointerDown={onTextPointerDown}
              onPointerMove={onTextPointerMove}
              onPointerUp={onTextPointerUp}
              style={{
                position: 'absolute', left: `${textOverlay.xPct * 100}%`, top: `${textOverlay.yPct * 100}%`,
                transform: 'translate(-50%, -50%)', color: '#fff', fontWeight: 700, fontSize: 22,
                textShadow: '0 2px 6px rgba(0,0,0,0.7)', cursor: 'grab', padding: 6, touchAction: 'none',
                userSelect: 'none', whiteSpace: 'nowrap',
              }}
            >
              {textOverlay.text}
            </div>
          )}
        </div>
      )}

      {flashActive && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', animation: 'camFlash 0.18s ease-out' }} />
      )}

      {!ready && !error && !capturedUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 34, height: 34, border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#fff', fontSize: 15, margin: 0 }}>{error}</p>
          <button onClick={requestClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Close</button>
        </div>
      )}

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'linear-gradient(rgba(0,0,0,0.45), transparent)',
        padding: 'max(14px, env(safe-area-inset-top)) 16px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={requestClose} aria-label="Close camera" style={iconBtnStyle}>
          <X size={20} color="#fff" />
        </button>

        {!capturedUrl ? (
          <button onClick={() => setFlashOn(f => !f)} aria-label="Toggle flash" style={iconBtnStyle}>
            {flashOn ? <Zap size={19} color="#fde047" fill="#fde047" /> : <ZapOff size={19} color="#fff" />}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={downloadImage} aria-label="Download" style={iconBtnStyle}><Download size={18} color="#fff" /></button>
            <button onClick={rotateImage} aria-label="Rotate" style={iconBtnStyle}><RotateCcw size={18} color="#fff" /></button>
            <button
              onClick={() => { setTextDraft(textOverlay?.text || ''); setEditingText(true); }}
              aria-label="Add text"
              style={{ ...iconBtnStyle, fontSize: 14, fontWeight: 800, color: '#fff', width: 40 }}
            >
              Aa
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {!capturedUrl ? (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
          padding: '28px 28px max(24px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button onClick={openGallery} aria-label="Choose from gallery" style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ImageIcon size={19} color="#fff" />
          </button>
          <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFromGallery} />
          <button
            onClick={capturePhoto}
            disabled={!ready}
            aria-label="Take photo"
            style={{
              width: 74, height: 74, borderRadius: '50%', background: 'transparent',
              border: '4px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.4, margin: '0 32px',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
            onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff' }} />
          </button>
          <button onClick={flipCamera} aria-label="Switch camera" style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RotateCw size={20} color="#fff" />
          </button>
        </div>
      ) : (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
          padding: '16px 16px max(20px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add a caption..."
            style={{
              flex: 1, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 999,
              padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={sending}
            aria-label="Send photo"
            style={{
              width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)', flexShrink: 0, opacity: sending ? 0.6 : 1,
            }}
          >
            <Send size={20} color="#fff" />
          </button>
        </div>
      )}

      {editingText && (
        <div
          onClick={commitText}
          style={{ position: 'fixed', inset: 0, zIndex: 1000000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <input
            autoFocus
            value={textDraft}
            onChange={e => setTextDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') commitText(); }}
            placeholder="Type something..."
            style={{
              width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none',
            }}
          />
        </div>
      )}

      {cameraPrimer && (
        <AccessPrimerModal
          kind="camera"
          onAllow={() => { setCameraPrimer(false); startStream(facingMode); }}
          onDeny={requestClose}
        />
      )}
      {galleryPrimer && (
        <AccessPrimerModal
          kind="gallery"
          onAllow={() => { setGalleryPrimer(false); galleryInputRef.current?.click(); }}
          onDeny={() => setGalleryPrimer(false)}
        />
      )}

      <style>{`
        @keyframes camFlash { from { opacity: 0.9; } to { opacity: 0; } }
      `}</style>
    </div>
  );
}
