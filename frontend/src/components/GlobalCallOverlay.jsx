// GlobalCallOverlay.jsx — renders on top of everything (any route) whenever
// CallContext has an active call/ring state: the incoming "ringing" screen
// with Answer/Decline, the outgoing "Calling…" screen with Cancel, and the
// live call itself (OneOnOneCallScreen.jsx — a WhatsApp-style screen built
// specifically for 1:1 DM calls, separate from CallingActivity.jsx which
// the room's own multi-participant camera calls still use).
import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import OneOnOneCallScreen from './OneOnOneCallScreen';
import { getInitials } from '../utils/avatarUtils';
import { syncStatusBarTheme } from '../lib/nativeShell';
import { isPendingNativeCallAnswer } from '../lib/nativeCallBridge';

// Free, asset-free ring/ringback tone via Web Audio — the closest a pure web
// app can get to a real ringtone without native code. This only plays while
// the app is foregrounded and the WebView/tab has already had some user
// interaction (browser autoplay policy) — it covers plain web/PWA and the
// "app already open" case on Android. Backgrounded/fully-killed-app ringing
// on Android instead goes through IncomingCallActivity.java (native, plays
// the phone's own default ringtone) via a data-only FCM push — see
// SahaplayFirebaseMessagingService.java and CALL_RING_TIMEOUT_MS in
// backend/server.js. That path only exists in a build that includes it —
// dispatch "Android — Build Capacitor app (.aab)" and install the result to
// pick it up.
function useRingSound(active) {
  const stopRef = useRef(null);
  useEffect(() => {
    if (!active) { stopRef.current?.(); stopRef.current = null; return; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctx.resume?.().catch(() => {});
    let stopped = false;

    // Two-note ascending chime (D5 -> A5), warm triangle wave with an
    // exponential attack/decay envelope — reads as a real ring/ringback tone
    // instead of the flat single-frequency sine beep this replaced, closer
    // to the short chime cadence WhatsApp/Skype use for calling/ringing.
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };

    const playChime = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      playTone(587.33, now, 0.22);       // D5
      playTone(880.0, now + 0.2, 0.34);  // A5
    };

    playChime();
    const interval = setInterval(playChime, 2000);
    stopRef.current = () => { stopped = true; clearInterval(interval); ctx.close().catch(() => {}); };
    return () => stopRef.current?.();
  }, [active]);
}

function Avatar({ url, name, size = 96, pulsing }) {
  return (
    <div
      className={pulsing ? 'gco-avatar-pulse' : ''}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: url ? undefined : 'linear-gradient(135deg, var(--brand-1), var(--brand-2))',
        overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.34 }}>{getInitials(name)}</span>
      )}
    </div>
  );
}

