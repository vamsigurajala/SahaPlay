import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { markAccessPrimerSeen } from '../lib/accessPrimer';

// Shown once, the first time a device-access flow (camera, or photos/files)
// is used — explains why before the real browser/OS permission dialog fires,
// rather than that dialog appearing with no context. Tapping Allow marks
// this kind as seen (so it never shows again) and calls onAllow, which the
// caller uses to actually proceed (open the camera / the file picker) —
// this modal has no access of its own to grant, it's a courtesy step in
// front of whatever the browser/OS asks for.
export default function AccessPrimerModal({ kind, onAllow, onDeny }) {
  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const isCamera = kind === 'camera';
  const title = isCamera ? 'Camera Access' : 'Photos & Files Access';
  const message = isCamera
    ? "SahaPlay needs access to your camera to take and send photos in chat."
    : "SahaPlay needs access to your photos and files to attach them in chat.";

  const handleAllow = () => {
    markAccessPrimerSeen(kind);
    onAllow();
  };

  return createPortal(
    <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(12px) saturate(180%)', WebkitBackdropFilter: 'blur(12px) saturate(180%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: isLight ? '#fff' : 'rgba(20, 20, 25, 0.9)', border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', borderRadius: 28, padding: 28, width: '100%', maxWidth: 360, boxShadow: isLight ? '0 32px 80px rgba(0,0,0,0.15)' : '0 40px 100px rgba(0,0,0,0.8)', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(var(--brand-1-rgb),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isCamera ? <Camera size={22} color="var(--brand-1)" /> : <ImageIcon size={22} color="var(--brand-1)" />}
          </div>
          <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#fff', fontSize: 19, fontWeight: 900 }}>{title}</h3>
        </div>
        <p style={{ color: isLight ? '#475569' : '#aaa', fontSize: 14, marginBottom: 22, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onDeny} style={{ padding: '11px 20px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.08)', border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)', color: isLight ? '#000' : '#fff', cursor: 'pointer', fontWeight: 700, borderRadius: 14, fontSize: 14 }}>
            Not now
          </button>
          <button onClick={handleAllow} style={{ padding: '11px 22px', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 800, borderRadius: 14, fontSize: 14 }}>
            Allow
          </button>
        </div>
      </div>
      <style>{`@keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>,
    document.body
  );
}
