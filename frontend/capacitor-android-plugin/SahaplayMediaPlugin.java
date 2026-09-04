package com.sahaplay.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.Window;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import java.util.Map;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Exposes real device volume/brightness control to the web player's vertical
// swipe gestures (see frontend/src/lib/nativeMedia.js and the
// handleVerticalGestureMove wiring in frontend/src/Room.jsx) — something a
// plain web page, PWA, or TWA can never do, since no browser exposes system
// volume or screen brightness to JavaScript. Java (not Kotlin) deliberately,
// to match the toolchain `npx cap add android` generates by default with no
// extra Gradle setup. This file is the source of truth, hand-written and
// committed here; the CI workflow
// (.github/workflows/android-capacitor-build.yml) copies it into the
// generated native project on every build rather than it living inside that
// generated (never-committed) tree directly.
@CapacitorPlugin(
    name = "SahaplayMedia",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO }, alias = "media"),
        @Permission(strings = {
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
            Manifest.permission.READ_EXTERNAL_STORAGE
        }, alias = "photos")
    }
)
public class SahaplayMediaPlugin extends Plugin {

    // Screen-capture frames/events arrive from SahaplayScreenCaptureService
    // (a plain Android Service, not a Capacitor plugin, so it can't call
    // notifyListeners() directly) via these static hooks onto whichever
    // plugin instance is currently attached to the bridge — there is only
    // ever one Bridge/WebView alive per app process.
    private static SahaplayMediaPlugin activeInstance;

    private PluginCall pendingPhotoPermissionCall;
    private PluginCall pendingCameraPermissionCall;

    @Override
    public void load() {
        activeInstance = this;
    }

