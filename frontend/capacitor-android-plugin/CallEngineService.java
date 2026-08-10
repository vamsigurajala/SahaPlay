package com.sahaplay.app;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;
import org.webrtc.IceCandidate;
import org.webrtc.PeerConnection;
import org.webrtc.SessionDescription;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Random;

// Orchestrates one native voice call end to end: socket signaling, NaCl
// encrypt/decrypt, and the WebRTC peer connection — speaking the exact same
// call:* protocol as CallContext.jsx (see backend/server.js's call:
// handlers, ~lines 8874-9124). Voice-only, 1:1 — see the plan doc for the
// full phased rollout (video + group mesh are later phases).
//
// NOT yet an android.app.Service (despite the planned name) — real call
// audio still runs through LocalMediaController/PeerConnectionWrapper
// directly rather than a bound Service; SahaplayCallService (a real
// foreground Service) is what keeps the process alive in the background
// once a call is active (see startOngoingCallForegroundService below),
// matching the plan's explicit finding that Telecom registration does NOT
// itself grant background camera/mic access.
//
// Two entry points into a call now exist:
//  - startCall() — the Phase 2 debug-panel path (SahaplayCallPlugin),
//    outgoing only, foreground-only, requires JS to have already called
//    initCallEngine this process lifetime.
//  - registerIncomingCall()/acceptIncomingCall()/declineIncomingCall() —
//    the Phase 3 Telecom path (SahaplayConnectionService /
//    SahaplayConnection), reachable with the app fully backgrounded or
//    killed via ensureSelfInitialized()'s persisted-credential cold start.
//
// Still deliberately NOT wired up automatically alongside CallContext.jsx's
// own socket for calls THIS device places or receives through the normal
// app UI — both would be simultaneously connected as the same user, and
// the backend fans call:* events out to every connected socket for that
// username, so an incoming call would ring on both this engine and the JS
// layer at once. Phase 6 gates the JS listeners off on Android; until then,
// only Telecom-routed incoming calls (which the JS layer never sees a
// notification for) and the debug panel's outgoing test calls exercise
// this engine.
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

    private CallEngineService(Context appContext) {
        this.appContext = appContext;
    }

    public void setStatusListener(StatusListener l) {
        this.statusListener = l;
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
    // Silently does nothing if initCallEngine/setNaclSecretKey were never
    // called at least once since install (nothing persisted yet to load) —
    // that's a real, known gap: Phase 3's debug-panel testing requires
    // tapping "Init engine" at least once before background answering can
    // work; wiring this into the app's normal login flow automatically is
    // Phase 6 scope.
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
            status("cannot self-init — no persisted credentials (init the debug panel at least once)");
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

    // Pre-registers a pending call BEFORE Answer is tapped — called from
    // SahaplayConnectionService.onCreateIncomingConnection() the moment
    // Telecom creates the Connection, so a call:offer arriving over the
    // socket shortly after (see onRemoteOffer's callId match) has somewhere
    // to land regardless of how quickly the user actually answers.
    public synchronized void registerIncomingCall(String callId, String callerUsername, String callType) {
        if (session != null && session.callId.equals(callId)) return;
        session = new CallSession(callId, callerUsername, callType, false);
        status("incoming call registered: " + callId + " from " + callerUsername);
    }

    // Callee side of the Telecom-routed flow — mirrors CallContext.jsx's
    // acceptCall(): emit call:accept, then wait for the caller's offer
    // (already handled by onRemoteOffer/handleSocketEvent, unchanged from
    // Phase 2). ensureSelfInitialized() covers the fully-killed-app case;
    // it's a no-op if the engine is already live (e.g. the debug panel was
    // already initialized when the push arrived).
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
        startOngoingCallForegroundService(cs);
    }

    // Declines over plain REST rather than the socket — deliberately the
    // same reliable-regardless-of-socket-state approach CallActionReceiver
    // already uses for the notification's own Decline button (see that
    // file's class comment): a Telecom onReject() can fire before
    // ensureSelfInitialized()'s socket has finished connecting, and REST
    // needs nothing but a token.
    public synchronized void declineIncomingCall(String callId) {
        ensureSelfInitialized();
        String username = myUsername != null ? myUsername : (keyStore != null ? keyStore.loadUsername() : null);
        if (username != null) postDeclineRest(callId, username);
        else Log.w(TAG, "declineIncomingCall: no known username to decline as");
        if (session != null && session.callId.equals(callId)) teardown();
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
    // starts for its own calls (SahaplayMediaPlugin/CallContext.jsx) — see
    // SahaplayCallService's own class comment for why this is mandatory
    // (Telecom registration alone does not grant background camera/mic
    // access; a real declared foreground service does).
    private void startOngoingCallForegroundService(CallSession cs) {
        try {
            Intent intent = new Intent(appContext, SahaplayCallService.class);
            intent.putExtra(SahaplayCallService.EXTRA_PEER_NAME, cs.peerUsername);
            intent.putExtra(SahaplayCallService.EXTRA_STARTED_AT, System.currentTimeMillis());
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

    public synchronized void startCall(String calleeUsername, String callType) {
        if (session != null) { status("already on a call"); return; }
        String callId = "call-" + System.currentTimeMillis() + "-" + Math.abs(new Random().nextInt());
        session = new CallSession(callId, calleeUsername, callType, true);
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
        }
    }

    public synchronized void endCall() {
        CallSession cs = session;
        if (cs == null) return;
        try {
            JSONObject payload = new JSONObject();
            payload.put("callId", cs.callId);
            socketClient.emit("call:end", payload);
        } catch (Exception ignored) {}
        teardown();
    }

    private synchronized void teardown() {
        CallSession cs = session;
        if (cs != null && cs.pc != null) cs.pc.close();
        // pc.close() only stops THAT PeerConnection's own send/receive — the
        // actual microphone capture (and the AudioTrack/AudioSource that
        // feeds it) lives in LocalMediaController, shared/reused across
        // calls via getOrCreateLocalAudioTrack(), and was never being
        // released here. WebRTC's native audio device module keeps the mic
        // open and Android's AudioManager pinned in MODE_IN_COMMUNICATION
        // for as long as that AudioSource exists, regardless of whether any
        // PeerConnection is still using it — which is exactly why the
        // phone's volume rocker kept showing the in-call volume slider
        // indefinitely after End Call: the recording pipeline was still
        // live in the background. Releasing it here lets WebRTC actually
        // stop recording/playout and hand audio focus back; the next call
        // lazily recreates a fresh track via getOrCreateLocalAudioTrack().
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
        stopOngoingCallForegroundService();
        status("call ended");
    }

    // ─── Socket event dispatch ───
    private void handleSocketEvent(String event, JSONObject data) {
        try {
            switch (event) {
                case "call:answered": onCallAnswered(data); break;
                case "call:offer": onRemoteOffer(data); break;
                case "call:answer": onRemoteAnswer(data); break;
                case "call:ice": onRemoteIce(data); break;
                case "call:declined":
                case "call:cancelled":
                case "call:timeout":
                case "call:busy":
                case "call:ended":
                    status(event + " received");
                    teardown();
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
    private void onCallAnswered(JSONObject data) {
        CallSession cs = session;
        if (cs == null || !cs.callId.equals(data.optString("callId"))) return;
        status("call answered, creating offer");

        List<PeerConnection.IceServer> iceServers = TurnCredentialsFetcher.fetch(apiBase, token);
        status(describeIceServers(iceServers));
        byte[] peerPk = publicKeyCache.get(cs.peerUsername);
        if (peerPk == null) { status("no public key for " + cs.peerUsername); teardown(); return; }

        cs.pc = new PeerConnectionWrapper(
            mediaController.getFactory(), iceServers, mediaController.getOrCreateLocalAudioTrack(),
            new PeerConnectionWrapper.Listener() {
                @Override public void onIceCandidate(IceCandidate candidate) {
                    sendEncryptedSignal("call:ice", cs.callId, cs.peerUsername, iceCandidateToJson(candidate), peerPk);
                }
                @Override public void onConnected() { status("ICE connected"); }
                @Override public void onDisconnectedOrFailed(PeerConnection.IceConnectionState state) { status("ICE " + state); }
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

    // Callee side — wired up for a full round trip even though Phase 2's
    // primary debug path only drives the caller side (see class comment).
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

        cs.pc = new PeerConnectionWrapper(
            mediaController.getFactory(), iceServers, mediaController.getOrCreateLocalAudioTrack(),
            new PeerConnectionWrapper.Listener() {
                @Override public void onIceCandidate(IceCandidate candidate) {
                    sendEncryptedSignal("call:ice", cs.callId, fromUsername, iceCandidateToJson(candidate), peerPk);
                }
                @Override public void onConnected() { status("ICE connected"); }
                @Override public void onDisconnectedOrFailed(PeerConnection.IceConnectionState state) { status("ICE " + state); }
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
