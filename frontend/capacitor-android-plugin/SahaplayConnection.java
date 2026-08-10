package com.sahaplay.app;

import android.content.Context;
import android.net.Uri;
import android.telecom.Connection;
import android.telecom.DisconnectCause;
import android.telecom.TelecomManager;

// Bridges one Telecom-managed call's lifecycle to CallEngineService and the
// existing IncomingCallActivity ring screen. Telecom (not our own code)
// decides when to invoke onAnswer/onReject/onShowIncomingCallUi — see
// SahaplayConnectionService.onCreateIncomingConnection, which creates and
// returns one of these per incoming call.
//
// Only one call at a time is supported (matches CallEngineService's own
// single-session model in Phase 2/3) — `current` is a plain static field
// rather than a map, cleared whenever this connection reaches a terminal
// state.
public class SahaplayConnection extends Connection {
    private static SahaplayConnection current;

    public static void registerCurrent(SahaplayConnection connection) {
        current = connection;
    }

    // Returns the live connection for callId, or null if none/mismatched —
    // used by IncomingCallActivity's Answer/Decline buttons and by
    // CallEngineService when a call ends some other way (remote hangup,
    // decline, timeout) and Telecom needs to be told to release the call.
    public static SahaplayConnection getCurrent(String callId) {
        if (current != null && callId != null && callId.equals(current.callId)) return current;
        return null;
    }

    private final Context appContext;
    private final String callId;
    private final String callerUsername;
    private final String callType;

    public SahaplayConnection(Context appContext, String callId, String callerUsername, String callType) {
        this.appContext = appContext.getApplicationContext();
        this.callId = callId;
        this.callerUsername = callerUsername;
        this.callType = callType;

        setConnectionProperties(PROPERTY_SELF_MANAGED);
        setConnectionCapabilities(CAPABILITY_MUTE | CAPABILITY_SUPPORT_HOLD);
        setAudioModeIsVoip(true);
        setCallerDisplayName(callerUsername, TelecomManager.PRESENTATION_ALLOWED);
        setAddress(Uri.parse("sahaplay:" + callerUsername), TelecomManager.PRESENTATION_ALLOWED);
        setRinging();
    }

    public String getCallId() {
        return callId;
    }

    // Telecom's cue that it's our job to actually show incoming-call UI —
    // self-managed apps get no system UI of their own. Same full-screen
    // notification/Activity IncomingCallActivity already built for the
    // pre-Telecom flow, just triggered from here instead of directly from
    // SahaplayFirebaseMessagingService.
    @Override
    public void onShowIncomingCallUi() {
        String myUsername = CallEngineService.get(appContext).getMyUsername();
        IncomingCallActivity.showIncomingCall(appContext, callId, callerUsername, callType, myUsername);
    }

    // Called by IncomingCallActivity's Answer button (see getCurrent above)
    // and by Telecom itself (onAnswer below) — both paths must produce the
    // same effect, so Telecom's own state stays in sync regardless of which
    // one the user actually tapped.
    public void answerFromUi() {
        setActive();
        CallEngineService.get(appContext).acceptIncomingCall(callId);
    }

    public void declineFromUi() {
        CallEngineService.get(appContext).declineIncomingCall(callId);
        safeDisconnect(DisconnectCause.REJECTED);
    }

    // Called by CallEngineService when the call ends some other way (the
    // other side hung up/declined, or the ring simply timed out server-side)
    // — tells Telecom to release the call without re-invoking
    // CallEngineService.endCall() a second time (that's the caller here).
    public void disconnectFromEngine() {
        safeDisconnect(DisconnectCause.REMOTE);
    }

    @Override
    public void onAnswer() {
        answerFromUi();
    }

    @Override
    public void onAnswer(int videoState) {
        answerFromUi();
    }

    @Override
    public void onReject() {
        declineFromUi();
    }

    // Telecom releasing ITS OWN bookkeeping for this self-managed connection
    // is not the same thing as the real call needing to end — self-managed
    // Telecom integration has been unreliable throughout this project on
    // OEM skins like the ones this app is tested on (see the ring/answer/
    // decline "guaranteed" work earlier — all deliberately built to not
    // depend on Telecom succeeding at anything). If Telecom spuriously fires
    // this (audio-focus churn, another app's call, or any other
    // Telecom-internal reason unrelated to the actual WebRTC connection),
    // previously calling CallEngineService.endCall() here would take the
    // real, still-healthy call down with it — a plausible explanation for a
    // call silently dying a minute or two in with no user action. The
    // user's own End button already calls endCall() directly, and a genuine
    // remote hangup arrives over the signaling socket/REST (see
    // CallEngineService.teardown()'s own disconnectFromEngine() call) — this
    // callback now only releases Telecom's bookkeeping, not the call itself.
    @Override
    public void onDisconnect() {
        safeDisconnect(DisconnectCause.LOCAL);
    }

    @Override
    public void onAbort() {
        safeDisconnect(DisconnectCause.CANCELED);
    }

    // setDisconnected()/destroy() can legitimately be reached from two
    // directions at once (e.g. the user taps Decline right as a
    // call:cancelled arrives) — guarded so a double call is a harmless
    // no-op instead of a crash.
    private void safeDisconnect(int disconnectCauseCode) {
        try { setDisconnected(new DisconnectCause(disconnectCauseCode)); } catch (Exception ignored) {}
        if (current == this) current = null;
        try { destroy(); } catch (Exception ignored) {}
    }
}
