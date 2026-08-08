// CallContext.jsx — WhatsApp-style 1:1 voice/video calling for private chats.
//
// Mounted once at the App root (see App.jsx), independent of BottomNav's
// isStandalonePWA()-only gating, so incoming calls can ring on the regular
// mobile web, PWA, TWA, and APK builds alike — not just the installed-PWA
// tab bar context. Owns a dedicated socket.io connection (separate from
// GlobalChatWidget's own chat socket) purely for call:* signaling, so it
// never has to coordinate lifecycle with chat being open/closed anywhere.
//
// Signaling payloads (SDP offer/answer + ICE candidates) are wrapped with
// the same NaCl DM keypair already used for encrypted chat text
// (see lib/crypto.js) before they ever leave the client — the server only
// ever relays ciphertext it cannot read. The call media itself is protected
// by WebRTC's mandatory DTLS-SRTP, same guarantee as the app's existing
// room camera calls.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { encodeBase64 } from 'tweetnacl-util';
import { encryptDM, decryptDM } from '../lib/crypto';
import { useCrypto } from './CryptoContext';
import { API } from '../lib/api';
import { getAvatarUrl } from '../utils/avatarUtils';
import GlobalCallOverlay from '../components/GlobalCallOverlay';

// Marks a plain encrypted DM text message as a call-summary log rather than
// user-typed text — a control character sequence a human could never type,
// so it can never collide with real content. Exported so GlobalChatWidget
// can recognize + specially render it after normal decryption.
export const CALL_LOG_PREFIX = 'sahaplay_call';

const CallContext = createContext(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within <CallProvider>');
  return ctx;
}

const CAM_CONSTRAINTS = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } };

