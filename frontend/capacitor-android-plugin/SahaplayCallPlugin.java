package com.sahaplay.app;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// JS <-> native bridge for the WhatsApp-style native calling engine (see
// the plan doc). Phase 2 exposes just enough to prove the crypto + WebRTC
// signaling round-trip actually works: initCallEngine/setNaclSecretKey to
// hand over what CallEngineService needs, and startCall as the "bare debug
// trigger" the plan calls for. No Telecom, no notifications yet — those
// arrive in Phase 3/4. See frontend/src/lib/nativeCallEngine.js for the JS
// side of this bridge and AppSettings.jsx for the Phase 2 debug UI.
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

    // Phase 2's "bare debug trigger" — starts a real native call:invite
    // against a live callee. Only the OUTGOING direction is meant to be
    // exercised right now (see CallEngineService's class comment on the
    // JS/native double-listener collision for incoming calls).
    @PluginMethod
    public void startCall(PluginCall call) {
        String calleeUsername = call.getString("calleeUsername");
        String callType = call.getString("callType", "voice");
        if (calleeUsername == null) { call.reject("calleeUsername is required"); return; }
        attachStatusForwarding();
        CallEngineService.get(getContext()).startCall(calleeUsername, callType);
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
