package com.sahaplay.app;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// JS <-> native bridge for the WhatsApp-style native calling engine (see
// the plan doc). initCallEngine/setNaclSecretKey hand over what
// CallEngineService needs to self-init; startCall is now the REAL entry
// point the app's own call button uses on Android (see
// GlobalChatWidget.jsx), not just the Phase 2 debug panel — Phase 4 wired
// CallEngineService's own OutgoingCallActivity/ActiveCallActivity in as the
// real call UI, so this plugin exists purely to hand JS's already-known
// callee info over to the engine and let it take it from there. See
// frontend/src/lib/nativeCallEngine.js for the JS side of this bridge.
@CapacitorPlugin(name = "SahaplayCallEngine")
public class SahaplayCallPlugin extends Plugin {

    @PluginMethod
    public void initCallEngine(PluginCall call) {
        String apiBase = call.getString("apiBase");
        String token = call.getString("token");
        String username = call.getString("username");
        if (apiBase == null || token == null || username == null) {
            call.reject("apiBase, token, and username are required");
            return;
        }
        CallEngineService.get(getContext()).init(apiBase, token, username);
        attachStatusForwarding();
        call.resolve();
    }

    @PluginMethod
    public void setNaclSecretKey(PluginCall call) {
        String secretKeyBase64 = call.getString("secretKeyBase64");
        if (secretKeyBase64 == null) { call.reject("secretKeyBase64 is required"); return; }
        byte[] key = Base64.decode(secretKeyBase64, Base64.NO_WRAP);
        CallEngineService.get(getContext()).setSecretKey(key);
        call.resolve();
    }

    @PluginMethod
    public void clearNaclSecretKey(PluginCall call) {
        CallEngineService.get(getContext()).clearSecretKey();
        call.resolve();
    }

    // calleeDisplayName/calleeAvatarUrl are optional — the JS caller
    // already has them in hand from the chat header it just tapped Call
    // from (see GlobalChatWidget.jsx), so OutgoingCallActivity can render
    // the real name/photo immediately with no extra native fetch, same
    // pattern as everywhere else in Phase 4.
    @PluginMethod
    public void startCall(PluginCall call) {
        String calleeUsername = call.getString("calleeUsername");
        String callType = call.getString("callType", "voice");
        String calleeDisplayName = call.getString("calleeDisplayName");
        String calleeAvatarUrl = call.getString("calleeAvatarUrl");
        if (calleeUsername == null) { call.reject("calleeUsername is required"); return; }
        attachStatusForwarding();
        CallEngineService.get(getContext()).startCall(calleeUsername, callType, calleeDisplayName, calleeAvatarUrl);
        call.resolve();
    }

    @PluginMethod
    public void endCallEngine(PluginCall call) {
        CallEngineService.get(getContext()).endCall();
        call.resolve();
    }

    // Forwards CallEngineService's plain-English status log to JS as a
    // 'callEngineStatus' event, so AppSettings.jsx's debug panel can show a
    // live log without polling.
    private void attachStatusForwarding() {
        CallEngineService.get(getContext()).setStatusListener(status -> {
            JSObject ret = new JSObject();
            ret.put("status", status);
            notifyListeners("callEngineStatus", ret);
        });
    }
}
