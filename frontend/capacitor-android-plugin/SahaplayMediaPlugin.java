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
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
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

    // The actual root cause behind "push notifications only arrive while the
    // app is in Recents": FCM delivers a data message by asking the OS to
    // start SahaplayFirebaseMessagingService, but stock Android's Doze/App
    // Standby (and every OEM's own, usually more aggressive, battery
    // manager — MIUI/ColorOS/FuntouchOS/EMUI all do their own thing on top
    // of stock Doze) can defer or altogether refuse that start once the app
    // has been swiped away and the OS decides it's "idle". Being on this
    // list is exactly what WhatsApp/Signal/Telegram prompt for on first run
    // for the same reason. isIgnoringBatteryOptimizations lets JS decide
    // whether to even show the fix-it banner (AppSettings.jsx) in the first
    // place — most users are already exempted by the OEM's own "unrestricted
    // for messaging apps" heuristics, and nagging those users would be pure
    // noise.
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean ignoring = pm != null && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
            ret.put("ignoring", ignoring);
        } catch (Exception e) {
            ret.put("ignoring", true); // fail open — never show the nag banner over a query error
        }
        call.resolve(ret);
    }

    // Shows the system's own "Allow SahaPlay to ignore battery
    // optimizations?" dialog — a direct Allow/Deny, no navigating Settings
    // manually. REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (normal protection
    // level, declared in AndroidManifest.xml) is required to fire this
    // specific intent; a handful of OEM builds (some MIUI versions) block it
    // anyway despite the permission being present, so this falls back to the
    // general (non-package-specific) battery-optimization list screen rather
    // than silently doing nothing.
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Could not open battery optimization settings");
            }
        }
    }

    // Best-effort deep link into the OEM-specific "Autostart"/"Startup
    // manager" screen that stock Android has no equivalent for at all —
    // MIUI, ColorOS (Oppo/Realme), FuntouchOS/OriginOS (Vivo), and EMUI/
    // MagicUI (Huawei/Honor) each independently gate whether a background-
    // killed app is allowed to relaunch itself in response to a broadcast
    // (which is exactly what receiving an FCM push while swiped-from-recents
    // requires), on top of and separately from stock Doze/battery-
    // optimization above. There is no public API to query or request this
    // directly (unlike ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS above) —
    // every app in this situation (WhatsApp included, on these OEMs) resorts
    // to the same pattern of deep-linking the OEM's own settings activity by
    // package/class name, which differ by OEM and sometimes by OS version,
    // and can be renamed or removed without notice. Tries each known
    // component in turn; falls back to the plain app-info settings page
    // (openAppSettings's destination) if none of them resolve on this
    // device, which still gets the user one tap away from the right place.
    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        String[][] candidates = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"},
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
        };
        PackageManager pm = getContext().getPackageManager();
        for (String[] c : candidates) {
            try {
                Intent intent = new Intent();
                intent.setComponent(new android.content.ComponentName(c[0], c[1]));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (intent.resolveActivity(pm) != null) {
                    getContext().startActivity(intent);
                    call.resolve();
                    return;
                }
            } catch (Exception ignored) {}
        }
        // No known OEM autostart screen on this device (either a stock/
        // Pixel-like build with no such concept, or an OEM/version this list
        // doesn't cover yet) — land the user on the app-info page instead of
        // silently no-op'ing.
        openAppSettings(call);
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
    //
    // This USED TO store the raw remote URL and let IncomingCallActivity
    // stream it live over the network at ring time. That was the actual bug
    // behind "I hear my ringtone only if I toggle the screen, never if the
    // screen's already on" — a call notification's process only gets a
    // brief, OEM-dependent window of guaranteed network access (many OEM
    // battery managers, e.g. MIUI, throttle background data far more
    // aggressively than stock Android's Doze, and only relax it around an
    // explicit screen-on event), so MediaPlayer.prepareAsync() on a network
    // source could stall indefinitely depending on exactly when/how the
    // ring screen happened to launch. Downloading the file ONCE here —
    // right when the user picks it, with the app foregrounded and a normal
    // network connection guaranteed — and caching it to local storage
    // removes that network dependency from the ring path entirely: ring-time
    // playback is then just opening a local file, which is fast and
    // deterministic regardless of screen/Doze state. RINGTONE_PREFS_KEY now
    // holds the cached LOCAL FILE PATH, not the URL.
    @PluginMethod
    public void setRingtonePreference(PluginCall call) {
        String url = call.getString("url", "");
        Context ctx = getContext().getApplicationContext();
        // Resolve immediately — JS doesn't need to wait on the download,
        // and a slow/failed download must never block the settings UI.
        call.resolve();
        if (url == null || url.isEmpty()) {
            ctx.getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
                .edit().remove(RINGTONE_PREFS_KEY).apply();
            new File(ctx.getFilesDir(), RINGTONE_CACHE_FILENAME).delete();
            return;
        }
        new Thread(() -> downloadRingtoneToCache(ctx, url)).start();
    }

    // Downloads to a temp file first and renames over the real cache file
    // only once the download fully succeeds — so a ring that happens to
    // fire mid-download (re-picking a ringtone while already on a call
    // elsewhere, or a retry after a network blip) never plays a truncated/
    // corrupt partial file. The SharedPreferences entry is only written
    // after that rename, so IncomingCallActivity never sees a path pointing
    // at a file that isn't fully there yet.
    private static void downloadRingtoneToCache(Context ctx, String url) {
        File tmp = new File(ctx.getFilesDir(), RINGTONE_CACHE_FILENAME + ".tmp");
        File dest = new File(ctx.getFilesDir(), RINGTONE_CACHE_FILENAME);
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            int code = conn.getResponseCode();
            if (code != 200) {
                android.util.Log.w("SahaplayMedia", "downloadRingtoneToCache: GET " + url + " -> " + code);
                return;
            }
            try (InputStream is = conn.getInputStream(); FileOutputStream os = new FileOutputStream(tmp)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) > 0) os.write(buf, 0, n);
            }
            if (!tmp.renameTo(dest)) {
                android.util.Log.w("SahaplayMedia", "downloadRingtoneToCache: rename failed for " + url);
                return;
            }
            ctx.getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
                .edit().putString(RINGTONE_PREFS_KEY, dest.getAbsolutePath()).apply();
        } catch (Exception e) {
            android.util.Log.w("SahaplayMedia", "downloadRingtoneToCache failed for " + url, e);
        } finally {
            tmp.delete();
        }
    }

    static final String RINGTONE_PREFS_KEY = "ringtoneUrl";
    private static final String RINGTONE_CACHE_FILENAME = "custom_ringtone_cache";

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

    // Backs the app's own "Save" button (lightbox, file-card, voice-note —
    // see frontend/src/lib/nativeDownload.js). The generic browser <a
    // download> trick this used to fall back on does nothing at all inside
    // an Android WebView (no download manager hook there), and Capacitor's
    // @capacitor/filesystem Directory.Documents writes into this app's own
    // PRIVATE sandbox (Android/data/com.sahaplay.app/...), which is hidden
    // from a normal file manager on Android 11+ — technically "saved" but
    // not something the user could ever find. This instead writes straight
    // into the same public Downloads folder a real browser download lands
    // in, via MediaStore.Downloads (API 29+) — which needs NO runtime
    // permission at all, since an app inserting its own row into its own
    // MediaStore-managed collection has never required one; only reading
    // another app's files does. `data` is base64 (no data: prefix, already
    // stripped by nativeDownload.js's blobToBase64), decoded here.
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String data = call.getString("data", "");
        String fileName = call.getString("fileName", "");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (data.isEmpty() || fileName.isEmpty()) {
            call.reject("Missing data or fileName");
            return;
        }
        Context ctx = getContext().getApplicationContext();
        // Off the main thread: base64-decoding a large media file plus a
        // disk write must never block the WebView/UI thread.
        new Thread(() -> writeToDownloads(call, ctx, data, fileName, mimeType)).start();
    }

    private static void writeToDownloads(PluginCall call, Context ctx, String data, String fileName, String mimeType) {
        try {
            byte[] bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                android.content.ContentResolver resolver = ctx.getContentResolver();
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(android.provider.MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                android.net.Uri item = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (item == null) throw new java.io.IOException("MediaStore insert returned null");
                try (java.io.OutputStream os = resolver.openOutputStream(item)) {
                    if (os == null) throw new java.io.IOException("openOutputStream returned null");
                    os.write(bytes);
                }
                values.clear();
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(item, values, null, null);
            } else {
                // Pre-Q: no MediaStore.Downloads collection yet — write the
                // file directly, gated by the maxSdkVersion=28 permission
                // declared in the manifest for exactly this branch.
                File downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                downloadsDir.mkdirs();
                try (FileOutputStream os = new FileOutputStream(new File(downloadsDir, fileName))) {
                    os.write(bytes);
                }
            }
            JSObject ret = new JSObject();
            ret.put("saved", true);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.w("SahaplayMedia", "saveToDownloads failed for " + fileName, e);
            call.reject("Save failed: " + e.getMessage());
        }
    }

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
