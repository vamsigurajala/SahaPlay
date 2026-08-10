package com.sahaplay.app;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;
import org.webrtc.IceCandidate;
import org.webrtc.PeerConnection;
import org.webrtc.SessionDescription;
import org.webrtc.VideoTrack;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Random;

// Orchestrates one native 1:1 call end to end: socket signaling, NaCl
// encrypt/decrypt, WebRTC (voice + video), and — as of Phase 4 — the real
// call UI itself (OutgoingCallActivity/ActiveCallActivity), speaking the
// exact same call:* protocol as CallContext.jsx (see backend/server.js's
// call: handlers, ~lines 8874-9124). Group mesh calling (Phase 5) is not
// handled here at all — see registerIncomingCall()'s callers, which
// deliberately leave group invites to the existing JS/deep-link path
// untouched (this engine doesn't understand call:member-join semantics).
//
// Phase 4's biggest change from Phase 3: answering is no longer gated
// behind Telecom succeeding. Previously, IncomingCallActivity only routed
// through this engine when a live SahaplayConnection existed (Telecom's
// self-managed PhoneAccount actually worked for that call) and silently
// fell back to the old JS/deep-link flow otherwise — real-device testing
// (MIUI in particular) showed Telecom fails often enough that this left
// most real calls running through JS regardless, defeating the point of
// building a native engine at all. SahaplayFirebaseMessagingService now
// calls registerIncomingCall() unconditionally for every non-group push
// (mirroring the "guaranteed ring" fix from Phase 3), so
// acceptIncomingCall()/declineIncomingCall() always have a session to act
// on — Telecom, when it does work, is layered on top purely for audio-focus/
// Bluetooth arbitration (see SahaplayConnection.answerFromUi(), which still
// calls into this engine either way).
public class CallEngineService {
    private static final String TAG = "SahaplayCallEngine";
    // Hardcoded to match every other native file's own API_BASE constant
    // (IncomingCallActivity, CallActionReceiver) — self-init has no JS
    // context to read frontend/src/lib/api.js's API constant from.
    private static final String API_BASE = "https://sahaplay.com";
    private static CallEngineService instance;

    public static synchronized CallEngineService get(Context context) {
        if (instance == null) instance = new CallEngineService(context.getApplicationContext());
        return instance;
    }

    public interface StatusListener {
        void onStatus(String status);
    }

    // Registered by whichever of OutgoingCallActivity/ActiveCallActivity is
    // currently on screen for the live session — only one at a time, same
    // single-session model the rest of this class already assumes. Not
    // purely event-driven: a newly-registering Activity also reads current
    // state straight off getSession() (see that method's own comment) so a
    // fast state change during the brief window between two Activities
    // launching can't be silently missed.
    public interface CallUiListener {
        void onLocalVideoTrack(VideoTrack track);
        void onRemoteVideoTrack(VideoTrack track);
        void onCallActive();
        void onCallEnded(String reason);
        void onRemoteState(boolean micOn, boolean camOn);
    }

    private final Context appContext;
    private final CallSocketClient socketClient = new CallSocketClient();
    private final CallCrypto crypto = new CallCrypto();

    private PublicKeyCache publicKeyCache;
    private LocalMediaController mediaController;
    private SecretKeyStore keyStore;

    private String apiBase;
    private String token;
    private String myUsername;
    private volatile CallSession session;
    private StatusListener statusListener;
    private volatile CallUiListener uiListener;
    // Local mic/cam state — tracked here (not just on the track objects)
    // since call:state needs to report it to the peer on every toggle, and
    // a freshly-registering ActiveCallActivity needs to read the CURRENT
    // state to draw its buttons correctly rather than assuming defaults.
    private volatile boolean localMicOn = true;
    private volatile boolean localCamOn = false;

    private CallEngineService(Context appContext) {
        this.appContext = appContext;
    }

    public void setStatusListener(StatusListener l) {
        this.statusListener = l;
    }

    public void setUiListener(CallUiListener l) {
        this.uiListener = l;
    }

    public void clearUiListener(CallUiListener l) {
        // Only clear if it's still the same listener — avoids a stale
        // Activity's onDestroy() (running slightly after a NEW Activity's
        // onCreate() already registered itself, a real possibility across
        // an Activity handoff) wiping out the listener that just replaced it.
        if (uiListener == l) uiListener = null;
    }

