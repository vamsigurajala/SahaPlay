// CallContext.jsx — WhatsApp-style voice/video calling for private chats,
// starting as 1:1 and optionally growing into a small mesh group call via
// "Add to call".
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
//
// Group calling architecture: rather than one shared connection, each
// participant holds a DIRECT RTCPeerConnection to every OTHER participant
// (a mesh) — no server-side media relay exists in this app, so this is the
// only topology possible without adding one. Each of those pairwise
// connections is end-to-end encrypted exactly like the base 1:1 case (its
// own NaCl-wrapped SDP/ICE exchange, keyed to that specific person's public
// key) — group calling doesn't weaken the encryption model at all, it just
// runs the same pairwise handshake N times. This scales fine for the small
// group sizes ("add a person or two") this feature is built for; a real
// SFU would be needed for anything larger, which is out of scope here.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { encodeBase64 } from 'tweetnacl-util';
import { encryptDM, decryptDM } from '../lib/crypto';
import { useCrypto } from './CryptoContext';
import { API } from '../lib/api';
import { getAvatarUrl } from '../utils/avatarUtils';
import { setNativeAudioRoute, resetNativeAudioRoute, isNativeBluetoothAudioAvailable } from '../lib/nativeMedia';
import { peekPendingNativeCallAnswer, clearPendingNativeCallAnswer } from '../lib/nativeCallBridge';
import GlobalCallOverlay from '../components/GlobalCallOverlay';

