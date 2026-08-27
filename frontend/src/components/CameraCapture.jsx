import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RotateCw, Send, ArrowLeft } from 'lucide-react';

// Full-screen in-app camera capture — mobile/tablet composer's "Camera" button
// opens this instead of the OS's own camera app, so the whole flow (open →
// shoot → flip → retake/send → dismiss) stays inside the chat UI, matching
// WhatsApp's own camera composer rather than a native intent hand-off.
//
// onCapture(file) is called with a real File (image/jpeg) — callers pass it
// straight into their existing media-upload function, the same one the
// paperclip/file-picker path already uses.
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const overlayRef = useRef(null);
  const dragStartY = useRef(null);
  const draggingRef = useRef(false);

  const [facingMode, setFacingMode] = useState('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [flashActive, setFlashActive] = useState(false);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
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
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    stopStream();
    setClosing(true);
    setTimeout(() => onClose(), 220);
  }, [capturedUrl, stopStream, onClose]);

  const flipCamera = () => {
    if (capturedUrl) return;
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startStream(next);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 180);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      stopStream();
    }, 'image/jpeg', 0.92);
  };

  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    startStream(facingMode);
  };

  const send = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    stopStream();
    setClosing(true);
    setTimeout(() => onClose(), 180);
  };

  // Swipe-down-to-dismiss: follows the finger 1:1 while dragging, snaps back
  // if released short of the threshold, commits to a full close otherwise —
  // same physical feel as a WhatsApp/Instagram full-screen sheet.
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
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
    if (dragY > 120) {
      requestClose();
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  };

  const translateY = closing ? '100%' : (entered ? `${dragY}px` : '100%');
  const opacity = closing ? 0 : (entered ? Math.max(1 - dragY / 500, 0.4) : 0);

  return (
    <div
      ref={overlayRef}
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
        <img src={capturedUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
        <button
          onClick={capturedUrl ? retake : requestClose}
          aria-label={capturedUrl ? 'Retake' : 'Close camera'}
          style={{ background: 'rgba(0,0,0,0.35)', border: 'none', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {capturedUrl ? <ArrowLeft size={20} color="#fff" /> : <X size={20} color="#fff" />}
        </button>
      </div>

      {/* Bottom bar */}
      {!capturedUrl ? (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
          padding: '28px 28px max(24px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 44 }} />
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
          <button
            onClick={flipCamera}
            aria-label="Switch camera"
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <RotateCw size={20} color="#fff" />
          </button>
        </div>
      ) : (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
          padding: '28px 28px max(24px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        }}>
          <button
            onClick={send}
            aria-label="Send photo"
            style={{
              width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            }}
          >
            <Send size={22} color="#fff" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes camFlash { from { opacity: 0.9; } to { opacity: 0; } }
      `}</style>
    </div>
  );
}