async function fetchIceServers() {
  const isLocalhost = /localhost|127\.0\.0\.1|^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|local$/i.test(window.location.hostname);
  if (isLocalhost) return [];
  const stunFallback = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  try {
    const token = localStorage.getItem('watch_token');
    const res = await fetch(`${API}/api/turn-credentials`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`turn-credentials returned ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) return data.iceServers;
    throw new Error('empty iceServers response');
  } catch (err) {
    console.warn('[Call] TURN credential fetch failed, falling back to STUN-only:', err.message);
    return stunFallback;
  }
}

function newCallId() {
  return 'call-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

async function fetchPublicKey(username) {
  const res = await fetch(`${API}/api/auth/public-key/${username}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.publicKey || null;
}

async function fetchUserBrief(username) {
  try {
    const res = await fetch(`${API}/api/users/${username}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { displayName: data.displayName || username, avatarUrl: getAvatarUrl(data.avatarPath) || null };
  } catch {
    return null;
  }
}

export function CallProvider({ children }) {
  const { keyPair, isReady: cryptoReady } = useCrypto();
  const keyPairRef = useRef(keyPair);
  useEffect(() => { keyPairRef.current = keyPair; }, [keyPair]);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceBufferRef = useRef([]); // buffered remote candidates until remoteDescription is set
  const peerPublicKeyRef = useRef(null);

  const [callState, setCallState] = useState(null);
  // { phase: 'outgoing'|'incoming'|'active', callId, type, peerUsername, peerDisplayName, peerAvatar, startedAt, answeredAt }
  const callStateRef = useRef(null);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [remoteMicOn, setRemoteMicOn] = useState(true);
  const [remoteCamOn, setRemoteCamOn] = useState(false);
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);

  const myUsername = (localStorage.getItem('watch_username') || '').replace(/^guest_/i, '');

  // ─── Socket lifecycle ───
  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (!token || token === 'null' || token === 'undefined' || isGuest || !cryptoReady) return;
    if (socketRef.current) return;

    const sock = io(API, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('call:incoming', async ({ callId, callerUsername, callType }) => {
      // Already on a call (shouldn't normally happen — server enforces busy) — ignore silently.
      if (callStateRef.current) return;
      peerPublicKeyRef.current = null;
      const brief = await fetchUserBrief(callerUsername);
      setCallState({
        phase: 'incoming',
        callId,
        type: callType,
        peerUsername: callerUsername,
        peerDisplayName: brief?.displayName || callerUsername,
        peerAvatar: brief?.avatarUrl || null,
        startedAt: Date.now(),
        answeredAt: null,
      });
    });

    // Below, "who writes the call-log message" is deliberately a single
    // writer per outcome (POST /api/chats/send fans the one message out to
    // BOTH sides already — see writeCallLog) to avoid duplicate log bubbles:
    // whichever side took the explicit action (cancel/decline/end) logs it
    // via its own imperative function; the other side's socket handler here
    // just tears down. The exception is an abrupt disconnect (reason ===
    // 'disconnect', set server-side) — there the acting side's client is
    // gone, so the surviving side logs it instead.
    sock.on('call:busy', ({ callId }) => {
      if (callStateRef.current?.callId !== callId) return;
      writeCallLog(callStateRef.current, 'busy');
      teardownCall();
    });

    sock.on('call:invalid', ({ callId }) => {
      if (callStateRef.current?.callId !== callId) return;
      teardownCall(); // never reached the other side — nothing worth logging
    });

    sock.on('call:cancelled', ({ callId, reason }) => {
      if (callStateRef.current?.callId !== callId) return;
      if (reason === 'disconnect') writeCallLog(callStateRef.current, 'missed');
      teardownCall();
    });

    sock.on('call:declined', ({ callId }) => {
      if (callStateRef.current?.callId !== callId) return;
      teardownCall();
    });

    sock.on('call:timeout', ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      if (cs.phase === 'outgoing') writeCallLog(cs, 'missed');
      teardownCall();
    });

    sock.on('call:answered', async ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || cs.phase !== 'outgoing') return;
      setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: Date.now() } : prev));
      await startMediaAndConnect({ isCaller: true, callId, peerUsername: cs.peerUsername, type: cs.type });
    });

    sock.on('call:offer', async ({ callId, sdp }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      try {
        const kp = keyPairRef.current;
        const plaintext = decryptDM(sdp.ciphertext, sdp.nonce, sdp.ephemeralPublicKey, encodeBase64(kp.secretKey));
        if (!plaintext) return;
        const { sdp: offerSdp } = JSON.parse(plaintext);
        // No-op if a connection already exists (e.g. this is a mid-call
        // renegotiation offer, not the initial one) — startMediaAndConnect
        // caches its promise, so this just awaits the existing connection.
        await startMediaAndConnect({ isCaller: false, callId, peerUsername: cs.peerUsername, type: cs.type });
        await pcRef.current.setRemoteDescription({ type: 'offer', sdp: offerSdp });
        await flushIceBuffer();
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        await sendSignal('call:answer', callId, cs.peerUsername, { type: 'answer', sdp: answer.sdp });
      } catch (e) {
        console.error('[Call] offer handling failed:', e);
      }
    });

    sock.on('call:answer', async ({ callId, sdp }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !pcRef.current) return;
      try {
        const kp = keyPairRef.current;
        const plaintext = decryptDM(sdp.ciphertext, sdp.nonce, sdp.ephemeralPublicKey, encodeBase64(kp.secretKey));
        if (!plaintext) return;
        const { sdp: answerSdp } = JSON.parse(plaintext);
        await pcRef.current.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        await flushIceBuffer();
      } catch (e) {
        console.error('[Call] answer handling failed:', e);
      }
    });

    sock.on('call:ice', async ({ callId, candidate }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      try {
        const kp = keyPairRef.current;
        const plaintext = decryptDM(candidate.ciphertext, candidate.nonce, candidate.ephemeralPublicKey, encodeBase64(kp.secretKey));
        if (!plaintext) return;
        const cand = JSON.parse(plaintext);
        if (!pcRef.current || !pcRef.current.remoteDescription) {
          iceBufferRef.current.push(cand);
        } else {
          await pcRef.current.addIceCandidate(cand).catch(() => {});
        }
      } catch (e) {
        console.error('[Call] ice handling failed:', e);
      }
    });

    sock.on('call:state', ({ callId, micOn, camOn }) => {
      if (callStateRef.current?.callId !== callId) return;
      setRemoteMicOn(!!micOn);
      setRemoteCamOn(!!camOn);
    });

    sock.on('call:ended', ({ callId, reason }) => {
      if (callStateRef.current?.callId !== callId) return;
      if (reason === 'disconnect') writeCallLog(callStateRef.current, 'ended');
      teardownCall();
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoReady]);

  // ─── Native "Answer" deep link (see nativeCallBridge.js / IncomingCallActivity.java) ───
  // Tapping Answer on the lock-screen call UI can't itself join the call (no
  // getUserMedia/WebRTC outside a WebView) — it just hands off here via
  // sahaplay://call-answer, and this auto-accepts the matching call once
  // this socket has confirmed (live, or via the reconnect-resync in
  // backend/server.js) that it's still actually ringing. Handles both
  // orderings: the deep link can arrive before or after 'call:incoming'
  // does, depending on how fast the app cold-starts vs. reconnects.
  const pendingAutoAnswerCallIdRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      const callId = e.detail?.callId;
      if (!callId) return;
      pendingAutoAnswerCallIdRef.current = callId;
      if (callStateRef.current?.callId === callId && callStateRef.current.phase === 'incoming') {
        acceptCall();
      }
    };
    window.addEventListener('native_call_answer', handler);
    return () => window.removeEventListener('native_call_answer', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (callState?.phase === 'incoming' && callState.callId === pendingAutoAnswerCallIdRef.current) {
      acceptCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  async function flushIceBuffer() {
    const buffered = iceBufferRef.current;
    iceBufferRef.current = [];
    for (const cand of buffered) {
      await pcRef.current?.addIceCandidate(cand).catch(() => {});
    }
  }

  const sendSignal = useCallback(async (event, callId, targetUsername, payload) => {
    const sock = socketRef.current;
    const kp = keyPairRef.current;
    if (!sock || !kp) return;
    if (!peerPublicKeyRef.current) peerPublicKeyRef.current = await fetchPublicKey(targetUsername);
    if (!peerPublicKeyRef.current) return;
    const enc = encryptDM(JSON.stringify(payload), peerPublicKeyRef.current, encodeBase64(kp.publicKey));
    const wrapped = { ciphertext: enc.ciphertext, nonce: enc.nonce, ephemeralPublicKey: enc.ephemeralPublicKey };
    if (event === 'call:offer' || event === 'call:answer') sock.emit(event, { callId, sdp: wrapped });
    else if (event === 'call:ice') sock.emit(event, { callId, candidate: wrapped });
  }, []);

  // ─── Media + RTCPeerConnection ───
  // connectPromiseRef caches the in-flight/completed connect so a second,
  // near-simultaneous call — e.g. acceptCall()'s proactive connect racing
  // the 'call:offer' handler's own fallback connect — awaits the SAME
  // RTCPeerConnection instead of racing to create a second one (and,
  // critically, doesn't proceed to use pcRef.current before it exists).
  const connectPromiseRef = useRef(null);
  function startMediaAndConnect(args) {
    if (!connectPromiseRef.current) connectPromiseRef.current = doConnect(args);
    return connectPromiseRef.current;
  }
  async function doConnect({ isCaller, callId, peerUsername, type }) {
    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    remoteStreamRef.current = new MediaStream();

    pc.ontrack = (e) => {
      remoteStreamRef.current.addTrack(e.track);
      setRemoteStreamVersion(v => v + 1);
      if (e.track.kind === 'video') setRemoteCamOn(true);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal('call:ice', callId, peerUsername, e.candidate.toJSON());
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { ...CAM_CONSTRAINTS, facingMode: 'user' } : false,
      });
    } catch (e) {
      console.error('[Call] getUserMedia failed:', e);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null);
    }
    if (stream) {
      localStreamRef.current = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      setIsMicOn(stream.getAudioTracks().some(t => t.enabled));
      setIsCamOn(stream.getVideoTracks().some(t => t.enabled));
      broadcastState(callId, peerUsername);
    }

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('call:offer', callId, peerUsername, { type: 'offer', sdp: offer.sdp });
    }
  }

  function broadcastState(callId, peerUsername) {
    socketRef.current?.emit('call:state', {
      callId,
      micOn: localStreamRef.current?.getAudioTracks().some(t => t.enabled) ?? false,
      camOn: localStreamRef.current?.getVideoTracks().some(t => t.enabled) ?? false,
    });
  }

  // ─── Encrypted call-summary chat message (renders as a WhatsApp-style
  // call bubble in GlobalChatWidget — see CALL_LOG_PREFIX there). Sent as a
  // perfectly ordinary encrypted DM text message (no mediaType) rather than
  // trying to piggyback on the media-message code path — that path assumes
  // an accompanying mediaUrl at several points and blanks decryptedText
  // whenever mediaType is set at all, which would silently break the
  // sender's own copy of this message. A recognizable plaintext prefix is
  // simpler and touches none of that fragile logic.
  async function writeCallLog(cs, status) {
    if (!cs || !cs.peerUsername) return;
    const token = localStorage.getItem('watch_token');
    const kp = keyPairRef.current;
    if (!token || !kp) return;
    try {
      const targetPubKey = peerPublicKeyRef.current || await fetchPublicKey(cs.peerUsername);
      if (!targetPubKey) return;
      const durationSeconds = cs.answeredAt ? Math.max(0, Math.round((Date.now() - cs.answeredAt) / 1000)) : 0;
      const payload = CALL_LOG_PREFIX + JSON.stringify({ callType: cs.type, status, durationSeconds, initiatedBy: cs.phase === 'outgoing' ? myUsername : cs.peerUsername });
      const enc = encryptDM(payload, targetPubKey, encodeBase64(kp.publicKey));
      await fetch(`${API}/api/chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'private',
          partner: cs.peerUsername,
          message: enc.ciphertext,
          senderMessage: enc.senderCiphertext,
          nonce: enc.nonce,
          ephemeralPublicKey: enc.ephemeralPublicKey,
          encrypted: true,
        }),
      });
    } catch (e) {
      console.error('[Call] writeCallLog failed:', e);
    }
  }

  function teardownCall() {
    try { pcRef.current?.getSenders().forEach(s => s.track && s.track.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    connectPromiseRef.current = null;
    try { localStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    iceBufferRef.current = [];
    peerPublicKeyRef.current = null;
    setRemoteMicOn(true);
    setRemoteCamOn(false);
    setIsMicOn(false);
    setIsCamOn(false);
    setCallState(null);
  }

  // ─── Public API ───
  const startCall = useCallback(async (peerUsername, type, peerDisplayName, peerAvatar) => {
    if (callStateRef.current || !socketRef.current) return;
    const callId = newCallId();
    peerPublicKeyRef.current = null;
    setCallState({
      phase: 'outgoing',
      callId,
      type,
      peerUsername,
      peerDisplayName: peerDisplayName || peerUsername,
      peerAvatar: peerAvatar || null,
      startedAt: Date.now(),
      answeredAt: null,
    });
    socketRef.current.emit('call:invite', { callId, calleeUsername: peerUsername, callType: type });
  }, []);

  const acceptCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'incoming' || !socketRef.current) return;
    socketRef.current.emit('call:accept', { callId: cs.callId });
    setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: Date.now() } : prev));
    startMediaAndConnect({ isCaller: false, callId: cs.callId, peerUsername: cs.peerUsername, type: cs.type });
  }, []);

  const declineCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'incoming') return;
    socketRef.current?.emit('call:decline', { callId: cs.callId });
    writeCallLog(cs, 'declined');
    teardownCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelOutgoingCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'outgoing') return;
    socketRef.current?.emit('call:cancel', { callId: cs.callId });
    writeCallLog(cs, 'missed');
    teardownCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs) return;
    socketRef.current?.emit('call:end', { callId: cs.callId });
    writeCallLog(cs, 'ended');
    teardownCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    const cs = callStateRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    const nowOn = stream.getAudioTracks().some(t => t.enabled);
    setIsMicOn(nowOn);
    if (cs) broadcastState(cs.callId, cs.peerUsername);
  }, []);

  // Adds a video track (voice → video upgrade, WhatsApp-style) the first
  // time, then just enables/disables it afterwards — avoids a second
  // getUserMedia + renegotiation cycle for every toggle.
  const toggleCamera = useCallback(async () => {
    const cs = callStateRef.current;
    const pc = pcRef.current;
    if (!cs || !pc) return;
    const stream = localStreamRef.current;
    const existingVideoTrack = stream?.getVideoTracks()[0];

    if (existingVideoTrack) {
      existingVideoTrack.enabled = !existingVideoTrack.enabled;
      setIsCamOn(existingVideoTrack.enabled);
      broadcastState(cs.callId, cs.peerUsername);
      return;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: 'user' } });
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) return;
      stream.addTrack(videoTrack);
      pc.addTrack(videoTrack, stream);
      setIsCamOn(true);
      setCallState(prev => (prev ? { ...prev, type: 'video' } : prev));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('call:offer', cs.callId, cs.peerUsername, { type: 'offer', sdp: offer.sdp });
      broadcastState(cs.callId, cs.peerUsername);
    } catch (e) {
      console.error('[Call] toggleCamera (add video) failed:', e);
    }
  }, [sendSignal]);

  // Same release-then-acquire, exact→soft fallback pattern used for the
  // room's own camera flip — concurrent dual-camera getUserMedia requests
  // are commonly rejected by mobile browsers/OS.
  const flipCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const pc = pcRef.current;
    const oldTrack = stream?.getVideoTracks()[0];
    if (!stream || !pc || !oldTrack) return;
    const currentFacing = oldTrack.getSettings?.().facingMode || 'user';
    const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    oldTrack.stop();
    stream.removeTrack(oldTrack);
    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: { exact: nextFacing } } });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: nextFacing } });
      }
      const newTrack = newStream.getVideoTracks()[0];
      stream.addTrack(newTrack);
      if (sender) await sender.replaceTrack(newTrack);
    } catch (e) {
      console.error('[Call] flipCamera failed, restoring previous camera:', e);
      try {
        const restored = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: currentFacing } });
        const restoredTrack = restored.getVideoTracks()[0];
        stream.addTrack(restoredTrack);
        if (sender) await sender.replaceTrack(restoredTrack);
      } catch (e2) {
        console.error('[Call] flipCamera restore also failed:', e2);
      }
    }
  }, []);

  const value = {
    callState,
    isMicOn,
    isCamOn,
    remoteMicOn,
    remoteCamOn,
    remoteStream: remoteStreamRef.current,
    remoteStreamVersion,
    localStream: localStreamRef.current,
    myUsername,
    startCall,
    acceptCall,
    declineCall,
    cancelOutgoingCall,
    endCall,
    toggleMic,
    toggleCamera,
    flipCamera,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <GlobalCallOverlay />
    </CallContext.Provider>
  );
}
