package com.sahaplay.app;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

// Subclasses (rather than replaces) Capacitor's own FCM service — calling
// super.onMessageReceived() first preserves 100% of the existing, working
// behavior (forwarding to JS via PushNotificationsPlugin.sendRemoteMessage,
// and onNewToken's existing token-registration relay) with zero risk of
// regressing chat/friend-request push notifications or FCM token
// registration. Android only ever delivers an incoming FCM message to ONE
// registered FirebaseMessagingService — see AndroidManifest.xml, which
// explicitly removes Capacitor's own manifest-declared service entry
// (tools:node="remove") and registers this one in its place, so this is
// genuinely the only place messages arrive, not a second competing path.
//
// Call invites specifically (backend/server.js's call:invite handler) are
// sent as a data-only FCM message (no `notification` block) for exactly
// this reason: with a `notification` block present, Android's system
// auto-displays it and skips onMessageReceived() entirely whenever the app
// isn't foregrounded — this class would never even run, and there'd be no
// way to show the full-screen ringing UI. A pure data message is always
// handed to onMessageReceived(), foreground or not (as long as the OS
// hasn't force-stopped the app entirely).
public class SahaplayFirebaseMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        if ("call".equals(data.get("type"))) {
            IncomingCallActivity.showIncomingCall(
                this,
                data.get("callId"),
                data.get("callerUsername"),
                data.get("callType"),
                data.get("calleeUsername")
            );
        } else if ("call-cancel".equals(data.get("type"))) {
            // Sent the moment a ringing call is resolved any way (declined,
            // timed out, cancelled, or answered on another device) — see
            // sendCallCancelPush in backend/server.js. Without this, a
            // call:invite push that arrived late (FCM/OS battery throttling
            // is common on real devices with the screen off) could leave a
            // ring notification showing for a call that's already over —
            // tapping its Answer/Decline would silently do nothing, since
            // the server no longer has any record of it.
            IncomingCallActivity.cancelForCallId(this, data.get("callId"));
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
    }
}
