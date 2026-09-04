package com.sahaplay.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

// Handles the incoming-call notification's Decline button and the
// ongoing-call notification's Hang Up button entirely in the background —
// no Activity, no bringing the app to the foreground at all. Also handles
// the Answer button's ACTION_ANSWER_PING — that one DOES still launch the
// app (answering needs real WebRTC, which only exists in the JS/WebView
// layer), but fires a background extend-ring ping first, before the launch
// even starts (see that branch below and the /extend-ring route). Decline/
// End used to be PendingIntent.getActivity() (Decline via IncomingCallActivity's
// EXTRA_AUTO_DECLINE cold-launch, End via the sahaplay://call-end deep
// link), and EVERY getActivity() PendingIntent — even one that resolves to
// an Activity which finishes itself instantly — briefly resumes/launches
// the app first, which reads as "tapping Decline opened the app" instead of
// the tap just... declining. WhatsApp/Telegram's own notification actions
// never do this; a PendingIntent.getBroadcast() invokes onReceive() here
// directly with no window/Activity ever created, which is the only way to
// truly act in the background.
//
// Talks to the backend directly over plain HTTPS (same as
// IncomingCallActivity's existing postDecline) rather than routing through
// the JS/socket layer — critically, this is what makes both actions reach
// the OTHER person immediately regardless of whether THIS device's WebView
// is even running right now. The old hang-up path only worked by deep-
// linking back into the app and waiting for CallContext.jsx to emit
// 'call:end' over its own socket; if that socket wasn't alive (app
// backgrounded long enough to be suspended, or the process died), the other
// person's phone kept showing the call as ringing/active far longer than it
// should have.
public class CallActionReceiver extends BroadcastReceiver {
    private static final String API_BASE = "https://sahaplay.com";

    public static final String ACTION_DECLINE = "com.sahaplay.app.action.DECLINE_CALL";
    public static final String ACTION_END = "com.sahaplay.app.action.END_CALL";
    // Fired the instant the notification's Answer button is tapped, before
    // the (possibly cold-starting) app has even launched — see the matching
    // comment on this class and on the /extend-ring route it hits.
    public static final String ACTION_ANSWER_PING = "com.sahaplay.app.action.ANSWER_PING";
    public static final String EXTRA_CALL_ID = "callId";
    // Whichever account is declining (see IncomingCallActivity.EXTRA_CALLEE
    // for why this must be THIS device's own username, not the caller's) or
    // ending the call (whoever's session this ongoing-call notification
    // belongs to).
    public static final String EXTRA_USERNAME = "username";

    @Override
    public void onReceive(Context context, Intent intent) {
        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        if (callId == null) return;

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(callId.hashCode());

        String action = intent.getAction();

        // Answer is fundamentally different from Decline/End: it can't
        // happen over REST at all (real getUserMedia/RTCPeerConnection only
        // exists once the JS/WebView layer is alive), so this can't just
        // stay backgrounded the way Decline/End do. This fires the
        // extend-ring ping FIRST, in the background, before anything else
        // happens, buying the cold-starting app some runway against
        // CALL_RING_TIMEOUT_MS. Returns immediately after — none of the
        // Decline/End bookkeeping below (call-log username requirement,
        // notifyNativeCallEnded) applies to answering.
        //
        // Launches IncomingCallActivity in its auto-answer mode rather than
        // firing the sahaplay://call-answer deep link straight from this
        // BroadcastReceiver — that used to go straight from "notification
        // tapped" to a cold-starting MainActivity with nothing shown in
        // between until its WebView finished loading over the network (see
        // IncomingCallActivity.EXTRA_AUTO_ANSWER's own comment). Launching
        // this Activity instead shows its native "Connecting…" state
        // immediately, with no blank gap.
        if (ACTION_ANSWER_PING.equals(action)) {
            postJson(API_BASE + "/api/calls/" + urlEncode(callId) + "/extend-ring", "{}");
            Intent activityIntent = new Intent(context, IncomingCallActivity.class);
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALLER, intent.getStringExtra(IncomingCallActivity.EXTRA_CALLER));
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALL_TYPE, intent.getStringExtra(IncomingCallActivity.EXTRA_CALL_TYPE));
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALLEE, intent.getStringExtra(IncomingCallActivity.EXTRA_CALLEE));
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALLER_DISPLAY_NAME, intent.getStringExtra(IncomingCallActivity.EXTRA_CALLER_DISPLAY_NAME));
            activityIntent.putExtra(IncomingCallActivity.EXTRA_CALLER_AVATAR_PATH, intent.getStringExtra(IncomingCallActivity.EXTRA_CALLER_AVATAR_PATH));
            activityIntent.putExtra(IncomingCallActivity.EXTRA_AUTO_ANSWER, true);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try { context.startActivity(activityIntent); } catch (Exception ignored) {}
            return;
        }

        String username = intent.getStringExtra(EXTRA_USERNAME);
        if (username == null) return;

        if (ACTION_DECLINE.equals(action)) {
            postJson(API_BASE + "/api/calls/" + urlEncode(callId) + "/decline",
                "{\"calleeUsername\":\"" + escapeJson(username) + "\"}");
        } else if (ACTION_END.equals(action)) {
            // Stops the persistent ongoing-call foreground service/
            // notification on THIS device immediately — same ACTION_STOP
            // SahaplayMediaPlugin.stopCallForegroundService already uses,
            // just triggered natively instead of from JS.
            Intent stopIntent = new Intent(context, SahaplayCallService.class);
            stopIntent.setAction(SahaplayCallService.ACTION_STOP);
            try { context.startService(stopIntent); } catch (Exception ignored) {}
            postJson(API_BASE + "/api/calls/" + urlEncode(callId) + "/end",
                "{\"username\":\"" + escapeJson(username) + "\"}");
        }
        // The HTTP calls above only tell the OTHER person the call is over —
        // they do nothing for THIS device's own call screen/WebRTC state.
        // If the app's JS layer is still alive (backgrounded, not killed),
        // tell it too, so the call actually tears down here instead of
        // continuing to run until the process eventually dies on its own.
        // See SahaplayMediaPlugin.notifyNativeCallEnded() for the full
        // reasoning — this is what fixes "I tapped Hang Up/Decline in the
        // notification but the call kept going on my end."
        SahaplayMediaPlugin.notifyNativeCallEnded();
    }

    private static String urlEncode(String s) {
        try { return URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; }
    }

    private static String escapeJson(String s) {
        return s == null ? "" : s.replace("\"", "");
    }

    private static void postJson(String urlStr, String body) {
        // A BroadcastReceiver's onReceive() must return quickly and can't
        // block — same "fire the network call on its own thread" approach
        // IncomingCallActivity's postDecline already uses.
        new Thread(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode(); // force the request to actually execute
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }
}