    public static void onPhotoPermissionResult(Map<String, Boolean> result) {
        if (activeInstance == null || activeInstance.pendingPhotoPermissionCall == null) return;
        PluginCall call = activeInstance.pendingPhotoPermissionCall;
        activeInstance.pendingPhotoPermissionCall = null;
        boolean granted = false;
        if (result != null) {
            for (Map.Entry<String, Boolean> entry : result.entrySet()) {
                if (Boolean.TRUE.equals(entry.getValue())) {
                    granted = true;
                    break;
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    public static void onCameraPermissionResult(Map<String, Boolean> result) {
        if (activeInstance == null || activeInstance.pendingCameraPermissionCall == null) return;
        PluginCall call = activeInstance.pendingCameraPermissionCall;
        activeInstance.pendingCameraPermissionCall = null;
        boolean cameraGranted = result != null && Boolean.TRUE.equals(result.get(Manifest.permission.CAMERA));
        JSObject ret = new JSObject();
        ret.put("granted", cameraGranted);
        call.resolve(ret);
    }

    public static void emitScreenFrame(String base64Jpeg, int width, int height) {
        if (activeInstance == null) return;
        JSObject data = new JSObject();
        data.put("data", base64Jpeg);
        data.put("width", width);
        data.put("height", height);
        activeInstance.notifyListeners("screenFrame", data);
    }

    public static void emitScreenCaptureStopped() {
        if (activeInstance == null) return;
        activeInstance.notifyListeners("screenCaptureStopped", new JSObject());
    }

    // Called by CallActionReceiver after a notification Decline/Hang Up
    // action posts to the backend — that HTTP call only tells the OTHER
    // person the call is over, it does nothing for THIS device's own
    // WebRTC/call state. If the app's JS layer is still alive (backgrounded
    // but not killed — the common case, since SahaplayCallService's whole
    // purpose is keeping it alive), that local state was never torn down by
    // a background-only broadcast action, which is what made "Hang Up in
    // the notification" look like it didn't work: the backend correctly
    // told the other person, but THIS side's call screen/audio/
    // RTCPeerConnection just kept running until the app was eventually
    // backgrounded long enough to be killed. Runs the exact same
    // window.dispatchEvent(new Event('native_call_end')) main.jsx already
    // wires up via nativeCallBridge.js's initNativeCallEndLink (previously
    // only reachable by deep-linking back into the app) — CallContext.jsx's
    // hangup() already branches correctly on the current call phase
    // (declining/ending/cancelling), so the same event works for both the
    // Decline and Hang Up actions. A no-op if the process was fully killed
    // (activeInstance null) — nothing to tear down locally in that case,
    // the backend calls already covered everything that matters.
    public static void notifyNativeCallEnded() {
        if (activeInstance == null) return;
        try {
            activeInstance.getActivity().runOnUiThread(() -> {
                try {
                    activeInstance.getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new Event('native_call_end'));", null);
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}
    }

    // STREAM_MUSIC is the same system-wide media volume stream the phone's
    // physical volume buttons control — no manifest permission required.
    @PluginMethod
    public void setVolume(PluginCall call) {
        Double value = call.getDouble("value");
        if (value == null) {
            call.reject("value required");
            return;
        }
        AudioManager am = (AudioManager) getActivity().getSystemService(Context.AUDIO_SERVICE);
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int target = (int) (clamp(value, 0.0, 1.0) * max);
        am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0);
        call.resolve();
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        AudioManager am = (AudioManager) getActivity().getSystemService(Context.AUDIO_SERVICE);
        int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int current = am.getStreamVolume(AudioManager.STREAM_MUSIC);
        JSObject ret = new JSObject();
        ret.put("value", max > 0 ? (double) current / max : 0.0);
        call.resolve(ret);
    }

    // Window-scoped brightness override — auto-reverts when the app is
    // backgrounded/closed, unlike a real Settings.System change (which needs
    // the heavily-gated WRITE_SETTINGS permission and a manual user grant).
    // This is deliberately the same approach native video players use: the
    // phone should snap back to its normal brightness once you leave the
    // video, not stay wherever the video left it.
    @PluginMethod
    public void setBrightness(PluginCall call) {
        Double value = call.getDouble("value");
        if (value == null) {
            call.reject("value required");
            return;
        }
        float clamped = (float) clamp(value, 0.01, 1.0);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.screenBrightness = clamped;
            window.setAttributes(layoutParams);
        });
        call.resolve();
    }

    // setBrightness above always clamps to a real 0.01–1.0 value — there was
    // no way to ever CLEAR the per-window override it applies, so once a user
    // dragged the fullscreen brightness gesture even once, this app's window
    // stayed pinned at that brightness — including after leaving the room,
    // backgrounding the app, or relaunching it later — until the whole app
    // process was killed. BRIGHTNESS_OVERRIDE_NONE (-1) is the documented
    // Android sentinel for "stop overriding, follow the system's own current
    // brightness again" — this is what Room.jsx now calls whenever the
    // brightness gesture's own CSS dim resets (leaving fullscreen) and on
    // unmount, so the override can never actually outlive the room screen.
    @PluginMethod
    public void resetBrightness(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            window.setAttributes(layoutParams);
        });
        call.resolve();
    }

    // The web `screen.orientation.lock()` API is a no-op on Android whenever
    // the device's own auto-rotate system setting is off (a very common
    // default) — Chromium's implementation only lets the API pick between
    // orientations auto-rotate would already allow, it never overrides that
    // toggle. That's why "turn landscape on fullscreen" never worked no
    // matter how the JS-side lock-state tracking was fixed: the lock() call
    // itself was silently rejecting the whole time. A native app doesn't
    // have that limitation — Activity.setRequestedOrientation() forces a
    // real rotation regardless of the system auto-rotate setting, exactly
    // like YouTube/Netflix's own native players. android:configChanges on
    // the activity already includes "orientation|screenSize", so this does
    // NOT recreate the Activity/reload the WebView when called.
    @PluginMethod
    public void lockOrientation(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("value required");
            return;
        }
        final int orientation;
        if ("landscape".equals(value)) {
            // SENSOR_LANDSCAPE (not plain LANDSCAPE) so the device can still
            // pick landscape-left vs landscape-right off the accelerometer,
            // matching how a real video player's fullscreen feels.
            orientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        } else if ("portrait".equals(value)) {
            orientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        } else {
            call.reject("invalid value");
            return;
        }
        getActivity().runOnUiThread(() -> getActivity().setRequestedOrientation(orientation));
        call.resolve();
    }

    @PluginMethod
    public void unlockOrientation(PluginCall call) {
        getActivity().runOnUiThread(() ->
            getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
        call.resolve();
    }

    // Screen share: the WebView this app otherwise runs on has no
    // screen-capture API at all (getDisplayMedia() is undefined there,
    // unconditionally — not a support gap that improves with a newer
    // Android/Chrome version), so this drives Android's own MediaProjection
    // API directly instead, same as native apps like WhatsApp/Zoom do.
    // createScreenCaptureIntent() must be launched for a result — Capacitor
    // plugins do this via startActivityForResult()/@ActivityCallback rather
    // than the Activity's own startActivityForResult(), since the bridge
    // needs to intercept the result before handing it back to this call.
    @PluginMethod
    public void requestScreenCapture(PluginCall call) {
        MediaProjectionManager mgr = (MediaProjectionManager) getActivity().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        Intent intent = mgr.createScreenCaptureIntent();
        startActivityForResult(call, intent, "handleScreenCaptureResult");
    }

    @ActivityCallback
    private void handleScreenCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen capture permission denied");
            return;
        }

