package com.sahaplay.app;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;

// Real call-audio output routing (earpiece/speaker/Bluetooth headset) —
// extracted from SahaplayMediaPlugin.setAudioRoute/getAvailableAudioRoutes
// (which now delegate here) so ActiveCallActivity can call the SAME logic
// directly without going through the Capacitor plugin bridge, which only
// exists for whichever Activity currently hosts the WebView/Bridge
// (MainActivity) — a separate native call Activity has no bridge/PluginCall
// of its own to route through.
public class AudioRouteController {

    // MODE_IN_COMMUNICATION is the standard AudioManager mode for an active
    // VoIP call — it's what makes setSpeakerphoneOn/Bluetooth SCO actually
    // take effect instead of being ignored, and is set on every route change
    // (not just once) since 'normal' below explicitly leaves it.
    public static void setRoute(Context context, String route) {
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return;
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
                break;
        }
    }

    // getDevices() (API 23+) reports currently connected/available audio
    // output devices — checking for a Bluetooth SCO/A2DP entry here (rather
    // than assuming) mirrors WhatsApp's own behavior of only showing the
    // Bluetooth option when a headset is actually paired and connected, not
    // unconditionally.
    public static boolean isBluetoothAudioAvailable(Context context) {
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return false;
        for (AudioDeviceInfo device : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int type = device.getType();
            if (type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
                return true;
            }
        }
        return false;
    }

    private static void stopBluetoothScoQuietly(AudioManager am) {
        try {
            am.setBluetoothScoOn(false);
            am.stopBluetoothSco();
        } catch (Exception ignored) {}
    }
}
