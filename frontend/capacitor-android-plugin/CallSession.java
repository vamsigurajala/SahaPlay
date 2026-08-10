package com.sahaplay.app;

// Per-call state for the (currently single, 1:1-only) active call in
// Phase 2. Phase 5 grows this model into one entry per participant in a
// mesh, mirroring CallContext.jsx's callState + groupMembers shape.
public class CallSession {
    public final String callId;
    public final String peerUsername;
    // Best-effort, may be null/empty — lets OutgoingCallActivity/
    // ActiveCallActivity render a real name/photo immediately (same
    // "carried with the push/call action, no extra fetch" pattern
    // IncomingCallActivity now uses — see backend/server.js's call:invite
    // payload and SahaplayCallPlugin.startCall's own params).
    public final String peerDisplayName;
    public final String peerAvatarUrl;
    // "voice" | "video" — not final: a voice call can be upgraded to video
    // mid-call (see CallEngineService.toggleCam()'s upgrade branch), same as
    // CallContext.jsx's own callState.type flipping in toggleCamera().
    public volatile String callType;
    public final boolean isCaller;
    public PeerConnectionWrapper pc;
    // Wall-clock timestamps for OutgoingCallActivity/ActiveCallActivity's
    // own "Calling..."/duration-timer UI — startedAt is set the moment this
    // session object exists (ring begins), answeredAt once the call
    // actually connects (see CallEngineService.onCallAnswered /
    // acceptIncomingCall), matching CallContext.jsx's own callState shape.
    public final long startedAt = System.currentTimeMillis();
    public volatile long answeredAt = 0;
    // Set once the remote side's video track arrives (see
    // PeerConnectionWrapper.Listener.onRemoteVideoTrack) — stored here
    // (not just fired as a one-shot event) so ActiveCallActivity can
    // immediately pick up an already-arrived track if it registers as
    // CallEngineService's UI listener AFTER the track showed up, instead of
    // only reacting to a future event it may have missed during the
    // Activity-launch window.
    public volatile org.webrtc.VideoTrack remoteVideoTrack;
    // Set proactively (before the PeerConnection even exists — see
    // CallEngineService's prepareLocalVideoIfNeeded) so the caller/callee's
    // OWN camera preview can show immediately, matching real calling apps
    // showing your own video while still ringing.
    public volatile org.webrtc.VideoTrack localVideoTrack;
    public volatile boolean remoteMicOn = true;
    public volatile boolean remoteCamOn = false;

    public CallSession(String callId, String peerUsername, String callType, boolean isCaller) {
        this(callId, peerUsername, callType, isCaller, null, null);
    }

    public CallSession(String callId, String peerUsername, String callType, boolean isCaller,
                        String peerDisplayName, String peerAvatarUrl) {
        this.callId = callId;
        this.peerUsername = peerUsername;
        this.callType = callType;
        this.isCaller = isCaller;
        this.peerDisplayName = (peerDisplayName != null && !peerDisplayName.isEmpty()) ? peerDisplayName : peerUsername;
        this.peerAvatarUrl = peerAvatarUrl;
    }
}
