// GlobalCallOverlay.jsx — renders on top of everything (any route) whenever
// CallContext has an active call/ring state: the incoming "ringing" screen
// with Answer/Decline, the outgoing "Calling…" screen with Cancel, and the
// live call itself (OneOnOneCallScreen.jsx — a WhatsApp-style screen built
// specifically for 1:1 DM calls, separate from CallingActivity.jsx which
// the room's own multi-participant camera calls still use).
import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, WifiOff } from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import OneOnOneCallScreen from './OneOnOneCallScreen';
import { getInitials } from '../utils/avatarUtils';
import { syncStatusBarTheme } from '../lib/nativeShell';
import { isPendingNativeCallAnswer } from '../lib/nativeCallBridge';
import { isAndroidApp } from '../lib/platform';

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
// isIncoming distinguishes "this is MY OWN phone ringing" (where a custom
// uploaded ringtone — see AppSettings.jsx's Sound section — applies) from
// the outgoing ringback tone (always the default chime, same as a real
// phone call never plays YOUR ringtone back at yourself while dialing out).
function useRingSound(active, isIncoming) {
  const stopRef = useRef(null);
  useEffect(() => {
    if (!active) { stopRef.current?.(); stopRef.current = null; return; }

    const ringtoneUrl = isIncoming ? localStorage.getItem('watch_ringtone_url') : null;
    if (ringtoneUrl) {
      const el = new Audio(ringtoneUrl);
      el.loop = true;
      el.play().catch(() => {});
      stopRef.current = () => { try { el.pause(); el.currentTime = 0; } catch {} };
      return () => stopRef.current?.();
    }

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
  }, [active, isIncoming]);
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
function MinimizedCallBar({ callState, networkStatus, onRestore, onEndCall }) {
  const [durationSecs, setDurationSecs] = useState(0);
  useEffect(() => {
    if (!callState.answeredAt) return;
    const tick = () => setDurationSecs(Math.floor((Date.now() - callState.answeredAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callState.answeredAt]);

  // Unlike the full ringing/active call screens (which stay permanently dark
  // on purpose, like every other calling app's immersive UI), this bar is a
  // small utility strip floating OVER whatever page you're browsing — it
  // needs to follow the app's own light/dark setting like every other
  // floating widget in the app, not fight it. Same data-theme + MutationObserver
  // pattern already used throughout this codebase (see PullToRefresh.jsx).
  const [isLight, setIsLight] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.getAttribute('data-theme') === 'light'));
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);

  const isPoor = networkStatus === 'poor';
  const statusColor = isPoor ? '#f59e0b' : '#22c55e';
  const textPrimary = isLight ? '#0f172a' : '#fff';
  const textSecondary = isLight ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.68)';
  const dividerColor = isLight ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.5)';

  return (
    <>
      {/* Standalone copy of the ringing-screen's pulse keyframes — that
          <style> tag only mounts on the incoming/outgoing branch below, which
          isn't rendered while minimized, so the status dot needs its own. */}
      <style>{`
        @keyframes gco-pulse-mini { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.75; } }
        .gco-avatar-pulse { animation: gco-pulse-mini 1.6s infinite ease-in-out; }
      `}</style>
      <div
      onClick={onRestore}
      style={{
        position: 'fixed', left: 12, right: 12,
        top: 'calc(10px + var(--sp-status-bar-inset, env(safe-area-inset-top, 0px)))',
        zIndex: 2147483500, display: 'flex', alignItems: 'center', gap: 10,
        background: isLight
          ? 'linear-gradient(160deg, rgba(255,255,255,0.96), rgba(241,245,249,0.96))'
          : 'linear-gradient(160deg, rgba(38,40,54,0.94), rgba(16,17,26,0.94))',
        border: isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderRadius: 999, padding: '8px 14px 8px 8px',
        boxShadow: isLight
          ? '0 10px 28px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.6)'
          : '0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        cursor: 'pointer', fontFamily: "'Outfit', 'Inter', sans-serif",
        // Explicitly matches whichever palette this bar is actually rendering
        // right now, so a WebView's algorithmic dark/light re-coloring pass
        // never "corrects" colors that already match its own background —
        // this is what fixed the light-mode-only invisible-text bug (the bar
        // used to hardcode a dark scheme regardless of the app's own theme).
        colorScheme: isLight ? 'light' : 'dark',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar url={callState.peerAvatar} name={callState.peerDisplayName || callState.peerUsername} size={38} />
        <div style={{
          position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: '50%',
          background: statusColor, border: `2px solid ${isLight ? '#fff' : '#171821'}`, boxShadow: `0 0 6px ${statusColor}`,
        }} className={isPoor ? '' : 'gco-avatar-pulse'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: textPrimary, fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {callState.peerDisplayName || callState.peerUsername}
        </div>
        <div style={{ color: isPoor ? '#f59e0b' : textSecondary, fontSize: 11.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPoor && <WifiOff size={11} color="#f59e0b" />}
          <span>{isPoor ? 'Poor connection' : (callState.answeredAt ? fmtDuration(durationSecs) : 'Connecting…')}</span>
          <span style={{ color: dividerColor }}>•</span>
          <span style={{ opacity: 0.9 }}>Tap to return</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onEndCall(); }}
        title="End call"
        style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(160deg, #f87171, #ef4444)',
          boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <PhoneOff size={16} color="#fff" />
      </button>
      </div>
    </>
  );
}

// Desktop/laptop equivalent of MinimizedCallBar above — a small circular
// "chat head" style bubble (Messenger-style) instead of a bar stretched
// across the full window width, which on a wide laptop window sat directly
// over the app's own top nav bar. Draggable anywhere on screen and snaps to
// whichever side edge it's closer to on release, with its position
// remembered across minimizes (not calls — see BUBBLE_POS_KEY) via
// localStorage. Only used for non-coarse-pointer (mouse/trackpad) viewports;
// touch devices keep the existing full-width bar, which was never reported
// as a problem there.
const BUBBLE_POS_KEY = 'sp_call_bubble_pos';
const BUBBLE_SIZE = 60;
const BUBBLE_MARGIN = 14;

function clampBubblePos(pos) {
  const maxX = Math.max(BUBBLE_MARGIN, window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN);
  const maxY = Math.max(BUBBLE_MARGIN, window.innerHeight - BUBBLE_SIZE - BUBBLE_MARGIN);
  return {
    x: Math.min(Math.max(pos.x, BUBBLE_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, BUBBLE_MARGIN), maxY),
  };
}

function loadBubblePos() {
  try {
    const raw = localStorage.getItem(BUBBLE_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return clampBubblePos(parsed);
    }
  } catch {}
  return clampBubblePos({ x: window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN, y: 84 });
}

function DraggableCallBubble({ callState, networkStatus, onRestore, onEndCall }) {
  const [durationSecs, setDurationSecs] = useState(0);
  useEffect(() => {
    if (!callState.answeredAt) return;
    const tick = () => setDurationSecs(Math.floor((Date.now() - callState.answeredAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callState.answeredAt]);

  const [pos, setPos] = useState(loadBubblePos);
  const posRef = useRef(pos);
  posRef.current = pos;
  const dragRef = useRef(null); // { startX, startY, originX, originY, moved }
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onResize = () => setPos(p => clampBubblePos(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const savePos = (next) => {
    try { localStorage.setItem(BUBBLE_POS_KEY, JSON.stringify(next)); } catch {}
  };

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // left click / primary touch only
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: posRef.current.x, originY: posRef.current.y, moved: false };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 5) { d.moved = true; setIsDragging(true); }
    if (d.moved) setPos(clampBubblePos({ x: d.originX + dx, y: d.originY + dy }));
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (!d) return;
    if (!d.moved) {
      // A real click/tap, not a drag — go back to the full call screen.
      onRestore();
      return;
    }
    // Chat-head style: settle against whichever side of the window it ended
    // up closer to, rather than leaving it floating mid-screen.
    setPos((p) => {
      const snapped = clampBubblePos({
        x: (p.x + BUBBLE_SIZE / 2) < window.innerWidth / 2 ? BUBBLE_MARGIN : window.innerWidth - BUBBLE_SIZE - BUBBLE_MARGIN,
        y: p.y,
      });
      savePos(snapped);
      return snapped;
    });
  };

  const isPoor = networkStatus === 'poor';
  const statusColor = isPoor ? '#f59e0b' : '#22c55e';
  const label = callState.peerDisplayName || callState.peerUsername;
  const statusText = isPoor ? 'Poor connection' : (callState.answeredAt ? fmtDuration(durationSecs) : 'Connecting…');

  return (
    <>
      <style>{`
        @keyframes gco-pulse-mini { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.75; } }
        .gco-avatar-pulse { animation: gco-pulse-mini 1.6s infinite ease-in-out; }
        .gco-bubble:hover .gco-bubble-tooltip { opacity: 1; transform: translateY(0); }
      `}</style>
      <div
        onPointerDown={handlePointerDown}
        title={`${label} — tap to return, drag to move`}
        className="gco-bubble"
        style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 2147483500,
          width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: '50%',
          cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
          boxShadow: isDragging
            ? '0 14px 32px rgba(0,0,0,0.4)'
            : '0 8px 22px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,255,255,0.12)',
          transition: isDragging ? 'none' : 'box-shadow 0.15s ease, transform 0.15s ease',
          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
          userSelect: 'none',
        }}
      >
        <Avatar url={callState.peerAvatar} name={label} size={BUBBLE_SIZE} />
        <div style={{
          position: 'absolute', top: -3, right: -3, width: 13, height: 13, borderRadius: '50%',
          background: statusColor, border: '2.5px solid #171821', boxShadow: `0 0 6px ${statusColor}`,
        }} className={isPoor ? '' : 'gco-avatar-pulse'} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEndCall(); }}
          title="End call"
          style={{
            position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', border: '2px solid #171821',
            background: 'linear-gradient(160deg, #f87171, #ef4444)', boxShadow: '0 2px 6px rgba(239,68,68,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          }}
        >
          <PhoneOff size={11} color="#fff" />
        </button>
        {/* Small label that appears just under the bubble on hover — the
            bubble itself is too small to show name/duration text at rest,
            same info the mobile bar always shows inline. */}
        <div
          className="gco-bubble-tooltip"
          style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, -4px)',
            marginTop: 8, padding: '6px 10px', borderRadius: 10, whiteSpace: 'nowrap',
            background: 'rgba(20,21,31,0.95)', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)', pointerEvents: 'none',
            opacity: 0, transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
        >
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 12.5 }}>{label}</div>
          <div style={{ color: isPoor ? '#f59e0b' : 'rgba(255,255,255,0.65)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            {isPoor && <WifiOff size={10} color="#f59e0b" />}
            {statusText}
          </div>
        </div>
      </div>
    </>
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
  // Tracks which callId this effect has already reacted to, so it only
  // decides the starting minimized/full state ONCE per call — every other
  // callState update (mic toggle, remote stream arriving, etc.) re-runs this
  // effect too since callState is a new object each time, but must never
  // re-force minimized back on after the user has manually restored the
  // full screen mid-call.
  const seenCallIdRef = useRef(null);
  useEffect(() => {
    if (!callState) { setMinimized(false); seenCallIdRef.current = null; return; }
    if (callState.callId === seenCallIdRef.current) return;
    seenCallIdRef.current = callState.callId;
    // A call resynced after the app reopened/reloaded (see CallContext.jsx's
    // call:resync handler) starts minimized — surfacing a "tap to return"
    // bar rather than yanking the user into a full call screen the instant
    // the app happens to open on some unrelated page.
    setMinimized(!!callState.restoredMinimized);
  }, [callState]);
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

  // On Android, IncomingCallActivity.java already rings (phone's own
  // ringtone, full-screen even over a locked/foregrounded app) for every
  // incoming call — this Web Audio ringback would just double up on top of
  // it, so it's skipped there entirely rather than raced against.
  useRingSound(callState?.phase === 'incoming' && !isAndroidApp(), true);
  useRingSound(callState?.phase === 'outgoing', false);

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
  // On Android, an incoming call is always presented by IncomingCallActivity
  // first — either its own full-screen ring Activity (locked, backgrounded,
  // or killed) or, when the app is already in the foreground, a system
  // heads-up notification banner (Android deliberately does NOT auto-launch
  // a full-screen-intent Activity over an app the user is actively looking
  // at — it shows the notification instead and lets them tap it). Either
  // way, real working Answer/Decline controls are already on screen from
  // the OS itself. This overlay rendering its OWN "incoming" UI underneath
  // that was always redundant when the full-screen Activity had already
  // shown, and outright broken/confusing when only the heads-up banner had
  // (previously rendered a bare pulsing dot with no way to answer from
  // inside the app at all — the ONLY working Answer button was the one on
  // the notification). Rendering nothing here for the whole 'incoming'
  // phase on Android fixes both: nothing to show or hide, and once
  // acceptCall() flips the phase to 'active' (whether triggered by the
  // notification's own Answer action, the full-screen Activity's, or
  // Telecom), the real call screen just appears directly — no intermediate
  // screen, matching how WhatsApp goes straight from the system ring UI to
  // the live call.
  const hideForNativeIncoming = callState?.phase === 'incoming' && isAndroidApp();

  const showingCallSurface = !!callState && !minimized && !hideForNativeIncoming;
  useEffect(() => {
    if (!showingCallSurface) return;
    syncStatusBarTheme('dark');
    return () => {
      const savedTheme = localStorage.getItem('watch_theme') || 'dark';
      syncStatusBarTheme(savedTheme);
    };
  }, [showingCallSurface]);

  if (!callState || hideForNativeIncoming) return null;

  const isVideo = callState.type === 'video';

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 2147483500,
    background: '#0b0f1a', color: '#fff',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    // See OneOnOneCallScreen.jsx's matching comment — tells the WebView this
    // permanently-dark surface already handles its own styling, so some
    // OEMs' algorithmic WebView dark-mode re-coloring doesn't dim its text.
    colorScheme: 'dark',
  };

  if (minimized) {
    const Minimized = isCoarsePointer ? MinimizedCallBar : DraggableCallBubble;
    return (
      <Minimized
        callState={callState}
        networkStatus={call.networkStatus}
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
          networkStatus={call.networkStatus}
          toggleCamera={call.toggleCamera}
          toggleMic={call.toggleMic}
          flipCamera={call.flipCamera}
          isFlippingCamera={call.isFlippingCamera}
          isScreenSharing={call.isScreenSharing}
          screenShareStream={call.screenShareStream}
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
  // Android incoming calls never reach this point at all — see
  // hideForNativeIncoming above. This "incoming" branch below only still
  // runs for web/PWA/iOS-someday, where there's no native ring screen and
  // this IS the only way to answer/decline.
  const isIncoming = callState.phase === 'incoming';
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
              <PhoneOff size={26} color="#fff" />
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Cancel</span>
          </div>
        )}
      </div>
    </div>
  );
}
