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
// no Activity, no bringing the app to the foreground at all. Both used to
// be PendingIntent.getActivity() (Decline via IncomingCallActivity's
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
    public static final String EXTRA_CALL_ID = "callId";
    // Whichever account is declining (see IncomingCallActivity.EXTRA_CALLEE
    // for why this must be THIS device's own username, not the caller's) or
    // ending the call (whoever's session this ongoing-call notification
    // belongs to).
    public static final String EXTRA_USERNAME = "username";

    @Override
    public void onReceive(Context context, Intent intent) {
        String callId = intent.getStringExtra(EXTRA_CALL_ID);
        String username = intent.getStringExtra(EXTRA_USERNAME);
        if (callId == null || username == null) return;

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(callId.hashCode());

        String action = intent.getAction();
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
