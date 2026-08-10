package com.sahaplay.app;

import org.webrtc.IceCandidate;

import java.util.ArrayList;
import java.util.List;

// Buffers ICE candidates that arrive before setRemoteDescription completes —
// mirrors CallContext.jsx's iceBuffersRef/flushIceBuffer. WebRTC rejects
// addIceCandidate calls made before a remote description exists.
public class IceCandidateBuffer {
    private final List<IceCandidate> buffered = new ArrayList<>();

    public synchronized void add(IceCandidate candidate) {
        buffered.add(candidate);
    }

    public synchronized List<IceCandidate> drain() {
        List<IceCandidate> copy = new ArrayList<>(buffered);
        buffered.clear();
        return copy;
    }
}