    private void status(String s) {
        Log.i(TAG, s);
        StatusListener l = statusListener;
        if (l != null) l.onStatus(s);
    }

    public synchronized void init(String apiBase, String token, String username) {
        this.apiBase = apiBase;
        this.token = token;
        this.myUsername = username;
        try {
            this.keyStore = new SecretKeyStore(appContext);
        } catch (Exception e) {
            Log.e(TAG, "SecretKeyStore init failed", e);
        }
        // Persisted immediately (not just held in memory) so a later cold
        // start — the app process was killed and this is a fresh push —
        // can self-init without any JS/WebView context at all. See
        // ensureSelfInitialized().
        if (keyStore != null) keyStore.saveToken(token);
        if (mediaController == null) mediaController = new LocalMediaController(appContext);
        publicKeyCache = new PublicKeyCache(apiBase);
        if (!socketClient.isConnected()) {
            socketClient.connect(apiBase, token, this::handleSocketEvent);
        }
        status("engine initialized for " + username);
    }

    public void setSecretKey(byte[] secretKey) {
        if (keyStore != null) keyStore.save(myUsername, secretKey);
        status("secret key stored");
    }

    public void clearSecretKey() {
        if (keyStore != null) keyStore.clear();
    }

    // Stands up the engine from persisted storage (see SecretKeyStore) with
    // no JS involvement — the path a cold FCM push takes when the app
    // process is fully killed. No-ops if already initialized this process
    // lifetime (init() itself is already a safe no-op reconnect otherwise).
    public synchronized void ensureSelfInitialized() {
        // Already fully live — nothing to do. Checked INCLUDING socket
        // state (not just "do we have credentials in memory") since a
        // long-backgrounded process can have its socket silently dropped
        // by Doze/OEM battery management while token/myUsername are still
        // sitting there from an earlier init() — that combination must
        // still fall through and reconnect, not short-circuit here.
        if (token != null && myUsername != null && socketClient.isConnected()) return;

        String useToken = token;
        String useUsername = myUsername;
        if (useToken == null || useUsername == null) {
            if (keyStore == null) {
                try {
                    keyStore = new SecretKeyStore(appContext);
                } catch (Exception e) {
                    Log.e(TAG, "SecretKeyStore init failed", e);
                    return;
                }
            }
            useUsername = keyStore.loadUsername();
            useToken = keyStore.loadToken();
        }
        if (useUsername == null || useToken == null) {
            status("cannot self-init — no persisted credentials (log in on this device at least once)");
            return;
        }
        // init() itself already no-ops the actual socket .connect() call if
        // one is already live, so this is safe to call even when only the
        // socket (not the credentials) needed refreshing.
        init(API_BASE, useToken, useUsername);
    }

    public String getMyUsername() {
        if (myUsername == null) ensureSelfInitialized();
        return myUsername;
    }

    // Nullable — read by a newly-launched OutgoingCallActivity/
    // ActiveCallActivity in onCreate() to pick up whatever state already
    // exists (peer info, whether video tracks already arrived, current
    // mic/cam state) rather than relying purely on CallUiListener events
    // that may have fired before this Activity had a chance to register.
    public CallSession getSession() {
        return session;
    }

    public boolean isMicOn() { return localMicOn; }
    public boolean isCamOn() { return localCamOn; }
    public boolean isFrontFacingCamera() { return mediaController != null && mediaController.isFrontFacing(); }

    public org.webrtc.EglBase.Context getEglContext() {
        return mediaController != null ? mediaController.getEglContext() : null;
    }

    // Pre-registers a pending call BEFORE Answer is tapped — called
    // unconditionally (for non-group calls) from
    // SahaplayFirebaseMessagingService the moment a call push arrives, NOT
    // just opportunistically from Telecom's onCreateIncomingConnection (see
    // this class's own comment on why that changed in Phase 4). Also called
    // from SahaplayConnectionService when Telecom DOES additionally create a
    // Connection — this method is idempotent (no-ops if already registered
    // for the same callId), so both call sites are safe.
    public synchronized void registerIncomingCall(String callId, String callerUsername, String callType) {
        registerIncomingCall(callId, callerUsername, callType, null, null);
    }

    public synchronized void registerIncomingCall(String callId, String callerUsername, String callType,
                                                    String callerDisplayName, String callerAvatarUrl) {
        if (session != null && session.callId.equals(callId)) return;
        session = new CallSession(callId, callerUsername, callType, false, callerDisplayName, callerAvatarUrl);
        status("incoming call registered: " + callId + " from " + callerUsername);
    }

