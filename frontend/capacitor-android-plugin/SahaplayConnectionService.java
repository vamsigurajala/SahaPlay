package com.sahaplay.app;

import android.os.Bundle;
import android.telecom.Connection;
import android.telecom.ConnectionRequest;
import android.telecom.ConnectionService;
import android.telecom.DisconnectCause;
import android.telecom.PhoneAccountHandle;
import android.util.Log;

// Self-managed Telecom ConnectionService. Android invokes
// onCreateIncomingConnection() when SahaplayFirebaseMessagingService hands
// an incoming call to TelecomManager.addNewIncomingCall() — this is the
// system entry point that makes real background/lock-screen answering
// possible at all (a plain notification, however full-screen, still can't
// get audio-focus/Bluetooth arbitration the way a Telecom-managed call
// does). Telecom itself provides no UI for a self-managed app —
// SahaplayConnection.onShowIncomingCallUi() is what actually launches the
// existing IncomingCallActivity ring screen.
public class SahaplayConnectionService extends ConnectionService {
    private static final String TAG = "SahaplayTelecom";

    @Override
    public Connection onCreateIncomingConnection(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Bundle extras = request.getExtras();
        String callId = extras != null ? extras.getString(SahaplayFirebaseMessagingService.EXTRA_TELECOM_CALL_ID) : null;
        String callerUsername = extras != null ? extras.getString(SahaplayFirebaseMessagingService.EXTRA_TELECOM_CALLER) : null;
        String callType = extras != null ? extras.getString(SahaplayFirebaseMessagingService.EXTRA_TELECOM_CALL_TYPE) : null;

        if (callId == null || callerUsername == null) {
            Log.w(TAG, "onCreateIncomingConnection missing required extras — refusing");
            return Connection.createFailedConnection(new DisconnectCause(DisconnectCause.ERROR));
        }

        CallEngineService.get(getApplicationContext()).registerIncomingCall(callId, callerUsername, callType);
        SahaplayConnection connection = new SahaplayConnection(getApplicationContext(), callId, callerUsername, callType);
        SahaplayConnection.registerCurrent(connection);
        return connection;
    }

    @Override
    public void onCreateIncomingConnectionFailed(PhoneAccountHandle connectionManagerPhoneAccount, ConnectionRequest request) {
        Log.w(TAG, "onCreateIncomingConnectionFailed for " + request);
    }
}
