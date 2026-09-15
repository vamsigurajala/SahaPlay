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
import { setNativeAudioRoute, resetNativeAudioRoute, isNativeBluetoothAudioAvailable, startNativeCallService, stopNativeCallService } from '../lib/nativeMedia';
import { requestMediaAccess } from '../lib/mediaPermissionGate';
import { getNativeScreenCaptureStream } from '../lib/nativeScreenShare';
import { isCapacitorApp } from '../lib/platform';
import { ensureDesktopNotifyPermission, showDesktopNotification } from '../lib/desktopNotify';
import { ensureWebPushSubscription } from '../lib/webPushSubscribe';
import { isNotifyCategoryEnabled } from '../lib/notifyGating';
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

// Was capped at a 640x480 "ideal" — every camera on any laptop or phone in
// real use comfortably exceeds that, but an "ideal" constraint is a strong
// preference browsers/WebRTC track closely rather than a floor, so calls
// were shot at VGA resolution even on a great connection with a much better
// camera available. Raised to 720p ideal (Full HD as an allowed ceiling, not
// a target) — this only raises what quality is POSSIBLE; WebRTC's own
// bandwidth estimation still adapts the actual encoded bitrate/resolution
// down in real time on a weak connection, exactly the same mechanism that
// already governed the old 640x480 stream, so this doesn't cost anything on
// a bad network, it just stops throttling everyone else down to it too.
const CAM_CONSTRAINTS = { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 30 } };

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
    // Sent WITHOUT an Authorization header for a while — /api/users/:username
    // is viewer-relative (followStatus/isFollowingMe depend on who's asking),
    // so an unauthenticated request here got treated as an anonymous viewer
    // and answered "not friends." That response then sat in the frontend's
    // shared GET cache (see fetchInterceptor.js — keyed by pathname only, no
    // viewer distinction) and got served right back to the real logged-in
    // user moments later when they opened that exact chat — showing
    // "Friendship Required" for someone they were actually mutual friends
    // with, self-correcting only once the cache entry happened to get
    // invalidated or expire. This fires on every incoming/outgoing call (to
    // fetch the peer's display name/avatar for the ring screen), which is
    // exactly why the symptom showed up clustered around calls.
    const token = localStorage.getItem('watch_token');
    const res = await fetch(`${API}/api/users/${username}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
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
  // username -> the RTCRtpSender currently carrying our mic audio to that
  // peer, captured once per connection in doConnect. toggleMic uses this
  // (not a fresh pc.getSenders() lookup) because once muted via
  // replaceTrack(null) below, the sender's own .track is null and can no
  // longer be identified as "the audio one" by kind — this ref is how
  // toggleMic finds the right sender again to unmute.
  const audioSendersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  // Tracked explicitly rather than read back from the camera track's own
  // getSettings().facingMode - that field is unreliably reported (often
  // just undefined) on a lot of Android Chromium/WebView builds, which made
  // flipCamera() below always fall back to assuming 'user' and therefore
  // always request 'environment' again on every tap, never actually
  // toggling back to the front camera.
  const currentFacingRef = useRef('user');
  // Screen share (see startScreenShare/stopScreenShare below): the camera
  // track is paused (not stopped — kept alive so it can resume instantly)
  // and every peer's video sender is swapped to the screen-capture track
  // instead, same replaceTrack pattern flipCamera uses.
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Kept entirely separate from localStreamRef (the mic/camera capture) so a
  // video element bound to "my local video" never has to guess which of two
  // video tracks on the same MediaStream to render — the UI just switches
  // which stream object it points at.
  const [screenShareStream, setScreenShareStream] = useState(null);
  const screenShareTrackRef = useRef(null);
  const screenShareCleanupRef = useRef(null); // tears down native MediaProjection capture, if used
  const cameraTrackDuringShareRef = useRef(null);
  const remoteStreamsRef = useRef(new Map());
  // ─── Network quality (per-peer ICE state → one overall "poor connection?"
  // signal the UI can show) ───
  // 'good' | 'poor', keyed by peer username — recomputeNetworkStatus below
  // reduces this map down to the single worst-case networkStatus value
  // exposed in the context, so a mesh group call still shows one simple
  // banner rather than per-tile detail.
  const peerNetworkRef = useRef(new Map());
  // Debounce timers for a peer that just went 'disconnected' — ICE reports
  // this for ordinary brief network blips too (a few dropped packets, a
  // momentary Wi-Fi/cell handoff) that usually self-heal within a couple of
  // seconds without the user ever needing to know. Only promoted to a
  // user-visible "poor connection" if it's STILL disconnected once this
  // timer fires; cleared immediately if it recovers first.
  const disconnectTimersRef = useRef(new Map());
  // Longer-horizon "give up on this peer for real" timers — see their use
  // in doConnect's oniceconnectionstatechange below.
  const peerGiveUpTimersRef = useRef(new Map());
  const [networkStatus, setNetworkStatus] = useState(null); // null (good) | 'poor'
  function recomputeNetworkStatus() {
    let poor = false;
    for (const status of peerNetworkRef.current.values()) {
      if (status === 'poor') { poor = true; break; }
    }
    setNetworkStatus(poor ? 'poor' : null);
  }
  function clearPeerNetworkTracking(username) {
    const timer = disconnectTimersRef.current.get(username);
    if (timer) clearTimeout(timer);
    disconnectTimersRef.current.delete(username);
    peerNetworkRef.current.delete(username);
    const giveUpTimer = peerGiveUpTimersRef.current.get(username);
    if (giveUpTimer) clearTimeout(giveUpTimer);
    peerGiveUpTimersRef.current.delete(username);
  }
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

  // Which outgoing callIds have already been given one busy-retry — see
  // the 'call:busy' handler below for why a single silent retry exists at
  // all (a stale busy flag left by a decline whose native background POST
  // hadn't finished landing yet, hit by calling the same person back
  // immediately after they declined).
  const busyRetriedRef = useRef(new Set());

  // Consecutive "this call looks gone" replies from the call:roster
  // self-heal poll below, per callId — see that handler's own comment for
  // why a single reply isn't trusted on its own before ending a call.
  const rosterMissRef = useRef(new Map());

  // Re-entrancy guard for acceptCall() — see that function's own comment.
  // Without this, a double-tap on the Answer button (easy to do while
  // waiting on the socket-ready/media-permission awaits it now has) fires
  // two concurrent 'call:accept' emits for the same call; the server
  // processes the first one fine and rejects the second with
  // reason:'already_active', which surfaced client-side as "This call was
  // already answered on another device" — confusing and simply wrong, no
  // other device was ever involved.
  const acceptInFlightRef = useRef(false);

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

  // CallProvider wraps every route, including /login and /signup (see
  // App.jsx) — so this whole file mounts and the socket-lifecycle effect
  // below runs its FIRST pass well before a fresh sign-in, at a point where
  // `token` is still null. Login.jsx/Signup.jsx navigate with React
  // Router's navigate() afterward, not a full page reload, so nothing
  // remounts this component — the effect below (previously keyed only on
  // [cryptoReady], which was already true on the login page) would then
  // never run again for the rest of that session, since its only dependency
  // never changes again. That's the actual cause of "signed in, clicked
  // Call, permanently stuck on 'Still connecting' no matter how many times
  // I try, only a hard refresh fixes it" — there was no socket at all to
  // connect, ever, until a full reload remounted everything with the token
  // already present. Bumping this on 'login_success' (dispatched by both
  // Login.jsx and Signup.jsx right after storing the token) forces the
  // effect below to re-run and pick it up, no reload needed.
  const [authVersion, setAuthVersion] = useState(0);
  useEffect(() => {
    const bump = () => setAuthVersion(v => v + 1);
    window.addEventListener('login_success', bump);
    return () => window.removeEventListener('login_success', bump);
  }, []);

  // ─── Socket lifecycle ───
  useEffect(() => {
    const token = localStorage.getItem('watch_token');
    const isGuest = localStorage.getItem('watch_is_guest') === 'true';
    if (!token || token === 'null' || token === 'undefined' || isGuest || !cryptoReady) return;
    if (socketRef.current) return;

    // `auth` as a function (not a static object) re-reads localStorage on
    // every reconnect attempt, not just the first connect — matters most for
    // a long-lived session that's never fully reloaded (e.g. the Tauri
    // desktop app, which hides-not-destroys its window on close so this
    // effect can go weeks without re-running). A stale captured token here
    // would silently authenticate a reconnect with an old/expired value,
    // leaving socket.username unset server-side and this device unable to
    // send or receive ANY call — with no visible error, since the socket
    // still "connects" successfully at the transport level either way.
    const sock = io(API, { auth: (cb) => cb({ token: localStorage.getItem('watch_token') }), transports: ['websocket', 'polling'] });
    socketRef.current = sock;
    ensureDesktopNotifyPermission();
    // Covers the browser-fully-closed case Notification-API-from-a-live-tab
    // above can't — real Web Push wakes the service worker even with no tab
    // open at all. Only does real work once permission is already granted
    // and there's no existing subscription yet; safe/no-op otherwise.
    ensureWebPushSubscription(token);

    // Server confirms our token was rejected (expired/invalid) — the socket
    // still looks "connected" but can't send or receive calls (or anything
    // else keyed by username). Surface it instead of leaving calling
    // silently dead with no explanation — see the matching comment on
    // server.js's io.on('connection').
    sock.on('auth:invalid', () => {
      console.warn('[Call] socket authentication failed — token expired or invalid; calls will not work until re-login');
      toast.error('Your session has expired — please log out and log back in to receive calls');
    });

    sock.on('call:incoming', async ({ callId, callerUsername, callType, groupParticipants }) => {
      // Already on a call (shouldn't normally happen — server enforces busy) — ignore silently.
      if (callStateRef.current) return;
      peerPublicKeysRef.current = new Map();
      peerGoneRef.current = false;
      const brief = await fetchUserBrief(callerUsername);
      if (isNotifyCategoryEnabled('calls')) {
        showDesktopNotification(
          callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
          `${brief?.displayName || callerUsername} is calling…`,
          `call-${callId}`
        );
      }
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
      const cs = callStateRef.current;
      if (cs?.callId !== callId) return;
      // One silent retry before actually giving up: userActiveCallId
      // (server-side "is this person busy" tracking) is cleared the instant
      // a call is declined/ended — but a decline reaching the server via a
      // native background POST (see CallActionReceiver.java/
      // CallEngineService.declineIncomingCall) has real network round-trip
      // time. Calling the same person right back within that window — a
      // real thing testers (and impatient users) do — can land this
      // call:invite before that cleanup finishes, getting rejected as
      // "busy" from a call that's already over. A genuinely-busy person is
      // still busy 900ms later, so this costs one extra beat in that case
      // and fixes the far more common "I already declined that, why does
      // it say busy" report in the stale-flag case.
      if (!busyRetriedRef.current.has(callId)) {
        busyRetriedRef.current.add(callId);
        setTimeout(() => {
          if (callStateRef.current?.callId !== callId) return; // ended/changed while waiting
          socketRef.current?.emit('call:invite', { callId, calleeUsername: cs.peerUsername, callType: cs.type });
        }, 900);
        return;
      }
      // The chat-log "busy" bubble is only visible once you go look at that
      // conversation — this is the immediate, on-screen "why did my call
      // just end" answer, shown right on the calling screen itself before
      // it disappears.
      toast.error(`${cs.peerDisplayName || cs.peerUsername} is on another call`);
      writeCallLog(cs, 'busy');
      teardownCall();
    });

    sock.on('call:invalid', ({ callId, reason }) => {
      if (callStateRef.current?.callId !== callId) return;
      // add-to-call rejections (not_friends/blocked/already_in_call) mean
      // MY attempt to add someone failed — the call I'm already on is still
      // live and connected, so just show why and keep the call going. Only
      // already_active/call_gone mean the call itself is gone from under me
      // (an Answer/Join tap rejected after acceptCall() already optimistically
      // flipped the UI to "active" — see the matching comment in
      // server.js's call:accept — most often a different device of the same
      // account answered first) and those are the only cases that should
      // tear down the local call UI.
      if (reason === 'not_friends') { toast('You can only add mutual friends to a call'); return; }
      if (reason === 'blocked') { toast('Could not add that person to the call'); return; }
      if (reason === 'already_in_call') { toast('They’re already in this call'); return; }
      if (reason === 'already_active') toast.error('This call was already answered on another device');
      else if (reason === 'call_gone') toast.error('This call has ended');
      teardownCall();
    });

    sock.on('call:cancelled', ({ callId, reason }) => {
      const cs = callStateRef.current;
      if (cs?.callId !== callId) return;
      if (reason === 'disconnect') writeCallLog(cs, 'missed');
      // I was the one ringing and the caller ended it before I answered —
      // a missed call from my side regardless of why (their own disconnect,
      // or them explicitly cancelling). The shared chat-log bubble for this
      // is already written by whichever side took the action (see the
      // comment above this handler block) — this only adds the notification,
      // not a second log entry.
      if (cs.phase === 'incoming' && isNotifyCategoryEnabled('calls')) {
        showDesktopNotification('Missed call', `You missed a call from ${cs.peerDisplayName || cs.peerUsername}`, `call-missed-${callId}`);
      }
      teardownCall();
    });

    sock.on('call:declined', ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      // No toast here — the ringing screen disappearing (teardownCall)
      // already tells the caller the call ended; a toast on top of that was
      // unwanted noise, not extra information.
      teardownCall();
    });

    sock.on('call:timeout', ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      if (cs.phase === 'outgoing') {
        writeCallLog(cs, 'missed');
      } else if (cs.phase === 'incoming' && isNotifyCategoryEnabled('calls')) {
        // The ring simply expired unanswered on my end — the caller's own
        // client (which also gets this same event) is what writes the
        // shared chat-log bubble; this just adds the notification.
        showDesktopNotification('Missed call', `You missed a call from ${cs.peerDisplayName || cs.peerUsername}`, `call-missed-${callId}`);
      }
      teardownCall();
    });

    // Same account answered/joined this call from a DIFFERENT device (see
    // the matching server-side fix in call:accept/call:member-join) — just
    // silently stop ringing here, no missed-call log or notification. This
    // is what "if anyone device answers, immediately connect and stop
    // ringing everywhere else" actually requires: without this, a second
    // logged-in device (e.g. a laptop while you answer on your phone) kept
    // showing the incoming-call screen indefinitely and would go on to try
    // answering the SDP offer itself, corrupting the call for everyone.
    sock.on('call:taken-elsewhere', ({ callId }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || cs.phase === 'active') return;
      teardownCall();
    });

    // The app just (re)connected — killed/backgrounded and reopened, or a
    // full page reload — while a call it's part of is still going for the
    // other side(s). This JS runtime never saw that call start, so there's
    // no local callState, no RTCPeerConnection, nothing; the server tells us
    // it exists (see the matching resync block in server.js's connection
    // handler) so the UI can come back instead of silently showing nothing
    // while the other party is still actually on a live call with us.
    // Deliberately restores MINIMIZED (see GlobalCallOverlay's
    // restoredMinimized handling) rather than yanking the user into a full
    // call screen the moment the app happens to open on some other page —
    // same "tap to return" bar as manually minimizing via Send Message.
    sock.on('call:resync', async ({ callId, type, answeredAt, participants }) => {
      if (callStateRef.current) return;
      const others = Array.isArray(participants) ? participants.filter(Boolean) : [];
      if (others.length === 0) return;
      peerPublicKeysRef.current = new Map();
      peerGoneRef.current = false;
      const groupMembers = await Promise.all(others.map(async (u) => {
        const b = await fetchUserBrief(u);
        return { username: u, displayName: b?.displayName || u, avatarUrl: b?.avatarUrl || null };
      }));
      const primary = groupMembers[0];
      setCallState({
        phase: 'active',
        callId,
        type,
        peerUsername: primary.username,
        peerDisplayName: primary.displayName,
        peerAvatar: primary.avatarUrl,
        startedAt: answeredAt || Date.now(),
        answeredAt: answeredAt || Date.now(),
        isGroupJoin: groupMembers.length > 1,
        groupMembers,
        restoredMinimized: true,
      });
      // No connectToPeer here on purpose — every other active participant is
      // being told (call:renegotiate-with) to send THIS side a fresh offer,
      // since our previous RTCPeerConnection(s) died with the old page. The
      // existing 'call:offer' handler below already covers "receive an offer
      // for a call I'm tracking, answer it" — that's all this needs.
      //
      // Safety net: the renegotiation above depends on every other
      // participant's own client actually being alive and acting on
      // call:renegotiate-with. If it never does (their app is also gone, a
      // stuck reload, a lost message) this side would otherwise sit showing
      // a "connected" call forever with no real media flowing — and since
      // the server keeps this call "active" the whole time, BOTH accounts
      // would show as permanently busy on any future call attempt with each
      // other. Give it a reasonable window to actually connect for real;
      // if it hasn't by then, end the call properly instead of leaving it
      // stuck for good.
      const watchdogCallId = callId;
      setTimeout(() => {
        if (callStateRef.current?.callId !== watchdogCallId) return;
        const connected = others.every(u => {
          const pc = pcsRef.current.get(u.username);
          return pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed');
        });
        if (!connected) {
          console.warn('[Call] resync never reconnected — ending stale call', watchdogCallId);
          endCall();
        }
      }, 20000);
    });

    // The counterpart to call:resync above, received by whoever is STILL
    // actively connected: a specific peer's own side just reconnected fresh
    // (see server.js) and needs a brand-new RTCPeerConnection/offer from us —
    // our old one to them is talking to a socket that no longer exists.
    sock.on('call:renegotiate-with', ({ callId, targetUsername }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || cs.phase !== 'active' || !targetUsername) return;
      closePeerConnection(targetUsername);
      connectToPeer(targetUsername, { isCaller: true, callId, type: cs.type });
    });

    sock.on('call:answered', async ({ callId, answeredAt }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || cs.phase !== 'outgoing') return;
      setCallState(prev => (prev ? { ...prev, phase: 'active', answeredAt: answeredAt || Date.now() } : prev));
      await connectToPeer(cs.peerUsername, { isCaller: true, callId, type: cs.type });
    });

    // Server confirmation of MY OWN call:accept — see the matching comment
    // in backend/server.js. acceptCall() below already flips phase to
    // 'active' optimistically the instant Answer is tapped (no server
    // round-trip needed for a snappy UI), so this only patches in the
    // server-stamped answeredAt in place of the locally-guessed one, which
    // is what keeps the live call-duration timer showing the SAME number on
    // both ends instead of two independently-clocked timers a network
    // round-trip apart.
    sock.on('call:accepted', ({ callId, answeredAt }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !answeredAt) return;
      setCallState(prev => (prev ? { ...prev, answeredAt } : prev));
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

    sock.on('call:state', ({ callId, fromUsername, micOn, camOn, sharingScreen }) => {
      if (callStateRef.current?.callId !== callId || !fromUsername) return;
      setParticipantMeta(prev => ({ ...prev, [fromUsername]: { micOn: !!micOn, camOn: !!camOn, sharingScreen: !!sharingScreen } }));
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
    // yet (they haven't joined), but adds a "Ringing…" placeholder tile
    // (no stream yet — see getRemoteParticipants, which derives ringing vs.
    // connected purely from stream presence) so everyone already on the
    // call sees the invite happen in real time, not just the person who
    // sent it.
    sock.on('call:member-invited', async ({ callId, username }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId || !username || username === myUsername) return;
      const brief = await fetchUserBrief(username);
      setCallState(prev => {
        if (!prev || prev.callId !== callId) return prev;
        if ((prev.groupMembers || []).some(m => m.username === username)) return prev;
        return { ...prev, groupMembers: [...(prev.groupMembers || []), { username, displayName: brief?.displayName || username, avatarUrl: brief?.avatarUrl || null }] };
      });
    });

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

    // Self-heal for the periodic roster poll below — reconciles against
    // whoever the server currently, authoritatively considers active on
    // this call. Only prunes people this client actually has/had a real
    // peer connection to; a "Ringing…" placeholder (not yet joined) is
    // expected to be absent from this list and is left alone.
    sock.on('call:roster', ({ callId, exists, participants }) => {
      const cs = callStateRef.current;
      if (!cs || cs.callId !== callId) return;
      // A single "this call looks gone" reply used to end the call
      // immediately — but this poll (or the server's authoritative state at
      // that exact instant) can be wrong for a moment with no real network
      // problem visible to either person: a brief, sub-second socket
      // hiccup on either side that resolves on its own, or this poll's own
      // reply racing a change that's still in flight server-side. That's
      // the likely cause of "the call just ended, no dropped-connection
      // warning, nothing seemed wrong" reports. Now requires it twice in a
      // row (24s apart) before actually acting — a genuinely-ended call
      // still fails every subsequent poll, not just one, so this only adds
      // a short delay to the real case while protecting against a lone
      // false negative ending a perfectly fine call.
      const missCount = rosterMissRef.current.get(callId) || 0;
      const bumpMissOrEnd = () => {
        if (missCount + 1 < 2) { rosterMissRef.current.set(callId, missCount + 1); return; }
        rosterMissRef.current.delete(callId);
        endCall();
      };
      if (!exists) { bumpMissOrEnd(); return; }
      const authoritative = new Set(participants);
      const staleUsernames = [...pcsRef.current.keys()].filter(u => !authoritative.has(u));
      const remainingMembers = (cs.groupMembers || []).filter(m => !staleUsernames.includes(m.username));
      const peerGone = !cs.isGroupJoin && cs.peerUsername && staleUsernames.includes(cs.peerUsername);
      if (peerGone && remainingMembers.length === 0) { bumpMissOrEnd(); return; }
      rosterMissRef.current.delete(callId); // a healthy reply — reset any prior miss streak
      if (staleUsernames.length === 0) return;
      staleUsernames.forEach(u => closePeerConnection(u));
      setCallState(prev => (prev ? { ...prev, groupMembers: remainingMembers } : prev));
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoReady, authVersion]);

  // Drives the call:roster self-heal above — asks the server "who's
  // actually still on this call?" every 12s while active. Deliberately a
  // poll rather than something event-triggered: the whole point is
  // catching cases where an event-driven signal (call:member-left,
  // call:ended) never arrived in the first place, so nothing here can
  // depend on one having fired correctly.
  useEffect(() => {
    if (!callState || callState.phase !== 'active') return;
    const callId = callState.callId;
    const interval = setInterval(() => {
      socketRef.current?.emit('call:get-roster', { callId });
    }, 12000);
    return () => clearInterval(interval);
  }, [callState?.callId, callState?.phase]);

  // ─── Native "Answer" deep link (see nativeCallBridge.js / IncomingCallActivity.java) ───
  // This USED TO auto-accept the matching call the instant sahaplay://call-
  // answer arrived — tapping Answer natively (the notification action, or
  // IncomingCallActivity's own button) opened the app and immediately joined
  // the call with no further interaction. That auto-accept was the actual
  // source of "Answer doesn't work" reports: it depended on this socket
  // already being connected/authenticated by the time the deep link fired,
  // which raced against the app's own cold-start — a fully-killed app has no
  // guarantee this effect (or the socket) is ready the instant the deep link
  // lands, and a lost race meant nothing happened at all, silently. Now the
  // deep link's only job is what actually launching the Intent already does
  // for free — open/foreground the app — and the user answers for real via
  // this same GlobalCallOverlay Answer button every other incoming call
  // already uses (see that component's own comment on why it no longer
  // hides itself for a native-triggered incoming call on Android). No JS
  // wiring needed here anymore beyond letting 'call:incoming' arrive
  // normally once the socket connects.

  // socketRef.current is set SYNCHRONOUSLY the moment the socket-lifecycle
  // effect above runs `io(API, ...)` — but the actual transport handshake
  // and auth are async, so a truthy ref does not mean the socket is actually
  // connected yet. socket.io-client buffers emit() calls made before
  // 'connect' fires and flushes them once it does, which is exactly why
  // "Still connecting" was so rare to hit for startCall (the ref check only
  // ever caught the brief pre-effect window) — but acceptCall/declineCall
  // had NO wait/feedback at all for the "socket object exists, transport
  // still connecting" case, which is the far more common one right after
  // the app cold-starts from a notification tap: the user can see and tap
  // the ring screen's Answer button well before the socket has finished
  // connecting, and a bare emit() into a socket that never actually
  // connects (bad network, server hiccup) would otherwise buffer forever
  // with nothing telling the user why nothing happened. This waits, with a
  // bounded timeout, for a real 'connect' — resolving immediately if
  // already connected, and false (not a throw) on timeout so callers can
  // decide their own fallback (toast + bail, in every caller below).
  function waitForSocketConnected(timeoutMs = 6000) {
    return new Promise((resolve) => {
      const sock = socketRef.current;
      if (sock?.connected) { resolve(true); return; }
      if (!sock) { resolve(false); return; }
      const timer = setTimeout(() => { sock.off('connect', onConnect); resolve(false); }, timeoutMs);
      function onConnect() { clearTimeout(timer); resolve(true); }
      sock.once('connect', onConnect);
    });
  }

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

  // Everyone this call's own state currently thinks is on it besides me —
  // mirrors OneOnOneCallScreen.jsx's getRemoteParticipants base-list logic
  // (same two shapes: isGroupJoin means groupMembers IS the full other-
  // participant list; otherwise it's peerUsername plus anyone added since).
  // Used only by the give-up watchdog below to decide "was that the last
  // person left" vs. "just drop this one from the mesh."
  function getOtherActiveUsernames(cs) {
    const members = cs.groupMembers || [];
    if (cs.isGroupJoin) return members.map(m => m.username);
    return [cs.peerUsername, ...members.filter(m => m.username !== cs.peerUsername).map(m => m.username)];
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

    // Surfaces real WebRTC connection health as the "poor connection"
    // banner the call UI shows — see peerNetworkRef above for the
    // debounce/first-connect reasoning.
    let hasConnectedOnce = false;
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      const existingTimer = disconnectTimersRef.current.get(targetUsername);
      if (state === 'connected' || state === 'completed') {
        hasConnectedOnce = true;
        if (existingTimer) { clearTimeout(existingTimer); disconnectTimersRef.current.delete(targetUsername); }
        peerNetworkRef.current.set(targetUsername, 'good');
        recomputeNetworkStatus();
      } else if (state === 'disconnected') {
        if (hasConnectedOnce && !existingTimer) {
          const timer = setTimeout(() => {
            disconnectTimersRef.current.delete(targetUsername);
            peerNetworkRef.current.set(targetUsername, 'poor');
            recomputeNetworkStatus();
          }, 3000);
          disconnectTimersRef.current.set(targetUsername, timer);
        }
      } else if (state === 'failed') {
        if (existingTimer) { clearTimeout(existingTimer); disconnectTimersRef.current.delete(targetUsername); }
        peerNetworkRef.current.set(targetUsername, 'poor');
        recomputeNetworkStatus();
        // Best-effort automatic recovery — renegotiates fresh ICE candidates
        // without tearing down the whole call. Only meaningful once already
        // connected; a 'failed' during initial setup means it never
        // connected at all (bad TURN/firewall), which a restart can't fix.
        if (hasConnectedOnce) { try { pc.restartIce(); } catch {} }
      }
      // Give-up watchdog: if the OTHER side ends the call while THIS side's
      // socket happens to be disconnected at that exact moment (backgrounded
      // heavily, brief network blip), the server's call:ended/call:member-
      // left emit simply has nowhere to go — a server-side emit to an
      // already-disconnected socket isn't queued for delivery on reconnect
      // the way a client-side emit would be. Without this, a call that
      // genuinely ended on the other side could keep showing as "connected"
      // here indefinitely, with nothing left to actually talk to. Bounds
      // that to a fixed window instead of forever: still 'disconnected' or
      // 'failed' (restartIce already had its chance above) this long after
      // first going bad, and it's treated as really gone.
      if (state === 'disconnected' || state === 'failed') {
        if (hasConnectedOnce && !peerGiveUpTimersRef.current.has(targetUsername)) {
          const giveUpTimer = setTimeout(() => {
            peerGiveUpTimersRef.current.delete(targetUsername);
            const st = pc.iceConnectionState;
            if (st !== 'disconnected' && st !== 'failed') return; // recovered in the meantime
            const cs = callStateRef.current;
            if (!cs) return;
            const others = getOtherActiveUsernames(cs);
            if (others.length <= 1) {
              // This was the only person left — nothing to keep the call
              // open for.
              endCall();
            } else {
              closePeerConnection(targetUsername);
              setCallState(prev => (prev ? { ...prev, groupMembers: (prev.groupMembers || []).filter(m => m.username !== targetUsername) } : prev));
            }
          }, 20000);
          peerGiveUpTimersRef.current.set(targetUsername, giveUpTimer);
        }
      } else if (state === 'connected' || state === 'completed') {
        const t = peerGiveUpTimersRef.current.get(targetUsername);
        if (t) { clearTimeout(t); peerGiveUpTimersRef.current.delete(targetUsername); }
      }
    };

    const stream = await ensureLocalStream(type);
    if (stream) {
      stream.getTracks().forEach(t => {
        const sender = pc.addTrack(t, stream);
        if (t.kind === 'audio') {
          audioSendersRef.current.set(targetUsername, sender);
          // Already muted before this peer connected (e.g. muted during
          // the outgoing ring, then a group member joined) — a fresh
          // sender always starts attached to the real track regardless of
          // isMicOn, so bring it in line immediately rather than briefly
          // sending live audio to this one peer.
          if (!t.enabled) sender.replaceTrack(null).catch(() => {});
        }
      });
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
    audioSendersRef.current.delete(username);
    remoteStreamsRef.current.delete(username);
    iceBuffersRef.current.delete(username);
    connectPromisesRef.current.delete(username);
    peerPublicKeysRef.current.delete(username);
    clearPeerNetworkTracking(username);
    recomputeNetworkStatus();
    setParticipantMeta(prev => { const next = { ...prev }; delete next[username]; return next; });
    setRemoteStreamVersion(v => v + 1);
  }

  function broadcastState(callId) {
    // Screen share always reports camOn: true regardless of the (deliberately
    // disabled) camera track — from the remote peer's perspective "camOn"
    // just means "there's a video track worth rendering," which is exactly
    // as true for a shared screen as for a camera feed.
    const sharingScreen = !!screenShareTrackRef.current;
    socketRef.current?.emit('call:state', {
      callId,
      micOn: localStreamRef.current?.getAudioTracks().some(t => t.enabled) ?? false,
      camOn: sharingScreen ? true : (localStreamRef.current?.getVideoTracks().some(t => t.enabled) ?? false),
      // Lets a remote viewer render this tile with object-fit: contain
      // instead of cover — cropping a shared screen (especially a portrait
      // phone screen into a landscape-ish grid tile) cuts off content the
      // sharer actually meant to show, unlike a face-cam where cropping is
      // normal/expected. See OneOnOneCallScreen.jsx's VideoTile.
      sharingScreen,
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

  // Guaranteed-delivery backup for ending a call, alongside (not instead of)
  // the real-time socket emit — mirrors the exact reliability pattern the
  // native Android side already uses (CallActionReceiver.java /
  // CallEngineService.declineIncomingCall, both REST-only, deliberately not
  // socket-dependent) for its own decline/hang-up buttons. A socket.emit()
  // is fire-and-forget with no ack/retry — if that one message is dropped
  // for any reason (a momentary hiccup on either side's connection), there
  // was previously nothing else telling the other party the call ended, so
  // their screen just sat there "ringing"/"connected" indefinitely. A plain
  // POST with a real HTTP response doesn't have that failure mode, and the
  // server-side handlers are idempotent (activeCalls.get(callId) already
  // gone/changed is a normal no-op) — safe to fire both unconditionally.
  function postCallActionRest(path, body) {
    const token = localStorage.getItem('watch_token');
    if (!token) return;
    fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function teardownCall() {
    stopNativeCallService();
    callServiceStateRef.current = { callId: null, phase: null };
    if (screenShareTrackRef.current) {
      try { screenShareCleanupRef.current?.(); } catch {}
      try { screenShareTrackRef.current.stop(); } catch {}
      screenShareTrackRef.current = null;
      screenShareCleanupRef.current = null;
      cameraTrackDuringShareRef.current = null;
      setIsScreenSharing(false);
    }
    for (const pc of pcsRef.current.values()) { try { pc.close(); } catch {} }
    pcsRef.current.clear();
    audioSendersRef.current.clear();
    remoteStreamsRef.current.clear();
    iceBuffersRef.current.clear();
    connectPromisesRef.current.clear();
    peerPublicKeysRef.current.clear();
    myInviteesRef.current.clear();
    for (const timer of disconnectTimersRef.current.values()) clearTimeout(timer);
    disconnectTimersRef.current.clear();
    peerNetworkRef.current.clear();
    setNetworkStatus(null);
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
    if (callStateRef.current) return;
    // Waits for a real connected socket (not just a truthy ref — see
    // waitForSocketConnected's own comment) instead of failing the instant
    // the ref happens to be null/not-yet-connected. Resolves near-instantly
    // in the overwhelmingly common case (socket's already up); only actually
    // waits the couple hundred ms to a few seconds a fresh reconnect can take
    // — which used to just fail outright with nothing but a "try again"
    // toast, even though trying again a moment later always worked anyway.
    const connected = await waitForSocketConnected();
    if (callStateRef.current) return; // a call arrived/started while we were waiting
    if (!connected) {
      toast.error('Still connecting — try again in a moment');
      return;
    }
    // Resolved BEFORE any call state exists yet — see the matching comment
    // on ensureNativeMediaPermissions in nativeMedia.js for why this has to
    // happen ahead of the 'outgoing' phase transition below, not reactively
    // once getUserMedia() eventually runs. requestMediaAccess (not the raw
    // native call directly) so a denial surfaces MediaPermissionModal's
    // real retry/Open-Settings UI instead of a dead-end toast.
    if (!(await requestMediaAccess())) return;
    // Warms up the mic/camera NOW, during the ring, instead of waiting for
    // connectToPeer to do it — which previously only ran once 'call:answered'
    // came back from the server, i.e. the exact instant the callee taps
    // Answer. getUserMedia() (hardware init, echo-cancellation pipeline
    // setup, a real permission prompt on some platforms) is not instant, so
    // that made the call open with isMicOn still at its default `false` for
    // however long that took — reported live as "call connects but I'm
    // immediately on mute, then it un-mutes itself a couple seconds later."
    // The ring already gives several real seconds of dead time before the
    // callee can possibly answer, which is exactly when this should happen.
    // Not awaited — doConnect's own `ensureLocalStream(type)` call re-uses
    // this exact same cached stream (short-circuits instantly once it
    // resolves) whenever 'call:answered' actually arrives, so this never
    // delays call:invite going out or makes the phone ring later.
    ensureLocalStream(type).catch(e => console.error('[Call] pre-warm ensureLocalStream failed:', e));
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

  const acceptCall = useCallback(async () => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'incoming') return;
    // Synchronous re-entrancy guard — see acceptInFlightRef's own comment.
    // Must be checked/set before any `await` below, not just the phase
    // check above: phase doesn't flip to 'active' until after those awaits
    // resolve, so a second tap landing in that window would otherwise sail
    // straight past the phase check too.
    if (acceptInFlightRef.current) return;
    acceptInFlightRef.current = true;
    // Wrapped in try/catch — this used to have no error handling at all, so
    // any rejected/thrown step below (socket not ready, requestMediaAccess
    // throwing, connectToPeer throwing) left an unhandled promise rejection:
    // no toast, no console-visible crash to the user, and the phase stuck at
    // 'incoming' forever with no further UI update — exactly what "tapping
    // Answer shows nothing" looks like from the outside. Now every failure
    // path shows a real toast and declines the call rather than leaving it
    // stuck in limbo (a stuck 'incoming' phase server-side would also
    // eventually strand the CALLER'S side too, showing "ringing" well past
    // when the callee gave up).
    try {
      // Same "wait for a real connection, not just a truthy ref" fix as
      // startCall above — this is actually the more likely place to hit it:
      // the ring screen can be tapped within a second of the app cold-
      // starting from a notification tap, well before the socket has
      // finished connecting.
      const connected = await waitForSocketConnected();
      if (callStateRef.current?.callId !== cs.callId) return; // call ended/changed while waiting
      if (!connected) {
        toast.error('Still connecting — try again in a moment');
        return;
      }
      // Same reasoning as startCall above — resolved BEFORE the phase flips
      // to 'active' below, which is what triggers SahaplayCallService to
      // start with foregroundServiceType "microphone|camera". This was the
      // actual cause of "app gets stuck and closes right after granting the
      // permission": the grant itself worked fine, but the foreground service
      // had already tried (and Android 14+ hard-crashed on) starting a moment
      // earlier in the same race, before this awaited.
      const granted = await requestMediaAccess();
      if (callStateRef.current?.callId !== cs.callId) return; // call ended/changed while permission dialog was up
      if (!granted) {
        // Previously silent — declineCall() below tears the overlay down
        // with zero explanation, which reads as "I tapped Answer and
        // literally nothing happened." Surfacing it turns that into a clear
        // "here's why," even though the actual fix (granting the
        // permission) still has to happen in system Settings.
        toast.error('Camera/microphone permission is required to answer');
        declineCall();
        return;
      }
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
    } catch (err) {
      console.error('[Call] acceptCall failed:', err);
      toast.error('Could not answer the call — please try again');
      if (callStateRef.current?.callId === cs.callId) declineCall();
    } finally {
      acceptInFlightRef.current = false;
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
    // Same REST endpoint handles both shapes — a core callee declining
    // (call.callee match) and a group invitee declining before joining
    // (call.members match, see the route's own two branches).
    postCallActionRest(`/api/calls/${cs.callId}/decline`, { calleeUsername: myUsername });
    teardownCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelOutgoingCall = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'outgoing') return;
    socketRef.current?.emit('call:cancel', { callId: cs.callId });
    postCallActionRest(`/api/calls/${cs.callId}/end`, { username: myUsername });
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
    postCallActionRest(`/api/calls/${cs.callId}/end`, { username: myUsername });
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

  // Single "hang up, whatever that means right now" entry point — used by
  // the native ongoing-call notification's End Call/Cancel button (see
  // SahaplayCallService.java), which is now reachable during the outgoing
  // ring too, not just once a call is active. A ringing call has no
  // 'call:end' concept server-side (only an active one does), so blindly
  // calling endCall() there would silently no-op; this picks the function
  // that's actually correct for whatever phase the call is in at the moment
  // the button is tapped.
  const hangup = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs) return;
    if (cs.phase === 'outgoing') cancelOutgoingCall();
    else if (cs.phase === 'incoming') declineCall();
    else endCall();
  }, [cancelOutgoingCall, declineCall, endCall]);

  // Invite one more person into the current active call — only the picker
  // (private chats only, per the product ask) calls this, already filtered
  // to mutual friends isn't required client-side since the server enforces
  // it anyway (same areFriends/block checks call:invite already used).
  const addMemberToCall = useCallback((username, displayName, avatarUrl) => {
    const cs = callStateRef.current;
    if (!cs || cs.phase !== 'active' || !socketRef.current || !username) return;
    const uname = username.toLowerCase();
    socketRef.current.emit('call:add-member', { callId: cs.callId, newMemberUsername: uname });
    // Optimistic placeholder tile, shown as "Ringing…" (no stream yet — see
    // getRemoteParticipants/OneOnOneCallScreen.jsx, which render purely off
    // stream presence) until call:member-joined replaces it with a real
    // connection. Without this, the person who just tapped "add" saw no
    // change at all beyond the picker sheet's own icon until the invitee
    // actually answered, which read as "did that even do anything."
    setCallState(prev => {
      if (!prev || prev.callId !== cs.callId) return prev;
      if ((prev.groupMembers || []).some(m => m.username === uname)) return prev;
      return { ...prev, groupMembers: [...(prev.groupMembers || []), { username: uname, displayName: displayName || uname, avatarUrl: avatarUrl || null }] };
    });
  }, []);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    const cs = callStateRef.current;
    const audioTrack = stream?.getAudioTracks()[0];
    if (!stream || !audioTrack) return;
    const nowOn = !audioTrack.enabled;
    // State first, network second: the button/icon flips and the server
    // gets told immediately, in the same tick — none of it waits on the
    // replaceTrack round trips below. Muting used to await each peer's
    // replaceTrack sequentially before the button even changed state, which
    // is exactly what made it feel like it was "slowly doing the action" in
    // a 3+ person mesh (one network round trip per peer, one after another).
    audioTrack.enabled = nowOn;
    setIsMicOn(nowOn);
    if (cs) broadcastState(cs.callId);
    // Real enforcement beyond track.enabled=false: on some Android WebView/
    // chipset combinations, a track that's merely disabled hasn't reliably
    // kept sending silence through an already-established sender, especially
    // right after an unrelated renegotiation on the same peer connection
    // (e.g. toggleCamera adding a video track, or another member joining the
    // mesh) — reported as "muted but everyone else could still hear me,"
    // including specifically a 3rd person's mic in a group call.
    // replaceTrack(null) detaches the RTP sender from producing ANY audio
    // packets at all while muted, which nothing else on the connection can
    // silently undo; replaceTrack(audioTrack) re-attaches the SAME track
    // object on unmute so echo-cancellation/AGC state isn't reset. Fired in
    // parallel (not one peer awaited at a time) and never blocks the UI
    // update above — a slow/dropped one only delays silencing that ONE
    // peer's copy, never the button or the other peers.
    for (const sender of audioSendersRef.current.values()) {
      sender.replaceTrack(nowOn ? audioTrack : null).catch(() => {});
    }
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
      // In parallel, not one peer renegotiated after another — with 3+
      // people in the mesh, awaiting each peer's createOffer/
      // setLocalDescription/signal round trip in sequence meant the last
      // person in the mesh saw your video several round trips later than
      // the first. Each peer's own connection is independent, so there's no
      // reason for one to wait on another.
      await Promise.all(Array.from(pcsRef.current.entries()).map(async ([username, pc]) => {
        pc.addTrack(videoTrack, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal('call:offer', cs.callId, username, { type: 'offer', sdp: offer.sdp });
      }));
      broadcastState(cs.callId);
    } catch (e) {
      console.error('[Call] toggleCamera (add video) failed:', e);
    }
  }, [sendSignal]);

  // Releases the old-facing camera BEFORE requesting the new one (exact→soft
  // facingMode fallback) — a prior version of this function acquired the new
  // camera first for a smoother, non-freezing preview, but many phones/
  // mobile browsers only allow ONE getUserMedia video stream open at a time
  // regardless of which physical camera it's from, and reject the second
  // request with an OverconstrainedError that looks identical to "this
  // device only has one camera" even on phones with two — Room.jsx's own
  // (separately implemented) room-camera flip already had to work around
  // this exact issue the same way. Matching that release-first order here is
  // what fixes "works on some phones, not others" for the in-call flip
  // button specifically. On failure, re-requests the ORIGINAL facing mode so
  // the call doesn't end up with no camera track at all.
  const [isFlippingCamera, setIsFlippingCamera] = useState(false);
  const flipCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    const oldTrack = stream?.getVideoTracks()[0];
    if (!stream || !oldTrack || pcsRef.current.size === 0) return;
    setIsFlippingCamera(true);
    const prevFacing = currentFacingRef.current;
    const nextFacing = prevFacing === 'environment' ? 'user' : 'environment';
    const oldDeviceId = oldTrack.getSettings?.().deviceId;

    // Some Android WebViews/browsers enumerate both physical cameras with
    // generic labels and don't honor facingMode reliably at all — `exact`
    // throws, and the soft (non-`exact`) facingMode fallback below is only a
    // preference the browser is free to ignore, so it can silently re-open
    // the SAME camera we just released instead of erroring. That's why the
    // flip button visibly does nothing on some phones while working fine on
    // others. Before trusting that soft fallback, try picking the OTHER
    // physical camera explicitly by deviceId.
    const pickDeviceIdForFacing = async (facing) => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        if (videoInputs.length < 2) return null;
        const pattern = facing === 'environment' ? /back|rear|environment/i : /front|user|face/i;
        const labeled = videoInputs.find(d => pattern.test(d.label));
        if (labeled) return labeled.deviceId;
        const other = videoInputs.find(d => d.deviceId && d.deviceId !== oldDeviceId);
        return other ? other.deviceId : null;
      } catch {
        return null;
      }
    };

    const requestFacing = async (facing) => {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: { exact: facing } } });
      } catch {
        const deviceId = await pickDeviceIdForFacing(facing);
        if (deviceId) {
          try {
            return await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, deviceId: { exact: deviceId } } });
          } catch {
            // fall through to plain facingMode below
          }
        }
        return await navigator.mediaDevices.getUserMedia({ video: { ...CAM_CONSTRAINTS, facingMode: facing } });
      }
    };

    stream.removeTrack(oldTrack);
    oldTrack.stop();

    try {
      const newStream = await requestFacing(nextFacing);
      const newTrack = newStream.getVideoTracks()[0];
      stream.addTrack(newTrack);
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(newTrack);
      }
      currentFacingRef.current = nextFacing;
    } catch (e) {
      console.error('[Call] flipCamera failed, restoring previous camera:', e);
      try {
        const restoredStream = await requestFacing(prevFacing);
        const restoredTrack = restoredStream.getVideoTracks()[0];
        stream.addTrack(restoredTrack);
        for (const pc of pcsRef.current.values()) {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) await sender.replaceTrack(restoredTrack);
        }
      } catch (restoreErr) {
        console.error('[Call] flipCamera restore also failed:', restoreErr);
      }
    } finally {
      setIsFlippingCamera(false);
    }
  }, []);

  // stopScreenShare is referenced inside startScreenShare below (native-
  // capture-stopped / track-ended callbacks) before it's actually defined —
  // a plain ref sidesteps needing to restructure both into one another's
  // dependency array; assigned once stopScreenShare itself is declared.
  const stopScreenShareRef = useRef(null);

  // Same replaceTrack pattern as flipCamera above, but swapping in a
  // screen-capture track instead of another camera. The camera track itself
  // is only disabled (not stopped) so it keeps the hardware warm and comes
  // back instantly on stopScreenShare — "our video should be stopped" is
  // satisfied by disabling it (nothing captured/sent while sharing), not by
  // releasing the camera outright and needing a fresh getUserMedia prompt
  // to resume.
  const startScreenShare = useCallback(async () => {
    const cs = callStateRef.current;
    if (!cs || pcsRef.current.size === 0 || screenShareTrackRef.current) return;
    try {
      let rawStream, cleanup = null;
      if (isCapacitorApp()) {
        const res = await getNativeScreenCaptureStream({ onUnexpectedStop: () => stopScreenShareRef.current?.() });
        rawStream = res.stream;
        cleanup = res.cleanup;
      } else if (navigator.mediaDevices?.getDisplayMedia) {
        rawStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } else {
        toast.error("Screen sharing isn't supported here.");
        return;
      }
      const screenTrack = rawStream.getVideoTracks()[0];
      if (!screenTrack) return;

      const stream = localStreamRef.current;
      const cameraTrack = stream?.getVideoTracks()[0] || null;
      cameraTrackDuringShareRef.current = cameraTrack;
      if (cameraTrack) cameraTrack.enabled = false;

      // A video call already has a video sender per peer — swap it in place.
      // A voice call has none yet, so this is the same "add a video track to
      // an audio-only connection" renegotiation toggleCamera already does.
      for (const [uname, pc] of pcsRef.current) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, rawStream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal('call:offer', cs.callId, uname, { type: 'offer', sdp: offer.sdp });
        }
      }

      if (!cameraTrack) {
        // Started from a voice call with no camera track to speak of — this
        // call now carries video, same bookkeeping toggleCamera does.
        setCallState(prev => (prev ? { ...prev, type: 'video' } : prev));
        socketRef.current?.emit('call:mark-video', { callId: cs.callId });
      }

      screenShareTrackRef.current = screenTrack;
      screenShareCleanupRef.current = cleanup;
      setScreenShareStream(rawStream);
      // The OS's own "stop sharing" affordance (a system bar/notification on
      // desktop getDisplayMedia, or the MediaProjection stop action natively)
      // ends the track directly — this is the only way to hear about that.
      screenTrack.onended = () => stopScreenShareRef.current?.();
      setIsScreenSharing(true);
      broadcastState(cs.callId);
    } catch (e) {
      if (e?.name !== 'AbortError' && e?.name !== 'NotAllowedError') {
        console.error('[Call] startScreenShare failed:', e);
        toast.error('Could not start screen share');
      }
    }
  }, [sendSignal]);

  const stopScreenShare = useCallback(async () => {
    const screenTrack = screenShareTrackRef.current;
    if (!screenTrack) return;
    try { screenShareCleanupRef.current?.(); } catch {}
    try { screenTrack.stop(); } catch {}
    screenShareTrackRef.current = null;
    screenShareCleanupRef.current = null;
    setScreenShareStream(null);

    const cameraTrack = cameraTrackDuringShareRef.current;
    cameraTrackDuringShareRef.current = null;
    const cs = callStateRef.current;

    if (cameraTrack) {
      // Video call: hand the sender back the (still-warm) camera track.
      cameraTrack.enabled = isCamOn;
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find(s => s.track === screenTrack || (s.track && s.track.kind === 'video'));
        if (sender) await sender.replaceTrack(cameraTrack).catch(() => {});
      }
    } else {
      // Voice call: the screen track had no camera to fall back to — remove
      // its sender outright and renegotiate so the call reverts to audio-only
      // instead of leaving the remote side staring at a frozen last frame.
      for (const [uname, pc] of pcsRef.current) {
        const sender = pc.getSenders().find(s => s.track === screenTrack);
        if (!sender) continue;
        try { pc.removeTrack(sender); } catch {}
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (cs) await sendSignal('call:offer', cs.callId, uname, { type: 'offer', sdp: offer.sdp });
        } catch (e) {
          console.error('[Call] stopScreenShare renegotiation failed:', e);
        }
      }
      if (cs && !isCamOn) setCallState(prev => (prev ? { ...prev, type: 'voice' } : prev));
    }
    if (cs) broadcastState(cs.callId);
    setIsScreenSharing(false);
  }, [isCamOn, sendSignal]);

  useEffect(() => { stopScreenShareRef.current = stopScreenShare; }, [stopScreenShare]);

  // Every call - voice or video - starts on the earpiece: loud external
  // audio should only ever happen because the user explicitly tapped the
  // speaker button, never automatically. This used to default video calls
  // to speaker (a deliberate WhatsApp-style choice on the theory that
  // you're holding the phone up to look at the screen), but that meant
  // audio came out loud the moment a video call connected with no action
  // from the user - reported as unwanted. Runs once per call (on the
  // outgoing→active / incoming→active transition), not on every render, so
  // a user's manual route pick via setAudioRoute below isn't stomped back
  // to the default afterward.
  const audioRouteInitializedForCallId = useRef(null);
  useEffect(() => {
    if (callState?.phase !== 'active') return;
    if (audioRouteInitializedForCallId.current === callState.callId) return;
    audioRouteInitializedForCallId.current = callState.callId;
    setNativeAudioRoute('earpiece');
    setAudioRouteState('earpiece');
    isNativeBluetoothAudioAvailable().then(setBluetoothAudioAvailable);
  }, [callState?.phase, callState?.callId, callState?.type]);

  // Starts the persistent call notification (see nativeMedia.js /
  // SahaplayCallService.java) as soon as there's a call to represent — for
  // an OUTGOING ring (status: 'ringing', caller side) as well as once it
  // connects (status: 'active'). Starting it for the ring too, not just once
  // active, keeps a backgrounded caller's JS/socket layer alive long enough
  // to actually receive 'call:declined'/'call:answered'/'call:timeout' —
  // without it, Android is free to suspend the app the moment it's not in
  // the foreground, and a fast decline on the other end could go unnoticed
  // until the caller happens to reopen the app much later. Deliberately NOT
  // started for an INCOMING ring: IncomingCallActivity + the FCM service
  // already give the callee side a fully native, JS-independent ring
  // experience, so a second notification here would just be a confusing
  // duplicate of that one. teardownCall() stops this for every possible end
  // reason (declined, timeout, cancelled, hung up either side,
  // disconnected), so it never outlives the call it belongs to.
  const callServiceStateRef = useRef({ callId: null, phase: null });
  useEffect(() => {
    const isRinging = callState?.phase === 'outgoing';
    const isActive = callState?.phase === 'active';
    if (!isRinging && !isActive) return;
    const prev = callServiceStateRef.current;
    if (prev.callId === callState.callId && prev.phase === callState.phase) return;
    callServiceStateRef.current = { callId: callState.callId, phase: callState.phase };
    startNativeCallService(
      callState.peerDisplayName || callState.peerUsername,
      isActive ? (callState.answeredAt || Date.now()) : Date.now(),
      isActive ? 'active' : 'ringing',
      myUsername,
      callState.callId
    );
  }, [callState?.phase, callState?.callId]);

  // Same sahaplay://call-end deep link SahaplayCallService's notification
  // button uses — see nativeCallBridge.js/main.jsx. Routed through the
  // unified hangup() (declared below, after the functions it dispatches to)
  // rather than always endCall() directly: the notification's End
  // Call/Cancel button is now reachable during the outgoing ring too (see
  // above), and a still-ringing call has no 'call:end' concept server-side —
  // only an active one does. hangup has a stable identity (its own deps are
  // all empty-dep useCallbacks), safe to depend on directly.
  useEffect(() => {
    window.addEventListener('native_call_end', hangup);
    return () => window.removeEventListener('native_call_end', hangup);
  }, [hangup]);

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
    networkStatus,
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
    isFlippingCamera,
    isScreenSharing,
    screenShareStream,
    startScreenShare,
    stopScreenShare,
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
