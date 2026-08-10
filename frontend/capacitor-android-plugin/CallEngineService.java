package com.sahaplay.app;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;
import org.webrtc.IceCandidate;
import org.webrtc.PeerConnection;
import org.webrtc.SessionDescription;

import java.util.List;
import java.util.Random;

// Orchestrates one native voice call end to end: socket signaling, NaCl
// encrypt/decrypt, and the WebRTC peer connection — speaking the exact same
// call:* protocol as CallContext.jsx (see backend/server.js's call:
// handlers, ~lines 8874-9124). Phase 2 scope only: foreground, voice-only,
// 1:1, no Telecom, no notification UI — see the plan doc for the full
// phased rollout.
//
// NOT yet an android.app.Service (despite the planned name) — that only
// starts to matter once Phase 3 needs a real foreground service tied to
// Telecom for background answering. For now this is a plain singleton
// driven by SahaplayCallPlugin while the app is in the foreground.
//
// Deliberately NOT wired up automatically alongside CallContext.jsx's own
// socket — both would be simultaneously connected as the same user, and
// the backend fans call:* events out to every connected socket for that
// username, so an INCOMING call would ring on both this engine and the JS
// layer at once. Phase 6 gates the JS listeners off on Android; until then,
// exercise the OUTGOING direction only (this engine calls a normal,
// unmodified web/desktop client) via SahaplayCallPlugin's debug startCall —
// that's the whole reason the Phase 2 test entry point is startCall only,
// not also a UI to answer incoming calls.
public class CallEngineService {
    private static final String TAG = "SahaplayCallEngine";
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
        session = null;
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