    // Callee side — mirrors CallContext.jsx's acceptCall(): emit
    // call:accept, then wait for the caller's offer (handled by
    // onRemoteOffer/handleSocketEvent). Optimistically marks the call
    // active and launches ActiveCallActivity immediately (matching
    // CallContext.jsx's own "flip to active the instant Answer is tapped,
    // don't wait for a server round trip" behavior) — the real WebRTC
    // connection catches up moments later once the offer/answer/ICE
    // exchange completes.
    public synchronized void acceptIncomingCall(String callId) {
        ensureSelfInitialized();
        CallSession cs = session;
        if (cs == null || !cs.callId.equals(callId)) {
            status("acceptIncomingCall: no matching pending session for " + callId);
            return;
        }
        try {
            JSONObject payload = new JSONObject();
            payload.put("callId", callId);
            socketClient.emit("call:accept", payload);
            status("accepted " + callId + ", waiting for offer");
        } catch (Exception e) {
            Log.e(TAG, "acceptIncomingCall failed", e);
        }
        // Tells Telecom the call is live (audio focus, Bluetooth routing) —
        // redundant with SahaplayConnection.answerFromUi()'s own setActive()
        // call when THAT'S how this got invoked, but this method is now also
        // reachable directly (see ActiveCallActivity's EXTRA_ANSWER_NOW),
        // which never touches SahaplayConnection at all. A harmless no-op if
        // no live Connection exists for this call (Telecom never cooperated,
        // or this is a plain repeat call from answerFromUi() itself).
        SahaplayConnection conn = SahaplayConnection.getCurrent(callId);
        if (conn != null) conn.setActive();
        cs.answeredAt = System.currentTimeMillis();
        prepareLocalVideoIfNeeded(cs);
        startOngoingCallForegroundService(cs);
        launchActiveCallActivity(cs);
        CallUiListener l = uiListener;
        if (l != null) l.onCallActive();
    }

    // Declines over plain REST rather than the socket — deliberately the
    // same reliable-regardless-of-socket-state approach CallActionReceiver
    // already uses for the notification's own Decline button: Telecom's
    // onReject() (or a cold-started ensureSelfInitialized()) can both fire
    // before the socket has finished connecting, and REST needs nothing but
    // a token.
    public synchronized void declineIncomingCall(String callId) {
        ensureSelfInitialized();
        String username = myUsername != null ? myUsername : (keyStore != null ? keyStore.loadUsername() : null);
        if (username != null) postDeclineRest(callId, username);
        else Log.w(TAG, "declineIncomingCall: no known username to decline as");
        if (session != null && session.callId.equals(callId)) teardown("declined");
    }

