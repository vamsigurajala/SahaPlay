package com.sahaplay.app;

// Per-call state for the (currently single, 1:1-only) active call in
// Phase 2. Phase 5 grows this model into one entry per participant in a
// mesh, mirroring CallContext.jsx's callState + groupMembers shape.
public class CallSession {
    public final String callId;
    public final String peerUsername;
    public final String callType; // "voice" | "video"
    public final boolean isCaller;
    public PeerConnectionWrapper pc;

    public CallSession(String callId, String peerUsername, String callType, boolean isCaller) {
        this.callId = callId;
        this.peerUsername = peerUsername;
        this.callType = callType;
        this.isCaller = isCaller;
    }
}
