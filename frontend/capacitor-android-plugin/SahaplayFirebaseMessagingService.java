package com.sahaplay.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telecom.TelecomManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

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

    // Keys for the Bundle handed to TelecomManager.addNewIncomingCall() (via
    // TelecomManager.EXTRA_INCOMING_CALL_EXTRAS) and read back on the other
    // side in SahaplayConnectionService.onCreateIncomingConnection(). Kept
    // here since this is where the values first come from (the FCM data
    // payload) — SahaplayConnectionService just re-reads the same three keys.
    public static final String EXTRA_TELECOM_CALL_ID = "sahaplay_call_id";
    public static final String EXTRA_TELECOM_CALLER = "sahaplay_caller_username";
    public static final String EXTRA_TELECOM_CALL_TYPE = "sahaplay_call_type";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        if ("call".equals(data.get("type"))) {
            String callId = data.get("callId");
            String callerUsername = data.get("callerUsername");
            String callType = data.get("callType");
            String calleeUsername = data.get("calleeUsername");
            // Best-effort — present on pushes sent after the caller-details
            // payload was added server-side (see call:invite in
            // backend/server.js); null on anything sent before that, which
            // IncomingCallActivity's own fallback fetch already covers.
            String callerDisplayName = data.get("callerDisplayName");
            String callerAvatarPath = data.get("callerAvatarPath");
            if (callId == null || callerUsername == null) return;

            // GUARANTEED ring, unconditionally — see the long comment below
            // for why this is no longer gated behind Telecom's outcome.
            // This is the exact call/path that reliably worked before
            // Phase 3 ever touched this file.
            IncomingCallActivity.showIncomingCall(this, callId, callerUsername, callType, calleeUsername, callerDisplayName, callerAvatarPath);

            // Fire-and-forget on its own thread, deliberately decoupled
            // from the ring above. ensureSelfInitialized() stands up the
            // real WebRTC engine (PeerConnectionFactory/EglBase), which
            // some WebRTC internals assume runs on a thread with a Looper
            // prepared — FCM's own delivery thread has none. The socket
            // only actually needs to be ready by the time Answer is tapped
            // (seconds later), not before ringing starts.
            new Thread(() -> {
                try {
                    CallEngineService.get(getApplicationContext()).ensureSelfInitialized();
                } catch (Throwable t) {
                    android.util.Log.e("SahaplayFCM", "ensureSelfInitialized failed", t);
                }
            }).start();

            // Best-effort Telecom integration layered OPPORTUNISTICALLY on
            // top of the guaranteed ring above — real audio-focus/Bluetooth
            // arbitration and true background answering when it works, but
            // no longer the only path to any UI showing at all. Real-device
            // testing (MIUI) showed addNewIncomingCall() can return
            // normally, with no exception thrown, while Telecom silently
            // never invokes onCreateIncomingConnection()/onShowIncomingCallUi()
            // afterwards — almost certainly the self-managed PhoneAccount
            // needing to be manually enabled in system Calling-account
            // settings on that OEM, which no code here can force. Treating
            // "addNewIncomingCall didn't throw" as "it will definitely
            // ring" was the actual bug: it meant that silent-failure mode
            // produced total silence, a regression from the
            // reliably-working pre-Phase-3 behavior. If/when Telecom DOES
            // cooperate on a given device, SahaplayConnectionService still
            // creates a real Connection, and IncomingCallActivity's Answer/
            // Decline already prefer it over the plain REST/deep-link path
            // (see SahaplayConnection.getCurrent() there) — so nothing is
            // lost by no longer gating the ring on this succeeding.
            try {
                PhoneAccountRegistrar.register(this);
                TelecomManager telecomManager = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
                if (telecomManager == null) throw new IllegalStateException("no TelecomManager");
                Bundle callExtras = new Bundle();
                callExtras.putString(EXTRA_TELECOM_CALL_ID, callId);
                callExtras.putString(EXTRA_TELECOM_CALLER, callerUsername);
                callExtras.putString(EXTRA_TELECOM_CALL_TYPE, callType);
                Bundle extras = new Bundle();
                extras.putParcelable(TelecomManager.EXTRA_INCOMING_CALL_EXTRAS, callExtras);
                telecomManager.addNewIncomingCall(PhoneAccountRegistrar.getHandle(this), extras);
            } catch (Throwable t) {
                android.util.Log.e("SahaplayFCM", "Telecom addNewIncomingCall failed (non-fatal, ring already showing)", t);
            }
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
        } else if ("call-missed".equals(data.get("type"))) {
            // A real, dismissible notification for a call that rang out (or
            // was cancelled) before it was answered — distinct from
            // "call-cancel" above, which only dismisses whatever ring UI is
            // showing and carries no content of its own. Sent server-side
            // only to whoever didn't answer (see sendMissedCallPush in
            // backend/server.js), never to the caller. Own dedicated
            // channel: DEFAULT importance/sound is right for this (a
            // completed, non-urgent event), unlike the ringing channel's
            // IMPORTANCE_HIGH or the ongoing-call channel's silent
            // IMPORTANCE_LOW.
            String callerDisplayName = data.get("callerDisplayName");
            String callerUsername = data.get("callerUsername");
            String callId = data.get("callId");
            String who = callerDisplayName != null ? callerDisplayName : callerUsername;

            final String missedChannelId = "sahaplay_missed_call";
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(missedChannelId, "Missed Calls", NotificationManager.IMPORTANCE_DEFAULT);
                nm.createNotificationChannel(channel);
            }

            Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent contentPendingIntent = (openIntent != null)
                ? PendingIntent.getActivity(this, 0, openIntent, piFlags)
                : null;

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, missedChannelId)
                .setSmallIcon(getApplicationContext().getApplicationInfo().icon)
                .setContentTitle("Missed call")
                .setContentText(who != null ? (who + " called") : "You have a missed call")
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
            if (contentPendingIntent != null) builder.setContentIntent(contentPendingIntent);

            if (nm != null) {
                int notificationId = (callId != null ? callId : String.valueOf(System.currentTimeMillis())).hashCode();
                nm.notify(notificationId, builder.build());
            }
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
    }
}