    private void postDeclineRest(String callId, String username) {
        new Thread(() -> {
            try {
                URL url = new URL(API_BASE + "/api/calls/" + URLEncoder.encode(callId, "UTF-8") + "/decline");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                String body = "{\"calleeUsername\":\"" + username.replace("\"", "") + "\"}";
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    // Same persistent-notification foreground service the JS layer already
    // starts for its own calls — see SahaplayCallService's own class comment
    // for why this is mandatory (Telecom registration alone does not grant
    // background camera/mic access; a real declared foreground service does).
    private void startOngoingCallForegroundService(CallSession cs) {
        try {
            Intent intent = new Intent(appContext, SahaplayCallService.class);
            intent.putExtra(SahaplayCallService.EXTRA_PEER_NAME, cs.peerDisplayName);
            intent.putExtra(SahaplayCallService.EXTRA_STARTED_AT, cs.startedAt);
            intent.putExtra(SahaplayCallService.EXTRA_STATUS, "active");
            intent.putExtra(SahaplayCallService.EXTRA_USERNAME, myUsername);
            intent.putExtra(SahaplayCallService.EXTRA_CALL_ID, cs.callId);
            ContextCompat.startForegroundService(appContext, intent);
        } catch (Exception e) {
            Log.e(TAG, "startOngoingCallForegroundService failed", e);
        }
    }

    private void stopOngoingCallForegroundService() {
        try {
            Intent stop = new Intent(appContext, SahaplayCallService.class);
            stop.setAction(SahaplayCallService.ACTION_STOP);
            appContext.startService(stop);
        } catch (Exception ignored) {}
    }

    private void launchOutgoingCallActivity(CallSession cs) {
        try {
            Intent intent = new Intent(appContext, OutgoingCallActivity.class);
            intent.putExtra(OutgoingCallActivity.EXTRA_CALL_ID, cs.callId);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            appContext.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "launchOutgoingCallActivity failed", e);
        }
    }

    private void launchActiveCallActivity(CallSession cs) {
        try {
            Intent intent = new Intent(appContext, ActiveCallActivity.class);
            intent.putExtra(ActiveCallActivity.EXTRA_CALL_ID, cs.callId);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            appContext.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "launchActiveCallActivity failed", e);
        }
    }

    // Caller side — the real call button (see GlobalChatWidget.jsx, on
    // Android) and the Phase 2 debug panel both land here.
    // calleeDisplayName/calleeAvatarUrl are optional (the JS caller already
    // has them in hand from the chat header it just tapped Call from —
    // same "carry it along instead of re-fetching" pattern as everywhere
    // else in Phase 4).
    public synchronized void startCall(String calleeUsername, String callType, String calleeDisplayName, String calleeAvatarUrl) {
        if (session != null) { status("already on a call"); return; }
        ensureSelfInitialized();
        String callId = "call-" + System.currentTimeMillis() + "-" + Math.abs(new Random().nextInt());
        CallSession cs = new CallSession(callId, calleeUsername, callType, true, calleeDisplayName, calleeAvatarUrl);
        session = cs;
        localMicOn = true;
        localCamOn = false;
        try {
            JSONObject payload = new JSONObject();
            payload.put("callId", callId);
            payload.put("calleeUsername", calleeUsername);
            payload.put("callType", callType);
            socketClient.emit("call:invite", payload);
            status("inviting " + calleeUsername + " (" + callId + ")");
        } catch (Exception e) {
            Log.e(TAG, "startCall failed", e);
            session = null;
            return;
        }
        // Camera starts immediately (while still ringing) for a video call,
        // not just once answered — matches real calling apps showing your
        // own preview during "Calling...".
        prepareLocalVideoIfNeeded(cs);
        startOngoingCallForegroundService(cs);
        launchOutgoingCallActivity(cs);
    }

    // Creates the local video track (if this is a video call) BEFORE the
    // PeerConnection exists, and notifies whichever UI is listening — see
    // CallSession.localVideoTrack's own comment for why this runs early
    // rather than waiting for onCallAnswered/onRemoteOffer to build it as a
    // side effect of PeerConnectionWrapper construction.
    private void prepareLocalVideoIfNeeded(CallSession cs) {
        if (!"video".equals(cs.callType)) return;
        localCamOn = true;
        VideoTrack track = ensureLocalVideoTrack();
        cs.localVideoTrack = track;
        CallUiListener l = uiListener;
        if (l != null && track != null) l.onLocalVideoTrack(track);
    }

    public synchronized void endCall() {
        CallSession cs = session;
        if (cs == null) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("callId", cs.callId);
            socketClient.emit("call:end", payload);
        } catch (Exception ignored) {}
        teardown("ended");
    }

    // ─── In-call controls (ActiveCallActivity) ───

    public synchronized void toggleMic() {
        localMicOn = !localMicOn;
        if (mediaController != null) mediaController.setMicEnabled(localMicOn);
        sendState();
    }

    // Voice call: no-op (no video m-line exists on that PeerConnection to
    // enable). Video call: simple enable/disable of the track that's
    // already part of the connection — a true voice-to-video mid-call
    // upgrade needs SDP renegotiation this engine doesn't implement yet,
    // matching CallContext.jsx's own toggleCamera scope for now.
    public synchronized void toggleCam() {
        CallSession cs = session;
        if (cs == null || !"video".equals(cs.callType)) return;
        localCamOn = !localCamOn;
        if (mediaController != null) mediaController.setCamEnabled(localCamOn);
        sendState();
    }

    public synchronized void flipCamera() {
        if (mediaController == null) return;
        // switchCamera() reuses the SAME VideoTrack object (see
        // LocalMediaController's own comment) — no replaceTrack call is
        // needed on the PeerConnection side, the completion callback here
        // just exists so a caller could react to it if it ever needs to.
        mediaController.flipCamera(null);
    }

    private void sendState() {
        CallSession cs = session;
        if (cs == null) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("callId", cs.callId);
            payload.put("targetUsername", cs.peerUsername);
            payload.put("micOn", localMicOn);
            payload.put("camOn", localCamOn);
            socketClient.emit("call:state", payload);
        } catch (Exception e) {
            Log.e(TAG, "sendState failed", e);
        }
    }

