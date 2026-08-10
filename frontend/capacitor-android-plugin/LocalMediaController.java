package com.sahaplay.app;

import android.content.Context;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.Camera1Enumerator;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CameraVideoCapturer;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.MediaConstraints;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

// Owns the process-wide PeerConnectionFactory and the local mic/camera
// tracks. Phase 2/3 were voice-only; Phase 4 adds camera capture here —
// front/back CameraVideoCapturer feeding a single VideoTrack that's reused
// across calls (release()d and lazily recreated the same way the audio
// track already was, fixing the exact "mic stays open after hangup" class
// of bug for video too).
public class LocalMediaController {
    private final Context appContext;
    private final PeerConnectionFactory factory;
    private final EglBase eglBase;
    private AudioSource audioSource;
    private AudioTrack localAudioTrack;

    private VideoCapturer videoCapturer;
    private SurfaceTextureHelper surfaceTextureHelper;
    private VideoSource videoSource;
    private VideoTrack localVideoTrack;
    // Tracked explicitly rather than queried back off the capturer — WebRTC's
    // CameraVideoCapturer has no direct "which camera is this" getter once
    // created, and CallContext.jsx's own flipCamera() comment already
    // documents why relying on the track's reported facingMode is unreliable
    // on real devices. 'user' (front) is the default first camera.
    private boolean isFrontFacing = true;

    public LocalMediaController(Context appContext) {
        this.appContext = appContext.getApplicationContext();
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(this.appContext)
                .createInitializationOptions()
        );
        eglBase = EglBase.create();
        // Encoder/decoder factories are what actually give the factory any
        // video codec support at all (H264/VP8/VP9) — without them, a video
        // call's local/remote tracks exist but never produce real frames.
        // Bound to this EglBase's context so hardware-accelerated codecs can
        // share the same GL context SurfaceViewRenderer uses for rendering
        // (see ActiveCallActivity) — a mismatched/absent shared context is
        // the classic cause of a black video frame with everything else
        // (audio, ICE, signaling) working fine.
        factory = PeerConnectionFactory.builder()
            .setOptions(new PeerConnectionFactory.Options())
            .setVideoEncoderFactory(new DefaultVideoEncoderFactory(eglBase.getEglBaseContext(), true, true))
            .setVideoDecoderFactory(new DefaultVideoDecoderFactory(eglBase.getEglBaseContext()))
            .createPeerConnectionFactory();
    }

    public PeerConnectionFactory getFactory() {
        return factory;
    }

    public EglBase.Context getEglContext() {
        return eglBase.getEglBaseContext();
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

    // Finds the front camera's device name via WebRTC's own CameraEnumerator
    // rather than assuming index 0 — matches how CallContext.jsx's web
    // getUserMedia({facingMode:'user'}) picks a camera, and is what makes
    // flipCamera() below able to reliably target "the other one" afterward.
    // Camera2Enumerator needs Camera2 API support (checked via
    // Camera2Enumerator.isSupported); Camera1Enumerator is the fallback for
    // older/lower-end devices that don't have it.
    private CameraEnumerator createEnumerator() {
        if (Camera2Enumerator.isSupported(appContext)) return new Camera2Enumerator(appContext);
        return new Camera1Enumerator(false);
    }

    // Same "release the old track before creating an issue" ordering
    // CallContext.jsx's flipCamera comment explains isn't actually needed
    // here (this is a fresh acquire, not a live swap), but starting capture
    // fresh each call (rather than trying to keep one alive indefinitely
    // across calls the way the audio track is) sidesteps a whole class of
    // "camera left open/black frame on the second call" bugs a persistent
    // capturer would risk — release() below always tears this down on
    // teardown, and this recreates it from scratch on the next call.
    public synchronized VideoTrack getOrCreateLocalVideoTrack() {
        if (localVideoTrack != null) return localVideoTrack;
        CameraEnumerator enumerator = createEnumerator();
        String frontCameraName = null;
        for (String name : enumerator.getDeviceNames()) {
            if (enumerator.isFrontFacing(name)) { frontCameraName = name; break; }
        }
        String cameraName = frontCameraName != null ? frontCameraName : (enumerator.getDeviceNames().length > 0 ? enumerator.getDeviceNames()[0] : null);
        if (cameraName == null) return null; // no camera on this device at all
        isFrontFacing = frontCameraName != null;

        videoCapturer = enumerator.createCapturer(cameraName, null);
        if (videoCapturer == null) return null;

        surfaceTextureHelper = SurfaceTextureHelper.create("SahaplayCaptureThread", eglBase.getEglBaseContext());
        videoSource = factory.createVideoSource(videoCapturer.isScreencast());
        videoCapturer.initialize(surfaceTextureHelper, appContext, videoSource.getCapturerObserver());
        // Matches CAM_CONSTRAINTS in CallContext.jsx (640x480 @ 24fps ideal) —
        // keeping native and web callers requesting comparable resolutions
        // avoids one side sending a much heavier stream than the other.
        videoCapturer.startCapture(640, 480, 24);

        localVideoTrack = factory.createVideoTrack("sahaplay-video0", videoSource);
        localVideoTrack.setEnabled(true);
        return localVideoTrack;
    }

    public synchronized void setCamEnabled(boolean enabled) {
        if (localVideoTrack != null) localVideoTrack.setEnabled(enabled);
    }

    public boolean isFrontFacing() {
        return isFrontFacing;
    }

    // Mirrors CallContext.jsx's flipCamera() at the API level (switch the
    // SAME track's capture source rather than creating a new track) —
    // CameraVideoCapturer.switchCamera() does exactly that internally, no
    // renegotiation needed on the PeerConnection side since the VideoTrack
    // object itself never changes.
    public synchronized void flipCamera(Runnable onDone) {
        if (!(videoCapturer instanceof CameraVideoCapturer)) { if (onDone != null) onDone.run(); return; }
        ((CameraVideoCapturer) videoCapturer).switchCamera(new CameraVideoCapturer.CameraSwitchHandler() {
            @Override public void onCameraSwitchDone(boolean isFrontCamera) {
                isFrontFacing = isFrontCamera;
                if (onDone != null) onDone.run();
            }
            @Override public void onCameraSwitchError(String error) {
                if (onDone != null) onDone.run();
            }
        });
    }

    public synchronized void release() {
        if (localAudioTrack != null) { localAudioTrack.dispose(); localAudioTrack = null; }
        if (audioSource != null) { audioSource.dispose(); audioSource = null; }
        releaseVideo();
    }

    private void releaseVideo() {
        if (videoCapturer != null) {
            try { videoCapturer.stopCapture(); } catch (Exception ignored) {}
            videoCapturer.dispose();
            videoCapturer = null;
        }
        if (localVideoTrack != null) { localVideoTrack.dispose(); localVideoTrack = null; }
        if (videoSource != null) { videoSource.dispose(); videoSource = null; }
        if (surfaceTextureHelper != null) { surfaceTextureHelper.dispose(); surfaceTextureHelper = null; }
        isFrontFacing = true;
    }
}
