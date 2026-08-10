package com.sahaplay.app;

import android.util.Log;

import org.webrtc.AudioTrack;
import org.webrtc.DataChannel;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.MediaStreamTrack;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;

import java.util.Collections;
import java.util.List;

// One RTCPeerConnection to exactly one other participant — same one-
// connection-per-peer mesh model as CallContext.jsx's pcsRef Map (see
// doConnect there). Phase 2 only ever has one of these alive at a time
// (plain 1:1 voice), but the shape already matches what group mesh
// (Phase 5) needs: N independent wrappers, one per other participant.
public class PeerConnectionWrapper {
    private static final String TAG = "SahaplayCallPC";

    public interface Listener {
        void onIceCandidate(IceCandidate candidate);
        void onConnected();
        void onDisconnectedOrFailed(PeerConnection.IceConnectionState state);
    }

    public interface SdpCallback {
        void onReady(String sdp);
        void onError(String error);
    }

    private final PeerConnection pc;
    private final IceCandidateBuffer iceBuffer = new IceCandidateBuffer();

    public PeerConnectionWrapper(PeerConnectionFactory factory, List<PeerConnection.IceServer> iceServers,
                                  AudioTrack localAudioTrack, Listener listener) {
        PeerConnection.RTCConfiguration rtcConfig = new PeerConnection.RTCConfiguration(iceServers);
        rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        // GATHER_CONTINUALLY (not GATHER_ONCE) — matches browser RTCPeerConnection's
        // default behavior, letting ICE keep gathering/re-pairing candidates after a
        // NAT rebind or transient network blip instead of giving up once the initial
        // gathering pass finishes. A one-shot gather can connect fine initially and
        // then never recover from exactly the kind of mid-call drop mobile-carrier
        // NAT is prone to.
        rtcConfig.continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY;

        this.pc = factory.createPeerConnection(rtcConfig, new PeerConnection.Observer() {
            @Override public void onIceCandidate(IceCandidate candidate) {
                if (listener != null) listener.onIceCandidate(candidate);
            }
            @Override public void onIceConnectionChange(PeerConnection.IceConnectionState state) {
                Log.i(TAG, "ICE state: " + state);
                if (listener == null) return;
                if (state == PeerConnection.IceConnectionState.CONNECTED || state == PeerConnection.IceConnectionState.COMPLETED) {
                    listener.onConnected();
                } else if (state == PeerConnection.IceConnectionState.DISCONNECTED
                        || state == PeerConnection.IceConnectionState.FAILED
                        || state == PeerConnection.IceConnectionState.CLOSED) {
                    listener.onDisconnectedOrFailed(state);
                }
            }
            @Override public void onIceCandidatesRemoved(IceCandidate[] candidates) {}
            @Override public void onSignalingChange(PeerConnection.SignalingState state) {}
            @Override public void onIceConnectionReceivingChange(boolean receiving) {}
            @Override public void onIceGatheringChange(PeerConnection.IceGatheringState state) {}
            @Override public void onAddStream(MediaStream stream) {}
            @Override public void onRemoveStream(MediaStream stream) {}
            @Override public void onDataChannel(DataChannel channel) {}
            @Override public void onRenegotiationNeeded() {}
            @Override public void onAddTrack(RtpReceiver receiver, MediaStream[] streams) {
                if (receiver.track() != null && MediaStreamTrack.AUDIO_TRACK_KIND.equals(receiver.track().kind())) {
                    Log.i(TAG, "remote audio track added");
                }
            }
        });

        if (this.pc != null && localAudioTrack != null) {
            this.pc.addTrack(localAudioTrack, Collections.singletonList("sahaplay-stream0"));
        }
    }

    public void createOfferAndSetLocal(SdpCallback callback) {
        pc.createOffer(new SimpleSdpObserver() {
            @Override public void onCreateSuccess(SessionDescription desc) {
                pc.setLocalDescription(new SimpleSdpObserver() {
                    @Override public void onSetSuccess() { callback.onReady(desc.description); }
                    @Override public void onSetFailure(String error) { callback.onError(error); }
                }, desc);
            }
            @Override public void onCreateFailure(String error) { callback.onError(error); }
        }, new MediaConstraints());
    }

    public void createAnswerAndSetLocal(SdpCallback callback) {
        pc.createAnswer(new SimpleSdpObserver() {
            @Override public void onCreateSuccess(SessionDescription desc) {
                pc.setLocalDescription(new SimpleSdpObserver() {
                    @Override public void onSetSuccess() { callback.onReady(desc.description); }
                    @Override public void onSetFailure(String error) { callback.onError(error); }
                }, desc);
            }
            @Override public void onCreateFailure(String error) { callback.onError(error); }
        }, new MediaConstraints());
    }

    // onDone fires after any buffered ICE candidates (ones that arrived
    // before this remote description existed) have been flushed — mirrors
    // CallContext.jsx's setRemoteDescription-then-flushIceBuffer sequencing.
    public void setRemoteDescription(SessionDescription.Type type, String sdp, Runnable onDone) {
        pc.setRemoteDescription(new SimpleSdpObserver() {
            @Override public void onSetSuccess() {
                for (IceCandidate c : iceBuffer.drain()) {
                    pc.addIceCandidate(c);
                }
                if (onDone != null) onDone.run();
            }
            @Override public void onSetFailure(String error) { Log.e(TAG, "setRemoteDescription failed: " + error); }
        }, new SessionDescription(type, sdp));
    }

    public void addIceCandidate(IceCandidate candidate) {
        if (pc.getRemoteDescription() == null) {
            iceBuffer.add(candidate);
        } else {
            pc.addIceCandidate(candidate);
        }
    }

    public void close() {
        try { pc.close(); } catch (Exception ignored) {}
    }

    private abstract static class SimpleSdpObserver implements SdpObserver {
        @Override public void onCreateSuccess(SessionDescription desc) {}
        @Override public void onSetSuccess() {}
        @Override public void onCreateFailure(String error) {}
        @Override public void onSetFailure(String error) {}
    }
}
