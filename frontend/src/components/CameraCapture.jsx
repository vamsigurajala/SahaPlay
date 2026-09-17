import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RotateCw, RotateCcw, Send, Zap, ZapOff, Image as ImageIcon, Download, Trash2 } from 'lucide-react';
import { useBackIntercept, suppressNextPop } from '../hooks/useBackIntercept';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea';

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
  // Drag-to-delete target for the placed text overlay — written to directly
  // via refs while dragging (same reasoning as the color slider below: a
  // React re-render per pointermove is what read as laggy dragging on a
  // real device), only surfaced through state once, at drag start/end.
  const deleteZoneRef = useRef(null);
  const overDeleteRef = useRef(false);
  // True for the whole span between tapping "choose from gallery" and the
  // native Android picker actually returning a result. Whatever exactly
  // causes it (a stray popstate from the picker Activity's transition,
  // suppressNextPop below is one attempt at that; the WebView briefly
  // losing/regaining focus while a separate Activity covers it is another
  // plausible source), a pop/close signal arriving in this window is never
  // something the user actually did — they can't interact with this screen
  // at all while the native picker has focus — so it's ignored outright
  // rather than relying on any single event being perfectly timed away.
  const awaitingGalleryPickRef = useRef(false);
  // The text-entry input is uncontrolled (see the editingText JSX below) —
  // its value and live drag-color are both read from refs at commit time
  // instead of React state, so neither typing a single character nor
  // dragging the color slider ever re-renders this component. A controlled
  // input re-rendering the whole CameraCapture tree (captured photo, video
  // refs, etc.) on every keystroke/pointermove is exactly what read as
  // "slow"/"glitchy" typing and re-editing on a real device.
  const textInputRef = useRef(null);
  const latestColorRef = useRef('#ffffff');
  const captionInputRef = useRef(null);

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
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [textDraftColor, setTextDraftColor] = useState('#ffffff');
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  // Was a plain <input> — inputs can never wrap, so a caption longer than the
  // bar's width just scrolled sideways as one unreadable line instead of
  // growing like every other caption/message box in this app. maxHeight
  // matches the chat composer's own cap (~3 lines) rather than growing
  // without bound over this already-small preview screen.
  useAutoResizeTextarea(captionInputRef, caption, 90);

  // Two levels: 1 = live camera open, 2 = reviewing a captured/picked photo.
  // A swipe-back (or the Android hardware back gesture) from level 2 drops
  // to level 1 — back to the live camera, not out of it — and only from
  // level 1 does it close this screen and return to the chat. The X button
  // is a separate, deliberate "close entirely" shortcut regardless of level.
  const level = capturedUrl ? 2 : 1;
  const { skipNextClose } = useBackIntercept(level, (newLevel) => {
    // See awaitingGalleryPickRef above — a pop arriving while the native
    // gallery picker is in front is never a real user gesture on THIS
    // screen; acting on it is exactly what was closing the camera and
    // silently dropping the picked photo.
    if (awaitingGalleryPickRef.current) return;
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
      //
      // No width constraint: an `ideal` resolution still makes the browser
      // evaluate candidate camera modes against it before picking one,
      // rather than just starting the camera's own fastest/default preview
      // mode outright — confirmed live as a chunk of the "camera/flip feels
      // slow" delay on Android WebViews specifically. The preview is already
      // objectFit:cover, so whatever native resolution comes back displays
      // correctly regardless; capturePhoto below reads the actual video
      // frame dimensions, not a requested constraint, so capture quality is
      // unaffected.
      const cachedId = resolvedDeviceId[mode];
      const constraints = cachedId
        ? { video: { deviceId: { ideal: cachedId } }, audio: false }
        : { video: { facingMode: { ideal: mode } }, audio: false };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (cachedId) {
          resolvedDeviceId[mode] = null;
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode } }, audio: false });
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

  // Safety net for awaitingGalleryPickRef: normally cleared the moment
  // pickFromGallery's onChange fires, but some WebView/picker combos never
  // fire `change` at all if the user backs out of the picker without
  // choosing anything — without this, that flag could stay stuck true and
  // permanently swallow every future close gesture on this screen.
  //
  // `focus` is NOT a one-shot "the picker is gone" signal — the picker
  // Activity covering/uncovering the WebView during its own transitions
  // (opening, switching between its own screens, the multi-select "Done"
  // step) can fire it more than once DURING a single still-in-progress
  // pick, not just once at the very end. The previous version armed a
  // single 600ms timer on the FIRST focus event, which could win the race
  // and clear the guard while the user was still inside the picker
  // choosing/confirming — a stray pop landing in that now-unguarded window
  // then ran backToCamera() and silently threw away the in-progress pick,
  // confirmed live as "select a photo, tap Done, it reverts to the camera
  // and asks you to pick again." Debouncing instead — restarting the timer
  // on every focus event — means the guard only actually clears once focus
  // has been quiet for a full second, which a genuine "picker is closed for
  // good" only satisfies once, well after its last internal transition.
  useEffect(() => {
    let timer = null;
    const onFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { awaitingGalleryPickRef.current = false; }, 1000);
    };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); clearTimeout(timer); };
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

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Real hardware torch when the active (rear) camera track supports it —
    // most browsers only expose this on Android Chrome for the environment-
    // facing camera, and there's no web API for it on iOS at all, so the
    // screen-flash below is the fallback whenever torch isn't available
    // (always true for the front camera, and common on rear cameras whose
    // browser/webview never exposes the torch capability at all).
    let torchTrack = null;
    if (flashOn && facingMode === 'environment' && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track?.getCapabilities?.().torch) {
        torchTrack = track;
        try { await track.applyConstraints({ advanced: [{ torch: true }] }); } catch { torchTrack = null; }
        if (torchTrack) await new Promise(r => setTimeout(r, 150));
      }
    }

    // The screen-flash fallback used to set flashActive and immediately fall
    // through to drawImage in the same synchronous tick — the white overlay
    // (which used to auto-fade out via a fixed 180ms CSS animation
    // regardless of how long anything actually held it) never got a chance
    // to actually paint, let alone stay bright long enough to illuminate
    // anything, before the frame was already grabbed.
    // That's exactly the reported bug: the flash visibly flickers on screen
    // but a shot taken in the dark still comes out black. Waiting two rAFs
    // guarantees the style change has actually painted, then holding it at
    // full brightness for a beat gives it a real chance to help before the
    // frame is captured — same principle as the torch's own 150ms hold above.
    const usingScreenFlash = flashOn && !torchTrack;
    if (usingScreenFlash) {
      setFlashActive(true);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 220));
    }

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
    if (usingScreenFlash) setFlashActive(false);

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
    // The picker flow is over — whether or not a file actually came back
    // (the user may have backed out without picking anything) — either way
    // it's safe again to treat a pop/close signal as real.
    awaitingGalleryPickRef.current = false;
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
        // No outline/stroke around the text — plain fill only, in both
        // light and dark mode, per explicit request.
        ctx.fillStyle = textOverlay.color || '#ffffff';
        const tx = textOverlay.xPct * w;
        const ty = textOverlay.yPct * h;
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
  // typing/dragging, only here, once, when they're done. Explicit blur()
  // first — Done means "typing is done", closing the keyboard is part of
  // that, not just committing the value.
  const commitText = () => {
    textInputRef.current?.blur();
    const t = (textInputRef.current?.value ?? '').trim();
    setEditingText(false);
    if (!t) { setTextOverlay(null); return; }
    setTextOverlay(prev => ({ text: t, color: latestColorRef.current, xPct: prev?.xPct ?? 0.5, yPct: prev?.yPct ?? 0.5 }));
  };

  // Cancel discards this editing session entirely — textOverlay is never
  // touched, so it's left exactly as it was before openTextEditor() ran
  // (untouched if this was a fresh "Aa" tap, or the previous text/color/
  // position if this was re-editing existing text — dragging it around the
  // photo is a separate action from this editor and isn't affected either
  // way).
  const cancelTextEdit = () => {
    textInputRef.current?.blur();
    setEditingText(false);
  };

  const deleteTextOverlay = () => setTextOverlay(null);

  // Hit-tests a drag point against the delete-zone's live rect (only
  // mounted while isDraggingText is true) — a generous pad beyond its
  // visible circle since it's a small target to hit precisely mid-drag.
  const isOverDeleteZone = (clientX, clientY) => {
    const el = deleteZoneRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const pad = 24;
    return clientX >= r.left - pad && clientX <= r.right + pad && clientY >= r.top - pad && clientY <= r.bottom + pad;
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
    if (!textJustDraggedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      textJustDraggedRef.current = true;
      setIsDraggingText(true);
    }
    if (!textJustDraggedRef.current) return;
    const xPct = Math.min(0.95, Math.max(0.05, d.origX + dx / d.rect.width));
    const yPct = Math.min(0.95, Math.max(0.05, d.origY + dy / d.rect.height));
    setTextOverlay(prev => prev ? { ...prev, xPct, yPct } : prev);
    // Live hover feedback on the delete target — written directly to its
    // own DOM node, not through state, so this stays smooth at pointermove
    // frequency (same reasoning as the color slider below).
    const overNow = isOverDeleteZone(e.clientX, e.clientY);
    if (overNow !== overDeleteRef.current) {
      overDeleteRef.current = overNow;
      if (deleteZoneRef.current) {
        deleteZoneRef.current.style.transform = overNow ? 'translateX(-50%) scale(1.2)' : 'translateX(-50%) scale(1)';
        deleteZoneRef.current.style.background = overNow ? '#ef4444' : 'rgba(0,0,0,0.55)';
      }
    }
  };
  const onTextPointerUp = () => {
    const droppedOnDelete = textJustDraggedRef.current && overDeleteRef.current;
    textDragRef.current = null;
    overDeleteRef.current = false;
    setIsDraggingText(false);
    if (droppedOnDelete) deleteTextOverlay();
  };
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
    // Deliberately not awaited: onCapture (handleMediaUpload) already shows
    // its own optimistic preview of this exact photo the instant it's
    // called and uploads in the background from there — the same pattern
    // every other media send in this app already uses. Awaiting the whole
    // upload here just kept this screen open with a second, redundant
    // loading state on top of it, so send felt slow even though the chat
    // itself was ready to show the photo immediately. Firing it and closing
    // right away means the chat is what the user lands on and sees loading,
    // not this screen.
    onCapture(file, caption);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    stopStream();
    setClosing(true);
    setTimeout(() => onClose(), 180);
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
      // App.jsx's light-mode CSS matches elements by literal inline-style
      // substring (e.g. any element with "color: #fff" in its style attribute
      // gets forced to dark text) so the rest of the site's UI reads correctly
      // in light mode — CameraCapture never opted out of that, so its own
      // white-on-black styling (the "Aa" add-text button, the caption/text-
      // overlay inputs) was getting silently re-colored for light mode instead
      // of staying the fixed dark camera chrome it's meant to always be,
      // regardless of the light/dark toggle. gcw-force-dark is the exact,
      // already-established opt-out other full-screen dark overlays in this
      // app use (see MediaLightbox.jsx).
      className="gcw-force-dark"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999, background: '#000',
        // Explicit viewport sizing alongside inset:0 — belt-and-suspenders
        // against any mobile-WebView viewport-unit quirk that could leave
        // inset:0 sizing against something other than the true viewport.
        width: '100vw', height: '100dvh',
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
                // No outline/shadow around the text at all, in either mode —
                // plain fill, matching exactly what buildFinalBlob bakes
                // into the actual sent image (no WYSIWYG mismatch).
                cursor: 'grab', padding: 6, touchAction: 'none',
                userSelect: 'none', whiteSpace: 'nowrap',
              }}
            >
              {textOverlay.text}
            </div>
          )}
          {/* Drag-to-delete target — only shown while actively dragging the
              text label. Purely a hit-test target (isOverDeleteZone reads
              its rect directly, see onTextPointerMove/Up above); it never
              receives pointer events itself, so the drag gesture captured
              on the text label above is never interrupted. */}
          {isDraggingText && (
            <div
              ref={deleteZoneRef}
              style={{
                position: 'absolute', left: '50%', bottom: 'max(96px, calc(24px + env(safe-area-inset-bottom) + 76px))',
                transform: 'translateX(-50%) scale(1)',
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)', border: '2px solid rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s ease, transform 0.15s ease',
                pointerEvents: 'none', zIndex: 5,
              }}
            >
              <Trash2 size={22} color="#fff" />
            </div>
          )}
        </div>
      )}

      {flashActive && (
        // Stays at full opacity for exactly as long as capturePhoto keeps
        // flashActive true (its own hold duration, so it can actually light
        // the subject) — no independent CSS-timed fade here, since that was
        // what previously made this disappear before the frame was even
        // captured regardless of how long JS tried to hold it.
        <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 1 }} />
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
            onClick={() => {
              // Launching the native Android photo/file picker (a real
              // Activity on top of the WebView) was producing a spurious
              // popstate when it returned control — useBackIntercept's
              // shared listener then misread that as a real back gesture
              // and popped THIS screen's own level-1 entry, closing the
              // whole camera right as (or just before) the picked file
              // came back, instead of advancing to the preview. Swallowing
              // the next popstate here is the same escape hatch the hook
              // already exposes for exactly this "an external action, not
              // a user gesture, is about to cause a stray popstate" case.
              // Belt-and-suspenders alongside awaitingGalleryPickRef above,
              // which covers any pop/close signal this one miss-times.
              awaitingGalleryPickRef.current = true;
              suppressNextPop();
              galleryInputRef.current?.click();
            }}
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
          display: 'flex', alignItems: 'flex-end', gap: 10,
        }}>
          <textarea
            ref={captionInputRef}
            rows={1}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onKeyDown={e => {
              // Enter sends (matching the main chat composer) — Shift+Enter
              // still inserts a real line break for anyone who wants one.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Add a caption..."
            className="no-scrollbar"
            style={{
              flex: 1, background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
              padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none',
              resize: 'none', overflowY: 'auto', maxHeight: 90, lineHeight: 1.35,
              fontFamily: 'inherit',
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
          style={{ position: 'fixed', inset: 0, zIndex: 1000000, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column' }}
        >
          {/* Cancel (discard this edit) / Done (commit + close keyboard) —
              the only two ways out of this screen now; tapping the
              backdrop itself no longer does either, so there's no
              accidental commit from a stray tap. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'calc(12px + var(--sp-status-bar-inset, 0px) + env(safe-area-inset-top)) 8px 8px',
            flexShrink: 0,
          }}>
            <button onClick={cancelTextEdit} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: '10px 14px' }}>
              Cancel
            </button>
            <button onClick={commitText} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '10px 14px' }}>
              Done
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <input
              ref={textInputRef}
              autoFocus
              defaultValue={textDraft}
              onKeyDown={e => { if (e.key === 'Enter') commitText(); }}
              placeholder="Type something..."
              style={{
                width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 12, padding: '14px 16px', color: textDraftColor, fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none',
              }}
            />
          </div>
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

    </div>
  );
}