    private synchronized void teardown(String reason) {
        CallSession cs = session;
        if (cs != null && cs.pc != null) cs.pc.close();
        // pc.close() only stops THAT PeerConnection's own send/receive — the
        // actual microphone/camera capture (and the tracks/sources that feed
        // them) lives in LocalMediaController, shared/reused across calls,
        // and was never being released here. WebRTC's native audio device
        // module keeps the mic open and Android's AudioManager pinned in
        // MODE_IN_COMMUNICATION for as long as that AudioSource exists,
        // regardless of whether any PeerConnection is still using it — which
        // is exactly why the phone's volume rocker kept showing the in-call
        // volume slider indefinitely after End Call before this was fixed.
        // Releasing it here lets WebRTC actually stop recording/playout and
        // hand audio focus back; the next call lazily recreates fresh
        // tracks via getOrCreate*().
        if (mediaController != null) mediaController.release();
        if (cs != null) {
            // Tells Telecom to release the call when it ended some way
            // OTHER than the user hanging up via the Connection itself
            // (remote declined/cancelled/timed out/ended) — SahaplayConnection.
            // onDisconnect() is what calls THIS method in the opposite
            // direction, so disconnectFromEngine() here must not call back
            // into endCall()/declineIncomingCall() to avoid a cycle.
            SahaplayConnection conn = SahaplayConnection.getCurrent(cs.callId);
            if (conn != null) conn.disconnectFromEngine();
        }
        session = null;
        localMicOn = true;
        localCamOn = false;
        stopOngoingCallForegroundService();
        status("call ended: " + reason);
        CallUiListener l = uiListener;
        if (l != null) l.onCallEnded(reason);
    }

