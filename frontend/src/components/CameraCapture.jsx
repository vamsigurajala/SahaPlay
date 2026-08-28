import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RotateCw, RotateCcw, Send, Zap, ZapOff, Image as ImageIcon, Download } from 'lucide-react';
import { useBackIntercept } from '../hooks/useBackIntercept';

// Full-screen in-app camera capture — mobile/tablet composer's "Camera" button
// opens this instead of the OS's own camera app, so the whole flow (open →
// shoot → edit → caption → send) stays inside the chat UI, matching
// WhatsApp's own camera composer rather than a native intent hand-off.
//
// onCapture(file, caption) is called with a real File (image/jpeg) and
// whatever caption text was typed (may be ''). Callers pass the file straight
// into their existing media-upload function, then (if caption is non-empty)
// drive their own text-send the same way Enter-to-send already does.
//
// Camera/gallery permission itself is intentionally NOT gated behind any
// custom in-app dialog — getUserMedia() and <input type=file> already
// trigger the real native Android/browser permission prompts on their own
// (this app's AndroidManifest.xml already declares CAMERA for exactly this),
// the same way WhatsApp's own camera button does. Adding a software dialog
// in front of that would just be a second, fake "permission" screen.

// Remembers which physical camera (deviceId) resolved for each facingMode
// after the first successful open THIS PAGE SESSION — re-requesting by
// deviceId on later opens/flips skips the browser's camera-selection
// negotiation entirely, which is the slow part on most Android devices.
// Deliberately not persisted (a device id isn't guaranteed stable/valid
// across page loads or permission re-grants), just kept for this mount.
const resolvedDeviceId = { environment: null, user: null };

// A continuous vertical spectrum (white → red → orange → yellow → green →
// cyan → blue → purple → pink → near-black), matching iOS's own text-color
// slider rather than a row of discrete swatches — the CSS gradient below and
// colorAtFraction() are generated from this SAME array so what's drawn on
// screen and what a given drag position resolves to can never drift apart.
const GRADIENT_STOPS = [
  { pos: 0.00, rgb: [255, 255, 255] },
  { pos: 0.10, rgb: [239, 68, 68] },
  { pos: 0.22, rgb: [249, 115, 22] },
  { pos: 0.34, rgb: [250, 204, 21] },
  { pos: 0.46, rgb: [34, 197, 94] },
  { pos: 0.58, rgb: [6, 182, 212] },
  { pos: 0.70, rgb: [59, 130, 246] },
  { pos: 0.82, rgb: [168, 85, 247] },
  { pos: 0.92, rgb: [236, 72, 153] },
  { pos: 1.00, rgb: [10, 10, 10] },
];
const GRADIENT_CSS = `linear-gradient(180deg, ${GRADIENT_STOPS.map(s => `rgb(${s.rgb.join(',')}) ${Math.round(s.pos * 100)}%`).join(', ')})`;

