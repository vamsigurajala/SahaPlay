package com.sahaplay.app;

import android.content.Context;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.EglBase;
import org.webrtc.MediaConstraints;
import org.webrtc.PeerConnectionFactory;

// Owns the process-wide PeerConnectionFactory and the local microphone
// track. Phase 2 is voice-only — camera capture (VideoCapturer/VideoSource)
// is deliberately not wired up yet; that's Phase 4's job, matching how the
// plan scopes video support out of this first WebRTC-interop phase.
public class LocalMediaController {
    private final PeerConnectionFactory factory;
    private final EglBase eglBase;
    private AudioSource audioSource;
    private AudioTrack localAudioTrack;

    public LocalMediaController(Context appContext) {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext.getApplicationContext())
                .createInitializationOptions()
        );
        eglBase = EglBase.create();
        factory = PeerConnectionFactory.builder()
            .setOptions(new PeerConnectionFactory.Options())
            .createPeerConnectionFactory();
    }

    public PeerConnectionFactory getFactory() {
        return factory;
    }

    public synchronized AudioTrack getOrCreateLocalAudioTrack() {
        if (localAudioTrack == null) {
            audioSource = factory.createAudioSource(new MediaConstraints());
            localAudioTrack = factory.createAudioTrack("sahaplay-audio0", audioSource);
            localAudioTrack.setEnabled(true);
        }
        return localAudioTrack;
    }

    public synchronized void setMicEnabled(boolean enabled) {
        if (localAudioTrack != null) localAudioTrack.setEnabled(enabled);
    }

    public synchronized void release() {
        if (localAudioTrack != null) { localAudioTrack.dispose(); localAudioTrack = null; }
        if (audioSource != null) { audioSource.dispose(); audioSource = null; }
    }
}
