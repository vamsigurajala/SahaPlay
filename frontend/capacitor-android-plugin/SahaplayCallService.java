package com.sahaplay.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

// Keeps an active call's WebRTC connections alive while the app is
// backgrounded, and gives the user a persistent, always-visible way to see
// who they're on a call with, how long it's been, and end it — even from
// outside the app or the lock screen. Without a foreground service, Android
// can throttle/kill this app's background process on its own schedule
// (varies by OEM and memory pressure) the moment it's no longer the
// foreground Activity, silently dropping the call with no warning.
//
// Runs for the entire duration of an active call, not just while
// backgrounded — starting it reactively only once the app is detected as
// backgrounded would add a real gap (however brief) between "app paused"
// and "service actually running", and every mainstream calling app already
// shows this kind of notification throughout an active call regardless of
// foreground/background state.
//
// Same "custom RemoteViews for a real full-width button" approach as
// IncomingCallActivity's own notification (see res/layout/notification_
// ongoing_call.xml) — a plain addAction() end-call button has the same
// small-grey-chip limitation there as it did on the incoming-call
// notification.
public class SahaplayCallService extends Service {
    private static final String CHANNEL_ID = "sahaplay_ongoing_call";
    private static final int NOTIFICATION_ID = 9911;

    public static final String EXTRA_PEER_NAME = "peerName";
    public static final String EXTRA_STARTED_AT = "startedAtMillis";
    // "ringing" (outgoing call, not yet answered — no elapsed time to show
    // yet) or "active" (answered — Chronometer running). See CallContext.jsx,
    // which starts this service the moment a call is placed (not just once
    // active) so the JS/socket layer stays alive through the ring too — a
    // backgrounded caller's app can otherwise be suspended by Android before
    // 'call:declined'/'call:answered' ever arrives, which is what made a
    // caller sometimes not learn a call was declined until they reopened the
    // app much later.
    public static final String EXTRA_STATUS = "status";
    // THIS device's own logged-in account and the call this notification
    // represents — both needed so the Hang Up button (see
    // CallActionReceiver.ACTION_END) can tell the backend WHO is leaving
    // WHICH call natively, without needing the JS/socket layer alive.
    public static final String EXTRA_USERNAME = "username";
    public static final String EXTRA_CALL_ID = "callId";
    public static final String ACTION_STOP = "com.sahaplay.app.action.STOP_CALL_SERVICE";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String peerName = (intent != null) ? intent.getStringExtra(EXTRA_PEER_NAME) : null;
        long startedAt = (intent != null) ? intent.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis()) : System.currentTimeMillis();
        boolean isRinging = intent != null && "ringing".equals(intent.getStringExtra(EXTRA_STATUS));
        String username = (intent != null) ? intent.getStringExtra(EXTRA_USERNAME) : null;
        String callId = (intent != null) ? intent.getStringExtra(EXTRA_CALL_ID) : null;
        if (peerName == null || peerName.isEmpty()) peerName = "Ongoing call";

        Notification notification = buildNotification(peerName, startedAt, isRinging, username, callId);

        // FOREGROUND_SERVICE_TYPE_MICROPHONE (+ CAMERA) matches what this
        // service is actually for on Android 10+ - required declaration
        // since Android 14 (API 34) started enforcing that every foreground
        // service state its type. Both are declared here and in the
        // manifest even for a voice-only call - the manifest has to cover
        // every type this service might ever start with, and there's no
        // per-call-type native signal worth the complexity of varying it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                );
            } catch (Exception e) {
                // Camera/mic runtime permission wasn't actually granted at
                // this exact moment — Android 14+ throws here (a plain
                // uncaught exception crashes the ENTIRE app process, not
                // just this service) instead of failing gracefully.
                // SahaplayMediaPlugin.ensureMediaPermissions() is meant to
                // close this race before CallContext.jsx ever gets here, but
                // this is the last-resort backstop: degrade to "no
                // persistent notification for this call" rather than taking
                // the whole app down with it.
                stopSelf();
                return START_NOT_STICKY;
            }
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_STICKY;
    }

    private Notification buildNotification(String peerName, long startedAt, boolean isRinging, String username, String callId) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Ongoing Call", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows while a SahaPlay call is active");
            channel.setSound(null, null);
            nm.createNotificationChannel(channel);
        }

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);

        // Tapping the notification body reopens the app (the existing call
        // UI resumes automatically - CallContext's state was never torn
        // down, this is a plain app-launch intent, not a special deep link).
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentPendingIntent = (openIntent != null)
            ? PendingIntent.getActivity(this, 0, openIntent, piFlags)
            : null;

        // Handled entirely in the background via CallActionReceiver — no
        // Activity, the app is never opened/resumed (previously a
        // sahaplay://call-end deep link, which — like any getActivity()
        // PendingIntent — briefly resumed the app first even though
        // CallContext's own hangup() would tear everything down instantly
        // once it ran; that read as "tapping Hang Up opened the app").
        // Falls back to the old deep-link behavior in the unlikely case this
        // service was restarted by the OS without its extras (e.g. after a
        // process death) and genuinely doesn't know who/which call this is —
        // still correct, just re-opens the app rather than acting silently.
        PendingIntent endPendingIntent;
        if (username != null && !username.isEmpty() && callId != null && !callId.isEmpty()) {
            Intent endIntent = new Intent(this, CallActionReceiver.class);
            endIntent.setAction(CallActionReceiver.ACTION_END);
            endIntent.putExtra(CallActionReceiver.EXTRA_CALL_ID, callId);
            endIntent.putExtra(CallActionReceiver.EXTRA_USERNAME, username);
            endPendingIntent = PendingIntent.getBroadcast(this, 1, endIntent, piFlags);
        } else {
            Uri endUri = Uri.parse("sahaplay://call-end");
            Intent endIntent = new Intent(Intent.ACTION_VIEW, endUri);
            endIntent.setPackage(getPackageName());
            endIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            endPendingIntent = PendingIntent.getActivity(this, 1, endIntent, piFlags);
        }

        // NotificationCompat.CallStyle.forOngoingCall — same first-party
        // Android call-notification API IncomingCallActivity now uses,
        // instead of a hand-rolled RemoteViews layout (see that file's
        // showIncomingCall() for why: it rendered inconsistently across
        // real devices). setUsesChronometer/setWhen below is the Builder's
        // own OS-managed chronometer, which counts from a plain wall-clock
        // "when" value directly — no elapsedRealtime conversion needed
        // (unlike the raw Chronometer View this replaces), so the class of
        // bug that produced a garbage "-496021:34:56" display can't recur.
        Person peerPerson = new Person.Builder()
            .setName(peerName)
            .setIcon(IconCompat.createWithBitmap(IncomingCallActivity.buildInitialsAvatarBitmap(peerName, 132)))
            .setImportant(true)
            .build();
        NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forOngoingCall(peerPerson, endPendingIntent);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(peerName)
            .setContentText(isRinging ? "Calling…" : "Ongoing call")
            .setSmallIcon(getApplicationInfo().icon)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setStyle(callStyle)
            .setOngoing(true)
            .setUsesChronometer(!isRinging)
            .setWhen(startedAt)
            .setShowWhen(!isRinging);
        if (contentPendingIntent != null) builder.setContentIntent(contentPendingIntent);
        return builder.build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