function colorAtFraction(f) {
  const frac = Math.min(1, Math.max(0, f));
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    const a = GRADIENT_STOPS[i], b = GRADIENT_STOPS[i + 1];
    if (frac >= a.pos && frac <= b.pos) {
      const t = (frac - a.pos) / (b.pos - a.pos || 1);
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return 'rgb(255,255,255)';
}

// The gradient slider hands back 'rgb(r, g, b)' strings (and the default is
// '#ffffff') — this needs to handle both to decide whether the text's own
// outline/shadow should flip to a light tone for a near-black pick instead
// of the default dark one.
function isColorDark(color) {
  if (!color) return false;
  let r, g, b;
  const rgbMatch = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
  if (rgbMatch) {
    r = Number(rgbMatch[1]); g = Number(rgbMatch[2]); b = Number(rgbMatch[3]);
  } else {
    const hex = color.replace('#', '');
    if (hex.length !== 6) return false;
    r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) < 100;
}

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const dragStartY = useRef(null);
  const draggingRef = useRef(false);
  const galleryInputRef = useRef(null);
  const textDragRef = useRef(null); // { startX, startY, origX, origY, rect }
  const textJustDraggedRef = useRef(false);
  const colorBarRef = useRef(null);
  const colorCircleRef = useRef(null);
  const colorDraggingRef = useRef(false);
  // The text-entry input is uncontrolled (see the editingText JSX below) —
  // its value and live drag-color are both read from refs at commit time
  // instead of React state, so neither typing a single character nor
  // dragging the color slider ever re-renders this component. A controlled
  // input re-rendering the whole CameraCapture tree (captured photo, video
  // refs, etc.) on every keystroke/pointermove is exactly what read as
  // "slow"/"glitchy" typing and re-editing on a real device.
  const textInputRef = useRef(null);
  const latestColorRef = useRef('#ffffff');

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
  const [textOverlay, setTextOverlay] = useState(null); // { text, xPct, yPct, color }
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [textDraftColor, setTextDraftColor] = useState('#ffffff');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  // Two levels: 1 = live camera open, 2 = reviewing a captured/picked photo.
  // A swipe-back (or the Android hardware back gesture) from level 2 drops
  // to level 1 — back to the live camera, not out of it — and only from
  // level 1 does it close this screen and return to the chat. The X button
  // is a separate, deliberate "close entirely" shortcut regardless of level.
  const level = capturedUrl ? 2 : 1;
  const { skipNextClose } = useBackIntercept(level, (newLevel) => {
    if (newLevel === 1) backToCamera();
    else if (newLevel === 0) onClose && onClose();
  });

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
      // Prefer the exact camera that already resolved for this facingMode
      // earlier in the session — skips re-negotiating facingMode from
      // scratch, which is the main thing slowing camera open down. Falls
      // back to facingMode alone (ideal, not exact) if that ever fails, so
      // a stale/invalid cached id can't leave the camera unable to open.
      const cachedId = resolvedDeviceId[mode];
      const constraints = cachedId
        ? { video: { deviceId: { ideal: cachedId }, width: { ideal: 720 } }, audio: false }
        : { video: { facingMode: { ideal: mode }, width: { ideal: 720 } }, audio: false };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (cachedId) {
          resolvedDeviceId[mode] = null;
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 720 } }, audio: false });
        } else {
          throw err;
        }
      }
      streamRef.current = stream;
      resolvedDeviceId[mode] = stream.getVideoTracks()[0]?.getSettings?.().deviceId || resolvedDeviceId[mode];
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

  // Discards whatever was captured/picked and returns to the live camera —
  // used by both the back-gesture (level 2 → 1, see above) and the custom
  // swipe-down-to-dismiss gesture below, so both read the same way.
  const backToCamera = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setRotation(0);
    setTextOverlay(null);
    setCaption('');
    startStream(facingMode);
  }, [capturedUrl, facingMode, startStream]);

  // Any close triggered from inside the UI (X) is an in-app action, not a
  // real back/swipe gesture — skipNextClose() must run first so
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
        ctx.strokeStyle = isColorDark(textOverlay.color) ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
        ctx.fillStyle = textOverlay.color || '#ffffff';
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

  const openTextEditor = () => {
    const initialColor = textOverlay?.color || '#ffffff';
    setTextDraft(textOverlay?.text || '');
    setTextDraftColor(initialColor);
    latestColorRef.current = initialColor;
    setEditingText(true);
  };

  // Reads the live values straight from the uncontrolled input + the color
  // ref (see textInputRef/latestColorRef above) rather than React state —
  // neither one was ever committed to state while the user was actually
  // typing/dragging, only here, once, when they're done.
  const commitText = () => {
    const t = (textInputRef.current?.value ?? '').trim();
    setEditingText(false);
    if (!t) { setTextOverlay(null); return; }
    setTextOverlay(prev => ({ text: t, color: latestColorRef.current, xPct: prev?.xPct ?? 0.5, yPct: prev?.yPct ?? 0.5 }));
  };

  // Pointer events handle the actual drag (percentage position within the
  // photo frame); a plain click re-opens editing for that same text — click
  // is the reliable "was this a tap, not a drag" signal here since it fires
  // after pointerup and (unlike checking pointer state directly) isn't lost
  // to whichever handler happens to run first.
  const onTextPointerDown = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    textDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: textOverlay?.xPct ?? 0.5, origY: textOverlay?.yPct ?? 0.5,
      rect,
    };
    textJustDraggedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onTextPointerMove = (e) => {
    if (!textDragRef.current) return;
    const d = textDragRef.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) textJustDraggedRef.current = true;
    const xPct = Math.min(0.95, Math.max(0.05, d.origX + dx / d.rect.width));
    const yPct = Math.min(0.95, Math.max(0.05, d.origY + dy / d.rect.height));
    setTextOverlay(prev => prev ? { ...prev, xPct, yPct } : prev);
  };
  const onTextPointerUp = () => { textDragRef.current = null; };
  const onTextClick = (e) => {
    e.stopPropagation();
    if (textJustDraggedRef.current) { textJustDraggedRef.current = false; return; }
    openTextEditor();
  };

  // Color slider drag: every moving part — the small preview circle's
  // position/color AND the input text's own live color — is written
  // straight to the DOM via refs, never through React state, so dragging
  // never re-renders anything regardless of how fast pointermove fires (a
  // React re-render per pixel of movement is exactly what read as "laggy"
  // on a real device). latestColorRef just remembers the final value for
  // commitText() to read once, when the drag is over.
  const updateColorFromClientY = (clientY) => {
    const bar = colorBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const frac = (clientY - rect.top) / rect.height;
    const color = colorAtFraction(frac);
    latestColorRef.current = color;
    if (colorCircleRef.current) {
      colorCircleRef.current.style.background = color;
      // The editingText overlay is position:fixed inset:0 (spans the full
      // viewport), so viewport-relative clientY already IS this circle's
      // correct `top` (also position:absolute within that same overlay) —
      // just clamped to the bar's own vertical extent.
      const clampedY = Math.min(rect.bottom, Math.max(rect.top, clientY));
      colorCircleRef.current.style.top = `${clampedY}px`;
    }
    if (textInputRef.current) textInputRef.current.style.color = color;
  };
  const onColorPointerDown = (e) => {
    e.stopPropagation();
    colorDraggingRef.current = true;
    if (colorCircleRef.current) colorCircleRef.current.style.opacity = '1';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateColorFromClientY(e.clientY);
  };
  const onColorPointerMove = (e) => {
    if (!colorDraggingRef.current) return;
    updateColorFromClientY(e.clientY);
  };
  const onColorPointerUp = () => {
    colorDraggingRef.current = false;
    if (colorCircleRef.current) colorCircleRef.current.style.opacity = '0';
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
  // if released short of the threshold. Committing drops one level, same as
  // the back-gesture above (photo review → live camera; live camera → close)
  // rather than always closing outright, so both ways of "going back" behave
  // the same way.
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
    if (dragY > 120) {
      if (capturedUrl) { backToCamera(); setDragY(0); }
      else requestClose();
    } else {
      setDragY(0);
    }
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
              onClick={onTextClick}
              style={{
                position: 'absolute', left: `${textOverlay.xPct * 100}%`, top: `${textOverlay.yPct * 100}%`,
                transform: 'translate(-50%, -50%)', color: textOverlay.color || '#fff', fontWeight: 700, fontSize: 22,
                textShadow: isColorDark(textOverlay.color) ? '0 1px 4px rgba(255,255,255,0.5)' : '0 2px 6px rgba(0,0,0,0.7)',
                cursor: 'grab', padding: 6, touchAction: 'none',
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

      {/* Top bar — this screen is a plain fixed overlay with no header of
          its own above it, so its top padding has to clear the real status
          bar itself. env(safe-area-inset-top) alone isn't reliable inside
          this app's Capacitor WebView (the rest of the app's own headers
          add --sp-status-bar-inset, a value the native shell computes
          directly, specifically because of that — see nativeShell.js's
          initNativeStatusBarInset()); without it these icons sat right
          against the very top edge, touching the system status bar. */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'linear-gradient(rgba(0,0,0,0.45), transparent)',
        padding: 'calc(8px + var(--sp-status-bar-inset, 0px) + env(safe-area-inset-top)) 16px 28px',
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
            <button onClick={openTextEditor} aria-label="Add text" style={{ ...iconBtnStyle, fontSize: 14, fontWeight: 800, color: '#fff', width: 40 }}>
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
          <button
            onClick={() => galleryInputRef.current?.click()}
            aria-label="Choose from gallery"
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
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
              flex: 1, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
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
            ref={textInputRef}
            autoFocus
            defaultValue={textDraft}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') commitText(); }}
            placeholder="Type something..."
            style={{
              width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 12, padding: '14px 16px', color: textDraftColor, fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none',
            }}
          />
          {/* Continuous vertical color spectrum, matching WhatsApp's own
              text-color slider: thin, sitting close to the right edge, and
              covering only the middle band of the screen rather than
              stretching nearly full-height. Dragging shows a small handle
              circle right on top of the bar (not a big detached "magnified"
              preview) — both this circle and the input text's own live
              color are written directly via refs (see updateColorFromClientY
              above), so dragging is a pure DOM write with no re-render. */}
          <div
            ref={colorBarRef}
            onClick={e => e.stopPropagation()}
            onPointerDown={onColorPointerDown}
            onPointerMove={onColorPointerMove}
            onPointerUp={onColorPointerUp}
            onPointerCancel={onColorPointerUp}
            style={{
              position: 'absolute', right: 16, top: '24%', bottom: '38%', width: 8,
              borderRadius: 4, background: GRADIENT_CSS, touchAction: 'none', cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          />
          <div
            ref={colorCircleRef}
            style={{
              position: 'absolute', right: 9, top: '50%', width: 20, height: 20, borderRadius: '50%',
              background: textDraftColor, border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              transform: 'translateY(-50%)', opacity: 0, transition: 'opacity 0.12s ease', pointerEvents: 'none',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes camFlash { from { opacity: 0.9; } to { opacity: 0; } }
      `}</style>
    </div>
  );
}