function fmtDuration(secs) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Shown instead of the full call screen while "Send message" has minimized
// it — a small always-on-top bar (call keeps running underneath regardless;
// CallContext owns the RTCPeerConnections independently of this component's
// own visibility) so there's always a way back into the full call UI.
function MinimizedCallBar({ callState, onRestore, onEndCall }) {
  const [durationSecs, setDurationSecs] = useState(0);
  useEffect(() => {
    if (!callState.answeredAt) return;
    const tick = () => setDurationSecs(Math.floor((Date.now() - callState.answeredAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callState.answeredAt]);

  return (
    <div
      onClick={onRestore}
      style={{
        position: 'fixed', left: 12, right: 12,
        top: 'calc(10px + var(--sp-status-bar-inset, env(safe-area-inset-top, 0px)))',
        zIndex: 2147483500, display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(20,20,20,0.92)', borderRadius: 20, padding: '10px 14px',
        boxShadow: '0 10px 24px rgba(0,0,0,0.5)', cursor: 'pointer',
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}
    >
      <div className="gco-avatar-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {callState.peerDisplayName || callState.peerUsername}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
          {callState.answeredAt ? fmtDuration(durationSecs) : 'Connecting…'} — tap to return
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onEndCall(); }}
        title="End call"
        style={{
          width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <PhoneOff size={15} color="#fff" />
      </button>
    </div>
  );
}

export default function GlobalCallOverlay() {
  const call = useCall();
  const { callState } = call;
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  );

  // "Send message" minimizes this overlay (instead of hiding it entirely)
  // so the call keeps running - CallContext/its RTCPeerConnections are
  // mounted independently of whether this UI is showing - while the normal
  // chat UI becomes reachable underneath. A small floating bar stays on top
  // so there's always a way back into the full call screen. Resets whenever
  // there's no call to minimize, so a NEW call never starts already
  // minimized because of a stale flag from a previous one.
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { if (!callState) setMinimized(false); }, [callState]);
  const handleSendMessage = (peerUsername) => {
    if (!peerUsername) return;
    setMinimized(true);
    // Same event BottomNav.jsx already listens for (push-notification deep
    // link) — navigates home and opens this exact DM, a proven path rather
    // than a new one.
    window.dispatchEvent(new CustomEvent('open_chat_from_notification', { detail: { chatId: peerUsername, type: 'dm' } }));
  };

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsCoarsePointer(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', update); else mq.addListener(update);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', update); else mq.removeListener(update); };
  }, []);

  useRingSound(callState?.phase === 'incoming');
  useRingSound(callState?.phase === 'outgoing');

  // Every phase of this overlay (ringing or active) paints a permanently
  // dark background regardless of the user's own light/dark app theme
  // setting — call screens are dark on purpose, like every other calling
  // app. But the status bar's icon color otherwise only follows that theme
  // setting (see nativeShell.js's syncStatusBarTheme, called from App.jsx),
  // so a user on light theme got dark/black status bar icons rendered over
  // this always-dark call screen: invisible. Forcing 'dark' (white icons)
  // for as long as any call phase is showing, then restoring the real
  // theme's icons the moment it's gone, fixes that without touching the
  // theme-vs-icon mapping fix from before (that one was correct for every
  // normal page, just not for this permanently-dark surface).
  const showingCallSurface = !!callState && !minimized;
  useEffect(() => {
    if (!showingCallSurface) return;
    syncStatusBarTheme('dark');
    return () => {
      const savedTheme = localStorage.getItem('watch_theme') || 'dark';
      syncStatusBarTheme(savedTheme);
    };
  }, [showingCallSurface]);

  if (!callState) return null;

  const isVideo = callState.type === 'video';

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 2147483500,
    background: '#0b0f1a', color: '#fff',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Outfit', 'Inter', sans-serif",
  };

  if (minimized) {
    return (
      <MinimizedCallBar
        callState={callState}
        onRestore={() => setMinimized(false)}
        onEndCall={call.endCall}
      />
    );
  }

  if (callState.phase === 'active') {
    return (
      <div style={{ ...overlayStyle, borderRadius: 0 }}>
        <OneOnOneCallScreen
          mode={isVideo ? 'video' : 'voice'}
          isCamOn={call.isCamOn}
          isMicOn={call.isMicOn}
          localStream={call.localStream}
          myUsername={call.myUsername}
          myAvatarUrl={call.myAvatarUrl}
          callState={callState}
          remoteStreams={call.remoteStreams}
          participantMeta={call.participantMeta}
          toggleCamera={call.toggleCamera}
          toggleMic={call.toggleMic}
          flipCamera={call.flipCamera}
          isScreenSharing={call.isScreenSharing}
          startScreenShare={call.startScreenShare}
          stopScreenShare={call.stopScreenShare}
          audioRoute={call.audioRoute}
          setAudioRoute={call.setAudioRoute}
          bluetoothAudioAvailable={call.bluetoothAudioAvailable}
          addMemberToCall={call.addMemberToCall}
          isCoarsePointer={isCoarsePointer}
          onEndCall={call.endCall}
          onSendMessage={handleSendMessage}
        />
      </div>
    );
  }

  // ─── Incoming / Outgoing ringing screens ───
  const isIncoming = callState.phase === 'incoming';
  // Tapping Answer on the native lock-screen call UI already told us
  // (nativeCallBridge.js) which callId to auto-accept — if that's THIS call,
  // don't show the Answer/Decline prompt again just because this screen
  // hasn't caught up to CallContext's auto-accept yet. Showing it anyway is
  // exactly the "how many times do I have to click Answer" bug: the user
  // already answered once, natively.
  const isAutoAnswering = isIncoming && isPendingNativeCallAnswer(callState.callId);
  return (
    <div style={overlayStyle}>
      <style>{`
        @keyframes gco-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(var(--brand-1-rgb), 0.35); }
          50% { transform: scale(1.06); box-shadow: 0 0 0 18px rgba(var(--brand-1-rgb), 0); }
        }
        .gco-avatar-pulse { animation: gco-pulse 1.8s infinite ease-in-out; }
        .gco-ring-btn { width: 62px; height: 62px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s ease; }
        .gco-ring-btn:hover { transform: scale(1.08); }
        .gco-ring-btn:active { transform: scale(0.96); }
      `}</style>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}>
        <Avatar url={callState.peerAvatar} name={callState.peerDisplayName} size={112} pulsing />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>{callState.peerDisplayName}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
            {isAutoAnswering ? 'Connecting…' : isIncoming ? `Incoming ${isVideo ? 'video' : 'voice'} call…` : `Calling ${isVideo ? '(video)' : '(voice)'}…`}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isIncoming ? 56 : 0, paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
        {isAutoAnswering ? (
          <div className="gco-avatar-pulse" style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e' }} />
        ) : isIncoming ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <button className="gco-ring-btn" onClick={call.declineCall} style={{ background: '#ef4444' }} aria-label="Decline">
                <PhoneOff size={26} color="#fff" />
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Decline</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <button className="gco-ring-btn" onClick={call.acceptCall} style={{ background: '#22c55e' }} aria-label="Answer">
                {isVideo ? <Video size={26} color="#fff" /> : <Phone size={26} color="#fff" />}
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Answer</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button className="gco-ring-btn" onClick={call.cancelOutgoingCall} style={{ background: '#ef4444' }} aria-label="Cancel">
              <X size={26} color="#fff" />
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Cancel</span>
          </div>
        )}
      </div>
    </div>
  );
}