    // ─── Socket event dispatch ───
    private void handleSocketEvent(String event, JSONObject data) {
        try {
            switch (event) {
                case "call:answered": onCallAnswered(data); break;
                case "call:offer": onRemoteOffer(data); break;
                case "call:answer": onRemoteAnswer(data); break;
                case "call:ice": onRemoteIce(data); break;
                case "call:state": onRemoteState(data); break;
                case "call:declined":
                case "call:cancelled":
                case "call:timeout":
                case "call:busy":
                case "call:ended":
                    status(event + " received");
                    teardown(event.substring("call:".length()));
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            Log.e(TAG, "handling " + event + " failed", e);
        }
    }

    private byte[] mySecretKey() {
        return keyStore != null ? keyStore.load() : null;
    }

    // Caller side: server confirmed the callee accepted — create my
    // RTCPeerConnection now and send the initial offer. Matches
    // CallContext.jsx's 'call:answered' handler exactly (only the caller
    // ever creates the first offer, and only after this event fires).
    // Also the point at which the caller's own UI flips from "Calling..."
    // to the live call screen, matching CallContext.jsx's own timing.
    private void onCallAnswered(JSONObject data) {
        CallSession cs = session;
        if (cs == null || !cs.callId.equals(data.optString("callId"))) return;
        status("call answered, creating offer");
        cs.answeredAt = System.currentTimeMillis();
        launchActiveCallActivity(cs);
        CallUiListener activeListener = uiListener;
        if (activeListener != null) activeListener.onCallActive();

        List<PeerConnection.IceServer> iceServers = TurnCredentialsFetcher.fetch(apiBase, token);
        status(describeIceServers(iceServers));
        byte[] peerPk = publicKeyCache.get(cs.peerUsername);
        if (peerPk == null) { status("no public key for " + cs.peerUsername); teardown("error"); return; }

        // Already created by prepareLocalVideoIfNeeded() (called from
        // startCall()/acceptIncomingCall() before this ever runs) — reused
        // here, not recreated.
        VideoTrack localVideo = cs.localVideoTrack;
        cs.pc = new PeerConnectionWrapper(
            mediaController.getFactory(), iceServers, mediaController.getOrCreateLocalAudioTrack(), localVideo,
            new PeerConnectionWrapper.Listener() {
                @Override public void onIceCandidate(IceCandidate candidate) {
                    sendEncryptedSignal("call:ice", cs.callId, cs.peerUsername, iceCandidateToJson(candidate), peerPk);
                }
                @Override public void onConnected() { status("ICE connected"); }
                @Override public void onDisconnectedOrFailed(PeerConnection.IceConnectionState state) { status("ICE " + state); }
                @Override public void onRemoteVideoTrack(VideoTrack track) {
                    cs.remoteVideoTrack = track;
                    CallUiListener l = uiListener;
                    if (l != null) l.onRemoteVideoTrack(track);
                }
            }
        );
        cs.pc.createOfferAndSetLocal(new PeerConnectionWrapper.SdpCallback() {
            @Override public void onReady(String sdp) {
                try {
                    JSONObject sdpPayload = new JSONObject();
                    sdpPayload.put("type", "offer");
                    sdpPayload.put("sdp", sdp);
                    sendEncryptedSignal("call:offer", cs.callId, cs.peerUsername, sdpPayload, peerPk);
                } catch (Exception e) { Log.e(TAG, "send offer failed", e); }
            }
            @Override public void onError(String error) { Log.e(TAG, "createOffer failed: " + error); }
        });
    }

    // Callee side — the offer arrives after acceptIncomingCall() already
    // fired call:accept and optimistically launched ActiveCallActivity.
    private void onRemoteOffer(JSONObject data) {
        CallSession cs = session;
        if (cs == null || !cs.callId.equals(data.optString("callId"))) return;
        String fromUsername = data.optString("fromUsername");
        JSONObject sdpEnvelope = data.optJSONObject("sdp");
        if (sdpEnvelope == null) return;
        String plaintext = crypto.decrypt(
            sdpEnvelope.optString("ciphertext"), sdpEnvelope.optString("nonce"),
            sdpEnvelope.optString("ephemeralPublicKey"), mySecretKey());
        if (plaintext == null) { status("offer decrypt failed"); return; }

        String offerSdp;
        try {
            offerSdp = new JSONObject(plaintext).optString("sdp");
        } catch (Exception e) { Log.e(TAG, "bad offer payload", e); return; }

        List<PeerConnection.IceServer> iceServers = TurnCredentialsFetcher.fetch(apiBase, token);
        status(describeIceServers(iceServers));
        byte[] peerPk = publicKeyCache.get(fromUsername);
        if (peerPk == null) { status("no public key for " + fromUsername); return; }

        // Already created by prepareLocalVideoIfNeeded() (called from
        // startCall()/acceptIncomingCall() before this ever runs) — reused
        // here, not recreated.
        VideoTrack localVideo = cs.localVideoTrack;
        cs.pc = new PeerConnectionWrapper(
            mediaController.getFactory(), iceServers, mediaController.getOrCreateLocalAudioTrack(), localVideo,
            new PeerConnectionWrapper.Listener() {
                @Override public void onIceCandidate(IceCandidate candidate) {
                    sendEncryptedSignal("call:ice", cs.callId, fromUsername, iceCandidateToJson(candidate), peerPk);
                }
                @Override public void onConnected() { status("ICE connected"); }
                @Override public void onDisconnectedOrFailed(PeerConnection.IceConnectionState state) { status("ICE " + state); }
                @Override public void onRemoteVideoTrack(VideoTrack track) {
                    cs.remoteVideoTrack = track;
                    CallUiListener l = uiListener;
                    if (l != null) l.onRemoteVideoTrack(track);
                }
            }
        );
        cs.pc.setRemoteDescription(SessionDescription.Type.OFFER, offerSdp, () ->
            cs.pc.createAnswerAndSetLocal(new PeerConnectionWrapper.SdpCallback() {
                @Override public void onReady(String sdp) {
                    try {
                        JSONObject sdpPayload = new JSONObject();
                        sdpPayload.put("type", "answer");
                        sdpPayload.put("sdp", sdp);
                        sendEncryptedSignal("call:answer", cs.callId, fromUsername, sdpPayload, peerPk);
                    } catch (Exception e) { Log.e(TAG, "send answer failed", e); }
                }
                @Override public void onError(String error) { Log.e(TAG, "createAnswer failed: " + error); }
            })
        );
    }

    private void onRemoteAnswer(JSONObject data) {
        CallSession cs = session;
        if (cs == null || cs.pc == null || !cs.callId.equals(data.optString("callId"))) return;
        JSONObject sdpEnvelope = data.optJSONObject("sdp");
        if (sdpEnvelope == null) return;
        String plaintext = crypto.decrypt(
            sdpEnvelope.optString("ciphertext"), sdpEnvelope.optString("nonce"),
            sdpEnvelope.optString("ephemeralPublicKey"), mySecretKey());
        if (plaintext == null) { status("answer decrypt failed"); return; }
        String answerSdp;
        try {
            answerSdp = new JSONObject(plaintext).optString("sdp");
        } catch (Exception e) { Log.e(TAG, "bad answer payload", e); return; }
        cs.pc.setRemoteDescription(SessionDescription.Type.ANSWER, answerSdp, () -> status("remote answer applied"));
    }

    private void onRemoteIce(JSONObject data) {
        CallSession cs = session;
        if (cs == null || cs.pc == null || !cs.callId.equals(data.optString("callId"))) return;
        JSONObject candEnvelope = data.optJSONObject("candidate");
        if (candEnvelope == null) return;
        String plaintext = crypto.decrypt(
            candEnvelope.optString("ciphertext"), candEnvelope.optString("nonce"),
            candEnvelope.optString("ephemeralPublicKey"), mySecretKey());
        if (plaintext == null) return;
        try {
            JSONObject candObj = new JSONObject(plaintext);
            IceCandidate candidate = new IceCandidate(
                candObj.optString("sdpMid"), candObj.optInt("sdpMLineIndex"), candObj.optString("candidate"));
            cs.pc.addIceCandidate(candidate);
        } catch (Exception e) {
            Log.e(TAG, "bad ice payload", e);
        }
    }

    // call:state is sent unencrypted (matches CallContext.jsx's own
    // call:state handling — the one call payload that isn't NaCl-wrapped,
    // since mic/cam on/off carries no sensitive content).
    private void onRemoteState(JSONObject data) {
        CallSession cs = session;
        if (cs == null || !cs.callId.equals(data.optString("callId"))) return;
        cs.remoteMicOn = data.optBoolean("micOn", true);
        cs.remoteCamOn = data.optBoolean("camOn", false);
        CallUiListener l = uiListener;
        if (l != null) l.onRemoteState(cs.remoteMicOn, cs.remoteCamOn);
    }

    private VideoTrack ensureLocalVideoTrack() {
        try {
            return mediaController.getOrCreateLocalVideoTrack();
        } catch (Exception e) {
            Log.e(TAG, "getOrCreateLocalVideoTrack failed", e);
            return null;
        }
    }

    private void sendEncryptedSignal(String event, String callId, String targetUsername, JSONObject payload, byte[] peerPk) {
        try {
            CallCrypto.Envelope env = crypto.encrypt(payload.toString(), peerPk);
            JSONObject envJson = new JSONObject();
            envJson.put("ciphertext", env.ciphertext);
            envJson.put("nonce", env.nonce);
            envJson.put("ephemeralPublicKey", env.ephemeralPublicKey);

            JSONObject wrapper = new JSONObject();
            wrapper.put("callId", callId);
            wrapper.put("targetUsername", targetUsername);
            if ("call:ice".equals(event)) wrapper.put("candidate", envJson);
            else wrapper.put("sdp", envJson);
            socketClient.emit(event, wrapper);
        } catch (Exception e) {
            Log.e(TAG, "sendEncryptedSignal(" + event + ") failed", e);
        }
    }

    // Surfaces whether a real TURN relay is available or the call fell back
    // to STUN-only — visible only in the debug status log right now, but
    // exactly the piece of information needed to explain a connect-then-
    // drop failure (STUN-only direct P2P is far more likely to break across
    // mobile-carrier NAT than a TURN relay, which stays reachable).
    private String describeIceServers(List<PeerConnection.IceServer> iceServers) {
        boolean hasTurn = false;
        for (PeerConnection.IceServer s : iceServers) {
            for (String url : s.urls) {
                if (url.startsWith("turn:") || url.startsWith("turns:")) { hasTurn = true; break; }
            }
            if (hasTurn) break;
        }
        return "ICE servers: " + iceServers.size() + (hasTurn ? " (TURN available)" : " (STUN-only fallback)");
    }

    private JSONObject iceCandidateToJson(IceCandidate candidate) {
        JSONObject o = new JSONObject();
        try {
            o.put("sdpMid", candidate.sdpMid);
            o.put("sdpMLineIndex", candidate.sdpMLineIndex);
            o.put("candidate", candidate.sdp);
        } catch (Exception ignored) {}
        return o;
    }
}