        DisplayMetrics metrics = new DisplayMetrics();
        getActivity().getWindowManager().getDefaultDisplay().getRealMetrics(metrics);

        Intent serviceIntent = new Intent(getActivity(), SahaplayScreenCaptureService.class);
        serviceIntent.putExtra(SahaplayScreenCaptureService.EXTRA_RESULT_CODE, result.getResultCode());
        serviceIntent.putExtra(SahaplayScreenCaptureService.EXTRA_RESULT_DATA, result.getData());
        serviceIntent.putExtra(SahaplayScreenCaptureService.EXTRA_WIDTH, metrics.widthPixels);
        serviceIntent.putExtra(SahaplayScreenCaptureService.EXTRA_HEIGHT, metrics.heightPixels);
        serviceIntent.putExtra(SahaplayScreenCaptureService.EXTRA_DENSITY, metrics.densityDpi);
        ContextCompat.startForegroundService(getActivity(), serviceIntent);

        call.resolve();
    }

    @PluginMethod
    public void stopScreenCapture(PluginCall call) {
        getActivity().stopService(new Intent(getActivity(), SahaplayScreenCaptureService.class));
        call.resolve();
    }

    // Real call-audio output routing (earpiece/speaker/Bluetooth headset) for
    // CallContext.jsx's 1:1 calling feature — no web/WebView API exposes this
    // (Chromium's WebRTC audio manager already defaults new calls to the
    // earpiece, but gives JS no way to switch to speaker or a paired
    // Bluetooth headset, the exact "speaker vs bluetooth" picker WhatsApp
    // has). MODE_IN_COMMUNICATION is the standard AudioManager mode for an
    // active VoIP call — it's what makes setSpeakerphoneOn/Bluetooth SCO
    // actually take effect instead of being ignored, and is set on every
    // route change (not just once) since 'normal' below explicitly leaves it.
    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        String route = call.getString("route");
        if (route == null) {
            call.reject("route required");
            return;
        }
        AudioManager am = (AudioManager) getActivity().getSystemService(Context.AUDIO_SERVICE);
        switch (route) {
            case "speaker":
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                stopBluetoothScoQuietly(am);
                am.setSpeakerphoneOn(true);
                break;
            case "earpiece":
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                stopBluetoothScoQuietly(am);
                am.setSpeakerphoneOn(false);
                break;
            case "bluetooth":
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                am.setSpeakerphoneOn(false);
                am.startBluetoothSco();
                am.setBluetoothScoOn(true);
                break;
            case "normal":
                // Call ended — hand audio routing back to normal (non-VoIP) behavior.
                stopBluetoothScoQuietly(am);
                am.setSpeakerphoneOn(false);
                am.setMode(AudioManager.MODE_NORMAL);
                break;
            default:
                call.reject("invalid route");
                return;
        }
        call.resolve();
    }

    @PluginMethod
    public void getAvailableAudioRoutes(PluginCall call) {
        AudioManager am = (AudioManager) getActivity().getSystemService(Context.AUDIO_SERVICE);
        boolean bluetoothAvailable = false;
        // getDevices() (API 23+) reports currently connected/available audio
        // output devices — checking for a Bluetooth SCO/A2DP entry here
        // (rather than assuming) mirrors WhatsApp's own behavior of only
        // showing the Bluetooth option when a headset is actually paired
        // and connected, not unconditionally.
        for (android.media.AudioDeviceInfo device : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int type = device.getType();
            if (type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                || type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
                bluetoothAvailable = true;
                break;
            }
        }
        JSObject ret = new JSObject();
        ret.put("bluetoothAvailable", bluetoothAvailable);
        call.resolve(ret);
    }

    // Starts/stops SahaplayCallService — the foreground service + persistent
    // notification that keeps an active call's WebRTC connections alive
    // while the app is backgrounded (see that file for the full reasoning).
    // Called from CallContext.jsx the moment a call becomes active, and
    // again to stop it the moment the call ends.
    @PluginMethod
    public void startCallForegroundService(PluginCall call) {
        String peerName = call.getString("peerName", "Ongoing call");
        // No PluginCall.getLong() in the Capacitor bridge API — every JS
        // number crosses as a double, cast back to long here.
        Double startedAtMillis = call.getDouble("startedAtMillis");
        long startedAt = startedAtMillis != null ? startedAtMillis.longValue() : System.currentTimeMillis();
        String status = call.getString("status", "active");
        String username = call.getString("username", "");
        String callId = call.getString("callId", "");
        Intent intent = new Intent(getContext(), SahaplayCallService.class);
        intent.putExtra(SahaplayCallService.EXTRA_PEER_NAME, peerName);
        intent.putExtra(SahaplayCallService.EXTRA_STARTED_AT, startedAt);
        intent.putExtra(SahaplayCallService.EXTRA_STATUS, status);
        intent.putExtra(SahaplayCallService.EXTRA_USERNAME, username);
        intent.putExtra(SahaplayCallService.EXTRA_CALL_ID, callId);
        androidx.core.content.ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void stopCallForegroundService(PluginCall call) {
        Intent intent = new Intent(getContext(), SahaplayCallService.class);
        intent.setAction(SahaplayCallService.ACTION_STOP);
        try { getContext().startService(intent); } catch (Exception ignored) {}
        call.resolve();
    }

    // Proactively resolves CAMERA + RECORD_AUDIO runtime permissions BEFORE
    // any call setup begins — see CallContext.jsx's startCall/acceptCall,
    // which now await this first thing. Capacitor's own WebView permission
    // bridge would eventually request these reactively anyway once the web
    // app calls getUserMedia(), but by then this call may have ALREADY
    // started SahaplayCallService with foregroundServiceType
    // "microphone|camera" (see startCallForegroundService above) — and
    // Android 14+ throws a hard, uncaught SecurityException (crashing the
    // whole app process, not just failing gracefully) if that foreground
    // service type is declared before the matching runtime permission is
    // actually granted. This was the real cause behind "app gets stuck and
    // closes right after granting the permission" — the grant itself
    // succeeded, but the foreground service had already tried (and failed)
    // to start a moment earlier in the same race. Resolving permissions
    // here first, awaited from JS before anything call-related happens,
    // removes that race entirely.
    @PluginMethod
    public void ensureMediaPermissions(PluginCall call) {
        if (getPermissionState("media") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("media", call, "mediaPermissionCallback");
    }

    @PermissionCallback
    private void mediaPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("media") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    // Explicit gallery/attachment-picker permission, requested BEFORE the
    // paperclip/camera-screen gallery button opens the actual file chooser —
    // see requestPhotoAccess() in mediaPermissionGate.js, the JS-side choke
    // point every such button now awaits first. A plain <input type=file>
    // would open Android's Photo Picker without ever needing this (that
    // picker is deliberately permission-free), but a real system prompt is
    // requested anyway per explicit product request rather than relying on
    // that silent, scoped access.
    //
    // Goes through MainActivity's own photoPermissionLauncher (a plain
    // ActivityResultContracts.RequestPermission()) instead of this class's
    // own requestPermissionForAlias("photos", ...) — a previous version of
    // this method used that, and on a real device it never showed Android's
    // system dialog at all, going straight to this app's own fallback modal
    // instead. That's the exact same class of failure already documented
    // (and worked around, via getUserMedia() instead) for camera/mic in
    // nativeMedia.js's ensureNativeMediaPermissions — Capacitor's own
    // permission-alias wrapper silently resolving "not granted" without the
    // dialog ever appearing. There's no getUserMedia-equivalent browser API
    // for storage/photos to fall back on, so this calls the underlying
    // AndroidX API directly instead, bypassing whichever step of
    // Capacitor's own wrapper was dropping the request. hasPhotoPermission()
    // checks only whichever single permission string actually applies on
    // this device's SDK version (not Capacitor's own getPermissionState,
    // which ANDs every string under an alias — READ_EXTERNAL_STORAGE can
    // never register granted on 13+ thanks to its maxSdkVersion="32", which
    // would keep that combined check stuck on "not granted" forever).
    //
    // setKeepAlive(true) mirrors what Capacitor's own requestPermissionForAlias
    // does internally — the system permission dialog can outlive this
    // Activity (recreated on a config change, or killed under memory
    // pressure while it's showing), and without this the pending call would
    // be lost rather than resolved by onPhotoPermissionResult once the user
    // answers it.
    @PluginMethod
    public void ensureCameraPermissions(PluginCall call) {
        boolean hasCamera = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        if (hasCamera) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Camera permission unavailable");
            return;
        }
        call.setKeepAlive(true);
        pendingCameraPermissionCall = call;
        String[] perms = new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO };
        getActivity().runOnUiThread(() ->
            ((MainActivity) getActivity()).getCameraPermissionLauncher().launch(perms));
    }

    @PluginMethod
    public void ensurePhotoPermissions(PluginCall call) {
        if (hasPhotoPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Photo permission unavailable");
            return;
        }
        call.setKeepAlive(true);
        pendingPhotoPermissionCall = call;
        String[] perms;
        if (Build.VERSION.SDK_INT >= 34) {
            perms = new String[] {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
            };
        } else if (Build.VERSION.SDK_INT >= 33) {
            perms = new String[] {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            };
        } else {
            perms = new String[] {
                Manifest.permission.READ_EXTERNAL_STORAGE
            };
        }
        getActivity().runOnUiThread(() ->
            ((MainActivity) getActivity()).getPhotoPermissionLauncher().launch(perms));
    }

    private boolean hasPhotoPermission() {
        if (Build.VERSION.SDK_INT >= 34) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) == PackageManager.PERMISSION_GRANTED;
        } else if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }
    }

    // Deep-links into this app's own page in the system Settings app (the
    // same "App info -> Permissions" screen a user reaches manually) — the
    // only way to grant a permission the user has already denied twice /
    // denied with "Don't ask again" checked, since Android intentionally
    // stops ActivityCompat.requestPermissions() from showing the system
    // dialog again at that point (it would return DENIED instantly, with no
    // UI at all). Used by MediaPermissionModal.jsx as the fallback action
    // when a plain re-request (ensureMediaPermissions above) doesn't help.
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(android.net.Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings");
        }
    }

    // Mirrors the web app's light/dark theme preference into a plain native
    // SharedPreferences file — IncomingCallActivity.java reads this directly
    // (NOT through this plugin; it may run with the WebView/JS layer never
    // having started at all, e.g. answering a call on a killed app) to make
    // its lock-screen call UI match the user's actual theme instead of being
    // hardcoded to one look. App.jsx calls this every time the theme is
    // applied (on toggle, and once on startup) so the native copy is never
    // more than one theme change stale.
    @PluginMethod
    public void setThemePreference(PluginCall call) {
        String theme = call.getString("theme", "dark");
        getContext().getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(THEME_PREFS_KEY, theme).apply();
        call.resolve();
    }

    static final String THEME_PREFS_NAME = "sahaplay_native_prefs";
    static final String THEME_PREFS_KEY = "theme";

    // Same mirroring approach as setThemePreference above, for the user's
    // custom call ringtone (see AppSettings.jsx's Sound section) —
    // IncomingCallActivity.java reads this directly (same rationale: it can
    // be showing the ring screen before the WebView/JS layer has ever run)
    // instead of always falling back to the phone's system default ringtone.
    // Called from JS whenever the setting loads or changes; an empty string
    // means "no custom ringtone, use the default."
    @PluginMethod
    public void setRingtonePreference(PluginCall call) {
        String url = call.getString("url", "");
        getContext().getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(RINGTONE_PREFS_KEY, url).apply();
        call.resolve();
    }

    static final String RINGTONE_PREFS_KEY = "ringtoneUrl";

    // Same mirroring approach again, for the message-notification tone (see
    // AppSettings.jsx's Sound section) — a preset id ('chime'/'bird'/'none'/
    // etc, see frontend/src/lib/notificationSounds.js), not an uploaded file
    // like the ringtone above, so SahaplayFirebaseMessagingService maps it to
    // one of the pre-rendered res/raw/tone_*.wav files rather than streaming
    // a URL. Needed because a plain chat-message push used to carry a
    // `notification` block, which Android auto-displays using its own
    // default channel/sound WITHOUT ever running our code at all whenever
    // the app is backgrounded or killed — the message tone picker had no
    // effect in exactly that case. Defaults to 'chime' (this app's own
    // default) when never set.
    @PluginMethod
    public void setMessageTonePreference(PluginCall call) {
        String toneId = call.getString("toneId", "chime");
        getContext().getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(MESSAGE_TONE_PREFS_KEY, toneId).apply();
        call.resolve();
    }

    static final String MESSAGE_TONE_PREFS_KEY = "messageTone";

    private static void stopBluetoothScoQuietly(AudioManager am) {
        try {
            am.setBluetoothScoOn(false);
            am.stopBluetoothSco();
        } catch (Exception ignored) {}
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