// Marks a plain encrypted DM text message as a call-summary log rather than
// user-typed text — a control character sequence a human could never type,
// so it can never collide with real content. Exported so GlobalChatWidget
// can recognize + specially render it after normal decryption.
export const CALL_LOG_PREFIX = 'sahaplay_call';

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
  // Per-peer mesh state — keyed by the OTHER participant's lowercased
  // username. localStreamRef stays singular: one mic/camera capture, shared
  // as the track source across every peer connection in the mesh.
  const pcsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  // Tracked explicitly rather than read back from the camera track's own
  // getSettings().facingMode - that field is unreliably reported (often
  // just undefined) on a lot of Android Chromium/WebView builds, which made
  // flipCamera() below always fall back to assuming 'user' and therefore
  // always request 'environment' again on every tap, never actually
  // toggling back to the front camera.
  const currentFacingRef = useRef('user');
  const remoteStreamsRef = useRef(new Map());
  const iceBuffersRef = useRef(new Map()); // username -> buffered candidates until that peer's remoteDescription is set
  const peerPublicKeysRef = useRef(new Map());
  const connectPromisesRef = useRef(new Map()); // per-peer connect caching — see connectToPeer
  // People I personally added to this call who are currently active —
  // username -> joinedAt (ms). Used to write a call-log message into MY OWN
  // DM with each of them once they (or I) leave, separate from the original
  // caller/callee pair's own call-log message. See writeCallLogTo.
  const myInviteesRef = useRef(new Map());
  // True once callState.peerUsername (the original other party in MY OWN
  // call — "who I'm calling," or "who invited me") has left the call
  // before I have, in a call that outlived them. Without this, if I later
  // also leave, my own explicit-leave logging would write a second,
  // wrongly-inflated-duration call-log message to their (already-departed)
  // relationship — they already logged their own accurate exit when they
  // left; see the call:member-left handler.
  const peerGoneRef = useRef(false);

  const [callState, setCallState] = useState(null);
  // { phase: 'outgoing'|'incoming'|'active', callId, type, peerUsername,
  //   peerDisplayName, peerAvatar, startedAt, answeredAt,
  //   isGroupJoin: true if this incoming call is "join an existing call"
  //     rather than a fresh 1:1 (peerUsername is then "who invited me"),
  //   groupMembers: [{username, displayName, avatarUrl}] — everyone in the
  //     call beyond the original caller/callee pair. }
  const callStateRef = useRef(null);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  // Per-participant mic/cam state, keyed by username — covers the original
  // peer and every added member uniformly.
  const [participantMeta, setParticipantMeta] = useState({});
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);
  // 'earpiece' | 'speaker' | 'bluetooth' — WhatsApp-style default: voice
  // calls start on the earpiece, video calls start on speaker (you're
  // usually holding the phone up to look at the screen, not your ear).
  const [audioRoute, setAudioRouteState] = useState('earpiece');
  const [bluetoothAudioAvailable, setBluetoothAudioAvailable] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState(null);

  const myUsername = (localStorage.getItem('watch_username') || '').replace(/^guest_/i, '');

  // Own avatar for the call screen's "your avatar is shown to them" PiP/main
  // tile — fetched once (rarely changes) rather than re-fetched per call.
  useEffect(() => {
    if (!myUsername) return;
    fetchUserBrief(myUsername).then(brief => { if (brief?.avatarUrl) setMyAvatarUrl(brief.avatarUrl); });
  }, [myUsername]);

  // ─── Socket lifecycle ───
  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (!token || token === 'null' || token === 'undefined' || isGuest || !cryptoReady) return;
    if (socketRef.current) return;

    const sock = io(API, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('call:incoming', async ({ callId, callerUsername, callType, groupParticipants }) => {
      // Already on a call (shouldn't normally happen — server enforces busy) — ignore silently.
      if (callStateRef.current) return;
      peerPublicKeysRef.current = new Map();
      peerGoneRef.current = false;
      const brief = await fetchUserBrief(callerUsername);
      // groupParticipants (when present) is the full list of everyone
      // already active in the call, INCLUDING whoever is inviting me — see
      // backend/server.js's call:add-member, which computes it before
      // adding me. That's exactly who I'll need to connect to once I join.
      let groupMembers = [];
      if (Array.isArray(groupParticipants) && groupParticipants.length > 0) {
        groupMembers = await Promise.all(groupParticipants.map(async (u) => {
          const b = await fetchUserBrief(u);
          return { username: u, displayName: b?.displayName || u, avatarUrl: b?.avatarUrl || null };
        }));
      }
      setCallState({
        phase: 'incoming',
        callId,
        type: callType,
        peerUsername: callerUsername,
        peerDisplayName: brief?.displayName || callerUsername,
        peerAvatar: brief?.avatarUrl || null,
        startedAt: Date.now(),
        answeredAt: null,
        isGroupJoin: groupMembers.length > 0,
        groupMembers,
      });
    });

    // Below, "who writes the call-log message" is deliberately a single
    // writer per outcome (POST /api/chats/send fans the one message out to
    // BOTH sides already — see writeCallLog) to avoid duplicate log bubbles:
    // whichever side took the explicit action (cancel/decline/end) logs it
    // via its own imperative function; the other side's socket handler here
    // just tears down. The exception is an abrupt disconnect (reason ===
    // 'disconnect', set server-side) — there the acting side's client is
    // gone, so the surviving side logs it instead. Call-log messages only
    // ever cover the ORIGINAL 1:1 pair's chat — added members joining/
    // leaving a call don't have a group chat to log into, so those events
    // (call:member-*) intentionally never call writeCallLog.
    sock.on('call:busy', ({ callId }) => {
      if (callStateRef.current?.callId !== callId) return;
      writeCallLog(callStateRef.current, 'busy');
      teardownCall();
    });

    sock.on('call:invalid', ({ callId, reason }) => {
      if (callStateRef.current?.callId !== callId) return;
      if (reason === 'not_friends') toast('You can only add mutual friends to a call');
      else if (reason === 'blocked') toast('Could not add that person to the call');
      else if (reason === 'already_in_call') toast('They’re already in this call');
      teardownCall();
    });

    sock.on('call:cancelled', ({ callId, reason }) => {
      if (callStateRef.current?.callId !== callId) return;
      if (reason === 'disconnect') writeCallLog(callStateRef.current, 'missed');
      teardownCall();
    });

    sock.on('call:declined', ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      // The caller had no visible feedback at all when the other side
      // declined - the ringing screen just silently disappeared, with
      // nothing to tell them what happened.
      toast(`${cs.peerDisplayName || cs.peerUsername} declined the call`);
      teardownCall();
    });

    sock.on('call:timeout', ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      if (cs.phase === 'outgoing') {
        writeCallLog(cs, 'missed');
        toast(`${cs.peerDisplayName || cs.peerUsername} didn’t answer`);
      }
      teardownCall();
    });

    sock.on('call:answered', async ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || cs.phase !== 'outgoing') return;
      setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: Date.now() } : prev));
      await connectToPeer(cs.peerUsername, { isCaller: true, callId, type: cs.type });
    });

    sock.on('call:offer', async ({ callId, fromUsername, sdp }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !fromUsername) return;
      try {
        const kp = keyPairRef.current;
        const plaintext = decryptDM(sdp.ciphertext, sdp.nonce, sdp.ephemeralPublicKey, encodeBase64(kp.secretKey));
        if (!plaintext) return;
        const { sdp: offerSdp } = JSON.parse(plaintext);
        // No-op if a connection to this peer already exists (e.g. this is a
        // mid-call renegotiation offer, not the initial one) —
        // connectToPeer caches its promise per-peer, so this just awaits it.
        await connectToPeer(fromUsername, { isCaller: false, callId, type: cs.type });
        const pc = pcsRef.current.get(fromUsername);
        if (!pc) return;
        await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
        await flushIceBuffer(fromUsername);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('call:answer', callId, fromUsername, { type: 'answer', sdp: answer.sdp });
      } catch (e) {
        console.error('[Call] offer handling failed:', e);
      }
    });

    sock.on('call:answer', async ({ callId, fromUsername, sdp }) => {
      const cs = callStateRef.current;
      const pc = fromUsername ? pcsRef.current.get(fromUsername) : null;
      if (!cs || cs.callId !== callId || !pc) return;
      try {
        const kp = keyPairRef.current;
        const plaintext = decryptDM(sdp.ciphertext, sdp.nonce, sdp.ephemeralPublicKey, encodeBase64(kp.secretKey));
        if (!plaintext) return;
        const { sdp: answerSdp } = JSON.parse(plaintext);
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        await flushIceBuffer(fromUsername);
      } catch (e) {
        console.error('[Call] answer handling failed:', e);
      }
    });

    sock.on('call:ice', async ({ callId, fromUsername, candidate }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !fromUsername) return;
      try {
        const kp = keyPairRef.current;
        const plaintext = decryptDM(candidate.ciphertext, candidate.nonce, candidate.ephemeralPublicKey, encodeBase64(kp.secretKey));
        if (!plaintext) return;
        const cand = JSON.parse(plaintext);
        const pc = pcsRef.current.get(fromUsername);
        if (!pc || !pc.remoteDescription) {
          if (!iceBuffersRef.current.has(fromUsername)) iceBuffersRef.current.set(fromUsername, []);
          iceBuffersRef.current.get(fromUsername).push(cand);
        } else {
          await pc.addIceCandidate(cand).catch(() => {});
        }
      } catch (e) {
        console.error('[Call] ice handling failed:', e);
      }
    });

    sock.on('call:state', ({ callId, fromUsername, micOn, camOn }) => {
      if (callStateRef.current?.callId !== callId || !fromUsername) return;
      setParticipantMeta(prev => ({ ...prev, [fromUsername]: { micOn: !!micOn, camOn: !!camOn } }));
    });

    sock.on('call:ended', ({ callId, reason }) => {
      const cs = callStateRef.current;
      if (cs?.callId !== callId) return;
      // peerGoneRef guards against double-logging: if my own direct peer
      // already left earlier in a call that outlived them (see
      // call:member-left), they logged their own exit already — this
      // final call:ended is the server cascading ME out too (e.g. the call
      // dropped below 2 people), not a fresh reason to log the same
      // relationship again.
      if (reason === 'disconnect' && !peerGoneRef.current) writeCallLog(cs, 'ended');
      teardownCall();
    });

    // ─── Group calling ("Add to call") ───
    // Someone else in the call invited a new person — nothing to connect to
    // yet (they haven't joined), this is purely informational.
    sock.on('call:member-invited', () => {});

    // A person I (or someone else) invited has joined — I wait for THEM to
    // send me an offer (handled by the generic call:offer handler above,
    // which lazily creates a connection for an unrecognized fromUsername)
    // rather than racing to connect myself; the newly-joining side is
    // always the one that initiates, see call:joined-call below.
    sock.on('call:member-joined', async ({ callId, username, invitedBy }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !username) return;
      // I'm the one who added them — track when, so I can write a call-log
      // message to our own DM once they (or I) leave the call. Everyone
      // else in the call just renders them; only their actual inviter logs
      // this specific relationship.
      if (invitedBy === myUsername) myInviteesRef.current.set(username, { joinedAt: Date.now() });
      const brief = await fetchUserBrief(username);
      setCallState(prev => {
        if (!prev || prev.callId !== callId) return prev;
        if ((prev.groupMembers || []).some(m => m.username === username)) return prev;
        return { ...prev, groupMembers: [...(prev.groupMembers || []), { username, displayName: brief?.displayName || username, avatarUrl: brief?.avatarUrl || null }] };
      });
    });

    // I just joined an existing call as an added member — server tells me
    // exactly who's already there; I initiate the offer to each of them
    // (mirrors the base 1:1 flow, where the original caller — the side that
    // was "already waiting" — is the one call:answered triggers to offer).
    sock.on('call:joined-call', async ({ callId, participants, type }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: Date.now() } : prev));
      for (const username of participants || []) {
        connectToPeer(username, { isCaller: true, callId, type: type || cs.type });
      }
    });

    sock.on('call:member-left', ({ callId, username, reason }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !username) return;
      closePeerConnection(username);
      setCallState(prev => (prev ? { ...prev, groupMembers: (prev.groupMembers || []).filter(m => m.username !== username) } : prev));
      if (reason === 'missed') toast(`${username} didn’t answer`);
      else if (reason === 'declined') toast(`${username} declined`);

      // Call-log routing for someone I personally invited: they log their
      // own side when THEY explicitly leave/decline (their own endCall/
      // declineCall already does this — see below), so this only needs to
      // fire when I'm the survivor of an abrupt disconnect (no client of
      // theirs left to log it). Non-disconnect departures are intentionally
      // skipped here to avoid writing the same call-log message twice.
      const invitee = myInviteesRef.current.get(username);
      if (invitee) {
        myInviteesRef.current.delete(username);
        if (reason === 'disconnect') {
          writeCallLogTo(username, cs.type, 'ended', Math.max(0, Math.round((Date.now() - invitee.joinedAt) / 1000)));
        }
      }
      // My own direct peer left before I did — whether that's "whoever
      // invited me" (isGroupJoin) or "the original other party" (core
      // caller/callee), in a call that outlived them. They already logged
      // their own accurate exit via their own explicit leave (endCall/
      // declineCall) unless this was an abrupt disconnect, in which case
      // there's no client of theirs left to have logged it — I do it
      // instead, same "survivor logs it" rule used everywhere else. Setting
      // peerGoneRef either way stops MY OWN later endCall() from writing a
      // second, wrongly-inflated-duration message once I finally leave too.
      if (username === cs.peerUsername) {
        peerGoneRef.current = true;
        if (reason === 'disconnect') writeCallLog(cs, 'ended');
      }
    });

    sock.on('call:member-busy', ({ username }) => {
      toast(`${username} is on another call`);
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
    // Covers the cold-start race where nativeCallBridge.js's 'appUrlOpen'
    // listener (registered in main.jsx, before React even mounts) fires and
    // dispatches 'native_call_answer' before this effect has run to listen
    // for it — the event itself would otherwise be lost with nothing
    // attached yet. consumePendingNativeCallAnswer() reads (and clears) the
    // same callId stashed on `window` at dispatch time, so it's picked up
    // here regardless of which side won that race.
    const pending = peekPendingNativeCallAnswer();
    if (pending) handler({ detail: { callId: pending } });
    return () => window.removeEventListener('native_call_answer', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (callState?.phase === 'incoming' && callState.callId === pendingAutoAnswerCallIdRef.current) {
      acceptCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  async function flushIceBuffer(username) {
    const buffered = iceBuffersRef.current.get(username);
    if (!buffered) return;
    iceBuffersRef.current.delete(username);
    const pc = pcsRef.current.get(username);
    for (const cand of buffered) {
      await pc?.addIceCandidate(cand).catch(() => {});
    }
  }

  const sendSignal = useCallback(async (event, callId, targetUsername, payload) => {
    const sock = socketRef.current;
    const kp = keyPairRef.current;
    if (!sock || !kp || !targetUsername) return;
    let pubKey = peerPublicKeysRef.current.get(targetUsername);
    if (!pubKey) {
      pubKey = await fetchPublicKey(targetUsername);
      if (pubKey) peerPublicKeysRef.current.set(targetUsername, pubKey);
    }
    if (!pubKey) return;
    const enc = encryptDM(JSON.stringify(payload), pubKey, encodeBase64(kp.publicKey));
    const wrapped = { ciphertext: enc.ciphertext, nonce: enc.nonce, ephemeralPublicKey: enc.ephemeralPublicKey };
    if (event === 'call:offer' || event === 'call:answer') sock.emit(event, { callId, targetUsername, sdp: wrapped });
    else if (event === 'call:ice') sock.emit(event, { callId, targetUsername, candidate: wrapped });
  }, []);

  // ─── Local media (shared capture, one mic/camera feed sent to every peer) ───
  async function ensureLocalStream(type) {
    if (localStreamRef.current) return localStreamRef.current;
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
      currentFacingRef.current = 'user';
      setIsMicOn(stream.getAudioTracks().some(t => t.enabled));
      setIsCamOn(stream.getVideoTracks().some(t => t.enabled));
    }
    return stream;
  }

  // ─── Per-peer RTCPeerConnection (the mesh) ───
  // connectPromisesRef caches the in-flight/completed connect PER PEER so a
  // second, near-simultaneous connect attempt to the SAME person — e.g. the
  // 'call:offer' handler's fallback connect racing an explicit caller-side
  // connect — awaits the SAME RTCPeerConnection instead of racing to create
  // a second one (and, critically, doesn't proceed to use it before it
  // exists). Different peers always get independent connections/promises.
  function connectToPeer(targetUsername, args) {
    if (!connectPromisesRef.current.has(targetUsername)) {
      connectPromisesRef.current.set(targetUsername, doConnect(targetUsername, args));
    }
    return connectPromisesRef.current.get(targetUsername);
  }

  async function doConnect(targetUsername, { isCaller, callId, type }) {
    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    pcsRef.current.set(targetUsername, pc);
    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(targetUsername, remoteStream);

    pc.ontrack = (e) => {
      remoteStream.addTrack(e.track);
      setRemoteStreamVersion(v => v + 1);
      if (e.track.kind === 'video') {
        setParticipantMeta(prev => ({ ...prev, [targetUsername]: { ...(prev[targetUsername] || {}), camOn: true } }));
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal('call:ice', callId, targetUsername, e.candidate.toJSON());
    };

    const stream = await ensureLocalStream(type);
    if (stream) {
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      broadcastState(callId);
    }

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('call:offer', callId, targetUsername, { type: 'offer', sdp: offer.sdp });
    }
  }

  // Tears down and forgets ONE peer's connection only — used when a single
  // added member leaves/is removed while the rest of the call continues.
  // Deliberately does NOT touch localStreamRef: the mic/camera capture is
  // shared across the whole mesh, closing one peer connection must never
  // stop it for everyone else still on the call.
  function closePeerConnection(username) {
    const pc = pcsRef.current.get(username);
    if (pc) { try { pc.close(); } catch {} }
    pcsRef.current.delete(username);
    remoteStreamsRef.current.delete(username);
    iceBuffersRef.current.delete(username);
    connectPromisesRef.current.delete(username);
    peerPublicKeysRef.current.delete(username);
    setParticipantMeta(prev => { const next = { ...prev }; delete next[username]; return next; });
    setRemoteStreamVersion(v => v + 1);
  }

  function broadcastState(callId) {
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
  // simpler and touches none of that fragile logic. Always logs against the
  // ORIGINAL 1:1 pair's chat — see the note above the socket handlers.
  async function writeCallLog(cs, status) {
    if (!cs || !cs.peerUsername) return;
    const durationSeconds = cs.answeredAt ? Math.max(0, Math.round((Date.now() - cs.answeredAt) / 1000)) : 0;
    await writeCallLogTo(cs.peerUsername, cs.type, status, durationSeconds, cs.phase === 'outgoing' ? myUsername : cs.peerUsername);
  }

  // Generalized form of the above — writes a call-summary message to MY DM
  // with `targetUsername` specifically, rather than always the original
  // 1:1 peer. Used for people added to the call mid-way: whoever added them
  // gets this in THEIR OWN DM with that person once the two of them stop
  // being on the call together, separate from (and in addition to) the
  // original caller/callee pair's own call-log message.
  async function writeCallLogTo(targetUsername, callType, status, durationSeconds, initiatedBy) {
    if (!targetUsername) return;
    const token = localStorage.getItem('watch_token');
    const kp = keyPairRef.current;
    if (!token || !kp) return;
    try {
      const targetPubKey = peerPublicKeysRef.current.get(targetUsername) || await fetchPublicKey(targetUsername);
      if (!targetPubKey) return;
      const payload = CALL_LOG_PREFIX + JSON.stringify({ callType, status, durationSeconds, initiatedBy: initiatedBy || myUsername });
      const enc = encryptDM(payload, targetPubKey, encodeBase64(kp.publicKey));
      await fetch(`${API}/api/chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'private',
          partner: targetUsername,
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
    clearPendingNativeCallAnswer();
    for (const pc of pcsRef.current.values()) { try { pc.close(); } catch {} }
    pcsRef.current.clear();
    remoteStreamsRef.current.clear();
    iceBuffersRef.current.clear();
    connectPromisesRef.current.clear();
    peerPublicKeysRef.current.clear();
    myInviteesRef.current.clear();
    try { localStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    localStreamRef.current = null;
    setParticipantMeta({});
    setIsMicOn(false);
    setIsCamOn(false);
    setCallState(null);
    resetNativeAudioRoute();
    setAudioRouteState('earpiece');
  }

  // ─── Public API ───
  const startCall = useCallback(async (peerUsername, type, peerDisplayName, peerAvatar) => {
    if (callStateRef.current || !socketRef.current) return;
    const callId = newCallId();
    peerPublicKeysRef.current = new Map();
    peerGoneRef.current = false;
    setCallState({
      phase: 'outgoing',
      callId,
      type,
      peerUsername,
      peerDisplayName: peerDisplayName || peerUsername,
      // Callers pass activeChat.partnerAvatar straight from the chat list,
      // which (unlike fetchUserBrief's result used on the callee side below)
      // isn't guaranteed to already be resolved to an absolute URL — run it
      // through the same resolver so both sides of the call see a real image
      // instead of a broken relative path for legacy local-stored avatars.
      peerAvatar: getAvatarUrl(peerAvatar) || null,
      startedAt: Date.now(),
      answeredAt: null,
      isGroupJoin: false,
      groupMembers: [],
    });
    socketRef.current.emit('call:invite', { callId, calleeUsername: peerUsername, callType: type });
  }, []);

  const acceptCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'incoming' || !socketRef.current) return;
    clearPendingNativeCallAnswer();
    if (cs.isGroupJoin) {
      // Who to connect to is confirmed by the server's own reply
      // (call:joined-call) rather than acted on here — the groupMembers
      // snapshot on callState was taken at invite time and could be stale
      // by the time I actually accept.
      socketRef.current.emit('call:member-join', { callId: cs.callId });
      setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: Date.now() } : prev));
    } else {
      socketRef.current.emit('call:accept', { callId: cs.callId });
      setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: Date.now() } : prev));
      connectToPeer(cs.peerUsername, { isCaller: false, callId: cs.callId, type: cs.type });
    }
  }, []);

  const declineCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'incoming') return;
    if (cs.isGroupJoin) {
      socketRef.current?.emit('call:member-decline', { callId: cs.callId });
    } else {
      socketRef.current?.emit('call:decline', { callId: cs.callId });
      writeCallLog(cs, 'declined');
    }
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

  // Leaving a call — ANY current participant, core or added, just removes
  // themselves; the server (leaveActiveCall) only ends the whole call
  // completely once that would leave fewer than 2 people in it. So the
  // original caller can hang up on a call they grew to 3 people and the
  // other two keep talking, instead of it always ending for everyone.
  //
  // Call-log writing on the way out, one message per relationship I'm
  // responsible for:
  // - The original 1:1 pair's chat, if I'm the original caller/callee
  //   (unchanged from before "Add to call" existed).
  // - My inviter's chat, if I was added to this call myself — previously
  //   missing entirely; an added member leaving wrote no log at all.
  // - My own DM with each person *I* added who's still on the call — see
  //   myInviteesRef; this is what makes "B added C, call ends, B and C's
  //   own DM shows the call duration" work regardless of who ends the call
  //   or whether B/C are core participants.
  const endCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs) return;
    socketRef.current?.emit('call:end', { callId: cs.callId });
    // peerUsername means "the original other party" for a core caller/
    // callee, or "whoever invited me" for an added member — either way,
    // this is always the one relationship this call's own state directly
    // represents. Skipped if they already left earlier (peerGoneRef) —
    // they logged their own accurate exit at the time, this would just
    // double up with an inflated duration.
    if (!peerGoneRef.current) writeCallLog(cs, 'ended');
    for (const [username, invitee] of myInviteesRef.current) {
      writeCallLogTo(username, cs.type, 'ended', Math.max(0, Math.round((Date.now() - invitee.joinedAt) / 1000)), myUsername);
    }
    teardownCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Invite one more person into the current active call — only the picker
  // (private chats only, per the product ask) calls this, already filtered
  // to mutual friends isn't required client-side since the server enforces
  // it anyway (same areFriends/block checks call:invite already used).
  const addMemberToCall = useCallback((username) => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'active' || !socketRef.current || !username) return;
    socketRef.current.emit('call:add-member', { callId: cs.callId, newMemberUsername: username.toLowerCase() });
  }, []);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    const cs = callStateRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    const nowOn = stream.getAudioTracks().some(t => t.enabled);
    setIsMicOn(nowOn);
    if (cs) broadcastState(cs.callId);
  }, []);

  // Adds a video track (voice → video upgrade, WhatsApp-style) the first
  // time, then just enables/disables it afterwards — avoids a second
  // getUserMedia + renegotiation cycle for every toggle. Upgrading applies
  // to every peer in the mesh: the new track is added to (and renegotiated
  // with) each existing connection, not just one.
  const toggleCamera = useCallback(async () => {
    const cs = callStateRef.current;
    if (!cs || pcsRef.current.size === 0) return;
    const stream = localStreamRef.current;
    const existingVideoTrack = stream?.getVideoTracks()[0];

    if (existingVideoTrack) {
      existingVideoTrack.enabled = !existingVideoTrack.enabled;
      setIsCamOn(existingVideoTrack.enabled);
      broadcastState(cs.callId);
      return;
    }

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: 'user' } });
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) return;
      stream.addTrack(videoTrack);
      currentFacingRef.current = 'user';
      setIsCamOn(true);
      setCallState(prev => (prev ? { ...prev, type: 'video' } : prev));
      // Tells the server too — otherwise anyone added to this call later
      // (call:joined-call) is handed the stale 'voice' type from invite
      // time and joins audio-only by default. See call:mark-video.
      socketRef.current?.emit('call:mark-video', { callId: cs.callId });
      for (const [username, pc] of pcsRef.current) {
        pc.addTrack(videoTrack, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('call:offer', cs.callId, username, { type: 'offer', sdp: offer.sdp });
      }
      broadcastState(cs.callId);
    } catch (e) {
      console.error('[Call] toggleCamera (add video) failed:', e);
    }
  }, [sendSignal]);

  // Acquire the new-facing camera BEFORE releasing the old one (exact→soft
  // facingMode fallback, same as the room's own camera flip) — acquiring
  // first and only stopping the old track once the new one is already
  // flowing keeps the local preview continuous instead of freezing/blanking
  // for however long getUserMedia takes. Replaces the track on every peer
  // connection's sender in the mesh, not just one.
  const flipCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const oldTrack = stream?.getVideoTracks()[0];
    if (!stream || !oldTrack || pcsRef.current.size === 0) return;
    const nextFacing = currentFacingRef.current === 'environment' ? 'user' : 'environment';
    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: { exact: nextFacing } } });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: nextFacing } });
      }
      const newTrack = newStream.getVideoTracks()[0];
      stream.addTrack(newTrack);
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack);
      }
      stream.removeTrack(oldTrack);
      oldTrack.stop();
      currentFacingRef.current = nextFacing;
    } catch (e) {
      console.error('[Call] flipCamera failed, keeping previous camera:', e);
    }
  }, []);

  // WhatsApp-style default: voice calls start on the earpiece, video calls
  // start on speaker. Runs once per call (on the outgoing→active / incoming→
  // active transition), not on every render, so a user's manual route pick
  // via setAudioRoute below isn't stomped back to the default afterward.
  const audioRouteInitializedForCallId = useRef(null);
  useEffect(() => {
    if (callState?.phase !== 'active') return;
    if (audioRouteInitializedForCallId.current === callState.callId) return;
    audioRouteInitializedForCallId.current = callState.callId;
    const initial = callState.type === 'video' ? 'speaker' : 'earpiece';
    setNativeAudioRoute(initial);
    setAudioRouteState(initial);
    isNativeBluetoothAudioAvailable().then(setBluetoothAudioAvailable);
  }, [callState?.phase, callState?.callId, callState?.type]);

  const setAudioRoute = useCallback((route) => {
    setNativeAudioRoute(route);
    setAudioRouteState(route);
  }, []);

  const value = {
    callState,
    isMicOn,
    isCamOn,
    participantMeta,
    remoteStreams: Object.fromEntries(remoteStreamsRef.current),
    remoteStreamVersion,
    localStream: localStreamRef.current,
    myUsername,
    myAvatarUrl,
    startCall,
    acceptCall,
    declineCall,
    cancelOutgoingCall,
    endCall,
    addMemberToCall,
    toggleMic,
    toggleCamera,
    flipCamera,
    audioRoute,
    setAudioRoute,
    bluetoothAudioAvailable,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <GlobalCallOverlay />
    </CallContext.Provider>
  );
}
