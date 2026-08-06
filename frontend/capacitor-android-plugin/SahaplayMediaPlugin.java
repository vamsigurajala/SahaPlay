package com.sahaplay.app;

import android.content.Context;
import android.media.AudioManager;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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
@CapacitorPlugin(name = "SahaplayMedia")
public class SahaplayMediaPlugin extends Plugin {

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

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
