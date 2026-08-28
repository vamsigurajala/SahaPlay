import React, { useRef, useState } from 'react';
import { Trash2, Play, Pause, Send, Loader2, Check } from 'lucide-react';

function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRecordingTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// WhatsApp-style voice-note recorder/preview bar. One shared component used
// by every composer this app has (GlobalChatWidget's DM/group view,
// RoomChatPanel's group + DM views) instead of the 6 near-identical inline
// blocks that used to live in each of those spots — same look everywhere,
// one place to fix. Two states, matching WhatsApp's own flow:
//   - isRecording: live red timer + live waveform, trash to cancel, a
//     circular check button to stop (WhatsApp itself uses a swipe-to-cancel
//     gesture here instead of a trash button; a fixed cancel button is kept
//     as the simpler, already-existing interaction rather than adding a new
//     gesture on top of this).
//   - review (stopped, audioUrl set): play/pause + a real draggable
//     scrubber + elapsed/duration time, trash to discard, send.
export default function VoiceRecorderBar({
  isRecording, recordingTime, waveHeights,
  audioUrl, isLight, isUploading,
  onCancel, onStop, onSend,
}) {
  const cardBg = isLight ? '#ffffff' : '#1c1c24';
  const cardBorder = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)';
  const cardShadow = isLight ? '0 1px 4px rgba(15,23,42,0.08)' : '0 3px 12px rgba(0,0,0,0.35)';

  if (isRecording) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, borderRadius: 24, padding: '8px 8px 8px 14px' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700, minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>{formatRecordingTime(recordingTime)}</span>
        <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center', height: 24, overflow: 'hidden' }}>
          {waveHeights.map((h, i) => (
            <div key={i} style={{ width: 3, borderRadius: 3, background: isLight ? '#94a3b8' : 'rgba(255,255,255,0.35)', flexShrink: 0, height: `${Math.max(h, 10)}%`, transition: 'height 0.08s ease', minHeight: 3 }} />
          ))}
        </div>
        <button type="button" onClick={onCancel} title="Delete recording" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Trash2 size={18} />
        </button>
        <button type="button" onClick={onStop} title="Stop recording" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Check size={16} color="#fff" strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
    <VoicePreviewBar
      // Keyed by audioUrl: a fresh recording gets a fresh blob URL, and
      // remounting (rather than an effect resetting state on change) is the
      // simpler way to guarantee a clean play/pause/scrub state per take.
      key={audioUrl}
      audioUrl={audioUrl}
      isLight={isLight}
      isUploading={isUploading}
      onCancel={onCancel}
      onSend={onSend}
      cardBg={cardBg}
      cardBorder={cardBorder}
      cardShadow={cardShadow}
    />
  );
}

function VoicePreviewBar({ audioUrl, isLight, isUploading, onCancel, onSend, cardBg, cardBorder, cardShadow }) {
  const trackColor = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.14)';
  const subColor = isLight ? '#64748b' : 'rgba(255,255,255,0.5)';

  const audioRef = useRef(null);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play().catch(() => {});
  };

  const seekToClientX = (clientX) => {
    const track = trackRef.current;
    const el = audioRef.current;
    if (!track || !el || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t = ratio * duration;
    el.currentTime = t;
    setCurrentTime(t);
  };

  const onTrackPointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekToClientX(e.clientX);
  };
  const onTrackPointerMove = (e) => {
    if (!draggingRef.current) return;
    seekToClientX(e.clientX);
  };
  const endDrag = () => { draggingRef.current = false; };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timeLabel = fmt(isPlaying || currentTime > 0 ? currentTime : duration);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, borderRadius: 24, padding: '8px 14px 8px 8px' }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => { if (isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
        onTimeUpdate={(e) => { if (!draggingRef.current) setCurrentTime(e.currentTarget.currentTime); }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        {isPlaying ? <Pause size={15} color="#fff" fill="#fff" /> : <Play size={15} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />}
      </button>
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ flex: 1, height: 20, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
      >
        <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: trackColor }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, borderRadius: 2, background: 'linear-gradient(90deg,var(--brand-1),var(--brand-2))' }} />
          <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, width: 12, height: 12, borderRadius: '50%', background: 'var(--brand-1)', transform: 'translate(-50%,-50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
        </div>
      </div>
      <span style={{ fontSize: 11.5, color: subColor, minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {timeLabel}
      </span>
      <button type="button" onClick={onCancel} title="Delete recording" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Trash2 size={18} />
      </button>
      <button type="button" onClick={onSend} disabled={isUploading} title="Send" style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isUploading ? 'default' : 'pointer', flexShrink: 0, opacity: isUploading ? 0.7 : 1 }}>
        {isUploading ? <Loader2 size={15} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} color="#fff" />}
      </button>
    </div>
  );
}
