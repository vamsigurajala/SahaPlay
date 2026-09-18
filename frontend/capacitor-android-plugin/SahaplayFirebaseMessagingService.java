package com.sahaplay.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telecom.TelecomManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
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
        // Unconditional, unlike everything below it — if this line is missing
        // from `adb logcat -s SahaplayFCM` for a push you know the server
        // sent, the OS never woke this process at all (battery optimization /
        // OEM autostart restriction), which is a device setting, not
        // something fixable from inside this method. If it IS present but
        // nothing rings/notifies, the bug is somewhere below instead.
        android.util.Log.i("SahaplayFCM", "onMessageReceived type=" + data.get("type") + " data=" + data);
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
        } else if ("dm".equals(data.get("type")) || "room".equals(data.get("type"))) {
            // A chat message push. This USED TO be sent as a plain
            // `notification`-block FCM message (not data-only like every
            // branch above) — Android auto-displays that itself, using its
            // own default channel/sound, and SKIPS onMessageReceived()
            // ENTIRELY whenever the app is backgrounded or killed (see this
            // class's own top-of-file comment on that exact behavior). That
            // meant the message-tone picker in AppSettings.jsx's Sound
            // section had literally no effect the moment the app wasn't
            // already open — this code never even ran. Now that
            // notifyChatMessage sends this data-only (see backend/server.js),
            // this branch runs unconditionally and builds the notification
            // itself, so the user's chosen tone (mirrored via
            // SahaplayMediaPlugin.setMessageTonePreference) is what actually
            // plays, foreground or not.
            String title = data.get("title");
            String body = data.get("body");
            String tag = data.get("tag");
            if (title == null) title = "New message";
            if (body == null) body = "";

            final String messageChannelId = "sahaplay_messages";
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // No channel sound at all — see playMessageTone() below,
                // which plays the user's actual chosen tone explicitly via
                // MediaPlayer instead. A channel's sound is immutable once
                // created (recreating it on every preference change would be
                // its own separate can of worms), so this sidesteps that
                // entirely rather than fighting it.
                NotificationChannel channel = new NotificationChannel(messageChannelId, "Messages", NotificationManager.IMPORTANCE_HIGH);
                channel.setSound(null, null);
                nm.createNotificationChannel(channel);
            }

            // Deep link (not getLaunchIntentForPackage) so the tap actually
            // opens the specific chat, not just the app generically —
            // Capacitor's own Push Notifications plugin only forwards a tap
            // as pushNotificationActionPerformed for a notification IT
            // built; since this one is built manually here (same reason the
            // call notifications above are), that event never fires for it.
            // See nativeChatOpenBridge.js, which listens for this exact link
            // and rebroadcasts it into the same 'open_chat_from_notification'
            // event the old path already used.
            String chatId = data.get("chatId");
            String chatType = data.get("type");
            Uri deepLinkUri = Uri.parse("sahaplay://chat-open?type=" + Uri.encode(chatType) + "&chatId=" + Uri.encode(chatId));
            Intent openIntent = new Intent(Intent.ACTION_VIEW, deepLinkUri);
            openIntent.setPackage(getPackageName());
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
            int notificationId = (tag != null ? tag : title).hashCode();
            PendingIntent contentPendingIntent = PendingIntent.getActivity(this, notificationId, openIntent, piFlags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, messageChannelId)
                .setSmallIcon(getApplicationContext().getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH);
            if (contentPendingIntent != null) builder.setContentIntent(contentPendingIntent);

            if (nm != null) nm.notify(notificationId, builder.build());
            playMessageTone();

            // Shows immediately with just the app icon above (no network
            // wait on the notification itself) — the sender's real avatar
            // (see notifyChatMessage in backend/server.js) is fetched here on
            // a background thread and patched in via setLargeIcon() moments
            // later, re-using the exact same fetch-then-re-notify() approach
            // IncomingCallActivity already uses for the caller's photo on the
            // ring screen. Without this, message notifications only ever
            // showed the generic SahaPlay icon, unlike desktop/browser (which
            // gets the real avatar for free over the still-open live socket,
            // not through this native push path at all).
            String senderAvatarPath = data.get("senderAvatarPath");
            if (senderAvatarPath != null && !senderAvatarPath.isEmpty()) {
                fetchAndSetMessageAvatar(senderAvatarPath, notificationId, builder, nm);
            }
        } else if ("test".equals(data.get("type"))) {
            // AppSettings.jsx's "Send a test notification" button (see
            // POST /api/push/test in backend/server.js) — routed through a
            // real backend push rather than anything built purely in JS, so
            // it actually exercises FCM token registration + this device's
            // notification permission, foreground or not. Deliberately its
            // own branch rather than reusing the "call"/"dm" cases above:
            // those trigger the full ringing UI / deep-linked chat-open,
            // neither of which makes sense for a plain connectivity test.
            String title = data.get("title");
            String body = data.get("body");
            if (title == null) title = "Test notification";
            if (body == null) body = "";

            final String testChannelId = "sahaplay_messages";
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(testChannelId, "Messages", NotificationManager.IMPORTANCE_HIGH);
                nm.createNotificationChannel(channel);
            }

            Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent contentPendingIntent = (openIntent != null)
                ? PendingIntent.getActivity(this, 0, openIntent, piFlags)
                : null;

            NotificationCompat.Builder testBuilder = new NotificationCompat.Builder(this, testChannelId)
                .setSmallIcon(getApplicationContext().getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH);
            if (contentPendingIntent != null) testBuilder.setContentIntent(contentPendingIntent);
            if (nm != null) nm.notify(("sahaplay_test_" + System.currentTimeMillis()).hashCode(), testBuilder.build());
        }
    }

    private static final String API_BASE = "https://sahaplay.com";

    // Same fetch-then-re-notify() shape as IncomingCallActivity's own avatar
    // loader — the notification is already showing (built with just the app
    // icon) by the time this runs, so a slow/failed network fetch never
    // delays or blocks the notification itself from appearing.
    private void fetchAndSetMessageAvatar(String avatarPath, int notificationId, NotificationCompat.Builder builder, NotificationManager nm) {
        new Thread(() -> {
            try {
                String avatarUrl = avatarPath.startsWith("http") ? avatarPath : (API_BASE + avatarPath);
                HttpURLConnection conn = (HttpURLConnection) new URL(avatarUrl).openConnection();
                conn.setRequestProperty("User-Agent", "SahaPlay-Android");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                if (conn.getResponseCode() != 200) return;
                Bitmap photo;
                try (InputStream is = conn.getInputStream()) {
                    photo = BitmapFactory.decodeStream(is);
                }
                if (photo == null || nm == null) return;
                builder.setLargeIcon(photo);
                nm.notify(notificationId, builder.build());
            } catch (Throwable t) {
                Log.w("SahaplayFCM", "fetchAndSetMessageAvatar failed", t);
            }
        }).start();
    }

    private MediaPlayer messageTonePlayer;

    // Plays the user's chosen message tone (one of the pre-rendered
    // res/raw/tone_*.wav files matching frontend/src/lib/notificationSounds.js's
    // TONES catalog) exactly once — not looped, this is a one-shot
    // notification sound, not a ringtone. Reads the preference fresh every
    // time (mirrored via SahaplayMediaPlugin.setMessageTonePreference)
    // instead of baking it into the (immutable) notification channel, so a
    // changed preference takes effect on the very next message with no
    // channel-recreation dance needed. 'none' plays nothing, matching the
    // in-app JS behavior for that same choice.
    private void playMessageTone() {
        try {
            SharedPreferences prefs = getSharedPreferences(SahaplayMediaPlugin.THEME_PREFS_NAME, Context.MODE_PRIVATE);
            String toneId = prefs.getString(SahaplayMediaPlugin.MESSAGE_TONE_PREFS_KEY, "chime");
            if ("none".equals(toneId)) return;
            int resId = toneResourceFor(toneId);
            if (resId == 0) return;

            if (messageTonePlayer != null) {
                try { messageTonePlayer.release(); } catch (Exception ignored) {}
                messageTonePlayer = null;
            }
            MediaPlayer mp = MediaPlayer.create(this, resId);
            if (mp == null) return;
            messageTonePlayer = mp;
            mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            mp.setOnCompletionListener(player -> {
                try { player.release(); } catch (Exception ignored) {}
                if (messageTonePlayer == player) messageTonePlayer = null;
            });
            mp.start();
        } catch (Exception e) {
            android.util.Log.w("SahaplayFCM", "playMessageTone failed", e);
        }
    }

    private static int toneResourceFor(String toneId) {
        if (toneId == null) return R.raw.tone_chime;
        switch (toneId) {
            case "chime": return R.raw.tone_chime;
            case "ping": return R.raw.tone_ping;
            case "pop": return R.raw.tone_pop;
            case "marimba": return R.raw.tone_marimba;
            case "bell": return R.raw.tone_bell;
            case "bird": return R.raw.tone_bird;
            case "bubble": return R.raw.tone_bubble;
            case "waterdrop": return R.raw.tone_waterdrop;
            case "rain": return R.raw.tone_rain;
            case "windchime": return R.raw.tone_windchime;
            default: return R.raw.tone_chime;
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
    }
}
